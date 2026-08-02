"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";
import Footer from "./Footer";

/**
 * The chrome around every page: nav, the page itself, and (optionally) the
 * footer. It also owns the scroll model, which differs in one place:
 *
 * - Normal pages scroll the document — the shell is `min-h-dvh` and grows with
 *   content, so there's a single (body) scrollbar.
 * - The report detail page (/due-diligence/[id]) has its own full-height inner
 *   scroll box and bakes its own footer into ReportView. There the shell is
 *   locked to exactly `h-dvh` with `overflow-hidden`, so the body never scrolls
 *   and the inner box is the *only* scroll region. Without this lock the body
 *   would overflow (by `main`'s bottom padding) and produce a second scrollbar.
 */
export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isReportPage = /^\/due-diligence\/.+/.test(pathname);
  const isHome = pathname === "/";

  return (
    <div
      className={
        "relative z-10 flex flex-col " +
        (isReportPage ? "h-dvh overflow-hidden" : "min-h-dvh")
      }
    >
      <NavBar />
      {/* The nav is `fixed`, so it contributes no height. This spacer stands in
          for it *in the flow*, which keeps the report page's h-dvh arithmetic
          above intact — padding on `main` would push the inner scroll box past
          the viewport and produce the second scrollbar that lock exists to
          avoid. The home page skips it: its hero card starts at the very top
          and reserves the clearance in its own padding, because the nav sits
          inside the card until you scroll. */}
      {!isHome && <div aria-hidden className="h-20 shrink-0" />}
      {/* Pages set their own max-width — the report page needs to run wider. */}
      <main className={"min-h-0 flex-1 " + (isReportPage ? "" : "pb-24")}>{children}</main>
      {!isReportPage && <Footer />}
    </div>
  );
}
