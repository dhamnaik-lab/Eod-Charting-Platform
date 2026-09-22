import { getCompactIndicatorDisplayLabel } from './catalog';
import type { ChartIndicator, ChartTimeframe, DrawingLineStyle, IndicatorSource, OHLCBar, OverlayIndicator, PlotStyle } from '@/engine/types';

export interface RenderableLineSeries {
  key: string;
  label: string;
  values: Array<number | null>;
  color: string;
  /** Optional per-bar colors for one logical line that changes color by state. */
  colorValues?: Array<string | null>;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
  plotStyle?: PlotStyle;
  opacity?: number;
  offset?: number;
}

export interface RenderableHistogramSeries {
  key: string;
  label: string;
  values: Array<number | null>;
  positiveColor: string;
  negativeColor: string;
  /** Per-bar fill colors. When present, overrides positiveColor/negativeColor per bar. */
  colorValues?: Array<string | null>;
}

export interface RenderableMarker {
  key: string;
  index: number;
  label: string;
  position: 'above' | 'below';
  color: string;
  title?: string;
}

export interface RenderableOverlay {
  indicator: OverlayIndicator;
  title: string;
  lines: RenderableLineSeries[];
  markers?: RenderableMarker[];
  band?: {
    upper: Array<number | null>;
    lower: Array<number | null>;
    color: string;
    visible?: boolean;
  };
  points?: {
    values: Array<number | null>;
    color: string;
    radius: number;
  };
}

export interface RenderablePane {
  indicator: OverlayIndicator;
  title: string;
  lines: RenderableLineSeries[];
  histogram?: RenderableHistogramSeries;
  referenceLines?: Array<number | RenderableReferenceLine>;
  fixedRange?: {
    min: number;
    max: number;
  };
}

export interface RenderableReferenceLine {
  key: string;
  value: number;
  label?: string;
  color?: string;
  lineWidth?: number;
  lineStyle?: DrawingLineStyle;
}

export interface RenderableIndicatorBundle {
  overlays: RenderableOverlay[];
  panes: RenderablePane[];
}

export interface IndicatorSources {
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
}

export type IndicatorBuilder<T extends ChartIndicator = ChartIndicator> = (
  bars: OHLCBar[],
  indicator: OverlayIndicator & T,
  sources: IndicatorSources,
  sourceSeriesMap?: Map<string, Array<number | null>>,
) => RenderableOverlay | RenderablePane | null;

export const DEFAULT_LINE_COLORS = [
  '#5dafff',
  '#ff9f43',
  '#26a69a',
  '#ef5350',
  '#ab47bc',
  '#f4d35e',
  '#7bdff2',
  '#ff7b72',
  '#b084f5',
  '#9bf6ff',
];

export function padSeries(values: Array<number | null>, totalBars: number): Array<number | null> {
  if (values.length >= totalBars) {
    return values;
  }
  const padding = new Array(totalBars - values.length).fill(null);
  return [...padding, ...values];
}

export function applyOffset(values: Array<number | null>, offset: number): Array<number | null> {
  if (!offset || offset === 0 || !values.length) {
    return values;
  }
  const result: Array<number | null> = new Array(values.length).fill(null);
  for (let i = 0; i < values.length; i++) {
    const targetIdx = i + offset;
    if (targetIdx >= 0 && targetIdx < values.length) {
      result[targetIdx] = values[i];
    }
  }
  return result;
}

export function getSourceValues(
  bars: OHLCBar[],
  source: IndicatorSource = 'close',
  sourceIndicatorId?: string,
  sourceSeriesMap?: Map<string, Array<number | null>>,
): number[] {
  if (sourceIndicatorId && sourceSeriesMap?.has(sourceIndicatorId)) {
    const customSeries = sourceSeriesMap.get(sourceIndicatorId)!;
    return bars.map((bar, index) => {
      const customValue = customSeries[index];
      return typeof customValue === 'number' && Number.isFinite(customValue) ? customValue : bar.close;
    });
  }

  switch (source) {
    case 'open':
      return bars.map((b) => b.open);
    case 'high':
      return bars.map((b) => b.high);
    case 'low':
      return bars.map((b) => b.low);
    case 'hl2':
      return bars.map((b) => (b.high + b.low) / 2);
    case 'hlc3':
      return bars.map((b) => (b.high + b.low + b.close) / 3);
    case 'ohlc4':
      return bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
    case 'close':
    default:
      return bars.map((b) => b.close);
  }
}

export function slidingWindowMax(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(0);
  const deque: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (deque.length > 0 && deque[0] <= i - period) {
      deque.shift();
    }
    while (deque.length > 0 && values[deque[deque.length - 1]] <= values[i]) {
      deque.pop();
    }
    deque.push(i);
    result[i] = values[deque[0]];
  }
  return result;
}

export function slidingWindowMin(values: number[], period: number): number[] {
  const result = new Array(values.length).fill(0);
  const deque: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (deque.length > 0 && deque[0] <= i - period) {
      deque.shift();
    }
    while (deque.length > 0 && values[deque[deque.length - 1]] >= values[i]) {
      deque.pop();
    }
    deque.push(i);
    result[i] = values[deque[0]];
  }
  return result;
}

