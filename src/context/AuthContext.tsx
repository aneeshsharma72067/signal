import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { supabase } from '../lib/supabase';
import type { UserRow } from '../types';

interface AuthValue {
  session: Session | null;
  user: User | null;
  profile: UserRow | null;
  loading: boolean;
  needsUsername: boolean;
  refreshProfile: () => Promise<UserRow | null>;
  signOut: () => Promise<unknown>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserRow | null>(null); // row from public.users (has username)
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  // Load the user's profile row. Returns the row or null.
  // NOTE: never call this directly inside an onAuthStateChange callback — the
  // supabase-js auth lock is held during the callback and this issues another
  // supabase request, which would deadlock. Always defer it (setTimeout 0).
  async function loadProfile(userId: string | undefined): Promise<UserRow | null> {
    if (!userId) {
      if (mounted.current) setProfile(null);
      return null;
    }
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile:', error.message);
      if (mounted.current) setProfile(null);
      return null;
    }
    if (mounted.current) setProfile(data ?? null);
    return data ?? null;
  }

  useEffect(() => {
    mounted.current = true;

    // Restore persisted session on launch. Always clear loading, even on error.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted.current) return;
        setSession(data.session);
        const userId = data.session?.user?.id;
        if (!userId) {
          setProfile(null);
          setLoading(false);
          return;
        }
        // Defer profile fetch — never call supabase.from() synchronously off
        // getSession when onAuthStateChange(INITIAL_SESSION) may still hold lock.
        setTimeout(() => {
          loadProfile(userId).finally(() => {
            if (mounted.current) setLoading(false);
          });
        }, 0);
      })
      .catch((e) => {
        console.error('getSession failed:', e?.message ?? e);
        if (mounted.current) setLoading(false);
      });

    // React to auth changes. Callback MUST stay synchronous (no await) — defer
    // any supabase calls with setTimeout to avoid the auth-lock deadlock.
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted.current) return;
      setSession(newSession);
      setTimeout(() => {
        loadProfile(newSession?.user?.id);
      }, 0);
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value: AuthValue = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    // True when authed but no username row yet → needs username setup step.
    needsUsername: !!session && !profile,
    refreshProfile: () => loadProfile(session?.user?.id),
    signOut: () => supabase.auth.signOut(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
