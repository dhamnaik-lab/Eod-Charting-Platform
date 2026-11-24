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

  it('uses the explicitly selected RSI plot and its value as the trigger price', () => {
    const rule: ChartSignalRule = {
      id: 'custom_rsi_plot',
      label: 'Custom RSI threshold',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { indicatorId: 'rsi_14', plotKey: 'rsi' },
      seriesB: { staticValue: 30 },
      position: 'on_series',
    };
    const closes = [...oversoldCloses, 97];
    const context = scannerContext(closes);
    const latestDate = context.bars.at(-1)!.date;
    const scannerId = 'signal_active_custom_rules';

    expect(evaluateSignalScannerDefinitions(context, [scannerId], [rule])).toEqual([{
      symbol: context.symbol,
      exchange: context.exchange,
      scannerId,
      scannerName: rule.label + ' (' + rule.label + ')',
      categoryId: 'visual_signals',
      categoryName: 'Visual Signals & Crossovers',
      date: latestDate,
      matched: true,
      direction: 'bullish',
      score: 85,
      reasons: ['Triggered ' + rule.label + ' on ' + latestDate],
      values: { close: 97, trigger_price: 36.81, condition: 'crosses_above', rule_id: rule.id },
      generatedAt: expect.any(String),
    }]);
    expect(evaluateSignalScannerDefinitions(scannerContext([28, 29, 31]), [scannerId], [rule])).toEqual([]);
    expect(evaluateSignalScannerDefinitions(scannerContext([...closes, 97]), [scannerId], [rule])).toEqual([]);
  });

  it('uses the chosen OHLC source when the indicator is unavailable', () => {
    const context = scannerContext([28, 29, 30]);
    const rule: ChartSignalRule = {
      id: 'custom_high_cross',
      label: 'Custom high threshold',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { indicatorId: 'chart_only', plotKey: 'value', source: 'high' },
      seriesB: { staticValue: 30 },
      position: 'on_series',
    };

    const results = evaluateSignalScannerDefinitions(context, ['signal_active_custom_rules'], [rule]);
    expect(results).toHaveLength(1);
    expect(results[0].values).toEqual({
      close: 30, trigger_price: 31, condition: 'crosses_above', rule_id: rule.id,
    });
  });

  it.each([
    { conditionType: 'greater_than', shape: 'arrow_up', direction: 'bullish', score: 85,
      crossing: [28, 30, 31], sameSide: [31, 32, 33], currentEqual: [28, 29, 30], triggerPrice: 30 },
    { conditionType: 'less_than', shape: 'arrow_down', direction: 'bearish', score: 80,
      crossing: [32, 30, 29], sameSide: [29, 28, 27], currentEqual: [32, 31, 30], triggerPrice: 30 },
    { conditionType: 'greater_than', shape: 'circle', direction: 'neutral', score: 80,
      crossing: [28, 30, 31], sameSide: [31, 32, 33], currentEqual: [28, 29, 30], triggerPrice: 30 },
  ] as const)('requires a fresh $conditionType crossover for a $shape rule', ({
    conditionType, shape, direction, score, crossing, sameSide, currentEqual, triggerPrice,
  }) => {
    const scannerId = 'signal_active_custom_rules';
    const rule: ChartSignalRule = {
      id: 'custom_threshold',
      label: 'Custom threshold',
      enabled: true,
      conditionType,
      seriesA: {},
      seriesB: { staticValue: 30 },
      shape,
    };
    const evaluate = (closes: readonly number[]) => evaluateSignalScannerDefinitions(
      scannerContext(closes), [scannerId], [rule],
    );

    const results = evaluate(crossing);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      direction,
      score,
      values: { trigger_price: triggerPrice, condition: conditionType, rule_id: rule.id },
    });
    expect(evaluate(sameSide)).toEqual([]);
    expect(evaluate(currentEqual)).toEqual([]);
  });

  it('returns every enabled match in rule order with distinct rule IDs', () => {
    const scannerId = 'signal_active_custom_rules';
    const context = scannerContext([28, 29, 31]);
    const firstRule: ChartSignalRule = {
      id: 'custom_first',
      label: 'Shared rule name',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { source: 'close' },
      seriesB: { staticValue: 30 },
    };
    const secondRule = { ...firstRule, id: 'custom_second' };
    const rules = [
      firstRule,
      { ...firstRule, id: 'custom_disabled', enabled: false },
      { ...firstRule, id: 'custom_no_match', seriesB: { staticValue: 32 } },
      secondRule,
    ];

    const results = evaluateSignalScannerDefinitions(context, [scannerId], rules);
    expect(results.map(({ scannerId, values }) => [scannerId, values?.rule_id])).toEqual([
      [scannerId, firstRule.id],
      [scannerId, secondRule.id],
    ]);
    expect(evaluateSignalScannerDefinitions(context, [scannerId], [])).toEqual([]);
    expect(evaluateSignalScannerDefinitions(context, ['signal_golden_cross'], rules)).toEqual([]);
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
