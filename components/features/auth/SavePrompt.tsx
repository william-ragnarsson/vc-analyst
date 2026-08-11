"use client";

import { useState } from "react";
import { useAuth } from "./AuthProvider";
import SignInDialog from "./SignInDialog";

/**
 * The nudge that carries the whole "no gating" design: analyses already persist
 * for anonymous users, so this never blocks anything. It just points out that
 * the only thing tying those reports to them is a cookie in this browser.
 *
 * Renders nothing unless the user is anonymous — signed-in users have already
 * done the thing it asks for.
 */
export default function SavePrompt({
  message = "Your analyses are saved to this browser only.",
  className = "",
}: {
  message?: string;
  className?: string;
}) {
  const { isAnonymous } = useAuth();
  const [open, setOpen] = useState(false);

  if (!isAnonymous) return null;

  return (
    <>
      <div
        className={
          "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-accent/[0.06] px-5 py-3.5 " +
          className
        }
      >
        <p className="text-sm text-ink/80">
          {message} <span className="text-muted">Clear your cookies and they’re gone.</span>
        </p>
        <button
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Save to an account
        </button>
      </div>

      <SignInDialog
        open={open}
        onClose={() => setOpen(false)}
        reason="Attach an account and the analyses you've already run come with you — nothing is lost and nothing needs re-running."
      />
    </>
  );
}
