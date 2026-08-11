/**
 * One-time rescue of the old localStorage history.
 *
 * Before analyses were stored server-side they lived under this key, capped at
 * ten. Anyone who used the app before the switch would otherwise open it to an
 * empty list, so we offer to import what's in their browser once and then drop
 * the key. The original PDFs were never in localStorage, so imported records
 * have no `deck_path` — the report itself is intact, which is the part people
 * come back for.
 *
 * Delete this module (and the `LegacyImportPrompt` that uses it) once enough
 * time has passed that nobody is carrying the old key around.
 */

import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AnalysisState } from "@/lib/diligence/stream-state";

const LEGACY_KEY = "vc-analyst:history";

interface LegacyRecord {
  id: string;
  name: string;
  generatedAt: string;
  state: AnalysisState;
}

function readLegacy(): LegacyRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is LegacyRecord =>
        Boolean(r) && typeof r === "object" && typeof (r as LegacyRecord).id === "string",
    );
  } catch {
    return [];
  }
}

/** How many old records are sitting in this browser, if any. */
export function countLegacyRecords(): number {
  return readLegacy().length;
}

export function discardLegacyRecords(): void {
  try {
    window.localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Storage unavailable — nothing to discard.
  }
}

/** Imports the browser's old records for `userId`. Returns how many landed. */
export async function importLegacyRecords(userId: string): Promise<number> {
  const supabase = tryGetSupabaseBrowserClient();
  const records = readLegacy();
  if (!supabase || records.length === 0) return 0;

  const { error } = await supabase.from("analyses").upsert(
    records.map((r) => ({
      user_id: userId,
      deck_hash: r.id,
      name: r.name || "Untitled deck",
      status: "done" as const,
      state: r.state,
      deck_path: null,
      deck_bytes: null,
      error: null,
      completed_at: r.generatedAt || new Date().toISOString(),
    })),
    { onConflict: "user_id,deck_hash", ignoreDuplicates: true },
  );

  if (error) {
    console.warn("[analyses] legacy import failed:", error.message);
    return 0;
  }

  discardLegacyRecords();
  return records.length;
}
