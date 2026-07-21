// Shared application types. DB row shapes mirror the SQL in supabase/migrations;
// the "decorated" shapes are what the data layer returns to the UI.

import { REACTION_EMOJIS } from './theme';

// ─────────────────────────────────────────────────────────────
// Database rows (public schema)
// ─────────────────────────────────────────────────────────────

export interface UserRow {
  id: string;
  username: string;
  created_at: string;
}

export interface VoiceNoteRow {
  id: string;
  user_id: string;
  audio_url: string | null;
  gif_url?: string | null;
  duration: number | null;
  created_at: string;
  // Denormalized reaction aggregates, maintained by a DB trigger (see
  // migration 0006). The feed reads these directly instead of counting rows.
  reaction_total: number;
  reaction_counts: ReactionCounts;
  // Denormalized count of direct voice replies (migration 0016).
  reply_count: number;
  // Non-null when this row is a reply to another note (migration 0016).
  parent_note_id: string | null;
}

// One of the six allowed reaction emojis.
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionRow {
  emoji: ReactionEmoji;
}

// ─────────────────────────────────────────────────────────────
// Decorated shapes returned by the data layer
// ─────────────────────────────────────────────────────────────

// Per-note reaction aggregate: count per emoji.
export type ReactionCounts = Partial<Record<ReactionEmoji, number>>;

// A feed note: a voice note plus author + reaction aggregate for the viewer.
export interface FeedNote {
  id: string;
  audio_url: string | null;
  gif_url?: string | null;
  duration: number | null;
  created_at: string;
  user_id: string;
  author: { id: string; username: string };
  reactionCounts: ReactionCounts;
  total: number;
  myReaction: ReactionEmoji | null;
  // Denormalized reply count (migration 0016). Shown below the card.
  replyCount: number;
}

// A user's own note (My Notes / Profile lists). Reaction summary comes from the
// denormalized aggregates (migration 0006) — no per-reaction rows fetched.
export interface UserNote {
  id: string;
  audio_url: string | null;
  gif_url?: string | null;
  duration: number | null;
  created_at: string;
  reactionCounts: ReactionCounts;
  reactionTotal: number;
  // Denormalized reply count (migration 0016).
  replyCount: number;
}

export interface FeedPage {
  notes: FeedNote[];
  nextCursor: string | null;
  hasMore: boolean;
}

// A page of a user's own notes, keyset-paginated by created_at.
export interface UserNotePage {
  notes: UserNote[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ProfileStats {
  totalNotes: number;
  totalReactions: number;
}

// Public profile bundle (UserProfileScreen). Stats are counts only; the note
// list is fetched + paginated separately.
export interface PublicProfile {
  username: string;
  totalNotes: number;
  totalReactions: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  // Does this user follow the viewer back? Combined with isFollowing this gives
  // mutual-follow, which gates the ability to start a direct voice message.
  followsYou: boolean;
  isSelf: boolean;
  isBlocked: boolean; // does the viewer block this user?
}

// Feed source scope.
export type FeedScope = 'everyone' | 'following';

// ─────────────────────────────────────────────────────────────
// Follow lists (followers / following screens)
// ─────────────────────────────────────────────────────────────

// Which direction of the follow graph a list screen shows.
//   'followers' — users who follow the subject.
//   'following' — users the subject follows.
export type FollowDirection = 'followers' | 'following';

// One row in a follow list: the other user + whether the *viewer* follows them.
// `isSelf` marks the viewer's own row (no follow control there).
export interface FollowUser {
  id: string;
  username: string;
  isFollowing: boolean;
  isSelf: boolean;
  edgeCreatedAt: string; // follows.created_at — the keyset cursor
}

// A page of a follow list. `nextCursor` is the last edge's created_at.
export interface FollowPage {
  users: FollowUser[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// User search (see migration 0015_user_search.sql)
// ─────────────────────────────────────────────────────────────

// One result row in the user-search screen: the matched user plus whether the
// *viewer* follows them (drives the inline follow control). No self row — the
// search RPC excludes the caller server-side.
export interface SearchUser {
  id: string;
  username: string;
  isFollowing: boolean;
}

// ─────────────────────────────────────────────────────────────
// Notifications (activity feed — see migration 0013_notifications.sql)
// ─────────────────────────────────────────────────────────────

// What happened:
//   'reaction' — `actor` reacted `emoji` to your note (`voiceNoteId`).
//   'follow'   — `actor` followed you.
//   'note'     — `actor` (someone you follow) posted a note (`voiceNoteId`).
//   'reply'    — `actor` replied to your note (`voiceNoteId`).
export type NotificationType = 'reaction' | 'follow' | 'note' | 'reply';

// One decorated notification for the Activity screen. `actor` is resolved
// through public_usernames (users RLS is self-only).
export interface AppNotification {
  id: string;
  type: NotificationType;
  actor: { id: string; username: string };
  voiceNoteId: string | null;
  emoji: ReactionEmoji | null;
  read: boolean;
  createdAt: string; // notifications.created_at — the keyset cursor
}

// A page of notifications, keyset-paginated by created_at.
export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Voice replies (migration 0016)
// ─────────────────────────────────────────────────────────────

// A single voice reply in a thread, decorated with its author's username.
export interface VoiceReply {
  id: string;
  audio_url: string | null;
  gif_url?: string | null;
  duration: number | null;
  created_at: string;
  user_id: string;
  author: { id: string; username: string };
}

// A page of replies for a thread, paginated oldest-first by created_at.
export interface ReplyPage {
  replies: VoiceReply[];
  nextCursor: string | null; // created_at of last reply in this page
  hasMore: boolean;
}

// One of the user's own voice replies, shown in their archive with parent context.
// `parentAuthor` is the username of whoever posted the note they replied to.
export interface UserReply {
  id: string;
  audio_url: string | null;
  gif_url?: string | null;
  duration: number | null;
  created_at: string;
  // The note this reply belongs to — lets the UI show "↩ reply to @X" context.
  parentNoteId: string;
  parentAuthorUsername: string;
}

// A page of the user's own reply rows, newest-first.
export interface UserReplyPage {
  replies: UserReply[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ─────────────────────────────────────────────────────────────
// Direct voice messages (1:1 audio DM — see migration 0019)
// ─────────────────────────────────────────────────────────────

// One conversation in the inbox, decorated for the viewer: the OTHER
// participant, the recency sort key, and the viewer's unread count.
export interface Conversation {
  id: string;
  // The participant who is not the viewer (the person you're talking to).
  other: { id: string; username: string };
  lastMessageAt: string; // conversations.last_message_at — inbox sort key
  // Number of messages in this conversation the viewer hasn't heard yet.
  unreadCount: number;
}

// A single voice message inside a conversation. `mine` marks messages the
// viewer sent (drives bubble alignment). `read` reflects read_at for the
// sender's own outgoing messages (read receipts).
export interface DirectMessage {
  id: string;
  conversationId: string;
  senderId: string;
  audio_url: string; // signed, ready to play
  duration: number | null;
  createdAt: string;
  mine: boolean;
  read: boolean;
}

// A page of messages in a conversation, oldest-first (chat order), keyset
// paginated by created_at.
export interface MessagePage {
  messages: DirectMessage[];
  nextCursor: string | null; // created_at of the OLDEST message in this page
  hasMore: boolean;
}
