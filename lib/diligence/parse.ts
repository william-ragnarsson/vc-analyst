import type { DueDiligenceForm, FieldSource, Founder } from "./types";

/**
 * Parsing + assembly for the NDJSON field stream the model emits. Each line is
 * one field: {"key": "...", "value": ..., "source": "..."}. `parseFieldLine`
 * turns a line into a typed field; `applyField` writes it onto the form.
 */

export interface ParsedField {
  key: string;
  value: unknown;
  source: FieldSource;
}

const VALID_SOURCES = new Set<FieldSource>(["deck", "web", "inferred", "unknown"]);

/**
 * Confidence ranking of a field's source, highest first. "deck" and "web" are
 * peers — both are grounded in real material, and the pipeline deliberately
 * lets research (web) correct or enrich a deck claim (and vice versa on a
 * later pass), so neither should be blocked from overwriting the other.
 * "inferred" is the model's own ungrounded reasoning, so it must not silently
 * downgrade an already-filled "deck"/"web" field (see `applyField`).
 */
const SOURCE_PRIORITY: Record<FieldSource, number> = {
  deck: 2,
  web: 2,
  inferred: 1,
  unknown: 0,
};

/** Parse one NDJSON line into a field, tolerating fences/whitespace. */
export function parseFieldLine(line: string): ParsedField | null {
  const trimmed = line.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    const obj = JSON.parse(trimmed) as { key?: unknown; value?: unknown; source?: unknown };
    if (typeof obj.key !== "string") return null;
    const source = (typeof obj.source === "string" && VALID_SOURCES.has(obj.source as FieldSource)
      ? obj.source
      : "inferred") as FieldSource;
    return { key: obj.key, value: obj.value, source };
  } catch {
    return null;
  }
}

/**
 * Normalize em/en dashes (and stray double-hyphens) that the model likes to
 * emit down to a plain hyphen, while keeping numeric ranges tight (2020-2024).
 * A safety net so generated text never shows a dash even if the model ignores
 * the prompt instruction against them.
 */
export function cleanDashes(text: string): string {
  if (!text) return text;
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, "$1-$2") // numeric ranges → tight hyphen
    .replace(/\s*[–—]\s*/g, " - ") // em/en dash → spaced hyphen
    .replace(/\s*--\s*/g, " - ") // double hyphen → spaced hyphen
    .replace(/ {2,}/g, " "); // collapse doubled spaces
}

function str(v: unknown): string {
  const s = typeof v === "string" ? v : v == null ? "" : String(v);
  return cleanDashes(s);
}

function clampRating(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(0, n)) : 0;
}

function normalizeFounders(value: unknown): Founder[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((f) => {
      const o = (f ?? {}) as Record<string, unknown>;
      return {
        role: str(o.role),
        name: str(o.name),
        commitment: str(o.commitment),
        background: Array.isArray(o.background) ? o.background.map(str).filter(Boolean) : [],
      };
    })
    .filter((f) => f.name || f.role);
}

/**
 * Apply a parsed field onto the form (mutates). Returns true if the key was
 * recognized and written; false for an unrecognized key or a write skipped
 * because it would downgrade an already-filled field to a lower-confidence
 * source (see `SOURCE_PRIORITY`). Either way the caller should not emit a
 * `field` event for a false return.
 */
export function applyField(
  form: DueDiligenceForm,
  key: string,
  value: unknown,
  source: FieldSource,
): boolean {
  if (key === "founders") {
    form.founders.members = normalizeFounders(value);
    return true;
  }

  if (key.startsWith("scorecard.")) {
    const metric = key.slice("scorecard.".length);
    if (metric === "funding") {
      const n = Math.round(Number(value));
      form.scorecard.funding = Number.isFinite(n) ? Math.max(0, n) : 0;
      return true;
    }
    if (metric in form.scorecard) {
      (form.scorecard as unknown as Record<string, number>)[metric] = clampRating(value);
      return true;
    }
    return false;
  }

  // Dotted "section.field" → a Field { value, source }.
  const [section, field] = key.split(".");
  const node = (form as unknown as Record<string, Record<string, unknown>>)[section];
  if (node && field && field in node) {
    const target = node[field];
    if (target && typeof target === "object" && "value" in target) {
      const current = target as { value?: unknown; source?: FieldSource };
      // Don't let a later stage silently downgrade an already-filled field to a
      // lower-confidence source (e.g. a real "deck" fact re-tagged "inferred"
      // because a weaker model just paraphrased it) — only upgrades/corrections
      // and same-tier re-emissions are allowed to overwrite.
      if (current.value && current.source && SOURCE_PRIORITY[source] < SOURCE_PRIORITY[current.source]) {
        return false;
      }
      node[field] = { value: str(value), source };
      return true;
    }
  }
  return false;
}
