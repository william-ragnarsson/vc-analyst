"use client";

import { useState } from "react";
import Link from "next/link";
import type { InvestVerdict } from "@/lib/diligence/types";

/**
 * Score and gate on a 0–100 scale, with just enough decimals that a pass never
 * prints as "score 41 · gate 41". Rounding never reverses order, so two
 * different strings always compare the same way the raw numbers do.
 */
function formatGauge(score: number, gate: number): { score: string; gate: string } {
  for (let digits = 0; digits < 3; digits++) {
    const s = (score * 100).toFixed(digits);
    const g = (gate * 100).toFixed(digits);
    if (s !== g || score === gate) return { score: s, gate: g };
  }
  return { score: (score * 100).toFixed(3), gate: (gate * 100).toFixed(3) };
}

/**
 * How close to the gate (on the 0–1 score) counts as borderline. On decks held
 * out from training, William invested in a third to a half of those this close
 * on either side, against under a tenth far below and three quarters far
 * above. See "out_of_fold_by_distance_from_gate" in lib/invest/model-card.json.
 */
const BORDERLINE = 0.05;

/**
 * The investment verdict, shown as a banner once the pipeline finishes. The
 * call comes from William's custom model (trained on 765 of 800+ reviewed
 * decks): a 0–1 score and the acceptance gate it had to clear, drawn as a
 * meter so a near miss reads differently from a clear pass. If the model
 * couldn't run (`available: false`) it shows a clear placeholder rather than
 * a fake invest/pass.
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
  const gauge =
    verdict.score !== undefined && verdict.threshold !== undefined
      ? {
          label: formatGauge(verdict.score, verdict.threshold),
          score: Math.min(100, Math.max(0, verdict.score * 100)),
          gate: Math.min(100, Math.max(0, verdict.threshold * 100)),
        }
      : null;
  const borderline =
    !pending &&
    verdict.score !== undefined &&
    verdict.threshold !== undefined &&
    Math.abs(verdict.score - verdict.threshold) < BORDERLINE;
  // Reports saved before the regression model only carry a probability.
  const legacyPct =
    !gauge && verdict.probability !== undefined ? Math.round(verdict.probability * 100) : null;

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
          {gauge && !pending && (
            <span className="ml-2 align-middle font-mono text-sm font-medium text-muted">
              score {gauge.label.score} · gate {gauge.label.gate}
            </span>
          )}
          {legacyPct !== null && (
            <span className="ml-2 align-middle font-mono text-sm font-medium text-muted">
              {legacyPct}% confidence
            </span>
          )}
        </p>
        {gauge && !pending && (
          <div
            role="meter"
            aria-label="Model score against the acceptance gate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={gauge.score}
            aria-valuetext={`Score ${gauge.label.score} out of 100; invest at ${gauge.label.gate} or above`}
            className="relative mt-2 h-1.5 w-full max-w-xs rounded-full bg-ink/10"
          >
            <div
              className={`h-full rounded-full ${invest ? "bg-accent" : "bg-red-600/70"}`}
              style={{ width: `${gauge.score}%` }}
            />
            {/* The gate: everything at or right of this tick is an invest. */}
            <div
              className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-ink"
              style={{ left: `${gauge.gate}%` }}
            />
          </div>
        )}
        {borderline && (
          <p className="mt-1.5 text-sm text-ink/80">
            Borderline: past decks scored this close to the gate went either way.
          </p>
        )}
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
