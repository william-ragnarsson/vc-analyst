import { createMcpHandler, withMcpAuth } from "mcp-handler";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { registerSevenFold, SERVER_OPTIONS } from "@/lib/mcp/server";
import { verifyAccessToken } from "@/lib/supabase/token";

/**
 * SevenFold's remote MCP server, for Claude (claude.ai connectors, Claude Code,
 * Claude Desktop): `https://<site>/mcp`, Streamable HTTP.
 *
 * Sign-in is Supabase's OAuth 2.1 server. A request without a valid token gets
 * a 401 pointing at `/.well-known/oauth-protected-resource/mcp`, which names
 * Supabase as the authorization server; Claude registers itself there, sends
 * the user through `/oauth/consent`, and comes back with a token for them.
 */

export const runtime = "nodejs";
// A tool call answers within a minute, but the analysis it starts keeps this
// function alive (`after()`) until it's done — up to the full five minutes.
export const maxDuration = 300;

/**
 * Tokens this close to expiry are turned away as expired so Claude refreshes
 * first: a run started now writes with this token for up to five minutes.
 */
const EXPIRY_MARGIN_S = 6 * 60;

async function verify(_req: Request, token?: string): Promise<AuthInfo | undefined> {
  if (!token) return undefined;
  const user = await verifyAccessToken(token);
  if (!user) return undefined;

  // Only when the token lives long enough for the margin to leave anything:
  // a project with very short JWTs would otherwise reject every token.
  const lifetime = user.issuedAt === null ? 0 : user.expiresAt - user.issuedAt;
  const margin = lifetime > 2 * EXPIRY_MARGIN_S ? EXPIRY_MARGIN_S : 0;

  return {
    token,
    clientId: user.clientId ?? "session",
    scopes: user.scopes,
    expiresAt: user.expiresAt - margin,
    extra: { userId: user.userId, email: user.email, isAnonymous: user.isAnonymous },
  };
}

const handler = withMcpAuth(createMcpHandler(registerSevenFold, SERVER_OPTIONS), verify, {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource/mcp",
});

export { handler as GET, handler as POST, handler as DELETE };
