// Canvas element types for the spatial moodboard

export type CanvasElementType =
  | 'freeform'
  | 'image'
  | 'shape'
  | 'container'
  | 'connector'
  | 'line'
  | 'text'
  | 'link'
  | 'board'
  | 'experienceBlock'
  | 'table';

// Shape types available in the shape palette
export type ShapeType = 'rectangle' | 'circle' | 'diamond' | 'triangle' | 'hexagon' | 'star';

// Preset colors for cards and shapes (dark cyberdelic gradients)
export const PRESET_COLORS = [
  'linear-gradient(135deg, #2A0A3D 0%, #4B1B6B 50%, #0B2C5A 100%)', // Deep purple-blue
  'linear-gradient(135deg, #0B1B2B 0%, #123A5A 100%)', // Dark blue
  'linear-gradient(135deg, #24113D 0%, #3D1E66 100%)', // Rich purple
  'linear-gradient(135deg, #11202D 0%, #1E3E4D 100%)', // Teal-gray
  'linear-gradient(135deg, #1A1230 0%, #2B1C52 100%)', // Deep violet
  'linear-gradient(135deg, #0F2230 0%, #0F3A3A 100%)', // Emerald-teal
  'linear-gradient(135deg, #2B0F2A 0%, #3B1842 100%)', // Magenta-purple
  'linear-gradient(135deg, #14101F 0%, #2A1A3A 100%)', // Dark plum
  'linear-gradient(135deg, #0F1420 0%, #1B2A44 100%)', // Midnight blue
  'linear-gradient(135deg, #1B1024 0%, #351A45 100%)', // Royal purple
  'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)', // Charcoal
  'transparent', // Clear
] as const;

// Solid colors for shape outlines (aligned with gradient midtones)
export const SOLID_STROKE_COLORS = [
  '#4B1B6B', // Purple
  '#123A5A', // Blue
  '#3D1E66', // Rich purple
  '#1E3E4D', // Teal
  '#2B1C52', // Violet
  '#0F3A3A', // Emerald
  '#3B1842', // Magenta
  '#2A1A3A', // Plum
  '#1B2A44', // Midnight
  '#351A45', // Royal purple
  '#2d2d2d', // Charcoal
  '#ffffff', // White
] as const;

// Text gradients for text elements
export const TEXT_GRADIENTS = [
  'linear-gradient(90deg, #6D28D9, #22D3EE)', // Purple to cyan
  'linear-gradient(90deg, #A855F7, #34D399)', // Purple to green
  'linear-gradient(90deg, #F472B6, #60A5FA)', // Pink to blue
  'linear-gradient(90deg, #22D3EE, #A78BFA)', // Cyan to lavender
  'linear-gradient(90deg, #C084FC, #F472B6)', // Violet to pink
  'linear-gradient(90deg, #60A5FA, #34D399)', // Blue to green
  'linear-gradient(90deg, #A78BFA, #22D3EE, #F472B6)', // Lavender-cyan-pink
  'linear-gradient(90deg, #34D399, #22D3EE)', // Green to cyan
  'linear-gradient(90deg, #F59E0B, #EF4444)', // Amber to red
  'linear-gradient(90deg, #8B5CF6, #EC4899, #F59E0B)', // Purple-pink-amber
  'linear-gradient(90deg, #10B981, #6366F1)', // Emerald to indigo
  'linear-gradient(90deg, #F97316, #C084FC)', // Orange to violet
] as const;

// Font families for text elements
export const FONT_FAMILIES = [
  { value: 'inherit', label: 'Default' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'ui-monospace, monospace', label: 'Mono' },
  // Creative/Display
  { value: "'Space Grotesk', sans-serif", label: 'Space Grotesk' },
  { value: "'Syne', sans-serif", label: 'Syne' },
  { value: "'Unbounded', sans-serif", label: 'Unbounded' },
  // Professional/Versatile
  { value: "'Playfair Display', serif", label: 'Playfair' },
  { value: "'Raleway', sans-serif", label: 'Raleway' },
  { value: "'Outfit', sans-serif", label: 'Outfit' },
] as const;

