"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Crown, Info } from 'lucide-react';
import { useCXDStore } from '@/store/cxd-store';
import { TEMPLATES, TEMPLATE_CATEGORY_LABELS, instantiateTemplate, templateBounds, isTemplateFree, FRAMEWORK_STAGE_LABELS } from '@/lib/templates';
import { FrameworkDetailDialog } from '@/components/cxd/framework-detail-dialog';
import type { TemplateCategory, TemplateDefinition } from '@/lib/templates';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeModal } from '@/components/upgrade-modal';
import { TemplateMiniPreview } from '@/components/cxd/template-mini-preview';
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

type FilterTab = 'all' | TemplateCategory;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'experience', label: 'Experience Design' },
  { key: 'product-brand', label: 'Product & Brand' },
  { key: 'creative', label: 'Creative & General' },
  { key: 'framework', label: 'Frameworks' },
];

export function TemplatePickerModal({ open, onClose }: TemplatePickerModalProps) {
  const addCanvasElements = useCXDStore((s) => s.addCanvasElements);
  const addCanvasEdges = useCXDStore((s) => s.addCanvasEdges);
  const setPendingCanvasFitBounds = useCXDStore((s) => s.setPendingCanvasFitBounds);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [detailTemplate, setDetailTemplate] = useState<TemplateDefinition | null>(null);
  const addProjectFramework = useCXDStore((s) => s.addProjectFramework);

  // Don't let a detail dialog left open when the picker closes reappear on reopen.
  useEffect(() => {
    if (!open) setDetailTemplate(null);
  }, [open]);
  // 'quickstart' (free) or 'full' — the whole catalog stays visible either
  // way; free users just get Pro badges on non-quickstart templates.
  const { templateAccess } = useSubscription();

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeFilter);
  }, [activeFilter]);

  const isLocked = (templateId: string) =>
    templateAccess !== 'full' && !isTemplateFree(templateId);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setDetailTemplate(null);

    if (isLocked(templateId)) {
      setShowUpgrade(true);
      return;
    }

    const { elements, edges } = instantiateTemplate(tpl);

    // Close dialog FIRST so Radix cleans up pointer-events on body,
    // then add elements after dialog unmount completes
    onClose();
    requestAnimationFrame(() => {
      // Blocked by the quota cap: nothing landed, so don't record the framework
      // or the assistant would coach something that isn't on the canvas.
      if (addCanvasElements(elements)) {
        if (edges.length > 0) addCanvasEdges(edges);
        if (tpl.framework) addProjectFramework(tpl.id);
        // Auto-frame the inserted template so the user sees it land instead of
        // hunting for it (consumed once by the canvas's pending-fit effect).
        const bbox = templateBounds(elements);
        if (bbox) setPendingCanvasFitBounds(bbox);
      }
      // Safety: ensure Radix didn't leave pointer-events: none on body
      document.body.style.pointerEvents = '';
    });
  };

  // Frameworks sit under one header in the All view; stage shows as a pill on
  // each card, no sub-grouping, to keep the picker compact.
  const plainTemplates = filtered.filter((t) => t.category !== 'framework');
  const frameworkTemplates = filtered.filter((t) => t.category === 'framework');

  const renderGrid = (list: TemplateDefinition[]) => (
    <div className="grid grid-cols-2 gap-3">
      {list.map((tpl) => {
        const locked = isLocked(tpl.id);
        return (
          <div key={tpl.id} className="relative">
            {tpl.framework && (
              <button
                type="button"
                aria-label={`About ${tpl.name}`}
                title="How this framework works"
                onClick={(e) => { e.stopPropagation(); setDetailTemplate(tpl); }}
                className="absolute top-3 left-3 z-10 w-6 h-6 rounded-full bg-black/60 border border-white/15 text-white/60 hover:text-purple-200 hover:border-purple-400/40 flex items-center justify-center"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSelectTemplate(tpl.id)}
              className={`relative w-full flex flex-col rounded-xl border p-4 text-left transition-all group ${
                locked
                  ? 'border-white/10 bg-white/[0.02] hover:border-amber-400/40 hover:bg-amber-500/5'
                  : 'border-white/10 bg-white/[0.02] hover:border-purple-500/40 hover:bg-purple-500/5'
              }`}
            >
              {locked && (
                <span className="absolute top-3 right-3 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30 text-[10px] font-semibold text-amber-300 uppercase tracking-wide">
                  <Crown className="w-3 h-3" />
                  Pro
                </span>
              )}
              <TemplateMiniPreview template={tpl} />
              <div className="flex items-start gap-3 w-full">
                <span className="text-xl shrink-0">{tpl.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors flex items-center gap-1.5 min-w-0">
                    <span className="truncate">{tpl.name}</span>
                    {tpl.framework && (
                      <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-400/30 text-[9px] font-semibold text-purple-200 uppercase tracking-wide">
                        {FRAMEWORK_STAGE_LABELS[tpl.framework.stage]}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{tpl.description}</p>
                </div>
              </div>
              <span className={`mt-2 text-xs transition-colors self-end ${
                locked
                  ? 'text-amber-400/80 group-hover:text-amber-300'
                  : 'text-purple-400 group-hover:text-purple-300'
              }`}>
                {locked ? 'Upgrade to add' : 'Add →'}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }} modal={false}>
      <DialogContent
        className="bg-zinc-900/95 border-white/10 text-white sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add a Template</DialogTitle>
          <DialogDescription className="text-white/60">
            Choose a scaffold to add to the current canvas
          </DialogDescription>
        </DialogHeader>

        {/* Category filter tabs */}
        <div className="flex gap-1.5 flex-wrap pt-1 pb-2">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                activeFilter === tab.key
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-200'
                  : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white/80 hover:border-white/20'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Template grid */}
        <div className="overflow-y-auto flex-1 -mx-1 px-1 pb-2">
          {plainTemplates.length > 0 && renderGrid(plainTemplates)}
          {frameworkTemplates.length > 0 && (
            <>
              {activeFilter === 'all' && (
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mt-5 mb-3">
                  {TEMPLATE_CATEGORY_LABELS.framework}
                </h3>
              )}
              {renderGrid(frameworkTemplates)}
            </>
          )}
        </div>
      </DialogContent>

      {/* `open && …` unmounts the detail dialog's content whenever the picker
          closes (Esc/X), so it can never be orphaned on screen. */}
      <FrameworkDetailDialog
        template={detailTemplate}
        open={open && detailTemplate !== null}
        onClose={() => setDetailTemplate(null)}
        mode="insert"
        locked={detailTemplate ? isLocked(detailTemplate.id) : false}
        onInsert={() => detailTemplate && handleSelectTemplate(detailTemplate.id)}
        onUpgrade={() => { setDetailTemplate(null); setShowUpgrade(true); }}
      />

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="templates"
      />
    </Dialog>
  );
}
