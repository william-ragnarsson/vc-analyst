import type { DueDiligenceForm } from "./types";

/**
 * The due-diligence form schema — the single source of truth for what the form
 * contains. It drives three things at once: the prompt (which keys the model
 * fills, in order), the streaming state, and the grid layout. Mirrors William's
 * Plug-and-Play DD template.
 */

export type FieldKind = "text" | "founders" | "rating" | "number";

export interface FieldDescriptor {
  /** Dotted path into DueDiligenceForm, e.g. "company.founded". */
  key: string;
  /** Grid label, e.g. "Founded". */
  label: string;
  kind: FieldKind;
  /** Guidance to the model on what belongs here. */
  hint: string;
  /** True for fields a deck/web can't supply (the VC's own meeting notes). */
  manualOnly?: boolean;
}

export interface FormSection {
  title: string;
  fields: FieldDescriptor[];
}

export const DD_SECTIONS: FormSection[] = [
  {
    title: "Company Overview",
    fields: [
      { key: "company.name", label: "Company", kind: "text", hint: "The company / startup name." },
      { key: "company.source", label: "Source", kind: "text", manualOnly: true, hint: "How the investor met the company (e.g. an event). Usually not in the deck - leave unknown if absent." },
      { key: "company.founded", label: "Founded", kind: "text", hint: "Founding date (month + year if known)." },
      { key: "company.basedIn", label: "Based in", kind: "text", hint: "Headquarters location (city/country)." },
      { key: "company.description", label: "Description", kind: "text", hint: "1-3 sentence description of what the company does." },
      { key: "company.personalNote", label: "Personal note", kind: "text", manualOnly: true, hint: "The investor's subjective impression from meeting the team. Not derivable from a deck - leave unknown." },
    ],
  },
  {
    title: "Founders & Cap Table",
    fields: [
      { key: "founders", label: "Founders", kind: "founders", hint: "Array of founders, each { role, name, commitment, background[] }. role e.g. CEO/COO/CFO; commitment e.g. 'Full-time | Co-founder & CEO'; background = bullet points of prior companies/roles/education." },
      { key: "founders.howTheyMet", label: "How they met", kind: "text", hint: "How the founders know each other and the trust signal it gives." },
      { key: "founders.capTable", label: "Cap Table", kind: "text", hint: "Cap table / round details: investors, amounts, dilution, structure." },
    ],
  },
  {
    title: "Team",
    fields: [
      { key: "team.headcount", label: "Headcount", kind: "text", hint: "Team size / composition (e.g. '3 founders, 2 FT 1 PT')." },
      { key: "team.runway", label: "Runway", kind: "text", hint: "Funding runway and next-round timing." },
    ],
  },
  {
    title: "Problem",
    fields: [
      { key: "problem.core", label: "Core problem", kind: "text", hint: "The core problem the company solves." },
      { key: "problem.insight", label: "Insight / Origin", kind: "text", hint: "The founding insight or origin story behind the problem." },
    ],
  },
  {
    title: "Solution",
    fields: [
      { key: "solution.core", label: "Core solution", kind: "text", hint: "The core product/solution." },
      { key: "solution.defensibility", label: "Defensibility", kind: "text", hint: "Moat / defensibility (IP, tech, data, network effects)." },
    ],
  },
  {
    title: "Other",
    fields: [
      { key: "market.gtm", label: "GTM", kind: "text", hint: "Go-to-market: target customers and channels." },
      { key: "market.revenueModel", label: "Revenue Model", kind: "text", hint: "How they make money; pricing; any revenue caveats." },
      { key: "market.traction", label: "Traction", kind: "text", hint: "Customers, revenue, pilots, LOIs, pipeline." },
      { key: "market.competitiveLandscape", label: "Competitive Landscape", kind: "text", hint: "Competitors and how they differentiate." },
      { key: "market.technologicalApplication", label: "Technological Application", kind: "text", hint: "The underlying technology and how it's applied." },
    ],
  },
  {
    title: "Scorecard",
    fields: [
      { key: "scorecard.team", label: "Team", kind: "rating", hint: "Rate the team 1-5 (strength, completeness, track record)." },
      { key: "scorecard.technology", label: "Technology", kind: "rating", hint: "Rate product/tech maturity 1-5 (1 = prototype/MVP/undeveloped, 5 = market-ready)." },
      { key: "scorecard.marketSize", label: "Market Size", kind: "rating", hint: "Rate the market size 1-5." },
      { key: "scorecard.valueProposition", label: "Value Proposition", kind: "rating", hint: "Rate the value proposition 1-5." },
      { key: "scorecard.competitiveAdvantage", label: "Competitive Advantage", kind: "rating", hint: "Rate the competitive advantage / moat 1-5." },
      { key: "scorecard.socialImpact", label: "Social Impact", kind: "rating", hint: "Rate the social impact 1-5." },
      { key: "scorecard.funding", label: "Funding raised", kind: "number", hint: "Total funding the startup has ALREADY raised to date (not the current ask), as an integer in the deck's currency (no symbols)." },
    ],
  },
];

