import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AppHeader from '../components/AppHeader';
import VoiceNoteCard from '../components/VoiceNoteCard';
import { Body, Display, SignalButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { deleteNote, fetchUserNotes } from '../lib/notes';
import { colors, space } from '../theme';

// Lists all of the current user's broadcasts with reaction summaries.
// Each note can be deleted (removes the row, its reactions, and the audio file).
export default function MyNotesScreen() {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotes(await fetchUserNotes(user.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Refetch when the screen regains focus (e.g. after posting).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelete = useCallback((note) => {
    Alert.alert(
      'Delete broadcast?',
      'This removes the audio and all its reactions. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingId(note.id);
            // Optimistic removal; restore on failure.
            const prev = notes;
            setNotes((list) => list.filter((n) => n.id !== note.id));
            try {
              await deleteNote({ noteId: note.id, audioUrl: note.audio_url });
            } catch (e) {
              setNotes(prev);
              Alert.alert('Could not delete', e.message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  }, [notes]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
      <AppHeader />
      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator color={colors.ink} size="large" />
        </View>
      ) : error ? (
        <View style={{ flex: 1, justifyContent: 'center', padding: space.containerPadding, gap: 16 }}>
          <Body style={{ color: colors.error }}>{error}</Body>
          <SignalButton label="RETRY" onPress={load} />
        </View>
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: space.containerPadding, gap: space.elementGap, paddingBottom: 48 }}
          ListHeaderComponent={
            <View style={{ marginBottom: space.elementGap }}>
              <Display>ARCHIVE</Display>
              <Body muted style={{ fontSize: 18, marginTop: 8 }}>Your broadcasts and their resonance.</Body>
            </View>
          }
          ListEmptyComponent={
            <Body muted style={{ fontSize: 18 }}>No broadcasts yet. Tap record to send your first signal.</Body>
          }
          renderItem={({ item }) => (
            <VoiceNoteCard
              title="YOU"
              createdAt={item.created_at}
              durationSec={item.duration}
              audioUrl={item.audio_url}
              reactions={item.reactions}
              onDelete={deletingId === item.id ? undefined : () => confirmDelete(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
