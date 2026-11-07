import type { CorporateActionImportRow } from '@/platform';

type Announcement = Pick<CorporateActionImportRow, 'actionType'> & Partial<Pick<CorporateActionImportRow,
  'purposeRaw' | 'cashAmount' | 'factor' | 'priceFactor' | 'ratioNum' | 'ratioDen' | 'oldFaceValue' | 'newFaceValue'>>;

// Notices that never change an equity price. Each pattern matches the whole
// purpose, so AGM + dividend/bonus/split etc. stay in the financial flow.
const REVISED_NOTE = String.raw`(?:\s*\(?\s*(?:(?:PURPOSE|BC|BOOK|CLOSURE|DATES?|START|END)\s+)+REVISED\s*\)?)?`;
const INFORMATIONAL_PURPOSES: readonly RegExp[] = [
  new RegExp(String.raw`^(?:\d{1,3}(?:ST|ND|RD|TH)\s+)?(?:AGM|EGM|ANNUAL GENERAL MEETING|EXTRA[ -]?ORDINARY GENERAL MEETING)\.?${REVISED_NOTE}$`),
  new RegExp(String.raw`^ANNUAL (?:BOOK )?CLOSURE\.?${REVISED_NOTE}$`),
  /^(?:INTEREST PAYMENT|E[ -]?VOTING|NIL|BUY ?BACK(?: OF SHARES)?)\.?$/,
];

export function isInformationalCorporateAnnouncement(row: Announcement): boolean {
  const purpose = (row.purposeRaw ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  return row.actionType === 'OTHER'
    && INFORMATIONAL_PURPOSES.some(pattern => pattern.test(purpose))
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
    && /\bBON(?:US)?\b/i.test(row.purposeRaw)
    && /\b(SPLIT|SPLT|SPL|SUB[ -]?DIVISION)\b/i.test(row.purposeRaw);
}
