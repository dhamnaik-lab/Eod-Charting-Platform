import { describe, expect, it } from 'vitest';
import type { ChartDrawing } from '@/engine/types';
import { buildInstrumentLoadStartTab } from '@/features/charts/chartInstrumentHydrationService';
import { createBlankChartTab } from '@/features/charts/chartTabWorkspaceService';

function line(id: string, price: number): ChartDrawing {
  return {
    id,
    kind: 'hline',
    price,
    color: '#4fa7ff',
    lineWidth: 1.4,
    lineStyle: 'dashed',
    locked: false,
    paneId: 'price',
  };
}

describe('chartInstrumentHydrationService drawing scopes', () => {
  it('does not carry TCS drawings into Reliance and restores them when TCS is selected again', () => {
    const tab = createBlankChartTab(1);
    const tcs = { exchange: 'NSE', symbol: 'TCS' };
    const reliance = { exchange: 'NSE', symbol: 'RELIANCE' };
    const tcsLine = line('tcs-line', 3500);
    tab.instrument = tcs;
    tab.requestedInstrument = tcs;
    tab.drawings = [tcsLine];
    tab.drawingScopes = {};

    const relianceStart = buildInstrumentLoadStartTab(tab, reliance);
    expect(relianceStart.drawings).toEqual([]);
    expect(relianceStart.drawingScopes['NSE:TCS'].map((drawing) => drawing.id)).toEqual(['tcs-line']);

    const relianceLine = line('reliance-line', 1400);
    const withRelianceDrawing = {
      ...relianceStart,
      drawings: [relianceLine],
    };
    const tcsAgain = buildInstrumentLoadStartTab(withRelianceDrawing, tcs);
    expect(tcsAgain.drawings.map((drawing) => drawing.id)).toEqual(['tcs-line']);
    expect(tcsAgain.drawingScopes['NSE:RELIANCE'].map((drawing) => drawing.id)).toEqual(['reliance-line']);
  });
});
