"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import {
  CanvasElementType,
  DEFAULT_ELEMENT_SIZES,
  ShapeType,
} from "@/types/canvas-elements";
import { cn } from "@/lib/utils";

type LinkMode = 'bookmark' | 'embed' | 'file';

interface CanvasToolkitProps {
  onPlaceElement: (
    type: CanvasElementType,
    position: { x: number; y: number },
    options?: { shapeType?: ShapeType; linkMode?: LinkMode; cardType?: "note" | "task" },
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
  const [selectedCardType, setSelectedCardType] = useState<"note" | "task">("note");
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

  // Handle click placement when tool is active (except for line which uses drag)
  useEffect(() => {
    if (!activeTool || activeTool === "line" || !canvasRef.current) return;

    const handleCanvasClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only place on background or dot-grid, not on elements
      if (
        target.classList.contains("canvas-background") ||
        target.classList.contains("dot-grid") ||
        target === canvasRef.current
      ) {
        const rect = canvasRef.current!.getBoundingClientRect();
        // Account for canvas origin offset (used in hypercube view where content is centered)
        const x = (e.clientX - rect.left - canvasPosition.x - canvasOriginOffset.x) / canvasZoom;
        const y = (e.clientY - rect.top - canvasPosition.y - canvasOriginOffset.y) / canvasZoom;

        const options = activeTool === "shape"
          ? { shapeType: selectedShapeType }
          : activeTool === "link"
          ? { linkMode: selectedLinkMode }
          : activeTool === "freeform"
          ? { cardType: selectedCardType }
          : undefined;

        onPlaceElement(activeTool, { x, y }, options);
        setActiveTool(null);
        setShowCardTypeMenu(false);
      }
    };

    const canvas = canvasRef.current;
    canvas.addEventListener("click", handleCanvasClick);
    return () => canvas.removeEventListener("click", handleCanvasClick);
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
    [activeTool, showShapePalette, showLinkPalette, showCardTypeMenu],
  );

  const handleCardTypeSelect = useCallback((cardType: "note" | "task") => {
    setSelectedCardType(cardType);
    setShowCardTypeMenu(false);
    setActiveTool("freeform");
  }, []);

  const handleShapeSelect = useCallback((shapeType: ShapeType) => {
    setSelectedShapeType(shapeType);
    setShowShapePalette(false);
    setActiveTool("shape");
  }, []);

  const handleLinkModeSelect = useCallback((linkMode: LinkMode) => {
    setSelectedLinkMode(linkMode);
    setShowLinkPalette(false);
    setActiveTool("link");
  }, []);

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
    [],
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

      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        // Account for canvas origin offset (used in hypercube view where content is centered)
        const x = (e.clientX - rect.left - canvasPosition.x - canvasOriginOffset.x) / canvasZoom;
        const y = (e.clientY - rect.top - canvasPosition.y - canvasOriginOffset.y) / canvasZoom;

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
    ],
  );

  return (
    <>
      {/* Floating Toolbar */}
      <div
        ref={toolbarRef}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card/80 backdrop-blur-xl border border-border/50 shadow-lg"
        style={{
          boxShadow:
            "0 0 30px rgba(168, 85, 247, 0.15), 0 4px 20px rgba(0, 0, 0, 0.3)",
        }}
      >
        {TOOLKIT_TOOLS.map((tool) => {
          const Icon = tool.IconComponent;
          const isActive =
            activeTool === tool.type ||
            (tool.type === "shape" && showShapePalette);
          const isBeingDragged = isDragging && dragType === tool.type;

          return (
            <div key={tool.type} className="relative">
              <button
                draggable={tool.type !== "shape"}
                onClick={() => handleToolClick(tool.type)}
                onDragStart={(e) => handleDragStart(e, tool.type)}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                title={`${tool.label} (${tool.shortcut})${isActive ? " - Active: Click to place, Esc to cancel" : " - Click to activate or drag to place"}`}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                  "hover:bg-primary/20 hover:scale-105",
                  "active:scale-95",
                  tool.type !== "shape" && "cursor-grab active:cursor-grabbing",
                  isActive &&
                    "bg-primary/30 ring-2 ring-primary shadow-[0_0_15px_rgba(168,85,247,0.4)]",
                  isBeingDragged && "opacity-50",
                )}
              >
                <Icon
                  className={cn(
                    "w-5 h-5 transition-colors",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                />
              </button>
              {/* Shape palette popover */}
              {tool.type === "shape" && showShapePalette && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 p-2 rounded-lg backdrop-blur border border-border shadow-xl z-50 grid grid-cols-3 gap-1 w-[134px] h-[102px] py-[8px] mt-[14.75px] bg-card opacity-100">
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
                          "w-10 h-10 flex items-center justify-center rounded-lg transition-all",
                          "hover:bg-primary/20",
                          selectedShapeType === shape.type &&
                            "bg-primary/30 ring-1 ring-primary",
                        )}
                      >
                        <ShapeIcon className="w-5 h-5" />
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Card type menu popover */}
              {tool.type === "freeform" && showCardTypeMenu && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 p-2 py-[8px] rounded-lg backdrop-blur border border-border shadow-xl z-50 flex flex-col gap-1 w-[160px] mt-[14.75px] bg-card opacity-100">
                  {CARD_TYPE_OPTIONS.map((cardType) => {
                    return (
                      <button
                        key={cardType.type}
                        onClick={() => handleCardTypeSelect(cardType.type)}
                        title={cardType.description}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm",
                          "hover:bg-primary/20",
                          selectedCardType === cardType.type &&
                            "bg-primary/30 ring-1 ring-primary",
                        )}
                      >
                        <span className="text-lg">{cardType.icon}</span>
                        <span>{cardType.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {/* Link mode palette popover */}
              {tool.type === "link" && showLinkPalette && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 p-2 py-[8px] rounded-lg backdrop-blur border border-border shadow-xl z-50 flex flex-col gap-1 w-[110px] mt-[14.75px] bg-card opacity-100">
                  {LINK_MODES.map((linkMode) => {
                    const ModeIcon = linkMode.IconComponent;
                    return (
                      <button
                        key={linkMode.mode}
                        onClick={() => handleLinkModeSelect(linkMode.mode)}
                        title={linkMode.label}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm",
                          "hover:bg-primary/20",
                          selectedLinkMode === linkMode.mode &&
                            "bg-primary/30 ring-1 ring-primary",
                        )}
                      >
                        <ModeIcon className="w-4 h-4" />
                        <span>{linkMode.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Active Tool Indicator */}
      {activeTool && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          {activeTool === "line" ? "Click and drag to draw line" : `Click on canvas to place ${
            activeTool === "shape"
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
