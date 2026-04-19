'use client';

import { useEffect, useRef, useCallback, useState, useLayoutEffect } from 'react';
import { createClient } from '@/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

// Collaborator colors for cursors
const COLLABORATOR_COLORS = [
  '#F87171', // red
  '#FB923C', // orange
  '#FBBF24', // amber
  '#34D399', // emerald
  '#22D3EE', // cyan
  '#818CF8', // indigo
  '#A78BFA', // violet
  '#F472B6', // pink
];

// Generate consistent color based on user ID
export function generateUserColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return COLLABORATOR_COLORS[Math.abs(hash) % COLLABORATOR_COLORS.length];
}

export interface CollaboratorPresence {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  color: string;
  cursor?: {
    x: number;
    y: number;
    zoom?: number;
    boardId?: string | null;
    timestamp: number;
  };
  selection?: {
    elementIds: string[];
  };
  lastSeen: number;
}

export interface CanvasUpdate {
  type: 'field_update' | 'element_add' | 'element_update' | 'element_delete' | 'edge_add' | 'edge_update' | 'edge_delete' | 'state_sync' | 'container_move';
  path?: string[];
  value?: unknown;
  element?: unknown;
  elementId?: string;
  changes?: Record<string, unknown>;
  edge?: unknown;
  edgeId?: string;
  edgeChanges?: Record<string, unknown>;
  elements?: unknown[];
  edges?: unknown[];
  containerId?: string;
  childUpdates?: { elementId: string; changes: Record<string, unknown> }[];
  timestamp: number;
  userId: string;
}

interface UseCollaborationOptions {
  onRemoteUpdate?: (update: CanvasUpdate) => void;
  onCollaboratorJoin?: (collaborator: CollaboratorPresence) => void;
  onCollaboratorLeave?: (collaboratorId: string) => void;
}

// How long (ms) without a heartbeat before a peer is considered gone
const PEER_TIMEOUT_MS = 90_000; // 90s
// How often to send our own heartbeat (ms)
const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
// Minimum gap between re-announcing ourselves when a peer announces (ms)
const REANNOUNCE_DEBOUNCE_MS = 5_000;
// Cursor staleness window (must match collaborator-cursors.tsx)
const CURSOR_THROTTLE_MS = 50; // ~20fps

