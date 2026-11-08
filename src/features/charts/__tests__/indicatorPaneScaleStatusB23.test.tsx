import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { getIndicatorPaneScaleStatus } from '@/features/charts/indicatorPaneScaleStatusService';
import { setTabPaneScaleOverride, fitAllTabPanes } from '@/features/charts/chartTabStateMutationService';
import type { ChartTabState } from '@/store/chartStoreTypes';
import type { OverlayIndicator, PaneScaleOverrides } from '@/engine/types';

// SSR cannot click Scale; use the same tab-selection state hook as the live dialog.
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const result = actual.useState(initial);
      return initial === 'inputs' ? ['scale', result[1]] as unknown as typeof result : result;
    },
  };
});

const rsi: OverlayIndicator = { id: 'rsi-b23', kind: 'RSI', placement: 'pane', period: 14, color: '#129abc' };
const ema: OverlayIndicator = { id: 'ema-b23', kind: 'EMA', placement: 'overlay', period: 20, color: '#129abc' };

function dialog(indicator: OverlayIndicator, scaleMode?: 'automatic' | 'manual'): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator,
    scaleMode,
    onSave: () => undefined,
    onRemove: () => undefined,
    onClose: () => undefined,
  }));
}

describe('B23: truthful indicator pane-scale status without changing scaling', () => {
  it('resolves automatic from the absence of a scale override', () => {
    expect(getIndicatorPaneScaleStatus(rsi, {})).toBe('automatic');
    expect(getIndicatorPaneScaleStatus(ema, {})).toBe('automatic');
    expect(dialog(rsi, 'automatic')).toContain('<strong>Automatic</strong>');
  });

  it('reports manual only for its actual indicator pane, not an unrelated pane', () => {
    const overrides: PaneScaleOverrides = {
      'rsi-b23': { min: -5, max: 110 },
      other: { min: 0, max: 100 },
    };
    expect(getIndicatorPaneScaleStatus(rsi, overrides)).toBe('manual');
    expect(getIndicatorPaneScaleStatus({ ...rsi, id: 'not-rsi' }, overrides)).toBe('automatic');
    expect(dialog(rsi, 'manual')).toContain('<strong>Manual override</strong>');
    expect(dialog(rsi, 'manual')).toContain('Use Fit to return to automatic scaling.');
  });

  it('uses the price pane override for overlay indicators, not indicator-specific IDs', () => {
    const overrides: PaneScaleOverrides = {
      price: { min: 20, max: 140 },
      'ema-b23': { min: 0, max: 1 },
    };
    expect(getIndicatorPaneScaleStatus(ema, overrides)).toBe('manual');
    expect(getIndicatorPaneScaleStatus(rsi, overrides)).toBe('automatic');
  });

  it('does not report Automatic when scale context was not supplied', () => {
    const html = dialog(rsi);
    expect(html).toContain('<strong>Unavailable</strong>');
    expect(html).not.toContain('<strong>Automatic</strong>');
  });

  it('follows the unchanged actual chart-store override/Fit reset contract', () => {
    const tab = {
      id: 'tab-b23', indicators: [rsi, ema], paneScaleOverrides: {},
    } as unknown as ChartTabState;
    const manual = setTabPaneScaleOverride(tab, rsi.id, { min: -10, max: 110 });
    expect(getIndicatorPaneScaleStatus(rsi, manual.paneScaleOverrides)).toBe('manual');
    expect(manual.paneScaleOverrides[rsi.id]).toEqual({ min: -10, max: 110 });
    const fitted = setTabPaneScaleOverride(manual, rsi.id, null);
    expect(getIndicatorPaneScaleStatus(rsi, fitted.paneScaleOverrides)).toBe('automatic');
    expect(fitted.paneScaleOverrides[rsi.id]).toBeUndefined();
    const overlayManual = setTabPaneScaleOverride(fitted, 'price', { min: 75, max: 180 });
    expect(getIndicatorPaneScaleStatus(ema, overlayManual.paneScaleOverrides)).toBe('manual');
    const fittedAll = fitAllTabPanes(overlayManual);
    expect(getIndicatorPaneScaleStatus(ema, fittedAll.paneScaleOverrides)).toBe('automatic');
    expect(fittedAll.paneScaleOverrides).toEqual({});
    expect(tab.paneScaleOverrides).toEqual({});
  });

  it('keeps B14 invalid-numeric Save guard active while displaying B23 manual scale status', () => {
    const html = dialog({ ...rsi, period: 0 }, 'manual');
    expect(html).toContain('<strong>Manual override</strong>');
    expect(html).toContain('Correct invalid numeric inputs before saving.');
    expect(html).toContain('disabled=""');
  });

  it('wires pane and price-legend entry points to live chart scale overrides', () => {
    const pane = readFileSync('src/components/ChartPaneControlsOverlay.tsx', 'utf8');
    const price = readFileSync('src/components/ChartPriceLegendOverlay.tsx', 'utf8');
    const chart = readFileSync('src/components/ChartCanvas.tsx', 'utf8');
    expect(pane).toContain('scaleMode={getIndicatorPaneScaleStatus(paneSettingsIndicator, paneScaleOverrides)}');
    expect(price).toContain('scaleMode={paneScaleOverrides ? getIndicatorPaneScaleStatus(activeIndicator, paneScaleOverrides) : undefined}');
    expect(chart).toContain('paneScaleOverrides={paneScaleOverrides}');
    expect(pane).toContain('onResetPaneScale(indicator.id)');
  });
});
