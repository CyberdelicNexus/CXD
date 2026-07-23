"use client";

import React, { useState, useMemo } from 'react';
import { Crown } from 'lucide-react';
import { useCXDStore } from '@/store/cxd-store';
import { TEMPLATES, TEMPLATE_CATEGORY_LABELS, instantiateTemplate, templateBounds, isTemplateFree } from '@/lib/templates';
import type { TemplateCategory, TemplateDefinition } from '@/lib/templates';
import { useSubscription } from '@/hooks/use-subscription';
import { UpgradeModal } from '@/components/upgrade-modal';
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

/** Per-element-type preview colors — makes each template's shape legible at a glance. */
const PREVIEW_STYLE: Record<string, { fill: string; stroke: string }> = {
  container: { fill: 'rgba(139,92,246,0.12)', stroke: 'rgba(139,92,246,0.40)' },
  board: { fill: 'rgba(236,72,153,0.30)', stroke: 'rgba(236,72,153,0.55)' },
  image: { fill: 'rgba(34,211,238,0.22)', stroke: 'rgba(34,211,238,0.50)' },
  freeform: { fill: 'rgba(167,139,250,0.25)', stroke: 'rgba(167,139,250,0.45)' },
  shape: { fill: 'rgba(52,211,153,0.25)', stroke: 'rgba(52,211,153,0.50)' },
  experienceBlock: { fill: 'rgba(96,165,250,0.30)', stroke: 'rgba(96,165,250,0.60)' },
  table: { fill: 'rgba(249,115,22,0.22)', stroke: 'rgba(249,115,22,0.50)' },
  text: { fill: 'rgba(255,255,255,0.10)', stroke: 'rgba(255,255,255,0.18)' },
};

/**
 * Miniature of the template's ROOT layout. Draws every box-like element (not
 * just containers — several templates are pure node graphs with none) plus its
 * edges, so each entry previews its actual composition. Interior elements
 * (pre-seeded board contents) are excluded; they live in another board's space.
 */
function TemplateMiniPreview({ template }: { template: TemplateDefinition }) {
  const boxes = template.elements.filter(
    (el) => !el.boardId && el.type !== 'line' && el.type !== 'connector' && el.width > 0 && el.height > 0,
  );
  if (boxes.length === 0) return null;

  const minX = Math.min(...boxes.map((c) => c.x));
  const minY = Math.min(...boxes.map((c) => c.y));
  const maxX = Math.max(...boxes.map((c) => c.x + c.width));
  const maxY = Math.max(...boxes.map((c) => c.y + c.height));
  const bw = maxX - minX || 1;
  const bh = maxY - minY || 1;
  const unit = Math.max(bw, bh);

  const byId = new Map(boxes.map((b) => [b.id, b]));
  const center = (id: string) => {
    const b = byId.get(id);
    return b ? { x: b.x - minX + b.width / 2, y: b.y - minY + b.height / 2 } : null;
  };

  return (
    <svg viewBox={`0 0 ${bw} ${bh}`} className="w-full h-20 mb-2" preserveAspectRatio="xMidYMid meet">
      {(template.edges ?? []).map((e) => {
        if (e.boardId) return null;
        const a = center(e.fromNodeId);
        const b = center(e.toNodeId);
        if (!a || !b) return null;
        return (
          <line
            key={e.id}
            x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke="rgba(167,139,250,0.35)"
            strokeWidth={unit * 0.005}
          />
        );
      })}
      {boxes.map((c) => {
        const s = PREVIEW_STYLE[c.type] ?? PREVIEW_STYLE.text;
        return (
          <rect
            key={c.id}
            x={c.x - minX}
            y={c.y - minY}
            width={c.width}
            height={c.height}
            rx={unit * 0.012}
            fill={s.fill}
            stroke={s.stroke}
            strokeWidth={unit * 0.005}
            {...(c.type === 'container'
              ? { strokeDasharray: `${unit * 0.015} ${unit * 0.01}` }
              : {})}
          />
        );
      })}
    </svg>
  );
}

export function TemplatePickerModal({ open, onClose }: TemplatePickerModalProps) {
  const addCanvasElements = useCXDStore((s) => s.addCanvasElements);
  const addCanvasEdges = useCXDStore((s) => s.addCanvasEdges);
  const setPendingCanvasFitBounds = useCXDStore((s) => s.setPendingCanvasFitBounds);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [showUpgrade, setShowUpgrade] = useState(false);
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

    if (isLocked(templateId)) {
      setShowUpgrade(true);
      return;
    }

    const { elements, edges } = instantiateTemplate(tpl);

    // Close dialog FIRST so Radix cleans up pointer-events on body,
    // then add elements after dialog unmount completes
    onClose();
    requestAnimationFrame(() => {
      addCanvasElements(elements);
      if (edges.length > 0) addCanvasEdges(edges);
      // Auto-frame the inserted template so the user sees it land instead of
      // hunting for it (consumed once by the canvas's pending-fit effect).
      const bbox = templateBounds(elements);
      if (bbox) setPendingCanvasFitBounds(bbox);
      // Safety: ensure Radix didn't leave pointer-events: none on body
      document.body.style.pointerEvents = '';
    });
  };

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
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((tpl) => {
              const locked = isLocked(tpl.id);
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl.id)}
                  className={`relative flex flex-col rounded-xl border p-4 text-left transition-all group ${
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
                      <p className="text-sm font-medium text-white group-hover:text-purple-200 transition-colors truncate">
                        {tpl.name}
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
              );
            })}
          </div>
        </div>
      </DialogContent>

      <UpgradeModal
        isOpen={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        feature="templates"
      />
    </Dialog>
  );
}
