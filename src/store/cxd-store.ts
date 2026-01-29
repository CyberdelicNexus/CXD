'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  CXDProject,
  createDefaultProject,
  RealityPlaneCode,
  RealityPlaneV2,
  DEFAULT_REALITY_PLANES_V2,
  SensoryDomainCode,
  PresenceTypeCode,
  ExperienceFlowStageCode,
  StateQuadrantCode,
  TraitQuadrantCode,
  CXDSectionId,
  EngagementDistribution,
  DEFAULT_ENGAGEMENT_DISTRIBUTION,
  ExperienceFlowStageV2,
  DEFAULT_EXPERIENCE_FLOW_STAGES,
  StagePresenceTypes,
  DEFAULT_STAGE_PRESENCE_TYPES,
} from '@/types/cxd-schema';
import type { CanvasElement, CanvasEdge, CanvasBoard } from '@/types/canvas-elements';
import { saveProject, deleteProjectFromDb, updateProjectShareToken } from '@/lib/supabase-projects';

export type ViewMode = 'home' | 'wizard' | 'canvas' | 'focus' | 'share';

// Viewport state for pan/zoom per canvas context
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

// Default viewport for Hypercube (centered at 95% zoom)
const HYPERCUBE_DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.95 };
// Default viewport for canvas/boards
const CANVAS_DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 0.8 };

// History entry for undo/redo
interface CanvasHistoryEntry {
  elements: CanvasElement[];
  edges: CanvasEdge[];
  timestamp: number;
}

const MAX_HISTORY_SIZE = 50;

interface CXDState {
  // Current view state
  viewMode: ViewMode;
  focusedSection: CXDSectionId | null;
  canvasViewMode: 'canvas' | 'hexagon' | 'hypercube' | 'plan';
  
  // Active surface state - determines which surface (canvas vs hypercube) elements are created in
  activeSurface: 'canvas' | 'hypercube';
  
  // Projects
  projects: CXDProject[];
  currentProjectId: string | null;
  
  // Canvas state
  canvasPosition: { x: number; y: number };
  canvasZoom: number;
  
  // Per-canvas viewport persistence (keyed by canvasId: "root" or boardId)
  viewportByCanvasId: Record<string, Viewport>;
  
  // Board navigation state - SINGLE SOURCE OF TRUTH
  activeBoardId: string | null; // null = root canvas - this is the SINGLE source of truth
  currentBoardId: string | null; // alias for activeBoardId (backward compatibility)
  boardPath: { id: string; title: string }[]; // breadcrumb path
  
  // Highlighted element (for navigation from hypercube)
  highlightedElementId: string | null;
  
  // Actions - View
  setViewMode: (mode: ViewMode) => void;
  setFocusedSection: (section: CXDSectionId | null) => void;
  setCanvasViewMode: (mode: 'canvas' | 'hexagon' | 'hypercube' | 'plan') => void;
  setActiveSurface: (surface: 'canvas' | 'hypercube') => void;
  setHighlightedElementId: (elementId: string | null) => void;
  highlightElementBriefly: (elementId: string, durationMs?: number) => void;
  
  // Actions - Projects
  createProject: (name: string, ownerId: string) => string;
  loadProject: (id: string) => void;
  deleteProject: (id: string) => void;
  getCurrentProject: () => CXDProject | null;
  setProjects: (projects: CXDProject[]) => void;
  syncProjectToDb: (project: CXDProject) => void;
  
  // Actions - Canvas
  setCanvasPosition: (position: { x: number; y: number }) => void;
  setCanvasZoom: (zoom: number) => void;
  
  // Actions - Viewport persistence
  saveCurrentViewport: () => void;
  restoreViewport: (canvasId: string) => void;
  getCanvasId: () => string;
  resetHypercubeViewport: () => void;
  
  // Actions - Wizard
  setWizardStep: (step: number) => void;
  completeWizard: () => void;
  
  // Actions - Reality Planes (Legacy percentage-based)
  updateRealityPlane: (code: RealityPlaneCode, value: number) => void;
  
  // Actions - Reality Planes V2 (Toggle-based with interface/modality and priority)
  getRealityPlanesV2: () => RealityPlaneV2[];
  toggleRealityPlane: (code: RealityPlaneCode) => void;
  updateRealityPlaneInterface: (code: RealityPlaneCode, interfaceModality: string) => void;
  reorderRealityPlanes: (newOrder: RealityPlaneCode[]) => void;
  
  // Actions - Sensory Domains
  updateSensoryDomain: (code: SensoryDomainCode, value: number) => void;
  
  // Actions - Presence Types
  updatePresenceType: (code: PresenceTypeCode, value: number) => void;
  
