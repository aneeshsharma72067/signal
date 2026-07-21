import { isBlocking } from './moderation';
import { supabase } from './supabase';
import type { FollowDirection, FollowPage, FollowUser, PublicProfile } from '../types';

// ─────────────────────────────────────────────────────────────
// Follow graph (see migration 0003_follows.sql)
// ─────────────────────────────────────────────────────────────

// Follow a user. Idempotent — re-following an existing edge is a no-op (the
// (follower, followee) primary key collides and we ignore it). Throws on real
// errors. Self-follow is rejected by the table's CHECK constraint.
export async function follow(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .upsert(
      { follower_id: followerId, followee_id: followeeId },
      { onConflict: 'follower_id,followee_id', ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

// Unfollow a user. Removing a non-existent edge is a harmless no-op.
export async function unfollow(followerId: string, followeeId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId);
  if (error) throw new Error(error.message);
}

// The set of user ids `viewerId` follows. Returns string[]. Used to scope the
// "Following" feed and to seed isFollowing checks.
export async function fetchFollowingIds(viewerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('followee_id')
    .eq('follower_id', viewerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.followee_id);
}

// ─────────────────────────────────────────────────────────────
// Follow lists (followers / following screens)
// ─────────────────────────────────────────────────────────────

const FOLLOW_PAGE_SIZE = 20;

// Follower + following counts for a user (no rows fetched — head+exact count).
// Cheap enough to call alongside a profile's other stats.
export async function fetchFollowCounts(
  userId: string
): Promise<{ followerCount: number; followingCount: number }> {
  const [{ count: followerCount, error: fErr }, { count: followingCount, error: gErr }] =
    await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    ]);
  if (fErr) throw new Error(fErr.message);
  if (gErr) throw new Error(gErr.message);
  return { followerCount: followerCount ?? 0, followingCount: followingCount ?? 0 };
}

// Fetch one page of a user's follow list, newest edge first. Keyset
// pagination: pass the last row's `edgeCreatedAt` as `before` for the next
// page. `direction`:
//   'followers' — users who follow `userId`   (select follower_id where followee_id = userId)
//   'following' — users `userId` follows       (select followee_id where follower_id = userId)
//
// Each returned row is decorated with the username and whether the *viewer*
// follows that user (drives the per-row follow control). Two batch queries per
// page (usernames, viewer's edges) — no N+1.
export async function fetchFollowList({
  userId,
  viewerId,
  direction,
  before = null,
  limit = FOLLOW_PAGE_SIZE,
}: {
  userId: string;
  viewerId: string;
  direction: FollowDirection;
  before?: string | null;
  limit?: number;
}): Promise<FollowPage> {
  const size = Math.min(limit, FOLLOW_PAGE_SIZE);

  // 'followers': match on followee_id, the *other* user is follower_id.
  // 'following': match on follower_id, the *other* user is followee_id.
  const matchCol = direction === 'followers' ? 'followee_id' : 'follower_id';
  const otherCol = direction === 'followers' ? 'follower_id' : 'followee_id';

  let query = supabase
    .from('follows')
    .select(`${otherCol}, created_at`)
    .eq(matchCol, userId)
    .order('created_at', { ascending: false })
    .limit(size);
  if (before) query = query.lt('created_at', before);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Record<string, string>[];
  if (rows.length === 0) return { users: [], nextCursor: null, hasMore: false };

  const otherIds = rows.map((r) => r[otherCol]);

  // Batch-resolve usernames (users RLS is self-only → go through the view) and
  // the viewer's outgoing edges toward these users, in parallel.
  const [{ data: names, error: nErr }, { data: myEdges, error: eErr }] = await Promise.all([
    supabase.from('public_usernames').select('id, username').in('id', otherIds),
    supabase.from('follows').select('followee_id').eq('follower_id', viewerId).in('followee_id', otherIds),
  ]);
  if (nErr) throw new Error(nErr.message);
  if (eErr) throw new Error(eErr.message);

  const nameById: Record<string, string> = Object.fromEntries(
    (names ?? []).map((n) => [n.id, n.username])
  );
  const followedByViewer = new Set((myEdges ?? []).map((e) => e.followee_id));

  const users: FollowUser[] = rows.map((r) => {
    const id = r[otherCol];
    return {
      id,
      username: nameById[id] ?? 'ANON',
      isSelf: id === viewerId,
      isFollowing: followedByViewer.has(id),
      edgeCreatedAt: r.created_at,
    };
  });

  const nextCursor = rows.length === size ? rows[rows.length - 1].created_at : null;
  return { users, nextCursor, hasMore: nextCursor !== null };
}

// The public profile header bundle (counts + follow state). The note LIST is
// fetched + paginated separately by the screen (fetchUserNotesPage).
//   { username, totalNotes, totalReactions,
//     followerCount, followingCount, isFollowing, isSelf }
export async function fetchPublicProfile(
  userId: string,
  viewerId: string
): Promise<PublicProfile> {
  const isSelf = userId === viewerId;

  // Username, note/reaction stats (RPC), graph counts, and the viewer's follow
  // edge — all in parallel. No note rows pulled here.
  const [
    { data: nameRow, error: nErr },
    { data: statsData, error: sErr },
    { count: followerCount, error: fErr },
    { count: followingCount, error: gErr },
    edgeRes,
    backEdgeRes,
    isBlocked,
  ] = await Promise.all([
    supabase.from('public_usernames').select('username').eq('id', userId).maybeSingle(),
    supabase.rpc('user_note_stats', { target_user_id: userId }),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('followee_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
    isSelf
      ? Promise.resolve(null)
      : supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewerId)
          .eq('followee_id', userId)
          .maybeSingle(),
    // Reverse edge: does the target follow the viewer? Together with edgeRes
    // this yields mutual-follow, which gates direct messaging.
    isSelf
      ? Promise.resolve(null)
      : supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', userId)
          .eq('followee_id', viewerId)
          .maybeSingle(),
    isSelf ? Promise.resolve(false) : isBlocking(viewerId, userId),
  ]);
  if (nErr) throw new Error(nErr.message);
  if (sErr) throw new Error(sErr.message);
  if (fErr) throw new Error(fErr.message);
  if (gErr) throw new Error(gErr.message);
  if (edgeRes?.error) throw new Error(edgeRes.error.message);
  if (backEdgeRes?.error) throw new Error(backEdgeRes.error.message);

  const statsRow = Array.isArray(statsData) ? statsData[0] : statsData;

  return {
    username: nameRow?.username ?? 'ANON',
    totalNotes: statsRow?.note_count ?? 0,
    totalReactions: statsRow?.reaction_count ?? 0,
    followerCount: followerCount ?? 0,
    followingCount: followingCount ?? 0,
    isFollowing: !!edgeRes?.data,
    followsYou: !!backEdgeRes?.data,
    isSelf,
    isBlocked,
  };
}