/** Flat, ordered list of every field descriptor. */
export const FIELD_DESCRIPTORS: FieldDescriptor[] = DD_SECTIONS.flatMap((s) => s.fields);

/**
 * Stable anchor id for a document sub-section, shared by the rendered section
 * and the chapters nav so scroll-spy / jump-links line up. e.g. "Company
 * Overview" → "doc-company-overview".
 */
export function sectionSlug(title: string): string {
  return "doc-" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** The document sub-sections shown in the DD form (the Scorecard is separate). */
export const DOC_SECTIONS: FormSection[] = DD_SECTIONS.filter((s) => s.title !== "Scorecard");

/** Keys of the scorecard rating metrics (1–5), in model-feature order. */
export const SCORECARD_METRIC_KEYS = [
  "team",
  "technology",
  "marketSize",
  "valueProposition",
  "competitiveAdvantage",
  "socialImpact",
] as const;

/**
 * Labels of the fields still empty after the deck pass — the research stage
 * targets these specifically. Skips manual-only fields and the scorecard
 * (scored later), and special-cases the founders list.
 */
export function computeGaps(form: DueDiligenceForm): string[] {
  const gaps: string[] = [];
  for (const f of FIELD_DESCRIPTORS) {
    if (f.manualOnly || f.kind === "rating" || f.kind === "number") continue;
    if (f.kind === "founders") {
      if (form.founders.members.length === 0) gaps.push("Founders — names, roles, and backgrounds");
      continue;
    }
    const [section, field] = f.key.split(".");
    const node = (form as unknown as Record<string, Record<string, unknown>>)[section];
    const target = node?.[field] as { value?: string } | undefined;
    if (!target?.value) gaps.push(f.label);
  }
  return gaps;
}

const emptyField = () => ({ value: "", source: "unknown" as const });

/** A blank form with every field unfilled. */
export function emptyForm(): DueDiligenceForm {
  return {
    company: {
      name: emptyField(),
      source: emptyField(),
      founded: emptyField(),
      basedIn: emptyField(),
      description: emptyField(),
      personalNote: emptyField(),
    },
    founders: { members: [], howTheyMet: emptyField(), capTable: emptyField() },
    team: { headcount: emptyField(), runway: emptyField() },
    problem: { core: emptyField(), insight: emptyField() },
    solution: { core: emptyField(), defensibility: emptyField() },
    market: {
      gtm: emptyField(),
      revenueModel: emptyField(),
      traction: emptyField(),
      competitiveLandscape: emptyField(),
      technologicalApplication: emptyField(),
    },
    scorecard: {
      team: 0,
      technology: 0,
      marketSize: 0,
      valueProposition: 0,
      competitiveAdvantage: 0,
      socialImpact: 0,
      funding: 0,
    },
    verdict: null,
    deckFeedback: [],
    sources: [],
    generatedAt: new Date().toISOString(),
  };
}
