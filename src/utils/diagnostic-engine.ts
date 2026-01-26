import { Diagnostic, DiagnosticCategory, DiagnosticSeverity } from "@/types/diagnostics";
import { CXDProject } from "@/types/cxd-schema";
import { CanvasElement, HypercubeFaceTag } from "@/types/canvas-elements";

// Map section IDs to hypercube face tags
const SECTION_TO_TAG: Record<string, HypercubeFaceTag> = {
  realityPlanes: 'Reality Planes',
  sensoryDomains: 'Sensory Domains',
  presence: 'Presence Types',
  stateMapping: 'State Mapping',
  traitMapping: 'Trait Mapping',
  contextAndMeaning: 'Meaning Architecture',
};

interface FaceIntensity {
  completion: number;
  coherence: number;
  elementCount: number;
  state: 'undeveloped' | 'emerging' | 'active' | 'coherent';
}

function getTaggedElementsForFace(elements: CanvasElement[], faceTag: HypercubeFaceTag): CanvasElement[] {
  return elements.filter((el: CanvasElement) => el.hypercubeTags?.includes(faceTag));
}

function calculateFaceIntensities(project: CXDProject, elements: CanvasElement[]): Record<string, FaceIntensity> {
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
  intensities.sensoryDomains = {
    completion: activeDomainCount / 5,
    coherence: avgDomainValue > 0 ? 1 - Math.min(domainValues.reduce((sum: number, v: any) => sum + Math.pow(v - avgDomainValue, 2), 0) / domainValues.length / 1000, 1) : 0.5,
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
  const hasStates = stateValues.some((v: any) => v && v.trim && v.trim().length > 0);
  intensities.stateMapping = {
    completion: hasStates ? 0.7 : 0,
    coherence: getTaggedElementsForFace(elements, 'State Mapping').length > 0 ? 1 : 0.5,
    elementCount: getTaggedElementsForFace(elements, 'State Mapping').length,
    state: !hasStates ? 'undeveloped' : getTaggedElementsForFace(elements, 'State Mapping').length === 0 ? 'emerging' : 'coherent'
  };

  // Trait Mapping
  const traits = project.traitMapping || {};
  const traitValues = Object.values(traits);
  const hasTraits = traitValues.some((v: any) => v && v.trim && v.trim().length > 0);
  intensities.traitMapping = {
    completion: hasTraits ? 0.7 : 0,
    coherence: getTaggedElementsForFace(elements, 'Trait Mapping').length > 0 ? 1 : 0.5,
    elementCount: getTaggedElementsForFace(elements, 'Trait Mapping').length,
    state: !hasTraits ? 'undeveloped' : getTaggedElementsForFace(elements, 'Trait Mapping').length === 0 ? 'emerging' : 'coherent'
  };

  // Meaning Architecture
  const meaning = project.contextAndMeaning || {};
  const hasWorld = meaning.world && meaning.world.trim().length > 0;
  const hasStory = meaning.story && meaning.story.trim().length > 0;
  const hasMagic = meaning.magic && meaning.magic.trim().length > 0;
  const structuredCount = [hasWorld, hasStory, hasMagic].filter(Boolean).length;
  intensities.contextAndMeaning = {
    completion: structuredCount / 3,
    coherence: getTaggedElementsForFace(elements, 'Meaning Architecture').length > 0 ? 1 : 0.5,
    elementCount: getTaggedElementsForFace(elements, 'Meaning Architecture').length,
    state: structuredCount === 0 ? 'undeveloped' : structuredCount < 2 ? 'emerging' : getTaggedElementsForFace(elements, 'Meaning Architecture').length > 2 ? 'coherent' : 'active'
  };

  return intensities;
}

export function generateDiagnostics(project: CXDProject, elements: CanvasElement[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const intensities = calculateFaceIntensities(project, elements);
  let diagnosticId = 0;

  // BALANCE DIAGNOSTICS
  const completionValues = Object.entries(intensities).map(([key, val]) => ({ key, completion: val.completion }));
  const maxCompletion = Math.max(...completionValues.map(v => v.completion));
  const minCompletion = Math.min(...completionValues.map(v => v.completion));
  
  if (maxCompletion - minCompletion > 0.5) {
    const dominantFace = completionValues.find(v => v.completion === maxCompletion);
    const weakFaces = completionValues.filter(v => v.completion < 0.3).map(v => v.key);
    
    if (dominantFace && weakFaces.length > 0) {
      const dominantName = dominantFace.key.replace(/([A-Z])/g, ' $1').trim();
      const weakNames = weakFaces.map(f => f.replace(/([A-Z])/g, ' $1').trim()).join(' and ');
      diagnostics.push({
        id: `diag-${diagnosticId++}`,
        category: 'balance',
        severity: 'caution',
        message: `${dominantName} is dominant while ${weakNames} ${weakFaces.length === 1 ? 'remains' : 'remain'} underrepresented.`,
        relatedFaces: [dominantFace.key, ...weakFaces],
        timestamp: Date.now()
      });
    }
  }

  // Sensory overload check
  const sensory = intensities.sensoryDomains;
  if (sensory.completion > 0.8) {
    const presence = intensities.presence;
    if (presence.completion < 0.3) {
      diagnostics.push({
        id: `diag-${diagnosticId++}`,
        category: 'balance',
        severity: 'caution',
        message: 'High sensory activation with minimal presence definition may fragment attention.',
        relatedFaces: ['sensoryDomains', 'presence'],
        timestamp: Date.now()
      });
    }
  }

  // COVERAGE DIAGNOSTICS
  Object.entries(intensities).forEach(([faceId, intensity]) => {
    if (intensity.completion > 0.3 && intensity.elementCount === 0) {
      const faceName = faceId.replace(/([A-Z])/g, ' $1').trim();
      diagnostics.push({
        id: `diag-${diagnosticId++}`,
        category: 'coverage',
        severity: 'info',
        message: `No canvas elements tagged to ${faceName}.`,
        relatedFaces: [faceId],
        timestamp: Date.now()
      });
    }
  });

  // Meaning Architecture gap
  if (intensities.contextAndMeaning.completion < 0.3) {
    const anyActive = Object.values(intensities).some(i => i.completion > 0.5);
    if (anyActive) {
      diagnostics.push({
        id: `diag-${diagnosticId++}`,
        category: 'coverage',
        severity: 'concern',
        message: 'Active experience design without grounding in Meaning Architecture.',
        relatedFaces: ['contextAndMeaning'],
        timestamp: Date.now()
      });
    }
  }

  // COHERENCE DIAGNOSTICS
  // States without traits
  const states = intensities.stateMapping;
  const traits = intensities.traitMapping;
  if (states.completion > 0.5 && traits.completion < 0.3) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'coherence',
      severity: 'caution',
      message: 'States are defined without downstream Trait Mapping for integration.',
      relatedFaces: ['stateMapping', 'traitMapping'],
      timestamp: Date.now()
    });
  }

  // Traits without states
  if (traits.completion > 0.5 && states.completion < 0.3) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'coherence',
      severity: 'info',
      message: 'Trait outcomes specified without upstream State Mapping to reach them.',
      relatedFaces: ['stateMapping', 'traitMapping'],
      timestamp: Date.now()
    });
  }

  // Reality planes without sensory
  const reality = intensities.realityPlanes;
  const sensoryDomains = intensities.sensoryDomains;
  if (reality.completion > 0.5 && sensoryDomains.completion < 0.2) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'coherence',
      severity: 'info',
      message: 'Technical substrate defined without sensory embodiment layer.',
      relatedFaces: ['realityPlanes', 'sensoryDomains'],
      timestamp: Date.now()
    });
  }

  // RISK DIAGNOSTICS
  // High sensory, low meaning
  if (sensoryDomains.completion > 0.7 && intensities.contextAndMeaning.completion < 0.3) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'risk',
      severity: 'concern',
      message: 'High sensory load with low meaning anchoring may produce disorientation.',
      relatedFaces: ['sensoryDomains', 'contextAndMeaning'],
      timestamp: Date.now()
    });
  }

  // Overloaded reality planes
  const planes = project.realityPlanesV2 || [];
  const activePlanes = planes.filter((p: any) => p.enabled);
  if (activePlanes.length > 4) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'risk',
      severity: 'concern',
      message: 'More than four active reality planes may fragment coherence.',
      relatedFaces: ['realityPlanes'],
      timestamp: Date.now()
    });
  }

  // Low presence with high engagement
  if (intensities.presence.completion < 0.3) {
    const hasStatesOrTraits = states.completion > 0.5 || traits.completion > 0.5;
    if (hasStatesOrTraits) {
      diagnostics.push({
        id: `diag-${diagnosticId++}`,
        category: 'risk',
        severity: 'caution',
        message: 'State or trait outcomes targeted without defining quality of presence.',
        relatedFaces: ['presence', 'stateMapping', 'traitMapping'],
        timestamp: Date.now()
      });
    }
  }

  // OPPORTUNITY DIAGNOSTICS
  // All faces moderately active - ready for integration
  const allModerate = Object.values(intensities).every(i => i.completion > 0.3 && i.completion < 0.8);
  if (allModerate) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'opportunity',
      severity: 'info',
      message: 'All domains show activity—consider deepening one area for focus.',
      relatedFaces: Object.keys(intensities),
      timestamp: Date.now()
    });
  }

  // Strong state + trait + meaning = integration opportunity
  if (states.completion > 0.6 && traits.completion > 0.6 && intensities.contextAndMeaning.completion > 0.5) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'opportunity',
      severity: 'info',
      message: 'Strong state-to-trait pathway with narrative grounding suggests coherent design.',
      relatedFaces: ['stateMapping', 'traitMapping', 'contextAndMeaning'],
      timestamp: Date.now()
    });
  }

  // Rich presence definition
  if (intensities.presence.completion > 0.7 && intensities.presence.coherence > 0.7) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'opportunity',
      severity: 'info',
      message: 'Rich and balanced presence definition offers multi-modal engagement.',
      relatedFaces: ['presence'],
      timestamp: Date.now()
    });
  }

  // INTEGRATION DIAGNOSTICS
  // Check if elements are well-distributed across faces
  const totalElements = elements.filter(e => e.hypercubeTags && e.hypercubeTags.length > 0).length;
  if (totalElements > 10) {
    const facesWithElements = Object.values(intensities).filter(i => i.elementCount > 0).length;
    if (facesWithElements >= 5) {
      diagnostics.push({
        id: `diag-${diagnosticId++}`,
        category: 'integration',
        severity: 'info',
        message: 'Canvas artifacts distributed across most domains—design shows systemic thinking.',
        relatedFaces: Object.keys(intensities),
        timestamp: Date.now()
      });
    }
  }

  // Strong coherence across multiple faces
  const coherentFaces = Object.entries(intensities).filter(([_, i]) => i.coherence > 0.7);
  if (coherentFaces.length >= 4) {
    diagnostics.push({
      id: `diag-${diagnosticId++}`,
      category: 'integration',
      severity: 'info',
      message: 'Multiple domains show internal coherence—experience structure is emerging.',
      relatedFaces: coherentFaces.map(([key]) => key),
      timestamp: Date.now()
    });
  }

  return diagnostics;
}
