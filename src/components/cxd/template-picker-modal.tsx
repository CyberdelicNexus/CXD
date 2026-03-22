"use client";

import React from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { TEMPLATES } from '@/lib/templates';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
}

export function TemplatePickerModal({ open, onClose }: TemplatePickerModalProps) {
  const addCanvasElement = useCXDStore((s) => s.addCanvasElement);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;

    // Add each element with a fresh ID so there's no collision with existing canvas elements
    tpl.elements.forEach((el) => {
      addCanvasElement({
        ...el,
        id: crypto.randomUUID(),
      });
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a Template</DialogTitle>
          <DialogDescription className="text-white/60">
            Choose a scaffold to add to the current canvas
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 pt-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => handleSelectTemplate(tpl.id)}
              className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:border-purple-500/40 hover:bg-purple-500/5 group"
            >
              <span className="text-2xl">{tpl.emoji}</span>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors">
                  {tpl.name}
                </p>
                <p className="text-xs text-white/50 mt-0.5">{tpl.description}</p>
              </div>
              <span className="ml-auto text-xs text-purple-400 group-hover:text-purple-300 self-center transition-colors">
                Add →
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
