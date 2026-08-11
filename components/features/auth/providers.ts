/** The OAuth providers this app offers, in the order they're shown. */
export const AUTH_PROVIDERS = [
  { id: "google", label: "Continue with Google" },
  { id: "linkedin_oidc", label: "Continue with LinkedIn" },
  { id: "apple", label: "Continue with Apple" },
] as const;

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]["id"];

export function isAuthProviderId(value: string): value is AuthProviderId {
  return AUTH_PROVIDERS.some((p) => p.id === value);
}
