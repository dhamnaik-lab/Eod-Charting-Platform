import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const DESKTOP_TYPES = resolve(process.cwd(), 'src/types/desktop.ts');
const PLATFORM_TYPES = resolve(process.cwd(), 'src/platform/types.ts');
const TAURI_DESKTOP = resolve(process.cwd(), 'src/platform/tauriDesktop.ts');
const DATABASE_RS = resolve(process.cwd(), 'src-tauri-shell/src/database.rs');
const NSE_BACKEND = resolve(process.cwd(), 'src-tauri-shell/src/database/nse_identity_imports.rs');
const INSTRUMENT_MUTATIONS = resolve(process.cwd(), 'src-tauri-shell/src/database/instrument_mutations.rs');
const MAIN_RS = resolve(process.cwd(), 'src-tauri-shell/src/main.rs');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `Missing end marker after ${startMarker}: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Identity I4 NSE historical reviewed atomic apply', () => {
  it('replaces direct historical import with preview/apply-specific SHA contracts', () => {
    const desktopTypes = read(DESKTOP_TYPES);
    const platformTypes = read(PLATFORM_TYPES);
    const tauriDesktop = read(TAURI_DESKTOP);
    const databaseRs = read(DATABASE_RS);
    const mainRs = read(MAIN_RS);

    expect(desktopTypes).toContain('export interface NseHistoricalIdentityPreviewInput');
    expect(desktopTypes).toContain('export interface NseHistoricalIdentityApplyInput');
    expect(desktopTypes).toContain('expectedPlanSha256: string');
    expect(desktopTypes).toContain('export interface NseHistoricalIdentityResult');
    expect(desktopTypes).toContain('planSha256: string');
    expect(desktopTypes).toContain('canApply: boolean');
    expect(platformTypes).toContain('NseHistoricalIdentityResult');

    expect(databaseRs).toContain('pub struct NseHistoricalIdentityPreviewInput');
    expect(databaseRs).toContain('pub struct NseHistoricalIdentityApplyInput');
    expect(databaseRs).toContain('pub expected_plan_sha256: String');
    expect(databaseRs).toContain('pub struct NseHistoricalIdentityResult');

    expect(tauriDesktop).toContain("tauriInvoke('preview_nse_historical_identity_archive', { input })");
    expect(tauriDesktop).toContain("tauriInvoke('apply_nse_historical_identity_archive', { input, operationId })");
    expect(tauriDesktop).not.toContain("tauriInvoke('import_nse_identity_archive'");
    expect(mainRs).toContain('preview_nse_historical_identity_archive');
    expect(mainRs).toContain('apply_nse_historical_identity_archive');
  });

  it('uses a deterministic historical plan fingerprint and reviewed atomic apply path', () => {
    const backend = read(NSE_BACKEND);

    expect(backend).toContain('NSE_HISTORICAL_IDENTITY_PLAN_V3_REVIEWED_CURRENT_EFFECTS');
    expect(backend).toContain('fn nse_historical_identity_plan_sha256(');
    expect(backend).toContain('pub async fn preview_nse_historical_identity_archive(');
    expect(backend).toContain('pub async fn apply_nse_historical_identity_archive(');
    expect(backend).toContain('NSE historical identity preview is stale because the source or database state changed. Preview Historical Identity again before applying.');
    expect(backend).toContain('BEGIN IMMEDIATE TRANSACTION');
    expect(backend).toContain('ROLLBACK');
    expect(backend).toContain('COMMIT');
  });

  it('makes nested identity/master/current-universe writes caller-transaction-aware', () => {
    const backend = read(NSE_BACKEND);
    const mutations = read(INSTRUMENT_MUTATIONS);

    expect(mutations).toContain('connection.is_autocommit()');
    expect(mutations).toContain('persist_identity_change_in_open_transaction');
    expect(backend).toContain('upsert_security_master_rows_in_open_transaction');
    expect(backend).toContain('apply_nse_current_universe_sync_plan_in_open_transaction');
  });

  it('provides Option C historical review with actionable default and all five filters', () => {
    const source = read(DATABASE_TOOLS);
    expect(source).toContain("type NseHistoricalIdentityFilter =");
    expect(source).toContain("'actionable'");
    expect(source).toContain("'all'");
    expect(source).toContain("'duplicates'");
    expect(source).toContain("'skipped'");
    expect(source).toContain("'errors'");
    expect(source).toContain('identityPreferences.outcome');
    expect(read('src/features/corporateActions/identity/identityDisplayPreferences.ts')).toContain("outcome: 'actionable'");
    expect(source).toContain('Preview Historical Identity');
    expect(source).toContain('Apply Reviewed Historical Identity');
    expect(source).not.toContain('Import Historical Identity');
  });

  it('binds historical authority to database/archive and cross-invalidates I3 authority', () => {
    const source = read(DATABASE_TOOLS);
    const preview = sliceBetween(source, 'const previewNseHistoricalIdentityArchive = async', 'const applyNseHistoricalIdentityArchive = async');
    const apply = sliceBetween(source, 'const applyNseHistoricalIdentityArchive = async', 'const previewCurrentUniverseSync = async');

    expect(source).toContain('type NseHistoricalReviewedApplyAuthority = {');
    expect(source).toContain('nseHistoricalReviewedApplyAuthority');
    expect(source).toContain('nseHistoricalIdentityResult');
    expect(preview).toContain('setNseReviewedApplyAuthority(null)');
    expect(preview).toContain('setNseHistoricalReviewedApplyAuthority(null)');
    expect(preview).toContain('planSha256: result.planSha256');
    expect(apply).toContain('expectedPlanSha256: reviewedAuthority.planSha256');
    expect(apply).toContain('setNseHistoricalReviewedApplyAuthority(null)');
    expect(source).toContain('nseHistoricalIdentityResult.canApply');
  });
});
