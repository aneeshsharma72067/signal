import { Pressable, View } from 'react-native';

import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { colors, radius } from '../theme';
import WaveformVisualizer from './WaveformVisualizer';

// Inline audio player: a circular ink-bordered play/pause control beside a
// progress waveform. Used in the feed and note lists.
export default function AudioPlayer({ uri, onStart, onFinish, bars = 28, height = 64 }) {
  const { toggle, playing, progress } = useAudioPlayer(uri, { onStart, onFinish });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Pressable
        onPress={toggle}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: playing ? colors.signal : colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
        })}>
        <PlayPauseGlyph playing={playing} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <WaveformVisualizer bars={bars} height={height} progress={progress} />
      </View>
    </View>
  );
}

// Simple geometric glyphs (no icon font dependency): triangle = play, two bars = pause.
function PlayPauseGlyph({ playing }) {
  if (playing) {
    return (
      <View style={{ flexDirection: 'row', gap: 4 }}>
        <View style={{ width: 5, height: 18, backgroundColor: colors.ink }} />
        <View style={{ width: 5, height: 18, backgroundColor: colors.ink }} />
      </View>
    );
  }
  return (
    <View
      style={{
        marginLeft: 4,
        width: 0,
        height: 0,
        borderTopWidth: 9,
        borderBottomWidth: 9,
        borderLeftWidth: 15,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: colors.ink,
      }}
    />
  );
}
