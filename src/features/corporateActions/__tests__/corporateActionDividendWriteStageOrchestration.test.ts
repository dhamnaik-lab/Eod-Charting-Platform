import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CorporateActionDividendWriteStageResult, CorporateActionImportRow } from '@/platform';
import {
  buildCorporateActionDividendPreparedScope,
  computeCorporateActionDividendPreparedScopeFingerprint,
} from '../legacy/corporateActionDividendPreparedScope';
import type { CorporateActionDividendPreparedScopeOutcomeState } from '../legacy/corporateActionDividendPreparedScopeOrchestration';
import {
  CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_ENABLED,
  prepareDividendWriteStageDraft,
  isDividendWriteStageDraftCurrent,
  verifyDividendWriteStageReceipt,
  type DividendWriteStageCurrentContext,
} from '../legacy/corporateActionDividendWriteStageOrchestration';

const DB = 'E:\\TA Projects\\EOD Charting Platform\\EOD DATABASE\\Nse';
function row(id: number): CorporateActionImportRow {
  return { id, exchange: 'NSE', source: 'NSE_API', sourceFile: null, symbol: `SYM${id}`, isin: null,
    bseScripCode: null, companyName: 'Fixture', purposeRaw: 'Dividend', exDate: '2026-09-01', recordDate: null,
    actionType: 'DIVIDEND', ratioNum: null, ratioDen: null, oldFaceValue: null, newFaceValue: null,
    cashAmount: 1, factor: null, priceFactor: null, parseStatus: 'PARSED', reviewStatus: 'PENDING',
    message: null, approvedCorporateActionId: null, importedAt: '2026-09-01T00:00:00Z', approvedAt: null,
    evidenceCount: 1, evidenceSources: ['NSE_API'], latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null, latestEvidenceNote: null };
}
async function fixture(ids: number[] = [7, 8, 9]) {
  const built = await buildCorporateActionDividendPreparedScope({ rows: ids.map(row),
    cycle: { generation: 3, expectedDatabasePath: DB }, currentGeneration: 3,
    currentDatabasePath: DB, complete: true });
  if (built.status !== 'READY') throw Error(built.reason);
  const scope = built.scope;
  const outcome: CorporateActionDividendPreparedScopeOutcomeState = {
    databasePath: DB, generation: 3, operationKey: scope.operationKey,
    wholeScopeFingerprint: scope.scopeFingerprint,
    result: { requested: ids.length, eligible: ids.length, ineligible: 0, alreadyApproved: 0,
      staleScope: 0, missing: 0, failed: 0, dispositions: [], batchCount: 1, completedBatchCount: 1,
      complete: true, operationalError: null, policyVersion: 'AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1',
      scopeVersion: 'CA_DIVIDEND_PREPARED_SCOPE_R1' },
  };
  const context: DividendWriteStageCurrentContext = {
    generation: 3, databasePath: DB, preparationComplete: true, cancelled: false, operationRunning: false,
  };
  return { scope, outcome, context };
}
async function ready() {
  const f = await fixture();
  const prepared = await prepareDividendWriteStageDraft({ ...f, selectedImportIds: [9, 7], getCurrentContext: () => f.context });
  if (prepared.status !== 'READY') throw Error(prepared.reason);
  return { ...f, draft: prepared.draft };
}
function receipt(input: Awaited<ReturnType<typeof ready>>['draft']['input']): CorporateActionDividendWriteStageResult {
  return { requested: 2, revalidatedEligible: 1, autoApproved: 1, ineligible: 1, alreadyApproved: 0,
    staleScope: 0, missing: 0, failed: 0, policyVersion: input.expectedPolicyVersion,
    scopeVersion: input.expectedScopeVersion, writeStageVersion: input.expectedWriteStageVersion,
    scopeFingerprint: input.expectedScopeFingerprint, complete: true, message: 'Committed',
    dispositions: [
      { importId: 7, disposition: 'AUTO_APPROVED', reason: 'eligible', corporateActionId: 42 },
      { importId: 9, disposition: 'INELIGIBLE', reason: 'not a qualified cash dividend', corporateActionId: null },
    ] };
}

