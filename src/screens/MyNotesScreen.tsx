import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import AudioPlayer from '../components/AudioPlayer';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { timeAgo } from '../components/VoiceNoteCard';
import { Body, Card, ConfirmModal, Display, Label, Rule, Segmented, SignalButton, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useWindowedPlayback } from '../hooks/useWindowedPlayback';
import { deleteNote, fetchProfileStats, fetchUserNotesPage, fetchUserRepliesPage } from '../lib/notes';
import { colors, radius, space } from '../theme';
import type { ProfileStats, UserNote, UserReply } from '../types';

const SORTS = [
  { value: 'new' as const, label: 'NEWEST' },
  { value: 'top' as const, label: 'TOP' },
];

const TABS = [
  { value: 'notes' as const, label: 'NOTES' },
  { value: 'replies' as const, label: 'REPLIES' },
];

// Lists the current user's broadcasts (tab 1) and their voice replies (tab 2).
// Broadcasts are shown as full VoiceNoteCards with delete + reaction summary.
// Replies are shown as compact cards with parent-note context ("↩ reply to @X").
// Stats are from the server-side RPC and only count top-level notes.
export default function MyNotesScreen() {
  const { user } = useAuth();
  const router = useRouter();

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'notes' | 'replies'>('notes');

  // ── Notes state ───────────────────────────────────────────────────────────
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ totalNotes: 0, totalReactions: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserNote | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const notesCursorRef = useRef<string | null>(null);
  const notesInFlight = useRef(false);

  // ── Replies state ─────────────────────────────────────────────────────────
  const [replies, setReplies] = useState<UserReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesLoadingMore, setRepliesLoadingMore] = useState(false);
  const [repliesHasMore, setRepliesHasMore] = useState(true);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const repliesCursorRef = useRef<string | null>(null);
  const repliesInFlight = useRef(false);

  // Shared windowed audio player for both tabs.
  const { playingNoteId, activate, savePosition, getInitialPosition, handleFinish } = useWindowedPlayback();

  // ── Load notes + stats ────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, s] = await Promise.all([
        fetchUserNotesPage({ userId: user!.id }),
        fetchProfileStats(user!.id),
      ]);
      setNotes(page.notes);
      notesCursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
      setStats(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMoreNotes = useCallback(async () => {
    if (notesInFlight.current || !hasMore || loading) return;
    notesInFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchUserNotesPage({ userId: user!.id, before: notesCursorRef.current });
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.notes.filter((n) => !seen.has(n.id))];
      });
      notesCursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      notesInFlight.current = false;
      setLoadingMore(false);
    }
  }, [user, hasMore, loading]);

  // ── Load replies ──────────────────────────────────────────────────────────

  const loadReplies = useCallback(async () => {
    setRepliesLoading(true);
    setRepliesError(null);
    repliesCursorRef.current = null;
    try {
      const page = await fetchUserRepliesPage({ userId: user!.id });
      setReplies(page.replies);
      repliesCursorRef.current = page.nextCursor;
      setRepliesHasMore(page.hasMore);
    } catch (e: unknown) {
      setRepliesError(e instanceof Error ? e.message : String(e));
    } finally {
      setRepliesLoading(false);
    }
  }, [user]);

  const loadMoreReplies = useCallback(async () => {
    if (repliesInFlight.current || !repliesHasMore || repliesLoading) return;
    repliesInFlight.current = true;
    setRepliesLoadingMore(true);
    try {
      const page = await fetchUserRepliesPage({ userId: user!.id, before: repliesCursorRef.current });
      setReplies((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.replies.filter((r) => !seen.has(r.id))];
      });
      repliesCursorRef.current = page.nextCursor;
      setRepliesHasMore(page.hasMore);
    } catch (e: unknown) {
      setRepliesError(e instanceof Error ? e.message : String(e));
    } finally {
      repliesInFlight.current = false;
      setRepliesLoadingMore(false);
    }
  }, [user, repliesHasMore, repliesLoading]);

  // Load both on focus so stats + lists are always fresh.
  useFocusEffect(
    useCallback(() => {
      load();
      loadReplies();
    }, [load, loadReplies])
  );

  // ── Sort notes (client-side, within loaded pages) ─────────────────────────
  const visible = useMemo(() => {
    if (sort === 'top') return [...notes].sort((a, b) => b.reactionTotal - a.reactionTotal);
    return notes;
  }, [notes, sort]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const runDelete = useCallback(async () => {
    const note = pendingDelete;
    if (!note) return;
    setDeletingId(note.id);
    setDeleteError(null);
    const prev = notes;
    setNotes((list) => list.filter((n) => n.id !== note.id));
    try {
      await deleteNote({ noteId: note.id, audioUrl: note.audio_url });
      setPendingDelete(null);
    } catch (e: unknown) {
      setNotes(prev);
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  }, [pendingDelete, notes]);

  // ── Shared header ─────────────────────────────────────────────────────────
  const listHeader = (
    <View style={{ marginBottom: space.elementGap, gap: 20 }}>
      <View>
        <Label muted>YOUR ARCHIVE</Label>
        <Display style={{ marginTop: 8 }}>ARCHIVE</Display>
        <Body muted style={{ fontSize: 17, marginTop: 6 }}>
          Your broadcasts and replies.
        </Body>
      </View>

      <View style={{ flexDirection: 'row', gap: 16 }}>
        {/* totalNotes now correctly excludes replies (migration 0017). */}
        <StatCard value={stats.totalNotes} label="NOTES" />
        <StatCard
          value={stats.totalReactions}
          label="REACTIONS"
          accent={stats.totalReactions > 0}
        />
      </View>

      <Rule />

      {/* Tab switcher: NOTES | REPLIES */}
      <Segmented options={TABS} value={tab} onChange={setTab} />
    </View>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <AppHeader />
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <AppHeader />
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={load} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />

      {tab === 'notes' ? (
        /* ── NOTES tab ────────────────────────────────────────────────────── */
        <FlatList
          key="notes"
          data={visible}
          keyExtractor={(item) => item.id}
          onEndReached={sort === 'new' ? loadMoreNotes : undefined}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
          ListHeaderComponent={
            <View style={{ gap: 20, marginBottom: space.elementGap }}>
              {listHeader}
              {stats.totalNotes > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <Label muted>{stats.totalNotes} BROADCAST{stats.totalNotes === 1 ? '' : 'S'}</Label>
                  <Segmented options={SORTS} value={sort} onChange={setSort} style={{ width: 200 }} />
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={{ gap: space.elementGap, alignItems: 'center', paddingTop: 32 }}>
              <Display style={{ textAlign: 'center' }}>NO{'\n'}SIGNAL.</Display>
              <Body muted style={{ fontSize: 17, textAlign: 'center' }}>
                Tap record to send your first broadcast.
              </Body>
              <SignalButton label="● RECORD" onPress={() => router.navigate('/record')} />
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <VoiceNoteCard
              title="YOU"
              own
              createdAt={item.created_at}
              durationSec={item.duration}
              audioUrl={item.audio_url}
              reactionCounts={item.reactionCounts}
              staticTotal={item.reactionTotal}
              onDelete={deletingId === item.id ? undefined : () => { setDeleteError(null); setPendingDelete(item); }}
              active={item.id === playingNoteId}
              onActivate={() => activate(item.id)}
              initialPosition={getInitialPosition(item.id)}
              onSavePosition={(s) => savePosition(item.id, s)}
              onFinish={() => handleFinish(item.id)}
              replyCount={item.replyCount}
              onPressReplies={() => router.navigate(`/thread/${item.id}`)}
            />
          )}
        />
      ) : (
        /* ── REPLIES tab ──────────────────────────────────────────────────── */
        <FlatList
          key="replies"
          data={replies}
          keyExtractor={(item) => item.id}
          onEndReached={loadMoreReplies}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
          ListHeaderComponent={
            <View style={{ gap: 20, marginBottom: space.elementGap }}>
              {listHeader}
              {replies.length > 0 && (
                <Label muted>{replies.length} REPL{replies.length === 1 ? 'Y' : 'IES'}</Label>
              )}
            </View>
          }
          ListEmptyComponent={
            !repliesLoading ? (
              <View style={{ gap: space.elementGap, alignItems: 'center', paddingTop: 32 }}>
                <Display style={{ textAlign: 'center' }}>NO{'\n'}REPLIES.</Display>
                <Body muted style={{ fontSize: 17, textAlign: 'center' }}>
                  Tap a note's reply label to jump in.
                </Body>
              </View>
            ) : (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            )
          }
          ListFooterComponent={
            repliesLoadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : repliesError ? (
              <Body style={{ color: colors.error, textAlign: 'center' }}>{repliesError}</Body>
            ) : null
          }
          renderItem={({ item }) => (
            <UserReplyCard
              reply={item}
              active={item.id === playingNoteId}
              onActivate={() => activate(item.id)}
              initialPosition={getInitialPosition(item.id)}
              onSavePosition={(s) => savePosition(item.id, s)}
              onFinish={() => handleFinish(item.id)}
              onPressThread={() => router.navigate(`/thread/${item.parentNoteId}`)}
            />
          )}
        />
      )}

      <ConfirmModal
        visible={!!pendingDelete}
        title="DELETE BROADCAST?"
        message={
          deleteError ??
          'This removes the audio and all its reactions. This cannot be undone.'
        }
        confirmLabel="DELETE"
        cancelLabel="KEEP"
        tone="danger"
        busy={!!deletingId}
        onConfirm={runDelete}
        onCancel={() => { setPendingDelete(null); setDeleteError(null); }}
      />
    </SafeAreaView>
  );
}

// ── UserReplyCard ─────────────────────────────────────────────────────────────
// Compact card for one of the user's own replies. Shows:
//   "↩ REPLY TO @USERNAME" context label (tappable → thread)
//   Waveform audio player
// Visually distinct from a full VoiceNoteCard: smaller, inset left border.

function UserReplyCard({
  reply,
  active,
  onActivate,
  initialPosition,
  onSavePosition,
  onFinish,
  onPressThread,
}: {
  reply: UserReply;
  active: boolean;
  onActivate: () => void;
  initialPosition: number;
  onSavePosition: (s: number) => void;
  onFinish: () => void;
  onPressThread: () => void;
}) {
  return (
    <Card
      style={{
        gap: 12,
        padding: 16,
        // Lime left border distinguishes replies from top-level note cards.
        borderLeftWidth: 4,
        borderLeftColor: colors.signal,
        borderRadius: radius.lg,
      }}
    >
      {/* Context label: tap to jump to the thread */}
      <Pressable
        onPress={onPressThread}
        accessibilityLabel={`Open thread with ${reply.parentAuthorUsername}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      >
        <Label muted style={{ fontSize: 10 }}>↩ REPLY TO</Label>
        <Label style={{ fontSize: 10, color: colors.signal }}>
          @{reply.parentAuthorUsername.toUpperCase()}
        </Label>
        <Label muted style={{ fontSize: 10, marginLeft: 'auto' }}>
          {timeAgo(reply.created_at)}
          {typeof reply.duration === 'number'
            ? `  ·  0:${reply.duration < 10 ? '0' : ''}${reply.duration}`
            : ''}
        </Label>
      </Pressable>

      {/* Compact waveform player */}
      <AudioPlayer
        uri={reply.audio_url}
        bars={24}
        height={52}
        active={active}
        onActivate={onActivate}
        initialPosition={initialPosition}
        onSavePosition={onSavePosition}
        onFinish={onFinish}
      />
    </Card>
  );
}
