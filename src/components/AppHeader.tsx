import { useRouter, usePathname } from 'expo-router';
import { Pressable, View } from 'react-native';

import { colors } from '../theme';
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
        <View style={{ flexDirection: 'row', gap: 18 }}>
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
        </View>
      </View>
    </View>
  );
}
