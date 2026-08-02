import FeedbackCardStack from "@/components/features/landing/FeedbackCardStack";
import { DECK_CHECKLIST } from "@/lib/diligence/deck-checklist";

/**
 * The value proposition: what a founder actually gets back. The checklist is the
 * real one the feedback stage grades against (see lib/diligence/deck-checklist.ts),
 * so the promise here and the product's behaviour are the same list.
 */
export default function PitchPerspective() {
  return (
    <section className="fade-up">
      <h2 className="max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        Prepare your pitch by getting the VC&apos;s perspective.
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        An investor checks ten things before deciding whether to reply. You get a straight answer
        on each one, <span className="marker">including the ones your deck never mentions</span>.
      </p>

      <div className="mt-12 grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-16">
        <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {DECK_CHECKLIST.map((item) => (
            <li key={item.label} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <div>
                <div className="font-semibold text-ink">{item.label}</div>
                <div className="text-sm leading-relaxed text-muted">{item.hint}</div>
              </div>
            </li>
          ))}
        </ul>

        <FeedbackCardStack />
      </div>
    </section>
  );
}
