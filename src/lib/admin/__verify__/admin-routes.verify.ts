/**
 * Fails if any /api/admin handler does not call the gate first, so a new route
 * cannot ship unprotected.
 * Run: npx tsx src/lib/admin/__verify__/admin-routes.verify.ts
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src', 'app', 'api', 'admin');
const HANDLER = /export async function (GET|POST|PUT|PATCH|DELETE)\b[^{]*\{\s*([^\n]*)/g;
const GATE = /^const gate = await requirePermission\('[a-z]+\.[a-z]+'\);$/;

function routes(dir: string): string[] {
  let found: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) found = found.concat(routes(path));
      else if (name === 'route.ts') found.push(path);
    }
  } catch {
    return [];
  }
  return found;
}

let handlers = 0;
const failures: string[] = [];
for (const file of routes(ROOT)) {
  const source = readFileSync(file, 'utf8');
  for (const match of Array.from(source.matchAll(HANDLER))) {
    handlers++;
    if (!GATE.test(match[2].trim())) failures.push(`${file} ${match[1]}: first line is "${match[2].trim()}"`);
  }
  if (!source.includes('if (!gate.ok) return gate.response;')) failures.push(`${file}: does not return the gate response`);
}

console.log(`${handlers} handlers checked`);
failures.forEach((f) => console.error('  ✗', f));
process.exit(failures.length ? 1 : 0);
