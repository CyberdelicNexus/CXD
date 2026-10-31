import React from 'react';
import { cn } from '@/lib/utils';
import type { TemplateDefinition } from '@/lib/templates';

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
export function TemplateMiniPreview({
  template,
  className = 'w-full h-20 mb-2',
}: {
  template: TemplateDefinition;
  /** Sizing classes for the svg (height in particular). */
  className?: string;
}) {
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
    <svg viewBox={`0 0 ${bw} ${bh}`} className={cn(className)} preserveAspectRatio="xMidYMid meet" aria-hidden>
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
