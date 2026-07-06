import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, ConfirmModal, Display, IconButton, Label, Monogram, Rule, SecondaryButton, SignalButton, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useWindowedPlayback } from '../hooks/useWindowedPlayback';
import { blockUser, reportContent, unblockUser } from '../lib/moderation';
import { fetchUserNotesPage } from '../lib/notes';
import { fetchPublicProfile, follow, unfollow } from '../lib/social';
import { colors, space } from '../theme';
import type { PublicProfile, UserNote } from '../types';

// Public profile for any user: identity, follower/following/notes counts, a
// follow/unfollow control, and their broadcasts. Reached by tapping an author
// in the feed. Reactions here are read-only summaries (like My Notes/Profile).
export default function UserProfileScreen() {
  const { id } = useLocalSearchParams();
  const userId = Array.isArray(id) ? id[0] : id;
  const { user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<PublicProfile | null>(null);
  const [notes, setNotes] = useState<UserNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false); // follow request inflight
  const [confirmBlock, setConfirmBlock] = useState(false); // block confirm modal
  const [confirmReport, setConfirmReport] = useState(false); // report confirm modal
  const [modPending, setModPending] = useState(false); // block/report inflight
  const [reported, setReported] = useState(false); // report filed this session
  const { playingNoteId, activate, savePosition, getInitialPosition, handleFinish } = useWindowedPlayback();

  const cursorRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profile, page] = await Promise.all([
        fetchPublicProfile(userId!, user!.id),
        fetchUserNotesPage({ userId: userId! }),
      ]);
      setData(profile);
      setNotes(page.notes);
      cursorRef.current = page.nextCursor;
      setHasMore(page.hasMore);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [userId, user]);

  const loadMore = useCallback(async () => {
    if (inFlight.current || !hasMore || loading) return;
    inFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchUserNotesPage({ userId: userId!, before: cursorRef.current });
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
  }, [userId, hasMore, loading]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Open the followers/following list for this user, seeded to the tapped tab.
  const openFollows = useCallback(
    (direction: 'followers' | 'following') => {
      router.push({
        pathname: '/follows',
        params: { userId: userId!, username: data?.username ?? '', direction },
      });
    },
    [router, userId, data]
  );

  // Optimistic follow toggle: flip the flag + adjust the follower count, roll
  // back on failure.
  const toggleFollow = useCallback(async () => {
    if (!data || data.isSelf || pending) return;
    const next = !data.isFollowing;
    setPending(true);
    setData((d) => d ? { ...d, isFollowing: next, followerCount: d.followerCount + (next ? 1 : -1) } : d);
    try {
      if (next) await follow(user!.id, userId!);
      else await unfollow(user!.id, userId!);
    } catch (e: unknown) {
      setData((d) => d ? { ...d, isFollowing: !next, followerCount: d.followerCount + (next ? -1 : 1) } : d);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }, [data, pending, user, userId]);

  // Block / unblock. Blocking also drops any follow edge to this user so they
  // vanish from all scopes. Optimistic flag flip; roll back on failure.
  const toggleBlock = useCallback(async () => {
    if (!data || data.isSelf || modPending) return;
    const next = !data.isBlocked;
    setModPending(true);
    setConfirmBlock(false);
    setData((d) => (d ? { ...d, isBlocked: next, isFollowing: next ? false : d.isFollowing } : d));
    try {
      if (next) {
        await blockUser(user!.id, userId!);
        await unfollow(user!.id, userId!); // stop following someone you block
      } else {
        await unblockUser(user!.id, userId!);
      }
    } catch (e: unknown) {
      setData((d) => (d ? { ...d, isBlocked: !next } : d));
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setModPending(false);
    }
  }, [data, modPending, user, userId]);

  // File a report against this user (a generic reason — the profile-level flag).
  const submitReport = useCallback(async () => {
    if (!data || data.isSelf || modPending) return;
    setModPending(true);
    setConfirmReport(false);
    try {
      await reportContent({
        reporterId: user!.id,
        reportedUserId: userId!,
        reason: 'Reported from profile',
      });
      setReported(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setModPending(false);
    }
  }, [data, modPending, user, userId]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      {/* Local top bar: back control + wordmark. */}
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
        <Label muted>PROFILE</Label>
      </View>

      {loading && !data ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      ) : error && !data ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={load} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 24 }}>
                <ActivityIndicator color={colors.ink} />
              </View>
            ) : null
          }
          ListHeaderComponent={
            <View style={{ gap: space.elementGap, marginBottom: space.elementGap }}>
              {/* Identity. Monogram lime only when following is NOT the focal
                  action (i.e. already following) — keeps one lime per screen. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Monogram name={data?.username} size={64} filled={data?.isFollowing || data?.isSelf} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Label muted>{data?.isSelf ? 'THIS IS YOU' : 'VOICE'}</Label>
                  <Display style={{ fontSize: 36, lineHeight: 38, textTransform: 'uppercase' }} numberOfLines={1}>
                    {data?.username ?? '—'}
                  </Display>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <StatCard value={data?.totalNotes ?? 0} label="NOTES" />
                <StatCard
                  value={data?.followerCount ?? 0}
                  label="FOLLOWERS"
                  onPress={() => openFollows('followers')}
                />
                <StatCard
                  value={data?.followingCount ?? 0}
                  label="FOLLOWING"
                  onPress={() => openFollows('following')}
                />
              </View>

              {!data?.isSelf && !data?.isBlocked &&
                (data?.isFollowing ? (
                  <SecondaryButton label={pending ? '…' : '✓ FOLLOWING'} onPress={toggleFollow} disabled={pending} />
                ) : (
                  <SignalButton label={pending ? '…' : '+ FOLLOW'} onPress={toggleFollow} disabled={pending} />
                ))}

              {/* Moderation controls: block toggle + report (not for own profile). */}
              {!data?.isSelf && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      label={modPending ? '…' : data?.isBlocked ? 'UNBLOCK' : 'BLOCK'}
                      onPress={() => (data?.isBlocked ? toggleBlock() : setConfirmBlock(true))}
                      disabled={modPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton
                      label={reported ? '✓ REPORTED' : 'REPORT'}
                      onPress={() => setConfirmReport(true)}
                      disabled={modPending || reported}
                    />
                  </View>
                </View>
              )}

              {data?.isBlocked && (
                <Body muted style={{ fontSize: 15 }}>
                  You block this user. Their broadcasts are hidden from your feed.
                </Body>
              )}

              <Rule />
              <Label muted>{data?.isSelf ? 'YOUR NOTES' : 'THEIR NOTES'}</Label>
            </View>
          }
          ListEmptyComponent={
            !loading ? <Body muted style={{ fontSize: 17 }}>No broadcasts yet.</Body> : null
          }
          renderItem={({ item }) => (
            <VoiceNoteCard
              title={data?.username ?? 'ANON'}
              own={data?.isSelf}
              createdAt={item.created_at}
              durationSec={item.duration}
              audioUrl={item.audio_url}
              reactionCounts={item.reactionCounts}
              staticTotal={item.reactionTotal}
              active={item.id === playingNoteId}
              onActivate={() => activate(item.id)}
              initialPosition={getInitialPosition(item.id)}
              onSavePosition={(s) => savePosition(item.id, s)}
              onFinish={() => handleFinish(item.id)}
              replyCount={item.replyCount}
              onPressReplies={() => router.navigate(`/thread/${item.id}`)}
            />
          )}
        />
      )}

      <ConfirmModal
        visible={confirmBlock}
        title="BLOCK THIS VOICE?"
        message={`You'll stop hearing ${data?.username ?? 'this user'} and unfollow them. They won't be told.`}
        confirmLabel="BLOCK"
        cancelLabel="CANCEL"
        tone="danger"
        busy={modPending}
        onConfirm={toggleBlock}
        onCancel={() => setConfirmBlock(false)}
      />

      <ConfirmModal
        visible={confirmReport}
        title="REPORT THIS VOICE?"
        message="This flags the user for review by moderators. Abuse of reporting may be actioned."
        confirmLabel="REPORT"
        cancelLabel="CANCEL"
        tone="danger"
        busy={modPending}
        onConfirm={submitReport}
        onCancel={() => setConfirmReport(false)}
      />
    </SafeAreaView>
  );
}
