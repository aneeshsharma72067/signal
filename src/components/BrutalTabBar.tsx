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
// Layout: tabs are equal-width flex cells so they spread evenly across the bar.
//
// Animation (tuned for low-end devices):
//  - A single lime pill slides between tabs using translateX ONLY. Because all
//    cells are the same width the pill's width never changes, so nothing layout
//    -related animates per frame — it's a pure transform, which Reanimated runs
//    on the UI thread / GPU and stays smooth on cheap hardware.
//  - Each active tab's label fades in (opacity only, no layout) beside the icon.
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

const TIMING = { duration: 240 };

export default function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  // Measured {x, width} of each tab cell (all equal). Filled once via onLayout;
  // the sliding pill reads the active cell's geometry. Hidden until measured.
  const [slots, setSlots] = useState<Record<number, { x: number; width: number }>>({});

  const active = state.index;
  const activeSlot = slots[active];

  // translateX is the only animated value — width stays constant (equal cells).
  const pillX = useDerivedValue(() => withTiming(activeSlot?.x ?? 0, TIMING));
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
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
        {/* Sliding lime pill, behind the tabs. Width matches one cell; only its
            translateX animates. Positioned inside the 8px row padding. */}
        {activeSlot && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: 8,
                top: 8,
                bottom: 8,
                width: activeSlot.width,
                borderRadius: 16,
                borderWidth: 2,
                borderColor: colors.ink,
                backgroundColor: colors.signal,
              },
              pillStyle,
            ]}
          />
        )}
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

          // Capture each cell's geometry so the pill knows where to slide. The
          // pill's `left: 8` already accounts for the row padding, so store the
          // raw layout x (relative to the row) and subtract that padding.
          const onLayout = (e: LayoutChangeEvent) => {
            const { x, width } = e.nativeEvent.layout;
            const slot = { x: x - 8, width };
            setSlots((prev) =>
              prev[index]?.x === slot.x && prev[index]?.width === slot.width
                ? prev
                : { ...prev, [index]: slot },
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
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 48,
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

// Label beside the icon. Fades in via opacity only (no width/layout animation)
// so it costs nothing on low-end GPUs. When inactive it collapses to width 0 so
// the icon centers in its cell; that width flip is a one-shot layout, not a
// per-frame animation.
function TabLabel({ label, active }: { label: string; active: boolean }) {
  const style = useAnimatedStyle(() => ({ opacity: withTiming(active ? 1 : 0, TIMING) }));

  // Non-active labels take no space (display via width:0 wrapper), keeping the
  // icon centered. Active label renders at its natural width.
  if (!active) return null;

  return (
    <Animated.Text
      numberOfLines={1}
      style={[{ fontFamily: fonts.mono, fontSize: 12, color: colors.ink }, style]}>
      {label}
    </Animated.Text>
  );
}
