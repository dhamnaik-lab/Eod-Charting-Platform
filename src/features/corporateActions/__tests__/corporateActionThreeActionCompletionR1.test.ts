import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Unified Corporate Actions approval safeguards', () => {
  const ui = source('src/components/DatabaseToolsDialogs.tsx');

  it('connects the unified Actions queue to Fetch, Load & Validate, and explicit Approve', () => {
    const queue = source('src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx');
    expect(ui).toContain('function UnifiedCorporateActions');
    expect(ui).toContain('onFetch={()=>void fetchOfficialActions()}');
    expect(ui).toContain('loadAndPrepareOfficialImports())}');
    expect(ui).toContain('onApprove={(mode,ids)=>void requestOfficialImportApproval(mode,ids)}');
    expect(queue).toContain('Fetch Data</button>');
    expect(queue).toContain('Load &amp; Validate');
    expect(queue).toContain('Approve all filtered Ready');
    expect(queue).toContain('Approve selected');
    expect(ui).not.toContain('Load & Prepare');
    expect(ui).not.toContain('Fetch &amp; Import');
    expect(ui).toContain('Historical Backfill');
    expect(ui).toContain('CorporateActionMaintenanceWorkspace section={maintenanceSection}');
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

  it('clears the previous validation status when fetch starts and exposes cancellation in Actions', () => {
    const fetch = ui.slice(ui.indexOf('const fetchOfficialActions ='), ui.indexOf('const cancelOfficialFetch ='));
    expect(fetch).toContain('setOfficialTaskProgress(null)');
    expect(fetch).toContain('officialFetchOrHistoryRequest.current === request');
    expect(fetch).toContain('if (!isCurrent()) return;');
    const actions = ui.slice(ui.indexOf("{section === 'actions' && <>"), ui.indexOf("{section === 'identity' && renderIdentityTab()}"));
    expect(actions).toContain('Cancel Fetch');
    expect(actions).toContain('cancelOfficialFetch()');
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
