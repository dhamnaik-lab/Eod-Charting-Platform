import {
  averageRange,
  averageVolume,
  candleRange,
  findLocalPivots,
  findSwingPivots,
  gapDownPct,
  gapUpPct,
  hasDownTrend,
  hasPatternVolumeProfile,
  hasUpTrend,
  highestHigh,
  isRangeBound,
  isVolumeSpike,
  linearSlope,
  lowestLow,
  retracementDepthPct,
  round,
} from '@/plugins/scanner/chartPatternPrimitives';
import type {
  ChartPatternGeometry,
  ChartPatternFamily,
  ChartPatternPivot,
} from '@/plugins/scanner/chartPatternTypes';
import type {
  EodBar,
  ScannerContext,
  ScannerDefinition,
  ScannerHandler,
  ScannerResult,
} from '@/plugins/scanner/types';

const CHART_GAP_CATEGORY_ID = 'chart_patterns_gap';
const CHART_GAP_CATEGORY_NAME = 'Chart Patterns - Gaps';
const CHART_REVERSAL_CATEGORY_ID = 'chart_patterns_reversal';
const CHART_REVERSAL_CATEGORY_NAME = 'Chart Patterns - Reversals';
const CHART_COMPLEX_CATEGORY_ID = 'chart_patterns_complex';
const CHART_COMPLEX_CATEGORY_NAME = 'Chart Patterns - Complex Bases';
const CHART_STRUCTURE_CATEGORY_ID = 'chart_patterns_structure';
const CHART_STRUCTURE_CATEGORY_NAME = 'Chart Patterns - Structures';
const MIN_GAP_PCT = 0.25;
const LEVEL_TOLERANCE_PCT = 3;
const REVERSAL_LOOKBACK_BARS = 180;
const STRUCTURE_LOOKBACK_BARS = 120;
const CUP_HANDLE_LOOKBACK_BARS = 160;

