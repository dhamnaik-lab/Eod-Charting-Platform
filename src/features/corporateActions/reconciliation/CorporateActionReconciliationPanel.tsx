import { useEffect, useRef, useState } from 'react';
import type { CorporateActionReconciliationPreflightRow as Row, DesktopApi } from '@/platform/types';
import { ReconciliationBatchSession, saveReconciliationExport } from './corporateActionReconciliationPreflight';
import { serializeReconciliationReport } from './corporateActionReconciliationExport';

type Api = Pick<DesktopApi,'previewSplitBonusReconciliation'|'saveTextExport'|'onDatabaseChanged'>;
interface Props { api: Api; databasePath: string | null; importIds: readonly number[]; generation: number; scopeRevision: unknown; onClose:()=>void; }
const buttonStyle = { padding:'5px 9px', border:'1px solid var(--border-color, #888)', borderRadius:4, cursor:'pointer', background:'var(--bg-secondary, transparent)', color:'inherit' };

export function ReconciliationResultTable({rows,selected,onSelect}:{rows:readonly Row[];selected:ReadonlySet<number>;onSelect:(id:number)=>void}) {
 return <div style={{maxHeight:420,overflow:'auto'}}>
  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>
   {['Select','Import / symbol','Action / date','Outcome / ordinary / Safe V1','Blockers and evidence'].map(h=><th key={h} style={{textAlign:'left',padding:6}}>{h}</th>)}
  </tr></thead><tbody>{rows.map(row=><tr key={row.importId} style={{borderTop:'1px solid var(--border-color, #888)',verticalAlign:'top'}}>
   <td style={{padding:6}}><input type="checkbox" aria-label={`Diagnostic selection for import ${row.importId}`} checked={selected.has(row.importId)} onChange={()=>onSelect(row.importId)} /></td>
   <td style={{padding:6}}>{row.importId}<br/>{row.symbol??'Missing import'}<br/>{row.storedState.reviewStatus??'UNKNOWN'}</td>
   <td style={{padding:6}}>{row.actionType??'UNKNOWN'}<br/>{row.exDate??'No date'}<br/>{row.classification.state}</td>
   <td style={{padding:6}}>{row.outcome}<br/>Ordinary: {row.ordinaryReadiness.state}<br/>{row.ordinaryReadiness.message}<br/>Separate Safe V2 policy: {row.safeV1.state}<br/>Raw-price revalidation: {row.price.rawPriceRevalidation}</td>
   <td style={{padding:6,minWidth:260}}>{row.blockers.map((b,i)=><div key={`${b.code}-${i}`}><strong>{b.code}</strong>: {b.message}
    {b.nextOperation && <p>Next step: {b.nextOperation}</p>}</div>)}
    <details><summary>Identity, canonical candidates and proposed repairs</summary>
     <p>Raw: {row.identity.rawSymbol??'UNKNOWN'} / {row.identity.rawIsin??'UNKNOWN'}<br/>Effective event: {row.identity.eventSymbol??'UNKNOWN'} / {row.identity.eventIsin??'UNKNOWN'}</p>
     <p>Identity proof: {row.identity.proofState}. {row.identity.proofDescription??''}</p>
     <p>Canonical: {row.canonical.state}; candidates: {row.canonical.candidateIds.join(', ')||'none reported'}. A candidate is not an executed link.</p>
     <p>Scan: {row.price.scanId??'none'}; as of {row.price.scannedAt??'unknown'}; row freshness {row.price.rowFingerprintCheck}; compound freshness {row.price.compoundFingerprintCheck}.</p>
     <p>{row.safeV1.reason??'No policy determination.'}</p>
     {row.repairPlan.map((p,i)=><p key={i}>{p.operation} — {p.availability}<br/>Owner: {p.owner}<br/>Required: {p.prerequisites.join('; ')}<br/>Executed: false</p>)}
     {row.identity.evidence.map((e,i)=><p key={i}>{e.kind}: {e.owner}; ID {e.recordId??'n/a'}{e.fingerprint?`; fingerprint ${e.fingerprint}`:''}</p>)}
    </details>
   </td>
  </tr>)}</tbody></table>
 </div>;
}

