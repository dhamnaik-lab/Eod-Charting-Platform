import type { DesktopApi, InstrumentKey, Watchlist } from '@/platform';
import type { ScannerRunTarget } from '@/plugins/scanner/types';

export const DEFAULT_LOOKBACK_BARS = 800;
export const MIN_LOOKBACK_BARS = 20;
export const DEFAULT_MAX_SYMBOLS = 50;

export type ScannerLookbackBars = number | null;

export function parseLookbackBars(value: string, fallback = DEFAULT_LOOKBACK_BARS): number {
  return parsePositiveInteger(value, fallback, MIN_LOOKBACK_BARS);
}

export function parseLookbackSelection(
  mode: 'all' | 'custom',
  value: string,
  fallback = DEFAULT_LOOKBACK_BARS,
): ScannerLookbackBars {
  return mode === 'all' ? null : parseLookbackBars(value, fallback);
}

export function parsePositiveInteger(value: string, fallback: number, minimum = 1): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.round(parsed));
}

export async function resolveScannerTargets(
  api: Pick<DesktopApi, 'listSymbols'>,
  options: {
    exchange: string;
    universeSource: 'active-chart' | 'symbol-list' | 'watchlists';
    activeInstrument: InstrumentKey | null;
    selectedWatchlists: Watchlist[];
    maxSymbols: number;
  },
): Promise<ScannerRunTarget[]> {
  if (options.universeSource === 'active-chart') {
    return options.activeInstrument ? [options.activeInstrument] : [];
  }

  if (options.universeSource === 'watchlists') {
    const mergedTargets = new Map<string, ScannerRunTarget>();
    options.selectedWatchlists.forEach((watchlist) => {
      watchlist.items
        .filter((item) => item.exchange === options.exchange)
        .forEach((item) => {
          const key = `${item.exchange}:${item.symbol}`;
          if (!mergedTargets.has(key)) {
            mergedTargets.set(key, { symbol: item.symbol, exchange: item.exchange, name: item.name });
          }
        });
    });
    return [...mergedTargets.values()];
  }

  const symbols = await api.listSymbols({
    exchange: options.exchange,
    limit: options.maxSymbols,
    seriesFilter: options.exchange === 'NSE' ? 'nseEquity' : 'all',
  });
  return symbols.map((item) => ({ symbol: item.symbol, exchange: item.exchange, name: item.name }));
}
