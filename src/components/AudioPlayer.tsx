import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { colors, radius } from '../theme';
import WaveformVisualizer from './WaveformVisualizer';

interface AudioPlayerProps {
  uri: string | null;
  onStart?: () => void;
  onFinish?: () => void;
  bars?: number;
  height?: number;
  active?: boolean;
  onActivate?: () => void;
  initialPosition?: number;
  onSavePosition?: (seconds: number) => void;
}

// Inline audio player. To optimize resource usage and prevent memory leaks,
// it uses a windowed/recycled player strategy. If `active` is false, it renders
// InactiveAudioPlayer (a purely static UI requiring 0 native audio resources).
// Tapping play sets this note as the single active player in the parent list,
// mounting ActiveAudioPlayer (which instantiates the native player and auto-plays).
// Pausing keeps the player mounted+active so its position is preserved; when the
// active note changes, the outgoing player reports its offset via onSavePosition
// so it can resume from there next time.
export default function AudioPlayer({
  uri,
  onStart,
  onFinish,
  bars = 28,
  height = 64,
  active = false,
  onActivate,
  initialPosition = 0,
  onSavePosition,
}: AudioPlayerProps) {
  if (!onActivate) {
    // Fallback if not controlled by parent list (legacy/single player mode).
    return (
      <ActiveAudioPlayer
        uri={uri}
        onStart={onStart}
        onFinish={onFinish}
        bars={bars}
        height={height}
        autoPlay={false}
      />
    );
  }

  if (active) {
    return (
      <ActiveAudioPlayer
        uri={uri}
        onStart={onStart}
        onFinish={onFinish}
        bars={bars}
        height={height}
        autoPlay={true}
        initialPosition={initialPosition}
        onSavePosition={onSavePosition}
      />
    );
  }

  return (
    <InactiveAudioPlayer
      bars={bars}
      height={height}
      onPlay={onActivate}
    />
  );
}

// Player with active native audio player handles.
function ActiveAudioPlayer({
  uri,
  onStart,
  onFinish,
  bars,
  height,
  autoPlay,
  initialPosition = 0,
  onSavePosition,
}: {
  uri: string | null;
  onStart?: () => void;
  onFinish?: () => void;
  bars: number;
  height: number;
  autoPlay: boolean;
  initialPosition?: number;
  onSavePosition?: (seconds: number) => void;
}) {
  const { toggle, playing, progress, buffering, currentTime, play } = useAudioPlayer(uri, {
    onStart,
    onFinish,
    initialPosition,
  });

  // Auto-play on mount when active.
  useEffect(() => {
    if (autoPlay) {
      play();
    }
  }, [autoPlay, play]);

  // On unmount (the active note changed), report where we stopped so the parent
  // can resume this note from the same offset later.
  const timeRef = useRef(currentTime);
  timeRef.current = currentTime;
  useEffect(() => {
    return () => onSavePosition?.(timeRef.current);
  }, [onSavePosition]);

  // Spinner while the source is still loading/buffering and can't play yet.
  const showSpinner = buffering && !playing;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Pressable
        onPress={toggle}
        disabled={showSpinner}
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
        {showSpinner ? <ActivityIndicator color={colors.ink} /> : <PlayPauseGlyph playing={playing} />}
      </Pressable>
      <View style={{ flex: 1 }}>
        <WaveformVisualizer bars={bars} height={height} progress={progress} />
      </View>
    </View>
  );
}

// Pure static component requiring 0 native audio players.
function InactiveAudioPlayer({
  bars,
  height,
  onPlay,
}: {
  bars: number;
  height: number;
  onPlay: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
      <Pressable
        onPress={onPlay}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: radius.full,
          borderWidth: 2,
          borderColor: colors.ink,
          backgroundColor: colors.canvas,
          alignItems: 'center',
          justifyContent: 'center',
          transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
        })}>
        <PlayPauseGlyph playing={false} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <WaveformVisualizer bars={bars} height={height} progress={0} />
      </View>
    </View>
  );
}

// Simple geometric glyphs (no icon font dependency): triangle = play, two bars = pause.
function PlayPauseGlyph({ playing }: { playing: boolean }) {
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
