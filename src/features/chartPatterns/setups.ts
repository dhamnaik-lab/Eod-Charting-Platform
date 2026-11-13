import type { EodBar, ScannerResult } from '@/features/scanner/types';
import type { ChartPatternPivot } from '@/features/chartPatterns/types';
import { averageRange, averageVolume, candleRange, findLocalPivots, hasDownTrend, hasUpTrend, highestHigh, isRangeBound, linearSlope, lowestLow, retracementDepthPct, round } from '@/features/chartPatterns/primitives';
import { REVERSAL_LOOKBACK_BARS, STRUCTURE_LOOKBACK_BARS, CUP_HANDLE_LOOKBACK_BARS } from '@/features/chartPatterns/constants';
import { movePct, averageClose, averageSegmentRange, segmentWidth, isLongDirectionalCandle, isSharpPivot, isRoundedPivot, countTouches, pivotsComparable, pricesComparable, pivotsHaveSpacing, indexOfLowestLow, indexOfHighestHigh } from '@/features/chartPatterns/shared';

export function latestPair(bars: EodBar[]): { today: EodBar; previous: EodBar } | null {
  if (bars.length < 2) return null;
  return {
    today: bars[bars.length - 1],
    previous: bars[bars.length - 2],
  };
}

export function latestComparablePivotSetup(
  bars: EodBar[],
  kind: 'high' | 'low',
  count: 2 | 3,
): {
  patternBars: EodBar[];
  latest: EodBar;
  pivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
} | null {
  if (bars.length < 12) return null;
  const patternBars = bars.slice(-REVERSAL_LOOKBACK_BARS);
  const latest = patternBars[patternBars.length - 1];
  const pivotSource = patternBars.slice(0, -1);
  const pivots = findLocalPivots(pivotSource, 2)
    .filter((pivot) => pivot.kind === kind)
    .slice(-count);
  if (pivots.length !== count) return null;
  if (!pivotsComparable(pivots, count === 3 ? 2.5 : 3)) return null;
  if (!pivotsHaveSpacing(pivots, 3)) return null;
  if (pivots[pivots.length - 1].index - pivots[0].index > 140) return null;
  if (patternBars.length - 1 - pivots[pivots.length - 1].index > 8) return null;
  const reactions: number[] = [];
  for (let i = 0; i < pivots.length - 1; i += 1) {
    const seg = patternBars.slice(pivots[i].index + 1, pivots[i + 1].index);
    const reaction = kind === 'high' ? lowestLow(seg) : highestHigh(seg);
    if (reaction === null) return null;
    if (kind === 'high' && reaction >= Math.min(pivots[i].price, pivots[i + 1].price)) return null;
    if (kind === 'low' && reaction <= Math.max(pivots[i].price, pivots[i + 1].price)) return null;
    if (retracementDepthPct(pivots[i].price, pivots[i + 1].price, reaction) < 2.5) return null;
    const segHeight = Math.abs((pivots[i].price + pivots[i + 1].price) / 2 - reaction);
    const symmetryRatio = segHeight > 0 ? Math.abs(pivots[i].price - pivots[i + 1].price) / segHeight : 1;
    if (symmetryRatio > 0.35) return null;
    reactions.push(reaction);
  }
  if (reactions.length === 2 && !pricesComparable(reactions, 6)) return null;

  const barsBetween = patternBars.slice(pivots[0].index, pivots[pivots.length - 1].index + 1);
  if (barsBetween.length >= 3) {
    const intervening = kind === 'high' ? lowestLow(barsBetween) : highestHigh(barsBetween);
    if (intervening !== null) {
      const depth = retracementDepthPct(pivots[0].price, pivots[pivots.length - 1].price, intervening);
      if (depth < 2) return null;
    }
  }

  return { patternBars, latest, pivots };
}

export function latestVReversalSetup(
  bars: EodBar[],
  kind: 'bottom' | 'top',
): {
  patternBars: EodBar[];
  latest: EodBar;
  previous: EodBar;
  extreme: EodBar;
  extremeIndex: number;
  movePct: number;
} | null {
  if (bars.length < 15) return null;
  const patternBars = bars.slice(-25);
  const latest = patternBars[patternBars.length - 1];
  const previous = patternBars[patternBars.length - 2];
  const source = patternBars.slice(0, -1);
  const extremeIndex = kind === 'bottom'
    ? indexOfLowestLow(source)
    : indexOfHighestHigh(source);
  if (extremeIndex < source.length - 8 || extremeIndex > source.length - 1) return null;
  const extreme = source[extremeIndex];
  const first = patternBars[0];
  if (first.close <= 0) return null;

  if (kind === 'bottom') {
    const declinePct = (1 - extreme.low / first.close) * 100;
    if (declinePct < 10 || latest.close <= previous.high || latest.close <= latest.open) return null;
    return { patternBars, latest, previous, extreme, extremeIndex, movePct: round(declinePct, 2) };
  }

  const advancePct = (extreme.high / first.close - 1) * 100;
  if (advancePct < 10 || latest.close >= previous.low || latest.close >= latest.open) return null;
  return { patternBars, latest, previous, extreme, extremeIndex, movePct: round(advancePct, 2) };
}

export function latestHornSetup(
  bars: EodBar[],
  kind: 'bottom' | 'top',
): {
  pivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
  level: number;
} | null {
  const pivotKind = kind === 'bottom' ? 'low' : 'high';
  const setup = latestComparablePivotSetup(bars, pivotKind, 2);
  if (!setup) return null;
  const [first, second] = setup.pivots;
  if (second.index - first.index > 8) return null;
  const avgRangePeriod = Math.min(14, Math.max(2, setup.patternBars.length - 1));
  const avgRange = averageRange(setup.patternBars, avgRangePeriod, true);
  if (!avgRange) return null;
  const firstBar = setup.patternBars[first.index];
  const secondBar = setup.patternBars[second.index];
  if (candleRange(firstBar) < avgRange * 1.15 || candleRange(secondBar) < avgRange * 1.15) return null;

  const barsBetween = setup.patternBars.slice(first.index + 1, second.index);
  const level = kind === 'bottom' ? highestHigh(barsBetween) : lowestLow(barsBetween);
  if (level === null) return null;
  if (kind === 'bottom' && setup.latest.close <= level) return null;
  if (kind === 'top' && setup.latest.close >= level) return null;
  return { pivots: setup.pivots, level };
}

