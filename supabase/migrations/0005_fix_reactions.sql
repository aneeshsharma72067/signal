-- Signal — reactions repair.
-- Symptom: reacting bumps a count then it reverts, and refresh shows nothing.
-- Cause: migration 0002 never reached this database, so reactions still carried
-- the original delivery-gated insert policy (reactions_insert_delivered) and
-- lacked the unique index the app's upsert targets. Every reaction write failed:
--   42501  new row violates row-level security policy for table "reactions"
--   42P10  no unique or exclusion constraint matching the ON CONFLICT specification
-- This migration is a self-contained, idempotent restatement of the reactions
-- half of 0002 so a single `supabase db push` (or SQL-editor paste) repairs a DB
-- that got 0001/0003 but skipped 0002.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- Collapse any pre-existing duplicate (reactor, note) rows down to one so the
-- unique index can be created.
delete from public.reactions r
using public.reactions keep
where r.reactor_user_id = keep.reactor_user_id
  and r.voice_note_id = keep.voice_note_id
  and r.ctid < keep.ctid;

-- The upsert onConflict target. Without this, ON CONFLICT → 42P10.
create unique index if not exists reactions_user_note_uniq
  on public.reactions (reactor_user_id, voice_note_id);

-- Drop the delivery-gated insert policy (global feed creates no delivery rows,
-- so it rejected every reaction with 42501) and replace with self-scoped
-- insert/update/delete policies.
drop policy if exists "reactions_insert_delivered" on public.reactions;
drop policy if exists "reactions_insert_own" on public.reactions;
drop policy if exists "reactions_update_own" on public.reactions;
drop policy if exists "reactions_delete_own" on public.reactions;

create policy "reactions_insert_own" on public.reactions
  for insert to authenticated
  with check (auth.uid() = reactor_user_id);

create policy "reactions_update_own" on public.reactions
  for update to authenticated
  using (auth.uid() = reactor_user_id)
  with check (auth.uid() = reactor_user_id);

create policy "reactions_delete_own" on public.reactions
  for delete to authenticated
  using (auth.uid() = reactor_user_id);
