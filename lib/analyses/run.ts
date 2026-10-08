/**
 * Runs one analysis end to end: deck text → diligence pipeline → saved report.
 *
 * Shared by the two ways in. `/api/analyze` streams every event to the browser
 * as it happens; the MCP route (`app/mcp/route.ts`) only cares how it ends, and
 * lets the run outlive the request that started it. Both get identical
 * extraction, error messages, and persistence from here.
 */

import { extractDeckText } from "@/lib/pdf/extract";
import { loadPlaybook } from "@/lib/playbook/load";
import { getDiligenceEngine } from "@/lib/diligence/engine";
import { EmptyDeckError } from "@/lib/diligence/types";
import type { DueDiligenceForm, ProgressEvent } from "@/lib/diligence/types";
import { costOf } from "@/lib/llm/pricing";
import type { AnalysisRecorder } from "@/lib/analyses/persist";

export type AnalysisOutcome =
  | { ok: true; report: DueDiligenceForm }
  | { ok: false; message: string };

export interface RunAnalysisArgs {
  /** Where the deck text comes from: already extracted, or a PDF to extract. */
  deck: { text: string } | { pdf: Buffer };
  recorder: AnalysisRecorder;
  /** Called with every event, after the recorder has seen it. */
  onEvent?: (event: ProgressEvent) => void;
  /** Aborting stops the pipeline between stages and marks the run failed. */
  signal?: AbortSignal;
  /** Prefix for the server log lines, e.g. "[analyze]". */
  logTag?: string;
}

/**
 * Never throws. Every failure is reported to `onEvent` as an `error` event,
 * saved to the row via `recorder.fail`, and returned as `{ ok: false }`.
 */
export async function runAnalysis({
  deck,
  recorder,
  onEvent,
  signal,
  logTag = "[analyze]",
}: RunAnalysisArgs): Promise<AnalysisOutcome> {
  const send = (event: ProgressEvent) => {
    logEvent(logTag, event);
    // Fold into the saved report first: a client that disconnects mid-run
    // should still find a finished analysis waiting.
    recorder.record(event);
    onEvent?.(event);
  };

  const failWith = async (message: string): Promise<AnalysisOutcome> => {
    send({ type: "error", message });
    await recorder.fail(message);
    return { ok: false, message };
  };

  try {
    const deckText =
      "text" in deck
        ? deck.text
        : await extractDeckText(deck.pdf, (usage) =>
            send({ type: "usage", stage: "ocr", usage, costUsd: costOf(usage) }),
          );
    const playbook = loadPlaybook();

    const report = await getDiligenceEngine().run({ deckText, playbook }, send, signal);
    send({ type: "report", report });
    await recorder.finish();
    return { ok: true, report };
  } catch (err) {
    if (signal?.aborted) {
      // Explicit stop, client disconnect, or a deadline — the pipeline already
      // stopped mid-stage; nothing more to report.
      console.log(`${logTag} ⏹ aborted`);
      const timedOut = signal.reason instanceof DOMException && signal.reason.name === "TimeoutError";
      const message = timedOut
        ? "Analysis ran out of time before it finished. Please try again."
        : "Analysis was stopped before it finished.";
      await recorder.fail(message);
      return { ok: false, message };
    }
    if (err instanceof EmptyDeckError) return failWith(err.message);
    if (err instanceof Error && /(API_?KEY is not set|is not a recognised model id)/i.test(err.message)) {
      // Surface the engine's own config message (missing API key, or an
      // unrecognised model id from envModel) so the fix is obvious.
      return failWith(err.message);
    }
    console.error(`${logTag} failed:`, err);
    return failWith("Analysis failed. Please try again.");
  }
}

/** One readable server log line per event. */
export function logEvent(tag: string, event: ProgressEvent): void {
  if (event.type === "report") {
    console.log(`${tag} ▸ report ready`);
  } else if (event.type === "error") {
    console.log(`${tag} ✖ error:`, event.message);
  } else if (event.type === "search") {
    console.log(`${tag} 🔎 search:`, event.query);
  } else if (event.type === "source") {
    console.log(`${tag} 📄 source:`, event.title, "—", event.url);
  } else if (event.type === "field") {
    console.log(`${tag} ✓ field:`, event.key);
  } else if (event.type === "verdict") {
    const v = event.verdict;
    console.log(`${tag} ⚖ verdict:`, v.available ? (v.invest ? "INVEST" : "PASS") : "(stub)");
  } else if (event.type === "note") {
    // High-frequency note deltas — don't log each one server-side.
  } else if (event.type === "feedback") {
    console.log(`${tag} 📝 feedback:`, event.item.severity, "—", event.item.title);
  } else if (event.type === "usage") {
    console.log(`${tag} 💰 usage: ${event.stage} $${event.costUsd.toFixed(4)}`);
  } else {
    console.log(`${tag} •`, event.phase, "—", event.message);
  }
}
