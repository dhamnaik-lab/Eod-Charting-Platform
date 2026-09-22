# Indicator Catalog & Architecture Reference

## Overview & Architecture

The EOD Charting Platform indicator engine features a **fully decentralized, modular 1-file-per-indicator architecture** (`src/indicators/`). Every indicator calculation, type contract, default parameter set, and rendering bundle builder lives in its own isolated TypeScript module.

The system natively supports **118 technical indicators** with full type safety, cached computation bundles, settings dialog schemas, search catalog integration, and automated unit test coverage.

### Directory Structure

```
src/indicators/
├── base.ts                      # Core render types, sliding window deques, plot & line style helpers
├── registry.ts                  # Typed builder registry (INDICATOR_REGISTRY) & caching layer
├── catalog.ts                   # Searchable catalog definitions, group mappings & label formatters
├── index.ts                     # Public barrel exports
├── standard/                    # Standard TradingView & TA indicators
│   ├── moving-averages/         # SMA, EMA, WMA, WEMA, DEMA, TEMA, HMA, ALMA, KAMA, LSMA, VWMA, MCGINLEY, MA_CROSS, MA_RIBBON, TWAP, Price Transforms
│   ├── momentum/                # RSI, MACD, STOCH, STOCHRSI, ROC, MOM, CCI, WILLR, ULTIMATE, CMO, TRIX, APO, PPO, DPO, COPPOCK, AO, TSI, CRSI, RVI, FISHER, SMI_ERGODIC, SMI_ERGODIC_OSC, PRING_SPECIAL_K, RCI, WOODIES_CCI, RCI_RIBBON
│   ├── trend/                   # SUPERTREND, PSAR, ICHIMOKU, ADX, AROON, VORTEX, KST, ELDER_RAY, ALLIGATOR, TREND_STRENGTH
│   ├── volatility/              # BOLL, KELTNER, DONCHIAN, ATR, MASS_INDEX, ENVELOPE, HV, STDEV, RVI_VOL, CHANDE_KROLL, VOLATILITY_STOP, ULCER_INDEX, CHOP, CHOP_ZONE, BBTREND, ADR, BB_WIDTH, BB_PCT_B
│   ├── volume/                  # VWAP, AVWAP, OBV, MFI, CMF, FORCE_INDEX, BOP, VOL_OSC, CHAIKIN_OSC, KVO, PVT, PVI, NVI, CVD, VOLUME_DELTA, RVOL, UP_DOWN_VOL, NET_VOLUME, EOM
│   └── special/                 # CPR, ZIGZAG, PATTERN, CUSTOM, AUTO_KEY_LEVELS, AUTO_TREND, FRACTALS
└── community/                   # Top TradingView Community Scripts (20 Indicators)
    ├── ut-bot.ts                # UT Bot Alerts
    ├── waddah-attar-explosion.ts # Waddah Attar Explosion V2
    ├── squeeze-momentum.ts      # LazyBear Squeeze Momentum
    ├── wavetrend.ts             # LazyBear WaveTrend Oscillator
    ├── qqe-mod.ts               # QQE Mod Dual Oscillator
    ├── chandelier-exit.ts       # Everget Chandelier Exit
    ├── ssl-channel.ts           # SSL Channel
    ├── ripster-ema-clouds.ts    # Ripster EMA Clouds
    ├── alpha-trend.ts           # Kıvanç Özbilgiç AlphaTrend
    ├── volume-flow-indicator.ts # Markos Katsanos Volume Flow Indicator (VFI)
    ├── half-trend.ts            # Everget HalfTrend
    ├── linear-regression-channel.ts # Linear Regression Channel
    ├── supertrend-ai-clustering.ts # LuxAlgo SuperTrend AI Clustering
    ├── order-blocks-signals.ts  # Sonarlab Order Blocks with Signals
    ├── fvg-positioning-average.ts # LuxAlgo Fair Value Gaps (FVG) Positioning Average
    ├── market-cipher-b.ts       # VuManChu Market Cipher B
    ├── range-filter-dw.ts       # Donovan Wall Range Filter
    ├── donchian-trend-ribbon.ts # LonesomeTheBlue Donchian Trend Ribbon
    ├── trendlines-with-breaks.ts # LuxAlgo Trendlines with Breaks
    └── cm-vix-fix.ts            # ChrisMoody Williams Vix Fix V3
```

