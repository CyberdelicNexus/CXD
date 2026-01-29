// CXD Schema v1.0.0 - Cyberdelic Experience Design Canvas
// All vocabulary locked to PDF terms only

export const CXD_SCHEMA_VERSION = '1.0.0';

// Reality Planes - The 7 planes of reality
export type RealityPlaneCode = 'PR' | 'VR' | 'AR' | 'MR' | 'GR' | 'BR' | 'CR';

export interface RealityPlane {
  code: RealityPlaneCode;
  label: string;
  description: string;
  percent: number; // 0-100, no sum constraint (legacy)
}

// New V2 Reality Plane structure with toggle, interface/modality, and priority
export interface RealityPlaneV2 {
  code: RealityPlaneCode;
  enabled: boolean;
  interfaceModality: string; // Text field describing interface/modality
  priority: number; // Order/priority (lower = higher priority)
}

export const REALITY_PLANES: Omit<RealityPlane, 'percent'>[] = [
  { code: 'PR', label: 'Physical Reality', description: 'Space, materials, nature, physical props' },
  { code: 'VR', label: 'Virtual Reality', description: 'Headset-based immersive worlds' },
  { code: 'AR', label: 'Augmented Reality', description: 'Mobile or headset overlays, image tracking' },
  { code: 'MR', label: 'Mixed Reality', description: 'Holographic projection, depth-sensing' },
  { code: 'GR', label: 'Generative Reality', description: 'AI, procedural or algorithmic content' },
  { code: 'BR', label: 'Biological Reality', description: 'Biometric feedback, neuro-interfaces, breath sensors' },
  { code: 'CR', label: 'Cognitive Reality', description: 'Imagination, emotions, dreams, meta-cognition' },
];

// Default V2 Reality Planes with toggles and priority ordering
export const DEFAULT_REALITY_PLANES_V2: RealityPlaneV2[] = [
  { code: 'PR', enabled: true, interfaceModality: '', priority: 0 },
  { code: 'VR', enabled: false, interfaceModality: '', priority: 1 },
  { code: 'AR', enabled: false, interfaceModality: '', priority: 2 },
  { code: 'MR', enabled: false, interfaceModality: '', priority: 3 },
  { code: 'GR', enabled: false, interfaceModality: '', priority: 4 },
  { code: 'BR', enabled: false, interfaceModality: '', priority: 5 },
  { code: 'CR', enabled: false, interfaceModality: '', priority: 6 },
];

// Sensory Domains - The 5 external senses (no interoception)
export type SensoryDomainCode = 'visual' | 'auditory' | 'olfactory' | 'gustatory' | 'haptic';

export interface SensoryDomain {
  code: SensoryDomainCode;
  label: string;
  description: string;
  intensity: number; // 0-100
}

export const SENSORY_DOMAINS: Omit<SensoryDomain, 'intensity'>[] = [
  { code: 'visual', label: 'Visual', description: 'Sight and visual perception' },
  { code: 'auditory', label: 'Auditory', description: 'Sound and acoustic perception' },
  { code: 'olfactory', label: 'Olfactory', description: 'Smell and scent perception' },
  { code: 'gustatory', label: 'Gustatory', description: 'Taste perception' },
  { code: 'haptic', label: 'Haptic', description: 'Touch and tactile perception' },
];

// Presence Types - 6 types of presence
export type PresenceTypeCode = 'mental' | 'emotional' | 'social' | 'embodied' | 'environmental' | 'active';

export interface PresenceType {
  code: PresenceTypeCode;
  label: string;
  description: string;
  level: number; // 0-100
}

export const PRESENCE_TYPES: Omit<PresenceType, 'level'>[] = [
  { code: 'mental', label: 'Mental', description: 'Cognitive focus, lucidity, awareness' },
  { code: 'emotional', label: 'Emotional', description: 'Affective engagement, empathy, awe' },
  { code: 'social', label: 'Social', description: 'Connection with others, collective flow' },
  { code: 'embodied', label: 'Embodied', description: 'Physical sensation, movement, grounding' },
  { code: 'environmental', label: 'Environmental', description: 'Relationship with surroundings or space' },
  { code: 'active', label: 'Active', description: 'Dynamic participation, agency, play' },
];

