import { supabase, VOICE_NOTES_BUCKET } from './supabase';

// Read a local file uri into an ArrayBuffer for upload (RN-friendly).
async function uriToArrayBuffer(uri) {
  const res = await fetch(uri);
  if (!res.ok) throw new Error('Could not read the recorded audio file.');
  return await res.arrayBuffer();
}

// Upload audio to Storage, then insert the voice_note row. The note is now
// public — every authenticated user sees it in the global feed (no per-user
// delivery fan-out). Throws on any failure — callers surface the message.
export async function uploadAndPost({ userId, uri, durationSec }) {
  if (!uri) throw new Error('No recording to post.');

  const fileName = `${userId}/${Date.now()}.m4a`;
  const bytes = await uriToArrayBuffer(uri);

  const { error: uploadError } = await supabase.storage
    .from(VOICE_NOTES_BUCKET)
    .upload(fileName, bytes, { contentType: 'audio/m4a', upsert: false });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: pub } = supabase.storage.from(VOICE_NOTES_BUCKET).getPublicUrl(fileName);
  const audioUrl = pub.publicUrl;

  const { data: note, error: insertError } = await supabase
    .from('voice_notes')
    .insert({ user_id: userId, audio_url: audioUrl, duration: durationSec })
    .select()
    .single();
  if (insertError) throw new Error(`Could not save note: ${insertError.message}`);

  return note;
}

// ─────────────────────────────────────────────────────────────
// Global feed
// ─────────────────────────────────────────────────────────────

const FEED_PAGE_SIZE = 10;

// Attach poster usernames + reaction summaries to a batch of note rows.
// Returns the rows shaped for the UI: { ..., author, reactionCounts, total,
// myReaction }. `viewerId` is the current user (to mark their own reaction).
async function decorateNotes(rows, viewerId) {
  if (!rows.length) return [];

  const noteIds = rows.map((n) => n.id);
  const authorIds = [...new Set(rows.map((n) => n.user_id))];

  // Batch-resolve usernames (users RLS is self-only → go through the view).
  const { data: names, error: nErr } = await supabase
    .from('public_usernames')
    .select('id, username')
    .in('id', authorIds);
  if (nErr) throw new Error(nErr.message);
  const nameById = Object.fromEntries((names ?? []).map((n) => [n.id, n.username]));

  // Batch-fetch all reactions for these notes.
  const { data: reacts, error: rErr } = await supabase
    .from('reactions')
    .select('voice_note_id, emoji, reactor_user_id')
    .in('voice_note_id', noteIds);
  if (rErr) throw new Error(rErr.message);

  // Aggregate per note: emoji counts, total, and the viewer's own reaction.
  const byNote = {};
  for (const id of noteIds) byNote[id] = { counts: {}, total: 0, mine: null };
  for (const r of reacts ?? []) {
    const agg = byNote[r.voice_note_id];
    if (!agg) continue;
    agg.counts[r.emoji] = (agg.counts[r.emoji] ?? 0) + 1;
    agg.total += 1;
    if (r.reactor_user_id === viewerId) agg.mine = r.emoji;
  }

  return rows.map((n) => ({
    id: n.id,
    audio_url: n.audio_url,
    duration: n.duration,
    created_at: n.created_at,
    user_id: n.user_id,
    author: { id: n.user_id, username: nameById[n.user_id] ?? 'ANON' },
    reactionCounts: byNote[n.id].counts,
    total: byNote[n.id].total,
    myReaction: byNote[n.id].mine,
  }));
}

// Fetch one page of the global feed, newest first. Keyset pagination: pass the
// last item's `created_at` as `before` to get the next page. `limit` capped at
// FEED_PAGE_SIZE. Returns { notes, nextCursor, hasMore }.
export async function fetchFeedPage({ viewerId, before = null, limit = FEED_PAGE_SIZE } = {}) {
  const size = Math.min(limit, FEED_PAGE_SIZE);

  let query = supabase
    .from('voice_notes')
    .select('id, audio_url, duration, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(size);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const notes = await decorateNotes(rows, viewerId);
  const nextCursor = rows.length === size ? rows[rows.length - 1].created_at : null;

  return { notes, nextCursor, hasMore: nextCursor !== null };
}

// Toggle a reaction for a note. One reaction per user per note:
//   - no current reaction       → insert `emoji`
//   - same emoji tapped again   → remove it
//   - different emoji tapped    → switch to the new emoji
// Returns the resulting reaction emoji (or null if removed). Throws on error.
export async function toggleReaction({ userId, voiceNoteId, emoji, current }) {
  if (current === emoji) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('reactor_user_id', userId)
      .eq('voice_note_id', voiceNoteId);
    if (error) throw new Error(error.message);
    return null;
  }

  // Insert-or-switch. Unique(reactor, note) lets us upsert on that conflict.
  const { error } = await supabase
    .from('reactions')
    .upsert(
      { reactor_user_id: userId, voice_note_id: voiceNoteId, emoji },
      { onConflict: 'reactor_user_id,voice_note_id' }
    );
  if (error) throw new Error(error.message);
  return emoji;
}

// Derive the Storage object path from a public audio URL.
// `.../object/public/voice-notes/<uid>/<file>` → `<uid>/<file>`.
function storagePathFromUrl(audioUrl) {
  if (!audioUrl) return null;
  const marker = `/${VOICE_NOTES_BUCKET}/`;
  const i = audioUrl.indexOf(marker);
  return i === -1 ? null : audioUrl.slice(i + marker.length);
}

// Hard-delete a note: removes the DB row (reactions cascade via FK) and the
// audio object from Storage. RLS ensures only the author can do this. Storage
// removal is best-effort — a leftover file should not fail the user-facing op.
export async function deleteNote({ noteId, audioUrl }) {
  const { error } = await supabase.from('voice_notes').delete().eq('id', noteId);
  if (error) throw new Error(error.message);

  const path = storagePathFromUrl(audioUrl);
  if (path) {
    const { error: sErr } = await supabase.storage.from(VOICE_NOTES_BUCKET).remove([path]);
    if (sErr) console.warn('Note row deleted but audio file remains:', sErr.message);
  }
}

// ─────────────────────────────────────────────────────────────
// Per-user lists (My Notes / Profile)
// ─────────────────────────────────────────────────────────────

// All voice notes by a user, newest first, with their reactions attached.
export async function fetchUserNotes(userId) {
  const { data, error } = await supabase
    .from('voice_notes')
    .select('id, audio_url, duration, created_at, reactions ( emoji )')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Aggregate profile stats: total notes + total reactions received.
export async function fetchProfileStats(userId) {
  const notes = await fetchUserNotes(userId);
  const totalNotes = notes.length;
  const totalReactions = notes.reduce((sum, n) => sum + (n.reactions?.length ?? 0), 0);
  return { totalNotes, totalReactions, notes };
}
