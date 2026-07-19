"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { LineElement, LineEndStyle } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { Trash2, Copy, Minus, Circle, ArrowRight, Square, Diamond } from "lucide-react";

type LineGradientName = 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';

const LINE_GRADIENT_ORDER: LineGradientName[] = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'];

const LINE_GRADIENT_COLORS: Record<LineGradientName, { mid: string; light: string }> = {
  violet:  { mid: '#7C3AED', light: '#C4B5FD' },
  ocean:   { mid: '#2563EB', light: '#67E8F9' },
  emerald: { mid: '#059669', light: '#6EE7B7' },
  sunset:  { mid: '#EA580C', light: '#FDE68A' },
  rose:    { mid: '#DB2777', light: '#FBCFE8' },
  glacier: { mid: '#475569', light: '#E2E8F0' },
};

// Line interaction mode state machine
type LineMode =
  | "idle"
  | "drawingLine" // Creating a new line (start fixed, end follows pointer)
  | "draggingHandle" // Dragging start/end/bend handle
  | "draggingLine"; // Moving the entire line

type HandleType = "start" | "end" | "bend" | null;

interface LineDraft {
  start: { x: number; y: number };
  end: { x: number; y: number };
  bend: { x: number; y: number };
}

interface LineLayerProps {
  lines: LineElement[];
  selectedLineId: string | null;
  selectedLineIds?: Set<string>; // Lines that are part of a multi-selection
  onSelectLine: (id: string | null, e?: React.PointerEvent | React.MouseEvent) => void;
  onUpdateLine: (id: string, updates: Partial<LineElement>) => void;
  onCreateLine: (
    line: Omit<LineElement, "id" | "zIndex" | "boardId" | "surface">,
  ) => void;
  // Called once when a stroke/handle drag finishes so the canvas can re-run
  // container auto-attach/detach (set or clear containerId) and resync the line's
  // stored bounding box. Drag-END only — never per pointer-move frame.
  onLineDragCommit?: (lineId: string) => void;
  // Called per pointer-move frame WHILE a line is being dragged (whole-line or handle)
  // with the dragged line's id, and once with null when the drag ends or is cancelled.
  // The canvas uses it to highlight the container the line currently hovers over (the
  // same drop-target animation elements show), so a line dragged toward a container
  // previews where it will attach. Only React state is touched — never the store.
  onLineDragHover?: (lineId: string | null) => void;
  onDeleteLine: (id: string) => void;
  onDuplicateLine?: (line: LineElement) => void;
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  isLineToolActive: boolean;
  onLineToolComplete: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  onOperationStart?: () => void; // Called before starting drag operations for undo support
  isPanMode?: boolean; // When true (spacebar held or middle-mouse), line interactions are disabled for panning
}

