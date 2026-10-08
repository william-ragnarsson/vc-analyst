/**
 * Server-side persistence for a running analysis.
 *
 * The analyze route already produces every `ProgressEvent` and already holds
 * the PDF, so saving happens here rather than on the client. Two things fall
 * out of that: a refresh or a closed tab mid-run no longer loses the work, and
 * the deck reaches Storage without a second upload.
 *
 * The MCP route (`app/mcp/route.ts`) saves through the same recorder. Its runs
 * have no PDF — Claude reads the deck in chat and sends the text — and nobody
 * is watching a stream, so the state is also flushed every few seconds while
 * the run is in flight: that is what `get_analysis` and the report page poll.
 *
 * Persistence is strictly best-effort. An analysis costs real money and takes
 * minutes; nothing in this file is allowed to fail one. Every operation is
 * wrapped, and a caller with no Supabase project — or no session — gets a
 * no-op recorder that simply does nothing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/config";
import { hashBytes } from "@/lib/analyses/hash";
import { initialState, streamReducer, type AnalysisState } from "@/lib/diligence/stream-state";
import type { ProgressEvent } from "@/lib/diligence/types";

/** Runs allowed per user per rolling 24h — anonymous users get the tighter cap. */
const DAILY_LIMIT_ANONYMOUS = 5;
const DAILY_LIMIT_IDENTIFIED = 25;

/** How often a running analysis writes its partial state back to its row. */
const FLUSH_INTERVAL_MS = 3000;

/** Who a run is saved for, and a client that acts as them (so RLS applies). */
export interface AnalysisOwner {
  supabase: SupabaseClient<Database>;
  userId: string;
  isAnonymous: boolean;
}

/**
 * What gets saved for one run. `pdf` is the uploaded deck — hashed, and kept in
 * Storage. Text-only runs (MCP) pass the deck text instead: the hash is taken
 * over its UTF-8 bytes and nothing is uploaded.
 */
export type DeckToRecord =
  | { pdf: Buffer; filename: string }
  | { text: string; filename: string };

export interface AnalysisRecorder {
  /** The deck hash, which is also the report's URL segment. Null when not persisting. */
  readonly deckHash: string | null;
  /** Fold one event into the state that will be saved. */
  record(event: ProgressEvent): void;
  /** Mark the run finished and flush the accumulated state. */
  finish(): Promise<void>;
  /** Mark the run failed. A no-op if `finish` already ran. */
  fail(message: string): Promise<void>;
}

const NOOP_RECORDER: AnalysisRecorder = {
  deckHash: null,
  record() {},
  async finish() {},
  async fail() {},
};

export class RateLimitError extends Error {}

/**
 * Claims a row for this run and returns something to feed events into.
 *
 * Called before the pipeline starts so the row exists — and the deck is
 * uploaded — even if the run is later abandoned. Throws only `RateLimitError`;
 * every other problem degrades to `NOOP_RECORDER`.
 */
export async function startRecording(deck: Buffer, filename: string): Promise<AnalysisRecorder> {
  if (!isSupabaseConfigured()) return NOOP_RECORDER;

  let owner: AnalysisOwner;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return NOOP_RECORDER; // signed out — run it, don't save it
    owner = { supabase, userId: data.user.id, isAnonymous: data.user.is_anonymous === true };
  } catch (err) {
    console.warn("[analyses] no session, skipping persistence:", err);
    return NOOP_RECORDER;
  }

  return recordFor(owner, { pdf: deck, filename });
}

/**
 * `startRecording` for a caller that has already resolved the user — the MCP
 * route, which authenticates with a bearer token rather than cookies. Same
 * contract: throws only `RateLimitError`, otherwise degrades to a no-op.
 */
