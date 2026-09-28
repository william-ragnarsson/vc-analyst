"use client";

import { useRef, useState, type FormEvent } from "react";
import { useAuth, type EmailMode } from "./AuthProvider";
import { ACCOUNT_EXISTS, EMAIL_NOT_CONFIRMED } from "./authErrors";
import {
  focusOnMount,
  FormMessage,
  PasswordField,
  SECONDARY_BUTTON,
  Spinner,
  SubmitButton,
  TEXT_BUTTON,
  TextField,
  type FormNotice,
} from "./AuthFormParts";

/** A link is on its way; `kind` decides what "Resend email" sends again. */
type Sent = { kind: "signup" | "reset"; email: string };

/** A form message, plus the one-click fix for the errors that have one. */
type Message = FormNotice & { action?: "resend" | "login" };

const SUBMIT_LABELS: Record<EmailMode, [idle: string, pending: string]> = {
  login: ["Log in", "Logging in…"],
  signup: ["Create account", "Creating account…"],
  forgot: ["Send reset link", "Sending…"],
};

/**
 * The email side of the sign-in card: log in, create an account, or ask for a
 * reset link — then "check your inbox" once a link is on its way.
 *
 * Supabase won't say whether an address has an account (that would let anyone
 * probe for users), so unlike the Google button this can't be one "continue"
 * step. It asks which one you want, and the two errors that mean "you wanted
 * the other one" come with a button that switches over.
 */