export function latestRangeSetup(
  bars: EodBar[],
  period: number,
): {
  baseBars: EodBar[];
  latest: EodBar;
  support: number;
  resistance: number;
  widthPct: number;
} | null {
  if (bars.length < period + 1) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-(period + 1), -1);
  const resistance = highestHigh(baseBars);
  const support = lowestLow(baseBars);
  if (resistance === null || support === null || resistance <= support) return null;
  const midpoint = (resistance + support) / 2;
  const widthPct = midpoint > 0 ? ((resistance - support) / midpoint) * 100 : 0;
  if (widthPct < 3 || widthPct > 18) return null;
  if (!isRangeBound(baseBars, 18)) return null;
  return {
    baseBars,
    latest,
    support,
    resistance,
    widthPct: round(widthPct, 2),
  };
}

export function latestTriangleSetup(
  bars: EodBar[],
  kind: 'ascending' | 'descending',
): {
  baseBars: EodBar[];
  latest: EodBar;
  resistance: number;
  support: number;
  highPivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
  lowPivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
  highSlope: number;
  lowSlope: number;
  resistanceTouches: number;
  supportTouches: number;
} | null {
  if (bars.length < 12) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-STRUCTURE_LOOKBACK_BARS - 1, -1);
  if (baseBars.length < 12) return null;
  const resistance = highestHigh(baseBars);
  const support = lowestLow(baseBars);
  if (resistance === null || support === null) return null;
  const pivots = findLocalPivots(baseBars, 1);
  const highPivots = pivots.filter((pivot) => pivot.kind === 'high').slice(-4);
  const lowPivots = pivots.filter((pivot) => pivot.kind === 'low').slice(-4);
  const highSlope = highPivots.length >= 2 ? linearSlope(highPivots.map((pivot) => ({ x: pivot.index, y: pivot.price }))) : 0;
  const lowSlope = lowPivots.length >= 2 ? linearSlope(lowPivots.map((pivot) => ({ x: pivot.index, y: pivot.price }))) : 0;
  if (highSlope === null || lowSlope === null) return null;
  const resistanceTouches = countTouches(baseBars, 'high', resistance, 2);
  const supportTouches = countTouches(baseBars, 'low', support, 2);

  if (kind === 'ascending') {
    if (lowPivots.length < 2) return null;
    if (resistanceTouches < 2 || lowSlope <= 0) return null;
    const initWidth = resistance - lowPivots[0].price;
    const finalWidth = resistance - lowPivots[lowPivots.length - 1].price;
    if (initWidth <= 0 || (initWidth - finalWidth) / initWidth < 0.2) return null;
  } else {
    if (highPivots.length < 2) return null;
    if (supportTouches < 2 || highSlope >= 0) return null;
    const initWidth = highPivots[0].price - support;
    const finalWidth = highPivots[highPivots.length - 1].price - support;
    if (initWidth <= 0 || (initWidth - finalWidth) / initWidth < 0.2) return null;
  }

  return {
    baseBars,
    latest,
    resistance,
    support,
    highPivots,
    lowPivots,
    highSlope,
    lowSlope,
    resistanceTouches,
    supportTouches,
  };
}

export function latestSymmetricalTriangleSetup(
  bars: EodBar[],
): {
  baseBars: EodBar[];
  latest: EodBar;
  highPivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
  lowPivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
  highSlope: number;
  lowSlope: number;
  upperLevel: number;
  lowerLevel: number;
} | null {
  if (bars.length < 12) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-STRUCTURE_LOOKBACK_BARS - 1, -1);
  const pivots = findLocalPivots(baseBars, 1);
  const highPivots = pivots.filter((pivot) => pivot.kind === 'high').slice(-4);
  const lowPivots = pivots.filter((pivot) => pivot.kind === 'low').slice(-4);
  if (highPivots.length < 2 || lowPivots.length < 2) return null;
  const highSlope = linearSlope(highPivots.map((pivot) => ({ x: pivot.index, y: pivot.price })));
  const lowSlope = linearSlope(lowPivots.map((pivot) => ({ x: pivot.index, y: pivot.price })));
  if (highSlope === null || lowSlope === null || highSlope >= 0 || lowSlope <= 0) return null;
  const upperLevel = highPivots[highPivots.length - 1].price;
  const lowerLevel = lowPivots[lowPivots.length - 1].price;
  if (upperLevel <= lowerLevel) return null;
  const initWidth = highPivots[0].price - lowPivots[0].price;
  const finalWidth = upperLevel - lowerLevel;
  if (initWidth <= 0 || (initWidth - finalWidth) / initWidth < 0.2) return null;
  return {
    baseBars,
    latest,
    highPivots,
    lowPivots,
    highSlope,
    lowSlope,
    upperLevel,
    lowerLevel,
  };
}

