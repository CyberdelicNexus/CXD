// AI Context Aggregator
// Collects and structures project data into a unified context object for AI prompts.
// Pure functions - no React, no side effects.

import { CXDProject } from "@/types/cxd-schema";
import { CanvasElement, CanvasEdge, HypercubeFaceTag } from "@/types/canvas-elements";
import {
  AIProjectContext,
  FramingContext,
  CanvasContext,
  MapContext,
  PlanContext,
  FaceContext,
} from "@/types/ai-types";
import type { CanvasInventory } from "@/types/ai-operations";
import { calculateFaceIntensities } from "@/utils/diagnostic-engine";
import { generateDiagnostics } from "@/utils/diagnostic-engine";

// Face ID -> HypercubeFaceTag mapping
const FACE_ID_TO_TAG: Record<string, HypercubeFaceTag> = {
  realityPlanes: "Reality Planes",
  sensoryDomains: "Sensory Domains",
  presence: "Presence Types",
  stateMapping: "State Mapping",
  traitMapping: "Trait Mapping",
  contextAndMeaning: "Meaning Architecture",
};

const FACE_ID_TO_LABEL: Record<string, string> = {
  realityPlanes: "Reality Planes",
  sensoryDomains: "Sensory Domains",
  presence: "Presence Types",
  stateMapping: "State Mapping",
  traitMapping: "Trait Mapping",
  contextAndMeaning: "Meaning Architecture",
};

/**
 * Layer 3: Face-Specific AI Personas
 *
 * Each hypercube face has a distinct conversational personality and approach.
 * This helps AI provide more contextually appropriate guidance.
 */
const FACE_PERSONAS: Record<string, {
  role: string;
  tone: string;
  focus: string;
  questions: string[];
}> = {
  realityPlanes: {
    role: "Systems Architect",
    tone: "Pragmatic and technical, focused on implementation feasibility",
    focus: "Technical substrate, platform choices, and interface modalities",
    questions: [
      "What technical constraints shape this experience?",
      "How do digital and physical elements interact?",
      "Which reality planes are load-bearing for the core experience?",
    ],
  },
  sensoryDomains: {
    role: "Sensory Designer",
    tone: "Evocative and embodied, focused on felt experience",
    focus: "Multi-sensory engagement, aesthetic coherence, and perceptual balance",
    questions: [
      "What does this experience feel like in the body?",
      "How do different senses work together or compete?",
      "Which sensory channel carries the primary emotional signal?",
    ],
  },
  presence: {
    role: "Attention Architect",
    tone: "Contemplative and phenomenological, focused on quality of awareness",
    focus: "Modes of attention, immersion depth, and cognitive engagement",
    questions: [
      "What quality of attention does this demand?",
      "How present or distracted will users be?",
      "What shifts users from one presence mode to another?",
    ],
  },
  stateMapping: {
    role: "Experience Psychologist",
    tone: "Introspective and process-oriented, focused on internal transformation",
    focus: "Emotional states, cognitive shifts, and psychological journey",
    questions: [
      "What internal states are users moving through?",
      "How do we guide emotional transitions?",
      "What psychological conditions enable this shift?",
    ],
  },
  traitMapping: {
    role: "Outcomes Strategist",
    tone: "Goal-oriented and behavioral, focused on observable change",
    focus: "Measurable outcomes, lasting changes, and behavioral manifestations",
    questions: [
      "What does success look like from the outside?",
      "Which traits persist after the experience ends?",
      "How do internal states become external behaviors?",
    ],
  },
  contextAndMeaning: {
    role: "Narrative Designer",
    tone: "Poetic and philosophical, focused on meaning-making",
    focus: "World-building, story coherence, and symbolic resonance",
    questions: [
      "What larger story does this experience tell?",
      "How does the world logic support the core theme?",
      "What makes this experience meaningful beyond function?",
    ],
  },
};

// ============================================================
// Full project context (for General AI / Core chat)
// ============================================================

export function getFullProjectContext(
  project: CXDProject,
  elements: CanvasElement[],
  edges: CanvasEdge[],
): AIProjectContext {
  const now = new Date().toISOString();
  return {
    version: "1.0",
    projectId: project.id,
    projectName: project.name || project.intentionCore?.projectName || "Untitled",
    lastUpdated: project.updatedAt || now,
    framing: buildFramingContext(project),
    canvas: buildCanvasContext(elements, edges, project),
    map: buildMapContext(project, elements),
    plan: buildPlanContext(elements),
  };
}

