"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { useCXDStore } from "@/store/cxd-store";
import { CXD_SECTIONS, CXDSectionId } from "@/types/cxd-schema";
import { ExperienceFlowDrawer } from "./canvas/experience-flow-drawer";
import { CanvasToolkit } from "./canvas/canvas-toolkit";
import { CanvasElementRenderer } from "./canvas/canvas-element";
import { ExperienceInspector } from "./canvas/experience-inspector";
import { NavigationToolkit } from "./canvas/navigation-toolkit";
import { LinesOverlay } from "./canvas/lines-overlay";
import { Button } from "@/components/ui/button";
import { ChevronRight, Home } from "lucide-react";
import {
  CanvasElement,
  CanvasElementType,
  DEFAULT_ELEMENT_SIZES,
  ShapeType,
  LineElement,
  getAnchorPosition,
  getAutoAnchorPosition,
  getClosestAnchors,
  CanvasEdge,
} from "@/types/canvas-elements";

// Constants for zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;
const ZOOM_SENSITIVITY = 0.001;

// Default section positions (used when no stored positions exist)
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

// Filter out experienceFlow from sections displayed as cards (it's in the timeline now)
const CANVAS_SECTIONS = CXD_SECTIONS.filter((s) => s.id !== "experienceFlow");

export function CXDCanvas() {
  const {
    canvasPosition,
    setCanvasPosition,
    canvasZoom,
    setCanvasZoom,
    setFocusedSection,
    getCurrentProject,
    updateCanvasLayout,
    canvasViewMode,
    addCanvasElement,
    updateCanvasElement,
    removeCanvasElement,
    getCanvasElements,
    duplicateCanvasElement,
    addCanvasEdge,
    updateCanvasEdge,
    removeCanvasEdge,
    getCanvasEdges,
    enterBoard,
    exitBoard,
    navigateToBoardPath,
    createBoard,
    currentBoardId,
    activeBoardId,
    activeSurface,
    boardPath,
    moveContainerWithChildren,
    addNodeToContainer,
    pushCanvasHistory,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCXDStore();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggingSection, setDraggingSection] = useState<string | null>(null);
  const [dragSectionStart, setDragSectionStart] = useState({ x: 0, y: 0 });
  const [localPositions, setLocalPositions] = useState<
    Record<string, { x: number; y: number }>
  >(DEFAULT_SECTION_POSITIONS);
  const [clickStartTime, setClickStartTime] = useState(0);
  const [clickStartPos, setClickStartPos] = useState({ x: 0, y: 0 });

  // Inspector panel state (starts closed by default)
  const [inspectorPanelOpen, setInspectorPanelOpen] = useState(false);

  // Canvas elements state
  const [draggingElement, setDraggingElement] = useState<string | null>(null);
  const [dragElementStart, setDragElementStart] = useState({ x: 0, y: 0 });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    null,
  );
  const [selectedElementIds, setSelectedElementIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Bend handle dragging state
  const [draggingBendHandle, setDraggingBendHandle] = useState<string | null>(
    null,
  );
  const [bendDragStart, setBendDragStart] = useState({ x: 0, y: 0 });

  // Connector hover target for glow feedback
  const [hoverTargetNodeId, setHoverTargetNodeId] = useState<string | null>(
    null,
  );
  const [hoverTargetPort, setHoverTargetPort] = useState<{
    nodeId: string;
    port: string;
  } | null>(null);

  // Multi-select marquee state
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeStart, setMarqueeStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(
    null,
  );

  // Drag offsets for multi-select group dragging
  const [dragOffsets, setDragOffsets] = useState<
    Map<string, { x: number; y: number }>
  >(new Map());

  // Drop target board
  const [dropTargetBoardId, setDropTargetBoardId] = useState<string | null>(
    null,
  );

  // Experience block drag state
  const [draggingExperienceBlock, setDraggingExperienceBlock] = useState<{
    sectionId: string;
    label: string;
  } | null>(null);
  const [experienceBlockDragPos, setExperienceBlockDragPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Connector creation state
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<{
    elementId: string;
    anchor: "top" | "right" | "bottom" | "left";
  } | null>(null);
  const [connectorPreview, setConnectorPreview] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const project = getCurrentProject();
  const canvasElements = getCanvasElements();
  const canvasEdges = getCanvasEdges();

  // Debug: log edges
  console.log(
    "[CANVAS] Active board:",
    activeBoardId,
    "Active surface:",
    activeSurface,
  );
  console.log("[CANVAS] All edges in project:", project?.canvasEdges || []);
  console.log("[CANVAS] Filtered edges for current view:", canvasEdges);

  // Listen for line creation events from the toolkit
  useEffect(() => {
    if (!containerRef.current) return;

    const handleCreateLine = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { startX, startY, endX, endY } = customEvent.detail;

      const maxZIndex = canvasElements.reduce(
        (max, el) => Math.max(max, el.zIndex),
        0,
      );

      const midX = (startX + endX) / 2;
      const midY = (startY + endY) / 2;

      const newLine: LineElement = {
        id: uuidv4(),
        type: "line",
        x: Math.min(startX, endX), // Nominal position for backward compat
        y: Math.min(startY, endY),
        width: Math.abs(endX - startX),
        height: Math.abs(endY - startY),
        zIndex: maxZIndex + 1,
        boardId: activeBoardId,
        surface: activeSurface,
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        bend: { x: midX, y: midY },
        style: {
          color: "hsl(180 100% 50% / 0.8)",
          widthPx: 2,
          kind: "solid" as const,
        },
      };

      addCanvasElement(newLine);
    };

    const canvas = containerRef.current;
    canvas.addEventListener("createLine", handleCreateLine);

    return () => {
      canvas.removeEventListener("createLine", handleCreateLine);
    };
  }, [
    containerRef,
    canvasElements,
    activeBoardId,
    activeSurface,
    addCanvasElement,
  ]);

  // Merge project's saved canvas layout with defaults
  const sectionPositions = useMemo(() => {
    if (!project) return DEFAULT_SECTION_POSITIONS;
    return {
      ...DEFAULT_SECTION_POSITIONS,
      ...(project.canvasLayout || {}),
      ...localPositions,
    };
  }, [project, localPositions]);

  // Initialize local positions from project on mount
  useEffect(() => {
    if (project?.canvasLayout) {
      setLocalPositions((prev) => ({
        ...DEFAULT_SECTION_POSITIONS,
        ...project.canvasLayout,
      }));
    }
  }, [project?.id]);

  // Canvas panning - mouse down on background
  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      // Only pan if clicking on background or canvas-background
      if (
        target === containerRef.current ||
        target.classList.contains("canvas-background") ||
        target.classList.contains("dot-grid")
      ) {
        // Shift+click OR right-click starts marquee selection
        if ((e.shiftKey && e.button === 0) || e.button === 2) {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
            const y = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
            setIsMarqueeSelecting(true);
            setMarqueeStart({ x, y });
            setMarqueeEnd({ x, y });
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }

        // Don't start panning if right-click
        if (e.button === 2) {
          e.preventDefault();
          return;
        }

        setIsPanning(true);
        setPanStart({
          x: e.clientX - canvasPosition.x,
          y: e.clientY - canvasPosition.y,
        });
        // Deselect element when clicking on background
        setSelectedElementId(null);
        setSelectedElementIds(new Set());
        setSelectedEdgeId(null); // Also deselect connector/edge
        e.preventDefault();
      }
    },
    [canvasPosition, canvasZoom],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isMarqueeSelecting && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
        const y = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
        setMarqueeEnd({ x, y });
        return;
      }

      if (isPanning) {
        const newX = e.clientX - panStart.x;
        const newY = e.clientY - panStart.y;
        setCanvasPosition({ x: newX, y: newY });
      } else if (draggingSection) {
        // Move the section
        const deltaX = (e.clientX - dragSectionStart.x) / canvasZoom;
        const deltaY = (e.clientY - dragSectionStart.y) / canvasZoom;
        const newPos = {
          x: (sectionPositions[draggingSection]?.x || 0) + deltaX,
          y: (sectionPositions[draggingSection]?.y || 0) + deltaY,
        };
        setLocalPositions((prev) => ({
          ...prev,
          [draggingSection]: newPos,
        }));
        setDragSectionStart({ x: e.clientX, y: e.clientY });
      } else if (draggingElement) {
        // Move the canvas element(s)
        const deltaX = (e.clientX - dragElementStart.x) / canvasZoom;
        const deltaY = (e.clientY - dragElementStart.y) / canvasZoom;

        // If multiple items are selected, move them all
        if (
          selectedElementIds.size > 1 &&
          selectedElementIds.has(draggingElement)
        ) {
          selectedElementIds.forEach((id) => {
            const el = canvasElements.find((e) => e.id === id);
            if (el) {
              const offset = dragOffsets.get(id) || { x: 0, y: 0 };
              if (el.type === "container") {
                moveContainerWithChildren(id, deltaX, deltaY);
              } else {
                updateCanvasElement(id, {
                  x: el.x + deltaX,
                  y: el.y + deltaY,
                });
              }
            }
          });

          // Check for drop target board
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseCanvasX =
              (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
            const mouseCanvasY =
              (e.clientY - rect.top - canvasPosition.y) / canvasZoom;

            const boardTarget = canvasElements.find(
              (el) =>
                el.type === "board" &&
                !selectedElementIds.has(el.id) &&
                mouseCanvasX >= el.x &&
                mouseCanvasX <= el.x + el.width &&
                mouseCanvasY >= el.y &&
                mouseCanvasY <= el.y + el.height,
            );
            setDropTargetBoardId(boardTarget?.id || null);
          }
        } else {
          const element = canvasElements.find(
            (el) => el.id === draggingElement,
          );
          if (element) {
            // If it's a container, move children too
            if (element.type === "container") {
              moveContainerWithChildren(draggingElement, deltaX, deltaY);
            } else {
              updateCanvasElement(draggingElement, {
                x: element.x + deltaX,
                y: element.y + deltaY,
              });
            }
          }

          // Check for drop target board (for single element drag)
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseCanvasX =
              (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
            const mouseCanvasY =
              (e.clientY - rect.top - canvasPosition.y) / canvasZoom;

            const boardTarget = canvasElements.find(
              (el) =>
                el.type === "board" &&
                el.id !== draggingElement &&
                mouseCanvasX >= el.x &&
                mouseCanvasX <= el.x + el.width &&
                mouseCanvasY >= el.y &&
                mouseCanvasY <= el.y + el.height,
            );
            setDropTargetBoardId(boardTarget?.id || null);
          }
        }
        setDragElementStart({ x: e.clientX, y: e.clientY });
      } else if (isConnecting && containerRef.current) {
        // Update connector preview position
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
        const y = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
        setConnectorPreview({ x, y });

        // Hit test for hover target - find ANY node, not just ports
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        let foundNode = false;

        if (targetElement) {
          // Walk up DOM to find node
          let currentEl: Element | null = targetElement;
          while (currentEl && currentEl !== containerRef.current) {
            const nodeId = currentEl.getAttribute("data-node-id");
            const isCanvasNode = currentEl.getAttribute("data-canvas-node");

            if (
              nodeId &&
              isCanvasNode &&
              connectingFrom &&
              nodeId !== connectingFrom.elementId
            ) {
              // Valid target node found
              if (hoverTargetNodeId !== nodeId) {
                console.log("[CONNECTOR] Hover target node:", nodeId);
                setHoverTargetNodeId(nodeId);
                setHoverTargetPort({ nodeId, port: "auto" });
              }
              foundNode = true;
              break;
            }
            currentEl = currentEl.parentElement;
          }
        }

        if (!foundNode && hoverTargetNodeId) {
          console.log("[CONNECTOR] Left target node");
          setHoverTargetNodeId(null);
          setHoverTargetPort(null);
        }
      } else if (draggingBendHandle && containerRef.current) {
        // Update bend handle position
        const rect = containerRef.current.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
        const y = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;

        const dx = x - bendDragStart.x;
        const dy = y - bendDragStart.y;

        const edge = canvasEdges.find((e) => e.id === draggingBendHandle);
        if (edge && edge.bend) {
          updateCanvasEdge(draggingBendHandle, {
            bend: {
              x: edge.bend.x + dx,
              y: edge.bend.y + dy,
            },
          });
        }
        setBendDragStart({ x, y });
      }
    },
    [
      isPanning,
      panStart,
      draggingSection,
      dragSectionStart,
      draggingElement,
      dragElementStart,
      canvasZoom,
      setCanvasPosition,
      sectionPositions,
      canvasElements,
      updateCanvasElement,
      isConnecting,
      canvasPosition,
      moveContainerWithChildren,
      isMarqueeSelecting,
      selectedElementIds,
      dragOffsets,
      draggingBendHandle,
      bendDragStart,
      canvasEdges,
      updateCanvasEdge,
    ],
  );

  const handleCanvasMouseUp = useCallback(() => {
    // Handle marquee selection end
    if (isMarqueeSelecting && marqueeStart && marqueeEnd) {
      const minX = Math.min(marqueeStart.x, marqueeEnd.x);
      const maxX = Math.max(marqueeStart.x, marqueeEnd.x);
      const minY = Math.min(marqueeStart.y, marqueeEnd.y);
      const maxY = Math.max(marqueeStart.y, marqueeEnd.y);

      const intersecting = canvasElements.filter((el) => {
        const elRight = el.x + el.width;
        const elBottom = el.y + el.height;
        return !(
          el.x > maxX ||
          elRight < minX ||
          el.y > maxY ||
          elBottom < minY
        );
      });

      setSelectedElementIds(new Set(intersecting.map((el) => el.id)));
      if (intersecting.length > 0) {
        setSelectedElementId(intersecting[0].id);
      }

      setIsMarqueeSelecting(false);
      setMarqueeStart(null);
      setMarqueeEnd(null);
      return;
    }

    // Persist position to project when drag ends
    if (draggingSection && localPositions[draggingSection]) {
      updateCanvasLayout(draggingSection, localPositions[draggingSection]);
    }
    setIsPanning(false);
    setDraggingSection(null);
    setDraggingBendHandle(null);

    // Cancel connecting if clicking on background
    if (isConnecting) {
      // Only cancel if no target node was detected
      if (!hoverTargetNodeId) {
        console.log(
          "[CONNECTOR] Canceling connector - clicked on background, no target node",
        );
        setIsConnecting(false);
        setConnectingFrom(null);
        setConnectorPreview(null);
        setHoverTargetNodeId(null);
        setHoverTargetPort(null);
      } else {
        // Node was detected, create the connection
        console.log(
          "[CONNECTOR] Creating connector to node:",
          hoverTargetNodeId,
        );
        if (
          connectingFrom &&
          hoverTargetNodeId &&
          hoverTargetNodeId !== connectingFrom.elementId
        ) {
          const fromEl = canvasElements.find(
            (el) => el.id === connectingFrom.elementId,
          );
          const toEl = canvasElements.find((el) => el.id === hoverTargetNodeId);

          let bendPoint: { x: number; y: number } | undefined;
          if (fromEl && toEl) {
            const fromPos = getAnchorPosition(fromEl, connectingFrom.anchor);
            const toPos = getAutoAnchorPosition(toEl, fromPos);
            bendPoint = {
              x: (fromPos.x + toPos.x) / 2,
              y: (fromPos.y + toPos.y) / 2,
            };
          }

          const newEdge: CanvasEdge = {
            id: uuidv4(),
            fromNodeId: connectingFrom.elementId,
            toNodeId: hoverTargetNodeId,
            fromAnchor: connectingFrom.anchor,
            toAnchor: "auto" as any,
            boardId: activeBoardId,
            surface: activeSurface,
            bend: bendPoint,
            style: {
              color: "hsl(180 100% 50% / 0.8)",
              thickness: 2,
              lineStyle: "solid",
              arrowHead: false,
            },
          };
          console.log("[CONNECTOR] Creating edge:", newEdge);
          addCanvasEdge(newEdge);
          setTimeout(() => {
            console.log("[CONNECTOR] Edge added. Checking after timeout...");
          }, 100);
        }

        setIsConnecting(false);
        setConnectingFrom(null);
        setConnectorPreview(null);
        setHoverTargetNodeId(null);
        setHoverTargetPort(null);
      }
    }

    // DON'T clear dropTargetBoardId here - it gets cleared in handleElementDragEnd
    // setDropTargetBoardId(null);
  }, [
    draggingSection,
    localPositions,
    updateCanvasLayout,
    isConnecting,
    isMarqueeSelecting,
    marqueeStart,
    marqueeEnd,
    canvasElements,
    hoverTargetNodeId,
    connectingFrom,
    activeBoardId,
    activeSurface,
    addCanvasEdge,
  ]);

  // Handle element creation from toolkit (board-scoped)
  const handlePlaceElement = useCallback(
    (
      type: CanvasElementType,
      position: { x: number; y: number },
      options?: {
        shapeType?: ShapeType;
        linkMode?: "bookmark" | "embed" | "file";
      },
    ) => {
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
            style: {
              bgColor:
                "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
              textColor: "#ffffff",
            },
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
        case "line":
          // Line tool - handled separately via drag interaction in toolkit
          return;
        case "text":
          newElement = { ...baseElement, type: "text", content: "" };
          break;
        case "link":
          const linkMode = options?.linkMode || "bookmark";
          newElement = {
            ...baseElement,
            type: "link",
            url: "",
            linkMode,
            // For embed mode, set a larger default size with 4:3 aspect ratio
            ...(linkMode === "embed" && {
              width: 480,
              height: 360,
            }),
            // For file mode, set file view mode to bookmark by default
            ...(linkMode === "file" && {
              fileViewMode: "bookmark" as const,
            }),
          };
          break;
        case "board":
          // Create a new child board and the board node
          const newChildBoardId = createBoard("New Board");
          newElement = {
            ...baseElement,
            type: "board",
            childBoardId: newChildBoardId, // The board this node opens into
            title: "New Board",
          };
          // Note: baseElement.boardId tells which board this node appears in (the parent)
          // childBoardId is the board this node opens into when double-clicked
          break;
        default:
          return;
      }

      addCanvasElement(newElement);
      setSelectedElementId(newElement.id);
    },
    [
      canvasElements,
      addCanvasElement,
      createBoard,
      activeBoardId,
      activeSurface,
    ],
  );

  // Handle element drag start
  const handleElementDragStart = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const element = canvasElements.find((el) => el.id === elementId);

      // Store offsets for all selected elements for group dragging
      if (selectedElementIds.size > 1 && selectedElementIds.has(elementId)) {
        const offsets = new Map<string, { x: number; y: number }>();
        const baseEl = element;
        if (baseEl) {
          selectedElementIds.forEach((id) => {
            const el = canvasElements.find((e) => e.id === id);
            if (el) {
              offsets.set(id, { x: el.x - baseEl.x, y: el.y - baseEl.y });
            }
          });
        }
        setDragOffsets(offsets);
      }

      setDraggingElement(elementId);
      setDragElementStart({ x: e.clientX, y: e.clientY });
      setSelectedElementId(elementId);
    },
    [canvasElements, selectedElementIds],
  );

  // Handle element drag end
  const handleElementDragEnd = useCallback(() => {
    // Check if dropped on a board (both multi-select and single element)
    if (dropTargetBoardId) {
      const targetBoard = canvasElements.find(
        (el) => el.id === dropTargetBoardId,
      );

      if (
        targetBoard &&
        targetBoard.type === "board" &&
        (targetBoard as any).childBoardId
      ) {
        const targetChildBoardId = (targetBoard as any).childBoardId;

        // Collect elements to move (either selected elements or the dragging element)
        const elementsToMove =
          selectedElementIds.size > 0
            ? Array.from(selectedElementIds)
            : draggingElement
              ? [draggingElement]
              : [];

        // Move elements into the target board
        elementsToMove.forEach((id) => {
          const el = canvasElements.find((e) => e.id === id);
          if (el && el.type !== "board") {
            // Update boardId to move element into the board
            updateCanvasElement(id, {
              boardId: targetChildBoardId,
              // Center items in the new board canvas
              x: 100 + Math.random() * 200,
              y: 100 + Math.random() * 200,
            });
          }
        });

        // Clear selection after move
        setSelectedElementIds(new Set());
        setSelectedElementId(null);
        setDropTargetBoardId(null);
        setDraggingElement(null);
        return;
      }
    }

    // Check if element was dropped into a container
    if (draggingElement) {
      const draggedElement = canvasElements.find(
        (el) => el.id === draggingElement,
      );
      if (draggedElement && draggedElement.type !== "container") {
        // Find if we're inside any container
        const containers = canvasElements.filter(
          (el) => el.type === "container",
        );
        for (const container of containers) {
          if (
            draggedElement.x >= container.x &&
            draggedElement.y >= container.y &&
            draggedElement.x + draggedElement.width <=
              container.x + container.width &&
            draggedElement.y + draggedElement.height <=
              container.y + container.height
          ) {
            addNodeToContainer(draggingElement, container.id);
            break;
          }
        }
      }
    }
    setDraggingElement(null);
    setDropTargetBoardId(null);
  }, [
    draggingElement,
    canvasElements,
    addNodeToContainer,
    dropTargetBoardId,
    selectedElementIds,
    updateCanvasElement,
  ]);

  // Handle experience block drag start
  const handleExperienceBlockDragStart = useCallback(
    (sectionId: string, clientX: number, clientY: number) => {
      // Get section label from INSPECTOR_SECTIONS
      const section = [
        { id: "intentionCore", label: "Intention Core" },
        { id: "desiredChange", label: "Desired Change" },
        { id: "humanContext", label: "Human Context" },
        { id: "contextAndMeaning", label: "Meaning Architecture" },
        { id: "realityPlanes", label: "Reality Planes" },
        { id: "sensoryDomains", label: "Sensory Domains" },
        { id: "presenceTypes", label: "Presence Types" },
        { id: "stateMapping", label: "State Mapping" },
        { id: "traitMapping", label: "Trait Mapping" },
      ].find((s) => s.id === sectionId);

      if (section) {
        setDraggingExperienceBlock({
          sectionId: section.id,
          label: section.label,
        });
        setExperienceBlockDragPos({ x: clientX, y: clientY });
      }
    },
    [],
  );

  // Handle experience block drag move
  useEffect(() => {
    if (!draggingExperienceBlock) return;

    const handleMouseMove = (e: MouseEvent) => {
      setExperienceBlockDragPos({ x: e.clientX, y: e.clientY });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (containerRef.current && draggingExperienceBlock) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
        const canvasY = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;

        // Check if dropped on canvas (not outside)
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          // Create experience block element
          const maxZIndex = canvasElements.reduce(
            (max, el) => Math.max(max, el.zIndex),
            0,
          );

          const newElement = {
            id: uuidv4(),
            type: "experienceBlock" as const,
            componentKey: draggingExperienceBlock.sectionId as any,
            title: draggingExperienceBlock.label,
            x: canvasX - 110, // Center the 220px wide element
            y: canvasY - 50, // Center the 100px tall element
            width: 220,
            height: 100,
            zIndex: maxZIndex + 1,
            boardId: activeBoardId,
            surface: activeSurface,
          };

          addCanvasElement(newElement);
        }
      }

      setDraggingExperienceBlock(null);
      setExperienceBlockDragPos(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    draggingExperienceBlock,
    canvasPosition,
    canvasZoom,
    canvasElements,
    addCanvasElement,
    activeBoardId,
    activeSurface,
  ]);

  // Handle connector creation start
  const handleStartConnector = useCallback(
    (elementId: string, anchor: "top" | "right" | "bottom" | "left") => {
      console.log("[CONNECTOR] Starting connector from:", elementId, anchor);
      setIsConnecting(true);
      setConnectingFrom({ elementId, anchor });
      setSelectedElementId(null);
      setHoverTargetNodeId(null);
      setHoverTargetPort(null);
    },
    [],
  );

  // Handle connector creation end (on element)
  const handleEndConnector = useCallback(
    (toElementId: string, toAnchor: "top" | "right" | "bottom" | "left") => {
      console.log(
        "[CONNECTOR] End connector called:",
        toElementId,
        toAnchor,
        "connectingFrom:",
        connectingFrom,
      );
      if (connectingFrom && connectingFrom.elementId !== toElementId) {
        // Calculate midpoint for default bend position
        const fromEl = canvasElements.find(
          (el) => el.id === connectingFrom.elementId,
        );
        const toEl = canvasElements.find((el) => el.id === toElementId);

        let bendPoint: { x: number; y: number } | undefined;
        if (fromEl && toEl) {
          const fromPos = getAnchorPosition(fromEl, connectingFrom.anchor);
          const toPos = getAnchorPosition(toEl, toAnchor);
          bendPoint = {
            x: (fromPos.x + toPos.x) / 2,
            y: (fromPos.y + toPos.y) / 2,
          };
        }

        const newEdge: CanvasEdge = {
          id: uuidv4(),
          fromNodeId: connectingFrom.elementId,
          toNodeId: toElementId,
          fromAnchor: connectingFrom.anchor,
          toAnchor: toAnchor,
          boardId: activeBoardId,
          surface: activeSurface,
          bend: bendPoint,
          style: {
            color: "hsl(180 100% 50% / 0.8)", // Cyan neon
            thickness: 2,
            lineStyle: "solid",
            arrowHead: false,
          },
        };
        console.log("[CONNECTOR] Creating edge:", newEdge);
        addCanvasEdge(newEdge);
        // Force a re-check after adding
        setTimeout(() => {
          console.log("[CONNECTOR] Edge added. Checking after timeout...");
        }, 100);
      }
      setIsConnecting(false);
      setConnectingFrom(null);
      setConnectorPreview(null);
      setHoverTargetNodeId(null);
      setHoverTargetPort(null);
    },
    [
      connectingFrom,
      addCanvasEdge,
      canvasElements,
      activeBoardId,
      activeSurface,
    ],
  );

  // Handle entering a board
  const handleEnterBoard = useCallback(
    (boardId: string, title: string) => {
      enterBoard(boardId, title);
    },
    [enterBoard],
  );

  // Handle delete key for edges and elements, and undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
        return;
      }

      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
        return;
      }

      // Redo: Ctrl+Y or Cmd+Y (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        // GUARD: Do not delete elements if user is editing text
        const target = e.target as HTMLElement;
        const isEditingText =
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.contentEditable === "true" ||
          target.hasAttribute("data-no-drag"); // Our text editing marker

        if (isEditingText) {
          // User is typing - let normal text editing happen
          return;
        }

        // Prevent default browser behavior
        if (selectedElementIds.size > 0 || selectedEdgeId) {
          e.preventDefault();
          pushCanvasHistory(); // Save state before delete
        }

        if (selectedEdgeId) {
          removeCanvasEdge(selectedEdgeId);
          setSelectedEdgeId(null);
        }

        if (selectedElementIds.size > 0) {
          selectedElementIds.forEach((id) => {
            // Remove the element
            removeCanvasElement(id);

            // Remove all connectors attached to this element
            const edges = getCanvasEdges();
            edges.forEach((edge) => {
              if (edge.fromNodeId === id || edge.toNodeId === id) {
                removeCanvasEdge(edge.id);
              }
            });
          });
          setSelectedElementIds(new Set());
          setSelectedElementId(null);
        }
      }
      if (e.key === "Escape") {
        setIsConnecting(false);
        setConnectingFrom(null);
        setConnectorPreview(null);
        setSelectedElementIds(new Set());
        setSelectedElementId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedEdgeId,
    selectedElementIds,
    removeCanvasEdge,
    removeCanvasElement,
    undo,
    redo,
    canUndo,
    canRedo,
    pushCanvasHistory,
  ]);

  // Smooth zoom with scroll wheel - zoom towards cursor position
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate zoom
      const delta = -e.deltaY * ZOOM_SENSITIVITY;
      const newZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, canvasZoom * (1 + delta)),
      );
      const zoomRatio = newZoom / canvasZoom;

      // Zoom towards cursor position
      const newPosX = mouseX - (mouseX - canvasPosition.x) * zoomRatio;
      const newPosY = mouseY - (mouseY - canvasPosition.y) * zoomRatio;

      setCanvasZoom(newZoom);
      setCanvasPosition({ x: newPosX, y: newPosY });
    },
    [canvasZoom, canvasPosition, setCanvasZoom, setCanvasPosition],
  );

  // Attach wheel event with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  const handleZoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, canvasZoom * 1.2);
    setCanvasZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, canvasZoom / 1.2);
    setCanvasZoom(newZoom);
  };

  const handleResetView = () => {
    setCanvasPosition({ x: 100, y: 100 });
    setCanvasZoom(0.8);
  };

  const handleFitAll = () => {
    // Calculate bounding box of all sections
    const positions = Object.values(sectionPositions);
    if (positions.length === 0) return;

    const minX = Math.min(...positions.map((p) => p.x)) - 50;
    const maxX = Math.max(...positions.map((p) => p.x)) + 350;
    const minY = Math.min(...positions.map((p) => p.y)) - 50;
    const maxY = Math.max(...positions.map((p) => p.y)) + 350;

    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const scaleX = containerWidth / contentWidth;
    const scaleY = containerHeight / contentHeight;
    const newZoom = Math.min(scaleX, scaleY, 1) * 0.9;

    setCanvasZoom(newZoom);
    setCanvasPosition({
      x: (containerWidth - contentWidth * newZoom) / 2 - minX * newZoom,
      y: (containerHeight - contentHeight * newZoom) / 2 - minY * newZoom,
    });
  };

  // Section drag handlers
  const handleSectionMouseDown = useCallback(
    (e: React.MouseEvent, sectionId: string) => {
      e.stopPropagation();
      setClickStartTime(Date.now());
      setClickStartPos({ x: e.clientX, y: e.clientY });
      setDraggingSection(sectionId);
      setDragSectionStart({ x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleSectionMouseUp = useCallback(
    (e: React.MouseEvent, sectionId: CXDSectionId) => {
      const clickDuration = Date.now() - clickStartTime;
      const clickDistance = Math.sqrt(
        Math.pow(e.clientX - clickStartPos.x, 2) +
          Math.pow(e.clientY - clickStartPos.y, 2),
      );

      // If it was a quick click with minimal movement, treat as click
      if (clickDuration < 200 && clickDistance < 5) {
        // Single click - do nothing, wait for double click
      }
      setDraggingSection(null);
    },
    [clickStartTime, clickStartPos],
  );

  const handleSectionDoubleClick = useCallback(
    (sectionId: CXDSectionId) => {
      setFocusedSection(sectionId);
    },
    [setFocusedSection],
  );

  // Touch handling for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        if (
          target === containerRef.current ||
          target.classList.contains("canvas-background") ||
          target.classList.contains("dot-grid")
        ) {
          setIsPanning(true);
          setPanStart({
            x: e.touches[0].clientX - canvasPosition.x,
            y: e.touches[0].clientY - canvasPosition.y,
          });
        }
      }
    },
    [canvasPosition],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isPanning && e.touches.length === 1) {
        setCanvasPosition({
          x: e.touches[0].clientX - panStart.x,
          y: e.touches[0].clientY - panStart.y,
        });
      }
    },
    [isPanning, panStart, setCanvasPosition],
  );

  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setDraggingSection(null);
  }, []);

  if (!project) return null;

  // Build section layout from stored positions (excluding experienceFlow card)
  const sectionLayout = CANVAS_SECTIONS.map((section) => ({
    id: section.id,
    x:
      sectionPositions[section.id]?.x ??
      DEFAULT_SECTION_POSITIONS[section.id]?.x ??
      100,
    y:
      sectionPositions[section.id]?.y ??
      DEFAULT_SECTION_POSITIONS[section.id]?.y ??
      100,
  }));

  // Calculate right margin based on inspector panel state
  // When panel is open, add a small margin (60px for icon rail). When closed, just the icon rail width.
  const canvasRightMargin = inspectorPanelOpen ? 60 : 60;

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 top-16 overflow-hidden select-none transition-[right] duration-300 ${
        isPanning
          ? "cursor-grabbing"
          : draggingElement
            ? "cursor-move"
            : "cursor-grab w-full"
      }`}
      style={{ right: canvasRightMargin }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={handleCanvasMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Canvas Background with dot grid */}
      <div
        className="canvas-background absolute inset-0 top-full left-1/2 -translate-x-1/2 p-2 rounded-lg backdrop-blur border border-border shadow-xl z-50 grid grid-cols-3 gap-1 w-[134px] h-[102px] py-[8px] mt-[14.75px] bg-[#0f0939] opacity-[1]"
        style={{
          background:
            "radial-gradient(circle at center, hsl(270 45% 8%) 0%, hsl(270 50% 3%) 100%)",
        }}
      />
      {/* Dot grid that moves with pan */}
      <div
        className="dot-grid absolute pointer-events-none"
        style={{
          inset: "-100%",
          width: "300%",
          height: "300%",
          backgroundImage: `radial-gradient(circle, hsl(270 30% 25% / 0.4) 1px, transparent 1px)`,
          backgroundSize: `${30 * canvasZoom}px ${30 * canvasZoom}px`,
          backgroundPosition: `${canvasPosition.x % (30 * canvasZoom)}px ${canvasPosition.y % (30 * canvasZoom)}px`,
          transition: "none",
        }}
      />
      {/* Canvas Content */}
      <div
        className="absolute will-change-transform"
        style={{
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Canvas Elements (freeform, images, shapes, etc.) - excluding lines which are rendered in overlay */}
        {canvasElements.filter((el) => el.type !== 'line').map((element) => (
          <CanvasElementRenderer
            key={element.id}
            element={element}
            onUpdate={(updates) => updateCanvasElement(element.id, updates)}
            onDelete={() => removeCanvasElement(element.id)}
            onDuplicate={() => duplicateCanvasElement(element.id)}
            onDragStart={(e) => {
              // Prevent dragging while connecting
              if (!isConnecting) {
                handleElementDragStart(element.id, e);
              }
            }}
            onDragEnd={handleElementDragEnd}
            isDragging={draggingElement === element.id}
            isSelected={
              selectedElementId === element.id ||
              selectedElementIds.has(element.id)
            }
            isDropTarget={dropTargetBoardId === element.id}
            isHoverTarget={hoverTargetNodeId === element.id}
            onSelect={(e) => {
              if (e?.shiftKey || e?.ctrlKey || e?.metaKey) {
                // Multi-select with Shift/Ctrl/Cmd
                const newSelected = new Set(selectedElementIds);
                if (newSelected.has(element.id)) {
                  newSelected.delete(element.id);
                } else {
                  newSelected.add(element.id);
                }
                setSelectedElementIds(newSelected);
                setSelectedElementId(element.id);
              } else {
                // Single select
                setSelectedElementId(element.id);
                setSelectedElementIds(new Set([element.id]));
              }
              setSelectedEdgeId(null);
            }}
            canvasZoom={canvasZoom}
            onEnterBoard={handleEnterBoard}
            onStartConnector={handleStartConnector}
            onEndConnector={handleEndConnector}
            isConnecting={isConnecting}
            onOpenExperiencePanel={(sectionId: any) => {
              if ((window as any).__openExperienceSection) {
                (window as any).__openExperienceSection(sectionId);
              }
            }}
          />
        ))}

        {/* Marquee Selection Rectangle */}
        {isMarqueeSelecting && marqueeStart && marqueeEnd && (
          <div
            className="absolute border-2 border-primary/60 bg-primary/10 pointer-events-none"
            style={{
              left: Math.min(marqueeStart.x, marqueeEnd.x),
              top: Math.min(marqueeStart.y, marqueeEnd.y),
              width: Math.abs(marqueeEnd.x - marqueeStart.x),
              height: Math.abs(marqueeEnd.y - marqueeStart.y),
            }}
          />
        )}
      </div>

      {/* Lines Overlay (rendered outside transformed canvas, in screen coordinates) */}
      <LinesOverlay
        lines={canvasElements.filter((el) => el.type === 'line') as LineElement[]}
        selectedLineId={selectedElementId}
        onSelectLine={(id) => {
          if (id) {
            setSelectedElementId(id);
            setSelectedElementIds(new Set([id]));
            setSelectedEdgeId(null);
          } else {
            setSelectedElementId(null);
            setSelectedElementIds(new Set());
          }
        }}
        onUpdateLine={(id, updates) => updateCanvasElement(id, updates)}
        canvasPosition={canvasPosition}
        canvasZoom={canvasZoom}
        onDeleteLine={(id) => removeCanvasElement(id)}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
          transformOrigin: "0 0",
        }}
      >
        {/* Connectors SVG Layer */}
        <svg
          className="absolute inset-0 overflow-visible"
          style={{
            width: "10000px",
            height: "10000px",
            left: 0,
            top: 0,
            pointerEvents: "none",
          }}
        >
          {/* Debug: render count */}
          <text x="10" y="20" fill="white" fontSize="12">
            Edges: {canvasEdges.length}
          </text>
          <rect x="0" y="0" width="100" height="30" fill="rgba(255,0,0,0.2)" />

          {/* Existing edges */}
          {canvasEdges.map((edge) => {
            console.log(
              "[SVG] Rendering edge:",
              edge.id,
              "from:",
              edge.fromNodeId,
              "to:",
              edge.toNodeId,
            );
            const fromElement = canvasElements.find(
              (el) => el.id === edge.fromNodeId,
            );
            const toElement = canvasElements.find(
              (el) => el.id === edge.toNodeId,
            );
            if (!fromElement || !toElement) return null;

            const from = getAnchorPosition(fromElement, edge.fromAnchor);

            // Handle auto anchor for target
            let to: { x: number; y: number };
            if ((edge.toAnchor as any) === "auto") {
              to = getAutoAnchorPosition(toElement, from);
            } else {
              to = getAnchorPosition(toElement, edge.toAnchor);
            }

            const isSelected = selectedEdgeId === edge.id;

            // Use bend point or default to midpoint
            const bend = edge.bend || {
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2,
            };

            // Create path for curve using quadratic Bezier
            const pathD = `M ${from.x} ${from.y} Q ${bend.x} ${bend.y} ${to.x} ${to.y}`;

            return (
              <g key={edge.id}>
                {/* Clickable invisible path for selection */}
                <path
                  d={pathD}
                  stroke="transparent"
                  strokeWidth={12}
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedEdgeId(edge.id);
                    setSelectedElementId(null);
                    setSelectedElementIds(new Set());
                  }}
                />
                {/* Visible path */}
                <path
                  d={pathD}
                  stroke={
                    isSelected
                      ? "hsl(280 100% 70%)" // Purple highlight when selected
                      : edge.style?.color || "hsl(180 100% 50% / 0.8)"
                  }
                  strokeWidth={isSelected ? 3 : edge.style?.thickness || 2}
                  fill="none"
                  strokeDasharray={
                    edge.style?.lineStyle === "dashed"
                      ? "8,4"
                      : edge.style?.lineStyle === "dotted"
                        ? "2,4"
                        : undefined
                  }
                  markerEnd={
                    edge.style?.arrowHead ? "url(#arrowhead)" : undefined
                  }
                />
              </g>
            );
          })}

          {/* Connector preview while creating */}
          {isConnecting && connectingFrom && connectorPreview && (
            <line
              x1={(() => {
                const fromEl = canvasElements.find(
                  (el) => el.id === connectingFrom.elementId,
                );
                return fromEl
                  ? getAnchorPosition(fromEl, connectingFrom.anchor).x
                  : 0;
              })()}
              y1={(() => {
                const fromEl = canvasElements.find(
                  (el) => el.id === connectingFrom.elementId,
                );
                return fromEl
                  ? getAnchorPosition(fromEl, connectingFrom.anchor).y
                  : 0;
              })()}
              x2={connectorPreview.x}
              y2={connectorPreview.y}
              stroke="hsl(180 100% 50% / 0.6)"
              strokeWidth={2}
              strokeDasharray="8,4"
              className="pointer-events-none"
            />
          )}

          {/* Arrow marker definition */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
            </marker>
          </defs>
        </svg>

        {/* Bend handles for selected connector */}
        {selectedEdgeId &&
          (() => {
            const edge = canvasEdges.find((e) => e.id === selectedEdgeId);
            if (!edge) return null;

            const fromElement = canvasElements.find(
              (el) => el.id === edge.fromNodeId,
            );
            const toElement = canvasElements.find(
              (el) => el.id === edge.toNodeId,
            );
            if (!fromElement || !toElement) return null;

            const from = getAnchorPosition(fromElement, edge.fromAnchor);

            // Handle auto anchor for target
            let to: { x: number; y: number };
            if ((edge.toAnchor as any) === "auto") {
              to = getAutoAnchorPosition(toElement, from);
            } else {
              to = getAnchorPosition(toElement, edge.toAnchor);
            }

            const bend = edge.bend || {
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2,
            };

            return (
              <div
                className="absolute w-3 h-3 bg-purple-500 border-2 border-white rounded-full cursor-move z-50 hover:scale-125 transition-transform"
                style={{
                  left: bend.x - 6,
                  top: bend.y - 6,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setDraggingBendHandle(selectedEdgeId);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x =
                      (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
                    const y =
                      (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
                    setBendDragStart({ x, y });
                  }
                }}
              />
            );
          })()}

        {/* Connector context menu */}
        {selectedEdgeId &&
          (() => {
            const edge = canvasEdges.find((e) => e.id === selectedEdgeId);
            if (!edge) return null;

            const fromElement = canvasElements.find(
              (el) => el.id === edge.fromNodeId,
            );
            const toElement = canvasElements.find(
              (el) => el.id === edge.toNodeId,
            );
            if (!fromElement || !toElement) return null;

            const from = getAnchorPosition(fromElement, edge.fromAnchor);

            // Handle auto anchor for target
            let to: { x: number; y: number };
            if ((edge.toAnchor as any) === "auto") {
              to = getAutoAnchorPosition(toElement, from);
            } else {
              to = getAnchorPosition(toElement, edge.toAnchor);
            }

            const bend = edge.bend || {
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2,
            };

            // Calculate menu position near line but not covering it
            const midX = bend.x;
            const midY = bend.y;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const normalX = -dy / length; // perpendicular
            const normalY = dx / length;
            const offset = 24;
            let menuX = midX + normalX * offset;
            let menuY = midY + normalY * offset - 100; // center vertically around menu

            // Clamp to viewport
            if (menuX < 8) menuX = midX - normalX * offset;
            if (menuY < 8) menuY = 8;

            const THEME_COLORS = [
              { name: "Cyan", value: "hsl(180 100% 50% / 0.8)" },
              { name: "Purple", value: "hsl(280 100% 70% / 0.8)" },
              { name: "Pink", value: "hsl(330 100% 70% / 0.8)" },
              { name: "Blue", value: "hsl(220 100% 60% / 0.8)" },
              { name: "Green", value: "hsl(150 100% 50% / 0.8)" },
              { name: "Orange", value: "hsl(30 100% 60% / 0.8)" },
              { name: "Yellow", value: "hsl(60 100% 60% / 0.8)" },
              { name: "Red", value: "hsl(0 100% 60% / 0.8)" },
            ];

            return (
              <div
                className="absolute p-3 rounded-lg bg-card/95 backdrop-blur border border-border shadow-xl z-50 min-w-[200px]"
                style={{
                  left: menuX,
                  top: menuY,
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Line Style */}
                <div className="space-y-2 mb-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Line Style
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        updateCanvasEdge(selectedEdgeId, {
                          style: { ...edge.style, lineStyle: "solid" },
                        })
                      }
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        (edge.style?.lineStyle || "solid") === "solid"
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border hover:bg-primary/10"
                      }`}
                    >
                      Solid
                    </button>
                    <button
                      onClick={() =>
                        updateCanvasEdge(selectedEdgeId, {
                          style: { ...edge.style, lineStyle: "dashed" },
                        })
                      }
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        edge.style?.lineStyle === "dashed"
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border hover:bg-primary/10"
                      }`}
                    >
                      Dashed
                    </button>
                    <button
                      onClick={() =>
                        updateCanvasEdge(selectedEdgeId, {
                          style: { ...edge.style, lineStyle: "dotted" },
                        })
                      }
                      className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                        edge.style?.lineStyle === "dotted"
                          ? "bg-primary/20 border-primary text-primary"
                          : "border-border hover:bg-primary/10"
                      }`}
                    >
                      Dotted
                    </button>
                  </div>
                </div>
                {/* Width */}
                <div className="space-y-2 mb-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Width
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="8"
                    value={edge.style?.thickness || 2}
                    onChange={(e) =>
                      updateCanvasEdge(selectedEdgeId, {
                        style: {
                          ...edge.style,
                          thickness: parseInt(e.target.value),
                        },
                      })
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-center text-muted-foreground">
                    {edge.style?.thickness || 2}px
                  </div>
                </div>
                {/* Color */}
                <div className="space-y-2 mb-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    Color
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {THEME_COLORS.map((color) => (
                      <button
                        key={color.name}
                        onClick={() =>
                          updateCanvasEdge(selectedEdgeId, {
                            style: { ...edge.style, color: color.value },
                          })
                        }
                        className={`w-8 h-8 rounded border-2 transition-transform hover:scale-110 ${
                          edge.style?.color === color.value
                            ? "border-white"
                            : "border-border"
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
                {/* Delete */}
                <button
                  onClick={() => {
                    removeCanvasEdge(selectedEdgeId);
                    setSelectedEdgeId(null);
                  }}
                  className="w-full px-3 py-2 text-xs rounded bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
                >
                  Delete Connector
                </button>
              </div>
            );
          })()}

        {/* Line element context menu */}
        {/* Line context menu is now handled in LinesOverlay component */}
      </div>
      {/* Breadcrumbs for board navigation */}
      {boardPath.length > 0 && (
        <div className="absolute left-6 z-30 flex items-center gap-1 px-3 py-2 rounded-lg bg-card/80 backdrop-blur border border-border text-sm top-[21px]">
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
      {/* Experience Flow Timeline */}
      <ExperienceFlowDrawer />
      {/* Experience Inspector - Icon rail with editable section panels */}
      <ExperienceInspector
        project={project}
        onPanelOpenChange={setInspectorPanelOpen}
        onStartDrag={handleExperienceBlockDragStart}
        onOpenSection={(sectionId: any) => {
          if ((window as any).__openExperienceSection) {
            (window as any).__openExperienceSection(sectionId);
          }
        }}
        className=" right-[15px] static"
      />
      {/* Experience Block Drag Preview */}
      {draggingExperienceBlock && experienceBlockDragPos && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: experienceBlockDragPos.x,
            top: experienceBlockDragPos.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border bg-card/95 backdrop-blur shadow-2xl">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary/20">
              <span className="text-lg">✨</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {draggingExperienceBlock.label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
