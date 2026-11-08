import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import type {
  IndicatorSettingsFieldForKind,
  IndicatorSettingsPlotControlForKind,
  IndicatorSettingsSchemaForKind,
} from '@/components/IndicatorSettingsDialog';
import type { OverlayIndicator } from '@/engine/types';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

// All of these assertions are checked by `npm run typecheck:renderer`.
// Bad declarations are deliberately marked with @ts-expect-error: a loosened
// schema validator turns them into *unused* directives and fails typecheck.
type Assert<Condition extends true> = Condition;
type IsAssignable<Actual, Expected> = [Actual] extends [Expected] ? true : false;
type Field<Kind extends 'number' | 'color' | 'source', Key extends string> = {
  id: string;
  label: string;
  key: Key;
  kind: Kind;
};

type _StdevPeriodValid = Assert<IsAssignable<Field<'number', 'period'>, IndicatorSettingsFieldForKind<'STDEV'>>>;
type _TwapSourceValid = Assert<IsAssignable<Field<'source', 'source'>, IndicatorSettingsFieldForKind<'TWAP'>>>;
type _StochRsiPeriodValid = Assert<IsAssignable<Field<'number', 'rsiPeriod'>, IndicatorSettingsFieldForKind<'STOCHRSI'>>>;
type _StochRsiStyleValid = Assert<IsAssignable<Field<'color', 'signalColor'>, IndicatorSettingsFieldForKind<'STOCHRSI'>>>;
type _CprStyleValid = Assert<IsAssignable<Field<'color', 'pivotColor'>, IndicatorSettingsFieldForKind<'CPR'>>>;
type _MaRibbonNumberedColorValid = Assert<IsAssignable<Field<'color', 'color1'>, IndicatorSettingsFieldForKind<'MA_RIBBON'>>>;
type _AvwapStyleValid = Assert<IsAssignable<Field<'color', 'color'>, IndicatorSettingsFieldForKind<'AVWAP'>>>;
type _MacdPlotValid = Assert<IsAssignable<{ colorFallbackKey: 'signalColor'; kind: 'line'; id: string; label: string }, IndicatorSettingsPlotControlForKind<'MACD'>>>;

// @ts-expect-error STDEV has no supported source field.
type _RejectStdevSource = Assert<IsAssignable<Field<'source', 'source'>, IndicatorSettingsFieldForKind<'STDEV'>>>;
// @ts-expect-error TWAP is cumulative and has no supported period field.
type _RejectTwapPeriod = Assert<IsAssignable<Field<'number', 'period'>, IndicatorSettingsFieldForKind<'TWAP'>>>;
// @ts-expect-error EMA does not have the STOCHRSI-only rsiPeriod field.
type _RejectCrossKindKey = Assert<IsAssignable<Field<'number', 'rsiPeriod'>, IndicatorSettingsFieldForKind<'EMA'>>>;
// @ts-expect-error A numeric field cannot write EMA's color property.
type _RejectNumberOnColor = Assert<IsAssignable<Field<'number', 'color'>, IndicatorSettingsFieldForKind<'EMA'>>>;
// @ts-expect-error A color picker cannot write EMA's numeric period property.
type _RejectColorOnNumber = Assert<IsAssignable<Field<'color', 'period'>, IndicatorSettingsFieldForKind<'EMA'>>>;
// @ts-expect-error CPR declares no selectable source.
type _RejectCprSource = Assert<IsAssignable<Field<'source', 'source'>, IndicatorSettingsFieldForKind<'CPR'>>>;
// @ts-expect-error An imaginary signalColor field is not part of the STDEV variant.
type _RejectStdevColor = Assert<IsAssignable<Field<'color', 'signalColor'>, IndicatorSettingsFieldForKind<'STDEV'>>>;
// @ts-expect-error MACD plot fallback keys must be valid MACD colors.
type _RejectPlotKey = Assert<IsAssignable<{ colorFallbackKey: 'missingColor'; kind: 'line'; id: string; label: string }, IndicatorSettingsPlotControlForKind<'MACD'>>>;
// @ts-expect-error A TWAP schema cannot use a source-agnostic rolling Period field.
type _RejectTwapSchema = Assert<IsAssignable<{ inputs: [Field<'number', 'period'>]; style: [] }, IndicatorSettingsSchemaForKind<'TWAP'>>>;

