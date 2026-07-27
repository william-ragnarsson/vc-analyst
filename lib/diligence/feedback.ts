import { getProvider } from "@/lib/llm";
import { deriveProvider } from "@/lib/config";
import { costOf } from "@/lib/llm/pricing";
import {
  buildDeckFeedbackSystemPrompt,
  buildDeckFeedbackUserPrompt,
} from "@/lib/diligence/prompt";
import type {
  DeckFeedbackItem,
  DeckFeedbackSeverity,
  DueDiligenceForm,
  ProgressCallback,
  ResearchResult,
} from "./types";
import { cleanDashes } from "./parse";

interface ReviewArgs {
  /** Concrete model id to run on; provider is derived from the name. */
  model: string;
  deckText: string;
  research: ResearchResult;
  playbook: string;
  /** The form to append feedback items onto. */
  form: DueDiligenceForm;
  emit: ProgressCallback;
  /** Aborts the underlying request — cancel/disconnect stops token burn. */
  signal?: AbortSignal;
}

const VALID_SEVERITIES = new Set<DeckFeedbackSeverity>(["critical", "warning", "strength"]);

/** Parse one NDJSON line into a deck feedback item, tolerating fences/whitespace. */
function parseFeedbackLine(line: string): DeckFeedbackItem | null {
  const trimmed = line.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed) as Record<string, unknown>;
    const severity = typeof obj.severity === "string" && VALID_SEVERITIES.has(obj.severity as DeckFeedbackSeverity)
      ? (obj.severity as DeckFeedbackSeverity)
      : null;
    if (!severity || typeof obj.title !== "string" || !obj.title) return null;
    return {
      severity,
      category: cleanDashes(typeof obj.category === "string" ? obj.category : "General"),
      title: cleanDashes(obj.title),
      detail: cleanDashes(typeof obj.detail === "string" ? obj.detail : ""),
    };
  } catch {
    return null;
  }
}

/**
 * Deck-critique stage. Streams an NDJSON list of feedback items — gaps,
 * weaknesses, and strengths in the pitch deck itself — grounded in the
 * playbook and the research findings. Runs after research + the form is
 * complete, so it can flag issues research surfaces (e.g. unverifiable
 * founders) as well as what's literally on the slides.
 */
export async function reviewDeck({
  model,
  deckText,
  research,
  playbook,
  form,
  emit,
  signal,
}: ReviewArgs): Promise<void> {
  let buffer = "";

  const handleLine = (line: string) => {
    const item = parseFeedbackLine(line);
    if (!item) return;
    form.deckFeedback.push(item);
    emit({ type: "feedback", item });
  };

  await getProvider(deriveProvider(model)).generateStream({
    model,
    system: buildDeckFeedbackSystemPrompt(playbook, deckText),
    user: buildDeckFeedbackUserPrompt(research),
    onText: (delta) => {
      buffer += delta;
      let newline: number;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        if (line.trim()) handleLine(line);
      }
    },
    onUsage: (usage) => emit({ type: "usage", stage: "feedback", usage, costUsd: costOf(usage) }),
    signal,
  });

  // Flush any trailing line without a terminating newline.
  if (buffer.trim()) handleLine(buffer);
}
