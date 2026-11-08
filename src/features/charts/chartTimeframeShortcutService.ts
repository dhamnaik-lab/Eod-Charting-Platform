import type { ChartTimeframe } from '@/engine/types';

/** Match legacy D/W/M/Q/Y shortcuts, but only from the focused chart viewport. */
export function chartTimeframeForShortcut(key: string): ChartTimeframe | null {
  switch (key.toUpperCase()) {
    case 'D': return 'D';
    case 'W': return 'W';
    case 'M': return 'M';
    case 'Q': return 'Q';
    case 'Y': return 'Y';
    default: return null;
  }
}
