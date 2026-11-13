import type { EodBar } from '@/features/scanner/types';
import type { ChartPatternGeometry, ChartPatternPivot } from '@/features/chartPatterns/types';
import { findLocalPivots, highestHigh, lowestLow, round } from '@/features/chartPatterns/primitives';
import { latestComparablePivotSetup, latestVReversalSetup, latestHornSetup, latestRangeSetup, latestTriangleSetup, latestSymmetricalTriangleSetup, latestWedgeSetup, latestDiamondSetup, latestBroadeningSetup, latestBumpRunSetup, latestBlowOffTopSetup, latestThreeMethodsSetup, latestMatHoldSetup, latestContinuationSetup, latestChannelSetup, projectedPivotLinePrice, latestHighTightFlagSetup, latestCoilSetup, latestThreePivotSetup, latestMeasuredMoveSetup, latestHeadShouldersSetup, latestCupHandleSetup, latestRoundingSetup, latestAdamEveSetup, latestScallopHandleSetup, latestComplexHeadShouldersSetup } from '@/features/chartPatterns/setups';
import { indexOfLowestLow, indexOfHighestHigh } from '@/features/chartPatterns/shared';

export function buildAscendingTriangleGeometry(
  setup: NonNullable<ReturnType<typeof latestTriangleSetup>>,
): ChartPatternGeometry {
  const firstBar = setup.baseBars[0];
  const lastBar = setup.baseBars[setup.baseBars.length - 1];
  const firstLowPivot = setup.lowPivots[0];
  const lastLowPivot = setup.lowPivots[setup.lowPivots.length - 1];
  return {
    family: 'triangle',
    pivotMarkers: buildPivotMarkers(setup.lowPivots),
    trendLines: [
      {
        id: 'resistance',
        label: 'Resistance',
        role: 'resistance',
        start: { date: firstBar.date, price: setup.resistance },
        end: { date: lastBar.date, price: setup.resistance },
        extendRight: false,
      },
      {
        id: 'rising-support',
        label: 'Rising lows',
        role: 'lower',
        start: pivotToGeometryPoint(firstLowPivot),
        end: pivotToGeometryPoint(lastLowPivot),
        extendRight: false,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: 'Ascending Triangle',
        point: { date: setup.latest.date, price: setup.resistance },
      },
    ],
  };
}

export function buildDescendingTriangleGeometry(
  setup: NonNullable<ReturnType<typeof latestTriangleSetup>>,
): ChartPatternGeometry {
  const firstBar = setup.baseBars[0];
  const lastBar = setup.baseBars[setup.baseBars.length - 1];
  const firstHighPivot = setup.highPivots[0];
  const lastHighPivot = setup.highPivots[setup.highPivots.length - 1];
  return {
    family: 'triangle',
    pivotMarkers: buildPivotMarkers(setup.highPivots),
    trendLines: [
      {
        id: 'falling-resistance',
        label: 'Falling highs',
        role: 'upper',
        start: pivotToGeometryPoint(firstHighPivot),
        end: pivotToGeometryPoint(lastHighPivot),
        extendRight: false,
      },
      {
        id: 'support',
        label: 'Support',
        role: 'support',
        start: { date: firstBar.date, price: setup.support },
        end: { date: lastBar.date, price: setup.support },
        extendRight: false,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: 'Descending Triangle',
        point: { date: setup.latest.date, price: setup.support },
      },
    ],
  };
}

export function buildSymmetricalTriangleGeometry(
  setup: NonNullable<ReturnType<typeof latestSymmetricalTriangleSetup>>,
): ChartPatternGeometry {
  const firstHighPivot = setup.highPivots[0];
  const lastHighPivot = setup.highPivots[setup.highPivots.length - 1];
  const firstLowPivot = setup.lowPivots[0];
  const lastLowPivot = setup.lowPivots[setup.lowPivots.length - 1];
  return {
    family: 'triangle',
    pivotMarkers: buildPivotMarkers([...setup.highPivots, ...setup.lowPivots].sort((a, b) => a.index - b.index)),
    trendLines: [
      {
        id: 'falling-resistance',
        label: 'Falling highs',
        role: 'upper',
        start: pivotToGeometryPoint(firstHighPivot),
        end: pivotToGeometryPoint(lastHighPivot),
        extendRight: false,
      },
      {
        id: 'rising-support',
        label: 'Rising lows',
        role: 'lower',
        start: pivotToGeometryPoint(firstLowPivot),
        end: pivotToGeometryPoint(lastLowPivot),
        extendRight: false,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: 'Symmetrical Triangle',
        point: { date: setup.latest.date, price: setup.latest.close },
      },
    ],
  };
}

export function buildDoubleReversalGeometry(
  setup: NonNullable<ReturnType<typeof latestComparablePivotSetup>>,
  confirmationLevel: number,
  kind: 'top' | 'bottom',
  patternLabel: string,
): ChartPatternGeometry {
  const firstPivot = setup.pivots[0];
  const confirmationRole = kind === 'top' ? 'support' : 'neckline';
  const latestPoint = {
    index: setup.patternBars.length - 1,
    date: setup.latest.date,
    price: confirmationLevel,
  };

  return {
    family: 'double-top-bottom',
    zones: [{
      id: 'reversal-base',
      role: 'base',
      startDate: firstPivot.date,
      endDate: setup.pivots[setup.pivots.length - 1].date,
      low: round(Math.min(confirmationLevel, ...setup.pivots.map((p) => p.price)), 4),
      high: round(Math.max(confirmationLevel, ...setup.pivots.map((p) => p.price)), 4),
      fillOpacity: 0.08,
    }],
    pivotMarkers: buildPivotMarkers(setup.pivots),
    trendLines: [
      {
        id: 'confirmation-level',
        label: kind === 'top' ? 'Support' : 'Neckline',
        role: confirmationRole,
        start: { index: firstPivot.index, date: firstPivot.date, price: confirmationLevel },
        end: latestPoint,
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: latestPoint,
      },
    ],
  };
}

