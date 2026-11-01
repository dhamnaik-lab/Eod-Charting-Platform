import type { CorporateActionImportActionType, CorporateActionImportRow, CorporateActionScanResultRow } from '@/platform';
import { classifyCorporateActionValidation, getCorporateActionApprovalState, getCorporateActionNormalApprovalState, isSplitOrBonus } from './corporateActionValidation';
import { isInformationalCorporateAnnouncement } from './legacy/corporateActionAnnouncementClassification';

export const CORPORATE_ACTION_BULK_APPROVAL_BATCH_SIZE = 100;

export type CorporateActionApprovalTargetMode = 'selected' | 'all-ready';

export function selectCorporateActionApprovalTargetRows<T extends { id: number }>(
  readyRows: T[],
  selectedImportIds: ReadonlySet<number>,
  mode: CorporateActionApprovalTargetMode,
): T[] {
  if (mode === 'all-ready') {
    return readyRows;
  }
  return readyRows.filter((row) => selectedImportIds.has(row.id));
}

export interface CorporateActionBulkApprovalProgressInput {
  total: number;
  batchNumber: number;
  batchCount: number;
  batchSize: number;
  processed: number;
}

export interface CorporateActionBulkApprovalSummaryInput {
  requested: number;
  approved: number;
  linkedExisting: number;
  alreadyApproved: number;
  failed: number;
  batchCount: number;
}

export function chunkCorporateActionApprovalIds(
  importIds: number[],
  batchSize = CORPORATE_ACTION_BULK_APPROVAL_BATCH_SIZE,
): number[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error('Corporate Action bulk approval batch size must be a positive integer.');
  }

  const seen = new Set<number>();
  const normalized = importIds.filter((importId) => {
    if (!Number.isSafeInteger(importId) || importId <= 0 || seen.has(importId)) {
      return false;
    }
    seen.add(importId);
    return true;
  });

  const batches: number[][] = [];
  for (let offset = 0; offset < normalized.length; offset += batchSize) {
    batches.push(normalized.slice(offset, offset + batchSize));
  }
  return batches;
}

export function formatCorporateActionBulkApprovalProgress({
  total,
  batchNumber,
  batchCount,
  batchSize,
  processed,
}: CorporateActionBulkApprovalProgressInput): string {
  return `Approving ${total} corporate-action row(s)... Batch ${batchNumber}/${batchCount}: ${batchSize} row(s); ${processed}/${total} processed.`;
}

export function formatCorporateActionBulkApprovalSummary({
  requested,
  approved,
  linkedExisting,
  alreadyApproved,
  failed,
  batchCount,
}: CorporateActionBulkApprovalSummaryInput): string {
  return `Bulk approval completed: ${requested} requested in ${batchCount} batch(es); ${approved} approved, ${linkedExisting} linked existing, ${alreadyApproved} already approved, ${failed} failed. Raw EOD prices were not changed.`;
}

/** Presentation category only. Stored action types and approval policy are unchanged. */
export function expandOfficialImportActionTypes(types: CorporateActionImportActionType[]): CorporateActionImportActionType[] {
  const result = [...new Set(types)];
  if (result.includes('DEMERGER') || result.includes('OTHER')) {
    if (!result.includes('DEMERGER')) result.push('DEMERGER');
    if (!result.includes('OTHER')) result.push('OTHER');
  }
  return result;
}

export function officialImportUserStatus(
  row: CorporateActionImportRow,
  scan: CorporateActionScanResultRow | undefined,
  preparationError: string | undefined,
  preparationComplete: boolean,
  explicitApprovalOnly = false,
): string {
  if (!preparationComplete) return 'Load & Prepare required';
  if (preparationError) return 'Could not check';
  if (row.reviewStatus !== 'APPROVED' && row.approvedCorporateActionId == null
    && isInformationalCorporateAnnouncement(row)) return 'Informational (no adjustment)';
  if (row.reviewStatus !== 'APPROVED' && row.parseStatus !== 'PARSED') {
    if (row.actionType === 'DIVIDEND' && row.purposeRaw.includes('%')) return 'Awaiting verified cash amount and face-value basis';
    return 'Awaiting verified announcement terms';
  }
  // A verified historical price-route can be blocked by identity provenance
  // rather than absent EOD bars. Preserve the backend's exact diagnostic
  // instead of mislabelling this case as missing prices.
  if (explicitApprovalOnly && scan?.corporateActionImportId === row.id &&
      scan.scanStatus === 'NEEDS_REVIEW' &&
      scan.message?.startsWith('Awaiting verified dated price-route identity:')) {
    return 'Awaiting verified identity evidence';
  }
  const validation = isSplitOrBonus(row) ? classifyCorporateActionValidation(row, scan) : 'NOT VALIDATED';
  const approval = explicitApprovalOnly
    ? getCorporateActionNormalApprovalState(row, scan)
    : getCorporateActionApprovalState(row, scan);
  if (approval === 'READY TO APPROVE') return explicitApprovalOnly ? 'Ready to approve' : 'Ready to apply';
  if (approval === 'SCHEDULED / UPCOMING') return 'Scheduled / Upcoming';
  if (approval === 'WAITING FOR EOD DATA') return 'Waiting for EOD Data';
  if (approval === 'MATCH REQUIRED' || approval === 'ISIN REVIEW REQUIRED') return 'Awaiting verified identity evidence';
  if (validation === 'NO PRICE DATA') return 'Waiting for price data';
  if (approval === 'NEEDS VALIDATION') return 'Could not check';
  if (approval === 'NEEDS REVIEW') return 'Price mismatch — app verification required';
  if (approval === 'APPROVED') return 'Applied';
  return 'Not approvable';
}

export function summarizeOfficialImportReadiness(
  rows: CorporateActionImportRow[],
  scans: ReadonlyMap<number, CorporateActionScanResultRow>,
  errors: Readonly<Record<number, string>>,
  complete: boolean,
  explicitApprovalOnly = false,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const label = officialImportUserStatus(row, scans.get(row.id), errors[row.id], complete, explicitApprovalOnly);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  return counts;
}

/** The grouped pending view renders event identity details only for the opened review row. */
export function selectCorporateActionIdentityDetailIds(
  rows: CorporateActionImportRow[], groupedPendingReview: boolean, reviewImportId: number | null,
): number[] {
  if (!groupedPendingReview) return rows.map((row) => row.id);
  return reviewImportId != null && rows.some((row) => row.id === reviewImportId) ? [reviewImportId] : [];
}