// Style properties shared across elements
export interface ElementStyle {
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold' | '300';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline';
  textAlign?: 'left' | 'center' | 'right';
  fillOpacity?: number; // 0-100 for shapes
}

// Surface types for separating canvas vs hypercube nodes
export type SurfaceType = 'canvas' | 'hypercube';

// Hypercube face tags for semantic tagging
export type HypercubeFaceTag =
  | 'Reality Planes'
  | 'Sensory Domains'
  | 'Presence Types'
  | 'State Mapping'
  | 'Trait Mapping'
  | 'Meaning Architecture'
  | 'Core';

export const HYPERCUBE_FACE_TAGS: HypercubeFaceTag[] = [
  'Reality Planes',
  'Sensory Domains',
  'Presence Types',
  'State Mapping',
  'Trait Mapping',
  'Meaning Architecture',
  'Core',
];

// Map CXDSectionId to HypercubeFaceTag for semantic tag checking.
// Sections without a cube face (desiredChange, humanContext, experienceFlow) are absent.
export const SECTION_TO_FACE_TAG: Record<string, HypercubeFaceTag> = {
  realityPlanes: 'Reality Planes',
  sensoryDomains: 'Sensory Domains',
  presence: 'Presence Types',
  stateMapping: 'State Mapping',
  traitMapping: 'Trait Mapping',
  contextAndMeaning: 'Meaning Architecture',
  intentionCore: 'Core',
};

// Base interface for all canvas elements
export interface CanvasElementBase {
  id: string;
  type: CanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation?: number;
  locked?: boolean;
  containerId?: string; // ID of parent container if nested
  boardId?: string | null; // ID of the board this element belongs to (null = root canvas)
  surface?: SurfaceType; // Which surface this element belongs to ('canvas' or 'hypercube')
  hypercubeTags?: HypercubeFaceTag[]; // Optional semantic face tags
  inInbox?: boolean; // If true, element is in the Task Inbox (not yet placed on canvas)
  groupId?: string; // ID of the group this element belongs to (for logical grouping)
}

// Canvas group for logical grouping of elements
export interface CanvasGroup {
  id: string;
  elementIds: string[];
  createdAt: number;
}

// Task metadata extension for Plan Tab integration
export type TaskType = 'Design' | 'Dev' | 'Admin' | 'Research' | 'Custom';

export interface Subtask {
  id: string;
  text: string;
  isCompleted: boolean;
  order: number;
  customProperties?: Record<string, any>; // Custom properties (e.g., startDate, dueDate for Gantt)
}

export interface TaskDependencyMeta {
  taskId: string;
  type: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
  lag?: number;
}

export interface TaskMetadata {
  isActionable?: boolean;            // Explicit actionable marker
  isArchived?: boolean;              // Archived tasks are hidden from active plan views
  status?: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  taskType?: TaskType;               // Task categorization
  description?: string;              // Task description
  dueDate?: string;                  // ISO date string
  startDate?: string;                // ISO date string
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  blockedReason?: string;
  customTags?: string[];
  customProperties?: Record<string, string | number | boolean>; // User-defined properties
  subtasks?: Subtask[];              // Direct subtask storage (not markdown)
  dependencies?: TaskDependencyMeta[]; // Gantt chart task dependencies
  versionId?: string;                // Link to Version.id (version management)
}

// Freeform Card (Post-it style)
export interface FreeformElement extends CanvasElementBase {
  type: 'freeform';
  cardType?: 'note' | 'task';
  content: string;
  noteTitle?: string;
  noteBody?: string;
  hideNoteTitle?: boolean;           // Note cards: hide the title row (body-only note)
  emoji?: string;
  style?: ElementStyle;
  taskMetadata?: TaskMetadata;       // Plan Tab task extension
  isDocument?: boolean;              // Document mode (compact icon representation)
  wordCount?: number;                // Word count for document preview
}