export function buildTripleReversalGeometry(
  setup: NonNullable<ReturnType<typeof latestComparablePivotSetup>>,
  confirmationLevel: number,
  kind: 'top' | 'bottom',
  patternLabel: string,
): ChartPatternGeometry {
  const firstPivot = setup.pivots[0];
  const confirmationRole = kind === 'top' ? 'support' : 'neckline';
  const latestPoint = {
    index: setup.patternBars.length - 1,
    date: setup.latest.date,
    price: confirmationLevel,
  };

  return {
    family: 'triple-top-bottom',
    zones: [{
      id: 'reversal-base',
      role: 'base',
      startDate: firstPivot.date,
      endDate: setup.pivots[setup.pivots.length - 1].date,
      low: round(Math.min(confirmationLevel, ...setup.pivots.map((p) => p.price)), 4),
      high: round(Math.max(confirmationLevel, ...setup.pivots.map((p) => p.price)), 4),
      fillOpacity: 0.08,
    }],
    pivotMarkers: buildPivotMarkers(setup.pivots),
    trendLines: [
      {
        id: 'confirmation-level',
        label: kind === 'top' ? 'Support' : 'Neckline',
        role: confirmationRole,
        start: { index: firstPivot.index, date: firstPivot.date, price: confirmationLevel },
        end: latestPoint,
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: latestPoint,
      },
    ],
  };
}

export function buildRangeGeometry(
  setup: NonNullable<ReturnType<typeof latestRangeSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const first = setup.baseBars[0];
  const last = setup.baseBars[setup.baseBars.length - 1];
  const latestPoint = { date: setup.latest.date, price: setup.latest.close };

  return {
    family: 'range',
    trendLines: [
      {
        id: 'support',
        label: 'Range support',
        role: 'support',
        start: { date: first.date, price: setup.support },
        end: { date: latestPoint.date, price: setup.support },
        extendRight: true,
      },
      {
        id: 'resistance',
        label: 'Range resistance',
        role: 'resistance',
        start: { date: first.date, price: setup.resistance },
        end: { date: latestPoint.date, price: setup.resistance },
        extendRight: true,
      },
    ],
    zones: [{
      id: 'range-base',
      label: 'Range base',
      role: 'base',
      startDate: first.date,
      endDate: last.date,
      low: setup.support,
      high: setup.resistance,
    }],
    labels: [{ id: 'pattern', text: patternLabel, point: latestPoint }],
  };
}

export function buildCoilGeometry(
  setup: NonNullable<ReturnType<typeof latestCoilSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const first = setup.baseBars[0];
  const last = setup.baseBars[setup.baseBars.length - 1];
  const latestPoint = { date: setup.latest.date, price: setup.latest.close };

  return {
    family: 'coil',
    trendLines: [
      {
        id: 'upper-boundary',
        label: 'Coil upper boundary',
        role: 'upper',
        start: { date: first.date, price: first.high },
        end: { date: last.date, price: last.high },
        extendRight: true,
      },
      {
        id: 'lower-boundary',
        label: 'Coil lower boundary',
        role: 'lower',
        start: { date: first.date, price: first.low },
        end: { date: last.date, price: last.low },
        extendRight: true,
      },
    ],
    zones: [{
      id: 'coil-base',
      label: 'Contracting range',
      role: 'base',
      startDate: first.date,
      endDate: last.date,
      low: setup.support,
      high: setup.resistance,
    }],
    labels: [{ id: 'pattern', text: patternLabel, point: latestPoint }],
  };
}

export function buildHighTightFlagGeometry(
  setup: NonNullable<ReturnType<typeof latestHighTightFlagSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const rallyStart = setup.rallyBars[0];
  const rallyEnd = setup.rallyBars[setup.rallyBars.length - 1];
  const pullbackStart = setup.pullbackBars[0];
  const pullbackEnd = setup.pullbackBars[setup.pullbackBars.length - 1];
  const latestPoint = { date: setup.latest.date, price: setup.latest.close };
  const pullbackLowIndex = indexOfLowestLow(setup.pullbackBars);
  const pullbackLowBar = setup.pullbackBars[pullbackLowIndex];

  return {
    family: 'high-tight-flag',
    zones: [{
      id: 'flag-consolidation',
      label: 'Flag consolidation',
      role: 'base',
      startDate: pullbackStart.date,
      endDate: pullbackEnd.date,
      low: setup.pullbackLow,
      high: setup.breakoutLevel,
    }],
    pivotMarkers: [{
      id: 'pullback-low',
      label: 'Pullback Low',
      kind: 'low',
      index: pullbackLowIndex,
      date: pullbackLowBar.date,
      price: setup.pullbackLow,
    }],
    trendLines: [
      {
        id: 'rally',
        label: 'High-tight rally',
        role: 'pole',
        start: { date: rallyStart.date, price: rallyStart.open },
        end: { date: rallyEnd.date, price: rallyEnd.close },
      },
      {
        id: 'pullback-upper',
        label: 'Flag upper boundary',
        role: 'upper',
        start: { date: pullbackStart.date, price: pullbackStart.high },
        end: { date: pullbackEnd.date, price: pullbackEnd.high },
        extendRight: true,
      },
      {
        id: 'pullback-lower',
        label: 'Flag lower boundary',
        role: 'lower',
        start: { date: pullbackStart.date, price: pullbackStart.low },
        end: { date: pullbackEnd.date, price: pullbackEnd.low },
        extendRight: true,
      },
      {
        id: 'breakout',
        label: 'Breakout',
        role: 'resistance',
        start: { date: pullbackStart.date, price: setup.breakoutLevel },
        end: { date: latestPoint.date, price: setup.breakoutLevel },
        extendRight: true,
      },
    ],
    labels: [{ id: 'pattern', text: patternLabel, point: latestPoint }],
  };
}

