"use client";

import Link from "next/link";
import { useAnalysis } from "./AnalysisProvider";

type CurrentAnalysisCardProps = {
  /** `dark` restyles the card for the hero card's dark surface. */
  tone?: "light" | "dark";
};

const TONES = {
  light: {
    // Opaque, like the elevated dropzone: a translucent panel lets the page's
    // dot grid show through and reads as unfinished.
    card: "border-ink/10 bg-[#fbf9f3] shadow-[0_1px_2px_rgba(20,19,15,0.04),0_24px_48px_-28px_rgba(20,19,15,0.35)] hover:border-ink/20",
    name: "text-ink",
    label: "text-ink/80",
    count: "text-muted",
    track: "bg-ink/[0.07]",
    fill: "bg-accent",
    view: "bg-ink text-paper group-hover:bg-accent",
    abort: "text-muted hover:bg-ink/5 hover:text-ink",
    divider: "border-ink/[0.07]",
  },
  dark: {
    card: "border-white/12 bg-white/[0.05] hover:border-white/20 hover:bg-white/[0.07]",
    name: "text-white",
    label: "text-white/80",
    count: "text-white/50",
    track: "bg-white/10",
    fill: "bg-accent-bright",
    view: "bg-accent-bright text-ink group-hover:bg-white",
    abort: "text-white/55 hover:bg-white/10 hover:text-white",
    divider: "border-white/10",
  },
} as const;

/**
 * The analysis currently in flight, shown in place of the dropzone while a run
 * is active: what's being analysed, which step it's on, a segmented progress
 * bar, and the two things you can do about it — open the live report or abort.
 *
 * The whole card links to the report (a stretched link), with the abort button
 * raised above it so it stays independently clickable without nesting a button
 * inside an anchor.
 */
export default function CurrentAnalysisCard({ tone = "light" }: CurrentAnalysisCardProps) {
  const { stream, currentId, file, stop } = useAnalysis();
  if (!currentId) return null;

  const t = TONES[tone];
  const { steps } = stream;
  const activeIndex = steps.findIndex((s) => s.status === "active");
  const activeLabel = activeIndex === -1 ? "Working" : steps[activeIndex].label;
  // 1-indexed "current step" (not a count of completed steps) — so progress
  // reads 1/5 → 5/5 rather than 0/5 → 4/5. No step is "active" once every
  // step is done, so that terminal state is the last step number.
  const currentStep = activeIndex === -1 ? steps.length : activeIndex + 1;
  const name = stream.form.company.name.value || file?.name || "Analyzing deck";

  return (
    <div className={`group relative rounded-2xl border text-left transition-colors ${t.card}`}>
      <div className="flex items-center gap-3 px-4 pb-4 pt-5 sm:gap-4 sm:px-5">
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-bright opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-bright" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`truncate font-semibold tracking-tight ${t.name}`}>{name}</p>
          <p className="mt-0.5 flex items-baseline gap-2 whitespace-nowrap text-sm">
            <span className={`truncate ${t.label}`}>{activeLabel}…</span>
            <span className={`shrink-0 tabular-nums ${t.count}`}>
              {currentStep}/{steps.length}
            </span>
          </p>
        </div>
        <Link
          href={`/due-diligence/${currentId}`}
          className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors after:absolute after:inset-0 after:rounded-2xl ${t.view}`}
        >
          View<span className="hidden sm:inline"> report</span>{" "}
          <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </div>

      <div className="flex gap-1.5 px-4 sm:px-5" aria-hidden>
        {steps.map((step) => (
          <span key={step.phase} className={`relative h-1 flex-1 overflow-hidden rounded-full ${t.track}`}>
            {step.status === "done" && <span className={`absolute inset-0 ${t.fill}`} />}
            {step.status === "active" && <span className={`step-active absolute inset-0 ${t.fill}`} />}
          </span>
        ))}
      </div>

      <div className={`mt-4 flex items-center justify-between gap-3 border-t py-2 pl-4 pr-2 sm:pl-5 sm:pr-3 ${t.divider}`}>
        <span className={`truncate text-xs ${t.count}`}>Runs in the background</span>
        <button
          type="button"
          onClick={stop}
          className={`relative z-10 shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${t.abort}`}
        >
          Abort analysis
        </button>
      </div>
    </div>
  );
}
