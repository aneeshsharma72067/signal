import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Display, Label, Rule, Segmented, SignalButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useFeed } from '../hooks/useFeed';
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
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);

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

  // First-load: full-screen spinner. Hard error with no data: retry screen.
  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      </Screen>
    );
  }

  if (error && notes.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={reload} />
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
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: space.containerPadding,
          gap: space.elementGap,
          paddingBottom: 140,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
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
        }
        ListEmptyComponent={<EmptyState scope={scope} />}
        ListFooterComponent={
          <FeedFooter loadingMore={loadingMore} hasMore={hasMore} count={notes.length} />
        }
        renderItem={({ item }) => (
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
            onToggleActive={() => setPlayingNoteId((prev) => (prev === item.id ? null : item.id))}
            onFinish={() => setPlayingNoteId(null)}
          />
        )}
      />

      {/* Single lime focal action: record. */}
      <View style={{ position: 'absolute', bottom: 32, left: space.containerPadding, right: space.containerPadding }}>
        <SignalButton label="● BROADCAST" onPress={() => router.navigate('/record')} />
      </View>
    </Screen>
  );
}

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
