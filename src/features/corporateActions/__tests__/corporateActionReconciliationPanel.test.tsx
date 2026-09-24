import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CorporateActionReconciliationPanel, ReconciliationResultTable } from '../reconciliation/CorporateActionReconciliationPanel';
import type { CorporateActionReconciliationPreflightRow as Row } from '@/platform/types';

describe('R1-A panel read-only surface',()=>{
 it('renders only diagnostic actions and makes its non-mutation boundary explicit',()=>{
  const html=renderToStaticMarkup(<CorporateActionReconciliationPanel api={{previewSplitBonusReconciliation:async()=>{throw Error('not called during render');},saveTextExport:async()=>{throw Error('not called during render');},onDatabaseChanged:()=>()=>{}}} databasePath="E:/TEST" importIds={[1]} generation={0} scopeRevision={null} onClose={()=>{}} />);
  expect(html).toContain('Preview only');expect(html).toContain('Export CSV');expect(html).toContain('Export TXT');expect(html).toContain('no repairs or approvals');
  expect(html).not.toContain('Apply All');expect(html).not.toContain('Approve Selected');
 });
 it('does not silently truncate requests over 500 IDs',()=>{
  const html=renderToStaticMarkup(<CorporateActionReconciliationPanel api={{previewSplitBonusReconciliation:async()=>{throw Error('unexpected');},saveTextExport:async()=>({success:false,filePath:null}),onDatabaseChanged:()=>()=>{}}} databasePath="E:/TEST" importIds={Array.from({length:501},(_,i)=>i+1)} generation={0} scopeRevision={null} onClose={()=>{}} />);
  expect(html).toContain('500');expect(html).toContain('Nothing is truncated');
 });
 it('blocked diagnostic checkboxes remain selectable and are not approval controls',()=>{
  const row={importId:1,symbol:'TEST',actionType:'SPLIT',outcome:'EVIDENCE_BLOCKED',exDate:'2026-01-01',storedState:{reviewStatus:'UNRESOLVED'},identity:{rawSymbol:'OLD',rawIsin:'OLDISIN',eventSymbol:'TEST',eventIsin:'NEWISIN',candidates:[],evidence:[],proofState:'BLOCKED'},classification:{state:'ORDINARY_SPLIT'},price:{rawPriceRevalidation:'NOT_RUN'},ordinaryReadiness:{state:'BLOCKED'},safeV1:{state:'INELIGIBLE'},canonical:{state:'NONE',candidateIds:[]},repairPlan:[],blockers:[{code:'IDENTITY_UNRESOLVED',message:'needs evidence',evidence:[]}]} as unknown as Row;
  const html=renderToStaticMarkup(<ReconciliationResultTable rows={[row]} selected={new Set([1])} onSelect={()=>{}} />);
  expect(html).toContain('Diagnostic selection for import 1');expect(html).not.toContain('disabled');expect(html).toContain('UNRESOLVED');expect(html).toContain('OLDISIN');expect(html).toContain('NEWISIN');
 });
});
