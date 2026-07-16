// Role-Scoped Briefs — per-discipline markdown exports filtered by hypercube face.
// Each brief = wizard framing for the chosen faces + every canvas element whose
// EFFECTIVE tags (container inheritance via getEffectiveHypercubeTags) hit them.

import {
  SECTION_TO_FACE_TAG,
  getEffectiveHypercubeTags,
  type CanvasElement,
  type ContainerElement,
  type HypercubeFaceTag,
} from "@/types/canvas-elements";
import {
  CXD_SECTIONS,
  PRESENCE_TYPES,
  REALITY_PLANES,
  SENSORY_DOMAINS,
  STATE_QUADRANTS,
  TRAIT_QUADRANTS,
  type CXDProject,
} from "@/types/cxd-schema";

// ---------------------------------------------------------------------------
// Preset role bundles (the per-face picker covers everything else)
// ---------------------------------------------------------------------------
export interface RoleBundle {
  id: string;
  label: string;
  faces: HypercubeFaceTag[];
}

export const ROLE_BUNDLES: RoleBundle[] = [
  { id: "sound-sensory", label: "Sound & Sensory", faces: ["Sensory Domains", "State Mapping"] },
  { id: "spatial-tech", label: "Spatial & Tech", faces: ["Reality Planes", "Presence Types"] },
  { id: "narrative", label: "Narrative", faces: ["Meaning Architecture", "Trait Mapping"] },
];

// ---------------------------------------------------------------------------
// Face → wizard sections (inverse of SECTION_TO_FACE_TAG)
// ---------------------------------------------------------------------------
const FACE_TO_SECTIONS: Partial<Record<HypercubeFaceTag, string[]>> = (() => {
  const map: Partial<Record<HypercubeFaceTag, string[]>> = {};
  for (const [sectionId, face] of Object.entries(SECTION_TO_FACE_TAG)) {
    (map[face] ??= []).push(sectionId);
  }
  return map;
})();

function sectionLabel(sectionId: string): string {
  return CXD_SECTIONS.find((s) => s.id === sectionId)?.label || sectionId;
}

function field(label: string, value: string | undefined): string {
  return `- **${label}:** ${value?.trim() ? value.trim() : "_Not specified_"}`;
}

function renderSection(project: CXDProject, sectionId: string): string[] {
  const lines: string[] = [`### ${sectionLabel(sectionId)}`, ""];

  switch (sectionId) {
    case "intentionCore":
      lines.push(field("Project name", project.intentionCore?.projectName));
      lines.push(field("Main concept", project.intentionCore?.mainConcept));
      lines.push(field("Core message", project.intentionCore?.coreMessage));
      break;

    case "contextAndMeaning":
      lines.push(field("World", project.contextAndMeaning?.world));
      lines.push(field("Story", project.contextAndMeaning?.story));
      lines.push(field("Magic", project.contextAndMeaning?.magic));
      break;

    case "realityPlanes": {
      const v2 = project.realityPlanesV2;
      if (v2 && v2.length > 0) {
        const enabled = [...v2].filter((p) => p.enabled).sort((a, b) => a.priority - b.priority);
        if (enabled.length === 0) {
          lines.push("_No reality planes enabled._");
        } else {
          enabled.forEach((p) => {
            const meta = REALITY_PLANES.find((r) => r.code === p.code);
            const modality = p.interfaceModality?.trim();
            lines.push(
              `- **${meta?.label || p.code}** (${p.code})${modality ? `: ${modality}` : ""}`,
            );
          });
        }
      } else {
        REALITY_PLANES.forEach((r) => {
          const pct = project.realityPlanes?.[r.code] ?? 0;
          if (pct > 0) lines.push(`- **${r.label}** (${r.code}): ${pct}%`);
        });
        if (lines.length === 2) lines.push("_No reality planes weighted._");
      }
      break;
    }

    case "sensoryDomains":
      SENSORY_DOMAINS.forEach((d) => {
        lines.push(`- **${d.label}:** ${project.sensoryDomains?.[d.code] ?? 0}/100`);
      });
      break;

    case "presence":
      PRESENCE_TYPES.forEach((p) => {
        lines.push(`- **${p.label}:** ${project.presenceTypes?.[p.code] ?? 0}/100. ${p.description}`);
      });
      break;

    case "stateMapping":
      STATE_QUADRANTS.forEach((q) => {
        lines.push(field(`${q.label} (${q.description})`, project.stateMapping?.[q.code]));
      });
      break;

    case "traitMapping":
      TRAIT_QUADRANTS.forEach((q) => {
        lines.push(field(`${q.label} (${q.description})`, project.traitMapping?.[q.code]));
      });
      break;

    default:
      lines.push("_Unknown section._");
  }

  lines.push("");
  return lines;
}

// ---------------------------------------------------------------------------
// Canvas element extraction
// ---------------------------------------------------------------------------
function gatherAllElements(project: CXDProject): CanvasElement[] {
  const elements: CanvasElement[] = [...(project.canvasLayout?.elements || [])];
  for (const board of project.canvasLayout?.boards || []) {
    elements.push(...(board.nodes || []));
  }
  return elements;
}

