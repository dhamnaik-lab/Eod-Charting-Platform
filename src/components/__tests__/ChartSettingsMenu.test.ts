import { describe, expect, it } from 'vitest';
import { resolveChartSettingsMenuWidth } from '@/components/ChartSettingsMenu';

describe('resolveChartSettingsMenuWidth', () => {
  it('grows with the measured price scale width', () => {
    expect(resolveChartSettingsMenuWidth(80, 1600)).toBe(320);
    expect(resolveChartSettingsMenuWidth(120, 1600)).toBe(384);
  });

  it('stays inside the available chart area', () => {
    expect(resolveChartSettingsMenuWidth(120, 300)).toBe(288);
  });
});
