"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The training data, as the thing it actually was: a spreadsheet.
 *
 * The deal contents are redacted, which is the point rather than a limitation.
 * This is other people's confidential deal data, and a section arguing that the
 * dataset is proprietary shouldn't then display it. What stays legible is the
 * *structure*: the signal columns, their 1-5 scale, and an invest-or-pass call
 * on every row. That's the whole claim, and it's the part that can be shown.
 *
 * So: no fabricated company names or notes, blurred or otherwise. Redaction
 * bars, and every legible value is real vocabulary, being the scale from
 * `lib/invest/model.ts` and the two labels the classifier predicts.
 *
 * One row updates every couple of seconds so the sheet reads as a log being
 * kept rather than a screenshot. The values are illustrative either way, so
 * shuffling them asserts nothing new.
 */

type Row = { bars: [string, string]; team: number; market: number; invest: boolean };

// The server renders exactly this, and so does the first client paint. Randomising
// during render would mismatch on hydration, so the shuffling starts in an effect.
const INITIAL: Row[] = [
  { bars: ["68%", "82%"], team: 4, market: 3, invest: true },
  { bars: ["54%", "60%"], team: 2, market: 4, invest: false },
  { bars: ["76%", "71%"], team: 5, market: 5, invest: true },
  { bars: ["61%", "88%"], team: 3, market: 2, invest: false },
  { bars: ["83%", "56%"], team: 4, market: 4, invest: true },
  { bars: ["58%", "79%"], team: 2, market: 3, invest: false },
  { bars: ["72%", "65%"], team: 3, market: 4, invest: false },
  { bars: ["65%", "84%"], team: 5, market: 4, invest: true },
];

const BAR_WIDTHS = ["52%", "58%", "64%", "70%", "76%", "82%", "88%"];
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const rating = () => 1 + Math.floor(Math.random() * 5);

function Bar({ width }: { width: string }) {
  return (
    <span
      className="block h-2.5 rounded-full bg-ink/12 transition-[width] duration-500 ease-out"
      style={{ width }}
    />
  );
}

export default function DealLog() {
  const [rows, setRows] = useState(INITIAL);
  // Which row last changed, and a counter that remounts its cells so the CSS
  // animation replays even when the same row is picked twice in a row.
  const [flash, setFlash] = useState({ row: -1, tick: 0 });
  const tick = useRef(0);

  useEffect(() => {
    // The whole effect is the motion, so reduced-motion means not starting it,
    // not just suppressing the highlight. The sheet stays on INITIAL.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      const i = Math.floor(Math.random() * INITIAL.length);
      setRows((prev) =>
        prev.map((r, n) =>
          n === i
            ? // Weighted toward pass, both because that's what a deal log
              // actually looks like and because it keeps INVEST as the rare
              // green mark rather than letting the column drift solid.
              { bars: [pick(BAR_WIDTHS), pick(BAR_WIDTHS)], team: rating(), market: rating(), invest: Math.random() < 0.3 }
            : r,
        ),
      );
      tick.current += 1;
      setFlash({ row: i, tick: tick.current });
    }, 2200);

    return () => clearInterval(id);
  }, []);

  const cell = (i: number) => (i === flash.row ? "cell-pop" : "");
  const cellKey = (i: number, name: string) => (i === flash.row ? `${name}-${flash.tick}` : name);

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/12 bg-white shadow-[0_40px_80px_-40px_rgba(20,19,15,0.45)]">
      {/* Nameless: three dots and nothing else. */}
      <div className="flex items-center gap-2 border-b border-ink/10 bg-paper-2/60 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-ink/15" />
      </div>

      {/* The fade is a mask rather than an overlaid gradient, so it works over
          the sheet's own alternating row tints instead of needing to match them. */}
      <div className="[mask-image:linear-gradient(to_bottom,#000_68%,transparent_100%)]">
        <table className="w-full border-collapse text-left">
          <thead>
            {/* Column letters carry the spreadsheet read now that the filename
                is gone. In the table rather than above it so they line up with
                the columns on their own. */}
            <tr className="border-b border-ink/[0.07] bg-ink/[0.02] font-mono text-[10px] text-ink/25">
              <th className="w-8 px-3 py-1 font-normal" />
              <th className="px-3 py-1 text-center font-normal">A</th>
              <th className="w-14 px-2 py-1 text-center font-normal">B</th>
              <th className="w-14 px-2 py-1 text-center font-normal">C</th>
              <th className="hidden px-3 py-1 text-center font-normal sm:table-cell">D</th>
              {/* Shifts up a letter on phones, where column D is hidden. Excel
                  would leave the gap, but out of that context "A B C E" just
                  reads as a mistake. */}
              <th className="px-3 py-1 text-center font-normal">
                <span className="sm:hidden">D</span>
                <span className="hidden sm:inline">E</span>
              </th>
            </tr>
            <tr className="border-b border-ink/10 bg-paper-2/40 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/40">
              <th className="px-3 py-2 font-normal" />
              <th className="px-3 py-2">Company</th>
              <th className="px-2 py-2 text-center">Team</th>
              <th className="px-2 py-2 text-center">Market</th>
              {/* Dropped on phones so Verdict, the column the whole section is
                  about, isn't the one that gets clipped. It's a redaction bar,
                  so nothing legible is lost. */}
              <th className="hidden px-3 py-2 sm:table-cell">Notes</th>
              <th className="px-3 py-2">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={i % 2 ? "bg-paper-2/25" : undefined}>
                <td className="px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-ink/25">
                  {i + 1}
                </td>
                <td className="px-3 py-2.5">
                  <Bar width={r.bars[0]} />
                </td>
                <td
                  key={cellKey(i, "team")}
                  className={`px-2 py-2.5 text-center font-mono text-xs tabular-nums text-ink/70 ${cell(i)}`}
                >
                  {r.team}
                </td>
                <td
                  key={cellKey(i, "market")}
                  className={`px-2 py-2.5 text-center font-mono text-xs tabular-nums text-ink/70 ${cell(i)}`}
                >
                  {r.market}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <Bar width={r.bars[1]} />
                </td>
                <td key={cellKey(i, "verdict")} className={`whitespace-nowrap px-3 py-2.5 ${cell(i)}`}>
                  <span
                    className={
                      "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                      (r.invest ? "bg-accent/10 text-accent" : "bg-ink/[0.06] text-ink/45")
                    }
                  >
                    {r.invest ? "Invest" : "Pass"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
