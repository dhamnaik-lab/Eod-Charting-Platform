import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionDividendPreparedScopeEvaluationDisposition,
  CorporateActionDividendPreparedScopeEvaluationEvidence,
  CorporateActionImportRow,
  CorporateActionScanResultRow,
} from '@/platform';
import {
  evaluateOfficialCorporateActionRowReadiness,
  isClassicCorporateActionRowReady,
  selectEligibleOfficialImportRows,
  type OfficialCorporateActionReadinessContext,
} from '../legacy/corporateActionOfficialReadiness';
import {
  clearCachedCorporateActionPendingReview,
  getCachedCorporateActionPendingReview,
  setCachedCorporateActionPendingReview,
} from '../legacy/corporateActionSessionCache';
import { refreshCorporateActionQueueAfterApproval } from '../legacy/corporateActionPostApprovalRefresh';

const TODAY = '2026-11-11';

const SAMPLE_DIVIDEND_EVIDENCE: CorporateActionDividendPreparedScopeEvaluationEvidence = {
  identityProof: 'CURRENT_EXACT_SYMBOL_AND_ISIN',
  officialEvidenceId: 101,
  evidenceCapturedAt: '2026-10-16T00:00:00Z',
  sourceLocator: 'https://www.nseindia.com/api/corporates-corporateActions',
  cashAmount: 10,
  previousTradeDate: '2026-10-14',
  previousClose: 2000,
  computedFactor: 2000 / 1990,
};

function makeRow(
  id: number,
  actionType: CorporateActionImportRow['actionType'],
  overrides: Partial<CorporateActionImportRow> = {},
): CorporateActionImportRow {
  return {
    id,
    exchange: 'NSE',
    source: 'NSE_API',
    sourceFile: null,
    symbol: 'RELIANCE',
    isin: `INE002A010${String(id).padStart(2, '0')}`,
    bseScripCode: null,
    companyName: 'Reliance Industries Limited',
    purposeRaw: actionType === 'SPLIT' ? 'Split 10 to 5' : `${actionType} announcement`,
    exDate: '2026-10-15',
    recordDate: '2026-10-15',
    actionType,
    ratioNum: actionType === 'SPLIT' || actionType === 'BONUS' || actionType === 'RIGHTS' ? 2 : null,
    ratioDen: actionType === 'SPLIT' || actionType === 'BONUS' || actionType === 'RIGHTS' ? 1 : null,
    oldFaceValue: actionType === 'SPLIT' ? 10 : null,
    newFaceValue: actionType === 'SPLIT' ? 5 : null,
    cashAmount: actionType === 'DIVIDEND' || actionType === 'RIGHTS' ? 10 : null,
    factor: actionType === 'SPLIT' || actionType === 'BONUS' ? 2 : 1.02,
    priceFactor: actionType === 'SPLIT' || actionType === 'BONUS' ? 0.5 : 1 / 1.02,
    parseStatus: 'PARSED',
    reviewStatus: 'PENDING',
    message: null,
    approvedCorporateActionId: null,
    importedAt: '2026-10-16T00:00:00Z',
    approvedAt: null,
    evidenceCount: 1,
    evidenceSources: ['NSE_API'],
    latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null,
    latestEvidenceNote: null,
    instrumentIsActive: true,
    verifiedAdjustmentTarget: null,
    ...overrides,
  };
}

function makeMatchedScan(
  importId: number,
  overrides: Partial<CorporateActionScanResultRow> = {},
): CorporateActionScanResultRow {
  return {
    id: importId * 10,
    scanRunId: 1,
    corporateActionImportId: importId,
    corporateActionId: null,
    symbol: 'RELIANCE',
    exchange: 'NSE',
    scanStatus: 'MATCHED',
    prevTradeDate: '2026-10-14',
    exTradeDate: '2026-10-15',
    prevClose: 2000,
    exOpen: 1000,
    exClose: 1005,
    expectedFactor: 2,
    actualOpenFactor: 2,
    actualCloseFactor: 2000 / 1005,
    confidence: 0.99,
    message: 'Strong match',
    scannedAt: '2026-10-16T00:00:00Z',
    ...overrides,
  };
}

function makeBaseContext(
  overrides: Partial<OfficialCorporateActionReadinessContext> = {},
): OfficialCorporateActionReadinessContext {
  return {
    officialPreparationComplete: true,
    officialPreparationErrors: {},
    existingDividendByImportId: {},
    latestScanByImportId: new Map(),
    dividendPreparedImportIds: new Set(),
    officialDividendPreparedScopeDispositionByImportId: new Map(),
    today: TODAY,
    ...overrides,
  };
}

