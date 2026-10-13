import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionImportResolutionHint,
  CorporateActionImportRow,
  CorporateActionScanResultRow,
  DesktopApi,
} from '@/platform';
import {
  CorporateActionPendingPreparationStaleError,
  loadAllPendingCorporateActionImports,
  prepareCorporateActionPendingImports,
} from '../legacy/corporateActionImportOperations';

type PendingPreparationApi = Pick<
  DesktopApi,
  | 'listCorporateActionImports'
  | 'listCorporateActionImportResolutionHints'
  | 'quickResolveCorporateActionImport'
  | 'runCorporateActionScan'
  | 'autoApproveCorporateActionImports'
  | 'getSetting'
>;

function importRow(id: number, overrides: Partial<CorporateActionImportRow> = {}): CorporateActionImportRow {
  return {
    id,
    exchange: 'NSE',
    source: 'OFFICIAL',
    sourceFile: null,
    symbol: `SYM${id}`,
    isin: null,
    bseScripCode: null,
    companyName: `Company ${id}`,
    purposeRaw: 'Purpose',
    exDate: '2026-09-01',
    recordDate: null,
    actionType: 'DIVIDEND',
    ratioNum: null,
    ratioDen: null,
    oldFaceValue: null,
    newFaceValue: null,
    cashAmount: 1,
    factor: null,
    priceFactor: null,
    parseStatus: 'PARSED',
    reviewStatus: 'PENDING',
    message: null,
    approvedCorporateActionId: null,
    importedAt: '2026-09-01T00:00:00Z',
    approvedAt: null,
    evidenceCount: 1,
    evidenceSources: ['OFFICIAL'],
    latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null,
    latestEvidenceNote: null,
    ...overrides,
  };
}

function hint(importId: number, overrides: Partial<CorporateActionImportResolutionHint> = {}): CorporateActionImportResolutionHint {
  return {
    importId,
    status: 'NONE_ACTIVE',
    quickResolvable: false,
    activeSuggestionCount: 0,
    totalSuggestionCount: 0,
    topSuggestionSymbol: null,
    topSuggestionExchange: null,
    recommendedIsinException: false,
    recommendationReason: null,
    message: '',
    ...overrides,
  };
}

function scanRow(importId: number): CorporateActionScanResultRow {
  return {
    id: 1000 + importId,
    scanRunId: 1,
    corporateActionImportId: importId,
    corporateActionId: null,
    symbol: `SYM${importId}`,
    exchange: 'NSE',
    scanStatus: 'MATCHED',
    prevTradeDate: '2026-08-31',
    exTradeDate: '2026-09-01',
    prevClose: 100,
    exOpen: 50,
    exClose: 51,
    expectedFactor: 2,
    actualOpenFactor: 2,
    actualCloseFactor: 1.96,
    confidence: 0.99,
    message: null,
    scannedAt: '2026-09-02T00:00:00Z',
  };
}

function skippedAutoApproval(importId: number) {
  return {
    requested: 1, eligible: 0, autoApproved: 0, linkedExisting: 0, alreadyApproved: 0, skipped: 1, failed: 0,
    dispositions: [{ importId, disposition: 'SKIPPED' as const, reason: 'manual review', importRecord: importRow(importId, { actionType: 'SPLIT', factor: 2 }), approvedRecord: null }],
    policyVersion: 'AUTO_APPROVAL_SAFE_V2', message: 'skipped',
  };
}

