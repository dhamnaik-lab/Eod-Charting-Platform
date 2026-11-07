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
  recheckReviewedCorporateActionImports,
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
  it('ca phase3 closes informational notices before loading the pending queue, without approving', async () => {
    const order: string[] = [];
    const api = {
      syncCorporateActionInformationalClosures: vi.fn(async () => {
        order.push('close');
        return { closed: 3, reopened: 1, totalClosed: 15 };
      }),
      listCorporateActionImports: vi.fn(async () => { order.push('list'); return []; }),
      listCorporateActionImportResolutionHints: vi.fn(), quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [] })), autoApproveCorporateActionImports: vi.fn(), getSetting: vi.fn(),
    };
    const result = await prepareCorporateActionPendingImports({ api, expectedDatabasePath: 'E:/TEST-ONLY', explicitApprovalOnly: true });
    expect(api.syncCorporateActionInformationalClosures).toHaveBeenCalledExactlyOnceWith({ expectedDatabasePath: 'E:/TEST-ONLY' });
    expect(order[0]).toBe('close');
    expect(result.complete).toBe(true);
    expect(result.message).toContain('Informational notices closed: 15 (3 new, 1 reopened).');
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
    api.syncCorporateActionInformationalClosures.mockClear();
    await prepareCorporateActionPendingImports({ api, expectedDatabasePath: 'E:/TEST-ONLY' });
    expect(api.syncCorporateActionInformationalClosures).not.toHaveBeenCalled();
  });
  it('refreshes legacy classifications in the reviewed database before matching, without approving', async () => {
    const legacy = importRow(91,{actionType:'OTHER',reviewStatus:'UNSUPPORTED',purposeRaw:'Agm/Div-Rs.2/- Per Share',cashAmount:null});
    const refreshed = importRow(91,{purposeRaw:legacy.purposeRaw,cashAmount:2});
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce([legacy]).mockResolvedValueOnce([]),
      refreshCorporateActionImportClassifications: vi.fn(async () => [refreshed]),
      listCorporateActionImportResolutionHints: vi.fn(), quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [] })), autoApproveCorporateActionImports: vi.fn(),getSetting:vi.fn(),
    };
    const result = await prepareCorporateActionPendingImports({api,expectedDatabasePath:'E:/TEST-ONLY',explicitApprovalOnly:true});
    expect(api.refreshCorporateActionImportClassifications).toHaveBeenCalledWith({importIds:[91],expectedDatabasePath:'E:/TEST-ONLY'});
    expect(result.rows).toEqual([refreshed]);
    expect(result.complete).toBe(true);
    expect(api.runCorporateActionScan).toHaveBeenCalledExactlyOnceWith({ scope: 'official_imports', importIds: [91] });
    expect(result.validationImportIds).toEqual([91]);
    expect(result.validationRows).toEqual([]);
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
    api.listCorporateActionImports.mockReset().mockResolvedValueOnce([legacy]);
    api.refreshCorporateActionImportClassifications.mockResolvedValueOnce([]);
    const incomplete = await prepareCorporateActionPendingImports({api,expectedDatabasePath:'E:/TEST-ONLY',explicitApprovalOnly:true});
    expect(incomplete.complete).toBe(false);
    expect(incomplete.errors[0]?.message).toContain('incomplete scope');
    expect(api.runCorporateActionScan).toHaveBeenCalledTimes(1);
    expect(api.quickResolveCorporateActionImport).not.toHaveBeenCalled();
  });
  it('rechecks dividend EOD scan identity and readiness before explicit operator approval', async () => {
    const dividend = importRow(55);
    const scan = scanRow(55);
    const fingerprint = (row: CorporateActionImportRow, latest?: CorporateActionScanResultRow) =>
      JSON.stringify([row.id, row.exDate, latest?.scanStatus ?? null, latest?.scannedAt ?? null]);
    const api = {
      getCorporateActionImportsByIds: vi.fn(async () => [dividend]),
      listCorporateActionScanResults: vi.fn(async () => ({scanRun: null, results: [scan]})),
    } as unknown as Pick<DesktopApi, 'getCorporateActionImportsByIds' | 'listCorporateActionScanResults'>;
    const request = {
      api, importIds: [55], expectedDatabasePath: 'E:/TEST-ONLY',
      fingerprints: {55: fingerprint(dividend, scan)}, fingerprint,
      preparationErrors: {}, explicitApprovalOnly: true,
    };
    const checked = await recheckReviewedCorporateActionImports(request);
    expect(checked.validationImportIds).toEqual([55]);
    expect(checked.validationRows).toEqual([scan]);
    expect(api.listCorporateActionScanResults).toHaveBeenCalledWith({importIds: [55], limit: 10000});
    api.listCorporateActionScanResults = vi.fn(async () => ({scanRun: null, results: []}));
    await expect(recheckReviewedCorporateActionImports(request)).rejects.toThrow('changed after review');
  });

  it('never reads the legacy auto-approval setting or approves during explicit-only Load', async () => {
    const api = {
      listCorporateActionImports: vi.fn()
        .mockResolvedValueOnce([importRow(1, { actionType: 'SPLIT', factor: 2 }),
          importRow(2, { actionType: 'DIVIDEND', factor: 1.01 })])
        .mockResolvedValueOnce([]),
      refreshCorporateActionImportClassifications: vi.fn(async () => [importRow(1, { actionType: 'SPLIT', factor: 2 })]),
      listCorporateActionImportResolutionHints: vi.fn(),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async ({ importIds }: { importIds?: number[] | null }) => ({
        scanRun: null, results: (importIds ?? []).map((id) =>
          id === 2 ? {
            ...scanRow(id), scanStatus: 'REVIEW', expectedFactor: null,
            actualOpenFactor: null, actualCloseFactor: null, confidence: null,
            message: 'Local EOD availability evidence only',
          } : scanRow(id)),
      })),
      autoApproveCorporateActionImports: vi.fn(),
      getSetting: vi.fn(async () => 'true'),
    } as unknown as PendingPreparationApi;
    const result = await prepareCorporateActionPendingImports({
      api, expectedDatabasePath: 'E:/TEST-ONLY', explicitApprovalOnly: true,
    });
    expect(result.complete).toBe(true);
    expect(result.validationImportIds).toEqual([1, 2]);
    expect(api.runCorporateActionScan).toHaveBeenCalledExactlyOnceWith({
      scope: 'official_imports', importIds: [1, 2],
    });
    expect(result.validationRows.map((row) => row.corporateActionImportId).sort()).toEqual([1, 2]);
    expect(result.validationRows.find((row) => row.corporateActionImportId === 2)?.scanStatus).toBe('REVIEW');
    expect(result.autoApproval).toBeNull();
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
    expect(api.getSetting).not.toHaveBeenCalled();
  });

  it('checks 1001 Dividend/Rights EOD windows in bounded batches without auto-approval', async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => importRow(index + 1, {
      actionType: index % 2 === 0 ? 'DIVIDEND' : 'RIGHTS',
    }));
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce(rows).mockResolvedValueOnce([]),
      listCorporateActionImportResolutionHints: vi.fn(),
      quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async ({ importIds }: { importIds?: number[] | null }) => ({
        scanRun: null,
        results: (importIds ?? []).map((id) => ({
          ...scanRow(id), scanStatus: 'REVIEW', expectedFactor: null,
          actualOpenFactor: null, actualCloseFactor: null, confidence: null,
          message: 'Local EOD availability evidence only',
        })),
      })),
      autoApproveCorporateActionImports: vi.fn(),
      getSetting: vi.fn(),
    } as unknown as PendingPreparationApi;
    const result = await prepareCorporateActionPendingImports({
      api, pageSize: 1001, expectedDatabasePath: 'E:/TEST-ONLY', explicitApprovalOnly: true,
    });
    expect(result.complete).toBe(true);
    expect(result.rows).toEqual(rows);
    expect(result.validationImportIds).toEqual(rows.map((row) => row.id));
    expect(result.validationRows).toHaveLength(1001);
    expect(result.validationRows.every((entry) => entry.scanStatus === 'REVIEW')).toBe(true);
    expect(result.errors).toEqual([]);
    expect(api.runCorporateActionScan).toHaveBeenCalledTimes(3);
    expect(api.runCorporateActionScan).toHaveBeenNthCalledWith(1, {
      scope: 'official_imports', importIds: rows.slice(0, 500).map((row) => row.id),
    });
    expect(api.runCorporateActionScan).toHaveBeenNthCalledWith(2, {
      scope: 'official_imports', importIds: rows.slice(500, 1000).map((row) => row.id),
    });
    expect(api.runCorporateActionScan).toHaveBeenNthCalledWith(3, {
      scope: 'official_imports', importIds: [1001],
    });
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
    expect(api.getSetting).not.toHaveBeenCalled();
  });

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

  it('resolves only backend-proof-backed historical ISIN mismatches during explicit-only Load', async () => {
    const proven = importRow(40, {
      symbol: '20MICRONS', isin: 'INE144J01019', actionType: 'DIVIDEND',
      reviewStatus: 'PENDING_ISIN_MISMATCH',
    });
    const unproven = importRow(41, {
      symbol: 'TRENT', isin: 'INEHIST00002', actionType: 'BONUS', factor: 2,
      reviewStatus: 'PENDING_ISIN_MISMATCH',
    });
    const listCorporateActionImportResolutionHints = vi.fn(async ({ importIds }: { importIds: number[] }) => ({
      requested: importIds.length,
      hints: importIds.map((id) => id === 40
        ? hint(id, {
            status: 'ONE_ACTIVE', quickResolvable: true,
            recommendedIsinException: true, activeSuggestionCount: 1,
            topSuggestionExchange: 'NSE', topSuggestionSymbol: '20MICRONS',
          })
        : hint(id, {
            status: 'RECOMMENDED_ISIN_EXCEPTION', quickResolvable: false,
            recommendedIsinException: true, activeSuggestionCount: 1,
            topSuggestionExchange: 'NSE', topSuggestionSymbol: 'TRENT',
          })),
      message: '',
    }));
    const quickResolveCorporateActionImport = vi.fn(async () => ({
      importRecord: importRow(40, { ...proven, reviewStatus: 'PENDING', approvedCorporateActionId: null }),
      message: 'Verified pre-transition identity',
    }));
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce([proven, unproven]).mockResolvedValueOnce([]),
      refreshCorporateActionImportClassifications: vi.fn(async () => [unproven]),
      listCorporateActionImportResolutionHints,
      quickResolveCorporateActionImport,
      runCorporateActionScan: vi.fn(async () => ({ scanRun: null, results: [] })),
      autoApproveCorporateActionImports: vi.fn(),
      getSetting: vi.fn(),
    } as unknown as PendingPreparationApi;
    const result = await prepareCorporateActionPendingImports({
      api, pageSize: 100, expectedDatabasePath: 'E:/TEST-ONLY', explicitApprovalOnly: true,
    });
    expect(result.complete).toBe(true);
    expect(quickResolveCorporateActionImport).toHaveBeenCalledTimes(1);
    expect(quickResolveCorporateActionImport).toHaveBeenCalledWith({ importId: 40 });
    expect(result.rows.find((row) => row.id === 40)?.reviewStatus).toBe('PENDING');
    expect(result.rows.find((row) => row.id === 41)?.reviewStatus).toBe('PENDING_ISIN_MISMATCH');
    expect(result.rows.find((row) => row.id === 40)?.approvedCorporateActionId).toBeNull();
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
    expect(api.getSetting).not.toHaveBeenCalled();
    expect(result.identityHints[41]?.recommendedIsinException).toBe(true);
  });

  it('loads new pending Split/Bonus components and accepts a proven inactive historical hint without approving', async () => {
    const purposeRaw = 'Bonus 1:1/Face Value Split From Rs 10 To Rs 2';
    const bonus = importRow(71,{actionType:'BONUS',purposeRaw,factor:2});
    const split = importRow(72,{actionType:'SPLIT',purposeRaw,factor:5,reviewStatus:'UNRESOLVED'});
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce([bonus]).mockResolvedValueOnce([bonus,split]),
      refreshCorporateActionImportClassifications: vi.fn(async () => [bonus]),
      listCorporateActionImportResolutionHints: vi.fn(async () => ({requested:1,hints:[hint(72,{
        status:'ONE_HISTORICAL',quickResolvable:true,activeSuggestionCount:0,
        topSuggestionSymbol:split.symbol,topSuggestionExchange:'NSE',
      })],message:''})),
      quickResolveCorporateActionImport: vi.fn(async () => ({importRecord:{...split,reviewStatus:'PENDING'},message:'Verified history'})),
      runCorporateActionScan: vi.fn(async (_input: unknown) => ({scanRun:null,results:[]})),
      autoApproveCorporateActionImports: vi.fn(),getSetting:vi.fn(),
    };
    const result = await prepareCorporateActionPendingImports({api,expectedDatabasePath:'E:/TEST-ONLY',explicitApprovalOnly:true});
    expect(result.complete).toBe(true);
    expect(result.rows.map(r=>r.id)).toEqual([71,72]);
    expect(api.quickResolveCorporateActionImport).toHaveBeenCalledWith({importId:72});
    expect(api.runCorporateActionScan.mock.calls[0]?.[0]).toMatchObject({importIds:[71,72]});
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
    expect(result.rows.every(r=>r.approvedCorporateActionId==null)).toBe(true);
  });

  it('pr25 reloads the queue when an OTHER row is reclassified into an abbreviated Split + Bonus', async () => {
    const purposeRaw = 'Fv Spl-Rs10tors2/Bon-1:2';
    const other = importRow(81,{actionType:'OTHER',reviewStatus:'UNSUPPORTED',purposeRaw,factor:null});
    const split = importRow(81,{actionType:'SPLIT',purposeRaw,factor:5});
    const bonus = importRow(82,{actionType:'BONUS',purposeRaw,factor:1.5});
    const api = {
      listCorporateActionImports: vi.fn().mockResolvedValueOnce([other]).mockResolvedValueOnce([split,bonus]),
      refreshCorporateActionImportClassifications: vi.fn(async () => [split]),
      listCorporateActionImportResolutionHints: vi.fn(), quickResolveCorporateActionImport: vi.fn(),
      runCorporateActionScan: vi.fn(async (_input: unknown) => ({scanRun:null,results:[]})),
      autoApproveCorporateActionImports: vi.fn(),getSetting:vi.fn(),
    };
    const result = await prepareCorporateActionPendingImports({api,expectedDatabasePath:'E:/TEST-ONLY',explicitApprovalOnly:true});
    expect(result.complete).toBe(true);
    expect(result.rows.map(r=>r.id)).toEqual([81,82]);
    expect(api.runCorporateActionScan.mock.calls[0]?.[0]).toMatchObject({importIds:[81,82]});
    expect(api.autoApproveCorporateActionImports).not.toHaveBeenCalled();
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
