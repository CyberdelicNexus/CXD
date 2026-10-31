/**
 * Fails if any /api/admin route file exports a handler that does not call the
 * gate first, or exports a handler in a form this check cannot verify. Next
 * loads route modules with `import * as userland`, so every export form counts.
 * Run: npx tsx src/lib/admin/__verify__/admin-routes.verify.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const API = join(process.cwd(), 'src', 'app', 'api');
const ROOT = join(API, 'admin');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const ROUTE_FILE = /^route\.(ts|tsx|js|jsx)$/;
const GATE = /^const gate = await requirePermission\('[a-z]+\.[a-z]+'\);$/;
const GATE_RETURN = 'if (!gate.ok) return gate.response;';

function routes(dir: string): string[] {
  let found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found = found.concat(routes(path));
    else if (ROUTE_FILE.test(name)) found.push(path);
  }
  return found;
}

function hasExport(node: ts.Node): boolean {
  return !!ts.canHaveModifiers(node) &&
    !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function isAsync(node: ts.FunctionDeclaration): boolean {
  return !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
}

if (!existsSync(API)) {
  console.error(`  ✗ ${API} does not exist: run this from the repository root`);
  process.exit(1);
}

let handlers = 0;
const failures: string[] = [];

function checkFile(file: string) {
  const text = readFileSync(file, 'utf8');
  const kind = file.endsWith('x') ? ts.ScriptKind.TSX : file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, kind);
  const fail = (message: string) => failures.push(`${file}: ${message}`);

  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      fail('`export default` or `export =` is not allowed in a route file');
    } else if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        fail('`export *` is not allowed in a route file');
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        fail('`export * as` is not allowed in a route file');
      } else {
        for (const element of statement.exportClause.elements) {
          if (METHODS.includes(element.name.text)) fail(`${element.name.text} is exported by name; declare it as an exported async function`);
        }
      }
    } else if (ts.isVariableStatement(statement) && hasExport(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) fail('destructured exports are not allowed in a route file');
        else if (METHODS.includes(declaration.name.text)) fail(`${declaration.name.text} must be an exported async function declaration`);
      }
    } else if (hasExport(statement) && ts.getModifiers(statement as ts.HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      fail('`export default` is not allowed in a route file');
    } else if (hasExport(statement)) {
      const name = (statement as { name?: ts.Identifier }).name?.text;
      if (ts.isFunctionDeclaration(statement) && name && METHODS.includes(name)) {
        handlers++;
        const body = statement.body;
        const first = body?.statements[0]?.getText(source) ?? '';
        const second = body?.statements[1]?.getText(source) ?? '';
        if (!isAsync(statement)) fail(`${name} must be async`);
        if (!GATE.test(first)) fail(`${name}: first statement is "${first}", expected the requirePermission gate`);
        else if (second !== GATE_RETURN) fail(`${name}: second statement is "${second}", expected the gate return`);
      } else if (name && METHODS.includes(name)) {
        fail(`${name} must be an exported async function declaration`);
      }
    }
  }
}

for (const file of existsSync(ROOT) ? routes(ROOT) : []) checkFile(file);

console.log(`${handlers} handlers checked`);
failures.forEach((f) => console.error('  ✗', f));
process.exit(failures.length ? 1 : 0);
