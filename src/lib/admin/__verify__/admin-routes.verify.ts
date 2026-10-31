/**
 * Fails if any route file under /api/admin or /app/admin exports a handler that
 * does not call the gate first, does not import the real gate, or exports a
 * handler in a form this check cannot verify. Also fails any page under
 * /app/admin that does not call requirePagePermission. Next loads route modules
 * with `import * as userland`, so every export form counts.
 * Run: npx tsx src/lib/admin/__verify__/admin-routes.verify.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const API = join(process.cwd(), 'src', 'app', 'api');
const ROOT = join(API, 'admin');
const APP_ROOT = join(process.cwd(), 'src', 'app', 'admin');
const GATE_MODULE = '@/lib/admin/gate';
const PAGE_FILE = /^page\.(ts|tsx|js|jsx)$/;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const ROUTE_FILE = /^route\.(ts|tsx|js|jsx)$/;
const GATE = /^const gate = await requirePermission\('[a-z]+\.[a-z]+'\);$/;
const GATE_RETURN = 'if (!gate.ok) return gate.response;';

function walk(dir: string, pattern: RegExp): string[] {
  let found: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found = found.concat(walk(path, pattern));
    else if (pattern.test(name)) found.push(path);
  }
  return found;
}

function scriptKind(file: string): ts.ScriptKind {
  return file.endsWith('x') ? ts.ScriptKind.TSX : file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS;
}

/** True when the file imports `name` from the real gate module, without renaming it. */
function importsFromGate(source: ts.SourceFile, name: string): boolean {
  return source.statements.some((s) =>
    ts.isImportDeclaration(s) &&
    ts.isStringLiteral(s.moduleSpecifier) && s.moduleSpecifier.text === GATE_MODULE &&
    !s.importClause?.isTypeOnly &&
    !!s.importClause?.namedBindings && ts.isNamedImports(s.importClause.namedBindings) &&
    s.importClause.namedBindings.elements.some((e) => !e.isTypeOnly && e.name.text === name && !e.propertyName));
}

/** True when anything in the file declares `name` itself (function, variable, parameter, class, import alias). */
function declaresLocally(source: ts.SourceFile, name: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isVariableDeclaration(node) ||
        ts.isParameter(node) || ts.isImportSpecifier(node) || ts.isImportClause(node) || ts.isNamespaceImport(node)) &&
      node.name && ts.isIdentifier(node.name) && node.name.text === name
    ) {
      // The one allowed binding is the unrenamed import from the gate.
      const allowed = ts.isImportSpecifier(node) && !node.propertyName &&
        ts.isStringLiteral(node.parent.parent.parent.moduleSpecifier) &&
        node.parent.parent.parent.moduleSpecifier.text === GATE_MODULE;
      if (!allowed) found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function callsFunction(source: ts.SourceFile, name: string): boolean {
  let found = false;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === name) found = true;
    ts.forEachChild(node, visit);
  };
  visit(source);
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
let pages = 0;
const failures: string[] = [];

function checkFile(file: string) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  const fail = (message: string) => failures.push(`${file}: ${message}`);
  let handlesMethod = false;

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
          if (METHODS.includes(element.name.text)) handlesMethod = true;
          if (METHODS.includes(element.name.text)) fail(`${element.name.text} is exported by name; declare it as an exported async function`);
        }
      }
    } else if (ts.isVariableStatement(statement) && hasExport(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) fail('destructured exports are not allowed in a route file');
        else if (METHODS.includes(declaration.name.text)) handlesMethod = true;
        if (ts.isIdentifier(declaration.name) && METHODS.includes(declaration.name.text)) fail(`${declaration.name.text} must be an exported async function declaration`);
      }
    } else if (hasExport(statement) && ts.getModifiers(statement as ts.HasModifiers)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)) {
      fail('`export default` is not allowed in a route file');
    } else if (hasExport(statement)) {
      const name = (statement as { name?: ts.Identifier }).name?.text;
      if (ts.isFunctionDeclaration(statement) && name && METHODS.includes(name)) {
        handlers++;
        handlesMethod = true;
        const body = statement.body;
        const first = body?.statements[0]?.getText(source) ?? '';
        const second = body?.statements[1]?.getText(source) ?? '';
        if (statement.parameters.some((p) => p.initializer)) fail(`${name}: parameter initializers are not allowed on a handler`);
        if (!isAsync(statement)) fail(`${name} must be async`);
        if (!GATE.test(first)) fail(`${name}: first statement is "${first}", expected the requirePermission gate`);
        else if (second !== GATE_RETURN) fail(`${name}: second statement is "${second}", expected the gate return`);
      } else if (name && METHODS.includes(name)) {
        handlesMethod = true;
        fail(`${name} must be an exported async function declaration`);
      }
    }
  }

  if (handlesMethod) {
    if (!importsFromGate(source, 'requirePermission')) fail(`requirePermission is not imported from '${GATE_MODULE}'`);
    if (declaresLocally(source, 'requirePermission')) fail('requirePermission is declared locally; use the one from the gate module');
  }
}

function checkPage(file: string) {
  const text = readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, scriptKind(file));
  pages++;
  if (!callsFunction(source, 'requirePagePermission')) failures.push(`${file}: page does not call requirePagePermission`);
  else {
    if (!importsFromGate(source, 'requirePagePermission')) failures.push(`${file}: requirePagePermission is not imported from '${GATE_MODULE}'`);
    if (declaresLocally(source, 'requirePagePermission')) failures.push(`${file}: requirePagePermission is declared locally; use the one from the gate module`);
  }
}

const routeFiles = [ROOT, APP_ROOT].flatMap((dir) => (existsSync(dir) ? walk(dir, ROUTE_FILE) : []));
for (const file of routeFiles) checkFile(file);
if (existsSync(APP_ROOT)) for (const file of walk(APP_ROOT, PAGE_FILE)) checkPage(file);

console.log(`${handlers} handlers checked, ${pages} pages checked`);
failures.forEach((f) => console.error('  ✗', f));
process.exit(failures.length ? 1 : 0);
