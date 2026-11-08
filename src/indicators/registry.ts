import type { ChartIndicator, OHLCBar, OverlayIndicator } from '@/engine/types';
import {
  buildLineSeries,
  type IndicatorBuilder,
  type IndicatorCalculationDiagnostic,
  type IndicatorSources,
  type RenderableIndicatorBundle,
  type RenderableOverlay,
  type RenderablePane,
} from './base';
import { pluginHost } from '@/plugins/hostRuntime';
import {
  buildSegmentedChainedIndicator,
  getChainedSourceSeries,
  supportsChainedIndicatorSource,
} from './chaining';

// Moving Averages
import { buildSMA } from './standard/moving-averages/sma';
import { buildEMA } from './standard/moving-averages/ema';
import { buildWMA } from './standard/moving-averages/wma';
import { buildWEMA } from './standard/moving-averages/wema';
import { buildDEMA } from './standard/moving-averages/dema';
import { buildTEMA } from './standard/moving-averages/tema';
import { buildHMA } from './standard/moving-averages/hma';
import { buildALMA } from './standard/moving-averages/alma';
import { buildKAMA } from './standard/moving-averages/kama';
import { buildLSMA } from './standard/moving-averages/lsma';
import { buildVWMA } from './standard/moving-averages/vwma';
import { buildMCGINLEY } from './standard/moving-averages/mcginley-dynamic';
import { buildMA_CROSS } from './standard/moving-averages/ma-cross';
import { buildMA_RIBBON } from './standard/moving-averages/ma-ribbon';
import { buildTWAP } from './standard/moving-averages/twap';
import {
  buildAVGPRICE,
  buildMEDPRICE,
  buildTYPPRICE,
  buildWCLPRICE,
} from './standard/moving-averages/price-transforms';

// Momentum
import { buildRSI } from './standard/momentum/rsi';
import { buildMACD } from './standard/momentum/macd';
import { buildSTOCH } from './standard/momentum/stoch';
import { buildSTOCHRSI } from './standard/momentum/stoch-rsi';
import { buildROC } from './standard/momentum/roc';
import { buildMOM } from './standard/momentum/momentum';
import { buildCCI } from './standard/momentum/cci';
import { buildWILLR } from './standard/momentum/williams-r';
import { buildULTIMATE } from './standard/momentum/ultimate-oscillator';
import { buildCMO } from './standard/momentum/cmo';
import { buildTRIX } from './standard/momentum/trix';
import { buildAPO } from './standard/momentum/apo';
import { buildPPO } from './standard/momentum/ppo';
import { buildDPO } from './standard/momentum/dpo';
import { buildCOPPOCK } from './standard/momentum/coppock';
import { buildAO } from './standard/momentum/awesome-oscillator';
import { buildTSI } from './standard/momentum/tsi';
import { buildCRSI } from './standard/momentum/connors-rsi';
import { buildRVI } from './standard/momentum/rvi';
import { buildFISHER } from './standard/momentum/fisher-transform';
import { buildSMI_ERGODIC } from './standard/momentum/smi-ergodic';
import { buildSMI_ERGODIC_OSC } from './standard/momentum/smi-ergodic-oscillator';
import { buildPRING_SPECIAL_K } from './standard/momentum/prings-special-k';
import { buildRCI } from './standard/momentum/rank-correlation-index';
import { buildWOODIES_CCI } from './standard/momentum/woodies-cci';
import { buildRCI_RIBBON } from './standard/momentum/rci-ribbon';

// Trend
import { buildSUPERTREND } from './standard/trend/supertrend';
import { buildPSAR } from './standard/trend/psar';
import { buildICHIMOKU } from './standard/trend/ichimoku';
import { buildADX } from './standard/trend/adx';
import { buildAROON } from './standard/trend/aroon';
import { buildVORTEX } from './standard/trend/vortex';
import { buildKST } from './standard/trend/kst';
import { buildELDER_RAY } from './standard/trend/elder-ray';
import { buildALLIGATOR } from './standard/trend/alligator';
import { buildTREND_STRENGTH } from './standard/trend/trend-strength';

