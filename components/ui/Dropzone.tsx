"use client";

import { useRef, useState } from "react";

type DropzoneProps = {
  file: File | null;
  onFile: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  /** `dark` inverts the palette for the hero card's dark surface. */
  tone?: "light" | "dark";
  /** Tighter padding, for when the dropzone sits beside other content. */
  compact?: boolean;
};

const TONES = {
  light: {
    surface: "bg-white/55 backdrop-blur hover:bg-white/80",
    dash: "text-ink/20",
    dashActive: "text-accent",
    icon: "bg-ink/5 text-ink",
    iconDone: "bg-accent/10 text-accent",
    title: "text-ink",
    hint: "text-muted",
    error: "text-red-600",
  },
  dark: {
    surface: "bg-white/[0.04] hover:bg-white/[0.08]",
    dash: "text-white/20",
    dashActive: "text-accent-bright",
    icon: "bg-white/10 text-white",
    iconDone: "bg-accent-bright/15 text-accent-bright",
    title: "text-white",
    hint: "text-white/60",
    error: "text-red-400",
  },
} as const;

// Vercel's serverless functions cap request bodies at ~4.5MB regardless of
// Next.js config, so we reject oversized files here instead of letting the
// upload fail with an opaque 413 from the platform.
const MAX_SIZE_MB = 4;

/**
 * Generic file dropzone with a rounded SVG dashed border that hugs the
 * corners (a plain CSS dashed border can't follow border-radius cleanly).
 */
export default function Dropzone({
  file,
  onFile,
  accept = "application/pdf",
  disabled = false,
  tone = "light",
  compact = false,
}: DropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const t = TONES[tone];
  const iconSize = compact ? "h-10 w-10" : "h-12 w-12";

  function pick(f: File | null | undefined) {
    if (disabled) return;
    if (!f) {
      setError("");
      return onFile(null);
    }
    if (accept && !f.type.match(accept.replace("*", ".*"))) {
      setError("Unsupported file type — upload a PDF.");
      return;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File exceeds size limit: max ${MAX_SIZE_MB}MB.`);
      return;
    }
    setError("");
    onFile(f);
  }

  return (
    <div
      className={`relative rounded-3xl transition-transform ${dragging ? "dash-active scale-[1.01]" : ""} ${disabled ? "opacity-60" : ""}`}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files[0]); }}
    >
      {/* Rounded dashed border overlay. Inset via CSS on the <svg> (not a
          calc() SVG attribute — some browsers, e.g. Safari, reject calc()
          in presentation attributes) so the rect itself can use plain,
          universally-valid percentage values. */}
      <svg className="pointer-events-none absolute inset-[1.5px] h-[calc(100%-3px)] w-[calc(100%-3px)]" fill="none" aria-hidden>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          rx="22"
          ry="22"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="8 8"
          className={`dash-rect ${dragging ? t.dashActive : t.dash}`}
        />
      </svg>

      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`w-full rounded-3xl text-center transition-colors disabled:cursor-not-allowed ${t.surface} ${
          compact ? "px-6 py-8" : "px-8 py-14"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => pick(e.target.files?.[0])}
        />
        {file ? (
          <div className="space-y-2">
            <div className={`mx-auto grid place-items-center rounded-2xl text-xl ${t.iconDone} ${iconSize}`}>✓</div>
            <p className={`truncate font-semibold ${t.title}`}>{file.name}</p>
            <p className={`text-sm ${t.hint}`}>{(file.size / 1024 / 1024).toFixed(1)} MB · ready to analyze</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className={`mx-auto grid place-items-center rounded-2xl text-xl ${t.icon} ${iconSize}`}>↑</div>
            <p className={`text-lg font-semibold ${t.title}`}>Drop your pitch deck</p>
            <p className={`text-sm ${error ? t.error : t.hint}`}>
              {error || `PDF · up to ${MAX_SIZE_MB}MB · click or drag`}
            </p>
          </div>
        )}
      </button>
    </div>
  );
}