// ============================================================
// Face-specific context slice (for face chats)
// ============================================================

export function getFaceContext(
  project: CXDProject,
  elements: CanvasElement[],
  faceId: string,
): FaceContext {
  const intensities = calculateFaceIntensities(project, elements);
  const intensity = intensities[faceId];
  const tag = FACE_ID_TO_TAG[faceId];
  const taggedElements = tag
    ? elements.filter((el) => el.hypercubeTags?.includes(tag))
    : [];

  return {
    id: faceId,
    label: FACE_ID_TO_LABEL[faceId] || faceId,
    completion: intensity?.completion ?? 0,
    coherence: intensity?.coherence ?? 0,
    state: intensity?.state ?? "undeveloped",
    taggedElementCount: taggedElements.length,
    taggedElements: taggedElements.slice(0, 20).map((el) => ({
      id: el.id,
      title: getElementTitle(el),
      excerpt: getElementExcerpt(el),
    })),
    data: getFaceSpecificData(project, faceId),
    starredMessages: [], // Populated from chat thread data in Phase 3
    // Layer 3: Add persona for face-specific AI guidance
    persona: FACE_PERSONAS[faceId] || null,
  };
}

/**
 * Layer 3: Get AI persona for a specific face
 *
 * Returns conversational personality/approach for face-specific guidance.
 * Used to tailor AI responses to the domain being discussed.
 */
export function getFacePersona(faceId: string) {
  return FACE_PERSONAS[faceId] || {
    role: "Experience Design Guide",
    tone: "Balanced and exploratory",
    focus: "Holistic experience design",
    questions: [
      "What are you trying to achieve?",
      "How does this connect to your broader vision?",
    ],
  };
}

// ============================================================
// Section builders
// ============================================================

function buildFramingContext(project: CXDProject): FramingContext {
  const stages = project.experienceFlowStages || [];
  return {
    lastUpdated: project.updatedAt || new Date().toISOString(),
    intentionCore: {
      projectName: project.intentionCore?.projectName || "",
      mainConcept: project.intentionCore?.mainConcept || "",
      coreMessage: project.intentionCore?.coreMessage || "",
    },
    desiredChange: {
      insights: project.desiredChange?.insights || "",
      feelings: project.desiredChange?.feelings || "",
      states: project.desiredChange?.states || "",
      knowledge: project.desiredChange?.knowledge || "",
    },
    humanContext: {
      audienceNeeds: project.humanContext?.audienceNeeds || "",
      audienceDesires: project.humanContext?.audienceDesires || "",
      userRole: project.humanContext?.userRole || "",
    },
    contextAndMeaning: {
      world: project.contextAndMeaning?.world || "",
      story: project.contextAndMeaning?.story || "",
      magic: project.contextAndMeaning?.magic || "",
    },
    experienceFlow: {
      description: project.experienceFlowDescription || "",
      stages: stages.map((s) => ({
        id: s.id,
        name: s.name,
        narrativeNotes: s.narrativeNotes || "",
        estimatedMinutes: s.estimatedMinutes,
        engagementDistribution: { ...s.engagementDistribution },
        presenceTypes: { ...s.presenceTypes },
        realityPlanes: (s.realityPlanes || {}) as Record<string, boolean>,
      })),
    },
  };
}

function buildCanvasContext(
  elements: CanvasElement[],
  edges: CanvasEdge[],
  project: CXDProject,
): CanvasContext {
  // Count elements by type (exclude lines/connectors from count)
  const contentElements = elements.filter(
    (el) => el.type !== "line" && el.type !== "connector",
  );
  const typeCounts: Record<string, number> = {};
  for (const el of contentElements) {
    typeCounts[el.type] = (typeCounts[el.type] || 0) + 1;
  }

  // Boards
  const boards = (project.canvasLayout?.boards || []).map((b) => ({
    id: b.id,
    title: b.title || "Untitled Board",
    elementCount: elements.filter((el) => el.boardId === b.id).length,
  }));

  // Content digest: summarize top 20 text-bearing elements
  const textElements = contentElements
    .filter((el) => el.type === "freeform" || el.type === "text")
    .slice(0, 20);
  const digest = textElements
    .map((el) => {
      const title = getElementTitle(el);
      const excerpt = getElementExcerpt(el);
      return excerpt ? `${title}: ${excerpt}` : title;
    })
    .join(" | ");

  return {
    lastUpdated: project.updatedAt || new Date().toISOString(),
    elementCount: contentElements.length,
    elementSummary: Object.entries(typeCounts).map(([type, count]) => ({ type, count })),
    boards,
    connectorCount: edges.length,
    contentDigest: digest.slice(0, 2000),
  };
}

