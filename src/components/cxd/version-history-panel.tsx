'use client';

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Save, RotateCcw, Trash2, Clock, Loader2, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot, type SnapshotMeta } from '@/lib/yjs/snapshot-service';
import type { Doc } from 'yjs';

interface VersionHistoryPanelProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  yDoc: Doc | null;
  userId?: string;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getLabelColor(label: string): string {
  if (label.startsWith('Manual')) return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
  if (label.startsWith('Pre-load')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  if (label.startsWith('Auto-save')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
  if (label.startsWith('Tab close')) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
  if (label.startsWith('Project switch')) return 'text-green-400 bg-green-500/10 border-green-500/20';
  return 'text-white/40 bg-white/5 border-white/10';
}

function getLabelTag(label: string): string {
  if (label.startsWith('Manual:')) return 'Manual';
  if (label.startsWith('Manual checkpoint')) return 'Manual';
  if (label.startsWith('Pre-load')) return 'Pre-load';
  if (label.startsWith('Auto-save')) return 'Auto';
  if (label.startsWith('Tab close')) return 'Tab close';
  if (label.startsWith('Project switch')) return 'Switch';
  return label;
}

export function VersionHistoryPanel({ open, onClose, projectId, yDoc, userId }: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const fetchSnapshots = useCallback(async () => {
    setLoading(true);
    const data = await listSnapshots(projectId);
    setSnapshots(data);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchSnapshots();
    }
  }, [open, fetchSnapshots]);

  const handleSaveCheckpoint = async () => {
    setSaving(true);
    const label = checkpointLabel.trim()
      ? `Manual: ${checkpointLabel.trim()}`
      : 'Manual checkpoint';
    await createSnapshot(projectId, label, userId);
    setCheckpointLabel('');
    setShowCheckpointInput(false);
    setSaving(false);
    await fetchSnapshots();
  };

  const handleRestore = async (snapshotId: string) => {
    if (!yDoc) return;
    setRestoringId(snapshotId);
    const success = await restoreSnapshot(snapshotId, yDoc);
    setRestoringId(null);
    setConfirmRestoreId(null);
    if (success) {
      onClose();
    }
  };

  const handleDelete = async (snapshotId: string) => {
    await deleteSnapshot(snapshotId);
    setConfirmRestoreId(null);
    await fetchSnapshots();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <>
      {/* Backdrop — click to close */}
      <div
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed z-[9999] inset-0 flex items-center justify-center pointer-events-none"
        aria-modal="true"
        role="dialog"
        aria-label="Version History"
      >
        <div
          className="pointer-events-auto flex flex-col w-full max-w-lg max-h-[80vh] bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 pt-5 pb-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25">
                  <History className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <h2 className="text-base font-semibold text-white">Version History</h2>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-purple-500/20 hover:border-purple-500/40 transition-all"
                  onClick={() => setShowCheckpointInput(!showCheckpointInput)}
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" />
                  Save Checkpoint
                </Button>
                <button
                  onClick={onClose}
                  className="flex items-center justify-center w-8 h-8 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Checkpoint input */}
            {showCheckpointInput && (
              <div className="mt-3 flex gap-2">
                <Input
                  value={checkpointLabel}
                  onChange={(e) => setCheckpointLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveCheckpoint()}
                  placeholder="Label your checkpoint (optional)..."
                  className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500/50"
                  autoFocus
                />
                <Button
                  size="sm"
                  className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-500 shrink-0"
                  onClick={handleSaveCheckpoint}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                </Button>
              </div>
            )}
          </div>

          {/* Snapshot list */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-purple-500/30 [&::-webkit-scrollbar-thumb]:rounded-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                <p className="text-xs text-white/40">Loading snapshots...</p>
              </div>
            ) : snapshots.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-white/10 mb-3">
                  <Clock className="w-5 h-5 text-white/20" />
                </div>
                <p className="text-sm text-white/50 font-medium">No snapshots yet</p>
                <p className="text-xs text-white/25 mt-1.5 leading-relaxed">
                  Snapshots are created automatically as you work — or save a manual checkpoint above.
                </p>
              </div>
            ) : (
              <div className="py-2 px-2">
                {snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className={cn(
                      "group px-3 py-3 rounded-xl mb-1 transition-all border",
                      confirmRestoreId === snap.id
                        ? "bg-amber-500/5 border-amber-500/20"
                        : "hover:bg-white/[0.04] border-transparent hover:border-white/[0.08]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn(
                            "text-[10px] font-medium px-1.5 py-0.5 rounded border",
                            getLabelColor(snap.label)
                          )}>
                            {getLabelTag(snap.label)}
                          </span>
                          {snap.label.startsWith('Manual:') && (
                            <p className="text-xs text-white/70 truncate">
                              {snap.label.replace('Manual: ', '')}
                            </p>
                          )}
                        </div>
                        <p
                          className="text-[11px] text-white/35 mt-1"
                          title={new Date(snap.created_at).toLocaleString()}
                        >
                          {timeAgo(snap.created_at)} · {new Date(snap.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {confirmRestoreId === snap.id ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 px-2.5 text-[11px] bg-amber-600 hover:bg-amber-500 font-medium"
                              onClick={() => handleRestore(snap.id)}
                              disabled={restoringId === snap.id}
                            >
                              {restoringId === snap.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                'Confirm Restore'
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-white/50 hover:text-white hover:bg-white/5"
                              onClick={() => setConfirmRestoreId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-[11px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                              onClick={() => setConfirmRestoreId(snap.id)}
                            >
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-white/20 hover:text-red-400 hover:bg-red-500/10"
                              onClick={() => handleDelete(snap.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {confirmRestoreId === snap.id && (
                      <p className="text-[10px] text-amber-400/70 mt-2 leading-relaxed">
                        This will overwrite the current canvas state for all collaborators. This cannot be undone.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-white/10 flex-shrink-0">
            <p className="text-[10px] text-white/25 text-center">
              Snapshots are stored in Supabase · Up to 20 per project
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
