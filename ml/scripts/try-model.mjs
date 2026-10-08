// Scores one scorecard with lib/invest/model.onnx, the way the app does
// (lib/invest/model.ts), so the model can be tried without the app, an LLM or
// the confidential CSV.
//
//   node ml/scripts/try-model.mjs <team> <tech> <market> <valueProp> <compAdv> <social> [funding]
//   node ml/scripts/try-model.mjs 4 3 4 4 3 3 750K
//
// Ratings are whole numbers 1–5. Funding is US dollars raised to date: 0 means
// nothing raised, 750K and 2.5M work too, and leaving it out means unknown.
// It also shows what one point more on each rating would do.

import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ort from "onnxruntime-node";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const NAMES = ["team", "technology", "marketSize", "valueProposition", "competitiveAdvantage", "socialImpact"];
// Same band as BORDERLINE in components/features/form/VerdictPopup.tsx.
const BORDERLINE = 0.05;

function fail(message) {
  console.error(message);
  console.error("usage: node ml/scripts/try-model.mjs <team> <tech> <market> <valueProp> <compAdv> <social> [funding]");
  process.exit(1);
}

function parseFunding(text) {
  if (text === undefined || text === "?") return Number.NaN;
  // Commas only as thousands separators: "1,5M" is refused, not read as 15M.
  const plain = /^\$?\d{1,3}(,\d{3})+(\.\d+)?[KkMm]?$/.test(text) ? text.replaceAll(",", "") : text;
  const match = /^\$?(\d+(?:\.\d+)?)([KkMm]?)$/.exec(plain);
  if (!match) fail(`funding "${text}" is not an amount like 0, 750000, 750K or 2.5M`);
  const unit = { "": 1, k: 1e3, m: 1e6 }[match[2].toLowerCase()];
  return Number(match[1]) * unit;
}

const args = process.argv.slice(2);
if (args.length < 6 || args.length > 7) fail("give six ratings and, optionally, funding");
const ratings = args.slice(0, 6).map((text, i) => {
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > 5) fail(`${NAMES[i]} must be a whole number 1–5, got "${text}"`);
  return value;
});
const funding = parseFunding(args[6]);

// Row 0 is the scorecard as given; each later row raises one rating by a point.
const rows = [[...ratings, funding]];
const raised = [];
ratings.forEach((value, i) => {
  if (value === 5) return;
  const row = [...ratings, funding];
  row[i] = value + 1;
  rows.push(row);
  raised.push(NAMES[i]);
});

const session = await ort.InferenceSession.create(path.join(root, "lib/invest/model.onnx"));
const input = new ort.Tensor("float32", Float32Array.from(rows.flat()), [rows.length, 7]);
const out = await session.run({ float_input: input });
const score = (i) => Number(out.score.data[i]);
const gate = Number(out.threshold.data[0]);
const verdict = (i) => (Number(out.invest.data[i]) === 1 ? "INVEST" : "PASS");

const fundingText = Number.isNaN(funding) ? "unknown" : `$${funding.toLocaleString("en-US")}`;
console.log(`ratings ${ratings.join(" ")}, funding ${fundingText}`);
const near = Math.abs(score(0) - gate) < BORDERLINE ? "  (borderline: within 0.05 of the gate)" : "";
console.log(`score ${score(0).toFixed(3)}  gate ${gate.toFixed(3)}  ->  ${verdict(0)}${near}`);

if (raised.length > 0) {
  console.log("\none point more on:");
  raised.forEach((name, k) => {
    const i = k + 1;
    const change = score(i) - score(0);
    const flip = verdict(i) !== verdict(0) ? `  -> ${verdict(i)}` : "";
    console.log(`  ${name.padEnd(21)} ${score(i).toFixed(3)} (${change >= 0 ? "+" : ""}${change.toFixed(3)})${flip}`);
  });
}
