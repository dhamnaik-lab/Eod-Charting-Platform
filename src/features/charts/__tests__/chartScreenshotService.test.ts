import { describe, expect, it } from 'vitest';
import { buildChartScreenshotFileName } from '@/features/charts/chartScreenshotService';

describe('buildChartScreenshotFileName', () => {
  it('uses the loaded instrument, timeframe, and local capture timestamp', () => {
    expect(
      buildChartScreenshotFileName(
        { exchange: 'NSE', symbol: 'A/B:C' },
        'D',
        new Date(2026, 6, 13, 4, 22, 42),
      ),
    ).toBe('NSE_A_B_C_D_20260713042242.png');
  });

  it('uses a neutral filename for a blank chart', () => {
    expect(buildChartScreenshotFileName(null, 'W', new Date(2026, 0, 2, 3, 4, 5))).toBe('chart_W_20260102030405.png');
  });
});
