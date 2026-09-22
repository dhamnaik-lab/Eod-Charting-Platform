import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionImportRow,
  CorporateActionOfficialFetchResult,
  CorporateActionScanResultRow,
  DesktopApi,
} from '@/platform';
import {
  fetchOfficialCorporateActionsAndReload,
  loadCorporateActionImportRows,
} from '../legacy/corporateActionImportOperations';

type ImportOperationsApi = Pick<
  DesktopApi,
  'fetchOfficialCorporateActions' | 'listCorporateActionImports' | 'listCorporateActionScanResults'
>;

function importRow(id: number, actionType: CorporateActionImportRow['actionType']): CorporateActionImportRow {
  return { id, actionType } as CorporateActionImportRow;
}

function scanRow(importId: number): CorporateActionScanResultRow {
  return { id: importId, corporateActionImportId: importId } as CorporateActionScanResultRow;
}

function fetchResult(): CorporateActionOfficialFetchResult {
  return {
    exchange: 'NSE',
    source: 'NSE_OFFICIAL',
    fromDate: '2026-09-01',
    toDate: '2026-09-02',
    requestedDays: 2,
    cachedDays: 1,
    fetchedDays: 1,
    fetchedRanges: 1,
    rowsRead: 5,
    rowsInserted: 2,
    rowsDuplicate: 3,
    rowsError: 0,
    rowsUnresolved: 0,
    rowsParsed: 5,
    rowsUnsupported: 0,
    imports: [],
    errors: [],
  };
}

describe('Corporate Action shared import operations', () => {
  it('loads review rows without requesting approved validation evidence', async () => {
    const rows = [importRow(1, 'SPLIT'), importRow(2, 'DIVIDEND')];
    const listCorporateActionImports = vi.fn(async () => rows);
    const listCorporateActionScanResults = vi.fn(async () => ({ scanRun: null, results: [] }));
    const api = {
      listCorporateActionImports,
      listCorporateActionScanResults,
    } as unknown as ImportOperationsApi;
    const listInput = { limit: 1000, excludeApproved: true };

    const result = await loadCorporateActionImportRows({
      api,
      listInput,
      includeApprovedValidation: false,
    });

    expect(listCorporateActionImports).toHaveBeenCalledOnce();
    expect(listCorporateActionImports).toHaveBeenCalledWith(listInput);
    expect(listCorporateActionScanResults).not.toHaveBeenCalled();
    expect(result).toEqual({ rows, validationRows: [], validationImportIds: [] });
  });

  it('loads approved Split/Bonus validation evidence in the legacy 500-id batches', async () => {
    const rows = Array.from({ length: 502 }, (_, index) =>
      importRow(index + 1, index % 2 === 0 ? 'SPLIT' : 'BONUS'),
    );
    rows.push(importRow(503, 'DIVIDEND'));
    const listCorporateActionImports = vi.fn(async () => rows);
    const listCorporateActionScanResults = vi.fn(async ({ importIds }: { importIds?: number[] | null }) => ({
      scanRun: null,
      results: (importIds ?? []).map(scanRow),
    }));
    const api = {
      listCorporateActionImports,
      listCorporateActionScanResults,
    } as unknown as ImportOperationsApi;

    const result = await loadCorporateActionImportRows({
      api,
      listInput: { limit: 1000, reviewStatus: 'APPROVED' },
      includeApprovedValidation: true,
    });

    expect(listCorporateActionScanResults).toHaveBeenCalledTimes(2);
    expect(listCorporateActionScanResults.mock.calls[0]?.[0]).toEqual({
      importIds: Array.from({ length: 500 }, (_, index) => index + 1),
    });
    expect(listCorporateActionScanResults.mock.calls[1]?.[0]).toEqual({ importIds: [501, 502] });
    expect(result.validationImportIds).toHaveLength(502);
    expect(result.validationRows).toHaveLength(502);
    expect(result.rows).toBe(rows);
  });

  it('fetches first and reloads the review rows through the same authoritative API surface', async () => {
    const calls: string[] = [];
    const fetched = fetchResult();
    const rows = [importRow(10, 'SPLIT')];
    const fetchOfficialCorporateActions = vi.fn(async () => {
      calls.push('fetch');
      return fetched;
    });
    const listCorporateActionImports = vi.fn(async () => {
      calls.push('reload');
      return rows;
    });
    const api = {
      fetchOfficialCorporateActions,
      listCorporateActionImports,
      listCorporateActionScanResults: vi.fn(),
    } as unknown as ImportOperationsApi;
    const fetchInput = {
      exchange: 'NSE',
      fromDate: '2026-09-01',
      toDate: '2026-09-02',
      forceRefresh: false,
    };
    const listInput = { limit: 1000, excludeApproved: true };

    const result = await fetchOfficialCorporateActionsAndReload({ api, fetchInput, listInput });

    expect(calls).toEqual(['fetch', 'reload']);
    expect(fetchOfficialCorporateActions).toHaveBeenCalledWith(fetchInput);
    expect(listCorporateActionImports).toHaveBeenCalledWith(listInput);
    expect(result).toEqual({ fetchResult: fetched, rows });
  });

  it('propagates the authoritative fetch failure without attempting the review reload', async () => {
    const failure = new Error('official fetch failed');
    const fetchOfficialCorporateActions = vi.fn(async () => {
      throw failure;
    });
    const listCorporateActionImports = vi.fn();
    const api = {
      fetchOfficialCorporateActions,
      listCorporateActionImports,
      listCorporateActionScanResults: vi.fn(),
    } as unknown as ImportOperationsApi;

    await expect(
      fetchOfficialCorporateActionsAndReload({
        api,
        fetchInput: { exchange: 'NSE', fromDate: '2026-09-01', toDate: '2026-09-02', forceRefresh: false },
        listInput: { limit: 1000, excludeApproved: true },
      }),
    ).rejects.toBe(failure);
    expect(listCorporateActionImports).not.toHaveBeenCalled();
  });
});
