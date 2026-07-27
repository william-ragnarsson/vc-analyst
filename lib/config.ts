/**
 * The single place the pipeline reads its configuration from. Everything here
 * is driven by environment variables (see `.env.example`) so models, the
 * web-research budget, and token caps can all be tuned without touching code.
 *
 * Every value is read at call time (not import time) and every knob has a
 * default that reproduces the current behaviour — so an empty `.env` behaves
 * exactly as the hardcoded defaults did, and the Vercel build stays green even
 * when a var isn't present at build.
 */

import type { Provider } from "@/lib/llm/types";

// ───────────────────────────── API keys ─────────────────────────────

export function getAnthropicApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env (see .env.example).",
    );
  }
  return key;
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env (see .env.example).",
    );
  }
  return key;
}

// ───────────────────────────── Models ─────────────────────────────

/**
 * The model ids the pipeline is known to work with and price correctly (see
 * `lib/llm/pricing.ts`). Used only to catch typos: an unrecognised id is
 * warned about but still passed through to the API, so a genuinely newer model
 * works without a code change (and a real typo fails loudly at the API rather
 * than silently running the wrong model). Keep in sync with `.env.example`.
 */
export const KNOWN_MODELS = [
  "claude-opus-4-8",
  "claude-sonnet-5",
  "claude-sonnet-4-6",
  "claude-haiku-4-5",
  "gemini-2.5-flash",
] as const;

/** Which provider adapter a model id routes to — inferred from its name. */
export function deriveProvider(model: string): Provider {
  return model.trim().toLowerCase().startsWith("gemini") ? "gemini" : "claude";
}

/**
 * Claude models that reject `output_config.effort` outright (400 "This model
 * does not support the effort parameter"). A blocklist rather than an
 * allowlist so a newer/unrecognised model defaults to "supports it" — true
 * for every current-gen Claude model except Haiku.
 */
const EFFORT_UNSUPPORTED = new Set(["claude-haiku-4-5"]);

/** Whether it's safe to send `output_config.effort` to this model. */
export function modelSupportsEffort(model: string): boolean {
  return !EFFORT_UNSUPPORTED.has(model.trim().toLowerCase());
}

/**
 * Read a model id from `name`, falling back to `fallback` when unset. A set but
 * unrecognised value is warned about and passed through unchanged (see
 * KNOWN_MODELS) so new models keep working.
 */
function envModel(name: string, fallback: string): string {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if (!(KNOWN_MODELS as readonly string[]).includes(raw)) {
    console.warn(
      `[config] ${name}="${raw}" is not a recognised model id. Passing it to ` +
        `the API anyway (cost tracking may show $0). Valid ids: ${KNOWN_MODELS.join(", ")}.`,
    );
  }
  return raw;
}

/** Per-stage model selection. Defaults reproduce the current pipeline exactly. */
export const getOcrModel = (): string => envModel("OCR_MODEL", "gemini-2.5-flash");
export const getExtractModel = (): string => envModel("EXTRACT_MODEL", "claude-haiku-4-5");
export const getResearchModel = (): string => envModel("RESEARCH_MODEL", "claude-sonnet-4-6");
export const getCompleteModel = (): string => envModel("COMPLETE_MODEL", "claude-haiku-4-5");
export const getScorecardModel = (): string => envModel("SCORECARD_MODEL", "claude-haiku-4-5");
export const getFeedbackModel = (): string => envModel("FEEDBACK_MODEL", "claude-haiku-4-5");

// ───────────────────────── Numeric knobs ─────────────────────────

/** Parse an int env var, clamping to [min, max] and warning on a bad value. */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    console.warn(`[config] ${name}="${raw}" is not an integer; using ${fallback}.`);
    return fallback;
  }
  const clamped = Math.min(max, Math.max(min, n));
  if (clamped !== n) {
    console.warn(`[config] ${name}=${n} is out of range [${min}, ${max}]; using ${clamped}.`);
  }
  return clamped;
}

/**
 * Web-research budget (Claude research only — Gemini's Google Search grounding
 * self-manages). `max searches` caps the web_search tool's uses; `max
 * continuations` caps how many times the server-side pause_turn loop resumes.
 */
export const getResearchMaxSearches = (): number => envInt("RESEARCH_MAX_SEARCHES", 3, 0, 10);
export const getResearchMaxContinuations = (): number =>
  envInt("RESEARCH_MAX_CONTINUATIONS", 3, 0, 10);

/** Advanced: max output tokens per stage class. */
export const getResearchMaxTokens = (): number => envInt("RESEARCH_MAX_TOKENS", 5000, 256, 128000);
export const getWriteMaxTokens = (): number => envInt("WRITE_MAX_TOKENS", 16000, 256, 128000);
export const getOcrMaxTokens = (): number => envInt("OCR_MAX_TOKENS", 16000, 256, 128000);
