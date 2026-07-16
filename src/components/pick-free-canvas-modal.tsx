'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Loader2, Lock, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CXDProject } from '@/types/cxd-schema';

interface PickFreeCanvasModalProps {
  open: boolean;
  canvases: CXDProject[];
  onChoose: (canvasId: string) => Promise<void>;
  onUpgrade: () => void;
}

export function PickFreeCanvasModal({
  open,
  canvases,
  onChoose,
  onUpgrade,
}: PickFreeCanvasModalProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null);

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const handleChoose = async (canvasId: string) => {
    if (selectingId) return;
    setSelectingId(canvasId);
    try {
      await onChoose(canvasId);
    } catch (err) {
      console.error('[PickFreeCanvasModal] choose failed:', err);
      setSelectingId(null);
    }
  };

  return createPortal(
    <div
      className="fixed z-[10000] inset-0 flex items-center justify-center bg-black/70 backdrop-blur-md px-4"
      aria-modal="true"
      role="dialog"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-gradient-to-br from-[#2a1a5a] via-[#1a0d3f] to-[#0e0624] border border-violet-500/25 shadow-2xl flex flex-col">
        <div className="px-6 pt-6 pb-4 border-b border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="w-4 h-4 text-violet-300" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-violet-300">
              Free plan
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Choose your editable canvas</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Your Pro subscription has ended. Free accounts include one editable canvas. Pick
            which one stays unlocked. The others move to a read-only overview. You can
            upgrade back to Pro anytime to restore full editing on everything.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {canvases.map((c) => {
              const isSelecting = selectingId === c.id;
              const isDisabled = Boolean(selectingId);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4"
                >
                  <div className="aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-violet-900/50 to-purple-900/30 relative">
                    {(c as unknown as { coverImage?: string }).coverImage ? (
                      <Image
                        src={(c as unknown as { coverImage: string }).coverImage}
                        alt={c.name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <Image
                          src="/images/CXD Logo 2.png"
                          alt=""
                          width={48}
                          height={48}
                          className="opacity-40"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white truncate">{c.name}</h3>
                    <p className="text-xs text-white/40 mt-0.5">
                      Last updated {new Date(c.updatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  <Button
                    onClick={() => handleChoose(c.id)}
                    disabled={isDisabled}
                    className="w-full bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50"
                  >
                    {isSelecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Choosing...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Choose this one
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between gap-4">
          <p className="text-xs text-white/40">
            This choice is permanent. Pick carefully. Others stay read-only.
          </p>
          <button
            onClick={onUpgrade}
            disabled={Boolean(selectingId)}
            className="text-xs text-violet-300 hover:text-violet-100 underline underline-offset-2 disabled:opacity-50"
          >
            Or re-subscribe to Pro
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
