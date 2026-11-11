import type {
  CorporateActionDividendPreparedScopeEvaluationDisposition,
  CorporateActionImportRow,
  CorporateActionScanResultRow,
} from '@/platform';
import {
  getCorporateActionApprovalState,
  getCorporateActionNormalApprovalState,
} from '../corporateActionValidation';
import { isLaterCorporateAction } from './corporateActionLater';

export interface OfficialCorporateActionReadinessContext {
  officialPreparationComplete: boolean;
  officialPreparationErrors: Readonly<Record<number, string>>;
  existingDividendByImportId?: Readonly<Record<number, { row?: CorporateActionImportRow } | undefined>>;
  latestScanByImportId: ReadonlyMap<number, CorporateActionScanResultRow>;
  dividendPreparedImportIds: ReadonlySet<number>;
  officialDividendPreparedScopeDispositionByImportId: ReadonlyMap<
    number,
    CorporateActionDividendPreparedScopeEvaluationDisposition
  >;
  today?: string;
}

export function isApprovableCorporateImport(
  row: CorporateActionImportRow,
  scan?: CorporateActionScanResultRow,
): boolean {
  return getCorporateActionApprovalState(row, scan) === 'READY TO APPROVE';
}

/**
 * Pure runtime evaluator for whether an official Corporate Action import row
 * is Ready to Approve in the active Corporate Actions dialog (`DatabaseToolsDialogs.tsx`).
 *
 * Enforces parity between Classic and Advanced Pending Review:
 * - Deferred (`Later`) rows (`RIGHTS`, `DEMERGER`, non-equity Split/Bonus, inactive
 *   symbols without `verifiedAdjustmentTarget`) are never Ready in the normal workflow.
 * - `DIVIDEND` rows require membership in the current verified Dividend R1 prepared scope
 *   plus an `ELIGIBLE` disposition with non-null evidence.
 * - `SPLIT` and `BONUS` rows require `READY TO APPROVE` from `getCorporateActionNormalApprovalState`.
 */
export function evaluateOfficialCorporateActionRowReadiness(
  row: CorporateActionImportRow,
  context: OfficialCorporateActionReadinessContext,
): boolean {
  if (context.existingDividendByImportId?.[row.id]?.row === row) return false;
  if (!context.officialPreparationComplete || context.officialPreparationErrors[row.id]) return false;
  if (row.actionType !== 'DIVIDEND') {
    if (isLaterCorporateAction(row)) return false;
    return (
      getCorporateActionNormalApprovalState(
        row,
        context.latestScanByImportId.get(row.id),
        context.today,
      ) === 'READY TO APPROVE'
    );
  }
  const disposition = context.officialDividendPreparedScopeDispositionByImportId.get(row.id);
  return (
    Boolean(context.dividendPreparedImportIds.has(row.id)) &&
    row.parseStatus === 'PARSED' &&
    row.reviewStatus === 'PENDING' &&
    disposition?.disposition === 'ELIGIBLE' &&
    disposition.evidence != null
  );
}

/**
 * Selects the subset of visible import rows eligible for explicit user approval
 * (`Approve All Ready` / `Approve Selected`).
 */
export function selectEligibleOfficialImportRows(
  visibleImportRows: readonly CorporateActionImportRow[],
  context: OfficialCorporateActionReadinessContext,
): CorporateActionImportRow[] {
  return visibleImportRows.filter(
    (row) =>
      context.officialPreparationComplete &&
      !context.officialPreparationErrors[row.id] &&
      evaluateOfficialCorporateActionRowReadiness(row, context) &&
      (row.actionType === 'DIVIDEND' ||
        row.actionType === 'RIGHTS' ||
        isApprovableCorporateImport(row, context.latestScanByImportId.get(row.id))),
  );
}

/**
 * Evaluates Classic Pending Review row readiness (`classicRows` in `DatabaseToolsDialogs.tsx`)
 * and guarantees parity with `evaluateOfficialCorporateActionRowReadiness`.
 */
export function isClassicCorporateActionRowReady(
  row: CorporateActionImportRow,
  context: OfficialCorporateActionReadinessContext & { busy?: boolean },
): boolean {
  if (context.busy) return false;
  const existing =
    context.existingDividendByImportId?.[row.id]?.row === row
      ? context.existingDividendByImportId[row.id]
      : undefined;
  if (existing) return false;
  if (row.actionType !== 'DIVIDEND' && isLaterCorporateAction(row)) return false;
  return evaluateOfficialCorporateActionRowReadiness(row, context);
}
