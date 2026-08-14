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
import type { User } from "@supabase/supabase-js";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { isAuthProviderId, type AuthProviderId } from "./providers";

/**
 * Where the id of an anonymous user is parked while the browser is away at an
 * OAuth provider. Read back after sign-in to re-parent that user's analyses if
 * they landed in a different account — see `reconcile` below.
 */
const ANON_STASH_KEY = "vc-analyst:anon-id";

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
  // the dialog that displays `error` is closed until the user opens it — so
  // reading `window` here can't produce a server/client mismatch.
  const [returnParams] = useState(readReturnParams);
  const [error, setError] = useState(returnParams.error);
  const [dataVersion, setDataVersion] = useState(0);
  // signInAnonymously is not idempotent — two concurrent calls create two users.
  const anonInFlight = useRef<Promise<User | null> | null>(null);

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
        options: { redirectTo: callbackUrl() },
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
      setError("");

      const redirectTo = callbackUrl();

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
      if (oauthError) setError(oauthError.message);
    },
    [supabase, user],
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    window.localStorage.removeItem(ANON_STASH_KEY);
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  const value: AuthContextValue = {
    user,
    isIdentified: Boolean(user) && !user?.is_anonymous,
    isAnonymous: Boolean(user?.is_anonymous),
    loading,
    configured,
    error,
    dataVersion,
    ensureAnonymous,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** What `/auth/callback` handed back on this page load, if anything. */
function readReturnParams(): { retry: string | null; error: string } {
  if (typeof window === "undefined") return { retry: null, error: "" };
  const params = new URLSearchParams(window.location.search);
  return { retry: params.get("auth_retry"), error: params.get("auth_error") ?? "" };
}

/** Take them back out of the address bar — a reload shouldn't replay them. */
function stripReturnParams(): void {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("auth_retry") && !params.has("auth_error")) return;
  params.delete("auth_retry");
  params.delete("auth_error");
  const query = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (query ? `?${query}` : ""));
}

/** Return to the page the user started from, via the code-exchange route. */
function callbackUrl(): string {
  const next = window.location.pathname + window.location.search;
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
}
