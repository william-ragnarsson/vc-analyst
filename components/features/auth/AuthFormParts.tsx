"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";

/**
 * The pieces the email forms are built from, shared by the sign-in card and
 * the set-a-password page.
 */

/** The white pill of the "Continue with …" buttons, also used for secondary actions. */
export const SECONDARY_BUTTON =
  "flex h-11 w-full items-center justify-center gap-3 rounded-full border border-ink/15 bg-white px-5 text-[15px] font-medium text-ink shadow-[0_1px_2px_rgba(20,19,15,0.06)] transition-[border-color,box-shadow] hover:border-ink/25 hover:shadow-[0_2px_10px_-2px_rgba(20,19,15,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f3] disabled:cursor-wait disabled:opacity-70";

/** Small inline text button — "Forgot password?", "Back to log in". */
export const TEXT_BUTTON =
  "rounded font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50";

// 16px text: anything smaller and iOS Safari zooms the page on focus.
const INPUT =
  "block h-11 w-full rounded-xl border border-ink/15 bg-white px-3.5 text-base text-ink shadow-[0_1px_2px_rgba(20,19,15,0.04)] outline-none transition-[border-color,box-shadow] placeholder:text-ink/35 focus:border-accent/60 focus:ring-2 focus:ring-accent/20";

const LABEL = "text-sm font-medium text-ink";

export function Spinner({ onDark = false }: { onDark?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        "h-[18px] w-[18px] shrink-0 animate-spin rounded-full border-2 " +
        (onDark ? "border-paper/25 border-t-paper" : "border-ink/15 border-t-ink/60")
      }
    />
  );
}

export function TextField({
  label,
  ...inputProps
}: { label: string } & ComponentProps<"input">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <input id={id} {...inputProps} className={INPUT + " mt-1.5"} />
    </div>
  );
}

/** A password input with a show/hide toggle — typos in a hidden field are the usual lock-out. */
export function PasswordField({
  label,
  hint,
  labelAction,
  ...inputProps
}: {
  label: string;
  /** Shown under the field and linked to it for screen readers. */
  hint?: string;
  /** Sits at the right end of the label row, e.g. "Forgot password?". */
  labelAction?: ReactNode;
} & Omit<ComponentProps<"input">, "type">) {
  const id = useId();
  const hintId = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL}>
          {label}
        </label>
        {labelAction}
      </div>
      <div className="relative mt-1.5">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-describedby={hint ? hintId : undefined}
          {...inputProps}
          className={INPUT + " pr-12"}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label="Show password"
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" strokeLinejoin="round" />
            <circle cx="12" cy="12" r="3" />
            {visible && <path d="M4 4l16 16" strokeLinecap="round" />}
          </svg>
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({
  pending,
  pendingLabel,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-ink px-5 text-[15px] font-medium text-paper transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fbf9f3] disabled:cursor-wait disabled:opacity-70 disabled:hover:bg-ink"
    >
      {pending && <Spinner onDark />}
      {pending ? pendingLabel : children}
    </button>
  );
}

export interface FormNotice {
  tone: "error" | "info";
  text: string;
}

/** An error or an all-clear under a form, with room for one follow-up action. */
export function FormMessage({
  notice,
  action,
}: {
  notice: FormNotice;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  const isError = notice.tone === "error";
  return (
    <div
      role={isError ? "alert" : "status"}
      className={
        "rounded-xl border px-3 py-2 text-xs leading-relaxed " +
        (isError
          ? "border-red-600/15 bg-red-500/[0.06] text-red-800"
          : "border-accent/20 bg-accent/[0.07] text-ink/80")
      }
    >
      {notice.text}
      {action && (
        <>
          {" "}
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            className="font-semibold underline underline-offset-2 hover:no-underline disabled:cursor-wait disabled:opacity-60"
          >
            {action.label}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * A ref that focuses its element when it appears — for the heading of a view
 * that replaces the button that led to it, so focus isn't dropped on the
 * page. A module-level function, so React sees the same ref every render and
 * only calls it on mount.
 */
export function focusOnMount(node: HTMLElement | null) {
  node?.focus();
}
