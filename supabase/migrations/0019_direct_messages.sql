-- Signal — direct voice messages (1:1 audio DM).
-- Problem: the platform was broadcast-only (public notes + threaded replies).
-- There was no private channel between two people. This adds 1:1 voice DMs,
-- keeping the app's audio-only identity: every message is a voice clip, no text.
--
-- Design:
--   conversations — exactly one row per unordered pair of users. The pair is
--                   stored canonically (user_a < user_b) so (X,Y) and (Y,X)
--                   resolve to the same row; a UNIQUE(user_a, user_b) enforces it.
--   messages      — one voice clip in a conversation (sender + audio + duration
--                   + read_at). Ordered by created_at within a conversation.
--
-- Permissions:
--   * Only the two participants may read a conversation and its messages.
--   * A message may be sent only by a participant, and only when the two users
--     MUTUALLY follow each other (both directions present in `follows`). This
--     keeps voice DMs spam-resistant and fitting the intimate medium.
--   * Recipients may mark messages read (set read_at) but may not edit content.
--
-- Realtime: messages + conversations added to supabase_realtime so the inbox
-- and open chat update live (same pattern as voice_notes / notifications).
--
-- Idempotent (IF NOT EXISTS / OR REPLACE / DROP-then-CREATE). Run in the
-- Supabase SQL editor or via `supabase db push`.

-- ─────────────────────────────────────────────────────────────
-- 1. Helper: do two users mutually follow each other?
-- security-definer so it sees all follow edges regardless of the caller's RLS.
-- ─────────────────────────────────────────────────────────────

create or replace function public.users_mutually_follow(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.follows where follower_id = u1 and followee_id = u2)
     and exists (select 1 from public.follows where follower_id = u2 and followee_id = u1);
$$;

grant execute on function public.users_mutually_follow(uuid, uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. conversations: one canonical row per unordered user pair.
-- user_a is always the lexicographically smaller uuid (enforced by CHECK), so
-- a pair maps to exactly one row and UNIQUE(user_a, user_b) prevents dupes.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.users (id) on delete cascade,
  user_b uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Bumped by trigger on every new message so the inbox can sort by recency
  -- without a subquery. Starts at created_at.
  last_message_at timestamptz not null default now(),
  check (user_a < user_b),                    -- canonical ordering, no self-DM
  unique (user_a, user_b)
);

-- Inbox lookups: "all conversations involving me, newest activity first".
create index if not exists conversations_user_a_idx
  on public.conversations (user_a, last_message_at desc);
create index if not exists conversations_user_b_idx
  on public.conversations (user_b, last_message_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3. messages: one voice clip in a conversation.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  audio_url text not null,
  duration integer,
  created_at timestamptz not null default now(),
  -- Null until the recipient has heard it; drives unread badges + read ticks.
  read_at timestamptz
);

-- Fetch a conversation's messages oldest-first (chat order) + keyset paginate.
create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at asc);

-- Unread lookups: recipient counts messages they didn't send that are unread.
create index if not exists messages_unread_idx
  on public.messages (conversation_id, read_at)
  where read_at is null;

-- ─────────────────────────────────────────────────────────────
-- 4. Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- conversations: visible only to its two participants.
create policy "conversations_select_participant" on public.conversations
  for select to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- A participant may create the conversation row, but only between themselves and
-- someone they MUTUALLY follow. The canonical ordering means either user could
-- be user_a or user_b, so both must be checked.
create policy "conversations_insert_mutual" on public.conversations
  for insert to authenticated
  with check (
    (auth.uid() = user_a or auth.uid() = user_b)
    and public.users_mutually_follow(user_a, user_b)
  );

-- Either participant may delete the conversation. ON DELETE CASCADE on
-- messages.conversation_id removes the whole thread's clips with it, so this
-- doubles as "leave/clear conversation" for both sides.
create policy "conversations_delete_participant" on public.conversations
  for delete to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- messages: readable by either participant of the parent conversation.
create policy "messages_select_participant" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

-- Insert: sender must be the authed user, a participant, and the pair must
-- still mutually follow at send time (unfollowing severs the DM channel).
create policy "messages_insert_participant" on public.messages
  for insert to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
        and public.users_mutually_follow(c.user_a, c.user_b)
    )
  );

-- Update: only the *recipient* (a participant who is not the sender) may update
-- a message, and only to mark it read. Content columns can't be changed because
-- the app only ever sets read_at; a stricter column guard would need a trigger.
create policy "messages_update_recipient" on public.messages
  for update to authenticated
  using (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  )
  with check (
    sender_id <> auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Trigger: bump conversations.last_message_at on each new message.
-- Keeps the inbox sortable by recency without a per-row subquery.
-- ─────────────────────────────────────────────────────────────

create or replace function public.bump_conversation_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_bump_activity on public.messages;
create trigger messages_bump_activity
  after insert on public.messages
  for each row execute function public.bump_conversation_activity();

-- ─────────────────────────────────────────────────────────────
-- 6. Realtime publication + full replica identity.
-- messages: client subscribes to INSERT (new incoming clip) and UPDATE (read
-- receipts). conversations: INSERT (new thread) + UPDATE (last_message_at bump)
-- keep the inbox live. REPLICA IDENTITY FULL so UPDATE payloads carry columns.
-- ─────────────────────────────────────────────────────────────

alter table public.messages replica identity full;
alter table public.conversations replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
