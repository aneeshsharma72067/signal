import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { fetchUnreadMessageCount } from '../lib/messages';
import { supabase } from '../lib/supabase';

// Module-level monotonic topic seq (see useUnreadBadge for the rationale:
// per-instance refs collide on remount).
let dmBadgeSeq = 0;

// Unread-count source for the header DM (chat) badge. Mirrors useUnreadBadge:
// a single head-count query plus a realtime subscription. It refetches on any
// message INSERT (a new incoming clip may raise the count) or UPDATE (reading
// messages sets read_at, which should lower it). AppHeader re-syncs via
// `refresh` on every route change, so opening a chat zeroes the badge on return.
export function useUnreadMessages() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const mounted = useRef(true);

  const refresh = useRef(async () => {});
  refresh.current = async () => {
    if (!user) return;
    try {
      const count = await fetchUnreadMessageCount(user.id);
      if (mounted.current) setUnreadCount(count);
    } catch {
      // Badge is best-effort; keep the last known value.
    }
  };

  useEffect(() => {
    mounted.current = true;
    if (!user) {
      setUnreadCount(0);
      return;
    }
    refresh.current();

    dmBadgeSeq += 1;
    const channel = supabase
      .channel(`dmbadge:${user.id}:${dmBadgeSeq}`)
      // Any message change (new clip or read receipt) may move the count;
      // refetch rather than reconcile by hand (the count query is cheap).
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => { refresh.current(); }
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const refreshStable = useCallback(() => refresh.current(), []);
  return { unreadCount, refresh: refreshStable };
}
