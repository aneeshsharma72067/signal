import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Display, IconButton, Label, Monogram, SignalButton } from '../components/ui';
import { timeAgo } from '../components/VoiceNoteCard';
import { useAuth } from '../context/AuthContext';
import { fetchConversations } from '../lib/messages';
import { supabase } from '../lib/supabase';
import { colors, space } from '../theme';
import type { Conversation } from '../types';

// Module-level monotonic topic seq (same reasoning as useUnreadBadge: per-
// instance refs collide on fast remount, so uniquify the realtime topic).
let inboxSeq = 0;

// Direct-message inbox: every 1:1 voice conversation the viewer is part of,
// newest activity first. Tapping a row opens the chat. New/updated messages
// bump a conversation live via a realtime subscription on `messages`.
export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const list = await fetchConversations(user.id);
      setConversations(list);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not load messages.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refetch whenever the inbox regains focus (returning from a chat updates
  // unread counts + ordering).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Realtime: any new message in one of the viewer's conversations should
  // re-sort/re-badge the inbox. The cheapest correct move is to refetch — the
  // list is small and this avoids reconciling counts by hand.
  useEffect(() => {
    if (!user) return;
    inboxSeq += 1;
    const channel = supabase
      .channel(`inbox:${user.id}:${inboxSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      {/* Local top bar: back + title. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 24,
          height: 64,
          borderBottomWidth: 2,
          borderBottomColor: colors.ink,
        }}>
        <IconButton glyph="‹" size={40} onPress={() => router.back()} accessibilityLabel="Back" />
        <Label muted>MESSAGES</Label>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      ) : error && conversations.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={load} />
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, flexGrow: 1 }}
          ListHeaderComponent={
            <View style={{ marginBottom: space.elementGap }}>
              <Label muted>◆ DIRECT</Label>
              <Display style={{ marginTop: 8 }}>WHISPERS</Display>
              <Body muted style={{ fontSize: 17, marginTop: 6 }}>
                Private voice, only between you two.
              </Body>
            </View>
          }
          ListEmptyComponent={
            <View style={{ flex: 1, gap: space.elementGap, alignItems: 'center', justifyContent: 'center' }}>
              <Display style={{ textAlign: 'center' }}>NO{'\n'}WHISPERS.</Display>
              <Body muted style={{ fontSize: 18, textAlign: 'center' }}>
                Open a voice you follow back and tap MESSAGE.
              </Body>
            </View>
          }
          renderItem={({ item }) => (
            <ConversationRow
              conversation={item}
              onPress={() => router.navigate(`/messages/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// One inbox row: the other participant's monogram + name, last-activity time,
// and a lime unread pill when there are messages the viewer hasn't heard.
function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const hasUnread = conversation.unreadCount > 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 16,
        borderWidth: 2,
        borderColor: colors.ink,
        borderRadius: 16,
        backgroundColor: colors.canvas,
        transform: pressed ? [{ translateX: 1 }, { translateY: 1 }] : [],
      })}>
      <Monogram name={conversation.other.username} size={44} filled={hasUnread} />
      <View style={{ flex: 1, gap: 3 }}>
        <Label numberOfLines={1} style={{ fontSize: 14 }}>
          {conversation.other.username}
        </Label>
        <Label muted style={{ fontSize: 11 }}>
          {hasUnread ? `${conversation.unreadCount} NEW` : timeAgo(conversation.lastMessageAt)}
        </Label>
      </View>
      {hasUnread && (
        <View
          style={{
            minWidth: 24,
            height: 24,
            paddingHorizontal: 8,
            borderRadius: 12,
            borderWidth: 2,
            borderColor: colors.ink,
            backgroundColor: colors.signal,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Label style={{ fontSize: 11 }}>{conversation.unreadCount}</Label>
        </View>
      )}
    </Pressable>
  );
}
