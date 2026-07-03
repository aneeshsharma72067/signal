import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { timeAgo } from '../components/VoiceNoteCard';
import { Body, IconButton, Label, Monogram, SignalButton } from '../components/ui';
import { useNotifications } from '../hooks/useNotifications';
import { colors, radius, space } from '../theme';
import type { AppNotification } from '../types';

// Activity: the viewer's notifications (reactions on their notes, new
// followers, notes from people they follow), newest first, 20 per page with
// infinite scroll and live prepends. Opening the screen marks everything read,
// clearing the header badge. Layout mirrors FollowListScreen.
export default function NotificationsScreen() {
  const router = useRouter();
  const {
    items, loading, refreshing, loadingMore, error,
    reload, refresh, loadMore, markAllSeen,
  } = useNotifications();

  // Clear the badge whenever this screen gains focus.
  useFocusEffect(useCallback(() => { markAllSeen(); }, [markAllSeen]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      {/* Top bar: back + title. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 24,
          height: 64,
          borderBottomWidth: 2,
          borderBottomColor: colors.ink,
        }}>
        <IconButton glyph="‹" size={40} onPress={() => router.back()} accessibilityLabel="Back" />
        <Label muted>ACTIVITY</Label>
      </View>

      {loading && items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      ) : error && items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={reload} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.containerPadding, gap: 12, paddingBottom: 48, flexGrow: 1 }}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListEmptyComponent={
            !loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                <Body muted style={{ fontSize: 18, textAlign: 'center' }}>
                  No activity yet. React, follow, and post to get things moving.
                </Body>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <NotificationRow
              item={item}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.actor.id } })}
            />
          )}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// One activity row: actor monogram + a copy line + timestamp. Unread rows are
// filled lime (monogram) with a lime left rail; read rows are plain.
function NotificationRow({ item, onPress }: { item: AppNotification; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 2,
        borderColor: colors.ink,
        borderRadius: radius.lg,
        backgroundColor: colors.canvas,
        borderLeftWidth: item.read ? 2 : 8,
        borderLeftColor: item.read ? colors.ink : colors.signal,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}>
      <Monogram name={item.actor.username} size={44} filled={!item.read} />
      <View style={{ flex: 1, gap: 4 }}>
        <Body style={{ fontSize: 16 }} numberOfLines={2}>
          {copyFor(item)}
        </Body>
        <Label muted style={{ fontSize: 11 }}>{timeAgo(item.createdAt)}</Label>
      </View>
    </Pressable>
  );
}

// The human-readable line for a notification. Username is uppercased to match
// the app's identity styling.
function copyFor(item: AppNotification): string {
  const who = item.actor.username.toUpperCase();
  switch (item.type) {
    case 'reaction':
      return `${who} reacted ${item.emoji ?? ''} to your note`;
    case 'follow':
      return `${who} followed you`;
    case 'note':
      return `${who} posted a new note`;
    default:
      return who;
  }
}
