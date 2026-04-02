"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CanvasElement, PRESET_COLORS } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  Group,
  Ungroup,
  Copy,
  Trash2,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Palette,
} from "lucide-react";

// Container tint definitions (mirrored from canvas-element.tsx)
const CONTAINER_TINTS = {
  violet:  { mid: '#7C3AED', light: '#C4B5FD' },
  ocean:   { mid: '#2563EB', light: '#67E8F9' },
  emerald: { mid: '#059669', light: '#6EE7B7' },
  sunset:  { mid: '#EA580C', light: '#FDE68A' },
  rose:    { mid: '#DB2777', light: '#FBCFE8' },
  glacier: { mid: '#475569', light: '#E2E8F0' },
} as const;
const TINT_ORDER = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'] as const;

// Shape solid colors
const SHAPE_SOLID_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#EA580C', '#DB2777',
  '#475569', '#22D3EE', '#F59E0B', '#EF4444', '#8B5CF6',
  '#10B981', '#F97316',
];

interface MultiSelectionBoxProps {
  selectedElements: CanvasElement[];
  canvasZoom: number;
  onUpdateElements: (updates: Map<string, Partial<CanvasElement>>) => void;
  onDeleteElements: () => void;
  onDuplicateElements: () => void;
  onCreateGroup: () => void;
  onUngroup: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onLockElements: () => void;
  onUnlockElements: () => void;
  hasGroup: boolean; // Whether any selected element is part of a group
  allSameGroup: boolean; // Whether all selected elements belong to same group
  isReadOnly?: boolean;
  snapToGrid?: boolean;
  onDragStart?: (e: React.MouseEvent) => void; // Start dragging all selected elements
}

// Grid constants for snapping
const GRID_SIZE = 30;
const MINOR_GRID_SIZE = 15;