describe('Dividend frontend explicit-approval integration and guarded write-stage contract', () => {
  it('enables the writer only within the existing separate confirmation action', () => {
    expect(CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_ENABLED).toBe(true);
    const ui = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
    const preparation = ui.slice(ui.indexOf('const loadAndPrepareOfficialImports = async () => {'), ui.indexOf('const loadOfficialImports = async'));
    expect(preparation).not.toContain('executeSimpleCashDividendWriteStage');
    const confirmation = ui.slice(ui.indexOf('const confirmOfficialImportApproval = async () => {'), ui.indexOf('const approveSelectedOfficialImports = async'));
    expect(confirmation).toContain('api.executeSimpleCashDividendWriteStage(draft.input)');
    expect(confirmation).toContain('verifyDividendWriteStageReceipt(draft.input, reply)');
    expect(confirmation).toContain('isDividendWriteStageDraftCurrent');
    expect(confirmation).toContain('officialOperationRunningRef.current = true');
    expect(ui).toContain('setOfficialApprovalConfirmation({');
    expect(ui).toContain('onClick={() => void confirmOfficialImportApproval()}');
    expect(ui).not.toContain('Confirm Dividend R1 Auto-Approval — Not enabled');
  });

  it('prepares only a sorted exact selected subset with six canonical fields and per-batch fingerprint', async () => {
    const { scope, draft } = await ready();
    expect(Object.keys(draft.input)).toEqual(['importIds','expectedDatabasePath','expectedPolicyVersion','expectedScopeVersion','expectedWriteStageVersion','expectedScopeFingerprint']);
    expect(draft.input.importIds).toEqual([7,9]);
    expect(draft.input.expectedPolicyVersion).toBe('AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1');
    expect(draft.input.expectedScopeVersion).toBe('CA_DIVIDEND_PREPARED_SCOPE_R1');
    expect(draft.input.expectedWriteStageVersion).toBe('CA_DIVIDEND_WRITE_STAGE_R1');
    expect(draft.input.expectedScopeFingerprint).toBe((await computeCorporateActionDividendPreparedScopeFingerprint(DB,[7,9])).scopeFingerprint);
    expect(draft.input.expectedScopeFingerprint).not.toBe(scope.scopeFingerprint);
    expect(Object.isFrozen(draft.input.importIds)).toBe(true);
  });

  it('rejects zero, duplicate, nonpositive, unsafe, out-of-scope and more than 100 IDs', async () => {
    const f = await fixture(Array.from({ length: 101 }, (_, index) => index + 1));
    for (const selectedImportIds of [[],[1,1],[0],[NaN],[Number.MAX_SAFE_INTEGER+1],[201],Array.from({ length: 101 },(_,i)=>i+1)]) {
      const result = await prepareDividendWriteStageDraft({scope:f.scope,outcome:f.outcome, selectedImportIds, getCurrentContext:()=>f.context});
      expect(result.status).toBe('BLOCKED');
    }
  });

  it('fails closed for context drift, incomplete P3C and operation concurrency', async () => {
    for (const mod of [
      {generation:4}, {databasePath:'D:\\Elsewhere'}, {preparationComplete:false}, {cancelled:true}, {operationRunning:true},
    ]) {
      const f=await fixture(); Object.assign(f.context,mod);
      expect((await prepareDividendWriteStageDraft({...f,selectedImportIds:[7],getCurrentContext:()=>f.context})).status).toBe('BLOCKED');
    }
    for (const change of [ { complete:false }, { failed:1 }, { operationalError:'diagnostic incomplete' } ]) {
      const f=await fixture(); Object.assign(f.outcome.result,change);
      expect((await prepareDividendWriteStageDraft({...f,selectedImportIds:[7],getCurrentContext:()=>f.context})).status).toBe('BLOCKED');
    }
  });

  it('blocks changed fingerprint, missing P1 scope and stale identity', async () => {
    const f=await fixture();
    expect((await prepareDividendWriteStageDraft({...f,scope:null,selectedImportIds:[7],getCurrentContext:()=>f.context})).status).toBe('BLOCKED');
    const altered={...f.scope,scopeFingerprint:'0'.repeat(64)};
    expect((await prepareDividendWriteStageDraft({...f,scope:altered, selectedImportIds:[7],getCurrentContext:()=>f.context})).status).toBe('BLOCKED');
    f.outcome.wholeScopeFingerprint='BAD';
    expect((await prepareDividendWriteStageDraft({...f,selectedImportIds:[7],getCurrentContext:()=>f.context})).status).toBe('BLOCKED');
  });

  it('rechecks identity after awaited fingerprint computation', async () => {
    const f=await fixture(); let checks=0;
    const r=await prepareDividendWriteStageDraft({...f,selectedImportIds:[7],getCurrentContext:()=>{
      checks++; if(checks===2) f.context.generation=4;return f.context;
    }});
    expect(checks).toBeGreaterThan(1);
    expect(r.status).toBe('BLOCKED');
  });

  it('invalidates frozen preview after generation, DB or operation changes', async () => {
    const f=await ready();
    expect(isDividendWriteStageDraftCurrent(f.draft,f.scope,f.outcome,f.context)).toBe(true);
    expect(isDividendWriteStageDraftCurrent(f.draft,f.scope,f.outcome,{...f.context,databasePath:'X:\\Other'})).toBe(false);
    expect(isDividendWriteStageDraftCurrent(f.draft,f.scope,f.outcome,{...f.context,operationRunning:true})).toBe(false);
    expect(isDividendWriteStageDraftCurrent(f.draft,null,f.outcome,f.context)).toBe(false);
  });

  it('accepts valid complete receipt including ineligible rows without claiming all approved', async () => {
    const {draft}=await ready();
    const result=verifyDividendWriteStageReceipt(draft.input,receipt(draft.input));
    expect(result.status).toBe('COMMITTED');
    if(result.status==='COMMITTED') expect(result.result.autoApproved).toBe(1);
  });

  it('rejects mismatched, duplicated and malformed receipt IDs and counters as ambiguous', async () => {
    const {draft}=await ready();
    for(const changed of [
      {policyVersion:'WRONG'}, {scopeFingerprint:'WRONG'}, {requested:3}, {failed:1}, {autoApproved:2},
      {dispositions:[receipt(draft.input).dispositions[0],receipt(draft.input).dispositions[0]]},
      {dispositions:[{...receipt(draft.input).dispositions[0], corporateActionId:-4},receipt(draft.input).dispositions[1]]},
      {complete:false},
    ]) {
      expect(verifyDividendWriteStageReceipt(draft.input,{...receipt(draft.input),...changed}).status).toBe('UNKNOWN_RESULT');
    }
    expect(verifyDividendWriteStageReceipt(draft.input,null).status).toBe('UNKNOWN_RESULT');
  });

  it('retains P3C lifecycle invalidation and requires explicit Apply for the only write caller', () => {
    const ui=readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'),'utf8');
    expect((ui.match(/setOfficialDividendWriteStageScope\(null\);/g)||[]).length).toBeGreaterThanOrEqual(6);
    expect((ui.match(/setOfficialDividendPreparedScopeOutcome\(null\);/g)||[]).length).toBeGreaterThanOrEqual(6);
    expect(ui).toContain('setOfficialDividendWriteStageScope(preparedScope.scope);');
    expect(ui).toContain('const loadAndPrepareOfficialImports = async () => {');
    expect(ui).toContain('const confirmOfficialImportApproval = async () => {');
    expect((ui.match(/api\.executeSimpleCashDividendWriteStage\(/g) || []).length).toBe(1);
  });
});
