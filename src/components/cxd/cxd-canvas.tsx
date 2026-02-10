"use client";

import { useRef, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { useCXDStore } from "@/store/cxd-store";
import { CXD_SECTIONS, CXDSectionId } from "@/types/cxd-schema";
import { ExperienceFlowDrawer } from "./canvas/experience-flow-drawer";
import { CanvasToolkit } from "./canvas/canvas-toolkit";
import { CanvasElementRenderer } from "./canvas/canvas-element";
import { ExperienceInspector } from "./canvas/experience-inspector";
import { NavigationToolkit } from "./canvas/navigation-toolkit";
import { LineLayer } from "./canvas/line-layer";
import { TaskInbox } from "./canvas/task-inbox";
import { MultiSelectionBox } from "./canvas/multi-selection-box";
import { Button } from "@/components/ui/button";
import { Minus, Trash2, Circle, ArrowRight, Square, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CanvasElement,
  CanvasElementType,
  DEFAULT_ELEMENT_SIZES,
  ShapeType,
  ShapeElement,
  LineElement,
  getAnchorPosition,
  getClosestAnchors,
  getNearestAnchor,
  CanvasEdge,
  LineEndStyle,
} from "@/types/canvas-elements";
import { useCollaboration } from "@/hooks/use-collaboration";
import { CollaboratorCursors } from "@/components/collaboration";

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
    setCanvasViewMode,
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
    createBoard,
    currentBoardId,
    activeBoardId,
    activeSurface,
    moveContainerWithChildren,
    addNodeToContainer,
    removeNodeFromContainer,
    pushCanvasHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    highlightedElementId,
    createGroup,
    ungroup,
    getGroupElements,
    clipboard,
    setClipboard,
    getAllInboxItems,
  } = useCXDStore();

  const project = getCurrentProject();
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';

  // Handle remote canvas updates from collaborators
  const handleRemoteUpdate = useCallback((update: any) => {
    console.log('[Collab] Received remote update:', update.type);

    switch (update.type) {
      case 'element_add':
        if (update.element) {
          addCanvasElement(update.element);
        }
        break;
      case 'element_update':
        if (update.elementId && update.changes) {
          updateCanvasElement(update.elementId, update.changes);
        }
        break;
      case 'element_delete':
        if (update.elementId) {
          removeCanvasElement(update.elementId);
        }
        break;
      case 'edge_add':
        if (update.edge) {
          addCanvasEdge(update.edge);
        }
        break;
      case 'edge_delete':
        if (update.edgeId) {
          removeCanvasEdge(update.edgeId);
        }
        break;
      case 'edge_update':
        if (update.edgeId && update.edgeChanges) {
          updateCanvasEdge(update.edgeId, update.edgeChanges);
        }
        break;
      case 'container_move':
        // Handle container movement with all children
        if (update.childUpdates) {
          update.childUpdates.forEach((u: { elementId: string; changes: Record<string, unknown> }) => {
            updateCanvasElement(u.elementId, u.changes);
          });
        }
        break;
      case 'state_sync':
        // Full state sync from undo/redo - update all elements and edges
        if (update.elements && update.edges) {
          // Remove all current elements and edges, then add the synced ones
          const currentElements = getCanvasElements();
          const currentEdges = getCanvasEdges();

          // Remove elements that don't exist in the synced state
          currentElements.forEach(el => {
            if (!update.elements.find((e: any) => e.id === el.id)) {
              removeCanvasElement(el.id);
            }
          });

          // Remove edges that don't exist in the synced state
          currentEdges.forEach(edge => {
            if (!update.edges.find((e: any) => e.id === edge.id)) {
              removeCanvasEdge(edge.id);
            }
          });

          // Add or update elements from synced state
          update.elements.forEach((el: any) => {
            const existing = currentElements.find(e => e.id === el.id);
            if (existing) {
              updateCanvasElement(el.id, el);
            } else {
              addCanvasElement(el);
            }
          });

          // Add edges that don't exist
          update.edges.forEach((edge: any) => {
            const existing = currentEdges.find(e => e.id === edge.id);
            if (!existing) {
              addCanvasEdge(edge);
            }
          });
        }
        break;
    }
  }, [addCanvasElement, updateCanvasElement, removeCanvasElement, addCanvasEdge, removeCanvasEdge, getCanvasElements, getCanvasEdges]);

  // Collaboration - realtime cursors and presence
  const { collaborators, updateCursor, clearCursor, broadcastUpdate } = useCollaboration(
    project?.id || null,
    { onRemoteUpdate: handleRemoteUpdate }
  );

  // Wrapper functions that broadcast changes to collaborators
  const syncAddElement = useCallback((element: CanvasElement) => {
    addCanvasElement(element);
    broadcastUpdate({ type: 'element_add', element });
  }, [addCanvasElement, broadcastUpdate]);

  const syncUpdateElement = useCallback((elementId: string, updates: Partial<CanvasElement>) => {
    updateCanvasElement(elementId, updates);
    broadcastUpdate({ type: 'element_update', elementId, changes: updates });
  }, [updateCanvasElement, broadcastUpdate]);

  const syncRemoveElement = useCallback((elementId: string) => {
    removeCanvasElement(elementId);
    broadcastUpdate({ type: 'element_delete', elementId });
  }, [removeCanvasElement, broadcastUpdate]);

  const syncAddEdge = useCallback((edge: CanvasEdge) => {
    addCanvasEdge(edge);
    broadcastUpdate({ type: 'edge_add', edge });
  }, [addCanvasEdge, broadcastUpdate]);

  const syncRemoveEdge = useCallback((edgeId: string) => {
    removeCanvasEdge(edgeId);
    broadcastUpdate({ type: 'edge_delete', edgeId });
  }, [removeCanvasEdge, broadcastUpdate]);

  const syncUpdateEdge = useCallback((edgeId: string, changes: Partial<CanvasEdge>) => {
    updateCanvasEdge(edgeId, changes);
    broadcastUpdate({ type: 'edge_update', edgeId, edgeChanges: changes });
  }, [updateCanvasEdge, broadcastUpdate]);

  // Sync container movement with all children
  const syncMoveContainerWithChildren = useCallback((containerId: string, deltaX: number, deltaY: number) => {
    // Get all elements that will be affected (container + children)
    const allElements = getCanvasElements();
    const container = allElements.find(el => el.id === containerId);
    const children = allElements.filter(el => el.containerId === containerId);

    // Move the container and children locally
    moveContainerWithChildren(containerId, deltaX, deltaY);

    // Broadcast updates for container and all children
    const childUpdates = [
      { elementId: containerId, changes: { x: (container?.x || 0) + deltaX, y: (container?.y || 0) + deltaY } },
      ...children.map(child => ({
        elementId: child.id,
        changes: { x: child.x + deltaX, y: child.y + deltaY }
      }))
    ];

    broadcastUpdate({ type: 'container_move', containerId, childUpdates });
  }, [moveContainerWithChildren, getCanvasElements, broadcastUpdate]);

  // Broadcast full state sync after undo/redo
  const syncAfterUndoRedo = useCallback(() => {
    const elements = getCanvasElements();
    const edges = getCanvasEdges();
    broadcastUpdate({ type: 'state_sync', elements, edges });
  }, [getCanvasElements, getCanvasEdges, broadcastUpdate]);

  const containerRef = useRef<HTMLDivElement>(null);
  const zoomAccumulator = useRef(0); // Accumulate trackpad zoom delta for incremental steps
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
  // Store original element positions when drag starts (for proper snap calculation)
  // Using ref instead of state to avoid async update issues in callbacks
  const dragOriginalPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Ref to hold latest values for experience block drop handler.
  // This avoids stale closures when the useEffect re-registers listeners.
  // Initialized with placeholder values — gets updated every render before use.
  const experienceDropCtxRef = useRef({
    canvasPosition: { x: 0, y: 0 },
    canvasZoom: 1,
    canvasElements: [] as any[],
    syncAddElement: syncAddElement,
    activeBoardId: null as string | null,
    activeSurface: 'main',
    inboxItems: [] as any[],
    handlePlaceInboxItem: null as ((id: string, x: number, y: number) => void) | null,
  });
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

  // Connector hover target for glow feedback
  const [hoverTargetNodeId, setHoverTargetNodeId] = useState<string | null>(
    null,
  );
  const [hoverTargetPort, setHoverTargetPort] = useState<{
    nodeId: string;
    port: string;
  } | null>(null);

  // Hovered anchor for connector attachment (specific anchor point)
  const [hoveredAnchor, setHoveredAnchor] = useState<string | null>(null);

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

  // Drop target container (for hover feedback)
  const [dropTargetContainerId, setDropTargetContainerId] = useState<
    string | null
  >(null);

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

  // Active tool state (lifted from toolkit for line layer integration)
  const [activeTool, setActiveTool] = useState<CanvasElementType | null>(null);

  // Snap to grid and alignment guides state
  const snapToGrid = false;
  const [showAlignmentGuides, setShowAlignmentGuides] = useState(true);
  const [alignmentGuides, setAlignmentGuides] = useState<{
    horizontal: number[];
    vertical: number[];
  }>({ horizontal: [], vertical: [] });

  // Grid constants
  const GRID_SIZE = 30; // Main grid size (matches dot grid)
  const MINOR_GRID_SIZE = 15; // Minor grid for finer snapping
  const SNAP_THRESHOLD = 6; // Distance threshold for snapping
  const ALIGNMENT_THRESHOLD = 5; // Distance for alignment guide detection

  // Snap a value to the nearest grid increment
  const snapToGridValue = useCallback((value: number, useMinorGrid: boolean = false): number => {
    if (!snapToGrid) return value;
    const gridSize = useMinorGrid ? MINOR_GRID_SIZE : GRID_SIZE;
    return Math.round(value / gridSize) * gridSize;
  }, [snapToGrid]);

  const allCanvasElements = getCanvasElements();
  const canvasEdges = getCanvasEdges();

  // Get inbox items from all boards (not filtered by current board)
  const inboxItems = useMemo(
    () => getAllInboxItems(),
    [getAllInboxItems]
  );
  const canvasElements = useMemo(
    () => allCanvasElements.filter((el) => !el.inInbox),
    [allCanvasElements]
  );
  const canShowConnectorAnchors = activeTool === "line" || activeTool === "connector";

  const getResolvedEdgePoints = useCallback((edge: CanvasEdge, fromElement: CanvasElement, toElement: CanvasElement) => {
    let fromAnchor = edge.fromAnchor;
    let toAnchor = edge.toAnchor;
    if (edge.fromAutoAnchor || edge.toAutoAnchor) {
      const closest = getClosestAnchors(fromElement, toElement);
      if (edge.fromAutoAnchor) fromAnchor = closest.from;
      if (edge.toAutoAnchor) toAnchor = closest.to;
    }

    const from = getAnchorPosition(
      fromElement,
      fromAnchor,
      edge.fromAutoAnchor ? 0.5 : edge.fromAnchorOffset,
    );
    const to = getAnchorPosition(
      toElement,
      toAnchor,
      edge.toAutoAnchor ? 0.5 : edge.toAnchorOffset,
    );

    return { from, to, fromAnchor, toAnchor };
  }, []);

  // State for dragging inbox items onto canvas
  const [draggingInboxItem, setDraggingInboxItem] = useState<string | null>(null);
  const [inboxDragPos, setInboxDragPos] = useState<{ x: number; y: number } | null>(null);

  // Calculate alignment guides for a dragging element (must be after canvasElements is defined)
  const calculateAlignmentGuides = useCallback((
    draggingEl: CanvasElement,
    newX: number,
    newY: number
  ): { horizontal: number[]; vertical: number[]; snapX?: number; snapY?: number } => {
    if (!showAlignmentGuides) return { horizontal: [], vertical: [] };

    const horizontal: number[] = [];
    const vertical: number[] = [];
    let snapX: number | undefined;
    let snapY: number | undefined;

    const draggingCenterX = newX + draggingEl.width / 2;
    const draggingCenterY = newY + draggingEl.height / 2;
    const draggingRight = newX + draggingEl.width;
    const draggingBottom = newY + draggingEl.height;

    // Check against all other elements (not the dragging one)
    canvasElements.forEach((el) => {
      if (el.id === draggingEl.id) return;
      if (selectedElementIds.has(el.id)) return; // Skip other selected elements in multi-select

      const elCenterX = el.x + el.width / 2;
      const elCenterY = el.y + el.height / 2;
      const elRight = el.x + el.width;
      const elBottom = el.y + el.height;

      // Horizontal alignment checks (Y-axis alignments)
      // Top edge alignment
      if (Math.abs(newY - el.y) < ALIGNMENT_THRESHOLD) {
        horizontal.push(el.y);
        if (!snapY) snapY = el.y;
      }
      // Bottom edge alignment
      if (Math.abs(draggingBottom - elBottom) < ALIGNMENT_THRESHOLD) {
        horizontal.push(elBottom);
        if (!snapY) snapY = elBottom - draggingEl.height;
      }
      // Center Y alignment
      if (Math.abs(draggingCenterY - elCenterY) < ALIGNMENT_THRESHOLD) {
        horizontal.push(elCenterY);
        if (!snapY) snapY = elCenterY - draggingEl.height / 2;
      }
      // Top to bottom alignment
      if (Math.abs(newY - elBottom) < ALIGNMENT_THRESHOLD) {
        horizontal.push(elBottom);
        if (!snapY) snapY = elBottom;
      }
      // Bottom to top alignment
      if (Math.abs(draggingBottom - el.y) < ALIGNMENT_THRESHOLD) {
        horizontal.push(el.y);
        if (!snapY) snapY = el.y - draggingEl.height;
      }

      // Vertical alignment checks (X-axis alignments)
      // Left edge alignment
      if (Math.abs(newX - el.x) < ALIGNMENT_THRESHOLD) {
        vertical.push(el.x);
        if (!snapX) snapX = el.x;
      }
      // Right edge alignment
      if (Math.abs(draggingRight - elRight) < ALIGNMENT_THRESHOLD) {
        vertical.push(elRight);
        if (!snapX) snapX = elRight - draggingEl.width;
      }
      // Center X alignment
      if (Math.abs(draggingCenterX - elCenterX) < ALIGNMENT_THRESHOLD) {
        vertical.push(elCenterX);
        if (!snapX) snapX = elCenterX - draggingEl.width / 2;
      }
      // Left to right alignment
      if (Math.abs(newX - elRight) < ALIGNMENT_THRESHOLD) {
        vertical.push(elRight);
        if (!snapX) snapX = elRight;
      }
      // Right to left alignment
      if (Math.abs(draggingRight - el.x) < ALIGNMENT_THRESHOLD) {
        vertical.push(el.x);
        if (!snapX) snapX = el.x - draggingEl.width;
      }
    });

    return { horizontal, vertical, snapX, snapY };
  }, [showAlignmentGuides, canvasElements, selectedElementIds]);

  // Debug: log edges
  console.log(
    "[CANVAS] Active board:",
    activeBoardId,
    "Active surface:",
    activeSurface,
  );
  console.log("[CANVAS] All edges in project:", project?.canvasLayout?.edges || []);
  console.log("[CANVAS] Filtered edges for current view:", canvasEdges);

  // Line creation callback from LineLayer
  const handleCreateLine = useCallback(
    (lineData: Omit<LineElement, "id" | "zIndex" | "boardId" | "surface">) => {
      const maxZIndex = canvasElements.reduce(
        (max, el) => Math.max(max, Number.isFinite(el.zIndex) ? el.zIndex : 0),
        0,
      );

      const newLine: LineElement = {
        ...lineData,
        id: uuidv4(),
        zIndex: maxZIndex + 1,
        boardId: activeBoardId,
        surface: activeSurface,
      };

      syncAddElement(newLine);
      // Select the newly created line
      setSelectedElementId(newLine.id);
      setSelectedElementIds(new Set([newLine.id]));
    },
    [canvasElements, activeBoardId, activeSurface, addCanvasElement],
  );

  // Merge project's saved canvas layout with defaults
  const sectionPositions = useMemo(() => {
    if (!project) return DEFAULT_SECTION_POSITIONS;
    return {
      ...DEFAULT_SECTION_POSITIONS,
      ...(project.canvasLayout?.sectionPositions || {}),
      ...localPositions,
    };
  }, [project, localPositions]);

  // Initialize local positions from project on mount
  useEffect(() => {
    if (project?.canvasLayout?.sectionPositions) {
      setLocalPositions((prev) => ({
        ...DEFAULT_SECTION_POSITIONS,
        ...project.canvasLayout?.sectionPositions,
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

        // GLOBAL RULE: Clicking background deselects all elements and closes all menus
        setSelectedElementId(null);
        setSelectedElementIds(new Set());
        setSelectedEdgeId(null); // Also deselect connector/edge

        setIsPanning(true);
        setPanStart({
          x: e.clientX - canvasPosition.x,
          y: e.clientY - canvasPosition.y,
        });
        e.preventDefault();
      }
    },
    [canvasPosition, canvasZoom, setSelectedElementId],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Track cursor position for collaborators
      if (containerRef.current && updateCursor) {
        const rect = containerRef.current.getBoundingClientRect();
        const cursorX = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
        const cursorY = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
        updateCursor(cursorX, cursorY);
      }

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
        // Move the canvas element(s) using incremental delta
        const deltaX = (e.clientX - dragElementStart.x) / canvasZoom;
        const deltaY = (e.clientY - dragElementStart.y) / canvasZoom;

        // If multiple items are selected, move them all
        if (
          selectedElementIds.size > 1 &&
          selectedElementIds.has(draggingElement)
        ) {
          // Find the primary dragging element for snap calculations
          const primaryElement = canvasElements.find((e) => e.id === draggingElement);

          // Calculate new position for primary element
          let snappedDeltaX = deltaX;
          let snappedDeltaY = deltaY;

          if (primaryElement) {
            let newPrimaryX = primaryElement.x + deltaX;
            let newPrimaryY = primaryElement.y + deltaY;

            // Apply grid snap to the new position
            if (snapToGrid) {
              newPrimaryX = snapToGridValue(newPrimaryX, e.shiftKey);
              newPrimaryY = snapToGridValue(newPrimaryY, e.shiftKey);
            }

            // Calculate alignment guides for primary element
            const guides = calculateAlignmentGuides(primaryElement, newPrimaryX, newPrimaryY);
            setAlignmentGuides({ horizontal: guides.horizontal, vertical: guides.vertical });

            // Apply alignment snap
            if (guides.snapX !== undefined) newPrimaryX = guides.snapX;
            if (guides.snapY !== undefined) newPrimaryY = guides.snapY;

            // Calculate the effective delta
            snappedDeltaX = newPrimaryX - primaryElement.x;
            snappedDeltaY = newPrimaryY - primaryElement.y;
          }

          selectedElementIds.forEach((id) => {
            const el = canvasElements.find((e) => e.id === id);
            if (el) {
              if (el.type === "container") {
                syncMoveContainerWithChildren(id, snappedDeltaX, snappedDeltaY);
              } else {
                const newX = el.x + snappedDeltaX;
                const newY = el.y + snappedDeltaY;
                syncUpdateElement(id, { x: newX, y: newY });

                // Check if child element moved outside its container
                if (el.containerId) {
                  const container = canvasElements.find(
                    (c) => c.id === el.containerId,
                  );
                  if (container && container.type === 'container') {
                    // Check if moved outside container's origin (detach)
                    const isCompletelyOutside =
                      newX < container.x - 50 ||
                      newY < container.y - 50;

                    if (isCompletelyOutside) {
                      removeNodeFromContainer(id);
                    } else {
                      // Auto-expand container if element extends beyond bounds
                      const padding = 20;
                      const neededWidth = Math.max(
                        container.width,
                        newX + el.width - container.x + padding
                      );
                      const neededHeight = Math.max(
                        container.height,
                        newY + el.height - container.y + padding
                      );

                      if (neededWidth > container.width || neededHeight > container.height) {
                        // Use a timeout to batch the update after drag completes
                        setTimeout(() => {
                          const currentContainer = canvasElements.find(c => c.id === container.id);
                          if (currentContainer) {
                            updateCanvasElement(container.id, {
                              width: Math.max(currentContainer.width, neededWidth),
                              height: Math.max(currentContainer.height, neededHeight),
                            });
                          }
                        }, 0);
                      }
                    }
                  }
                }
              }
            }
          });

          // Check for drop target board and container
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

            // Check for container hover (only non-container elements can be dropped into containers)
            const containerTarget = canvasElements.find(
              (el) =>
                el.type === "container" &&
                !selectedElementIds.has(el.id) &&
                mouseCanvasX >= el.x &&
                mouseCanvasX <= el.x + el.width &&
                mouseCanvasY >= el.y &&
                mouseCanvasY <= el.y + el.height,
            );
            setDropTargetContainerId(containerTarget?.id || null);
          }
        } else {
          const element = canvasElements.find(
            (el) => el.id === draggingElement,
          );
          if (element) {
            // Calculate new position using incremental delta
            let newX = element.x + deltaX;
            let newY = element.y + deltaY;

            // Apply grid snap if enabled
            if (snapToGrid) {
              newX = snapToGridValue(newX, e.shiftKey); // Shift for minor grid
              newY = snapToGridValue(newY, e.shiftKey);
            }

            // Calculate and apply alignment guides
            const guides = calculateAlignmentGuides(element, newX, newY);
            setAlignmentGuides({ horizontal: guides.horizontal, vertical: guides.vertical });

            // Apply alignment snap (takes priority over grid snap)
            if (guides.snapX !== undefined) newX = guides.snapX;
            if (guides.snapY !== undefined) newY = guides.snapY;

            // If it's a container, move children too
            if (element.type === "container") {
              const containerDeltaX = newX - element.x;
              const containerDeltaY = newY - element.y;
              syncMoveContainerWithChildren(draggingElement, containerDeltaX, containerDeltaY);
            } else {
              syncUpdateElement(draggingElement, {
                x: newX,
                y: newY,
              });

              // Check if child element moved outside its container
              if (element.containerId) {
                const container = canvasElements.find(
                  (c) => c.id === element.containerId,
                );
                if (container && container.type === 'container') {
                  // Check if moved outside container's origin (detach)
                  const isCompletelyOutside =
                    newX < container.x - 50 ||
                    newY < container.y - 50;

                  if (isCompletelyOutside) {
                    removeNodeFromContainer(draggingElement);
                  } else {
                    // Auto-expand container if element extends beyond bounds
                    const padding = 20;
                    const neededWidth = Math.max(
                      container.width,
                      newX + element.width - container.x + padding
                    );
                    const neededHeight = Math.max(
                      container.height,
                      newY + element.height - container.y + padding
                    );

                    if (neededWidth > container.width || neededHeight > container.height) {
                      // Use a timeout to batch the update after drag completes
                      setTimeout(() => {
                        const currentContainer = canvasElements.find(c => c.id === container.id);
                        if (currentContainer) {
                          updateCanvasElement(container.id, {
                            width: Math.max(currentContainer.width, neededWidth),
                            height: Math.max(currentContainer.height, neededHeight),
                          });
                        }
                      }, 0);
                    }
                  }
                }
              }
            }
          }

          // Check for drop target board and container (for single element drag)
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

            // Check for container hover (only non-container elements)
            if (element && element.type !== "container") {
              const containerTarget = canvasElements.find(
                (el) =>
                  el.type === "container" &&
                  el.id !== draggingElement &&
                  mouseCanvasX >= el.x &&
                  mouseCanvasX <= el.x + el.width &&
                  mouseCanvasY >= el.y &&
                  mouseCanvasY <= el.y + el.height,
              );
              setDropTargetContainerId(containerTarget?.id || null);
            }
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

        syncUpdateEdge(draggingBendHandle, {
          bend: { x, y },
        });
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
      removeNodeFromContainer,
      canvasEdges,
      updateCanvasEdge,
      updateCursor,
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
      // Create connection if hovering any element (snap to nearest anchor)
      if (hoverTargetNodeId && connectingFrom) {
        const toEl = canvasElements.find((el) => el.id === hoverTargetNodeId);

        if (toEl && hoverTargetNodeId !== connectingFrom.elementId) {
          const fromEl = canvasElements.find(
            (el) => el.id === connectingFrom.elementId,
          );

          // Calculate nearest anchor on target element
          const fromPos = fromEl ? getAnchorPosition(fromEl, connectingFrom.anchor) : { x: 0, y: 0 };
          const targetAnchor = getNearestAnchor(toEl, fromPos);

          let bendPoint: { x: number; y: number } | undefined;
          if (fromEl && toEl) {
            const toPos = getAnchorPosition(toEl, targetAnchor);
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
            toAnchor: targetAnchor,
            fromAutoAnchor: true,
            toAutoAnchor: true,
            fromAnchorOffset: 0.5,
            toAnchorOffset: 0.5,
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
          syncAddEdge(newEdge);
        }
      }

      // Always clean up connector state
      setIsConnecting(false);
      setConnectingFrom(null);
      setConnectorPreview(null);
      setHoverTargetNodeId(null);
      setHoverTargetPort(null);
      setHoveredAnchor(null);
    }

    // DON'T clear dropTargetBoardId here - it gets cleared in handleElementDragEnd
    // setDropTargetBoardId(null);

    // IMPORTANT: Always clear draggingElement on canvas mouse up to prevent
    // the element from getting "stuck" to the cursor on quick click/release
    if (draggingElement) {
      // Broadcast the final position of dragged element(s) to collaborators
      if (selectedElementIds.size > 0) {
        // Multi-select: broadcast all selected elements
        selectedElementIds.forEach((id) => {
          const el = canvasElements.find((e) => e.id === id);
          if (el) {
            broadcastUpdate({ type: 'element_update', elementId: id, changes: { x: el.x, y: el.y } });
          }
        });
      } else {
        // Single element drag
        const el = canvasElements.find((e) => e.id === draggingElement);
        if (el) {
          broadcastUpdate({ type: 'element_update', elementId: draggingElement, changes: { x: el.x, y: el.y } });
        }
      }
      setDraggingElement(null);
      setDropTargetBoardId(null);
      setDropTargetContainerId(null);
      // Clear alignment guides when drag ends
      setAlignmentGuides({ horizontal: [], vertical: [] });
    }

    // Failsafe: force-clear experience block / inbox drag state on any canvas mouseup.
    // The document-level handlers in the useEffects should handle this, but if they
    // miss the event for any reason, this ensures the element never stays stuck.
    if (draggingExperienceBlock) {
      setDraggingExperienceBlock(null);
      setExperienceBlockDragPos(null);
    }
    if (draggingInboxItem) {
      setDraggingInboxItem(null);
      setInboxDragPos(null);
    }
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
    hoveredAnchor,
    connectingFrom,
    activeBoardId,
    activeSurface,
    addCanvasEdge,
    draggingElement,
    draggingExperienceBlock,
    draggingInboxItem,
    selectedElementIds,
    broadcastUpdate,
  ]);

  // Handle element creation from toolkit (board-scoped)
  const handlePlaceElement = useCallback(
    (
      type: CanvasElementType,
      position: { x: number; y: number },
      options?: {
        shapeType?: ShapeType;
        linkMode?: "bookmark" | "embed" | "file";
        cardType?: "note" | "task";
      },
    ) => {
      const size = DEFAULT_ELEMENT_SIZES[type];
      const maxZIndex = canvasElements.reduce(
        (max, el) => Math.max(max, Number.isFinite(el.zIndex) ? el.zIndex : 0),
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
          const isTaskCard = options?.cardType === "task";
          const isNoteCard = options?.cardType === "note";
          newElement = {
            ...baseElement,
            type: "freeform",
            content: isTaskCard ? "Task Title" : "",
            emoji: isTaskCard ? "✅" : isNoteCard ? "📌" : undefined,
            style: {
              bgColor:
                "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)",
              textColor: "#ffffff",
            },
            taskMetadata: isTaskCard ? {
              isActionable: true,
              subtasks: []
            } : undefined,
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
          // Containers should always be at the back, so use a lower z-index
          const minZIndex = canvasElements.reduce(
            (min, el) =>
              Math.min(min, Number.isFinite(el.zIndex) ? el.zIndex : 0),
            0,
          );
          newElement = {
            ...baseElement,
            type: "container",
            label: "",
            zIndex: minZIndex - 1, // Place behind all other elements
          };
          break;
        case "connector":
          // Connectors are created via drag, not click placement
          return;
        case "line":
          // Line tool - handled separately via drag interaction in toolkit
          return;
        case "text":
          newElement = {
            ...baseElement,
            type: "text",
            content: "",
            style: { fontSize: 20 },
          };
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

      syncAddElement(newElement);
      setSelectedElementId(newElement.id);
    },
    [
      canvasElements,
      addCanvasElement,
      syncAddElement,
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

      // Don't allow dragging locked elements
      if (element?.locked) {
        return;
      }

      // Alt-drag to duplicate
      if (e.altKey && element) {
        pushCanvasHistory(); // Save state before duplicate
        const newElement: CanvasElement = {
          ...element,
          id: uuidv4(),
          x: element.x + 20,
          y: element.y + 20,
        };
        syncAddElement(newElement);
        setSelectedElementId(newElement.id);
        setSelectedElementIds(new Set([newElement.id]));
        setDraggingElement(newElement.id);
        setDragElementStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Save state before starting drag (for undo)
      pushCanvasHistory();

      // Store original positions for all elements being dragged (for proper snap calculation)
      const originalPositions = new Map<string, { x: number; y: number }>();

      // Store offsets for all selected elements for group dragging (excluding locked ones)
      if (selectedElementIds.size > 1 && selectedElementIds.has(elementId)) {
        const offsets = new Map<string, { x: number; y: number }>();
        const baseEl = element;
        if (baseEl) {
          selectedElementIds.forEach((id) => {
            const el = canvasElements.find((e) => e.id === id);
            // Only include unlocked elements in group drag
            if (el && !el.locked) {
              offsets.set(id, { x: el.x - baseEl.x, y: el.y - baseEl.y });
              originalPositions.set(id, { x: el.x, y: el.y });
            }
          });
        }
        setDragOffsets(offsets);
      } else if (element) {
        // Single element drag - store its original position
        originalPositions.set(elementId, { x: element.x, y: element.y });
      }

      dragOriginalPositionsRef.current = originalPositions;
      setDraggingElement(elementId);
      setDragElementStart({ x: e.clientX, y: e.clientY });
      setSelectedElementId(elementId);
    },
    [canvasElements, selectedElementIds, addCanvasElement, syncAddElement, pushCanvasHistory],
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

    // Check if elements were dropped into a container (support multi-drop)
    if (dropTargetContainerId) {
      const targetContainer = canvasElements.find(
        (el) => el.id === dropTargetContainerId,
      );

      if (targetContainer && targetContainer.type === "container") {
        // Collect elements to drop (either selected elements or the dragging element)
        const elementsToDrop =
          selectedElementIds.size > 0
            ? Array.from(selectedElementIds).filter((id) => {
              const el = canvasElements.find((e) => e.id === id);
              return el && el.type !== "container" && el.type !== "board";
            })
            : draggingElement
              ? [draggingElement]
              : [];

        // Attach all dropped elements to the container and expand if needed
        elementsToDrop.forEach((id) => {
          const el = canvasElements.find((e) => e.id === id);
          if (el) {
            // Add to container (this will trigger auto-expansion in addNodeToContainer)
            addNodeToContainer(id, targetContainer.id);

            // Double check container expansion on drag end
            const padding = 20;
            const neededWidth = Math.max(
              targetContainer.width,
              el.x + el.width - targetContainer.x + padding
            );
            const neededHeight = Math.max(
              targetContainer.height,
              el.y + el.height - targetContainer.y + padding
            );

            if (neededWidth > targetContainer.width || neededHeight > targetContainer.height) {
              updateCanvasElement(targetContainer.id, {
                width: neededWidth,
                height: neededHeight,
              });
            }
          }
        });
      }
    }

    setDraggingElement(null);
    setDropTargetBoardId(null);
    setDropTargetContainerId(null);
  }, [
    draggingElement,
    canvasElements,
    addNodeToContainer,
    dropTargetBoardId,
    dropTargetContainerId,
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

  // Handle inbox item drag start
  const handleInboxItemDragStart = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      setDraggingInboxItem(elementId);
      setInboxDragPos({ x: e.clientX, y: e.clientY });
    },
    []
  );

  // Handle inbox item placement on canvas
  const handlePlaceInboxItem = useCallback(
    (elementId: string, x: number, y: number) => {
      pushCanvasHistory();
      updateCanvasElement(elementId, {
        x,
        y,
        inInbox: false, // Remove from inbox
      });
    },
    [pushCanvasHistory, updateCanvasElement]
  );

  // Handle removing item from inbox (delete)
  const handleRemoveFromInbox = useCallback(
    (elementId: string) => {
      pushCanvasHistory();
      removeCanvasElement(elementId);
    },
    [pushCanvasHistory, removeCanvasElement]
  );

  // Keep experience block drop context ref in sync every render.
  // The mouseup handler reads from this ref instead of closures, so it always
  // sees the latest canvasPosition/canvasZoom/etc. without the useEffect needing
  // to re-register listeners (which caused the drop-failure race condition).
  experienceDropCtxRef.current = {
    canvasPosition,
    canvasZoom,
    canvasElements,
    syncAddElement,
    activeBoardId,
    activeSurface,
    inboxItems,
    handlePlaceInboxItem,
  };

  // Handle experience block drag move and drop.
  // IMPORTANT: Only depends on `draggingExperienceBlock` to avoid tearing down
  // and re-registering listeners when volatile values (canvasElements, canvasPosition,
  // etc.) change mid-drag. The handler reads current values from experienceDropCtxRef.
  useEffect(() => {
    if (!draggingExperienceBlock) return;

    let dropped = false; // Guard against double-fire from mouseup + pointerup

    const handleMouseMove = (e: MouseEvent) => {
      setExperienceBlockDragPos({ x: e.clientX, y: e.clientY });
    };

    const handleDrop = (e: MouseEvent | PointerEvent) => {
      if (dropped) return;
      dropped = true;

      const {
        canvasPosition: pos,
        canvasZoom: zoom,
        canvasElements: elements,
        syncAddElement: addElement,
        activeBoardId: boardId,
        activeSurface: surface,
      } = experienceDropCtxRef.current;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - pos.x) / zoom;
        const canvasY = (e.clientY - rect.top - pos.y) / zoom;

        // Check if dropped on canvas (not outside)
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          // Create experience block element
          const maxZIndex = elements.reduce(
            (max, el) => Math.max(max, Number.isFinite(el.zIndex) ? el.zIndex : 0),
            0,
          );

          addElement({
            id: uuidv4(),
            type: "experienceBlock" as const,
            componentKey: draggingExperienceBlock.sectionId as any,
            title: draggingExperienceBlock.label,
            x: canvasX - 110, // Center the 220px wide element
            y: canvasY - 50, // Center the 100px tall element
            width: 220,
            height: 100,
            zIndex: maxZIndex + 1,
            boardId: boardId,
            surface: surface,
          } as any);
        }
      }

      // ALWAYS clear drag state — even if drop was outside canvas bounds
      setDraggingExperienceBlock(null);
      setExperienceBlockDragPos(null);
    };

    // Register on document in CAPTURE phase so we catch the event before any
    // child element can stopPropagation or swallow it.
    // Listen to both mouseup and pointerup for maximum reliability (pointer
    // capture from line-layer SVG can redirect pointerup but not mouseup).
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleDrop, true);
    document.addEventListener("pointerup", handleDrop as EventListener, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleDrop, true);
      document.removeEventListener("pointerup", handleDrop as EventListener, true);
    };
  }, [draggingExperienceBlock]);

  // Handle inbox item drag move and drop.
  // Same ref-based pattern as experience block drag to prevent drop failures.
  useEffect(() => {
    if (!draggingInboxItem) return;

    let dropped = false;

    const handleMouseMove = (e: MouseEvent) => {
      setInboxDragPos({ x: e.clientX, y: e.clientY });
    };

    const handleDrop = (e: MouseEvent | PointerEvent) => {
      if (dropped) return;
      dropped = true;

      const {
        canvasPosition: pos,
        canvasZoom: zoom,
        inboxItems: items,
        handlePlaceInboxItem: placeItem,
      } = experienceDropCtxRef.current;

      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const canvasX = (e.clientX - rect.left - pos.x) / zoom;
        const canvasY = (e.clientY - rect.top - pos.y) / zoom;

        // Check if dropped on canvas (not outside)
        if (
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom
        ) {
          const element = items?.find((el: any) => el.id === draggingInboxItem);
          if (element && placeItem) {
            placeItem(
              draggingInboxItem,
              canvasX - element.width / 2,
              canvasY - element.height / 2
            );
          }
        }
      }

      setDraggingInboxItem(null);
      setInboxDragPos(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleDrop, true);
    document.addEventListener("pointerup", handleDrop as EventListener, true);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleDrop, true);
      document.removeEventListener("pointerup", handleDrop as EventListener, true);
    };
  }, [draggingInboxItem]);

  // Handle connector creation start
  const handleStartConnector = useCallback(
    (elementId: string, anchor: "top" | "right" | "bottom" | "left") => {
      console.log("[CONNECTOR] Starting connector from:", elementId, anchor);
      setIsConnecting(true);
      setConnectingFrom({ elementId, anchor });
      setSelectedElementId(null);
      setHoverTargetNodeId(null);
      setHoverTargetPort(null);
      setHoveredAnchor(null);
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
          fromAutoAnchor: true,
          toAutoAnchor: true,
          fromAnchorOffset: 0.5,
          toAnchorOffset: 0.5,
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
        syncAddEdge(newEdge);
      }
      setIsConnecting(false);
      setConnectingFrom(null);
      setConnectorPreview(null);
      setHoverTargetNodeId(null);
      setHoverTargetPort(null);
      setHoveredAnchor(null);
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

  // Track mouse position for paste
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });

  // Track mouse position for paste
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setLastMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Global click handler to deselect text elements when clicking outside and close all menus
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Don't interfere with clicks on UI controls, menus, or interactive elements
      const isUIControl = target.closest('button, input, textarea, select, [role="menu"], [role="dialog"]');
      if (isUIControl) return;

      // Check if click is outside any element (on canvas background or navigation areas)
      const clickedElement = target.closest('[data-element-id]');
      const isCanvasArea = target.closest('.canvas-container, .dot-grid');

      if (!clickedElement && isCanvasArea) {
        // Clicked on canvas background - deselect all
        setSelectedElementId(null);
        setSelectedElementIds(new Set());
        setSelectedEdgeId(null);
      }
    };

    document.addEventListener('mousedown', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('mousedown', handleGlobalClick, { capture: true });
  }, []);

  // Check if user is in an editing context (actual text editing, not just interactive elements)
  const isEditingContext = useCallback(() => {
    const target = document.activeElement as HTMLElement;
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.contentEditable === "true" ||
      target.closest("[data-crop-mode]") !== null // Cropping mode
    );
  }, []);

  // Global keyboard shortcut system
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't run shortcuts while editing text or in special editing modes
      const target = e.target as HTMLElement;
      const isEditingText =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true" ||
        target.classList.contains("resize-none"); // TextElement textarea

      // ESCAPE - Always cancels current mode/closes menus/deselects elements
      // BUT don't interfere with text editing - let text component handle it
      if (e.key === "Escape") {
        if (!isEditingText) {
          e.preventDefault();
          setIsConnecting(false);
          setConnectingFrom(null);
          setConnectorPreview(null);
          setSelectedElementIds(new Set());
          setSelectedElementId(null);
          setHoveredAnchor(null);
          setSelectedEdgeId(null);
        }
        // If editing text, let the text element's own handler deal with it
        return;
      }

      // Allow only Escape while editing text
      if (isEditingText) {
        return; // Let normal text editing work
      }

      if (isEditingContext()) {
        return;
      }

      const isMod = e.ctrlKey || e.metaKey;

      // ARROW KEY NAVIGATION: Move selected elements
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (selectedElementIds.size > 0) {
          e.preventDefault();
          pushCanvasHistory(); // Save state before move

          const moveAmount = e.shiftKey ? 10 : 1; // Shift for 10px, otherwise 1px
          let deltaX = 0;
          let deltaY = 0;

          if (e.key === "ArrowLeft") deltaX = -moveAmount;
          if (e.key === "ArrowRight") deltaX = moveAmount;
          if (e.key === "ArrowUp") deltaY = -moveAmount;
          if (e.key === "ArrowDown") deltaY = moveAmount;

          // Move all selected elements
          selectedElementIds.forEach((id) => {
            const element = canvasElements.find((el) => el.id === id);
            if (element) {
              updateCanvasElement(id, {
                x: element.x + deltaX,
                y: element.y + deltaY,
              });
            }
          });

          // Move selected edge bend point if only one edge is selected
          if (selectedEdgeId && selectedElementIds.size === 0) {
            const edge = canvasEdges.find((e) => e.id === selectedEdgeId);
            if (edge && edge.bend) {
              syncUpdateEdge(selectedEdgeId, {
                bend: {
                  x: edge.bend.x + deltaX,
                  y: edge.bend.y + deltaY,
                },
              });
            }
          }

          return;
        }
      }

      // ONE-KEY TOOL ACTIVATION (only when no modifier keys are pressed)
      // T → Text tool
      if (!isMod && (e.key === "t" || e.key === "T")) {
        e.preventDefault();
        setActiveTool("text");
        return;
      }

      // C → Card tool (freeform) - only without modifier (Ctrl+C is copy)
      if (!isMod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        setActiveTool("freeform");
        return;
      }

      // B → Board tool
      if (!isMod && (e.key === "b" || e.key === "B")) {
        e.preventDefault();
        setActiveTool("board");
        return;
      }

      // L → Line tool
      if (!isMod && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        setActiveTool("line");
        return;
      }

      // I → Image tool
      if (!isMod && (e.key === "i" || e.key === "I")) {
        e.preventDefault();
        setActiveTool("image");
        return;
      }

      // O → Container tool
      if (!isMod && (e.key === "o" || e.key === "O")) {
        e.preventDefault();
        setActiveTool("container");
        return;
      }

      // E → Link tool
      if (!isMod && (e.key === "e" || e.key === "E")) {
        e.preventDefault();
        setActiveTool("link");
        return;
      }

      // F → Open Shape Context menu (activate shape tool)
      if (!isMod && (e.key === "f" || e.key === "F")) {
        e.preventDefault();
        setActiveTool("shape");
        return;
      }

      // UNDO: Ctrl/Cmd + Z
      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
          // Sync full state to collaborators after undo
          setTimeout(() => syncAfterUndoRedo(), 50);
        }
        return;
      }

      // REDO: Ctrl/Cmd + Shift + Z
      if (isMod && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        if (canRedo()) {
          redo();
          // Sync full state to collaborators after redo
          setTimeout(() => syncAfterUndoRedo(), 50);
        }
        return;
      }

      // REDO: Ctrl/Cmd + Y (alternative)
      if (isMod && e.key === "y") {
        e.preventDefault();
        if (canRedo()) {
          redo();
          // Sync full state to collaborators after redo
          setTimeout(() => syncAfterUndoRedo(), 50);
        }
        return;
      }

      // COPY: Ctrl/Cmd + C
      if (isMod && e.key === "c" && selectedElementIds.size > 0) {
        e.preventDefault();
        const elements = getCanvasElements();
        const selectedElements = elements.filter((el) =>
          selectedElementIds.has(el.id)
        );
        setClipboard(selectedElements);
        return;
      }

      // CUT: Ctrl/Cmd + X
      if (isMod && e.key === "x" && selectedElementIds.size > 0) {
        e.preventDefault();
        pushCanvasHistory(); // Save state before cut
        const elements = getCanvasElements();
        const selectedElements = elements.filter((el) =>
          selectedElementIds.has(el.id)
        );
        setClipboard(selectedElements);

        // Delete selected elements
        selectedElementIds.forEach((id) => {
          syncRemoveElement(id);
        });

        // Clear selection
        setSelectedElementIds(new Set());
        return;
      }

      // PASTE: Ctrl/Cmd + V
      if (isMod && e.key === "v" && clipboard.length > 0) {
        e.preventDefault();
        pushCanvasHistory(); // Save state before paste

        // Calculate paste position
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        // Convert mouse position to canvas coordinates
        const canvasX = (lastMousePos.x - containerRect.left - canvasPosition.x) / canvasZoom;
        const canvasY = (lastMousePos.y - containerRect.top - canvasPosition.y) / canvasZoom;

        // Find top-left of copied elements
        const minX = Math.min(...clipboard.map((el) => el.x));
        const minY = Math.min(...clipboard.map((el) => el.y));

        // Paste with offset from original or at mouse position
        const newIds = new Set<string>();
        clipboard.forEach((element) => {
          const offsetX = element.x - minX;
          const offsetY = element.y - minY;

          const newElement: CanvasElement = {
            ...element,
            id: uuidv4(),
            x: canvasX + offsetX,
            y: canvasY + offsetY,
            boardId: activeBoardId, // Use current board ID for cross-board paste
            containerId: undefined, // Clear container reference when pasting
            groupId: undefined, // Clear group reference when pasting
          };
          syncAddElement(newElement);
          newIds.add(newElement.id);
        });

        // Select pasted elements
        setSelectedElementIds(newIds);
        return;
      }

      // DUPLICATE: Ctrl/Cmd + D
      if (isMod && e.key === "d" && selectedElementIds.size > 0) {
        e.preventDefault();
        pushCanvasHistory(); // Save state before duplicate

        const newIds = new Set<string>();
        selectedElementIds.forEach((id) => {
          const elements = getCanvasElements();
          const element = elements.find((el) => el.id === id);
          if (element) {
            const newElement: CanvasElement = {
              ...element,
              id: uuidv4(),
              x: element.x + 20,
              y: element.y + 20,
            };
            syncAddElement(newElement);
            newIds.add(newElement.id);
          }
        });

        // Select duplicated elements
        setSelectedElementIds(newIds);
        return;
      }

      // DELETE: Delete or Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        // Prevent default browser behavior
        if (selectedElementIds.size > 0 || selectedEdgeId) {
          e.preventDefault();
          pushCanvasHistory(); // Save state before delete
        }

        if (selectedEdgeId) {
          syncRemoveEdge(selectedEdgeId);
          setSelectedEdgeId(null);
        }

        if (selectedElementIds.size > 0) {
          selectedElementIds.forEach((id) => {
            // Remove the element and broadcast
            syncRemoveElement(id);

            // Remove all connectors attached to this element
            const edges = getCanvasEdges();
            edges.forEach((edge) => {
              if (edge.fromNodeId === id || edge.toNodeId === id) {
                syncRemoveEdge(edge.id);
              }
            });
          });
          setSelectedElementIds(new Set());
          setSelectedElementId(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedEdgeId,
    selectedElementIds,
    removeCanvasEdge,
    removeCanvasElement,
    syncRemoveElement,
    syncRemoveEdge,
    syncAfterUndoRedo,
    undo,
    redo,
    canUndo,
    canRedo,
    pushCanvasHistory,
    isEditingContext,
    clipboard,
    getCanvasElements,
    addCanvasElement,
    canvasPosition,
    canvasZoom,
    lastMousePos,
    canvasElements,
    updateCanvasElement,
    canvasEdges,
    updateCanvasEdge,
    setActiveTool,
  ]);

  // Smooth zoom with scroll wheel - zoom towards cursor position
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // If target is within an element that should prevent canvas wheeling (like sidebar panels), skip zoom
      const target = e.target as HTMLElement;
      if (target.closest('[data-prevent-canvas-wheel="true"]')) {
        return;
      }

      e.preventDefault();

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Normalize deltaY based on deltaMode
      // deltaMode 0: pixels, 1: lines (~40px), 2: pages (~800px)
      let normalizedDelta = e.deltaY;
      if (e.deltaMode === 1) {
        normalizedDelta *= 40;
      } else if (e.deltaMode === 2) {
        normalizedDelta *= 800;
      }

      // For trackpad, use incremental zoom steps to prevent grid sliding
      const isTrackpad = e.ctrlKey || Math.abs(normalizedDelta) < 10;

      if (isTrackpad) {
        // Accumulate delta for trackpad
        zoomAccumulator.current += normalizedDelta;

        // Threshold for zoom step (adjust for sensitivity)
        const zoomThreshold = 10;

        if (Math.abs(zoomAccumulator.current) >= zoomThreshold) {
          const zoomDirection = zoomAccumulator.current > 0 ? -1 : 1;
          const zoomStep = 1.1; // 10% per step

          const newZoom = Math.min(
            MAX_ZOOM,
            Math.max(MIN_ZOOM, canvasZoom * (zoomDirection > 0 ? zoomStep : 1 / zoomStep)),
          );
          const zoomRatio = newZoom / canvasZoom;

          // Zoom towards cursor position
          const newPosX = Math.round((mouseX - (mouseX - canvasPosition.x) * zoomRatio) * 100) / 100;
          const newPosY = Math.round((mouseY - (mouseY - canvasPosition.y) * zoomRatio) * 100) / 100;

          setCanvasZoom(newZoom);
          setCanvasPosition({ x: newPosX, y: newPosY });

          // Reset accumulator
          zoomAccumulator.current = 0;
        }
      } else {
        // Mouse wheel - use continuous zoom
        const delta = -normalizedDelta * ZOOM_SENSITIVITY;

        const newZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, canvasZoom * (1 + delta)),
        );
        const zoomRatio = newZoom / canvasZoom;

        // Zoom towards cursor position
        const newPosX = Math.round((mouseX - (mouseX - canvasPosition.x) * zoomRatio) * 100) / 100;
        const newPosY = Math.round((mouseY - (mouseY - canvasPosition.y) * zoomRatio) * 100) / 100;

        setCanvasZoom(newZoom);
        setCanvasPosition({ x: newPosX, y: newPosY });
      }
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

  // Multi-selection box handlers
  const selectedElementsArray = useMemo(() => {
    return canvasElements.filter((el) => selectedElementIds.has(el.id));
  }, [canvasElements, selectedElementIds]);

  // Check if any selected element is part of a group
  const hasGroup = useMemo(() => {
    return selectedElementsArray.some((el) => el.groupId);
  }, [selectedElementsArray]);

  // Check if all selected elements belong to the same group
  const allSameGroup = useMemo(() => {
    if (selectedElementsArray.length < 2) return false;
    const firstGroupId = selectedElementsArray[0]?.groupId;
    if (!firstGroupId) return false;
    return selectedElementsArray.every((el) => el.groupId === firstGroupId);
  }, [selectedElementsArray]);

  const handleMultiSelectUpdateElements = useCallback(
    (updates: Map<string, Partial<CanvasElement>>) => {
      pushCanvasHistory();
      updates.forEach((update, id) => {
        syncUpdateElement(id, update);
      });
    },
    [pushCanvasHistory, syncUpdateElement]
  );

  const handleMultiSelectDeleteElements = useCallback(() => {
    pushCanvasHistory();
    selectedElementIds.forEach((id) => {
      syncRemoveElement(id);
      // Remove all connectors attached to this element
      const edges = getCanvasEdges();
      edges.forEach((edge) => {
        if (edge.fromNodeId === id || edge.toNodeId === id) {
          syncRemoveEdge(edge.id);
        }
      });
    });
    setSelectedElementIds(new Set());
    setSelectedElementId(null);
  }, [pushCanvasHistory, selectedElementIds, syncRemoveElement, syncRemoveEdge, getCanvasEdges]);

  const handleMultiSelectDuplicateElements = useCallback(() => {
    pushCanvasHistory();
    const newIds = new Set<string>();
    selectedElementIds.forEach((id) => {
      const element = canvasElements.find((el) => el.id === id);
      if (element) {
        const newElement: CanvasElement = {
          ...element,
          id: uuidv4(),
          x: element.x + 20,
          y: element.y + 20,
          groupId: undefined, // Don't copy group assignment
        };
        syncAddElement(newElement);
        newIds.add(newElement.id);
      }
    });
    setSelectedElementIds(newIds);
  }, [pushCanvasHistory, selectedElementIds, canvasElements, syncAddElement]);

  const handleMultiSelectCreateGroup = useCallback(() => {
    pushCanvasHistory();
    const groupId = createGroup(Array.from(selectedElementIds));
    if (groupId) {
      // Keep the same selection
    }
  }, [pushCanvasHistory, createGroup, selectedElementIds]);

  const handleMultiSelectUngroup = useCallback(() => {
    pushCanvasHistory();
    // Find the group ID from the first selected element
    const firstElement = selectedElementsArray[0];
    if (firstElement?.groupId) {
      ungroup(firstElement.groupId);
    }
  }, [pushCanvasHistory, selectedElementsArray, ungroup]);

  const handleMultiSelectBringForward = useCallback(() => {
    pushCanvasHistory();
    const maxZIndex = canvasElements.reduce(
      (max, el) => Math.max(max, el.zIndex || 0),
      0
    );
    selectedElementIds.forEach((id) => {
      syncUpdateElement(id, { zIndex: maxZIndex + 1 });
    });
  }, [pushCanvasHistory, canvasElements, selectedElementIds, syncUpdateElement]);

  const handleMultiSelectSendBackward = useCallback(() => {
    pushCanvasHistory();
    const minZIndex = canvasElements.reduce(
      (min, el) => Math.min(min, el.zIndex || 0),
      Infinity
    );
    selectedElementIds.forEach((id) => {
      syncUpdateElement(id, { zIndex: Math.max(0, minZIndex - 1) });
    });
  }, [pushCanvasHistory, canvasElements, selectedElementIds, syncUpdateElement]);

  const handleMultiSelectLockElements = useCallback(() => {
    pushCanvasHistory();
    selectedElementIds.forEach((id) => {
      syncUpdateElement(id, { locked: true });
    });
  }, [pushCanvasHistory, selectedElementIds, syncUpdateElement]);

  const handleMultiSelectUnlockElements = useCallback(() => {
    pushCanvasHistory();
    selectedElementIds.forEach((id) => {
      syncUpdateElement(id, { locked: false });
    });
  }, [pushCanvasHistory, selectedElementIds, syncUpdateElement]);

  // Create connected shape in specified direction (for flow diagrams)
  const handleCreateConnectedShape = useCallback(
    (sourceElement: CanvasElement, direction: "top" | "right" | "bottom" | "left") => {
      if (sourceElement.type !== "shape") return;

      const shapeElement = sourceElement as ShapeElement;
      const spacing = 80; // Gap between shapes
      const connectorOffset = 40; // How far connector extends

      // Calculate new shape position based on direction
      let newX = sourceElement.x;
      let newY = sourceElement.y;

      switch (direction) {
        case "top":
          newY = sourceElement.y - sourceElement.height - spacing;
          break;
        case "bottom":
          newY = sourceElement.y + sourceElement.height + spacing;
          break;
        case "left":
          newX = sourceElement.x - sourceElement.width - spacing;
          break;
        case "right":
          newX = sourceElement.x + sourceElement.width + spacing;
          break;
      }

      pushCanvasHistory();

      // Create new shape with same type as source
      const maxZIndex = canvasElements.reduce(
        (max, el) => Math.max(max, el.zIndex || 0),
        0
      );

      const newShape: ShapeElement = {
        id: uuidv4(),
        type: "shape",
        shapeType: shapeElement.shapeType,
        x: newX,
        y: newY,
        width: sourceElement.width,
        height: sourceElement.height,
        zIndex: maxZIndex + 1,
        boardId: activeBoardId,
        surface: activeSurface,
        content: "",
        style: { ...shapeElement.style },
      };

      syncAddElement(newShape);

      // Calculate connector anchors based on direction
      let fromAnchor: "top" | "right" | "bottom" | "left";
      let toAnchor: "top" | "right" | "bottom" | "left";

      switch (direction) {
        case "top":
          fromAnchor = "top";
          toAnchor = "bottom";
          break;
        case "bottom":
          fromAnchor = "bottom";
          toAnchor = "top";
          break;
        case "left":
          fromAnchor = "left";
          toAnchor = "right";
          break;
        case "right":
          fromAnchor = "right";
          toAnchor = "left";
          break;
      }

      // Create connector between shapes
      const newEdge: CanvasEdge = {
        id: uuidv4(),
        fromNodeId: sourceElement.id,
        fromAnchor,
        toNodeId: newShape.id,
        toAnchor,
        fromAutoAnchor: true,
        toAutoAnchor: true,
        fromAnchorOffset: 0.5,
        toAnchorOffset: 0.5,
        boardId: activeBoardId,
        surface: activeSurface,
        style: {
          color: "hsl(var(--primary))",
          thickness: 2,
        },
      };

      syncAddEdge(newEdge);

      // Select the new shape
      setSelectedElementId(newShape.id);
      setSelectedElementIds(new Set([newShape.id]));
    },
    [canvasElements, activeBoardId, activeSurface, pushCanvasHistory, syncAddElement, syncAddEdge]
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
      className={`fixed inset-0 top-16 overflow-hidden select-none transition-[right] duration-300 ${isPanning
        ? "cursor-grabbing"
        : draggingElement
          ? "cursor-move"
          : "cursor-grab w-full h-full"
        }`}
      style={{ right: canvasRightMargin, background: canvasBackground }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={() => {
        handleCanvasMouseUp();
        clearCursor?.();
      }}
      onContextMenu={(e) => e.preventDefault()}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Canvas Background with dot grid */}
      <div
        className="canvas-background absolute inset-0 top-full left-1/2 -translate-x-1/2 p-2 rounded-lg backdrop-blur border border-border shadow-xl z-50 grid grid-cols-3 gap-1 py-[8px] mt-[14.75px] bg-[#0f0939] opacity-[1] w-[937px] h-[363px]"
        style={{
          background:
            "radial-gradient(circle at center, hsl(270 45% 8%) 0%, hsl(270 50% 3%) 100%)",
        }}
      />
      {/* Dot grid - rendered inside canvas transform for perfect alignment */}
      <div
        className="dot-grid pointer-events-none absolute"
        style={{
          // Position grid to cover visible area and beyond
          left: -10000,
          top: -10000,
          width: 20000,
          height: 20000,
          // Apply same transform as canvas content for perfect alignment
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
          transformOrigin: "0 0",
          // Layered grid: Major dots (90px) + Medium dots (30px) + Minor dots (15px)
          backgroundImage: `
            radial-gradient(circle, hsl(270 30% 29% / 0.6) 1.5px, transparent 1.5px),
            radial-gradient(circle, hsl(270 30% 28% / 0.4) 1px, transparent 1px),
            radial-gradient(circle, hsl(270 30% 22% / 0.25) 0.5px, transparent 0.5px)
          `,
          backgroundSize: `90px 90px, 30px 30px, 15px 15px`,
          backgroundPosition: "0 0, 0 0, 0 0",
        }}
      />

      {/* Collaborator Cursors Overlay - highest z-index */}
      {collaborators.length > 0 && (
        <CollaboratorCursors
          collaborators={collaborators}
          canvasOffset={{ x: canvasPosition.x, y: canvasPosition.y }}
          zoom={canvasZoom}
        />
      )}

      {/* Canvas Content - z-index 10 to render above connector lines (z-index 5) */}
      <div
        className="absolute will-change-transform"
        style={{
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
          transformOrigin: "0 0",
          zIndex: 10,
        }}
      >
        {/* Canvas Elements (freeform, images, shapes, etc.) - excluding lines which are rendered in overlay */}
        {canvasElements
          .filter((el) => el.type !== "line")
          .map((element) => (
            <CanvasElementRenderer
              key={element.id}
              element={element}
              onUpdate={(updates) => syncUpdateElement(element.id, updates)}
              onDelete={() => syncRemoveElement(element.id)}
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
              isMultiSelected={selectedElementIds.size > 1}
              isDropTarget={
                dropTargetBoardId === element.id ||
                dropTargetContainerId === element.id
              }
              isHighlighted={highlightedElementId === element.id}
              isHoverTarget={hoverTargetNodeId === element.id}
              onSelect={(e) => {
                if (e?.shiftKey || e?.ctrlKey || e?.metaKey) {
                  // Multi-select with Shift/Ctrl/Cmd
                  const newSelected = new Set(selectedElementIds);
                  if (newSelected.has(element.id)) {
                    newSelected.delete(element.id);
                    // If element is in a group, also remove other group members
                    if (element.groupId) {
                      canvasElements.forEach((el) => {
                        if (el.groupId === element.groupId) {
                          newSelected.delete(el.id);
                        }
                      });
                    }
                  } else {
                    newSelected.add(element.id);
                    // If element is in a group, also add other group members
                    if (element.groupId) {
                      canvasElements.forEach((el) => {
                        if (el.groupId === element.groupId) {
                          newSelected.add(el.id);
                        }
                      });
                    }
                  }
                  setSelectedElementIds(newSelected);
                  setSelectedElementId(element.id);
                } else {
                  // Single select - also select all group members
                  if (element.groupId) {
                    const groupElements = canvasElements.filter(
                      (el) => el.groupId === element.groupId
                    );
                    const groupIds = new Set(groupElements.map((el) => el.id));
                    setSelectedElementIds(groupIds);
                    setSelectedElementId(element.id);
                  } else {
                    setSelectedElementId(element.id);
                    setSelectedElementIds(new Set([element.id]));
                  }
                }
                setSelectedEdgeId(null);
              }}
              canvasZoom={canvasZoom}
              onEnterBoard={handleEnterBoard}
              onStartConnector={handleStartConnector}
              onEndConnector={handleEndConnector}
              isConnecting={isConnecting}
              showConnectorAnchors={canShowConnectorAnchors}
              hoveredAnchor={hoveredAnchor}
              onAnchorHover={setHoveredAnchor}
              onOpenExperiencePanel={(sectionId: any) => {
                if ((window as any).__openExperienceSection) {
                  (window as any).__openExperienceSection(sectionId);
                }
              }}
              onSendToInbox={() => {
                pushCanvasHistory();
                syncUpdateElement(element.id, { inInbox: true });
              }}
              onCreateConnectedShape={(direction) => {
                handleCreateConnectedShape(element, direction);
              }}
            />
          ))}

        {/* Multi-Selection Box with bounding box and toolbar */}
        {selectedElementIds.size > 1 && (
          <MultiSelectionBox
            selectedElements={selectedElementsArray}
            canvasZoom={canvasZoom}
            onUpdateElements={handleMultiSelectUpdateElements}
            onDeleteElements={handleMultiSelectDeleteElements}
            onDuplicateElements={handleMultiSelectDuplicateElements}
            onCreateGroup={handleMultiSelectCreateGroup}
            onUngroup={handleMultiSelectUngroup}
            onBringForward={handleMultiSelectBringForward}
            onSendBackward={handleMultiSelectSendBackward}
            onLockElements={handleMultiSelectLockElements}
            onUnlockElements={handleMultiSelectUnlockElements}
            hasGroup={hasGroup}
            allSameGroup={allSameGroup}
            snapToGrid={snapToGrid}
            onDragStart={(e) => {
              // Use the first selected element as the drag base
              const firstSelected = selectedElementsArray[0];
              if (firstSelected) {
                handleElementDragStart(firstSelected.id, e);
              }
            }}
          />
        )}

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

        {/* Alignment Guides */}
        {showAlignmentGuides && (alignmentGuides.horizontal.length > 0 || alignmentGuides.vertical.length > 0) && (
          <svg
            className="absolute pointer-events-none"
            style={{
              left: -5000,
              top: -5000,
              width: 10000,
              height: 10000,
              overflow: "visible",
            }}
          >
            {/* Horizontal alignment guides (Y-axis lines that run left-to-right) */}
            {alignmentGuides.horizontal.map((y, i) => (
              <line
                key={`h-${i}-${y}`}
                x1={0}
                y1={y + 5000}
                x2={10000}
                y2={y + 5000}
                stroke="hsl(280 100% 70%)"
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.8}
              />
            ))}
            {/* Vertical alignment guides (X-axis lines that run top-to-bottom) */}
            {alignmentGuides.vertical.map((x, i) => (
              <line
                key={`v-${i}-${x}`}
                x1={x + 5000}
                y1={0}
                x2={x + 5000}
                y2={10000}
                stroke="hsl(280 100% 70%)"
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.8}
              />
            ))}
          </svg>
        )}
      </div>
      {/* Line Layer - SVG overlay for all lines with proper state machine */}
      <LineLayer
        lines={
          canvasElements.filter((el) => el.type === "line") as LineElement[]
        }
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
        onUpdateLine={(id, updates) => syncUpdateElement(id, updates)}
        onCreateLine={handleCreateLine}
        onDeleteLine={(id) => syncRemoveElement(id)}
        canvasPosition={canvasPosition}
        canvasZoom={canvasZoom}
        isLineToolActive={activeTool === "line"}
        onLineToolComplete={() => setActiveTool(null)}
        containerRef={containerRef}
        onOperationStart={pushCanvasHistory}
      />
      {/* Connectors SVG Layer - rendered BELOW elements */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
          transformOrigin: "0 0",
          zIndex: 5,
        }}
      >
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

          {/* Existing edges */}
          {canvasEdges.map((edge) => {
            const fromElement = canvasElements.find(
              (el) => el.id === edge.fromNodeId,
            );
            const toElement = canvasElements.find(
              (el) => el.id === edge.toNodeId,
            );
            if (!fromElement || !toElement) return null;

            const { from, to } = getResolvedEdgePoints(edge, fromElement, toElement);

            if (!from || !to) return null;

            const isSelected = selectedEdgeId === edge.id;
            const strokeColor = edge.style?.color || "hsl(180 100% 50% / 0.8)";

            // Use bend point or default to midpoint
            const bend = edge.bend || {
              x: (from.x + to.x) / 2,
              y: (from.y + to.y) / 2,
            };

            // Create path for curve using quadratic Bezier
            const pathD = `M ${from.x} ${from.y} Q ${bend.x} ${bend.y} ${to.x} ${to.y}`;

            // Per-edge marker ids so endpoint color always follows the line color in realtime.
            const markerIds = {
              arrowEnd: `${edge.id}-arrow-end`,
              arrowStart: `${edge.id}-arrow-start`,
              dotEnd: `${edge.id}-dot-end`,
              dotStart: `${edge.id}-dot-start`,
              diamondEnd: `${edge.id}-diamond-end`,
              diamondStart: `${edge.id}-diamond-start`,
              squareEnd: `${edge.id}-square-end`,
              squareStart: `${edge.id}-square-start`,
            };

            // Determine endpoint markers
            const getMarkerEnd = (): string | undefined => {
              const endCap = edge.style?.endCap || (edge.style?.arrowHead ? 'arrow' : 'none');
              switch (endCap) {
                case 'arrow': return `url(#${markerIds.arrowEnd})`;
                case 'dot': return `url(#${markerIds.dotEnd})`;
                case 'diamond': return `url(#${markerIds.diamondEnd})`;
                case 'square': return `url(#${markerIds.squareEnd})`;
                default: return undefined;
              }
            };

            const getMarkerStart = (): string | undefined => {
              const startCap = edge.style?.startCap || 'none';
              switch (startCap) {
                case 'arrow': return `url(#${markerIds.arrowStart})`;
                case 'dot': return `url(#${markerIds.dotStart})`;
                case 'diamond': return `url(#${markerIds.diamondStart})`;
                case 'square': return `url(#${markerIds.squareStart})`;
                default: return undefined;
              }
            };

            // Calculate label position along the path (default to 0.5 = center)
            const labelPosition = edge.label?.position ?? 0.5;
            // Quadratic bezier point at t
            const getLabelPoint = (t: number) => {
              const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * bend.x + t * t * to.x;
              const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * bend.y + t * t * to.y;
              return { x, y };
            };
            const labelPoint = getLabelPoint(labelPosition);

            return (
              <g key={edge.id}>
                <defs>
                  <marker id={markerIds.arrowEnd} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.arrowStart} markerWidth="10" markerHeight="7" refX="1" refY="3.5" orient="auto-start-reverse">
                    <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.dotEnd} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <circle cx="4" cy="4" r="3" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.dotStart} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <circle cx="4" cy="4" r="3" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.diamondEnd} markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                    <polygon points="5 0, 10 5, 5 10, 0 5" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.diamondStart} markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                    <polygon points="5 0, 10 5, 5 10, 0 5" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.squareEnd} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <rect x="1" y="1" width="6" height="6" fill={strokeColor} />
                  </marker>
                  <marker id={markerIds.squareStart} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                    <rect x="1" y="1" width="6" height="6" fill={strokeColor} />
                  </marker>
                </defs>
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
                  stroke={strokeColor}
                  strokeWidth={isSelected ? (edge.style?.thickness || 2) + 1 : edge.style?.thickness || 2}
                  fill="none"
                  strokeDasharray={
                    edge.style?.lineStyle === "dashed"
                      ? "8,4"
                      : edge.style?.lineStyle === "dotted"
                        ? "2,4"
                        : undefined
                  }
                  markerStart={getMarkerStart()}
                  markerEnd={getMarkerEnd()}
                  style={isSelected ? { filter: "drop-shadow(0 0 4px rgba(167,139,250,0.45))" } : undefined}
                />
                {/* Text label */}
                {edge.label?.text && (
                  <g>
                    {/* Label background */}
                    <rect
                      x={labelPoint.x - 30}
                      y={labelPoint.y - 10}
                      width={60}
                      height={20}
                      rx={4}
                      fill="hsl(var(--card))"
                      fillOpacity={0.9}
                      className="pointer-events-none"
                    />
                    {/* Label text */}
                    <text
                      x={labelPoint.x}
                      y={labelPoint.y + 4}
                      textAnchor="middle"
                      fill={edge.label.color || "hsl(var(--foreground))"}
                      fontSize={edge.label.fontSize || 12}
                      fontFamily={edge.label.fontFamily || "inherit"}
                      className="pointer-events-none select-none"
                    >
                      {edge.label.text}
                    </text>
                  </g>
                )}
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

        </svg>
      </div>

      {/* Bend handles and anchor handles for selected connector */}
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

          const { from, to } = getResolvedEdgePoints(edge, fromElement, toElement);
          if (!from || !to) return null;

          const bend = edge.bend || {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
          };

          // Convert world coords to screen coords
          const bendScreenX = bend.x * canvasZoom + canvasPosition.x;
          const bendScreenY = bend.y * canvasZoom + canvasPosition.y;
          const fromScreenX = from.x * canvasZoom + canvasPosition.x;
          const fromScreenY = from.y * canvasZoom + canvasPosition.y;
          const toScreenX = to.x * canvasZoom + canvasPosition.x;
          const toScreenY = to.y * canvasZoom + canvasPosition.y;
          const fromCenter = {
            x: fromElement.x + fromElement.width / 2,
            y: fromElement.y + fromElement.height / 2,
          };
          const toCenter = {
            x: toElement.x + toElement.width / 2,
            y: toElement.y + toElement.height / 2,
          };
          const fromCenterScreenX = fromCenter.x * canvasZoom + canvasPosition.x;
          const fromCenterScreenY = fromCenter.y * canvasZoom + canvasPosition.y;
          const toCenterScreenX = toCenter.x * canvasZoom + canvasPosition.x;
          const toCenterScreenY = toCenter.y * canvasZoom + canvasPosition.y;

          const updatePivotAnchor = (
            which: "from" | "to",
            targetElement: CanvasElement,
            worldX: number,
            worldY: number,
          ) => {
            const centerX = targetElement.x + targetElement.width / 2;
            const centerY = targetElement.y + targetElement.height / 2;
            const deltaX = worldX - centerX;
            const deltaY = worldY - centerY;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            const autoThreshold = 18;

            if (distance <= autoThreshold) {
              syncUpdateEdge(selectedEdgeId, which === "from"
                ? { fromAutoAnchor: true, fromAnchorOffset: 0.5 }
                : { toAutoAnchor: true, toAnchorOffset: 0.5 });
              return;
            }

            const anchor =
              Math.abs(deltaX) >= Math.abs(deltaY)
                ? (deltaX >= 0 ? "right" : "left")
                : (deltaY >= 0 ? "bottom" : "top");

            const offset =
              anchor === "top" || anchor === "bottom"
                ? Math.max(0.1, Math.min(0.9, (worldX - targetElement.x) / targetElement.width))
                : Math.max(0.1, Math.min(0.9, (worldY - targetElement.y) / targetElement.height));

            syncUpdateEdge(selectedEdgeId, which === "from"
              ? {
                  fromAutoAnchor: false,
                  fromAnchor: anchor,
                  fromAnchorOffset: offset,
                }
              : {
                  toAutoAnchor: false,
                  toAnchor: anchor,
                  toAnchorOffset: offset,
                });
          };

          return (
            <>
              {/* Bend handle (purple) */}
              <div
                className="absolute w-4 h-4 bg-purple-500 border-2 border-white rounded-full cursor-move hover:scale-125 transition-transform"
                style={{
                  left: bendScreenX - 8,
                  top: bendScreenY - 8,
                  zIndex: 1000,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setDraggingBendHandle(selectedEdgeId);
                }}
                title="Drag to adjust curve"
              />
              {/* Center pivot guide lines */}
              <svg
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 999 }}
              >
                <line
                  x1={fromCenterScreenX}
                  y1={fromCenterScreenY}
                  x2={fromScreenX}
                  y2={fromScreenY}
                  stroke="hsl(188 95% 68% / 0.8)"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />
                <line
                  x1={toCenterScreenX}
                  y1={toCenterScreenY}
                  x2={toScreenX}
                  y2={toScreenY}
                  stroke="hsl(188 95% 68% / 0.8)"
                  strokeWidth={1.5}
                  strokeDasharray="3,3"
                />
              </svg>
              {/* From pivot handle */}
              <div
                className="absolute w-3.5 h-3.5 bg-cyan-400 border-2 border-white rounded-full cursor-move hover:scale-125 transition-transform"
                style={{
                  left: fromCenterScreenX - 7,
                  top: fromCenterScreenY - 7,
                  zIndex: 1000,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const worldX = (moveEvent.clientX - rect.left - canvasPosition.x) / canvasZoom;
                    const worldY = (moveEvent.clientY - rect.top - canvasPosition.y) / canvasZoom;
                    updatePivotAnchor("from", fromElement, worldX, worldY);
                  };
                  const handleMouseUp = () => {
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);
                  };
                  document.addEventListener("mousemove", handleMouseMove);
                  document.addEventListener("mouseup", handleMouseUp);
                }}
                title="Drag pivot to pick connector side"
              />
              {/* To pivot handle */}
              <div
                className="absolute w-3.5 h-3.5 bg-cyan-400 border-2 border-white rounded-full cursor-move hover:scale-125 transition-transform"
                style={{
                  left: toCenterScreenX - 7,
                  top: toCenterScreenY - 7,
                  zIndex: 1000,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const worldX = (moveEvent.clientX - rect.left - canvasPosition.x) / canvasZoom;
                    const worldY = (moveEvent.clientY - rect.top - canvasPosition.y) / canvasZoom;
                    updatePivotAnchor("to", toElement, worldX, worldY);
                  };
                  const handleMouseUp = () => {
                    document.removeEventListener("mousemove", handleMouseMove);
                    document.removeEventListener("mouseup", handleMouseUp);
                  };
                  document.addEventListener("mousemove", handleMouseMove);
                  document.addEventListener("mouseup", handleMouseUp);
                }}
                title="Drag pivot to pick connector side"
              />
            </>
          );
        })()}

      {/* Connector context menu - outside pointer-events-none wrapper */}
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

          const { from, to } = getResolvedEdgePoints(edge, fromElement, toElement);
          if (!from || !to) return null;

          const bend = edge.bend || {
            x: (from.x + to.x) / 2,
            y: (from.y + to.y) / 2,
          };

          // Calculate midpoint on the quadratic curve
          const t = 0.5;
          const midWorld = {
            x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * bend.x + t * t * to.x,
            y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * bend.y + t * t * to.y,
          };

          // Convert to screen coords
          const midScreenX = midWorld.x * canvasZoom + canvasPosition.x;
          const midScreenY = midWorld.y * canvasZoom + canvasPosition.y;

          // Determine menu placement based on line orientation
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const isHorizontal = Math.abs(dx) > Math.abs(dy);
          return (
            <ConnectorContextMenu
              edge={edge}
              menuPosition={
                isHorizontal
                  ? { top: midScreenY + 16, left: midScreenX - 100 }
                  : { top: midScreenY - 20, left: midScreenX + 16 }
              }
              onUpdateEdge={(updates) => syncUpdateEdge(selectedEdgeId, updates)}
              onDelete={() => {
                syncRemoveEdge(selectedEdgeId);
                setSelectedEdgeId(null);
              }}
            />
          );
        })()}

      {/* Canvas Toolkit */}
      <CanvasToolkit
        onPlaceElement={handlePlaceElement}
        canvasRef={containerRef}
        canvasPosition={canvasPosition}
        canvasZoom={canvasZoom}
        activeTool={activeTool}
        onActiveToolChange={setActiveTool}
      />
      {/* Zoom Controls */}
      <NavigationToolkit
        canvasZoom={canvasZoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetView={handleResetView}
        onFitAll={handleFitAll}
        onUndo={() => {
          if (canUndo()) {
            undo();
            setTimeout(() => syncAfterUndoRedo(), 50);
          }
        }}
        onRedo={() => {
          if (canRedo()) {
            redo();
            setTimeout(() => syncAfterUndoRedo(), 50);
          }
        }}
        canUndo={canUndo()}
        canRedo={canRedo()}
        showAlignmentGuides={showAlignmentGuides}
        onToggleAlignmentGuides={() => setShowAlignmentGuides(!showAlignmentGuides)}
      />
      {/* Task Inbox - for tasks created in Plan Tab */}
      <TaskInbox
        inboxItems={inboxItems}
        onPlaceOnCanvas={handlePlaceInboxItem}
        onRemoveFromInbox={handleRemoveFromInbox}
        onStartDrag={handleInboxItemDragStart}
        onGoToPlanTab={() => setCanvasViewMode('plan')}
        canvasZoom={canvasZoom}
      />
      {/* Drag preview for inbox items */}
      {draggingInboxItem && inboxDragPos && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            left: inboxDragPos.x,
            top: inboxDragPos.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="bg-card/90 backdrop-blur border border-primary/50 rounded-lg px-4 py-2 shadow-lg">
            <span className="text-sm">Drop to place task</span>
          </div>
        </div>
      )}
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

