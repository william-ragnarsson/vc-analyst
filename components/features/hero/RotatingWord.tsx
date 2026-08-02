"use client";

import { useEffect, useState } from "react";

type RotatingWordProps = {
  words: string[];
  intervalMs?: number;
  className?: string;
};

/**
 * A single word in the headline that cycles through a list.
 *
 * Every word is rendered into the *same* grid cell, so the slot's intrinsic
 * width is that of the longest word and the headline never reflows (and never
 * re-wraps) as words swap. Only the active one is visible; the rest are
 * transparent and hidden from assistive tech, which reads the `sr-only` phrase
 * instead so the sentence still parses as a sentence.
 */
export default function RotatingWord({ words, intervalMs = 2400, className = "" }: RotatingWordProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (words.length < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(timer);
  }, [words.length, intervalMs]);

  return (
    <>
      <span className="sr-only">{words.join(", ")}</span>
      <span aria-hidden className="inline-grid overflow-hidden py-[0.12em] align-bottom">
        {words.map((word, i) => (
          <span
            key={word}
            className={
              "col-start-1 row-start-1 whitespace-nowrap text-left " +
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