export function useCollaboration(
  canvasId: string | null,
  options: UseCollaborationOptions = {}
) {
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; name?: string; avatarUrl?: string } | null>(null);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());
  const cursorThrottleRef = useRef<NodeJS.Timeout | null>(null);
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);
  // Debounce for re-announcing ourselves when a new peer announces
  const lastReannounceRef = useRef<number>(0);

  // Stable refs for callbacks — updated every render without causing channel reconnection.
  const onRemoteUpdateRef = useRef(options.onRemoteUpdate);
  const onCollaboratorJoinRef = useRef(options.onCollaboratorJoin);
  const onCollaboratorLeaveRef = useRef(options.onCollaboratorLeave);
  useLayoutEffect(() => {
    onRemoteUpdateRef.current = options.onRemoteUpdate;
    onCollaboratorJoinRef.current = options.onCollaboratorJoin;
    onCollaboratorLeaveRef.current = options.onCollaboratorLeave;
  });

  // Get current user on mount — wrapped in try-catch to handle auth lock contention
  useEffect(() => {
    async function getUser() {
      try {
        const { data: { user } } = await supabaseRef.current.auth.getUser();
        if (user) {
          let avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
          try {
            const { data } = await supabaseRef.current.from('users').select('profile_picture').eq('id', user.id).single();
            if (data?.profile_picture) {
              avatarUrl = data.profile_picture;
            }
          } catch (err) { console.error('Failed to fetch profile picture:', err); }
          setCurrentUser({
            id: user.id,
            email: user.email || '',
            name: user.user_metadata?.name || user.email?.split('@')[0],
            avatarUrl,
          });
        }
      } catch (err) {
        // Auth lock contention — retry once after a short delay
        console.warn('[Collaboration] Auth lock error, retrying:', err);
        setTimeout(getUser, 500);
      }
    }
    getUser();
  }, []);

  // Set up realtime channel
  useEffect(() => {
    if (!canvasId || !currentUser) return;

    const supabase = supabaseRef.current;
    const channelName = `canvas:${canvasId}`;

    // Clean up existing channel
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: currentUser.id },
        broadcast: { self: false },
      },
    });

    // ─── Broadcast-based presence (primary mechanism) ──────────────────────
    // Supabase Presence (track/sync) can fail silently. Broadcast-based
    // heartbeats use the same infrastructure as Yjs (confirmed working) to
    // build a reliable "who's online" list.

    const buildUserPayload = (): CollaboratorPresence => ({
      id: currentUser.id,
      name: currentUser.name || currentUser.email.split('@')[0],
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl,
      color: generateUserColor(currentUser.id),
      lastSeen: Date.now(),
    });

    const broadcastHeartbeat = () => {
      if (!channelRef.current) return;
      channelRef.current.send({
        type: 'broadcast',
        event: 'user_heartbeat',
        payload: buildUserPayload(),
      });
    };

    // Receive heartbeats from other users
    channel.on('broadcast', { event: 'user_heartbeat' }, ({ payload }) => {
      const peer = payload as CollaboratorPresence;
      if (!peer?.id || peer.id === currentUser.id) return;

      setCollaborators((prev) => {
        const exists = prev.some((c) => c.id === peer.id);
        if (!exists) {
          // New peer appeared — announce ourselves so they see us too.
          // Debounce to avoid ping-pong when many peers join at once.
          const now = Date.now();
          if (now - lastReannounceRef.current > REANNOUNCE_DEBOUNCE_MS) {
            lastReannounceRef.current = now;
            broadcastHeartbeat();
          }
          onCollaboratorJoinRef.current?.(peer);
          return [...prev, peer];
        }
        // Update existing peer's lastSeen and any other changed fields
        return prev.map((c) => c.id === peer.id ? { ...c, ...peer } : c);
      });
    });

    // Receive cursor updates via broadcast (more reliable than presence track)
    channel.on('broadcast', { event: 'cursor_update' }, ({ payload }) => {
      const { id, x, y, zoom, boardId, timestamp } = payload as { id: string; x: number; y: number; zoom?: number; boardId?: string | null; timestamp: number };
      if (!id || id === currentUser.id) return;

      setCollaborators((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, cursor: { x, y, zoom, boardId, timestamp } } : c
        )
      );
    });

    // Receive cursor clear events
    channel.on('broadcast', { event: 'cursor_clear' }, ({ payload }) => {
      const { id } = payload as { id: string };
      if (!id || id === currentUser.id) return;

      setCollaborators((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, cursor: undefined } : c
        )
      );
    });

    // Receive selection updates from other users
    channel.on('broadcast', { event: 'selection_update' }, ({ payload }) => {
      const { id, elementIds } = payload as { id: string; elementIds: string[] };
      if (!id || id === currentUser.id) return;

      setCollaborators((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, selection: { elementIds } } : c
        )
      );
    });

    // Receive explicit offline notifications
    channel.on('broadcast', { event: 'user_offline' }, ({ payload }) => {
      const { id } = payload as { id: string };
      if (!id || id === currentUser.id) return;
      onCollaboratorLeaveRef.current?.(id);
      setCollaborators((prev) => prev.filter((c) => c.id !== id));
    });

    // ─── Supabase Presence (secondary/fallback) ────────────────────────────
    // Keep presence tracking as a fallback. If it works, great. If not,
    // the broadcast-based system above handles everything.

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<CollaboratorPresence>();
      setCollaborators((prev) => {
        const presencePeers: CollaboratorPresence[] = [];
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            if (presence.id !== currentUser.id) {
              presencePeers.push(presence);
            }
          });
        });
        if (presencePeers.length === 0) return prev; // presence empty, keep broadcast state
        // Merge: presence data wins for users it knows about; keep broadcast-only users
        const presenceIds = new Set(presencePeers.map((p) => p.id));
        const broadcastOnly = prev.filter((c) => !presenceIds.has(c.id));
        // For users in both, prefer presence data but preserve cursor from broadcast
        return [
          ...presencePeers.map((p) => {
            const existing = prev.find((c) => c.id === p.id);
            return { ...p, cursor: existing?.cursor ?? p.cursor };
          }),
          ...broadcastOnly,
        ];
      });
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      newPresences.forEach((p) => {
        const presence = p as unknown as CollaboratorPresence;
        if (presence.id !== currentUser.id) {
          onCollaboratorJoinRef.current?.(presence);
          setCollaborators((prev) => {
            if (prev.some((c) => c.id === presence.id)) return prev;
            return [...prev, presence];
          });
        }
      });
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      leftPresences.forEach((p) => {
        const presence = p as unknown as CollaboratorPresence;
        onCollaboratorLeaveRef.current?.(presence.id);
        setCollaborators((prev) => prev.filter((c) => c.id !== presence.id));
      });
    });

    // ─── Canvas updates ────────────────────────────────────────────────────
    channel.on('broadcast', { event: 'canvas_update' }, ({ payload }) => {
      const update = payload as CanvasUpdate;
      if (update.userId !== currentUser.id) {
        onRemoteUpdateRef.current?.(update);
      }
    });

    // ─── Subscribe ─────────────────────────────────────────────────────────
    let heartbeatTimer: NodeJS.Timeout | null = null;
    let cleanupTimer: NodeJS.Timeout | null = null;

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);

        // Announce ourselves immediately via broadcast
        broadcastHeartbeat();

        // Periodic heartbeat to keep online status fresh
        heartbeatTimer = setInterval(broadcastHeartbeat, HEARTBEAT_INTERVAL_MS);

        // Periodic cleanup: remove peers not seen recently
        cleanupTimer = setInterval(() => {
          const cutoff = Date.now() - PEER_TIMEOUT_MS;
          setCollaborators((prev) =>
            prev.filter((c) => {
              if (c.lastSeen < cutoff) {
                onCollaboratorLeaveRef.current?.(c.id);
                return false;
              }
              return true;
            })
          );
        }, HEARTBEAT_INTERVAL_MS);

        // Also track via Supabase Presence (best-effort fallback)
        const trackPresence = async (retriesLeft: number): Promise<void> => {
          try {
            const result = await channel.track(buildUserPayload());
            if (result !== 'ok' && retriesLeft > 0) {
              await new Promise<void>((r) => setTimeout(r, 800));
              await trackPresence(retriesLeft - 1);
            }
          } catch {
            // Presence failure is non-fatal; broadcast covers it
          }
        };
        trackPresence(3);
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      // Notify peers we're leaving before unsubscribing
      try {
        channel.send({
          type: 'broadcast',
          event: 'user_offline',
          payload: { id: currentUser.id },
        });
      } catch {
        // Best-effort
      }
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (cleanupTimer) clearInterval(cleanupTimer);
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      setCollaborators([]);
    };
  // Only canvasId and currentUser drive channel reconnection.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasId, currentUser]);

  // Update cursor position via broadcast (throttled to ~20fps).
  // Uses broadcast instead of presence track — broadcast is confirmed working
  // (same channel as Yjs sync) and doesn't require Supabase Presence feature.
  const updateCursor = useCallback((x: number, y: number, zoom?: number, boardId?: string | null) => {
    if (!channelRef.current || !currentUser) return;

    // Throttle updates
    if (cursorThrottleRef.current) {
      lastCursorRef.current = { x, y };
      return;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor_update',
      payload: { id: currentUser.id, x, y, zoom, boardId, timestamp: Date.now() },
    });

    cursorThrottleRef.current = setTimeout(() => {
      cursorThrottleRef.current = null;
      if (lastCursorRef.current && channelRef.current && currentUser) {
        const { x: px, y: py } = lastCursorRef.current;
        channelRef.current.send({
          type: 'broadcast',
          event: 'cursor_update',
          payload: { id: currentUser.id, x: px, y: py, zoom, boardId, timestamp: Date.now() },
        });
        lastCursorRef.current = null;
      }
    }, CURSOR_THROTTLE_MS);
  }, [currentUser]);

  // Clear cursor when leaving canvas area
  const clearCursor = useCallback(() => {
    if (!channelRef.current || !currentUser) return;

    if (cursorThrottleRef.current) {
      clearTimeout(cursorThrottleRef.current);
      cursorThrottleRef.current = null;
      lastCursorRef.current = null;
    }

    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor_clear',
      payload: { id: currentUser.id },
    });
  }, [currentUser]);

  // Update selection via broadcast (reliable, same as cursors)
  const updateSelection = useCallback((elementIds: string[]) => {
    if (!channelRef.current || !currentUser) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'selection_update',
      payload: { id: currentUser.id, elementIds },
    });
  }, [currentUser]);

  // Broadcast canvas update to other collaborators
  const broadcastUpdate = useCallback((update: Omit<CanvasUpdate, 'timestamp' | 'userId'>) => {
    if (!channelRef.current || !currentUser) return;

    const fullUpdate: CanvasUpdate = {
      ...update,
      timestamp: Date.now(),
      userId: currentUser.id,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'canvas_update',
      payload: fullUpdate,
    });
  }, [currentUser]);

  // Cleanup throttle on unmount
  useEffect(() => {
    return () => {
      if (cursorThrottleRef.current) {
        clearTimeout(cursorThrottleRef.current);
      }
    };
  }, []);

  return {
    collaborators,
    isConnected,
    currentUser,
    updateCursor,
    clearCursor,
    updateSelection,
    broadcastUpdate,
  };
}

