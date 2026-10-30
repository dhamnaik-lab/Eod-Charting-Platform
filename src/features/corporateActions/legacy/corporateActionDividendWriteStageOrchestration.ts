import type { CorporateActionDividendWriteStageInput, CorporateActionDividendWriteStageResult } from '@/platform';
import {
  CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION,
  computeCorporateActionDividendPreparedScopeFingerprint,
  normalizeCorporateActionPreparedScopeDatabasePath,
  type CorporateActionDividendPreparedScope,
} from './corporateActionDividendPreparedScope';
import {
  CORPORATE_ACTION_DIVIDEND_POLICY_VERSION,
  type CorporateActionDividendPreparedScopeOutcomeState,
} from './corporateActionDividendPreparedScopeOrchestration';

/** Explicit-Approve-only activation. Load/Prepare remains read-only. */
export const CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_ENABLED = true;
export const CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_VERSION = 'CA_DIVIDEND_WRITE_STAGE_R1' as const;
export const CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_MAX_IDS = 100;

export interface DividendWriteStageCurrentContext {
  generation: number;
  databasePath: string | null;
  preparationComplete: boolean;
  cancelled: boolean;
  operationRunning: boolean;
}

export interface PrepareDividendWriteStageDraftInput {
  scope: CorporateActionDividendPreparedScope | null;
  outcome: CorporateActionDividendPreparedScopeOutcomeState | null;
  selectedImportIds: readonly number[];
  getCurrentContext: () => DividendWriteStageCurrentContext;
}

export interface DividendWriteStageDraft {
  readonly generation: number;
  readonly operationKey: string;
  readonly normalizedDatabasePath: string;
  readonly input: Readonly<CorporateActionDividendWriteStageInput>;
}

export type PrepareDividendWriteStageDraftResult =
  | { status: 'BLOCKED'; reason: string }
  | { status: 'READY'; draft: DividendWriteStageDraft };

function blocked(reason: string): PrepareDividendWriteStageDraftResult {
  return { status: 'BLOCKED', reason };
}

function current(
  scope: CorporateActionDividendPreparedScope,
  outcome: CorporateActionDividendPreparedScopeOutcomeState | null,
  context: DividendWriteStageCurrentContext,
): boolean {
  if (!context.preparationComplete || context.cancelled || context.operationRunning) return false;
  if (!Number.isSafeInteger(scope.generation) || scope.generation <= 0 || context.generation !== scope.generation) return false;
  if (!scope.normalizedDatabasePath || !context.databasePath) return false;
  if (normalizeCorporateActionPreparedScopeDatabasePath(context.databasePath) !== scope.normalizedDatabasePath) return false;
  if (!outcome || outcome.generation !== scope.generation || outcome.operationKey !== scope.operationKey) return false;
  if (normalizeCorporateActionPreparedScopeDatabasePath(outcome.databasePath) !== scope.normalizedDatabasePath) return false;
  if (outcome.wholeScopeFingerprint !== scope.scopeFingerprint) return false;
  // P3C is an observability completeness guard only, NEVER a source of write eligibility.
  return outcome.result.complete && !outcome.result.operationalError && outcome.result.failed === 0;
}

export async function prepareDividendWriteStageDraft(
  params: PrepareDividendWriteStageDraftInput,
): Promise<PrepareDividendWriteStageDraftResult> {
  const { scope, outcome, selectedImportIds, getCurrentContext } = params;
  if (!scope || !current(scope, outcome, getCurrentContext())) return blocked('Current completed Dividend preparation is required.');
  if (scope.policyVersion !== CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION) return blocked('Prepared-scope version mismatch.');
  if (normalizeCorporateActionPreparedScopeDatabasePath(scope.expectedDatabasePath) !== scope.normalizedDatabasePath) {
    return blocked('Prepared database identity mismatch.');
  }
  if (!Array.isArray(selectedImportIds) || selectedImportIds.length < 1 || selectedImportIds.length > CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_MAX_IDS) {
    return blocked('Select 1–100 Dividend candidate IDs for one confirmation.');
  }
  if (selectedImportIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) return blocked('Invalid Dividend import ID.');
  if (new Set(selectedImportIds).size !== selectedImportIds.length) return blocked('Duplicate Dividend import ID.');
  if (scope.importIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
      new Set(scope.importIds).size !== scope.importIds.length) return blocked('Invalid prepared-scope identity.');
  const permitted = new Set(scope.importIds);
  if (selectedImportIds.some((id) => !permitted.has(id))) return blocked('Selection is outside the prepared Dividend scope.');
  const sortedIds = Object.freeze([...selectedImportIds].sort((a, b) => a - b));
  const expectedScopeFingerprint = await computeCorporateActionDividendPreparedScopeFingerprint(scope.expectedDatabasePath, scope.importIds);
  if (expectedScopeFingerprint.scopeFingerprint !== scope.scopeFingerprint) return blocked('Prepared-scope fingerprint changed.');
  const selectionFingerprint = await computeCorporateActionDividendPreparedScopeFingerprint(scope.expectedDatabasePath, sortedIds);
  if (!current(scope, outcome, getCurrentContext())) return blocked('Dividend preparation changed while creating the request.');
  const input: Readonly<CorporateActionDividendWriteStageInput> = Object.freeze({
    importIds: sortedIds as number[],
    expectedDatabasePath: scope.expectedDatabasePath,
    expectedPolicyVersion: CORPORATE_ACTION_DIVIDEND_POLICY_VERSION,
    expectedScopeVersion: CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION,
    expectedWriteStageVersion: CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_VERSION,
    expectedScopeFingerprint: selectionFingerprint.scopeFingerprint,
  });
  return { status: 'READY', draft: Object.freeze({
    generation: scope.generation,
    operationKey: scope.operationKey,
    normalizedDatabasePath: scope.normalizedDatabasePath,
    input,
  }) };
}