export const chartPatternScannerDefinitions: ScannerDefinition[] = [
  {
    id: 'chart_common_gap',
    name: 'Common Gap',
    categoryId: CHART_GAP_CATEGORY_ID,
    categoryName: CHART_GAP_CATEGORY_NAME,
    priority: 2,
    scannerType: 'gap',
    description: 'Gap inside a recent range, usually low significance by itself.',
    logicText: 'Gap up/down while prior 10 bars are range-bound and volume is not elevated.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['gap_direction', 'gap_pct', 'avg_volume_10', 'volume_ratio'],
    chartPattern: {
      family: 'gap',
      signalDirection: 'neutral',
      reliability: 'low',
      timeframeReliability: { intraday: 2, daily: 1, weekly: 0 },
      volumeConfirmation: 'Low or normal volume helps distinguish common gaps from breakaway gaps.',
      failureCondition: 'If price does not fill quickly and volume expands, reassess as a stronger gap pattern.',
      indiaContext: 'Common NSE/BSE opening gaps from overnight cues often fill quickly unless supported by volume.',
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    limitations: 'This first rule does not forecast whether the gap will fill.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'chart_breakaway_gap',
    name: 'Breakaway Gap',
    categoryId: CHART_GAP_CATEGORY_ID,
    categoryName: CHART_GAP_CATEGORY_NAME,
    priority: 1,
    scannerType: 'gap',
    description: 'Bullish gap out of a recent base or resistance area.',
    logicText: 'Open > prior 20-bar resistance and volume >= 1.5x average volume.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['gap_pct', 'resistance', 'avg_volume_20', 'volume_ratio'],
    chartPattern: {
      family: 'gap',
      signalDirection: 'bullish',
      reliability: 'high',
      timeframeReliability: { intraday: 2, daily: 3, weekly: 3 },
      volumeConfirmation: 'Gap day volume should be at least 150% of the recent average.',
      failureCondition: 'A full gap fill within a few sessions weakens the breakaway interpretation.',
      indiaContext: 'Often appears after earnings, RBI/budget events, or sector re-rating in liquid NSE names.',
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'chart_runaway_gap',
    name: 'Runaway Gap',
    categoryId: CHART_GAP_CATEGORY_ID,
    categoryName: CHART_GAP_CATEGORY_NAME,
    priority: 1,
    scannerType: 'gap',
    description: 'Bullish gap in an existing uptrend.',
    logicText: 'Prior 20 bars are trending up, then today gaps above yesterday high and holds the gap.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['gap_pct', 'trend_move_pct', 'avg_volume_20', 'volume_ratio'],
    chartPattern: {
      family: 'gap',
      signalDirection: 'bullish',
      reliability: 'high',
      timeframeReliability: { intraday: 2, daily: 3, weekly: 3 },
      volumeConfirmation: 'Moderate-to-high volume supports trend continuation.',
      failureCondition: 'A full gap fill suggests the setup may be exhaustion instead of continuation.',
      indiaContext: 'Useful during strong NIFTY or sector bull phases for continuation screening.',
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'chart_exhaustion_gap',
    name: 'Exhaustion Gap',
    categoryId: CHART_GAP_CATEGORY_ID,
    categoryName: CHART_GAP_CATEGORY_NAME,
    priority: 1,
    scannerType: 'gap',
    description: 'Late uptrend gap on high volume with bearish rejection.',
    logicText: 'Prior 20 bars trend up, today gaps up, volume >= 2x average, and closes red.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['gap_pct', 'trend_move_pct', 'avg_volume_20', 'volume_ratio'],
    chartPattern: {
      family: 'gap',
      signalDirection: 'bearish',
      reliability: 'medium',
      timeframeReliability: { intraday: 2, daily: 3, weekly: 3 },
      volumeConfirmation: 'Very high volume marks possible buying climax.',
      failureCondition: 'A strong follow-through close above the gap high invalidates the exhaustion warning.',
      indiaContext: 'Relevant around expiry weeks or post-event gap-ups where late buyers get trapped.',
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    limitations: 'Needs follow-through confirmation before acting as a reversal signal.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'chart_island_reversal_top',
    name: 'Island Reversal (Top)',
    categoryId: CHART_GAP_CATEGORY_ID,
    categoryName: CHART_GAP_CATEGORY_NAME,
    priority: 1,
    scannerType: 'gap',
    description: 'Gap up, isolated trading island, then gap down.',
    logicText: 'Recent gap-up island remains above pre-gap high, followed by a gap-down escape.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['gap_up_pct', 'gap_down_pct', 'island_low', 'pre_gap_high'],
    chartPattern: {
      family: 'gap',
      signalDirection: 'bearish',
      reliability: 'high',
      timeframeReliability: { intraday: 2, daily: 3, weekly: 3 },
      volumeConfirmation: 'Both gaps are stronger when volume expands.',
      failureCondition: 'If price re-enters the island quickly, the reversal thesis weakens.',
      indiaContext: 'Rare but decisive after major positive news fails in liquid NSE stocks.',
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'chart_island_reversal_bottom',
    name: 'Island Reversal (Bottom)',
    categoryId: CHART_GAP_CATEGORY_ID,
    categoryName: CHART_GAP_CATEGORY_NAME,
    priority: 1,
    scannerType: 'gap',
    description: 'Gap down, isolated trading island, then gap up.',
    logicText: 'Recent gap-down island remains below pre-gap low, followed by a gap-up escape.',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['gap_down_pct', 'gap_up_pct', 'island_high', 'pre_gap_low'],
    chartPattern: {
      family: 'gap',
      signalDirection: 'bullish',
      reliability: 'high',
      timeframeReliability: { intraday: 2, daily: 3, weekly: 3 },
      volumeConfirmation: 'Both gaps are stronger when volume expands.',
      failureCondition: 'If price re-enters the island quickly, the reversal thesis weakens.',
      indiaContext: 'Rare NSE post-panic reversal pattern; the second gap confirms trapped shorts.',
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    implementationStatus: 'ready_for_engine',
  },
  ...createBasicReversalDefinitions(),
  ...createStructureDefinitions(),
  ...createComplexBaseDefinitions(),
];

export const chartPatternScannerHandlers: Record<string, ScannerHandler> = {
  chart_common_gap: (context, definition) => {
    if (context.bars.length < 12) return null;
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, previous } = pair;
    const upPct = gapUpPct(today, previous);
    const downPct = gapDownPct(today, previous);
    const gapPct = upPct ?? downPct;
    if (gapPct === null || gapPct < MIN_GAP_PCT) return null;

    const priorRange = context.bars.slice(-12, -2);
    if (!isRangeBound(priorRange, 12)) return null;
    const avgVolume = averageVolume(context.bars, 10, true);
    if (avgVolume !== null && today.volume > avgVolume * 1.2) return null;

    return createChartPatternResult(
      context,
      definition,
      'neutral',
      45,
      [
        `${upPct !== null ? 'Gap up' : 'Gap down'} occurred inside a range-bound 10-bar context`,
      ],
      {
        gap_direction: upPct !== null ? 'up' : 'down',
        gap_pct: gapPct,
        avg_volume_10: avgVolume ? round(avgVolume, 0) : null,
        volume_ratio: avgVolume ? round(today.volume / avgVolume, 2) : null,
      },
      {
        patternStartDate: priorRange[0].date,
        geometry: buildSingleGapGeometry(
          definition.name,
          previous.date,
          today.date,
          upPct !== null ? previous.high : today.high,
          upPct !== null ? today.low : previous.low,
          today.date,
          today.close,
        ),
      },
    );
  },
  chart_breakaway_gap: (context, definition) => {
    if (context.bars.length < 22) return null;
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, previous } = pair;
    const gapPct = gapUpPct(today, previous);
    if (gapPct === null || gapPct < MIN_GAP_PCT) return null;

    const base = context.bars.slice(-22, -2);
    const resistance = highestHigh(base);
    const avgVolume = averageVolume(context.bars, 20, true);
    if (resistance === null || today.open <= resistance || today.close <= resistance) return null;
    if (!isVolumeSpike(today.volume, avgVolume, 1.5)) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      80,
      [`Gap opened above 20-bar resistance (${resistance}) with volume expansion`],
      {
        gap_pct: gapPct,
        resistance: resistance,
        avg_volume_20: avgVolume ? round(avgVolume, 0) : null,
        volume_ratio: avgVolume ? round(today.volume / avgVolume, 2) : null,
      },
      {
        breakoutLevel: resistance,
        resistanceLevel: resistance,
        patternStartDate: base[0].date,
        geometry: buildSingleGapGeometry(
          definition.name,
          previous.date,
          today.date,
          previous.high,
          today.low,
          today.date,
          today.close,
        ),
      },
    );
  },
  chart_runaway_gap: (context, definition) => {
    if (context.bars.length < 22) return null;
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, previous } = pair;
    const gapPct = gapUpPct(today, previous);
    if (gapPct === null || gapPct < MIN_GAP_PCT) return null;

    const trendBars = context.bars.slice(-22, -2);
    const trendMovePct = movePct(trendBars);
    const avgVolume = averageVolume(context.bars, 20, true);
    if (!hasUpTrend(trendBars, 8)) return null;
    if (today.low < previous.high || today.close <= today.open) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      avgVolume && today.volume >= avgVolume * 1.2 ? 75 : 68,
      [`Gap held above yesterday high (${previous.high}) after a ${round(trendMovePct, 2)}% prior uptrend`],
      {
        gap_pct: gapPct,
        trend_move_pct: round(trendMovePct, 2),
        avg_volume_20: avgVolume ? round(avgVolume, 0) : null,
        volume_ratio: avgVolume ? round(today.volume / avgVolume, 2) : null,
      },
      {
        breakoutLevel: previous.high,
        patternStartDate: trendBars[0].date,
        geometry: buildSingleGapGeometry(
          definition.name,
          previous.date,
          today.date,
          previous.high,
          today.low,
          today.date,
          today.close,
        ),
      },
    );
  },
  chart_exhaustion_gap: (context, definition) => {
    if (context.bars.length < 22) return null;
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, previous } = pair;
    const gapPct = gapUpPct(today, previous);
    if (gapPct === null || gapPct < MIN_GAP_PCT) return null;

    const trendBars = context.bars.slice(-22, -2);
    const trendMovePct = movePct(trendBars);
    const avgVolume = averageVolume(context.bars, 20, true);
    if (!hasUpTrend(trendBars, 12)) return null;
    if (!isVolumeSpike(today.volume, avgVolume, 2)) return null;
    if (today.close >= today.open) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      70,
      [`High-volume gap up after a ${round(trendMovePct, 2)}% prior uptrend closed with bearish rejection`],
      {
        gap_pct: gapPct,
        trend_move_pct: round(trendMovePct, 2),
        avg_volume_20: avgVolume ? round(avgVolume, 0) : null,
        volume_ratio: avgVolume ? round(today.volume / avgVolume, 2) : null,
      },
      {
        resistanceLevel: today.high,
        patternStartDate: trendBars[0].date,
        geometry: buildSingleGapGeometry(
          definition.name,
          previous.date,
          today.date,
          previous.high,
          today.low,
          today.date,
          today.close,
        ),
      },
    );
  },
  chart_island_reversal_top: (context, definition) => {
    if (context.bars.length < 5) return null;
    const bars = context.bars;
    const preGap = bars[bars.length - 5];
    const firstIsland = bars[bars.length - 4];
    const middleIsland = bars.slice(-3, -1);
    const latest = bars[bars.length - 1];
    const firstGapPct = gapUpPct(firstIsland, preGap);
    if (firstGapPct === null || firstGapPct < MIN_GAP_PCT) return null;
    if (!middleIsland.every((bar) => bar.low > preGap.high)) return null;
    const islandLow = lowestLow([firstIsland, ...middleIsland]);
    if (islandLow === null || latest.open >= islandLow || latest.close >= islandLow) return null;

    return createChartPatternResult(
      context,
      definition,
      'bearish',
      82,
      [`Gap-down escape below island low (${islandLow}) after prior gap-up island`],
      {
        gap_up_pct: firstGapPct,
        gap_down_pct: round((1 - latest.open / islandLow) * 100, 2),
        island_low: islandLow,
        pre_gap_high: preGap.high,
      },
      {
        supportLevel: islandLow,
        patternStartDate: firstIsland.date,
        pivots: [
          { index: bars.length - 5, date: preGap.date, price: preGap.high, kind: 'high' },
          { index: bars.length - 1, date: latest.date, price: latest.open, kind: 'low' },
        ],
        geometry: buildIslandGeometry(
          definition.name,
          preGap,
          firstIsland,
          middleIsland,
          latest,
          'top',
          islandLow,
        ),
      },
    );
  },
  chart_island_reversal_bottom: (context, definition) => {
    if (context.bars.length < 5) return null;
    const bars = context.bars;
    const preGap = bars[bars.length - 5];
    const firstIsland = bars[bars.length - 4];
    const middleIsland = bars.slice(-3, -1);
    const latest = bars[bars.length - 1];
    const firstGapPct = gapDownPct(firstIsland, preGap);
    if (firstGapPct === null || firstGapPct < MIN_GAP_PCT) return null;
    if (!middleIsland.every((bar) => bar.high < preGap.low)) return null;
    const islandHigh = highestHigh([firstIsland, ...middleIsland]);
    if (islandHigh === null || latest.open <= islandHigh || latest.close <= islandHigh) return null;

    return createChartPatternResult(
      context,
      definition,
      'bullish',
      82,
      [`Gap-up escape above island high (${islandHigh}) after prior gap-down island`],
      {
        gap_down_pct: firstGapPct,
        gap_up_pct: round((latest.open / islandHigh - 1) * 100, 2),
        island_high: islandHigh,
        pre_gap_low: preGap.low,
      },
      {
        resistanceLevel: islandHigh,
        patternStartDate: firstIsland.date,
        pivots: [
          { index: bars.length - 5, date: preGap.date, price: preGap.low, kind: 'low' },
          { index: bars.length - 1, date: latest.date, price: latest.open, kind: 'high' },
        ],
        geometry: buildIslandGeometry(
          definition.name,
          preGap,
          firstIsland,
          middleIsland,
          latest,
          'bottom',
          islandHigh,
        ),
      },
    );
  },
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

