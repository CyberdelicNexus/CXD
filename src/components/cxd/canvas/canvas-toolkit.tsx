"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import {
  CanvasElementType,
  DEFAULT_ELEMENT_SIZES,
  ShapeType,
} from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { useCXDStore } from "@/store/cxd-store";

type LinkMode = 'bookmark' | 'embed' | 'file';

interface CanvasToolkitProps {
  onPlaceElement: (
    type: CanvasElementType,
    position: { x: number; y: number },
    options?: { shapeType?: ShapeType; linkMode?: LinkMode; cardType?: "note" | "task" | "document"; width?: number; height?: number },
  ) => void;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  // Line tool state - lifted to parent for LineLayer integration
  activeTool?: CanvasElementType | null;
  onActiveToolChange?: (tool: CanvasElementType | null) => void;
  // Canvas origin offset for hypercube view (where content is centered)
  canvasOriginOffset?: { x: number; y: number };
}

// Define tools inline to avoid any import issues
const TOOLKIT_TOOLS = [
  {
    type: "freeform" as CanvasElementType,
    label: "Card",
    IconComponent: LucideIcons.StickyNote,
    shortcut: "C",
    hasDropdown: true, // Indicates this tool has a dropdown menu
  },
  {
    type: "image" as CanvasElementType,
    label: "Image",
    IconComponent: LucideIcons.Image,
    shortcut: "I",
  },
  {
    type: "shape" as CanvasElementType,
    label: "Shape",
    IconComponent: LucideIcons.Layers,
    shortcut: "F",
  },
  {
    type: "container" as CanvasElementType,
    label: "Container",
    IconComponent: LucideIcons.FolderOpen,
    shortcut: "O",
  },
  {
    type: "line" as CanvasElementType,
    label: "Line",
    IconComponent: LucideIcons.Slash,
    shortcut: "L",
  },
  {
    type: "text" as CanvasElementType,
    label: "Text",
    IconComponent: LucideIcons.Type,
    shortcut: "T",
  },
  {
    type: "link" as CanvasElementType,
    label: "Link",
    IconComponent: LucideIcons.Link2,
    shortcut: "E",
  },
  {
    type: "board" as CanvasElementType,
    label: "Board",
    IconComponent: LucideIcons.LayoutGrid,
    shortcut: "B",
  },
];

const CARD_TYPE_OPTIONS = [
  {
    type: "note" as const,
    label: "Note Card",
    icon: "📌",
    description: "Regular note card",
  },
  {
    type: "task" as const,
    label: "Task Card",
    icon: "✅",
    description: "Task card with checkbox",
  },
  {
    type: "document" as const,
    label: "Document",
    icon: "📄",
    description: "Compact document icon",
  },
];

const SHAPE_PALETTE = [
  {
    type: "rectangle" as ShapeType,
    label: "Rectangle",
    IconComponent: LucideIcons.Square,
  },
  {
    type: "circle" as ShapeType,
    label: "Circle",
    IconComponent: LucideIcons.Circle,
  },
  {
    type: "diamond" as ShapeType,
    label: "Diamond",
    IconComponent: LucideIcons.Diamond,
  },
  {
    type: "triangle" as ShapeType,
    label: "Triangle",
    IconComponent: LucideIcons.Triangle,
  },
  {
    type: "hexagon" as ShapeType,
    label: "Hexagon",
    IconComponent: LucideIcons.Hexagon,
  },
  { type: "star" as ShapeType, label: "Star", IconComponent: LucideIcons.Star },
];

const LINK_MODES = [
  {
    mode: "bookmark" as LinkMode,
    label: "Link",
    IconComponent: LucideIcons.Bookmark,
  },
  {
    mode: "embed" as LinkMode,
    label: "Embed",
    IconComponent: LucideIcons.Code,
  },
  {
    mode: "file" as LinkMode,
    label: "File",
    IconComponent: LucideIcons.FileUp,
  },
];

