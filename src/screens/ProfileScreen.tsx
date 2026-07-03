import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Display, Label, Monogram, Rule, SecondaryButton, SignalButton, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fetchProfileStats, fetchUserNotesPage } from '../lib/notes';
import { fetchFollowCounts } from '../lib/social';
import { colors, space } from '../theme';
import type { ProfileStats, UserNote } from '../types';

// Profile: identity block, stat cards, note list, record + logout actions.
// Totals come from the server-side stats RPC; the note list is paginated with
// infinite scroll rather than pulling the whole history.
export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<ProfileStats>({ totalNotes: 0, totalReactions: 0 });
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [counts, setCounts] = useState({ followerCount: 0, followingCount: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);

  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, c, page] = await Promise.all([
        fetchProfileStats(user!.id),
        fetchFollowCounts(user!.id),
        fetchUserNotesPage({ userId: user!.id }),
      ]);
      setStats(s);
      setCounts(c);
      setNotes(page.notes);
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore || loading) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchUserNotesPage({ userId: user!.id, before: cursorRef.current });
      setNotes((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...page.notes.filter((n) => !seen.has(n.id))];
      });
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      setLoadingMore(false);
    }
  }, [user, hasMore, loading]);

  const openFollows = useCallback(
    (direction: 'followers' | 'following') => {
      router.push({
        pathname: '/follows',
        params: { userId: user!.id, username: profile?.username ?? '', direction },
      });
    },
    [router, user, profile]
  );

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const username = profile?.username ?? '—';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
        ListHeaderComponent={
          <View style={{ gap: space.elementGap, marginBottom: space.elementGap }}>
            {/* Identity block: lime monogram + name. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Monogram name={username} size={64} filled />
              <View style={{ flex: 1, gap: 4 }}>
                <Label muted>SIGNED IN AS</Label>
                <Display style={{ fontSize: 36, lineHeight: 38, textTransform: 'uppercase' }} numberOfLines={1}>
                  {username}
                </Display>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <StatCard value={stats.totalNotes} label="NOTES" />
              <StatCard value={stats.totalReactions} label="REACTIONS" accent={stats.totalReactions > 0} />
            </View>

            <View style={{ flexDirection: 'row', gap: 16 }}>
              <StatCard value={counts.followerCount} label="FOLLOWERS" onPress={() => openFollows('followers')} />
              <StatCard value={counts.followingCount} label="FOLLOWING" onPress={() => openFollows('following')} />
            </View>

            <SignalButton label="● NEW BROADCAST" onPress={() => router.navigate('/record')} />
            <SecondaryButton label="SETTINGS" onPress={() => router.navigate('/settings')} />

            <Rule />

            {error && <Body style={{ color: colors.error }}>{error}</Body>}
            {loading && <ActivityIndicator color={colors.ink} />}

            <Label muted>YOUR NOTES</Label>
          </View>
        }
        ListEmptyComponent={
          !loading ? <Body muted style={{ fontSize: 17 }}>No notes yet.</Body> : null
        }
        renderItem={({ item }) => (
          <VoiceNoteCard
            title="YOU"
            own
            createdAt={item.created_at}
            durationSec={item.duration}
            audioUrl={item.audio_url}
            reactionCounts={item.reactionCounts}
            staticTotal={item.reactionTotal}
            active={item.id === playingNoteId}
            onToggleActive={() => setPlayingNoteId((prev) => (prev === item.id ? null : item.id))}
            onFinish={() => setPlayingNoteId(null)}
          />
        )}
        ListFooterComponent={
          <View style={{ marginTop: space.sectionMargin, gap: space.elementGap }}>
            {loadingMore && <ActivityIndicator color={colors.ink} />}
            {/* Logout is the secondary action — bordered white, not the lime accent. */}
            <SecondaryButton label="LOG OUT" onPress={signOut} />
          </View>
        }
      />
    </SafeAreaView>
  );
}
