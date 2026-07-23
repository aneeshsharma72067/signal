import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, iosFocusShadow } from '../theme';

// Neo-brutalist floating tab bar. Detached from all screen edges (bottom/left/
// right margins), rounded corners, 2px ink border + solid offset shadow.
//
// Animation: a single lime pill slides between tabs (translateX + width spring
// to the measured slot of the active tab), and each tab's text label grows in
// from the icon — the icon stays put while the label's width/opacity animate,
// producing an icon→text morph.
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

// Timing shared by the pill slide and the label reveal so they move together.
const TIMING = { duration: 260 };

export default function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Measured {x, width} of each tab slot, filled in via onLayout. The sliding
  // pill animates to the active slot; until a slot is measured it stays hidden.
  const [slots, setSlots] = useState<Record<number, { x: number; width: number }>>({});

  const active = state.index;
  const activeSlot = slots[active];

  // Pill geometry follows the active slot. useDerivedValue re-runs whenever the
  // dependency (activeSlot) changes; withTiming makes the jump a slide.
  const pillX = useDerivedValue(() => withTiming(activeSlot?.x ?? 0, TIMING));
  const pillW = useDerivedValue(() => withTiming(activeSlot?.width ?? 0, TIMING));

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
    width: pillW.value,
    opacity: activeSlot ? 1 : 0,
  }));

  return (
    <View
      // Absolute so the bar detaches and floats above the screen content.
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 16,
      }}
      pointerEvents="box-none">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          padding: 8,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: colors.surface,
          ...iosFocusShadow,
        }}>
        {/* Sliding lime pill sits behind the tabs (absolute inside the padded
            row). Its offset by the container's 8px padding via top/left. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 8,
              top: 8,
              bottom: 8,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.ink,
              backgroundColor: colors.signal,
            },
            pillStyle,
          ]}
        />
        {state.routes.map((route, index) => {
          const tab = TABS.find((t) => t.name === route.name);
          if (!tab) return null;
          const isActive = active === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Capture this tab's slot geometry so the pill knows where to slide.
          const onLayout = (e: LayoutChangeEvent) => {
            const { x, width } = e.nativeEvent.layout;
            setSlots((prev) =>
              prev[index]?.x === x && prev[index]?.width === width
                ? prev
                : { ...prev, [index]: { x, width } },
            );
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLayout={onLayout}
              accessibilityRole="button"
              accessibilityState={isActive ? { selected: true } : {}}
              accessibilityLabel={tab.label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                height: 48,
                paddingHorizontal: 16,
              }}>
              <Ionicons
                name={isActive ? tab.activeIcon : tab.icon}
                size={20}
                color={colors.ink}
              />
              <TabLabel label={tab.label} active={isActive} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// Label that morphs in beside the icon: width + opacity animate from 0 so the
// icon appears to expand into the icon+text pill. Rendered with numberOfLines
// so the text never wraps while its container width is mid-animation.
function TabLabel({ label, active }: { label: string; active: boolean }) {
  // Approx label width by character count — cheap and avoids a measure pass.
  const target = active ? label.length * 8 + 8 : 0;

  const style = useAnimatedStyle(() => ({
    width: withTiming(target, TIMING),
    opacity: withTiming(active ? 1 : 0, TIMING),
  }));

  return (
    <Animated.View style={[{ overflow: 'hidden' }, style]}>
      <Animated.Text
        numberOfLines={1}
        style={{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink }}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
}
