import { Pressable, Text, View } from 'react-native';

import { brutalistShadow, colors, radius, REACTION_EMOJIS } from '../theme';
import AudioPlayer from './AudioPlayer';
import { Body, Card, Label } from './ui';

// Format an ISO timestamp into a short "Xm ago" string.
export function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'JUST NOW';
  if (min < 60) return `${min}M AGO`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}H AGO`;
  const d = Math.floor(hr / 24);
  return `${d}D AGO`;
}

// Collapse a reactions array into "🔥×3 💙×1" summary parts.
export function summarizeReactions(reactions = []) {
  const counts = {};
  for (const r of reactions) counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
  return Object.entries(counts).map(([emoji, count]) => `${emoji}×${count}`);
}

// A voice note card: speaker label + time, playable waveform, and either an
// interactive reaction strip (feed) or a static reaction summary (lists).
//
// Props:
//   title, createdAt, durationSec, audioUrl, onStart, onFinish — base card.
//   reactions          — static summary mode: array of { emoji }.
//   reactionCounts/total/myReaction/onReact — interactive mode (feed).
//   onDelete           — when set, renders a delete control (My Notes).
//   reactionDisabled   — locks the interactive strip while a request is inflight.
export default function VoiceNoteCard({
  title,
  createdAt,
  durationSec,
  audioUrl,
  reactions,
  reactionCounts,
  total,
  myReaction,
  onReact,
  reactionDisabled,
  onDelete,
  onStart,
  onFinish,
}) {
  const interactive = typeof onReact === 'function';
  const summary = reactions ? summarizeReactions(reactions) : null;

  return (
    <Card style={{ gap: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <Label numberOfLines={1} style={{ flex: 1 }}>{title}</Label>
        <Label muted>{timeAgo(createdAt)}</Label>
        {onDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityLabel="Delete note"
            style={({ pressed }) => ({
              width: 28,
              height: 28,
              borderRadius: radius.full,
              borderWidth: 2,
              borderColor: colors.ink,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.errorContainer : colors.canvas,
            })}>
            <Text style={{ fontSize: 16, lineHeight: 18, color: colors.ink }}>×</Text>
          </Pressable>
        )}
      </View>

      <AudioPlayer uri={audioUrl} onStart={onStart} onFinish={onFinish} />

      {interactive ? (
        <View style={{ gap: 12 }}>
          <ReactionBar
            counts={reactionCounts ?? {}}
            total={total ?? 0}
            myReaction={myReaction}
            onReact={onReact}
            disabled={reactionDisabled}
          />
          <Label muted>
            {typeof durationSec === 'number' ? formatDuration(durationSec) : ''}
            {total > 0 ? `  ·  ${total} REACTION${total === 1 ? '' : 'S'}` : ''}
          </Label>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label muted>{typeof durationSec === 'number' ? formatDuration(durationSec) : ''}</Label>
          {summary && summary.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {summary.map((s) => (
                <Body key={s} style={{ fontSize: 15 }}>{s}</Body>
              ))}
            </View>
          )}
        </View>
      )}
    </Card>
  );
}

// Inline reaction row: each emoji is a tappable pill showing its count. The
// viewer's own reaction is highlighted lime. Tapping toggles/switches.
function ReactionBar({ counts, myReaction, onReact, disabled }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {REACTION_EMOJIS.map((emoji) => {
        const count = counts[emoji] ?? 0;
        const mine = myReaction === emoji;
        return (
          <Pressable
            key={emoji}
            onPress={() => onReact(emoji)}
            disabled={disabled}
            accessibilityLabel={`React ${emoji}`}
            style={({ pressed }) => [
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingHorizontal: 10,
                height: 36,
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: radius.full,
                backgroundColor: mine ? colors.signal : colors.canvas,
                opacity: disabled ? 0.6 : 1,
              },
              pressed && !disabled ? { transform: [{ translateX: 1 }, { translateY: 1 }] } : mine ? brutalistShadow : null,
            ]}>
            <Text style={{ fontSize: 18 }}>{emoji}</Text>
            {count > 0 && (
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.ink }}>{count}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function formatDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `0:${s < 10 ? '0' : ''}${s}`;
}
