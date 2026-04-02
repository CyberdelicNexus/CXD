/**
 * Supabase Yjs Provider
 *
 * Implements the y-protocols/sync protocol over Supabase Realtime Broadcast.
 * Handles:
 * - Initial sync (SyncStep1 → SyncStep2 exchange)
 * - Ongoing update propagation
 * - Reconnection with automatic re-sync
 *
 * Message format over Supabase Broadcast:
 *   { msgType: 'sync1' | 'sync2' | 'update', data: base64, sender: userId }
 */

import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { RealtimeChannel } from '@supabase/supabase-js';
import { uint8ArrayToBase64, base64ToUint8Array } from './encoding-utils';

const YJS_SYNC_EVENT = 'yjs_sync';

// Debounce interval for batching local updates (ms)
const UPDATE_DEBOUNCE_MS = 50;

// Supabase Realtime broadcast limit (free tier: 1MB, paid: higher).
// Keep well under to avoid silent drops. Peers that need more than this
// must load the full state from the yjs_state DB column via SupabasePersistence.
const MAX_BROADCAST_BYTES = 900_000; // 900KB

interface YjsSyncMessage {
  msgType: 'sync1' | 'sync2' | 'update';
  data: string; // base64-encoded binary
  sender: string;
}

export class SupabaseYjsProvider {
  private doc: Y.Doc;
  private channel: RealtimeChannel;
  private userId: string;
  private pendingUpdates: Uint8Array[] = [];
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private synced = false;
  private destroyed = false;
  // Tracks peers we've already responded to with our own sync1, to prevent
  // infinite ping-pong loops while still enabling bilateral full-state sync.
  private sentSync1ToPeers = new Set<string>();

  // Track update handler for cleanup
  private updateHandler: (update: Uint8Array, origin: unknown) => void;

  constructor(doc: Y.Doc, channel: RealtimeChannel, userId: string) {
    this.doc = doc;
    this.channel = channel;
    this.userId = userId;

    // Listen for local Y.Doc updates and broadcast them.
    // Only queue user-generated edits — skip persistence loads and initialization
    // hydration which can be 6MB+ and exceed Supabase Realtime's 1MB message limit.
    // New peers load the full state from the yjs_state DB column via SupabasePersistence.
    this.updateHandler = (update: Uint8Array, origin: unknown) => {
      if (this.destroyed) return;
      // Skip remote applies (avoid echo)
      if (origin === 'remote') return;
      // Skip initial hydration from project_data JSON (can be 6MB+)
      if (origin === 'initialization') return;
      // Skip Supabase DB persistence loads
      if (origin === 'persistence') return;
      // Skip IndexedDB persistence (y-indexeddb uses its provider instance as origin)
      if (origin !== null && origin !== undefined && typeof origin === 'object') return;
      this.queueUpdate(update);
    };
    this.doc.on('update', this.updateHandler);

    // Listen for incoming sync messages
    this.channel.on('broadcast', { event: YJS_SYNC_EVENT }, ({ payload }) => {
      if (this.destroyed) return;
      this.handleMessage(payload as YjsSyncMessage);
    });

    // Initiate sync by sending SyncStep1 (our state vector)
    this.sendSyncStep1();
  }

  /**
   * Send SyncStep1: our state vector, requesting the peer's diff.
   */
  private sendSyncStep1(): void {
    const encoder = encoding.createEncoder();
    syncProtocol.writeSyncStep1(encoder, this.doc);
    const data = encoding.toUint8Array(encoder);

    console.log('[YjsProvider] Sending sync1, size:', data.byteLength);

    this.channel.send({
      type: 'broadcast',
      event: YJS_SYNC_EVENT,
      payload: {
        msgType: 'sync1',
        data: uint8ArrayToBase64(data),
        sender: this.userId,
      } satisfies YjsSyncMessage,
    });
  }

