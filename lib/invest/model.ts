import path from "node:path";
import type { InferenceSession as Session, Tensor as OrtTensor } from "onnxruntime-node";
import type { InvestVerdict, Scorecard } from "@/lib/diligence/types";

/**
 * Custom invest / don't-invest model, trained on 765 of William's 800+
 * reviewed decks (see /playbook). A HistGradientBoosting regressor exported
 * to ONNX and run in-process via onnxruntime-node (no Python at runtime). The
 * training code is in ml/ and never ships; ml/README.md explains how this
 * file is produced.
 *
 * Input "float_input": float32 [1, 7], in this exact column order (must match
 * ml/invest_model/config.py FEATURES):
 *   [team, technology, marketSize, valueProposition, competitiveAdvantage,
 *    socialImpact, funding]
 * NaN means "not known". The graph accepts it anywhere, but only funding is
 * sent as NaN: it was unknown for ~8% of training decks, so the trees learned
 * a real branch for it. A missing rating appeared in 2 of ~765 training rows,
 * so a score built on one is guesswork. An empty scorecard still lands near
 * the gate, so predictInvest refuses to score until all six ratings are in.
 *
 * Outputs, with the acceptance gate built into the graph:
 *   "score"     float32 [1, 1]  0–1, invest rate among decks scored like this
 *   "invest"    int64   [1, 1]  1 if score >= threshold, else 0
 *   "threshold" float32 [1]     the gate itself
 */

const MODEL_PATH = path.join(process.cwd(), "lib/invest/model.onnx");

// Lazy singleton — load the ONNX graph once, reuse across requests.
let sessionPromise: Promise<Session> | null = null;

async function getSession(): Promise<Session> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      const ort = await import("onnxruntime-node");
      return ort.InferenceSession.create(MODEL_PATH);
    })();
  }
  return sessionPromise;
}

/** A 1–5 rating, or NaN when the scorecard stage left it unset (0) or out of range. */
function rating(value: number): number {
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : Number.NaN;
}

export async function predictInvest(scorecard: Scorecard): Promise<InvestVerdict> {
  const ratings = [
    rating(scorecard.team),
    rating(scorecard.technology),
    rating(scorecard.marketSize),
    rating(scorecard.valueProposition),
    rating(scorecard.competitiveAdvantage),
    rating(scorecard.socialImpact),
  ];
  const unrated = ratings.filter((r) => Number.isNaN(r)).length;
  if (unrated > 0) {
    return {
      invest: false,
      available: false,
      note: `The scorecard is missing ${unrated} of 6 ratings. The model was trained on fully rated decks, so it gives no verdict without them.`,
    };
  }

  // Feature vector in the exact training order.
  const features = [
    ...ratings,
    scorecard.funding !== null && Number.isFinite(scorecard.funding) && scorecard.funding >= 0
      ? scorecard.funding
      : Number.NaN,
  ];

  try {
    const ort = await import("onnxruntime-node");
    const session = await getSession();
    const input = new ort.Tensor("float32", Float32Array.from(features), [1, features.length]);
    const outputs = await session.run({ float_input: input });

    const score = Number((outputs["score"] as OrtTensor).data[0]);
    const threshold = Number((outputs["threshold"] as OrtTensor).data[0]);
    const invest = Number((outputs["invest"] as OrtTensor).data[0]) === 1;

    return { invest, available: true, score, threshold };
  } catch (err) {
    // Surface the real cause in server logs — the verdict otherwise degrades
    // silently to "unavailable" in the UI (e.g. a missing model.onnx on Vercel).
    console.error("predictInvest failed:", err);
    return {
      invest: false,
      available: false,
      note: err instanceof Error ? `Investment model failed to run: ${err.message}` : "Investment model unavailable.",
    };
  }
}
