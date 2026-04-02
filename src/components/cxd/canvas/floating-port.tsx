// src/components/cxd/canvas/floating-port.tsx
"use client";

import React, { useRef, useState, useEffect, useCallback } from 'react';

interface FloatingPortProps {
  elementId: string;
  elementRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;           // element is being dragged — hide port
  isConnecting: boolean;         // a connector draw is in progress globally
  canvasZoom: number;
  isShape?: boolean;             // shapes have + icons at midpoints and resize handles at corners
  isContainer?: boolean;         // containers: corner dead zones only (no midpoints)
  isCollapsed?: boolean;         // collapsed containers: hide port entirely
  isFreeform?: boolean;          // freeform/note cards: corner dead zones to avoid resize handle conflict
  isImage?: boolean;             // images: corner dead zones to avoid resize handle conflict
  onStartConnector: (
    elementId: string,
    anchor: 'top' | 'right' | 'bottom' | 'left',
    anchorOffset: number,
  ) => void;
  onEndConnector: (
    elementId: string,
    anchor: 'top' | 'right' | 'bottom' | 'left',
  ) => void;
}

interface PortState {
  visible: boolean;
  side: 'top' | 'right' | 'bottom' | 'left';
  // Percentage (0–100) along the side
  offset: number;
}

const PROXIMITY_PX = 16;
const MIN_DRAG_PX = 4;

