import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { fetchBlockedIds } from '../lib/moderation';
import { fetchFeedPage, fetchNoteById, toggleReaction } from '../lib/notes';
import { fetchFollowingIds } from '../lib/social';
import { supabase } from '../lib/supabase';
import type { FeedNote, FeedScope, ReactionCounts, ReactionEmoji, VoiceNoteRow } from '../types';

// Module-level: monotonic across mounts so a remount can't reuse a topic whose
// channel is still being torn down (removeChannel is async).
let channelSeq = 0;

// Drives the global Home Feed: every user's voice notes, newest first, paged 10
// at a time with infinite scroll. Reacting updates a note in place (count +
// "you reacted" state) — notes are never removed on reaction.
export function useFeed(scope: FeedScope = 'everyone') {
  const { user } = useAuth();
  const [notes, setNotes] = useState<FeedNote[]>([]);
  const [loading, setLoading] = useState(true); // first page
  const [refreshing, setRefreshing] = useState(false); // pull-to-refresh
  const [loadingMore, setLoadingMore] = useState(false); // next page
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const cursorRef = useRef<string | null>(null); // created_at of last loaded note (keyset)
  const inFlight = useRef(false); // guards overlapping pagination calls
  const notesRef = useRef<FeedNote[]>([]); // latest notes, for the realtime handler
  notesRef.current = notes;

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
          scope,
        });
        setNotes(page);
        cursorRef.current = nextCursor;
        setHasMore(more);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
        if (!isRefresh) setNotes([]);
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [user, scope]
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
        scope,
      });
      // Dedupe defensively (a note posted between pages could overlap).
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.filter((n) => !seen.has(n.id))];
      });
      cursorRef.current = nextCursor;
      setHasMore(more);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [user, hasMore, loading, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: keep the feed live without a manual refresh.
  //   INSERT — a new broadcast: hydrate it (author + viewer reaction) and prepend
  //            if it belongs in this scope and isn't already shown.
  //   UPDATE — reaction aggregates changed (migration 0006 trigger): patch the
  //            visible card's counts/total in place, preserving the viewer's own
  //            reaction (which realtime doesn't carry per-viewer).
  useEffect(() => {
    if (!user) return;
    const viewerId = user.id;

    // Unique topic per subscription instance. supabase-js caches channels by
    // topic and forbids adding callbacks to an already-subscribed channel, so a
    // reused topic (scope change / StrictMode remount) would throw. A fresh
    // topic each run sidesteps that; cleanup removes it.
    channelSeq += 1;
    const topic = `feed:${scope}:${viewerId}:${channelSeq}`;

    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'voice_notes' },
        async (payload) => {
          const row = payload.new as VoiceNoteRow;
          // Own notes already appear via the post→navigate flow; skip to avoid dupes.
          if (row.user_id === viewerId) return;
          if (notesRef.current.some((n) => n.id === row.id)) return;
          try {
            // Don't surface a blocked author's live broadcast.
            const blocked = await fetchBlockedIds(viewerId);
            if (blocked.includes(row.user_id)) return;
            // 'following' scope: only surface authors the viewer actually
            // follows. Gate on the live follow set (not the notes already shown)
            // so a followed user's FIRST note still pushes through — the old
            // "do we track this author?" check silently dropped it.
            if (scope === 'following') {
              const following = await fetchFollowingIds(viewerId);
              if (!following.includes(row.user_id)) return;
            }
            const note = await fetchNoteById(row.id, viewerId);
            if (!note) return;
            setNotes((prev) => (prev.some((n) => n.id === note.id) ? prev : [note, ...prev]));
          } catch {
            // Best-effort live update; a failed hydrate just waits for refresh.
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'voice_notes' },
        (payload) => {
          const row = payload.new as VoiceNoteRow;
          setNotes((prev) =>
            prev.map((n) =>
              n.id === row.id
                ? { ...n, reactionCounts: (row.reaction_counts ?? {}) as ReactionCounts, total: row.reaction_total ?? 0 }
                : n
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, scope]);

  // React to a note. Optimistic: update counts + myReaction immediately, roll
  // back on failure. One reaction per user per note (toggle/switch/remove).
  const react = useCallback(
    async (noteId: string, emoji: ReactionEmoji) => {
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
      } catch (e: unknown) {
        // Roll back the optimistic change.
        setNotes((list) => list.map((n) => (n.id === noteId ? applyReaction(n, next, prev) : n)));
        setError(e instanceof Error ? e.message : String(e));
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
function applyReaction(note: FeedNote, from: ReactionEmoji | null, to: ReactionEmoji | null): FeedNote {
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
