type SectionHeadingProps = {
  index: string;
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "center";
};

/**
 * The start of a section: a numbered eyebrow beside a rule, then the title.
 *
 * The number and the rule are doing real work — on a page with no section
 * containers, they are what tells you a new section has begun.
 */
export default function SectionHeading({
  index,
  eyebrow,
  title,
  sub,
  align = "left",
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={centered ? "flex flex-col items-center text-center" : undefined}>
      <div className={"flex items-center gap-3 " + (centered ? "w-full max-w-md" : "w-full")}>
        {centered && <span className="h-px flex-1 bg-ink/12" />}
        <span className="font-mono text-xs text-ink/35">{index}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          {eyebrow}
        </span>
        <span className="h-px flex-1 bg-ink/12" />
      </div>

      <h2 className="mt-6 max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>

      {sub && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}
