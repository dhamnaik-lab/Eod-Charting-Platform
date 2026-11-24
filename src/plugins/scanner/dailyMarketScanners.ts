import type {
  EodBar,
  ScannerContext,
  ScannerDefinition,
  ScannerHandler,
  ScannerResult,
} from '@/plugins/scanner/types';

export interface DailyMarketMetrics {
  today: EodBar;
  yesterday: EodBar;
  absoluteChange: number;
  changePercent: number;
  averageVolume20: number | null;
  volumeRatio20: number | null;
}

export function calculateDailyMarketMetrics(
  bars: EodBar[],
): DailyMarketMetrics | null {
  if (bars.length < 2) return null;

  const today = bars[bars.length - 1];
  const yesterday = bars[bars.length - 2];

  if (
    !Number.isFinite(today.close) ||
    !Number.isFinite(yesterday.close) ||
    !Number.isFinite(today.volume) ||
    today.close <= 0 ||
    yesterday.close <= 0 ||
    today.volume < 0
  ) {
    return null;
  }

  const absoluteChange = today.close - yesterday.close;
  const changePercent = (absoluteChange / yesterday.close) * 100;

  if (
    !Number.isFinite(absoluteChange) ||
    !Number.isFinite(changePercent)
  ) {
    return null;
  }

  let averageVolume20: number | null = null;
  let volumeRatio20: number | null = null;

  if (bars.length >= 21) {
    const prior20 = bars.slice(-21, -1);

    if (
      prior20.length === 20 &&
      prior20.every(
        (bar) =>
          Number.isFinite(bar.volume) &&
          bar.volume >= 0,
      )
    ) {
      const total = prior20.reduce(
        (sum, bar) => sum + bar.volume,
        0,
      );

      averageVolume20 = total / 20;

      if (
        averageVolume20 > 0 &&
        Number.isFinite(averageVolume20)
      ) {
        volumeRatio20 = today.volume / averageVolume20;
      }
    }
  }

  return {
    today,
    yesterday,
    absoluteChange,
    changePercent,
    averageVolume20,
    volumeRatio20,
  };
}

const DAILY_MARKET_DEFINITIONS: ScannerDefinition[] = [
  {
    id: 'top_gainers',
    name: 'Top Gainers',
    categoryId: 'daily_market',
    categoryName: 'Daily Market',
    priority: 1,
    scannerType: 'breakout',
    description: 'Symbols closing with positive percentage gain.',
    logicText: '((Close - PrevClose) / PrevClose) * 100 > 0',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'change_pct', 'change_amt', 'volume'],
    eodSafetyNotes: 'Calculated on completed daily EOD bars.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'top_losers',
    name: 'Top Losers',
    categoryId: 'daily_market',
    categoryName: 'Daily Market',
    priority: 1,
    scannerType: 'breakdown',
    description: 'Symbols closing with negative percentage change.',
    logicText: '((Close - PrevClose) / PrevClose) * 100 < 0',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'change_pct', 'change_amt', 'volume'],
    eodSafetyNotes: 'Calculated on completed daily EOD bars.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'volume_surge',
    name: 'High Volume / Volume Surge',
    categoryId: 'daily_market',
    categoryName: 'Daily Market',
    priority: 1,
    scannerType: 'volatility',
    description: 'Today volume is at least 1.5x of the 20-day average volume.',
    logicText: 'Volume >= 1.5 * Average(Volume, 20)',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['volume', 'avg_volume_20', 'vol_ratio', 'change_pct'],
    eodSafetyNotes: 'Calculated on completed daily EOD bars.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'high_52w',
    name: '52-Week High',
    categoryId: 'daily_market',
    categoryName: 'Daily Market',
    priority: 1,
    scannerType: 'breakout',
    description: 'The session high matches the highest high in the trailing window.',
    logicText: 'High >= Max(High, up to 252 bars including the current bar)',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'high_52w', 'dist_52w_pct'],
    eodSafetyNotes: 'Requires at least 20 completed daily bars and uses up to 252.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'low_52w',
    name: '52-Week Low',
    categoryId: 'daily_market',
    categoryName: 'Daily Market',
    priority: 1,
    scannerType: 'breakdown',
    description: 'The session low matches the lowest low in the trailing window.',
    logicText: 'Low <= Min(Low, up to 252 bars including the current bar)',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'low_52w', 'dist_52w_pct'],
    eodSafetyNotes: 'Requires at least 20 completed daily bars and uses up to 252.',
    implementationStatus: 'ready_for_engine',
  },
];

export const dailyMarketScannerDefinitions = DAILY_MARKET_DEFINITIONS;

