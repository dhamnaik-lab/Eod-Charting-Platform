import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionImportResolutionHint,
  CorporateActionImportRow,
  CorporateActionOfficialFetchResult,
  CorporateActionScanResultRow,
  DesktopApi,
} from '@/platform';
import { buildCorporateActionWorkflowModel } from '../corporateActionWorkflow';
import {
  buildCorporateActionNormalFetchInputs,
  classifyCorporateActionNormalRows,
  createInitialCorporateActionNormalWorkflowFacts,
  fetchCorporateActionNormalData,
  loadCorporateActionNormalData,
  reduceCorporateActionNormalWorkflowFacts,
} from '../workflow/corporateActionNormalWorkflowAdapter';

type NormalApi = Pick<
  DesktopApi,
  | 'fetchOfficialCorporateActions'
  | 'listCorporateActionImports'
  | 'listCorporateActionScanResults'
  | 'runCorporateActionScan'
  | 'listCorporateActionImportResolutionHints'
>;

function row(
  id: number,
  overrides: Partial<CorporateActionImportRow> = {},
): CorporateActionImportRow {
  return {
    id,
    exchange: 'NSE',
    source: 'NSE_OFFICIAL',
    sourceFile: null,
    symbol: `SYM${id}`,
    isin: null,
    bseScripCode: null,
    companyName: `Company ${id}`,
    purposeRaw: 'Dividend',
    exDate: '2026-09-01',
    recordDate: null,
    actionType: 'DIVIDEND',
    ratioNum: null,
    ratioDen: null,
    oldFaceValue: null,
    newFaceValue: null,
    cashAmount: 1,
    factor: 1,
    priceFactor: 1,
    parseStatus: 'PARSED',
    reviewStatus: 'PENDING',
    message: null,
    approvedCorporateActionId: null,
    importedAt: '2026-09-02T00:00:00Z',
    approvedAt: null,
    evidenceCount: 1,
    evidenceSources: ['NSE_OFFICIAL'],
    latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null,
    latestEvidenceNote: null,
    ...overrides,
  };
}

function scan(
  importRow: CorporateActionImportRow,
  scanStatus: string,
): CorporateActionScanResultRow {
  return {
    id: importRow.id,
    scanRunId: 1,
    corporateActionImportId: importRow.id,
    corporateActionId: null,
    symbol: importRow.symbol,
    exchange: importRow.exchange,
    scanStatus,
    prevTradeDate: '2026-08-31',
    exTradeDate: '2026-09-01',
    prevClose: 200,
    exOpen: 100,
    exClose: 100,
    expectedFactor: importRow.factor,
    actualOpenFactor: 2,
    actualCloseFactor: 2,
    confidence: scanStatus === 'MATCHED' ? 0.98 : 0.4,
    message: null,
    scannedAt: '2026-09-02T00:00:00Z',
  };
}

