"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import SignInCard from "./SignInCard";

/**
 * The sign-in card as a centered modal, for the one place sign-in is an
 * active nudge (`SavePrompt`). The card itself is shared with the nav's
 * dropdown and the account page — see `SignInCard`.
 *
 * Nothing in this app is behind a login, so this is never a wall — it always
 * opens because the user asked it to.
 */
export default function SignInDialog({
  open,
  onClose,
  title,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Why the dialog appeared, shown under the heading. */
  reason?: string;
}) {
  // Mount only while open, so per-open state (which button is pending) resets
  // itself instead of needing an effect to clear it.
  if (!open) return null;
  return <SignInModal onClose={onClose} title={title} reason={reason} />;
}

function SignInModal({
  onClose,
  title,
  reason,
}: {
  onClose: () => void;
  title?: string;
  reason?: string;
}) {
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

  // Portalled to <body> so the dialog's `fixed inset-0` positions against the
  // real viewport. Rendered anywhere inside NavBar, it would instead position
  // against the nav pill's backdrop-blur div — `backdrop-filter` creates a new
  // CSS containing block for `position: fixed` descendants, which is why the
  // dialog used to appear pinned near the top instead of vertically centered.
  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-title"
    >
      <button
        aria-label="Close sign in"
        onClick={onClose}
        className="fade-in absolute inset-0 cursor-default bg-ink/30 backdrop-blur-sm"
      />

      <div ref={panelRef} tabIndex={-1} className="relative w-full max-w-sm outline-none">
        <SignInCard
          titleId="signin-title"
          title={title}
          description={reason}
          onClose={onClose}
          className="pop-in max-h-[calc(100dvh-2rem)] overflow-y-auto"
        />
      </div>
    </div>,
    document.body,
  );
}
