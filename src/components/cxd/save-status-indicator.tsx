'use client';

/**
 * Unified save-status indicator for the navbar.
 *
 * Combines status events from both persistence layers (JSON project sync and
 * Yjs binary persistence) plus browser online/offline state into one signal:
 * error > offline > saving > saved. Errors surface immediately — silent save
 * failures were the main cause of "mystery" data loss.
 */

import { useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SAVE_STATUS_EVENT,
  type SaveStatusDetail,
  type SaveSource,
  type SaveStatusKind,
} from '@/lib/save-status';

type CombinedStatus = 'saved' | 'saving' | 'error' | 'offline';

export function SaveStatusIndicator() {
  const sourcesRef = useRef<Record<SaveSource, SaveStatusKind>>({ project: 'saved', yjs: 'saved' });
  const prevStatusRef = useRef<CombinedStatus>('saved');
  const recoveredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<CombinedStatus>('saved');
  const [message, setMessage] = useState<string | null>(null);
  const [showRecovered, setShowRecovered] = useState(false);

  useEffect(() => {
    const compute = (): CombinedStatus => {
      const values = Object.values(sourcesRef.current);
      if (values.includes('error')) return 'error';
      if (!navigator.onLine) return 'offline';
      if (values.includes('saving')) return 'saving';
      return 'saved';
    };

    const update = (detailMessage?: string) => {
      const next = compute();
      const prev = prevStatusRef.current;
      prevStatusRef.current = next;
      setStatus(next);
      setMessage(next === 'error' && detailMessage ? detailMessage : null);

      // Brief explicit "Saved" confirmation when recovering from a bad state
      if (next === 'saved' && (prev === 'error' || prev === 'offline')) {
        setShowRecovered(true);
        if (recoveredTimerRef.current) clearTimeout(recoveredTimerRef.current);
        recoveredTimerRef.current = setTimeout(() => setShowRecovered(false), 3000);
      }
    };

    const handleStatus = (e: Event) => {
      const detail = (e as CustomEvent<SaveStatusDetail>).detail;
      if (!detail?.source || !detail?.status) return;
      sourcesRef.current[detail.source] = detail.status;
      update(detail.message);
    };
    const handleConnectivity = () => update();

    window.addEventListener(SAVE_STATUS_EVENT, handleStatus);
    window.addEventListener('online', handleConnectivity);
    window.addEventListener('offline', handleConnectivity);
    return () => {
      window.removeEventListener(SAVE_STATUS_EVENT, handleStatus);
      window.removeEventListener('online', handleConnectivity);
      window.removeEventListener('offline', handleConnectivity);
      if (recoveredTimerRef.current) clearTimeout(recoveredTimerRef.current);
    };
  }, []);

  if (status === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md bg-rose-500/15 border border-rose-500/30"
        title={message || 'Changes may not be saved. Check your connection.'}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
        <span className="text-xs text-rose-300 whitespace-nowrap">Not saved</span>
      </div>
    );
  }

  if (status === 'offline') {
    return (
      <div
        className="flex items-center gap-1.5 flex-shrink-0 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/30"
        title="You're offline. Changes are stored locally and will sync when you reconnect."
      >
        <CloudOff className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-xs text-amber-300 whitespace-nowrap">Offline</span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 flex-shrink-0 px-1"
      title={status === 'saving' ? 'Saving…' : 'All changes saved'}
    >
      <Cloud
        className={cn(
          'w-3.5 h-3.5 transition-colors',
          status === 'saving' ? 'text-white/50 animate-pulse' : 'text-white/25'
        )}
      />
      {showRecovered && (
        <span className="text-xs text-emerald-300 whitespace-nowrap">Saved</span>
      )}
    </div>
  );
}
