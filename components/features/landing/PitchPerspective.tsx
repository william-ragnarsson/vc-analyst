import OutputCardStack from "@/components/features/landing/OutputCardStack";
import SectionHeading from "@/components/features/landing/SectionHeading";

/**
 * The value proposition: VCs evaluate against a system, and this hands you that
 * system before you pitch.
 *
 * The three questions are the promise stated as questions the context database
 * can answer — concrete enough to be worth something, without claiming to know
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
      <SectionHeading
        title={
          <>
            Make your pitch ironclad.{" "}
            <span className="font-serif font-normal italic">Get your funding.</span>
          </>
        }
      />

      {/* Centred, not top-aligned: the card stack is ~180px taller than this
          column, and top-aligning dumps all of that slack into one corner. */}
      <div className="mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            VC firms run an investment system to evaluate hundreds of startups every week. Prepare
            your pitch against that same system, drawn from{" "}
            <span className="marker">a proprietary database of real deal reviews</span>.
          </p>

          {/* `divide-y` puts rules only *between* items. A border above the
              first and below the last makes a three-item list read as a
              fragment of a cut-off table. */}
          <ul className="mt-10 divide-y divide-ink/10">
            {QUESTIONS.map((q) => (
              <li
                key={q}
                className="py-5 text-xl font-medium leading-snug tracking-tight text-ink first:pt-0 last:pb-0"
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
