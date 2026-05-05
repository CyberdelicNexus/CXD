'use client';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
}

export function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Delete',
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} modal={false}>
      <DialogContent
        className="max-w-md bg-zinc-900/98 backdrop-blur-xl border border-red-500/20"
        onPointerDownOutside={onClose}
        onInteractOutside={onClose}
      >
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 space-y-3">
            <DialogTitle className="text-lg font-semibold text-white">
              {title}
            </DialogTitle>
            <DialogDescription className="text-sm text-white/60 leading-relaxed">
              {description}
            </DialogDescription>
            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={handleConfirm}
                variant="destructive"
                className="flex-1 bg-red-500/90 hover:bg-red-500 text-white"
              >
                {confirmLabel}
              </Button>
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-white/20 hover:bg-white/5"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
