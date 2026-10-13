import { describe, expect, it } from 'vitest';
import { resolveChartTheme } from '@/engine/ChartEngine';
import { DARK_THEME, DEFAULT_CHART_VISUAL_SETTINGS } from '@/engine/types';
import { getChartTheme } from '@/features/app/themeService';

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

  it('uses baseTheme gridLine and crosshair when settings match default fallback', () => {
    const customBase = {
      ...DARK_THEME,
      gridLine: 'rgba(123, 123, 123, 0.4)',
      crosshair: '#00ffcc',
    };
    const resolved = resolveChartTheme(customBase, DEFAULT_CHART_VISUAL_SETTINGS);
    expect(resolved.gridLine).toBe('rgba(123, 123, 123, 0.4)');
    expect(resolved.crosshair).toBe('#00ffcc');
  });

  it('preserves deliberate gridColor and crosshairColor overrides', () => {
    const resolved = resolveChartTheme(DARK_THEME, {
      ...DEFAULT_CHART_VISUAL_SETTINGS,
      gridColor: '#123456',
      crosshairColor: '#654321',
    });
    expect(resolved.gridLine).toBe('#123456');
    expect(resolved.crosshair).toBe('#654321');
  });
});

describe('getChartTheme with custom colors', () => {
  it('merges custom candle and grid colors and automatically derives wicks and volume', () => {
    const theme = getChartTheme('midnight-slate-pro', {
      candleUp: '#00ff00',
      candleDown: '#ff0000',
      gridLine: '#334455',
      crosshair: '#ffff00',
    });
    expect(theme.candleUp).toBe('#00ff00');
    expect(theme.candleDown).toBe('#ff0000');
    expect(theme.wickUp).toBe('#00ff00');
    expect(theme.wickDown).toBe('#ff0000');
    expect(theme.gridLine).toBe('#334455');
    expect(theme.crosshair).toBe('#ffff00');
    expect(theme.volumeUp).toBe('rgba(0, 255, 0, 0.24)');
    expect(theme.volumeDown).toBe('rgba(255, 0, 0, 0.24)');
  });

  it('guarantees custom candle, wick, and volume colors survive resolveChartTheme untouched', () => {
    const customTheme = getChartTheme('midnight-slate-pro', {
      candleUp: '#00ffaa',
      candleDown: '#ff0055',
    });
    const resolved = resolveChartTheme(customTheme, DEFAULT_CHART_VISUAL_SETTINGS);
    expect(resolved.candleUp).toBe('#00ffaa');
    expect(resolved.candleDown).toBe('#ff0055');
    expect(resolved.wickUp).toBe('#00ffaa');
    expect(resolved.wickDown).toBe('#ff0055');
    expect(resolved.volumeUp).toBe('rgba(0, 255, 170, 0.24)');
    expect(resolved.volumeDown).toBe('rgba(255, 0, 85, 0.24)');
  });
});

