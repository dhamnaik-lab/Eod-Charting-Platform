import { describe, expect, it, vi } from 'vitest';
import type { CorporateActionImportRow, CorporateActionDividendPreparedScopeEvaluationResult } from '@/platform';
import { affectedCorporateActionRows, refreshCorporateActionQueueAfterApproval } from '../legacy/corporateActionPostApprovalRefresh';
import { buildCorporateActionDividendPreparedScope, computeCorporateActionDividendPreparedScopeFingerprint } from '../legacy/corporateActionDividendPreparedScope';
import { evaluateCorporateActionDividendPreparedScopeBatches } from '../legacy/corporateActionDividendPreparedScopeOrchestration';
import { isDividendWriteStageDraftCurrent, prepareDividendWriteStageDraft } from '../legacy/corporateActionDividendWriteStageOrchestration';

const database = 'E:\\test\\database';
const row = (id: number, symbol: string, extra: Partial<CorporateActionImportRow> = {}) => ({
  id, symbol, exchange: 'NSE', isin: null, actionType: 'DIVIDEND', parseStatus: 'PARSED',
  reviewStatus: 'PENDING', approvedCorporateActionId: null, ...extra,
} as CorporateActionImportRow);

async function fixture(rows = [row(1, 'HEGAM'), row(2, 'HEGAM'), row(3, 'OTHER')]) {
  const build = await buildCorporateActionDividendPreparedScope({ rows,
    cycle: { generation: 7, expectedDatabasePath: database }, currentGeneration: 7,
    currentDatabasePath: database, complete: true });
  if (build.status !== 'READY') throw new Error('scope fixture');
  const evaluate = vi.fn(async (input: { importIds: number[] }) => ({
    requested: input.importIds.length, eligible: input.importIds.length, ineligible: 0,
    alreadyApproved: 0, staleScope: 0, missing: 0, failed: 0, complete: true, message: '',
    policyVersion: 'AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1', scopeVersion: 'CA_DIVIDEND_PREPARED_SCOPE_R1',
    scopeFingerprint: (await computeCorporateActionDividendPreparedScopeFingerprint(database, input.importIds)).scopeFingerprint,
    dispositions: input.importIds.map(importId => ({ importId, disposition: 'ELIGIBLE', reason: 'verified',
      currentActionType: 'DIVIDEND', currentParseStatus: 'PARSED', currentReviewStatus: 'PENDING', evidence: null })),
  } as CorporateActionDividendPreparedScopeEvaluationResult));
  const previous = await evaluateCorporateActionDividendPreparedScopeBatches({
    api: { evaluateSimpleCashDividendPreparedScope: evaluate }, scope: build.scope,
    getCurrentGeneration: () => 7, getCurrentDatabasePath: () => database, isCancelled: () => false,
  });
  if (previous.status !== 'OUTCOME') throw new Error('outcome fixture');
  evaluate.mockClear();
  const api = {
    getCorporateActionImportsByIds: vi.fn(async ({ importIds }: { importIds: number[] }) =>
      rows.filter(item => importIds.includes(item.id)).map(item => item.id === 1
        ? { ...item, reviewStatus: 'APPROVED', approvedCorporateActionId: 123 } : item)),
    runCorporateActionScan: vi.fn(async () => ({ results: [] } as never)),
    evaluateSimpleCashDividendPreparedScope: evaluate,
  };
  const input = { api, rows, approvedSelection: [1], previousOutcome: previous.outcome,
    previousGeneration: 7, expectedDatabasePath: database, shouldContinue: () => true };
  return { input, api, previous, scope: build.scope };
}

