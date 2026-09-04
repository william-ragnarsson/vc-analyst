"use client";

import type { RefObject } from "react";
import Footer from "@/components/layout/Footer";
import ChaptersNav from "./ChaptersNav";
import { REPORT_SECTIONS } from "./reportSections";
import type { AnalysisState } from "@/lib/diligence/stream-state";

/**
 * The results layout: a sticky "chapters" nav beside a single column of
 * full-width sections stacked top to bottom (verdict → feedback → scorecard →
 * research → document, driven by the REPORT_SECTIONS registry). Everything is
 * visible at once — the nav gives structure and lets you jump around a long,
 * calmly-spaced scroll. Used for both the live run and the finished report.
 */
export default function ReportView({
  state,
  active,
  scrollRef,
}: {
  state: AnalysisState;
  active: boolean;
  scrollRef: RefObject<HTMLElement | null>;
}) {
  const sections = REPORT_SECTIONS.filter((s) => s.available(state, active));

  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-4 lg:grid-cols-[190px_minmax(0,1fr)] lg:gap-10">
      <ChaptersNav sections={sections} scrollRef={scrollRef} />
      <div className="min-w-0 space-y-8">
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            {s.render(state, active)}
          </section>
        ))}
        <Footer />
      </div>
    </div>
  );
}