export function buildThreeMethodsGeometry(
  setup: NonNullable<ReturnType<typeof latestThreeMethodsSetup>>,
  direction: 'bullish' | 'bearish',
  patternLabel: string,
): ChartPatternGeometry {
  const first = setup.first;
  const middleFirst = setup.middle[0];
  const middleLast = setup.middle[setup.middle.length - 1];
  const isBullish = direction === 'bullish';
  const breakoutLevel = isBullish ? first.high : first.low;
  const confirmationRole = isBullish ? 'resistance' : 'support';
  const latestPoint = { date: setup.latest.date, price: setup.latest.close };

  return {
    family: 'candle-continuation',
    pivotMarkers: [{
      id: 'impulse-extreme',
      label: isBullish ? 'Impulse High' : 'Impulse Low',
      kind: isBullish ? 'high' : 'low',
      date: first.date,
      price: isBullish ? first.high : first.low,
    }],
    trendLines: [
      {
        id: 'impulse',
        label: 'Impulse candle',
        role: 'pole',
        start: { date: first.date, price: first.open },
        end: { date: first.date, price: first.close },
      },
      {
        id: 'consolidation-upper',
        label: 'Consolidation upper boundary',
        role: 'upper',
        start: { date: middleFirst.date, price: middleFirst.high },
        end: { date: middleLast.date, price: middleLast.high },
      },
      {
        id: 'consolidation-lower',
        label: 'Consolidation lower boundary',
        role: 'lower',
        start: { date: middleFirst.date, price: middleFirst.low },
        end: { date: middleLast.date, price: middleLast.low },
      },
      {
        id: 'confirmation',
        label: isBullish ? 'Breakout' : 'Breakdown',
        role: confirmationRole,
        start: { date: first.date, price: breakoutLevel },
        end: { date: latestPoint.date, price: breakoutLevel },
        extendRight: true,
      },
    ],
    labels: [{ id: 'pattern', text: patternLabel, point: latestPoint }],
  };
}

export function buildMatHoldGeometry(
  setup: NonNullable<ReturnType<typeof latestMatHoldSetup>>,
  direction: 'bullish' | 'bearish',
  patternLabel: string,
): ChartPatternGeometry {
  const first = setup.first;
  const middleFirst = setup.middle[0];
  const middleLast = setup.middle[setup.middle.length - 1];
  const isBullish = direction === 'bullish';
  const confirmationRole = isBullish ? 'resistance' : 'support';
  const holdRole = isBullish ? 'support' : 'resistance';
  const latestPoint = { date: setup.latest.date, price: setup.latest.close };

  return {
    family: 'candle-continuation',
    pivotMarkers: [{
      id: 'impulse-extreme',
      label: isBullish ? 'Impulse High' : 'Impulse Low',
      kind: isBullish ? 'high' : 'low',
      date: first.date,
      price: isBullish ? first.high : first.low,
    }],
    trendLines: [
      {
        id: 'impulse',
        label: 'Impulse candle',
        role: 'pole',
        start: { date: first.date, price: first.open },
        end: { date: first.date, price: first.close },
      },
      {
        id: 'hold-level',
        label: 'Hold level',
        role: holdRole,
        start: { date: first.date, price: setup.holdLevel },
        end: { date: latestPoint.date, price: setup.holdLevel },
        extendRight: true,
      },
      {
        id: 'consolidation-upper',
        label: 'Mat upper boundary',
        role: 'upper',
        start: { date: middleFirst.date, price: middleFirst.high },
        end: { date: middleLast.date, price: middleLast.high },
      },
      {
        id: 'consolidation-lower',
        label: 'Mat lower boundary',
        role: 'lower',
        start: { date: middleFirst.date, price: middleFirst.low },
        end: { date: middleLast.date, price: middleLast.low },
      },
      {
        id: 'confirmation',
        label: isBullish ? 'Breakout' : 'Breakdown',
        role: confirmationRole,
        start: { date: first.date, price: setup.breakoutLevel },
        end: { date: latestPoint.date, price: setup.breakoutLevel },
        extendRight: true,
      },
    ],
    labels: [{ id: 'pattern', text: patternLabel, point: latestPoint }],
  };
}

export function buildScallopHandleGeometry(
  setup: NonNullable<ReturnType<typeof latestScallopHandleSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const baseBars = setup.patternBars.slice(0, -5);
  const handleBars = setup.patternBars.slice(-5, -1);
  const lowIndex = indexOfLowestLow(baseBars);
  const lowBar = baseBars[lowIndex];
  const left = baseBars[0];
  const right = baseBars[baseBars.length - 1];
  const handleStart = handleBars[0];
  const latest = setup.patternBars[setup.patternBars.length - 1];
  const scallopLowPoint = { index: lowIndex, date: lowBar.date, price: setup.scallopLow };

  return {
    family: 'scallop-handle',
    zones: [{
      id: 'scallop-base',
      label: 'Handle consolidation',
      role: 'base',
      startDate: handleStart.date,
      endDate: handleBars[handleBars.length - 1].date,
      low: lowestLow(handleBars) ?? handleStart.low,
      high: highestHigh(handleBars) ?? handleStart.high,
    }],
    pivotMarkers: [
      {
        id: 'scallop-low',
        label: 'Scallop Low',
        kind: 'low',
        ...scallopLowPoint,
      },
    ],
    trendLines: [
      {
        id: 'scallop-left',
        label: 'Scallop left rim',
        role: 'generic',
        start: { date: left.date, price: setup.rightRim },
        end: scallopLowPoint,
      },
      {
        id: 'scallop-right',
        label: 'Scallop right rim',
        role: 'generic',
        start: scallopLowPoint,
        end: { date: right.date, price: setup.rightRim },
      },
      {
        id: 'handle',
        label: 'Handle',
        role: 'generic',
        start: { date: handleStart.date, price: handleStart.close },
        end: { date: latest.date, price: latest.close },
      },
      {
        id: 'breakout',
        label: 'Handle breakout',
        role: 'resistance',
        start: { date: handleStart.date, price: setup.breakoutLevel },
        end: { date: latest.date, price: setup.breakoutLevel },
        extendRight: true,
      },
    ],
    labels: [{ id: 'pattern', text: patternLabel, point: { date: latest.date, price: setup.breakoutLevel } }],
  };
}

