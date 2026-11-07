import type { ChartIndicator } from '@/engine/types';
import {
  getIndicatorAlertOutputContractsByKind,
  type IndicatorAlertOutputContract,
} from '@/features/alerts/indicatorAlertContracts';

type IndicatorTemplate = ChartIndicator extends infer T
  ? T extends { id: string }
    ? Omit<T, 'id'>
    : never
  : never;

export type IndicatorSubcategory =
  | 'moving_averages'
  | 'bands_channels'
  | 'trend_following'
  | 'smart_money_patterns'
  | 'price_transforms'
  | 'momentum_oscillators'
  | 'volatility_risk'
  | 'trend_strength'
  | 'volume_flow';

export interface IndicatorSubcategoryMeta {
  id: IndicatorSubcategory;
  label: string;
  placement: 'overlay' | 'pane';
}

export const INDICATOR_SUBCATEGORIES: IndicatorSubcategoryMeta[] = [
  // Price Overlays
  { id: 'moving_averages', label: 'Moving Averages & Envelopes', placement: 'overlay' },
  { id: 'bands_channels', label: 'Bands & Channels', placement: 'overlay' },
  { id: 'trend_following', label: 'Trend Following & Stops', placement: 'overlay' },
  { id: 'smart_money_patterns', label: 'Smart Money, Levels & Patterns', placement: 'overlay' },
  { id: 'price_transforms', label: 'Price & Bar Transforms', placement: 'overlay' },
  // Oscillators & Panes
  { id: 'momentum_oscillators', label: 'Momentum Oscillators', placement: 'pane' },
  { id: 'volatility_risk', label: 'Volatility & Risk', placement: 'pane' },
  { id: 'trend_strength', label: 'Trend Strength & Direction', placement: 'pane' },
  { id: 'volume_flow', label: 'Volume & Money Flow', placement: 'pane' },
];

export function getIndicatorSubcategory(
  kind: ChartIndicator['kind'],
  placement?: ChartIndicator['placement'],
): IndicatorSubcategory {
  switch (kind) {
    // 1. Moving Averages (overlay)
    case 'SMA':
    case 'EMA':
    case 'WMA':
    case 'WEMA':
    case 'DEMA':
    case 'TEMA':
    case 'HMA':
    case 'ALMA':
    case 'KAMA':
    case 'VWAP':
    case 'AVWAP':
    case 'LSMA':
    case 'VWMA':
    case 'MCGINLEY':
    case 'ALLIGATOR':
    case 'MA_CROSS':
    case 'MA_RIBBON':
      return 'moving_averages';

    // 2. Bands & Channels (overlay)
    case 'BOLL':
    case 'KELTNER':
    case 'DONCHIAN':
    case 'ENVELOPE':
    case 'LINREG_CHANNEL':
    case 'SSL_CHANNEL':
    case 'RIPSTER_EMA_CLOUDS':
      return 'bands_channels';

    // 3. Trend Following & Trailing Stops (overlay)
    case 'SUPERTREND':
    case 'PSAR':
    case 'ICHIMOKU':
    case 'SUPERTREND_AI':
    case 'UT_BOT':
    case 'CHANDELIER_EXIT':
    case 'ALPHA_TREND':
    case 'HALF_TREND':
    case 'RANGE_FILTER_DW':
    case 'TRENDLINES_BREAKS':
    case 'CHANDE_KROLL':
    case 'VOLATILITY_STOP':
      return 'trend_following';

    // 4. Smart Money, Levels & Patterns (overlay)
    case 'PATTERN':
    case 'CPR':
    case 'AUTO_KEY_LEVELS':
    case 'AUTO_TREND':
    case 'FRACTALS':
    case 'ZIGZAG':
    case 'ORDER_BLOCKS':
    case 'FVG':
      return 'smart_money_patterns';

    // 5. Price & Bar Transforms (overlay)
    case 'AVGPRICE':
    case 'MEDPRICE':
    case 'TYPPRICE':
    case 'WCLPRICE':
    case 'TWAP':
      return 'price_transforms';

    // 6. Volatility & Risk (pane)
    case 'ATR':
    case 'HV':
    case 'STDEV':
    case 'RVI_VOL':
    case 'BB_WIDTH':
    case 'BB_PCT_B':
    case 'MASS_INDEX':
    case 'COPPOCK':
    case 'ULCER_INDEX':
    case 'CHOP':
    case 'CHOP_ZONE':
    case 'BBTREND':
    case 'CM_VIX_FIX':
      return 'volatility_risk';

    // 7. Trend Strength & Direction (pane)
    case 'ADX':
    case 'AROON':
    case 'VORTEX':
    case 'TREND_STRENGTH':
    case 'DONCHIAN_RIBBON':
      return 'trend_strength';

    // 8. Volume & Money Flow (pane)
    case 'OBV':
    case 'CMF':
    case 'MFI':
    case 'FORCE_INDEX':
    case 'VOL_OSC':
    case 'CHAIKIN_OSC':
    case 'KVO':
    case 'PVT':
    case 'EOM':
    case 'PVI':
    case 'NVI':
    case 'CVD':
    case 'VOLUME_DELTA':
    case 'RVOL':
    case 'UP_DOWN_VOL':
    case 'NET_VOLUME':
    case 'VFI':
      return 'volume_flow';

    // 9. Momentum Oscillators (pane)
    default:
      return placement === 'overlay' ? 'moving_averages' : 'momentum_oscillators';
  }
}

export interface IndicatorCatalogItem {
  id: string;
  kind: ChartIndicator['kind'];
  label: string;
  shortLabel: string;
  description: string;
  placement: ChartIndicator['placement'];
  group: 'trend' | 'volatility' | 'momentum' | 'volume' | 'community';
  subcategory?: IndicatorSubcategory;
  alertOutputs?: IndicatorAlertOutputContract[];
  indicator: IndicatorTemplate;
}

