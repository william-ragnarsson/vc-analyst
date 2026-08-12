import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";
import { getGeminiApiKey, getOcrMaxTokens, getWriteMaxTokens } from "@/lib/config";
import type {
  LlmProvider,
  ResearchOutput,
  SystemPrompt,
  TokenUsage,
  WebSource,
} from "./types";
import type { GenerateContentResponseUsageMetadata } from "@google/genai";

function ai(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

/**
 * Gemini's `systemInstruction` takes a plain string; join `SystemPrompt`
 * blocks in order (there's no explicit-cache API wired up here, so the
 * `cache` marker is a no-op on this provider — Gemini's implicit caching
 * still applies to the identical leading portion of the joined string).
 */
function toSystemInstruction(system: SystemPrompt): string {
  return typeof system === "string" ? system : system.map((b) => b.text).join("\n\n");
}

/**
 * The least thinking a given model will accept.
 *
 * Thinking off is what this pipeline wants: it spends the output-token budget on
 * hidden reasoning and can truncate a stream before the trailing fields (the
 * scorecard) land. There is no single setting that works across models — this
 * table is measured against the live API, not inferred from docs:
 *
 *                            thinkingBudget: 0    thinkingLevel: MINIMAL
 *   gemini-2.5-flash                ok            400 "not supported for this model"
 *   gemini-3.5-flash                ok            ok
 *   gemini-3.5-flash-lite           400           ok
 *
 * So 2.x takes the numeric budget and 3.x takes the level. Note 3.x cannot truly
 * disable thinking — MINIMAL is the floor and Google's docs say it "does not
 * guarantee that thinking is off" — so on a 3.x model some output budget still goes
 * to reasoning. If scorecards start arriving truncated, raise WRITE_MAX_TOKENS
 * before suspecting the parser.
 *
 * An unrecognised id gets the newer API, the same "assume forward" bet
 * `modelSupportsEffort` makes for Claude in lib/config.ts.
 */
function minimalThinking(model: string): ThinkingConfig {
  const major = Number(/^gemini-(\d+)/.exec(model)?.[1]);
  return Number.isFinite(major) && major < 3
    ? { thinkingBudget: 0 }
    : { thinkingLevel: ThinkingLevel.MINIMAL };
}

/** Normalize a Gemini `usageMetadata` object to the provider-agnostic shape. */
function usageOf(usage: GenerateContentResponseUsageMetadata | undefined, model: string): TokenUsage {
  return {
    inputTokens: usage?.promptTokenCount ?? 0,
    outputTokens: usage?.candidatesTokenCount ?? 0,
    cacheReadTokens: usage?.cachedContentTokenCount ?? 0,
    cacheCreationTokens: 0,
    model,
    provider: "gemini",
  };
}

/** Google Gemini adapter — translates the generic capabilities to the SDK. */
export const geminiProvider: LlmProvider = {
  name: "gemini",

  async transcribePdf(pdf, model, instruction, onUsage) {
    // Stream, for the same reason the Claude adapter does (see claude.ts): a whole
    // image-only deck plus a transcription of up to OCR_MAX_TOKENS is one very long
    // request, and the non-streaming endpoint gives up on it server-side with
    // 503 UNAVAILABLE "Deadline expired before operation could complete". Keeping
    // bytes flowing avoids that entirely. We still only want the final text — the
    // chunks aren't surfaced anywhere, since OCR has no progress UI.
    const stream = await ai().models.generateContentStream({
      model,
      contents: [
        { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
        { text: instruction },
      ],
      // Thinking minimised — as much of the budget as possible goes to transcription.
      config: { maxOutputTokens: getOcrMaxTokens(), thinkingConfig: minimalThinking(model) },
    });

    let text = "";
    let lastUsage: GenerateContentResponseUsageMetadata | undefined;
    for await (const chunk of stream) {
      // Usage arrives cumulatively; the final chunk carries the totals.
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
      if (chunk.text) text += chunk.text;
    }
    onUsage?.(usageOf(lastUsage, model));
    return text.trim();
  },

  async researchWeb({ model, system, user, onSearch, onSource, onText, onUsage, signal }): Promise<ResearchOutput> {
    const stream = await ai().models.generateContentStream({
      model,
      contents: user,
      // Google Search grounding — the equivalent of Claude's web_search.
      config: { systemInstruction: toSystemInstruction(system), tools: [{ googleSearch: {} }], abortSignal: signal },
    });

    const sources: WebSource[] = [];
    const seenQueries = new Set<string>();
    const seenSources = new Set<string>();
    let findings = "";
    let lastFinish: string | undefined;
    let lastUsage: GenerateContentResponseUsageMetadata | undefined;

    for await (const chunk of stream) {
      if (chunk.candidates?.[0]?.finishReason) lastFinish = chunk.candidates[0].finishReason;
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
      if (chunk.text) {
        findings += chunk.text;
        onText?.(chunk.text); // surface findings prose live (observational only)
      }

      // Grounding metadata arrives near the end of the stream (a burst), not
      // live per-query like Claude. Source URLs are Google redirect links.
      const grounding = chunk.candidates?.[0]?.groundingMetadata;
      if (!grounding) continue;

      for (const query of grounding.webSearchQueries ?? []) {
        if (!query || seenQueries.has(query)) continue;
        seenQueries.add(query);
        onSearch?.(query);
      }
      for (const groundingChunk of grounding.groundingChunks ?? []) {
        const web = groundingChunk.web;
        if (!web?.uri || seenSources.has(web.uri)) continue;
        seenSources.add(web.uri);
        const source: WebSource = { title: web.title ?? web.uri, url: web.uri };
        sources.push(source);
        onSource?.(source);
      }
    }

    console.log(`[gemini.researchWeb] finish=${lastFinish} findingsLen=${findings.length} queries=${seenQueries.size} sources=${sources.length}`);
    onUsage?.(usageOf(lastUsage, model));
    return { findings: findings.trim(), sources };
  },

  async generateStream({ model, system, user, onText, onUsage, signal }) {
    // No tools — stream plain text (the pipeline parses NDJSON field lines). We
    // deliberately don't set responseMimeType json: the output is many JSON
    // lines, not one object. Thinking is minimised because it's ON by default and
    // spends the output-token budget on hidden reasoning, which can truncate the
    // stream before the trailing fields (the scorecard) land — see minimalThinking.
    const stream = await ai().models.generateContentStream({
      model,
      contents: user,
      config: {
        systemInstruction: toSystemInstruction(system),
        maxOutputTokens: getWriteMaxTokens(),
        thinkingConfig: minimalThinking(model),
        abortSignal: signal,
      },
    });
    let text = "";
    let lastUsage: GenerateContentResponseUsageMetadata | undefined;
    for await (const chunk of stream) {
      if (chunk.usageMetadata) lastUsage = chunk.usageMetadata;
      if (chunk.text) {
        text += chunk.text;
        onText?.(chunk.text);
      }
    }
    onUsage?.(usageOf(lastUsage, model));
    return text.trim();
  },
};