export function latestWedgeSetup(
  bars: EodBar[],
  kind: 'falling' | 'rising',
): {
  baseBars: EodBar[];
  latest: EodBar;
  upperLevel: number;
  lowerLevel: number;
  highSlope: number;
  lowSlope: number;
  rangeRatio: number;
} | null {
  if (bars.length < 14) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-18, -1);
  if (baseBars.length < 12) return null;
  const highSlope = linearSlope(baseBars.map((bar) => bar.high));
  const lowSlope = linearSlope(baseBars.map((bar) => bar.low));
  if (highSlope === null || lowSlope === null) return null;
  const firstRange = averageSegmentRange(baseBars.slice(0, 5));
  const lastRange = averageSegmentRange(baseBars.slice(-5));
  if (firstRange <= 0 || lastRange <= 0) return null;
  const rangeRatio = lastRange / firstRange;
  if (rangeRatio > 0.75) return null;
  const upperLevel = highestHigh(baseBars.slice(-5));
  const lowerLevel = lowestLow(baseBars.slice(-5));
  if (upperLevel === null || lowerLevel === null || upperLevel <= lowerLevel) return null;
  const pivots = findLocalPivots(baseBars, 1);
  const highPivots = pivots.filter((p) => p.kind === 'high');
  const lowPivots = pivots.filter((p) => p.kind === 'low');
  const upperStartIndex = highPivots.length >= 2 ? highPivots[0].index : 0;
  const upperEndIndex = highPivots.length >= 2 ? highPivots[highPivots.length - 1].index : baseBars.length - 1;
  const lowerStartIndex = lowPivots.length >= 2 ? lowPivots[0].index : 0;
  const lowerEndIndex = lowPivots.length >= 2 ? lowPivots[lowPivots.length - 1].index : baseBars.length - 1;
  if (upperEndIndex <= upperStartIndex || lowerEndIndex <= lowerStartIndex) return null;
  const upperStartPrice = highPivots.length >= 2 ? highPivots[0].price : baseBars[0].high;
  const upperEndPrice = highPivots.length >= 2 ? highPivots[highPivots.length - 1].price : upperLevel;
  const lowerStartPrice = lowPivots.length >= 2 ? lowPivots[0].price : baseBars[0].low;
  const lowerEndPrice = lowPivots.length >= 2 ? lowPivots[lowPivots.length - 1].price : lowerLevel;
  const upperLineSlope = (upperEndPrice - upperStartPrice) / (upperEndIndex - upperStartIndex);
  const lowerLineSlope = (lowerEndPrice - lowerStartPrice) / (lowerEndIndex - lowerStartIndex);
  if (kind === 'falling') {
    if (!(upperLineSlope < 0 && lowerLineSlope < 0 && upperLineSlope < lowerLineSlope)) return null;
  } else if (!(upperLineSlope > 0 && lowerLineSlope > 0 && lowerLineSlope > upperLineSlope)) {
    return null;
  }
  for (let i = 0; i < baseBars.length; i += 1) {
    const upperAt = upperStartPrice + upperLineSlope * (i - upperStartIndex);
    const lowerAt = lowerStartPrice + lowerLineSlope * (i - lowerStartIndex);
    if (upperAt <= lowerAt) return null;
    if (baseBars[i].high > upperAt * 1.005 || baseBars[i].low < lowerAt * 0.995) return null;
  }

  if (kind === 'falling') {
    if (!(highSlope < 0 && lowSlope < 0 && highSlope < lowSlope)) return null;
  } else if (!(highSlope > 0 && lowSlope > 0 && lowSlope > highSlope)) {
    return null;
  }

  return {
    baseBars,
    latest,
    upperLevel,
    lowerLevel,
    highSlope,
    lowSlope,
    rangeRatio: round(rangeRatio, 4),
  };
}

export function latestDiamondSetup(
  bars: EodBar[],
): {
  baseBars: EodBar[];
  latest: EodBar;
  support: number;
  resistance: number;
  earlyWidth: number;
  middleWidth: number;
  finalWidth: number;
} | null {
  if (bars.length < 19) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-19, -1);
  if (baseBars.length < 18) return null;
  const early = baseBars.slice(0, 6);
  const middle = baseBars.slice(6, 12);
  const final = baseBars.slice(12);
  const earlyWidth = segmentWidth(early);
  const middleWidth = segmentWidth(middle);
  const finalWidth = segmentWidth(final);
  if (earlyWidth === null || middleWidth === null || finalWidth === null) return null;
  if (middleWidth < earlyWidth * 1.25 || finalWidth > middleWidth * 0.75) return null;
  if (finalWidth < earlyWidth * 0.55) return null;
  const support = lowestLow(final);
  const resistance = highestHigh(final);
  if (support === null || resistance === null || resistance <= support) return null;
  return {
    baseBars,
    latest,
    support,
    resistance,
    earlyWidth: round(earlyWidth, 4),
    middleWidth: round(middleWidth, 4),
    finalWidth: round(finalWidth, 4),
  };
}

export function latestBroadeningSetup(
  bars: EodBar[],
): {
  baseBars: EodBar[];
  latest: EodBar;
  support: number;
  resistance: number;
  highSlope: number;
  lowSlope: number;
  rangeRatio: number;
} | null {
  if (bars.length < 14) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-18, -1);
  if (baseBars.length < 12) return null;
  const highSlope = linearSlope(baseBars.map((bar) => bar.high));
  const lowSlope = linearSlope(baseBars.map((bar) => bar.low));
  if (highSlope === null || lowSlope === null || highSlope <= 0 || lowSlope >= 0) return null;
  const firstRange = averageSegmentRange(baseBars.slice(0, 5));
  const lastRange = averageSegmentRange(baseBars.slice(-5));
  if (firstRange <= 0 || lastRange <= 0) return null;
  const rangeRatio = lastRange / firstRange;
  if (rangeRatio < 1.25) return null;
  const support = lowestLow(baseBars);
  const resistance = highestHigh(baseBars);
  if (support === null || resistance === null || resistance <= support) return null;
  return {
    baseBars,
    latest,
    support,
    resistance,
    highSlope,
    lowSlope,
    rangeRatio: round(rangeRatio, 4),
  };
}

export function latestBumpRunSetup(
  bars: EodBar[],
  kind: 'bottom' | 'top',
): {
  patternBars: EodBar[];
  latest: EodBar;
  leadSlope: number;
  bumpSlope: number;
  breakoutLevel: number;
  extreme: number;
} | null {
  if (bars.length < 20) return null;
  const patternBars = bars.slice(-20);
  const latest = patternBars[patternBars.length - 1];
  const source = patternBars.slice(0, -1);
  const lead = source.slice(0, 7);
  const bump = source.slice(7, 14);
  const run = source.slice(14);
  if (lead.length < 6 || bump.length < 6 || run.length < 4) return null;
  const leadSlope = linearSlope(lead.map((bar) => bar.close));
  const bumpSlope = linearSlope(bump.map((bar) => bar.close));
  if (leadSlope === null || bumpSlope === null) return null;

  if (kind === 'bottom') {
    const breakoutLevel = highestHigh(run);
    const extreme = lowestLow([...bump, ...run]);
    if (breakoutLevel === null || extreme === null) return null;
    if (!(leadSlope < 0 && bumpSlope < leadSlope * 1.6)) return null;
    if (latest.close <= breakoutLevel || latest.close <= latest.open) return null;
    return { patternBars, latest, leadSlope, bumpSlope, breakoutLevel, extreme };
  }

  const breakoutLevel = lowestLow(run);
  const extreme = highestHigh([...bump, ...run]);
  if (breakoutLevel === null || extreme === null) return null;
  if (!(leadSlope > 0 && bumpSlope > leadSlope * 1.6)) return null;
  if (latest.close >= breakoutLevel || latest.close >= latest.open) return null;
  return { patternBars, latest, leadSlope, bumpSlope, breakoutLevel, extreme };
}