// Image element with upload support
export interface ImageElement extends CanvasElementBase {
  type: 'image';
  src: string;
  alt?: string;
  description?: string;             // Storyboard caption text
  storyboard?: boolean;            // Storyboard frame mode (image + caption in a bordered cell)
  storyboardBgColor?: string;      // Frame background
  storyboardBorderColor?: string;  // Frame border color
  storyboardBorderWidth?: number;  // Frame border width (px)
  storyboardTextColor?: string;    // Caption text color
  storyboardObjectPosition?: { x: number; y: number }; // object-position % for the covered image (drag to reframe)
  objectFit?: 'cover' | 'contain' | 'fill';
  imageMeta?: {
    width: number;
    height: number;
    bytes: number;
    originalName?: string;
  };
  // Non-destructive image editing metadata
  imageEdits?: {
    crop?: {
      x: number; // Percentage of image width
      y: number; // Percentage of image height
      width: number; // Percentage of image width
      height: number; // Percentage of image height
    };
    // Original element bounds before crop resize (for restore and re-crop)
    preCropBounds?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    flipH?: boolean; // Horizontal flip
    flipV?: boolean; // Vertical flip
  };
}

// Shape element with text support
export interface ShapeElement extends CanvasElementBase {
  type: 'shape';
  shapeType: ShapeType;
  content?: string; // Text inside the shape
  style?: ElementStyle;
  taskMetadata?: TaskMetadata;       // Plan Tab task extension
}

// Container element for grouping
export interface ContainerElement extends CanvasElementBase {
  type: 'container';
  label?: string;
  /** When true the container renders with no header/name — a clean, unlabeled
   *  surface. Used for tidy container-in-container nesting. */
  hideLabel?: boolean;
  collapsed?: boolean;
  tintColor?: 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';
  style?: ElementStyle;
  /** User-set minimum width — updated when user manually resizes the container */
  minWidth?: number;
  /** User-set minimum height — updated when user manually resizes the container */
  minHeight?: number;
}

// Connector element for linking nodes
export interface ConnectorElement extends CanvasElementBase {
  type: 'connector';
  fromNodeId: string;
  toNodeId: string;
  fromAnchor: 'top' | 'right' | 'bottom' | 'left';
  toAnchor: 'top' | 'right' | 'bottom' | 'left';
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  arrowEnd?: boolean;
  strokeColor?: string;
  strokeWidth?: number;
}

// Line end cap styles
export type LineEndStyle = 'none' | 'dot' | 'arrow' | 'square' | 'diamond';

// Line element (standalone, not connector) - free-floating SVG line
export interface LineElement extends CanvasElementBase {
  type: 'line';
  start: { x: number; y: number }; // World coordinates
  end: { x: number; y: number }; // World coordinates
  bend?: { x: number; y: number }; // Curvature control point (world coords)
  style?: {
    kind?: 'solid' | 'dashed' | 'dotted';
    widthPx?: number;
    /** Solid color (hex/hsl). Overridden by gradientName when set. */
    color?: string;
    /** Named gradient — same palette as connectors. Takes precedence over color. */
    gradientName?: 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';
    startCap?: LineEndStyle;
    endCap?: LineEndStyle;
  };
}

// Text element with typography controls
export interface TextElement extends CanvasElementBase {
  type: 'text';
  content: string;
  style?: ElementStyle;
  textAlign?: 'left' | 'center' | 'right';
  wrapWidth?: number; // Custom width for text wrapping (defaults to auto if not set)
  taskMetadata?: TaskMetadata;       // Plan Tab task extension
}

// Link element with bookmark/embed/file modes
export interface LinkElement extends CanvasElementBase {
  type: 'link';
  url: string;
  linkMode: 'bookmark' | 'embed' | 'file';
  title?: string;
  description?: string;
  thumbnail?: string;
  favicon?: string;
  domain?: string;
  // File-specific properties
  fileName?: string;
  fileType?: string; // MIME type
  fileSize?: number;
  fileViewMode?: 'bookmark' | 'preview'; // Only for file mode
}