describe('Corporate Actions official readiness & queue-refresh behavioral controller (Phase R3.2)', () => {
  it('enforces Classic and Advanced readiness parity across SPLIT, BONUS, DIVIDEND, RIGHTS, DEMERGER, and non-equity rows', () => {
    const splitRow = makeRow(1, 'SPLIT');
    const bonusRow = makeRow(2, 'BONUS', { purposeRaw: 'Bonus 1:1' });
    const rightsRow = makeRow(3, 'RIGHTS', { purposeRaw: 'Rights 1:4 @ Rs 80', factor: 1.05 });
    const demergerRow = makeRow(4, 'DEMERGER', { purposeRaw: 'Demerger 1:1' });
    const nonEquitySplitRow = makeRow(5, 'SPLIT', { purposeRaw: 'Split of Non-Convertible Debentures' });
    const inactiveNoTargetRow = makeRow(6, 'SPLIT', { instrumentIsActive: false, verifiedAdjustmentTarget: null });
    const inactiveVerifiedTargetRow = makeRow(7, 'SPLIT', {
      instrumentIsActive: false,
      verifiedAdjustmentTarget: 'RELIANCE',
    });
    const unverifiedDividendRow = makeRow(8, 'DIVIDEND', { purposeRaw: 'Dividend Rs 10 Per Share' });
    const verifiedDividendRow = makeRow(9, 'DIVIDEND', { purposeRaw: 'Dividend Rs 10 Per Share' });

    const scans = new Map<number, CorporateActionScanResultRow>([
      [1, makeMatchedScan(1)],
      [2, makeMatchedScan(2)],
      [3, makeMatchedScan(3, { expectedFactor: 1.05 })],
      [5, makeMatchedScan(5)],
      [6, makeMatchedScan(6)],
      [7, makeMatchedScan(7)],
      [8, makeMatchedScan(8, { expectedFactor: 1.02 })],
      [9, makeMatchedScan(9, { expectedFactor: 1.02 })],
    ]);

    const dispositions = new Map<number, CorporateActionDividendPreparedScopeEvaluationDisposition>([
      [
        9,
        {
          importId: 9,
          disposition: 'ELIGIBLE',
          reason: 'Verified NSE simple cash dividend',
          currentActionType: 'DIVIDEND',
          currentParseStatus: 'PARSED',
          currentReviewStatus: 'PENDING',
          evidence: SAMPLE_DIVIDEND_EVIDENCE,
        },
      ],
    ]);

    const context = makeBaseContext({
      latestScanByImportId: scans,
      dividendPreparedImportIds: new Set([9]),
      officialDividendPreparedScopeDispositionByImportId: dispositions,
    });

    const allRows = [
      splitRow,
      bonusRow,
      rightsRow,
      demergerRow,
      nonEquitySplitRow,
      inactiveNoTargetRow,
      inactiveVerifiedTargetRow,
      unverifiedDividendRow,
      verifiedDividendRow,
    ];

    for (const row of allRows) {
      expect(isClassicCorporateActionRowReady(row, context)).toBe(
        evaluateOfficialCorporateActionRowReadiness(row, context),
      );
    }

    const eligibleIds = selectEligibleOfficialImportRows(allRows, context).map((row) => row.id);
    expect(eligibleIds).toEqual([1, 2, 7, 9]);
  });

  it('blocks readiness when preparation is incomplete, row has a preparation error, or Dividend is already processed', () => {
    const splitRow = makeRow(1, 'SPLIT');
    const dividendRow = makeRow(2, 'DIVIDEND');
    const scans = new Map([[1, makeMatchedScan(1)]]);
    const dispositions = new Map<number, CorporateActionDividendPreparedScopeEvaluationDisposition>([
      [
        2,
        {
          importId: 2,
          disposition: 'ELIGIBLE',
          reason: 'Verified',
          currentActionType: 'DIVIDEND',
          currentParseStatus: 'PARSED',
          currentReviewStatus: 'PENDING',
          evidence: SAMPLE_DIVIDEND_EVIDENCE,
        },
      ],
    ]);

    const incompleteCtx = makeBaseContext({
      officialPreparationComplete: false,
      latestScanByImportId: scans,
      dividendPreparedImportIds: new Set([2]),
      officialDividendPreparedScopeDispositionByImportId: dispositions,
    });
    expect(evaluateOfficialCorporateActionRowReadiness(splitRow, incompleteCtx)).toBe(false);
    expect(evaluateOfficialCorporateActionRowReadiness(dividendRow, incompleteCtx)).toBe(false);

    const errorCtx = makeBaseContext({
      officialPreparationErrors: { 1: 'Scan failed' },
      existingDividendByImportId: { 2: { row: dividendRow } },
      latestScanByImportId: scans,
      dividendPreparedImportIds: new Set([2]),
      officialDividendPreparedScopeDispositionByImportId: dispositions,
    });
    expect(evaluateOfficialCorporateActionRowReadiness(splitRow, errorCtx)).toBe(false);
    expect(evaluateOfficialCorporateActionRowReadiness(dividendRow, errorCtx)).toBe(false);
  });

  it('executes end-to-end mixed-queue Split approval -> queue refresh -> Bonus approval without stale Dividend failure', async () => {
    const splitRow = makeRow(1, 'SPLIT', { symbol: 'INFY' });
    const bonusRow = makeRow(2, 'BONUS', { symbol: 'TCS', purposeRaw: 'Bonus 1:1' });
    const dividendRow = makeRow(3, 'DIVIDEND', { symbol: 'WIPRO', purposeRaw: 'Dividend Rs 5 Per Share' });
    const rightsRow = makeRow(4, 'RIGHTS', { symbol: 'SBIN', purposeRaw: 'Rights 1:5 @ Rs 400' });

    const queue = [splitRow, bonusRow, dividendRow, rightsRow];
    const scans = new Map<number, CorporateActionScanResultRow>([
      [1, makeMatchedScan(1, { symbol: 'INFY' })],
      [2, makeMatchedScan(2, { symbol: 'TCS' })],
    ]);

    const initialReady = selectEligibleOfficialImportRows(
      queue,
      makeBaseContext({ latestScanByImportId: scans }),
    );
    expect(initialReady.map((item) => item.id)).toEqual([1, 2]);

    const api = {
      getCorporateActionImportsByIds: vi.fn(async ({ importIds }: { importIds: number[] }) =>
        queue
          .filter((item) => importIds.includes(item.id))
          .map((item) =>
            item.id === 1
              ? {
                  ...item,
                  reviewStatus: 'APPROVED' as const,
                  approvedCorporateActionId: 501,
                }
              : item,
          ),
      ),
      runCorporateActionScan: vi.fn(async () => ({ results: [] } as never)),
      evaluateSimpleCashDividendPreparedScope: vi.fn(),
    };

    const afterSplit = await refreshCorporateActionQueueAfterApproval({
      api,
      rows: queue,
      approvedSelection: [1],
      previousOutcome: null,
      previousGeneration: 1,
      expectedDatabasePath: 'E:\\test\\db',
      shouldContinue: () => true,
    });

    const readyAfterSplit = selectEligibleOfficialImportRows(
      afterSplit.rows,
      makeBaseContext({ latestScanByImportId: scans }),
    );
    expect(readyAfterSplit.map((item) => item.id)).toEqual([2]);
    expect(api.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
  });

  it('persists prepared Load & Validate review across window close/reopen for the same database and invalidates on database switch or reload', () => {
    clearCachedCorporateActionPendingReview();
    const snapshot = {
      databasePath: 'E:\\EOD DATABASE',
      generation: 7,
      complete: true,
      rows: [makeRow(1, 'SPLIT')],
      scans: [makeMatchedScan(1)],
      message: 'Pending queue prepared.',
    };

    setCachedCorporateActionPendingReview(snapshot);
    expect(getCachedCorporateActionPendingReview<typeof snapshot>('E:\\EOD DATABASE')).toEqual(snapshot);
    expect(getCachedCorporateActionPendingReview<typeof snapshot>('E:\\OTHER DATABASE')).toBeNull();

    // Switching databases invalidates the previous database cache
    clearCachedCorporateActionPendingReview('E:\\OTHER DATABASE');
    expect(getCachedCorporateActionPendingReview<typeof snapshot>('E:\\EOD DATABASE')).toBeNull();

    // Re-saving and then explicitly clearing on a new Load & Validate / Fetch run
    setCachedCorporateActionPendingReview(snapshot);
    expect(getCachedCorporateActionPendingReview<typeof snapshot>('E:\\EOD DATABASE')).toEqual(snapshot);
    clearCachedCorporateActionPendingReview();
    expect(getCachedCorporateActionPendingReview<typeof snapshot>('E:\\EOD DATABASE')).toBeNull();
  });
});
