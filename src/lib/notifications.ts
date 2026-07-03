import { supabase } from './supabase';
import type { AppNotification, NotificationPage, NotificationType, ReactionEmoji } from '../types';

// ─────────────────────────────────────────────────────────────
// Notifications (activity feed — see migration 0013_notifications.sql)
// ─────────────────────────────────────────────────────────────

const NOTIF_PAGE_SIZE = 20;

// A bare notifications row as selected here.
type NotifRow = {
  id: string;
  actor_id: string;
  type: NotificationType;
  voice_note_id: string | null;
  emoji: string | null;
  read: boolean;
  created_at: string;
};

const NOTIF_COLUMNS = 'id, actor_id, type, voice_note_id, emoji, read, created_at';

// Attach actor usernames to a batch of notification rows. usernames come from
// the public_usernames view (users RLS is self-only) in one batch query — no
// N+1, same pattern as fetchFollowList.
async function decorate(rows: NotifRow[]): Promise<AppNotification[]> {
  if (!rows.length) return [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const { data: names, error } = await supabase
    .from('public_usernames')
    .select('id, username')
    .in('id', actorIds);
  if (error) throw new Error(error.message);

  const nameById: Record<string, string> = Object.fromEntries(
    (names ?? []).map((n) => [n.id, n.username])
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    actor: { id: r.actor_id, username: nameById[r.actor_id] ?? 'ANON' },
    voiceNoteId: r.voice_note_id,
    emoji: (r.emoji as ReactionEmoji | null) ?? null,
    read: r.read,
    createdAt: r.created_at,
  }));
}

// One page of the viewer's notifications, newest first. Keyset pagination: pass
// the last item's `createdAt` as `before` for the next page.
export async function fetchNotificationsPage({
  viewerId,
  before = null,
  limit = NOTIF_PAGE_SIZE,
}: {
  viewerId: string;
  before?: string | null;
  limit?: number;
}): Promise<NotificationPage> {
  const size = Math.min(limit, NOTIF_PAGE_SIZE);

  let query = supabase
    .from('notifications')
    .select(NOTIF_COLUMNS)
    .eq('recipient_id', viewerId)
    .order('created_at', { ascending: false })
    .limit(size);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as NotifRow[];
  const items = await decorate(rows);
  const nextCursor = rows.length === size ? rows[rows.length - 1].created_at : null;
  return { items, nextCursor, hasMore: nextCursor !== null };
}

// Fetch a single notification, decorated. Used by the realtime subscription to
// hydrate a row that arrived via an INSERT (the payload lacks the actor name).
export async function fetchNotificationById(id: string): Promise<AppNotification | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIF_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const [item] = await decorate([data as NotifRow]);
  return item ?? null;
}

// Count of the viewer's unread notifications (head+exact, no rows fetched) —
// drives the header bell badge.
export async function fetchUnreadCount(viewerId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', viewerId)
    .eq('read', false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Mark all of the viewer's unread notifications read (opening the Activity
// screen). No-op if none are unread.
export async function markAllRead(viewerId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_id', viewerId)
    .eq('read', false);
  if (error) throw new Error(error.message);
}
