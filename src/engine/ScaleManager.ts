import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  getQuarter,
  isValid,
  parseISO,
  startOfQuarter,
  startOfYear,
} from 'date-fns';
import type { ChartTimeframe, FutureMarginMode, OHLCBar, ScaleX, ScaleY, Viewport } from './types';

const LEFT_GUTTER = 8;
const FUTURE_MARGIN_BARS: Record<FutureMarginMode, number> = {
  tight: 4,
  normal: 8,
  wide: 12,
};

export interface XAxisTick {
  index: number;
  label: string;
  isMajor?: boolean;
  isYear?: boolean;
  isContext?: boolean;
}

export interface XAxisLabelPlacement {
  tick: XAxisTick;
  x: number;
  width: number;
}

/** Resolve collisions after edge clamping, keeping calendar context first.
 * The renderer supplies real font metrics; tick planning uses a conservative
 * estimate so grid density and labels follow the same placement policy. */
export function layoutXAxisLabels(
  ticks: XAxisTick[],
  scaleX: ScaleX,
  canvasWidth: number,
  measureLabel: (tick: XAxisTick) => number = (tick) => tick.label.length * 7,
): XAxisLabelPlacement[] {
  const padding = 6;
  const gap = 8;
  const candidates = ticks.flatMap((tick) => {
    const pixel = scaleX.toPixel(tick.index);
    if (!tick.label.trim() || !Number.isFinite(pixel) || pixel < 0 || pixel > canvasWidth) return [];
    const width = measureLabel(tick);
    if (!Number.isFinite(width) || width <= 0 || width + padding * 2 > canvasWidth) return [];
    const x = Math.min(Math.max(pixel, width / 2 + padding), canvasWidth - width / 2 - padding);
    return [{ tick, x, width }];
  });
  const priority = (tick: XAxisTick) => tick.isYear ? (tick.isContext ? 2 : 3) : tick.isMajor ? 1 : 0;
  candidates.sort((a, b) => priority(b.tick) - priority(a.tick) || a.tick.index - b.tick.index);
  const selected: XAxisLabelPlacement[] = [];
  for (const candidate of candidates) {
    if (selected.every((other) => Math.abs(candidate.x - other.x) >= (candidate.width + other.width) / 2 + gap)) {
      selected.push(candidate);
    }
  }
  return selected.sort((a, b) => a.tick.index - b.tick.index);
}

type BoundaryMode = 'year' | 'halfYear' | 'quarter' | 'month' | 'week' | 'step';

export function countVisibleBars(viewport: Viewport, barCount: number): number {
  const start = Math.max(0, Math.floor(viewport.startIndex));
  const end = Math.min(barCount, Math.ceil(viewport.endIndex));
  return Math.max(0, end - start);
}

export function buildScaleX(viewport: Viewport, canvasWidth: number, gutterPx = 10): ScaleX {
  void gutterPx;
  const visibleSlots = Math.max(viewport.endIndex - viewport.startIndex, 1);
  const usableWidth = Math.max(canvasWidth - LEFT_GUTTER, 1);
  const barWidth = usableWidth / visibleSlots;
  const barGap = barWidth >= 3 ? Math.max(barWidth * 0.1, 1) : 0;
  const bodyWidth = Math.max(barWidth - barGap * 2, Math.min(barWidth, 1));
  return {
    barWidth,
    barGap,
    bodyWidth,
    toPixel: (index) => LEFT_GUTTER + (index - viewport.startIndex + 0.5) * barWidth,
    toIndex: (px) => (px - LEFT_GUTTER) / barWidth + viewport.startIndex - 0.5,
  };
}

