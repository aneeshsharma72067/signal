import { supabase } from './supabase';

// ─────────────────────────────────────────────────────────────
// Moderation: blocks + reports (see migration 0009_moderation.sql)
// ─────────────────────────────────────────────────────────────

// The set of user ids `viewerId` blocks. Used to filter blocked authors out of
// the feed. Returns string[]. Empty on no blocks.
export async function fetchBlockedIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', viewerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.blocked_id);
}

// Block a user. Idempotent — re-blocking collides on the PK and is ignored.
// Self-block is rejected by the table CHECK.
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .upsert(
      { blocker_id: blockerId, blocked_id: blockedId },
      { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

// Unblock a user. Removing a non-existent edge is a harmless no-op.
export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId);
  if (error) throw new Error(error.message);
}

// Is `viewerId` blocking `targetId`? Single-edge check for the profile control.
export async function isBlocking(viewerId: string, targetId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id')
    .eq('blocker_id', viewerId)
    .eq('blocked_id', targetId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

// File a report against a note and/or a user. At least one target is required
// (enforced by a table CHECK). `reason` is free text, 1–500 chars.
export async function reportContent({
  reporterId,
  reportedUserId = null,
  voiceNoteId = null,
  reason,
}: {
  reporterId: string;
  reportedUserId?: string | null;
  voiceNoteId?: string | null;
  reason: string;
}): Promise<void> {
  const clean = reason.trim();
  if (!clean) throw new Error('A reason is required.');
  const { error } = await supabase.from('reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    voice_note_id: voiceNoteId,
    reason: clean.slice(0, 500),
  });
  if (error) throw new Error(error.message);
}
