/**
 * SevenFold's MCP server: the tools Claude calls once someone connects it.
 *
 * Claude can't hand a chat attachment to a remote server, so it reads the deck
 * itself and sends the text; from there a run is the same pipeline, the same
 * row and the same report page as an upload on the site (`lib/analyses/run.ts`).
 *
 * A run takes minutes; a tool call can't. claude.ai gives a call about four
 * minutes, and Claude Code gives up on a server that's quiet for too long. So
 * a call waits at most `WAIT_MS` with progress notifications going out, and
 * hands back an `analysis_id` if the run isn't done by then. The run itself
 * carries on past the response (`after()`), saving to the user's row as it
 * goes, and `get_analysis` picks it up from there.
 *
 * Every query runs as the signed-in user, with their own token, so RLS keeps
 * each person to their own analyses exactly as it does on the site.
 */

import { after } from "next/server";
import { z } from "zod";
import { getPublicOrigin, type McpHandlerOptions } from "mcp-handler";
import type { CallToolResult, McpServer, ServerContext } from "@modelcontextprotocol/server";
import { hashBytes } from "@/lib/analyses/hash";
import { renderProgress, renderReport } from "@/lib/analyses/markdown";
import { RateLimitError, recordFor, type AnalysisOwner, type AnalysisRecorder } from "@/lib/analyses/persist";
import { runAnalysis, type AnalysisOutcome } from "@/lib/analyses/run";
import { isStalled, runStartedAt, STALLED_MESSAGE } from "@/lib/analyses/status";
import { initialState, streamReducer, type AnalysisState } from "@/lib/diligence/stream-state";
import { MIN_DECK_CHARS } from "@/lib/pdf/extract";
import { OCR_INSTRUCTION } from "@/lib/pdf/extractors/instruction";
import { createSupabaseClientForToken } from "@/lib/supabase/token";
import type { AnalysisStatus } from "@/lib/supabase/types";

/** Longest a single call waits on a run before handing back an `analysis_id`. */
const WAIT_MS = 50_000;
/** How often progress goes out while a call waits. */
const PROGRESS_EVERY_MS = 5_000;
/** How often `get_analysis` re-reads the row while it waits. */
const POLL_EVERY_MS = 3_000;
/** A run's hard stop: inside `maxDuration` (300 s), with room for the final save. */
const RUN_DEADLINE_MS = 285_000;
/** A generous ceiling for a transcribed deck; a 40-slide deck is a fraction of it. */
const MAX_DECK_CHARS = 150_000;

const HASH = /^[0-9a-f]{64}$/;

export const SERVER_OPTIONS: McpHandlerOptions = {
  serverInfo: { name: "sevenfold", version: "1.0.0" },
  instructions: [
    "SevenFold runs venture-capital due diligence on a startup pitch deck: it reads the deck,",
    "researches the company on the web, fills in a full diligence form, scores it, and gives an",
    "invest/pass verdict with feedback on the deck. Reports are saved to the user's SevenFold account.",
    "",
    "When the user shares a pitch deck:",
    "1. Transcribe the whole deck yourself, slide by slide, keeping every number, name and label",
    "   exactly as written, including chart and table values. Don't summarize: the analysis can only",
    "   use what you send.",
    "2. Call analyze_deck with that text as deck_text and the file name as deck_name.",
    "3. A run takes 2–4 minutes. If analyze_deck returns an analysis_id instead of a report, call",
    "   get_analysis with it, again each time it says the run is still going, until the report arrives.",
    "4. Lead with the verdict and scorecard, then the biggest risks and strengths, and share the",
    "   link to the full interactive report.",
    "",
    "The same deck text is only analyzed once: calling analyze_deck again returns the saved report",
    "unless rerun is true. list_analyses shows what the user has already analyzed.",
  ].join("\n"),
};

const DECK_TRANSCRIPTION = `${OCR_INSTRUCTION} Mark where each slide starts ("Slide 1", "Slide 2", ...).`;

