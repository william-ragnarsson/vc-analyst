"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { AUTH_PROVIDERS, type AuthProviderId } from "./providers";
import ProviderIcon from "./ProviderIcon";

/**
 * The nav's account control: a "Log in / Sign up" pill until there's a real
 * identity, then an avatar with a small menu.
 *
 * The signed-out state opens a small dropdown anchored under the button —
 * matching the signed-in menu below it — rather than a full-screen modal.
 * Nothing in this app is ever gated behind an account, so this is a low-key
 * "here's an option" rather than something that needs to grab the whole
 * screen's attention. (`SavePrompt` still uses the centered `SignInDialog`
 * for the one place sign-in is an active nudge after a finished report.)
 *
 * `onCard` mirrors NavBar's own variant — on the home page the nav starts
 * inside the dark hero card and everything in it has to switch to light text.
 */
export default function UserMenu({ onCard }: { onCard: boolean }) {
  const { user, isIdentified, loading, configured, signIn, signOut, error } = useAuth();
  const [panelOpen, setPanelOpen] = useState(false);
  const [pending, setPending] = useState<AuthProviderId | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panelOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setPanelOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  // No Supabase project configured — accounts are simply not part of this
  // deployment, so don't advertise them.
  if (!configured) return null;

  // Hold the space but stay blank until the session resolves, so the nav
  // doesn't flash "Log in / Sign up" at someone who is already signed in.
  if (loading) return <div className="h-8 w-8 shrink-0" aria-hidden="true" />;

  async function handleSignIn(provider: AuthProviderId) {
    setPending(provider);
    await signIn(provider);
    // On success the browser has already left for the provider; if we're
    // still here, something failed and `error` explains it.
    setPending(null);
  }

  if (!isIdentified) {
    return (
      <div ref={panelRef} className="relative shrink-0">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={panelOpen}
          className={
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-300 " +
            (onCard
              ? "border-white/25 text-white hover:bg-white/10"
              : "border-ink/15 text-ink hover:bg-ink/[0.06]")
          }
        >
          Log in / Sign up
        </button>

        {panelOpen && (
          <div
            role="dialog"
            aria-label="Sign in"
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-ink/12 bg-paper p-5 shadow-[0_1px_2px_rgba(20,19,15,0.05),0_16px_40px_-16px_rgba(20,19,15,0.4)]"
          >
            <h2 className="text-sm font-semibold tracking-tight text-ink">Keep your analyses</h2>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Sign in and every report you run stays with your account — on any device, for as
              long as you want.
            </p>

            <div className="mt-4 space-y-2">
              {AUTH_PROVIDERS.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => handleSignIn(id)}
                  disabled={pending !== null}
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border border-ink/15 bg-white/70 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ProviderIcon />
                  {pending === id ? "Redirecting…" : label}
                </button>
              ))}
            </div>

            {error && <p className="mt-3 text-xs text-red-700">{error}</p>}
          </div>
        )}
      </div>
    );
  }

  const email = user?.email ?? "";
  const name = (user?.user_metadata?.full_name as string | undefined) ?? email;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        onClick={() => setPanelOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={panelOpen}
        aria-label="Account"
        className={
          "flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border text-xs font-semibold uppercase transition-colors duration-300 " +
          (onCard
            ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
            : "border-ink/15 bg-ink/[0.06] text-ink hover:bg-ink/10")
        }
      >
        {avatarUrl ? (
          // Provider avatars come from arbitrary CDNs; a plain <img> avoids
          // having to allow-list every one of them in next.config.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          (name || "?").charAt(0)
        )}
      </button>

      {panelOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-ink/12 bg-paper shadow-[0_1px_2px_rgba(20,19,15,0.05),0_16px_40px_-16px_rgba(20,19,15,0.4)]"
        >
          <div className="border-b border-ink/8 px-4 py-3">
            <p className="truncate text-sm font-medium text-ink">{name || "Signed in"}</p>
            {email && name !== email && (
              <p className="truncate text-xs text-muted">{email}</p>
            )}
          </div>
          <Link
            href="/due-diligence"
            role="menuitem"
            onClick={() => setPanelOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink transition-colors hover:bg-ink/[0.04]"
          >
            My analyses
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setPanelOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink transition-colors hover:bg-ink/[0.04]"
          >
            Account
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              setPanelOpen(false);
              void signOut();
            }}
            className="block w-full px-4 py-2.5 text-left text-sm text-ink transition-colors hover:bg-ink/[0.04]"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
