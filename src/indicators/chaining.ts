import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import type {
  IndicatorSources,
  RenderableIndicatorBundle,
  RenderableOverlay,
  RenderablePane,
} from './base';

type Renderable = RenderableOverlay | RenderablePane;

// Only builders that actually read sourceIndicatorId may use Study-as-Source.
// Other builders cannot truthfully consume an upstream line.
const CHAIN_SOURCE_CONSUMERS = new Set<string>([
  'SMA', 'EMA', 'WMA', 'WEMA', 'DEMA', 'TEMA', 'HMA', 'ALMA',
  'KAMA', 'LSMA', 'VWMA', 'MCGINLEY', 'TWAP', 'BOLL',
  'RSI', 'MACD', 'ROC', 'MOM', 'CMO', 'PPO', 'APO', 'TRIX',
  'COPPOCK', 'DPO', 'STOCHRSI', 'RIPSTER_EMA_CLOUDS',
]);

export function supportsChainedIndicatorSource(kind: string): boolean {
  return CHAIN_SOURCE_CONSUMERS.has(kind);
}

/** Resolves one selected plot, without silently choosing a different line. */
export function getChainedSourceSeries(
  upstream: Renderable,
  plotKey?: string,
): Array<number | null> | null {
  if (plotKey) {
    const line = upstream.lines.find((item) => item.key === plotKey);
    if (line) return line.values;
    if ('histogram' in upstream && upstream.histogram?.key === plotKey) {
      return upstream.histogram.values;
    }
    return null;
  }
  return upstream.lines[0]?.values ?? null;
}

function blankSeries(length: number): Array<number | null> {
  return Array<number | null>(length).fill(null);
}

function createBlankRenderable(segment: Renderable, length: number): Renderable {
  const blank: Renderable = {
    ...segment,
    lines: segment.lines.map((line) => ({
      ...line,
      values: blankSeries(length),
      colorValues: line.colorValues ? Array<string | null>(length).fill(null) : undefined,
    })),
  };
  if ('histogram' in blank && blank.histogram) {
    blank.histogram = {
      ...blank.histogram,
      values: blankSeries(length),
      colorValues: blank.histogram.colorValues
        ? Array<string | null>(length).fill(null)
        : undefined,
    };
  }
  if ('band' in blank && blank.band) {
    blank.band = { ...blank.band, upper: blankSeries(length), lower: blankSeries(length) };
  }
  if ('points' in blank && blank.points) {
    blank.points = { ...blank.points, values: blankSeries(length) };
  }
  if ('markers' in blank && blank.markers) {
    blank.markers = [];
  }
  return blank;
}

function appendSegment(
  combined: Renderable,
  segment: Renderable,
  start: number,
  length: number,
): void {
  for (const sourceLine of segment.lines) {
    let targetLine = combined.lines.find((line) => line.key === sourceLine.key);
    if (!targetLine) {
      targetLine = {
        ...sourceLine,
        values: blankSeries(length),
      };
      combined.lines.push(targetLine);
    }
    for (let i = 0; i < sourceLine.values.length; i += 1) {
      const index = start + i;
      if (index < targetLine.values.length) {
        const value = sourceLine.values[i];
        targetLine.values[index] = typeof value === 'number' && Number.isFinite(value) ? value : null;
      }
    }
    if (sourceLine.colorValues) {
      targetLine.colorValues ??= Array<string | null>(length).fill(null);
      sourceLine.colorValues.forEach((color, i) => {
        if (start + i < length) targetLine.colorValues![start + i] = color;
      });
    }
  }
  if ('histogram' in combined && combined.histogram &&
      'histogram' in segment && segment.histogram) {
    segment.histogram.values.forEach((value, i) => {
      if (start + i < length) {
        combined.histogram!.values[start + i] = typeof value === 'number' && Number.isFinite(value) ? value : null;
      }
    });
    if (segment.histogram.colorValues) {
      combined.histogram.colorValues ??= Array<string | null>(length).fill(null);
      segment.histogram.colorValues.forEach((color, i) => {
        if (start + i < length) combined.histogram!.colorValues![start + i] = color;
      });
    }
  }
  if ('band' in combined && combined.band && 'band' in segment && segment.band) {
    segment.band.upper.forEach((value, i) => {
      if (start + i < length) combined.band!.upper[start + i] = Number.isFinite(value ?? NaN) ? value : null;
    });
    segment.band.lower.forEach((value, i) => {
      if (start + i < length) combined.band!.lower[start + i] = Number.isFinite(value ?? NaN) ? value : null;
    });
  }
  if ('points' in combined && combined.points && 'points' in segment && segment.points) {
    segment.points.values.forEach((value, i) => {
      if (start + i < length) combined.points!.values[start + i] = Number.isFinite(value ?? NaN) ? value : null;
    });
  }
  if ('markers' in combined && combined.markers && 'markers' in segment && segment.markers) {
    combined.markers.push(...segment.markers.map((marker) => ({ ...marker, index: marker.index + start })));
  }
}

/**
 * A dependent indicator is calculated independently on each contiguous valid
 * upstream run. This preserves warmup nulls and resets state at internal gaps.
 * A builder is never handed missing data or a fallback price.
 */
export function buildSegmentedChainedIndicator(
  bars: OHLCBar[],
  indicator: OverlayIndicator,
  sources: IndicatorSources,
  upstreamId: string,
  upstreamValues: Array<number | null>,
  build: (
    segmentBars: OHLCBar[],
    segmentSources: IndicatorSources,
    sourceMap: Map<string, Array<number | null>>,
    onFailure: (cause: unknown) => void,
  ) => Renderable | null,
  onFailure: (cause: unknown) => void,
): Renderable | null {
  let combined: Renderable | null = null;
  let index = 0;
  while (index < bars.length) {
    while (index < bars.length && !Number.isFinite(upstreamValues[index] ?? NaN)) index += 1;
    const start = index;
    while (index < bars.length && Number.isFinite(upstreamValues[index] ?? NaN)) index += 1;
    const end = index;
    if (start === end) break;

    const segmentBars = bars.slice(start, end);
    const segmentSources: IndicatorSources = {
      highs: sources.highs.slice(start, end),
      lows: sources.lows.slice(start, end),
      closes: sources.closes.slice(start, end),
      volumes: sources.volumes.slice(start, end),
    };
    const map = new Map<string, Array<number | null>>([
      [upstreamId, upstreamValues.slice(start, end)],
    ]);
    const segment = build(segmentBars, segmentSources, map, onFailure);
    if (!segment) return null;
    if (!combined) combined = createBlankRenderable(segment, bars.length);
    appendSegment(combined, segment, start, bars.length);
  }
  return combined;
}
