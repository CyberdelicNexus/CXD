// What the library must cover (spec §4.3), counted in exemplars: each map
// type in 2, each input type in 4, each node kind in 2, each relation style,
// weight and direction, each tint (always with a legend) and each named
// pairing in at least 1. Used by exemplars.verify (a hard failure), the
// Library tab's coverage matrix, and the Promote panel's coverage preview.
import { MAP_TYPES, NODE_KINDS, RELATION_DIRECTIONS, RELATION_STYLES, RELATION_WEIGHTS, TINTS } from "../types";
import { PAIRINGS } from "./pairings";
import { EXEMPLAR_INPUT_TYPES, type Exemplar } from "./types";

export type CoverageGroup = "mapType" | "inputType" | "kind" | "style" | "weight" | "direction" | "tint" | "pairing";

export const COVERAGE_MINIMUMS: Record<CoverageGroup, number> = {
  mapType: 2, inputType: 4, kind: 2, style: 1, weight: 1, direction: 1, tint: 1, pairing: 1,
};

export interface CoverageItem {
  group: CoverageGroup;
  value: string;
  label: string;
  min: number;
  /** Exemplars showing it. */
  count: number;
}

function uses(e: Exemplar, group: CoverageGroup, value: string): boolean {
  switch (group) {
    case "mapType": return e.tags.mapType === value;
    case "inputType": return e.tags.inputType === value;
    case "kind": return (e.tags.kinds as readonly string[]).includes(value);
    case "style": return e.graph.relations.some((r) => r.style === value);
    case "weight": return e.graph.relations.some((r) => r.weight === value);
    case "direction": return e.graph.relations.some((r) => r.direction === value);
    case "tint": return e.graph.nodes.some((n) => n.tint === value) && e.graph.legend.some((l) => l.tint === value);
    case "pairing": return (e.tags.pairings as readonly string[]).includes(value);
  }
}

type Requirement = Omit<CoverageItem, "count">;
const req = (group: CoverageGroup, value: string, label: string): Requirement => ({ group, value, label, min: COVERAGE_MINIMUMS[group] });

const REQUIREMENTS: Requirement[] = [
  ...MAP_TYPES.map((v) => req("mapType", v, `${v} map`)),
  ...EXEMPLAR_INPUT_TYPES.map((v) => req("inputType", v, `${v} input`)),
  ...NODE_KINDS.map((v) => req("kind", v, `${v} node`)),
  ...RELATION_STYLES.map((v) => req("style", v, `${v} relation`)),
  ...RELATION_WEIGHTS.map((v) => req("weight", v, `${v} relation weight`)),
  ...RELATION_DIRECTIONS.map((v) => req("direction", v, `${v} relation direction`)),
  ...TINTS.map((v) => req("tint", v, `${v} tint with a legend`)),
  ...PAIRINGS.map((p) => req("pairing", p.id, p.label)),
];

export function coverageOf(exemplars: Exemplar[]): CoverageItem[] {
  return REQUIREMENTS.map((r) => ({ ...r, count: exemplars.filter((e) => uses(e, r.group, r.value)).length }));
}

/** Requirements below their minimum, as "label: count of min". */
export function coverageGaps(exemplars: Exemplar[]): string[] {
  return coverageOf(exemplars).filter((i) => i.count < i.min).map((i) => `${i.label}: ${i.count} of ${i.min}`);
}

export interface CoverageGain {
  label: string;
  group: CoverageGroup;
  before: number;
  after: number;
  min: number;
  /** The requirement was below its minimum and this example meets it. */
  closesGap: boolean;
}

/** What adding `candidate` to `library` would add, requirement by requirement (increases only). */
export function coverageGain(library: Exemplar[], candidate: Exemplar): CoverageGain[] {
  const before = coverageOf(library);
  const after = coverageOf([...library, candidate]);
  return after
    .map((a, i) => ({ label: a.label, group: a.group, before: before[i].count, after: a.count, min: a.min, closesGap: before[i].count < a.min && a.count >= a.min }))
    .filter((g) => g.after > g.before);
}