export function FloatingPort({
  elementId,
  elementRef,
  isDragging,
  isConnecting,
  canvasZoom,
  isShape = false,
  isContainer = false,
  isCollapsed = false,
  isFreeform = false,
  isImage = false,
  onStartConnector,
  onEndConnector,
}: FloatingPortProps) {
  const [port, setPort] = useState<PortState>({ visible: false, side: 'top', offset: 50 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragStarted = useRef(false);

  // Compute port position from mouse event relative to element
  const computePort = useCallback((e: MouseEvent): PortState | null => {
    const el = elementRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = e.clientX;
    const cy = e.clientY;

    const dLeft   = cx - rect.left;
    const dRight  = rect.right - cx;
    const dTop    = cy - rect.top;
    const dBottom = rect.bottom - cy;

    // Must be within PROXIMITY_PX of the border (outside OR just inside)
    const nearLeft   = dLeft   >= -PROXIMITY_PX && dLeft   <= PROXIMITY_PX;
    const nearRight  = dRight  >= -PROXIMITY_PX && dRight  <= PROXIMITY_PX;
    const nearTop    = dTop    >= -PROXIMITY_PX && dTop    <= PROXIMITY_PX;
    const nearBottom = dBottom >= -PROXIMITY_PX && dBottom <= PROXIMITY_PX;

    // Must also be roughly within the element's span on the other axis
    const withinH = cx >= rect.left - PROXIMITY_PX && cx <= rect.right + PROXIMITY_PX;
    const withinV = cy >= rect.top - PROXIMITY_PX && cy <= rect.bottom + PROXIMITY_PX;

    if (!((nearLeft || nearRight || nearTop || nearBottom) && (withinH || withinV))) {
      return null;
    }

    // Find closest side
    const closest = Math.min(
      nearLeft && withinV ? dLeft : Infinity,
      nearRight && withinV ? dRight : Infinity,
      nearTop && withinH ? dTop : Infinity,
      nearBottom && withinH ? dBottom : Infinity,
    );

    let side: 'top' | 'right' | 'bottom' | 'left';
    let offset: number;

    if (nearTop && withinH && dTop === closest) {
      side = 'top';
      offset = clamp(((cx - rect.left) / rect.width) * 100, 5, 95);
    } else if (nearBottom && withinH && dBottom === closest) {
      side = 'bottom';
      offset = clamp(((cx - rect.left) / rect.width) * 100, 5, 95);
    } else if (nearLeft && withinV && dLeft === closest) {
      side = 'left';
      offset = clamp(((cy - rect.top) / rect.height) * 100, 5, 95);
    } else if (nearRight && withinV && dRight === closest) {
      side = 'right';
      offset = clamp(((cy - rect.top) / rect.height) * 100, 5, 95);
    } else {
      // Fallback: pick the minimum of all near sides
      if (nearTop && withinH) {
        side = 'top';
        offset = clamp(((cx - rect.left) / rect.width) * 100, 5, 95);
      } else if (nearBottom && withinH) {
        side = 'bottom';
        offset = clamp(((cx - rect.left) / rect.width) * 100, 5, 95);
      } else if (nearLeft && withinV) {
        side = 'left';
        offset = clamp(((cy - rect.top) / rect.height) * 100, 5, 95);
      } else {
        side = 'right';
        offset = clamp(((cy - rect.top) / rect.height) * 100, 5, 95);
      }
    }

    // For shapes: exclude corner zones (resize handles) and midpoint zones (+ buttons)
    if (isShape) {
      const inCorner = offset < 14 || offset > 86;
      const inMidpoint = offset > 38 && offset < 62;
      if (inCorner || inMidpoint) return null;
    }

    // For containers: corner dead zones only (no midpoint dead zones — no + buttons)
    // Hide entirely when collapsed
    if (isContainer) {
      if (isCollapsed) return null;
      const inCorner = offset < 14 || offset > 86;
      if (inCorner) return null;
    }

    // For freeform/note cards: corner dead zones to avoid resize handle conflict
    if (isFreeform) {
      const inCorner = offset < 14 || offset > 86;
      if (inCorner) return null;
    }

    // For images: corner dead zones to avoid resize handle conflict
    if (isImage) {
      const inCorner = offset < 14 || offset > 86;
      if (inCorner) return null;
    }

    return { visible: true, side, offset };
  }, [elementRef, isShape, isContainer, isCollapsed, isFreeform, isImage]);

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    // Listen on the element's parent (the canvas container) to get all mouse moves
    const container = (el.closest('[data-canvas-container]') || el.parentElement) as HTMLElement | null;
    if (!container) return;

    const onMove = (e: MouseEvent) => {
      if (isDragging) { setPort(p => ({ ...p, visible: false })); return; }
      const p = computePort(e);
      setPort(p ?? { visible: false, side: 'top', offset: 50 });
    };

    container.addEventListener('mousemove', onMove);
    return () => container.removeEventListener('mousemove', onMove);
  }, [elementRef, isDragging, computePort]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    e.stopPropagation();
    e.preventDefault();
    dragStart.current = { x: e.clientX, y: e.clientY };
    dragStarted.current = false;

    const anchorAtStart = port.side;
    const offsetAtStart = port.offset / 100;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragStarted.current && dragStart.current) {
        const dx = ev.clientX - dragStart.current.x;
        const dy = ev.clientY - dragStart.current.y;
        if (Math.sqrt(dx * dx + dy * dy) >= MIN_DRAG_PX) {
          dragStarted.current = true;
          onStartConnector(elementId, anchorAtStart, offsetAtStart);
        }
      }
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dragStart.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [isDragging, port, elementId, onStartConnector]);

  const handleMouseUp = useCallback(() => {
    if (isConnecting) {
      onEndConnector(elementId, port.side);
    }
  }, [isConnecting, elementId, port.side, onEndConnector]);

  if (!port.visible || isDragging) return null;

  // Compute CSS position of orb centre on the element border
  let orbStyle: React.CSSProperties = { position: 'absolute', transform: 'translate(-50%, -50%)' };
  switch (port.side) {
    case 'top':    orbStyle = { ...orbStyle, top: 0,      left: `${port.offset}%` }; break;
    case 'bottom': orbStyle = { ...orbStyle, top: '100%', left: `${port.offset}%` }; break;
    case 'left':   orbStyle = { ...orbStyle, left: 0,     top: `${port.offset}%`  }; break;
    case 'right':  orbStyle = { ...orbStyle, left: '100%', top: `${port.offset}%` }; break;
  }

  return (
    <div
      style={{ ...orbStyle, width: 11, height: 11, zIndex: 9999, cursor: 'crosshair', pointerEvents: 'auto' }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <svg width={22} height={22} viewBox="-11 -11 22 22" style={{ overflow: 'visible' }}>
        {/* Outer glow */}
        <circle r={8} fill="rgba(124,58,237,0.18)" style={{ filter: 'blur(3px)' }} />
        {/* Glass body */}
        <defs>
          <radialGradient id={`fp-${elementId}`} cx="35%" cy="30%" r="65%">
            <stop offset="0%"   stopColor="rgba(200,180,255,0.55)" />
            <stop offset="55%"  stopColor="rgba(124,58,237,0.25)" />
            <stop offset="100%" stopColor="rgba(59,7,100,0.12)" />
          </radialGradient>
        </defs>
        <circle r={5.5} fill={`url(#fp-${elementId})`} stroke="rgba(167,139,250,0.65)" strokeWidth={1} />
        {/* Arc highlight */}
        <path d="M -3 -3 Q -1 -5 2 -3" stroke="white" strokeWidth={0.8} fill="none" strokeOpacity={0.4} strokeLinecap="round" />
        {/* Inner dot */}
        <circle r={1.8} fill="#7C3AED" opacity={0.85} />
      </svg>
    </div>
  );
}

// --- helpers ---
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
