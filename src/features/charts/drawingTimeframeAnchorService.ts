import type { ChartDrawing, OHLCBar } from '@/engine/types';

function clampIndex(index: number, bars: readonly OHLCBar[]): number {
  if (!bars.length) return 0;
  return Math.max(0, Math.min(bars.length - 1, Math.round(index)));
}

export function getDrawingAnchorTimestamp(
  bars: readonly OHLCBar[],
  index: number,
): number | undefined {
  if (!bars.length) return undefined;
  const bar = bars[clampIndex(index, bars)];
  return Number.isFinite(bar?.timestamp) ? bar.timestamp : undefined;
}

/**
 * Maps a stable source timestamp to the display bar that contains it.
 * Aggregated EOD bars use the first source bar timestamp for each W/M/Q/Y bucket,
 * so the containing bucket is the last bar whose timestamp is <= the anchor.
 */
export function findDisplayBarIndexForTimestamp(
  bars: readonly OHLCBar[],
  timestamp: number | undefined,
  fallbackIndex: number,
): number {
  if (!bars.length) return 0;
  if (!Number.isFinite(timestamp)) return clampIndex(fallbackIndex, bars);

  let low = 0;
  let high = bars.length - 1;
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const value = bars[mid]?.timestamp ?? Number.NEGATIVE_INFINITY;
    if (value <= (timestamp as number)) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function remapPointDrawing(
  drawing: Extract<ChartDrawing, { barIndex: number }>,
  sourceBars: readonly OHLCBar[],
  targetBars: readonly OHLCBar[],
): ChartDrawing {
  const anchorTimestamp = drawing.anchorTimestamp ?? getDrawingAnchorTimestamp(sourceBars, drawing.barIndex);
  return {
    ...drawing,
    anchorTimestamp,
    barIndex: findDisplayBarIndexForTimestamp(targetBars, anchorTimestamp, drawing.barIndex),
  } as ChartDrawing;
}

function remapMultiAnchorDrawing(
  drawing: Extract<ChartDrawing, { anchors: { barIndex: number; timestamp?: number }[] }>,
  sourceBars: readonly OHLCBar[],
  targetBars: readonly OHLCBar[],
): ChartDrawing {
  return {
    ...drawing,
    anchors: drawing.anchors.map((anchor) => {
      const timestamp = anchor.timestamp ?? getDrawingAnchorTimestamp(sourceBars, anchor.barIndex);
      return {
        ...anchor,
        timestamp,
        barIndex: findDisplayBarIndexForTimestamp(targetBars, timestamp, anchor.barIndex),
      };
    }),
  } as ChartDrawing;
}

function remapAnchoredDrawing(
  drawing: Extract<ChartDrawing, { startIndex: number }>,
  sourceBars: readonly OHLCBar[],
  targetBars: readonly OHLCBar[],
): ChartDrawing {
  const startTimestamp = drawing.startTimestamp ?? getDrawingAnchorTimestamp(sourceBars, drawing.startIndex);
  const endTimestamp = drawing.endTimestamp ?? getDrawingAnchorTimestamp(sourceBars, drawing.endIndex);
  return {
    ...drawing,
    startTimestamp,
    endTimestamp,
    startIndex: findDisplayBarIndexForTimestamp(targetBars, startTimestamp, drawing.startIndex),
    endIndex: findDisplayBarIndexForTimestamp(targetBars, endTimestamp, drawing.endIndex),
  } as ChartDrawing;
}

export function remapDrawingsAcrossTimeframe(
  drawings: readonly ChartDrawing[],
  sourceBars: readonly OHLCBar[],
  targetBars: readonly OHLCBar[],
): ChartDrawing[] {
  if (!drawings.length || !targetBars.length) return [...drawings];

  return drawings.map((drawing) => {
    if (
      drawing.kind === 'vline' ||
      drawing.kind === 'text' ||
      drawing.kind === 'horizontalRay' ||
      drawing.kind === 'crossLine' ||
      drawing.kind === 'arrowMarker' ||
      drawing.kind === 'arrowUp' ||
      drawing.kind === 'arrowDown'
    ) {
      return remapPointDrawing(drawing, sourceBars, targetBars);
    }

    if ('anchors' in drawing) {
      return remapMultiAnchorDrawing(drawing, sourceBars, targetBars);
    }

    if ('startIndex' in drawing) {
      return remapAnchoredDrawing(drawing, sourceBars, targetBars);
    }

    return drawing;
  });
}
