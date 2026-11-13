import type { ScannerContext, ScannerDefinition, ScannerHandler, ScannerResult } from '@/features/scanner/types';
import { gapsHandlers } from './handlers/gaps';
import { reversalsHandlers } from './handlers/reversals';
import { structuresHandlers } from './handlers/structures';
import { complexBasesHandlers } from './handlers/complexBases';

export { chartPatternScannerDefinitions } from './definitions';

export const chartPatternScannerHandlers: Record<string, ScannerHandler> = {
  ...gapsHandlers,
  ...reversalsHandlers,
  ...structuresHandlers,
  ...complexBasesHandlers,
};

export function runChartPatternScanner(
  context: ScannerContext,
  definition: ScannerDefinition,
): ScannerResult | null {
  return chartPatternScannerHandlers[definition.id]?.(context, definition) ?? null;
}
