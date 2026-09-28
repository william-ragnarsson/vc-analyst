import type { NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deadLink, redirectTo, safeNext } from "../redirects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OTP_TYPES: EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function isOtpType(value: string | null): value is EmailOtpType {
  return OTP_TYPES.some((type) => type === value);
}

/**
 * Where the links in `supabase/templates` land. They carry a `token_hash`
 * that Supabase checks directly, so unlike its default links (see
 * `/auth/callback`) they sign the user in from any browser, for as long as
 * Supabase says the link is valid — opened on a phone after signing up on a
 * laptop, say.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  if (!tokenHash || !isOtpType(type)) {
    return redirectTo(request, "/account", {
      auth_error: "That link is incomplete. Try copying the whole link from the email.",
    });
  }

  const flow = type === "recovery" ? "recovery" : "signup";
  const next = safeNext(
    searchParams.get("next"),
    flow === "recovery" ? "/account/password" : "/due-diligence",
  );

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return deadLink(request, flow);

  return redirectTo(request, next);
}
