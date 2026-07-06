-- Signal — fix user_note_stats to exclude reply rows.
-- The migration 0016 added parent_note_id to voice_notes; replies are stored in
-- the same table. user_note_stats was counting them, inflating the NOTES stat.
-- Only top-level notes (parent_note_id IS NULL) should count toward note_count.
-- reaction_count stays across all rows the user owns (replies can receive reactions).

create or replace function public.user_note_stats(target_user_id uuid)
returns table (note_count integer, reaction_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Only count top-level broadcasts, not voice replies.
    count(*) filter (where parent_note_id is null)::int  as note_count,
    coalesce(sum(reaction_total), 0)::int                 as reaction_count
  from public.voice_notes
  where user_id = target_user_id;
$$;

grant execute on function public.user_note_stats(uuid) to authenticated;
