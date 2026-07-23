import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useEffect } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, iosFocusShadow } from '../theme';

// Neo-brutalist floating tab bar. Detached from all screen edges, rounded
// corners, 2px ink border + solid offset shadow.
//
// Performance model — the whole transition runs on the UI thread:
//  - Tab geometry lives in a shared value (SlotsSV), written once from onLayout.
//    It never calls setState, so measuring a tab triggers ZERO React renders.
//  - A single shared value `progress` tracks the animated active index. A tap
//    drives it with withTiming; that's the only JS→UI hop per tab change.
//  - The pill (translateX), each label (width/opacity), and each icon crossfade
//    are all useAnimatedStyle worklets reading `progress`. React re-renders
//    nothing during the animation, so there's no main-thread jank or flicker.
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
const ICON = 20;
// JetBrains Mono is monospaced, so label width is exact from the character
// count — no measure pass needed. Advance ≈ 0.6 * fontSize (12) = 7.2px, plus a
// small gap between icon and text.
const CHAR_W = 7.2;
const GAP = 6;
const labelWidth = (s: string) => Math.ceil(s.length * CHAR_W);

export default function BrutalTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Per-tab measured {x, width}, held on the UI thread. Written from onLayout,
  // read by the pill worklet. Not React state → measuring never re-renders.
  const slots = useSharedValue<{ x: number; width: number }[]>([]);
  // Animated active index (fractional mid-transition). The single source the
  // pill / labels / icons all interpolate against.
  const progress = useSharedValue(state.index);

  // The one JS→UI hop: when the route changes, spring `progress` to it.
  useEffect(() => {
    progress.value = withTiming(state.index, TIMING);
  }, [state.index, progress]);

  const indices = TABS.map((_, i) => i);

  // Pill: translateX interpolated across measured slot xs. Width is constant
  // (equal cells) so only the transform animates — cheapest possible path.
  const pillStyle = useAnimatedStyle(() => {
    const s = slots.value;
    if (s.length < TABS.length) return { opacity: 0 };
    const x = interpolate(progress.value, indices, s.map((slot) => slot.x));
    return {
      opacity: 1,
      width: s[0].width,
      transform: [{ translateX: x }],
    };
  });

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
        {/* Sliding lime pill, behind the tabs. Positioned inside the row's 8px
            padding; onLayout stores slot x already offset by that padding. */}
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

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (state.index !== index && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          // Store this cell's geometry (offset by the row's 8px padding, which
          // the pill's `left: 8` already applies). Mutating the shared value's
          // array does not re-render React.
          const onLayout = (e: LayoutChangeEvent) => {
            const { x, width } = e.nativeEvent.layout;
            const next = [...slots.value];
            next[index] = { x: x - 8, width };
            slots.value = next;
          };

          return (
            <Tab
              key={route.key}
              tab={tab}
              index={index}
              progress={progress}
              onPress={onPress}
              onLayout={onLayout}
              selected={state.index === index}
            />
          );
        })}
      </View>
    </View>
  );
}

type SharedProgress = ReturnType<typeof useSharedValue<number>>;

// A single tab cell. All animation reads the shared `progress`; nothing here
// re-renders during a transition. `closeness` (1 at this tab, 0 when a full
// index away) drives the label reveal and icon crossfade.
function Tab({
  tab,
  index,
  progress,
  onPress,
  onLayout,
  selected,
}: {
  tab: (typeof TABS)[number];
  index: number;
  progress: SharedProgress;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  selected: boolean;
}) {
  const fullWidth = labelWidth(tab.label);

  // Label morphs in: width 0→full and opacity 0→1 as this tab becomes active.
  const labelStyle = useAnimatedStyle(() => {
    const closeness = 1 - Math.min(Math.abs(progress.value - index), 1);
    return {
      width: fullWidth * closeness,
      opacity: closeness,
      marginLeft: GAP * closeness,
    };
  });

  // Icon crossfade — filled glyph fades in as outline fades out. Avoids a
  // `name` prop swap (which would be a React render), and reads smoother.
  const outlineStyle = useAnimatedStyle(() => ({
    opacity: Math.min(Math.abs(progress.value - index), 1),
  }));
  const filledStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(Math.abs(progress.value - index), 1),
  }));

  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityState={selected ? { selected: true } : {}}
      accessibilityLabel={tab.label}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
      }}>
      <View style={{ width: ICON, height: ICON }}>
        <Animated.View style={[{ position: 'absolute' }, outlineStyle]}>
          <Ionicons name={tab.icon} size={ICON} color={colors.ink} />
        </Animated.View>
        <Animated.View style={[{ position: 'absolute' }, filledStyle]}>
          <Ionicons name={tab.activeIcon} size={ICON} color={colors.ink} />
        </Animated.View>
      </View>
      <Animated.Text
        numberOfLines={1}
        style={[
          { fontFamily: fonts.mono, fontSize: 12, color: colors.ink, overflow: 'hidden' },
          labelStyle,
        ]}>
        {tab.label}
      </Animated.Text>
    </Pressable>
  );
}
