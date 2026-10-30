import type { RegisteredPlugin } from '@/plugins/types';
import type { ScannerDefinition } from '@/plugins/scanner/types';
import { chartPatternScannerDefinitions } from '@/plugins/scanner/chartPatternScanners';
import { coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import { dailyMarketScannerDefinitions } from '@/plugins/scanner/dailyMarketScanners';
import { signalScannerDefinitions } from '@/plugins/scanner/signalScanners';
import { pluginHost } from '@/plugins/hostRuntime';

export const CORE_EOD_SCANNER_PLUGIN_ID = 'core-eod-scanner';

export const coreEodScannerPlugin: RegisteredPlugin = {
  externalLoadingSupported: false,
  defaultEnabled: true,
  manifest: {
    id: CORE_EOD_SCANNER_PLUGIN_ID,
    name: 'Core EOD Scanner',
    version: '0.1.0',
    type: 'scanner',
    status: 'bundled',
    description: 'Bundled read-only scanner plugin for completed daily OHLCV bars.',
    capabilities: [
      'core-ohlcv-scanners',
      'daily-market-scanners',
      'chart-pattern-gap-scanners',
      'visual-signals-crossover-scanners',
      'read-only-eod-bars',
      'floating-window-ui',
    ],
  },
};

export function listCoreScannerDefinitions(): ScannerDefinition[] {
  const dynamicScanners: ScannerDefinition[] = pluginHost.listRegisteredScanners().map((s) => ({
    id: s.id,
    name: s.name,
    categoryId: 'external_plugins',
    categoryName: s.categoryName || 'External Plugins',
    priority: s.priority ?? 2,
    scannerType: 'pattern',
    description: s.description || 'External plugin scanner.',
    logicText: s.description || 'External plugin evaluation.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: [],
    implementationStatus: 'ready_for_engine',
  }));
  return [
    ...dailyMarketScannerDefinitions,
    ...coreOhlcvScannerDefinitions,
    ...chartPatternScannerDefinitions,
    ...signalScannerDefinitions,
    ...dynamicScanners,
  ];
}
