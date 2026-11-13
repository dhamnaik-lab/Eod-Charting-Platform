import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS_PATH = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const DESKTOP_TYPES_PATH = resolve(process.cwd(), 'src/types/desktop.ts');
const TAURI_DESKTOP_PATH = resolve(process.cwd(), 'src/platform/tauriDesktop.ts');
const DATABASE_RS_PATH = resolve(process.cwd(), 'src-tauri-shell/src/database.rs');
const NSE_BACKEND_PATH = resolve(process.cwd(), 'src-tauri-shell/src/database/nse_identity_imports.rs');

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

describe('Identity I3 NSE reviewed-preview apply authority', () => {
  it('requires an apply-specific expected plan SHA and returns the preview plan SHA', () => {
    const desktopTypes = read(DESKTOP_TYPES_PATH);
    const databaseRs = read(DATABASE_RS_PATH);
    const tauriDesktop = read(TAURI_DESKTOP_PATH);

    expect(desktopTypes).toContain('export interface NseCurrentUniverseApplyInput extends NseCurrentUniverseSyncInput');
    expect(desktopTypes).toContain('expectedPlanSha256: string');
    expect(desktopTypes).toContain('planSha256: string');
    expect(desktopTypes).toContain(
      'applyNseCurrentUniverseSync(input: NseCurrentUniverseApplyInput, onProgress?: (progress: IdentityApplyProgress) => void): Promise<NseCurrentUniverseSyncResult>',
    );

    expect(databaseRs).toContain('pub struct NseCurrentUniverseApplyInput');
    expect(databaseRs).toContain('pub expected_plan_sha256: String');
    expect(databaseRs).toContain('pub plan_sha256: String');

    expect(tauriDesktop).toContain("tauriInvoke('apply_nse_current_universe_sync', { input, operationId, expectedDatabasePath: input.expectedDatabasePath })");
  });

  it('fingerprints the backend plan and rejects stale reviewed apply before the write helper', () => {
    const backend = read(NSE_BACKEND_PATH);
    const reporting = read(resolve(process.cwd(), 'src-tauri-shell/src/database/nse_identity_imports/apply_reporting.rs'));
    const reviewedApply = sliceBetween(reporting, 'pub(super) fn apply_reviewed(', 'fn apply_plan(');
    expect(backend).toContain('apply_reporting::apply_reviewed(connection, input, default_archive_root, &|_| {})');
    expect(backend).toContain('apply_reporting::apply_reviewed(&connection, &input, Some(&managed_root), &report)');

    expect(backend).toContain('NSE_CURRENT_UNIVERSE_SYNC_PLAN_V2_COVERAGE');
    expect(backend).toContain('NSE reviewed preview is stale because the source or database state changed. Preview again before applying.');
    expect(backend).toContain('fn nse_current_universe_plan_sha256(');
    expect(backend).toContain('fn normalize_expected_nse_plan_sha256(');

    const compareIndex = reviewedApply.indexOf('if normalize_expected_nse_plan_sha256(&input.expected_plan_sha256)? != sha');
    const writeIndex = reviewedApply.indexOf('apply_plan_checked(connection, plan, sha.clone(), report');
    expect(compareIndex).toBeGreaterThanOrEqual(0);
    expect(writeIndex).toBeGreaterThan(compareIndex);
  });

  it('stores reviewed NSE authority and sends its SHA only when the current context still matches', () => {
    const source = read(DATABASE_TOOLS_PATH);
    const preview = sliceBetween(source, 'const previewCurrentUniverseSync = async', 'const refreshNseIdentitySources');
    const apply = sliceBetween(source, 'const applyCurrentUniverseSync = async', 'const downloadBseCurrentUniverseMaster');
    const readiness = sliceBetween(source, 'const identitySelectedSourceReady', 'const identitySelectedPreview');

    expect(source).toContain('type NseReviewedApplyAuthority = {');
    expect(source).toContain('nseReviewedApplyAuthority');
    expect(preview).toContain('setNseReviewedApplyAuthority(null)');
    expect(preview).toContain('planSha256: result.planSha256');
    expect(preview).toContain('activeDatabasePath: previewDatabasePath');

    expect(apply).toContain("Preview the current NSE changes again before applying.");
    expect(apply).toContain('expectedPlanSha256: reviewedAuthority.planSha256');
    expect(apply).toContain('setNseReviewedApplyAuthority(null)');

    expect(readiness).toContain('const nseReviewedApplyReady = Boolean(');
    expect(readiness).toContain('currentUniverseSyncResult.planSha256');
    expect(readiness).toContain('nseReviewedApplyAuthority.activeDatabasePath === activeDatabasePath');
    expect(readiness).toContain("identityExchange === 'NSE' ? nseReviewedApplyReady : Boolean(");
    expect(readiness).toContain('bseReviewedApplyAuthority.planSha256 === bseCurrentUniverseSyncResult?.planSha256');
  });

  it('invalidates NSE reviewed authority on every approved context transition', () => {
    const source = read(DATABASE_TOOLS_PATH);
    const exchange = sliceBetween(source, 'const selectIdentityExchange', 'const selectIdentitySourceMode');
    const sourceMode = sliceBetween(source, 'const selectIdentitySourceMode', 'const browseNseIdentityArchiveRoot');
    const browse = sliceBetween(source, 'const browseNseIdentityArchiveRoot', 'const browseBseMasterFile');
    const refresh = sliceBetween(source, 'const refreshNseIdentitySources', 'const updateOfficialSourceUrl');
    const historical = sliceBetween(source, 'const previewNseHistoricalIdentityArchive', 'const previewCurrentUniverseSync');
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    const databaseChangeEffect = sliceBetween(
      source,
      'setLastSuccessfulOfficialFetch(readCorporateActionNormalLastFetch(activeDatabasePath));',
      'if (!hasDatabase) {',
    );
    expect(databaseChangeEffect).toContain('setNseReviewedApplyAuthority(null)');
    expect(databaseChangeEffect).toContain('[activeDatabasePath]');
    expect(exchange).toContain('setNseReviewedApplyAuthority(null)');
    expect(sourceMode).toContain('setNseReviewedApplyAuthority(null)');
    expect(browse).toContain('setNseReviewedApplyAuthority(null)');
    expect(refresh).toContain('setNseReviewedApplyAuthority(null)');
    expect(historical).toContain('setNseReviewedApplyAuthority(null)');

    const manualNseStart = identity.indexOf('value={identityArchiveRoot}');
    const manualNseEnd = identity.indexOf('placeholder="Select NSE archive root"', manualNseStart);
    expect(manualNseStart).toBeGreaterThanOrEqual(0);
    expect(manualNseEnd).toBeGreaterThan(manualNseStart);
    expect(identity.slice(manualNseStart, manualNseEnd)).toContain('setNseReviewedApplyAuthority(null)');

    expect(identity).toContain('disabled={busy || !hasDatabase || !identitySelectedApplyReady}');
  });

  it('preserves exchange-specific commands behind the shared Apply dispatcher', () => {
    const source = read(DATABASE_TOOLS_PATH);
    const dispatch = sliceBetween(source, 'const applySelectedIdentitySource = async () => {', 'const loadOfficialImports');

    expect(dispatch).toContain('await applyCurrentUniverseSync(identityArchiveRoot)');
    expect(dispatch).toContain('await applyCurrentUniverseSync()');
    expect(dispatch).toContain('await applyBseCurrentUniverseSync()');
  });

  it('legacy path cleanup rejects the retired project-root hint in the manual NSE UI', () => {
    const source = read(DATABASE_TOOLS_PATH);
    const retiredRoot = ['E:', 'TA Projects', ['Corporate', 'Actions', 'Raw'].join(' ')].join('\\');

    expect(source).not.toContain(retiredRoot);
    expect(source).toContain('placeholder="Select NSE archive root"');
  });

  it('legacy path cleanup rejects the retired project-root fixture in NSE backend tests', () => {
    const backend = read(NSE_BACKEND_PATH);

    const retiredRoot = ['E:', 'TA Projects', ['Corporate', 'Actions', 'Raw'].join(' ')].join('\\');
    expect(backend).not.toContain(retiredRoot);
  });

});
