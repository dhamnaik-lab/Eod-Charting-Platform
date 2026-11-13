import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionOfficialFetchResult,
  DesktopApi,
} from '@/platform';
import { useWindowStore } from '@/store/windowStore';
import {
  buildCorporateActionNormalFetchInputs,
  createInitialCorporateActionNormalWorkflowFacts,
  fetchCorporateActionNormalData,
  reduceCorporateActionNormalWorkflowFacts,
} from '../workflow/corporateActionNormalWorkflowAdapter';
import { CORPORATE_ACTION_WINDOW_ID } from '../workspace/CorporateActionManagedWindow';

type NormalApi = Pick<
  DesktopApi,
  | 'fetchOfficialCorporateActions'
  | 'listCorporateActionImports'
  | 'listCorporateActionScanResults'
  | 'runCorporateActionScan'
  | 'listCorporateActionImportResolutionHints'
>;

function fetchResult(exchange: string, rowsRead: number): CorporateActionOfficialFetchResult {
  return {
    exchange,
    source: exchange + '_OFFICIAL',
    fromDate: '2026-08-01',
    toDate: '2026-09-03',
    requestedDays: 34,
    cachedDays: 30,
    fetchedDays: 4,
    fetchedRanges: 1,
    rowsRead,
    rowsInserted: 2,
    rowsDuplicate: 1,
    rowsError: 0,
    rowsUnresolved: 1,
    rowsParsed: Math.max(0, rowsRead - 1),
    rowsUnsupported: 0,
    imports: [],
    errors: [],
  };
}

function apiBase(): NormalApi {
  return {
    fetchOfficialCorporateActions: vi.fn(async (input) =>
      fetchResult(input.exchange, input.exchange === 'NSE' ? 5 : 7),
    ),
    listCorporateActionImports: vi.fn(async () => []),
    listCorporateActionScanResults: vi.fn(async () => ({ scanRun: null, results: [] })),
    runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [] })),
    listCorporateActionImportResolutionHints: vi.fn(async () => ({
      requested: 0,
      hints: [],
      message: '',
    })),
  };
}

describe('Corporate Actions window lifecycle and official fetch observability', () => {
  it('restores and focuses the same managed window when the user opens it again', () => {
    const id = CORPORATE_ACTION_WINDOW_ID;
    const store = useWindowStore.getState();
    store.registerWindow({
      id,
      title: 'Corporate Actions',
      bounds: { x: 10, y: 10, width: 700, height: 500 },
      minWidth: 320,
      minHeight: 240,
    });
    try {
      store.openWindow(id);
      store.minimizeWindow(id);
      expect(useWindowStore.getState().windows[id]?.isMinimized).toBe(true);
      store.openWindow(id);
      expect(useWindowStore.getState().windows[id]?.isMinimized).toBe(false);
      expect(useWindowStore.getState().activeWindowId).toBe(id);
      store.closeWindow(id);
      expect(useWindowStore.getState().windows[id]?.isOpen).toBe(false);
    } finally {
      store.unregisterWindow(id);
    }
  });

  it('forwards repeated open requests to the managed window from the single controller', () => {
    const dialogs = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
    const managed = readFileSync(
      resolve(process.cwd(), 'src/features/corporateActions/workspace/CorporateActionManagedWindow.tsx'),
      'utf8',
    );
    expect(dialogs).toContain('openRequestCount={corporateActionOpenRequestCount}');
    expect(dialogs).toContain('onClose={handleClose} openRequestCount={openRequestCount}');
    expect(managed).toContain('lastOpenRequestCountRef.current === openRequestCount');
    expect(managed).toContain('openWindow(id)');
  });

  it('scopes official fetch inputs to BOTH, NSE, or BSE without force refresh', () => {
    const range = { fromDate: '2026-08-01', toDate: '2026-09-03' };

    expect(buildCorporateActionNormalFetchInputs(range)).toHaveLength(2);
    expect(buildCorporateActionNormalFetchInputs(range, 'NSE')).toEqual([
      {
        exchange: 'NSE',
        fromDate: '2026-08-01',
        toDate: '2026-09-03',
        forceRefresh: false,
      },
    ]);
    expect(buildCorporateActionNormalFetchInputs(range, 'BSE')).toEqual([
      {
        exchange: 'BSE',
        fromDate: '2026-08-01',
        toDate: '2026-09-03',
        forceRefresh: false,
      },
    ]);
  });

  it('renders exchange selection, durable log, and last-success persistence after the full fetch await', () => {
    const workspace = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx',
      ),
      'utf8',
    );
    const fetchAwait = workspace.indexOf('const result = await fetchCorporateActionNormalData');
    const historyWrite = workspace.indexOf('writeCorporateActionNormalLastFetch(activeDatabasePath', fetchAwait);
    const fetchCatch = workspace.indexOf('} catch (fetchError)');

    expect(workspace).toContain('<option value="BOTH">NSE + BSE</option>');
    expect(workspace).toContain('<option value="NSE">NSE</option>');
    expect(workspace).toContain('<option value="BSE">BSE</option>');
    expect(workspace).toContain('Last successful fetch:');
    expect(workspace).toContain('corporate-action-workspace-fetch-log');
    expect(fetchAwait).toBeGreaterThanOrEqual(0);
    expect(historyWrite).toBeGreaterThan(fetchAwait);
    expect(fetchCatch).toBeGreaterThan(historyWrite);
  });

  it('emits ordered per-exchange lifecycle callbacks and keeps successful Fetch authoritative for Load', async () => {
    const events: string[] = [];
    const api = apiBase();

    const result = await fetchCorporateActionNormalData({
      api,
      fromDate: '2026-08-01',
      toDate: '2026-09-03',
      exchangeSelection: 'BOTH',
      onExchangeStarted: (exchange) => events.push('started:' + exchange),
      onExchangeCompleted: (exchange) => events.push('completed:' + exchange),
      onExchangeFailed: (exchange) => events.push('failed:' + exchange),
    });

    expect(events).toEqual([
      'started:NSE',
      'completed:NSE',
      'started:BSE',
      'completed:BSE',
    ]);
    expect(result.counts.fetched).toBe(12);

    const facts = reduceCorporateActionNormalWorkflowFacts(
      createInitialCorporateActionNormalWorkflowFacts(),
      { type: 'FETCH_SUCCEEDED' },
    );
    expect(facts.hasFetchedBatchPendingLoad).toBe(true);
  });

  it('reports a failing exchange lifecycle event and rethrows the authoritative failure', async () => {
    const events: string[] = [];
    const api = apiBase();
    api.fetchOfficialCorporateActions = vi.fn(async (input) => {
      if (input.exchange === 'BSE') {
        throw new Error('BSE authoritative failure');
      }
      return fetchResult(input.exchange, 5);
    });

    await expect(
      fetchCorporateActionNormalData({
        api,
        fromDate: '2026-08-01',
        toDate: '2026-09-03',
        exchangeSelection: 'BOTH',
        onExchangeStarted: (exchange) => events.push('started:' + exchange),
        onExchangeCompleted: (exchange) => events.push('completed:' + exchange),
        onExchangeFailed: (exchange) => events.push('failed:' + exchange),
      }),
    ).rejects.toThrow('BSE authoritative failure');

    expect(events).toEqual([
      'started:NSE',
      'completed:NSE',
      'started:BSE',
      'failed:BSE',
    ]);
  });
});