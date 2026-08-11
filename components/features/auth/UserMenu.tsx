"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import SignInDialog from "./SignInDialog";

/**
 * The nav's account control: a "Sign in" pill until there's a real identity,
 * then an avatar with a small menu.
 *
 * `onCard` mirrors NavBar's own variant — on the home page the nav starts
 * inside the dark hero card and everything in it has to switch to light text.
 */
export default function UserMenu({ onCard }: { onCard: boolean }) {
  const { user, isIdentified, loading, configured, signOut } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // No Supabase project configured — accounts are simply not part of this
  // deployment, so don't advertise them.
  if (!configured) return null;

  // Hold the space but stay blank until the session resolves, so the nav
  // doesn't flash "Sign in" at someone who is already signed in.
  if (loading) return <div className="h-8 w-8 shrink-0" aria-hidden="true" />;

  if (!isIdentified) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          className={
            "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors duration-300 " +
            (onCard
              ? "border-white/25 text-white hover:bg-white/10"
              : "border-ink/15 text-ink hover:bg-ink/[0.06]")
          }
        >
          Sign in
        </button>
        <SignInDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      </>
    );
  }

  const email = user?.email ?? "";
  const name = (user?.user_metadata?.full_name as string | undefined) ?? email;
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
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

      {menuOpen && (
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
            onClick={() => setMenuOpen(false)}
            className="block px-4 py-2.5 text-sm text-ink transition-colors hover:bg-ink/[0.04]"
          >
            My analyses
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
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