export function latestBlowOffTopSetup(
  bars: EodBar[],
): {
  patternBars: EodBar[];
  latest: EodBar;
  advancePct: number;
  volumeRatio: number | null;
  spikeHigh: number;
  previousLow: number;
} | null {
  if (bars.length < 16) return null;
  const patternBars = bars.slice(-16);
  const latest = patternBars[patternBars.length - 1];
  const previous = patternBars[patternBars.length - 2];
  const prior = patternBars.slice(0, -1);
  if (!hasUpTrend(prior, 18)) return null;
  const avgRange = averageRange(patternBars, 10, true);
  const avgVolume = averageVolume(patternBars, 10, true);
  if (avgRange === null || candleRange(latest) < avgRange * 1.45) return null;
  const volumeRatio = avgVolume && avgVolume > 0 ? latest.volume / avgVolume : null;
  if (volumeRatio !== null && volumeRatio < 1.7) return null;
  if (latest.high <= previous.high || latest.close >= latest.open || latest.close >= previous.low) return null;
  return {
    patternBars,
    latest,
    advancePct: round(movePct(prior), 2),
    volumeRatio: volumeRatio === null ? null : round(volumeRatio, 2),
    spikeHigh: latest.high,
    previousLow: previous.low,
  };
}

export function latestThreeMethodsSetup(
  bars: EodBar[],
  direction: 'bullish' | 'bearish',
): {
  first: EodBar;
  middle: EodBar[];
  latest: EodBar;
} | null {
  if (bars.length < 5) return null;
  const patternBars = bars.slice(-5);
  const [first, second, third, fourth, latest] = patternBars;
  const middle = [second, third, fourth];
  if (!isLongDirectionalCandle(first, direction)) return null;
  const contained = middle.every((bar) => bar.high < first.high && bar.low > first.low && candleRange(bar) < candleRange(first) * 0.7);
  if (!contained) return null;
  if (direction === 'bullish') {
    if (latest.close <= latest.open || latest.close <= first.high) return null;
  } else if (latest.close >= latest.open || latest.close >= first.low) {
    return null;
  }
  return { first, middle, latest };
}

export function latestMatHoldSetup(
  bars: EodBar[],
  direction: 'bullish' | 'bearish',
): {
  first: EodBar;
  middle: EodBar[];
  latest: EodBar;
  breakoutLevel: number;
  holdLevel: number;
} | null {
  if (bars.length < 5) return null;
  const patternBars = bars.slice(-5);
  const [first, second, third, fourth, latest] = patternBars;
  const middle = [second, third, fourth];
  if (!isLongDirectionalCandle(first, direction)) return null;

  if (direction === 'bullish') {
    const breakoutLevel = highestHigh([first, ...middle]);
    const holdLevel = Math.max(first.open, first.low);
    if (breakoutLevel === null) return null;
    if (!middle.every((bar) => bar.low >= holdLevel && bar.close >= first.open)) return null;
    if (latest.close <= latest.open || latest.close <= breakoutLevel) return null;
    return { first, middle, latest, breakoutLevel, holdLevel };
  }

  const breakoutLevel = lowestLow([first, ...middle]);
  const holdLevel = Math.min(first.open, first.high);
  if (breakoutLevel === null) return null;
  if (!middle.every((bar) => bar.high <= holdLevel && bar.close <= first.open)) return null;
  if (latest.close >= latest.open || latest.close >= breakoutLevel) return null;
  return { first, middle, latest, breakoutLevel, holdLevel };
}

export function latestContinuationSetup(
  bars: EodBar[],
  direction: 'bullish' | 'bearish',
  shape: 'flag' | 'pennant',
): {
  poleBars: EodBar[];
  consolidationBars: EodBar[];
  latest: EodBar;
  poleMovePct: number;
  breakoutLevel: number;
  closeSlope: number;
  highSlope: number;
  lowSlope: number;
} | null {
  if (bars.length < 13) return null;
  const latest = bars[bars.length - 1];
  const patternBars = bars.slice(-18);
  const source = patternBars.slice(0, -1);
  const poleBars = source.slice(0, 7);
  const consolidationBars = source.slice(7);
  if (poleBars.length < 5 || consolidationBars.length < 5) return null;

  const poleMovePct = movePct(poleBars);
  if (direction === 'bullish' && poleMovePct < 8) return null;
  if (direction === 'bearish' && poleMovePct > -8) return null;

  const closeSlope = linearSlope(consolidationBars.map((bar) => bar.close));
  const highSlope = linearSlope(consolidationBars.map((bar) => bar.high));
  const lowSlope = linearSlope(consolidationBars.map((bar) => bar.low));
  if (closeSlope === null || highSlope === null || lowSlope === null) return null;

  const high = highestHigh(consolidationBars);
  const low = lowestLow(consolidationBars);
  if (high === null || low === null) return null;
  const poleHeight = Math.abs(poleBars[poleBars.length - 1].close - poleBars[0].close);
  if (poleHeight <= 0 || high - low > poleHeight * 0.8) return null;

  if (shape === 'flag') {
    if (direction === 'bullish' && closeSlope > 0) return null;
    if (direction === 'bearish' && closeSlope < 0) return null;
  } else {
    if (!(highSlope < 0 && lowSlope > 0)) return null;
  }

  if (direction === 'bullish') {
    if (latest.close <= high) return null;
    return { poleBars, consolidationBars, latest, poleMovePct: round(poleMovePct, 2), breakoutLevel: high, closeSlope, highSlope, lowSlope };
  }

  if (latest.close >= low) return null;
  return { poleBars, consolidationBars, latest, poleMovePct: round(poleMovePct, 2), breakoutLevel: low, closeSlope, highSlope, lowSlope };
}

