import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
const ast = ts.createSourceFile('DatabaseToolsDialogs.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function variable(name: string): ts.VariableDeclaration {
  let found: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (!found && ts.isVariableDeclaration(node) && node.name.getText(ast) === name) found = node;
    ts.forEachChild(node, visit);
  };
  const dialog = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'CorporateActionDialog');
  assert.ok(dialog, 'Missing CorporateActionDialog');
  visit(dialog);
  assert.ok(found?.initializer, `Missing dialog variable: ${name}`);
  return found;
}

function evaluate(code: string, bindings: Record<string, unknown> = {}): any {
  const output = ts.transpileModule(code, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    fileName: 'safe-v2-focus-test.tsx',
  }).outputText;
  const context = { ...bindings, exports: {}, value: undefined };
  runInNewContext(output, context, { timeout: 1000 });
  return context.value;
}

function expression(name: string, bindings: Record<string, unknown>): any {
  return evaluate(`globalThis.value = (${variable(name).initializer!.getText(ast)});`, bindings);
}

function rows() {
  return [
    { id: 1, actionType: 'SPLIT', symbol: 'AAA', exchange: 'NSE', companyName: 'Alpha', isin: 'INE1' },
    { id: 2, actionType: 'BONUS', symbol: 'BBB', exchange: 'NSE', companyName: 'Beta', isin: 'INE2' },
    { id: 3, actionType: 'DIVIDEND', symbol: 'AAA', exchange: 'NSE', companyName: 'Gamma', isin: 'INE3' },
  ];
}

function visible(bindings: Record<string, unknown> = {}) {
  return expression('visibleImportRows', {
    importRows: rows(),
    effectiveImportActionTypes: ['SPLIT', 'BONUS', 'DIVIDEND'],
    normalizedImportSearchQuery: '',
    matchesCorporateImportSearch: (row: { symbol: string }, query: string) => row.symbol.includes(query),
    showingApprovedImports: false,
    officialReviewSymbolFilter: 'ALL',
    officialImportGroupKey: (row: { symbol: string }) => row.symbol,
    officialSafeV2SkippedFocusActive: false,
    officialAutoApprovalSkippedReasons: new Map<number, string>([[2, 'Exact backend reason']]),
    useMemo: (factory: () => unknown) => factory(),
    ...bindings,
  }) as Array<{ id: number }>;
}

function dialogSource(): string {
  const dialog = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'CorporateActionDialog');
  assert.ok(dialog);
  return dialog.getText(ast);
}

