-- ============================================================================
--  OAuth clients: least privilege for apps connected through the MCP server.
-- ----------------------------------------------------------------------------
--  With Supabase's OAuth Server enabled, an app the user approves on
--  /oauth/consent (Claude, or anything else that registers itself) gets an
--  ordinary user JWT plus a `client_id` claim. The policies in 0001 don't look
--  at that claim, so such a token could do anything the website can — call
--  PostgREST directly to delete every report, or download the PDFs uploaded on
--  the site. The MCP tools need neither: they create and read analyses from
--  transcribed text, and never touch the decks bucket.
--
--  RESTRICTIVE policies are ANDed with the permissive ones, so these take
--  away exactly that from OAuth tokens and leave browser sessions (which have
--  no `client_id`) untouched.
-- ============================================================================

create policy "oauth clients can't delete analyses" on public.analyses
  as restrictive
  for delete
  to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "oauth clients can't reach decks" on storage.objects
  as restrictive
  for all
  to authenticated
  using (bucket_id <> 'decks' or (select auth.jwt() ->> 'client_id') is null)
  with check (bucket_id <> 'decks' or (select auth.jwt() ->> 'client_id') is null);
