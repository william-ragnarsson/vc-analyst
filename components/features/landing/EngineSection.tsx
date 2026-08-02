import Link from "next/link";
import MemoFillDemo from "@/components/features/landing/MemoFillDemo";

/** The seven model inputs, in the order the classifier takes them (SCORECARD_METRIC_KEYS). */
const FEATURES = [
  "Team",
  "Technology",
  "Market size",
  "Value proposition",
  "Competitive advantage",
  "Social impact",
  "Funding raised",
];

export default function EngineSection() {
  return (
    <section className="fade-up">
      <h2 className="max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        The verdict comes from a model trained on 800+ real decisions.
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        Not a language model guessing what an investor might say. Seven scores go in, invest or
        pass comes out, with a probability attached.
      </p>

      <div className="mt-12 grid items-start gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] lg:gap-16">
        <div className="space-y-8">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              What goes in
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FEATURES.map((f) => (
                <span
                  key={f}
                  className="rounded-full border border-ink/15 bg-white/60 px-3 py-1 text-sm font-medium text-ink backdrop-blur"
                >
                  {f}
                </span>
              ))}
            </div>
            <p className="mt-4 leading-relaxed text-muted">
              Each one is scored against the playbook, then handed to a gradient-boosting
              classifier that runs in-process. No second API call, no prompt asking a chatbot for
              its opinion.
            </p>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
              What it learned from
            </div>
            <p className="mt-3 leading-relaxed text-muted">
              A year of weekly deal reviews at Plug and Play Tech Center, and the 800+ decks that
              went through them. The worksheet on the right is the same template those reviews
              used, which is why every answer carries a tag saying whether it came from your deck,
              from the web, or from the model&apos;s own read.
            </p>
          </div>

          <figure className="rounded-3xl border border-ink/10 bg-white/50 p-6 backdrop-blur">
            <blockquote className="font-serif text-lg italic leading-relaxed text-ink/80">
              &ldquo;If I can&apos;t find a founder with a quick search, that&apos;s an immediate
              yellow flag.&rdquo;
            </blockquote>
            <figcaption className="mt-3 text-sm text-muted">
              from{" "}
              <Link
                href="/playbook"
                className="font-medium text-ink underline decoration-marker decoration-2 underline-offset-2"
              >
                the Playbook
              </Link>
            </figcaption>
          </figure>
        </div>

        <MemoFillDemo />
      </div>
    </section>
  );
}