export function buildThreePivotGeometry(
  setup: NonNullable<ReturnType<typeof latestThreePivotSetup>>,
  kind: 'rising-valleys' | 'falling-peaks',
  patternLabel: string,
): ChartPatternGeometry {
  const [first, second, third] = setup.pivots;
  const isValley = kind === 'rising-valleys';
  const progressionRole = isValley ? 'lower' : 'upper';
  const confirmationRole = isValley ? 'resistance' : 'support';

  return {
    family: 'three-pivot',
    pivotMarkers: setup.pivots.map((pivot, index) => ({
      id: `pivot-${index + 1}`,
      label: `${isValley ? 'Valley' : 'Peak'} ${index + 1}`,
      kind: pivot.kind,
      ...pivotToGeometryPoint(pivot),
    })),
    trendLines: [
      {
        id: 'progression-1',
        label: isValley ? 'Rising valley support' : 'Falling peak resistance',
        role: progressionRole,
        start: pivotToGeometryPoint(first),
        end: pivotToGeometryPoint(second),
      },
      {
        id: 'progression-2',
        label: isValley ? 'Rising valley continuation' : 'Falling peak continuation',
        role: progressionRole,
        start: pivotToGeometryPoint(second),
        end: pivotToGeometryPoint(third),
      },
      {
        id: 'confirmation',
        label: isValley ? 'Breakout resistance' : 'Breakdown support',
        role: confirmationRole,
        start: { index: first.index, date: first.date, price: setup.level },
        end: { index: setup.patternBars.length - 1, date: setup.latest.date, price: setup.level },
        extendRight: true,
      },
    ],
    labels: [{
      id: 'pattern',
      text: patternLabel,
      point: { index: setup.patternBars.length - 1, date: setup.latest.date, price: setup.level },
    }],
  };
}

export function buildMeasuredMoveGeometry(
  setup: NonNullable<ReturnType<typeof latestMeasuredMoveSetup>>,
  direction: 'up' | 'down',
  patternLabel: string,
): ChartPatternGeometry {
  const firstLeg = setup.patternBars.slice(0, 5);
  const correction = setup.patternBars.slice(5, 10);
  const secondLeg = setup.patternBars.slice(10);
  const firstStart = firstLeg[0];
  const firstEnd = firstLeg[firstLeg.length - 1];
  const secondStart = secondLeg[0];
  const latest = setup.latest;
  const correctionIndex = direction === 'up' ? indexOfLowestLow(correction) : indexOfHighestHigh(correction);
  const correctionBar = correction[correctionIndex];
  const correctionPrice = direction === 'up' ? setup.correctionLow! : setup.correctionHigh!;
  const firstMove = Math.abs(firstEnd.close - firstStart.close);
  const target = direction === 'up' ? correctionPrice + firstMove : correctionPrice - firstMove;
  const isUp = direction === 'up';

  return {
    family: 'measured-move',
    pivotMarkers: [
      {
        id: 'leg-a',
        label: 'A',
        kind: isUp ? 'low' : 'high',
        index: 0,
        date: firstStart.date,
        price: firstStart.close,
      },
      {
        id: 'leg-b',
        label: 'B',
        kind: isUp ? 'high' : 'low',
        index: 4,
        date: firstEnd.date,
        price: firstEnd.close,
      },
      {
        id: 'correction',
        label: 'C',
        kind: isUp ? 'low' : 'high',
        index: correctionIndex + 5,
        date: correctionBar.date,
        price: correctionPrice,
      },
      {
        id: 'leg-d',
        label: 'D',
        kind: isUp ? 'high' : 'low',
        index: setup.patternBars.length - 1,
        date: latest.date,
        price: latest.close,
      },
    ],
    trendLines: [
      {
        id: 'first-leg',
        label: 'First leg',
        role: 'pole',
        start: { date: firstStart.date, price: firstStart.close },
        end: { date: firstEnd.date, price: firstEnd.close },
      },
      {
        id: 'correction',
        label: 'Correction',
        role: 'generic',
        start: { date: firstEnd.date, price: firstEnd.close },
        end: { date: secondStart.date, price: secondStart.close },
      },
      {
        id: 'second-leg',
        label: 'Second leg',
        role: 'pole',
        start: { date: secondStart.date, price: secondStart.close },
        end: { date: latest.date, price: latest.close },
      },
      {
        id: 'measured-target',
        label: 'Measured target',
        role: isUp ? 'resistance' : 'support',
        start: { date: secondStart.date, price: target },
        end: { date: latest.date, price: target },
        extendRight: true,
      },
    ],
    labels: [{ id: 'pattern', text: patternLabel, point: { date: latest.date, price: target } }],
  };
}

