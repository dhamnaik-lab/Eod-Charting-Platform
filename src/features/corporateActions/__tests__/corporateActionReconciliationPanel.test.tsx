import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorporateActionReconciliationPanel, ReconciliationResultTable } from '../reconciliation/CorporateActionReconciliationPanel';
import type { CorporateActionReconciliationPreflightRow as Row } from '@/platform/types';

describe('R1-A panel read-only surface',()=>{
 it('renders only diagnostic actions and makes its non-mutation boundary explicit',()=>{
  const html=renderToStaticMarkup(<CorporateActionReconciliationPanel api={{previewSplitBonusReconciliation:async()=>{throw Error('not called during render');},saveTextExport:async()=>{throw Error('not called during render');},onDatabaseChanged:()=>()=>{}}} databasePath="E:/TEST" importIds={[1]} generation={0} scopeRevision={null} onClose={()=>{}} />);
  expect(html).toContain('Preview only');expect(html).toContain('Export CSV');expect(html).toContain('Export TXT');expect(html).toContain('no repairs or approvals');
  expect(html).toContain('NSE and BSE Split, Bonus, Rights, Dividend and Demerger');
  expect(html).not.toContain('Apply All');expect(html).not.toContain('Approve Selected');
 });
 it('allows reports over 500 IDs through sequential batches',()=>{
  const html=renderToStaticMarkup(<CorporateActionReconciliationPanel api={{previewSplitBonusReconciliation:async()=>{throw Error('unexpected');},saveTextExport:async()=>({success:false,filePath:null}),onDatabaseChanged:()=>()=>{}}} databasePath="E:/TEST" importIds={Array.from({length:501},(_,i)=>i+1)} generation={0} scopeRevision={null} onClose={()=>{}} />);
  expect(html).toContain('500');expect(html).toContain('Nothing is truncated');
  expect(html).toContain('sequentially');expect(html).not.toContain('scope exceeds');
  const previewButton=html.match(/<button[^>]*>Preview filtered IDs<\/button>/)?.[0];
  expect(previewButton).toBeDefined();expect(previewButton).not.toContain('disabled');
 });
 it('blocked diagnostic checkboxes remain selectable and are not approval controls',()=>{
  const row={importId:1,symbol:'TEST',actionType:'SPLIT',outcome:'EVIDENCE_BLOCKED',exDate:'2026-01-01',storedState:{reviewStatus:'UNRESOLVED'},identity:{rawSymbol:'OLD',rawIsin:'OLDISIN',eventSymbol:'TEST',eventIsin:'NEWISIN',candidates:[],evidence:[],proofState:'BLOCKED'},classification:{state:'ORDINARY_SPLIT'},price:{rawPriceRevalidation:'NOT_RUN'},ordinaryReadiness:{state:'BLOCKED'},safeV1:{state:'INELIGIBLE'},canonical:{state:'NONE',candidateIds:[]},repairPlan:[],blockers:[{code:'IDENTITY_UNRESOLVED',message:'needs evidence',evidence:[]}]} as unknown as Row;
  row.blockers[0].nextOperation='Review date-valid official identity evidence';
  row.ordinaryReadiness.message='Identity proof is required before readiness';
  const html=renderToStaticMarkup(<ReconciliationResultTable rows={[row]} selected={new Set([1])} onSelect={()=>{}} />);
  expect(html).toContain('Diagnostic selection for import 1');expect(html).not.toContain('disabled');expect(html).toContain('UNRESOLVED');expect(html).toContain('OLDISIN');expect(html).toContain('NEWISIN');
  expect(html).toContain('Next step: Review date-valid official identity evidence');
  expect(html).toContain('Identity proof is required before readiness');
 });
});
