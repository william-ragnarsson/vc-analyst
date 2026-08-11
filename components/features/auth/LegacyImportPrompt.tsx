"use client";

import { useState, useSyncExternalStore } from "react";
import { useAuth } from "./AuthProvider";
import { countLegacyRecords, discardLegacyRecords, importLegacyRecords } from "@/lib/analyses/legacy";

/** localStorage is client-only; nothing to subscribe to, we just read it once. */
const NOOP_SUBSCRIBE = () => () => {};

/**
 * Offers to pull the old localStorage history into the account, once.
 *
 * Temporary: remove this along with `lib/analyses/legacy.ts` when enough time
 * has passed that nobody still has the old key in their browser.
 */
export default function LegacyImportPrompt({ onImported }: { onImported: () => void }) {
  const { user, ensureAnonymous } = useAuth();
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);

  // Zero on the server and during the first client render, so the two agree;
  // the real count arrives on the pass after hydration.
  const stored = useSyncExternalStore(NOOP_SUBSCRIBE, countLegacyRecords, () => 0);
  const count = resolved ? 0 : stored;

  if (count === 0) return null;

  async function handleImport() {
    setBusy(true);
    // They may never have signed in; the import still needs somewhere to land.
    const target = user ?? (await ensureAnonymous());
    if (target) await importLegacyRecords(target.id);
    setResolved(true);
    setBusy(false);
    onImported();
  }

  function handleDiscard() {
    discardLegacyRecords();
    setResolved(true);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/15 bg-white/60 px-5 py-3.5 backdrop-blur">
      <p className="text-sm text-ink/80">
        {count === 1 ? "1 analysis" : `${count} analyses`} from an earlier version are still stored
        in this browser.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleDiscard}
          disabled={busy}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          Discard
        </button>
        <button
          onClick={() => void handleImport()}
          disabled={busy}
          className="rounded-full border border-ink/15 bg-paper px-4 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-ink/[0.06] disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import them"}
        </button>
      </div>
    </div>
  );
}
