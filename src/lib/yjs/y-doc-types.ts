/**
 * Y.Doc Schema Type Constants
 *
 * Defines which CXDProject fields map to which Yjs shared types.
 * Used by the factory and serializers to consistently create and read the Y.Doc.
 */

// Top-level Y.Doc shared type names
export const YDOC_KEYS = {
  META: 'meta',
  ELEMENTS: 'elements',
  EDGES: 'edges',
  INTENTION_CORE: 'intentionCore',
  DESIRED_CHANGE: 'desiredChange',
  HUMAN_CONTEXT: 'humanContext',
  CONTEXT_AND_MEANING: 'contextAndMeaning',
  STATE_MAPPING: 'stateMapping',
  TRAIT_MAPPING: 'traitMapping',
  SENSORY_DOMAINS: 'sensoryDomains',
  PRESENCE_TYPES: 'presenceTypes',
  REALITY_PLANES: 'realityPlanes',
  REALITY_PLANES_V2: 'realityPlanesV2',
  EXPERIENCE_FLOW: 'experienceFlow',
  EXPERIENCE_FLOW_STAGES: 'experienceFlowStages',
  EXPERIENCE_FLOW_DESCRIPTION: 'experienceFlowDescription',
} as const;

// Meta fields stored as scalar values in the "meta" Y.Map
export const META_SCALAR_FIELDS = [
  'name',
  'description',
  'canvasBackground',
  'wizardCompleted',
  'currentWizardStep',
  'schemaVersion',
  'ownerId',
  'shareToken',
  'createdAt',
  'updatedAt',
] as const;

// Design section fields that use Y.Text (character-level CRDT)
export const YTEXT_DESIGN_FIELDS: Record<string, string[]> = {
  intentionCore: ['projectName', 'mainConcept', 'coreMessage'],
  desiredChange: ['insights', 'feelings', 'states', 'knowledge'],
  humanContext: ['audienceNeeds', 'audienceDesires', 'userRole'],
  contextAndMeaning: ['world', 'story', 'magic'],
  stateMapping: ['cognitive', 'emotional', 'somatic', 'relational'],
  traitMapping: ['cognitive', 'emotional', 'somatic', 'relational'],
};

// Design section fields that use scalar numbers in Y.Map
export const YNUMBER_DESIGN_FIELDS: Record<string, string[]> = {
  sensoryDomains: ['visual', 'auditory', 'olfactory', 'gustatory', 'haptic'],
  presenceTypes: ['mental', 'emotional', 'social', 'embodied', 'environmental', 'active'],
  realityPlanes: ['PR', 'VR', 'AR', 'MR', 'GR', 'BR', 'CR'],
};

// Canvas element fields that should be stored as Y.Text for character-level editing
export const ELEMENT_YTEXT_FIELDS = ['content', 'noteTitle', 'noteBody', 'label', 'title'] as const;

// Canvas element fields that are nested objects → Y.Map
export const ELEMENT_NESTED_FIELDS = ['style', 'taskMetadata', 'imageMeta', 'imageEdits', 'bend', 'start', 'end'] as const;

// Canvas edge fields that are nested objects → Y.Map
export const EDGE_NESTED_FIELDS = ['style', 'label', 'bend'] as const;

// Experience flow stage fields that use Y.Text
export const STAGE_YTEXT_FIELDS = ['name', 'narrativeNotes', 'designIntent'] as const;

// Experience flow stage fields that are nested Y.Map
export const STAGE_NESTED_FIELDS = ['engagementDistribution', 'presenceTypes', 'realityPlanes'] as const;

// Reality plane V2 fields that use Y.Text
export const REALITY_PLANE_V2_YTEXT_FIELDS = ['interfaceModality'] as const;
