import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, iosFocusShadow } from '../theme';

// Neo-brutalist floating tab bar. Detached from all screen edges (bottom/left/
// right margins), rounded corners, 2px ink border + solid offset shadow. The
// active tab is a lime pill; the row lives in a card that floats over content.
//
// One config entry per tab. `name` matches the route file in app/(tabs)/.
const TABS: {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
}[] = [
  { name: 'feed', label: 'FEED', icon: 'radio-outline', activeIcon: 'radio' },
  { name: 'my-notes', label: 'NOTES', icon: 'mic-outline', activeIcon: 'mic' },
  { name: 'profile', label: 'ME', icon: 'person-outline', activeIcon: 'person' },
];

export default function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      // Absolute so the bar detaches and floats above the screen content.
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        // Sit above the OS gesture/nav area, never flush to the bottom edge.
        bottom: insets.bottom + 16,
      }}
      pointerEvents="box-none">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: 8,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: colors.surface,
          ...iosFocusShadow,
        }}>
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const isActive = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            // Only navigate if not already focused and the tab didn't cancel.
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 48,
                borderRadius: 16,
                borderWidth: isActive ? 2 : 0,
                borderColor: colors.ink,
                backgroundColor: isActive ? colors.signal : 'transparent',
              }}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={20}
                color={colors.ink}
              />
              {/* Label only on the active tab — keeps the pill tight, inactive
                  tabs stay icon-only so the row never crowds on small screens. */}
              {isActive && (
                <Text style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink }}>
                  {tab.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
