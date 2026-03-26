// src/components/cxd/canvas/connector-radial-menu.tsx
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { GRADIENT_ORDER, type GradientName } from './connector-gradients';
import type { CanvasEdge } from '@/types/canvas-elements';

interface ConnectorRadialMenuProps {
  edge: CanvasEdge;
  midX: number;
  midY: number;
  canvasX: number;
  canvasY: number;
  canvasZoom: number;
  autoExpandColor?: boolean;
  onUpdateEdge: (id: string, style: Partial<NonNullable<CanvasEdge['style']>>) => void;
  onDeleteEdge: (id: string) => void;
  onClose: () => void;
}

const SWATCH_COLORS: Record<GradientName, { mid: string; light: string }> = {
  violet:  { mid: '#7C3AED', light: '#C4B5FD' },
  ocean:   { mid: '#2563EB', light: '#67E8F9' },
  emerald: { mid: '#059669', light: '#6EE7B7' },
  sunset:  { mid: '#EA580C', light: '#FDE68A' },
  rose:    { mid: '#DB2777', light: '#FBCFE8' },
  glacier: { mid: '#475569', light: '#E2E8F0' },
};

const LINE_STYLES = ['solid', 'dashed', 'dotted'] as const;
const ARROW_STYLES = ['none', 'end', 'start', 'both'] as const;

const LINE_ICONS: Record<string, React.ReactNode> = {
  solid:  <svg width="18" height="2" viewBox="0 0 18 2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
  dashed: <svg width="18" height="2" viewBox="0 0 18 2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 2.5" strokeLinecap="round"/></svg>,
  dotted: <svg width="18" height="2" viewBox="0 0 18 2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="1.8" strokeDasharray="1 3" strokeLinecap="round"/></svg>,
};

const ARROW_LABELS: Record<string, string> = {
  none:  '○—○',
  end:   '○—▶',
  start: '◀—○',
  both:  '◀—▶',
};

export function ConnectorRadialMenu({
  edge,
  midX, midY,
  canvasX, canvasY, canvasZoom,
  autoExpandColor = false,
  onUpdateEdge,
  onDeleteEdge,
  onClose,
}: ConnectorRadialMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [colorExpanded, setColorExpanded] = useState(autoExpandColor);

  const screenX = canvasX + midX * canvasZoom;
  const screenY = canvasY + midY * canvasZoom;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [onClose]);

  const currentGrad = (edge.style?.gradientName ?? 'violet') as GradientName;
  const currentLine = edge.style?.lineStyle ?? 'solid';
  const currentArrow = (edge.style?.arrowStyle ?? 'end') as typeof ARROW_STYLES[number];

  const cycleLineStyle = () => {
    const idx = LINE_STYLES.indexOf(currentLine as typeof LINE_STYLES[number]);
    const next = LINE_STYLES[(idx + 1) % LINE_STYLES.length];
    onUpdateEdge(edge.id, { lineStyle: next });
  };

  const cycleArrowStyle = () => {
    const idx = ARROW_STYLES.indexOf(currentArrow);
    const next = ARROW_STYLES[(idx + 1) % ARROW_STYLES.length];
    onUpdateEdge(edge.id, { arrowStyle: next });
  };

  const btnBase = "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 border backdrop-blur-sm";
  const btnNormal = "bg-[rgba(15,12,25,0.92)] border-[rgba(255,255,255,0.12)] text-white/60 hover:bg-[rgba(35,28,55,0.97)] hover:text-white/90 hover:border-[rgba(255,255,255,0.2)]";

  return (
    <div
      ref={ref}
      className="fixed pointer-events-auto"
      style={{ left: screenX, top: screenY, transform: 'translate(-50%, -50%)', zIndex: 9999 }}
    >
      {/* Top arm — color */}
      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
        {/* Swatch submenu — only appears when colorExpanded */}
        {colorExpanded && (
          <div className="flex gap-1.5 bg-[rgba(15,12,25,0.95)] rounded-full px-2.5 py-2 border border-[rgba(255,255,255,0.1)] backdrop-blur-sm shadow-lg">
            {GRADIENT_ORDER.map((name) => {
              const c = SWATCH_COLORS[name];
              const isActive = currentGrad === name;
              return (
                <button
                  key={name}
                  title={name}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-115 focus:outline-none flex-shrink-0"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid})`,
                    outline: isActive ? '2px solid rgba(255,255,255,0.9)' : 'none',
                    outlineOffset: 2,
                    boxShadow: isActive ? `0 0 8px ${c.mid}88` : 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdateEdge(edge.id, { gradientName: name });
                  }}
                />
              );
            })}
          </div>
        )}
        {/* Color toggle button */}
        <button
          className={`${btnBase} ${btnNormal}`}
          title="Color"
          onClick={(e) => { e.stopPropagation(); setColorExpanded(v => !v); }}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            background: colorExpanded
              ? `radial-gradient(circle at 35% 30%, ${SWATCH_COLORS[currentGrad].light}33, ${SWATCH_COLORS[currentGrad].mid}22)`
              : undefined,
            borderColor: colorExpanded
              ? `${SWATCH_COLORS[currentGrad].mid}66`
              : undefined,
          }}
        >
          <span
            className="w-4 h-4 rounded-full block flex-shrink-0"
            style={{ background: `radial-gradient(circle at 35% 30%, ${SWATCH_COLORS[currentGrad].light}, ${SWATCH_COLORS[currentGrad].mid})` }}
          />
        </button>
      </div>

      {/* Right arm — line style (cycles on click) */}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2">
        <button
          className={`${btnBase} ${btnNormal} text-white/70`}
          title={`Line style: ${currentLine} (click to cycle)`}
          onClick={(e) => { e.stopPropagation(); cycleLineStyle(); }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {LINE_ICONS[currentLine]}
        </button>
      </div>

      {/* Bottom arm — arrow style (cycles on click) */}
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2">
        <button
          className={`${btnBase} ${btnNormal} text-[10px] font-mono tracking-tight`}
          title={`Arrow: ${currentArrow} (click to cycle)`}
          onClick={(e) => { e.stopPropagation(); cycleArrowStyle(); }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {ARROW_LABELS[currentArrow]}
        </button>
      </div>

      {/* Left arm — delete */}
      <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2">
        <button
          className={`${btnBase} bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.22)] text-red-400/70 hover:bg-[rgba(239,68,68,0.18)] hover:text-red-400`}
          title="Delete connector"
          onClick={(e) => { e.stopPropagation(); onDeleteEdge(edge.id); onClose(); }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      {/* Center dot */}
      <div className="w-2.5 h-2.5 rounded-full bg-[rgba(124,58,237,0.5)] border border-[rgba(167,139,250,0.6)]" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
    </div>
  );
}
