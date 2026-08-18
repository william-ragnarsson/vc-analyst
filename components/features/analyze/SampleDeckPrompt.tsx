"use client";

import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { AIRBNB_SAMPLE } from "@/lib/samples/airbnb";

type SampleDeckPromptProps = {
  /** `dark` restyles for the hero card's dark surface. */
  tone?: "light" | "dark";
};

const TONES = {
  light: {
    text: "text-muted",
    action: "text-ink hover:text-accent",
    quiet: "text-muted/70 hover:text-muted",
  },
  dark: {
    text: "text-white/55",
    action: "text-white hover:text-marker",
    quiet: "text-white/35 hover:text-white/60",
  },
} as const;

/**
 * The escape hatch for visitors who don't have a deck on them — the single
 * biggest reason a first-time visitor bounces off a page whose only control is
 * "upload a PDF".
 *
 * It's deliberately the one informal, hand-drawn mark on the page: the arrow and
 * the lime underline let it stand out by texture rather than by size, so it can
 * sit inside the hero without competing with the headline it's meant to serve.
 */
export default function SampleDeckPrompt({ tone = "light" }: SampleDeckPromptProps) {
  const { startSample } = useAnalysis();
  const t = TONES[tone];

  return (
    <div className={`flex items-start gap-2.5 text-sm ${t.text}`}>
      {/* Curves up and to the left, back toward the run button. Rotated on the
          wrapper rather than in the path so the stroke-dash draw stays even. */}
      <svg
        aria-hidden
        viewBox="0 0 44 34"
        className="arrow-draw mt-0.5 h-[26px] w-[34px] shrink-0 -rotate-6 text-marker"
        fill="none"
      >
        <path
          d="M42 32C36 26 28 20 19 15 13.5 11.9 8 9.5 3 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M3 8L11 6M3 8L6 15.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <p className="pt-1">
        No deck on you?{" "}
        <button
          type="button"
          onClick={() => startSample(AIRBNB_SAMPLE)}
          className={`font-semibold underline decoration-marker/60 decoration-2 underline-offset-4 transition-colors hover:decoration-marker ${t.action}`}
        >
          Run {AIRBNB_SAMPLE.label} →
        </button>{" "}
        <a
          href={AIRBNB_SAMPLE.pdfPath}
          target="_blank"
          rel="noopener noreferrer"
          className={`whitespace-nowrap transition-colors ${t.quiet}`}
        >
          view the PDF ↗
        </a>
      </p>
    </div>
  );
}
