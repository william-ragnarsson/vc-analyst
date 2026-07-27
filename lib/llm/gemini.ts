import { GoogleGenAI } from "@google/genai";
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
    const response = await ai().models.generateContent({
      model,
      contents: [
        { inlineData: { mimeType: "application/pdf", data: pdf.toString("base64") } },
        { text: instruction },
      ],
      // Thinking off — the whole budget goes to the transcription.
      config: { maxOutputTokens: getOcrMaxTokens(), thinkingConfig: { thinkingBudget: 0 } },
    });
    onUsage?.(usageOf(response.usageMetadata, model));
    return (response.text ?? "").trim();
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
    // lines, not one object. Thinking is off — Gemini 2.5 Flash has it ON by
    // default, which spends the output-token budget on hidden reasoning and can
    // truncate the stream before the trailing fields (the scorecard) land.
    const stream = await ai().models.generateContentStream({
      model,
      contents: user,
      config: {
        systemInstruction: toSystemInstruction(system),
        maxOutputTokens: getWriteMaxTokens(),
        thinkingConfig: { thinkingBudget: 0 },
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
