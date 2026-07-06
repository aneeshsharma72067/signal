import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, ConfirmModal, Display, Label, Rule, Segmented, SignalButton, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useWindowedPlayback } from '../hooks/useWindowedPlayback';
import { deleteNote, fetchProfileStats, fetchUserNotesPage } from '../lib/notes';
import { colors, space } from '../theme';
import type { ProfileStats, UserNote } from '../types';

const SORTS = [
  { value: 'new' as const, label: 'NEWEST' },
  { value: 'top' as const, label: 'TOP' },
];

// Lists the current user's broadcasts with reaction summaries, paged with
// infinite scroll (no longer pulls the entire history at once). Totals come
// from the server-side stats RPC. Each note can be deleted (removes the row,
// its reactions, and the audio file).
export default function MyNotesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [stats, setStats] = useState<ProfileStats>({ totalNotes: 0, totalReactions: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserNote | null>(null); // note awaiting confirm
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const { playingNoteId, activate, savePosition, getInitialPosition, handleFinish } = useWindowedPlayback();

  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [page, s] = await Promise.all([
        fetchUserNotesPage({ userId: user!.id }),
        fetchProfileStats(user!.id),
      ]);
      setNotes(page.notes);
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
      setStats(s);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore || loading) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchUserNotesPage({ userId: user!.id, before: cursorRef.current });
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.notes.filter((n) => !seen.has(n.id))];
      });
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [user, hasMore, loading]);

  // Refetch when the screen regains focus (e.g. after posting).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalReactions = stats.totalReactions;

  // NOTE: "TOP" sorts only the pages loaded so far (keyset paging is by time).
  // A full top-sort would need a server-side ordering; acceptable for the list.
  const visible = useMemo(() => {
    if (sort === 'top') return [...notes].sort((a, b) => b.reactionTotal - a.reactionTotal);
    return notes;
  }, [notes, sort]);

  // Run the actual delete for the note held in `pendingDelete` (confirmed via
  // the themed modal). Optimistic removal; restore + show error on failure.
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={load} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          onEndReached={sort === 'new' ? loadMore : undefined}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={{ marginBottom: space.elementGap, gap: 20 }}>
              <View>
                <Label muted>YOUR ARCHIVE</Label>
                <Display style={{ marginTop: 8 }}>ARCHIVE</Display>
                <Body muted style={{ fontSize: 17, marginTop: 6 }}>Your broadcasts and their resonance.</Body>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <StatCard value={stats.totalNotes} label="NOTES" />
                <StatCard value={totalReactions} label="REACTIONS" accent={totalReactions > 0} />
              </View>

              <Rule />

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
