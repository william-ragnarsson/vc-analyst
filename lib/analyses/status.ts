/**
 * Telling a run in progress from one that died.
 *
 * A row says `running` from the moment it's claimed until the run finishes or
 * fails. If the function running it is killed first — Vercel's `maxDuration`
 * is 300 s, and a crash skips `recorder.fail` — nothing ever flips it, so the
 * readers (the report page, the history list, the MCP tools) judge for
 * themselves: a run that started longer ago than any function can live is over.
 */

import type { AnalysisStatus } from "@/lib/supabase/types";

/** Past `maxDuration` (300 s) with a minute's slack for the final writes. */
export const STALLED_AFTER_MS = 6 * 60_000;

/**
 * When the run behind a row started. The claim saves a state with `startedAt`
 * (see `recordFor`); rows from before that fall back to `created_at`, which a
 * re-run doesn't reset — so for those it only ever errs towards "stalled".
 */
export function runStartedAt(startedAt: number | null | undefined, createdAt: string): number {
  return startedAt ?? Date.parse(createdAt);
}

/** Marked running, but started too long ago for anything to still be working on it. */
export function isStalled(status: AnalysisStatus, startedAt: number, now = Date.now()): boolean {
  return status === "running" && now - startedAt > STALLED_AFTER_MS;
}

/** What a reader shows for a stalled run. */
export const STALLED_MESSAGE = "This analysis stopped before it finished. Run it again.";
