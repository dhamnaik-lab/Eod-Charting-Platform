import { describe, expect, it } from 'vitest';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

const originalDrawings = [
  { id: 'h', kind: 'hline', color: '#111111', price: 100 },
  { id: 'v', kind: 'vline', color: '#111111', barIndex: 2 },
  { id: 'text', kind: 'text', color: '#111111', barIndex: 2, price: 100, text: 'Note' },
  { id: 'trend', kind: 'trendline', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'ray', kind: 'ray', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'arrow', kind: 'arrow', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'rect', kind: 'rect', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'channel', kind: 'channel', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110, offset: 5 },
  { id: 'fib', kind: 'fib', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'fib-ext', kind: 'fibExtension', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'fib-fan', kind: 'fibFan', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'gann', kind: 'gann', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'measure', kind: 'measure', color: '#111111', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
];

const d1Drawings = [
  { id: 'extended', kind: 'extendedLine', color: '#222222', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'hray', kind: 'horizontalRay', color: '#222222', barIndex: 2, price: 105 },
  { id: 'cross', kind: 'crossLine', color: '#222222', barIndex: 2, price: 105 },
  { id: 'info', kind: 'infoLine', color: '#222222', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'angle', kind: 'trendAngle', color: '#222222', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'price-range', kind: 'priceRange', color: '#222222', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'date-range', kind: 'dateRange', color: '#222222', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
];

const d2Drawings = [
  { id: 'lr', kind: 'regressionTrend', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'ftz', kind: 'fibTimeZone', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'fc', kind: 'fibCircles', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'fa', kind: 'fibArcs', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'gb', kind: 'gannBox', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'circle', kind: 'circle', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'ellipse', kind: 'ellipse', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'forecast', kind: 'forecast', color: '#333333', startIndex: 1, startPrice: 100, endIndex: 3, endPrice: 110 },
  { id: 'marker', kind: 'arrowMarker', color: '#333333', barIndex: 2, price: 105 },
  { id: 'up', kind: 'arrowUp', color: '#333333', barIndex: 2, price: 105 },
  { id: 'down', kind: 'arrowDown', color: '#333333', barIndex: 2, price: 105 },
];

const d3aDrawings = [
  { id: 'flat-channel', kind: 'flatChannel', color: '#444444', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 110 }, { barIndex: 2, price: 95 }] },
  { id: 'disjoint-channel', kind: 'disjointChannel', color: '#444444', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 110 }, { barIndex: 2, price: 95 }, { barIndex: 5, price: 105 }] },
  { id: 'triangle', kind: 'triangle', color: '#444444', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 110 }, { barIndex: 2, price: 95 }] },
  { id: 'rotated', kind: 'rotatedRect', color: '#444444', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 110 }, { barIndex: 2, price: 95 }] },
  { id: 'arc', kind: 'arc', color: '#444444', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 110 }, { barIndex: 2, price: 95 }] },
];

const d3bDrawings = [
  { id: 'andrews', kind: 'andrewsPitchfork', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
  { id: 'schiff', kind: 'schiffPitchfork', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
  { id: 'modified-schiff', kind: 'modifiedSchiffPitchfork', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
  { id: 'inside', kind: 'insidePitchfork', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
  { id: 'trend-fib-ext', kind: 'trendFibExtension', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 110 }] },
  { id: 'fib-channel', kind: 'fibChannel', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
  { id: 'fib-time-ext', kind: 'fibTimeExtension', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 110 }] },
  { id: 'fib-wedge', kind: 'fibWedge', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
  { id: 'pitchfan', kind: 'pitchfan', color: '#555555', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 90 }] },
];

const d3cDrawings = [
  { id: 'long-position', kind: 'longPosition', color: '#666666', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 4, price: 115 }, { barIndex: 4, price: 95 }] },
  { id: 'short-position', kind: 'shortPosition', color: '#666666', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 4, price: 90 }, { barIndex: 4, price: 105 }] },
  { id: 'projection', kind: 'projection', color: '#666666', labelPosition: 'left', anchors: [{ barIndex: 1, price: 100 }, { barIndex: 3, price: 120 }, { barIndex: 5, price: 110 }] },
];



const fibonacciKinds = new Set([
  'fib',
  'fibExtension',
  'fibFan',
  'fibTimeZone',
  'fibCircles',
  'fibArcs',
  'trendFibExtension',
  'fibChannel',
  'fibTimeExtension',
  'fibWedge',
]);

function expectFoundationCompatible(actual: unknown[] | undefined, expected: unknown[]): void {
  expect(actual).toBeDefined();
  const stripped = (actual ?? []).map((drawing) => {
    if (!drawing || typeof drawing !== 'object') return drawing;
    const { toolSettings: _toolSettings, ...rest } = drawing as Record<string, unknown>;
    return rest;
  });
  expect(stripped).toEqual(expected);

  (actual ?? []).forEach((drawing) => {
    if (!drawing || typeof drawing !== 'object') return;
    const record = drawing as Record<string, any>;
    if (typeof record.kind === 'string' && fibonacciKinds.has(record.kind)) {
      expect(record.toolSettings?.fibonacci?.kind).toBe(record.kind);
      expect(record.toolSettings?.fibonacci?.schemaVersion).toBe(1);
    } else {
      expect(record.toolSettings).toBeUndefined();
    }
  });
}

function buildWorkspace(drawings: unknown[]): string {
  return JSON.stringify({
    version: 1,
    activeChartTabId: 'tab-1',
    chartTabs: [{
      id: 'tab-1',
      title: 'Compatibility',
      instrument: null,
      timeframe: 'D',
      chartType: 'candles',
      viewport: { startIndex: 0, endIndex: 20 },
      indicators: [],
      drawings,
      indicatorPaneHeight: 160,
      sheets: [],
      activeSheetId: null,
      layoutMode: 'single',
    }],
  });
}

describe('Drawing workspace compatibility', () => {
  it('preserves all 13 pre-D1 drawing kinds and geometry while adding optional Fibonacci foundation settings', () => {
    const workspace = parsePersistedWorkspace(buildWorkspace(originalDrawings));
    expectFoundationCompatible(workspace?.chartTabs[0].drawings, originalDrawings);
  });

  it('round-trips the seven D1 drawing kinds through existing workspace persistence', () => {
    const workspace = parsePersistedWorkspace(buildWorkspace(d1Drawings));
    expect(workspace?.chartTabs[0].drawings).toEqual(d1Drawings);
  });

  it('round-trips all D2 drawing kinds through existing workspace persistence', () => {
    const workspace = parsePersistedWorkspace(buildWorkspace(d2Drawings));
    expectFoundationCompatible(workspace?.chartTabs[0].drawings, d2Drawings);
  });


  it('round-trips the D3A generalized multi-anchor drawings without migrating legacy schemas', () => {
    const workspace = parsePersistedWorkspace(buildWorkspace(d3aDrawings));
    expect(workspace?.chartTabs[0].drawings).toEqual(d3aDrawings);
  });

  it('round-trips all D3B multi-anchor drawings through the existing workspace schema', () => {
    const workspace = parsePersistedWorkspace(buildWorkspace(d3bDrawings));
    expectFoundationCompatible(workspace?.chartTabs[0].drawings, d3bDrawings);
  });

  it('round-trips the D3C position/projection drawings through the existing workspace schema', () => {
    const workspace = parsePersistedWorkspace(buildWorkspace(d3cDrawings));
    expect(workspace?.chartTabs[0].drawings).toEqual(d3cDrawings);
  });
});