---

## Placement & Canvas Model

| Placement | Description | Canvas & Scale Behavior |
|---|---|---|
| `overlay` | Rendered directly on the main price chart canvas | Shares primary price Y-axis scale and time-to-coordinate transforms |
| `pane` | Rendered in dedicated sub-panes beneath the main chart | Own dedicated `<canvas>` with independent auto-scaling, drag pan/zoom, and reference levels |

---

## Complete Indicator Reference (118 Indicators)

### 1. Moving Averages & Price Transforms (Overlay & Pane)
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `SMA` | Simple Moving Average | `overlay` | `period: 20` | Arithmetic mean of price |
| `EMA` | Exponential Moving Average | `overlay` | `period: 21` | Exponentially weighted moving average |
| `WMA` | Weighted Moving Average | `overlay` | `period: 20` | Linearly weighted moving average |
| `WEMA` | Wilder's Smoothing (SMMA) | `overlay` | `period: 14` | Modified moving average by J. Welles Wilder |
| `DEMA` | Double Exponential Moving Average | `overlay` | `period: 21` | Double EMA reducing lag ($2 \times \text{EMA} - \text{EMA}(\text{EMA})$) |
| `TEMA` | Triple Exponential Moving Average | `overlay` | `period: 21` | Triple smoothed EMA for ultra-low lag |
| `HMA` | Hull Moving Average | `overlay` | `period: 9` | Alan Hull's responsive, low-lag curve |
| `ALMA` | Arnaud Legoux Moving Average | `overlay` | `period: 9, sigma: 6, offset: 0.85` | Gaussian-filtered curve with adjustable offset |
| `KAMA` | Kaufman Adaptive Moving Average | `overlay` | `period: 10` | Adaptive filter scaling with market noise/efficiency |
| `LSMA` | Least Squares Moving Average | `overlay` | `period: 25, offset: 0` | Linear regression curve with offset projection |
| `VWMA` | Volume Weighted Moving Average | `overlay` | `period: 20` | Moving average weighted by volume |
| `MCGINLEY` | McGinley Dynamic | `overlay` | `period: 14, k: 0.6` | Dynamic tracking curve automatically adjusting to speed |
| `MA_CROSS` | Moving Average Cross | `overlay` | `fastPeriod: 9, slowPeriod: 21, maType: 'EMA'` | Fast vs slow moving average crossover |
| `MA_RIBBON` | Moving Average Ribbon | `overlay` | `period1: 20, period2: 50, period3: 100, period4: 200` | 4-line moving average gradient ribbon |
| `TWAP` | Time-Weighted Average Price | `overlay` | Cumulative / intraday | Cumulative time-weighted average price |
| `AVGPRICE` | Average Price | `overlay` | `(O + H + L + C) / 4` | OHLC4 benchmark price line |
| `MEDPRICE` | Median Price | `overlay` | `(H + L) / 2` | HL2 benchmark price line |
| `TYPPRICE` | Typical Price | `overlay` | `(H + L + C) / 3` | HLC3 benchmark price line |
| `WCLPRICE` | Weighted Close Price | `overlay` | `(H + L + 2*C) / 4` | HLCC4 benchmark price line |