export function latestChannelSetup(
  bars: EodBar[],
  direction: 'rising' | 'falling',
): {
  baseBars: EodBar[];
  latest: EodBar;
  highSlope: number;
  lowSlope: number;
  support: number;
  resistance: number;
  supportPivots: [ChartPatternPivot, ChartPatternPivot];
  resistancePivots: [ChartPatternPivot, ChartPatternPivot];
} | null {
  if (bars.length < 20) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(Math.max(0, bars.length - 140), -1);
  if (baseBars.length < 18) return null;

  const pivots = findLocalPivots(baseBars, 2);
  const supportPivots = latestDirectionalPivotPair(
    pivots.filter((pivot) => pivot.kind === 'low'),
    direction,
  );
  const resistancePivots = latestDirectionalPivotPair(
    pivots.filter((pivot) => pivot.kind === 'high'),
    direction,
  );
  if (!supportPivots || !resistancePivots) return null;

  const lowSlope = pivotSlope(supportPivots[0], supportPivots[1]);
  const highSlope = pivotSlope(resistancePivots[0], resistancePivots[1]);

  if (direction === 'rising') {
    if (highSlope <= 0 || lowSlope <= 0) return null;
  } else if (highSlope >= 0 || lowSlope >= 0) {
    return null;
  }

  // Near-parallel rails may be noisy, but a 2.5x slope difference is a wedge.
  const slopeRatio = Math.min(Math.abs(highSlope), Math.abs(lowSlope)) /
    Math.max(Math.abs(highSlope), Math.abs(lowSlope));
  if (!Number.isFinite(slopeRatio) || slopeRatio < 0.8) return null;
  const support = projectedPivotLinePrice(supportPivots[0], supportPivots[1], baseBars.length);
  const resistance = projectedPivotLinePrice(resistancePivots[0], resistancePivots[1], baseBars.length);
  if (resistance <= support) return null;
  const startIndex = Math.min(supportPivots[0].index, resistancePivots[0].index);
  const startWidth = projectedPivotLinePrice(resistancePivots[0], resistancePivots[1], startIndex) -
    projectedPivotLinePrice(supportPivots[0], supportPivots[1], startIndex);
  const endWidth = resistance - support;
  // Stable width across the actual pivot span separates a channel from a wedge.
  if (startWidth <= 0 || Math.abs(startWidth - endWidth) > (startWidth + endWidth) / 2 * 0.25) return null;
  const meanPrice = averageClose(baseBars.slice(startIndex));
  if (meanPrice <= 0) return null;
  const containmentTol = Math.max(endWidth * 0.12, meanPrice * 0.015);
  let containedBars = 0;
  const spanBars = baseBars.length - startIndex;
  for (let i = startIndex; i < baseBars.length; i += 1) {
    const upperAt = projectedPivotLinePrice(resistancePivots[0], resistancePivots[1], i);
    const lowerAt = projectedPivotLinePrice(supportPivots[0], supportPivots[1], i);
    if (baseBars[i].high <= upperAt + containmentTol && baseBars[i].low >= lowerAt - containmentTol) {
      containedBars += 1;
    }
  }
  if (spanBars <= 0 || containedBars / spanBars < 0.8) return null;
  const tolerance = Math.max((resistance - support) * 0.1, Math.abs(latest.close) * 0.005);
  if (latest.close < support - tolerance || latest.close > resistance + tolerance) return null;
  return {
    baseBars,
    latest,
    highSlope,
    lowSlope,
    support: round(support, 4),
    resistance: round(resistance, 4),
    supportPivots,
    resistancePivots,
  };
}

function latestDirectionalPivotPair(
  pivots: ChartPatternPivot[],
  direction: 'rising' | 'falling',
): [ChartPatternPivot, ChartPatternPivot] | null {
  for (let endIndex = pivots.length - 1; endIndex > 0; endIndex -= 1) {
    for (let startIndex = endIndex - 1; startIndex >= 0; startIndex -= 1) {
      const first = pivots[startIndex];
      const second = pivots[endIndex];
      if (second.index - first.index < 5) {
        continue;
      }
      const slope = pivotSlope(first, second);
      if ((direction === 'rising' && slope > 0) || (direction === 'falling' && slope < 0)) {
        return [first, second];
      }
    }
  }

  return null;
}

function pivotSlope(first: ChartPatternPivot, second: ChartPatternPivot): number {
  const span = second.index - first.index;
  if (span === 0) return 0;
  return (second.price - first.price) / span;
}

export function projectedPivotLinePrice(
  first: ChartPatternPivot,
  second: ChartPatternPivot,
  targetIndex: number,
): number {
  return first.price + pivotSlope(first, second) * (targetIndex - first.index);
}

export function latestHighTightFlagSetup(
  bars: EodBar[],
): {
  rallyBars: EodBar[];
  pullbackBars: EodBar[];
  latest: EodBar;
  rallyPct: number;
  pullbackPct: number;
  breakoutLevel: number;
  pullbackLow: number;
} | null {
  if (bars.length < 15) return null;
  const latest = bars[bars.length - 1];
  const source = bars.slice(-21, -1);
  const rallyBars = source.slice(0, 10);
  const pullbackBars = source.slice(10);
  if (rallyBars.length < 8 || pullbackBars.length < 4) return null;
  const rallyStart = rallyBars[0].close;
  const rallyHigh = highestHigh(rallyBars);
  const pullbackHigh = highestHigh(pullbackBars);
  const pullbackLow = lowestLow(pullbackBars);
  if (rallyStart <= 0 || rallyHigh === null || pullbackHigh === null || pullbackLow === null) return null;
  const rallyPct = ((rallyHigh / rallyStart) - 1) * 100;
  const pullbackPct = (1 - pullbackLow / rallyHigh) * 100;
  if (rallyPct < 100 || pullbackPct < 8 || pullbackPct > 35) return null;
  if (latest.close <= pullbackHigh) return null;
  return {
    rallyBars,
    pullbackBars,
    latest,
    rallyPct: round(rallyPct, 2),
    pullbackPct: round(pullbackPct, 2),
    breakoutLevel: pullbackHigh,
    pullbackLow,
  };
}

export function latestCoilSetup(
  bars: EodBar[],
): {
  baseBars: EodBar[];
  latest: EodBar;
  firstRange: number;
  latestRange: number;
  rangeRatio: number;
  support: number;
  resistance: number;
} | null {
  if (bars.length < 8) return null;
  const latest = bars[bars.length - 1];
  const baseBars = bars.slice(-9, -1);
  if (baseBars.length < 7) return null;
  const ranges = baseBars.map(candleRange);
  const rangeSlope = linearSlope(ranges);
  const firstRange = ranges[0];
  const latestRange = ranges[ranges.length - 1];
  if (rangeSlope === null || rangeSlope >= 0 || firstRange <= 0) return null;
  const rangeRatio = latestRange / firstRange;
  if (rangeRatio > 0.65) return null;
  const support = lowestLow(baseBars);
  const resistance = highestHigh(baseBars);
  if (support === null || resistance === null) return null;
  if (latest.close > resistance || latest.close < support) return null;
  return {
    baseBars,
    latest,
    firstRange: round(firstRange, 4),
    latestRange: round(latestRange, 4),
    rangeRatio: round(rangeRatio, 4),
    support,
    resistance,
  };
}