export function runChartPatternScanner(
  context: ScannerContext,
  definition: ScannerDefinition,
): ScannerResult | null {
  return chartPatternScannerHandlers[definition.id]?.(context, definition) ?? null;
}

function latestPair(bars: EodBar[]): { today: EodBar; previous: EodBar } | null {
  if (bars.length < 2) return null;
  return {
    today: bars[bars.length - 1],
    previous: bars[bars.length - 2],
  };
}

function movePct(bars: EodBar[]): number {
  if (bars.length < 2 || bars[0].close <= 0) return 0;
  return (bars[bars.length - 1].close / bars[0].close - 1) * 100;
}

function createBasicReversalDefinitions(): ScannerDefinition[] {
  return [
    reversalDefinition(
      'chart_double_bottom',
      'Double Bottom (W)',
      'bullish',
      'high',
      'Two comparable pivot lows followed by a close above the intervening neckline.',
      'Comparable low pivots + neckline break',
      ['first_low', 'second_low', 'neckline'],
      'Second bottom should form on lower volume than the first; breakout volume improves confidence.',
      'A close below the two-low support invalidates the pattern.',
      'Classic NSE/BSE bottom reversal; best near long-term support or after sector corrections.',
    ),
    reversalDefinition(
      'chart_double_top',
      'Double Top (M)',
      'bearish',
      'high',
      'Two comparable pivot highs followed by a close below intervening support.',
      'Comparable high pivots + support break',
      ['first_high', 'second_high', 'support'],
      'Distribution volume near the second top and breakdown volume improve confidence.',
      'A close above the two-top resistance invalidates the pattern.',
      'Common in liquid NSE names after extended rallies; useful for distribution screens.',
    ),
    reversalDefinition(
      'chart_triple_bottom',
      'Triple Bottom',
      'bullish',
      'high',
      'Three comparable lows followed by a neckline breakout.',
      'Three comparable low pivots + neckline break',
      ['support', 'neckline'],
      'Third test on lower volume and breakout on higher volume is preferred.',
      'A close below the repeated support zone invalidates the pattern.',
      'Rare but strong when repeated support aligns with market-wide risk reversal.',
    ),
    reversalDefinition(
      'chart_triple_top',
      'Triple Top',
      'bearish',
      'high',
      'Three comparable highs followed by a support breakdown.',
      'Three comparable high pivots + support break',
      ['resistance', 'support'],
      'Breakdown volume improves confidence after repeated resistance tests.',
      'A close above the repeated resistance zone invalidates the pattern.',
      'Useful for repeated supply zones in NSE/BSE stocks and index charts.',
    ),
    reversalDefinition(
      'chart_v_bottom',
      'V-Bottom',
      'bullish',
      'medium',
      'Sharp decline followed by an immediate strong bullish reversal.',
      'Recent sharp low + close above prior high',
      ['decline_pct', 'extreme_low', 'confirmation_close'],
      'High volume on reversal day improves conviction.',
      'A move back below the V low invalidates the reversal.',
      'High-risk but relevant after panic selloffs or event-driven NSE declines.',
    ),
    reversalDefinition(
      'chart_spike_top',
      'Spike Top (V-Top)',
      'bearish',
      'medium',
      'Sharp advance followed by an immediate bearish reversal.',
      'Recent sharp high + close below prior low',
      ['advance_pct', 'extreme_high', 'confirmation_close'],
      'Very high volume at the spike can mark buying climax.',
      'A close back above the spike high invalidates the reversal warning.',
      'Relevant after vertical rallies, event euphoria, or expiry-driven spikes.',
    ),
    reversalDefinition(
      'chart_horn_bottom',
      'Horn Bottom',
      'bullish',
      'medium',
      'Two sharp comparable lows separated by a recovery and confirmed by breakout.',
      'Two sharp low pivots + intervening high break',
      ['first_low', 'second_low', 'neckline'],
      'Rejection volume on the two lows improves confidence.',
      'A close below the two horn lows invalidates the pattern.',
      'Useful for dual rejection lows in volatile NSE/BSE stocks.',
    ),
    reversalDefinition(
      'chart_horn_top',
      'Horn Top',
      'bearish',
      'medium',
      'Two sharp comparable highs separated by a pullback and confirmed by breakdown.',
      'Two sharp high pivots + intervening low break',
      ['first_high', 'second_high', 'support'],
      'High volume near the two peaks improves distribution confidence.',
      'A close above the two horn highs invalidates the pattern.',
      'Useful for dual rejection highs after sharp index or sector advances.',
    ),
    reversalDefinition(
      'chart_bump_run_bottom',
      'Bump-and-Run Bottom',
      'bullish',
      'medium',
      'Downtrend accelerates into a steep bump, then reverses above the run level.',
      'Lead-in decline + steeper bearish bump + bullish run breakout.',
      ['lead_slope', 'bump_slope', 'breakout_level'],
      'Breakout volume improves confidence after the steep panic leg.',
      'A close back below the run breakout level weakens the reversal.',
      'Useful after capitulation-style NSE/BSE selloffs where the last leg becomes unsustainably steep.',
    ),
    reversalDefinition(
      'chart_bump_run_top',
      'Bump-and-Run Top',
      'bearish',
      'medium',
      'Uptrend accelerates into a steep bump, then reverses below the run level.',
      'Lead-in advance + steeper bullish bump + bearish run breakdown.',
      ['lead_slope', 'bump_slope', 'breakdown_level'],
      'Breakdown volume improves confidence after the steep euphoric leg.',
      'A close back above the run breakdown level weakens the reversal.',
      'Useful after overheated NSE/BSE advances where the final leg becomes unsustainably steep.',
    ),
    reversalDefinition(
      'chart_blow_off_top',
      'Blow-off Top',
      'bearish',
      'high',
      'Late vertical advance ends with a high-volume bearish reversal bar.',
      'Strong prior advance + volume spike + wide bearish bar closing below prior low.',
      ['advance_pct', 'volume_ratio', 'spike_high'],
      'Very high volume is central to confirming the exhaustion top.',
      'A recovery above the spike high invalidates the warning.',
      'Relevant in NSE/BSE momentum names after news-driven euphoria or crowded breakouts.',
    ),
  ];
}

