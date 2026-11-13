import type { ScannerHandler } from '@/features/scanner/types';
import { hasDownTrend, hasUpTrend, highestHigh, lowestLow, round } from '@/features/chartPatterns/primitives';
import { latestComparablePivotSetup, latestVReversalSetup, latestHornSetup, latestBumpRunSetup, latestBlowOffTopSetup } from '@/features/chartPatterns/setups';
import { buildDoubleReversalGeometry, buildTripleReversalGeometry, buildVReversalGeometry, buildHornGeometry, buildBumpRunGeometry, buildBlowOffGeometry } from '@/features/chartPatterns/geometry';
import { movePct, averagePivotPrice, createChartPatternResult } from '@/features/chartPatterns/shared';

export const reversalsHandlers: Record<string, ScannerHandler> = {
  chart_double_bottom: (context, definition) => {
    const setup = latestComparablePivotSetup(context.bars, 'low', 2);
    if (!setup) return null;
    const [firstLow, secondLow] = setup.pivots;
    const barsBetween = setup.patternBars.slice(firstLow.index + 1, secondLow.index);
    const neckline = highestHigh(barsBetween);
    if (neckline === null || setup.latest.close <= neckline) return null;
    if (!hasDownTrend(setup.patternBars.slice(0, firstLow.index + 1), 5)) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      76,
      [`Two comparable lows broke above neckline resistance (${neckline})`],
      {
        first_low: firstLow.price,
        second_low: secondLow.price,
        neckline: neckline,
      },
      {
        breakoutLevel: neckline,
        necklineLevel: neckline,
        supportLevel: round((firstLow.price + secondLow.price) / 2, 4),
        patternStartDate: firstLow.date,
        pivots: setup.pivots,
        geometry: buildDoubleReversalGeometry(setup, neckline, 'bottom', definition.name),
      },
    );
  },
  chart_double_top: (context, definition) => {
    const setup = latestComparablePivotSetup(context.bars, 'high', 2);
    if (!setup) return null;
    const [firstHigh, secondHigh] = setup.pivots;
    const barsBetween = setup.patternBars.slice(firstHigh.index + 1, secondHigh.index);
    const support = lowestLow(barsBetween);
    if (support === null || setup.latest.close >= support) return null;
    if (!hasUpTrend(setup.patternBars.slice(0, firstHigh.index + 1), 5)) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      76,
      [`Two comparable highs broke below support (${support})`],
      {
        first_high: firstHigh.price,
        second_high: secondHigh.price,
        support: support,
      },
      {
        breakoutLevel: support,
        supportLevel: support,
        resistanceLevel: round((firstHigh.price + secondHigh.price) / 2, 4),
        patternStartDate: firstHigh.date,
        pivots: setup.pivots,
        geometry: buildDoubleReversalGeometry(setup, support, 'top', definition.name),
      },
    );
  },
  chart_triple_bottom: (context, definition) => {
    const setup = latestComparablePivotSetup(context.bars, 'low', 3);
    if (!setup) return null;
    const [firstLow, , thirdLow] = setup.pivots;
    const barsBetween = setup.patternBars.slice(firstLow.index + 1, thirdLow.index);
    const neckline = highestHigh(barsBetween);
    if (neckline === null || setup.latest.close <= neckline) return null;
    if (!hasDownTrend(setup.patternBars.slice(0, firstLow.index + 1), 5)) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      82,
      [`Three comparable lows confirmed support and broke above neckline (${neckline})`],
      {
        support: round(averagePivotPrice(setup.pivots), 4),
        neckline: neckline,
      },
      {
        breakoutLevel: neckline,
        necklineLevel: neckline,
        supportLevel: round(averagePivotPrice(setup.pivots), 4),
        patternStartDate: firstLow.date,
        pivots: setup.pivots,
        geometry: buildTripleReversalGeometry(setup, neckline, 'bottom', definition.name),
      },
    );
  },
  chart_triple_top: (context, definition) => {
    const setup = latestComparablePivotSetup(context.bars, 'high', 3);
    if (!setup) return null;
    const [firstHigh, , thirdHigh] = setup.pivots;
    const barsBetween = setup.patternBars.slice(firstHigh.index + 1, thirdHigh.index);
    const support = lowestLow(barsBetween);
    if (support === null || setup.latest.close >= support) return null;
    if (!hasUpTrend(setup.patternBars.slice(0, firstHigh.index + 1), 5)) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      82,
      [`Three comparable highs confirmed resistance and broke below support (${support})`],
      {
        resistance: round(averagePivotPrice(setup.pivots), 4),
        support: support,
      },
      {
        breakoutLevel: support,
        supportLevel: support,
        resistanceLevel: round(averagePivotPrice(setup.pivots), 4),
        patternStartDate: firstHigh.date,
        pivots: setup.pivots,
        geometry: buildTripleReversalGeometry(setup, support, 'top', definition.name),
      },
    );
  },
  chart_v_bottom: (context, definition) => {
    const setup = latestVReversalSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      68,
      [`Sharp decline into ${setup.extreme.date} reversed with a close above the prior bar high (${setup.previous.high})`],
      {
        decline_pct: setup.movePct,
        extreme_low: setup.extreme.low,
        confirmation_close: setup.latest.close,
      },
      {
        breakoutLevel: setup.previous.high,
        supportLevel: setup.extreme.low,
        patternStartDate: setup.patternBars[0].date,
        pivots: [{ index: setup.extremeIndex, date: setup.extreme.date, price: setup.extreme.low, kind: 'low' }],
        geometry: buildVReversalGeometry(setup, 'bottom', definition.name),
      },
    );
  },
  chart_spike_top: (context, definition) => {
    const setup = latestVReversalSetup(context.bars, 'top');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      68,
      [`Sharp advance into ${setup.extreme.date} reversed with a close below the prior bar low (${setup.previous.low})`],
      {
        advance_pct: setup.movePct,
        extreme_high: setup.extreme.high,
        confirmation_close: setup.latest.close,
      },
      {
        breakoutLevel: setup.previous.low,
        resistanceLevel: setup.extreme.high,
        patternStartDate: setup.patternBars[0].date,
        pivots: [{ index: setup.extremeIndex, date: setup.extreme.date, price: setup.extreme.high, kind: 'high' }],
        geometry: buildVReversalGeometry(setup, 'top', definition.name),
      },
    );
  },
  chart_horn_bottom: (context, definition) => {
    const setup = latestHornSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      72,
      [`Two sharp lows held support and broke above intervening high (${setup.level})`],
      {
        first_low: setup.pivots[0].price,
        second_low: setup.pivots[1].price,
        neckline: setup.level,
      },
      {
        breakoutLevel: setup.level,
        necklineLevel: setup.level,
        supportLevel: round(averagePivotPrice(setup.pivots), 4),
        patternStartDate: setup.pivots[0].date,
        pivots: setup.pivots,
        geometry: buildHornGeometry(setup, 'bottom', definition.name, context.bars[context.bars.length - 1].date),
      },
    );
  },
  chart_horn_top: (context, definition) => {
    const setup = latestHornSetup(context.bars, 'top');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      72,
      [`Two sharp highs held resistance and broke below intervening low (${setup.level})`],
      {
        first_high: setup.pivots[0].price,
        second_high: setup.pivots[1].price,
        support: setup.level,
      },
      {
        breakoutLevel: setup.level,
        supportLevel: setup.level,
        resistanceLevel: round(averagePivotPrice(setup.pivots), 4),
        patternStartDate: setup.pivots[0].date,
        pivots: setup.pivots,
        geometry: buildHornGeometry(setup, 'top', definition.name, context.bars[context.bars.length - 1].date),
      },
    );
  },
  chart_bump_run_bottom: (context, definition) => {
    const setup = latestBumpRunSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      72,
      [`Downtrend accelerated into a bump then reversed above run level (${setup.breakoutLevel})`],
      {
        lead_slope: round(setup.leadSlope, 4),
        bump_slope: round(setup.bumpSlope, 4),
        breakout_level: setup.breakoutLevel,
      },
      {
        breakoutLevel: setup.breakoutLevel,
        supportLevel: setup.extreme,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildBumpRunGeometry(setup, 'bottom', definition.name),
      },
    );
  },
  chart_bump_run_top: (context, definition) => {
    const setup = latestBumpRunSetup(context.bars, 'top');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      72,
      [`Uptrend accelerated into a bump then reversed below run level (${setup.breakoutLevel})`],
      {
        lead_slope: round(setup.leadSlope, 4),
        bump_slope: round(setup.bumpSlope, 4),
        breakdown_level: setup.breakoutLevel,
      },
      {
        breakoutLevel: setup.breakoutLevel,
        resistanceLevel: setup.extreme,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildBumpRunGeometry(setup, 'top', definition.name),
      },
    );
  },
  chart_blow_off_top: (context, definition) => {
    const setup = latestBlowOffTopSetup(context.bars);
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      78,
      [`Late advance of ${setup.advancePct}% ended with high-volume reversal below prior low`],
      {
        advance_pct: setup.advancePct,
        volume_ratio: setup.volumeRatio,
        spike_high: setup.spikeHigh,
      },
      {
        breakoutLevel: setup.previousLow,
        resistanceLevel: setup.spikeHigh,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildBlowOffGeometry(setup, definition.name),
      },
    );
  },
};
