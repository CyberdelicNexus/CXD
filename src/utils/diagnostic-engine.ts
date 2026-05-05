import { Diagnostic, DiagnosticCategory, DiagnosticSeverity, EnrichedDiagnostic, ProjectPhase } from "@/types/diagnostics";
import { CXDProject } from "@/types/cxd-schema";
import { CanvasElement, HypercubeFaceTag } from "@/types/canvas-elements";
import { getFaceDisplayName, clampToUnit } from "@/lib/display-utils";

// Map section IDs to hypercube face tags
const SECTION_TO_TAG: Record<string, HypercubeFaceTag> = {
  realityPlanes: 'Reality Planes',
  sensoryDomains: 'Sensory Domains',
  presence: 'Presence Types',
  stateMapping: 'State Mapping',
  traitMapping: 'Trait Mapping',
  contextAndMeaning: 'Meaning Architecture',
};

// ─── Intensity Model Configuration ──────────────────────────────────────────
// Tunable constants for graded completion and coherence scoring

const INTENSITY_CONFIG = {
  // Completion thresholds: word counts for full completion (1.0)
  TARGET_STATE_WORDS: 50,      // Words needed for full state mapping completion
  TARGET_TRAIT_WORDS: 50,      // Words needed for full trait mapping completion
  TARGET_MEANING_WORDS: 100,   // Words needed for full meaning architecture completion

  // Coherence thresholds: tagged element counts for full coherence (1.0)
  TARGET_TAGGED_ELEMENTS: 5,   // Elements tagged to a face for full coherence

  // Completion scoring: base score given for any content
  BASE_COMPLETION: 0.3,        // Starting completion for any text (prevents binary 0)

  // Coherence scoring: base score given for existence
  BASE_COHERENCE: 0.5,         // Starting coherence when face has structure (prevents binary 0)
} as const;

