"use client";

import { FontDropdown } from "./font-dropdown";
import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from "react";
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
  TableElement,
  TableCell,
  makeEmptyTableCells,
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
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useShapeStylePresets,
  addStylePreset,
  removeStylePreset,
  DEFAULT_SHAPE_STYLE,
  type ShapeStylePreset,
} from "@/lib/style-presets";
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
import { shapePath, shapeTextInsets, SHAPE_DEFS } from "@/lib/shape-geometry";
import { shapeOutlinePoint } from "@/lib/shape-outline";
import { ShapeRichTextEditor, plainTextToHtml } from "./shape-rich-text";
import { ShapeGlyph } from "./shape-glyph";
import { CANVAS_OVERLAY_LAYER_ID } from "./canvas-overlay";
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
  Check,
  Minus,
  Maximize2,
  Crop,
  FlipHorizontal,
  FlipVertical,
  Captions,
  Move,
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
  EyeOff,
  Heading,
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
  MousePointerClick,
  PanelTopOpen,
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
  /** True when a line-family tool is active — presses belong to the line-draw
   * pipeline (LineLayer), so this element must not select/drag on press. */
  lineToolActive?: boolean;
  /** Selected as part of a whole group: the group outline stands in for the per-element ring. */
  hideSelectionRing?: boolean;
}

// "Open this element for typing as soon as it exists" (a freshly placed text).
// The element may not be mounted yet when this is called (in CRDT mode it appears
// a frame later), so remember the id and let the renderer claim it on mount; if it
// is already mounted, the event reaches it immediately.
let pendingEditElementId: string | null = null;
export function requestStartEditing(elementId: string) {
  pendingEditElementId = elementId;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cxd:start-editing", { detail: { elementId } }));
  }
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
  lineToolActive = false,
  hideSelectionRing = false,
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
  const [isCroppingImage, setIsCroppingImage] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkViewMenu, setShowLinkViewMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFontMenu, setShowFontMenu] = useState(false);
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

  // Character that started editing a selected shape by typing (see below).
  const [shapeTypedChar, setShapeTypedChar] = useState<string | null>(null);
  useEffect(() => {
    if (!isEditing) setShapeTypedChar(null);
  }, [isEditing]);

  // Claim a pending "start editing" request (see requestStartEditing).
  useEffect(() => {
    const claim = () => {
      if (pendingEditElementId === element.id) {
        pendingEditElementId = null;
        setIsEditing(true);
      }
    };
    claim();
    const onRequest = (e: Event) => {
      if ((e as CustomEvent<{ elementId: string }>).detail?.elementId === element.id) claim();
    };
    window.addEventListener("cxd:start-editing", onRequest);
    return () => window.removeEventListener("cxd:start-editing", onRequest);
  }, [element.id]);

  // Auto-typing for shapes: when selected and user types, start editing
  useEffect(() => {
    if (element.type !== "shape" || !isSelected || isEditing || isReadOnly) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in another input
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.contentEditable === "true") return;

      // Ignore modifier keys and special keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // Two-state delete rule: with the SHAPE selected (not editing),
      // Delete/Backspace must delete the SHAPE — so they are deliberately NOT
      // intercepted here (they fall through to the canvas's delete handler).
      // Only while EDITING does Delete act on text, handled natively by the
      // textarea. Auto-typing starts only from printable characters.
      // Enter opens the editor with the caret at the end of the existing text.
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
        return;
      }
      // Space belongs to the canvas (hand tool); it must never start editing.
      if (e.key.length !== 1 || e.key === " ") return;

      // Typing on a selected shape starts editing. An empty shape takes the
      // character as its text; a shape that already has text keeps it and the
      // character is appended (it used to REPLACE the text, which is how a
      // stray key wiped a label). The character is handed to the editor
      // directly: writing `content` here lost the key (richContent wins over
      // content, and in CRDT mode the store update lands a frame later).
      e.preventDefault();
      e.stopPropagation();
      setShapeTypedChar(e.key);
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
      // While a line-family tool is active, a press over this element must NOT
      // select or drag it — the press belongs to the line-draw pipeline
      // (LineLayer). Do nothing and do NOT stopPropagation, so the native
      // pointerdown reaches LineLayer's container listener and a line can start
      // anywhere, including inside a container. The finished line then attaches
      // to the container it was drawn over via handleCreateLine's bbox-center logic.
      if (lineToolActive) return;

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
    [onDragStart, isEditing, element, lineToolActive],
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
            onCropModeChange={setIsCroppingImage}
            canvasZoom={canvasZoom}
          />
        );
      case "shape":
        return (
          <ShapeCard
            element={element}
            onUpdate={onUpdate}
            isEditing={isEditing}
            typedChar={shapeTypedChar}
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
            isSelected={isSelected}
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
            isDragging={isDragging}
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
      case "table":
        return (
          <TableCard
            element={element as TableElement}
            onUpdate={onUpdate}
            isSelected={isSelected}
            isReadOnly={isReadOnly}
            canvasZoom={canvasZoom}
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

  // Any freeform card rendered with height:auto needs its element.height synced
  // from the DOM so connectors and selection math target the real rendered bounds.
  // Documents included: their height is the icon + title, measured, so a
  // document inside a container doesn't leave a band of empty space below.
  const isAutoHeightFreeform = element.type === "freeform";
  const isDocumentCard = element.type === "freeform" && !!(element as FreeformElement).isDocument;

  // Observe actual DOM size via ResizeObserver and sync element.width/height so
  // connectors, group reflow, and alignment guides target the real rendered bounds.
  const lastObservedHeight = useRef(element.height);
  const lastObservedWidth = useRef(element.width);
  useEffect(() => {
    if (!isAutoHeightFreeform) return;
    const el = elementRef.current;
    if (!el) return;
    const minHeight = freeformCardType === "task" || isDocumentCard ? 0 : 300;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const h = Math.ceil(entry.contentRect.height);
      const w = Math.ceil(entry.contentRect.width);
      const nextH = Math.max(minHeight, h);
      const updates: { height?: number; width?: number } = {};
      if (Math.abs(nextH - lastObservedHeight.current) > 3) {
        lastObservedHeight.current = nextH;
        updates.height = nextH;
      }
      if (Math.abs(w - lastObservedWidth.current) > 3) {
        lastObservedWidth.current = w;
        updates.width = w;
      }
      if (Object.keys(updates).length) onUpdate(updates);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isAutoHeightFreeform, freeformCardType, isDocumentCard]); // eslint-disable-line react-hooks/exhaustive-deps

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
        !hideSelectionRing &&
        !isHighlighted &&
        element.type !== "board" &&
        element.type !== "text" &&
        element.type !== "line" &&
        element.type !== "freeform" &&
        "ring-2 ring-primary shadow-[0_0_20px_rgba(168,85,247,0.3)]",
        // Selection ring for freeform cards - rounded (except documents)
        isSelected &&
        !hideSelectionRing &&
        !isHighlighted &&
        element.type === "freeform" &&
        !(element as FreeformElement).isDocument &&
        "ring-2 ring-primary shadow-[0_0_20px_rgba(168,85,247,0.3)] rounded-lg",
        // Text: a hairline box that hugs the glyphs (handles do the rest)
        isSelected &&
        !hideSelectionRing &&
        element.type === "text" &&
        "outline outline-1 outline-primary/70",
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
              ? undefined
              : "300px"
            : undefined,
        zIndex:
          isSelected && element.type !== "container"
            ? 2000000000  // Selected element always on top so toolbar/menus aren't hidden by other elements
            // Containers are excluded from the pop-to-top: elements render as flat DOM siblings,
            // so paint order (zIndex) — not nesting — decides which element a click hits. Forcing a
            // selected container above its children made clicks in the body select the container
            // instead of the child. Keeping it at its own zIndex leaves children (higher z) clickable;
            // the container is still selectable via its header/border and empty areas where no child
            // paints on top.
            : Number.isFinite(element.zIndex) ? element.zIndex : 0,
        transform: element.rotation
          ? `rotate(${element.rotation}deg)`
          : undefined,
      }}
      data-node-id={element.id}
      data-canvas-node="true"
      onClick={(e) => {
        e.stopPropagation();
        // While a line tool is active this press belongs to the line-draw
        // pipeline — don't select the element on the trailing click.
        if (lineToolActive) return;
        onSelect(e);
      }}
      onMouseDown={handleBodyMouseDown}
      onMouseUp={onDragEnd}
      onDoubleClick={handleDoubleClick}
    >
      {/* Connection port - floating dot that slides along the nearest edge following the cursor */}
      {onStartConnector &&
        !isCroppingImage &&
        element.type !== "line" &&
        element.type !== "text" &&
        // Link elements (bookmark + embed) skip the connector orb: it overlaps the
        // corner/edge resize handles and blocks resizing. Links are not connectable.
        element.type !== "link" &&
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
            outlineAt={
              element.type === 'shape' && (element as ShapeElement).shapeType !== 'rectangle'
                ? (side, offset) => shapeOutlinePoint((element as ShapeElement).shapeType, element.width, element.height, side, offset)
                : undefined
            }
            onStartConnector={onStartConnector}
            onEndConnector={onEndConnector ?? (() => {})}
          />
        )}
      {/* Unified context menu (hidden for line elements, multi-selection uses MultiSelectionBox) */}
      {isSelected && !isDragging && !isCroppingImage && element.type !== "line" && !isReadOnly && !isMultiSelected && !(isEditing && element.type === "shape") && (() => {
        /* Counter-rotation wrapper: un-rotates around element center so menu stays fixed above */
        const toolbar = (
        <div
          className="absolute inset-0 pointer-events-none z-50"
          style={{
            transform: element.rotation ? `rotate(${-element.rotation}deg)` : undefined,
          }}
        >
        <div
          className={cn(
            "absolute left-1/2 flex items-center gap-1 px-2 py-1.5 rounded-xl pointer-events-auto",
            "bg-zinc-950/95 backdrop-blur-2xl border border-violet-500/25 shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          )}
          style={{
            top: -57,
            transform: `translateX(-50%) scale(${1 / canvasZoom})`,
            transformOrigin: 'center bottom',
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Element-specific actions */}
          {element.type === "image" && (element as ImageElement).storyboard && (
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (showColorPicker) {
                    closeAllSubmenus();
                  } else {
                    setColorPickerDefaultMode("stroke");
                    openColorPicker();
                  }
                }}
                className={cn(
                  "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                  showColorPicker && "bg-primary/20 text-primary",
                )}
                title="Storyboard colors"
              >
                <Palette className="w-4 h-4" />
              </button>
              {showColorPicker && (
                <StoryboardColorPicker
                  bgColor={(element as ImageElement).storyboardBgColor || "#0f0f12"}
                  borderColor={(element as ImageElement).storyboardBorderColor || "#b8b8be"}
                  borderWidth={(element as ImageElement).storyboardBorderWidth ?? 3}
                  textColor={(element as ImageElement).storyboardTextColor || "#f4f4f5"}
                  onBgChange={(color) => onUpdate({ storyboardBgColor: color })}
                  onBorderColorChange={(color) => onUpdate({ storyboardBorderColor: color })}
                  onBorderWidthChange={(width) => onUpdate({ storyboardBorderWidth: width })}
                  onTextColorChange={(color) => onUpdate({ storyboardTextColor: color })}
                  onClose={() => setShowColorPicker(false)}
                />
              )}
            </div>
          )}
          {element.type === "shape" && (
            <>
              {/* Color Picker (Fill/Stroke/Text unified) */}
              <div>
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
                    currentStyle={(element as ShapeElement).style}
                    onApplyStyle={(partial) =>
                      onUpdate({ style: { ...element.style, ...partial } })
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
                    defaultMode={colorPickerDefaultMode}
                  />
                )}
              </div>

              <div className="w-px h-4 bg-border/50 mx-0.5" />

              {/* Shape Type Picker */}
              <div>
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
              {/* Documents: colour lives inside the opened document; the emoji is
                  changed here because the icon itself is the drag/open handle. */}
              {(element as FreeformElement).isDocument ? (
                <div>
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
                    title="Change emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  {showEmojiPicker && (
                    <EmojiPicker
                      onEmojiSelect={(emoji) => onUpdate({ emoji } as Partial<FreeformElement>)}
                      onClose={() => setShowEmojiPicker(false)}
                    />
                  )}
                </div>
              ) : (
              <div>
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
              )}
              {/* Emoji: click the emoji on the card itself. Bold and layer arrows
                  were removed from card toolbars (selected cards already pop to the top). */}
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
                <div>
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
              <div>
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
              <div>
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
              <div>
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
              <div>
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
                  onUpdate({ hideLabel: !(element as ContainerElement).hideLabel } as Partial<CanvasElement>);
                }}
                className={cn(
                  "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors",
                  (element as ContainerElement).hideLabel && "bg-primary/20 text-primary",
                )}
                title={(element as ContainerElement).hideLabel ? "Show name" : "Hide name"}
              >
                <Tag className="w-4 h-4" />
              </button>
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
              <FontDropdown
                value={(element as TextElement).style?.fontFamily}
                onChange={(fontFamily) => onUpdate({ style: { ...element.style, fontFamily } })}
                open={showFontMenu}
                onOpenChange={setShowFontMenu}
                className="max-w-[100px]"
                title="Font Family"
              />
              {/* Font size: − / value / + (steps through a type scale) */}
              <TextSizeControl
                value={(element as TextElement).style?.fontSize || 16}
                onChange={(fontSize) => onUpdate({ style: { ...element.style, fontSize } })}
              />
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
                          // '' not undefined: the Yjs serializer skips undefined, so the
                          // old gradient survived and "solid" never took effect.
                          bgColor: "",
                        },
                      })
                    }
                    onGradientChange={(gradient) =>
                      onUpdate({
                        style: {
                          ...element.style,
                          bgColor: gradient,
                          textColor: "",
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
          {element.type !== 'container' && element.type !== 'freeform' && (
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
          {/* Keep open: pin this note in a floating editor that stays up while
              moving around the canvas */}
          {element.type === 'freeform' && ((element as any).cardType === 'note' || (element as any).noteTitle !== undefined) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                useCXDStore.getState().setPinnedInboxNoteId(element.id);
              }}
              className="p-1.5 rounded hover:bg-cyan-500/20 text-muted-foreground hover:text-cyan-300 transition-colors"
              title="Keep open while you move around the canvas"
            >
              <PanelTopOpen className="w-4 h-4" />
            </button>
          )}
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
        );

        // Containers sit in a deep-negative z band (ee25b91), which establishes a
        // stacking context that would trap this toolbar (and its submenus) behind any
        // overlapping element, making the buttons unclickable. A selected container
        // deliberately does NOT pop to the top (f475478) so its children stay
        // hit-testable, so we cannot lift the container body. Instead portal the toolbar
        // into the canvas transform layer (the element wrapper's parent) as a high-z
        // sibling of every element wrapper: it escapes the negative stacking context and
        // paints above all elements, yet still tracks pan/zoom because it lives inside the
        // same transformed layer.
        //
        // Text elements need the same escape hatch: their toolbar/submenus were rendering
        // behind neighbouring elements (the in-place z 2e9 pop was not enough — the text
        // wrapper's own stacking context trapped the left-opening colour/font popovers).
        // Portaling is strictly safe: it can only raise the toolbar, never lower it.
        //
        // Now every element type does this, into the dedicated overlay layer
        // (same pan/zoom transform, stacked above elements, connector lines and
        // the side toolkits) so a toolbar can never render behind anything.
        if (typeof document !== "undefined") {
          const layer =
            document.getElementById(CANVAS_OVERLAY_LAYER_ID) ?? elementRef.current?.parentElement;
          if (layer) {
            return createPortal(
              <div
                className="absolute pointer-events-none"
                style={{
                  left: element.x,
                  top: element.y,
                  width: element.width,
                  height:
                    element.type === "container" && (element as ContainerElement).collapsed
                      ? 28
                      : element.height,
                  zIndex: 2000000002,
                  transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
                }}
              >
                {toolbar}
              </div>,
              layer,
            );
          }
        }

        return toolbar;
      })()}
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
      {/* Resize handles - shown when selected (not for boards, lines, or images in crop mode) */}
      {isSelected &&
        !isDragging &&
        !isCroppingImage &&
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
            ) : element.type === "text" ? (
              !isReadOnly && !element.locked ? (
                <>
                  {(["nw", "ne", "sw", "se", "e", "w"] as const).map((pos) => (
                    <TextResizeHandle
                      key={pos}
                      position={pos}
                      element={element as TextElement}
                      onUpdate={onUpdate}
                      canvasZoom={canvasZoom}
                      onResizeStart={pushCanvasHistory}
                    />
                  ))}
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
      {/* Rotation handle — for shapes (below) and images (right side, to clear edit pill) */}
      {isSelected &&
        !isDragging &&
        !isEditing &&
        !isCroppingImage &&
        !isReadOnly &&
        !element.locked &&
        (element.type === "shape" || element.type === "image") && (
          <RotationHandle
            element={element}
            onUpdate={onUpdate}
            canvasZoom={canvasZoom}
            onResizeStart={pushCanvasHistory}
            side={element.type === "image" ? "right" : "bottom"}
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

        // For images, maintain aspect ratio — EXCEPT storyboard frames, which
        // resize freely (the image inside covers the frame) so the user can set
        // any cell ratio. Shift still forces aspect lock for any element type.
        const isImage = element.type === "image";
        const isStoryboardImage = isImage && !!(element as ImageElement).storyboard;
        const shouldMaintainAspectRatio =
          (isImage && !isStoryboardImage) || moveEvent.shiftKey;
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

const TEXT_SIZE_STEPS = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72, 96, 128, 160, 200];

/** Compact font-size stepper for the text toolbar; the value is also typeable. */
function TextSizeControl({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = (raw: string) => {
    const n = Math.round(parseFloat(raw));
    if (Number.isFinite(n)) onChange(Math.max(6, Math.min(400, n)));
    else setDraft(String(value));
  };
  const step = (dir: 1 | -1) => {
    const next =
      dir > 0
        ? TEXT_SIZE_STEPS.find((s) => s > value) ?? value + 8
        : [...TEXT_SIZE_STEPS].reverse().find((s) => s < value) ?? Math.max(6, value - 2);
    onChange(next);
  };
  return (
    <div
      className="flex items-center rounded border border-border/50 bg-card/80"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="px-1.5 py-1 text-muted-foreground hover:text-primary" onClick={() => step(-1)} title="Smaller">
        <Minus className="w-3 h-3" />
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9.]/g, ""))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") commit((e.target as HTMLInputElement).value);
          if (e.key === "ArrowUp") { e.preventDefault(); step(1); }
          if (e.key === "ArrowDown") { e.preventDefault(); step(-1); }
        }}
        className="w-8 bg-transparent text-center text-xs tabular-nums outline-none"
        title="Font size"
      />
      <button className="px-1.5 py-1 text-muted-foreground hover:text-primary" onClick={() => step(1)} title="Larger">
        <Plus className="w-3 h-3" />
      </button>
    </div>
  );
}

