import { describe, expect, it } from 'vitest';
import {
  detectCandlestickPatterns,
  detectPatterns,
  SUPPORTED_PATTERNS,
  CANDLESTICK_PATTERN_DEFINITIONS,
  PATTERN_CATEGORIES,
} from '@/engine/Patterns';
import type { OHLCBar } from '@/engine/types';

function createDowntrendBars(): OHLCBar[] {
  const bars: OHLCBar[] = [];
  let p = 200;
  for (let i = 0; i < 20; i++) {
    p -= 2;
    bars.push({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      timestamp: 1767225600 + i * 86400,
      open: p + 1.5,
      high: p + 2.0,
      low: p - 0.5,
      close: p,
      volume: 1000,
    });
  }
  return bars;
}

function createUptrendBars(): OHLCBar[] {
  const bars: OHLCBar[] = [];
  let p = 100;
  for (let i = 0; i < 20; i++) {
    p += 2;
    bars.push({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      timestamp: 1767225600 + i * 86400,
      open: p - 1.5,
      high: p + 0.5,
      low: p - 2.0,
      close: p,
      volume: 1000,
    });
  }
  return bars;
}

describe('Japanese Candlestick Pattern Engine', () => {
  it('exports all 44 official TradingView pattern definitions', () => {
    expect(CANDLESTICK_PATTERN_DEFINITIONS.length).toBe(44);
    expect(SUPPORTED_PATTERNS.length).toBe(44);
  });

  it('categorizes patterns into Single-Candle, Two-Candle, and Multi-Candle', () => {
    expect(PATTERN_CATEGORIES).toEqual([
      { id: 'single', label: 'Single-Candle Patterns' },
      { id: 'double', label: 'Two-Candle Patterns' },
      { id: 'multi', label: 'Multi-Candle Patterns' },
    ]);

    const single = SUPPORTED_PATTERNS.filter((p) => p.category === 'single');
    const double = SUPPORTED_PATTERNS.filter((p) => p.category === 'double');
    const multi = SUPPORTED_PATTERNS.filter((p) => p.category === 'multi');

    expect(single.length).toBe(15);
    expect(double.length).toBe(15);
    expect(multi.length).toBe(14);
    expect(single.length + double.length + multi.length).toBe(44);
  });

  describe('Single-Candle Patterns', () => {
    it('detects Doji candle', () => {
      const bars = createDowntrendBars();
      // Add a perfect Doji at index 20
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 155.0,
        low: 145.0,
        close: 150.0,
        volume: 1500,
      });

      const markers = detectCandlestickPatterns(bars, ['doji']);
      expect(markers.some((m) => m.title?.includes('Doji'))).toBe(true);
    });

    it('detects Hammer in downtrend', () => {
      const bars = createDowntrendBars();
      // Add Hammer at index 20: small body near top, long lower shadow
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 150.3,
        low: 135.0,
        close: 150.3,
        volume: 1500,
      });

      const markers = detectCandlestickPatterns(bars, ['hammer_bullish']);
      expect(markers.some((m) => m.title?.includes('Hammer'))).toBe(true);
    });

    it('detects Shooting Star in uptrend', () => {
      const bars = createUptrendBars();
      // Add Shooting Star at index 20: small body near bottom, long upper shadow
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 165.0,
        low: 149.8,
        close: 149.8,
        volume: 1500,
      });

      const markers = detectCandlestickPatterns(bars, ['shooting_star_bearish']);
      expect(markers.some((m) => m.title?.includes('Shooting Star'))).toBe(true);
    });
  });

  describe('Two-Candle Patterns', () => {
    it('detects Bullish Engulfing in downtrend', () => {
      const bars = createDowntrendBars();
      // Small black candle followed by massive engulfing white candle
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 150.5,
        low: 148.5,
        close: 149.0,
        volume: 1000,
      });
      bars.push({
        date: '2026-01-22',
        timestamp: 1767225600 + 21 * 86400,
        open: 147.0,
        high: 158.0,
        low: 146.5,
        close: 156.0,
        volume: 3000,
      });

      const markers = detectCandlestickPatterns(bars, ['engulfing_bullish']);
      expect(markers.some((m) => m.title?.includes('Bullish Engulfing') || m.label === 'B-ENG')).toBe(true);
    });

    it('detects Piercing Line in downtrend', () => {
      const bars = createDowntrendBars();
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 155.0,
        high: 156.0,
        low: 145.0,
        close: 146.0,
        volume: 1500,
      });
      bars.push({
        date: '2026-01-22',
        timestamp: 1767225600 + 21 * 86400,
        open: 144.0,
        high: 154.0,
        low: 143.5,
        close: 152.0,
        volume: 2500,
      });

      const markers = detectCandlestickPatterns(bars, ['piercing_bullish']);
      expect(markers.some((m) => m.title?.includes('Piercing Line') || m.label === 'PRC')).toBe(true);
    });
  });

  describe('Multi-Candle Patterns', () => {
    it('detects Morning Star in downtrend', () => {
      const bars = createDowntrendBars();
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 155.0,
        high: 156.0,
        low: 145.0,
        close: 146.0,
        volume: 1500,
      });
      bars.push({
        date: '2026-01-22',
        timestamp: 1767225600 + 21 * 86400,
        open: 144.0,
        high: 145.0,
        low: 143.0,
        close: 144.2,
        volume: 800,
      });
      bars.push({
        date: '2026-01-23',
        timestamp: 1767225600 + 22 * 86400,
        open: 145.0,
        high: 154.0,
        low: 144.5,
        close: 152.0,
        volume: 2500,
      });

      const markers = detectCandlestickPatterns(bars, ['morning_star_bullish']);
      expect(markers.some((m) => m.title?.includes('Morning Star') || m.label === 'M-STAR')).toBe(true);
    });

    it('detects Three White Soldiers', () => {
      const bars = createDowntrendBars();
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 145.0,
        high: 151.0,
        low: 144.8,
        close: 150.5,
        volume: 2000,
      });
      bars.push({
        date: '2026-01-22',
        timestamp: 1767225600 + 21 * 86400,
        open: 148.0,
        high: 156.0,
        low: 147.8,
        close: 155.5,
        volume: 2200,
      });
      bars.push({
        date: '2026-01-23',
        timestamp: 1767225600 + 22 * 86400,
        open: 153.0,
        high: 161.0,
        low: 152.8,
        close: 160.5,
        volume: 2500,
      });

      const markers = detectCandlestickPatterns(bars, ['three_white_soldiers_bullish']);
      expect(markers.some((m) => m.title?.includes('Three White Soldiers') || m.label === '3-SOL')).toBe(true);
    });
  });

  describe('Legacy Aliases & Facade Compatibility', () => {
    it('resolves legacy alias "hammer" to "hammer_bullish"', () => {
      const bars = createDowntrendBars();
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 150.3,
        low: 135.0,
        close: 150.3,
        volume: 1500,
      });

      const markers = detectPatterns(bars, ['hammer']);
      expect(markers.length).toBeGreaterThan(0);
      expect(markers[0].label).toBe('HMR');
    });

    it('resolves legacy alias "engulfing" to bullish & bearish engulfing', () => {
      const bars = createDowntrendBars();
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 150.5,
        low: 148.5,
        close: 149.0,
        volume: 1000,
      });
      bars.push({
        date: '2026-01-22',
        timestamp: 1767225600 + 21 * 86400,
        open: 147.0,
        high: 158.0,
        low: 146.5,
        close: 156.0,
        volume: 3000,
      });

      const markers = detectPatterns(bars, ['engulfing']);
      expect(markers.some((m) => m.label === 'B-ENG')).toBe(true);
    });

    it('assigns correct directional colors (Green for Bullish, Red for Bearish)', () => {
      const bars = createDowntrendBars();
      bars.push({
        date: '2026-01-21',
        timestamp: 1767225600 + 20 * 86400,
        open: 150.0,
        high: 150.3,
        low: 135.0,
        close: 150.3,
        volume: 1500,
      });

      const bullishMarkers = detectCandlestickPatterns(bars, ['hammer_bullish']);
      expect(bullishMarkers.length).toBeGreaterThan(0);
      expect(bullishMarkers[0].color).toBe('#22c55e');
      expect(bullishMarkers[0].position).toBe('below');

      const customMarkers = detectCandlestickPatterns(bars, ['hammer_bullish'], {
        bullColor: '#00ff00',
        bearColor: '#ff0000',
      });
      expect(customMarkers[0].color).toBe('#00ff00');
    });
  });
});