  // Actions - Experience Flow
  updateExperienceFlowEngagement: (code: ExperienceFlowStageCode, value: number) => void;
  updateExperienceFlowDistribution: (code: ExperienceFlowStageCode, distribution: EngagementDistribution) => void;
  updateExperienceFlowNarrative: (code: ExperienceFlowStageCode, value: string) => void;
  updateExperienceFlowIntent: (code: ExperienceFlowStageCode, value: string) => void;
  
  // Actions - Experience Flow Stages (V2 array-based)
  getExperienceFlowStages: () => ExperienceFlowStageV2[];
  addExperienceFlowStage: (afterIndex: number) => void;
  removeExperienceFlowStage: (stageId: string) => void;
  renameExperienceFlowStage: (stageId: string, newName: string) => void;
  moveExperienceFlowStage: (stageId: string, direction: 'left' | 'right') => void;
  reorderExperienceFlowStage: (stageId: string, newIndex: number) => void;
  updateExperienceFlowStageDistribution: (stageId: string, distribution: EngagementDistribution) => void;
  updateExperienceFlowStageNarrative: (stageId: string, value: string) => void;
  updateExperienceFlowStagePresence: (stageId: string, presenceTypes: StagePresenceTypes) => void;
  updateExperienceFlowStageTime: (stageId: string, estimatedMinutes: number | null) => void;
  
  // Actions - State Mapping
  updateStateMapping: (code: StateQuadrantCode, value: string) => void;
  
  // Actions - Trait Mapping
  updateTraitMapping: (code: TraitQuadrantCode, value: string) => void;
  
  // Actions - Context and Meaning
  updateContextWorld: (value: string) => void;
  updateContextStory: (value: string) => void;
  updateContextMagic: (value: string) => void;
  
  // Actions - Intention Core
  updateIntentionProjectName: (value: string) => void;
  updateIntentionMainConcept: (value: string) => void;
  updateIntentionCoreMessage: (value: string) => void;
  
  // Actions - Desired Change
  updateDesiredInsights: (value: string) => void;
  updateDesiredFeelings: (value: string) => void;
  updateDesiredStates: (value: string) => void;
  updateDesiredKnowledge: (value: string) => void;
  
  // Actions - Human Context
  updateHumanAudienceNeeds: (value: string) => void;
  updateHumanAudienceDesires: (value: string) => void;
  updateHumanUserRole: (value: string) => void;
  
  // Actions - Project metadata
  updateProjectName: (name: string) => void;
  updateProjectDescription: (description: string) => void;
  
  // Actions - Experience Flow Description (simplified wizard)
  updateExperienceFlowDescription: (value: string) => void;
  
  // Actions - Canvas Layout
  updateCanvasLayout: (elementId: string, position: { x: number; y: number }) => void;
  
  // Actions - Canvas Elements
  addCanvasElement: (element: CanvasElement) => void;
  updateCanvasElement: (elementId: string, updates: Partial<CanvasElement>) => void;
  removeCanvasElement: (elementId: string) => void;
  getCanvasElements: () => CanvasElement[];
  duplicateCanvasElement: (elementId: string) => void;
  
  // Actions - Canvas Edges (Connectors)
  addCanvasEdge: (edge: CanvasEdge) => void;
  updateCanvasEdge: (edgeId: string, updates: Partial<CanvasEdge>) => void;
  removeCanvasEdge: (edgeId: string) => void;
  getCanvasEdges: () => CanvasEdge[];
  
  // Actions - Board Navigation
  enterBoard: (boardId: string, title: string) => void;
  exitBoard: () => void;
  navigateToBoardPath: (index: number) => void;
  createBoard: (title: string) => string;
  setActiveBoardId: (boardId: string | null) => void;
  getActiveBoardId: () => string | null;
  
  // Actions - Container Management
  addNodeToContainer: (nodeId: string, containerId: string) => void;
  removeNodeFromContainer: (nodeId: string) => void;
  moveContainerWithChildren: (containerId: string, deltaX: number, deltaY: number) => void;
  
  // Actions - Share
  generateShareToken: () => string;
  
