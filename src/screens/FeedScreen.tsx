import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Display, Label, Rule, Segmented, SignalButton, SkeletonCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFeed } from '../hooks/useFeed';
import { useWindowedPlayback } from '../hooks/useWindowedPlayback';
import { colors, space } from '../theme';
import type { FeedNote, FeedScope, ReactionEmoji } from '../types';

const SCOPES = [
  { value: 'everyone' as const, label: 'EVERYONE' },
  { value: 'following' as const, label: 'FOLLOWING' },
];

// Home feed. `scope` picks the source server-side: EVERYONE (the global wall) or
// FOLLOWING (only people the viewer follows). Newest first, paged 10 at a time
// with infinite scroll. Reacting updates the card in place — notes never removed.
export default function FeedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [scope, setScope] = useState<FeedScope>('everyone');
  const {
    notes,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore,
    reload,
    refresh,
    loadMore,
    react,
  } = useFeed(scope);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const { playingNoteId, activate, savePosition, getInitialPosition, handleFinish } = useWindowedPlayback();

  const onReact = useCallback(
    async (noteId: string, emoji: ReactionEmoji) => {
      setReactingId(noteId);
      await react(noteId, emoji);
      setReactingId(null);
    },
    [react]
  );

  // Tap an author → their public profile (own notes route to the /profile tab).
  const openAuthor = useCallback(
    (note: FeedNote) => {
      if (note.author?.id === user?.id) router.navigate('/profile');
      else if (note.author?.id) router.navigate(`/user/${note.author.id}`);
    },
    [router, user]
  );

  // The list header (title + scope switcher) stays mounted across scope changes
  // and loads — so the Segmented pill can slide instead of the whole screen
  // remounting. It's defined once and reused by both the loading and loaded
  // states below.
  const listHeader = (
    <View style={{ marginBottom: space.elementGap, gap: 20 }}>
      <View>
        <Label muted>{scope === 'following' ? '◆ YOUR CIRCLE' : '● LIVE BROADCAST'}</Label>
        <Display style={{ marginTop: 8 }}>SIGNAL</Display>
        <Body muted style={{ fontSize: 17, marginTop: 6 }}>
          {scope === 'following' ? 'Notes from the voices you follow.' : 'Voices from everyone, freshest first.'}
        </Body>
      </View>
      <Rule />
      <Segmented options={SCOPES} value={scope} onChange={setScope} />
    </View>
  );

  // Hard error with no data: a retry screen (header still shown so the user can
  // switch scope without a remount).
  if (error && notes.length === 0 && !loading) {
    return (
      <Screen>
        <View style={{ padding: space.containerPadding, flex: 1 }}>
          {listHeader}
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
            <Body style={{ color: colors.error }}>{error}</Body>
            <SignalButton label="RETRY" onPress={reload} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {/* Reaction/pagination failures don't blank the feed — surface them as a
          dismissible banner so a failed write is visible, not silent. */}
      {error && notes.length > 0 && (
        <View
          style={{
            marginHorizontal: space.containerPadding,
            marginTop: 12,
            padding: 14,
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: colors.errorContainer,
            borderRadius: 12,
          }}>
          <Label style={{ color: colors.onErrorContainer }} numberOfLines={2}>{error}</Label>
        </View>
      )}
      {/* ONE FlatList, always mounted — so the header (and its animated
          Segmented pill) never remounts on a scope switch. While a fresh page
          loads, the data is skeleton placeholders that pulse in place; the real
          notes swap in when the fetch resolves. */}
      <FlatList
        data={loading ? SKELETON_DATA : notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: space.containerPadding,
          gap: space.elementGap,
          paddingBottom: 140,
          flexGrow: 1,
        }}
        // No pull-to-refresh over skeletons.
        refreshControl={
          loading ? undefined : (
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />
          )
        }
        onEndReached={loading ? undefined : loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={loading ? null : <EmptyState scope={scope} />}
        ListFooterComponent={
          loading ? null : <FeedFooter loadingMore={loadingMore} hasMore={hasMore} count={notes.length} />
        }
        renderItem={({ item }) =>
          loading ? (
            <SkeletonCard />
          ) : (
            <VoiceNoteCard
              title={item.author?.username ?? 'ANON'}
              own={item.author?.id === user?.id}
              onPressAuthor={() => openAuthor(item)}
              createdAt={item.created_at}
              durationSec={item.duration}
              audioUrl={item.audio_url}
              reactionCounts={item.reactionCounts}
              total={item.total}
              myReaction={item.myReaction}
              onReact={(emoji) => onReact(item.id, emoji)}
              reactionDisabled={reactingId === item.id}
              active={item.id === playingNoteId}
              onActivate={() => activate(item.id)}
              initialPosition={getInitialPosition(item.id)}
              onSavePosition={(s) => savePosition(item.id, s)}
              onFinish={() => handleFinish(item.id)}
              replyCount={item.replyCount}
              onPressReplies={() => router.navigate(`/thread/${item.id}`)}
            />
          )
        }
      />

      {/* Single lime focal action: record. */}
      <View style={{ position: 'absolute', bottom: 32, left: space.containerPadding, right: space.containerPadding }}>
        <SignalButton label="● BROADCAST" onPress={() => router.navigate('/record')} />
      </View>
    </Screen>
  );
}

// Placeholder rows shown while a fresh page loads (count ≈ a typical first
// page). Cast to FeedNote[] so they share the list's data type; renderItem only
// reads `id` from them (it renders a SkeletonCard, ignoring the rest).
const SKELETON_DATA = ['s1', 's2', 's3', 's4'].map((id) => ({ id })) as unknown as FeedNote[];

function Screen({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />
      {children}
    </SafeAreaView>
  );
}

function FeedFooter({ loadingMore, hasMore, count }: { loadingMore: boolean; hasMore: boolean; count: number }) {
  if (loadingMore) {
    return (
      <View style={{ paddingVertical: 24 }}>
        <ActivityIndicator color={colors.ink} />
      </View>
    );
  }
  if (!hasMore && count > 0) {
    return (
      <View style={{ paddingVertical: 24, alignItems: 'center' }}>
        <Label muted>— END OF SIGNAL —</Label>
      </View>
    );
  }
  return null;
}

function EmptyState({ scope }: { scope: FeedScope }) {
  if (scope === 'following') {
    return (
      <View style={{ flex: 1, gap: space.elementGap, alignItems: 'center', justifyContent: 'center' }}>
        <Display style={{ textAlign: 'center' }}>QUIET.</Display>
        <Body muted style={{ fontSize: 18, textAlign: 'center' }}>
          Follow voices on EVERYONE to fill this feed.
        </Body>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, gap: space.elementGap, alignItems: 'center', justifyContent: 'center' }}>
      <Display style={{ textAlign: 'center' }}>NOTHING{'\n'}NEW.</Display>
      <Body muted style={{ fontSize: 18, textAlign: 'center' }}>Be the first to broadcast.</Body>
    </View>
  );
}
