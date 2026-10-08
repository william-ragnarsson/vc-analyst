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
import { isStalled, STALLED_MESSAGE } from "@/lib/analyses/status";

/** How often a report whose run is still going is re-read. */
const POLL_MS = 4000;

/** A run that's still going somewhere else — started from Claude, or in another tab. */
function inProgress(record: AnalysisRecord): boolean {
  return record.status === "running" && !isStalled(record.status, record.startedAt);
}

/** A resolved lookup, tagged with the id it was for — see the effect below. */
type Fetched = { id: string; record: AnalysisRecord | null };

export default function ReportPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { stream, status, currentId, error } = useAnalysis();
  const { loading: authLoading, isAnonymous, user } = useAuth();
  const userId = user?.id ?? null;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fetched, setFetched] = useState<Fetched | null>(null);

  const isLive = currentId === id;

  // A live run already has everything in context — skip the round-trip. Wait
  // for auth first: querying before the session resolves returns nothing (RLS
  // scopes every row to auth.uid()) and would flash "not available". Re-run on
  // a change of user too: after a sign-out the old account's report must go.
  useEffect(() => {
    if (isLive || authLoading) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let polling = false;
    let last: AnalysisRecord | null = null;

    const load = () => {
      getAnalysis(id).then((record) => {
        if (cancelled) return;
        const wasPolling = polling;
        // A failed re-read mid-run is a blip, not a deleted report: keep
        // showing the last one — until that run is too old to still be going.
        last = record ?? (wasPolling ? last : null);
        // A run still going elsewhere saves its progress every few seconds;
        // re-reading follows along until it's over.
        polling = last !== null && inProgress(last);
        if (record || !wasPolling || !polling) setFetched({ id, record: last });
        if (polling) timer = setTimeout(load, POLL_MS);
      });
    };
    load();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, isLive, authLoading, userId]);

  // Tagging the result with its id — rather than resetting to a loading state
  // when `id` changes — keeps this derived, so navigating between two reports
  // can never show the previous one's contents under the new url.
  const settled = fetched?.id === id;
  const record = isLive || !settled ? null : fetched.record;
  const state = isLive ? stream : record?.state ?? null;
  const active = isLive ? status === "loading" : record !== null && inProgress(record);
  // A saved run that won't finish: failed, or its function died mid-way.
  const failure =
    !isLive && record && (record.status === "error" || isStalled(record.status, record.startedAt))
      ? record.error || STALLED_MESSAGE
      : null;

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
        {((isLive && status === "error") || failure) && (
          <p className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-700">
            {isLive ? error : failure}
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
