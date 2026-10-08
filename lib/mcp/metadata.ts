import { getPublicOrigin, metadataCorsOptionsRequestHandler, protectedResourceHandler } from "mcp-handler";
import { getSupabaseUrl } from "@/lib/config";

/**
 * OAuth protected-resource metadata (RFC 9728) for `/mcp`: tells Claude that
 * the server is `<origin>/mcp` and that Supabase Auth issues its tokens.
 *
 * Served at both `/.well-known/oauth-protected-resource/mcp` (where the 401's
 * `WWW-Authenticate` header points; a rewrite in next.config.ts) and the bare
 * path, which clients try when they don't get that header. Both describe the
 * same resource.
 */
export function protectedResourceMetadata(req: Request): Response {
  const authServer = `${getSupabaseUrl().replace(/\/+$/, "")}/auth/v1`;
  return protectedResourceHandler({
    authServerUrls: [authServer],
    resourceUrl: `${getPublicOrigin(req)}/mcp`,
  })(req);
}

/** CORS preflight, for MCP clients that run in a browser. */
export const metadataPreflight = metadataCorsOptionsRequestHandler();
