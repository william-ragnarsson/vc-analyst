import OutputCardStack from "@/components/features/landing/OutputCardStack";
import SectionHeading from "@/components/features/landing/SectionHeading";

/**
 * The problem, stated by contrast: the only feedback a founder actually gets —
 * a flat, contentless pass — against the same decision reconstructed in full.
 *
 * The visual argument does the work: one drab card beside four rich ones. This
 * section teases; §02 shows the report properly.
 */
export default function PitchPerspective() {
  return (
    <section className="fade-up">
      <SectionHeading
        index="01"
        eyebrow="The problem"
        title={
          <>
            The pass is two lines.{" "}
            <span className="font-serif font-normal italic">
              The reasoning behind it is two pages.
            </span>
          </>
        }
        sub="A partner forms a real opinion of your deck in minutes, against a rubric, and sends you almost none of it."
      />

      <div className="mt-14 grid items-start gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            What you get today
          </div>
          {/* Deliberately drab: flat, grey, no shadow. It has to look poor next
              to the stack beside it — that contrast is the argument. */}
          <div className="rounded-2xl border border-ink/10 bg-ink/[0.03] p-5">
            <div className="border-b border-ink/8 pb-3 text-xs text-muted">
              Re: Seed round — Acme
            </div>
            <p className="pt-3 text-sm leading-relaxed text-ink/55">
              Thanks for sending this over. Not a fit for us right now, but do keep us posted as
              things develop.
            </p>
            <p className="mt-4 text-sm text-ink/30">— and that&apos;s if they reply at all.</p>
          </div>
        </div>

        <div>
          <div className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            What you get here
          </div>
          <OutputCardStack />
        </div>
      </div>
    </section>
  );
}