export function registerSevenFold(server: McpServer): void {
  server.registerTool(
    "analyze_deck",
    {
      title: "Analyze a pitch deck",
      description: [
        "Run SevenFold's due diligence on a startup pitch deck and return the report: an invest/pass",
        "verdict, a 1–5 scorecard, the full diligence form with web research, and deck feedback.",
        "deck_text must be a complete transcription of the deck, slide by slide, with every number,",
        "name and label exactly as written: the analysis sees nothing else. A run takes 2–4 minutes;",
        "if it isn't done within about a minute this returns an analysis_id to pass to get_analysis.",
        "Analyzing the same text again returns the saved report unless rerun is true.",
      ].join(" "),
      inputSchema: z.object({
        deck_text: z
          .string()
          .describe("The full text of the pitch deck, transcribed slide by slide. Not a summary."),
        deck_name: z
          .string()
          .max(200)
          .optional()
          .describe('A name for the report, usually the file name, e.g. "Acme seed deck.pdf".'),
        rerun: z
          .boolean()
          .optional()
          .describe("Analyze again even if this deck already has a finished report. Uses up a run."),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    (args, ctx) => analyzeDeck(args, ctx),
  );

  server.registerTool(
    "get_analysis",
    {
      title: "Get an analysis",
      description: [
        "Fetch a SevenFold analysis by its analysis_id. If it's still running this waits up to",
        "wait_seconds for it to finish, then returns the full report, or the progress so far with a",
        "note to call again.",
      ].join(" "),
      inputSchema: z.object({
        analysis_id: z
          .string()
          .regex(HASH, "analysis_id is the 64-character id analyze_deck or list_analyses returned.")
          .describe("The analysis_id from analyze_deck or list_analyses."),
        wait_seconds: z
          .number()
          .int()
          .min(0)
          .max(WAIT_MS / 1000)
          .optional()
          .describe(`How long to wait for a running analysis to finish. Defaults to ${WAIT_MS / 1000}.`),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args, ctx) => getAnalysis(args, ctx),
  );

  server.registerTool(
    "list_analyses",
    {
      title: "List analyses",
      description: "List the pitch decks this SevenFold account has analyzed, newest first, with their analysis_id.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional().describe("How many to list. Defaults to 20."),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    (args, ctx) => listAnalyses(args, ctx),
  );

  server.registerPrompt(
    "analyze",
    {
      title: "Analyze a pitch deck with SevenFold",
      description: "Run SevenFold due diligence on the pitch deck attached to the conversation.",
    },
    () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Run SevenFold due diligence on the pitch deck I've attached. If there's no deck in the",
              "conversation, ask me to attach one (a PDF) and stop there.",
              "",
              `1. Transcribe the deck: ${DECK_TRANSCRIPTION}`,
              "2. Call analyze_deck with the transcription as deck_text and the file name as deck_name.",
              "3. If it returns an analysis_id rather than a report, keep calling get_analysis with it until",
              "   the report is ready.",
              "4. Give me the verdict and the scorecard first, then the three biggest risks and the strongest",
              "   points, and end with the link to the full report.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}

// ─────────────────────────────── Tools ───────────────────────────────

async function analyzeDeck(
  { deck_text, deck_name, rerun }: { deck_text: string; deck_name?: string; rerun?: boolean },
  ctx: ServerContext,
): Promise<CallToolResult> {
  const owner = ownerOf(ctx);
  const text = deck_text.trim();
  if (text.length < MIN_DECK_CHARS) {
    throw new Error(
      "deck_text is too short to be a pitch deck. Transcribe the whole deck, slide by slide, and send all of it.",
    );
  }
  if (text.length > MAX_DECK_CHARS) {
    throw new Error(
      `deck_text is ${text.length.toLocaleString("en-US")} characters; the limit is ${MAX_DECK_CHARS.toLocaleString("en-US")}. Send the deck's own text only.`,
    );
  }
  const name = deck_name?.trim() || "Untitled deck";

  // Same id the run would get (recordFor hashes the same bytes), so a deck
  // Claude already sent is found before any money is spent on it again.
  const hash = await hashBytes(new TextEncoder().encode(text));
  const existing = await readRow(owner, hash);
  if (existing?.status === "done" && existing.state && !rerun) {
    return reportResult(existing.state, existing.name, hash, ctx);
  }
  if (existing?.status === "running" && !isStalled(existing.status, startOf(existing))) {
    // Already under way — Claude retried, or a second chat sent the same deck.
    // Wait on that run instead of paying for another.
    return waitForRow(owner, hash, WAIT_MS, ctx);
  }

  let recorder: AnalysisRecorder;
  try {
    recorder = await recordFor(owner, { text, filename: name });
  } catch (err) {
    if (err instanceof RateLimitError) throw new Error(err.message);
    throw err;
  }
  if (!recorder.deckHash) {
    // Without a row get_analysis has nothing to find, and the report would be
    // lost the moment this call returns: better not to spend the run at all.
    throw new Error("Couldn't save a new analysis to your SevenFold account, so it wasn't started. Try again.");
  }

  let state = initialState();
  const startedAt = state.startedAt ?? Date.now();

  const run = runAnalysis({
    deck: { text },
    recorder,
    // Not ctx.mcpReq.signal: that fires when this call returns, and the run is
    // meant to outlive it. Only the deadline stops it.
    signal: AbortSignal.timeout(RUN_DEADLINE_MS),
    logTag: "[mcp]",
    onEvent: (event) => {
      if (event.type !== "usage") state = streamReducer(state, { type: "event", event });
    },
  });
  keepAlive(run);

  const progress = progressReporter(ctx);
  void progress(describe(state));
  const ticker = setInterval(() => void progress(describe(state)), PROGRESS_EVERY_MS);
  let outcome: AnalysisOutcome | null;
  try {
    outcome = await Promise.race([run, sleep(WAIT_MS).then(() => null)]);
  } finally {
    clearInterval(ticker);
  }

  if (!outcome) return textResult(renderProgress(state, progressArgs(ctx, hash, name, startedAt)));
  if (!outcome.ok) return errorResult(outcome.message);
  return reportResult(state, name, hash, ctx);
}

async function getAnalysis(
  { analysis_id, wait_seconds }: { analysis_id: string; wait_seconds?: number },
  ctx: ServerContext,
): Promise<CallToolResult> {
  const waitMs = (wait_seconds ?? WAIT_MS / 1000) * 1000;
  return waitForRow(ownerOf(ctx), analysis_id, waitMs, ctx);
}

async function listAnalyses({ limit }: { limit?: number }, ctx: ServerContext): Promise<CallToolResult> {
  const { supabase } = ownerOf(ctx);
  const { data, error } = await supabase
    .from("analyses")
    .select("deck_hash, name, status, state->startedAt, created_at, completed_at, error")
    .order("created_at", { ascending: false })
    .limit(limit ?? 20);
  if (error) {
    console.error("[mcp] list failed:", error.message);
    throw new Error("Couldn't load your analyses. Try again.");
  }

  const rows = data as unknown as {
    deck_hash: string;
    name: string;
    status: AnalysisStatus;
    startedAt: number | null;
    created_at: string;
    completed_at: string | null;
    error: string | null;
  }[];
  if (rows.length === 0) return textResult("No analyses yet. Share a pitch deck to run the first one.");

  const origin = originOf(ctx);
  const lines = rows.map((row) => {
    const stalled = isStalled(row.status, runStartedAt(row.startedAt, row.created_at));
    const status = row.status === "done" ? "done" : row.status === "error" || stalled ? "failed" : "running";
    const when = (row.completed_at ?? row.created_at).slice(0, 10);
    return `- **${row.name}** — ${status}, ${when} — analysis_id: \`${row.deck_hash}\` — ${reportUrl(origin, row.deck_hash)}`;
  });
  return textResult([`${rows.length} most recent analyses:`, "", ...lines].join("\n"));
}

// ─────────────────────────────── Helpers ───────────────────────────────

interface Row {
  name: string;
  status: AnalysisStatus;
  state: AnalysisState | null;
  error: string | null;
  created_at: string;
}

async function readRow({ supabase }: AnalysisOwner, hash: string): Promise<Row | null> {
  const { data, error } = await supabase
    .from("analyses")
    .select("name, status, state, error, created_at")
    .eq("deck_hash", hash)
    .maybeSingle();
  if (error) {
    console.error("[mcp] read failed:", error.message);
    throw new Error("Couldn't read the analysis. Try again.");
  }
  return data as Row | null;
}

function startOf(row: Row): number {
  return runStartedAt(row.state?.startedAt, row.created_at);
}

/**
 * Re-reads the row until the run behind it is over or `waitMs` passes, and
 * returns whichever of report, failure or progress it ends on.
 */
async function waitForRow(owner: AnalysisOwner, hash: string, waitMs: number, ctx: ServerContext): Promise<CallToolResult> {
  const progress = progressReporter(ctx);
  const deadline = Date.now() + waitMs;

  for (;;) {
    const row = await readRow(owner, hash);
    if (!row) {
      return errorResult("No analysis with that analysis_id on this account. list_analyses shows the ones that exist.");
    }
    if (row.status === "done") {
      if (row.state) return reportResult(row.state, row.name, hash, ctx);
      return errorResult("This analysis finished but its report wasn't saved. Run analyze_deck again with rerun: true.");
    }
    if (row.status === "error") return errorResult(row.error || "This analysis failed. Run it again.");
    if (isStalled(row.status, startOf(row))) return errorResult(STALLED_MESSAGE);

    const left = deadline - Date.now();
    if (left <= 0) {
      return textResult(renderProgress(row.state, progressArgs(ctx, hash, row.name, startOf(row))));
    }
    await progress(row.state ? describe(row.state) : "Starting…");
    await sleep(Math.min(POLL_EVERY_MS, left));
  }
}

/** The signed-in user, from the token `app/mcp/route.ts` verified. */
function ownerOf(ctx: ServerContext): AnalysisOwner {
  const auth = ctx.http?.authInfo;
  const userId = auth?.extra?.userId;
  if (!auth || typeof userId !== "string") {
    // withMcpAuth turns tokenless requests away before they get here.
    throw new Error("Not signed in to SevenFold. Reconnect the SevenFold connector and try again.");
  }
  return {
    supabase: createSupabaseClientForToken(auth.token),
    userId,
    isAnonymous: auth.extra?.isAnonymous === true,
  };
}

function reportResult(state: AnalysisState, name: string, hash: string, ctx: ServerContext): CallToolResult {
  return textResult(renderReport(state, { url: reportUrl(originOf(ctx), hash), name }));
}

function progressArgs(ctx: ServerContext, hash: string, name: string, startedAt: number) {
  return { url: reportUrl(originOf(ctx), hash), name, analysisId: hash, startedAt };
}

/** One line of where a run is up to, for progress notifications. */
function describe(state: AnalysisState): string {
  const step = state.steps.find((s) => s.status === "active")?.label ?? "Working";
  return `${step}… ${state.filledCount} fields filled, ${state.sourceCount} web sources`;
}

/**
 * Sends `notifications/progress` at most every `PROGRESS_EVERY_MS`, if the
 * client asked for progress. Progress is seconds waited so far, so it only
 * ever goes up, as the spec requires.
 */
function progressReporter(ctx: ServerContext): (message: string) => Promise<void> {
  const token = ctx.mcpReq._meta?.progressToken;
  const start = Date.now();
  let last = -Infinity;
  return async (message) => {
    const now = Date.now();
    if (token === undefined || now - last < PROGRESS_EVERY_MS) return;
    last = now;
    try {
      await ctx.mcpReq.notify({
        method: "notifications/progress",
        params: { progressToken: token, progress: Math.round((now - start) / 1000), message },
      });
    } catch {
      // The client hung up. The wait loop ends on its own; the run is unaffected.
    }
  };
}

/** Keeps the function alive until the run is over, after the response has gone. */
function keepAlive(run: Promise<unknown>): void {
  try {
    after(run);
  } catch {
    // Outside a request (a script, a test): the promise runs on regardless.
  }
}

/** The site's own origin, so report links point wherever this server is running. */
function originOf(ctx: ServerContext): string {
  const req = ctx.http?.req;
  return req ? getPublicOrigin(req) : (process.env.NEXT_PUBLIC_SITE_URL ?? "https://vcanalyst.williamragnarsson.dev");
}

function reportUrl(origin: string, hash: string): string {
  return `${origin}/due-diligence/${hash}`;
}

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}
