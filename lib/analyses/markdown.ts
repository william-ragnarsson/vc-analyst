/**
 * Plain-markdown renderings of an analysis, for the MCP tools.
 *
 * Claude reads these instead of the raw `AnalysisState`: the state is built for
 * a live UI (note deltas, step flags, highlight keys) and is several times the
 * size, while a tool result has a budget (~150k characters on claude.ai, 25k
 * tokens by default in Claude Code). The full interactive report stays one link
 * away.
 */

import { domainOf } from "@/components/features/analyze/sourceDisplay";
import { DD_SECTIONS, SCORECARD_METRIC_KEYS } from "@/lib/diligence/form-schema";
import type { AnalysisState } from "@/lib/diligence/stream-state";
import type { DeckFeedbackItem, DueDiligenceForm, Field, InvestVerdict, Source } from "@/lib/diligence/types";
import { formatGauge } from "@/lib/invest/gauge";

/** Research sources listed in a report; the rest are a click away on the page. */
const MAX_SOURCES = 25;

const SOURCE_TAG: Record<Field["source"], string> = {
  deck: "deck",
  web: "web",
  inferred: "inferred",
  unknown: "",
};

const SCORE_LABELS: Record<(typeof SCORECARD_METRIC_KEYS)[number], string> = {
  team: "Team",
  technology: "Technology",
  marketSize: "Market size",
  valueProposition: "Value proposition",
  competitiveAdvantage: "Competitive advantage",
  socialImpact: "Social impact",
};

/** The finished report: verdict, scorecard, every form section, feedback, sources. */
export function renderReport(state: AnalysisState, { url, name }: { url: string; name: string }): string {
  const form = state.form;
  const company = form.company.name.value.trim() || name;
  const verdict = state.verdict ?? form.verdict;
  const out: string[] = [];

  out.push(`# ${company} — SevenFold due diligence`, "");
  out.push(`**Verdict:** ${describeVerdict(verdict)}`);
  out.push(`**Full interactive report:** ${url}`, "");

  out.push("## Scorecard", "");
  out.push(`| ${SCORECARD_METRIC_KEYS.map((k) => SCORE_LABELS[k]).join(" | ")} |`);
  out.push(`|${SCORECARD_METRIC_KEYS.map(() => "---").join("|")}|`);
  out.push(`| ${SCORECARD_METRIC_KEYS.map((k) => formatScore(form.scorecard[k])).join(" | ")} |`, "");
  out.push(`Funding raised to date: ${formatFunding(form.scorecard.funding, state.fundingInUsd === true)}`, "");

  for (const section of DD_SECTIONS) {
    if (section.title === "Scorecard") continue;
    out.push(`## ${section.title}`, "");
    for (const field of section.fields) {
      if (field.kind === "founders") {
        out.push(...renderFounders(form));
        continue;
      }
      const value = fieldAt(form, field.key);
      // The VC's own meeting notes: only worth a line when someone filled them.
      if (field.manualOnly && !value?.value.trim()) continue;
      out.push(`- **${field.label}:** ${formatField(value)}`);
    }
    out.push("");
  }

  out.push(...renderFeedback(state.deckFeedback.length ? state.deckFeedback : form.deckFeedback));
  out.push(...renderSources(collectSources(state, form)));

  out.push(
    "_Field tags show where each answer came from: (deck) the pitch deck, (web) SevenFold's web research, (inferred) the model's own inference._",
  );
  return out.join("\n").trim() + "\n";
}

/** A short status for a run that hasn't finished yet. */
export function renderProgress(
  state: AnalysisState | null,
  { url, name, analysisId, startedAt }: { url: string; name: string; analysisId: string; startedAt: number },
): string {
  const out: string[] = [];
  const minutes = Math.max(0, Math.round((Date.now() - startedAt) / 60_000));
  out.push(`SevenFold is still analyzing "${name}" (started ${minutes === 0 ? "under a minute" : `${minutes} min`} ago).`, "");

  if (state) {
    const steps = state.steps
      .map((s) => `${s.status === "done" ? "✓" : s.status === "active" ? "▶" : "○"} ${s.label}`)
      .join("  →  ");
    out.push(`Progress: ${steps}`);
    out.push(`Fields filled so far: ${state.filledCount} · Web sources found: ${state.sourceCount}`, "");
  }

  out.push(`analysis_id: ${analysisId}`);
  out.push(`Live view: ${url}`, "");
  out.push(
    "A full run usually takes 2–4 minutes. Call `get_analysis` with this analysis_id to wait for the finished report.",
  );
  return out.join("\n");
}