describe('Active Legacy Safe V2 skipped focus filter R1', () => {
  it('F1 declares an OFF-by-default current-cycle focus state and activates it only in pending review', () => {
    assert.match(source, /\[officialSafeV2SkippedOnly, setOfficialSafeV2SkippedOnly\] = useState\(false\)/);
    const active = variable('officialSafeV2SkippedFocusActive').initializer!.getText(ast);
    assert.match(active, /activeOfficialImportView === 'review'/);
    assert.match(active, /officialSafeV2SkippedOnly/);
    assert.match(active, /currentOfficialAutoApproval != null/);
  });

  it('F2 OFF preserves the existing visible-row population', () => {
    assert.deepEqual(visible().map((row) => row.id), [1, 2, 3]);
    assert.deepEqual(visible({ officialSafeV2SkippedFocusActive: false, officialAutoApprovalSkippedReasons: new Map() }).map((row) => row.id), [1, 2, 3]);
  });

  it('F3 ON intersects backend-returned SKIPPED IDs with the existing type/search/symbol filters', () => {
    assert.deepEqual(visible({ officialSafeV2SkippedFocusActive: true }).map((row) => row.id), [2]);
    assert.deepEqual(visible({
      officialSafeV2SkippedFocusActive: true,
      normalizedImportSearchQuery: 'BBB',
      officialReviewSymbolFilter: 'BBB',
    }).map((row) => row.id), [2]);
    assert.deepEqual(visible({
      officialSafeV2SkippedFocusActive: true,
      normalizedImportSearchQuery: 'AAA',
    }).map((row) => row.id), []);
  });

  it('F4 Approved view ignores the Safe V2 skipped focus', () => {
    assert.deepEqual(visible({ showingApprovedImports: true, officialSafeV2SkippedFocusActive: false }).map((row) => row.id), [1, 2, 3]);
    const active = expression('officialSafeV2SkippedFocusActive', {
      activeOfficialImportView: 'approved', officialSafeV2SkippedOnly: true, currentOfficialAutoApproval: { requested: 1 },
    });
    assert.equal(active, false);
  });

  it('F5 losing the current authoritative outcome clears the ephemeral focus', () => {
    const dialog = dialogSource();
    assert.match(dialog, /if \(!currentOfficialAutoApproval && officialSafeV2SkippedOnly\) setOfficialSafeV2SkippedOnly\(false\);/);
    assert.match(dialog, /\[currentOfficialAutoApproval, officialSafeV2SkippedOnly\]/);
  });

  it('F6 compact filter UI shows count, uses current outcome as enablement, and clears stale selection/confirmation', () => {
    const dialog = dialogSource();
    assert.match(dialog, /aria-label="Safe V2 skipped focus"/);
    assert.match(dialog, /Safe V2 skipped \(\{officialAutoApprovalSkippedReasons\.size\}\)/);
    assert.match(dialog, /disabled=\{busy \|\| currentOfficialAutoApproval == null \|\| officialAutoApprovalSkippedReasons\.size === 0\}/);
    const labelStart = dialog.indexOf('aria-label="Safe V2 skipped focus"');
    assert.ok(labelStart >= 0);
    const labelSlice = dialog.slice(labelStart, labelStart + 700);
    assert.match(labelSlice, /setOfficialSafeV2SkippedOnly\(event\.target\.checked\)/);
    assert.match(labelSlice, /setSelectedImportIds\(new Set\(\)\)/);
    assert.match(labelSlice, /setOfficialApprovalConfirmation\(null\)/);
  });

  it('P7 manual Apply eligibility predicate remains unchanged and has no Safe V2 focus veto', () => {
    const eligible = variable('eligibleImportRows').initializer!.getText(ast);
    assert.match(eligible, /visibleImportRows\.filter/);
    assert.match(eligible, /officialPreparationComplete/);
    assert.match(eligible, /!officialPreparationErrors\[row\.id\]/);
    assert.match(eligible, /isApprovableCorporateImport/);
    assert.doesNotMatch(eligible, /SafeV2|SkippedFocus|SkippedOnly/);
  });

  it('P8 current-cycle reason authority remains backend SKIPPED dispositions only', () => {
    const reasons = variable('officialAutoApprovalSkippedReasons').initializer!.getText(ast);
    assert.match(reasons, /currentOfficialAutoApproval\?\.dispositions/);
    assert.match(reasons, /disposition\.disposition === 'SKIPPED'/);
    assert.doesNotMatch(reasons, /scan|MATCHED|confidence|factor|evaluate|autoApprove/);
  });

  it('P9 final preparation status remains orchestration-owned', () => {
    const load = variable('loadAndPrepareOfficialImports').initializer!.getText(ast);
    assert.match(load, /setStatus\(result\.message\)/);
    assert.doesNotMatch(load, /Safe V2 skipped focus|officialSafeV2SkippedOnly/);
  });

  it('P10 focus feature adds no persistence, backend call, or second evaluator', () => {
    const dialog = dialogSource();
    const names = dialog.match(/officialSafeV2SkippedOnly/g) ?? [];
    assert.ok(names.length >= 4);
    const focusSlice = dialog.slice(dialog.indexOf('officialSafeV2SkippedOnly') - 120, dialog.indexOf('officialSafeV2SkippedOnly') + 1800);
    assert.doesNotMatch(focusSlice, /setSetting|localStorage|sessionStorage|autoApproveCorporateActionImports|runCorporateActionScan|fetch\(/);
  });
});
