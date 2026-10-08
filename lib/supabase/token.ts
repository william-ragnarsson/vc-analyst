import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/config";
import type { Database } from "./types";

/**
 * Bearer-token auth for the MCP route (`app/mcp/route.ts`).
 *
 * Claude signs people in through Supabase's OAuth 2.1 server and then calls
 * `/mcp` with the access token it was issued: an ordinary Supabase JWT, plus a
 * `client_id` claim naming the OAuth app (Claude registers itself on first
 * connect). The token is verified locally against the project's JWKS, so a
 * tool call costs no round trip to the Auth server, and the per-request client
 * then forwards the same token, so RLS scopes every query to that user exactly
 * as it does for the browser.
 */

const NO_SESSION = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

/** Who a verified token belongs to. */
export interface TokenUser {
  userId: string;
  email: string | null;
  isAnonymous: boolean;
  /** The OAuth app the token was issued to; null for a browser session token. */
  clientId: string | null;
  scopes: string[];
  /** Expiry, in seconds since the epoch. */
  expiresAt: number;
  /** When it was issued, in seconds since the epoch, if it says. */
  issuedAt: number | null;
}

// One client for verification, kept across requests: it caches the JWKS, so
// only a cold start fetches the signing keys.
let verifier: SupabaseClient<Database> | null = null;

function getVerifier(): SupabaseClient<Database> {
  verifier ??= createClient<Database>(getSupabaseUrl(), getSupabaseKey(), { auth: NO_SESSION });
  return verifier;
}

/**
 * Returns the user a token belongs to, or null if it isn't one we accept.
 *
 * Production accepts only tokens minted by the OAuth server (they carry
 * `client_id`) for real accounts. `next dev` also takes the browser's own
 * session token, anonymous or not, so the tools can be exercised locally
 * before the OAuth server is switched on.
 */
export async function verifyAccessToken(token: string): Promise<TokenUser | null> {
  let claims: Record<string, unknown>;
  try {
    const { data, error } = await getVerifier().auth.getClaims(token);
    if (error || !data) return null;
    claims = data.claims as Record<string, unknown>;
  } catch {
    return null; // malformed token, or the JWKS couldn't be fetched
  }

  // getClaims checks the signature and expiry, nothing else. A token for this
  // project's users has this issuer, this audience and this role.
  const issuer = `${getSupabaseUrl().replace(/\/+$/, "")}/auth/v1`;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (claims.iss !== issuer || !audience.includes("authenticated") || claims.role !== "authenticated") {
    return null;
  }
  if (typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number") return null;

  const clientId = typeof claims.client_id === "string" && claims.client_id ? claims.client_id : null;
  const isAnonymous = claims.is_anonymous === true;

  if (process.env.NODE_ENV !== "development") {
    // An anonymous session is a browser tab, not an account Claude can be
    // connected to, and a session token wasn't issued for this server at all.
    if (!clientId || isAnonymous) return null;
  }

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" && claims.email ? claims.email : null,
    isAnonymous,
    clientId,
    scopes: typeof claims.scope === "string" ? claims.scope.split(" ").filter(Boolean) : [],
    expiresAt: claims.exp,
    issuedAt: typeof claims.iat === "number" ? claims.iat : null,
  };
}

/**
 * A Supabase client that acts as the token's owner. Never share one across
 * requests — it carries that request's token.
 */
export function createSupabaseClientForToken(token: string): SupabaseClient<Database> {
  return createClient<Database>(getSupabaseUrl(), getSupabaseKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: NO_SESSION,
  });
}
