import SectionHeading from "@/components/features/landing/SectionHeading";

/**
 * The machinery, condensed. Every claim maps to real code — see the file
 * reference on each block. Deliberately absent: accuracy figures, runtime, and
 * cost, none of which are measured anywhere in this repo.
 */
const SYSTEMS = [
  {
    n: "01",
    title: "Deck ingestion",
    body: "The PDF's own text layer first, vision OCR when the deck is image-only. A pass that fails is skipped, not fatal.",
  },
  {
    n: "02",
    title: "Targeted research",
    body: "Up to three searches aimed at what the deck left out. Findings that contradict it are kept, not smoothed over.",
  },
  {
    n: "03",
    title: "Context database",
    body: "Insider criteria loaded into every stage: founder discoverability, competitive honesty, deck basics.",
  },
  {
    n: "04",
    title: "Proprietary dataset",
    body: "800+ decks reviewed by hand, each with a real invest-or-pass verdict. That's the training set.",
  },
];

export default function HowItWorks() {
  return (
    <section className="fade-up">
      <SectionHeading
        index="03"
        eyebrow="How it works"
        title="Four systems, not one prompt."
        sub="Most 'AI feedback' is a single call to a chatbot that has never seen a term sheet."
      />

      <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {SYSTEMS.map((s) => (
          <div key={s.n} className="border-t border-ink/12 pt-5">
            <div className="font-mono text-xs text-accent">{s.n}</div>
            <div className="mt-2 font-semibold text-ink">{s.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
