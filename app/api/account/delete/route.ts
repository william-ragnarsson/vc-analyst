import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deletes the caller's own account, permanently. The target id always comes
 * from the caller's own session — never from the request body — so a bug
 * here can only ever let someone delete their own account.
 *
 * Deck files aren't covered by `analyses`' `on delete cascade` (that only
 * reaches Postgres rows, not Storage objects), so they're removed explicitly
 * before the user row goes; every `analyses` row disappears automatically
 * once it does.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const userId = data.user.id;

  const admin = createSupabaseAdminClient();

  const { data: files } = await admin.storage.from("decks").list(userId);
  if (files && files.length > 0) {
    await admin.storage.from("decks").remove(files.map((f) => `${userId}/${f.name}`));
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
