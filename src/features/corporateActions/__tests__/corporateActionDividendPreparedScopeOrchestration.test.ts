import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionDividendPreparedScopeEvaluationDisposition,
  CorporateActionDividendPreparedScopeEvaluationResult,
  CorporateActionImportRow,
} from '@/platform';
import {
  buildCorporateActionDividendPreparedScope,
  computeCorporateActionDividendPreparedScopeFingerprint,
  type CorporateActionDividendPreparedScope,
} from '../legacy/corporateActionDividendPreparedScope';
import {
  CORPORATE_ACTION_DIVIDEND_POLICY_VERSION,
  CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_BATCH_SIZE,
  evaluateCorporateActionDividendPreparedScopeBatches,
} from '../legacy/corporateActionDividendPreparedScopeOrchestration';

const DATABASE = 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse';

function importRow(id: number): CorporateActionImportRow {
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
  };
}

async function scopeFor(ids: number[], generation = 7): Promise<CorporateActionDividendPreparedScope> {
  const built = await buildCorporateActionDividendPreparedScope({
    rows: ids.map(importRow),
    cycle: { generation, expectedDatabasePath: DATABASE },
    currentGeneration: generation,
    currentDatabasePath: DATABASE,
    complete: true,
  });
  if (built.status !== 'READY') throw new Error(`Unexpected scope state: ${built.reason}`);
  return built.scope;
}

function disposition(importId: number, dispositionCode: CorporateActionDividendPreparedScopeEvaluationDisposition['disposition'] = 'ELIGIBLE'):
CorporateActionDividendPreparedScopeEvaluationDisposition {
  return {
    importId,
    disposition: dispositionCode,
    reason: `${dispositionCode} fixture`,
    currentActionType: 'DIVIDEND',
    currentParseStatus: 'PARSED',
    currentReviewStatus: 'PENDING',
    evidence: null,
  };
}

async function batchResult(
  ids: number[],
  overrides: Partial<CorporateActionDividendPreparedScopeEvaluationResult> = {},
): Promise<CorporateActionDividendPreparedScopeEvaluationResult> {
  const fingerprint = await computeCorporateActionDividendPreparedScopeFingerprint(DATABASE, ids);
  return {
    requested: ids.length,
    eligible: ids.length,
    ineligible: 0,
    alreadyApproved: 0,
    staleScope: 0,
    missing: 0,
    failed: 0,
    dispositions: ids.map((id) => disposition(id)),
    policyVersion: CORPORATE_ACTION_DIVIDEND_POLICY_VERSION,
    scopeVersion: 'CA_DIVIDEND_PREPARED_SCOPE_R1',
    scopeFingerprint: fingerprint.scopeFingerprint,
    complete: true,
    message: 'fixture complete',
    ...overrides,
  };
}

function harness(scope: CorporateActionDividendPreparedScope) {
  let generation = scope.generation;
  let databasePath: string | null = DATABASE;
  let cancelled = false;
  const evaluateSimpleCashDividendPreparedScope = vi.fn(async ({ importIds }: { importIds: number[] }) => batchResult(importIds));
  return {
    api: { evaluateSimpleCashDividendPreparedScope },
    getCurrentGeneration: () => generation,
    getCurrentDatabasePath: () => databasePath,
    isCancelled: () => cancelled,
    setGeneration: (value: number) => { generation = value; },
    setDatabasePath: (value: string | null) => { databasePath = value; },
    cancel: () => { cancelled = true; },
    evaluateSimpleCashDividendPreparedScope,
  };
}

async function run(scope: CorporateActionDividendPreparedScope, h = harness(scope)) {
  return {
    result: await evaluateCorporateActionDividendPreparedScopeBatches({
      api: h.api,
      scope,
      getCurrentGeneration: h.getCurrentGeneration,
      getCurrentDatabasePath: h.getCurrentDatabasePath,
      isCancelled: h.isCancelled,
    }),
    harness: h,
  };
}

const source = (relative: string) => readFileSync(resolve(process.cwd(), relative), 'utf8');

