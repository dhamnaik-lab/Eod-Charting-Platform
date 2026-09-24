import { describe, expect, it } from 'vitest';
import { ReconciliationSession, normalizeReconciliationIds, saveReconciliationExport } from '../reconciliation/corporateActionReconciliationPreflight';
import type { CorporateActionReconciliationPreflightResult as Result } from '@/platform';

function result(ids: number[], token: string, path = 'E:/TEST'): Result {
  return { version: 'CA_RECONCILIATION_PREFLIGHT_V1', status: 'COMPLETE', requestToken: token,
    generatedAt: '2026-09-23T17:00:00+05:30', databaseContext: {
      canonicalDatabasePath: path, databaseFileIdentity: 'db', schemaFingerprint: 'schema',
      readContext: 'CONSISTENT_READ_TRANSACTION', selectionSource: 'EXISTING_CACHED_ACTIVE_FOLDER', buildIdentity: 'test',
    }, selection: { requestedCount: ids.length, uniqueCount: ids.length, duplicateCount: 0, uniqueImportIds: ids, idSetFingerprint: 'ids' },
    fingerprint: 'batch', readOnly: true, executedRepairs: 0, approvalWrites: 0,
    rows: ids.map((id) => ({ importId: id, outcome: 'EVIDENCE_BLOCKED', repairPlan: [], blocksInScopeCompleteness: true } as unknown as Result['rows'][number])),
    globalBlockers: [], summary: { accountedFor: ids.length, outcomeCounts: {
      ALREADY_LINKED_REVIEW: 0, READY_FOR_EXISTING_APPROVAL_RECHECK: 0, REPAIR_CANDIDATE: 0,
      EVIDENCE_BLOCKED: ids.length, DEFERRED_SCOPE: 0, CLASSIFICATION_REVIEW: 0, MISSING_IMPORT: 0, PREPARATION_ERROR: 0,
    }, inScopeBlockedRows: ids.length, applicabilityUnknownRows: 0, deferredRows: 0, coverageCertification: 'NOT_ASSESSED', databaseComplete: false },
  };
}

describe('R1-A diagnostic request ownership', () => {
  it('validates empty, unsafe, zero, fractional and excessive IDs without truncation', () => {
    for (const ids of [[], [0], [-1], [1.2], [NaN], [Infinity], [Number.MAX_SAFE_INTEGER + 1], Array(501).fill(1)]) {
      expect(() => normalizeReconciliationIds(ids)).toThrow();
    }
    expect(normalizeReconciliationIds([4, 4, 9])).toEqual([4, 9]);
    expect(normalizeReconciliationIds(Array.from({ length: 500 }, (_, i) => i + 1))).toHaveLength(500);
  });
  it('discards an A-B-A response even after returning to the same path', () => {
    const s = new ReconciliationSession(); s.changeScope('E:/TEST', [1], 0);
    const req = s.begin(); s.changeScope('E:/OTHER', [1], 1); s.changeScope('E:/TEST', [1], 2);
    expect(s.adopt(req, result([1], req.requestToken))).toBe(false);
    expect(s.current()).toBe(null);
  });
  it('a newer preview, scope change or close invalidates delayed results', () => {
    const s = new ReconciliationSession(); s.changeScope('E:/TEST', [1, 2], 0);
    const first = s.begin(); const next = s.begin();
    expect(s.adopt(first, result([1, 2], first.requestToken))).toBe(false);
    expect(s.adopt(next, result([1, 2], next.requestToken))).toBe(true);
    s.changeScope('E:/TEST', [2], 0); expect(s.current()).toBe(null);
    const third = s.begin(); s.close(); expect(s.adopt(third, result([2], third.requestToken))).toBe(false);
  });
  it('same-path database change event invalidates current export', () => {
    const s = new ReconciliationSession(); s.changeScope('E:/TEST', [1], 0); const r = s.begin();
    expect(s.adopt(r, result([1], r.requestToken))).toBe(true);
    s.invalidate(); expect(s.current()).toBe(null);
  });
  it('rejects wrong tokens, wrong database, missing results and duplicate results', () => {
    for (const kind of ['token', 'path', 'missing', 'duplicate', 'summary', 'writes']) {
      const s = new ReconciliationSession(); s.changeScope('E:/TEST', [1], 0); const r = s.begin(); const data = result([1], r.requestToken);
      if (kind === 'token') data.requestToken = 'different';
      if (kind === 'path') data.databaseContext!.canonicalDatabasePath = 'E:/OTHER';
      if (kind === 'missing') data.rows = [];
      if (kind === 'duplicate') data.rows.push(data.rows[0]);
      if (kind === 'summary') data.summary.accountedFor = 10;
      if (kind === 'writes') (data as unknown as { approvalWrites: number }).approvalWrites = 1;
      expect(s.adopt(r, data)).toBe(false); expect(s.current()).toBe(null);
    }
  });
  it('a rejected response or failed request cannot expose prior success as current', () => {
    const s = new ReconciliationSession(); s.changeScope('E:/TEST', [1], 0); const a = s.begin(); s.adopt(a, result([1], a.requestToken));
    const b = s.begin(); expect(s.current()).toBe(null);
    const rejected = result([1], b.requestToken); rejected.status = 'REJECTED';
    expect(s.adopt(b, rejected)).toBe(false); s.fail(b); expect(s.current()).toBe(null);
  });
  it('partial rows remain accounted for and selectable independently of approval', () => {
    const s = new ReconciliationSession(); s.changeScope('E:/TEST', [1], 0); const r = s.begin(); const data = result([1], r.requestToken); data.status = 'PARTIAL';
    expect(s.adopt(r, data)).toBe(true); expect(s.current()!.rows[0].importId).toBe(1);
  });
  it('cancellation and thrown save errors are not success', async () => {
    const payload = { content: '\ufeffx\r\n', defaultExtension: 'csv' as const, rowCount: 1 };
    expect(await saveReconciliationExport({ saveTextExport: async () => ({ success: false, filePath: null }) }, payload)).toBe('CANCELLED');
    expect(await saveReconciliationExport({ saveTextExport: async () => ({ success: true, filePath: 'report.csv' }) }, payload)).toBe('SAVED');
    await expect(saveReconciliationExport({ saveTextExport: async () => { throw new Error('denied'); } }, payload)).rejects.toThrow('denied');
  });
});
