import { useEffect, useRef, useState } from 'react';
import type { CorporateActionReconciliationPreflightRow as Row, DesktopApi } from '@/platform/types';
import { ReconciliationSession, saveReconciliationExport } from './corporateActionReconciliationPreflight';
import { serializeCorporateActionReconciliation } from './corporateActionReconciliationExport';

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
   <td style={{padding:6}}>{row.outcome}<br/>Ordinary: {row.ordinaryReadiness.state}<br/>Safe V1: {row.safeV1.state}<br/>Raw-price revalidation: {row.price.rawPriceRevalidation}</td>
   <td style={{padding:6,minWidth:260}}>{row.blockers.map((b,i)=><div key={`${b.code}-${i}`}><strong>{b.code}</strong>: {b.message}</div>)}
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
 const [session]=useState(()=>new ReconciliationSession());
 const lastRevision=useRef(scopeRevision);const revision=useRef(0);
 if(lastRevision.current!==scopeRevision){lastRevision.current=scopeRevision;revision.current+=1;}
 session.changeScope(databasePath,importIds,generation+revision.current);
 const [,render]=useState(0);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [selected,setSelected]=useState<Set<number>>(new Set());
 const current=session.current();const count=importIds.length;const invalid=count<1||count>500||!databasePath;
 useEffect(()=>{
  const stop=api.onDatabaseChanged(()=>{session.invalidate();setBusy(false);setMessage('Database context changed; repeat read-only preview. Earlier responses cannot be adopted.');setSelected(new Set());render(n=>n+1);});
  return ()=>{stop();session.close();};
 },[api,session]);
 const scopeKey=JSON.stringify([databasePath,importIds,generation,revision.current]);
 useEffect(()=>{setBusy(false);setSelected(new Set());setMessage('');render(n=>n+1);},[scopeKey]);
 async function preview(ids?:readonly number[]) {
  let request; let handled=false;
  try {request=session.begin(ids);setBusy(true);setMessage('Reading stored evidence only; no repairs, revalidation writes or approvals.');setSelected(new Set());render(n=>n+1);
   const result=await api.previewSplitBonusReconciliation(request);
   if(!session.owns(request))return;
   handled=true;
   if(!session.adopt(request,result)){setMessage(result.globalBlockers?.map(b=>`${b.code}: ${b.message}`).join(' | ')||'Preview rejected or inconsistent; no result is current.');return;}
   setSelected(new Set(result.rows.map(row=>row.importId)));setMessage(`As of ${result.generatedAt}: ${result.summary.accountedFor} IDs accounted for; repairs 0, approvals 0. Coverage NOT_ASSESSED.`);
  } catch(error) {if(!request||session.owns(request)){handled=true;if(request)session.fail(request);setMessage(error instanceof Error?error.message:'Read-only preview failed.');}}
  finally {if(handled||!request){setBusy(false);render(n=>n+1);}}
 }
 async function save(format:'csv'|'txt') {
  const captured=session.current();if(!captured)return;
  try {const ids=captured.rows.filter(row=>selected.has(row.importId)).map(row=>row.importId);const payload=serializeCorporateActionReconciliation(captured,ids,format);
   setBusy(true);const state=await saveReconciliationExport(api,payload);
   if(session.current()!==captured){setMessage('Database/scope changed while the dialog was open. Any saved file describes only the earlier captured snapshot.');return;}
   setMessage(state==='CANCELLED'?'Export cancelled; no success claimed.':`Saved ${payload.rowCount} captured diagnostic rows as ${format.toUpperCase()}. No database state changed.`);
  }catch(error){setMessage(error instanceof Error?error.message:'Export failed.');}finally{setBusy(false);}
 }
 return <section aria-label="Read-only reconciliation preview" style={{border:'1px solid var(--border-color, #888)',padding:10,borderRadius:5,margin:'8px 0',color:'inherit'}}>
  <strong>Reconciliation Preview only — no repairs or approvals performed</strong>
  <p style={{fontSize:12}}>Explicit filtered scope: {count} IDs. Maximum 500; nothing is silently dropped. Stored scans are not a fresh raw-price revalidation. An empty queue does not certify database completeness.</p>
  {count>500?<p role="alert">This scope exceeds 500 IDs. Narrow the diagnostic filter. Nothing is truncated.</p>:null}
  <div style={{display:'flex',gap:7,flexWrap:'wrap'}}>
   <button type="button" style={buttonStyle} disabled={busy||invalid} onClick={()=>void preview()}>Preview filtered IDs</button>
   <button type="button" style={buttonStyle} disabled={busy||!current||!selected.size} onClick={()=>void preview(current?.rows.filter(r=>selected.has(r.importId)).map(r=>r.importId))}>Retry selected diagnostics</button>
   <button type="button" style={buttonStyle} disabled={busy||!current?.rows.some(r=>r.outcome==='PREPARATION_ERROR'||r.outcome==='MISSING_IMPORT')} onClick={()=>void preview(current?.rows.filter(r=>r.outcome==='PREPARATION_ERROR'||r.outcome==='MISSING_IMPORT').map(r=>r.importId))}>Retry failed diagnostics</button>
   <button type="button" style={buttonStyle} disabled={busy||!current||!selected.size} onClick={()=>void save('csv')}>Export CSV</button>
   <button type="button" style={buttonStyle} disabled={busy||!current||!selected.size} onClick={()=>void save('txt')}>Export TXT</button>
   <button type="button" style={buttonStyle} onClick={()=>{session.close();onClose();}}>Close</button>
  </div>
  <p role="status" style={{fontSize:12}}>{message}</p>
  {current?<>
   <p style={{fontSize:12}}>As of {current.generatedAt} · {current.status} · {current.summary.accountedFor} accounted · {current.summary.inScopeBlockedRows} in-scope unresolved · {current.summary.applicabilityUnknownRows} applicability unknown · {current.summary.deferredRows} deferred. Database completeness: not assessed.</p>
   <p style={{fontSize:11,overflowWrap:'anywhere'}}>Batch fingerprint: {current.fingerprint}</p>
   <label><input type="checkbox" checked={current.rows.length>0&&current.rows.every(r=>selected.has(r.importId))} onChange={e=>setSelected(e.target.checked?new Set(current.rows.map(r=>r.importId)):new Set())}/> Select all captured diagnostic rows (not approval selection)</label>
   <ReconciliationResultTable rows={current.rows} selected={selected} onSelect={id=>setSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;})}/>
  </>:<p style={{fontSize:12}}>No current captured result. Blocked rows remain selectable here once the preview completes.</p>}
 </section>;
}
