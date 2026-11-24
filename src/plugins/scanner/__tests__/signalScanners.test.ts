import { describe, expect, it } from 'vitest';
import { evaluateSignalScannerDefinitions, signalScannerDefinitions } from '../signalScanners';
import type { ScannerContext } from '../types';
import type { ChartSignalRule } from '@/engine/types';

function scannerContext(closes: readonly number[]): ScannerContext {
  const symbol = 'TEST_STOCK';
  return {
    symbol,
    exchange: 'NSE',
    bars: closes.map((close, index) => ({
      symbol,
      date: new Date(Date.UTC(2026, 5, index + 1)).toISOString().slice(0, 10),
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 10000,
    })),
  };
}

const flatMovingAverages = Array<number>(50).fill(100);
// Six half-point gains, seven one-point losses and one flat bar seed RSI at 30.
const oversoldCloses = [100, 100.5, 101, 101.5, 102, 102.5, 103, 102, 101, 100, 99, 98, 97, 96, 96];
const overboughtCloses = oversoldCloses.map((close) => 200 - close);

describe('signalScanners Engine', () => {
  it('registers visual signal scanner definitions', () => {
    expect(signalScannerDefinitions.length).toBeGreaterThanOrEqual(5);
    const ids = signalScannerDefinitions.map((d) => d.id);
    expect(ids).toContain('signal_golden_cross');
    expect(ids).toContain('signal_death_cross');
    expect(ids).toContain('signal_rsi_oversold_bounce');
    expect(ids).toContain('signal_rsi_overbought_drop');
    expect(ids).toContain('signal_active_custom_rules');
  });

  it.each([
    {
      scannerId: 'signal_golden_cross',
      ruleId: 'preset_golden_cross',
      previousCloses: flatMovingAverages,
      latestClose: 110,
      warmupCloses: [...flatMovingAverages.slice(1), 110],
      direction: 'bullish',
    },
    {
      scannerId: 'signal_death_cross',
      ruleId: 'preset_death_cross',
      previousCloses: flatMovingAverages,
      latestClose: 90,
      warmupCloses: [...flatMovingAverages.slice(1), 90],
      direction: 'bearish',
    },
    {
      scannerId: 'signal_rsi_oversold_bounce',
      ruleId: 'preset_rsi_oversold',
      previousCloses: oversoldCloses,
      latestClose: 97,
      warmupCloses: [28, 29, 31],
      direction: 'bullish',
    },
    {
      scannerId: 'signal_rsi_overbought_drop',
      ruleId: 'preset_rsi_overbought',
      previousCloses: overboughtCloses,
      latestClose: 103,
      warmupCloses: [72, 71, 69],
      direction: 'bearish',
    },
  ])('$scannerId detects a confirmed latest cross after indicator warm-up', ({
    scannerId, ruleId, previousCloses, latestClose, warmupCloses, direction,
  }) => {
    const crossingCloses = [...previousCloses, latestClose];
    const context = scannerContext(crossingCloses);
    const latestBar = context.bars.at(-1)!;
    const bullish = direction === 'bullish';

    const results = evaluateSignalScannerDefinitions(context, [scannerId]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      scannerId,
      date: latestBar.date,
      direction,
      score: bullish ? 85 : 80,
      values: {
        close: latestClose,
        trigger_price: bullish ? latestBar.low : latestBar.high,
        condition: bullish ? 'crosses_above' : 'crosses_below',
        rule_id: ruleId,
      },
    });
    expect(evaluateSignalScannerDefinitions(scannerContext(warmupCloses), [scannerId])).toEqual([]);
    expect(evaluateSignalScannerDefinitions(scannerContext([...crossingCloses, latestClose]), [scannerId])).toEqual([]);
  });

  it.each([
    ['signal_rsi_oversold_bounce', [...oversoldCloses, 96.0004]],
    ['signal_rsi_overbought_drop', [...overboughtCloses, 103.9996]],
  ] as const)('%s compares the RSI rounded by the indicator builder', (scannerId, closes) => {
    const results = evaluateSignalScannerDefinitions(scannerContext(closes), [scannerId]);
    expect(results).toEqual([]);
  });

  it('keeps the existing source fallback for a custom rule with a missing plot', () => {
    const context = scannerContext([28, 29, 31]);
    const rule: ChartSignalRule = {
      id: 'custom_rsi_bounce',
      label: 'Custom RSI 30 Bounce',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { indicatorId: 'rsi_14', plotKey: 'value' },
      seriesB: { staticValue: 30 },
      shape: 'arrow_up',
      position: 'below_bar',
      color: '#22c55e',
    };

    const results = evaluateSignalScannerDefinitions(context, ['signal_active_custom_rules'], [rule]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      scannerId: 'signal_active_custom_rules',
      direction: 'bullish',
      values: { close: 31, trigger_price: 30, rule_id: rule.id },
    });
  });
});
