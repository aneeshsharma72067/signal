import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { fetchFeedPage, toggleReaction } from '../lib/notes';

// Drives the global Home Feed: every user's voice notes, newest first, paged 10
// at a time with infinite scroll. Reacting updates a note in place (count +
// "you reacted" state) — notes are never removed on reaction.
export function useFeed() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true); // first page
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [loadingMore, setLoadingMore] = useState(false); // next page
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  const cursorRef = useRef(null); // created_at of last loaded note (keyset)
  const inFlight = useRef(false); // guards overlapping pagination calls

  // Load the first page (fresh). Used on mount and pull-to-refresh.
  const load = useCallback(
    async ({ isRefresh = false } = {}) => {
      if (!user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const { notes: page, nextCursor, hasMore: more } = await fetchFeedPage({
          viewerId: user.id,
        });
        setNotes(page);
        cursorRef.current = nextCursor;
        setHasMore(more);
      } catch (e) {
        setError(e.message);
        if (!isRefresh) setNotes([]);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user]
  );

  // Load the next page and append. No-op if already loading or exhausted.
  const loadMore = useCallback(async () => {
    if (!user || inFlight.current || !hasMore || loading) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const { notes: page, nextCursor, hasMore: more } = await fetchFeedPage({
        viewerId: user.id,
        before: cursorRef.current,
      });
      // Dedupe defensively (a note posted between pages could overlap).
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.filter((n) => !seen.has(n.id))];
      });
      cursorRef.current = nextCursor;
      setHasMore(more);
    } catch (e) {
      setError(e.message);
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [user, hasMore, loading]);

  useEffect(() => {
    load();
  }, [load]);

  // React to a note. Optimistic: update counts + myReaction immediately, roll
  // back on failure. One reaction per user per note (toggle/switch/remove).
  const react = useCallback(
    async (noteId, emoji) => {
      if (!user) return;
      const target = notes.find((n) => n.id === noteId);
      if (!target) return;
      const prev = target.myReaction;

      const next = prev === emoji ? null : emoji;
      setNotes((list) => list.map((n) => (n.id === noteId ? applyReaction(n, prev, next) : n)));

      try {
        await toggleReaction({
          userId: user.id,
          voiceNoteId: noteId,
          emoji,
          current: prev,
        });
      } catch (e) {
        // Roll back the optimistic change.
        setNotes((list) => list.map((n) => (n.id === noteId ? applyReaction(n, next, prev) : n)));
        setError(e.message);
      }
    },
    [user, notes]
  );

  return {
    notes,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    reload: load,
    refresh: () => load({ isRefresh: true }),
    loadMore,
    react,
  };
}

// Pure helper: recompute a note's reaction aggregate when the viewer's reaction
// changes from `from` emoji to `to` emoji (either may be null).
function applyReaction(note, from, to) {
  if (from === to) return note;
  const counts = { ...note.reactionCounts };
  let total = note.total;
  if (from) {
    counts[from] = (counts[from] ?? 1) - 1;
    if (counts[from] <= 0) delete counts[from];
    total -= 1;
  }
  if (to) {
    counts[to] = (counts[to] ?? 0) + 1;
    total += 1;
  }
  return { ...note, reactionCounts: counts, total, myReaction: to };
}
