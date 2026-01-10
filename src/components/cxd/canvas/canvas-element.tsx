"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  CanvasElement,
  FreeformElement,
  ImageElement,
  ShapeElement,
  ContainerElement,
  TextElement,
  LinkElement,
  LineElement,
  BoardElement,
  ExperienceBlockElement,
  InspectorSectionId,
  PRESET_COLORS,
  SOLID_STROKE_COLORS,
  TEXT_GRADIENTS,
  FONT_FAMILIES,
  ShapeType,
} from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { useCXDStore } from "@/store/cxd-store";
import { CXDProject } from "@/types/cxd-schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GripVertical,
  Trash2,
  Copy,
  ImageIcon,
  Link2,
  Upload,
  ExternalLink,
  Globe,
  Code,
  Bookmark,
  LayoutGrid,
  ChevronRight,
  Bold,
  Smile,
  Palette,
  Paintbrush,
  PenLine,
  Star,
  Image,
  FileText,
  Film,
  Box,
  Heart,
  Edit2,
  Type,
  ArrowUp,
  ArrowDown,
  FileUp,
} from "lucide-react";
import { createClient } from "../../../../supabase/client";

interface CanvasElementRendererProps {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isSelected: boolean;
  isDropTarget?: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  canvasZoom: number;
  onEnterBoard?: (boardId: string, title: string) => void;
  onStartConnector?: (
    elementId: string,
    anchor: "top" | "right" | "bottom" | "left",
  ) => void;
  onEndConnector?: (
    toElementId: string,
    toAnchor: "top" | "right" | "bottom" | "left",
  ) => void;
  isConnecting?: boolean;
  isHoverTarget?: boolean;
  onOpenExperiencePanel?: (sectionId: InspectorSectionId) => void;
}

export function CanvasElementRenderer({
  element,
  onUpdate,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragEnd,
  isDragging,
  isSelected,
  isDropTarget,
  onSelect,
  canvasZoom,
  onEnterBoard,
  onStartConnector,
  onEndConnector,
  isConnecting,
  isHoverTarget,
  onOpenExperiencePanel,
}: CanvasElementRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkViewMenu, setShowLinkViewMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBoardIconPicker, setShowBoardIconPicker] = useState(false);
  const [showBoardColorPicker, setShowBoardColorPicker] = useState(false);
  const [showExperienceViewMenu, setShowExperienceViewMenu] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.type === "board" && onEnterBoard) {
        const boardEl = element as BoardElement;
        onEnterBoard(boardEl.childBoardId, boardEl.title);
      } else if (element.type === "experienceBlock" && onOpenExperiencePanel) {
        const expEl = element as ExperienceBlockElement;
        onOpenExperiencePanel(expEl.componentKey);
      } else if (element.type !== "connector" && element.type !== "line" && element.type !== "shape" && element.type !== "experienceBlock") {
        // Don't auto-edit shapes, lines, or experience blocks on double-click
        setIsEditing(true);
      }
    },
    [element, onEnterBoard, onOpenExperiencePanel],
  );

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Auto-resize experience blocks when view mode changes
  useEffect(() => {
    if (element.type === "experienceBlock") {
      const expElement = element as ExperienceBlockElement;
      const viewMode = expElement.viewMode || "compact";
      
      if (viewMode === "inline") {
        // Inline mode: larger size for editor
        if (element.width < 420 || element.height < 360) {
          onUpdate({
            width: 420,
            height: 360,
          });
        }
      } else {
        // Compact mode: small size
        if (element.width > 220 || element.height > 100) {
          onUpdate({
            width: 220,
            height: 100,
          });
        }
      }
    }
  }, [element.type, (element as ExperienceBlockElement).viewMode]);

  // Z-index management helpers
  const handleBringForward = useCallback(() => {
    onUpdate({ zIndex: (element.zIndex || 0) + 1 });
  }, [element.zIndex, onUpdate]);

  const handleSendBackward = useCallback(() => {
    onUpdate({ zIndex: Math.max(0, (element.zIndex || 0) - 1) });
  }, [element.zIndex, onUpdate]);

  // Handle drag from element body (not just the handle)
  const handleBodyMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't start drag if clicking on interactive elements
      const target = e.target as HTMLElement;
      const isInteractive = target.closest(
        "input, textarea, button, a, select, iframe, [data-no-drag]",
      );

      // For link embeds, don't drag from within the iframe area
      if (
        element.type === "link" &&
        (element as LinkElement).linkMode === "embed"
      ) {
        const isIframeArea =
          target.closest("iframe") || target.tagName === "IFRAME";
        if (isIframeArea) return;
      }

      if (!isInteractive && !isEditing) {
        onDragStart(e);
      }
    },
    [onDragStart, isEditing, element],
  );

  const renderContent = () => {
    switch (element.type) {
      case "freeform":
        return (
          <FreeformCard
            element={element}
            onUpdate={onUpdate}
            isEditing={isEditing}
            onBlur={handleBlur}
          />
        );
      case "image":
        return (
          <ImageCard
            element={element}
            onUpdate={onUpdate}
            isSelected={isSelected}
          />
        );
      case "shape":
        return (
          <ShapeCard
            element={element}
            onUpdate={onUpdate}
            isEditing={isEditing}
            onBlur={handleBlur}
          />
        );
      case "container":
        return (
          <ContainerCard
            element={element}
            isEditing={isEditing}
            onUpdate={onUpdate}
            onBlur={handleBlur}
            isSelected={isSelected}
            // TODO: Wire from canvas drag state
            isDropTarget={false}
          />
        );
      case "text":
        return (
          <TextCard
            element={element}
            onUpdate={onUpdate}
            isEditing={isEditing}
            onBlur={handleBlur}
          />
        );
      case "link":
        return (
          <LinkCard
            element={element}
            onUpdate={onUpdate}
            isSelected={isSelected}
          />
        );
      case "line":
        // Lines are now rendered in LinesOverlay (SVG overlay system)
        return null;
      case "board":
        return (
          <BoardCard
            element={element}
            onUpdate={onUpdate}
            isEditing={isEditing}
            onBlur={handleBlur}
            isDropTarget={isDropTarget}
            showIconPicker={showBoardIconPicker}
            setShowIconPicker={setShowBoardIconPicker}
          />
        );
      case "experienceBlock":
        return (
          <ExperienceBlockCard
            element={element as ExperienceBlockElement}
            onOpenPanel={onOpenExperiencePanel}
          />
        );
      default:
        return null;
    }
  };

  // Don't render connectors as regular elements
  if (element.type === "connector") return null;

  return (
    <div
      ref={elementRef}
      data-element-id={element.id}
      className={cn(
        "absolute group transition-shadow duration-200 pointer-events-auto",
        isDragging && "opacity-80 shadow-2xl cursor-grabbing",
        // Selection ring for non-text elements (excluding lines which handle their own visualization)
        isSelected &&
          element.type !== "board" &&
          element.type !== "text" &&
          element.type !== "line" &&
          "ring-2 ring-primary shadow-[0_0_20px_rgba(168,85,247,0.3)]",
        // Selection ring for boards only when drop target
        isSelected &&
          element.type === "board" &&
          isDropTarget &&
          "ring-2 ring-primary shadow-[0_0_20px_rgba(168,85,247,0.3)]",
        // Glow when connector is hovering this element
        isHoverTarget &&
          "ring-2 ring-green-400 shadow-[0_0_30px_rgba(74,222,128,0.6)]",
        // Subtle glow for text when editing
        isEditing &&
          element.type === "text" &&
          "shadow-[0_0_12px_rgba(168,85,247,0.15)]",
        // Cursor styles
        !isDragging && !isEditing && element.type !== "text" && element.type !== "line" && "cursor-grab",
        !isDragging && !isEditing && element.type === "text" && "cursor-text",
      )}
      style={{
        left: element.x,
        top: element.y,
        width: element.width,
        height: element.height,
        zIndex: element.zIndex,
        transform: element.rotation
          ? `rotate(${element.rotation}deg)`
          : undefined,
      }}
      data-node-id={element.id}
      data-canvas-node="true"
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      onMouseDown={handleBodyMouseDown}
      onMouseUp={onDragEnd}
      onDoubleClick={handleDoubleClick}
    >
      {/* Connection anchors - shown when connecting or hovering (not for line elements) */}
      {(isConnecting || isSelected) && onStartConnector && element.type !== "line" && (
        <>
          <ConnectionAnchor
            position="top"
            elementId={element.id}
            onStartConnector={onStartConnector}
            onEndConnector={onEndConnector}
            isConnecting={isConnecting}
            isHoverTarget={isHoverTarget}
          />
          <ConnectionAnchor
            position="right"
            elementId={element.id}
            onStartConnector={onStartConnector}
            onEndConnector={onEndConnector}
            isConnecting={isConnecting}
            isHoverTarget={isHoverTarget}
          />
          <ConnectionAnchor
            position="bottom"
            elementId={element.id}
            onStartConnector={onStartConnector}
            onEndConnector={onEndConnector}
            isConnecting={isConnecting}
            isHoverTarget={isHoverTarget}
          />
          <ConnectionAnchor
            position="left"
            elementId={element.id}
            onStartConnector={onStartConnector}
            onEndConnector={onEndConnector}
            isConnecting={isConnecting}
            isHoverTarget={isHoverTarget}
          />
        </>
      )}
      {/* Unified context menu (hidden for line elements as they have floating menu) */}
      {isSelected && !isDragging && element.type !== "line" && (
        <div
          className={cn(
            "absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-lg",
            "bg-card/95 backdrop-blur border border-border/50 shadow-lg z-50 top-[-57px]",
          )}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Element-specific actions */}
          {element.type === "shape" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showColorPicker && "bg-primary/20 text-primary",
                  )}
                  title="Color"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && element.type === "shape" && (
                  <ShapeColorPicker
                    fillColor={(element as ShapeElement).style?.bgColor}
                    strokeColor={(element as ShapeElement).style?.borderColor}
                    strokeWidth={(element as ShapeElement).style?.borderWidth}
                    fillOpacity={(element as ShapeElement).style?.fillOpacity}
                    onFillColorChange={(color) =>
                      onUpdate({ style: { ...element.style, bgColor: color } })
                    }
                    onStrokeColorChange={(color) =>
                      onUpdate({
                        style: { ...element.style, borderColor: color },
                      })
                    }
                    onStrokeWidthChange={(width) =>
                      onUpdate({
                        style: { ...element.style, borderWidth: width },
                      })
                    }
                    onFillOpacityChange={(opacity) =>
                      onUpdate({
                        style: { ...element.style, fillOpacity: opacity },
                      })
                    }
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                title="Add Text"
              >
                <Type className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "freeform" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showColorPicker && "bg-primary/20 text-primary",
                  )}
                  title="Color"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && element.type === "freeform" && (
                  <ColorPicker
                    currentColor={
                      (element as FreeformElement).style?.bgColor ||
                      "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)"
                    }
                    onColorChange={(color) =>
                      onUpdate({ style: { ...element.style, bgColor: color } })
                    }
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </div>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowEmojiPicker(!showEmojiPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showEmojiPicker && "bg-primary/20 text-primary",
                  )}
                  title="Emoji"
                >
                  <Smile className="w-4 h-4" />
                </button>
                {showEmojiPicker && element.type === "freeform" && (
                  <EmojiPicker
                    onEmojiSelect={(emoji) => {
                      onUpdate({ emoji } as Partial<CanvasElement>);
                      setShowEmojiPicker(false);
                    }}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const isBold =
                    (element as FreeformElement).style?.fontWeight === "bold" ||
                    (element as FreeformElement).style?.fontWeight ===
                      "semibold";
                  onUpdate({
                    style: {
                      ...element.style,
                      fontWeight: isBold ? "normal" : "bold",
                    },
                  });
                }}
                className={cn(
                  "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                  ((element as FreeformElement).style?.fontWeight === "bold" ||
                    (element as FreeformElement).style?.fontWeight ===
                      "semibold") &&
                    "bg-primary/20 text-primary",
                )}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "link" && (element as LinkElement).linkMode === "file" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowLinkViewMenu(!showLinkViewMenu);
                  }}
                  className={cn(
                    "p-1.5 rounded text-muted-foreground hover:text-primary transition-colors",
                    showLinkViewMenu
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-primary/20",
                  )}
                  title="File View"
                >
                  {(element as LinkElement).fileViewMode === "preview" ? (
                    <Code className="w-4 h-4" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                </button>
                {showLinkViewMenu && (
                  <FileViewSubmenu
                    currentMode={
                      (element as LinkElement).fileViewMode || "bookmark"
                    }
                    onModeSelect={(mode) => {
                      onUpdate({ fileViewMode: mode } as Partial<CanvasElement>);
                      setShowLinkViewMenu(false);
                    }}
                    onClose={() => setShowLinkViewMenu(false)}
                  />
                )}
              </div>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "board" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBoardIconPicker(!showBoardIconPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showBoardIconPicker && "bg-primary/20 text-primary",
                  )}
                  title="Change Icon"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {showBoardIconPicker && (
                  <BoardIconPicker
                    currentIcon={(element as BoardElement).icon}
                    onIconSelect={(id) => {
                      onUpdate({ icon: id } as Partial<CanvasElement>);
                      setShowBoardIconPicker(false);
                    }}
                    onClose={() => setShowBoardIconPicker(false)}
                  />
                )}
              </div>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBoardColorPicker(!showBoardColorPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showBoardColorPicker && "bg-primary/20 text-primary",
                  )}
                  title="Color"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showBoardColorPicker && (
                  <BoardColorPicker
                    currentColor={(element as BoardElement).hexColor}
                    onColorSelect={(gradient) => {
                      onUpdate({
                        hexColor: gradient,
                      } as Partial<CanvasElement>);
                      setShowBoardColorPicker(false);
                    }}
                    onClose={() => setShowBoardColorPicker(false)}
                  />
                )}
              </div>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "experienceBlock" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowExperienceViewMenu(!showExperienceViewMenu);
                  }}
                  className={cn(
                    "p-1.5 rounded text-muted-foreground hover:text-primary transition-colors",
                    showExperienceViewMenu
                      ? "bg-primary/20 text-primary"
                      : "hover:bg-primary/20",
                  )}
                  title="View Mode"
                >
                  {(element as ExperienceBlockElement).viewMode === "inline" ? (
                    <LayoutGrid className="w-4 h-4" />
                  ) : (
                    <Box className="w-4 h-4" />
                  )}
                </button>
                {showExperienceViewMenu && (
                  <ExperienceViewSubmenu
                    currentMode={
                      (element as ExperienceBlockElement).viewMode || "compact"
                    }
                    onModeSelect={(mode) => {
                      onUpdate({ viewMode: mode } as Partial<CanvasElement>);
                      setShowExperienceViewMenu(false);
                    }}
                    onClose={() => setShowExperienceViewMenu(false)}
                  />
                )}
              </div>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "container" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showColorPicker && "bg-primary/20 text-primary",
                  )}
                  title="Styling"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && element.type === "container" && (
                  <ContainerStylePicker
                    fillColor={(element as ContainerElement).style?.bgColor}
                    strokeColor={
                      (element as ContainerElement).style?.borderColor
                    }
                    strokeWidth={
                      (element as ContainerElement).style?.borderWidth
                    }
                    fillOpacity={
                      (element as ContainerElement).style?.fillOpacity
                    }
                    onFillColorChange={(color) =>
                      onUpdate({ style: { ...element.style, bgColor: color } })
                    }
                    onStrokeColorChange={(color) =>
                      onUpdate({
                        style: { ...element.style, borderColor: color },
                      })
                    }
                    onStrokeWidthChange={(width) =>
                      onUpdate({
                        style: { ...element.style, borderWidth: width },
                      })
                    }
                    onFillOpacityChange={(opacity) =>
                      onUpdate({
                        style: { ...element.style, fillOpacity: opacity },
                      })
                    }
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </div>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "text" && (
            <>
              {/* Font family dropdown */}
              <select
                value={(element as TextElement).style?.fontFamily || "inherit"}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdate({
                    style: { ...element.style, fontFamily: e.target.value },
                  });
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-card/80 border border-border/50 rounded px-1.5 py-1 cursor-pointer max-w-[100px]"
                title="Font Family"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              {/* Bold toggle */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const isBold =
                    (element as TextElement).style?.fontWeight === "bold" ||
                    (element as TextElement).style?.fontWeight === "semibold";
                  onUpdate({
                    style: {
                      ...element.style,
                      fontWeight: isBold ? "normal" : "bold",
                    },
                  });
                }}
                className={cn(
                  "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                  ((element as TextElement).style?.fontWeight === "bold" ||
                    (element as TextElement).style?.fontWeight ===
                      "semibold") &&
                    "bg-primary/20 text-primary",
                )}
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              {/* Alignment controls */}
              <select
                value={(element as TextElement).textAlign || "left"}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdate({
                    textAlign: e.target.value as "left" | "center" | "right",
                  });
                }}
                onClick={(e) => e.stopPropagation()}
                className="text-xs bg-card/80 border border-border/50 rounded px-1.5 py-1 cursor-pointer"
                title="Text Align"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              {/* Color/Gradient picker */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setShowColorPicker(!showColorPicker);
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showColorPicker && "bg-primary/20 text-primary",
                  )}
                  title="Color"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && element.type === "text" && (
                  <TextColorPicker
                    currentColor={(element as TextElement).style?.textColor}
                    currentGradient={(element as TextElement).style?.bgColor}
                    onColorChange={(color) =>
                      onUpdate({
                        style: {
                          ...element.style,
                          textColor: color,
                          bgColor: undefined,
                        },
                      })
                    }
                    onGradientChange={(gradient) =>
                      onUpdate({
                        style: {
                          ...element.style,
                          bgColor: gradient,
                          textColor: undefined,
                        },
                      })
                    }
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </div>
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {/* Universal actions */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleBringForward();
            }}
            className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Bring Forward"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSendBackward();
            }}
            className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Send Backward"
          >
            <ArrowDown className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Element content */}
      {renderContent()}
      {/* Resize handles - shown when selected (not for boards, text, or line elements) */}
      {isSelected && !isDragging && element.type !== "board" && element.type !== "text" && element.type !== "line" && (
        <>
          <ResizeHandle
            position="se"
            element={element}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
          />
          <ResizeHandle
            position="sw"
            element={element}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
          />
          <ResizeHandle
            position="ne"
            element={element}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
          />
          <ResizeHandle
            position="nw"
            element={element}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
          />
        </>
      )}
      {/* Text font-size resize handle - shown when text selected and not editing */}
      {isSelected && !isEditing && element.type === "text" && (
        <>
          <TextFontSizeHandle
            element={element as TextElement}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
          />
          <TextWrapWidthHandle
            element={element as TextElement}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
          />
        </>
      )}
    </div>
  );
}

