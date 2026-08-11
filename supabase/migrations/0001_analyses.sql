-- ============================================================================
--  Analyses: server-side storage for finished due-diligence runs.
-- ----------------------------------------------------------------------------
--  Replaces the old localStorage history (10-record cap, per-device). Every
--  visitor gets an auth.users row — anonymous ones are created lazily when they
--  first click "Analyze" — so persistence works identically whether or not the
--  person has attached a Google/Apple/LinkedIn identity yet.
-- ============================================================================

create table public.analyses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  -- SHA-256 of the PDF bytes. Doubles as the /due-diligence/[id] URL segment and
  -- as the dedupe key that lets a re-upload of the same deck reopen its report.
  deck_hash    text not null,
  name         text not null default 'Untitled deck',
  status       text not null default 'running' check (status in ('running', 'done', 'error')),
  -- The full client-side AnalysisState, built server-side by streamReducer.
  state        jsonb,
  deck_path    text,
  deck_bytes   integer,
  error        text,
  created_at   timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, deck_hash)
);

create index analyses_user_created_idx on public.analyses (user_id, created_at desc);

alter table public.analyses enable row level security;

create policy "own analyses" on public.analyses
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ─────────────────────────────  Deck storage  ───────────────────────────────
--  Private bucket; objects live at `${user_id}/${analysis_id}.pdf` and are only
--  ever handed out through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('decks', 'decks', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy "own decks" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'decks' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'decks' and (storage.foldername(name))[1] = auth.uid()::text);


-- ────────────────────  Anonymous → permanent account merge  ─────────────────
--
--  The happy path when an anonymous user signs in is `linkIdentity()`: the same
--  auth.users row gains a Google/Apple/LinkedIn identity and its analyses come
--  along for free. That call fails when the identity already belongs to another
--  user (a returning user signing in from a fresh browser). In that case the
--  client signs in normally and calls this function to re-parent the rows the
--  anonymous session left behind.
--
--  Guards: the source must still be an anonymous user (a permanent account can
--  never be drained this way), and rows are skipped where the caller already has
--  their own analysis of the same deck — the unique(user_id, deck_hash)
--  constraint would reject those anyway.

create function public.claim_anonymous_analyses(p_anon_id uuid)
  returns integer
  language plpgsql
  security definer
  set search_path = public
as $$
declare
  moved integer;
begin
  if auth.uid() is null or p_anon_id = auth.uid() then
    return 0;
  end if;

  if not exists (select 1 from auth.users where id = p_anon_id and is_anonymous) then
    return 0;
  end if;

  update public.analyses a
     set user_id = auth.uid()
   where a.user_id = p_anon_id
     and not exists (
       select 1 from public.analyses mine
        where mine.user_id = auth.uid()
          and mine.deck_hash = a.deck_hash
     );

  get diagnostics moved = row_count;
  return moved;
end;
$$;

revoke all on function public.claim_anonymous_analyses(uuid) from public, anon;
grant execute on function public.claim_anonymous_analyses(uuid) to authenticated;
