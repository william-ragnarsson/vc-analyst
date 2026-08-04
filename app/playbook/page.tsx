import fs from "fs";
import path from "path";
import Link from "next/link";

type Block = { type: "h2" | "h3" | "p" | "li" | "quote"; text: string };

function parse(md: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line || line === "---" || line.startsWith("# ")) continue;
    if (line.startsWith("> ")) blocks.push({ type: "quote", text: line.slice(2) });
    else if (line.startsWith("### ")) blocks.push({ type: "h3", text: line.slice(4) });
    else if (line.startsWith("## ")) blocks.push({ type: "h2", text: line.slice(3).replace(/^\d+\.\s*/, "") });
    else if (line.startsWith("- ")) blocks.push({ type: "li", text: line.slice(2) });
    else blocks.push({ type: "p", text: line });
  }
  return blocks;
}

// inline **bold** + *italic*
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**")) return <strong key={i} className="font-semibold text-ink">{p.slice(2, -2)}</strong>;
    if (p.startsWith("*")) return <em key={i} className="font-serif italic text-ink">{p.slice(1, -1)}</em>;
    return <span key={i}>{p}</span>;
  });
}

export default function PlaybookPage() {
  const md = fs.readFileSync(path.join(process.cwd(), "docs/playbook.md"), "utf8");
  const blocks = parse(md);
  let sectionNo = 0;

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6">
      <header className="pt-10 sm:pt-14 space-y-5">
        <Link href="/" className="text-sm text-muted hover:text-ink transition-colors">← Back</Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper/60 backdrop-blur px-3 py-1 text-xs font-medium text-accent uppercase tracking-[0.2em]">
          Context database
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-[-0.03em] leading-[1] text-ink">
          How I evaluated <span className="marker">800+ decks</span>
        </h1>
        <p className="text-lg text-muted max-w-xl leading-relaxed">
          The exact criteria the AI uses, drawn from a year of weekly deal reviews,
          not generic startup advice.
        </p>
      </header>

      <div className="space-y-2">
        {blocks.map((b, i) => {
          if (b.type === "quote")
            return (
              <p key={i} className="rounded-3xl border border-ink/10 bg-white/50 backdrop-blur p-6 text-muted leading-relaxed italic">
                {b.text}
              </p>
            );
          if (b.type === "h2") {
            sectionNo += 1;
            const n = sectionNo;
            return (
              <h2 key={i} className="flex items-center gap-3 pt-10 text-2xl font-bold tracking-tight text-ink">
                <span className="grid place-items-center w-8 h-8 rounded-xl bg-ink text-paper text-sm font-bold shrink-0">{n}</span>
                {b.text}
              </h2>
            );
          }
          if (b.type === "h3")
            return <h3 key={i} className="pt-5 text-base font-semibold text-accent">{inline(b.text)}</h3>;
          if (b.type === "li")
            return (
              <div key={i} className="flex gap-3 pl-1">
                <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                <p className="text-muted leading-relaxed">{inline(b.text)}</p>
              </div>
            );
          return <p key={i} className="text-muted leading-relaxed">{inline(b.text)}</p>;
        })}
      </div>

      <div className="pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-ink text-paper font-semibold hover:bg-accent transition-colors"
        >
          Analyze your deck →
        </Link>
      </div>
    </div>
  );
}
