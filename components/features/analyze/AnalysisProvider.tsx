"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { initialState, streamReducer, type AnalysisState } from "./streamState";
import { readProgressStream } from "@/lib/diligence/stream";
import {
  clearHistory as clearHistoryStorage,
  deleteRecord as deleteRecordStorage,
  getRecord,
  hashFile,
  loadHistory,
  saveRecord,
  subscribeHistory,
  type AnalysisRecord,
} from "@/lib/diligence/history";
import type { SampleDeck } from "@/lib/samples/airbnb";

const EMPTY_HISTORY: AnalysisRecord[] = [];

type Status = "idle" | "loading" | "done" | "error";

interface AnalysisContextValue {
  file: File | null;
  setFile: (file: File | null) => void;
  status: Status;
  error: string;
  stream: AnalysisState;
  /** Hash id of the run currently in the provider (running or just-finished); null when idle. */
  currentId: string | null;
  /** Start analysis for the current file. Re-viewing a cached deck routes to its report instead. */
  start: (opts?: { force?: boolean }) => void;
  /** Start analysis for a built-in sample deck — no upload, no file needed. */
  startSample: (sample: SampleDeck, opts?: { force?: boolean }) => void;
  /** Aborts an in-flight run (if any) and clears back to the dropzone state. */
  stop: () => void;
  history: AnalysisRecord[];
  deleteRecord: (id: string) => void;
  clearHistory: () => void;
}

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export function useAnalysis(): AnalysisContextValue {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within an AnalysisProvider");
  return ctx;
}

export default function AnalysisProvider({ children }: { children: ReactNode }) {
  const [file, setFileState] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [currentId, setCurrentId] = useState<string | null>(null);
  const history = useSyncExternalStore(subscribeHistory, loadHistory, () => EMPTY_HISTORY);
  const [stream, dispatch] = useReducer(streamReducer, undefined, initialState);
  const abortRef = useRef<AbortController | null>(null);
  const router = useRouter();

  function setFile(f: File | null) {
    setFileState(f);
    if (status !== "loading") {
      setStatus("idle");
      setError("");
    }
  }

  /**
   * The one analysis path, shared by uploads and sample decks. They differ only
   * in how the id is derived (file hash vs. the sample's fixed id), what goes in
   * the request body, and the name to fall back on if the engine doesn't name
   * the company — everything after that is identical.
   */
  const run = useCallback(
    async ({
      id,
      fallbackName,
      body,
      force,
    }: {
      id: string;
      fallbackName: string;
      body: FormData;
      force?: boolean;
    }) => {
      // Already analyzed this exact deck — open the saved report instead of re-running.
      if (!force && getRecord(id)) {
        router.push(`/due-diligence/${id}`);
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setCurrentId(id);
      setStatus("loading");
      setError("");
      dispatch({ type: "reset" });
      router.push(`/due-diligence/${id}`);

      let working = initialState();

      try {
        const res = await fetch("/api/analyze", { method: "POST", body, signal: controller.signal });
        if (!res.body) throw new Error("No response stream.");

        let sawReport = false;
        for await (const event of readProgressStream(res.body)) {
          working = streamReducer(working, { type: "event", event });
          dispatch({ type: "event", event });
          if (event.type === "report") sawReport = true;
          else if (event.type === "error") throw new Error(event.message);
        }

        if (!sawReport) throw new Error("Analysis ended without a result.");
        setStatus("done");

        saveRecord({
          id,
          name: working.form.company.name.value || fallbackName,
          generatedAt: working.form.generatedAt || new Date().toISOString(),
          state: working,
        });
      } catch (e) {
        if (controller.signal.aborted) return; // explicit stop / navigated away
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("error");
      }
    },
    [router],
  );

  const start = useCallback(
    async (opts?: { force?: boolean }) => {
      const current = file;
      if (!current) return;

      const body = new FormData();
      body.append("file", current);

      await run({
        id: await hashFile(current),
        fallbackName: current.name,
        body,
        force: opts?.force,
      });
    },
    [file, run],
  );

  /**
   * Runs one of the built-in sample decks. Its id is a fixed string rather than
   * a file hash, so a visitor who already ran the sample lands straight on their
   * saved report — the same dedupe uploads get, for free.
   */
  const startSample = useCallback(
    async (sample: SampleDeck, opts?: { force?: boolean }) => {
      const body = new FormData();
      body.append("sample", sample.id);

      await run({ id: sample.id, fallbackName: sample.label, body, force: opts?.force });
    },
    [run],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    setError("");
    setCurrentId(null);
    setFileState(null);
    dispatch({ type: "reset" });
  }, []);

  const deleteRecord = useCallback((id: string) => {
    deleteRecordStorage(id);
  }, []);

  const clearHistory = useCallback(() => {
    clearHistoryStorage();
  }, []);

  const value: AnalysisContextValue = {
    file,
    setFile,
    status,
    error,
    stream,
    currentId,
    start,
    startSample,
    stop,
    history,
    deleteRecord,
    clearHistory,
  };

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}
