import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Chip, IconButton, Label, Monogram, Rule, Segmented, SignalButton } from '../components/ui';
import { useFollowList } from '../hooks/useFollowList';
import { colors, radius, space } from '../theme';
import type { FollowDirection, FollowUser } from '../types';

const TABS = [
  { value: 'followers' as const, label: 'FOLLOWERS' },
  { value: 'following' as const, label: 'FOLLOWING' },
];

// Followers / following list for a user. Reached by tapping the FOLLOWERS or
// FOLLOWING stat on a profile. A segmented control flips between the two
// directions; each row is a tappable identity with an inline follow control
// (except the viewer's own row). Infinite scroll, 20 per page.
export default function FollowListScreen() {
  const params = useLocalSearchParams();
  const userId = pick(params.userId);
  const username = pick(params.username);
  const initial = (pick(params.direction) as FollowDirection) || 'followers';

  const router = useRouter();
  const [direction, setDirection] = useState<FollowDirection>(initial);

  const {
    users, loading, refreshing, loadingMore, error, pendingIds,
    reload, refresh, loadMore, toggleFollow,
  } = useFollowList(userId!, direction);

  const emptyCopy =
    direction === 'followers' ? 'No followers yet.' : 'Not following anyone yet.';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      {/* Top bar: back + subject name. */}
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
        <Label muted numberOfLines={1}>{(username || 'PROFILE').toUpperCase()}</Label>
      </View>

      {loading && users.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      ) : error && users.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={reload} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.containerPadding, gap: 12, paddingBottom: 48 }}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListHeaderComponent={
            <View style={{ gap: space.elementGap, marginBottom: 4 }}>
              <Segmented options={TABS} value={direction} onChange={(v) => setDirection(v as FollowDirection)} />
              <Rule />
            </View>
          }
          ListEmptyComponent={
            !loading ? (
              <Body muted style={{ fontSize: 17, paddingTop: 24 }}>{emptyCopy}</Body>
            ) : null
          }
          renderItem={({ item }) => (
            <FollowRow
              user={item}
              pending={pendingIds.has(item.id)}
              onPress={() => router.push({ pathname: '/user/[id]', params: { id: item.id } })}
              onToggle={() => toggleFollow(item)}
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

// A single follow-list row: monogram + username (tap → their profile), plus a
// compact follow chip on the right. The viewer's own row shows no control.
function FollowRow({
  user,
  pending,
  onPress,
  onToggle,
}: {
  user: FollowUser;
  pending: boolean;
  onPress: () => void;
  onToggle: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        borderWidth: 2,
        borderColor: colors.ink,
        borderRadius: radius.lg,
        backgroundColor: colors.canvas,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}>
      <Pressable
        onPress={onPress}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}>
        <Monogram name={user.username} size={44} filled={user.isFollowing || user.isSelf} />
        <View style={{ flex: 1 }}>
          <Body style={{ fontSize: 18, textTransform: 'uppercase' }} numberOfLines={1}>
            {user.username}
          </Body>
          {user.isSelf && <Label muted>YOU</Label>}
        </View>
      </Pressable>

      {!user.isSelf && (
        <Chip
          label={pending ? '…' : user.isFollowing ? '✓ FOLLOWING' : '+ FOLLOW'}
          filled={user.isFollowing}
          onPress={pending ? undefined : onToggle}
        />
      )}
    </View>
  );
}

// Normalize a route param that may arrive as string | string[].
function pick(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
