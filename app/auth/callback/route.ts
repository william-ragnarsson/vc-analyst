import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAuthProviderId } from "@/components/features/auth/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The OAuth landing point: swaps the PKCE `code` for a session cookie, then
 * bounces back to wherever the user was when they clicked sign in.
 *
 * Also handles the one interesting failure. When an anonymous user tries to
 * attach an identity that already belongs to somebody else, Supabase sends them
 * here with an error instead of a code. We pass `auth_retry=<provider>` back to
 * the client, which signs into the existing account and then re-parents the
 * anonymous user's analyses (see AuthProvider).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const linkProvider = searchParams.get("link");
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorDescription) {
    // The link attempt lost a race with an existing account — retry as a plain
    // sign-in. Only ever offered once: the retry URL carries no `link` param.
    if (linkProvider && isAuthProviderId(linkProvider)) {
      return redirect(request, origin, next, `auth_retry=${linkProvider}`);
    }
    return redirect(request, origin, next, `auth_error=${encodeURIComponent(errorDescription)}`);
  }

  if (!code) {
    return redirect(request, origin, next, "auth_error=Sign-in%20was%20cancelled.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (linkProvider && isAuthProviderId(linkProvider)) {
      return redirect(request, origin, next, `auth_retry=${linkProvider}`);
    }
    return redirect(request, origin, next, `auth_error=${encodeURIComponent(error.message)}`);
  }

  return redirect(request, origin, next);
}

/** Only ever redirect within this app — never to a caller-supplied host. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function redirect(request: NextRequest, origin: string, next: string, query?: string) {
  // Behind Vercel's proxy the request origin is the internal host; the
  // forwarded header is the one the browser actually used.
  const forwardedHost = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const base =
    process.env.NODE_ENV === "development" || !forwardedHost
      ? origin
      : `${proto}://${forwardedHost}`;

  const url = new URL(next, base);
  if (query) {
    const [key, value = ""] = query.split("=");
    url.searchParams.set(key, decodeURIComponent(value));
  }
  return NextResponse.redirect(url);
}
