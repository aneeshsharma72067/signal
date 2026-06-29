import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { fetchFollowList, follow, unfollow } from '../lib/social';
import type { FollowDirection, FollowUser } from '../types';

// Drives a follower/following list screen: one user's follow edges, newest
// first, paged 20 at a time with infinite scroll. Each row carries whether the
// viewer follows that user; toggling is optimistic (flip immediately, roll back
// on failure). Mirrors the useFeed pattern.
export function useFollowList(userId: string, direction: FollowDirection) {
  const { user } = useAuth();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true); // first page
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [loadingMore, setLoadingMore] = useState(false); // next page
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set()); // follow toggles inflight

  const cursorRef = useRef<string | null>(null); // edgeCreatedAt of last row (keyset)
  const inFlight = useRef(false); // guards overlapping pagination calls

  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { users: page, nextCursor, hasMore: more } = await fetchFollowList({
          userId,
          viewerId: user.id,
          direction,
        });
        setUsers(page);
        cursorRef.current = nextCursor;
        setHasMore(more);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        if (!isRefresh) setUsers([]);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user, userId, direction]
  );

  const loadMore = useCallback(async () => {
    if (!user || inFlight.current || !hasMore || loading) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const { users: page, nextCursor, hasMore: more } = await fetchFollowList({
        userId,
        viewerId: user.id,
        direction,
        before: cursorRef.current,
      });
      // Dedupe defensively (an edge added between pages could overlap).
      setUsers((prev) => {
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...page.filter((u) => !seen.has(u.id))];
      });
      cursorRef.current = nextCursor;
      setHasMore(more);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [user, userId, direction, hasMore, loading]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic follow toggle for a row. Flip isFollowing immediately, roll back
  // on failure. Guards against double-taps via pendingIds.
  const toggleFollow = useCallback(
    async (target: FollowUser) => {
      if (!user || target.isSelf || pendingIds.has(target.id)) return;
      const next = !target.isFollowing;
      setPendingIds((s) => new Set(s).add(target.id));
      setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, isFollowing: next } : u)));
      try {
        if (next) await follow(user.id, target.id);
        else await unfollow(user.id, target.id);
      } catch (e: unknown) {
        setUsers((list) => list.map((u) => (u.id === target.id ? { ...u, isFollowing: !next } : u)));
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setPendingIds((s) => {
          const n = new Set(s);
          n.delete(target.id);
          return n;
        });
      }
    },
    [user, pendingIds]
  );

  return {
    users,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    pendingIds,
    reload: load,
    refresh: () => load({ isRefresh: true }),
    loadMore,
    toggleFollow,
  };
}
