// Tags derived from an exemplar's graph and input, and a stable hash of the
// whole library (folded into PROMPT_VERSION). Pure; no node:crypto, so it is
// safe in the browser too.
import { effectiveKind } from "../layouts/shared";
import { NODE_KINDS, type MapGraph, type NodeKind } from "../types";
import { PAIRINGS, type PairingId } from "./pairings";
import type { Exemplar, ExemplarInput, ExemplarTags } from "./types";

/** Kinds as rendered (a link without a url counts as the card it becomes), in NODE_KINDS order. */
export function kindsOf(g: MapGraph): NodeKind[] {
  const used = new Set<string>(g.nodes.map(effectiveKind));
  return NODE_KINDS.filter((k) => used.has(k));
}

export function pairingsOf(g: MapGraph): PairingId[] {
  return PAIRINGS.filter((p) => p.detect(g)).map((p) => p.id);
}

export function deriveTags(input: ExemplarInput, graph: MapGraph, labels: string[]): ExemplarTags {
  return { mapType: graph.mapType, inputType: input.type, kinds: kindsOf(graph), pairings: pairingsOf(graph), labels };
}

/** cyrb53-style 64-bit string hash as 16 hex characters. Deterministic across processes and platforms. */
export function hashString(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

export const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/** Hash of every exemplar's content, independent of load order. */
export function libraryHash(exemplars: Exemplar[]): string {
  const canonical = [...exemplars].sort(byId).map((e) => [e.id, e.title, e.note, e.input, e.graph]);
  return hashString(JSON.stringify(canonical));
}
