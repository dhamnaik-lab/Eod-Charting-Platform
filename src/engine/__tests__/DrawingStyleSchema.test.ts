import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '../types';
import {
  ADVANCED_DRAWING_STYLE_KINDS,
  DRAWING_SETTINGS_TABS,
  createDrawingPresentationDraft,
  getDrawingCoordinateFields,
  getDrawingSettingsTabs,
  getDrawingStyleSchema,
  getDrawingStyleSchemas,
  resolveDrawingFillPresentationForSlot,
  resolveDrawingLinePresentationForSlot,
  isDrawingVisibleOnTimeframe,
  resolveDrawingLinePresentation,
} from '../DrawingStyleSchema';

const expectedKinds: ChartDrawing['kind'][] = [
  'hline', 'vline', 'text', 'horizontalRay', 'crossLine', 'arrowMarker', 'arrowUp', 'arrowDown',
  'flatChannel', 'disjointChannel', 'triangle', 'rotatedRect', 'arc', 'andrewsPitchfork', 'schiffPitchfork',
  'modifiedSchiffPitchfork', 'insidePitchfork', 'trendFibExtension', 'fibChannel', 'fibTimeExtension', 'fibWedge',
  'pitchfan', 'longPosition', 'shortPosition', 'projection', 'trendline', 'extendedLine', 'infoLine', 'trendAngle',
  'priceRange', 'dateRange', 'regressionTrend', 'fibTimeZone', 'fibCircles', 'fibSpiral', 'fibArcs', 'gannBox', 'circle',
  'ellipse', 'forecast', 'ray', 'arrow', 'rect', 'channel', 'fib', 'fibExtension', 'fibFan', 'gann', 'measure',
  'xabcdPattern', 'abcdPattern', 'headAndShouldersPattern', 'elliottImpulse', 'elliottCorrection',
];