export function LineLayer({
  lines,
  selectedLineId,
  selectedLineIds = new Set(),
  onSelectLine,
  onUpdateLine,
  onCreateLine,
  onLineDragCommit,
  onLineDragHover,
  onDeleteLine,
  onDuplicateLine,
  canvasPosition,
  canvasZoom,
  isLineToolActive,
  onLineToolComplete,
  containerRef,
  onOperationStart,
  isPanMode = false,
}: LineLayerProps) {
  // State machine
  const [mode, setMode] = useState<LineMode>("idle");
  const [activeHandle, setActiveHandle] = useState<HandleType>(null);
  const [activeLineId, setActiveLineId] = useState<string | null>(null);

  // Line draft for creation
  const [lineDraft, setLineDraft] = useState<LineDraft | null>(null);

  // Refs for drag operations
  const dragStartWorld = useRef<{ x: number; y: number } | null>(null);
  const initialLineState = useRef<LineElement | null>(null);

  // SVG ref
  const svgRef = useRef<SVGSVGElement>(null);

  // Convert screen coordinates to world coordinates
  const screenToWorld = useCallback(
    (screenX: number, screenY: number): { x: number; y: number } => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: (screenX - rect.left - canvasPosition.x) / canvasZoom,
        y: (screenY - rect.top - canvasPosition.y) / canvasZoom,
      };
    },
    [canvasPosition, canvasZoom, containerRef],
  );

  // Convert world coordinates to screen coordinates (relative to container)
  const worldToScreen = useCallback(
    (worldX: number, worldY: number): { x: number; y: number } => {
      return {
        x: worldX * canvasZoom + canvasPosition.x,
        y: worldY * canvasZoom + canvasPosition.y,
      };
    },
    [canvasPosition, canvasZoom],
  );

  // Handle ESC key to cancel operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mode === "drawingLine") {
          setLineDraft(null);
          setMode("idle");
          onLineToolComplete();
        } else if (mode === "draggingHandle" || mode === "draggingLine") {
          // Cancel drag - restore initial state
          if (initialLineState.current && activeLineId) {
            onUpdateLine(activeLineId, {
              start: initialLineState.current.start,
              end: initialLineState.current.end,
              bend: initialLineState.current.bend,
            });
          }
          onLineDragHover?.(null);
          setMode("idle");
          setActiveHandle(null);
          setActiveLineId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, activeLineId, onUpdateLine, onLineToolComplete, onLineDragHover]);

  // Handle line tool activation - enter drawing mode on canvas click
  useEffect(() => {
    if (!isLineToolActive || !containerRef.current) return;

    // If we're already in a drawing state, don't interfere
    if (mode !== "idle" && mode !== "drawingLine") return;

    const container = containerRef.current;

    const handlePointerDown = (e: PointerEvent) => {
      // Only the left button starts a draw.
      if (e.button !== 0) return;

      // A press on a connector port orb belongs to the FloatingPort
      // connector-drag flow — leave it alone so connectors can still be drawn
      // from an element's port even while the line tool is active.
      const target = e.target as HTMLElement;
      if (target.closest("[data-connector-port]")) return;

      // While the line tool is active, a press anywhere on the canvas surface
      // begins a line draw — including over a container or an element inside one.
      // Container/element body-mousedown handlers early-return while a line tool
      // is active (see canvas-element handleBodyMouseDown), so the press is ours
      // to claim and there is no cross-pipeline conflict. Presses on empty
      // background/dot-grid draw exactly as before. Interactive line chrome
      // (existing line handles / radial menu) stops propagation itself before
      // the event reaches this container-level listener.
      e.preventDefault();
      e.stopPropagation();

      const startWorld = screenToWorld(e.clientX, e.clientY);

      setLineDraft({
        start: startWorld,
        end: startWorld,
        bend: startWorld,
      });
      setMode("drawingLine");
      dragStartWorld.current = startWorld;

      // Capture pointer for smooth drawing
      if (svgRef.current) {
        svgRef.current.setPointerCapture(e.pointerId);
      }
    };

    container.addEventListener("pointerdown", handlePointerDown);
    return () =>
      container.removeEventListener("pointerdown", handlePointerDown);
  }, [isLineToolActive, containerRef, mode, screenToWorld]);

  // Global pointer move/up handlers
  useEffect(() => {
    if (mode === "idle") return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentWorld = screenToWorld(e.clientX, e.clientY);

      if (mode === "drawingLine" && lineDraft) {
        const dx = currentWorld.x - lineDraft.start.x;
        const dy = currentWorld.y - lineDraft.start.y;
        let snappedEnd = currentWorld;

        if (e.shiftKey) {
          // Shift held: constrain to nearest 45° angle (horizontal, vertical, or diagonal)
          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);
          const dist = Math.max(absDx, absDy);

          if (absDx > absDy * 2) {
            // Horizontal
            snappedEnd = { x: currentWorld.x, y: lineDraft.start.y };
          } else if (absDy > absDx * 2) {
            // Vertical
            snappedEnd = { x: lineDraft.start.x, y: currentWorld.y };
          } else {
            // 45° diagonal
            snappedEnd = {
              x: lineDraft.start.x + dist * Math.sign(dx),
              y: lineDraft.start.y + dist * Math.sign(dy),
            };
          }
        } else {
          // Auto-snap within 15 degrees of horizontal/vertical
          const angle = Math.abs(Math.atan2(dy, dx));
          const snapThreshold = (15 * Math.PI) / 180;

          if (angle < snapThreshold || angle > Math.PI - snapThreshold) {
            snappedEnd = { x: currentWorld.x, y: lineDraft.start.y };
          } else if (Math.abs(angle - Math.PI / 2) < snapThreshold) {
            snappedEnd = { x: lineDraft.start.x, y: currentWorld.y };
          }
        }

        // Update end and bend (bend is midpoint)
        const midX = (lineDraft.start.x + snappedEnd.x) / 2;
        const midY = (lineDraft.start.y + snappedEnd.y) / 2;
        setLineDraft({
          ...lineDraft,
          end: snappedEnd,
          bend: { x: midX, y: midY },
        });
      } else if (
        mode === "draggingHandle" &&
        activeLineId &&
        dragStartWorld.current &&
        initialLineState.current
      ) {
        const initial = initialLineState.current;
        const delta = {
          x: currentWorld.x - dragStartWorld.current.x,
          y: currentWorld.y - dragStartWorld.current.y,
        };

        if (activeHandle === "start") {
          // Calculate new start position
          let newStart = {
            x: initial.start.x + delta.x,
            y: initial.start.y + delta.y,
          };

          // Shift: constrain to straight line relative to the other end
          if (e.shiftKey) {
            const sdx = newStart.x - initial.end.x;
            const sdy = newStart.y - initial.end.y;
            const absDx = Math.abs(sdx);
            const absDy = Math.abs(sdy);
            const dist = Math.max(absDx, absDy);
            if (absDx > absDy * 2) {
              newStart = { x: newStart.x, y: initial.end.y };
            } else if (absDy > absDx * 2) {
              newStart = { x: initial.end.x, y: newStart.y };
            } else {
              newStart = { x: initial.end.x + dist * Math.sign(sdx), y: initial.end.y + dist * Math.sign(sdy) };
            }
          }

          // Calculate bend's relative position to maintain proportional placement
          // Get the initial bend point (or default to midpoint)
          const initialBend = initial.bend || {
            x: (initial.start.x + initial.end.x) / 2,
            y: (initial.start.y + initial.end.y) / 2,
          };

          // Calculate the line vector before and after
          const oldLineVec = {
            x: initial.end.x - initial.start.x,
            y: initial.end.y - initial.start.y,
          };
          const newLineVec = {
            x: initial.end.x - newStart.x,
            y: initial.end.y - newStart.y,
          };

          // Calculate bend's relative position on the original line
          const oldLength = Math.sqrt(oldLineVec.x * oldLineVec.x + oldLineVec.y * oldLineVec.y);
          const newLength = Math.sqrt(newLineVec.x * newLineVec.x + newLineVec.y * newLineVec.y);

          if (oldLength > 0 && newLength > 0) {
            // Calculate t (position along line from start to end, 0-1)
            const t = ((initialBend.x - initial.start.x) * oldLineVec.x +
                       (initialBend.y - initial.start.y) * oldLineVec.y) / (oldLength * oldLength);

            // Calculate perpendicular offset
            const oldPerp = { x: -oldLineVec.y / oldLength, y: oldLineVec.x / oldLength };
            const perpOffset = (initialBend.x - initial.start.x) * oldPerp.x +
                               (initialBend.y - initial.start.y) * oldPerp.y;

            // Apply to new line
            const newPerp = { x: -newLineVec.y / newLength, y: newLineVec.x / newLength };
            const newBend = {
              x: newStart.x + t * newLineVec.x + perpOffset * newPerp.x,
              y: newStart.y + t * newLineVec.y + perpOffset * newPerp.y,
            };

            onUpdateLine(activeLineId, { start: newStart, bend: newBend });
          } else {
            onUpdateLine(activeLineId, { start: newStart });
          }
        } else if (activeHandle === "end") {
          // Calculate new end position
          let newEnd = {
            x: initial.end.x + delta.x,
            y: initial.end.y + delta.y,
          };

          // Shift: constrain to straight line relative to the start
          if (e.shiftKey) {
            const edx = newEnd.x - initial.start.x;
            const edy = newEnd.y - initial.start.y;
            const absDx = Math.abs(edx);
            const absDy = Math.abs(edy);
            const dist = Math.max(absDx, absDy);
            if (absDx > absDy * 2) {
              newEnd = { x: newEnd.x, y: initial.start.y };
            } else if (absDy > absDx * 2) {
              newEnd = { x: initial.start.x, y: newEnd.y };
            } else {
              newEnd = { x: initial.start.x + dist * Math.sign(edx), y: initial.start.y + dist * Math.sign(edy) };
            }
          }

          // Calculate bend's relative position to maintain proportional placement
          const initialBend = initial.bend || {
            x: (initial.start.x + initial.end.x) / 2,
            y: (initial.start.y + initial.end.y) / 2,
          };

          // Calculate the line vector before and after
          const oldLineVec = {
            x: initial.end.x - initial.start.x,
            y: initial.end.y - initial.start.y,
          };
          const newLineVec = {
            x: newEnd.x - initial.start.x,
            y: newEnd.y - initial.start.y,
          };

          // Calculate bend's relative position on the original line
          const oldLength = Math.sqrt(oldLineVec.x * oldLineVec.x + oldLineVec.y * oldLineVec.y);
          const newLength = Math.sqrt(newLineVec.x * newLineVec.x + newLineVec.y * newLineVec.y);

          if (oldLength > 0 && newLength > 0) {
            // Calculate t (position along line from start to end, 0-1)
            const t = ((initialBend.x - initial.start.x) * oldLineVec.x +
                       (initialBend.y - initial.start.y) * oldLineVec.y) / (oldLength * oldLength);

            // Calculate perpendicular offset
            const oldPerp = { x: -oldLineVec.y / oldLength, y: oldLineVec.x / oldLength };
            const perpOffset = (initialBend.x - initial.start.x) * oldPerp.x +
                               (initialBend.y - initial.start.y) * oldPerp.y;

            // Apply to new line
            const newPerp = { x: -newLineVec.y / newLength, y: newLineVec.x / newLength };
            const newBend = {
              x: initial.start.x + t * newLineVec.x + perpOffset * newPerp.x,
              y: initial.start.y + t * newLineVec.y + perpOffset * newPerp.y,
            };

            onUpdateLine(activeLineId, { end: newEnd, bend: newBend });
          } else {
            onUpdateLine(activeLineId, { end: newEnd });
          }
        } else if (activeHandle === "bend") {
          const initialBend = initial.bend || {
            x: (initial.start.x + initial.end.x) / 2,
            y: (initial.start.y + initial.end.y) / 2,
          };
          onUpdateLine(activeLineId, {
            bend: {
              x: initialBend.x + delta.x,
              y: initialBend.y + delta.y,
            },
          });
        }
      } else if (
        mode === "draggingLine" &&
        activeLineId &&
        dragStartWorld.current &&
        initialLineState.current
      ) {
        const initial = initialLineState.current;
        const delta = {
          x: currentWorld.x - dragStartWorld.current.x,
          y: currentWorld.y - dragStartWorld.current.y,
        };
        const initialBend = initial.bend || {
          x: (initial.start.x + initial.end.x) / 2,
          y: (initial.start.y + initial.end.y) / 2,
        };
        onUpdateLine(activeLineId, {
          start: {
            x: initial.start.x + delta.x,
            y: initial.start.y + delta.y,
          },
          end: {
            x: initial.end.x + delta.x,
            y: initial.end.y + delta.y,
          },
          bend: {
            x: initialBend.x + delta.x,
            y: initialBend.y + delta.y,
          },
        });
      }

      // Preview the container the dragged line now hovers over (drop-target highlight).
      // Local React state only in the canvas handler — no store write per frame.
      if ((mode === "draggingLine" || mode === "draggingHandle") && activeLineId) {
        onLineDragHover?.(activeLineId);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (mode === "drawingLine" && lineDraft) {
        // Check minimum distance
        const dx = lineDraft.end.x - lineDraft.start.x;
        const dy = lineDraft.end.y - lineDraft.start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 10) {
          // Create the line
          onCreateLine({
            type: "line",
            x: Math.min(lineDraft.start.x, lineDraft.end.x),
            y: Math.min(lineDraft.start.y, lineDraft.end.y),
            width: Math.abs(dx),
            height: Math.abs(dy),
            start: lineDraft.start,
            end: lineDraft.end,
            bend: lineDraft.bend,
            style: {
              color: "hsl(180 100% 50%)",
              widthPx: 2,
              kind: "solid",
            },
          });
        }

        setLineDraft(null);
        setMode("idle");
        onLineToolComplete();
      } else if (mode === "draggingHandle" || mode === "draggingLine") {
        // Clear the hover highlight first, then commit container attach/detach + bbox
        // resync now that geometry is final.
        onLineDragHover?.(null);
        if (activeLineId) onLineDragCommit?.(activeLineId);
        setMode("idle");
        setActiveHandle(null);
        setActiveLineId(null);
        initialLineState.current = null;
        dragStartWorld.current = null;
      }

      // Release pointer capture
      if (svgRef.current && e.pointerId !== undefined) {
        try {
          svgRef.current.releasePointerCapture(e.pointerId);
        } catch {
          // Ignore
        }
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [
    mode,
    lineDraft,
    activeLineId,
    activeHandle,
    screenToWorld,
    onUpdateLine,
    onCreateLine,
    onLineDragCommit,
    onLineDragHover,
    onLineToolComplete,
  ]);

  // Start dragging a handle
  const startHandleDrag = useCallback(
    (e: React.PointerEvent, lineId: string, handle: HandleType) => {
      // In pan mode, don't interact with line handles — let canvas handle panning
      if (isPanMode || e.button === 1) return;

      e.stopPropagation();
      e.preventDefault();

      const line = lines.find((l) => l.id === lineId);
      if (!line || !line.start || !line.end) return;

      // Capture history before starting drag for undo support
      onOperationStart?.();

      // Keep the line selected while dragging handles
      onSelectLine(lineId);

      setMode("draggingHandle");
      setActiveHandle(handle);
      setActiveLineId(lineId);
      dragStartWorld.current = screenToWorld(e.clientX, e.clientY);
      initialLineState.current = { ...line };

      // Capture pointer
      const target = e.currentTarget as SVGElement;
      if (target.setPointerCapture) {
        target.setPointerCapture(e.pointerId);
      }
    },
    [lines, screenToWorld, onOperationStart, onSelectLine, isPanMode],
  );

  // Start dragging the whole line (via stroke)
  const startLineDrag = useCallback(
    (e: React.PointerEvent, lineId: string) => {
      // In pan mode, don't interact with lines — let canvas handle panning
      if (isPanMode || e.button === 1) return;

      e.stopPropagation();
      e.preventDefault();

      const line = lines.find((l) => l.id === lineId);
      if (!line || !line.start || !line.end) return;

      // Alt+drag to duplicate line
      if (e.altKey && onDuplicateLine) {
        onDuplicateLine(line);
        return;
      }

      // Only delegate to the canvas multi-drag path when this line is part of a TRUE
      // multi-selection (size > 1). A single selected line (size 1) must stay owned by
      // this layer's own drag state machine — otherwise startLineDrag early-returns into
      // a select-only path and the line can never enter "draggingLine". That was the
      // "locked" bug for in-container lines, which stay selected after being dropped in,
      // so every subsequent stroke press re-selected instead of moving them.
      if (selectedLineIds.has(lineId) && selectedLineIds.size > 1) {
        onSelectLine(lineId, e);
        return;
      }

      // Capture history before starting drag for undo support
      onOperationStart?.();

      // Select the line (pass event for Shift/Ctrl multi-select)
      onSelectLine(lineId, e);

      setMode("draggingLine");
      setActiveLineId(lineId);
      dragStartWorld.current = screenToWorld(e.clientX, e.clientY);
      initialLineState.current = { ...line };

      // Capture pointer
      const target = e.currentTarget as SVGElement;
      if (target.setPointerCapture) {
        target.setPointerCapture(e.pointerId);
      }
    },
    [lines, screenToWorld, onSelectLine, onOperationStart, selectedLineIds, isPanMode],
  );

  // Get stroke dash array from kind
  const getStrokeDashArray = (kind?: string) => {
    if (kind === "dashed") return "10 8";
    if (kind === "dotted") return "2 8";
    return "";
  };

  // Render end cap at a given position with rotation
  const renderEndCap = (
    capStyle: LineEndStyle | undefined,
    x: number,
    y: number,
    angle: number,
    color: string,
    size: number,
    key: string
  ) => {
    if (!capStyle || capStyle === "none") return null;

    const halfSize = size / 2;

    switch (capStyle) {
      case "dot":
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r={halfSize}
            fill={color}
            style={{ pointerEvents: "none" }}
          />
        );
      case "arrow":
        // Arrow with base at the endpoint, tip extending outward
        const arrowPoints = [
          { x: size, y: 0 }, // Tip of arrow
          { x: 0, y: -halfSize * 0.8 }, // Upper wing base
          { x: size * 0.3, y: 0 }, // Center indent
          { x: 0, y: halfSize * 0.8 }, // Lower wing base
        ];
        const rotatedArrow = arrowPoints.map((p) => ({
          x: x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
          y: y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
        }));
        return (
          <polygon
            key={key}
            points={rotatedArrow.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            style={{ pointerEvents: "none" }}
          />
        );
      case "square":
        const squarePoints = [
          { x: halfSize, y: -halfSize },
          { x: halfSize, y: halfSize },
          { x: -halfSize, y: halfSize },
          { x: -halfSize, y: -halfSize },
        ];
        const rotatedSquare = squarePoints.map((p) => ({
          x: x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
          y: y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
        }));
        return (
          <polygon
            key={key}
            points={rotatedSquare.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            style={{ pointerEvents: "none" }}
          />
        );
      case "diamond":
        const diamondPoints = [
          { x: halfSize, y: 0 },
          { x: 0, y: halfSize },
          { x: -halfSize, y: 0 },
          { x: 0, y: -halfSize },
        ];
        const rotatedDiamond = diamondPoints.map((p) => ({
          x: x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
          y: y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
        }));
        return (
          <polygon
            key={key}
            points={rotatedDiamond.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            style={{ pointerEvents: "none" }}
          />
        );
      default:
        return null;
    }
  };

  // Render a single line
  const renderLine = (line: LineElement, isSelected: boolean) => {
    if (!line.start || !line.end) return null;

    const start = worldToScreen(line.start.x, line.start.y);
    const end = worldToScreen(line.end.x, line.end.y);
    const bend = line.bend
      ? worldToScreen(line.bend.x, line.bend.y)
      : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

    const gradientName = line.style?.gradientName as LineGradientName | undefined;
    const gradColors = gradientName ? LINE_GRADIENT_COLORS[gradientName] : null;
    const color = gradColors ? gradColors.mid : (line.style?.color || "hsl(180 100% 50%)");
    const accentLight = gradColors?.light ?? color;
    const gradientId = `line-grad-${line.id}`;
    const widthPx = (line.style?.widthPx || 2) * canvasZoom;
    const kind = line.style?.kind || "solid";
    const startCap = line.style?.startCap;
    const endCap = line.style?.endCap;

    const pathD = `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`;

    // Calculate angles for end caps (tangent to the curve at each endpoint)
    // For quadratic bezier, tangent at start = bend - start, tangent at end = end - bend
    // Start arrow points away from the line (opposite direction)
    const startAngle = Math.atan2(start.y - bend.y, start.x - bend.x);
    const endAngle = Math.atan2(end.y - bend.y, end.x - bend.x);

    // End cap size scales with line width
    const capSize = Math.max(8, widthPx * 3) * canvasZoom;

    const strokePaint = gradColors ? `url(#${gradientId})` : color;

    return (
      <g key={line.id}>
        {/* Gradient definition (only when gradient is active) */}
        {gradColors && (
          <defs>
            <linearGradient id={gradientId} x1={start.x} y1={start.y} x2={end.x} y2={end.y} gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor={gradColors.light} />
              <stop offset="100%" stopColor={gradColors.mid} />
            </linearGradient>
          </defs>
        )}
        {/* Invisible thick hit path for selection and stroke dragging */}
        <path
          d={pathD}
          stroke="transparent"
          strokeWidth={Math.max(16, widthPx * 4)}
          fill="none"
          style={{
            pointerEvents: "stroke",
            cursor: mode === "draggingLine" ? "grabbing" : "grab",
          }}
          onPointerDown={(e) => startLineDrag(e, line.id)}
        />
        {/* Visible line */}
        <path
          d={pathD}
          stroke={strokePaint}
          strokeWidth={widthPx}
          strokeDasharray={getStrokeDashArray(kind)}
          strokeLinecap="round"
          fill="none"
          style={{ pointerEvents: "none" }}
        />
        {/* Start cap */}
        {renderEndCap(startCap, start.x, start.y, startAngle, color, capSize, `${line.id}-start-cap`)}
        {/* End cap */}
        {renderEndCap(endCap, end.x, end.y, endAngle, color, capSize, `${line.id}-end-cap`)}
        {/* Handles - only when selected */}
        {isSelected && (
          <>
            {/* Helper lines to bend point */}
            <line
              x1={start.x}
              y1={start.y}
              x2={bend.x}
              y2={bend.y}
              stroke="hsl(180 100% 50% / 0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ pointerEvents: "none" }}
            />
            <line
              x1={bend.x}
              y1={bend.y}
              x2={end.x}
              y2={end.y}
              stroke="hsl(180 100% 50% / 0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
              style={{ pointerEvents: "none" }}
            />

            {/* Start handle — connector-node style */}
            <g
              style={{ cursor: "crosshair", pointerEvents: "all" }}
              onPointerDown={(e) => startHandleDrag(e, line.id, "start")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Glow */}
              <circle cx={start.x} cy={start.y} r={13} fill={color} opacity={0.18} style={{ pointerEvents: "none" }} />
              {/* Main node */}
              <circle cx={start.x} cy={start.y} r={7} fill={color} opacity={0.92}
                stroke={accentLight} strokeWidth={1.5} strokeOpacity={0.8} style={{ pointerEvents: "none" }} />
              {/* Inner highlight */}
              <circle cx={start.x - 2} cy={start.y - 2} r={2} fill="white" opacity={0.4} style={{ pointerEvents: "none" }} />
              {/* Transparent hit area */}
              <circle cx={start.x} cy={start.y} r={14} fill="transparent" />
            </g>

            {/* End handle — connector-node style */}
            <g
              style={{ cursor: "crosshair", pointerEvents: "all" }}
              onPointerDown={(e) => startHandleDrag(e, line.id, "end")}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Glow */}
              <circle cx={end.x} cy={end.y} r={13} fill={color} opacity={0.18} style={{ pointerEvents: "none" }} />
              {/* Main node */}
              <circle cx={end.x} cy={end.y} r={7} fill={color} opacity={0.92}
                stroke={accentLight} strokeWidth={1.5} strokeOpacity={0.8} style={{ pointerEvents: "none" }} />
              {/* Inner highlight */}
              <circle cx={end.x - 2} cy={end.y - 2} r={2} fill="white" opacity={0.4} style={{ pointerEvents: "none" }} />
              {/* Transparent hit area */}
              <circle cx={end.x} cy={end.y} r={14} fill="transparent" />
            </g>

            {/* Bend handle */}
            <circle
              cx={bend.x}
              cy={bend.y}
              r={8}
              fill="hsl(280 100% 70% / 0.9)"
              stroke="white"
              strokeWidth="2"
              style={{ cursor: "move", pointerEvents: "all" }}
              onPointerDown={(e) => startHandleDrag(e, line.id, "bend")}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </>
        )}
      </g>
    );
  };

  // Render draft line during creation
  const renderDraftLine = () => {
    if (!lineDraft) return null;

    const start = worldToScreen(lineDraft.start.x, lineDraft.start.y);
    const end = worldToScreen(lineDraft.end.x, lineDraft.end.y);
    const bend = worldToScreen(lineDraft.bend.x, lineDraft.bend.y);

    const pathD = `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`;

    return (
      <g>
        {/* Draft line */}
        <path
          d={pathD}
          stroke="hsl(180 100% 50%)"
          strokeWidth={2 * canvasZoom}
          strokeLinecap="round"
          fill="none"
          style={{ pointerEvents: "none" }}
        />
        {/* Start point indicator */}
        <circle
          cx={start.x}
          cy={start.y}
          r={6}
          fill="hsl(180 100% 50%)"
          stroke="white"
          strokeWidth="2"
          style={{ pointerEvents: "none" }}
        />
        {/* End point indicator */}
        <circle
          cx={end.x}
          cy={end.y}
          r={6}
          fill="hsl(180 100% 50%)"
          stroke="white"
          strokeWidth="2"
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  };

  // Split by containment. Open-canvas lines stay in the base layer BELOW the element
  // layer (unchanged behaviour). Lines attached to a container render in a second SVG
  // stacked ABOVE the element layer so they paint in front of the container body and
  // their strokes receive the pointer instead of the container eating the click.
  const openLines = lines.filter((l) => !l.containerId);
  const containerLines = lines.filter((l) => l.containerId);

  const renderLineNode = (line: LineElement) => {
    if (!line.start || !line.end) return null;
    const isSelected = line.id === selectedLineId || selectedLineIds.has(line.id);
    return renderLine(line, isSelected);
  };

  return (
    <>
      {/* Base SVG Line Layer — open-canvas lines (behind the element layer) + draft */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{
          zIndex: 0,
          pointerEvents: mode === "drawingLine" ? "all" : "none",
          cursor: isLineToolActive ? "crosshair" : undefined,
        }}
      >
        {openLines.map(renderLineNode)}

        {/* Render draft line during creation */}
        {renderDraftLine()}
      </svg>

      {/* Elevated SVG layer — in-container lines paint ABOVE the Canvas Content layer
          (which sits at z-index 10). A container div lives inside that content stacking
          context, so an absolute z-index of 11 here beats the entire content group,
          including any element boosted to a huge z-index inside it. pointer-events is
          none at the SVG level; only each line's stroke/handles opt back in, so clicks
          on empty container body still reach the container. */}
      {containerLines.length > 0 && (
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 11, pointerEvents: "none" }}
        >
          {containerLines.map(renderLineNode)}
        </svg>
      )}
      {/* Context Menu for selected line */}
      {selectedLineId &&
        mode === "idle" &&
        (() => {
          const selectedLine = lines.find((l) => l.id === selectedLineId);
          if (!selectedLine || !selectedLine.start || !selectedLine.end)
            return null;

          return (
            <LineRadialMenu
              line={selectedLine}
              onUpdateLine={(updates) => onUpdateLine(selectedLineId, updates)}
              onDelete={() => {
                onDeleteLine(selectedLineId);
                onSelectLine(null);
              }}
              onDuplicate={onDuplicateLine ? () => onDuplicateLine(selectedLine) : undefined}
              worldToScreen={worldToScreen}
              canvasZoom={canvasZoom}
              onClose={() => onSelectLine(null)}
            />
          );
        })()}
    </>
  );
}

