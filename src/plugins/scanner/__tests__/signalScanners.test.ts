import { describe, expect, it } from 'vitest';
import { evaluateSignalScannerDefinitions, signalScannerDefinitions } from '../signalScanners';
import type { ScannerContext } from '../types';
import type { ChartSignalRule } from '@/engine/types';

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

  it('evaluates golden cross signal on synthetic price bars', () => {
    const bars = Array.from({ length: 60 }, (_, i) => {
      const price = i < 30 ? 100 - i * 0.5 : 85 + (i - 30) * 3;
      return {
        symbol: 'TEST_STOCK',
        date: `2026-06-${String(i + 1).padStart(2, '0')}`,
        open: price,
        high: price + 1,
        low: price - 1,
        close: price,
        volume: 10000,
      };
    });

    const context: ScannerContext = {
      symbol: 'TEST_STOCK',
      exchange: 'NSE',
      bars,
    };

    const results = evaluateSignalScannerDefinitions(context, ['signal_golden_cross']);
    expect(Array.isArray(results)).toBe(true);
  });

  it('evaluates active custom signal rules', () => {
    const bars = Array.from({ length: 40 }, (_, i) => {
      const price = i < 20 ? 100 - i : 80 + (i - 20) * 2;
      return {
        symbol: 'CUSTOM_STOCK',
        date: `2026-07-${String(i + 1).padStart(2, '0')}`,
        open: price,
        high: price + 0.5,
        low: price - 0.5,
        close: price,
        volume: 5000,
      };
    });

    const context: ScannerContext = {
      symbol: 'CUSTOM_STOCK',
      exchange: 'NSE',
      bars,
    };

    const customRules: ChartSignalRule[] = [
      {
        id: 'custom_rsi_bounce',
        label: 'Custom RSI 30 Bounce',
        enabled: true,
        conditionType: 'crosses_above',
        seriesA: { indicatorId: 'rsi_14', plotKey: 'value' },
        seriesB: { staticValue: 30 },
        shape: 'arrow_up',
        position: 'below_bar',
        color: '#22c55e',
      },
    ];

    const results = evaluateSignalScannerDefinitions(context, ['signal_active_custom_rules'], customRules);
    expect(Array.isArray(results)).toBe(true);
  });
});
