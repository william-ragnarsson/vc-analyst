import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/config";
import type { Database } from "./types";

/**
 * SERVER-ONLY. Never import this from a `"use client"` file — it holds the
 * service-role key, which bypasses Row-Level Security entirely.
 *
 * This exists for exactly one reason: Supabase's SDK has no self-service
 * "delete my own account" call. `auth.admin.deleteUser(id)` is the only way to
 * remove an `auth.users` row, and the `admin` namespace only works with a
 * service-role client — RLS can't help here because RLS governs the `public`
 * schema, not `auth.users` itself. The one caller, `app/api/account/delete/
 * route.ts`, always resolves the target id from the caller's own session
 * before touching this client, never from client-supplied input.
 *
 * Not a cookie-bound session client (unlike `lib/supabase/server.ts`) — the
 * service role isn't anyone's identity, so there's nothing to persist.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