export function buildScaleY(
  bars: OHLCBar[],
  startIdx: number,
  endIdx: number,
  height: number,
  topPad = 0.05,
  bottomPad = 0.05,
  overlaySeries: Array<Array<number | null>> = [],
  fixedRange?: { min?: number; max?: number },
  logScale = false,
  lockVisibleRange = false,
  invertScale = false,
  isLineChart = false,
): ScaleY {
  let min = Infinity;
  let max = -Infinity;
  let hasValue = false;

  const start = Math.max(Math.floor(startIdx), 0);
  const end = Math.min(Math.ceil(endIdx), bars.length - 1);

  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    if (isLineChart) {
      const val = bar.close;
      if (val < min) min = val;
      if (val > max) max = val;
    } else {
      if (bar.low < min) min = bar.low;
      if (bar.high > max) max = bar.high;
    }
    hasValue = true;
  }

  overlaySeries.forEach((series) => {
    const sEnd = Math.min(Math.ceil(endIdx), series.length - 1);
    for (let index = start; index <= sEnd; index += 1) {
      const value = series[index];
      if (value !== null && Number.isFinite(value)) {
        if (value < min) min = value;
        if (value > max) max = value;
        hasValue = true;
      }
    }
  });

  if (!hasValue) {
    min = fixedRange?.min ?? 0;
    max = fixedRange?.max ?? 1;
  } else {
    if (bars.length === 1 && fixedRange?.min === undefined && fixedRange?.max === undefined) {
      const bar = bars[0];
      min = Math.min(min, bar.open, bar.close);
      max = Math.max(max, bar.open, bar.close);
      const midpoint = (min + max) / 2;
      const halfRange = Math.max(Math.abs(midpoint) * 0.0025, 0.0001);
      min = Math.min(min, midpoint - halfRange);
      max = Math.max(max, midpoint + halfRange);
    }
    if (fixedRange?.min !== undefined) min = fixedRange.min;
    if (fixedRange?.max !== undefined) max = fixedRange.max;
  }

  const range = Math.max(max - min, 0.0001);
  const paddedMin = lockVisibleRange ? min : min - range * bottomPad;
  const paddedMax = lockVisibleRange ? max : max + range * topPad;
  const paddedRange = Math.max(paddedMax - paddedMin, 0.0001);

  if (logScale && paddedMin > 0) {
    const logMin = Math.log(paddedMin);
    const logMax = Math.log(Math.max(paddedMax, paddedMin * 1.0001));
    const logRange = Math.max(logMax - logMin, 0.0001);
    return {
      min: paddedMin,
      max: paddedMax,
      toPixel: (price) => {
        const ratio = (Math.log(Math.max(price, paddedMin * 0.001)) - logMin) / logRange;
        return invertScale ? ratio * height : height - ratio * height;
      },
      toPrice: (px) => {
        const ratio = invertScale ? px / height : (height - px) / height;
        return Math.exp(logMin + ratio * logRange);
      },
    };
  }

  return {
    min: paddedMin,
    max: paddedMax,
    toPixel: (price) => {
      const ratio = (price - paddedMin) / paddedRange;
      return invertScale ? ratio * height : height - ratio * height;
    },
    toPrice: (px) => {
      const ratio = invertScale ? px / height : (height - px) / height;
      return paddedMin + ratio * paddedRange;
    },
  };
}

export function buildVolumeScaleY(bars: OHLCBar[], startIdx: number, endIdx: number, height: number) {
  const visible = bars.slice(Math.max(Math.floor(startIdx), 0), Math.min(Math.ceil(endIdx) + 1, bars.length));
  const maxVolume = Math.max(...visible.map((bar) => bar.volume), 1);
  return {
    maxVolume,
    toPixel: (volume: number) => height - (volume / maxVolume) * height * 0.92,
  };
}

export function clampViewport(
  viewport: Viewport,
  totalBars: number,
  minVisible = 5,
  futureMarginMode: FutureMarginMode = 'normal',
): Viewport {
  if (totalBars <= 0) {
    return { startIndex: 0, endIndex: 0 };
  }

  const baseFutureBars = getAllowedFutureBars(minVisible, futureMarginMode);
  const minSpan = Math.min(totalBars + baseFutureBars, minVisible + baseFutureBars);

  // Preserve the span requested by the caller (zoomViewport / panViewport).
  // The old code recomputed span from (clamped-endIndex − unclamped-startIndex),
  // which made span grow beyond maxSpan whenever startIndex was negative and
  // endIndex crossed totalBars simultaneously — causing horizontal drift on
  // repeated zoom-out with the cursor near the left edge.
  const requestedSpan = viewport.endIndex - viewport.startIndex;
  const normalizedSpan = Math.max(minSpan, requestedSpan);
  const allowedFutureBars = getAllowedFutureBars(normalizedSpan, futureMarginMode);
  const maxSpan = totalBars + allowedFutureBars;
  const span = Math.max(minSpan, Math.min(normalizedSpan, maxSpan));

  // Clamp startIndex so the window stays within [0, maxStart].
  const maxStart = Math.max(totalBars + allowedFutureBars - span, 0);
  const startIndex = Math.max(0, Math.min(viewport.startIndex, maxStart));

  return {
    startIndex,
    endIndex: startIndex + span,
  };
}

