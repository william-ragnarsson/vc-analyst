import { EmptyDeckError } from "@/lib/diligence/types";
import { getDeckTextExtractors } from "@/lib/pdf/extractors";
import type { TokenUsage } from "@/lib/llm/types";

/** Minimum characters for a deck to count as "readable" rather than empty. */
const MIN_DECK_CHARS = 80;

/**
 * Turn a pitch-deck PDF buffer into the plain `deckText` the pipeline expects.
 *
 * This is the single seam between the user's upload and the diligence pipeline.
 * It runs each registered extraction strategy in order (fast native text first,
 * then provider-backed vision OCR for image-only / scanned decks) and returns
 * the first result that has enough text. A strategy that throws is logged and
 * skipped, so one broken path never blocks the others. Only when every strategy
 * comes up empty do we throw EmptyDeckError for the UI to surface.
 *
 * Note the chain is currently two strategies long and vision OCR tries exactly one
 * model — whichever `OCR_MODEL` names. There is no second OCR attempt and no
 * cross-provider fallback, so a transient failure from that one model fails the
 * whole run. Adding a fallback candidate here would be cheap; it hasn't been done.
 *
 * The pipeline downstream is untouched — it still just receives a string.
 */
export async function extractDeckText(
  buffer: Buffer,
  onUsage?: (usage: TokenUsage) => void,
): Promise<string> {
  let lastError: unknown;

  for (const extractor of getDeckTextExtractors()) {
    try {
      const text = await extractor.extract(buffer, onUsage);
      if (text.length >= MIN_DECK_CHARS) {
        return text;
      }
    } catch (err) {
      // A failing strategy shouldn't break the chain — log and try the next.
      // But remember it: a systemic failure (no API credits, rate limit, network)
      // must not masquerade as an "image-only deck" if nothing else produces text.
      console.warn(`[pdf] extractor "${extractor.name}" failed:`, err);
      lastError = err;
    }
  }

  // Every strategy either returned too little text or failed. If a strategy
  // actually errored, surface that real cause; only when all strategies cleanly
  // came up empty is the deck genuinely unreadable.
  if (lastError) {
    throw lastError;
  }
  throw new EmptyDeckError();
}