// Text resize handles (Miro-style):
// - corners SCALE the text: font size and box grow/shrink together;
// - left/right sides set a WRAP WIDTH (text becomes fixed-width and wraps);
//   double-clicking a side handle returns to auto width (box hugs the text).
// Height is never set by hand; it always follows the content.
function TextResizeHandle({
  position,
  element,
  onUpdate,
  canvasZoom,
  onResizeStart,
}: {
  position: "nw" | "ne" | "sw" | "se" | "e" | "w";
  element: TextElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  canvasZoom: number;
  onResizeStart?: () => void;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onResizeStart?.();

      const startX = e.clientX;
      const startW = element.width;
      const startH = element.height;
      const startPosX = element.x;
      const startPosY = element.y;
      const startFont = element.style?.fontSize || 16;
      const isCorner = position.length === 2;
      const fromLeft = position.includes("w");
      const fromTop = position.includes("n");

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / canvasZoom;
        const signedDx = fromLeft ? -dx : dx;
        if (isCorner) {
          if (!(startW > 0)) return;
          const scale = Math.max(0.1, (startW + signedDx) / startW);
          const fontSize = Math.max(6, Math.min(400, Math.round(startFont * scale)));
          const k = fontSize / startFont;
          const newW = Math.max(12, startW * k);
          const newH = Math.max(8, startH * k);
          onUpdate({
            style: { ...(element.style || {}), fontSize },
            width: newW,
            height: newH,
            x: fromLeft ? startPosX + (startW - newW) : startPosX,
            y: fromTop ? startPosY + (startH - newH) : startPosY,
          } as Partial<CanvasElement>);
        } else {
          const minW = Math.max(24, startFont * 1.2);
          const newW = Math.max(minW, startW + signedDx);
          onUpdate({
            width: newW,
            x: fromLeft ? startPosX + (startW - newW) : startPosX,
            autoWidth: false,
          } as Partial<CanvasElement>);
        }
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [element, onUpdate, position, canvasZoom, onResizeStart],
  );

  const s = 1 / canvasZoom;
  const isSide = position === "e" || position === "w";
  const style: React.CSSProperties = isSide
    ? {
        top: "50%",
        [position === "e" ? "right" : "left"]: -3,
        transform: `translateY(-50%) scale(${s})`,
        transformOrigin: position === "e" ? "center right" : "center left",
        cursor: "ew-resize",
      }
    : {
        [position.includes("n") ? "top" : "bottom"]: -4,
        [position.includes("w") ? "left" : "right"]: -4,
        transform: `scale(${s})`,
        transformOrigin: `${position.includes("n") ? "top" : "bottom"} ${position.includes("w") ? "left" : "right"}`,
        cursor: position === "nw" || position === "se" ? "nwse-resize" : "nesw-resize",
      };

  return (
    <div
      className={cn(
        "absolute z-10 bg-white border border-primary shadow-sm",
        isSide ? "w-1.5 h-4 rounded-full" : "w-2 h-2 rounded-[2px]",
      )}
      style={style}
      onMouseDown={handleMouseDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isSide) {
          onResizeStart?.();
          onUpdate({ autoWidth: true } as Partial<CanvasElement>);
        }
      }}
      title={isSide ? "Drag to set wrap width · double-click to fit text" : "Drag to scale text"}
    />
  );
}