export interface FaceIntensity {
  completion: number;
  coherence: number;
  elementCount: number;
  state: 'undeveloped' | 'emerging' | 'active' | 'coherent';
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function getTaggedElementsForFace(elements: CanvasElement[], faceTag: HypercubeFaceTag): CanvasElement[] {
  return elements.filter((el: CanvasElement) => el.hypercubeTags?.includes(faceTag));
}

/**
 * Count words in a text string (simple whitespace split).
 * Returns 0 for empty/null/undefined strings.
 */
function countWords(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Calculate graded completion score based on word count.
 * Formula: min(BASE_COMPLETION + (wordCount / targetWords) * (1 - BASE_COMPLETION), 1.0)
 *
 * Examples (with BASE_COMPLETION=0.3, targetWords=50):
 * - 0 words → 0.3 (base score for structure existing)
 * - 1 word → 0.314 (not 0.7, demonstrates gradation)
 * - 25 words → 0.65 (halfway)
 * - 50+ words → 1.0 (full completion)
 */
function calculateCompletionFromWords(wordCount: number, targetWords: number): number {
  if (wordCount === 0) return 0; // No content at all = 0
  const ratio = wordCount / targetWords;
  return Math.min(INTENSITY_CONFIG.BASE_COMPLETION + ratio * (1 - INTENSITY_CONFIG.BASE_COMPLETION), 1.0);
}

/**
 * Calculate graded coherence score based on tagged element count.
 * Formula: min(BASE_COHERENCE + (taggedCount / targetCount) * (1 - BASE_COHERENCE), 1.0)
 *
 * Examples (with BASE_COHERENCE=0.5, targetCount=5):
 * - 0 tagged → 0.5 (base coherence for face structure existing)
 * - 1 tagged → 0.6 (not 1.0, demonstrates gradation)
 * - 3 tagged → 0.8
 * - 5+ tagged → 1.0 (full coherence)
 */
function calculateCoherenceFromTagged(taggedCount: number): number {
  const ratio = taggedCount / INTENSITY_CONFIG.TARGET_TAGGED_ELEMENTS;
  return Math.min(INTENSITY_CONFIG.BASE_COHERENCE + ratio * (1 - INTENSITY_CONFIG.BASE_COHERENCE), 1.0);
}

// ─── Phase Detection ────────────────────────────────────────────────────────

/**
 * Detect the current project phase based on face intensity patterns.
 *
 * Phase classification:
 * - **Exploring** (avg completion < 0.3): Early experimentation, discovering possibilities
 * - **Shaping** (avg completion 0.3-0.7): Defining structure, establishing patterns
 * - **Refining** (avg completion > 0.7): Optimizing details, high coherence focus
 *
 * This affects which diagnostics are shown and how AI contextualizes them.
 */
export function detectProjectPhase(intensities: Record<string, FaceIntensity>): ProjectPhase {
  const completionValues = Object.values(intensities).map(i => i.completion);
  const avgCompletion = completionValues.reduce((sum, v) => sum + v, 0) / completionValues.length;

  if (avgCompletion < 0.3) {
    return 'exploring';
  } else if (avgCompletion < 0.7) {
    return 'shaping';
  } else {
    return 'refining';
  }
}

export function calculateFaceIntensities(project: CXDProject, elements: CanvasElement[]): Record<string, FaceIntensity> {
  const intensities: Record<string, FaceIntensity> = {};

  // Reality Planes
  const planes = project.realityPlanesV2 || [];
  const activePlanes = planes.filter((p: any) => p.enabled);
  const wellDefinedPlanes = activePlanes.filter((p: any) => p.interfaceModality && p.interfaceModality.trim().length > 0);
  intensities.realityPlanes = {
    completion: activePlanes.length / 7,
    coherence: activePlanes.length > 0 ? wellDefinedPlanes.length / activePlanes.length : 0.5,
    elementCount: getTaggedElementsForFace(elements, 'Reality Planes').length,
    state: activePlanes.length === 0 ? 'undeveloped' : activePlanes.length < 3 ? 'emerging' : wellDefinedPlanes.length / activePlanes.length > 0.7 ? 'coherent' : 'active'
  };

  // Sensory Domains
  const domains = project.sensoryDomains || {};
  const domainValues = Object.values(domains);
  const activeDomainCount = domainValues.filter((v: any) => v > 0).length;
  const avgDomainValue = domainValues.reduce((sum: number, v: any) => sum + v, 0) / domainValues.length;

  // Calculate coherence using coefficient of variation (CV = stdDev / mean)
  // Lower CV = more balanced = higher coherence
  let sensoryCoherence = INTENSITY_CONFIG.BASE_COHERENCE;
  if (avgDomainValue > 0) {
    const variance = domainValues.reduce((sum: number, v: any) => sum + Math.pow(v - avgDomainValue, 2), 0) / domainValues.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avgDomainValue;
    // CV of 0 = perfect balance (coherence 1.0), CV of 1+ = high variance (coherence approaches 0)
    sensoryCoherence = 1 - Math.min(coefficientOfVariation, 1);
  }

  intensities.sensoryDomains = {
    completion: activeDomainCount / 5,
    coherence: sensoryCoherence,
    elementCount: getTaggedElementsForFace(elements, 'Sensory Domains').length,
    state: activeDomainCount === 0 ? 'undeveloped' : activeDomainCount < 3 ? 'emerging' : avgDomainValue > 70 ? 'active' : 'coherent'
  };

  // Presence Types
  const presenceTypes = project.presenceTypes || {};
  const presenceValues = Object.values(presenceTypes).filter((v: any) => v > 0);
  const maxPresence = presenceValues.length > 0 ? Math.max(...presenceValues) : 0;
  const avgPresence = presenceValues.length > 0 ? presenceValues.reduce((sum: number, v: any) => sum + v, 0) / presenceValues.length : 0;
  intensities.presence = {
    completion: presenceValues.length / 6,
    coherence: maxPresence > 0 ? avgPresence / maxPresence : 0.5,
    elementCount: getTaggedElementsForFace(elements, 'Presence Types').length,
    state: presenceValues.length === 0 ? 'undeveloped' : presenceValues.length < 3 ? 'emerging' : presenceValues.length > 4 ? 'coherent' : 'active'
  };

  // State Mapping
  const states = project.stateMapping || {};
  const stateValues = Object.values(states);
  const totalStateWords = stateValues.reduce((sum: number, v: any) => sum + countWords(v), 0);
  const stateTaggedCount = getTaggedElementsForFace(elements, 'State Mapping').length;
  intensities.stateMapping = {
    completion: calculateCompletionFromWords(totalStateWords, INTENSITY_CONFIG.TARGET_STATE_WORDS),
    coherence: calculateCoherenceFromTagged(stateTaggedCount),
    elementCount: stateTaggedCount,
    state: totalStateWords === 0 ? 'undeveloped' : stateTaggedCount === 0 ? 'emerging' : 'coherent'
  };

  // Trait Mapping
  const traits = project.traitMapping || {};
  const traitValues = Object.values(traits);
  const totalTraitWords = traitValues.reduce((sum: number, v: any) => sum + countWords(v), 0);
  const traitTaggedCount = getTaggedElementsForFace(elements, 'Trait Mapping').length;
  intensities.traitMapping = {
    completion: calculateCompletionFromWords(totalTraitWords, INTENSITY_CONFIG.TARGET_TRAIT_WORDS),
    coherence: calculateCoherenceFromTagged(traitTaggedCount),
    elementCount: traitTaggedCount,
    state: totalTraitWords === 0 ? 'undeveloped' : traitTaggedCount === 0 ? 'emerging' : 'coherent'
  };

  // Meaning Architecture
  const meaning = project.contextAndMeaning || {};
  const totalMeaningWords = countWords(meaning.world) + countWords(meaning.story) + countWords(meaning.magic);
  const meaningTaggedCount = getTaggedElementsForFace(elements, 'Meaning Architecture').length;
  const hasAnyMeaning = totalMeaningWords > 0;
  intensities.contextAndMeaning = {
    completion: calculateCompletionFromWords(totalMeaningWords, INTENSITY_CONFIG.TARGET_MEANING_WORDS),
    coherence: calculateCoherenceFromTagged(meaningTaggedCount),
    elementCount: meaningTaggedCount,
    state: !hasAnyMeaning ? 'undeveloped' : totalMeaningWords < 30 ? 'emerging' : meaningTaggedCount > 2 ? 'coherent' : 'active'
  };

  return intensities;
}

/**
 * Layer 1: Generate enriched diagnostics with phase awareness and structured context.
 *
 * @param previousDiagnostics - Previous diagnostics for cooldown/deduplication (optional)
 */
export function generateDiagnostics(
  project: CXDProject,
  elements: CanvasElement[],
  previousDiagnostics?: EnrichedDiagnostic[]
): EnrichedDiagnostic[] {
  const diagnostics: EnrichedDiagnostic[] = [];
  const intensities = calculateFaceIntensities(project, elements);
  const currentPhase = detectProjectPhase(intensities);
  let diagnosticId = 0;

  // Helper: Create enriched diagnostic with structured context
  const createEnrichedDiagnostic = (
    baseDiagnostic: Omit<Diagnostic, 'id' | 'timestamp'>,
    chatContext: EnrichedDiagnostic['chatContext']
  ): EnrichedDiagnostic => {
    const diagnostic: EnrichedDiagnostic = {
      id: `diag-${diagnosticId++}`,
      timestamp: Date.now(),
      phase: currentPhase,
      chatContext,
      ...baseDiagnostic,
    };

    // Add cooldown hash for deduplication (24-hour cooldown)
    const hashKey = `${diagnostic.category}-${diagnostic.message.slice(0, 30)}`;
    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours

    // Check if this diagnostic was recently shown
    const recentDuplicate = previousDiagnostics?.find(
      (prev) => prev.cooldown?.hashKey === hashKey
    );
    if (recentDuplicate && recentDuplicate.cooldown) {
      const now = Date.now();
      if (now < recentDuplicate.cooldown.nextShowTime) {
        // Skip this diagnostic (still in cooldown)
        return null as any; // Will be filtered out
      }
    }

    diagnostic.cooldown = {
      hashKey,
      nextShowTime: Date.now() + cooldownMs,
    };

    return diagnostic;
  };

  // BALANCE DIAGNOSTICS
  const completionValues = Object.entries(intensities).map(([key, val]) => ({ key, completion: val.completion }));
  const maxCompletion = Math.max(...completionValues.map(v => v.completion));
  const minCompletion = Math.min(...completionValues.map(v => v.completion));

  if (maxCompletion - minCompletion > 0.5) {
    const dominantFace = completionValues.find(v => v.completion === maxCompletion);
    const weakFaces = completionValues.filter(v => v.completion < 0.3).map(v => v.key);

    if (dominantFace && weakFaces.length > 0) {
      const dominantName = getFaceDisplayName(dominantFace.key);
      const weakNames = weakFaces.map(f => getFaceDisplayName(f)).join(' and ');
      const enriched = createEnrichedDiagnostic(
        {
          category: 'balance',
          severity: 'caution',
          message: `${dominantName} is dominant while ${weakNames} ${weakFaces.length === 1 ? 'remains' : 'remain'} underrepresented.`,
          relatedFaces: [dominantFace.key, ...weakFaces],
        },
        {
          issueSummary: `Design is over-focused on ${dominantName} at the expense of ${weakNames}.`,
          dataPoints: {
            dominantFace: dominantName,
            dominantCompletion: dominantFace.completion,
            weakFaces: weakNames,
            completionGap: maxCompletion - minCompletion,
          },
          suggestedQuestions: [
            `How can I develop ${weakNames} to balance my design?`,
            `What are the risks of neglecting ${weakNames}?`,
            `Should I reduce focus on ${dominantName}?`,
          ],
          relatedFaceIds: [dominantFace.key, ...weakFaces],
        }
      );
      if (enriched) diagnostics.push(enriched);
    }
  }

  // Sensory overload check
  const sensory = intensities.sensoryDomains;
  if (sensory.completion > 0.8) {
    const presence = intensities.presence;
    if (presence.completion < 0.3) {
      const enriched = createEnrichedDiagnostic(
        {
          category: 'balance',
          severity: 'caution',
          message: 'High sensory activation with minimal presence definition may fragment attention.',
          relatedFaces: ['sensoryDomains', 'presence'],
        },
        {
          issueSummary: 'High sensory engagement without defined presence types risks overwhelming users.',
          dataPoints: {
            sensoryCompletion: sensory.completion,
            presenceCompletion: presence.completion,
            gap: sensory.completion - presence.completion,
          },
          suggestedQuestions: [
            'How should I define presence types to support this sensory load?',
            'What presence qualities prevent sensory overwhelm?',
            'Which sensory domains need presence grounding?',
          ],
          relatedFaceIds: ['sensoryDomains', 'presence'],
        }
      );
      if (enriched) diagnostics.push(enriched);
    }
  }

  // COVERAGE DIAGNOSTICS
  Object.entries(intensities).forEach(([faceId, intensity]) => {
    if (intensity.completion > 0.3 && intensity.elementCount === 0) {
      const faceName = getFaceDisplayName(faceId);
      const enriched = createEnrichedDiagnostic(
        {
          category: 'coverage',
          severity: 'info',
          message: `No canvas elements tagged to ${faceName}.`,
          relatedFaces: [faceId],
        },
        {
          issueSummary: `${faceName} has structure defined but no visual artifacts on canvas.`,
          dataPoints: {
            face: faceName,
            completion: clampToUnit(intensity.completion, `${faceId}.completion`),
            elementCount: 0,
          },
          suggestedQuestions: [
            `What canvas elements should I create for ${faceName}?`,
            `How do I tag existing elements to ${faceName}?`,
          ],
          relatedFaceIds: [faceId],
        }
      );
      if (enriched) diagnostics.push(enriched);
    }
  });

  // Meaning Architecture gap
  if (intensities.contextAndMeaning.completion < 0.3) {
    const anyActive = Object.values(intensities).some(i => i.completion > 0.5);
    if (anyActive) {
      const enriched = createEnrichedDiagnostic(
        {
          category: 'coverage',
          severity: 'concern',
          message: 'Active experience design without grounding in Meaning Architecture.',
          relatedFaces: ['contextAndMeaning'],
        },
        {
          issueSummary: 'Design lacks narrative foundation—may feel hollow or disconnected.',
          dataPoints: {
            meaningCompletion: intensities.contextAndMeaning.completion,
            hasActiveDesign: anyActive ? 'yes' : 'no',
          },
          suggestedQuestions: [
            'What is the world, story, and magic of this experience?',
            'How does meaning anchor the other design elements?',
            'What emotional or conceptual core should users grasp?',
          ],
          relatedFaceIds: ['contextAndMeaning'],
        }
      );
      if (enriched) diagnostics.push(enriched);
    }
  }

  // COHERENCE DIAGNOSTICS
  // States without traits
  const states = intensities.stateMapping;
  const traits = intensities.traitMapping;
  if (states.completion > 0.5 && traits.completion < 0.3) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'coherence',
        severity: 'caution',
        message: 'States are defined without downstream Trait Mapping for integration.',
        relatedFaces: ['stateMapping', 'traitMapping'],
      },
      {
        issueSummary: 'State Mapping exists but lacks Trait Mapping to translate states into tangible outcomes.',
        dataPoints: {
          stateCompletion: states.completion,
          traitCompletion: traits.completion,
          gap: states.completion - traits.completion,
        },
        suggestedQuestions: [
          'What traits or outcomes should these states produce?',
          'How do internal states manifest as observable characteristics?',
          'What does success look like when users reach these states?',
        ],
        relatedFaceIds: ['stateMapping', 'traitMapping'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Traits without states
  if (traits.completion > 0.5 && states.completion < 0.3) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'coherence',
        severity: 'info',
        message: 'Trait outcomes specified without upstream State Mapping to reach them.',
        relatedFaces: ['stateMapping', 'traitMapping'],
      },
      {
        issueSummary: 'Trait Mapping defines outcomes but lacks State Mapping to show the internal journey.',
        dataPoints: {
          traitCompletion: traits.completion,
          stateCompletion: states.completion,
          gap: traits.completion - states.completion,
        },
        suggestedQuestions: [
          'What internal states lead users to these traits?',
          'What psychological shifts precede these outcomes?',
          'How do users transition from their current state to these traits?',
        ],
        relatedFaceIds: ['stateMapping', 'traitMapping'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Reality planes without sensory
  const reality = intensities.realityPlanes;
  const sensoryDomains = intensities.sensoryDomains;
  if (reality.completion > 0.5 && sensoryDomains.completion < 0.2) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'coherence',
        severity: 'info',
        message: 'Technical substrate defined without sensory embodiment layer.',
        relatedFaces: ['realityPlanes', 'sensoryDomains'],
      },
      {
        issueSummary: 'Reality Planes are configured but lack sensory design to make them experientially real.',
        dataPoints: {
          realityCompletion: reality.completion,
          sensoryCompletion: sensoryDomains.completion,
          gap: reality.completion - sensoryDomains.completion,
        },
        suggestedQuestions: [
          'How should users perceive these technical layers?',
          'What sensory modalities bring these planes to life?',
          'Which reality plane demands the strongest sensory presence?',
        ],
        relatedFaceIds: ['realityPlanes', 'sensoryDomains'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // RISK DIAGNOSTICS
  // High sensory, low meaning
  if (sensoryDomains.completion > 0.7 && intensities.contextAndMeaning.completion < 0.3) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'risk',
        severity: 'concern',
        message: 'High sensory load with low meaning anchoring may produce disorientation.',
        relatedFaces: ['sensoryDomains', 'contextAndMeaning'],
      },
      {
        issueSummary: 'Heavy sensory stimulation without narrative grounding risks overwhelming users.',
        dataPoints: {
          sensoryCompletion: sensoryDomains.completion,
          meaningCompletion: intensities.contextAndMeaning.completion,
          riskLevel: 'high',
        },
        suggestedQuestions: [
          'How can I add narrative scaffolding to support this sensory richness?',
          'What story or context helps users make sense of these sensations?',
          'Should I reduce sensory complexity or build meaning first?',
        ],
        relatedFaceIds: ['sensoryDomains', 'contextAndMeaning'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Overloaded reality planes
  const planes = project.realityPlanesV2 || [];
  const activePlanes = planes.filter((p: any) => p.enabled);
  if (activePlanes.length > 4) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'risk',
        severity: 'concern',
        message: 'More than four active reality planes may fragment coherence.',
        relatedFaces: ['realityPlanes'],
      },
      {
        issueSummary: 'Too many active reality planes risk cognitive overload and diluted focus.',
        dataPoints: {
          activePlaneCount: activePlanes.length,
          recommendedMax: 4,
        },
        suggestedQuestions: [
          'Which reality planes are essential vs. nice-to-have?',
          'Can any planes be merged or simplified?',
          'What is the minimal substrate needed for this experience?',
        ],
        relatedFaceIds: ['realityPlanes'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Low presence with high engagement
  if (intensities.presence.completion < 0.3) {
    const hasStatesOrTraits = states.completion > 0.5 || traits.completion > 0.5;
    if (hasStatesOrTraits) {
      const enriched = createEnrichedDiagnostic(
        {
          category: 'risk',
          severity: 'caution',
          message: 'State or trait outcomes targeted without defining quality of presence.',
          relatedFaces: ['presence', 'stateMapping', 'traitMapping'],
        },
        {
          issueSummary: 'Targeting outcomes without defining how users should "be present" during the experience.',
          dataPoints: {
            presenceCompletion: intensities.presence.completion,
            stateCompletion: states.completion,
            traitCompletion: traits.completion,
          },
          suggestedQuestions: [
            'What quality of attention do users need for these states?',
            'How immersed, distracted, or focused should users be?',
            'What presence types support these state transitions?',
          ],
          relatedFaceIds: ['presence', 'stateMapping', 'traitMapping'],
        }
      );
      if (enriched) diagnostics.push(enriched);
    }
  }

  // OPPORTUNITY DIAGNOSTICS
  // All faces moderately active - ready for integration
  const allModerate = Object.values(intensities).every(i => i.completion > 0.3 && i.completion < 0.8);
  if (allModerate) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'opportunity',
        severity: 'info',
        message: 'All domains show activity—consider deepening one area for focus.',
        relatedFaces: Object.keys(intensities),
      },
      {
        issueSummary: 'Balanced exploration across all faces—ready to specialize.',
        dataPoints: {
          avgCompletion: Object.values(intensities).reduce((sum, i) => sum + i.completion, 0) / Object.values(intensities).length,
          phase: currentPhase,
        },
        suggestedQuestions: [
          'Which face should I develop next for maximum impact?',
          'What area aligns best with my core vision?',
          'How do I prioritize deepening vs. breadth?',
        ],
        relatedFaceIds: Object.keys(intensities),
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Strong state + trait + meaning = integration opportunity
  if (states.completion > 0.6 && traits.completion > 0.6 && intensities.contextAndMeaning.completion > 0.5) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'opportunity',
        severity: 'info',
        message: 'Strong state-to-trait pathway with narrative grounding suggests coherent design.',
        relatedFaces: ['stateMapping', 'traitMapping', 'contextAndMeaning'],
      },
      {
        issueSummary: 'Well-integrated transformation arc: clear states, outcomes, and meaning.',
        dataPoints: {
          stateCompletion: states.completion,
          traitCompletion: traits.completion,
          meaningCompletion: intensities.contextAndMeaning.completion,
          integrationScore: (states.completion + traits.completion + intensities.contextAndMeaning.completion) / 3,
        },
        suggestedQuestions: [
          'How can I strengthen the narrative connecting states to traits?',
          'What makes this transformation compelling and believable?',
          'How do I communicate this arc to users?',
        ],
        relatedFaceIds: ['stateMapping', 'traitMapping', 'contextAndMeaning'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Rich presence definition
  if (intensities.presence.completion > 0.7 && intensities.presence.coherence > 0.7) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'opportunity',
        severity: 'info',
        message: 'Rich and balanced presence definition offers multi-modal engagement.',
        relatedFaces: ['presence'],
      },
      {
        issueSummary: 'Strong presence design creates multiple pathways for user engagement.',
        dataPoints: {
          presenceCompletion: intensities.presence.completion,
          presenceCoherence: intensities.presence.coherence,
          qualityScore: (intensities.presence.completion + intensities.presence.coherence) / 2,
        },
        suggestedQuestions: [
          'How do different presence types work together?',
          'Which presence type is the primary gateway?',
          'How do users transition between presence modes?',
        ],
        relatedFaceIds: ['presence'],
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // INTEGRATION DIAGNOSTICS
  // Check if elements are well-distributed across faces
  const totalElements = elements.filter(e => e.hypercubeTags && e.hypercubeTags.length > 0).length;
  if (totalElements > 10) {
    const facesWithElements = Object.values(intensities).filter(i => i.elementCount > 0).length;
    if (facesWithElements >= 5) {
      const enriched = createEnrichedDiagnostic(
        {
          category: 'integration',
          severity: 'info',
          message: 'Canvas artifacts distributed across most domains—design shows systemic thinking.',
          relatedFaces: Object.keys(intensities),
        },
        {
          issueSummary: 'Wide canvas coverage indicates holistic design approach across dimensions.',
          dataPoints: {
            totalTaggedElements: totalElements,
            facesWithElements,
            totalFaces: 6,
            coverageRatio: facesWithElements / 6,
          },
          suggestedQuestions: [
            'How do these canvas elements connect across faces?',
            'Which face needs more visual artifacts?',
            'What patterns emerge from this distribution?',
          ],
          relatedFaceIds: Object.keys(intensities),
        }
      );
      if (enriched) diagnostics.push(enriched);
    }
  }

  // Strong coherence across multiple faces
  const coherentFaces = Object.entries(intensities).filter(([_, i]) => i.coherence > 0.7);
  if (coherentFaces.length >= 4) {
    const enriched = createEnrichedDiagnostic(
      {
        category: 'integration',
        severity: 'info',
        message: 'Multiple domains show internal coherence—experience structure is emerging.',
        relatedFaces: coherentFaces.map(([key]) => key),
      },
      {
        issueSummary: 'High coherence across multiple faces signals unified design vision.',
        dataPoints: {
          coherentFaceCount: coherentFaces.length,
          totalFaces: 6,
          avgCoherence: coherentFaces.reduce((sum, [_, i]) => sum + i.coherence, 0) / coherentFaces.length,
        },
        suggestedQuestions: [
          'What unifying principle ties these coherent domains?',
          'How can I extend this coherence to other faces?',
          'What makes these domains particularly well-integrated?',
        ],
        relatedFaceIds: coherentFaces.map(([key]) => key),
      }
    );
    if (enriched) diagnostics.push(enriched);
  }

  // Filter out null diagnostics (cooldown-skipped)
  return diagnostics.filter(d => d !== null);
}
