/**
 * Verifies the data-URI rewrite helpers against a real Y.Doc round trip.
 * Run: npx tsx src/lib/__verify__/embedded-image-rewrite.verify.ts
 */
import * as Y from 'yjs';
import { collectDataUris, replaceDataUris, collectDocDataUris, rewriteDoc } from '../embedded-image-rewrite';

let failed = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) failed++; };

const big = 'data:image/png;base64,' + 'A'.repeat(200000);
const small = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
const map = new Map([[big, 'https://x/a.png'], [small, 'https://x/b.jpg']]);

const json = { a: big, nested: { list: [small, 'keep'], css: `url(${big}) center` }, n: 1 };
ok(collectDataUris(json).size === 2, 'collect finds both distinct URIs, including inside css url()');
const out = replaceDataUris(json, map) as typeof json;
ok(out.a === 'https://x/a.png' && out.nested.list[0] === 'https://x/b.jpg', 'replace swaps values and array members');
ok(out.nested.css === 'url(https://x/a.png) center' && out.n === 1 && out.nested.list[1] === 'keep', 'replace handles embedded url() and leaves the rest');
ok(json.a === big, 'replace does not mutate input');

const doc = new Y.Doc();
const els = doc.getMap('elements');
const el = new Y.Map<unknown>();
el.set('type', 'image'); el.set('src', big);
const style = new Y.Map<unknown>(); style.set('bg', { img: small });
el.set('style', style);
els.set('e1', el);
const textEl = new Y.Map<unknown>(); textEl.set('src', 'https://already/ok.png'); els.set('e2', textEl);

ok(collectDocDataUris(doc).size === 2, 'doc scan finds URIs in nested Y.Map and plain-object values');
const before = Y.encodeStateAsUpdate(doc).length;
const n = rewriteDoc(doc, map);
ok(n === 2, `rewrote 2 values (got ${n})`);
ok(collectDocDataUris(doc).size === 0, 'no data URIs remain in doc');
const reloaded = new Y.Doc();
Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(doc));
const re = reloaded.getMap('elements').get('e1') as Y.Map<unknown>;
ok(re.get('src') === 'https://x/a.png', 'rewrite survives encode/decode');
const after = Y.encodeStateAsUpdate(doc).length;
ok(after < before / 10, `encoded state shrank (${before} -> ${after} bytes)`);
ok((reloaded.getMap('elements').get('e2') as Y.Map<unknown>).get('src') === 'https://already/ok.png', 'untouched values preserved');

process.exit(failed ? 1 : 0);