function ConnectorContextMenu({
  edge,
  menuPosition,
  onUpdateEdge,
  onDelete,
}: {
  edge: CanvasEdge;
  menuPosition: { top: number; left: number };
  onUpdateEdge: (updates: Partial<CanvasEdge>) => void;
  onDelete: () => void;
}) {
  const widthPx = edge.style?.thickness || 2;
  const color = edge.style?.color || "hsl(180 100% 50%)";
  const kind = edge.style?.lineStyle || "solid";
  const startCap = edge.style?.startCap || "none";
  const endCap = edge.style?.endCap || (edge.style?.arrowHead ? "arrow" : "none");

  const getHexColor = () => {
    if (color.match(/#[0-9a-fA-F]{6}/)) return color;
    return "#00ffff";
  };

  return (
    <div
      className="flex flex-col gap-1 px-2 py-1.5 rounded-lg bg-card/95 backdrop-blur border border-border/50 shadow-lg pointer-events-auto"
      style={{ position: "absolute", zIndex: 1001, pointerEvents: "auto", ...menuPosition }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        <button
          onClick={() => onUpdateEdge({ style: { ...edge.style, lineStyle: "solid" } })}
          className={cn(
            "p-1.5 rounded hover:bg-primary/20 transition-colors",
            kind === "solid" && "bg-primary/30 ring-1 ring-primary",
          )}
          title="Solid"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={() => onUpdateEdge({ style: { ...edge.style, lineStyle: "dashed" } })}
          className={cn(
            "p-1.5 rounded hover:bg-primary/20 transition-colors",
            kind === "dashed" && "bg-primary/30 ring-1 ring-primary",
          )}
          title="Dashed"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="4" y1="12" x2="8" y2="12" />
            <line x1="12" y1="12" x2="16" y2="12" />
            <line x1="20" y1="12" x2="24" y2="12" />
          </svg>
        </button>
        <button
          onClick={() => onUpdateEdge({ style: { ...edge.style, lineStyle: "dotted" } })}
          className={cn(
            "p-1.5 rounded hover:bg-primary/20 transition-colors",
            kind === "dotted" && "bg-primary/30 ring-1 ring-primary",
          )}
          title="Dotted"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="4" cy="12" r="1" fill="currentColor" />
            <circle cx="10" cy="12" r="1" fill="currentColor" />
            <circle cx="16" cy="12" r="1" fill="currentColor" />
            <circle cx="22" cy="12" r="1" fill="currentColor" />
          </svg>
        </button>
        <div className="w-px h-4 bg-border/50 mx-0.5" />
        <input
          type="range"
          min="1"
          max="12"
          value={widthPx}
          onChange={(e) =>
            onUpdateEdge({
              style: { ...edge.style, thickness: parseInt(e.target.value), lineStyle: edge.style?.lineStyle },
            })
          }
          className="w-16 h-1 rounded-full appearance-none bg-muted cursor-pointer"
          title={`Width: ${widthPx}px`}
        />
        <div className="w-px h-4 bg-border/50 mx-0.5" />
        <input
          type="color"
          value={getHexColor()}
          onChange={(e) =>
            onUpdateEdge({
              style: { ...edge.style, color: e.target.value },
            })
          }
          className="w-6 h-6 rounded cursor-pointer border-0"
          title="Color"
        />
        <div className="w-px h-4 bg-border/50 mx-0.5" />
        <EndCapPicker
          label="Start"
          value={startCap as LineEndStyle}
          onChange={(cap) => onUpdateEdge({ style: { ...edge.style, startCap: cap } })}
        />
        <EndCapPicker
          label="End"
          value={endCap as LineEndStyle}
          onChange={(cap) => onUpdateEdge({ style: { ...edge.style, endCap: cap, arrowHead: cap === "arrow" } })}
        />
        <div className="w-px h-4 bg-border/50 mx-0.5" />
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-muted-foreground">Label</span>
        <input
          type="text"
          value={edge.label?.text || ""}
          onChange={(e) =>
            onUpdateEdge({
              label: { ...edge.label, text: e.target.value },
            })
          }
          placeholder="Add label..."
          className="flex-1 px-2 py-1 text-xs bg-muted/50 rounded border-0 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
    </div>
  );
}

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

  const capOptions: { value: LineEndStyle; label: string; icon: ReactNode }[] = [
    { value: "none", label: "None", icon: <Minus className="w-3 h-3" /> },
    { value: "dot", label: "Dot", icon: <Circle className="w-3 h-3 fill-current" /> },
    { value: "arrow", label: "Arrow", icon: <ArrowRight className="w-3 h-3" /> },
    { value: "square", label: "Square", icon: <Square className="w-3 h-3 fill-current" /> },
    { value: "diamond", label: "Diamond", icon: <Diamond className="w-3 h-3 fill-current" /> },
  ];

  const currentOption = capOptions.find((o) => o.value === value) || capOptions[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center gap-1 p-1.5 rounded hover:bg-primary/20 transition-colors text-xs",
          isOpen && "bg-primary/20",
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
                value === option.value && "bg-primary/30",
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
