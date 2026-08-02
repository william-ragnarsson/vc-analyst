import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";

/**
 * The closing ask. No container, no background, no border — the page ends on
 * plain paper. A second dark slab down here reads as a broken copy of the hero,
 * which is exactly what it replaced.
 *
 * It reuses `AnalysisLauncher`, so a run started here is identical to one
 * started at the top: same context, same in-flight swap.
 */
export default function ClosingCta() {
  return (
    <section className="fade-up flex flex-col items-center text-center">
      <h2 className="max-w-xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        Now run it on your own deck.
      </h2>
      <p className="mt-4 max-w-md text-lg leading-relaxed text-muted">
        One PDF, no account, nothing to cancel. Your deck isn&apos;t stored anywhere.
      </p>

      <div className="mt-10 w-full max-w-md">
        <AnalysisLauncher tone="light" compact align="center" />
      </div>
    </section>
  );
}
