import Anthropic from "@anthropic-ai/sdk";
import {
  getAnthropicApiKey,
  getOcrMaxTokens,
  getResearchMaxContinuations,
  getResearchMaxSearches,
  getResearchMaxTokens,
  getWriteMaxTokens,
  modelSupportsEffort,
} from "@/lib/config";
import type {
  LlmProvider,
  ResearchOutput,
  SystemPrompt,
  TokenUsage,
  WebSource,
} from "./types";

function client(): Anthropic {
  return new Anthropic({ apiKey: getAnthropicApiKey() });
}

/**
 * Map the generic `SystemPrompt` to Anthropic's system param shape, applying
 * a cache_control breakpoint to blocks marked `cache: true`. The
 * playbook+deck prefix is large and byte-identical across stages/calls, so
 * caching it turns repeat reads (research continuations, later pipeline
 * stages within the 5-min window) into cheap cache hits instead of
 * full-price input tokens.
 */
function toSystem(system: SystemPrompt): string | Anthropic.TextBlockParam[] {
  if (typeof system === "string") return system;
  return system.map((block) => ({
    type: "text" as const,
    text: block.text,
    ...(block.cache ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
}

/** Join the text blocks of a message into one trimmed string. */
function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

/** Normalize an Anthropic `Usage` object to the provider-agnostic shape. */
function usageOf(usage: Anthropic.Usage, model: string): TokenUsage {
  return {
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    webSearches: usage.server_tool_use?.web_search_requests,
    model,
    provider: "claude",
  };
}

/** Anthropic Claude adapter — translates the generic capabilities to the SDK. */
export const claudeProvider: LlmProvider = {
  name: "claude",

  async transcribePdf(pdf, model, instruction, onUsage) {
    // Stream to avoid HTTP timeouts on long transcriptions; we only need text.
    const stream = client().messages.stream({
      model,
      max_tokens: getOcrMaxTokens(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdf.toString("base64"),
              },
            },
            { type: "text", text: instruction },
          ],
        },
      ],
    });
    const message = await stream.finalMessage();
    onUsage?.(usageOf(message.usage, model));
    return textOf(message.content);
  },

  async researchWeb({ model, system, user, onSearch, onSource, onText, onUsage, signal }): Promise<ResearchOutput> {
    const c = client();
    const messages: Anthropic.MessageParam[] = [{ role: "user", content: user }];
    const maxContinuations = getResearchMaxContinuations();
    const params = {
      model,
      max_tokens: getResearchMaxTokens(),
      system: toSystem(system),
      tools: [
        {
          type: "web_search_20260209" as const,
          name: "web_search" as const,
          max_uses: getResearchMaxSearches(),
          // Restrict to direct calls: this tool's default caller set includes
          // programmatic (code-execution) calling, which only newer models
          // support — without this, a model like Haiku 4.5 400s ("does not
          // support programmatic tool calling"). Direct is all this pipeline
          // ever needs (no code execution tool is declared here).
          allowed_callers: ["direct" as const],
        },
      ],
      // Not every model accepts this param (e.g. Haiku 4.5 400s on it), so only
      // send it when RESEARCH_MODEL is one that supports it.
      ...(modelSupportsEffort(model) ? { output_config: { effort: "low" as const } } : {}),
    };

    const sources: WebSource[] = [];
    const seen = new Set<string>();

    // server_tool_use blocks carry the query; web_search_tool_result blocks
    // carry the consulted pages (with clean, direct URLs).
    type Stream = ReturnType<typeof c.messages.stream>;
    const attach = (stream: Stream) => {
      // Surface the model's findings prose live (observational only).
      if (onText) stream.on("text", (delta: string) => onText(delta));
      stream.on("contentBlock", (block: Anthropic.ContentBlock) => {
        if (block.type === "server_tool_use" && block.name === "web_search") {
          const query = (block.input as { query?: string } | null)?.query;
          if (query) onSearch?.(query);
        } else if (block.type === "web_search_tool_result") {
          const results = Array.isArray(block.content) ? block.content : [];
          for (const r of results) {
            if (r.type !== "web_search_result" || !r.url || seen.has(r.url)) continue;
            seen.add(r.url);
            const source: WebSource = { title: r.title ?? r.url, url: r.url };
            sources.push(source);
            onSource?.(source);
          }
        }
      });
    };

    let stream = c.messages.stream({ ...params, messages }, { signal });
    attach(stream);
    let response = await stream.finalMessage();
    onUsage?.(usageOf(response.usage, model));

    // The web_search tool runs a server-side loop; resume on pause_turn.
    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < maxContinuations) {
      messages.push({ role: "assistant", content: response.content });
      stream = c.messages.stream({ ...params, messages }, { signal });
      attach(stream);
      response = await stream.finalMessage();
      onUsage?.(usageOf(response.usage, model));
      continuations += 1;
    }

    return { findings: textOf(response.content), sources };
  },

  async generateStream({ model, system, user, onText, onUsage, signal }) {
    // No tools — stream plain text (the pipeline parses NDJSON field lines).
    const stream = client().messages.stream(
      {
        model,
        max_tokens: getWriteMaxTokens(),
        system: toSystem(system),
        messages: [{ role: "user", content: user }],
      },
      { signal },
    );
    if (onText) stream.on("text", (delta: string) => onText(delta));
    const message = await stream.finalMessage();
    onUsage?.(usageOf(message.usage, model));
    return textOf(message.content);
  },
};