// Experience Flow - 5 stages (legacy code type)
export type ExperienceFlowStageCode = 'preparation' | 'induction' | 'journey' | 'peak' | 'integration';

// Degree of Engagement distribution across 4 levels
export type EngagementLevelCode = 'observer' | 'engager' | 'coCreator' | 'architect';

export interface EngagementDistribution {
  observer: number; // 0-100
  engager: number; // 0-100
  coCreator: number; // 0-100
  architect: number; // 0-100
}

export const ENGAGEMENT_LEVELS: { code: EngagementLevelCode; label: string }[] = [
  { code: 'observer', label: 'Observer' },
  { code: 'engager', label: 'Engager' },
  { code: 'coCreator', label: 'Co-Creator' },
  { code: 'architect', label: 'Architect' },
];

export const DEFAULT_ENGAGEMENT_DISTRIBUTION: EngagementDistribution = {
  observer: 0,
  engager: 100,
  coCreator: 0,
  architect: 0,
};

// Stage Presence Types - 6 types of presence per stage
export type StagePresenceTypeCode = 'mental' | 'emotional' | 'social' | 'embodied' | 'environmental' | 'active';

export interface StagePresenceTypes {
  mental: number; // 0-100
  emotional: number; // 0-100
  social: number; // 0-100
  embodied: number; // 0-100
  environmental: number; // 0-100
  active: number; // 0-100
}

export const STAGE_PRESENCE_TYPES: { code: StagePresenceTypeCode; label: string; description: string }[] = [
  { code: 'mental', label: 'Mental', description: 'Cognitive focus, lucidity, awareness' },
  { code: 'emotional', label: 'Emotional', description: 'Affective engagement, empathy, awe' },
  { code: 'social', label: 'Social', description: 'Connection with others, collective flow' },
  { code: 'embodied', label: 'Embodied', description: 'Physical sensation, movement, grounding' },
  { code: 'environmental', label: 'Environmental', description: 'Relationship with surroundings or space' },
  { code: 'active', label: 'Active', description: 'Dynamic participation, agency, play' },
];

export const DEFAULT_STAGE_PRESENCE_TYPES: StagePresenceTypes = {
  mental: 50,
  emotional: 50,
  social: 0,
  embodied: 0,
  environmental: 0,
  active: 0,
};

// Legacy interface (kept for backwards compatibility)
export interface ExperienceFlowStage {
  code: ExperienceFlowStageCode;
  label: string;
  description: string;
  engagementLevel: number; // 0-100 (legacy, kept for backwards compatibility)
  engagementDistribution: EngagementDistribution;
  narrativeNotes: string;
  designIntent: string;
}

// New V2 interface for editable stages array
export interface ExperienceFlowStageV2 {
  id: string;
  name: string;
  narrativeNotes: string;
  engagementDistribution: EngagementDistribution;
  presenceTypes: StagePresenceTypes;
  designIntent: string;
  estimatedMinutes: number | null;
}

export const DEFAULT_EXPERIENCE_FLOW_STAGES: ExperienceFlowStageV2[] = [
  { id: 'preparation', name: 'Preparation', narrativeNotes: '', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION }, presenceTypes: { ...DEFAULT_STAGE_PRESENCE_TYPES }, designIntent: '', estimatedMinutes: null },
  { id: 'induction', name: 'Induction', narrativeNotes: '', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION }, presenceTypes: { ...DEFAULT_STAGE_PRESENCE_TYPES }, designIntent: '', estimatedMinutes: null },
  { id: 'journey', name: 'Journey', narrativeNotes: '', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION }, presenceTypes: { ...DEFAULT_STAGE_PRESENCE_TYPES }, designIntent: '', estimatedMinutes: null },
  { id: 'peak', name: 'Peak', narrativeNotes: '', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION }, presenceTypes: { ...DEFAULT_STAGE_PRESENCE_TYPES }, designIntent: '', estimatedMinutes: null },
  { id: 'integration', name: 'Integration', narrativeNotes: '', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION }, presenceTypes: { ...DEFAULT_STAGE_PRESENCE_TYPES }, designIntent: '', estimatedMinutes: null },
];

