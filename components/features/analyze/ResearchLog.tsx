"use client";

import { useEffect, useRef } from "react";
import Card from "@/components/ui/Card";
import type { AnalysisState, SearchGroup } from "@/lib/diligence/stream-state";
import { domainOf, faviconOf } from "./sourceDisplay";

function SourceRow({ title, url }: { title: string; url: string }) {
  const favicon = faviconOf(url);
  const domain = domainOf(url);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="fade-up group flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-ink/[0.04]"
    >
      {favicon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={favicon} alt="" width={16} height={16} className="h-4 w-4 shrink-0 rounded-sm" />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-ink/40">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
          </svg>
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-ink/80 group-hover:text-ink">{title}</span>
      {domain && <span className="shrink-0 font-mono text-[11px] text-muted">{domain}</span>}
    </a>
  );
}

function SearchBlock({ group }: { group: SearchGroup }) {
  return (
    <div className="fade-up">
      <div className="flex items-center gap-2 px-1">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2.2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium text-ink">{group.query}</span>
        {group.sources.length > 0 && (
          <span className="font-mono text-[11px] text-muted">{group.sources.length}</span>
        )}
      </div>
      <div className="mt-1 ml-[7px] border-l border-ink/10 pl-3">
        {group.sources.map((s, i) => (
          <SourceRow key={`${s.url}-${i}`} title={s.title} url={s.url} />
        ))}
      </div>
    </div>
  );
}

/**
 * The scrolling list of searches + their sources. Capped to a fixed height so
 * it can't grow unbounded, and auto-follows to the bottom as new activity
 * streams in — but only while the user is already near the bottom, so scrolling
 * up to read an earlier source doesn't get yanked back down.
 */
function SearchList({ searches, sourceCount }: { searches: SearchGroup[]; sourceCount: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [searches, sourceCount]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="max-h-80 space-y-3 overflow-y-auto pr-1"
    >
      {searches.map((g, i) => (
        <SearchBlock key={`${g.query}-${i}`} group={g} />
      ))}
    </div>
  );
}

/**
 * The live model scratchpad: the running prose notes the model writes while
 * researching. Its own card so it reads as a distinct chapter from the raw
 * search/source list.
 */
export function ResearchFindings({ state, active }: { state: AnalysisState; active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const notes = state.notes;

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [notes]);

  return (
    <Card eyebrow="Research Findings">
      {notes ? (
        <div
          ref={ref}
          className="max-h-48 overflow-y-auto px-5 pb-4 font-mono text-xs leading-relaxed text-ink/70"
        >
          <span className="whitespace-pre-wrap">{notes}</span>
          {active && <span className="ml-0.5 inline-block w-1.5 animate-blink">▌</span>}
        </div>
      ) : (
        <div className="px-5 pb-4">
          <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        </div>
      )}
    </Card>
  );
}

/**
 * The web-search rail card: a height-capped, auto-following list of every
 * search query and the sources it surfaced. This is the only place sources
 * render — the scorecard used to duplicate them.
 */
export function WebSearch({ state }: { state: AnalysisState }) {
  return (
    <Card eyebrow="Web Search">
      {state.searches.length > 0 ? (
        <div className="space-y-4 px-5 pb-4">
          <div className="flex items-center gap-3 text-xs text-muted">
            <span><span className="font-semibold text-ink">{state.searches.length}</span> searches</span>
            <span className="text-ink/20">•</span>
            <span><span className="font-semibold text-ink">{state.sourceCount}</span> sources</span>
          </div>
          <SearchList searches={state.searches} sourceCount={state.sourceCount} />
        </div>
      ) : (
        <div className="px-5 pb-4">
          <div className="h-3 w-32 animate-pulse rounded bg-ink/10" />
        </div>
      )}
    </Card>
  );
}
