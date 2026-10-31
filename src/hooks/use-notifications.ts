'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/supabase/client';
import { 
  fetchNotifications, 
  markAsRead, 
  markAllAsRead, 
  getUnreadCount,
  clearAllNotifications,
  Notification 
} from '@/lib/notifications';

export function useNotifications() {
  const instanceId = useId();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    const [notifs, count] = await Promise.all([
      fetchNotifications(),
      getUnreadCount(),
    ]);
    setNotifications(notifs);
    setUnreadCount(count);
    setLoading(false);
  }, []);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Subscribe to realtime updates, only for rows that belong to the signed-in user.
  // The navbars each mount this hook, and the realtime client returns the existing
  // channel for a repeated name, so a second hook instance would share, and then
  // tear down, the first one's channel. A per-instance name keeps them apart.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let subscribedUser: string | null = null;
    let cancelled = false;

    const unsubscribe = () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
      subscribedUser = null;
    };

    const subscribeFor = (userId: string) => {
      if (cancelled || userId === subscribedUser) return;
      unsubscribe();
      subscribedUser = userId;
      channel = supabase
        .channel(`notifications-${userId}-${instanceId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          () => {
            // Reload notifications when any change occurs
            loadNotifications();
          }
        )
        .subscribe();
    };

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) subscribeFor(user.id);
    }).catch((err) => {
      // The auth listener below still subscribes once a session is known.
      Sentry.captureException(err, { tags: { area: 'notifications', step: 'get-user' } });
    });

    // A sign-in after mount, or a switch of account, moves the subscription to that user.
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id;
      if (!userId) {
        unsubscribe();
        return;
      }
      if (userId !== subscribedUser) {
        subscribeFor(userId);
        // The mount load already covers the session that was there at start.
        if (event === 'SIGNED_IN') loadNotifications();
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      unsubscribe();
    };
  }, [loadNotifications, instanceId]);

  const handleMarkAsRead = async (id: string) => {
    const success = await markAsRead(id);
    if (success) {
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleClearAll = async () => {
    const success = await clearAllNotifications();
    if (success) {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead: handleMarkAsRead,
    markAllAsRead: handleMarkAllAsRead,
    clearAll: handleClearAll,
    refresh: loadNotifications,
  };
}
