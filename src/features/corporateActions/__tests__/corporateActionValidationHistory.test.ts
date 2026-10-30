import { describe, expect, it } from 'vitest';
import { buildCorporateActionValidationReportSaveInput } from '../legacy/corporateActionValidationHistory';
import type { CorporateActionDividendPreparedScopeOutcomeState } from '../legacy/corporateActionDividendPreparedScopeOrchestration';

function outcome(): CorporateActionDividendPreparedScopeOutcomeState {
  return {
    databasePath: 'E:/db',
    generation: 7,
    operationKey: 'operation-7',
    wholeScopeFingerprint: 'whole-fingerprint',
    result: {
      requested: 2,
      eligible: 1,
      ineligible: 1,
      alreadyApproved: 0,
      staleScope: 0,
      missing: 0,
      failed: 0,
      dispositions: [
        { importId: 11, disposition: 'ELIGIBLE', reason: 'Eligible.', currentActionType: 'DIVIDEND',
          currentParseStatus: 'PARSED', currentReviewStatus: 'PENDING', evidence: null },
        { importId: 12, disposition: 'INELIGIBLE', reason: 'Blocked.', currentActionType: 'DIVIDEND',
          currentParseStatus: 'PARSED', currentReviewStatus: 'PENDING', evidence: null },
      ],
      batchCount: 1,
      completedBatchCount: 1,
      complete: true,
      operationalError: null,
      policyVersion: 'AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1',
      scopeVersion: 'CA_DIVIDEND_PREPARED_SCOPE_R1',
    },
  };
}

describe('Corporate Action validation history snapshot', () => {
  it('persists reuse separately within the compatibility-checked result count', () => {
    const saved = outcome();
    saved.result.reusedCount = 2;
    const input = buildCorporateActionValidationReportSaveInput(saved, 0, [11, 12], '1970-01-01T00:00:01.000Z');
    expect(input.checkedCount).toBe(2);
    expect(input.reusedCount).toBe(2);
    expect(input.items).toHaveLength(2);
  });
  it('maps a complete read-only outcome without creating approval authority', () => {
    const input = buildCorporateActionValidationReportSaveInput(
      outcome(),
      Date.parse('2026-10-25T18:00:00.000Z'),
      [11, 12],
      '2026-10-25T18:00:02.000Z',
    );

    expect(input.outcome).toBe('COMPLETED');
    expect(input.checkedCount).toBe(2);
    expect(input.items.map((item) => item.storedApprovalState)).toEqual(['PENDING', 'PENDING']);
    expect(input.requestedScope).toMatchObject({ actionType: 'DIVIDEND', importIds: [11, 12] });
  });

  it('labels partial evidence incomplete and retains the operational error', () => {
    const partial = outcome();
    partial.result.complete = false;
    partial.result.operationalError = 'Batch 2 did not finish.';
    partial.result.requested = 3;
    const input = buildCorporateActionValidationReportSaveInput(partial, 0, [11, 12, 13], '1970-01-01T00:00:01.000Z');

    expect(input.outcome).toBe('INCOMPLETE');
    expect(input.requestedCount).toBe(3);
    expect(input.checkedCount).toBe(2);
    expect(input.errorMessage).toBe('Batch 2 did not finish.');
  });
});
