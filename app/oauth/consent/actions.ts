"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

/**
 * The server half of the consent page Supabase's OAuth server sends people to
 * when Claude asks to connect (`/oauth/consent?authorization_id=…`).
 *
 * Server actions rather than calls from the browser: they ride the session
 * cookie like every other server call, and a server-side request carries no
 * `Origin` for Supabase to weigh against the Site URL.
 */

/** Supabase mints these as 32 base32 characters. Anything else never reaches it. */
const AUTHORIZATION_ID = /^[A-Za-z0-9]{32}$/;

const DEAD_LINK =
  "This connection link has expired or was already used. Go back to Claude and connect SevenFold again to get a fresh one.";

export type AuthorizationRequest =
  | {
      kind: "consent";
      clientName: string;
      /** Where the browser goes after a decision: claude.ai, or localhost for Claude Code. */
      redirectHost: string;
      scopes: string[];
      email: string;
    }
  /** Already approved before: straight back to the app, no question asked. */
  | { kind: "redirect"; url: string }
  | { kind: "error"; message: string };

export type AuthorizationDecision = { kind: "redirect"; url: string } | { kind: "error"; message: string };

/**
 * Looks up a pending authorization request for the signed-in user.
 *
 * Call it once per page view. Supabase binds the request to whoever asks
 * first, and once it's past pending — approved, denied, or auto-approved
 * because the user consented before — every further lookup fails.
 */
export async function loadAuthorization(authorizationId: string): Promise<AuthorizationRequest> {
  const session = await signedInClient(authorizationId);
  if ("error" in session) return { kind: "error", message: session.error };

  const { data, error } = await session.supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) {
    console.error("[oauth] authorization lookup failed:", error?.status, error?.message);
    return { kind: "error", message: DEAD_LINK };
  }

  if (!("authorization_id" in data)) return redirectOrError(data.redirect_url);

  return {
    kind: "consent",
    clientName: data.client.name?.trim() || "An app",
    redirectHost: hostOf(data.redirect_uri),
    scopes: data.scope.split(" ").filter(Boolean),
    email: data.user.email || session.email,
  };
}

/** Approves or denies the request, and says where to send the browser next. */
export async function decideAuthorization(
  authorizationId: string,
  approve: boolean,
): Promise<AuthorizationDecision> {
  const session = await signedInClient(authorizationId);
  if ("error" in session) return { kind: "error", message: session.error };

  const { oauth } = session.supabase.auth;
  const { data, error } = approve
    ? await oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    : await oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
  if (error || !data) {
    console.error("[oauth] authorization decision failed:", error?.status, error?.message);
    return { kind: "error", message: DEAD_LINK };
  }
  return redirectOrError(data.redirect_url);
}

/**
 * A server client for a signed-in, non-anonymous user. Anonymous sessions can
 * technically consent, but the analyses Claude made would land on a throwaway
 * browser identity nobody can sign back into.
 */
async function signedInClient(
  authorizationId: string,
): Promise<{ supabase: SupabaseClient<Database>; email: string } | { error: string }> {
  if (!AUTHORIZATION_ID.test(authorizationId)) return { error: DEAD_LINK };

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || claims.is_anonymous) {
    return { error: "Log in to your SevenFold account first, then try again." };
  }
  return { supabase, email: typeof claims.email === "string" ? claims.email : "" };
}

/**
 * Supabase builds the redirect from the client's registered redirect URI, but
 * the browser is about to be sent there, so nothing but http(s) gets through.
 */
function redirectOrError(url: string | undefined): AuthorizationDecision {
  try {
    const parsed = new URL(url ?? "");
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return { kind: "redirect", url: parsed.href };
  } catch {
    // fall through
  }
  console.error("[oauth] unusable redirect URL from Supabase");
  return { kind: "error", message: DEAD_LINK };
}

function hostOf(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}
