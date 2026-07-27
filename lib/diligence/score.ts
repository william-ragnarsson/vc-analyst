import { getProvider } from "@/lib/llm";
import { deriveProvider } from "@/lib/config";
import { costOf } from "@/lib/llm/pricing";
import {
  buildScorecardSystemPrompt,
  buildScorecardUserPrompt,
} from "@/lib/diligence/prompt";
import { applyField } from "./parse";
import type { DueDiligenceForm, ProgressCallback, ResearchResult } from "./types";

interface ScoreArgs {
  /** Concrete model id to run on; provider is derived from the name. */
  model: string;
  deckText: string;
  research: ResearchResult;
  playbook: string;
  /** The form to write the scorecard onto. */
  form: DueDiligenceForm;
  emit: ProgressCallback;
  /** Aborts the underlying request — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

const METRICS = [
  "team",
  "technology",
  "marketSize",
  "valueProposition",
  "competitiveAdvantage",
  "socialImpact",
  "funding",
] as const;

/** Pull the first {...} object out of the model's text, tolerating fences/prose. */
function extractObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Dedicated scorecard stage. The scorecard is the only input to the trained
 * invest model, so it can't be allowed to silently come back empty (which is
 * what happened when it rode along at the tail of the long completion stream and
 * got truncated). Here it's a single small JSON object — fast and untruncatable —
 * and every metric is written onto the form and emitted as a live `field` event.
 */
export async function scoreCard({
  model,
  deckText,
  research,
  playbook,
  form,
  emit,
  signal,
}: ScoreArgs): Promise<void> {
  const text = await getProvider(deriveProvider(model)).generateStream({
    model,
    system: buildScorecardSystemPrompt(playbook, deckText),
    user: buildScorecardUserPrompt(research),
    onUsage: (usage) => emit({ type: "usage", stage: "scorecard", usage, costUsd: costOf(usage) }),
    signal,
  });

  const obj = extractObject(text);
  if (!obj) return; // leave the scorecard at zero; verdict will read it as-is.

  for (const metric of METRICS) {
    if (obj[metric] === undefined || obj[metric] === null) continue;
    const key = `scorecard.${metric}`;
    if (applyField(form, key, obj[metric], "inferred")) {
      const value = (form.scorecard as unknown as Record<string, number>)[metric];
      emit({ type: "field", key, value, source: "inferred" });
    }
  }
}
