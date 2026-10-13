import { describe, expect, it } from 'vitest';
import type { CorporateActionImportRow } from '@/platform';
import {
  buildCorporateActionDividendPreparedScope,
  normalizeCorporateActionPreparedScopeDatabasePath,
} from '../legacy/corporateActionDividendPreparedScope';

const DATABASE = 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse';

function importRow(id: number, overrides: Partial<CorporateActionImportRow> = {}): CorporateActionImportRow {
  return {
    id,
    exchange: 'NSE',
    source: 'NSE_API',
    sourceFile: null,
    symbol: `SYM${id}`,
    isin: null,
    bseScripCode: null,
    companyName: `Company ${id}`,
    purposeRaw: 'Dividend Rs 1 per share',
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
    evidenceSources: ['NSE_API'],
    latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null,
    latestEvidenceNote: null,
    ...overrides,
  };
}

async function build(
  rows: readonly CorporateActionImportRow[],
  overrides: Partial<Parameters<typeof buildCorporateActionDividendPreparedScope>[0]> = {},
) {
  return buildCorporateActionDividendPreparedScope({
    rows,
    cycle: { generation: 7, expectedDatabasePath: DATABASE },
    currentGeneration: 7,
    currentDatabasePath: DATABASE,
    complete: true,
    ...overrides,
  });
}

describe('Corporate Action Dividend prepared-scope builder R1', () => {
  it('returns the exact current-cycle Dividend/PARSED/PENDING IDs in deterministic ascending order', async () => {
    const result = await build([importRow(9), importRow(2), importRow(7)]);

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([2, 7, 9]);
    expect(result.scope.preparedRowCount).toBe(3);
    expect(result.scope.structuralCandidateCount).toBe(3);
    expect(result.scope.uniqueRequestedCount).toBe(3);
    expect(result.scope.scopeFingerprint).toBe('BCDF0FBE3DE30C32D2E3ED1A5D9C83D7C48CB668057C37DD27848836C1732781');
    expect(result.scope.operationKey).toBe(`7:${result.scope.scopeFingerprint}`);
  });

  it('does not move NSE/source/classifier/readiness policy into the frontend scope filter', async () => {
    const result = await build([
      importRow(1, { exchange: 'BSE', source: 'OTHER', purposeRaw: 'ambiguous', cashAmount: null, symbol: null }),
      importRow(2, { exchange: 'NSE', source: 'NSE_API' }),
    ]);

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([1, 2]);
  });

  it('excludes non-Dividend rows', async () => {
    const result = await build([importRow(1, { actionType: 'SPLIT' }), importRow(2)]);
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([2]);
  });

  it('excludes UNRESOLVED rows', async () => {
    const result = await build([importRow(1, { reviewStatus: 'UNRESOLVED' }), importRow(2)]);
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([2]);
  });

  it('excludes PENDING_ISIN_MISMATCH rows', async () => {
    const result = await build([importRow(1, { reviewStatus: 'PENDING_ISIN_MISMATCH' }), importRow(2)]);
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([2]);
  });

  it('deduplicates duplicate candidate IDs and sorts them deterministically', async () => {
    const result = await build([importRow(5), importRow(3), importRow(5), importRow(4)]);
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([3, 4, 5]);
    expect(result.scope.structuralCandidateCount).toBe(4);
    expect(result.scope.uniqueRequestedCount).toBe(3);
  });

  it('excludes invalid/non-positive candidate IDs without widening the scope', async () => {
    const result = await build([importRow(2), importRow(0), importRow(-1), importRow(Number.NaN), importRow(1.5)]);
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.scope.importIds).toEqual([2]);
    expect(result.scope.structuralCandidateCount).toBe(5);
    expect(result.scope.invalidCandidateIdCount).toBe(4);
  });


  it('returns no scope for an invalid generation identity', async () => {
    await expect(build([importRow(1)], { currentGeneration: 0 })).resolves.toEqual({
      status: 'NO_SCOPE',
      reason: 'INVALID_GENERATION',
    });
  });

  it('returns no scope when the database context is missing', async () => {
    await expect(build([importRow(1)], { currentDatabasePath: '   ' })).resolves.toEqual({
      status: 'NO_SCOPE',
      reason: 'DATABASE_CONTEXT_MISSING',
    });
  });

  it('returns no scope for a cancelled Prepare cycle', async () => {
    await expect(build([importRow(1)], { cancelled: true })).resolves.toEqual({
      status: 'NO_SCOPE',
      reason: 'PREPARATION_CANCELLED',
    });
  });

  it('returns no scope for an incomplete Prepare cycle', async () => {
    await expect(build([importRow(1)], { complete: false })).resolves.toEqual({
      status: 'NO_SCOPE',
      reason: 'PREPARATION_INCOMPLETE',
    });
  });

  it('returns no scope when the active database changes', async () => {
    await expect(build([importRow(1)], { currentDatabasePath: 'E:\\Other\\Database' })).resolves.toEqual({
      status: 'NO_SCOPE',
      reason: 'DATABASE_CHANGED',
    });
  });

  it('returns no scope for a stale generation callback', async () => {
    await expect(build([importRow(1)], { currentGeneration: 8 })).resolves.toEqual({
      status: 'NO_SCOPE',
      reason: 'STALE_GENERATION',
    });
  });

  it('a new generation permanently invalidates the prior generation and can build only its own scope', async () => {
    const stale = await build([importRow(1)], { currentGeneration: 8 });
    expect(stale).toEqual({ status: 'NO_SCOPE', reason: 'STALE_GENERATION' });

    const current = await build([importRow(2)], {
      cycle: { generation: 8, expectedDatabasePath: DATABASE },
      currentGeneration: 8,
    });
    expect(current.status).toBe('READY');
    if (current.status !== 'READY') return;
    expect(current.scope.generation).toBe(8);
    expect(current.scope.importIds).toEqual([2]);
  });

  it('is deterministic across row order/rerender and normalizes equivalent Windows database paths', async () => {
    const first = await build([importRow(9), importRow(2), importRow(7)]);
    const second = await build([importRow(7), importRow(9), importRow(2)], {
      currentDatabasePath: 'e:/ta projects/eod charting platform/eod database/nse/',
    });

    expect(first.status).toBe('READY');
    expect(second.status).toBe('READY');
    if (first.status !== 'READY' || second.status !== 'READY') return;
    expect(second.scope.importIds).toEqual(first.scope.importIds);
    expect(second.scope.scopeFingerprint).toBe(first.scope.scopeFingerprint);
    expect(second.scope.operationKey).toBe(first.scope.operationKey);
    expect(normalizeCorporateActionPreparedScopeDatabasePath(DATABASE)).toBe(
      'e:\\ta projects\\eod charting platform\\eod database\\nse',
    );
    expect(Object.isFrozen(second.scope)).toBe(true);
    expect(Object.isFrozen(second.scope.importIds)).toBe(true);
  });
});
