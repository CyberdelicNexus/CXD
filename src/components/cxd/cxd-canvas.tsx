"use client";

import { useRef, useState, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { v4 as uuidv4 } from "uuid";
import { useCXDStore } from "@/store/cxd-store";
import { CXD_SECTIONS, CXDSectionId } from "@/types/cxd-schema";
import { ExperienceFlowDrawer } from "./canvas/experience-flow-drawer";
import { CanvasToolkit } from "./canvas/canvas-toolkit";
import { CanvasElementRenderer } from "./canvas/canvas-element";
import { canResizeFreeformCard, sanitizeFreeformResizeUpdate } from "./canvas/card-type-utils";
import { ExperienceInspector } from "./canvas/experience-inspector";
import { NavigationToolkit } from "./canvas/navigation-toolkit";
import { LineLayer } from "./canvas/line-layer";
import { TaskInbox } from "./canvas/task-inbox";
import { MultiSelectionBox } from "./canvas/multi-selection-box";
import { Button } from "@/components/ui/button";
import { Minus, Trash2, Circle, ArrowRight, Square, Diamond, Copy, Scissors, Clipboard, ClipboardPaste, Files, ImageIcon, Type, MessageSquare, Link as LinkIcon, Download, Link2, LayoutGrid } from "lucide-react";
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
import { useCollaborationContext } from "@/contexts/collaboration-context";
import { CollaboratorCursors } from "@/components/collaboration";
import { useCanvasSettings } from "@/hooks/use-canvas-settings";

// Constants for zoom limits
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

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

// Canvas Context Menu Component
function CanvasContextMenu({
  position,
  target,
  onClose,
  onCreateElement,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onDownloadImage,
  onConnectSelected,
  onAutoOrganize,
  hasSelection,
  hasClipboard,
  isImageSelected,
  multipleSelected,
}: {
  position: { x: number; y: number };
  target: { type: 'canvas' | 'element'; elementId?: string };
  onClose: () => void;
  onCreateElement: (type: CanvasElementType) => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDownloadImage?: () => void;
  onConnectSelected?: () => void;
  onAutoOrganize?: () => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  isImageSelected?: boolean;
  multipleSelected?: boolean;
}) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mark as ready after a small delay to prevent immediate close
    const readyTimer = setTimeout(() => setIsReady(true), 50);

    const handleClick = (e: MouseEvent) => {
      if (!isReady) return;
      const target = e.target as HTMLElement;
      // Don't close if clicking inside the menu
      if (target.closest('[data-context-menu]')) return;
      // Close on any click outside the menu
      onClose();
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!isReady) return;
      const target = e.target as HTMLElement;
      // Don't close if right-clicking inside the menu
      if (target.closest('[data-context-menu]')) return;
      // Close and let new context menu open
      onClose();
    };

    // Use capture phase to catch events before they're stopped
    document.addEventListener('mousedown', handleClick, true);
    document.addEventListener('contextmenu', handleContextMenu, true);

    return () => {
      clearTimeout(readyTimer);
      document.removeEventListener('mousedown', handleClick, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
    };
  }, [onClose, isReady]);

  return (
    <div
      data-context-menu
      className="fixed z-[100] min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {target.type === 'canvas' && (
        <>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Create Element
          </div>
          <button
            onClick={() => onCreateElement('freeform')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Square className="w-4 h-4" />
            Card
          </button>
          <button
            onClick={() => onCreateElement('text')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Type className="w-4 h-4" />
            Text
          </button>
          <button
            onClick={() => onCreateElement('image')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <ImageIcon className="w-4 h-4" />
            Image
          </button>
          <button
            onClick={() => onCreateElement('shape')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Circle className="w-4 h-4" />
            Shape
          </button>
          <button
            onClick={() => onCreateElement('container')}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Square className="w-4 h-4" />
            Container
          </button>
          <div className="-mx-1 my-1 h-px bg-muted" />
        </>
      )}

      {hasSelection && (
        <>
          <button
            onClick={onCopy}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Copy className="w-4 h-4" />
            Copy
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
          </button>
          <button
            onClick={onCut}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Scissors className="w-4 h-4" />
            Cut
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+X</span>
          </button>
          {isImageSelected && onDownloadImage && (
            <button
              onClick={onDownloadImage}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Download className="w-4 h-4" />
              Download Image
            </button>
          )}
        </>
      )}

      {hasClipboard && (
        <button
          onClick={onPaste}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          <ClipboardPaste className="w-4 h-4" />
          Paste
          <span className="ml-auto text-xs text-muted-foreground">Ctrl+V</span>
        </button>
      )}

      {hasSelection && (
        <>
          <button
            onClick={onDuplicate}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            <Files className="w-4 h-4" />
            Duplicate
            <span className="ml-auto text-xs text-muted-foreground">Ctrl+D</span>
          </button>
          {multipleSelected && (
            <>
              <div className="-mx-1 my-1 h-px bg-muted" />
              <button onClick={onConnectSelected} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors">
                <Link2 className="w-4 h-4" />
                Connect selected
                <span className="ml-auto text-xs text-muted-foreground">{typeof navigator !== 'undefined' && navigator.platform.includes('Mac') ? '⌘L' : 'Ctrl+L'}</span>
              </button>
              <button onClick={onAutoOrganize} className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent transition-colors">
                <LayoutGrid className="w-4 h-4" />
                Auto-organize
              </button>
            </>
          )}
          <div className="-mx-1 my-1 h-px bg-muted" />
          <button
            onClick={onDelete}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete
            <span className="ml-auto text-xs text-muted-foreground">Del</span>
          </button>
        </>
      )}
    </div>
  );
}

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
    updateElementsPositionLocal,
    commitDragPositionsToYjs,
  } = useCXDStore();

  const project = getCurrentProject();
  const canvasBackground = project?.canvasBackground || 'radial-gradient(circle at center, #1a0b2e 0%, #000000 100%)';

  // Canvas settings from user preferences
  const { settings, zoomSensitivity } = useCanvasSettings();

  // Collaboration - realtime cursors, presence, and broadcast.
  // Uses the shared CollaborationProvider channel (from page.tsx) — avoids
  // creating a duplicate canvas:{projectId} subscription which would cause
  // presence key conflicts and broken cursor visibility.
  const { collaborators, updateCursor, clearCursor, broadcastUpdate, updateSelection, followingCollaboratorId, setFollowingCollaboratorId } = useCollaborationContext();

  // Wrapper functions that sync changes to collaborators
  // In CRDT mode, the store action mutates Y.Doc which auto-broadcasts via SupabaseYjsProvider
  // In LWW mode, we explicitly broadcast the update
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

  // Sync container movement with all children (always broadcast LWW as fallback for Yjs)
  const syncMoveContainerWithChildren = useCallback((containerId: string, deltaX: number, deltaY: number) => {
    moveContainerWithChildren(containerId, deltaX, deltaY);

    const allElements = getCanvasElements();
    const container = allElements.find(el => el.id === containerId);
    const children = allElements.filter(el => el.containerId === containerId);
    const childUpdates = [
      { elementId: containerId, changes: { x: (container?.x || 0) + deltaX, y: (container?.y || 0) + deltaY } },
      ...children.map(child => ({
        elementId: child.id,
        changes: { x: child.x + deltaX, y: child.y + deltaY }
      }))
    ];
    broadcastUpdate({ type: 'container_move', containerId, childUpdates });
  }, [moveContainerWithChildren, getCanvasElements, broadcastUpdate]);

  // Sync node-container attachment/detachment
  const syncAddNodeToContainer = useCallback((nodeId: string, containerId: string) => {
    addNodeToContainer(nodeId, containerId);
    broadcastUpdate({ type: 'element_update', elementId: nodeId, changes: { containerId } });
  }, [addNodeToContainer, broadcastUpdate]);

  const syncRemoveNodeFromContainer = useCallback((nodeId: string) => {
    removeNodeFromContainer(nodeId);
    broadcastUpdate({ type: 'element_update', elementId: nodeId, changes: { containerId: null } });
  }, [removeNodeFromContainer, broadcastUpdate]);

  // Broadcast full state sync after undo/redo (LWW only — CRDT uses Y.UndoManager)
  const syncAfterUndoRedo = useCallback(() => {
    if (useCXDStore.getState().yDoc) return;
    const elements = getCanvasElements();
    const edges = getCanvasEdges();
    broadcastUpdate({ type: 'state_sync', elements, edges });
  }, [getCanvasElements, getCanvasEdges, broadcastUpdate]);

  const containerRef = useRef<HTMLDivElement>(null);
  const zoomAccumulator = useRef(0); // Accumulate trackpad zoom delta for incremental steps
  // Track last known cursor canvas position so zoom changes can re-broadcast with updated zoom level
  const lastCursorCanvasPosRef = useRef<{ x: number; y: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isSpacePressed, setIsSpacePressed] = useState(false); // Track spacebar for pan mode
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{ type: 'canvas' | 'element'; elementId?: string } | null>(null);
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

  // Connector hover states for glow and midpoint node
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoveredMidpointEdgeId, setHoveredMidpointEdgeId] = useState<string | null>(null);

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

  // Grid constants - use settings.gridSize for main grid
  const GRID_SIZE = settings.gridSize; // Main grid size from settings
  const MINOR_GRID_SIZE = Math.floor(settings.gridSize / 2); // Minor grid for finer snapping
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

  // Get inbox items from all boards (not filtered by current board).
  // Note: the drop handler reads element data from useCXDStore.getState() directly
  // so stale memoisation here is fine — the ref is only used for TaskInbox badge counts.
  const inboxItems = useMemo(
    () => getAllInboxItems(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []  // intentionally compute once; handleDrop bypasses this via live store read
  );
  const canvasElements = useMemo(
    () => allCanvasElements.filter((el) => !el.inInbox),
    [allCanvasElements]
  );

  // Fast element lookup by id for per-edge z-index computation
  const elementsById = useMemo(
    () => Object.fromEntries(canvasElements.map(el => [el.id, el])),
    [canvasElements]
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

    const fromRaw = getAnchorPosition(
      fromElement,
      fromAnchor,
      edge.fromAutoAnchor ? 0.5 : edge.fromAnchorOffset,
    );
    const toRaw = getAnchorPosition(
      toElement,
      toAnchor,
      edge.toAutoAnchor ? 0.5 : edge.toAnchorOffset,
    );

    // Apply 2px outset so lines attach cleanly at element edges without overlapping card body
    const OUTSET = 2;
    const applyOutset = (pt: { x: number; y: number }, anchor: 'top' | 'right' | 'bottom' | 'left') => {
      switch (anchor) {
        case 'top':    return { x: pt.x, y: pt.y - OUTSET };
        case 'bottom': return { x: pt.x, y: pt.y + OUTSET };
        case 'left':   return { x: pt.x - OUTSET, y: pt.y };
        case 'right':  return { x: pt.x + OUTSET, y: pt.y };
      }
    };

    const from = applyOutset(fromRaw, fromAnchor);
    const to = applyOutset(toRaw, toAnchor);

    return { from, to, fromAnchor, toAnchor };
  }, []);

  // Reusable bend drag starter — used by both the selected-edge handle and the always-visible midpoint node
  const startBendDrag = useCallback((e: React.MouseEvent, edge: CanvasEdge) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingBendHandle(edge.id);
    // Also ensure the edge is selected so the full handle UI appears
    setSelectedEdgeId(edge.id);
    setSelectedElementId(null);
    setSelectedElementIds(new Set());
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

  // Duplicate a line element (offset by 20px so it's visible)
  const handleDuplicateLine = useCallback(
    (line: LineElement) => {
      pushCanvasHistory();
      const offset = 20;
      const newLine: LineElement = {
        ...line,
        id: uuidv4(),
        x: line.x + offset,
        y: line.y + offset,
        start: line.start ? { x: line.start.x + offset, y: line.start.y + offset } : line.start,
        end: line.end ? { x: line.end.x + offset, y: line.end.y + offset } : line.end,
        bend: line.bend ? { x: line.bend.x + offset, y: line.bend.y + offset } : line.bend,
      };
      syncAddElement(newLine);
      setSelectedElementId(newLine.id);
      setSelectedElementIds(new Set([newLine.id]));
    },
    [pushCanvasHistory, syncAddElement],
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
      // Only handle if clicking on background or canvas-background
      if (
        target === containerRef.current ||
        target.classList.contains("canvas-background") ||
        target.classList.contains("dot-grid")
      ) {
        // Right-click: Show context menu
        if (e.button === 2) {
          setContextMenuPos({ x: e.clientX, y: e.clientY });
          setContextMenuTarget({ type: 'canvas' });
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        // Middle mouse button OR Spacebar + left click: Start panning
        if (e.button === 1 || (isSpacePressed && e.button === 0)) {
          // Close context menu when starting to pan
          setContextMenuPos(null);
          setContextMenuTarget(null);
          setIsPanning(true);
          setPanStart({
            x: e.clientX - canvasPosition.x,
            y: e.clientY - canvasPosition.y,
          });
          e.preventDefault();
          return;
        }

        // Left click without spacebar: Start marquee selection
        if (e.button === 0 && !isSpacePressed) {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
            const y = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
            setIsMarqueeSelecting(true);
            setMarqueeStart({ x, y });
            setMarqueeEnd({ x, y });

            // GLOBAL RULE: Clicking background deselects all elements and closes all menus
            setSelectedElementId(null);
            setSelectedElementIds(new Set());
            setSelectedEdgeId(null);
            // Close context menu
            setContextMenuPos(null);
            setContextMenuTarget(null);

            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }
    },
    [canvasPosition, canvasZoom, setSelectedElementId, isSpacePressed],
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Track cursor position for collaborators
      if (containerRef.current && updateCursor) {
        const rect = containerRef.current.getBoundingClientRect();
        const cursorX = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
        const cursorY = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;
        lastCursorCanvasPosRef.current = { x: cursorX, y: cursorY };
        updateCursor(cursorX, cursorY, canvasZoom, activeBoardId ?? null);
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
          // Use dragOriginalPositionsRef (captured at drag start) so that Yjs bridge
          // updates to Zustand between frames don't cause the delta to compound.
          let snappedDeltaX = deltaX;
          let snappedDeltaY = deltaY;

          if (primaryElement) {
            const primaryOrigin = dragOriginalPositionsRef.current.get(draggingElement);
            const baseX = primaryOrigin?.x ?? primaryElement.x;
            const baseY = primaryOrigin?.y ?? primaryElement.y;
            let newPrimaryX = baseX + deltaX;
            let newPrimaryY = baseY + deltaY;

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

            // Total snapped delta from origin (not incremental from live Zustand position)
            snappedDeltaX = newPrimaryX - baseX;
            snappedDeltaY = newPrimaryY - baseY;
          }

          // Collect all position updates for a single local Zustand write
          const localUpdates: Array<{ id: string; x: number; y: number }> = [];

          selectedElementIds.forEach((id) => {
            const el = canvasElements.find((e) => e.id === id);
            if (el) {
              const elOrigin = dragOriginalPositionsRef.current.get(id);
              if (el.type === "container") {
                const targetX = (elOrigin?.x ?? el.x) + snappedDeltaX;
                const targetY = (elOrigin?.y ?? el.y) + snappedDeltaY;
                localUpdates.push({ id, x: targetX, y: targetY });
                // Move children locally too
                canvasElements.forEach((child) => {
                  if (child.containerId === id) {
                    const childOrigin = dragOriginalPositionsRef.current.get(child.id);
                    localUpdates.push({
                      id: child.id,
                      x: (childOrigin?.x ?? child.x) + snappedDeltaX,
                      y: (childOrigin?.y ?? child.y) + snappedDeltaY,
                    });
                  }
                });
              } else {
                const newX = (elOrigin?.x ?? el.x) + snappedDeltaX;
                const newY = (elOrigin?.y ?? el.y) + snappedDeltaY;
                localUpdates.push({ id, x: newX, y: newY });

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
                      syncRemoveNodeFromContainer(id);
                    }
                  }
                }
              }
            }
          });

          // Write all multi-select position changes to Zustand in one shot (no Yjs during drag)
          if (localUpdates.length > 0) {
            updateElementsPositionLocal(localUpdates);
          }

          // Move bend points of edges connecting two selected elements
          canvasEdges.forEach((edge) => {
            const fromSelected = selectedElementIds.has(edge.fromNodeId);
            const toSelected = selectedElementIds.has(edge.toNodeId);
            // Only move bend if BOTH endpoints are selected
            if (fromSelected && toSelected && edge.bend) {
              syncUpdateEdge(edge.id, {
                bend: {
                  x: edge.bend.x + snappedDeltaX,
                  y: edge.bend.y + snappedDeltaY,
                },
              });
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
            // Use origin position (captured at drag start) so Yjs bridge updates
            // to Zustand between frames don't compound the delta.
            const elementOrigin = dragOriginalPositionsRef.current.get(draggingElement);
            let newX = (elementOrigin?.x ?? element.x) + deltaX;
            let newY = (elementOrigin?.y ?? element.y) + deltaY;

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

            // Write position(s) directly to Zustand — no Yjs during drag.
            // commitDragPositionsToYjs on mouseup will do one batch Yjs transaction.
            if (element.type === "container") {
              // Move container + all its children locally
              const singleDragUpdates: Array<{ id: string; x: number; y: number }> = [
                { id: draggingElement, x: newX, y: newY },
              ];
              canvasElements.forEach((child) => {
                if (child.containerId === draggingElement) {
                  const childOrigin = dragOriginalPositionsRef.current.get(child.id);
                  const cDelta = { x: newX - (elementOrigin?.x ?? element.x), y: newY - (elementOrigin?.y ?? element.y) };
                  singleDragUpdates.push({
                    id: child.id,
                    x: (childOrigin?.x ?? child.x) + cDelta.x,
                    y: (childOrigin?.y ?? child.y) + cDelta.y,
                  });
                }
              });
              updateElementsPositionLocal(singleDragUpdates);
            } else {
              updateElementsPositionLocal([{ id: draggingElement, x: newX, y: newY }]);

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
                    syncRemoveNodeFromContainer(draggingElement);
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
        // NOTE: Do NOT update dragElementStart here. We use dragOriginalPositionsRef
        // (fixed at drag start) + absolute delta (currentMouse - dragElementStart) so
        // that the element tracks the total displacement, not just the per-frame increment.
        // Updating dragElementStart each frame caused elements to appear frozen because
        // newX = origin + (lastFrame - thisFrame) ≈ origin on every frame.
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
      isMarqueeSelecting,
      selectedElementIds,
      dragOffsets,
      draggingBendHandle,
      syncRemoveNodeFromContainer,
      canvasEdges,
      updateCanvasEdge,
      syncUpdateEdge,
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

    // Auto-center bend: if released within 12px of geometric midpoint, clear explicit bend
    if (draggingBendHandle) {
      const edge = canvasEdges.find((e) => e.id === draggingBendHandle);
      if (edge && edge.bend) {
        const fromEl = canvasElements.find((el) => el.id === edge.fromNodeId);
        const toEl = canvasElements.find((el) => el.id === edge.toNodeId);
        if (fromEl && toEl) {
          const { from, to } = getResolvedEdgePoints(edge, fromEl, toEl);
          if (from && to) {
            const autoMidX = (from.x + to.x) / 2;
            const autoMidY = (from.y + to.y) / 2;
            // Geometric midpoint on curve at t=0.5 using auto midpoint as control point
            const geomMidX = 0.25 * from.x + 0.5 * autoMidX + 0.25 * to.x;
            const geomMidY = 0.25 * from.y + 0.5 * autoMidY + 0.25 * to.y;
            const dist = Math.hypot(edge.bend.x - geomMidX, edge.bend.y - geomMidY);
            if (dist < 12) {
              syncUpdateEdge(draggingBendHandle, { bend: undefined });
            }
          }
        }
      }
    }

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

          // Propagate parent (fromEl) hypercubeTags to child (toEl) — union, no overwrite
          if (fromEl?.hypercubeTags?.length) {
            const existingTags = toEl?.hypercubeTags || [];
            const unionTags = Array.from(new Set([...existingTags, ...fromEl.hypercubeTags]));
            if (unionTags.length !== existingTags.length) {
              syncUpdateElement(newEdge.toNodeId, { hypercubeTags: unionTags });
            }
          }

          // customTags propagation intentionally omitted — taskMetadata is not on all element types
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

    // Failsafe: force-clear experience block drag state on any canvas mouseup.
    // Inbox items use a document-level bubble handler that fires AFTER this, so
    // we must NOT clear draggingInboxItem here — that would cancel the drop.
    if (draggingExperienceBlock) {
      setDraggingExperienceBlock(null);
      setExperienceBlockDragPos(null);
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
        cardType?: "note" | "task" | "document";
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
          const isDocument = options?.cardType === "document";
          newElement = {
            ...baseElement,
            width: isTaskCard ? 250 : isDocument ? 100 : 300,
            height: isTaskCard ? baseElement.height : isDocument ? 100 : 300,
            type: "freeform",
            cardType: isTaskCard ? "task" : "note",
            content: isTaskCard ? "Task Title" : "",
            noteTitle: isTaskCard ? undefined : isDocument ? "Untitled Document" : "Untitled Note",
            noteBody: isTaskCard ? undefined : "",
            emoji: isTaskCard ? "✅" : isNoteCard ? "📌" : isDocument ? "📄" : undefined,
            isDocument: isDocument || undefined,
            wordCount: isDocument ? 0 : undefined,
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
      // Prevent drag on right-click (context menu)
      if (e.button === 2) {
        return;
      }

      // Middle mouse button or spacebar held: start panning instead of dragging elements
      if (e.button === 1 || isSpacePressed) {
        e.stopPropagation();
        e.preventDefault();
        setIsPanning(true);
        setPanStart({
          x: e.clientX - canvasPosition.x,
          y: e.clientY - canvasPosition.y,
        });
        return;
      }

      // Close context menu when clicking/dragging an element
      setContextMenuPos(null);
      setContextMenuTarget(null);

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
        // If it's a container, also capture all children so we can move them locally
        if (element.type === 'container') {
          canvasElements.forEach((child) => {
            if (child.containerId === elementId) {
              originalPositions.set(child.id, { x: child.x, y: child.y });
            }
          });
        }
      }

      dragOriginalPositionsRef.current = originalPositions;
      setDraggingElement(elementId);
      setDragElementStart({ x: e.clientX, y: e.clientY });
      setSelectedElementId(elementId);
    },
    [canvasElements, selectedElementIds, addCanvasElement, syncAddElement, pushCanvasHistory, isSpacePressed, canvasPosition],
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

        // Attach all dropped elements to the container (no auto-expansion)
        elementsToDrop.forEach((id) => {
          syncAddNodeToContainer(id, targetContainer.id);
        });
      }
    }

    // Commit all final drag positions to Yjs in one batch transaction.
    // During the drag we wrote directly to Zustand (no Yjs) for instant visual
    // feedback. Now we produce a single Yjs update → one broadcast to peers.
    const finalPositions: Array<{ id: string; x: number; y: number }> = [];
    dragOriginalPositionsRef.current.forEach((_, id) => {
      const el = useCXDStore.getState().getCurrentProject()?.canvasLayout?.elements?.find(e => e.id === id);
      if (el) finalPositions.push({ id, x: el.x, y: el.y });
    });
    if (finalPositions.length > 0) {
      commitDragPositionsToYjs(finalPositions);
    }
    dragOriginalPositionsRef.current = new Map();

    setDraggingElement(null);
    setDropTargetBoardId(null);
    setDropTargetContainerId(null);
    setAlignmentGuides({ horizontal: [], vertical: [] });
  }, [
    draggingElement,
    canvasElements,
    syncAddNodeToContainer,
    dropTargetBoardId,
    dropTargetContainerId,
    selectedElementIds,
    updateCanvasElement,
    commitDragPositionsToYjs,
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

  // Handle inbox item drag start.
  // Registers mouseup/pointerup handlers SYNCHRONOUSLY at mousedown time so there
  // is no race condition with React's async re-render cycle — if the user releases
  // quickly, the handler is already listening before the first re-render commits.
  const handleInboxItemDragStart = useCallback(
    (elementId: string, e: React.MouseEvent) => {
      setDraggingInboxItem(elementId);
      setInboxDragPos({ x: e.clientX, y: e.clientY });

      let dropped = false; // Guard against double-fire from mouseup + pointerup

      const handleMove = (ev: MouseEvent) => {
        setInboxDragPos({ x: ev.clientX, y: ev.clientY });
      };

      const handleDrop = (ev: MouseEvent | PointerEvent) => {
        if (dropped) return;
        dropped = true;

        // Always tear down listeners first
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleDrop, true);
        document.removeEventListener("pointerup", handleDrop as EventListener, true);

        const {
          canvasPosition: pos,
          canvasZoom: zoom,
          inboxItems: items,
          handlePlaceInboxItem: placeItem,
        } = experienceDropCtxRef.current;

        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const canvasX = (ev.clientX - rect.left - pos.x) / zoom;
          const canvasY = (ev.clientY - rect.top - pos.y) / zoom;

          if (
            ev.clientX >= rect.left &&
            ev.clientX <= rect.right &&
            ev.clientY >= rect.top &&
            ev.clientY <= rect.bottom
          ) {
            if (placeItem) {
              // Read element dimensions directly from the live store to avoid
              // stale-ref issues (inboxItems in the ref may lag behind new adds).
              const liveElements = useCXDStore.getState().getCurrentProject()?.canvasLayout?.elements || [];
              const element = liveElements.find((el: any) => el.id === elementId);
              placeItem(
                elementId,
                canvasX - ((element?.width ?? 0) / 2),
                canvasY - ((element?.height ?? 0) / 2)
              );
            }
          }
        }

        // Always clear drag state
        setDraggingInboxItem(null);
        setInboxDragPos(null);
      };

      // Capture phase so child stopPropagation / SVG pointer capture cannot swallow the event.
      // Listen to both mouseup and pointerup for maximum reliability.
      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleDrop, true);
      document.addEventListener("pointerup", handleDrop as EventListener, true);
    },
    []
  );

  // Handle inbox item placement on canvas
  const handlePlaceInboxItem = useCallback(
    (elementId: string, x: number, y: number) => {
      // IMPORTANT: Search in ALL elements, not just current board/surface filtered elements
      // Inbox items can be created on different boards/surfaces but should be placeable anywhere
      const allElements = project?.canvasLayout?.elements || [];
      const element = allElements.find(el => el.id === elementId);
      console.log('[CXDCanvas] Placing inbox item on canvas:', {
        elementId,
        x,
        y,
        allElementsCount: allElements.length,
        element: element ? {
          type: element.type,
          cardType: (element as any).cardType,
          emoji: (element as any).emoji,
          inInbox: element.inInbox,
          boardId: element.boardId,
          surface: element.surface,
        } : 'NOT FOUND'
      });
      pushCanvasHistory();
      updateCanvasElement(elementId, {
        x,
        y,
        inInbox: false, // Remove from inbox
        // Update boardId and surface to current active board/surface
        boardId: activeBoardId,
        surface: activeSurface,
      });
    },
    [pushCanvasHistory, updateCanvasElement, project, activeBoardId, activeSurface]
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
            x: canvasX - 210, // Center the 420px wide element horizontally
            y: canvasY - 26,  // Cursor lands in the header (header ~52px, offset to middle)
            width: 420,
            height: 360,      // Placeholder — ResizeObserver in ExperienceBlockCard will correct
            viewMode: 'inline',
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

  // NOTE: Inbox item drag move/drop handlers are registered SYNCHRONOUSLY in
  // handleInboxItemDragStart (above) so there is no race condition with React's
  // async re-render cycle. No separate useEffect needed here.

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

        // Propagate parent (fromEl) hypercubeTags to child (toEl) — union, no overwrite
        if (fromEl?.hypercubeTags?.length) {
          const existingTags = toEl?.hypercubeTags ?? [];
          const unionTags = Array.from(new Set([...existingTags, ...fromEl.hypercubeTags]));
          if (unionTags.length !== existingTags.length) {
            syncUpdateElement(newEdge.toNodeId, { hypercubeTags: unionTags });
          }
        }

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
      syncUpdateElement,
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

  // Dialog state for clipboard paste — shown when the pasted content is ambiguous
  type ClipboardPasteState =
    | { kind: 'text'; text: string; canvasX: number; canvasY: number }
    | { kind: 'link'; url: string; canvasX: number; canvasY: number };
  const [clipboardPasteDialog, setClipboardPasteDialog] = useState<ClipboardPasteState | null>(null);

  // Helper: convert last mouse position to canvas coordinates
  const mouseToCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return null;
    return {
      x: (clientX - containerRect.left - canvasPosition.x) / canvasZoom,
      y: (clientY - containerRect.top - canvasPosition.y) / canvasZoom,
    };
  }, [canvasPosition, canvasZoom]);

  // Helper: build a new canvas element base at canvas coords
  const makeElementBase = useCallback((type: CanvasElementType, canvasX: number, canvasY: number) => {
    const size = DEFAULT_ELEMENT_SIZES[type] ?? { width: 300, height: 200 };
    const maxZIndex = canvasElements.reduce(
      (max, el) => Math.max(max, Number.isFinite(el.zIndex) ? el.zIndex : 0), 0,
    );
    return {
      id: uuidv4(),
      type,
      x: canvasX - size.width / 2,
      y: canvasY - size.height / 2,
      width: size.width,
      height: size.height,
      zIndex: maxZIndex + 1,
      boardId: activeBoardId,
      surface: activeSurface,
    };
  }, [canvasElements, activeBoardId, activeSurface]);

  // System clipboard paste handler (Ctrl/Cmd+V with actual clipboard data)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Skip if user is editing text in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      const isEditing =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true' ||
        target.closest('[contenteditable="true"]');
      if (isEditing) return;

      // Skip if there are canvas elements in our internal clipboard (handled by keydown)
      if (clipboard.length > 0) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const coords = mouseToCanvasCoords(lastMousePos.x, lastMousePos.y);
      if (!coords) return;
      const { x: canvasX, y: canvasY } = coords;

      // ── Image ──
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (!file) continue;
          const reader = new FileReader();
          reader.onload = (evt) => {
            const src = evt.target?.result as string;
            if (!src) return;
            pushCanvasHistory();
            const base = makeElementBase('image', canvasX, canvasY);
            const newEl = { ...base, type: 'image' as const, src, objectFit: 'cover' as const };
            syncAddElement(newEl);
            setSelectedElementId(newEl.id);
            setSelectedElementIds(new Set([newEl.id]));
          };
          reader.readAsDataURL(file);
          return;
        }
      }

      // ── Text / URL ──
      const textItem = Array.from(items).find((i) => i.type === 'text/plain');
      if (!textItem) return;

      textItem.getAsString((text) => {
        const trimmed = text.trim();
        if (!trimmed) return;

        // Detect URL
        const isUrl = /^https?:\/\/\S+$/.test(trimmed);
        if (isUrl) {
          e.preventDefault();
          setClipboardPasteDialog({ kind: 'link', url: trimmed, canvasX, canvasY });
          return;
        }

        // Plain text
        e.preventDefault();
        setClipboardPasteDialog({ kind: 'text', text: trimmed, canvasX, canvasY });
      });
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipboard.length, lastMousePos, mouseToCanvasCoords, makeElementBase, pushCanvasHistory, syncAddElement]);

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

  // Connect selected elements in spatial order with edges (cmd+L)
  const connectSelectedElements = useCallback(() => {
    const selected = canvasElements.filter(el => selectedElementIds.has(el.id));
    if (selected.length < 2) return;
    pushCanvasHistory();
    const sorted = [...selected].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    for (let i = 0; i < sorted.length - 1; i++) {
      const newEdge: CanvasEdge = {
        id: crypto.randomUUID(),
        fromNodeId: sorted[i].id,
        toNodeId: sorted[i + 1].id,
        fromAnchor: 'right',
        toAnchor: 'left',
        fromAutoAnchor: true,
        toAutoAnchor: true,
        style: {},
      };
      syncAddEdge(newEdge);
      // Propagate hypercubeTags from source to target
      if (sorted[i].hypercubeTags?.length) {
        const existingTags = sorted[i + 1].hypercubeTags ?? [];
        const unionTags = Array.from(new Set([...existingTags, ...sorted[i].hypercubeTags!]));
        if (unionTags.length !== existingTags.length) {
          syncUpdateElement(sorted[i + 1].id, { hypercubeTags: unionTags });
        }
      }
    }
  }, [canvasElements, selectedElementIds, pushCanvasHistory, syncAddEdge, syncUpdateElement]);

  // Auto-organize selected elements into an evenly-spaced grid (cmd+shift+O)
  const autoOrganizeSelected = useCallback(() => {
    const selected = canvasElements.filter(el => selectedElementIds.has(el.id));
    if (selected.length < 2) return;
    pushCanvasHistory();
    const sorted = [...selected].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    const count = sorted.length;
    const cols = Math.ceil(Math.sqrt(count));
    const maxW = Math.max(...sorted.map(e => e.width));
    const maxH = Math.max(...sorted.map(e => e.height));
    const gap = 40;
    const cellW = maxW + gap;
    const cellH = maxH + gap;
    const centroidX = sorted.reduce((s, e) => s + e.x + e.width / 2, 0) / count;
    const centroidY = sorted.reduce((s, e) => s + e.y + e.height / 2, 0) / count;
    const startX = centroidX - (cols * cellW) / 2;
    const startY = centroidY - (Math.ceil(count / cols) * cellH) / 2;
    sorted.forEach((el, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      syncUpdateElement(el.id, {
        x: startX + col * cellW + (cellW - el.width) / 2,
        y: startY + row * cellH + (cellH - el.height) / 2,
      });
    });
    // Clear bends on edges between selected elements
    canvasEdges.forEach(edge => {
      if (selectedElementIds.has(edge.fromNodeId) && selectedElementIds.has(edge.toNodeId)) {
        syncUpdateEdge(edge.id, { bend: undefined });
      }
    });
  }, [canvasElements, canvasEdges, selectedElementIds, pushCanvasHistory, syncUpdateElement, syncUpdateEdge]);

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

          // Move bend points of edges connecting two selected elements
          if (selectedElementIds.size > 1) {
            canvasEdges.forEach((edge) => {
              const fromSelected = selectedElementIds.has(edge.fromNodeId);
              const toSelected = selectedElementIds.has(edge.toNodeId);
              // Only move bend if BOTH endpoints are selected
              if (fromSelected && toSelected && edge.bend) {
                syncUpdateEdge(edge.id, {
                  bend: {
                    x: edge.bend.x + deltaX,
                    y: edge.bend.y + deltaY,
                  },
                });
              }
            });
          }

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

      // Cmd/Ctrl+L → Connect selected elements
      if (isMod && !e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (selectedElementIds.size >= 2) connectSelectedElements();
        return;
      }

      // Cmd/Ctrl+Shift+O → Auto-organize selected elements
      if (isMod && e.shiftKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        if (selectedElementIds.size >= 2) autoOrganizeSelected();
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

        // Also copy single image to system clipboard
        if (selectedElements.length === 1 && selectedElements[0].type === "image") {
          const imgEl = selectedElements[0] as any;
          if (imgEl.src) {
            fetch(imgEl.src)
              .then((res) => res.blob())
              .then((blob) => {
                const mimeType = blob.type.startsWith("image/") ? blob.type : "image/png";
                // Browsers require image/png for ClipboardItem in most cases
                if (mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/webp") {
                  navigator.clipboard.write([
                    new ClipboardItem({ [mimeType]: blob }),
                  ]).catch(() => {
                    // Silently fail — system clipboard copy is best-effort
                  });
                } else {
                  // Convert to PNG via canvas for broader clipboard compatibility
                  const img = new Image();
                  img.crossOrigin = "anonymous";
                  img.onload = () => {
                    const cvs = document.createElement("canvas");
                    cvs.width = img.naturalWidth;
                    cvs.height = img.naturalHeight;
                    cvs.getContext("2d")?.drawImage(img, 0, 0);
                    cvs.toBlob((pngBlob) => {
                      if (pngBlob) {
                        navigator.clipboard.write([
                          new ClipboardItem({ "image/png": pngBlob }),
                        ]).catch(() => {});
                      }
                    }, "image/png");
                  };
                  img.src = imgEl.src;
                }
              })
              .catch(() => {
                // Silently fail if fetch fails (e.g. CORS)
              });
          }
        }
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
    connectSelectedElements,
    autoOrganizeSelected,
  ]);

  // Smooth zoom with scroll wheel (Ctrl+scroll) or pan (regular scroll)
  const handleWheel = useCallback(
    (e: WheelEvent) => {
      // If target is within an element that should prevent canvas wheeling (like sidebar panels), skip
      const target = e.target as HTMLElement;
      if (target.closest('[data-prevent-canvas-wheel="true"]')) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      // Always read fresh values from store to avoid stale closure during rapid scrolling
      const storeState = useCXDStore.getState();
      const currentZoom = storeState.canvasZoom;
      const currentPos = storeState.canvasPosition;

      // Ctrl+scroll = zoom, regular scroll = pan
      if (e.ctrlKey || e.metaKey) {
        // ZOOM MODE - always prevent default to stop browser zoom and scrolling
        e.preventDefault();
        e.stopPropagation();

        // Check if we're at zoom limits - if so, do nothing
        // Use epsilon margin for hard stop with no sliding
        const ZOOM_EPSILON = 0.001;
        const isZoomingIn = e.deltaY < 0;
        const isZoomingOut = e.deltaY > 0;
        const atMaxZoom = currentZoom >= MAX_ZOOM - ZOOM_EPSILON;
        const atMinZoom = currentZoom <= MIN_ZOOM + ZOOM_EPSILON;

        // HARD STOP: If at zoom limit, block ALL events and return immediately
        // This prevents any scrolling, panning, or position updates
        if ((atMaxZoom && isZoomingIn) || (atMinZoom && isZoomingOut)) {
          // Reset accumulator to prevent buildup
          zoomAccumulator.current = 0;
          e.stopImmediatePropagation();
          return;
        }

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

        // For trackpad with pinch gesture, use incremental zoom steps to prevent grid sliding
        const isTrackpad = Math.abs(normalizedDelta) < 10;

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
              Math.max(MIN_ZOOM, currentZoom * (zoomDirection > 0 ? zoomStep : 1 / zoomStep)),
            );

            // Only update if zoom actually changed significantly (prevents sliding at max/min zoom)
            // Use a small epsilon to avoid floating point precision issues
            const zoomChanged = Math.abs(newZoom - currentZoom) > 0.001;
            if (zoomChanged) {
              const zoomRatio = newZoom / currentZoom;

              // Zoom towards cursor position
              const newPosX = Math.round((mouseX - (mouseX - currentPos.x) * zoomRatio) * 100) / 100;
              const newPosY = Math.round((mouseY - (mouseY - currentPos.y) * zoomRatio) * 100) / 100;

              setCanvasZoom(newZoom);
              setCanvasPosition({ x: newPosX, y: newPosY });
            }

            // Reset accumulator
            zoomAccumulator.current = 0;
          }
        } else {
          // Mouse wheel - use continuous zoom with user's sensitivity setting
          const delta = -normalizedDelta * zoomSensitivity;

          const newZoom = Math.min(
            MAX_ZOOM,
            Math.max(MIN_ZOOM, currentZoom * (1 + delta)),
          );

          // Only update if zoom actually changed significantly (prevents sliding at max/min zoom)
          // Use a small epsilon to avoid floating point precision issues
          const zoomChanged = Math.abs(newZoom - currentZoom) > 0.001;
          if (zoomChanged) {
            const zoomRatio = newZoom / currentZoom;

            // Zoom towards cursor position
            const newPosX = Math.round((mouseX - (mouseX - currentPos.x) * zoomRatio) * 100) / 100;
            const newPosY = Math.round((mouseY - (mouseY - currentPos.y) * zoomRatio) * 100) / 100;

            setCanvasZoom(newZoom);
            setCanvasPosition({ x: newPosX, y: newPosY });
          }
        }
      } else {
        // PAN MODE - only prevent default for pan mode
        e.preventDefault();
        // PAN MODE - scroll to pan X/Y
        // Shift+scroll = horizontal pan, regular scroll = vertical pan
        const panSpeed = 1;

        if (e.shiftKey) {
          // Horizontal pan
          setCanvasPosition({
            x: currentPos.x - e.deltaY * panSpeed,
            y: currentPos.y
          });
        } else {
          // Vertical pan (or both if deltaX exists)
          setCanvasPosition({
            x: currentPos.x - (e.deltaX || 0) * panSpeed,
            y: currentPos.y - e.deltaY * panSpeed
          });
        }
      }
    },
    [setCanvasZoom, setCanvasPosition, zoomSensitivity],
  );

  // Attach wheel event with passive: false
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("wheel", handleWheel, { passive: false });
      return () => container.removeEventListener("wheel", handleWheel);
    }
  }, [handleWheel]);

  // Spacebar detection for pan mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't trigger if typing in an input/textarea
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsSpacePressed(false);
        // If we were panning with space, stop panning
        if (isPanning) {
          setIsPanning(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPanning]);

  const handleZoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, canvasZoom * 1.2);
    setCanvasZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, canvasZoom / 1.2);
    setCanvasZoom(newZoom);
  };

  const handleResetView = () => {
    // Reset to 100% zoom (1.0) and center the view
    setCanvasPosition({ x: 0, y: 0 });
    setCanvasZoom(1.0);
  };

  const handleFitAll = () => {
    // Calculate bounding box of all canvas elements
    if (canvasElements.length === 0) return;

    const container = containerRef.current;
    if (!container) return;

    // Find bounds of all elements with padding
    const padding = 60;
    const minX = Math.min(...canvasElements.map((el) => el.x)) - padding;
    const maxX = Math.max(...canvasElements.map((el) => el.x + el.width)) + padding;
    const minY = Math.min(...canvasElements.map((el) => el.y)) - padding;
    const maxY = Math.max(...canvasElements.map((el) => el.y + el.height)) + padding;

    // Use getBoundingClientRect for accurate visible dimensions
    const rect = container.getBoundingClientRect();
    const containerWidth = rect.width;
    const containerHeight = rect.height;

    // The container starts at rect.top (64px) but navbar is 80px,
    // so the top portion is hidden behind the navbar
    const NAVBAR_HEIGHT = 80;
    const navbarOverlap = Math.max(0, NAVBAR_HEIGHT - rect.top);
    const visibleHeight = containerHeight - navbarOverlap;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate zoom to fit all content
    const scaleX = containerWidth / contentWidth;
    const scaleY = visibleHeight / contentHeight;
    const newZoom = Math.max(MIN_ZOOM, Math.min(scaleX, scaleY, MAX_ZOOM) * 0.95);

    // Calculate center point of content
    const contentCenterX = minX + contentWidth / 2;
    const contentCenterY = minY + contentHeight / 2;

    // Calculate the visible center of the container (accounting for navbar overlap)
    const visibleCenterX = containerWidth / 2;
    const visibleCenterY = navbarOverlap + visibleHeight / 2;

    // Calculate position to center the content in the visible viewport
    setCanvasZoom(newZoom);
    setCanvasPosition({
      x: visibleCenterX - contentCenterX * newZoom,
      y: visibleCenterY - contentCenterY * newZoom,
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

  // Broadcast local selection to collaborators so they see our highlights
  useEffect(() => {
    updateSelection(Array.from(selectedElementIds));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementIds]);

  // Derived: the collaborator currently being followed (used for live-follow logic + overlay)
  const followedCollaborator = useMemo(
    () => (followingCollaboratorId ? collaborators.find((c) => c.id === followingCollaboratorId) ?? null : null),
    [followingCollaboratorId, collaborators],
  );

  // Live-follow: pan canvas (and match zoom) to keep the followed collaborator's cursor centered
  useEffect(() => {
    if (!followingCollaboratorId) return;
    const followed = collaborators.find((c) => c.id === followingCollaboratorId);
    if (!followed?.cursor) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    // Mirror the followed user's zoom if available
    const targetZoom = followed.cursor.zoom ?? canvasZoom;
    if (followed.cursor.zoom !== undefined && followed.cursor.zoom !== canvasZoom) {
      setCanvasZoom(followed.cursor.zoom);
    }
    setCanvasPosition({
      x: rect.width / 2 - followed.cursor.x * targetZoom,
      y: rect.height / 2 - followed.cursor.y * targetZoom,
    });
  }, [followingCollaboratorId, collaborators, canvasZoom, setCanvasPosition, setCanvasZoom]);

  // Stop following when the viewer clicks anywhere
  useEffect(() => {
    if (!followingCollaboratorId) return;
    const stop = () => setFollowingCollaboratorId(null);
    document.addEventListener('mousedown', stop, { capture: true });
    return () => document.removeEventListener('mousedown', stop, { capture: true });
  }, [followingCollaboratorId, setFollowingCollaboratorId]);

  // Re-broadcast cursor with new zoom level whenever canvasZoom changes
  // This ensures collaborators immediately see the updated zoom even when the mouse isn't moving
  useEffect(() => {
    if (!updateCursor || !lastCursorCanvasPosRef.current) return;
    const { x, y } = lastCursorCanvasPosRef.current;
    updateCursor(x, y, canvasZoom, activeBoardId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasZoom]);

  // Board breadcrumb following: mirror the followed user's board navigation
  const prevFollowedBoardIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!followedCollaborator) {
      prevFollowedBoardIdRef.current = undefined;
      return;
    }
    const targetBoardId = followedCollaborator.cursor?.boardId ?? null;
    // Only act when boardId actually changed
    if (prevFollowedBoardIdRef.current === targetBoardId) return;
    prevFollowedBoardIdRef.current = targetBoardId;

    if (targetBoardId !== null && targetBoardId !== activeBoardId) {
      // Find the board element to get its title
      const boardEl = canvasElements.find((el) => el.id === targetBoardId);
      const boardTitle = (boardEl as any)?.title ?? 'Board';
      enterBoard(targetBoardId, boardTitle);
    } else if (targetBoardId === null && activeBoardId !== null) {
      exitBoard();
    }
  }, [followedCollaborator, activeBoardId, canvasElements, enterBoard, exitBoard]);

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
        const source = canvasElements.find((el) => el.id === id);
        if (source?.type === "freeform" && !canResizeFreeformCard(source)) {
          syncUpdateElement(
            id,
            sanitizeFreeformResizeUpdate(
              source,
              update as Partial<typeof source>,
            ) as Partial<CanvasElement>,
          );
          return;
        }
        syncUpdateElement(id, update);
      });
    },
    [pushCanvasHistory, syncUpdateElement, canvasElements]
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

      // Propagate parent (sourceElement) hypercubeTags to child (newShape) — union, no overwrite
      if (sourceElement.hypercubeTags?.length) {
        const existingTags = newShape.hypercubeTags ?? [];
        const unionTags = Array.from(new Set([...existingTags, ...sourceElement.hypercubeTags]));
        if (unionTags.length !== existingTags.length) {
          syncUpdateElement(newShape.id, { hypercubeTags: unionTags });
        }
      }

      // Select the new shape
      setSelectedElementId(newShape.id);
      setSelectedElementIds(new Set([newShape.id]));
    },
    [canvasElements, activeBoardId, activeSurface, pushCanvasHistory, syncAddElement, syncAddEdge, syncUpdateElement]
  );

  // Drag and drop file handling
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/')
      );

      if (files.length === 0) return;

      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const dropX = (e.clientX - rect.left - canvasPosition.x) / canvasZoom;
      const dropY = (e.clientY - rect.top - canvasPosition.y) / canvasZoom;

      // Calculate grid layout for multiple images
      const gridCols = Math.ceil(Math.sqrt(files.length));
      const spacing = 60; // Increased spacing between images
      const imageSize = 200;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;

        const x = dropX + col * (imageSize + spacing);
        const y = dropY + row * (imageSize + spacing);

        // Create image element
        const newElement: CanvasElement = {
          id: uuidv4(),
          type: 'image',
          x,
          y,
          width: imageSize,
          height: imageSize,
          src: '', // Will be updated after upload
          alt: file.name,
          boardId: activeBoardId || undefined,
          surface: activeSurface || 'main',
          zIndex: 1,
        };

        syncAddElement(newElement);

        // Upload the image
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

          // Convert to blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/webp", 0.8);
          });

          // Upload to Supabase Storage
          const supabase = (await import('../../../supabase/client')).createClient();
          const fileName = `canvas-images/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.webp`;

          const { data, error } = await supabase.storage
            .from("canvas-uploads")
            .upload(fileName, blob, {
              contentType: "image/webp",
              cacheControl: "3600",
            });

          if (error) {
            console.error("Upload error:", error);
            syncRemoveElement(newElement.id);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("canvas-uploads")
            .getPublicUrl(data.path);

          // Calculate element dimensions based on image aspect ratio
          const maxElementWidth = 400;
          const maxElementHeight = 400;
          const aspectRatio = width / height;

          let elementWidth = width;
          let elementHeight = height;

          if (elementWidth > maxElementWidth) {
            elementWidth = maxElementWidth;
            elementHeight = elementWidth / aspectRatio;
          }

          if (elementHeight > maxElementHeight) {
            elementHeight = maxElementHeight;
            elementWidth = elementHeight * aspectRatio;
          }

          const minSize = 100;
          if (elementWidth < minSize) {
            elementWidth = minSize;
            elementHeight = elementWidth / aspectRatio;
          }

          // Update element with image data
          syncUpdateElement(newElement.id, {
            src: urlData.publicUrl,
            imageMeta: {
              width,
              height,
              bytes: blob.size,
              originalName: file.name,
            },
            width: Math.round(elementWidth),
            height: Math.round(elementHeight),
          });
        } catch (error) {
          console.error('Failed to upload image:', error);
          syncRemoveElement(newElement.id);
        }
      }
    },
    [canvasPosition, canvasZoom, activeBoardId, activeSurface, syncAddElement, syncUpdateElement, syncRemoveElement],
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
        : isSpacePressed
          ? "cursor-grab"
          : draggingElement
            ? "cursor-move"
            : "cursor-default w-full h-full"
        }`}
      style={{ right: canvasRightMargin, background: canvasBackground }}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleCanvasMouseMove}
      onMouseUp={handleCanvasMouseUp}
      onMouseLeave={() => {
        handleCanvasMouseUp();
        clearCursor?.();
      }}
      onContextMenu={(e) => {
        // Check if right-clicking on an element
        const target = e.target as HTMLElement;
        const elementDiv = target.closest('[data-node-id]');

        if (elementDiv) {
          // Right-click on element
          const elementId = elementDiv.getAttribute('data-node-id');
          if (elementId) {
            setSelectedElementId(elementId);
            if (!selectedElementIds.has(elementId)) {
              setSelectedElementIds(new Set([elementId]));
            }
            setContextMenuPos({ x: e.clientX, y: e.clientY });
            setContextMenuTarget({ type: 'element', elementId });
          }
        }
        // Canvas right-click is handled in handleCanvasMouseDown
        e.preventDefault();
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Canvas Background - covers container, used for click detection */}
      <div
        className="canvas-background absolute inset-0 pointer-events-none"
      />
      {/* Live-follow gradient border overlay — shows a colored glow/ring while following a collaborator */}
      {followedCollaborator && (
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            zIndex: 9997,
            boxShadow: `inset 0 0 0 3px ${followedCollaborator.color}, inset 0 0 60px ${followedCollaborator.color}33`,
          }}
        />
      )}
      {/* Dot grid - rendered inside canvas transform for perfect alignment */}
      {settings.gridVisible && (
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
            // Layered grid: Major dots (3x grid) + Medium dots (1x grid) + Minor dots (0.5x grid)
            backgroundImage: `
              radial-gradient(circle, hsl(270 30% 29% / 0.6) 1.5px, transparent 1.5px),
              radial-gradient(circle, hsl(270 30% 28% / 0.4) 1px, transparent 1px),
              radial-gradient(circle, hsl(270 30% 22% / 0.25) 0.5px, transparent 0.5px)
            `,
            backgroundSize: `${settings.gridSize * 3}px ${settings.gridSize * 3}px, ${settings.gridSize}px ${settings.gridSize}px, ${settings.gridSize / 2}px ${settings.gridSize / 2}px`,
            backgroundPosition: "0 0, 0 0, 0 0",
          }}
        />
      )}

      {/* Collaborator Cursors Overlay - highest z-index */}
      {collaborators.length > 0 && (
        <CollaboratorCursors
          collaborators={collaborators}
          canvasOffset={{ x: canvasPosition.x, y: canvasPosition.y }}
          zoom={canvasZoom}
          currentBoardId={activeBoardId ?? null}
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
                // Don't select when space is held (hand/pan tool active)
                if (isSpacePressed) return;
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
              snapToGrid={snapToGrid}
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

        {/* Remote selection rings — show which elements other collaborators have selected */}
        {collaborators.map((collaborator) =>
          (collaborator.selection?.elementIds ?? []).map((elementId) => {
            const el = canvasElements.find((e) => e.id === elementId);
            if (!el) return null;
            return (
              <div
                key={`${collaborator.id}-${elementId}`}
                className="pointer-events-none absolute"
                style={{
                  left: el.x - 3,
                  top: el.y - 3,
                  width: el.width + 6,
                  height: el.height + 6,
                  border: `2px solid ${collaborator.color}`,
                  borderRadius: 6,
                  boxShadow: `0 0 0 1px ${collaborator.color}40`,
                  zIndex: 9990,
                }}
              >
                {/* Collaborator name tag */}
                <span
                  className="absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white leading-none"
                  style={{ backgroundColor: collaborator.color }}
                >
                  {collaborator.name}
                </span>
              </div>
            );
          })
        )}

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
        onDuplicateLine={handleDuplicateLine}
        canvasPosition={canvasPosition}
        canvasZoom={canvasZoom}
        isLineToolActive={activeTool === "line"}
        onLineToolComplete={() => setActiveTool(null)}
        containerRef={containerRef}
        onOperationStart={pushCanvasHistory}
      />
      {/* Per-edge SVGs — each at computed z-index above its connected elements */}
      {canvasEdges.map((edge) => {
        const fromElement = elementsById[edge.fromNodeId];
        const toElement = elementsById[edge.toNodeId];
        if (!fromElement || !toElement) return null;

        const { from, to } = getResolvedEdgePoints(edge, fromElement, toElement);
        if (!from || !to) return null;

        const isSelected = selectedEdgeId === edge.id;
        const isHovered = hoveredEdgeId === edge.id;
        const strokeColor = edge.style?.color || "hsl(180 100% 50% / 0.8)";

        const bend = edge.bend || { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        const pathD = `M ${from.x} ${from.y} Q ${bend.x} ${bend.y} ${to.x} ${to.y}`;

        // Midpoint on bezier curve at t=0.5
        const nodeX = 0.25 * from.x + 0.5 * bend.x + 0.25 * to.x;
        const nodeY = 0.25 * from.y + 0.5 * bend.y + 0.25 * to.y;
        const isMidHovered = hoveredMidpointEdgeId === edge.id;

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
          switch (edge.style?.startCap || 'none') {
            case 'arrow': return `url(#${markerIds.arrowStart})`;
            case 'dot': return `url(#${markerIds.dotStart})`;
            case 'diamond': return `url(#${markerIds.diamondStart})`;
            case 'square': return `url(#${markerIds.squareStart})`;
            default: return undefined;
          }
        };

        const labelPosition = edge.label?.position ?? 0.5;
        const t = labelPosition;
        const labelPoint = {
          x: (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * bend.x + t * t * to.x,
          y: (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * bend.y + t * t * to.y,
        };

        // Z-index: above connected elements, below unrelated higher-z elements
        const connectedMaxZ = Math.max(fromElement.zIndex ?? 0, toElement.zIndex ?? 0);
        const edgeZIndex = connectedMaxZ + 0.5;

        return (
          <div
            key={edge.id}
            className="absolute pointer-events-none"
            style={{
              transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
              transformOrigin: "0 0",
              zIndex: edgeZIndex,
            }}
          >
            <svg
              className="absolute overflow-visible"
              style={{ width: 1, height: 1, left: 0, top: 0, pointerEvents: "none" }}
            >
              <defs>
                <marker id={markerIds.arrowEnd} markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                  <polygon points="0 0, 10 3.5, 0 7" fill={strokeColor} />
                </marker>
                <marker id={markerIds.arrowStart} markerWidth="10" markerHeight="7" refX="2" refY="3.5" orient="auto-start-reverse">
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
              {/* Invisible wide click target */}
              <path
                d={pathD}
                stroke="transparent"
                strokeWidth={12}
                fill="none"
                style={{ pointerEvents: "auto", cursor: "pointer" }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedEdgeId(edge.id);
                  setSelectedElementId(null);
                  setSelectedElementIds(new Set());
                }}
                onMouseEnter={() => setHoveredEdgeId(edge.id)}
                onMouseLeave={() => setHoveredEdgeId(null)}
              />
              {/* Visible connector path */}
              <path
                d={pathD}
                stroke={strokeColor}
                strokeWidth={isSelected ? (edge.style?.thickness || 2) + 1 : edge.style?.thickness || 2}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={
                  edge.style?.lineStyle === "dashed" ? "8,4"
                  : edge.style?.lineStyle === "dotted" ? "2,4"
                  : undefined
                }
                markerStart={getMarkerStart()}
                markerEnd={getMarkerEnd()}
                style={{
                  filter: isSelected
                    ? "drop-shadow(0 0 4px rgba(167,139,250,0.45))"
                    : isHovered
                    ? `drop-shadow(0 0 3px ${strokeColor})`
                    : undefined,
                }}
                className="pointer-events-none"
              />
              {/* Text label */}
              {edge.label?.text && (
                <g className="pointer-events-none">
                  <rect x={labelPoint.x - 30} y={labelPoint.y - 10} width={60} height={20} rx={4} fill="hsl(var(--card))" fillOpacity={0.9} />
                  <text x={labelPoint.x} y={labelPoint.y + 4} textAnchor="middle" fill={edge.label.color || "hsl(var(--foreground))"} fontSize={edge.label.fontSize || 12} fontFamily={edge.label.fontFamily || "inherit"} className="select-none">
                    {edge.label.text}
                  </text>
                </g>
              )}
              {/* Always-visible midpoint circle node */}
              <g
                style={{ pointerEvents: "auto", cursor: "grab" }}
                onMouseDown={(e) => { e.stopPropagation(); startBendDrag(e, edge); }}
                onMouseEnter={() => setHoveredMidpointEdgeId(edge.id)}
                onMouseLeave={() => setHoveredMidpointEdgeId(null)}
              >
                {isSelected && <circle cx={nodeX} cy={nodeY} r={9} fill="none" stroke="white" strokeWidth={1.5} />}
                <circle cx={nodeX} cy={nodeY} r={isMidHovered ? 8.5 : 7} fill={strokeColor} opacity={0.9}
                  style={{ filter: isMidHovered ? `drop-shadow(0 0 4px ${strokeColor})` : undefined }} />
                <circle cx={nodeX} cy={nodeY} r={4.5} fill="#0f0f0f" />
              </g>
            </svg>
          </div>
        );
      })}

      {/* Connector preview while drawing */}
      {isConnecting && connectingFrom && connectorPreview && (
        <div
          className="absolute pointer-events-none"
          style={{
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
            transformOrigin: "0 0",
            zIndex: 9998,
          }}
        >
          <svg className="absolute overflow-visible" style={{ width: 1, height: 1, left: 0, top: 0, pointerEvents: "none" }}>
            <line
              x1={(() => { const el = elementsById[connectingFrom.elementId]; return el ? getAnchorPosition(el, connectingFrom.anchor).x : 0; })()}
              y1={(() => { const el = elementsById[connectingFrom.elementId]; return el ? getAnchorPosition(el, connectingFrom.anchor).y : 0; })()}
              x2={connectorPreview.x}
              y2={connectorPreview.y}
              stroke="hsl(180 100% 50% / 0.6)"
              strokeWidth={2}
              strokeDasharray="8,4"
            />
          </svg>
        </div>
      )}

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
            <span className="text-sm">Drop to place on canvas</span>
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

      {/* Context Menu */}
      {contextMenuPos && contextMenuTarget && (
        <CanvasContextMenu
          position={contextMenuPos}
          target={contextMenuTarget}
          onClose={() => {
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          onCreateElement={(type: CanvasElementType) => {
            if (containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const x = (contextMenuPos.x - rect.left - canvasPosition.x) / canvasZoom;
              const y = (contextMenuPos.y - rect.top - canvasPosition.y) / canvasZoom;

              const baseElement = {
                id: uuidv4(),
                type,
                x,
                y,
                width: DEFAULT_ELEMENT_SIZES[type].width,
                height: DEFAULT_ELEMENT_SIZES[type].height,
                boardId: activeBoardId || undefined,
                surface: activeSurface || 'main',
                zIndex: 1,
              };

              // Add type-specific properties
              let newElement: CanvasElement;
              switch (type) {
                case 'text':
                  newElement = { ...baseElement, type: 'text', content: '' };
                  break;
                case 'image':
                  newElement = { ...baseElement, type: 'image', src: '', alt: '' };
                  break;
                case 'shape':
                  newElement = { ...baseElement, type: 'shape', shapeType: 'rectangle' as ShapeType, style: {} };
                  break;
                case 'link':
                  newElement = { ...baseElement, type: 'link', url: '', title: '', linkMode: 'embed' };
                  break;
                case 'container':
                  newElement = { ...baseElement, type: 'container' };
                  break;
                case 'board':
                  newElement = { ...baseElement, type: 'board', title: 'Board', icon: '📋', childBoardId: uuidv4() };
                  break;
                default:
                  newElement = { ...baseElement, type: 'freeform', content: '' };
              }

              syncAddElement(newElement);
              setSelectedElementId(newElement.id);
            }
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          onCopy={() => {
            if (selectedElementId) {
              const element = canvasElements.find(el => el.id === selectedElementId);
              if (element) {
                setClipboard([element]);
              }
            } else if (selectedElementIds.size > 0) {
              const elements = canvasElements.filter(el => selectedElementIds.has(el.id));
              setClipboard(elements);
            }
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          onCut={() => {
            if (selectedElementId) {
              const element = canvasElements.find(el => el.id === selectedElementId);
              if (element) {
                setClipboard([element]);
                syncRemoveElement(selectedElementId);
              }
            } else if (selectedElementIds.size > 0) {
              const elements = canvasElements.filter(el => selectedElementIds.has(el.id));
              setClipboard(elements);
              elements.forEach(el => syncRemoveElement(el.id));
            }
            setSelectedElementId(null);
            setSelectedElementIds(new Set());
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          onPaste={() => {
            if (clipboard.length > 0 && containerRef.current) {
              const rect = containerRef.current.getBoundingClientRect();
              const pasteX = (contextMenuPos.x - rect.left - canvasPosition.x) / canvasZoom;
              const pasteY = (contextMenuPos.y - rect.top - canvasPosition.y) / canvasZoom;

              const newIds = clipboard.map((el, i) => {
                const newElement = {
                  ...el,
                  id: uuidv4(),
                  x: pasteX + i * 20,
                  y: pasteY + i * 20,
                };
                syncAddElement(newElement);
                return newElement.id;
              });

              setSelectedElementIds(new Set(newIds));
              if (newIds.length > 0) {
                setSelectedElementId(newIds[0]);
              }
            }
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          onDuplicate={() => {
            if (selectedElementId) {
              const element = canvasElements.find(el => el.id === selectedElementId);
              if (element) {
                const newElement = {
                  ...element,
                  id: uuidv4(),
                  x: element.x + 20,
                  y: element.y + 20,
                };
                syncAddElement(newElement);
                setSelectedElementId(newElement.id);
              }
            } else if (selectedElementIds.size > 0) {
              const newIds: string[] = [];
              selectedElementIds.forEach(id => {
                const element = canvasElements.find(el => el.id === id);
                if (element) {
                  const newElement = {
                    ...element,
                    id: uuidv4(),
                    x: element.x + 20,
                    y: element.y + 20,
                  };
                  syncAddElement(newElement);
                  newIds.push(newElement.id);
                }
              });
              setSelectedElementIds(new Set(newIds));
              if (newIds.length > 0) {
                setSelectedElementId(newIds[0]);
              }
            }
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          onDelete={() => {
            if (selectedElementId) {
              syncRemoveElement(selectedElementId);
              setSelectedElementId(null);
            } else if (selectedElementIds.size > 0) {
              selectedElementIds.forEach(id => syncRemoveElement(id));
              setSelectedElementIds(new Set());
            }
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
          hasSelection={!!(selectedElementId || selectedElementIds.size > 0)}
          hasClipboard={clipboard.length > 0}
          multipleSelected={selectedElementIds.size >= 2}
          isImageSelected={(() => {
            if (selectedElementId) {
              const element = canvasElements.find(el => el.id === selectedElementId);
              return element?.type === 'image';
            }
            return false;
          })()}
          onConnectSelected={() => { connectSelectedElements(); setContextMenuPos(null); setContextMenuTarget(null); }}
          onAutoOrganize={() => { autoOrganizeSelected(); setContextMenuPos(null); setContextMenuTarget(null); }}
          onDownloadImage={async () => {
            if (selectedElementId) {
              const element = canvasElements.find(el => el.id === selectedElementId);
              if (element && element.type === 'image' && (element as any).src) {
                try {
                  const response = await fetch((element as any).src);
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = (element as any).imageMeta?.originalName || 'image.png';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Failed to download image:', error);
                }
              }
            }
            setContextMenuPos(null);
            setContextMenuTarget(null);
          }}
        />
      )}

      {/* Clipboard Paste Dialog - shown when pasting text or links */}
      {clipboardPasteDialog && (
        <ClipboardPasteDialog
          dialog={clipboardPasteDialog}
          onClose={() => setClipboardPasteDialog(null)}
          onConfirm={(choice) => {
            setClipboardPasteDialog(null);
            const d = clipboardPasteDialog;
            pushCanvasHistory();

            if (d.kind === 'text') {
              if (choice === 'note') {
                const base = makeElementBase('freeform', d.canvasX, d.canvasY);
                syncAddElement({
                  ...base,
                  type: 'freeform',
                  cardType: 'note',
                  noteTitle: 'Pasted Note',
                  noteBody: d.text,
                  emoji: '📌',
                  style: {
                    bgColor: 'linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)',
                    textColor: '#ffffff',
                  },
                } as any);
                setSelectedElementId(base.id);
                setSelectedElementIds(new Set([base.id]));
              } else {
                // floating text
                const base = makeElementBase('text', d.canvasX, d.canvasY);
                syncAddElement({
                  ...base,
                  type: 'text',
                  content: d.text,
                  style: { fontSize: 20 },
                } as any);
                setSelectedElementId(base.id);
                setSelectedElementIds(new Set([base.id]));
              }
            } else if (d.kind === 'link') {
              const linkMode = choice as 'bookmark' | 'embed';
              const base = makeElementBase('link', d.canvasX, d.canvasY);
              syncAddElement({
                ...base,
                type: 'link',
                url: d.url,
                linkMode,
                ...(linkMode === 'embed' && { width: 480, height: 360 }),
              } as any);
              setSelectedElementId(base.id);
              setSelectedElementIds(new Set([base.id]));
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Clipboard Paste Dialog ────────────────────────────────────────────────────

function ClipboardPasteDialog({
  dialog,
  onClose,
  onConfirm,
}: {
  dialog: { kind: 'text'; text: string } | { kind: 'link'; url: string };
  onClose: () => void;
  onConfirm: (choice: string) => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4">
        {dialog.kind === 'text' ? (
          <>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Paste text as…</h3>
              <p className="text-xs text-muted-foreground line-clamp-3 break-all">{dialog.text}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                autoFocus
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/50 transition-colors text-left"
                onClick={() => onConfirm('note')}
              >
                <span className="text-xl">📌</span>
                <div>
                  <div className="text-sm font-medium">Note</div>
                  <div className="text-xs text-muted-foreground">Paste into a note card body</div>
                </div>
              </button>
              <button
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/50 transition-colors text-left"
                onClick={() => onConfirm('floating')}
              >
                <span className="text-xl">T</span>
                <div>
                  <div className="text-sm font-medium">Floating text</div>
                  <div className="text-xs text-muted-foreground">Add as a text element on canvas</div>
                </div>
              </button>
            </div>
          </>
        ) : (
          <>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Paste link as…</h3>
              <p className="text-xs text-muted-foreground truncate">{dialog.url}</p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                autoFocus
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/50 transition-colors text-left"
                onClick={() => onConfirm('bookmark')}
              >
                <span className="text-xl">🔖</span>
                <div>
                  <div className="text-sm font-medium">Bookmark</div>
                  <div className="text-xs text-muted-foreground">Show as a link card with preview</div>
                </div>
              </button>
              <button
                className="flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:bg-primary/10 hover:border-primary/50 transition-colors text-left"
                onClick={() => onConfirm('embed')}
              >
                <span className="text-xl">🖼️</span>
                <div>
                  <div className="text-sm font-medium">Embed</div>
                  <div className="text-xs text-muted-foreground">Display inline in an iframe</div>
                </div>
              </button>
            </div>
          </>
        )}
        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors self-center"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
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
