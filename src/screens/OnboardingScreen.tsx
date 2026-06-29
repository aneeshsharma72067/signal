import { type ComponentProps, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Body, Display, Label, SignalButton } from "../components/ui";
import { supabase } from "../lib/supabase";
import { colors, fonts, radius, space } from "../theme";

// Welcome + auth. Email/password sign up or log in. On success, AuthContext
// flips the navigator; new users with no username land on the Username step.
export default function OnboardingScreen() {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const credentials = { email: email.trim(), password };
      const { error: authError } =
        mode === "signup"
          ? await supabase.auth.signUp(credentials)
          : await supabase.auth.signInWithPassword(credentials);
      if (authError) setError(authError.message);
      // On success, onAuthStateChange in AuthContext drives navigation.
    } catch (e: unknown) {
      console.log(e);
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, paddingHorizontal: space.containerPadding }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            gap: space.sectionMargin,
          }}
        >
          <View style={{ gap: 16, alignItems: "center" }}>
            <Display style={{ fontSize: 72, lineHeight: 70 }}>SIGNAL</Display>
            <Body muted style={{ fontSize: 18, textAlign: "center" }}>
              30 seconds of pure voice.
            </Body>
          </View>

          <View style={{ gap: 16 }}>
            <Field
              placeholder="EMAIL"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            <Field
              placeholder="PASSWORD"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />

            {error && <Body style={{ color: colors.error }}>{error}</Body>}

            <SignalButton
              label={
                busy
                  ? "PLEASE WAIT…"
                  : mode === "signup"
                    ? "START LISTENING"
                    : "LOG IN"
              }
              onPress={submit}
              disabled={busy}
            />

            <Pressable
              onPress={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError(null);
              }}
              style={{ alignItems: "center", paddingVertical: 8 }}
            >
              <Label muted>
                {mode === "signup"
                  ? "HAVE AN ACCOUNT? LOG IN"
                  : "NEW HERE? SIGN UP"}
              </Label>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Enclosed input with a 2px ink border and bold mono placeholder (no ghost text).
function Field(props: ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={colors.onSurfaceVariant}
      style={{
        borderWidth: 2,
        borderColor: colors.ink,
        borderRadius: radius.md,
        paddingHorizontal: 20,
        paddingVertical: 18,
        fontFamily: fonts.mono,
        fontSize: 14,
        letterSpacing: 1,
        color: colors.ink,
      }}
      {...props}
    />
  );
}
