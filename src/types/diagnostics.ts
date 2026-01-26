// Diagnostic Panel Data Model

export type DiagnosticCategory = 
  | 'balance' 
  | 'coverage' 
  | 'coherence' 
  | 'risk'
  | 'opportunity'
  | 'integration';

export type DiagnosticSeverity = 'info' | 'caution' | 'concern';

export interface Diagnostic {
  id: string;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  message: string;
  relatedFaces: string[]; // Face IDs this diagnostic relates to
  timestamp: number;
}

export interface DiagnosticState {
  balance: Diagnostic[];
  coverage: Diagnostic[];
  coherence: Diagnostic[];
  risk: Diagnostic[];
  opportunity: Diagnostic[];
  integration: Diagnostic[];
}
