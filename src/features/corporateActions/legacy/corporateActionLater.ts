import type { CorporateActionImportRow } from '@/platform';

type LaterRow = Pick<CorporateActionImportRow, 'actionType'> & Partial<Pick<CorporateActionImportRow,
  'purposeRaw' | 'instrumentIsActive' | 'reviewStatus' | 'approvedCorporateActionId'>>;

// Digits may be glued to Deb/Debs entitlement terms; Debt/Debit/Debut are words.
const NON_EQUITY_TERMS = /\b(?:DEBENTURES?|DEBS?\d*|NCRPS|CRPS|CCPS|OCPS|PREFERENCE|PREFERRED|DVR|DIFFERENTIAL VOTING)\b/;

/** Presentation/readiness grouping only: no stored status or financial eligibility change. */
export function isLaterCorporateAction(row: LaterRow): boolean {
  if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null
    || row.reviewStatus === 'CLOSED_INFORMATIONAL') return false;
  if (row.instrumentIsActive === false) return true;
  if (['DIVIDEND', 'RIGHTS', 'DEMERGER'].includes(row.actionType)) return true;
  if (/\bINTEREST\b.*\bPER UNIT\b/i.test(row.purposeRaw ?? '')) return true;
  const purpose = (row.purposeRaw ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  if (/\b(?:CAPITAL REDUCTION|REDUCTION OF (?:SHARE |EQUITY )?CAPITAL)\b/.test(purpose)) return true;
  if (/\b(?:INCOME DISTRIBUTION|DISTRIBUTION OF INCOME)\b/.test(purpose)
    || (/\b(?:INVIT|REIT|PER UNIT)\b/.test(purpose) && /\bDISTR(?:I|IT)BUTION\b/.test(purpose))) return true;
  // Security-type admission rules shared with split_bonus_terms::blocker.
  return ['SPLIT', 'BONUS'].includes(row.actionType)
    && NON_EQUITY_TERMS.test(purpose);
}

/** Only the automatic Load & Validate R1 pass defers Later rows. Manual policy APIs are unchanged. */
export function immediateCorporateActionValidationRows<T extends LaterRow>(rows: readonly T[]): T[] {
  return rows.filter(row => !isLaterCorporateAction(row));
}

/** Use recorded blockers first; fallback descriptions follow explicit row facts. */
export function deferredCorporateActionReason(row: LaterRow & { message?: string | null }, existing = ''): string {
  const specific = [row.message, existing].find(text => text && /^(Awaiting (?:official|verified (?:identity|historical)|identity)|Waiting for (?:EOD|price)|UNSUPPORTED_|INVALID_|AMBIGUOUS_)/i.test(text));
  if (specific) return specific;
  if (row.instrumentIsActive === false) return 'Delisted or inactive symbol';
  const purpose = (row.purposeRaw ?? '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ');
  if (/\b(?:INCOME DISTRIBUTION|DISTRIBUTION OF INCOME)\b/.test(purpose)
    || (/\bPER UNIT\b/.test(purpose) && /\b(?:INTEREST|DISTRIBUTION|DISTRITBUTION)\b/.test(purpose))) return 'InvIT/REIT distribution: not an equity price adjustment yet';
  if (/\b(?:CAPITAL REDUCTION|REDUCTION OF (?:SHARE |EQUITY )?CAPITAL)\b/.test(purpose)) return 'Capital reduction: rules not built yet';
  if (['SPLIT', 'BONUS'].includes(row.actionType) && NON_EQUITY_TERMS.test(purpose)) return 'Non-equity terms (debenture/preference/DVR)';
  if (row.actionType === 'DIVIDEND') return 'Dividend: verification deferred (not run in Load & Validate)';
  if (row.actionType === 'RIGHTS') return 'Rights: adjustment rules not built yet';
  if (row.actionType === 'DEMERGER') return 'Demerger: needs cost split rules';
  return row.message || existing || 'Requires review';
}
