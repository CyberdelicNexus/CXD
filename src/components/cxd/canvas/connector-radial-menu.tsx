// src/components/cxd/canvas/connector-radial-menu.tsx
"use client";

import React, { useEffect, useRef } from 'react';
import { GRADIENT_ORDER, type GradientName } from './connector-gradients';
import type { CanvasEdge } from '@/types/canvas-elements';

interface ConnectorRadialMenuProps {
  edge: CanvasEdge;
  // Canvas-space midpoint (world coordinates)
  midX: number;
  midY: number;
  // Canvas transform (to position menu in screen space)
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

  // Screen-space position of the midpoint
  const screenX = canvasX + midX * canvasZoom;
  const screenY = canvasY + midY * canvasZoom;

  // Close on outside click or Escape
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
  const currentArrow = edge.style?.arrowStyle ?? 'end';

  const btnBase = "w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all duration-150 border";
  const btnNormal = "bg-[rgba(20,18,30,0.95)] border-[rgba(255,255,255,0.12)] text-white/60 hover:bg-[rgba(40,36,60,0.97)] hover:text-white/90";
  const btnActive = "bg-[rgba(124,58,237,0.2)] border-[rgba(167,139,250,0.35)] text-white";

  return (
    <div
      ref={ref}
      className="fixed z-[9999] pointer-events-auto"
      style={{ left: screenX, top: screenY, transform: 'translate(-50%, -50%)' }}
    >
      {/* Top arm — color swatches */}
      <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
        {autoExpandColor && (
          <div className="flex gap-1.5 bg-[rgba(20,18,30,0.97)] rounded-full px-2 py-1.5 border border-[rgba(255,255,255,0.1)]">
            {GRADIENT_ORDER.map((name) => {
              const c = SWATCH_COLORS[name];
              return (
                <button
                  key={name}
                  title={name}
                  className="w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid})`,
                    outline: currentGrad === name ? '2px solid white' : 'none',
                    outlineOffset: 1,
                  }}
                  onClick={() => { onUpdateEdge(edge.id, { gradientName: name }); }}
                />
              );
            })}
          </div>
        )}
        {/* Color icon button (always shown in top arm) */}
        <button
          className={`${btnBase} w-8 h-8`}
          title="Color"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${SWATCH_COLORS[currentGrad].light}44, ${SWATCH_COLORS[currentGrad].mid}44)`,
            border: `1px solid ${SWATCH_COLORS[currentGrad].mid}66`,
          }}
          onClick={(e) => { e.stopPropagation(); }}
          onMouseDown={(e) => { e.stopPropagation(); }}
        >
          <span
            className="w-3.5 h-3.5 rounded-full block"
            style={{ background: `radial-gradient(circle at 35% 30%, ${SWATCH_COLORS[currentGrad].light}, ${SWATCH_COLORS[currentGrad].mid})` }}
          />
        </button>
      </div>

      {/* Right arm — line style */}
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 flex gap-1">
        {(['solid', 'dashed', 'dotted'] as const).map((style) => (
          <button
            key={style}
            title={style}
            className={`${btnBase} ${currentLine === style ? btnActive : btnNormal}`}
            onClick={() => onUpdateEdge(edge.id, { lineStyle: style })}
          >
            <svg width="14" height="2" viewBox="0 0 14 2">
              <line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="1.5"
                strokeDasharray={style === 'dashed' ? '4 2' : style === 'dotted' ? '1 3' : undefined}
                strokeLinecap="round" />
            </svg>
          </button>
        ))}
      </div>

      {/* Bottom arm — arrow style */}
      <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2 flex gap-1">
        {([
          { value: 'none', label: '○—○' },
          { value: 'end',  label: '○—▶' },
          { value: 'both', label: '◀—▶' },
        ] as const).map(({ value, label }) => (
          <button
            key={value}
            title={value}
            className={`${btnBase} ${currentArrow === value ? btnActive : btnNormal} text-[10px] px-1`}
            onClick={() => onUpdateEdge(edge.id, { arrowStyle: value })}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Left arm — delete */}
      <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2">
        <button
          className={`${btnBase} bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.25)] text-red-400 hover:bg-[rgba(239,68,68,0.2)]`}
          title="Delete connector"
          onClick={() => { onDeleteEdge(edge.id); onClose(); }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      {/* Center anchor point */}
      <div className="w-3 h-3 rounded-full bg-[rgba(124,58,237,0.4)] border border-[rgba(167,139,250,0.5)]" />
    </div>
  );
}
