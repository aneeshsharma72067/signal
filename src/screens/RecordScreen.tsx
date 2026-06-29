import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AudioPlayer from "../components/AudioPlayer";
import WaveformVisualizer from "../components/WaveformVisualizer";
import { Body, Display, Label, SignalButton } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { uploadAndPost } from "../lib/notes";
import { colors, radius, space } from "../theme";

// Hero record screen. States: idle → (permission) → recording → preview → posting.
export default function RecordScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const rec = useAudioRecorder();
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [askPermission, setAskPermission] = useState(false);

  function fmt(sec: number) {
    const s = Math.max(0, sec);
    return `00:${s < 10 ? "0" : ""}${s}`;
  }

  async function beginRecording() {
    setAskPermission(false);
    await rec.start();
  }

  async function stopRecording() {
    const uri = await rec.stop();
    setRecordedDuration(rec.durationSec);
    if (uri) setRecordedUri(uri);
  }

  async function post() {
    setPostError(null);
    setPosting(true);
    try {
      await uploadAndPost({
        userId: user!.id,
        uri: recordedUri,
        durationSec: recordedDuration || 1,
      });
      // Posted — return to the feed (dismiss this modal).
      router.replace("/feed");
    } catch (e: unknown) {
      console.log(e);

      setPostError(e instanceof Error ? e.message : 'Failed to post your note.');
    } finally {
      setPosting(false);
    }
  }

  const isRecording = rec.isRecording;
  const hasPreview = !!recordedUri && !isRecording;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Top bar: close + recording indicator */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 24,
          height: 64,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            borderWidth: 2,
            borderColor: colors.ink,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.canvas,
          }}
        >
          <Label style={{ fontSize: 16 }}>✕</Label>
        </Pressable>
        {isRecording ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                backgroundColor: colors.error,
              }}
            />
            <Label style={{ color: colors.error }}>RECORDING…</Label>
          </View>
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <View
        style={{
          flex: 1,
          paddingHorizontal: space.containerPadding,
          alignItems: "center",
          justifyContent: "center",
          gap: space.sectionMargin,
        }}
      >
        {/* Timer */}
        <Display
          style={{
            fontSize: 80,
            lineHeight: 80,
            fontVariant: ["tabular-nums"],
            color: rec.remainingSec <= 0 ? colors.error : colors.ink,
          }}
        >
          {fmt(
            isRecording ? rec.remainingSec : hasPreview ? recordedDuration : 30,
          )}
        </Display>

        {/* Waveform */}
        <View style={{ width: "100%", height: 120, justifyContent: "center" }}>
          {isRecording ? (
            <WaveformVisualizer
              bars={40}
              height={120}
              levels={rec.levels}
              active
            />
          ) : hasPreview ? (
            <AudioPlayer uri={recordedUri} height={100} bars={36} />
          ) : (
            <WaveformVisualizer bars={40} height={120} />
          )}
        </View>

        {rec.error && (
          <Body style={{ color: colors.error, textAlign: "center" }}>
            {rec.error}
          </Body>
        )}
        {postError && (
          <Body style={{ color: colors.error, textAlign: "center" }}>
            {postError}
          </Body>
        )}
      </View>

      {/* Bottom controls */}
      <View
        style={{
          paddingHorizontal: space.containerPadding,
          paddingBottom: 32,
          gap: space.elementGap,
          alignItems: "center",
        }}
      >
        {askPermission && !isRecording && !hasPreview && (
          <Body muted style={{ textAlign: "center" }}>
            Signal needs your microphone to record. We only capture audio while
            you hold the button.
          </Body>
        )}

        {hasPreview ? (
          <View style={{ alignSelf: "stretch", gap: 16 }}>
            <SignalButton
              label={posting ? "POSTING…" : "POST SIGNAL"}
              onPress={post}
              disabled={posting}
            />
            <Pressable
              onPress={() => {
                setRecordedUri(null);
                setRecordedDuration(0);
                setPostError(null);
              }}
              disabled={posting}
              style={{ alignItems: "center", paddingVertical: 8 }}
            >
              <Label muted>RE-RECORD</Label>
            </Pressable>
          </View>
        ) : (
          <RecordButton
            recording={isRecording}
            onPress={
              isRecording
                ? stopRecording
                : rec.permission === "denied"
                  ? () => setAskPermission(true)
                  : beginRecording
            }
          />
        )}
        {!hasPreview && (
          <Label muted>{isRecording ? "TAP TO STOP" : "TAP TO RECORD"}</Label>
        )}
      </View>
    </SafeAreaView>
  );
}

// Big circular lime button. Square ink glyph when recording (stop), ring when idle.
function RecordButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 128,
        height: 128,
        borderRadius: radius.full,
        borderWidth: 2,
        borderColor: colors.ink,
        backgroundColor: colors.signal,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: colors.ink,
        shadowOffset: pressed
          ? { width: 1, height: 1 }
          : { width: 4, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 0,
        elevation: 8,
        transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
      })}
    >
      {recording ? (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 4,
            backgroundColor: colors.ink,
          }}
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: radius.full,
            borderWidth: 3,
            borderColor: colors.ink,
          }}
        />
      )}
    </Pressable>
  );
}
