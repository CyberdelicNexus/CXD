"use client";

import { useCallback, useRef, useState, useEffect } from "react";
import { LineElement } from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { Minus, Trash2 } from "lucide-react";

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
  onSelectLine: (id: string | null) => void;
  onUpdateLine: (id: string, updates: Partial<LineElement>) => void;
  onCreateLine: (
    line: Omit<LineElement, "id" | "zIndex" | "boardId" | "surface">,
  ) => void;
  onDeleteLine: (id: string) => void;
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  isLineToolActive: boolean;
  onLineToolComplete: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

export function LineLayer({
  lines,
  selectedLineId,
  onSelectLine,
  onUpdateLine,
  onCreateLine,
  onDeleteLine,
  canvasPosition,
  canvasZoom,
  isLineToolActive,
  onLineToolComplete,
  containerRef,
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
          setMode("idle");
          setActiveHandle(null);
          setActiveLineId(null);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, activeLineId, onUpdateLine, onLineToolComplete]);

  // Handle line tool activation - enter drawing mode on canvas click
  useEffect(() => {
    if (!isLineToolActive || !containerRef.current) return;

    // If we're already in a drawing state, don't interfere
    if (mode !== "idle" && mode !== "drawingLine") return;

    const container = containerRef.current;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;

      // Only start on background/dot-grid
      if (
        !target.classList.contains("canvas-background") &&
        !target.classList.contains("dot-grid") &&
        target !== container
      ) {
        return;
      }

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
        // Update end and bend (bend is midpoint)
        const midX = (lineDraft.start.x + currentWorld.x) / 2;
        const midY = (lineDraft.start.y + currentWorld.y) / 2;
        setLineDraft({
          ...lineDraft,
          end: currentWorld,
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
          onUpdateLine(activeLineId, {
            start: {
              x: initial.start.x + delta.x,
              y: initial.start.y + delta.y,
            },
          });
        } else if (activeHandle === "end") {
          onUpdateLine(activeLineId, {
            end: {
              x: initial.end.x + delta.x,
              y: initial.end.y + delta.y,
            },
          });
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
              color: "hsl(180 100% 50% / 0.8)",
              widthPx: 2,
              kind: "solid",
            },
          });
        }

        setLineDraft(null);
        setMode("idle");
        onLineToolComplete();
      } else if (mode === "draggingHandle" || mode === "draggingLine") {
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
    onLineToolComplete,
  ]);

  // Start dragging a handle
  const startHandleDrag = useCallback(
    (e: React.PointerEvent, lineId: string, handle: HandleType) => {
      e.stopPropagation();
      e.preventDefault();

      const line = lines.find((l) => l.id === lineId);
      if (!line || !line.start || !line.end) return;

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
    [lines, screenToWorld],
  );

  // Start dragging the whole line (via stroke)
  const startLineDrag = useCallback(
    (e: React.PointerEvent, lineId: string) => {
      e.stopPropagation();
      e.preventDefault();

      const line = lines.find((l) => l.id === lineId);
      if (!line || !line.start || !line.end) return;

      // Select the line
      onSelectLine(lineId);

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
    [lines, screenToWorld, onSelectLine],
  );

  // Get stroke dash array from kind
  const getStrokeDashArray = (kind?: string) => {
    if (kind === "dashed") return "10 8";
    if (kind === "dotted") return "2 8";
    return "";
  };

  // Render a single line
  const renderLine = (line: LineElement, isSelected: boolean) => {
    if (!line.start || !line.end) return null;

    const start = worldToScreen(line.start.x, line.start.y);
    const end = worldToScreen(line.end.x, line.end.y);
    const bend = line.bend
      ? worldToScreen(line.bend.x, line.bend.y)
      : { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

    const color = line.style?.color || "hsl(180 100% 50% / 0.8)";
    const widthPx = (line.style?.widthPx || 2) * canvasZoom;
    const kind = line.style?.kind || "solid";

    const pathD = `M ${start.x} ${start.y} Q ${bend.x} ${bend.y} ${end.x} ${end.y}`;

    return (
      <g key={line.id}>
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
          stroke={color}
          strokeWidth={widthPx}
          strokeDasharray={getStrokeDashArray(kind)}
          strokeLinecap="round"
          fill="none"
          style={{ pointerEvents: "none" }}
        />
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

            {/* Start handle */}
            <circle
              cx={start.x}
              cy={start.y}
              r={8}
              fill="white"
              stroke="hsl(180 100% 50%)"
              strokeWidth="2"
              style={{ cursor: "crosshair", pointerEvents: "all" }}
              onPointerDown={(e) => startHandleDrag(e, line.id, "start")}
            />

            {/* End handle */}
            <circle
              cx={end.x}
              cy={end.y}
              r={8}
              fill="white"
              stroke="hsl(180 100% 50%)"
              strokeWidth="2"
              style={{ cursor: "crosshair", pointerEvents: "all" }}
              onPointerDown={(e) => startHandleDrag(e, line.id, "end")}
            />

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
          stroke="hsl(180 100% 50% / 0.8)"
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

  return (
    <>
      {/* SVG Line Layer */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{
          zIndex: 10,
          pointerEvents: mode === "drawingLine" ? "all" : "none",
          cursor: isLineToolActive ? "crosshair" : undefined,
        }}
      >
        {/* Render existing lines */}
        {lines.map((line) => {
          if (!line.start || !line.end) return null;
          return renderLine(line, line.id === selectedLineId);
        })}

        {/* Render draft line during creation */}
        {renderDraftLine()}
      </svg>
      {/* Context Menu for selected line */}
      {selectedLineId &&
        mode === "idle" &&
        (() => {
          const selectedLine = lines.find((l) => l.id === selectedLineId);
          if (!selectedLine || !selectedLine.start || !selectedLine.end)
            return null;

          return (
            <LineContextMenu
              line={selectedLine}
              onUpdateLine={(updates) => onUpdateLine(selectedLineId, updates)}
              onDelete={() => {
                onDeleteLine(selectedLineId);
                onSelectLine(null);
              }}
              worldToScreen={worldToScreen}
              canvasZoom={canvasZoom}
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
  canvasZoom,
}: {
  line: LineElement;
  onUpdateLine: (updates: Partial<LineElement>) => void;
  onDelete: () => void;
  worldToScreen: (x: number, y: number) => { x: number; y: number };
  canvasZoom: number;
}) {
  if (!line.start || !line.end) return null;

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
    position: "absolute",
    zIndex: 100,
    ...(isHorizontal
      ? { top: midScreen.y + 16, left: midScreen.x - 100 }
      : { top: midScreen.y - 20, left: midScreen.x + 16 }),
  };

  const widthPx = line.style?.widthPx || 2;
  const color = line.style?.color || "hsl(180 100% 50% / 0.8)";
  const kind = line.style?.kind || "solid";

  // Convert HSL to hex for color input
  const getHexColor = () => {
    try {
      if (color.match(/#[0-9a-fA-F]{6}/)) return color;
      return "#00ffff";
    } catch {
      return "#00ffff";
    }
  };

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-card/95 backdrop-blur border border-border/50 shadow-lg"
      style={menuStyle}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Line style buttons */}
      <button
        onClick={() =>
          onUpdateLine({ style: { ...line.style, kind: "solid" } })
        }
        className={cn(
          "p-1.5 rounded hover:bg-primary/20 transition-colors",
          kind === "solid" && "bg-primary/30 ring-1 ring-primary",
        )}
        title="Solid"
      >
        <Minus className="w-4 h-4" />
      </button>
      <button
        onClick={() =>
          onUpdateLine({ style: { ...line.style, kind: "dashed" } })
        }
        className={cn(
          "p-1.5 rounded hover:bg-primary/20 transition-colors",
          kind === "dashed" && "bg-primary/30 ring-1 ring-primary",
        )}
        title="Dashed"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="4" y1="12" x2="8" y2="12" />
          <line x1="12" y1="12" x2="16" y2="12" />
          <line x1="20" y1="12" x2="24" y2="12" />
        </svg>
      </button>
      <button
        onClick={() =>
          onUpdateLine({ style: { ...line.style, kind: "dotted" } })
        }
        className={cn(
          "p-1.5 rounded hover:bg-primary/20 transition-colors",
          kind === "dotted" && "bg-primary/30 ring-1 ring-primary",
        )}
        title="Dotted"
      >
        <svg
          className="w-4 h-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="4" cy="12" r="1" fill="currentColor" />
          <circle cx="10" cy="12" r="1" fill="currentColor" />
          <circle cx="16" cy="12" r="1" fill="currentColor" />
          <circle cx="22" cy="12" r="1" fill="currentColor" />
        </svg>
      </button>
      <div className="w-px h-4 bg-border/50 mx-0.5" />
      {/* Width slider */}
      <input
        type="range"
        min="1"
        max="12"
        value={widthPx}
        onChange={(e) =>
          onUpdateLine({
            style: { ...line.style, widthPx: parseInt(e.target.value) },
          })
        }
        className="w-16 h-1 rounded-full appearance-none bg-muted cursor-pointer"
        title={`Width: ${widthPx}px`}
      />
      <div className="w-px h-4 bg-border/50 mx-0.5" />
      {/* Color input */}
      <input
        type="color"
        value={getHexColor()}
        onChange={(e) =>
          onUpdateLine({ style: { ...line.style, color: e.target.value } })
        }
        className="w-6 h-6 rounded cursor-pointer border-0"
        title="Color"
      />
      <div className="w-px h-4 bg-border/50 mx-0.5" />
      {/* Delete button */}
      <button
        onClick={onDelete}
        className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}
