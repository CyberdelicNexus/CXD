/**
 * Tests for diagnostic chat handoff - ensures clean user-facing messages
 */

import { generateDiagnostics } from '../diagnostic-engine';
import type { CXDProject } from '@/types/cxd-schema';
import { formatCompletion, clampToUnit, getFaceDisplayName } from '@/lib/display-utils';

const createMinimalProject = (overrides: Partial<CXDProject> = {}): CXDProject => ({
  id: 'test-project',
  name: 'Test Project',
  description: '',
  canvasBackground: '',
  wizardCompleted: false,
  currentWizardStep: 0,
  shareToken: '',
  realityPlanesV2: [],
  sensoryDomains: {},
  presenceTypes: {},
  stateMapping: {},
  traitMapping: {},
  contextAndMeaning: {},
  experienceFlowStages: [],
  experienceFlowDescription: '',
  canvasLayout: { elements: [], edges: [] },
  ...overrides,
} as CXDProject);

describe('Diagnostic Chat Handoff', () => {
  describe('Face name formatting', () => {
    it('should use proper display names, not camelCase', () => {
      const project = createMinimalProject({
        realityPlanesV2: [
          { code: 'RP1', label: 'Digital', enabled: true, interfaceModality: 'Web' },
          { code: 'RP2', label: 'Physical', enabled: true, interfaceModality: 'AR' },
          { code: 'RP3', label: 'Hybrid', enabled: true, interfaceModality: 'MR' },
        ],
        stateMapping: { NW: 'User feels engaged' }, // Triggers coverage diagnostic
      });

      const diagnostics = generateDiagnostics(project, []);
      const coverageDiag = diagnostics.find(d => d.category === 'coverage');

      expect(coverageDiag).toBeDefined();

      // Should NOT contain camelCase face keys
      expect(coverageDiag!.chatContext.issueSummary).not.toMatch(/realityPlanes|stateMapping|traitMapping|contextAndMeaning|sensoryDomains/);

      // Should contain properly formatted face name
      expect(coverageDiag!.chatContext.issueSummary).toContain('Reality Planes');
      expect(coverageDiag!.chatContext.dataPoints.face).toBe('Reality Planes');
    });

    it('should not have lowercase-start face names like "reality Planes"', () => {
      const project = createMinimalProject({
        stateMapping: { NW: 'User feels engaged' },
      });

      const diagnostics = generateDiagnostics(project, []);

      diagnostics.forEach(d => {
        expect(d.chatContext.issueSummary).not.toMatch(/reality Planes|state Mapping|trait Mapping/);
      });
    });
  });

  describe('Completion value formatting', () => {
    it('should not contain raw float values', () => {
      const project = createMinimalProject({
        realityPlanesV2: [
          { code: 'RP1', label: 'Digital', enabled: true, interfaceModality: 'Web' },
          { code: 'RP2', label: 'Physical', enabled: true, interfaceModality: 'AR' },
          { code: 'RP3', label: 'Hybrid', enabled: true, interfaceModality: 'MR' },
        ],
      });

      const diagnostics = generateDiagnostics(project, []);

      diagnostics.forEach(d => {
        const msgStr = JSON.stringify(d.chatContext);
        // No floats with 2+ decimal places in the message
        expect(msgStr).not.toMatch(/\d+\.\d{2,}/);
      });
    });

    it('should format completion as percentage when displayed to user', () => {
      const completion = 0.7285714285714286;
      const formatted = formatCompletion(completion);

      expect(formatted).toBe('73%');
      expect(formatted).not.toContain('0.72');
    });

    it('should clamp completion values above 1', () => {
      const outOfRange = 603.42857142857144;
      const clamped = clampToUnit(outOfRange, 'test');

      expect(clamped).toBe(1);

      const formatted = formatCompletion(outOfRange);
      expect(formatted).toBe('100%');
      expect(formatted).not.toContain('603');
    });

    it('should clamp completion values below 0', () => {
      const negative = -0.5;
      const clamped = clampToUnit(negative, 'test');

      expect(clamped).toBe(0);

      const formatted = formatCompletion(negative);
      expect(formatted).toBe('0%');
    });
  });

  describe('Debug string removal', () => {
    it('should not contain Context:- debug strings', () => {
      const project = createMinimalProject({
        stateMapping: { NW: 'User feels engaged' },
      });

      const diagnostics = generateDiagnostics(project, []);

      diagnostics.forEach(d => {
        expect(d.chatContext.issueSummary).not.toMatch(/Context:-/);

        // Also check the data points don't leak into summary
        expect(d.chatContext.issueSummary).not.toContain('- face:');
        expect(d.chatContext.issueSummary).not.toContain('- completion:');
        expect(d.chatContext.issueSummary).not.toContain('- elementCount:');
      });
    });
  });

  describe('User message simulation', () => {
    it('should produce clean user-visible messages', () => {
      const project = createMinimalProject({
        realityPlanesV2: [
          { code: 'RP1', label: 'Digital', enabled: true, interfaceModality: 'Web' },
          { code: 'RP2', label: 'Physical', enabled: true, interfaceModality: 'AR' },
          { code: 'RP3', label: 'Hybrid', enabled: true, interfaceModality: 'MR' },
        ],
      });

      const diagnostics = generateDiagnostics(project, []);
      const diagnostic = diagnostics[0];

      // Simulate what ai-chat-panel.tsx does
      const completionValue = diagnostic.chatContext.dataPoints.completion ??
                              diagnostic.chatContext.dataPoints.stateCompletion ??
                              diagnostic.chatContext.dataPoints.traitCompletion;

      let userMessage = diagnostic.chatContext.issueSummary;

      if (typeof completionValue === 'number') {
        const pct = formatCompletion(clampToUnit(completionValue, 'test'));
        userMessage += ` (${pct} complete)`;
      }

      // Verify the final user message is clean
      expect(userMessage).not.toMatch(/realityPlanes|stateMapping|traitMapping/);
      expect(userMessage).not.toMatch(/\d+\.\d{3,}/);
      expect(userMessage).not.toMatch(/Context:-/);
      expect(userMessage).toContain('Reality Planes');
      expect(userMessage).toMatch(/\d+% complete/);
    });
  });

  describe('Face display name utility', () => {
    it('should convert all face keys to proper display names', () => {
      expect(getFaceDisplayName('realityPlanes')).toBe('Reality Planes');
      expect(getFaceDisplayName('sensoryDomains')).toBe('Sensory Domains');
      expect(getFaceDisplayName('presence')).toBe('Presence Types');
      expect(getFaceDisplayName('stateMapping')).toBe('State Mapping');
      expect(getFaceDisplayName('traitMapping')).toBe('Trait Mapping');
      expect(getFaceDisplayName('contextAndMeaning')).toBe('Meaning Architecture');
    });

    it('should pass through unknown keys unchanged', () => {
      expect(getFaceDisplayName('unknownFace')).toBe('unknownFace');
    });
  });
});