describe('Corporate Action pending preparation', () => {
  it('loads every pending page once, deduplicates IDs, strictly resolves eligible rows, and validates only Split/Bonus targets', async () => {
    const pages = [
      [importRow(1, { reviewStatus: 'UNRESOLVED' }), importRow(2, { actionType: 'SPLIT', factor: 2 }), importRow(3)],
      [importRow(3), importRow(4, { reviewStatus: 'PENDING_ISIN_MISMATCH' }), importRow(5)],
      [importRow(6)],
    ];
    const listCorporateActionImports = vi.fn(async () => pages.shift() ?? []);
    const listCorporateActionImportResolutionHints = vi.fn(async ({ importIds }: { importIds: number[] }) => ({
      requested: importIds.length,
      hints: importIds.map((id) =>
        id === 1
          ? hint(id, {
              status: 'ONE_ACTIVE',
              quickResolvable: true,
              activeSuggestionCount: 1,
              totalSuggestionCount: 1,
              topSuggestionSymbol: 'RES',
              topSuggestionExchange: 'NSE',
            })
          : id === 4
            ? hint(id, { status: 'ONE_ACTIVE', recommendedIsinException: true })
            : hint(id),
      ),
      message: '',
    }));
    const quickResolveCorporateActionImport = vi.fn(async ({ importId }: { importId: number }) => ({
      importRecord: importRow(importId, { symbol: 'RES', reviewStatus: 'PENDING' }),
      message: 'resolved',
    }));
    const runCorporateActionScan = vi.fn(async ({ importIds }: { importIds?: number[] | null }) => ({
      scanRun: null,
      results: (importIds ?? []).map(scanRow),
    }));
    const autoApproveCorporateActionImports = vi.fn(async ({ importIds }: { importIds: number[] }) => skippedAutoApproval(importIds[0]));
    const api = {
      listCorporateActionImports,
      listCorporateActionImportResolutionHints,
      quickResolveCorporateActionImport,
      runCorporateActionScan,
      autoApproveCorporateActionImports,
      getSetting: vi.fn(async () => 'true'),
    } as unknown as PendingPreparationApi;

    const result = await prepareCorporateActionPendingImports({ api, pageSize: 3, expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse' });

    expect(result.complete).toBe(true);
    expect(result.rows.map((row) => row.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.rows.find((row) => row.id === 1)?.reviewStatus).toBe('PENDING');
    expect(quickResolveCorporateActionImport).toHaveBeenCalledTimes(1);
    expect(quickResolveCorporateActionImport).toHaveBeenCalledWith({ importId: 1 });
    expect(runCorporateActionScan).toHaveBeenCalledTimes(1);
    expect(runCorporateActionScan).toHaveBeenCalledWith({ scope: 'official_imports', importIds: [2] });
    expect(result.validationImportIds).toEqual([2]);
    expect(autoApproveCorporateActionImports).toHaveBeenCalledWith({ importIds: [2], expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse' });
    expect(api.getSetting).toHaveBeenCalledWith('corporate_actions.auto_approval.split_bonus.enabled');
    expect(result.autoApproval?.skipped).toBe(1);
    expect(result.autoApproval?.dispositions.find((item) => item.importId === 2)?.disposition).toBe('SKIPPED');
    expect(result.autoApproval?.dispositions.find((item) => item.importId === 2)?.reason).toBe('manual review');
    expect(result.identityHints[4]?.recommendedIsinException).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('fails closed on a repeated full page instead of claiming the pending queue is complete', async () => {
    const repeatedPage = [importRow(10), importRow(11)];
    const api = {
      listCorporateActionImports: vi.fn(async () => repeatedPage),
      listCorporateActionImportResolutionHints: vi.fn(),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(),
      autoApproveCorporateActionImports: vi.fn(),
      getSetting: vi.fn(async () => 'false'),
    } as unknown as PendingPreparationApi;

    const result = await prepareCorporateActionPendingImports({ api, pageSize: 2, expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse' });

    expect(result.complete).toBe(false);
    expect(api.listCorporateActionImports).toHaveBeenCalledTimes(2);
    expect(result.errors.some((entry) => entry.importId == null && entry.stage === 'loading')).toBe(true);
    expect(api.listCorporateActionImportResolutionHints).not.toHaveBeenCalled();
    expect(api.quickResolveCorporateActionImport).not.toHaveBeenCalled();
    expect(api.runCorporateActionScan).not.toHaveBeenCalled();
  });

  it('blocks only the rows whose required validation batch fails', async () => {
    const api = {
      listCorporateActionImports: vi
        .fn()
        .mockResolvedValueOnce([importRow(20, { actionType: 'BONUS', factor: 2 }), importRow(21)])
        .mockResolvedValueOnce([]),
      listCorporateActionImportResolutionHints: vi.fn(async ({ importIds }: { importIds: number[] }) => ({
        requested: importIds.length,
        hints: [],
        message: '',
      })),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async () => {
        throw new Error('scan offline');
      }),
      autoApproveCorporateActionImports: vi.fn(),
      getSetting: vi.fn(async () => 'false'),
    } as unknown as PendingPreparationApi;

    const result = await prepareCorporateActionPendingImports({ api, pageSize: 2, expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse' });

    expect(result.complete).toBe(true);
    expect(result.errors.some((entry) => entry.importId === 20 && entry.stage === 'validating')).toBe(true);
    expect(result.errors.some((entry) => entry.importId === 21)).toBe(false);
  });

  it('stops before scheduling the next operation when the database/request context becomes stale', async () => {
    let current = true;
    const api = {
      listCorporateActionImports: vi.fn(async () => {
        current = false;
        return [importRow(30)];
      }),
      listCorporateActionImportResolutionHints: vi.fn(),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(),
      autoApproveCorporateActionImports: vi.fn(),
      getSetting: vi.fn(async () => 'false'),
    } as unknown as PendingPreparationApi;

    await expect(
      loadAllPendingCorporateActionImports({ api, shouldContinue: () => current, pageSize: 1000 }),
    ).rejects.toBeInstanceOf(CorporateActionPendingPreparationStaleError);

    expect(api.listCorporateActionImportResolutionHints).not.toHaveBeenCalled();
    expect(api.quickResolveCorporateActionImport).not.toHaveBeenCalled();
    expect(api.runCorporateActionScan).not.toHaveBeenCalled();
  });

  it.each([null, 'false', 'yes'])(
    'keeps validated Split/Bonus manual when the active Legacy family setting is %s',
    async (settingValue) => {
      const split = importRow(40, { actionType: 'SPLIT', factor: 2 });
      const autoApproveCorporateActionImports = vi.fn();
      const api = {
        listCorporateActionImports: vi.fn().mockResolvedValueOnce([split]).mockResolvedValueOnce([]),
        listCorporateActionImportResolutionHints: vi.fn(async ({ importIds }: { importIds: number[] }) => ({
          requested: importIds.length,
          hints: [],
          message: '',
        })),
        quickResolveCorporateActionImport: vi.fn(),
        runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [scanRow(40)] })),
        autoApproveCorporateActionImports,
        getSetting: vi.fn(async () => settingValue),
      } as unknown as PendingPreparationApi;

      const result = await prepareCorporateActionPendingImports({
        api,
        expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse',
      });

      expect(result.complete).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.autoApproval).toBeNull();
      expect(result.rows[0]?.reviewStatus).toBe('PENDING');
      expect(result.validationImportIds).toEqual([40]);
      expect(autoApproveCorporateActionImports).not.toHaveBeenCalled();
      expect(result.message).toContain('Split/Bonus Safe V2 automatic approval is OFF');
    },
  );

  it('fails closed on a setting read error without blocking existing manual Apply eligibility', async () => {
    const split = importRow(41, { actionType: 'BONUS', factor: 2 });
    const autoApproveCorporateActionImports = vi.fn();
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce([split]).mockResolvedValueOnce([]),
      listCorporateActionImportResolutionHints: vi.fn(async ({ importIds }: { importIds: number[] }) => ({
        requested: importIds.length,
        hints: [],
        message: '',
      })),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [scanRow(41)] })),
      autoApproveCorporateActionImports,
      getSetting: vi.fn(async () => {
        throw new Error('settings unavailable');
      }),
    } as unknown as PendingPreparationApi;

    const result = await prepareCorporateActionPendingImports({
      api,
      expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse',
    });

    expect(result.complete).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.autoApproval).toBeNull();
    expect(result.rows[0]?.reviewStatus).toBe('PENDING');
    expect(autoApproveCorporateActionImports).not.toHaveBeenCalled();
    expect(result.message).toContain('Split/Bonus Safe V2 automatic approval is OFF');
  });

  it('stops a stale Legacy preparation cycle after the setting read and before Safe V2 execution', async () => {
    const split = importRow(42, { actionType: 'SPLIT', factor: 2 });
    let current = true;
    const autoApproveCorporateActionImports = vi.fn();
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce([split]).mockResolvedValueOnce([]),
      listCorporateActionImportResolutionHints: vi.fn(async ({ importIds }: { importIds: number[] }) => ({
        requested: importIds.length,
        hints: [],
        message: '',
      })),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [scanRow(42)] })),
      autoApproveCorporateActionImports,
      getSetting: vi.fn(async () => {
        current = false;
        return 'true';
      }),
    } as unknown as PendingPreparationApi;

    await expect(
      prepareCorporateActionPendingImports({
        api,
        shouldContinue: () => current,
        expectedDatabasePath: 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse',
      }),
    ).rejects.toBeInstanceOf(CorporateActionPendingPreparationStaleError);

    expect(autoApproveCorporateActionImports).not.toHaveBeenCalled();
  });

});