// Board element for nested canvases
export interface BoardElement extends CanvasElementBase {
  type: 'board';
  childBoardId: string; // The board this element opens into when double-clicked
  title: string;
  thumbnail?: string;
  icon?: string; // Icon for the board (default: grid)
  hexColor?: string; // Hexagon background color
}

// Experience Block - visual shortcut to experience components
export type InspectorSectionId =
  | "intentionCore"
  | "desiredChange"
  | "humanContext"
  | "contextAndMeaning"
  | "realityPlanes"
  | "sensoryDomains"
  | "presenceTypes"
  | "stateMapping"
  | "traitMapping";

export interface ExperienceBlockElement extends CanvasElementBase {
  type: 'experienceBlock';
  componentKey: InspectorSectionId; // Which experience component this block represents
  title: string; // Display title
  viewMode?: 'compact' | 'inline'; // View mode for the block (default: compact)
  style?: ElementStyle; // Optional style for custom gradients
  manuallyResized?: boolean; // True if user has manually resized the element
}

// Table element — structured data grid with per-cell text + coloring/formatting
export interface TableCell {
  text: string;
  bg?: string;      // per-cell background (highest precedence)
  color?: string;   // text color
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  fontSize?: 'sm' | 'md' | 'lg'; // text size (sm 12 / md 14 / lg 18 px), default md
}

export interface TableElement extends CanvasElementBase {
  type: 'table';
  rows: number;
  cols: number;
  // cells[r][c] — row-major grid. Always rows×cols in size.
  cells: TableCell[][];
  rowColors?: (string | null)[]; // optional per-row SOLID background
  colColors?: (string | null)[]; // optional per-column SOLID background
  // Continuous-gradient rows/cols. Each non-null entry is the BASE color for a
  // gradient that reads continuously ACROSS the track: a row renders a single
  // left→right gradient sliced across its cells, a column a single top→bottom
  // gradient sliced down its cells. Kept separate from rowColors/colColors (the
  // solid fills) so the renderer knows to compose the directional slice.
  rowGradient?: (string | null)[]; // per-row continuous horizontal gradient base color
  colGradient?: (string | null)[]; // per-column continuous vertical gradient base color
  colWidths?: number[];          // per-column widths (px, treated as ratios normalized to element width)
  rowHeights?: number[];         // per-row heights (px, treated as ratios normalized to element height)
  tableBg?: string;              // container/table background (default fallback)
  // Table-scope gradient: ONE continuous gradient spanning the whole table from
  // corner to corner. Stored as a BASE color; the renderer lays a single
  // table-wide gradient and gives each cell its slice (backgroundSize = full
  // table W×H, per-cell backgroundPosition from the colLeft/rowTop offsets), so
  // it reads smooth and continuous rather than repeating per cell. Takes
  // precedence over tableBg; cleared to '' when a solid table fill is chosen.
  tableGradient?: string;
  borderColor?: string;          // legacy grid line color (superseded by lineColor)
  lineColor?: string;            // grid line color (preset via color wheel)
  lineWidth?: number;            // grid line width in px (0 = none). Presets: thin 1 / medium 2 / thick 4
  headerRow?: boolean;           // style first row as a header
}

// Union type for all canvas elements
export type CanvasElement =
  | FreeformElement
  | ImageElement
  | ShapeElement
  | ContainerElement
  | ConnectorElement
  | LineElement
  | TextElement
  | LinkElement
  | BoardElement
  | ExperienceBlockElement
  | TableElement;

// Draw-to-create tables: a click-dragged area is turned into this many STANDARD-
// size columns/rows rather than stretching a fixed 3×3. cols = round(width /
// TABLE_STD_COL_W), rows = round(height / TABLE_STD_ROW_H), clamped 1..MAX.
export const TABLE_STD_COL_W = 110;
export const TABLE_STD_ROW_H = 40;
export const TABLE_MAX_TRACKS = 20;

