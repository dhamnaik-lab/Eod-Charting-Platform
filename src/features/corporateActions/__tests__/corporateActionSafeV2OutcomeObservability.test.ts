import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it } from 'vitest';

// Node-only tests of the real dialog handlers and JSX, extracted with the TS AST.
// No desktop API, browser, network or database is opened. The JSX runtime below
// records element props; this is not a substitute for a manual visual checkpoint.
const source = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
const ast = ts.createSourceFile('DatabaseToolsDialogs.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const preparationSource = readFileSync(resolve(process.cwd(),
  'src/features/corporateActions/legacy/corporateActionImportOperations.ts'), 'utf8');

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
    fileName: 'dialog-test.tsx',
  }).outputText;
  const context = { ...bindings, exports: {}, value: undefined };
  runInNewContext(output, context, { timeout: 1000 });
  return context.value;
}

function expression(name: string, bindings: Record<string, unknown>): any {
  return evaluate(`globalThis.value = (${variable(name).initializer!.getText(ast)});`, bindings);
}

type Element = { type: string; props: { children?: unknown; [key: string]: unknown } };
function component(name: string, props: object): Element | null {
  const declaration = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `Missing presentation component: ${name}`);
  const jsx = (type: string, attributes: Element['props']): Element => ({ type, props: attributes });
  return evaluate(`${declaration.getText(ast)}; globalThis.value = ${name}(props);`, {
    props, corporateIssueHintTextStyle: {},
    require: (id: string) => {
      assert.equal(id, 'react/jsx-runtime');
      return { jsx, jsxs: jsx };
    },
  });
}

function text(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  if (typeof node === 'object') return text((node as Element).props.children);
  return String(node);
}

function result() {
  return {
    requested: 9, eligible: 3, autoApproved: 2, linkedExisting: 1, alreadyApproved: 1,
    skipped: 4, failed: 1, policyVersion: 'AUTO_APPROVAL_SAFE_V2', message: 'Backend message',
    dispositions: [
      { importId: 3494, disposition: 'SKIPPED', reason: 'Raw event identity conflicts.\n  Exact backend text <proof>.', importRecord: null, approvedRecord: null },
      { importId: 3495, disposition: 'FAILED', reason: 'Writer refused stale evidence.', importRecord: null, approvedRecord: null },
      { importId: 3496, disposition: 'ALREADY_APPROVED', reason: 'Already approved.', importRecord: null, approvedRecord: null },
    ],
  };
}

function preparation(autoApproval: ReturnType<typeof result> | null = result()) {
  return { autoApproval, rows: [], identityHints: {}, validationRows: [], validationImportIds: [],
    errors: [] as { importId: number; message: string }[], complete: true,
    message: 'Prepared 9 row(s) from the pending queue. Auto-Approval Safe V2 approved/linked 3; review the remaining actions and use the existing manual Apply controls where appropriate.' };
}

function loadHarness(response: Promise<ReturnType<typeof preparation>>) {
  const state = { outcome: { obsolete: true } as any, message: '', errors: {} as Record<number, string>, complete: false };
  const database = { path: 'TEST-A' };
  const generation = { current: 4 };
  const cancelled = { current: false };
  const running = { current: false };
  // The live Load & Validate handler clears its cached pending Review snapshot.
  // Bind the actual ref shape in this isolated AST harness to test that behavior.
  const pendingReview = { current: { obsolete: true } as unknown };
  const bindings: Record<string, unknown> = {
    api: {}, activeDatabasePath: database.path,
    officialPreparationGenerationRef: generation, officialCancelPreparationRef: cancelled,
    officialOperationRunningRef: running, pendingReviewRef: pendingReview,
    useChartStore: { getState: () => ({ snapshot: { activeDatabasePath: database.path } }) },
    prepareCorporateActionPendingImports: () => response,
    setOfficialAutoApproval: (value: unknown) => { state.outcome = value; },
    setOfficialDividendPreparedScopeOutcome: () => {},
    setOfficialPreparationComplete: (value: boolean) => { state.complete = value; },
    setOfficialPreparationErrors: (value: Record<number, string>) => { state.errors = value; },
    setStatus: (value: string) => { state.message = value; },
    getErrorMessage: (error: Error) => error.message,
  };
  for (const name of ['setBusy', 'setOfficialCanCancelPreparation', 'setOfficialApprovalConfirmation',
    'setSelectedImportIds', 'setSelectedIssueImportIds', 'setImportRows', 'setImportIdentityHints',
    'setCorporateProgress', 'setOfficialTaskProgress', 'mergeOfficialValidationRows']) bindings[name] = () => {};
  bindings.setLoadedImportRows = expression('setLoadedImportRows', bindings);
  const load = expression('loadAndPrepareOfficialImports', bindings) as () => Promise<void>;
  return { state, database, generation, cancelled, running, pendingReview, load };
}

