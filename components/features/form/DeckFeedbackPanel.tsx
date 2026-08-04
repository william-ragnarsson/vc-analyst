"use client";

import Card from "@/components/ui/Card";
import { SEVERITY_META, SEVERITY_ORDER } from "@/components/features/form/severityMeta";
import type { DeckFeedbackItem } from "@/lib/diligence/types";

/**
 * A critique of the pitch deck itself — gaps, weaknesses, and strengths,
 * grounded in the playbook and research signals. Sits directly under the
 * verdict banner since it's a headline output, not part of the DD document.
 */

function FeedbackCard({ item }: { item: DeckFeedbackItem }) {
  const meta = SEVERITY_META[item.severity];
  return (
    <div className="cell-pop rounded-xl border border-ink/10 bg-white/50 p-3">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{item.title}</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>
              {item.category}
            </span>
          </div>
          {item.detail && <p className="mt-1 text-sm leading-relaxed text-ink/70">{item.detail}</p>}
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="px-5 pb-4">
      <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
    </div>
  );
}

export default function DeckFeedbackPanel({
  items,
  active = false,
}: {
  items: DeckFeedbackItem[];
  active?: boolean;
}) {
  if (items.length === 0 && !active) return null;

  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    items: items.filter((i) => i.severity === severity),
  })).filter((g) => g.items.length > 0);

  return (
    <Card eyebrow="Deck feedback" className="fade-up">
      {items.length === 0 ? (
        <Skeleton />
      ) : (
        <div className="grid gap-x-6 gap-y-5 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3">
          {grouped.map((g) => (
            <div key={g.severity}>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/40">
                <span className={`h-1.5 w-1.5 rounded-full ${SEVERITY_META[g.severity].dot}`} />
                {SEVERITY_META[g.severity].label}
                <span className="text-ink/30">· {g.items.length}</span>
              </p>
              <div className="space-y-2">
                {g.items.map((item, i) => (
                  <FeedbackCard key={`${g.severity}-${i}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
