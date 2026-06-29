import { Pressable, Text, View } from 'react-native';

import { brutalistShadow, colors, radius, REACTION_EMOJIS } from '../theme';
import type { ReactionEmoji } from '../types';

// Horizontal strip of the 6 allowed reaction emojis. Tap one to react.
// `disabled` locks the strip after a reaction is sent.
export default function EmojiReactionStrip({
  onReact,
  disabled,
  selected,
}: {
  onReact?: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
  selected?: ReactionEmoji | null;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
      {REACTION_EMOJIS.map((emoji) => {
        const isSelected = selected === emoji;
        return (
          <Pressable
            key={emoji}
            onPress={() => onReact?.(emoji)}
            disabled={disabled}
            style={({ pressed }) => [
              {
                flex: 1,
                aspectRatio: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: radius.full,
                backgroundColor: isSelected ? colors.signal : colors.canvas,
                opacity: disabled && !isSelected ? 0.4 : 1,
              },
              pressed && !disabled
                ? { transform: [{ translateX: 2 }, { translateY: 2 }] }
                : isSelected
                  ? brutalistShadow
                  : null,
            ]}>
            <Text style={{ fontSize: 24 }}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
