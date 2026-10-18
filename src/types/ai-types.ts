// AI Intelligence Layer - Type Definitions

// ============================================================
// Context Aggregator Types
// ============================================================

export interface AIProjectContext {
  version: string;
  projectId: string;
  projectName: string;
  lastUpdated: string;
  framing: FramingContext;
  canvas: CanvasContext;
  map: MapContext;
  plan: PlanContext;
}

export interface FramingContext {
  lastUpdated: string;
  intentionCore: {
    projectName: string;
    mainConcept: string;
    coreMessage: string;
  };
  desiredChange: {
    insights: string;
    feelings: string;
    states: string;
    knowledge: string;
  };
  humanContext: {
    audienceNeeds: string;
    audienceDesires: string;
    userRole: string;
  };
  contextAndMeaning: {
    world: string;
    story: string;
    magic: string;
  };
  experienceFlow: {
    description: string;
    stages: {
      id: string;
      name: string;
      narrativeNotes: string;
      estimatedMinutes: number | null;
      engagementDistribution: Record<string, number>;
      presenceTypes: Record<string, number>;
      realityPlanes: Record<string, boolean>;
    }[];
  };
}

export interface CanvasContext {
  lastUpdated: string;
  elementCount: number;
  elementSummary: { type: string; count: number }[];
  boards: { id: string; title: string; elementCount: number }[];
  connectorCount: number;
  contentDigest: string;
}

export interface MapContext {
  lastUpdated: string;
  faces: FaceContext[];
  diagnostics: { category: string; severity: string; message: string; relatedFaces: string[] }[];
  overallCompletion: number;
}

export interface FaceContext {
  id: string;
  label: string;
  completion: number;
  coherence: number;
  state: string;
  taggedElementCount: number;
  taggedElements: { id: string; title: string; excerpt: string }[];
  data: Record<string, unknown>;
  starredMessages: { content: string; timestamp: number }[];
  /** Layer 3: Face-specific AI persona for contextualized guidance */
  persona?: {
    role: string;
    tone: string;
    focus: string;
    questions: string[];
  } | null;
}

export interface PlanContext {
  lastUpdated: string;
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  upcomingDeadlines: { title: string; dueDate: string }[];
}

// ============================================================
// Chat Types
// ============================================================

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  faceKey?: string;
  isStarred?: boolean;
  modelUsed?: string;
  tokenCount?: number;
  tier?: 'chat' | 'analysis';
}

export interface ChatThread {
  id: string;
  projectId: string;
  userId: string;
  faceKey: string;
  messages: AIChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Model & Provider Types
// ============================================================

export type AIProviderKey = 'claude' | 'gemini' | 'kimi';
export type AIModelTier = 'chat' | 'analysis';

export interface AIModelConfig {
  provider: AIProviderKey;
  tier: AIModelTier;
  modelId: string;
  displayName: string;
  costMultiplier: number;
  maxTokens: number;
}

// ============================================================
// Credit System Types
// ============================================================

export interface UserAICredits {
  userId: string;
  monthlyAllowance: number;
  usedThisPeriod: number;
  addonCredits: number;
  periodStart: string;
  periodEnd: string;
  selectedModel: AIProviderKey;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  balanceAfter: number;
  reason: string;
  modelUsed?: string;
  projectId?: string;
  faceKey?: string;
  createdAt: string;
}

export type CreditAction = 'chat' | 'suggestion' | 'analyze' | 'erd' | 'generateElements' | 'canvasOperations';

export const CREDIT_COSTS: Record<CreditAction, Record<AIProviderKey, number>> = {
  chat: { claude: 2, gemini: 1, kimi: 1 },
  suggestion: { claude: 2, gemini: 1, kimi: 1 },
  analyze: { claude: 8, gemini: 4, kimi: 5 },
  erd: { claude: 20, gemini: 12, kimi: 15 },
  generateElements: { claude: 10, gemini: 5, kimi: 6 },
  canvasOperations: { claude: 8, gemini: 4, kimi: 5 },
};
