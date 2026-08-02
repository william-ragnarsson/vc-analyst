import { Row, SourceBadge } from "@/components/features/form/DueDiligenceFormView";
import type { FieldSource } from "@/lib/diligence/types";

const ROWS: { label: string; value: string; source: FieldSource }[] = [
  { label: "Company", value: "B2B checkout infra for marketplaces", source: "deck" },
  { label: "Founders", value: "2 technical, ex-Adyen and ex-Shopify", source: "deck" },
  {
    label: "Competitive Landscape",
    value: "Also positions against Stripe Connect and Adyen for Platforms",
    source: "web",
  },
  {
    label: "Defensibility",
    value: "Data moat is thin — a competitor could replicate the core flow in ~2 months",
    source: "inferred",
  },
];

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 ${n <= value ? "text-accent" : "text-ink/20"}`}
          fill={n <= value ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path
            d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.06 1.1-6.47L2.6 9.9l6.5-.95L12 2.5z"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

/**
 * Decorative preview of a finished memo, floating on the hero card. It reuses the
 * real report's `Row`/`SourceBadge` so what a founder sees above the fold is
 * literally the document they get — but with hard-coded content, since the live
 * view needs a real DueDiligenceForm. Purely presentational and hidden from
 * assistive tech; the surrounding copy carries the meaning.
 */
export default function HeroReportMock() {
  return (
    <div aria-hidden className="relative hidden lg:block">
      {/* Glow behind the panel, so it reads as lifted off the dark card. */}
      <div className="pointer-events-none absolute inset-8 rounded-full bg-accent-bright/20 blur-3xl" />

      <div className="hero-float relative">
        <div className="w-[600px] translate-x-10 rotate-[-3deg] overflow-hidden rounded-2xl border border-white/15 bg-paper shadow-[0_40px_70px_-20px_rgba(0,0,0,0.55)] xl:w-[680px]">
          <div className="flex items-center gap-2 border-b border-ink/10 bg-paper-2/60 px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="h-2 w-2 rounded-full bg-ink/15" />
            <span className="ml-2 font-mono text-xs text-muted">due-diligence · acme.pdf</span>
          </div>

          {ROWS.map((row) => (
            <Row key={row.label} label={row.label}>
              <span className="text-ink/90">{row.value}</span>
              <SourceBadge source={row.source} />
            </Row>
          ))}
        </div>

        {/* Scorecard chip overlapping the corner — the same depth trick the
            reference sites use to stop the panel reading as a flat screenshot. */}
        <div className="absolute -bottom-10 -left-12 rotate-[-3deg] rounded-2xl border border-ink/10 bg-white px-4 py-3 shadow-[0_20px_40px_-12px_rgba(0,0,0,0.45)]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
            Team credibility
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Stars value={4} />
            <span className="font-mono text-sm font-semibold tabular-nums text-ink">4.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
