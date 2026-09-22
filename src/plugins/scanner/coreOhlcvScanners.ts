import type {
  EodBar,
  ScannerContext,
  ScannerDefinition,
  ScannerHandler,
  ScannerResult,
} from '@/plugins/scanner/types';

const CORE_SCANNER_DEFINITIONS: ScannerDefinition[] = [
  {
    id: 'prev_day_high_break',
    name: 'Previous Day High Break',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'breakout',
    description: 'Close above yesterday high.',
    logicText: 'Close > High[1]',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'prev_high', 'high_diff'],
    eodSafetyNotes: 'Uses confirmed EOD close.',
    limitations: 'High frequency of false breaks without volume confirmation.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'prev_day_low_break',
    name: 'Previous Day Low Break',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'breakdown',
    description: 'Close below yesterday low.',
    logicText: 'Close < Low[1]',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'prev_low', 'low_diff'],
    eodSafetyNotes: 'Uses confirmed EOD close.',
    limitations: 'May need trend or volume confirmation.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'inside_bar',
    name: 'Inside Bar',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'pattern',
    description: 'Today range is inside the previous candle.',
    logicText: 'High < High[1] AND Low > Low[1]',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['high', 'prev_high', 'low', 'prev_low', 'range_ratio'],
    eodSafetyNotes: 'Calculated on completed candles.',
    limitations: 'Indicates consolidation; requires breakout direction for action.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'outside_bar',
    name: 'Outside Bar',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'pattern',
    description: 'Today range engulfs the previous candle.',
    logicText: 'High > High[1] AND Low < Low[1]',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['high', 'prev_high', 'low', 'prev_low'],
    eodSafetyNotes: 'Calculated on completed candles.',
    limitations: 'Direction depends on close context.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'close_near_high',
    name: 'Close Near High',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'breakout',
    description: 'Close is in the top 10% of the daily range.',
    logicText: 'Close >= High - 10% of range',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'high', 'low', 'clv'],
    eodSafetyNotes: 'Uses completed candle range.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'close_near_low',
    name: 'Close Near Low',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'breakdown',
    description: 'Close is in the bottom 10% of the daily range.',
    logicText: 'Close <= Low + 10% of range',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'high', 'low', 'clv'],
    eodSafetyNotes: 'Uses completed candle range.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'gap_up',
    name: 'Gap Up',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'gap',
    description: 'Today open is above yesterday high.',
    logicText: 'Open > High[1]',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['open', 'prev_high', 'gap_pct'],
    eodSafetyNotes: 'Uses completed EOD bars after the session closes.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'gap_down',
    name: 'Gap Down',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'gap',
    description: 'Today open is below yesterday low.',
    logicText: 'Open < Low[1]',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['open', 'prev_low', 'gap_pct'],
    eodSafetyNotes: 'Uses completed EOD bars after the session closes.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'nr7',
    name: 'NR7 (Narrow Range 7)',
    categoryId: 'price_action',
    categoryName: 'Price Action',
    priority: 1,
    scannerType: 'volatility',
    description: 'Narrowest range in 7 days.',
    logicText: '(High - Low) < Min(High[i] - Low[i], 6) where i is 1 to 6',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['range', 'prev_min_range'],
    eodSafetyNotes: 'Excludes current candle from the lookback min calculation.',
    limitations: 'Does not indicate direction.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'wide_range_candle',
    name: 'Wide Range Candle',
    categoryId: 'volatility',
    categoryName: 'Volatility',
    priority: 1,
    scannerType: 'volatility',
    description: 'Today range is materially wider than the recent average range.',
    logicText: '(High - Low) > 1.5 * Average(High - Low, 14)',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['range', 'avg_range_14', 'range_ratio'],
    eodSafetyNotes: 'Uses completed candle range.',
    implementationStatus: 'ready_for_engine',
  },
];

export const coreOhlcvScannerDefinitions = CORE_SCANNER_DEFINITIONS;