### 2. Momentum & Oscillators (Pane)
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `RSI` | Relative Strength Index | `pane` | `period: 14` | Welles Wilder momentum oscillator [0, 100] |
| `MACD` | Moving Average Convergence Divergence | `pane` | `fast: 12, slow: 26, signal: 9` | MACD line, signal line, and dual-color histogram |
| `STOCH` | Stochastic Oscillator (Full/Slow) | `pane` | `period: 5, smoothK: 3, signalPeriod: 3` | %K line, %D line, overbought/oversold levels |
| `STOCHRSI` | Stochastic RSI | `pane` | `rsiPeriod: 14, stochPeriod: 14, kPeriod: 3, dPeriod: 3` | Stochastic formula applied to RSI values |
| `ROC` | Rate of Change | `pane` | `period: 12` | Percentage price momentum oscillator |
| `MOM` | Momentum Indicator | `pane` | `period: 10` | Absolute price difference oscillator |
| `CCI` | Commodity Channel Index | `pane` | `period: 20` | Cyclic price deviation oscillator |
| `WILLR` | Williams %R | `pane` | `period: 14` | Larry Williams oscillator [-100, 0] |
| `ULTIMATE` | Ultimate Oscillator | `pane` | `short: 7, med: 14, long: 28` | Multi-timeframe weighted pressure oscillator |
| `CMO` | Chande Momentum Oscillator | `pane` | `period: 14` | Tushar Chande pure momentum oscillator [-100, +100] |
| `TRIX` | Triple Exponential Smoothed 1-Day ROC | `pane` | `period: 15` | Triple EMA rate of change |
| `APO` | Absolute Price Oscillator | `pane` | `fast: 12, slow: 26` | Absolute price difference between fast & slow EMAs |
| `PPO` | Percentage Price Oscillator | `pane` | `fast: 12, slow: 26` | Percentage difference between fast & slow EMAs |
| `DPO` | Detrended Price Oscillator | `pane` | `period: 20` | Isolates short-term cycles by removing trend |
| `COPPOCK` | Coppock Curve | `pane` | `wmaPeriod: 10, rocFast: 11, rocSlow: 14` | Long-term cyclical momentum curve |
| `AO` | Awesome Oscillator | `pane` | `fastPeriod: 5, slowPeriod: 34` | Bill Williams 5/34 median price momentum histogram |
| `TSI` | True Strength Index | `pane` | `longLength: 25, shortLength: 13, signalLength: 13` | Double-smoothed momentum oscillator |
| `CRSI` | Connors RSI | `pane` | `rsiLength: 3, upDownLength: 2, rocLength: 100` | Composite 3-component mean-reversion RSI |
| `RVI` | Relative Vigor Index | `pane` | `length: 10` | 4-period symmetric weighted vigor oscillator |
| `FISHER` | Fisher Transform | `pane` | `period: 9` | Normalizes price into Gaussian probability distribution |
| `SMI_ERGODIC` | SMI Ergodic Indicator | `pane` | `longLength: 20, shortLength: 5, signalLength: 5` | Ergodic TSI oscillator with signal line |
| `SMI_ERGODIC_OSC` | SMI Ergodic Oscillator | `pane` | `longLength: 20, shortLength: 5, signalLength: 5` | Histogram of SMI Ergodic vs Signal |
| `PRING_SPECIAL_K` | Martin Pring's Special K | `pane` | Canonical 12-term cyclical model | Multi-timeframe cyclical weighted momentum |
| `RCI` | Rank Correlation Index | `pane` | `period: 9, signalPeriod: 14` | Spearman's rank correlation over price vs time |
| `WOODIES_CCI` | Woodies CCI | `pane` | `cciPeriod: 14, turboPeriod: 6` | Dual CCI + Turbo line with multi-colored histogram |
| `RCI_RIBBON` | RCI Ribbon | `pane` | `shortLength: 10, middleLength: 30, longLength: 50` | Triple RCI ribbon for cyclical turning points |