export const EXPERIENCE_FLOW_STAGES: Omit<ExperienceFlowStage, 'engagementLevel' | 'narrativeNotes' | 'designIntent'>[] = [
  { code: 'preparation', label: 'Preparation', description: 'Setting intentions and context', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION } },
  { code: 'induction', label: 'Induction', description: 'Entry into the experience', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION } },
  { code: 'journey', label: 'Journey', description: 'The core experiential passage', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION } },
  { code: 'peak', label: 'Peak', description: 'Moments of highest intensity', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION } },
  { code: 'integration', label: 'Integration', description: 'Processing and embodying insights', engagementDistribution: { ...DEFAULT_ENGAGEMENT_DISTRIBUTION } },
];

// State Mapping - 4 quadrants for designed states
export type StateQuadrantCode = 'cognitive' | 'emotional' | 'somatic' | 'relational';

export interface StateQuadrant {
  code: StateQuadrantCode;
  label: string;
  description: string;
  content: string;
}

export const STATE_QUADRANTS: Omit<StateQuadrant, 'content'>[] = [
  { code: 'cognitive', label: 'Cognitive', description: 'Mental states and thought patterns' },
  { code: 'emotional', label: 'Emotional', description: 'Feeling states and affects' },
  { code: 'somatic', label: 'Somatic', description: 'Body states and sensations' },
  { code: 'relational', label: 'Relational', description: 'Connection states with self, others, world' },
];

// Trait Mapping - 4 quadrants for lasting traits
export type TraitQuadrantCode = 'cognitive' | 'emotional' | 'somatic' | 'relational';

export interface TraitQuadrant {
  code: TraitQuadrantCode;
  label: string;
  description: string;
  content: string;
}

export const TRAIT_QUADRANTS: Omit<TraitQuadrant, 'content'>[] = [
  { code: 'cognitive', label: 'Cognitive', description: 'Lasting mental patterns and perspectives' },
  { code: 'emotional', label: 'Emotional', description: 'Enduring emotional capacities' },
  { code: 'somatic', label: 'Somatic', description: 'Embodied habits and responses' },
  { code: 'relational', label: 'Relational', description: 'Transformed ways of relating' },
];

// Intention Core - The essential vision
export interface IntentionCore {
  projectName: string;
  mainConcept: string;
  coreMessage: string; // This becomes the center of the canvas
}

// Desired Change (Objectives) - What transformation is sought
export interface DesiredChange {
  insights: string; // What insights should participants gain
  feelings: string; // What feelings should be evoked
  states: string; // What states should be induced
  knowledge: string; // What knowledge should be imparted
}

// Human Context - Understanding the audience
export interface HumanContext {
  audienceNeeds: string;
  audienceDesires: string;
  userRole: string; // The participant's role
}

// Context and Meaning - Core narrative elements (Meaning Architecture)
export interface ContextAndMeaning {
  world: string; // The world/setting of the experience
  story: string; // The narrative arc
  magic: string; // The mechanism intertwined with narrative
}

// CXD Section - All major sections of the canvas
export type CXDSectionId = 
  | 'intentionCore'
  | 'desiredChange'
  | 'humanContext'
  | 'contextAndMeaning'
  | 'realityPlanes'
  | 'sensoryDomains'
  | 'presence'
  | 'experienceFlow'
  | 'stateMapping'
  | 'traitMapping';

export interface CXDSection {
  id: CXDSectionId;
  label: string;
  description: string;
  position: { x: number; y: number };
  completed: boolean;
}

