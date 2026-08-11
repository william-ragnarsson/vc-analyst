"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { initialState, streamReducer, type AnalysisState } from "@/lib/diligence/stream-state";
import { readProgressStream } from "@/lib/diligence/stream";
import { useAuth } from "@/components/features/auth/AuthProvider";
import { hashFile } from "@/lib/analyses/hash";
import {
  clearAnalyses,
  deleteAnalysis,
  getAnalysis,
  listAnalyses,
  type AnalysisSummary,
} from "@/lib/analyses/store";

const EMPTY_HISTORY: AnalysisSummary[] = [];

type Status = "idle" | "loading" | "done" | "error";

interface AnalysisContextValue {
  file: File | null;
  setFile: (file: File | null) => void;
  status: Status;
  error: string;
  stream: AnalysisState;
  /** Hash id of the run currently in the provider (running or just-finished); null when idle. */
  currentId: string | null;
  /** Start analysis for the current file. Re-viewing a saved deck routes to its report instead. */
  start: (opts?: { force?: boolean }) => void;
  /** Aborts an in-flight run (if any) and clears back to the dropzone state. */
  stop: () => void;
  history: AnalysisSummary[];
  /** True while the first fetch for the current user is in flight. */
  historyLoading: boolean;
  refreshHistory: () => Promise<void>;
  deleteRecord: (rowId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within an AnalysisProvider");
  return ctx;
}

export default function AnalysisProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, dataVersion, ensureAnonymous } = useAuth();
  const [file, setFileState] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [records, setRecords] = useState<AnalysisSummary[]>(EMPTY_HISTORY);
  // Which user `records` belongs to. Tracking it lets both the list and its
  // loading flag be *derived*, so switching users can't leave one account
  // briefly looking at another's analyses.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [stream, dispatch] = useReducer(streamReducer, undefined, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  const userId = user?.id ?? null;
  const history = loadedFor !== null && loadedFor === userId ? records : EMPTY_HISTORY;
  const historyLoading = Boolean(userId) && loadedFor !== userId;

  const refreshHistory = useCallback(async () => {
    const next = await listAnalyses();
    setRecords(next);
    setLoadedFor(userId);
  }, [userId]);

  // History is per-user, so it reloads whenever the user does — including the
  // anonymous → signed-in upgrade, where the same rows arrive under a real
  // account. `dataVersion` covers the case where that hand-over finishes after
  // this list has already loaded. No user means there is nothing to fetch yet.
  useEffect(() => {
    if (authLoading || !userId) return;

    let cancelled = false;
    listAnalyses().then((next) => {
      if (cancelled) return;
      setRecords(next);
      setLoadedFor(userId);
    });

    return () => {
      cancelled = true;
    };
  }, [userId, authLoading, dataVersion]);

  function setFile(f: File | null) {
    setFileState(f);
    if (status !== "loading") {
      setStatus("idle");
      setError("");
    }
  }

  const start = useCallback(
    async (opts?: { force?: boolean }) => {
      const current = file;
      if (!current) return;

      const id = await hashFile(current);

      // Nothing is gated, but persistence needs *a* user — so one is minted
      // here, at the first real action, rather than on every page load.
      await ensureAnonymous();

      // Already analyzed this exact deck — open the saved report instead of
      // spending another few minutes reaching the same answer.
      if (!opts?.force) {
        const existing = await getAnalysis(id);
        if (existing?.status === "done") {
          router.push(`/due-diligence/${id}`);
          return;
        }
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCurrentId(id);
      setStatus("loading");
      setError("");
      dispatch({ type: "reset" });
      router.push(`/due-diligence/${id}`);

      try {
        const body = new FormData();
        body.append("file", current);
        const res = await fetch("/api/analyze", { method: "POST", body, signal: controller.signal });
        if (!res.body) throw new Error("No response stream.");

        let sawReport = false;
        for await (const event of readProgressStream(res.body)) {
          dispatch({ type: "event", event });
          if (event.type === "report") sawReport = true;
          else if (event.type === "error") throw new Error(event.message);
        }

        if (!sawReport) throw new Error("Analysis ended without a result.");
        setStatus("done");

        // The route saved the report as it streamed; just pick up the new row.
        await refreshHistory();
      } catch (e) {
        if (controller.signal.aborted) return; // explicit stop / navigated away
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("error");
        await refreshHistory();
      }
    },
    [file, router, ensureAnonymous, refreshHistory],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setError("");
    setCurrentId(null);
    setFileState(null);
    dispatch({ type: "reset" });
  }, []);

  const deleteRecord = useCallback(
    async (rowId: string) => {
      // Optimistic, then reconciled: a delete that fails puts the row back
      // rather than leaving the list quietly wrong.
      setRecords((prev) => prev.filter((r) => r.rowId !== rowId));
      await deleteAnalysis(rowId);
      await refreshHistory();
    },
    [refreshHistory],
  );

  const clearHistory = useCallback(async () => {
    setRecords(EMPTY_HISTORY);
    await clearAnalyses();
    await refreshHistory();
  }, [refreshHistory]);

  const value: AnalysisContextValue = {
    file,
    setFile,
    status,
    error,
    stream,
    currentId,
    start,
    stop,
    history,
    historyLoading,
    refreshHistory,
    deleteRecord,
    clearHistory,
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
