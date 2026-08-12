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