function createStructureDefinitions(): ScannerDefinition[] {
  return [
    structureDefinition(
      'chart_rectangle_range',
      'Rectangle / Range',
      'neutral',
      'medium',
      'Horizontal support and resistance contain price inside a rectangular range.',
      'Recent bars are range-bound with at least two support and resistance touches.',
      ['support', 'resistance', 'range_width_pct', 'support_touches', 'resistance_touches'],
      'Volume usually contracts inside the range; breakout volume decides the trade direction.',
      'A decisive close outside the range changes the pattern from range to breakout/breakdown.',
      'Common in NSE/BSE consolidation phases before earnings, policy events, or sector rotation.',
    ),
    structureDefinition(
      'chart_ascending_triangle',
      'Ascending Triangle',
      'bullish',
      'high',
      'Flat resistance with rising lows, confirmed by an upside breakout.',
      'Flat high zone + rising low pivots + close above resistance.',
      ['resistance', 'support_slope', 'resistance_touches'],
      'Breakout volume should expand above the recent average.',
      'Failure back below the breakout level weakens the bullish continuation thesis.',
      'Works well in liquid NSE stocks where repeated supply gets absorbed before breakout.',
    ),
    structureDefinition(
      'chart_descending_triangle',
      'Descending Triangle',
      'bearish',
      'high',
      'Flat support with falling highs, confirmed by a downside breakdown.',
      'Flat low zone + falling high pivots + close below support.',
      ['support', 'resistance_slope', 'support_touches'],
      'Breakdown volume should expand above the recent average.',
      'Failure back above support weakens the bearish continuation thesis.',
      'Useful for distribution structures in weak sectors or index breakdown phases.',
    ),
    structureDefinition(
      'chart_symmetrical_triangle',
      'Symmetrical Triangle',
      'neutral',
      'medium',
      'Converging lower highs and higher lows, confirmed by directional breakout.',
      'Falling high pivots + rising low pivots + close outside the latest pivot boundary.',
      ['upper_level', 'lower_level', 'high_slope', 'low_slope'],
      'Volume should contract during compression and expand on breakout.',
      'A failed breakout back into the triangle invalidates the signal.',
      'Common before major NSE/BSE event resolution; direction should come from the breakout.',
    ),
    structureDefinition(
      'chart_falling_wedge_bottom',
      'Falling Wedge (Bottom)',
      'bullish',
      'high',
      'Downward converging wedge that confirms with an upside breakout.',
      'Falling highs and falling lows converge, then close breaks above the upper level.',
      ['upper_level', 'lower_level', 'high_slope', 'low_slope', 'range_ratio'],
      'Breakout volume improves confidence after the contracting wedge.',
      'A close back inside the wedge weakens the reversal.',
      'Useful after NSE/BSE corrections where selling pressure contracts before reversal.',
    ),
    structureDefinition(
      'chart_rising_wedge_top',
      'Rising Wedge (Top)',
      'bearish',
      'high',
      'Upward converging wedge that confirms with a downside breakdown.',
      'Rising highs and rising lows converge, then close breaks below the lower level.',
      ['upper_level', 'lower_level', 'high_slope', 'low_slope', 'range_ratio'],
      'Breakdown volume improves confidence after the contracting wedge.',
      'A close back inside the wedge weakens the bearish setup.',
      'Useful after NSE/BSE rallies where upward progress narrows before distribution.',
    ),
    structureDefinition(
      'chart_diamond_bottom',
      'Diamond Bottom',
      'bullish',
      'medium',
      'Volatility expands then contracts into a diamond base and breaks upward.',
      'Expansion phase + contraction phase + close above final resistance.',
      ['support', 'resistance', 'middle_width', 'final_width'],
      'Breakout volume improves confidence because diamond bases can whipsaw.',
      'A failed breakout back into the diamond weakens the setup.',
      'Rare but useful around NSE/BSE exhaustion bottoms after volatile news phases.',
    ),
    structureDefinition(
      'chart_diamond_top',
      'Diamond Top',
      'bearish',
      'medium',
      'Volatility expands then contracts into a diamond top and breaks downward.',
      'Expansion phase + contraction phase + close below final support.',
      ['support', 'resistance', 'middle_width', 'final_width'],
      'Breakdown volume improves confidence because diamond tops can whipsaw.',
      'A failed breakdown back into the diamond weakens the setup.',
      'Rare distribution pattern after volatile NSE/BSE advances.',
    ),
    structureDefinition(
      'chart_diamond_pattern',
      'Diamond Pattern',
      'neutral',
      'medium',
      'Diamond volatility shape without a confirmed breakout yet.',
      'Recent width expands into the middle of the base and contracts near the end.',
      ['support', 'resistance', 'middle_width', 'final_width'],
      'Volume often expands in the widening half and contracts in the narrowing half.',
      'A decisive close outside the diamond turns this into a directional signal.',
      'Useful as a watchlist pattern before event resolution in volatile NSE/BSE names.',
    ),
    structureDefinition(
      'chart_broadening_bottom',
      'Broadening Bottom',
      'bullish',
      'medium',
      'Expanding swings form a volatile bottom and confirm with upside breakout.',
      'Higher highs and lower lows expand, then close breaks above resistance.',
      ['support', 'resistance', 'high_slope', 'low_slope', 'range_ratio'],
      'Breakout volume improves confidence after the expanding base.',
      'A close back inside the formation weakens the bullish reversal.',
      'Useful for volatile NSE/BSE bottoms where panic swings widen before recovery.',
    ),
    structureDefinition(
      'chart_broadening_formation',
      'Broadening Formation',
      'neutral',
      'medium',
      'Higher highs and lower lows create an expanding bilateral pattern.',
      'Recent highs slope up while lows slope down and price remains inside the formation.',
      ['support', 'resistance', 'high_slope', 'low_slope', 'range_ratio'],
      'Volume confirmation depends on the eventual breakout direction.',
      'A confirmed close outside the range changes the scanner interpretation.',
      'Useful for choppy NSE/BSE phases with widening disagreement before a directional move.',
    ),
    structureDefinition(
      'chart_rising_three_methods',
      'Rising Three Methods',
      'bullish',
      'medium',
      'Bullish continuation where three small pullback bars hold inside a long bullish candle.',
      'Long bullish candle + three small contained bars + final bullish breakout.',
      ['first_high', 'first_low', 'breakout_close'],
      'Continuation volume should improve on the final breakout bar.',
      'A close below the first candle low invalidates the continuation setup.',
      'Useful as an EOD continuation filter in liquid NSE/BSE trends.',
    ),
    structureDefinition(
      'chart_falling_three_methods',
      'Falling Three Methods',
      'bearish',
      'medium',
      'Bearish continuation where three small recovery bars hold inside a long bearish candle.',
      'Long bearish candle + three small contained bars + final bearish breakdown.',
      ['first_high', 'first_low', 'breakdown_close'],
      'Continuation volume should improve on the final breakdown bar.',
      'A close above the first candle high invalidates the continuation setup.',
      'Useful as an EOD continuation filter in weak NSE/BSE downtrends.',
    ),
    structureDefinition(
      'chart_mat_hold_bullish',
      'Mat Hold (Bullish)',
      'bullish',
      'medium',
      'Bullish continuation where a strong advance holds a shallow mat before breaking higher.',
      'Long bullish candle + shallow contained consolidation + final bullish breakout.',
      ['breakout_level', 'hold_level'],
      'Breakout volume should expand after the shallow hold.',
      'A close below the hold level weakens continuation.',
      'Useful for strong NSE/BSE momentum leaders that pause without deep pullback.',
    ),
    structureDefinition(
      'chart_mat_hold_bearish',
      'Mat Hold (Bearish)',
      'bearish',
      'medium',
      'Bearish continuation where a strong decline holds a shallow mat before breaking lower.',
      'Long bearish candle + shallow contained consolidation + final bearish breakdown.',
      ['breakdown_level', 'hold_level'],
      'Breakdown volume should expand after the shallow hold.',
      'A close above the hold level weakens continuation.',
      'Useful for persistent NSE/BSE downtrends where relief bounces stay shallow.',
    ),
    structureDefinition(
      'chart_bull_flag',
      'Bull Flag',
      'bullish',
      'high',
      'Sharp bullish pole followed by a shallow downward flag and upside breakout.',
      'Prior bullish pole + downward consolidation + close above flag high.',
      ['pole_move_pct', 'breakout_level', 'consolidation_slope'],
      'Volume should expand on the pole, contract in the flag, and expand again on breakout.',
      'Failure back into the flag or below flag support weakens the continuation thesis.',
      'High-probability continuation in liquid NSE names after strong institutional buying.',
    ),
    structureDefinition(
      'chart_bear_flag',
      'Bear Flag',
      'bearish',
      'high',
      'Sharp bearish pole followed by a shallow upward flag and downside breakdown.',
      'Prior bearish pole + upward consolidation + close below flag low.',
      ['pole_move_pct', 'breakout_level', 'consolidation_slope'],
      'Volume should expand on the pole, contract in the flag, and expand again on breakdown.',
      'Failure back into the flag or above flag resistance weakens the continuation thesis.',
      'Common continuation setup during sector distribution or index downtrends.',
    ),
    structureDefinition(
      'chart_bull_pennant',
      'Bull Pennant',
      'bullish',
      'high',
      'Sharp bullish pole followed by converging compression and upside breakout.',
      'Prior bullish pole + falling highs/rising lows + close above pennant high.',
      ['pole_move_pct', 'upper_level', 'high_slope', 'low_slope'],
      'Volume contraction through the pennant and expansion on breakout improves confidence.',
      'A failed breakout back into compression invalidates the signal.',
      'Useful after sharp NSE momentum bursts where price compresses before continuation.',
    ),
    structureDefinition(
      'chart_bear_pennant',
      'Bear Pennant',
      'bearish',
      'high',
      'Sharp bearish pole followed by converging compression and downside breakdown.',
      'Prior bearish pole + falling highs/rising lows + close below pennant low.',
      ['pole_move_pct', 'lower_level', 'high_slope', 'low_slope'],
      'Volume contraction through the pennant and expansion on breakdown improves confidence.',
      'A failed breakdown back into compression invalidates the signal.',
      'Useful after sharp NSE selloffs where price compresses before continuation.',
    ),
    structureDefinition(
      'chart_rising_channel',
      'Rising Channel',
      'bullish',
      'medium',
      'Parallel rising highs and lows define an active upward channel.',
      'High and low regression slopes are positive and broadly parallel.',
      ['high_slope', 'low_slope', 'channel_support', 'channel_resistance'],
      'Volume is secondary; trend quality and channel respect matter more.',
      'A decisive close below channel support invalidates the channel.',
      'Useful for trend-following pullback scans in NSE/BSE liquid stocks.',
    ),
    structureDefinition(
      'chart_falling_channel',
      'Falling Channel',
      'bearish',
      'medium',
      'Parallel falling highs and lows define an active downward channel.',
      'High and low regression slopes are negative and broadly parallel.',
      ['high_slope', 'low_slope', 'channel_support', 'channel_resistance'],
      'Volume is secondary; trend quality and channel respect matter more.',
      'A decisive close above channel resistance invalidates the channel.',
      'Useful for downtrend continuation and short-covering watchlists in weak sectors.',
    ),
    structureDefinition(
      'chart_high_tight_flag',
      'High Tight Flag',
      'bullish',
      'high',
      'Very large rally followed by a controlled shallow flag and upside breakout.',
      'Rally >= 100%, pullback 10-35%, then close above pullback high.',
      ['rally_pct', 'pullback_pct', 'breakout_level'],
      'Volume should expand during the rally and re-expand on breakout.',
      'A deep pullback or failed breakout invalidates the high-tight character.',
      'Rare but important in exceptional NSE/BSE momentum leaders.',
    ),
    structureDefinition(
      'chart_coil_volatility_squeeze',
      'Coil / Volatility Squeeze',
      'neutral',
      'medium',
      'Successively contracting candle ranges indicate volatility compression.',
      'Recent ranges contract materially and price remains inside compression bounds.',
      ['first_range', 'latest_range', 'range_ratio'],
      'Volume often contracts during the coil; breakout volume determines direction.',
      'A breakout before compression completes changes this into a directional setup.',
      'Useful before NSE/BSE event moves, results, and index range compression.',
    ),
    structureDefinition(
      'chart_three_rising_valleys',
      'Three Rising Valleys',
      'bullish',
      'high',
      'Three successive higher low pivots confirm rising demand.',
      'Three rising low pivots + close above intervening resistance.',
      ['first_low', 'second_low', 'third_low', 'breakout_level'],
      'Breakout volume improves confidence after the third valley.',
      'A close below the third valley weakens the higher-low thesis.',
      'Useful for trend continuation and accumulation screens in NSE/BSE stocks.',
    ),
    structureDefinition(
      'chart_three_falling_peaks',
      'Three Falling Peaks',
      'bearish',
      'high',
      'Three successive lower high pivots confirm falling supply pressure.',
      'Three falling high pivots + close below intervening support.',
      ['first_high', 'second_high', 'third_high', 'breakdown_level'],
      'Breakdown volume improves confidence after the third peak.',
      'A close above the third peak weakens the lower-high thesis.',
      'Useful for distribution and downtrend continuation screens.',
    ),
    structureDefinition(
      'chart_measured_move_up',
      'Measured Move Up',
      'bullish',
      'medium',
      'Two similar bullish legs separated by a correction.',
      'First advance + correction + second advance of similar size.',
      ['first_leg_pct', 'second_leg_pct', 'leg_ratio'],
      'Volume should support both advance legs.',
      'A second leg that stalls far short of the first leg weakens the measured move.',
      'Useful for projecting continuation targets in trending NSE/BSE stocks.',
    ),
    structureDefinition(
      'chart_measured_move_down',
      'Measured Move Down',
      'bearish',
      'medium',
      'Two similar bearish legs separated by a relief rally.',
      'First decline + correction + second decline of similar size.',
      ['first_leg_pct', 'second_leg_pct', 'leg_ratio'],
      'Volume should support both decline legs.',
      'A second leg that stalls far short of the first leg weakens the measured move.',
      'Useful for projecting downside continuation in weak sectors.',
    ),
  ];
}

