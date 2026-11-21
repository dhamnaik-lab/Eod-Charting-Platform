import { describe, expect, it } from 'vitest';
import type { OHLCBar } from '@/engine/types';
import { runCoreScanner, coreOhlcvScannerDefinitions } from '@/plugins/scanner/coreOhlcvScanners';
import type { EodBar } from '@/plugins/scanner/types';
import { evaluateNativeRuleLatest, minimumBarsForExpression } from './nativeScanAst';
import { compileNativeCoreCandidate, NATIVE_CORE_CANDIDATE_IDS } from './nativeCoreRuleExpressions';

/** Deterministic valid OHLCV fixtures, including inside/outside/gap and flat candles. */
function series(seed: number, length: number): EodBar[] {
  const bars: EodBar[] = [];
  let price = 100 + (seed % 13);
  for (let i = 0; i < length; i += 1) {
    const variation = ((seed * 17 + i * 23) % 31) - 15;
    const open = price + variation * 0.17;
    const close = open + (((seed * 29 + i * 19) % 27) - 13) * 0.21;
    const flat = (seed + i) % 17 === 0;
    const pad = flat ? 0 : ((seed + i * 11) % 9) * 0.13 + 0.1;
    const high = flat ? open : Math.max(open, close) + pad;
    const low = flat ? open : Math.min(open, close) - pad;
    bars.push({
      symbol: 'TEST', date: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
      open: flat ? open : open,
      high, low, close: flat ? open : close,
      volume: ((seed * 31 + i * 37) % 900) + 1,
    });
    price = close;
  }
  return bars;
}

function evaluateCandidate(id: string, bars: EodBar[]): boolean {
  const expression = compileNativeCoreCandidate(id);
  if (!expression) throw new Error('Missing candidate: ' + id);
  const input: OHLCBar[] = bars.map((bar, index) => ({
    timestamp: index, date: bar.date, open: bar.open, high: bar.high,
    low: bar.low, close: bar.close, volume: bar.volume,
  }));
  return evaluateNativeRuleLatest(expression, input).matched;
}

describe('core OHLCV native numeric candidates — NOT production-routed', () => {
  it('covers exactly the existing ten core definitions without claiming other scanners', () => {
    expect([...NATIVE_CORE_CANDIDATE_IDS].sort())
      .toEqual(coreOhlcvScannerDefinitions.map((definition) => definition.id).sort());
    expect(compileNativeCoreCandidate('chart_exhaustion_gap')).toBeNull();
    expect(compileNativeCoreCandidate('toString')).toBeNull();
    expect(compileNativeCoreCandidate('__proto__')).toBeNull();
  });

  it('agrees with the TypeScript predicates across 20 seeds and all completed endpoints', () => {
    for (const definition of coreOhlcvScannerDefinitions) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const bars = series(seed, 45);
        for (let length = 1; length <= bars.length; length += 1) {
          const prefix = bars.slice(0, length);
          const expected = runCoreScanner({ symbol: 'TEST', exchange: 'NSE', bars: prefix }, definition) !== null;
          const actual = evaluateCandidate(definition.id, prefix);
          expect(actual, `scanner=${definition.id}; seed=${seed}; bars=${length}`).toBe(expected);
        }
      }
    }
  });

  it('uses the previous 14 candles for wide range and 6 previous candles for NR7', () => {
    const wide = compileNativeCoreCandidate('wide_range_candle');
    const nr7 = compileNativeCoreCandidate('nr7');
    expect(wide).not.toBeNull();
    expect(nr7).not.toBeNull();
    expect(minimumBarsForExpression(wide!)).toBe(15);
    expect(minimumBarsForExpression(nr7!)).toBe(7);

    const regular = series(4, 20);
    const large = regular.map((bar) => ({ ...bar }));
    large[19]!.high += 200;
    expect(evaluateCandidate('wide_range_candle', large)).toBe(true);
    const narrow = regular.map((bar) => ({ ...bar }));
    narrow[19]!.high = narrow[19]!.low + 0.0001;
    narrow[19]!.open = narrow[19]!.low + 0.00005;
    narrow[19]!.close = narrow[19]!.open;
    expect(evaluateCandidate('nr7', narrow)).toBe(true);
  });
});