export function buildVReversalGeometry(
  setup: NonNullable<ReturnType<typeof latestVReversalSetup>>,
  kind: 'top' | 'bottom',
  patternLabel: string,
): ChartPatternGeometry {
  const extremePrice = kind === 'bottom' ? setup.extreme.low : setup.extreme.high;
  const extremePoint = {
    index: setup.extremeIndex,
    date: setup.extreme.date,
    price: extremePrice,
  };
  const startPoint = {
    date: setup.patternBars[0].date,
    price: setup.patternBars[0].close,
  };
  const latestPoint = {
    date: setup.latest.date,
    price: setup.latest.close,
  };

  return {
    family: 'v-reversal',
    pivotMarkers: [
      {
        id: 'extreme',
        label: kind === 'bottom' ? 'V Low' : 'V High',
        kind: kind === 'bottom' ? 'low' : 'high',
        ...extremePoint,
      },
    ],
    trendLines: [
      {
        id: 'approach',
        label: kind === 'bottom' ? 'Decline' : 'Advance',
        role: 'generic',
        start: startPoint,
        end: extremePoint,
      },
      {
        id: 'reversal',
        label: 'Reversal',
        role: 'generic',
        start: extremePoint,
        end: latestPoint,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: latestPoint,
      },
    ],
  };
}

export function buildCupHandleGeometry(
  setup: NonNullable<ReturnType<typeof latestCupHandleSetup>>,
  kind: 'bullish' | 'bearish',
  patternLabel: string,
): ChartPatternGeometry {
  const cupBars = setup.patternBars.slice(0, -5);
  const handleBars = setup.patternBars.slice(-5, -1);
  const extremeIndex = kind === 'bullish' ? indexOfLowestLow(cupBars) : indexOfHighestHigh(cupBars);
  const extremeBar = cupBars[extremeIndex];
  const extremePoint = { index: extremeIndex, date: extremeBar.date, price: setup.cupExtreme };
  const left = cupBars[0];
  const right = cupBars[cupBars.length - 1];
  const handleStart = handleBars[0];
  const latest = setup.patternBars[setup.patternBars.length - 1];

  return {
    family: 'cup-handle',
    zones: [{
      id: 'cup-base',
      label: 'Handle consolidation',
      role: 'base',
      startDate: handleStart.date,
      endDate: handleBars[handleBars.length - 1].date,
      low: lowestLow(handleBars) ?? handleStart.low,
      high: highestHigh(handleBars) ?? handleStart.high,
    }],
    pivotMarkers: [
      {
        id: 'cup-extreme',
        label: kind === 'bullish' ? 'Cup Low' : 'Cup High',
        kind: kind === 'bullish' ? 'low' : 'high',
        ...extremePoint,
      },
    ],
    trendLines: [
      {
        id: 'cup-left',
        label: 'Cup left rim',
        role: 'generic',
        start: { date: left.date, price: setup.rimLevel },
        end: extremePoint,
      },
      {
        id: 'cup-right',
        label: 'Cup right rim',
        role: 'generic',
        start: extremePoint,
        end: { date: right.date, price: setup.rimLevel },
      },
      {
        id: 'handle',
        label: 'Handle',
        role: 'generic',
        start: { date: handleStart.date, price: handleStart.close },
        end: { date: latest.date, price: latest.close },
      },
    ],
    labels: [{ id: 'pattern', text: patternLabel, point: { date: latest.date, price: latest.close } }],
  };
}

export function buildRoundingGeometry(
  setup: NonNullable<ReturnType<typeof latestRoundingSetup>>,
  kind: 'bottom' | 'top',
  patternLabel: string,
): ChartPatternGeometry {
  const left = setup.patternBars.slice(0, 6);
  const middle = setup.patternBars.slice(6, -6);
  const right = setup.patternBars.slice(-6, -1);
  const extremeIndex = kind === 'bottom' ? indexOfLowestLow(middle) : indexOfHighestHigh(middle);
  const absoluteExtremeIndex = extremeIndex + 6;
  const extremeBar = setup.patternBars[absoluteExtremeIndex];
  const extremePoint = { index: absoluteExtremeIndex, date: extremeBar.date, price: setup.extreme };
  const rightBar = right[right.length - 1];

  return {
    family: 'rounding',
    pivotMarkers: [
      {
        id: 'rounding-extreme',
        label: kind === 'bottom' ? 'Bowl Low' : 'Arch High',
        kind: kind === 'bottom' ? 'low' : 'high',
        ...extremePoint,
      },
    ],
    trendLines: [
      {
        id: 'left-curve',
        label: 'Left curve',
        role: 'generic',
        start: { date: left[0].date, price: setup.rimLevel },
        end: extremePoint,
      },
      {
        id: 'right-curve',
        label: 'Right curve',
        role: 'generic',
        start: extremePoint,
        end: { date: rightBar.date, price: setup.rimLevel },
      },
      {
        id: 'rim-confirmation',
        label: 'Rim confirmation',
        role: kind === 'bottom' ? 'resistance' : 'support',
        start: { date: rightBar.date, price: setup.rimLevel },
        end: { date: setup.patternBars[setup.patternBars.length - 1].date, price: setup.rimLevel },
        extendRight: true,
      },
    ],
    labels: [{
      id: 'pattern',
      text: patternLabel,
      point: { date: setup.patternBars[setup.patternBars.length - 1].date, price: setup.rimLevel },
    }],
  };
}

export function buildAdamEveGeometry(
  setup: NonNullable<ReturnType<typeof latestAdamEveSetup>>,
  kind: 'bottom' | 'top',
  patternLabel: string,
  latestDate: string,
): ChartPatternGeometry {
  return {
    family: 'adam-eve',
    pivotMarkers: [
      { id: 'adam', label: 'Adam', kind: setup.adam.kind, ...pivotToGeometryPoint(setup.adam) },
      { id: 'eve', label: 'Eve', kind: setup.eve.kind, ...pivotToGeometryPoint(setup.eve) },
    ],
    trendLines: [{
      id: 'confirmation-level',
      label: kind === 'bottom' ? 'Neckline' : 'Support',
      role: kind === 'bottom' ? 'neckline' : 'support',
      start: { index: setup.adam.index, date: setup.adam.date, price: setup.neckline },
      end: { date: latestDate, price: setup.neckline },
      extendRight: true,
    }],
    labels: [{ id: 'pattern', text: patternLabel, point: { date: latestDate, price: setup.neckline } }],
  };
}