// Volatility
import { buildBOLL } from './standard/volatility/bollinger';
import { buildKELTNER } from './standard/volatility/keltner';
import { buildDONCHIAN } from './standard/volatility/donchian';
import { buildATR } from './standard/volatility/atr';
import { buildMASS_INDEX } from './standard/volatility/mass-index';
import { buildENVELOPE } from './standard/volatility/envelope';
import { buildHV } from './standard/volatility/historical-volatility';
import { buildSTDEV } from './standard/volatility/standard-deviation';
import { buildRVI_VOL } from './standard/volatility/relative-volatility-index';
import { buildCHANDE_KROLL } from './standard/volatility/chande-kroll-stop';
import { buildVOLATILITY_STOP } from './standard/volatility/volatility-stop';
import { buildULCER_INDEX } from './standard/volatility/ulcer-index';
import { buildCHOP } from './standard/volatility/choppiness';
import { buildCHOP_ZONE } from './standard/volatility/chop-zone';
import { buildBBTREND } from './standard/volatility/bbtrend';
import { buildADR } from './standard/volatility/adr';
import { buildBB_WIDTH } from './standard/volatility/bb-width';
import { buildBB_PCT_B } from './standard/volatility/bb-percent-b';

// Volume
import { buildVWAP } from './standard/volume/vwap';
import { buildAVWAP } from './standard/volume/avwap';
import { buildOBV } from './standard/volume/obv';
import { buildMFI } from './standard/volume/mfi';
import { buildCMF } from './standard/volume/cmf';
import { buildFORCE_INDEX } from './standard/volume/elder-force';
import { buildBOP } from './standard/volume/bop';
import { buildVOL_OSC } from './standard/volume/volume-oscillator';
import { buildCHAIKIN_OSC } from './standard/volume/chaikin-oscillator';
import { buildKVO } from './standard/volume/klinger';
import { buildPVT } from './standard/volume/pvt';
import { buildPVI } from './standard/volume/pvi';
import { buildNVI } from './standard/volume/nvi';
import { buildCVD } from './standard/volume/cumulative-volume-delta';
import { buildVOLUME_DELTA } from './standard/volume/volume-delta';
import { buildRVOL } from './standard/volume/rvol';
import { buildUP_DOWN_VOL } from './standard/volume/up-down-volume';
import { buildNET_VOLUME } from './standard/volume/net-volume';
import { buildEOM } from './standard/volume/ease-of-movement';

// Special
import { buildCPR } from './standard/special/cpr';
import { buildZIGZAG } from './standard/special/zigzag';
import { buildPATTERN } from './standard/special/pattern';
import { buildCUSTOM } from './standard/special/custom';
import { buildAUTO_KEY_LEVELS } from './standard/special/auto-key-levels';
import { buildAUTO_TREND } from './standard/special/auto-trend';
import { buildFRACTALS } from './standard/special/fractals';

// Community Indicators Batch 1
import { buildUT_BOT } from './community/ut-bot';
import { buildWADDAH_ATTAR } from './community/waddah-attar-explosion';
import { buildSQUEEZE_MOMENTUM } from './community/squeeze-momentum';
import { buildWAVETREND } from './community/wavetrend';
import { buildQQE_MOD } from './community/qqe-mod';
import { buildCHANDELIER_EXIT } from './community/chandelier-exit';
import { buildSSL_CHANNEL } from './community/ssl-channel';
import { buildRIPSTER_EMA_CLOUDS } from './community/ripster-ema-clouds';
import { buildALPHA_TREND } from './community/alpha-trend';
import { buildVFI } from './community/volume-flow-indicator';
import { buildHALF_TREND } from './community/half-trend';
import { buildLINREG_CHANNEL } from './community/linear-regression-channel';

// Community Indicators Batch 2
import { buildSUPERTREND_AI } from './community/supertrend-ai-clustering';
import { buildORDER_BLOCKS } from './community/order-blocks-signals';
import { buildFVG } from './community/fvg-positioning-average';
import { buildMARKET_CIPHER_B } from './community/market-cipher-b';
import { buildRANGE_FILTER_DW } from './community/range-filter-dw';
import { buildDONCHIAN_RIBBON } from './community/donchian-trend-ribbon';
import { buildTRENDLINES_BREAKS } from './community/trendlines-with-breaks';
import { buildCM_VIX_FIX } from './community/cm-vix-fix';