export function latestThreePivotSetup(
  bars: EodBar[],
  kind: 'rising-valleys' | 'falling-peaks',
): {
  patternBars: EodBar[];
  latest: EodBar;
  pivots: Array<{ index: number; date: string; price: number; kind: 'high' | 'low' }>;
  level: number;
} | null {
  if (bars.length < 14) return null;
  const patternBars = bars.slice(-REVERSAL_LOOKBACK_BARS);
  const latest = patternBars[patternBars.length - 1];
  const pivotSource = patternBars.slice(0, -1);
  const pivotKind = kind === 'rising-valleys' ? 'low' : 'high';
  const pivots = findLocalPivots(pivotSource, 2)
    .filter((pivot) => pivot.kind === pivotKind)
    .slice(-3);
  if (pivots.length !== 3 || !pivotsHaveSpacing(pivots, 3)) return null;
  if (patternBars.length - 1 - pivots[2].index > 6) return null;
  const seg1 = patternBars.slice(pivots[0].index + 1, pivots[1].index);
  const seg2 = patternBars.slice(pivots[1].index + 1, pivots[2].index);
  if (kind === 'rising-valleys') {
    if (!(pivots[1].price >= pivots[0].price * 1.008 && pivots[2].price >= pivots[1].price * 1.008)) return null;
    const peak1 = highestHigh(seg1);
    const peak2 = highestHigh(seg2);
    if (peak1 === null || peak2 === null) return null;
    if (retracementDepthPct(pivots[0].price, pivots[1].price, peak1) < 2 || retracementDepthPct(pivots[1].price, pivots[2].price, peak2) < 2) return null;
  } else {
    if (!(pivots[1].price <= pivots[0].price * 0.992 && pivots[2].price <= pivots[1].price * 0.992)) return null;
    const valley1 = lowestLow(seg1);
    const valley2 = lowestLow(seg2);
    if (valley1 === null || valley2 === null) return null;
    if (retracementDepthPct(pivots[0].price, pivots[1].price, valley1) < 2 || retracementDepthPct(pivots[1].price, pivots[2].price, valley2) < 2) return null;
  }
  if (kind === 'rising-valleys') {
    if (!(pivots[0].price < pivots[1].price && pivots[1].price < pivots[2].price)) return null;
    const resistance = highestHigh(patternBars.slice(pivots[0].index + 1, pivots[2].index));
    if (resistance === null || latest.close <= resistance) return null;
    return { patternBars, latest, pivots, level: resistance };
  }

  if (!(pivots[0].price > pivots[1].price && pivots[1].price > pivots[2].price)) return null;
  const support = lowestLow(patternBars.slice(pivots[0].index + 1, pivots[2].index));
  if (support === null || latest.close >= support) return null;
  return { patternBars, latest, pivots, level: support };
}

export function latestMeasuredMoveSetup(
  bars: EodBar[],
  direction: 'up' | 'down',
): {
  patternBars: EodBar[];
  latest: EodBar;
  firstLegPct: number;
  secondLegPct: number;
  legRatio: number;
  correctionLow?: number;
  correctionHigh?: number;
} | null {
  if (bars.length < 15) return null;
  const patternBars = bars.slice(-15);
  const latest = patternBars[patternBars.length - 1];
  const firstLeg = patternBars.slice(0, 5);
  const correction = patternBars.slice(5, 10);
  const secondLeg = patternBars.slice(10);
  const firstLegPct = movePct(firstLeg);
  const secondLegPct = movePct(secondLeg);
  const firstAbs = Math.abs(firstLegPct);
  const secondAbs = Math.abs(secondLegPct);
  if (firstAbs < 8 || secondAbs < 6) return null;
  const legRatio = secondAbs / firstAbs;
  if (legRatio < 0.65 || legRatio > 1.45) return null;

  if (direction === 'up') {
    const correctionLow = lowestLow(correction);
    if (firstLegPct <= 0 || secondLegPct <= 0 || correctionLow === null) return null;
    if (!hasUpTrend(secondLeg, 6) || latest.close <= secondLeg[secondLeg.length - 2].high) return null;
    return {
      patternBars,
      latest,
      firstLegPct: round(firstLegPct, 2),
      secondLegPct: round(secondLegPct, 2),
      legRatio: round(legRatio, 4),
      correctionLow,
    };
  }

  const correctionHigh = highestHigh(correction);
  if (firstLegPct >= 0 || secondLegPct >= 0 || correctionHigh === null) return null;
  if (!hasDownTrend(secondLeg, 6) || latest.close >= secondLeg[secondLeg.length - 2].low) return null;
  return {
    patternBars,
    latest,
    firstLegPct: round(firstLegPct, 2),
    secondLegPct: round(secondLegPct, 2),
    legRatio: round(legRatio, 4),
    correctionHigh,
  };
}

