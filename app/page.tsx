import Hero from "@/components/features/hero/Hero";
import PitchPerspective from "@/components/features/landing/PitchPerspective";
import ReportShowcase from "@/components/features/landing/ReportShowcase";
import HowItWorks from "@/components/features/landing/HowItWorks";
import ClosingCta from "@/components/features/landing/ClosingCta";

/**
 * Layout rule for this page — bands, not boxes:
 *
 * Below the hero there are NO section containers. Sections are separated by
 * full-bleed tonal bands, hairline rules, and genuinely different layout shapes
 * (2-col asymmetric / centred + wide artifact / 4-up row / centred column).
 *
 * A *product artifact* — the report in §02, the cards in §01 — may still be
 * framed: that is content, not section chrome. Wrapping a section itself in a
 * card is what made this page incoherent before; don't reintroduce it.
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

      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <PitchPerspective />
      </div>

      {/* Full-bleed band: the stage for the payoff. Translucent so the backdrop
          dots still read faintly through it. */}
      <div className="w-full border-y border-ink/8 bg-paper-2/60">
        <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
          <ReportShowcase />
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <HowItWorks />
      </div>

      <div className="mx-auto max-w-6xl px-6 pb-24 sm:pb-28">
        <ClosingCta />
      </div>
    </div>
  );
}
