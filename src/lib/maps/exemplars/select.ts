// Deterministic exemplar selection for the graph+exemplars arm (spec §4.4).
// No model call: the same library, input type and forced type always give
// the same examples, so PROMPT_VERSION (which hashes the library) fully
// determines what a cell was shown.
import type { MapType } from "../types";
import { byId } from "./derive";
import type { Exemplar, ExemplarInputType } from "./types";

/** Bump when the algorithm below changes: it is folded into PROMPT_VERSION. */
export const SELECTION_VERSION = "select-v2-sim30";

export function selectExemplars(library: Exemplar[], inputType: ExemplarInputType, forcedType: MapType | null, max = 3): Exemplar[] {
  if (library.length === 0) return [];
  const score = (e: Exemplar): [number, number] =>
    [e.tags.inputType === inputType ? 1 : 0, forcedType !== null && e.tags.mapType === forcedType ? 1 : 0];
  // 1. Rank by input-type match, then map-type match; ties by id.
  const ranked = [...library].sort((a, b) => {
    const sa = score(a);
    const sb = score(b);
    return sb[0] - sa[0] || sb[1] - sa[1] || byId(a, b);
  });
  const picked: Exemplar[] = [ranked[0]];
  const covered = new Set<string>([...ranked[0].tags.kinds, ...ranked[0].tags.pairings]);
  // 2. Greedily add the exemplar bringing the most new kinds plus pairings; ties by id.
  const byIdOrder = [...library].sort(byId);
  while (picked.length < max) {
    let best: { e: Exemplar; gain: number } | null = null;
    for (const e of byIdOrder) {
      if (picked.includes(e)) continue;
      const gain = [...e.tags.kinds, ...e.tags.pairings].filter((x) => !covered.has(x)).length;
      if (!best || gain > best.gain) best = { e, gain };
    }
    if (!best || best.gain === 0) break;
    picked.push(best.e);
    best.e.tags.kinds.forEach((k) => covered.add(k));
    best.e.tags.pairings.forEach((p) => covered.add(p));
  }
  return picked;
}
