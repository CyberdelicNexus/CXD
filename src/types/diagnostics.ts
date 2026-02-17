// Diagnostic Panel Data Model

export type DiagnosticCategory =
  | 'balance'
  | 'coverage'
  | 'coherence'
  | 'risk'
  | 'opportunity'
  | 'integration';

export type DiagnosticSeverity = 'info' | 'caution' | 'concern';

export type ProjectPhase = 'exploring' | 'shaping' | 'refining';

export interface Diagnostic {
  id: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  message: string;
  relatedFaces: string[]; // Face IDs this diagnostic relates to
  timestamp: number;
}

/**
 * Layer 1: Enriched Diagnostic with phase awareness and structured context
 */
export interface EnrichedDiagnostic extends Diagnostic {
  /** Project phase when this diagnostic was generated */
  phase: ProjectPhase;

  /** Structured click-to-chat payload for AI contextualization */
  chatContext: {
    /** Summary of the issue for AI prompt */
    issueSummary: string;
    /** Relevant data points (completion scores, element counts, etc.) */
    dataPoints: Record<string, number | string>;
    /** Suggested questions the user might ask */
    suggestedQuestions: string[];
    /** Related face IDs for filtering canvas elements */
    relatedFaceIds: string[];
    /** If present, use only this question instead of full diagnostic */
    userQuestion?: string;
  };

  /** Delta tracking: what changed to trigger this diagnostic */
  delta?: {
    /** Field that changed (e.g., 'stateMapping.completion') */
    changedField: string;
    /** Previous value */
    previousValue: number | string;
    /** Current value */
    currentValue: number | string;
  };

  /** Cooldown metadata for deduplication */
  cooldown?: {
    /** Hash key for identifying duplicate diagnostics */
    hashKey: string;
    /** When this diagnostic can be shown again (timestamp) */
    nextShowTime: number;
  };
}

export interface DiagnosticState {
  balance: Diagnostic[];
  coverage: Diagnostic[];
  coherence: Diagnostic[];
  risk: Diagnostic[];
  opportunity: Diagnostic[];
  integration: Diagnostic[];
}

/**
 * Layer 3: Diagnostic Feedback Tracking
 *
 * Tracks user engagement with diagnostics to learn which insights are most valuable.
 */
export interface DiagnosticFeedback {
  /** Diagnostic ID that received feedback */
  diagnosticId: string;
  /** Diagnostic hash key for aggregating feedback across sessions */
  diagnosticHashKey: string;
  /** Timestamp when feedback was recorded */
  timestamp: number;
  /** Type of interaction */
  interactionType: 'viewed' | 'ai_chat_opened' | 'face_clicked' | 'dismissed';
  /** Project phase when interaction occurred */
  phase: ProjectPhase;
  /** Optional: Was the diagnostic helpful? (explicit user feedback) */
  wasHelpful?: boolean;
  /** Optional: Time spent viewing diagnostic (ms) */
  viewDuration?: number;
}

/**
 * Layer 3: Aggregated feedback for a diagnostic pattern
 */
export interface DiagnosticFeedbackStats {
  /** Diagnostic hash key */
  hashKey: string;
  /** Total times this diagnostic was viewed */
  viewCount: number;
  /** Total times AI chat was opened from this diagnostic */
  chatOpenCount: number;
  /** Total times face was clicked from this diagnostic */
  faceClickCount: number;
  /** Total times diagnostic was dismissed */
  dismissCount: number;
  /** Engagement rate: (chatOpen + faceClick) / viewCount */
  engagementRate: number;
  /** Average time spent viewing (ms) */
  avgViewDuration: number;
  /** Explicit helpfulness rating (0-1, null if no ratings) */
  helpfulnessRating: number | null;
  /** Last interaction timestamp */
  lastInteraction: number;
}
