import MemoFillDemo from "@/components/features/landing/MemoFillDemo";
import SectionHeading from "@/components/features/landing/SectionHeading";
import { SEVERITY_META } from "@/components/features/form/severityMeta";
import type { DeckFeedbackItem } from "@/lib/diligence/types";

/**
 * The payoff: the report itself, at size.
 *
 * This is the one framed artifact on the page below the hero. The frame is
 * legitimate because it's the *product* — a document with its own chrome — not
 * a container wrapped around a section.
 */
// Deliberately different items from the teaser stack in §01 — the same company,
// but repeating the same two findings one section later reads as filler.
const FEEDBACK: DeckFeedbackItem[] = [
  {
    severity: "critical",
    category: "Market",
    title: "Market sizing is top-down only",
    detail: "TAM is a percentage of a big number. There's no bottom-up build from customers and price.",
  },
  {
    severity: "warning",
    category: "The ask",
    title: "Use of funds isn't stated",
    detail: "The round size is there. What the 18 months of runway actually buys isn't.",
  },
  {
    severity: "strength",
    category: "Problem",
    title: "Problem is specific and named",
    detail: "You name the customer and the pain in one line. Most decks take three slides.",
  },
];

const SCORES: [string, number][] = [
  ["Team", 4],
  ["Market size", 4],
  ["Competitive advantage", 2],
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

export default function ReportShowcase() {
  return (
    <section className="fade-up">
      <SectionHeading
        align="center"
        title="The write-up they'd never send you."
        sub="A verdict with a probability behind it, a worksheet where every answer says where it came from, and a straight critique of the deck itself."
      />

      <div className="mt-14 overflow-hidden rounded-3xl border border-ink/12 bg-paper shadow-[0_40px_80px_-40px_rgba(20,19,15,0.45)]">
        {/* Chrome, matching the hero mock so the two read as the same document. */}
        <div className="flex items-center gap-2 border-b border-ink/10 bg-paper-2/60 px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
          <span className="ml-2 font-mono text-xs text-muted">due-diligence · acme.pdf</span>
        </div>

        {/* Verdict strip */}
        <div className="flex flex-wrap items-center justify-between gap-x-10 gap-y-4 border-b border-ink/10 px-5 py-4 sm:px-6">
          <div className="flex items-baseline gap-3">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-paper">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3.5">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-2xl font-bold tracking-tight text-accent">Invest</span>
            <span className="font-mono text-sm tabular-nums text-muted">68% confidence</span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            {SCORES.map(([label, score]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-xs text-muted">{label}</span>
                <Stars value={score} />
              </div>
            ))}
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="border-b border-ink/10 lg:border-b-0 lg:border-r">
            <div className="px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/40 sm:px-6">
              The worksheet
            </div>
            <MemoFillDemo framed={false} />
          </div>

          <div className="px-5 py-4 sm:px-6">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/40">
              Deck feedback
            </div>
            <div className="space-y-3">
              {FEEDBACK.map((item) => {
                const meta = SEVERITY_META[item.severity];
                return (
                  <div key={item.title} className="flex items-start gap-2.5">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{item.title}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
                        >
                          {item.category}
                        </span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-ink/70">{item.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
