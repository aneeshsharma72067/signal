import { useAudioPlayer as useExpoPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';

// Thin wrapper over expo-audio playback exposing progress (0..1) and a
// play/replay toggle. Fires onFinish once per playthrough. `initialPosition`
// (seconds) seeks the source once loaded so a resumed note continues where it
// was paused instead of restarting.
interface AudioPlayerCallbacks {
  onFinish?: () => void;
  onStart?: () => void;
  initialPosition?: number;
}

// Treat playback within this many seconds of the end as "finished" — covers the
// gap between the last status tick and the true end so replay/save behave.
const END_EPSILON = 0.25;

export function useAudioPlayer(
  source: string | null,
  { onFinish, onStart, initialPosition = 0 }: AudioPlayerCallbacks = {}
) {
  const player = useExpoPlayer(source ?? null, { updateInterval: 100 });
  const status = useAudioPlayerStatus(player);
  const finishedRef = useRef(false);
  const startedRef = useRef(false);
  const seededRef = useRef(false);

  // Seek to the remembered offset once, as soon as the source is loaded.
  useEffect(() => {
    if (!seededRef.current && status.isLoaded && initialPosition > 0) {
      seededRef.current = true;
      player.seekTo(initialPosition);
    }
  }, [player, status.isLoaded, initialPosition]);

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

  const atEnd = status.duration > 0 && status.currentTime >= status.duration - END_EPSILON;

  const play = useCallback(() => {
    // Replay from the top if we're sitting at the end of a finished playthrough.
    if (status.didJustFinish || atEnd) {
      finishedRef.current = false;
      startedRef.current = false;
      player.seekTo(0);
    }
    player.play();
  }, [player, status.didJustFinish, atEnd]);

  const pause = useCallback(() => player.pause(), [player]);

  const toggle = useCallback(() => {
    if (status.playing) {
      pause();
      return;
    }
    play();
  }, [status.playing, play, pause]);

  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return {
    toggle,
    play,
    pause,
    playing: status.playing,
    isLoaded: status.isLoaded,
    // True while the player is fetching/decoding and can't play yet — used to
    // show a spinner in place of the play glyph.
    buffering: status.isBuffering || !status.isLoaded,
    // True once playback has reached the end (waveform stays fully filled until
    // the user replays). Also tells the parent NOT to persist the end offset.
    finished: atEnd,
    progress,
    currentTime: status.currentTime,
    duration: status.duration,
  };
}