export const INDICATOR_CATALOG: IndicatorCatalogItem[] = [
  // ── Trend / Moving Averages ───────────────────────────────────────────────
  {
    id: 'sma',
    kind: 'SMA',
    label: 'Simple Moving Average',
    shortLabel: 'SMA',
    description: 'Classic moving average overlay for trend direction.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'SMA', placement: 'overlay', period: 20, color: '#4a9edd' },
  },
  {
    id: 'ema',
    kind: 'EMA',
    label: 'Exponential Moving Average',
    shortLabel: 'EMA',
    description: 'Faster moving average that reacts more quickly to price changes.',
    placement: 'overlay',
    group: 'trend',
    alertOutputs: getIndicatorAlertOutputContractsByKind('EMA'),
    indicator: { kind: 'EMA', placement: 'overlay', period: 21, color: '#26a69a' },
  },
  {
    id: 'wma',
    kind: 'WMA',
    label: 'Weighted Moving Average',
    shortLabel: 'WMA',
    description: 'Weighted average that emphasizes recent closes.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'WMA', placement: 'overlay', period: 20, color: '#7a8cff' },
  },
  {
    id: 'wema',
    kind: 'WEMA',
    label: 'Wilder Moving Average',
    shortLabel: 'WEMA',
    description: 'Wilder smoothing often used in directional systems.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'WEMA', placement: 'overlay', period: 14, color: '#70c1ff' },
  },
  {
    id: 'dema',
    kind: 'DEMA',
    label: 'Double EMA',
    shortLabel: 'DEMA',
    description: 'Double-smoothed EMA that reduces lag versus a standard EMA.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'DEMA', placement: 'overlay', period: 21, color: '#ff9f43' },
  },
  {
    id: 'tema',
    kind: 'TEMA',
    label: 'Triple EMA',
    shortLabel: 'TEMA',
    description: 'Triple-smoothed EMA — the fastest standard moving average.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'TEMA', placement: 'overlay', period: 21, color: '#ff6b6b' },
  },
  {
    id: 'lsma',
    kind: 'LSMA',
    label: 'Least Squares Moving Average',
    shortLabel: 'LSMA',
    description: 'Linear regression endpoint moving average with minimal lag.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'LSMA', placement: 'overlay', period: 25, offset: 0, color: '#FF6D00' },
  },
  {
    id: 'vwma',
    kind: 'VWMA',
    label: 'Volume Weighted Moving Average',
    shortLabel: 'VWMA',
    description: 'Moving average weighted by volume to emphasize high-volume action.',
    placement: 'overlay',
    group: 'volume',
    indicator: { kind: 'VWMA', placement: 'overlay', period: 20, color: '#2962FF' },
  },
  {
    id: 'mcginley',
    kind: 'MCGINLEY',
    label: 'McGinley Dynamic',
    shortLabel: 'MD',
    description: 'Dynamic moving average that automatically tracks market speed.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'MCGINLEY', placement: 'overlay', period: 14, k: 0.6, color: '#2962FF' },
  },
  {
    id: 'alligator',
    kind: 'ALLIGATOR',
    label: 'Williams Alligator',
    shortLabel: 'Alligator',
    description: 'Bill Williams 3-line trend indicator (Jaw 13/8, Teeth 8/5, Lips 5/3).',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'ALLIGATOR',
      placement: 'overlay',
      jawPeriod: 13,
      jawOffset: 8,
      teethPeriod: 8,
      teethOffset: 5,
      lipsPeriod: 5,
      lipsOffset: 3,
      jawColor: '#2962FF',
      teethColor: '#E91E63',
      lipsColor: '#66BB6A',
    },
  },
  {
    id: 'ma_cross',
    kind: 'MA_CROSS',
    label: 'Moving Average Cross',
    shortLabel: 'MA Cross',
    description: 'Fast and slow moving averages with crossover markers.',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'MA_CROSS',
      placement: 'overlay',
      fastPeriod: 9,
      slowPeriod: 21,
      fastColor: '#FF6D00',
      slowColor: '#43A047',
      crossColor: '#2962FF',
      maType: 'SMA',
    },
  },
  {
    id: 'ma_ribbon',
    kind: 'MA_RIBBON',
    label: 'Moving Average Ribbon',
    shortLabel: 'MA Ribbon',
    description: '4-line moving average ribbon (20, 50, 100, 200) to visualize trend structure.',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'MA_RIBBON',
      placement: 'overlay',
      period1: 20,
      period2: 50,
      period3: 100,
      period4: 200,
      color1: '#f6c309',
      color2: '#fb9800',
      color3: '#fb6500',
      color4: '#f60c0c',
      maType: 'SMA',
    },
  },
  {
    id: 'vwap',
    kind: 'VWAP',
    label: 'VWAP',
    shortLabel: 'VWAP',
    description: 'Volume-weighted average price — key institutional reference level.',
    placement: 'overlay',
    group: 'volume',
    indicator: { kind: 'VWAP', placement: 'overlay', color: '#e0aaff' },
  },
  // ── Volatility / Bands ────────────────────────────────────────────────────
  {
    id: 'boll',
    kind: 'BOLL',
    label: 'Bollinger Bands',
    shortLabel: 'BOLL',
    description: 'Volatility bands around a moving average basis.',
    placement: 'overlay',
    group: 'volatility',
    indicator: { kind: 'BOLL', placement: 'overlay', period: 20, stdDev: 2, color: '#ef5350' },
  },
  {
    id: 'psar',
    kind: 'PSAR',
    label: 'Parabolic SAR',
    shortLabel: 'PSAR',
    description: 'Trend-following stop and reverse points on price.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'PSAR', placement: 'overlay', step: 0.02, max: 0.2, color: '#ffd166' },
  },
  {
    id: 'supertrend',
    kind: 'SUPERTREND',
    label: 'Supertrend',
    shortLabel: 'ST',
    description: 'ATR-based trend direction overlay; green below price = uptrend, red above = downtrend.',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'SUPERTREND',
      placement: 'overlay',
      period: 10,
      multiplier: 3,
      upColor: '#22c55e',
      downColor: '#ef4444',
    },
  },
  // ── Momentum (pane) ───────────────────────────────────────────────────────
  {
    id: 'rsi',
    kind: 'RSI',
    label: 'Relative Strength Index',
    shortLabel: 'RSI',
    description: 'Momentum oscillator shown in its own pane.',
    placement: 'pane',
    group: 'momentum',
    alertOutputs: getIndicatorAlertOutputContractsByKind('RSI'),
    indicator: { kind: 'RSI', placement: 'pane', period: 14, color: '#6a9bcc' },
  },
  {
    id: 'macd',
    kind: 'MACD',
    label: 'MACD',
    shortLabel: 'MACD',
    description: 'Momentum trend indicator with signal line and histogram.',
    placement: 'pane',
    group: 'momentum',
    alertOutputs: getIndicatorAlertOutputContractsByKind('MACD'),
    indicator: {
      kind: 'MACD',
      placement: 'pane',
      fastPeriod: 12,
      slowPeriod: 26,
      signalPeriod: 9,
      color: '#6a9bcc',
      signalColor: '#ffd166',
      histogramPositiveColor: 'rgba(38, 166, 154, 0.75)',
      histogramNegativeColor: 'rgba(239, 83, 80, 0.75)',
    },
  },
  {
    id: 'stoch',
    kind: 'STOCH',
    label: 'Stochastic Oscillator',
    shortLabel: 'STOCH',
    description: 'Fast oscillator with K and D lines.',
    placement: 'pane',
    group: 'momentum',
    indicator: {
      kind: 'STOCH',
      placement: 'pane',
      period: 5,
      smoothK: 3,
      signalPeriod: 3,
      color: '#7bd389',
      signalColor: '#ff9f1c',
    },
  },
  {
    id: 'roc',
    kind: 'ROC',
    label: 'Rate Of Change',
    shortLabel: 'ROC',
    description: 'Momentum as percentage rate of change.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'ROC', placement: 'pane', period: 12, color: '#7a8cff' },
  },
  {
    id: 'cci',
    kind: 'CCI',
    label: 'Commodity Channel Index',
    shortLabel: 'CCI',
    description: 'Deviation-based oscillator around zero.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'CCI', placement: 'pane', period: 20, color: '#ff7b72' },
  },
  {
    id: 'willr',
    kind: 'WILLR',
    label: 'Williams %R',
    shortLabel: 'W%R',
    description: 'Range position oscillator between 0 and -100.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'WILLR', placement: 'pane', period: 14, color: '#8ecae6' },
  },
  {
    id: 'mom',
    kind: 'MOM',
    label: 'Momentum',
    shortLabel: 'MOM',
    description: 'Raw price momentum: close minus close N periods ago.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'MOM', placement: 'pane', period: 10, color: '#ffd6a5' },
  },
  // ── Volatility (pane) ─────────────────────────────────────────────────────
  {
    id: 'atr',
    kind: 'ATR',
    label: 'Average True Range',
    shortLabel: 'ATR',
    description: 'Volatility measure in its own pane.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'ATR', placement: 'pane', period: 14, color: '#ffa94d' },
  },
  // ── Trend Strength (pane) ─────────────────────────────────────────────────
  {
    id: 'adx',
    kind: 'ADX',
    label: 'Average Directional Index',
    shortLabel: 'ADX',
    description: 'Trend strength with +DI and -DI lines.',
    placement: 'pane',
    group: 'trend',
    indicator: {
      kind: 'ADX',
      placement: 'pane',
      period: 14,
      color: '#6a9bcc',
      plusColor: '#7bd389',
      minusColor: '#ff7b72',
    },
  },
  {
    id: 'aroon',
    kind: 'AROON',
    label: 'Aroon',
    shortLabel: 'AROON',
    description: 'Measures time since the highest high and lowest low to gauge trend freshness.',
    placement: 'pane',
    group: 'trend',
    indicator: {
      kind: 'AROON',
      placement: 'pane',
      period: 25,
      upColor: '#7bd389',
      downColor: '#ff7b72',
    },
  },
  // ── Volume (pane) ─────────────────────────────────────────────────────────
  {
    id: 'mfi',
    kind: 'MFI',
    label: 'Money Flow Index',
    shortLabel: 'MFI',
    description: 'Volume-weighted momentum oscillator.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'MFI', placement: 'pane', period: 14, color: '#b084f5' },
  },
  {
    id: 'obv',
    kind: 'OBV',
    label: 'On Balance Volume',
    shortLabel: 'OBV',
    description: 'Cumulative volume flow line.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'OBV', placement: 'pane', color: '#9bf6ff' },
  },
  {
    id: 'cmf',
    kind: 'CMF',
    label: 'Chaikin Money Flow',
    shortLabel: 'CMF',
    description: 'Measures buying/selling pressure using close position within the bar range.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'CMF', placement: 'pane', period: 20, color: '#a9def9' },
  },
  {
    id: 'kama',
    kind: 'KAMA',
    label: 'Kaufman Adaptive Moving Average',
    shortLabel: 'KAMA',
    description: 'Moving average that adjusts speed based on market noise.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'KAMA', placement: 'overlay', period: 10, color: '#ff9f43' },
  },
  {
    id: 'ultimate',
    kind: 'ULTIMATE',
    label: 'Ultimate Oscillator',
    shortLabel: 'UO',
    description: 'Momentum oscillator using three timeframes to reduce false signals.',
    placement: 'pane',
    group: 'momentum',
    indicator: {
      kind: 'ULTIMATE',
      placement: 'pane',
      shortPeriod: 7,
      medPeriod: 14,
      longPeriod: 28,
      color: '#00b4d8',
    },
  },
  {
    id: 'hma',
    kind: 'HMA',
    label: 'Hull Moving Average',
    shortLabel: 'HMA',
    description: 'Extremely fast moving average with zero lag.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'HMA', placement: 'overlay', period: 9, color: '#00d2ff' },
  },
  {
    id: 'alma',
    kind: 'ALMA',
    label: 'Arnaud Legoux Moving Average',
    shortLabel: 'ALMA',
    description: 'Gaussian distribution-based moving average for superior smoothness.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'ALMA', placement: 'overlay', period: 9, sigma: 6, offset: 0.85, color: '#833ab4' },
  },
  {
    id: 'bop',
    kind: 'BOP',
    label: 'Balance of Power',
    shortLabel: 'BOP',
    description: 'Measures buying vs selling pressure by close position relative to range.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'BOP', placement: 'pane', color: '#ff0080' },
  },
  {
    id: 'cmo',
    kind: 'CMO',
    label: 'Chande Momentum Oscillator',
    shortLabel: 'CMO',
    description: 'Momentum oscillator that uses raw sum of gains and losses.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'CMO', placement: 'pane', period: 14, color: '#f9d423' },
  },
  {
    id: 'avgprice',
    kind: 'AVGPRICE',
    label: 'Average Price',
    shortLabel: 'AVGPRICE',
    description: 'Average of OHLC: (O+H+L+C)/4.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'AVGPRICE', placement: 'overlay', color: '#ff7b72' },
  },
  {
    id: 'medprice',
    kind: 'MEDPRICE',
    label: 'Median Price',
    shortLabel: 'MEDPRICE',
    description: 'Median of High and Low: (H+L)/2.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'MEDPRICE', placement: 'overlay', color: '#7bdff2' },
  },
  {
    id: 'typprice',
    kind: 'TYPPRICE',
    label: 'Typical Price',
    shortLabel: 'TYPPRICE',
    description: 'Typical price: (H+L+C)/3.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'TYPPRICE', placement: 'overlay', color: '#b084f5' },
  },
  {
    id: 'wclprice',
    kind: 'WCLPRICE',
    label: 'Weighted Close Price',
    shortLabel: 'WCLPRICE',
    description: 'Weighted close: (H+L+2*C)/4.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'WCLPRICE', placement: 'overlay', color: '#f4d35e' },
  },
  {
    id: 'trix',
    kind: 'TRIX',
    label: 'TRIX',
    shortLabel: 'TRIX',
    description: 'Triple Exponentially Smoothed Average ROC.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'TRIX', placement: 'pane', period: 15, color: '#00b4d8' },
  },
  {
    id: 'apo',
    kind: 'APO',
    label: 'Absolute Price Oscillator',
    shortLabel: 'APO',
    description: 'Difference between two EMAs (fast - slow).',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'APO', placement: 'pane', fastPeriod: 12, slowPeriod: 26, color: '#26a69a' },
  },
  {
    id: 'ppo',
    kind: 'PPO',
    label: 'Percentage Price Oscillator',
    shortLabel: 'PPO',
    description: 'Percentage difference between two EMAs ((fast-slow)/slow).',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'PPO', placement: 'pane', fastPeriod: 12, slowPeriod: 26, color: '#ff9f43' },
  },
  {
    id: 'dpo',
    kind: 'DPO',
    label: 'Detrended Price Oscillator',
    shortLabel: 'DPO',
    description: 'Removes trend from price to identify cycles.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'DPO', placement: 'pane', period: 20, color: '#ef5350' },
  },
  {
    id: 'ao',
    kind: 'AO',
    label: 'Awesome Oscillator',
    shortLabel: 'AO',
    description: 'Measures momentum via difference between 5 and 34 period SMA of median price.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'AO', placement: 'pane', fastPeriod: 5, slowPeriod: 34, positiveColor: '#009688', negativeColor: '#F44336' },
  },
  {
    id: 'tsi',
    kind: 'TSI',
    label: 'True Strength Index',
    shortLabel: 'TSI',
    description: 'Double-smoothed momentum oscillator based on price changes.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'TSI', placement: 'pane', longLength: 25, shortLength: 13, signalLength: 13, color: '#2962FF', signalColor: '#E91E63' },
  },
  {
    id: 'crsi',
    kind: 'CRSI',
    label: 'Connors RSI',
    shortLabel: 'CRSI',
    description: 'Composite momentum oscillator combining RSI, UpDown streak RSI, and ROC PercentRank.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'CRSI', placement: 'pane', rsiLength: 3, upDownLength: 2, rocLength: 100, color: '#2962FF' },
  },
  {
    id: 'rvi',
    kind: 'RVI',
    label: 'Relative Vigor Index',
    shortLabel: 'RVI',
    description: 'Measures conviction of price action comparing closes relative to ranges.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'RVI', placement: 'pane', length: 10, color: '#008000', signalColor: '#FF0000' },
  },
  {
    id: 'fisher',
    kind: 'FISHER',
    label: 'Fisher Transform',
    shortLabel: 'Fisher',
    description: 'Converts prices into Gaussian normal distribution to pinpoint extreme turning points.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'FISHER', placement: 'pane', period: 9, color: '#2962FF', signalColor: '#FF6D00' },
  },
  {
    id: 'smi_ergodic',
    kind: 'SMI_ERGODIC',
    label: 'SMI Ergodic Indicator',
    shortLabel: 'SMI',
    description: 'TSI-based ergodic momentum indicator with signal line.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'SMI_ERGODIC', placement: 'pane', longLength: 20, shortLength: 5, signalLength: 5, color: '#2962FF', signalColor: '#FF6D00' },
  },
  {
    id: 'smi_ergodic_osc',
    kind: 'SMI_ERGODIC_OSC',
    label: 'SMI Ergodic Oscillator',
    shortLabel: 'SMIO',
    description: 'Histogram showing the difference between SMI Ergodic and its signal line.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'SMI_ERGODIC_OSC', placement: 'pane', longLength: 20, shortLength: 5, signalLength: 5, positiveColor: '#26a69a', negativeColor: '#FF5252' },
  },
  {
    id: 'pring_special_k',
    kind: 'PRING_SPECIAL_K',
    label: "Pring's Special K",
    shortLabel: 'Special K',
    description: "Martin Pring's multi-timeframe smoothed ROC composite momentum curve.",
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'PRING_SPECIAL_K', placement: 'pane', color: '#2962FF' },
  },
  {
    id: 'rci',
    kind: 'RCI',
    label: 'Rank Correlation Index',
    shortLabel: 'RCI',
    description: "Spearman's rank correlation measuring directional consistency and trend turning points.",
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'RCI', placement: 'pane', period: 10, signalPeriod: 14, color: '#2962FF', signalColor: '#E2CC00' },
  },
  {
    id: 'woodies_cci',
    kind: 'WOODIES_CCI',
    label: 'Woodies CCI',
    shortLabel: 'Woodies CCI',
    description: 'Dual CCI setup (Fast Turbo + Standard 14) with momentum histogram.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'WOODIES_CCI', placement: 'pane', cciPeriod: 14, turboPeriod: 6, cciColor: '#F44336', turboColor: '#009688', histogramPositiveColor: '#009688', histogramNegativeColor: '#F44336' },
  },
  {
    id: 'ichimoku',
    kind: 'ICHIMOKU',
    label: 'Ichimoku Cloud',
    shortLabel: 'ICHI',
    description: 'Comprehensive indicator showing support/resistance, trend direction and momentum.',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'ICHIMOKU',
      placement: 'overlay',
      conversionPeriod: 9,
      basePeriod: 26,
      spanBPeriod: 52,
      laggingPeriod: 26,
      conversionColor: '#00d2ff',
      baseColor: '#ff4d6d',
      laggingColor: '#ff9f43',
      cloudUpColor: 'rgba(38, 166, 154, 0.2)',
      cloudDownColor: 'rgba(239, 83, 80, 0.2)',
    },
  },
  {
    id: 'keltner',
    kind: 'KELTNER',
    label: 'Keltner Channels',
    shortLabel: 'KC',
    description: 'Volatility-based envelopes set above and below an EMA.',
    placement: 'overlay',
    group: 'volatility',
    indicator: { kind: 'KELTNER', placement: 'overlay', period: 20, multiplier: 2, color: '#00b4d8' },
  },
  {
    id: 'envelope',
    kind: 'ENVELOPE',
    label: 'Moving Average Envelope',
    shortLabel: 'ENV',
    description: 'Percentage-based bands above and below a moving average basis.',
    placement: 'overlay',
    group: 'volatility',
    indicator: { kind: 'ENVELOPE', placement: 'overlay', period: 20, percent: 10, exponential: false, basisColor: '#FF6D00', upperColor: '#2962FF', lowerColor: '#2962FF' },
  },
  {
    id: 'hv',
    kind: 'HV',
    label: 'Historical Volatility',
    shortLabel: 'HV',
    description: 'Annualized standard deviation of logarithmic price returns.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'HV', placement: 'pane', period: 10, annual: 365, color: '#2962FF' },
  },
  {
    id: 'stdev',
    kind: 'STDEV',
    label: 'Standard Deviation',
    shortLabel: 'StDev',
    description: 'Measures volatility by calculating the rolling standard deviation of price.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'STDEV', placement: 'pane', period: 20, color: '#2962FF' },
  },
  {
    id: 'rvi_vol',
    kind: 'RVI_VOL',
    label: 'Relative Volatility Index',
    shortLabel: 'RVI (Vol)',
    description: 'Measures the direction of volatility using smoothed standard deviations.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'RVI_VOL', placement: 'pane', period: 10, signalPeriod: 14, color: '#7E57C2', signalColor: '#E2CC00' },
  },
  {
    id: 'chande_kroll',
    kind: 'CHANDE_KROLL',
    label: 'Chande Kroll Stop',
    shortLabel: 'CKS',
    description: 'ATR-based trailing stop system for long and short position management.',
    placement: 'overlay',
    group: 'volatility',
    indicator: { kind: 'CHANDE_KROLL', placement: 'overlay', atrPeriod: 10, atrMultiplier: 1, stopPeriod: 9, longColor: '#2962FF', shortColor: '#FF6D00' },
  },
  {
    id: 'volatility_stop',
    kind: 'VOLATILITY_STOP',
    label: 'Volatility Stop',
    shortLabel: 'VStop',
    description: 'Trailing stop SAR that flips between long and short on price breakout.',
    placement: 'overlay',
    group: 'volatility',
    indicator: { kind: 'VOLATILITY_STOP', placement: 'overlay', period: 20, multiplier: 2.0, longColor: '#089981', shortColor: '#F23645' },
  },
  {
    id: 'ulcer_index',
    kind: 'ULCER_INDEX',
    label: 'Ulcer Index',
    shortLabel: 'UI',
    description: 'Measures downside risk by calculating depth and duration of price drawdowns.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'ULCER_INDEX', placement: 'pane', period: 14, color: '#E91E63' },
  },
  {
    id: 'chop',
    kind: 'CHOP',
    label: 'Choppiness Index',
    shortLabel: 'CHOP',
    description: 'Measures market consolidation vs trendiness (range: 0-100).',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'CHOP', placement: 'pane', period: 14, color: '#2962FF' },
  },
  {
    id: 'chop_zone',
    kind: 'CHOP_ZONE',
    label: 'Chop Zone',
    shortLabel: 'Chop Zone',
    description: 'Color-coded visual zones based on EMA angle and price action.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'CHOP_ZONE', placement: 'pane', period: 30 },
  },
  {
    id: 'bbtrend',
    kind: 'BBTREND',
    label: 'Bollinger Bands Trend',
    shortLabel: 'BBTrend',
    description: 'Dual Bollinger Bands momentum oscillator measuring trend expansion.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'BBTREND', placement: 'pane', shortPeriod: 20, longPeriod: 50, stdDev: 2.0, positiveColor: '#089981', negativeColor: '#F23645' },
  },
  {
    id: 'donchian',
    kind: 'DONCHIAN',
    label: 'Donchian Channels',
    shortLabel: 'DC',
    description: 'Shows the highest high and lowest low of the last N periods.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'DONCHIAN', placement: 'overlay', period: 20, color: '#9bf6ff' },
  },
  {
    id: 'zigzag',
    kind: 'ZIGZAG',
    label: 'ZigZag',
    shortLabel: 'ZZ',
    description: 'Filters out small price movements to highlight significant trend changes.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'ZIGZAG', placement: 'overlay', deviation: 5, color: '#f9d423' },
  },
  {
    id: 'elder_ray',
    kind: 'ELDER_RAY',
    label: 'Elder Ray (Bull/Bear Power)',
    shortLabel: 'ER',
    description: 'Measures buying and selling pressure relative to an EMA.',
    placement: 'pane',
    group: 'momentum',
    indicator: {
      kind: 'ELDER_RAY',
      placement: 'pane',
      period: 13,
      bullColor: '#26a69a',
      bearColor: '#ef5350',
    },
  },
  {
    id: 'coppock',
    kind: 'COPPOCK',
    label: 'Coppock Curve',
    shortLabel: 'COPP',
    description: 'Long-term momentum indicator for identifying major market bottoms.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'COPPOCK', placement: 'pane', wmaPeriod: 10, rocFast: 11, rocSlow: 14, color: '#ab47bc' },
  },
  {
    id: 'force_index',
    kind: 'FORCE_INDEX',
    label: 'Force Index',
    shortLabel: 'FI',
    description: 'Uses price and volume to measure the power behind movements.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'FORCE_INDEX', placement: 'pane', period: 13, color: '#ff9f43' },
  },
  {
    id: 'vol_osc',
    kind: 'VOL_OSC',
    label: 'Volume Oscillator',
    shortLabel: 'Vol Osc',
    description: 'Percentage difference between fast and slow volume moving averages.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'VOL_OSC', placement: 'pane', fastPeriod: 5, slowPeriod: 10, color: '#2962FF' },
  },
  {
    id: 'chaikin_osc',
    kind: 'CHAIKIN_OSC',
    label: 'Chaikin Oscillator',
    shortLabel: 'Chaikin Osc',
    description: 'Momentum of Accumulation/Distribution line using 3 and 10 EMAs.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'CHAIKIN_OSC', placement: 'pane', fastPeriod: 3, slowPeriod: 10, color: '#EC407A' },
  },
  {
    id: 'kvo',
    kind: 'KVO',
    label: 'Klinger Volume Oscillator',
    shortLabel: 'KVO',
    description: 'Measures long-term money flow trend by comparing volume force EMAs.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'KVO', placement: 'pane', fastPeriod: 34, slowPeriod: 55, signalPeriod: 13, color: '#2962FF', signalColor: '#43A047' },
  },
  {
    id: 'pvt',
    kind: 'PVT',
    label: 'Price Volume Trend',
    shortLabel: 'PVT',
    description: 'Cumulative volume indicator relating percentage price change to volume.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'PVT', placement: 'pane', color: '#2962FF' },
  },
  {
    id: 'pvi',
    kind: 'PVI',
    label: 'Positive Volume Index',
    shortLabel: 'PVI',
    description: 'Tracks market movement on higher-volume days with EMA signal.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'PVI', placement: 'pane', signalPeriod: 255, color: '#2962FF', signalColor: '#FF6D00' },
  },
  {
    id: 'nvi',
    kind: 'NVI',
    label: 'Negative Volume Index',
    shortLabel: 'NVI',
    description: 'Tracks market movement on lower-volume (smart money) days with EMA signal.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'NVI', placement: 'pane', signalPeriod: 255, color: '#2962FF', signalColor: '#FF6D00' },
  },
  {
    id: 'cvd',
    kind: 'CVD',
    label: 'Cumulative Volume Delta',
    shortLabel: 'CVD',
    description: 'Cumulative net volume pressure across bars.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'CVD', placement: 'pane', positiveColor: '#26A69A', negativeColor: '#EF5350' },
  },
  {
    id: 'volume_delta',
    kind: 'VOLUME_DELTA',
    label: 'Volume Delta',
    shortLabel: 'Vol Delta',
    description: 'Bar-by-bar buying vs selling volume delta.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'VOLUME_DELTA', placement: 'pane', positiveColor: '#26A69A', negativeColor: '#EF5350' },
  },
  {
    id: 'rvol',
    kind: 'RVOL',
    label: 'Relative Volume',
    shortLabel: 'RVOL',
    description: 'Compares current bar volume to rolling average volume baseline.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'RVOL', placement: 'pane', period: 20, color: '#2962FF' },
  },
  {
    id: 'up_down_vol',
    kind: 'UP_DOWN_VOL',
    label: 'Up/Down Volume',
    shortLabel: 'U/D Vol',
    description: 'Separates volume into buying and selling components with net delta.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'UP_DOWN_VOL', placement: 'pane', upColor: '#089981', downColor: '#F23645', deltaColor: '#2962FF' },
  },
  {
    id: 'net_volume',
    kind: 'NET_VOLUME',
    label: 'Net Volume',
    shortLabel: 'Net Vol',
    description: 'Displays net buying and selling volume per bar.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'NET_VOLUME', placement: 'pane', positiveColor: '#26A69A', negativeColor: '#EF5350' },
  },
  {
    id: 'eom',
    kind: 'EOM',
    label: 'Ease of Movement',
    shortLabel: 'EOM',
    description: 'Relates price change to volume to quantify how easily price moves.',
    placement: 'pane',
    group: 'volume',
    indicator: { kind: 'EOM', placement: 'pane', period: 14, divisor: 10000, color: '#43A047' },
  },
  {
    id: 'mass_index',
    kind: 'MASS_INDEX',
    label: 'Mass Index',
    shortLabel: 'MASS',
    description: 'Uses range to predict trend reversals based on range expansion.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'MASS_INDEX', placement: 'pane', emaPeriod: 9, sumPeriod: 25, color: '#f4d35e' },
  },
  {
    id: 'twap',
    kind: 'TWAP',
    label: 'Time Weighted Average Price',
    shortLabel: 'TWAP',
    description: 'Cumulative average of price across time without volume weighting.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'TWAP', placement: 'overlay', source: 'ohlc4', color: '#DD7A28' },
  },
  {
    id: 'adr',
    kind: 'ADR',
    label: 'Average Day Range',
    shortLabel: 'ADR',
    description: 'Rolling average of the daily high-low price range.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'ADR', placement: 'pane', period: 14, color: '#2962FF' },
  },
  {
    id: 'auto_key_levels',
    kind: 'AUTO_KEY_LEVELS',
    label: 'Auto Key Levels',
    shortLabel: 'Key Levels',
    description: 'Detects and plots key horizontal support and resistance pivot levels.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'AUTO_KEY_LEVELS', placement: 'overlay', pivotLength: 20, maxLevels: 6, supportColor: '#089981', resistanceColor: '#F23645' },
  },
  {
    id: 'auto_trend',
    kind: 'AUTO_TREND',
    label: 'Auto Trend Lines',
    shortLabel: 'Auto Trend',
    description: 'Automatically detects and projects prevailing trendlines from pivot peaks and troughs.',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'AUTO_TREND', placement: 'overlay', pivotLength: 10, supportColor: '#089981', resistanceColor: '#F23645' },
  },
  {
    id: 'fractals',
    kind: 'FRACTALS',
    label: 'Williams Fractals',
    shortLabel: 'Fractals',
    description: 'Identifies local price extremes (fractal swing highs and lows).',
    placement: 'overlay',
    group: 'trend',
    indicator: { kind: 'FRACTALS', placement: 'overlay', periods: 2, upColor: '#089981', downColor: '#F23645' },
  },
  {
    id: 'trend_strength',
    kind: 'TREND_STRENGTH',
    label: 'Trend Strength Index',
    shortLabel: 'Trend Strength',
    description: 'Pearson correlation between closing price and time index (range: -1 to 1).',
    placement: 'pane',
    group: 'trend',
    indicator: { kind: 'TREND_STRENGTH', placement: 'pane', period: 14, color: '#7E57C2' },
  },
  {
    id: 'rci_ribbon',
    kind: 'RCI_RIBBON',
    label: 'RCI Ribbon',
    shortLabel: 'RCI Ribbon',
    description: 'Displays three Rank Correlation Index lines with different lookbacks.',
    placement: 'pane',
    group: 'momentum',
    indicator: { kind: 'RCI_RIBBON', placement: 'pane', shortLength: 10, middleLength: 30, longLength: 50, shortColor: '#2962FF', middleColor: '#F23645', longColor: '#089981' },
  },
  {
    id: 'bb_width',
    kind: 'BB_WIDTH',
    label: 'Bollinger Bands Bandwidth',
    shortLabel: 'BBW',
    description: 'Measures the width of Bollinger Bands as a percentage of the basis.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'BB_WIDTH', placement: 'pane', period: 20, stdDev: 2.0, color: '#2962FF' },
  },
  {
    id: 'bb_pct_b',
    kind: 'BB_PCT_B',
    label: 'Bollinger Bands %B',
    shortLabel: 'BB %B',
    description: 'Shows where price is located relative to the upper and lower Bollinger Bands.',
    placement: 'pane',
    group: 'volatility',
    indicator: { kind: 'BB_PCT_B', placement: 'pane', period: 20, stdDev: 2.0, color: '#2962FF' },
  },
  {
    id: 'kst',
    kind: 'KST',
    label: 'Know Sure Thing (KST)',
    shortLabel: 'KST',
    description: 'Quadruple smoothed momentum oscillator.',
    placement: 'pane',
    group: 'momentum',
    indicator: {
      kind: 'KST',
      placement: 'pane',
      roc1: 10,
      roc2: 15,
      roc3: 20,
      roc4: 30,
      s1: 10,
      s2: 10,
      s3: 10,
      s4: 15,
      sig: 9,
      color: '#00d2ff',
      signalColor: '#f9d423',
    },
  },
  {
    id: 'vortex',
    kind: 'VORTEX',
    label: 'Vortex Indicator',
    shortLabel: 'VI',
    description: 'Identifies trend direction and strength through positive and negative movement.',
    placement: 'pane',
    group: 'trend',
    indicator: { kind: 'VORTEX', placement: 'pane', period: 14, plusColor: '#00b4d8', minusColor: '#ff4d6d' },
  },
  {
    id: 'patterns',
    kind: 'PATTERN',
    label: 'Candlestick Patterns',
    shortLabel: 'PAT',
    description: 'Identifies common candlestick patterns like Hammer, Doji, and Engulfing.',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'PATTERN',
      placement: 'overlay',
      patterns: [
        'doji',
        'hammer',
        'inv_hammer',
        'shooting_star',
        'engulfing',
        'harami',
        'morning_star',
        'evening_star',
        'marubozu',
        'piercing',
        'dark_cloud',
        'soldiers',
        'crows',
      ],
      bullColor: '#22c55e',
      bearColor: '#ef4444',
      neutralColor: '#f59e0b',
    },
  },
  {
    id: 'cpr',
    kind: 'CPR',
    label: 'Central Pivot Range (CPR)',
    shortLabel: 'CPR',
    description: 'Central Pivot Range (Pivot, Top Central, Bottom Central) for key S&R levels.',
    placement: 'overlay',
    group: 'trend',
    indicator: {
      kind: 'CPR',
      placement: 'overlay',
      pivotColor: '#00b4d8',
      tcColor: '#26a69a',
      bcColor: '#ef5350',
    },
  },
  {
    id: 'stochrsi',
    kind: 'STOCHRSI',
    label: 'Stochastic RSI',
    shortLabel: 'StochRSI',
    description: 'Stochastic applied to RSI for ultra-responsive momentum oscillator.',
    placement: 'pane',
    group: 'momentum',
    indicator: {
      kind: 'STOCHRSI',
      placement: 'pane',
      rsiPeriod: 14,
      stochPeriod: 14,
      kPeriod: 3,
      dPeriod: 3,
      color: '#00d2ff',
      signalColor: '#ff9f43',
    },
  },
  {
    id: 'avwap',
    kind: 'AVWAP',
    label: 'Anchored VWAP',
    shortLabel: 'AVWAP',
    description: 'Volume-Weighted Average Price anchored to a specific start index or date.',
    placement: 'overlay',
    group: 'volume',
    indicator: {
      kind: 'AVWAP',
      placement: 'overlay',
      color: '#f9d423',
    },
  },
  // ── Community Indicators ──────────────────────────────────────────────────
  {
    id: 'ut_bot',
    kind: 'UT_BOT',
    label: 'UT Bot Alerts',
    shortLabel: 'UT Bot',
    description: 'Popular ATR-based trailing stop with breakout direction signals.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'UT_BOT', placement: 'overlay', keyValue: 1, atrPeriod: 10, color: '#26A69A' },
  },
  {
    id: 'waddah_attar',
    kind: 'WADDAH_ATTAR',
    label: 'Waddah Attar Explosion',
    shortLabel: 'WAE',
    description: 'Explosive breakout momentum indicator combining MACD and Bollinger Bandwidth.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'WADDAH_ATTAR', placement: 'pane', sensitivity: 150, fastLength: 20, slowLength: 40, channelLength: 20, bbMult: 2.0 },
  },
  {
    id: 'squeeze_momentum',
    kind: 'SQUEEZE_MOMENTUM',
    label: 'Squeeze Momentum Indicator',
    shortLabel: 'SQZ MOM',
    description: 'LazyBear’s classic Bollinger Bands in Keltner Channels volatility squeeze detector.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'SQUEEZE_MOMENTUM', placement: 'pane', bbLength: 20, bbMult: 2.0, kcLength: 20, kcMult: 1.5 },
  },
  {
    id: 'wavetrend',
    kind: 'WAVETREND',
    label: 'WaveTrend Oscillator',
    shortLabel: 'WaveTrend',
    description: 'LazyBear’s dual-smoothed momentum oscillator for pinpointing market tops and bottoms.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'WAVETREND', placement: 'pane', channelLength: 10, averageLength: 21, obLevel1: 60, osLevel1: -60 },
  },
  {
    id: 'qqe_mod',
    kind: 'QQE_MOD',
    label: 'QQE Mod',
    shortLabel: 'QQE Mod',
    description: 'Dual Quantitative Qualitative Estimation with dynamic ATR-RSI bands and trend histogram.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'QQE_MOD', placement: 'pane', rsiLengthPrimary: 6, rsiSmoothingPrimary: 5, qqeFactorPrimary: 3.0, rsiLengthSecondary: 6, rsiSmoothingSecondary: 5, qqeFactorSecondary: 1.61, bollingerLength: 50, bollingerMultiplier: 0.35 },
  },
  {
    id: 'chandelier_exit',
    kind: 'CHANDELIER_EXIT',
    label: 'Chandelier Exit',
    shortLabel: 'CE',
    description: 'Chuck LeBeau ATR trailing stop system for trend following and position protection.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'CHANDELIER_EXIT', placement: 'overlay', atrPeriod: 22, atrMult: 3.0, useClose: true, longColor: '#26A69A', shortColor: '#EF5350' },
  },
  {
    id: 'ssl_channel',
    kind: 'SSL_CHANNEL',
    label: 'SSL Channel',
    shortLabel: 'SSL',
    description: 'Moving average high/low channel crossover system for trend identification.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'SSL_CHANNEL', placement: 'overlay', period: 10, upColor: '#26A69A', downColor: '#EF5350' },
  },
  {
    id: 'ripster_ema_clouds',
    kind: 'RIPSTER_EMA_CLOUDS',
    label: 'Ripster EMA Clouds',
    shortLabel: 'EMA Clouds',
    description: 'Multiple short and long EMA ribbon pairs for dynamic trend support and resistance.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'RIPSTER_EMA_CLOUDS', placement: 'overlay', source: 'hl2', shortLen1: 8, longLen1: 9, shortLen2: 5, longLen2: 12, shortLen3: 34, longLen3: 50 },
  },
  {
    id: 'alpha_trend',
    kind: 'ALPHA_TREND',
    label: 'AlphaTrend',
    shortLabel: 'AlphaTrend',
    description: 'Kıvanç Özbilgiç’s MFI/RSI adaptive trend trailing stop system.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'ALPHA_TREND', placement: 'overlay', coeff: 1.0, period: 14, useRSI: false, color: '#0022FC', lagColor: '#FC0400' },
  },
  {
    id: 'vfi',
    kind: 'VFI',
    label: 'Volume Flow Indicator',
    shortLabel: 'VFI',
    description: 'Markos Katsanos’s volume-confirmed price flow oscillator.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'VFI', placement: 'pane', length: 130, coef: 0.2, vcoef: 2.5, signalLength: 5, color: '#26A69A', signalColor: '#FF6D00' },
  },
  {
    id: 'half_trend',
    kind: 'HALF_TREND',
    label: 'HalfTrend',
    shortLabel: 'HalfTrend',
    description: 'Everget’s amplitude-filtered non-repainting ATR trendline overlay.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'HALF_TREND', placement: 'overlay', amplitude: 2, channelDeviation: 2, color: '#2962FF', atrHighColor: '#EF5350', atrLowColor: '#26A69A' },
  },
  {
    id: 'linreg_channel',
    kind: 'LINREG_CHANNEL',
    label: 'Linear Regression Channel',
    shortLabel: 'LinReg Channel',
    description: 'High and Low linear regression lines with standard deviation channel bands.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'LINREG_CHANNEL', placement: 'overlay', length: 100, upperColor: '#EF5350', lowerColor: '#26A69A', middleColor: '#2962FF' },
  },
  {
    id: 'supertrend_ai',
    kind: 'SUPERTREND_AI',
    label: 'SuperTrend AI (Clustering)',
    shortLabel: 'SuperTrend AI',
    description: 'LuxAlgo SuperTrend AI clustering factors to optimize performance against whipsaws.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'SUPERTREND_AI', placement: 'overlay', atrLen: 10, minFactor: 1.0, maxFactor: 5.0, factorStep: 0.5, perfAlpha: 10, upColor: '#26A69A', downColor: '#EF5350' },
  },
  {
    id: 'order_blocks',
    kind: 'ORDER_BLOCKS',
    label: 'Order Blocks with Signals',
    shortLabel: 'Order Blocks',
    description: 'Sonarlab institutional order blocks detection via rate of change momentum.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'ORDER_BLOCKS', placement: 'overlay', sensitivity: 28, mitigationType: 'Close', bullColor: '#26A69A', bearColor: '#EF5350' },
  },
  {
    id: 'fvg',
    kind: 'FVG',
    label: 'Fair Value Gaps (FVG) Average',
    shortLabel: 'FVG Avg',
    description: 'LuxAlgo Fair Value Gaps with weighted positioning averages.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'FVG', placement: 'overlay', lookback: 30, atrMultiplier: 0.25, bullColor: '#089981', bearColor: '#F23645' },
  },
  {
    id: 'market_cipher_b',
    kind: 'MARKET_CIPHER_B',
    label: 'Market Cipher B',
    shortLabel: 'Cipher B',
    description: 'VuManChu multi-layer oscillator combining WaveTrend, Money Flow, and VWAP.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'MARKET_CIPHER_B', placement: 'pane', wtChannelLen: 9, wtAvgLen: 12, wtMALen: 3, rsiMFIPeriod: 60, rsiMFIMult: 150, wt1Color: '#4994EC', wt2Color: '#1F1559', mfiColor: '#3EE145' },
  },
  {
    id: 'range_filter_dw',
    kind: 'RANGE_FILTER_DW',
    label: 'Range Filter [DW]',
    shortLabel: 'Range Filter',
    description: 'Donovan Wall adaptive EMA range filter with volatility bands.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'RANGE_FILTER_DW', placement: 'overlay', period: 50, mult: 3.0, color: '#2962FF', upperColor: '#26A69A', lowerColor: '#EF5350' },
  },
  {
    id: 'donchian_ribbon',
    kind: 'DONCHIAN_RIBBON',
    label: 'Donchian Trend Ribbon',
    shortLabel: 'Donchian Ribbon',
    description: 'LonesomeTheBlue 10-layer cascading breakout trend momentum matrix.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'DONCHIAN_RIBBON', placement: 'pane', dlen: 20, bullColor: '#00E676', bearColor: '#FF5252' },
  },
  {
    id: 'trendlines_breaks',
    kind: 'TRENDLINES_BREAKS',
    label: 'Trendlines with Breaks',
    shortLabel: 'Trendlines Breaks',
    description: 'LuxAlgo automatic slope-adjusted swing trendlines with breakout detection.',
    placement: 'overlay',
    group: 'community',
    indicator: { kind: 'TRENDLINES_BREAKS', placement: 'overlay', length: 14, mult: 1.0, upperColor: '#26A69A', lowerColor: '#EF5350' },
  },
  {
    id: 'cm_vix_fix',
    kind: 'CM_VIX_FIX',
    label: 'CM Williams Vix Fix V3',
    shortLabel: 'Vix Fix V3',
    description: 'ChrisMoody market bottom detector with Bollinger Bands and percentile thresholds.',
    placement: 'pane',
    group: 'community',
    indicator: { kind: 'CM_VIX_FIX', placement: 'pane', length: 22, bbLen: 20, bbMult: 2.0, lookbackPct: 50, pctHighest: 0.85, color: '#787B86', alertColor: '#00E676' },
  },
];

