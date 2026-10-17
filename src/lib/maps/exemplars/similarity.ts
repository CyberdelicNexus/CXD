// How close two inputs are, so no exemplar hands the model the answer to a
// lab corpus input. Too close: the titles match after normalising, or the
// texts' word 3-gram sets have Jaccard similarity >= MAX_INPUT_SIMILARITY.
// Pure; used by exemplars.verify, corpus.verify, exemplar selection and promotion.

export interface TextInput { title: string; text: string }

export const MAX_INPUT_SIMILARITY = 0.3;

/** Lowercase words with punctuation stripped. */
export function normaliseWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").split(/\s+/).filter(Boolean);
}

/** The set of consecutive word triples. */
export function trigrams(s: string): Set<string> {
  const w = normaliseWords(s);
  const out = new Set<string>();
  for (let i = 0; i + 2 < w.length; i++) out.add(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  a.forEach((x) => { if (b.has(x)) shared++; });
  return shared / (a.size + b.size - shared);
}

/** Why `a` is too close to `b`, or null. */
export function tooClose(a: TextInput, b: TextInput): string | null {
  const ta = normaliseWords(a.title).join(" ");
  if (ta && ta === normaliseWords(b.title).join(" ")) return `same title as "${b.title}"`;
  const j = jaccard(trigrams(a.text), trigrams(b.text));
  if (j >= MAX_INPUT_SIMILARITY) return `text ${Math.round(j * 100)}% similar to "${b.title}"`;
  return null;
}

/** The first corpus input `input` is too close to (skipping `exemptId`), as a reason, or null. */
export function closestCorpusClash(input: TextInput, corpus: (TextInput & { id: string })[], exemptId?: string): string | null {
  for (const c of corpus) {
    if (c.id === exemptId) continue;
    const why = tooClose(input, c);
    if (why) return `${why} (${c.id})`;
  }
  return null;
}