// Rotation handle — line + dot extending from the element, drag to rotate
function RotationHandle({
  element,
  onUpdate,
  canvasZoom,
  onResizeStart,
  side = "bottom",
}: {
  element: CanvasElement;
  onUpdate: (updates: Partial<CanvasElement>) => void;
  canvasZoom: number;
  onResizeStart?: () => void;
  side?: "bottom" | "right";
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

  if (side === "right") {
    return (
      <div
        className="absolute top-1/2 pointer-events-none flex items-center"
        style={{
          right: -(stemLength + dotSize / 2 + 4),
          transform: `translateY(-50%) scale(${handleScale})`,
          transformOrigin: "left center",
        }}
      >
        {/* Stem line */}
        <div
          className="bg-primary/60"
          style={{ width: stemLength, height: 1.5 }}
        />
        {/* Dot handle */}
        <div
          className="rounded-full bg-primary border-2 border-background cursor-grab pointer-events-auto hover:scale-125 transition-transform"
          style={{ width: dotSize, height: dotSize }}
          onMouseDown={handleMouseDown}
          title="Drag to rotate (Shift for 15° snaps)"
        />
      </div>
    );
  }

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

// Color picker popover - always opens below the toolbar
function ColorPicker({
  currentColor,
  onColorChange,
  onClose,
}: {
  currentColor?: string;
  onColorChange: (color: string) => void;
  onClose: () => void;
}) {
  // Submenus always open downward so the user never moves the cursor up to reach options.
  return (
    <div
      className={cn(
        "absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[132px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150",
        "p-2 grid grid-cols-4 gap-1.5",
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
  const shapeTypes = SHAPE_DEFS.map(({ type, label }) => ({
    type,
    label,
    icon: <ShapeGlyph type={type} className="w-5 h-5" />,
  }));

  return (
    <div
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-6 gap-1 px-1 py-1">
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

// Shape color picker with fill/stroke/text toggle and stroke width control
// A single preset shown as a ring swatch: the border (gradient or solid) forms the
// outer ring, the fill sits in the middle — a mini preview of what applying it does.
function PresetSwatch({
  preset,
  onApply,
  onRemove,
}: {
  preset: ShapeStylePreset;
  onApply: () => void;
  onRemove?: () => void;
}) {
  const s = preset.style;
  const ringBg =
    s.borderColor && s.borderColor !== "transparent" ? s.borderColor : "rgba(255,255,255,0.15)";
  const fillBg = !s.bgColor || s.bgColor === "transparent" ? "transparent" : s.bgColor;
  return (
    <div className="relative group/preset">
      <button
        type="button"
        onClick={onApply}
        title={preset.name || "Saved preset"}
        className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
        style={{ background: ringBg }}
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-black/20"
          style={{
            background: fillBg,
            // Show a subtle checker for transparent fills so an outline preset reads.
            backgroundImage:
              fillBg === "transparent"
                ? "linear-gradient(45deg,#3f3f46 25%,transparent 25%,transparent 75%,#3f3f46 75%),linear-gradient(45deg,#3f3f46 25%,transparent 25%,transparent 75%,#3f3f46 75%)"
                : undefined,
            backgroundSize: fillBg === "transparent" ? "6px 6px" : undefined,
            backgroundPosition: fillBg === "transparent" ? "0 0,3px 3px" : undefined,
          }}
        />
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove preset"
          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-zinc-800 border border-white/20 text-white/80 text-[9px] leading-none flex items-center justify-center opacity-0 group-hover/preset:opacity-100 transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}

// Preset strip for the colour popover: built-in + user-saved fill/border/font
// combinations, plus a "+" that saves the element's current style as a new preset.
function StylePresetStrip({
  currentStyle,
  onApply,
}: {
  currentStyle?: ShapeElement["style"];
  onApply: (partial: ShapeStylePreset["style"]) => void;
}) {
  const { presets } = useShapeStylePresets();
  const saveCurrent = () => {
    const s = currentStyle || {};
    addStylePreset({
      bgColor: s.bgColor,
      borderColor: s.borderColor,
      borderWidth: s.borderWidth,
      fillOpacity: s.fillOpacity,
      borderStyle: s.borderStyle,
      textColor: s.textColor,
      fontFamily: s.fontFamily,
    });
  };
  return (
    <div className="mb-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
        Presets
      </div>
      <div className="flex items-center flex-wrap gap-1.5">
        {presets.map((p) => (
          <PresetSwatch
            key={p.id}
            preset={p}
            onApply={() => onApply(p.style)}
            onRemove={p.builtIn ? undefined : () => removeStylePreset(p.id)}
          />
        ))}
        <button
          type="button"
          onClick={saveCurrent}
          title="Save current fill, border & font as a preset"
          className="w-6 h-6 rounded-full border border-dashed border-white/25 text-white/60 hover:text-white hover:border-white/50 flex items-center justify-center transition-colors text-sm leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ShapeColorPicker({
  fillColor,
  strokeColor,
  strokeWidth,
  fillOpacity,
  textColor,
  fontSize,
  currentStyle,
  onFillColorChange,
  onStrokeColorChange,
  onStrokeWidthChange,
  onFillOpacityChange,
  onTextColorChange,
  onFontSizeChange,
  onApplyStyle,
  onClose,
  defaultMode,
}: {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  fillOpacity?: number;
  textColor?: string;
  fontSize?: number;
  currentStyle?: ShapeElement["style"];
  onFillColorChange: (color: string) => void;
  onStrokeColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onFillOpacityChange: (opacity: number) => void;
  onTextColorChange?: (color: string) => void;
  onFontSizeChange?: (size: number) => void;
  onApplyStyle?: (partial: ShapeStylePreset["style"]) => void;
  onClose: () => void;
  defaultMode?: "fill" | "stroke" | "text";
}) {
  const [mode, setMode] = useState<"fill" | "stroke" | "text">(defaultMode || "fill");
  const [lastCustomColor, setLastCustomColor] = useState<string | null>(null);
  const customColorRef = useRef<HTMLInputElement>(null);
  const currentWidth = strokeWidth || 2;
  const currentOpacity = fillOpacity !== undefined ? fillOpacity : 100;
  const currentFontSize = fontSize || 14; // matches ShapeCard's default

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
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Style presets — built-in (incl. gradient ring) + user-saved, with "+" to save */}
      <StylePresetStrip
        currentStyle={currentStyle}
        onApply={(partial) => {
          if (onApplyStyle) {
            onApplyStyle(partial);
            return;
          }
          // Fallback: apply field-by-field via the individual handlers.
          if (partial.bgColor !== undefined) onFillColorChange(partial.bgColor);
          if (partial.borderColor !== undefined) onStrokeColorChange(partial.borderColor);
          if (partial.borderWidth !== undefined) onStrokeWidthChange(partial.borderWidth);
          if (partial.fillOpacity !== undefined) onFillOpacityChange(partial.fillOpacity);
          if (partial.textColor !== undefined) onTextColorChange?.(partial.textColor);
        }}
      />

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

/**
 * Storyboard colour editor — three tabs (Border / Background / Text) using the
 * same rich preset palette + gradients as the note cards. Border only offers
 * SOLID colours (a gradient can't render on a `solid` border) plus a width
 * slider; Background and Text offer the note gradients (Text applies them via
 * background-clip in the caption).
 */
export function StoryboardColorPicker({
  bgColor,
  borderColor,
  borderWidth,
  textColor,
  onBgChange,
  onBorderColorChange,
  onBorderWidthChange,
  onTextColorChange,
  onClose,
}: {
  bgColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  onBgChange: (c: string) => void;
  onBorderColorChange: (c: string) => void;
  onBorderWidthChange: (w: number) => void;
  onTextColorChange: (c: string) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"border" | "bg" | "text">("border");
  const customRef = useRef<HTMLInputElement>(null);

  const current = mode === "bg" ? bgColor : mode === "border" ? borderColor : textColor;
  const apply = (c: string) => {
    if (mode === "bg") onBgChange(c);
    else if (mode === "border") onBorderColorChange(c);
    else onTextColorChange(c);
  };

  // Border is solid-only; bg + text get the gradient palette.
  const swatches: readonly string[] =
    mode === "border"
      ? SOLID_STROKE_COLORS
      : mode === "bg"
        ? PRESET_COLORS
        : ["#f4f4f5", "#111114", "#a1a1aa", ...TEXT_GRADIENTS];

  const customHex = current.startsWith("#") ? current : "#ffffff";

  return (
    <div
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-3 p-0.5 bg-muted/50 rounded-md">
        {([
          { key: "border", label: "Border", icon: <PenLine className="w-3 h-3" /> },
          { key: "bg", label: "Background", icon: <Paintbrush className="w-3 h-3" /> },
          { key: "text", label: "Text", icon: <Type className="w-3 h-3" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={cn(
              "flex-1 py-1.5 px-1.5 text-[11px] rounded transition-colors flex items-center justify-center gap-1",
              mode === t.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Swatches */}
      <div className="grid grid-cols-6 gap-1.5 mb-3">
        {swatches.map((c) => (
          <button
            key={c}
            onClick={() => apply(c)}
            className={cn(
              "w-7 h-7 rounded-md border-2 transition-transform hover:scale-110",
              current === c ? "border-primary" : "border-border/40",
              c === "transparent" &&
                "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]",
            )}
            style={{ background: c === "transparent" ? undefined : c }}
            title={c.includes("gradient") ? "Gradient" : c}
          />
        ))}
        {/* Custom solid colour */}
        <button
          onClick={() => customRef.current?.click()}
          className="w-7 h-7 rounded-md border-2 border-border/40 relative overflow-hidden hover:scale-110 transition-transform"
          style={{ background: "conic-gradient(#f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
          title="Custom colour"
        >
          <input
            ref={customRef}
            type="color"
            value={customHex}
            onChange={(e) => apply(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
        </button>
      </div>

      {/* Border width */}
      {mode === "border" && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground w-10">Width</span>
          <input
            type="range"
            min={0}
            max={20}
            step={1}
            value={borderWidth}
            onChange={(e) => onBorderWidthChange(parseInt(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none bg-muted cursor-pointer"
          />
          <span className="text-[10px] text-muted-foreground w-8 text-right">{borderWidth}px</span>
        </div>
      )}
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
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
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
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
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
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
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
      className={cn("absolute right-full top-1/2 -translate-y-1/2 mr-3 z-[100] pointer-events-auto w-[240px] rounded-xl bg-zinc-900/95 backdrop-blur-2xl border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in slide-in-from-right-2 duration-150", "p-3")}
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

// Emoji picker: categorized, scrollable. Opens anchored under the emoji it edits.
const EMOJI_CATEGORIES: Array<{ key: string; icon: string; emojis: string[] }> = [
  {
    key: "Marks",
    icon: "⭐",
    emojis: ["💡", "⭐", "🌟", "✨", "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🎯", "🚀", "✅", "❌", "⚡", "🔥", "💎", "📌", "📍", "🏁", "🚩", "❓", "❗", "💭", "🗯️", "🔔", "⚠️", "🛑", "♻️", "🔖", "🏷️", "🎖️", "🏆", "🥇", "🔑", "🗝️", "🔒", "🔓"],
  },
  {
    key: "People",
    icon: "😀",
    emojis: ["😀", "😃", "😄", "😁", "😅", "😂", "🙂", "😉", "😊", "😍", "🥰", "😘", "🤩", "🥹", "😮", "🤯", "😌", "😖", "😴", "🤔", "🫠", "🫶", "👀", "🧠", "🫀", "🙌", "👏", "🙏", "💪", "👍", "👎", "🤝", "✌️", "🤞", "🫡", "🧘", "🕺", "💃", "🧑‍💻", "🧑‍🎨"],
  },
  {
    key: "Nature",
    icon: "🌿",
    emojis: ["🌊", "🌙", "☀️", "🌈", "🌱", "🌿", "🍀", "🍄", "🌀", "❄️", "🔥", "🌋", "🪐", "🌍", "🌌", "🌸", "🌺", "🌻", "🌲", "🌴", "🍃", "🪷", "🦋", "🐝", "🐙", "🦉", "🐬", "🦄", "🐉", "🌵", "⛰️", "🏔️", "🌅", "🌠", "☁️", "⛈️", "💧", "🪨", "🪵", "🐚"],
  },
  {
    key: "Objects",
    icon: "🛠️",
    emojis: ["🔮", "🎧", "🎬", "📷", "🎥", "📹", "🕹️", "🎮", "🧭", "⏳", "⌛", "⏰", "🧪", "🔬", "🔭", "📖", "📚", "📝", "✏️", "🖊️", "📎", "📊", "📈", "📉", "🗂️", "📁", "🗒️", "📅", "💻", "🖥️", "📱", "⌨️", "🖱️", "🛠️", "🔧", "🧰", "🎁", "💰", "🧲", "🔦"],
  },
  {
    key: "Activities",
    icon: "🎨",
    emojis: ["🎨", "🎭", "🎪", "🎤", "🎵", "🎶", "🎹", "🥁", "🎸", "🎻", "🎲", "🧩", "♟️", "🎳", "🏹", "⚽", "🏀", "🎾", "🏄", "🧗", "🚴", "🏃", "🤸", "🧑‍🏫", "🎓", "🏛️", "🎡", "🎢", "🎠", "🪩", "🕯️", "🪔", "🧿", "🪬", "🎆", "🎇", "🎉", "🎊", "🥂", "🍷"],
  },
  {
    key: "Places",
    icon: "🏠",
    emojis: ["🏠", "🏡", "🏢", "🏫", "🏥", "🏨", "🏰", "🛖", "⛩️", "🕌", "⛪", "🗼", "🗽", "🌉", "🚪", "🪟", "🛋️", "🛏️", "🚗", "🚕", "🚌", "🚆", "✈️", "🛸", "🚁", "⛵", "🚢", "🗺️", "🧳", "🎒", "⛺", "🏕️", "🏝️", "🏜️", "🌐", "📡", "🛰️", "🔭", "🚀", "🧭"],
  },
  {
    key: "Symbols",
    icon: "♾️",
    emojis: ["♾️", "☯️", "🔺", "🔻", "🔷", "🔶", "🔵", "🟣", "🟢", "🟡", "🟠", "🔴", "⚫", "⚪", "🟥", "🟦", "🟩", "🟨", "🟪", "⬛", "⬜", "◼️", "◻️", "▶️", "⏸️", "⏩", "🔁", "🔀", "➕", "➖", "✖️", "➗", "💯", "🔗", "🧬", "⚛️", "🕉️", "☮️", "🔱", "♈"],
  },
];
const COMMON_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

function EmojiPicker({
  onEmojiSelect,
  onClose,
  anchored = false,
}: {
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  /** true: popover under the emoji being edited. false: left-side toolbar submenu. */
  anchored?: boolean;
}) {
  const [cat, setCat] = useState(0);
  const category = EMOJI_CATEGORIES[cat];
  return (
    <div
      className={cn(
        "z-[100] pointer-events-auto w-[260px] rounded-xl bg-zinc-900 border border-violet-500/30 shadow-[0_10px_40px_rgba(0,0,0,0.55)] animate-in fade-in duration-150 p-2",
        anchored
          ? "absolute top-full left-1/2 -translate-x-1/2 mt-2 text-left"
          : "absolute right-full top-1/2 -translate-y-1/2 mr-3 slide-in-from-right-2",
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      data-prevent-canvas-wheel="true"
    >
      <div className="flex items-center gap-0.5 mb-1.5 pb-1.5 border-b border-white/10">
        {EMOJI_CATEGORIES.map((c, i) => (
          <button
            key={c.key}
            type="button"
            title={c.key}
            onClick={() => setCat(i)}
            className={cn("flex-1 h-7 rounded text-base flex items-center justify-center transition-colors", i === cat ? "bg-primary/25" : "hover:bg-white/10")}
          >
            {c.icon}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 max-h-[168px] overflow-y-auto pr-0.5">
        {category.emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="w-8 h-8 rounded hover:bg-primary/20 transition-colors flex items-center justify-center text-lg"
            onClick={() => {
              onEmojiSelect(emoji);
              onClose();
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="w-full mt-1.5 py-1 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        onClick={() => {
          onEmojiSelect("");
          onClose();
        }}
      >
        Remove emoji
      </button>
    </div>
  );
}

// Board colors - curated cyberdelic palette that looks good with white icons
export const BOARD_HEX_COLORS = [
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

// Board icon picker. The first eight keep their original ids (saved boards use
// them); the rest are looked up by lucide name.
type BoardIconDef = { id: string; Icon: React.ComponentType<{ className?: string }>; label: string };
const lucideByName = (name: string, label: string, id = name.toLowerCase()): BoardIconDef => ({
  id,
  Icon: ((LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ?? LayoutGrid),
  label,
});
const BOARD_ICONS: BoardIconDef[] = [
  { id: "grid", Icon: LayoutGrid, label: "Grid" },
  { id: "star", Icon: Star, label: "Star" },
  { id: "globe", Icon: Globe, label: "Globe" },
  { id: "image", Icon: Image, label: "Image" },
  { id: "note", Icon: FileText, label: "Note" },
  { id: "link", Icon: Link2, label: "Link" },
  { id: "box", Icon: Box, label: "Box" },
  { id: "heart", Icon: Heart, label: "Heart" },
  lucideByName("Lightbulb", "Idea"),
  lucideByName("Rocket", "Launch"),
  lucideByName("Target", "Goal"),
  lucideByName("Flag", "Milestone"),
  lucideByName("Bookmark", "Bookmark"),
  lucideByName("Folder", "Folder"),
  lucideByName("Layers", "Layers"),
  lucideByName("Map", "Map"),
  lucideByName("Compass", "Compass"),
  lucideByName("Sparkles", "Sparkles"),
  lucideByName("Flame", "Energy"),
  lucideByName("Leaf", "Nature"),
  lucideByName("Mountain", "Mountain"),
  lucideByName("Sun", "Sun"),
  lucideByName("Moon", "Moon"),
  lucideByName("Waves", "Waves"),
  lucideByName("Music", "Music"),
  lucideByName("Headphones", "Audio"),
  lucideByName("Camera", "Camera"),
  lucideByName("Film", "Film"),
  lucideByName("Mic", "Voice"),
  lucideByName("Palette", "Design"),
  lucideByName("Brush", "Brush"),
  lucideByName("Puzzle", "Puzzle"),
  lucideByName("Gamepad2", "Game"),
  lucideByName("Trophy", "Trophy"),
  lucideByName("Gift", "Gift"),
  lucideByName("Shield", "Shield"),
  lucideByName("KeyRound", "Key"),
  lucideByName("Users", "People"),
  lucideByName("User", "Person"),
  lucideByName("MessageCircle", "Chat"),
  lucideByName("Mail", "Mail"),
  lucideByName("Calendar", "Calendar"),
  lucideByName("Clock", "Time"),
  lucideByName("House", "Home", "home"),
  lucideByName("Building2", "Place", "building"),
  lucideByName("GraduationCap", "Learning"),
  lucideByName("BookOpen", "Book"),
  lucideByName("Hammer", "Build"),
  lucideByName("Wrench", "Tools"),
  lucideByName("Package", "Package"),
  lucideByName("ShoppingBag", "Shop"),
  lucideByName("Cpu", "Tech"),
  lucideByName("Code", "Code"),
  lucideByName("Database", "Data"),
  lucideByName("Wifi", "Signal"),
  lucideByName("Activity", "Pulse"),
  lucideByName("HeartPulse", "Wellbeing"),
  lucideByName("Brain", "Mind"),
  lucideByName("Eye", "Vision"),
  lucideByName("Hand", "Touch"),
  lucideByName("Ear", "Hearing"),
  lucideByName("Atom", "Atom"),
  lucideByName("Orbit", "Orbit"),
  lucideByName("Telescope", "Explore"),
  lucideByName("Plane", "Travel"),
  lucideByName("Anchor", "Anchor"),
  lucideByName("Coffee", "Coffee"),
  lucideByName("Zap", "Spark"),
  lucideByName("Infinity", "Infinity"),
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
      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 rounded-lg bg-zinc-900 border border-border shadow-xl z-50 grid grid-cols-6 gap-1 w-[252px] max-h-[216px] overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      data-prevent-canvas-wheel="true"
    >
      {BOARD_ICONS.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={cn(
            "w-9 h-9 rounded hover:bg-primary/20 transition-colors flex items-center justify-center",
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

// ─── Table element ──────────────────────────────────────────────────────────

/**
 * Single editable table cell. Uncontrolled contentEditable that only syncs its
 * DOM text from the model when NOT focused — this prevents cursor-jump during
 * typing and keeps writes off the per-keystroke path (commit happens on blur).
 */
function TableCellEditor({
  value,
  onCommit,
  onFocusCell,
  onEditingChange,
  disabled,
  editable,
  style,
}: {
  value: string;
  onCommit: (text: string) => void;
  onFocusCell: () => void;
  onEditingChange?: (editing: boolean) => void;
  disabled: boolean;
  // Whether THIS cell is the one actively being text-edited (double-click or
  // Enter puts exactly one cell into this state at a time). While false the
  // div is not contentEditable at all, so a plain click can only select the
  // cell (handled by the parent td's onClick) instead of grabbing a caret.
  editable: boolean;
  style: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  // Sync external value into the DOM only while the user is not editing.
  useEffect(() => {
    if (!focused.current && ref.current && ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  });

  // Entering edit mode (double-click / Enter) flips `editable` true on a div
  // that wasn't focused a moment ago — pick up the caret and drop it at the
  // end of the existing text, mirroring the common spreadsheet convention.
  useEffect(() => {
    if (!editable || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [editable]);

  return (
    <div
      ref={ref}
      data-no-drag
      contentEditable={!disabled && editable}
      suppressContentEditableWarning
      className="outline-none w-full whitespace-pre-wrap break-words"
      style={{ ...style, cursor: editable ? "text" : "default" }}
      onFocus={() => {
        focused.current = true;
        onEditingChange?.(true);
        onFocusCell();
      }}
      onBlur={() => {
        focused.current = false;
        onEditingChange?.(false);
        const text = ref.current?.textContent ?? "";
        if (text !== value) onCommit(text);
      }}
    />
  );
}

type TableColorScope = "cell" | "row" | "col" | "table";

// ─── Table color + measurement helpers ──────────────────────────────────────

// Five preset background base colors (violet-forward, aligned with the palette).
const TABLE_PRESET_BGS = ["#4B1B6B", "#123A5A", "#0F3A3A", "#3B1842", "#1B2A44"] as const;

// Grid line width presets — kept coarse so lines never read as heavy/ugly.
const TABLE_LINE_WIDTHS: { label: string; w: number }[] = [
  { label: "Thin", w: 1 },
  { label: "Medium", w: 2 },
  { label: "Thick", w: 4 },
  { label: "None", w: 0 },
];

// Cell text-size buttons → concrete px. Default md.
const TABLE_FONT_PX: Record<"sm" | "md" | "lg", number> = { sm: 12, md: 14, lg: 18 };
const TABLE_FONT_SIZES: { key: "sm" | "md" | "lg"; label: string }[] = [
  { key: "sm", label: "Small" },
  { key: "md", label: "Medium" },
  { key: "lg", label: "Large" },
];

// Layout chrome. The table content sits inside the element with a small margin on
// every side: top/left host the row/column reorder handles and give the selection
// frame room; right/bottom additionally reserve space so the "+" add buttons sit
// FULLY OUTSIDE the grid (never over a cell, never over the bottom/right border).
const TBL_FRAME = 10;   // selection frame band width (inner-glow, item 1) + drag affordance
// Top/left content margin. Reserves room for the row/column reorder handles to sit
// BELOW the connector port orb (which is centered on the element edge and reaches
// ~11px inward), so a handle never overlaps the orb. See TBL_HANDLE_OFF.
const TBL_PAD = 28;
// Distance from the element edge to the reorder handle band. Kept > the connector
// orb's inward reach (~11px) so the handle clears the orb; the band then fills the
// remaining margin down to the grid's top/left border.
const TBL_HANDLE_OFF = 15;
const TBL_PLUS = 18;    // size of a right/bottom "+" add button
const TBL_PLUS_GAP = 6; // clear gap between the table border and the "+" button
const TBL_RIGHT = TBL_PLUS + TBL_PLUS_GAP + 6; // right/bottom content inset (button lives here, outside the grid)
const TBL_PLUS_LEN = 44; // length of a centered "+" button along its edge
const TBL_MIN_COL = 48; // px floor a column can't be dragged below
const TBL_MIN_ROW = 28; // px floor a row can't be dragged below
const TBL_MAX_TRACKS = 50; // sane ceiling for drag-to-add rows/cols

// Ghost-purple selection frame — a soft inset-shadow-style inner glow, ~10px wide,
// opaque violet at the outer edge fading inward to transparency. Rendered as four
// edge bands (top/right/bottom/left) so the table's interior stays clickable; each
// band is the drag-to-move affordance (pointer-events-auto + cursor-move, bubbling
// to the element body-drag path).
const TBL_FRAME_V = "rgba(167,139,250,0.55)";
const TBL_FRAME_TOP = `linear-gradient(180deg, ${TBL_FRAME_V} 0%, rgba(167,139,250,0) 100%)`;
const TBL_FRAME_BOTTOM = `linear-gradient(0deg, ${TBL_FRAME_V} 0%, rgba(167,139,250,0) 100%)`;
const TBL_FRAME_LEFT = `linear-gradient(90deg, ${TBL_FRAME_V} 0%, rgba(167,139,250,0) 100%)`;
const TBL_FRAME_RIGHT = `linear-gradient(270deg, ${TBL_FRAME_V} 0%, rgba(167,139,250,0) 100%)`;

// Reorder one track (column or row) and its per-track styling in lockstep: removes
// the item at `from` and re-inserts it at `to`. Used by the row/column drag-reorder.
function tblMoveItem<T>(arr: T[], from: number, to: number): T[] {
  const a = [...arr];
  if (from < 0 || from >= a.length) return a;
  const [x] = a.splice(from, 1);
  a.splice(Math.max(0, Math.min(a.length, to)), 0, x);
  return a;
}

// Transparent-swatch checkerboard (shared with the rest of the color UI).
const TBL_CHECKER =
  "bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiLz48cmVjdCB4PSI0IiB5PSI0IiB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjY2NjIi8+PC9zdmc+')]";

function tblHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function tblMix(
  c: { r: number; g: number; b: number },
  t: { r: number; g: number; b: number },
  amt: number,
): string {
  const r = Math.round(c.r + (t.r - c.r) * amt);
  const g = Math.round(c.g + (t.g - c.g) * amt);
  const b = Math.round(c.b + (t.b - c.b) * amt);
  return `rgb(${r}, ${g}, ${b})`;
}
/** Turn a flat color into a tasteful 2-stop (normal tone → shade) gradient.
 *  angle picks the direction: 135deg diagonal (cell scope, confined), 90deg
 *  horizontal (row scope, sliced continuously across the row's cells), 180deg
 *  vertical (column scope, sliced continuously down the column's cells). */
function tblToGradient(color: string, angle = 135): string {
  if (!color || color === "transparent" || color.includes("gradient")) return color;
  const rgb = tblHexToRgb(color);
  if (!rgb) return color;
  const dark = tblMix(rgb, { r: 0, g: 0, b: 0 }, 0.38);
  return `linear-gradient(${angle}deg, ${color} 0%, ${dark} 100%)`;
}

/**
 * Table card — editable data grid with per-cell text, cell/row/column/table
 * coloring, and basic text formatting. Commits go through the shared onUpdate
 * path (whole-grid replace on edit; tables are small). onUpdate is already
 * ref-stabilized by CanvasElementRenderer.
 *
 * Chrome:
 *  - a four-side ghost-purple selection frame (soft inner glow, shown only while
 *    selected) is the drag-to-move zone: its edge bands capture the pointer above
 *    the floating connector port and bubble to the element's body-drag path, with a
 *    six-dot GripVertical marking the handle; the interior stays clickable;
 *  - right/bottom "+" buttons sit FULLY OUTSIDE the grid (in the reserved margin
 *    beyond the last col/row) = click to add one row/col, drag to add many (drag
 *    back removes just-added, never below the pre-drag count / 1×1). A live ghost
 *    preview of the provisional rows/cols renders during the drag; the store is
 *    written once on pointer-up;
 *  - reorder handles in the top/left margin drag a column/row to a new position;
 *    the cells grid and all per-track styling move in lockstep, committed on drop;
 *  - draggable dividers between columns/rows set per-track sizes (colWidths /
 *    rowHeights, stored as px and normalized to the element size so element
 *    resize scales proportionally while divider drag sets individual tracks);
 *  - a left-side BACKGROUND menu (presets + transparent + wheel + solid/gradient;
 *    a table-scope gradient is one continuous corner-to-corner gradient) and a
 *    bottom formatting menu (text color white/black/wheel, bold/italic, align,
 *    header toggle).
 */
function TableCard({
  element,
  onUpdate,
  isSelected,
  isReadOnly,
  canvasZoom = 1,
}: {
  element: TableElement;
  onUpdate: (updates: Partial<TableElement>) => void;
  isSelected: boolean;
  isReadOnly: boolean;
  canvasZoom?: number;
}) {
  const rows = element.rows ?? 3;
  const cols = element.cols ?? 3;
  const rowColors = element.rowColors;
  const colColors = element.colColors;
  const rowGradient = element.rowGradient;
  const colGradient = element.colGradient;
  const tableBg = element.tableBg;
  const tableGradient = element.tableGradient;
  // Grid lines: lineColor/lineWidth are the current model; borderColor is the
  // legacy fallback. lineWidth 0 = no visible grid line.
  const lineColor = element.lineColor || element.borderColor || "rgba(139,92,246,0.28)";
  const lineWidth = element.lineWidth ?? 1;
  // Grid lines are NOT drawn as per-cell CSS borders (those scale with the canvas
  // transform and round inconsistently at fractional zoom → uneven weights, and the
  // outer edges get clipped by the content wrapper's overflow-hidden so the bottom/
  // right of the grid can vanish when unselected). Instead every horizontal and
  // vertical line — plus the closing outer rectangle — is one SVG overlay stroke with
  // vector-effect:non-scaling-stroke, so all lines are identical in width and color and
  // stay crisp at ANY zoom. See the gridLines overlay in the render below.
  const headerRow = element.headerRow ?? false;
  const zoom = canvasZoom || 1;

  // Selected vs. editing are two distinct states: a single click selects a cell
  // (arrow keys then navigate between cells); double-click or Enter puts that one
  // cell into text-edit mode (arrow keys then move the caret as normal, handled
  // natively by the contentEditable div).
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [editingCellPos, setEditingCellPos] = useState<{ r: number; c: number } | null>(null);
  const [scope, setScope] = useState<TableColorScope>("cell");
  const [bgGradient, setBgGradient] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Live drag previews (local state only — the store is written once on pointer-up).
  const [dragCol, setDragCol] = useState<{ i: number; a: number; b: number } | null>(null);
  const [dragRow, setDragRow] = useState<{ i: number; a: number; b: number } | null>(null);
  const [pendingCount, setPendingCount] = useState<{ axis: "row" | "col"; n: number } | null>(null);
  // Live reorder previews — { from, to } track index while dragging a move handle.
  const [reorderCol, setReorderCol] = useState<{ from: number; to: number } | null>(null);
  const [reorderRow, setReorderRow] = useState<{ from: number; to: number } | null>(null);
  // Whether the pointer is hovering a reorder handle — drives the whole-row/column
  // selection outline so it is clear what a handle click/drag will move.
  const [hoverColHandle, setHoverColHandle] = useState(false);
  const [hoverRowHandle, setHoverRowHandle] = useState(false);

  // Clear the selected/editing cell whenever the whole element is deselected.
  useEffect(() => {
    if (!isSelected) {
      setSel(null);
      setEditingCellPos(null);
    }
  }, [isSelected]);

  // Blur the active cell editor when the user clicks anywhere outside this table
  // (mirrors the embed/outside-click idiom). Attached only while a cell is being
  // edited and torn down when editing ends or the component unmounts, so no
  // document listener ever leaks. Without this the caret keeps blinking (and
  // typing keeps landing) in the cell after the element is deselected.
  useEffect(() => {
    if (!editingCellPos) return;
    const onDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (root.contains(e.target as Node)) return; // click inside the table — leave focus alone
      const active = document.activeElement as HTMLElement | null;
      if (active && active.isContentEditable && root.contains(active)) active.blur();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [editingCellPos]);

  // Defensive grid: always a full rows×cols matrix even if the model is partial.
  const grid: TableCell[][] = useMemo(() => {
    const src = element.cells || [];
    const g: TableCell[][] = [];
    for (let r = 0; r < rows; r++) {
      const row = src[r] || [];
      const out: TableCell[] = [];
      for (let c = 0; c < cols; c++) out.push(row[c] ? { ...row[c] } : { text: "" });
      g.push(out);
    }
    return g;
  }, [element.cells, rows, cols]);

  // Content area = element minus the surrounding margins (top/left = TBL_PAD;
  // right/bottom also reserve TBL_RIGHT so the "+" buttons live outside the grid).
  // Constant regardless of selection, so selecting never reflows the grid.
  const availW = Math.max(1, element.width - TBL_PAD - TBL_RIGHT);
  const availH = Math.max(1, element.height - TBL_PAD - TBL_RIGHT);

  // Column widths / row heights normalized to the content area. Ratio model:
  // element resize scales all tracks proportionally (no store write); divider
  // drag sets individual tracks (one store write on release).
  const colPx = useMemo(() => {
    const raw =
      element.colWidths && element.colWidths.length === cols
        ? element.colWidths.map((w) => (w > 0 ? w : 1))
        : Array(cols).fill(availW / cols);
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map((w) => (w / sum) * availW);
  }, [element.colWidths, cols, availW]);

  const rowPx = useMemo(() => {
    const raw =
      element.rowHeights && element.rowHeights.length === rows
        ? element.rowHeights.map((h) => (h > 0 ? h : 1))
        : Array(rows).fill(availH / rows);
    const sum = raw.reduce((a, b) => a + b, 0) || 1;
    return raw.map((h) => (h / sum) * availH);
  }, [element.rowHeights, rows, availH]);

  // Apply live divider preview over the committed track sizes.
  const dispCol = useMemo(() => {
    if (!dragCol) return colPx;
    const next = [...colPx];
    next[dragCol.i] = dragCol.a;
    next[dragCol.i + 1] = dragCol.b;
    return next;
  }, [colPx, dragCol]);
  const dispRow = useMemo(() => {
    if (!dragRow) return rowPx;
    const next = [...rowPx];
    next[dragRow.i] = dragRow.a;
    next[dragRow.i + 1] = dragRow.b;
    return next;
  }, [rowPx, dragRow]);

  // Left/top offset of each track (prefix sums of the displayed sizes) — used to
  // position each cell's slice of a continuous row/column gradient.
  const colLeft = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const w of dispCol) { out.push(acc); acc += w; }
    return out;
  }, [dispCol]);
  const rowTop = useMemo(() => {
    const out: number[] = [];
    let acc = 0;
    for (const h of dispRow) { out.push(acc); acc += h; }
    return out;
  }, [dispRow]);

  // Auto-grow rows to fit their content by MEASURING the real rendered layout in
  // REALTIME, not by estimating. A word-count estimate can't model CSS break-words
  // (a long unbroken string like "sdfgsdfgsdfg…" wraps to several lines the estimate
  // reads as one), so the row silently stayed too short and text spilled across the
  // gridline. Instead the browser lays the grid out — cells have no fixed height and
  // no overflow clip, so each <tr> grows naturally to fit its tallest cell — and a
  // ResizeObserver on the table fires whenever that rendered size changes. Crucially
  // that fires WHILE the user types into a contentEditable cell (the div expands
  // before the text is ever committed to the model on blur), so the model updates
  // live rather than only on deselect. On each change we read every row's real
  // offsetHeight and commit it as that row's height, keeping dispRow, the SVG
  // gridline overlay, and element.height in lockstep with what's painted, so wrapped
  // text always sits inside its cell and pushes the rows below it down.
  //
  // offsetHeight is border-box layout px, unaffected by the canvas zoom transform,
  // and for a table row equals max(committed height, content height) — a value above
  // the committed dispRow[r] means content overflowed and the row must grow. Grow-only:
  // rows are never shrunk here, so manual divider-drag enlargements and the ratio-resize
  // model are preserved. No RO feedback loop: committing rowHeights sets each row's
  // min-height to the height it ALREADY rendered at, so the observed table doesn't
  // change size and the observer doesn't re-fire (the signature guard is the backstop).
  // The observer reads live values via refs so it is created once and never re-subscribes
  // mid-keystroke.
  const trRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const tableRef = useRef<HTMLTableElement>(null);
  const autoGrowSigRef = useRef<string>("");
  const dispRowRef = useRef(dispRow);
  dispRowRef.current = dispRow;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const isReadOnlyRef = useRef(isReadOnly);
  isReadOnlyRef.current = isReadOnly;
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  // While the user is actively dragging a divider / reorder handle / plus button,
  // auto-grow measurement is SUSPENDED: otherwise the observer fires on the live
  // preview (columns/rows re-wrap → table resizes) and commits {rowHeights,height}
  // mid-drag, which thrashes the drag state and fights the manual adjustment (e.g.
  // the row you're shrinking snaps back to its content height on every mouse move).
  // The drag's own preview already reflows the grid visually; the model is resynced
  // once on release via measureRef, so rows still refit to any new column widths.
  const interactingRef = useRef(false);
  interactingRef.current = !!(dragCol || dragRow || pendingCount || reorderCol || reorderRow);
  const measureRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const table = tableRef.current;
    if (!table || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      if (isReadOnlyRef.current || interactingRef.current) return;
      const els = trRefs.current;
      const dRow = dispRowRef.current;
      const n = rowsRef.current;
      if (!els.length) return;
      const measured: number[] = [];
      let grew = false;
      for (let r = 0; r < n; r++) {
        const committed = dRow[r] || 0;
        const real = els[r] ? els[r]!.offsetHeight : committed;
        if (real > committed + 2) grew = true;
        measured.push(Math.round(Math.max(real, committed)));
      }
      if (!grew) return;
      const newHeight = Math.round(measured.reduce((a, b) => a + b, 0) + TBL_PAD + TBL_RIGHT);
      const sig = `${measured.join(",")}|${newHeight}`;
      if (autoGrowSigRef.current === sig) return;
      autoGrowSigRef.current = sig;
      onUpdateRef.current({ rowHeights: measured, height: newHeight });
    };
    measureRef.current = measure;
    const ro = new ResizeObserver(measure);
    ro.observe(table);
    measure(); // initial pass for content present at mount
    return () => ro.disconnect();
  }, []);

  const cloneGrid = useCallback(
    () => grid.map((row) => row.map((cell) => ({ ...cell }))),
    [grid],
  );

  const updateCell = useCallback(
    (r: number, c: number, patch: Partial<TableCell>) => {
      const next = cloneGrid();
      next[r][c] = { ...next[r][c], ...patch };
      onUpdate({ cells: next });
    },
    [cloneGrid, onUpdate],
  );

  // Apply a cell patch across the current color scope (cell/row/col/table).
  // Used by the font-size controls so text size follows the same scope model.
  const applyCellScopePatch = useCallback(
    (patch: Partial<TableCell>) => {
      if (scope !== "table" && !sel) return;
      const next = cloneGrid();
      if (scope === "table") {
        for (let r = 0; r < rows; r++)
          for (let c = 0; c < cols; c++) next[r][c] = { ...next[r][c], ...patch };
      } else if (scope === "row" && sel) {
        for (let c = 0; c < cols; c++) next[sel.r][c] = { ...next[sel.r][c], ...patch };
      } else if (scope === "col" && sel) {
        for (let r = 0; r < rows; r++) next[r][sel.c] = { ...next[r][sel.c], ...patch };
      } else if (sel) {
        next[sel.r][sel.c] = { ...next[sel.r][sel.c], ...patch };
      }
      onUpdate({ cells: next });
    },
    [scope, sel, rows, cols, cloneGrid, onUpdate],
  );

  // Background for one cell, as a style fragment. Per-cell bg is a confined fill.
  // Row/column gradients render a SLICE of one continuous gradient (same image on
  // every cell in the track, sized to the whole track and shifted by the cell's
  // offset) so the gradient reads continuously across the row / down the column.
  const cellBgStyle = (r: number, c: number): React.CSSProperties => {
    const cell = grid[r][c];
    if (cell.bg) return { background: cell.bg };
    if (rowGradient && rowGradient[r]) {
      return {
        backgroundImage: tblToGradient(rowGradient[r] as string, 90),
        backgroundRepeat: "no-repeat",
        backgroundOrigin: "border-box",
        backgroundSize: `${availW}px 100%`,
        backgroundPosition: `-${colLeft[c] || 0}px 0`,
      };
    }
    if (colGradient && colGradient[c]) {
      return {
        backgroundImage: tblToGradient(colGradient[c] as string, 180),
        backgroundRepeat: "no-repeat",
        backgroundOrigin: "border-box",
        backgroundSize: `100% ${availH}px`,
        backgroundPosition: `0 -${rowTop[r] || 0}px`,
      };
    }
    if (rowColors && rowColors[r]) return { background: rowColors[r] || undefined };
    if (colColors && colColors[c]) return { background: colColors[c] || undefined };
    // Table-scope gradient: ONE gradient across the whole table. Every cell paints
    // the same table-wide image (sized to the full content W×H) and shifts it by
    // the cell's top-left offset, so each cell shows its slice of the single
    // corner-to-corner gradient — continuous, no per-cell repetition.
    if (tableGradient) {
      return {
        backgroundImage: tblToGradient(tableGradient, 135),
        backgroundRepeat: "no-repeat",
        backgroundOrigin: "border-box",
        backgroundSize: `${availW}px ${availH}px`,
        backgroundPosition: `-${colLeft[c] || 0}px -${rowTop[r] || 0}px`,
      };
    }
    if (tableBg) return { background: tableBg };
    if (headerRow && r === 0) return { background: "rgba(139,92,246,0.22)" };
    return {};
  };

  // BACKGROUND menu writes — applies the current Solid/Gradient toggle to the scope.
  // Cell + table gradients stay diagonal (135deg, confined). Row/column gradients
  // are stored as a base color in rowGradient/colGradient so the renderer can lay
  // one continuous horizontal/vertical gradient across the whole track; the matching
  // solid entry is cleared so exactly one background source wins.
  const applyBg = (raw: string) => {
    const isTransparent = raw === "transparent";
    const color = isTransparent ? "transparent" : bgGradient ? tblToGradient(raw) : raw;
    if (scope === "table") {
      // Gradient at table scope becomes ONE continuous corner-to-corner gradient
      // (stored as a base color in tableGradient; the renderer slices it per cell).
      // A solid/transparent table fill clears tableGradient ('' reads as unset) so
      // exactly one background source wins.
      if (bgGradient && !isTransparent) {
        onUpdate({ tableGradient: raw });
      } else {
        onUpdate({ tableBg: color, tableGradient: "" });
      }
      return;
    }
    if (!sel) return;
    if (scope === "cell") {
      updateCell(sel.r, sel.c, { bg: color });
    } else if (scope === "row") {
      const rc = rowColors ? [...rowColors] : Array<string | null>(rows).fill(null);
      const rg = rowGradient ? [...rowGradient] : Array<string | null>(rows).fill(null);
      if (bgGradient && !isTransparent) {
        rg[sel.r] = raw;   // continuous horizontal gradient from this base color
        rc[sel.r] = null;
      } else {
        rc[sel.r] = color; // solid (or transparent)
        rg[sel.r] = null;
      }
      onUpdate({ rowColors: rc, rowGradient: rg });
    } else if (scope === "col") {
      const cc = colColors ? [...colColors] : Array<string | null>(cols).fill(null);
      const cg = colGradient ? [...colGradient] : Array<string | null>(cols).fill(null);
      if (bgGradient && !isTransparent) {
        cg[sel.c] = raw;   // continuous vertical gradient from this base color
        cc[sel.c] = null;
      } else {
        cc[sel.c] = color;
        cg[sel.c] = null;
      }
      onUpdate({ colColors: cc, colGradient: cg });
    }
  };

  // Structure resize — sets an absolute row/col count, growing/shrinking the
  // element by one track-unit per added/removed track so existing tracks keep
  // their pixel size. Called once on pointer-up (never per drag frame).
  const setColCount = useCallback(
    (target: number) => {
      const t = Math.max(1, Math.round(target));
      if (t === cols) return;
      const unit = availW / cols;
      let next = cloneGrid();
      if (t > cols) {
        next = next.map((row) => [
          ...row,
          ...Array.from({ length: t - cols }, () => ({ text: "" }) as TableCell),
        ]);
      } else {
        next = next.map((row) => row.slice(0, t));
      }
      const updates: Partial<TableElement> = {
        cols: t,
        cells: next,
        width: Math.max(80, element.width + (t - cols) * unit),
      };
      if (colColors)
        updates.colColors =
          t > cols ? [...colColors, ...Array(t - cols).fill(null)] : colColors.slice(0, t);
      if (colGradient)
        updates.colGradient =
          t > cols ? [...colGradient, ...Array(t - cols).fill(null)] : colGradient.slice(0, t);
      if (element.colWidths) {
        const base = element.colWidths.length === cols ? element.colWidths : colPx;
        updates.colWidths = t > cols ? [...base, ...Array(t - cols).fill(unit)] : base.slice(0, t);
      }
      onUpdate(updates);
      setSel(null);
    },
    [cols, availW, cloneGrid, colColors, colGradient, element.colWidths, element.width, colPx, onUpdate],
  );

  const setRowCount = useCallback(
    (target: number) => {
      const t = Math.max(1, Math.round(target));
      if (t === rows) return;
      const unit = availH / rows;
      let next = cloneGrid();
      if (t > rows) {
        for (let i = rows; i < t; i++)
          next.push(Array.from({ length: cols }, () => ({ text: "" }) as TableCell));
      } else {
        next = next.slice(0, t);
      }
      const updates: Partial<TableElement> = {
        rows: t,
        cells: next,
        height: Math.max(60, element.height + (t - rows) * unit),
      };
      if (rowColors)
        updates.rowColors =
          t > rows ? [...rowColors, ...Array(t - rows).fill(null)] : rowColors.slice(0, t);
      if (rowGradient)
        updates.rowGradient =
          t > rows ? [...rowGradient, ...Array(t - rows).fill(null)] : rowGradient.slice(0, t);
      if (element.rowHeights) {
        const base = element.rowHeights.length === rows ? element.rowHeights : rowPx;
        updates.rowHeights = t > rows ? [...base, ...Array(t - rows).fill(unit)] : base.slice(0, t);
      }
      onUpdate(updates);
      setSel(null);
    },
    [rows, cols, availH, cloneGrid, rowColors, rowGradient, element.rowHeights, element.height, rowPx, onUpdate],
  );

  // Minimum width a column can be dragged to. A flat floor now that cells wrap:
  // long/unbroken content no longer needs the column to be wide (break-words wraps
  // it and the row grows to fit), so the column may go as narrow as TBL_MIN_COL.
  // The previous "widest word" floor ballooned to ~85% of the table for a cell
  // holding one long no-space string, which squished every other column to the
  // floor and made the dividers impossible to drag.
  const colMinWidth = useCallback((_c: number): number => TBL_MIN_COL, []);

  // ─── Divider drags (per-column / per-row resize) ───────────────────────────
  const startColDivider = (i: number) => (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const minL = colMinWidth(i);
    const minR = colMinWidth(i + 1);
    const startX = e.clientX;
    const baseA = colPx[i];
    const baseB = colPx[i + 1];
    let finalA = baseA;
    let finalB = baseB;
    const move = (ev: MouseEvent) => {
      const delta = (ev.clientX - startX) / zoom;
      let a = baseA + delta;
      let b = baseB - delta;
      if (a < minL) {
        b -= minL - a;
        a = minL;
      }
      if (b < minR) {
        a -= minR - b;
        b = minR;
      }
      finalA = a;
      finalB = b;
      setDragCol({ i, a, b });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      const next = [...colPx];
      next[i] = finalA;
      next[i + 1] = finalB;
      setDragCol(null);
      onUpdate({ colWidths: next });
      // Columns changed → some rows may now wrap differently. Auto-grow was
      // suspended during the drag; resync once after the committed layout paints.
      requestAnimationFrame(() => measureRef.current?.());
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const startRowDivider = (i: number) => (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const baseA = rowPx[i];
    const baseB = rowPx[i + 1];
    let finalA = baseA;
    let finalB = baseB;
    const move = (ev: MouseEvent) => {
      const delta = (ev.clientY - startY) / zoom;
      let a = baseA + delta;
      let b = baseB - delta;
      if (a < TBL_MIN_ROW) {
        b -= TBL_MIN_ROW - a;
        a = TBL_MIN_ROW;
      }
      if (b < TBL_MIN_ROW) {
        a -= TBL_MIN_ROW - b;
        b = TBL_MIN_ROW;
      }
      finalA = a;
      finalB = b;
      setDragRow({ i, a, b });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      const next = [...rowPx];
      next[i] = finalA;
      next[i + 1] = finalB;
      setDragRow(null);
      onUpdate({ rowHeights: next });
      // Auto-grow was suspended during the drag; resync after paint so a row the
      // user shrank below its content snaps back to fit (content is never clipped),
      // while a row grown taller than its content keeps the manual height.
      requestAnimationFrame(() => measureRef.current?.());
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // ─── Plus-button drags (add/remove rows & columns) ─────────────────────────
  const startColPlus = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const base = cols;
    const unit = Math.max(24, availW / cols); // ~one column-width per column
    let moved = 0;
    let target = base;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      moved = Math.max(moved, Math.abs(dx));
      // Fully bidirectional: drag right past the edge ADDS columns, drag left past
      // the current extent DELETES them (down to 1). Clamped 1..MAX.
      const delta = Math.round(dx / unit);
      target = Math.max(1, Math.min(TBL_MAX_TRACKS, base + delta));
      setPendingCount({ axis: "col", n: target });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setPendingCount(null);
      if (target === base && moved < 4) setColCount(base + 1); // treat as a click
      else if (target !== base) setColCount(target);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const startRowPlus = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const base = rows;
    const unit = Math.max(24, availH / rows); // ~one row-height per row
    let moved = 0;
    let target = base;
    const move = (ev: MouseEvent) => {
      const dy = (ev.clientY - startY) / zoom;
      moved = Math.max(moved, Math.abs(dy));
      // Fully bidirectional: drag down past the edge ADDS rows, drag up past the
      // current extent DELETES them (down to 1). Clamped 1..MAX.
      const delta = Math.round(dy / unit);
      target = Math.max(1, Math.min(TBL_MAX_TRACKS, base + delta));
      setPendingCount({ axis: "row", n: target });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setPendingCount(null);
      if (target === base && moved < 4) setRowCount(base + 1);
      else if (target !== base) setRowCount(target);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // ─── Row / column reorder (drag a move handle to a new position) ───────────
  // The cells grid and every per-track array (colColors/colGradient/colWidths for
  // a column; rowColors/rowGradient/rowHeights for a row) move in lockstep, so a
  // track carries all its styling to the new index. Committed once on pointer-up.
  const commitColReorder = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = cloneGrid().map((row) => tblMoveItem(row, from, to));
      const updates: Partial<TableElement> = { cells: next };
      if (colColors && colColors.length === cols) updates.colColors = tblMoveItem([...colColors], from, to);
      if (colGradient && colGradient.length === cols) updates.colGradient = tblMoveItem([...colGradient], from, to);
      if (element.colWidths && element.colWidths.length === cols)
        updates.colWidths = tblMoveItem([...element.colWidths], from, to);
      onUpdate(updates);
      setSel((s) => (s ? { ...s, c: to } : s));
    },
    [cloneGrid, colColors, colGradient, element.colWidths, cols, onUpdate],
  );

  const commitRowReorder = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = tblMoveItem(cloneGrid(), from, to);
      const updates: Partial<TableElement> = { cells: next };
      if (rowColors && rowColors.length === rows) updates.rowColors = tblMoveItem([...rowColors], from, to);
      if (rowGradient && rowGradient.length === rows) updates.rowGradient = tblMoveItem([...rowGradient], from, to);
      if (element.rowHeights && element.rowHeights.length === rows)
        updates.rowHeights = tblMoveItem([...element.rowHeights], from, to);
      onUpdate(updates);
      setSel((s) => (s ? { ...s, r: to } : s));
    },
    [cloneGrid, rowColors, rowGradient, element.rowHeights, rows, onUpdate],
  );

  const startColReorder = (c: number) => (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    let to = c;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / zoom;
      const center = (colLeft[c] || 0) + dispCol[c] / 2 + dx;
      let t = cols - 1;
      for (let i = 0; i < cols; i++) {
        if (center < (colLeft[i] || 0) + dispCol[i]) { t = i; break; }
      }
      to = Math.max(0, Math.min(cols - 1, t));
      setReorderCol({ from: c, to });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setReorderCol(null);
      commitColReorder(c, to);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const startRowReorder = (r: number) => (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    let to = r;
    const move = (ev: MouseEvent) => {
      const dy = (ev.clientY - startY) / zoom;
      const center = (rowTop[r] || 0) + dispRow[r] / 2 + dy;
      let t = rows - 1;
      for (let i = 0; i < rows; i++) {
        if (center < (rowTop[i] || 0) + dispRow[i]) { t = i; break; }
      }
      to = Math.max(0, Math.min(rows - 1, t));
      setReorderRow({ from: r, to });
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setReorderRow(null);
      commitRowReorder(r, to);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  const selCell = sel ? grid[sel.r]?.[sel.c] : undefined;

  // Live drag-preview. Adding: how many provisional rows/cols the drag would append
  // and the size each lands at (matches setColCount/setRowCount — each new track is
  // availW/cols · availH/rows). Deleting: how many existing rows/cols would be
  // removed, plus the on-screen span of the doomed region (from the first removed
  // track to the current edge) so a red strike-overlay can mark it.
  const previewCols = pendingCount?.axis === "col" ? Math.max(0, pendingCount.n - cols) : 0;
  const previewRows = pendingCount?.axis === "row" ? Math.max(0, pendingCount.n - rows) : 0;
  const previewColW = availW / cols;
  const previewRowH = availH / rows;
  const removeCols = pendingCount?.axis === "col" ? Math.max(0, cols - pendingCount.n) : 0;
  const removeRows = pendingCount?.axis === "row" ? Math.max(0, rows - pendingCount.n) : 0;
  const removeColLeft = removeCols > 0 ? colLeft[pendingCount!.n] || 0 : 0;
  const removeRowTop = removeRows > 0 ? rowTop[pendingCount!.n] || 0 : 0;

  const scopeBtn = (s: TableColorScope, label: string) => (
    <button
      key={s}
      onClick={(e) => {
        e.stopPropagation();
        setScope(s);
      }}
      className={cn(
        "px-1.5 py-1 rounded text-[11px] font-medium transition-colors",
        scope === s
          ? "bg-primary/30 text-primary ring-1 ring-primary"
          : "text-muted-foreground hover:bg-primary/15 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const fmtBtn = (
    keyId: string,
    active: boolean,
    onClick: (e: React.MouseEvent) => void,
    title: string,
    icon: React.ReactNode,
  ) => (
    <button
      key={keyId}
      onClick={onClick}
      disabled={!sel}
      className={cn(
        "p-1.5 rounded hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors disabled:opacity-40",
        active && "bg-primary/20 text-primary",
      )}
      title={title}
    >
      {icon}
    </button>
  );

  // Cell selected but not editing: arrow keys move `sel` between cells; Enter/F2
  // starts editing the selected cell. While a cell IS being edited, this returns
  // without touching the keys at all — the contentEditable div handles arrows as
  // normal caret movement, and the canvas's own global arrow-key handler already
  // no-ops for a focused contentEditable (see cxd-canvas.tsx's isEditingText check)
  // so nothing here needs to coordinate with it in that state. Only in the
  // "selected but not editing" state must this stop the event before it reaches
  // that global handler, which would otherwise nudge the whole table element.
  const handleTableKeyDown = (e: React.KeyboardEvent) => {
    if (!sel || editingCellPos) return;
    const { r, c } = sel;
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      e.stopPropagation();
      let nr = r;
      let nc = c;
      if (e.key === "ArrowUp") nr = Math.max(0, r - 1);
      if (e.key === "ArrowDown") nr = Math.min(rows - 1, r + 1);
      if (e.key === "ArrowLeft") nc = Math.max(0, c - 1);
      if (e.key === "ArrowRight") nc = Math.min(cols - 1, c + 1);
      setSel({ r: nr, c: nc });
      return;
    }
    if (!isReadOnly && (e.key === "Enter" || e.key === "F2")) {
      e.preventDefault();
      e.stopPropagation();
      setEditingCellPos({ r, c });
    }
  };

  return (
    <div
      ref={rootRef}
      tabIndex={0}
      onKeyDown={handleTableKeyDown}
      className="relative w-full h-full outline-none"
    >
      {/* Content area (inset by TBL_PAD on top/left; right/bottom also reserve
          TBL_RIGHT so the "+" buttons sit outside the grid). No overflow clipping —
          rows are allowed to grow taller than their committed height so wrapped
          cell text is never cut off; the auto-grow effect above keeps element.height
          in sync so this almost never visibly overflows past the reserved margin. */}
      <div
        className="absolute"
        style={{ left: TBL_PAD, top: TBL_PAD, right: TBL_RIGHT, bottom: TBL_RIGHT }}
      >
        <table
          ref={tableRef}
          className="border-collapse"
          style={{ tableLayout: "fixed", width: availW }}
        >
          <colgroup>
            {dispCol.map((w, c) => (
              <col key={c} style={{ width: w }} />
            ))}
          </colgroup>
          <tbody>
            {grid.map((row, r) => (
              <tr
                key={r}
                ref={(el) => {
                  trRefs.current[r] = el;
                }}
                style={{ height: dispRow[r] }}
              >
                {row.map((cell, c) => {
                  const isSel = sel?.r === r && sel?.c === c;
                  const isEditingThisCell = editingCellPos?.r === r && editingCellPos?.c === c;
                  const isHeader = headerRow && r === 0;
                  return (
                    <td
                      key={c}
                      className={cn(
                        // vertical-align: middle centers short text; the cell stays a
                        // real table-cell (NEVER display:flex — that collapses the
                        // whole fixed grid) so columns keep their widths and rows grow
                        // naturally to fit tall/wrapped content.
                        "relative align-middle p-0",
                        isSel && "outline outline-2 -outline-offset-2 outline-violet-400",
                      )}
                      style={{ ...cellBgStyle(r, c) }}
                      onClick={() => {
                        setSel({ r, c });
                        rootRef.current?.focus();
                      }}
                      onDoubleClick={() => {
                        if (isReadOnly) return;
                        setSel({ r, c });
                        setEditingCellPos({ r, c });
                      }}
                    >
                      <TableCellEditor
                        value={cell.text || ""}
                        disabled={isReadOnly}
                        editable={!isReadOnly && isEditingThisCell}
                        onCommit={(text) => updateCell(r, c, { text })}
                        onFocusCell={() => setSel({ r, c })}
                        onEditingChange={(editing) => {
                          setEditingCellPos((prev) => {
                            if (editing) return { r, c };
                            return prev && prev.r === r && prev.c === c ? null : prev;
                          });
                        }}
                        style={{
                          color: cell.color || "#ffffff",
                          fontWeight: cell.bold ? 700 : isHeader ? 700 : 400,
                          fontStyle: cell.italic ? "italic" : "normal",
                          // Horizontal alignment per the cell's align field (default
                          // left; header defaults center). Vertical centering comes
                          // from the td's vertical-align:middle so short text sits
                          // mid-cell while long text still wraps and grows the row.
                          textAlign: cell.align || (isHeader ? "center" : "left"),
                          fontSize:
                            isHeader && !cell.fontSize ? 16 : TABLE_FONT_PX[cell.fontSize || "md"],
                          lineHeight: 1.35,
                          padding: "4px 6px",
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>

        {/* Column dividers — drag to resize the two adjacent columns */}
        {isSelected &&
          !isReadOnly &&
          dispCol.slice(0, -1).map((_, i) => {
            const left = dispCol.slice(0, i + 1).reduce((a, b) => a + b, 0);
            return (
              <div
                key={`cd${i}`}
                data-no-drag
                onMouseDown={startColDivider(i)}
                className="absolute top-0 bottom-0 z-20 cursor-col-resize group/cd"
                style={{ left: left - 4, width: 8 }}
                title="Drag to resize column"
              >
                <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-violet-400/0 group-hover/cd:bg-violet-400/70 transition-colors" />
              </div>
            );
          })}
        {/* Row dividers — drag to resize the two adjacent rows */}
        {isSelected &&
          !isReadOnly &&
          dispRow.slice(0, -1).map((_, i) => {
            const top = dispRow.slice(0, i + 1).reduce((a, b) => a + b, 0);
            return (
              <div
                key={`rd${i}`}
                data-no-drag
                onMouseDown={startRowDivider(i)}
                className="absolute left-0 right-0 z-20 cursor-row-resize group/rd"
                style={{ top: top - 4, height: 8 }}
                title="Drag to resize row"
              >
                <div className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-violet-400/0 group-hover/rd:bg-violet-400/70 transition-colors" />
              </div>
            );
          })}
      </div>

      {/* Uniform grid lines (item 1 + item 3). A single SVG overlay draws every
          interior line AND the closing outer rectangle as strokes with an identical
          color/width. vector-effect:non-scaling-stroke keeps each stroke exactly
          lineWidth device-px regardless of the canvas scale(zoom) transform, so all
          lines render at the same weight and stay crisp at any zoom (no per-cell
          border sub-pixel rounding). It sits OUTSIDE the overflow-hidden content
          wrapper (overflow:visible) so the bottom/right edges are never clipped — the
          grid is a complete closed rectangle whether the table is selected or not.
          pointer-events:none keeps the cells underneath clickable/editable. */}
      {lineWidth > 0 && (
        <svg
          className="absolute pointer-events-none"
          width={availW}
          height={availH}
          shapeRendering="crispEdges"
          style={{ left: TBL_PAD, top: TBL_PAD, width: availW, height: availH, overflow: "visible", zIndex: 6 }}
        >
          {/* Closing outer border — all four sides, always present */}
          <rect
            x={0}
            y={0}
            width={availW}
            height={availH}
            fill="none"
            stroke={lineColor}
            strokeWidth={lineWidth}
            vectorEffect="non-scaling-stroke"
          />
          {/* Interior vertical lines (between columns) */}
          {colLeft.slice(1).map((x, i) => (
            <line
              key={`gv${i}`}
              x1={x}
              y1={0}
              x2={x}
              y2={availH}
              stroke={lineColor}
              strokeWidth={lineWidth}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* Interior horizontal lines (between rows) */}
          {rowTop.slice(1).map((y, i) => (
            <line
              key={`gh${i}`}
              x1={0}
              y1={y}
              x2={availW}
              y2={y}
              stroke={lineColor}
              strokeWidth={lineWidth}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>
      )}

      {/* Whole-row / whole-column selection outline (item 2b). Shown while a reorder
          handle is hovered (which row/column a click would move) and while a reorder
          drag is in progress (what is being moved). pointer-events:none so it never
          interferes with the handle or cells. */}
      {isSelected && !isReadOnly && sel && (hoverColHandle || reorderCol) && (
        <div
          className="absolute pointer-events-none z-40 rounded-[2px]"
          style={{
            left: TBL_PAD + (colLeft[reorderCol ? reorderCol.from : sel.c] || 0),
            top: TBL_PAD,
            width: dispCol[reorderCol ? reorderCol.from : sel.c] || 0,
            height: availH,
            boxShadow: "inset 0 0 0 2px rgba(167,139,250,0.95)",
            background: "rgba(167,139,250,0.12)",
          }}
        />
      )}
      {isSelected && !isReadOnly && sel && (hoverRowHandle || reorderRow) && (
        <div
          className="absolute pointer-events-none z-40 rounded-[2px]"
          style={{
            left: TBL_PAD,
            top: TBL_PAD + (rowTop[reorderRow ? reorderRow.from : sel.r] || 0),
            width: availW,
            height: dispRow[reorderRow ? reorderRow.from : sel.r] || 0,
            boxShadow: "inset 0 0 0 2px rgba(167,139,250,0.95)",
            background: "rgba(167,139,250,0.12)",
          }}
        />
      )}

      {/* Selection frame — four ghost-purple edge bands forming a soft inset glow
          around ALL FOUR sides of the table, shown ONLY while selected (absent on
          deselect). Each band is ~10px, opaque violet at the outer edge fading
          inward to transparency. The bands are the drag-to-move affordance:
          pointer-events-auto + cursor-move, raised above the floating connector
          port (z 9999) so a grab is never intercepted; they carry no handler and
          bubble to the element body-drag path (reposition). The interior between
          the bands stays uncovered so cells remain clickable/editable. A six-dot
          GripVertical on the top band marks the move handle. */}
      {isSelected && (
        <>
          {/* top */}
          <div
            className="absolute pointer-events-auto cursor-move"
            style={{ left: TBL_PAD, top: TBL_PAD, width: availW, height: TBL_FRAME, zIndex: 10000, background: TBL_FRAME_TOP }}
            title="Drag to move the table"
          />
          {/* bottom */}
          <div
            className="absolute pointer-events-auto cursor-move"
            style={{ left: TBL_PAD, top: TBL_PAD + availH - TBL_FRAME, width: availW, height: TBL_FRAME, zIndex: 10000, background: TBL_FRAME_BOTTOM }}
            title="Drag to move the table"
          />
          {/* left */}
          <div
            className="absolute pointer-events-auto cursor-move"
            style={{ left: TBL_PAD, top: TBL_PAD, width: TBL_FRAME, height: availH, zIndex: 10000, background: TBL_FRAME_LEFT }}
            title="Drag to move the table"
          />
          {/* right */}
          <div
            className="absolute pointer-events-auto cursor-move"
            style={{ left: TBL_PAD + availW - TBL_FRAME, top: TBL_PAD, width: TBL_FRAME, height: availH, zIndex: 10000, background: TBL_FRAME_RIGHT }}
            title="Drag to move the table"
          />
          {/* six-dot move handle on the top band */}
          <div
            className="absolute flex items-center justify-center pointer-events-none"
            style={{ left: TBL_PAD, top: TBL_PAD - 1, width: availW, height: TBL_FRAME + 2, zIndex: 10001 }}
          >
            <GripVertical className="w-3 h-3 text-violet-100/80 rotate-90" />
          </div>
        </>
      )}

      {/* Row / column reorder handles — a slim bar in the outer margin above the
          selected column (drag left/right to reorder columns) and left of the
          selected row (drag up/down to reorder rows). Subtle until hovered. The
          cells grid + all per-track styling move together, committed once on drop;
          a violet insertion line shows the live target position during the drag. */}
      {isSelected && !isReadOnly && sel && (
        <div
          data-no-drag
          onMouseDown={startColReorder(sel.c)}
          onMouseEnter={() => setHoverColHandle(true)}
          onMouseLeave={() => setHoverColHandle(false)}
          className="absolute z-30 flex items-center justify-center cursor-grab active:cursor-grabbing group/cr rounded"
          // Sits in the inner part of the top margin (offset past the connector orb by
          // TBL_HANDLE_OFF, ending 2px above the grid) so it never overlaps the orb.
          style={{ left: TBL_PAD + (colLeft[sel.c] || 0), top: TBL_HANDLE_OFF, width: dispCol[sel.c], height: TBL_PAD - TBL_HANDLE_OFF - 2 }}
          title="Drag to reorder column"
        >
          <div className="h-1.5 w-8 max-w-[80%] rounded-full bg-violet-400/40 group-hover/cr:bg-violet-400/80 transition-colors" />
        </div>
      )}
      {isSelected && !isReadOnly && sel && (
        <div
          data-no-drag
          onMouseDown={startRowReorder(sel.r)}
          onMouseEnter={() => setHoverRowHandle(true)}
          onMouseLeave={() => setHoverRowHandle(false)}
          className="absolute z-30 flex items-center justify-center cursor-grab active:cursor-grabbing group/rr rounded"
          // Sits in the inner part of the left margin (offset past the connector orb by
          // TBL_HANDLE_OFF, ending 2px before the grid) so it never overlaps the orb.
          style={{ left: TBL_HANDLE_OFF, top: TBL_PAD + (rowTop[sel.r] || 0), width: TBL_PAD - TBL_HANDLE_OFF - 2, height: dispRow[sel.r] }}
          title="Drag to reorder row"
        >
          <div className="w-1.5 h-8 max-h-[80%] rounded-full bg-violet-400/40 group-hover/rr:bg-violet-400/80 transition-colors" />
        </div>
      )}
      {/* Live insertion indicators during a reorder drag */}
      {reorderCol && (
        <div
          className="absolute pointer-events-none z-40"
          style={{ left: TBL_PAD + (colLeft[reorderCol.to] || 0) - 1, top: TBL_PAD, width: 2, height: availH, background: "rgba(167,139,250,0.95)" }}
        />
      )}
      {reorderRow && (
        <div
          className="absolute pointer-events-none z-40"
          style={{ left: TBL_PAD, top: TBL_PAD + (rowTop[reorderRow.to] || 0) - 1, width: availW, height: 2, background: "rgba(167,139,250,0.95)" }}
        />
      )}

      {/* Right "+" — click adds a column, drag to add/remove more. A compact pill
          sitting FULLY OUTSIDE the grid, in the right margin beyond the last column
          (TBL_PLUS_GAP past the table's right border) and centered on the table's
          height. It never covers a cell, and the table's right border stays fully
          drawn. */}
      {isSelected && !isReadOnly && (
        <button
          data-no-drag
          onMouseDown={startColPlus}
          className="absolute flex items-center justify-center text-violet-50 bg-violet-500/25 hover:bg-violet-500/45 ring-1 ring-inset ring-violet-300/30 shadow-sm transition-colors cursor-ew-resize rounded-full"
          style={{
            right: TBL_RIGHT - TBL_PLUS_GAP - TBL_PLUS,
            width: TBL_PLUS,
            height: TBL_PLUS_LEN,
            top: TBL_PAD + availH / 2,
            transform: "translateY(-50%)",
          }}
          title="Click to add a column · drag out to add, drag in to remove"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
      {/* Bottom "+" — click adds a row, drag to add/remove more. Compact pill fully
          OUTSIDE the grid, in the bottom margin beyond the last row and centered on
          the table's width. Never covers a cell; the bottom border stays fully drawn. */}
      {isSelected && !isReadOnly && (
        <button
          data-no-drag
          onMouseDown={startRowPlus}
          className="absolute flex items-center justify-center text-violet-50 bg-violet-500/25 hover:bg-violet-500/45 ring-1 ring-inset ring-violet-300/30 shadow-sm transition-colors cursor-ns-resize rounded-full"
          style={{
            bottom: TBL_RIGHT - TBL_PLUS_GAP - TBL_PLUS,
            height: TBL_PLUS,
            width: TBL_PLUS_LEN,
            left: TBL_PAD + availW / 2,
            transform: "translateX(-50%)",
          }}
          title="Click to add a row · drag out to add, drag in to remove"
        >
          <Plus className="w-4 h-4" />
        </button>
      )}

      {/* Live add-preview — ghost/outlined cells for the rows/cols the current drag
          would append, positioned exactly where the real tracks will land. Purely
          visual DOM (pointer-events-none); the store is written once on pointer-up.
          Extends past the element's right/bottom edge as the table "grows", and
          shrinks back to nothing as the drag returns to the pre-drag count. */}
      {previewCols > 0 &&
        Array.from({ length: previewCols }).map((_, i) => (
          <div
            key={`pcol${i}`}
            className="absolute pointer-events-none z-20"
            style={{
              left: TBL_PAD + availW + i * previewColW,
              top: TBL_PAD,
              width: previewColW,
              height: availH,
            }}
          >
            {dispRow.map((h, r) => (
              <div
                key={r}
                style={{
                  height: h,
                  border: "1px dashed rgba(167,139,250,0.8)",
                  background: "rgba(139,92,246,0.14)",
                }}
              />
            ))}
          </div>
        ))}
      {previewRows > 0 &&
        Array.from({ length: previewRows }).map((_, i) => (
          <div
            key={`prow${i}`}
            className="absolute pointer-events-none z-20 flex"
            style={{
              left: TBL_PAD,
              top: TBL_PAD + availH + i * previewRowH,
              width: availW,
              height: previewRowH,
            }}
          >
            {dispCol.map((w, c) => (
              <div
                key={c}
                style={{
                  width: w,
                  height: "100%",
                  border: "1px dashed rgba(167,139,250,0.8)",
                  background: "rgba(139,92,246,0.14)",
                }}
              />
            ))}
          </div>
        ))}

      {/* Live delete-preview — a red strike-overlay over the columns/rows the drag
          would remove (dragging inward past the current extent). Purely visual
          (pointer-events-none); the store is written once on pointer-up. */}
      {removeCols > 0 && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: TBL_PAD + removeColLeft,
            top: TBL_PAD,
            width: Math.max(0, availW - removeColLeft),
            height: availH,
            border: "1px dashed rgba(248,113,113,0.9)",
            background:
              "repeating-linear-gradient(45deg, rgba(239,68,68,0.22) 0px, rgba(239,68,68,0.22) 6px, rgba(239,68,68,0.08) 6px, rgba(239,68,68,0.08) 12px)",
          }}
        />
      )}
      {removeRows > 0 && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: TBL_PAD,
            top: TBL_PAD + removeRowTop,
            width: availW,
            height: Math.max(0, availH - removeRowTop),
            border: "1px dashed rgba(248,113,113,0.9)",
            background:
              "repeating-linear-gradient(45deg, rgba(239,68,68,0.22) 0px, rgba(239,68,68,0.22) 6px, rgba(239,68,68,0.08) 6px, rgba(239,68,68,0.08) 12px)",
          }}
        />
      )}

      {/* Live count badge during a plus-drag (complements the ghost preview) */}
      {pendingCount && (
        <div
          className={cn(
            "absolute -bottom-6 right-0 px-1.5 py-0.5 rounded text-white text-[10px] font-medium pointer-events-none z-30",
            (removeCols > 0 || removeRows > 0) ? "bg-red-600/90" : "bg-black/80",
          )}
        >
          {pendingCount.axis === "col" ? `${pendingCount.n} cols` : `${pendingCount.n} rows`}
        </div>
      )}

      {/* LEFT-side menus — Background panel, then Text panel stacked below it with
          a small gap. Both hang off the table's left edge so a tall table never
          hides them the way the old below-the-table popover did. */}
      {isSelected && !isReadOnly && (
        <div
          className="absolute right-full top-0 mr-2 z-[100] pointer-events-auto flex flex-col gap-2"
          data-no-drag
          style={{ transform: `scale(${1 / zoom})`, transformOrigin: "top right" }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Background panel (scope + fills + line presets) ── */}
          <div className="p-2 rounded-lg bg-card backdrop-blur border border-border shadow-xl w-[176px] flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Background</div>
            {/* Scope selector */}
            <div className="grid grid-cols-4 gap-1">
              {scopeBtn("cell", "Cell")}
              {scopeBtn("row", "Row")}
              {scopeBtn("col", "Col")}
              {scopeBtn("table", "Table")}
            </div>
            {/* Presets + transparent + color wheel */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {TABLE_PRESET_BGS.map((c) => (
                <button
                  key={c}
                  onClick={(e) => {
                    e.stopPropagation();
                    applyBg(c);
                  }}
                  className="w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform"
                  style={{ background: bgGradient ? tblToGradient(c) : c }}
                  title="Background color"
                />
              ))}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  applyBg("transparent");
                }}
                className={cn(
                  "w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform",
                  TBL_CHECKER,
                )}
                title="Transparent"
              />
              <label
                className="w-6 h-6 rounded border border-white/10 hover:scale-110 transition-transform cursor-pointer overflow-hidden relative"
                style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                title="Custom color"
              >
                <input
                  type="color"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => applyBg(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
            </div>
            {/* Solid / gradient toggle */}
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBgGradient(false);
                }}
                className={cn(
                  "flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                  !bgGradient
                    ? "bg-primary/30 text-primary ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-primary/15",
                )}
              >
                Solid
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBgGradient(true);
                }}
                className={cn(
                  "flex-1 px-2 py-1 rounded text-[11px] font-medium transition-colors",
                  bgGradient
                    ? "bg-primary/30 text-primary ring-1 ring-primary"
                    : "text-muted-foreground hover:bg-primary/15",
                )}
              >
                Gradient
              </button>
            </div>
            {/* ── Lines subsection — color wheel sits inline next to the label; the
                width presets get their own full-width row below. ── */}
            <div className="h-px bg-border/50" />
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Lines</div>
              <label
                className="w-6 h-6 shrink-0 rounded border border-white/10 hover:scale-110 transition-transform cursor-pointer overflow-hidden relative"
                style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                title="Line color"
              >
                <input
                  type="color"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => onUpdate({ lineColor: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
            </div>
            <div className="flex items-center gap-1">
              {TABLE_LINE_WIDTHS.map(({ label, w }) => (
                <button
                  key={label}
                  onClick={(e) => {
                    e.stopPropagation();
                    onUpdate({ lineWidth: w });
                  }}
                  className={cn(
                    "flex-1 px-1 py-1 rounded text-[10px] font-medium transition-colors",
                    lineWidth === w
                      ? "bg-primary/30 text-primary ring-1 ring-primary"
                      : "text-muted-foreground hover:bg-primary/15 hover:text-foreground",
                  )}
                  title={`${label} grid lines`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Text panel (color, bold/italic, align, header, font size) ── */}
          <div className="p-2 rounded-lg bg-card backdrop-blur border border-border shadow-xl w-[176px] flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Text</div>
            {/* Text color: white / black / wheel (operate on the selected cell) */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (sel) updateCell(sel.r, sel.c, { color: "#ffffff" });
                }}
                disabled={!sel}
                className="w-5 h-5 rounded-full border border-white/25 bg-white disabled:opacity-40 hover:scale-110 transition-transform"
                title="White text"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (sel) updateCell(sel.r, sel.c, { color: "#000000" });
                }}
                disabled={!sel}
                className="w-5 h-5 rounded-full border border-white/25 bg-black disabled:opacity-40 hover:scale-110 transition-transform"
                title="Black text"
              />
              <label
                className={cn(
                  "w-5 h-5 rounded-full border border-white/25 overflow-hidden relative",
                  sel ? "cursor-pointer hover:scale-110 transition-transform" : "opacity-40 pointer-events-none",
                )}
                style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}
                title="Custom text color"
              >
                <input
                  type="color"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    if (sel) updateCell(sel.r, sel.c, { color: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </label>
            </div>
            {/* Bold / italic · align L/C/R */}
            <div className="flex items-center gap-0.5">
              {fmtBtn(
                "bold",
                !!selCell?.bold,
                (e) => {
                  e.stopPropagation();
                  if (sel) updateCell(sel.r, sel.c, { bold: !selCell?.bold });
                },
                "Bold",
                <Bold className="w-3.5 h-3.5" />,
              )}
              {fmtBtn(
                "italic",
                !!selCell?.italic,
                (e) => {
                  e.stopPropagation();
                  if (sel) updateCell(sel.r, sel.c, { italic: !selCell?.italic });
                },
                "Italic",
                <Italic className="w-3.5 h-3.5" />,
              )}
              <div className="w-px h-4 bg-border/50 mx-0.5" />
              {(["left", "center", "right"] as const).map((a) => {
                const AlignIcon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
                return fmtBtn(
                  a,
                  selCell?.align === a,
                  (e) => {
                    e.stopPropagation();
                    if (sel) updateCell(sel.r, sel.c, { align: a });
                  },
                  `Align ${a}`,
                  <AlignIcon className="w-3.5 h-3.5" />,
                );
              })}
            </div>
            {/* Font size — Small / Medium / Large (applies across the current scope) */}
            <div className="grid grid-cols-3 gap-1">
              {TABLE_FONT_SIZES.map(({ key, label }) => {
                const active = (selCell?.fontSize || "md") === key;
                return (
                  <button
                    key={key}
                    onClick={(e) => {
                      e.stopPropagation();
                      applyCellScopePatch({ fontSize: key });
                    }}
                    disabled={scope !== "table" && !sel}
                    className={cn(
                      "px-1 py-1 rounded text-[11px] font-medium transition-colors disabled:opacity-40",
                      active
                        ? "bg-primary/30 text-primary ring-1 ring-primary"
                        : "text-muted-foreground hover:bg-primary/15 hover:text-foreground",
                    )}
                    title={`${label} text`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {/* Header row toggle */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onUpdate({ headerRow: !headerRow });
              }}
              className={cn(
                "px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap",
                headerRow
                  ? "bg-primary/30 text-primary ring-1 ring-primary"
                  : "text-muted-foreground hover:bg-primary/15 hover:text-foreground",
              )}
              title="Toggle header row"
            >
              Header
            </button>
          </div>
        </div>
      )}
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
  // Clicking the card's emoji opens the picker right there.
  const [showCardEmoji, setShowCardEmoji] = useState(false);
  useEffect(() => {
    if (!isSelected) setShowCardEmoji(false);
  }, [isSelected]);
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
      // Raw store (no trim) — see syncNoteFields for why trimming per-keystroke
      // broke space input and jumped the caret.
      const combined = noteBody.trim().length > 0 ? `${v}\n${noteBody}` : v;
      onUpdate({ noteTitle: v, noteBody, content: combined });
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
  // Stable { __html } object (see richHtmlProp in ShapeCard for why).
  const renderedNoteBody = useMemo(
    () => ({
      __html: DOMPurify.sanitize(
        noteBody
          .replace(/<p>\s*<\/p>/gi, "<p><br></p>")
          .replace(/>\s*\n+\s*</g, '><'),
        { USE_PROFILES: { html: true }, ADD_ATTR: ['target'] }
      ),
    }),
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
      // Store the title RAW (no trim) so a controlled <input> keeps trailing
      // spaces and the caret never jumps: trimming on every keystroke made
      // "abc " immediately re-render as "abc", dropping the space and sending
      // the caret to the end. Empty/whitespace titles fall back to a display
      // default ("Untitled Note") at render time.
      const combined = nextBody.trim().length > 0 ? `${nextTitle}\n${nextBody}` : nextTitle;
      onUpdate({
        noteTitle: nextTitle,
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
        minHeight: element.isDocument ? undefined : isNote ? "300px" : "100%",
      }}
    >
      {/* Task indicator - subtle corner badge */}
      {isActionable && !element.isDocument && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30 z-10"
          title="Actionable task"
        />
      )}
      {/* Emoji (click to change) - notes only; documents have theirs in the icon view */}
      {!element.isDocument && element.cardType !== "task" && (element.emoji || isSelected) && (
        <div className="relative z-10 w-full text-center py-[7px] leading-none">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center rounded-md transition-colors hover:bg-white/10 cursor-pointer",
              element.emoji ? "text-lg px-1.5 py-0.5" : "text-xs px-2 py-1 text-white/45 border border-dashed border-white/20",
            )}
            title="Change emoji"
            // No stopPropagation: the same click also selects the card (the picker
            // closes whenever the card is not selected).
            onClick={() => setShowCardEmoji((v) => !v)}
          >
            {element.emoji || "+ Emoji"}
          </button>
          {showCardEmoji && (
            <EmojiPicker anchored onEmojiSelect={(emoji) => onUpdate({ emoji } as Partial<FreeformElement>)} onClose={() => setShowCardEmoji(false)} />
          )}
        </div>
      )}
      {element.emoji && !element.isDocument && element.cardType === "task" && (
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
            <div className="text-4xl leading-none mb-1">{element.emoji || '📄'}</div>
            <div className="w-full px-1">
              <textarea
                rows={1}
                ref={(ta) => {
                  // Fit the title on mount too (not just on typing), so a
                  // one-line title doesn't reserve an empty second row.
                  if (ta) {
                    ta.style.height = 'auto';
                    ta.style.height = ta.scrollHeight + 'px';
                  }
                }}
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
                    onUpdate({ hideNoteTitle: !element.hideNoteTitle });
                  }}
                  className="rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white"
                  title={element.hideNoteTitle ? "Show note title" : "Hide note title"}
                  data-no-drag
                >
                  <Heading className={cn("h-3.5 w-3.5", element.hideNoteTitle && "opacity-40")} />
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
              {!element.hideNoteTitle && (
                <>
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
                </>
              )}
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
                      onUpdate({ hideNoteTitle: !element.hideNoteTitle });
                    }}
                    className="rounded bg-black/35 p-1 text-white/85 hover:bg-black/55 hover:text-white"
                    title={element.hideNoteTitle ? "Show note title" : "Hide note title"}
                    data-no-drag
                  >
                    <Heading className={cn("h-3.5 w-3.5", element.hideNoteTitle && "opacity-40")} />
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
                {!element.hideNoteTitle && (
                  <>
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
                  </>
                )}
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
                      dangerouslySetInnerHTML={renderedNoteBody}
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

/**
 * Storyboard caption: an editable textarea whose font-size auto-shrinks so the
 * text always fits the fixed caption strip (down to a floor, then it scrolls).
 * Starts large and steps down — so short captions read big and long ones shrink
 * to fit instead of overflowing onto the image.
 */
function StoryboardCaption({
  value,
  onChange,
  textStyle,
  readOnly,
  resizeKey,
}: {
  value: string;
  onChange: (v: string) => void;
  textStyle: React.CSSProperties;
  readOnly?: boolean;
  resizeKey: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const MAX = 16;
    const MIN = 9;
    let size = MAX;
    el.style.fontSize = `${size}px`;
    // Step down until the content fits the strip's height (or we hit the floor).
    while (size > MIN && el.scrollHeight > el.clientHeight + 1) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, []);
  useEffect(() => {
    fit();
  }, [value, resizeKey, fit]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        fit();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      placeholder="Add a caption…"
      readOnly={readOnly}
      data-no-drag
      className="w-full h-full resize-none bg-transparent leading-snug outline-none border-0 focus:ring-0 placeholder:text-white/30"
      style={textStyle}
    />
  );
}

// Image card component with upload
function ImageCard({
  element,
  onUpdate,
  isSelected,
  isReadOnly = false,
  onCropModeChange,
  canvasZoom = 1,
}: {
  element: ImageElement;
  onUpdate: (updates: Partial<ImageElement>) => void;
  isSelected: boolean;
  isReadOnly?: boolean;
  onCropModeChange?: (cropping: boolean) => void;
  canvasZoom?: number;
}) {
  // The image toolbar renders in the canvas overlay layer (above every element and
  // line) and at a constant on-screen size. Inside the element it was scaled with
  // the canvas (huge when zoomed in), painted under neighbours, and overlapped
  // whatever sat below the image.
  const overlayToolbar = (node: React.ReactNode, tone: "default" | "crop" = "default") => {
    const layer = typeof document !== "undefined" ? document.getElementById(CANVAS_OVERLAY_LAYER_ID) : null;
    const inner = (
      <div
        className={cn(
          "absolute left-1/2 flex items-center gap-0.5 px-1.5 py-1 rounded-xl pointer-events-auto",
          "bg-zinc-950/95 backdrop-blur-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
          tone === "crop" ? "border-cyan-500/50" : "border-violet-500/25",
        )}
        style={{
          top: "100%",
          marginTop: 12 / canvasZoom,
          transform: `translateX(-50%) scale(${1 / canvasZoom})`,
          transformOrigin: "top center",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {node}
      </div>
    );
    if (!layer) return inner;
    return createPortal(
      <div
        className="absolute pointer-events-none"
        style={{ left: element.x, top: element.y, width: element.width, height: element.height, zIndex: 2000000002 }}
      >
        {inner}
      </div>,
      layer,
    );
  };
  const [isUploading, setIsUploading] = useState(false);
  const [hasImage, setHasImage] = useState(!!element.src);
  const [isCropping, setIsCropping] = useState(false);
  // Storyboard reframe: drag the covered image to set its focal point.
  const [isRepositioning, setIsRepositioning] = useState(false);
  const [posPreview, setPosPreview] = useState<{ x: number; y: number } | null>(null);
  // Live preview while dragging the image/caption divider.
  const [captionRatioPreview, setCaptionRatioPreview] = useState<number | null>(null);
  const sbFrameRef = useRef<HTMLDivElement>(null);
  // Separate hidden input for "replace image" (the first-upload input only exists
  // in the empty state, which isn't rendered once the element has a src).
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Notify parent when crop mode changes so resize handles can hide
  useEffect(() => {
    onCropModeChange?.(isCropping);
  }, [isCropping, onCropModeChange]);
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
      // Animated formats (GIF, animated WebP) must be uploaded as-is —
      // re-encoding through a <canvas> strips every frame but the first.
      const isAnimated = file.type === "image/gif" || file.type === "image/webp";

      // Create image element to read dimensions
      const img = document.createElement("img");
      const objectUrl = URL.createObjectURL(file);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = objectUrl;
      });

      let width = img.width;
      let height = img.height;
      let blob: Blob;
      let ext: string;
      let contentType: string;

      if (isAnimated) {
        // Upload the original file unchanged so animation is preserved
        blob = file;
        ext = file.type === "image/gif" ? "gif" : "webp";
        contentType = file.type;
        URL.revokeObjectURL(objectUrl);
      } else {
        // Compress non-animated images through a canvas
        const maxWidth = 1600;
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

        blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), "image/webp", 0.8);
        });
        ext = "webp";
        contentType = "image/webp";
      }

      // Free-tier upload size cap (checked on the final bytes — images are
      // recompressed above, so most photos pass even on free)
      const uploadMaxBytes = useCXDStore.getState().uploadMaxBytes;
      if (uploadMaxBytes != null && blob.size > uploadMaxBytes) {
        setHasImage(false);
        alert(`This file is too large for the free plan (${(uploadMaxBytes / (1024 * 1024)).toFixed(0)} MB per file). Upgrade for larger uploads.`);
        return;
      }

      // Upload to Supabase Storage
      const supabase = createClient();
      const fileName = `canvas-images/${Date.now()}-${file.name.replace(/\.[^/.]+$/, "")}.${ext}`;

      const { data, error } = await supabase.storage
        .from("canvas-uploads")
        .upload(fileName, blob, {
          contentType,
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

      // A storyboard frame keeps whatever cell ratio the user set (the new image
      // just re-covers it); a plain image block adopts the new image's aspect ratio.
      const keepBox = !!element.storyboard;

      onUpdate({
        src: urlData.publicUrl,
        imageMeta: {
          width,
          height,
          bytes: blob.size,
          originalName: file.name,
        },
        ...(keepBox
          ? {}
          : { width: Math.round(elementWidth), height: Math.round(elementHeight) }),
        // Any crop/flip/reframe belonged to the PREVIOUS image — start clean.
        imageEdits: { crop: { x: 0, y: 0, width: 100, height: 100 }, flipH: false, flipV: false },
        storyboardObjectPosition: { x: 50, y: 50 },
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
    // Write an explicit neutral edits object rather than `undefined`: the Y.Doc
    // serializer skips undefined values, so `imageEdits: undefined` never cleared
    // the crop and the image kept rendering (and stretching) through the cropped
    // path. A full-crop, un-flipped object reads as "not cropped" everywhere.
    const neutralEdits = {
      crop: { x: 0, y: 0, width: 100, height: 100 },
      flipH: false,
      flipV: false,
    };
    if (preCrop) {
      // Restore original (pre-crop) element bounds so the image returns to its
      // natural aspect ratio, then object-contain renders it without stretching.
      onUpdate({
        x: preCrop.x,
        y: preCrop.y,
        width: preCrop.width,
        height: preCrop.height,
        imageEdits: neutralEdits,
      });
    } else {
      onUpdate({ imageEdits: neutralEdits });
    }
    setCropBox({ x: 0, y: 0, width: 100, height: 100 });
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
              <Upload className="w-3.5 h-3.5" />
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
  // Whether an actual crop is applied. Keyed off the crop RECT, not the presence
  // of preCropBounds: the Y.Doc serializer can't delete a nested field, so after
  // a reset preCropBounds lingers even though the crop is back to full — checking
  // the rect makes reset fall through to the aspect-preserving object-contain
  // render instead of the stretch-to-fill cropped-background render.
  const isCropped =
    crop.x !== 0 || crop.y !== 0 || crop.width !== 100 || crop.height !== 100;
  const hasEdits = isCropped || flipH || flipV;
  // Storyboard frame mode (persistent field so the element toolbar can offer a
  // colour editor for it). Defaults are soft — a thin light-grey border on a
  // near-black cell — and every colour/width is overridable via the toolbar.
  const isStoryboard = !!element.storyboard;
  const sbBorderColor = element.storyboardBorderColor || "#b8b8be";
  const sbBgColor = element.storyboardBgColor || "#0f0f12";
  const sbBorderWidth = element.storyboardBorderWidth ?? 3;
  const sbTextColor = element.storyboardTextColor || "#f4f4f5";
  const sbObjPos = posPreview || element.storyboardObjectPosition || { x: 50, y: 50 };
  const sbCaptionRatio = captionRatioPreview ?? element.storyboardCaptionRatio ?? 0.28;

  // Drag the divider between the image and the caption to resize the caption strip.
  const startCaptionResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const start = element.storyboardCaptionRatio ?? 0.28;
    const frameH = sbFrameRef.current?.getBoundingClientRect().height || element.height || 200;
    let latest = start;
    const move = (ev: MouseEvent) => {
      // Dragging the divider UP grows the caption.
      latest = Math.max(0.1, Math.min(0.65, start - (ev.clientY - startY) / frameH));
      setCaptionRatioPreview(latest);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      onUpdate({ storyboardCaptionRatio: latest });
      setCaptionRatioPreview(null);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // Drag the covered image to reposition its focal point (object-position).
  const startReposition = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const start = element.storyboardObjectPosition || { x: 50, y: 50 };
    const rect = imageContainerRef.current?.getBoundingClientRect();
    const w = rect?.width || 200;
    const h = rect?.height || 200;
    let latest = start;
    const move = (ev: MouseEvent) => {
      // Drag right → reveal the left of the image → object-position x decreases.
      const nx = Math.max(0, Math.min(100, start.x - ((ev.clientX - startX) / w) * 100));
      const ny = Math.max(0, Math.min(100, start.y - ((ev.clientY - startY) / h) * 100));
      latest = { x: nx, y: ny };
      setPosPreview(latest);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      onUpdate({ storyboardObjectPosition: latest });
      setPosPreview(null);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  };

  // Image is loaded - show clean media tile
  return (
    <div
      className="w-full h-full relative"
      data-crop-mode={isCropping ? "true" : undefined}
    >
      <div
        ref={sbFrameRef}
        className={cn("w-full h-full flex flex-col", isStoryboard && "rounded-md overflow-hidden shadow-xl")}
        style={
          isStoryboard
            ? { border: `${sbBorderWidth}px solid ${sbBorderColor}`, background: sbBgColor }
            : undefined
        }
      >
      <div
        ref={imageContainerRef}
        className={cn(
          "transition-all relative",
          // No inner rounding inside a storyboard frame — the frame already rounds,
          // and a rounded inner box clipped the reframe highlight's corners.
          isStoryboard ? "flex-1 min-h-0" : "w-full h-full rounded-lg",
          // Only clip image content, not the crop overlay handles
          !isCropping && "overflow-hidden",
          isSelected ? "ring-0" : "",
          isCropping && "ring-2 ring-cyan-400",
        )}
      >
        {isCropped && isStoryboard ? (
          (() => {
            // Storyboard + crop: show the cropped region COVERING the (freely
            // resized) image area, and keep drag-to-reframe working. Pure CSS so
            // nothing needs measuring: an aspect-locked "crop viewport" sized with
            // min-width/height:100% always covers the box, positioned by the
            // object-position percentages (the standard object-position emulation),
            // with the full image scaled inside it so the crop region exactly fills.
            const nw = element.imageMeta?.width || 1;
            const nh = element.imageMeta?.height || 1;
            const cw = Math.max(0.01, crop.width);
            const ch = Math.max(0.01, crop.height);
            const cropAspect = (cw * nw) / (ch * nh);
            return (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  style={{
                    position: "absolute",
                    aspectRatio: String(cropAspect),
                    minWidth: "100%",
                    minHeight: "100%",
                    left: `${sbObjPos.x}%`,
                    top: `${sbObjPos.y}%`,
                    transform: `translate(-${sbObjPos.x}%, -${sbObjPos.y}%)`,
                    overflow: "hidden",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={element.src}
                    alt={element.alt || ""}
                    style={{
                      position: "absolute",
                      width: `${(100 / cw) * 100}%`,
                      height: `${(100 / ch) * 100}%`,
                      left: `${-(crop.x / cw) * 100}%`,
                      top: `${-(crop.y / ch) * 100}%`,
                      maxWidth: "none",
                      transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                    }}
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    onError={() => setHasImage(false)}
                  />
                </div>
              </div>
            );
          })()
        ) : isCropped ? (
          (() => {
            // Scale the background so the cropped region (crop.width% x crop.height%
            // of the original image) always fills the current element. This lets
            // the image scale with resize handles instead of revealing cropped-out
            // content when the element grows.
            const safeCropW = crop.width > 0 ? crop.width : 100;
            const safeCropH = crop.height > 0 ? crop.height : 100;
            const scaledImgW = (element.width * 100) / safeCropW;
            const scaledImgH = (element.height * 100) / safeCropH;
            return (
              <div
                className="w-full h-full"
                style={{
                  backgroundImage: `url("${element.src}")`,
                  backgroundSize: `${scaledImgW}px ${scaledImgH}px`,
                  backgroundPosition: `${-(crop.x / 100) * scaledImgW}px ${-(crop.y / 100) * scaledImgH}px`,
                  backgroundRepeat: "no-repeat",
                  transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                }}
              />
            );
          })()
        ) : (
          <div
            className="w-full h-full relative"
            style={{
              clipPath: `inset(${crop.y}% ${100 - crop.x - crop.width}% ${100 - crop.y - crop.height}% ${crop.x}%)`,
            }}
          >
            {/* Plain <img> keeps the same DOM node across parent re-renders,
                so animated GIFs / WebPs don't restart their loop on canvas
                mouse-move / zoom / selection updates. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={element.src}
              alt={element.alt || ""}
              // Storyboard frames COVER their image area (fill + crop) so the
              // border hugs the image with no letterbox and the ratio is free;
              // plain images stay object-contain (never cropped by the box).
              className={cn("absolute inset-0 w-full h-full", isStoryboard ? "object-cover" : "object-contain")}
              style={{
                objectFit: isStoryboard ? "cover" : "contain",
                objectPosition: isStoryboard ? `${sbObjPos.x}% ${sbObjPos.y}%` : undefined,
                transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
              }}
              onError={() => setHasImage(false)}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          </div>
        )}

        {/* Storyboard reframe overlay — drag to set the image's focal point */}
        {isStoryboard && isRepositioning && isSelected && !isCropping && (
          <div
            className="absolute inset-0 z-20 cursor-move"
            data-no-drag
            onMouseDown={startReposition}
            title="Drag to reposition the image"
          >
            {/* Inset a couple of px so the frame's rounded corners don't clip the
                highlight and leave it looking notched. */}
            <div className="absolute inset-[2px] rounded-[2px] border-2 border-cyan-400/80 pointer-events-none" />
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/60 text-[10px] text-cyan-200 pointer-events-none whitespace-nowrap">
              Drag to reframe
            </div>
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
      {/* Storyboard caption strip — sits BELOW the image (never over it); text
          auto-shrinks to fit when long. */}
      {isStoryboard && (
        <div
          className="shrink-0 relative px-2 py-1.5"
          style={{
            height: `${sbCaptionRatio * 100}%`,
            minHeight: 28,
            borderTop: `${sbBorderWidth}px solid ${sbBorderColor}`,
            background: sbBgColor,
          }}
        >
          {/* Drag the divider to resize the caption strip */}
          {!isReadOnly && (
            <div
              data-no-drag
              onMouseDown={startCaptionResize}
              className="absolute left-0 right-0 z-30 cursor-ns-resize group/cd"
              style={{ top: -(sbBorderWidth + 3), height: sbBorderWidth + 6 }}
              title="Drag to resize the caption"
            >
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-0.5 w-8 rounded-full bg-cyan-400/0 group-hover/cd:bg-cyan-400/80 transition-colors" />
            </div>
          )}
          <StoryboardCaption
            // Remount on colour change: a textarea won't re-clip its background to
            // the text when the background is swapped in place (it repaints as a
            // solid block), so we give it a fresh element per colour.
            key={sbTextColor}
            value={element.description || ""}
            onChange={(v) => onUpdate({ description: v })}
            textStyle={
              sbTextColor.includes("gradient")
                ? {
                    background: sbTextColor,
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    caretColor: "#ffffff",
                  }
                : {
                    // Fully specified so React clears any prior gradient/clip.
                    background: "none",
                    WebkitBackgroundClip: "border-box",
                    backgroundClip: "border-box",
                    color: sbTextColor,
                    caretColor: sbTextColor,
                  }
            }
            readOnly={isReadOnly}
            resizeKey={`${element.width}x${element.height}`}
          />
        </div>
      )}
      </div>
      {/* Image edit toolbar — single icon-only pill below the image.
          Positioned at -bottom-16 to clear the rotation handle (~ -39px stem). */}
      {isSelected && !isCropping && !isReadOnly && overlayToolbar(
        <>
          {/* Replace the image file (storyboard keeps its cell ratio; a plain
              image block re-fits to the new image's aspect ratio). */}
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => replaceInputRef.current?.click()}
            className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Replace image"
            disabled={isUploading}
          >
            {isUploading ? (
              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
          </button>
          <div className="w-px h-4 bg-border mx-0.5" />
          <button
            onClick={() => {
              setIsCropping(true);
              setCropBox(
                element.imageEdits?.preCropBounds
                  ? { x: 0, y: 0, width: 100, height: 100 }
                  : crop,
              );
            }}
            className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
            title="Crop"
          >
            <Crop className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFlipH}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              flipH
                ? "bg-primary/20 text-primary"
                : "hover:bg-primary/20 text-muted-foreground hover:text-primary",
            )}
            title="Flip horizontal"
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleFlipV}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              flipV
                ? "bg-primary/20 text-primary"
                : "hover:bg-primary/20 text-muted-foreground hover:text-primary",
            )}
            title="Flip vertical"
          >
            <FlipVertical className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              if (element.storyboard) {
                // Turning the frame OFF: the box currently holds the storyboard's
                // free-form ratio, so restore the image's own proportions (honouring
                // any crop) instead of leaving the element mis-shaped.
                const nw = element.imageMeta?.width;
                const nh = element.imageMeta?.height;
                if (nw && nh) {
                  const cw = Math.max(0.01, crop.width);
                  const ch = Math.max(0.01, crop.height);
                  const aspect = (cw * nw) / (ch * nh);
                  onUpdate({
                    storyboard: false,
                    height: Math.max(20, Math.round(element.width / aspect)),
                  });
                  return;
                }
              }
              onUpdate({ storyboard: !element.storyboard });
            }}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              isStoryboard
                ? "bg-primary/20 text-primary"
                : "hover:bg-primary/20 text-muted-foreground hover:text-primary",
            )}
            title={isStoryboard ? "Remove caption frame" : "Add caption (storyboard)"}
          >
            <Captions className="w-3.5 h-3.5" />
          </button>
          {isStoryboard && (
            <button
              onClick={() => setIsRepositioning((v) => !v)}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                isRepositioning
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "hover:bg-primary/20 text-muted-foreground hover:text-primary",
              )}
              title={isRepositioning ? "Done repositioning" : "Reposition image (drag focal point)"}
            >
              <Move className="w-3.5 h-3.5" />
            </button>
          )}
          {hasEdits && (
            <>
              <div className="w-px h-4 bg-border mx-0.5" />
              <button
                onClick={resetImage}
                className="p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors"
                title="Reset image"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </>,
      )}
      {/* Crop controls */}
      {isCropping && overlayToolbar(
        <>
          <button
            onClick={applyCrop}
            title="Apply crop"
            className="p-1.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors flex items-center justify-center"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={cancelCrop}
            title="Cancel"
            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </>,
        "crop",
      )}
    </div>
  );
}

// Shape card component with editable text
function ShapeCard({
  element,
  onUpdate,
  isEditing,
  typedChar,
  onBlur,
  isSelected,
  onCreateConnectedShape,
}: {
  element: ShapeElement;
  onUpdate: (updates: Partial<ShapeElement>) => void;
  isEditing: boolean;
  typedChar?: string | null;
  onBlur: (e?: React.FocusEvent) => void;
  isSelected?: boolean;
  onCreateConnectedShape?: (direction: "top" | "right" | "bottom" | "left") => void;
}) {
  // Unstyled shapes fall back to the default preset (gradient fill + ring).
  const bgColor = element.style?.bgColor || DEFAULT_SHAPE_STYLE.bgColor!;
  const borderColor = element.style?.borderColor || DEFAULT_SHAPE_STYLE.borderColor!;
  const borderWidth = element.style?.borderWidth ?? DEFAULT_SHAPE_STYLE.borderWidth!;
  const textColor = element.style?.textColor || DEFAULT_SHAPE_STYLE.textColor!;
  const fillOpacity =
    element.style?.fillOpacity !== undefined
      ? element.style.fillOpacity
      : element.style?.bgColor
        ? 100
        : DEFAULT_SHAPE_STYLE.fillOpacity!;

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

    // Drawn at the element's real pixel size (no stretched viewBox), inset by
    // half the stroke so it isn't clipped.
    const w = Math.max(1, element.width || 100);
    const h = Math.max(1, element.height || 100);
    const { d, detail } = shapePath(element.shapeType, w, h, Math.max(1, strokeWidth / 2));
    return (
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="absolute inset-0"
        style={{ overflow: "visible" }}
      >
        {gradientDefs}
        <path
          d={d}
          fill={fill}
          fillOpacity={opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
        {detail && (
          <path d={detail} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" />
        )}
      </svg>
    );
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

  const baseFontSize = element.style?.fontSize || 14;
  const textInsets = shapeTextInsets(element.shapeType);
  // The { __html } OBJECT must be referentially stable: with the React bundled in
  // Next 14 a new object each render makes React reset innerHTML, which replaces
  // the text node under the pointer between mousedown and mouseup, so the browser
  // never fires click/dblclick and the shape can't be re-entered.
  const richHtmlProp = useMemo(
    () => ({ __html: element.richContent ? DOMPurify.sanitize(element.richContent, { USE_PROFILES: { html: true } }) : "" }),
    [element.richContent],
  );

  // Common text styles (shared between editing and display)
  const baseTextStyle: React.CSSProperties = {
    fontSize: baseFontSize,
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
        className={cn("absolute inset-0 z-10", isEditing ? "overflow-visible" : "overflow-hidden")}
        style={{
          padding: `${textInsets[0] * 100}% ${textInsets[1] * 100}% ${textInsets[2] * 100}% ${textInsets[3] * 100}%`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: shapeTextAlign,
        }}
      >
        {isEditing ? (
          <ShapeRichTextEditor
            html={element.richContent || plainTextToHtml(element.content || "")}
            replaceWithChar={typedChar}
            shapeStyle={element.style}
            onShapeStyleChange={(updates) => onUpdate({ style: { ...element.style, ...updates } })}
            baseFontSize={baseFontSize}
            textStyle={{ ...baseTextStyle, ...textColorStyle }}
            onChange={(html, plain) => onUpdate({ richContent: html, content: plain })}
            onBlur={() => onBlur()}
          />
        ) : element.richContent ? (
          <div
            key={isGradientText ? textColor : 'solid'}
            className="shape-rich-display w-full [&_p]:m-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            style={{
              ...baseTextStyle,
              ...textColorStyle,
              display: isGradientText ? 'inline-block' : 'block',
              maxWidth: '100%',
              maxHeight: '100%',
              overflow: 'hidden',
            }}
            dangerouslySetInnerHTML={richHtmlProp}
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
      {/* ── Header bar ── hidden when the user hides the name for a clean,
          unlabeled container (kept while collapsed so it can still be expanded). */}
      {(!element.hideLabel || element.collapsed) && (
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
      )}

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
// Inner padding of a text element's box, per side. Kept small so the selection
// box hugs the glyphs (was 8px, which made small text float in a big frame).
const TEXT_PAD = 4;
const TEXT_LINE_HEIGHT = 1.3;

function TextCard({
  element,
  onUpdate,
  isEditing,
  isSelected = false,
  onBlur,
}: {
  element: TextElement;
  onUpdate: (updates: Partial<TextElement>) => void;
  isEditing: boolean;
  isSelected?: boolean;
  onBlur: (e?: React.FocusEvent) => void;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  // Auto-width text hugs its content (no wrapping except explicit line breaks);
  // fixed-width text wraps at element.width. Height always follows the content.
  const autoWidth = !!element.autoWidth;

  // Click outside to exit edit mode
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

  // Focus with the caret at the end when editing starts
  useEffect(() => {
    if (isEditing && typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          const length = ta.value.length;
          ta.setSelectionRange(length, length);
        }
      });
    }
  }, [isEditing]);

  // Size the box to the text. A hidden mirror renders the same text with the
  // same font; its size (plus padding) becomes the element's size. Runs on
  // every input that affects layout — including font size, which the old
  // version ignored, so shrinking text left a tall empty box.
  const shownText = isEditing ? localContent : element.content || "";
  const sizeRef = useRef({ w: element.width, h: element.height });
  sizeRef.current = { w: element.width, h: element.height };
  // Re-measure once web fonts finish loading (first paint may use a fallback).
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => alive && setFontsReady((n) => n + 1)).catch(() => {});
    return () => { alive = false; };
  }, []);
  // The textarea is sized from this LOCAL measurement, not from element.width/
  // height: those arrive a frame (or more) later through the store, and a
  // textarea that is briefly too small scrolls itself, which showed up as the
  // text box jumping up and down while typing.
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    const m = measureRef.current;
    if (!m) return;
    const rect = m.getBoundingClientRect();
    // getBoundingClientRect is in screen px (canvas is scaled); offset* are layout px.
    const mw = m.offsetWidth || rect.width;
    const mh = m.offsetHeight || rect.height;
    const minLine = Math.ceil(fontSize * TEXT_LINE_HEIGHT);
    const nextH = Math.max(minLine, Math.ceil(mh)) + TEXT_PAD * 2;
    const nextW = autoWidth
      ? Math.max(Math.ceil(fontSize * 0.6), Math.ceil(mw) + 2) + TEXT_PAD * 2
      : sizeRef.current.w;
    setMeasured((prev) => (prev && prev.w === nextW && prev.h === nextH ? prev : { w: nextW, h: nextH }));
    // Only the client working on this text writes its measured size. Two
    // clients measuring slightly differently (fonts, subpixels) would
    // otherwise keep overwriting each other's width.
    if (!isEditing && !isSelected) return;
    const updates: Partial<TextElement> = {};
    if (Math.abs(sizeRef.current.h - nextH) >= 1) updates.height = nextH;
    if (autoWidth && Math.abs(sizeRef.current.w - nextW) >= 1) updates.width = nextW;
    if (updates.width !== undefined || updates.height !== undefined) onUpdate(updates);
  }, [shownText, fontSize, fontWeight, fontFamily, autoWidth, element.width, onUpdate, isEditing, isSelected, fontsReady]);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.scrollTop = 0;
      ta.scrollLeft = 0;
    }
  }, [measured, isEditing]);

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent ALL canvas shortcuts from triggering while editing
    e.stopPropagation();
    // Escape exits edit mode WITHOUT reverting changes
    if (e.key === "Escape") {
      e.preventDefault();
      onBlur();
    }
  };

  // CRITICAL: Apply gradient directly to text span, not container
  const hasGradient = gradient?.startsWith("linear-gradient");

  // Check if this text is actionable
  const isActionable =
    element.taskMetadata?.isActionable ||
    element.content?.includes("[ ]") ||
    element.content?.includes("[x]") ||
    (element.hypercubeTags && element.hypercubeTags.length > 0);

  const textStyle: React.CSSProperties = {
    fontSize,
    fontWeight,
    fontFamily,
    textAlign,
    lineHeight: TEXT_LINE_HEIGHT,
    whiteSpace: autoWidth ? "pre" : "pre-wrap",
    wordBreak: autoWidth ? "normal" : "break-word",
    overflowWrap: autoWidth ? "normal" : "break-word",
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ padding: TEXT_PAD, overflow: "visible" }}
    >
      {/* Task indicator */}
      {isActionable && (
        <div
          className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-purple-400 ring-2 ring-purple-400/30 z-20"
          title="Actionable task"
        />
      )}
      {/* Hidden mirror used to size the box (trailing newline needs a glyph) */}
      <div
        ref={measureRef}
        aria-hidden
        className="absolute left-0 top-0 opacity-0 pointer-events-none"
        style={{
          ...textStyle,
          width: autoWidth ? "max-content" : Math.max(1, element.width - TEXT_PAD * 2),
        }}
      >
        {(shownText || " ") + (shownText.endsWith("\n") ? "\u200b" : "")}
      </div>
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          onBlur={onLocalBlur}
          onKeyDown={handleKeyDown}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          autoFocus
          wrap={autoWidth ? "off" : "soft"}
          className="block resize-none border-0 bg-transparent p-0 m-0 focus:outline-none overflow-hidden"
          style={{
            ...textStyle,
            color: textColor,
            caretColor: textColor.startsWith("#") ? textColor : "#ffffff",
            width: autoWidth && measured ? measured.w - TEXT_PAD * 2 : "100%",
            height: measured ? measured.h - TEXT_PAD * 2 : "100%",
          }}
          placeholder="Type text..."
          data-no-drag
        />
      ) : (
        <div className="w-full" style={textStyle}>
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
            <span className="text-muted-foreground" style={{ fontSize: Math.min(fontSize, 14) }}>
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
  isDragging = false,
}: {
  element: LinkElement;
  onUpdate: (updates: Partial<LinkElement>) => void;
  isSelected: boolean;
  isReadOnly?: boolean;
  isDragging?: boolean;
}) {
  // Local draft state to prevent element from disappearing during edits
  const [draftUrl, setDraftUrl] = useState(element.url || "");
  const [isEditing, setIsEditing] = useState(
    !element.url && element.linkMode !== "file",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  // Embed interaction gate: the iframe is inert (pointer-events:none) until the user
  // explicitly activates it. This keeps the whole surface draggable/selectable like every
  // other element, and lets outside clicks fall through to the canvas so the element
  // deselects normally. Interaction auto-deactivates the moment the element is deselected.
  const [isActive, setIsActive] = useState(false);
  useEffect(() => {
    if (!isSelected && isActive) setIsActive(false);
  }, [isSelected, isActive]);
  // Pointer-down position for the embed activation overlay, so a click-AND-drag
  // (drag-to-move from the body) never gets mistaken for a click-to-interact.
  const activatePointerDown = useRef<{ x: number; y: number } | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Bookmark preview (og:image) load failure — falls back to favicon/placeholder.
  // Reset whenever the thumbnail URL changes so a re-fetch gets a fresh attempt.
  const [thumbError, setThumbError] = useState(false);
  useEffect(() => {
    setThumbError(false);
  }, [element.thumbnail]);

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
    // Free-tier upload size cap — raw files upload uncompressed
    const uploadMaxBytes = useCXDStore.getState().uploadMaxBytes;
    if (uploadMaxBytes != null && file.size > uploadMaxBytes) {
      setUrlError(`Files over ${(uploadMaxBytes / (1024 * 1024)).toFixed(0)} MB need a Pro plan`);
      return;
    }

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
        // A wide bookmark-bar box squeezes the file card's icon: square it up.
        ...(element.width / Math.max(1, element.height) > 1.6 && (element.fileViewMode || "bookmark") === "bookmark"
          ? { width: 200, height: 200 }
          : {}),
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
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
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
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
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
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
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
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
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
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
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

  // Bookmark mode — slim, responsive card. Two layouts driven by the element's
  // aspect ratio (recomputed every render, so it switches live while resizing):
  //   • wide/thin  (width/height > 1.2) → image LEFT, info RIGHT, actions on the far right
  //   • square/portrait (else)          → image on TOP, info + actions stacked below
  // The default link size (360×120 = 3.0) lands in the wide layout, so a freshly
  // pasted bookmark renders as the slim horizontal row.
  if (element.linkMode === "bookmark" || !element.linkMode) {
    const isWide = element.height > 0 && element.width / element.height > 1.2;
    const showThumb = !!element.thumbnail && !thumbError;
    const linkTitle = element.title || element.domain || "Link";

    // og:image preview with graceful fallback: broken/absent image → favicon → globe.
    const imageArea = showThumb ? (
      <NextImage
        src={element.thumbnail!}
        alt=""
        fill
        className="object-cover"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onError={() => setThumbError(true)}
        unoptimized
      />
    ) : element.favicon ? (
      <div className="w-full h-full flex items-center justify-center">
        <NextImage
          src={element.favicon}
          alt=""
          width={36}
          height={36}
          className="w-9 h-9 opacity-80"
          draggable={false}
          unoptimized
        />
      </div>
    ) : (
      <div className="w-full h-full flex items-center justify-center">
        <Globe className="w-10 h-10 text-muted-foreground/30" />
      </div>
    );

    const faviconEl = element.favicon ? (
      <NextImage
        src={element.favicon}
        alt=""
        width={16}
        height={16}
        className="w-4 h-4 flex-shrink-0"
        draggable={false}
        unoptimized
      />
    ) : (
      <Globe className="w-4 h-4 text-muted-foreground/60 flex-shrink-0" />
    );

    const titleLink = (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug"
        data-no-drag
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
      >
        {linkTitle}
      </a>
    );

    const domainRow = (
      <div className="flex items-center gap-1.5 min-w-0">
        {faviconEl}
        <span className="text-xs text-muted-foreground/80 truncate">
          {element.domain}
        </span>
      </div>
    );

    const openLink = (
      <a
        href={element.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 w-6 h-6 rounded hover:bg-primary/10 flex items-center justify-center transition-colors"
        data-no-drag
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        title="Open in new tab"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
      </a>
    );

    // Edit-URL as a small circular icon button (opens the existing URL editor +
    // re-fetch flow). Only discoverable when the element is selected and editable.
    const editButton =
      isSelected && !isReadOnly ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsEditing(true);
          }}
          className="flex-shrink-0 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          data-no-drag
          title="Edit URL"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      ) : null;

    // WIDE / thin rectangle → image left, info right, actions far right.
    if (isWide) {
      return (
        <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex items-stretch">
          <div className="relative w-2/5 max-w-[180px] min-w-[64px] flex-shrink-0 bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
            {imageArea}
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-1 px-3 py-2">
            {titleLink}
            {domainRow}
          </div>
          <div className="flex-shrink-0 flex flex-col items-center justify-center gap-2 pr-2 pl-1">
            {openLink}
            {editButton}
          </div>
        </div>
      );
    }

    // SQUARE / portrait → image on top, info + edit control stacked below.
    return (
      <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
        <div className="flex-1 min-h-0 bg-gradient-to-br from-muted/30 to-muted/10 relative overflow-hidden">
          {imageArea}
        </div>
        <div className="p-3 space-y-1.5 bg-card/50 border-t border-border/50">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">{titleLink}</div>
            {openLink}
          </div>
          {element.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {element.description}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            {domainRow}
            {editButton}
          </div>
        </div>
      </div>
    );
  }

  // Embed mode — window-like chrome. A live iframe swallows every pointer event, so by
  // default we keep it inert and drive selection/drag through the element chrome; the user
  // opts into interaction explicitly (click-to-select, click-again-to-interact).
  return (
    <div className="w-full h-full rounded-lg border border-border bg-card/80 backdrop-blur overflow-hidden flex flex-col">
      {/* Persistent slim title bar — always a drag handle + identity + actions */}
      <div className="px-2.5 py-1.5 bg-card/90 border-b border-border/50 flex items-center gap-2 flex-shrink-0 cursor-grab active:cursor-grabbing select-none">
        <GripVertical className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
        {element.favicon ? (
          <NextImage
            src={element.favicon}
            alt=""
            width={16}
            height={16}
            className="w-4 h-4 flex-shrink-0"
            draggable={false}
            unoptimized
          />
        ) : (
          <Globe className="w-4 h-4 text-muted-foreground/70 flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground truncate flex-1">
          {element.domain || element.url}
        </span>
        {isActive && !isReadOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsActive(false);
            }}
            className="text-[10px] uppercase tracking-wide text-primary/90 hover:text-primary transition-colors px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 flex-shrink-0"
            data-no-drag
            title="Stop interacting"
          >
            Done
          </button>
        )}
        <a
          href={element.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors flex-shrink-0"
          data-no-drag
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
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
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            >
              Open in new tab <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        ) : (
          <>
            <iframe
              src={element.url}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms"
              onError={() => setEmbedError(true)}
              style={{ pointerEvents: isActive ? "auto" : "none" }}
              data-no-drag
            />
            {/* Inactive: transparent overlay keeps the whole surface draggable and offers
                activation. First click selects (bubbles to the wrapper); a second click while
                selected activates interaction. Not a drag-exempt target, so drag-to-move works. */}
            {!isActive && (
              <div
                className="absolute inset-0 flex items-center justify-center"
                onMouseDown={(e) => {
                  // Record where the press began; let it bubble so the element still drags.
                  activatePointerDown.current = { x: e.clientX, y: e.clientY };
                }}
                onClick={(e) => {
                  if (!isSelected || isReadOnly) return; // 1st click selects (let it bubble)
                  const start = activatePointerDown.current;
                  activatePointerDown.current = null;
                  // Suppress activation if the pointer moved — that was a drag-to-move,
                  // not a click-to-interact (mirrors the 5px click/drag threshold used
                  // elsewhere in the canvas).
                  const moved = start
                    ? Math.sqrt(
                        (e.clientX - start.x) ** 2 + (e.clientY - start.y) ** 2,
                      )
                    : 0;
                  if (moved > 5) return;
                  e.stopPropagation();
                  setIsActive(true);
                }}
              >
                {isSelected && !isReadOnly && (
                  <div className="pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/55 backdrop-blur-sm text-[11px] font-medium text-white/90 border border-white/15 shadow-lg">
                    <MousePointerClick className="w-3.5 h-3.5" />
                    Click to interact
                  </div>
                )}
              </div>
            )}
            {/* Drag trap: an active iframe eats mousemove mid-drag, so shield it while any
                drag is in progress so the canvas' document-level move listeners keep firing. */}
            {isActive && isDragging && (
              <div className="absolute inset-0 z-30" />
            )}
          </>
        )}
      </div>
      {/* Edit button - only shown when selected */}
      {isSelected && !isReadOnly && (
        <div className="px-3 py-1.5 border-t border-border bg-card/80 flex-shrink-0">
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

  // Count elements in this board using Zustand store.
  // Return a NUMBER from the selector (not the array) so Zustand's Object.is
  // comparison is stable. Selecting `... || []` yields a fresh [] on every call
  // when no project is loaded in the store (e.g. the read-only share view,
  // which renders from a prop, not the store), which drives React into an
  // infinite re-render loop — Minified React error #185. Mirrors the container
  // card's childCount selector above.
  const elementCount = useCXDStore(
    (state) =>
      (state.getCurrentProject()?.canvasLayout?.elements ?? []).filter(
        (el) =>
          el.boardId === element.childBoardId &&
          el.type !== "line" &&
          el.type !== "connector",
      ).length,
  );

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

  // Grows a textarea to fit its content instead of clipping/scrolling
  // internally. Called on mount (ref) and on every keystroke (onChange) so
  // both user typing and pre-filled content (e.g. from the framing
  // generator) size correctly. Idempotent — safe to call on every render.
  const autoGrowTextarea = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

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
                  onChange={(e) => { setLiMainConcept(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiCoreMessage(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiInsights(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiFeelings(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiStates(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiKnowledge(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[60px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiAudienceNeeds(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiAudienceDesires(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiWorld(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiStory(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                  onChange={(e) => { setLiMagic(e.target.value); autoGrowTextarea(e.target); }}
                  className="bg-secondary/50 border-border/50 text-white min-h-[80px] resize-none overflow-hidden"
                  data-no-drag
                  ref={autoGrowTextarea}
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
                      onChange={(e) => {
                        updateStateMapping(quadrant as any, e.target.value);
                        autoGrowTextarea(e.target);
                      }}
                      className="bg-secondary/50 border-border/50 text-white min-h-[60px] text-xs resize-none overflow-hidden"
                      data-no-drag
                      ref={autoGrowTextarea}
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
                    onChange={(e) => {
                      updateTraitMapping(quadrant, e.target.value);
                      autoGrowTextarea(e.target);
                    }}
                    className="bg-secondary/50 border-border/50 text-white min-h-[60px] text-xs resize-none overflow-hidden"
                    data-no-drag
                    ref={autoGrowTextarea}
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
