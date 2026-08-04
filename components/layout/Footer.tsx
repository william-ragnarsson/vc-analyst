import Link from "next/link";

const LINKS = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/william-ragnarsson/" },
  { label: "GitHub", href: "https://github.com/william-popmie" },
  { label: "Email", href: "mailto:william.ragnarsson@gmail.com" },
];

/**
 * Shared site footer — rendered once in app/layout.tsx (so it's on every page)
 * and again at the end of the analysis report's section list, where it also
 * gives the last chapters real trailing content to scroll to.
 *
 * `flush` is for pages that end in a full-bleed band. It drops the top margin —
 * which would otherwise leave a strip of bare paper between the band's bottom
 * edge and the footer rule — and, more importantly, carries the band's own tone
 * down through the footer. Ending the tone at the rule makes the footer read as
 * a separate slab bolted onto the bottom of the page; continuing it means the
 * closing section and the footer are one surface, and the rule between them
 * becomes a divider inside it rather than a border around it. The rule lightens
 * to match, since it is now dividing rather than enclosing.
 */
export default function Footer({ flush = false }: { flush?: boolean }) {
  return (
    <footer
      className={
        "px-6 py-8 " +
        (flush ? "border-t border-ink/8 bg-paper-2/60" : "mt-16 border-t border-ink/10")
      }
    >
      {/* Flush pages are `max-w-6xl` throughout, so the default `max-w-3xl`
          leaves the footer's two ends floating inside the column the rest of
          the page lines up to — the other half of why it read as detached. */}
      <div
        className={
          "mx-auto flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center " +
          (flush ? "max-w-6xl" : "max-w-3xl")
        }
      >
        <div>
          <p className="font-semibold tracking-tight text-ink">William Ragnarsson</p>
          <p className="text-sm text-muted">VC analyst, distilled into an AI.</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target={l.href.startsWith("http") ? "_blank" : undefined}
              rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-sm font-medium text-muted transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
          <Link href="/playbook" className="text-sm font-medium text-muted transition-colors hover:text-ink">
            Context database
          </Link>
          <span className="text-sm text-muted/60">© {new Date().getFullYear()}</span>
        </div>
      </div>
    </footer>
  );
}
