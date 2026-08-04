import type { DeckFeedbackSeverity } from "@/lib/diligence/types";

/**
 * Severity styling, shared by the report's `DeckFeedbackPanel` and the
 * homepage's feedback card stack so the two can't drift apart.
 *
 * It lives in its own module rather than being exported from `DeckFeedbackPanel`
 * because that file is `"use client"` — a Server Component importing from it
 * would receive a client-reference proxy, not this object, and every lookup
 * would come back `undefined`.
 */
export const SEVERITY_META: Record<
  DeckFeedbackSeverity,
  { label: string; dot: string; badge: string }
> = {
  critical: { label: "Critical", dot: "bg-red-600", badge: "bg-red-500/15 text-red-700" },
  warning: { label: "Warning", dot: "bg-amber-500", badge: "bg-amber-500/20 text-amber-700" },
  strength: { label: "Strength", dot: "bg-accent", badge: "bg-accent/15 text-accent" },
};

export const SEVERITY_ORDER: DeckFeedbackSeverity[] = ["critical", "warning", "strength"];
