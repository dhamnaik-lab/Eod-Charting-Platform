import type {
  CorporateActionDividendPreparedScopeEvaluationDisposition,
  CorporateActionDividendPreparedScopeEvaluationResult,
  DesktopApi,
} from '@/platform';
import {
  CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION,
  computeCorporateActionDividendPreparedScopeFingerprint,
  normalizeCorporateActionPreparedScopeDatabasePath,
  type CorporateActionDividendPreparedScope,
} from './corporateActionDividendPreparedScope';

export const CORPORATE_ACTION_DIVIDEND_POLICY_VERSION = 'AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1' as const;
export const CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_BATCH_SIZE = 100;

export interface CorporateActionDividendPreparedScopeAggregateResult {
  requested: number;
  reusedCount?: number;
  eligible: number;
  ineligible: number;
  alreadyApproved: number;
  staleScope: number;
  missing: number;
  failed: number;
  dispositions: CorporateActionDividendPreparedScopeEvaluationDisposition[];
  batchCount: number;
  completedBatchCount: number;
  complete: boolean;
  operationalError: string | null;
  policyVersion: typeof CORPORATE_ACTION_DIVIDEND_POLICY_VERSION;
  scopeVersion: typeof CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION;
}

export interface CorporateActionDividendPreparedScopeOutcomeState {
  databasePath: string;
  generation: number;
  operationKey: string;
  wholeScopeFingerprint: string;
  result: CorporateActionDividendPreparedScopeAggregateResult;
}

type CorporateActionDividendPreparedScopeApi = Pick<DesktopApi, 'evaluateSimpleCashDividendPreparedScope'>;

export interface EvaluateCorporateActionDividendPreparedScopeInput {
  api: CorporateActionDividendPreparedScopeApi;
  scope: CorporateActionDividendPreparedScope;
  getCurrentGeneration: () => number;
  getCurrentDatabasePath: () => string | null;
  isCancelled: () => boolean;
  /** Read-only display progress; no change to eligibility or approval authority. */
  onBatchProgress?: (completedBatchCount: number, batchCount: number) => void;
}

export type EvaluateCorporateActionDividendPreparedScopeResult =
  | { status: 'NO_CANDIDATES' }
  | { status: 'STALE' }
  | { status: 'OUTCOME'; outcome: CorporateActionDividendPreparedScopeOutcomeState };

function isCurrent(
  scope: CorporateActionDividendPreparedScope,
  input: Pick<
    EvaluateCorporateActionDividendPreparedScopeInput,
    'getCurrentGeneration' | 'getCurrentDatabasePath' | 'isCancelled'
  >,
): boolean {
  if (input.isCancelled()) return false;
  if (input.getCurrentGeneration() !== scope.generation) return false;
  const currentDatabasePath = normalizeCorporateActionPreparedScopeDatabasePath(input.getCurrentDatabasePath() ?? '');
  return Boolean(currentDatabasePath) && currentDatabasePath === scope.normalizedDatabasePath;
}

function chunkIds(importIds: readonly number[]): number[][] {
  const batches: number[][] = [];
  for (let start = 0; start < importIds.length; start += CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_BATCH_SIZE) {
    batches.push(importIds.slice(start, start + CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_BATCH_SIZE));
  }
  return batches;
}

function protocolFailure(
  result: CorporateActionDividendPreparedScopeEvaluationResult,
  batch: readonly number[],
  expectedFingerprint: string,
): string | null {
  if (result.policyVersion !== CORPORATE_ACTION_DIVIDEND_POLICY_VERSION) {
    return `Dividend prepared-scope policy version mismatch: ${result.policyVersion}.`;
  }
  if (result.scopeVersion !== CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION) {
    return `Dividend prepared-scope version mismatch: ${result.scopeVersion}.`;
  }
  if (result.scopeFingerprint !== expectedFingerprint) {
    return 'Dividend prepared-scope batch fingerprint mismatch.';
  }
  if (result.requested !== batch.length) {
    return `Dividend prepared-scope requested-count mismatch: ${result.requested}/${batch.length}.`;
  }
  if (result.reusedCount !== undefined && (!Number.isInteger(result.reusedCount)
    || result.reusedCount < 0 || result.reusedCount > batch.length)) {
    return 'Dividend prepared-scope reused-count mismatch.';
  }
  if (result.dispositions.length !== batch.length) {
    return `Dividend prepared-scope disposition-count mismatch: ${result.dispositions.length}/${batch.length}.`;
  }

  const expectedIds = [...batch].sort((left, right) => left - right);
  const actualIds = result.dispositions.map((item) => item.importId).sort((left, right) => left - right);
  if (new Set(actualIds).size !== actualIds.length) {
    return 'Dividend prepared-scope response contains duplicate disposition IDs.';
  }
  if (expectedIds.some((id, index) => id !== actualIds[index])) {
    return 'Dividend prepared-scope response disposition IDs do not match the requested batch.';
  }
  return null;
}