export const INDICATOR_REGISTRY: {
  [K in ChartIndicator['kind']]: IndicatorBuilder<Extract<ChartIndicator, { kind: K }>>;
} = {
  SMA: buildSMA,
  EMA: buildEMA,
  WMA: buildWMA,
  WEMA: buildWEMA,
  DEMA: buildDEMA,
  TEMA: buildTEMA,
  HMA: buildHMA,
  ALMA: buildALMA,
  KAMA: buildKAMA,
  LSMA: buildLSMA,
  VWMA: buildVWMA,
  MCGINLEY: buildMCGINLEY,
  ALLIGATOR: buildALLIGATOR,
  MA_CROSS: buildMA_CROSS,
  MA_RIBBON: buildMA_RIBBON,
  TWAP: buildTWAP,
  AVGPRICE: buildAVGPRICE,
  MEDPRICE: buildMEDPRICE,
  TYPPRICE: buildTYPPRICE,
  WCLPRICE: buildWCLPRICE,
  RSI: buildRSI,
  MACD: buildMACD,
  STOCH: buildSTOCH,
  STOCHRSI: buildSTOCHRSI,
  ROC: buildROC,
  MOM: buildMOM,
  CCI: buildCCI,
  WILLR: buildWILLR,
  ULTIMATE: buildULTIMATE,
  CMO: buildCMO,
  TRIX: buildTRIX,
  APO: buildAPO,
  PPO: buildPPO,
  DPO: buildDPO,
  COPPOCK: buildCOPPOCK,
  AO: buildAO,
  TSI: buildTSI,
  CRSI: buildCRSI,
  RVI: buildRVI,
  FISHER: buildFISHER,
  SMI_ERGODIC: buildSMI_ERGODIC,
  SMI_ERGODIC_OSC: buildSMI_ERGODIC_OSC,
  PRING_SPECIAL_K: buildPRING_SPECIAL_K,
  RCI: buildRCI,
  WOODIES_CCI: buildWOODIES_CCI,
  RCI_RIBBON: buildRCI_RIBBON,
  SUPERTREND: buildSUPERTREND,
  PSAR: buildPSAR,
  ICHIMOKU: buildICHIMOKU,
  ADX: buildADX,
  AROON: buildAROON,
  VORTEX: buildVORTEX,
  KST: buildKST,
  ELDER_RAY: buildELDER_RAY,
  TREND_STRENGTH: buildTREND_STRENGTH,
  BOLL: buildBOLL,
  KELTNER: buildKELTNER,
  DONCHIAN: buildDONCHIAN,
  ATR: buildATR,
  MASS_INDEX: buildMASS_INDEX,
  ENVELOPE: buildENVELOPE,
  HV: buildHV,
  STDEV: buildSTDEV,
  RVI_VOL: buildRVI_VOL,
  CHANDE_KROLL: buildCHANDE_KROLL,
  VOLATILITY_STOP: buildVOLATILITY_STOP,
  ULCER_INDEX: buildULCER_INDEX,
  CHOP: buildCHOP,
  CHOP_ZONE: buildCHOP_ZONE,
  BBTREND: buildBBTREND,
  ADR: buildADR,
  BB_WIDTH: buildBB_WIDTH,
  BB_PCT_B: buildBB_PCT_B,
  VWAP: buildVWAP,
  AVWAP: buildAVWAP,
  OBV: buildOBV,
  MFI: buildMFI,
  CMF: buildCMF,
  FORCE_INDEX: buildFORCE_INDEX,
  BOP: buildBOP,
  VOL_OSC: buildVOL_OSC,
  CHAIKIN_OSC: buildCHAIKIN_OSC,
  KVO: buildKVO,
  PVT: buildPVT,
  PVI: buildPVI,
  NVI: buildNVI,
  CVD: buildCVD,
  VOLUME_DELTA: buildVOLUME_DELTA,
  RVOL: buildRVOL,
  UP_DOWN_VOL: buildUP_DOWN_VOL,
  NET_VOLUME: buildNET_VOLUME,
  EOM: buildEOM,
  CPR: buildCPR,
  ZIGZAG: buildZIGZAG,
  PATTERN: buildPATTERN,
  CUSTOM: buildCUSTOM,
  AUTO_KEY_LEVELS: buildAUTO_KEY_LEVELS,
  AUTO_TREND: buildAUTO_TREND,
  FRACTALS: buildFRACTALS,
  UT_BOT: buildUT_BOT,
  WADDAH_ATTAR: buildWADDAH_ATTAR,
  SQUEEZE_MOMENTUM: buildSQUEEZE_MOMENTUM,
  WAVETREND: buildWAVETREND,
  QQE_MOD: buildQQE_MOD,
  CHANDELIER_EXIT: buildCHANDELIER_EXIT,
  SSL_CHANNEL: buildSSL_CHANNEL,
  RIPSTER_EMA_CLOUDS: buildRIPSTER_EMA_CLOUDS,
  ALPHA_TREND: buildALPHA_TREND,
  VFI: buildVFI,
  HALF_TREND: buildHALF_TREND,
  LINREG_CHANNEL: buildLINREG_CHANNEL,
  SUPERTREND_AI: buildSUPERTREND_AI,
  ORDER_BLOCKS: buildORDER_BLOCKS,
  FVG: buildFVG,
  MARKET_CIPHER_B: buildMARKET_CIPHER_B,
  RANGE_FILTER_DW: buildRANGE_FILTER_DW,
  DONCHIAN_RIBBON: buildDONCHIAN_RIBBON,
  TRENDLINES_BREAKS: buildTRENDLINES_BREAKS,
  CM_VIX_FIX: buildCM_VIX_FIX,
};