export const coreOhlcvScannerHandlers: Record<string, ScannerHandler> = {
  prev_day_high_break: (context, definition) => {
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, yesterday } = pair;
    if (today.close <= yesterday.high) return null;
    return createResult(context, definition, 'bullish', [`Close (${today.close}) broke above yesterday high (${yesterday.high})`], {
      close: today.close,
      prev_high: yesterday.high,
      high_diff: round(today.close - yesterday.high, 4),
    });
  },
  prev_day_low_break: (context, definition) => {
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, yesterday } = pair;
    if (today.close >= yesterday.low) return null;
    return createResult(context, definition, 'bearish', [`Close (${today.close}) broke below yesterday low (${yesterday.low})`], {
      close: today.close,
      prev_low: yesterday.low,
      low_diff: round(yesterday.low - today.close, 4),
    });
  },
  inside_bar: (context, definition) => {
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, yesterday } = pair;
    if (!(today.high < yesterday.high && today.low > yesterday.low)) return null;
    return createResult(context, definition, 'neutral', ['Today range is completely inside yesterday range'], {
      high: today.high,
      prev_high: yesterday.high,
      low: today.low,
      prev_low: yesterday.low,
      range_ratio: rangeRatio(context.bars, 10),
    });
  },
  outside_bar: (context, definition) => {
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, yesterday } = pair;
    if (!(today.high > yesterday.high && today.low < yesterday.low)) return null;
    return createResult(context, definition, 'neutral', ['Today range engulfs yesterday range'], {
      high: today.high,
      prev_high: yesterday.high,
      low: today.low,
      prev_low: yesterday.low,
    });
  },
  close_near_high: (context, definition) => {
    const today = latestBar(context.bars);
    if (!today || !isCloseNearHigh(today, 0.1)) return null;
    return createResult(context, definition, 'bullish', [`Close (${today.close}) is near the session high (${today.high})`], {
      close: today.close,
      high: today.high,
      low: today.low,
      clv: closeLocationValue(today),
    });
  },
  close_near_low: (context, definition) => {
    const today = latestBar(context.bars);
    if (!today || !isCloseNearLow(today, 0.1)) return null;
    return createResult(context, definition, 'bearish', [`Close (${today.close}) is near the session low (${today.low})`], {
      close: today.close,
      high: today.high,
      low: today.low,
      clv: closeLocationValue(today),
    });
  },
  gap_up: (context, definition) => {
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, yesterday } = pair;
    if (today.open <= yesterday.high) return null;
    return createResult(context, definition, 'bullish', [`Today opened at ${today.open}, gapping up above yesterday high (${yesterday.high})`], {
      open: today.open,
      prev_high: yesterday.high,
      gap_pct: round((today.open / yesterday.high - 1) * 100, 2),
    });
  },
  gap_down: (context, definition) => {
    const pair = latestPair(context.bars);
    if (!pair) return null;
    const { today, yesterday } = pair;
    if (today.open >= yesterday.low) return null;
    return createResult(context, definition, 'bearish', [`Today opened at ${today.open}, gapping down below yesterday low (${yesterday.low})`], {
      open: today.open,
      prev_low: yesterday.low,
      gap_pct: round((1 - today.open / yesterday.low) * 100, 2),
    });
  },
  nr7: (context, definition) => {
    if (context.bars.length < 7) return null;
    const today = latestBar(context.bars);
    if (!today) return null;
    const currentRange = candleRange(today);
    const priorRanges = context.bars.slice(-7, -1).map(candleRange);
    const prevMinRange = Math.min(...priorRanges);
    if (!(currentRange < prevMinRange)) return null;
    return createResult(context, definition, 'neutral', [`Today range (${currentRange.toFixed(4)}) is the narrowest in 7 days`], {
      range: round(currentRange, 4),
      prev_min_range: round(prevMinRange, 4),
    });
  },
  wide_range_candle: (context, definition) => {
    const period = 14;
    if (context.bars.length < period + 1) return null;
    const today = latestBar(context.bars);
    if (!today) return null;
    const currentRange = candleRange(today);
    const avgRange = averageRange(context.bars, period, true);
    if (avgRange === null || avgRange === 0 || currentRange <= 1.5 * avgRange) return null;
    return createResult(context, definition, 'neutral', [`Today range (${currentRange.toFixed(2)}) is wider than the 14-day average (${avgRange.toFixed(2)})`], {
      range: round(currentRange, 4),
      avg_range_14: round(avgRange, 4),
      range_ratio: round(currentRange / avgRange, 4),
    });
  },
};

export function runCoreScanner(context: ScannerContext, definition: ScannerDefinition): ScannerResult | null {
  return coreOhlcvScannerHandlers[definition.id]?.(context, definition) ?? null;
}

function latestBar(bars: EodBar[]): EodBar | null {
  return bars[bars.length - 1] ?? null;
}

function latestPair(bars: EodBar[]): { today: EodBar; yesterday: EodBar } | null {
  if (bars.length < 2) return null;
  return {
    today: bars[bars.length - 1],
    yesterday: bars[bars.length - 2],
  };
}

function candleRange(bar: EodBar): number {
  return Math.max(0, bar.high - bar.low);
}

function averageRange(bars: EodBar[], period: number, excludeCurrent: boolean): number | null {
  const source = excludeCurrent ? bars.slice(0, -1) : bars;
  if (source.length < period) return null;
  const window = source.slice(-period);
  return window.reduce((sum, bar) => sum + candleRange(bar), 0) / period;
}

function rangeRatio(bars: EodBar[], period: number): number | null {
  const today = latestBar(bars);
  const avgRange = averageRange(bars, period, true);
  if (!today || !avgRange) return null;
  return round(candleRange(today) / avgRange, 4);
}

function closeLocationValue(bar: EodBar): number | null {
  const range = candleRange(bar);
  if (range === 0) return null;
  return round((bar.close - bar.low) / range, 4);
}

function isCloseNearHigh(bar: EodBar, threshold: number): boolean {
  const range = candleRange(bar);
  return range > 0 && bar.close >= bar.high - range * threshold;
}

function isCloseNearLow(bar: EodBar, threshold: number): boolean {
  const range = candleRange(bar);
  return range > 0 && bar.close <= bar.low + range * threshold;
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
