import type { Metadata } from "next";
import ConsentScreen from "./ConsentScreen";

export const metadata: Metadata = {
  title: "Connect to SevenFold",
  robots: { index: false, follow: false },
};

/**
 * Supabase's OAuth server (Authentication → OAuth Server, authorization path
 * `/oauth/consent`) sends people here with the request to approve.
 */
export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { authorization_id: id } = await searchParams;
  return <ConsentScreen authorizationId={typeof id === "string" && id ? id : null} />;
}
