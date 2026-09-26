// The example library: authored exemplars (TypeScript, in code review) plus
// promoted ones (JSON written by the lab's Publish step, loaded through the
// generated manifest). Tags are always derived here, so they cannot drift
// from the graphs they describe.
import { upgradeGraph } from "../legacy";
import { MIGRATED } from "./authored/migrated";
import { STARTER_1 } from "./authored/starter-1";
import { STARTER_2 } from "./authored/starter-2";
import { byId, deriveTags } from "./derive";
import { PROMOTED } from "./promoted/manifest";
import type { AuthoredExemplar, Exemplar, PromotedExemplarFile } from "./types";

export type { Exemplar } from "./types";

export function fromAuthored(a: AuthoredExemplar): Exemplar {
  const { labels, ...rest } = a;
  return { ...rest, tags: deriveTags(a.input, a.graph, labels), provenance: { source: "authored" } };
}

export function fromPromoted(p: PromotedExemplarFile): Exemplar {
  const graph = upgradeGraph(p.graph);
  return {
    id: p.id, title: p.title, note: p.note, input: p.input, graph,
    tags: deriveTags(p.input, graph, p.labels), provenance: p.provenance,
  };
}

export const AUTHORED_EXEMPLARS: Exemplar[] = [...MIGRATED, ...STARTER_1, ...STARTER_2].map(fromAuthored).sort(byId);
export const PROMOTED_EXEMPLARS: Exemplar[] = PROMOTED.map(fromPromoted).sort(byId);
export const EXEMPLARS: Exemplar[] = [...AUTHORED_EXEMPLARS, ...PROMOTED_EXEMPLARS];
