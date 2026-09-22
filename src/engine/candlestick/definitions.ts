import type { OHLCBar } from '../types';
import type { CandlePropsArrays } from './candleProps';

export type PatternCategory = 'single' | 'double' | 'multi';
export type PatternDirection = 'bullish' | 'bearish' | 'neutral';

export interface PatternDefinition {
  id: string;
  name: string;
  shortLabel: string;
  category: PatternCategory;
  direction: PatternDirection;
  candles: number;
  needsTrend: boolean;
  tooltip: string;
  detect: (p: CandlePropsArrays, i: number, bars: OHLCBar[]) => boolean;
}

const C_FACTOR = 2.0;

export const CANDLESTICK_PATTERN_DEFINITIONS: PatternDefinition[] = [
  // ==========================================
  // 1. SINGLE-CANDLE PATTERNS (15)
  // ==========================================
  {
    id: 'doji',
    name: 'Doji',
    shortLabel: 'DOJ',
    category: 'single',
    direction: 'neutral',
    candles: 1,
    needsTrend: false,
    tooltip: 'Doji: Open and close are virtually equal with balanced shadows, signifying indecision.',
    detect: (p, i) => Boolean(p.doji[i]),
  },
  {
    id: 'dragonfly_doji_bullish',
    name: 'Dragonfly Doji - Bullish',
    shortLabel: 'DF-DOJ',
    category: 'single',
    direction: 'bullish',
    candles: 1,
    needsTrend: false,
    tooltip: 'Dragonfly Doji: Open and close at high with a long lower shadow, indicating strong buying rejection of lows.',
    detect: (p, i) => Boolean(p.isDojiBody[i] && !p.hasUpShadow[i] && p.hasDnShadow[i]),
  },
  {
    id: 'gravestone_doji_bearish',
    name: 'Gravestone Doji - Bearish',
    shortLabel: 'GS-DOJ',
    category: 'single',
    direction: 'bearish',
    candles: 1,
    needsTrend: false,
    tooltip: 'Gravestone Doji: Open and close at low with a long upper shadow, indicating strong selling rejection of highs.',
    detect: (p, i) => Boolean(p.isDojiBody[i] && p.hasUpShadow[i] && !p.hasDnShadow[i]),
  },
  {
    id: 'doji_star_bullish',
    name: 'Doji Star - Bullish',
    shortLabel: 'D-STAR',
    category: 'single',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Doji Star Bullish: A Doji gapping down below a long black candle in a downtrend.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.blackBody[i - 1] &&
          p.doji[i] &&
          bars[i].high < bars[i - 1].close,
      ),
  },
  {
    id: 'doji_star_bearish',
    name: 'Doji Star - Bearish',
    shortLabel: 'D-STAR',
    category: 'single',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Doji Star Bearish: A Doji gapping up above a long white candle in an uptrend.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.upTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.whiteBody[i - 1] &&
          p.doji[i] &&
          bars[i].low > bars[i - 1].close,
      ),
  },
  {
    id: 'hammer_bullish',
    name: 'Hammer - Bullish',
    shortLabel: 'HMR',
    category: 'single',
    direction: 'bullish',
    candles: 1,
    needsTrend: true,
    tooltip: 'Hammer: Small upper body with long lower shadow (>= 2x body) at bottom of downtrend.',
    detect: (p, i, bars) => {
      const hl2 = (bars[i].high + bars[i].low) / 2;
      return Boolean(
        p.smallBody[i] &&
          p.body[i] > 0 &&
          p.bodyLo[i] > hl2 &&
          p.dnShadow[i] >= p.body[i] * C_FACTOR &&
          !p.hasUpShadow[i] &&
          p.downTrend[i],
      );
    },
  },
  {
    id: 'inverted_hammer_bullish',
    name: 'Inverted Hammer - Bullish',
    shortLabel: 'I-HMR',
    category: 'single',
    direction: 'bullish',
    candles: 1,
    needsTrend: true,
    tooltip: 'Inverted Hammer: Small lower body with long upper shadow (>= 2x body) at bottom of downtrend.',
    detect: (p, i, bars) => {
      const hl2 = (bars[i].high + bars[i].low) / 2;
      return Boolean(
        p.smallBody[i] &&
          p.body[i] > 0 &&
          p.bodyHi[i] < hl2 &&
          p.upShadow[i] >= p.body[i] * C_FACTOR &&
          !p.hasDnShadow[i] &&
          p.downTrend[i],
      );
    },
  },
  {
    id: 'hanging_man_bearish',
    name: 'Hanging Man - Bearish',
    shortLabel: 'H-MAN',
    category: 'single',
    direction: 'bearish',
    candles: 1,
    needsTrend: true,
    tooltip: 'Hanging Man: Small upper body with long lower shadow (>= 2x body) at top of uptrend.',
    detect: (p, i, bars) => {
      const hl2 = (bars[i].high + bars[i].low) / 2;
      return Boolean(
        p.smallBody[i] &&
          p.body[i] > 0 &&
          p.bodyLo[i] > hl2 &&
          p.dnShadow[i] >= p.body[i] * C_FACTOR &&
          !p.hasUpShadow[i] &&
          p.upTrend[i],
      );
    },
  },
  {
    id: 'shooting_star_bearish',
    name: 'Shooting Star - Bearish',
    shortLabel: 'STAR',
    category: 'single',
    direction: 'bearish',
    candles: 1,
    needsTrend: true,
    tooltip: 'Shooting Star: Small lower body with long upper shadow (>= 2x body) at top of uptrend.',
    detect: (p, i, bars) => {
      const hl2 = (bars[i].high + bars[i].low) / 2;
      return Boolean(
        p.smallBody[i] &&
          p.body[i] > 0 &&
          p.bodyHi[i] < hl2 &&
          p.upShadow[i] >= p.body[i] * C_FACTOR &&
          !p.hasDnShadow[i] &&
          p.upTrend[i],
      );
    },
  },
  {
    id: 'marubozu_white_bullish',
    name: 'Marubozu White - Bullish',
    shortLabel: 'W-MARU',
    category: 'single',
    direction: 'bullish',
    candles: 1,
    needsTrend: false,
    tooltip: 'Marubozu White: Strong green candle with long body and virtually no shadows.',
    detect: (p, i) =>
      Boolean(p.longBody[i] && p.whiteBody[i] && !p.hasUpShadow[i] && !p.hasDnShadow[i]),
  },
  {
    id: 'marubozu_black_bearish',
    name: 'Marubozu Black - Bearish',
    shortLabel: 'B-MARU',
    category: 'single',
    direction: 'bearish',
    candles: 1,
    needsTrend: false,
    tooltip: 'Marubozu Black: Strong red candle with long body and virtually no shadows.',
    detect: (p, i) =>
      Boolean(p.longBody[i] && p.blackBody[i] && !p.hasUpShadow[i] && !p.hasDnShadow[i]),
  },
  {
    id: 'spinning_top_white',
    name: 'Spinning Top White',
    shortLabel: 'W-STOP',
    category: 'single',
    direction: 'neutral',
    candles: 1,
    needsTrend: false,
    tooltip: 'Spinning Top White: Small green body with long upper and lower shadows.',
    detect: (p, i) =>
      Boolean(
        p.smallBody[i] &&
          p.whiteBody[i] &&
          p.hasUpShadow[i] &&
          p.hasDnShadow[i] &&
          !p.isDojiBody[i],
      ),
  },
  {
    id: 'spinning_top_black',
    name: 'Spinning Top Black',
    shortLabel: 'B-STOP',
    category: 'single',
    direction: 'neutral',
    candles: 1,
    needsTrend: false,
    tooltip: 'Spinning Top Black: Small red body with long upper and lower shadows.',
    detect: (p, i) =>
      Boolean(
        p.smallBody[i] &&
          p.blackBody[i] &&
          p.hasUpShadow[i] &&
          p.hasDnShadow[i] &&
          !p.isDojiBody[i],
      ),
  },
  {
    id: 'long_lower_shadow_bullish',
    name: 'Long Lower Shadow - Bullish',
    shortLabel: 'LL-SHD',
    category: 'single',
    direction: 'bullish',
    candles: 1,
    needsTrend: true,
    tooltip: 'Long Lower Shadow: Lower shadow is at least double the body size in a downtrend.',
    detect: (p, i) =>
      Boolean(
        p.downTrend[i] &&
          p.hasDnShadow[i] &&
          p.dnShadow[i] > p.body[i] * C_FACTOR,
      ),
  },
  {
    id: 'long_upper_shadow_bearish',
    name: 'Long Upper Shadow - Bearish',
    shortLabel: 'LU-SHD',
    category: 'single',
    direction: 'bearish',
    candles: 1,
    needsTrend: true,
    tooltip: 'Long Upper Shadow: Upper shadow is at least double the body size in an uptrend.',
    detect: (p, i) =>
      Boolean(
        p.upTrend[i] &&
          p.hasUpShadow[i] &&
          p.upShadow[i] > p.body[i] * C_FACTOR,
      ),
  },

  // ==========================================
  // 2. TWO-CANDLE PATTERNS (15)
  // ==========================================
  {
    id: 'engulfing_bullish',
    name: 'Engulfing - Bullish',
    shortLabel: 'B-ENG',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Bullish Engulfing: A white candle completely engulfs the prior black candle body in a downtrend.',
    detect: (p, i) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.whiteBody[i] &&
          p.longBody[i] &&
          p.blackBody[i - 1] &&
          p.smallBody[i - 1] &&
          p.bodyHi[i] >= p.bodyHi[i - 1] &&
          p.bodyLo[i] <= p.bodyLo[i - 1] &&
          (p.bodyHi[i] > p.bodyHi[i - 1] || p.bodyLo[i] < p.bodyLo[i - 1]),
      ),
  },
  {
    id: 'engulfing_bearish',
    name: 'Engulfing - Bearish',
    shortLabel: 'S-ENG',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Bearish Engulfing: A black candle completely engulfs the prior white candle body in an uptrend.',
    detect: (p, i) =>
      i >= 1 &&
      Boolean(
        p.upTrend[i - 1] &&
          p.blackBody[i] &&
          p.longBody[i] &&
          p.whiteBody[i - 1] &&
          p.smallBody[i - 1] &&
          p.bodyHi[i] >= p.bodyHi[i - 1] &&
          p.bodyLo[i] <= p.bodyLo[i - 1] &&
          (p.bodyHi[i] > p.bodyHi[i - 1] || p.bodyLo[i] < p.bodyLo[i - 1]),
      ),
  },
  {
    id: 'harami_bullish',
    name: 'Harami - Bullish',
    shortLabel: 'B-HAR',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Bullish Harami: A small white candle completely inside the prior long black candle in a downtrend.',
    detect: (p, i) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.blackBody[i - 1] &&
          p.whiteBody[i] &&
          p.smallBody[i] &&
          p.isInsideBar[i],
      ),
  },
  {
    id: 'harami_bearish',
    name: 'Harami - Bearish',
    shortLabel: 'S-HAR',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Bearish Harami: A small black candle completely inside the prior long white candle in an uptrend.',
    detect: (p, i) =>
      i >= 1 &&
      Boolean(
        p.upTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.whiteBody[i - 1] &&
          p.blackBody[i] &&
          p.smallBody[i] &&
          p.isInsideBar[i],
      ),
  },
  {
    id: 'harami_cross_bullish',
    name: 'Harami Cross - Bullish',
    shortLabel: 'B-HARX',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Bullish Harami Cross: A Doji completely inside the prior long black candle in a downtrend.',
    detect: (p, i) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.blackBody[i - 1] &&
          p.doji[i] &&
          p.isInsideBar[i],
      ),
  },
  {
    id: 'harami_cross_bearish',
    name: 'Harami Cross - Bearish',
    shortLabel: 'S-HARX',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Bearish Harami Cross: A Doji completely inside the prior long white candle in an uptrend.',
    detect: (p, i) =>
      i >= 1 &&
      Boolean(
        p.upTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.whiteBody[i - 1] &&
          p.doji[i] &&
          p.isInsideBar[i],
      ),
  },
  {
    id: 'piercing_bullish',
    name: 'Piercing Line - Bullish',
    shortLabel: 'PRC',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Piercing Line: White candle opens below prior low and closes > 50% into prior black body.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.blackBody[i - 1] &&
          p.longBody[i - 1] &&
          p.whiteBody[i] &&
          p.longBody[i] &&
          bars[i].open < bars[i - 1].low &&
          bars[i].close > (bars[i - 1].open + bars[i - 1].close) / 2 &&
          bars[i].close <= bars[i - 1].open,
      ),
  },
  {
    id: 'dark_cloud_cover_bearish',
    name: 'Dark Cloud Cover - Bearish',
    shortLabel: 'D-CLD',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Dark Cloud Cover: Black candle opens above prior high and closes > 50% into prior white body.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.upTrend[i - 1] &&
          p.whiteBody[i - 1] &&
          p.longBody[i - 1] &&
          p.blackBody[i] &&
          p.longBody[i] &&
          bars[i].open > bars[i - 1].high &&
          bars[i].close < (bars[i - 1].open + bars[i - 1].close) / 2 &&
          bars[i].close >= bars[i - 1].open,
      ),
  },
  {
    id: 'tweezer_bottom_bullish',
    name: 'Tweezer Bottom - Bullish',
    shortLabel: 'TW-BOT',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Tweezer Bottom: Consecutive matching lows in a downtrend.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.blackBody[i - 1] &&
          p.whiteBody[i] &&
          Math.abs(bars[i].low - bars[i - 1].low) <= (p.range[i] + p.range[i - 1]) * 0.05,
      ),
  },
  {
    id: 'tweezer_top_bearish',
    name: 'Tweezer Top - Bearish',
    shortLabel: 'TW-TOP',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Tweezer Top: Consecutive matching highs in an uptrend.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.upTrend[i - 1] &&
          p.whiteBody[i - 1] &&
          p.blackBody[i] &&
          Math.abs(bars[i].high - bars[i - 1].high) <= (p.range[i] + p.range[i - 1]) * 0.05,
      ),
  },
  {
    id: 'kicking_bullish',
    name: 'Kicking - Bullish',
    shortLabel: 'B-KICK',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: false,
    tooltip: 'Bullish Kicking: Black Marubozu followed by gap-up White Marubozu.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.blackBody[i - 1] &&
          !p.hasUpShadow[i - 1] &&
          !p.hasDnShadow[i - 1] &&
          p.whiteBody[i] &&
          !p.hasUpShadow[i] &&
          !p.hasDnShadow[i] &&
          bars[i].open > bars[i - 1].open,
      ),
  },
  {
    id: 'kicking_bearish',
    name: 'Kicking - Bearish',
    shortLabel: 'S-KICK',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: false,
    tooltip: 'Bearish Kicking: White Marubozu followed by gap-down Black Marubozu.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.whiteBody[i - 1] &&
          !p.hasUpShadow[i - 1] &&
          !p.hasDnShadow[i - 1] &&
          p.blackBody[i] &&
          !p.hasUpShadow[i] &&
          !p.hasDnShadow[i] &&
          bars[i].open < bars[i - 1].open,
      ),
  },
  {
    id: 'rising_window_bullish',
    name: 'Rising Window - Bullish',
    shortLabel: 'R-WIN',
    category: 'double',
    direction: 'bullish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Rising Window: Price gap between current low and prior high in an uptrend.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(p.upTrend[i - 1] && bars[i].low > bars[i - 1].high),
  },
  {
    id: 'falling_window_bearish',
    name: 'Falling Window - Bearish',
    shortLabel: 'F-WIN',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'Falling Window: Price gap between current high and prior low in a downtrend.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(p.downTrend[i - 1] && bars[i].high < bars[i - 1].low),
  },
  {
    id: 'on_neck_bearish',
    name: 'On Neck - Bearish',
    shortLabel: 'ON-NCK',
    category: 'double',
    direction: 'bearish',
    candles: 2,
    needsTrend: true,
    tooltip: 'On Neck: Black candle followed by small white candle whose close equals prior low.',
    detect: (p, i, bars) =>
      i >= 1 &&
      Boolean(
        p.downTrend[i - 1] &&
          p.longBody[i - 1] &&
          p.blackBody[i - 1] &&
          p.whiteBody[i] &&
          bars[i].open < bars[i - 1].low &&
          Math.abs(bars[i].close - bars[i - 1].low) <= p.range[i] * 0.1,
      ),
  },

  // ==========================================
  // 3. MULTI-CANDLE PATTERNS (14)
  // ==========================================
  {
    id: 'morning_star_bullish',
    name: 'Morning Star - Bullish',
    shortLabel: 'M-STAR',
    category: 'multi',
    direction: 'bullish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Morning Star: 3-candle bottom reversal (Long Black -> Small Body -> Long White > 50% Black).',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.downTrend[i - 2] &&
          p.longBody[i - 2] &&
          p.blackBody[i - 2] &&
          p.smallBody[i - 1] &&
          p.longBody[i] &&
          p.whiteBody[i] &&
          bars[i].close > (bars[i - 2].open + bars[i - 2].close) / 2,
      ),
  },
  {
    id: 'evening_star_bearish',
    name: 'Evening Star - Bearish',
    shortLabel: 'E-STAR',
    category: 'multi',
    direction: 'bearish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Evening Star: 3-candle top reversal (Long White -> Small Body -> Long Black > 50% White).',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.upTrend[i - 2] &&
          p.longBody[i - 2] &&
          p.whiteBody[i - 2] &&
          p.smallBody[i - 1] &&
          p.longBody[i] &&
          p.blackBody[i] &&
          bars[i].close < (bars[i - 2].open + bars[i - 2].close) / 2,
      ),
  },
  {
    id: 'morning_doji_star_bullish',
    name: 'Morning Doji Star - Bullish',
    shortLabel: 'MD-STAR',
    category: 'multi',
    direction: 'bullish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Morning Doji Star: Morning Star with an isolated Doji middle candle.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.downTrend[i - 2] &&
          p.longBody[i - 2] &&
          p.blackBody[i - 2] &&
          p.doji[i - 1] &&
          bars[i - 1].high < bars[i - 2].close &&
          p.longBody[i] &&
          p.whiteBody[i] &&
          bars[i].close > (bars[i - 2].open + bars[i - 2].close) / 2,
      ),
  },
  {
    id: 'evening_doji_star_bearish',
    name: 'Evening Doji Star - Bearish',
    shortLabel: 'ED-STAR',
    category: 'multi',
    direction: 'bearish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Evening Doji Star: Evening Star with an isolated Doji middle candle.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.upTrend[i - 2] &&
          p.longBody[i - 2] &&
          p.whiteBody[i - 2] &&
          p.doji[i - 1] &&
          bars[i - 1].low > bars[i - 2].close &&
          p.longBody[i] &&
          p.blackBody[i] &&
          bars[i].close < (bars[i - 2].open + bars[i - 2].close) / 2,
      ),
  },
  {
    id: 'abandoned_baby_bullish',
    name: 'Abandoned Baby - Bullish',
    shortLabel: 'B-AB',
    category: 'multi',
    direction: 'bullish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Abandoned Baby Bullish: Rare bottom reversal with Doji gapping below both adjacent candle shadows.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.downTrend[i - 2] &&
          p.blackBody[i - 2] &&
          p.isDojiBody[i - 1] &&
          bars[i - 2].low > bars[i - 1].high &&
          p.whiteBody[i] &&
          bars[i - 1].high < bars[i].low,
      ),
  },
  {
    id: 'abandoned_baby_bearish',
    name: 'Abandoned Baby - Bearish',
    shortLabel: 'S-AB',
    category: 'multi',
    direction: 'bearish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Abandoned Baby Bearish: Rare top reversal with Doji gapping above both adjacent candle shadows.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.upTrend[i - 2] &&
          p.whiteBody[i - 2] &&
          p.isDojiBody[i - 1] &&
          bars[i - 2].high < bars[i - 1].low &&
          p.blackBody[i] &&
          bars[i - 1].low > bars[i].high,
      ),
  },
  {
    id: 'three_white_soldiers_bullish',
    name: 'Three White Soldiers - Bullish',
    shortLabel: '3-SOL',
    category: 'multi',
    direction: 'bullish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Three White Soldiers: 3 consecutive long green candles closing near highs in a steady uptrend.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.whiteBody[i] &&
          p.whiteBody[i - 1] &&
          p.whiteBody[i - 2] &&
          bars[i].close > bars[i - 1].close &&
          bars[i - 1].close > bars[i - 2].close &&
          p.dnShadow[i] < p.body[i] * 0.3 &&
          p.dnShadow[i - 1] < p.body[i - 1] * 0.3 &&
          bars[i].open > bars[i - 1].open &&
          bars[i - 1].open > bars[i - 2].open,
      ),
  },
  {
    id: 'three_black_crows_bearish',
    name: 'Three Black Crows - Bearish',
    shortLabel: '3-CRW',
    category: 'multi',
    direction: 'bearish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Three Black Crows: 3 consecutive long red candles closing near lows in a steady downtrend.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.blackBody[i] &&
          p.blackBody[i - 1] &&
          p.blackBody[i - 2] &&
          bars[i].close < bars[i - 1].close &&
          bars[i - 1].close < bars[i - 2].close &&
          p.upShadow[i] < p.body[i] * 0.3 &&
          p.upShadow[i - 1] < p.body[i - 1] * 0.3 &&
          bars[i].open < bars[i - 1].open &&
          bars[i - 1].open < bars[i - 2].open,
      ),
  },
  {
    id: 'tri_star_bullish',
    name: 'Tri-Star - Bullish',
    shortLabel: 'B-3STR',
    category: 'multi',
    direction: 'bullish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Tri-Star Bullish: 3 consecutive Doji with middle Doji gapping lower in a downtrend.',
    detect: (p, i) =>
      i >= 2 &&
      Boolean(
        p.downTrend[i - 2] &&
          p.doji[i - 2] &&
          p.doji[i - 1] &&
          p.doji[i] &&
          p.bodyLo[i - 1] < p.bodyLo[i - 2] &&
          p.bodyLo[i] > p.bodyLo[i - 1],
      ),
  },
  {
    id: 'tri_star_bearish',
    name: 'Tri-Star - Bearish',
    shortLabel: 'S-3STR',
    category: 'multi',
    direction: 'bearish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Tri-Star Bearish: 3 consecutive Doji with middle Doji gapping higher in an uptrend.',
    detect: (p, i) =>
      i >= 2 &&
      Boolean(
        p.upTrend[i - 2] &&
          p.doji[i - 2] &&
          p.doji[i - 1] &&
          p.doji[i] &&
          p.bodyHi[i - 1] > p.bodyHi[i - 2] &&
          p.bodyHi[i] < p.bodyHi[i - 1],
      ),
  },
  {
    id: 'rising_three_methods_bullish',
    name: 'Rising Three Methods - Bullish',
    shortLabel: 'RTM',
    category: 'multi',
    direction: 'bullish',
    candles: 5,
    needsTrend: true,
    tooltip: 'Rising Three Methods: Long white candle -> 3 small falling bodies inside its range -> Long white breakout.',
    detect: (p, i, bars) =>
      i >= 4 &&
      Boolean(
        p.upTrend[i - 4] &&
          p.longBody[i - 4] &&
          p.whiteBody[i - 4] &&
          p.smallBody[i - 3] &&
          p.blackBody[i - 3] &&
          bars[i - 3].high < bars[i - 4].high &&
          bars[i - 3].low > bars[i - 4].low &&
          p.smallBody[i - 2] &&
          bars[i - 2].high < bars[i - 4].high &&
          bars[i - 2].low > bars[i - 4].low &&
          p.smallBody[i - 1] &&
          bars[i - 1].high < bars[i - 4].high &&
          bars[i - 1].low > bars[i - 4].low &&
          p.longBody[i] &&
          p.whiteBody[i] &&
          bars[i].close > bars[i - 4].close,
      ),
  },
  {
    id: 'falling_three_methods_bearish',
    name: 'Falling Three Methods - Bearish',
    shortLabel: 'FTM',
    category: 'multi',
    direction: 'bearish',
    candles: 5,
    needsTrend: true,
    tooltip: 'Falling Three Methods: Long black candle -> 3 small rising bodies inside its range -> Long black breakdown.',
    detect: (p, i, bars) =>
      i >= 4 &&
      Boolean(
        p.downTrend[i - 4] &&
          p.longBody[i - 4] &&
          p.blackBody[i - 4] &&
          p.smallBody[i - 3] &&
          p.whiteBody[i - 3] &&
          bars[i - 3].high < bars[i - 4].high &&
          bars[i - 3].low > bars[i - 4].low &&
          p.smallBody[i - 2] &&
          bars[i - 2].high < bars[i - 4].high &&
          bars[i - 2].low > bars[i - 4].low &&
          p.smallBody[i - 1] &&
          bars[i - 1].high < bars[i - 4].high &&
          bars[i - 1].low > bars[i - 4].low &&
          p.longBody[i] &&
          p.blackBody[i] &&
          bars[i].close < bars[i - 4].close,
      ),
  },
  {
    id: 'upside_tasuki_gap_bullish',
    name: 'Upside Tasuki Gap - Bullish',
    shortLabel: 'U-TAS',
    category: 'multi',
    direction: 'bullish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Upside Tasuki Gap: Long white candle -> Gap up white candle -> Black candle opening inside body and closing in gap.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.upTrend[i - 2] &&
          p.longBody[i - 2] &&
          p.whiteBody[i - 2] &&
          p.whiteBody[i - 1] &&
          bars[i - 1].open > bars[i - 2].close &&
          p.blackBody[i] &&
          bars[i].open > bars[i - 1].open &&
          bars[i].open < bars[i - 1].close &&
          bars[i].close < bars[i - 1].open &&
          bars[i].close > bars[i - 2].close,
      ),
  },
  {
    id: 'downside_tasuki_gap_bearish',
    name: 'Downside Tasuki Gap - Bearish',
    shortLabel: 'D-TAS',
    category: 'multi',
    direction: 'bearish',
    candles: 3,
    needsTrend: true,
    tooltip: 'Downside Tasuki Gap: Long black candle -> Gap down black candle -> White candle opening inside body and closing in gap.',
    detect: (p, i, bars) =>
      i >= 2 &&
      Boolean(
        p.downTrend[i - 2] &&
          p.longBody[i - 2] &&
          p.blackBody[i - 2] &&
          p.blackBody[i - 1] &&
          bars[i - 1].open < bars[i - 2].close &&
          p.whiteBody[i] &&
          bars[i].open < bars[i - 1].open &&
          bars[i].open > bars[i - 1].close &&
          bars[i].close > bars[i - 1].open &&
          bars[i].close < bars[i - 2].close,
      ),
  },
];
