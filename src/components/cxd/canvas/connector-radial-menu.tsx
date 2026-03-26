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

// Ring constants
const RING_R = 78;   // px radius of the outer thickness ring
const RING_PAD = 10; // px padding around the ring for the SVG
const MIN_T = 1;
const MAX_T = 8;

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
  const [thicknessExpanded, setThicknessExpanded] = useState(false);
  const [ringHovered, setRingHovered] = useState(false);

  const screenX = canvasX + midX * canvasZoom;
  const screenY = canvasY + midY * canvasZoom;

  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
  }, [onClose]);

  const currentGrad = (edge.style?.gradientName ?? 'violet') as GradientName;
  const currentLine = edge.style?.lineStyle ?? 'solid';
  const currentArrow = (edge.style?.arrowStyle ?? 'end') as typeof ARROW_STYLES[number];
  const currentThickness = Math.max(MIN_T, Math.min(MAX_T, edge.style?.thickness ?? 2));

  const cycleLineStyle = () => {
    const idx = LINE_STYLES.indexOf(currentLine as typeof LINE_STYLES[number]);
    onUpdateEdge(edge.id, { lineStyle: LINE_STYLES[(idx + 1) % LINE_STYLES.length] });
  };

  const cycleArrowStyle = () => {
    const idx = ARROW_STYLES.indexOf(currentArrow);
    onUpdateEdge(edge.id, { arrowStyle: ARROW_STYLES[(idx + 1) % ARROW_STYLES.length] });
  };

  // Thickness ring math
  // Angle starts at top (-π/2) and goes clockwise for increasing thickness
  const tAngle = -Math.PI / 2 + ((currentThickness - MIN_T) / (MAX_T - MIN_T)) * 2 * Math.PI;
  const svgSize = (RING_R + RING_PAD) * 2;
  const svgCx = RING_R + RING_PAD;
  const svgCy = RING_R + RING_PAD;
  const nodeX = svgCx + Math.cos(tAngle) * RING_R;
  const nodeY = svgCy + Math.sin(tAngle) * RING_R;
  const gradColor = SWATCH_COLORS[currentGrad];

  const angleToThickness = (angle: number): number => {
    // Normalize to [0, 2π] starting from top (-π/2)
    let norm = angle + Math.PI / 2;
    if (norm < 0) norm += 2 * Math.PI;
    norm = norm % (2 * Math.PI);
    return Math.max(MIN_T, Math.min(MAX_T, Math.round(MIN_T + (norm / (2 * Math.PI)) * (MAX_T - MIN_T))));
  };

  const getAngleFromEvent = (clientX: number, clientY: number): number => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    // rect for a 0×0 element is exactly at center point
    return Math.atan2(clientY - rect.top, clientX - rect.left);
  };

  const handleNodeDrag = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (mv: MouseEvent) => {
      onUpdateEdge(edge.id, { thickness: angleToThickness(getAngleFromEvent(mv.clientX, mv.clientY)) });
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const handleRingClick = (e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    onUpdateEdge(edge.id, { thickness: angleToThickness(getAngleFromEvent(e.clientX, e.clientY)) });
  };

  const btnBase = "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 border backdrop-blur-sm";
  const btnNormal = "bg-[rgba(15,12,25,0.92)] border-[rgba(255,255,255,0.12)] text-white/60 hover:bg-[rgba(35,28,55,0.97)] hover:text-white/90 hover:border-[rgba(255,255,255,0.2)]";

  return (
    <>
      {/* Backdrop: captures outside clicks to close menu */}
      <div
        className="absolute inset-0 pointer-events-auto"
        style={{ zIndex: 9998 }}
        onMouseDown={(e) => { e.stopPropagation(); onClose(); }}
      />
      <div
        ref={ref}
        className="absolute pointer-events-auto"
        style={{ left: screenX, top: screenY, transform: 'translate(-50%, -50%)', zIndex: 9999 }}
      >

        {/* Thickness ring — SVG layer rendered behind all arms */}
        {thicknessExpanded && (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: -(RING_R + RING_PAD),
              top: -(RING_R + RING_PAD),
              width: svgSize,
              height: svgSize,
              overflow: 'visible',
            }}
          >
            {/* Ring track — interactive */}
            <circle
              cx={svgCx}
              cy={svgCy}
              r={RING_R}
              fill="none"
              stroke={gradColor.mid}
              strokeWidth={ringHovered ? 2.5 : 1.5}
              strokeOpacity={ringHovered ? 0.65 : 0.22}
              style={{
                pointerEvents: 'auto',
                cursor: 'crosshair',
                transition: 'stroke-opacity 0.12s, stroke-width 0.12s',
              }}
              onMouseEnter={() => setRingHovered(true)}
              onMouseLeave={() => setRingHovered(false)}
              onClick={handleRingClick}
            />
            {/* Subtle ring fill glow on hover */}
            {ringHovered && (
              <circle
                cx={svgCx}
                cy={svgCy}
                r={RING_R}
                fill="none"
                stroke={gradColor.light}
                strokeWidth={8}
                strokeOpacity={0.06}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Draggable node on ring */}
            <g
              style={{ pointerEvents: 'auto', cursor: 'grab' }}
              onMouseDown={handleNodeDrag}
            >
              {/* Glow */}
              <circle
                cx={nodeX}
                cy={nodeY}
                r={9}
                fill={gradColor.mid}
                opacity={0.2}
                style={{ pointerEvents: 'none' }}
              />
              {/* Body */}
              <circle
                cx={nodeX}
                cy={nodeY}
                r={5.5}
                fill={gradColor.mid}
                opacity={0.9}
                stroke={gradColor.light}
                strokeWidth={1}
                strokeOpacity={0.7}
              />
              {/* Inner highlight */}
              <circle
                cx={nodeX - 1.5}
                cy={nodeY - 1.5}
                r={1.5}
                fill="white"
                opacity={0.4}
                style={{ pointerEvents: 'none' }}
              />
            </g>
            {/* Thickness value label — shown near center bottom */}
            <text
              x={svgCx}
              y={svgCy + 18}
              textAnchor="middle"
              fill={gradColor.mid}
              fontSize={9}
              opacity={0.55}
              style={{ fontFamily: 'monospace', userSelect: 'none', pointerEvents: 'none' }}
            >
              {currentThickness}px
            </text>
          </svg>
        )}

        {/* Top arm — color */}
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
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
                    onClick={(e) => { e.stopPropagation(); onUpdateEdge(edge.id, { gradientName: name }); }}
                  />
                );
              })}
            </div>
          )}
          <button
            className={`${btnBase} ${btnNormal}`}
            title="Color"
            onClick={(e) => { e.stopPropagation(); setColorExpanded(v => !v); }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              background: colorExpanded
                ? `radial-gradient(circle at 35% 30%, ${gradColor.light}33, ${gradColor.mid}22)`
                : undefined,
              borderColor: colorExpanded ? `${gradColor.mid}66` : undefined,
            }}
          >
            <span
              className="w-4 h-4 rounded-full block flex-shrink-0"
              style={{ background: `radial-gradient(circle at 35% 30%, ${gradColor.light}, ${gradColor.mid})` }}
            />
          </button>
        </div>

        {/* Right arm — line style */}
        <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2">
          <button
            className={`${btnBase} ${btnNormal} text-white/70`}
            title={`Line style: ${currentLine} (click to cycle)`}
            onClick={(e) => { e.stopPropagation(); cycleLineStyle(); }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {LINE_ICONS[currentLine]}
          </button>
        </div>

        {/* Bottom arm — arrow style */}
        <div className="absolute top-full mt-3 left-1/2 -translate-x-1/2">
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
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2">
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

        {/* Center button — toggles thickness ring */}
        <button
          className="absolute rounded-full flex items-center justify-center transition-all duration-150 pointer-events-auto"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 16,
            height: 16,
            background: thicknessExpanded
              ? `radial-gradient(circle at 35% 30%, ${gradColor.light}55, ${gradColor.mid}44)`
              : `rgba(20, 15, 40, 0.85)`,
            border: `1.5px solid ${thicknessExpanded ? gradColor.mid + 'cc' : gradColor.mid + '88'}`,
            boxShadow: thicknessExpanded ? `0 0 10px ${gradColor.mid}55` : `0 0 4px ${gradColor.mid}33`,
            zIndex: 1,
          }}
          title={thicknessExpanded ? `Thickness: ${currentThickness}px (drag node to adjust)` : 'Adjust thickness'}
          onClick={(e) => { e.stopPropagation(); setThicknessExpanded(v => !v); }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: gradColor.mid,
              opacity: 0.9,
            }}
          />
        </button>

      </div>
    </>
  );
}