export async function recordFor(owner: AnalysisOwner, deck: DeckToRecord): Promise<AnalysisRecorder> {
  const { supabase, userId, isAnonymous } = owner;

  await enforceRateLimit(supabase, userId, isAnonymous);

  const bytes = "pdf" in deck ? deck.pdf : new TextEncoder().encode(deck.text);
  const deckHash = await hashBytes(bytes);
  const fallbackName = stripExtension(deck.filename);
  // Saved with the claim, not on the first flush: its `startedAt` is how a
  // reader tells a run in progress from one whose function died mid-way.
  const state = initialState();

  try {
    // Upsert, not insert: re-running the same deck (the `force` path in the UI)
    // must overwrite its previous report rather than trip the unique index.
    const { data, error } = await supabase
      .from("analyses")
      .upsert(
        {
          user_id: userId,
          deck_hash: deckHash,
          name: fallbackName,
          status: "running",
          state,
          deck_path: null,
          deck_bytes: bytes.byteLength,
          error: null,
          completed_at: null,
        },
        { onConflict: "user_id,deck_hash" },
      )
      .select("id")
      .single();

    if (error || !data) {
      console.warn("[analyses] could not claim a row:", error?.message);
      return NOOP_RECORDER;
    }

    const rowId = (data as { id: string }).id;

    if ("pdf" in deck) {
      const deckPath = `${userId}/${rowId}.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("decks")
        .upload(deckPath, deck.pdf, { contentType: "application/pdf", upsert: true });

      if (uploadError) {
        // The report is the valuable half; keep going without the deck.
        console.warn("[analyses] deck upload failed:", uploadError.message);
      } else {
        await supabase.from("analyses").update({ deck_path: deckPath }).eq("id", rowId);
      }
    }

    return new SupabaseRecorder(supabase, rowId, deckHash, fallbackName, state);
  } catch (err) {
    console.warn("[analyses] persistence setup failed:", err);
    return NOOP_RECORDER;
  }
}

class SupabaseRecorder implements AnalysisRecorder {
  private settled = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  // Every write goes through this chain, so they land in the order they were
  // issued: a slow periodic flush can never overwrite the final state.
  private writes: Promise<void> = Promise.resolve();
  // The `startedAt` this run claimed the row with. Re-running a deck claims
  // the same row again with a new one, and from then on this run's writes
  // match nothing — a superseded run can't overwrite the run that replaced it.
  private readonly claim: number | null;

  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly rowId: string,
    readonly deckHash: string,
    private readonly fallbackName: string,
    private state: AnalysisState,
  ) {
    this.claim = state.startedAt;
  }

  record(event: ProgressEvent): void {
    // Cost telemetry is a dev-only overlay; persisting it would put per-run
    // token spend in reach of anyone who reopens their own report.
    if (event.type === "usage") return;
    // Otherwise the same reducer the client renders from, so the saved state
    // and the live one can't drift apart.
    this.state = streamReducer(this.state, { type: "event", event });
    this.scheduleFlush();
  }

  async finish(): Promise<void> {
    if (this.settled) return;
    this.settle();

    await this.write({
      status: "done",
      state: this.state,
      name: this.companyName() ?? this.fallbackName,
      error: null,
      completed_at: new Date().toISOString(),
    });
  }

  async fail(message: string): Promise<void> {
    if (this.settled) return;
    this.settle();

    await this.write({
      status: "error",
      // Keep whatever the run managed to produce — a half-filled form still
      // shows what it got through before dying.
      state: this.state,
      error: message,
      completed_at: new Date().toISOString(),
    });
  }

  /**
   * Writes the partial state at most once per `FLUSH_INTERVAL_MS`, so a report
   * opened mid-run (or polled over MCP) shows progress rather than nothing.
   */
  private scheduleFlush(): void {
    if (this.settled || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      if (this.settled) return;
      const name = this.companyName();
      void this.write({ state: this.state, ...(name && { name }) });
    }, FLUSH_INTERVAL_MS);
  }

  private settle(): void {
    this.settled = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
  }

  private companyName(): string | null {
    return this.state.form.company.name.value.trim() || null;
  }

  private write(patch: Database["public"]["Tables"]["analyses"]["Update"]): Promise<void> {
    this.writes = this.writes.then(async () => {
      try {
        let query = this.supabase.from("analyses").update(patch).eq("id", this.rowId);
        if (this.claim !== null) query = query.eq("state->>startedAt", String(this.claim));
        const { error } = await query;
        if (error) console.warn("[analyses] save failed:", error.message);
      } catch (err) {
        console.warn("[analyses] save threw:", err);
      }
    });
    return this.writes;
  }
}

/**
 * A cheap abuse guard. `/api/analyze` spends Anthropic and Gemini tokens for up
 * to five minutes per call, and anonymous sign-in makes it trivial to get a
 * session, so the endpoint needs *some* ceiling. One indexed count, no extra
 * infrastructure.
 */
async function enforceRateLimit(
  supabase: SupabaseClient<Database>,
  userId: string,
  isAnonymous: boolean,
): Promise<void> {
  const limit = isAnonymous ? DAILY_LIMIT_ANONYMOUS : DAILY_LIMIT_IDENTIFIED;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("analyses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);

  // Fail open: a broken count must not block a legitimate run.
  if (error || count === null) return;

  if (count >= limit) {
    throw new RateLimitError(
      isAnonymous
        ? `You've run ${limit} analyses in the last 24 hours. Sign in to raise the limit.`
        : `You've run ${limit} analyses in the last 24 hours. Try again tomorrow.`,
    );
  }
}

function stripExtension(filename: string): string {
  return filename.replace(/\.pdf$/i, "").trim() || "Untitled deck";
}