export type IndicatorCatalogId = (typeof INDICATOR_CATALOG)[number]['id'];

export function createIndicatorFromCatalogId(catalogId: IndicatorCatalogId): ChartIndicator {
  const entry = INDICATOR_CATALOG.find((item) => item.id === catalogId);
  if (!entry) {
    throw new Error(`Unknown indicator catalog id: ${catalogId}`);
  }

  return {
    id: crypto.randomUUID(),
    ...entry.indicator,
  } as ChartIndicator;
}

export function createIndicatorFromKind(kind: ChartIndicator['kind']): ChartIndicator {
  if (kind === 'CUSTOM') {
    throw new Error('Custom formula indicators must be created through the custom formula editor.');
  }

  const entry = INDICATOR_CATALOG.find((item) => item.kind === kind);
  if (!entry) {
    throw new Error(`Unknown indicator kind: ${kind}`);
  }

  return createIndicatorFromCatalogId(entry.id);
}

export function getIndicatorCatalogItemByKind(kind: ChartIndicator['kind']): IndicatorCatalogItem | undefined {
  return INDICATOR_CATALOG.find((item) => item.kind === kind);
}

export function getIndicatorLabel(indicator: ChartIndicator): string {
  if (indicator.kind === 'CUSTOM') {
    return indicator.name.trim() || 'Custom Formula';
  }

  return getIndicatorCatalogItemByKind(indicator.kind)?.shortLabel ?? indicator.kind;
}

