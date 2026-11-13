import { chartPatternScannerDefinitions } from '@/features/chartPatterns';
import { coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import { dailyMarketScannerDefinitions } from '@/plugins/scanner/dailyMarketScanners';
import { signalScannerDefinitions } from '@/plugins/scanner/signalScanners';
import { listExternalScannerDefinitions } from '@/plugins/scanner/scannerPlugin';
import type { ScannerDefinition } from './types';

// The app owns native chart patterns, independent of plugin registration.
export function listApplicationScannerDefinitions(): ScannerDefinition[] {
  return [
    ...dailyMarketScannerDefinitions,
    ...coreOhlcvScannerDefinitions,
    ...chartPatternScannerDefinitions,
    ...signalScannerDefinitions,
    ...listExternalScannerDefinitions(),
  ];
}

const nativeChartPatternIds = new Set(chartPatternScannerDefinitions.map((definition) => definition.id));

export function requiresCoreScannerPlugin(scannerIds: readonly string[]): boolean {
  return scannerIds.some((id) => !nativeChartPatternIds.has(id));
}
