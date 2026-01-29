"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { CXD_SECTIONS, CXDProject, CXDSectionId } from "@/types/cxd-schema";
import { CanvasElementRenderer } from "./canvas/canvas-element";
import { NavigationToolkit } from "./canvas/navigation-toolkit";
// import { LineLayer } from "@/components/cxd/canvas/line-layer";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home, Target, Sparkles, Users, Globe, Layers, Eye, Radio, Brain, Heart, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Icon mapping for sections
const SECTION_ICONS: Record<CXDSectionId, LucideIcon> = {
  intentionCore: Target,
  desiredChange: Sparkles,
  humanContext: Users,
  contextAndMeaning: Globe,
  realityPlanes: Layers,
  sensoryDomains: Eye,
  presence: Radio,
  experienceFlow: Radio,
  stateMapping: Brain,
  traitMapping: Heart,
};
import type {
  CanvasElement,
  CanvasEdge,
} from "@/types/canvas-elements";

// Constants for zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;

// Default section positions
const DEFAULT_SECTION_POSITIONS: Record<string, { x: number; y: number }> = {
  intentionCore: { x: 600, y: 100 },
  desiredChange: { x: 200, y: 50 },
  humanContext: { x: 1000, y: 50 },
  contextAndMeaning: { x: 100, y: 400 },
  realityPlanes: { x: 500, y: 400 },
  sensoryDomains: { x: 900, y: 400 },
  presence: { x: 1300, y: 400 },
  stateMapping: { x: 400, y: 750 },
  traitMapping: { x: 800, y: 750 },
};

const CANVAS_SECTIONS = CXD_SECTIONS.filter((s) => s.id !== "experienceFlow");

interface CXDCanvasReadOnlyProps {
  project: CXDProject;
}

