import assert from 'node:assert/strict';
import { describe, it } from 'vitest';
import type { CorporateActionImportRow, CorporateActionImportResolutionHint, CorporateActionScanResultRow, CorporateActionImportBulkApprovalInput, CorporateActionResult } from '@/platform';
import * as operations from '../legacy/corporateActionImportOperations';
import * as presentation from '../corporateActionBulkApproval';

function row(id: number, overrides: Partial<CorporateActionImportRow> = {}): CorporateActionImportRow {
  return { id, exchange: 'NSE', source: 'OFFICIAL', sourceFile: null, symbol: `S${id}`, isin: null,
    bseScripCode: null, companyName: `Company ${id}`, purposeRaw: 'Dividend', exDate: '2026-09-01',
    recordDate: null, actionType: 'DIVIDEND', ratioNum: null, ratioDen: null, oldFaceValue: null,
    newFaceValue: null, cashAmount: 1, factor: null, priceFactor: null, parseStatus: 'PARSED',
    reviewStatus: 'PENDING', message: null, approvedCorporateActionId: null, importedAt: '2026-09-01',
    approvedAt: null, evidenceCount: 1, evidenceSources: ['OFFICIAL'], latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null, latestEvidenceNote: null, ...overrides };
}
function hint(importId: number): CorporateActionImportResolutionHint {
  return { importId, status: 'NONE_ACTIVE', quickResolvable: false, activeSuggestionCount: 0,
    totalSuggestionCount: 0, topSuggestionSymbol: null, topSuggestionExchange: null,
    recommendedIsinException: false, recommendationReason: null, message: 'Not an automatic match' };
}
function preparationApi(rows: CorporateActionImportRow[]) {
  return {
    listCorporateActionImports: async () => rows,
    listCorporateActionImportResolutionHints: async ({ importIds }: { importIds: number[] }) => ({
      requested: importIds.length, hints: importIds.map(hint), message: '' }),
    quickResolveCorporateActionImport: async () => { throw new Error('Must not auto-resolve ambiguous identity'); },
    runCorporateActionScan: async () => ({ scanRun: null, results: [] as CorporateActionScanResultRow[] }),
    autoApproveCorporateActionImports: async () => ({ requested:0,eligible:0,autoApproved:0,linkedExisting:0,alreadyApproved:0,skipped:0,failed:0,dispositions:[],policyVersion:'AUTO_APPROVAL_SAFE_V2',message:'' }),
    getSetting: async () => 'false',
  };
}

describe('Official Imports FIX2 preparation and presentation', () => {
  it('reports completed hint batches even when none of 205 rows can be auto-resolved', async () => {
    const progress: operations.CorporateActionPendingPreparationProgress[] = [];
    const api = preparationApi(Array.from({length:205}, (_, i) => row(i+1,{reviewStatus:'UNRESOLVED'})));
    const result = await operations.prepareCorporateActionPendingImports({api, expectedDatabasePath:'E:\\TEST-ONLY-FIXTURE', onProgress: p => progress.push(p)});
    assert.equal(result.rows.length,205);
    assert.deepEqual(progress.filter(p => p.stage === 'matching' && p.completed > 0).map(p => p.completed), [100,200,205]);
    assert.equal(result.errors.length,0);
  });
  it('does not report an in-flight hint batch as completed', async () => {
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release=resolve; });
    let entered!: () => void;
    const enteredPromise = new Promise<void>(resolve => {entered=resolve;});
    const api = preparationApi([row(1,{reviewStatus:'UNRESOLVED'})]);
    api.listCorporateActionImportResolutionHints = async ({importIds}) => {entered(); await waiting; return {requested:1,hints:importIds.map(hint),message:''};};
    const events: operations.CorporateActionPendingPreparationProgress[] = [];
    const task = operations.prepareCorporateActionPendingImports({api,expectedDatabasePath:'E:\\TEST-ONLY-FIXTURE',onProgress:p=>events.push(p)});
    await enteredPromise;
    assert.equal(events.filter(p=>p.stage==='matching').at(-1)?.completed,0);
    release(); await task;
    assert.equal(events.filter(p=>p.stage==='matching').at(-1)?.completed,1);
  });
  it('reports a completed final validation batch and separates failed checks', async () => {
    const api = preparationApi([row(1,{actionType:'SPLIT',factor:2})]);
    api.runCorporateActionScan = async () => {throw new Error('fixture validation failed');};
    const events: operations.CorporateActionPendingPreparationProgress[]=[];
    const result=await operations.prepareCorporateActionPendingImports({api,expectedDatabasePath:'E:\\TEST-ONLY-FIXTURE',onProgress:p=>events.push(p)});
    assert.equal(events.filter(p=>p.stage==='validating').at(-1)?.completed,1);
    assert.equal(result.errors[0].importId,1);
    assert.match(events.filter(p=>p.stage==='validating').at(-1)!.message,/failed|could not/i);
  });
  it('includes OTHER and DEMERGER in the visible Other category without altering source action types', () => {
    assert.equal(typeof presentation.expandOfficialImportActionTypes,'function');
    const input: CorporateActionImportRow['actionType'][]=['SPLIT','DEMERGER'];
    assert.deepEqual(presentation.expandOfficialImportActionTypes(input),['SPLIT','DEMERGER','OTHER']);
    assert.deepEqual(input,['SPLIT','DEMERGER']);
    assert.deepEqual(presentation.expandOfficialImportActionTypes(['DIVIDEND']),['DIVIDEND']);
  });
  it('explains mixed blocked groups without making unsupported actions selectable', () => {
    assert.equal(typeof presentation.summarizeOfficialImportReadiness,'function');
    const rows=[row(1),row(2,{reviewStatus:'UNRESOLVED'}),row(3,{actionType:'OTHER',reviewStatus:'UNSUPPORTED'}),row(4)];
    const counts=presentation.summarizeOfficialImportReadiness(rows,new Map(),{4:'check failed'},true);
    assert.equal(counts['Ready to apply'],1);
    assert.equal(counts['Awaiting verified identity evidence'],1);
    assert.equal(counts['Not approvable'],1);
    assert.equal(counts['Could not check'],1);
    assert.equal(Object.values(counts).reduce((a,b)=>a+b,0),4);
  });
  it('explains missing percentage cash evidence and price mismatches as app checks', () => {
    const percent = row(8,{actionType:'DIVIDEND',purposeRaw:'Dividend 24%',parseStatus:'NEEDS_REVIEW',reviewStatus:'NEEDS_REVIEW',cashAmount:null});
    assert.equal(presentation.officialImportUserStatus(percent,undefined,undefined,true,true),'Awaiting verified cash amount and face-value basis');
    const split = row(9,{actionType:'SPLIT',reviewStatus:'PENDING_ISIN_MISMATCH',factor:2});
    assert.equal(presentation.officialImportUserStatus(split,undefined,undefined,true,true),'Awaiting verified identity evidence');
  });
});

