-- Signal — moderation primitives: block + report.
-- Problem: a public global feed of voice notes among 100+ strangers had zero
-- moderation surface — no way to stop hearing an abuser, and no way to flag
-- content for takedown. This is the biggest social-scaling gap.
--
-- Adds:
--   blocks   — directed (blocker → blocked). Feeds/profiles filter out blocked
--              users. Enforced app-side + a helper for feed queries.
--   reports  — a user flags a note (or a user) with a reason. Insert-only for
--              normal users; an admin/service role reviews out of band.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- blocks: one row per directed (blocker, blocked) edge.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)          -- no self-block
);

create index if not exists blocks_blocker_idx on public.blocks (blocker_id);

alter table public.blocks enable row level security;

-- A block is private to the blocker: only you can see, create, or remove your
-- own blocks. (No one should be able to tell they've been blocked.)
create policy "blocks_select_own" on public.blocks
  for select to authenticated using (auth.uid() = blocker_id);

create policy "blocks_insert_own" on public.blocks
  for insert to authenticated with check (auth.uid() = blocker_id);

create policy "blocks_delete_own" on public.blocks
  for delete to authenticated using (auth.uid() = blocker_id);

-- ─────────────────────────────────────────────────────────────
-- reports: a flag raised by a user against a note and/or another user.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id    uuid not null references public.users (id) on delete cascade,
  reported_user_id uuid references public.users (id) on delete set null,
  voice_note_id  uuid references public.voice_notes (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now(),
  -- A report must point at something.
  check (reported_user_id is not null or voice_note_id is not null)
);

create index if not exists reports_note_idx on public.reports (voice_note_id);
create index if not exists reports_user_idx on public.reports (reported_user_id);

alter table public.reports enable row level security;

-- Users may file reports as themselves and read back their own. Review happens
-- via the service role (bypasses RLS) — no broad select for normal users.
create policy "reports_insert_own" on public.reports
  for insert to authenticated with check (auth.uid() = reporter_id);

create policy "reports_select_own" on public.reports
  for select to authenticated using (auth.uid() = reporter_id);

-- ─────────────────────────────────────────────────────────────
-- Feed helper: the set of user ids the viewer blocks. Used to exclude blocked
-- authors from feed queries (both directions handled app-side).
-- ─────────────────────────────────────────────────────────────

create or replace function public.blocked_user_ids(viewer_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select blocked_id from public.blocks where blocker_id = viewer_id;
$$;

grant execute on function public.blocked_user_ids(uuid) to authenticated;
