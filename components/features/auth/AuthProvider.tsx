"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AuthError, type User } from "@supabase/supabase-js";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { ACCOUNT_EXISTS, describeAuthError, NEEDS_FRESH_LOGIN } from "./authErrors";
import { isAuthProviderId, type AuthProviderId } from "./providers";

/**
 * Where the id of an anonymous user is parked while the browser is away at an
 * OAuth provider, or while it logs into an existing account by email. Read
 * back after sign-in to re-parent that user's analyses if they landed in a
 * different account — see `reconcile` below.
 */
const ANON_STASH_KEY = "vc-analyst:anon-id";

/** The three things the email half of the sign-in card can be doing. */
export type EmailMode = "login" | "signup" | "forgot";

/**
 * How an email action went. `check-email` means a link is on its way and
 * nothing changes until it's opened.
 */
export type EmailAuthResult =
  | { status: "done" }
  | { status: "check-email" }
  | { status: "error"; message: string; code?: string };

/**
 * Which way an email link is headed, so `/auth/callback` can say something
 * useful when the link can't sign anyone in.
 */
type EmailFlow = "signup" | "recovery";

interface AuthContextValue {
  user: User | null;
  /** A real, signed-in identity — not an anonymous placeholder. */
  isIdentified: boolean;
  /** Has run something but never signed in: the audience for the save prompts. */
  isAnonymous: boolean;
  /** True until the first session read resolves; avoids a sign-in flash. */
  loading: boolean;
  /** False when no Supabase project is configured — the app degrades to no persistence. */
  configured: boolean;
  /** Last sign-in failure, for surfacing in the dialog. */
  error: string;
  /** A non-error message from an email link, e.g. "Your email is confirmed". */
  notice: string;
  /**
   * Set when an email link sent the user back here to finish by hand — to log
   * in after confirming, or to ask for a fresh reset link. The sign-in card
   * opens straight onto that form.
   */
  emailView: EmailMode | null;
  /**
   * Bumped when rows change owner underneath the app — currently only after an
   * anonymous account's analyses are claimed by a permanent one. Anything
   * displaying that data should refetch when it moves.
   */
  dataVersion: number;
  /**
   * The current user, creating an anonymous one if needed. Called at the moment
   * someone starts an analysis, never on page load — anonymous users are real
   * `auth.users` rows and we don't want one per crawler visit.
   */
  ensureAnonymous: () => Promise<User | null>;
  signIn: (provider: AuthProviderId) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<EmailAuthResult>;
  /** Creates the account; the user is signed in once they open the confirmation link. */
  signUpWithEmail: (email: string, password: string) => Promise<EmailAuthResult>;
  resendConfirmation: (email: string) => Promise<EmailAuthResult>;
  /** Emails a link that signs the user in on `/account/password` to choose a new one. */
  sendPasswordReset: (email: string) => Promise<EmailAuthResult>;
  /** Sets a password for the signed-in user — after a reset link, or from the account page. */
  updatePassword: (password: string) => Promise<EmailAuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = tryGetSupabaseBrowserClient();
  const configured = supabase !== null;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(configured);
  // Captured on the first client render, before the effect below strips these
  // from the address bar. Nothing rendered during hydration depends on them —
  // the sign-in cards that display them wait for `loading` or for a click —
  // so reading `window` here can't produce a server/client mismatch.
  const [returnParams] = useState(readReturnParams);
  const [error, setError] = useState(returnParams.error);
  const [notice, setNotice] = useState(returnParams.notice);
  const [emailView, setEmailView] = useState(returnParams.emailView);
  const [dataVersion, setDataVersion] = useState(0);
  // signInAnonymously is not idempotent — two concurrent calls create two users.
  const anonInFlight = useRef<Promise<User | null> | null>(null);

