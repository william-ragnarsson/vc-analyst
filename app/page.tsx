import Link from "next/link";
import Hero from "@/components/features/hero/Hero";
import RecentAnalyses from "@/components/features/analyze/RecentAnalyses";
import SampleMemoPreview from "@/components/features/landing/SampleMemoPreview";
import FeedbackPreview from "@/components/features/landing/FeedbackPreview";

export default function Home() {
  return (
    <div className="space-y-20">
      {/* The hero card runs edge to edge, inset by a gutter on all four sides. */}
      <div className="p-3 sm:p-6">
        <Hero />
      </div>

      <div className="mx-auto max-w-3xl space-y-20 px-6">
        {/* Self-hides when there's no history, so no empty state to guard. */}
        <RecentAnalyses />

        <section className="fade-up">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              The feedback a VC would never send you.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-muted">
              A partner forms a sharp opinion of your deck in minutes, then sends a two-line
              pass, if that. This is the part they keep to themselves: what&apos;s landing,
              what&apos;s missing, and how you look to someone who Googles you before they reply.
            </p>
          </div>
          <FeedbackPreview />
        </section>

        <section className="fade-up">
          <div className="mb-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
              Not a summary. Due diligence.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-lg leading-relaxed text-muted">
              I&apos;m not summarizing your startup, you already know your startup! I&apos;m
              showing you <span className="marker">the part you never get to see</span>: everything a VC does behind the scenes when they review your pitchdeck.
            </p>
          </div>
          <SampleMemoPreview />
        </section>

        <section className="fade-up">
          <Link
            href="/playbook"
            className="group block rounded-3xl border border-ink/15 bg-gradient-to-br from-white/70 to-paper/40 p-8 backdrop-blur transition-colors hover:border-ink/30"
          >
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">The rubric</div>
                <p className="mt-2 text-xl font-bold tracking-tight text-ink">
                  The exact criteria you&apos;re being judged against
                </p>
                <p className="mt-2 max-w-md leading-relaxed text-muted">
                  Real insider criteria (team credibility, competition, deck quality) from a year
                  inside one of the world&apos;s most active accelerators.
                </p>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-lg text-paper transition-transform group-hover:rotate-12">
                →
              </span>
            </div>
          </Link>
        </section>
      </div>
    </div>
  );
}