function buildMapContext(project: CXDProject, elements: CanvasElement[]): MapContext {
  const intensities = calculateFaceIntensities(project, elements);
  const diagnostics = generateDiagnostics(project, elements);

  const faces: FaceContext[] = Object.entries(FACE_ID_TO_TAG).map(([faceId, tag]) => {
    const intensity = intensities[faceId];
    const taggedElements = elements.filter((el) =>
      el.hypercubeTags?.includes(tag),
    );
    return {
      id: faceId,
      label: FACE_ID_TO_LABEL[faceId] || faceId,
      completion: intensity?.completion ?? 0,
      coherence: intensity?.coherence ?? 0,
      state: intensity?.state ?? "undeveloped",
      taggedElementCount: taggedElements.length,
      taggedElements: taggedElements.slice(0, 10).map((el) => ({
        id: el.id,
        title: getElementTitle(el),
        excerpt: getElementExcerpt(el),
      })),
      data: getFaceSpecificData(project, faceId),
      starredMessages: [],
    };
  });

  const completionValues = Object.values(intensities).map((i) => i.completion);
  const overallCompletion =
    completionValues.length > 0
      ? completionValues.reduce((sum, c) => sum + c, 0) / completionValues.length
      : 0;

  return {
    lastUpdated: project.updatedAt || new Date().toISOString(),
    faces,
    diagnostics: diagnostics.map((d) => ({
      category: d.category,
      severity: d.severity,
      message: d.message,
      relatedFaces: d.relatedFaces,
    })),
    overallCompletion,
  };
}

function buildPlanContext(elements: CanvasElement[]): PlanContext {
  // Derive tasks from qualifying canvas elements (same rules as plan-types.ts)
  const tasks = elements.filter((el) => {
    if (el.type !== "freeform" && el.type !== "text") return false;
    const content = (el as any).content || "";
    const meta = (el as any).taskMetadata;
    const hasMarkdownTasks = /- \[[ x]\]/i.test(content);
    const isActionable = meta?.isActionable === true;
    const hasTags = el.hypercubeTags && el.hypercubeTags.length > 0;
    return hasMarkdownTasks || isActionable || hasTags;
  });

  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const deadlines: { title: string; dueDate: string }[] = [];

  for (const task of tasks) {
    const meta = (task as any).taskMetadata;
    const status = meta?.status || "not_started";
    const priority = meta?.priority || "medium";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

    if (meta?.dueDate) {
      deadlines.push({
        title: getElementTitle(task),
        dueDate: meta.dueDate,
      });
    }
  }

  // Sort deadlines by date, take upcoming 10
  deadlines.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const now = new Date();
  const upcoming = deadlines.filter((d) => new Date(d.dueDate) >= now).slice(0, 10);

  return {
    lastUpdated: new Date().toISOString(),
    totalTasks: tasks.length,
    tasksByStatus: statusCounts,
    tasksByPriority: priorityCounts,
    upcomingDeadlines: upcoming,
  };
}

// ============================================================
// Canvas inventory (for the Canvas Assistant operations route)
// ============================================================

const INVENTORY_CAP = 150;

/**
 * Bounded, model-facing element inventory. Unlike buildCanvasContext (counts +
 * prose digest), this carries ids and geometry so the model can target specific
 * elements. Priority when over the cap: selected elements first, then canvas-
 * surface elements, then most recently listed — so the selection always
 * survives truncation.
 */
