import Link from "next/link";
import Hero from "@/components/features/hero/Hero";
import PitchPerspective from "@/components/features/landing/PitchPerspective";
import PipelineStrip from "@/components/features/landing/PipelineStrip";
import EngineSection from "@/components/features/landing/EngineSection";
import ClosingCta from "@/components/features/landing/ClosingCta";

export default function Home() {
  return (
    <div className="space-y-24">
      {/* The hero card runs edge to edge, inset by a gutter on all four sides. */}
      <div className="p-3 sm:p-6">
        <Hero />
      </div>

      <div className="mx-auto max-w-5xl space-y-24 px-6">
        <PitchPerspective />
        <PipelineStrip />
        <EngineSection />

        <section className="fade-up">
          <Link
            href="/playbook"
            className="group block rounded-3xl border border-ink/15 bg-white/60 p-8 shadow-sm backdrop-blur transition-colors hover:border-ink/30"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">The rubric</div>
                <p className="mt-2 text-xl font-bold tracking-tight text-ink">
                  The exact criteria you&apos;re being judged against
                </p>
                <p className="mt-2 max-w-md leading-relaxed text-muted">
                  Team discoverability, competitive honesty, deck basics. Written down from a year
                  of weekly deal reviews, and still growing.
                </p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-lg text-paper transition-transform group-hover:rotate-12">
                →
              </span>
            </div>
          </Link>
        </section>
      </div>

      <div className="p-3 sm:p-6">
        <ClosingCta />
      </div>
    </div>
  );
}
