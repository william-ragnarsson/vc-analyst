/**
 * The single contract between backend and frontend.
 *
 * The backend's only job is to produce a `DueDiligenceForm`; the frontend's only
 * job is to render its fields. Change what's shown by editing this one file (and
 * the field registry in form-schema.ts) and both sides follow.
 */

import type { TokenUsage } from "@/lib/llm/types";

export interface Source {
  title: string;
  url: string;
}

/** Where a filled-in field value came from. */
export type FieldSource = "deck" | "web" | "inferred" | "unknown";

/** One founder row in the cap-table section. */
export interface Founder {
  /** e.g. "CEO", "COO", "CFO". */
  role: string;
  name: string;
  /** e.g. "Full-time | Co-founder & CEO". */
  commitment: string;
  /** Background bullet points. */
  background: string[];
}

/**
 * The 6 evaluation metrics (each 1–5) plus the funding amount — the inputs to
 * the custom invest/don't-invest model.
 */
export interface Scorecard {
  team: number;
  technology: number;
  marketSize: number;
  valueProposition: number;
  competitiveAdvantage: number;
  socialImpact: number;
  /**
   * Funding the startup has already raised to date (not the ask), whole US
   * dollars. 0 = confirmed nothing raised; null = not known. The model was
   * trained with that distinction, so unknown must not be collapsed into 0.
   */
  funding: number | null;
}

/** Output of the custom model: invest (1) or don't invest (0). */
export interface InvestVerdict {
  /** True = invest, false = pass. Meaningful only when `available`. */
  invest: boolean;
  /** False if the trained model couldn't run (shows a placeholder + note). */
  available: boolean;
  /**
   * The model's score, 0–1: the invest rate among past decks scored like this
   * one. `invest` is `score >= threshold`.
   */
  score?: number;
  /** The acceptance gate the score must clear, tuned when the model was trained. */
  threshold?: number;
  /** Reports saved before the regression model carry this instead of `score`. */
  probability?: number;
  note?: string;
}

/** How serious a piece of deck feedback is. */
export type DeckFeedbackSeverity = "critical" | "warning" | "strength";

/** One qualitative critique of the pitch deck itself (not a form field). */
export interface DeckFeedbackItem {
  severity: DeckFeedbackSeverity;
  /** e.g. "Team", "Competition", "Market", "Deck Basics". */
  category: string;
  /** Short label, e.g. "No competitors slide". */
  title: string;
  /** 1–2 sentences of explanation, tied to the playbook where relevant. */
  detail: string;
}

/**
 * The due-diligence form — mirrors William's Plug-and-Play DD template. Every
 * scalar field carries its value and where it came from, so the UI can badge
 * deck-sourced vs web-sourced cells and fill them in live.
 */
export interface Field {
  value: string;
  source: FieldSource;
}

export interface DueDiligenceForm {
  company: {
    name: Field;
    source: Field;
    founded: Field;
    basedIn: Field;
    description: Field;
    personalNote: Field;
  };
  founders: {
    members: Founder[];
    howTheyMet: Field;
    capTable: Field;
  };
  team: {
    headcount: Field;
    runway: Field;
  };
  problem: {
    core: Field;
    insight: Field;
  };
  solution: {
    core: Field;
    defensibility: Field;
  };
  market: {
    gtm: Field;
    revenueModel: Field;
    traction: Field;
    competitiveLandscape: Field;
    technologicalApplication: Field;
  };
  scorecard: Scorecard;
  verdict: InvestVerdict | null;
  /** Qualitative critique of the deck itself — gaps, weaknesses, strengths. */
  deckFeedback: DeckFeedbackItem[];
  sources: Source[];
  generatedAt: string;
}

/** Input the engine needs to produce the form. */
export interface DiligenceInput {
  deckText: string;
  playbook: string;
}

/** What the research stage hands to the completion stage. */
export interface ResearchResult {
  /** Prose research notes. */
  findings: string;
  /** Sources consulted (authoritative URL list). */
  sources: Source[];
}

/**
 * Progress events the engine emits while it works, streamed to the client as
 * NDJSON. The frontend imports only these types to drive the live form fill.
 */
export type ProgressEvent =
  /** A coarse phase change in the pipeline. */
  | { type: "status"; phase: DiligencePhase; message: string }
  /** A single form field was filled in. `value` is JSON for list/number fields. */
  | { type: "field"; key: string; value: unknown; source: FieldSource }
  /** A piece of deck feedback (gap/weakness/strength) was generated. */
  | { type: "feedback"; item: DeckFeedbackItem }
  /** A web search the model ran with this query. */
  | { type: "search"; query: string }
  /** A source the model consulted while researching. */
  | { type: "source"; title: string; url: string }
  /** An incremental chunk of the model's live research notes (observational). */
  | { type: "note"; text: string }
  /** The invest/don't-invest verdict from the custom model. */
  | { type: "verdict"; verdict: InvestVerdict }
  /** Token usage + cost for one LLM call. Dev-only — never sent in production. */
  | { type: "usage"; stage: string; usage: TokenUsage; costUsd: number }
  /** Terminal success event — carries the assembled form. */
  | { type: "report"; report: DueDiligenceForm }
  /** Terminal failure event. */
  | { type: "error"; message: string };

export type DiligencePhase =
  | "extracting"
  | "researching"
  | "completing"
  | "verdict"
  | "done";

/** Callback the engine calls to report progress as it runs. */
export type ProgressCallback = (event: ProgressEvent) => void;

/**
 * The diligence engine. The implementation can be swapped without touching the
 * API route or the UI, which depend only on `DueDiligenceForm` + `ProgressEvent`.
 */
export interface DiligenceEngine {
  run(input: DiligenceInput, onEvent?: ProgressCallback, signal?: AbortSignal): Promise<DueDiligenceForm>;
}

/** Thrown when a deck has too little extractable text (e.g. image-only PDF). */
export class EmptyDeckError extends Error {
  constructor(message = "Could not read text from this PDF. It may be image-only or scanned.") {
    super(message);
    this.name = "EmptyDeckError";
  }
}