  // Whatever an earlier redirect said is stale once the user tries again.
  const clearMessages = useCallback(() => {
    setError("");
    setNotice("");
    setEmailView(null);
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      setUser(data.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // After returning from a provider: claim anything the anonymous session left
  // behind, and run the one permitted retry when identity linking was refused.
  useEffect(() => {
    if (!supabase || loading) return;

    const { retry } = returnParams;
    stripReturnParams();

    // `linkIdentity` was refused because this Google/Apple/LinkedIn account
    // already belongs to a permanent user. Sign into *that* account instead;
    // the stashed anonymous id below is what carries the analyses over.
    if (retry && isAuthProviderId(retry)) {
      void supabase.auth.signInWithOAuth({
        provider: retry,
        options: { redirectTo: callbackUrl(currentPath()) },
      });
      return;
    }

    if (!user || user.is_anonymous) return;

    const stashed = window.localStorage.getItem(ANON_STASH_KEY);
    if (!stashed) return;
    window.localStorage.removeItem(ANON_STASH_KEY);

    // Same id means linkIdentity worked and the rows never moved.
    if (stashed === user.id) return;

    void supabase
      .rpc("claim_anonymous_analyses", { p_anon_id: stashed })
      .then(({ data }) => {
        // Anything already on screen was fetched before these rows arrived.
        if (data) setDataVersion((v) => v + 1);
      });
  }, [supabase, user, loading, returnParams]);

  const ensureAnonymous = useCallback(async (): Promise<User | null> => {
    if (!supabase) return null;
    if (user) return user;
    if (anonInFlight.current) return anonInFlight.current;

    const run = (async () => {
      // Re-read rather than trusting state: another tab may have signed in.
      const { data: existing } = await supabase.auth.getUser();
      if (existing.user) return existing.user;

      const { data, error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        // Anonymous sign-ins disabled, or rate-limited. The analysis still runs;
        // it just won't be saved.
        console.warn("[auth] anonymous sign-in failed:", signInError.message);
        return null;
      }
      return data.user ?? null;
    })();

    anonInFlight.current = run;
    try {
      return await run;
    } finally {
      anonInFlight.current = null;
    }
  }, [supabase, user]);

  const signIn = useCallback(
    async (provider: AuthProviderId) => {
      if (!supabase) return;
      clearMessages();

      const redirectTo = callbackUrl(currentPath());

      // Upgrading an anonymous account in place keeps its analyses without
      // touching a single row. Only possible while the user *is* anonymous.
      if (user?.is_anonymous) {
        window.localStorage.setItem(ANON_STASH_KEY, user.id);
        const { error: linkError } = await supabase.auth.linkIdentity({
          provider,
          options: { redirectTo: `${redirectTo}&link=${provider}` },
        });
        if (!linkError) return;

        // Manual linking is off in the project settings, or the provider is
        // already attached. Fall through to a normal sign-in.
        console.warn("[auth] linkIdentity failed, signing in normally:", linkError.message);
      }

      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (oauthError) setError(describeAuthError(oauthError).message);
    },
    [supabase, user, clearMessages],
  );

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<EmailAuthResult> => {
      if (!supabase) return NOT_CONFIGURED;
      clearMessages();

      // Logging into an existing account from an anonymous session: park the
      // anonymous id first, so the claim above carries its analyses across
      // the moment the new session lands. Left in place if this fails, like
      // the OAuth path — whichever sign-in succeeds next picks it up.
      if (user?.is_anonymous) window.localStorage.setItem(ANON_STASH_KEY, user.id);

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      return signInError ? failed(signInError) : { status: "done" };
    },
    [supabase, user, clearMessages],
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string): Promise<EmailAuthResult> => {
      if (!supabase) return NOT_CONFIGURED;
      clearMessages();

      const emailRedirectTo = callbackUrl(currentPath(), "signup");

      // Upgrade an anonymous account in place, as `linkIdentity` does for
      // OAuth: the password is set now, the email once its link is opened, and
      // the analyses never change hands.
      if (user?.is_anonymous) {
        let { data, error: upgradeError } = await supabase.auth.updateUser(
          { email, password },
          { emailRedirectTo },
        );
        // A second attempt, after the first one set this same password but its
        // address was wrong: Supabase won't "change" a password to itself, so
        // send just the new address.
        if (upgradeError?.code === "same_password") {
          ({ data, error: upgradeError } = await supabase.auth.updateUser(
            { email },
            { emailRedirectTo },
          ));
        }
        // With "Confirm email" turned off the address is accepted on the spot.
        if (!upgradeError) return data.user?.is_anonymous ? { status: "check-email" } : { status: "done" };

        // The project wants a recent login before any password change, which
        // an anonymous session can never provide. Create the account
        // separately instead; the stash lets its first sign-in in this
        // browser claim the analyses.
        if (upgradeError.code !== NEEDS_FRESH_LOGIN) return failed(upgradeError);
        window.localStorage.setItem(ANON_STASH_KEY, user.id);
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo },
      });
      if (signUpError) return failed(signUpError);
      if (data.session) return { status: "done" };

      // A confirmed address comes back as a decoy user with no identities,
      // and no email is sent — Supabase's guard against probing for accounts.
      // It's the one hint there is, so say it plainly.
      if (data.user?.identities?.length === 0) {
        return failed(new AuthError("User already registered", 422, ACCOUNT_EXISTS));
      }
      return { status: "check-email" };
    },
    [supabase, user, clearMessages],
  );

  const resendConfirmation = useCallback(
    async (email: string): Promise<EmailAuthResult> => {
      if (!supabase) return NOT_CONFIGURED;
      clearMessages();

      const emailRedirectTo = callbackUrl(currentPath(), "signup");

      // A pending anonymous upgrade is an email change rather than a sign-up,
      // and asking for the change again is the only way to resend its link.
      const pendingUpgrade =
        user?.is_anonymous && user.new_email?.toLowerCase() === email.trim().toLowerCase();

      const { error: resendError } = pendingUpgrade
        ? await supabase.auth.updateUser({ email }, { emailRedirectTo })
        : await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo } });
      return resendError ? failed(resendError) : { status: "check-email" };
    },
    [supabase, user, clearMessages],
  );

  const sendPasswordReset = useCallback(
    async (email: string): Promise<EmailAuthResult> => {
      if (!supabase) return NOT_CONFIGURED;
      clearMessages();

      // Supabase answers the same whether or not the address has an account,
      // so this can't be used to find out who's signed up.
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl("/account/password", "recovery"),
      });
      return resetError ? failed(resetError) : { status: "check-email" };
    },
    [supabase, clearMessages],
  );

  const updatePassword = useCallback(
    async (password: string): Promise<EmailAuthResult> => {
      if (!supabase) return NOT_CONFIGURED;
      // `password_set` is how the account page knows a Google account has
      // added a password — Supabase doesn't say. See `hasPassword`.
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      });
      return updateError ? failed(updateError) : { status: "done" };
    },
    [supabase],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    window.localStorage.removeItem(ANON_STASH_KEY);
    clearMessages();
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase, clearMessages]);

  const value: AuthContextValue = {
    user,
    isIdentified: Boolean(user) && !user?.is_anonymous,
    isAnonymous: Boolean(user?.is_anonymous),
    loading,
    configured,
    error,
    notice,
    emailView,
    dataVersion,
    ensureAnonymous,
    signIn,
    signInWithEmail,
    signUpWithEmail,
    resendConfirmation,
    sendPasswordReset,
    updatePassword,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const NOT_CONFIGURED: EmailAuthResult = {
  status: "error",
  message: "Accounts aren't available right now.",
};

function failed(error: unknown): EmailAuthResult {
  return { status: "error", ...describeAuthError(error) };
}

/**
 * The query parameters `/auth/callback` and `/auth/confirm` use to hand a
 * result back to the page they redirect to.
 */
const RETURN_PARAMS = ["auth_retry", "auth_error", "auth_notice", "auth_email"];

interface ReturnParams {
  retry: string | null;
  error: string;
  notice: string;
  emailView: EmailMode | null;
}

/** What the auth routes handed back on this page load, if anything. */
function readReturnParams(): ReturnParams {
  if (typeof window === "undefined") return { retry: null, error: "", notice: "", emailView: null };
  const params = new URLSearchParams(window.location.search);
  const view = params.get("auth_email");
  return {
    retry: params.get("auth_retry"),
    error: params.get("auth_error") ?? "",
    notice: params.get("auth_notice") ?? "",
    emailView: view === "login" || view === "signup" || view === "forgot" ? view : null,
  };
}

/** Take them back out of the address bar — a reload shouldn't replay them. */
function stripReturnParams(): void {
  const params = new URLSearchParams(window.location.search);
  if (!RETURN_PARAMS.some((key) => params.has(key))) return;
  for (const key of RETURN_PARAMS) params.delete(key);
  const query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
}

function currentPath(): string {
  return window.location.pathname + window.location.search;
}

/**
 * Where OAuth providers and email links come back to: the code-exchange
 * route, which then forwards to `next`. `flow` marks an email link.
 */
function callbackUrl(next: string, flow?: EmailFlow): string {
  const params = new URLSearchParams({ next });
  if (flow) params.set("flow", flow);
  return `${window.location.origin}/auth/callback?${params}`;
}
