"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { CXDSectionId } from "@/types/cxd-schema";
import { ChevronRight, Home } from "lucide-react";
import { HexagonDetailPanel } from "./hexagon-detail-panel";
import { ExperienceFlowDrawer } from "./experience-flow-drawer";
import { CanvasToolkit } from "./canvas-toolkit";
import { CanvasElementRenderer } from "./canvas-element";
import { NavigationToolkit } from "./navigation-toolkit";
import { v4 as uuidv4 } from "uuid";
import {
  CanvasElement,
  CanvasElementType,
  ShapeType,
  DEFAULT_ELEMENT_SIZES,
} from "@/types/canvas-elements";

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_SENSITIVITY = 0.001;

// Wedges clockwise starting at top (6 unique sections)
const wedgeConfig = [
  { id: "presence" as CXDSectionId, label: "Presence\nTypes", index: 0 },
  {
    id: "realityPlanes" as CXDSectionId,
    label: "Reality &\nSensory Stack",
    index: 1,
  },
  { id: "stateMapping" as CXDSectionId, label: "State\nMapping", index: 2 },
  { id: "traitMapping" as CXDSectionId, label: "Trait\nMapping", index: 3 },
  {
    id: "contextAndMeaning" as CXDSectionId,
    label: "Meaning\nArchitecture",
    index: 4,
  },
  { id: "desiredChange" as CXDSectionId, label: "Desired\nChange", index: 5 },
];

// Get hexagon vertex at given index (0-5), starting from top, clockwise
function getHexVertex(
  cx: number,
  cy: number,
  r: number,
  index: number,
): { x: number; y: number } {
  const angle = (Math.PI / 3) * index - Math.PI / 2;
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

// Generate wedge path between outer and inner hex for segment i
function getWedgePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  index: number,
): string {
  const outer1 = getHexVertex(cx, cy, outerR, index);
  const outer2 = getHexVertex(cx, cy, outerR, (index + 1) % 6);
  const inner1 = getHexVertex(cx, cy, innerR, index);
  const inner2 = getHexVertex(cx, cy, innerR, (index + 1) % 6);

  return `M ${outer1.x} ${outer1.y} L ${outer2.x} ${outer2.y} L ${inner2.x} ${inner2.y} L ${inner1.x} ${inner1.y} Z`;
}

// Get center point of a wedge for label placement (centroid of 4 polygon vertices)
function getWedgeCenter(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  index: number,
): { x: number; y: number } {
  const outer1 = getHexVertex(cx, cy, outerR, index);
  const outer2 = getHexVertex(cx, cy, outerR, (index + 1) % 6);
  const inner1 = getHexVertex(cx, cy, innerR, index);
  const inner2 = getHexVertex(cx, cy, innerR, (index + 1) % 6);

  return {
    x: (outer1.x + outer2.x + inner1.x + inner2.x) / 4,
    y: (outer1.y + outer2.y + inner1.y + inner2.y) / 4,
  };
}

// Generate hexagon points for SVG polygon
function hexagonPoints(cx: number, cy: number, r: number): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const v = getHexVertex(cx, cy, r, i);
    points.push(`${v.x},${v.y}`);
  }
  return points.join(" ");
}

