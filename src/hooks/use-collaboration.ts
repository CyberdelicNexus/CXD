'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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

  // Get current user on mount
  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabaseRef.current.auth.getUser();
      if (user) {
        setCurrentUser({
          id: user.id,
          email: user.email || '',
          name: user.user_metadata?.name || user.email?.split('@')[0],
          avatarUrl: user.user_metadata?.avatar_url,
        });
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

    // Handle presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<CollaboratorPresence>();
      const collaboratorList: CollaboratorPresence[] = [];

      Object.entries(state).forEach(([key, presences]) => {
        presences.forEach((presence) => {
          // Don't include self in the list
          if (presence.id !== currentUser.id) {
            collaboratorList.push(presence);
          }
        });
      });

      setCollaborators(collaboratorList);
    });

    // Handle presence join
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      newPresences.forEach((presence: CollaboratorPresence) => {
        if (presence.id !== currentUser.id) {
          options.onCollaboratorJoin?.(presence);
        }
      });
    });

    // Handle presence leave
    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      leftPresences.forEach((presence: CollaboratorPresence) => {
        options.onCollaboratorLeave?.(presence.id);
      });
    });

    // Handle canvas updates
    channel.on('broadcast', { event: 'canvas_update' }, ({ payload }) => {
      const update = payload as CanvasUpdate;
      // Don't process our own updates
      if (update.userId !== currentUser.id) {
        options.onRemoteUpdate?.(update);
      }
    });

    // Subscribe and track presence
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);

        // Track our presence
        await channel.track({
          id: currentUser.id,
          name: currentUser.name || currentUser.email.split('@')[0],
          email: currentUser.email,
          avatarUrl: currentUser.avatarUrl,
          color: generateUserColor(currentUser.id),
          lastSeen: Date.now(),
        });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        setIsConnected(false);
      }
    });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [canvasId, currentUser, options.onRemoteUpdate, options.onCollaboratorJoin, options.onCollaboratorLeave]);

  // Update cursor position (throttled to 16ms / ~60fps for smooth movement)
  const updateCursor = useCallback((x: number, y: number) => {
    if (!channelRef.current || !currentUser) return;

    // Throttle updates
    if (cursorThrottleRef.current) {
      // Store latest position for next update
      lastCursorRef.current = { x, y };
      return;
    }

    // Send immediately
    channelRef.current.track({
      id: currentUser.id,
      name: currentUser.name || currentUser.email.split('@')[0],
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl,
      color: generateUserColor(currentUser.id),
      cursor: { x, y, timestamp: Date.now() },
      lastSeen: Date.now(),
    });

    // Set up throttle for next update (16ms for ~60fps)
    cursorThrottleRef.current = setTimeout(() => {
      cursorThrottleRef.current = null;

      // Send any pending cursor update
      if (lastCursorRef.current && channelRef.current && currentUser) {
        const { x, y } = lastCursorRef.current;
        channelRef.current.track({
          id: currentUser.id,
          name: currentUser.name || currentUser.email.split('@')[0],
          email: currentUser.email,
          avatarUrl: currentUser.avatarUrl,
          color: generateUserColor(currentUser.id),
          cursor: { x, y, timestamp: Date.now() },
          lastSeen: Date.now(),
        });
        lastCursorRef.current = null;
      }
    }, 16);
  }, [currentUser]);

  // Clear cursor when leaving canvas area
  const clearCursor = useCallback(() => {
    if (!channelRef.current || !currentUser) return;

    channelRef.current.track({
      id: currentUser.id,
      name: currentUser.name || currentUser.email.split('@')[0],
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl,
      color: generateUserColor(currentUser.id),
      cursor: undefined,
      lastSeen: Date.now(),
    });
  }, [currentUser]);

  // Update selection
  const updateSelection = useCallback((elementIds: string[]) => {
    if (!channelRef.current || !currentUser) return;

    channelRef.current.track({
      id: currentUser.id,
      name: currentUser.name || currentUser.email.split('@')[0],
      email: currentUser.email,
      avatarUrl: currentUser.avatarUrl,
      color: generateUserColor(currentUser.id),
      selection: { elementIds },
      lastSeen: Date.now(),
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

        // Set permissions based on role
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
