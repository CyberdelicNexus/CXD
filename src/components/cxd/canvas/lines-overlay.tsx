"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { LineElement } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { Minus } from "lucide-react";

interface LinesOverlayProps {
  lines: LineElement[];
  selectedLineId: string | null;
  onSelectLine: (id: string | null) => void;
  onUpdateLine: (id: string, updates: Partial<LineElement>) => void;
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  onDeleteLine: (id: string) => void;
}

type DragHandle = 'start' | 'end' | 'bend' | 'stroke' | null;

export function LinesOverlay({
  lines,
  selectedLineId,
  onSelectLine,
  onUpdateLine,
  canvasPosition,
  canvasZoom,
  onDeleteLine,
}: LinesOverlayProps) {
  const [dragHandle, setDragHandle] = useState<DragHandle>(null);
  const [dragLineId, setDragLineId] = useState<string | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const initialLineRef = useRef<LineElement | null>(null);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      return {
        x: (screenX - canvasPosition.x) / canvasZoom,
        y: (screenY - canvasPosition.y) / canvasZoom,
      };
    },
    [canvasPosition, canvasZoom]
  );

  // Convert world coordinates to screen coordinates
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      return {
        x: worldX * canvasZoom + canvasPosition.x,
        y: worldY * canvasZoom + canvasPosition.y,
      };
    },
    [canvasPosition, canvasZoom]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, lineId: string, handle: DragHandle) => {
      try {
        e.stopPropagation();
        e.preventDefault();

        const target = e.currentTarget as SVGElement;
        if (target && target.setPointerCapture) {
          target.setPointerCapture(e.pointerId);
        }

        const line = lines.find((l) => l.id === lineId);
        if (!line) return;

        setDragHandle(handle);
        setDragLineId(lineId);
        dragStartRef.current = screenToWorld(e.clientX, e.clientY);
        initialLineRef.current = { ...line };

        console.log('[LINE] ' + handle + ' lineId=' + lineId);
      } catch (error) {
        console.error('[LINE] Error in handlePointerDown:', error);
      }
    },
    [lines, screenToWorld]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      try {
        if (!dragHandle || !dragLineId || !dragStartRef.current || !initialLineRef.current) return;

        const currentPoint = screenToWorld(e.clientX, e.clientY);
        const delta = {
          x: currentPoint.x - dragStartRef.current.x,
          y: currentPoint.y - dragStartRef.current.y,
        };

        console.log('[LINE] applying delta dx=' + delta.x.toFixed(1) + ' dy=' + delta.y.toFixed(1));

        const initial = initialLineRef.current;

      if (dragHandle === 'start') {
        onUpdateLine(dragLineId, {
          start: {
            x: initial.start.x + delta.x,
            y: initial.start.y + delta.y,
          },
        });
      } else if (dragHandle === 'end') {
        onUpdateLine(dragLineId, {
          end: {
            x: initial.end.x + delta.x,
            y: initial.end.y + delta.y,
          },
        });
      } else if (dragHandle === 'bend') {
        const initialBend = initial.bend || {
          x: (initial.start.x + initial.end.x) / 2,
          y: (initial.start.y + initial.end.y) / 2,
        };
        onUpdateLine(dragLineId, {
          bend: {
            x: initialBend.x + delta.x,
            y: initialBend.y + delta.y,
          },
        });
      } else if (dragHandle === 'stroke') {
        // Move entire line
        onUpdateLine(dragLineId, {
          start: {
            x: initial.start.x + delta.x,
            y: initial.start.y + delta.y,
          },
          end: {
            x: initial.end.x + delta.x,
            y: initial.end.y + delta.y,
          },
          bend: initial.bend
            ? {
                x: initial.bend.x + delta.x,
                y: initial.bend.y + delta.y,
              }
            : undefined,
        });
      }
      } catch (error) {
        console.error('[LINE] Error in handlePointerMove:', error);
      }
    },
    [dragHandle, dragLineId, onUpdateLine, screenToWorld]
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      try {
        if (!dragHandle) return;

        const target = e.target as SVGElement;
        if (target && target.releasePointerCapture) {
          try {
            target.releasePointerCapture((e as any).pointerId);
          } catch (err) {
            // Ignore pointer capture release errors
          }
        }

        setDragHandle(null);
        setDragLineId(null);
        dragStartRef.current = null;
        initialLineRef.current = null;
      } catch (error) {
        console.error('[LINE] Error in handlePointerUp:', error);
      }
    },
    [dragHandle]
  );

  useEffect(() => {
    if (!dragHandle) return;

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragHandle, handlePointerMove, handlePointerUp]);

  const getStrokeDashArray = (kind?: string) => {
    if (kind === 'dashed') return '10 8';
    if (kind === 'dotted') return '2 8';
    return '';
  };

  return (
    <>
      {/* SVG Overlay for all lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 5 }}
      >
        {lines.map((line) => {
          // Skip lines without new format (legacy data)
          if (!line.start || !line.end) {
            console.warn('[LINE] Skipping legacy line element:', line.id);
            return null;
          }

          const isSelected = line.id === selectedLineId;
          const start = worldToScreen(line.start.x, line.start.y);
          const end = worldToScreen(line.end.x, line.end.y);
          const bend = line.bend
            ? worldToScreen(line.bend.x, line.bend.y)
            : {
                x: (start.x + end.x) / 2,
                y: (start.y + end.y) / 2,
              };

          const color = line.style?.color || 'hsl(180 100% 50% / 0.8)';
          const widthPx = line.style?.widthPx || 2;
          const kind = line.style?.kind || 'solid';

          return (
            <g key={line.id}>
              {/* Invisible thick hit path for selection and stroke dragging */}
              <path
                d={`M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`}
                stroke="transparent"
                strokeWidth={Math.max(12, widthPx * 6)}
                fill="none"
                style={{ pointerEvents: 'stroke', cursor: dragHandle ? 'grabbing' : 'grab' }}
                onPointerDown={(e) => {
                  try {
                    e.stopPropagation();
                    // Select line first
                    if (selectedLineId !== line.id) {
                      onSelectLine(line.id);
                    }
                    // Then start dragging
                    handlePointerDown(e, line.id, 'stroke');
                  } catch (error) {
                    console.error('[LINE] Error in path onPointerDown:', error);
                  }
                }}
              />

              {/* Visible line */}
              <path
                d={`M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`}
                stroke={color}
                strokeWidth={widthPx}
                strokeDasharray={getStrokeDashArray(kind)}
                strokeLinecap="round"
                fill="none"
                style={{ pointerEvents: 'none' }}
              />

              {/* Handles - only when selected */}
              {isSelected && (
                <>
                  {/* Helper lines */}
                  <line
                    x1={start.x}
                    y1={start.y}
                    x2={bend.x}
                    y2={bend.y}
                    stroke="hsl(180 100% 50% / 0.3)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    style={{ pointerEvents: 'none' }}
                  />
                  <line
                    x1={bend.x}
                    y1={bend.y}
                    x2={end.x}
                    y2={end.y}
                    stroke="hsl(180 100% 50% / 0.3)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    style={{ pointerEvents: 'none' }}
                  />

                  {/* Start handle */}
                  <circle
                    cx={start.x}
                    cy={start.y}
                    r="8"
                    fill="white"
                    stroke="hsl(180 100% 50%)"
                    strokeWidth="2"
                    style={{ cursor: 'move', pointerEvents: 'all' }}
                    onPointerDown={(e) => handlePointerDown(e, line.id, 'start')}
                  />

                  {/* End handle */}
                  <circle
                    cx={end.x}
                    cy={end.y}
                    r="8"
                    fill="white"
                    stroke="hsl(180 100% 50%)"
                    strokeWidth="2"
                    style={{ cursor: 'move', pointerEvents: 'all' }}
                    onPointerDown={(e) => handlePointerDown(e, line.id, 'end')}
                  />

                  {/* Bend handle */}
                  <circle
                    cx={bend.x}
                    cy={bend.y}
                    r="8"
                    fill="hsl(280 100% 70% / 0.9)"
                    stroke="white"
                    strokeWidth="2"
                    style={{ cursor: 'move', pointerEvents: 'all' }}
                    onPointerDown={(e) => handlePointerDown(e, line.id, 'bend')}
                  />
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Context Menu for selected line */}
      {selectedLineId && (() => {
        const selectedLine = lines.find((l) => l.id === selectedLineId);
        // Only show menu if line exists and has new format
        if (!selectedLine || !selectedLine.start || !selectedLine.end) return null;

        return (
          <LineContextMenu
            line={selectedLine}
            onUpdateLine={(updates) => onUpdateLine(selectedLineId, updates)}
            onDelete={() => onDeleteLine(selectedLineId)}
            worldToScreen={worldToScreen}
          />
        );
      })()}
    </>
  );
}

