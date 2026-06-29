import { useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius } from '../theme';

// Static / animated bar waveform. Ink bars; bars left of `progress` turn lime.
// `levels` (0..1 array) drives heights when provided (live recording); otherwise
// a deterministic sine+noise shape is generated, matching the Stitch mock.
export default function WaveformVisualizer({
  bars = 32,
  height = 64,
  progress = 0, // 0..1 playback progress
  levels = null, // optional live amplitude array (0..1)
  active = false, // recording state — slightly taller bars
  style,
}: {
  bars?: number;
  height?: number;
  progress?: number;
  levels?: number[] | null;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const heights = useMemo(() => {
    if (levels && levels.length) return levels;
    return Array.from({ length: bars }, (_, i) => {
      const n = i / bars;
      const base = Math.sin(n * Math.PI) * 0.7 + 0.2;
      // Deterministic pseudo-noise so the shape is stable across renders.
      const noise = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      return Math.min(1, Math.max(0.12, base + Math.abs(noise) * 0.4));
    });
  }, [bars, levels]);

  const progressIndex = Math.floor(heights.length * progress);

  return (
    <View style={[{ height, flexDirection: 'row', alignItems: 'center', gap: 3 }, style]}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: Math.max(4, h * height * (active ? 1 : 0.92)),
            borderRadius: radius.full,
            backgroundColor: i < progressIndex ? colors.signal : colors.ink,
          }}
        />
      ))}
    </View>
  );
}
