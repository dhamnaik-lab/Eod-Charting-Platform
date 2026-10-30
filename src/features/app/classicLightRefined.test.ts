import { describe, expect, it } from 'vitest';
import {
  APP_THEME_IDS,
  APP_THEME_OPTIONS,
  DEFAULT_APP_THEME_ID,
  getChartTheme,
  normalizeAppThemeId,
} from './themeService';

describe('Classic Light Refined theme remains optional', () => {
  it('preserves the six original IDs and adds only Refined', () => {
    expect(APP_THEME_IDS).toEqual([
      'midnight-slate-pro', 'amoled-black', 'classic-light',
      'classic-light-refined', 'deep-light', 'refinitiv-dark', 'tos-charcoal',
    ]);
    expect(APP_THEME_OPTIONS.map(({ id }) => id)).toEqual([...APP_THEME_IDS]);
    expect(APP_THEME_OPTIONS.find(({ id }) => id === 'classic-light-refined')?.label)
      .toBe('Classic Light Refined');
  });

  it('preserves the old default and normalization fallback', () => {
    expect(DEFAULT_APP_THEME_ID).toBe('midnight-slate-pro');
    expect(normalizeAppThemeId('classic-light-refined')).toBe('classic-light-refined');
    expect(normalizeAppThemeId('classic-light')).toBe('classic-light');
    expect(normalizeAppThemeId('does-not-exist')).toBe(DEFAULT_APP_THEME_ID);
  });

  it('matches original Classic Light chart palette exactly', () => {
    expect(getChartTheme('classic-light-refined')).toEqual(getChartTheme('classic-light'));
  });

  it('preserves chart custom-color overrides and their fallback behavior', () => {
    const original = getChartTheme('classic-light');
    const modified = getChartTheme('classic-light-refined', {
      candleUp: '#12ab34', gridLine: '#1e2a3a', crosshair: '#5588aa',
    });
    expect(modified.candleUp).toBe('#12ab34');
    expect(modified.wickUp).toBe('#12ab34');
    expect(modified.gridLine).toBe(original.gridLine);
    expect(modified.crosshair).toBe(original.crosshair);
  });
});