### 3. Volatility, Bands & Trailing Stops
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `BOLL` | Bollinger Bands | `overlay` | `period: 20, stdDev: 2.0` | Basis, Upper, Lower bands + background fill |
| `KELTNER` | Keltner Channels | `overlay` | `period: 20, multiplier: 2.0` | EMA midline + ATR volatility bands |
| `DONCHIAN` | Donchian Channels | `overlay` | `period: 20` | Rolling High/Low breakout channel |
| `ATR` | Average True Range | `pane` | `period: 14` | Volatility range measurement |
| `MASS_INDEX` | Mass Index | `pane` | `emaPeriod: 9, sumPeriod: 25` | Range bulge reversal detector |
| `ENVELOPE` | Moving Average Envelope | `overlay` | `period: 20, percent: 10%` | Percentage bands around moving average |
| `HV` | Historical Volatility | `pane` | `period: 20, annual: 365` | Annualized standard deviation of log returns |
| `STDEV` | Standard Deviation | `pane` | `period: 20` | Rolling standard deviation of price |
| `RVI_VOL` | Relative Volatility Index | `pane` | `period: 14, signalPeriod: 14` | Directional standard deviation oscillator |
| `CHANDE_KROLL` | Chande Kroll Stop | `overlay` | `atrPeriod: 10, atrMultiplier: 3.0, stopPeriod: 20` | Dual ATR-based trailing stops |
| `VOLATILITY_STOP` | Volatility Stop | `overlay` | `period: 20, multiplier: 2.0` | Dynamic SAR trailing stop |
| `ULCER_INDEX` | Ulcer Index | `pane` | `period: 14` | Downside drawdown depth and risk metric |
| `CHOP` | Choppiness Index | `pane` | `period: 14` | Trending (< 38.2) vs Choppy (> 61.8) fractal oscillator |
| `CHOP_ZONE` | Chop Zone | `pane` | `period: 30` | Color-coded visual zones based on EMA angle |
| `BBTREND` | Bollinger Bands Trend | `pane` | `shortPeriod: 20, longPeriod: 50, stdDev: 2.0` | Dual Bollinger Bands momentum oscillator |
| `ADR` | Average Daily Range | `pane` | `period: 14` | Rolling average high-low price range |
| `BB_WIDTH` | Bollinger Bands Bandwidth | `pane` | `period: 20, stdDev: 2.0` | Bandwidth percentage squeeze detector |
| `BB_PCT_B` | Bollinger Bands %B | `pane` | `period: 20, stdDev: 2.0` | Price relative to upper/lower Bollinger Bands |

### 4. Trend Strength & Direction
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `SUPERTREND` | Supertrend | `overlay` | `period: 10, multiplier: 3.0` | Trailing trendline with dynamic green/red switch |
| `PSAR` | Parabolic SAR | `overlay` | `step: 0.02, max: 0.2` | Trailing stop and reverse price dots |
| `ICHIMOKU` | Ichimoku Cloud | `overlay` | `conversion: 9, base: 26, spanB: 52, lagging: 26` | Tenkan, Kijun, Senkou Span A/B Cloud, Chikou |
| `ADX` | Average Directional Index | `pane` | `period: 14` | ADX line, +DI, -DI with 25 key trend level |
| `AROON` | Aroon Indicator | `pane` | `period: 14` | Aroon Up and Aroon Down lines [0, 100] |
| `VORTEX` | Vortex Indicator | `pane` | `period: 14` | Positive and negative directional flow |
| `KST` | Know Sure Thing | `pane` | Standard multi-ROC weights | Quadruple-smoothed cyclical momentum curve |
| `ELDER_RAY` | Elder-Ray Index | `pane` | `period: 13` | Bull Power & Bear Power vs 13 EMA |
| `ALLIGATOR` | Williams Alligator | `overlay` | `jaw: 13/8, teeth: 8/5, lips: 5/3` | Bill Williams smoothed SMMA moving average lines |
| `TREND_STRENGTH` | Trend Strength Indicator | `pane` | `period: 20` | Pearson correlation between price and time |