// Connection anchor for connectors
function ConnectionAnchor({
  position,
  elementId,
  onStartConnector,
  onEndConnector,
  isConnecting,
  isHoverTarget,
}: {
  position: "top" | "right" | "bottom" | "left";
  elementId: string;
  onStartConnector: (
    elementId: string,
    anchor: "top" | "right" | "bottom" | "left",
  ) => void;
  onEndConnector?: (
    toElementId: string,
    toAnchor: "top" | "right" | "bottom" | "left",
  ) => void;
  isConnecting?: boolean;
  isHoverTarget?: boolean;
}) {
  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: -6, left: "50%", transform: "translateX(-50%)" },
    right: { right: -6, top: "50%", transform: "translateY(-50%)" },
    bottom: { bottom: -6, left: "50%", transform: "translateX(-50%)" },
    left: { left: -6, top: "50%", transform: "translateY(-50%)" },
  };

  return (
    <div
      className={cn(
        "absolute w-3 h-3 bg-primary/80 border-2 border-background rounded-full cursor-crosshair hover:bg-primary hover:scale-125 transition-all z-20 pointer-events-auto",
        isConnecting && "bg-green-500 hover:bg-green-400",
        isHoverTarget && "bg-green-400 scale-150 shadow-[0_0_20px_rgba(74,222,128,0.8)]",
      )}
      style={positionStyles[position]}
      data-port-id={`${elementId}-${position}`}
      data-node-id={elementId}
      data-port={position}
      onMouseDown={(e) => {
        e.stopPropagation();
        console.log('[PORT] Mouse down on port:', elementId, position, 'isConnecting:', isConnecting);
        if (isConnecting && onEndConnector) {
          console.log('[PORT] Ending connector at:', elementId, position);
          onEndConnector(elementId, position);
        } else {
          console.log('[PORT] Starting connector from:', elementId, position);
          onStartConnector(elementId, position);
        }
      }}
    />
  );
}

