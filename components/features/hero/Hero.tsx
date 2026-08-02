import AnalysisLauncher from "@/components/features/analyze/AnalysisLauncher";
import HeroReportMock from "@/components/features/hero/HeroReportMock";
import RotatingWord from "@/components/features/hero/RotatingWord";

const stats = [
  { value: "Ranked top 6", label: "Program rank of 250+" },
  { value: "800+", label: "Decks reviewed" },
  { value: "Custom-trained AI", label: "Based on 800+ real VC verdicts" },
];

/** The words that cycle through the headline — each one is something the engine scores. */
const REVIEWED = ["deck", "team", "market", "traction", "story"];

export default function Hero() {
  return (
    <section className="relative overflow-hidden rounded-[40px] border border-white/10 bg-[linear-gradient(140deg,var(--ink)_0%,var(--ink-2)_55%,#0d2a1c_100%)] px-6 py-12 shadow-[0_40px_80px_-40px_rgba(20,19,15,0.55)] ring-1 ring-inset ring-white/5 sm:px-12 sm:py-14">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-accent/30 blur-[120px]"
      />

      <div className="relative grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div>
          <div className="fade-up inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-bright" />
            Plug and Play Tech Center · San Francisco
          </div>

          <h1
            className="fade-up mt-6 text-4xl font-bold leading-[1.02] tracking-[-0.03em] text-white sm:text-5xl lg:text-[3.4rem]"
            style={{ animationDelay: "0.06s" }}
          >
            I reviewed 800+ pitch decks{" "}
            <span className="font-serif font-normal italic">as a VC</span> and trained an AI on the
            verdicts.
            <br />
            Have your <RotatingWord words={REVIEWED} className="text-accent-bright" /> reviewed the
            same way.
          </h1>

          <p
            className="fade-up mt-6 max-w-lg text-lg leading-relaxed text-white/65"
            style={{ animationDelay: "0.14s" }}
          >
            You&apos;ll get the read a VC actually gives your deck: what&apos;s strong, what&apos;s
            missing, and how you look to an investor who Googles you first.
          </p>

          <div className="fade-up mt-8" style={{ animationDelay: "0.22s" }}>
            <AnalysisLauncher tone="dark" compact />
          </div>
        </div>

        <HeroReportMock />
      </div>

      <div
        className="fade-up relative mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-white/10 pt-6"
        style={{ animationDelay: "0.3s" }}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div className="text-lg font-bold tracking-tight text-white">{s.value}</div>
            <div className="mt-0.5 text-xs text-white/50">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
