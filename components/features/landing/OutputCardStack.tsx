"use client";

import { useEffect, useRef, useState } from "react";
import { SEVERITY_META } from "@/components/features/form/severityMeta";

/**
 * A fanned hand of feedback, teasing what comes back. Illustrative content, but
 * the card shape and severity colours are the real ones from `DeckFeedbackPanel`,
 * so this can't drift into showing a UI the product doesn't have.
 */

// Small rotations and a shallow overlap: only the card edge tucks under its
// neighbour, never the text. Hover pulls them apart along their own axes.
const CARDS = [
  { key: "strength", tilt: "-rotate-[2.5deg]", x: "-translate-x-3", spread: "group-hover:-translate-x-8 group-hover:-translate-y-2" },
  { key: "deck", tilt: "rotate-[1.5deg]", x: "translate-x-4", spread: "group-hover:translate-x-8 group-hover:-translate-y-1" },
  { key: "visibility", tilt: "-rotate-[1deg]", x: "-translate-x-1", spread: "group-hover:-translate-x-6 group-hover:translate-y-1" },
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
  severity: "critical" | "warning" | "strength";
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

const BODIES: Record<string, React.ReactNode> = {
  strength: (
    <Shell label="What's working">
      <FeedbackBody
        severity="strength"
        category="Traction"
        title="Leads with revenue, not signups"
        detail="Real numbers in the first third of the deck. Keep this slide where it is."
      />
    </Shell>
  ),
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
