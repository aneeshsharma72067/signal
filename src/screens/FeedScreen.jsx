import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Display, Label, SignalButton } from '../components/ui';
import { useFeed } from '../hooks/useFeed';
import { colors, space } from '../theme';

// Global home feed: every user's broadcasts, newest first, paged 10 at a time
// with infinite scroll. Reacting updates the card in place (count + your
// reaction) — notes are never removed from the feed.
export default function FeedScreen() {
  const router = useRouter();
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
  } = useFeed();
  const [reactingId, setReactingId] = useState(null);

  const onReact = useCallback(
    async (noteId, emoji) => {
      setReactingId(noteId);
      await react(noteId, emoji);
      setReactingId(null);
    },
    [react]
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
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: space.containerPadding,
          gap: space.elementGap,
          paddingBottom: 120,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.ink} />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={{ marginBottom: space.elementGap }}>
            <Display>SIGNAL</Display>
            <Body muted style={{ fontSize: 18, marginTop: 8 }}>Voices from everyone, freshest first.</Body>
          </View>
        }
        ListEmptyComponent={<EmptyState onRecord={() => router.navigate('/record')} />}
        ListFooterComponent={
          <FeedFooter loadingMore={loadingMore} hasMore={hasMore} count={notes.length} />
        }
        renderItem={({ item }) => (
          <VoiceNoteCard
            title={item.author?.username ?? 'ANON'}
            createdAt={item.created_at}
            durationSec={item.duration}
            audioUrl={item.audio_url}
            reactionCounts={item.reactionCounts}
            total={item.total}
            myReaction={item.myReaction}
            onReact={(emoji) => onReact(item.id, emoji)}
            reactionDisabled={reactingId === item.id}
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

function Screen({ children }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />
      {children}
    </SafeAreaView>
  );
}

function FeedFooter({ loadingMore, hasMore, count }) {
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

function EmptyState({ onRecord }) {
  return (
    <View style={{ flex: 1, gap: space.elementGap, alignItems: 'center', justifyContent: 'center' }}>
      <Display style={{ textAlign: 'center' }}>NOTHING{'\n'}NEW.</Display>
      <Body muted style={{ fontSize: 18, textAlign: 'center' }}>Be the first to broadcast.</Body>
    </View>
  );
}
