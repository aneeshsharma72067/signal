import {
  useAudioRecorder as useExpoRecorder,
  useAudioRecorderState,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from 'expo-audio';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_SEC = 30;

// Wraps expo-audio recording with a graceful permission flow, a hard 30s cap,
// and a rolling amplitude buffer for the live waveform.
export function useAudioRecorder() {
  const recorder = useExpoRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 100); // poll every 100ms

  const [permission, setPermission] = useState(null); // null | 'granted' | 'denied'
  const [levels, setLevels] = useState([]); // rolling 0..1 amplitudes
  const [error, setError] = useState(null);
  const levelsRef = useRef([]);

  // Configure audio mode once.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true }).catch((e) =>
      setError(e.message)
    );
  }, []);

  // Build the rolling waveform from metering while recording.
  useEffect(() => {
    if (!state.isRecording) return;
    // metering is in dBFS (negative). Map to 0..1.
    const db = typeof state.metering === 'number' ? state.metering : -60;
    const norm = Math.max(0, Math.min(1, (db + 60) / 60));
    const next = [...levelsRef.current, norm].slice(-40);
    levelsRef.current = next;
    setLevels(next);
  }, [state.metering, state.isRecording]);

  // Returns true if recording may proceed.
  const ensurePermission = useCallback(async () => {
    const current = await AudioModule.getRecordingPermissionsAsync();
    if (current.granted) {
      setPermission('granted');
      return true;
    }
    const req = await AudioModule.requestRecordingPermissionsAsync();
    setPermission(req.granted ? 'granted' : 'denied');
    return req.granted;
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const ok = await ensurePermission();
      if (!ok) {
        setError('Microphone permission denied. Enable it in Settings to record.');
        return false;
      }
      levelsRef.current = [];
      setLevels([]);
      await recorder.prepareToRecordAsync({ isMeteringEnabled: true });
      // Hard 30s cap — expo-audio auto-stops at forDuration.
      recorder.record({ forDuration: MAX_DURATION_SEC });
      return true;
    } catch (e) {
      setError(e.message ?? 'Failed to start recording.');
      return false;
    }
  }, [ensurePermission, recorder]);

  const stop = useCallback(async () => {
    try {
      await recorder.stop();
      return recorder.uri; // local file uri
    } catch (e) {
      setError(e.message ?? 'Failed to stop recording.');
      return null;
    }
  }, [recorder]);

  const durationSec = Math.min(MAX_DURATION_SEC, Math.floor((state.durationMillis ?? 0) / 1000));

  return {
    start,
    stop,
    isRecording: state.isRecording,
    durationSec,
    remainingSec: MAX_DURATION_SEC - durationSec,
    levels,
    permission,
    error,
    uri: recorder.uri,
    MAX_DURATION_SEC,
  };
}