const ema: OverlayIndicator = { id: 'b11-ema', kind: 'EMA', placement: 'overlay', period: 15, color: '#2962ff', source: 'high' };
const stdev: OverlayIndicator = { id: 'b11-stdev', kind: 'STDEV', placement: 'pane', period: 7, color: '#00bbcc' };
const twap: OverlayIndicator = { id: 'b11-twap', kind: 'TWAP', placement: 'overlay', source: 'ohlc4', color: '#bb9977' };
const stochRsi: OverlayIndicator = {
  id: 'b11-stochrsi',
  kind: 'STOCHRSI',
  placement: 'pane',
  rsiPeriod: 12,
  stochPeriod: 9,
  kPeriod: 2,
  dPeriod: 4,
  color: '#44ff77',
  signalColor: '#ff7744',
};
const cpr: OverlayIndicator = {
  id: 'b11-cpr', kind: 'CPR', placement: 'overlay', pivotColor: '#111111',
  tcColor: '#222222', bcColor: '#333333',
};
const avwap: OverlayIndicator = { id: 'b11-avwap', kind: 'AVWAP', placement: 'overlay', anchorIndex: 4, color: '#abcdef' };

function dialogHtml(indicator: OverlayIndicator): string {
  return renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
    indicator,
    onSave: () => undefined,
    onRemove: () => undefined,
    onClose: () => undefined,
  }));
}

describe('B11 — per-indicator schema typecheck and runtime preservation', () => {
  it('keeps STDEV Source hidden and TWAP Period hidden without losing editable inputs', () => {
    const stdevHtml = dialogHtml(stdev);
    expect(stdevHtml).toContain('<span>Period</span>');
    expect(stdevHtml).not.toContain('<span>Source</span>');

    const twapHtml = dialogHtml(twap);
    expect(twapHtml).toContain('<span>Source</span>');
    expect(twapHtml).not.toContain('<span>Period</span>');

    const emaHtml = dialogHtml(ema);
    expect(emaHtml).toContain('<span>Period</span>');
    expect(emaHtml).toContain('<span>Source</span>');
  });

  it('keeps the four STOCHRSI numerical fields in the same order', () => {
    const html = dialogHtml(stochRsi);
    const labels = ['RSI Period', 'Stochastic Period', '%K Smoothing', '%D Smoothing'];
    const positions = labels.map((label) => html.indexOf(`<span>${label}</span>`));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('retains empty CPR/AVWAP inputs, preserving the separate AVWAP anchor decision', () => {
    expect(dialogHtml(cpr)).toContain('No editable inputs.');
    expect(dialogHtml(avwap)).toContain('No editable inputs.');
  });

  it('roundtrips supported settings and legacy inert metadata without changing persisted keys', () => {
    const legacyStdev = { ...stdev, source: 'high' as const };
    const legacyTwap = { ...twap, period: 51 };
    const indicators = [ema, legacyStdev, legacyTwap, stochRsi, cpr, avwap];
    const original = {
      version: 1,
      activeChartTabId: 'tab-b11',
      chartTabs: [{
        id: 'tab-b11',
        title: 'B11 schema keys',
        instrument: null,
        timeframe: 'D',
        chartType: 'candles',
        renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 100 },
        indicators,
        drawings: [],
        indicatorPaneHeight: 160,
        sheets: [],
        activeSheetId: null,
        layoutMode: 'single',
      }],
    };
    const parsed = parsePersistedWorkspace(JSON.stringify(original));
    expect(parsed?.chartTabs[0].indicators).toMatchObject(indicators);
    expect(parsed?.chartTabs[0].indicators[1]).toHaveProperty('source', 'high');
    expect(parsed?.chartTabs[0].indicators[2]).toHaveProperty('period', 51);
    expect(parsed?.chartTabs[0].indicators[5]).toHaveProperty('anchorIndex', 4);
    expect(parsed?.chartTabs[0].indicators[3] && dialogHtml(parsed.chartTabs[0].indicators[3]))
      .toContain('<span>RSI Period</span>');
  });
});