describe('Dividend prepared-scope P3B current-cycle orchestration', () => {
  it('P1 shared fingerprint helper preserves the accepted whole-scope fingerprint', async () => {
    const scope = await scopeFor([9, 2, 7]);
    expect(scope.scopeFingerprint).toBe('BCDF0FBE3DE30C32D2E3ED1A5D9C83D7C48CB668057C37DD27848836C1732781');
    await expect(computeCorporateActionDividendPreparedScopeFingerprint(DATABASE, [9, 2, 7])).resolves.toMatchObject({
      scopeFingerprint: scope.scopeFingerprint,
      fingerprintInput: scope.fingerprintInput,
      normalizedDatabasePath: scope.normalizedDatabasePath,
    });
  });

  it('evaluates one non-empty scope through one read-only bridge call', async () => {
    const scope = await scopeFor([3, 1, 2]);
    const { result, harness: h } = await run(scope);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledWith({ importIds: [1, 2, 3], expectedDatabasePath: DATABASE });
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.complete).toBe(true);
    expect(result.outcome.result.requested).toBe(3);
    expect(result.outcome.result.completedBatchCount).toBe(1);
  });

  it('uses the frozen 100-ID batch size', () => {
    expect(CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_BATCH_SIZE).toBe(100);
  });

  it('chunks 101 ascending IDs deterministically as 100 then 1', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const { result, harness: h } = await run(scope);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(2);
    expect(h.evaluateSimpleCashDividendPreparedScope.mock.calls[0]?.[0].importIds).toEqual(Array.from({ length: 100 }, (_, index) => index + 1));
    expect(h.evaluateSimpleCashDividendPreparedScope.mock.calls[1]?.[0].importIds).toEqual([101]);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.batchCount).toBe(2);
    expect(result.outcome.result.completedBatchCount).toBe(2);
  });

  it('makes zero Tauri calls for an empty P1 scope', async () => {
    const scope = await scopeFor([]);
    const { result, harness: h } = await run(scope);
    expect(result).toEqual({ status: 'NO_CANDIDATES' });
    expect(h.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
  });

  it('makes zero calls when the generation is already stale', async () => {
    const scope = await scopeFor([1]);
    const h = harness(scope);
    h.setGeneration(8);
    const { result } = await run(scope, h);
    expect(result).toEqual({ status: 'STALE' });
    expect(h.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
  });

  it('makes zero calls when the database already changed', async () => {
    const scope = await scopeFor([1]);
    const h = harness(scope);
    h.setDatabasePath('E:\\Other\\Database');
    const { result } = await run(scope, h);
    expect(result).toEqual({ status: 'STALE' });
    expect(h.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
  });

  it('makes zero calls when cancellation is already requested', async () => {
    const scope = await scopeFor([1]);
    const h = harness(scope);
    h.cancel();
    const { result } = await run(scope, h);
    expect(result).toEqual({ status: 'STALE' });
    expect(h.evaluateSimpleCashDividendPreparedScope).not.toHaveBeenCalled();
  });

  it('suppresses publication and later batches when generation changes after an await', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => {
      const response = await batchResult(importIds);
      h.setGeneration(8);
      return response;
    });
    const { result } = await run(scope, h);
    expect(result).toEqual({ status: 'STALE' });
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
  });

  it('suppresses publication and later batches when database changes after an await', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => {
      const response = await batchResult(importIds);
      h.setDatabasePath('E:\\Other\\Database');
      return response;
    });
    const { result } = await run(scope, h);
    expect(result).toEqual({ status: 'STALE' });
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
  });

  it('suppresses publication and later batches when cancellation occurs after an await', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => {
      const response = await batchResult(importIds);
      h.cancel();
      return response;
    });
    const { result } = await run(scope, h);
    expect(result).toEqual({ status: 'STALE' });
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
  });

  it('fails closed on policy-version mismatch and does not call later batches', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, { policyVersion: 'WRONG' }));
    const { result } = await run(scope, h);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.complete).toBe(false);
    expect(result.outcome.result.operationalError).toMatch(/policy version mismatch/i);
  });

  it('fails closed on scope-version mismatch', async () => {
    const scope = await scopeFor([1]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, { scopeVersion: 'WRONG' }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.operationalError).toMatch(/scope version mismatch/i);
  });

  it('fails closed on batch fingerprint mismatch', async () => {
    const scope = await scopeFor([1]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, { scopeFingerprint: 'WRONG' }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.operationalError).toMatch(/fingerprint mismatch/i);
  });

  it('fails closed on requested-count mismatch', async () => {
    const scope = await scopeFor([1, 2]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, { requested: 1 }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.operationalError).toMatch(/requested-count mismatch/i);
  });

  it('fails closed on disposition-count mismatch', async () => {
    const scope = await scopeFor([1, 2]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, { dispositions: [disposition(1)] }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.operationalError).toMatch(/disposition-count mismatch/i);
  });

  it('fails closed on duplicate disposition IDs', async () => {
    const scope = await scopeFor([1, 2]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, {
      dispositions: [disposition(1), disposition(1)],
    }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.operationalError).toMatch(/duplicate disposition IDs/i);
  });

  it('fails closed when disposition IDs differ from the requested batch', async () => {
    const scope = await scopeFor([1, 2]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, {
      dispositions: [disposition(1), disposition(3)],
    }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.operationalError).toMatch(/do not match the requested batch/i);
  });

  it('continues through deterministic non-eligible dispositions when backend complete stays true', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, {
      eligible: 0,
      ineligible: 98,
      alreadyApproved: 1,
      staleScope: 1,
      dispositions: importIds.map((id, index) => disposition(id, index === 0 ? 'ALREADY_APPROVED' : index === 1 ? 'STALE_SCOPE' : 'INELIGIBLE')),
    }));
    const { result } = await run(scope, h);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.complete).toBe(true);
    expect(result.outcome.result.completedBatchCount).toBe(2);
  });

  it('stops later batches when P2 reports complete=false', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, {
      eligible: importIds.length - 1,
      failed: 1,
      complete: false,
      message: 'fixture incomplete',
      dispositions: importIds.map((id, index) => disposition(id, index === 0 ? 'FAILED' : 'ELIGIBLE')),
    }));
    const { result } = await run(scope, h);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.complete).toBe(false);
    expect(result.outcome.result.operationalError).toBe('fixture incomplete');
    expect(result.outcome.result.completedBatchCount).toBe(1);
  });

  it('turns a bridge throw into a current-cycle incomplete outcome with no automatic retry', async () => {
    const scope = await scopeFor([1]);
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockRejectedValueOnce(new Error('bridge unavailable'));
    const { result } = await run(scope, h);
    expect(h.evaluateSimpleCashDividendPreparedScope).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result.complete).toBe(false);
    expect(result.outcome.result.operationalError).toBe('bridge unavailable');
  });

  it('aggregates counts and dispositions across accepted batches', async () => {
    const scope = await scopeFor(Array.from({ length: 101 }, (_, index) => index + 1));
    const h = harness(scope);
    h.evaluateSimpleCashDividendPreparedScope.mockImplementationOnce(async ({ importIds }) => batchResult(importIds, {
      eligible: 96,
      ineligible: 1,
      alreadyApproved: 1,
      staleScope: 1,
      missing: 1,
      failed: 0,
      dispositions: importIds.map((id, index) => disposition(id,
        index === 0 ? 'INELIGIBLE' : index === 1 ? 'ALREADY_APPROVED' : index === 2 ? 'STALE_SCOPE' : index === 3 ? 'MISSING' : 'ELIGIBLE')),
    }));
    const { result } = await run(scope, h);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome.result).toMatchObject({ requested: 101, eligible: 97, ineligible: 1, alreadyApproved: 1, staleScope: 1, missing: 1, failed: 0, complete: true });
    expect(result.outcome.result.dispositions).toHaveLength(101);
  });

  it('publishes the immutable P1 cycle identity rather than a backend-generated operation identity', async () => {
    const scope = await scopeFor([1, 2], 11);
    const { result } = await run(scope);
    expect(result.status).toBe('OUTCOME');
    if (result.status !== 'OUTCOME') return;
    expect(result.outcome).toMatchObject({
      databasePath: DATABASE,
      generation: 11,
      operationKey: scope.operationKey,
      wholeScopeFingerprint: scope.scopeFingerprint,
    });
  });

  it('DatabaseToolsDialogs wires P1 then P3A after the accepted preparation result without changing final status ownership', () => {
    const dialog = source('src/components/DatabaseToolsDialogs.tsx');
    const start = dialog.indexOf('const loadAndPrepareOfficialImports = async () => {');
    const end = dialog.indexOf('\n  const loadOfficialImports = async', start);
    const block = dialog.slice(start, end);
    expect(block).toContain('buildCorporateActionDividendPreparedScope({');
    expect(block).toContain('evaluateCorporateActionDividendPreparedScopeBatches({');
    expect(block.indexOf('setStatus(result.message);')).toBeGreaterThan(-1);
    expect(block.indexOf('buildCorporateActionDividendPreparedScope({')).toBeGreaterThan(block.indexOf('setStatus(result.message);'));
    expect(block.match(/setStatus\(/g)).toHaveLength(2); // existing success + existing catch only
  });

  it('DatabaseToolsDialogs keeps P3B state ephemeral and clears it with authoritative queue/cycle invalidation', () => {
    const dialog = source('src/components/DatabaseToolsDialogs.tsx');
    expect(dialog).toContain('officialDividendPreparedScopeOutcome');
    expect(dialog).toContain('setOfficialDividendPreparedScopeOutcome(null);');
    expect((dialog.match(/setOfficialDividendPreparedScopeOutcome\(null\);/g) ?? []).length).toBeGreaterThanOrEqual(5);
    expect(dialog).not.toContain('localStorage.setItem(\'officialDividendPreparedScopeOutcome\'');
    expect(dialog).not.toContain('sessionStorage.setItem(\'officialDividendPreparedScopeOutcome\'');
  });

  it('P3B adds no Dividend UI observability or approval action', () => {
    const dialog = source('src/components/DatabaseToolsDialogs.tsx');
    expect(dialog).not.toContain('Dividend R1 read-only evaluation');
    expect(dialog).not.toContain('Approve Dividend R1');
    expect(dialog).not.toContain('autoApproveDividend');
  });
});
