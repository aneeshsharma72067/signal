-- Signal — global feed migration.
-- Moves from the delivery-based feed (random 5 recipients) to a public global
-- feed: every authenticated user sees every note, newest first. Reactions become
-- one-per-user-per-note (toggleable). Authors may delete their own notes.
--
-- The deliveries table and deliver-note edge function are intentionally left in
-- place (unused by the feed now) to keep this migration reversible.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- Reactions: one per (user, note), toggleable / switchable.
-- ─────────────────────────────────────────────────────────────

-- Collapse any pre-existing duplicate reactions down to a single row per
-- (reactor, note) so the unique index below can be created.
delete from public.reactions r
using public.reactions keep
where r.reactor_user_id = keep.reactor_user_id
  and r.voice_note_id = keep.voice_note_id
  and r.ctid < keep.ctid;

create unique index if not exists reactions_user_note_uniq
  on public.reactions (reactor_user_id, voice_note_id);

-- Replace the delivery-gated insert policy with author-agnostic self policies.
drop policy if exists "reactions_insert_delivered" on public.reactions;

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

-- ─────────────────────────────────────────────────────────────
-- Voice notes: authors may delete their own (reactions cascade via FK).
-- (select/insert policies already exist from 0001.)
-- ─────────────────────────────────────────────────────────────

create policy "voice_notes_delete_own" on public.voice_notes
  for delete to authenticated
  using (auth.uid() = user_id);

create index if not exists voice_notes_created_idx
  on public.voice_notes (created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Storage: authors may delete their own audio objects (own uid folder).
-- ─────────────────────────────────────────────────────────────

create policy "voice_notes_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
