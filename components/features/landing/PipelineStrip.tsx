/**
 * The six stages every run goes through.
 *
 * Source of truth is `PipelineDiligenceEngine` in lib/diligence/engine.ts — these
 * labels mirror the status messages it emits. They're duplicated rather than
 * imported because there they're interleaved with control flow; if you rename a
 * stage there, rename it here.
 */
const STAGES = [
  { label: "Reading the deck", detail: "Text is pulled from the PDF, with vision OCR as a fallback for image-only slides." },
  { label: "Researching online", detail: "Targeted searches for the facts the deck left out, and checks on the ones it claims." },
  { label: "Completing the form", detail: "The due-diligence worksheet is filled in, each field tagged with where it came from." },
  { label: "Scoring", detail: "Seven scorecard metrics, judged against the playbook." },
  { label: "Reviewing the deck", detail: "A critique of the deck itself: strengths, thin spots, and outright gaps." },
  { label: "Running the model", detail: "The seven scores go into the trained classifier. Invest or pass, with a probability." },
];

export default function PipelineStrip() {
  return (
    <section className="fade-up">
      <h2 className="text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        Six stages, every time.
      </h2>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        Nothing about this is one prompt and a hope. The deck gets parsed, the web gets searched,
        the worksheet gets filled, the model gets run.
      </p>

      <ol className="mt-10 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
        {STAGES.map((stage, i) => (
          <li key={stage.label} className="flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink text-sm font-bold text-paper">
              {i + 1}
            </span>
            <div>
              <div className="font-semibold text-ink">{stage.label}</div>
              <div className="mt-1 text-sm leading-relaxed text-muted">{stage.detail}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
