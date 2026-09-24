import type { CorporateActionReconciliationPreflightResult as Result } from '@/platform/types';

type Cell = string | number | boolean | null;
export const RECONCILIATION_EXPORT_COLUMNS = [
 'Preview version','Export scope','Generated at','Batch fingerprint','Import ID','Row fingerprint','Exchange','Symbol','Action type','Ex date','Record date',
 'Raw symbol','Raw ISIN','Effective event symbol','Effective event ISIN','Stored review status','Stored parse status','Approved canonical ID',
 'Classification','Stored share factor','Proposed share factor','Proposed price factor','Proposal only','Identity proof state','Identity proof owner','Active candidates',
 'Canonical state','Owner-match candidate ID','Candidate IDs','Scan ID','Scan run ID','Scan time','Scan status','Confidence','Expected factor',
 'Previous bar date','Ex-side bar date','Previous close','Ex open','Ex close','Row freshness','Compound freshness','Raw price revalidation','Ordinary readiness',
 'Safe V1 state','Safe V1 reason','Outcome','Primary blocker','All blockers','Proposed repair operations','Repair execution','Completeness blocked','Purpose',
] as const;

/** Both formats project the same captured rows; this function never queries the database. */
export function reconciliationExportRows(result: Result, selectedImportIds: readonly number[]): Cell[][] {
 if (result.status === 'REJECTED' || !result.databaseContext || !result.fingerprint || result.readOnly !== true
   || result.executedRepairs !== 0 || result.approvalWrites !== 0 || result.summary.databaseComplete !== false) {
   throw new Error('Only a captured read-only preview can be exported.');
 }
 if (!selectedImportIds.length || selectedImportIds.some(id => !Number.isSafeInteger(id) || id <= 0)
   || new Set(selectedImportIds).size !== selectedImportIds.length) throw new Error('Select a non-empty, unique set of diagnostic IDs.');
 const byId = new Map(result.rows.map(row => [row.importId, row]));
 if (byId.size !== result.rows.length || selectedImportIds.some(id => !byId.has(id))) throw new Error('Export selection does not match the captured result.');
 const scope = selectedImportIds.length === result.rows.length ? 'ALL_PREVIEW_ROWS' : 'SELECTED_PREVIEW_IDS';
 return selectedImportIds.map(id => {
  const r=byId.get(id)!;
  const cells:Cell[]=[result.version,scope,result.generatedAt,result.fingerprint,r.importId,r.rowFingerprint,r.exchange,r.symbol,r.actionType,r.exDate,r.recordDate,
   r.identity.rawSymbol,r.identity.rawIsin,r.identity.eventSymbol,r.identity.eventIsin,r.storedState.reviewStatus,r.storedState.parseStatus,r.storedState.approvedCorporateActionId,
   r.classification.state,r.classification.storedShareFactor,r.classification.proposedShareFactor,r.classification.proposedPriceFactor,r.classification.proposalOnly,r.identity.proofState,r.identity.proofOwner,
   r.identity.candidates.filter(c=>c.isActive).map(c=>`${c.exchange}:${c.symbol}`).join(' | '),
   r.canonical.state,r.canonical.ownerMatchCandidateId,r.canonical.candidateIds.join(' | '),r.price.scanId,r.price.scanRunId,r.price.scannedAt,r.price.scanStatus,r.price.confidence,r.price.expectedFactor,
   r.price.previousTradeDate,r.price.exTradeDate,r.price.previousClose,r.price.exOpen,r.price.exClose,r.price.rowFingerprintCheck,r.price.compoundFingerprintCheck,r.price.rawPriceRevalidation,
   r.ordinaryReadiness.state,r.safeV1.state,r.safeV1.reason,r.outcome,r.blockers.find(b=>b.severity==='BLOCKING')?.code ?? r.blockers[0]?.code ?? '',
   r.blockers.map(b=>`${b.code}: ${b.message}`).join(' | '),r.repairPlan.map(p=>`${p.operation} [${p.availability}]`).join(' | '),
   r.repairPlan.some(p=>p.executed!==false)?'INVALID_EXECUTION_STATE':'NOT_EXECUTED',r.blocksInScopeCompleteness,r.purposeRaw];
  if(cells.length!==RECONCILIATION_EXPORT_COLUMNS.length || cells.some(v=>typeof v==='number'&&!Number.isFinite(v))) throw new Error('Export contains invalid diagnostic fields.');
  return cells;
 });
}

function encode(value: Cell, delimiter: string): string {
 if (value===null || value===undefined) return '';
 let text=typeof value==='number' && Object.is(value,-0)?'-0':String(value);
 if(typeof value==='string' && (/^[\t\r\n]/.test(text)||/^[\s]*[=+\-@\t\r\n]/.test(text))) text="'"+text;
 if(text.includes(delimiter)||/["\r\n]/.test(text)) return '"'+text.replace(/"/g,'""')+'"';
 return text;
}

export function serializeCorporateActionReconciliation(result: Result, selectedImportIds: readonly number[], format: 'csv'|'txt'):
 {content:string;rowCount:number;defaultExtension:'csv'|'txt'} {
 if(format!=='csv'&&format!=='txt') throw new Error('Unsupported table export format.');
 const rows=reconciliationExportRows(result,selectedImportIds);const separator=format==='csv'?',':'\t';
 const content='\ufeff'+[[...RECONCILIATION_EXPORT_COLUMNS],...rows].map(cells=>cells.map(v=>encode(v,separator)).join(separator)).join('\r\n')+'\r\n';
 return {content,rowCount:rows.length,defaultExtension:format};
}
