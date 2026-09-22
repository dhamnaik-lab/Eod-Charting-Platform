import { describe, expect, it } from 'vitest';
import type { ChartDrawing, OHLCBar } from '@/engine/types';
import {
  activateInstrumentDrawingScope,
  bindLoadedInstrumentDrawingScope,
  getDrawingScopeKey,
  getScopedDrawings,
  setScopedDrawings,
} from '@/features/charts/drawingScopeService';

const tcs = { exchange: 'NSE', symbol: 'TCS' };
const reliance = { exchange: 'NSE', symbol: 'RELIANCE' };

function hline(id: string, price: number): ChartDrawing {
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

function bar(date: string, close: number): OHLCBar {
  return {
    date,
    timestamp: Date.parse(`${date}T00:00:00Z`),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 100,
  };
}

describe('drawingScopeService', () => {
  it('keys drawings by exchange and symbol and keeps different exchanges isolated', () => {
    expect(getDrawingScopeKey(tcs)).toBe('NSE:TCS');
    expect(getDrawingScopeKey({ exchange: 'BSE', symbol: 'TCS' })).toBe('BSE:TCS');

    let scopes = setScopedDrawings({}, tcs, [hline('nse', 100)]);
    scopes = setScopedDrawings(scopes, { exchange: 'BSE', symbol: 'TCS' }, [hline('bse', 200)]);
    expect(getScopedDrawings(scopes, tcs).map((drawing) => drawing.id)).toEqual(['nse']);
    expect(getScopedDrawings(scopes, { exchange: 'BSE', symbol: 'TCS' }).map((drawing) => drawing.id)).toEqual(['bse']);
  });

  it('saves TCS drawings before activating Reliance and restores TCS when switching back', () => {
    const tcsDrawings = [hline('tcs-line', 3500)];
    const toReliance = activateInstrumentDrawingScope({
      instrument: tcs,
      drawings: tcsDrawings,
      drawingScopes: {},
      displayBars: [],
    }, reliance);

    expect(toReliance.drawings).toEqual([]);
    expect(getScopedDrawings(toReliance.drawingScopes, tcs)).toEqual(tcsDrawings);

    const relianceDrawings = [hline('reliance-line', 1400)];
    const backToTcs = activateInstrumentDrawingScope({
      instrument: reliance,
      drawings: relianceDrawings,
      drawingScopes: toReliance.drawingScopes,
      displayBars: [],
    }, tcs);

    expect(backToTcs.drawings).toEqual(tcsDrawings);
    expect(getScopedDrawings(backToTcs.drawingScopes, reliance)).toEqual(relianceDrawings);
  });

  it('stamps and preserves two-anchor timestamps when binding a loaded symbol scope', () => {
    const bars = [bar('2026-08-03', 100), bar('2026-08-04', 101), bar('2026-08-05', 102)];
    const trend: ChartDrawing = {
      id: 'trend',
      kind: 'trendline',
      startIndex: 0,
      startPrice: 100,
      endIndex: 2,
      endPrice: 102,
      color: '#4fa7ff',
      lineWidth: 1.4,
      lineStyle: 'solid',
      locked: false,
      paneId: 'price',
    };
    const bound = bindLoadedInstrumentDrawingScope({
      instrument: tcs,
      drawings: [trend],
      drawingScopes: { 'NSE:TCS': [trend] },
      displayBars: [],
    }, tcs, tcs, bars);
    const restored = bound.drawings[0];
    expect('startTimestamp' in restored ? restored.startTimestamp : undefined).toBe(bars[0].timestamp);
    expect('endTimestamp' in restored ? restored.endTimestamp : undefined).toBe(bars[2].timestamp);
  });
});
