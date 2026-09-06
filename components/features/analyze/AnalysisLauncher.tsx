"use client";

import Dropzone from "@/components/ui/Dropzone";
import CurrentAnalysisCard from "@/components/features/analyze/CurrentAnalysisCard";
import SampleDeckPrompt from "@/components/features/analyze/SampleDeckPrompt";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";

type AnalysisLauncherProps = {
  /** `dark` restyles the controls for the hero card's dark surface. */
  tone?: "light" | "dark";
  /** Tighter dropzone, for when it shares a row with other content. */
  compact?: boolean;
  /** `center` centres the run/abort button under the dropzone. */
  align?: "left" | "center";
  /** Opaque, lifted dropzone — see `Dropzone`. Light tone only. */
  elevated?: boolean;
};

const TONES = {
  light: {
    run: "bg-ink text-paper hover:bg-accent disabled:hover:bg-ink",
    abort: "border-ink/15 text-ink/70 hover:bg-ink/5 hover:text-ink",
  },
  dark: {
    run: "bg-accent-bright text-ink hover:bg-white disabled:hover:bg-accent-bright",
    abort: "border-white/20 text-white/70 hover:bg-white/10 hover:text-white",
  },
} as const;

/**
 * The upload + run control pair, plus the sample-deck escape hatch. One analysis
 * runs at a time, so while one is in flight this swaps the dropzone for the live
 * card plus an abort control.
 *
 * The sample sticker is part of this component rather than an opt-in prop: every
 * dropzone on the site is a place where someone can discover they have no PDF to
 * hand, so every dropzone needs the same way out. It was a `sample` flag at
 * first, and it immediately drifted — /due-diligence had it and the closing CTA
 * on the home page didn't, for no reason anyone chose.
 *
 * Rendered in the hero card (dark, compact), the home page's closing CTA (light,
 * elevated) and on /due-diligence (light); it reads everything it needs from the
 * analysis context, so the call sites stay in sync without prop drilling.
 */
export default function AnalysisLauncher({
  tone = "light",
  compact = false,
  align = "left",
  elevated = false,
}: AnalysisLauncherProps) {
  const { file, setFile, status, start, stop } = useAnalysis();
  const t = TONES[tone];
  // Block layout, not flex: the dropzone must stay full-width, and flex children
  // shrink to content under `items-start`. Only the button needs centring.
  const button = align === "center" ? "mx-auto block" : "";

  if (status === "loading") {
    return (
      <div className="space-y-3">
        <CurrentAnalysisCard tone={tone} />
        <button
          onClick={stop}
          className={`rounded-full border px-5 py-2.5 text-sm font-medium transition-colors ${button} ${t.abort}`}
        >
          Abort current analysis
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* The sticker is positioned against the dropzone, not stacked under it:
          overlapping the panel's corner — and, from lg up, jutting past its
          right edge — is what makes it read as stuck on top of the UI rather
          than as part of it. Needs the wrapper because Dropzone's own
          `relative` box is where its dashed-border SVG lives.

          The overhang is gated at lg on purpose. This page is `max-w-3xl px-6`,
          so below 48rem the container is full-width and the only gutter is that
          24px of padding — hanging out there would cross the viewport edge and
          give the whole page a horizontal scrollbar. At lg the container is
          capped and centred, leaving ~128px a side for the sticker to sit in. */}
      <div className="relative">
        <Dropzone file={file} onFile={setFile} tone={tone} compact={compact} elevated={elevated} />
        <div className="absolute -top-4 right-2 z-10 sm:-top-5 lg:-right-8">
          <SampleDeckPrompt />
        </div>
      </div>
      {/* Only once there's something to run. Idle, the panel is just the
          dropzone and the sample sticker — a permanently-disabled button next
          to a live green one read as clutter, and as two competing offers.
          It can't go away entirely: the sticker runs the sample deck, this runs
          the file you actually uploaded. */}
      {file && (
        <button
          onClick={() => start()}
          className={`rounded-full px-8 py-3.5 font-semibold transition-colors ${button} ${t.run}`}
        >
          Run due diligence →
        </button>
      )}
    </div>
  );
}