function describeVerdict(verdict: InvestVerdict | null): string {
  if (!verdict) return "Not available";
  if (!verdict.available) return `Not available${verdict.note ? ` — ${verdict.note}` : ""}`;
  const call = verdict.invest ? "INVEST" : "PASS";
  let detail = "";
  if (typeof verdict.score === "number" && typeof verdict.threshold === "number") {
    const gauge = formatGauge(verdict.score, verdict.threshold);
    detail = ` (model score ${gauge.score} vs. gate ${gauge.gate}, out of 100)`;
  } else if (typeof verdict.probability === "number") {
    // Reports saved before the regression model.
    detail = ` (model's invest probability: ${Math.round(verdict.probability * 100)}%)`;
  }
  return `${call}${detail}${verdict.note ? ` — ${verdict.note}` : ""}`;
}

function formatScore(score: number): string {
  return score > 0 ? `${score}/5` : "—";
}

/** See `AnalysisState.fundingInUsd`: older reports used 0 for unknown, in the deck's currency. */
function formatFunding(funding: number | null, inUsd: boolean): string {
  if (funding === null || !Number.isFinite(funding)) return "unknown";
  if (!inUsd) return funding > 0 ? new Intl.NumberFormat("en-US").format(funding) + " (deck currency)" : "unknown";
  if (funding <= 0) return "none yet";
  return "$" + new Intl.NumberFormat("en-US").format(funding);
}

function fieldAt(form: DueDiligenceForm, key: string): Field | undefined {
  const [section, field] = key.split(".");
  const node = (form as unknown as Record<string, Record<string, unknown>>)[section];
  return node?.[field] as Field | undefined;
}

function formatField(field: Field | undefined): string {
  const value = field?.value.trim();
  if (!value) return "_unknown_";
  const tag = SOURCE_TAG[field!.source];
  // Multi-line answers (bullets from the model) stay readable inside a list item.
  const body = value.includes("\n") ? "\n  " + value.split("\n").join("\n  ") : value;
  return tag ? `${body} _(${tag})_` : body;
}

function renderFounders(form: DueDiligenceForm): string[] {
  const members = form.founders.members;
  if (members.length === 0) return ["- **Founders:** _unknown_"];
  const lines = ["- **Founders:**"];
  for (const f of members) {
    const role = [f.role, f.commitment].filter(Boolean).join(" · ");
    lines.push(`  - **${f.name || "Unnamed"}**${role ? ` — ${role}` : ""}`);
    for (const point of f.background) lines.push(`    - ${point}`);
  }
  return lines;
}

function renderFeedback(items: DeckFeedbackItem[]): string[] {
  if (items.length === 0) return [];
  const out = ["## Deck feedback", ""];
  const groups: [DeckFeedbackItem["severity"], string][] = [
    ["critical", "Critical"],
    ["warning", "Warnings"],
    ["strength", "Strengths"],
  ];
  for (const [severity, title] of groups) {
    const group = items.filter((i) => i.severity === severity);
    if (group.length === 0) continue;
    out.push(`### ${title}`);
    for (const item of group) out.push(`- **${item.title}** (${item.category}): ${item.detail}`);
    out.push("");
  }
  return out;
}

function collectSources(state: AnalysisState, form: DueDiligenceForm): Source[] {
  const all = form.sources.length ? form.sources : state.searches.flatMap((s) => s.sources);
  const seen = new Set<string>();
  return all.filter((s) => {
    if (!s.url || seen.has(s.url)) return false;
    seen.add(s.url);
    return true;
  });
}

function renderSources(sources: Source[]): string[] {
  if (sources.length === 0) return [];
  const out = ["## Research sources", ""];
  sources.slice(0, MAX_SOURCES).forEach((s, i) => {
    // Gemini's grounding links are long opaque redirects; its title for them is
    // the site's domain, which says as much in a fraction of the characters.
    const entry = domainOf(s.url) ? `[${s.title || s.url}](${s.url})` : s.title || "Web source";
    out.push(`${i + 1}. ${entry}`);
  });
  if (sources.length > MAX_SOURCES) out.push(`…and ${sources.length - MAX_SOURCES} more in the full report.`);
  out.push("");
  return out;
}
