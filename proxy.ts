import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isSupabaseConfigured } from "@/lib/config";

/**
 * Refreshes the Supabase session on every request.
 *
 * Access tokens are short-lived. Server code (`/api/analyze`, `/auth/callback`)
 * reads the session from cookies, so something has to rotate the refresh token
 * and write the new cookies back — that's this. Without it you get the classic
 * symptoms: random sign-outs and analyses that fail to save after an hour idle.
 *
 * This is Next 16's `proxy.ts`, the rename of `middleware.ts`. Two things
 * changed with it: the exported function is named `proxy`, and the `edge`
 * runtime is no longer supported here (it always runs on Node and can't be
 * configured). See `docs/01-app/02-guides/upgrading/version-16.md`.
 *
 * Nothing in this app is gated, so this never redirects — it only touches
 * cookies. Auth checks live next to the data they protect (RLS in Postgres,
 * an explicit user lookup in the analyze route).
 */
export async function proxy(request: NextRequest) {
  // `getAll` reads from the *request*; `setAll` has to write to both, so that
  // the refreshed token is visible to the rest of this request as well as to
  // the browser. Recreating the response after setting request cookies is the
  // documented Supabase pattern — don't "simplify" it.
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Responses carrying Set-Cookie for auth must never be cached by a
          // CDN, or one visitor's session is served to the next.
          for (const [key, headerValue] of Object.entries(headers)) {
            response.headers.set(key, headerValue);
          }
        },
      },
    },
  );

  // Must be awaited before the response is returned, or a refresh that lands
  // late has nowhere to write its cookies.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets — those never carry a session and
     * waking a Node function for each one is pure waste.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|txt|xml|woff|woff2)$).*)",
  ],
};