const db='E:\\TEST-ONLY-FIXTURE';
function fingerprint(r: CorporateActionImportRow, scan?: CorporateActionScanResultRow) {
  return JSON.stringify([r.id,r.reviewStatus,r.cashAmount,r.evidenceCount,scan?.scanStatus??null,scan?.scannedAt??null]);
}
function lookupApi(rows: CorporateActionImportRow[], calls: number[][]) {
  return {
    getCorporateActionImportsByIds: async ({importIds,expectedDatabasePath}: {importIds:number[];expectedDatabasePath:string}) => {
      assert.equal(expectedDatabasePath,db);calls.push(importIds);
      return importIds.flatMap(id=>rows.filter(r=>r.id===id));
    },
    listCorporateActionScanResults: async () => ({results:[] as CorporateActionScanResultRow[],scanRun:null}),
  };
}
function recheckInput(rows: CorporateActionImportRow[], calls: number[][]) {
  return {api:lookupApi(rows,calls),importIds:rows.map(r=>r.id),expectedDatabasePath:db,
    fingerprints:Object.fromEntries(rows.map(r=>[r.id,fingerprint(r)])), fingerprint,
    preparationErrors:{},shouldContinue:()=>true};
}

describe('Official Imports FIX2 exact reviewed reads', () => {
  it('rechecks two selected IDs without any full pending-list API', async () => {
    assert.equal(typeof operations.recheckReviewedCorporateActionImports,'function');
    const calls:number[][]=[];const rows=[row(3),row(32203)];
    const result=await operations.recheckReviewedCorporateActionImports(recheckInput(rows,calls));
    assert.deepEqual(result.rows.map(r=>r.id),[3,32203]);assert.deepEqual(calls,[[3,32203]]);
  });
  it('bounds every exact-ID read at 100 and retains input order', async () => {
    assert.equal(typeof operations.recheckReviewedCorporateActionImports,'function');
    const calls:number[][]=[];const rows=Array.from({length:205},(_,i)=>row(205-i));
    const result=await operations.recheckReviewedCorporateActionImports(recheckInput(rows,calls));
    assert.deepEqual(calls.map(c=>c.length),[100,100,5]);
    assert.deepEqual(result.rows.map(r=>r.id),rows.map(r=>r.id));
  });
  it('rejects missing, duplicate, and unrelated returned IDs instead of falling back to a full queue', async () => {
    assert.equal(typeof operations.recheckReviewedCorporateActionImports,'function');
    for (const returned of [[row(1)],[row(1),row(1)],[row(1),row(999)]]) {
      const input=recheckInput([row(1),row(2)],[]);
      input.api.getCorporateActionImportsByIds=async()=>returned;
      await assert.rejects(()=>operations.recheckReviewedCorporateActionImports(input),/lookup|exact|missing|duplicate|unexpected/i);
    }
  });
  it('rejects changed material evidence and already-approved rows', async () => {
    assert.equal(typeof operations.recheckReviewedCorporateActionImports,'function');
    for (const changed of [row(1,{evidenceCount:2}),row(1,{reviewStatus:'APPROVED',approvedCorporateActionId:42})]) {
      const input=recheckInput([row(1)],[]);input.api.getCorporateActionImportsByIds=async()=>[changed];
      await assert.rejects(()=>operations.recheckReviewedCorporateActionImports(input),/changed|ready/i);
    }
  });
  it('does not use a cached Split/Bonus scan when the current read has no scan', async () => {
    assert.equal(typeof operations.recheckReviewedCorporateActionImports,'function');
    const input=recheckInput([row(1,{actionType:'BONUS',factor:2})],[]);
    await assert.rejects(()=>operations.recheckReviewedCorporateActionImports(input),/ready|validation|changed/i);
  });
  it('stops after a database switch before scheduling further reads', async () => {
    assert.equal(typeof operations.recheckReviewedCorporateActionImports,'function');
    const rows=Array.from({length:205},(_,i)=>row(i+1));const input=recheckInput(rows,[]);
    let current=true;let calls=0;input.shouldContinue=()=>current;
    input.api.getCorporateActionImportsByIds=async({importIds})=>{calls++;current=false;return importIds.map(id=>row(id));};
    await assert.rejects(()=>operations.recheckReviewedCorporateActionImports(input),/current/i);
    assert.equal(calls,1);
  });
});