export function CorporateActionReconciliationPanel({api,databasePath,importIds,generation,scopeRevision,onClose}:Props) {
 const [session]=useState(()=>new ReconciliationBatchSession());
 const operation=useRef(0);const [page,setPage]=useState(0);
 const lastRevision=useRef(scopeRevision);const revision=useRef(0);
 if(lastRevision.current!==scopeRevision){lastRevision.current=scopeRevision;revision.current+=1;}
 session.changeScope(databasePath,importIds,generation+revision.current);
 const [,render]=useState(0);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [selected,setSelected]=useState<Set<number>>(new Set());
 const current=session.current();const count=new Set(importIds).size;const invalid=count<1||!databasePath;
 const rows=current?.batches.flatMap(batch=>batch.rows)??[];
 const capturedIds=new Set(rows.map(row=>row.importId));
 const uncaptured=current?.requestedIds.filter(id=>!capturedIds.has(id))??[];
 const pageCount=Math.max(1,Math.ceil(rows.length/100));const visiblePage=Math.min(page,pageCount-1);
 useEffect(()=>{
  const stop=api.onDatabaseChanged(()=>{operation.current+=1;session.invalidate();setBusy(false);setMessage('Database context changed; repeat read-only preview. Earlier responses cannot be adopted.');setSelected(new Set());render(n=>n+1);});
  return ()=>{operation.current+=1;stop();session.close();};
 },[api,session]);
 const scopeKey=JSON.stringify([databasePath,importIds,generation,revision.current]);
 useEffect(()=>{operation.current+=1;setBusy(false);setSelected(new Set());setPage(0);setMessage('');render(n=>n+1);},[scopeKey]);
 async function preview(ids?:readonly number[]) {
  const owner=++operation.current;
  try {setBusy(true);setPage(0);setMessage('Reading stored evidence in sequential batches; no repairs or approvals.');setSelected(new Set());
   const result=await session.run(api,(captured,total,batches)=>{
    if(operation.current!==owner)return;
    setMessage(`Captured ${captured} / ${total} IDs (${batches} batches). No repairs or approvals.`);render(n=>n+1);
   },ids);
   if(operation.current!==owner)return;
   if(!result){setMessage('Preview invalidated by a context change. No result is exportable; repeat the preview.');return;}
   const captured=result.batches.flatMap(batch=>batch.rows);
   setSelected(new Set(captured.map(row=>row.importId)));
   setMessage(`${result.status}: ${captured.length} / ${result.requestedIds.length} IDs captured. ${result.message}`);
  } catch(error) {if(operation.current===owner)setMessage(error instanceof Error?error.message:'Read-only preview failed.');}
  finally {if(operation.current===owner){setBusy(false);render(n=>n+1);}}
 }
 async function save(format:'csv'|'txt') {
  const captured=session.current();if(!captured)return;
  const owner=++operation.current;
  try {const payload=serializeReconciliationReport(captured,format);
   setBusy(true);const state=await saveReconciliationExport(api,payload);
   if(operation.current!==owner)return;
   if(session.current()!==captured){setMessage('Database/scope changed while the dialog was open. Any saved file describes only the earlier captured snapshot.');return;}
   setMessage(state==='CANCELLED'?'Export cancelled; no success claimed.':`Saved ${payload.rowCount} requested IDs as ${format.toUpperCase()} (${captured.status}); uncaptured IDs are explicitly marked. No database state changed.`);
  }catch(error){if(operation.current===owner)setMessage(error instanceof Error?error.message:'Export failed.');}finally{if(operation.current===owner)setBusy(false);}
 }
 return <section aria-label="Read-only reconciliation preview" style={{border:'1px solid var(--border-color, #888)',padding:10,borderRadius:5,margin:'8px 0',color:'inherit'}}>
  <strong>Reconciliation Preview only — no repairs or approvals performed</strong>
  <p style={{fontSize:12}}>NSE and BSE Split, Bonus, Rights, Dividend and Demerger records receive diagnostic findings. Financial terms and preparation may require further verification; stored factors do not establish official authority. Other event types are identified as outside this financial diagnostic scope.</p>
  <p style={{fontSize:12}}>Explicit filtered scope: {count} unique IDs. Requests run sequentially in batches of at most 500. Nothing is truncated. Each batch is a separate snapshot, not one atomic snapshot. Stored scans are not a fresh raw-price revalidation.</p>
  <p style={{fontSize:12}}>Export includes the entire requested preview, including IDs not captured after cancellation or failure. Row selections are for retry only; a retry starts a new report for those IDs. No report certifies database completeness.</p>
  <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
   <button type="button" style={buttonStyle} disabled={busy||invalid} onClick={()=>void preview()}>Preview filtered IDs</button>
   <button type="button" style={buttonStyle} disabled={busy||!current||!selected.size} onClick={()=>void preview(rows.filter(r=>selected.has(r.importId)).map(r=>r.importId))}>Retry selected diagnostics</button>
   <button type="button" style={buttonStyle} disabled={busy||!rows.some(r=>r.outcome==='PREPARATION_ERROR'||r.outcome==='MISSING_IMPORT')} onClick={()=>void preview(rows.filter(r=>r.outcome==='PREPARATION_ERROR'||r.outcome==='MISSING_IMPORT').map(r=>r.importId))}>Retry failed diagnostics</button>
   <button type="button" style={buttonStyle} disabled={busy||!uncaptured.length} onClick={()=>void preview(uncaptured)}>Retry uncaptured IDs ({uncaptured.length})</button>
   {busy&&current?.status==='RUNNING'?<button type="button" style={buttonStyle} onClick={()=>{session.cancel();setMessage('Cancellation requested; waiting for the current read to return. No further batches will start.');}}>Cancel preview</button>:null}
   <button type="button" style={buttonStyle} disabled={busy||!current||current.status==='RUNNING'} onClick={()=>void save('csv')}>Export CSV</button>
   <button type="button" style={buttonStyle} disabled={busy||!current||current.status==='RUNNING'} onClick={()=>void save('txt')}>Export TXT</button>
   <button type="button" style={buttonStyle} onClick={()=>{operation.current+=1;session.close();onClose();}}>Close</button>
  </div>
  <p role="status" style={{fontSize:12}}>{message}</p>
  {current?<>
   <p style={{fontSize:12}}>{current.status} · {rows.length} captured / {current.requestedIds.length} requested · {current.batches.length} separate snapshots. Database completeness: not assessed.</p>
   <details><summary>Snapshot timestamps and fingerprints</summary>{current.batches.map((batch,index)=><p key={index} style={{overflowWrap:'anywhere'}}>{index+1}: {batch.generatedAt} · {batch.fingerprint}</p>)}</details>
   <label><input type="checkbox" checked={rows.length>0&&rows.every(r=>selected.has(r.importId))} onChange={e=>setSelected(e.target.checked?new Set(rows.map(r=>r.importId)):new Set())}/> Select all captured diagnostic rows (not approval selection)</label>
   <div><button type="button" disabled={visiblePage===0} onClick={()=>setPage(visiblePage-1)}>Previous page</button> Page {visiblePage+1} / {pageCount} (100 rows per page) <button type="button" disabled={visiblePage+1>=pageCount} onClick={()=>setPage(visiblePage+1)}>Next page</button></div>
   <ReconciliationResultTable rows={rows.slice(visiblePage*100,(visiblePage+1)*100)} selected={selected} onSelect={id=>setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;})}/>
  </>:<p style={{fontSize:12}}>No current captured result. Blocked rows remain selectable here once the preview completes.</p>}
 </section>;
}
