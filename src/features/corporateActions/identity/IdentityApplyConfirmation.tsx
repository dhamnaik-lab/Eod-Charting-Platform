import { useEffect, useRef, useState } from 'react';
import { CorporateActionClassicDialog } from '../workspace/CorporateActionClassicWorkspace';
import type { BseNameHistoryResult, NseHistoricalIdentityResult } from '@/types/desktop';

export interface IdentityApplyReview {
  title: string; databasePath: string; changeCount: number; applyLabel: string;
  counts: { label: string; value: number }[]; notice: string;
}
export interface PendingIdentityReview { id: number; context: string; review: IdentityApplyReview; }

// Confirmation is session-local; resolving it never saves or persists approval authority.
export function createIdentityConfirmationGate(notify: (pending: PendingIdentityReview | null) => void) {
  let nextId=0;
  let pending: { request: PendingIdentityReview; resolve: (confirmed: boolean) => void } | null=null;
  return {
    ask(review: IdentityApplyReview, context: string): Promise<boolean> {
      if(pending || !review.databasePath || review.changeCount<=0) return Promise.resolve(false);
      return new Promise(resolve=>{
        const request={id:++nextId,context,review};pending={request,resolve};notify(request);
      });
    },
    settle(id: number, accepted: boolean, context: string) {
      if(!pending || pending.request.id!==id)return;
      const current=pending;pending=null;notify(null);
      current.resolve(accepted && current.request.context===context);
    },
    cancel() {
      if(!pending)return;
      const current=pending;pending=null;notify(null);current.resolve(false);
    },
  };
}

export function IdentityApplyConfirmation({ review, onCancel, onConfirm }: {
  review: IdentityApplyReview; onCancel: () => void; onConfirm: () => void;
}) {
  const cancel=useRef<HTMLButtonElement>(null);
  useEffect(()=>{cancel.current?.focus();},[]);
  return <CorporateActionClassicDialog title={review.title} onClose={onCancel} className="identity-confirmation-dialog">
    <div className="identity-confirmation-content">
      <p className="identity-confirmation-intro">Review the full plan before saving.</p>
      <dl className="identity-confirmation-database"><dt>Database</dt><dd>{review.databasePath}</dd></dl>
      <dl className="identity-confirmation-counts">{review.counts.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value.toLocaleString('en-IN')}</dd></div>)}</dl>
      <p className="identity-confirmation-scope">Apply uses the full reviewed plan. Search and category filters do not limit the changes saved.</p>
      <p>{review.notice}</p>
      <p className="identity-review-note">Cancel keeps the preview available for review. Nothing is saved until you confirm.</p>
    </div>
    <div className="identity-confirmation-actions"><button ref={cancel} type="button" onClick={onCancel}>Cancel</button>
      <button type="button" className="identity-confirmation-apply" onClick={onConfirm}>{review.applyLabel}</button></div>
  </CorporateActionClassicDialog>;
}

export function useIdentityApplyConfirmation(context: string) {
  const live=useRef(context);live.current=context;
  const [pending,setPending]=useState<PendingIdentityReview | null>(null);
  const [gate]=useState(()=>createIdentityConfirmationGate(setPending));
  useEffect(()=>()=>{gate.cancel();},[gate,context]);
  return {
    confirm: (review: IdentityApplyReview)=>gate.ask(review,context),
    dialog: pending && pending.context===context ? <IdentityApplyConfirmation key={pending.id} review={pending.review}
      onCancel={()=>gate.settle(pending.id,false,live.current)} onConfirm={()=>gate.settle(pending.id,true,live.current)}/> : null,
  };
}

export function currentIdentityReview(result: {activateCount:number;updateCount:number;deactivateCount:number}, exchange:'NSE'|'BSE', databasePath:string): IdentityApplyReview {
  return {title:`Apply ${exchange} current-universe changes`,databasePath,
    changeCount:result.activateCount+result.updateCount+result.deactivateCount,applyLabel:'Apply reviewed changes',
    counts:[{label:'Activate',value:result.activateCount},{label:'Update',value:result.updateCount},{label:'Deactivate',value:result.deactivateCount}],
    notice:'Raw price files and financial-action approvals remain unchanged.'};
}
export function nseHistoricalReview(result:NseHistoricalIdentityResult,databasePath:string):IdentityApplyReview {
  return {title:'Apply NSE historical identity',databasePath,
    changeCount:result.newSymbolChanges+result.newNameChanges+result.newCombinedChanges+result.activeSyncActivateCount+result.activeSyncUpdateCount+result.activeSyncDeactivateCount,
    applyLabel:'Apply historical identity',counts:[{label:'Symbol changes',value:result.newSymbolChanges},{label:'Name changes',value:result.newNameChanges},{label:'Combined changes',value:result.newCombinedChanges},
      {label:'Activate current instruments',value:result.activeSyncActivateCount},{label:'Update current instruments',value:result.activeSyncUpdateCount},{label:'Deactivate current instruments',value:result.activeSyncDeactivateCount}],
    notice:'Includes the current-universe effects listed above. Raw prices and financial approvals remain unchanged.'};
}
export function bseNameHistoryReview(result:BseNameHistoryResult,databasePath:string):IdentityApplyReview {
  return {title:'Apply BSE company-name history',databasePath,changeCount:result.newNameChanges,
    applyLabel:`Save ${result.newNameChanges.toLocaleString('en-IN')} name records`,
    counts:[{label:'New name-history records',value:result.newNameChanges},{label:'Duplicates — unchanged',value:result.duplicateRows},{label:'Skipped — unchanged',value:result.skippedRows},{label:'Held — unchanged',value:result.heldRows}],
    notice:'Only company-name history is saved. Trading IDs, lifecycle status, current instrument names, raw prices and financial approvals remain unchanged. Security ID changes remain held.'};
}
