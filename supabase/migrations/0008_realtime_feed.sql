-- Signal — enable realtime on the feed.
-- Problem: the feed loaded once and went stale — a new broadcast or a reaction
-- was invisible until the viewer pulled to refresh. At 100+ active users the
-- feed is always behind.
--
-- Fix: add voice_notes to the supabase_realtime publication so the client can
-- subscribe to INSERTs (new broadcasts) and UPDATEs (reaction aggregates from
-- migration 0006's trigger). REPLICA IDENTITY FULL so UPDATE payloads carry the
-- changed row's columns.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

alter table public.voice_notes replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'voice_notes'
  ) then
    alter publication supabase_realtime add table public.voice_notes;
  end if;
end $$;
