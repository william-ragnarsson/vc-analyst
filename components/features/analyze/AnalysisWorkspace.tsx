"use client";

import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";
import RecentAnalyses from "@/components/features/analyze/RecentAnalyses";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";

/**
 * The analysis workspace used by /due-diligence: the labelled upload + run
 * controls with recent analyses below. This is where the home page's "Try it
 * now" CTA lands, so it carries the sample-deck prompt too — otherwise someone
 * who came here precisely because they had no deck hits the same dead end again.
 */
export default function AnalysisWorkspace() {
  const { status } = useAnalysis();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {status === "loading" ? "In progress" : "Try it"}
          </span>
          <span className="h-px flex-1 bg-ink/10" />
        </div>

        <AnalysisLauncher sample />
      </section>

      <RecentAnalyses />
    </div>
  );
}
