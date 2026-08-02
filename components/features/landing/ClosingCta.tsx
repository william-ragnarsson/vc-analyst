import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";

/**
 * The closing band — a dark card that bookends the hero, so the page opens and
 * shuts on the same surface. It reuses `AnalysisLauncher`, so a run started here
 * is identical to one started at the top (same context, same in-flight swap).
 */
export default function ClosingCta() {
  return (
    <section className="fade-up relative overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(140deg,var(--ink)_0%,var(--ink-2)_55%,#0d2a1c_100%)] px-6 py-12 shadow-[0_40px_80px_-40px_rgba(20,19,15,0.55)] ring-1 ring-inset ring-white/5 sm:px-12 sm:py-14">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-[120px]"
      />

      <div className="relative grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <div>
          <h2 className="text-3xl font-bold leading-[1.05] tracking-[-0.03em] text-white sm:text-4xl">
            Now run it on your own deck.
          </h2>
          <p className="mt-4 max-w-md leading-relaxed text-white/65">
            One PDF, no account, nothing to cancel. Your deck isn&apos;t stored anywhere, and the
            report stays in your browser.
          </p>
        </div>

        <AnalysisLauncher tone="dark" compact />
      </div>
    </section>
  );
}
