import { describe, expect, it } from 'vitest';
import { evaluateSignalRules } from '../Signals';
import type { RenderableIndicatorBundle } from '../Indicators';
import type { ChartSignalRule, OHLCBar } from '../types';

describe('Visual Alert & Crossover Signals Engine', () => {
  const bars: OHLCBar[] = [
    { date: '2026-01-01', timestamp: 1, open: 10, high: 12, low: 9, close: 10, volume: 100 },
    { date: '2026-01-02', timestamp: 2, open: 10, high: 14, low: 9, close: 12, volume: 100 },
    { date: '2026-01-03', timestamp: 3, open: 12, high: 18, low: 11, close: 16, volume: 100 },
    { date: '2026-01-04', timestamp: 4, open: 16, high: 22, low: 15, close: 20, volume: 100 },
  ];

  it('triggers Bullish Crossover when Series A crosses above Series B', () => {
    const bundle: RenderableIndicatorBundle = {
      overlays: [
        {
          indicator: { id: 'ema_fast', kind: 'EMA', placement: 'overlay', period: 5, color: '#00f' },
          title: 'EMA 5',
          lines: [{ key: 'ema', label: 'EMA 5', values: [10, 11, 15, 21], color: '#00f' }],
        },
        {
          indicator: { id: 'ema_slow', kind: 'EMA', placement: 'overlay', period: 20, color: '#f00' },
          title: 'EMA 20',
          lines: [{ key: 'ema', label: 'EMA 20', values: [12, 12, 14, 18], color: '#f00' }],
        },
      ],
      panes: [],
    };

    const goldenCrossRule: ChartSignalRule = {
      id: 'rule_golden_cross',
      label: 'Golden Cross (EMA 5 > EMA 20)',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { indicatorId: 'ema_fast' },
      seriesB: { indicatorId: 'ema_slow' },
      shape: 'arrow_up',
      color: '#22c55e',
      position: 'below_bar',
      text: 'BUY',
    };

    const markers = evaluateSignalRules(bars, bundle, [goldenCrossRule]);
    expect(markers).toHaveLength(1);
    expect(markers[0].barIndex).toBe(2);
    expect(markers[0].date).toBe('2026-01-03');
    expect(markers[0].shape).toBe('arrow_up');
    expect(markers[0].color).toBe('#22c55e');
    expect(markers[0].text).toBe('BUY');
    expect(markers[0].price).toBe(11); // Low of bar 2
  });

  it('triggers Bearish Crossover when Series A crosses below static threshold', () => {
    const bundle: RenderableIndicatorBundle = {
      overlays: [],
      panes: [
        {
          indicator: { id: 'rsi_14', kind: 'RSI', placement: 'pane', period: 14, color: '#00f' },
          title: 'RSI 14',
          lines: [{ key: 'rsi', label: 'RSI 14', values: [75, 72, 68, 65], color: '#00f' }],
        },
      ],
    };

    const rsiOverboughtRule: ChartSignalRule = {
      id: 'rule_rsi_overbought',
      label: 'RSI Overbought Exit (< 70)',
      enabled: true,
      conditionType: 'crosses_below',
      seriesA: { indicatorId: 'rsi_14' },
      seriesB: { staticValue: 70 },
      shape: 'arrow_down',
      color: '#ef4444',
      position: 'above_bar',
      text: 'SELL',
    };

    const markers = evaluateSignalRules(bars, bundle, [rsiOverboughtRule]);
    expect(markers).toHaveLength(1);
    expect(markers[0].barIndex).toBe(2);
    expect(markers[0].date).toBe('2026-01-03');
    expect(markers[0].shape).toBe('arrow_down');
    expect(markers[0].color).toBe('#ef4444');
    expect(markers[0].text).toBe('SELL');
  });
});
