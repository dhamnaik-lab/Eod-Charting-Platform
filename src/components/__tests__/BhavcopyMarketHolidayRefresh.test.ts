import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it, expect } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/BhavcopyDownloadWindow.tsx'), 'utf8');
const ast = ts.createSourceFile('BhavcopyDownloadWindow.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

type Holiday = { id: number; date: string; name: string; source: string };
type Request = { resolve: (rows: Holiday[]) => void; reject: (error: Error) => void };

function componentVariable(name: string): ts.VariableDeclaration {
  const component = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'BhavcopyDownloadWindow');
  assert.ok(component, 'Missing BhavcopyDownloadWindow');
  let match: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (!match && ts.isVariableDeclaration(node) && node.name.getText(ast) === name) match = node;
    ts.forEachChild(node, visit);
  };
  visit(component);
  assert.ok(match?.initializer, `Missing ${name} initializer`);
  return match;
}

function loadHarness() {
  let databasePath: string | null = 'DB-A';
  const requestId = { current: 0 };
  const pending: Request[] = [];
  const state = { rows: [] as Holiday[], loadedDatabase: null as string | null, loading: false, error: null as string | null, status: '' };
  const context: Record<string, unknown> = {
    api: { listMarketHolidays: () => new Promise<Holiday[]>((resolve, reject) => pending.push({ resolve, reject })) },
    holidayRequestIdRef: requestId,
    useChartStore: { getState: () => ({ snapshot: { activeDatabasePath: databasePath } }) },
    setHolidays: (rows: Holiday[]) => { state.rows = rows; },
    setHolidayDatabasePath: (path: string | null) => { state.loadedDatabase = path; },
    setHolidaysLoading: (value: boolean) => { state.loading = value; },
    setHolidayError: (value: string | null) => { state.error = value; },
    reportHolidayStatus: (_kind: string, message: string) => { state.status = message; },
    getErrorMessage: (error: Error) => error.message,
  };
  const fn = componentVariable('loadHolidays').initializer!.getText(ast);
  const javascript = ts.transpileModule(`globalThis.loadHolidays = (${fn});`, {
    fileName: 'market-holiday-refresh.ts',
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  runInNewContext(javascript, context, { timeout: 1000 });
  const load = context.loadHolidays as () => Promise<void>;
  return { state, pending, requestId, load, switchDatabase: (path: string | null) => { databasePath = path; } };
}

const a = (id: number): Holiday => ({ id, date: `2026-10-${String(id).padStart(2, '0')}`, name: `Holiday ${id}`, source: 'USER' });

describe('HOL-01 Market Holiday tab refresh and database scope', () => {
  it('shows the selected year from the database on tab entry, with no network read', () => {
    // Opening the tab reads stored calendars once, through a single combined call.
    assert.match(source, /getHolidayCalendarView\(holidayYear\)/);
    assert.doesNotMatch(source, /setActiveTab\('marketHoliday'\);\s*void loadHolidays\(\)/);
    // The only network path is the explicit official sync, never a tab or year change.
    assert.doesNotMatch(source, /if \(holidayRefreshVersion === 0[^)]*\) return;/);
    // Refresh (and a year change) re-runs the read.
    assert.match(source, /setHolidayRefreshVersion\(\(version\) => version \+ 1\);\s*void loadHolidays\(\);/);
    assert.match(source, /setHolidayYear\(Number\(event\.target\.value\)\);\s*setHolidayRefreshVersion\(\(version\) => version \+ 1\);/);
  });

  it('applies a successful response and binds it to the requested database', async () => {
    const h = loadHarness();
    const p = h.load();
    expect(h.state.loading).toBe(true);
    expect(h.pending).toHaveLength(1);
    h.pending[0].resolve([a(1)]);
    await p;
    expect(h.state.rows.map((r) => r.id)).toEqual([1]);
    expect(h.state.loadedDatabase).toBe('DB-A');
    expect(h.state.loading).toBe(false);
    expect(h.state.status).toMatch(/Holiday list refreshed: 1 records/);
  });

  it('rejects late results from an earlier request in the same database', async () => {
    const h = loadHarness();
    const first = h.load();
    const second = h.load();
    h.pending[1].resolve([a(2)]);
    await second;
    h.pending[0].resolve([a(1)]);
    await first;
    expect(h.state.rows.map((r) => r.id)).toEqual([2]);
    expect(h.state.loadedDatabase).toBe('DB-A');
  });

  it('never adopts a response from a previously active database', async () => {
    const h = loadHarness();
    const p = h.load();
    h.switchDatabase('DB-B');
    h.pending[0].resolve([a(1)]);
    await p;
    expect(h.state.rows).toHaveLength(0);
    expect(h.state.loadedDatabase).toBe(null);
  });

  it('shows an error from a current request without publishing stale failed requests', async () => {
    const h = loadHarness();
    const p = h.load();
    h.pending[0].reject(new Error('Holiday list unavailable'));
    await p;
    expect(h.state.error).toBe('Holiday list unavailable');
    expect(h.state.status).toMatch(/Unable to refresh holidays/);
    expect(h.state.loading).toBe(false);
    const pendingOld = h.load();
    h.switchDatabase('DB-B');
    h.pending[1].reject(new Error('Old database failure'));
    await pendingOld;
    expect(h.state.error).toBe(null);
  });

  it('clears cached rows and pending requests when the active database changes without auto-loading', () => {
    const sourceIndex = source.indexOf('// Never retain rows or pending responses from a previously active database.');
    assert.ok(sourceIndex >= 0);
    const end = source.indexOf('}, [activeDatabasePath]);', sourceIndex);
    assert.ok(end > sourceIndex);
    const effect = source.slice(sourceIndex, end);
    assert.match(effect, /holidayRequestIdRef\.current \+= 1/);
    assert.match(effect, /setHolidays\(\[\]\)/);
    assert.match(effect, /setHolidayDatabasePath\(null\)/);
    assert.match(effect, /setDeleteConfirmId\(null\)/);
    // HOL-06: a database switch clears state but must not fetch on its own.
    assert.doesNotMatch(effect, /loadHolidays\(\)/);
    assert.match(effect, /press Refresh to load/);
    assert.match(source, /holidayDatabasePath === activeDatabasePath \? holidays : \[\]/);
    // HOL-06: rows render through the year-scoped list, and that list must derive
    // from the database-scoped `visibleHolidays` rather than a fresh fetch.
    assert.match(source, /manualHolidaysForYear\s*=\s*manualShowAllYears\s*\?\s*visibleHolidays/);
    assert.match(source, /manualHolidaysForYear\.(map|filter)\(/);
  });

  it('retains add/delete API commands and guards late mutation results after database switches', () => {
    const add = componentVariable('handleAddHoliday').initializer!.getText(ast);
    const remove = componentVariable('handleDeleteHoliday').initializer!.getText(ast);
    assert.match(add, /api\.addMarketHoliday\(newHolidayDate, newHolidayName\)/);
    assert.match(remove, /api\.deleteMarketHoliday\(id\)/);
    assert.match(add, /activeDatabasePath \?\? null\) === databasePath/);
    assert.match(remove, /activeDatabasePath \?\? null\) === databasePath/);
    assert.match(add, /mutationVersion === holidayMutationVersionRef\.current/);
    assert.match(remove, /mutationVersion === holidayMutationVersionRef\.current/);
    assert.match(add, /holidayRequestIdRef\.current \+= 1/);
    assert.match(remove, /holidayRequestIdRef\.current \+= 1/);
  });
});