  // Actions - Undo/Redo
  canvasHistory: CanvasHistoryEntry[];
  canvasHistoryIndex: number;
  pushCanvasHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useCXDStore = create<CXDState>()(
  persist(
    (set, get) => ({
      // Initial state
      viewMode: 'home',
      focusedSection: null,
      canvasViewMode: 'canvas',
      activeSurface: 'canvas', // default to canvas surface
      projects: [],
      currentProjectId: null,
      canvasPosition: { x: 0, y: 0 },
      canvasZoom: 0.8,
      viewportByCanvasId: {},
      activeBoardId: null,
      currentBoardId: null, // backward compatibility alias
      boardPath: [],
      highlightedElementId: null,
      canvasHistory: [],
      canvasHistoryIndex: -1,
      
      // View actions
      setViewMode: (mode) => set({ viewMode: mode }),
      setFocusedSection: (section) => set({ focusedSection: section, viewMode: section ? 'focus' : 'canvas' }),
      setCanvasViewMode: (mode) => {
        const { canvasViewMode: currentMode, saveCurrentViewport, restoreViewport, resetHypercubeViewport, getCanvasId } = get();
        
        // Save current viewport before switching (only if leaving canvas mode)
        if (currentMode === 'canvas' && mode === 'hexagon') {
          saveCurrentViewport();
        }
        
        // When switching canvas view mode, also update activeSurface
        const newSurface = mode === 'hexagon' ? 'hypercube' : 'canvas';
        set({ canvasViewMode: mode, activeSurface: newSurface });
        
        // Apply appropriate viewport
        if (mode === 'hexagon') {
          // Always reset to centered 95% zoom when entering hypercube
          resetHypercubeViewport();
        } else if (currentMode === 'hexagon') {
          // Restore canvas viewport when leaving hypercube
          const canvasId = getCanvasId();
          restoreViewport(canvasId);
        }
      },
      setActiveSurface: (surface) => set({ activeSurface: surface }),
      setHighlightedElementId: (elementId) => set({ highlightedElementId: elementId }),
      highlightElementBriefly: (elementId, durationMs = 2000) => {
        set({ highlightedElementId: elementId });
        setTimeout(() => {
          // Only clear if still the same element
          const { highlightedElementId: currentId } = get();
          if (currentId === elementId) {
            set({ highlightedElementId: null });
          }
        }, durationMs);
      },
      
      // Project actions
      createProject: (name, ownerId) => {
        const id = uuidv4();
        const project = createDefaultProject(id, name, ownerId);
        set((state) => ({
          projects: [...state.projects, project],
          currentProjectId: id,
          viewMode: 'wizard',
        }));
        // Sync to database (async)
        saveProject(project).catch(err => console.error('Failed to save new project:', err));
        return id;
      },
      
      loadProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (project) {
          set({
            currentProjectId: id,
            viewMode: project.wizardCompleted ? 'canvas' : 'wizard',
          });
        }
      },
      
      deleteProject: (id) => {
        deleteProjectFromDb(id);
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProjectId: state.currentProjectId === id ? null : state.currentProjectId,
          viewMode: state.currentProjectId === id ? 'home' : state.viewMode,
        }));
      },
      
      setProjects: (projects) => set({ projects }),
      
      syncProjectToDb: (project) => {
        saveProject(project);
      },
      
      getCurrentProject: () => {
        const { projects, currentProjectId } = get();
        const project = projects.find((p) => p.id === currentProjectId) || null;
        if (project) {
          // Migration: ensure engagementDistribution exists on all stages
          const stageKeys = ['preparation', 'induction', 'journey', 'peak', 'integration'] as const;
          for (const key of stageKeys) {
            if (!project.experienceFlow[key].engagementDistribution) {
              project.experienceFlow[key].engagementDistribution = { ...DEFAULT_ENGAGEMENT_DISTRIBUTION };
            }
          }
          // Migration: ensure experienceFlowStages array exists
          if (!project.experienceFlowStages || project.experienceFlowStages.length === 0) {
            project.experienceFlowStages = stageKeys.map(key => ({
              id: key,
              name: project.experienceFlow[key].label,
              narrativeNotes: project.experienceFlow[key].narrativeNotes || '',
              engagementDistribution: project.experienceFlow[key].engagementDistribution || { ...DEFAULT_ENGAGEMENT_DISTRIBUTION },
              presenceTypes: { ...DEFAULT_STAGE_PRESENCE_TYPES },
              designIntent: project.experienceFlow[key].designIntent || '',
              estimatedMinutes: null,
            }));
          } else {
            // Migration: ensure presenceTypes and estimatedMinutes exists on all stages
            for (const stage of project.experienceFlowStages) {
              if (!stage.presenceTypes) {
                stage.presenceTypes = { ...DEFAULT_STAGE_PRESENCE_TYPES };
              }
              if (stage.estimatedMinutes === undefined) {
                stage.estimatedMinutes = null;
              }
            }
          }
          // Migration: presence types from old keys to new keys
          const oldPresenceKeys = ['spatial', 'self', 'temporal', 'narrative'] as const;
          const newPresenceKeys = ['mental', 'emotional', 'social', 'embodied', 'environmental', 'active'] as const;
          const hasOldKeys = oldPresenceKeys.some(k => k in project.presenceTypes);
          const hasMissingNewKeys = newPresenceKeys.some(k => !(k in project.presenceTypes));
          if (hasOldKeys || hasMissingNewKeys) {
            const oldValues = project.presenceTypes as Record<string, number>;
            project.presenceTypes = {
              mental: oldValues.mental ?? oldValues.spatial ?? 50,
              emotional: oldValues.emotional ?? oldValues.self ?? 50,
              social: oldValues.social ?? 50,
              embodied: oldValues.embodied ?? oldValues.temporal ?? 50,
              environmental: oldValues.environmental ?? 50,
              active: oldValues.active ?? oldValues.narrative ?? 50,
            };
          }
          // Migration: ensure canvasLayout exists
          if (!project.canvasLayout) {
            project.canvasLayout = {};
          }
          // Migration: ensure experienceFlowDescription exists
          if (project.experienceFlowDescription === undefined) {
            project.experienceFlowDescription = '';
          }
        }
        return project;
      },
      
