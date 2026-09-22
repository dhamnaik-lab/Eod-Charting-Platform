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

describe('Identity I2-R2 official preview transition correction', () => {
  it('clears stale preview status whenever Exchange or Source context changes', () => {
    const source = readSource();
    const exchange = sliceBetween(
      source,
      "const selectIdentityExchange = (nextExchange: 'NSE' | 'BSE') => {",
      "const selectIdentitySourceMode = (nextMode: 'official' | 'manual') => {",
    );
    const sourceMode = sliceBetween(
      source,
      "const selectIdentitySourceMode = (nextMode: 'official' | 'manual') => {",
      'const browseNseIdentityArchiveRoot = async () => {',
    );

    for (const handler of [exchange, sourceMode]) {
      expect(handler).toContain('setIdentitySearchQuery(\'\')');
      expect(handler).toContain('setCurrentUniverseSyncResult(null)');
      expect(handler).toContain('setBseCurrentUniverseSyncResult(null)');
      expect(handler).toContain('setStatus(\'\')');
    }
  });

  it('makes the official primary action refresh sources and immediately preview the selected exchange', () => {
    const source = readSource();
    const orchestration = sliceBetween(
      source,
      'const refreshAndPreviewSelectedOfficialIdentitySource = async () => {',
      'const previewSelectedIdentitySource',
    );

    expect(orchestration).toContain("if (identitySourceMode !== 'official')");
    expect(orchestration).toContain("if (identityExchange === 'NSE')");
    expect(orchestration).toContain('const refreshed = await refreshNseIdentitySources()');
    expect(orchestration).toContain('await previewCurrentUniverseSync()');
    expect(orchestration).toContain('const refreshedPath = await downloadBseCurrentUniverseMaster()');
    expect(orchestration).toContain('await previewBseCurrentUniverseSync(refreshedPath)');
    expect(orchestration).not.toContain('applyNseCurrentUniverseSync');
    expect(orchestration).not.toContain('applyBseCurrentUniverseSync');
  });

  it('previews the just-downloaded BSE file directly instead of waiting for React state propagation', () => {
    const source = readSource();
    const bsePreview = sliceBetween(
      source,
      'const previewBseCurrentUniverseSync = async (masterFilePath = bseMasterFilePath) => {',
      'const applyBseCurrentUniverseSync',
    );

    expect(bsePreview).toContain('if (!masterFilePath.trim())');
    expect(bsePreview).toContain('masterFilePath: masterFilePath.trim()');
  });

  it('exposes Refresh & Preview plus a separate saved-source preview while leaving Apply explicit', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain('Refresh &amp; Preview');
    expect(identity).toContain('onClick={() => void refreshAndPreviewSelectedOfficialIdentitySource()}');
    expect(identity).toContain("identitySourceMode === 'official' ? 'Preview Saved Sources' : 'Preview Changes'");
    expect(identity).toContain('Apply Reviewed Changes');
    expect(identity).toContain('onClick={() => void applySelectedIdentitySource()}');
  });

  it('explains the disabled saved-source path without showing stale exchange status', () => {
    const source = readSource();
    const identity = sliceBetween(source, 'const renderIdentityTab = () => (', 'const renderImportsTab');

    expect(identity).toContain(
      'Refresh & Preview retrieves fresh official sources. Preview Saved Sources reuses the currently available source.',
    );
  });
});