export const CXD_SECTIONS: CXDSection[] = [
  { id: 'intentionCore', label: 'Intention Core', description: 'Project Name, Main Concept, Core Message', position: { x: 600, y: 200 }, completed: false },
  { id: 'desiredChange', label: 'Desired Change', description: 'Insights, Feelings, States, Knowledge', position: { x: 200, y: 0 }, completed: false },
  { id: 'humanContext', label: 'Human Context', description: 'Audience Needs, Desires, User Role', position: { x: 1000, y: 0 }, completed: false },
  { id: 'contextAndMeaning', label: 'Meaning Architecture', description: 'World, Story, Magic', position: { x: 0, y: 400 }, completed: false },
  { id: 'realityPlanes', label: 'Reality Planes', description: 'PR, AR, VR, MR, GR, BR, CR', position: { x: 400, y: 400 }, completed: false },
  { id: 'sensoryDomains', label: 'Sensory Domains', description: 'Visual, Auditory, Olfactory, Gustatory, Haptic', position: { x: 800, y: 400 }, completed: false },
  { id: 'presence', label: 'Presence Types', description: '6 Types of Presence', position: { x: 1200, y: 400 }, completed: false },
  { id: 'experienceFlow', label: 'Experience Flow', description: 'Temporal Arc - 5 Stages', position: { x: 400, y: 800 }, completed: false },
  { id: 'stateMapping', label: 'State Mapping', description: 'Designed transient states', position: { x: 800, y: 800 }, completed: false },
  { id: 'traitMapping', label: 'Trait Mapping', description: 'Lasting transformations', position: { x: 1200, y: 800 }, completed: false },
];

// Complete CXD Project
export interface CXDProject {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: string;
  ownerId: string;
  shareToken?: string;
  
  // Section data
  intentionCore: IntentionCore;
  desiredChange: DesiredChange;
  humanContext: HumanContext;
  contextAndMeaning: ContextAndMeaning;
  realityPlanes: Record<RealityPlaneCode, number>; // Legacy percentage-based
  realityPlanesV2?: RealityPlaneV2[]; // New toggle-based with interface/modality and priority
  sensoryDomains: Record<SensoryDomainCode, number>;
  presenceTypes: Record<PresenceTypeCode, number>;
  experienceFlow: Record<ExperienceFlowStageCode, ExperienceFlowStage>;
  experienceFlowStages?: ExperienceFlowStageV2[]; // New editable stages array
  experienceFlowDescription?: string; // High-level flow description from wizard
  stateMapping: Record<StateQuadrantCode, string>;
  traitMapping: Record<TraitQuadrantCode, string>;
  
  // Canvas layout (persisted per project)
  canvasLayout?: {
    sectionPositions?: Record<string, { x: number; y: number }>;
    elements?: import('./canvas-elements').CanvasElement[];
    edges?: import('./canvas-elements').CanvasEdge[];
    boards?: import('./canvas-elements').CanvasBoard[];
  };
  
  // Wizard progress
  wizardCompleted: boolean;
  currentWizardStep: number;
}

