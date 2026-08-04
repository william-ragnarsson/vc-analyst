import Hero from "@/components/features/hero/Hero";
import PitchPerspective from "@/components/features/landing/PitchPerspective";
import InvestModel from "@/components/features/landing/InvestModel";
import ClosingCta from "@/components/features/landing/ClosingCta";

/**
 * Layout rule for this page — bands, not boxes:
 *
 * Below the hero there are NO section containers. Sections are separated by
 * full-bleed tonal bands, hairline rules, and genuinely different layout shapes
 * (2-col asymmetric / horizontal schematic / centred column).
 *
 * A *product artifact* — the feedback cards in §01 — may still be framed: that
 * is content, not section chrome. Wrapping a section itself in a card is what
 * made this page incoherent before; don't reintroduce it.
 *
 * Widths: the hero is full-bleed, everything else is max-w-6xl. Text blocks cap
 * themselves internally rather than by changing the container.
 */
export default function Home() {
  return (
    <div>
      {/* The hero is the only card on the page. */}
      <div className="p-3 sm:p-6">
        <Hero />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-32 sm:py-44">
        <PitchPerspective />
      </div>

      {/* Both this and the section above sit on paper, so a hairline keeps them
          from reading as one long block. */}
      <div className="mx-auto max-w-6xl border-t border-ink/8 px-6 py-24 sm:py-32">
        <InvestModel />
      </div>

      {/* The one band on the page, and it closes it. `border-t` only — a bottom
          rule would float above the footer. */}
      <div className="w-full border-t border-ink/8 bg-paper-2/60">
        {/* Asymmetric: the run button and the assurances under it are light,
            low elements, so an equal bottom padding leaves a visible void
            before the footer rule. */}
        <div className="mx-auto max-w-6xl px-6 pb-24 pt-32 sm:pb-28 sm:pt-40">
          <ClosingCta />
        </div>
      </div>
    </div>
  );
}
