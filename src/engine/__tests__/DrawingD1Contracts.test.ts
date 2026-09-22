import { describe, expect, it } from 'vitest';
import { createDrawingAlertRule } from '@/features/alerts/eodAlerts';
import type { ChartDrawing, DrawingTool } from '@/engine/types';

const instrument = { exchange: 'NSE' as const, symbol: 'TEST' };

const d1Tools: DrawingTool[] = [
  'extendedLine',
  'horizontalRay',
  'crossLine',
  'infoLine',
  'trendAngle',
  'priceRange',
  'dateRange',
];

const common = {
  color: '#3b82f6',
  lineWidth: 1.4,
  lineStyle: 'solid' as const,
  locked: false,
  paneId: 'price' as const,
};

const d1Drawings: ChartDrawing[] = [
  { ...common, id: 'extended', kind: 'extendedLine', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'hray', kind: 'horizontalRay', barIndex: 2, price: 105 },
  { ...common, id: 'cross', kind: 'crossLine', barIndex: 2, price: 105 },
  { ...common, id: 'info', kind: 'infoLine', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'angle', kind: 'trendAngle', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'price-range', kind: 'priceRange', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
  { ...common, id: 'date-range', kind: 'dateRange', startIndex: 1, startPrice: 100, endIndex: 4, endPrice: 110 },
];

describe('Drawing Phase D1 contracts', () => {
  it('registers the seven planned D1 tool identifiers as native drawing tools', () => {
    expect(d1Tools).toHaveLength(7);
    expect(new Set(d1Tools).size).toBe(7);
  });

  it('keeps all D1 drawings outside the existing drawing-alert whitelist', () => {
    d1Drawings.forEach((drawing) => {
      expect(createDrawingAlertRule(instrument, drawing, [])).toBeNull();
    });
  });
});
