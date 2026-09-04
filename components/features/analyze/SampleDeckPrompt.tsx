"use client";

import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";

/**
 * The escape hatch for visitors who don't have a deck on them — the single
 * biggest reason a first-time visitor bounces off a page whose only control is
 * "upload a PDF".
 *
 * Styled as a sticker slapped onto the dropzone rather than a piece of the page:
 * tilted, hard-shadowed, and pinned over the panel's top-right corner by its
 * call site. As muted text under the run button it read as fine print and
 * disappeared, which is the opposite of what it's for. The tilt is the whole
 * trick — nothing else here is off-axis, so the eye catches it before it reads a
 * word, and overlapping the corner says "stuck on afterwards, for you, first
 * time round" in a way no amount of copy would.
 *
 * It leans the opposite way to the panel it sits on and needs no tone variant:
 * the point is to sit apart from whatever is underneath. Hover only scales it —
 * straightening the tilt on hover undid the sticker read at exactly the moment
 * someone was looking at it. The press state sinks it into its own hard shadow,
 * which signals "clickable" without touching the angle.
 */
export default function SampleDeckPrompt() {
  const { startSample } = useAnalysis();

  return (
    <button
      type="button"
      onClick={() => startSample(AIRBNB_SAMPLE)}
      title={`Runs ${AIRBNB_SAMPLE.label}`}
      className="rotate-2 whitespace-nowrap rounded-xl bg-accent-bright px-4 py-2.5 text-xs font-bold text-ink shadow-[0_5px_0_0_var(--ink)] ring-1 ring-ink/20 transition-transform duration-150 hover:scale-105 active:translate-y-0.5 active:shadow-[0_3px_0_0_var(--ink)] sm:px-5 sm:py-3 sm:text-sm"
    >
      No pitch deck? Use a sample deck!
    </button>
  );
}