// Rows/cols implied by a drawn area at standard track size (clamped 1..MAX).
export function tableTracksForSize(width: number, height: number): { rows: number; cols: number } {
  const clamp = (n: number) => Math.max(1, Math.min(TABLE_MAX_TRACKS, Math.round(n)));
  return { cols: clamp(width / TABLE_STD_COL_W), rows: clamp(height / TABLE_STD_ROW_H) };
}

// Create a rows×cols grid of empty cells. Used by element creation + add row/col.
export function makeEmptyTableCells(rows: number, cols: number): TableCell[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ text: '' } as TableCell)),
  );
}

// ─── Hypercube tag inheritance ──────────────────────────────────────────
// Children inside a container do NOT carry their own hypercubeTags (see the
// generation sanitizer + framing-to-canvas): only top-level elements and the
// containers themselves are tagged. So for any face membership / count in the
// Map (Hypercube) views, a child must INHERIT the tags of its parent
// container, computed at query time. Nothing is written back onto the child —
// untagging the container therefore untags its whole subtree automatically.

/**
 * Effective face tags for an element: its own tags plus every ancestor
 * container's tags (walking `containerId` up the chain). Pass either the full
 * element array or a prebuilt id→element Map — pass a Map when calling this in
 * a hot filter loop to avoid repeated linear scans.
 */
export function getEffectiveHypercubeTags(
  element: CanvasElement,
  elements: CanvasElement[] | ReadonlyMap<string, CanvasElement>,
): HypercubeFaceTag[] {
  const own = element.hypercubeTags ?? [];
  if (!element.containerId) return own;

  const getById = (id: string): CanvasElement | undefined =>
    elements instanceof Map ? elements.get(id) : (elements as CanvasElement[]).find((e) => e.id === id);

  const tags = new Set<HypercubeFaceTag>(own);
  const seen = new Set<string>();
  let parentId: string | undefined = element.containerId;
  // v1 has a single nesting level, but walk defensively and guard cycles.
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = getById(parentId);
    if (!parent) break;
    (parent.hypercubeTags ?? []).forEach((t) => tags.add(t));
    parentId = parent.containerId;
  }
  return Array.from(tags);
}

/**
 * Does an element belong to `faceTag`, counting tags inherited from its parent
 * container? Use this everywhere the Map views collect face-tagged elements so
 * a tagged container surfaces its (untagged) children under that face.
 */
export function elementMatchesFace(
  element: CanvasElement,
  faceTag: HypercubeFaceTag,
  elements: CanvasElement[] | ReadonlyMap<string, CanvasElement>,
): boolean {
  return getEffectiveHypercubeTags(element, elements).includes(faceTag);
}

// Connector endpoint styles
export type ConnectorEndStyle = 'none' | 'arrow' | 'dot' | 'diamond' | 'square';

// Connection/Edge model with bend control
export interface CanvasEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromAnchor: 'top' | 'right' | 'bottom' | 'left';
  toAnchor: 'top' | 'right' | 'bottom' | 'left';
  // Auto anchor resolves to nearest cardinal side based on the opposite node.
  fromAutoAnchor?: boolean;
  toAutoAnchor?: boolean;
  // Custom anchor offset (0-1 along the edge, 0.5 = center)
  fromAnchorOffset?: number;
  toAnchorOffset?: number;
  boardId?: string | null; // ID of the board this edge belongs to (null = root canvas)
  surface?: SurfaceType; // Which surface this edge belongs to ('canvas' or 'hypercube')
  bend?: { x: number; y: number }; // Control point for curve (world coordinates)
  // Text label
  label?: {
    text: string;
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    position?: number; // 0-1 along the path, 0.5 = center
  };
  style?: {
    color?: string;             // legacy — superseded by gradientName
    thickness?: number;
    arrowHead?: boolean;        // legacy — use endCap/arrowStyle instead
    startCap?: ConnectorEndStyle;
    endCap?: ConnectorEndStyle;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
    gradientName?: 'violet' | 'ocean' | 'emerald' | 'sunset' | 'rose' | 'glacier';
    arrowStyle?: 'none' | 'end' | 'start' | 'both';
    gradientReversed?: boolean;   // flip gradient direction (dark→light becomes light→dark)
  };
}

