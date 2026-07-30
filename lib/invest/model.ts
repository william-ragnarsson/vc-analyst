import path from "node:path";
import type { InferenceSession as Session, Tensor as OrtTensor } from "onnxruntime-node";
import type { InvestVerdict, Scorecard } from "@/lib/diligence/types";

/**
 * Custom invest / don't-invest model — trained on William's 800+ reviewed decks
 * (see /playbook). A HistGradientBoosting classifier exported to ONNX, run
 * in-process via onnxruntime-node (no Python at runtime).
 *
 * Input tensor "float_input" shape [1, 7], float32, in this exact column order
 * (must match training):
 *   [team, technology, marketSize, valueProposition, competitiveAdvantage,
 *    socialImpact, funding]
 * Outputs: "label" int64 [1] (0 = pass, 1 = invest) and
 *          "probabilities" float32 [1, 2] ([:,1] = invest probability).
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

export async function predictInvest(scorecard: Scorecard): Promise<InvestVerdict> {
  // Feature vector in the exact training order.
  const features = [
    scorecard.team,
    scorecard.technology,
    scorecard.marketSize,
    scorecard.valueProposition,
    scorecard.competitiveAdvantage,
    scorecard.socialImpact,
    scorecard.funding,
  ];

  try {
    const ort = await import("onnxruntime-node");
    const session = await getSession();
    const input = new ort.Tensor("float32", Float32Array.from(features), [1, features.length]);
    const outputs = await session.run({ float_input: input });

    const probabilities = outputs["probabilities"] as OrtTensor | undefined;
    const label = outputs["label"] as OrtTensor | undefined;

    // Prefer the probability tensor ([:,1] = invest), fall back to the label.
    let probability: number | undefined;
    if (probabilities && probabilities.data.length >= 2) {
      probability = Number((probabilities.data as Float32Array)[1]);
    }
    const invest =
      probability !== undefined
        ? probability >= 0.5
        : Number((label?.data as BigInt64Array | undefined)?.[0] ?? 0) === 1;

    return { invest, available: true, probability };
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