export function HexagonView() {
  const {
    getCurrentProject,
    canvasPosition,
    setCanvasPosition,
    canvasZoom,
    setCanvasZoom,
    addCanvasElement,
    updateCanvasElement,
    removeCanvasElement,
    duplicateCanvasElement,
    activeBoardId,
    activeSurface,
    boardPath,
    createBoard,
    enterBoard,
    navigateToBoardPath,
    getCanvasElements,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCXDStore();
  const project = getCurrentProject();
  // Get elements scoped to the active board and surface (hypercube)
  const canvasElements = getCanvasElements();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredWedge, setHoveredWedge] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<CXDSectionId | null>(
    null,
  );
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [draggingElement, setDraggingElement] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleWedgeClick = (sectionId: CXDSectionId) => {
    setSelectedSection(sectionId);
  };

  const handleCoreClick = () => {
    setSelectedSection("intentionCore" as CXDSectionId);
  };

  const handleClosePanel = () => {
    setSelectedSection(null);
  };

  const isPanelOpen = selectedSection !== null;

  // Pan handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest(".hex-wedge") || target.closest(".hex-core")) return;
    // Only start panning if not clicking on an element
    if (!target.closest("[data-element-id]")) {
      setIsPanning(true);
      setPanStart({
        x: e.clientX,
        y: e.clientY,
      });
    }
  }, []);

  // Zoom with scroll wheel
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, canvasZoom * (1 + delta)),
      );
      const zoomRatio = newZoom / canvasZoom;

      const newPosX = mouseX - (mouseX - canvasPosition.x) * zoomRatio;
      const newPosY = mouseY - (mouseY - canvasPosition.y) * zoomRatio;

      setCanvasZoom(newZoom);
      setCanvasPosition({ x: newPosX, y: newPosY });
    },
    [canvasZoom, canvasPosition, setCanvasZoom, setCanvasPosition],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  const handleZoomIn = () =>
    setCanvasZoom(Math.min(MAX_ZOOM, canvasZoom * 1.2));
  const handleZoomOut = () =>
    setCanvasZoom(Math.max(MIN_ZOOM, canvasZoom / 1.2));
  const handleResetView = () => {
    // Reset to hypercube default: centered at 95%
    setCanvasPosition({ x: 0, y: 0 });
    setCanvasZoom(0.95);
  };
  const handleFitAll = () => {
    // Fit all to hypercube default: centered at 95%
    setCanvasPosition({ x: 0, y: 0 });
    setCanvasZoom(0.95);
  };

  // Handle placing elements on the hypercube canvas (board-scoped)
  const handlePlaceElement = useCallback(
    (
      type: CanvasElementType,
      position: { x: number; y: number },
      options?: { shapeType?: ShapeType },
    ) => {
      if (!project) return;

      const size = DEFAULT_ELEMENT_SIZES[type];
      const maxZIndex = canvasElements.reduce(
        (max, el) => Math.max(max, el.zIndex),
        0,
      );

      const baseElement = {
        id: uuidv4(),
        type,
        x: position.x - size.width / 2,
        y: position.y - size.height / 2,
        width: size.width,
        height: size.height,
        zIndex: maxZIndex + 1,
        boardId: activeBoardId, // Scope to active board
        surface: activeSurface, // Scope to active surface (canvas or hypercube)
      };

      let newElement: CanvasElement;

      switch (type) {
        case "freeform":
          newElement = {
            ...baseElement,
            type: "freeform",
            content: "",
            style: { bgColor: "#fef3c7" },
          };
          break;
        case "image":
          newElement = {
            ...baseElement,
            type: "image",
            src: "",
            objectFit: "cover",
          };
          break;
        case "shape":
          newElement = {
            ...baseElement,
            type: "shape",
            shapeType: options?.shapeType || "rectangle",
          };
          break;
        case "container":
          newElement = { ...baseElement, type: "container", label: "" };
          break;
        case "connector":
          // Connectors are created via drag, not click placement
          return;
        case "text":
          newElement = { ...baseElement, type: "text", content: "" };
          break;
        case "link":
          newElement = {
            ...baseElement,
            type: "link",
            url: "",
            linkMode: "bookmark",
          };
          break;
        case "board":
          const newChildBoardId = createBoard("New Board");
          newElement = {
            ...baseElement,
            type: "board",
            childBoardId: newChildBoardId, // The board this node opens into
            title: "New Board",
          };
          // Note: The board node's own placement boardId (where it appears) is set in baseElement
          // childBoardId is the board it opens into
          break;
        default:
          return;
      }

      addCanvasElement(newElement);
    },
    [
      project,
      canvasElements,
      addCanvasElement,
      createBoard,
      activeBoardId,
      activeSurface,
    ],
  );

  // Handle entering a board node
  const handleEnterBoard = useCallback(
    (boardId: string, title: string) => {
      enterBoard(boardId, title);
    },
    [enterBoard],
  );

  // Element drag handlers for persistence
  const handleElementDragStart = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      const element = canvasElements.find((el) => el.id === elementId);
      if (!element) return;

      setDraggingElement(elementId);
      setSelectedElementId(elementId);

      // Calculate offset from mouse to element position
      const mouseX = (e.clientX - canvasPosition.x) / canvasZoom;
      const mouseY = (e.clientY - canvasPosition.y) / canvasZoom;
      setDragOffset({
        x: mouseX - element.x,
        y: mouseY - element.y,
      });
    },
    [canvasElements, canvasPosition, canvasZoom],
  );

  const handleElementDragEnd = useCallback(() => {
    setDraggingElement(null);
  }, []);

  // Handle mouse move for dragging elements
  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setCanvasPosition({
          x: canvasPosition.x + dx,
          y: canvasPosition.y + dy,
        });
        setPanStart({ x: e.clientX, y: e.clientY });
      } else if (draggingElement) {
        const mouseX = (e.clientX - canvasPosition.x) / canvasZoom;
        const mouseY = (e.clientY - canvasPosition.y) / canvasZoom;
        const newX = mouseX - dragOffset.x;
        const newY = mouseY - dragOffset.y;

        // Update element position in store (persists to state)
        updateCanvasElement(draggingElement, { x: newX, y: newY });
      }
    },
    [
      isPanning,
      panStart,
      canvasPosition,
      setCanvasPosition,
      draggingElement,
      dragOffset,
      canvasZoom,
      updateCanvasElement,
    ],
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    if (draggingElement) {
      setDraggingElement(null);
    }
  }, [draggingElement]);

  if (!project) return null;

  const outerRadius = 300;
  const innerRadius = 100;
  const centerX = 400;
  const centerY = 400;

  const wedgeColors = [
    "hsl(270 25% 25%)",
    "hsl(270 25% 22%)",
    "hsl(270 25% 25%)",
    "hsl(270 25% 22%)",
    "hsl(270 25% 25%)",
    "hsl(270 25% 22%)",
  ];

  const wedgeHoverColors = [
    "hsl(270 30% 32%)",
    "hsl(270 30% 29%)",
    "hsl(270 30% 32%)",
    "hsl(270 30% 29%)",
    "hsl(270 30% 32%)",
    "hsl(270 30% 29%)",
  ];

  return (
    <div className="fixed inset-0 top-16 overflow-hidden">
      {/* Hexagon canvas area - fixed, never shifts */}
      <div
        ref={containerRef}
        className={`absolute inset-0 overflow-hidden ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Dot grid background */}
        <div
          className="absolute pointer-events-none"
          style={{
            inset: "-100%",
            width: "300%",
            height: "300%",
            backgroundImage: `radial-gradient(circle, hsl(270 30% 25% / 0.3) 1px, transparent 1px)`,
            backgroundSize: `${30 * canvasZoom}px ${30 * canvasZoom}px`,
            backgroundPosition: `${canvasPosition.x % (30 * canvasZoom)}px ${canvasPosition.y % (30 * canvasZoom)}px`,
          }}
        />
        {/* Canvas content with transform */}
        <div
          className="absolute will-change-transform"
          style={{
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
            transformOrigin: "0 0",
            left: "calc(50% - 400px)",
            top: "calc(50% - 400px)",
          }}
        >
          <svg width="800" height="800" className="overflow-visible">
            <defs>
              <linearGradient
                id="coreGradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="hsl(280 80% 35%)" />
                <stop offset="50%" stopColor="hsl(270 90% 50%)" />
                <stop offset="100%" stopColor="hsl(260 85% 40%)" />
              </linearGradient>
              <filter
                id="coreGlow"
                x="-50%"
                y="-50%"
                width="200%"
                height="200%"
              >
                <feGaussianBlur stdDeviation="8" result="blur1" />
                <feFlood
                  floodColor="hsl(270 90% 60%)"
                  floodOpacity="0.6"
                  result="color"
                />
                <feComposite
                  in="color"
                  in2="blur1"
                  operator="in"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter
                id="coreOuterGlow"
                x="-100%"
                y="-100%"
                width="300%"
                height="300%"
              >
                <feGaussianBlur stdDeviation="20" result="blur2" />
                <feFlood
                  floodColor="hsl(270 80% 55%)"
                  floodOpacity="0.4"
                  result="color2"
                />
                <feComposite
                  in="color2"
                  in2="blur2"
                  operator="in"
                  result="outerGlow"
                />
              </filter>
              <style>
                {`
                @keyframes coreShimmer {
                  0%, 100% { opacity: 0.6; }
                  50% { opacity: 1; }
                }
                .core-pulse {
                  animation: coreShimmer 8s ease-in-out infinite;
                }
              `}
              </style>
            </defs>

            {/* Outer hexagon border */}
            <polygon
              points={hexagonPoints(centerX, centerY, outerRadius)}
              fill="none"
              stroke="hsl(270 30% 40%)"
              strokeWidth="3"
            />

            {/* 6 Wedge segments with labels */}
            {wedgeConfig.map((wedge, i) => {
              const isHovered = hoveredWedge === i;
              const wedgePath = getWedgePath(
                centerX,
                centerY,
                outerRadius,
                innerRadius,
                i,
              );
              const center = getWedgeCenter(
                centerX,
                centerY,
                outerRadius,
                innerRadius,
                i,
              );
              const lines = wedge.label.split("\n");
              const lineHeight = 14;
              const startY = center.y - ((lines.length - 1) * lineHeight) / 2;
              const clipId = `clip-wedge-${wedge.id}`;

              return (
                <g key={wedge.id}>
                  {/* Wedge shape */}
                  <path
                    d={wedgePath}
                    fill={isHovered ? wedgeHoverColors[i] : wedgeColors[i]}
                    stroke="hsl(270 30% 40%)"
                    strokeWidth="1.5"
                    className="hex-wedge cursor-pointer transition-colors duration-150"
                    onMouseEnter={() => setHoveredWedge(i)}
                    onMouseLeave={() => setHoveredWedge(null)}
                    onClick={() => handleWedgeClick(wedge.id)}
                  />
                  {/* Clip path for label */}
                  <clipPath id={clipId}>
                    <path d={wedgePath} />
                  </clipPath>
                  {/* Label group with clipping */}
                  <g clipPath={`url(#${clipId})`} pointerEvents="none">
                    {lines.map((line, lineIndex) => (
                      <text
                        key={lineIndex}
                        x={center.x}
                        y={startY + lineIndex * lineHeight}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="hsl(0 0% 90%)"
                        fontSize="11"
                        fontWeight="600"
                        className="uppercase tracking-wider"
                      >
                        {line}
                      </text>
                    ))}
                  </g>
                </g>
              );
            })}

            {/* Outer glow layer for core */}
            <polygon
              points={hexagonPoints(centerX, centerY, innerRadius + 5)}
              fill="hsl(270 80% 50% / 0.15)"
              filter="url(#coreOuterGlow)"
              className="core-pulse pointer-events-none"
            />

            {/* Inner hexagon (Core) */}
            <polygon
              points={hexagonPoints(centerX, centerY, innerRadius)}
              fill="url(#coreGradient)"
              stroke="hsl(270 70% 70%)"
              strokeWidth="2"
              filter="url(#coreGlow)"
              className="hex-core cursor-pointer hover:brightness-125 transition-all"
              onClick={handleCoreClick}
            />

            {/* Core text */}
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="middle"
              className="hex-core cursor-pointer pointer-events-none"
              fill="hsl(0 0% 98%)"
              fontSize="16"
              fontWeight="700"
              style={{ textShadow: "0 0 10px hsl(270 80% 70%)" }}
            >
              CORE
            </text>
          </svg>

          {/* Canvas Elements (freeform, images, shapes, etc.) */}
          {canvasElements.map((element) => (
            <CanvasElementRenderer
              key={element.id}
              element={element}
              onUpdate={(updates) => updateCanvasElement(element.id, updates)}
              onDelete={() => removeCanvasElement(element.id)}
              onDuplicate={() => duplicateCanvasElement(element.id)}
              onDragStart={(e) => handleElementDragStart(element.id, e)}
              onDragEnd={handleElementDragEnd}
              isDragging={draggingElement === element.id}
              isSelected={selectedElementId === element.id}
              onSelect={() => setSelectedElementId(element.id)}
              canvasZoom={canvasZoom}
              onEnterBoard={handleEnterBoard}
            />
          ))}
        </div>
        {/* Zoom Controls */}
        <NavigationToolkit
          canvasZoom={canvasZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onFitAll={handleFitAll}
          onUndo={() => {
            if (canUndo()) undo();
          }}
          onRedo={() => {
            if (canRedo()) redo();
          }}
          canUndo={canUndo()}
          canRedo={canRedo()}
        />
      </div>
      {/* Scrim overlay when panel is open */}
      {isPanelOpen && (
        <div
          className="fixed inset-0 top-16 bg-black/20 z-30 pointer-events-none"
          aria-hidden="true"
        />
      )}
      {/* Right side: Details Panel - fixed overlay, no layout shift */}
      <div
        className={`fixed top-16 right-0 h-[calc(100vh-4rem)] w-[420px] min-w-[360px] max-w-[480px] bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl z-40 transition-transform duration-200 ease-out ${
          isPanelOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {selectedSection && (
          <HexagonDetailPanel
            sectionId={selectedSection}
            onClose={handleClosePanel}
          />
        )}
      </div>
      {/* Bottom Experience Flow Drawer */}
      <ExperienceFlowDrawer />
      {/* Breadcrumbs for board navigation */}
      {boardPath.length > 0 && (
        <div className="fixed top-20 left-6 z-30 flex items-center gap-1 px-3 py-2 rounded-lg bg-card/80 backdrop-blur border border-border text-sm">
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
                className={`hover:text-primary transition-colors ${index === boardPath.length - 1 ? "text-primary font-medium" : ""}`}
              >
                {board.title}
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Canvas Toolkit */}
      <CanvasToolkit
        onPlaceElement={handlePlaceElement}
        canvasRef={containerRef}
        canvasPosition={canvasPosition}
        canvasZoom={canvasZoom}
      />
      {/* Zoom Controls */}
    </div>
  );
}
