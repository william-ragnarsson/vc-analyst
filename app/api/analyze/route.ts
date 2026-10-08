import type { ProgressEvent } from "@/lib/diligence/types";
import { RateLimitError, startRecording } from "@/lib/analyses/persist";
import { logEvent, runAnalysis } from "@/lib/analyses/run";
import { getSampleDeck } from "@/lib/samples/airbnb";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

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

      // Serialize one event to an NDJSON line and enqueue it. Guarded: if the
      // client disconnected (controller closed), stop trying to enqueue instead
      // of throwing — the run itself carries on and still gets saved.
      const enqueue = (event: ProgressEvent) => {
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

      // For failures before the pipeline starts, which have nothing to save.
      const reject = (message: string) => {
        const event: ProgressEvent = { type: "error", message };
        logEvent("[analyze]", event);
        enqueue(event);
      };

      try {
        const form = await req.formData();
        const sampleId = form.get("sample");

        // Two ways in: an uploaded PDF, or one of the built-in sample decks.
        // They differ only in where the bytes and the text come from — a sample
        // is read off disk and its text is already extracted (see
        // lib/samples/airbnb.ts), so it skips the extractor chain and its 29
        // pages of vision OCR entirely. Both still persist identically.
        let buffer: Buffer;
        let name: string;
        let deckText: string | null = null;

        if (typeof sampleId === "string") {
          const sample = getSampleDeck(sampleId);
          if (!sample) return reject("Unknown sample deck.");
          console.log("[analyze] 📎 sample:", sample.label);
          // Read purely so the run is saved and the deck lands in Storage like
          // any other: the expensive half, extraction, is already done.
          buffer = await readFile(join(process.cwd(), "public", sample.pdfPath));
          name = sample.label;
          deckText = sample.deckText;
        } else {
          const file = form.get("file");

          if (!(file instanceof File)) return reject("No PDF uploaded.");
          if (file.type !== "application/pdf") return reject("File must be a PDF.");

          buffer = Buffer.from(await file.arrayBuffer());
          name = file.name;
        }

        // Claims the row and uploads the deck before any tokens are spent, so
        // an abandoned run still leaves a trace the user can come back to.
        let recorder;
        try {
          recorder = await startRecording(buffer, name);
        } catch (err) {
          if (err instanceof RateLimitError) return reject(err.message);
          throw err;
        }

        await runAnalysis({
          deck: deckText === null ? { pdf: buffer } : { text: deckText },
          recorder,
          onEvent: enqueue,
          signal: req.signal,
          logTag: "[analyze]",
        });
      } catch (err) {
        // Only the request parsing above can land here — runAnalysis never throws.
        console.error("[analyze] failed:", err);
        reject("Analysis failed. Please try again.");
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