### 5. Volume & Order Flow Oscillators
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `VWAP` | Volume Weighted Average Price | `overlay` | Intraday / session | Volume-weighted benchmark price |
| `AVWAP` | Anchored VWAP | `overlay` | `anchorDate` | Volume-weighted average price from specific anchor |
| `OBV` | On-Balance Volume | `pane` | Cumulative volume | Volume accumulation/distribution line |
| `MFI` | Money Flow Index | `pane` | `period: 14` | Volume-weighted RSI oscillator [0, 100] |
| `CMF` | Chaikin Money Flow | `pane` | `period: 20` | Institutional accumulation/distribution oscillator |
| `FORCE_INDEX` | Elder Force Index | `pane` | `period: 13` | Volume-weighted price change oscillator |
| `BOP` | Balance of Power | `pane` | — | Buying vs selling pressure evaluation |
| `VOL_OSC` | Volume Oscillator | `pane` | `fastPeriod: 5, slowPeriod: 10` | Percentage difference between fast & slow Volume EMAs |
| `CHAIKIN_OSC` | Chaikin Oscillator | `pane` | `fastPeriod: 3, slowPeriod: 10` | 3/10 EMA of Accumulation/Distribution line |
| `KVO` | Klinger Volume Oscillator | `pane` | `fastPeriod: 34, slowPeriod: 55, signalPeriod: 13` | Volume force oscillator with signal line |
| `PVT` | Price Volume Trend | `pane` | Cumulative | Cumulative volume scaled by percentage price change |
| `PVI` | Positive Volume Index | `pane` | `signalPeriod: 255` | Tracks crowd activity on high-volume days |
| `NVI` | Negative Volume Index | `pane` | `signalPeriod: 255` | Tracks smart money on quiet/low-volume days |
| `CVD` | Cumulative Volume Delta | `pane` | Cumulative | Net buying vs selling volume pressure |
| `VOLUME_DELTA` | Volume Delta | `pane` | Bar-by-bar | Bar-by-bar delta volume histogram |
| `RVOL` | Relative Volume | `pane` | `period: 20` | Current volume vs rolling average volume |
| `UP_DOWN_VOL` | Up/Down Volume | `pane` | Split volume | Buying vs selling volume with net delta line |
| `NET_VOLUME` | Net Volume | `pane` | Bar-by-bar | Net volume delta histogram |
| `EOM` | Ease of Movement | `pane` | `period: 14, divisor: 10000` | Richard Arms price change to volume friction ratio |

### 6. Special & Key Levels
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `CPR` | Central Pivot Range | `overlay` | Daily / Weekly | Pivot, TC, BC, R1-R4, S1-S4 support/resistance levels |
| `ZIGZAG` | ZigZag | `overlay` | `deviation: 5%` | Connected swing pivot lines filtering noise |
| `PATTERN` | Candlestick Patterns | `overlay` | Pattern selections | 44 official TradingView Japanese Candlestick Patterns (Single, Two, and Multi-candle) |
| `CUSTOM` | Custom Formula | Variable | User Formula | Custom AST formula evaluation engine |
| `AUTO_KEY_LEVELS` | Auto Key Levels | `overlay` | `pivotLength: 20, maxLevels: 6` | Automatic pivot-based support & resistance horizontal levels |
| `AUTO_TREND` | Auto Trend Lines | `overlay` | `pivotLength: 10` | Prevailing trendlines projected from pivot extremes |
| `FRACTALS` | Williams Fractals | `overlay` | `periods: 2` | 5-bar swing high / swing low local extreme markers |

#### Japanese Candlestick Patterns Suite (44 Patterns by Category)
The platform natively detects all 44 official TradingView candlestick patterns categorized explicitly in the UI and engine:

1. **Single-Candle Patterns (15)**:
   - `Doji` (`DOJ` - Neutral), `Dragonfly Doji` (`DF-DOJ` - Bullish), `Gravestone Doji` (`GS-DOJ` - Bearish), `Doji Star Bullish` (`D-STAR`), `Doji Star Bearish` (`D-STAR`), `Hammer` (`HMR` - Bullish), `Inverted Hammer` (`I-HMR` - Bullish), `Hanging Man` (`H-MAN` - Bearish), `Shooting Star` (`STAR` - Bearish), `Marubozu White` (`W-MARU` - Bullish), `Marubozu Black` (`B-MARU` - Bearish), `Spinning Top White` (`W-STOP` - Neutral), `Spinning Top Black` (`B-STOP` - Neutral), `Long Lower Shadow` (`LL-SHD` - Bullish), `Long Upper Shadow` (`LU-SHD` - Bearish).
2. **Two-Candle Patterns (15)**:
   - `Engulfing Bullish` (`B-ENG`), `Engulfing Bearish` (`S-ENG`), `Harami Bullish` (`B-HAR`), `Harami Bearish` (`S-HAR`), `Harami Cross Bullish` (`B-HARX`), `Harami Cross Bearish` (`S-HARX`), `Piercing Line` (`PRC`), `Dark Cloud Cover` (`D-CLD`), `Tweezer Bottom` (`TW-BOT`), `Tweezer Top` (`TW-TOP`), `Kicking Bullish` (`B-KICK`), `Kicking Bearish` (`S-KICK`), `Rising Window` (`R-WIN`), `Falling Window` (`F-WIN`), `On Neck Line` (`ON-NCK`).
