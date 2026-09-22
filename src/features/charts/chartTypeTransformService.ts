import type {
  ChartType,
  OHLCBar,
  RenkoAnchorPolicy,
  RenkoBrickDirection,
  RenkoPriceSource,
  RenkoSettings,
  RenkoWickMode,
} from '@/engine/types';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';
import { aggregateBars } from '@/features/charts/chartDataUtils';

export const DEFAULT_RENKO_BRICK_SIZE = 10;
export const MIN_RENKO_BRICK_SIZE = 0.05;
export const DEFAULT_RENKO_PERCENT = 1;
export const MIN_RENKO_PERCENT = 0.0001;
export const DEFAULT_RENKO_ATR_PERIOD = 14;
export const MIN_RENKO_ATR_PERIOD = 1;
export const MAX_RENKO_BRICKS = 750000;
export const RENKO_BRICK_LIMIT_MESSAGE =
  'Renko would create too many bricks for the loaded history. Increase the brick size or reduce the date range.';
export const RENKO_ATR_LIMIT_MESSAGE =
  'ATR Renko needs enough completed bars to resolve a positive brick size.';

export const DEFAULT_RENKO_SETTINGS: RenkoSettings = {
  boxSizeMode: 'atr',
  boxSize: DEFAULT_RENKO_BRICK_SIZE,
  percent: DEFAULT_RENKO_PERCENT,
  atrPeriod: DEFAULT_RENKO_ATR_PERIOD,
  priceSource: 'close',
  anchorPolicy: 'first_close',
  showWicks: false,
  wickMode: 'reversal_attempt',
  includeIncompleteBrick: false,
};

export function normalizeChartType(value: unknown): ChartType {
  switch (value) {
    case 'line':
    case 'area':
    case 'bar':
    case 'baseline':
    case 'hlcArea':
    case 'heikinAshi':
    case 'renko':
      return value;
    default:
      return 'candles';
  }
}

export function normalizeRenkoBrickSize(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_RENKO_BRICK_SIZE;
  }

  return Math.max(MIN_RENKO_BRICK_SIZE, Number(value.toFixed(4)));
}

function normalizePositiveNumber(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Number(value.toFixed(4)));
}

function normalizePositiveInteger(value: unknown, fallback: number, minimum: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(minimum, Math.round(value));
}

export function normalizeRenkoSettings(value: unknown, legacyBrickSize?: unknown): RenkoSettings {
  const legacyBoxSize = normalizeRenkoBrickSize(legacyBrickSize);
  if (typeof value !== 'object' || value === null) {
    return typeof legacyBrickSize === 'number'
      ? {
          ...DEFAULT_RENKO_SETTINGS,
          boxSizeMode: 'traditional',
          boxSize: legacyBoxSize,
        }
      : DEFAULT_RENKO_SETTINGS;
  }

  const record = value as Partial<RenkoSettings>;
  const boxSizeMode = record.boxSizeMode === 'traditional' || record.boxSizeMode === 'percent' || record.boxSizeMode === 'atr'
    ? record.boxSizeMode
    : DEFAULT_RENKO_SETTINGS.boxSizeMode;
  const priceSource: RenkoPriceSource = record.priceSource === 'high_low' ? 'high_low' : 'close';
  const anchorPolicy: RenkoAnchorPolicy = record.anchorPolicy === 'rounded_to_box' ? 'rounded_to_box' : 'first_close';
  const wickMode: RenkoWickMode = record.wickMode === 'source_range' ? 'source_range' : 'reversal_attempt';

  return {
    boxSizeMode,
    boxSize: normalizePositiveNumber(record.boxSize, legacyBoxSize, MIN_RENKO_BRICK_SIZE),
    percent: normalizePositiveNumber(record.percent, DEFAULT_RENKO_PERCENT, MIN_RENKO_PERCENT),
    atrPeriod: normalizePositiveInteger(record.atrPeriod, DEFAULT_RENKO_ATR_PERIOD, MIN_RENKO_ATR_PERIOD),
    priceSource,
    anchorPolicy,
    showWicks: record.showWicks === true,
    wickMode,
    includeIncompleteBrick: record.includeIncompleteBrick === true,
  };
}

