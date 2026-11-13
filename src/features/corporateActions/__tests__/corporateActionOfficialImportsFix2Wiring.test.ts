import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
const read = (path: string) => readFileSync(resolve(process.cwd(),path),'utf8');

describe('Official Imports FIX2 active wiring', () => {
  it('exposes the exact-ID lookup through the real bridge, adapter and Tauri handler', () => {
    assert.match(read('src/types/desktop.ts'),/getCorporateActionImportsByIds\(input: CorporateActionImportLookupInput\)/);
    assert.match(read('src/types/desktop.ts'),/expectedDatabasePath: string/);
    assert.match(read('src/platform/types.ts'),/\| 'getCorporateActionImportsByIds'/);
    assert.match(read('src/platform/tauriDesktop.ts'),/tauriInvoke\('get_corporate_action_imports_by_ids', \{ input \}\)/);
    assert.match(read('src-tauri-shell/src/main.rs'),/get_corporate_action_imports_by_ids,/);
  });

  it('exposes backend-owned Auto-Approval Safe V2 through the real bridge and Tauri handler', () => {
    assert.match(read('src/types/desktop.ts'),/autoApproveCorporateActionImports\(input: CorporateActionAutoApprovalInput\)/);
    assert.match(read('src/platform/types.ts'),/\| 'autoApproveCorporateActionImports'/);
    assert.match(read('src/platform/tauriDesktop.ts'),/tauriInvoke\('auto_approve_corporate_action_imports', \{ input \}\)/);
    assert.match(read('src-tauri-shell/src/main.rs'),/auto_approve_corporate_action_imports,/);
    const source=read('src-tauri-shell/src/database/corporate_action_imports.rs');
    const start=source.indexOf('pub async fn auto_approve_corporate_action_imports(');
    const body=source.slice(start,source.indexOf('#[tauri::command]',start+1));
    assert.match(body,/verify_import_lookup_database/);
    assert.match(body,/auto_approval::auto_approve_corporate_action_imports_in_connection/);
  });
  it('uses the existing read-only connection owner for lookup without schema or notification writes', () => {
    const source=read('src-tauri-shell/src/database/corporate_action_imports.rs');
    const start=source.indexOf('pub async fn get_corporate_action_imports_by_ids(');
    assert.notEqual(start,-1);
    const body=source.slice(start,source.indexOf('#[tauri::command]',start+1));
    assert.match(body,/open_read_only_connection_for_folder/);
    assert.match(body,/expected_database_path/);
    assert.doesNotMatch(body,/open_connection_for_folder\(|emit_database_changed\(|prepare_database_connection\(/);
  });
  it('connects confirmation to exact reviewed reads and keeps post-apply reconciliation off the full queue API', () => {
    const source=read('src/components/DatabaseToolsDialogs.tsx');
    const start=source.indexOf('  const confirmOfficialImportApproval =');
    const end=source.indexOf('  const approveSelectedOfficialImports =',start);
    const confirm=source.slice(start,end);
    assert.match(confirm,/recheckReviewedCorporateActionImports\(/);
    assert.doesNotMatch(confirm,/loadAllPendingCorporateActionImports\(/);
    const apply=source.slice(source.indexOf('  const approveOfficialImportRows ='),source.indexOf('  const approveRecommendedIdentityRows ='));
    assert.match(apply,/applyReviewedCorporateActionBatches\(/);
    assert.doesNotMatch(apply,/listCorporateActionImports\(|setOfficialPreparationComplete\(false\)/);
  });
  it('keeps blocked checkboxes gated and renders counted group reasons and dedicated progress', () => {
    const source=read('src/components/DatabaseToolsDialogs.tsx');
    assert.match(source,/disabled=\{busy \|\| !officialPreparationComplete \|\| readyRows.length === 0\}/);
    assert.match(source,/summarizeOfficialImportReadiness\(/);
    assert.match(source,/OfficialImportTaskStatus/);
    assert.match(source,/aria-live="polite"/);
    assert.match(source,/expandOfficialImportActionTypes\(selectedImportActionTypes\)/);
  });
});

describe('Official Imports FIX2 lifecycle scope', () => {
  it('keeps the operation fence inside UnifiedCorporateActions rather than the Quote Editor', () => {
    const source=read('src/components/DatabaseToolsDialogs.tsx');
    assert.doesNotMatch(source.slice(0,source.indexOf('function UnifiedCorporateActions')),/officialPreparationGenerationRef/);
  });
});