// Resize handle component
function ResizeHandle({
  position,
  element,
  onUpdate,
  canvasZoom,
}: {
  position: "nw" | "ne" | "sw" | "se";
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  canvasZoom: number;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = element.width;
      const startHeight = element.height;
      const startPosX = element.x;
      const startPosY = element.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startX) / canvasZoom;
        const deltaY = (moveEvent.clientY - startY) / canvasZoom;

        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startPosX;
        let newY = startPosY;

        if (position.includes("e")) {
          newWidth = Math.max(50, startWidth + deltaX);
        }
        if (position.includes("w")) {
          newWidth = Math.max(50, startWidth - deltaX);
          newX = startPosX + (startWidth - newWidth);
        }
        if (position.includes("s")) {
          newHeight = Math.max(30, startHeight + deltaY);
        }
        if (position.includes("n")) {
          newHeight = Math.max(30, startHeight - deltaY);
          newY = startPosY + (startHeight - newHeight);
        }

        onUpdate({ width: newWidth, height: newHeight, x: newX, y: newY });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onUpdate, position, canvasZoom],
  );

  const positionStyles: Record<string, React.CSSProperties> = {
    nw: { top: -4, left: -4, cursor: "nw-resize" },
    ne: { top: -4, right: -4, cursor: "ne-resize" },
    sw: { bottom: -4, left: -4, cursor: "sw-resize" },
    se: { bottom: -4, right: -4, cursor: "se-resize" },
  };

  return (
    <div
      className="absolute w-3 h-3 bg-primary border-2 border-background rounded-sm z-10"
      style={positionStyles[position]}
      onMouseDown={handleMouseDown}
    />
  );
}

