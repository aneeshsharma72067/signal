-- Signal — upload rate limits, file size caps, and duration limits.
-- Adds database triggers to enforce limits server-side:
--   1. storage.objects check — limit uploads in the 'voice-notes' bucket to max 2MB and audio/m4a type.
--   2. public.voice_notes check — enforce a maximum duration of 35 seconds, a 10-second cooldown between posts, and a limit of 10 posts per 10 minutes.

-- ─────────────────────────────────────────────────────────────
-- Storage object validator (size + mime type)
-- ─────────────────────────────────────────────────────────────

create or replace function public.check_audio_upload()
returns trigger
language plpgsql
security definer
as $$
declare
  file_size int;
  mime_type text;
begin
  if new.bucket_id = 'voice-notes' then
    file_size := (new.metadata->>'size')::int;
    mime_type := new.metadata->>'mimetype';
    
    -- Max size 2MB (2 * 1024 * 1024 = 2097152 bytes)
    if file_size > 2097152 then
      raise exception 'File size exceeds the 2MB limit.';
    end if;

    -- Enforce audio types
    if mime_type not in ('audio/m4a', 'audio/x-m4a', 'audio/mp4', 'audio/aac', 'application/octet-stream') then
      raise exception 'Invalid file type. Only M4A/AAC audio is allowed.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists storage_check_audio_upload on storage.objects;

create trigger storage_check_audio_upload
  before insert on storage.objects
  for each row
  execute function public.check_audio_upload();

-- ─────────────────────────────────────────────────────────────
-- Voice notes metadata validator (duration + rate limits)
-- ─────────────────────────────────────────────────────────────

create or replace function public.check_voice_note_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count int;
  last_post_time timestamptz;
begin
  -- 1. Duration cap (max 35 seconds to allow padding)
  if new.duration is not null and new.duration > 35 then
    raise exception 'Voice note exceeds maximum duration of 30 seconds.';
  end if;

  -- 2. Rate limit: 1 post per 10 seconds (cooldown)
  select created_at into last_post_time
  from public.voice_notes
  where user_id = new.user_id
  order by created_at desc
  limit 1;

  if last_post_time is not null and (now() - last_post_time) < interval '10 seconds' then
    raise exception 'Please wait 10 seconds between posts.';
  end if;

  -- 3. Rate limit: max 10 posts per 10 minutes
  select count(*) into recent_count
  from public.voice_notes
  where user_id = new.user_id
    and created_at > (now() - interval '10 minutes');

  if recent_count >= 10 then
    raise exception 'Post limit reached. You can post up to 10 times every 10 minutes.';
  end if;

  return new;
end;
$$;

drop trigger if exists voice_notes_check_insert on public.voice_notes;

create trigger voice_notes_check_insert
  before insert on public.voice_notes
  for each row
  execute function public.check_voice_note_insert();
