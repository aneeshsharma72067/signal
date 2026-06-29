-- Signal — private bucket and signed URLs.
-- Sets the voice-notes storage bucket to private (public = false) and drops
-- the public select policy. Adds an authenticated-only select policy so only
-- logged-in users can generate signed URLs or read the audio objects.

update storage.buckets
set public = false
where id = 'voice-notes';

drop policy if exists "voice_notes_public_read" on storage.objects;

create policy "voice_notes_auth_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'voice-notes');