export function buildChartDisplayBars(
  rawBars: OHLCBar[],
  timeframe: WorkspaceTimeframe,
  chartType: ChartType,
  renkoBrickSize: number,
  renkoSettings?: RenkoSettings,
): OHLCBar[] {
  const aggregatedBars = aggregateBars(rawBars, timeframe);
  switch (chartType) {
    case 'heikinAshi':
      return buildHeikinAshiBars(aggregatedBars);
    case 'renko':
      return buildRenkoBars(aggregatedBars, normalizeRenkoSettings(renkoSettings, renkoBrickSize));
    default:
      return aggregatedBars;
  }
}

function buildHeikinAshiBars(bars: OHLCBar[]): OHLCBar[] {
  if (!bars.length) {
    return [];
  }

  const heikinBars: OHLCBar[] = [];

  bars.forEach((bar, index) => {
    const haClose = (bar.open + bar.high + bar.low + bar.close) / 4;
    const priorHa = heikinBars[index - 1] ?? null;
    const haOpen = priorHa ? (priorHa.open + priorHa.close) / 2 : (bar.open + bar.close) / 2;
    const haHigh = Math.max(bar.high, haOpen, haClose);
    const haLow = Math.min(bar.low, haOpen, haClose);
    heikinBars.push({
      ...bar,
      open: Number(haOpen.toFixed(6)),
      high: Number(haHigh.toFixed(6)),
      low: Number(haLow.toFixed(6)),
      close: Number(haClose.toFixed(6)),
      prevClose: priorHa?.close ?? bar.prevClose,
    });
  });

  return heikinBars;
}

function buildRenkoBars(bars: OHLCBar[], settings: RenkoSettings): OHLCBar[] {
  if (!bars.length) {
    return [];
  }

  const brickSize = resolveRenkoBrickSize(bars, settings);
  const bricks: OHLCBar[] = [];
  let lastBrickClose = resolveInitialAnchor(bars[0].close, brickSize, settings.anchorPolicy);
  let lastBrickDirection: RenkoBrickDirection | null = null;
  let brickSequence = 0;

  for (let sourceIndex = 1; sourceIndex < bars.length; sourceIndex += 1) {
    const bar = bars[sourceIndex];
    const nextTargets: OHLCBar[] = [];
    const sourceAnchorClose = lastBrickClose;
    const targetPrice = resolveRenkoTargetPrice(bar, lastBrickClose, settings.priceSource, brickSize);
    let delta = targetPrice - lastBrickClose;
    let sourceBrickOrdinal = 0;

    while (true) {
      const direction: RenkoBrickDirection = delta > 0 ? 'up' : 'down';
      const isReversal = lastBrickDirection !== null && direction !== lastBrickDirection;
      const threshold = isReversal ? brickSize * 2 : brickSize;
      if (Math.abs(delta) < threshold) {
        break;
      }

      if (bricks.length + nextTargets.length >= MAX_RENKO_BRICKS) {
        throw new RangeError(RENKO_BRICK_LIMIT_MESSAGE);
      }

      const directionSign = direction === 'up' ? 1 : -1;
      const nextOpen = isReversal
        ? lastBrickClose + directionSign * brickSize
        : lastBrickClose;
      const nextClose = isReversal
        ? lastBrickClose + directionSign * brickSize * 2
        : lastBrickClose + directionSign * brickSize;
      const nextSourceBrickOrdinal = sourceBrickOrdinal + 1;
      nextTargets.push(createRenkoBrick(bar, nextOpen, nextClose, ++brickSequence, {
        brickSize,
        direction,
        showWicks: settings.showWicks && nextSourceBrickOrdinal === 1,
        wickMode: settings.wickMode,
        isComplete: true,
        sourceBrickOrdinal: nextSourceBrickOrdinal,
        sourceAnchorClose,
        priorBrickDirection: lastBrickDirection,
      }));
      sourceBrickOrdinal = nextSourceBrickOrdinal;
      lastBrickClose = nextClose;
      lastBrickDirection = direction;
      delta = targetPrice - lastBrickClose;
    }

    if (nextTargets.length > 0) {
      const volumePerBrick = bar.volume / nextTargets.length;
      nextTargets.forEach((brick, index) => {
        const previousClose = bricks[bricks.length - 1]?.close ?? bars[0].prevClose;
        bricks.push({
          ...brick,
          timestamp: bar.timestamp + index,
          volume: volumePerBrick,
          prevClose: previousClose,
        });
      });
    }

    if (settings.includeIncompleteBrick && sourceIndex === bars.length - 1) {
      const incompleteMove = bar.close - lastBrickClose;
      if (incompleteMove !== 0 && Math.abs(incompleteMove) < brickSize) {
        if (bricks.length >= MAX_RENKO_BRICKS) {
          throw new RangeError(RENKO_BRICK_LIMIT_MESSAGE);
        }

        const direction: RenkoBrickDirection = incompleteMove > 0 ? 'up' : 'down';
        const previousClose = bricks[bricks.length - 1]?.close ?? bars[0].prevClose;
        bricks.push({
          ...createRenkoBrick(bar, lastBrickClose, bar.close, ++brickSequence, {
            brickSize,
            direction,
            showWicks: settings.showWicks && sourceBrickOrdinal === 0,
            wickMode: settings.wickMode,
            isComplete: false,
            sourceBrickOrdinal: sourceBrickOrdinal + 1,
            sourceAnchorClose,
            priorBrickDirection: lastBrickDirection,
          }),
          timestamp: bar.timestamp + brickSequence,
          prevClose: previousClose,
        });
      }
    }
  }

  return bricks;
}

