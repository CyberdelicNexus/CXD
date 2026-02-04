'use client';

import { createContext, useContext, ReactNode, useCallback } from 'react';
import { useCollaboration, CollaboratorPresence, CanvasUpdate } from '@/hooks/use-collaboration';
import { useCXDStore } from '@/store/cxd-store';
import { CanvasElement, CanvasEdge } from '@/types/canvas-elements';
import { SensoryDomainCode, PresenceTypeCode, RealityPlaneCode, StateQuadrantCode, TraitQuadrantCode, ExperienceFlowStageCode } from '@/types/cxd-schema';

interface CollaborationContextValue {
  collaborators: CollaboratorPresence[];
  isConnected: boolean;
  currentUser: { id: string; email: string; name?: string; avatarUrl?: string } | null;
  updateCursor: (x: number, y: number) => void;
  clearCursor: () => void;
  updateSelection: (elementIds: string[]) => void;
  broadcastUpdate: (update: Omit<CanvasUpdate, 'timestamp' | 'userId'>) => void;
  // Canvas element sync functions
  syncAddElement: (element: CanvasElement) => void;
  syncUpdateElement: (elementId: string, updates: Partial<CanvasElement>) => void;
  syncRemoveElement: (elementId: string) => void;
  syncAddEdge: (edge: CanvasEdge) => void;
  syncUpdateEdge: (edgeId: string, changes: Partial<CanvasEdge>) => void;
  syncRemoveEdge: (edgeId: string) => void;
  // CXD Field sync functions
  syncSensoryDomain: (code: SensoryDomainCode, value: number) => void;
  syncPresenceType: (code: PresenceTypeCode, value: number) => void;
  syncRealityPlaneToggle: (code: RealityPlaneCode) => void;
  syncRealityPlaneInterface: (code: RealityPlaneCode, interfaceModality: string) => void;
  syncStateMapping: (code: StateQuadrantCode, value: string) => void;
  syncTraitMapping: (code: TraitQuadrantCode, value: string) => void;
  syncIntentionCore: (field: 'projectName' | 'mainConcept' | 'coreMessage', value: string) => void;
  syncDesiredChange: (field: 'insights' | 'feelings' | 'states' | 'knowledge', value: string) => void;
  syncHumanContext: (field: 'audienceNeeds' | 'audienceDesires' | 'userRole', value: string) => void;
  syncContextMeaning: (field: 'world' | 'story' | 'magic', value: string) => void;
  syncExperienceFlowNarrative: (code: ExperienceFlowStageCode, value: string) => void;
  syncExperienceFlowIntent: (code: ExperienceFlowStageCode, value: string) => void;
}

const CollaborationContext = createContext<CollaborationContextValue | null>(null);

interface CollaborationProviderProps {
  children: ReactNode;
  onRemoteUpdate?: (update: CanvasUpdate) => void;
}