export function CXDCanvasReadOnly({ project }: CXDCanvasReadOnlyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [canvasPosition, setCanvasPosition] = useState({ x: 0, y: 0 });
  const [canvasZoom, setCanvasZoom] = useState(1);
  const [boardPath, setBoardPath] = useState<Array<{ id: string; title: string }>>([]);
  const [currentBoardId, setCurrentBoardId] = useState<string | null>(null);

  // Get canvas elements and edges from project
  const canvasElements = useMemo(() => project.canvasLayout?.elements || [], [project.canvasLayout?.elements]);
  const canvasEdges = useMemo(() => project.canvasLayout?.edges || [], [project.canvasLayout?.edges]);

  // Get section positions from layout or use defaults
  const localPositions = useMemo(() => {
    return project.canvasLayout?.sectionPositions || DEFAULT_SECTION_POSITIONS;
  }, [project.canvasLayout?.sectionPositions]);

  // Filter elements for current board
  const visibleElements = useMemo(() => {
    return canvasElements.filter((el) => el.boardId === currentBoardId);
  }, [canvasElements, currentBoardId]);

  // Filter edges for current board
  const visibleEdges = useMemo(() => {
    return canvasEdges.filter((edge) => {
      const fromEl = canvasElements.find((el) => el.id === edge.from);
      const toEl = canvasElements.find((el) => el.id === edge.to);
      return fromEl?.boardId === currentBoardId && toEl?.boardId === currentBoardId;
    });
  }, [canvasEdges, canvasElements, currentBoardId]);

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX - canvasPosition.x, y: e.clientY - canvasPosition.y });
    }
  }, [canvasPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      setCanvasPosition({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, canvasZoom * (1 + delta)));
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - canvasPosition.x) / canvasZoom;
    const worldY = (mouseY - canvasPosition.y) / canvasZoom;

    const newX = mouseX - worldX * newZoom;
    const newY = mouseY - worldY * newZoom;

    setCanvasZoom(newZoom);
    setCanvasPosition({ x: newX, y: newY });
  }, [canvasZoom, canvasPosition]);

  const handleZoomIn = useCallback(() => {
    const newZoom = Math.min(MAX_ZOOM, canvasZoom * 1.2);
    setCanvasZoom(newZoom);
  }, [canvasZoom]);

  const handleZoomOut = useCallback(() => {
    const newZoom = Math.max(MIN_ZOOM, canvasZoom / 1.2);
    setCanvasZoom(newZoom);
  }, [canvasZoom]);

  const handleResetView = useCallback(() => {
    setCanvasZoom(1);
    setCanvasPosition({ x: 0, y: 0 });
  }, []);

  const handleFitAll = useCallback(() => {
    const allElements = [...visibleElements];
    if (allElements.length === 0) return;

    const bounds = allElements.reduce(
      (acc, el) => ({
        minX: Math.min(acc.minX, el.position.x),
        minY: Math.min(acc.minY, el.position.y),
        maxX: Math.max(acc.maxX, el.position.x + (el.size?.width || 0)),
        maxY: Math.max(acc.maxY, el.position.y + (el.size?.height || 0)),
      }),
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
    );

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const padding = 100;
    const contentWidth = bounds.maxX - bounds.minX + padding * 2;
    const contentHeight = bounds.maxY - bounds.minY + padding * 2;

    const zoomX = rect.width / contentWidth;
    const zoomY = rect.height / contentHeight;
    const newZoom = Math.min(Math.max(Math.min(zoomX, zoomY), MIN_ZOOM), MAX_ZOOM);

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    setCanvasZoom(newZoom);
    setCanvasPosition({
      x: rect.width / 2 - centerX * newZoom,
      y: rect.height / 2 - centerY * newZoom,
    });
  }, [visibleElements]);

  // Board navigation (read-only)
  const handleElementDoubleClick = useCallback((elementId: string) => {
    const element = canvasElements.find((el) => el.id === elementId);
    if (element?.type === "board") {
      setBoardPath([...boardPath, { id: element.id, title: element.content || "Board" }]);
      setCurrentBoardId(element.id);
    }
  }, [canvasElements, boardPath]);

  const navigateToBoardPath = useCallback((index: number) => {
    if (index === -1) {
      setBoardPath([]);
      setCurrentBoardId(null);
    } else {
      const newPath = boardPath.slice(0, index + 1);
      setBoardPath(newPath);
      setCurrentBoardId(newPath[newPath.length - 1].id);
    }
  }, [boardPath]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-background">
      {/* Canvas Container */}
      <div
        ref={containerRef}
        className={cn(
          "absolute inset-0 overflow-hidden",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Canvas Transform Group */}
        <div
          style={{
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
            transformOrigin: "0 0",
            position: "absolute",
            left: 0,
            top: 0,
          }}
        >
          {/* Grid Background */}
          <div
            className="absolute pointer-events-none"
            style={{
              left: -10000,
              top: -10000,
              width: 20000,
              height: 20000,
              backgroundImage: `
                radial-gradient(circle, rgba(168, 85, 247, 0.15) 1px, transparent 1px),
                radial-gradient(circle, rgba(20, 184, 166, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: "50px 50px, 10px 10px",
              backgroundPosition: "0 0, 25px 25px",
            }}
          />

          {/* Line Layer - Edges */}
          {/* Disabled for readonly view */}

          {/* Canvas Elements */}
          {visibleElements.map((element) => (
            <CanvasElementRenderer
              key={element.id}
              element={element}
              isSelected={false}
              isDragging={false}
              canvasZoom={canvasZoom}
              onUpdate={() => {}}
              onDelete={() => {}}
              onDuplicate={() => {}}
              onDragStart={() => {}}
              onDragEnd={() => {}}
              onSelect={() => {}}
              onDoubleClick={() => handleElementDoubleClick(element.id)}
              onEnterBoard={handleElementDoubleClick}
              isReadOnly={true}
            />
          ))}

          {/* Section Cards (only on root board) */}
          {currentBoardId === null &&
            CANVAS_SECTIONS.map((section) => {
              const pos = localPositions[section.id] || { x: 0, y: 0 };
              const Icon = SECTION_ICONS[section.id];

              return (
                <div
                  key={section.id}
                  className="absolute"
                  style={{
                    left: pos.x,
                    top: pos.y,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div className="w-64 rounded-xl gradient-border bg-card/80 backdrop-blur p-4 shadow-2xl pointer-events-auto">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center glow-purple">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm text-gradient">
                          {section.label}
                        </h3>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {section.description}
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Breadcrumbs for board navigation */}
      {boardPath.length > 0 && (
        <div className="absolute left-6 top-6 z-30 flex items-center gap-1 px-3 py-2 rounded-lg bg-card/80 backdrop-blur border border-border text-sm shadow-[0_0_15px_rgba(168,85,247,0.4)]">
          <button
            onClick={() => navigateToBoardPath(-1)}
            className="flex items-center gap-1 hover:text-primary transition-colors"
          >
            <Home className="w-4 h-4" />
            <span>Root</span>
          </button>
          {boardPath.map((board, index) => (
            <div key={board.id} className="flex items-center">
              <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
              <button
                onClick={() => navigateToBoardPath(index)}
                className={`hover:text-primary transition-colors ${
                  index === boardPath.length - 1 ? "text-primary font-medium" : ""
                }`}
              >
                {board.title}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Navigation Toolkit (Zoom Controls Only - Read Only) */}
      <NavigationToolkit
        canvasZoom={canvasZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onFitAll={handleFitAll}
      />
    </div>
  );
}
