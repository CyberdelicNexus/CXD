"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import NextImage from "next/image";
import { createPortal } from "react-dom";
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
  HypercubeFaceTag,
  HYPERCUBE_FACE_TAGS,
  ElementStyle,
} from "@/types/canvas-elements";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCXDStore } from "@/store/cxd-store";
import {
  CXDProject,
  REALITY_PLANES,
  DEFAULT_REALITY_PLANES_V2,
  SENSORY_DOMAINS,
  PRESENCE_TYPES,
} from "@/types/cxd-schema";
import { RealityPlanesEditor } from "@/components/cxd/reality-planes-editor";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  GripVertical,
  Trash2,
  Copy,
  ImageIcon,
  Link2,
  Upload,
  ExternalLink,
  ExternalLink as ExternalLinkIcon,
  Globe,
  Code,
  Bookmark,
  LayoutGrid,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Highlighter,
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
  Lock,
  Unlock,
  X,
  Minus,
  Maximize2,
  Crop,
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  CheckCircle2,
  Plus,
  ArrowUpRight,
  Ear,
  Wind,
  Apple,
  Fingerprint,
  PersonStanding,
  Zap,
  Eye,
  Brain,
  Users,
  Inbox,
  CaseSensitive,
  ChevronDown,
  ListTodo,
  Calendar,
  Tag,
  AlertCircle,
  Download,
  ALargeSmall,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import { createClient } from "../../../../supabase/client";
import { AssigneeMultiSelect } from "@/components/cxd/plan/assignee-multi-select";
import { parseAssignees, serializeAssignees } from "@/components/cxd/plan/assignee-utils";
import { NoteRichTextEditor } from "@/components/cxd/canvas/note-rich-text-editor";
import {
  canResizeFreeformCard,
  getFreeformCardType,
  isNoteCard,
} from "@/components/cxd/canvas/card-type-utils";
import { FloatingPort } from "./floating-port";
import DOMPurify from "dompurify";

// Hypercube tag icons mapping (defined at top for use in JSX)
const HYPERCUBE_TAG_ICONS: Record<HypercubeFaceTag, string> = {
  "Reality Planes": "🌐",
  "Sensory Domains": "👁️",
  "Presence Types": "🧘",
  "State Mapping": "🎭",
  "Trait Mapping": "💫",
  "Meaning Architecture": "🏛️",
  "Core": "🎯",
};

const SENSORY_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  visual: { icon: <Eye className="w-4 h-4" />, color: "from-blue-950 to-blue-400", colorRaw: "59, 130, 246" },
  auditory: { icon: <Ear className="w-4 h-4" />, color: "from-indigo-950 to-indigo-400", colorRaw: "99, 102, 241" },
  olfactory: { icon: <Wind className="w-4 h-4" />, color: "from-teal-950 to-teal-400", colorRaw: "20, 184, 166" },
  gustatory: { icon: <Apple className="w-4 h-4" />, color: "from-rose-950 to-rose-400", colorRaw: "244, 63, 94" },
  haptic: { icon: <Fingerprint className="w-4 h-4" />, color: "from-purple-950 to-purple-400", colorRaw: "168, 85, 247" },
};

const PRESENCE_METADATA: Record<string, { icon: React.ReactNode; color: string; colorRaw: string }> = {
  mental: { icon: <Brain className="w-4 h-4" />, color: "from-blue-950 to-blue-400", colorRaw: "59, 130, 246" },
  emotional: { icon: <Heart className="w-4 h-4" />, color: "from-red-950 to-red-400", colorRaw: "239, 68, 68" },
  social: { icon: <Users className="w-4 h-4" />, color: "from-violet-950 to-violet-400", colorRaw: "139, 92, 246" },
  embodied: { icon: <PersonStanding className="w-4 h-4" />, color: "from-orange-950 to-orange-400", colorRaw: "249, 115, 22" },
  environmental: { icon: <Globe className="w-4 h-4" />, color: "from-emerald-950 to-emerald-400", colorRaw: "16, 185, 129" },
  active: { icon: <Zap className="w-4 h-4" />, color: "from-yellow-950 to-yellow-400", colorRaw: "234, 179, 8" },
};

/**
 * Hook to prevent cursor-jump in controlled inputs.
 * Keeps a local copy of the value so React never resets the cursor
 * when the store round-trips the value back during editing.
 * While the input is "active" (between first change and blur), external
 * syncs are fully suppressed — only local state drives the input value.
 */
function useLocalInput(externalValue: string, onChange: (v: string) => void) {
  const [value, setValue] = useState(externalValue);
  const lastSent = useRef(externalValue);
  // When true, the user is actively editing — suppress ALL external syncs
  const isActive = useRef(false);

  // Sync from external only when not actively editing
  if (!isActive.current && externalValue !== lastSent.current) {
    lastSent.current = externalValue;
    setValue(externalValue);
  }

  const handleChange = useCallback(
    (v: string) => {
      isActive.current = true;
      setValue(v);
      lastSent.current = v;
      onChange(v);
    },
    [onChange],
  );

  // Call this on blur to re-enable external syncs
  const handleBlur = useCallback(() => {
    isActive.current = false;
    // Sync to latest external value in case it changed while we were editing
    // (e.g. collaboration). We don't call setValue here — the next render
    // cycle will pick it up via the sync check above.
  }, []);

  return [value, handleChange, handleBlur] as const;
}

interface CanvasElementRendererProps {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDragStart: (e: React.MouseEvent) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isSelected: boolean;
  isMultiSelected?: boolean; // True when multiple elements are selected (hide individual context menu)
  isDropTarget?: boolean;
  isHighlighted?: boolean;
  onSelect: (e?: React.MouseEvent) => void;
  canvasZoom: number;
  onEnterBoard?: (boardId: string, title: string) => void;
  onStartConnector?: (
    elementId: string,
    anchor: "top" | "right" | "bottom" | "left",
    anchorOffset?: number,
  ) => void;
  onEndConnector?: (
    toElementId: string,
    toAnchor: "top" | "right" | "bottom" | "left",
  ) => void;
  isConnecting?: boolean;
  showConnectorAnchors?: boolean;
  isHoverTarget?: boolean;
  onOpenExperiencePanel?: (sectionId: InspectorSectionId) => void;
  hoveredAnchor?: string | null;
  onAnchorHover?: (anchor: string | null) => void;
  onSendToInbox?: () => void; // Send task to inbox
  onCreateConnectedShape?: (direction: "top" | "right" | "bottom" | "left") => void; // Create connected shape
  isReadOnly?: boolean;
  snapToGrid?: boolean;
  /** Optional data-tour-id attribute for onboarding tour targeting */
  tourId?: string;
  /** Show hover outline for group individual select (when Ctrl is held) */
  showGroupHover?: boolean;
}