function createComplexBaseDefinitions(): ScannerDefinition[] {
  return [
    complexBaseDefinition(
      'chart_head_shoulders',
      'Head & Shoulders',
      'bearish',
      'high',
      'Classic three-peak top with head above both shoulders and neckline breakdown.',
      'High-low-high-low-high structure + neckline break below intervening lows.',
      ['left_shoulder', 'head', 'right_shoulder', 'neckline'],
      'Volume often fades into the right shoulder and expands on neckline breakdown.',
      'A close back above the right shoulder weakens the bearish top.',
      'Important NSE/BSE top reversal pattern, especially on daily and weekly index charts.',
    ),
    complexBaseDefinition(
      'chart_inverse_head_shoulders',
      'Inv. Head & Shoulders',
      'bullish',
      'high',
      'Classic three-trough bottom with head below both shoulders and neckline breakout.',
      'Low-high-low-high-low structure + neckline break above intervening highs.',
      ['left_shoulder', 'head', 'right_shoulder', 'neckline'],
      'Volume should expand on neckline breakout for better confirmation.',
      'A close back below the right shoulder weakens the bullish bottom.',
      'Reliable NSE/BSE bottom reversal when neckline aligns with visible resistance.',
    ),
    complexBaseDefinition(
      'chart_complex_head_shoulders',
      'Complex H&S',
      'neutral',
      'medium',
      'Multi-shoulder head-and-shoulders structure with final neckline break.',
      'Five comparable shoulder/head pivots + neckline break in the confirmed direction.',
      ['head', 'neckline', 'pivot_count'],
      'Breakout or breakdown volume improves confidence because complex structures can whipsaw.',
      'A close back inside the neckline after confirmation weakens the setup.',
      'Useful for messy NSE/BSE tops or bottoms where multiple shoulders form around one head.',
      'neutral-bilateral',
    ),
    complexBaseDefinition(
      'chart_cup_handle',
      'Cup and Handle',
      'bullish',
      'high',
      'Rounded base returns near its rim, forms a shallow handle, then breaks out.',
      'Rounded cup + handle pullback <= 35% + close above rim.',
      ['rim_level', 'cup_low', 'handle_pullback_pct'],
      'Volume should contract through the cup/handle and expand on breakout.',
      'A handle deeper than roughly one-third of the cup weakens the setup.',
      'O Neil-style base useful in liquid NSE leaders and 52-week breakout scans.',
    ),
    complexBaseDefinition(
      'chart_inverted_cup_handle',
      'Inverted Cup & Handle',
      'bearish',
      'medium',
      'Rounded top returns near its lower rim, forms a handle bounce, then breaks down.',
      'Inverted rounded cup + shallow handle bounce + close below rim.',
      ['rim_level', 'cup_high', 'handle_pullback_pct'],
      'Volume expansion on breakdown improves bearish confirmation.',
      'A recovery above the handle high weakens the setup.',
      'Useful for distribution bases after long NSE/BSE advances.',
    ),
    complexBaseDefinition(
      'chart_rounding_bottom',
      'Rounding Bottom',
      'bullish',
      'high',
      'Gradual U-shaped base that recovers above its rim area.',
      'Left decline + rounded low + right recovery + close above rim.',
      ['rim_level', 'bowl_low'],
      'Volume ideally contracts into the bowl and expands on recovery.',
      'A V-shaped move or failure above the rim weakens the rounded-base thesis.',
      'Common in midcap NSE/BSE recoveries after multi-month corrections.',
    ),
    complexBaseDefinition(
      'chart_rounding_top',
      'Rounding Top (Arch)',
      'bearish',
      'high',
      'Gradual arch-shaped distribution that breaks below its rim area.',
      'Left rise + rounded high + right decline + close below rim.',
      ['rim_level', 'arch_high'],
      'Volume often fades into the arch and expands on breakdown.',
      'A sharp V-top or recovery above the arch weakens the rounded-top interpretation.',
      'Useful for slow distribution in indexes and large-cap NSE/BSE names.',
    ),
    complexBaseDefinition(
      'chart_adam_eve_bottom',
      'Adam & Eve Bottom',
      'bullish',
      'medium',
      'Sharp first low followed by a wider rounded second low and neckline breakout.',
      'V-shaped Adam low + rounded Eve low + close above intervening neckline.',
      ['adam_low', 'eve_low', 'neckline'],
      'Breakout volume improves confidence after the rounded second low.',
      'A close below the Eve low weakens the base.',
      'Useful for panic-low then retest recoveries in volatile NSE/BSE stocks.',
    ),
    complexBaseDefinition(
      'chart_adam_eve_top',
      'Adam & Eve Top',
      'bearish',
      'medium',
      'Sharp first high followed by a wider rounded second high and support breakdown.',
      'V-shaped Adam high + rounded Eve high + close below intervening support.',
      ['adam_high', 'eve_high', 'support'],
      'Breakdown volume improves confidence after the rounded second high.',
      'A close above the Eve high weakens the top.',
      'Useful for exhaustion spike then distribution retest setups.',
    ),
    complexBaseDefinition(
      'chart_scallop_handle',
      'Scallop & Handle',
      'bullish',
      'medium',
      'Rising rounded continuation base followed by a shallow handle breakout.',
      'Rounded rising scallop + shallow handle pullback + close above handle high.',
      ['scallop_low', 'right_rim', 'advance_pct', 'handle_pullback_pct'],
      'Volume should contract during the handle and expand on breakout.',
      'A deep handle or close below the scallop midpoint weakens continuation.',
      'Useful for steady NSE/BSE continuation bases after earlier accumulation.',
      'continuation',
    ),
  ];
}