describe('DrawingStyleSchema', () => {
  it('covers every persisted drawing kind exactly once', () => {
    const schemas = getDrawingStyleSchemas();
    expect(schemas).toHaveLength(expectedKinds.length);
    expect(new Set(schemas.map((schema) => schema.kind)).size).toBe(expectedKinds.length);
    for (const kind of expectedKinds) {
      expect(getDrawingStyleSchema(kind).kind).toBe(kind);
    }
  });

  it('defines the future drawing settings tabs and coordinate contracts without duplicating anchor storage', () => {
    expect(DRAWING_SETTINGS_TABS.map((tab) => tab.id)).toEqual(['style', 'coordinates', 'visibility']);
    expect(getDrawingCoordinateFields('hline').map((field) => field.id)).toEqual(['price']);
    expect(getDrawingCoordinateFields('trendline').map((field) => field.id)).toEqual([
      'startIndex', 'startPrice', 'endIndex', 'endPrice',
    ]);
    expect(getDrawingCoordinateFields('trendFibExtension')).toEqual([
      { id: 'anchors', label: 'Anchor Points', kind: 'anchor-list' },
    ]);
    expect(getDrawingSettingsTabs('longPosition').map((tab) => tab.id)).toEqual(['inputs', 'style', 'visibility']);
  });

  it('exposes independent roles for high-value multi-line families', () => {
    expect(getDrawingStyleSchema('regressionTrend').lines.map((line) => line.id)).toEqual(['upper', 'basis', 'lower']);
    expect(getDrawingStyleSchema('channel').lines.map((line) => line.id)).toEqual(['base', 'center', 'offset']);
    expect(getDrawingStyleSchema('longPosition').lines.map((line) => line.id)).toEqual(['target', 'entry', 'stop']);
    expect(getDrawingStyleSchema('longPosition').fills.map((item) => item.id)).toEqual(['reward', 'risk']);
    expect(getDrawingStyleSchema('fib').lines.length).toBeGreaterThan(7);
    expect(getDrawingStyleSchema('fib').supportsUseOneColor).toBe(true);
  });

  it('resolves legacy drawings without changing their existing visual defaults', () => {
    const drawing: ChartDrawing = {
      id: 'legacy-regression',
      kind: 'regressionTrend',
      color: '#44aaee',
      lineWidth: 2.25,
      lineStyle: 'dashed',
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 110,
    };

    expect(resolveDrawingLinePresentation(drawing, 'basis')).toEqual({
      visible: true,
      color: '#44aaee',
      lineWidth: 2.25,
      lineStyle: 'dashed',
      opacity: 1,
    });
    expect(isDrawingVisibleOnTimeframe(drawing, 'D')).toBe(true);
    expect(isDrawingVisibleOnTimeframe(drawing, 'Y')).toBe(true);
  });

  it('supports independent line overrides plus a one-color override without losing other line settings', () => {
    const drawing: ChartDrawing = {
      id: 'styled-regression',
      kind: 'regressionTrend',
      color: '#ffffff',
      lineWidth: 1.4,
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 110,
      presentation: {
        lines: {
          upper: { color: '#ff0000', visible: false, lineWidth: 3, lineStyle: 'dotted', opacity: 0.4 },
          basis: { color: '#00ff00' },
        },
      },
      visibility: { timeframes: { W: false } },
    };

    expect(resolveDrawingLinePresentation(drawing, 'upper')).toEqual({
      visible: false,
      color: '#ff0000',
      lineWidth: 3,
      lineStyle: 'dotted',
      opacity: 0.4,
    });
    expect(isDrawingVisibleOnTimeframe(drawing, 'W')).toBe(false);
    expect(isDrawingVisibleOnTimeframe(drawing, 'D')).toBe(true);

    const shared = { ...drawing, presentation: { ...drawing.presentation, useOneColor: true } } as ChartDrawing;
    expect(resolveDrawingLinePresentation(shared, 'upper').color).toBe('#ffffff');
    expect(resolveDrawingLinePresentation(shared, 'upper').lineWidth).toBe(3);
    expect(resolveDrawingLinePresentation(shared, 'upper').visible).toBe(false);
  });
  it('defines S2.1 legacy-preserving defaults for regression and channel families', () => {
    expect(ADVANCED_DRAWING_STYLE_KINDS).toEqual([
      'regressionTrend', 'channel', 'flatChannel', 'disjointChannel',
      'andrewsPitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'insidePitchfork', 'pitchfan',
      'trendFibExtension', 'fibChannel', 'fibTimeExtension', 'fibWedge',
      'fibTimeZone', 'fibCircles', 'fibSpiral', 'fibArcs', 'gannBox',
      'fib', 'fibExtension', 'fibFan', 'gann',
      'longPosition', 'shortPosition',
    ]);

    const parallel: ChartDrawing = {
      id: 'parallel-defaults',
      kind: 'channel',
      color: '#8ab4f8',
      lineWidth: 2,
      lineStyle: 'solid',
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 110,
      offset: 8,
    };
    expect(resolveDrawingLinePresentationForSlot(parallel, 'base').lineStyle).toBe('solid');
    expect(resolveDrawingLinePresentationForSlot(parallel, 'center').lineStyle).toBe('dashed');
    expect(resolveDrawingFillPresentationForSlot(parallel, 'channel')).toEqual({
      visible: false,
      color: '#8ab4f8',
      opacity: 0.08,
    });
    const parallelWithFill = {
      ...parallel,
      presentation: { fills: { channel: { visible: true, opacity: 0.2 } } },
    } as ChartDrawing;
    expect(resolveDrawingFillPresentationForSlot(parallelWithFill, 'channel')).toMatchObject({
      visible: true,
      opacity: 0.2,
    });

    const regression: ChartDrawing = {
      id: 'regression-defaults',
      kind: 'regressionTrend',
      color: '#22c55e',
      lineWidth: 1.8,
      lineStyle: 'dotted',
      startIndex: 5,
      startPrice: 95,
      endIndex: 30,
      endPrice: 115,
    };
    expect(resolveDrawingFillPresentationForSlot(regression, 'channel')).toEqual({
      visible: true,
      color: '#22c55e',
      opacity: 0.08,
    });
  });

  it('migrates legacy shared-color drafts to direct per-line colors without losing independent settings', () => {
    const drawing: ChartDrawing = {
      id: 'styled-channel',
      kind: 'channel',
      color: '#ffffff',
      lineWidth: 1.4,
      startIndex: 10,
      startPrice: 100,
      endIndex: 20,
      endPrice: 110,
      offset: 4,
      presentation: {
        useOneColor: true,
        lines: {
          base: { color: '#ff0000', lineWidth: 3 },
          center: { color: '#00ff00' },
          offset: { color: '#0000ff' },
        },
      },
    };

    const draft = createDrawingPresentationDraft(drawing);
    expect(draft.useOneColor).toBe(false);
    expect(draft.lines?.base?.color).toBe('#ffffff');
    expect(draft.lines?.center?.color).toBe('#ffffff');
    expect(draft.lines?.offset?.color).toBe('#ffffff');
    expect(draft.lines?.center?.lineStyle).toBe('dashed');
    expect(draft.fills?.channel?.visible).toBe(false);

    const independentWithoutFlag = {
      ...drawing,
      presentation: { lines: { base: { color: '#ff00ff' } } },
    } as ChartDrawing;
    expect(createDrawingPresentationDraft(independentWithoutFlag).useOneColor).toBe(false);
  });


  it('defines S2.2 legacy-preserving defaults for pitchforks and pitchfan rays', () => {
    for (const kind of ['andrewsPitchfork', 'schiffPitchfork', 'modifiedSchiffPitchfork', 'insidePitchfork'] as const) {
      const drawing: ChartDrawing = {
        id: `${kind}-defaults`,
        kind,
        color: '#8ab4f8',
        lineWidth: 2,
        lineStyle: 'dashed',
        anchors: [
          { barIndex: 10, price: 100 },
          { barIndex: 20, price: 115 },
          { barIndex: 24, price: 92 },
        ],
      };
      expect(resolveDrawingLinePresentationForSlot(drawing, 'median')).toMatchObject({ opacity: 1, lineStyle: 'dashed' });
      expect(resolveDrawingLinePresentationForSlot(drawing, 'upper')).toMatchObject({ opacity: 0.9, lineStyle: 'dashed' });
      expect(resolveDrawingLinePresentationForSlot(drawing, 'lower')).toMatchObject({ opacity: 0.9, lineStyle: 'dashed' });
    }

    const fan: ChartDrawing = {
      id: 'pitchfan-defaults',
      kind: 'pitchfan',
      color: '#f59e0b',
      lineWidth: 1.6,
      lineStyle: 'solid',
      anchors: [
        { barIndex: 10, price: 100 },
        { barIndex: 20, price: 115 },
        { barIndex: 24, price: 92 },
      ],
    };
    expect(resolveDrawingLinePresentationForSlot(fan, 'ray:0.236').opacity).toBe(0.65);
    expect(resolveDrawingLinePresentationForSlot(fan, 'ray:0.382').opacity).toBe(1);
    expect(resolveDrawingLinePresentationForSlot(fan, 'ray:0.5').opacity).toBe(1);
    expect(resolveDrawingLinePresentationForSlot(fan, 'ray:0.618').opacity).toBe(1);
    expect(resolveDrawingLinePresentationForSlot(fan, 'ray:1').opacity).toBe(0.65);
    expect(getDrawingStyleSchema('pitchfan').lines.map((line) => line.label)).toContain('Median (50.0%)');
  });


  it('defines S2.3 legacy-preserving defaults for Fibonacci and Gann families', () => {
    const channel: ChartDrawing = {
      id: 'fib-channel-defaults',
      kind: 'fibChannel',
      color: '#38bdf8',
      lineWidth: 1.6,
      lineStyle: 'solid',
      anchors: [
        { barIndex: 10, price: 100 },
        { barIndex: 20, price: 110 },
        { barIndex: 24, price: 94 },
      ],
    };
    expect(resolveDrawingLinePresentationForSlot(channel, 'level:0.236').opacity).toBe(0.65);
    expect(resolveDrawingLinePresentationForSlot(channel, 'level:0.5').opacity).toBe(1);
    expect(resolveDrawingFillPresentationForSlot(channel, 'bands')).toEqual({
      visible: false,
      color: '#38bdf8',
      opacity: 0.08,
    });

    const wedge: ChartDrawing = {
      id: 'fib-wedge-defaults',
      kind: 'fibWedge',
      color: '#f97316',
      lineWidth: 1.4,
      lineStyle: 'solid',
      anchors: [
        { barIndex: 10, price: 100 },
        { barIndex: 20, price: 112 },
        { barIndex: 24, price: 92 },
      ],
    };
    expect(resolveDrawingLinePresentationForSlot(wedge, 'level:0.236').opacity).toBe(0.72);
    expect(resolveDrawingLinePresentationForSlot(wedge, 'level:0.618').opacity).toBe(1);
    expect(resolveDrawingFillPresentationForSlot(wedge, 'background')).toEqual({
      visible: true,
      color: '#f97316',
      opacity: 0.08,
    });

    const gannBox: ChartDrawing = {
      id: 'gann-box-defaults',
      kind: 'gannBox',
      color: '#a78bfa',
      lineWidth: 1.5,
      lineStyle: 'solid',
      startIndex: 5,
      startPrice: 90,
      endIndex: 30,
      endPrice: 120,
    };
    expect(resolveDrawingLinePresentationForSlot(gannBox, 'grid:0.25').opacity).toBe(0.62);
    expect(resolveDrawingLinePresentationForSlot(gannBox, 'diagonals').opacity).toBe(0.8);
    expect(resolveDrawingFillPresentationForSlot(gannBox, 'box').visible).toBe(false);
  });

});
