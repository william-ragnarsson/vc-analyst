import DealLog from "@/components/features/landing/DealLog";

/**
 * The credibility section: where the training data came from.
 *
 * It argues one thing — the dataset is real, it's mine, and it isn't public —
 * so the layout puts the claim and the evidence side by side rather than
 * explaining a pipeline. The schematic that used to live here described *how*
 * the model runs, which is a different (and less contested) question, and it
 * pushed the numbers that actually carry the argument below the fold.
 *
 * The figures are load-bearing rather than round: 7 is the width of the feature
 * vector in `lib/invest/model.ts:35-43`, and 2 is the class count of a binary
 * classifier. Deliberately absent: accuracy, AUC and calibration. None of them
 * are measured anywhere in this repo, so there is no honest number to print.
 */
const FIGURES = [
  { value: "800+", label: "Decks reviewed by hand", note: "Each one read end to end, not scraped." },
  { value: "7", label: "Signals scored per deck", note: "The model's whole input. Nothing else reaches it." },
  { value: "2", label: "Outcomes", note: "Invest or pass, with the probability behind it." },
];

export default function InvestModel() {
  return (
    <section className="fade-up">
      {/* Sheet first in the DOM, so the single-column stack on phones leads with
          the evidence rather than making you scroll past three figures to reach
          the thing they describe. */}
      <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
        <DealLog />

        <div>
          <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
            Trained on{" "}
            <span className="font-serif font-normal italic">proprietary data.</span>
          </h2>

          <p className="mt-6 text-lg leading-relaxed text-muted">
            A year of weekly partner meetings and deal reviews at Plug and Play Tech Center. Every
            deck I read ended in a real invest-or-pass call. That record, not a public dataset, is
            what the model learned from.
          </p>

          {/* A stacked list rather than three across: the column is too narrow
              for that, and the fixed-width numeral gutter lines the values up
              into a spec table, which is the register this section wants. */}
          <dl className="mt-10 divide-y divide-ink/10 border-t border-ink/12">
            {FIGURES.map((f) => (
              <div key={f.label} className="flex items-baseline gap-5 py-4">
                <dt className="w-20 shrink-0 text-3xl font-bold tabular-nums tracking-tight text-ink">
                  {f.value}
                </dt>
                <dd className="min-w-0 text-sm leading-relaxed text-muted">
                  <span className="font-medium text-ink/80">{f.label}</span>
                  <br />
                  {f.note}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
