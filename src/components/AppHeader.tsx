import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useUnreadBadge } from '../hooks/useUnreadBadge';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { colors, fonts, radius } from '../theme';
import { Headline, Label } from './ui';

// Top app bar with the SIGNAL wordmark and a small route switcher.
// Design forbids a generic bottom nav, so navigation lives up here.
const ROUTES = [
  { href: '/feed' as const, label: 'FEED' },
  { href: '/my-notes' as const, label: 'NOTES' },
  { href: '/profile' as const, label: 'ME' },
];

export default function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { unreadCount, refresh } = useUnreadBadge();
  const { unreadCount: unreadMessages, refresh: refreshMessages } = useUnreadMessages();

  // Re-sync both badges on every route change so returning from the Activity
  // or Messages screen (which mark things read) drops the counts back down.
  useEffect(() => {
    refresh();
    refreshMessages();
  }, [pathname, refresh, refreshMessages]);

  return (
    <View
      style={{
        borderBottomWidth: 2,
        borderBottomColor: colors.ink,
        backgroundColor: colors.surface,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 24,
          height: 64,
        }}>
        <Headline style={{ fontSize: 24 }}>SIGNAL</Headline>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
          {ROUTES.map((r) => {
            const isActive = pathname === r.href;
            return (
              <Pressable key={r.href} onPress={() => router.navigate(r.href)} hitSlop={8}>
                <Label
                  style={{
                    color: isActive ? colors.ink : colors.onSurfaceVariant,
                    textDecorationLine: isActive ? 'underline' : 'none',
                  }}>
                  {r.label}
                </Label>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.navigate('/search')}
            hitSlop={8}
            accessibilityLabel="Search users"
            style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="search" size={22} color={colors.ink} />
          </Pressable>
          <IconWithBadge
            name="chatbubble-ellipses-outline"
            activeName="chatbubble-ellipses"
            count={unreadMessages}
            onPress={() => router.navigate('/messages')}
            accessibilityLabel="Messages"
          />
          <Bell count={unreadCount} onPress={() => router.navigate('/notifications')} />
        </View>
      </View>
    </View>
  );
}

// A tappable Ionicon with an unread-count badge. The badge is a lime pill
// showing the count (capped at 9+); hidden when there's nothing unread. The
// icon swaps to its filled variant while there are unread items.
function IconWithBadge({
  name,
  activeName,
  count,
  onPress,
  accessibilityLabel,
}: {
  name: keyof typeof Ionicons.glyphMap;
  activeName: keyof typeof Ionicons.glyphMap;
  count: number;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityLabel={accessibilityLabel} style={{ width: 24, height: 24 }}>
      <Ionicons name={count > 0 ? activeName : name} size={22} color={colors.ink} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -6,
            right: -8,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: colors.signal,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.ink }}>
            {count > 9 ? '9+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// Activity bell — thin wrapper over IconWithBadge with the notification glyphs.
function Bell({ count, onPress }: { count: number; onPress: () => void }) {
  return (
    <IconWithBadge
      name="notifications-outline"
      activeName="notifications"
      count={count}
      onPress={onPress}
      accessibilityLabel="Activity"
    />
  );
}
