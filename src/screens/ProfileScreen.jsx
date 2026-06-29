import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Display, Label, SignalButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { fetchProfileStats } from '../lib/notes';
import { colors, space } from '../theme';

// Profile: username, total notes, total reactions, note list, logout.
export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const [stats, setStats] = useState({ totalNotes: 0, totalReactions: 0, notes: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchProfileStats(user.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />
      <FlatList
        data={stats.notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
        ListHeaderComponent={
          <View style={{ gap: space.elementGap, marginBottom: space.elementGap }}>
            <Display style={{ textTransform: 'uppercase' }}>
              {profile?.username ?? '—'}
            </Display>

            <View style={{ flexDirection: 'row', gap: 32 }}>
              <Stat value={stats.totalNotes} label="NOTES" />
              <Stat value={stats.totalReactions} label="REACTIONS" />
            </View>

            <View style={{ height: 2, backgroundColor: colors.ink, marginVertical: 8 }} />

            {error && <Body style={{ color: colors.error }}>{error}</Body>}
            {loading && <ActivityIndicator color={colors.ink} />}

            <Label muted>YOUR NOTES</Label>
          </View>
        }
        ListEmptyComponent={
          !loading && <Body muted style={{ fontSize: 18 }}>No notes yet.</Body>
        }
        renderItem={({ item }) => (
          <VoiceNoteCard
            title="YOU"
            createdAt={item.created_at}
            durationSec={item.duration}
            audioUrl={item.audio_url}
            reactions={item.reactions}
          />
        )}
        ListFooterComponent={
          <View style={{ marginTop: space.sectionMargin }}>
            {/* Logout is the secondary action — plain bordered, not the lime accent. */}
            <SignalButton label="LOG OUT" onPress={signOut} style={{ backgroundColor: colors.canvas }} />
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View>
      <Display style={{ fontSize: 48, lineHeight: 48 }}>{value}</Display>
      <Label muted style={{ marginTop: 4 }}>{label}</Label>
    </View>
  );
}
