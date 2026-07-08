-- Signal — support GIF replies.
-- Allows voice_notes (comments/replies or notes) to contain either an audio note or a GIF URL.
-- Enforces that a row has exactly one of audio_url or gif_url.

-- 1. Make audio_url nullable
alter table public.voice_notes
  alter column audio_url drop not null;

-- 2. Add gif_url column
alter table public.voice_notes
  add column if not exists gif_url text;

-- 3. Add check constraint to ensure only one of audio_url or gif_url is provided
alter table public.voice_notes
  drop constraint if exists voice_notes_media_type_check;

alter table public.voice_notes
  add constraint voice_notes_media_type_check
  check (
    (audio_url is not null and gif_url is null) or
    (audio_url is null and gif_url is not null)
  );
