import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";
import HeroReportMock from "@/components/features/hero/HeroReportMock";
import RotatingWord from "@/components/features/hero/RotatingWord";

const stats = [
  { value: "800+ pitch decks", label: "Reviewed by hand, as a VC" },
  { value: "Custom-trained AI", label: "Built on 800+ real verdicts" },
  { value: "Top 6 of 250+", label: "Plug and Play Tech Center, SF" },
  { value: "Free, no sign-up", label: "No account, no card, no catch" },
];

/** The words that cycle through the headline — each one is something the engine scores. */
const REVIEWED = ["deck", "team", "market", "traction", "story"];

export default function Hero() {
  return (
    // The card is the first screen: it fills the viewport (minus the wrapper's
    // gutter) so nothing important sits below the fold on load, and its top
    // padding leaves room for the nav, which floats over it until you scroll.
    <section className="relative flex min-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(140deg,var(--ink)_0%,var(--ink-2)_55%,#0d2a1c_100%)] px-6 pb-6 pt-[4.5rem] shadow-[0_40px_80px_-40px_rgba(20,19,15,0.55)] ring-1 ring-inset ring-white/5 sm:px-12 sm:pb-10 sm:pt-28">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/30 blur-[120px]"
      />

      <div className="relative grid flex-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
        <div>
          <h1 className="fade-up text-[2rem] font-bold leading-[1.04] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.4rem]">
            I reviewed 800+ pitch decks{" "}
            <span className="font-serif font-normal italic">as a VC</span> and trained an AI on the
            verdicts.
            <br />
            Have your <RotatingWord words={REVIEWED} className="text-accent-bright" /> reviewed the
            same way.
          </h1>

          <div className="fade-up mt-8 max-w-xl lg:mt-10" style={{ animationDelay: "0.12s" }}>
            <AnalysisLauncher tone="dark" compact />
          </div>
        </div>

        <HeroReportMock />
      </div>

      <div
        className="fade-up relative mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-white/10 pt-5 lg:mt-10 lg:pt-6 lg:grid-cols-4 lg:divide-x lg:divide-white/10"
        style={{ animationDelay: "0.2s" }}
      >
        {stats.map((s, i) => (
          <div key={s.label} className={i === 0 ? "lg:pr-6" : "lg:px-6"}>
            <div className="text-base font-bold tracking-tight text-white lg:text-lg">{s.value}</div>
            <div className="mt-0.5 text-xs text-white/50">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