function emptyAggregate(scope: CorporateActionDividendPreparedScope, batchCount: number): CorporateActionDividendPreparedScopeAggregateResult {
  return {
    requested: scope.importIds.length,
    reusedCount: 0,
    eligible: 0,
    ineligible: 0,
    alreadyApproved: 0,
    staleScope: 0,
    missing: 0,
    failed: 0,
    dispositions: [],
    batchCount,
    completedBatchCount: 0,
    complete: false,
    operationalError: null,
    policyVersion: CORPORATE_ACTION_DIVIDEND_POLICY_VERSION,
    scopeVersion: CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION,
  };
}

function outcome(
  scope: CorporateActionDividendPreparedScope,
  result: CorporateActionDividendPreparedScopeAggregateResult,
): EvaluateCorporateActionDividendPreparedScopeResult {
  return {
    status: 'OUTCOME',
    outcome: {
      databasePath: scope.expectedDatabasePath,
      generation: scope.generation,
      operationKey: scope.operationKey,
      wholeScopeFingerprint: scope.scopeFingerprint,
      result,
    },
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return 'Dividend prepared-scope read-only evaluation failed.';
}

export async function evaluateCorporateActionDividendPreparedScopeBatches(
  input: EvaluateCorporateActionDividendPreparedScopeInput,
): Promise<EvaluateCorporateActionDividendPreparedScopeResult> {
  const { api, scope } = input;
  if (scope.importIds.length === 0) return { status: 'NO_CANDIDATES' };
  if (!isCurrent(scope, input)) return { status: 'STALE' };

  const batches = chunkIds(scope.importIds);
  const aggregate = emptyAggregate(scope, batches.length);
  input.onBatchProgress?.(0, batches.length);

  for (const batch of batches) {
    if (!isCurrent(scope, input)) return { status: 'STALE' };

    let expectedFingerprint: string;
    try {
      expectedFingerprint = (
        await computeCorporateActionDividendPreparedScopeFingerprint(scope.expectedDatabasePath, batch)
      ).scopeFingerprint;
    } catch (error) {
      if (!isCurrent(scope, input)) return { status: 'STALE' };
      aggregate.operationalError = errorMessage(error);
      return outcome(scope, aggregate);
    }

    if (!isCurrent(scope, input)) return { status: 'STALE' };

    let batchResult: CorporateActionDividendPreparedScopeEvaluationResult;
    try {
      batchResult = await api.evaluateSimpleCashDividendPreparedScope({
        importIds: [...batch],
        expectedDatabasePath: scope.expectedDatabasePath,
      });
    } catch (error) {
      if (!isCurrent(scope, input)) return { status: 'STALE' };
      aggregate.operationalError = errorMessage(error);
      return outcome(scope, aggregate);
    }

    if (!isCurrent(scope, input)) return { status: 'STALE' };

    const protocolError = protocolFailure(batchResult, batch, expectedFingerprint);
    if (protocolError) {
      aggregate.operationalError = protocolError;
      return outcome(scope, aggregate);
    }

    aggregate.eligible += batchResult.eligible;
    aggregate.reusedCount = (aggregate.reusedCount ?? 0) + (batchResult.reusedCount ?? 0);
    aggregate.ineligible += batchResult.ineligible;
    aggregate.alreadyApproved += batchResult.alreadyApproved;
    aggregate.staleScope += batchResult.staleScope;
    aggregate.missing += batchResult.missing;
    aggregate.failed += batchResult.failed;
    aggregate.dispositions.push(...batchResult.dispositions);
    aggregate.completedBatchCount += 1;
    input.onBatchProgress?.(aggregate.completedBatchCount, batches.length);

    if (!batchResult.complete) {
      aggregate.operationalError = batchResult.message || 'Dividend prepared-scope batch was incomplete.';
      return outcome(scope, aggregate);
    }
  }

  aggregate.complete = aggregate.completedBatchCount === aggregate.batchCount;
  return outcome(scope, aggregate);
}