interface IndicatorCacheBucket {
  dataSignature: string;
  indicatorSetSignature: string;
  renderables: Map<string, RenderableOverlay | RenderablePane>;
}

const indicatorCache = new WeakMap<OHLCBar[], IndicatorCacheBucket>();

/** Upper bound per live bars array; weak-key lifetime and data invalidation remain unchanged. */
export const INDICATOR_CACHE_MAX_RENDERABLES_PER_BARS = 256;

function readCachedRenderable(
  renderables: IndicatorCacheBucket['renderables'],
  key: string,
): RenderableOverlay | RenderablePane | null {
  const cached = renderables.get(key);
  if (!cached) return null;
  // Refresh LRU order on reuse so stable siblings survive repeated settings edits.
  renderables.delete(key);
  renderables.set(key, cached);
  return cached;
}

function retainCachedRenderable(
  renderables: IndicatorCacheBucket['renderables'],
  key: string,
  value: RenderableOverlay | RenderablePane,
): void {
  renderables.delete(key);
  renderables.set(key, value);
  if (renderables.size > INDICATOR_CACHE_MAX_RENDERABLES_PER_BARS) {
    const oldestKey = renderables.keys().next().value;
    if (oldestKey !== undefined) renderables.delete(oldestKey);
  }
}

export function stableSerialize(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? String(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
    .join(',')}}`;
}

export function getIndicatorSettingsSignature(indicator: OverlayIndicator): string {
  return stableSerialize(indicator);
}

export function getIndicatorSetSignature(indicators: OverlayIndicator[]): string {
  return stableSerialize(indicators);
}

function mixNumberHash(hash: number, value: number): number {
  const scaled = Number.isFinite(value) ? Math.round(value * 10000) : 0;
  const low = scaled | 0;
  const high = Math.floor(scaled / 4294967296) | 0;
  let h = Math.imul(hash ^ low, 16777619);
  h = Math.imul(h ^ high, 16777619);
  return h >>> 0;
}

function getBarsMutationSignature(bars: OHLCBar[]): string {
  const len = bars.length;
  if (len === 0) return '0:empty';
  let h1 = 2166136261 >>> 0;
  for (let i = 0; i < len; i += 1) {
    const b = bars[i];
    h1 = mixNumberHash(h1, b.timestamp);
    h1 = mixNumberHash(h1, b.open);
    h1 = mixNumberHash(h1, b.high);
    h1 = mixNumberHash(h1, b.low);
    h1 = mixNumberHash(h1, b.close);
    h1 = mixNumberHash(h1, b.volume);
  }
  const first = bars[0];
  const last = bars[len - 1];
  return [len, first.date, last.date, last.close, h1.toString(16)].join(':');
}

export function getChainedIndicatorCacheKey(
  indicator: OverlayIndicator,
  byId: Map<string, OverlayIndicator>,
  visited = new Set<string>(),
): string {
  const selfSig = getIndicatorSettingsSignature(indicator);
  const srcId = indicator.sourceIndicatorId;
  if (!srcId || visited.has(indicator.id)) {
    return selfSig;
  }
  visited.add(indicator.id);
  const upstream = byId.get(srcId);
  if (!upstream) {
    return selfSig + '::missing:' + srcId;
  }
  return selfSig + '::src:' + getChainedIndicatorCacheKey(upstream, byId, visited);
}

export function getIndicatorCacheBucket(
  bars: OHLCBar[],
  indicators: OverlayIndicator[],
): IndicatorCacheBucket {
  const dataSignature = getBarsMutationSignature(bars);
  const indicatorSetSignature = getIndicatorSetSignature(indicators);
  const existing = indicatorCache.get(bars);

  if (existing && existing.dataSignature === dataSignature) {
    existing.indicatorSetSignature = indicatorSetSignature;
    return existing;
  }

  const fresh: IndicatorCacheBucket = {
    dataSignature,
    indicatorSetSignature,
    renderables: new Map(),
  };
  indicatorCache.set(bars, fresh);
  return fresh;
}

export function buildRenderableIndicator(
  bars: OHLCBar[],
  indicator: OverlayIndicator,
  sources: IndicatorSources,
  sourceSeriesMap?: Map<string, Array<number | null>>,
  onFailure?: (cause: unknown) => void,
): RenderableOverlay | RenderablePane | null {
  if (!bars.length) {
    return null;
  }

  const builder = INDICATOR_REGISTRY[indicator.kind as ChartIndicator['kind']];
  if (!builder) {
    const dynInd = pluginHost
      .listRegisteredIndicators()
      .find((item) => item.id === (indicator.kind as string) || item.id === indicator.id);
    if (!dynInd) {
      onFailure?.(new Error('Indicator implementation unavailable'));
      return null;
    }
    try {
      const rawInputs: Record<string, number | string | boolean> = {};
      if (dynInd.inputs) {
        for (const [k, schema] of Object.entries(dynInd.inputs)) {
          const val = (indicator as Record<string, unknown>)[k];
          rawInputs[k] = typeof val === 'number' || typeof val === 'string' || typeof val === 'boolean' ? val : schema.default;
        }
      }
      const computed = dynInd.calculate(bars, rawInputs);
      const lines = dynInd.plots
        .filter((p) => p.type === 'line')
        .map((p) => buildLineSeries(p.key, p.label, computed[p.key] ?? [], bars.length, p.color, 1.8));
      return {
        indicator,
        title: dynInd.shortLabel || dynInd.name,
        lines,
      };
    } catch (error) {
      onFailure?.(error);
      return null;
    }
  }

  try {
    return (builder as IndicatorBuilder)(bars, indicator as ChartIndicator, sources, sourceSeriesMap);
  } catch (error) {
    onFailure?.(error);
    return null;
  }
}

function describeIndicatorFailure(cause: unknown): string {
  const details = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : '';
  const concise = details.replace(/\s+/g, ' ').trim().slice(0, 160);
  return concise ? `Calculation failed: ${concise}` : 'Calculation failed';
}

export function buildRenderableIndicators(
  bars: OHLCBar[],
  indicators: OverlayIndicator[],
): RenderableIndicatorBundle {
  const visibleIndicators = indicators.filter((i) => i.visible !== false);
  if (!visibleIndicators.length) {
    return { overlays: [], panes: [] };
  }

  const cacheBucket = getIndicatorCacheBucket(bars, indicators);
  const byId = new Map<string, OverlayIndicator>(indicators.map((ind) => [ind.id, ind]));
  const duplicateIds = new Set<string>();
  const seenIds = new Set<string>();
  for (const item of indicators) {
    if (seenIds.has(item.id)) duplicateIds.add(item.id);
    seenIds.add(item.id);
  }

  const needsHydration = visibleIndicators.some(
    (indicator) => !cacheBucket.renderables.has(getChainedIndicatorCacheKey(indicator, byId)),
  );

  const sources: IndicatorSources = needsHydration
    ? {
        highs: bars.map((b) => b.high),
        lows: bars.map((b) => b.low),
        closes: bars.map((b) => b.close),
        volumes: bars.map((b) => b.volume),
      }
    : { highs: [], lows: [], closes: [], volumes: [] };

  type Renderable = RenderableOverlay | RenderablePane;
  const computed = new Map<OverlayIndicator, Renderable | null>();
  const visiting = new Set<OverlayIndicator>();
  const diagnosticByIndicator = new Map<OverlayIndicator, IndicatorCalculationDiagnostic>();

  function report(
    indicator: OverlayIndicator,
    severity: IndicatorCalculationDiagnostic['severity'],
    message: string,
  ): void {
    if (!diagnosticByIndicator.has(indicator)) {
      diagnosticByIndicator.set(indicator, {
        indicatorId: indicator.id,
        indicatorKind: indicator.kind,
        severity,
        message,
      });
    }
  }

  // Compute in dependency order, but leave the visual display order unchanged.
  function compute(indicator: OverlayIndicator): Renderable | null {
    if (indicator.visible === false) return null;
    if (computed.has(indicator)) return computed.get(indicator) ?? null;
    if (visiting.has(indicator)) {
      report(indicator, 'error', 'Circular indicator source dependency');
      return null;
    }

    visiting.add(indicator);
    let renderable: Renderable | null = null;
    let failure: unknown;
    try {
      const cacheKey = getChainedIndicatorCacheKey(indicator, byId);
      const upstreamId = indicator.sourceIndicatorId;

      if (upstreamId) {
        if (!supportsChainedIndicatorSource(indicator.kind)) {
          report(indicator, 'error', 'This indicator does not support Study-as-Source');
        } else {
          const upstream = byId.get(upstreamId);
          if (duplicateIds.has(upstreamId)) {
            report(indicator, 'error', `Source indicator "${upstreamId}" has an ambiguous duplicate ID`);
          } else if (!upstream) {
            report(indicator, 'error', `Source indicator "${upstreamId}" is missing`);
          } else if (upstream.visible === false) {
            report(indicator, 'error', `Source indicator "${upstreamId}" is hidden`);
          } else {
            const parent = compute(upstream);
            if (!parent) {
              report(indicator, 'error', `Source indicator "${upstreamId}" is unavailable or cyclic`);
            } else {
              const values = getChainedSourceSeries(parent, indicator.sourcePlotKey);
              if (!values || values.length !== bars.length) {
                report(indicator, 'error', `Source indicator "${upstreamId}" has no matching aligned plot`);
              } else if (!values.some((value) => typeof value === 'number' && Number.isFinite(value))) {
                report(indicator, 'unavailable', `Source indicator "${upstreamId}" has no valid values yet`);
              } else {
                renderable = readCachedRenderable(cacheBucket.renderables, cacheKey);
                if (!renderable) {
                  const hasGaps = values.some((value) => typeof value !== 'number' || !Number.isFinite(value));
                  renderable = hasGaps
                    ? buildSegmentedChainedIndicator(
                        bars,
                        indicator,
                        sources,
                        upstreamId,
                        values,
                        (segmentBars, segmentSources, sourceMap, onFailure) =>
                          buildRenderableIndicator(segmentBars, indicator, segmentSources, sourceMap, onFailure),
                        (cause) => { failure = cause; },
                      )
                    : buildRenderableIndicator(
                        bars,
                        indicator,
                        sources,
                        new Map([[upstreamId, values]]),
                        (cause) => { failure = cause; },
                      );
                  if (renderable) retainCachedRenderable(cacheBucket.renderables, cacheKey, renderable);
                }
              }
            }
          }
        }
      } else {
        renderable = readCachedRenderable(cacheBucket.renderables, cacheKey);
        if (!renderable) {
          renderable = buildRenderableIndicator(
            bars,
            indicator,
            sources,
            undefined,
            (cause) => { failure = cause; },
          );
          if (renderable) retainCachedRenderable(cacheBucket.renderables, cacheKey, renderable);
        }
      }

      if (!renderable && !diagnosticByIndicator.has(indicator) && bars.length) {
        report(
          indicator,
          failure === undefined ? 'unavailable' : 'error',
          failure === undefined ? 'No output for current bars or settings' : describeIndicatorFailure(failure),
        );
      }
    } catch (error) {
      report(indicator, 'error', describeIndicatorFailure(error));
    } finally {
      visiting.delete(indicator);
      computed.set(indicator, renderable);
    }
    return renderable;
  }

  const bundle: RenderableIndicatorBundle = { overlays: [], panes: [] };
  const diagnosedIds = new Set<string>();
  for (const indicator of indicators) {
    if (indicator.visible === false) continue;
    const result = compute(indicator);
    if (result) {
      if (indicator.placement === 'overlay') {
        bundle.overlays.push(result as RenderableOverlay);
      } else {
        bundle.panes.push(result as RenderablePane);
      }
    }
    const diagnostic = diagnosticByIndicator.get(indicator);
    if (diagnostic && !diagnosedIds.has(indicator.id)) {
      diagnosedIds.add(indicator.id);
      (bundle.diagnostics ??= []).push(diagnostic);
    }
  }
  return bundle;
}
