import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, type ReactNode, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { brutalistShadow, colors, fonts, iosFocusShadow, radius, space } from '../theme';

type TextProps = {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  muted?: boolean;
  numberOfLines?: number;
};

type Press = () => void;

// A subtle 1px hairline. Use sparingly — heavy structure comes from 2px ink.
export function Divider({
  style,
  weight = 1,
  color = colors.outlineVariant,
}: {
  style?: StyleProp<ViewStyle>;
  weight?: number;
  color?: string;
}) {
  return <View style={[{ height: weight, backgroundColor: color, alignSelf: 'stretch' }, style]} />;
}

// Full-bleed 2px ink rule — the hard structural divider.
export function Rule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 2, backgroundColor: colors.ink, alignSelf: 'stretch' }, style]} />;
}

// Display headline (Bricolage, oversized). The app's "Voice".
export function Display({ children, style, ...rest }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.display, fontSize: 48, lineHeight: 48, color: colors.ink, letterSpacing: -1.5 }, style]}
      {...rest}>
      {children}
    </Text>
  );
}

// Section headline (Bricolage 700).
export function Headline({ children, style, ...rest }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 }, style]}
      {...rest}>
      {children}
    </Text>
  );
}

// Body copy (Hanken).
export function Body({ children, style, muted, ...rest }: TextProps) {
  return (
    <Text
      style={[{ fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: muted ? colors.onSurfaceVariant : colors.ink }, style]}
      {...rest}>
      {children}
    </Text>
  );
}

// Mono caps label (JetBrains Mono) — timestamps, durations, technical labels.
export function Label({ children, style, muted, ...rest }: TextProps) {
  return (
    <Text
      style={[
        { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, color: muted ? colors.onSurfaceVariant : colors.ink, textTransform: 'uppercase' },
        style,
      ]}
      {...rest}>
      {children}
    </Text>
  );
}

type ButtonProps = {
  label: string;
  onPress?: Press;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The Signal Button — large pill, lime fill, ink border, brutalist offset shadow.
// One per screen. Pressing collapses the shadow (physical click feel).
export function SignalButton({ label, onPress, disabled, style }: ButtonProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ alignSelf: 'stretch' }}>
      {({ pressed }) => (
        <View
          style={[
            {
              backgroundColor: disabled ? colors.surfaceContainerHighest : colors.signal,
              borderWidth: 2,
              borderColor: colors.ink,
              borderRadius: radius.full,
              paddingVertical: 20,
              paddingHorizontal: 32,
              alignItems: 'center',
              justifyContent: 'center',
            },
            pressed
              ? { transform: [{ translateX: 4 }, { translateY: 4 }] }
              : brutalistShadow,
            style,
          ]}>
          <Label style={{ color: colors.ink, fontSize: 13 }}>{label}</Label>
        </View>
      )}
    </Pressable>
  );
}

// A bordered brutalist card surface (2px ink border + offset shadow).
export function Card({
  children,
  style,
  onPress,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: Press;
}) {
  const inner = ({ pressed }: { pressed?: boolean } = {}) => (
    <View
      style={[
        {
          backgroundColor: colors.canvas,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.lg,
          padding: 24,
        },
        pressed
          ? { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 2, height: 2 }, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0 }
          : brutalistShadow,
        style,
      ]}>
      {children}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{(state) => inner(state)}</Pressable>;
  }
  return inner();
}

