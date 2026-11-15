import { describe, it, expect } from 'vitest';
import { serializeCorporateActionReconciliation, serializeReconciliationReport, reconciliationExportRows, RECONCILIATION_EXPORT_COLUMNS } from '../reconciliation/corporateActionReconciliationExport';
import type { CorporateActionReconciliationPreflightResult as Result, CorporateActionReconciliationPreflightRow as Row } from '@/platform/types';

function row(id: number, purpose = 'અજંતા, "test"\r\nnext\tline'): Row {
 return { importId: id, exists: true, exchange: 'NSE', symbol: 'TEST', actionType: 'SPLIT', exDate: '2026-08-14', recordDate: null,
 purposeRaw: purpose, rowFingerprint: 'row', storedState: { reviewStatus: 'UNRESOLVED', parseStatus: 'PARSED', approvedCorporateActionId: null },
 identity: { rawSymbol: 'OLD', rawIsin: 'OLD_ISIN', eventSymbol: 'TEST', eventIsin: 'NEW_ISIN', candidates: [], proofState: 'BLOCKED', proofOwner: null, proofDescription: null, evidence: [] },
 classification: { state: 'ORDINARY_SPLIT', storedShareFactor: 2, proposedShareFactor: 2, proposedPriceFactor: .5, proposalOnly: true },
 canonical: { state: 'NONE', linkedId: null, ownerMatchCandidateId: null, candidateIds: [], evidence: [] },
 price: { scanId: null, scanRunId: null, scannedAt: null, scanStatus: null, confidence: null, expectedFactor: null, previousTradeDate: null, exTradeDate: null, previousClose: null, exOpen: null, exClose: null, rowFingerprintCheck: 'NOT_EVALUATED', compoundFingerprintCheck: 'NOT_EVALUATED', rawPriceRevalidation: 'NOT_RUN' },
 ordinaryReadiness: { state: 'BLOCKED', message: 'Identity missing' }, safeV1: { policyVersion: 'AUTO_APPROVAL_SAFE_V2', state: 'INELIGIBLE', reason: 'blocked', evidence: [] },
 blockers: [{ code: 'IDENTITY_UNRESOLVED', stage: 'IDENTITY', severity: 'BLOCKING', message: 'needs evidence', evidence: [], nextOperation: 'diagnose', retryableReadOnly: true }], repairPlan: [], outcome: 'EVIDENCE_BLOCKED', blocksInScopeCompleteness: true };
}
function result(rows: Row[]): Result {
 return {version:'CA_RECONCILIATION_PREFLIGHT_V1',status:'COMPLETE',requestToken:'test',generatedAt:'2026-09-23T17:00:00+05:30',
 databaseContext: { canonicalDatabasePath: 'E:/TEST', databaseFileIdentity: 'db', schemaFingerprint: 'schema', readContext: 'CONSISTENT_READ_TRANSACTION', selectionSource: 'EXISTING_CACHED_ACTIVE_FOLDER', buildIdentity: 'test' },
 selection:{requestedCount:rows.length,uniqueCount:rows.length,duplicateCount:0,uniqueImportIds:rows.map(r=>r.importId),idSetFingerprint:'ids'},fingerprint:'batch',
 readOnly:true,executedRepairs:0,approvalWrites:0,rows,globalBlockers:[],summary:{accountedFor:rows.length,outcomeCounts:{ALREADY_LINKED_REVIEW:0,READY_FOR_EXISTING_APPROVAL_RECHECK:0,REPAIR_CANDIDATE:0,EVIDENCE_BLOCKED:rows.length,DEFERRED_SCOPE:0,CLASSIFICATION_REVIEW:0,MISSING_IMPORT:0,PREPARATION_ERROR:0},inScopeBlockedRows:rows.length,applicabilityUnknownRows:0,deferredRows:0,coverageCertification:'NOT_ASSESSED',databaseComplete:false}};
}
// Standards-oriented CSV reader for round-trip assertions; handles escaped quotes and newlines.
function parse(text: string, separator: string): string[][] {
 const rows: string[][]=[]; let fields: string[]=[]; let cell=''; let quoted=false;
 const s=text.replace(/^\ufeff/,'');
 for(let i=0;i<s.length;i++){const ch=s[i];
  if(ch==='"'){if(quoted && s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;continue;}
  if(!quoted && ch===separator){fields.push(cell);cell='';continue;}
  if(!quoted && ch==='\r' && s[i+1]==='\n'){fields.push(cell);rows.push(fields);fields=[];cell='';i++;continue;}
  cell+=ch;
 }
 return rows;
}

describe('R1-A exact diagnostic export',()=>{
 it('combines snapshots in request order and retains per-batch provenance',()=>{
  const first=result([row(2)]);first.fingerprint='first';
  const second=result([row(1)]);second.fingerprint='second';second.generatedAt='2026-11-15T01:00:00Z';
  for(const format of ['csv','txt'] as const){
   const saved=serializeReconciliationReport({requestedIds:[2,1],batches:[first,second],status:'COMPLETE',message:'All captured'},format);
   const table=parse(saved.content,format==='csv'?',':'\t');const column=(name:string)=>table[0].indexOf(name);
   expect(saved.rowCount).toBe(2);expect(table.slice(1).map(r=>r[column('Import ID')])).toEqual(['2','1']);
   expect(table.slice(1).map(r=>r[column('Batch fingerprint')])).toEqual(['first','second']);
   expect(table[2][column('Generated at')]).toBe(second.generatedAt);
   expect(table[1][column('Snapshot scope')]).toBe('SEPARATE_BATCH_SNAPSHOTS_NOT_ATOMIC');
  }
 });
 it('exports uncaptured IDs explicitly after cancellation or failure, without fabricating readiness',()=>{
  for(const status of ['CANCELLED','FAILED'] as const){
   const saved=serializeReconciliationReport({requestedIds:[1,2],batches:[result([row(1)])],status,message:'Stopped'},'csv');
   const table=parse(saved.content,',');const cell=(name:string)=>table[2][table[0].indexOf(name)];
   expect(saved.rowCount).toBe(2);expect(cell('Import ID')).toBe('2');expect(cell('Outcome')).toBe('NOT_CAPTURED');
   expect(cell('Report status')).toBe(status);expect(cell('Captured ID count')).toBe('1');expect(cell('Not captured ID count')).toBe('1');
   expect(cell('Ordinary readiness')).toBe('');expect(cell('Batch fingerprint')).toBe('');
  }
 });
 it('rejects misleading completion, duplicate captured IDs and active reports',()=>{
  const report={requestedIds:[1,2],batches:[result([row(1)])],status:'COMPLETE' as const,message:''};
  expect(()=>serializeReconciliationReport(report,'csv')).toThrow('incomplete');
  expect(()=>serializeReconciliationReport({...report,status:'RUNNING'},'csv')).toThrow();
  expect(()=>serializeReconciliationReport({...report,status:'FAILED',batches:[...report.batches,...report.batches]},'csv')).toThrow('accounting');
 });
 it('exports actionable next steps and readiness explanation without granting approval',()=>{
  const data=result([row(1)]);const table=reconciliationExportRows(data,[1]);
  expect(table[0][RECONCILIATION_EXPORT_COLUMNS.indexOf('Next steps')]).toBe('diagnose');
  expect(table[0][RECONCILIATION_EXPORT_COLUMNS.indexOf('Readiness explanation')]).toBe(data.rows[0].ordinaryReadiness.message);
  data.rows[0].ordinaryReadiness.state='READY_FOR_WRITER_RECHECK';
  expect(()=>reconciliationExportRows(data,[1])).toThrow('Conflicting readiness');
 });
 it('exports blocked selected rows in the requested order without changing approval flags',()=>{
  const data=result([row(1),row(2)]);const before=JSON.stringify(data);
  const table=reconciliationExportRows(data,[2,1]);
  expect(table.map(r=>r[4])).toEqual([2,1]);expect(JSON.stringify(data)).toBe(before);
 });
 it('rejects empty selection, unknown IDs, duplicate IDs and rejected batches',()=>{
  const data=result([row(1)]);
  for(const ids of [[],[2],[1,1]])expect(()=>serializeCorporateActionReconciliation(data,ids,'csv')).toThrow();
  data.status='REJECTED';expect(()=>serializeCorporateActionReconciliation(data,[1],'csv')).toThrow();
 });
 it('round trips delimiters, quotes, CR/LF and Gujarati in both formats',()=>{
  const data=result([row(1)]);
  for(const format of ['csv','txt'] as const){const x=serializeCorporateActionReconciliation(data,[1],format);
   expect(x.content.startsWith('\ufeff')).toBe(true);expect(x.content.endsWith('\r\n')).toBe(true);
   const table=parse(x.content,format==='csv'?',':'\t');expect(table).toHaveLength(2);
   expect(table[0]).toEqual([...RECONCILIATION_EXPORT_COLUMNS]);expect(table[1].at(-1)).toBe(data.rows[0].purposeRaw);
   expect(x.rowCount).toBe(1);expect(x.defaultExtension).toBe(format);
  }
 });
 it('formula prefixes are neutralized only for text, with no source mutation',()=>{
  for(const text of ['=1+1','+SUM(A1)','-cmd','@x','  =A1','\tformula','\rhidden','\nhidden']){
   const data=result([row(1,text)]);const table=parse(serializeCorporateActionReconciliation(data,[1],'csv').content,',');
   expect(table[1].at(-1)).toBe("'"+text);expect(data.rows[0].purposeRaw).toBe(text);
  }
 });
 it('preserves zero, false and negative numeric values; null is blank',()=>{
  const data=result([row(1)]);data.rows[0].classification.proposedPriceFactor=-1.25;data.rows[0].price.confidence=0;data.rows[0].blocksInScopeCompleteness=false;
  const table=parse(serializeCorporateActionReconciliation(data,[1],'csv').content,',');
  const cell=(name:string)=>table[1][table[0].indexOf(name)];
  expect(cell('Proposed price factor')).toBe('-1.25');expect(cell('Confidence')).toBe('0');expect(cell('Completeness blocked')).toBe('false');expect(cell('Previous close')).toBe('');
 });
 it('refuses nonfinite numeric output and unsafe IDs',()=>{
  const data=result([row(1)]);data.rows[0].price.exOpen=NaN;
  expect(()=>serializeCorporateActionReconciliation(data,[1],'csv')).toThrow();
  expect(()=>serializeCorporateActionReconciliation(result([row(Number.MAX_SAFE_INTEGER+1)]),[Number.MAX_SAFE_INTEGER+1],'csv')).toThrow();
 });
 it('labels the exact subset and all-preview scope, including raw/effective identity',()=>{
  const data=result([row(1),row(2)]);const all=reconciliationExportRows(data,[1,2]);const sub=reconciliationExportRows(data,[2]);
  expect(all[0][1]).toBe('ALL_PREVIEW_ROWS');expect(sub[0][1]).toBe('SELECTED_PREVIEW_IDS');
  expect(sub[0][11]).toBe('OLD');expect(sub[0][13]).toBe('TEST');
 });
});