function resolveRenkoBrickSize(bars: OHLCBar[], settings: RenkoSettings): number {
  if (settings.boxSizeMode === 'traditional') {
    return normalizePositiveNumber(settings.boxSize, DEFAULT_RENKO_BRICK_SIZE, MIN_RENKO_BRICK_SIZE);
  }

  if (settings.boxSizeMode === 'percent') {
    const boxSize = bars[0].close * (settings.percent / 100);
    if (!Number.isFinite(boxSize) || boxSize <= 0) {
      throw new RangeError(RENKO_BRICK_LIMIT_MESSAGE);
    }
    return Math.max(MIN_RENKO_BRICK_SIZE, Number(boxSize.toFixed(4)));
  }

  return resolveRenkoAtrBrickSize(bars, settings.atrPeriod);
}

function resolveRenkoAtrBrickSize(bars: OHLCBar[], atrPeriod: number): number {
  const period = normalizePositiveInteger(atrPeriod, DEFAULT_RENKO_ATR_PERIOD, MIN_RENKO_ATR_PERIOD);
  const atrValues = calculateAtr(bars, period);
  for (let index = atrValues.length - 1; index >= 0; index -= 1) {
    const boxSize = atrValues[index];
    if (boxSize === null) {
      continue;
    }
    if (!Number.isFinite(boxSize) || boxSize <= 0) {
      throw new RangeError(RENKO_ATR_LIMIT_MESSAGE);
    }
    return Math.max(MIN_RENKO_BRICK_SIZE, Number(boxSize.toFixed(4)));
  }

  throw new RangeError(RENKO_ATR_LIMIT_MESSAGE);
}

