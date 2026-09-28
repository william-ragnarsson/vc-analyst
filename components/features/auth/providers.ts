import type { User } from "@supabase/supabase-js";

/**
 * The OAuth providers this app offers, in the order they're shown. Google
 * only for now — LinkedIn and Apple can be added back to this array later
 * (Apple in particular needs a paid developer account + domain verification
 * that hasn't been set up yet).
 */
export const AUTH_PROVIDERS = [{ id: "google", label: "Continue with Google" }] as const;

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];

export function isAuthProviderId(value: string): value is AuthProviderId {
  return AUTH_PROVIDERS.some((p) => p.id === value);
}

/** The ways `user` can log in, as Supabase records them, e.g. `["google", "email"]`. */
export function loginProviders(user: User): string[] {
  return user.app_metadata.providers ?? user.identities?.map((identity) => identity.provider) ?? [];
}

/**
 * Whether `user` can log in with an email and password. Signing up by email
 * always sets one. A Google account that adds one later doesn't show up in
 * its providers (Supabase only records that behind an experimental setting),
 * so `updatePassword` notes it in the user's metadata.
 */
export function hasPassword(user: User): boolean {
  return loginProviders(user).includes("email") || user.user_metadata?.password_set === true;
}
