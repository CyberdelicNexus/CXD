"use client";

import React, { useState, useMemo } from 'react';
import { useCXDStore } from '@/store/cxd-store';
import { TEMPLATES, TEMPLATE_CATEGORY_LABELS, remapTemplateIds } from '@/lib/templates';
import type { TemplateCategory, TemplateDefinition } from '@/lib/templates';
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
];

/** Small rectangle layout preview for a template */
function TemplateMiniPreview({ template }: { template: TemplateDefinition }) {
  const containers = template.elements.filter((el) => el.type === 'container' && !('containerId' in el && el.containerId));

  if (containers.length === 0) return null;

  // Calculate bounds
  const minX = Math.min(...containers.map((c) => c.x));
  const minY = Math.min(...containers.map((c) => c.y));
  const maxX = Math.max(...containers.map((c) => c.x + c.width));
  const maxY = Math.max(...containers.map((c) => c.y + c.height));
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;

  return (
    <svg viewBox={`0 0 ${bw} ${bh}`} className="w-full h-20 mb-2" preserveAspectRatio="xMidYMid meet">
      {containers.map((c) => (
        <rect
          key={c.id}
          x={c.x - minX}
          y={c.y - minY}
          width={c.width}
          height={c.height}
          rx={6}
          fill="rgba(139,92,246,0.12)"
          stroke="rgba(139,92,246,0.35)"
          strokeWidth={Math.max(bw, bh) * 0.006}
          strokeDasharray={`${Math.max(bw, bh) * 0.015} ${Math.max(bw, bh) * 0.01}`}
        />
      ))}
    </svg>
  );
}

export function TemplatePickerModal({ open, onClose }: TemplatePickerModalProps) {
  const addCanvasElements = useCXDStore((s) => s.addCanvasElements);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  const filtered = useMemo(() => {
    if (activeFilter === 'all') return TEMPLATES;
    return TEMPLATES.filter((t) => t.category === activeFilter);
  }, [activeFilter]);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;

    const freshElements = remapTemplateIds(tpl.elements);
    addCanvasElements(freshElements);

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-zinc-900/95 border-white/10 text-white sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
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
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleSelectTemplate(tpl.id)}
                className="flex flex-col rounded-xl border border-white/10 bg-white/[0.02] p-4 text-left transition-all hover:border-purple-500/40 hover:bg-purple-500/5 group"
              >
                <TemplateMiniPreview template={tpl} />
                <div className="flex items-start gap-3 w-full">
                  <span className="text-xl shrink-0">{tpl.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors truncate">
                      {tpl.name}
                    </p>
                    <p className="text-xs text-white/50 mt-0.5 line-clamp-2">{tpl.description}</p>
                  </div>
                </div>
                <span className="mt-2 text-xs text-purple-400 group-hover:text-purple-300 transition-colors self-end">
                  Add →
                </span>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
