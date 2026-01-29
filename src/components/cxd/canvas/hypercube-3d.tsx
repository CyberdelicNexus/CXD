"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { CXDSectionId } from "@/types/cxd-schema";
import {
  HypercubeFaceTag,
  CanvasElement,
  BoardElement,
} from "@/types/canvas-elements";
import {
  ChevronRight,
  Layout,
  Box,
  Type,
  Link2,
  Image,
  Layers,
  RotateCcw,
  Grid3X3,
  CircleDot,
  ZoomIn,
  ZoomOut,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  Compass,
  X,
  ExternalLink,
  Eye,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DiagnosticPanel } from "./diagnostic-panel";
import { generateDiagnostics } from "@/utils/diagnostic-engine";

// Interaction modes - Two distinct modes per specification
// DEFAULT MODE: Cube auto-rotates, NOT interactive, face buttons are PRIMARY interaction
// EXPLORE MODE: Click-drag rotation enabled, explicit toggle required
//
// ROTATION BEHAVIOR:
// - All elements (faces, edges, inner cube) rotate together as a unified object
// - No independent face glow during rotation - only front-facing face highlights when selected
// - Arrow navigation rotates in 90° steps (left, right, up, down) with proper looping
// - Selection always highlights only the front-facing face after rotation completes
//
// MINIMAP BEHAVIOR (when face/core selected):
// - Inner cube always visible
// - Active face always positioned front-facing
// - When Core selected: highlight only inner cube, no face highlights
// - Rotation, highlighting, and minimap state always consistent
type InteractionMode = "default" | "explore";

// Visual constants
const EDGE_COLOR = "#c8c8dc";
const STRUT_COLOR = "#ffa03c";
const SELECTED_COLOR = "#22d3ee";

// Face Identity System - Domain Tints
// Each face has a unique persistent tint that communicates domain identity
// Hue is domain-specific and never reused
interface FaceIdentity {
  id: CXDSectionId;
  label: string;
  shortLabel: string;
  index: number;
  rotationToFront: { x: number; y: number };
  shortcut: string;
  // Identity properties
  tint: {
    hue: number; // Primary domain color (0-360)
    satBase: number; // Base saturation
    lightBase: number; // Base lightness
  };
  glyph: string; // SVG path data for symbolic icon
  semanticRole: string; // What this domain does
}

// Glyph definitions - simple symbolic shapes
const GLYPHS = {
  // Reality Planes - Layered squares (stacked realities)
  reality: "M15,8 L25,8 L25,18 L15,18 Z M18,11 L28,11 L28,21 L18,21 Z",
  // Sensory Domains - Wave pattern (sensory input)
  sensory: "M10,20 Q15,15 20,20 T30,20 M10,24 Q15,19 20,24 T30,24",
  // Presence - Eye shape (awareness/being)
  presence:
    "M20,15 Q12,20 20,25 Q28,20 20,15 M20,20 m-2,0 a2,2 0 1,0 4,0 a2,2 0 1,0 -4,0",
  // State Mapping - Filled circle (momentary state)
  state: "M20,20 m-8,0 a8,8 0 1,0 16,0 a8,8 0 1,0 -16,0",
  // Trait Mapping - Diamond lattice (enduring structure)
  trait: "M20,12 L28,20 L20,28 L12,20 Z M16,20 L20,16 L24,20 L20,24 Z",
  // Meaning Architecture - Spiral (narrative/meaning)
  meaning: "M20,20 Q20,15 23,15 Q26,15 26,18 Q26,22 22,22 Q17,22 17,18",
  // Core - Concentric circles (center/essence)
  core: "M20,20 m-3,0 a3,3 0 1,0 6,0 a3,3 0 1,0 -6,0 M20,20 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0",
};

// Face configuration with identity system
export interface CubeFace extends FaceIdentity {}

export const CUBE_FACES: CubeFace[] = [
  {
    id: "realityPlanes" as CXDSectionId,
    label: "Reality Planes",
    shortLabel: "Reality",
    index: 0,
    rotationToFront: { x: 0, y: 0 },
    shortcut: "1",
    tint: { hue: 280, satBase: 35, lightBase: 28 }, // Purple - technical/digital
    glyph: GLYPHS.reality,
    semanticRole: "Technical substrate",
  },
  {
    id: "sensoryDomains" as CXDSectionId,
    label: "Sensory Domains",
    shortLabel: "Sensory",
    index: 1,
    rotationToFront: { x: 0, y: -90 },
    shortcut: "2",
    tint: { hue: 45, satBase: 40, lightBase: 30 }, // Amber - warm/physical
    glyph: GLYPHS.sensory,
    semanticRole: "Embodied input",
  },
  {
    id: "presence" as CXDSectionId,
    label: "Presence Types",
    shortLabel: "Presence",
    index: 2,
    rotationToFront: { x: 0, y: 180 },
    shortcut: "3",
    tint: { hue: 195, satBase: 45, lightBase: 32 }, // Cyan - awareness
    glyph: GLYPHS.presence,
    semanticRole: "Quality of being",
  },
  {
    id: "stateMapping" as CXDSectionId,
    label: "State Mapping",
    shortLabel: "States",
    index: 3,
    rotationToFront: { x: 0, y: 90 },
    shortcut: "4",
    tint: { hue: 160, satBase: 40, lightBase: 28 }, // Teal - transient
    glyph: GLYPHS.state,
    semanticRole: "Momentary condition",
  },
  {
    id: "traitMapping" as CXDSectionId,
    label: "Trait Mapping",
    shortLabel: "Traits",
    index: 4,
    rotationToFront: { x: -90, y: 0 },
    shortcut: "5",
    tint: { hue: 260, satBase: 38, lightBase: 30 }, // Violet - enduring
    glyph: GLYPHS.trait,
    semanticRole: "Lasting structure",
  },
  {
    id: "contextAndMeaning" as CXDSectionId,
    label: "Meaning Architecture",
    shortLabel: "Meaning",
    index: 5,
    rotationToFront: { x: 90, y: 0 },
    shortcut: "6",
    tint: { hue: 320, satBase: 42, lightBase: 32 }, // Magenta - narrative
    glyph: GLYPHS.meaning,
    semanticRole: "Story & context",
  },
];

const SECTION_TO_TAG: Record<string, HypercubeFaceTag> = {
  realityPlanes: "Reality Planes",
  sensoryDomains: "Sensory Domains",
  presence: "Presence Types",
  stateMapping: "State Mapping",
  traitMapping: "Trait Mapping",
  contextAndMeaning: "Meaning Architecture",
};

const ELEMENT_TYPE_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  board: Layout,
  container: Box,
  text: Type,
  link: Link2,
  image: Image,
  experienceBlock: Layers,
  freeform: Type,
};

function getElementDisplayName(element: CanvasElement): string {
  switch (element.type) {
    case "board":
      return (element as any).title || "Untitled Board";
    case "container":
      return (element as any).title || "Untitled Container";
    case "text":
      return (element as any).content?.slice(0, 30) || "Text Card";
    case "freeform":
      return (element as any).content?.slice(0, 30) || "Freeform Card";
    case "link":
      return (
        (element as any).title || (element as any).url?.slice(0, 30) || "Link"
      );
    case "image":
      return (element as any).alt || "Image";
    case "experienceBlock":
      return (element as any).title || "Experience Block";
    default:
      return "Element";
  }
}

// Rich content preview for canvas elements
interface ElementPreview {
  id: string;
  type: string;
  title: string;
  excerpt?: string;
  thumbnail?: string;
  domain?: string;
  isEmpty: boolean;
  elementCount?: number; // For boards/containers
  fileName?: string; // For file elements
  url?: string; // For links
}

function getElementPreview(
  element: CanvasElement,
  project?: any,
): ElementPreview {
  const base = { id: element.id, type: element.type, isEmpty: false };

  switch (element.type) {
    case "text":
    case "freeform": {
      const content = (element as any).content || "";
      const lines = content
        .split("\n")
        .filter((l: string) => l.trim().length > 0);
      const title = lines[0]?.slice(0, 60) || "Text Card";
      const excerpt = lines.slice(1).join(" ").slice(0, 120);
      return {
        ...base,
        title,
        excerpt: excerpt || undefined,
        isEmpty: !content,
      };
    }
    case "link": {
      const url = (element as any).url || "";
      const title = (element as any).title || url || "Link";
      let domain = "";
      try {
        domain = new URL(url).hostname;
      } catch {}
      return { ...base, title, domain, url, isEmpty: !url };
    }
    case "image": {
      const alt = (element as any).alt || "Image";
      const src = (element as any).src;
      return { ...base, title: alt, thumbnail: src, isEmpty: !src };
    }
    case "board": {
      const name = (element as any).title || "Untitled Board";
      // Count elements by filtering canvasElements where boardId matches
      // Elements are stored flat in canvasElements with a boardId property
      const boardId = (element as BoardElement).childBoardId;
      const allElements = project?.canvasLayout?.elements || [];
      // Filter to elements in this board, exclude lines and connectors
      const boardElements = allElements.filter(
        (el: any) =>
          el.boardId === boardId &&
          el.type !== "line" &&
          el.type !== "connector",
      );
      const elementCount = boardElements.length;

      console.log("[Hypercube Board Count]", {
        elementId: element.id,
        boardId,
        totalProjectElements: allElements.length,
        elementCount,
        boardTitle: name,
        elementTypes: boardElements.map((el: any) => el.type),
      });

      return {
        ...base,
        title: name,
        elementCount,
        isEmpty: !name,
      };
    }
    case "container": {
      const title = (element as any).title || "Untitled Container";
      const children = (element as any).children || [];
      return {
        ...base,
        title,
        elementCount: children.length,
        isEmpty: !title,
      };
    }
    case "experienceBlock":
      return {
        ...base,
        title: (element as any).title || "Experience Block",
        excerpt: (element as any).description?.slice(0, 100),
        isEmpty: !(element as any).title,
      };
    default:
      return { ...base, title: "Element", isEmpty: true };
  }
}