// Default project factory
export function createDefaultProject(id: string, name: string, ownerId: string): CXDProject {
  return {
    id,
    name,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    schemaVersion: CXD_SCHEMA_VERSION,
    ownerId,
    
    // New wizard sections
    intentionCore: {
      projectName: name,
      mainConcept: '',
      coreMessage: '',
    },
    desiredChange: {
      insights: '',
      feelings: '',
      states: '',
      knowledge: '',
    },
    humanContext: {
      audienceNeeds: '',
      audienceDesires: '',
      userRole: '',
    },
    contextAndMeaning: {
      world: '',
      story: '',
      magic: '',
    },
    realityPlanes: {
      PR: 50,
      AR: 0,
      VR: 0,
      MR: 0,
      GR: 0,
      BR: 0,
      CR: 0,
    },
    realityPlanesV2: [
      { code: 'PR', enabled: true, interfaceModality: '', priority: 0 },
      { code: 'VR', enabled: false, interfaceModality: '', priority: 1 },
      { code: 'AR', enabled: false, interfaceModality: '', priority: 2 },
      { code: 'MR', enabled: false, interfaceModality: '', priority: 3 },
      { code: 'GR', enabled: false, interfaceModality: '', priority: 4 },
      { code: 'BR', enabled: false, interfaceModality: '', priority: 5 },
      { code: 'CR', enabled: false, interfaceModality: '', priority: 6 },
    ],
    sensoryDomains: {
      visual: 50,
      auditory: 50,
      olfactory: 0,
      gustatory: 0,
      haptic: 0,
    },
    presenceTypes: {
      mental: 50,
      emotional: 50,
      social: 50,
      embodied: 50,
      environmental: 50,
      active: 50,
    },
    experienceFlow: {
      preparation: { code: 'preparation', label: 'Preparation', description: 'Setting intentions and context', engagementLevel: 30, engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, narrativeNotes: '', designIntent: '' },
      induction: { code: 'induction', label: 'Induction', description: 'Entry into the experience', engagementLevel: 50, engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, narrativeNotes: '', designIntent: '' },
      journey: { code: 'journey', label: 'Journey', description: 'The core experiential passage', engagementLevel: 70, engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, narrativeNotes: '', designIntent: '' },
      peak: { code: 'peak', label: 'Peak', description: 'Moments of highest intensity', engagementLevel: 100, engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, narrativeNotes: '', designIntent: '' },
      integration: { code: 'integration', label: 'Integration', description: 'Processing and embodying insights', engagementLevel: 40, engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, narrativeNotes: '', designIntent: '' },
    },
    experienceFlowStages: [
      { id: 'preparation', name: 'Preparation', narrativeNotes: '', engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, presenceTypes: { mental: 50, emotional: 50, social: 0, embodied: 0, environmental: 0, active: 0 }, designIntent: '', estimatedMinutes: null },
      { id: 'induction', name: 'Induction', narrativeNotes: '', engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, presenceTypes: { mental: 50, emotional: 50, social: 0, embodied: 0, environmental: 0, active: 0 }, designIntent: '', estimatedMinutes: null },
      { id: 'journey', name: 'Journey', narrativeNotes: '', engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, presenceTypes: { mental: 50, emotional: 50, social: 0, embodied: 0, environmental: 0, active: 0 }, designIntent: '', estimatedMinutes: null },
      { id: 'peak', name: 'Peak', narrativeNotes: '', engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, presenceTypes: { mental: 50, emotional: 50, social: 0, embodied: 0, environmental: 0, active: 0 }, designIntent: '', estimatedMinutes: null },
      { id: 'integration', name: 'Integration', narrativeNotes: '', engagementDistribution: { observer: 0, engager: 100, coCreator: 0, architect: 0 }, presenceTypes: { mental: 50, emotional: 50, social: 0, embodied: 0, environmental: 0, active: 0 }, designIntent: '', estimatedMinutes: null },
    ],
    stateMapping: {
      cognitive: '',
      emotional: '',
      somatic: '',
      relational: '',
    },
    traitMapping: {
      cognitive: '',
      emotional: '',
      somatic: '',
      relational: '',
    },
    
    // High-level flow description
    experienceFlowDescription: '',
    
    // Canvas layout positions
    canvasLayout: {},
    
    wizardCompleted: false,
    currentWizardStep: 0,
  };
}

// Wizard Steps mapped to CXD sections
// Order: Intent → Meaning → Structure → Transformation
// This progression supports cognition by: starting with purpose, grounding in meaning, 
// building structural scaffolding, and ending with transformation outcomes.
export interface WizardStep {
  id: number;
  sectionId: CXDSectionId;
  title: string;
  question: string;
  intent: string; // One sentence explaining purpose of this step
  subQuestions?: string[];
}

