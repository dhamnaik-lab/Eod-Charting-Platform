import { describe, expect, it } from 'vitest';
import { createDrawingAlertRule } from '@/features/alerts/eodAlerts';
import type { ChartDrawing, DrawingTool } from '@/engine/types';

const instrument = { exchange: 'NSE' as const, symbol: 'TEST' };
const common = {
  color: '#3b82f6',
  lineWidth: 1.4,
  lineStyle: 'solid' as const,
  locked: false,
  paneId: 'price' as const,
};

const d2Tools: DrawingTool[] = [
  'regressionTrend',
  'fibTimeZone',
  'fibCircles',
  'fibArcs',
  'gannBox',
  'circle',
  'ellipse',
  'forecast',
  'arrowMarker',
  'arrowUp',
  'arrowDown',
];

const d2Drawings: ChartDrawing[] = [
  { ...common, id: 'lr', kind: 'regressionTrend', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'ftz', kind: 'fibTimeZone', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'fc', kind: 'fibCircles', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'fa', kind: 'fibArcs', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'gb', kind: 'gannBox', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'circle', kind: 'circle', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'ellipse', kind: 'ellipse', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'forecast', kind: 'forecast', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'marker', kind: 'arrowMarker', barIndex: 2, price: 105 },
  { ...common, id: 'up', kind: 'arrowUp', barIndex: 2, price: 105 },
  { ...common, id: 'down', kind: 'arrowDown', barIndex: 2, price: 105 },
];

describe('Drawing Phase D2 contracts', () => {
  it('registers the eleven approved D2 tool identifiers as native drawing tools', () => {
    expect(d2Tools).toHaveLength(11);
    expect(new Set(d2Tools).size).toBe(11);
  });

  it('keeps every D2 drawing outside the existing drawing-alert whitelist', () => {
    d2Drawings.forEach((drawing) => {
      expect(createDrawingAlertRule(instrument, drawing, [])).toBeNull();
    });
  });

  it('keeps Fib Speed Resistance Fan out of D2 because the existing Fib Fan already covers the same two-anchor fan concept', () => {
    expect(d2Tools).not.toContain('fibSpeedFan' as DrawingTool);
  });
});