// Hook to get canvas role and permissions
export function useCanvasPermissions(canvasId: string | null) {
  const [role, setRole] = useState<'owner' | 'collaborator' | 'viewer' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [permissions, setPermissions] = useState({
    canEdit: false,
    canInvite: false,
    canRemoveCollaborators: false,
    canDelete: false,
    canChangeSettings: false,
    canExport: false,
  });

  useEffect(() => {
    if (!canvasId) {
      setRole(null);
      setIsLoading(false);
      return;
    }

    async function checkPermissions() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/canvas/collaborators?canvasId=${canvasId}`);
        const data = await response.json();

        if (data.error) {
          setRole(null);
          return;
        }

        const userRole = data.isOwner ? 'owner' : 'collaborator';
        setRole(userRole);

        if (userRole === 'owner') {
          setPermissions({
            canEdit: true,
            canInvite: true,
            canRemoveCollaborators: true,
            canDelete: true,
            canChangeSettings: true,
            canExport: true,
          });
        } else if (userRole === 'collaborator') {
          setPermissions({
            canEdit: true,
            canInvite: false,
            canRemoveCollaborators: false,
            canDelete: false,
            canChangeSettings: false,
            canExport: true,
          });
        }
      } catch (error) {
        console.error('Error checking permissions:', error);
        setRole(null);
      } finally {
        setIsLoading(false);
      }
    }

    checkPermissions();
  }, [canvasId]);

  return { role, permissions, isLoading };
}
