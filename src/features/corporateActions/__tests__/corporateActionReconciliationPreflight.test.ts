import { describe, expect, it } from 'vitest';
import { ReconciliationSession, ReconciliationBatchSession, normalizeReconciliationIds, saveReconciliationExport } from '../reconciliation/corporateActionReconciliationPreflight';
import type { CorporateActionReconciliationPreflightResult as Result } from '@/platform';

function result(ids: number[], token: string, path = 'E:/TEST'): Result {
  return { version: 'CA_RECONCILIATION_PREFLIGHT_V1', status: 'COMPLETE', requestToken: token,
    generatedAt: '2026-09-23T17:00:00+05:30', databaseContext: {
      canonicalDatabasePath: path, databaseFileIdentity: 'db', schemaFingerprint: 'schema',
      readContext: 'CONSISTENT_READ_TRANSACTION', selectionSource: 'EXISTING_CACHED_ACTIVE_FOLDER', buildIdentity: 'test',
    }, selection: { requestedCount: ids.length, uniqueCount: ids.length, duplicateCount: 0, uniqueImportIds: ids, idSetFingerprint: 'ids' },
    fingerprint: 'batch', readOnly: true, executedRepairs: 0, approvalWrites: 0,
    rows: ids.map((id) => ({ importId: id, outcome: 'EVIDENCE_BLOCKED', repairPlan: [], blocksInScopeCompleteness: true,
      ordinaryReadiness: { state: 'BLOCKED', message: 'Review evidence' }, blockers: [] } as unknown as Result['rows'][number])),
    globalBlockers: [], summary: { accountedFor: ids.length, outcomeCounts: {
      ALREADY_LINKED_REVIEW: 0, READY_FOR_EXISTING_APPROVAL_RECHECK: 0, REPAIR_CANDIDATE: 0,
      EVIDENCE_BLOCKED: ids.length, DEFERRED_SCOPE: 0, CLASSIFICATION_REVIEW: 0, MISSING_IMPORT: 0, PREPARATION_ERROR: 0,
    }, inScopeBlockedRows: ids.length, applicabilityUnknownRows: 0, deferredRows: 0, coverageCertification: 'NOT_ASSESSED', databaseComplete: false },
  };
}

describe('R1-A diagnostic request ownership', () => {
  it('rejects a ready label that contradicts a blocking finding', () => {
    const session = new ReconciliationSession(); session.changeScope('E:/TEST', [1], 0);
    const request = session.begin(); const data = result([1], request.requestToken);
    data.rows[0].ordinaryReadiness.state = 'READY_FOR_WRITER_RECHECK';
    data.rows[0].blockers = [{ code: 'CLASSIFICATION_CONFLICT', stage: 'TERMS', severity: 'BLOCKING',
      message: 'Conflicting terms', nextOperation: 'Review official terms', evidence: [], retryableReadOnly: true }];
    expect(session.adopt(request, data)).toBe(false);
    expect(session.current()).toBe(null);
  });
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

describe('large read-only diagnostic reports', () => {
  it('accounts for 14045 unique IDs in 29 sequential requests without changing the backend limit', async () => {
    const ids=Array.from({length:14045},(_,i)=>i+1);const session=new ReconciliationBatchSession();
    session.changeScope('E:/TEST',[...ids,1],0);
    const calls:number[][]=[];let active=0;let maximum=0;
    const report=await session.run({previewSplitBonusReconciliation:async request=>{
      active++;maximum=Math.max(maximum,active);calls.push(request.importIds);
      await Promise.resolve();active--;return result(request.importIds,request.requestToken);
    }},()=>{});
    expect(calls).toHaveLength(29);expect(calls.at(-1)).toHaveLength(45);
    expect(calls.every(ids=>ids.length<=500)).toBe(true);expect(maximum).toBe(1);
    expect(calls.flat()).toEqual(ids);expect(report?.status).toBe('COMPLETE');
    expect(report?.requestedIds).toEqual(ids);expect(report?.batches.flatMap(batch=>batch.rows).length).toBe(14045);
  });
  it('keeps completed batches and marks cancellation without starting another request', async () => {
    const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',Array.from({length:501},(_,i)=>i+1),0);
    let calls=0;
    const report=await session.run({previewSplitBonusReconciliation:async request=>{
      calls++;return result(request.importIds,request.requestToken);
    }},()=>session.cancel());
    expect(calls).toBe(1);expect(report?.status).toBe('CANCELLED');
    expect(report?.batches[0].rows).toHaveLength(500);expect(report?.requestedIds).toHaveLength(501);
  });
  it('discards an in-flight batch after cancellation', async () => {
    const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',[1],0);
    const report=await session.run({previewSplitBonusReconciliation:async request=>{
      session.cancel();return result(request.importIds,request.requestToken);
    }},()=>{});
    expect(report?.status).toBe('CANCELLED');expect(report?.batches).toEqual([]);
  });
  it('retains explicit partial coverage on transport failure and never claims complete', async () => {
    const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',Array.from({length:501},(_,i)=>i+1),0);
    let calls=0;
    const report=await session.run({previewSplitBonusReconciliation:async request=>{
      if(++calls===2)throw new Error('read failed');return result(request.importIds,request.requestToken);
    }},()=>{});
    expect(report?.status).toBe('FAILED');expect(report?.message).toContain('read failed');expect(report?.batches).toHaveLength(1);
  });
  it('invalidates all results on database/schema/build drift between batches', async () => {
    for(const field of ['canonicalDatabasePath','databaseFileIdentity','schemaFingerprint','buildIdentity'] as const){
      const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',Array.from({length:501},(_,i)=>i+1),0);
      let calls=0;
      const report=await session.run({previewSplitBonusReconciliation:async request=>{
        const data=result(request.importIds,request.requestToken);if(++calls===2)data.databaseContext![field]='changed';return data;
      }},()=>{});
      expect(report).toBe(null);expect(session.current()).toBe(null);
    }
  });
  it('rejects delayed responses after scope changes, same-path events and close', async () => {
    for(const change of ['scope','event','close']){
      const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',[1],0);
      const report=await session.run({previewSplitBonusReconciliation:async request=>{
        if(change==='scope')session.changeScope('E:/OTHER',[1],1);
        else if(change==='event')session.invalidate();else session.close();
        return result(request.importIds,request.requestToken);
      }},()=>{});
      expect(report).toBe(null);expect(session.current()).toBe(null);
    }
  });
  it('preserves backend partial results and rejects malformed batch accounting', async () => {
    for(const malformed of [false,true]){
      const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',[1],0);
      const report=await session.run({previewSplitBonusReconciliation:async request=>{
        const data=result(request.importIds,request.requestToken);data.status='PARTIAL';if(malformed)data.rows=[];return data;
      }},()=>{});
      expect(report?.status).toBe(malformed?'FAILED':'PARTIAL');
    }
  });
  it('a delayed older preview cannot replace a newer report', async () => {
    const session=new ReconciliationBatchSession();session.changeScope('E:/TEST',[1],0);
    let finish!:()=>void;
    const older=session.run({previewSplitBonusReconciliation:request=>new Promise(resolve=>{
      finish=()=>resolve(result(request.importIds,request.requestToken));
    })},()=>{});
    const newer=await session.run({previewSplitBonusReconciliation:async request=>result(request.importIds,request.requestToken)},()=>{});
    finish();expect(await older).toBe(null);expect(session.current()).toBe(newer);
  });
});
