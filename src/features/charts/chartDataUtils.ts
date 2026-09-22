import { endOfMonth, format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns';
import { clampViewport, getAllowedFutureBars } from '@/engine/ScaleManager';
import type { FutureMarginMode, OHLCBar, OverlayIndicator, Viewport } from '@/engine/types';
import type { EodRow } from '@/platform';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';
import { findDisplayBarIndexForTimestamp } from '@/features/charts/drawingTimeframeAnchorService';

function shouldWarnUnexpectedTimeframe(): boolean {
  return typeof window !== 'undefined' && window.location.protocol !== 'tauri:';
}

function warnUnexpectedTimeframe(timeframe: WorkspaceTimeframe): void {
  if (shouldWarnUnexpectedTimeframe()) {
    console.warn('[chart-data-utils] unexpected timeframe fallback', { timeframe });
  }
}

function getAggregateGroupKey(date: Date, timeframe: WorkspaceTimeframe): string {
  switch (timeframe) {
    case 'W':
      return `${getISOWeekYear(date)}-${String(getISOWeek(date)).padStart(2, '0')}`;
    case 'M':
      return format(endOfMonth(date), 'yyyy-MM-dd');
    case 'Q': {
      const quarter = Math.floor(date.getMonth() / 3) + 1;
      return `${date.getFullYear()}-Q${quarter}`;
    }
    case 'Y':
      return `${date.getFullYear()}-01-01`;
    default:
      warnUnexpectedTimeframe(timeframe);
      return format(endOfMonth(date), 'yyyy-MM-dd');
  }
}

function getAggregateDisplayDate(
  firstBar: OHLCBar,
  groupKey: string,
  timeframe: WorkspaceTimeframe,
): string {
  switch (timeframe) {
    case 'W':
      return firstBar.date;
    case 'Q': {
      const firstDate = firstBar.timestamp ? new Date(firstBar.timestamp) : new Date();
      const quarter = Math.floor(firstDate.getMonth() / 3) + 1;
      return `${firstDate.getFullYear()}-Q${quarter}`;
    }
    case 'Y': {
      const firstDate = firstBar.timestamp ? new Date(firstBar.timestamp) : new Date();
      return `${firstDate.getFullYear()}-01-01`;
    }
    case 'M':
      return groupKey;
    default:
      warnUnexpectedTimeframe(timeframe);
      return groupKey;
  }
}

export function toBar(row: EodRow): OHLCBar {
  return {
    date: row.date,
    timestamp: parseISO(row.date).getTime(),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    prevClose: row.prevClose ?? undefined,
  };
}

export function aggregateBars(bars: OHLCBar[], timeframe: WorkspaceTimeframe): OHLCBar[] {
  if (timeframe === 'D') {
    return bars;
  }

  const groups = new Map<string, OHLCBar[]>();
  bars.forEach((bar) => {
    const date = parseISO(bar.date);
    const key = getAggregateGroupKey(date, timeframe);
    const group = groups.get(key) ?? [];
    group.push(bar);
    groups.set(key, group);
  });

  return [...groups.entries()].map(([key, group]) => {
    const first = group[0];
    const last = group[group.length - 1];
    return {
      date: getAggregateDisplayDate(first, key, timeframe),
      timestamp: first.timestamp,
      open: first.open,
      high: Math.max(...group.map((bar) => bar.high)),
      low: Math.min(...group.map((bar) => bar.low)),
      close: last.close,
      volume: group.reduce((sum, bar) => sum + bar.volume, 0),
      prevClose: first.prevClose,
    };
  });
}

export function createDefaultViewport(
  totalBars: number,
  futureMarginMode: FutureMarginMode = 'normal',
): Viewport {
  if (totalBars <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const span = Math.min(totalBars, 120);
  const futureBars = getAllowedFutureBars(span, futureMarginMode);
  const startIndex = Math.max(totalBars + futureBars - span, 0);
  return clampViewport(
    {
      startIndex,
      endIndex: startIndex + span,
    },
    totalBars,
    5,
    futureMarginMode,
  );
}

export function isViewportMeaningful(viewport: Viewport): boolean {
  return (
    Number.isFinite(viewport.startIndex) &&
    Number.isFinite(viewport.endIndex) &&
    viewport.endIndex > viewport.startIndex
  );
}

export function remapViewportAcrossTimeframe(
  currentViewport: Viewport,
  sourceBars: readonly OHLCBar[],
  targetBars: readonly OHLCBar[],
  futureMarginMode: FutureMarginMode = 'normal',
): Viewport {
  if (!targetBars.length) {
    return { startIndex: 0, endIndex: 0 };
  }
  if (!sourceBars.length || !isViewportMeaningful(currentViewport)) {
    return createDefaultViewport(targetBars.length, futureMarginMode);
  }

  const span = Math.max(Math.round(currentViewport.endIndex - currentViewport.startIndex), 5);
  const targetFutureBars = getAllowedFutureBars(span, futureMarginMode);
  const sourceFutureBars = getAllowedFutureBars(span, futureMarginMode);

  // If the viewport was aligned to the right edge (latest data), keep it right-aligned.
  const isRightAligned = currentViewport.endIndex >= sourceBars.length + sourceFutureBars - 1;
  if (isRightAligned) {
    const endIndex = targetBars.length + targetFutureBars;
    return clampViewport(
      {
        startIndex: Math.max(0, endIndex - span),
        endIndex,
      },
      targetBars.length,
      5,
      futureMarginMode,
    );
  }

  // If viewing historical data, anchor to the center timestamp of the visible range.
  const centerIndex = (currentViewport.startIndex + currentViewport.endIndex) / 2;
  const clampedSourceCenter = Math.max(0, Math.min(sourceBars.length - 1, Math.round(centerIndex)));
  const anchorTimestamp = sourceBars[clampedSourceCenter]?.timestamp;

  if (Number.isFinite(anchorTimestamp)) {
    const targetCenterIndex = findDisplayBarIndexForTimestamp(targetBars, anchorTimestamp, clampedSourceCenter);
    const halfSpan = span / 2;
    const nextStart = targetCenterIndex - halfSpan;
    return clampViewport(
      {
        startIndex: nextStart,
        endIndex: nextStart + span,
      },
      targetBars.length,
      5,
      futureMarginMode,
    );
  }

  const rightOffset = Math.max(0, (sourceBars.length + sourceFutureBars) - currentViewport.endIndex);
  const endIndex = Math.max(span, (targetBars.length + targetFutureBars) - rightOffset);
  return clampViewport(
    {
      startIndex: endIndex - span,
      endIndex,
    },
    targetBars.length,
    5,
    futureMarginMode,
  );
}

export function fitViewportToBarCount(
  currentViewport: Viewport,
  totalBars: number,
  futureMarginMode: FutureMarginMode = 'normal',
): Viewport {
  if (totalBars <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const span = Math.max(Math.round(currentViewport.endIndex - currentViewport.startIndex), 5);
  const futureBars = getAllowedFutureBars(span, futureMarginMode);
  return clampViewport(
    {
      startIndex: Math.max(totalBars + futureBars - span, 0),
      endIndex: Math.max(totalBars + futureBars, span),
    },
    totalBars,
    5,
    futureMarginMode,
  );
}

export function appendIndicator(
  indicators: OverlayIndicator[],
  nextIndicator: OverlayIndicator,
): OverlayIndicator[] {
  return [...indicators, nextIndicator];
}