function fetchResult(exchange: string, rowsRead: number): CorporateActionOfficialFetchResult {
  return {
    exchange,
    source: `${exchange}_OFFICIAL`,
    fromDate: '2026-06-04',
    toDate: '2026-09-02',
    requestedDays: 91,
    cachedDays: 90,
    fetchedDays: 1,
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

function emptyScanResult() {
  return { scanRun: null, results: [] };
}

function apiBase(): NormalApi {
  return {
    fetchOfficialCorporateActions: vi.fn(async (input) => fetchResult(input.exchange, 0)),
    listCorporateActionImports: vi.fn(async () => []),
    listCorporateActionScanResults: vi.fn(async () => emptyScanResult()),
    runCorporateActionScan: vi.fn(async () => emptyScanResult()),
    listCorporateActionImportResolutionHints: vi.fn(async () => ({
      requested: 0,
      hints: [],
      message: '',
    })),
  };
}

describe('Corporate Action normal Fetch + Load adapter', () => {
  it('uses the deterministic routine 90-day IST catch-up for NSE and BSE without force refresh', () => {
    expect(buildCorporateActionNormalFetchInputs('2026-09-02')).toEqual([
      {
        exchange: 'NSE',
        fromDate: '2026-06-04',
        toDate: '2026-09-02',
        forceRefresh: false,
      },
      {
        exchange: 'BSE',
        fromDate: '2026-06-04',
        toDate: '2026-09-02',
        forceRefresh: false,
      },
    ]);
  });

  it('fetches NSE then BSE through the Task 5B boundary and reloads the same review queue', async () => {
    const calls: string[] = [];
    const finalRows = [row(1)];
    const api = apiBase();
    api.fetchOfficialCorporateActions = vi.fn(async (input) => {
      calls.push(`fetch:${input.exchange}`);
      return fetchResult(input.exchange, input.exchange === 'NSE' ? 5 : 7);
    });
    api.listCorporateActionImports = vi.fn(async (input) => {
      calls.push(`list:${input?.limit ?? 'none'}`);
      return finalRows;
    });

    const result = await fetchCorporateActionNormalData({ api, asOfDate: '2026-09-02' });

    expect(calls).toEqual(['fetch:NSE', 'list:1000', 'fetch:BSE', 'list:1000']);
    expect(api.listCorporateActionImports).toHaveBeenCalledWith({
      limit: 1000,
      actionTypes: ['SPLIT', 'BONUS', 'RIGHTS', 'DIVIDEND', 'DEMERGER'],
      searchQuery: null,
      reviewStatus: null,
      excludeApproved: true,
    });
    expect(result.counts.fetched).toBe(12);
    expect(result.rowsInserted).toBe(4);
    expect(result.rowsDuplicate).toBe(2);
    expect(result.rowsUnresolved).toBe(2);
    expect(result.rows).toBe(finalRows);
  });

  it('stops the routine Fetch immediately when an authoritative exchange fetch fails', async () => {
    const calls: string[] = [];
    const api = apiBase();
    api.fetchOfficialCorporateActions = vi.fn(async (input) => {
      calls.push(`fetch:${input.exchange}`);
      if (input.exchange === 'BSE') {
        throw new Error('BSE fetch failed');
      }
      return fetchResult(input.exchange, 1);
    });
    api.listCorporateActionImports = vi.fn(async () => {
      calls.push('list');
      return [];
    });

    await expect(fetchCorporateActionNormalData({ api, asOfDate: '2026-09-02' })).rejects.toThrow(
      'BSE fetch failed',
    );
    expect(calls).toEqual(['fetch:NSE', 'list', 'fetch:BSE']);
  });

  it('replaces Load More with automatic legacy-compatible increasing-limit loading', async () => {
    const firstPage = Array.from({ length: 1000 }, (_, index) => row(index + 1));
    const finalRows = Array.from({ length: 1200 }, (_, index) => row(index + 1));
    const api = apiBase();
    api.listCorporateActionImports = vi.fn(async (input) =>
      input?.limit === 1000 ? firstPage : finalRows,
    );

    const result = await loadCorporateActionNormalData({ api });

    expect(api.listCorporateActionImports).toHaveBeenCalledTimes(2);
    expect(api.listCorporateActionImports).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ limit: 1000, excludeApproved: true }),
    );
    expect(api.listCorporateActionImports).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ limit: 2000, excludeApproved: true }),
    );
    expect(result.rows).toBe(finalRows);
    expect(result.counts).toEqual({ loaded: 1200, ready: 1200, needsReview: 0, conflicts: 0 });
  });

  it('runs only eligible Split/Bonus price validation in the existing 500-id batches', async () => {
    const eligible = Array.from({ length: 502 }, (_, index) =>
      row(index + 1, {
        actionType: index % 2 === 0 ? 'SPLIT' : 'BONUS',
        purposeRaw: 'Split/Bonus',
        factor: 2,
      }),
    );
    const ineligible = row(503, {
      actionType: 'SPLIT',
      purposeRaw: 'Split',
      factor: null,
    });
    const api = apiBase();
    api.listCorporateActionImports = vi.fn(async () => [...eligible, ineligible]);
    api.runCorporateActionScan = vi.fn(async (input) => ({
      scanRun: null,
      results: (input?.importIds ?? []).map((id: number) => scan(eligible[id - 1]!, 'MATCHED')),
    }));

    const result = await loadCorporateActionNormalData({ api });

    expect(api.runCorporateActionScan).toHaveBeenCalledTimes(2);
    expect(api.runCorporateActionScan).toHaveBeenNthCalledWith(1, {
      scope: 'official_imports',
      importIds: Array.from({ length: 500 }, (_, index) => index + 1),
    });
    expect(api.runCorporateActionScan).toHaveBeenNthCalledWith(2, {
      scope: 'official_imports',
      importIds: [501, 502],
    });
    expect(result.validatedImportIds).toHaveLength(502);
    expect(result.scanRows).toHaveLength(502);
    expect(result.counts.ready).toBe(502);
    expect(result.counts.needsReview).toBe(1);
  });

  it('checks strict ISIN-review recommendations without approving or resolving them', async () => {
    const isinReview = row(1, { reviewStatus: 'PENDING_ISIN_MISMATCH' });
    const unresolved = row(2, { reviewStatus: 'UNRESOLVED' });
    const recommendation: CorporateActionImportResolutionHint = {
      importId: 1,
      status: 'ONE_ACTIVE',
      quickResolvable: false,
      activeSuggestionCount: 1,
      totalSuggestionCount: 1,
      topSuggestionSymbol: 'SYM1',
      topSuggestionExchange: 'NSE',
      recommendedIsinException: true,
      recommendationReason: 'Strict evidence match',
      message: 'Review recommendation',
    };
    const api = apiBase();
    api.listCorporateActionImports = vi.fn(async () => [isinReview, unresolved]);
    api.listCorporateActionImportResolutionHints = vi.fn(async (input) => ({
      requested: input.importIds.length,
      hints: [recommendation],
      message: 'Checked',
    }));

    const result = await loadCorporateActionNormalData({ api });

    expect(api.listCorporateActionImportResolutionHints).toHaveBeenCalledOnce();
    expect(api.listCorporateActionImportResolutionHints).toHaveBeenCalledWith({ importIds: [1] });
    expect(result.identityHints).toEqual([recommendation]);
    expect(result.identityReviewCount).toBe(1);
    expect(result.recommendedIdentityCount).toBe(1);
    expect(result.rows).toEqual([isinReview, unresolved]);
  });

  it('classifies existing approval and price-validation states without changing backend authority', () => {
    const dividendReady = row(1);
    const splitReady = row(2, { actionType: 'SPLIT', factor: 2 });
    const splitNoPrice = row(3, { actionType: 'SPLIT', factor: 2 });
    const splitConflict = row(4, { actionType: 'SPLIT', factor: 2 });
    const unresolved = row(5, { reviewStatus: 'UNRESOLVED' });
    const isinConflict = row(6, { reviewStatus: 'PENDING_ISIN_MISMATCH' });
    const unsupported = row(7, { actionType: 'DEMERGER' });

    expect(
      classifyCorporateActionNormalRows(
        [
          dividendReady,
          splitReady,
          splitNoPrice,
          splitConflict,
          unresolved,
          isinConflict,
          unsupported,
        ],
        [
          scan(splitReady, 'MATCHED'),
          scan(splitNoPrice, 'NO_PRICE_DATA'),
          scan(splitConflict, 'MISMATCH'),
        ],
      ),
    ).toEqual({ loaded: 7, ready: 2, needsReview: 3, conflicts: 2 });
  });

  it('uses the Task 2 workflow model for Fetch retry, Load resume, and Review handoff', () => {
    const initial = createInitialCorporateActionNormalWorkflowFacts();
    expect(buildCorporateActionWorkflowModel(initial).currentStage).toBe('fetch');

    const fetchFailed = reduceCorporateActionNormalWorkflowFacts(initial, { type: 'FETCH_FAILED' });
    expect(buildCorporateActionWorkflowModel(fetchFailed)).toMatchObject({
      currentStage: 'fetch',
      resumeReason: 'FETCH_RETRY_REQUIRED',
    });

    const fetched = reduceCorporateActionNormalWorkflowFacts(initial, { type: 'FETCH_SUCCEEDED' });
    expect(buildCorporateActionWorkflowModel(fetched)).toMatchObject({
      currentStage: 'load',
      resumeReason: 'LOAD_PENDING',
    });

    const loading = reduceCorporateActionNormalWorkflowFacts(fetched, { type: 'LOAD_STARTED' });
    expect(buildCorporateActionWorkflowModel(loading)).toMatchObject({
      currentStage: 'load',
      resumeReason: 'LOAD_RESUME_REQUIRED',
    });

    const loaded = reduceCorporateActionNormalWorkflowFacts(loading, {
      type: 'LOAD_SUCCEEDED',
      readyCount: 7,
    });
    expect(buildCorporateActionWorkflowModel(loaded)).toMatchObject({
      currentStage: 'review',
      resumeReason: 'REVIEW_REQUIRED',
    });
  });
});