// Context menu for line styling
function LineContextMenu({
  line,
  onUpdateLine,
  onDelete,
  worldToScreen,
}: {
  line: LineElement;
  onUpdateLine: (updates: Partial<LineElement>) => void;
  onDelete: () => void;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
}) {
  // Calculate anchor point for menu
  const start = line.start;
  const end = line.end;
  const bend = line.bend || {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };

  // Midpoint along the quadratic curve (t=0.5)
  const t = 0.5;
  const midWorld = {
    x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * bend.x + t * t * end.x,
    y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * bend.y + t * t * end.y,
  };

  const midScreen = worldToScreen(midWorld.x, midWorld.y);

  // Determine menu placement based on line orientation
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const isHorizontal = Math.abs(dx) > Math.abs(dy);

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 100,
    ...(isHorizontal
      ? { top: midScreen.y + 12, left: midScreen.x - 100 }
      : { top: midScreen.y - 30, left: midScreen.x + 12 }),
  };

  console.log('[LINE] menu anchor x=' + midScreen.x.toFixed(1) + ' y=' + midScreen.y.toFixed(1) + ' orientation=' + (isHorizontal ? 'horizontal' : 'vertical'));

  const widthPx = line.style?.widthPx || 2;
  const color = line.style?.color || 'hsl(180 100% 50% / 0.8)';
  const kind = line.style?.kind || 'solid';

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card/95 backdrop-blur border border-border/50 shadow-lg"
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Line style buttons */}
      <button
        onClick={() => {
          try {
            onUpdateLine({ style: { ...line.style, kind: 'solid' } });
          } catch (error) {
            console.error('[LINE] Error updating style:', error);
          }
        }}
        className={cn(
          'p-1.5 rounded hover:bg-primary/20 transition-colors',
          kind === 'solid' && 'bg-primary/30 ring-1 ring-primary'
        )}
        title="Solid"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          try {
            onUpdateLine({ style: { ...line.style, kind: 'dashed' } });
          } catch (error) {
            console.error('[LINE] Error updating style:', error);
          }
        }}
        className={cn(
          'p-1.5 rounded hover:bg-primary/20 transition-colors',
          kind === 'dashed' && 'bg-primary/30 ring-1 ring-primary'
        )}
        title="Dashed"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="12" x2="8" y2="12" strokeDasharray="4 4" />
          <line x1="12" y1="12" x2="20" y2="12" strokeDasharray="4 4" />
        </svg>
      </button>
      <button
        onClick={() => {
          try {
            onUpdateLine({ style: { ...line.style, kind: 'dotted' } });
          } catch (error) {
            console.error('[LINE] Error updating style:', error);
          }
        }}
        className={cn(
          'p-1.5 rounded hover:bg-primary/20 transition-colors',
          kind === 'dotted' && 'bg-primary/30 ring-1 ring-primary'
        )}
        title="Dotted"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="12" x2="20" y2="12" strokeDasharray="1 3" strokeLinecap="round" />
        </svg>
      </button>

      <div className="w-px h-4 bg-border/50 mx-0.5" />

      {/* Width slider */}
      <input
        type="range"
        min="1"
        max="12"
        value={widthPx}
        onChange={(e) => {
          try {
            onUpdateLine({ style: { ...line.style, widthPx: parseInt(e.target.value) } });
          } catch (error) {
            console.error('[LINE] Error updating width:', error);
          }
        }}
        className="w-20 h-1 rounded-full appearance-none bg-muted cursor-pointer"
        title={`Width: ${widthPx}px`}
      />

      <div className="w-px h-4 bg-border/50 mx-0.5" />

      {/* Color input */}
      <input
        type="color"
        value={(() => {
          try {
            return color.match(/#[0-9a-fA-F]{6}/) ? color : '#00ffff';
          } catch {
            return '#00ffff';
          }
        })()}
        onChange={(e) => {
          try {
            onUpdateLine({ style: { ...line.style, color: e.target.value } });
          } catch (error) {
            console.error('[LINE] Error updating color:', error);
          }
        }}
        className="w-6 h-6 rounded cursor-pointer"
        title="Color"
      />

      <div className="w-px h-4 bg-border/50 mx-0.5" />

      {/* Delete button */}
      <button
        onClick={() => {
          try {
            onDelete();
          } catch (error) {
            console.error('[LINE] Error deleting line:', error);
          }
        }}
        className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
        title="Delete"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