export function buildLineSeries(
  key: string,
  label: string,
  rawValues: Array<number | null>,
  totalBars: number,
  fallbackColor: string,
  defaultLineWidth = 1.5,
  lineStyle?: DrawingLineStyle,
  plotStyle?: PlotStyle,
  opacity?: number,
  offset?: number,
): RenderableLineSeries {
  const padded = padSeries(rawValues, totalBars);
  const shifted = offset ? applyOffset(padded, offset) : padded;
  return {
    key,
    label,
    values: shifted,
    color: fallbackColor,
    lineWidth: defaultLineWidth,
    lineStyle,
    plotStyle,
    opacity,
    offset,
  };
}

export function getPlotSettings(indicator: OverlayIndicator, plotId: string) {
  return indicator.presentation?.plots?.[plotId];
}

export function isPlotVisible(indicator: OverlayIndicator, plotId: string, defaultVisible = true): boolean {
  const settings = getPlotSettings(indicator, plotId);
  return settings?.visible ?? defaultVisible;
}

export function getPlotLabel(_indicator: OverlayIndicator, _plotId: string, fallback: string): string {
  return fallback;
}

export function getPlotColor(indicator: OverlayIndicator, plotId: string, fallbackColor: string): string {
  const settings = getPlotSettings(indicator, plotId);
  return settings?.color || fallbackColor;
}

export function getPlotSecondaryColor(indicator: OverlayIndicator, plotId: string, fallbackColor: string): string {
  const settings = getPlotSettings(indicator, plotId);
  return settings?.secondaryColor || fallbackColor;
}

export function getPlotLineWidth(indicator: OverlayIndicator, plotId: string, defaultWidth: number): number {
  const settings = getPlotSettings(indicator, plotId);
  return typeof settings?.lineWidth === 'number' ? settings.lineWidth : defaultWidth;
}

export function getPlotLineStyle(indicator: OverlayIndicator, plotId: string): DrawingLineStyle | undefined {
  return getPlotSettings(indicator, plotId)?.lineStyle;
}

export function getPlotStyle(indicator: OverlayIndicator, plotId: string): PlotStyle | undefined {
  return getPlotSettings(indicator, plotId)?.plotStyle;
}

export function getPlotOpacity(indicator: OverlayIndicator, plotId: string): number | undefined {
  return getPlotSettings(indicator, plotId)?.opacity;
}

export function getPlotOffset(indicator: OverlayIndicator, _plotId?: string): number | undefined {
  return indicator.offset;
}

export function getIndicatorReferenceLines(
  indicator: OverlayIndicator,
  defaults: Array<{ id: string; label: string; value: number }>,
): RenderableReferenceLine[] {
  if (!indicator.presentation?.levels?.length) {
    return defaults.map((level) => ({ key: level.id, ...level }));
  }

  const savedLevels = new Map(indicator.presentation.levels.map((level) => [level.id, level]));
  return defaults.reduce<RenderableReferenceLine[]>((lines, level) => {
    const saved = savedLevels.get(level.id);
    if (saved?.visible === false) {
      return lines;
    }

    lines.push({
      key: level.id,
      label: saved?.label ?? level.label,
      value: typeof saved?.value === 'number' ? saved.value : level.value,
      color: saved?.color,
      lineWidth: saved?.lineWidth,
      lineStyle: saved?.lineStyle,
    });
    return lines;
  }, []);
}

export function aggregateBarsToHTF(
  bars: OHLCBar[],
  timeframe: ChartTimeframe,
): { htfBars: OHLCBar[]; indexMap: number[] } {
  if (!bars.length || timeframe === 'D') {
    return { htfBars: bars, indexMap: bars.map((_, i) => i) };
  }

  const htfBars: OHLCBar[] = [];
  const indexMap: number[] = new Array(bars.length);

  let currentKey = '';
  let currentHTF: OHLCBar | null = null;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const key = getHTFKey(bar.date, timeframe);

    if (key !== currentKey || !currentHTF) {
      currentKey = key;
      currentHTF = {
        date: bar.date,
        timestamp: bar.timestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
      };
      htfBars.push(currentHTF);
    } else {
      currentHTF.high = Math.max(currentHTF.high, bar.high);
      currentHTF.low = Math.min(currentHTF.low, bar.low);
      currentHTF.close = bar.close;
      currentHTF.volume += bar.volume;
    }

    indexMap[i] = htfBars.length - 1;
  }

  return { htfBars, indexMap };
}

export function getHTFKey(dateStr: string, timeframe: ChartTimeframe): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();

  if (timeframe === 'W') {
    const jan1 = new Date(year, 0, 1);
    const dayOfYear = Math.floor((date.getTime() - jan1.getTime()) / 86400000);
    const weekNum = Math.ceil((dayOfYear + jan1.getDay() + 1) / 7);
    return `${year}-W${weekNum}`;
  }
  if (timeframe === 'M') {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
  if (timeframe === 'Q') {
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    return `${year}-Q${quarter}`;
  }
  if (timeframe === 'Y') {
    return `${year}`;
  }
  return dateStr;
}
