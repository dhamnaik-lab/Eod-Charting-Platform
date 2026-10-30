import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { bseNameHistoryReview, createIdentityConfirmationGate, currentIdentityReview, IdentityApplyConfirmation, nseHistoricalReview, type PendingIdentityReview } from '../identity/IdentityApplyConfirmation';
import type { BseNameHistoryResult, NseHistoricalIdentityResult } from '@/types/desktop';

const bse={newNameChanges:1531,duplicateRows:2,skippedRows:1310,heldRows:0} as BseNameHistoryResult;
const review=bseNameHistoryReview(bse,'E:\\Reviewed Database\\EOD DATABASE');
describe('Identity in-app Apply confirmation',()=>{
  it('renders explicit destination, full-plan counts and named actions without a browser alert',()=>{
    const html=renderToStaticMarkup(<IdentityApplyConfirmation review={review} onCancel={()=>{}} onConfirm={()=>{}}/>);
    expect(html).toContain('role="dialog"');expect(html).toContain('aria-modal="true"');
    expect(html).toContain('identity-confirmation-dialog');expect(html).toContain('E:\\Reviewed Database\\EOD DATABASE');
    expect(html).toContain('1,531');expect(html).toContain('1,310');expect(html).toContain('Duplicates — unchanged');
    expect(html).toContain('>Cancel</button>');expect(html).toContain('>Save 1,531 name records</button>');
    expect(html).not.toContain('tauri.localhost');expect(html).not.toContain('>OK<');
    expect(html).toContain('Search and category filters do not limit');expect(html).toContain('Security ID changes remain held');
  });
  it('waits for explicit confirmation and resolves Cancel without authorizing Apply',async()=>{
    let pending:PendingIdentityReview|null=null;const gate=createIdentityConfirmationGate(value=>{pending=value;});
    const continuation=vi.fn();const promise=gate.ask(review,'db/source/plan1').then(continuation);
    await Promise.resolve();expect(continuation).not.toHaveBeenCalled();
    const request=pending as PendingIdentityReview|null;expect(request).not.toBeNull();
    gate.settle(request!.id,false,'db/source/plan1');await promise;expect(continuation).toHaveBeenCalledExactlyOnceWith(false);
  });
  it('consumes a confirmed request once and rejects stale double-click handlers',async()=>{
    let pending:PendingIdentityReview|null=null;const gate=createIdentityConfirmationGate(value=>{pending=value;});
    const first=gate.ask(review,'plan1');const firstId=(pending as PendingIdentityReview|null)!.id;
    gate.settle(firstId,true,'plan1');await expect(first).resolves.toBe(true);
    const second=gate.ask(review,'plan2');const secondId=(pending as PendingIdentityReview|null)!.id;
    gate.settle(firstId,true,'plan2');expect((pending as PendingIdentityReview|null)!.id).toBe(secondId);
    gate.settle(secondId,false,'plan2');await expect(second).resolves.toBe(false);
  });
  it.each(['other-db/source/plan1','db/other-source/plan1','db/source/plan2'])('rejects a confirmation after review context changes to %s',async context=>{
    let pending:PendingIdentityReview|null=null;const gate=createIdentityConfirmationGate(value=>{pending=value;});
    const promise=gate.ask(review,'db/source/plan1');gate.settle((pending as PendingIdentityReview|null)!.id,true,context);
    await expect(promise).resolves.toBe(false);
  });
  it('cancels on close/context cleanup and does not replace an already pending review',async()=>{
    let pending:PendingIdentityReview|null=null;const gate=createIdentityConfirmationGate(value=>{pending=value;});
    const first=gate.ask(review,'plan1');const firstId=(pending as PendingIdentityReview|null)!.id;
    await expect(gate.ask(review,'plan2')).resolves.toBe(false);expect((pending as PendingIdentityReview|null)!.id).toBe(firstId);
    gate.cancel();await expect(first).resolves.toBe(false);expect(pending).toBeNull();
  });
  it('cannot open a no-op review or a review without a destination',async()=>{
    const notify=vi.fn();const gate=createIdentityConfirmationGate(notify);
    await expect(gate.ask({...review,changeCount:0},'context')).resolves.toBe(false);
    await expect(gate.ask({...review,databasePath:''},'context')).resolves.toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
  it('counts only actionable BSE names while listing unchanged source records separately',()=>{
    expect(review.changeCount).toBe(1531);expect(review.counts.map(c=>c.value)).toEqual([1531,2,1310,0]);
    expect(review.notice).toContain('current instrument names');
  });
  it('uses the same confirmation surface for both current-universe exchanges and lists all NSE historical effects',()=>{
    for(const exchange of ['NSE','BSE'] as const){
      const current=currentIdentityReview({activateCount:2,updateCount:3,deactivateCount:1},exchange,'DB');
      expect(current.changeCount).toBe(6);expect(current.title).toContain(exchange);expect(current.applyLabel).toBe('Apply reviewed changes');
    }
    const nse=nseHistoricalReview({newSymbolChanges:1,newNameChanges:2,newCombinedChanges:3,activeSyncActivateCount:4,activeSyncUpdateCount:5,activeSyncDeactivateCount:6} as NseHistoricalIdentityResult,'DB');
    expect(nse.changeCount).toBe(21);expect(nse.counts).toHaveLength(6);expect(nse.notice).toContain('current-universe effects');
  });
});
