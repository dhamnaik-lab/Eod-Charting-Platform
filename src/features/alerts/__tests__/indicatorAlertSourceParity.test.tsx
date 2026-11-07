import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChartPaneControlsOverlay } from '@/components/ChartPaneControlsOverlay';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import {
  buildIndicatorAlertSeriesBundle,
  getDefaultIndicatorAlertPresetForIndicator,
  getIndicatorAlertSourceUnsupportedReason,
} from '@/features/alerts/indicatorAlertContracts';
import {
  createIndicatorAlertRule,
  evaluateIndicatorEodAlertRules,
  normalizeEodAlertRules,
} from '@/features/alerts/eodAlerts';

const ema: OverlayIndicator = {
  id: 'alert-ema-b04',
  kind: 'EMA',
  placement: 'overlay',
  period: 9,
  color: '#4287f5',
  source: 'close',
};
const rsi: OverlayIndicator = {
  id: 'alert-rsi-b04',
  kind: 'RSI',
  placement: 'pane',
  period: 14,
  color: '#a354f5',
  source: 'close',
};
const macd: OverlayIndicator = {
  id: 'alert-macd-b04',
  kind: 'MACD',
  placement: 'pane',
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  color: '#26a69a',
  signalColor: '#ffaa33',
  histogramPositiveColor: '#22aa88',
  histogramNegativeColor: '#cc4466',
  source: 'close',
};

const bars: OHLCBar[] = Array.from({ length: 95 }, (_, index) => {
  const close = 110 + index * 0.32 + Math.sin(index * 0.37) * 4;
  return {
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
    timestamp: index + 1,
    open: close + 1.2,
    high: close + 5 + (index % 4),
    low: close - 3 - (index % 3),
    close,
    volume: 1000 + index * 17,
  };
});
const alertBars = bars.map((bar) => ({ ...bar, symbol: 'TEST' }));
const instrument = { exchange: 'NSE', symbol: 'TEST' };

function paneControlsMarkup(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(ChartPaneControlsOverlay, {
    paneIndicators: [indicator],
    layout: { paneTops: [300], priceHeight: 200, volumeHeight: 100, axisWidth: 65 },
    indicatorPaneHeights: {},
    indicatorPaneHeight: 160,
    collapsedIndicatorPanes: {},
    paneScaleOverrides: {},
    paneSettingsIndicator: null,
    onStartPaneResize: () => undefined,
    onTogglePaneCollapsed: () => undefined,
    onResetPaneScale: () => undefined,
    onMovePane: () => undefined,
    onOpenPaneSettings: () => undefined,
    onCreateAlert: () => undefined,
    onSaveIndicator: () => undefined,
    onRemoveIndicator: () => undefined,
    onToggleIndicatorVisibility: () => undefined,
    onClosePaneSettings: () => undefined,
  }));
}

