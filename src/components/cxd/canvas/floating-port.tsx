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
  isBoard?: boolean;             // boards: anchor to hexagon geometry, fixed midpoint positions
  /** Non-rectangular shapes: point on the outline (element-local px) for a side + offset (0..1). */
  outlineAt?: (side: 'top' | 'right' | 'bottom' | 'left', offset: number) => { x: number; y: number } | null;
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
  isBoard = false,
  outlineAt,
  onStartConnector,
  onEndConnector,
}: FloatingPortProps) {
  const [port, setPort] = useState<PortState>({ visible: false, side: 'top', offset: 50 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const dragStarted = useRef(false);

  // Get the effective bounds element (hex for boards, outer element for everything else)
  const getBoundsRect = useCallback(() => {
    const el = elementRef.current;
    if (!el) return null;
    if (isBoard) {
      const boundsEl = el.querySelector('[data-port-bounds]') as HTMLElement | null;
      if (boundsEl) return boundsEl.getBoundingClientRect();
    }
    return el.getBoundingClientRect();
  }, [elementRef, isBoard]);

  // Compute port position from mouse event relative to element
  const computePort = useCallback((e: MouseEvent): PortState | null => {
    const rect = getBoundsRect();
    if (!rect) return null;
    const cx = e.clientX;
    const cy = e.clientY;

    // For boards: use a larger proximity zone since cursor might be inside the outer
    // element rect but far from the hex
    const proximity = isBoard ? 24 : PROXIMITY_PX;

    // Shapes that don't fill their box: the port belongs on the OUTLINE. Offer it
    // on whichever side's outline point is nearest the cursor.
    if (outlineAt && isShape) {
      const z = canvasZoom || 1;
      const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];
      let best: { side: typeof sides[number]; offset: number; d: number } | null = null;
      for (const sd of sides) {
        const horizontalSide = sd === 'left' || sd === 'right';
        const frac = horizontalSide ? (cy - rect.top) / rect.height : (cx - rect.left) / rect.width;
        const pct = clamp(frac * 100, 5, 95);
        const pt = outlineAt(sd, pct / 100);
        if (!pt) continue;
        const d = Math.hypot(cx - (rect.left + pt.x * z), cy - (rect.top + pt.y * z));
        if (d <= PROXIMITY_PX + 6 && (!best || d < best.d)) best = { side: sd, offset: pct, d };
      }
      if (best) {
        // Same dead zones as the box border: + buttons at midpoints, resize handles at corners
        if (best.offset < 14 || best.offset > 86 || (best.offset > 38 && best.offset < 62)) return null;
        return { visible: true, side: best.side, offset: best.offset };
      }
      return null;
    }

    const dLeft   = cx - rect.left;
    const dRight  = rect.right - cx;
    const dTop    = cy - rect.top;
    const dBottom = rect.bottom - cy;

    // Must be within proximity of the border (outside OR just inside)
    const nearLeft   = dLeft   >= -proximity && dLeft   <= proximity;
    const nearRight  = dRight  >= -proximity && dRight  <= proximity;
    const nearTop    = dTop    >= -proximity && dTop    <= proximity;
    const nearBottom = dBottom >= -proximity && dBottom <= proximity;

    // Must also be roughly within the element's span on the other axis
    const withinH = cx >= rect.left - proximity && cx <= rect.right + proximity;
    const withinV = cy >= rect.top - proximity && cy <= rect.bottom + proximity;

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

    // For boards: lock offset to 50% (midpoint) — connectors always attach at hex center edges
    if (isBoard) {
      offset = 50;
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
  }, [getBoundsRect, isBoard, isShape, isContainer, isCollapsed, isFreeform, isImage, outlineAt, canvasZoom]);

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

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (isConnecting) {
      // The canvas also completes a connection on mouseup over a hovered element;
      // letting this bubble created a second edge for the same gesture.
      e.stopPropagation();
      onEndConnector(elementId, port.side);
    }
  }, [isConnecting, elementId, port.side, onEndConnector]);

  if (!port.visible || isDragging) return null;

  // Compute CSS position of orb centre on the element border.
  // If a [data-port-bounds] child exists, offset the orb so it sits on that
  // child's edges rather than the outer element's edges.
  const el = elementRef.current;
  const boundsChild = el?.querySelector('[data-port-bounds]') as HTMLElement | null;

  let orbStyle: React.CSSProperties = { position: 'absolute', transform: 'translate(-50%, -50%)' };

  if (boundsChild && el) {
    // Position in local CSS px relative to the outer element.
    // getBoundingClientRect returns SCREEN px (post-zoom), so divide by canvasZoom
    // to convert back to the element's local coordinate space.
    const outerRect = el.getBoundingClientRect();
    const innerRect = boundsChild.getBoundingClientRect();
    const z = canvasZoom || 1;
    const ox = (innerRect.left - outerRect.left) / z;
    const oy = (innerRect.top - outerRect.top) / z;
    const iw = innerRect.width / z;
    const ih = innerRect.height / z;
    const pct = port.offset / 100;

    // For hex-shaped boards: the polygon doesn't fill the bounding box at the
    // left/right midpoints — it's inset by ~6.7% on each side (1 - sqrt(3)/2)/2.
    // Top/bottom hex points DO reach the bounding box edges.
    // Push the orb OUTWARD past the polygon edge so it sits just outside, not on top.
    const HEX_INSET_X = isBoard ? iw * (1 - Math.sqrt(3) / 2) / 2 : 0;
    const ORB_OUTSET = isBoard ? 8 : 0; // visible orb radius — sits just outside the shape

    switch (port.side) {
      case 'top':    orbStyle = { ...orbStyle, top: oy - ORB_OUTSET,                  left: ox + iw * pct }; break;
      case 'bottom': orbStyle = { ...orbStyle, top: oy + ih + ORB_OUTSET,             left: ox + iw * pct }; break;
      case 'left':   orbStyle = { ...orbStyle, left: ox + HEX_INSET_X - ORB_OUTSET,   top: oy + ih * pct  }; break;
      case 'right':  orbStyle = { ...orbStyle, left: ox + iw - HEX_INSET_X + ORB_OUTSET, top: oy + ih * pct }; break;
    }
  } else if (outlineAt && isShape && outlineAt(port.side, port.offset / 100)) {
    const pt = outlineAt(port.side, port.offset / 100)!;
    orbStyle = { ...orbStyle, left: pt.x, top: pt.y };
  } else {
    switch (port.side) {
      case 'top':    orbStyle = { ...orbStyle, top: 0,      left: `${port.offset}%` }; break;
      case 'bottom': orbStyle = { ...orbStyle, top: '100%', left: `${port.offset}%` }; break;
      case 'left':   orbStyle = { ...orbStyle, left: 0,     top: `${port.offset}%`  }; break;
      case 'right':  orbStyle = { ...orbStyle, left: '100%', top: `${port.offset}%` }; break;
    }
  }

  return (
    <div
      data-connector-port
      style={{ ...orbStyle, width: 22, height: 22, zIndex: 9999, cursor: 'crosshair', pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
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
