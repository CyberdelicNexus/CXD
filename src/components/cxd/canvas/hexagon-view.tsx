"use client";

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useCXDStore } from "@/store/cxd-store";
import { CXDSectionId } from "@/types/cxd-schema";
import { HypercubeFaceTag, CanvasElement } from "@/types/canvas-elements";
import { ChevronRight, Home, Layout, Box, Type, Link2, Image, Layers, ExternalLink } from "lucide-react";
import { HexagonDetailPanel } from "./hexagon-detail-panel";
import { NavigationToolkit } from "./navigation-toolkit";
import { Hypercube3D } from "./hypercube-3d";
import { QuickViewModal } from "./quick-view-modal";

// Feature toggle - set to true to use 3D cube view instead of 2D hexagon
const USE_3D_CUBE = true;

// Map CXDSectionId to HypercubeFaceTag for semantic tag checking
const SECTION_TO_TAG: Record<string, HypercubeFaceTag> = {
  realityPlanes: 'Reality Planes',
  sensoryDomains: 'Sensory Domains',
  presence: 'Presence Types',
  stateMapping: 'State Mapping',
  traitMapping: 'Trait Mapping',
  contextAndMeaning: 'Meaning Architecture',
};

// Element type icons for related elements preview
const ELEMENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  board: Layout,
  container: Box,
  text: Type,
  link: Link2,
  image: Image,
  experienceBlock: Layers,
  freeform: Type,
};

// Get display name for element
function getElementDisplayName(element: CanvasElement): string {
  switch (element.type) {
    case 'board':
      return (element as any).title || 'Untitled Board';
    case 'container':
      return (element as any).title || 'Untitled Container';
    case 'text':
      return (element as any).content?.slice(0, 30) || 'Text Card';
    case 'freeform':
      return (element as any).content?.slice(0, 30) || 'Freeform Card';
    case 'link':
      return (element as any).title || (element as any).url?.slice(0, 30) || 'Link';
    case 'image':
      return (element as any).alt || 'Image';
    case 'experienceBlock':
      return (element as any).title || 'Experience Block';
    default:
      return 'Element';
  }
}

// Group elements by type
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
    if (groups[el.type]) {
      groups[el.type].push(el);
    }
  });
  
  return groups;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;
const ZOOM_SENSITIVITY = 0.001;

