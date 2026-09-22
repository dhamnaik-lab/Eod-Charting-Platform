import type { OHLCBar } from './types';

export interface ConflationLevel {
  factor: number;
  bars: OHLCBar[];
  indexMap: number[]; // maps conflated index to original start index
}

export function precomputeConflation(
  bars: OHLCBar[],
  levels: number[],
): ConflationLevel[] {
  return levels.map((factor) => {
    const merged: OHLCBar[] = [];
    const indexMap: number[] = [];
    for (let i = 0; i < bars.length; i += factor) {
      const chunk = bars.slice(i, Math.min(i + factor, bars.length));
      merged.push(mergeOHLCBars(chunk));
      indexMap.push(i);
    }
    return { factor, bars: merged, indexMap };
  });
}

function mergeOHLCBars(chunk: OHLCBar[]): OHLCBar {
  return {
    date: chunk[0].date,
    timestamp: chunk[0].timestamp,
    open: chunk[0].open,
    high: Math.max(...chunk.map((b) => b.high)),
    low: Math.min(...chunk.map((b) => b.low)),
    close: chunk[chunk.length - 1].close,
    volume: chunk.reduce((sum, b) => sum + b.volume, 0),
    prevClose: chunk[0].prevClose,
  };
}
