-- Signal — user profile stats RPC.
-- Problem: Profile / UserProfile computed "total notes" and "total reactions
-- received" by fetching EVERY note (with its nested reactions) just to take
-- .length and sum. A prolific user's profile pulled their whole history on each
-- open.
--
-- Fix: a single server-side aggregate. note_count from a COUNT, reaction_count
-- from SUM of the denormalized voice_notes.reaction_total (migration 0006). The
-- note *list* is fetched separately and paginated by the app.
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

create or replace function public.user_note_stats(target_user_id uuid)
returns table (note_count integer, reaction_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int                          as note_count,
    coalesce(sum(reaction_total), 0)::int  as reaction_count
  from public.voice_notes
  where user_id = target_user_id;
$$;

grant execute on function public.user_note_stats(uuid) to authenticated;
