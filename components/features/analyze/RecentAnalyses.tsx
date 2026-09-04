"use client";

import Link from "next/link";
import { useAnalysis } from "./AnalysisProvider";
import { useAuth } from "@/components/features/auth/AuthProvider";

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Every analysis on the account — click to reopen instantly, no re-run. */
export default function RecentAnalyses() {
  const { history, historyLoading, deleteRecord, clearHistory } = useAnalysis();
  const { user, loading: authLoading, configured } = useAuth();

  // Before anyone has run anything there is no user and nothing to say.
  if (!configured || authLoading || (!user && !historyLoading)) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Your analyses
        </span>
        {history.length > 0 && (
          <button
            onClick={() => void clearHistory()}
            className="text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            Clear all
          </button>
        )}
      </div>

      {historyLoading && history.length === 0 ? (
        <p className="rounded-2xl border border-ink/10 bg-white/55 px-5 py-4 text-sm text-muted backdrop-blur">
          Loading…
        </p>
      ) : history.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/15 px-5 py-4 text-sm text-muted">
          Nothing here yet. Run a deck above and it’ll be waiting for you next time.
        </p>
      ) : (
        <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white/55 backdrop-blur">
          {history.map((record) => (
            <li key={record.rowId} className="group flex items-center">
              <Link
                href={`/due-diligence/${record.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-white/80"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-ink">
                    {record.name || "Untitled deck"}
                  </span>
                  {record.status !== "done" && (
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (record.status === "running"
                          ? "bg-accent/10 text-accent"
                          : "bg-red-500/10 text-red-700")
                      }
                    >
                      {record.status === "running" ? "unfinished" : "failed"}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-sm text-muted">
                  {relativeTime(record.generatedAt)}
                </span>
              </Link>
              <button
                onClick={() => void deleteRecord(record.rowId)}
                aria-label={`Delete ${record.name || "analysis"}`}
                title="Delete"
                className="mr-2 shrink-0 rounded-lg p-2 text-muted/60 transition-colors hover:bg-red-500/10 hover:text-red-600"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2m2 0v14a1 1 0 01-1 1H6a1 1 0 01-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
