-- Signal — voice replies.
-- Enables one-level-deep threaded voice conversations. Any authenticated user
-- can reply to a top-level note with a 30-second voice clip.
--
-- Changes:
--   1. voice_notes.parent_note_id  — self-referencing FK; non-null = reply.
--   2. voice_notes.reply_count     — denormalized count maintained by trigger.
--   3. Partial index for fast thread fetches (parent → replies ASC).
--   4. update_reply_count trigger  — inc/dec reply_count on the parent row.
--   5. notify_on_reply trigger     — notifies the note author when someone replies.
--   6. notifications type check    — extended to include 'reply'.
--
-- Idempotent (IF NOT EXISTS / OR REPLACE / DROP-then-CREATE).
-- Run in the Supabase SQL editor or via `supabase db push`.

-- ─────────────────────────────────────────────────────────────
-- 1. New columns on voice_notes
-- ─────────────────────────────────────────────────────────────

alter table public.voice_notes
  add column if not exists parent_note_id uuid
    references public.voice_notes (id) on delete cascade;

-- reply_count: denormalized count of direct replies. Maintained by trigger below
-- so the feed/profile can read it off the row without a sub-query per note.
alter table public.voice_notes
  add column if not exists reply_count integer not null default 0;

-- ─────────────────────────────────────────────────────────────
-- 2. Indexes
-- ─────────────────────────────────────────────────────────────

-- Fetch replies for a thread in conversation order (oldest first).
-- Partial: only reply rows (parent_note_id IS NOT NULL) are indexed.
create index if not exists voice_notes_parent_idx
  on public.voice_notes (parent_note_id, created_at asc)
  where parent_note_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 3. Trigger: maintain reply_count on parent
-- ─────────────────────────────────────────────────────────────

create or replace function public.update_reply_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.parent_note_id is not null then
    update public.voice_notes
    set reply_count = reply_count + 1
    where id = new.parent_note_id;
  elsif tg_op = 'DELETE' and old.parent_note_id is not null then
    update public.voice_notes
    set reply_count = greatest(0, reply_count - 1)
    where id = old.parent_note_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists voice_notes_reply_count on public.voice_notes;
create trigger voice_notes_reply_count
  after insert or delete on public.voice_notes
  for each row execute function public.update_reply_count();

-- ─────────────────────────────────────────────────────────────
-- 4. Trigger: notify parent note author on reply
-- Fires only on INSERT of a reply row (parent_note_id IS NOT NULL).
-- Self-replies are skipped (would also trip the recipient <> actor CHECK).
-- ─────────────────────────────────────────────────────────────

create or replace function public.notify_on_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  -- Only fire for reply rows.
  if new.parent_note_id is null then
    return new;
  end if;

  select user_id into author_id
  from public.voice_notes
  where id = new.parent_note_id;

  -- Skip if parent note was deleted or this is a self-reply.
  if author_id is null or author_id = new.user_id then
    return new;
  end if;

  insert into public.notifications (recipient_id, actor_id, type, voice_note_id)
  values (author_id, new.user_id, 'reply', new.parent_note_id);

  return new;
end;
$$;

drop trigger if exists notify_on_reply on public.voice_notes;
create trigger notify_on_reply
  after insert on public.voice_notes
  for each row execute function public.notify_on_reply();

-- ─────────────────────────────────────────────────────────────
-- 5. Extend notifications type check to include 'reply'
-- Drop and recreate the constraint (PostgreSQL does not support
-- ALTER CONSTRAINT on a CHECK constraint).
-- ─────────────────────────────────────────────────────────────

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
    check (type in ('reaction', 'follow', 'note', 'reply'));
