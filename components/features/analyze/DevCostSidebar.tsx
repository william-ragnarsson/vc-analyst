"use client";

import { useState } from "react";
import type { UsageTotals } from "@/lib/diligence/stream-state";

/**
 * In-depth dev token/cost analytics, dev-only. `usage` events never reach a
 * production client (gated server-side in the API route), so `state.usage`
 * stays null there and this renders nothing — no separate build-time flag
 * needed.
 */
export default function DevCostSidebar({ usage }: { usage: UsageTotals | null }) {
  const [collapsed, setCollapsed] = useState(false);

  if (process.env.NODE_ENV === "production" || !usage) return null;

  const stages = Object.entries(usage.byStage).sort((a, b) => b[1].costUsd - a[1].costUsd);
  const maxStageCost = Math.max(...stages.map(([, s]) => s.costUsd), 0.000001);
  const cacheableTokens = usage.totalInputTokens + usage.totalCacheReadTokens;
  const cacheHitRate = cacheableTokens > 0 ? usage.totalCacheReadTokens / cacheableTokens : 0;
  const uncachedCost = usage.totalCostUsd + usage.totalSavingsUsd;
  const discountPct = uncachedCost > 0 ? usage.totalSavingsUsd / uncachedCost : 0;

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed right-0 top-1/2 z-[60] -translate-y-1/2 rounded-l-xl border border-r-0 border-ink/15 bg-paper/95 px-2 py-3 font-mono text-xs text-ink shadow-lg backdrop-blur [writing-mode:vertical-rl]"
      >
        DEV · COST · ${usage.totalCostUsd.toFixed(4)}
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-0 z-[60] h-dvh w-[340px] overflow-y-auto border-l border-ink/15 bg-paper/95 p-4 font-mono text-xs text-ink shadow-lg backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold uppercase tracking-wide text-muted">Dev · cost</span>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded-full border border-ink/15 px-2 py-0.5 text-muted transition-colors hover:bg-ink/5 hover:text-ink"
        >
          ✕
        </button>
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-ink/10 p-3">
        <div className="flex items-baseline justify-between">
          <span className="text-muted">Total cost</span>
          <span className="text-base font-bold">${usage.totalCostUsd.toFixed(4)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-accent">
          <span>Saved via cache</span>
          <span className="font-semibold">
            ${usage.totalSavingsUsd.toFixed(4)} ({(discountPct * 100).toFixed(0)}%)
          </span>
        </div>
        <div className="mt-2 flex justify-between text-muted">
          <span>{usage.totalCalls} calls</span>
          <span>{usage.totalWebSearches} searches</span>
        </div>
      </div>

      {/* Tokens */}
      <div className="mt-3 rounded-lg border border-ink/10 p-3">
        <div className="mb-1.5 font-semibold uppercase tracking-wide text-muted">Tokens</div>
        <div className="grid grid-cols-2 gap-y-1">
          <span className="text-muted">In</span>
          <span className="text-right">{usage.totalInputTokens.toLocaleString()}</span>
          <span className="text-muted">Out</span>
          <span className="text-right">{usage.totalOutputTokens.toLocaleString()}</span>
          <span className="text-muted">Cache read</span>
          <span className="text-right text-accent">{usage.totalCacheReadTokens.toLocaleString()}</span>
          <span className="text-muted">Cache write</span>
          <span className="text-right">{usage.totalCacheCreationTokens.toLocaleString()}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-ink/10 pt-2">
          <span className="text-muted">Cache hit rate</span>
          <span className="font-semibold">{(cacheHitRate * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Per-stage breakdown */}
      {stages.length > 0 && (
        <div className="mt-3 rounded-lg border border-ink/10 p-3">
          <div className="mb-1.5 font-semibold uppercase tracking-wide text-muted">By stage</div>
          <ul className="space-y-2">
            {stages.map(([stage, s]) => (
              <li key={stage}>
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{stage}</span>
                  <span>${s.costUsd.toFixed(4)}</span>
                </div>
                <div className="mt-0.5 h-1 w-full rounded-full bg-ink/10">
                  <div
                    className="h-1 rounded-full bg-accent/70"
                    style={{ width: `${(s.costUsd / maxStageCost) * 100}%` }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted">
                  <span>{s.calls} call{s.calls === 1 ? "" : "s"}</span>
                  <span>{s.inputTokens.toLocaleString()} in</span>
                  <span>{s.outputTokens.toLocaleString()} out</span>
                  {s.cacheReadTokens > 0 && (
                    <span className="text-accent">{s.cacheReadTokens.toLocaleString()} cacheR</span>
                  )}
                  {s.cacheCreationTokens > 0 && <span>{s.cacheCreationTokens.toLocaleString()} cacheW</span>}
                  {s.webSearches > 0 && <span>{s.webSearches} search{s.webSearches === 1 ? "" : "es"}</span>}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
