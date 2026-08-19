"use client";

import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";

/**
 * The escape hatch for visitors who don't have a deck on them — the single
 * biggest reason a first-time visitor bounces off a page whose only control is
 * "upload a PDF".
 *
 * Deliberately styled as a sticker slapped onto the page rather than a piece of
 * it: lime, tilted, hard-shadowed. As muted text under the run button it read as
 * fine print and disappeared, which is the opposite of what it's for — this is a
 * first-run affordance, and it should look like one. The tilt is the whole
 * trick: nothing else on the site is off-axis, so the eye catches it before it
 * reads a word.
 *
 * Lime on both surfaces, so it needs no tone variant — it's meant to sit apart
 * from whatever it's placed on.
 */
export default function SampleDeckPrompt() {
  const { startSample } = useAnalysis();

  return (
    <button
      type="button"
      onClick={() => startSample(AIRBNB_SAMPLE)}
      title={`Runs ${AIRBNB_SAMPLE.label}`}
      className="-rotate-2 rounded-2xl bg-marker px-6 py-3.5 text-base font-bold text-ink shadow-[0_8px_0_0_var(--ink)] ring-1 ring-ink/20 transition-transform duration-150 hover:-translate-y-0.5 hover:rotate-[-1deg] active:translate-y-1 active:shadow-[0_4px_0_0_var(--ink)]"
    >
      No pitch deck? Use a sample deck!
    </button>
  );
}
