import type { ScannerHandler } from '@/features/scanner/types';
import { averageVolume, gapDownPct, gapUpPct, hasUpTrend, highestHigh, isRangeBound, isVolumeSpike, lowestLow, round } from '@/features/chartPatterns/primitives';
import { MIN_GAP_PCT } from '@/features/chartPatterns/constants';
import { latestPair } from '@/features/chartPatterns/setups';
import { buildSingleGapGeometry, buildIslandGeometry } from '@/features/chartPatterns/geometry';
import { movePct, createChartPatternResult } from '@/features/chartPatterns/shared';

export const gapsHandlers: Record<string, ScannerHandler> = {
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
};