describe('targeted post-approval queue refresh', () => {
  it('includes the verified owner and both aliases in the affected queue scope', () => {
    const rows = [row(1, 'GUJGASLTD', { actionType: 'SPLIT', verifiedAdjustmentTarget: 'GUJENERGY' }),
      row(2, 'GUJENERGY'), row(3, 'GUJGASLTD'), row(4, 'OTHER')];
    expect(affectedCorporateActionRows(rows, [1]).map(item => item.id)).toEqual([1, 2, 3]);
    expect(affectedCorporateActionRows(rows, [2]).map(item => item.id)).toEqual([1, 2, 3]);
  });
  it('removes only confirmed approved rows and preserves all unrelated rows and evidence', async () => {
    const { input, api, previous } = await fixture();
    const result = await refreshCorporateActionQueueAfterApproval(input);
    expect(result.rows.map(item => item.id)).toEqual([2, 3]);
    expect(result.rows[1]).toBe(input.rows[2]);
    expect(api.getCorporateActionImportsByIds).toHaveBeenCalledWith({ importIds: [1, 2], expectedDatabasePath: database });
    expect(api.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
    expect(api.evaluateSimpleCashDividendPreparedScope.mock.calls[0][0].importIds).toEqual([2]);
    expect(api.runCorporateActionScan).not.toHaveBeenCalled();
    expect(result.outcome.result.dispositions.find(item => item.importId === 3))
      .toBe(previous.outcome.result.dispositions.find(item => item.importId === 3));
    expect(result.scope.importIds).toEqual([2, 3]);
    expect(result.outcome.result.eligible).toBe(2);
    expect(result.outcome.result.requested).toBe(2);
    expect(result.outcome.result.completedBatchCount).toBe(1);
  });

  it('checks one related batch with 9,000 unrelated pending Dividends', async () => {
    const rows = [row(1, 'HEGAM'), row(2, 'HEGAM'),
      ...Array.from({ length: 9000 }, (_, index) => row(index + 3, `OTHER${index}`))];
    const { input, api } = await fixture(rows);
    const result = await refreshCorporateActionQueueAfterApproval(input);
    expect(api.getCorporateActionImportsByIds.mock.calls[0][0].importIds).toEqual([1, 2]);
    expect(api.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
    expect(api.evaluateSimpleCashDividendPreparedScope.mock.calls[0][0].importIds).toEqual([2]);
    expect(result.rows).toHaveLength(9001);
    expect(result.outcome.result.eligible).toBe(9001);
  });

  it('expires old confirmations while allowing a new exact selection from retained evidence', async () => {
    const { input, scope, previous } = await fixture();
    const context = (generation: number) => ({ generation, databasePath: database,
      preparationComplete: true, cancelled: false, operationRunning: false });
    const old = await prepareDividendWriteStageDraft({ scope, outcome: previous.outcome,
      selectedImportIds: [3], getCurrentContext: () => context(7) });
    expect(old.status).toBe('READY');
    const result = await refreshCorporateActionQueueAfterApproval(input);
    if (old.status !== 'READY') throw new Error('draft fixture');
    expect(isDividendWriteStageDraftCurrent(old.draft, result.scope, result.outcome, context(8))).toBe(false);
    expect((await prepareDividendWriteStageDraft({ scope: result.scope, outcome: result.outcome,
      selectedImportIds: [3], getCurrentContext: () => context(8) })).status).toBe('READY');
    expect((await prepareDividendWriteStageDraft({ scope: result.scope, outcome: result.outcome,
      selectedImportIds: [1], getCurrentContext: () => context(8) })).status).toBe('BLOCKED');
  });

  it('includes full-ISIN aliases across exchanges and transitively related symbols', () => {
    const rows = [row(1, 'NEW', { isin: 'INE123A01016' }),
      row(2, 'OLD', { isin: 'INE123A01016', exchange: 'BSE' }),
      row(3, 'OLD', { exchange: 'BSE' }), row(4, 'OTHER'), row(5, 'OTHER', { isin: 'INE' })];
    expect(affectedCorporateActionRows(rows, [1]).map(item => item.id)).toEqual([1, 2, 3]);
  });

  it('does no policy evaluation when no related Dividend remains', async () => {
    const { input, api } = await fixture([row(1, 'HEGAM'), row(3, 'OTHER')]);
    const result = await refreshCorporateActionQueueAfterApproval(input);
    expect(api.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
    expect(result.scope.importIds).toEqual([3]);
  });

  it('keeps an unapproved selected row pending and evaluates it again', async () => {
    const { input, api } = await fixture();
    api.getCorporateActionImportsByIds.mockResolvedValue(input.rows.slice(0, 2));
    const result = await refreshCorporateActionQueueAfterApproval(input);
    expect(result.rows.map(item => item.id)).toEqual([1, 2, 3]);
    expect(api.evaluateSimpleCashDividendPreparedScope.mock.calls[0][0].importIds).toEqual([1, 2]);
  });

  it('scans only related Split/Bonus/Rights rows', async () => {
    const { input, api } = await fixture([row(1, 'HEGAM'), row(2, 'HEGAM', { actionType: 'SPLIT' }),
      row(3, 'OTHER'), row(4, 'OTHER', { actionType: 'BONUS' })]);
    const result = await refreshCorporateActionQueueAfterApproval(input);
    expect(api.runCorporateActionScan).toHaveBeenCalledWith({ scope: 'official_imports', importIds: [2] });
    expect(result.validationIds).toEqual([2]);
  });

  it('rejects incomplete exact reads without removing rows', async () => {
    const { input, api } = await fixture();
    api.getCorporateActionImportsByIds.mockResolvedValue([]);
    await expect(refreshCorporateActionQueueAfterApproval(input)).rejects.toThrow('missing reviewed IDs');
    expect(api.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
    expect(input.rows).toHaveLength(3);
  });

  it('refuses to reuse unrelated evidence if fresh identity would enlarge the affected group', async () => {
    const { input, api } = await fixture([row(1, 'HEGAM'), row(2, 'HEGAM'),
      row(3, 'OTHER', { isin: 'INE123A01016' })]);
    api.getCorporateActionImportsByIds.mockResolvedValue([
      { ...input.rows[0], isin: 'INE123A01016', reviewStatus: 'APPROVED' }, input.rows[1],
    ]);
    await expect(refreshCorporateActionQueueAfterApproval(input)).rejects.toThrow('Identity scope changed');
    expect(api.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
  });

  it('rejects stale contexts and interrupted evaluations', async () => {
    const { input, api } = await fixture();
    await expect(refreshCorporateActionQueueAfterApproval({ ...input, shouldContinue: () => false })).rejects.toThrow('Database or preparation changed');
    expect(api.getCorporateActionImportsByIds).not.toHaveBeenCalled();
    let current = true;
    api.evaluateSimpleCashDividendPreparedScope.mockImplementation(async () => { current = false; throw new Error('changed'); });
    await expect(refreshCorporateActionQueueAfterApproval({ ...input, shouldContinue: () => current })).rejects.toThrow('Database or preparation changed');
  });

  it('does not publish partial policy results or invent missing retained evidence', async () => {
    const { input, api } = await fixture();
    api.evaluateSimpleCashDividendPreparedScope.mockRejectedValue(new Error('offline'));
    await expect(refreshCorporateActionQueueAfterApproval(input)).rejects.toThrow('did not complete');
    const other = await fixture();
    other.input.previousOutcome.result.dispositions = [];
    await expect(refreshCorporateActionQueueAfterApproval(other.input)).rejects.toThrow('evidence is incomplete');
  });

  it('reconciles consecutive Split/Bonus approvals when automatic Load & Validate deferred Dividends (previousOutcome is null or empty)', async () => {
    const rows = [
      row(1, 'HEGAM', { actionType: 'SPLIT' }),
      row(2, 'SECOND', { actionType: 'BONUS' }),
      row(3, 'OTHER', { actionType: 'DIVIDEND' }),
      row(4, 'OTHER2', { actionType: 'RIGHTS' }),
    ];
    const evaluate = vi.fn();
    const api = {
      getCorporateActionImportsByIds: vi.fn(async ({ importIds }: { importIds: number[] }) =>
        rows.filter(item => importIds.includes(item.id)).map(item => ({
          ...item,
          reviewStatus: 'APPROVED' as const,
          approvedCorporateActionId: item.id + 100,
        }))),
      runCorporateActionScan: vi.fn(async () => ({ results: [] } as never)),
      evaluateSimpleCashDividendPreparedScope: evaluate,
    };
    const first = await refreshCorporateActionQueueAfterApproval({
      api,
      rows,
      approvedSelection: [1],
      previousOutcome: null,
      previousGeneration: 7,
      expectedDatabasePath: database,
      shouldContinue: () => true,
    });
    expect(first.rows.map(item => item.id)).toEqual([2, 3, 4]);
    expect(first.scope.importIds).toEqual([]);
    expect(first.outcome.result.requested).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();

    const second = await refreshCorporateActionQueueAfterApproval({
      api,
      rows: first.rows,
      approvedSelection: [2],
      previousOutcome: first.outcome,
      previousGeneration: 8,
      expectedDatabasePath: database,
      shouldContinue: () => true,
    });
    expect(second.rows.map(item => item.id)).toEqual([3, 4]);
    expect(second.scope.importIds).toEqual([]);
    expect(second.outcome.result.requested).toBe(0);
    expect(evaluate).not.toHaveBeenCalled();
  });
});
