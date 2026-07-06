import { Pressable, Text, View } from 'react-native';

import { brutalistShadow, colors, radius, REACTION_EMOJIS } from '../theme';
import type { ReactionCounts, ReactionEmoji } from '../types';
import AudioPlayer from './AudioPlayer';
import { Card, IconButton, Label, Monogram } from './ui';

// Format an ISO timestamp into a short "Xm ago" string.
export function timeAgo(iso: string | null | undefined): string {
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

// Top-N emoji by count from a reaction-counts aggregate, for the static
// summary chips (lists).
function topReactions(counts: ReactionCounts = {}, n = 3): { emoji: ReactionEmoji; count: number }[] {
  return Object.entries(counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, n)
    .map(([emoji, count]) => ({ emoji: emoji as ReactionEmoji, count: count ?? 0 }));
}

// A voice note card: monogram + speaker label + time, playable waveform, and
// either an interactive reaction bar (feed) or a static reaction summary (lists).
//
// Props:
//   title, createdAt, durationSec, audioUrl, onStart, onFinish — base card.
//   reactionCounts/total/myReaction/onReact — interactive mode (feed).
//   reactionCounts/staticTotal — static summary mode (profile / my-notes lists);
//     pass counts WITHOUT onReact to render read-only chips.
//   onDelete           — when set, renders a delete control (My Notes).
//   reactionDisabled   — locks the interactive strip while a request is inflight.
//   own                — paints the monogram lime (the viewer's own broadcast).

interface VoiceNoteCardProps {
  title: string;
  createdAt: string;
  durationSec?: number | null;
  audioUrl: string | null;
  reactionCounts?: ReactionCounts;
  total?: number;
  staticTotal?: number;
  myReaction?: ReactionEmoji | null;
  onReact?: (emoji: ReactionEmoji) => void;
  reactionDisabled?: boolean;
  onDelete?: () => void;
  onStart?: () => void;
  onFinish?: () => void;
  own?: boolean;
  onPressAuthor?: () => void;
  active?: boolean;
  onActivate?: () => void;
  initialPosition?: number;
  onSavePosition?: (seconds: number) => void;
  // Voice replies (migration 0016): count shown below card; tapping opens thread.
  replyCount?: number;
  onPressReplies?: () => void;
}

export default function VoiceNoteCard({
  title,
  createdAt,
  durationSec,
  audioUrl,
  reactionCounts,
  total,
  staticTotal,
  myReaction,
  onReact,
  reactionDisabled,
  onDelete,
  onStart,
  onFinish,
  own,
  onPressAuthor,
  active,
  onActivate,
  initialPosition,
  onSavePosition,
  replyCount,
  onPressReplies,
}: VoiceNoteCardProps) {
  const interactive = typeof onReact === 'function';
  const top = !interactive && reactionCounts ? topReactions(reactionCounts) : null;
  const reactionTotal = staticTotal ?? null;

  // Monogram + speaker name. Tappable when onPressAuthor is set (→ profile).
  const author = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
      <Monogram name={title} size={40} filled={own} />
      <View style={{ flex: 1, gap: 3 }}>
        <Label numberOfLines={1} style={{ fontSize: 13 }}>{title}</Label>
        <Label muted style={{ fontSize: 11 }}>
          {timeAgo(createdAt)}
          {typeof durationSec === 'number' ? `  ·  ${formatDuration(durationSec)}` : ''}
        </Label>
      </View>
    </View>
  );

  return (
    <Card style={{ gap: 18, padding: 20 }}>
      {/* Header: monogram, speaker + timestamp, optional delete. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {onPressAuthor ? (
          <Pressable onPress={onPressAuthor} style={{ flex: 1 }}>{author}</Pressable>
        ) : (
          author
        )}
        {onDelete && (
          <IconButton glyph="×" tone="danger" size={32} onPress={onDelete} accessibilityLabel="Delete note" />
        )}
      </View>

      <AudioPlayer
        uri={audioUrl}
        onStart={onStart}
        onFinish={onFinish}
        active={active}
        onActivate={onActivate}
        initialPosition={initialPosition}
        onSavePosition={onSavePosition}
      />

      {interactive ? (
        <View style={{ gap: 14 }}>
          <Rule />
          <ReactionBar
            counts={reactionCounts ?? {}}
            myReaction={myReaction}
            onReact={onReact}
            disabled={reactionDisabled}
          />
          {(total ?? 0) > 0 && (
            <Label muted style={{ fontSize: 11 }}>
              {total} REACTION{total === 1 ? '' : 'S'}
            </Label>
          )}
        </View>
      ) : (
        top &&
        top.length > 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {top.map(({ emoji, count }) => (
              <View
                key={emoji}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  height: 30,
                  paddingHorizontal: 10,
                  borderWidth: 2,
                  borderColor: colors.ink,
                  borderRadius: radius.full,
                  backgroundColor: colors.canvas,
                }}>
                <Text style={{ fontSize: 15 }}>{emoji}</Text>
                <Text style={{ fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 12, color: colors.ink }}>
                  {count}
                </Text>
              </View>
            ))}
            {(reactionTotal ?? 0) > 0 && (
              <Label muted style={{ fontSize: 11, marginLeft: 'auto' }}>
                {reactionTotal} TOTAL
              </Label>
            )}
          </View>
        )
      )}

      {/* Replies label — shown whenever onPressReplies is provided. Tapping
          navigates to the thread (ThreadScreen). */}
      {typeof onPressReplies === 'function' && (
        <Pressable
          onPress={onPressReplies}
          accessibilityLabel={`${replyCount ?? 0} replies, tap to open thread`}
          style={{ paddingTop: 2 }}
        >
          <Label muted style={{ fontSize: 11 }}>
            ▶ {replyCount ?? 0} {replyCount === 1 ? 'REPLY' : 'REPLIES'}
          </Label>
        </Pressable>
      )}
    </Card>
  );
}

// A hard 2px ink rule local to the card (kept here to avoid an import cycle churn).
function Rule() {
  return <View style={{ height: 2, backgroundColor: colors.ink, opacity: 0.12 }} />;
}

// Inline reaction row: each emoji is a tappable pill showing its count. The
// viewer's own reaction is highlighted lime + offset shadow. Tapping toggles/switches.
function ReactionBar({
  counts,
  myReaction,
  onReact,
  disabled,
}: {
  counts: ReactionCounts;
  myReaction?: ReactionEmoji | null;
  onReact: (emoji: ReactionEmoji) => void;
  disabled?: boolean;
}) {
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
                gap: 5,
                paddingHorizontal: 11,
                height: 38,
                minWidth: 38,
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: radius.full,
                backgroundColor: mine ? colors.signal : colors.canvas,
                opacity: disabled && !mine ? 0.5 : 1,
              },
              pressed && !disabled ? { transform: [{ translateX: 2 }, { translateY: 2 }] } : mine ? brutalistShadow : null,
            ]}>
            <Text style={{ fontSize: 18 }}>{emoji}</Text>
            {count > 0 && (
              <Text style={{ fontFamily: 'JetBrainsMono_600SemiBold', fontSize: 12, color: colors.ink }}>
                {count}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function formatDuration(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  return `0:${s < 10 ? '0' : ''}${s}`;
}