describe('B04: indicator alert sources and plotted values', () => {
  it('matches plotted EMA and RSI Close-source values at every completed bar', () => {
    const plotted = buildRenderableIndicators(bars, [ema, rsi]);
    const alert = buildIndicatorAlertSeriesBundle(alertBars, [
      { key: 'ema.9' },
      { key: 'rsi.14' },
    ]);
    expect(alert.series.get('ema.9')?.values).toEqual(plotted.overlays[0].lines[0].values);
    expect(alert.series.get('rsi.14')?.values).toEqual(plotted.panes[0].lines[0].values);
    expect(alert.series.get('ema.9')?.values.at(-1)).not.toBeNull();
    expect(alert.series.get('rsi.14')?.values.at(-1)).not.toBeNull();
  });

  it('matches both MACD and signal chart plots at every completed bar', () => {
    const plotted = buildRenderableIndicators(bars, [macd]);
    const alert = buildIndicatorAlertSeriesBundle(alertBars, [
      { key: 'macd.12.26.9' },
      { key: 'macdSignal.12.26.9' },
    ]);
    const lines = plotted.panes[0].lines;
    expect(alert.series.get('macd.12.26.9')?.values).toEqual(lines.find((line) => line.key === 'macd-main')?.values);
    expect(alert.series.get('macdSignal.12.26.9')?.values).toEqual(lines.find((line) => line.key === 'macd-sig')?.values);
    expect(alert.series.get('macdSignal.12.26.9')?.values.at(-1)).not.toBeNull();
  });

  it('preserves existing supported Close and omitted-source presets and rule fields', () => {
    for (const indicator of [ema, rsi, macd]) {
      const implicit: OverlayIndicator = { ...indicator, source: undefined };
      expect(getIndicatorAlertSourceUnsupportedReason(indicator)).toBeNull();
      expect(getIndicatorAlertSourceUnsupportedReason(implicit)).toBeNull();
      expect(getDefaultIndicatorAlertPresetForIndicator(implicit))
        .toEqual(getDefaultIndicatorAlertPresetForIndicator(indicator));
      const rule = createIndicatorAlertRule(instrument, indicator);
      expect(rule).not.toBeNull();
      expect(normalizeEodAlertRules([rule])).toMatchObject([{
        indicatorKind: indicator.kind,
        indicatorId: indicator.id,
        indicatorLeft: rule?.indicatorLeft,
        indicatorRight: rule?.indicatorRight,
        enabled: true,
      }]);
    }
  });

  it('rejects unsupported High/Low/composite sources for EMA, RSI and MACD', () => {
    const unsupported = [
      { ...ema, source: 'high' },
      { ...ema, source: 'open' },
      { ...rsi, source: 'low' },
      { ...rsi, source: 'hlc3' },
      { ...macd, source: 'hl2' },
      { ...macd, source: 'ohlc4' },
    ] as OverlayIndicator[];
    for (const indicator of unsupported) {
      const reason = getIndicatorAlertSourceUnsupportedReason(indicator);
      expect(reason).toContain('Close');
      expect(getDefaultIndicatorAlertPresetForIndicator(indicator)).toBeNull();
      expect(createIndicatorAlertRule(instrument, indicator)).toBeNull();
    }
  });

  it('rejects indicator chaining even when the selected source field is Close', () => {
    for (const indicator of [ema, rsi, macd]) {
      const chained: OverlayIndicator = { ...indicator, sourceIndicatorId: 'upstream-study', source: 'close' };
      expect(getIndicatorAlertSourceUnsupportedReason(chained)).toContain('chained');
      expect(getDefaultIndicatorAlertPresetForIndicator(chained)).toBeNull();
      expect(createIndicatorAlertRule(instrument, chained)).toBeNull();
    }
  });

  it('proves High input differs numerically from the Close-only alert series', () => {
    const alternative: OverlayIndicator = { ...ema, source: 'high' };
    const plotted = buildRenderableIndicators(bars, [alternative]);
    const closeOnly = buildIndicatorAlertSeriesBundle(alertBars, [{ key: 'ema.9' }]);
    expect(plotted.overlays[0].lines[0].values.at(-1))
      .not.toEqual(closeOnly.series.get('ema.9')?.values.at(-1));
    expect(createIndicatorAlertRule(instrument, alternative)).toBeNull();
  });

  it('shows an explicit disabled pane alert action with the unsupported source reason', () => {
    const unsupported = paneControlsMarkup({ ...rsi, source: 'low' });
    expect(unsupported).toContain('Indicator alerts support Close only');
    expect(unsupported).toMatch(/disabled(="")?/);
    expect(unsupported).toContain('aria-label=');
    const supported = paneControlsMarkup(rsi);
    expect(supported).toContain('Add alert on RSI');
    expect(supported).not.toContain('Indicator alerts support Close only');
  });

  it('preserves completed-bar triggering for a persisted Close-source EMA rule', () => {
    const rule = createIndicatorAlertRule(instrument, ema);
    expect(rule).not.toBeNull();
    const saved = normalizeEodAlertRules([rule]);
    expect(saved).toHaveLength(1);
    const firstRun = evaluateIndicatorEodAlertRules(saved, {
      exchange: 'NSE', symbol: 'TEST', bars: alertBars,
    });
    const stablePrefix = evaluateIndicatorEodAlertRules(saved, {
      exchange: 'NSE', symbol: 'TEST', bars: alertBars.slice(0, -1),
    });
    expect(firstRun.every((trigger) => trigger.date === alertBars.at(-1)?.date)).toBe(true);
    expect(stablePrefix.every((trigger) => trigger.date === alertBars.at(-2)?.date)).toBe(true);
    expect(saved[0].indicatorRight).toBe('ema.9');
  });
});
