import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isAuthProviderId } from "@/components/features/auth/providers";
import { codeUnusable, deadLink, redirectTo, safeNext, type EmailFlow } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where OAuth sign-ins and Supabase's default email links land: swaps the
 * PKCE `code` for a session cookie, then bounces back to wherever the user
 * was when they started.
 *
 * Also handles the interesting failures:
 *
 * - When an anonymous user tries to attach an identity that already belongs
 *   to somebody else, Supabase sends them here with an error instead of a
 *   code. We pass `auth_retry=<provider>` back to the client, which signs
 *   into the existing account and then re-parents the anonymous user's
 *   analyses (see AuthProvider).
 * - An email link (`flow=signup|recovery`) that can't sign anyone in. A
 *   default link's code only redeems in the browser that asked for it, and
 *   only for five minutes — past that it still confirms the address, but
 *   the user has to log in by hand, or ask for another reset link. The
 *   templates in `supabase/templates` link to `/auth/confirm` instead, which
 *   has neither limit.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const code = searchParams.get("code");
  const linkProvider = searchParams.get("link");
  const flow = searchParams.get("flow");
  const emailFlow: EmailFlow | null = flow === "signup" || flow === "recovery" ? flow : null;
  const errorDescription = searchParams.get("error_description") ?? searchParams.get("error");

  if (errorDescription) {
    // The link attempt lost a race with an existing account — retry as a plain
    // sign-in. Only ever offered once: the retry URL carries no `link` param.
    if (linkProvider && isAuthProviderId(linkProvider)) {
      return redirectTo(request, next, { auth_retry: linkProvider });
    }
    if (emailFlow) return deadLink(request, emailFlow);
    return redirectTo(request, next, { auth_error: errorDescription });
  }

  if (!code) {
    if (emailFlow) return deadLink(request, emailFlow);
    return redirectTo(request, next, { auth_error: "Sign-in was cancelled." });
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    if (linkProvider && isAuthProviderId(linkProvider)) {
      return redirectTo(request, next, { auth_retry: linkProvider });
    }
    if (emailFlow) return codeUnusable(request, emailFlow);
    return redirectTo(request, next, { auth_error: error.message });
  }

  return redirectTo(request, next);
}
