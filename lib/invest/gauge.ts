/**
 * Score and gate on a 0–100 scale, with just enough decimals that a pass never
 * prints as "score 41 · gate 41". Rounding never reverses order, so two
 * different strings always compare the same way the raw numbers do.
 *
 * Shared by the verdict banner and the MCP report, so both print the same
 * numbers.
 */
export function formatGauge(score: number, gate: number): { score: string; gate: string } {
  for (let digits = 0; digits < 3; digits++) {
    const s = (score * 100).toFixed(digits);
    const g = (gate * 100).toFixed(digits);
    if (s !== g || score === gate) return { score: s, gate: g };
  }
  return { score: (score * 100).toFixed(3), gate: (gate * 100).toFixed(3) };
}
