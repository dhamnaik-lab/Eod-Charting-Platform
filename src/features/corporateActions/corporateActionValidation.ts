import type { CorporateActionImportRow, CorporateActionScanResultRow } from '@/platform';
import { indiaIsoDate } from './corporateActionDate';

export type CorporateActionIdentityLabel = 'MATCHED' | 'MATCH REQUIRED' | 'ISIN REVIEW REQUIRED' | 'REVIEW REQUIRED';
export type CorporateActionPriceValidationLabel =
  | 'STRONG MATCH'
  | 'MATCH'
  | 'NEEDS REVIEW'
  | 'NO PRICE DATA'
  | 'NOT VALIDATED';
export type CorporateActionApprovalState =
  | 'READY TO APPROVE'
  | 'NEEDS VALIDATION'
  | 'NEEDS REVIEW'
  | 'MATCH REQUIRED'
  | 'ISIN REVIEW REQUIRED'
  | 'APPROVED'
  | 'NOT APPROVABLE'
  | 'SCHEDULED / UPCOMING'
  | 'WAITING FOR EOD DATA';

const FACTOR_EPSILON = 1e-9;

export function hasRightsFinancialTerms(
  row: Partial<Pick<CorporateActionImportRow, 'ratioNum' | 'ratioDen' | 'cashAmount'>>,
): boolean {
  return [row.ratioNum, row.ratioDen, row.cashAmount]
    .every(value => typeof value === 'number' && Number.isFinite(value) && value > 0);
}

export function isSplitOrBonus(row: Pick<CorporateActionImportRow, 'actionType'>): boolean {
  return row.actionType === 'SPLIT' || row.actionType === 'BONUS';
}

export function isPriceValidatedAction(
  row: Pick<CorporateActionImportRow, 'actionType'> &
    Partial<Pick<CorporateActionImportRow, 'factor' | 'priceFactor' | 'cashAmount'>>,
): boolean {
  if (row.actionType === 'SPLIT' || row.actionType === 'BONUS' || row.actionType === 'DEMERGER') {
    return true;
  }
  return false;
}

export function getPriceMultiplier(shareFactor: number | null | undefined): number | null {
  if (shareFactor == null || !Number.isFinite(shareFactor) || shareFactor <= 0) {
    return null;
  }
  return 1 / shareFactor;
}

export function getTheoreticalExPrice(
  previousClose: number | null | undefined,
  expectedFactor: number | null | undefined,
): number | null {
  if (
    previousClose == null ||
    expectedFactor == null ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(expectedFactor) ||
    expectedFactor <= 0
  ) {
    return null;
  }
  return previousClose / expectedFactor;
}

export function getResidualGapPct(
  actualPrice: number | null | undefined,
  theoreticalPrice: number | null | undefined,
): number | null {
  if (
    actualPrice == null ||
    theoreticalPrice == null ||
    !Number.isFinite(actualPrice) ||
    !Number.isFinite(theoreticalPrice) ||
    theoreticalPrice <= 0
  ) {
    return null;
  }
  return (actualPrice / theoreticalPrice - 1) * 100;
}

export function getCorporateActionIdentityLabel(
  reviewStatus: CorporateActionImportRow['reviewStatus'],
): CorporateActionIdentityLabel {
  if (reviewStatus === 'UNRESOLVED') {
    return 'MATCH REQUIRED';
  }
  if (reviewStatus === 'PENDING_ISIN_MISMATCH') {
    return 'ISIN REVIEW REQUIRED';
  }
  if (reviewStatus === 'PENDING' || reviewStatus === 'APPROVED') {
    return 'MATCHED';
  }
  return 'REVIEW REQUIRED';
}

export function isCorporateActionScanCurrent(
  row: CorporateActionImportRow,
  scan: CorporateActionScanResultRow | null | undefined,
): boolean {
  if (!scan || scan.corporateActionImportId !== row.id) {
    return false;
  }
  if (!row.symbol || !scan.symbol || scan.symbol !== row.symbol || scan.exchange !== row.exchange) {
    return false;
  }
  if (
    row.factor == null ||
    scan.expectedFactor == null ||
    !Number.isFinite(row.factor) ||
    !Number.isFinite(scan.expectedFactor) ||
    Math.abs(row.factor - scan.expectedFactor) > FACTOR_EPSILON * Math.max(1, Math.abs(row.factor))
  ) {
    return false;
  }
  if (row.exDate && scan.exTradeDate && scan.exTradeDate < row.exDate) {
    return false;
  }
  if (row.exDate && scan.prevTradeDate && scan.prevTradeDate >= row.exDate) {
    return false;
  }
  return true;
}

export function classifyCorporateActionValidation(
  row: CorporateActionImportRow,
  scan: CorporateActionScanResultRow | null | undefined,
): CorporateActionPriceValidationLabel {
  if (!isPriceValidatedAction(row) || !isCorporateActionScanCurrent(row, scan)) {
    return 'NOT VALIDATED';
  }
  if (scan?.scanStatus === 'MATCHED') {
    return (scan.confidence ?? 0) >= 0.95 ? 'STRONG MATCH' : 'MATCH';
  }
  if (scan?.scanStatus === 'NO_PRICE_DATA') {
    return 'NO PRICE DATA';
  }
  return 'NEEDS REVIEW';
}