  /**
   * Handle an incoming sync message from another peer.
   */
  private handleMessage(msg: YjsSyncMessage): void {
    console.log('[YjsProvider] Received message:', msg.msgType, 'from:', msg.sender);
    // Ignore our own messages
    if (msg.sender === this.userId) {
      console.log('[YjsProvider] Ignoring own message');
      return;
    }

    if (!msg.data || msg.data.length === 0) {
      console.warn('[YjsProvider] Received empty data, ignoring');
      return;
    }

    let data: Uint8Array;
    try {
      data = base64ToUint8Array(msg.data);
      console.log('[YjsProvider] Decoded message, size:', data.byteLength, 'first bytes:', Array.from(data.slice(0, Math.min(10, data.byteLength))));
    } catch (err) {
      console.error('[YjsProvider] Failed to decode base64:', err);
      return;
    }

    // Validate data has minimum expected size
    if (data.byteLength === 0) {
      console.warn('[YjsProvider] Received empty binary data, skipping');
      return;
    }

    // Validate minimum size for Yjs messages (at least a few bytes for message type)
    if (data.byteLength < 2) {
      console.warn('[YjsProvider] Message too small, likely corrupted:', data.byteLength);
      return;
    }

    try {
      switch (msg.msgType) {
        case 'sync1': {
          // Peer is requesting sync — send our SyncStep2 (diff based on their state vector)
          try {
            const decoder = decoding.createDecoder(data);

            // Check if message starts with message type byte (old format compatibility)
            // If first byte is 0 (sync1 message type), skip it
            const firstByte = data[0];
            if (firstByte === 0 && data.byteLength > 1) {
              console.log('[YjsProvider] Detected old format with message type byte, skipping it');
              decoding.readVarUint(decoder); // consume the message type byte
            }

            const encoder = encoding.createEncoder();
            syncProtocol.readSyncStep1(decoder, encoder, this.doc);
            const response = encoding.toUint8Array(encoder);

            // Only send if there's actual content and within size limit.
            // If the response is too large the peer must load from yjs_state DB column.
            if (response.byteLength > 0 && response.byteLength <= MAX_BROADCAST_BYTES) {
              console.log('[YjsProvider] Sending sync2 response, size:', response.byteLength);
              this.channel.send({
                type: 'broadcast',
                event: YJS_SYNC_EVENT,
                payload: {
                  msgType: 'sync2',
                  data: uint8ArrayToBase64(response),
                  sender: this.userId,
                } satisfies YjsSyncMessage,
              });
            } else if (response.byteLength > MAX_BROADCAST_BYTES) {
              console.warn('[YjsProvider] sync2 too large to broadcast (' + response.byteLength + ' bytes). Peer should load from DB (yjs_state column).');
            }

            // Bilateral sync: also send our own sync1 so the peer can respond with
            // any data WE might be missing. Only do this once per peer to prevent
            // an infinite loop (one exchange per peer per session is sufficient).
            if (!this.sentSync1ToPeers.has(msg.sender)) {
              this.sentSync1ToPeers.add(msg.sender);
              console.log('[YjsProvider] Sending sync1 back to', msg.sender, 'for bilateral sync');
              this.sendSyncStep1();
            }
          } catch (err) {
            console.error('[YjsProvider] Failed to process sync1, re-requesting sync:', err);
            // Corrupted sync1 - disable retry to prevent infinite loop
            console.warn('[YjsProvider] Sync1 processing failed, skipping retry to prevent loop');
          }
          break;
        }

        case 'sync2': {
          // Peer sent their diff in response to our SyncStep1
          try {
            console.log('[YjsProvider] Applying sync2 from peer');
            const decoder = decoding.createDecoder(data);

            // Check if message starts with message type byte (old format compatibility)
            const firstByte = data[0];
            if (firstByte === 1 && data.byteLength > 1) {
              console.log('[YjsProvider] Detected old format with message type byte, skipping it');
              decoding.readVarUint(decoder); // consume the message type byte
            }

            syncProtocol.readSyncStep2(decoder, this.doc, 'remote');
            this.synced = true;
            console.log('[YjsProvider] Sync completed, now synced:', this.synced);
          } catch (err) {
            console.error('[YjsProvider] Failed to process sync2:', err);
            // Don't retry to prevent infinite loop
            console.warn('[YjsProvider] Sync2 processing failed, manual refresh may be needed');
          }
          break;
        }

        case 'update': {
          // Peer sent an incremental update
          try {
            let updateData = data;

            // Check if message starts with message type byte (old format compatibility)
            const firstByte = data[0];
            if (firstByte === 2 && data.byteLength > 1) {
              console.log('[YjsProvider] Detected old format with message type byte, extracting update');
              const decoder = decoding.createDecoder(data);
              decoding.readVarUint(decoder); // consume the message type byte
              updateData = decoding.readVarUint8Array(decoder);
            }

            console.log('[YjsProvider] Applying update from peer, size:', updateData.byteLength);
            Y.applyUpdate(this.doc, updateData, 'remote');
          } catch (err) {
            console.error('[YjsProvider] Failed to apply update:', err);
            // Don't auto-retry to prevent spam
            console.warn('[YjsProvider] Update failed, continuing without sync');
          }
          break;
        }
      }
    } catch (err) {
      console.error('[YjsProvider] Error processing message:', msg.msgType, err);
      // Don't auto-retry to prevent infinite loops
      console.warn('[YjsProvider] Message processing failed, manual refresh may be needed');
    }
  }

  /**
   * Queue a local update for debounced broadcast.
   * Batches rapid changes (e.g., drag at 60fps) into fewer messages.
   */
  private queueUpdate(update: Uint8Array): void {
    console.log('[YjsProvider] Queuing update, size:', update.byteLength);
    this.pendingUpdates.push(update);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.flushUpdates();
    }, UPDATE_DEBOUNCE_MS);
  }

  /**
   * Merge and send all pending updates as a single message.
   */
  private flushUpdates(): void {
    if (this.destroyed || this.pendingUpdates.length === 0) return;

    console.log('[YjsProvider] Flushing', this.pendingUpdates.length, 'updates');
    // Merge multiple updates into one
    const merged = Y.mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];
    console.log('[YjsProvider] Broadcasting update, merged size:', merged.byteLength);

    if (merged.byteLength > MAX_BROADCAST_BYTES) {
      console.warn('[YjsProvider] Update too large to broadcast (' + merged.byteLength + ' bytes). Skipping realtime broadcast — peers will sync from DB (yjs_state).');
      return;
    }

    this.channel.send({
      type: 'broadcast',
      event: YJS_SYNC_EVENT,
      payload: {
        msgType: 'update',
        data: uint8ArrayToBase64(merged),
        sender: this.userId,
      } satisfies YjsSyncMessage,
    });
  }

  /**
   * Whether the initial sync handshake has completed.
   */
  get isSynced(): boolean {
    return this.synced;
  }

  /**
   * Clean up listeners and timers.
   */
  destroy(): void {
    this.destroyed = true;
    this.doc.off('update', this.updateHandler);

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Flush any remaining updates before destroying
    if (this.pendingUpdates.length > 0) {
      this.flushUpdates();
    }

    this.pendingUpdates = [];
    this.sentSync1ToPeers.clear();
  }
}