export function zoomViewport(
  viewport: Viewport,
  _pivotIndex: number,
  factor: number,
  totalBars: number,
  futureMarginMode: FutureMarginMode = 'normal',
): Viewport {
  const span = viewport.endIndex - viewport.startIndex;
  const minFutureBars = getAllowedFutureBars(5, futureMarginMode);
  const minSpan = totalBars > 0 ? Math.min(totalBars + minFutureBars, 5 + minFutureBars) : 5 + minFutureBars;
  const maxSpan = totalBars > 0 ? totalBars + getAllowedFutureBars(span, futureMarginMode) : minSpan;
  const nextSpan = Math.max(minSpan, Math.min(span / factor, maxSpan));
  // Keep the current right edge fixed while zooming so zoom-out reveals more history to the left
  // without introducing horizontal chart drift.
  const rightEdge = viewport.endIndex;
  const nextStart = rightEdge - nextSpan;
  return clampViewport({ startIndex: nextStart, endIndex: rightEdge }, totalBars, 5, futureMarginMode);
}

export function panViewport(
  viewport: Viewport,
  deltaX: number,
  scaleX: ScaleX,
  totalBars: number,
  futureMarginMode: FutureMarginMode = 'normal',
): Viewport {
  const deltaIndex = -deltaX / scaleX.barWidth;
  return clampViewport(
    {
      startIndex: viewport.startIndex + deltaIndex,
      endIndex: viewport.endIndex + deltaIndex,
    },
    totalBars,
    5,
    futureMarginMode,
  );
}

export interface NiceTicks {
  ticks: number[];
  step: number;
}

export function niceYTicks(min: number, max: number, paneHeight = 300): NiceTicks {
  const targetCount = Math.max(5, Math.floor(paneHeight / 50));
  const range = Math.max(max - min, 1);
  const roughStep = range / Math.max(targetCount, 1);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const steps = [1, 2, 2.5, 5, 10];
  const normalized = roughStep / magnitude;
  const chosen = steps.find((step) => normalized <= step) ?? 10;
  const step = chosen * magnitude;
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];

  for (let value = start; value <= end; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }

  return { ticks, step };
}

