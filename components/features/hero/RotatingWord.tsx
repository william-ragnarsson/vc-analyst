"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

type RotatingWordProps = {
  words: string[];
  intervalMs?: number;
  className?: string;
};

/**
 * A single word in the headline that cycles through a list.
 *
 * Every word is rendered into the same grid cell at its natural width, and the
 * slot animates to whichever one is showing, so a centred line glides to its
 * new centre instead of leaving a gap sized to the longest word. Place it at
 * the end of a line (follow it with a `<br />`) and make sure the longest word
 * fits on that line: then the width change can only move this one line, never
 * re-wrap the text after it.
 *
 * Widths are measured rather than guessed, because they depend on the loaded
 * font and the headline's font-size; the slot falls back to `auto` (the longest
 * word) until the first measurement lands, which is also what the server
 * renders.
 *
 * Only the active word is visible; the rest are transparent and hidden from
 * assistive tech, which reads the `sr-only` list instead so the sentence still
 * parses as a sentence.
 */
export default function RotatingWord({ words, intervalMs = 2400, className = "" }: RotatingWordProps) {
  const [index, setIndex] = useState(0);
  const [width, setWidth] = useState<number>();
  const refs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (words.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(timer);
  }, [words.length, intervalMs]);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[index];
      if (el) setWidth(el.getBoundingClientRect().width);
    };
    measure();
    // The first measurement can land before the webfont swaps in, and the
    // headline's font-size tracks its container's width — re-measure for both.
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [index, words]);

  return (
    <>
      <span className="sr-only">{words.join(", ")}</span>
      <span
        aria-hidden
        style={{ width }}
        // `overflow-hidden` clips the incoming word's slide-up and the hidden
        // longer words. It also makes this box align by its bottom edge rather
        // than its baseline, so there's no vertical padding: with padding at
        // zero its box matches the line box exactly and the word sits on the
        // baseline with the rest of the sentence. (The clip means a word with a
        // descender would lose its tail — the current list has none.)
        className="inline-grid overflow-hidden align-bottom transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        {words.map((word, i) => (
          <span
            key={word}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={
              // w-max keeps each word at its intrinsic width even once the slot
              // is constrained, so the measurement stays the word's own width.
              "col-start-1 row-start-1 w-max whitespace-nowrap text-left " +
              (i === index ? "word-in opacity-100 " : "opacity-0 ") +
              className
            }
          >
            {word}
          </span>
        ))}
      </span>
    </>
  );
}
