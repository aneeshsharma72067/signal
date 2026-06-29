import { Pressable, Text, View } from 'react-native';

import { brutalistShadow, colors, fonts, radius } from '../theme';

// Display headline (Bricolage, oversized). The app's "Voice".
export function Display({ children, style, ...rest }) {
  return (
    <Text
      style={[{ fontFamily: fonts.display, fontSize: 48, lineHeight: 48, color: colors.ink, letterSpacing: -1.5 }, style]}
      {...rest}>
      {children}
    </Text>
  );
}

// Section headline (Bricolage 700).
export function Headline({ children, style, ...rest }) {
  return (
    <Text
      style={[{ fontFamily: fonts.displayBold, fontSize: 32, lineHeight: 36, color: colors.ink, letterSpacing: -0.6 }, style]}
      {...rest}>
      {children}
    </Text>
  );
}

// Body copy (Hanken).
export function Body({ children, style, muted, ...rest }) {
  return (
    <Text
      style={[{ fontFamily: fonts.body, fontSize: 16, lineHeight: 24, color: muted ? colors.onSurfaceVariant : colors.ink }, style]}
      {...rest}>
      {children}
    </Text>
  );
}

// Mono caps label (JetBrains Mono) — timestamps, durations, technical labels.
export function Label({ children, style, muted, ...rest }) {
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

// The Signal Button — large pill, lime fill, ink border, brutalist offset shadow.
// One per screen. Pressing collapses the shadow (physical click feel).
export function SignalButton({ label, onPress, disabled, style }) {
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
export function Card({ children, style, onPress }) {
  const inner = ({ pressed } = {}) => (
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