// Board model for nested canvases
export interface CanvasBoard {
  id: string;
  parentBoardId: string | null;
  title: string;
  nodes: CanvasElement[];
  edges: CanvasEdge[];
  createdAt: string;
  updatedAt: string;
}

export type ToolType = CanvasElementType | null;

export interface ToolkitState {
  activeTool: ToolType;
  isDraggingFromToolbar: boolean;
  dragPreviewPosition: { x: number; y: number } | null;
  selectedShapeType?: ShapeType;
}

// Default sizes for new elements
export const DEFAULT_ELEMENT_SIZES: Record<CanvasElementType, { width: number; height: number }> = {
  freeform: { width: 200, height: 150 },
  image: { width: 200, height: 200 },
  shape: { width: 100, height: 100 },
  container: { width: 300, height: 200 },
  connector: { width: 0, height: 0 },
  line: { width: 200, height: 0 },
  text: { width: 400, height: 40 },
  link: { width: 360, height: 120 }, // Rectangular default (ratio 3) → slim horizontal bookmark-bar layout
  board: { width: 200, height: 150 },
  experienceBlock: { width: 220, height: 100 },
  table: { width: 360, height: 150 },
};

// Tool definitions for the toolbar
export interface ToolDefinition {
  type: CanvasElementType;
  label: string;
  icon: string;
}

export const CANVAS_TOOLS: ToolDefinition[] = [
  { type: 'freeform', label: 'Card', icon: 'StickyNote' },
  { type: 'image', label: 'Image', icon: 'Image' },
  { type: 'shape', label: 'Shape', icon: 'Shapes' },
  { type: 'container', label: 'Container', icon: 'Group' },
  { type: 'connector', label: 'Connector', icon: 'GitBranch' },
  { type: 'text', label: 'Text', icon: 'Type' },
  { type: 'link', label: 'Link', icon: 'Link' },
  { type: 'board', label: 'Board', icon: 'Layout' },
  { type: 'table', label: 'Table', icon: 'Table' },
];

// Shape definitions for the shape palette
export const SHAPE_TYPES: { type: ShapeType; label: string }[] = [
  { type: 'rectangle', label: 'Rectangle' },
  { type: 'circle', label: 'Circle' },
  { type: 'diamond', label: 'Diamond' },
  { type: 'triangle', label: 'Triangle' },
  { type: 'hexagon', label: 'Hexagon' },
  { type: 'star', label: 'Star' },
];

// Helper function to get anchor position on an element
// offset: 0-1 value where 0.5 is center (default)
// Compute the hexagon's bounding rect within a board element.
// The hex is 128x128, centered horizontally, vertically centered in the element.
function getBoardHexBounds(element: CanvasElement) {
  const HEX_SIZE = 128;
  const cx = element.x + element.width / 2;
  const cy = element.y + element.height / 2;
  // At the hex midpoint (y=50%), the edges are at 6.7% and 93.3% of 128 = ±55px from center
  const HEX_HALF_W = 55;
  return { cx, cy, halfW: HEX_HALF_W, halfH: HEX_SIZE / 2 };
}

export function getAnchorPosition(
  element: CanvasElement,
  anchor: 'top' | 'right' | 'bottom' | 'left',
  offset: number = 0.5
): { x: number; y: number } {
  // Board elements: anchor to the hexagon geometry, not the bounding box
  if (element.type === 'board') {
    const hex = getBoardHexBounds(element);
    switch (anchor) {
      case 'top':    return { x: hex.cx, y: hex.cy - hex.halfH };
      case 'bottom': return { x: hex.cx, y: hex.cy + hex.halfH };
      case 'left':   return { x: hex.cx - hex.halfW, y: hex.cy };
      case 'right':  return { x: hex.cx + hex.halfW, y: hex.cy };
    }
  }

  const { x, y, width, height } = element;
  // Clamp offset to 0-1 range
  const clampedOffset = Math.max(0, Math.min(1, offset));

  switch (anchor) {
    case 'top':
      return { x: x + width * clampedOffset, y };
    case 'right':
      return { x: x + width, y: y + height * clampedOffset };
    case 'bottom':
      return { x: x + width * clampedOffset, y: y + height };
    case 'left':
      return { x, y: y + height * clampedOffset };
  }
}

