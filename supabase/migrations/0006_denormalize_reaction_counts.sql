-- Signal — denormalize reaction aggregates onto voice_notes.
-- Problem: the feed's decorateNotes fetched EVERY reaction row for the notes on
-- screen and counted them in JS. One popular note with thousands of reactions =
-- thousands of rows over the wire per feed page. Does not scale past a handful
-- of active users / one viral note.
--
-- Fix: keep two maintained aggregates on voice_notes:
--   reaction_total  integer            — total reactions on the note
--   reaction_counts jsonb              — { "🔥": 3, "💙": 1, ... } per-emoji
-- A trigger on public.reactions keeps them in sync (insert / delete / emoji
-- switch via update). The feed then reads aggregates straight off the note row
-- and only fetches the *viewer's own* reaction (one row per note, bounded).
--
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.

-- ─────────────────────────────────────────────────────────────
-- Columns
-- ─────────────────────────────────────────────────────────────

alter table public.voice_notes
  add column if not exists reaction_total  integer not null default 0,
  add column if not exists reaction_counts jsonb   not null default '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────
-- Aggregate maintenance trigger
-- Recomputes both aggregates for a single note from the reactions table. Called
-- for whichever note(s) an insert/update/delete touched. Recompute (vs. delta
-- bumps) is simple and correct; each call scans only one note's reactions, which
-- the reactions_note_idx covers.
-- ─────────────────────────────────────────────────────────────

create or replace function public.recompute_note_reactions(note_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.voice_notes v
  set
    reaction_total  = coalesce(agg.total, 0),
    reaction_counts = coalesce(agg.counts, '{}'::jsonb)
  from (
    select
      count(*)::int                                         as total,
      coalesce(jsonb_object_agg(emoji, cnt), '{}'::jsonb)   as counts
    from (
      select emoji, count(*)::int as cnt
      from public.reactions
      where voice_note_id = note_id
      group by emoji
    ) per_emoji
  ) agg
  where v.id = note_id;
$$;

create or replace function public.reactions_sync_aggregates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_note_reactions(old.voice_note_id);
    return old;
  end if;

  -- INSERT or UPDATE. On an emoji switch the note is the same, but handle a
  -- (theoretical) note change by recomputing both sides.
  perform public.recompute_note_reactions(new.voice_note_id);
  if (tg_op = 'UPDATE' and new.voice_note_id <> old.voice_note_id) then
    perform public.recompute_note_reactions(old.voice_note_id);
  end if;
  return new;
end;
$$;

drop trigger if exists reactions_sync_aggregates on public.reactions;
create trigger reactions_sync_aggregates
  after insert or update or delete on public.reactions
  for each row execute function public.reactions_sync_aggregates();

-- ─────────────────────────────────────────────────────────────
-- Backfill existing notes.
-- ─────────────────────────────────────────────────────────────

update public.voice_notes v
set
  reaction_total  = coalesce(agg.total, 0),
  reaction_counts = coalesce(agg.counts, '{}'::jsonb)
from (
  select
    n.id as note_id,
    coalesce(sum(r.cnt), 0)::int                                as total,
    coalesce(jsonb_object_agg(r.emoji, r.cnt) filter (where r.emoji is not null), '{}'::jsonb) as counts
  from public.voice_notes n
  left join lateral (
    select emoji, count(*)::int as cnt
    from public.reactions
    where voice_note_id = n.id
    group by emoji
  ) r on true
  group by n.id
) agg
where v.id = agg.note_id;
