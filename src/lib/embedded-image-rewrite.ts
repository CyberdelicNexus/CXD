// Pure helpers for moving embedded data:image URIs out of project rows. Used by
// scripts/externalize-embedded-images.ts; kept free of I/O so it can be verified
// standalone (src/lib/__verify__/embedded-image-rewrite.verify.ts).
import * as Y from 'yjs';

export const DATA_IMAGE_RE = /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g;

const isDataImage = (s: string) => s.startsWith('data:image/');

/** Every distinct data:image URI found anywhere in a JSON-like value. */
export function collectDataUris(value: unknown, out = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (value.includes('data:image/')) for (const m of value.match(DATA_IMAGE_RE) ?? []) out.add(m);
  } else if (Array.isArray(value)) {
    for (const v of value) collectDataUris(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectDataUris(v, out);
  }
  return out;
}

/** Returns a copy with every mapped data URI replaced (also inside longer strings, e.g. css url(...)). */
export function replaceDataUris<T>(value: T, map: Map<string, string>): T {
  if (typeof value === 'string') {
    if (!value.includes('data:image/')) return value;
    return value.replace(DATA_IMAGE_RE, (m) => map.get(m) ?? m) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => replaceDataUris(v, map)) as unknown as T;
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) next[k] = replaceDataUris(v, map);
    return next as T;
  }
  return value;
}

type YContainer = Y.Map<unknown> | Y.Array<unknown>;

function walkY(node: unknown, visit: (container: YContainer, key: string | number, value: unknown) => void) {
  if (node instanceof Y.Map) {
    for (const [k, v] of Array.from(node.entries())) {
      if (v instanceof Y.AbstractType) walkY(v, visit);
      else visit(node, k, v);
    }
  } else if (node instanceof Y.Array) {
    node.toArray().forEach((v, i) => {
      if (v instanceof Y.AbstractType) walkY(v, visit);
      else visit(node, i, v);
    });
  }
}

function roots(doc: Y.Doc): YContainer[] {
  const out: YContainer[] = [];
  doc.share.forEach((t) => {
    if (t instanceof Y.Map || t instanceof Y.Array) out.push(t as YContainer);
  });
  return out;
}

/** Distinct data URIs held anywhere in the doc's Map/Array values. */
export function collectDocDataUris(doc: Y.Doc): Set<string> {
  const found = new Set<string>();
  for (const r of roots(doc)) walkY(r, (_c, _k, v) => collectDataUris(v, found));
  return found;
}

/** Rewrites mapped data URIs in place; returns how many values changed. */
export function rewriteDoc(doc: Y.Doc, map: Map<string, string>, origin: string = 'migration'): number {
  let changed = 0;
  doc.transact(() => {
    for (const r of roots(doc)) {
      walkY(r, (c, k, v) => {
        const next = replaceDataUris(v, map);
        if (JSON.stringify(next) === JSON.stringify(v)) return;
        if (c instanceof Y.Map) c.set(k as string, next);
        else {
          c.delete(k as number, 1);
          c.insert(k as number, [next]);
        }
        changed++;
      });
    }
  }, origin);
  return changed;
}

export function mimeToExt(uri: string): { ext: string; contentType: string } {
  const mime = uri.slice(5, uri.indexOf(';'));
  const ext = mime === 'image/jpeg' ? 'jpg' : mime === 'image/svg+xml' ? 'svg' : mime.split('/')[1]?.replace(/[^a-z0-9]/gi, '') || 'bin';
  return { ext, contentType: mime };
}

export { isDataImage };