/** Recheck before a future separately authorized confirmation; never dispatches a write. */
export function isDividendWriteStageDraftCurrent(
  draft: DividendWriteStageDraft,
  scope: CorporateActionDividendPreparedScope | null,
  outcome: CorporateActionDividendPreparedScopeOutcomeState | null,
  context: DividendWriteStageCurrentContext,
): boolean {
  return Boolean(scope) && draft.generation === scope!.generation && draft.operationKey === scope!.operationKey &&
    draft.normalizedDatabasePath === scope!.normalizedDatabasePath && current(scope!, outcome, context) &&
    draft.input.importIds.every((id) => scope!.importIds.includes(id));
}

export type DividendWriteStageReceiptCheck =
  | { status: 'COMMITTED'; result: CorporateActionDividendWriteStageResult }
  | { status: 'UNKNOWN_RESULT'; reason: string };

const DISPOSITIONS = new Set(['AUTO_APPROVED', 'INELIGIBLE', 'ALREADY_APPROVED', 'STALE_SCOPE', 'MISSING', 'FAILED']);
const COUNTS = ['requested', 'revalidatedEligible', 'autoApproved', 'ineligible', 'alreadyApproved', 'staleScope', 'missing', 'failed'] as const;

/** A malformed or incomplete reply is ambiguous after dispatch: NEVER authorize automatic retry. */
export function verifyDividendWriteStageReceipt(
  input: CorporateActionDividendWriteStageInput,
  candidate: unknown,
): DividendWriteStageReceiptCheck {
  if (!candidate || typeof candidate !== 'object') return { status: 'UNKNOWN_RESULT', reason: 'Missing response.' };
  const result = candidate as CorporateActionDividendWriteStageResult;
  if (result.policyVersion !== input.expectedPolicyVersion || result.scopeVersion !== input.expectedScopeVersion ||
      result.writeStageVersion !== input.expectedWriteStageVersion || result.scopeFingerprint !== input.expectedScopeFingerprint) {
    return { status: 'UNKNOWN_RESULT', reason: 'Write-stage response identity mismatch.' };
  }
  if (COUNTS.some((key) => !Number.isSafeInteger(result[key]) || result[key] < 0) ||
      result.requested !== input.importIds.length ||
      result.autoApproved + result.ineligible + result.alreadyApproved + result.staleScope + result.missing + result.failed !== result.requested ||
      result.revalidatedEligible > result.requested || typeof result.complete !== 'boolean' ||
      typeof result.message !== 'string' || !Array.isArray(result.dispositions) ||
      result.dispositions.length !== input.importIds.length) {
    return { status: 'UNKNOWN_RESULT', reason: 'Write-stage response totals are invalid.' };
  }
  const actualIds = new Set<number>();
  const perCode = new Map<string, number>();
  for (const item of result.dispositions) {
    if (!item || !Number.isSafeInteger(item.importId) || !input.importIds.includes(item.importId) || actualIds.has(item.importId) ||
        !DISPOSITIONS.has(item.disposition) || typeof item.reason !== 'string' ||
        (item.corporateActionId != null && (!Number.isSafeInteger(item.corporateActionId) || item.corporateActionId <= 0))) {
      return { status: 'UNKNOWN_RESULT', reason: 'Write-stage response contains invalid dispositions.' };
    }
    actualIds.add(item.importId);
    perCode.set(item.disposition, (perCode.get(item.disposition) ?? 0) + 1);
  }
  for (const [code, field] of [
    ['AUTO_APPROVED', 'autoApproved'], ['INELIGIBLE', 'ineligible'], ['ALREADY_APPROVED', 'alreadyApproved'],
    ['STALE_SCOPE', 'staleScope'], ['MISSING', 'missing'], ['FAILED', 'failed'],
  ] as const) {
    if ((perCode.get(code) ?? 0) !== result[field]) return { status: 'UNKNOWN_RESULT', reason: 'Disposition totals mismatch.' };
  }
  if (!result.complete || result.failed !== 0) return { status: 'UNKNOWN_RESULT', reason: 'Write-stage transaction completion unconfirmed.' };
  return { status: 'COMMITTED', result };
}