function elementTitle(el: CanvasElement): string {
  switch (el.type) {
    case "freeform": {
      const title = el.noteTitle?.trim();
      if (title) return title;
      const firstLine = (el.content || "").split("\n").find((l) => l.trim().length > 0);
      return firstLine?.trim() || "Untitled card";
    }
    case "text": {
      const firstLine = (el.content || "").split("\n").find((l) => l.trim().length > 0);
      return firstLine?.trim() || "Text";
    }
    case "shape":
      return el.content?.trim() || "Shape";
    case "container":
      return el.label?.trim() || "Untitled container";
    case "link":
      return el.title?.trim() || el.url || "Link";
    case "board":
      return el.title?.trim() || "Board";
    case "image":
      return el.alt?.trim() || "Image";
    case "experienceBlock":
      return el.title?.trim() || "Experience block";
    default:
      return "Element";
  }
}

function elementBody(el: CanvasElement): string {
  switch (el.type) {
    case "freeform":
      return (el.noteBody?.trim() || el.content?.trim() || "").trim();
    case "text":
      return (el.content || "").trim();
    case "link":
      return el.url || "";
    default:
      return "";
  }
}

interface BriefGroup {
  label: string;
  items: CanvasElement[];
}

// ---------------------------------------------------------------------------
// Brief builder
// ---------------------------------------------------------------------------
export function buildRoleBriefMarkdown(
  project: CXDProject,
  faces: HypercubeFaceTag[],
  briefLabel: string,
): string {
  const projectName = project.name || project.intentionCore?.projectName || "Untitled";
  const generated = new Date().toISOString().split("T")[0];

  const all = gatherAllElements(project);
  const byId = new Map<string, CanvasElement>(all.map((e) => [e.id, e]));
  const boardTitleById = new Map<string, string>(
    (project.canvasLayout?.boards || []).map((b) => [b.id, b.title || "Untitled board"]),
  );

  const faceSet = new Set(faces);
  const matching = all.filter((el) => {
    if (el.type === "connector" || el.type === "line") return false;
    return getEffectiveHypercubeTags(el, byId).some((t) => faceSet.has(t));
  });

  // Group by parent container → board → root canvas.
  const groups = new Map<string, BriefGroup>();
  const ensureGroup = (key: string, label: string): BriefGroup => {
    let g = groups.get(key);
    if (!g) {
      g = { label, items: [] };
      groups.set(key, g);
    }
    return g;
  };

  for (const el of matching) {
    if (el.type === "container") {
      // A tagged container is a group heading; its children match via inheritance.
      ensureGroup(`container:${el.id}`, (el as ContainerElement).label?.trim() || "Untitled container");
      continue;
    }
    const parent = el.containerId ? byId.get(el.containerId) : undefined;
    if (parent && parent.type === "container") {
      ensureGroup(`container:${parent.id}`, parent.label?.trim() || "Untitled container").items.push(el);
    } else if (el.boardId && boardTitleById.has(el.boardId)) {
      ensureGroup(`board:${el.boardId}`, `Board: ${boardTitleById.get(el.boardId)}`).items.push(el);
    } else {
      ensureGroup("canvas", "Canvas").items.push(el);
    }
  }

  // ---- assemble ----
  const lines: string[] = [];
  lines.push(`# Role Brief: ${briefLabel} (${projectName})`);
  lines.push("");
  lines.push(`_Generated ${generated}_`);
  lines.push("");
  lines.push(`**Faces covered:** ${faces.join(", ")}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Wizard framing for the covered faces
  lines.push("## Framing (from the wizard)");
  lines.push("");
  const sections = faces.flatMap((f) => FACE_TO_SECTIONS[f] || []);
  if (sections.length === 0) {
    lines.push("_No wizard sections map to these faces._");
    lines.push("");
  } else {
    sections.forEach((sectionId) => lines.push(...renderSection(project, sectionId)));
  }

  lines.push("---");
  lines.push("");

  // Canvas elements
  lines.push(`## Canvas elements (${matching.filter((e) => e.type !== "container").length})`);
  lines.push("");
  if (groups.size === 0) {
    lines.push("_No canvas elements are tagged with these faces yet. Tag containers or cards in the Map view to route work to this role._");
    lines.push("");
  } else {
    const annotateFaces = faces.length > 1;
    for (const group of Array.from(groups.values())) {
      lines.push(`### ${group.label}`);
      lines.push("");
      if (group.items.length === 0) {
        lines.push("_Container tagged for this role. No cards inside yet._");
      } else {
        for (const el of group.items) {
          const title = elementTitle(el);
          let bullet = `- **${title}**`;
          if (annotateFaces) {
            const hits = getEffectiveHypercubeTags(el, byId).filter((t) => faceSet.has(t));
            if (hits.length > 0) bullet += ` _(${hits.join(", ")})_`;
          }
          lines.push(bullet);
          const body = elementBody(el);
          if (body && body !== title) {
            body.split("\n").forEach((l) => lines.push(`  ${l}`));
          }
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}