export function niceXTicks(
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  canvasWidth: number,
  timeframe: ChartTimeframe = 'D',
  minGapPx = 80,
): XAxisTick[] {
  const ticks: XAxisTick[] = [];
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  // Safety: Limit the end index to avoid massive loops if viewport is corrupted or extreme.
  // We allow up to 500 bars beyond the current data set for future margin ticks.
  const end = Math.min(Math.max(start, Math.ceil(viewport.endIndex) - 1), bars.length + 500);
  const visibleBars = Math.max(viewport.endIndex - viewport.startIndex, 1);
  const targetTicks = Math.max(2, Math.floor(canvasWidth / minGapPx));
  const step = Math.max(1, Math.ceil(visibleBars / targetTicks));
  const boundaryMode = resolveBoundaryMode(bars, start, end, timeframe, scaleX, canvasWidth, visibleBars);
  const tickByIndex = new Map<number, XAxisTick>();
  let lastPixel = -Infinity;
  let hasFutureTick = false;
  let previousDate: Date | null = null;

  collectBoundaryTicks(bars, start, end, timeframe, boundaryMode, scaleX, canvasWidth, visibleBars).forEach((tick) => {
    tickByIndex.set(tick.index, tick);
  });

  for (let index = start; index <= end; ) {
    const pixel = scaleX.toPixel(index);
    if (pixel < 0 || pixel > canvasWidth || (pixel - lastPixel < minGapPx && index !== start)) {
      // If we are far from the last pixel and zoomed out, we can jump forward
      if (pixel - lastPixel < minGapPx * 0.5 && step > 5 && index + Math.floor(step / 2) <= end) {
        index += Math.floor(step / 2);
      } else {
        index += 1;
      }
      continue;
    }

    const logicalDate = getLogicalDateForIndex(bars, index, timeframe);
    if (!logicalDate) {
      index += 1;
      previousDate = null;
      continue;
    }

    const previousBarDate = getPreviousBarLogicalDate(bars, index, timeframe);
    const isBoundaryTick = shouldRenderBoundaryTick(logicalDate, previousBarDate, boundaryMode);
    const hasExistingTick = tickByIndex.has(index);

    // Coarse calendar views use one consistent cadence. Sampling arbitrary
    // bars here can otherwise add an isolated month between year-only labels.
    if (boundaryMode !== 'step' && boundaryMode !== 'week' && !isBoundaryTick) {
      index += 1;
      continue;
    }

    if (!hasExistingTick && !isBoundaryTick && (index - start) % step !== 0) {
      previousDate = logicalDate;
      index += 1;
      continue;
    }

    const label = formatXAxisLabel(logicalDate, timeframe, visibleBars, index === start, index === end, previousBarDate);
    const isYearStart = !previousBarDate || logicalDate.getFullYear() !== previousBarDate.getFullYear();

    if (hasExistingTick) {
      ticks.push(tickByIndex.get(index)!);
    } else if (isBoundaryTick || !hasNearbyTick(tickByIndex, pixel, scaleX, minGapPx)) {
      const tick = {
        index,
        label,
        isMajor: isBoundaryTick,
        isYear: isYearStart,
        isContext: !previousBarDate,
      };
      tickByIndex.set(index, tick);
      ticks.push(tick);
    }
    lastPixel = pixel;
    previousDate = logicalDate;
    if (index >= bars.length) {
      hasFutureTick = true;
    }
    
    // Jump by at least half the step after finding a tick to avoid checking every single index
    if (step > 4) {
      index += Math.max(1, Math.floor(step * 0.8));
    } else {
      index += 1;
    }
  }

  if (tickByIndex.size === 0) {
    const fallbackDate = getLogicalDateForIndex(bars, start, timeframe);
    if (fallbackDate) {
      const fallbackTick = {
        index: start,
        label: formatXAxisLabel(fallbackDate, timeframe, visibleBars, true, true, null),
        isMajor: true,
      };
      tickByIndex.set(start, fallbackTick);
    }
  }

  if (!hasFutureTick && end >= bars.length && (boundaryMode === 'step' || boundaryMode === 'week')) {
    const existingTicks = Array.from(tickByIndex.values()).sort((left, right) => left.index - right.index);
    const futureTick = buildFutureTick(bars, start, end, timeframe, scaleX, canvasWidth, minGapPx, existingTicks, visibleBars, previousDate);
    if (futureTick) {
      tickByIndex.set(futureTick.index, futureTick);
    }
  }

  return layoutXAxisLabels(Array.from(tickByIndex.values()), scaleX, canvasWidth).map(({ tick }) => tick);
}

export function formatCrosshairLogicalDate(
  bars: OHLCBar[],
  logicalIndex: number,
  timeframe: ChartTimeframe = 'D',
): string | null {
  const logicalDate = getLogicalDateForIndex(bars, Math.round(logicalIndex), timeframe);
  if (!logicalDate) {
    return null;
  }

  if (timeframe === 'Q') {
    return `Q${getQuarter(logicalDate)} ${format(logicalDate, 'yyyy')}`;
  }
  if (timeframe === 'Y') {
    return format(logicalDate, 'yyyy');
  }
  if (timeframe === 'M') {
    return format(logicalDate, 'MMM yyyy');
  }

  return format(logicalDate, 'dd MMM yyyy');
}

