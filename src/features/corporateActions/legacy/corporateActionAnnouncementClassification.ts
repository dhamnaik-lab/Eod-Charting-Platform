import type { CorporateActionImportRow } from '@/platform';

type Announcement = Pick<CorporateActionImportRow, 'actionType'> & Partial<Pick<CorporateActionImportRow,
  'purposeRaw' | 'cashAmount' | 'factor' | 'priceFactor' | 'ratioNum' | 'ratioDen' | 'oldFaceValue' | 'newFaceValue'>>;

// Deliberately exact: AGM + dividend/bonus/etc. must stay in the financial flow.
export function isInformationalCorporateAnnouncement(row: Announcement): boolean {
  return row.actionType === 'OTHER'
    && /^(AGM|ANNUAL GENERAL MEETING)\.?$/i.test((row.purposeRaw ?? '').trim().replace(/\s+/g, ' '))
    && [row.cashAmount, row.factor, row.priceFactor, row.ratioNum, row.ratioDen,
      row.oldFaceValue, row.newFaceValue].every(value => value == null);
}

export function needsCorporateActionClassificationRefresh(row: CorporateActionImportRow): boolean {
  if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null) return false;
  // Let the backend parser classify unfamiliar Other wording; avoid a second
  // financial-keyword grammar drifting from the canonical parser.
  return (row.actionType === 'OTHER' && !isInformationalCorporateAnnouncement(row))
    || ['SPLIT', 'BONUS'].includes(row.actionType)
    || /^(Quick-resolved|Awaiting verified historical identity evidence)/.test(row.message ?? '')
    || (row.actionType === 'DIVIDEND' &&
      (['UNSUPPORTED', 'NEEDS_REVIEW'].includes(row.reviewStatus) || row.purposeRaw.includes('%')));
}

export function hasCombinedSplitBonusAnnouncement(row: CorporateActionImportRow): boolean {
  return ['SPLIT', 'BONUS'].includes(row.actionType)
    && /\bBONUS\b/i.test(row.purposeRaw) && /\b(SPLIT|SUB[ -]?DIVISION)\b/i.test(row.purposeRaw);
}