export function latestHeadShouldersSetup(
  bars: EodBar[],
  kind: 'top' | 'bottom',
): {
  leftShoulder: { index: number; date: string; price: number; kind: 'high' | 'low' };
  trough1?: { index: number; date: string; price: number; kind: 'high' | 'low' };
  head: { index: number; date: string; price: number; kind: 'high' | 'low' };
  trough2?: { index: number; date: string; price: number; kind: 'high' | 'low' };
  rightShoulder: { index: number; date: string; price: number; kind: 'high' | 'low' };
  neckline: number;
} | null {
  if (bars.length < 16) return null;
  const patternBars = bars.slice(-REVERSAL_LOOKBACK_BARS);
  const latest = patternBars[patternBars.length - 1];
  const pivotSource = patternBars.slice(0, -1);
  const pivots = findLocalPivots(pivotSource, 2);
  const pivotKind = kind === 'top' ? 'high' : 'low';
  const candidates = pivots.filter((pivot) => pivot.kind === pivotKind).slice(-3);
  if (candidates.length !== 3 || !pivotsHaveSpacing(candidates, 3)) return null;
  const [leftShoulder, head, rightShoulder] = candidates;
  if (!pivotsComparable([leftShoulder, rightShoulder], 6)) return null;

  const time1 = head.index - leftShoulder.index;
  const time2 = rightShoulder.index - head.index;
  if (time1 > 0 && time2 > 0) {
    const symmetry = time1 / time2;
    if (symmetry < 0.35 || symmetry > 2.8) return null;
  }

  if (kind === 'top') {
    if (!(head.price > leftShoulder.price * 1.04 && head.price > rightShoulder.price * 1.04)) return null;
    const neck1Rel = indexOfLowestLow(patternBars.slice(leftShoulder.index + 1, head.index));
    const neck2Rel = indexOfLowestLow(patternBars.slice(head.index + 1, rightShoulder.index));
    const neck1Idx = leftShoulder.index + 1 + neck1Rel;
    const neck2Idx = head.index + 1 + neck2Rel;
    const neck1Bar = patternBars[neck1Idx];
    const neck2Bar = patternBars[neck2Idx];
    const trough1 = neck1Bar ? { index: neck1Idx, date: neck1Bar.date, price: neck1Bar.low, kind: 'low' as const } : undefined;
    const trough2 = neck2Bar ? { index: neck2Idx, date: neck2Bar.date, price: neck2Bar.low, kind: 'low' as const } : undefined;
    const slope = (trough1 && trough2) ? (linearSlope([{ x: trough1.index, y: trough1.price }, { x: trough2.index, y: trough2.price }]) ?? 0) : 0;
    const projectedNeckline = trough1 ? round(trough1.price + slope * (patternBars.length - 1 - trough1.index), 4) : 0;
    const avgNeckline = (trough1 && trough2) ? round((trough1.price + trough2.price) / 2, 4) : 0;
    const neckline = Number.isFinite(projectedNeckline) && projectedNeckline > 0 ? projectedNeckline : avgNeckline;
    const headHeight = head.price - (avgNeckline > 0 ? avgNeckline : neckline);
    if (headHeight <= 0 || Math.abs(leftShoulder.price - rightShoulder.price) / headHeight > 0.35) return null;
    if (neckline <= 0 || latest.close >= neckline) return null;
    return { leftShoulder, trough1, head, trough2, rightShoulder, neckline };
  }

  if (!(head.price < leftShoulder.price * 0.96 && head.price < rightShoulder.price * 0.96)) return null;
  const neck1Rel = indexOfHighestHigh(patternBars.slice(leftShoulder.index + 1, head.index));
  const neck2Rel = indexOfHighestHigh(patternBars.slice(head.index + 1, rightShoulder.index));
  const neck1Idx = leftShoulder.index + 1 + neck1Rel;
  const neck2Idx = head.index + 1 + neck2Rel;
  const neck1Bar = patternBars[neck1Idx];
  const neck2Bar = patternBars[neck2Idx];
  const trough1 = neck1Bar ? { index: neck1Idx, date: neck1Bar.date, price: neck1Bar.high, kind: 'high' as const } : undefined;
  const trough2 = neck2Bar ? { index: neck2Idx, date: neck2Bar.date, price: neck2Bar.high, kind: 'high' as const } : undefined;
  const slope = (trough1 && trough2) ? (linearSlope([{ x: trough1.index, y: trough1.price }, { x: trough2.index, y: trough2.price }]) ?? 0) : 0;
  const projectedNeckline = trough1 ? round(trough1.price + slope * (patternBars.length - 1 - trough1.index), 4) : 0;
  const avgNeckline = (trough1 && trough2) ? round((trough1.price + trough2.price) / 2, 4) : 0;
  const neckline = Number.isFinite(projectedNeckline) && projectedNeckline > 0 ? projectedNeckline : avgNeckline;
  const headDepth = (avgNeckline > 0 ? avgNeckline : neckline) - head.price;
  if (headDepth <= 0 || Math.abs(leftShoulder.price - rightShoulder.price) / headDepth > 0.35) return null;
  if (neckline <= 0 || latest.close <= neckline) return null;
  return { leftShoulder, trough1, head, trough2, rightShoulder, neckline };
}

export function latestCupHandleSetup(
  bars: EodBar[],
  kind: 'bullish' | 'bearish',
): {
  patternBars: EodBar[];
  rimLevel: number;
  cupExtreme: number;
  handlePullbackPct: number;
} | null {
  if (bars.length < 18) return null;
  const patternBars = bars.slice(-CUP_HANDLE_LOOKBACK_BARS);
  const latest = patternBars[patternBars.length - 1];
  const cupBars = patternBars.slice(0, -5);
  const handleBars = patternBars.slice(-5, -1);
  if (cupBars.length < 12 || handleBars.length < 3) return null;

  const left = cupBars[0];
  const right = cupBars[cupBars.length - 1];
  if (kind === 'bullish') {
    const cupLow = lowestLow(cupBars);
    const handleLow = lowestLow(handleBars);
    const handleHigh = highestHigh(handleBars);
    if (cupLow === null || handleLow === null || handleHigh === null) return null;
    const rimLevel = round((left.close + right.close) / 2, 4);
    const cupDepth = rimLevel - cupLow;
    if (cupDepth <= 0 || Math.abs(left.close - right.close) / rimLevel > 0.08) return null;
    if (handleLow < right.close - cupDepth * 0.45) return null;
    if (latest.close <= handleHigh || latest.close <= rimLevel) return null;
    return {
      patternBars,
      rimLevel,
      cupExtreme: cupLow,
      handlePullbackPct: round(((right.close - handleLow) / right.close) * 100, 2),
    };
  }

  const cupHigh = highestHigh(cupBars);
  const handleHigh = highestHigh(handleBars);
  const handleLow = lowestLow(handleBars);
  if (cupHigh === null || handleHigh === null || handleLow === null) return null;
  const rimLevel = round((left.close + right.close) / 2, 4);
  const cupHeight = cupHigh - rimLevel;
  if (cupHeight <= 0 || Math.abs(left.close - right.close) / rimLevel > 0.08) return null;
  if (handleHigh > right.close + cupHeight * 0.45) return null;
  if (latest.close >= handleLow || latest.close >= rimLevel) return null;
  return {
    patternBars,
    rimLevel,
    cupExtreme: cupHigh,
    handlePullbackPct: round(((handleHigh - right.close) / right.close) * 100, 2),
  };
}

