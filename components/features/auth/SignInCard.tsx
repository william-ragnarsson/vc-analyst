"use client";

import Image from "next/image";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { AUTH_PROVIDERS, type AuthProviderId } from "./providers";
import ProviderIcon from "./ProviderIcon";

const BENEFITS = [
  "Every report saved to your account",
  "Pick them up again on any device",
  "Export or delete everything, any time",
];

/**
 * The one sign-in surface, shared by the nav dropdown (`UserMenu`), the save
 * nudge's modal (`SignInDialog`) and the signed-out account page, so all three
 * look and read the same. It renders the card itself; callers only place it.
 *
 * Logging in and signing up are the same OAuth round trip — the account is
 * created on first sign-in — so the card says so instead of leaving people to
 * guess which one they need. The benefits and the privacy line answer the two
 * questions any sign-in prompt raises: why bother, and what gets handed over.
 */
export default function SignInCard({
  title = "Log in or sign up",
  description,
  titleId,
  onClose,
  className = "",
}: {
  title?: string;
  /** Replaces the default line under the heading. */
  description?: string;
  /** Lets a surrounding dialog point `aria-labelledby` at the heading. */
  titleId?: string;
  /** Adds a close button in the corner, for the modal. */
  onClose?: () => void;
  className?: string;
}) {
  const { signIn, error, isAnonymous } = useAuth();
  const [pending, setPending] = useState<AuthProviderId | null>(null);

  async function handleSignIn(provider: AuthProviderId) {
    setPending(provider);
    await signIn(provider);
    // On success the browser has already left for the provider; if we're
    // still here, something failed and `error` explains it.
    setPending(null);
  }

  const lead =
    description ??
    (isAnonymous
      ? "New here? Continuing creates your account, and the analyses you've already run come with you."
      : "New here? Continuing creates your account — there's no separate sign-up.");

  return (
    <div
      className={
        "relative rounded-3xl border border-ink/10 bg-[#fbf9f3] p-6 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_24px_56px_-24px_rgba(20,19,15,0.4)] " +
        className
      }
    >
      {/* A faint wash of the marker colour behind the logo. Clipped in its own
          layer so callers can still make the card itself scroll. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-marker/40 blur-3xl" />
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-full p-2 text-ink/40 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <div className="relative">
        <Image
          src="/logo.png"
          alt=""
          width={40}
          height={40}
          className="rounded-xl shadow-[0_1px_2px_rgba(20,19,15,0.1)] ring-1 ring-ink/10"
        />
        <h2 id={titleId} className="mt-5 text-xl font-semibold tracking-tight text-ink">
          {title}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">{lead}</p>

        <ul className="mt-5 space-y-2.5">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5 text-sm text-ink/85">
              <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden>
                <circle cx="10" cy="10" r="10" fill="currentColor" fillOpacity="0.12" />
                <path
                  d="M6 10.5l2.5 2.5L14 7.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {benefit}
            </li>
          ))}
        </ul>

        <div className="mt-6 space-y-2">
          {AUTH_PROVIDERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => void handleSignIn(id)}
              disabled={pending !== null}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-full border border-ink/15 bg-white px-5 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgba(20,19,15,0.06)] transition-[border-color,box-shadow] hover:border-ink/25 hover:shadow-[0_2px_10px_-2px_rgba(20,19,15,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f3] disabled:cursor-wait disabled:opacity-70"
            >
              {pending === id ? (
                <span
                  aria-hidden
                  className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-ink/15 border-t-ink/60"
                />
              ) : (
                <ProviderIcon />
              )}
              {pending === id ? "Redirecting…" : label}
            </button>
          ))}
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-600/15 bg-red-500/[0.06] px-3 py-2 text-xs leading-relaxed text-red-800"
          >
            {error}
          </p>
        )}

        {/* The lock sits inline, not as a flex sibling, so on a narrow phone the
            line wraps under it rather than leaving it stranded beside two lines. */}
        <p className="mt-4 text-center text-xs text-muted">
          <svg
            viewBox="0 0 24 24"
            className="mr-1.5 inline-block h-3.5 w-3.5 -translate-y-px align-middle"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
          </svg>
          We only receive your name, email and photo.
        </p>
      </div>
    </div>
  );
}