function approved(id:number) {return row(id,{reviewStatus:'APPROVED',approvedCorporateActionId:100+id});}
function approvalResult(ids:number[]) {
  return {requested:ids.length,approved:ids.length,linkedExisting:0,alreadyApproved:0,failed:0,
    results:ids.map(id=>({importRecord:approved(id),approvedRecord:null,message:'Applied'})),errors:[],message:'Applied'};
}

describe('Official Imports FIX2 apply receipts and reconciliation', () => {
  it('pins the reviewed database and automatically reloads each affected instrument after commit', async () => {
    const trace: string[] = [];
    const api = {
      ...lookupApi([approved(1), approved(2)], []),
      approveCorporateActionImports: async (input: CorporateActionImportBulkApprovalInput) => {
        assert.equal(input.expectedDatabasePath, db);
        trace.push('commit');
        const result = approvalResult(input.importIds);
        return { ...result, results: result.results.map(item => ({
          ...item, approvedRecord: { exchange: 'NSE', currentSymbol: 'SAME' } as CorporateActionResult,
        })) };
      },
    };
    const receipt = await operations.applyReviewedCorporateActionBatches({
      api, rows: [row(1), row(2)], expectedDatabasePath: db,
      shouldContinue: () => true,
      onReconcile: () => { trace.push('reconcile'); },
      refresh: async () => { trace.push('refresh'); },
      reload: async record => { trace.push(`reload:${record.exchange}:${record.currentSymbol}`); },
    });
    assert.equal(receipt.approved, 2);
    assert.deepEqual(trace, ['commit', 'reconcile', 'refresh', 'reload:NSE:SAME']);
  });

  it('rejects a missing reviewed database before dispatching approval', async () => {
    let writes = 0;
    const api = { ...lookupApi([], []), approveCorporateActionImports: async () => {
      writes++; return approvalResult([1]);
    } };
    await assert.rejects(() => operations.applyReviewedCorporateActionBatches({
      api, rows: [row(1)], expectedDatabasePath: '',
      onReconcile: () => {}, refresh: async () => {}, reload: async () => {},
    }), /reviewed database context/);
    assert.equal(writes, 0);
  });

  it('preserves the complete 32203-row queue while removing only confirmed applied IDs', () => {
    assert.equal(typeof operations.reconcilePreparedCorporateActionRows,'function');
    const rows=Array.from({length:32203},(_,i)=>row(i+1));
    const updated=operations.reconcilePreparedCorporateActionRows(rows,[approved(2),approved(32000)]);
    assert.equal(updated.length,32201);assert.equal(updated[0],rows[0]);assert.equal(updated.at(-1),rows.at(-1));
    assert.equal(updated.some(r=>r.id===2||r.id===32000),false);
  });
  it('reports apply completion before refresh begins and never lists the whole backlog', async () => {
    assert.equal(typeof operations.applyReviewedCorporateActionBatches,'function');
    const progress:operations.OfficialImportOperationProgress[]=[];
    const api={...lookupApi([approved(1),approved(2)],[]),approveCorporateActionImports:async({importIds}:{importIds:number[]})=>approvalResult(importIds)};
    const result=await operations.applyReviewedCorporateActionBatches({api,rows:[row(1),row(2)],expectedDatabasePath:db,
      shouldContinue:()=>true,onProgress:p=>progress.push(p),onReconcile:()=>{},
      refresh:async()=>{assert.equal(progress.filter(p=>p.stage==='applying').at(-1)?.completed,2);},reload:async()=>{}});
    assert.equal(result.approved,2);assert.equal(result.warnings.length,0);
    assert.equal(progress.at(-1)?.stage,'complete');
    assert.ok(progress.some(p=>p.stage==='reconciling'));
  });
  it('keeps confirmed approval receipt when refresh fails, with no write retry', async () => {
    assert.equal(typeof operations.applyReviewedCorporateActionBatches,'function');
    let writes=0;const api={...lookupApi([approved(1)],[]),approveCorporateActionImports:async({importIds}:{importIds:number[]})=>{writes++;return approvalResult(importIds);}};
    const result=await operations.applyReviewedCorporateActionBatches({api,rows:[row(1)],expectedDatabasePath:db,
      shouldContinue:()=>true,onReconcile:()=>{},refresh:async()=>{throw new Error('stats refresh failed');},reload:async()=>{}});
    assert.equal(writes,1);assert.equal(result.approved,1);assert.match(result.warnings.join(' '),/refresh/i);
  });
  it('reconciles uncertain batch outcomes once, blocks affected IDs, and never retries approval', async () => {
    assert.equal(typeof operations.applyReviewedCorporateActionBatches,'function');
    let writes=0;const calls:number[][]=[];let observed:CorporateActionImportRow[]=[];
    const api={...lookupApi([approved(1)],calls),approveCorporateActionImports:async()=>{writes++;throw new Error('reply lost');}};
    const result=await operations.applyReviewedCorporateActionBatches({api,rows:[row(1)],expectedDatabasePath:db,
      shouldContinue:()=>true,onReconcile:r=>{observed=r;},refresh:async()=>{},reload:async()=>{}});
    assert.equal(writes,1);assert.deepEqual(calls,[[1]]);assert.equal(observed[0].reviewStatus,'APPROVED');
    assert.deepEqual(result.blockedImportIds,[1]);assert.match(result.warnings.join(' '),/not confirmed|unknown/i);
  });
  it('stops further writes and refreshes if the database changes after the first batch', async () => {
    assert.equal(typeof operations.applyReviewedCorporateActionBatches,'function');
    let current=true,writes=0,refreshes=0;const rows=Array.from({length:101},(_,i)=>row(i+1));
    const api={...lookupApi([],[]),approveCorporateActionImports:async({importIds}:{importIds:number[]})=>{writes++;current=false;return approvalResult(importIds);}};
    await assert.rejects(()=>operations.applyReviewedCorporateActionBatches({api,rows,expectedDatabasePath:db,
      shouldContinue:()=>current,onReconcile:()=>{},refresh:async()=>{refreshes++;},reload:async()=>{}}),/current/i);
    assert.equal(writes,1);assert.equal(refreshes,0);
  });
});