// Generate deterministic face summary based on current state
function generateFaceSummary(
  face: CubeFace,
  project: any,
  taggedElements: CanvasElement[],
): string {
  const elementCount = taggedElements.length;

  switch (face.id) {
    case "realityPlanes": {
      const planes = project.realityPlanesV2 || [];
      const activePlanes = planes.filter((p: any) => p.enabled);
      const planeNames = activePlanes.map((p: any) => p.name).join(", ");

      if (activePlanes.length === 0) {
        return "No reality planes are currently active. Define which planes of reality this experience operates within.";
      }
      if (activePlanes.length > 4) {
        return `${activePlanes.length} planes active (${planeNames}). Consider simplifying—cognitive load increases with each layer.`;
      }
      return `Operating across ${activePlanes.length} plane${activePlanes.length > 1 ? "s" : ""}: ${planeNames}. ${elementCount} tagged element${elementCount !== 1 ? "s" : ""} ground this domain.`;
    }

    case "sensoryDomains": {
      const domains = project.sensoryDomains || {};
      const activeKeys = Object.entries(domains).filter(
        ([_, v]: [string, any]) => v > 0,
      );
      const dominantSense = activeKeys.sort((a: any, b: any) => b[1] - a[1])[0];

      if (activeKeys.length === 0) {
        return "No sensory channels are currently emphasized. Define how users will physically experience this design.";
      }
      if (dominantSense) {
        return `${dominantSense[0]} is the dominant sensory channel at ${dominantSense[1]}%. ${activeKeys.length} sense${activeKeys.length > 1 ? "s" : ""} active overall.`;
      }
      return `${activeKeys.length} sensory channels engaged. ${elementCount} tagged element${elementCount !== 1 ? "s" : ""}.`;
    }

    case "presence": {
      const types = project.presenceTypes || {};
      const activeTypes = Object.entries(types).filter(
        ([_, v]: [string, any]) => v > 0,
      );
      const dominantType = activeTypes.sort((a: any, b: any) => b[1] - a[1])[0];

      if (activeTypes.length === 0) {
        return "No presence qualities are defined. What mode of being should users inhabit?";
      }
      return `${dominantType?.[0] || "Multiple"} presence leads at ${dominantType?.[1] || 0}%. ${activeTypes.length} presence mode${activeTypes.length > 1 ? "s" : ""} active.`;
    }

    case "stateMapping": {
      const states = project.stateMapping || {};
      const definedStates = Object.entries(states).filter(
        ([_, v]: [string, any]) => v && String(v).trim().length > 0,
      );

      if (definedStates.length === 0) {
        return "No momentary states defined. What emotional or cognitive states should users pass through?";
      }
      return `${definedStates.length} state${definedStates.length > 1 ? "s" : ""} mapped. ${elementCount > 0 ? `${elementCount} tagged artifact${elementCount !== 1 ? "s" : ""} embody these states.` : "No artifacts yet tagged."}`;
    }

    case "traitMapping": {
      const traits = project.traitMapping || {};
      const definedTraits = Object.entries(traits).filter(
        ([_, v]: [string, any]) => v && String(v).trim().length > 0,
      );

      if (definedTraits.length === 0) {
        return "No lasting traits defined. What enduring qualities should this experience cultivate?";
      }
      return `${definedTraits.length} trait${definedTraits.length > 1 ? "s" : ""} targeted. ${elementCount > 0 ? `${elementCount} tagged artifact${elementCount !== 1 ? "s" : ""} support trait development.` : "No artifacts yet tagged."}`;
    }

    case "contextAndMeaning": {
      const meaning = project.contextAndMeaning || {};
      const hasWorld = meaning.world && meaning.world.trim().length > 0;
      const hasStory = meaning.story && meaning.story.trim().length > 0;
      const hasMagic = meaning.magic && meaning.magic.trim().length > 0;
      const components = [
        hasWorld && "world",
        hasStory && "story",
        hasMagic && "magic",
      ].filter(Boolean);

      if (components.length === 0) {
        return "No narrative architecture defined. What meaning should hold this experience together?";
      }
      return `Grounded in ${components.join(", ")}. ${elementCount > 0 ? `${elementCount} tagged element${elementCount !== 1 ? "s" : ""} carry this meaning.` : "Consider tagging artifacts to this domain."}`;
    }

    default:
      return "Select a face to see its summary.";
  }
}

function groupElementsByType(elements: CanvasElement[]) {
  const groups: Record<string, CanvasElement[]> = {
    board: [],
    container: [],
    text: [],
    freeform: [],
    link: [],
    image: [],
    experienceBlock: [],
  };
  elements.forEach((el) => {
    if (groups[el.type]) groups[el.type].push(el);
  });
  return groups;
}

function normalizeAngle(angle: number): number {
  while (angle > 180) angle -= 360;
  while (angle < -180) angle += 360;
  return angle;
}

function clampRotationX(x: number): number {
  return Math.max(-85, Math.min(85, x));
}

// Determine which face is currently facing front based on cube rotation
// Returns face index 0-5 based on which face normal points most toward camera (positive Z)
function getFrontFaceFromRotation(rotX: number, rotY: number): number {
  // Normalize angles to 0-360 range
  const normY = ((rotY % 360) + 360) % 360;
  const normX = ((rotX % 360) + 360) % 360;

  // Check for top/bottom faces first (based on X rotation)
  if (normX > 45 && normX < 135) {
    return 5; // Meaning (bottom) - rotated to show bottom
  }
  if (normX > 225 && normX < 315) {
    return 4; // Traits (top) - rotated to show top
  }

  // For side faces, use Y rotation
  // Face 0 (Reality) at y=0, Face 1 (Sensory) at y=90, Face 2 (Presence) at y=180, Face 3 (States) at y=270
  if (normY >= 315 || normY < 45) return 0; // Reality (front)
  if (normY >= 45 && normY < 135) return 3; // States (left becomes front when rotated right)
  if (normY >= 135 && normY < 225) return 2; // Presence (back)
  if (normY >= 225 && normY < 315) return 1; // Sensory (right becomes front when rotated left)

  return 0;
}

