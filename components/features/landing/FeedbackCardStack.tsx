import { SEVERITY_META } from "@/components/features/form/severityMeta";
import type { DeckFeedbackItem } from "@/lib/diligence/types";

/**
 * Three feedback items dealt like a hand of cards. Illustrative content, but the
 * card shape and severity colours are the real ones from `DeckFeedbackPanel`, so
 * this can't drift into showing a UI the product doesn't have.
 */
const ITEMS: DeckFeedbackItem[] = [
  {
    severity: "critical",
    category: "Competition",
    title: "No competitive landscape",
    detail: "An investor will assume you haven't looked. Name the real players and your axis.",
  },
  {
    severity: "warning",
    category: "Go-to-market",
    title: "GTM is a claim, not a plan",
    detail: "Channels are named, but nothing says who you sell to first or how you reach them.",
  },
  {
    severity: "strength",
    category: "Traction",
    title: "Traction leads with revenue",
    detail: "Real numbers up front, not signups. Keep this slide where it is.",
  },
];

// Rotation, offset, and rest/hover spread per card. Hovering fans them apart
// instead of animating on load, so the section is calm until you engage with it.
const LAYOUT = [
  { base: "-rotate-[5deg] -translate-x-4", hover: "group-hover:-translate-x-10 group-hover:-rotate-[7deg]" },
  { base: "rotate-[2deg] translate-x-3", hover: "group-hover:translate-x-5" },
  { base: "-rotate-[1deg] translate-x-1", hover: "group-hover:translate-x-2 group-hover:translate-y-2" },
];

export default function FeedbackCardStack() {
  return (
    <div className="group relative -space-y-6 py-4 [perspective:1000px]">
      {ITEMS.map((item, i) => {
        const meta = SEVERITY_META[item.severity];
        const layout = LAYOUT[i];
        return (
          <div
            key={item.title}
            style={{ zIndex: i }}
            className={`relative rounded-2xl border border-ink/10 bg-white/85 p-4 shadow-[0_18px_36px_-20px_rgba(20,19,15,0.5)] backdrop-blur transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${layout.base} ${layout.hover}`}
          >
            <div className="flex items-start gap-2.5">
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
          </div>
        );
      })}
    </div>
  );
}
