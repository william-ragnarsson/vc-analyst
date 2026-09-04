import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseKey, getSupabaseUrl } from "@/lib/config";
import type { Database } from "./types";

/**
 * A request-scoped Supabase client for route handlers and server components.
 *
 * Never share one across requests — it carries that request's cookies. Note
 * `await cookies()`: Next 16 removed synchronous access to the request APIs
 * entirely (see `docs/01-app/02-guides/upgrading/version-16.md`).
 *
 * `setAll` is best-effort. Server Components can't write cookies, and Next
 * throws if you try, so we swallow that case — `proxy.ts` runs on every request
 * and is what actually persists refreshed tokens.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component — the proxy refreshes the session.
        }
      },
    },
  });
}
