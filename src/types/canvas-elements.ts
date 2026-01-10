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
  | 'experienceBlock';

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
] as const;

// Font families for text elements
export const FONT_FAMILIES = [
  { value: 'inherit', label: 'Default' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: 'ui-monospace, monospace', label: 'Mono' },
] as const;

// Style properties shared across elements
export interface ElementStyle {
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  fillOpacity?: number; // 0-100 for shapes
}

// Surface types for separating canvas vs hypercube nodes
export type SurfaceType = 'canvas' | 'hypercube';

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
}

// Freeform Card (Post-it style)
export interface FreeformElement extends CanvasElementBase {
  type: 'freeform';
  content: string;
  emoji?: string;
  style?: ElementStyle;
}

// Image element with upload support
export interface ImageElement extends CanvasElementBase {
  type: 'image';
  src: string;
  alt?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  imageMeta?: {
    width: number;
    height: number;
    bytes: number;
    originalName?: string;
  };
}

// Shape element with text support
export interface ShapeElement extends CanvasElementBase {
  type: 'shape';
  shapeType: ShapeType;
  content?: string; // Text inside the shape
  style?: ElementStyle;
}

// Container element for grouping
export interface ContainerElement extends CanvasElementBase {
  type: 'container';
  label?: string;
  collapsed?: boolean;
  style?: ElementStyle;
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

// Line element (standalone, not connector) - free-floating SVG line
export interface LineElement extends CanvasElementBase {
  type: 'line';
  start: { x: number; y: number }; // World coordinates
  end: { x: number; y: number }; // World coordinates
  bend?: { x: number; y: number }; // Curvature control point (world coords)
  style?: {
    kind?: 'solid' | 'dashed' | 'dotted';
    widthPx?: number;
    color?: string;
  };
}

// Text element with typography controls
export interface TextElement extends CanvasElementBase {
  type: 'text';
  content: string;
  style?: ElementStyle;
  textAlign?: 'left' | 'center' | 'right';
  wrapWidth?: number; // Custom width for text wrapping (defaults to auto if not set)
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
  | ExperienceBlockElement;

// Connection/Edge model with bend control
export interface CanvasEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  fromAnchor: 'top' | 'right' | 'bottom' | 'left';
  toAnchor: 'top' | 'right' | 'bottom' | 'left';
  boardId?: string | null; // ID of the board this edge belongs to (null = root canvas)
  surface?: SurfaceType; // Which surface this edge belongs to ('canvas' or 'hypercube')
  bend?: { x: number; y: number }; // Control point for curve (world coordinates)
  style?: {
    color?: string;
    thickness?: number;
    arrowHead?: boolean;
    lineStyle?: 'solid' | 'dashed' | 'dotted';
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
  text: { width: 200, height: 40 },
  link: { width: 320, height: 240 }, // Updated for better bookmark view and 16:9 embed
  board: { width: 200, height: 150 },
  experienceBlock: { width: 220, height: 100 },
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
export function getAnchorPosition(
  element: CanvasElement,
  anchor: 'top' | 'right' | 'bottom' | 'left'
): { x: number; y: number } {
  const { x, y, width, height } = element;
  switch (anchor) {
    case 'top':
      return { x: x + width / 2, y };
    case 'right':
      return { x: x + width, y: y + height / 2 };
    case 'bottom':
      return { x: x + width / 2, y: y + height };
    case 'left':
      return { x, y: y + height / 2 };
  }
}

// Helper to determine closest anchor between two elements
export function getClosestAnchors(
  fromElement: CanvasElement,
  toElement: CanvasElement
): { from: 'top' | 'right' | 'bottom' | 'left'; to: 'top' | 'right' | 'bottom' | 'left' } {
  const fromCenter = { x: fromElement.x + fromElement.width / 2, y: fromElement.y + fromElement.height / 2 };
  const toCenter = { x: toElement.x + toElement.width / 2, y: toElement.y + toElement.height / 2 };
  
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