export function latestRoundingSetup(
  bars: EodBar[],
  kind: 'bottom' | 'top',
): {
  patternBars: EodBar[];
  rimLevel: number;
  extreme: number;
} | null {
  if (bars.length < 18) return null;
  const patternBars = bars.slice(-24);
  const latest = patternBars[patternBars.length - 1];
  const left = patternBars.slice(0, 6);
  const middle = patternBars.slice(6, -6);
  const right = patternBars.slice(-6, -1);
  if (left.length < 4 || middle.length < 6 || right.length < 4) return null;
  const leftAvg = averageClose(left);
  const rightAvg = averageClose(right);
  if (leftAvg <= 0 || rightAvg <= 0 || Math.abs(leftAvg - rightAvg) / ((leftAvg + rightAvg) / 2) > 0.12) return null;

  if (kind === 'bottom') {
    const bowlLow = lowestLow(middle);
    if (bowlLow === null) return null;
    const rimLevel = round((leftAvg + rightAvg) / 2, 4);
    if ((rimLevel - bowlLow) / rimLevel < 0.12) return null;
    const middleAvg = averageClose(middle);
    const middleHigh = highestHigh(middle);
    const rightHigh = highestHigh(right);
    if (middleAvg >= Math.min(leftAvg, rightAvg) * 0.95) return null;
    if (middleHigh === null || rightHigh === null || middleHigh > rimLevel * 1.04 || rightHigh > rimLevel * 1.08) return null;
    if (latest.close <= rimLevel || latest.close <= right[right.length - 1].close) return null;
    if (latest.close <= rimLevel) return null;
    return { patternBars, rimLevel, extreme: bowlLow };
  }

  const archHigh = highestHigh(middle);
  if (archHigh === null) return null;
  const rimLevel = round((leftAvg + rightAvg) / 2, 4);
  if ((archHigh - rimLevel) / rimLevel < 0.12) return null;
  const middleAvgTop = averageClose(middle);
  const middleLow = lowestLow(middle);
  const rightLow = lowestLow(right);
  if (middleAvgTop <= Math.max(leftAvg, rightAvg) * 1.05) return null;
  if (middleLow === null || rightLow === null || middleLow < rimLevel * 0.96 || rightLow < rimLevel * 0.92) return null;
  if (latest.close >= rimLevel || latest.close >= right[right.length - 1].close) return null;
  if (latest.close >= rimLevel) return null;
  return { patternBars, rimLevel, extreme: archHigh };
}

export function latestAdamEveSetup(
  bars: EodBar[],
  kind: 'bottom' | 'top',
): {
  adam: ChartPatternPivot;
  eve: ChartPatternPivot;
  neckline: number;
} | null {
  if (bars.length < 16) return null;
  const patternBars = bars.slice(-REVERSAL_LOOKBACK_BARS);
  const latest = patternBars[patternBars.length - 1];
  const pivotSource = patternBars.slice(0, -1);
  const pivotKind = kind === 'bottom' ? 'low' : 'high';
  const pivots = findLocalPivots(pivotSource, 2)
    .filter((pivot) => pivot.kind === pivotKind)
    .slice(-2);
  if (pivots.length !== 2 || !pivotsHaveSpacing(pivots, 4)) return null;
  const [adam, eve] = pivots;
  if (!pricesComparable([adam.price, eve.price], 8)) return null;
  if (!isSharpPivot(patternBars, adam, kind) || !isRoundedPivot(patternBars, eve, kind)) return null;

  if (kind === 'bottom') {
    const neckline = highestHigh(patternBars.slice(adam.index + 1, eve.index));
    if (neckline === null || latest.close <= neckline) return null;
    return { adam, eve, neckline };
  }

  const neckline = lowestLow(patternBars.slice(adam.index + 1, eve.index));
  if (neckline === null || latest.close >= neckline) return null;
  return { adam, eve, neckline };
}

export function latestScallopHandleSetup(
  bars: EodBar[],
): {
  patternBars: EodBar[];
  scallopLow: number;
  rightRim: number;
  breakoutLevel: number;
  advancePct: number;
  handlePullbackPct: number;
} | null {
  if (bars.length < 18) return null;
  const patternBars = bars.slice(-24);
  const latest = patternBars[patternBars.length - 1];
  const baseBars = patternBars.slice(0, -5);
  const handleBars = patternBars.slice(-5, -1);
  if (baseBars.length < 12 || handleBars.length < 3) return null;
  const left = baseBars[0];
  const right = baseBars[baseBars.length - 1];
  const lowIndex = indexOfLowestLow(baseBars);
  const scallopLow = baseBars[lowIndex].low;
  if (lowIndex < 2 || lowIndex > baseBars.length - 4) return null;
  if (left.close <= 0 || right.close < left.close * 1.08) return null;
  if (scallopLow > left.close * 0.92) return null;
  const handleLow = lowestLow(handleBars);
  const handleHigh = highestHigh(handleBars);
  if (handleLow === null || handleHigh === null) return null;
  const scallopDepth = right.close - scallopLow;
  if (scallopDepth <= 0 || handleLow < right.close - scallopDepth * 0.45) return null;
  if (latest.close <= handleHigh || latest.close <= right.high) return null;
  return {
    patternBars,
    scallopLow,
    rightRim: right.close,
    breakoutLevel: handleHigh,
    advancePct: round(((right.close / scallopLow) - 1) * 100, 2),
    handlePullbackPct: round(((right.close - handleLow) / right.close) * 100, 2),
  };
}

export function latestComplexHeadShouldersSetup(
  bars: EodBar[],
  kind: 'top' | 'bottom',
): {
  direction: NonNullable<ScannerResult['direction']>;
  pivots: ChartPatternPivot[];
  head: ChartPatternPivot;
  neckline: number;
} | null {
  if (bars.length < 22) return null;
  const patternBars = bars.slice(-REVERSAL_LOOKBACK_BARS);
  const latest = patternBars[patternBars.length - 1];
  const pivotSource = patternBars.slice(0, -1);
  const pivotKind = kind === 'top' ? 'high' : 'low';
  const pivots = findLocalPivots(pivotSource, 2)
    .filter((pivot) => pivot.kind === pivotKind)
    .slice(-5);
  if (pivots.length !== 5 || !pivotsHaveSpacing(pivots, 2)) return null;

  const head = kind === 'top'
    ? pivots.reduce((highest, pivot) => (pivot.price > highest.price ? pivot : highest), pivots[0])
    : pivots.reduce((lowest, pivot) => (pivot.price < lowest.price ? pivot : lowest), pivots[0]);
  const headPosition = pivots.indexOf(head);
  if (headPosition === 0 || headPosition === pivots.length - 1) return null;
  const shoulders = pivots.filter((pivot) => pivot !== head);
  if (!pricesComparable(shoulders.map((pivot) => pivot.price), 8)) return null;

  if (kind === 'top') {
    const shoulderHigh = Math.max(...shoulders.map((pivot) => pivot.price));
    if (head.price <= shoulderHigh * 1.04) return null;
    const neckline = lowestLow(patternBars.slice(pivots[0].index + 1, pivots[pivots.length - 1].index));
    if (neckline === null || latest.close >= neckline) return null;
    return { direction: 'bearish', pivots, head, neckline };
  }

  const shoulderLow = Math.min(...shoulders.map((pivot) => pivot.price));
  if (head.price >= shoulderLow * 0.96) return null;
  const neckline = highestHigh(patternBars.slice(pivots[0].index + 1, pivots[pivots.length - 1].index));
  if (neckline === null || latest.close <= neckline) return null;
  return { direction: 'bullish', pivots, head, neckline };
}
