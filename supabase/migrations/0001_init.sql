-- Signal — initial schema, RLS, and storage bucket.
-- Run in the Supabase SQL editor (or `supabase db push`).

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  audio_url text not null,
  duration integer,
  created_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  voice_note_id uuid not null references public.voice_notes (id) on delete cascade,
  reactor_user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  voice_note_id uuid not null references public.voice_notes (id) on delete cascade,
  delivered_to_user_id uuid not null references public.users (id) on delete cascade,
  heard boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_recipient_idx
  on public.deliveries (delivered_to_user_id, heard);
create index if not exists voice_notes_user_idx
  on public.voice_notes (user_id);
create index if not exists reactions_note_idx
  on public.reactions (voice_note_id);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.voice_notes enable row level security;
alter table public.reactions enable row level security;
alter table public.deliveries enable row level security;

-- users: a person can only read/write their own row.
-- (Reading other usernames for the feed join goes through the edge function /
--  the security-definer view below, so a self-only policy is sufficient here.)
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- voice_notes: any authenticated user can read; you may only insert your own.
create policy "voice_notes_select_authed" on public.voice_notes
  for select to authenticated using (true);
create policy "voice_notes_insert_own" on public.voice_notes
  for insert to authenticated with check (auth.uid() = user_id);

-- reactions: readable by authenticated users; you may insert a reaction only
-- to a note that was actually delivered to you, and only as yourself.
create policy "reactions_select_authed" on public.reactions
  for select to authenticated using (true);
create policy "reactions_insert_delivered" on public.reactions
  for insert to authenticated with check (
    auth.uid() = reactor_user_id
    and exists (
      select 1 from public.deliveries d
      where d.voice_note_id = reactions.voice_note_id
        and d.delivered_to_user_id = auth.uid()
    )
  );

-- deliveries: only the recipient can read; the recipient may update (mark heard).
-- Inserts are performed by the edge function using the service-role key, which
-- bypasses RLS — so no insert policy is granted to normal users.
create policy "deliveries_select_recipient" on public.deliveries
  for select to authenticated using (auth.uid() = delivered_to_user_id);
create policy "deliveries_update_recipient" on public.deliveries
  for update to authenticated
  using (auth.uid() = delivered_to_user_id)
  with check (auth.uid() = delivered_to_user_id);

-- ─────────────────────────────────────────────────────────────
-- Feed join helper
-- The feed needs the poster's username, but users RLS is self-only. Expose a
-- minimal, security-definer view of (id, username) that any authed user can read.
-- ─────────────────────────────────────────────────────────────

create or replace view public.public_usernames
  with (security_invoker = false) as
  select id, username from public.users;

grant select on public.public_usernames to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Storage bucket: voice-notes (public read)
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', true)
on conflict (id) do update set public = true;

-- Authenticated users may upload to their own folder (path prefixed with their uid).
create policy "voice_notes_upload_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read of audio objects (bucket is public; this makes the intent explicit).
create policy "voice_notes_public_read"
  on storage.objects for select
  using (bucket_id = 'voice-notes');
