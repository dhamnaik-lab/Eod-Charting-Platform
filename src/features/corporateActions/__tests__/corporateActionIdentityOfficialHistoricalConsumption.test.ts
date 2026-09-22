import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');
const DESKTOP_TYPES = resolve(process.cwd(), 'src/types/desktop.ts');
const DATABASE_RS = resolve(process.cwd(), 'src-tauri-shell/src/database.rs');
const NSE_BACKEND = resolve(process.cwd(), 'src-tauri-shell/src/database/nse_identity_imports.rs');

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

describe('Identity F2-R2 official historical consumption', () => {
  it('makes historical archiveRootPath optional while preserving reviewed apply SHA', () => {
    const desktop = read(DESKTOP_TYPES);
    const databaseRs = read(DATABASE_RS);

    const desktopHistorical = sliceBetween(
      desktop,
      'export interface NseHistoricalIdentityPreviewInput',
      'export interface NseCurrentUniverseSyncInput',
    );
    const rustHistorical = sliceBetween(
      databaseRs,
      'pub struct NseHistoricalIdentityPreviewInput',
      'pub struct NseCurrentUniverseSyncInput',
    );

    expect(desktopHistorical).toContain('archiveRootPath?: string | null');
    expect(desktopHistorical).toContain('expectedPlanSha256: string');
    expect(rustHistorical).toContain('pub archive_root_path: Option<String>');
    expect(rustHistorical).toContain('pub expected_plan_sha256: String');
  });

  it('resolves managed database source root for official historical preview and apply', () => {
    const backend = read(NSE_BACKEND);

    const previewCommand = sliceBetween(
      backend,
      'pub async fn preview_nse_historical_identity_archive(',
      '#[tauri::command]\npub async fn apply_nse_historical_identity_archive(',
    );
    const applyCommand = sliceBetween(
      backend,
      'pub async fn apply_nse_historical_identity_archive(',
      '#[tauri::command]\npub async fn preview_nse_current_universe_sync(',
    );

    expect(backend).toContain('fn resolve_nse_historical_identity_archive_root(');
    expect(previewCommand).toContain('let managed_root = resolve_managed_nse_identity_root(&folder_path)');
    expect(previewCommand).toContain('Some(&managed_root)');
    expect(applyCommand).toContain('let managed_root = resolve_managed_nse_identity_root(&folder_path)');
    expect(applyCommand).toContain('Some(&managed_root)');
  });

  it('previews historical identity from Official mode without requiring a manual archive path', () => {
    const source = read(DATABASE_TOOLS);
    const preview = sliceBetween(
      source,
      'const previewNseHistoricalIdentityArchive = async',
      'const applyNseHistoricalIdentityArchive = async',
    );

    expect(preview).toContain(
      "const requestedArchiveRootPath = identitySourceMode === 'manual' ? identityArchiveRoot.trim() : null",
    );
    expect(preview).toContain("identitySourceMode === 'manual' && !requestedArchiveRootPath");
    expect(preview).toContain(
      "requestedArchiveRootPath === null ? {} : { archiveRootPath: requestedArchiveRootPath }",
    );
    expect(preview).toContain('sourceMode: identitySourceMode');
    expect(preview).toContain('requestedArchiveRootPath');
  });

  it('keeps reviewed historical Apply bound to source mode, database and requested root', () => {
    const source = read(DATABASE_TOOLS);
    const apply = sliceBetween(
      source,
      'const applyNseHistoricalIdentityArchive = async',
      'const previewCurrentUniverseSync = async',
    );
    const readiness = sliceBetween(
      source,
      'const nseHistoricalReviewedApplyReady = Boolean(',
      'const nseHistoricalPreviewSummary',
    );

    expect(source).toContain("sourceMode: 'official' | 'manual'");
    expect(source).toContain('requestedArchiveRootPath: string | null');
    expect(apply).toContain('reviewedAuthority.sourceMode === identitySourceMode');
    expect(apply).toContain(
      'reviewedAuthority.requestedArchiveRootPath === requestedArchiveRootPath',
    );
    expect(apply).not.toContain("identitySourceMode === 'manual',");
    expect(readiness).toContain('nseHistoricalReviewedApplyAuthority.sourceMode === identitySourceMode');
    expect(readiness).toContain(
      'nseHistoricalReviewedApplyAuthority.requestedArchiveRootPath === requestedNseArchiveRoot',
    );
  });

  it('exposes Historical Preview and reviewed Apply in the Official NSE surface', () => {
    const source = read(DATABASE_TOOLS);
    const officialSurface = sliceBetween(
      source,
      "{identitySourceMode === 'official' ? (",
      ") : identityExchange === 'NSE' ? (",
    );

    expect(officialSurface).toContain('Preview Historical Identity');
    expect(officialSurface).toContain('Apply Reviewed Historical Identity');
    expect(officialSurface).toContain('Historical NSE symbol/name chains');
  });

  it('preserves the Manual NSE Archive Root workflow', () => {
    const source = read(DATABASE_TOOLS);
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain('NSE Archive Root');
    expect(identity).toContain('Browse Folder');
    expect(identity).toContain('identityArchiveRoot');
  });
});