export function getCorporateActionApprovalState(
  row: CorporateActionImportRow,
  scan: CorporateActionScanResultRow | null | undefined,
): CorporateActionApprovalState {
  if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null) {
    return 'APPROVED';
  }
  if (row.actionType === 'RIGHTS' && !hasRightsFinancialTerms(row)) {
    return 'NOT APPROVABLE';
  }
  if (row.parseStatus !== 'PARSED' || !row.symbol) {
    return row.reviewStatus === 'UNRESOLVED' ? 'MATCH REQUIRED' : 'NOT APPROVABLE';
  }
  if (row.reviewStatus === 'UNRESOLVED') {
    return 'MATCH REQUIRED';
  }
  if (row.reviewStatus === 'PENDING_ISIN_MISMATCH') {
    return 'ISIN REVIEW REQUIRED';
  }
  if (!['SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS'].includes(row.actionType)) {
    return 'NOT APPROVABLE';
  }
  if (!isPriceValidatedAction(row)) {
    return 'READY TO APPROVE';
  }
  const validation = classifyCorporateActionValidation(row, scan);
  if (validation === 'STRONG MATCH' || validation === 'MATCH') {
    return 'READY TO APPROVE';
  }
  if (validation === 'NOT VALIDATED') {
    return 'NEEDS VALIDATION';
  }
  return 'NEEDS REVIEW';
}

export function formatCorporateActionDescription(row: CorporateActionImportRow): string {
  if (row.actionType === 'SPLIT') {
    if (row.ratioNum != null && row.ratioDen != null && row.ratioNum > 0 && row.ratioDen > 0) {
      return `${formatRatioNumber(row.ratioDen)} old → ${formatRatioNumber(row.ratioNum)} new`;
    }
    if (row.oldFaceValue != null && row.newFaceValue != null) {
      return `Face value ${formatRatioNumber(row.oldFaceValue)} → ${formatRatioNumber(row.newFaceValue)}`;
    }
  }
  if (row.actionType === 'BONUS' && row.ratioNum != null && row.ratioDen != null) {
    return `${formatRatioNumber(row.ratioNum)} bonus for every ${formatRatioNumber(row.ratioDen)} held`;
  }
  if (row.actionType === 'DEMERGER' && row.factor != null && Number.isFinite(row.factor) && row.factor > 1) {
    return `Demerger (EOD factor ${formatRatioNumber(row.factor)}x)`;
  }
  if (
    row.actionType === 'RIGHTS' &&
    (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null) &&
    row.cashAmount == null &&
    row.factor != null &&
    Number.isFinite(row.factor) &&
    row.factor > 1
  ) {
    return row.ratioNum != null && row.ratioDen != null
      ? `Rights ${formatRatioNumber(row.ratioNum)}:${formatRatioNumber(row.ratioDen)} (EOD factor ${formatRatioNumber(row.factor)}x)`
      : `Rights (EOD factor ${formatRatioNumber(row.factor)}x)`;
  }
  return row.purposeRaw;
}

function formatRatioNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

/** Normal three-step CA workflow's stricter local-EOD admission policy.
 *  Existing maintenance and historical reports retain getCorporateActionApprovalState().
 *  A scan is a readiness observation only: an ordinary approval rechecks the EOD
 *  window in Rust immediately before writing. No UI state grants write authority.
 */
export function getCorporateActionNormalApprovalState(
  row: CorporateActionImportRow,
  scan: CorporateActionScanResultRow | null | undefined,
  today = indiaIsoDate(),
): CorporateActionApprovalState | 'SCHEDULED / UPCOMING' | 'WAITING FOR EOD DATA' {
  const base = getCorporateActionApprovalState(row, scan);
  if (base === 'APPROVED' || base === 'MATCH REQUIRED' ||
      base === 'ISIN REVIEW REQUIRED' || base === 'NOT APPROVABLE') return base;
  if (!row.exDate) return 'NEEDS REVIEW';
  if (row.exDate > today) return 'SCHEDULED / UPCOMING';
  if (!scan || scan.corporateActionImportId !== row.id ||
      scan.symbol !== row.symbol || scan.exchange !== row.exchange ||
      !scan.prevTradeDate || scan.prevTradeDate >= row.exDate ||
      !scan.exTradeDate || scan.exTradeDate < row.exDate || scan.exTradeDate > today ||
      scan.prevClose == null || !Number.isFinite(scan.prevClose) || scan.prevClose <= 0 ||
      scan.exClose == null || !Number.isFinite(scan.exClose) || scan.exClose <= 0) {
    return 'WAITING FOR EOD DATA';
  }
  if (isPriceValidatedAction(row)) return base;
  // For dividends/rights the observed ex-date price drop need not match the
  // theoretical factor exactly. It establishes data availability, not terms.
  return base;
}
