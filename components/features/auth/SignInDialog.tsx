"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { AUTH_PROVIDERS, type AuthProviderId } from "./providers";
import ProviderIcon from "./ProviderIcon";

/**
 * The sign-in sheet. Deliberately small: three buttons and a sentence about
 * why bothering is worth it.
 *
 * Nothing in this app is behind a login, so this is never a wall — it always
 * opens because the user asked it to.
 */
export default function SignInDialog({
  open,
  onClose,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  /** Why the dialog appeared, shown under the heading. */
  reason?: string;
}) {
  // Mount only while open, so per-open state (which button is pending) resets
  // itself instead of needing an effect to clear it.
  if (!open) return null;
  return <SignInPanel onClose={onClose} reason={reason} />;
}

function SignInPanel({ onClose, reason }: { onClose: () => void; reason?: string }) {
  const { signIn, error } = useAuth();
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    // The page behind a modal shouldn't scroll with it.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  async function handleSignIn(provider: AuthProviderId) {
    setPending(provider);
    await signIn(provider);
    // On success the browser has already left for the provider; if we're still
    // here, something failed and `error` explains it.
    setPending(null);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
    >
      <button
        aria-label="Close sign in"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/25 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        tabIndex={-1}
        className="fade-up relative w-full max-w-sm rounded-3xl border border-ink/12 bg-paper p-7 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_28px_60px_-20px_rgba(20,19,15,0.45)] outline-none"
      >
        <h2 id="signin-title" className="text-xl font-semibold tracking-tight text-ink">
          Keep your analyses
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {reason ??
            "Sign in and every report you run stays with your account — on any device, for as long as you want."}
        </p>

        <div className="mt-6 space-y-2">
          {AUTH_PROVIDERS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => handleSignIn(id)}
              disabled={pending !== null}
              className="flex w-full items-center justify-center gap-2.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ProviderIcon provider={id} />
              {pending === id ? "Redirecting…" : label}
            </button>
          ))}
        </div>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <button
          onClick={onClose}
          className="mt-5 w-full text-center text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