3. **Multi-Candle Patterns (14)**:
   - `Morning Star` (`M-STAR`), `Evening Star` (`E-STAR`), `Morning Doji Star` (`MD-STAR`), `Evening Doji Star` (`ED-STAR`), `Abandoned Baby Bullish` (`B-AB`), `Abandoned Baby Bearish` (`S-AB`), `Three White Soldiers` (`3-SOL`), `Three Black Crows` (`3-CRW`), `Tri-Star Bullish` (`B-3STR`), `Tri-Star Bearish` (`S-3STR`), `Rising Three Methods` (`RTM`), `Falling Three Methods` (`FTM`), `Upside Tasuki Gap` (`U-TAS`), `Downside Tasuki Gap` (`D-TAS`).

### 7. Community Indicators (20 Top TradingView Community Scripts)
| Kind | Full Name | Placement | Default Parameters | Description |
|---|---|---|---|---|
| `UT_BOT` | UT Bot Alerts | `overlay` | `keyValue: 1.0, atrPeriod: 10` | QuantNomad's ATR Key Value trailing stop |
| `WADDAH_ATTAR` | Waddah Attar Explosion V2 | `pane` | `sensitivity: 150, fastLength: 20, slowLength: 40, channelLength: 20, bbMult: 2.0` | MACD derivative vs Bollinger Bandwidth explosion line & Dead Zone |
| `SQUEEZE_MOMENTUM` | Squeeze Momentum Indicator | `pane` | `bbLength: 20, bbMult: 2.0, kcLength: 20, kcMult: 1.5` | LazyBear's Bollinger Bands in Keltner Channels squeeze + 4-color LinReg histogram |
| `WAVETREND` | WaveTrend Oscillator | `pane` | `channelLength: 10, averageLength: 21, obLevel1: 60, osLevel1: -60` | LazyBear's dual-smoothed momentum oscillator ($WT_1$, $WT_2$) |
| `QQE_MOD` | QQE Mod | `pane` | `rsiLengthPrimary: 6, rsiSmoothingPrimary: 5, qqeFactorPrimary: 3.0, rsiLengthSecondary: 6, rsiSmoothingSecondary: 5, qqeFactorSecondary: 1.61, bollingerLength: 50, bollingerMultiplier: 0.35` | Mihkel00's dual QQE with dynamic ATR-RSI bands & colored histogram |
| `CHANDELIER_EXIT` | Chandelier Exit | `overlay` | `atrPeriod: 22, atrMult: 3.0, useClose: true` | Everget's continuous ATR-based trailing stop for long & short positions |
| `SSL_CHANNEL` | SSL Channel | `overlay` | `period: 10` | Moving average high/low channel crossover system |
| `RIPSTER_EMA_CLOUDS` | Ripster EMA Clouds | `overlay` | `source: 'hl2', shortLen1: 8, longLen1: 9, shortLen2: 5, longLen2: 12, shortLen3: 34, longLen3: 50` | 5 short/long EMA pairs: (8/9), (5/12), (34/50), (72/89), (180/200) |
| `ALPHA_TREND` | AlphaTrend | `overlay` | `coeff: 1.0, period: 14, useRSI: false` | Kıvanç Özbilgiç's MFI/RSI adaptive trend trailing stop system |
| `VFI` | Volume Flow Indicator | `pane` | `length: 130, coef: 0.2, vcoef: 2.5, signalLength: 5` | Markos Katsanos's volume-confirmed price flow oscillator |
| `HALF_TREND` | HalfTrend | `overlay` | `amplitude: 2, channelDeviation: 2` | Everget's amplitude-filtered non-repainting ATR trendline overlay |
| `LINREG_CHANNEL` | Linear Regression Channel | `overlay` | `length: 100` | High & Low linear regression lines with standard deviation channel bands |
| `SUPERTREND_AI` | SuperTrend AI (Clustering) | `overlay` | `atrLen: 10, minFactor: 1.0, maxFactor: 5.0, factorStep: 0.5, perfAlpha: 10` | LuxAlgo SuperTrend AI k-means performance clustering & factor adaptation |
| `ORDER_BLOCKS` | Order Blocks with Signals | `overlay` | `sensitivity: 28, mitigationType: 'Close'` | Sonarlab institutional supply/demand order blocks via ROC momentum |
| `FVG` | Fair Value Gaps (FVG) Average | `overlay` | `lookback: 30, atrMultiplier: 0.25` | LuxAlgo 3-bar Fair Value Gaps with weighted positioning averages |
| `MARKET_CIPHER_B` | Market Cipher B | `pane` | `wtChannelLen: 9, wtAvgLen: 12, wtMALen: 3, rsiMFIPeriod: 60, rsiMFIMult: 150` | VuManChu multi-layer oscillator (WaveTrend + MFI + VWAP area) |
| `RANGE_FILTER_DW` | Range Filter [DW] | `overlay` | `period: 50, mult: 3.0` | Donovan Wall adaptive EMA range filter with volatility bands |
| `DONCHIAN_RIBBON` | Donchian Trend Ribbon | `pane` | `dlen: 20` | LonesomeTheBlue 10-layer cascading breakout trend momentum matrix |
| `TRENDLINES_BREAKS` | Trendlines with Breaks | `overlay` | `length: 14, mult: 1.0` | LuxAlgo automatic slope-adjusted swing trendlines with breakout detection |
| `CM_VIX_FIX` | CM Williams Vix Fix V3 | `pane` | `length: 22, bbLen: 20, bbMult: 2.0, lookbackPct: 50, pctHighest: 0.85` | ChrisMoody market bottom detector with Bollinger Bands & percentile thresholds |

