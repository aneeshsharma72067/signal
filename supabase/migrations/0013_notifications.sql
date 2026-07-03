-- Signal — activity notifications.
-- Problem: the app has no activity feedback loop. Reactions are anonymous, new
-- followers are silent, and a note from someone you follow only surfaces if you
-- happen to be on the Following feed. Authors get nothing back — the biggest
-- retention gap. Nothing tells a user "someone engaged with you."
--
-- Fix: a notifications table, written only by security-definer triggers on the
-- three source events (reaction / follow / note), read + marked-read by the
-- recipient. Added to the realtime publication so the client's bell badge and
-- Activity screen update live (same mechanism as migration 0008's feed).
--   reaction — someone reacts to your note   (INSERT on reactions only; an emoji
--              switch is an UPDATE, so switching does not re-notify)
--   follow   — someone follows you
--   note     — someone you follow posts a note (fan-out, one row per follower)
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- Table
-- ─────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id  uuid not null references public.users (id) on delete cascade,
  actor_id      uuid not null references public.users (id) on delete cascade,
  type          text not null check (type in ('reaction', 'follow', 'note')),
  voice_note_id uuid references public.voice_notes (id) on delete cascade,
  emoji         text,
  read          boolean not null default false,
  created_at    timestamptz not null default now(),
  check (recipient_id <> actor_id)             -- never notify yourself
);

-- Recipient's inbox, newest first (list pagination).
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);
-- Cheap unread-count / badge lookups.
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id) where not read;

alter table public.notifications enable row level security;

-- A notification is private to its recipient: only you can read, mark-read
-- (update), or delete your own. There is NO insert policy for normal users —
-- every row is written by a security-definer trigger below (which bypasses RLS),
-- so the client can never forge a notification.
create policy "notifications_select_own" on public.notifications
  for select to authenticated using (auth.uid() = recipient_id);

create policy "notifications_update_own" on public.notifications
  for update to authenticated
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

create policy "notifications_delete_own" on public.notifications
  for delete to authenticated using (auth.uid() = recipient_id);

-- ─────────────────────────────────────────────────────────────
-- Trigger: a reaction on your note.
-- Fires only on INSERT (a fresh reaction). An emoji switch is an UPDATE on the
-- unique (reactor, note) row and is intentionally NOT re-notified.
-- ─────────────────────────────────────────────────────────────

create or replace function public.notify_on_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_id uuid;
begin
  select user_id into author_id from public.voice_notes where id = new.voice_note_id;
  -- Skip self-reactions (would also trip the recipient <> actor CHECK).
  if author_id is null or author_id = new.reactor_user_id then
    return new;
  end if;
  insert into public.notifications (recipient_id, actor_id, type, voice_note_id, emoji)
  values (author_id, new.reactor_user_id, 'reaction', new.voice_note_id, new.emoji);
  return new;
end;
$$;

drop trigger if exists notify_on_reaction on public.reactions;
create trigger notify_on_reaction
  after insert on public.reactions
  for each row execute function public.notify_on_reaction();

-- ─────────────────────────────────────────────────────────────
-- Trigger: a new follower.
-- ─────────────────────────────────────────────────────────────

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.followee_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists notify_on_follow on public.follows;
create trigger notify_on_follow
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ─────────────────────────────────────────────────────────────
-- Trigger: a note from someone you follow — fan out one row per follower.
-- Bounded by the poster's follower count; follows(followee_id) is indexed.
-- ─────────────────────────────────────────────────────────────

create or replace function public.notify_on_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type, voice_note_id)
  select f.follower_id, new.user_id, 'note', new.id
  from public.follows f
  where f.followee_id = new.user_id;
  return new;
end;
$$;

drop trigger if exists notify_on_note on public.voice_notes;
create trigger notify_on_note
  after insert on public.voice_notes
  for each row execute function public.notify_on_note();

-- ─────────────────────────────────────────────────────────────
-- Realtime: publish INSERTs so the client bell badge + Activity list update
-- live. The client subscribes filtered to its own recipient_id.
-- ─────────────────────────────────────────────────────────────

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