// Skeleton placeholder for a VoiceNoteCard while a page loads. An ink-bordered
// card whose grey blocks pulse opacity. The pulse loops on the UI thread (one
// shared value + withRepeat) so it costs nothing on the JS thread and stays
// smooth on low-end devices.
export function SkeletonCard({ style }: { style?: StyleProp<ViewStyle> }) {
  const pulse = useSharedValue(0.4);
  useEffect(() => {
    // 0.4 → 0.9 → 0.4, forever. -1 repeats, `true` reverses each cycle.
    pulse.value = withRepeat(withTiming(0.9, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [pulse]);

  const blockStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const Block = ({ w, h, r = 6 }: { w: ViewStyle['width']; h: number; r?: number }) => (
    <Animated.View
      style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.surfaceContainerHigh }, blockStyle]}
    />
  );

  return (
    <View
      style={[
        {
          backgroundColor: colors.canvas,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.lg,
          padding: 24,
          gap: 18,
        },
        brutalistShadow,
        style,
      ]}>
      {/* Header: monogram + name/timestamp lines. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Block w={44} h={44} r={radius.md} />
        <View style={{ gap: 6 }}>
          <Block w={120} h={14} />
          <Block w={72} h={10} />
        </View>
      </View>
      {/* Waveform / player bar. */}
      <Block w="100%" h={44} r={10} />
      {/* Reaction row. */}
      <Block w="60%" h={14} />
    </View>
  );
}

// Secondary action — same brutalist pill as SignalButton but white canvas fill.
// Use for non-primary actions (log out, sort, cancel) so lime stays rationed.
export function SecondaryButton({
  label,
  onPress,
  disabled,
  active,
  style,
}: ButtonProps & { active?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={{ alignSelf: 'stretch' }}>
      {({ pressed }) => (
        <View
          style={[
            {
              backgroundColor: active ? colors.signal : colors.canvas,
              borderWidth: 2,
              borderColor: colors.ink,
              borderRadius: radius.full,
              paddingVertical: 16,
              paddingHorizontal: 24,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: disabled ? 0.5 : 1,
            },
            pressed ? { transform: [{ translateX: 4 }, { translateY: 4 }] } : brutalistShadow,
            style,
          ]}>
          <Label style={{ color: colors.ink, fontSize: 12 }}>{label}</Label>
        </View>
      )}
    </Pressable>
  );
}

// Circular ink-bordered icon button. `glyph` is any short string/emoji.
// `tone`: 'default' | 'signal' | 'danger'.
export function IconButton({
  glyph,
  onPress,
  size = 44,
  tone = 'default',
  accessibilityLabel,
  style,
}: {
  glyph: string;
  onPress?: Press;
  size?: number;
  tone?: 'default' | 'signal' | 'danger';
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const fill =
    tone === 'signal' ? colors.signal : tone === 'danger' ? colors.errorContainer : colors.canvas;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: fill,
          alignItems: 'center',
          justifyContent: 'center',
          transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
        },
        style,
      ]}>
      <Text style={{ fontSize: size * 0.42, lineHeight: size * 0.5, color: colors.ink }}>{glyph}</Text>
    </Pressable>
  );
}

// Mono caps chip. `filled` paints it lime (own/active state); otherwise bordered white.
export function Chip({
  label,
  filled,
  onPress,
  style,
}: {
  label: string;
  filled?: boolean;
  onPress?: Press;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          height: 30,
          paddingHorizontal: 12,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.full,
          backgroundColor: filled ? colors.signal : colors.canvas,
        },
        style,
      ]}>
      <Label style={{ fontSize: 11 }}>{label}</Label>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
}