export function CanvasToolkit({
  onPlaceElement,
  canvasRef,
  canvasPosition,
  canvasZoom,
  activeTool: controlledActiveTool,
  onActiveToolChange,
  canvasOriginOffset = { x: 0, y: 0 },
}: CanvasToolkitProps) {
  const setCommentMode = useCXDStore((s) => s.setCommentMode);
  // Use controlled state if provided, otherwise use internal state
  const [internalActiveTool, setInternalActiveTool] = useState<CanvasElementType | null>(null);
  const activeTool = controlledActiveTool !== undefined ? controlledActiveTool : internalActiveTool;
  const setActiveTool = onActiveToolChange || setInternalActiveTool;
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<CanvasElementType | null>(null);
  const [dragPreview, setDragPreview] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showShapePalette, setShowShapePalette] = useState(false);
  const [selectedShapeType, setSelectedShapeType] =
    useState<ShapeType>("rectangle");
  const [showLinkPalette, setShowLinkPalette] = useState(false);
  const [selectedLinkMode, setSelectedLinkMode] =
    useState<LinkMode>("bookmark");
  const [showCardTypeMenu, setShowCardTypeMenu] = useState(false);
  const [selectedCardType, setSelectedCardType] = useState<"note" | "task" | "document">("note");
  // Toolbar collapse state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to cancel placement mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setActiveTool(null);
        setShowShapePalette(false);
        setShowLinkPalette(false);
        setShowCardTypeMenu(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setActiveTool]);

  // Drag-to-create state: track mousedown start position for drawing size
  const [shapeCreationDrag, setShapeCreationDrag] = useState<{
    startX: number; startY: number; currentX: number; currentY: number; tool: CanvasElementType;
  } | null>(null);
  const shapeCreationDragRef = useRef(shapeCreationDrag);
  shapeCreationDragRef.current = shapeCreationDrag;

  // Active tool ref so mousemove/mouseup listeners always see latest value
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  // Minimum drag distance (in canvas px) to count as a drag vs a click
  const MIN_DRAG_DISTANCE = 10;

  // Handle click-and-drag placement when tool is active (except for line which uses drag)
  useEffect(() => {
    if (!activeTool || activeTool === "line" || !canvasRef.current) return;

    const isCanvasBackground = (target: HTMLElement) =>
      target.classList.contains("canvas-background") ||
      target.classList.contains("dot-grid") ||
      target === canvasRef.current;

    const toCanvasCoords = (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      return {
        x: (clientX - rect.left - canvasPosition.x - canvasOriginOffset.x) / canvasZoom,
        y: (clientY - rect.top - canvasPosition.y - canvasOriginOffset.y) / canvasZoom,
      };
    };

    const getOptions = () => {
      const tool = activeToolRef.current;
      return tool === "shape"
        ? { shapeType: selectedShapeType }
        : tool === "link"
          ? { linkMode: selectedLinkMode }
          : tool === "freeform"
            ? { cardType: selectedCardType }
            : undefined;
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (!isCanvasBackground(target)) return;

      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      setShapeCreationDrag({
        startX: x, startY: y, currentX: x, currentY: y,
        tool: activeToolRef.current!,
      });
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const drag = shapeCreationDragRef.current;
      if (!drag) return;
      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      setShapeCreationDrag({ ...drag, currentX: x, currentY: y });
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = shapeCreationDragRef.current;
      if (!drag) return;

      const { x, y } = toCanvasCoords(e.clientX, e.clientY);
      const dx = Math.abs(x - drag.startX);
      const dy = Math.abs(y - drag.startY);

      const options = getOptions();

      if (dx >= MIN_DRAG_DISTANCE || dy >= MIN_DRAG_DISTANCE) {
        // Drag: create with custom size — position at top-left of drawn rectangle
        const left = Math.min(drag.startX, x);
        const top = Math.min(drag.startY, y);
        const width = Math.max(dx, 20);
        const height = Math.max(dy, 20);
        // Place at center of the drawn rectangle (handlePlaceElement offsets by half size)
        onPlaceElement(drag.tool, { x: left + width / 2, y: top + height / 2 }, { ...options, width, height });
      } else {
        // Click: use default size, place centered on click
        onPlaceElement(drag.tool, { x: drag.startX, y: drag.startY }, options);
      }

      setShapeCreationDrag(null);
      setActiveTool(null);
      setShowCardTypeMenu(false);
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    activeTool,
    canvasRef,
    canvasPosition,
    canvasZoom,
    onPlaceElement,
    selectedShapeType,
    selectedLinkMode,
    selectedCardType,
    canvasOriginOffset,
    setActiveTool,
  ]);

  // NOTE: Line drawing is now handled by LineLayer component
  // The line tool state is lifted to the parent and passed via props

  // Update cursor when tool is active
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    if (activeTool) {
      canvas.style.cursor = "crosshair";
    } else {
      canvas.style.cursor = "";
    }

    return () => {
      canvas.style.cursor = "";
    };
  }, [activeTool, canvasRef]);

  const handleToolClick = useCallback(
    (type: CanvasElementType) => {
      // Selecting any placement tool turns off comment mode
      setCommentMode(false);

      if (type === "freeform") {
        setShowCardTypeMenu(!showCardTypeMenu);
        setShowShapePalette(false);
        setShowLinkPalette(false);
        if (!showCardTypeMenu) {
          setActiveTool(null);
        }
      } else if (type === "shape") {
        setShowShapePalette(!showShapePalette);
        setShowLinkPalette(false);
        setShowCardTypeMenu(false);
        if (!showShapePalette) {
          setActiveTool(null);
        }
      } else if (type === "link") {
        setShowLinkPalette(!showLinkPalette);
        setShowShapePalette(false);
        setShowCardTypeMenu(false);
        if (!showLinkPalette) {
          setActiveTool(null);
        }
      } else {
        setShowShapePalette(false);
        setShowLinkPalette(false);
        setShowCardTypeMenu(false);
        if (activeTool === type) {
          setActiveTool(null);
        } else {
          setActiveTool(type);
        }
      }
    },
    [activeTool, showShapePalette, showLinkPalette, showCardTypeMenu, setActiveTool, setCommentMode],
  );

  const handleCardTypeSelect = useCallback((cardType: "note" | "task" | "document") => {
    setSelectedCardType(cardType);
    setShowCardTypeMenu(false);
    setActiveTool("freeform");
  }, [setActiveTool]);

  const handleShapeSelect = useCallback((shapeType: ShapeType) => {
    setSelectedShapeType(shapeType);
    setShowShapePalette(false);
    setActiveTool("shape");
  }, [setActiveTool]);

  const handleLinkModeSelect = useCallback((linkMode: LinkMode) => {
    setSelectedLinkMode(linkMode);
    setShowLinkPalette(false);
    setActiveTool("link");
  }, [setActiveTool]);

  const handleDragStart = useCallback(
    (e: React.DragEvent, type: CanvasElementType, shapeType?: ShapeType) => {
      setIsDragging(true);
      setDragType(type);
      if (shapeType) {
        setSelectedShapeType(shapeType);
      }
      setActiveTool(null);
      setShowShapePalette(false);

      // Create a custom drag image
      const size = DEFAULT_ELEMENT_SIZES[type];
      const ghost = document.createElement("div");
      ghost.className = "rounded-lg bg-primary/30 border border-primary/50";
      ghost.style.width = `${size.width * 0.5}px`;
      ghost.style.height = `${size.height * 0.5}px`;
      ghost.style.position = "absolute";
      ghost.style.top = "-1000px";
      document.body.appendChild(ghost);
      e.dataTransfer.setDragImage(ghost, size.width * 0.25, size.height * 0.25);

      // Clean up ghost after drag starts
      setTimeout(() => document.body.removeChild(ghost), 0);
    },
    [setActiveTool],
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (e.clientX === 0 && e.clientY === 0) return;
    setDragPreview({ x: e.clientX, y: e.clientY });
  }, []);

  const handleDragEnd = useCallback(
    (e: React.DragEvent) => {
      if (!dragType || !canvasRef.current) {
        setIsDragging(false);
        setDragType(null);
        setDragPreview(null);
        return;
      }

      const rect = canvasRef.current.getBoundingClientRect();

      // Some browsers (e.g. Firefox) report clientX/Y as 0,0 on dragend — fall back to last known drag position
      const clientX = e.clientX === 0 && e.clientY === 0 && dragPreview ? dragPreview.x : e.clientX;
      const clientY = e.clientX === 0 && e.clientY === 0 && dragPreview ? dragPreview.y : e.clientY;

      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        // Account for canvas origin offset (used in hypercube view where content is centered)
        const x = (clientX - rect.left - canvasPosition.x - canvasOriginOffset.x) / canvasZoom;
        const y = (clientY - rect.top - canvasPosition.y - canvasOriginOffset.y) / canvasZoom;

        const options = dragType === "shape"
          ? { shapeType: selectedShapeType }
          : dragType === "link"
            ? { linkMode: selectedLinkMode }
            : undefined;

        onPlaceElement(dragType, { x, y }, options);
      }

      setIsDragging(false);
      setDragType(null);
      setDragPreview(null);
    },
    [
      dragType,
      canvasRef,
      canvasPosition,
      canvasZoom,
      onPlaceElement,
      selectedShapeType,
      selectedLinkMode,
      canvasOriginOffset,
      dragPreview,
    ],
  );

  return (
    <>
      {/* Floating Toolbar */}
      <div
        ref={toolbarRef}
        data-tour-id="canvas-toolkit"
        className={cn(
          "fixed top-28 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center p-1.5 rounded-full bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] transition-all duration-[3000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
          isCollapsed ? "w-[52px] overflow-hidden" : "w-fit overflow-visible"
        )}
      >
        <div
          className={cn(
            "flex items-center flex-shrink-0 transition-all duration-[3000ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
            isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto gap-1.5 px-1.5 mr-1 overflow-visible"
          )}
        >
          {TOOLKIT_TOOLS.map((tool) => {
            const Icon = tool.IconComponent;
            const isActive =
              activeTool === tool.type ||
              (tool.type === "shape" && showShapePalette);
            const isBeingDragged = isDragging && dragType === tool.type;

            return (
              <div key={tool.type} className="relative flex-shrink-0">
                <button
                  draggable={tool.type !== "shape"}
                  onClick={() => handleToolClick(tool.type)}
                  {...(tool.type === "board" ? { "data-tour-id": "canvas-board-tool" } : {})}
                  onDragStart={(e) => handleDragStart(e, tool.type)}
                  onDrag={handleDrag}
                  onDragEnd={handleDragEnd}
                  title={`${tool.label} (${tool.shortcut})${isActive ? " - Active: Click to place, Esc to cancel" : " - Click to activate or drag to place"}`}
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 group",
                    "hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)] border border-transparent",
                    "active:scale-95",
                    tool.type !== "shape" && "cursor-grab active:cursor-grabbing",
                    isActive &&
                    "bg-gradient-to-b from-violet-500/30 to-violet-950/60 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]",
                    isBeingDragged && "opacity-50",
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-colors",
                      isActive
                        ? "text-white"
                        : "text-white/60 group-hover:text-white",
                    )}
                  />
                </button>
                {/* Shape palette popover */}
                {tool.type === "shape" && showShapePalette && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 p-2 rounded-xl bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl z-50 grid grid-cols-3 gap-1 w-[140px] mt-4 animate-in fade-in zoom-in-95 duration-200">
                    {SHAPE_PALETTE.map((shape) => {
                      const ShapeIcon = shape.IconComponent;
                      return (
                        <button
                          key={shape.type}
                          draggable
                          onClick={() => handleShapeSelect(shape.type)}
                          onDragStart={(e) =>
                            handleDragStart(e, "shape", shape.type)
                          }
                          onDrag={handleDrag}
                          onDragEnd={handleDragEnd}
                          title={shape.label}
                          className={cn(
                            "w-10 h-10 flex items-center justify-center rounded-lg transition-all group",
                            "hover:bg-violet-600/20 hover:border-violet-500/50",
                            selectedShapeType === shape.type &&
                            "bg-violet-600/40 border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.2)]",
                          )}
                        >
                          <ShapeIcon className={cn("w-5 h-5 transition-colors", selectedShapeType === shape.type ? "text-white" : "text-white/60 group-hover:text-white")} />
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Card type menu popover */}
                {tool.type === "freeform" && showCardTypeMenu && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 p-2 rounded-xl bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl z-50 flex flex-col gap-1 w-[180px] mt-4 animate-in fade-in zoom-in-95 duration-200">
                    {CARD_TYPE_OPTIONS.map((cardType) => {
                      return (
                        <button
                          key={cardType.type}
                          onClick={() => handleCardTypeSelect(cardType.type)}
                          title={cardType.description}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-sm group",
                            "hover:bg-violet-600/20 hover:border-violet-500/50",
                            selectedCardType === cardType.type &&
                            "bg-violet-600/40 border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.2)]",
                          )}
                        >
                          <span className="text-lg">{cardType.icon}</span>
                          <span className={cn("font-medium transition-colors", selectedCardType === cardType.type ? "text-white" : "text-white/60 group-hover:text-white")}>{cardType.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {/* Link mode palette popover */}
                {tool.type === "link" && showLinkPalette && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 p-2 rounded-xl bg-white/10 backdrop-blur-3xl border border-white/20 shadow-2xl z-50 flex flex-col gap-1 w-[140px] mt-4 animate-in fade-in zoom-in-95 duration-200">
                    {LINK_MODES.map((linkMode) => {
                      const ModeIcon = linkMode.IconComponent;
                      return (
                        <button
                          key={linkMode.mode}
                          onClick={() => handleLinkModeSelect(linkMode.mode)}
                          title={linkMode.label}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all text-sm group",
                            "hover:bg-violet-600/20 hover:border-violet-500/50",
                            selectedLinkMode === linkMode.mode &&
                            "bg-violet-600/40 border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.2)]",
                          )}
                        >
                          <ModeIcon className={cn("w-4 h-4 transition-colors", selectedLinkMode === linkMode.mode ? "text-white" : "text-white/60 group-hover:text-white")} />
                          <span className={cn("font-medium transition-colors", selectedLinkMode === linkMode.mode ? "text-white" : "text-white/60 group-hover:text-white")}>{linkMode.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {/* Divider */}
          <div className="w-px h-6 bg-white/10 flex-shrink-0 mx-0.5" />

          {/* Comment Mode Toggle */}
          <CommentModeToggle onActivate={() => setActiveTool(null)} />
        </div>

        {/* Collapse/Expand Toggle Wrapper */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-500 group border border-white/5",
              "hover:bg-violet-600/20 hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.2)]",
              isCollapsed && "bg-white/[0.05]"
            )}
            title={isCollapsed ? "Expand Tools" : "Focus Mode - Collapse"}
          >
            {isCollapsed ? (
              <LucideIcons.ChevronRight className="w-5 h-5 text-white/50 group-hover:text-white transition-all transform hover:scale-110" />
            ) : (
              <LucideIcons.ChevronLeft className="w-5 h-5 text-white/50 group-hover:text-white transition-all transform hover:scale-110" />
            )}
          </button>
        </div>
      </div>

      {/* Drag-to-create preview rectangle */}
      {shapeCreationDrag && canvasRef.current && (() => {
        const drag = shapeCreationDrag;
        const rect = canvasRef.current!.getBoundingClientRect();
        const left = Math.min(drag.startX, drag.currentX);
        const top = Math.min(drag.startY, drag.currentY);
        const w = Math.abs(drag.currentX - drag.startX);
        const h = Math.abs(drag.currentY - drag.startY);
        // Convert canvas coords back to screen coords for the overlay
        const screenLeft = left * canvasZoom + canvasPosition.x + canvasOriginOffset.x + rect.left;
        const screenTop = top * canvasZoom + canvasPosition.y + canvasOriginOffset.y + rect.top;
        const screenW = w * canvasZoom;
        const screenH = h * canvasZoom;
        return (
          <div
            className="fixed pointer-events-none z-50 border-2 border-dashed border-primary/70 bg-primary/10 rounded"
            style={{
              left: screenLeft,
              top: screenTop,
              width: screenW,
              height: screenH,
            }}
          />
        );
      })()}

      {/* Active Tool Indicator */}
      {activeTool && (
        <div className="fixed top-44 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {activeTool === "line" ? "Click and drag to draw line" : `Click or drag on canvas to place ${activeTool === "shape"
            ? SHAPE_PALETTE.find((s) => s.type === selectedShapeType)?.label
            : activeTool === "link"
              ? LINK_MODES.find((m) => m.mode === selectedLinkMode)?.label
              : activeTool === "freeform"
                ? CARD_TYPE_OPTIONS.find((c) => c.type === selectedCardType)?.label
                : TOOLKIT_TOOLS.find((t) => t.type === activeTool)?.label
            }`}{" "}
          • Esc to cancel
        </div>
      )}
      {/* Line drawing preview is now handled by LineLayer component */}
    </>
  );
}

/** Comment mode toggle + show-resolved toggle */
function CommentModeToggle({ onActivate }: { onActivate?: () => void }) {
  const { commentMode, toggleCommentMode, showResolvedComments, toggleShowResolved } = useCXDStore();

  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        onClick={() => {
          toggleCommentMode();
          // When entering comment mode, clear any active placement tool
          if (!commentMode && onActivate) onActivate();
        }}
        title={commentMode ? "Exit comment mode" : "Comment mode"}
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-300 group border border-transparent",
          "hover:bg-purple-600/20 hover:border-purple-500/50 hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]",
          "active:scale-95",
          commentMode &&
            "bg-gradient-to-b from-purple-500/30 to-purple-950/60 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.4),inset_0_1px_0_rgba(255,255,255,0.1)]"
        )}
      >
        <LucideIcons.MessageCircle
          className={cn(
            "w-5 h-5 transition-colors",
            commentMode ? "text-white" : "text-white/60 group-hover:text-white"
          )}
        />
      </button>

      {/* Show resolved toggle - only visible when comment mode is active */}
      {commentMode && (
        <button
          onClick={toggleShowResolved}
          title={showResolvedComments ? "Hide resolved comments" : "Show resolved comments"}
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-300 group border border-transparent",
            "hover:bg-green-600/20 hover:border-green-500/50",
            "active:scale-95",
            showResolvedComments &&
              "bg-green-500/20 border-green-500/40"
          )}
        >
          <LucideIcons.CheckCircle
            className={cn(
              "w-4 h-4 transition-colors",
              showResolvedComments ? "text-green-400" : "text-white/40 group-hover:text-white/70"
            )}
          />
        </button>
      )}
    </div>
  );
}
