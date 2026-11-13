import type { ScannerHandler } from '@/features/scanner/types';
import { latestHeadShouldersSetup, latestCupHandleSetup, latestRoundingSetup, latestAdamEveSetup, latestScallopHandleSetup, latestComplexHeadShouldersSetup } from '@/features/chartPatterns/setups';
import { buildScallopHandleGeometry, buildCupHandleGeometry, buildRoundingGeometry, buildAdamEveGeometry, buildComplexHeadShouldersGeometry, buildHeadShouldersGeometry } from '@/features/chartPatterns/geometry';
import { createChartPatternResult } from '@/features/chartPatterns/shared';

export const complexBasesHandlers: Record<string, ScannerHandler> = {
  chart_head_shoulders: (context, definition) => {
    const setup = latestHeadShouldersSetup(context.bars, 'top');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      82,
      [`Head (${setup.head.price}) is above both shoulders and close broke neckline (${setup.neckline})`],
      {
        left_shoulder: setup.leftShoulder.price,
        head: setup.head.price,
        right_shoulder: setup.rightShoulder.price,
        neckline: setup.neckline,
      },
      {
        breakoutLevel: setup.neckline,
        necklineLevel: setup.neckline,
        resistanceLevel: setup.head.price,
        patternStartDate: setup.leftShoulder.date,
        pivots: [setup.leftShoulder, setup.head, setup.rightShoulder],
        geometry: buildHeadShouldersGeometry(
          setup,
          definition.name,
          context.bars[context.bars.length - 1].date,
        ),
      },
    );
  },
  chart_inverse_head_shoulders: (context, definition) => {
    const setup = latestHeadShouldersSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      82,
      [`Head (${setup.head.price}) is below both shoulders and close broke neckline (${setup.neckline})`],
      {
        left_shoulder: setup.leftShoulder.price,
        head: setup.head.price,
        right_shoulder: setup.rightShoulder.price,
        neckline: setup.neckline,
      },
      {
        breakoutLevel: setup.neckline,
        necklineLevel: setup.neckline,
        supportLevel: setup.head.price,
        patternStartDate: setup.leftShoulder.date,
        pivots: [setup.leftShoulder, setup.head, setup.rightShoulder],
        geometry: buildHeadShouldersGeometry(
          setup,
          definition.name,
          context.bars[context.bars.length - 1].date,
        ),
      },
    );
  },
  chart_complex_head_shoulders: (context, definition) => {
    const setup =
      latestComplexHeadShouldersSetup(context.bars, 'top') ??
      latestComplexHeadShouldersSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      setup.direction,
      76,
      [`Complex H&S ${setup.direction === 'bearish' ? 'top' : 'bottom'} broke neckline (${setup.neckline})`],
      {
        head: setup.head.price,
        neckline: setup.neckline,
        pivot_count: setup.pivots.length,
      },
      {
        breakoutLevel: setup.neckline,
        necklineLevel: setup.neckline,
        supportLevel: setup.direction === 'bearish' ? setup.neckline : setup.head.price,
        resistanceLevel: setup.direction === 'bearish' ? setup.head.price : setup.neckline,
        patternStartDate: setup.pivots[0].date,
        pivots: setup.pivots,
        geometry: buildComplexHeadShouldersGeometry(
          setup,
          definition.name,
          context.bars[context.bars.length - 1].date,
        ),
      },
    );
  },
  chart_cup_handle: (context, definition) => {
    const setup = latestCupHandleSetup(context.bars, 'bullish');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      78,
      [`Rounded base recovered toward rim (${setup.rimLevel}) and broke out after shallow handle`],
      {
        rim_level: setup.rimLevel,
        cup_low: setup.cupExtreme,
        handle_pullback_pct: setup.handlePullbackPct,
      },
      {
        breakoutLevel: setup.rimLevel,
        resistanceLevel: setup.rimLevel,
        supportLevel: setup.cupExtreme,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildCupHandleGeometry(setup, 'bullish', definition.name),
      },
    );
  },
  chart_inverted_cup_handle: (context, definition) => {
    const setup = latestCupHandleSetup(context.bars, 'bearish');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      78,
      [`Inverted rounded base returned toward rim (${setup.rimLevel}) and broke down after handle bounce`],
      {
        rim_level: setup.rimLevel,
        cup_high: setup.cupExtreme,
        handle_pullback_pct: setup.handlePullbackPct,
      },
      {
        breakoutLevel: setup.rimLevel,
        supportLevel: setup.rimLevel,
        resistanceLevel: setup.cupExtreme,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildCupHandleGeometry(setup, 'bearish', definition.name),
      },
    );
  },
  chart_rounding_bottom: (context, definition) => {
    const setup = latestRoundingSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      70,
      [`Gradual rounded bottom recovered above rim level (${setup.rimLevel})`],
      {
        rim_level: setup.rimLevel,
        bowl_low: setup.extreme,
      },
      {
        breakoutLevel: setup.rimLevel,
        resistanceLevel: setup.rimLevel,
        supportLevel: setup.extreme,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildRoundingGeometry(setup, 'bottom', definition.name),
      },
    );
  },
  chart_adam_eve_bottom: (context, definition) => {
    const setup = latestAdamEveSetup(context.bars, 'bottom');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      74,
      [`Sharp Adam low (${setup.adam.price}) and rounded Eve low (${setup.eve.price}) broke neckline (${setup.neckline})`],
      {
        adam_low: setup.adam.price,
        eve_low: setup.eve.price,
        neckline: setup.neckline,
      },
      {
        breakoutLevel: setup.neckline,
        necklineLevel: setup.neckline,
        supportLevel: Math.min(setup.adam.price, setup.eve.price),
        patternStartDate: setup.adam.date,
        pivots: [setup.adam, setup.eve],
        geometry: buildAdamEveGeometry(setup, 'bottom', definition.name, context.bars[context.bars.length - 1].date),
      },
    );
  },
  chart_adam_eve_top: (context, definition) => {
    const setup = latestAdamEveSetup(context.bars, 'top');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      74,
      [`Sharp Adam high (${setup.adam.price}) and rounded Eve high (${setup.eve.price}) broke support (${setup.neckline})`],
      {
        adam_high: setup.adam.price,
        eve_high: setup.eve.price,
        support: setup.neckline,
      },
      {
        breakoutLevel: setup.neckline,
        necklineLevel: setup.neckline,
        resistanceLevel: Math.max(setup.adam.price, setup.eve.price),
        patternStartDate: setup.adam.date,
        pivots: [setup.adam, setup.eve],
        geometry: buildAdamEveGeometry(setup, 'top', definition.name, context.bars[context.bars.length - 1].date),
      },
    );
  },
  chart_scallop_handle: (context, definition) => {
    const setup = latestScallopHandleSetup(context.bars);
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      72,
      [`Rising scallop recovered ${setup.advancePct}% and broke above handle high (${setup.breakoutLevel})`],
      {
        scallop_low: setup.scallopLow,
        right_rim: setup.rightRim,
        advance_pct: setup.advancePct,
        handle_pullback_pct: setup.handlePullbackPct,
      },
      {
        breakoutLevel: setup.breakoutLevel,
        resistanceLevel: setup.breakoutLevel,
        supportLevel: setup.scallopLow,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildScallopHandleGeometry(setup, definition.name),
      },
    );
  },
  chart_rounding_top: (context, definition) => {
    const setup = latestRoundingSetup(context.bars, 'top');
    if (!setup) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      70,
      [`Gradual rounded top broke below rim level (${setup.rimLevel})`],
      {
        rim_level: setup.rimLevel,
        arch_high: setup.extreme,
      },
      {
        breakoutLevel: setup.rimLevel,
        supportLevel: setup.rimLevel,
        resistanceLevel: setup.extreme,
        patternStartDate: setup.patternBars[0].date,
        geometry: buildRoundingGeometry(setup, 'top', definition.name),
      },
    );
  },
};
