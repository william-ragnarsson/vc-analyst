"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAnalysis } from "@/components/features/analyze/AnalysisProvider";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/due-diligence", label: "Due Diligence" },
  { href: "/playbook", label: "Playbook" },
];

/**
 * The floating top nav — a pill fixed over the page rather than a bar in the
 * flow, so it stays reachable while scrolling. It gains a more opaque
 * background once the page moves, so it keeps its edge over dense content.
 * Shows a glowing pill while an analysis runs in the background.
 */
export default function NavBar() {
  const { status, stream, currentId } = useAnalysis();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const loading = status === "loading";
  const activeLabel = stream.steps.find((s) => s.status === "active")?.label ?? "Working";
  const doneCount = stream.steps.filter((s) => s.status === "done").length;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className="fixed inset-x-0 top-3 z-50 px-4">
      {/* Only background/border/shadow transition — animating the pill's size
          makes it jitter against the scroll. */}
      <div
        className={
          "mx-auto flex max-w-3xl items-center justify-between gap-2 rounded-full border py-2 pl-4 pr-2 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 sm:gap-4 " +
          (scrolled
            ? "border-ink/15 bg-paper/85 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_12px_32px_-12px_rgba(20,19,15,0.35)]"
            : "border-ink/10 bg-paper/70 shadow-[0_1px_2px_rgba(20,19,15,0.04),0_8px_24px_-12px_rgba(20,19,15,0.25)]")
        }
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="VC Analyst" width={28} height={28} className="rounded-md" priority />
          <span className="hidden font-semibold tracking-tight text-ink transition-opacity group-hover:opacity-60 sm:inline">
            VC Analyst
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {loading && currentId && (
            <Link
              href={`/due-diligence/${currentId}`}
              className="flex shrink-0 items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1.5 text-sm font-medium text-accent shadow-[0_0_14px_-2px_var(--accent-bright)] transition-colors hover:bg-accent/15 sm:px-3.5"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-bright opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-bright" />
              </span>
              <span className="tabular-nums">{doneCount}/{stream.steps.length}</span>
              <span className="hidden sm:inline">{activeLabel}…</span>
            </Link>
          )}
          {LINKS.map((link) => {
            const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors " +
                  (isActive ? "bg-ink/[0.06] text-ink" : "text-muted hover:bg-ink/[0.04] hover:text-ink")
                }
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
