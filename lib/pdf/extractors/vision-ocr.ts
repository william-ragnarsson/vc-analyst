import { getProvider } from "@/lib/llm";
import { deriveProvider, getOcrModel } from "@/lib/config";
import { OCR_INSTRUCTION } from "./instruction";
import type { DeckTextExtractor } from "./types";

/**
 * Generic vision-OCR fallback for image-only / scanned decks. Provider-agnostic:
 * it hands the PDF to whichever provider the OCR_MODEL implies via the
 * LlmProvider boundary. Selected after the free embedded-text strategy.
 */
export const visionOcrExtractor: DeckTextExtractor = {
  name: "vision-ocr",
  extract(buffer, onUsage) {
    const model = getOcrModel();
    return getProvider(deriveProvider(model)).transcribePdf(buffer, model, OCR_INSTRUCTION, onUsage);
  },
};
