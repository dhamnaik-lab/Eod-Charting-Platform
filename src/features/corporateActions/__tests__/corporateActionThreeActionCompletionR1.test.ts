import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

/** Active-dialog contract only: never mount the retired alternate CA workspace. */
describe('Corporate Actions three-action completion R1 — preservation contract', () => {
  const ui = source('src/components/DatabaseToolsDialogs.tsx');

  it('presents Fetch, Load & Validate and explicit Approve on the accepted dialog', () => {
    expect(ui).toContain('function CorporateActionDialog');
    expect(ui).toContain('Fetch from Officials');
    expect(ui).toContain('Load &amp; Validate');
    expect(ui).toContain('Approve All Ready (');
    expect(ui).toContain('Approve Selected (');
    expect(ui).not.toContain('Load & Prepare');
    expect(ui).not.toContain('Fetch &amp; Import');
    expect(ui).toContain('Historical Backfill');
    for (const label of ['Manual Entry', 'Identity Import', 'Official Imports', 'Scan Database', 'Review Issues']) {
      expect(ui).toContain(label);
    }
  });

  it('keeps automatic preparation and explicit approval separated', () => {
    expect(ui).toContain("expectedDatabasePath: databasePath ?? '', explicitApprovalOnly: true");
    expect(ui).toContain("requestOfficialImportApproval('all-ready')");
    expect(ui).toContain("requestOfficialImportApproval('selected')");
    expect(ui).toContain('confirmOfficialImportApproval()');
    expect(ui).toContain('recheckReviewedCorporateActionImports');
    expect(ui).toContain('applyReviewedCorporateActionBatches');
    expect(ui).toContain('forceReload: true, preserveViewport: true');
  });

  it('activates specialized Dividend writer only after explicit Approve and preserves raw EOD', () => {
    const confirmation = ui.slice(ui.indexOf('const confirmOfficialImportApproval = async () => {'),ui.indexOf('const approveSelectedOfficialImports = async'));
    expect(confirmation).toContain('api.executeSimpleCashDividendWriteStage(draft.input)');
    expect(confirmation).toContain('verifyDividendWriteStageReceipt');
    expect(ui.slice(ui.indexOf('const loadAndPrepareOfficialImports = async () => {'),ui.indexOf('const loadOfficialImports = async'))).not.toContain('executeSimpleCashDividendWriteStage');
    const rust = source('src-tauri-shell/src/database/corporate_action_imports.rs');
    expect(rust).toContain('pub async fn approve_corporate_action_imports(');
    expect(rust).toContain('tauri::async_runtime::spawn_blocking(move || {');
    expect(rust).toContain('emit_database_changed(&app_handle, &snapshot)?');
    const mutations = source('src-tauri-shell/src/database/instrument_mutations.rs');
    expect(mutations).toContain('record_price_adjustment_action');
  });

  it('keeps accepted operator approval and immutable-price boundaries in AGENTS', () => {
    const agent = source('AGENTS.md');
    expect(agent).toContain('Fetch from Officials → Load & Validate → explicitly Approve Ready');
    expect(agent).toContain('NEVER execute financial approval');
    expect(agent).toContain('raw `.eod` immutability');
    expect(agent).toContain('must not be enabled or bypassed by default');
    const root = source('src/RootApp.tsx');
    expect(root).not.toContain('LazyCorporateActionWorkspace');
    expect(root).not.toContain('CorporateActionNormalWorkflowWorkspace');
  });
});
