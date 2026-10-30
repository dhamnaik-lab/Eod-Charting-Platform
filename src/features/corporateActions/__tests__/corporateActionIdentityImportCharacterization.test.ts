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

describe('Corporate Action Identity Import characterization authority', () => {
  it('preserves Manual Entry and the compact Identity capability surface', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(source).toContain("setActiveCorporateTab('manual')");
    expect(source).toContain('Manual Entry');
    expect(source).toContain("setActiveCorporateTab('identity')");
    expect(source).toContain('Identity Import');

    for (const label of [
      'Official source URLs',
      'Identity import information',
      'Exchange',
      'Source',
      'Refresh &amp; Preview',
      'Preview Saved Sources',
      'Preview Changes',
      'Apply Reviewed Changes',
      'NSE Archive Root',
      'Browse Folder',
      'BSE Master CSV',
      'Browse File',
      'Preview Historical Identity',
      'Apply Reviewed Historical Identity',
      'Current Chart',
    ]) {
      expect(identity).toContain(label);
    }
  });

  it('keeps the one-click NSE source refresh-and-preview separate from Apply', () => {
    const source = readSource();
    const refresh = sliceBetween(
      source,
      'const refreshNseIdentitySources = async () => {',
      'const updateOfficialSourceUrl',
    );

    const masterIndex = refresh.indexOf('api.downloadNseCurrentUniverseMaster()');
    const delistedIndex = refresh.indexOf('api.downloadNseDelistedWorkbook()');
    expect(masterIndex).toBeGreaterThanOrEqual(0);
    expect(delistedIndex).toBeGreaterThan(masterIndex);
    expect(refresh).toContain('setCurrentUniverseSyncResult(null)');
    expect(refresh).toContain('setBseCurrentUniverseSyncResult(null)');
    expect(refresh).not.toContain('applyNseCurrentUniverseSync');
    expect(refresh).not.toContain('applyBseCurrentUniverseSync');
  });

  it('keeps BSE lifecycle refresh separate from Apply and remembers the managed official file', () => {
    const source = readSource();
    const refresh = sliceBetween(
      source,
      'const downloadBseCurrentUniverseMaster = async () => {',
      'const previewBseCurrentUniverseSync',
    );

    expect(refresh).toContain('api.downloadBseCurrentUniverseMaster()');
    expect(refresh).toContain('setBseOfficialMasterFilePath(result.filePath)');
    expect(refresh).toContain('setBseMasterFilePath(result.filePath)');
    expect(refresh).toContain('setBseCurrentUniverseSyncResult(null)');
    expect(refresh).toContain('setCurrentUniverseSyncResult(null)');
    expect(refresh).not.toContain('applyBseCurrentUniverseSync');
  });

  it('keeps NSE and BSE preview operations non-applying and mutually exclusive', () => {
    const source = readSource();

    const nsePreview = sliceBetween(
      source,
      'const previewCurrentUniverseSync = async (archiveRootPath?: string) => {',
      'const refreshNseIdentitySources',
    );
    expect(nsePreview).toContain('api.previewNseCurrentUniverseSync(');
    expect(nsePreview).toContain('setCurrentUniverseSyncResult(result)');
    expect(nsePreview).toContain('setBseCurrentUniverseSyncResult(null)');
    expect(nsePreview).not.toContain('applyNseCurrentUniverseSync');
    expect(nsePreview).not.toContain('onRefresh()');
    expect(nsePreview).not.toContain('onReloadInstrument(');

    const bsePreview = sliceBetween(
      source,
      'const previewBseCurrentUniverseSync = async (masterFilePath = bseMasterFilePath) => {',
      'const applyBseCurrentUniverseSync',
    );
    expect(bsePreview).toContain('api.previewBseCurrentUniverseSync({');
    expect(bsePreview).toContain('setBseCurrentUniverseSyncResult(result)');
    expect(bsePreview).toContain('setCurrentUniverseSyncResult(null)');
    expect(bsePreview).not.toContain('applyBseCurrentUniverseSync');
    expect(bsePreview).not.toContain('onRefresh()');
    expect(bsePreview).not.toContain('onReloadInstrument(');
  });

  it('keeps Apply explicit and refreshes app/chart context only after Apply', () => {
    const source = readSource();

    const nseApply = sliceBetween(
      source,
      'const applyCurrentUniverseSync = async (archiveRootPath?: string) => {',
      'const downloadBseCurrentUniverseMaster',
    );
    expect(nseApply).toContain('api.applyNseCurrentUniverseSync(');
    expect(nseApply).toContain("executeCurrentIdentityApply('NSE'");

    const bseApply = sliceBetween(
      source,
      'const applyBseCurrentUniverseSync = async () => {',
      'const selectIdentityExchange',
    );
    expect(bseApply).toContain('api.applyBseCurrentUniverseSync({');
    expect(bseApply).toContain("executeCurrentIdentityApply('BSE'");
    const shared = sliceBetween(source, 'const executeCurrentIdentityApply = async', 'const applyCurrentUniverseSync = async');
    expect(shared.indexOf('await apply(progress)')).toBeLessThan(shared.indexOf('await onRefresh()'));
    expect(shared).toContain('await onReloadInstrument(');

    const dispatch = sliceBetween(
      source,
      'const previewSelectedIdentitySource = async () => {',
      'const loadOfficialImports',
    );
    expect(dispatch).toContain('previewCurrentUniverseSync(identityArchiveRoot)');
    expect(dispatch).toContain('previewCurrentUniverseSync()');
    expect(dispatch).toContain('previewBseCurrentUniverseSync()');
    expect(dispatch).toContain('applyCurrentUniverseSync(identityArchiveRoot)');
    expect(dispatch).toContain('applyCurrentUniverseSync()');
    expect(dispatch).toContain('applyBseCurrentUniverseSync()');
  });

  it('preserves manual NSE/BSE source selection and invalidates stale previews', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain('value={identityArchiveRoot}');
    expect(identity).toContain('setIdentityArchiveRoot(event.target.value)');
    expect(identity).toContain('setCurrentUniverseSyncResult(null)');
    expect(identity).toContain('value={bseManualMasterFilePath}');
    expect(identity).toContain('setBseManualMasterFilePath(event.target.value)');
    expect(identity).toContain('setBseMasterFilePath(event.target.value)');
    expect(identity).toContain('setBseCurrentUniverseSyncResult(null)');

    const browse = sliceBetween(source, 'const browseNseIdentityArchiveRoot = async () => {', 'const previewSelectedIdentitySource');
    expect(browse).toContain('api.pickPluginOutputDirectory({');
    expect(browse).toContain("title: 'Select NSE Identity Archive Root'");
    expect(browse).toContain('api.pickPluginDataFile({');
    expect(browse).toContain("extensions: ['csv']");
  });

  it('clears stale cross-context status and keeps official refresh-and-preview non-applying', () => {
    const source = readSource();
    const selectors = sliceBetween(
      source,
      "const selectIdentityExchange = (nextExchange: 'NSE' | 'BSE') => {",
      'const browseNseIdentityArchiveRoot',
    );
    expect(selectors.match(/setStatus\(''\)/g)?.length).toBe(2);

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

  it('keeps historical NSE identity reviewed Preview/Apply explicit and source URL reviewed saves persisted', () => {
    const source = readSource();

    const historical = sliceBetween(
      source,
      'const previewNseHistoricalIdentityArchive = async () => {',
      'const previewCurrentUniverseSync',
    );
    expect(historical).toContain(
      "const requestedArchiveRootPath = identitySourceMode === 'manual' ? identityArchiveRoot.trim() : null;",
    );
    expect(historical).toContain("if (identitySourceMode === 'manual' && !requestedArchiveRootPath)");
    expect(historical).toContain(
      'requestedArchiveRootPath === null ? {} : { archiveRootPath: requestedArchiveRootPath }',
    );
    expect(historical).toContain('sourceMode: identitySourceMode');
    expect(historical).toContain('requestedArchiveRootPath,');
    expect(historical).toContain('api.applyNseHistoricalIdentityArchive({');
    expect(historical).toContain('expectedPlanSha256: reviewedAuthority.planSha256');
    expect(historical).toContain('await onRefresh()');
    expect(historical).toContain('await onReloadInstrument(');

    const save = sliceBetween(source, 'const saveOfficialSourceUrls = async () => {', 'const resetOfficialSourceUrls');
    expect(save).toContain('api.saveOfficialSourceUrlsReviewed({');
    expect(save).toContain('expectedConfigurationFingerprint: officialSourceAuthority.configurationFingerprint');
    expect(save).toContain('expectedSourceRevisions: officialSourceAuthority.sources.map');
    expect(save).toContain('urls: normalized');
    expect(save).not.toContain('api.setSetting({');
  });
});
