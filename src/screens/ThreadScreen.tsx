import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AudioPlayer from '../components/AudioPlayer';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Card, Label, Monogram, SignalButton } from '../components/ui';
import { timeAgo } from '../components/VoiceNoteCard';
import { useAuth } from '../context/AuthContext';
import { useWindowedPlayback } from '../hooks/useWindowedPlayback';
import { fetchNoteById } from '../lib/notes';
import { fetchRepliesPage } from '../lib/notes';
import { supabase } from '../lib/supabase';
import { colors, space } from '../theme';
import type { FeedNote, VoiceReply } from '../types';

// Thread view: the parent note is shown at the top, followed by an oldest-first
// list of voice replies. A realtime Supabase channel appends new replies live as
// they arrive. The "● REPLY" button opens ReplyRecordScreen as a full-screen modal.
export default function ThreadScreen() {
  const router = useRouter();
  const { id: noteId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  // Parent note state — fetched once on mount.
  const [note, setNote] = useState<FeedNote | null>(null);
  const [noteLoading, setNoteLoading] = useState(true);
  const [noteError, setNoteError] = useState<string | null>(null);

  // Reply list state.
  const [replies, setReplies] = useState<VoiceReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [repliesError, setRepliesError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  // Single-active-player across the reply list (same hook used by feed screens).
  const { playingNoteId, activate, savePosition, getInitialPosition, handleFinish } =
    useWindowedPlayback();

  // ── Load parent note ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!noteId || !user) return;
    setNoteLoading(true);
    fetchNoteById(noteId, user.id)
      .then((n) => setNote(n))
      .catch((e: unknown) =>
        setNoteError(e instanceof Error ? e.message : 'Could not load note.')
      )
      .finally(() => setNoteLoading(false));
  }, [noteId, user]);

  // ── Load first page of replies ────────────────────────────────────────────

  const loadFirstPage = useCallback(async () => {
    if (!noteId) return;
    setRepliesLoading(true);
    setRepliesError(null);
    cursorRef.current = null;
    try {
      const page = await fetchRepliesPage({ parentNoteId: noteId });
      setReplies(page.replies);
      setHasMore(page.hasMore);
      cursorRef.current = page.nextCursor;
    } catch (e: unknown) {
      setRepliesError(e instanceof Error ? e.message : 'Could not load replies.');
    } finally {
      setRepliesLoading(false);
    }
  }, [noteId]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  // ── Infinite scroll ───────────────────────────────────────────────────────

  const loadMore = useCallback(async () => {
    if (!noteId || !hasMore || inFlight.current || !cursorRef.current) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchRepliesPage({
        parentNoteId: noteId,
        after: cursorRef.current,
      });
      setReplies((prev) => [...prev, ...page.replies]);
      setHasMore(page.hasMore);
      cursorRef.current = page.nextCursor;
    } catch {
      // Non-fatal: user can scroll up and retry.
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [noteId, hasMore]);

  // ── Realtime: new replies appear live ────────────────────────────────────

  useEffect(() => {
    if (!noteId) return;

    const channel = supabase
      .channel(`thread:${noteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_notes',
          filter: `parent_note_id=eq.${noteId}`,
        },
        async (payload) => {
          // Re-fetch the newly inserted reply to get the signed audio URL +
          // resolved author username (the raw payload lacks both).
          if (!user) return;
          try {
            const page = await fetchRepliesPage({
              parentNoteId: noteId,
              // Fetch only from the new reply's timestamp onward to minimize data.
              after: (payload.new as { created_at: string }).created_at,
            });
            // Prepend the new reply only if it's not already in the list (de-dupe
            // by id in case the poster's optimistic state already added it).
            setReplies((prev) => {
              const existingIds = new Set(prev.map((r) => r.id));
              const fresh = page.replies.filter((r) => !existingIds.has(r.id));
              return [...prev, ...fresh];
            });
          } catch {
            // Realtime hydration failed: the user can pull-to-refresh.
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId, user]);

  // ── Also update parent note's replyCount when a new reply arrives ─────────

  useEffect(() => {
    if (!noteId) return;
    const channel = supabase
      .channel(`thread-count:${noteId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'voice_notes',
          filter: `parent_note_id=eq.${noteId}`,
        },
        () => {
          // Increment the displayed reply count optimistically.
          setNote((prev) => (prev ? { ...prev, replyCount: (prev.replyCount ?? 0) + 1 } : prev));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [noteId]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (noteLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <ThreadHeader onBack={() => router.back()} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (noteError || !note) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
        <ThreadHeader onBack={() => router.back()} />
        <View
          style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}
        >
          <Body style={{ color: colors.error }}>{noteError ?? 'Note not found.'}</Body>
          <SignalButton label="RETRY" onPress={loadFirstPage} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <ThreadHeader onBack={() => router.back()} />

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: space.containerPadding,
          gap: space.elementGap,
          paddingBottom: 140,
          flexGrow: 1,
        }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ gap: space.elementGap }}>
            {/* Parent note card — static (no reactions), full waveform player. */}
            <VoiceNoteCard
              title={note.author?.username ?? 'ANON'}
              own={note.author?.id === user?.id}
              onPressAuthor={() => {
                if (note.author?.id === user?.id) router.navigate('/profile');
                else if (note.author?.id) router.navigate(`/user/${note.author.id}`);
              }}
              createdAt={note.created_at}
              durationSec={note.duration}
              audioUrl={note.audio_url}
              reactionCounts={note.reactionCounts}
              staticTotal={note.total}
              active={note.id === playingNoteId}
              onActivate={() => activate(note.id)}
              initialPosition={getInitialPosition(note.id)}
              onSavePosition={(s) => savePosition(note.id, s)}
              onFinish={() => handleFinish(note.id)}
            />

            {/* Replies section header. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 4,
                paddingHorizontal: 4,
              }}
            >
              <Label muted style={{ fontSize: 11 }}>
                {note.replyCount === 1
                  ? '1 REPLY'
                  : `${note.replyCount ?? replies.length} REPLIES`}
              </Label>
              <View style={{ flex: 1, height: 2, backgroundColor: colors.ink, opacity: 0.1 }} />
            </View>

            {repliesLoading && (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            )}
            {repliesError && (
              <Body style={{ color: colors.error, textAlign: 'center' }}>{repliesError}</Body>
            )}
          </View>
        }
        ListEmptyComponent={
          !repliesLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Label muted>NO REPLIES YET. BE THE FIRST.</Label>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ paddingVertical: 20 }}>
              <ActivityIndicator color={colors.ink} />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <ReplyCard
            reply={item}
            isSelf={item.user_id === user?.id}
            active={item.id === playingNoteId}
            onActivate={() => activate(item.id)}
            initialPosition={getInitialPosition(item.id)}
            onSavePosition={(s) => savePosition(item.id, s)}
            onFinish={() => handleFinish(item.id)}
            onPressAuthor={() => {
              if (item.user_id === user?.id) router.navigate('/profile');
              else router.navigate(`/user/${item.user_id}`);
            }}
          />
        )}
      />

      {/* Fixed reply button. */}
      <View
        style={{
          position: 'absolute',
          bottom: 32,
          left: space.containerPadding,
          right: space.containerPadding,
        }}
      >
        <SignalButton
          label="● REPLY"
          onPress={() => router.navigate(`/thread/${noteId}/reply`)}
        />
      </View>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Back-button header row for the thread screen.
function ThreadHeader({ onBack }: { onBack: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: space.containerPadding,
        height: 56,
        gap: 16,
      }}
    >
      <Pressable
        onPress={onBack}
        accessibilityLabel="Go back"
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Label style={{ fontSize: 16 }}>←</Label>
      </Pressable>
      <Label style={{ fontSize: 13 }}>THREAD</Label>
    </View>
  );
}

// Compact card for a single reply: monogram + author + timestamp + waveform player.
function ReplyCard({
  reply,
  isSelf,
  active,
  onActivate,
  initialPosition,
  onSavePosition,
  onFinish,
  onPressAuthor,
}: {
  reply: VoiceReply;
  isSelf: boolean;
  active: boolean;
  onActivate: () => void;
  initialPosition: number;
  onSavePosition: (s: number) => void;
  onFinish: () => void;
  onPressAuthor: () => void;
}) {
  return (
    <Card style={{ gap: 14, padding: 16 }}>
      {/* Author row */}
      <Pressable
        onPress={onPressAuthor}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
      >
        <Monogram name={reply.author.username} size={36} filled={isSelf} />
        <View style={{ flex: 1, gap: 2 }}>
          <Label numberOfLines={1} style={{ fontSize: 12 }}>
            {reply.author.username}
          </Label>
          <Label muted style={{ fontSize: 10 }}>
            {timeAgo(reply.created_at)}
            {typeof reply.duration === 'number'
              ? `  ·  0:${reply.duration < 10 ? '0' : ''}${reply.duration}`
              : ''}
          </Label>
        </View>
      </Pressable>

      {/* Waveform audio player */}
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