      // Canvas actions
      setCanvasPosition: (position) => {
        set({ canvasPosition: position });
        // Auto-save viewport when position changes (only for canvas view, not hypercube)
        const { canvasViewMode } = get();
        if (canvasViewMode !== 'hexagon') {
          get().saveCurrentViewport();
        }
      },
      setCanvasZoom: (zoom) => {
        set({ canvasZoom: Math.max(0.1, Math.min(2, zoom)) });
        // Auto-save viewport when zoom changes (only for canvas view, not hypercube)
        const { canvasViewMode } = get();
        if (canvasViewMode !== 'hexagon') {
          get().saveCurrentViewport();
        }
      },
      
      // Viewport persistence actions
      getCanvasId: () => {
        const { activeBoardId } = get();
        return activeBoardId || 'root';
      },
      
      saveCurrentViewport: () => {
        const { canvasPosition, canvasZoom, canvasViewMode } = get();
        // Don't save viewport when in hypercube mode
        if (canvasViewMode === 'hexagon') return;
        
        const canvasId = get().getCanvasId();
        set((state) => ({
          viewportByCanvasId: {
            ...state.viewportByCanvasId,
            [canvasId]: {
              x: canvasPosition.x,
              y: canvasPosition.y,
              zoom: canvasZoom,
            },
          },
        }));
      },
      
      restoreViewport: (canvasId: string) => {
        const { viewportByCanvasId } = get();
        const savedViewport = viewportByCanvasId[canvasId];
        
        if (savedViewport) {
          set({
            canvasPosition: { x: savedViewport.x, y: savedViewport.y },
            canvasZoom: savedViewport.zoom,
          });
        } else {
          // Use default viewport if none saved
          set({
            canvasPosition: { x: CANVAS_DEFAULT_VIEWPORT.x, y: CANVAS_DEFAULT_VIEWPORT.y },
            canvasZoom: CANVAS_DEFAULT_VIEWPORT.zoom,
          });
        }
      },
      
      resetHypercubeViewport: () => {
        set({
          canvasPosition: { x: HYPERCUBE_DEFAULT_VIEWPORT.x, y: HYPERCUBE_DEFAULT_VIEWPORT.y },
          canvasZoom: HYPERCUBE_DEFAULT_VIEWPORT.zoom,
        });
      },
      