// Calculate rotation needed to bring a specific face to front
function getRotationForFace(faceIndex: number): { x: number; y: number } {
  switch (faceIndex) {
    case 0:
      return { x: 0, y: 0 }; // Reality - Front
    case 1:
      return { x: 0, y: -90 }; // Sensory - Right (rotate left to bring to front)
    case 2:
      return { x: 0, y: 180 }; // Presence - Back
    case 3:
      return { x: 0, y: 90 }; // States - Left (rotate right to bring to front)
    case 4:
      return { x: -90, y: 0 }; // Traits - Top (rotate down to bring to front)
    case 5:
      return { x: 90, y: 0 }; // Meaning - Bottom (rotate up to bring to front)
    default:
      return { x: 0, y: 0 };
  }
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const DEFAULT_ZOOM = 1;
const DRAG_THRESHOLD = 5;

// Auto-rotation speed (degrees per second)
const AUTO_ROTATION_SPEED = 8;

interface Hypercube3DProps {
  project: any;
  onSelectSection: (sectionId: CXDSectionId) => void;
  onCoreClick: () => void;
  selectedSection: CXDSectionId | null;
  onNavigateToElement?: (elementId: string) => void;
  onPreviewElement?: (element: CanvasElement) => void;
}

export function Hypercube3D({
  project,
  onSelectSection,
  onCoreClick,
  selectedSection,
  onNavigateToElement,
  onPreviewElement,
}: Hypercube3DProps) {
  // Store project reference globally for categorizeElement
  // Guard for SSR / restricted environments
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__currentProject = project;
  }, [project]);

  const [cubeRotation, setCubeRotation] = useState({ x: -25, y: -35 });
  const [targetRotation, setTargetRotation] = useState({ x: -25, y: -35 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [focusedFaceIndex, setFocusedFaceIndex] = useState<number | null>(null);
  const [isCoreSelected, setIsCoreSelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mouseDownPos, setMouseDownPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [hasDragged, setHasDragged] = useState(false);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Two-mode interaction system per specification
  // DEFAULT: auto-rotate, non-interactive cube, face buttons are primary
  // EXPLORE: explicit toggle, drag-to-rotate enabled
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("default");
  const [hoveredArrowFace, setHoveredArrowFace] = useState<number | null>(null);
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);

  // Zoom level for explore mode (1.0 = default, can zoom in/out)
  const [exploreZoom, setExploreZoom] = useState(DEFAULT_ZOOM);

  // Auto-rotation for overview mode
  const autoRotationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const sceneRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const startRotationRef = useRef({ x: 0, y: 0 });

  // Auto-rotation effect for default mode (when no face selected)
  // Cube slowly auto-rotates in default mode, stops when face is selected or in explore mode
  useEffect(() => {
    // Only auto-rotate when in default mode AND no face is selected
    const shouldAutoRotate =
      interactionMode === "default" &&
      focusedFaceIndex === null &&
      !isCoreSelected &&
      !isAnimating;

    if (!shouldAutoRotate) {
      if (autoRotationRef.current) {
        cancelAnimationFrame(autoRotationRef.current);
        autoRotationRef.current = null;
      }
      return;
    }

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      setCubeRotation((prev) => ({
        x: prev.x,
        y: prev.y + AUTO_ROTATION_SPEED * deltaTime,
      }));

      if (typeof window !== "undefined") {
        autoRotationRef.current = window.requestAnimationFrame(animate);
      }
    };

    if (typeof window !== "undefined") {
      autoRotationRef.current = window.requestAnimationFrame(animate);
    }

    return () => {
      if (autoRotationRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(autoRotationRef.current);
      }
      lastTimeRef.current = 0;
    };
  }, [interactionMode, isAnimating, focusedFaceIndex, isCoreSelected]);

  // Generate real-time diagnostics
  const diagnostics = useMemo(() => {
    return generateDiagnostics(project, project?.canvasLayout?.elements || []);
  }, [project]);

  const handleFaceReference = useCallback((faceId: string) => {
    const faceIndex = CUBE_FACES.findIndex((f) => f.id === faceId);
    if (faceIndex !== -1) {
      selectFace(faceIndex);
    }
  }, []);

  // Cube dimensions
  const outerSize = 200;
  const innerSize = 80;

  // Project 3D point to 2D
  const project3D = useCallback(
    (x: number, y: number, z: number) => {
      const rx = (cubeRotation.x * Math.PI) / 180;
      const ry = (cubeRotation.y * Math.PI) / 180;

      // Rotate around X axis
      let y1 = y * Math.cos(rx) - z * Math.sin(rx);
      let z1 = y * Math.sin(rx) + z * Math.cos(rx);

      // Rotate around Y axis
      const x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
      const z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);

      // Perspective projection
      const perspective = 600;
      const scale = perspective / (perspective + z2);

      return {
        x: 400 + x2 * scale,
        y: 400 + y1 * scale,
        z: z2, // Keep z for depth sorting
      };
    },
    [cubeRotation],
  );

  // Define cube corners
  const outerCorners = useMemo(() => {
    const half = outerSize / 2;
    return [
      [-half, -half, -half],
      [half, -half, -half],
      [half, half, -half],
      [-half, half, -half],
      [-half, -half, half],
      [half, -half, half],
      [half, half, half],
      [-half, half, half],
    ].map(([x, y, z]) => project3D(x, y, z));
  }, [outerSize, project3D]);

  const innerCorners = useMemo(() => {
    const half = innerSize / 2;
    return [
      [-half, -half, -half],
      [half, -half, -half],
      [half, half, -half],
      [-half, half, -half],
      [-half, -half, half],
      [half, -half, half],
      [half, half, half],
      [-half, half, half],
    ].map(([x, y, z]) => project3D(x, y, z));
  }, [innerSize, project3D]);

  // Define edges (pairs of corner indices)
  const cubeEdges: [number, number][] = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0], // Back face
    [4, 5],
    [5, 6],
    [6, 7],
    [7, 4], // Front face
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7], // Connecting edges
  ];

  // Animation
  useEffect(() => {
    if (!isAnimating) return;

    startRotationRef.current = cubeRotation;
    const startTime =
      typeof performance !== "undefined" ? performance.now() : 0;
    const duration = 600;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const newX =
        startRotationRef.current.x +
        (targetRotation.x - startRotationRef.current.x) * eased;
      const newY =
        startRotationRef.current.y +
        (targetRotation.y - startRotationRef.current.y) * eased;

      setCubeRotation({ x: newX, y: newY });

      if (progress < 1) {
        if (typeof window !== "undefined") {
          animationRef.current = window.requestAnimationFrame(animate);
        }
      } else {
        // Ensure final rotation exactly matches target to avoid floating-point drift
        setCubeRotation({ x: targetRotation.x, y: targetRotation.y });
        setIsAnimating(false);
        animationRef.current = null;
        console.log(
          "[Hypercube] Animation complete - Cube transform:",
          targetRotation,
        );
      }
    };

    if (typeof window !== "undefined") {
      animationRef.current = window.requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current && typeof window !== "undefined") {
        window.cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isAnimating, targetRotation]);

  const selectFace = useCallback((index: number) => {
    const face = CUBE_FACES[index];
    if (!face) return;

    console.log("[Hypercube] Selecting face:", index, face.shortLabel);

    // Set focused face and clear core
    setFocusedFaceIndex(index);
    setIsCoreSelected(false);

    // Rotate cube to bring selected face to FRONT
    const targetRot = getRotationForFace(index);
    console.log("[Hypercube] Target rotation:", targetRot);

    setTargetRotation(targetRot);
    setIsAnimating(true);
  }, []);

  const focusCore = useCallback(() => {
    // Stay in default mode, show core panel
    // DO NOT call onCoreClick here - that opens the sidebar
    // Sidebar should only open via "Configure" button or double-click
    setFocusedFaceIndex(null);
    setIsCoreSelected(true);
    setIsAnimating(true);
    setTargetRotation({ x: -25, y: -35 });
    console.log("[Hypercube] Core selected - showing core panel");
  }, []);

  const returnToDefault = useCallback(() => {
    // Clear selection, return to auto-rotating cube
    setInteractionMode("default");
    setFocusedFaceIndex(null);
    setIsCoreSelected(false);
    setIsAnimating(true);
    setTargetRotation({ x: -25, y: -35 });
  }, []);

  const enterExploreMode = useCallback(() => {
    // Explicit toggle to explore mode
    setInteractionMode("explore");
    // Clear face selection when entering explore
    setFocusedFaceIndex(null);
    setIsCoreSelected(false);
  }, []);

  const exitExploreMode = useCallback(() => {
    // Exit explore mode, return to default orientation
    setInteractionMode("default");
    setIsAnimating(true);
    setTargetRotation({ x: -25, y: -35 });
    setExploreZoom(1.0); // Reset zoom when exiting explore mode
  }, []);

  // Wheel handler for zoom in explore mode
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (interactionMode !== "explore") return;

      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      setExploreZoom((prev) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + zoomDelta)),
      );
    },
    [interactionMode],
  );

  // Arrow navigation - rotates cube 90 degrees in the specified direction
  // These are TRUE rotations that change which face is front
  const rotateLeft = useCallback(() => {
    // Rotate cube 90 degrees around Y axis (clockwise from above)
    // This brings the RIGHT face to FRONT
    const currentX = targetRotation.x;
    const currentY = targetRotation.y;
    const newY = Math.round(currentY / 90) * 90 + 90;
    setTargetRotation({ x: currentX, y: newY });
    setIsAnimating(true);
    const newFrontFace = getFrontFaceFromRotation(currentX, newY);
    setFocusedFaceIndex(newFrontFace);
    setIsCoreSelected(false);
    console.log(
      "[Hypercube] Rotate Left -> Y:",
      newY,
      "New front face:",
      newFrontFace,
    );
  }, [targetRotation]);

  const rotateRight = useCallback(() => {
    // Rotate cube 90 degrees around Y axis (counter-clockwise from above)
    // This brings the LEFT face to FRONT
    const currentX = targetRotation.x;
    const currentY = targetRotation.y;
    const newY = Math.round(currentY / 90) * 90 - 90;
    setTargetRotation({ x: currentX, y: newY });
    setIsAnimating(true);
    const newFrontFace = getFrontFaceFromRotation(currentX, newY);
    setFocusedFaceIndex(newFrontFace);
    setIsCoreSelected(false);
    console.log(
      "[Hypercube] Rotate Right -> Y:",
      newY,
      "New front face:",
      newFrontFace,
    );
  }, [targetRotation]);

  const rotateUp = useCallback(() => {
    // Rotate cube 90 degrees around X axis
    // This brings the BOTTOM face to FRONT
    const currentX = targetRotation.x;
    const currentY = targetRotation.y;
    const newX = Math.round(currentX / 90) * 90 + 90;
    setTargetRotation({ x: newX, y: currentY });
    setIsAnimating(true);
    const newFrontFace = getFrontFaceFromRotation(newX, currentY);
    setFocusedFaceIndex(newFrontFace);
    setIsCoreSelected(false);
    console.log(
      "[Hypercube] Rotate Up -> X:",
      newX,
      "New front face:",
      newFrontFace,
    );
  }, [targetRotation]);

  const rotateDown = useCallback(() => {
    // Rotate cube 90 degrees around X axis (opposite)
    // This brings the TOP face to FRONT
    const currentX = targetRotation.x;
    const currentY = targetRotation.y;
    const newX = Math.round(currentX / 90) * 90 - 90;
    setTargetRotation({ x: newX, y: currentY });
    setIsAnimating(true);
    const newFrontFace = getFrontFaceFromRotation(newX, currentY);
    setFocusedFaceIndex(newFrontFace);
    setIsCoreSelected(false);
    console.log(
      "[Hypercube] Rotate Down -> X:",
      newX,
      "New front face:",
      newFrontFace,
    );
  }, [targetRotation]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only allow dragging in explore mode - cube is NOT interactive in default mode
      if (interactionMode !== "explore") return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest(".hypercube-ui-panel")) return;

      setMouseDownPos({ x: e.clientX, y: e.clientY });
      setDragStart({ x: e.clientX, y: e.clientY });
      setHasDragged(false);
    },
    [interactionMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      // Only allow rotation in explore mode
      if (interactionMode !== "explore") return;
      if (!mouseDownPos) return;

      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      const totalDeltaX = e.clientX - mouseDownPos.x;
      const totalDeltaY = e.clientY - mouseDownPos.y;
      const totalDistance = Math.sqrt(
        totalDeltaX * totalDeltaX + totalDeltaY * totalDeltaY,
      );

      if (totalDistance > DRAG_THRESHOLD) {
        if (!hasDragged) {
          setHasDragged(true);
          setIsDragging(true);
        }

        const sensitivity = 0.4;
        const newX = clampRotationX(cubeRotation.x - deltaY * sensitivity);
        const newY = cubeRotation.y + deltaX * sensitivity;

        setCubeRotation({ x: newX, y: newY });
        setTargetRotation({ x: newX, y: newY });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
    },
    [interactionMode, mouseDownPos, dragStart, cubeRotation, hasDragged],
  );

  const handleMouseUp = useCallback(() => {
    setMouseDownPos(null);
    setIsDragging(false);
    setTimeout(() => setHasDragged(false), 50);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      if (e.key >= "1" && e.key <= "6") {
        e.preventDefault();
        selectFace(parseInt(e.key) - 1);
        return;
      }

      if (e.key === "0") {
        e.preventDefault();
        focusCore();
        return;
      }

      if (e.key === "Escape") {
        if (interactionMode === "explore") {
          // Exit explore mode, return to default orientation
          exitExploreMode();
        } else if (focusedFaceIndex !== null || isCoreSelected) {
          // Clear selection in default mode
          returnToDefault();
        }
        return;
      }
    };

    // Guard for SSR / environments without window
    if (typeof window === "undefined") return;

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectFace,
    focusCore,
    interactionMode,
    returnToDefault,
    exitExploreMode,
    focusedFaceIndex,
    isCoreSelected,
  ]);

  const getTaggedElementsForFace = useMemo(() => {
    const allElements = project?.canvasLayout?.elements || [];
    return (faceTag: HypercubeFaceTag) => {
      return allElements.filter((el: CanvasElement) =>
        el.hypercubeTags?.includes(faceTag),
      );
    };
  }, [project?.canvasLayout?.elements]);

  // Sensemaking Mode - Calculate face intensity and coherence
  // Returns visual parameters based on domain state without requiring interaction
  const calculateFaceIntensity = useCallback(
    (face: CubeFace) => {
      const sectionId = face.id;
      const faceTag = SECTION_TO_TAG[sectionId];
      const taggedElements = faceTag ? getTaggedElementsForFace(faceTag) : [];
      const elementCount = taggedElements.length;

      // Base values
      let completion = 0; // 0-1: How developed is this domain
      let coherence = 0.5; // 0-1: How aligned/conflicted is the domain
      let glowIntensity = 0.2; // Base glow
      let glowPattern: "stable" | "pulsing" | "fractured" = "stable";

      // Domain-specific logic
      switch (sectionId) {
        case "realityPlanes": {
          const planes = project.realityPlanesV2 || [];
          const activePlanes = planes.filter((p: any) => p.enabled);
          const wellDefined = activePlanes.filter(
            (p: any) =>
              p.interfaceModality && p.interfaceModality.trim().length > 0,
          );

          completion = activePlanes.length / 7; // 7 total planes
          coherence =
            activePlanes.length > 0
              ? wellDefined.length / activePlanes.length
              : 0.5;

          if (activePlanes.length > 4)
            glowPattern = "fractured"; // Overloaded
          else if (completion > 0.3 && coherence > 0.7) glowPattern = "stable";
          else if (activePlanes.length > 0) glowPattern = "pulsing";
          break;
        }

        case "sensoryDomains": {
          const domains = project.sensoryDomains || {};
          const values = Object.values(domains);
          const activeCount = values.filter((v: any) => v > 0).length;
          const avgValue =
            values.reduce((sum: number, v: any) => sum + v, 0) / values.length;

          completion = activeCount / 5; // 5 domains
          coherence =
            avgValue > 0
              ? 1 -
                Math.min(
                  values.reduce(
                    (sum: number, v: any) => sum + Math.pow(v - avgValue, 2),
                    0,
                  ) /
                    values.length /
                    1000,
                  1,
                )
              : 0.5;

          if (avgValue > 70) glowPattern = "fractured";
          else if (completion > 0.4 && coherence > 0.6) glowPattern = "stable";
          else if (activeCount > 0) glowPattern = "pulsing";
          break;
        }

        case "presence": {
          const types = project.presenceTypes || {};
          const values = Object.values(types).filter(
            (v: any) => v > 0,
          ) as number[];
          completion = values.length / 6;

          if (values.length > 0) {
            const maxValue = Math.max(...values);
            const avgValue =
              values.reduce((sum: number, v: number) => sum + v, 0) /
              values.length;
            coherence = avgValue / maxValue; // Higher when balanced
          }

          if (values.length > 4) glowPattern = "stable";
          else if (values.length > 0) glowPattern = "pulsing";
          break;
        }

        case "stateMapping": {
          const states = project.stateMapping || {};
          const stateValues = Object.values(states);
          const hasStates = stateValues.some(
            (v: any) => v && v.trim && v.trim().length > 0,
          );

          completion = hasStates ? 0.7 : 0;
          coherence = elementCount > 0 ? 1 : 0.5; // Coherent if has tagged elements

          if (hasStates && elementCount === 0)
            glowPattern = "pulsing"; // Missing artifacts
          else if (hasStates && elementCount > 0) glowPattern = "stable";
          break;
        }

        case "traitMapping": {
          const traits = project.traitMapping || {};
          const traitValues = Object.values(traits);
          const hasTraits = traitValues.some(
            (v: any) => v && v.trim && v.trim().length > 0,
          );

          completion = hasTraits ? 0.7 : 0;
          coherence = elementCount > 0 ? 1 : 0.5;

          if (hasTraits && elementCount === 0) glowPattern = "pulsing";
          else if (hasTraits && elementCount > 0) glowPattern = "stable";
          break;
        }

        case "contextAndMeaning": {
          const meaning = project.contextAndMeaning || {};
          const hasWorld = meaning.world && meaning.world.trim().length > 0;
          const hasStory = meaning.story && meaning.story.trim().length > 0;
          const hasMagic = meaning.magic && meaning.magic.trim().length > 0;
          const structuredCount = [hasWorld, hasStory, hasMagic].filter(
            Boolean,
          ).length;

          completion = structuredCount / 3;
          coherence = elementCount > 0 ? 1 : 0.5;

          if (structuredCount > 1 && elementCount > 2) glowPattern = "stable";
          else if (structuredCount > 0) glowPattern = "pulsing";
          break;
        }
      }

      // Calculate glow intensity based on completion and coherence
      if (completion === 0) {
        glowIntensity = 0.1; // Dim - domain underdeveloped
      } else if (completion > 0 && completion < 0.5) {
        glowIntensity = 0.2 + completion * 0.3; // Faint - exists but underdeveloped
      } else if (coherence > 0.7) {
        glowIntensity = 0.5 + completion * 0.3; // Strong - coherent and populated
      } else {
        glowIntensity = 0.3 + completion * 0.2; // Moderate
      }

      return {
        completion,
        coherence,
        glowIntensity,
        glowPattern,
        elementCount,
        // Visual state description
        state:
          completion === 0
            ? "undeveloped"
            : completion < 0.5
              ? "emerging"
              : coherence > 0.7
                ? "coherent"
                : "active",
      };
    },
    [project, getTaggedElementsForFace],
  );

  // Compute which face is actually facing front based on current rotation
  const currentFrontFaceIndex = useMemo(() => {
    const frontIndex = getFrontFaceFromRotation(cubeRotation.x, cubeRotation.y);
    return frontIndex;
  }, [cubeRotation.x, cubeRotation.y]);

  // Log when activeFaceId changes
  useEffect(() => {
    if (focusedFaceIndex !== null) {
      console.log(
        "[Hypercube] activeFaceId:",
        CUBE_FACES[focusedFaceIndex]?.id,
        "index:",
        focusedFaceIndex,
      );
    }
  }, [focusedFaceIndex]);

  const focusedFace =
    focusedFaceIndex !== null ? CUBE_FACES[focusedFaceIndex] : null;
  const focusedFaceTag = focusedFace ? SECTION_TO_TAG[focusedFace.id] : null;
  const focusedTaggedElements = focusedFaceTag
    ? getTaggedElementsForFace(focusedFaceTag)
    : [];

  // Generate rich previews for tagged elements
  const focusedElementPreviews = useMemo(() => {
    return focusedTaggedElements.map((el: any) =>
      getElementPreview(el, project),
    );
  }, [focusedTaggedElements, project]);

  // Generate face summary
  const faceSummary = useMemo(() => {
    if (!focusedFace) return "";
    return generateFaceSummary(focusedFace, project, focusedTaggedElements);
  }, [focusedFace, project, focusedTaggedElements]);

  const edgeColor = isCoreSelected ? SELECTED_COLOR : EDGE_COLOR;
  const strutColor = isCoreSelected ? SELECTED_COLOR : STRUT_COLOR;

  // Cube positioning based on selection state
  // When a face is selected: cube shrinks and moves to top-right as NAVIGATION MAP
  // Otherwise: cube is centered and visually prominent
  const cubePosition = useMemo(() => {
    const hasFaceSelected = focusedFaceIndex !== null || isCoreSelected;

    if (hasFaceSelected && interactionMode === "default") {
      // Minimap position: top-right corner, smaller but still 3D (20-30° tilt preserved)
      return { scale: 0.4, x: "calc(100% - 180px)", y: "140px" };
    }
    // Center position for default (no selection) and explore mode
    // In explore mode, apply zoom level
    const baseScale = 0.85;
    const scale =
      interactionMode === "explore" ? baseScale * exploreZoom : baseScale;
    return { scale, x: "50%", y: "50%" };
  }, [interactionMode, focusedFaceIndex, isCoreSelected, exploreZoom]);

  return (
    <div className="relative w-full h-full bg-background overflow-hidden">
      {/* Diagnostic Panel - Left side, visible when face is selected */}
      <DiagnosticPanel
        diagnostics={diagnostics}
        onFaceReference={handleFaceReference}
        isOpen={isPanelOpen && (focusedFaceIndex !== null || isCoreSelected)}
        onToggle={() => setIsPanelOpen(!isPanelOpen)}
      />
      {/* 3D Scene Container */}
      <div
        ref={sceneRef}
        className={cn(
          "absolute inset-0 overflow-hidden",
          interactionMode === "explore"
            ? isDragging
              ? "cursor-grabbing"
              : "cursor-grab"
            : "cursor-default",
        )}
        style={{
          background:
            "radial-gradient(circle at 50% 50%, hsl(270 30% 8%), hsl(270 30% 3%))",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* SVG for 3D wireframe - Position changes based on mode */}
        <svg
          className="absolute transition-all duration-500 ease-out left-[1199px] top-[-38px]"
          style={{
            left: cubePosition.x,
            top: cubePosition.y,
            transform: `translate(-50%, -50%) scale(${cubePosition.scale})`,
            width: "800px",
            height: "800px",
          }}
          viewBox="0 0 800 800"
        >
          <defs>
            {/* Glow filters for different states */}
            <filter id="glow-stable">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-pulsing">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-fractured">
              {/* Simplified - no noise texture, just a slightly stronger glow */}
              <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Animation for pulsing glow */}
            <style>
              {`
              @keyframes pulse-glow {
                0%, 100% { opacity: 0.6; }
                50% { opacity: 1; }
              }
              .glow-pulsing {
                animation: pulse-glow 2.5s ease-in-out infinite;
              }
            `}
            </style>
          </defs>

          {/* Outer cube edges */}
          {cubeEdges.map(([i, j], idx) => {
            // Calculate face color based on edge orientation
            const midPoint = {
              x: (outerCorners[i].x + outerCorners[j].x) / 2,
              y: (outerCorners[i].y + outerCorners[j].y) / 2,
              z: (outerCorners[i].z + outerCorners[j].z) / 2,
            };

            // Determine which face this edge belongs to (approximate)
            let faceHue = 270; // Default purple
            if (midPoint.z > 50)
              faceHue = 280; // Front face - Reality Planes
            else if (midPoint.z < -50)
              faceHue = 160; // Back face - State Mapping
            else if (midPoint.x > 50)
              faceHue = 45; // Right face - Sensory Domains
            else if (midPoint.x < -50)
              faceHue = 260; // Left face - Trait Mapping
            else if (midPoint.y < -50)
              faceHue = 320; // Top face - Meaning Architecture
            else if (midPoint.y > 50) faceHue = 195; // Bottom face - Presence

            return (
              <line
                key={`outer-${idx}`}
                x1={outerCorners[i].x}
                y1={outerCorners[i].y}
                x2={outerCorners[j].x}
                y2={outerCorners[j].y}
                stroke={`hsl(${faceHue} 30% 50%)`}
                strokeWidth="2.5"
                strokeLinecap="round"
                filter="url(#glow-stable)"
                opacity={
                  interactionMode === "explore" && focusedFaceIndex !== null
                    ? 0.4
                    : 0.7
                }
                style={{ transition: "opacity 0.5s ease" }}
              />
            );
          })}

          {/* Inner cube edges - always visible, glow electric purple when Core is selected, cyan when face is selected */}
          {cubeEdges.map(([i, j], idx) => {
            const midPoint = {
              x: (innerCorners[i].x + innerCorners[j].x) / 2,
              y: (innerCorners[i].y + innerCorners[j].y) / 2,
              z: (innerCorners[i].z + innerCorners[j].z) / 2,
            };

            // When Core is selected, inner cube glows electric purple
            // When a face is selected, inner cube glows cyan (like the selection indicator)
            const hasFaceSelected = focusedFaceIndex !== null;
            const glowColor = isCoreSelected
              ? "hsl(270 80% 70%)"
              : hasFaceSelected
                ? "hsl(185 70% 55%)" // Cyan glow when any face is selected
                : undefined;

            let faceHue = 270;
            if (midPoint.z > 20) faceHue = 280;
            else if (midPoint.z < -20) faceHue = 160;
            else if (midPoint.x > 20) faceHue = 45;
            else if (midPoint.x < -20) faceHue = 260;
            else if (midPoint.y < -20) faceHue = 320;
            else if (midPoint.y > 20) faceHue = 195;

            // Make inner cube more visible in minimap mode or when face is selected
            const isMinimapMode =
              (focusedFaceIndex !== null || isCoreSelected) &&
              interactionMode === "default";

            // Enhanced visibility when a face is selected (shows inner cube outline)
            const isHighlighted = isCoreSelected || hasFaceSelected;

            return (
              <line
                key={`inner-${idx}`}
                x1={innerCorners[i].x}
                y1={innerCorners[i].y}
                x2={innerCorners[j].x}
                y2={innerCorners[j].y}
                stroke={glowColor || `hsl(${faceHue} 30% 50%)`}
                strokeWidth={isHighlighted ? "3" : "2.5"}
                strokeLinecap="round"
                filter={
                  isCoreSelected ? "url(#glow-pulsing)" : "url(#glow-stable)"
                }
                opacity={isHighlighted ? 0.9 : isMinimapMode ? 0.8 : 0.7}
                style={{
                  transition:
                    "stroke 0.4s ease, stroke-width 0.4s ease, opacity 0.4s ease, filter 0.4s ease",
                  filter: isHighlighted
                    ? isCoreSelected
                      ? "drop-shadow(0 0 8px hsl(270 80% 60%))"
                      : "drop-shadow(0 0 6px hsl(185 70% 50%))"
                    : undefined,
                }}
              />
            );
          })}

          {/* Diagonal struts */}
          {outerCorners.map((outer, i) => (
            <line
              key={`strut-${i}`}
              x1={innerCorners[i].x}
              y1={innerCorners[i].y}
              x2={outer.x}
              y2={outer.y}
              stroke={strutColor}
              strokeWidth="1.5"
              strokeLinecap="round"
              filter="url(#glow-stable)"
              opacity={
                interactionMode === "explore" && focusedFaceIndex !== null
                  ? 0.3
                  : 0.6
              }
              style={{ transition: "opacity 0.5s ease" }}
            />
          ))}

          {/* Core glyph - always visible at center */}
          {isCoreSelected && (
            <g transform="translate(400, 400)">
              <path
                d={GLYPHS.core}
                transform="translate(-20, -20) scale(2)"
                fill="none"
                stroke="hsl(195 70% 70%)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={1}
                filter="url(#glow-stable)"
                style={{
                  filter: "drop-shadow(0 0 12px hsl(195 70% 60%))",
                }}
              />
            </g>
          )}

          {/* Face Planes with Identity System */}
          {CUBE_FACES.map((face, faceIndex) => {
            const intensity = calculateFaceIntensity(face);
            const { hue, satBase, lightBase } = face.tint;
            const saturation = satBase + intensity.completion * 20;
            const lightness = lightBase + intensity.glowIntensity * 15;

            // A face is "front" if it's the one actually facing the camera
            const isFrontFace = currentFrontFaceIndex === faceIndex;
            // A face is "focused" if it's selected in the UI
            const isFocused = focusedFaceIndex === faceIndex;
            const isHovered = hoveredFace === faceIndex;
            // Dim non-front faces when we have a focused face
            const isDimmed =
              focusedFaceIndex !== null && !isFocused && !isFrontFace;
            // In default mode with selection, only highlight the front-facing face
            // When Core is selected, no faces should be active/highlighted
            const isActive =
              !isCoreSelected && focusedFaceIndex !== null
                ? isFrontFace
                : false;

            // Calculate face center and corners based on face index
            // Front (0), Right (1), Back (2), Left (3), Bottom (4), Top (5)
            let faceCornerIndices: number[] = [];
            switch (faceIndex) {
              case 0: // Reality Planes - Front (Z+)
                faceCornerIndices = [4, 5, 6, 7];
                break;
              case 1: // Sensory Domains - Right (X+)
                faceCornerIndices = [1, 5, 6, 2];
                break;
              case 2: // Presence - Back (Z-)
                faceCornerIndices = [0, 1, 2, 3];
                break;
              case 3: // States - Left (X-)
                faceCornerIndices = [0, 3, 7, 4];
                break;
              case 4: // Traits - Top (Y-)
                faceCornerIndices = [0, 1, 5, 4];
                break;
              case 5: // Meaning - Bottom (Y+)
                faceCornerIndices = [3, 2, 6, 7];
                break;
            }

            const faceCorners = faceCornerIndices.map((i) => outerCorners[i]);

            // Calculate face center
            const centerX = faceCorners.reduce((sum, c) => sum + c.x, 0) / 4;
            const centerY = faceCorners.reduce((sum, c) => sum + c.y, 0) / 4;
            const centerZ = faceCorners.reduce((sum, c) => sum + c.z, 0) / 4;

            // Create SVG path for face polygon
            const pathData =
              `M ${faceCorners[0].x} ${faceCorners[0].y} ` +
              faceCorners
                .slice(1)
                .map((c) => `L ${c.x} ${c.y}`)
                .join(" ") +
              " Z";

            const baseColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
            const glowColor = `hsl(${hue} ${saturation + 10}% ${lightness + 15}%)`;

            // Glow filter based on pattern
            const filterUrl =
              intensity.glowPattern === "stable"
                ? "url(#glow-stable)"
                : intensity.glowPattern === "pulsing"
                  ? "url(#glow-pulsing)"
                  : "url(#glow-fractured)";

            // Front face gets full visibility, others fade based on depth
            // Use z-position of face center to determine visibility
            const depthFactor = Math.max(0.3, 1 - (centerZ + 200) / 400);
            const faceOpacity = isActive
              ? 0.5 // Active/front face - strong visibility
              : isCoreSelected
                ? 0.1 // Very dim when Core is selected - inner cube should be focus
                : isDimmed
                  ? 0.15 // Non-active when something is focused
                  : depthFactor * 0.35; // Normal depth-based fading

            return (
              <g key={`face-${faceIndex}`}>
                {/* Face plane with flat tint - only front face glows when focused */}
                <path
                  d={pathData}
                  fill={baseColor}
                  fillOpacity={faceOpacity}
                  stroke={glowColor}
                  strokeWidth={isActive ? "3" : "1"}
                  strokeOpacity={isActive ? 1 : 0.5}
                  filter={isActive ? filterUrl : undefined}
                  className={
                    intensity.glowPattern === "pulsing" && isActive
                      ? "glow-pulsing"
                      : ""
                  }
                  style={{
                    transition:
                      "fill 0.4s ease, fill-opacity 0.4s ease, stroke 0.4s ease, stroke-width 0.4s ease, stroke-opacity 0.4s ease",
                    pointerEvents: "none",
                  }}
                />
                {/* Glyphs removed - faces show only tint and glow */}
              </g>
            );
          })}
        </svg>

        {/* Top Navigation Bar - Upgraded Hypercube Faces Menu */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 items-center p-2 rounded-xl">
          {/* Mode indicator */}
          <div
            className={cn(
              "w-[88px] h-[72px] rounded-lg flex items-center justify-center transition-all duration-300 cursor-default relative overflow-hidden group",
              interactionMode === "default" &&
                "bg-gradient-to-br from-purple-900/60 via-purple-950/80 to-indigo-950/60 border border-purple-500/30",
              interactionMode === "explore" &&
                "bg-gradient-to-br from-amber-900/60 via-amber-950/80 to-orange-950/60 border border-amber-500/30",
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="flex flex-col items-center gap-1 relative z-10">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  interactionMode === "default" &&
                    focusedFaceIndex === null &&
                    !isCoreSelected &&
                    "bg-purple-400 animate-pulse shadow-lg shadow-purple-400/50",
                  interactionMode === "default" &&
                    (focusedFaceIndex !== null || isCoreSelected) &&
                    "bg-cyan-400 shadow-lg shadow-cyan-400/50",
                  interactionMode === "explore" &&
                    "bg-amber-400 animate-pulse shadow-lg shadow-amber-400/50",
                )}
              />
              <span
                className={cn(
                  "text-[11px] font-bold uppercase tracking-wide",
                  interactionMode === "default"
                    ? "text-purple-300"
                    : "text-amber-300",
                )}
              >
                {interactionMode === "default" &&
                  (focusedFaceIndex !== null || isCoreSelected) &&
                  "Active"}
                {interactionMode === "default" &&
                  focusedFaceIndex === null &&
                  !isCoreSelected &&
                  "Default"}
                {interactionMode === "explore" && "Explore"}
              </span>
            </div>
          </div>

          {/* Face buttons */}
          {CUBE_FACES.map((face, index) => {
            const isFocused = focusedFaceIndex === index;
            const isDimmed =
              focusedFaceIndex !== null && focusedFaceIndex !== index;
            const intensity = calculateFaceIntensity(face);

            const { hue, satBase, lightBase } = face.tint;
            const saturation = satBase + intensity.completion * 20;
            const lightness = lightBase + intensity.glowIntensity * 15;

            // Dark gradient colors for the button
            const gradientStart = `hsl(${hue} ${Math.min(saturation + 10, 50)}% 12%)`;
            const gradientMid = `hsl(${hue} ${Math.min(saturation + 5, 45)}% 8%)`;
            const gradientEnd = `hsl(${hue} ${saturation}% 5%)`;
            const glowColor = `hsl(${hue} ${Math.min(saturation + 20, 70)}% ${Math.min(lightness + 30, 65)}%)`;
            const textColor = `hsl(${hue} ${Math.min(saturation + 25, 80)}% ${Math.min(lightness + 35, 75)}%)`;

            return (
              <button
                key={face.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasDragged) return;
                  if (focusedFaceIndex === index) {
                    onSelectSection(face.id);
                  } else {
                    selectFace(index);
                  }
                }}
                className={cn(
                  "group relative w-[88px] h-[72px] rounded-lg border transition-all duration-300 flex items-center justify-center",
                  isFocused && "scale-105 z-10",
                  isDimmed && "opacity-40 scale-95",
                  !isFocused &&
                    !isDimmed &&
                    "hover:scale-105 hover:z-10 overflow-visible",
                )}
                style={{
                  background: `linear-gradient(135deg, ${gradientStart} 0%, ${gradientMid} 50%, ${gradientEnd} 100%)`,
                  borderColor: isFocused
                    ? glowColor
                    : `hsl(${hue} ${saturation}% 25%)`,
                  boxShadow: isFocused
                    ? `0 0 25px ${glowColor}80, 0 0 50px ${glowColor}40, inset 0 1px 1px ${glowColor}30`
                    : isDimmed
                      ? "none"
                      : `inset 0 1px 1px hsl(${hue} ${saturation}% 20% / 0.3)`,
                }}
                title={`${face.label} - ${face.semanticRole}`}
              >
                {/* Hover glow overlay */}
                <div
                  className={cn(
                    "absolute inset-0 opacity-0 transition-opacity duration-300",
                    !isFocused && !isDimmed && "group-hover:opacity-100",
                  )}
                  style={{
                    background: `radial-gradient(circle at center, ${glowColor}20 0%, transparent 70%)`,
                  }}
                />
                {/* Bottom glow accent */}
                <div
                  className="absolute inset-x-0 bottom-0 h-1/2 opacity-30"
                  style={{
                    background: `linear-gradient(to top, ${glowColor}15, transparent)`,
                  }}
                />
                {/* Text */}
                <span
                  className={cn(
                    "relative z-10 text-[13px] font-bold uppercase tracking-wide transition-all duration-300",
                    !isFocused && !isDimmed && "group-hover:scale-110",
                  )}
                  style={{
                    color: isFocused ? glowColor : textColor,
                    textShadow: isFocused
                      ? `0 0 20px ${glowColor}`
                      : `0 0 10px ${glowColor}50`,
                  }}
                >
                  {face.shortLabel}
                </span>
                {/* Count badge */}
                {Number.isFinite(intensity.elementCount) &&
                  intensity.elementCount > 0 && (
                    <div
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg z-20"
                      style={{
                        backgroundColor: glowColor,
                        color: "#000",
                        boxShadow: `0 0 10px ${glowColor}`,
                      }}
                    >
                      {intensity.elementCount}
                    </div>
                  )}
              </button>
            );
          })}

          {/* Core button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasDragged) return;
              focusCore();
            }}
            className={cn(
              "group relative w-[88px] h-[72px] rounded-lg border transition-all duration-300 flex items-center justify-center overflow-hidden",
              isCoreSelected && "scale-105 z-10",
              !isCoreSelected && "hover:scale-105 hover:z-10",
            )}
            style={{
              background: isCoreSelected
                ? "linear-gradient(135deg, hsl(270 60% 15%) 0%, hsl(270 50% 10%) 50%, hsl(270 40% 5%) 100%)"
                : "linear-gradient(135deg, hsl(270 40% 12%) 0%, hsl(270 35% 8%) 50%, hsl(270 30% 5%) 100%)",
              borderColor: isCoreSelected
                ? "hsl(270 80% 65%)"
                : "hsl(270 40% 25%)",
              boxShadow: isCoreSelected
                ? "0 0 25px hsl(270 80% 60% / 0.6), 0 0 50px hsl(270 80% 60% / 0.3), inset 0 1px 1px hsl(270 80% 70% / 0.3)"
                : "inset 0 1px 1px hsl(270 40% 20% / 0.3)",
            }}
            title="Focus Core - The inner experience structure"
          >
            {/* Hover glow overlay */}
            <div
              className={cn(
                "absolute inset-0 opacity-0 transition-opacity duration-300",
                !isCoreSelected && "group-hover:opacity-100",
              )}
              style={{
                background:
                  "radial-gradient(circle at center, hsl(270 80% 60% / 0.2) 0%, transparent 70%)",
              }}
            />
            {/* Bottom glow accent */}
            <div
              className="absolute inset-x-0 bottom-0 h-1/2 opacity-30"
              style={{
                background:
                  "linear-gradient(to top, hsl(270 80% 60% / 0.15), transparent)",
              }}
            />
            <span
              className={cn(
                "relative z-10 text-[13px] font-bold uppercase tracking-wide transition-all duration-300",
                !isCoreSelected && "group-hover:scale-110",
              )}
              style={{
                color: isCoreSelected ? "hsl(270 80% 75%)" : "hsl(270 60% 70%)",
                textShadow: isCoreSelected
                  ? "0 0 20px hsl(270 80% 60%)"
                  : "0 0 10px hsl(270 60% 60% / 0.5)",
              }}
            >
              Core
            </span>
          </button>

          {/* Explore mode toggle - moved to end */}
          {interactionMode !== "explore" ? (
            <button
              onClick={enterExploreMode}
              className="group relative w-[88px] h-[72px] rounded-lg border transition-all duration-300 flex items-center justify-center overflow-hidden hover:scale-105 hover:z-10"
              style={{
                background:
                  "linear-gradient(135deg, hsl(35 40% 12%) 0%, hsl(35 35% 8%) 50%, hsl(35 30% 5%) 100%)",
                borderColor: "hsl(35 40% 25%)",
                boxShadow: "inset 0 1px 1px hsl(35 40% 20% / 0.3)",
              }}
              title="Enter explore mode to rotate the cube freely"
            >
              {/* Hover glow overlay */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background:
                    "radial-gradient(circle at center, hsl(35 80% 50% / 0.2) 0%, transparent 70%)",
                }}
              />
              {/* Bottom glow accent */}
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 opacity-30"
                style={{
                  background:
                    "linear-gradient(to top, hsl(35 80% 50% / 0.15), transparent)",
                }}
              />
              <div className="relative z-10 flex flex-col items-center gap-1">
                <Compass className="w-4 h-4 text-amber-400/70 group-hover:text-amber-300 transition-colors" />
                <span
                  className="text-[11px] font-bold uppercase tracking-wide text-amber-400/70 group-hover:text-amber-300 group-hover:scale-110 transition-all duration-300"
                  style={{
                    textShadow: "0 0 10px hsl(35 60% 50% / 0.5)",
                  }}
                >
                  Explore
                </span>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={exitExploreMode}
                className="group relative w-[72px] h-[72px] rounded-lg border transition-all duration-300 flex items-center justify-center overflow-hidden hover:scale-105"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(35 50% 15%) 0%, hsl(35 45% 10%) 50%, hsl(35 40% 6%) 100%)",
                  borderColor: "hsl(35 70% 50%)",
                  boxShadow:
                    "0 0 15px hsl(35 70% 50% / 0.4), inset 0 1px 1px hsl(35 70% 60% / 0.3)",
                }}
                title="Exit explore mode (Esc)"
              >
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <X className="w-4 h-4 text-amber-300" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300">
                    Exit
                  </span>
                </div>
              </button>

              {/* Zoom controls */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() =>
                    setExploreZoom((prev) => Math.min(MAX_ZOOM, prev + 0.2))
                  }
                  className="p-1.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-300 hover:bg-amber-500/30 hover:scale-110 transition-all"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3 h-3" />
                </button>
                <span className="text-[9px] text-amber-300/70 text-center font-medium">
                  {Math.round(exploreZoom * 100)}%
                </span>
                <button
                  onClick={() =>
                    setExploreZoom((prev) => Math.max(MIN_ZOOM, prev - 0.2))
                  }
                  className="p-1.5 rounded bg-amber-500/20 border border-amber-400/30 text-amber-300 hover:bg-amber-500/30 hover:scale-110 transition-all"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Directional Navigation Arrows - TRUE 90° cube rotations */}
        {interactionMode === "default" &&
          (focusedFaceIndex !== null || isCoreSelected) && (
            <div className="absolute right-4 w-[320px] pointer-events-none z-15 top-[10px]">
              {/* Face label below minimap */}

              <div className="relative w-full h-[280px] flex items-center justify-center">
                {/* Arrow Up - rotates cube to bring TOP face to front */}
                <button
                  onClick={rotateUp}
                  className="pointer-events-auto absolute top-0 left-1/2 -translate-x-1/2 p-2 rounded-lg backdrop-blur-sm border transition-all bg-card/80 border-border/50 hover:bg-card hover:border-primary/40 hover:scale-110"
                  title="Rotate Up (bring bottom face forward)"
                >
                  <ChevronUp className="w-5 h-5 text-foreground/80" />
                </button>

                {/* Arrow Down - rotates cube to bring BOTTOM face to front */}
                <button
                  onClick={rotateDown}
                  className="pointer-events-auto absolute bottom-0 left-1/2 -translate-x-1/2 p-2 rounded-lg backdrop-blur-sm border transition-all bg-card/80 border-border/50 hover:bg-card hover:border-primary/40 hover:scale-110"
                  title="Rotate Down (bring top face forward)"
                >
                  <ChevronDown className="w-5 h-5 text-foreground/80" />
                </button>

                {/* Arrow Left - rotates cube 90° left (brings right face to front) */}
                <button
                  onClick={rotateLeft}
                  className="pointer-events-auto absolute left-0 top-1/2 -translate-y-1/2 p-2 rounded-lg backdrop-blur-sm border transition-all bg-card/80 border-border/50 hover:bg-card hover:border-primary/40 hover:scale-110"
                  title="Rotate Left"
                >
                  <ChevronLeft className="w-5 h-5 text-foreground/80" />
                </button>

                {/* Arrow Right - rotates cube 90° right (brings left face to front) */}
                <button
                  onClick={rotateRight}
                  className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 p-2 rounded-lg backdrop-blur-sm border transition-all bg-card/80 border-border/50 hover:bg-card hover:border-primary/40 hover:scale-110"
                  title="Rotate Right"
                >
                  <ChevronRight className="w-5 h-5 text-foreground/80" />
                </button>
              </div>
              <div
                className={
                  "text-center mb-2 pointer-events-none py-[0px] absolute top-[205px] text-indigo-500 w-[189.1125px] left-[63px]"
                }
              >
                <p
                  className={
                    "text-xs font-semibold text-foreground/90 text-dark-primary"
                  }
                >
                  {focusedFaceIndex !== null
                    ? CUBE_FACES[focusedFaceIndex]?.label
                    : "Hypercube"}
                </p>
              </div>
            </div>
          )}

        {/* Keyboard hints */}
        <div className="hypercube-ui-panel absolute bottom-4 left-4 z-10 text-xs text-muted-foreground/60">
          <div className="flex items-center gap-4">
            {interactionMode === "explore" ? (
              <>
                <span className="text-amber-400/70">🔄 Explore Mode</span>
                <span className="text-muted-foreground/40">|</span>
                <span>Drag to rotate</span>
                <span className="text-muted-foreground/40">|</span>
                <span>Scroll to zoom ({Math.round(exploreZoom * 100)}%)</span>
                <span className="text-muted-foreground/40">|</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground text-[10px]">
                    Esc
                  </kbd>{" "}
                  exit
                </span>
              </>
            ) : focusedFaceIndex !== null || isCoreSelected ? (
              <>
                <span className="text-cyan-400/70">📊 Sensemaking</span>
                <span className="text-muted-foreground/40">|</span>
                <span>Use top menu to navigate faces</span>
                <span className="text-muted-foreground/40">|</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground text-[10px]">
                    Esc
                  </kbd>{" "}
                  return to default
                </span>
              </>
            ) : (
              <>
                <span className="text-purple-400/70">🌐 Default Mode</span>
                <span className="text-muted-foreground/40">|</span>
                <span>
                  Select a face from the top menu to begin sensemaking
                </span>
                <span className="text-muted-foreground/40">|</span>
                <span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground text-[10px]">
                    1-6
                  </kbd>{" "}
                  faces
                </span>
              </>
            )}
          </div>
        </div>

        {/* CENTER PANEL - When a face is selected in default mode */}
        {interactionMode === "default" && focusedFace && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-full max-w-2xl mx-auto px-8 pointer-events-auto">
              <div
                className="bg-card/95 backdrop-blur-xl rounded-2xl border shadow-2xl overflow-hidden"
                style={{
                  borderColor: `hsl(${focusedFace.tint.hue} 40% 40% / 0.5)`,
                }}
              >
                {/* Header */}
                <div
                  className="px-6 py-4 border-b border-border flex items-center justify-between"
                  style={{
                    backgroundColor: `hsl(${focusedFace.tint.hue} 30% 15% / 0.5)`,
                  }}
                >
                  <div className="flex items-center gap-4">
                    <svg width="36" height="36" viewBox="0 0 40 40">
                      <path
                        d={focusedFace.glyph}
                        fill="none"
                        stroke={`hsl(${focusedFace.tint.hue} 50% 65%)`}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        {focusedFace.label}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {focusedFace.semanticRole}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onSelectSection(focusedFace.id)}
                      className="px-3 py-1.5 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors flex items-center gap-1.5"
                    >
                      Configure
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      onClick={returnToDefault}
                      className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Return to default"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div className="px-6 py-4 border-b border-border">
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    {faceSummary}
                  </p>
                </div>

                {/* Rich Content Previews */}
                <div className="px-6 py-4 max-h-[300px] overflow-y-auto">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                      Tagged Canvas Elements
                    </h3>
                    <span className="text-xs text-muted-foreground/70">
                      {focusedElementPreviews.length} element
                      {focusedElementPreviews.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {focusedElementPreviews.length === 0 ? (
                    <div className="text-center py-8 border border-dashed border-border/50 rounded-lg">
                      <Type className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">
                        No elements tagged to this face yet
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        Use "Tag to Hypercube" in element context menu on canvas
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {focusedElementPreviews.map((preview: ElementPreview) => {
                        const Icon = ELEMENT_TYPE_ICONS[preview.type] || Box;
                        // Find the actual element for callbacks
                        const element = focusedTaggedElements.find(
                          (el: CanvasElement) => el.id === preview.id,
                        );

                        return (
                          <div
                            key={preview.id}
                            className={cn(
                              "group p-3 rounded-lg border transition-all hover:bg-white/5 cursor-pointer",
                              preview.isEmpty
                                ? "border-border/30 opacity-60"
                                : "border-border/50",
                            )}
                            style={{
                              borderLeftColor: `hsl(${focusedFace.tint.hue} 40% 50%)`,
                              borderLeftWidth: "3px",
                            }}
                            onClick={() => {
                              if (onPreviewElement && element) {
                                onPreviewElement(element);
                              }
                            }}
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-foreground truncate">
                                    {preview.title}
                                  </span>
                                  {preview.domain && (
                                    <span className="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 bg-white/5 rounded">
                                      {preview.domain}
                                    </span>
                                  )}
                                  {preview.elementCount !== undefined && (
                                    <span className="text-[10px] text-muted-foreground/70 px-1.5 py-0.5 bg-white/5 rounded">
                                      {preview.elementCount}{" "}
                                      {preview.elementCount === 1
                                        ? "item"
                                        : "items"}
                                    </span>
                                  )}
                                </div>
                                {preview.excerpt && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {preview.excerpt}
                                  </p>
                                )}
                                {preview.isEmpty && (
                                  <p className="text-xs text-muted-foreground/50 mt-1 italic">
                                    No content yet
                                  </p>
                                )}
                                {/* Action buttons - always visible for better discoverability */}
                                <div className="flex items-center gap-2 mt-2">
                                  {element && onPreviewElement && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onPreviewElement(element);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-primary/20 hover:bg-primary/30 text-primary transition-colors"
                                    >
                                      <Eye className="w-3 h-3" />
                                      Quick View
                                    </button>
                                  )}
                                  {onNavigateToElement && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onNavigateToElement(preview.id);
                                      }}
                                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-white/10 hover:bg-white/20 text-foreground/80 transition-colors"
                                    >
                                      <MapPin className="w-3 h-3" />
                                      View on Canvas
                                    </button>
                                  )}
                                  {preview.type === "link" && preview.url && (
                                    <a
                                      href={preview.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="flex items-center gap-1 px-2 py-1 text-[10px] rounded bg-white/10 hover:bg-white/20 text-foreground/80 transition-colors"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      Open Link
                                    </a>
                                  )}
                                </div>
                              </div>
                              {preview.thumbnail && (
                                <div className="w-16 h-16 rounded overflow-hidden bg-black/20 flex-shrink-0 border border-border/30">
                                  <img
                                    src={preview.thumbnail}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (
                                        e.target as HTMLImageElement
                                      ).style.display = "none";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CORE PANEL - When core is selected in default mode */}
        {interactionMode === "default" && isCoreSelected && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <div className="w-full max-w-2xl mx-auto px-8 pointer-events-auto">
              <div className="bg-card/95 backdrop-blur-xl rounded-2xl border border-cyan-500/30 shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border bg-cyan-950/30 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <svg width="36" height="36" viewBox="0 0 40 40">
                      <path
                        d={GLYPHS.core}
                        fill="none"
                        stroke="hsl(195 70% 65%)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">
                        Core
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        The inner essence of this experience
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onCoreClick()}
                      className="px-3 py-1.5 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors flex items-center gap-1.5"
                    >
                      Configure
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      onClick={returnToDefault}
                      className="p-1.5 hover:bg-white/10 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Return to default"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Core Overview */}
                <div className="px-6 py-4">
                  <p className="text-sm text-foreground/90 leading-relaxed mb-4">
                    The Core represents the unified center of your experience
                    design. It's where all six dimensions converge—Reality,
                    Sensory, Presence, States, Traits, and Meaning—into a
                    coherent whole.
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    {CUBE_FACES.map((face, index) => {
                      const intensity = calculateFaceIntensity(face);
                      return (
                        <button
                          key={face.id}
                          onClick={() => selectFace(index)}
                          className="p-3 rounded-lg border border-border/50 hover:bg-white/5 transition-all text-left flex items-center gap-3"
                          style={{
                            borderLeftColor: `hsl(${face.tint.hue} 40% 50%)`,
                            borderLeftWidth: "3px",
                          }}
                        >
                          <svg width="24" height="24" viewBox="0 0 40 40">
                            <path
                              d={face.glyph}
                              fill="none"
                              stroke={`hsl(${face.tint.hue} 50% 60%)`}
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {face.shortLabel}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {intensity.state === "undeveloped" &&
                                "Not started"}
                              {intensity.state === "emerging" && "In progress"}
                              {intensity.state === "active" && "Active"}
                              {intensity.state === "coherent" && "Coherent"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