export function getIndicatorDisplayLabel(indicator: ChartIndicator): string {
  const base = getIndicatorLabel(indicator);
  let label = base;

  switch (indicator.kind) {
    case 'CUSTOM':
      label = indicator.name.trim() || 'Custom Formula';
      break;
    case 'SMA':
    case 'EMA':
    case 'WMA':
    case 'WEMA':
    case 'DEMA':
    case 'TEMA':
    case 'RSI':
    case 'ROC':
    case 'CCI':
    case 'WILLR':
    case 'ATR':
    case 'MFI':
    case 'ADX':
    case 'MOM':
    case 'CMF':
    case 'AROON':
    case 'KAMA':
    case 'HMA':
    case 'CMO':
    case 'TRIX':
    case 'DPO':
    case 'DONCHIAN':
    case 'FORCE_INDEX':
    case 'VORTEX':
    case 'ELDER_RAY':
    case 'VWMA':
    case 'MCGINLEY':
    case 'FISHER':
    case 'HV':
    case 'STDEV':
    case 'ULCER_INDEX':
    case 'CHOP':
      label = `${base} (${formatIndicatorNumber(indicator.period)})`;
      break;
    case 'ENVELOPE':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.percent)}%)`;
      break;
    case 'CHANDE_KROLL':
      label = `${base} (${formatIndicatorNumber(indicator.atrPeriod)}, ${formatIndicatorNumber(indicator.atrMultiplier)}, ${formatIndicatorNumber(indicator.stopPeriod)})`;
      break;
    case 'VOLATILITY_STOP':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.multiplier)})`;
      break;
    case 'CHOP_ZONE':
      label = `${base} (${formatIndicatorNumber(indicator.period ?? 30)})`;
      break;
    case 'BBTREND':
      label = `${base} (${formatIndicatorNumber(indicator.shortPeriod)}, ${formatIndicatorNumber(indicator.longPeriod)}, ${formatIndicatorNumber(indicator.stdDev)})`;
      break;
    case 'RVI_VOL':
      label = `${base} (${formatIndicatorNumber(indicator.period)}${indicator.signalPeriod ? `, ${indicator.signalPeriod}` : ''})`;
      break;
    case 'RVI':
      label = `${base} (${formatIndicatorNumber(indicator.length)})`;
      break;
    case 'AO':
    case 'VOL_OSC':
    case 'CHAIKIN_OSC':
      label = `${base} (${formatIndicatorNumber(indicator.fastPeriod)}, ${formatIndicatorNumber(indicator.slowPeriod)})`;
      break;
    case 'KVO':
      label = `${base} (${formatIndicatorNumber(indicator.fastPeriod)}, ${formatIndicatorNumber(indicator.slowPeriod)}, ${formatIndicatorNumber(indicator.signalPeriod)})`;
      break;
    case 'RVOL':
    case 'EOM':
    case 'ADR':
    case 'TREND_STRENGTH':
      label = `${base} (${formatIndicatorNumber(indicator.period)})`;
      break;
    case 'BB_WIDTH':
    case 'BB_PCT_B':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.stdDev)})`;
      break;
    case 'FRACTALS':
      label = `${base} (${formatIndicatorNumber(indicator.periods ?? 2)})`;
      break;
    case 'AUTO_KEY_LEVELS':
      label = `${base} (${formatIndicatorNumber(indicator.pivotLength ?? 20)}, ${formatIndicatorNumber(indicator.maxLevels ?? 6)})`;
      break;
    case 'AUTO_TREND':
      label = `${base} (${formatIndicatorNumber(indicator.pivotLength ?? 10)})`;
      break;
    case 'RCI_RIBBON':
      label = `${base} (${formatIndicatorNumber(indicator.shortLength ?? 10)}, ${formatIndicatorNumber(indicator.middleLength ?? 30)}, ${formatIndicatorNumber(indicator.longLength ?? 50)})`;
      break;
    case 'PVI':
    case 'NVI':
      label = `${base} (${formatIndicatorNumber(indicator.signalPeriod)})`;
      break;
    case 'TSI':
    case 'SMI_ERGODIC':
    case 'SMI_ERGODIC_OSC':
      label = `${base} (${formatIndicatorNumber(indicator.longLength)}, ${formatIndicatorNumber(indicator.shortLength)}, ${formatIndicatorNumber(indicator.signalLength)})`;
      break;
    case 'CRSI':
      label = `${base} (${formatIndicatorNumber(indicator.rsiLength)}, ${formatIndicatorNumber(indicator.upDownLength)}, ${formatIndicatorNumber(indicator.rocLength)})`;
      break;
    case 'RCI':
      label = `${base} (${formatIndicatorNumber(indicator.period)}${indicator.signalPeriod ? `, ${indicator.signalPeriod}` : ''})`;
      break;
    case 'WOODIES_CCI':
      label = `${base} (${formatIndicatorNumber(indicator.cciPeriod)}, ${formatIndicatorNumber(indicator.turboPeriod)})`;
      break;
    case 'PRING_SPECIAL_K':
    case 'PVT':
    case 'CVD':
    case 'VOLUME_DELTA':
    case 'UP_DOWN_VOL':
    case 'NET_VOLUME':
    case 'TWAP':
      label = base;
      break;
    case 'LSMA':
      label = `${base} (${formatIndicatorNumber(indicator.period)}${indicator.offset ? `, ${indicator.offset}` : ''})`;
      break;
    case 'ALLIGATOR':
      label = `${base} (${formatIndicatorNumber(indicator.jawPeriod)}, ${formatIndicatorNumber(indicator.teethPeriod)}, ${formatIndicatorNumber(indicator.lipsPeriod)})`;
      break;
    case 'MA_CROSS':
      label = `${base} (${formatIndicatorNumber(indicator.fastPeriod)}, ${formatIndicatorNumber(indicator.slowPeriod)})`;
      break;
    case 'MA_RIBBON':
      label = `${base} (${formatIndicatorNumber(indicator.period1)}, ${formatIndicatorNumber(indicator.period2)}, ${formatIndicatorNumber(indicator.period3)}, ${formatIndicatorNumber(indicator.period4)})`;
      break;
    case 'PATTERN':
      label = `${base} (${indicator.patterns.length})`;
      break;
    case 'ALMA':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.sigma)}, ${formatIndicatorNumber(indicator.offset)})`;
      break;
    case 'BOLL':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.stdDev)})`;
      break;
    case 'KELTNER':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.multiplier)})`;
      break;
    case 'ZIGZAG':
      label = `${base} (${formatIndicatorNumber(indicator.deviation)}%)`;
      break;
    case 'PSAR':
      label = `${base} (${formatIndicatorNumber(indicator.step)}, ${formatIndicatorNumber(indicator.max)})`;
      break;
    case 'SUPERTREND':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.multiplier)})`;
      break;
    case 'ULTIMATE':
      label = `${base} (${formatIndicatorNumber(indicator.shortPeriod)}, ${formatIndicatorNumber(indicator.medPeriod)}, ${formatIndicatorNumber(indicator.longPeriod)})`;
      break;
    case 'ICHIMOKU':
      label = `${base} (${formatIndicatorNumber(indicator.conversionPeriod)}, ${formatIndicatorNumber(indicator.basePeriod)}, ${formatIndicatorNumber(indicator.spanBPeriod)}, ${formatIndicatorNumber(indicator.laggingPeriod)})`;
      break;
    case 'COPPOCK':
      label = `${base} (${formatIndicatorNumber(indicator.wmaPeriod)}, ${formatIndicatorNumber(indicator.rocFast)}, ${formatIndicatorNumber(indicator.rocSlow)})`;
      break;
    case 'MASS_INDEX':
      label = `${base} (${formatIndicatorNumber(indicator.emaPeriod)}, ${formatIndicatorNumber(indicator.sumPeriod)})`;
      break;
    case 'KST':
      label = `${base} (${formatIndicatorNumber(indicator.roc1)}, ${formatIndicatorNumber(indicator.roc2)}, ${formatIndicatorNumber(indicator.roc3)}, ${formatIndicatorNumber(indicator.roc4)}, ${formatIndicatorNumber(indicator.sig)})`;
      break;
    case 'MACD':
      label = `${base} (${formatIndicatorNumber(indicator.fastPeriod)}, ${formatIndicatorNumber(indicator.slowPeriod)}, ${formatIndicatorNumber(indicator.signalPeriod)})`;
      break;
    case 'APO':
    case 'PPO':
      label = `${base} (${formatIndicatorNumber(indicator.fastPeriod)}, ${formatIndicatorNumber(indicator.slowPeriod)})`;
      break;
    case 'STOCH':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.smoothK ?? 3)}, ${formatIndicatorNumber(indicator.signalPeriod)})`;
      break;
    case 'STOCHRSI':
      label = `${base} (${formatIndicatorNumber(indicator.rsiPeriod)}, ${formatIndicatorNumber(indicator.stochPeriod)}, ${formatIndicatorNumber(indicator.kPeriod)}, ${formatIndicatorNumber(indicator.dPeriod)})`;
      break;
    case 'AVWAP':
      label = indicator.anchorDate ? `${base} (${indicator.anchorDate})` : base;
      break;
    case 'UT_BOT':
      label = `${base} (${formatIndicatorNumber(indicator.keyValue)}, ${formatIndicatorNumber(indicator.atrPeriod)})`;
      break;
    case 'WADDAH_ATTAR':
      label = `${base} (${formatIndicatorNumber(indicator.sensitivity)}, ${formatIndicatorNumber(indicator.fastLength)}, ${formatIndicatorNumber(indicator.slowLength)}, ${formatIndicatorNumber(indicator.channelLength)}, ${formatIndicatorNumber(indicator.bbMult)})`;
      break;
    case 'SQUEEZE_MOMENTUM':
      label = `${base} (${formatIndicatorNumber(indicator.bbLength)}, ${formatIndicatorNumber(indicator.bbMult)}, ${formatIndicatorNumber(indicator.kcLength)}, ${formatIndicatorNumber(indicator.kcMult)})`;
      break;
    case 'WAVETREND':
      label = `${base} (${formatIndicatorNumber(indicator.channelLength)}, ${formatIndicatorNumber(indicator.averageLength)})`;
      break;
    case 'QQE_MOD':
      label = `${base} (${formatIndicatorNumber(indicator.rsiLengthPrimary)}, ${formatIndicatorNumber(indicator.rsiSmoothingPrimary)}, ${formatIndicatorNumber(indicator.qqeFactorPrimary)})`;
      break;
    case 'CHANDELIER_EXIT':
      label = `${base} (${formatIndicatorNumber(indicator.atrPeriod)}, ${formatIndicatorNumber(indicator.atrMult)})`;
      break;
    case 'SSL_CHANNEL':
      label = `${base} (${formatIndicatorNumber(indicator.period)})`;
      break;
    case 'RIPSTER_EMA_CLOUDS':
      label = `${base} (${formatIndicatorNumber(indicator.shortLen1 ?? 8)}/${formatIndicatorNumber(indicator.longLen1 ?? 9)}, ${formatIndicatorNumber(indicator.shortLen2 ?? 5)}/${formatIndicatorNumber(indicator.longLen2 ?? 12)}, ${formatIndicatorNumber(indicator.shortLen3 ?? 34)}/${formatIndicatorNumber(indicator.longLen3 ?? 50)})`;
      break;
    case 'ALPHA_TREND':
      label = `${base} (${formatIndicatorNumber(indicator.coeff)}, ${formatIndicatorNumber(indicator.period)})`;
      break;
    case 'VFI':
      label = `${base} (${formatIndicatorNumber(indicator.length)}, ${formatIndicatorNumber(indicator.coef)}, ${formatIndicatorNumber(indicator.vcoef)}, ${formatIndicatorNumber(indicator.signalLength)})`;
      break;
    case 'HALF_TREND':
      label = `${base} (${formatIndicatorNumber(indicator.amplitude)}, ${formatIndicatorNumber(indicator.channelDeviation)})`;
      break;
    case 'LINREG_CHANNEL':
      label = `${base} (${formatIndicatorNumber(indicator.length)})`;
      break;
    case 'SUPERTREND_AI':
      label = `${base} (${formatIndicatorNumber(indicator.atrLen)}, ${formatIndicatorNumber(indicator.minFactor)}-${formatIndicatorNumber(indicator.maxFactor)})`;
      break;
    case 'ORDER_BLOCKS':
      label = `${base} (${formatIndicatorNumber(indicator.sensitivity)})`;
      break;
    case 'FVG':
      label = `${base} (${formatIndicatorNumber(indicator.lookback)}, ${formatIndicatorNumber(indicator.atrMultiplier)})`;
      break;
    case 'MARKET_CIPHER_B':
      label = `${base} (${formatIndicatorNumber(indicator.wtChannelLen)}, ${formatIndicatorNumber(indicator.wtAvgLen)}, ${formatIndicatorNumber(indicator.rsiMFIPeriod)})`;
      break;
    case 'RANGE_FILTER_DW':
      label = `${base} (${formatIndicatorNumber(indicator.period)}, ${formatIndicatorNumber(indicator.mult)})`;
      break;
    case 'DONCHIAN_RIBBON':
      label = `${base} (${formatIndicatorNumber(indicator.dlen)})`;
      break;
    case 'TRENDLINES_BREAKS':
      label = `${base} (${formatIndicatorNumber(indicator.length)}, ${formatIndicatorNumber(indicator.mult)})`;
      break;
    case 'CM_VIX_FIX':
      label = `${base} (${formatIndicatorNumber(indicator.length)}, ${formatIndicatorNumber(indicator.bbLen)}, ${formatIndicatorNumber(indicator.bbMult)})`;
      break;
    case 'CPR':
    case 'OBV':
    case 'BOP':
    case 'AVGPRICE':
    case 'MEDPRICE':
    case 'TYPPRICE':
    case 'WCLPRICE':
    case 'VWAP':
      label = base;
      break;
    default:
      label = base;
      break;
  }

  // The legacy generic offset and timeframe fields do not shift or resample plots.
  // ALMA and LSMA algorithmic offsets are already represented in their labels above.
  return label;
}

export function getCompactIndicatorDisplayLabel(indicator: ChartIndicator): string {
  return getIndicatorDisplayLabel(indicator)
    .replace(/\s+\(/g, '(')
    .replace(/,\s*/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatIndicatorNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value
    .toFixed(4)
    .replace(/\.?0+$/, '');
}