describe('Official Imports FIX2 bounded detail refresh', () => {
  it('does not hydrate every grouped pending row when no identity detail is displayed', () => {
    assert.equal(typeof presentation.selectCorporateActionIdentityDetailIds,'function');
    const rows=Array.from({length:32203},(_,i)=>row(i+1));
    assert.deepEqual(presentation.selectCorporateActionIdentityDetailIds(rows,true,null),[]);
    assert.deepEqual(presentation.selectCorporateActionIdentityDetailIds(rows,true,32203),[32203]);
    assert.deepEqual(presentation.selectCorporateActionIdentityDetailIds(rows.slice(0,2),false,null),[1,2]);
  });
  it('reconciles the prepared UI queue once after multi-batch apply instead of triggering all-row effects per batch', async () => {
    assert.equal(typeof operations.applyReviewedCorporateActionBatches,'function');
    const rows=Array.from({length:205},(_,i)=>row(i+1));let reconciliations=0;
    const api={...lookupApi(rows.map(r=>approved(r.id)),[]),approveCorporateActionImports:async({importIds}:{importIds:number[]})=>approvalResult(importIds)};
    const result=await operations.applyReviewedCorporateActionBatches({api,rows,expectedDatabasePath:db,shouldContinue:()=>true,
      onReconcile:snapshots=>{reconciliations++;assert.equal(snapshots.length,205);},refresh:async()=>{},reload:async()=>{}});
    assert.equal(result.approved,205);assert.equal(reconciliations,1);
  });
});