export function CollaborationProvider({ children, onRemoteUpdate }: CollaborationProviderProps) {
  const project = useCXDStore(state => state.getCurrentProject());

  // Canvas element functions
  const addCanvasElement = useCXDStore(state => state.addCanvasElement);
  const updateCanvasElement = useCXDStore(state => state.updateCanvasElement);
  const removeCanvasElement = useCXDStore(state => state.removeCanvasElement);
  const addCanvasEdge = useCXDStore(state => state.addCanvasEdge);
  const updateCanvasEdge = useCXDStore(state => state.updateCanvasEdge);
  const removeCanvasEdge = useCXDStore(state => state.removeCanvasEdge);

  // CXD Field update functions
  const updateSensoryDomain = useCXDStore(state => state.updateSensoryDomain);
  const updatePresenceType = useCXDStore(state => state.updatePresenceType);
  const toggleRealityPlane = useCXDStore(state => state.toggleRealityPlane);
  const updateRealityPlaneInterface = useCXDStore(state => state.updateRealityPlaneInterface);
  const updateStateMapping = useCXDStore(state => state.updateStateMapping);
  const updateTraitMapping = useCXDStore(state => state.updateTraitMapping);
  const updateIntentionProjectName = useCXDStore(state => state.updateIntentionProjectName);
  const updateIntentionMainConcept = useCXDStore(state => state.updateIntentionMainConcept);
  const updateIntentionCoreMessage = useCXDStore(state => state.updateIntentionCoreMessage);
  const updateDesiredInsights = useCXDStore(state => state.updateDesiredInsights);
  const updateDesiredFeelings = useCXDStore(state => state.updateDesiredFeelings);
  const updateDesiredStates = useCXDStore(state => state.updateDesiredStates);
  const updateDesiredKnowledge = useCXDStore(state => state.updateDesiredKnowledge);
  const updateHumanAudienceNeeds = useCXDStore(state => state.updateHumanAudienceNeeds);
  const updateHumanAudienceDesires = useCXDStore(state => state.updateHumanAudienceDesires);
  const updateHumanUserRole = useCXDStore(state => state.updateHumanUserRole);
  const updateContextWorld = useCXDStore(state => state.updateContextWorld);
  const updateContextStory = useCXDStore(state => state.updateContextStory);
  const updateContextMagic = useCXDStore(state => state.updateContextMagic);
  const updateExperienceFlowNarrative = useCXDStore(state => state.updateExperienceFlowNarrative);
  const updateExperienceFlowIntent = useCXDStore(state => state.updateExperienceFlowIntent);

  const {
    collaborators,
    isConnected,
    currentUser,
    updateCursor,
    clearCursor,
    updateSelection,
    broadcastUpdate,
  } = useCollaboration(project?.id || null, { onRemoteUpdate });

  // Canvas element sync wrapper functions
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

  const syncUpdateEdge = useCallback((edgeId: string, changes: Partial<CanvasEdge>) => {
    updateCanvasEdge(edgeId, changes);
    broadcastUpdate({ type: 'edge_update', edgeId, edgeChanges: changes });
  }, [updateCanvasEdge, broadcastUpdate]);

  const syncRemoveEdge = useCallback((edgeId: string) => {
    removeCanvasEdge(edgeId);
    broadcastUpdate({ type: 'edge_delete', edgeId });
  }, [removeCanvasEdge, broadcastUpdate]);

  // CXD Field sync wrapper functions
  const syncSensoryDomain = useCallback((code: SensoryDomainCode, value: number) => {
    updateSensoryDomain(code, value);
    broadcastUpdate({ type: 'field_update', path: ['sensoryDomains', code], value });
  }, [updateSensoryDomain, broadcastUpdate]);

  const syncPresenceType = useCallback((code: PresenceTypeCode, value: number) => {
    updatePresenceType(code, value);
    broadcastUpdate({ type: 'field_update', path: ['presenceTypes', code], value });
  }, [updatePresenceType, broadcastUpdate]);

  const syncRealityPlaneToggle = useCallback((code: RealityPlaneCode) => {
    toggleRealityPlane(code);
    broadcastUpdate({ type: 'field_update', path: ['realityPlanesV2', 'toggle'], value: code });
  }, [toggleRealityPlane, broadcastUpdate]);

  const syncRealityPlaneInterface = useCallback((code: RealityPlaneCode, interfaceModality: string) => {
    updateRealityPlaneInterface(code, interfaceModality);
    broadcastUpdate({ type: 'field_update', path: ['realityPlanesV2', code, 'interfaceModality'], value: interfaceModality });
  }, [updateRealityPlaneInterface, broadcastUpdate]);

  const syncStateMapping = useCallback((code: StateQuadrantCode, value: string) => {
    updateStateMapping(code, value);
    broadcastUpdate({ type: 'field_update', path: ['stateMapping', code], value });
  }, [updateStateMapping, broadcastUpdate]);

  const syncTraitMapping = useCallback((code: TraitQuadrantCode, value: string) => {
    updateTraitMapping(code, value);
    broadcastUpdate({ type: 'field_update', path: ['traitMapping', code], value });
  }, [updateTraitMapping, broadcastUpdate]);

  const syncIntentionCore = useCallback((field: 'projectName' | 'mainConcept' | 'coreMessage', value: string) => {
    if (field === 'projectName') updateIntentionProjectName(value);
    else if (field === 'mainConcept') updateIntentionMainConcept(value);
    else if (field === 'coreMessage') updateIntentionCoreMessage(value);
    broadcastUpdate({ type: 'field_update', path: ['intentionCore', field], value });
  }, [updateIntentionProjectName, updateIntentionMainConcept, updateIntentionCoreMessage, broadcastUpdate]);

  const syncDesiredChange = useCallback((field: 'insights' | 'feelings' | 'states' | 'knowledge', value: string) => {
    if (field === 'insights') updateDesiredInsights(value);
    else if (field === 'feelings') updateDesiredFeelings(value);
    else if (field === 'states') updateDesiredStates(value);
    else if (field === 'knowledge') updateDesiredKnowledge(value);
    broadcastUpdate({ type: 'field_update', path: ['desiredChange', field], value });
  }, [updateDesiredInsights, updateDesiredFeelings, updateDesiredStates, updateDesiredKnowledge, broadcastUpdate]);

  const syncHumanContext = useCallback((field: 'audienceNeeds' | 'audienceDesires' | 'userRole', value: string) => {
    if (field === 'audienceNeeds') updateHumanAudienceNeeds(value);
    else if (field === 'audienceDesires') updateHumanAudienceDesires(value);
    else if (field === 'userRole') updateHumanUserRole(value);
    broadcastUpdate({ type: 'field_update', path: ['humanContext', field], value });
  }, [updateHumanAudienceNeeds, updateHumanAudienceDesires, updateHumanUserRole, broadcastUpdate]);

  const syncContextMeaning = useCallback((field: 'world' | 'story' | 'magic', value: string) => {
    if (field === 'world') updateContextWorld(value);
    else if (field === 'story') updateContextStory(value);
    else if (field === 'magic') updateContextMagic(value);
    broadcastUpdate({ type: 'field_update', path: ['contextAndMeaning', field], value });
  }, [updateContextWorld, updateContextStory, updateContextMagic, broadcastUpdate]);

  const syncExperienceFlowNarrativeFunc = useCallback((code: ExperienceFlowStageCode, value: string) => {
    updateExperienceFlowNarrative(code, value);
    broadcastUpdate({ type: 'field_update', path: ['experienceFlow', code, 'narrativeNotes'], value });
  }, [updateExperienceFlowNarrative, broadcastUpdate]);

  const syncExperienceFlowIntentFunc = useCallback((code: ExperienceFlowStageCode, value: string) => {
    updateExperienceFlowIntent(code, value);
    broadcastUpdate({ type: 'field_update', path: ['experienceFlow', code, 'designIntent'], value });
  }, [updateExperienceFlowIntent, broadcastUpdate]);

  return (
    <CollaborationContext.Provider
      value={{
        collaborators,
        isConnected,
        currentUser,
        updateCursor,
        clearCursor,
        updateSelection,
        broadcastUpdate,
        syncAddElement,
        syncUpdateElement,
        syncRemoveElement,
        syncAddEdge,
        syncUpdateEdge,
        syncRemoveEdge,
        syncSensoryDomain,
        syncPresenceType,
        syncRealityPlaneToggle,
        syncRealityPlaneInterface,
        syncStateMapping,
        syncTraitMapping,
        syncIntentionCore,
        syncDesiredChange,
        syncHumanContext,
        syncContextMeaning,
        syncExperienceFlowNarrative: syncExperienceFlowNarrativeFunc,
        syncExperienceFlowIntent: syncExperienceFlowIntentFunc,
      }}
    >
      {children}
    </CollaborationContext.Provider>
  );
}

export function useCollaborationContext() {
  const context = useContext(CollaborationContext);
  if (!context) {
    // Return a no-op context for components outside the provider
    return {
      collaborators: [],
      isConnected: false,
      currentUser: null,
      updateCursor: () => {},
      clearCursor: () => {},
      updateSelection: () => {},
      broadcastUpdate: () => {},
      syncAddElement: () => {},
      syncUpdateElement: () => {},
      syncRemoveElement: () => {},
      syncAddEdge: () => {},
      syncUpdateEdge: () => {},
      syncRemoveEdge: () => {},
      syncSensoryDomain: () => {},
      syncPresenceType: () => {},
      syncRealityPlaneToggle: () => {},
      syncRealityPlaneInterface: () => {},
      syncStateMapping: () => {},
      syncTraitMapping: () => {},
      syncIntentionCore: () => {},
      syncDesiredChange: () => {},
      syncHumanContext: () => {},
      syncContextMeaning: () => {},
      syncExperienceFlowNarrative: () => {},
      syncExperienceFlowIntent: () => {},
    };
  }
  return context;
}
