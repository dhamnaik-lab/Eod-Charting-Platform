import type { CorporateActionValidationReportSaveInput } from '@/platform';
import type { CorporateActionDividendPreparedScopeOutcomeState } from './corporateActionDividendPreparedScopeOrchestration';

/**
 * Builds an immutable diagnostic snapshot. The result is never a prepared scope
 * and must not be used to authorize an approval.
 */
export function buildCorporateActionValidationReportSaveInput(
  outcome: CorporateActionDividendPreparedScopeOutcomeState,
  startedAt: number,
  requestedImportIds: readonly number[],
  completedAt = new Date().toISOString(),
): CorporateActionValidationReportSaveInput {
  const result = outcome.result;
  const complete = result.complete && !result.operationalError && result.failed === 0 &&
    result.dispositions.length === result.requested;
  return {
    expectedDatabasePath: outcome.databasePath,
    operationKind: 'DIVIDEND_VALIDATION',
    requestedScope: {
      actionType: 'DIVIDEND',
      importIds: [...requestedImportIds],
      checkedImportIds: result.dispositions.map((item) => item.importId),
      generation: outcome.generation,
      operationKey: outcome.operationKey,
    },
    startedAtUtc: new Date(startedAt).toISOString(),
    completedAtUtc: completedAt,
    outcome: complete ? 'COMPLETED' : 'INCOMPLETE',
    requestedCount: result.requested,
    checkedCount: result.dispositions.length,
    eligibleCount: result.eligible,
    ineligibleCount: result.ineligible,
    alreadyApprovedCount: result.alreadyApproved,
    staleCount: result.staleScope,
    missingCount: result.missing,
    failedCount: result.failed,
    reusedCount: result.reusedCount ?? 0,
    errorMessage: result.operationalError,
    policyVersion: result.policyVersion,
    scopeVersion: result.scopeVersion,
    scopeFingerprint: outcome.wholeScopeFingerprint,
    items: result.dispositions.map((item) => ({
      importId: item.importId,
      resultCode: item.disposition,
      reasonSnapshot: item.reason,
      currentActionType: item.currentActionType,
      currentParseStatus: item.currentParseStatus,
      currentReviewStatus: item.currentReviewStatus,
      storedApprovalState: item.disposition === 'ALREADY_APPROVED'
        ? 'APPROVED'
        : item.currentReviewStatus,
      evidence: item.evidence,
    })),
  };
}