export function CanvasElementRenderer({
  element,
  onUpdate: onUpdateProp,
  onDelete,
  onDuplicate,
  onDragStart,
  onDragEnd,
  isDragging,
  isSelected,
  isMultiSelected = false,
  isDropTarget,
  isHighlighted,
  onSelect,
  canvasZoom,
  onEnterBoard,
  onStartConnector,
  onEndConnector,
  isConnecting,
  showConnectorAnchors = false,
  isHoverTarget,
  onOpenExperiencePanel,
  hoveredAnchor,
  onAnchorHover,
  onSendToInbox,
  onCreateConnectedShape,
  isReadOnly = false,
  snapToGrid = false,
  tourId,
  showGroupHover,
}: CanvasElementRendererProps) {
  // Stabilize onUpdate via ref so that effects and sub-component callbacks
  // that depend on onUpdate don't re-fire just because the parent re-rendered
  // with a new inline arrow function reference.
  const onUpdateRef = useRef(onUpdateProp);
  useEffect(() => { onUpdateRef.current = onUpdateProp; });
  const onUpdate = useCallback((updates: Partial<CanvasElement>) => {
    onUpdateRef.current(updates);
  }, []); // stable — never recreated

  // Get canvas elements for z-index calculations
  const getCanvasElements = useCXDStore((state) => state.getCanvasElements);
  // Get pushCanvasHistory for undo support on resize operations
  const pushCanvasHistory = useCXDStore((state) => state.pushCanvasHistory);

  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkViewMenu, setShowLinkViewMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showBoardIconPicker, setShowBoardIconPicker] = useState(false);
  const [showBoardColorPicker, setShowBoardColorPicker] = useState(false);
  const [showExperienceViewMenu, setShowExperienceViewMenu] = useState(false);
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [showShapeTypePicker, setShowShapeTypePicker] = useState(false);
  const [showTextStyleMenu, setShowTextStyleMenu] = useState(false);
  const [colorPickerDefaultMode, setColorPickerDefaultMode] = useState<"fill" | "stroke" | "text">("fill");
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<string | null>(null);
  const [showTaskPriorityMenu, setShowTaskPriorityMenu] = useState(false);
  const [isAddingTaskTag, setIsAddingTaskTag] = useState(false);
  const [newTaskTag, setNewTaskTag] = useState('');
  const elementRef = useRef<HTMLDivElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const subtaskRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const taskPriorityMenuRef = useRef<HTMLDivElement>(null);

  // Helper to close all submenus - ensures only one submenu is open at a time
  const closeAllSubmenus = useCallback(() => {
    setShowColorPicker(false);
    setShowLinkViewMenu(false);
    setShowEmojiPicker(false);
    setShowBoardIconPicker(false);
    setShowBoardColorPicker(false);
    setShowExperienceViewMenu(false);
    setShowTagMenu(false);
    setShowShapeTypePicker(false);
    setShowTextStyleMenu(false);
    setShowTaskPriorityMenu(false);
  }, []);

  // Submenu openers that close others first
  const openColorPicker = useCallback(() => {
    closeAllSubmenus();
    setShowColorPicker(true);
  }, [closeAllSubmenus]);

  const openLinkViewMenu = useCallback(() => {
    closeAllSubmenus();
    setShowLinkViewMenu(true);
  }, [closeAllSubmenus]);

  const openEmojiPicker = useCallback(() => {
    closeAllSubmenus();
    setShowEmojiPicker(true);
  }, [closeAllSubmenus]);

  const openBoardIconPicker = useCallback(() => {
    closeAllSubmenus();
    setShowBoardIconPicker(true);
  }, [closeAllSubmenus]);

  const openBoardColorPicker = useCallback(() => {
    closeAllSubmenus();
    setShowBoardColorPicker(true);
  }, [closeAllSubmenus]);

  const openExperienceViewMenu = useCallback(() => {
    closeAllSubmenus();
    setShowExperienceViewMenu(true);
  }, [closeAllSubmenus]);

  const openTagMenu = useCallback(() => {
    closeAllSubmenus();
    setShowTagMenu(true);
  }, [closeAllSubmenus]);

  // Close all submenus when element is deselected
  useEffect(() => {
    if (!isSelected) closeAllSubmenus();
  }, [isSelected, closeAllSubmenus]);

  // Close all submenus when clicking outside
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      // Check if any menu is open
      const anyMenuOpen =
        showColorPicker ||
        showLinkViewMenu ||
        showEmojiPicker ||
        showBoardIconPicker ||
        showBoardColorPicker ||
        showExperienceViewMenu ||
        showTagMenu ||
        showTaskPriorityMenu;

      if (!anyMenuOpen) return;

      // Check if click is outside the element
      if (
        elementRef.current &&
        !elementRef.current.contains(e.target as Node)
      ) {
        // Close all menus
        setShowColorPicker(false);
        setShowLinkViewMenu(false);
        setShowEmojiPicker(false);
        setShowBoardIconPicker(false);
        setShowBoardColorPicker(false);
        setShowExperienceViewMenu(false);
        setShowTagMenu(false);
        setShowTaskPriorityMenu(false);
      }
    };

    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, [
    showColorPicker,
    showLinkViewMenu,
    showEmojiPicker,
    showBoardIconPicker,
    showBoardColorPicker,
    showExperienceViewMenu,
    showTagMenu,
    showTaskPriorityMenu,
  ]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (element.type === "board" && onEnterBoard) {
        const boardEl = element as BoardElement;
        onEnterBoard(boardEl.childBoardId, boardEl.title);
      } else if (element.type === "experienceBlock" && onOpenExperiencePanel) {
        const expEl = element as ExperienceBlockElement;
        onOpenExperiencePanel(expEl.componentKey);
      } else if (
        element.type !== "connector" &&
        element.type !== "line" &&
        element.type !== "experienceBlock"
      ) {
        // Allow editing for shapes and other elements (not lines, connectors, experience blocks)
        setIsEditing(true);

        // For task cards, clear placeholder on double-click if it's still the default
        if (element.type === "freeform" && element.taskMetadata && element.content === "Task Title") {
          onUpdate({ content: "" });
        }
      }
    },
    [element, onEnterBoard, onOpenExperiencePanel, onUpdate],
  );

  const handleBlur = useCallback((e?: React.FocusEvent) => {
    // Don't close editing if we're focusing another input in the same element
    const relatedTarget = e?.relatedTarget as HTMLElement | undefined;
    if (relatedTarget && elementRef.current?.contains(relatedTarget)) {
      return;
    }
    setIsEditing(false);
  }, []);

  // Close editing when clicking outside the element
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        elementRef.current &&
        !elementRef.current.contains(e.target as Node)
      ) {
        setIsEditing(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing]);

  // Auto-typing for shapes: when selected and user types, start editing
  useEffect(() => {
    if (element.type !== "shape" || !isSelected || isEditing || isReadOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in another input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true") return;

      // Ignore modifier keys and special keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.length !== 1 && e.key !== "Backspace" && e.key !== "Delete") return;

      // Start editing with the typed character
      e.preventDefault();
      e.stopPropagation();

      if (e.key === "Backspace" || e.key === "Delete") {
        // Clear content and start editing
        onUpdate({ content: "" });
      } else {
        // Start with the typed character
        onUpdate({ content: e.key });
      }
      setIsEditing(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [element.type, isSelected, isEditing, isReadOnly, onUpdate]);

  // Auto-resize experience blocks when view mode changes
  // NOTE: Avoid calling onUpdate during render (can trigger "Cannot update a component while rendering").
  // NOTE: Skip auto-resize if user has manually resized the element.
  const prevViewModeRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (element.type !== "experienceBlock") return;

    const expElement = element as ExperienceBlockElement;
    const viewMode = expElement.viewMode || "inline";

    // Skip auto-resize if user has manually resized
    if (expElement.manuallyResized) {
      prevViewModeRef.current = viewMode;
      return;
    }

    // Only auto-resize when viewMode actually changes, not on every render
    const viewModeChanged = prevViewModeRef.current !== undefined && prevViewModeRef.current !== viewMode;
    prevViewModeRef.current = viewMode;

    // Skip if this is just the initial render (not a viewMode change)
    if (!viewModeChanged && element.width > 0 && element.height > 0) return;

    // Inline height is measured from DOM content by ExperienceBlockCard — only enforce width here
    const nextSize =
      viewMode === "inline"
        ? { width: 420 }
        : { width: 220, height: 100 };

    // Only update if size differs
    const needsUpdate = viewMode === "inline"
      ? element.width !== nextSize.width
      : element.width !== nextSize.width || element.height !== (nextSize as any).height;

    if (!needsUpdate) return;

    // Defer to next tick and re-check against the latest element size to avoid render-phase updates
    const t = window.setTimeout(() => {
      const stillNeedsUpdate = viewMode === "inline"
        ? element.width !== nextSize.width
        : element.width !== nextSize.width || element.height !== (nextSize as any).height;
      if (stillNeedsUpdate) {
        onUpdate(nextSize);
      }
    }, 0);

    return () => window.clearTimeout(t);
  }, [
    element.type,
    (element as ExperienceBlockElement).viewMode,
    (element as ExperienceBlockElement).manuallyResized,
    element.width,
    element.height,
    onUpdate,
  ]);

  // Z-index management helpers - bring to front/send to back relative to all elements
  const handleBringForward = useCallback(() => {
    // Containers cannot be reordered — they always stay at the back
    if (element.type === 'container') return;
    const allElements = getCanvasElements();
    const maxZIndex = allElements.reduce(
      (max, el) => Math.max(max, Number.isFinite(el.zIndex) ? el.zIndex : 0),
      0
    );
    // Only update if not already at max
    if ((element.zIndex || 0) < maxZIndex) {
      pushCanvasHistory();
      onUpdate({ zIndex: maxZIndex + 1 });
    }
  }, [element.type, element.zIndex, onUpdate, getCanvasElements, pushCanvasHistory]);

  const handleSendBackward = useCallback(() => {
    // Containers cannot be reordered — they always stay at the back
    if (element.type === 'container') return;
    const allElements = getCanvasElements();
    // Non-container elements cannot go below the highest container z-index
    const maxContainerZ = allElements.reduce(
      (max, el) => el.type === 'container' ? Math.max(max, Number.isFinite(el.zIndex) ? el.zIndex : 0) : max,
      -Infinity
    );
    const minNonContainerZ = allElements.reduce(
      (min, el) => el.type !== 'container' ? Math.min(min, Number.isFinite(el.zIndex) ? el.zIndex : 0) : min,
      Infinity
    );
    const targetZ = minNonContainerZ - 1;
    // Don't go below containers
    const safeZ = Math.max(targetZ, maxContainerZ + 1);
    if ((element.zIndex || 0) > safeZ) {
      pushCanvasHistory();
      onUpdate({ zIndex: safeZ });
    }
  }, [element.type, element.zIndex, onUpdate, getCanvasElements, pushCanvasHistory]);

  // Handle drag from element body (not just the handle)
  const handleBodyMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Don't drag locked elements
      if (element.locked) {
        e.stopPropagation();
        return;
      }

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
            isSelected={isSelected}
            onStartEdit={() => setIsEditing(true)}
            className=" h-full"
          />
        );
      case "image":
        return (
          <ImageCard
            element={element}
            onUpdate={onUpdate}
            isSelected={isSelected}
            isReadOnly={isReadOnly}
          />
        );
      case "shape":
        return (
          <ShapeCard
            element={element}
            onUpdate={onUpdate}
            isEditing={isEditing}
            onBlur={handleBlur}
            isSelected={isSelected}
            onCreateConnectedShape={onCreateConnectedShape}
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
            isDropTarget={isDropTarget}
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
            isReadOnly={isReadOnly}
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
            onUpdate={onUpdate}
          />
        );
      default:
        return null;
    }
  };

  // Determine if this is a resizable note card (needed before hooks below)
  const freeformCardType =
    element.type === "freeform"
      ? getFreeformCardType(element as FreeformElement)
      : null;
  const isResizableNoteCard =
    element.type === "freeform" &&
    freeformCardType === "note" &&
    !(element as FreeformElement).isDocument;

  // For note cards: observe actual DOM height via ResizeObserver and sync to
  // element.height so the group reflow system always sees the real rendered size
  // (including when the editor is open and taller than the compact view).
  const lastObservedHeight = useRef(element.height);
  useEffect(() => {
    if (!isResizableNoteCard) return;
    const el = elementRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const h = Math.ceil(entry.contentRect.height);
      const next = Math.max(300, h);
      if (Math.abs(next - lastObservedHeight.current) > 3) {
        lastObservedHeight.current = next;
        onUpdate({ height: next });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isResizableNoteCard]); // eslint-disable-line react-hooks/exhaustive-deps

  // Don't render connectors as regular elements
  if (element.type === "connector") return null;

  return (
    <div
      ref={elementRef}
      data-element-id={element.id}
      {...(tourId ? { "data-tour-id": tourId } : {})}
      draggable={false}
      className={cn(
        "absolute group transition-shadow duration-200 pointer-events-auto",
        isDragging && !((element as FreeformElement).isDocument) && "opacity-80 shadow-2xl cursor-grabbing",
        isDragging && (element as FreeformElement).isDocument && "cursor-grabbing",
        // Locked state indicator
        element.locked && "opacity-60 cursor-not-allowed",
        // Ctrl+hover on grouped elements: show individual selection hint
        showGroupHover && "hover:ring-2 hover:ring-violet-400/50 hover:shadow-[0_0_12px_rgba(139,92,246,0.25)] cursor-pointer",
        // Highlight effect (from hypercube navigation) — soft 4s fade glow with 1s delay
        isHighlighted &&
        "ring-2 ring-purple-400/70 shadow-[0_0_24px_rgba(167,139,250,0.35)] animate-[highlightGlow_4s_cubic-bezier(0.4,0,0.2,1)_1s_forwards]",
        // Selection ring for non-text elements (excluding lines which handle their own visualization)
        isSelected &&
        !isHighlighted &&
        element.type !== "board" &&
        element.type !== "text" &&
        element.type !== "line" &&
        element.type !== "freeform" &&
        "ring-2 ring-primary shadow-[0_0_20px_rgba(168,85,247,0.3)]",
        // Selection ring for freeform cards - rounded (except documents)
        isSelected &&
        !isHighlighted &&
        element.type === "freeform" &&
        !(element as FreeformElement).isDocument &&
        "ring-2 ring-primary shadow-[0_0_20px_rgba(168,85,247,0.3)] rounded-lg",
        // Documents: no selection ring or outline
        element.type === "freeform" &&
        (element as FreeformElement).isDocument &&
        "ring-0 outline-none shadow-none",
        element.type === "freeform" &&
        freeformCardType === "note" &&
        "card--note-resizable",
        // Boards: no rectangular border/ring — the hexagon glow handles feedback
        element.type === "board" &&
        "ring-0 outline-none",
        // Glow when connector is hovering this element (not boards — they use hex glow)
        isHoverTarget &&
        !isHighlighted &&
        element.type !== "board" &&
        "ring-2 ring-green-400 shadow-[0_0_30px_rgba(74,222,128,0.6)]",
        // Subtle glow for text when editing
        isEditing &&
        element.type === "text" &&
        "shadow-[0_0_12px_rgba(168,85,247,0.15)]",
        // Cursor styles
        !isDragging &&
        !isEditing &&
        !element.locked &&
        element.type !== "text" &&
        element.type !== "line" &&
        "cursor-grab",
        !isDragging &&
        !isEditing &&
        element.type === "text" &&
        !element.locked &&
        "cursor-text h-full",
      )}
      style={{
        left: element.x,
        top: element.y,
        width:
          element.type === "freeform" && freeformCardType === "task"
            ? 300
            : element.width,
        minWidth:
          element.type === "freeform"
            ? (element as FreeformElement).isDocument
              ? "100px"
              : isResizableNoteCard
                ? "200px"
                : "300px"
            : undefined,
        maxWidth:
          element.type === "freeform"
            ? (element as FreeformElement).isDocument
              ? "100px"
              : !isResizableNoteCard
                ? "300px"
                : undefined
            : undefined,
        height:
          element.type === "container" && (element as ContainerElement).collapsed
            ? 28
            : element.type === "freeform"
            ? "auto"
            : element.height,
        minHeight:
          element.type === "freeform"
            ? (element as FreeformElement).isDocument
              ? "100px"
              : "300px"
            : undefined,
        zIndex: isSelected
          ? 2000000000  // Selected element always on top so toolbar/menus aren't hidden by other elements
          : Number.isFinite(element.zIndex) ? element.zIndex : 0,
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
      {/* Connection port - floating dot that slides along the nearest edge following the cursor */}
      {onStartConnector &&
        element.type !== "line" &&
        element.type !== "text" &&
        !(element.type === "freeform" && (element as FreeformElement).isDocument) && (
          <FloatingPort
            elementId={element.id}
            elementRef={elementRef as React.RefObject<HTMLDivElement | null>}
            isDragging={isDragging ?? false}
            isConnecting={isConnecting ?? false}
            canvasZoom={canvasZoom ?? 1}
            isShape={element.type === 'shape'}
            isContainer={element.type === 'container'}
            isCollapsed={
              element.type === 'container'
                ? (element as ContainerElement).collapsed ?? false
                : false
            }
            isFreeform={element.type === 'freeform'}
            isImage={element.type === 'image'}
            isBoard={element.type === 'board'}
            onStartConnector={onStartConnector}
            onEndConnector={onEndConnector ?? (() => {})}
          />
        )}
      {/* Unified context menu (hidden for line elements, multi-selection uses MultiSelectionBox) */}
      {isSelected && !isDragging && element.type !== "line" && !isReadOnly && !isMultiSelected && (
        /* Counter-rotation wrapper: un-rotates around element center so menu stays fixed above */
        <div
          className="absolute inset-0 pointer-events-none z-50"
          style={{
            transform: element.rotation ? `rotate(${-element.rotation}deg)` : undefined,
          }}
        >
        <div
          className={cn(
            "absolute left-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl pointer-events-auto",
            "bg-white/10 backdrop-blur-3xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          )}
          style={{
            top: -57,
            transform: `translateX(-50%) scale(${1 / canvasZoom})`,
            transformOrigin: 'center bottom',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Element-specific actions */}
          {element.type === "shape" && (
            <>
              {/* Color Picker (Fill/Stroke/Text unified) */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (showColorPicker) {
                      closeAllSubmenus();
                    } else {
                      setColorPickerDefaultMode("fill");
                      openColorPicker();
                    }
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
                    textColor={(element as ShapeElement).style?.textColor}
                    fontSize={(element as ShapeElement).style?.fontSize}
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
                    onTextColorChange={(color) =>
                      onUpdate({ style: { ...element.style, textColor: color } })
                    }
                    onFontSizeChange={(size) =>
                      onUpdate({ style: { ...element.style, fontSize: size } })
                    }
                    onClose={() => setShowColorPicker(false)}
                    defaultMode={colorPickerDefaultMode}
                  />
                )}
              </div>

              {/* Text Formatting Dropdown */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (showTextStyleMenu) {
                      closeAllSubmenus();
                    } else {
                      closeAllSubmenus();
                      setShowTextStyleMenu(true);
                    }
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showTextStyleMenu && "bg-primary/20 text-primary",
                  )}
                  title="Text Formatting"
                >
                  <Type className="w-4 h-4" />
                </button>
                {showTextStyleMenu && (
                  <ShapeTextStylePicker
                    style={(element as ShapeElement).style}
                    onStyleChange={(updates) =>
                      onUpdate({ style: { ...element.style, ...updates } })
                    }
                    onOpenColorPicker={() => {
                      setShowTextStyleMenu(false);
                      setColorPickerDefaultMode("text");
                      openColorPicker();
                    }}
                    onClose={() => setShowTextStyleMenu(false)}
                  />
                )}
              </div>

              <div className="w-px h-4 bg-border/50 mx-0.5" />

              {/* Shape Type Picker */}
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (showShapeTypePicker) {
                      closeAllSubmenus();
                    } else {
                      closeAllSubmenus();
                      setShowShapeTypePicker(true);
                    }
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showShapeTypePicker && "bg-primary/20 text-primary",
                  )}
                  title="Change Shape"
                >
                  {/* Hexagon icon for shape picker */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </button>
                {showShapeTypePicker && (
                  <ShapeTypePicker
                    currentType={(element as ShapeElement).shapeType}
                    onTypeSelect={(shapeType) => {
                      onUpdate({ shapeType } as Partial<CanvasElement>);
                      setShowShapeTypePicker(false);
                    }}
                    onClose={() => setShowShapeTypePicker(false)}
                  />
                )}
              </div>

            </>
          )}
          {element.type === "freeform" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    showColorPicker ? closeAllSubmenus() : openColorPicker();
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
                    showEmojiPicker ? closeAllSubmenus() : openEmojiPicker();
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
              {/* Mark as Task button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const isCurrentlyActionable = (element as FreeformElement)
                    .taskMetadata?.isActionable;
                  onUpdate({
                    taskMetadata: {
                      ...(element as FreeformElement).taskMetadata,
                      isActionable: !isCurrentlyActionable,
                    },
                  });
                }}
                className={cn(
                  "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                  (element as FreeformElement).taskMetadata?.isActionable &&
                  "bg-purple-500/20 text-purple-400",
                )}
                title={
                  (element as FreeformElement).taskMetadata?.isActionable
                    ? "Unmark as Task"
                    : "Mark as Task"
                }
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
              {/* Send to Inbox button */}
              {onSendToInbox &&
                element.type === "freeform" &&
                getFreeformCardType(element as FreeformElement) === "task" &&
                !(element as FreeformElement).isDocument && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSendToInbox();
                    }}
                    className={cn(
                      "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                      element.inInbox && "bg-cyan-500/20 text-cyan-400",
                    )}
                    title={element.inInbox ? "Already in Inbox" : "Send to Inbox"}
                  >
                    <Inbox className="w-4 h-4" />
                  </button>
                )}
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "link" &&
            (element as LinkElement).linkMode === "file" && (
              <>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      showLinkViewMenu ? closeAllSubmenus() : openLinkViewMenu();
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
                        onUpdate({
                          fileViewMode: mode,
                        } as Partial<CanvasElement>);
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
                    showBoardIconPicker ? closeAllSubmenus() : openBoardIconPicker();
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
                    showBoardColorPicker ? closeAllSubmenus() : openBoardColorPicker();
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
          {element.type === "container" && (
            <>
              {TINT_ORDER.map((name) => {
                const c = CONTAINER_TINTS[name];
                const isActive = (element as ContainerElement).tintColor === name ||
                  (!(element as ContainerElement).tintColor && name === 'violet');
                return (
                  <button
                    key={name}
                    title={name.charAt(0).toUpperCase() + name.slice(1)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({ tintColor: name } as Partial<CanvasElement>);
                    }}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid})`,
                      border: isActive ? '2px solid rgba(255,255,255,0.9)' : '2px solid rgba(255,255,255,0.15)',
                      boxShadow: isActive ? `0 0 6px ${c.mid}88` : 'none',
                      flexShrink: 0,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                    }}
                  />
                );
              })}
              <div className="w-px h-4 bg-border/50 mx-0.5" />
            </>
          )}
          {element.type === "experienceBlock" && (
            <>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    showColorPicker ? closeAllSubmenus() : openColorPicker();
                  }}
                  className={cn(
                    "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                    showColorPicker && "bg-primary/20 text-primary",
                  )}
                  title="Gradient"
                >
                  <Palette className="w-4 h-4" />
                </button>
                {showColorPicker && (
                  <GradientPicker
                    currentGradient={
                      (element as ExperienceBlockElement).style?.bgColor ||
                      "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)"
                    }
                    onGradientChange={(gradient) => {
                      onUpdate({
                        style: { ...(element.style || {}), bgColor: gradient },
                      });
                      setShowColorPicker(false);
                    }}
                    onClose={() => setShowColorPicker(false)}
                  />
                )}
              </div>
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    showExperienceViewMenu ? closeAllSubmenus() : openExperienceViewMenu();
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
                      (element as ExperienceBlockElement).viewMode || "inline"
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdate({ locked: !element.locked });
                }}
                className={cn(
                  "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                  element.locked && "bg-primary/20 text-primary",
                )}
                title={element.locked ? "Unlock Position" : "Lock Position"}
              >
                {element.locked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
              </button>
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
                    showColorPicker ? closeAllSubmenus() : openColorPicker();
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
          {/* Hypercube Tag - for taggable elements */}
          {/* NOTE: experienceBlock is NOT taggable - they correspond to cube faces */}
          {/* Cards (text, freeform), boards, containers, links, images ARE taggable */}
          {(element.type === "board" ||
            element.type === "container" ||
            element.type === "text" ||
            element.type === "freeform" ||
            element.type === "link" ||
            element.type === "image") && (
              <>
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      showTagMenu ? closeAllSubmenus() : openTagMenu();
                    }}
                    className={cn(
                      "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                      showTagMenu && "bg-primary/20 text-primary",
                      element.hypercubeTags &&
                      element.hypercubeTags.length > 0 &&
                      "text-cyan-400",
                    )}
                    title="Tag to Hypercube"
                  >
                    <Box className="w-4 h-4" />
                  </button>
                  {showTagMenu && (
                    <HypercubeTagPicker
                      currentTags={element.hypercubeTags || []}
                      onTagToggle={(tag) => {
                        const currentTags = element.hypercubeTags || [];
                        const newTags = currentTags.includes(tag)
                          ? currentTags.filter((t) => t !== tag)
                          : [...currentTags, tag];
                        onUpdate({
                          hypercubeTags: newTags,
                        } as Partial<CanvasElement>);
                      }}
                      onClose={() => setShowTagMenu(false)}
                    />
                  )}
                </div>
                <div className="w-px h-4 bg-border/50 mx-0.5" />
              </>
            )}
          {/* Universal actions — z-order controls hidden for containers (they always stay at back) */}
          {element.type !== 'container' && (
            <>
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
            </>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdate({ locked: !element.locked });
            }}
            className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title={element.locked ? "Unlock" : "Lock"}
          >
            {element.locked ? (
              <Lock className="w-4 h-4" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
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
          {/* Send to Inbox button - only for note cards (not documents) */}
          {element.type === 'freeform' && ((element as any).cardType === 'note' || (element as any).noteTitle || (element as any).emoji === '🤖') && !element.inInbox && !(element as FreeformElement).isDocument && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // Ensure cardType is set to 'note' when sending to inbox
                onUpdate({
                  inInbox: true,
                  cardType: 'note'
                } as any);
              }}
              className="p-1.5 rounded hover:bg-violet-500/20 text-muted-foreground hover:text-violet-400 transition-colors"
              title="Send to Inbox"
            >
              <Inbox className="w-4 h-4" />
            </button>
          )}
          {/* Download Image button - only for image elements */}
          {element.type === 'image' && (element as ImageElement).src && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                const imageElement = element as ImageElement;
                try {
                  const response = await fetch(imageElement.src);
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = imageElement.imageMeta?.originalName || 'image.png';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  window.URL.revokeObjectURL(url);
                } catch (error) {
                  console.error('Failed to download image:', error);
                }
              }}
              className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
              title="Download Image"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
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
        </div>
      )}
      {/* Hypercube tag indicators */}
      {element.hypercubeTags && element.hypercubeTags.length > 0 && (
        <div
          className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1.5 rounded-full bg-card/90 backdrop-blur border border-cyan-500/30 shadow-sm z-10 bottom-[-33px] h-[30px] py-[5px] top-[-62px] w-fit"
          style={{ transform: "translate(-50%, 50%)" }}
        >
          {element.hypercubeTags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs opacity-90" title={tag}>
              {HYPERCUBE_TAG_ICONS[tag]}
            </span>
          ))}
          {element.hypercubeTags.length > 3 && (
            <span className="text-[10px] text-cyan-400/80 ml-0.5">
              +{element.hypercubeTags.length - 3}
            </span>
          )}
        </div>
      )}
      {/* Element content */}
      {renderContent()}
      {/* Resize handles - shown when selected (not for boards or line elements) */}
      {isSelected &&
        !isDragging &&
        element.type !== "board" &&
        element.type !== "line" && (
          <>
            {/* Note cards are the only resizable freeform cards (width-only). */}
            {element.type === "freeform" ? (
              isResizableNoteCard ? (
                <>
                  <ResizeHandle
                    position="nw"
                    element={element}
                    onUpdate={onUpdate}
                    canvasZoom={canvasZoom}
                    snapToGrid={snapToGrid}
                    onResizeStart={pushCanvasHistory}
                  />
                  <ResizeHandle
                    position="sw"
                    element={element}
                    onUpdate={onUpdate}
                    canvasZoom={canvasZoom}
                    snapToGrid={snapToGrid}
                    onResizeStart={pushCanvasHistory}
                  />
                  <ResizeHandle
                    position="ne"
                    element={element}
                    onUpdate={onUpdate}
                    canvasZoom={canvasZoom}
                    snapToGrid={snapToGrid}
                    onResizeStart={pushCanvasHistory}
                  />
                  <ResizeHandle
                    position="se"
                    element={element}
                    onUpdate={onUpdate}
                    canvasZoom={canvasZoom}
                    snapToGrid={snapToGrid}
                    onResizeStart={pushCanvasHistory}
                  />
                  <ResizeHandle
                    position="e"
                    element={element}
                    onUpdate={onUpdate}
                    canvasZoom={canvasZoom}
                    snapToGrid={snapToGrid}
                    onResizeStart={pushCanvasHistory}
                  />
                  <ResizeHandle
                    position="w"
                    element={element}
                    onUpdate={onUpdate}
                    canvasZoom={canvasZoom}
                    snapToGrid={snapToGrid}
                    onResizeStart={pushCanvasHistory}
                  />
                </>
              ) : null
            ) : (
              <>
                <ResizeHandle
                  position="se"
                  element={element}
                  onUpdate={onUpdate}
                  canvasZoom={canvasZoom}
                  snapToGrid={snapToGrid}
                  onResizeStart={pushCanvasHistory}
                />
                <ResizeHandle
                  position="sw"
                  element={element}
                  onUpdate={onUpdate}
                  canvasZoom={canvasZoom}
                  snapToGrid={snapToGrid}
                  onResizeStart={pushCanvasHistory}
                />
                <ResizeHandle
                  position="ne"
                  element={element}
                  onUpdate={onUpdate}
                  canvasZoom={canvasZoom}
                  snapToGrid={snapToGrid}
                  onResizeStart={pushCanvasHistory}
                />
                <ResizeHandle
                  position="nw"
                  element={element}
                  onUpdate={onUpdate}
                  canvasZoom={canvasZoom}
                  snapToGrid={snapToGrid}
                  onResizeStart={pushCanvasHistory}
                />
              </>
            )}
          </>
        )}
      {/* Rotation handle — line + dot below element, for shapes and images */}
      {isSelected &&
        !isDragging &&
        !isEditing &&
        !isReadOnly &&
        !element.locked &&
        (element.type === "shape" || element.type === "image") && (
          <RotationHandle
            element={element}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
            onResizeStart={pushCanvasHistory}
          />
        )}
      {/* Text font-size resize handle - shown when text selected and not editing */}
      {isSelected && !isEditing && element.type === "text" && !isReadOnly && (
        <TextFontSizeHandle
          element={element as TextElement}
          onUpdate={onUpdate}
          canvasZoom={canvasZoom}
          onResizeStart={pushCanvasHistory}
        />
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
  hoveredAnchor,
  onAnchorHover,
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
  hoveredAnchor?: string | null;
  onAnchorHover?: (anchor: string | null) => void;
}) {
  const positionStyles: Record<string, React.CSSProperties> = {
    top: { top: -6, left: "50%", transform: "translateX(-50%)" },
    right: { right: -6, top: "50%", transform: "translateY(-50%)" },
    bottom: { bottom: -6, left: "50%", transform: "translateX(-50%)" },
    left: { left: -6, top: "50%", transform: "translateY(-50%)" },
  };

  const anchorId = `${elementId}-${position}`;
  const isThisAnchorHovered = hoveredAnchor === anchorId;
  const showGlow = isConnecting && isHoverTarget && isThisAnchorHovered;

  return (
    <div
      className={cn(
        "absolute w-3 h-3 bg-primary/80 border-2 border-background rounded-full cursor-crosshair hover:bg-primary hover:scale-125 transition-all z-20 pointer-events-auto",
        // When connecting, all anchors on potential target elements glow subtly
        isConnecting && isHoverTarget && "bg-green-500 animate-pulse",
        // The specific anchor being hovered glows brightly
        showGlow &&
        "bg-green-400 scale-150 shadow-[0_0_20px_rgba(74,222,128,0.8)]",
      )}
      style={positionStyles[position]}
      data-port-id={anchorId}
      data-node-id={elementId}
      data-port={position}
      onMouseEnter={() => {
        if (isConnecting && onAnchorHover) {
          onAnchorHover(anchorId);
        }
      }}
      onMouseLeave={() => {
        if (isConnecting && onAnchorHover) {
          onAnchorHover(null);
        }
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (isConnecting && onEndConnector) {
          onEndConnector(elementId, position);
        } else {
          onStartConnector(elementId, position);
        }
      }}
      onMouseUp={(e) => {
        // Allow mouseup on anchor to complete connection
        if (isConnecting && onEndConnector) {
          e.stopPropagation();
          onEndConnector(elementId, position);
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
  snapToGrid,
  onResizeStart,
}: {
  position: "nw" | "ne" | "sw" | "se" | "e" | "w";
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  canvasZoom: number;
  snapToGrid?: boolean;
  onResizeStart?: () => void;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      if (element.type === "freeform") {
        // Type guard: task cards are intentionally non-resizable.
        if (!canResizeFreeformCard(element as FreeformElement)) return;
      }

      // Capture history before starting resize for undo support
      onResizeStart?.();

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
        const isResizableNote =
          element.type === "freeform" &&
          canResizeFreeformCard(element as FreeformElement);

        // Determine minimum sizes based on element type
        const minWidth =
          element.type === "freeform" && isResizableNote ? 200 : element.type === "freeform" ? 200 : 50;
        const minHeight =
          element.type === "freeform" && isResizableNote ? 300 : element.type === "freeform" ? 120 : 30;

        // For images, maintain aspect ratio
        const isImage = element.type === "image";
        // Shift key: maintain aspect ratio for any element type
        const shouldMaintainAspectRatio = isImage || moveEvent.shiftKey;
        const aspectRatio = shouldMaintainAspectRatio ? startWidth / startHeight : null;

        if (position.includes("e")) {
          newWidth = Math.max(minWidth, startWidth + deltaX);
          if (shouldMaintainAspectRatio && aspectRatio) {
            newHeight = newWidth / aspectRatio;
          }
        }
        if (position.includes("w")) {
          newWidth = Math.max(minWidth, startWidth - deltaX);
          newX = startPosX + (startWidth - newWidth);
          if (shouldMaintainAspectRatio && aspectRatio) {
            newHeight = newWidth / aspectRatio;
          }
        }

        // Note cards are width-resizable only; keep height content-driven.
        if (!isResizableNote) {
          if (position.includes("s")) {
            newHeight = Math.max(minHeight, startHeight + deltaY);
            if (shouldMaintainAspectRatio && aspectRatio) {
              newWidth = newHeight * aspectRatio;
            }
          }
          if (position.includes("n")) {
            newHeight = Math.max(minHeight, startHeight - deltaY);
            newY = startPosY + (startHeight - newHeight);
            if (shouldMaintainAspectRatio && aspectRatio) {
              newWidth = newHeight * aspectRatio;
            }
          }
        }

        if (snapToGrid) {
          const gridSize = 30;
          newWidth = Math.round(newWidth / gridSize) * gridSize;
          if (!isResizableNote) {
            newHeight = Math.round(newHeight / gridSize) * gridSize;
          }
          newX = Math.round(newX / gridSize) * gridSize;
          if (!isResizableNote) {
            newY = Math.round(newY / gridSize) * gridSize;
          }
        }

        // For corner handles on images (or shift-held), resize proportionally
        if (shouldMaintainAspectRatio && aspectRatio && (position === "nw" || position === "ne" || position === "sw" || position === "se")) {
          // Use the larger delta to determine resize
          const delta = Math.max(Math.abs(deltaX), Math.abs(deltaY)) * Math.sign(position.includes("e") ? deltaX : -deltaX);
          newWidth = Math.max(minWidth, startWidth + delta);
          newHeight = newWidth / aspectRatio;

          if (position.includes("w")) {
            newX = startPosX + (startWidth - newWidth);
          }
          if (position.includes("n")) {
            newY = startPosY + (startHeight - newHeight);
          }
        }

        // Alt key: resize from center (both sides move equally)
        if (moveEvent.altKey) {
          const widthDiff = newWidth - startWidth;
          const heightDiff = newHeight - startHeight;
          newX = startPosX - widthDiff / 2;
          newY = startPosY - heightDiff / 2;
          // Double the size change since we're expanding in both directions
          newWidth = startWidth + widthDiff;
          newHeight = startHeight + heightDiff;
        }

        // For experience blocks, mark as manually resized to prevent auto-resize from overriding
        const updates: Partial<CanvasElement> = { width: newWidth, height: newHeight, x: newX, y: newY };
        if (element.type === "experienceBlock") {
          (updates as any).manuallyResized = true;
        }
        // For containers, update the user-set minimum size floor
        if (element.type === "container") {
          (updates as any).minWidth = newWidth;
          (updates as any).minHeight = newHeight;
        }
        onUpdate(updates);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onUpdate, position, canvasZoom, snapToGrid, onResizeStart],
  );

  // Scale handles inversely with zoom to keep them visible at all zoom levels
  const handleScale = 1 / canvasZoom;

  const positionStyles: Record<string, React.CSSProperties> = {
    nw: { top: -4, left: -4, cursor: "nw-resize", transform: `scale(${handleScale})`, transformOrigin: "top left" },
    ne: { top: -4, right: -4, cursor: "ne-resize", transform: `scale(${handleScale})`, transformOrigin: "top right" },
    sw: { bottom: -4, left: -4, cursor: "sw-resize", transform: `scale(${handleScale})`, transformOrigin: "bottom left" },
    se: { bottom: -4, right: -4, cursor: "se-resize", transform: `scale(${handleScale})`, transformOrigin: "bottom right" },
    e: { top: "50%", right: -4, transform: `translateY(-50%) scale(${handleScale})`, transformOrigin: "center right", cursor: "ew-resize" },
    w: { top: "50%", left: -4, transform: `translateY(-50%) scale(${handleScale})`, transformOrigin: "center left", cursor: "ew-resize" },
  };

  return (
    <div
      className="absolute w-3 h-3 bg-primary border-2 border-background rounded-sm z-10"
      style={positionStyles[position]}
      onMouseDown={handleMouseDown}
    />
  );
}

// Rotation handle — line + dot below the element, drag to rotate
function RotationHandle({
  element,
  onUpdate,
  canvasZoom,
  onResizeStart,
}: {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  canvasZoom: number;
  onResizeStart?: () => void;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onResizeStart?.();

      // Get the element's screen-space center from its DOM node
      const elNode = (e.target as HTMLElement).closest('[data-element-id]') as HTMLElement | null;
      if (!elNode) return;
      const elRect = elNode.getBoundingClientRect();
      const screenCenterX = elRect.left + elRect.width / 2;
      const screenCenterY = elRect.top + elRect.height / 2;

      // Compute the initial angle of the mouse relative to center at drag start
      const startAngle = Math.atan2(
        e.clientY - screenCenterY,
        e.clientX - screenCenterX,
      ) * (180 / Math.PI);
      const startRotation = element.rotation || 0;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Compute current angle from element center to mouse
        const currentAngle = Math.atan2(
          moveEvent.clientY - screenCenterY,
          moveEvent.clientX - screenCenterX,
        ) * (180 / Math.PI);

        // Rotation = starting rotation + delta from where the drag began
        let rotation = startRotation + (currentAngle - startAngle);

        // Snap to 15° increments when Shift is held
        if (moveEvent.shiftKey) {
          rotation = Math.round(rotation / 15) * 15;
        }

        onUpdate({ rotation });
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onUpdate, onResizeStart],
  );

  const handleScale = 1 / canvasZoom;
  const stemLength = 30;
  const dotSize = 10;

  return (
    <div
      className="absolute left-1/2 pointer-events-none"
      style={{
        bottom: -(stemLength + dotSize / 2 + 4),
        transform: `translateX(-50%) scale(${handleScale})`,
        transformOrigin: "top center",
      }}
    >
      {/* Stem line */}
      <div
        className="mx-auto bg-primary/60"
        style={{ width: 1.5, height: stemLength }}
      />
      {/* Dot handle */}
      <div
        className="mx-auto rounded-full bg-primary border-2 border-background cursor-grab pointer-events-auto hover:scale-125 transition-transform"
        style={{ width: dotSize, height: dotSize }}
        onMouseDown={handleMouseDown}
        title="Drag to rotate (Shift for 15° snaps)"
      />
    </div>
  );
}

// Text font-size resize handle - drag to scale font size
function TextFontSizeHandle({
  element,
  onUpdate,
  canvasZoom,
  onResizeStart,
}: {
  element: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
  canvasZoom: number;
  onResizeStart?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Capture history before starting resize for undo support
      onResizeStart?.();

      setIsDragging(true);

      const startY = e.clientY;
      const startFontSize = element.style?.fontSize || 16;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Calculate delta - vertical only (down increases, up decreases)
        const deltaY = (moveEvent.clientY - startY) / canvasZoom;
        const delta = deltaY;

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
    [element, onUpdate, canvasZoom, onResizeStart],
  );

  // Scale handle inversely with zoom to keep it visible at all zoom levels
  const handleScale = 1 / canvasZoom;
  const baseScale = isDragging ? 1.25 : 1;

  // Offset the handle below the element
  const handleOffset = 8;

  return (
    <div
      className={cn(
        "absolute w-5 h-5 bg-primary/90 border-2 border-background rounded-sm z-10 flex items-center justify-center cursor-ns-resize transition-all hover:scale-110",
        isDragging && "shadow-lg",
      )}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: `-${handleOffset}px`,
        transform: `translateX(-50%) scale(${handleScale * baseScale})`,
      }}
      onMouseDown={handleMouseDown}
      title="Drag to resize text"
    >
      <ALargeSmall className="w-3.5 h-3.5 text-background" />
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

// Shape type picker - allows changing shape type without recreating element
function ShapeTypePicker({
  currentType,
  onTypeSelect,
  onClose,
}: {
  currentType: ShapeType;
  onTypeSelect: (shapeType: ShapeType) => void;
  onClose: () => void;
}) {
  const shapeTypes: { type: ShapeType; label: string; icon: React.ReactNode }[] = [
    { type: "rectangle", label: "Rectangle", icon: <div className="w-4 h-3 bg-current rounded-sm" /> },
    { type: "circle", label: "Circle", icon: <div className="w-4 h-4 bg-current rounded-full" /> },
    { type: "diamond", label: "Diamond", icon: <div className="w-3 h-3 bg-current rotate-45" /> },
    { type: "triangle", label: "Triangle", icon: <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-current" /> },
    { type: "hexagon", label: "Hexagon", icon: <div className="w-4 h-4 bg-current" style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }} /> },
    { type: "star", label: "Star", icon: <Star className="w-4 h-4 fill-current" /> },
  ];

  return (
    <div
      className="absolute top-full mt-2 left-1/2 -translate-x-1/2 p-2 rounded-lg bg-card backdrop-blur-xl border border-border/50 shadow-lg z-[100] w-[180px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 px-1.5 py-1">
        {shapeTypes.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => onTypeSelect(type)}
            className={cn(
              "flex items-center justify-center w-8 h-8 rounded-md transition-colors",
              currentType === type
                ? "bg-primary/20 text-primary"
                : "hover:bg-white/10 text-muted-foreground hover:text-foreground"
            )}
            title={label}
          >
            <div className="w-5 h-5 flex items-center justify-center">
              {icon}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// Shape text style picker - simplified to only show font weight (secondary popover)
function ShapeTextStylePicker({
  style,
  onStyleChange,
  onOpenColorPicker,
  onClose,
}: {
  style?: ElementStyle;
  onStyleChange: (updates: Partial<ElementStyle>) => void;
  onOpenColorPicker?: () => void;
  onClose: () => void;
}) {
  const currentFontWeight = style?.fontWeight || 'normal';
  const currentFontFamily = style?.fontFamily || 'inherit';
  const currentFontSize = style?.fontSize || 14;
  const isBold = currentFontWeight === 'bold' || currentFontWeight === 'semibold';
  const isItalic = style?.fontStyle === 'italic';
  const isUnderline = style?.textDecoration === 'underline';
  const currentTextAlign = style?.textAlign || 'center';

  return (
    <div
      className="absolute left-0 top-full mt-2 rounded-lg bg-card backdrop-blur-xl border border-border/50 shadow-lg z-[100] w-[200px] p-3 pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Font family */}
      <select
        value={currentFontFamily}
        onChange={(e) => onStyleChange({ fontFamily: e.target.value })}
        onClick={(e) => e.stopPropagation()}
        className="w-full h-7 px-2 mb-2 text-[11px] rounded bg-muted/50 border border-border/50 text-foreground cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        {FONT_FAMILIES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      {/* Font size slider */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[10px] text-muted-foreground w-8">Size</span>
        <input
          type="range" value={currentFontSize}
          onChange={(e) => onStyleChange({ fontSize: parseInt(e.target.value) })}
          min={8} max={72} step={1}
          className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer"
        />
        <span className="text-[10px] text-muted-foreground w-6 text-right">{currentFontSize}</span>
      </div>

      {/* Formatting buttons row: B | I | U | divider | AlignLeft | AlignCenter | AlignRight */}
      <div className="flex items-center gap-1 mb-2">
        {/* Bold */}
        <button
          onClick={() => onStyleChange({ fontWeight: isBold ? 'normal' : 'bold' })}
          className={cn("p-1.5 rounded transition-colors text-xs font-bold", isBold ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-muted-foreground")}
          title="Bold"
        >
          B
        </button>
        {/* Italic */}
        <button
          onClick={() => onStyleChange({ fontStyle: isItalic ? 'normal' : 'italic' })}
          className={cn("p-1.5 rounded transition-colors text-xs italic", isItalic ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-muted-foreground")}
          title="Italic"
        >
          I
        </button>
        {/* Underline */}
        <button
          onClick={() => onStyleChange({ textDecoration: isUnderline ? 'none' : 'underline' })}
          className={cn("p-1.5 rounded transition-colors text-xs underline", isUnderline ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-muted-foreground")}
          title="Underline"
        >
          U
        </button>
        {/* Divider */}
        <div className="w-px h-4 bg-border/50 mx-0.5" />
        {/* Align Left */}
        <button
          onClick={() => onStyleChange({ textAlign: 'left' })}
          className={cn("p-1.5 rounded transition-colors", currentTextAlign === 'left' ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-muted-foreground")}
          title="Align Left"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
        {/* Align Center */}
        <button
          onClick={() => onStyleChange({ textAlign: 'center' })}
          className={cn("p-1.5 rounded transition-colors", currentTextAlign === 'center' ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-muted-foreground")}
          title="Align Center"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        {/* Align Right */}
        <button
          onClick={() => onStyleChange({ textAlign: 'right' })}
          className={cn("p-1.5 rounded transition-colors", currentTextAlign === 'right' ? "bg-primary/20 text-primary" : "hover:bg-white/10 text-muted-foreground")}
          title="Align Right"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Text color button */}
      {onOpenColorPicker && (
        <button
          onClick={() => { onClose(); onOpenColorPicker(); }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground rounded hover:bg-white/5 transition-colors"
        >
          <Palette className="w-3.5 h-3.5" /> Text Color
        </button>
      )}
    </div>
  );
}

// Shape color picker with fill/stroke/text toggle and stroke width control
function ShapeColorPicker({
  fillColor,
  strokeColor,
  strokeWidth,
  fillOpacity,
  textColor,
  fontSize,
  onFillColorChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onFillOpacityChange,
  onTextColorChange,
  onFontSizeChange,
  onClose,
  defaultMode,
}: {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  textColor?: string;
  fontSize?: number;
  onFillColorChange: (color: string) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillOpacityChange: (opacity: number) => void;
  onTextColorChange?: (color: string) => void;
  onFontSizeChange?: (size: number) => void;
  onClose: () => void;
  defaultMode?: "fill" | "stroke" | "text";
}) {
  const [mode, setMode] = useState<"fill" | "stroke" | "text">(defaultMode || "fill");
  const [lastCustomColor, setLastCustomColor] = useState<string | null>(null);
  const customColorRef = useRef<HTMLInputElement>(null);
  const currentWidth = strokeWidth || 2;
  const currentOpacity = fillOpacity !== undefined ? fillOpacity : 100;
  const currentFontSize = fontSize || 16;

  const colorToHex = (color?: string): string => {
    if (!color || color === "transparent" || color === "inherit") return "#ffffff";
    if (color.startsWith("#")) return color;
    if (color.startsWith("hsl")) {
      try {
        const match = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
        if (match) {
          const [, h, s, l] = match;
          const hN = Number(h); const sN = Number(s); const lN = Number(l) / 100;
          const a = (sN * Math.min(lN, 1 - lN)) / 100;
          const f = (n: number) => { const k = (n + hN / 30) % 12; return Math.round(255 * (lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, "0"); };
          return `#${f(0)}${f(8)}${f(4)}`;
        }
      } catch {}
    }
    return "#A855F7";
  };

  const presetColors = [
    "#ffffff", "#a3a3a3", "#404040",
  ];

  const handleColorChange = (color: string) => {
    switch (mode) {
      case "fill": onFillColorChange(color); break;
      case "stroke": onStrokeColorChange(color); break;
      case "text": onTextColorChange?.(color); break;
    }
  };

  const handleCustomColorChange = (color: string) => {
    handleColorChange(color);
    if (!presetColors.includes(color)) {
      setLastCustomColor(color);
    }
  };

  const getCurrentColor = () => {
    switch (mode) {
      case "fill": return colorToHex(fillColor);
      case "stroke": return colorToHex(strokeColor);
      case "text": return colorToHex(textColor);
    }
  };

  return (
    <div
      className="absolute left-0 top-full mt-2 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-[100] pointer-events-auto w-[220px] p-3"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Mode tabs: Fill / Outline / Text */}
      <div className="flex gap-1 mb-3 p-0.5 bg-muted/50 rounded-md">
        <button
          onClick={() => setMode("fill")}
          className={cn("flex-1 py-1.5 px-2 text-xs rounded transition-colors flex items-center justify-center gap-1",
            mode === "fill" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <Paintbrush className="w-3 h-3" /> Fill
        </button>
        <button
          onClick={() => setMode("stroke")}
          className={cn("flex-1 py-1.5 px-2 text-xs rounded transition-colors flex items-center justify-center gap-1",
            mode === "stroke" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          <PenLine className="w-3 h-3" /> Outline
        </button>
        {onTextColorChange && (
          <button
            onClick={() => setMode("text")}
            className={cn("flex-1 py-1.5 px-2 text-xs rounded transition-colors flex items-center justify-center gap-1",
              mode === "text" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            <Type className="w-3 h-3" /> Text
          </button>
        )}
      </div>

      {/* Color swatches — two rows */}
      <div className="space-y-2 mb-3">
        {/* Row 1: white, gray, dark gray, dynamic (last picked), transparent, rainbow wheel */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {presetColors.map((color) => (
            <button
              key={color}
              onClick={() => handleColorChange(color)}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                getCurrentColor() === color ? "border-foreground shadow-lg scale-110" : "border-border/50 hover:border-border",
              )}
              style={{ backgroundColor: color }}
            />
          ))}
          {/* Dynamic last custom color swatch */}
          {lastCustomColor && !presetColors.includes(lastCustomColor) && (
            <button
              onClick={() => handleColorChange(lastCustomColor)}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                getCurrentColor() === lastCustomColor ? "border-foreground shadow-lg scale-110" : "border-border/50 hover:border-border",
              )}
              style={{ backgroundColor: lastCustomColor }}
              title="Last custom color"
            />
          )}
          {/* Transparent swatch — all modes */}
          <button
            onClick={() => handleColorChange("transparent")}
            className={cn(
              "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
              (mode === "fill" ? fillColor : mode === "stroke" ? strokeColor : textColor) === "transparent" ? "border-foreground shadow-lg" : "border-border/50",
              "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]",
            )}
            title="Transparent"
          />
          {/* Rainbow color picker */}
          <button
            onClick={() => customColorRef.current?.click()}
            className={cn(
              "w-6 h-6 rounded-full border-2 transition-all hover:scale-110 relative overflow-hidden",
              getCurrentColor() && !presetColors.includes(getCurrentColor()) && getCurrentColor() !== lastCustomColor ? "border-foreground shadow-lg scale-110" : "border-border/50",
            )}
            style={{ background: "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
            title="Custom color"
          >
            <input
              ref={customColorRef}
              type="color"
              value={getCurrentColor()}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </button>
        </div>
        {/* Row 2: 6 gradient circles — all modes */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {TEXT_GRADIENTS.slice(0, 6).map((gradient, i) => (
            <button
              key={i}
              onClick={() => handleColorChange(gradient)}
              className="w-6 h-6 rounded-full border-2 border-border/50 hover:border-border transition-all hover:scale-110"
              style={{ background: gradient }}
              title={`Gradient ${i + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Slider — context-dependent */}
      <div className="flex items-center gap-2">
        {mode === "fill" && (
          <>
            <span className="text-[10px] text-muted-foreground w-12">Opacity</span>
            <input
              type="range" value={currentOpacity} onChange={(e) => onFillOpacityChange(parseInt(e.target.value))}
              min={0} max={100} step={1}
              className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{currentOpacity}%</span>
          </>
        )}
        {mode === "stroke" && (
          <>
            <span className="text-[10px] text-muted-foreground w-12">Width</span>
            <input
              type="range" value={currentWidth} onChange={(e) => onStrokeWidthChange(parseInt(e.target.value))}
              min={0} max={16} step={1}
              className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{currentWidth}px</span>
          </>
        )}
        {mode === "text" && onFontSizeChange && (
          <>
            <span className="text-[10px] text-muted-foreground w-12">Size</span>
            <input
              type="range" value={currentFontSize} onChange={(e) => onFontSizeChange(parseInt(e.target.value))}
              min={8} max={72} step={1}
              className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer"
            />
            <span className="text-[10px] text-muted-foreground w-8 text-right">{currentFontSize}</span>
          </>
        )}
      </div>
    </div>
  );
}

// Container style picker (fill/stroke/opacity)
function ContainerStylePicker({
  fillColor,
  strokeColor,
  strokeWidth,
  strokeStyle,
  fillOpacity,
  onFillColorChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onStrokeStyleChange,
  onFillOpacityChange,
  onClose,
}: {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: "solid" | "dashed" | "dotted";
  fillOpacity?: number;
  onFillColorChange: (color: string) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onStrokeStyleChange: (style: "solid" | "dashed" | "dotted") => void;
  onFillOpacityChange: (opacity: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"fill" | "stroke">("fill");
  const currentWidth = strokeWidth || 2;
  const currentStyle = strokeStyle || "dashed";
  const currentOpacity = fillOpacity !== undefined ? fillOpacity : 20;

  // Convert color to hex for color picker
  const colorToHex = (color?: string): string => {
    if (!color || color === "transparent") return "#000000";
    if (color.startsWith("#")) return color;
    // Handle HSL colors
    if (color.startsWith("hsl")) {
      try {
        const match = color.match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/);
        if (match) {
          const [, h, s, l] = match;
          return hslToHex(Number(h), Number(s), Number(l));
        }
      } catch (e) {
        console.error("Error parsing HSL color:", e);
      }
    }
    return "#A855F7";
  };

  const hslToHex = (h: number, s: number, l: number): string => {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  };

  const currentFillHex = colorToHex(fillColor);
  const currentStrokeHex = colorToHex(strokeColor);

  return (
    <div
      className="absolute left-0 bottom-full mb-2 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-[100] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Compact single row layout */}
      <div className="flex items-center gap-1 px-2 py-1.5">
        {/* Mode toggle buttons */}
        <button
          onClick={() => setMode("fill")}
          className={cn(
            "p-1.5 rounded hover:bg-primary/20 transition-colors",
            mode === "fill" && "bg-primary/30 ring-1 ring-primary",
          )}
          title="Fill"
        >
          <Paintbrush className="w-4 h-4" />
        </button>
        <button
          onClick={() => setMode("stroke")}
          className={cn(
            "p-1.5 rounded hover:bg-primary/20 transition-colors",
            mode === "stroke" && "bg-primary/30 ring-1 ring-primary",
          )}
          title="Outline"
        >
          <PenLine className="w-4 h-4" />
        </button>

        <div className="w-px h-4 bg-border/50 mx-0.5" />

        {/* Color picker */}
        <input
          type="color"
          value={mode === "fill" ? currentFillHex : currentStrokeHex}
          onChange={(e) => {
            if (mode === "fill") {
              onFillColorChange(e.target.value);
            } else {
              onStrokeColorChange(e.target.value);
            }
          }}
          className="w-6 h-6 rounded cursor-pointer border-0"
          title="Color"
        />

        {/* Transparent button for fill mode */}
        {mode === "fill" && (
          <>
            <button
              onClick={() => onFillColorChange("transparent")}
              className={cn(
                "w-6 h-6 rounded border-2 transition-all",
                fillColor === "transparent"
                  ? "border-primary"
                  : "border-border",
                "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]",
              )}
              title="Transparent"
            />
            <div className="w-px h-4 bg-border/50 mx-0.5" />
          </>
        )}

        {/* Stroke width slider - only show when in stroke mode */}
        {mode === "stroke" && (
          <>
            <input
              type="range"
              value={currentWidth}
              onChange={(e) => onStrokeWidthChange(parseInt(e.target.value))}
              min={1}
              max={8}
              step={1}
              className="w-16 h-1 rounded-full appearance-none bg-muted cursor-pointer"
              title={`Width: ${currentWidth}px`}
            />
            <div className="w-px h-4 bg-border/50 mx-0.5" />

            {/* Line style buttons */}
            <button
              onClick={() => onStrokeStyleChange("solid")}
              className={cn(
                "p-1.5 rounded hover:bg-primary/20 transition-colors",
                currentStyle === "solid" && "bg-primary/30 ring-1 ring-primary",
              )}
              title="Solid"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={() => onStrokeStyleChange("dashed")}
              className={cn(
                "p-1.5 rounded hover:bg-primary/20 transition-colors",
                currentStyle === "dashed" &&
                "bg-primary/30 ring-1 ring-primary",
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
              onClick={() => onStrokeStyleChange("dotted")}
              className={cn(
                "p-1.5 rounded hover:bg-primary/20 transition-colors",
                currentStyle === "dotted" &&
                "bg-primary/30 ring-1 ring-primary",
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
          </>
        )}

        {/* Fill opacity slider - only show when in fill mode */}
        {mode === "fill" && (
          <>
            <span className="text-xs text-muted-foreground px-1">
              {currentOpacity}%
            </span>
            <input
              type="range"
              value={currentOpacity}
              onChange={(e) => onFillOpacityChange(parseInt(e.target.value))}
              min={0}
              max={100}
              step={5}
              className="w-20 h-1 rounded-full appearance-none bg-muted cursor-pointer"
              title={`Opacity: ${currentOpacity}%`}
            />
          </>
        )}

        <div className="w-px h-4 bg-border/50 mx-0.5" />

        {/* Close button */}
        <button
          onClick={onClose}
          className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
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
  const [customColor, setCustomColor] = useState(currentColor || "#ffffff");
  const colorInputRef = useRef<HTMLInputElement>(null);

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
    "#F59E0B", // Amber
  ];

  return (
    <div
      className="absolute left-0 top-full mt-2 p-3 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-[100] min-w-[180px] pointer-events-auto"
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
        <div className="flex flex-wrap gap-2 justify-center">
          {solidColors.map((color) => (
            <button
              key={color}
              onClick={() => {
                onColorChange(color);
                onClose();
              }}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-all hover:scale-110",
                currentColor === color && !currentGradient
                  ? "border-foreground shadow-lg scale-110"
                  : "border-border/50 hover:border-border",
              )}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          {/* Rainbow color picker button */}
          <button
            onClick={() => colorInputRef.current?.click()}
            className={cn(
              "w-7 h-7 rounded-full border-2 transition-all hover:scale-110 relative overflow-hidden",
              currentColor && !solidColors.includes(currentColor) && !currentGradient
                ? "border-foreground shadow-lg scale-110"
                : "border-border/50 hover:border-border",
            )}
            style={{
              background: "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
            }}
            title="Custom color"
          >
            <input
              ref={colorInputRef}
              type="color"
              value={customColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                onColorChange(e.target.value);
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </button>
        </div>
      )}
      {/* Gradient swatches — circular previews */}
      {mode === "gradient" && (
        <div className="flex flex-wrap gap-2 justify-center">
          {TEXT_GRADIENTS.map((gradient, index) => (
            <button
              key={index}
              onClick={() => {
                onGradientChange(gradient);
                onClose();
              }}
              className={cn(
                "w-7 h-7 rounded-full border-2 transition-all hover:scale-110 flex-shrink-0",
                currentGradient === gradient
                  ? "border-foreground shadow-lg scale-110"
                  : "border-border/50 hover:border-border",
              )}
              style={{ background: gradient }}
              title={`Gradient ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Gradient picker for experience blocks
function GradientPicker({
  currentGradient,
  onGradientChange,
  onClose,
}: {
  currentGradient?: string;
  onGradientChange: (gradient: string) => void;
  onClose: () => void;
}) {
  const gradients = [
    "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)", // 1 - Keep original
    "linear-gradient(135deg, #290d56ff 0%, #460e3bff 30%, #3b0764 70%, #2d0552 100%)", // 2 - Darker purple
    "linear-gradient(135deg, #000000ff 0%, #000000ff 30%, #1a0a2dff 70%, #2f0330ff 100%)", // 3 - Darker violet
    "linear-gradient(135deg, #2d2d2dff 0%, #000000ff 30%, #000000ff 70%, #323232ff 100%)", // 4 - Darker pink/purple
    "linear-gradient(135deg, #000d10ff 0%, #063a48ff 30%, #0b323eff 70%, #01080bff 100%)", // 5 - Darker cyan
    "linear-gradient(135deg, #052320ff 0%, #000d0cff 30%, #091337ff 70%, #072012ff 100%)", // 6 - Darker teal
    "linear-gradient(135deg, #2d0064ff 0%, #22061cff 30%, #3c2f0aff 70%, #292e04ff 100%)", // 7 - Darker indigo
    "linear-gradient(135deg, #140927ff 0%, #2d1807ff 30%, #260e4dff 70%, #240e06ff 100%)", // 8 - Darker lavender
    "linear-gradient(135deg, #afa01eff 0%, #513812ff 20%, #390021ff 50%, #000000ff 100%)", // 9 - Keep original
    "linear-gradient(135deg, #1e0434ff 0%, #146065ff 30%, #34092aff 70%, #043634ff 100%)", // 10 - Keep original
    "linear-gradient(135deg, #3e0c04ff 0%, #510808ff 30%, #280505ff 70%, #2b0000ff 100%)", // 11 - Darker orange
    "linear-gradient(135deg, #093a1bff 0%, #00240eff 30%, #000000ff 70%, #052e16 100%)", // 12 - Darker green
  ];

  return (
    <div
      className="absolute left-0 top-full mt-2 p-3 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-[100] min-w-[260px] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Choose Gradient
      </div>
      <div className="grid grid-cols-3 gap-2">
        {gradients.map((gradient, index) => (
          <button
            key={index}
            onClick={() => {
              onGradientChange(gradient);
              onClose();
            }}
            className={cn(
              "h-12 rounded-md border-2 transition-all hover:scale-105",
              currentGradient === gradient
                ? "border-foreground shadow-lg ring-2 ring-primary"
                : "border-border/50 hover:border-border",
            )}
            style={{ background: gradient }}
            title={`Gradient ${index + 1}`}
          />
        ))}
      </div>
      <button
        onClick={onClose}
        className="w-full mt-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        Done
      </button>
    </div>
  );
}

// Hypercube tag picker component
function HypercubeTagPicker({
  currentTags,
  onTagToggle,
  onClose,
}: {
  currentTags: HypercubeFaceTag[];
  onTagToggle: (tag: HypercubeFaceTag) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="absolute left-0 top-full mt-2 p-3 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-[100] min-w-[220px] pointer-events-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Tag to Hypercube
      </div>
      <div className="flex flex-col gap-1">
        {HYPERCUBE_FACE_TAGS.map((tag) => {
          const isSelected = currentTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-all text-left",
                isSelected
                  ? "bg-primary/20 text-primary"
                  : "hover:bg-primary/10 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-base">{HYPERCUBE_TAG_ICONS[tag]}</span>
              <span className="flex-1">{tag}</span>
              {isSelected && <span className="text-primary">✓</span>}
            </button>
          );
        })}
      </div>
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
      className="absolute right-0 mt-2 p-2 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-50 grid grid-cols-4 gap-1 w-[148px] left-[-5px] top-[-175px] bottom-[45px]"
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
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 rounded-lg bg-card backdrop-blur border border-border shadow-xl z-50 grid grid-cols-4 gap-1 w-[165px] h-[96px]"
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
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 rounded-lg bg-card backdrop-blur border border-border shadow-xl z-50 grid grid-cols-3 gap-2 w-[133px] h-[156px]"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {BOARD_HEX_COLORS.map(({ id, gradient, label }) => (
        <button
          key={id}
          className={cn(
            "rounded-lg transition-all hover:scale-110 border-2",
            currentColor === gradient
              ? "border-white ring-2 ring-primary"
              : "border-transparent w-[30px] h-[30px]",
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
  isSelected,
  onStartEdit,
  className,
}: {
  element: FreeformElement;
  onUpdate: (updates: Partial<FreeformElement>) => void;
  isEditing: boolean;
  onBlur: (e?: React.FocusEvent) => void;
  isSelected: boolean;
  onStartEdit: () => void;
  className?: string;
}) {
  // Use the passed-in onBlur handler (from the parent renderer) to avoid undefined refs.
  const handleBlur = onBlur;
  const bgColor =
    element.style?.bgColor ||
    "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)";
  const textColor = element.style?.textColor || "#ffffff"; // Default white for dark backgrounds
  const fontWeight = element.style?.fontWeight || "normal";
  const cardRef = useRef<HTMLDivElement>(null);
  const noteContentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const noteBodyRef = useRef<HTMLDivElement>(null);
  const subtaskRefs = useRef<Map<string, HTMLTextAreaElement | null>>(new Map());
  const [focusedSubtaskId, setFocusedSubtaskId] = useState<string | null>(null);
  const [showTaskPriorityMenu, setShowTaskPriorityMenu] = useState(false);
  const [noteEditingField, setNoteEditingField] = useState<"title" | "body" | null>(null);
  const [isNoteFocusMode, setIsNoteFocusMode] = useState(false);
  const [showFocusNoteColorPicker, setShowFocusNoteColorPicker] = useState(false);
  const [noteTextStyle, setNoteTextStyle] = useState<"heading" | "subheading" | "body" | "small">("body");
  const [noteToolbarMenu, setNoteToolbarMenu] = useState<"none" | "style" | "textColor" | "highlight">("none");
  const taskPriorityMenuRef = useRef<HTMLDivElement>(null);
  const pendingNoteBodyRef = useRef<string>("");
  const freeformCardType = getFreeformCardType(element);
  const isNote = isNoteCard(element);
  const isTask = freeformCardType === "task";
  const legacyLines = (element.content || "").split("\n");
  const noteTitle = element.noteTitle ?? (legacyLines[0] || "Untitled Note");
  const noteBody = element.noteBody ?? legacyLines.slice(1).join("\n");

  // Local input hooks to prevent cursor-jump on controlled inputs
  const [localNoteTitle, setLocalNoteTitle] = useLocalInput(
    noteTitle,
    (v) => {
      const safeTitle = v.trim() || "Untitled Note";
      const combined = noteBody.trim().length > 0 ? `${safeTitle}\n${noteBody}` : safeTitle;
      onUpdate({ noteTitle: safeTitle, noteBody, content: combined });
    },
  );
  const [localTaskContent, setLocalTaskContent] = useLocalInput(
    element.content || "",
    (v) => onUpdate({ content: v }),
  );
  const [localTaskDescription, setLocalTaskDescription] = useLocalInput(
    element.taskMetadata?.description || "",
    (v) => onUpdate({ taskMetadata: { ...element.taskMetadata, description: v } }),
  );
  const renderedNoteBody = useMemo(
    () => DOMPurify.sanitize(
      noteBody
        .replace(/<p>\s*<\/p>/gi, "<p><br></p>")
        .replace(/>\s*\n+\s*</g, '><'),
      { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }
    ),
    [noteBody],
  );

  // Get the store methods for navigation
  const setCanvasViewMode = useCXDStore((state) => state.setCanvasViewMode);
  const setViewMode = useCXDStore((state) => state.setViewMode);

  // Document mode state
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);

  useEffect(() => {
    if (!isSelected) {
      setNoteEditingField(null);
      setNoteToolbarMenu("none");
    }
  }, [isSelected]);

  useEffect(() => {
    pendingNoteBodyRef.current = noteBody;
  }, [noteBody]);

  useEffect(() => {
    if (!isNoteFocusMode) {
      setShowFocusNoteColorPicker(false);
    }
  }, [isNoteFocusMode]);

  useEffect(() => {
    if (!isNoteFocusMode) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowFocusNoteColorPicker(false);
        setIsNoteFocusMode(false);
      }
    };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [isNoteFocusMode]);

  useEffect(() => {
    if (!isNote) return;
    if (noteEditingField !== "body") return;
    if (!noteBodyRef.current) return;
    const active = document.activeElement;
    if (active !== noteBodyRef.current) {
      noteBodyRef.current.innerHTML = DOMPurify.sanitize(noteBody || "", { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] });
    }
  }, [isNote, noteBody, noteEditingField]);

  // Handle clicks outside document to blur title input
  useEffect(() => {
    if (!element.isDocument) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        // Click was outside the card, blur any focused input
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLTextAreaElement || activeElement instanceof HTMLInputElement) {
          if (cardRef.current.contains(activeElement)) {
            activeElement.blur();
          }
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [element.isDocument]);

  const updateNoteStyleFromSelection = useCallback(() => {
    if (!isNote || noteEditingField !== "body") return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !noteBodyRef.current) return;
    const anchorNode = sel.anchorNode;
    if (!anchorNode) return;
    const anchorElement =
      anchorNode.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : (anchorNode as HTMLElement);
    if (!anchorElement || !noteBodyRef.current.contains(anchorElement)) return;
    const block = anchorElement.closest("h1,h2,h3,h4,small,p,div,li");
    if (!block) return;
    const tag = block.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2") setNoteTextStyle("heading");
    else if (tag === "h3" || tag === "h4") setNoteTextStyle("subheading");
    else if (tag === "small") setNoteTextStyle("small");
    else setNoteTextStyle("body");
  }, [isNote, noteEditingField]);

  useEffect(() => {
    if (!isNote || noteEditingField !== "body") return;
    const onSelectionChange = () => updateNoteStyleFromSelection();
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [isNote, noteEditingField, updateNoteStyleFromSelection]);

  const syncNoteFields = useCallback(
    (nextTitle: string, nextBody: string) => {
      const safeTitle = nextTitle.trim() || "Untitled Note";
      const combined = nextBody.trim().length > 0 ? `${safeTitle}\n${nextBody}` : safeTitle;
      onUpdate({
        noteTitle: safeTitle,
        noteBody: nextBody,
        content: combined,
      });
    },
    [onUpdate],
  );

  const handleNoteFieldBlur = useCallback(() => {
    requestAnimationFrame(() => {
      const active = document.activeElement;
      if (!cardRef.current?.contains(active)) {
        setNoteEditingField(null);
        handleBlur();
      }
    });
  }, [handleBlur]);

  // Convert note to document
  const handleToggleDocumentMode = useCallback(() => {
    if (element.isDocument) {
      // Revert to note
      onUpdate({
        isDocument: false,
        wordCount: undefined,
        width: 300,
        height: 300,
      });
    } else {
      // Convert to document
      // Calculate word count from noteBody
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = DOMPurify.sanitize(noteBody || "", { USE_PROFILES: { html: true } });
      const textContent = tempDiv.textContent || tempDiv.innerText || '';
      const wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

      // Update element to be a document
      onUpdate({
        isDocument: true,
        wordCount,
        width: 100,
        height: 100,
      });

      // Exit editing mode
      handleBlur();
    }
  }, [element.isDocument, noteBody, onUpdate, handleBlur]);

  // Handle description key events - allow normal line breaks
  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Prevent backspace/delete from deleting the card element
    if (e.key === "Backspace" || e.key === "Delete") {
      e.stopPropagation();
    }

    // Allow Enter to work normally for line breaks
    if (e.key === "Enter") {
      e.stopPropagation(); // Just stop propagation, don't prevent default
    }
  };

  // Handle markdown-like triggers for title
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
          setLocalTaskContent(newValue);
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
          setLocalTaskContent(newValue);
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
          setLocalTaskContent(newValue);
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
          setLocalTaskContent(newValue);
          setTimeout(() => {
            const newPos = selectionEnd + indent.length + 5;
            textarea.setSelectionRange(newPos, newPos);
          }, 0);
        }
      } else {
        // Normal newline
        const newValue =
          value.substring(0, selectionEnd) +
          "\n" +
          value.substring(selectionEnd);
        setLocalTaskContent(newValue);
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
        setLocalTaskContent(newValue);
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
        setLocalTaskContent(newValue);
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
        setLocalTaskContent(newValue);
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
        setLocalTaskContent(newValue);
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos, lineStartPos);
        }, 0);
      } else if (
        todoMatch &&
        selectionStart === lineStartPos + currentLine.length
      ) {
        e.preventDefault();
        // Remove the todo marker
        const newValue =
          value.substring(0, lineStartPos) + value.substring(selectionEnd);
        setLocalTaskContent(newValue);
        setTimeout(() => {
          textarea.setSelectionRange(lineStartPos, lineStartPos);
        }, 0);
      }
    }
  };

  // adjustNoteHeight is now a lightweight no-op fallback.
  // The ResizeObserver on elementRef (in CanvasElementRenderer) handles
  // syncing element.height with actual DOM size for note cards.
  const adjustNoteHeight = useCallback(() => {
    // no-op — ResizeObserver handles height syncing
  }, []);

  const ensureNoteEditorFocus = useCallback(() => {
    if (!isNote) return;
    if (document.activeElement !== noteBodyRef.current) {
      noteBodyRef.current?.focus();
    }
  }, [isNote]);

  const placeCaretAtPoint = useCallback((clientX: number, clientY: number) => {
    const editor = noteBodyRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection) return;

    const docWithCaret = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };

    let range: Range | null = null;
    const caretPos = docWithCaret.caretPositionFromPoint?.(clientX, clientY) ?? null;
    if (caretPos) {
      range = document.createRange();
      range.setStart(caretPos.offsetNode, caretPos.offset);
      range.collapse(true);
    } else {
      range = docWithCaret.caretRangeFromPoint?.(clientX, clientY) ?? null;
    }

    if (!range || !editor.contains(range.startContainer)) {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const applyNoteCommand = useCallback(
    (command: string, value?: string) => {
      if (!isNote) return;
      ensureNoteEditorFocus();
      document.execCommand(command, false, value);
      const html = noteBodyRef.current?.innerHTML ?? "";
      pendingNoteBodyRef.current = html;
      syncNoteFields(noteTitle, html);
      adjustNoteHeight();
    },
    [adjustNoteHeight, ensureNoteEditorFocus, isNote, noteTitle, syncNoteFields],
  );

  const applyNoteTextStyle = useCallback(
    (style: "heading" | "subheading" | "body" | "small") => {
      if (!isNote) return;
      ensureNoteEditorFocus();
      if (style === "heading") {
        document.execCommand("formatBlock", false, "h2");
      } else if (style === "subheading") {
        document.execCommand("formatBlock", false, "h4");
      } else if (style === "small") {
        document.execCommand("formatBlock", false, "small");
      } else {
        document.execCommand("formatBlock", false, "p");
      }
      const html = noteBodyRef.current?.innerHTML ?? "";
      pendingNoteBodyRef.current = html;
      syncNoteFields(noteTitle, html);
      setNoteTextStyle(style);
    },
    [ensureNoteEditorFocus, isNote, noteTitle, syncNoteFields],
  );

  const applyNoteLink = useCallback(() => {
    if (!isNote) return;
  }, [isNote]);

  const handleNoteKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!isNote) return;
    const isMod = e.ctrlKey || e.metaKey;
    if (!isMod) return;
    const key = e.key.toLowerCase();
    if (key === "b") {
      e.preventDefault();
      applyNoteCommand("bold");
    } else if (key === "i") {
      e.preventDefault();
      applyNoteCommand("italic");
    } else if (key === "u") {
      e.preventDefault();
      applyNoteCommand("underline");
    }
  }, [isNote, applyNoteCommand]);

  // Render content with markdown-like formatting
  const renderContent = (content: string) => {
    if (!content) {
      return <span className="text-white/40">Double-click to edit</span>;
    }

    const lines = content.split("\n");
    let titleRendered = false;

    return (
      <div className="space-y-1">
        {lines.map((line, idx) => {
          // First non-empty line becomes the title (larger text, no markdown)
          if (
            !titleRendered &&
            line.trim() !== "" &&
            !line.match(/^(\s*)(- |\[[ x]\] )/)
          ) {
            titleRendered = true;
            return (
              <div
                key={idx}
                className="text-2xl font-bold mb-3 pb-2 border-b border-white/10"
              >
                {line}
              </div>
            );
          }

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
                      : "border-white/40 hover:border-white/60",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle checkbox in content
                    const newContent = content
                      .split("\n")
                      .map((l, i) => {
                        if (i === idx) {
                          return l.replace(
                            /\[([ x])\]/,
                            isChecked ? "[ ]" : "[x]",
                          );
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
                <span className={cn(isChecked && "line-through opacity-60")}>
                  {text}
                </span>
              </div>
            );
          }

          // Regular text
          return <div key={idx}>{line || <br />}</div>;
        })}
      </div>
    );
  };

  const isActionable = isTask;
  const taskStatus = element.taskMetadata?.status || "not_started";
  const statusDisplay = taskStatus.replace("_", " ");
  const statusClasses: Record<string, string> = {
    not_started: "bg-slate-500/20 text-slate-300 border-slate-400/30",
    in_progress: "bg-blue-500/20 text-blue-300 border-blue-400/30",
    blocked: "bg-rose-500/20 text-rose-300 border-rose-400/30",
    completed: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
  };
  const assigneeTagPalette = [
    "bg-violet-500/20 text-violet-200 border-violet-400/30",
    "bg-cyan-500/20 text-cyan-200 border-cyan-400/30",
    "bg-emerald-500/20 text-emerald-200 border-emerald-400/30",
    "bg-amber-500/20 text-amber-200 border-amber-400/30",
    "bg-fuchsia-500/20 text-fuchsia-200 border-fuchsia-400/30",
  ];
  const assignees = parseAssignees(element.taskMetadata?.assignee);
  const assigneeTagClass = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return assigneeTagPalette[hash % assigneeTagPalette.length];
  };

  return (
    <div
      ref={cardRef}
      className={cn(
        "w-full overflow-visible flex flex-col relative",
        !element.isDocument && "rounded-lg shadow-md",
        isNote && "card--note-resizable",
        className,
      )}
      style={{
        background: element.isDocument ? "transparent" : bgColor,
        border: element.isDocument ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
        boxShadow: element.isDocument ? "none" : "0 2px 8px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.1) inset",
        minWidth: element.isDocument ? "100px" : isNote ? "200px" : "100%",
        maxWidth: element.isDocument ? "100px" : undefined,
        minHeight: element.isDocument ? "100px" : isNote ? "300px" : "100%",
      }}
    >
      {/* Task indicator - subtle corner badge */}
      {isActionable && !element.isDocument && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30 z-10"
          title="Actionable task"
        />
      )}
      {/* Emoji display (top-left) - hide for documents */}
      {element.emoji && !element.isDocument && (
        <div className="top-2 text-lg leading-none z-10 right-[auto] left-[50%] static w-full text-center py-[7px]">
          {element.emoji}
        </div>
      )}
      {/* Content */}
      <div
        className={`${element.isDocument ? "" : "p-3"} flex flex-col gap-2 ${element.emoji && !element.isDocument ? "" : " pt-[0]"}`}
      >
        {element.isDocument && !isEditing ? (
          // Document icon view (compact - no padding/margin)
          <div
            className="w-full h-full flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105"
            onDoubleClick={(e) => { e.stopPropagation(); setIsNoteFocusMode(true); }}
          >
            <div className="text-4xl mb-1">{element.emoji || '📄'}</div>
            <div className="w-full px-1">
              <textarea
                value={localNoteTitle}
                onChange={(e) => {
                  setLocalNoteTitle(e.target.value);
                  // Auto-resize height
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Auto-select all text on click
                  (e.target as HTMLTextAreaElement).select();
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation(); // Prevent opening focus mode
                }}
                onFocus={(e) => {
                  // Auto-select all text when focused
                  e.target.select();
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                }}
                onBlur={() => {
                  // Deselect when clicking outside - handled by browser
                }}
                className="text-[10px] font-semibold text-center text-white bg-transparent border-none outline-none w-full hover:bg-white/5 rounded focus:bg-white/10 resize-none overflow-y-hidden"
                style={{
                  lineHeight: "0.875rem",
                  wordWrap: "break-word",
                  whiteSpace: "pre-wrap",
                  minHeight: "0.875rem"
                }}
              />
            </div>
          </div>
        ) : isEditing ? (
          isNote ? (
            <div ref={noteContentRef} className="flex min-h-0 flex-1 flex-col gap-2">
              {/* Toolbar buttons */}
              <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleDocumentMode();
                  }}
                  className="rounded p-1 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white transition-all"
                  title={element.isDocument ? "Revert to Note" : "Convert to Document"}
                  data-no-drag
                >
                  <FileText className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNoteFocusMode(true);
                  }}
                  className="rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white"
                  title="Focus editor"
                  data-no-drag
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <Input
                autoFocus={noteEditingField === "title"}
                value={localNoteTitle}
                onChange={(e) => setLocalNoteTitle(e.target.value)}
                onBlur={handleNoteFieldBlur}
                onFocus={() => setNoteEditingField("title")}
                className="h-9 border-0 bg-transparent p-0 text-lg font-semibold focus-visible:ring-0"
                style={{ color: textColor }}
                data-no-drag
              />
              <div className="h-px bg-white/10" />
              <div
                className="w-full flex-1 min-h-0"
                onMouseDown={(e) => e.stopPropagation()}
                data-no-drag
              >
                <NoteRichTextEditor
                  value={noteBody}
                  textColor={textColor}
                  isSelected={isSelected}
                  onChange={(nextHtml) => syncNoteFields(noteTitle, nextHtml)}
                  onBlurCard={handleNoteFieldBlur}
                  onFocusBody={() => setNoteEditingField("body")}
                  onHeightChange={adjustNoteHeight}
                />
              </div>
            </div>
          ) : (
            <>
              {/* Title Input */}
              <Textarea
                ref={textareaRef}
                autoFocus
                value={localTaskContent}
                onChange={(e) => setLocalTaskContent(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleTitleKeyDown}
                onFocus={(e) => {
                  // Select all text when focused if it's still the default placeholder
                  if (element.content === "Task Title") {
                    e.target.select();
                  }
                }}
                className="w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-white placeholder:text-white/40 text-xl font-bold"
                style={{
                  color: textColor,
                  fontWeight: "bold",
                  fontSize: "1.25rem",
                  lineHeight: "1.75rem",
                  minHeight: "1.75rem",
                  height: "auto",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
                placeholder="Enter title..."
                data-no-drag
                rows={1}
              />

              {/* Description Input */}
              <Textarea
                ref={descriptionRef}
                value={localTaskDescription}
                onChange={(e) => {
                  setLocalTaskDescription(e.target.value);
                  // Auto-expand textarea
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                onBlur={handleBlur}
                onKeyDown={handleDescriptionKeyDown}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => {
                  e.stopPropagation();
                  // Ensure proper height on focus
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                placeholder="Add description..."
                className="w-full resize-none border-0 bg-transparent p-0 focus-visible:ring-0 text-white/70 placeholder:text-white/30 text-sm"
                style={{
                  color: textColor,
                  opacity: 0.7,
                  minHeight: "3rem",
                  height: "auto",
                  wordWrap: "break-word",
                  overflowWrap: "break-word",
                }}
                data-no-drag
                rows={2}
              />
            </>
          )
        ) : (
          <>
            {isNote ? (
              <div ref={noteContentRef} className="w-full min-h-0 flex-1 flex flex-col gap-2">
                {/* Toolbar buttons - always visible */}
                <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDocumentMode();
                    }}
                    className="rounded p-1 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white transition-all"
                    title={element.isDocument ? "Revert to Note" : "Convert to Document"}
                    data-no-drag
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartEdit();
                      setNoteEditingField("body");
                      setIsNoteFocusMode(true);
                    }}
                    className="rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white"
                    title="Focus editor"
                    data-no-drag
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartEdit();
                    setNoteEditingField("title");
                  }}
                  className="w-full text-left text-lg font-semibold break-words rounded px-0.5 py-0.5 hover:bg-white/5 cursor-text"
                  style={{ color: textColor, whiteSpace: "pre-wrap" }}
                  data-no-drag
                >
                  {noteTitle || "Untitled Note"}
                </div>
                <div className="h-px bg-white/10" />
                <div
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onStartEdit();
                    setNoteEditingField("body");
                  }}
                  className="min-h-0 flex-1 rounded px-0.5 py-0.5 text-left text-sm leading-relaxed hover:bg-white/5 cursor-text w-full overflow-hidden"
                  style={{ color: textColor }}
                  data-no-drag
                >
                  {noteBody.trim().length > 0 ? (
                    <div
                      className="w-full break-words overflow-wrap-anywhere [&_a]:text-purple-300 [&_a]:underline [&_h1]:mt-1 [&_h1]:mb-0.5 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-1 [&_h2]:mb-0.5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-0.5 [&_h3]:mb-0 [&_h3]:text-base [&_h3]:font-semibold [&_p]:my-0.5 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p]:break-words [&_h1]:break-words [&_h2]:break-words [&_h3]:break-words [&_li]:break-words"
                      style={{ wordWrap: "break-word", overflowWrap: "anywhere" }}
                      dangerouslySetInnerHTML={{ __html: renderedNoteBody }}
                    />
                  ) : (
                    <span className="text-white/40">Write your note...</span>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Title Display */}
                <div
                  className="w-full text-xl font-bold break-words whitespace-pre-wrap flex-shrink-0"
                  style={{
                    color: textColor,
                    wordWrap: "break-word",
                    overflowWrap: "break-word",
                  }}
                >
                  {element.content || "Untitled"}
                </div>

                {/* Description Display */}
                {element.taskMetadata?.description && (
                  <div
                    className="w-full text-sm opacity-70 break-words whitespace-pre-wrap"
                    style={{
                      color: textColor,
                      wordWrap: "break-word",
                      overflowWrap: "break-word",
                    }}
                  >
                    {element.taskMetadata.description}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Subtasks section - only for actionable cards with taskMetadata */}
        {isActionable && element.taskMetadata && (
          <div
            className="mt-2 pt-2 border-t border-white/10 space-y-2"
            data-no-drag
          >
            {/* Existing subtasks */}
            {Array.isArray(element.taskMetadata.subtasks) &&
              element.taskMetadata.subtasks.length > 0 && (
                <div className="space-y-1.5">
                  {[...element.taskMetadata.subtasks]
                    .sort((a, b) => a.order - b.order)
                    .map((subtask, index) => (
                      <div
                        key={subtask.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("subtask-id", subtask.id);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const draggedId =
                            e.dataTransfer.getData("subtask-id");
                          if (draggedId && draggedId !== subtask.id) {
                            const updatedSubtasks = [
                              ...(element.taskMetadata?.subtasks || []),
                            ];
                            const draggedIndex = updatedSubtasks.findIndex(
                              (st) => st.id === draggedId,
                            );
                            const targetIndex = updatedSubtasks.findIndex(
                              (st) => st.id === subtask.id,
                            );

                            if (draggedIndex !== -1 && targetIndex !== -1) {
                              const [draggedItem] = updatedSubtasks.splice(
                                draggedIndex,
                                1,
                              );
                              updatedSubtasks.splice(
                                targetIndex,
                                0,
                                draggedItem,
                              );

                              // Update order numbers
                              updatedSubtasks.forEach((st, idx) => {
                                st.order = idx;
                              });

                              onUpdate({
                                taskMetadata: {
                                  ...element.taskMetadata,
                                  subtasks: updatedSubtasks,
                                },
                              });
                            }
                          }
                        }}
                        className="flex items-center gap-2 group cursor-move hover:bg-white/5 p-1.5 rounded"
                      >
                        <GripVertical className="w-3 h-3 text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedSubtasks =
                              element.taskMetadata?.subtasks?.map((st) =>
                                st.id === subtask.id
                                  ? { ...st, isCompleted: !st.isCompleted }
                                  : st,
                              ) || [];
                            onUpdate({
                              taskMetadata: {
                                ...element.taskMetadata,
                                subtasks: updatedSubtasks,
                              },
                            });
                          }}
                          className="w-4 h-4 rounded border border-white/30 flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors"
                        >
                          {subtask.isCompleted && (
                            <svg
                              className="w-3 h-3 text-purple-400"
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
                        <textarea
                          ref={(el) => {
                            if (el) {
                              subtaskRefs.current.set(subtask.id, el);
                              // Auto-focus if this is the newly created subtask
                              if (focusedSubtaskId === subtask.id) {
                                el.focus();
                                el.select();
                                setFocusedSubtaskId(null);
                              }
                            } else {
                              subtaskRefs.current.delete(subtask.id);
                            }
                          }}
                          value={subtask.text}
                          onChange={(e) => {
                            e.stopPropagation();
                            const updatedSubtasks =
                              element.taskMetadata?.subtasks?.map((st) =>
                                st.id === subtask.id
                                  ? { ...st, text: e.target.value }
                                  : st,
                              ) || [];
                            onUpdate({
                              taskMetadata: {
                                ...element.taskMetadata,
                                subtasks: updatedSubtasks,
                              },
                            });
                            // Auto-resize textarea
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onKeyDown={(e) => {
                            e.stopPropagation();
                            // Enter creates new subtask (unless Shift is held for line break)
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              const newSubtaskId = `subtask-${Date.now()}`;
                              const currentIndex = element.taskMetadata?.subtasks?.findIndex(
                                (st) => st.id === subtask.id
                              ) ?? -1;
                              const newSubtask: import("@/types/canvas-elements").Subtask = {
                                id: newSubtaskId,
                                text: "",
                                isCompleted: false,
                                order: currentIndex + 1,
                              };
                              // Insert after current subtask and reorder
                              const currentSubtasks = element.taskMetadata?.subtasks || [];
                              const updatedSubtasks = [
                                ...currentSubtasks.slice(0, currentIndex + 1),
                                newSubtask,
                                ...currentSubtasks.slice(currentIndex + 1).map((st) => ({
                                  ...st,
                                  order: st.order + 1,
                                })),
                              ];
                              onUpdate({
                                taskMetadata: {
                                  ...element.taskMetadata,
                                  subtasks: updatedSubtasks,
                                },
                              });
                              // Set focus to the new subtask
                              setFocusedSubtaskId(newSubtaskId);
                            }
                            // Prevent backspace/delete from bubbling when at start of empty field
                            if ((e.key === 'Backspace' || e.key === 'Delete') && subtask.text === '') {
                              e.preventDefault();
                              // Delete this subtask and focus previous one
                              const currentIndex = element.taskMetadata?.subtasks?.findIndex(
                                (st) => st.id === subtask.id
                              ) ?? -1;
                              const prevSubtask = element.taskMetadata?.subtasks?.[currentIndex - 1];
                              const updatedSubtasks =
                                element.taskMetadata?.subtasks?.filter(
                                  (st) => st.id !== subtask.id,
                                ) || [];
                              onUpdate({
                                taskMetadata: {
                                  ...element.taskMetadata,
                                  subtasks: updatedSubtasks,
                                },
                              });
                              if (prevSubtask) {
                                setFocusedSubtaskId(prevSubtask.id);
                              }
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          rows={1}
                          className={cn(
                            "text-xs flex-1 bg-transparent border-0 outline-none focus:outline-none text-white p-0 resize-none overflow-hidden break-words",
                            subtask.isCompleted && "line-through opacity-60",
                          )}
                          style={{
                            minHeight: '1.25rem',
                            lineHeight: '1.25rem',
                          }}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const updatedSubtasks =
                              element.taskMetadata?.subtasks?.filter(
                                (st) => st.id !== subtask.id,
                              ) || [];
                            onUpdate({
                              taskMetadata: {
                                ...element.taskMetadata,
                                subtasks: updatedSubtasks,
                              },
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                </div>
              )}

            {/* Add new subtask */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const newSubtaskId = `subtask-${Date.now()}`;
                const newSubtask: import("@/types/canvas-elements").Subtask = {
                  id: newSubtaskId,
                  text: "",
                  isCompleted: false,
                  order: element.taskMetadata?.subtasks?.length || 0,
                };
                onUpdate({
                  taskMetadata: {
                    ...element.taskMetadata,
                    subtasks: [
                      ...(element.taskMetadata?.subtasks || []),
                      newSubtask,
                    ],
                  },
                });
                // Focus the new subtask
                setFocusedSubtaskId(newSubtaskId);
              }}
              className="flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors w-full"
            >
              <Plus className="w-3 h-3" />
              Add subtask
            </button>
          </div>
        )}
      </div>
      {/* Task Properties Display - only show for actionable cards */}
      {isActionable && element.taskMetadata && (
        <div className="px-3 pb-3 pt-1 border-t border-white/10 space-y-2">
          {/* Status - Editable */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50 min-w-[60px]">Status:</span>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    "h-6 rounded border px-2 text-xs capitalize focus:outline-none focus:ring-1 focus:ring-purple-400/40",
                    statusClasses[taskStatus] || "bg-zinc-900/80 border-zinc-700/70 text-zinc-100",
                  )}
                >
                  {statusDisplay}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="z-[230] bg-zinc-950/95 border border-zinc-700/70 text-zinc-100 rounded-lg p-1.5 min-w-[150px]"
                onClick={(e) => e.stopPropagation()}
              >
                {[
                  { value: "not_started", label: "Not Started" },
                  { value: "in_progress", label: "In Progress" },
                  { value: "blocked", label: "Blocked" },
                  { value: "completed", label: "Completed" },
                ].map((statusOpt) => (
                  <DropdownMenuItem
                    key={statusOpt.value}
                    className="text-xs rounded-md hover:bg-zinc-800/80 focus:bg-zinc-800/80"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdate({
                        taskMetadata: {
                          ...element.taskMetadata,
                          status: statusOpt.value as any,
                        },
                      } as Partial<FreeformElement>);
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          statusOpt.value === "not_started" && "bg-slate-300",
                          statusOpt.value === "in_progress" && "bg-blue-300",
                          statusOpt.value === "blocked" && "bg-rose-300",
                          statusOpt.value === "completed" && "bg-emerald-300",
                        )}
                      />
                      {statusOpt.label}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Priority - Editable */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50 min-w-[60px]">Priority:</span>
            <div ref={taskPriorityMenuRef} className="relative flex-1">
              {element.taskMetadata.priority ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTaskPriorityMenu(!showTaskPriorityMenu);
                  }}
                  className={cn("px-2 py-0.5 rounded capitalize hover:ring-1 hover:ring-white/20 transition-all flex items-center gap-1", {
                    "bg-red-500/20 text-red-400": element.taskMetadata.priority === "urgent",
                    "bg-orange-500/20 text-orange-400": element.taskMetadata.priority === "high",
                    "bg-yellow-500/20 text-yellow-400": element.taskMetadata.priority === "medium",
                    "bg-blue-500/20 text-blue-400": element.taskMetadata.priority === "low",
                  })}
                >
                  {element.taskMetadata.priority}
                  <ChevronDown className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTaskPriorityMenu(!showTaskPriorityMenu);
                  }}
                  className="px-2 py-0.5 rounded bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70 transition-all text-xs"
                >
                  Set Priority
                </button>
              )}

              {showTaskPriorityMenu && (
                <div className="absolute top-full left-0 mt-1 bg-card backdrop-blur-xl border border-white/10 rounded-lg shadow-xl z-[100] min-w-[120px]">
                  {[
                    { value: 'urgent', label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
                    { value: 'high', label: 'High', color: 'bg-orange-500/20 text-orange-400' },
                    { value: 'medium', label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400' },
                    { value: 'low', label: 'Low', color: 'bg-blue-500/20 text-blue-400' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdate({
                          taskMetadata: {
                            ...element.taskMetadata,
                            priority: opt.value as any,
                          }
                        } as Partial<FreeformElement>);
                        setShowTaskPriorityMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/5 transition-colors first:rounded-t-lg last:rounded-b-lg text-left"
                    >
                      <div className={cn("w-2 h-2 rounded-full", opt.color)} />
                      {opt.label}
                    </button>
                  ))}
                  {element.taskMetadata.priority && (
                    <>
                      <div className="h-px bg-white/10 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdate({
                            taskMetadata: {
                              ...element.taskMetadata,
                              priority: undefined,
                            }
                          } as Partial<FreeformElement>);
                          setShowTaskPriorityMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 hover:bg-white/5 transition-colors rounded-b-lg"
                      >
                        <X className="w-2.5 h-2.5" />
                        Clear
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Start Date - Editable */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50 min-w-[60px]">Start:</span>
            <DatePicker
              date={element.taskMetadata.startDate ? new Date(element.taskMetadata.startDate) : undefined}
              onSelect={(nextDate) => {
                onUpdate({
                  taskMetadata: {
                    ...element.taskMetadata,
                    startDate: nextDate ? nextDate.toISOString() : undefined,
                  }
                } as Partial<FreeformElement>);
              }}
              placeholder="Set Start"
              fitContent
              triggerClassName="h-6 px-2 py-0.5 text-[11px] bg-zinc-900/80 border-zinc-700/70 text-zinc-100"
            />
          </div>

          {/* Due Date - Editable */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50 min-w-[60px]">Due:</span>
            <DatePicker
              date={element.taskMetadata.dueDate ? new Date(element.taskMetadata.dueDate) : undefined}
              onSelect={(nextDate) => {
                onUpdate({
                  taskMetadata: {
                    ...element.taskMetadata,
                    dueDate: nextDate ? nextDate.toISOString() : undefined,
                  }
                } as Partial<FreeformElement>);
              }}
              placeholder="Set Due Date"
              fitContent
              triggerClassName="h-6 px-2 py-0.5 text-[11px] bg-zinc-900/80 border-zinc-700/70 text-zinc-100"
            />
          </div>

          {/* Assignee - Editable */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white/50 min-w-[60px]">Assignee:</span>
            <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
              <AssigneeMultiSelect
                value={assignees}
                onChange={(next) => {
                  onUpdate({
                    taskMetadata: {
                      ...element.taskMetadata,
                      assignee: serializeAssignees(next),
                    },
                  } as Partial<FreeformElement>);
                }}
                compact
                iconOnly
              />
              {assignees.length === 0 && (
                <span className="text-[10px] text-white/45">Unassigned</span>
              )}
              {assignees.map((name) => (
                <span
                  key={name}
                  className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] border",
                    assigneeTagClass(name),
                  )}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* View in Plan button - only for actionable cards */}
      {isActionable && (
        <div className="absolute bottom-3 right-3">
          <button
            title="View in Plan"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to plan view using store methods
              setViewMode("canvas");
              setCanvasViewMode("plan");
            }}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 flex items-center justify-center shadow-lg transition-all hover:scale-110"
            style={{
              boxShadow: "0 4px 12px rgba(168, 85, 247, 0.3)",
            }}
          >
            <ListTodo className="w-4 h-4 text-white" />
          </button>
        </div>
      )}
      {isNote &&
        isNoteFocusMode &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowFocusNoteColorPicker(false);
                setIsNoteFocusMode(false);
                onBlur();
              }
            }}
          >
            <div
              className="relative w-full max-w-3xl max-h-[85vh] overflow-visible rounded-xl border border-white/15 p-5 shadow-2xl"
              style={{
                background: bgColor,
                boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-3 top-3 rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white"
                onClick={() => {
                  setShowFocusNoteColorPicker(false);
                  setIsNoteFocusMode(false);
                  onBlur();
                }}
                title="Close focus mode"
              >
                <X className="h-4 w-4" />
              </button>
              <div
                className="absolute left-6 top-7 z-30"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className={cn(
                    "rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white",
                    showFocusNoteColorPicker && "bg-black/55 text-white",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFocusNoteColorPicker((prev) => !prev);
                  }}
                  title="Change note color"
                >
                  <Palette className="h-4 w-4" />
                </button>
                {showFocusNoteColorPicker && (
                  <ColorPicker
                    currentColor={bgColor}
                    onColorChange={(color) =>
                      onUpdate({ style: { ...element.style, bgColor: color } })
                    }
                    onClose={() => setShowFocusNoteColorPicker(false)}
                    position="below"
                  />
                )}
              </div>
              <div className="max-h-[calc(85vh-2.5rem)] overflow-y-auto pl-[52px] pr-2 [scrollbar-width:thin] [scrollbar-color:rgba(167,139,250,0.65)_rgba(255,255,255,0.08)] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-violet-400/60 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-white/10">
                <div className="flex flex-col gap-3">
                  <Input
                    autoFocus
                    value={noteTitle}
                    onChange={(e) => syncNoteFields(e.target.value, noteBody)}
                    onFocus={() => setNoteEditingField("title")}
                    className="h-11 border-0 bg-black/25 p-0 text-2xl font-semibold focus-visible:ring-0"
                    style={{ color: textColor }}
                    data-no-drag
                  />
                  <div className="h-px bg-white/10" />
                  <div className="min-h-[420px]">
                    <NoteRichTextEditor
                      value={noteBody}
                      textColor={textColor}
                      isSelected
                      isFocusMode
                      onChange={(nextHtml) => syncNoteFields(noteTitle, nextHtml)}
                      onBlurCard={() => { }}
                      onFocusBody={() => setNoteEditingField("body")}
                      onHeightChange={adjustNoteHeight}
                    />
                  </div>
                </div>
              </div>
              {/* Convert/Revert button - bottom left */}
              <div className="absolute left-6 bottom-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleDocumentMode();
                  }}
                  className="rounded p-1 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white transition-all shadow-md"
                  title={element.isDocument ? "Revert to Note" : "Convert to Document"}
                >
                  <FileText className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {/* Document Viewer Modal */}
      {showDocumentViewer && (
        <>
          {(() => {
            const { DocumentViewerModal } = require('./document-viewer-modal');
            return (
              <DocumentViewerModal
                element={element}
                onClose={() => setShowDocumentViewer(false)}
              />
            );
          })()}
        </>
      )}
    </div>
  );
}

// Image card component with upload
function ImageCard({
  element,
  onUpdate,
  isSelected,
  isReadOnly = false,
}: {
  element: ImageElement;
  onUpdate: (updates: Partial<ImageElement>) => void;
  isSelected: boolean;
  isReadOnly?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [hasImage, setHasImage] = useState(!!element.src);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [cropBox, setCropBox] = useState(
    element.imageEdits?.crop || { x: 0, y: 0, width: 100, height: 100 },
  );
  const [dragState, setDragState] = useState<{
    active: boolean;
    handle:
    | "tl"
    | "tr"
    | "bl"
    | "br"
    | "top"
    | "right"
    | "bottom"
    | "left"
    | "move"
    | null;
    startX: number;
    startY: number;
    startCrop: typeof cropBox;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

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

      // Calculate element dimensions based on image aspect ratio
      // Max size constraints for the canvas element
      const maxElementWidth = 400;
      const maxElementHeight = 400;
      const aspectRatio = width / height;

      let elementWidth = width;
      let elementHeight = height;

      // Scale down if image is too large
      if (elementWidth > maxElementWidth) {
        elementWidth = maxElementWidth;
        elementHeight = elementWidth / aspectRatio;
      }

      if (elementHeight > maxElementHeight) {
        elementHeight = maxElementHeight;
        elementWidth = elementHeight * aspectRatio;
      }

      // Ensure minimum size
      const minSize = 100;
      if (elementWidth < minSize) {
        elementWidth = minSize;
        elementHeight = elementWidth / aspectRatio;
      }

      onUpdate({
        src: urlData.publicUrl,
        imageMeta: {
          width,
          height,
          bytes: blob.size,
          originalName: file.name,
        },
        // Update element dimensions to match image aspect ratio
        width: Math.round(elementWidth),
        height: Math.round(elementHeight),
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

  // Handle crop box dragging
  const handleCropMouseDown = (
    e: React.MouseEvent,
    handle:
      | "tl"
      | "tr"
      | "bl"
      | "br"
      | "top"
      | "right"
      | "bottom"
      | "left"
      | "move",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState({
      active: true,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...cropBox },
    });
  };

  useEffect(() => {
    if (!dragState?.active) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !imageContainerRef.current) return;

      const rect = imageContainerRef.current.getBoundingClientRect();
      const deltaXPct = ((e.clientX - dragState.startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - dragState.startY) / rect.height) * 100;

      let newCrop = { ...dragState.startCrop };

      switch (dragState.handle) {
        case "move":
          newCrop.x = Math.max(
            0,
            Math.min(100 - newCrop.width, dragState.startCrop.x + deltaXPct),
          );
          newCrop.y = Math.max(
            0,
            Math.min(100 - newCrop.height, dragState.startCrop.y + deltaYPct),
          );
          break;
        case "tl":
          const maxDxTl = dragState.startCrop.width - 5;
          const maxDyTl = dragState.startCrop.height - 5;
          const dxTl = Math.max(
            -dragState.startCrop.x,
            Math.min(maxDxTl, deltaXPct),
          );
          const dyTl = Math.max(
            -dragState.startCrop.y,
            Math.min(maxDyTl, deltaYPct),
          );
          newCrop.x = dragState.startCrop.x + dxTl;
          newCrop.y = dragState.startCrop.y + dyTl;
          newCrop.width = dragState.startCrop.width - dxTl;
          newCrop.height = dragState.startCrop.height - dyTl;
          break;
        case "tr":
          const maxDyTr = dragState.startCrop.height - 5;
          const maxDxTr =
            100 - dragState.startCrop.x - dragState.startCrop.width;
          const dxTr = Math.min(
            maxDxTr,
            Math.max(-dragState.startCrop.width + 5, deltaXPct),
          );
          const dyTr = Math.max(
            -dragState.startCrop.y,
            Math.min(maxDyTr, deltaYPct),
          );
          newCrop.y = dragState.startCrop.y + dyTr;
          newCrop.width = dragState.startCrop.width + dxTr;
          newCrop.height = dragState.startCrop.height - dyTr;
          break;
        case "bl":
          const maxDxBl = dragState.startCrop.width - 5;
          const maxDyBl =
            100 - dragState.startCrop.y - dragState.startCrop.height;
          const dxBl = Math.max(
            -dragState.startCrop.x,
            Math.min(maxDxBl, deltaXPct),
          );
          const dyBl = Math.min(
            maxDyBl,
            Math.max(-dragState.startCrop.height + 5, deltaYPct),
          );
          newCrop.x = dragState.startCrop.x + dxBl;
          newCrop.width = dragState.startCrop.width - dxBl;
          newCrop.height = dragState.startCrop.height + dyBl;
          break;
        case "br":
          const maxDxBr =
            100 - dragState.startCrop.x - dragState.startCrop.width;
          const maxDyBr =
            100 - dragState.startCrop.y - dragState.startCrop.height;
          const dxBr = Math.min(
            maxDxBr,
            Math.max(-dragState.startCrop.width + 5, deltaXPct),
          );
          const dyBr = Math.min(
            maxDyBr,
            Math.max(-dragState.startCrop.height + 5, deltaYPct),
          );
          newCrop.width = dragState.startCrop.width + dxBr;
          newCrop.height = dragState.startCrop.height + dyBr;
          break;
        case "top":
          const maxDyTop = dragState.startCrop.height - 5;
          const dyTop = Math.max(
            -dragState.startCrop.y,
            Math.min(maxDyTop, deltaYPct),
          );
          newCrop.y = dragState.startCrop.y + dyTop;
          newCrop.height = dragState.startCrop.height - dyTop;
          break;
        case "bottom":
          const maxDyBottom =
            100 - dragState.startCrop.y - dragState.startCrop.height;
          const dyBottom = Math.min(
            maxDyBottom,
            Math.max(-dragState.startCrop.height + 5, deltaYPct),
          );
          newCrop.height = dragState.startCrop.height + dyBottom;
          break;
        case "left":
          const maxDxLeft = dragState.startCrop.width - 5;
          const dxLeft = Math.max(
            -dragState.startCrop.x,
            Math.min(maxDxLeft, deltaXPct),
          );
          newCrop.x = dragState.startCrop.x + dxLeft;
          newCrop.width = dragState.startCrop.width - dxLeft;
          break;
        case "right":
          const maxDxRight =
            100 - dragState.startCrop.x - dragState.startCrop.width;
          const dxRight = Math.min(
            maxDxRight,
            Math.max(-dragState.startCrop.width + 5, deltaXPct),
          );
          newCrop.width = dragState.startCrop.width + dxRight;
          break;
      }

      // Ensure crop stays in bounds
      newCrop.x = Math.max(0, Math.min(100 - newCrop.width, newCrop.x));
      newCrop.y = Math.max(0, Math.min(100 - newCrop.height, newCrop.y));
      newCrop.width = Math.max(5, Math.min(100 - newCrop.x, newCrop.width));
      newCrop.height = Math.max(5, Math.min(100 - newCrop.y, newCrop.height));

      setCropBox(newCrop);
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, cropBox]);

  const applyCrop = () => {
    // Use preCropBounds if re-cropping, otherwise current element bounds
    const base = element.imageEdits?.preCropBounds || {
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
    };

    // The cropBox is relative to the current element view.
    // If re-cropping (preCropBounds exists), compound with existing crop.
    const existingCrop = element.imageEdits?.preCropBounds
      ? (element.imageEdits.crop || { x: 0, y: 0, width: 100, height: 100 })
      : { x: 0, y: 0, width: 100, height: 100 };

    // Convert cropBox (relative to current view) to absolute crop (relative to original)
    const absoluteCrop = {
      x: existingCrop.x + (cropBox.x / 100) * existingCrop.width,
      y: existingCrop.y + (cropBox.y / 100) * existingCrop.height,
      width: (cropBox.width / 100) * existingCrop.width,
      height: (cropBox.height / 100) * existingCrop.height,
    };

    // Resize element to match the cropped area
    const newWidth = Math.max(20, base.width * (absoluteCrop.width / 100));
    const newHeight = Math.max(20, base.height * (absoluteCrop.height / 100));
    const newX = base.x + base.width * (absoluteCrop.x / 100);
    const newY = base.y + base.height * (absoluteCrop.y / 100);

    onUpdate({
      x: newX,
      y: newY,
      width: newWidth,
      height: newHeight,
      imageEdits: {
        ...element.imageEdits,
        crop: absoluteCrop,
        preCropBounds: base,
      },
    });
    setIsCropping(false);
    setIsEditMode(false);
  };

  const cancelCrop = () => {
    setCropBox(
      element.imageEdits?.preCropBounds
        ? { x: 0, y: 0, width: 100, height: 100 }
        : (element.imageEdits?.crop || { x: 0, y: 0, width: 100, height: 100 }),
    );
    setIsCropping(false);
  };

  const toggleFlipH = () => {
    onUpdate({
      imageEdits: {
        ...element.imageEdits,
        flipH: !element.imageEdits?.flipH,
      },
    });
  };

  const toggleFlipV = () => {
    onUpdate({
      imageEdits: {
        ...element.imageEdits,
        flipV: !element.imageEdits?.flipV,
      },
    });
  };

  const resetImage = () => {
    const preCrop = element.imageEdits?.preCropBounds;
    if (preCrop) {
      // Restore original element bounds
      onUpdate({
        x: preCrop.x,
        y: preCrop.y,
        width: preCrop.width,
        height: preCrop.height,
        imageEdits: undefined,
      });
    } else {
      onUpdate({ imageEdits: undefined });
    }
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    setIsEditMode(false);
  };

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

  // Get current edits
  const crop = element.imageEdits?.crop || {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  };
  const flipH = element.imageEdits?.flipH || false;
  const flipV = element.imageEdits?.flipV || false;
  const hasEdits =
    crop.x !== 0 ||
    crop.y !== 0 ||
    crop.width !== 100 ||
    crop.height !== 100 ||
    flipH ||
    flipV;

  // Image is loaded - show clean media tile
  return (
    <div
      className="w-full h-full relative"
      data-crop-mode={isCropping ? "true" : undefined}
    >
      <div
        ref={imageContainerRef}
        className={cn(
          "w-full h-full overflow-hidden rounded-lg transition-all relative",
          isSelected ? "ring-0" : "", // Selection ring is handled by parent
          isCropping && "ring-2 ring-cyan-400",
        )}
      >
        {element.imageEdits?.preCropBounds ? (
          <div
            className="w-full h-full"
            style={{
              backgroundImage: `url("${element.src}")`,
              backgroundSize: `${element.imageEdits.preCropBounds.width}px ${element.imageEdits.preCropBounds.height}px`,
              backgroundPosition: `${-(crop.x / 100) * element.imageEdits.preCropBounds.width}px ${-(crop.y / 100) * element.imageEdits.preCropBounds.height}px`,
              backgroundRepeat: "no-repeat",
              transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
            }}
          />
        ) : (
          <div
            className="w-full h-full relative"
            style={{
              clipPath: `inset(${crop.y}% ${100 - crop.x - crop.width}% ${100 - crop.y - crop.height}% ${crop.x}%)`,
            }}
          >
            <NextImage
              src={element.src}
              alt={element.alt || ""}
              fill
              className="w-full h-full object-contain"
              style={{
                objectFit: "contain",
                transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              }}
              onError={() => setHasImage(false)}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              unoptimized
            />
          </div>
        )}

        {/* Crop overlay */}
        {isCropping && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ pointerEvents: "none" }}
          >
            {/* Darkened areas outside crop */}
            <div
              className="absolute inset-0 bg-black/60"
              style={{ pointerEvents: "none" }}
            />

            {/* Crop box */}
            <div
              className="absolute border-2 border-cyan-400 bg-transparent"
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.width}%`,
                height: `${cropBox.height}%`,
                pointerEvents: "auto",
              }}
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const edge = 8;

                // Check if near edges/corners
                if (x < edge && y < edge) return;
                if (x > rect.width - edge && y < edge) return;
                if (x < edge && y > rect.height - edge) return;
                if (x > rect.width - edge && y > rect.height - edge) return;
                if (
                  y < edge ||
                  y > rect.height - edge ||
                  x < edge ||
                  x > rect.width - edge
                )
                  return;

                handleCropMouseDown(e, "move");
              }}
            >
              {/* Corner handles */}
              <div
                className="absolute w-3 h-3 bg-cyan-400 rounded-full -left-1.5 -top-1.5 cursor-nwse-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "tl")}
              />
              <div
                className="absolute w-3 h-3 bg-cyan-400 rounded-full -right-1.5 -top-1.5 cursor-nesw-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "tr")}
              />
              <div
                className="absolute w-3 h-3 bg-cyan-400 rounded-full -left-1.5 -bottom-1.5 cursor-nesw-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "bl")}
              />
              <div
                className="absolute w-3 h-3 bg-cyan-400 rounded-full -right-1.5 -bottom-1.5 cursor-nwse-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "br")}
              />

              {/* Edge handles */}
              <div
                className="absolute w-full h-2 -top-1 left-0 cursor-ns-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "top")}
              />
              <div
                className="absolute w-full h-2 -bottom-1 left-0 cursor-ns-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "bottom")}
              />
              <div
                className="absolute w-2 h-full -left-1 top-0 cursor-ew-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "left")}
              />
              <div
                className="absolute w-2 h-full -right-1 top-0 cursor-ew-resize"
                onMouseDown={(e) => handleCropMouseDown(e, "right")}
              />
            </div>
          </div>
        )}
      </div>
      {/* Edit toolbar - shown when selected */}
      {isSelected && !isCropping && !isReadOnly && (
        <div
          className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-10"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn(
              "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
              isEditMode && "bg-primary/20 text-primary",
            )}
            title="Edit Image"
          >
            <Crop className="w-4 h-4" />
          </button>
          {hasEdits && (
            <button
              onClick={resetImage}
              className="p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
              title="Reset Image"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
      {/* Edit panel */}
      {isEditMode && isSelected && !isCropping && !isReadOnly && (
        <div
          className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex flex-col gap-2 p-3 rounded-lg bg-card backdrop-blur border border-border shadow-lg z-10 min-w-[200px]"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="text-xs font-medium text-muted-foreground mb-1">
            Image Edits
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsCropping(true);
                // If element was already resized for crop, start fresh within current view
                setCropBox(
                  element.imageEdits?.preCropBounds
                    ? { x: 0, y: 0, width: 100, height: 100 }
                    : crop,
                );
              }}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-primary/10 hover:bg-primary/20 text-sm transition-colors"
            >
              <Crop className="w-3.5 h-3.5" />
              Crop
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleFlipH}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm transition-colors",
                flipH
                  ? "bg-primary/20 text-primary"
                  : "bg-primary/10 hover:bg-primary/20",
              )}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              Flip H
            </button>
            <button
              onClick={toggleFlipV}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded text-sm transition-colors",
                flipV
                  ? "bg-primary/20 text-primary"
                  : "bg-primary/10 hover:bg-primary/20",
              )}
            >
              <FlipVertical className="w-3.5 h-3.5" />
              Flip V
            </button>
          </div>
        </div>
      )}
      {/* Crop controls */}
      {isCropping && (
        <div
          className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card backdrop-blur border border-cyan-500/50 shadow-lg z-10"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={applyCrop}
            className="px-3 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-sm font-medium transition-colors"
          >
            Apply Crop
          </button>
          <button
            onClick={cancelCrop}
            className="px-3 py-1 rounded bg-primary/10 hover:bg-primary/20 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// Shape card component with editable text
function ShapeCard({
  element,
  onUpdate,
  isEditing,
  onBlur,
  isSelected,
  onCreateConnectedShape,
}: {
  element: ShapeElement;
  onUpdate: (updates: Partial<ShapeElement>) => void;
  isEditing: boolean;
  onBlur: (e?: React.FocusEvent) => void;
  isSelected?: boolean;
  onCreateConnectedShape?: (direction: "top" | "right" | "bottom" | "left") => void;
}) {
  const [localContent, setLocalContent] = useLocalInput(
    element.content || "",
    (v) => onUpdate({ content: v }),
  );

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

  // Helper to extract colors from gradient strings (defined before renderSVGShape uses it)
  const extractGradientColor = (gradient: string, position: number): string => {
    // Extract colors from linear-gradient string
    const matches = gradient.match(/#[0-9A-Fa-f]{6}/g);
    if (matches && matches.length > position) {
      return matches[position];
    }
    return "#a855f7"; // fallback
  };

  const isGradientStroke = borderColor?.includes("gradient");

  const renderSVGShape = () => {
    const fill = bgColor.includes("gradient")
      ? `url(#gradient-${element.id})`
      : getBackgroundWithOpacity(bgColor, fillOpacity);
    const stroke = isGradientStroke
      ? `url(#stroke-gradient-${element.id})`
      : borderColor;
    const strokeWidth = borderWidth;
    const opacity = bgColor.includes("gradient") ? fillOpacity / 100 : 1;

    // Build gradient defs for both fill and stroke
    const gradientDefs = (
      <defs>
        {bgColor.includes("gradient") && (
          <linearGradient
            id={`gradient-${element.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              style={{
                stopColor: extractGradientColor(bgColor, 0),
                stopOpacity: 1,
              }}
            />
            <stop
              offset="100%"
              style={{
                stopColor: extractGradientColor(bgColor, 1),
                stopOpacity: 1,
              }}
            />
          </linearGradient>
        )}
        {isGradientStroke && (
          <linearGradient
            id={`stroke-gradient-${element.id}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop
              offset="0%"
              style={{
                stopColor: extractGradientColor(borderColor, 0),
                stopOpacity: 1,
              }}
            />
            <stop
              offset="100%"
              style={{
                stopColor: extractGradientColor(borderColor, 1),
                stopOpacity: 1,
              }}
            />
          </linearGradient>
        )}
      </defs>
    );

    switch (element.shapeType) {
      case "circle":
        return (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 100 100"
            className="absolute inset-0"
            preserveAspectRatio="none"
            style={{ overflow: "visible" }}
          >
            {gradientDefs}
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
            style={{ overflow: "visible" }}
          >
            {gradientDefs}
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
            style={{ overflow: "visible" }}
          >
            {gradientDefs}
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
            style={{ overflow: "visible" }}
          >
            {gradientDefs}
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
            style={{ overflow: "visible" }}
          >
            {gradientDefs}
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
            style={{ overflow: "visible" }}
          >
            {gradientDefs}
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

  // Check if this shape is actionable
  const isActionable =
    element.taskMetadata?.isActionable ||
    element.content?.includes("[ ]") ||
    element.content?.includes("[x]") ||
    (element.hypercubeTags && element.hypercubeTags.length > 0);

  // Gradient text detection
  const isGradientText = textColor?.includes("gradient");
  const shapeTextAlign = element.style?.textAlign || 'center';
  const shapeFontStyle = element.style?.fontStyle || 'normal';
  const shapeTextDecoration = element.style?.textDecoration || 'none';

  // Common text styles (shared between editing and display)
  const baseTextStyle: React.CSSProperties = {
    fontSize: element.style?.fontSize || 14,
    fontWeight: element.style?.fontWeight === '300' ? 300 : element.style?.fontWeight || 'normal',
    fontFamily: element.style?.fontFamily || 'inherit',
    fontStyle: shapeFontStyle,
    textDecoration: shapeTextDecoration,
    textAlign: shapeTextAlign,
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    lineHeight: 1.3,
  };

  // Text color styles (gradient or solid)
  const textColorStyle: React.CSSProperties = isGradientText
    ? {
        background: textColor,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }
    : { color: textColor };

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-visible">
      {/* Task indicator */}
      {isActionable && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30 z-20"
          title="Actionable task"
        />
      )}
      {renderSVGShape()}
      <div
        className="absolute inset-0 z-10 overflow-hidden"
        style={{
          padding: '8%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: shapeTextAlign,
        }}
      >
        {isEditing ? (
          <textarea
            ref={(el) => {
              if (el) {
                el.focus();
                // Auto-size to content
                el.style.height = 'auto';
                el.style.height = `${Math.min(el.scrollHeight, el.parentElement?.clientHeight || 9999)}px`;
              }
            }}
            value={localContent}
            onChange={(e) => {
              setLocalContent(e.target.value);
              // Re-size on content change
              const target = e.target;
              target.style.height = 'auto';
              target.style.height = `${Math.min(target.scrollHeight, target.parentElement?.clientHeight || 9999)}px`;
            }}
            onBlur={onBlur}
            className="w-full bg-transparent border-0 focus:outline-none resize-none"
            style={{
              ...baseTextStyle,
              ...textColorStyle,
              maxHeight: '100%',
            }}
            placeholder="Text..."
            data-no-drag
          />
        ) : (
          <span
            key={isGradientText ? textColor : 'solid'}
            style={{
              ...baseTextStyle,
              ...textColorStyle,
              display: isGradientText ? 'inline-block' : 'block',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
            }}
          >
            {element.content}
          </span>
        )}
      </div>

      {/* Plus controls for flow continuation - appear when selected */}
      {isSelected && onCreateConnectedShape && (
        <>
          {/* Top plus */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateConnectedShape("top");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -top-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-all z-30 opacity-0 group-hover:opacity-100 hover:opacity-100"
            style={{ opacity: 1 }}
            title="Add shape above"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Right plus */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateConnectedShape("right");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 -right-4 -translate-y-1/2 w-6 h-6 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-all z-30"
            title="Add shape to right"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Bottom plus */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateConnectedShape("bottom");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-all z-30"
            title="Add shape below"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Left plus */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCreateConnectedShape("left");
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="absolute top-1/2 -left-4 -translate-y-1/2 w-6 h-6 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-all z-30"
            title="Add shape to left"
          >
            <Plus className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}

// Container card component (true grouping)

// Tint palette — matches SWATCH_COLORS in connector-radial-menu.tsx
const CONTAINER_TINTS = {
  violet:  { mid: '#7C3AED', light: '#C4B5FD' },
  ocean:   { mid: '#2563EB', light: '#67E8F9' },
  emerald: { mid: '#059669', light: '#6EE7B7' },
  sunset:  { mid: '#EA580C', light: '#FDE68A' },
  rose:    { mid: '#DB2777', light: '#FBCFE8' },
  glacier: { mid: '#475569', light: '#E2E8F0' },
} as const;

const TINT_ORDER = ['violet', 'ocean', 'emerald', 'sunset', 'rose', 'glacier'] as const;
type TintName = keyof typeof CONTAINER_TINTS;

/** Convert a 6-digit hex color to "r,g,b" string for use in rgba(). */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

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
  onBlur: (e?: React.FocusEvent) => void;
  isSelected: boolean;
  isDropTarget?: boolean;
}) {
  const tintName = (element.tintColor ?? 'violet') as TintName;
  const tint = CONTAINER_TINTS[tintName];

  // Live child count from store (returns a number so Zustand === comparison works)
  const childCount = useCXDStore(
    (state) =>
      (state.getCurrentProject()?.canvasLayout?.elements ?? []).filter(
        (el) => el.containerId === element.id,
      ).length,
  );

  const [localLabel, setLocalLabel] = useLocalInput(
    element.label ?? "",
    (v) => onUpdate({ label: v }),
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const dotButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const handleOutside = (e: PointerEvent) => {
      if (
        (pickerRef.current && pickerRef.current.contains(e.target as Node)) ||
        (dotButtonRef.current && dotButtonRef.current.contains(e.target as Node))
      ) return;
      setPickerOpen(false);
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [pickerOpen]);

  const handleLock = () => {
    const newLocked = !element.locked;
    // Lock/unlock the container itself
    onUpdate({ locked: newLocked });
    // Lock/unlock all current children (snapshot operation)
    const allEls =
      useCXDStore.getState().getCurrentProject()?.canvasLayout?.elements ?? [];
    allEls
      .filter((el) => el.containerId === element.id)
      .forEach((child) =>
        useCXDStore.getState().updateCanvasElement(child.id, { locked: newLocked }),
      );
  };

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{
        borderRadius: 14,
        background: `rgba(${hexToRgb(tint.mid)}, 0.08)`,
        border: `1px solid rgba(${hexToRgb(tint.mid)}, 0.35)`,
        boxShadow: isDropTarget
          ? `0 0 20px rgba(${hexToRgb(tint.mid)}, 0.45), inset 0 0 30px rgba(${hexToRgb(tint.mid)}, 0.12)`
          : `inset 0 0 30px rgba(${hexToRgb(tint.mid)}, 0.06)`,
      }}
    >
      {/* ── Header bar (always visible) ── */}
      <div
        className="flex items-center gap-1.5 px-2 flex-shrink-0 relative"
        style={{
          height: 28,
          background: `rgba(${hexToRgb(tint.mid)}, 0.12)`,
          borderBottom: element.collapsed
            ? 'none'
            : `1px solid rgba(${hexToRgb(tint.mid)}, 0.20)`,
        }}
      >
        {/* Color dot */}
        <button
          ref={dotButtonRef}
          className="w-3 h-3 rounded-full flex-shrink-0 focus:outline-none"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${tint.light}, ${tint.mid})`,
          }}
          onClick={(e) => { e.stopPropagation(); setPickerOpen((p) => !p); }}
          title="Change color"
        />

        {/* Color picker popup */}
        {pickerOpen && (
          <div
            ref={pickerRef}
            className="absolute top-8 left-0 flex gap-1.5 rounded-full px-2.5 py-2 border backdrop-blur-sm shadow-lg z-50"
            style={{
              background: 'rgba(15,12,25,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {TINT_ORDER.map((name) => {
              const c = CONTAINER_TINTS[name];
              return (
                <button
                  key={name}
                  title={name}
                  className="w-4 h-4 rounded-full transition-transform hover:scale-110 focus:outline-none flex-shrink-0"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.mid})`,
                    outline: tintName === name ? '2px solid rgba(255,255,255,0.9)' : 'none',
                    outlineOffset: 2,
                    boxShadow: tintName === name ? `0 0 6px ${c.mid}88` : 'none',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ tintColor: name });
                    setPickerOpen(false);
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Editable label */}
        {isEditing ? (
          <input
            autoFocus
            value={localLabel}
            onChange={(e) => setLocalLabel(e.target.value)}
            onBlur={onBlur}
            placeholder="Name"
            className="flex-1 min-w-0 bg-transparent border-0 p-0 focus:outline-none"
            style={{
              color: `rgba(${hexToRgb(tint.light)}, 0.85)`,
              fontFamily: "'Poppins', sans-serif",
              fontSize: 17,
              fontWeight: 600,
            }}
          />
        ) : (
          <span
            className="flex-1 min-w-0 truncate"
            style={{
              color: `rgba(${hexToRgb(tint.light)}, 0.85)`,
              fontFamily: "'Poppins', sans-serif",
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            {element.label || 'Name'}
          </span>
        )}

        {/* Item count badge */}
        <span
          className="text-[9px] px-1.5 py-0.5 rounded flex-shrink-0"
          style={{
            color: `rgba(${hexToRgb(tint.light)}, 0.45)`,
            background: `rgba(${hexToRgb(tint.mid)}, 0.10)`,
            fontFamily: 'monospace',
          }}
        >
          {childCount} {childCount === 1 ? 'item' : 'items'}
        </span>

        {/* Collapse button */}
        <button
          className="flex-shrink-0 flex items-center justify-center rounded focus:outline-none"
          style={{
            width: 18,
            height: 18,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'rgba(255,255,255,0.45)',
            fontSize: 9,
          }}
          onClick={(e) => { e.stopPropagation(); onUpdate({ collapsed: !element.collapsed }); }}
          title={element.collapsed ? 'Expand' : 'Collapse'}
        >
          {element.collapsed ? '▸' : '▾'}
        </button>

        {/* Lock button */}
        <button
          className="flex-shrink-0 flex items-center justify-center rounded focus:outline-none"
          style={{
            width: 18,
            height: 18,
            background: element.locked
              ? `rgba(${hexToRgb(tint.mid)}, 0.25)`
              : 'rgba(255,255,255,0.07)',
            border: `1px solid ${element.locked ? tint.mid + '88' : 'rgba(255,255,255,0.10)'}`,
            fontSize: 9,
          }}
          onClick={(e) => { e.stopPropagation(); handleLock(); }}
          title={element.locked ? 'Unlock' : 'Lock'}
        >
          {element.locked ? '🔒' : '🔓'}
        </button>
      </div>

      {/* ── Body (hidden when collapsed) ── */}
      {!element.collapsed && (
        <div className="flex-1 relative">
          {isDropTarget && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className="text-xs font-medium"
                style={{ color: `rgba(${hexToRgb(tint.light)}, 0.7)` }}
              >
                Drop to attach
              </span>
            </div>
          )}
        </div>
      )}
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
  onBlur: (e?: React.FocusEvent) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [originalContent, setOriginalContent] = useState("");

  const [localContent, setLocalContent, onLocalBlur] = useLocalInput(
    element.content || "",
    (v) => onUpdate({ content: v }),
  );

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

  // Click outside to deselect/exit edit mode
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onBlur();
      }
    };

    // Small delay to avoid immediate trigger
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing, onBlur]);

  // Auto-grow textarea height while editing — uses refs to avoid re-render cascades
  const elementHeightRef = useRef(element.height);
  elementHeightRef.current = element.height;

  const autoGrowTextarea = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = "0px";
      // Set height to scrollHeight to show all content
      const newHeight = Math.max(30, textarea.scrollHeight);
      textarea.style.height = newHeight + "px";

      // Update element height to match (plus padding)
      const totalHeight = newHeight + 16;
      if (Math.abs(elementHeightRef.current - totalHeight) > 2) {
        onUpdate({ height: totalHeight });
      }
    }
  }, [onUpdate]);

  // Auto-grow on mount (enter edit mode)
  useEffect(() => {
    if (isEditing) {
      // Small delay to ensure textarea is rendered
      if (typeof window !== "undefined") {
        window.requestAnimationFrame(() => {
          autoGrowTextarea();
          // Focus WITHOUT selecting all - normal typing behavior
          if (textareaRef.current) {
            textareaRef.current.focus();
            // Move cursor to end of text
            const length = textareaRef.current.value.length;
            textareaRef.current.setSelectionRange(length, length);
          }
        });
      }
    }
  }, [isEditing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-size: only adjust HEIGHT to fit content, never change width
  // Width is controlled by the user via resize handles
  useEffect(() => {
    if (!isEditing && measureRef.current && element.content) {
      const measured = measureRef.current.getBoundingClientRect();

      // Height: auto-size to fit wrapped content within current width
      const newHeight = Math.max(30, Math.ceil(measured.height) + 16);

      // Only update height if changed significantly
      if (Math.abs(element.height - newHeight) > 8) {
        onUpdate({ height: newHeight });
      }
    }
  }, [
    element.content,
    wrapWidth,
    isEditing,
    onUpdate,
    element.width, // Re-measure height when width changes (text reflows)
    // within existing bounds via CSS.
  ]);

  // Removed automatic click-outside blur - user must click outside or press Escape to exit editing

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent ALL canvas shortcuts from triggering while editing
    e.stopPropagation();

    // Escape exits edit mode WITHOUT reverting changes
    if (e.key === "Escape") {
      e.preventDefault();
      onBlur();
    }

    // Enter creates new line - default behavior works
    // No need to prevent or handle
  };

  // Handle content change with auto-grow
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setLocalContent(e.target.value);
    // Auto-grow after content update
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(autoGrowTextarea);
    }
  };

  // Determine text style (solid color or gradient)
  // CRITICAL: Apply gradient directly to text span, not container
  const hasGradient = gradient?.startsWith("linear-gradient");

  // Get the effective width for the text
  const effectiveWidth = wrapWidth || element.width;

  // Check if this text is actionable
  const isActionable =
    element.taskMetadata?.isActionable ||
    element.content?.includes("[ ]") ||
    element.content?.includes("[x]") ||
    (element.hypercubeTags && element.hypercubeTags.length > 0);

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-start justify-center p-2 relative"
      style={{
        // Allow overflow when editing so text isn't clipped
        overflow: "visible", // Changed from conditional to always visible to prevent clipping at zoom
      }}
    >
      {/* Task indicator */}
      {isActionable && (
        <div
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30 z-20"
          title="Actionable task"
        />
      )}
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
            width: wrapWidth ? `${wrapWidth - 16}px` : "auto",
          }}
        >
          {element.content}
        </div>
      )}
      {/* Text content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={handleContentChange}
          onBlur={onLocalBlur}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          className="resize-none border-0 bg-transparent p-0 focus:outline-none"
          style={{
            fontSize,
            fontWeight,
            fontFamily,
            textAlign,
            color: textColor,
            width: effectiveWidth - 16,
            minHeight: 24,
            overflow: "visible", // Allow text to be fully visible while editing
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
          placeholder="Type text..."
          data-no-drag
        />
      ) : (
        <div
          className="w-full whitespace-pre-wrap"
          style={{
            fontSize,
            fontWeight,
            fontFamily,
            textAlign,
            maxWidth: wrapWidth ? `${wrapWidth - 16}px` : undefined,
            overflow: "visible", // Prevent text clipping
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
  isReadOnly = false,
}: {
  element: LinkElement;
  onUpdate: (updates: Partial<LinkElement>) => void;
  isSelected: boolean;
  isReadOnly?: boolean;
}) {
  // Local draft state to prevent element from disappearing during edits
  const [draftUrl, setDraftUrl] = useState(element.url || "");
  const [isEditing, setIsEditing] = useState(
    !element.url && element.linkMode !== "file",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-fetch bookmark metadata when element is created with a URL but no metadata yet.
  // This handles the paste-as-bookmark flow where the URL is set but the card is empty.
  useEffect(() => {
    if (
      element.url &&
      element.linkMode === 'bookmark' &&
      !element.title &&
      !element.domain
    ) {
      fetchLinkMetadata(element.url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <span className="text-sm text-muted-foreground">
                Uploading...
              </span>
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
              {urlError && (
                <p className="text-xs text-destructive">{urlError}</p>
              )}
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
            <div className="flex-1 min-h-0 bg-gradient-to-br from-muted/30 to-muted/10 relative">
              <NextImage
                src={element.url}
                alt={element.fileName || ""}
                fill
                className="object-contain"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                unoptimized
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
        {isSelected && !isReadOnly && (
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
            <NextImage
              src={element.thumbnail}
              alt=""
              fill
              className="object-cover"
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
              unoptimized
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
              <NextImage
                src={element.favicon}
                alt=""
                width={16}
                height={16}
                className="w-4 h-4"
                draggable={false}
                unoptimized
              />
            )}
            <span className="text-xs text-muted-foreground/80 truncate">
              {element.domain}
            </span>
          </div>
        </div>
        {/* Edit button - only shown when selected */}
        {isSelected && !isReadOnly && (
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
          <NextImage
            src={element.favicon}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4"
            draggable={false}
            unoptimized
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
      {isSelected && !isReadOnly && (
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
  onBlur: (e?: React.FocusEvent) => void;
  isDropTarget?: boolean;
  showIconPicker: boolean;
  setShowIconPicker: (show: boolean) => void;
}) {
  const [isEditingName, setIsEditingName] = useState(false);

  // Get the icon component
  const iconId = element.icon || "grid";
  const selectedIcon = BOARD_ICONS.find((i) => i.id === iconId);
  const IconComponent = selectedIcon?.Icon || LayoutGrid;

  // Count elements in this board using Zustand store
  const allElements = useCXDStore((state) => state.getCurrentProject()?.canvasLayout?.elements || []);
  const elementCount = useMemo(() => {
    return allElements.filter(
      (el) =>
        el.boardId === element.childBoardId &&
        el.type !== "line" &&
        el.type !== "connector",
    ).length;
  }, [allElements, element.childBoardId]);

  return (
    <div
      className={cn(
        "relative w-full h-full transition-all",
        isDropTarget && "scale-105",
      )}
    >
      {/* Hexagon — absolutely centered so its center matches element.height/2 */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 flex items-center justify-center" data-port-bounds>
          {/* Drop target glow - SVG hexagon outline */}
          {isDropTarget && (
            <svg
              className="absolute inset-0 w-32 h-32 pointer-events-none animate-pulse"
              viewBox="0 0 128 128"
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Glow filter for the hexagon outline */}
                <filter id="hexagon-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="6" result="blur1" />
                  <feGaussianBlur stdDeviation="12" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur2" />
                    <feMergeNode in="blur1" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Hexagon path matching the clip-path: 50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25% */}
              <polygon
                points="64,0 119.4,32 119.4,96 64,128 8.6,96 8.6,32"
                fill="none"
                stroke="rgba(168, 85, 247, 0.9)"
                strokeWidth="3"
                filter="url(#hexagon-glow)"
              />
              {/* Additional outer glow ring */}
              <polygon
                points="64,0 119.4,32 119.4,96 64,128 8.6,96 8.6,32"
                fill="none"
                stroke="rgba(168, 85, 247, 0.4)"
                strokeWidth="8"
                filter="url(#hexagon-glow)"
              />
            </svg>
          )}
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

        {/* Board name + item count — absolutely positioned below the hex */}
        <div
          className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
          style={{ top: 'calc(50% + 72px)' }}
        >
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
              className="text-sm font-medium text-white hover:text-primary transition-colors max-w-full truncate px-2 py-1 rounded hover:bg-white/10 whitespace-nowrap"
              data-no-drag
            >
              {element.title || "New Board"}
            </button>
          )}
          {/* Item count */}
          <p className="text-xs text-purple-400 font-medium whitespace-nowrap">
            {elementCount} {elementCount === 1 ? "Item" : "Items"}
          </p>
        </div>
    </div>
  );
}

