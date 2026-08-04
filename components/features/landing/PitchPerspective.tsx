import OutputCardStack from "@/components/features/landing/OutputCardStack";

/**
 * The value proposition: VCs evaluate against a system, and this hands you that
 * system before you pitch.
 *
 * The heading lives inside the left column rather than spanning the section, so
 * title, standfirst and questions read as one block balanced against the cards.
 * Hoisting it out leaves it stranded above a vertically-centred grid.
 *
 * The three questions are the promise stated as questions the context database
 * answers — concrete enough to be worth something, without claiming to know
 * findings about a deck nobody has uploaded yet.
 */
const QUESTIONS = [
  "What do investors actually look for?",
  "What makes a deck more fundable?",
  "What reads as an immediate red flag?",
];

export default function PitchPerspective() {
  return (
    <section className="fade-up">
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
            Improve your funding odds{" "}
            <span className="font-serif font-normal italic">in 30 seconds.</span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-muted">
            VC firms run an investment system to evaluate hundreds of startups every week. Prepare
            your pitch against that same system, drawn from{" "}
            <span className="marker">my context database of real deal reviews</span>.
          </p>

          {/* `divide-y` puts rules only *between* items. A border above the
              first and below the last makes a three-item list read as a
              fragment of a cut-off table. */}
          <ul className="mt-9 divide-y divide-ink/10">
            {QUESTIONS.map((q) => (
              <li
                key={q}
                className="py-4 text-xl font-medium leading-snug tracking-tight text-ink first:pt-0 last:pb-0"
              >
                {q}
              </li>
            ))}
          </ul>
        </div>

        <OutputCardStack />
      </div>
    </section>
  );
}