export function buildHornGeometry(
  setup: NonNullable<ReturnType<typeof latestHornSetup>>,
  kind: 'top' | 'bottom',
  patternLabel: string,
  latestDate: string,
): ChartPatternGeometry {
  const firstPivot = setup.pivots[0];
  return {
    family: 'horn',
    pivotMarkers: buildPivotMarkers(setup.pivots),
    trendLines: [
      {
        id: 'confirmation-level',
        label: kind === 'top' ? 'Support' : 'Neckline',
        role: kind === 'top' ? 'support' : 'neckline',
        start: { index: firstPivot.index, date: firstPivot.date, price: setup.level },
        end: { date: latestDate, price: setup.level },
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: latestDate, price: setup.level },
      },
    ],
  };
}

export function buildBumpRunGeometry(
  setup: NonNullable<ReturnType<typeof latestBumpRunSetup>>,
  kind: 'top' | 'bottom',
  patternLabel: string,
): ChartPatternGeometry {
  const lead = setup.patternBars.slice(0, 7);
  const bump = setup.patternBars.slice(7, 14);
  const run = setup.patternBars.slice(14, -1);
  const extremeBars = setup.patternBars.slice(7, -1);
  const extremeLocalIndex = kind === 'bottom'
    ? indexOfLowestLow(extremeBars)
    : indexOfHighestHigh(extremeBars);
  const extremeIndex = extremeLocalIndex + 7;
  const extremeBar = setup.patternBars[extremeIndex];
  const extremePoint = {
    index: extremeIndex,
    date: extremeBar.date,
    price: setup.extreme,
  };

  return {
    family: 'bump-and-run',
    pivotMarkers: [
      {
        id: 'extreme',
        label: kind === 'bottom' ? 'Bump Low' : 'Bump High',
        kind: kind === 'bottom' ? 'low' : 'high',
        ...extremePoint,
      },
    ],
    trendLines: [
      {
        id: 'lead-in',
        label: 'Lead-in',
        role: 'generic',
        start: { date: lead[0].date, price: lead[0].close },
        end: { date: lead[lead.length - 1].date, price: lead[lead.length - 1].close },
      },
      {
        id: 'bump',
        label: 'Bump',
        role: 'generic',
        start: { date: bump[0].date, price: bump[0].close },
        end: { date: bump[bump.length - 1].date, price: bump[bump.length - 1].close },
      },
      {
        id: 'run',
        label: 'Run',
        role: 'generic',
        start: { date: run[0].date, price: run[0].close },
        end: { date: setup.latest.date, price: setup.latest.close },
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: setup.latest.date, price: setup.breakoutLevel },
      },
    ],
  };
}

export function buildBlowOffGeometry(
  setup: NonNullable<ReturnType<typeof latestBlowOffTopSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const first = setup.patternBars[0];
  const previous = setup.patternBars[setup.patternBars.length - 2];
  const spikePoint = {
    index: setup.patternBars.length - 1,
    date: setup.latest.date,
    price: setup.spikeHigh,
  };
  return {
    family: 'blow-off',
    pivotMarkers: [
      {
        id: 'spike-high',
        label: 'Spike High',
        kind: 'high',
        ...spikePoint,
      },
    ],
    trendLines: [
      {
        id: 'advance',
        label: 'Advance',
        role: 'generic',
        start: { date: first.date, price: first.close },
        end: spikePoint,
      },
      {
        id: 'reversal',
        label: 'Reversal',
        role: 'generic',
        start: spikePoint,
        end: { date: setup.latest.date, price: setup.latest.close },
      },
      {
        id: 'breakdown-support',
        label: 'Breakdown support',
        role: 'support',
        start: { date: previous.date, price: setup.previousLow },
        end: { date: setup.latest.date, price: setup.previousLow },
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: setup.latest.date, price: setup.latest.close },
      },
    ],
  };
}

export function buildDiamondGeometry(
  setup: NonNullable<ReturnType<typeof latestDiamondSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const early = setup.baseBars.slice(0, 6);
  const middle = setup.baseBars.slice(6, 12);
  const final = setup.baseBars.slice(12);
  const middleHigh = middle[indexOfHighestHigh(middle)];
  const middleLow = middle[indexOfLowestLow(middle)];
  const finalBar = final[final.length - 1];
  const pivotMarkers = [
    {
      id: 'middle-high',
      label: 'Diamond High',
      kind: 'high' as const,
      date: middleHigh.date,
      price: middleHigh.high,
    },
    {
      id: 'middle-low',
      label: 'Diamond Low',
      kind: 'low' as const,
      date: middleLow.date,
      price: middleLow.low,
    },
  ];

  return {
    family: 'diamond',
    pivotMarkers,
    trendLines: [
      {
        id: 'upper-expansion',
        label: 'Upper expansion',
        role: 'upper',
        start: { date: early[0].date, price: early[0].high },
        end: { date: middleHigh.date, price: middleHigh.high },
      },
      {
        id: 'upper-contraction',
        label: 'Upper contraction',
        role: 'upper',
        start: { date: middleHigh.date, price: middleHigh.high },
        end: { date: finalBar.date, price: finalBar.high },
        extendRight: true,
      },
      {
        id: 'lower-expansion',
        label: 'Lower expansion',
        role: 'lower',
        start: { date: early[0].date, price: early[0].low },
        end: { date: middleLow.date, price: middleLow.low },
      },
      {
        id: 'lower-contraction',
        label: 'Lower contraction',
        role: 'lower',
        start: { date: middleLow.date, price: middleLow.low },
        end: { date: finalBar.date, price: finalBar.low },
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: setup.latest.date, price: setup.latest.close },
      },
    ],
  };
}

