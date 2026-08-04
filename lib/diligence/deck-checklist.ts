/**
 * The standard slides/topics a VC expects in a pitch deck.
 *
 * Two consumers, deliberately sharing one definition: the deck-feedback prompt
 * (`buildDeckFeedbackSystemPrompt`) grades against it, and the homepage shows it
 * to founders as "what you get feedback on". Those two must never drift — a
 * marketing list promising feedback the engine doesn't actually give would be a
 * lie the copy can't detect on its own.
 */
export const DECK_CHECKLIST = [
  { label: "Problem", hint: "a clear, specific problem worth solving." },
  { label: "Solution", hint: "the product and why it solves the problem." },
  {
    label: "Market size / why now",
    hint: "TAM/SAM/SOM or credible market sizing, and why this moment.",
  },
  { label: "Business & revenue model", hint: "how the company makes money." },
  { label: "Traction", hint: "customers, revenue, pilots, LOIs, usage, growth." },
  { label: "Competition", hint: "an honest competitors slide with clear differentiation." },
  { label: "Team", hint: "founders, roles, backgrounds, and why they're the ones to win." },
  { label: "Go-to-market", hint: "target customers and channels to reach them." },
  { label: "The ask / use of funds", hint: "how much is being raised and what it funds." },
  {
    label: "Product / demo",
    hint: "evidence the product actually works (screenshots, demo, video).",
  },
] as const;

/** The checklist as the prompt wants it: one `- Label - hint.` line per item. */
export function formatDeckChecklist(): string {
  return DECK_CHECKLIST.map((item) => `- ${item.label} - ${item.hint}`).join("\n");
}
