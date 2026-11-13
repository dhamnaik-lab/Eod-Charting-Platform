import type { ScannerHandler } from '@/features/scanner/types';
import { round } from '@/features/chartPatterns/primitives';
import { latestRangeSetup, latestTriangleSetup, latestSymmetricalTriangleSetup, latestWedgeSetup, latestDiamondSetup, latestBroadeningSetup, latestThreeMethodsSetup, latestMatHoldSetup, latestContinuationSetup, latestChannelSetup, latestHighTightFlagSetup, latestCoilSetup, latestThreePivotSetup, latestMeasuredMoveSetup } from '@/features/chartPatterns/setups';
import { buildAscendingTriangleGeometry, buildDescendingTriangleGeometry, buildSymmetricalTriangleGeometry, buildRangeGeometry, buildCoilGeometry, buildHighTightFlagGeometry, buildThreeMethodsGeometry, buildMatHoldGeometry, buildThreePivotGeometry, buildMeasuredMoveGeometry, buildDiamondGeometry, buildBroadeningGeometry, buildWedgeGeometry, buildContinuationGeometry, buildChannelGeometry } from '@/features/chartPatterns/geometry';
import { countTouches, createChartPatternResult } from '@/features/chartPatterns/shared';

export const structuresHandlers: Record<string, ScannerHandler> = {
  chart_rectangle_range: (context, definition) => {
    const setup = latestRangeSetup(context.bars, 20);
    if (!setup) return null;
    const resistanceTouches = countTouches(setup.baseBars, 'high', setup.resistance, 2);
    const supportTouches = countTouches(setup.baseBars, 'low', setup.support, 2);
    if (resistanceTouches < 2 || supportTouches < 2) return null;
    if (setup.latest.close > setup.resistance || setup.latest.close < setup.support) return null;

    return createChartPatternResult(
      context,
      definition,
      'neutral',
      62,
      [`Price is range-bound between support (${setup.support}) and resistance (${setup.resistance})`],
      {
        support: setup.support,
        resistance: setup.resistance,
        range_width_pct: setup.widthPct,
        support_touches: supportTouches,
        resistance_touches: resistanceTouches,
      },
      {
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildRangeGeometry(setup, definition.name),
      },
    );
  },
  chart_ascending_triangle: (context, definition) => {
    const setup = latestTriangleSetup(context.bars, 'ascending');
    if (!setup) return null;
    if (setup.latest.close <= setup.resistance) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      76,
      [`Flat resistance (${setup.resistance}) broke after rising lows compressed the range`],
      {
        resistance: setup.resistance,
        support_slope: round(setup.lowSlope, 4),
        resistance_touches: setup.resistanceTouches,
      },
      {
        breakoutLevel: setup.resistance,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        pivots: setup.lowPivots,
        geometry: buildAscendingTriangleGeometry(setup),
      },
    );
  },
  chart_descending_triangle: (context, definition) => {
    const setup = latestTriangleSetup(context.bars, 'descending');
    if (!setup) return null;
    if (setup.latest.close >= setup.support) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      76,
      [`Flat support (${setup.support}) broke after falling highs compressed the range`],
      {
        support: setup.support,
        resistance_slope: round(setup.highSlope, 4),
        support_touches: setup.supportTouches,
      },
      {
        breakoutLevel: setup.support,
        supportLevel: setup.support,
        patternStartDate: setup.baseBars[0].date,
        pivots: setup.highPivots,
        geometry: buildDescendingTriangleGeometry(setup),
      },
    );
  },
  chart_symmetrical_triangle: (context, definition) => {
    const setup = latestSymmetricalTriangleSetup(context.bars);
    if (!setup) return null;
    const bullishBreak = setup.latest.close > setup.upperLevel;
    const bearishBreak = setup.latest.close < setup.lowerLevel;
    if (!bullishBreak && !bearishBreak) return null;

    return createChartPatternResult(
      context,
      definition,
      bullishBreak ? 'bullish' : 'bearish',
      72,
      [
        bullishBreak
          ? `Close broke above converging upper pivot level (${setup.upperLevel})`
          : `Close broke below converging lower pivot level (${setup.lowerLevel})`,
      ],
      {
        upper_level: setup.upperLevel,
        lower_level: setup.lowerLevel,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
      },
      {
        breakoutLevel: bullishBreak ? setup.upperLevel : setup.lowerLevel,
        supportLevel: setup.lowerLevel,
        resistanceLevel: setup.upperLevel,
        patternStartDate: setup.baseBars[0].date,
        pivots: [...setup.highPivots, ...setup.lowPivots].sort((a, b) => a.index - b.index),
        geometry: buildSymmetricalTriangleGeometry(setup),
      },
    );
  },
  chart_falling_wedge_bottom: (context, definition) => {
    const setup = latestWedgeSetup(context.bars, 'falling');
    if (!setup || setup.latest.close <= setup.upperLevel) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      74,
      [`Falling wedge converged downward and closed above upper level (${setup.upperLevel})`],
      {
        upper_level: setup.upperLevel,
        lower_level: setup.lowerLevel,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
        range_ratio: setup.rangeRatio,
      },
      {
        breakoutLevel: setup.upperLevel,
        supportLevel: setup.lowerLevel,
        resistanceLevel: setup.upperLevel,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildWedgeGeometry(setup, definition.name, setup.upperLevel),
      },
    );
  },
  chart_rising_wedge_top: (context, definition) => {
    const setup = latestWedgeSetup(context.bars, 'rising');
    if (!setup || setup.latest.close >= setup.lowerLevel) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      74,
      [`Rising wedge converged upward and closed below lower level (${setup.lowerLevel})`],
      {
        upper_level: setup.upperLevel,
        lower_level: setup.lowerLevel,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
        range_ratio: setup.rangeRatio,
      },
      {
        breakoutLevel: setup.lowerLevel,
        supportLevel: setup.lowerLevel,
        resistanceLevel: setup.upperLevel,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildWedgeGeometry(setup, definition.name, setup.lowerLevel),
      },
    );
  },
  chart_diamond_bottom: (context, definition) => {
    const setup = latestDiamondSetup(context.bars);
    if (!setup || setup.latest.close <= setup.resistance) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      72,
      [`Diamond base expanded then contracted before breaking above ${setup.resistance}`],
      {
        support: setup.support,
        resistance: setup.resistance,
        middle_width: setup.middleWidth,
        final_width: setup.finalWidth,
      },
      {
        breakoutLevel: setup.resistance,
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildDiamondGeometry(setup, definition.name),
      },
    );
  },
  chart_diamond_top: (context, definition) => {
    const setup = latestDiamondSetup(context.bars);
    if (!setup || setup.latest.close >= setup.support) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      72,
      [`Diamond top expanded then contracted before breaking below ${setup.support}`],
      {
        support: setup.support,
        resistance: setup.resistance,
        middle_width: setup.middleWidth,
        final_width: setup.finalWidth,
      },
      {
        breakoutLevel: setup.support,
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildDiamondGeometry(setup, definition.name),
      },
    );
  },
  chart_diamond_pattern: (context, definition) => {
    const setup = latestDiamondSetup(context.bars);
    if (!setup) return null;
    if (setup.latest.close > setup.resistance || setup.latest.close < setup.support) return null;

    return createChartPatternResult(
      context,
      definition,
      'neutral',
      64,
      [`Diamond pattern expanded then contracted between ${setup.support} and ${setup.resistance}`],
      {
        support: setup.support,
        resistance: setup.resistance,
        middle_width: setup.middleWidth,
        final_width: setup.finalWidth,
      },
      {
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildDiamondGeometry(setup, definition.name),
      },
    );
  },
  chart_broadening_bottom: (context, definition) => {
    const setup = latestBroadeningSetup(context.bars);
    if (!setup || setup.latest.close <= setup.resistance) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      70,
      [`Broadening base made expanding swings and broke above ${setup.resistance}`],
      {
        support: setup.support,
        resistance: setup.resistance,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
        range_ratio: setup.rangeRatio,
      },
      {
        breakoutLevel: setup.resistance,
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildBroadeningGeometry(setup, definition.name),
      },
    );
  },
  chart_broadening_formation: (context, definition) => {
    const setup = latestBroadeningSetup(context.bars);
    if (!setup) return null;
    if (setup.latest.close > setup.resistance || setup.latest.close < setup.support) return null;

    return createChartPatternResult(
      context,
      definition,
      'neutral',
      62,
      [`Broadening formation has rising highs and falling lows without confirmed breakout`],
      {
        support: setup.support,
        resistance: setup.resistance,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
        range_ratio: setup.rangeRatio,
      },
      {
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildBroadeningGeometry(setup, definition.name),
      },
    );
  },
  chart_rising_three_methods: (context, definition) => {
    const setup = latestThreeMethodsSetup(context.bars, 'bullish');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      70,
      [`Bullish long candle held three small pullback bars before continuation breakout`],
      {
        first_high: setup.first.high,
        first_low: setup.first.low,
        breakout_close: setup.latest.close,
      },
      {
        breakoutLevel: setup.first.high,
        supportLevel: setup.first.low,
        patternStartDate: setup.first.date,
        geometry: buildThreeMethodsGeometry(setup, 'bullish', definition.name),
      },
    );
  },
  chart_falling_three_methods: (context, definition) => {
    const setup = latestThreeMethodsSetup(context.bars, 'bearish');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      70,
      [`Bearish long candle held three small recovery bars before continuation breakdown`],
      {
        first_high: setup.first.high,
        first_low: setup.first.low,
        breakdown_close: setup.latest.close,
      },
      {
        breakoutLevel: setup.first.low,
        resistanceLevel: setup.first.high,
        patternStartDate: setup.first.date,
        geometry: buildThreeMethodsGeometry(setup, 'bearish', definition.name),
      },
    );
  },
  chart_mat_hold_bullish: (context, definition) => {
    const setup = latestMatHoldSetup(context.bars, 'bullish');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      72,
      [`Bullish mat hold kept consolidation above support and broke above ${setup.breakoutLevel}`],
      {
        breakout_level: setup.breakoutLevel,
        hold_level: setup.holdLevel,
      },
      {
        breakoutLevel: setup.breakoutLevel,
        supportLevel: setup.holdLevel,
        patternStartDate: setup.first.date,
        geometry: buildMatHoldGeometry(setup, 'bullish', definition.name),
      },
    );
  },
  chart_mat_hold_bearish: (context, definition) => {
    const setup = latestMatHoldSetup(context.bars, 'bearish');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      72,
      [`Bearish mat hold kept consolidation below resistance and broke below ${setup.breakoutLevel}`],
      {
        breakdown_level: setup.breakoutLevel,
        hold_level: setup.holdLevel,
      },
      {
        breakoutLevel: setup.breakoutLevel,
        resistanceLevel: setup.holdLevel,
        patternStartDate: setup.first.date,
        geometry: buildMatHoldGeometry(setup, 'bearish', definition.name),
      },
    );
  },
  chart_bull_flag: (context, definition) => {
    const setup = latestContinuationSetup(context.bars, 'bullish', 'flag');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      74,
      [`Bullish pole advanced ${setup.poleMovePct}% before a shallow flag breakout above ${setup.breakoutLevel}`],
      {
        pole_move_pct: setup.poleMovePct,
        breakout_level: setup.breakoutLevel,
        consolidation_slope: round(setup.closeSlope, 4),
      },
      {
        breakoutLevel: setup.breakoutLevel,
        resistanceLevel: setup.breakoutLevel,
        patternStartDate: setup.poleBars[0].date,
        geometry: buildContinuationGeometry(setup, 'flag', definition.name),
      },
    );
  },
  chart_bear_flag: (context, definition) => {
    const setup = latestContinuationSetup(context.bars, 'bearish', 'flag');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      74,
      [`Bearish pole declined ${Math.abs(setup.poleMovePct)}% before a flag breakdown below ${setup.breakoutLevel}`],
      {
        pole_move_pct: setup.poleMovePct,
        breakout_level: setup.breakoutLevel,
        consolidation_slope: round(setup.closeSlope, 4),
      },
      {
        breakoutLevel: setup.breakoutLevel,
        supportLevel: setup.breakoutLevel,
        patternStartDate: setup.poleBars[0].date,
        geometry: buildContinuationGeometry(setup, 'flag', definition.name),
      },
    );
  },
  chart_bull_pennant: (context, definition) => {
    const setup = latestContinuationSetup(context.bars, 'bullish', 'pennant');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      76,
      [`Bullish pole advanced ${setup.poleMovePct}% before a converging pennant breakout`],
      {
        pole_move_pct: setup.poleMovePct,
        upper_level: setup.breakoutLevel,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
      },
      {
        breakoutLevel: setup.breakoutLevel,
        resistanceLevel: setup.breakoutLevel,
        patternStartDate: setup.poleBars[0].date,
        geometry: buildContinuationGeometry(setup, 'pennant', definition.name),
      },
    );
  },
  chart_bear_pennant: (context, definition) => {
    const setup = latestContinuationSetup(context.bars, 'bearish', 'pennant');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      76,
      [`Bearish pole declined ${Math.abs(setup.poleMovePct)}% before a converging pennant breakdown`],
      {
        pole_move_pct: setup.poleMovePct,
        lower_level: setup.breakoutLevel,
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
      },
      {
        breakoutLevel: setup.breakoutLevel,
        supportLevel: setup.breakoutLevel,
        patternStartDate: setup.poleBars[0].date,
        geometry: buildContinuationGeometry(setup, 'pennant', definition.name),
      },
    );
  },
  chart_rising_channel: (context, definition) => {
    const setup = latestChannelSetup(context.bars, 'rising');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      66,
      [`Rising channel detected with parallel upward high/low slopes`],
      {
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
        channel_support: setup.support,
        channel_resistance: setup.resistance,
      },
      {
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildChannelGeometry(setup, 'rising'),
      },
    );
  },
  chart_falling_channel: (context, definition) => {
    const setup = latestChannelSetup(context.bars, 'falling');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      66,
      [`Falling channel detected with parallel downward high/low slopes`],
      {
        high_slope: round(setup.highSlope, 4),
        low_slope: round(setup.lowSlope, 4),
        channel_support: setup.support,
        channel_resistance: setup.resistance,
      },
      {
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildChannelGeometry(setup, 'falling'),
      },
    );
  },
  chart_high_tight_flag: (context, definition) => {
    const setup = latestHighTightFlagSetup(context.bars);
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      82,
      [`Price rallied ${setup.rallyPct}% before a tight pullback breakout above ${setup.breakoutLevel}`],
      {
        rally_pct: setup.rallyPct,
        pullback_pct: setup.pullbackPct,
        breakout_level: setup.breakoutLevel,
      },
      {
        breakoutLevel: setup.breakoutLevel,
        resistanceLevel: setup.breakoutLevel,
        supportLevel: setup.pullbackLow,
        patternStartDate: setup.rallyBars[0].date,
        geometry: buildHighTightFlagGeometry(setup, definition.name),
      },
    );
  },
  chart_coil_volatility_squeeze: (context, definition) => {
    const setup = latestCoilSetup(context.bars);
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'neutral',
      64,
      [`Recent ranges contracted from ${setup.firstRange} to ${setup.latestRange}`],
      {
        first_range: setup.firstRange,
        latest_range: setup.latestRange,
        range_ratio: setup.rangeRatio,
      },
      {
        supportLevel: setup.support,
        resistanceLevel: setup.resistance,
        patternStartDate: setup.baseBars[0].date,
        geometry: buildCoilGeometry(setup, definition.name),
      },
    );
  },
  chart_three_rising_valleys: (context, definition) => {
    const setup = latestThreePivotSetup(context.bars, 'rising-valleys');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      78,
      [`Three rising valleys confirmed higher lows and broke above ${setup.level}`],
      {
        first_low: setup.pivots[0].price,
        second_low: setup.pivots[1].price,
        third_low: setup.pivots[2].price,
        breakout_level: setup.level,
      },
      {
        breakoutLevel: setup.level,
        supportLevel: setup.pivots[2].price,
        patternStartDate: setup.pivots[0].date,
        pivots: setup.pivots,
        geometry: buildThreePivotGeometry(setup, 'rising-valleys', definition.name),
      },
    );
  },
  chart_three_falling_peaks: (context, definition) => {
    const setup = latestThreePivotSetup(context.bars, 'falling-peaks');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      78,
      [`Three falling peaks confirmed lower highs and broke below ${setup.level}`],
      {
        first_high: setup.pivots[0].price,
        second_high: setup.pivots[1].price,
        third_high: setup.pivots[2].price,
        breakdown_level: setup.level,
      },
      {
        breakoutLevel: setup.level,
        resistanceLevel: setup.pivots[2].price,
        patternStartDate: setup.pivots[0].date,
        pivots: setup.pivots,
        geometry: buildThreePivotGeometry(setup, 'falling-peaks', definition.name),
      },
    );
  },
  chart_measured_move_up: (context, definition) => {
    const setup = latestMeasuredMoveSetup(context.bars, 'up');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      70,
      [`Second bullish leg (${setup.secondLegPct}%) is similar to first leg (${setup.firstLegPct}%)`],
      {
        first_leg_pct: setup.firstLegPct,
        second_leg_pct: setup.secondLegPct,
        leg_ratio: setup.legRatio,
      },
      {
        breakoutLevel: setup.latest.close,
        supportLevel: setup.correctionLow,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildMeasuredMoveGeometry(setup, 'up', definition.name),
      },
    );
  },
  chart_measured_move_down: (context, definition) => {
    const setup = latestMeasuredMoveSetup(context.bars, 'down');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      70,
      [`Second bearish leg (${Math.abs(setup.secondLegPct)}%) is similar to first leg (${Math.abs(setup.firstLegPct)}%)`],
      {
        first_leg_pct: setup.firstLegPct,
        second_leg_pct: setup.secondLegPct,
        leg_ratio: setup.legRatio,
      },
      {
        breakoutLevel: setup.latest.close,
        resistanceLevel: setup.correctionHigh,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildMeasuredMoveGeometry(setup, 'down', definition.name),
      },
    );
  },
};