// Segmented control — a single ink-bordered bar split into mono-caps options.
// The selected segment fills lime via a pill that slides between options.
//
// The slide runs entirely on the UI thread: the selected index is a shared
// value driven by withTiming, and the pill's translateX is a worklet reading
// it. Switching options never re-renders anything for the animation. One lime
// per control keeps the budget.
export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  style,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  // Measured width of the whole bar → each equal-width segment. Held in a shared
  // value so the pill worklet can read it without a React render.
  const barWidth = useSharedValue(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const animIndex = useSharedValue(index);

  // Only JS→UI hop: spring the pill to the newly selected index.
  useEffect(() => {
    animIndex.value = withTiming(index, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [index, animIndex]);

  const count = options.length;
  const pillStyle = useAnimatedStyle(() => {
    const seg = barWidth.value / count;
    return {
      width: seg,
      transform: [{ translateX: animIndex.value * seg }],
      opacity: barWidth.value > 0 ? 1 : 0,
    };
  });

  return (
    <View
      onLayout={(e) => { barWidth.value = e.nativeEvent.layout.width; }}
      style={[
        {
          flexDirection: 'row',
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.full,
          backgroundColor: colors.canvas,
          overflow: 'hidden',
        },
        style,
      ]}>
      {/* Sliding lime pill behind the labels. Sits inside the 2px border via
          top/bottom 0; its width/x come from the worklet. */}
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: colors.signal },
          pillStyle,
        ]}
      />
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={{
              flex: 1,
              paddingVertical: 11,
              alignItems: 'center',
              justifyContent: 'center',
              borderLeftWidth: i === 0 ? 0 : 2,
              borderLeftColor: colors.ink,
            }}>
            <Label style={{ fontSize: 11, color: selected ? colors.ink : colors.onSurfaceVariant }}>
              {opt.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

// Enclosed text input — 2px ink border, mono text, bold-caps placeholder. The
// border thickens + gains the brutalist offset shadow on focus (inputs were
// otherwise flat/bland). Pass `secureTextEntry` and it grows a show/hide eye
// toggle on the right; the toggle overrides secureTextEntry internally so the
// caller doesn't manage reveal state. All other TextInput props pass through.
export function TextField({
  secureTextEntry,
  style,
  onFocus,
  onBlur,
  ...rest
}: ComponentProps<typeof TextInput>) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecure = !!secureTextEntry;

  return (
    <View
      collapsable={false}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.md,
          backgroundColor: colors.canvas,
          paddingHorizontal: 20,
        },
        // Only the iOS offset-shadow toggles on focus. Android `elevation` is
        // held constant — toggling it recreates the native view, which drops
        // TextInput focus and flickers the keyboard shut on focus.
        focused ? iosFocusShadow : null,
      ]}>
      <TextInput
        placeholderTextColor={colors.onSurfaceVariant}
        secureTextEntry={isSecure && !revealed}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          {
            flex: 1,
            paddingVertical: 18,
            fontFamily: fonts.mono,
            fontSize: 14,
            letterSpacing: 1,
            color: colors.ink,
          },
          style,
        ]}
        {...rest}
      />
      {isSecure && (
        <Pressable
          onPress={() => setRevealed((r) => !r)}
          hitSlop={10}
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          style={{ paddingLeft: 12 }}>
          <Ionicons name={revealed ? 'eye-off' : 'eye'} size={20} color={colors.onSurfaceVariant} />
        </Pressable>
      )}
    </View>
  );
}

// Square monogram avatar — first letter of a name in oversized Bricolage on an
// ink-bordered tile. `filled` paints it lime (the viewer's own identity).
export function Monogram({
  name,
  size = 44,
  filled,
  style,
}: {
  name?: string;
  size?: number;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const letter = (name?.trim()?.[0] ?? '?').toUpperCase();
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.md,
          backgroundColor: filled ? colors.signal : colors.surfaceContainer,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: size * 0.5,
          lineHeight: size * 0.58,
          color: colors.ink,
        }}>
        {letter}
      </Text>
    </View>
  );
}

