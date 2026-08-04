"use client";

import { useState } from "react";
import Link from "next/link";
import type { InvestVerdict } from "@/lib/diligence/types";

/**
 * The investment verdict, shown as a banner once the pipeline finishes. The
 * call comes from William's custom model (trained on 800+ reviewed decks). If
 * the model couldn't run (`available: false`) it shows a clear placeholder
 * rather than a fake invest/pass.
 */
export default function VerdictPopup({
  verdict,
  active = false,
}: {
  verdict: InvestVerdict | null;
  active?: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  if (!verdict) {
    if (!active) return null;
    return (
      <div className="fade-up flex items-center gap-4 rounded-3xl border border-ink/15 bg-paper-2/70 px-6 py-5 backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Investment model
          </p>
          <span className="mt-2 inline-block h-4 w-32 animate-pulse rounded bg-ink/10" />
        </div>
      </div>
    );
  }

  const pending = !verdict.available;
  const invest = verdict.invest;
  const pct =
    verdict.probability !== undefined ? Math.round(verdict.probability * 100) : null;

  const tone = pending
    ? "border-ink/15 bg-paper-2/70 text-ink"
    : invest
      ? "border-accent/30 bg-accent/10 text-ink"
      : "border-red-500/25 bg-red-500/[0.06] text-ink";

  return (
    <div className={`fade-up flex items-center gap-4 rounded-3xl border px-6 py-5 backdrop-blur ${tone}`}>
      <div
        className={
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-paper " +
          (pending ? "bg-ink/40" : invest ? "bg-accent" : "bg-red-600")
        }
      >
        {pending ? (
          <span className="text-xl font-bold">?</span>
        ) : invest ? (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="3">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Investment model
        </p>
        <p className="text-lg font-bold">
          {pending ? "Verdict pending" : invest ? "Invest" : "Pass"}
          {pct !== null && (
            <span className="ml-2 align-middle font-mono text-sm font-medium text-muted">
              {pct}% confidence
            </span>
          )}
        </p>
        {pending && verdict.note ? (
          <p className="mt-0.5 text-sm text-muted">{verdict.note}</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            Trained on 800+ pitch decks ·{" "}
            <Link
              href="/playbook"
              className="font-medium text-ink underline decoration-marker decoration-2 underline-offset-2 transition-colors hover:decoration-accent"
            >
              the context database
            </Link>
          </p>
        )}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-full p-1.5 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