function formatXAxisLabel(
  date: Date,
  timeframe: ChartTimeframe,
  visibleBars: number,
  isFirst: boolean,
  isLast: boolean,
  previousDate: Date | null,
): string {
  const isYearStart = !previousDate || date.getFullYear() !== previousDate.getFullYear();
  const isMonthStart = !previousDate || date.getMonth() !== previousDate.getMonth();

  if (timeframe === 'Q') {
    return isYearStart ? format(date, 'yyyy') : `Q${getQuarter(date)}`;
  }
  if (timeframe === 'Y') {
    return format(date, 'yyyy');
  }

  if (isYearStart) {
    return format(date, 'yyyy');
  }

  if (timeframe === 'M') {
    return format(date, 'MMM');
  }

  if (visibleBars > 180) {
    return isMonthStart ? format(date, 'MMM') : '';
  }

  if (isMonthStart && !isFirst) {
    return format(date, 'MMM');
  }

  if (visibleBars < 40) {
    return format(date, 'dd MMM');
  }

  return format(date, 'dd');
}

export function getAllowedFutureBars(
  span: number,
  futureMarginMode: FutureMarginMode = 'normal',
): number {
  void span;
  return FUTURE_MARGIN_BARS[futureMarginMode] ?? FUTURE_MARGIN_BARS.normal;
}

function resolveBoundaryMode(
  bars: OHLCBar[],
  start: number,
  end: number,
  timeframe: ChartTimeframe,
  scaleX: ScaleX,
  canvasWidth: number,
  visibleBars: number,
): BoundaryMode {
  const averageGap = (mode: BoundaryMode) => averageBoundaryGapPx(
    bars,
    start,
    end,
    timeframe,
    mode,
    scaleX,
    canvasWidth,
  );

  if (timeframe === 'D') {
    if (visibleBars < 60 && averageGap('week') >= 90) {
      return 'week';
    }
    if (averageGap('month') >= 48) {
      return 'month';
    }
    // Month names need the same label space at every calendar cadence. A
    // larger quarter cutoff made small zoom changes jump directly to years.
    if (averageGap('quarter') >= 48) {
      return 'quarter';
    }
    if (averageGap('halfYear') >= 48) {
      return 'halfYear';
    }
    return 'year';
  }

  if (timeframe === 'W') {
    if (averageGap('month') >= 80) {
      return 'month';
    }
    if (averageGap('quarter') >= 48) {
      return 'quarter';
    }
    if (averageGap('halfYear') >= 48) {
      return 'halfYear';
    }
    return 'year';
  }

  if (timeframe === 'M') {
    // Monthly candles still benefit from month/quarter context. Choose by
    // available label space rather than forcing years above 36 candles.
    if (averageGap('month') >= 48) {
      return 'month';
    }
    if (averageGap('quarter') >= 48) {
      return 'quarter';
    }
    if (averageGap('halfYear') >= 48) {
      return 'halfYear';
    }
    return 'year';
  }

  if (timeframe === 'Q') {
    return 'year';
  }

  return averageGap('year') >= 60 ? 'year' : 'step';
}

function shouldRenderBoundaryTick(
  current: Date | null,
  previous: Date | null,
  boundaryMode: BoundaryMode,
): boolean {
  if (boundaryMode === 'step' || !current) {
    return false;
  }
  if (!previous) {
    return true;
  }

  const currentYear = current.getFullYear();
  const prevYear = previous.getFullYear();
  const currentMonth = current.getMonth();
  const prevMonth = previous.getMonth();

  if (boundaryMode === 'year') {
    return currentYear !== prevYear;
  }
  if (boundaryMode === 'halfYear') {
    return currentYear !== prevYear || Math.floor(currentMonth / 6) !== Math.floor(prevMonth / 6);
  }
  if (boundaryMode === 'quarter') {
    return currentYear !== prevYear || Math.floor(currentMonth / 3) !== Math.floor(prevMonth / 3);
  }
  if (boundaryMode === 'month') {
    return currentYear !== prevYear || currentMonth !== prevMonth;
  }
  if (boundaryMode === 'week') {
    // Week start detection: crossed from a higher day to a lower day (e.g. Fri -> Mon)
    // or a large gap (holiday)
    const currentDay = current.getDay();
    const prevDay = previous.getDay();
    return (
      currentYear !== prevYear ||
      currentMonth !== prevMonth ||
      currentDay < prevDay ||
      Math.abs(current.getTime() - previous.getTime()) > 3 * 24 * 60 * 60 * 1000
    );
  }

  return false;
}

