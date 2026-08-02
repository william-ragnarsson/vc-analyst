"use client";

import { useEffect, useRef, useState } from "react";
import { SEVERITY_META } from "@/components/features/form/severityMeta";

/**
 * A fanned hand of the four kinds of thing the engine hands back — one card per
 * category named in the copy beside it, in the same order, so the list and the
 * stack read as the same four ideas.
 *
 * Illustrative content, but every card mirrors a real output surface: deck
 * feedback items, a web-visibility research note, and the invest verdict.
 */

// Small rotations and a shallow overlap: only the card edge tucks under its
// neighbour, never the text. Hover pulls them apart along their own axes.
const CARDS = [
  { key: "deck", tilt: "-rotate-[2.5deg]", x: "-translate-x-3", spread: "group-hover:-translate-x-8 group-hover:-translate-y-2" },
  { key: "visibility", tilt: "rotate-[1.5deg]", x: "translate-x-4", spread: "group-hover:translate-x-8 group-hover:-translate-y-1" },
  { key: "fundability", tilt: "-rotate-[1deg]", x: "-translate-x-1", spread: "group-hover:-translate-x-6 group-hover:translate-y-1" },
  { key: "shortcomings", tilt: "rotate-[2.5deg]", x: "translate-x-3", spread: "group-hover:translate-x-9 group-hover:translate-y-2" },
] as const;

function Shell({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-4 shadow-[0_24px_48px_-24px_rgba(20,19,15,0.45)]">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/35">
        {label}
      </div>
      {children}
    </div>
  );
}

function FeedbackBody({
  severity,
  category,
  title,
  detail,
}: {
  severity: "critical" | "warning";
  category: string;
  title: string;
  detail: string;
}) {
  const meta = SEVERITY_META[severity];
  return (
    <div className="flex items-start gap-2.5">
      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}
          >
            {category}
          </span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink/70">{detail}</p>
      </div>
    </div>
  );
}

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

const BODIES: Record<string, React.ReactNode> = {
  deck: (
    <Shell label="Your pitch deck">
      <FeedbackBody
        severity="warning"
        category="Go-to-market"
        title="GTM is a claim, not a plan"
        detail="Channels are named, but nothing says who you sell to first or how you reach them."
      />
    </Shell>
  ),
  visibility: (
    <Shell label="Internet visibility">
      <ul className="space-y-1.5 text-sm">
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span className="text-ink/80">Both founders discoverable on LinkedIn, backgrounds match the deck.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          <span className="text-ink/80">No press, no funding on record. An investor reads that silence.</span>
        </li>
      </ul>
    </Shell>
  ),
  fundability: (
    <Shell label="Fundability">
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-bold tracking-tight text-accent">Invest</span>
        <span className="font-mono text-sm tabular-nums text-muted">68% confidence</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {[
          ["Team", 4],
          ["Market size", 4],
          ["Competitive advantage", 2],
        ].map(([label, score]) => (
          <div key={label as string} className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted">{label}</span>
            <Stars value={score as number} />
          </div>
        ))}
      </div>
    </Shell>
  ),
  shortcomings: (
    <Shell label="Shortcomings">
      <FeedbackBody
        severity="critical"
        category="Competition"
        title="No competitive landscape"
        detail="An investor will assume you haven't looked. Name the real players and your axis."
      />
    </Shell>
  ),
};

export default function OutputCardStack() {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      // threshold 0 + a bottom inset, rather than a fraction of the element:
      // the stack can be taller than a phone viewport, and a fractional
      // threshold that the element can never satisfy would leave the cards
      // invisible forever.
      { threshold: 0, rootMargin: "0px 0px -12% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    // `-space-y-2` overlaps only the card edges. Anything deeper and a rotated
    // card crops the line of text on the one beneath it.
    <div ref={ref} className="group relative mx-auto -space-y-2 py-2 lg:mx-0 lg:max-w-md">
      {CARDS.map((card, i) => (
        <div
          key={card.key}
          style={{ zIndex: i, transitionDelay: shown ? `${i * 90}ms` : "0ms" }}
          className={
            "relative transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] " +
            (shown
              ? `opacity-100 ${card.tilt} ${card.x} ${card.spread}`
              : "translate-y-6 opacity-0")
          }
        >
          {BODIES[card.key]}
        </div>
      ))}
    </div>
  );
}
