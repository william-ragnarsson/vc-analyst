// Runs lib/invest/model.onnx under onnxruntime-node — the runtime the deployed
// app uses — and compares every output with what scikit-learn produced in
// Python. `python -m invest_model.train` writes the expected values to
// ml/data/processed/parity.json (gitignored: it holds real feature rows).
//
//   node ml/scripts/check-onnx.mjs        (from the repo root, after npm install)
//
// Exits non-zero on any mismatch.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as ort from "onnxruntime-node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modelPath = path.join(root, "lib/invest/model.onnx");
const parityPath = path.join(root, "ml/data/processed/parity.json");

const { features, threshold, rows, score: expectedScore } = JSON.parse(
  readFileSync(parityPath, "utf8"),
);
const width = features.length;

const session = await ort.InferenceSession.create(modelPath);
const flat = new Float32Array(rows.length * width);
// JSON has no NaN; the Python side writes missing values as null.
rows.forEach((row, i) => row.forEach((v, j) => (flat[i * width + j] = v ?? Number.NaN)));
const out = await session.run({ float_input: new ort.Tensor("float32", flat, [rows.length, width]) });

const score = out.score.data;
const invest = out.invest.data;
const gate = out.threshold.data[0];

let maxDiff = 0;
let flips = 0;
for (let i = 0; i < rows.length; i++) {
  const diff = Math.abs(score[i] - expectedScore[i]);
  maxDiff = Math.max(maxDiff, diff);
  // Rows whose score sits within float32 noise of the gate may legitimately flip.
  const nearGate = Math.abs(expectedScore[i] - threshold) <= 1e-5;
  if (!nearGate && Number(invest[i]) !== (expectedScore[i] >= threshold ? 1 : 0)) flips++;
}

const report = {
  rows: rows.length,
  rowsWithMissing: rows.filter((r) => r.some((v) => v === null)).length,
  maxAbsScoreDiff: maxDiff,
  gateFlips: flips,
  threshold: { model: gate, expected: threshold },
  outputs: session.outputNames,
};
console.log(JSON.stringify(report, null, 2));

if (maxDiff > 1e-5 || flips > 0 || Math.abs(gate - threshold) > 1e-6) {
  console.error("ONNX parity FAILED under onnxruntime-node");
  process.exit(1);
}
console.log("ONNX parity OK under onnxruntime-node");
