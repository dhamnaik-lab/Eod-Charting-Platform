import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE_PATH = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');

function readSource(): string {
  return readFileSync(SOURCE_PATH, 'utf8');
}

function sliceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  expect(start, `Missing start marker: ${startMarker}`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(end, `Missing end marker after ${startMarker}: ${endMarker}`).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('Identity I2 compact workspace', () => {
  it('replaces the flat exchange-specific toolbar with compact Exchange and Source selectors', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain("(['NSE', 'BSE'] as const).map");
    expect(identity).toContain("(['official', 'manual'] as const).map");
    expect(identity).toContain("value === 'official' ? 'Official' : 'Manual'");
    expect(identity).toContain('identitySegmentButtonStyle');

    for (const legacyLabel of [
      'Download NSE Master',
      'Download NSE De-listed',
      'Preview NSE',
      'Apply NSE',
      'Download BSE Master',
      'Preview BSE',
      'Apply BSE',
      'Preview Sync',
      'Apply Sync',
    ]) {
      expect(identity).not.toContain(legacyLabel);
    }
  });

  it('exposes one truthful official refresh-and-preview action per exchange', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');
    const nseRefresh = sliceBetween(source, 'const refreshNseIdentitySources = async () => {', 'const updateOfficialSourceUrl');

    expect(identity).toContain('Refresh &amp; Preview');
    expect(identity).toContain('IdentityImportWorkspace');
    expect(identity).toContain('Preview Saved Sources');
    expect(identity).toContain('identityExchange');

    const masterIndex = nseRefresh.indexOf('api.downloadNseCurrentUniverseMaster()');
    const delistedIndex = nseRefresh.indexOf('api.downloadNseDelistedWorkbook()');
    expect(masterIndex).toBeGreaterThanOrEqual(0);
    expect(delistedIndex).toBeGreaterThan(masterIndex);
    expect(nseRefresh).not.toContain('applyNseCurrentUniverseSync');

    const orchestration = sliceBetween(
      source,
      'const refreshAndPreviewSelectedOfficialIdentitySource = async () => {',
      'const previewSelectedIdentitySource',
    );
    expect(orchestration).toContain('await previewCurrentUniverseSync()');
    expect(orchestration).toContain('await previewBseCurrentUniverseSync(refreshedPath)');
    expect(orchestration).not.toContain('applyNseCurrentUniverseSync');
    expect(orchestration).not.toContain('applyBseCurrentUniverseSync');
  });

  it('shows simple manual source inputs with Browse controls', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain('NSE Archive Root');
    expect(identity).toContain('Browse Folder');
    expect(identity).toContain('BSE Master CSV');
    expect(identity).toContain('Browse File');
    expect(identity).toContain("identitySourceMode === 'official'");
    expect(identity).toContain("identityExchange === 'NSE'");

    const browse = sliceBetween(source, 'const browseNseIdentityArchiveRoot = async () => {', 'const previewSelectedIdentitySource');
    expect(browse).toContain('api.pickPluginOutputDirectory({');
    expect(browse).toContain('api.pickPluginDataFile({');
    expect(browse).toContain("filterName: 'CSV Files'");
    expect(browse).toContain("extensions: ['csv']");
  });

  it('uses one shared Preview and one shared Apply control while preserving backend routes', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');
    const dispatch = sliceBetween(source, 'const previewSelectedIdentitySource = async () => {', 'const loadOfficialImports');

    expect(identity).toContain('Preview Saved Sources');
    expect(identity).toContain('Preview Changes');
    expect(identity).toContain('Apply Reviewed Changes');
    expect(identity).toContain('onClick={() => void previewSelectedIdentitySource()}');
    expect(identity).toContain('onClick={() => void applySelectedIdentitySource()}');

    expect(dispatch).toContain('previewCurrentUniverseSync(identityArchiveRoot)');
    expect(dispatch).toContain('previewCurrentUniverseSync()');
    expect(dispatch).toContain('previewBseCurrentUniverseSync()');
    expect(dispatch).toContain('applyCurrentUniverseSync(identityArchiveRoot)');
    expect(dispatch).toContain('applyCurrentUniverseSync()');
    expect(dispatch).toContain('applyBseCurrentUniverseSync()');
  });

  it('keeps historical NSE identity in a separate supported workspace with reviewed Apply', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain("historical={identityExchange === 'NSE'");
    expect(identity).toContain('Preview Historical Identity');
    expect(identity).toContain('Apply Reviewed Historical Identity');
    expect(identity).toContain('onClick={() => void previewNseHistoricalIdentityArchive()}');
    expect(identity).toContain('onClick={() => void applyNseHistoricalIdentityArchive()}');
    expect(identity).toContain('historicalToolbar=');
    expect(identity).toContain('historicalFooter=');
  });

  it('preserves I1 Current behavior while renaming the operator control to Current Chart', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain('Current Chart');
    const normalizedIdentity = identity.replace(/\s+/g, ' ');
    expect(normalizedIdentity).toContain(
      "currentUniverseSyncResult ? 'NSE' : bseCurrentUniverseSyncResult ? 'BSE' : activeInstrument?.exchange ?? null",
    );
    expect(identity).not.toContain("applyCurrentSymbolFilter(setIdentitySearchQuery, 'NSE')");
  });

  it('uses compact trading-platform dimensions and keeps the preview table dominant', () => {
    const source = readSource();
    const styles = sliceBetween(source, 'const identityControlHeaderStyle', 'const sourceUrlIconButtonStyle');

    expect(styles).toContain('height: 24');
    expect(styles).toContain('height: 28');
    expect(styles).toContain('fontSize: 11');
    expect(styles).toContain('fontSize: 12');
    expect(styles).toContain("gridTemplateColumns: '112px minmax(0, 1fr) 96px'");

    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');
    expect(identity).toContain('IdentityPreviewTable rows={filteredIdentityPreviewRows}');
  });

  it('updates help copy to describe actual NSE and BSE source composition', () => {
    const source = readSource();
    const info = sliceBetween(source, 'const renderIdentityInfoDialog = () => {', 'const renderIdentityTab');

    expect(info).toContain('current master bundle (equity, SME, and symbol-change data) plus the de-listed workbook');
    expect(info).toContain('Active, De-listed, and Suspended BSE lifecycle data');
    expect(info).toContain('Preview Historical Identity');
    expect(info).toContain('Apply Reviewed Historical Identity');
  });
});