function deferred<T>() {
  let fulfill!: (value: T) => void;
  let fail!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { fulfill = yes; fail = no; });
  return { promise, fulfill, fail };
}

function databaseResetEffect(): string {
  let found = '';
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' &&
        node.arguments[1]?.getText(ast) === '[activeDatabasePath]' &&
        node.arguments[0]?.getText(ast).includes('setOfficialPreparationComplete(false)')) {
      found = node.arguments[0].getText(ast);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(found, 'Missing database reset effect');
  return found;
}

describe('Active Legacy Safe V2 outcome observability R1', () => {
  it('R1 summary shows authoritative counters separately from the final status', () => {
    const node = component('OfficialSafeV2OutcomeSummary', { result: result() });
    assert.equal(node?.props['aria-label'], 'Safe V2 outcome summary');
    assert.equal(text(node), 'Safe V2: requested 9 · eligible 3 · approved/linked 3 · already approved 1 · skipped 4 · failed 1');
  });
  it('R2 null/OFF result shows no fabricated summary', () => {
    assert.equal(component('OfficialSafeV2OutcomeSummary', { result: null }), null);
  });
  it('R3 a genuine zero-count result is still visible', () => {
    const zero = { ...result(), requested: 0, eligible: 0, autoApproved: 0, linkedExisting: 0,
      alreadyApproved: 0, skipped: 0, failed: 0, dispositions: [] };
    assert.equal(text(component('OfficialSafeV2OutcomeSummary', { result: zero })),
      'Safe V2: requested 0 · eligible 0 · approved/linked 0 · already approved 0 · skipped 0 · failed 0');
  });
  it('R4 skipped note preserves exact backend text as a JSX text child', () => {
    const reason = result().dispositions[0].reason;
    const node = component('OfficialSafeV2SkippedReason', { reason });
    assert.equal(text(node), `Safe V2 left for manual review: ${reason}`);
    assert.equal(node?.props.dangerouslySetInnerHTML, undefined);
    assert.equal((node?.props.style as { whiteSpace: string }).whiteSpace, 'pre-wrap');
  });
  it('R5 absent or empty reason does not fabricate an explanation', () => {
    assert.equal(component('OfficialSafeV2SkippedReason', { reason: undefined }), null);
    assert.equal(component('OfficialSafeV2SkippedReason', { reason: '' }), null);
  });
  it('R6 reason index includes only SKIPPED, excluding FAILED and already-approved', () => {
    const approval = result();
    const reasons = expression('officialAutoApprovalSkippedReasons', {
      currentOfficialAutoApproval: approval, useMemo: (factory: () => unknown) => factory(),
    }) as Map<number, string>;
    assert.equal(reasons.size, 1);
    assert.equal(reasons.get(3494), approval.dispositions[0].reason);
    assert.equal(reasons.get(3495), undefined);
    assert.equal(reasons.get(9999), undefined);
  });
  it('R7 no scoped result yields an empty reason index', () => {
    assert.equal(expression('officialAutoApprovalSkippedReasons', {
      currentOfficialAutoApproval: null, useMemo: (factory: () => unknown) => factory(),
    }).size, 0);
  });
  it('R8 outcome is visible only for this database, generation and completed idle preparation', () => {
    const approval = result();
    const defaults = { officialAutoApproval: { databasePath: 'TEST-A', generation: 5, result: approval },
      activeDatabasePath: 'TEST-A', officialPreparationGenerationRef: { current: 5 },
      officialPreparationComplete: true, busy: false };
    assert.equal(expression('currentOfficialAutoApproval', defaults), approval);
    for (const overrides of [{ activeDatabasePath: 'TEST-B' }, { officialPreparationGenerationRef: { current: 6 } },
      { officialPreparationComplete: false }, { busy: true }, { officialAutoApproval: null }]) {
      assert.equal(expression('currentOfficialAutoApproval', { ...defaults, ...overrides }), null);
    }
  });
  it('R9 real prepare handler clears old outcome before awaiting and stores the exact current result', async () => {
    const pending = deferred<ReturnType<typeof preparation>>();
    const harness = loadHarness(pending.promise);
    const task = harness.load();
    assert.equal(harness.pendingReview.current, null);
    assert.equal(harness.state.outcome, null);
    const reply = preparation();
    pending.fulfill(reply);
    await task;
    assert.equal(harness.state.outcome!.result, reply.autoApproval);
    assert.equal(harness.state.outcome!.databasePath, 'TEST-A');
    assert.equal(harness.state.outcome!.generation, 5);
    assert.equal(harness.state.message, reply.message);
    assert.equal(Object.keys(harness.state.errors).length, 0);
  });
  it('R10 cancelled prepare cannot publish a returned outcome', async () => {
    const pending = deferred<ReturnType<typeof preparation>>();
    const h = loadHarness(pending.promise); const task = h.load(); h.cancelled.current = true;
    pending.fulfill(preparation()); await task;
    assert.equal(h.state.outcome, null);
  });
  it('R11 old database completion cannot publish a returned outcome', async () => {
    const pending = deferred<ReturnType<typeof preparation>>();
    const h = loadHarness(pending.promise); const task = h.load(); h.database.path = 'TEST-B';
    pending.fulfill(preparation()); await task;
    assert.equal(h.state.outcome, null);
  });
  it('R12 stale generation completion cannot publish a returned outcome', async () => {
    const pending = deferred<ReturnType<typeof preparation>>();
    const h = loadHarness(pending.promise); const task = h.load(); h.generation.current += 1;
    pending.fulfill(preparation()); await task;
    assert.equal(h.state.outcome, null);
  });
  it('R13 OFF/no candidate return leaves no previous outcome', async () => {
    const h = loadHarness(Promise.resolve(preparation(null))); await h.load();
    assert.equal(h.state.outcome, null);
  });
  it('R14 throwing prepare leaves no previous outcome', async () => {
    const h = loadHarness(Promise.reject(new Error('Required check failed'))); await h.load();
    assert.equal(h.state.outcome, null); assert.equal(h.state.complete, false);
  });
  it('R15 FAILED remains a preparation error rather than being downgraded to a skip note', async () => {
    const reply = { ...preparation(), errors: [{ importId: 3495, message: 'Writer refused stale evidence.' }] };
    const h = loadHarness(Promise.resolve(reply)); await h.load();
    assert.equal(h.state.errors[3495], 'Writer refused stale evidence.');
    assert.equal(h.state.errors[3494], undefined);
  });
  it('R16 any authoritative queue reload clears the previous outcome', () => {
    let outcome: unknown = result();
    const pendingReview = { current: { obsolete: true } as unknown };
    expression('setLoadedImportRows', { pendingReviewRef: pendingReview,
      setOfficialAutoApproval: (value: unknown) => { outcome = value; },
      setOfficialDividendPreparedScopeOutcome: () => {},
      setImportRows: () => {}, setSelectedImportIds: () => {}, setSelectedIssueImportIds: () => {} })([]);
    assert.equal(outcome, null);
    assert.equal(pendingReview.current, null);
  });
  it('R17 database reset and close clear ephemeral outcome state', () => {
    assert.match(databaseResetEffect(), /setOfficialAutoApproval\(null\)/);
    assert.match(variable('handleClose').initializer!.getText(ast), /setOfficialAutoApproval\(null\)/);
  });
  it('R18 actual manual Apply starts by clearing the previous preparation outcome', () => {
    assert.match(variable('confirmOfficialImportApproval').initializer!.getText(ast), /setOfficialAutoApproval\(null\)/);
  });
  it('R19 the manual checkbox predicate remains independent of Safe V2 skip reasons', () => {
    assert.equal(variable('canApprove').initializer!.getText(ast),
      "officialPreparationComplete && !officialPreparationErrors[row.id] && approvalState === 'READY TO APPROVE'");
    const ready = { officialPreparationComplete: true, officialPreparationErrors: {},
      approvalState: 'READY TO APPROVE', row: { id: 3494 }, officialAutoApprovalSkippedReasons: new Map([[3494, 'Manual review']]) };
    assert.equal(expression('canApprove', ready), true);
    assert.equal(expression('canApprove', { ...ready, officialPreparationErrors: { 3494: 'Required check failed' } }), false);
    assert.ok(source.includes('disabled={busy || !hasDatabase || !officialPreparationComplete || selectedEligibleImportRows.length === 0}'));
    assert.ok(source.includes('disabled={busy || !hasDatabase || !officialPreparationComplete || eligibleImportRows.length === 0}'));
  });
  it('R20 summary is wired into the existing compact band and skip note only into expanded pending rows', () => {
    const statusStart = source.indexOf('data-ca-review-band="status"');
    const statusEnd = source.indexOf('Review official actions', statusStart);
    assert.match(source.slice(statusStart, statusEnd), /<OfficialSafeV2OutcomeSummary result=\{currentOfficialAutoApproval\}/);
    const rowStart = source.indexOf('{expanded ? group.rows.map((row) => {');
    const rowEnd = source.indexOf(': visibleImportRows.map((row) => {', rowStart);
    assert.match(source.slice(rowStart, rowEnd), /<OfficialSafeV2SkippedReason reason=\{officialAutoApprovalSkippedReasons.get\(row.id\)\}/);
    assert.match(source.slice(rowStart, rowEnd), /!officialPreparationErrors\[row.id\]/);
    assert.equal((source.match(/data-ca-review-band=/g) ?? []).length, 3);
  });
  it('R21 final message remains backend-orchestration-owned, without UI append/rewrite', () => {
    const load = variable('loadAndPrepareOfficialImports').initializer!.getText(ast);
    assert.match(load, /setStatus\(result.message\)/);
    assert.ok(preparationSource.includes('Auto-Approval Safe V2 approved/linked ${autoApprovedCount}'));
    assert.ok(preparationSource.includes('review the remaining actions and use the existing manual Apply controls where appropriate.'));
  });
  it('R22 the new UI state is ephemeral; no persistence or HTML injection is introduced', () => {
    const summary = ast.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === 'OfficialSafeV2OutcomeSummary');
    const note = ast.statements.find((n): n is ts.FunctionDeclaration => ts.isFunctionDeclaration(n) && n.name?.text === 'OfficialSafeV2SkippedReason');
    assert.ok(summary && note);
    assert.doesNotMatch(summary.getText(ast) + note.getText(ast), /setSetting|localStorage|sessionStorage|dangerouslySetInnerHTML|autoApprove\w*\s*\(|fetch\(/);
    assert.match(source, /setOfficialAutoApproval\]\s*=\s*useState</);
  });
});
