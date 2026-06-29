import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Display, Label, SignalButton } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, fonts, radius, space } from '../theme';

// Shown when authenticated but no username row exists yet. Creates the
// public.users row, then refreshes the profile to enter the app.
export default function UsernameScreen() {
  const { user, refreshProfile, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    setError(null);
    const clean = username.trim();
    if (clean.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    setBusy(true);
    try {
      const { error: insertError } = await supabase
        .from('users')
        .insert({ id: user.id, username: clean });
      if (insertError) {
        setError(
          insertError.code === '23505'
            ? 'That username is taken. Try another.'
            : insertError.message
        );
        return;
      }
      await refreshProfile();
    } catch (e) {
      setError(e.message ?? 'Could not save username.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingHorizontal: space.containerPadding }}>
        <View style={{ flex: 1, justifyContent: 'center', gap: space.sectionMargin }}>
          <View style={{ gap: 12 }}>
            <Display>PICK A{'\n'}HANDLE</Display>
            <Body muted style={{ fontSize: 18 }}>This is how strangers hear you.</Body>
          </View>

          <View style={{ gap: 16 }}>
            <TextInput
              placeholder="USERNAME"
              placeholderTextColor={colors.onSurfaceVariant}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              style={{
                borderWidth: 2,
                borderColor: colors.ink,
                borderRadius: radius.md,
                paddingHorizontal: 20,
                paddingVertical: 18,
                fontFamily: fonts.mono,
                fontSize: 16,
                letterSpacing: 1.5,
                color: colors.ink,
              }}
            />
            {error && <Body style={{ color: colors.error }}>{error}</Body>}
            <SignalButton label={busy ? 'SAVING…' : 'CLAIM IT'} onPress={save} disabled={busy} />
            <Pressable onPress={signOut} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Label muted>CANCEL · SIGN OUT</Label>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
