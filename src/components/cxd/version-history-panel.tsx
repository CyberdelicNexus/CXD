'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Save, RotateCcw, Trash2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export function VersionHistoryPanel({ open, onClose, projectId, yDoc, userId }: VersionHistoryPanelProps) {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [checkpointLabel, setCheckpointLabel] = useState('');

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
    await fetchSnapshots();
  };

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-[360px] z-[60] flex flex-col bg-black/90 backdrop-blur-xl border-l border-white/10 shadow-2xl animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Version History</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
            onClick={() => setShowCheckpointInput(!showCheckpointInput)}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            Save Checkpoint
          </Button>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Checkpoint input */}
      {showCheckpointInput && (
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex gap-2">
            <Input
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveCheckpoint()}
              placeholder="Label (optional)..."
              className="h-8 text-xs bg-white/5 border-white/10 text-white placeholder:text-white/30"
              autoFocus
            />
            <Button
              size="sm"
              className="h-8 px-3 text-xs bg-purple-600 hover:bg-purple-500"
              onClick={handleSaveCheckpoint}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      )}

      {/* Snapshot list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
          </div>
        ) : snapshots.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <Clock className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm text-white/40">No snapshots yet.</p>
            <p className="text-xs text-white/25 mt-1">Snapshots are created automatically as you work.</p>
          </div>
        ) : (
          <div className="py-2">
            {snapshots.map((snap) => (
              <div
                key={snap.id}
                className="px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/80 truncate">{snap.label}</p>
                    <p className="text-[10px] text-white/40 mt-0.5" title={new Date(snap.created_at).toLocaleString()}>
                      {timeAgo(snap.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    {confirmRestoreId === snap.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] bg-amber-600 hover:bg-amber-500"
                          onClick={() => handleRestore(snap.id)}
                          disabled={restoringId === snap.id}
                        >
                          {restoringId === snap.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Confirm'
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-white/50 hover:text-white"
                          onClick={() => setConfirmRestoreId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                          onClick={() => setConfirmRestoreId(snap.id)}
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-white/30 hover:text-red-400 hover:bg-red-500/10"
                          onClick={() => handleDelete(snap.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {confirmRestoreId === snap.id && (
                  <p className="text-[10px] text-amber-400/80 mt-1.5">
                    This will overwrite the current state for all collaborators.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
