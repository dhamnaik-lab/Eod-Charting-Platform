import { describe, expect, it } from 'vitest';
import { resolveChartTheme } from '@/engine/ChartEngine';
import { DARK_THEME, DEFAULT_CHART_VISUAL_SETTINGS } from '@/engine/types';

const LIGHT_THEME = {
  ...DARK_THEME,
  background: '#ffffff',
};

describe('resolveChartTheme', () => {
  it('uses the active application theme background for the default chart settings', () => {
    expect(resolveChartTheme(LIGHT_THEME, DEFAULT_CHART_VISUAL_SETTINGS).background).toBe('#ffffff');
  });

  it('preserves a deliberate chart background override', () => {
    expect(
      resolveChartTheme(LIGHT_THEME, {
        ...DEFAULT_CHART_VISUAL_SETTINGS,
        backgroundColor: '#101010',
      }).background,
    ).toBe('#101010');
  });
});
