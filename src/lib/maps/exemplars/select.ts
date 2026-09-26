// Deterministic exemplar selection for the graph+exemplars arm (spec §4.4).
// No model call: the same library and input always give the same examples,
// so PROMPT_VERSION (which hashes the library and SELECTION_VERSION) fully
// determines what a cell was shown.
//
// 1. The first example is the best match: input type, then map type when one
//    is forced, then lexical relevance to the current input, then id.
// 2. Up to 2 more are added greedily by relevance plus a smaller diversity
//    bonus (new kinds and pairings) plus a bonus for a map type not yet shown.
//    An example adding nothing (score 0) is not added. Ties break by id.
//
// Relevance is the cosine similarity of content-word sets: lowercased words
// of 3+ letters from the input's title, text and cards, minus a short
// stopword list, with a plural "s" trimmed. It keeps the choice about the
// content in hand, so the model sees a retreat when it maps a retreat instead
// of the same two showcase maps every time.
import type { MapType } from "../types";
import { byId } from "./derive";
import type { Exemplar, ExemplarInput } from "./types";

/** Bump when the algorithm below changes: it is folded into PROMPT_VERSION. */
export const SELECTION_VERSION = "select-v3-relevance";

/** Per new kind or pairing an added example brings, capped: smaller than a good relevance match. */
export const DIVERSITY_PER_ITEM = 0.02;
export const DIVERSITY_CAP = 0.1;
/** For an added example whose map type is not yet among the picks. */
export const NEW_MAP_TYPE_BONUS = 0.05;

const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "your", "our", "ours", "we", "they", "them", "their", "this", "that",
  "these", "those", "with", "from", "into", "onto", "about", "what", "which", "who", "whom", "how", "why", "when", "where",
  "will", "would", "should", "could", "can", "may", "might", "must", "have", "has", "had", "was", "were", "been", "being",
  "its", "it's", "than", "then", "there", "here", "each", "every", "some", "any", "all", "one", "two", "three", "more",
  "most", "also", "just", "only", "very", "too", "out", "over", "under", "after", "before", "between", "per", "via",
  "let", "lets", "make", "made", "need", "needs", "want", "wants", "like", "get", "got", "put", "use", "used", "via",
  "i'm", "i'd", "we'd", "we're", "don't", "doesn't", "can't", "isn't", "aren't", "yes", "no", "ok", "okay", "so",
  "these", "cards", "card", "map", "show", "list", "compare", "organise", "organize", "sort", "group",
]);

type SelectInput = Pick<ExemplarInput, "type" | "title" | "text"> & { cards?: ExemplarInput["cards"] };

const inputText = (i: SelectInput) => [i.title, i.text, ...(i.cards ?? []).flatMap((c) => [c.title, c.body])].join(" ");

/** The content words of a text, as a set. */
export function contentWords(s: string): Set<string> {
  const out = new Set<string>();
  for (const raw of s.toLowerCase().replace(/[^a-z0-9'\s]+/g, " ").split(/\s+/)) {
    const w = raw.replace(/^'+|'+$/g, "");
    if (w.length < 3 || /^\d+$/.test(w) || STOPWORDS.has(w)) continue;
    out.add(w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
  }
  return out;
}

/** Cosine similarity of two word sets: shared / sqrt(|a| * |b|); 0 when either is empty. */
export function relevance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  a.forEach((w) => { if (b.has(w)) shared++; });
  return shared / Math.sqrt(a.size * b.size);
}

export function selectExemplars(library: Exemplar[], input: SelectInput, forcedType: MapType | null, max = 3): Exemplar[] {
  if (library.length === 0) return [];
  const query = contentWords(inputText(input));
  const rel = new Map(library.map((e) => [e.id, relevance(query, contentWords(inputText(e.input)))]));
  const key = (e: Exemplar): number[] => [
    e.tags.inputType === input.type ? 1 : 0,
    forcedType !== null && e.tags.mapType === forcedType ? 1 : 0,
    rel.get(e.id)!,
  ];
  // 1. The best match: input type, then forced map type, then relevance; ties by id.
  const first = [...library].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    return kb[0] - ka[0] || kb[1] - ka[1] || kb[2] - ka[2] || byId(a, b);
  })[0];
  const picked: Exemplar[] = [first];
  const covered = new Set<string>([...first.tags.kinds, ...first.tags.pairings]);
  const mapTypes = new Set<string>([first.tags.mapType]);
  // 2. Greedily add by relevance + diversity + new map type; ties by id.
  const byIdOrder = [...library].sort(byId);
  while (picked.length < max) {
    let best: { e: Exemplar; score: number } | null = null;
    for (const e of byIdOrder) {
      if (picked.includes(e)) continue;
      const fresh = [...e.tags.kinds, ...e.tags.pairings].filter((x) => !covered.has(x)).length;
      const score = rel.get(e.id)! + Math.min(DIVERSITY_CAP, fresh * DIVERSITY_PER_ITEM) +
        (mapTypes.has(e.tags.mapType) ? 0 : NEW_MAP_TYPE_BONUS);
      if (!best || score > best.score) best = { e, score };
    }
    if (!best || best.score <= 0) break;
    picked.push(best.e);
    best.e.tags.kinds.forEach((k) => covered.add(k));
    best.e.tags.pairings.forEach((p) => covered.add(p));
    mapTypes.add(best.e.tags.mapType);
  }
  return picked;
}
