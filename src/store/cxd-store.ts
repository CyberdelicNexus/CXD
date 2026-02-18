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
import {
  Version, OKR, KeyResult, Objective,
  createDefaultVersion, createDefaultOKR, createDefaultObjective, createDefaultKeyResult,
} from '@/types/version-types';
import {
  yjsAddVersion, yjsUpdateVersion, yjsDeleteVersion, yjsReorderVersions,
  yjsSetVersionStatus,
  yjsAddOKR, yjsUpdateOKR, yjsDeleteOKR,
  yjsAddObjective, yjsUpdateObjective, yjsDeleteObjective,
  yjsAddKeyResult, yjsUpdateKeyResult, yjsDeleteKeyResult,
} from '@/lib/yjs/yjs-version-actions';
import { saveProject, deleteProjectFromDb, updateProjectShareToken } from '@/lib/supabase-projects';
import type * as Y from 'yjs';
import {
  yjsAddElement, yjsUpdateElement, yjsRemoveElement, yjsDuplicateElement,
  yjsAddEdge, yjsUpdateEdge, yjsRemoveEdge,
  yjsMoveContainerWithChildren, yjsCreateGroup, yjsUngroup,
  yjsSetDesignTextField, yjsSetDesignNumberField, yjsSetMetaField,
  yjsToggleRealityPlane, yjsUpdateRealityPlaneInterface,
  yjsUpdateStageField, yjsAddExperienceFlowStage, yjsRemoveExperienceFlowStage,
  yjsMoveExperienceFlowStage, yjsSetExperienceFlowDescription,
  yjsDeleteElementField, yjsReorderRealityPlanes, yjsReorderExperienceFlowStage,
  yjsToggleExperienceFlowStageRealityPlane,
} from '@/lib/yjs/yjs-store-actions';
import { createCanvasUndoManager, createDesignUndoManager } from '@/lib/yjs/undo-manager';

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
  defaultView: 'canvas' | 'hexagon' | 'plan'; // User's preferred default view

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

  // Clipboard for copy/paste across boards
  clipboard: CanvasElement[];

  // Yjs CRDT document (set when collaborative mode is active)
  yDoc: Y.Doc | null;
  setYDoc: (doc: Y.Doc | null) => void;
  // Yjs UndoManagers (canvas + design fields)
  canvasUndoManager: Y.UndoManager | null;
  designUndoManager: Y.UndoManager | null;

  // Actions - View
  setViewMode: (mode: ViewMode) => void;
  setFocusedSection: (section: CXDSectionId | null) => void;
  setCanvasViewMode: (mode: 'canvas' | 'hexagon' | 'hypercube' | 'plan') => void;
  setDefaultView: (mode: 'canvas' | 'hexagon' | 'plan') => void;
  setActiveSurface: (surface: 'canvas' | 'hypercube') => void;
  setHighlightedElementId: (elementId: string | null) => void;
  highlightElementBriefly: (elementId: string, durationMs?: number) => void;

  // Actions - Clipboard
  setClipboard: (elements: CanvasElement[]) => void;

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
  toggleExperienceFlowStageRealityPlane: (stageId: string, code: RealityPlaneCode) => void;

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
  updateCanvasBackground: (background: string) => void;

  // Actions - Experience Flow Description (simplified wizard)
  updateExperienceFlowDescription: (value: string) => void;

  // Actions - Canvas Layout
  updateCanvasLayout: (elementId: string, position: { x: number; y: number }) => void;

  // Actions - Canvas Elements
  addCanvasElement: (element: CanvasElement) => void;
  updateCanvasElement: (elementId: string, updates: Partial<CanvasElement>) => void;
  removeCanvasElement: (elementId: string) => void;
  getCanvasElements: () => CanvasElement[];
  getAllInboxItems: () => CanvasElement[]; // Get all inbox items across all boards
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

  // Actions - Element Grouping
  createGroup: (elementIds: string[]) => string; // Returns group ID
  ungroup: (groupId: string) => void;
  getGroupElements: (groupId: string) => CanvasElement[];
  updateGroupElements: (groupId: string, updates: Partial<CanvasElement>) => void;

  // Actions - Version Management
  getVersions: () => Version[];
  addVersion: (name?: string, parentVersionId?: string) => string;
  updateVersion: (versionId: string, updates: Partial<Omit<Version, 'id' | 'createdAt'>>) => void;
  deleteVersion: (versionId: string) => void;
  reorderVersions: (newOrder: string[]) => void;
  setVersionStatus: (versionId: string, status: import('./version-types').VersionStatus) => void;
  tagTaskWithVersion: (elementId: string, versionId: string | null) => void;

  // Actions - OKR Management (Refactored for new structure)
  getOKRs: () => OKR[];
  getVersionOKRs: (versionId: string) => OKR[];
  addOKR: (versionId: string) => string;
  updateOKR: (okrId: string, updates: Partial<Omit<OKR, 'id' | 'createdAt'>>) => void;
  deleteOKR: (okrId: string) => void;

  // Objective Management
  addObjective: (okrId: string, title?: string) => string;
  updateObjective: (okrId: string, objectiveId: string, updates: Partial<Omit<import('./version-types').Objective, 'id' | 'createdAt'>>) => void;
  deleteObjective: (okrId: string, objectiveId: string) => void;

  // Key Result Management
  addKeyResult: (okrId: string, objectiveId: string, description?: string) => string;
  updateKeyResult: (okrId: string, objectiveId: string, krId: string, updates: Partial<Omit<import('./version-types').KeyResult, 'id' | 'createdAt'>>) => void;
  deleteKeyResult: (okrId: string, objectiveId: string, krId: string) => void;

  // OKR Carry-Forward
  carryForwardOKRs: (sourceVersionId: string, targetVersionId: string, okrIds: string[]) => void;

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
      defaultView: 'canvas', // User's preferred default view
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
      clipboard: [],
      canvasHistory: [],
      canvasHistoryIndex: -1,
      yDoc: null,
      canvasUndoManager: null,
      designUndoManager: null,
      setYDoc: (doc) => {
        // Destroy previous undo managers if any
        const prev = get();
        if (prev.canvasUndoManager) {
          prev.canvasUndoManager.destroy();
        }
        if (prev.designUndoManager) {
          prev.designUndoManager.destroy();
        }

        if (doc) {
          const canvasUM = createCanvasUndoManager(doc);
          const designUM = createDesignUndoManager(doc);
          set({ yDoc: doc, canvasUndoManager: canvasUM, designUndoManager: designUM });
        } else {
          set({ yDoc: null, canvasUndoManager: null, designUndoManager: null });
        }
      },

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
      setDefaultView: (mode) => set({ defaultView: mode }),
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

      // Clipboard actions
      setClipboard: (elements) => set({ clipboard: elements }),

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
            // Always open existing projects in canvas view
            // Only new projects (via createProject) open in wizard
            viewMode: 'canvas',
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
              if (!stage.realityPlanes) {
                stage.realityPlanes = { PR: true, VR: false, AR: false, MR: false, GR: false, BR: false, CR: false };
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
          // Migration: ensure versions array exists
          if (!project.versions) {
            project.versions = [];
          }
          // Migration: ensure okrs array exists
          if (!project.okrs) {
            project.okrs = [];
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsToggleRealityPlane(yDoc, code);
        } else {
          const currentPlanes = currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
          const updatedPlanes = currentPlanes.map((plane) =>
            plane.code === code ? { ...plane, enabled: !plane.enabled } : plane
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, realityPlanesV2: updatedPlanes, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateRealityPlaneInterface: (code, interfaceModality) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateRealityPlaneInterface(yDoc, code, interfaceModality);
        } else {
          const currentPlanes = currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
          const updatedPlanes = currentPlanes.map((plane) =>
            plane.code === code ? { ...plane, interfaceModality } : plane
          );
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, realityPlanesV2: updatedPlanes, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      reorderRealityPlanes: (newOrder) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsReorderRealityPlanes(yDoc, newOrder);
        } else {
          const currentPlanes = currentProject.realityPlanesV2 || [...DEFAULT_REALITY_PLANES_V2];
          const reorderedPlanes = newOrder.map((code, index) => {
            const plane = currentPlanes.find((p) => p.code === code);
            return plane ? { ...plane, priority: index } : { code, enabled: false, interfaceModality: '', priority: index };
          });
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, realityPlanesV2: reorderedPlanes, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      // Sensory Domains
      updateSensoryDomain: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignNumberField(yDoc, 'sensoryDomains', code, value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, sensoryDomains: { ...p.sensoryDomains, [code]: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      // Presence Types
      updatePresenceType: (code, value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignNumberField(yDoc, 'presenceTypes', code, value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, presenceTypes: { ...p.presenceTypes, [code]: value }, updatedAt: new Date().toISOString() }
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsAddExperienceFlowStage(yDoc, afterIndex);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsRemoveExperienceFlowStage(yDoc, stageId);
        } else {
          const stages = currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES;
          if (stages.length <= 1) return;
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateStageField(yDoc, stageId, 'name', newName);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsMoveExperienceFlowStage(yDoc, stageId, direction);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsReorderExperienceFlowStage(yDoc, stageId, newIndex);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateStageField(yDoc, stageId, 'engagementDistribution', distribution);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateStageField(yDoc, stageId, 'narrativeNotes', value);
        } else {
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

      toggleExperienceFlowStageRealityPlane: (stageId, code) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsToggleExperienceFlowStageRealityPlane(yDoc, stageId, code);
        } else {
          const stages = (currentProject.experienceFlowStages || DEFAULT_EXPERIENCE_FLOW_STAGES).map((s) => {
            if (s.id === stageId) {
              const currentPlanes = s.realityPlanes || { PR: true, VR: false, AR: false, MR: false, GR: false, BR: false, CR: false };
              return { ...s, realityPlanes: { ...currentPlanes, [code]: !currentPlanes[code] } };
            }
            return s;
          });
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateStageField(yDoc, stageId, 'presenceTypes', presenceTypes);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateStageField(yDoc, stageId, 'estimatedMinutes', estimatedMinutes);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'stateMapping', code, value);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'traitMapping', code, value);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'contextAndMeaning', 'world', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, contextAndMeaning: { ...p.contextAndMeaning, world: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateContextStory: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'contextAndMeaning', 'story', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, contextAndMeaning: { ...p.contextAndMeaning, story: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateContextMagic: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'contextAndMeaning', 'magic', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, contextAndMeaning: { ...p.contextAndMeaning, magic: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      // Intention Core
      updateIntentionProjectName: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'intentionCore', 'projectName', value);
          yjsSetMetaField(yDoc, 'name', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, name: value, intentionCore: { ...p.intentionCore, projectName: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateIntentionMainConcept: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'intentionCore', 'mainConcept', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, intentionCore: { ...p.intentionCore, mainConcept: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateIntentionCoreMessage: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'intentionCore', 'coreMessage', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, intentionCore: { ...p.intentionCore, coreMessage: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      // Desired Change
      updateDesiredInsights: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'desiredChange', 'insights', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, desiredChange: { ...p.desiredChange, insights: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateDesiredFeelings: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'desiredChange', 'feelings', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, desiredChange: { ...p.desiredChange, feelings: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateDesiredStates: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'desiredChange', 'states', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, desiredChange: { ...p.desiredChange, states: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateDesiredKnowledge: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'desiredChange', 'knowledge', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, desiredChange: { ...p.desiredChange, knowledge: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      // Human Context
      updateHumanAudienceNeeds: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'humanContext', 'audienceNeeds', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, humanContext: { ...p.humanContext, audienceNeeds: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateHumanAudienceDesires: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'humanContext', 'audienceDesires', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, humanContext: { ...p.humanContext, audienceDesires: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateHumanUserRole: (value) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetDesignTextField(yDoc, 'humanContext', 'userRole', value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, humanContext: { ...p.humanContext, userRole: value }, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      // Project metadata
      updateProjectName: (name) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetMetaField(yDoc, 'name', name);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetMetaField(yDoc, 'description', description);
        } else {
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetExperienceFlowDescription(yDoc, value);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, experienceFlowDescription: value, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      updateCanvasBackground: (background) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsSetMetaField(yDoc, 'canvasBackground', background);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, canvasBackground: background, updatedAt: new Date().toISOString() }
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
        if (!currentProject) return;

        // Ensure element has the correct boardId and surface
        const elementWithBoardAndSurface = {
          ...element,
          boardId: element.boardId !== undefined ? element.boardId : get().activeBoardId,
          surface: element.surface !== undefined ? element.surface : get().activeSurface,
        };

        const { yDoc } = get();
        if (yDoc) {
          // CRDT path: mutate Y.Doc, bridge observer updates Zustand
          yjsAddElement(yDoc, elementWithBoardAndSurface);
        } else {
          // Fallback: direct Zustand mutation
          get().pushCanvasHistory();
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
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          // CRDT path: mutate Y.Doc, bridge observer updates Zustand
          const elements = currentProject.canvasLayout?.elements || [];
          const element = elements.find(el => el.id === elementId);

          // Container expansion logic in Yjs path
          if (element?.containerId) {
            const container = elements.find(el => el.id === element.containerId);
            if (container && container.type === 'container') {
              const newX = updates.x !== undefined ? updates.x : element.x;
              const newY = updates.y !== undefined ? updates.y : element.y;
              const newWidth = updates.width !== undefined ? updates.width : element.width;
              const newHeight = updates.height !== undefined ? updates.height : element.height;
              const padding = 20;
              const headerHeight = 40;
              const neededWidth = Math.max(container.width, newX + newWidth - container.x + padding);
              const neededHeight = Math.max(container.height, newY + newHeight - container.y + padding + headerHeight);

              yjsUpdateElement(yDoc, elementId, updates);
              if (neededWidth > container.width || neededHeight > container.height) {
                yjsUpdateElement(yDoc, element.containerId, { width: neededWidth, height: neededHeight });
              }
              return;
            }
          }

          yjsUpdateElement(yDoc, elementId, updates);

          // Board title sync — boards aren't in Y.Doc yet, update Zustand directly
          if (element?.type === 'board' && updates.hasOwnProperty('title')) {
            set((state) => ({
              projects: state.projects.map((p) =>
                p.id === currentProject.id
                  ? {
                    ...p,
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      boards: (p.canvasLayout?.boards || []).map((board) =>
                        board.id === (element as any).childBoardId
                          ? { ...board, title: (updates as any).title }
                          : board
                      ),
                    },
                  }
                  : p
              ),
            }));
          }
        } else {
          // Fallback: direct Zustand mutation
          const elements = currentProject.canvasLayout?.elements || [];
          const element = elements.find(el => el.id === elementId);

          // If element has a container, check if we need to expand the container
          if (element?.containerId) {
            const container = elements.find(el => el.id === element.containerId);
            if (container && container.type === 'container') {
              const newX = updates.x !== undefined ? updates.x : element.x;
              const newY = updates.y !== undefined ? updates.y : element.y;
              const newWidth = updates.width !== undefined ? updates.width : element.width;
              const newHeight = updates.height !== undefined ? updates.height : element.height;

              const padding = 20;
              const headerHeight = 40;

              const neededWidth = Math.max(
                container.width,
                newX + newWidth - container.x + padding
              );
              const neededHeight = Math.max(
                container.height,
                newY + newHeight - container.y + padding + headerHeight
              );

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

          const isBoardElement = element?.type === 'board';
          const isTitleUpdate = updates.hasOwnProperty('title');

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
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          yjsRemoveElement(yDoc, elementId);
        } else {
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

      getAllInboxItems: () => {
        const currentProject = get().getCurrentProject();
        const allElements = currentProject?.canvasLayout?.elements || [];
        // Return all elements with inInbox flag, regardless of board or surface
        return allElements.filter((el) => el.inInbox === true);
      },

      duplicateCanvasElement: (elementId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          yjsDuplicateElement(yDoc, elementId);
        } else {
          const element = currentProject.canvasLayout?.elements?.find(el => el.id === elementId);
          if (element) {
            get().pushCanvasHistory();
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
        if (!currentProject) return;

        const edgeWithBoardAndSurface = {
          ...edge,
          boardId: edge.boardId !== undefined ? edge.boardId : get().activeBoardId,
          surface: edge.surface !== undefined ? edge.surface : get().activeSurface,
        };

        const { yDoc } = get();
        if (yDoc) {
          yjsAddEdge(yDoc, edgeWithBoardAndSurface);
        } else {
          get().pushCanvasHistory();
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
        }
      },

      updateCanvasEdge: (edgeId, updates) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          yjsUpdateEdge(yDoc, edgeId, updates);
        } else {
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
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          yjsRemoveEdge(yDoc, edgeId);
        } else {
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

        const filtered = allEdges.filter((edge) => {
          // Handle migration: edges without boardId belong to root (null)
          const edgeBoardId = edge.boardId !== undefined ? edge.boardId : null;
          // Handle migration: edges without surface belong to 'canvas'
          const edgeSurface = edge.surface !== undefined ? edge.surface : 'canvas';

          return edgeBoardId === activeBoardId && edgeSurface === activeSurface;
        });

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
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          const elements = currentProject.canvasLayout?.elements || [];
          const container = elements.find((el) => el.id === containerId);
          const node = elements.find((el) => el.id === nodeId);
          if (container && node) {
            const padding = 20;
            const headerHeight = 40;
            const neededWidth = Math.max(container.width, node.x + node.width - container.x + padding);
            const neededHeight = Math.max(container.height, node.y + node.height - container.y + padding + headerHeight);
            yjsUpdateElement(yDoc, nodeId, { containerId });
            if (neededWidth > container.width || neededHeight > container.height) {
              yjsUpdateElement(yDoc, containerId, { width: neededWidth, height: neededHeight });
            }
          }
        } else {
          const elements = currentProject.canvasLayout?.elements || [];
          const container = elements.find((el) => el.id === containerId);
          const node = elements.find((el) => el.id === nodeId);
          if (container && node) {
            const padding = 20;
            const headerHeight = 40;
            const neededWidth = Math.max(container.width, node.x + node.width - container.x + padding);
            const neededHeight = Math.max(container.height, node.y + node.height - container.y + padding + headerHeight);
            set((state) => ({
              projects: state.projects.map((p) =>
                p.id === currentProject.id
                  ? {
                    ...p,
                    canvasLayout: {
                      ...(p.canvasLayout || {}),
                      elements: (p.canvasLayout?.elements || []).map((el) => {
                        if (el.id === nodeId) return { ...el, containerId };
                        if (el.id === containerId) return { ...el, width: neededWidth, height: neededHeight };
                        return el;
                      }),
                    },
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
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsDeleteElementField(yDoc, nodeId, 'containerId');
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: (p.canvasLayout?.elements || []).map((el) =>
                      el.id === nodeId ? { ...el, containerId: undefined } : el
                    ),
                  },
                  updatedAt: new Date().toISOString()
                }
                : p
            ),
          }));
        }
      },

      moveContainerWithChildren: (containerId, deltaX, deltaY) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;
        const { yDoc } = get();
        if (yDoc) {
          yjsMoveContainerWithChildren(yDoc, containerId, deltaX, deltaY);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: (p.canvasLayout?.elements || []).map((el) =>
                      el.id === containerId || el.containerId === containerId
                        ? { ...el, x: el.x + deltaX, y: el.y + deltaY }
                        : el
                    ),
                  },
                  updatedAt: new Date().toISOString()
                }
                : p
            ),
          }));
        }
      },

      // Element Grouping
      createGroup: (elementIds) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject || elementIds.length < 2) return '';

        const { yDoc } = get();
        if (yDoc) {
          return yjsCreateGroup(yDoc, elementIds);
        } else {
          const groupId = `group-${uuidv4()}`;
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: (p.canvasLayout?.elements || []).map((el) =>
                      elementIds.includes(el.id) ? { ...el, groupId } : el
                    ),
                  },
                  updatedAt: new Date().toISOString()
                }
                : p
            ),
          }));
          return groupId;
        }
      },

      ungroup: (groupId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          yjsUngroup(yDoc, groupId);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: (p.canvasLayout?.elements || []).map((el) =>
                      el.groupId === groupId ? { ...el, groupId: undefined } : el
                    ),
                  },
                  updatedAt: new Date().toISOString()
                }
                : p
            ),
          }));
        }
      },

      getGroupElements: (groupId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return [];

        const elements = currentProject.canvasLayout?.elements || [];
        return elements.filter((el) => el.groupId === groupId);
      },

      updateGroupElements: (groupId, updates) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();
        if (yDoc) {
          const elements = currentProject.canvasLayout?.elements || [];
          for (const el of elements) {
            if (el.groupId === groupId) {
              yjsUpdateElement(yDoc, el.id, updates);
            }
          }
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  canvasLayout: {
                    ...(p.canvasLayout || {}),
                    elements: (p.canvasLayout?.elements || []).map((el) =>
                      el.groupId === groupId
                        ? { ...el, ...updates } as typeof el
                        : el
                    ),
                  },
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

      // ═══════════════════════════════════════════════════════════════════════
      // VERSION MANAGEMENT
      // ═══════════════════════════════════════════════════════════════════════

      getVersions: () => {
        const project = get().getCurrentProject();
        return project?.versions || [];
      },

      addVersion: (name = 'New Version', parentVersionId?: string) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return '';

        const { yDoc } = get();
        const existingVersions = currentProject.versions || [];
        const versionId = uuidv4();
        const newVersion: Version = {
          ...createDefaultVersion(name, existingVersions.length, parentVersionId),
          id: versionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (yDoc) {
          yjsAddVersion(yDoc, newVersion);
        } else {
          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  versions: [...existingVersions, newVersion],
                  updatedAt: new Date().toISOString(),
                }
                : p
            ),
          }));
          const updatedProject = get().getCurrentProject();
          if (updatedProject) saveProject(updatedProject).catch(err => console.error('Failed to save project:', err));
        }

        return versionId;
      },

      updateVersion: (versionId, updates) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsUpdateVersion(yDoc, versionId, updates);
        } else {
          const versions = (currentProject.versions || []).map((v) =>
            v.id === versionId ? { ...v, ...updates, updatedAt: new Date().toISOString() } : v
          );

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, versions, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
          const updatedProject = get().getCurrentProject();
          if (updatedProject) saveProject(updatedProject).catch(err => console.error('Failed to save project:', err));
        }
      },

      deleteVersion: (versionId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsDeleteVersion(yDoc, versionId);
        } else {
          const versions = (currentProject.versions || []).filter((v) => v.id !== versionId);

          // Also remove versionId from all tasks
          const elements = (currentProject.canvasLayout?.elements || []).map((el) => {
            if (el.taskMetadata?.versionId === versionId) {
              return {
                ...el,
                taskMetadata: { ...el.taskMetadata, versionId: undefined },
              };
            }
            return el;
          });

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? {
                  ...p,
                  versions,
                  canvasLayout: { ...(p.canvasLayout || {}), elements },
                  updatedAt: new Date().toISOString(),
                }
                : p
            ),
          }));
          const updatedProject = get().getCurrentProject();
          if (updatedProject) saveProject(updatedProject).catch(err => console.error('Failed to save project:', err));
        }
      },

      reorderVersions: (newOrder) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsReorderVersions(yDoc, newOrder);
        } else {
          const versionMap = new Map((currentProject.versions || []).map((v) => [v.id, v]));
          const versions = newOrder
            .map((id, index) => {
              const version = versionMap.get(id);
              return version ? { ...version, order: index } : null;
            })
            .filter((v): v is Version => v !== null);

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, versions, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
        }
      },

      setVersionStatus: (versionId, status) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();
        const now = new Date().toISOString();

        // Calculate timestamps based on status transitions
        const version = (currentProject.versions || []).find((v) => v.id === versionId);
        if (!version) return;

        const updates: Partial<Version> = { status, updatedAt: now };

        // Set started_at when transitioning to 'active' (only if not already set)
        if (status === 'active' && !version.started_at) {
          updates.started_at = now;
        }

        // Set completed_at when transitioning to 'complete'
        if (status === 'complete' && !version.completed_at) {
          updates.completed_at = now;
        }

        if (yDoc) {
          yjsSetVersionStatus(yDoc, versionId, status, updates);
        } else {
          const versions = (currentProject.versions || []).map((v) =>
            v.id === versionId ? { ...v, ...updates } : v
          );

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, versions, updatedAt: now }
                : p
            ),
          }));
        }
      },

      tagTaskWithVersion: (elementId, versionId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        get().updateCanvasElement(elementId, {
          taskMetadata: {
            ...(currentProject.canvasLayout?.elements?.find((el) => el.id === elementId)?.taskMetadata || {}),
            versionId: versionId || undefined,
          },
        } as Partial<CanvasElement>);
      },

      // ═══════════════════════════════════════════════════════════════════════
      // OKR MANAGEMENT (Refactored - OKRs belong to versions)
      // ═══════════════════════════════════════════════════════════════════════

      getOKRs: () => {
        const project = get().getCurrentProject();
        return project?.okrs || [];
      },

      getVersionOKRs: (versionId) => {
        const project = get().getCurrentProject();
        return (project?.okrs || []).filter((okr) => okr.versionId === versionId);
      },

      addOKR: (versionId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return '';

        const { yDoc } = get();
        const okrId = uuidv4();
        const newOKR: OKR = {
          ...createDefaultOKR(versionId),
          id: okrId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (yDoc) {
          yjsAddOKR(yDoc, newOKR);
        } else {
          const okrs = [...(currentProject.okrs || []), newOKR];

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, okrs, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
          const updatedProject = get().getCurrentProject();
          if (updatedProject) saveProject(updatedProject).catch(err => console.error('Failed to save project:', err));
        }

        return okrId;
      },

      updateOKR: (okrId, updates) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsUpdateOKR(yDoc, okrId, updates);
        } else {
          const okrs = (currentProject.okrs || []).map((okr) =>
            okr.id === okrId ? { ...okr, ...updates, updatedAt: new Date().toISOString() } : okr
          );

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, okrs, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
          const updatedProject = get().getCurrentProject();
          if (updatedProject) saveProject(updatedProject).catch(err => console.error('Failed to save project:', err));
        }
      },

      deleteOKR: (okrId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsDeleteOKR(yDoc, okrId);
        } else {
          const okrs = (currentProject.okrs || []).filter((okr) => okr.id !== okrId);

          set((state) => ({
            projects: state.projects.map((p) =>
              p.id === currentProject.id
                ? { ...p, okrs, updatedAt: new Date().toISOString() }
                : p
            ),
          }));
          const updatedProject = get().getCurrentProject();
          if (updatedProject) saveProject(updatedProject).catch(err => console.error('Failed to save project:', err));
        }
      },

      // Objective Management
      addObjective: (okrId, title = 'New Objective') => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return '';

        const okr = (currentProject.okrs || []).find((o) => o.id === okrId);
        if (!okr) return '';

        const { yDoc } = get();
        const objectiveId = uuidv4();
        const newObjective: Objective = {
          ...createDefaultObjective(title),
          id: objectiveId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (yDoc) {
          yjsAddObjective(yDoc, okrId, newObjective);
        } else {
          const updatedObjectives = [...okr.objectives, newObjective];
          get().updateOKR(okrId, { objectives: updatedObjectives });
        }

        return objectiveId;
      },

      updateObjective: (okrId, objectiveId, updates) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const okr = (currentProject.okrs || []).find((o) => o.id === okrId);
        if (!okr) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsUpdateObjective(yDoc, okrId, objectiveId, updates);
        } else {
          const updatedObjectives = okr.objectives.map((obj) =>
            obj.id === objectiveId
              ? { ...obj, ...updates, updatedAt: new Date().toISOString() }
              : obj
          );
          get().updateOKR(okrId, { objectives: updatedObjectives });
        }
      },

      deleteObjective: (okrId, objectiveId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const okr = (currentProject.okrs || []).find((o) => o.id === okrId);
        if (!okr) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsDeleteObjective(yDoc, okrId, objectiveId);
        } else {
          const updatedObjectives = okr.objectives.filter((obj) => obj.id !== objectiveId);
          get().updateOKR(okrId, { objectives: updatedObjectives });
        }
      },

      // Key Result Management
      addKeyResult: (okrId, objectiveId, description = 'New Key Result') => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return '';

        const okr = (currentProject.okrs || []).find((o) => o.id === okrId);
        if (!okr) return '';

        const objective = okr.objectives.find((obj) => obj.id === objectiveId);
        if (!objective) return '';

        const { yDoc } = get();
        const krId = uuidv4();
        const newKR: KeyResult = {
          ...createDefaultKeyResult(description),
          id: krId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (yDoc) {
          yjsAddKeyResult(yDoc, okrId, objectiveId, newKR);
        } else {
          const updatedObjectives = okr.objectives.map((obj) =>
            obj.id === objectiveId
              ? { ...obj, keyResults: [...obj.keyResults, newKR] }
              : obj
          );
          get().updateOKR(okrId, { objectives: updatedObjectives });
        }

        return krId;
      },

      updateKeyResult: (okrId, objectiveId, krId, updates) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const okr = (currentProject.okrs || []).find((o) => o.id === okrId);
        if (!okr) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsUpdateKeyResult(yDoc, okrId, objectiveId, krId, updates);
        } else {
          const updatedObjectives = okr.objectives.map((obj) =>
            obj.id === objectiveId
              ? {
                  ...obj,
                  keyResults: obj.keyResults.map((kr) =>
                    kr.id === krId
                      ? { ...kr, ...updates, updatedAt: new Date().toISOString() }
                      : kr
                  ),
                }
              : obj
          );
          get().updateOKR(okrId, { objectives: updatedObjectives });
        }
      },

      deleteKeyResult: (okrId, objectiveId, krId) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const okr = (currentProject.okrs || []).find((o) => o.id === okrId);
        if (!okr) return;

        const { yDoc } = get();

        if (yDoc) {
          yjsDeleteKeyResult(yDoc, okrId, objectiveId, krId);
        } else {
          const updatedObjectives = okr.objectives.map((obj) =>
            obj.id === objectiveId
              ? { ...obj, keyResults: obj.keyResults.filter((kr) => kr.id !== krId) }
              : obj
          );
          get().updateOKR(okrId, { objectives: updatedObjectives });
        }
      },

      // OKR Carry-Forward (for version chains)
      carryForwardOKRs: (sourceVersionId, targetVersionId, okrIds) => {
        const currentProject = get().getCurrentProject();
        if (!currentProject) return;

        const sourceOKRs = (currentProject.okrs || []).filter(
          (okr) => okr.versionId === sourceVersionId && okrIds.includes(okr.id)
        );

        const newOKRs: OKR[] = sourceOKRs.map((okr) => ({
          ...okr,
          id: uuidv4(),
          versionId: targetVersionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          // Deep copy objectives and key results with new IDs
          objectives: okr.objectives.map((obj) => ({
            ...obj,
            id: uuidv4(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            keyResults: obj.keyResults.map((kr) => ({
              ...kr,
              id: uuidv4(),
              currentValue: 0, // Reset progress for new version
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })),
          })),
        }));

        const okrs = [...(currentProject.okrs || []), ...newOKRs];

        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === currentProject.id
              ? { ...p, okrs, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
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
        const { canvasUndoManager } = get();
        if (canvasUndoManager) {
          // CRDT path: Y.UndoManager reverses local ops, bridge syncs Zustand
          canvasUndoManager.undo();
          return;
        }

        // Fallback: snapshot-based undo
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
        const { canvasUndoManager } = get();
        if (canvasUndoManager) {
          // CRDT path: Y.UndoManager re-applies local ops
          canvasUndoManager.redo();
          return;
        }

        // Fallback: snapshot-based redo
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
        const { canvasUndoManager, canvasHistoryIndex } = get();
        if (canvasUndoManager) {
          return canvasUndoManager.undoStack.length > 0;
        }
        return canvasHistoryIndex > 0;
      },

      canRedo: () => {
        const { canvasUndoManager, canvasHistory, canvasHistoryIndex } = get();
        if (canvasUndoManager) {
          return canvasUndoManager.redoStack.length > 0;
        }
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