// Hypercube faces represent conceptual dimensions of the experience
// Read-only semantic lens - navigation and inspection only
const wedgeConfig = [
  { id: "realityPlanes" as CXDSectionId, label: "Reality\nPlanes", index: 0 },
  { id: "sensoryDomains" as CXDSectionId, label: "Sensory\nDomains", index: 1 },
  { id: "presence" as CXDSectionId, label: "Presence\nTypes", index: 2 },
  { id: "stateMapping" as CXDSectionId, label: "State\nMapping", index: 3 },
  { id: "traitMapping" as CXDSectionId, label: "Trait\nMapping", index: 4 },
  {
    id: "contextAndMeaning" as CXDSectionId,
    label: "Meaning\nArchitecture",
    index: 5,
  },
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
    updateCanvasElement,
    setCanvasViewMode,
    navigateToBoardPath,
    setActiveBoardId,
  } = useCXDStore();
  const project = getCurrentProject();
  const canvasElements = project?.canvasElements || [];
  const boards = project?.canvasBoards || [];

  const containerRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredWedge, setHoveredWedge] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<CXDSectionId | null>(
    null,
  );
  const [tooltipInfo, setTooltipInfo] = useState<{
    position: { x: number; y: number };
    constraints: Array<{ message: string; severity: 'warning' | 'info' }>;
  } | null>(null);
  
  // Focused face state for cube rotation
  const [focusedFaceIndex, setFocusedFaceIndex] = useState<number | null>(null);
  const [cubeRotation, setCubeRotation] = useState({ x: 0, y: 0 });
  const [isRotating, setIsRotating] = useState(false);
  
  // Related elements preview panel
  const [showRelatedElements, setShowRelatedElements] = useState(false);

  // Quick view modal state
  const [quickViewElement, setQuickViewElement] = useState<CanvasElement | null>(null);

  // Handle face click - focus mode with rotation
  const handleWedgeClick = (sectionId: CXDSectionId, wedgeIndex: number) => {
    // If already focused on this face, open detail panel
    if (focusedFaceIndex === wedgeIndex) {
      setSelectedSection(sectionId);
      return;
    }
    
    // Focus on this face - rotate cube to bring it front-center
    setIsRotating(true);
    setFocusedFaceIndex(wedgeIndex);
    setShowRelatedElements(true);
    
    // Calculate rotation to bring face to front
    // Each face is 60° apart (360° / 6)
    // Rotate so the selected face appears at the "front" (bottom-center)
    const targetRotation = wedgeIndex * 60;
    setCubeRotation({ x: 0, y: targetRotation });
    
    // Animation complete
    setTimeout(() => setIsRotating(false), 800);
  };

  const handleCoreClick = () => {
    // Reset rotation and show core panel
    setFocusedFaceIndex(null);
    setCubeRotation({ x: 0, y: 0 });
    setShowRelatedElements(false);
    setSelectedSection("intentionCore" as CXDSectionId);
  };

  const handleClosePanel = () => {
    setSelectedSection(null);
  };
  
  const handleCloseFocus = () => {
    setFocusedFaceIndex(null);
    setCubeRotation({ x: 0, y: 0 });
    setShowRelatedElements(false);
  };

  // Navigate to element on canvas
  const handleNavigateToElement = useCallback((elementId: string) => {
    console.log('handleNavigateToElement called with:', elementId);
    
    // canvasElements can be undefined during initial load/hydration or if store state changes
    const safeElements = Array.isArray(canvasElements) ? canvasElements : [];
    const element = safeElements.find((el: CanvasElement) => el.id === elementId);
    
    console.log('Found element:', element);
    console.log('All elements:', safeElements);
    
    if (!element) {
      console.warn('Element not found:', elementId);
      return;
    }

    // Find the board path to this element
    const elementBoardId = element.boardId;
    
    // If element is in a board, navigate to that board first
    if (elementBoardId) {
      console.log('Element is in board:', elementBoardId);
      
      // Build the path to the board
      const buildBoardPath = (targetBoardId: string): { id: string; title: string }[] => {
        const path: { id: string; title: string }[] = [];
        let currentBoardId: string | null = targetBoardId;
        
        while (currentBoardId) {
          const board = boards.find(b => b.id === currentBoardId);
          if (!board) break;
          
          path.unshift({ id: board.id, title: board.title });
          currentBoardId = board.parentBoardId;
        }
        
        return path;
      };
      
      const boardPath = buildBoardPath(elementBoardId);
      console.log('Board path:', boardPath);
      
      // Set the board path in the store first
      if (boardPath.length > 0) {
        // We need to set the board path manually before calling navigateToBoardPath
        useCXDStore.setState({
          boardPath,
          activeBoardId: elementBoardId,
          currentBoardId: elementBoardId,
        });
      }
    } else {
      // Element is on root canvas, navigate to root
      console.log('Element is on root canvas');
      navigateToBoardPath(-1); // -1 navigates to root
    }

    // Center canvas on element
    const elementCenterX = element.x + (element.width || 200) / 2;
    const elementCenterY = element.y + (element.height || 100) / 2;
    
    // Calculate new canvas position to center the element
    const viewportCenterX = window.innerWidth / 2;
    const viewportCenterY = (window.innerHeight - 64) / 2; // Account for navbar
    
    const targetPosition = {
      x: viewportCenterX - elementCenterX * canvasZoom,
      y: viewportCenterY - elementCenterY * canvasZoom,
    };
    
    console.log('Switching to canvas view mode, target position:', targetPosition);
    
    // Switch to canvas view mode - this should trigger a re-render and show CXDCanvas
    setCanvasViewMode('canvas');
    
    // Set position AFTER switching modes (on next tick) to avoid being overridden by restoreViewport
    setTimeout(() => {
      console.log('Setting canvas position after mode switch');
      setCanvasPosition(targetPosition);
      
      // Briefly highlight element (flash effect)
      const originalElement = { ...element };
      updateCanvasElement(elementId, { ...element, highlighted: true } as any);
      setTimeout(() => {
        updateCanvasElement(elementId, originalElement);
      }, 1000);
    }, 100); // Increased timeout to ensure view mode switch completes
  }, [canvasElements, boards, canvasZoom, setCanvasPosition, updateCanvasElement, setCanvasViewMode, navigateToBoardPath]);

  // Show quick view modal
  const handlePreviewElement = useCallback((element: CanvasElement) => {
    setQuickViewElement(element);
  }, []);

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

  // Escape key to close focus mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedSection) {
          handleClosePanel();
        } else if (focusedFaceIndex !== null) {
          handleCloseFocus();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSection, focusedFaceIndex]);

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

  // Handle mouse move for panning only
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
      }
    },
    [isPanning, panStart, canvasPosition, setCanvasPosition],
  );

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  if (!project) return null;

  // Get elements tagged to a specific face
  const getTaggedElementsForFace = useMemo(() => {
    const allElements = project.canvasElements || [];
    return (faceTag: HypercubeFaceTag) => {
      return allElements.filter((el) => el.hypercubeTags?.includes(faceTag));
    };
  }, [project.canvasElements]);

  // Soft constraint checking - detect structural misalignments
  // Returns constraint info with visual cues and optional tooltip
  const detectConstraints = (sectionId: CXDSectionId) => {
    const constraints: Array<{ message: string; severity: 'warning' | 'info' }> = [];
    const faceTag = SECTION_TO_TAG[sectionId];
    const taggedElements = faceTag ? getTaggedElementsForFace(faceTag) : [];

    switch (sectionId) {
      case "realityPlanes": {
        // Active Reality Plane without Interface/Modality defined
        const planesV2 = project.realityPlanesV2 || [];
        const activePlanes = planesV2.filter((p) => p.enabled);
        const missingInterface = activePlanes.filter(
          (p) => !p.interfaceModality || p.interfaceModality.trim().length === 0,
        );

        if (missingInterface.length > 0) {
          const planeNames = missingInterface.map((p) => p.code).join(', ');
          constraints.push({
            message: `${missingInterface.length} active plane${missingInterface.length > 1 ? 's' : ''} missing interface/modality (${planeNames})`,
            severity: 'warning',
          });
        }

        // Cognitive Reality active while Meaning Architecture is empty
        const cognitiveActive = activePlanes.some((p) => p.code === 'CR');
        const meaning = project.contextAndMeaning || {};
        const hasWorld = meaning.world && meaning.world.trim().length > 0;
        const hasStory = meaning.story && meaning.story.trim().length > 0;
        const hasMagic = meaning.magic && meaning.magic.trim().length > 0;
        const meaningEmpty = !hasWorld && !hasStory && !hasMagic;

        if (cognitiveActive && meaningEmpty) {
          constraints.push({
            message: 'Cognitive Reality active but Meaning Architecture is empty',
            severity: 'warning',
          });
        }

        // Reality Plane active with no tagged artifacts
        if (activePlanes.length > 0 && taggedElements.length === 0) {
          constraints.push({
            message: `${activePlanes.length} active plane${activePlanes.length > 1 ? 's' : ''} with no tagged canvas elements`,
            severity: 'info',
          });
        }
        break;
      }

      case "stateMapping": {
        // States defined without corresponding Traits
        const states = project.stateMapping || {};
        const traits = project.traitMapping || {};
        const stateValues = Object.values(states);
        const traitValues = Object.values(traits);
        const hasStates = stateValues.some((v) => v && v.trim().length > 0);
        const hasTraits = traitValues.some((v) => v && v.trim().length > 0);

        if (hasStates && !hasTraits) {
          constraints.push({
            message: 'States defined without corresponding Traits',
            severity: 'info',
          });
        }

        // States defined but no canvas elements tagged to State Mapping
        if (hasStates && taggedElements.length === 0) {
          constraints.push({
            message: 'States defined but no canvas elements tagged',
            severity: 'info',
          });
        }
        break;
      }

      case "traitMapping": {
        // Traits defined without corresponding States
        const states = project.stateMapping || {};
        const traits = project.traitMapping || {};
        const stateValues = Object.values(states);
        const traitValues = Object.values(traits);
        const hasStates = stateValues.some((v) => v && v.trim().length > 0);
        const hasTraits = traitValues.some((v) => v && v.trim().length > 0);

        if (hasTraits && !hasStates) {
          constraints.push({
            message: 'Traits defined without corresponding States',
            severity: 'info',
          });
        }

        // Traits defined without supporting boards or cards
        if (hasTraits && taggedElements.length === 0) {
          constraints.push({
            message: 'Traits defined without supporting canvas artifacts',
            severity: 'info',
          });
        }
        break;
      }

      case "sensoryDomains": {
        // Active sensory domains with no tagged elements
        const domains = project.sensoryDomains || {};
        const activeDomains = Object.entries(domains).filter(([_, v]) => v > 0);
        
        if (activeDomains.length > 0 && taggedElements.length === 0) {
          constraints.push({
            message: `${activeDomains.length} active domain${activeDomains.length > 1 ? 's' : ''} with no tagged elements`,
            severity: 'info',
          });
        }
        break;
      }

      case "presence": {
        // Active presence types with no tagged elements
        const types = project.presenceTypes || {};
        const activeTypes = Object.entries(types).filter(([_, v]) => v > 0);
        
        if (activeTypes.length > 0 && taggedElements.length === 0) {
          constraints.push({
            message: `${activeTypes.length} active presence type${activeTypes.length > 1 ? 's' : ''} with no tagged elements`,
            severity: 'info',
          });
        }
        break;
      }

      case "desiredChange": {
        // Objectives defined but Experience Flow is empty
        const desired = project.desiredChange || {};
        const hasObjectives =
          (desired.insights && desired.insights.length > 0) ||
          (desired.feelings && desired.feelings.length > 0) ||
          (desired.states && desired.states.length > 0) ||
          (desired.knowledge && desired.knowledge.length > 0);

        const flowStages = project.experienceFlowStages || [];
        const flowEmpty = flowStages.length === 0;

        if (hasObjectives && flowEmpty) {
          constraints.push({
            message: 'Desired outcomes defined but Experience Flow is empty',
            severity: 'info',
          });
        }
        break;
      }

      case "contextAndMeaning": {
        // Cognitive Reality active while Meaning Architecture is empty
        const planesV2 = project.realityPlanesV2 || [];
        const cognitiveActive = planesV2.some((p) => p.enabled && p.code === 'CR');
        const meaning = project.contextAndMeaning || {};
        const hasWorld = meaning.world && meaning.world.trim().length > 0;
        const hasStory = meaning.story && meaning.story.trim().length > 0;
        const hasMagic = meaning.magic && meaning.magic.trim().length > 0;
        const meaningEmpty = !hasWorld && !hasStory && !hasMagic;
        const hasMeaning = hasWorld || hasStory || hasMagic;

        if (cognitiveActive && meaningEmpty) {
          constraints.push({
            message: 'Cognitive Reality active but this architecture is undefined',
            severity: 'warning',
          });
        }

        // Meaning architecture defined but no tagged elements
        if (hasMeaning && taggedElements.length === 0) {
          constraints.push({
            message: 'Meaning architecture defined but no canvas elements tagged',
            severity: 'info',
          });
        }
        break;
      }
    }

    return constraints;
  };

  // Calculate visual intensity for each face based on experience structure
  // Returns { opacity: 0-1, glow: 0-1, saturation: 0-1, tint: optional color }
  const calculateFaceIntensity = (sectionId: CXDSectionId) => {
    const baseIntensity = { opacity: 0.4, glow: 0.2, saturation: 0.25 };
    const faceTag = SECTION_TO_TAG[sectionId];
    const taggedElements = faceTag ? getTaggedElementsForFace(faceTag) : [];
    const hasTaggedElements = taggedElements.length > 0;
    
    // Factor for reducing glow when content exists but no tags
    const tagBonus = hasTaggedElements ? 1.0 : 0.7;

    switch (sectionId) {
      case "realityPlanes": {
        // More active planes → brighter face
        // Active planes missing Interface/Modality → reduced brightness
        const planesV2 = project.realityPlanesV2 || [];
        const activePlanes = planesV2.filter((p) => p.enabled);
        const totalActive = activePlanes.length;
        const wellDefined = activePlanes.filter(
          (p) => p.interfaceModality && p.interfaceModality.trim().length > 0,
        ).length;

        const activityRatio = totalActive / 7; // 7 total planes
        const completionRatio = totalActive > 0 ? wellDefined / totalActive : 0;

        // Dimmed edge glow when active but no tagged artifacts
        const glowMultiplier = (totalActive > 0 && !hasTaggedElements) ? 0.5 : tagBonus;

        return {
          opacity: 0.3 + activityRatio * 0.5, // 0.3 to 0.8
          glow: activityRatio * completionRatio * 0.6 * glowMultiplier, // Bright when active, well-defined, and tagged
          saturation: 0.2 + activityRatio * 0.3,
        };
      }

      case "sensoryDomains": {
        // Similar to reality planes - more active domains → brighter
        const domains = project.sensoryDomains || {};
        const values = Object.values(domains);
        const activeCount = values.filter((v) => v > 0).length;
        const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;

        // Dimmed when active but no tagged elements
        const glowMultiplier = (activeCount > 0 && !hasTaggedElements) ? 0.6 : tagBonus;

        return {
          opacity: 0.3 + (activeCount / 5) * 0.4,
          glow: (avgValue / 100) * 0.5 * glowMultiplier,
          saturation: 0.2 + (activeCount / 5) * 0.25,
        };
      }

      case "presence": {
        // Balanced distribution → stable, even glow
        // One presence dominating → asymmetric highlight (show via increased glow)
        const types = project.presenceTypes || {};
        const values = Object.values(types).filter((v) => v > 0);
        if (values.length === 0)
          return { ...baseIntensity, opacity: 0.25 };

        const maxValue = Math.max(...values);
        const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
        const variance =
          values.reduce((sum, v) => sum + Math.pow(v - avgValue, 2), 0) /
          values.length;
        const balance = 1 - Math.min(variance / 1000, 1); // 0 = imbalanced, 1 = balanced

        // Dimmed when active but no tagged elements
        const glowMultiplier = (values.length > 0 && !hasTaggedElements) ? 0.6 : tagBonus;
        const baseGlow = balance > 0.6 ? 0.4 : 0.15 + (maxValue / 100) * 0.4;

        return {
          opacity: 0.3 + (values.length / 6) * 0.4,
          glow: baseGlow * glowMultiplier, // Stable glow when balanced
          saturation: 0.2 + (values.length / 6) * 0.3,
        };
      }

      case "stateMapping": {
        // States without Traits → subtle amber tint
        const states = project.stateMapping || {};
        const traits = project.traitMapping || {};
        const stateValues = Object.values(states);
        const traitValues = Object.values(traits);
        const hasStates = stateValues.some((v) => v && v.trim().length > 0);
        const hasTraits = traitValues.some((v) => v && v.trim().length > 0);

        if (!hasStates) return { ...baseIntensity, opacity: 0.2 };

        // Muted face when states exist but no tagged elements
        const tagDimmer = hasTaggedElements ? 1.0 : 0.65;

        // Amber tint when states exist but no traits
        if (hasStates && !hasTraits) {
          return {
            opacity: 0.45 * tagDimmer,
            glow: 0.15 * tagDimmer,
            saturation: 0.35 * tagDimmer,
            tint: "hsl(35 70% 50%)", // Subtle amber
          };
        }

        return {
          opacity: 0.5,
          glow: 0.35 * tagDimmer,
          saturation: 0.3,
        };
      }

      case "traitMapping": {
        // Traits without States → muted face appearance
        const states = project.stateMapping || {};
        const traits = project.traitMapping || {};
        const stateValues = Object.values(states);
        const traitValues = Object.values(traits);
        const hasStates = stateValues.some((v) => v && v.trim().length > 0);
        const hasTraits = traitValues.some((v) => v && v.trim().length > 0);

        if (!hasTraits) return { ...baseIntensity, opacity: 0.2 };

        // Further muted when no tagged elements support the traits
        const tagDimmer = hasTaggedElements ? 1.0 : 0.6;

        // Muted when traits exist but no states
        if (hasTraits && !hasStates) {
          return {
            opacity: 0.35 * tagDimmer,
            glow: 0.1 * tagDimmer,
            saturation: 0.15,
          };
        }

        return {
          opacity: 0.5,
          glow: 0.35 * tagDimmer,
          saturation: 0.3,
        };
      }

      case "contextAndMeaning": {
        // Empty → desaturated face
        // Structured → clear glow
        const meaning = project.contextAndMeaning || {};
        const hasWorld = meaning.world && meaning.world.trim().length > 0;
        const hasStory = meaning.story && meaning.story.trim().length > 0;
        const hasMagic = meaning.magic && meaning.magic.trim().length > 0;
        const structuredCount = [hasWorld, hasStory, hasMagic].filter(
          Boolean,
        ).length;

        if (structuredCount === 0) {
          return {
            opacity: 0.25,
            glow: 0.05,
            saturation: 0.1, // Desaturated
          };
        }

        // Dimmed glow when structured but no tagged elements
        const tagDimmer = hasTaggedElements ? 1.0 : 0.6;

        return {
          opacity: 0.3 + (structuredCount / 3) * 0.4,
          glow: (structuredCount / 3) * 0.5 * tagDimmer, // Clear glow when structured and tagged
          saturation: 0.15 + (structuredCount / 3) * 0.25,
        };
      }

      default:
        return baseIntensity;
    }
  };

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

  // Get tagged elements for the focused face
  const focusedFaceTag = focusedFaceIndex !== null ? SECTION_TO_TAG[wedgeConfig[focusedFaceIndex].id] : null;
  const focusedTaggedElements = focusedFaceTag ? getTaggedElementsForFace(focusedFaceTag) : [];
  const focusedGroupedElements = groupElementsByType(focusedTaggedElements);

  // 3D Cube View - new implementation
  if (USE_3D_CUBE) {
    return (
      <div className="fixed inset-0 top-16 overflow-hidden">
        {/* Dot grid background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(270 30% 25% / 0.3) 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
          }}
        />

        {/* 3D Hypercube - handles its own zoom and drag internally */}
        <Hypercube3D
          project={project}
          onSelectSection={(sectionId) => setSelectedSection(sectionId)}
          onCoreClick={handleCoreClick}
          selectedSection={selectedSection}
          onNavigateToElement={handleNavigateToElement}
          onPreviewElement={handlePreviewElement}
        />

        {/* Scrim overlay when panel is open */}
        {isPanelOpen && (
          <div
            className="fixed inset-0 top-16 bg-black/20 z-30 pointer-events-none"
            aria-hidden="true"
          />
        )}

        {/* Right side: Details Panel */}
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

        {/* Quick View Modal */}
        {quickViewElement && (
          <QuickViewModal
            element={quickViewElement}
            onClose={() => setQuickViewElement(null)}
            onNavigateToCanvas={() => {
              handleNavigateToElement(quickViewElement.id);
              setQuickViewElement(null);
            }}
          />
        )}
      </div>
    );
  }

  // Original 2D Hexagon View (fallback)
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
        {/* Canvas content with transform - includes cube rotation */}
        <div
          className="absolute will-change-transform"
          style={{
            transform: `translate(${canvasPosition.x}px, ${canvasPosition.y}px) scale(${canvasZoom})`,
            transformOrigin: "0 0",
            left: "calc(50% - 400px)",
            top: "calc(50% - 400px)",
            // Apply 3D perspective for cube effect
            perspective: "1200px",
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
                @keyframes focusedFaceGlow {
                  0%, 100% { filter: drop-shadow(0 0 15px hsl(180 80% 60%)); }
                  50% { filter: drop-shadow(0 0 25px hsl(180 80% 70%)); }
                }
                .focused-face {
                  animation: focusedFaceGlow 3s ease-in-out infinite;
                }
              `}
              </style>
            </defs>

            {/* SVG wrapper with rotation transform */}
            <g
              style={{
                transformOrigin: `${centerX}px ${centerY}px`,
                transform: `rotateZ(${cubeRotation.y}deg)`,
                transition: isRotating ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
              }}
            >
            {/* Outer hexagon border */}
            <polygon
              points={hexagonPoints(centerX, centerY, outerRadius)}
              fill="none"
              stroke="hsl(270 30% 40%)"
              strokeWidth="3"
              style={{
                opacity: focusedFaceIndex !== null ? 0.5 : 1,
                transition: 'opacity 0.5s ease',
              }}
            />

            {/* 6 Wedge segments with labels */}
            {wedgeConfig.map((wedge, i) => {
              const isHovered = hoveredWedge === i;
              const isFocused = focusedFaceIndex === i;
              const isDimmed = focusedFaceIndex !== null && focusedFaceIndex !== i;
              const intensity = calculateFaceIntensity(wedge.id);
              const constraints = detectConstraints(wedge.id);
              const hasConstraints = constraints.length > 0;
              const hasWarning = constraints.some((c) => c.severity === 'warning');

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
              const filterId = `glow-${wedge.id}`;
              const pulseId = `pulse-${wedge.id}`;

              // Apply constraint visual adjustments
              // Warning: slight amber shift, reduced opacity, gentle pulse
              // Info: slight desaturation, no pulse
              let baseLightness = isHovered ? 32 : 25;
              let saturation = 25 + intensity.saturation * 40;
              let hue = 270; // Purple base

              if (hasConstraints) {
                if (hasWarning) {
                  hue = 35; // Shift to amber
                  baseLightness -= 3; // Slightly dimmer
                  saturation = Math.max(20, saturation - 10); // Less saturated
                } else {
                  saturation = Math.max(15, saturation - 15); // More desaturated for info
                  baseLightness -= 2;
                }
              }
              
              // Focused face gets cyan tint
              if (isFocused) {
                hue = 180; // Cyan
                baseLightness += 10;
                saturation = 50;
              }

              const lightness = baseLightness + intensity.opacity * 15;
              const baseColor = `hsl(${hue} ${saturation}% ${lightness}%)`;
              
              // Calculate opacity with dimming for non-focused faces
              const dimmedOpacity = isDimmed ? intensity.opacity * 0.4 : intensity.opacity;
              const focusScale = isFocused ? 1.05 : 1;

              return (
                <g key={wedge.id}>
                  {/* Define glow filter for this wedge */}
                  <defs>
                    <filter
                      id={filterId}
                      x="-50%"
                      y="-50%"
                      width="200%"
                      height="200%"
                    >
                      <feGaussianBlur
                        stdDeviation={5 + intensity.glow * 10}
                        result="blur"
                      />
                      <feFlood
                        floodColor={intensity.tint || `hsl(${hue} 80% 60%)`}
                        floodOpacity={intensity.glow}
                        result="color"
                      />
                      <feComposite
                        in="color"
                        in2="blur"
                        operator="in"
                        result="glow"
                      />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    {/* Pulse animation for warnings */}
                    {hasWarning && (
                      <style>
                        {`
                          @keyframes ${pulseId} {
                            0%, 100% { opacity: ${intensity.opacity * 0.9}; }
                            50% { opacity: ${intensity.opacity * 0.7}; }
                          }
                          .${pulseId} {
                            animation: ${pulseId} 3s ease-in-out infinite;
                          }
                        `}
                      </style>
                    )}
                  </defs>

                  {/* Wedge shape with dynamic visual intensity */}
                  <path
                    d={wedgePath}
                    fill={baseColor}
                    fillOpacity={dimmedOpacity}
                    stroke={isFocused ? "hsl(180 60% 50%)" : hasWarning ? `hsl(${hue} 40% 45%)` : "hsl(270 30% 40%)"}
                    strokeWidth={isFocused ? "2.5" : "1.5"}
                    strokeOpacity={isDimmed ? 0.3 : 0.6 + intensity.opacity * 0.4}
                    filter={intensity.glow > 0.1 && !isDimmed ? `url(#${filterId})` : undefined}
                    className={`hex-wedge cursor-pointer transition-all duration-500 ${hasWarning && !isDimmed ? pulseId : ''} ${isFocused ? 'focused-face' : ''}`}
                    style={{
                      transformOrigin: `${center.x}px ${center.y}px`,
                      transform: `scale(${focusScale})`,
                      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => {
                      setHoveredWedge(i);
                      if (hasConstraints && !isDimmed) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setTooltipInfo({
                          position: {
                            x: rect.left + rect.width / 2,
                            y: rect.top,
                          },
                          constraints,
                        });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredWedge(null);
                      setTooltipInfo(null);
                    }}
                    onClick={() => handleWedgeClick(wedge.id, i)}
                  />

                  {/* Optional tint overlay for special states */}
                  {intensity.tint && !hasConstraints && (
                    <path
                      d={wedgePath}
                      fill={intensity.tint}
                      fillOpacity={0.15}
                      pointerEvents="none"
                    />
                  )}

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
                        fill={isFocused ? "hsl(180 80% 95%)" : "hsl(0 0% 90%)"}
                        fillOpacity={isDimmed ? 0.3 : 0.7 + intensity.opacity * 0.3}
                        fontSize={isFocused ? "12" : "11"}
                        fontWeight={isFocused ? "700" : "600"}
                        className="uppercase tracking-wider"
                        style={{
                          transition: 'all 0.5s ease',
                        }}
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
            </g>
          </svg>
        </div>
        {/* Zoom Controls - Read-only navigation */}
        <NavigationToolkit
          canvasZoom={canvasZoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetView={handleResetView}
          onFitAll={handleFitAll}
        />

        {/* Constraint tooltip - appears on hover */}
        {tooltipInfo && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltipInfo.position.x,
              top: tooltipInfo.position.y - 10,
              transform: 'translateX(-50%) translateY(-100%)',
            }}
          >
            <div className="px-3 py-2 rounded-lg bg-card/95 backdrop-blur border border-border shadow-xl max-w-xs">
              {tooltipInfo.constraints.map((constraint, idx) => (
                <div
                  key={idx}
                  className={`text-sm ${idx > 0 ? 'mt-1 pt-1 border-t border-border/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`inline-block w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        constraint.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-blue-400'
                      }`}
                    />
                    <span className="text-muted-foreground leading-relaxed">
                      {constraint.message}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {/* Related Elements Preview Panel - shown when face is focused */}
      {showRelatedElements && focusedFaceIndex !== null && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 max-w-lg w-full mx-4"
        >
          <div className="bg-card/95 backdrop-blur-xl rounded-xl border border-cyan-500/30 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-sm font-semibold text-foreground">
                  {wedgeConfig[focusedFaceIndex].label.replace('\n', ' ')}
                </span>
                <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-full">
                  {focusedTaggedElements.length} element{focusedTaggedElements.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedSection(wedgeConfig[focusedFaceIndex].id)}
                  className="px-3 py-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded-md transition-colors"
                >
                  Open Details
                </button>
                <button
                  onClick={handleCloseFocus}
                  className="p-1 hover:bg-primary/20 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4 rotate-90" />
                </button>
              </div>
            </div>
            
            {/* Content */}
            <div className="px-4 py-3 max-h-48 overflow-y-auto">
              {focusedTaggedElements.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-muted-foreground text-sm">
                    No canvas elements tagged to this face
                  </div>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Use "Tag to Hypercube" in element context menu on canvas
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(focusedGroupedElements).map(([type, elements]) => {
                    if (elements.length === 0) return null;
                    
                    const Icon = ELEMENT_TYPE_ICONS[type] || Box;
                    const typeLabel = type === 'experienceBlock' 
                      ? 'Experience Blocks' 
                      : type === 'freeform'
                      ? 'Cards'
                      : `${type.charAt(0).toUpperCase() + type.slice(1)}s`;
                    
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
                          <Icon className="w-3.5 h-3.5" />
                          <span>{typeLabel}</span>
                          <span className="text-muted-foreground/60">({elements.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {elements.slice(0, 6).map((element) => (
                            <div
                              key={element.id}
                              className="px-2.5 py-1.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-sm text-foreground truncate max-w-[150px]"
                              title={getElementDisplayName(element)}
                            >
                              {getElementDisplayName(element)}
                            </div>
                          ))}
                          {elements.length > 6 && (
                            <div className="px-2.5 py-1.5 rounded-md bg-primary/10 text-sm text-muted-foreground">
                              +{elements.length - 6} more
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
      )}

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
    </div>
  );
}
