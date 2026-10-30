import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

const ui = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');
const rust = readFileSync(resolve(process.cwd(), 'src-tauri-shell/src/database/corporate_action_imports.rs'), 'utf8');
const policy = readFileSync(resolve(process.cwd(), 'src-tauri-shell/src/database/corporate_action_imports/auto_approval.rs'), 'utf8');

describe('CA explicit Dividend approval integration — preservation', () => {
  it('keeps Load/Validate read-only and requires user confirmation for one guarded writer', () => {
    const loadStart = ui.indexOf('const loadAndPrepareOfficialImports = async (');
    expect(loadStart).toBeGreaterThan(-1);
    const load = ui.slice(loadStart, ui.indexOf('const loadOfficialImports = async'));
    const confirm = ui.slice(ui.indexOf('const confirmOfficialImportApproval = async () => {'), ui.indexOf('const approveSelectedOfficialImports = async'));
    expect(load).not.toContain('executeSimpleCashDividendWriteStage');
    expect(confirm).toContain('api.executeSimpleCashDividendWriteStage(draft.input)');
    expect(confirm).toContain('verifyDividendWriteStageReceipt(draft.input, reply)');
    expect(confirm).toContain('Do not retry');
    expect(confirm).toContain('isDividendWriteStageDraftCurrent');
    expect((ui.match(/api\.executeSimpleCashDividendWriteStage\(/g) ?? []).length).toBe(1);
    expect(ui).toContain('Apply reviewed actions');
  });
  it('retains the full queue and refreshes only affected actions after a successful approval', () => {
    const confirm = ui.slice(ui.indexOf('const confirmOfficialImportApproval = async () => {'), ui.indexOf('const approveSelectedOfficialImports = async'));
    // The search belongs to the table, never to replacement of the loaded queue.
    expect(confirm).not.toContain('buildOfficialImportListInput');
    expect(confirm).not.toContain('setLoadedImportRows(');
    expect(confirm).not.toContain('listCorporateActionImports(');
    expect(confirm).not.toContain('loadAndPrepareOfficialImports(');
    expect(confirm).toContain('await refreshCorporateActionQueueAfterApproval({');
    expect(confirm).toContain('approvedSelection: confirmation.importIds');
    expect(confirm).toContain('setOfficialPreparationComplete(queueReconciled)');
    expect(confirm).toContain('if (!queueReconciled)');
    expect(confirm).toContain('setImportRows(refreshed.rows)');
    const failed = confirm.slice(confirm.indexOf('} catch(error) {'), confirm.indexOf('} finally {'));
    expect(failed).not.toContain('completedApprovalSummary =');
    expect(confirm).not.toContain('setOfficialPreparationComplete(true)');
    expect(confirm).not.toContain('setImportSearchQuery(');
  });
  it('routes only independently eligible Dividend P3C rows into Ready', () => {
    expect(ui).toContain("disposition?.disposition === 'ELIGIBLE' && disposition.evidence != null");
    expect(ui).toContain("row.parseStatus === 'PARSED' && row.reviewStatus === 'PENDING'");
    // The R2 optimization materializes exactly the current verified dividend
    // scope as a Set; membership is still required inside isOfficialRowReady.
    expect(ui).toContain('() => new Set(currentOfficialDividendWriteStageScope?.importIds ?? [])');
    expect(ui).toContain('[currentOfficialDividendWriteStageScope]');
    expect(ui).toContain('return Boolean(dividendPreparedImportIds.has(row.id)) &&');
    expect(ui).toContain('const normalIds = confirmation.importIds.filter');
    expect(ui).toContain('recheckReviewedCorporateActionImports');
    expect(ui).toContain('applyReviewedCorporateActionBatches');
  });
  it('Rust owner revalidates and requires post-ex-date prices before a write', () => {
    expect(policy).toContain('evaluate_simple_cash_dividend_policy_r1(');
    expect(policy).toContain('Dividend R1 requires a valid local ex-date');
    expect(policy).toContain('ROLLBACK TO SAVEPOINT corporate_action_dividend_r1_item');
    expect(rust).toContain('execute_simple_cash_dividend_write_stage_transaction_owner(app, private_input)');
    expect(rust).toContain('emit_database_changed(&app_handle, &snapshot)?');
  });
});
