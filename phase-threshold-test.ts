import { detectProjectPhase, calculateFaceIntensities } from './src/utils/diagnostic-engine';
import type { CXDProject } from './src/types/cxd-schema';

const createProject = (overrides: any): CXDProject => ({
  id: 'test', name: 'Test', description: '', canvasBackground: '', wizardCompleted: false,
  currentWizardStep: 0, shareToken: '', realityPlanesV2: [], sensoryDomains: {},
  presenceTypes: {}, stateMapping: {}, traitMapping: {}, contextAndMeaning: {},
  experienceFlowStages: [], experienceFlowDescription: '', canvasLayout: { elements: [], edges: [] },
  ...overrides
} as CXDProject);

console.log('Testing Phase Detection Thresholds:\n');

// Test 1: Exploring phase (avg < 0.3)
const exploring = createProject({ stateMapping: { s1: 'word' } }); // ~0.314 completion
const expInt = calculateFaceIntensities(exploring, []);
const expPhase = detectProjectPhase(expInt);
console.log(`Exploring: avg=${(Object.values(expInt).reduce((s,v) => s + v.completion, 0) / 6).toFixed(3)} → phase="${expPhase}"`);

// Test 2: Shaping phase (avg 0.3-0.7)
const shaping = createProject({
  stateMapping: { s1: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor' }, // ~50% completion
  traitMapping: { t1: 'Fast responsive' }, // ~30% completion
});
const shapeInt = calculateFaceIntensities(shaping, []);
const shapePhase = detectProjectPhase(shapeInt);
console.log(`Shaping: avg=${(Object.values(shapeInt).reduce((s,v) => s + v.completion, 0) / 6).toFixed(3)} → phase="${shapePhase}"`);

// Test 3: Refining phase (avg > 0.7)
const refining = createProject({
  realityPlanesV2: Array(7).fill({ enabled: true, interfaceModality: 'AR' }),
  sensoryDomains: { visual: 80, auditory: 80, tactile: 80, spatial: 80, emotional: 80 },
  presenceTypes: { p1: 80, p2: 80, p3: 80, p4: 80, p5: 80, p6: 80 },
  stateMapping: { s1: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim' },
  traitMapping: { t1: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim' },
  contextAndMeaning: { world: 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure dolor', story: 'Hero journey', magic: 'Transformation' }
});
const refInt = calculateFaceIntensities(refining, []);
const refPhase = detectProjectPhase(refInt);
console.log(`Refining: avg=${(Object.values(refInt).reduce((s,v) => s + v.completion, 0) / 6).toFixed(3)} → phase="${refPhase}"`);

// Verify thresholds
if (expPhase !== 'exploring') process.exit(1);
if (shapePhase !== 'shaping') process.exit(1);
if (refPhase !== 'refining') process.exit(1);

console.log('\n✅ All phase detection thresholds correct!');
