import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminClient = ReturnType<typeof createSupabaseAdminClient>;

/** `remove()` accepts at most 1000 paths per call; `list()` defaults to 100. */
const DECK_BATCH_SIZE = 1000;

/**
 * Deletes the caller's own account, permanently. The target id always comes
 * from the caller's own session — never from the request body — so a bug
 * here can only ever let someone delete their own account.
 *
 * Deck files aren't covered by `analyses`' `on delete cascade` (that only
 * reaches Postgres rows, not Storage objects), so they're removed explicitly
 * before the user row goes; every `analyses` row disappears automatically
 * once it does. The order is load-bearing: Supabase refuses to delete a user
 * who still owns any Storage object, and deleting the user first would strand
 * their decks with no way left to ask for them to be removed.
 *
 * Every failure answers with JSON carrying a readable `error`. The account
 * page shows that message as-is; an unhandled throw becomes a bare 500 page
 * and all the user ever sees is "Failed to delete account."
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = data.user.id;

  let admin: AdminClient;
  try {
    admin = createSupabaseAdminClient();
  } catch (err) {
    // SUPABASE_SERVICE_ROLE_KEY isn't set. Surface the config message itself,
    // as /api/analyze does for its keys, so the fix is obvious. Nothing has
    // been touched yet.
    console.error("[account/delete] not configured:", err);
    const message = err instanceof Error ? err.message : "Account deletion is not configured.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const decksError = await removeAllDecks(admin, userId);
  if (decksError) {
    console.error("[account/delete] deck removal failed:", decksError);
    return NextResponse.json(
      { error: `Couldn't remove your uploaded decks, so your account was kept: ${decksError}` },
      { status: 500 },
    );
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    console.error("[account/delete] deleteUser failed:", deleteError.message);
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Empties the caller's deck folder; returns an error message, or null once
 * it's empty. Loops because `list()` returns a single page rather than the
 * whole folder.
 */
async function removeAllDecks(admin: AdminClient, userId: string): Promise<string | null> {
  const bucket = admin.storage.from("decks");
  for (;;) {
    const { data: files, error: listError } = await bucket.list(userId, { limit: DECK_BATCH_SIZE });
    if (listError) return listError.message;
    if (files.length === 0) return null;

    const { data: removed, error: removeError } = await bucket.remove(
      files.map((f) => `${userId}/${f.name}`),
    );
    if (removeError) return removeError.message;
    // No error but nothing gone either: stop rather than list the same page forever.
    if (removed.length === 0) return "some files could not be removed.";
  }
}
