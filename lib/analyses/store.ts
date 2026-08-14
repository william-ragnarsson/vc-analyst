/**
 * Reading and deleting saved analyses from the browser.
 *
 * Replaces the old localStorage history: the database is now the only store, so
 * a report opens on any device and the 10-record cap is gone. Writes during a
 * run happen server-side instead (see `lib/analyses/persist.ts`) — the analyze
 * route already holds the events and the PDF, and doing it there means a
 * mid-run refresh no longer loses the work.
 *
 * Every query here is scoped by Row-Level Security to `auth.uid()`; there is no
 * user_id filter in the client code because there doesn't need to be one.
 */

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AnalysisStatus } from "@/lib/supabase/types";
import type { AnalysisState } from "@/lib/diligence/stream-state";

/** List-view fields — deliberately excludes `state`, which is a whole report. */
export interface AnalysisSummary {
  /** Primary key, used for deletes. */
  rowId: string;
  /** The deck hash — what `/due-diligence/[id]` is keyed by. */
  id: string;
  name: string;
  status: AnalysisStatus;
  generatedAt: string;
  error: string | null;
}

export interface AnalysisRecord extends AnalysisSummary {
  state: AnalysisState | null;
  deckPath: string | null;
}

const SUMMARY_COLUMNS = "id, deck_hash, name, status, created_at, completed_at, error";

interface SummaryRow {
  id: string;
  deck_hash: string;
  name: string;
  status: AnalysisStatus;
  created_at: string;
  completed_at: string | null;
  error: string | null;
}

function toSummary(row: SummaryRow): AnalysisSummary {
  return {
    rowId: row.id,
    id: row.deck_hash,
    name: row.name,
    status: row.status,
    generatedAt: row.completed_at ?? row.created_at,
    error: row.error,
  };
}

/** Newest first. Returns an empty list when signed out or unconfigured. */
export async function listAnalyses(): Promise<AnalysisSummary[]> {
  const supabase = tryGetSupabaseBrowserClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("analyses")
    .select(SUMMARY_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[analyses] list failed:", error.message);
    return [];
  }
  return (data as unknown as SummaryRow[]).map(toSummary);
}

/** One analysis by deck hash, with its full report state. */
export async function getAnalysis(deckHash: string): Promise<AnalysisRecord | null> {
  const supabase = tryGetSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("analyses")
    .select(`${SUMMARY_COLUMNS}, state, deck_path`)
    .eq("deck_hash", deckHash)
    .maybeSingle();

  if (error) {
    console.warn("[analyses] fetch failed:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as unknown as SummaryRow & {
    state: AnalysisState | null;
    deck_path: string | null;
  };
  return { ...toSummary(row), state: row.state, deckPath: row.deck_path };
}

export async function deleteAnalysis(rowId: string): Promise<void> {
  const supabase = tryGetSupabaseBrowserClient();
  if (!supabase) return;

  // Fetch the object path first: the row is what tells us where the deck lives,
  // and once it's deleted the PDF would be orphaned in the bucket forever.
  const { data } = await supabase
    .from("analyses")
    .select("deck_path")
    .eq("id", rowId)
    .maybeSingle();

  const { error } = await supabase.from("analyses").delete().eq("id", rowId);
  if (error) {
    console.warn("[analyses] delete failed:", error.message);
    return;
  }

  const deckPath = (data as { deck_path: string | null } | null)?.deck_path;
  if (deckPath) await supabase.storage.from("decks").remove([deckPath]);
}

export async function clearAnalyses(): Promise<void> {
  const supabase = tryGetSupabaseBrowserClient();
  if (!supabase) return;

  const { data } = await supabase.from("analyses").select("id, deck_path");
  const rows = (data ?? []) as { id: string; deck_path: string | null }[];
  if (rows.length === 0) return;

  const { error } = await supabase
    .from("analyses")
    .delete()
    .in("id", rows.map((r) => r.id));
  if (error) {
    console.warn("[analyses] clear failed:", error.message);
    return;
  }

  const paths = rows.map((r) => r.deck_path).filter((p): p is string => Boolean(p));
  if (paths.length > 0) await supabase.storage.from("decks").remove(paths);
}

/** A short-lived signed URL for the original deck — the bucket is private. */
export async function getDeckUrl(deckPath: string): Promise<string | null> {
  const supabase = tryGetSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from("decks").createSignedUrl(deckPath, 300);
  if (error) {
    console.warn("[analyses] signed url failed:", error.message);
    return null;
  }
  return data.signedUrl;
}
