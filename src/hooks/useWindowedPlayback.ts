import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

// Coordinates single-active-player windowing across a list of audio cards.
// Only one note is mounted/active at a time (memory-safe), but paused positions
// are remembered — resuming a note (even after switching to another) continues
// where it left off instead of restarting. Everything resets when the screen
// loses focus, so returning to a screen starts fresh from the top.
export function useWindowedPlayback() {
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const positions = useRef<Map<string, number>>(new Map());

  // Make a note the single active/mounted player.
  const activate = useCallback((id: string) => setPlayingNoteId(id), []);

  // Stash a note's playback offset (seconds) as its player unmounts.
  const savePosition = useCallback((id: string, seconds: number) => {
    positions.current.set(id, seconds);
  }, []);

  const getInitialPosition = useCallback((id: string) => positions.current.get(id) ?? 0, []);

  // A note played to the end: forget its offset (so it replays from 0) and
  // deactivate it if it's still the active one.
  const handleFinish = useCallback((id: string) => {
    positions.current.delete(id);
    setPlayingNoteId((prev) => (prev === id ? null : prev));
  }, []);

  // Reset on screen blur: stop playback and forget every remembered offset.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setPlayingNoteId(null);
        positions.current.clear();
      };
    }, [])
  );

  return { playingNoteId, activate, savePosition, getInitialPosition, handleFinish };
}
