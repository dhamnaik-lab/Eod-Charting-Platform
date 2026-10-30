import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/BhavcopyDownloadWindow.tsx'), 'utf8');
const styles = readFileSync(resolve(process.cwd(), 'src/components/BhavcopyDownloadWindow.styles.ts'), 'utf8');
const ast = ts.createSourceFile('BhavcopyDownloadWindow.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
type Holiday = { id: number; date: string; name: string; source: string };
type Deferred<T> = { resolve: (v: T) => void; reject: (reason: Error) => void };
function deferred<T>(): { promise: Promise<T> } & Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function componentVariable(name: string): ts.VariableDeclaration {
  const component = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'BhavcopyDownloadWindow');
  assert.ok(component);
  let match: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (!match && ts.isVariableDeclaration(node) && node.name.getText(ast) === name) match = node;
    ts.forEachChild(node, visit);
  };
  visit(component);
  assert.ok(match?.initializer, `Missing ${name}`);
  return match;
}
function harness() {
  let databasePath: string | null = 'DB-A';
  const reads: Array<Deferred<Holiday[]>> = [];
  const adds: Array<Deferred<Holiday>> = [];
  const removes: Array<Deferred<void>> = [];
  const state = {
    rows: [] as Holiday[], loadedDatabase: null as string | null, loading: false,
    error: null as string | null, status: '' as string, kind: '' as string,
    pending: null as string | number | null, newDate: '2026-10-29', newName: 'Test Holiday', confirm: null as number | null,
  };
  const req = { current: 0 };
  const mutation = { current: false };
  const generation = { current: 0 };
  const api = {
    listMarketHolidays: () => { const d = deferred<Holiday[]>(); reads.push(d); return d.promise; },
    addMarketHoliday: (_date: string, _name: string) => { const d = deferred<Holiday>(); adds.push(d); return d.promise; },
    deleteMarketHoliday: (_id: number) => { const d = deferred<void>(); removes.push(d); return d.promise; },
  };
  const context: Record<string, unknown> = {
    api,
    holidayRequestIdRef: req,
    holidayMutationInFlightRef: mutation,
    holidayMutationVersionRef: generation,
    useChartStore: { getState: () => ({ snapshot: { activeDatabasePath: databasePath } }) },
    setHolidays: (value: Holiday[] | ((prev: Holiday[]) => Holiday[])) => {
      state.rows = typeof value === 'function' ? value(state.rows) : value;
    },
    setHolidayDatabasePath: (value: string | null) => { state.loadedDatabase = value; },
    setHolidaysLoading: (value: boolean) => { state.loading = value; },
    setHolidayError: (value: string | null) => { state.error = value; },
    reportHolidayStatus: (kind: string, text: string) => { state.kind = kind; state.status = text; },
    setHolidayMutationPending: (value: string | number | null) => { state.pending = value; },
    setNewHolidayDate: (value: string) => { state.newDate = value; },
    setNewHolidayName: (value: string) => { state.newName = value; },
    setDeleteConfirmId: (value: number | null) => { state.confirm = value; },
    getErrorMessage: (error: Error) => error.message,
    newHolidayDate: state.newDate,
    newHolidayName: state.newName,
    holidayDatabasePath: 'DB-A',
    visibleHolidays: [{ id: 3, date: '2026-10-30', name: 'Remove me', source: 'USER' }],
  };
  const names = ['loadHolidays', 'handleAddHoliday', 'handleDeleteHoliday'];
  const javascript = names.map((name) => `globalThis.${name} = ${componentVariable(name).initializer!.getText(ast)};`).join('\n');
  const code = ts.transpileModule(javascript, { fileName: 'holiday-harness.ts', compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  runInNewContext(code, context, { timeout: 1500 });
  return {
    state, reads, adds, removes, mutation, generation, req,
    load: context.loadHolidays as () => Promise<void>,
    add: context.handleAddHoliday as () => Promise<void>,
    remove: context.handleDeleteHoliday as (id: number) => Promise<void>,
    switchDatabase: (path: string) => { databasePath = path; generation.current++; req.current++; },
  };
}
const row = (id: number): Holiday => ({ id, date: '2026-10-29', name: 'Test Holiday', source: 'USER' });

describe('HOL-02 holiday layout and status regression', () => {
  it('uses a bounded column layout with table-only scroll, sticky header, fixed add section and fixed status', () => {
    assert.match(styles, /marketHolidayPageStyle:[\s\S]*?flexDirection: 'column'[\s\S]*?overflow: 'hidden'/);
    assert.match(styles, /marketHolidayTableStyle:[\s\S]*?flex: '1 1 0'[\s\S]*?overflowY: 'auto'/);
    assert.match(styles, /marketHolidayTableHeaderStyle:[\s\S]*?position: 'sticky'[\s\S]*?top: 0/);
    assert.match(styles, /marketHolidayAddStyle:[\s\S]*?flexShrink: 0/);
    assert.match(styles, /marketHolidayStatusStyle:[\s\S]*?flexShrink: 0/);
    assert.match(source, /role="columnheader">Date/);
    assert.match(source, /role="columnheader">Name/);
    assert.match(source, /aria-live=\{holidayStatus\.kind/);
  });

  it('shows loading and a verified record-count success only after backend refresh resolves', async () => {
    const h = harness();
    const p = h.load();
    expect(h.state.kind).toBe('info');
    expect(h.state.status).toContain('Refreshing');
    expect(h.reads.length).toBe(1);
    h.reads[0].resolve([row(1), row(2)]);
    await p;
    expect(h.state.rows.length).toBe(2);
    expect(h.state.status).toContain('2 records');
    expect(h.state.kind).toBe('success');
  });

  it('reports API refresh failure, without falsely reporting success', async () => {
    const h = harness();
    const p = h.load();
    h.reads[0].reject(new Error('Service unavailable'));
    await p;
    expect(h.state.kind).toBe('error');
    expect(h.state.status).toContain('Service unavailable');
    expect(h.state.rows).toEqual([]);
  });

  it('never publishes an outdated refresh status or list after database switch', async () => {
    const h = harness();
    const p = h.load();
    h.switchDatabase('DB-B');
    h.reads[0].resolve([row(1)]);
    await p;
    expect(h.state.rows).toEqual([]);
    expect(h.state.kind).toBe('info');
  });

  it('prevents duplicate Add while a request is pending and reports success only after backend resolves', async () => {
    const h = harness();
    const first = h.add();
    expect(h.state.status).toContain('Adding');
    await h.add();
    expect(h.adds.length).toBe(1);
    expect(h.mutation.current).toBe(true);
    h.adds[0].resolve(row(1));
    await first;
    expect(h.mutation.current).toBe(false);
    expect(h.state.rows.map((r) => r.id)).toEqual([1]);
    expect(h.state.status).toContain('Holiday added');
    expect(h.state.kind).toBe('success');
  });

  it('reports Add errors without clearing the entry or reporting success', async () => {
    const h = harness();
    const p = h.add();
    h.adds[0].reject(new Error('Already exists'));
    await p;
    expect(h.state.status).toContain('Already exists');
    expect(h.state.kind).toBe('error');
    expect(h.state.newName).toBe('Test Holiday');
    expect(h.state.pending).toBe(null);
  });

  it('reports Delete success after confirmation resolves, and keeps failed Delete visible', async () => {
    const h = harness();
    h.state.rows = [row(3)];
    const p = h.remove(3);
    expect(h.state.kind).toBe('info');
    h.removes[0].resolve();
    await p;
    expect(h.state.rows).toEqual([]);
    expect(h.state.kind).toBe('success');
    const retry = h.remove(3);
    h.removes[1].reject(new Error('Delete blocked'));
    await retry;
    expect(h.state.kind).toBe('error');
    expect(h.state.status).toContain('Delete blocked');
  });

  it('ignores a completed mutation from an obsolete database generation', async () => {
    const h = harness();
    const p = h.add();
    h.switchDatabase('DB-B');
    h.adds[0].resolve(row(3));
    await p;
    expect(h.state.rows).toEqual([]);
    expect(h.state.kind).toBe('info');
    assert.match(source, /holidayMutationVersionRef\.current \+= 1/);
  });

  it('keeps API contracts and disables conflicting UI actions during mutations', () => {
    assert.match(source, /api\.listMarketHolidays\(\)/);
    assert.match(source, /api\.addMarketHoliday\(newHolidayDate, newHolidayName\)/);
    assert.match(source, /api\.deleteMarketHoliday\(id\)/);
    assert.match(source, /disabled=\{holidaysLoading \|\| holidayMutationPending !== null\}/);
    assert.match(source, /disabled=\{!newHolidayDate \|\| !newHolidayName\.trim\(\) \|\| holidayMutationPending !== null\}/);
  });
});
