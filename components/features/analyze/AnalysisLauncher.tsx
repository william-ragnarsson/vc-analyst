"use client";

import Dropzone from "@/components/ui/Dropzone";
import CurrentAnalysisCard from "@/components/features/analyze/CurrentAnalysisCard";
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
 * The upload + run control pair. One analysis runs at a time, so while one is in
 * flight this swaps the dropzone for the live card plus an abort control.
 *
 * Rendered both inside the hero card (dark) and on /due-diligence (light); it
 * reads everything it needs from the analysis context, so the two call sites
 * stay in sync without prop drilling.
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
        <CurrentAnalysisCard />
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
      <Dropzone file={file} onFile={setFile} tone={tone} compact={compact} elevated={elevated} />
      <button
        onClick={() => start()}
        disabled={!file}
        className={`rounded-full px-8 py-3.5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-25 ${button} ${t.run}`}
      >
        Run due diligence →
      </button>
    </div>
  );
}