      // Wizard actions
      setWizardStep: (step) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, currentWizardStep: step, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      completeWizard: () => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, wizardCompleted: true, updatedAt: new Date().toISOString() }
                : p
            ),
            viewMode: 'canvas',
          }));
        }
      },
      
      // Reality Planes (Legacy percentage-based)
      updateRealityPlane: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    realityPlanes: { ...p.realityPlanes, [code]: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Reality Planes V2 (Toggle-based with interface/modality and priority)
      getRealityPlanesV2: () => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return [...DEFAULT_REALITY_PLANES_V2];
        return currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
      },
      
      toggleRealityPlane: (code) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const currentPlanes = currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
          const updatedPlanes = currentPlanes.map((plane) =>
            plane.code === code ? { ...plane, enabled: !plane.enabled } : plane
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    realityPlanesV2: updatedPlanes,
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateRealityPlaneInterface: (code, interfaceModality) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const currentPlanes = currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
          const updatedPlanes = currentPlanes.map((plane) =>
            plane.code === code ? { ...plane, interfaceModality } : plane
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    realityPlanesV2: updatedPlanes,
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      reorderRealityPlanes: (newOrder) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const currentPlanes = currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
          const reorderedPlanes = newOrder.map((code, index) => {
            const plane = currentPlanes.find((p) => p.code === code);
            return plane ? { ...plane, priority: index } : { code, enabled: false, interfaceModality: '', priority: index };
          });
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    realityPlanesV2: reorderedPlanes,
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Sensory Domains
      updateSensoryDomain: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    sensoryDomains: { ...p.sensoryDomains, [code]: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Presence Types
      updatePresenceType: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    presenceTypes: { ...p.presenceTypes, [code]: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Experience Flow
      updateExperienceFlowEngagement: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    experienceFlow: {
                      ...p.experienceFlow,
                      [code]: { ...p.experienceFlow[code], engagementLevel: value },
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowDistribution: (code, distribution) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    experienceFlow: {
                      ...p.experienceFlow,
                      [code]: { 
                        ...p.experienceFlow[code], 
                        engagementDistribution: distribution,
                      },
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowNarrative: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    experienceFlow: {
                      ...p.experienceFlow,
                      [code]: { ...p.experienceFlow[code], narrativeNotes: value },
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowIntent: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    experienceFlow: {
                      ...p.experienceFlow,
                      [code]: { ...p.experienceFlow[code], designIntent: value },
                    },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Experience Flow Stages (V2 array-based)
      getExperienceFlowStages: () => {
        const project = get().getCurrentProject();
        return project?.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES;
      },
      
      addExperienceFlowStage: (afterIndex) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = [...(currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES)];
          const newStage: ExperienceFlowStageV2 = {
            id: uuidv4(),
            name: 'New Stage',
            narrativeNotes: '',
            engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 },
            presenceTypes: { mental: 50, emotional: 50, social: 0, embodied: 0, environmental: 0, active: 0 },
            designIntent: '',
            estimatedMinutes: null,
          };
          stages.splice(afterIndex + 1, 0, newStage);
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      removeExperienceFlowStage: (stageId) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES;
          if (stages.length <= 1) return; // Prevent deleting last stage
          const newStages = stages.filter((s) => s.id !== stageId);
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: newStages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      renameExperienceFlowStage: (stageId, newName) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = (currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES).map((s) =>
            s.id === stageId ? { ...s, name: newName } : s
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      moveExperienceFlowStage: (stageId, direction) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = [...(currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES)];
          const index = stages.findIndex((s) => s.id === stageId);
          if (index === -1) return;
          const newIndex = direction === 'left' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= stages.length) return;
          [stages[index], stages[newIndex]] = [stages[newIndex], stages[index]];
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      reorderExperienceFlowStage: (stageId, newIndex) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = [...(currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES)];
          const oldIndex = stages.findIndex((s) => s.id === stageId);
          if (oldIndex === -1 || oldIndex === newIndex) return;
          if (newIndex < 0 || newIndex >= stages.length) return;
          const [removed] = stages.splice(oldIndex, 1);
          stages.splice(newIndex, 0, removed);
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowStageDistribution: (stageId, distribution) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = (currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES).map((s) =>
            s.id === stageId ? { ...s, engagementDistribution: distribution } : s
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowStageNarrative: (stageId, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = (currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES).map((s) =>
            s.id === stageId ? { ...s, narrativeNotes: value } : s
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowStagePresence: (stageId, presenceTypes) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = (currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES).map((s) =>
            s.id === stageId ? { ...s, presenceTypes } : s
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      updateExperienceFlowStageTime: (stageId, estimatedMinutes) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const stages = (currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES).map((s) =>
            s.id === stageId ? { ...s, estimatedMinutes } : s
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowStages: stages, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      // State Mapping
      updateStateMapping: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    stateMapping: { ...p.stateMapping, [code]: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Trait Mapping
      updateTraitMapping: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    traitMapping: { ...p.traitMapping, [code]: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Context and Meaning
      updateContextWorld: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    contextAndMeaning: { ...p.contextAndMeaning, world: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateContextStory: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    contextAndMeaning: { ...p.contextAndMeaning, story: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateContextMagic: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    contextAndMeaning: { ...p.contextAndMeaning, magic: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Intention Core
      updateIntentionProjectName: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    name: value,
                    intentionCore: { ...p.intentionCore, projectName: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateIntentionMainConcept: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    intentionCore: { ...p.intentionCore, mainConcept: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateIntentionCoreMessage: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    intentionCore: { ...p.intentionCore, coreMessage: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Desired Change
      updateDesiredInsights: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    desiredChange: { ...p.desiredChange, insights: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateDesiredFeelings: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    desiredChange: { ...p.desiredChange, feelings: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateDesiredStates: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    desiredChange: { ...p.desiredChange, states: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateDesiredKnowledge: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    desiredChange: { ...p.desiredChange, knowledge: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Human Context
      updateHumanAudienceNeeds: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    humanContext: { ...p.humanContext, audienceNeeds: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateHumanAudienceDesires: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    humanContext: { ...p.humanContext, audienceDesires: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      updateHumanUserRole: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    humanContext: { ...p.humanContext, userRole: value },
                    updatedAt: new Date().toISOString(),
                  }
                : p
            ),
          }));
        }
      },
      
      // Project metadata
      updateProjectName: (name) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, name, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      updateProjectDescription: (description) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, description, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      // Experience Flow Description (simplified wizard)
      updateExperienceFlowDescription: (value) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowDescription: value, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },
      
      // Canvas Layout
      updateCanvasLayout: (elementId, position) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: { 
                      ...(p.canvasLayout || {}),
                      sectionPositions: {
                        ...(p.canvasLayout?.sectionPositions || {}),
                        [elementId]: position
                      }
                    }, 
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      // Canvas Elements
      addCanvasElement: (element) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          get().pushCanvasHistory(); // Save state before adding
          // Ensure element has the correct boardId and surface
          const elementWithBoardAndSurface = {
            ...element,
            boardId: element.boardId !== undefined ? element.boardId : get().activeBoardId,
            surface: element.surface !== undefined ? element.surface : get().activeSurface,
          };
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      elements: [...(p.canvasLayout?.elements || []), elementWithBoardAndSurface]
                    },
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      updateCanvasElement: (elementId, updates) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const elements = currentProject.canvasElements || [];
          const element = elements.find(el => el.id === elementId);
          
          // If element has a container, check if we need to expand the container
          if (element?.containerId) {
            const container = elements.find(el => el.id === element.containerId);
            if (container && container.type === 'container') {
              // Calculate the new bounds of the child element
              const newX = updates.x !== undefined ? updates.x : element.x;
              const newY = updates.y !== undefined ? updates.y : element.y;
              const newWidth = updates.width !== undefined ? updates.width : element.width;
              const newHeight = updates.height !== undefined ? updates.height : element.height;
              
              const padding = 20;
              const headerHeight = 40;
              
              // Calculate required container size
              const neededWidth = Math.max(
                container.width,
                newX + newWidth - container.x + padding
              );
              const neededHeight = Math.max(
                container.height,
                newY + newHeight - container.y + padding + headerHeight
              );
              
              // Update both the element and container if expansion is needed
              set((state) => ({
                projects: state.projects.map((p) =>
                  p.id === currentProject.id
                    ? {
                        ...p,
                        canvasLayout: {
                          ...(p.canvasLayout || {}),
                          elements: (p.canvasLayout?.elements || []).map((el) => {
                            if (el.id === elementId) {
                              return { ...el, ...updates } as typeof el;
                            }
                            if (el.id === element.containerId && 
                                (neededWidth > container.width || neededHeight > container.height)) {
                              return { 
                                ...el, 
                                width: neededWidth,
                                height: neededHeight 
                              };
                            }
                            return el;
                          })
                        },
                        updatedAt: new Date().toISOString()
                      }
                    : p
                ),
              }));
              return;
            }
          }
          
          // Check if this is a board element with a title update - sync title to the board object
          const isBoardElement = element?.type === 'board';
          const isTitleUpdate = updates.hasOwnProperty('title');
          
          // Normal update without container logic
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                    ...p,
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      elements: (p.canvasLayout?.elements || []).map((el) =>
                        el.id === elementId ? { ...el, ...updates } as typeof el : el
                      ),
                      boards: isBoardElement && isTitleUpdate && element.type === 'board'
                        ? (p.canvasLayout?.boards || []).map((board) =>
                            board.id === (element as any).childBoardId
                              ? { ...board, title: (updates as any).title }
                              : board
                          )
                        : p.canvasLayout?.boards
                    },
                    updatedAt: new Date().toISOString()
                  }
                : p
            ),
          }));
        }
      },
      
      removeCanvasElement: (elementId) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      elements: (p.canvasLayout?.elements || []).filter((el) => el.id !== elementId)
                    },
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      getCanvasElements: () => {
        const currentProject = get().getCurrentProject();
        const { activeBoardId, activeSurface } = get();
        // Filter elements to only show those belonging to the active board AND surface
        const allElements = currentProject?.canvasLayout?.elements || [];
        return allElements.filter((el) => {
          // Handle migration: elements without boardId belong to root (null)
          const elementBoardId = el.boardId !== undefined ? el.boardId : null;
          // Handle migration: elements without surface belong to 'canvas'
          const elementSurface = el.surface !== undefined ? el.surface : 'canvas';
          return elementBoardId === activeBoardId && elementSurface === activeSurface;
        });
      },
      
      duplicateCanvasElement: (elementId) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const element = currentProject.canvasLayout?.elements?.find(el => el.id === elementId);
          if (element) {
            get().pushCanvasHistory(); // Save state before duplicating
            const newElement = {
              ...element,
              id: uuidv4(),
              x: element.x + 20,
              y: element.y + 20,
            };
            set((state) => ({
              projects: state.projects.map((p) =>
                p.id === currentProject.id
                  ? { 
                      ...p, 
                      canvasLayout: {
                        ...(p.canvasLayout || {}),
                        elements: [...(p.canvasLayout?.elements || []), newElement]
                      },
                      updatedAt: new Date().toISOString() 
                    }
                  : p
              ),
            }));
          }
        }
      },
      
      // Canvas Edges (Connectors)
      addCanvasEdge: (edge) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          console.log('[STORE] addCanvasEdge called with:', edge);
          console.log('[STORE] Current project:', currentProject.id);
          console.log('[STORE] Active board:', get().activeBoardId);
          console.log('[STORE] Active surface:', get().activeSurface);
          
          get().pushCanvasHistory(); // Save state before adding edge
          // Ensure edge has the correct boardId and surface
          const edgeWithBoardAndSurface = {
            ...edge,
            boardId: edge.boardId !== undefined ? edge.boardId : get().activeBoardId,
            surface: edge.surface !== undefined ? edge.surface : get().activeSurface,
          };
          
          console.log('[STORE] Edge with board and surface:', edgeWithBoardAndSurface);
          
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      edges: [...(p.canvasLayout?.edges || []), edgeWithBoardAndSurface]
                    },
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
          
          // Verify it was added
          const updatedProject = get().getCurrentProject();
          console.log('[STORE] After add, edges in project:', updatedProject?.canvasLayout?.edges);
        } else {
          console.error('[STORE] No current project found when adding edge');
        }
      },
      
      updateCanvasEdge: (edgeId, updates) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      edges: (p.canvasLayout?.edges || []).map((edge) =>
                        edge.id === edgeId ? { ...edge, ...updates } : edge
                      )
                    },
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      removeCanvasEdge: (edgeId) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      edges: (p.canvasLayout?.edges || []).filter((edge) => edge.id !== edgeId)
                    },
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      getCanvasEdges: () => {
        const currentProject = get().getCurrentProject();
        const { activeBoardId, activeSurface } = get();
        // Filter edges to only show those belonging to the active board AND surface
        const allEdges = currentProject?.canvasLayout?.edges || [];
        console.log('[STORE] getCanvasEdges - All edges:', allEdges);
        console.log('[STORE] getCanvasEdges - Filtering for board:', activeBoardId, 'surface:', activeSurface);
        
        const filtered = allEdges.filter((edge) => {
          // Handle migration: edges without boardId belong to root (null)
          const edgeBoardId = edge.boardId !== undefined ? edge.boardId : null;
          // Handle migration: edges without surface belong to 'canvas'
          const edgeSurface = edge.surface !== undefined ? edge.surface : 'canvas';
          
          const matches = edgeBoardId === activeBoardId && edgeSurface === activeSurface;
          console.log('[STORE] Edge', edge.id, '- boardId:', edgeBoardId, 'surface:', edgeSurface, 'matches:', matches);
          
          return matches;
        });
        
        console.log('[STORE] getCanvasEdges - Filtered result:', filtered);
        return filtered;
      },
      
      // Board Navigation
      enterBoard: (boardId, title) => {
        const { boardPath, saveCurrentViewport, restoreViewport } = get();
        
        // Save current canvas viewport before entering new board
        saveCurrentViewport();
        
        set({
          activeBoardId: boardId,
          currentBoardId: boardId, // keep in sync for backward compatibility
          boardPath: [...boardPath, { id: boardId, title }],
        });
        
        // Restore viewport for the target board (or apply default)
        restoreViewport(boardId);
      },
      
      exitBoard: () => {
        const { boardPath, saveCurrentViewport, restoreViewport } = get();
        if (boardPath.length > 0) {
          // Save current board viewport before exiting
          saveCurrentViewport();
          
          const newPath = boardPath.slice(0, -1);
          const newBoardId = newPath.length > 0 ? newPath[newPath.length - 1].id : null;
          const targetCanvasId = newBoardId || 'root';
          
          set({
            activeBoardId: newBoardId,
            currentBoardId: newBoardId, // keep in sync
            boardPath: newPath,
          });
          
          // Restore viewport for the target canvas
          restoreViewport(targetCanvasId);
        }
      },
      
      navigateToBoardPath: (index) => {
        const { boardPath, saveCurrentViewport, restoreViewport } = get();
        
        // Save current viewport before navigation
        saveCurrentViewport();
        
        if (index < 0) {
          set({
            activeBoardId: null,
            currentBoardId: null, // keep in sync
            boardPath: [],
          });
          
          // Restore root canvas viewport
          restoreViewport('root');
        } else if (index < boardPath.length) {
          const newBoardId = boardPath[index].id;
          set({
            activeBoardId: newBoardId,
            currentBoardId: newBoardId, // keep in sync
            boardPath: boardPath.slice(0, index + 1),
          });
          
          // Restore viewport for the target board
          restoreViewport(newBoardId);
        }
      },
      
      createBoard: (title) => {
        const boardId = uuidv4();
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const newBoard = {
            id: boardId,
            parentBoardId: get().activeBoardId, // use activeBoardId as parent
            title,
            nodes: [],
            edges: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      boards: [...(p.canvasLayout?.boards || []), newBoard]
                    },
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
        return boardId;
      },
      
      setActiveBoardId: (boardId) => {
        set({
          activeBoardId: boardId,
          currentBoardId: boardId, // keep in sync
        });
      },
      
      getActiveBoardId: () => {
        return get().activeBoardId;
      },
      
      // Container Management
      addNodeToContainer: (nodeId, containerId) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const elements = currentProject.canvasElements || [];
          const container = elements.find((el) => el.id === containerId);
          const node = elements.find((el) => el.id === nodeId);
          
          if (container && node) {
            // Calculate required container size to fit the node
            const padding = 20; // Padding from container edges
            const headerHeight = 40; // Height of container header
            
            // Calculate node's position relative to container
            const nodeRight = node.x + node.width;
            const nodeBottom = node.y + node.height;
            
            // Calculate new container dimensions if node extends beyond current bounds
            const neededWidth = Math.max(
              container.width,
              nodeRight - container.x + padding
            );
            const neededHeight = Math.max(
              container.height,
              nodeBottom - container.y + padding + headerHeight
            );
            
            set((state) => ({
              projects: state.projects.map((p) =>
                p.id === currentProject.id
                  ? { 
                      ...p, 
                      canvasElements: (p.canvasElements || []).map((el) => {
                        if (el.id === nodeId) {
                          return { ...el, containerId };
                        }
                        if (el.id === containerId) {
                          return { 
                            ...el, 
                            width: neededWidth,
                            height: neededHeight 
                          };
                        }
                        return el;
                      }),
                      updatedAt: new Date().toISOString() 
                    }
                  : p
              ),
            }));
          }
        }
      },
      
      removeNodeFromContainer: (nodeId) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasElements: (p.canvasElements || []).map((el) =>
                      el.id === nodeId ? { ...el, containerId: undefined } : el
                    ),
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      moveContainerWithChildren: (containerId, deltaX, deltaY) => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { 
                    ...p, 
                    canvasElements: (p.canvasElements || []).map((el) =>
                      el.id === containerId || el.containerId === containerId
                        ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
                        : el
                    ),
                    updatedAt: new Date().toISOString() 
                  }
                : p
            ),
          }));
        }
      },
      
      // Share
      generateShareToken: () => {
        const currentProject = get().getCurrentProject();
        if (currentProject) {
          const token = uuidv4();
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, shareToken: token, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
          // Save share token to database
          updateProjectShareToken(currentProject.id, token);
          return token;
        }
        return '';
      },
      
      // Undo/Redo
      pushCanvasHistory: () => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        
        const elements = currentProject.canvasLayout?.elements || [];
        const edges = currentProject.canvasLayout?.edges || [];
        const { canvasHistory, canvasHistoryIndex } = get();
        
        // Create new history entry
        const newEntry: CanvasHistoryEntry = {
          elements: JSON.parse(JSON.stringify(elements)),
          edges: JSON.parse(JSON.stringify(edges)),
          timestamp: Date.now(),
        };
        
        // Remove any future history if we're not at the end
        const newHistory = canvasHistory.slice(0, canvasHistoryIndex + 1);
        newHistory.push(newEntry);
        
        // Limit history size
        if (newHistory.length > MAX_HISTORY_SIZE) {
          newHistory.shift();
        }
        
        set({
          canvasHistory: newHistory,
          canvasHistoryIndex: newHistory.length - 1,
        });
      },
      
      undo: () => {
        const { canvasHistory, canvasHistoryIndex, getCurrentProject } = get();
        const currentProject = getCurrentProject();
        
        if (canvasHistoryIndex <= 0 || !currentProject) return;
        
        const newIndex = canvasHistoryIndex - 1;
        const previousState = canvasHistory[newIndex];
        
        set((state) => ({
          canvasHistoryIndex: newIndex,
          projects: state.projects.map((p) =>
            p.id === currentProject.id
              ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: previousState.elements,
                    edges: previousState.edges
                  },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },
      
      redo: () => {
        const { canvasHistory, canvasHistoryIndex, getCurrentProject } = get();
        const currentProject = getCurrentProject();
        
        if (canvasHistoryIndex >= canvasHistory.length - 1 || !currentProject) return;
        
        const newIndex = canvasHistoryIndex + 1;
        const nextState = canvasHistory[newIndex];
        
        set((state) => ({
          canvasHistoryIndex: newIndex,
          projects: state.projects.map((p) =>
            p.id === currentProject.id
              ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: nextState.elements,
                    edges: nextState.edges
                  },
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
      },
      
      canUndo: () => {
        const { canvasHistoryIndex } = get();
        return canvasHistoryIndex > 0;
      },
      
      canRedo: () => {
        const { canvasHistory, canvasHistoryIndex } = get();
        return canvasHistoryIndex < canvasHistory.length - 1;
      },
    }),
    {
      name: 'cxd-storage',
      // Only persist UI state, not projects (database is source of truth for projects)
      partialize: (state) => ({
        viewMode: state.viewMode,
        currentProjectId: state.currentProjectId,
        canvasPosition: state.canvasPosition,
        canvasZoom: state.canvasZoom,
        focusedSection: state.focusedSection,
        currentBoardId: state.currentBoardId,
        boardPath: state.boardPath,
        viewportByCanvasId: state.viewportByCanvasId,
      }),
    }
  )
);
