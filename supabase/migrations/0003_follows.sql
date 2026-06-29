-- Signal — social graph migration.
-- Adds the follow graph: a directed edge (follower → followee). This is the
-- primitive behind public profiles' follower/following counts and the
-- "Following" feed scope (notes only from people you follow).
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- follows: one row per directed (follower, followee) edge.
-- ─────────────────────────────────────────────────────────────

create table if not exists public.follows (
  follower_id uuid not null references public.users (id) on delete cascade,
  followee_id uuid not null references public.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)        -- no self-follow
);

-- Forward lookups (feed) hit the PK on follower_id; this index serves the
-- reverse lookup (a user's followers / follower count).
create index if not exists follows_followee_idx
  on public.follows (followee_id);

alter table public.follows enable row level security;

-- The graph is public: any authenticated user can read edges (needed for
-- follower/following counts and "do I follow X?" checks).
create policy "follows_select_authed" on public.follows
  for select to authenticated using (true);

-- You may only create your own outgoing follow edges.
create policy "follows_insert_own" on public.follows
  for insert to authenticated with check (auth.uid() = follower_id);

-- You may only remove your own follow edges.
create policy "follows_delete_own" on public.follows
  for delete to authenticated using (auth.uid() = follower_id);
