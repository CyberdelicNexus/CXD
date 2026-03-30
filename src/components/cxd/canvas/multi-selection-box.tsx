"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { CanvasElement } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  Group,
  Ungroup,
  Copy,
  Trash2,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

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

  // Calculate bounding box with padding to separate group handles from element handles
  const GROUP_PADDING = 16; // px of padding between elements and group outline
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
          border: "1.5px dashed hsl(var(--primary) / 0.5)",
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
            <ResizeHandle position="nw" onResizeStart={handleResizeStart} />
            <ResizeHandle position="ne" onResizeStart={handleResizeStart} />
            <ResizeHandle position="sw" onResizeStart={handleResizeStart} />
            <ResizeHandle position="se" onResizeStart={handleResizeStart} />
            {/* Edge handles */}
            <ResizeHandle position="n" onResizeStart={handleResizeStart} />
            <ResizeHandle position="s" onResizeStart={handleResizeStart} />
            <ResizeHandle position="e" onResizeStart={handleResizeStart} />
            <ResizeHandle position="w" onResizeStart={handleResizeStart} />
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
        {/* Alignment tools */}
        <div className="flex items-center gap-0.5 pr-2 border-r border-border/50">
          <ToolButton icon={<AlignLeft className="w-4 h-4" />} title="Align Left" onClick={alignLeft} />
          <ToolButton icon={<AlignCenter className="w-4 h-4" />} title="Align Center" onClick={alignCenterH} />
          <ToolButton icon={<AlignRight className="w-4 h-4" />} title="Align Right" onClick={alignRight} />
          <div className="w-px h-4 bg-border/30 mx-1" />
          <ToolButton icon={<AlignHorizontalJustifyStart className="w-4 h-4 rotate-90" />} title="Align Top" onClick={alignTop} />
          <ToolButton icon={<AlignHorizontalJustifyCenter className="w-4 h-4 rotate-90" />} title="Align Middle" onClick={alignMiddle} />
          <ToolButton icon={<AlignHorizontalJustifyEnd className="w-4 h-4 rotate-90" />} title="Align Bottom" onClick={alignBottom} />
        </div>

        {/* Group/Ungroup */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
          {allSameGroup && hasGroup ? (
            <ToolButton
              icon={<Ungroup className="w-4 h-4" />}
              title="Ungroup"
              onClick={onUngroup}
            />
          ) : (
            <ToolButton
              icon={<Group className="w-4 h-4" />}
              title="Create Group"
              onClick={onCreateGroup}
            />
          )}
        </div>

        {/* Z-index controls */}
        <div className="flex items-center gap-0.5 px-2 border-r border-border/50">
          <ToolButton icon={<ArrowUp className="w-4 h-4" />} title="Bring Forward" onClick={onBringForward} />
          <ToolButton icon={<ArrowDown className="w-4 h-4" />} title="Send Backward" onClick={onSendBackward} />
        </div>

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

// Resize handle component
function ResizeHandle({
  position,
  onResizeStart,
}: {
  position: string;
  onResizeStart: (e: React.MouseEvent, handle: string) => void;
}) {
  const positionStyles: Record<string, React.CSSProperties> = {
    nw: { top: -5, left: -5, cursor: "nwse-resize" },
    ne: { top: -5, right: -5, cursor: "nesw-resize" },
    sw: { bottom: -5, left: -5, cursor: "nesw-resize" },
    se: { bottom: -5, right: -5, cursor: "nwse-resize" },
    n: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    s: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "ns-resize" },
    e: { top: "50%", right: -5, transform: "translateY(-50%)", cursor: "ew-resize" },
    w: { top: "50%", left: -5, transform: "translateY(-50%)", cursor: "ew-resize" },
  };

  return (
    <div
      className="resize-handle absolute w-3 h-3 bg-primary border-2 border-background rounded-sm pointer-events-auto z-10"
      style={positionStyles[position]}
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