function reversalDefinition(
  id: string,
  name: string,
  signalDirection: NonNullable<ScannerResult['direction']>,
  reliability: 'medium' | 'high',
  description: string,
  logicText: string,
  suggestedOutputColumns: string[],
  volumeConfirmation: string,
  failureCondition: string,
  indiaContext: string,
): ScannerDefinition {
  return {
    id,
    name,
    categoryId: CHART_REVERSAL_CATEGORY_ID,
    categoryName: CHART_REVERSAL_CATEGORY_NAME,
    priority: 1,
    scannerType: 'pattern',
    description,
    logicText,
    requiredData: ['ohlcv'],
    suggestedOutputColumns,
    chartPattern: {
      family: 'reversal',
      signalDirection,
      reliability,
      timeframeReliability: { intraday: 1, daily: 3, weekly: 3 },
      volumeConfirmation,
      failureCondition,
      indiaContext,
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    limitations: 'First implementation uses deterministic pivot/level rules and does not draw the pattern on chart.',
    implementationStatus: 'ready_for_engine',
  };
}

function structureDefinition(
  id: string,
  name: string,
  signalDirection: NonNullable<ScannerResult['direction']>,
  reliability: 'medium' | 'high',
  description: string,
  logicText: string,
  suggestedOutputColumns: string[],
  volumeConfirmation: string,
  failureCondition: string,
  indiaContext: string,
): ScannerDefinition {
  return {
    id,
    name,
    categoryId: CHART_STRUCTURE_CATEGORY_ID,
    categoryName: CHART_STRUCTURE_CATEGORY_NAME,
    priority: 1,
    scannerType: 'pattern',
    description,
    logicText,
    requiredData: ['ohlcv'],
    suggestedOutputColumns,
    chartPattern: {
      family: signalDirection === 'neutral' ? 'neutral-bilateral' : 'continuation',
      signalDirection,
      reliability,
      timeframeReliability: { intraday: 1, daily: 3, weekly: 3 },
      volumeConfirmation,
      failureCondition,
      indiaContext,
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    limitations: 'First implementation uses deterministic pivot/level rules and does not draw the pattern on chart.',
    implementationStatus: 'ready_for_engine',
  };
}

function complexBaseDefinition(
  id: string,
  name: string,
  signalDirection: NonNullable<ScannerResult['direction']>,
  reliability: 'medium' | 'high',
  description: string,
  logicText: string,
  suggestedOutputColumns: string[],
  volumeConfirmation: string,
  failureCondition: string,
  indiaContext: string,
  family: ChartPatternFamily = 'reversal',
): ScannerDefinition {
  return {
    id,
    name,
    categoryId: CHART_COMPLEX_CATEGORY_ID,
    categoryName: CHART_COMPLEX_CATEGORY_NAME,
    priority: 1,
    scannerType: 'pattern',
    description,
    logicText,
    requiredData: ['ohlcv'],
    suggestedOutputColumns,
    chartPattern: {
      family,
      signalDirection,
      reliability,
      timeframeReliability: { intraday: 1, daily: 3, weekly: 3 },
      volumeConfirmation,
      failureCondition,
      indiaContext,
    },
    eodSafetyNotes: 'Uses completed daily bars only.',
    limitations: 'First implementation uses deterministic pivot/shape rules and does not draw the pattern on chart.',
    implementationStatus: 'ready_for_engine',
  };
}

function latestComparablePivotSetup(
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
  if (!pivotsComparable(pivots, 3)) return null;
  if (!pivotsHaveSpacing(pivots, 3)) return null;
  if (pivots[pivots.length - 1].index - pivots[0].index > 140) return null;

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

function latestVReversalSetup(
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

function latestHornSetup(
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

function latestRangeSetup(
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

function latestTriangleSetup(
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
  } else {
    if (highPivots.length < 2) return null;
    if (supportTouches < 2 || highSlope >= 0) return null;
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

function latestSymmetricalTriangleSetup(
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

function buildAscendingTriangleGeometry(
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
        extendRight: true,
      },
      {
        id: 'rising-support',
        label: 'Rising lows',
        role: 'lower',
        start: pivotToGeometryPoint(firstLowPivot),
        end: pivotToGeometryPoint(lastLowPivot),
        extendRight: true,
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

function buildDescendingTriangleGeometry(
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
        extendRight: true,
      },
      {
        id: 'support',
        label: 'Support',
        role: 'support',
        start: { date: firstBar.date, price: setup.support },
        end: { date: lastBar.date, price: setup.support },
        extendRight: true,
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

function buildSymmetricalTriangleGeometry(
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
        extendRight: true,
      },
      {
        id: 'rising-support',
        label: 'Rising lows',
        role: 'lower',
        start: pivotToGeometryPoint(firstLowPivot),
        end: pivotToGeometryPoint(lastLowPivot),
        extendRight: true,
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

function buildDoubleReversalGeometry(
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

function buildTripleReversalGeometry(
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

function buildRangeGeometry(
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

function buildCoilGeometry(
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

function buildHighTightFlagGeometry(
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

function buildThreeMethodsGeometry(
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

function buildMatHoldGeometry(
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

function buildScallopHandleGeometry(
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

function buildThreePivotGeometry(
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

function buildMeasuredMoveGeometry(
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

function buildVReversalGeometry(
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

function buildCupHandleGeometry(
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

function buildRoundingGeometry(
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

function buildAdamEveGeometry(
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

function buildHornGeometry(
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

function buildBumpRunGeometry(
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

function buildBlowOffGeometry(
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

function buildDiamondGeometry(
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

function buildBroadeningGeometry(
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

function buildComplexHeadShouldersGeometry(
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

function buildHeadShouldersGeometry(
  setup: NonNullable<ReturnType<typeof latestHeadShouldersSetup>>,
  patternLabel: string,
  latestDate: string,
): ChartPatternGeometry {
  const markers = [
    { id: 'left-shoulder', label: 'LS', pivot: setup.leftShoulder },
    { id: 'head', label: 'H', pivot: setup.head },
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
    trendLines: [
      {
        id: 'neckline',
        label: 'Neckline',
        role: 'neckline',
        start: {
          date: setup.leftShoulder.date,
          price: setup.neckline,
        },
        end: {
          date: latestDate,
          price: setup.neckline,
        },
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

function buildWedgeGeometry(
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
        extendRight: true,
      },
      {
        id: 'lower-boundary',
        label: 'Lower wedge boundary',
        role: 'lower',
        start: { date: lowerStart.date, price: lowerStart.price },
        end: { date: lowerEnd.date, price: lowerEnd.price },
        extendRight: true,
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

function buildContinuationGeometry(
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

function buildSingleGapGeometry(
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

function buildIslandGeometry(
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

function latestWedgeSetup(
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

function latestDiamondSetup(
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

function latestBroadeningSetup(
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

function latestBumpRunSetup(
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

function latestBlowOffTopSetup(
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

function latestThreeMethodsSetup(
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

function latestMatHoldSetup(
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

function latestContinuationSetup(
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

function latestChannelSetup(
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

  const slopeRatio = Math.abs(highSlope / lowSlope);
  if (!Number.isFinite(slopeRatio) || slopeRatio < 0.4 || slopeRatio > 2.5) return null;
  const support = projectedPivotLinePrice(supportPivots[0], supportPivots[1], baseBars.length);
  const resistance = projectedPivotLinePrice(resistancePivots[0], resistancePivots[1], baseBars.length);
  if (resistance <= support) return null;
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

function buildChannelGeometry(
  setup: NonNullable<ReturnType<typeof latestChannelSetup>>,
  direction: 'rising' | 'falling',
): ChartPatternGeometry {
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

function projectedPivotLinePrice(
  first: ChartPatternPivot,
  second: ChartPatternPivot,
  targetIndex: number,
): number {
  return first.price + pivotSlope(first, second) * (targetIndex - first.index);
}

function latestHighTightFlagSetup(
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

function latestCoilSetup(
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

function latestThreePivotSetup(
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

function latestMeasuredMoveSetup(
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

function latestHeadShouldersSetup(
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
  if (neckline <= 0 || latest.close <= neckline) return null;
  return { leftShoulder, trough1, head, trough2, rightShoulder, neckline };
}

function latestCupHandleSetup(
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

function latestRoundingSetup(
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
    if (latest.close <= rimLevel) return null;
    return { patternBars, rimLevel, extreme: bowlLow };
  }

  const archHigh = highestHigh(middle);
  if (archHigh === null) return null;
  const rimLevel = round((leftAvg + rightAvg) / 2, 4);
  if ((archHigh - rimLevel) / rimLevel < 0.12) return null;
  if (latest.close >= rimLevel) return null;
  return { patternBars, rimLevel, extreme: archHigh };
}

function latestAdamEveSetup(
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

function latestScallopHandleSetup(
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

function latestComplexHeadShouldersSetup(
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

function averageClose(bars: EodBar[]): number {
  return bars.reduce((sum, bar) => sum + bar.close, 0) / bars.length;
}

function averageSegmentRange(bars: EodBar[]): number {
  if (bars.length === 0) return 0;
  return bars.reduce((sum, bar) => sum + candleRange(bar), 0) / bars.length;
}

function segmentWidth(bars: EodBar[]): number | null {
  const high = highestHigh(bars);
  const low = lowestLow(bars);
  if (high === null || low === null) return null;
  return high - low;
}

function isLongDirectionalCandle(bar: EodBar, direction: 'bullish' | 'bearish'): boolean {
  const range = candleRange(bar);
  const body = Math.abs(bar.close - bar.open);
  if (range <= 0 || body / range < 0.55) return false;
  return direction === 'bullish' ? bar.close > bar.open : bar.close < bar.open;
}

function isSharpPivot(
  bars: EodBar[],
  pivot: ChartPatternPivot,
  kind: 'bottom' | 'top',
): boolean {
  const previous = bars[pivot.index - 1];
  const next = bars[pivot.index + 1];
  if (!previous || !next || pivot.price <= 0) return false;
  if (kind === 'bottom') {
    return previous.low > pivot.price * 1.07 && next.low > pivot.price * 1.07;
  }
  return previous.high < pivot.price * 0.93 && next.high < pivot.price * 0.93;
}

function isRoundedPivot(
  bars: EodBar[],
  pivot: ChartPatternPivot,
  kind: 'bottom' | 'top',
): boolean {
  if (pivot.price <= 0) return false;
  const window = bars.slice(Math.max(0, pivot.index - 2), pivot.index + 3);
  if (window.length < 5) return false;
  if (kind === 'bottom') {
    return window.filter((bar) => bar.low <= pivot.price * 1.08).length >= 3;
  }
  return window.filter((bar) => bar.high >= pivot.price * 0.92).length >= 3;
}

function countTouches(bars: EodBar[], field: 'high' | 'low', level: number, tolerancePct: number): number {
  return bars.filter((bar) => {
    const value = bar[field];
    if (level <= 0) return false;
    return (Math.abs(value - level) / level) * 100 <= tolerancePct;
  }).length;
}

function pivotsComparable(pivots: Array<{ price: number }>, tolerancePct: number = LEVEL_TOLERANCE_PCT): boolean {
  return pricesComparable(pivots.map((pivot) => pivot.price), tolerancePct);
}

function pricesComparable(prices: number[], tolerancePct: number): boolean {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const midpoint = (min + max) / 2;
  return midpoint > 0 && ((max - min) / midpoint) * 100 <= tolerancePct;
}

function pivotsHaveSpacing(pivots: Array<{ index: number }>, minSpacing: number): boolean {
  return pivots.every((pivot, index) => index === 0 || pivot.index - pivots[index - 1].index >= minSpacing);
}

function averagePivotPrice(pivots: Array<{ price: number }>): number {
  return pivots.reduce((sum, pivot) => sum + pivot.price, 0) / pivots.length;
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

function indexOfLowestLow(bars: EodBar[]): number {
  return bars.reduce((bestIndex, bar, index) => (bar.low < bars[bestIndex].low ? index : bestIndex), 0);
}

function indexOfHighestHigh(bars: EodBar[]): number {
  return bars.reduce((bestIndex, bar, index) => (bar.high > bars[bestIndex].high ? index : bestIndex), 0);
}

function createChartPatternResult(
  context: ScannerContext,
  definition: ScannerDefinition,
  direction: ScannerResult['direction'],
  confidence: number,
  reasons: string[],
  values: ScannerResult['values'],
  details: Partial<NonNullable<ScannerResult['chartPattern']>>,
): ScannerResult {
  const latest = context.bars[context.bars.length - 1];
  return {
    symbol: context.symbol,
    exchange: context.exchange,
    scannerId: definition.id,
    scannerName: definition.name,
    categoryId: definition.categoryId,
    categoryName: definition.categoryName,
    date: latest.date,
    matched: true,
    direction,
    score: confidence,
    reasons,
    values,
    chartPattern: {
      family: definition.chartPattern?.family ?? 'gap',
      confidence,
      patternEndDate: latest.date,
      ...details,
    },
    warnings: [],
    source: 'EODChartPatternScanner_v1',
    generatedAt: new Date().toISOString(),
  };
}
