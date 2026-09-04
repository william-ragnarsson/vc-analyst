import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Everything stored about the caller, as one downloadable JSON file — the
 * data-access counterpart to the delete route. Uses the caller's own
 * RLS-scoped session throughout, unlike delete: reading your own data needs
 * no elevated key, since the existing "own analyses" / "own decks" policies
 * already permit exactly this.
 *
 * Deck PDFs themselves aren't embedded — a signed URL per deck keeps this
 * simple (one JSON file, no zip step) while still being a complete export of
 * everything the database holds; the bytes are one click away via the link.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const user = data.user;

  const { data: analyses, error: analysesError } = await supabase.from("analyses").select("*");
  if (analysesError) {
    return NextResponse.json({ error: analysesError.message }, { status: 500 });
  }

  const rows = await Promise.all(
    (analyses ?? []).map(async (row) => {
      let deckUrl: string | null = null;
      if (row.deck_path) {
        const { data: signed } = await supabase.storage
          .from("decks")
          .createSignedUrl(row.deck_path, SIGNED_URL_TTL_SECONDS);
        deckUrl = signed?.signedUrl ?? null;
      }
      return {
        name: row.name,
        status: row.status,
        createdAt: row.created_at,
        completedAt: row.completed_at,
        error: row.error,
        report: row.state,
        deckUrl,
        deckUrlExpiresInSeconds: deckUrl ? SIGNED_URL_TTL_SECONDS : null,
      };
    }),
  );

  const body = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      email: user.email ?? null,
      createdAt: user.created_at,
      identities: (user.identities ?? []).map((i) => i.provider),
    },
    analyses: rows,
  };

  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="vc-analyst-export.json"',
    },
  });
}
