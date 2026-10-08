"use client";

import Card from "@/components/ui/Card";
import type { DueDiligenceForm } from "@/lib/diligence/types";

/**
 * The "behind the scenes" scorecard: the model's own rating of the 6 metrics
 * (1–5) plus funding already raised. These are the inputs to the trained invest
 * model — not part of the due-diligence document a VC would hand over, but
 * useful to watch fill in live. Sources are shown once, in the research card.
 */

const METRICS: { key: Exclude<keyof DueDiligenceForm["scorecard"], "funding">; label: string }[] = [
  { key: "team", label: "Team" },
  { key: "technology", label: "Technology" },
  { key: "marketSize", label: "Market Size" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "competitiveAdvantage", label: "Competitive Advantage" },
  { key: "socialImpact", label: "Social Impact" },
];

function Stars({ value, active }: { value: number; active: boolean }) {
  if (value <= 0) {
    return active ? (
      <span className="inline-block h-3 w-20 animate-pulse rounded bg-ink/10" />
    ) : (
      <span className="text-ink/30">-</span>
    );
  }
  return (
    <span key={value} className="cell-pop inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill={n <= value ? "var(--accent)" : "none"}
          stroke={n <= value ? "var(--accent)" : "currentColor"}
          strokeWidth="1.5"
        >
          <path
            className={n <= value ? "" : "text-ink/25"}
            d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.06 1.1-6.47L2.6 9.9l6.5-.95L12 2.5z"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}

export default function ScorecardPanel({
  form,
  active = false,
  legacyFunding = false,
}: {
  form: DueDiligenceForm;
  active?: boolean;
  /** A report saved before funding was US dollars with 0 = nothing raised: show it as it was. */
  legacyFunding?: boolean;
}) {
  const { scorecard } = form;
  return (
    <Card eyebrow="Scorecard">
      <div className="grid gap-x-8 gap-y-1 px-5 pb-4 sm:grid-cols-2 lg:grid-cols-3">
        {METRICS.map((m) => (
          <div key={m.key} className="flex items-center justify-between gap-3 border-b border-ink/[0.06] py-2">
            <span className="text-sm text-ink/70">{m.label}</span>
            <Stars value={scorecard[m.key]} active={active} />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-b border-ink/[0.06] py-2">
          <span className="text-sm text-ink/70">Funding raised</span>
          {/* 0 (confirmed nothing raised) and null (unknown) reach the model as
              different inputs, so they read differently here too. */}
          {scorecard.funding !== null && scorecard.funding > 0 ? (
            <span key={scorecard.funding} className="cell-pop font-mono text-sm tabular-nums text-ink">
              {legacyFunding ? scorecard.funding.toLocaleString() : `$${scorecard.funding.toLocaleString("en-US")}`}
            </span>
          ) : scorecard.funding === 0 && !legacyFunding ? (
            <span className="cell-pop text-sm text-ink/70">None yet</span>
          ) : active ? (
            <span className="inline-block h-3 w-20 animate-pulse rounded bg-ink/10" />
          ) : (
            <span className="text-ink/30">-</span>
          )}
        </div>
      </div>
    </Card>
  );
}
