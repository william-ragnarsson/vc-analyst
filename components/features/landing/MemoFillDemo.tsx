"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Row, SourceBadge } from "@/components/features/form/DueDiligenceFormView";
import type { FieldSource } from "@/lib/diligence/types";

const ROWS: { label: string; value: string; source: FieldSource }[] = [
  { label: "Company", value: "B2B checkout infra for marketplaces", source: "deck" },
  { label: "Founders", value: "2 technical, ex-Adyen and ex-Shopify", source: "deck" },
  { label: "Founded", value: "2024, Amsterdam", source: "web" },
  {
    label: "Competitive Landscape",
    value: "Also positions against Stripe Connect and Adyen for Platforms",
    source: "web",
  },
  {
    label: "Defensibility",
    value: "Data moat is thin, a competitor could replicate the core flow in ~2 months",
    source: "inferred",
  },
];

const STAGGER_MS = 500;
/** How long the finished form sits before it clears and replays. */
const HOLD_MS = 2600;

function Skeleton() {
  return <span className="inline-block h-3 w-40 animate-pulse rounded bg-ink/10 align-middle" />;
}

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/**
 * Subscribed rather than read once into state, so it costs no extra render and
 * follows the OS setting if it changes mid-session. Server snapshot is `false`:
 * the server can't know, and full motion is what the markup already assumes.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/**
 * The due-diligence worksheet filling itself in, looping while it's on screen.
 *
 * It renders the product's real `Row` and `SourceBadge`, so what a visitor sees
 * here is literally the document they get — and the loop is what carries the
 * point the static version couldn't: answers arrive from three different places,
 * and the badges say which.
 */
export default function MemoFillDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(0);
  const [visible, setVisible] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  // With motion reduced the worksheet is simply shown complete — the point is
  // the finished document and its source tags, not the filling-in.
  const shown = reducedMotion ? ROWS.length : revealed;

  // Only animate while on screen — an off-screen loop is wasted timers.
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      threshold: 0.4,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // One timer per step, re-armed by the state it just set. Scheduling from the
  // effect rather than from inside the updater keeps it single-fire under
  // StrictMode's double-invoked updaters, and the cleanup means there is only
  // ever one timer alive.
  useEffect(() => {
    if (!visible || reducedMotion) return;
    const done = revealed >= ROWS.length;
    const timer = setTimeout(() => setRevealed(done ? 0 : revealed + 1), done ? HOLD_MS : STAGGER_MS);
    return () => clearTimeout(timer);
  }, [visible, revealed, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-3xl border border-ink/15 bg-white/60 shadow-sm backdrop-blur"
    >
      <div className="flex items-center gap-2 border-b border-ink/10 bg-paper-2/60 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-ink/15" />
        <span className="h-2 w-2 rounded-full bg-ink/15" />
        <span className="h-2 w-2 rounded-full bg-ink/15" />
        <span className="ml-2 font-mono text-xs text-muted">due-diligence · acme.pdf</span>
      </div>

      {ROWS.map((row, i) => (
        <Row key={row.label} label={row.label}>
          {i < shown ? (
            // No key needed: this replaces the Skeleton element, so it mounts
            // fresh exactly once per cycle and `cell-pop` fires on mount.
            <span className="cell-pop">
              <span className="text-ink/90">{row.value}</span>
              <SourceBadge source={row.source} />
            </span>
          ) : (
            <Skeleton />
          )}
        </Row>
      ))}
    </div>
  );
}
