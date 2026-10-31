/**
 * Fails if any /api/admin handler does not call the gate first, so a new route
 * cannot ship unprotected.
 * Run: npx tsx src/lib/admin/__verify__/admin-routes.verify.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const API = join(process.cwd(), 'src', 'app', 'api');
const ROOT = join(API, 'admin');
const METHODS = 'GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS';
const ASYNC_HANDLER = new RegExp(String.raw`^export async function (${METHODS})\b[^{]*\{[ \t]*$`);
const ANY_EXPORT = [
  new RegExp(String.raw`export\s+(?:async\s+)?function\s+(${METHODS})\b`, 'g'),
  new RegExp(String.raw`export\s+(?:const|let|var)\s+(${METHODS})\b`, 'g'),
];
const REEXPORT = /export\s*(?:type\s*)?\{([^}]*)\}/g;
const GATE = /^const gate = await requirePermission\('[a-z]+\.[a-z]+'\);$/;
const GATE_RETURN = 'if (!gate.ok) return gate.response;';

function routes(dir: string): string[] {
  let found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found = found.concat(routes(path));
    else if (name === 'route.ts' || name === 'route.tsx') found.push(path);
  }
  return found;
}

if (!existsSync(API)) {
  console.error(`  ✗ ${API} does not exist: run this from the repository root`);
  process.exit(1);
}

let handlers = 0;
const failures: string[] = [];
for (const file of existsSync(ROOT) ? routes(ROOT) : []) {
  const source = readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);

  // Any export form other than `export async function X` is refused.
  const exported = new Set<string>();
  for (const re of ANY_EXPORT) for (const m of Array.from(source.matchAll(re))) exported.add(m[1]);
  for (const m of Array.from(source.matchAll(REEXPORT))) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()!.trim();
      if (new RegExp(`^(${METHODS})$`).test(name)) exported.add(name);
    }
  }

  const checked = new Set<string>();
  lines.forEach((line, i) => {
    const m = ASYNC_HANDLER.exec(line);
    if (!m) return;
    handlers++;
    checked.add(m[1]);
    const rest = lines.slice(i + 1);
    const first = rest.findIndex((l) => l.trim() !== '');
    const second = first < 0 ? -1 : rest.slice(first + 1).findIndex((l) => l.trim() !== '');
    const a = first < 0 ? '' : rest[first].trim();
    const b = second < 0 ? '' : rest.slice(first + 1)[second].trim();
    if (!GATE.test(a)) failures.push(`${file} ${m[1]}: first statement is "${a}"`);
    else if (b !== GATE_RETURN) failures.push(`${file} ${m[1]}: next line is "${b}", expected the gate return`);
  });

  for (const name of Array.from(exported)) {
    if (!checked.has(name)) failures.push(`${file} ${name}: exported in a form other than "export async function ${name}(...) {"`);
  }
}

console.log(`${handlers} handlers checked`);
failures.forEach((f) => console.error('  ✗', f));
process.exit(failures.length ? 1 : 0);