// Helper to determine closest anchor between two elements
export function getClosestAnchors(
  fromElement: CanvasElement,
  toElement: CanvasElement
): { from: 'top' | 'right' | 'bottom' | 'left'; to: 'top' | 'right' | 'bottom' | 'left' } {
  // Use hex center for board elements
  const fromCenter = fromElement.type === 'board'
    ? { x: fromElement.x + fromElement.width / 2, y: fromElement.y + fromElement.height / 2 }
    : { x: fromElement.x + fromElement.width / 2, y: fromElement.y + fromElement.height / 2 };
  const toCenter = toElement.type === 'board'
    ? { x: toElement.x + toElement.width / 2, y: toElement.y + toElement.height / 2 }
    : { x: toElement.x + toElement.width / 2, y: toElement.y + toElement.height / 2 };

  const dx = toCenter.x - fromCenter.x;
  const dy = toCenter.y - fromCenter.y;

  let fromAnchor: 'top' | 'right' | 'bottom' | 'left';
  let toAnchor: 'top' | 'right' | 'bottom' | 'left';

  if (Math.abs(dx) > Math.abs(dy)) {
    fromAnchor = dx > 0 ? 'right' : 'left';
    toAnchor = dx > 0 ? 'left' : 'right';
  } else {
    fromAnchor = dy > 0 ? 'bottom' : 'top';
    toAnchor = dy > 0 ? 'top' : 'bottom';
  }

  return { from: fromAnchor, to: toAnchor };
}

// Helper function to compute auto anchor position (closest edge to source point)
export function getAutoAnchorPosition(
  element: CanvasElement,
  sourcePoint: { x: number; y: number }
): { x: number; y: number } {
  const { x, y, width, height } = element;

  // Clamp source point to element rectangle edges
  const clampedX = Math.max(x, Math.min(x + width, sourcePoint.x));
  const clampedY = Math.max(y, Math.min(y + height, sourcePoint.y));

  // Determine which edge is closest
  const distToLeft = Math.abs(clampedX - x);
  const distToRight = Math.abs(clampedX - (x + width));
  const distToTop = Math.abs(clampedY - y);
  const distToBottom = Math.abs(clampedY - (y + height));

  const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

  if (minDist === distToLeft) {
    return { x, y: clampedY };
  } else if (minDist === distToRight) {
    return { x: x + width, y: clampedY };
  } else if (minDist === distToTop) {
    return { x: clampedX, y };
  } else {
    return { x: clampedX, y: y + height };
  }
}

// Helper function to get nearest anchor point on an element from a source position
export function getNearestAnchor(
  element: CanvasElement,
  sourcePoint: { x: number; y: number }
): 'top' | 'right' | 'bottom' | 'left' {
  const { x, y, width, height } = element;

  const anchors = {
    top: { x: x + width / 2, y, anchor: 'top' as const },
    right: { x: x + width, y: y + height / 2, anchor: 'right' as const },
    bottom: { x: x + width / 2, y: y + height, anchor: 'bottom' as const },
    left: { x, y: y + height / 2, anchor: 'left' as const },
  };

  let nearestAnchor: 'top' | 'right' | 'bottom' | 'left' = 'top';
  let minDistance = Infinity;

  for (const anchor of Object.values(anchors)) {
    const dx = anchor.x - sourcePoint.x;
    const dy = anchor.y - sourcePoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearestAnchor = anchor.anchor;
    }
  }

  return nearestAnchor;
}
