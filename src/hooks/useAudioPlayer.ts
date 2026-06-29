import { useAudioPlayer as useExpoPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

// Thin wrapper over expo-audio playback exposing progress (0..1) and a
// play/replay toggle. Fires onFinish once per playthrough.
interface AudioPlayerCallbacks {
  onFinish?: () => void;
  onStart?: () => void;
}

export function useAudioPlayer(source: string | null, { onFinish, onStart }: AudioPlayerCallbacks = {}) {
  const player = useExpoPlayer(source ?? null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (status.playing && !startedRef.current) {
      startedRef.current = true;
      onStart?.();
    }
    if (status.didJustFinish && !finishedRef.current) {
      finishedRef.current = true;
      onFinish?.();
    }
  }, [status.playing, status.didJustFinish, onFinish, onStart]);

  const toggle = useCallback(() => {
    if (status.playing) {
      player.pause();
      return;
    }
    // Restart from the top if we're at the end.
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.05)) {
      finishedRef.current = false;
      startedRef.current = false;
      player.seekTo(0);
    }
    player.play();
  }, [player, status.playing, status.didJustFinish, status.currentTime, status.duration]);

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return {
    toggle,
    play: () => player.play(),
    pause: () => player.pause(),
    playing: status.playing,
    isLoaded: status.isLoaded,
    progress,
    currentTime: status.currentTime,
    duration: status.duration,
  };
}
