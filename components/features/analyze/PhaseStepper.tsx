"use client";

import type { Step } from "@/lib/diligence/stream-state";
import { formatElapsed, useElapsed } from "./elapsed";

function StepDot({ status }: { status: Step["status"] }) {
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-paper">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute inline-flex h-5 w-5 animate-ping rounded-full bg-accent/40" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
      </span>
    );
  }
  return <span className="h-5 w-5 rounded-full border-2 border-ink/20" />;
}

/** The pipeline phase stepper + live elapsed timer (pinned in the analysis header). */
export default function PhaseStepper({
  steps,
  startedAt,
  active,
}: {
  steps: Step[];
  startedAt: number | null;
  active: boolean;
}) {
  const elapsed = useElapsed(startedAt, active);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {steps.map((step, i) => (
        <div key={step.phase} className="flex items-center gap-2">
          <StepDot status={step.status} />
          <span
            className={
              "text-sm " +
              (step.status === "pending"
                ? "text-ink/35"
                : step.status === "active"
                  ? "font-semibold text-ink"
                  : "text-ink/70")
            }
          >
            {step.label}
          </span>
          {i < steps.length - 1 && <span className="text-ink/20">›</span>}
        </div>
      ))}
      <span className="ml-auto font-mono text-xs tabular-nums text-muted">{formatElapsed(elapsed)}</span>
    </div>
  );
}
