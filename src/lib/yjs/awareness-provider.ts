/**
 * Awareness Provider
 *
 * Bridges the Yjs Awareness protocol with Supabase Realtime Presence.
 * Syncs ephemeral per-user state: cursor position, element selection, editing indicators.
 *
 * The Awareness protocol is separate from the Y.Doc sync protocol:
 * - Awareness = ephemeral state (cursors, selections, editing flags)
 * - Y.Doc sync = persistent state (elements, edges, design fields)
 *
 * This provider uses Supabase Presence (not Broadcast) for awareness,
 * since Presence already handles join/leave lifecycle automatically.
 */

import { Awareness } from 'y-protocols/awareness';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface AwarenessUserState {
  /** Unique user identifier */
  userId: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Assigned color for cursor/selection highlight */
  color: string;
  /** Canvas cursor position (null = cursor not on canvas) */
  cursor?: { x: number; y: number } | null;
  /** Currently selected element IDs */
  selection?: string[];
  /** Element ID being actively edited (typing in text field, etc.) */
  editingElementId?: string | null;
  /** Timestamp of last activity */
  lastSeen: number;
}

/**
 * Sets the local user's awareness state.
 * Other peers will receive this via the awareness protocol.
 */
export function setLocalAwareness(
  awareness: Awareness,
  state: Partial<AwarenessUserState>
): void {
  const current = awareness.getLocalState() || {};
  awareness.setLocalStateField('user', {
    ...current.user,
    ...state,
    lastSeen: Date.now(),
  });
}

/**
 * Get all remote users' awareness states (excluding local user).
 */
export function getRemoteAwarenessStates(awareness: Awareness): AwarenessUserState[] {
  const states: AwarenessUserState[] = [];
  const localClientId = awareness.clientID;

  awareness.getStates().forEach((state, clientId) => {
    if (clientId !== localClientId && state.user) {
      states.push(state.user as AwarenessUserState);
    }
  });

  return states;
}

/**
 * Bridges Yjs Awareness with Supabase Presence channel.
 *
 * Flow:
 * - Local awareness change → encode → Supabase Presence track
 * - Remote presence change → decode → update awareness
 */
export class AwarenessPresenceBridge {
  private awareness: Awareness;
  private channel: RealtimeChannel;
  private userId: string;
  private destroyed = false;
  private changeHandler: (changes: { added: number[]; updated: number[]; removed: number[] }) => void;

  constructor(awareness: Awareness, channel: RealtimeChannel, userId: string) {
    this.awareness = awareness;
    this.channel = channel;
    this.userId = userId;

    // Listen for local awareness changes and push to Supabase Presence
    this.changeHandler = ({ added, updated }) => {
      if (this.destroyed) return;
      const localClientId = this.awareness.clientID;

      // Only track changes to the local user
      if (added.includes(localClientId) || updated.includes(localClientId)) {
        const localState = this.awareness.getLocalState();
        if (localState?.user) {
          this.channel.track(localState.user);
        }
      }
    };

    this.awareness.on('change', this.changeHandler);

    // Listen for Supabase Presence events and update remote awareness
    this.channel.on('presence', { event: 'sync' }, () => {
      if (this.destroyed) return;
      // Presence sync gives us the full state — we don't need to do anything
      // because the consumer hook reads from Supabase Presence directly
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.awareness.off('change', this.changeHandler);
  }
}
