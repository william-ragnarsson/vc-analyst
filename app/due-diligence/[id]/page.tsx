"use client";

import { useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PhaseStepper from "@/components/features/analyze/PhaseStepper";
import ReportView from "@/components/features/analyze/ReportView";
import DevCostSidebar from "@/components/features/analyze/DevCostSidebar";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { getRecord } from "@/lib/diligence/history";

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { stream, status, currentId, error } = useAnalysis();
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLive = currentId === id;
  const record = isLive ? null : getRecord(id);
  const state = isLive ? stream : record?.state ?? null;
  const active = isLive && status === "loading";

  const backButton = (
    <Link
      href="/due-diligence"
      className="shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
    >
      ← Back
    </Link>
  );

  // Neither a live run nor a saved record — e.g. a hard refresh mid-run (only
  // finished runs persist) or a stale/deleted link.
  if (!state) {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
        <p className="text-lg font-semibold text-ink">This analysis is no longer available.</p>
        <p className="mt-2 text-muted">Live analyses aren’t saved until they finish. Start a new one:</p>
        <div className="mt-6 flex justify-center">{backButton}</div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 border-b border-ink/10 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-3">
          {backButton}
          <div className="min-w-0 flex-1">
            <PhaseStepper steps={state.steps} startedAt={state.startedAt} active={active} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-6">
        {isLive && status === "error" && (
          <p className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-700">
            {error}
          </p>
        )}
        <ReportView state={state} active={active} scrollRef={scrollRef} />
      </div>

      {isLive && <DevCostSidebar usage={state.usage} />}
    </div>
  );
}