// Radial menu for line styling — center node draggable to bend the line
function LineRadialMenu({
  line,
  onUpdateLine,
  onDelete,
  onDuplicate,
  worldToScreen,
  canvasZoom,
  onClose,
}: {
  line: LineElement;
  onUpdateLine: (updates: Partial<LineElement>) => void;
  onDelete: () => void;
  onDuplicate?: () => void;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  canvasZoom: number;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [colorExpanded, setColorExpanded] = useState(false);
  const [thicknessExpanded, setThicknessExpanded] = useState(false);
  const [ringHovered, setRingHovered] = useState(false);

  // Stable ref for onClose so the document listener doesn't need to re-register
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  // Close menu on outside click (document-level, bubble phase) — allows SVG handles to
  // stopPropagation on mousedown so they don't trigger this listener
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!line.start || !line.end) return null;

  const start = line.start;
  const end = line.end;
  const bend = line.bend || { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  // Bezier midpoint (t=0.5)
  const t = 0.5;
  const midWorld = {
    x: (1 - t) * (1 - t) * start.x + 2 * (1 - t) * t * bend.x + t * t * end.x,
    y: (1 - t) * (1 - t) * start.y + 2 * (1 - t) * t * bend.y + t * t * end.y,
  };
  const midScreen = worldToScreen(midWorld.x, midWorld.y);

  const gradientName = line.style?.gradientName as LineGradientName | undefined;
  const gradColors = gradientName ? LINE_GRADIENT_COLORS[gradientName] : null;
  const accentColor = gradColors?.mid ?? (line.style?.color || '#7C3AED');
  const accentLight = gradColors?.light ?? accentColor;

  const currentKind = line.style?.kind || 'solid';

  const cycleKind = (e: React.MouseEvent) => {
    e.stopPropagation();
    const kinds = ['solid', 'dashed', 'dotted'] as const;
    const next = kinds[(kinds.indexOf(currentKind as typeof kinds[number]) + 1) % 3];
    onUpdateLine({ style: { ...line.style, kind: next } });
  };

  const cycleStartCap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const caps: LineEndStyle[] = ['none', 'arrow', 'dot', 'square', 'diamond'];
    const current = line.style?.startCap || 'none';
    const next = caps[(caps.indexOf(current) + 1) % caps.length];
    onUpdateLine({ style: { ...line.style, startCap: next } });
  };

  const cycleEndCap = (e: React.MouseEvent) => {
    e.stopPropagation();
    const caps: LineEndStyle[] = ['none', 'arrow', 'dot', 'square', 'diamond'];
    const current = line.style?.endCap || 'none';
    const next = caps[(caps.indexOf(current) + 1) % caps.length];
    onUpdateLine({ style: { ...line.style, endCap: next } });
  };

  // Thickness ring constants & math (mirrors ConnectorRadialMenu)
  const RING_R = 96;
  const RING_PAD = 10;
  const MIN_T = 1;
  const MAX_T = 12;
  const currentThickness = Math.max(MIN_T, Math.min(MAX_T, line.style?.widthPx ?? 2));
  const tAngle = -Math.PI / 2 + ((currentThickness - MIN_T) / (MAX_T - MIN_T)) * 2 * Math.PI;
  const svgSize = (RING_R + RING_PAD) * 2;
  const svgCx = RING_R + RING_PAD;
  const svgCy = RING_R + RING_PAD;
  const nodeX = svgCx + Math.cos(tAngle) * RING_R;
  const nodeY = svgCy + Math.sin(tAngle) * RING_R;

  const angleToThickness = (angle: number): number => {
    let norm = angle + Math.PI / 2;
    if (norm < 0) norm += 2 * Math.PI;
    norm = norm % (2 * Math.PI);
    return Math.max(MIN_T, Math.min(MAX_T, Math.round(MIN_T + (norm / (2 * Math.PI)) * (MAX_T - MIN_T))));
  };

  const getAngleFromMenuCenter = (clientX: number, clientY: number): number => {
    const rect = menuRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.atan2(clientY - (rect.top + rect.height / 2), clientX - (rect.left + rect.width / 2));
  };

  const handleRingNodeDrag = (e: React.MouseEvent<SVGElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (mv: MouseEvent) => {
      onUpdateLine({ style: { ...line.style, widthPx: angleToThickness(getAngleFromMenuCenter(mv.clientX, mv.clientY)) } });
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const handleRingClick = (e: React.MouseEvent<SVGCircleElement>) => {
    e.stopPropagation();
    onUpdateLine({ style: { ...line.style, widthPx: angleToThickness(getAngleFromMenuCenter(e.clientX, e.clientY)) } });
  };

  // Center node: click → toggle thickness ring, drag → move bend point
  const DRAG_THRESHOLD = 4;
  const handleCenterMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialBend = { ...bend };
    let hasDragged = false;

    const move = (mv: MouseEvent) => {
      const dx = mv.clientX - startX;
      const dy = mv.clientY - startY;
      if (!hasDragged && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        hasDragged = true;
      }
      if (hasDragged) {
        onUpdateLine({ bend: { x: initialBend.x + dx / canvasZoom, y: initialBend.y + dy / canvasZoom } });
      }
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      if (!hasDragged) {
        setThicknessExpanded(v => !v);
      }
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const LINE_ICONS: Record<string, React.ReactNode> = {
    solid: <svg width="18" height="2" viewBox="0 0 18 2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>,
    dashed: <svg width="18" height="2" viewBox="0 0 18 2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="1.8" strokeDasharray="4 2.5" strokeLinecap="round"/></svg>,
    dotted: <svg width="18" height="2" viewBox="0 0 18 2"><line x1="0" y1="1" x2="18" y2="1" stroke="currentColor" strokeWidth="1.8" strokeDasharray="1 3" strokeLinecap="round"/></svg>,
  };

  const START_CAP_LABELS: Record<LineEndStyle, string> = {
    none: '○—', arrow: '◀—', dot: '●—', square: '■—', diamond: '◆—',
  };

  const END_CAP_LABELS: Record<LineEndStyle, string> = {
    none: '—○', arrow: '—▶', dot: '—●', square: '—■', diamond: '—◆',
  };

  const btnBase = "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-150 border backdrop-blur-sm";
  const btnNormal = "bg-[rgba(15,12,25,0.92)] border-[rgba(255,255,255,0.12)] text-white/60 hover:bg-[rgba(35,28,55,0.97)] hover:text-white/90 hover:border-[rgba(255,255,255,0.2)]";

  return (
    <>
      <div
        ref={menuRef}
        className="absolute pointer-events-auto"
        style={{ left: midScreen.x, top: midScreen.y, transform: 'translate(-50%, -50%)', zIndex: 9999 }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 6 buttons evenly spaced at 60° intervals — ARM_R=62 from center */}
        {(() => {
          const ARM_R = 62;
          const arm = (deg: number): React.CSSProperties => {
            const rad = (deg * Math.PI) / 180;
            return { position: 'absolute', left: Math.cos(rad) * ARM_R, top: Math.sin(rad) * ARM_R, transform: 'translate(-50%, -50%)' };
          };

          return (
            <>
              {/* 0: -90° (12 o'clock) — Color */}
              <div style={arm(-90)} className="flex flex-col items-center">
                {colorExpanded && (
                  <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-[rgba(15,12,25,0.95)] rounded-full px-2.5 py-2 border border-[rgba(255,255,255,0.1)] backdrop-blur-sm shadow-lg whitespace-nowrap">
                    {LINE_GRADIENT_ORDER.map((name) => {
                      const c = LINE_GRADIENT_COLORS[name];
                      const isActive = gradientName === name;
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
                          onClick={(e) => { e.stopPropagation(); onUpdateLine({ style: { ...line.style, gradientName: name, color: undefined } }); }}
                          onMouseDown={(e) => e.stopPropagation()}
                        />
                      );
                    })}
                    <div className="w-px h-4 bg-white/15 mx-0.5 flex-shrink-0" />
                    <label title="Custom solid color" className="w-5 h-5 rounded-full flex-shrink-0 cursor-pointer relative overflow-hidden"
                      style={{
                        background: gradientName ? 'rgba(255,255,255,0.12)' : (line.style?.color || '#00ffff'),
                        border: !gradientName ? '2px solid rgba(255,255,255,0.9)' : '2px solid rgba(255,255,255,0.2)',
                      }}
                    >
                      <input
                        type="color"
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                        value={!gradientName && line.style?.color?.match(/^#/) ? line.style.color : '#00ffff'}
                        onChange={(e) => { onUpdateLine({ style: { ...line.style, color: e.target.value, gradientName: undefined } }); }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </label>
                  </div>
                )}
                <button
                  className={`${btnBase} ${btnNormal}`}
                  title="Color"
                  onClick={(e) => { e.stopPropagation(); setColorExpanded(v => !v); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    background: colorExpanded ? `radial-gradient(circle at 35% 30%, ${accentLight}33, ${accentColor}22)` : undefined,
                    borderColor: colorExpanded ? `${accentColor}66` : undefined,
                  }}
                >
                  <span className="w-4 h-4 rounded-full block flex-shrink-0"
                    style={{ background: gradColors ? `radial-gradient(circle at 35% 30%, ${accentLight}, ${accentColor})` : accentColor }}
                  />
                </button>
              </div>

              {/* 1: -30° (2 o'clock) — Line style */}
              <div style={arm(-30)}>
                <button
                  className={`${btnBase} ${btnNormal} text-white/70`}
                  title={`Line style: ${currentKind} (click to cycle)`}
                  onClick={cycleKind}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {LINE_ICONS[currentKind]}
                </button>
              </div>

              {/* 2: 30° (4 o'clock) — End cap */}
              <div style={arm(30)}>
                <button
                  className={`${btnBase} ${btnNormal} text-[10px] font-mono tracking-tight`}
                  title={`End cap: ${line.style?.endCap || 'none'} (click to cycle)`}
                  onClick={cycleEndCap}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {END_CAP_LABELS[line.style?.endCap || 'none']}
                </button>
              </div>

              {/* 3: 90° (6 o'clock) — Delete */}
              <div style={arm(90)}>
                <button
                  className={`${btnBase} bg-[rgba(239,68,68,0.08)] border-[rgba(239,68,68,0.22)] text-red-400/70 hover:bg-[rgba(239,68,68,0.18)] hover:text-red-400`}
                  title="Delete line"
                  onClick={(e) => { e.stopPropagation(); onDelete(); onClose(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* 4: 150° (8 o'clock) — Duplicate */}
              <div style={arm(150)}>
                <button
                  className={`${btnBase} ${onDuplicate ? btnNormal : 'opacity-30 cursor-not-allowed bg-[rgba(15,12,25,0.92)] border-[rgba(255,255,255,0.08)] text-white/30'}`}
                  title="Duplicate"
                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                  disabled={!onDuplicate}
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>

              {/* 5: 210° (10 o'clock) — Start cap */}
              <div style={arm(210)}>
                <button
                  className={`${btnBase} ${btnNormal} text-[10px] font-mono tracking-tight`}
                  title={`Start cap: ${line.style?.startCap || 'none'} (click to cycle)`}
                  onClick={cycleStartCap}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {START_CAP_LABELS[line.style?.startCap || 'none']}
                </button>
              </div>
            </>
          );
        })()}

        {/* Thickness ring — SVG layer behind all arms */}
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
              cx={svgCx} cy={svgCy} r={RING_R}
              fill="none"
              stroke={accentColor}
              strokeWidth={ringHovered ? 2.5 : 1.5}
              strokeOpacity={ringHovered ? 0.65 : 0.22}
              style={{ pointerEvents: 'auto', cursor: 'crosshair', transition: 'stroke-opacity 0.12s, stroke-width 0.12s' }}
              onMouseEnter={() => setRingHovered(true)}
              onMouseLeave={() => setRingHovered(false)}
              onClick={handleRingClick}
            />
            {ringHovered && (
              <circle cx={svgCx} cy={svgCy} r={RING_R}
                fill="none" stroke={accentLight} strokeWidth={8} strokeOpacity={0.06}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Draggable node on ring */}
            <g style={{ pointerEvents: 'auto', cursor: 'grab' }} onMouseDown={handleRingNodeDrag}>
              <circle cx={nodeX} cy={nodeY} r={9} fill={accentColor} opacity={0.2} style={{ pointerEvents: 'none' }} />
              <circle cx={nodeX} cy={nodeY} r={5.5} fill={accentColor} opacity={0.9}
                stroke={accentLight} strokeWidth={1} strokeOpacity={0.7} />
              <circle cx={nodeX - 1.5} cy={nodeY - 1.5} r={1.5} fill="white" opacity={0.4} style={{ pointerEvents: 'none' }} />
            </g>
            {/* Thickness label */}
            <text x={svgCx} y={svgCy + 18} textAnchor="middle"
              fill={accentColor} fontSize={9} opacity={0.55}
              style={{ fontFamily: 'monospace', userSelect: 'none', pointerEvents: 'none' }}
            >
              {currentThickness}px
            </text>
          </svg>
        )}

        {/* Center node — click to toggle thickness ring, drag to curve the line */}
        <div
          className="absolute rounded-full flex items-center justify-center"
          style={{
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 16, height: 16,
            background: thicknessExpanded
              ? `radial-gradient(circle at 35% 30%, ${accentLight}55, ${accentColor}44)`
              : `rgba(20, 15, 40, 0.85)`,
            border: `1.5px solid ${thicknessExpanded ? accentColor + 'cc' : accentColor + '88'}`,
            boxShadow: thicknessExpanded ? `0 0 10px ${accentColor}55` : `0 0 4px ${accentColor}33`,
            cursor: 'grab',
            zIndex: 1,
          }}
          title={thicknessExpanded ? `Thickness: ${currentThickness}px, drag node on ring to adjust` : 'Click: thickness ring · Drag: curve line'}
          onMouseDown={handleCenterMouseDown}
        >
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor, opacity: 0.9 }} />
        </div>
      </div>
    </>
  );
}

// End cap picker dropdown
function EndCapPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LineEndStyle;
  onChange: (cap: LineEndStyle) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const capOptions: { value: LineEndStyle; label: string; icon: React.ReactNode }[] = [
    {
      value: "none",
      label: "None",
      icon: <Minus className="w-3 h-3" />,
    },
    {
      value: "dot",
      label: "Dot",
      icon: <Circle className="w-3 h-3 fill-current" />,
    },
    {
      value: "arrow",
      label: "Arrow",
      icon: <ArrowRight className="w-3 h-3" />,
    },
    {
      value: "square",
      label: "Square",
      icon: <Square className="w-3 h-3 fill-current" />,
    },
    {
      value: "diamond",
      label: "Diamond",
      icon: <Diamond className="w-3 h-3 fill-current" />,
    },
  ];

  const currentOption = capOptions.find((o) => o.value === value) || capOptions[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded hover:bg-primary/20 transition-colors text-xs",
          isOpen && "bg-primary/20"
        )}
        title={`${label} cap: ${currentOption.label}`}
      >
        {currentOption.icon}
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </button>
      {isOpen && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 flex flex-col gap-0.5 p-1 rounded-lg bg-card/95 backdrop-blur border border-border/50 shadow-lg min-w-[80px]"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {capOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-primary/20 transition-colors",
                value === option.value && "bg-primary/30"
              )}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
