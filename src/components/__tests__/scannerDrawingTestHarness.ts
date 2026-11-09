import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise private production functions without mounting the desktop bridge.
// Bodies come directly from current source; no drawing logic is reimplemented.
export function loadSourceFunctions(path: string, names: string[], globals: Record<string, unknown> = {}) {
  const text = readFileSync(resolve(path), 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const code = names.map((name) => {
    const node = source.statements.find((statement) =>
      (ts.isFunctionDeclaration(statement) && statement.name?.text === name) ||
      (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => d.name.getText(source) === name)));
    if (!node) throw new Error(`Missing production function ${path}:${name}`);
    return node.getText(source);
  }).join('\n');
  return evaluateSource(code, globals);
}

export function evaluateSource(code: string, globals: Record<string, unknown> = {}) {
  const context = vm.createContext({ exports: {}, ...globals });
  const output = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  vm.runInContext(output.outputText, context);
  return context;
}

export function loadNestedSourceFunction(path: string, name: string, globals: Record<string, unknown>) {
  const text = readFileSync(resolve(path), 'utf8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression = '';
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer!.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  if (!expression) throw new Error(`Missing production closure ${path}:${name}`);
  return evaluateSource(`globalThis.handler = ${expression};`, globals).handler;
}