// Text font-size resize handle - drag to scale font size
function TextFontSizeHandle({
  element,
  onUpdate,
  canvasZoom,
}: {
  element: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
  canvasZoom: number;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startY = e.clientY;
      const startFontSize = element.style?.fontSize || 16;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Calculate delta - diagonal movement (right/down increases, left/up decreases)
        const deltaX = (moveEvent.clientX - startX) / canvasZoom;
        const deltaY = (moveEvent.clientY - startY) / canvasZoom;
        const delta = (deltaX + deltaY) / 2; // Average of both axes for smooth diagonal

        // Scale factor: each 10px of drag = 1px font size change
        const fontSizeChange = Math.round(delta / 10);
        let newFontSize = startFontSize + fontSizeChange;

        // Clamp to reasonable bounds
        newFontSize = Math.max(8, Math.min(180, newFontSize));

        onUpdate({
          style: {
            ...element.style,
            fontSize: newFontSize,
          },
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onUpdate, canvasZoom],
  );

  return (
    <div
      className={cn(
        "absolute bottom-0 right-0 w-5 h-5 bg-primary/90 border-2 border-background rounded-sm z-10 flex items-center justify-center cursor-nwse-resize transition-all hover:scale-110",
        isDragging && "scale-125 shadow-lg"
      )}
      style={{
        transform: 'translate(50%, 50%)',
      }}
      onMouseDown={handleMouseDown}
      title="Drag to resize text"
    >
      <Type className="w-3 h-3 text-background" />
    </div>
  );
}

// Text wrap-width handle - drag horizontally to control text wrapping
function TextWrapWidthHandle({
  element,
  onUpdate,
  canvasZoom,
}: {
  element: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
  canvasZoom: number;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);

      const startX = e.clientX;
      const startWidth = element.wrapWidth || element.width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Calculate horizontal delta only
        const deltaX = (moveEvent.clientX - startX) / canvasZoom;
        let newWrapWidth = startWidth + deltaX;

        // Clamp to reasonable bounds (min 60px, no max)
        newWrapWidth = Math.max(60, newWrapWidth);

        onUpdate({
          wrapWidth: newWrapWidth,
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onUpdate, canvasZoom],
  );

  return (
    <div
      className={cn(
        "absolute top-0 right-0 w-5 h-5 bg-accent/90 border-2 border-background rounded-sm z-10 flex items-center justify-center cursor-ew-resize transition-all hover:scale-110",
        isDragging && "scale-125 shadow-lg"
      )}
      style={{
        transform: 'translate(50%, -50%)',
      }}
      onMouseDown={handleMouseDown}
      title="Drag to control text wrapping"
    >
      <svg
        className="w-3 h-3 text-background"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12h16M4 6h16M4 18h10" />
      </svg>
    </div>
  );
}

// Color picker popover - positioned above the toolbar
function ColorPicker({
  currentColor,
  onColorChange,
  onClose,
  position = "above",
}: {
  currentColor?: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
  position?: "above" | "below";
}) {
  return (
    <div
      className={cn(
        "absolute p-2 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-[100] grid grid-cols-4 gap-1 w-[148px]",
        position === "above"
          ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
          : "top-full mt-2 left-1/2 -translate-x-1/2",
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {PRESET_COLORS.map((color) => (
        <button
          key={color}
          className={cn(
            "w-6 h-6 rounded border-2 transition-transform hover:scale-110",
            currentColor === color ? "border-primary" : "border-transparent",
            color === "transparent" &&
              "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]",
          )}
          style={{
            background: color === "transparent" ? undefined : color,
          }}
          onClick={() => {
            onColorChange(color);
            onClose();
          }}
        />
      ))}
    </div>
  );
}

// Shape color picker with fill/stroke toggle and stroke width control
function ShapeColorPicker({
  fillColor,
  strokeColor,
  strokeWidth,
  fillOpacity,
  onFillColorChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onFillOpacityChange,
  onClose,
}: {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  onFillColorChange: (color: string) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillOpacityChange: (opacity: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"fill" | "stroke">("fill");
  const currentWidth = strokeWidth || 2;
  const currentOpacity = fillOpacity !== undefined ? fillOpacity : 100;

  return (
    <div
      className="absolute mb-2 p-3 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg z-[100] min-w-[180px] pointer-events-auto left-[10px] bottom-[-254px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 p-0.5 bg-muted/50 rounded-md">
        <button
          onClick={() => setMode("fill")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs rounded transition-colors",
            mode === "fill"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          <Paintbrush className="w-3 h-3" />
          Fill
        </button>
        <button
          onClick={() => setMode("stroke")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs rounded transition-colors",
            mode === "stroke"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          <PenLine className="w-3 h-3" />
          Outline
        </button>
      </div>
      {/* Color grid */}
      <div className="grid grid-cols-4 gap-1 mb-3">
        {(mode === "fill" ? PRESET_COLORS : SOLID_STROKE_COLORS).map((color) => (
          <button
            key={color}
            className={cn(
              "w-6 h-6 rounded border-2 transition-transform hover:scale-110",
              (mode === "fill" ? fillColor : strokeColor) === color
                ? "border-primary"
                : "border-transparent",
              color === "transparent" &&
                "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]",
            )}
            style={{
              background: color === "transparent" ? undefined : color,
            }}
            onClick={() => {
              if (mode === "fill") {
                onFillColorChange(color);
              } else {
                onStrokeColorChange(color);
              }
            }}
          />
        ))}
      </div>
      {/* Stroke width control - only show when in stroke mode */}
      {mode === "stroke" && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Stroke Width</span>
            <span className="text-xs font-mono">{currentWidth}px</span>
          </div>
          <Slider
            value={[currentWidth]}
            onValueChange={(value) => onStrokeWidthChange(value[0])}
            min={1}
            max={12}
            step={1}
            className="w-full"
          />
        </div>
      )}
      {/* Fill opacity control - only show when in fill mode */}
      {mode === "fill" && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Opacity</span>
            <span className="text-xs font-mono">{currentOpacity}%</span>
          </div>
          <Slider
            value={[currentOpacity]}
            onValueChange={(value) => onFillOpacityChange(value[0])}
            min={0}
            max={100}
            step={1}
            className="w-full"
          />
        </div>
      )}
      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full mt-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// Container style picker (fill/stroke/opacity)
function ContainerStylePicker({
  fillColor,
  strokeColor,
  strokeWidth,
  fillOpacity,
  onFillColorChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onFillOpacityChange,
  onClose,
}: {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  onFillColorChange: (color: string) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillOpacityChange: (opacity: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"fill" | "stroke">("fill");
  const currentWidth = strokeWidth || 2;
  const currentOpacity = fillOpacity !== undefined ? fillOpacity : 20;

  return (
    <div
      className="absolute left-0 bottom-full mb-2 p-3 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg z-[100] min-w-[180px] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 p-0.5 bg-muted/50 rounded-md">
        <button
          onClick={() => setMode("fill")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs rounded transition-colors",
            mode === "fill"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          <Paintbrush className="w-3 h-3" />
          Fill
        </button>
        <button
          onClick={() => setMode("stroke")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-1 px-2 text-xs rounded transition-colors",
            mode === "stroke"
              ? "bg-primary text-primary-foreground"
              : "hover:bg-muted",
          )}
        >
          <PenLine className="w-3 h-3" />
          Outline
        </button>
      </div>
      {/* Color options */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          "transparent",
          "hsl(var(--primary) / 0.1)",
          "hsl(var(--primary) / 0.2)",
        ].map((color) => (
          <button
            key={color}
            className={cn(
              "h-8 rounded border-2 transition-transform hover:scale-110",
              (mode === "fill" ? fillColor : strokeColor) === color
                ? "border-primary"
                : "border-transparent",
              color === "transparent" &&
                "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]",
            )}
            style={{
              background: color === "transparent" ? undefined : color,
            }}
            onClick={() => {
              if (mode === "fill") {
                onFillColorChange(color);
              } else {
                onStrokeColorChange(color);
              }
            }}
          />
        ))}
      </div>
      {/* Stroke width control - only show when in stroke mode */}
      {mode === "stroke" && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Stroke Width</span>
            <span className="text-xs font-mono">{currentWidth}px</span>
          </div>
          <Slider
            value={[currentWidth]}
            onValueChange={(value) => onStrokeWidthChange(value[0])}
            min={1}
            max={6}
            step={1}
            className="w-full"
          />
        </div>
      )}
      {/* Fill opacity control - only show when in fill mode */}
      {mode === "fill" && (
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">Opacity</span>
            <span className="text-xs font-mono">{currentOpacity}%</span>
          </div>
          <Slider
            value={[currentOpacity]}
            onValueChange={(value) => onFillOpacityChange(value[0])}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
      )}
      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full mt-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// Text color picker (solids + gradients)
function TextColorPicker({
  currentColor,
  currentGradient,
  onColorChange,
  onGradientChange,
  onClose,
}: {
  currentColor?: string;
  currentGradient?: string;
  onColorChange: (color: string) => void;
  onGradientChange: (gradient: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"solid" | "gradient">("solid");

  // Solid colors for text (white, grays, and some accent colors)
  const solidColors = [
    "#ffffff", // White
    "#e5e5e5", // Light gray
    "#a3a3a3", // Gray
    "#737373", // Dark gray
    "#404040", // Darker gray
    "#22D3EE", // Cyan
    "#A855F7", // Purple
    "#F472B6", // Pink
    "#34D399", // Green
    "#60A5FA", // Blue
  ];

  return (
    <div
      className="absolute left-0 bottom-full mb-2 p-3 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg z-[100] min-w-[200px] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 p-0.5 bg-muted/50 rounded-md">
        <button
          onClick={() => setMode("solid")}
          className={cn(
            "flex-1 py-1 px-2 text-xs rounded transition-colors",
            mode === "solid"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Solid
        </button>
        <button
          onClick={() => setMode("gradient")}
          className={cn(
            "flex-1 py-1 px-2 text-xs rounded transition-colors",
            mode === "gradient"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Gradient
        </button>
      </div>
      {/* Solid color swatches */}
      {mode === "solid" && (
        <div className="grid grid-cols-5 gap-2">
          {solidColors.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorChange(color);
                onClose();
              }}
              className={cn(
                "w-8 h-8 rounded-md border-2 transition-all hover:scale-110",
                currentColor === color && !currentGradient
                  ? "border-foreground shadow-lg"
                  : "border-border/50 hover:border-border",
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
      )}
      {/* Gradient swatches */}
      {mode === "gradient" && (
        <div className="grid grid-cols-2 gap-2">
          {TEXT_GRADIENTS.map((gradient, index) => (
            <button
              key={index}
              onClick={() => {
                onGradientChange(gradient);
                onClose();
              }}
              className={cn(
                "h-10 rounded-md border-2 transition-all hover:scale-105",
                currentGradient === gradient
                  ? "border-foreground shadow-lg"
                  : "border-border/50 hover:border-border",
              )}
              style={{ background: gradient }}
              title={`Gradient ${index + 1}`}
            />
          ))}
        </div>
      )}
      {/* Close button */}
      <button
        onClick={onClose}
        className="w-full mt-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// Emoji picker (simple version)
const COMMON_EMOJIS = [
  "💡",
  "⭐",
  "❤️",
  "🎯",
  "🚀",
  "✅",
  "⚡",
  "🔥",
  "💎",
  "🌟",
  "📌",
  "🎨",
];

function EmojiPicker({
  onEmojiSelect,
  onClose,
}: {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute right-0 mt-2 p-2 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg z-50 grid grid-cols-4 gap-1 w-[148px] left-[-5px] top-[-175px] bottom-[45px]"
      onClick={(e) => e.stopPropagation()}
    >
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          className="w-8 h-8 rounded hover:bg-primary/20 transition-colors flex items-center justify-center text-lg"
          onClick={() => {
            onEmojiSelect(emoji);
            onClose();
          }}
        >
          {emoji}
        </button>
      ))}
      <button
        className="w-8 h-8 rounded hover:bg-destructive/20 transition-colors flex items-center justify-center text-xs text-muted-foreground"
        onClick={() => {
          onEmojiSelect("");
          onClose();
        }}
      >
        ✕
      </button>
    </div>
  );
}

// Board colors - curated cyberdelic palette that looks good with white icons
const BOARD_HEX_COLORS = [
  {
    id: "purple",
    gradient:
      "linear-gradient(135deg, #a78bfa 0%, #7c3aed 30%, #5b21b6 70%, #4c1d95 100%)",
    label: "Deep Purple",
  },
  {
    id: "electric",
    gradient:
      "linear-gradient(135deg, #c084fc 0%, #a855f7 30%, #9333ea 70%, #7e22ce 100%)",
    label: "Electric Purple",
  },
  {
    id: "magenta",
    gradient:
      "linear-gradient(135deg, #f0abfc 0%, #e879f9 30%, #d946ef 70%, #c026d3 100%)",
    label: "Magenta",
  },
  {
    id: "cyan",
    gradient:
      "linear-gradient(135deg, #67e8f9 0%, #22d3ee 30%, #06b6d4 70%, #0891b2 100%)",
    label: "Cyan",
  },
  {
    id: "teal",
    gradient:
      "linear-gradient(135deg, #5eead4 0%, #2dd4bf 30%, #14b8a6 70%, #0d9488 100%)",
    label: "Teal",
  },
  {
    id: "indigo",
    gradient:
      "linear-gradient(135deg, #a5b4fc 0%, #818cf8 30%, #6366f1 70%, #4f46e5 100%)",
    label: "Indigo",
  },
  {
    id: "violet",
    gradient:
      "linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 30%, #a78bfa 70%, #8b5cf6 100%)",
    label: "Violet",
  },
  {
    id: "blue",
    gradient:
      "linear-gradient(135deg, #1e40af 0%, #1e3a8a 30%, #1e293b 70%, #0f172a 100%)",
    label: "Midnight Blue",
  },
  {
    id: "plum",
    gradient:
      "linear-gradient(135deg, #6b21a8 0%, #581c87 30%, #4c1d95 70%, #3b0764 100%)",
    label: "Dark Plum",
  },
  {
    id: "amber",
    gradient:
      "linear-gradient(135deg, #fbbf24 0%, #f59e0b 30%, #d97706 70%, #b45309 100%)",
    label: "Amber",
  },
  {
    id: "green",
    gradient:
      "linear-gradient(135deg, #4ade80 0%, #22c55e 30%, #16a34a 70%, #15803d 100%)",
    label: "Neon Green",
  },
  {
    id: "slate",
    gradient:
      "linear-gradient(135deg, #475569 0%, #334155 30%, #1e293b 70%, #0f172a 100%)",
    label: "Slate",
  },
];

// Board icon picker
const BOARD_ICONS = [
  { id: "grid", Icon: LayoutGrid, label: "Grid" },
  { id: "star", Icon: Star, label: "Star" },
  { id: "globe", Icon: Globe, label: "Globe" },
  { id: "image", Icon: Image, label: "Image" },
  { id: "note", Icon: FileText, label: "Note" },
  { id: "link", Icon: Link2, label: "Link" },
  { id: "box", Icon: Box, label: "Box" },
  { id: "heart", Icon: Heart, label: "Heart" },
];

function BoardIconPicker({
  currentIcon,
  onIconSelect,
  onClose,
}: {
  currentIcon?: string;
  onIconSelect: (iconId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 rounded-lg bg-card/95 backdrop-blur border border-border shadow-xl z-50 grid grid-cols-4 gap-1 w-[165px] h-[96px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {BOARD_ICONS.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={cn(
            "w-10 h-10 rounded hover:bg-primary/20 transition-colors flex items-center justify-center",
            currentIcon === id && "bg-primary/30 ring-1 ring-primary",
          )}
          onClick={() => {
            onIconSelect(id);
            onClose();
          }}
          title={label}
        >
          <Icon className="w-5 h-5" />
        </button>
      ))}
    </div>
  );
}

function BoardColorPicker({
  currentColor,
  onColorSelect,
  onClose,
}: {
  currentColor?: string;
  onColorSelect: (gradient: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 rounded-lg bg-card/95 backdrop-blur border border-border shadow-xl z-50 grid grid-cols-3 gap-2 w-[180px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {BOARD_HEX_COLORS.map(({ id, gradient, label }) => (
        <button
          key={id}
          className={cn(
            "w-14 h-14 rounded-lg transition-all hover:scale-110 border-2",
            currentColor === gradient
              ? "border-white ring-2 ring-primary"
              : "border-transparent",
          )}
          style={{ background: gradient }}
          onClick={() => {
            onColorSelect(gradient);
            onClose();
          }}
          title={label}
        />
      ))}
    </div>
  );
}

// File view submenu (Bookmark vs Preview for file mode only)
function FileViewSubmenu({
  currentMode,
  onModeSelect,
  onClose,
}: {
  currentMode: "bookmark" | "preview";
  onModeSelect: (mode: "bookmark" | "preview") => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-[14.75px] p-2 py-[8px] rounded-lg bg-card backdrop-blur border border-border shadow-xl z-50 w-[120px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1">
        <button
          onClick={() => {
            onModeSelect("bookmark");
            onClose();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
            currentMode === "bookmark"
              ? "bg-primary/30 ring-1 ring-primary text-primary"
              : "hover:bg-primary/20",
          )}
        >
          <Bookmark className="w-4 h-4" />
          Bookmark
        </button>
        <button
          onClick={() => {
            onModeSelect("preview");
            onClose();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
            currentMode === "preview"
              ? "bg-primary/30 ring-1 ring-primary text-primary"
              : "hover:bg-primary/20",
          )}
        >
          <Code className="w-4 h-4" />
          Preview
        </button>
      </div>
    </div>
  );
}

// Experience Block view submenu (Compact vs Inline Editor)
function ExperienceViewSubmenu({
  currentMode,
  onModeSelect,
  onClose,
}: {
  currentMode: "compact" | "inline";
  onModeSelect: (mode: "compact" | "inline") => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-[14.75px] p-2 py-[8px] rounded-lg bg-card backdrop-blur border border-border shadow-xl z-50 w-[140px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex flex-col gap-1">
        <button
          onClick={() => {
            onModeSelect("compact");
            onClose();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
            currentMode === "compact"
              ? "bg-primary/30 ring-1 ring-primary text-primary"
              : "hover:bg-primary/20",
          )}
        >
          <Box className="w-4 h-4" />
          Compact
        </button>
        <button
          onClick={() => {
            onModeSelect("inline");
            onClose();
          }}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded text-sm transition-colors",
            currentMode === "inline"
              ? "bg-primary/30 ring-1 ring-primary text-primary"
              : "hover:bg-primary/20",
          )}
        >
          <LayoutGrid className="w-4 h-4" />
          Inline Editor
        </button>
      </div>
    </div>
  );
}

// Freeform card component (Post-it style) - Dark gradients with white text
function FreeformCard({
  element,
  onUpdate,
  isEditing,
  onBlur,
}: {
  element: FreeformElement;
  onUpdate: (updates: Partial<FreeformElement>) => void;
  isEditing: boolean;
  onBlur: () => void;
}) {
  const bgColor =
    element.style?.bgColor ||
    "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)";
  const textColor = element.style?.textColor || "#ffffff"; // Default white for dark backgrounds
  const fontWeight = element.style?.fontWeight || "normal";
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle markdown-like triggers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent backspace/delete from deleting the card element
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const { value, selectionStart, selectionEnd } = textarea;
    const lines = value.substring(0, selectionStart).split("\n");
    const currentLineIndex = lines.length - 1;
    const currentLine = lines[currentLineIndex];
    const lineStartPos = selectionStart - currentLine.length;

    // Handle Enter key
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();

      // Check if current line is a list item
      const bulletMatch = currentLine.match(/^(\s*)- (.*)$/);
      const todoMatch = currentLine.match(/^(\s*)\[([ x])\] (.*)$/);

      if (bulletMatch) {
        const [, indent, content] = bulletMatch;
        if (content.trim() === "") {
          // Empty bullet - exit list
          const newValue =
            value.substring(0, lineStartPos) +
            "\n" +
            value.substring(selectionEnd);
          onUpdate({ content: newValue });
          setTimeout(() => {
            textarea.setSelectionRange(lineStartPos + 1, lineStartPos + 1);
          }, 0);
        } else {
          // Continue bullet list
          const newValue =
            value.substring(0, selectionEnd) +
            "\n" +
            indent +
            "- " +
            value.substring(selectionEnd);
          onUpdate({ content: newValue });
          setTimeout(() => {
            const newPos = selectionEnd + indent.length + 3;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else if (todoMatch) {
        const [, indent, , content] = todoMatch;
        if (content.trim() === "") {
          // Empty todo - exit list
          const newValue =
            value.substring(0, lineStartPos) +
            "\n" +
            value.substring(selectionEnd);
          onUpdate({ content: newValue });
          setTimeout(() => {
            textarea.setSelectionRange(lineStartPos + 1, lineStartPos + 1);
          }, 0);
        } else {
          // Continue todo list
          const newValue =
            value.substring(0, selectionEnd) +
            "\n" +
            indent +
            "[ ] " +
            value.substring(selectionEnd);
          onUpdate({ content: newValue });
          setTimeout(() => {
            const newPos = selectionEnd + indent.length + 5;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else {
        // Normal newline
        const newValue =
          value.substring(0, selectionEnd) + "\n" + value.substring(selectionEnd);
        onUpdate({ content: newValue });
        setTimeout(() => {
          textarea.setSelectionRange(selectionEnd + 1, selectionEnd + 1);
        }, 0);
      }
    }

    // Handle Space key for markdown triggers
    if (e.key === " ") {
      // Check for "- " trigger at start of line
      if (currentLine === "-") {
        e.preventDefault();
        const newValue =
          value.substring(0, lineStartPos) +
          "- " +
          value.substring(selectionEnd);
        onUpdate({ content: newValue });
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos + 2, lineStartPos + 2);
        }, 0);
      }
      // Check for "[ ]" trigger at start of line
      else if (currentLine === "[]" || currentLine === "[ ]") {
        e.preventDefault();
        const newValue =
          value.substring(0, lineStartPos) +
          "[ ] " +
          value.substring(selectionEnd);
        onUpdate({ content: newValue });
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos + 4, lineStartPos + 4);
        }, 0);
      }
      // Check for "[x]" trigger at start of line
      else if (currentLine === "[x]" || currentLine === "[X]") {
        e.preventDefault();
        const newValue =
          value.substring(0, lineStartPos) +
          "[x] " +
          value.substring(selectionEnd);
        onUpdate({ content: newValue });
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos + 4, lineStartPos + 4);
        }, 0);
      }
    }

    // Handle Backspace on empty list items
    if (e.key === "Backspace" && selectionStart === selectionEnd) {
      const bulletMatch = currentLine.match(/^(\s*)- $/);
      const todoMatch = currentLine.match(/^(\s*)\[([ x])\] $/);

      if (bulletMatch && selectionStart === lineStartPos + currentLine.length) {
        e.preventDefault();
        // Remove the list marker
        const newValue =
          value.substring(0, lineStartPos) + value.substring(selectionEnd);
        onUpdate({ content: newValue });
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos, lineStartPos);
        }, 0);
      } else if (todoMatch && selectionStart === lineStartPos + currentLine.length) {
        e.preventDefault();
        // Remove the todo marker
        const newValue =
          value.substring(0, lineStartPos) + value.substring(selectionEnd);
        onUpdate({ content: newValue });
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos, lineStartPos);
        }, 0);
      }
    }
  };

  // Render content with markdown-like formatting
  const renderContent = (content: string) => {
    if (!content) {
      return <span className="text-white/40">Double-click to edit</span>;
    }

    const lines = content.split("\n");
    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          // Check for bullet list
          const bulletMatch = line.match(/^(\s*)- (.*)$/);
          if (bulletMatch) {
            const [, indent, text] = bulletMatch;
            return (
              <div
                key={idx}
                className="flex items-start gap-2"
                style={{ marginLeft: `${indent.length * 8}px` }}
              >
                <span className="text-white/60 mt-[2px]">•</span>
                <span>{text}</span>
              </div>
            );
          }

          // Check for todo list
          const todoMatch = line.match(/^(\s*)\[([ x])\] (.*)$/);
          if (todoMatch) {
            const [, indent, checked, text] = todoMatch;
            const isChecked = checked.toLowerCase() === "x";
            return (
              <div
                key={idx}
                className="flex items-start gap-2"
                style={{ marginLeft: `${indent.length * 8}px` }}
              >
                <div
                  className={cn(
                    "w-4 h-4 mt-[2px] rounded border flex items-center justify-center cursor-pointer transition-colors",
                    isChecked
                      ? "bg-primary/40 border-primary"
                      : "border-white/40 hover:border-white/60"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle checkbox in content
                    const newContent = content
                      .split("\n")
                      .map((l, i) => {
                        if (i === idx) {
                          return l.replace(/\[([ x])\]/, isChecked ? "[ ]" : "[x]");
                        }
                        return l;
                      })
                      .join("\n");
                    onUpdate({ content: newContent });
                  }}
                >
                  {isChecked && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      strokeWidth="2"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={cn(
                    isChecked && "line-through opacity-60"
                  )}
                >
                  {text}
                </span>
              </div>
            );
          }

          // Regular text
          return (
            <div key={idx}>{line || <br />}</div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="w-full h-full rounded-lg shadow-md overflow-hidden flex flex-col relative"
      style={{
        background: bgColor,
        border: "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow:
          "0 2px 8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset",
      }}
    >
      {/* Emoji display (top-left) */}
      {element.emoji && (
        <div className="top-2 text-lg leading-none z-10 right-[auto] left-[50%] static w-full text-center py-[7px]">
          {element.emoji}
        </div>
      )}
      {/* Content */}
      <div
        className={`flex-1 p-3 overflow-hidden ${element.emoji ? "" : " pt-[0]"}`}
      >
        {isEditing ? (
          <Textarea
            ref={textareaRef}
            autoFocus
            value={element.content}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            className="w-full h-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-white placeholder:text-white/40"
            style={{
              color: textColor,
              fontWeight: fontWeight,
            }}
            placeholder="Enter content..."
            data-no-drag
          />
        ) : (
          <div
            className="w-full h-full text-sm overflow-auto"
            style={{
              color: textColor,
              fontWeight: fontWeight,
            }}
          >
            {renderContent(element.content)}
          </div>
        )}
      </div>
    </div>
  );
}

// Image card component with upload
function ImageCard({
  element,
  onUpdate,
  isSelected,
}: {
  element: ImageElement;
  onUpdate: (updates: Partial<ImageElement>) => void;
  isSelected: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasImage, setHasImage] = useState(!!element.src);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const compressAndUploadImage = async (file: File) => {
    setIsUploading(true);
    try {
      // Create image element to read dimensions
      const img = document.createElement("img");
      const objectUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      // Compress if needed
      const maxWidth = 1600;
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, width, height);

      URL.revokeObjectURL(objectUrl);

      // Convert to blob with compression
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/webp", 0.8);
      });

      // Upload to Supabase Storage
      const supabase = createClient();
      const fileName = `canvas-images/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.webp`;

      const { data, error } = await supabase.storage
        .from("canvas-uploads")
        .upload(fileName, blob, {
          contentType: "image/webp",
          cacheControl: "3600",
        });

      if (error) {
        // If bucket doesn't exist, show error state
        console.error("Upload error:", error);
        setHasImage(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("canvas-uploads")
        .getPublicUrl(data.path);

      onUpdate({
        src: urlData.publicUrl,
        imageMeta: {
          width,
          height,
          bytes: blob.size,
          originalName: file.name,
        },
      });
      setHasImage(true);
    } catch (err) {
      console.error("Image processing error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      compressAndUploadImage(file);
    }
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            compressAndUploadImage(file);
          }
        }
      }
    }
  }, []);

  useEffect(() => {
    if (!hasImage) {
      window.addEventListener("paste", handlePaste);
      return () => window.removeEventListener("paste", handlePaste);
    }
  }, [hasImage, handlePaste]);

  // Show upload UI when no image
  if (!element.src) {
    return (
      <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur flex flex-col items-center justify-center p-4 gap-3">
        {isUploading ? (
          <>
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </>
        ) : (
          <>
            <ImageIcon className="w-8 h-8 text-muted-foreground" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="gap-2"
              data-no-drag
            >
              <Upload className="w-4 h-4" />
              Upload Image
            </Button>
            <div className="text-xs text-muted-foreground">
              or paste from clipboard
            </div>
          </>
        )}
      </div>
    );
  }

  // Image is loaded - show clean media tile
  return (
    <div
      className={cn(
        "w-full h-full overflow-hidden rounded-lg transition-all",
        isSelected ? "ring-0" : "", // Selection ring is handled by parent
      )}
    >
      <img
        src={element.src}
        alt={element.alt || ""}
        className="w-full h-full"
        style={{ objectFit: element.objectFit || "cover" }}
        onError={() => setHasImage(false)}
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
}

// Shape card component with editable text
function ShapeCard({
  element,
  onUpdate,
  isEditing,
  onBlur,
}: {
  element: ShapeElement;
  onUpdate: (updates: Partial<ShapeElement>) => void;
  isEditing: boolean;
  onBlur: () => void;
}) {
  const bgColor = element.style?.bgColor || "hsl(var(--primary) / 0.3)";
  const borderColor = element.style?.borderColor || "hsl(var(--primary))";
  const borderWidth = element.style?.borderWidth || 2;
  const textColor = element.style?.textColor || "inherit";
  const fillOpacity =
    element.style?.fillOpacity !== undefined ? element.style.fillOpacity : 100;

  // Convert fillOpacity (0-100) to CSS opacity (0-1) and apply to background
  const getBackgroundWithOpacity = (color: string, opacity: number): string => {
    // If color already has opacity/alpha, use as-is
    if (color.includes("rgba") || color.includes("hsla")) {
      return color;
    }
    // Convert percentage to 0-1
    const alpha = opacity / 100;
    
    // Handle gradients
    if (color.includes("gradient")) {
      // For gradients, we need to wrap in a container with opacity or modify each color
      // For now, return as-is and handle via fillOpacity on the SVG element
      return color;
    }
    
    // Handle HSL colors
    if (color.startsWith("hsl")) {
      return color.replace("hsl(", `hsla(`).replace(")", `, ${alpha})`);
    }
    // Handle hex colors - convert to rgba
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  };

  const renderSVGShape = () => {
    const fill = bgColor.includes("gradient") ? `url(#gradient-${element.id})` : getBackgroundWithOpacity(bgColor, fillOpacity);
    const stroke = borderColor;
    const strokeWidth = borderWidth;
    const opacity = bgColor.includes("gradient") ? fillOpacity / 100 : 1;

    switch (element.shapeType) {
      case "circle":
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
          >
            {bgColor.includes("gradient") && (
              <defs>
                <linearGradient id={`gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: extractGradientColor(bgColor, 0), stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: extractGradientColor(bgColor, 1), stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            )}
            <circle
              cx="50"
              cy="50"
              r="48"
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "diamond":
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
          >
            {bgColor.includes("gradient") && (
              <defs>
                <linearGradient id={`gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: extractGradientColor(bgColor, 0), stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: extractGradientColor(bgColor, 1), stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            )}
            <polygon
              points="50,5 95,50 50,95 5,50"
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "hexagon":
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
          >
            {bgColor.includes("gradient") && (
              <defs>
                <linearGradient id={`gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: extractGradientColor(bgColor, 0), stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: extractGradientColor(bgColor, 1), stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            )}
            <polygon
              points="50,5 93.3,25 93.3,75 50,95 6.7,75 6.7,25"
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "star":
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
          >
            {bgColor.includes("gradient") && (
              <defs>
                <linearGradient id={`gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: extractGradientColor(bgColor, 0), stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: extractGradientColor(bgColor, 1), stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            )}
            <path
              d="M50,10 L61,40 L92,40 L68,60 L78,90 L50,70 L22,90 L32,60 L8,40 L39,40 Z"
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      case "triangle":
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
          >
            {bgColor.includes("gradient") && (
              <defs>
                <linearGradient id={`gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: extractGradientColor(bgColor, 0), stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: extractGradientColor(bgColor, 1), stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            )}
            <polygon
              points="50,10 90,90 10,90"
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
      default: // rectangle
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
          >
            {bgColor.includes("gradient") && (
              <defs>
                <linearGradient id={`gradient-${element.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style={{ stopColor: extractGradientColor(bgColor, 0), stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: extractGradientColor(bgColor, 1), stopOpacity: 1 }} />
                </linearGradient>
              </defs>
            )}
            <rect
              x="2"
              y="2"
              width="96"
              height="96"
              rx="8"
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={strokeWidth}
            />
          </svg>
        );
    }
  };
  
  // Helper to extract colors from gradient strings
  const extractGradientColor = (gradient: string, position: number): string => {
    // Extract colors from linear-gradient string
    const matches = gradient.match(/#[0-9A-Fa-f]{6}/g);
    if (matches && matches.length > position) {
      return matches[position];
    }
    return "#a855f7"; // fallback
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      {renderSVGShape()}
      <div className="relative z-10 text-center px-2">
        {isEditing ? (
          <input
            autoFocus
            value={element.content || ""}
            onChange={(e) => onUpdate({ content: e.target.value })}
            onBlur={onBlur}
            className="w-full bg-transparent border-0 text-center focus:outline-none"
            style={{
              color: textColor,
              fontSize: element.style?.fontSize || 14,
            }}
            placeholder="Text..."
            data-no-drag
          />
        ) : (
          <span
            className="text-sm"
            style={{
              color: textColor,
              fontSize: element.style?.fontSize || 14,
            }}
          >
            {element.content}
          </span>
        )}
      </div>
    </div>
  );
}

// Container card component (true grouping)
function ContainerCard({
  element,
  isEditing,
  onUpdate,
  onBlur,
  isSelected,
  isDropTarget,
}: {
  element: ContainerElement;
  isEditing: boolean;
  onUpdate: (updates: Partial<ContainerElement>) => void;
  onBlur: () => void;
  isSelected: boolean;
  isDropTarget?: boolean;
}) {
  const bgColor = element.style?.bgColor || "transparent";
  const borderColor = element.style?.borderColor || "hsl(var(--primary) / 0.4)";
  const strokeWidth = element.style?.borderWidth || 2;
  const fillOpacity =
    element.style?.fillOpacity !== undefined ? element.style.fillOpacity : 20;

  // Convert fillOpacity to CSS opacity
  const backgroundWithOpacity =
    bgColor === "transparent"
      ? `rgba(var(--card-rgb) / ${fillOpacity / 100})`
      : bgColor;

  return (
    <div
      className={cn(
        "w-full h-full rounded-lg border-dashed backdrop-blur transition-all",
        isDropTarget &&
          "border-primary shadow-lg shadow-primary/20 brightness-110",
      )}
      style={{
        backgroundColor: backgroundWithOpacity,
        borderColor: borderColor,
        borderWidth: `${strokeWidth}px`,
        boxShadow: isDropTarget
          ? "0 0 20px rgba(168, 85, 247, 0.5), inset 0 0 10px rgba(168, 85, 247, 0.2)"
          : undefined,
      }}
    >
      {/* Container label */}
      <div
        className="px-3 py-2 border-b border-dashed"
        style={{
          borderColor: borderColor,
          borderWidth: `${Math.max(1, strokeWidth - 1)}px`,
        }}
      >
        {isEditing ? (
          <Input
            autoFocus
            value={element.label || ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
            onBlur={onBlur}
            className="text-sm font-medium bg-transparent border-0 p-0 h-auto focus-visible:ring-0"
            placeholder="Container label..."
          />
        ) : (
          <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" />
            {element.label || "Container"}
          </div>
        )}
      </div>
      {/* Container content area */}
      <div className="flex-1 p-2 text-xs text-muted-foreground/50 text-center">
        {isSelected && <span>Drop elements here to group</span>}
        {isDropTarget && !isSelected && (
          <span className="text-primary font-medium">Drop to attach</span>
        )}
      </div>
    </div>
  );
}

// Text card component - clean, auto-sizing, context menu controls
function TextCard({
  element,
  onUpdate,
  isEditing,
  onBlur,
}: {
  element: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
  isEditing: boolean;
  onBlur: () => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [originalContent, setOriginalContent] = useState("");

  const fontSize = element.style?.fontSize || 16;
  const fontWeight = element.style?.fontWeight || "normal";
  const fontFamily = element.style?.fontFamily || "inherit";
  const textColor = element.style?.textColor || "#ffffff";
  const gradient = element.style?.bgColor; // We'll use bgColor to store gradient
  const textAlign = element.textAlign || "left";
  const wrapWidth = element.wrapWidth; // Can be undefined for auto-width

  // Store original content when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setOriginalContent(element.content);
    }
  }, [isEditing]);

  // Auto-size height based on content (width controlled by wrapWidth or auto)
  useEffect(() => {
    if (measureRef.current && element.content) {
      const measured = measureRef.current.getBoundingClientRect();

      // Width: use wrapWidth if set, otherwise auto-size to content
      const newWidth = wrapWidth
        ? wrapWidth
        : Math.max(60, measured.width + 16);

      // Height: always auto-size to fit wrapped content
      const newHeight = Math.max(30, measured.height + 16);

      // Only update if size changed significantly (avoid infinite loops)
      if (
        Math.abs(element.width - newWidth) > 5 ||
        Math.abs(element.height - newHeight) > 5
      ) {
        onUpdate({ width: newWidth, height: newHeight });
      }
    }
  }, [element.content, fontSize, fontWeight, fontFamily, wrapWidth]);

  // Handle click outside to commit changes
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if click is outside the textarea
      if (textareaRef.current && !textareaRef.current.contains(target)) {
        onBlur();
      }
    };

    // Add listener after a short delay to avoid immediate trigger
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, onBlur]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent backspace/delete from deleting the text element
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }

    // Escape cancels edit (revert changes)
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onUpdate({ content: originalContent });
      onBlur();
    }

    // Enter creates new line - no special handling needed, just stop propagation
    if (e.key === "Enter") {
      e.stopPropagation();
      // Let the default behavior create a newline
    }
  };

  // Determine text style (solid color or gradient)
  // CRITICAL: Apply gradient directly to text span, not container
  const hasGradient = gradient?.startsWith("linear-gradient");

  return (
    <div className="w-full h-full flex items-center justify-center p-2">
      {/* Hidden measurement element - respects wrapWidth */}
      {!isEditing && element.content && (
        <div
          ref={measureRef}
          className="absolute opacity-0 pointer-events-none whitespace-pre-wrap"
          style={{
            fontSize,
            fontWeight,
            fontFamily,
            textAlign,
            maxWidth: wrapWidth ? `${wrapWidth - 16}px` : undefined,
            width: wrapWidth ? `${wrapWidth - 16}px` : 'auto',
          }}
        >
          {element.content}
        </div>
      )}

      {/* Text content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          autoFocus
          value={element.content}
          onChange={(e) => onUpdate({ content: e.target.value })}
          onKeyDown={handleKeyDown}
          className="w-full h-full resize-none border-0 bg-transparent p-0 focus:outline-none overflow-hidden"
          style={{
            fontSize,
            fontWeight,
            fontFamily,
            textAlign,
            color: textColor,
          }}
          placeholder="Type text..."
          data-no-drag
        />
      ) : (
        <div
          className="w-full h-full whitespace-pre-wrap flex items-center justify-center"
          style={{
            fontSize,
            fontWeight,
            fontFamily,
            textAlign,
            maxWidth: wrapWidth ? `${wrapWidth - 16}px` : undefined,
          }}
        >
          {element.content ? (
            <span
              key={hasGradient ? gradient : textColor}
              className={hasGradient ? "gradient-text" : ""}
              style={
                hasGradient
                  ? {
                      background: gradient,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                      display: "inline-block",
                    }
                  : { color: textColor }
              }
            >
              {element.content}
            </span>
          ) : (
            <span className="text-muted-foreground text-sm">
              Double-click to edit
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Link card component with bookmark/embed/file modes
function LinkCard({
  element,
  onUpdate,
  isSelected,
}: {
  element: LinkElement;
  onUpdate: (updates: Partial<LinkElement>) => void;
  isSelected: boolean;
}) {
  // Local draft state to prevent element from disappearing during edits
  const [draftUrl, setDraftUrl] = useState(element.url || "");
  const [isEditing, setIsEditing] = useState(!element.url && element.linkMode !== "file");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync draft with element when element URL changes externally
  useEffect(() => {
    if (element.url && element.url !== draftUrl && !isEditing) {
      setDraftUrl(element.url);
    }
  }, [element.url]);

  // File upload handling
  const uploadFileToStorage = async (file: File) => {
    setIsUploading(true);
    try {
      const supabase = createClient();
      const fileName = `canvas-files/${Date.now()}-${file.name}`;

      const { data, error } = await supabase.storage
        .from("canvas-uploads")
        .upload(fileName, file, {
          contentType: file.type,
          cacheControl: "3600",
        });

      if (error) {
        console.error("Upload error:", error);
        setUrlError("Failed to upload file");
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("canvas-uploads")
        .getPublicUrl(data.path);

      // Update element with file data
      onUpdate({
        url: urlData.publicUrl,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        linkMode: "file",
        fileViewMode: element.fileViewMode || "bookmark",
      });
    } catch (err) {
      console.error("File upload error:", err);
      setUrlError("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFileToStorage(file);
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      uploadFileToStorage(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return FileText;
    if (fileType.includes("pdf")) return FileText;
    if (fileType.includes("image")) return Image;
    if (fileType.includes("video")) return Film;
    if (fileType.includes("word") || fileType.includes("doc")) return FileText;
    return FileText;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const fetchLinkMetadata = async (url: string) => {
    if (!isValidUrl(url)) {
      setUrlError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    setUrlError(null);
    try {
      // Call our API route to fetch metadata
      const response = await fetch(
        `/api/link-meta?url=${encodeURIComponent(url)}`,
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("Metadata fetch error:", error);

        // Fallback to basic metadata
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        onUpdate({
          url,
          domain,
          title: domain,
          favicon: `https://www.google.com/s2/favicons?domain=${domain}&sz=32`,
          linkMode: element.linkMode || "bookmark",
        });
      } else {
        const metadata = await response.json();

        onUpdate({
          url: metadata.url,
          domain: metadata.domain,
          title: metadata.title,
          description: metadata.description,
          thumbnail: metadata.image,
          favicon: metadata.favicon,
          linkMode: element.linkMode || "bookmark",
        });
      }

      setIsEditing(false);
    } catch (error) {
      console.error("Fetch error:", error);
      setUrlError("Failed to fetch link metadata");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitUrl = () => {
    if (draftUrl.trim()) {
      fetchLinkMetadata(draftUrl.trim());
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraftUrl(e.target.value);
    setUrlError(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSubmitUrl();
    }
  };

  const handleInputBlur = () => {
    // Don't auto-submit on blur if there's no URL yet (initial state)
    // This prevents the element from disappearing while editing
    if (!element.url && !draftUrl.trim()) {
      // Keep editing, don't close
      return;
    }

    // If we have a valid draft URL, submit it
    if (draftUrl.trim() && isValidUrl(draftUrl.trim())) {
      handleSubmitUrl();
    } else if (element.url) {
      // If we have an existing URL, revert to it
      setIsEditing(false);
      setDraftUrl(element.url);
      setUrlError(null);
    }
  };

  // Always show the element - never unmount during editing
  // FILE MODE - Upload UI
  if (element.linkMode === "file") {
    // Show upload UI when no file uploaded yet
    if (!element.url) {
      return (
        <div
          className="w-full h-full rounded-lg border-2 border-dashed border-border bg-card/80 backdrop-blur flex flex-col items-center justify-center p-6 gap-3"
          onDrop={handleFileDrop}
          onDragOver={handleDragOver}
        >
          {isUploading ? (
            <>
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </>
          ) : (
            <>
              <FileUp className="w-10 h-10 text-muted-foreground" />
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                className="hidden"
                data-no-drag
              />
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className="gap-2"
                data-no-drag
              >
                <FileUp className="w-4 h-4" />
                Upload file
              </Button>
              <p className="text-xs text-muted-foreground">
                or drag & drop a file here
              </p>
              {urlError && <p className="text-xs text-destructive">{urlError}</p>}
            </>
          )}
        </div>
      );
    }

    // File uploaded - show based on view mode
    const FileIcon = getFileIcon(element.fileType);

    // Preview mode
    if (element.fileViewMode === "preview") {
      // PDF preview
      if (element.fileType?.includes("pdf")) {
        return (
          <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-card/80 border-b border-border/50 flex items-center gap-2 flex-shrink-0">
              <FileIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {element.fileName}
              </span>
              <a
                href={element.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                data-no-drag
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex-1 min-h-0">
              <iframe
                src={element.url}
                className="w-full h-full border-0"
                title={element.fileName}
                data-no-drag
              />
            </div>
          </div>
        );
      }

      // Image preview
      if (element.fileType?.includes("image")) {
        return (
          <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-card/80 border-b border-border/50 flex items-center gap-2 flex-shrink-0">
              <FileIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {element.fileName}
              </span>
              <a
                href={element.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                data-no-drag
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex-1 min-h-0 bg-gradient-to-br from-muted/30 to-muted/10">
              <img
                src={element.url}
                alt={element.fileName}
                className="w-full h-full object-contain"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>
          </div>
        );
      }

      // Video preview
      if (element.fileType?.includes("video")) {
        return (
          <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-card/80 border-b border-border/50 flex items-center gap-2 flex-shrink-0">
              <FileIcon className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate flex-1">
                {element.fileName}
              </span>
              <a
                href={element.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors"
                data-no-drag
                title="Open in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="flex-1 min-h-0 bg-black">
              <video
                src={element.url}
                className="w-full h-full object-contain"
                controls
                data-no-drag
              >
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        );
      }

      // Preview not available
      return (
        <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur flex flex-col items-center justify-center p-4 text-center gap-3">
          <FileIcon className="w-10 h-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Preview not available</p>
          <p className="text-xs text-muted-foreground/70">{element.fileName}</p>
          <a
            href={element.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline flex items-center gap-1"
            data-no-drag
          >
            Open in new tab <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      );
    }

    // Bookmark mode (default) - File card
    return (
      <div
        className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col p-4 justify-center items-center gap-3"
        onDoubleClick={(e) => {
          e.stopPropagation();
          window.open(element.url, "_blank");
        }}
      >
        <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <FileIcon className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-foreground line-clamp-2">
            {element.fileName || "File"}
          </p>
          {element.fileSize && (
            <p className="text-xs text-muted-foreground">
              {formatFileSize(element.fileSize)}
            </p>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 text-center">
          Double-click to open
        </p>
        {isSelected && (
          <div className="mt-2 flex gap-2">
            <a
              href={element.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
              data-no-drag
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" /> Open
            </a>
          </div>
        )}
      </div>
    );
  }

  // URL input mode (initial state or when editing) - for bookmark/embed modes only
  if (isEditing || !element.url) {
    return (
      <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur flex flex-col items-center justify-center p-4 gap-3">
        <Link2 className="w-8 h-8 text-muted-foreground" />
        <div className="w-full space-y-2">
          <Input
            value={draftUrl}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            onBlur={handleInputBlur}
            placeholder="https://example.com"
            className={cn("w-full", urlError && "border-destructive")}
            autoFocus
            data-no-drag
          />
          {urlError && <p className="text-xs text-destructive">{urlError}</p>}
        </div>
        <Button
          onClick={handleSubmitUrl}
          disabled={isLoading || !draftUrl.trim()}
          data-no-drag
        >
          {isLoading ? "Loading..." : "Add Link"}
        </Button>
        {element.url && (
          <button
            onClick={() => setIsEditing(false)}
            className="text-xs text-muted-foreground hover:text-foreground"
            data-no-drag
          >
            Cancel
          </button>
        )}
      </div>
    );
  }

  // Bookmark mode - Image-first layout (reference layout)
  if (element.linkMode === "bookmark" || !element.linkMode) {
    return (
      <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
        {/* Large thumbnail area - top priority */}
        <div className="flex-1 min-h-0 bg-gradient-to-br from-muted/30 to-muted/10 relative overflow-hidden">
          {element.thumbnail ? (
            <img
              src={element.thumbnail}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Globe className="w-12 h-12 text-muted-foreground/30" />
            </div>
          )}
        </div>
        {/* Metadata section - below image */}
        <div className="p-3 space-y-2 bg-card/50 border-t border-border/50">
          {/* Title and external link */}
          <div className="flex items-start gap-2">
            <a
              href={element.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
              data-no-drag
            >
              {element.title || element.domain || "Link"}
            </a>
            <a
              href={element.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 w-6 h-6 rounded hover:bg-primary/10 flex items-center justify-center transition-colors"
              data-no-drag
              title="Open in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
            </a>
          </div>

          {/* Description */}
          {element.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {element.description}
            </p>
          )}

          {/* Domain with favicon */}
          <div className="flex items-center gap-1.5 pt-0.5">
            {element.favicon && (
              <img
                src={element.favicon}
                alt=""
                className="w-4 h-4"
                draggable={false}
              />
            )}
            <span className="text-xs text-muted-foreground/80 truncate">
              {element.domain}
            </span>
          </div>
        </div>
        {/* Edit button - only shown when selected */}
        {isSelected && (
          <div className="px-3 pb-2 pt-1 border-t border-border/50 bg-card/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-no-drag
            >
              Edit URL
            </button>
          </div>
        )}
      </div>
    );
  }

  // Embed mode
  return (
    <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
      {/* Header bar for dragging in embed mode */}
      <div className="px-3 py-2 bg-card/80 border-b border-border/50 flex items-center gap-2 flex-shrink-0">
        {element.favicon && (
          <img
            src={element.favicon}
            alt=""
            className="w-4 h-4"
            draggable={false}
          />
        )}
        <span className="text-xs text-muted-foreground truncate flex-1">
          {element.domain}
        </span>
        <a
          href={element.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors"
          data-no-drag
          title="Open in new tab"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
      {/* Embed content area */}
      <div className="flex-1 min-h-0 relative">
        {embedError ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
            <Globe className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              This site can't be embedded
            </p>
            <a
              href={element.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
              data-no-drag
            >
              Open in new tab <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <iframe
            src={element.url}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
            onError={() => setEmbedError(true)}
            data-no-drag
          />
        )}
      </div>
      {/* Edit button - only shown when selected */}
      {isSelected && (
        <div className="px-3 py-2 border-t border-border bg-card/80">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-no-drag
          >
            Edit URL
          </button>
        </div>
      )}
    </div>
  );
}

// Board card component (nested canvas) - Hexagon badge design
function BoardCard({
  element,
  onUpdate,
  isEditing,
  onBlur,
  isDropTarget,
  showIconPicker,
  setShowIconPicker,
}: {
  element: BoardElement;
  onUpdate: (updates: Partial<BoardElement>) => void;
  isEditing: boolean;
  onBlur: () => void;
  isDropTarget?: boolean;
  showIconPicker: boolean;
  setShowIconPicker: (show: boolean) => void;
}) {
  const [isEditingName, setIsEditingName] = useState(false);

  // Get the icon component
  const iconId = element.icon || "grid";
  const selectedIcon = BOARD_ICONS.find((i) => i.id === iconId);
  const IconComponent = selectedIcon?.Icon || LayoutGrid;

  return (
    <div
      className={cn(
        "flex items-center justify-center transition-all relative",
        isDropTarget && "scale-105",
      )}
    >
      {/* Drop target glow overlay */}
      {isDropTarget && (
        <div
          className="absolute inset-0 rounded-lg animate-pulse"
          style={{
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.3) 0%, transparent 70%)",
            boxShadow:
              "0 0 40px rgba(168, 85, 247, 0.8), inset 0 0 20px rgba(168, 85, 247, 0.4)",
          }}
        />
      )}
      {/* Hexagon badge container with 3D effect */}
      <div className="relative flex flex-col items-center gap-3 w-full h-full justify-center">
        {/* Hexagon icon container */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          {/* Isometric cube shape with 3D gradient and glow */}
          <div
            className={cn(
              "absolute inset-0 h-[128px] transition-all",
              isDropTarget && "brightness-125",
            )}
            style={{
              clipPath:
                "polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)",
              background:
                element.hexColor ||
                "linear-gradient(135deg, #a78bfa 0%, #7c3aed 30%, #5b21b6 70%, #4c1d95 100%)",
              boxShadow:
                "0 8px 32px rgba(139, 92, 246, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -2px 4px rgba(0, 0, 0, 0.3)",
            }}
          />
          {/* Icon */}
          <div className="relative z-10 flex items-center justify-center">
            <IconComponent className="w-12 h-12 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* Board name */}
        <div className="flex flex-col items-center gap-1 w-full px-4">
          {isEditingName ? (
            <Input
              autoFocus
              value={element.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              onBlur={() => {
                setIsEditingName(false);
                onBlur();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setIsEditingName(false);
                  onBlur();
                }
              }}
              className="text-center text-sm font-medium bg-card/50 border-border/50 h-auto py-1"
              placeholder="Board name..."
              data-no-drag
            />
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              className="text-sm font-medium text-white hover:text-primary transition-colors max-w-full truncate px-2 py-1 rounded hover:bg-white/10"
              data-no-drag
            >
              {element.title || "New Board"}
            </button>
          )}
          <span className="text-xs text-white/50">Double-click to enter</span>
        </div>
      </div>
    </div>
  );
}

// Experience Block Card - shortcut to experience components with inline editor support
function ExperienceBlockCard({
  element,
  onOpenPanel,
}: {
  element: ExperienceBlockElement;
  onOpenPanel?: (sectionId: InspectorSectionId) => void;
}) {
  // Import the icons from experience-inspector
  const {
    Target,
    Sparkles,
    Users,
    Globe,
    Layers,
    Eye,
    Radio,
    Brain,
    Heart,
    ExternalLink: ExternalLinkIcon,
  } = require("lucide-react");

  const iconMap: Record<InspectorSectionId, React.ReactNode> = {
    intentionCore: <Target className="w-6 h-6" />,
    desiredChange: <Sparkles className="w-6 h-6" />,
    humanContext: <Users className="w-6 h-6" />,
    contextAndMeaning: <Globe className="w-6 h-6" />,
    realityPlanes: <Layers className="w-6 h-6" />,
    sensoryDomains: <Eye className="w-6 h-6" />,
    presenceTypes: <Radio className="w-6 h-6" />,
    stateMapping: <Brain className="w-6 h-6" />,
    traitMapping: <Heart className="w-6 h-6" />,
  };

  const icon = iconMap[element.componentKey];
  const viewMode = element.viewMode || "compact";

  // Get project from store
  const project = useCXDStore((state) => state.getCurrentProject());

  // Get update functions from store
  const {
    updateIntentionProjectName,
    updateIntentionMainConcept,
    updateIntentionCoreMessage,
    updateDesiredInsights,
    updateDesiredFeelings,
    updateDesiredStates,
    updateDesiredKnowledge,
    updateHumanAudienceNeeds,
    updateHumanAudienceDesires,
    updateHumanUserRole,
    updateContextWorld,
    updateContextStory,
    updateContextMagic,
    updateRealityPlane,
    updateSensoryDomain,
    updatePresenceType,
    updateStateMapping,
    updateTraitMapping,
  } = useCXDStore();

  if (!project) return null;

  // Compact view (default)
  if (viewMode === "compact") {
    return (
      <div
        className="w-full h-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all"
        style={{
          background: "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
          borderColor: "rgba(168, 85, 247, 0.3)",
          boxShadow: "0 4px 16px rgba(168, 85, 247, 0.2)",
        }}
      >
        {/* Icon */}
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-primary/20">
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {element.title}
          </div>
          <div className="text-xs text-white/50 mt-0.5">Double-click to open</div>
        </div>
      </div>
    );
  }

  // Inline editor view
  return (
    <div
      className="w-full h-full rounded-lg border overflow-hidden flex flex-col"
      style={{
        background: "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
        borderColor: "rgba(168, 85, 247, 0.3)",
        boxShadow: "0 4px 16px rgba(168, 85, 247, 0.2)",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header - draggable area */}
      <div className="flex items-center gap-3 px-4 py-2 bg-card/20 border-b border-border/30 flex-shrink-0">
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-primary/20">
          {icon}
        </div>
        <div className="flex-1 min-w-0 text-sm font-semibold text-white truncate">
          {element.title}
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenPanel?.(element.componentKey);
          }}
          className="flex-shrink-0 p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
          title="Open in panel"
          data-no-drag
        >
          <ExternalLinkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Body - scrollable editor */}
      <ScrollArea className="flex-1 overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 space-y-4" data-no-drag>
          {element.componentKey === "intentionCore" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="projectName" className="text-sm font-medium text-white">
                  Project Name
                </Label>
                <Input
                  id="projectName"
                  placeholder="Enter project name..."
                  value={project.intentionCore?.projectName || ""}
                  onChange={(e) => updateIntentionProjectName(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mainConcept" className="text-sm font-medium text-white">
                  Main Concept
                </Label>
                <Textarea
                  id="mainConcept"
                  placeholder="What is the central idea or concept?"
                  value={project.intentionCore?.mainConcept || ""}
                  onChange={(e) => updateIntentionMainConcept(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coreMessage" className="text-sm font-medium text-white">
                  Core Message
                </Label>
                <Textarea
                  id="coreMessage"
                  placeholder="What is the core message or takeaway?"
                  value={project.intentionCore?.coreMessage || ""}
                  onChange={(e) => updateIntentionCoreMessage(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "desiredChange" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="insights" className="text-sm font-medium text-white">
                  Insights
                </Label>
                <Textarea
                  id="insights"
                  placeholder="What insights should users gain?"
                  value={project.desiredChange?.insights || ""}
                  onChange={(e) => updateDesiredInsights(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="feelings" className="text-sm font-medium text-white">
                  Feelings
                </Label>
                <Textarea
                  id="feelings"
                  placeholder="What feelings should they experience?"
                  value={project.desiredChange?.feelings || ""}
                  onChange={(e) => updateDesiredFeelings(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="states" className="text-sm font-medium text-white">
                  States
                </Label>
                <Textarea
                  id="states"
                  placeholder="What states should emerge?"
                  value={project.desiredChange?.states || ""}
                  onChange={(e) => updateDesiredStates(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="knowledge" className="text-sm font-medium text-white">
                  Knowledge
                </Label>
                <Textarea
                  id="knowledge"
                  placeholder="What knowledge should they acquire?"
                  value={project.desiredChange?.knowledge || ""}
                  onChange={(e) => updateDesiredKnowledge(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "humanContext" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="audienceNeeds" className="text-sm font-medium text-white">
                  Audience Needs
                </Label>
                <Textarea
                  id="audienceNeeds"
                  placeholder="What are the audience's needs?"
                  value={project.humanContext?.audienceNeeds || ""}
                  onChange={(e) => updateHumanAudienceNeeds(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audienceDesires" className="text-sm font-medium text-white">
                  Audience Desires
                </Label>
                <Textarea
                  id="audienceDesires"
                  placeholder="What do they desire?"
                  value={project.humanContext?.audienceDesires || ""}
                  onChange={(e) => updateHumanAudienceDesires(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userRole" className="text-sm font-medium text-white">
                  User Role
                </Label>
                <Input
                  id="userRole"
                  placeholder="What role does the user play?"
                  value={project.humanContext?.userRole || ""}
                  onChange={(e) => updateHumanUserRole(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "contextAndMeaning" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="world" className="text-sm font-medium text-white">
                  World
                </Label>
                <Textarea
                  id="world"
                  placeholder="Describe the world..."
                  value={project.contextAndMeaning?.world || ""}
                  onChange={(e) => updateContextWorld(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="story" className="text-sm font-medium text-white">
                  Story
                </Label>
                <Textarea
                  id="story"
                  placeholder="What is the narrative?"
                  value={project.contextAndMeaning?.story || ""}
                  onChange={(e) => updateContextStory(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="magic" className="text-sm font-medium text-white">
                  Magic/Mechanism
                </Label>
                <Textarea
                  id="magic"
                  placeholder="How does the magic work?"
                  value={project.contextAndMeaning?.magic || ""}
                  onChange={(e) => updateContextMagic(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "realityPlanes" && (
            <div className="space-y-3">
              {Object.entries(project.realityPlanes || {}).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-white capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <span className="text-xs text-white/70">{value}%</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={([v]) => updateRealityPlane(key as any, v)}
                    max={100}
                    step={1}
                    className="w-full"
                    data-no-drag
                  />
                </div>
              ))}
            </div>
          )}

          {element.componentKey === "sensoryDomains" && (
            <div className="space-y-3">
              {Object.entries(project.sensoryDomains || {}).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-white capitalize">
                      {key}
                    </Label>
                    <span className="text-xs text-white/70">{value}%</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={([v]) => updateSensoryDomain(key as any, v)}
                    max={100}
                    step={1}
                    className="w-full"
                    data-no-drag
                  />
                </div>
              ))}
            </div>
          )}

          {element.componentKey === "presenceTypes" && (
            <div className="space-y-3">
              {Object.entries(project.presenceTypes || {}).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-white capitalize">
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </Label>
                    <span className="text-xs text-white/70">{value}%</span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={([v]) => updatePresenceType(key as any, v)}
                    max={100}
                    step={1}
                    className="w-full"
                    data-no-drag
                  />
                </div>
              ))}
            </div>
          )}

          {element.componentKey === "stateMapping" && (
            <div className="grid grid-cols-2 gap-3">
              {(["cognition", "emotion", "soma", "relational"] as const).map((quadrant) => (
                <div key={quadrant} className="space-y-2">
                  <Label className="text-sm font-medium text-white capitalize">
                    {quadrant}
                  </Label>
                  <Textarea
                    placeholder={`${quadrant} state...`}
                    value={(project.stateMapping as any)?.[quadrant] || ""}
                    onChange={(e) => updateStateMapping(quadrant as any, e.target.value)}
                    className="bg-secondary/50 border-border/50 text-white min-h-[60px] text-xs"
                    data-no-drag
                  />
                </div>
              ))}
            </div>
          )}

          {element.componentKey === "traitMapping" && (
            <div className="grid grid-cols-2 gap-3">
              {(["cognitive", "emotional", "somatic", "relational"] as const).map((quadrant) => (
                <div key={quadrant} className="space-y-2">
                  <Label className="text-sm font-medium text-white capitalize">
                    {quadrant}
                  </Label>
                  <Textarea
                    placeholder={`${quadrant} trait...`}
                    value={project.traitMapping?.[quadrant] || ""}
                    onChange={(e) => updateTraitMapping(quadrant, e.target.value)}
                    className="bg-secondary/50 border-border/50 text-white min-h-[60px] text-xs"
                    data-no-drag
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// Note: LineCard has been removed - lines are now rendered in LinesOverlay (SVG overlay system)
