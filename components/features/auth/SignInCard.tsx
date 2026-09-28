"use client";

import { useState } from "react";
import { useAuth, type EmailMode } from "./AuthProvider";
import AuthCard, { AuthCardLogo } from "./AuthCard";
import { FormMessage, SECONDARY_BUTTON, Spinner } from "./AuthFormParts";
import EmailAuthForm from "./EmailAuthForm";
import { AUTH_PROVIDERS, type AuthProviderId } from "./providers";
import ProviderIcon from "./ProviderIcon";

const BENEFITS = [
  "Every report saved to your account",
  "Pick them up again on any device",
  "Export or delete everything, any time",
];

/**
 * The one sign-in surface, shared by the nav dropdown (`UserMenu`), the save
 * nudge's modal (`SignInDialog`), the signed-out account page and the
 * password page, so all four look and read the same. It renders the card
 * itself; callers only place it.
 *
 * With Google, logging in and signing up are the same round trip — the
 * account is created on first sign-in — so the first view says so instead of
 * leaving people to guess which one they need. The benefits and the privacy
 * line answer the two questions any sign-in prompt raises: why bother, and
 * what gets handed over. "Continue with email" turns the card over to
 * `EmailAuthForm`, which does need to ask.
 */
export default function SignInCard({
  title = "Log in or sign up",
  description,
  titleId,
  onClose,
  emailMode,
  className = "",
}: {
  title?: string;
  /** Replaces the default line under the heading. */
  description?: string;
  /** Lets a surrounding dialog point `aria-labelledby` at the heading. */
  titleId?: string;
  /** Adds a close button in the corner, for the modal. */
  onClose?: () => void;
  /** Open straight onto one of the email forms instead of the list of options. */
  emailMode?: EmailMode;
  className?: string;
}) {
  const { signIn, error, notice, emailView, isAnonymous } = useAuth();
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  // An email link that sent the user back to finish by hand opens the card
  // on the form it needs.
  const [view, setView] = useState<EmailMode | null>(emailMode ?? emailView);
  // Whether the user has moved between views by hand. Until then nothing
  // takes focus, and a message an email link brought back stays on show.
  const [navigated, setNavigated] = useState(false);

  async function handleSignIn(provider: AuthProviderId) {
    setPending(provider);
    await signIn(provider);
    // On success the browser has already left for the provider; if we're
    // still here, something failed and `error` explains it.
    setPending(null);
  }

  const linkMessage = error
    ? ({ tone: "error", text: error } as const)
    : notice
      ? ({ tone: "info", text: notice } as const)
      : undefined;

  if (view) {
    return (
      <AuthCard onClose={onClose} className={className}>
        <EmailAuthForm
          initialMode={view}
          initialMessage={navigated ? undefined : linkMessage}
          titleId={titleId}
          autoFocus={navigated}
          onBack={() => {
            setNavigated(true);
            setView(null);
          }}
        />
      </AuthCard>
    );
  }

  const lead =
    description ??
    (isAnonymous
      ? "New here? Either option sets up your account, and the analyses you've already run come with you."
      : "New here? Either option sets up your account.");

  return (
    <AuthCard onClose={onClose} className={className}>
      <AuthCardLogo />
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
            className={SECONDARY_BUTTON}
          >
            {pending === id ? <Spinner /> : <ProviderIcon />}
            {pending === id ? "Redirecting…" : label}
          </button>
        ))}
        <button
          type="button"
          // Coming back from the email form, focus returns to where it left.
          autoFocus={navigated}
          onClick={() => {
            setNavigated(true);
            // Someone with analyses but no account is most likely here to make one.
            setView(isAnonymous ? "signup" : "login");
          }}
          disabled={pending !== null}
          className={SECONDARY_BUTTON}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-[18px] w-[18px] shrink-0 text-ink/70"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Continue with email
        </button>
      </div>

      {linkMessage && (
        <div className="mt-3">
          <FormMessage notice={linkMessage} />
        </div>
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
        Google only shares your name, email and photo.
      </p>
    </AuthCard>
  );
}
