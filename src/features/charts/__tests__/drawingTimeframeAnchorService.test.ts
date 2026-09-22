import { describe, expect, it } from 'vitest';
import type { ChartDrawing, OHLCBar } from '@/engine/types';
import { remapDrawingsAcrossTimeframe } from '@/features/charts/drawingTimeframeAnchorService';

function bar(date: string, close: number): OHLCBar {
  return {
    date,
    timestamp: new Date(`${date}T00:00:00Z`).getTime(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1,
  };
}

const dailyBars = [
  bar('2026-08-03', 100),
  bar('2026-08-04', 101),
  bar('2026-08-05', 102),
  bar('2026-08-06', 103),
  bar('2026-08-07', 104),
  bar('2026-08-10', 105),
  bar('2026-08-11', 106),
  bar('2026-08-12', 107),
  bar('2026-08-13', 108),
  bar('2026-08-14', 109),
];

const weeklyBars = [
  { ...dailyBars[0], high: 105, low: 99, close: 104 },
  { ...dailyBars[5], high: 110, low: 104, close: 109 },
];

const common = {
  color: '#3b82f6',
  lineWidth: 1.4,
  lineStyle: 'solid' as const,
  locked: false,
  paneId: 'price' as const,
};

describe('drawingTimeframeAnchorService', () => {
  it('preserves exact daily anchor timestamps through D -> W -> D remapping', () => {
    const original: ChartDrawing = {
      ...common,
      id: 'range',
      kind: 'dateRange',
      startIndex: 2,
      startPrice: 102,
      endIndex: 7,
      endPrice: 107,
    };

    const weekly = remapDrawingsAcrossTimeframe([original], dailyBars, weeklyBars)[0];
    expect(weekly).toMatchObject({ startIndex: 0, endIndex: 1 });
    expect('startTimestamp' in weekly ? weekly.startTimestamp : undefined).toBe(dailyBars[2].timestamp);
    expect('endTimestamp' in weekly ? weekly.endTimestamp : undefined).toBe(dailyBars[7].timestamp);

    const dailyAgain = remapDrawingsAcrossTimeframe([weekly], weeklyBars, dailyBars)[0];
    expect(dailyAgain).toMatchObject({ startIndex: 2, endIndex: 7 });
  });

  it('remaps one-point drawings to the aggregated bar and restores their original date', () => {
    const originals: ChartDrawing[] = [
      { ...common, id: 'cross', kind: 'crossLine', barIndex: 8, price: 108 },
      { ...common, id: 'marker', kind: 'arrowMarker', barIndex: 8, price: 108 },
      { ...common, id: 'up', kind: 'arrowUp', barIndex: 8, price: 108 },
      { ...common, id: 'down', kind: 'arrowDown', barIndex: 8, price: 108 },
    ];

    const weekly = remapDrawingsAcrossTimeframe(originals, dailyBars, weeklyBars);
    weekly.forEach((drawing) => {
      expect(drawing).toMatchObject({ barIndex: 1 });
      expect('anchorTimestamp' in drawing ? drawing.anchorTimestamp : undefined).toBe(dailyBars[8].timestamp);
    });

    const dailyAgain = remapDrawingsAcrossTimeframe(weekly, weeklyBars, dailyBars);
    dailyAgain.forEach((drawing) => expect(drawing).toMatchObject({ barIndex: 8 }));
  });

  it('preserves every generalized D3 multi-anchor timestamp through D -> W -> D remapping', () => {
    const original: ChartDrawing = {
      ...common,
      id: 'triangle',
      kind: 'triangle',
      anchors: [
        { barIndex: 2, price: 102 },
        { barIndex: 7, price: 107 },
        { barIndex: 8, price: 108 },
      ],
    };
    const weekly = remapDrawingsAcrossTimeframe([original], dailyBars, weeklyBars)[0];
    expect('anchors' in weekly ? weekly.anchors.map((anchor) => anchor.barIndex) : []).toEqual([0, 1, 1]);
    expect('anchors' in weekly ? weekly.anchors.map((anchor) => anchor.timestamp) : []).toEqual([
      dailyBars[2].timestamp,
      dailyBars[7].timestamp,
      dailyBars[8].timestamp,
    ]);
    const dailyAgain = remapDrawingsAcrossTimeframe([weekly], weeklyBars, dailyBars)[0];
    expect('anchors' in dailyAgain ? dailyAgain.anchors.map((anchor) => anchor.barIndex) : []).toEqual([2, 7, 8]);
  });

  it('preserves D2 two-anchor dates through D -> W -> D remapping', () => {
    const original: ChartDrawing = {
      ...common,
      id: 'ellipse',
      kind: 'ellipse',
      startIndex: 2,
      startPrice: 102,
      endIndex: 7,
      endPrice: 107,
    };
    const weekly = remapDrawingsAcrossTimeframe([original], dailyBars, weeklyBars)[0];
    expect(weekly).toMatchObject({ startIndex: 0, endIndex: 1 });
    const dailyAgain = remapDrawingsAcrossTimeframe([weekly], weeklyBars, dailyBars)[0];
    expect(dailyAgain).toMatchObject({ startIndex: 2, endIndex: 7 });
  });
});
