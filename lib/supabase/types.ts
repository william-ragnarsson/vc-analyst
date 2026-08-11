/**
 * Hand-written database types, mirroring `supabase/migrations/`.
 *
 * Kept by hand rather than generated so the `state` column is typed as the real
 * `AnalysisState` instead of `Json` — that's the whole payload of a report, and
 * losing its type at the storage boundary would be the expensive part. Whenever
 * a migration changes a column, change it here too.
 *
 * Everything below is a `type`, not an `interface`, on purpose: postgrest-js
 * constrains rows to `Record<string, unknown>`, and interfaces have no implicit
 * index signature, so an interface here silently degrades every query result
 * to `never`.
 */

import type { AnalysisState } from "@/lib/diligence/stream-state";

export type AnalysisStatus = "running" | "done" | "error";

export type AnalysisRow = {
  id: string;
  user_id: string;
  /** SHA-256 of the deck PDF; the `/due-diligence/[id]` URL segment. */
  deck_hash: string;
  name: string;
  status: AnalysisStatus;
  state: AnalysisState | null;
  deck_path: string | null;
  deck_bytes: number | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

type AnalysisInsert = Omit<AnalysisRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type Database = {
  public: {
    Tables: {
      analyses: {
        Row: AnalysisRow;
        Insert: AnalysisInsert;
        Update: Partial<AnalysisInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      claim_anonymous_analyses: {
        Args: { p_anon_id: string };
        Returns: number;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