// Experience Block Card - shortcut to experience components with inline editor support
function ExperienceBlockCard({
  element,
  onOpenPanel,
  onUpdate,
}: {
  element: ExperienceBlockElement;
  onOpenPanel?: (sectionId: InspectorSectionId) => void;
  onUpdate: (updates: Partial<ExperienceBlockElement>) => void;
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
    Palette,
  } = require("lucide-react");

  // Get the update function from the store
  const updateCanvasElement = useCXDStore((state) => state.updateCanvasElement);

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
  const viewMode = element.viewMode || "inline";

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
    updateSensoryDomain,
    updatePresenceType,
    updateStateMapping,
    updateTraitMapping,
  } = useCXDStore();

  // Local input hooks for all intention editor fields to prevent cursor-jump
  const [liProjectName, setLiProjectName] = useLocalInput(
    project?.intentionCore?.projectName || "", updateIntentionProjectName);
  const [liMainConcept, setLiMainConcept] = useLocalInput(
    project?.intentionCore?.mainConcept || "", updateIntentionMainConcept);
  const [liCoreMessage, setLiCoreMessage] = useLocalInput(
    project?.intentionCore?.coreMessage || "", updateIntentionCoreMessage);
  const [liInsights, setLiInsights] = useLocalInput(
    project?.desiredChange?.insights || "", updateDesiredInsights);
  const [liFeelings, setLiFeelings] = useLocalInput(
    project?.desiredChange?.feelings || "", updateDesiredFeelings);
  const [liStates, setLiStates] = useLocalInput(
    project?.desiredChange?.states || "", updateDesiredStates);
  const [liKnowledge, setLiKnowledge] = useLocalInput(
    project?.desiredChange?.knowledge || "", updateDesiredKnowledge);
  const [liAudienceNeeds, setLiAudienceNeeds] = useLocalInput(
    project?.humanContext?.audienceNeeds || "", updateHumanAudienceNeeds);
  const [liAudienceDesires, setLiAudienceDesires] = useLocalInput(
    project?.humanContext?.audienceDesires || "", updateHumanAudienceDesires);
  const [liUserRole, setLiUserRole] = useLocalInput(
    project?.humanContext?.userRole || "", updateHumanUserRole);
  const [liWorld, setLiWorld] = useLocalInput(
    project?.contextAndMeaning?.world || "", updateContextWorld);
  const [liStory, setLiStory] = useLocalInput(
    project?.contextAndMeaning?.story || "", updateContextStory);
  const [liMagic, setLiMagic] = useLocalInput(
    project?.contextAndMeaning?.magic || "", updateContextMagic);

  // Auto-size the element height to fit inline content (must be before conditional returns)
  const contentRef = useRef<HTMLDivElement>(null);
  const lastAutoHeightRef = useRef<number>(0);
  const manuallyResized = (element as any).manuallyResized ?? false;

  useEffect(() => {
    if (viewMode !== 'inline' || manuallyResized) return;
    const el = contentRef.current;
    if (!el) return;

    // Header: py-2 (16px) + h-8 icon (32px) + border-b ≈ 52px
    const HEADER_HEIGHT = 52;

    const measure = () => {
      const totalHeight = Math.max(el.scrollHeight + HEADER_HEIGHT, 200);
      if (Math.abs(totalHeight - lastAutoHeightRef.current) > 2) {
        lastAutoHeightRef.current = totalHeight;
        onUpdate({ height: totalHeight } as any);
      }
    };

    // RAF debounce: coalesce rapid observer callbacks into a single frame.
    // Without this, ScrollArea's internal DOM rearrangements after each height
    // update can trigger the observer again → oscillation loop.
    let rafId: number | null = null;
    const debouncedMeasure = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; measure(); });
    };

    measure();
    const ro = new ResizeObserver(debouncedMeasure);
    ro.observe(el);
    return () => { ro.disconnect(); if (rafId !== null) cancelAnimationFrame(rafId); };
  }, [viewMode, manuallyResized, onUpdate]);

  if (!project) return null;

  const gradient =
    element.style?.bgColor ||
    "linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)";

  // Compact view (default)
  if (viewMode === "compact") {
    return (
      <div
        className="w-full h-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all relative group"
        style={{
          background: gradient,
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
          <div className="text-xs text-white/50 mt-0.5">
            Double-click to open
          </div>
        </div>
      </div>
    );
  }

  // Inline editor view
  return (
    <div
      className="w-full h-full rounded-lg border overflow-hidden flex flex-col relative group bg-ring"
      style={{
        background: gradient,
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
        {manuallyResized && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Reset to auto-size by clearing the manuallyResized flag
              onUpdate({ manuallyResized: false } as any);
            }}
            className="flex-shrink-0 p-1 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Reset to auto-size"
            data-no-drag
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
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
      <ScrollArea
        className="flex-1 overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 space-y-4" data-no-drag ref={contentRef}>
          {element.componentKey === "intentionCore" && (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="projectName"
                  className="text-sm font-medium text-white"
                >
                  Project Name
                </Label>
                <Input
                  id="projectName"
                  placeholder="Enter project name..."
                  value={liProjectName}
                  onChange={(e) => setLiProjectName(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="mainConcept"
                  className="text-sm font-medium text-white"
                >
                  Main Concept
                </Label>
                <Textarea
                  id="mainConcept"
                  placeholder="What is the central idea or concept?"
                  value={liMainConcept}
                  onChange={(e) => setLiMainConcept(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="coreMessage"
                  className="text-sm font-medium text-white"
                >
                  Core Message
                </Label>
                <Textarea
                  id="coreMessage"
                  placeholder="What is the core message or takeaway?"
                  value={liCoreMessage}
                  onChange={(e) => setLiCoreMessage(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "desiredChange" && (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="insights"
                  className="text-sm font-medium text-white"
                >
                  Insights
                </Label>
                <Textarea
                  id="insights"
                  placeholder="What insights should users gain?"
                  value={liInsights}
                  onChange={(e) => setLiInsights(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="feelings"
                  className="text-sm font-medium text-white"
                >
                  Feelings
                </Label>
                <Textarea
                  id="feelings"
                  placeholder="What feelings should they experience?"
                  value={liFeelings}
                  onChange={(e) => setLiFeelings(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="states"
                  className="text-sm font-medium text-white"
                >
                  States
                </Label>
                <Textarea
                  id="states"
                  placeholder="What states should emerge?"
                  value={liStates}
                  onChange={(e) => setLiStates(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="knowledge"
                  className="text-sm font-medium text-white"
                >
                  Knowledge
                </Label>
                <Textarea
                  id="knowledge"
                  placeholder="What knowledge should they acquire?"
                  value={liKnowledge}
                  onChange={(e) => setLiKnowledge(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px]"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "humanContext" && (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="audienceNeeds"
                  className="text-sm font-medium text-white"
                >
                  Audience Needs
                </Label>
                <Textarea
                  id="audienceNeeds"
                  placeholder="What are the audience's needs?"
                  value={liAudienceNeeds}
                  onChange={(e) => setLiAudienceNeeds(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="audienceDesires"
                  className="text-sm font-medium text-white"
                >
                  Audience Desires
                </Label>
                <Textarea
                  id="audienceDesires"
                  placeholder="What do they desire?"
                  value={liAudienceDesires}
                  onChange={(e) => setLiAudienceDesires(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="userRole"
                  className="text-sm font-medium text-white"
                >
                  User Role
                </Label>
                <Input
                  id="userRole"
                  placeholder="What role does the user play?"
                  value={liUserRole}
                  onChange={(e) => setLiUserRole(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "contextAndMeaning" && (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="world"
                  className="text-sm font-medium text-white"
                >
                  World
                </Label>
                <Textarea
                  id="world"
                  placeholder="Describe the world..."
                  value={liWorld}
                  onChange={(e) => setLiWorld(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="story"
                  className="text-sm font-medium text-white"
                >
                  Story
                </Label>
                <Textarea
                  id="story"
                  placeholder="What is the narrative?"
                  value={liStory}
                  onChange={(e) => setLiStory(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="magic"
                  className="text-sm font-medium text-white"
                >
                  Magic/Mechanism
                </Label>
                <Textarea
                  id="magic"
                  placeholder="How does the magic work?"
                  value={liMagic}
                  onChange={(e) => setLiMagic(e.target.value)}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px]"
                  data-no-drag
                />
              </div>
            </>
          )}

          {element.componentKey === "realityPlanes" && (
            <div className="space-y-3" data-no-drag>
              <RealityPlanesEditor compact />
            </div>
          )}

          {element.componentKey === "sensoryDomains" && (() => {
            const intensityLevels = [
              { value: 0, label: "None" },
              { value: 25, label: "Minimal" },
              { value: 50, label: "Moderate" },
              { value: 75, label: "Significant" },
              { value: 100, label: "Primary" },
            ];
            const getClosestLevel = (val: number) =>
              intensityLevels.reduce((prev, curr) =>
                Math.abs(curr.value - val) < Math.abs(prev.value - val) ? curr : prev
              );
            return (
              <div className="space-y-4">
                {SENSORY_DOMAINS.map((domain) => {
                  const val = project.sensoryDomains[domain.code];
                  const currentLevel = getClosestLevel(val);
                  const meta = SENSORY_METADATA[domain.code];

                  return (
                    <div key={domain.code} className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="text-primary/80">
                          {meta.icon}
                        </div>
                        <Label className="text-sm font-bold text-white tracking-tight">
                          {domain.label}
                        </Label>
                        <span className="ml-auto text-[10px] font-mono text-white/50">{currentLevel.label}</span>
                      </div>
                      <div className="flex gap-1" data-no-drag>
                        {intensityLevels.map((level) => {
                          const isSelected = currentLevel.value === level.value;
                          const isPrimary = level.label === "Primary" && isSelected;

                          return (
                            <button
                              key={level.value}
                              onClick={() => updateSensoryDomain(domain.code, level.value)}
                              className={cn(
                                "flex-1 py-1.5 px-1 text-[9px] uppercase font-bold rounded transition-all duration-300",
                                isSelected
                                  ? `bg-gradient-to-br ${meta.color} text-white shadow-md`
                                  : "bg-secondary/30 text-white/40 hover:bg-secondary/50 hover:text-white",
                                isPrimary && "scale-105 shadow-[0_0_15px_rgba(var(--primary),0.3)]",
                                !isSelected && "opacity-60"
                              )}
                              style={isSelected ? {
                                border: `1px solid rgba(${meta.colorRaw}, 0.3)`
                              } : {}}
                            >
                              {level.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {element.componentKey === "presenceTypes" && (() => {
            const presenceLevels = [
              { value: 0, label: "None" },
              { value: 25, label: "Minimal" },
              { value: 50, label: "Moderate" },
              { value: 75, label: "Significant" },
              { value: 100, label: "Primary" },
            ];
            const getClosestLevel = (val: number) =>
              presenceLevels.reduce((prev, curr) =>
                Math.abs(curr.value - val) < Math.abs(prev.value - val) ? curr : prev
              );
            return (
              <div className="space-y-4">
                {PRESENCE_TYPES.map((presence) => {
                  const val = project.presenceTypes?.[presence.code];
                  const currentLevel = getClosestLevel(val);
                  const meta = PRESENCE_METADATA[presence.code];

                  return (
                    <div key={presence.code} className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="text-primary/80">
                          {meta.icon}
                        </div>
                        <Label className="text-sm font-bold text-white tracking-tight">
                          {presence.label}
                        </Label>
                        <span className="ml-auto text-[10px] font-mono text-white/50">{currentLevel.label}</span>
                      </div>
                      <div className="flex gap-1" data-no-drag>
                        {presenceLevels.map((level) => {
                          const isSelected = currentLevel.value === level.value;
                          const isPrimary = level.label === "Primary" && isSelected;

                          return (
                            <button
                              key={level.value}
                              onClick={() => updatePresenceType(presence.code, level.value)}
                              className={cn(
                                "flex-1 py-1.5 px-1 text-[9px] uppercase font-bold rounded transition-all duration-300",
                                isSelected
                                  ? `bg-gradient-to-br ${meta.color} text-white shadow-md`
                                  : "bg-secondary/30 text-white/40 hover:bg-secondary/50 hover:text-white",
                                isPrimary && "scale-105 shadow-[0_0_15px_rgba(var(--primary),0.3)]",
                                !isSelected && "opacity-60"
                              )}
                              style={isSelected ? {
                                border: `1px solid rgba(${meta.colorRaw}, 0.3)`
                              } : {}}
                            >
                              {level.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {element.componentKey === "stateMapping" && (
            <div className="grid grid-cols-2 gap-3">
              {(["cognition", "emotion", "soma", "relational"] as const).map(
                (quadrant) => (
                  <div key={quadrant} className="space-y-2">
                    <Label className="text-sm font-medium text-white capitalize">
                      {quadrant}
                    </Label>
                    <Textarea
                      placeholder={`${quadrant} state...`}
                      value={(project.stateMapping as any)?.[quadrant] || ""}
                      onChange={(e) =>
                        updateStateMapping(quadrant as any, e.target.value)
                      }
                      className="bg-secondary/50 border-border/50 text-white min-h-[60px] text-xs"
                      data-no-drag
                    />
                  </div>
                ),
              )}
            </div>
          )}

          {element.componentKey === "traitMapping" && (
            <div className="grid grid-cols-2 gap-3">
              {(
                ["cognitive", "emotional", "somatic", "relational"] as const
              ).map((quadrant) => (
                <div key={quadrant} className="space-y-2">
                  <Label className="text-sm font-medium text-white capitalize">
                    {quadrant}
                  </Label>
                  <Textarea
                    placeholder={`${quadrant} trait...`}
                    value={project.traitMapping?.[quadrant] || ""}
                    onChange={(e) =>
                      updateTraitMapping(quadrant, e.target.value)
                    }
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