// Themed confirmation dialog — our own brutalist replacement for the native
// Alert. A dimmed backdrop over an ink-bordered card with offset shadow, a
// headline + body, and two actions. `tone` colors the confirm button:
// 'danger' (destructive, error-red) or 'signal' (lime). Tapping the backdrop
// cancels. Render it unconditionally and drive with `visible`.
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'CONFIRM',
  cancelLabel = 'CANCEL',
  tone = 'danger',
  busy,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'signal';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmFill = tone === 'danger' ? colors.errorContainer : colors.signal;

  // Entrance animation: fade the backdrop and spring the card up from a slightly
  // smaller, lower resting position. `progress` (0→1) drives the backdrop; the
  // card runs its own spring so it overshoots with a little bounce.
  const progress = useSharedValue(0);
  const cardScale = useSharedValue(0.9);
  const cardShift = useSharedValue(16);
  useEffect(() => {
    if (visible) {
      progress.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.quad) });
      cardScale.value = withSpring(1, { damping: 14, stiffness: 220, mass: 0.7 });
      cardShift.value = withSpring(0, { damping: 15, stiffness: 220, mass: 0.7 });
    } else {
      // Snap back so the next open animates from the start (Modal unmounts content).
      progress.value = 0;
      cardScale.value = 0.9;
      cardShift.value = 16;
    }
  }, [visible, progress, cardScale, cardShift]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }, { translateY: cardShift.value }],
  }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel} statusBarTranslucent>
      {/* Backdrop — tap to dismiss. Opacity animated via reanimated. */}
      <Animated.View style={[{ flex: 1 }, backdropStyle]}>
        <Pressable
          onPress={busy ? undefined : onCancel}
          style={{ flex: 1, backgroundColor: 'rgba(26,28,28,0.55)', justifyContent: 'center', padding: space.containerPadding }}>
          {/* Stop propagation so taps inside the card don't dismiss. */}
          <Pressable onPress={() => {}} style={{ alignSelf: 'stretch' }}>
            <Animated.View
              style={[
                {
                  backgroundColor: colors.canvas,
                  borderWidth: 2,
                  borderColor: colors.ink,
                  borderRadius: radius.lg,
                  padding: 24,
                  gap: 20,
                },
                brutalistShadow,
                cardStyle,
              ]}>
            <View style={{ gap: 10 }}>
              <Headline style={{ fontSize: 26, lineHeight: 30 }}>{title}</Headline>
              {message ? <Body muted style={{ fontSize: 16 }}>{message}</Body> : null}
            </View>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={busy ? undefined : onCancel} disabled={busy} style={{ flex: 1 }}>
                {({ pressed }) => (
                  <View
                    style={[
                      {
                        backgroundColor: colors.canvas,
                        borderWidth: 2,
                        borderColor: colors.ink,
                        borderRadius: radius.full,
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }] } : brutalistShadow,
                    ]}>
                    <Label style={{ fontSize: 12 }}>{cancelLabel}</Label>
                  </View>
                )}
              </Pressable>

              <Pressable onPress={busy ? undefined : onConfirm} disabled={busy} style={{ flex: 1 }}>
                {({ pressed }) => (
                  <View
                    style={[
                      {
                        backgroundColor: busy ? colors.surfaceContainerHighest : confirmFill,
                        borderWidth: 2,
                        borderColor: colors.ink,
                        borderRadius: radius.full,
                        paddingVertical: 16,
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      pressed ? { transform: [{ translateX: 3 }, { translateY: 3 }] } : brutalistShadow,
                    ]}>
                    <Label style={{ fontSize: 12, color: tone === 'danger' ? colors.onErrorContainer : colors.ink }}>
                      {busy ? '…' : confirmLabel}
                    </Label>
                  </View>
                )}
              </Pressable>
            </View>
            </Animated.View>
          </Pressable>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// A bordered metric tile: oversized number + mono caps label. `accent` fills
// lime. When `onPress` is given the whole tile is tappable (press-collapse feel).
export function StatCard({
  value,
  label,
  accent,
  onPress,
  style,
}: {
  value: ReactNode;
  label: string;
  accent?: boolean;
  onPress?: Press;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = ({ pressed }: { pressed?: boolean } = {}) => (
    <View
      style={[
        {
          flex: 1,
          borderWidth: 2,
          borderColor: colors.ink,
          borderRadius: radius.lg,
          backgroundColor: accent ? colors.signal : colors.canvas,
          padding: 20,
          gap: 6,
        },
        pressed
          ? { transform: [{ translateX: 2 }, { translateY: 2 }], shadowOffset: { width: 2, height: 2 }, shadowColor: colors.ink, shadowOpacity: 1, shadowRadius: 0 }
          : brutalistShadow,
        style,
      ]}>
      <Display style={{ fontSize: 44, lineHeight: 44 }}>{value}</Display>
      <Label muted={!accent}>{label}</Label>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress} style={{ flex: 1 }}>{(state) => inner(state)}</Pressable>;
  }
  return inner();
}