export function MultiSelectionBox({
  selectedElements,
  canvasZoom,
  onUpdateElements,
  onDeleteElements,
  onDuplicateElements,
  onCreateGroup,
  onUngroup,
  onBringForward,
  onSendBackward,
  onLockElements,
  onUnlockElements,
  hasGroup,
  allSameGroup,
  isReadOnly = false,
  snapToGrid = true,
  onDragStart,
}: MultiSelectionBoxProps) {
  // Snap function for resize
  const snapValue = useCallback((value: number, useMinorGrid: boolean = false): number => {
    if (!snapToGrid) return value;
    const gridSize = useMinorGrid ? MINOR_GRID_SIZE : GRID_SIZE;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  // Cycling alignment modes: each click cycles to the next mode
  const [hAlignMode, setHAlignMode] = useState<0 | 1 | 2>(0); // 0=left, 1=center, 2=right
  const [vAlignMode, setVAlignMode] = useState<0 | 1 | 2>(0); // 0=top, 1=middle, 2=bottom
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{
    x: number;
    y: number;
    bounds: { minX: number; minY: number; maxX: number; maxY: number };
    elements: Map<string, { x: number; y: number; width: number; height: number }>;
  } | null>(null);
  const [shiftKey, setShiftKey] = useState(false);

  // Track shift key for proportional scaling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftKey(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShiftKey(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Calculate bounding box with padding to separate group handles from element connector anchors
  const GROUP_PADDING = 30; // px of padding between elements and group outline
  const bounds = calculateBounds(selectedElements);
  if (!bounds) return null;

  const minX = bounds.minX - GROUP_PADDING;
  const minY = bounds.minY - GROUP_PADDING;
  const maxX = bounds.maxX + GROUP_PADDING;
  const maxY = bounds.maxY + GROUP_PADDING;
  const width = maxX - minX;
  const height = maxY - minY;

  // Check if all elements are locked
  const allLocked = selectedElements.every((el) => el.locked);
  const someLocked = selectedElements.some((el) => el.locked);

  // Alignment functions
  const alignLeft = useCallback(() => {
    const updates = new Map<string, Partial<CanvasElement>>();
    selectedElements.forEach((el) => {
      updates.set(el.id, { x: minX });
    });
    onUpdateElements(updates);
  }, [selectedElements, minX, onUpdateElements]);

  const alignCenterH = useCallback(() => {
    const centerX = minX + width / 2;
    const updates = new Map<string, Partial<CanvasElement>>();
    selectedElements.forEach((el) => {
      updates.set(el.id, { x: centerX - el.width / 2 });
    });
    onUpdateElements(updates);
  }, [selectedElements, minX, width, onUpdateElements]);

  const alignRight = useCallback(() => {
    const updates = new Map<string, Partial<CanvasElement>>();
    selectedElements.forEach((el) => {
      updates.set(el.id, { x: maxX - el.width });
    });
    onUpdateElements(updates);
  }, [selectedElements, maxX, onUpdateElements]);

  const alignTop = useCallback(() => {
    const updates = new Map<string, Partial<CanvasElement>>();
    selectedElements.forEach((el) => {
      updates.set(el.id, { y: minY });
    });
    onUpdateElements(updates);
  }, [selectedElements, minY, onUpdateElements]);

  const alignMiddle = useCallback(() => {
    const centerY = minY + height / 2;
    const updates = new Map<string, Partial<CanvasElement>>();
    selectedElements.forEach((el) => {
      updates.set(el.id, { y: centerY - el.height / 2 });
    });
    onUpdateElements(updates);
  }, [selectedElements, minY, height, onUpdateElements]);

  const alignBottom = useCallback(() => {
    const updates = new Map<string, Partial<CanvasElement>>();
    selectedElements.forEach((el) => {
      updates.set(el.id, { y: maxY - el.height });
    });
    onUpdateElements(updates);
  }, [selectedElements, maxY, onUpdateElements]);

  // Distribute evenly: place elements sequentially with a fixed 20px gap
  const DISTRIBUTE_GAP = 20;

  const distributeH = useCallback(() => {
    if (selectedElements.length < 2) return;
    const sorted = [...selectedElements].sort((a, b) => a.x - b.x);
    const updates = new Map<string, Partial<CanvasElement>>();
    let currentX = sorted[0].x;
    sorted.forEach((el, i) => {
      updates.set(el.id, { x: currentX });
      currentX += el.width + DISTRIBUTE_GAP;
    });
    onUpdateElements(updates);
  }, [selectedElements, onUpdateElements]);

  const distributeV = useCallback(() => {
    if (selectedElements.length < 2) return;
    const sorted = [...selectedElements].sort((a, b) => a.y - b.y);
    const updates = new Map<string, Partial<CanvasElement>>();
    let currentY = sorted[0].y;
    sorted.forEach((el, i) => {
      updates.set(el.id, { y: currentY });
      currentY += el.height + DISTRIBUTE_GAP;
    });
    onUpdateElements(updates);
  }, [selectedElements, onUpdateElements]);

  // Cycling alignment handlers
  const cycleHAlign = useCallback(() => {
    const mode = hAlignMode;
    if (mode === 0) alignLeft();
    else if (mode === 1) alignCenterH();
    else alignRight();
    setHAlignMode(((mode + 1) % 3) as 0 | 1 | 2);
  }, [hAlignMode, alignLeft, alignCenterH, alignRight]);

  const cycleVAlign = useCallback(() => {
    const mode = vAlignMode;
    if (mode === 0) alignTop();
    else if (mode === 1) alignMiddle();
    else alignBottom();
    setVAlignMode(((mode + 1) % 3) as 0 | 1 | 2);
  }, [vAlignMode, alignTop, alignMiddle, alignBottom]);

  // Handle resize start
  const handleResizeStart = useCallback(
    (e: React.MouseEvent, handle: string) => {
      e.stopPropagation();
      e.preventDefault();

      const elementData = new Map<string, { x: number; y: number; width: number; height: number }>();
      selectedElements.forEach((el) => {
        elementData.set(el.id, { x: el.x, y: el.y, width: el.width, height: el.height });
      });

      setIsResizing(true);
      setResizeHandle(handle);
      // Store bounds WITH padding for visual tracking, but use original element bounds for scaling
      const originalBounds = calculateBounds(selectedElements);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        bounds: originalBounds ? {
          minX: originalBounds.minX,
          minY: originalBounds.minY,
          maxX: originalBounds.maxX,
          maxY: originalBounds.maxY,
        } : { minX, minY, maxX, maxY },
        elements: elementData,
      });
    },
    [selectedElements, minX, minY, maxX, maxY]
  );

  // Handle resize move
  useEffect(() => {
    if (!isResizing || !resizeStart || !resizeHandle) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = (e.clientX - resizeStart.x) / canvasZoom;
      const deltaY = (e.clientY - resizeStart.y) / canvasZoom;

      const oldWidth = resizeStart.bounds.maxX - resizeStart.bounds.minX;
      const oldHeight = resizeStart.bounds.maxY - resizeStart.bounds.minY;

      let newMinX = resizeStart.bounds.minX;
      let newMinY = resizeStart.bounds.minY;
      let newMaxX = resizeStart.bounds.maxX;
      let newMaxY = resizeStart.bounds.maxY;

      // Calculate new bounds based on handle
      if (resizeHandle.includes("e")) newMaxX += deltaX;
      if (resizeHandle.includes("w")) newMinX += deltaX;
      if (resizeHandle.includes("s")) newMaxY += deltaY;
      if (resizeHandle.includes("n")) newMinY += deltaY;

      // Apply grid snapping to bounds (Ctrl key uses minor grid)
      if (snapToGrid) {
        const useMinorGrid = e.ctrlKey;
        if (resizeHandle.includes("e")) newMaxX = snapValue(newMaxX, useMinorGrid);
        if (resizeHandle.includes("w")) newMinX = snapValue(newMinX, useMinorGrid);
        if (resizeHandle.includes("s")) newMaxY = snapValue(newMaxY, useMinorGrid);
        if (resizeHandle.includes("n")) newMinY = snapValue(newMinY, useMinorGrid);
      }

      // Ensure minimum size
      const minSize = 20;
      if (newMaxX - newMinX < minSize) {
        if (resizeHandle.includes("e")) newMaxX = newMinX + minSize;
        else newMinX = newMaxX - minSize;
      }
      if (newMaxY - newMinY < minSize) {
        if (resizeHandle.includes("s")) newMaxY = newMinY + minSize;
        else newMinY = newMaxY - minSize;
      }

      // Proportional scaling with Shift
      if (shiftKey) {
        const newWidth = newMaxX - newMinX;
        const newHeight = newMaxY - newMinY;
        const ratio = oldWidth / oldHeight;

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          const adjustedHeight = newWidth / ratio;
          if (resizeHandle.includes("n")) {
            newMinY = newMaxY - adjustedHeight;
          } else {
            newMaxY = newMinY + adjustedHeight;
          }
        } else {
          const adjustedWidth = newHeight * ratio;
          if (resizeHandle.includes("w")) {
            newMinX = newMaxX - adjustedWidth;
          } else {
            newMaxX = newMinX + adjustedWidth;
          }
        }
      }

      const newWidth = newMaxX - newMinX;
      const newHeight = newMaxY - newMinY;

      const scaleX = newWidth / oldWidth;
      const scaleY = newHeight / oldHeight;

      // Update all elements proportionally
      const updates = new Map<string, Partial<CanvasElement>>();
      resizeStart.elements.forEach((original, id) => {
        // Calculate relative position within original bounds
        const relX = (original.x - resizeStart.bounds.minX) / oldWidth;
        const relY = (original.y - resizeStart.bounds.minY) / oldHeight;
        const relW = original.width / oldWidth;
        const relH = original.height / oldHeight;

        updates.set(id, {
          x: newMinX + relX * newWidth,
          y: newMinY + relY * newHeight,
          width: Math.max(20, relW * newWidth),
          height: Math.max(20, relH * newHeight),
        });
      });

      onUpdateElements(updates);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
      setResizeStart(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeStart, resizeHandle, canvasZoom, shiftKey, onUpdateElements, snapToGrid, snapValue]);

  if (isReadOnly) return null;

  return (
    <>
      {/* Bounding box - allows clicking anywhere inside to drag */}
      <div
        className="absolute cursor-move"
        style={{
          left: minX,
          top: minY,
          width,
          height,
          border: `${Math.max(1.5, 1.5 / canvasZoom)}px dashed hsl(var(--primary) / 0.5)`,
          borderRadius: 8,
          background: "transparent",
        }}
        onMouseDown={(e) => {
          // Only start drag if not clicking on a resize handle
          if (!(e.target as HTMLElement).classList.contains("resize-handle")) {
            onDragStart?.(e);
          }
        }}
      >
        {/* Resize handles */}
        {!allLocked && (
          <>
            {/* Corner handles */}
            <ResizeHandle position="nw" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            <ResizeHandle position="ne" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            <ResizeHandle position="sw" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            <ResizeHandle position="se" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            {/* Edge handles */}
            <ResizeHandle position="n" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            <ResizeHandle position="s" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            <ResizeHandle position="e" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
            <ResizeHandle position="w" onResizeStart={handleResizeStart} canvasZoom={canvasZoom} />
          </>
        )}
      </div>

      {/* Floating toolbar */}
      <div
        className="absolute z-[1000] flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card/95 backdrop-blur-xl border border-border/50 shadow-lg pointer-events-auto"
        style={{
          left: minX + width / 2,
          top: minY - 52,
          transform: `translateX(-50%) scale(${1 / canvasZoom})`,
          transformOrigin: 'center bottom',
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Alignment & Distribution tools */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-border/50">
          {/* Horizontal align — cycles: Left → Center → Right */}
          <ToolButton
            icon={hAlignMode === 0 ? <AlignLeft className="w-4 h-4" /> : hAlignMode === 1 ? <AlignCenter className="w-4 h-4" /> : <AlignRight className="w-4 h-4" />}
            title={hAlignMode === 0 ? "Align Left (click to cycle)" : hAlignMode === 1 ? "Align Center (click to cycle)" : "Align Right (click to cycle)"}
            onClick={cycleHAlign}
          />
          {/* Vertical align — cycles: Top → Middle → Bottom */}
          <ToolButton
            icon={vAlignMode === 0 ? <AlignStartVertical className="w-4 h-4" /> : vAlignMode === 1 ? <AlignCenterVertical className="w-4 h-4" /> : <AlignEndVertical className="w-4 h-4" />}
            title={vAlignMode === 0 ? "Align Top (click to cycle)" : vAlignMode === 1 ? "Align Middle (click to cycle)" : "Align Bottom (click to cycle)"}
            onClick={cycleVAlign}
          />
          {selectedElements.length >= 2 && (
            <>
              <div className="w-px h-4 bg-border/30 mx-0.5" />
              {/* Distribute horizontal spacing evenly */}
              <ToolButton
                icon={<AlignHorizontalSpaceAround className="w-4 h-4" />}
                title="Distribute Horizontal Spacing"
                onClick={distributeH}
              />
              {/* Distribute vertical spacing evenly */}
              <ToolButton
                icon={<AlignVerticalSpaceAround className="w-4 h-4" />}
                title="Distribute Vertical Spacing"
                onClick={distributeV}
              />
            </>
          )}
        </div>

        {/* Color picker — shown when all selected elements share the same type */}
        {(() => {
          const firstType = selectedElements[0]?.type;
          const allSameType = firstType && selectedElements.every((el) => el.type === firstType);
          if (!allSameType) return null;

          const applyColor = (color: string) => {
            const updates = new Map<string, Partial<CanvasElement>>();
            selectedElements.forEach((el) => {
              if (firstType === 'container') {
                updates.set(el.id, { tintColor: color } as Partial<CanvasElement>);
              } else {
                updates.set(el.id, { style: { ...((el as any).style || {}), bgColor: color } });
              }
            });
            onUpdateElements(updates);
          };

          return (
            <div className="relative flex items-center gap-0.5 px-2 border-r border-border/50">
              <ToolButton
                icon={<Palette className="w-4 h-4" />}
                title="Color"
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={showColorPicker ? "bg-primary/20 text-primary" : ""}
              />
              {showColorPicker && (
                <div
                  className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 p-3 rounded-lg bg-card/95 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-[1001] pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {firstType === 'container' ? (
                    /* Container tint swatches */
                    <div className="flex gap-3 px-1">
                      {TINT_ORDER.map((name) => {
                        const c = CONTAINER_TINTS[name];
                        return (
                          <button
                            key={name}
                            title={name.charAt(0).toUpperCase() + name.slice(1)}
                            onClick={() => { applyColor(name); setShowColorPicker(false); }}
                            className="hover:scale-125 transition-transform"
                            style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid})`,
                              border: '2px solid rgba(255,255,255,0.2)',
                              cursor: 'pointer',
                            }}
                          />
                        );
                      })}
                    </div>
                  ) : firstType === 'shape' ? (
                    /* Shape solid color swatches */
                    <div className="flex flex-wrap gap-2 w-[190px]">
                      {SHAPE_SOLID_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => { applyColor(color); setShowColorPicker(false); }}
                          className="w-7 h-7 rounded-md border-2 border-transparent hover:border-white/50 hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Freeform / ExperienceBlock gradient swatches */
                    <div className="grid grid-cols-3 gap-2 w-[220px]">
                      {(PRESET_COLORS as readonly string[]).filter((c) => c !== 'transparent').map((color, i) => (
                        <button
                          key={i}
                          onClick={() => { applyColor(color); setShowColorPicker(false); }}
                          className="h-10 rounded-md border-2 border-border/50 hover:border-white/50 hover:scale-105 transition-all"
                          style={{ background: color }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Group/Ungroup */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
          {allSameGroup && hasGroup ? (
            <button
              onClick={(e) => { e.stopPropagation(); onUngroup(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/20 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-all"
              title="Ungroup"
            >
              <Ungroup className="w-3.5 h-3.5" />
              Ungroup
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onCreateGroup(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white shadow-[0_0_10px_rgba(139,92,246,0.3)] hover:shadow-[0_0_15px_rgba(139,92,246,0.4)] transition-all"
              title="Create Group"
            >
              <Group className="w-3.5 h-3.5" />
              Group
            </button>
          )}
        </div>

        {/* Z-index controls — hidden when only containers are selected (containers always stay at back) */}
        {selectedElements.some((el) => el.type !== 'container') && (
          <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
            <ToolButton icon={<ArrowUp className="w-4 h-4" />} title="Bring Forward" onClick={onBringForward} />
            <ToolButton icon={<ArrowDown className="w-4 h-4" />} title="Send Backward" onClick={onSendBackward} />
          </div>
        )}

        {/* Lock/Unlock */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
          {allLocked ? (
            <ToolButton icon={<Unlock className="w-4 h-4" />} title="Unlock All" onClick={onUnlockElements} />
          ) : (
            <ToolButton icon={<Lock className="w-4 h-4" />} title="Lock All" onClick={onLockElements} />
          )}
        </div>

        {/* Duplicate & Delete */}
        <div className="flex items-center gap-0.5">
          <ToolButton icon={<Copy className="w-4 h-4" />} title="Duplicate" onClick={onDuplicateElements} />
          <ToolButton
            icon={<Trash2 className="w-4 h-4" />}
            title="Delete"
            onClick={onDeleteElements}
            className="hover:bg-destructive/20 hover:text-destructive"
          />
        </div>

        {/* Selection count badge */}
        <div className="ml-2 px-2 py-0.5 text-[10px] bg-primary/20 text-primary rounded-full">
          {selectedElements.length} selected
        </div>
      </div>
    </>
  );
}

// Calculate bounding box for multiple elements
function calculateBounds(elements: CanvasElement[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  if (elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  elements.forEach((el) => {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  });

  return { minX, minY, maxX, maxY };
}

// Resize handle component — constant screen size regardless of zoom
function ResizeHandle({
  position,
  onResizeStart,
  canvasZoom,
}: {
  position: string;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
  canvasZoom: number;
}) {
  // Handle stays 14px on screen at any zoom level
  const screenSize = 14;
  const size = screenSize / canvasZoom;
  const offset = -(size / 2);

  const positionStyles: Record<string, React.CSSProperties> = {
    nw: { top: offset, left: offset, cursor: "nwse-resize" },
    ne: { top: offset, right: offset, cursor: "nesw-resize" },
    sw: { bottom: offset, left: offset, cursor: "nesw-resize" },
    se: { bottom: offset, right: offset, cursor: "nwse-resize" },
    n: { top: offset, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    s: { bottom: offset, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    e: { top: "50%", right: offset, transform: "translateY(-50%)", cursor: "ew-resize" },
    w: { top: "50%", left: offset, transform: "translateY(-50%)", cursor: "ew-resize" },
  };

  return (
    <div
      className="resize-handle absolute bg-primary border-2 border-background rounded-sm pointer-events-auto z-10"
      style={{
        width: size,
        height: size,
        ...positionStyles[position],
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onResizeStart(e, position);
      }}
    />
  );
}

// Toolbar button component
function ToolButton({
  icon,
  title,
  onClick,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
        className
      )}
      title={title}
    >
      {icon}
    </button>
  );
}
