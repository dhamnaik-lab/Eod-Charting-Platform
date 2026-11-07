import type { CorporateActionImportRow } from '@/platform';

type LaterRow = Pick<CorporateActionImportRow, 'actionType'> & Partial<Pick<CorporateActionImportRow,
  'purposeRaw' | 'instrumentIsActive' | 'reviewStatus' | 'approvedCorporateActionId'>>;

/** Presentation/readiness grouping only: no stored status or financial eligibility change. */
export function isLaterCorporateAction(row: LaterRow): boolean {
  if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null
    || row.reviewStatus === 'CLOSED_INFORMATIONAL') return false;
  if (row.instrumentIsActive === false) return true;
  if (['DIVIDEND', 'RIGHTS', 'DEMERGER'].includes(row.actionType)) return true;
  const purpose = (row.purposeRaw ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  if (/\b(?:CAPITAL REDUCTION|REDUCTION OF (?:SHARE |EQUITY )?CAPITAL)\b/.test(purpose)) return true;
  if (/\b(?:INCOME DISTRIBUTION|DISTRIBUTION OF INCOME)\b/.test(purpose)
    || (/\b(?:INVIT|REIT|PER UNIT)\b/.test(purpose) && /\bDISTR(?:I|IT)BUTION\b/.test(purpose))) return true;
  // Security-type admission rules shared with split_bonus_terms::blocker.
  return ['SPLIT', 'BONUS'].includes(row.actionType)
    && /\b(?:DEBENTURES?|NCRPS|CRPS|CCPS|OCPS|PREFERENCE|PREFERRED|DVR|DIFFERENTIAL VOTING)\b/.test(purpose);
}

/** Only the automatic Load & Validate R1 pass defers Later rows. Manual policy APIs are unchanged. */
export function immediateCorporateActionValidationRows<T extends LaterRow>(rows: readonly T[]): T[] {
  return rows.filter(row => !isLaterCorporateAction(row));
}