export default function EmailAuthForm({
  initialMode,
  initialMessage,
  titleId,
  autoFocus = false,
  onBack,
}: {
  initialMode: EmailMode;
  /** What an email link came back to say — that it expired, or that the address is confirmed. */
  initialMessage?: FormNotice;
  titleId?: string;
  /** Focus the email field on mount: the user clicked their way here rather than landing from a link. */
  autoFocus?: boolean;
  /** Back to the list of sign-in options. */
  onBack: () => void;
}) {
  const { signInWithEmail, signUpWithEmail, resendConfirmation, sendPasswordReset } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [sent, setSent] = useState<Sent | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Which request is in flight. Only one at a time: each can change what the
  // card shows when it lands.
  const [busy, setBusy] = useState<"submit" | "resend" | null>(null);
  const [message, setMessage] = useState<Message | undefined>(initialMessage);
  // React only honours `autoFocus` when an input mounts, which is exactly when
  // it's wanted: arriving by click, or coming back from "check your inbox".
  const [focusEmail, setFocusEmail] = useState(autoFocus);
  const emailRef = useRef<HTMLInputElement>(null);

  /**
   * Switch forms. When the control that was clicked disappears with the old
   * form, focus goes to the email field rather than falling back to the page.
   */
  function switchMode(next: EmailMode, { moveFocus = false } = {}) {
    setMode(next);
    setMessage(undefined);
    if (moveFocus) emailRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy("submit");
    setMessage(undefined);
    const result =
      mode === "login"
        ? await signInWithEmail(email, password)
        : mode === "signup"
          ? await signUpWithEmail(email, password)
          : await sendPasswordReset(email);
    setBusy(null);

    if (result.status === "check-email") {
      setSent({ kind: mode === "forgot" ? "reset" : "signup", email });
    } else if (result.status === "error") {
      setMessage({
        tone: "error",
        text: result.message,
        action:
          mode === "login" && result.code === EMAIL_NOT_CONFIRMED
            ? "resend"
            : mode === "signup" && result.code === ACCOUNT_EXISTS
              ? "login"
              : undefined,
      });
    }
    // "done" means signed in, and whatever is showing this card takes it away.
  }

  /** "Resend link" on a log-in that failed because the address was never confirmed. */
  async function handleResendFromLogin() {
    setBusy("resend");
    const result = await resendConfirmation(email);
    setBusy(null);
    if (result.status === "error") setMessage({ tone: "error", text: result.message });
    else setSent({ kind: "signup", email });
  }

  async function handleResendFromInbox(sentTo: Sent) {
    setBusy("resend");
    setMessage(undefined);
    const result =
      sentTo.kind === "reset"
        ? await sendPasswordReset(sentTo.email)
        : await resendConfirmation(sentTo.email);
    setBusy(null);
    setMessage(
      result.status === "error"
        ? { tone: "error", text: result.message }
        : { tone: "info", text: "Sent again. Give it a minute to arrive." },
    );
  }

  if (sent) {
    return (
      <>
        <BackBadge onClick={onBack} />
        <h2
          id={titleId}
          ref={focusOnMount}
          tabIndex={-1}
          className="mt-5 text-xl font-semibold tracking-tight text-ink outline-none"
        >
          Check your inbox
        </h2>
        <p className="mt-1.5 break-words text-sm leading-relaxed text-muted">
          {sent.kind === "signup" ? (
            <>
              We sent a link to <strong className="font-medium text-ink">{sent.email}</strong>.
              Open it to finish setting up your account.
            </>
          ) : (
            <>
              If there&apos;s an account for{" "}
              <strong className="font-medium text-ink">{sent.email}</strong>, we&apos;ve sent it a
              link to choose a new password.
            </>
          )}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          It can take a minute to arrive — check your spam folder too.
        </p>

        <button
          type="button"
          onClick={() => void handleResendFromInbox(sent)}
          disabled={busy !== null}
          className={SECONDARY_BUTTON + " mt-6"}
        >
          {busy && <Spinner />}
          {busy ? "Sending…" : "Resend email"}
        </button>

        {message && (
          <div className="mt-3">
            <FormMessage notice={message} />
          </div>
        )}

        <p className="mt-4 text-center text-sm">
          <button
            type="button"
            onClick={() => {
              setFocusEmail(true);
              setSent(null);
              setMessage(undefined);
            }}
            className={TEXT_BUTTON}
          >
            Use a different email
          </button>
        </p>
      </>
    );
  }

  const [submitLabel, pendingLabel] = SUBMIT_LABELS[mode];

  return (
    <>
      <BackBadge onClick={onBack} />
      <h2 id={titleId} className="mt-5 text-xl font-semibold tracking-tight text-ink">
        {mode === "forgot" ? "Reset your password" : "Continue with email"}
      </h2>

      {mode === "forgot" ? (
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Enter your account&apos;s email and we&apos;ll send you a link to choose a new one.
        </p>
      ) : (
        <div
          role="group"
          aria-label="Log in or create an account"
          className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-ink/[0.06] p-1"
        >
          <ModeButton active={mode === "login"} disabled={busy !== null} onClick={() => switchMode("login")}>
            Log in
          </ModeButton>
          <ModeButton active={mode === "signup"} disabled={busy !== null} onClick={() => switchMode("signup")}>
            Create account
          </ModeButton>
        </div>
      )}

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-5 space-y-3.5">
        <TextField
          ref={emailRef}
          label="Email"
          type="email"
          name="email"
          autoComplete={mode === "signup" ? "email" : "username"}
          required
          autoFocus={focusEmail}
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {mode === "login" && (
          <PasswordField
            label="Password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            labelAction={
              <button
                type="button"
                onClick={() => switchMode("forgot", { moveFocus: true })}
                disabled={busy !== null}
                className={TEXT_BUTTON + " text-xs"}
              >
                Forgot password?
              </button>
            }
          />
        )}
        {mode === "signup" && (
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            hint="At least 8 characters."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
        <SubmitButton pending={busy === "submit"} pendingLabel={pendingLabel}>
          {submitLabel}
        </SubmitButton>
      </form>

      {message && (
        <div className="mt-3">
          <FormMessage
            notice={message}
            action={
              message.action === "resend"
                ? {
                    label: busy === "resend" ? "Sending…" : "Resend link",
                    onClick: () => void handleResendFromLogin(),
                    disabled: busy !== null,
                  }
                : message.action === "login"
                  ? { label: "Log in instead", onClick: () => switchMode("login", { moveFocus: true }) }
                  : undefined
            }
          />
        </div>
      )}

      {mode === "signup" && (
        <p className="mt-3 text-center text-xs text-muted">
          We&apos;ll email you a link to confirm your address.
        </p>
      )}
      {mode === "forgot" && (
        <p className="mt-4 text-center text-sm">
          <button type="button" onClick={() => switchMode("login", { moveFocus: true })} className={TEXT_BUTTON}>
            Back to log in
          </button>
        </p>
      )}
    </>
  );
}

/** Stands where the logo does on the first view, and goes back to it. */
function BackBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to all sign-in options"
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink/60 shadow-[0_1px_2px_rgba(20,19,15,0.1)] ring-1 ring-ink/10 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M14.5 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={active ? undefined : onClick}
      className={
        "h-9 rounded-full text-sm font-medium transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 " +
        (active
          ? "bg-white text-ink shadow-[0_1px_2px_rgba(20,19,15,0.12)]"
          : "text-muted hover:text-ink disabled:hover:text-muted")
      }
    >
      {children}
    </button>
  );
}
