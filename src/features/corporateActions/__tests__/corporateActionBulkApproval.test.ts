import { describe, expect, it } from 'vitest';
import {
  chunkCorporateActionApprovalIds,
  CORPORATE_ACTION_BULK_APPROVAL_BATCH_SIZE,
  formatCorporateActionBulkApprovalProgress,
  formatCorporateActionBulkApprovalSummary,
  selectCorporateActionApprovalTargetRows,
} from '../corporateActionBulkApproval';

describe('corporateActionBulkApproval', () => {

  it('targets every ready row for Approve All Ready without requiring manual selection', () => {
    const readyRows = Array.from({ length: 242 }, (_, index) => ({ id: index + 1 }));
    const targets = selectCorporateActionApprovalTargetRows(readyRows, new Set<number>(), 'all-ready');

    expect(targets).toHaveLength(242);
    expect(targets.map((row) => row.id)).toEqual(readyRows.map((row) => row.id));
    expect(chunkCorporateActionApprovalIds(targets.map((row) => row.id)).map((batch) => batch.length)).toEqual([100, 100, 42]);
  });

  it('keeps partial manual selection available for targeted approval', () => {
    const readyRows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    expect(selectCorporateActionApprovalTargetRows(readyRows, new Set([2, 4]), 'selected')).toEqual([{ id: 2 }, { id: 4 }]);
  });
  it('chunks 243 selected imports into backend-safe batches of 100, 100, and 43', () => {
    const ids = Array.from({ length: 243 }, (_, index) => index + 1);
    const batches = chunkCorporateActionApprovalIds(ids);

    expect(CORPORATE_ACTION_BULK_APPROVAL_BATCH_SIZE).toBe(100);
    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 43]);
    expect(batches.every((batch) => batch.length <= 100)).toBe(true);
    expect(batches.flat()).toEqual(ids);
  });

  it('deduplicates IDs and ignores invalid IDs without reordering valid selections', () => {
    expect(chunkCorporateActionApprovalIds([5, 5, 0, -1, 2, Number.NaN, 7], 2)).toEqual([[5, 2], [7]]);
  });

  it('reports batch progress with processed and total counts', () => {
    expect(
      formatCorporateActionBulkApprovalProgress({
        total: 243,
        batchNumber: 2,
        batchCount: 3,
        batchSize: 100,
        processed: 100,
      }),
    ).toBe('Approving 243 corporate-action row(s)... Batch 2/3: 100 row(s); 100/243 processed.');
  });

  it('summarizes aggregate results across all batches and preserves raw-price wording', () => {
    expect(
      formatCorporateActionBulkApprovalSummary({
        requested: 243,
        approved: 230,
        linkedExisting: 5,
        alreadyApproved: 3,
        failed: 5,
        batchCount: 3,
      }),
    ).toBe(
      'Bulk approval completed: 243 requested in 3 batch(es); 230 approved, 5 linked existing, 3 already approved, 5 failed. Raw EOD prices were not changed.',
    );
  });
});
