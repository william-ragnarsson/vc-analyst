"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PhaseStepper from "@/components/features/analyze/PhaseStepper";
import ReportView from "@/components/features/analyze/ReportView";
import DevCostSidebar from "@/components/features/analyze/DevCostSidebar";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";
import { useAuth } from "@/components/features/auth/AuthProvider";
import SavePrompt from "@/components/features/auth/SavePrompt";
import { getAnalysis, type AnalysisRecord } from "@/lib/analyses/store";

/** A resolved lookup, tagged with the id it was for — see the effect below. */
type Fetched = { id: string; record: AnalysisRecord | null };

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { stream, status, currentId, error } = useAnalysis();
  const { loading: authLoading, isAnonymous } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  const isLive = currentId === id;
  const active = isLive && status === "loading";

  // A live run already has everything in context — skip the round-trip. Wait
  // for auth first: querying before the session resolves returns nothing (RLS
  // scopes every row to auth.uid()) and would flash "not available".
  useEffect(() => {
    if (isLive || authLoading) return;

    let cancelled = false;
    getAnalysis(id).then((record) => {
      if (!cancelled) setFetched({ id, record });
    });

    return () => {
      cancelled = true;
    };
  }, [id, isLive, authLoading]);

  // Tagging the result with its id — rather than resetting to a loading state
  // when `id` changes — keeps this derived, so navigating between two reports
  // can never show the previous one's contents under the new url.
  const settled = fetched?.id === id;
  const record = isLive || !settled ? null : fetched.record;
  const state = isLive ? stream : record?.state ?? null;

  const backButton = (
    <Link
      href="/due-diligence"
      className="shrink-0 rounded-full border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
    >
      ← Back
    </Link>
  );

  if (!isLive && (authLoading || !settled)) {
    return (
      <div className="mx-auto max-w-3xl px-6 pt-16 text-center text-muted">Loading report…</div>
    );
  }

  if (!state) {
    // Either the deck was never analyzed under this account, or the run died
    // before it wrote anything.
    const interrupted = record?.status === "running" || record?.status === "error";
    return (
      <div className="mx-auto max-w-3xl px-6 pt-16 text-center">
        <p className="text-lg font-semibold text-ink">
          {interrupted ? "This analysis didn’t finish." : "This analysis isn’t available."}
        </p>
        <p className="mt-2 text-muted">
          {interrupted
            ? record?.error || "It was stopped partway through. Run the deck again to get a report."
            : "It may belong to another account, or it was deleted."}
        </p>
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
        {/* Offered once the report is worth keeping, not while it's still
            being written. */}
        {isAnonymous && !active && (
          <SavePrompt className="mb-6" message="This report is saved to this browser only." />
        )}
        <ReportView state={state} active={active} scrollRef={scrollRef} />
      </div>

      {isLive && <DevCostSidebar usage={state.usage} />}
    </div>
  );
}
