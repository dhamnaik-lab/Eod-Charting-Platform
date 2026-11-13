import { describe, expect, it } from 'vitest';
import { chartPatternScannerDefinitions, chartPatternScannerHandlers } from '@/features/chartPatterns';
import { listApplicationScannerDefinitions, requiresCoreScannerPlugin } from '@/features/scanner/catalog';
import { coreEodScannerPlugin, listCoreScannerDefinitions } from '@/plugins/scanner/scannerPlugin';

const nativeIds = chartPatternScannerDefinitions.map((definition) => definition.id);

describe('native chart pattern integration', () => {
  it('preserves the 54 detector IDs and registered handler coverage', () => {
    expect(nativeIds).toHaveLength(54);
    expect(new Set(nativeIds).size).toBe(54);
    expect(Object.keys(chartPatternScannerHandlers).sort()).toEqual([...nativeIds].sort());
  });

  it('registers patterns in the application catalog, not the bundled plugin', () => {
    const ids = listApplicationScannerDefinitions().map((definition) => definition.id);
    expect(ids.filter((id) => nativeIds.includes(id))).toEqual(nativeIds);
    expect(listCoreScannerDefinitions().some((definition) => nativeIds.includes(definition.id))).toBe(false);
    expect(coreEodScannerPlugin.manifest.capabilities).not.toContain('chart-pattern-gap-scanners');
  });

  it('permits native-only scanning when the Core EOD Scanner plugin is disabled', () => {
    expect(requiresCoreScannerPlugin(nativeIds)).toBe(false);
    expect(requiresCoreScannerPlugin(['chart_common_gap'])).toBe(false);
    expect(requiresCoreScannerPlugin(['chart_common_gap', 'other-scanner'])).toBe(true);
  });
});