export function buildBroadeningGeometry(
  setup: NonNullable<ReturnType<typeof latestBroadeningSetup>>,
  patternLabel: string,
): ChartPatternGeometry {
  const firstBar = setup.baseBars[0];
  const lastBar = setup.baseBars[setup.baseBars.length - 1];
  return {
    family: 'broadening',
    trendLines: [
      {
        id: 'rising-resistance',
        label: 'Rising resistance',
        role: 'upper',
        start: { date: firstBar.date, price: firstBar.high },
        end: { date: lastBar.date, price: lastBar.high },
        extendRight: true,
      },
      {
        id: 'falling-support',
        label: 'Falling support',
        role: 'lower',
        start: { date: firstBar.date, price: firstBar.low },
        end: { date: lastBar.date, price: lastBar.low },
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: setup.latest.date, price: setup.latest.close },
      },
    ],
  };
}

export function buildComplexHeadShouldersGeometry(
  setup: NonNullable<ReturnType<typeof latestComplexHeadShouldersSetup>>,
  patternLabel: string,
  latestDate: string,
): ChartPatternGeometry {
  const firstPivot = setup.pivots[0];
  return {
    family: 'complex-head-and-shoulders',
    pivotMarkers: setup.pivots.map((pivot, index) => ({
      id: `pivot-${index + 1}`,
      label: pivot === setup.head ? 'Head' : `P${index + 1}`,
      kind: pivot.kind,
      ...pivotToGeometryPoint(pivot),
    })),
    trendLines: [
      {
        id: 'neckline',
        label: 'Neckline',
        role: 'neckline',
        start: { index: firstPivot.index, date: firstPivot.date, price: setup.neckline },
        end: { date: latestDate, price: setup.neckline },
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: latestDate, price: setup.neckline },
      },
    ],
  };
}

export function buildHeadShouldersGeometry(
  setup: NonNullable<ReturnType<typeof latestHeadShouldersSetup>>,
  patternLabel: string,
  latestDate: string,
): ChartPatternGeometry {
  const markers = [
    { id: 'left-shoulder', label: 'LS', pivot: setup.leftShoulder },
    ...(setup.trough1 ? [{ id: 'neckline-1', label: 'N1', pivot: setup.trough1 }] : []),
    { id: 'head', label: 'H', pivot: setup.head },
    ...(setup.trough2 ? [{ id: 'neckline-2', label: 'N2', pivot: setup.trough2 }] : []),
    { id: 'right-shoulder', label: 'RS', pivot: setup.rightShoulder },
  ];

  return {
    family: 'head-and-shoulders',
    pivotMarkers: markers.map(({ id, label, pivot }) => ({
      id,
      label,
      kind: pivot.kind,
      ...pivotToGeometryPoint(pivot),
    })),
    trendLines: setup.trough1 && setup.trough2 ? [
      {
        id: 'neckline',
        label: 'Neckline',
        role: 'neckline',
        start: pivotToGeometryPoint(setup.trough1),
        end: pivotToGeometryPoint(setup.trough2),
        extendRight: true,
      },
    ] : [],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: latestDate, price: setup.neckline },
      },
    ],
  };
}

export function buildWedgeGeometry(
  setup: NonNullable<ReturnType<typeof latestWedgeSetup>>,
  patternLabel: string,
  breakoutLevel: number,
): ChartPatternGeometry {
  const pivots = findLocalPivots(setup.baseBars, 1);
  const highPivots = pivots.filter((p) => p.kind === 'high');
  const lowPivots = pivots.filter((p) => p.kind === 'low');

  const upperStart = highPivots.length >= 2 ? highPivots[0] : { date: setup.baseBars[0].date, price: setup.baseBars[0].high };
  const upperEnd = highPivots.length >= 2 ? highPivots[highPivots.length - 1] : { date: setup.baseBars[setup.baseBars.length - 1].date, price: setup.upperLevel };

  const lowerStart = lowPivots.length >= 2 ? lowPivots[0] : { date: setup.baseBars[0].date, price: setup.baseBars[0].low };
  const lowerEnd = lowPivots.length >= 2 ? lowPivots[lowPivots.length - 1] : { date: setup.baseBars[setup.baseBars.length - 1].date, price: setup.lowerLevel };

  return {
    family: 'wedge',
    trendLines: [
      {
        id: 'upper-boundary',
        label: 'Upper wedge boundary',
        role: 'upper',
        start: { date: upperStart.date, price: upperStart.price },
        end: { date: upperEnd.date, price: upperEnd.price },
        extendRight: false,
      },
      {
        id: 'lower-boundary',
        label: 'Lower wedge boundary',
        role: 'lower',
        start: { date: lowerStart.date, price: lowerStart.price },
        end: { date: lowerEnd.date, price: lowerEnd.price },
        extendRight: false,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: setup.latest.date, price: breakoutLevel },
      },
    ],
  };
}