---

## Validation & Test Coverage

All 118 indicators are thoroughly tested with dedicated unit test suites under `src/engine/__tests__/`:
- `IndicatorsBatch1.test.ts`: LSMA, VWMA, MCGINLEY, ALLIGATOR, MA_CROSS, MA_RIBBON.
- `IndicatorsBatch2.test.ts`: AO, TSI, CRSI, RVI, FISHER, SMI_ERGODIC, SMI_ERGODIC_OSC, PRING_SPECIAL_K, RCI, WOODIES_CCI.
- `IndicatorsBatch3.test.ts`: ENVELOPE, HV, STDEV, RVI_VOL, CHANDE_KROLL, VOLATILITY_STOP, ULCER_INDEX, CHOP, CHOP_ZONE, BBTREND.
- `IndicatorsBatch4.test.ts`: VOL_OSC, CHAIKIN_OSC, KVO, PVT, PVI, NVI, CVD, VOLUME_DELTA, RVOL, UP_DOWN_VOL, NET_VOLUME, EOM.
- `IndicatorsBatch5.test.ts`: TWAP, ADR, AUTO_KEY_LEVELS, AUTO_TREND, FRACTALS, TREND_STRENGTH, RCI_RIBBON, BB_WIDTH, BB_PCT_B.
- `IndicatorsCommunity.test.ts`: UT_BOT, WADDAH_ATTAR, SQUEEZE_MOMENTUM, WAVETREND, QQE_MOD, CHANDELIER_EXIT, SSL_CHANNEL, RIPSTER_EMA_CLOUDS, ALPHA_TREND, VFI, HALF_TREND, LINREG_CHANNEL.
- `IndicatorsCommunityBatch2.test.ts`: SUPERTREND_AI, ORDER_BLOCKS, FVG, MARKET_CIPHER_B, RANGE_FILTER_DW, DONCHIAN_RIBBON, TRENDLINES_BREAKS, CM_VIX_FIX.
- `IndicatorsStochastic.test.ts`, `IndicatorsSupertrend.test.ts`, `IndicatorsMTFOffset.test.ts`, `IndicatorsCache.test.ts`, `IndicatorsNew.test.ts`, `IndicatorsChaining.test.ts`.

**Overall Test Suite**: 94 test files, 533 unit tests passing.
