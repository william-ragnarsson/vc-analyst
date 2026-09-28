"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useAuth } from "@/components/features/auth/AuthProvider";
import AuthCard, { AuthCardLogo } from "@/components/features/auth/AuthCard";
import {
  focusOnMount,
  FormMessage,
  PasswordField,
  SubmitButton,
  TEXT_BUTTON,
  type FormNotice,
} from "@/components/features/auth/AuthFormParts";
import { NEEDS_FRESH_LOGIN } from "@/components/features/auth/authErrors";
import { hasPassword } from "@/components/features/auth/providers";
import SignInCard from "@/components/features/auth/SignInCard";

/**
 * Where a password is set or changed: from the account page, or straight
 * from a reset link, which signs the user in on its way here. Signed out —
 * a reset link that failed, or an old bookmark — it offers to send a new one.
 */
export default function PasswordPage() {
  const { user, isIdentified, loading, configured } = useAuth();

  if (!configured) return null;

  if (loading) {
    return <div className="mx-auto max-w-3xl px-6 pt-10 text-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-sm px-4 pt-10 pb-20">
      {isIdentified && user ? <SetPasswordCard user={user} /> : <SignInCard emailMode="forgot" />}
    </div>
  );
}

function SetPasswordCard({ user }: { user: User }) {
  const { updatePassword, sendPasswordReset } = useAuth();
  const email = user.email ?? "";
  const changing = hasPassword(user);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"save" | "email" | null>(null);
  const [message, setMessage] = useState<(FormNotice & { needsLink?: boolean }) | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("save");
    setMessage(undefined);
    const result = await updatePassword(password);
    setBusy(null);
    if (result.status === "error") {
      setMessage({ tone: "error", text: result.message, needsLink: result.code === NEEDS_FRESH_LOGIN });
    } else {
      setSaved(true);
    }
  }

  /** The way round a project that wants a recent log-in first: a reset link signs the user in afresh. */
  async function handleEmailLink() {
    setBusy("email");
    const result = await sendPasswordReset(email);
    setBusy(null);
    setMessage(
      result.status === "error"
        ? { tone: "error", text: result.message }
        : { tone: "info", text: `We sent a link to ${email}. Open it to set your password.` },
    );
  }

  if (saved) {
    return (
      <AuthCard>
        <AuthCardLogo />
        <h1
          ref={focusOnMount}
          tabIndex={-1}
          className="mt-5 text-xl font-semibold tracking-tight text-ink outline-none"
        >
          Password saved
        </h1>
        <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
          Next time, log in as <strong className="font-medium text-ink">{email}</strong> with your
          new password.
        </p>
        <Link
          href="/due-diligence"
          className="mt-6 flex h-11 w-full items-center justify-center rounded-full bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f3]"
        >
          Go to my analyses
        </Link>
        <p className="mt-4 text-center text-sm">
          <Link href="/account" className={TEXT_BUTTON}>
            Back to account
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard>
      <AuthCardLogo />
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-ink">
        {changing ? "Choose a new password" : "Set a password"}
      </h1>
      <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
        {changing ? "You'll use it to log in as " : "Then you can also log in as "}
        <strong className="font-medium text-ink">{email}</strong>
        {changing ? "." : " with a password."}
      </p>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3.5">
        {/* Tells password managers which account the new password belongs to. */}
        <input hidden type="email" name="email" autoComplete="username" value={email} readOnly />
        <PasswordField
          label={changing ? "New password" : "Password"}
          name="password"
          autoComplete="new-password"
          required
          minLength={8}
          hint="At least 8 characters."
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <SubmitButton pending={busy === "save"} pendingLabel="Saving…">
          Save password
        </SubmitButton>
      </form>

      {message && (
        <div className="mt-3">
          <FormMessage
            notice={message}
            action={
              message.needsLink
                ? {
                    label: busy === "email" ? "Sending…" : "Email me a link",
                    onClick: () => void handleEmailLink(),
                    disabled: busy !== null,
                  }
                : undefined
            }
          />
        </div>
      )}

      <p className="mt-4 text-center text-sm">
        <Link href="/account" className={TEXT_BUTTON}>
          Back to account
        </Link>
      </p>
    </AuthCard>
  );
}
