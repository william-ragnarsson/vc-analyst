import { extractDeckText } from "@/lib/pdf/extract";
import { loadPlaybook } from "@/lib/playbook/load";
import { getDiligenceEngine } from "@/lib/diligence/engine";
import { EmptyDeckError } from "@/lib/diligence/types";
import type { ProgressEvent } from "@/lib/diligence/types";
import { costOf } from "@/lib/llm/pricing";

const SHOW_COSTS = process.env.NODE_ENV !== "production";

export const runtime = "nodejs";
export const maxDuration = 300; // web research can take a while

/**
 * Streams the analysis as NDJSON: one JSON `ProgressEvent` per line. The client
 * reads the stream and renders live progress; the final line is either a
 * `{ type: "report" }` or `{ type: "error" }` event. Keeping bytes flowing also
 * prevents proxies from killing the long-lived connection mid-research.
 */
export async function POST(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;

      // Serialize one event to an NDJSON line, log it server-side, and enqueue.
      // Guarded: if the client disconnected (controller closed), keep logging
      // server-side but stop trying to enqueue instead of throwing.
      const send = (event: ProgressEvent) => {
        if (event.type === "report") {
          console.log("[analyze] ▸ report ready");
        } else if (event.type === "error") {
          console.log("[analyze] ✖ error:", event.message);
        } else if (event.type === "search") {
          console.log("[analyze] 🔎 search:", event.query);
        } else if (event.type === "source") {
          console.log("[analyze] 📄 source:", event.title, "—", event.url);
        } else if (event.type === "field") {
          console.log("[analyze] ✓ field:", event.key);
        } else if (event.type === "verdict") {
          const v = event.verdict;
          console.log("[analyze] ⚖ verdict:", v.available ? (v.invest ? "INVEST" : "PASS") : "(stub)");
        } else if (event.type === "note") {
          // High-frequency note deltas — don't log each one server-side.
        } else if (event.type === "feedback") {
          console.log("[analyze] 📝 feedback:", event.item.severity, "—", event.item.title);
        } else if (event.type === "usage") {
          console.log(`[analyze] 💰 usage: ${event.stage} $${event.costUsd.toFixed(4)}`);
        } else {
          console.log("[analyze] •", event.phase, "—", event.message);
        }
        // Usage events are a dev-only feature — never let them reach a
        // production client, regardless of what's enqueued elsewhere.
        if (event.type === "usage" && !SHOW_COSTS) return;
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          closed = true; // client went away — stop enqueuing, let work finish
        }
      };

      try {
        const form = await req.formData();
        const file = form.get("file");

        if (!(file instanceof File)) {
          send({ type: "error", message: "No PDF uploaded." });
          return;
        }
        if (file.type !== "application/pdf") {
          send({ type: "error", message: "File must be a PDF." });
          return;
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const deckText = await extractDeckText(buffer, (usage) =>
          send({ type: "usage", stage: "ocr", usage, costUsd: costOf(usage) }),
        );
        const playbook = loadPlaybook();

        const report = await getDiligenceEngine().run({ deckText, playbook }, send, req.signal);
        send({ type: "report", report });
      } catch (err) {
        if (req.signal.aborted) {
          // Explicit stop or client disconnect — the pipeline already stopped
          // mid-stage; nothing more to report.
          console.log("[analyze] ⏹ aborted");
        } else if (err instanceof EmptyDeckError) {
          send({ type: "error", message: err.message });
        } else if (
          err instanceof Error &&
          /(API_?KEY is not set|is not a recognised model id)/i.test(err.message)
        ) {
          // Surface the engine's own config message (missing API key, or an
          // unrecognised model id from envModel) so the fix is obvious.
          send({ type: "error", message: err.message });
        } else {
          console.error("[analyze] failed:", err);
          send({ type: "error", message: "Analysis failed. Please try again." });
        }
      } finally {
        if (!closed) {
          try {
            controller.close();
          } catch {
            /* already closed by the client — nothing to do */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
