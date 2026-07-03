import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { fetchUnreadCount } from '../lib/notifications';
import { supabase } from '../lib/supabase';

// Module-level monotonic topic seq (see useNotifications for why per-instance
// refs collide on remount).
let badgeSeq = 0;

// Lightweight unread-count source for the header bell badge. Unlike
// useNotifications it fetches no rows — just the count — plus a realtime
// subscription that increments on each new notification. Mounted once by
// AppHeader (which renders on Feed / My Notes / Profile).
//
// The count re-syncs whenever the screen refocuses via `refresh`; AppHeader
// calls it on a light interval-free basis (the realtime bump keeps it live,
// and opening the Activity screen zeroes the server rows, so a refocus fetch
// corrects the badge back to 0).
export function useUnreadBadge() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const mounted = useRef(true);

  const refresh = useRef(async () => {});
  refresh.current = async () => {
    if (!user) return;
    try {
      const count = await fetchUnreadCount(user.id);
      if (mounted.current) setUnreadCount(count);
    } catch {
      // Badge is best-effort; leave the last known value.
    }
  };

  useEffect(() => {
    mounted.current = true;
    if (!user) {
      setUnreadCount(0);
      return;
    }
    const viewerId = user.id;
    refresh.current();

    badgeSeq += 1;
    const topic = `badge:${viewerId}:${badgeSeq}`;
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${viewerId}`,
        },
        () => {
          if (mounted.current) setUnreadCount((c) => c + 1);
        }
      )
      .subscribe();

    return () => {
      mounted.current = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Stable callback identity so effects depending on `refresh` don't loop.
  const refreshStable = useCallback(() => refresh.current(), []);
  return { unreadCount, refresh: refreshStable };
}
