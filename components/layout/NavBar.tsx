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
 * The top nav, fixed over the page rather than sitting in the flow.
 *
 * On the home page it starts *inside* the hero card — no pill chrome, light
 * text on the dark card — so the first screen reads as one surface. The moment
 * you scroll it detaches into the floating paper pill it is everywhere else.
 * Shows a glowing pill while an analysis runs in the background.
 */
export default function NavBar() {
  const { status, stream, currentId } = useAnalysis();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const loading = status === "loading";
  // Only the home page has a dark card under the nav to merge into.
  const onCard = pathname === "/" && !scrolled;
  const activeLabel = stream.steps.find((s) => s.status === "active")?.label ?? "Working";
  const doneCount = stream.steps.filter((s) => s.status === "done").length;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={"fixed inset-x-0 top-6 z-50 transition-[padding] duration-300 " + (onCard ? "px-9 sm:px-15" : "px-4")}>
      {/* Only background/border/shadow transition — animating the pill's size
          makes it jitter against the scroll. */}
      <div
        className={
          "flex items-center justify-between gap-2 rounded-full border py-2 pl-4 pr-2 backdrop-blur-xl transition-[background-color,border-color,box-shadow,max-width] duration-300 sm:gap-4 " +
          (onCard
            ? "max-w-none border-transparent bg-transparent shadow-none"
            : "mx-auto max-w-3xl border-ink/15 bg-paper/85 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_12px_32px_-12px_rgba(20,19,15,0.35)]")
        }
      >
        <Link href="/" className="group flex shrink-0 items-center gap-2">
          <Image src="/logo.png" alt="VC Analyst" width={28} height={28} className="rounded-md" priority />
          <span
            className={
              "hidden font-semibold tracking-tight transition-[color,opacity] duration-300 group-hover:opacity-60 sm:inline " +
              (onCard ? "text-white" : "text-ink")
            }
          >
            VC Analyst
          </span>
        </Link>

        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          {loading && currentId && (
            <Link
              href={`/due-diligence/${currentId}`}
              className={
                "flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1.5 text-sm font-medium shadow-[0_0_14px_-2px_var(--accent-bright)] transition-colors duration-300 sm:px-3.5 " +
                (onCard
                  ? "border-accent-bright/40 bg-accent-bright/10 text-accent-bright hover:bg-accent-bright/20"
                  : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15")
              }
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
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors duration-300 " +
                  (onCard
                    ? isActive
                      ? "bg-white/10 text-white"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                    : isActive
                      ? "bg-ink/[0.06] text-ink"
                      : "text-muted hover:bg-ink/[0.04] hover:text-ink")
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