function calculateAtr(bars: OHLCBar[], period: number): Array<number | null> {
  if (bars.length < period) {
    return new Array(bars.length).fill(null);
  }

  const trueRanges = bars.map((bar, index) => {
    if (index === 0) {
      return bar.high - bar.low;
    }
    const previousClose = bars[index - 1].close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose),
    );
  });
  const atrValues: Array<number | null> = new Array(bars.length).fill(null);
  let sumTrueRange = 0;
  for (let index = 0; index < period; index += 1) {
    sumTrueRange += trueRanges[index] ?? 0;
  }

  let currentAtr = sumTrueRange / period;
  atrValues[period - 1] = currentAtr;
  for (let index = period; index < bars.length; index += 1) {
    currentAtr = (currentAtr * (period - 1) + (trueRanges[index] ?? 0)) / period;
    atrValues[index] = currentAtr;
  }

  return atrValues;
}

function resolveInitialAnchor(firstClose: number, boxSize: number, anchorPolicy: RenkoAnchorPolicy): number {
  if (anchorPolicy === 'rounded_to_box') {
    return Math.round(firstClose / boxSize) * boxSize;
  }

  return firstClose;
}

function resolveRenkoTargetPrice(
  bar: OHLCBar,
  anchorClose: number,
  priceSource: RenkoPriceSource,
  brickSize: number,
): number {
  if (priceSource === 'close') {
    return bar.close;
  }

  const upMove = bar.high - anchorClose;
  const downMove = anchorClose - bar.low;
  const upCrossed = upMove >= brickSize;
  const downCrossed = downMove >= brickSize;

  if (upCrossed && downCrossed) {
    if (bar.close > anchorClose) {
      return bar.high;
    }
    if (bar.close < anchorClose) {
      return bar.low;
    }
    return upMove >= downMove ? bar.high : bar.low;
  }

  if (upCrossed) {
    return bar.high;
  }
  if (downCrossed) {
    return bar.low;
  }

  return Math.abs(upMove) >= Math.abs(downMove) ? bar.high : bar.low;
}

function createRenkoBrick(
  sourceBar: OHLCBar,
  open: number,
  close: number,
  sequence: number,
  options: {
    brickSize: number;
    direction: RenkoBrickDirection;
    showWicks: boolean;
    wickMode: RenkoWickMode;
    isComplete: boolean;
    sourceBrickOrdinal: number;
    sourceAnchorClose: number;
    priorBrickDirection: RenkoBrickDirection | null;
  },
): OHLCBar {
  const bodyHigh = Math.max(open, close);
  const bodyLow = Math.min(open, close);
  const shouldDrawSourceRangeWick = options.wickMode === 'source_range';
  const shouldDrawReversalAttemptWick = options.wickMode === 'reversal_attempt' && options.priorBrickDirection !== null;
  const high = options.showWicks
    && options.direction === 'down'
    && sourceBar.high > options.sourceAnchorClose
    && (shouldDrawSourceRangeWick || (shouldDrawReversalAttemptWick && sourceBar.high >= options.sourceAnchorClose + options.brickSize))
    ? Math.max(bodyHigh, sourceBar.high)
    : bodyHigh;
  const low = options.showWicks
    && options.direction === 'up'
    && sourceBar.low < options.sourceAnchorClose
    && (shouldDrawSourceRangeWick || (shouldDrawReversalAttemptWick && sourceBar.low <= options.sourceAnchorClose - options.brickSize))
    ? Math.min(bodyLow, sourceBar.low)
    : bodyLow;
  return {
    date: sourceBar.date,
    timestamp: sourceBar.timestamp + sequence,
    open: Number(open.toFixed(6)),
    high: Number(high.toFixed(6)),
    low: Number(low.toFixed(6)),
    close: Number(close.toFixed(6)),
    volume: sourceBar.volume,
    prevClose: sourceBar.prevClose,
    renkoDirection: options.direction,
    renkoBoxSize: options.brickSize,
    renkoComplete: options.isComplete,
    renkoSourceClose: sourceBar.close,
    renkoSourceHigh: sourceBar.high,
    renkoSourceLow: sourceBar.low,
    renkoSourceTimestamp: sourceBar.timestamp,
    renkoBrickOrdinal: options.sourceBrickOrdinal,
  };
}
