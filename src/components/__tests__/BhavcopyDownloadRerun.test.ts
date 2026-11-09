import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPartialCoverageResult, isSkippedResult, useBhavcopyStore } from '@/store/bhavcopyStore';
import type { DownloadResult, DesktopApi } from '@/platform';
import { beginDownloadRun, finishDownloadRun } from '@/features/bhavcopy/downloadRunState';

vi.mock('@/platform', () => ({ getDesktopApi: () => null }));

const source = readFileSync(resolve(process.cwd(), 'src/components/BhavcopyDownloadWindow.tsx'), 'utf8');
const ast = ts.createSourceFile('BhavcopyDownloadWindow.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function downloadHandler(results: DownloadResult[], stops: Array<string | null>) {
  const component = ast.statements.find((node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'BhavcopyDownloadWindow');
  assert.ok(component);
  let handler: ts.VariableDeclaration | undefined;
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'handleDownload') handler = node;
    ts.forEachChild(node, visit);
  };
  visit(component);
  assert.ok(handler?.initializer);
  const runTrackedBhavcopyBatch: DesktopApi['runTrackedBhavcopyBatch'] = async (_config, runId, onStarted) => {
    expect(useBhavcopyStore.getState().activeBatch).toEqual({ runId, phase: 'starting' });
    onStarted();
    expect(useBhavcopyStore.getState().activeBatch).toEqual({ runId, phase: 'running' });
    for (const result of results.filter((entry) => entry.tradeDate.endsWith(' archive'))) {
      useBhavcopyStore.getState().reportDownloadResult(result);
    }
    return { results, cancelled: false };
  };
  const chart = {
    downloadProgress: beginDownloadRun(),
    setDownloadProgress(progress: ReturnType<typeof finishDownloadRun>) {
      chart.downloadProgress = progress;
      if (!progress.running) stops.push(progress.error ?? null);
    },
  };
  const context: Record<string, unknown> = {
    useBhavcopyStore,
    // Keep a stale snapshot in the harness so a handler that consults it
    // instead of the current store would lose results on a rerun.
    reportedDownloadResults: useBhavcopyStore.getState().reportedDownloadResults,
    reportDownloadResult: useBhavcopyStore.getState().reportDownloadResult,
    api: { runTrackedBhavcopyBatch, cancelBhavcopyBatch: async () => 'noMatchingRun' },
    config: { mode: 'range', exchanges: { nseIndex: true }, startDate: '2011-01-03', endDate: '2011-01-07', workers: 2 },
    crypto: globalThis.crypto,
    useChartStore: { getState: () => chart },
    useUiStore: { getState: () => ({ bhavcopyWindowOpen: true }) },
    useWindowStore: { getState: () => ({ windows: { bhavcopy: { isOpen: true } } }) },
    BHAVCOPY_WINDOW_ID: 'bhavcopy',
    beginDownloadRun,
    finishDownloadRun,
    addLog: useBhavcopyStore.getState().addLog,
    formatExchangeLabel: () => 'NSE Indices',
    getDownloadModeLabel: () => 'Date Range',
    getDownloadModeHint: () => '',
    getErrorMessage: String,
    isSkippedResult,
    isPartialCoverageResult,
  };
  const javascript = ts.transpileModule(`globalThis.download = (${handler.initializer.getText(ast)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  runInNewContext(javascript, context, { timeout: 1000 });
  const download = context.download as () => Promise<void>;
  return async () => {
    await download();
    expect(useBhavcopyStore.getState().activeBatch).toBeNull();
  };
}

describe('Bhavcopy command results on repeated downloads', () => {
  beforeEach(() => {
    useBhavcopyStore.setState(useBhavcopyStore.getInitialState());
  });

  it('logs the returned failure on every run while deduplicating runtime events', async () => {
    const results: DownloadResult[] = [
      { exchange: 'NSE_INDEX', tradeDate: '2011-01-03 archive', success: true, rowsInserted: 0, message: 'Archive unavailable' },
      { exchange: 'NSE_INDEX', tradeDate: '2011-01-03..2011-01-07 NIFTY500', success: false, rowsInserted: 0, message: 'Historical source failure: Unknown index alias: S&P CNX 500' },
    ];
    const stops: Array<string | null> = [];
    await downloadHandler(results, stops)();
    await downloadHandler(results, stops)();
    const state = useBhavcopyStore.getState();
    expect(state.logs.filter((log) => log.level === 'error' && log.message.includes('S&P CNX 500'))).toHaveLength(1);
    expect(state.logs.filter((log) => log.message.includes('Archive unavailable'))).toHaveLength(1);
    expect(state.runSummary).toMatchObject({ completedCount: 2, failedCount: 1, skippedCount: 1 });
    expect(stops).toEqual(['1 download jobs failed.', '1 download jobs failed.']);
  });

  it('reports repeated successful API outcomes instead of losing them after clearing logs', async () => {
    const results: DownloadResult[] = [{ exchange: 'NSE_INDEX', tradeDate: '2011-01-03..2011-01-07 NIFTY500', success: true, rowsInserted: 0, message: 'Historical subset: acquired 5, held 0, missing/unsupported 0' }];
    const stops: Array<string | null> = [];
    await downloadHandler(results, stops)();
    await downloadHandler(results, stops)();
    expect(useBhavcopyStore.getState().logs.some((log) => log.message.includes('acquired 5'))).toBe(true);
    expect(useBhavcopyStore.getState().runSummary).toMatchObject({ successCount: 1, failedCount: 0, completedCount: 1 });
    expect(stops).toEqual([null, null]);
  });

  it('reports incomplete historical coverage without stopping the run with an error', async () => {
    const results: DownloadResult[] = [{ exchange: 'NSE_INDEX', tradeDate: '2010-01-01..2010-12-31 NIFTYIT', success: false, rowsInserted: 0, message: 'Historical subset: acquired 251, held 0, missing/unsupported 10' }];
    const stops: Array<string | null> = [];
    await downloadHandler(results, stops)();
    const { logs, runSummary } = useBhavcopyStore.getState();
    expect(logs.some((log) => log.level === 'warning' && log.message.includes('acquired 251'))).toBe(true);
    expect(runSummary).toMatchObject({ partialCount: 1, failedCount: 0, completedCount: 1 });
    expect(stops).toEqual([null]);
  });
  it('finishes an NSE security subset without calling its imported rows a failed download', async () => {
    const results: DownloadResult[] = [{ exchange: 'NSE', tradeDate: '2014-11-20', success: false,
      rowsInserted: 1530, message: 'Security subset: Imported 1530 records; blocked 2 rows' }];
    const stops: Array<string | null> = [];
    await downloadHandler(results, stops)();
    const { logs, runSummary } = useBhavcopyStore.getState();
    expect(logs.some((log) => log.level === 'incomplete' && log.message.includes('1530'))).toBe(true);
    expect(runSummary).toMatchObject({ partialCount: 1, failedCount: 0, totalRowsInserted: 1530 });
    expect(stops).toEqual([null]);
  });

});