export const WIZARD_STEPS: WizardStep[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: INTENTION CORE
  // Establishes the foundational vision before any design choices
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 0,
    sectionId: 'intentionCore',
    title: 'Intention Core',
    question: 'What is the essential vision and message of your experience?',
    intent: 'Anchor the design process with a clear, compelling center from which all decisions radiate.',
    subQuestions: [
      'Give your project a name that captures its essence.',
      'What is the main concept or big idea?',
      'What is the core message participants should receive?',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: DESIRED CHANGE (Objectives)
  // Defines what transformation is sought before designing how
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 1,
    sectionId: 'desiredChange',
    title: 'Desired Change',
    question: 'What transformation do you want to create in participants?',
    intent: 'Clarify the experiential objectives across cognitive, emotional, and somatic dimensions.',
    subQuestions: [
      'What insights should participants gain?',
      'What feelings should be evoked?',
      'What states should be induced?',
      'What knowledge should be imparted?',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: HUMAN CONTEXT
  // Grounds design in who will experience it and their role
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 2,
    sectionId: 'humanContext',
    title: 'Human Context',
    question: 'Who are your participants and what do they bring?',
    intent: 'Understand the audience deeply before architecting the experience around them.',
    subQuestions: [
      'What needs do your audience have?',
      'What desires drive them?',
      'What role will participants play? (Observer, protagonist, co-creator?)',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: MEANING ARCHITECTURE
  // Constructs the narrative container and mechanism
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 3,
    sectionId: 'contextAndMeaning',
    title: 'World',
    question: 'What is the world or setting of your experience?',
    intent: 'Establish the ontological container that holds the experience.',
    subQuestions: [
      'Describe the environment participants will inhabit.',
      'What rules govern this world?',
    ],
  },
  {
    id: 4,
    sectionId: 'contextAndMeaning',
    title: 'Story',
    question: 'What is the narrative arc of your experience?',
    intent: 'Define the dramatic structure that gives meaning to progression.',
    subQuestions: [
      'What journey will participants take?',
      'What tensions or transformations occur?',
    ],
  },
  {
    id: 5,
    sectionId: 'contextAndMeaning',
    title: 'Magic',
    question: 'What is the mechanism that creates transformation?',
    intent: 'Identify the core technology or practice enabling the designed change.',
    subQuestions: [
      'How does change happen?',
      'What technologies, practices, or interventions enable this?',
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: STRUCTURAL DESIGN
  // Configures the technical scaffolding of the experience
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 6,
    sectionId: 'realityPlanes',
    title: 'Reality Planes',
    question: 'Which planes of reality will your experience engage?',
    intent: 'Select and weight the reality modalities that will carry the experience.',
    subQuestions: ['Physical, Augmented, Virtual, Mixed, Geospatial, Biological, Consciousness'],
  },
  {
    id: 7,
    sectionId: 'sensoryDomains',
    title: 'Sensory Domains',
    question: 'Which senses will your experience prioritize?',
    intent: 'Define the sensory channels through which the experience will be delivered.',
    subQuestions: ['Visual, Auditory, Olfactory, Gustatory, Haptic'],
  },
  {
    id: 8,
    sectionId: 'presence',
    title: 'Presence Types',
    question: 'What types of presence do you want to cultivate?',
    intent: 'Configure the phenomenological texture of immersion.',
    subQuestions: ['Mental, Emotional, Social, Embodied, Environmental, Active'],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 6: INTEGRATION
  // Closes the loop by mapping states to lasting traits
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 9,
    sectionId: 'stateMapping',
    title: 'State Mapping',
    question: 'What transient states do you want to design for?',
    intent: 'Define the momentary experiential states across four quadrants.',
    subQuestions: ['Cognitive, Emotional, Somatic, Relational states during the experience'],
  },
  {
    id: 10,
    sectionId: 'traitMapping',
    title: 'Trait Mapping',
    question: 'What lasting traits should emerge from this experience?',
    intent: 'Connect designed states to enduring transformations that persist beyond the experience.',
    subQuestions: ['Cognitive, Emotional, Somatic, Relational transformations'],
  },
];
