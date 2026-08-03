type SectionHeadingProps = {
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: "left" | "center";
};

/**
 * A section's title and standfirst.
 *
 * Deliberately has no numbered eyebrow or rule: labelling every section "01 /
 * 02 / 03" made the page feel administratively chopped up. Separation comes
 * from the tonal bands and the differing layout shapes instead.
 */
export default function SectionHeading({ title, sub, align = "left" }: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div className={centered ? "flex flex-col items-center text-center" : undefined}>
      <h2 className="max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight text-ink sm:text-4xl">
        {title}
      </h2>
      {sub && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">{sub}</p>}
    </div>
  );
}
