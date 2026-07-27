import { getProvider } from "@/lib/llm";
import { costOf } from "@/lib/llm/pricing";
import { deriveProvider, getResearchModel } from "@/lib/config";
import {
  buildSearchSystemPrompt,
  buildSearchUserPrompt,
} from "@/lib/diligence/prompt";
import type {
  DiligenceInput,
  ProgressCallback,
  ResearchResult,
} from "@/lib/diligence/types";

/** What the deck pass already learned, so research can target the gaps. */
export interface ResearchContext {
  companyName: string;
  /** Labels of fields still empty after the deck pass. */
  gaps: string[];
}

/**
 * Web-research stage (generic) — a single web-search pass against the shared,
 * cached deck+playbook context. The provider's web search collects and
 * organizes source-attributed research notes directly (no separate synthesis
 * call), forwarding query/source/notes as ProgressEvents. The findings feed
 * the completion, scorecard, and feedback stages as-is.
 */
export async function research(
  { deckText, playbook }: DiligenceInput,
  onEvent?: ProgressCallback,
  ctx?: ResearchContext,
  signal?: AbortSignal,
): Promise<ResearchResult> {
  const emit: ProgressCallback = onEvent ?? (() => {});

  const model = getResearchModel();
  const result = await getProvider(deriveProvider(model)).researchWeb({
    model,
    system: buildSearchSystemPrompt(playbook, deckText),
    user: buildSearchUserPrompt(ctx?.companyName ?? "", ctx?.gaps ?? []),
    onSearch: (query) => emit({ type: "search", query }),
    onSource: (source) => emit({ type: "source", ...source }),
    onText: (text) => emit({ type: "note", text }),
    onUsage: (usage) => emit({ type: "usage", stage: "search", usage, costUsd: costOf(usage) }),
    signal,
  });

  return { findings: result.findings, sources: result.sources };
}