export function buildContinuationGeometry(
  setup: NonNullable<ReturnType<typeof latestContinuationSetup>>,
  shape: 'flag' | 'pennant',
  patternLabel: string,
): ChartPatternGeometry {
  const poleStart = setup.poleBars[0];
  const poleEnd = setup.poleBars[setup.poleBars.length - 1];
  const consolidationStart = setup.consolidationBars[0];
  const consolidationEnd = setup.consolidationBars[setup.consolidationBars.length - 1];
  return {
    family: shape,
    zones: [{
      id: 'consolidation-zone',
      label: shape === 'flag' ? 'Flag consolidation' : 'Pennant compression',
      role: 'base',
      startDate: consolidationStart.date,
      endDate: consolidationEnd.date,
      low: lowestLow(setup.consolidationBars) ?? Math.min(consolidationStart.low, consolidationEnd.low),
      high: highestHigh(setup.consolidationBars) ?? Math.max(consolidationStart.high, consolidationEnd.high),
    }],
    trendLines: [
      {
        id: 'pole',
        label: 'Pole',
        role: 'pole',
        start: { date: poleStart.date, price: poleStart.open },
        end: { date: poleEnd.date, price: poleEnd.close },
      },
      {
        id: 'upper-boundary',
        label: shape === 'flag' ? 'Flag resistance' : 'Pennant upper boundary',
        role: 'upper',
        start: { date: consolidationStart.date, price: consolidationStart.high },
        end: { date: consolidationEnd.date, price: consolidationEnd.high },
        extendRight: true,
      },
      {
        id: 'lower-boundary',
        label: shape === 'flag' ? 'Flag support' : 'Pennant lower boundary',
        role: 'lower',
        start: { date: consolidationStart.date, price: consolidationStart.low },
        end: { date: consolidationEnd.date, price: consolidationEnd.low },
        extendRight: true,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: setup.latest.date, price: setup.breakoutLevel },
      },
    ],
  };
}

export function buildSingleGapGeometry(
  patternLabel: string,
  startDate: string,
  endDate: string,
  firstBoundary: number,
  secondBoundary: number,
  latestDate: string,
  latestPrice: number,
): ChartPatternGeometry {
  return {
    family: 'gap-zone',
    zones: [
      {
        id: 'gap',
        label: 'Gap',
        role: 'gap',
        startDate,
        endDate,
        low: Math.min(firstBoundary, secondBoundary),
        high: Math.max(firstBoundary, secondBoundary),
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: latestDate, price: latestPrice },
      },
    ],
  };
}

export function buildIslandGeometry(
  patternLabel: string,
  preGap: EodBar,
  firstIsland: EodBar,
  middleIsland: EodBar[],
  latest: EodBar,
  direction: 'top' | 'bottom',
  islandBoundary: number,
): ChartPatternGeometry {
  const islandBars = [firstIsland, ...middleIsland];
  const islandLow = lowestLow(islandBars) ?? islandBoundary;
  const islandHigh = highestHigh(islandBars) ?? islandBoundary;
  const lastIsland = middleIsland[middleIsland.length - 1];
  const entryGap = direction === 'top'
    ? { low: preGap.high, high: firstIsland.low }
    : { low: firstIsland.high, high: preGap.low };
  const escapeGap = direction === 'top'
    ? { low: latest.open, high: islandBoundary }
    : { low: islandBoundary, high: latest.open };

  return {
    family: 'gap-zone',
    zones: [
      {
        id: 'entry-gap',
        label: 'Entry gap',
        role: 'gap',
        startDate: preGap.date,
        endDate: firstIsland.date,
        low: Math.min(entryGap.low, entryGap.high),
        high: Math.max(entryGap.low, entryGap.high),
      },
      {
        id: 'island-range',
        label: 'Island range',
        role: 'island',
        startDate: firstIsland.date,
        endDate: lastIsland.date,
        low: islandLow,
        high: islandHigh,
      },
      {
        id: 'escape-gap',
        label: 'Escape gap',
        role: 'gap',
        startDate: lastIsland.date,
        endDate: latest.date,
        low: Math.min(escapeGap.low, escapeGap.high),
        high: Math.max(escapeGap.low, escapeGap.high),
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: patternLabel,
        point: { date: latest.date, price: latest.close },
      },
    ],
  };
}

export function buildChannelGeometry(
  setup: NonNullable<ReturnType<typeof latestChannelSetup>>,
  direction: 'rising' | 'falling',
): ChartPatternGeometry {
  const startIndex = Math.min(setup.supportPivots[0].index, setup.resistancePivots[0].index);
  const startSupport = projectedPivotLinePrice(setup.supportPivots[0], setup.supportPivots[1], startIndex);
  const startResistance = projectedPivotLinePrice(setup.resistancePivots[0], setup.resistancePivots[1], startIndex);
  return {
    family: 'channel',
    trendLines: [
      {
        id: 'support',
        label: 'Channel support',
        role: 'support',
        start: pivotToGeometryPoint(setup.supportPivots[0]),
        end: pivotToGeometryPoint(setup.supportPivots[1]),
        extendRight: true,
      },
      {
        id: 'resistance',
        label: 'Channel resistance',
        role: 'resistance',
        start: pivotToGeometryPoint(setup.resistancePivots[0]),
        end: pivotToGeometryPoint(setup.resistancePivots[1]),
        extendRight: true,
      },
      {
        id: 'midline',
        label: 'Channel midline',
        role: 'midline',
        start: {
          date: setup.baseBars[startIndex]?.date ?? setup.supportPivots[0].date,
          price: round((startSupport + startResistance) / 2, 4),
        },
        end: {
          date: setup.latest.date,
          price: round((setup.support + setup.resistance) / 2, 4),
        },
        extendRight: false,
      },
    ],
    labels: [
      {
        id: 'pattern',
        text: direction === 'rising' ? 'Rising Channel' : 'Falling Channel',
        point: { date: setup.latest.date, price: direction === 'rising' ? setup.resistance : setup.support },
      },
    ],
  };
}

function buildPivotMarkers(pivots: ChartPatternPivot[]): ChartPatternGeometry['pivotMarkers'] {
  return pivots.map((pivot, index) => ({
    id: `pivot-${index + 1}`,
    label: `${pivot.kind === 'high' ? 'H' : 'L'}${index + 1}`,
    kind: pivot.kind,
    ...pivotToGeometryPoint(pivot),
  }));
}

function pivotToGeometryPoint(pivot: ChartPatternPivot): { index: number; date: string; price: number } {
  return {
    index: pivot.index,
    date: pivot.date,
    price: pivot.price,
  };
}