function collectBoundaryTicks(
  bars: OHLCBar[],
  start: number,
  end: number,
  timeframe: ChartTimeframe,
  boundaryMode: BoundaryMode,
  scaleX: ScaleX,
  canvasWidth: number,
  visibleBars: number,
): XAxisTick[] {
  if (boundaryMode === 'step' || bars.length === 0) {
    return [];
  }

  const ticks: XAxisTick[] = [];
  const realStart = Math.max(start, 0);
  const realEnd = end; // `end` is already capped at bars.length + 500 by niceXTicks

  for (let index = realStart; index <= realEnd; index += 1) {
    const pixel = scaleX.toPixel(index);
    if (pixel < 0 || pixel > canvasWidth) {
      continue;
    }

    const logicalDate = getLogicalDateForIndex(bars, index, timeframe);
    const previousBarDate = getPreviousBarLogicalDate(bars, index, timeframe);
    if (!shouldRenderBoundaryTick(logicalDate, previousBarDate, boundaryMode) || !logicalDate) {
      continue;
    }

    const isYearStart = !previousBarDate || logicalDate.getFullYear() !== previousBarDate.getFullYear();
    ticks.push({
      index,
      label: formatXAxisLabel(logicalDate, timeframe, visibleBars, index === start, index === end, previousBarDate),
      isMajor: true,
      isYear: isYearStart,
      isContext: !previousBarDate,
    });
  }

  return ticks;
}

function averageBoundaryGapPx(
  bars: OHLCBar[],
  start: number,
  end: number,
  timeframe: ChartTimeframe,
  boundaryMode: BoundaryMode,
  scaleX: ScaleX,
  canvasWidth: number,
): number {
  if (boundaryMode === 'step' || bars.length === 0) {
    return 0;
  }

  const pixels: number[] = [];
  const realStart = Math.max(start, 0);
  const realEnd = end; // `end` is already capped at bars.length + 500 by niceXTicks

  for (let index = realStart; index <= realEnd; index += 1) {
    const pixel = scaleX.toPixel(index);
    if (pixel < 0 || pixel > canvasWidth) {
      continue;
    }

    const logicalDate = getLogicalDateForIndex(bars, index, timeframe);
    const previousBarDate = getPreviousBarLogicalDate(bars, index, timeframe);
    if (shouldRenderBoundaryTick(logicalDate, previousBarDate, boundaryMode)) {
      pixels.push(pixel);
    }
  }

  if (pixels.length < 2) {
    return Number.POSITIVE_INFINITY;
  }

  return (pixels[pixels.length - 1] - pixels[0]) / (pixels.length - 1);
}

function getPreviousBarLogicalDate(
  bars: OHLCBar[],
  index: number,
  timeframe: ChartTimeframe,
): Date | null {
  if (index <= 0) {
    return null;
  }
  // For real-data indices use the actual bar; for future indices extrapolate.
  return getLogicalDateForIndex(bars, index - 1, timeframe);
}

function hasNearbyTick(
  tickByIndex: Map<number, XAxisTick>,
  pixel: number,
  scaleX: ScaleX,
  minGapPx: number,
): boolean {
  return Array.from(tickByIndex.values()).some((tick) => Math.abs(scaleX.toPixel(tick.index) - pixel) < minGapPx);
}

