-- Signal — follow-list pagination indexes.
-- The follower/following list screens page through edges newest-first with
-- keyset pagination (WHERE created_at < cursor ORDER BY created_at DESC). The
-- existing PK (follower_id, followee_id) and follows_followee_idx (followee_id)
-- don't cover an ordered scan by created_at, so add composite indexes.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- "Following" list for a user: their outgoing edges, newest first.
create index if not exists follows_follower_created_idx
  on public.follows (follower_id, created_at desc);

-- "Followers" list for a user: their incoming edges, newest first.
create index if not exists follows_followee_created_idx
  on public.follows (followee_id, created_at desc);