export function buildCanvasInventory(
  elements: CanvasElement[],
  selectedIds: string[],
): CanvasInventory {
  const selectedSet = new Set(selectedIds);
  const content = elements.filter((el) => el.type !== "line" && el.type !== "connector");

  const scored = content.map((el, idx) => ({
    el,
    idx,
    score: selectedSet.has(el.id) ? 2 : el.surface === "canvas" ? 1 : 0,
  }));
  scored.sort((a, b) => b.score - a.score || b.idx - a.idx);

  const kept = scored.slice(0, INVENTORY_CAP).map(({ el }) => ({
    id: el.id,
    type: el.type,
    title: getElementTitle(el),
    x: Math.round(el.x),
    y: Math.round(el.y),
    width: Math.round(el.width),
    height: Math.round(el.height),
    ...(el.containerId ? { containerId: el.containerId } : {}),
    ...(el.hypercubeTags && el.hypercubeTags.length > 0 ? { tags: el.hypercubeTags as string[] } : {}),
    ...(selectedSet.has(el.id) ? { selected: true } : {}),
  }));

  const contentIds = new Set(content.map((el) => el.id));

  return {
    totalCount: content.length,
    truncated: content.length > INVENTORY_CAP,
    selectedIds: selectedIds.filter((id) => contentIds.has(id)),
    elements: kept,
  };
}

// ============================================================
// Helpers
// ============================================================

export function getElementTitle(element: CanvasElement): string {
  switch (element.type) {
    case "freeform":
    case "text": {
      const content = (element as any).content || "";
      const firstLine = content.split("\n").find((l: string) => l.trim().length > 0);
      return firstLine?.trim().slice(0, 60) || "Untitled Card";
    }
    case "board":
      return (element as any).title || "Untitled Board";
    case "container":
      return (element as any).title || "Container";
    case "link":
      return (element as any).title || (element as any).url?.slice(0, 40) || "Link";
    case "image":
      return (element as any).alt || "Image";
    case "experienceBlock":
      return (element as any).title || "Experience Block";
    default:
      return "Element";
  }
}

function getElementExcerpt(element: CanvasElement): string {
  if (element.type !== "freeform" && element.type !== "text") return "";
  const content = (element as any).content || "";
  const lines = content.split("\n").filter((l: string) => l.trim().length > 0);
  return lines.slice(1).join(" ").trim().slice(0, 100);
}

function getFaceSpecificData(project: CXDProject, faceId: string): Record<string, unknown> {
  switch (faceId) {
    case "realityPlanes": {
      const planes = project.realityPlanesV2 || [];
      return {
        planes: planes.map((p) => ({
          code: p.code,
          enabled: p.enabled,
          interfaceModality: p.interfaceModality,
          priority: p.priority,
        })),
        activePlaneCount: planes.filter((p) => p.enabled).length,
      };
    }
    case "sensoryDomains": {
      const domains = project.sensoryDomains || {};
      return {
        domains: Object.entries(domains).map(([key, value]) => ({
          sense: key,
          intensity: value,
        })),
        activeSenseCount: Object.values(domains).filter((v) => v > 0).length,
      };
    }
    case "presence": {
      const types = project.presenceTypes || {};
      return {
        types: Object.entries(types).map(([key, value]) => ({
          type: key,
          level: value,
        })),
        activeTypeCount: Object.values(types).filter((v) => v > 0).length,
      };
    }
    case "stateMapping": {
      const states = project.stateMapping || {};
      return {
        quadrants: Object.entries(states).map(([key, value]) => ({
          quadrant: key,
          description: value || "",
        })),
        definedCount: Object.values(states).filter((v) => v && v.trim().length > 0).length,
      };
    }
    case "traitMapping": {
      const traits = project.traitMapping || {};
      return {
        quadrants: Object.entries(traits).map(([key, value]) => ({
          quadrant: key,
          description: value || "",
        })),
        definedCount: Object.values(traits).filter((v) => v && v.trim().length > 0).length,
      };
    }
    case "contextAndMeaning": {
      const meaning = project.contextAndMeaning || {};
      return {
        world: meaning.world || "",
        story: meaning.story || "",
        magic: meaning.magic || "",
        definedCount: [meaning.world, meaning.story, meaning.magic].filter(
          (v) => v && v.trim().length > 0,
        ).length,
      };
    }
    default:
      return {};
  }
}