function buildFutureTick(
  bars: OHLCBar[],
  start: number,
  end: number,
  timeframe: ChartTimeframe,
  scaleX: ScaleX,
  canvasWidth: number,
  minGapPx: number,
  existingTicks: XAxisTick[],
  visibleBars: number,
  previousDate: Date | null,
): XAxisTick | null {
  const lastTickPixel = existingTicks.length > 0 ? scaleX.toPixel(existingTicks[existingTicks.length - 1].index) : -Infinity;

  for (let index = end; index >= Math.max(bars.length, start); index -= 1) {
    const pixel = scaleX.toPixel(index);
    if (pixel < 0 || pixel > canvasWidth) {
      continue;
    }
    if (pixel - lastTickPixel < minGapPx * 0.7) {
      continue;
    }

    const logicalDate = getLogicalDateForIndex(bars, index, timeframe);
    if (!logicalDate) {
      continue;
    }

    const isYearStart = !previousDate || logicalDate.getFullYear() !== previousDate.getFullYear();
    const isMonthStart = !previousDate || logicalDate.getMonth() !== previousDate.getMonth();

    return {
      index,
      label: formatXAxisLabel(logicalDate, timeframe, visibleBars, index === start, index === end, previousDate),
      isMajor: isYearStart || isMonthStart,
      isYear: isYearStart,
    };
  }

  return null;
}

function getLogicalDateForIndex(
  bars: OHLCBar[],
  index: number,
  timeframe: ChartTimeframe,
): Date | null {
  if (bars.length === 0) {
    return null;
  }

  const clampedIndex = Math.max(0, Math.min(index, bars.length - 1));
  const baseDate = getBarLogicalDate(bars[clampedIndex], timeframe);
  if (!baseDate) {
    return null;
  }

  if (index === clampedIndex) {
    return baseDate;
  }

  return shiftLogicalDate(baseDate, index - clampedIndex, timeframe);
}

function getBarLogicalDate(bar: OHLCBar, timeframe: ChartTimeframe): Date | null {
  if (timeframe === 'Q' || timeframe === 'Y') {
    const date = new Date(bar.timestamp);
    if (!isValid(date)) {
      return null;
    }
    return timeframe === 'Q' ? startOfQuarter(date) : startOfYear(date);
  }

  const parsed = parseISO(bar.date);
  if (isValid(parsed)) {
    return timeframe === 'M' ? endOfMonth(parsed) : parsed;
  }

  const fallback = new Date(bar.timestamp);
  if (!isValid(fallback)) {
    return null;
  }

  if (timeframe === 'M') {
    return endOfMonth(fallback);
  }

  return fallback;
}

function shiftLogicalDate(date: Date, delta: number, timeframe: ChartTimeframe): Date {
  if (delta === 0) {
    return date;
  }

  if (timeframe === 'D') {
    return shiftTradingDate(date, delta);
  }
  if (timeframe === 'W') {
    return addWeeks(date, delta);
  }
  if (timeframe === 'M') {
    return endOfMonth(addMonths(date, delta));
  }
  if (timeframe === 'Q') {
    return startOfQuarter(addQuarters(date, delta));
  }

  return startOfYear(addYears(date, delta));
}

function shiftTradingDate(date: Date, delta: number): Date {
  if (delta === 0) return date;

  let remaining = Math.abs(delta);
  const direction = delta >= 0 ? 1 : -1;

  // Optimization: For large deltas, estimate the number of calendar days
  // (approx 7 days for every 5 trading days) to jump close to the target,
  // then use the loop for the final precision.
  if (remaining > 20) {
    const estimatedCalendarDays = Math.floor((remaining * 7) / 5) - 2;
    const jumpDate = addDays(date, direction * estimatedCalendarDays);
    
    // Now refine from the jump point
    let current = jumpDate;
    let currentTradingCount = 0;
    // We need to count how many trading days we actually jumped
    // This is still a bit complex, but much faster than jumping one by one from 0.
    // For simplicity and safety, let's use a simpler heuristic:
    // Jump most of the way, then loop.
    const safeJump = Math.floor(remaining * 0.8);
    date = addDays(date, direction * Math.floor((safeJump * 7) / 5));
    remaining -= safeJump;
  }

  let next = date;
  // Safety: Cap the maximum remaining loop to avoid blocking the UI thread.
  if (remaining > 1000) remaining = 1000;

  while (remaining > 0) {
    next = addDays(next, direction);
    const day = next.getDay();
    if (day !== 0 && day !== 6) {
      remaining -= 1;
    }
  }

  return next;
}