export const dailyMarketScannerHandlers: Record<string, ScannerHandler> = {
  top_gainers: (context, definition) => {
    const metrics = calculateDailyMarketMetrics(context.bars);
    if (!metrics || metrics.changePercent <= 0) return null;

    return createResult(
      context,
      definition,
      'bullish',
      [`Gained +${metrics.changePercent.toFixed(2)}% (+${metrics.absoluteChange.toFixed(2)})`],
      {
        close: metrics.today.close,
        prev_close: metrics.yesterday.close,
        change_pct: round(metrics.changePercent, 2),
        change_amt: round(metrics.absoluteChange, 2),
        volume: metrics.today.volume,
      },
    );
  },

  top_losers: (context, definition) => {
    const metrics = calculateDailyMarketMetrics(context.bars);
    if (!metrics || metrics.changePercent >= 0) return null;

    return createResult(
      context,
      definition,
      'bearish',
      [`Lost ${metrics.changePercent.toFixed(2)}% (${metrics.absoluteChange.toFixed(2)})`],
      {
        close: metrics.today.close,
        prev_close: metrics.yesterday.close,
        change_pct: round(metrics.changePercent, 2),
        change_amt: round(metrics.absoluteChange, 2),
        volume: metrics.today.volume,
      },
    );
  },

  volume_surge: (context, definition) => {
    const metrics = calculateDailyMarketMetrics(context.bars);
    if (!metrics || metrics.volumeRatio20 === null || metrics.volumeRatio20 < 1.5) return null;
    const direction = metrics.absoluteChange === 0 ? 'neutral' : metrics.absoluteChange > 0 ? 'bullish' : 'bearish';

    return createResult(
      context,
      definition,
      direction,
      [
        `Volume surge: ${metrics.volumeRatio20.toFixed(2)}x of 20-day average (${metrics.today.volume.toLocaleString('en-IN')} vs ${Math.round(metrics.averageVolume20!).toLocaleString('en-IN')})`,
      ],
      {
        volume: metrics.today.volume,
        avg_volume_20: round(metrics.averageVolume20!, 0),
        vol_ratio: round(metrics.volumeRatio20, 2),
        change_pct: round(metrics.changePercent, 2),
      },
    );
  },

  high_52w: (context, definition) => {
    const period = Math.min(252, context.bars.length);
    if (period < 20) return null;
    const today = latestBar(context.bars);
    if (!today) return null;
    const lookbackBars = context.bars.slice(-period);
    const maxHigh = Math.max(...lookbackBars.map((b) => b.high));

    if (today.high < maxHigh) return null;

    const metrics = calculateDailyMarketMetrics(context.bars);
    const changePct = metrics ? metrics.changePercent : 0;

    return createResult(
      context,
      definition,
      'bullish',
      [`Session high (${today.high}) hit the ${period}-bar (52-week) high of ${maxHigh}`],
      {
        close: today.close,
        high_52w: maxHigh,
        dist_52w_pct: round(((today.close - maxHigh) / maxHigh) * 100, 2),
        change_pct: round(changePct, 2),
      },
    );
  },

  low_52w: (context, definition) => {
    const period = Math.min(252, context.bars.length);
    if (period < 20) return null;
    const today = latestBar(context.bars);
    if (!today) return null;
    const lookbackBars = context.bars.slice(-period);
    const minLow = Math.min(...lookbackBars.map((b) => b.low));

    if (today.low > minLow) return null;

    const metrics = calculateDailyMarketMetrics(context.bars);
    const changePct = metrics ? metrics.changePercent : 0;

    return createResult(
      context,
      definition,
      'bearish',
      [`Session low (${today.low}) hit the ${period}-bar (52-week) low of ${minLow}`],
      {
        close: today.close,
        low_52w: minLow,
        dist_52w_pct: round(((today.close - minLow) / minLow) * 100, 2),
        change_pct: round(changePct, 2),
      },
    );
  },
};

export function runDailyMarketScanner(
  context: ScannerContext,
  definition: ScannerDefinition,
): ScannerResult | null {
  return dailyMarketScannerHandlers[definition.id]?.(context, definition) ?? null;
}

function latestBar(bars: EodBar[]): EodBar | null {
  return bars[bars.length - 1] ?? null;
}

function createResult(
  context: ScannerContext,
  definition: ScannerDefinition,
  direction: ScannerResult['direction'],
  reasons: string[],
  values: ScannerResult['values'],
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
    reasons,
    values,
    warnings: [],
    source: 'EODScannerPlugin_v1',
    generatedAt: new Date().toISOString(),
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
