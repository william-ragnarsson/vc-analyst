import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseKey, getSupabaseUrl, isSupabaseConfigured } from "@/lib/config";
import type { Database } from "./types";

let cached: SupabaseClient<Database> | null = null;

/**
 * The browser-side Supabase client — one instance per tab.
 *
 * A singleton because every `createBrowserClient` call installs its own auth
 * state listener and refresh timer; several of them in one page fight over the
 * refresh token and cause spurious sign-outs.
 */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!cached) {
    cached = createBrowserClient<Database>(getSupabaseUrl(), getSupabaseKey());
  }
  return cached;
}

/** Same, but null when no Supabase project is configured — see `isSupabaseConfigured`. */
export function tryGetSupabaseBrowserClient(): SupabaseClient<Database> | null {
  return isSupabaseConfigured() ? getSupabaseBrowserClient() : null;
}
