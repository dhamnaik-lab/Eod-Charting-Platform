import { buildVolumeScaleY, layoutXAxisLabels, niceYTicks, type XAxisTick } from './ScaleManager';
import { hexToRgb, parseColor } from '@/components/common/colorUtils';
import {
  calculateDrawingRangeMetrics,
  calculatePriceRangePercent,
  calculateSlopePerBar,
  calculateVisualAngleDegrees,
  chooseRangeLabelY,
  extendInfiniteLineToRect,
  extendSegmentHorizontally,
} from './DrawingGeometry';
import { FIB_TIME_RATIOS, GANN_BOX_LEVELS, calculateRegressionChannel } from './DrawingAdvancedGeometry';
import {
  buildDisjointChannelSegments,
  buildFlatChannelSegments,
  getArcParameters,
  getRotatedRectangleCorners,
} from './DrawingMultiAnchorGeometry';
import {
  buildPitchfanSegments,
  buildPitchforkSegments,
} from './DrawingD3BGeometry';
import {
  buildF1BFibChannelLevels,
  buildF1BFibTimeZoneLevels,
  buildF1BRetracementLevels,
  buildF1BTrendFibExtensionLevels,
  buildF1BTrendFibTimeLevels,
} from './DrawingF1BGeometry';
import {
  buildF1CFibArcsGeometry,
  buildF1CFibCirclesGeometry,
  buildF1CFibWedgeGeometry,
  projectF1CFibWedgeGeometry,
  type FibArcLabelSide,
  type FibArcLevelGeometry,
  type FibCircleLevelGeometry,
  type FibWedgeLevelGeometry,
} from './DrawingF1CGeometry';
import {
  buildF1DFibSpiralGeometry,
  buildF1DFibSpiralPerpBasis,
  projectF1DFibSpiralGeometry,
} from './DrawingF1DGeometry';
import { buildF1EFibSpeedResistanceFanGeometry } from './DrawingF1EGeometry';
import {
  formatFibonacciCoefficient,
  getFibonacciLevelSlotId,
  getLegacyFibonacciLevelSlotId,
  resolveFibonacciLevels,
  resolveFibonacciOptions,
  type RuntimeFibonacciLevel,
} from './DrawingF1BRuntime';
import {
  createDefaultFibonacciSettings,
  FIB_CIRCLES_DEFAULT_VALUES,
  FIB_RETRACEMENT_DEFAULT_VALUES,
  FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES,
  FIB_WEDGE_DEFAULT_VALUES,
} from './DrawingFibonacciDefaults';
import type { FibonacciSpeedResistanceFanSettings } from './DrawingFibonacciContracts';
import { getNormalizedFibonacciSettings } from './DrawingFibonacciMigration';

import {
  buildPositionPixelGeometry,
  buildProjectionPixelGeometry,
  calculatePositionMetrics,
  calculateProjectionMetrics,
  normalizePositionAnchors,
} from './DrawingD3CGeometry';
import type {
  ChartDrawing,
  ChartMarkerEvent,
  ChartTheme,
  OHLCBar,
  RenderableMarker,
  ScaleX,
  ScaleY,
  Viewport,
  AnchoredDrawingBase,
} from './types';
import type { RenderableReferenceLine } from './Indicators';
import { getDrawingLabelPosition, getEffectiveDrawingExtendRight, isDrawingLabelVisible } from './DrawingCapabilities';
import { resolveDrawingFillPresentationForSlot, resolveDrawingLinePresentationForSlot, resolveDrawingLinePresentation } from './DrawingStyleSchema';
import {
  computeDrawingLevelLabelBox,
  type DrawingLabelSide,
  type DrawingLabelVerticalPlacement,
} from './DrawingLabelLayout';

export interface RenderedChartMarker {
  event: ChartMarkerEvent;
  barIndex: number;
  x: number;
  y: number;
  lane: number;
}

export interface AxisValueTag {
  y: number;
  text: string;
  color: string;
  role?: 'price' | 'overlay' | 'compare' | 'indicator';
}

export interface ResolvedAxisValueTag extends AxisValueTag {
  top: number;
  height: number;
  width: number;
}

export function computeAxisValueTagsLayout(
  tags: AxisValueTag[],
  height: number,
  axisWidth: number,
  avoidOverlap = true,
): ResolvedAxisValueTag[] {
  const labelHeight = 18;
  const sorted = tags
    .filter((tag) => Number.isFinite(tag.y) && tag.text.trim().length > 0)
    .sort((left, right) => left.y - right.y)
    .map((tag) => ({
      ...tag,
      desiredTop: 0,
      top: 0,
      width: 0,
      height: labelHeight,
    }));

  if (!sorted.length) {
    return [];
  }

  const baseGap = 2;
  const minTop = 2;
  const maxTop = Math.max(height - labelHeight - 2, minTop);
  
  const gapBetween = (previous: AxisValueTag | null, current: AxisValueTag): number => {
    if (!previous) {
      return baseGap;
    }
    if (previous.role === 'price' || current.role === 'price') {
      return 6;
    }
    return baseGap;
  };

  sorted.forEach((tag) => {
    // We approximate width here; actual measurement would require ctx.
    // Assuming approx 7px per character for Segoe UI 11px bold, plus padding.
    tag.width = Math.min(axisWidth - 8, Math.max(46, tag.text.length * 7 + 14));
    tag.desiredTop = Math.min(Math.max(tag.y - labelHeight / 2, minTop), maxTop);
    tag.top = tag.desiredTop;
  });

  if (!avoidOverlap) {
    return sorted;
  }

  const priceIndex = sorted.findIndex((tag) => tag.role === 'price');
  const positioned = sorted;

  if (priceIndex >= 0) {
    positioned[priceIndex].top = positioned[priceIndex].desiredTop;

    let nextTop = positioned[priceIndex].top;
    let nextTag: AxisValueTag | null = positioned[priceIndex];
    for (let index = priceIndex - 1; index >= 0; index -= 1) {
      const gap = gapBetween(positioned[index], nextTag);
      positioned[index].top = Math.max(
        minTop,
        Math.min(positioned[index].desiredTop, nextTop - labelHeight - gap),
      );
      nextTop = positioned[index].top;
      nextTag = positioned[index];
    }

    let previousBottom = positioned[priceIndex].top + labelHeight;
    let previousTag: AxisValueTag | null = positioned[priceIndex];
    for (let index = priceIndex + 1; index < positioned.length; index += 1) {
      const gap = gapBetween(previousTag, positioned[index]);
      positioned[index].top = Math.min(
        maxTop,
        Math.max(positioned[index].desiredTop, previousBottom + gap),
      );
      previousBottom = positioned[index].top + labelHeight;
      previousTag = positioned[index];
    }

    for (let index = priceIndex + 1; index < positioned.length; index += 1) {
      const prev = positioned[index - 1];
      const requiredGap = gapBetween(prev, positioned[index]);
      if (positioned[index].top < prev.top + labelHeight + requiredGap) {
        positioned[index].top = Math.min(maxTop, prev.top + labelHeight + requiredGap);
      }
    }

    for (let index = priceIndex - 1; index >= 0; index -= 1) {
      const next = positioned[index + 1];
      const requiredGap = gapBetween(positioned[index], next);
      if (positioned[index].top + labelHeight + requiredGap > next.top) {
        positioned[index].top = Math.max(minTop, next.top - labelHeight - requiredGap);
      }
    }
  } else {
    let previousBottom = minTop - baseGap;
    let previousTag: AxisValueTag | null = null;
    positioned.forEach((tag) => {
      const gap = gapBetween(previousTag, tag);
      if (tag.top < previousBottom + gap) {
        tag.top = previousBottom + gap;
      }
      previousBottom = tag.top + labelHeight;
      previousTag = tag;
    });

    const overflow = previousBottom - (height - 2);
    if (overflow > 0) {
      for (let index = positioned.length - 1; index >= 0; index -= 1) {
        positioned[index].top = Math.max(minTop, positioned[index].top - overflow);
        if (index < positioned.length - 1) {
          const requiredGap = gapBetween(positioned[index], positioned[index + 1]);
          if (positioned[index].top + labelHeight + requiredGap > positioned[index + 1].top) {
            positioned[index].top = Math.max(minTop, positioned[index + 1].top - labelHeight - requiredGap);
          }
        }
      }
    }
  }

  return positioned;
}

export interface LegendToken {
  text: string;
  color: string;
  gapAfter?: number;
}

const FIB_RETRACEMENT_LEVELS = FIB_RETRACEMENT_DEFAULT_VALUES;
const FIB_EXTENSION_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618] as const;
const FIB_FAN_LINES = [
  { label: '0.236', factor: 0.236 },
  { label: '0.382', factor: 0.382 },
  { label: '0.500', factor: 0.5 },
  { label: '0.618', factor: 0.618 },
  { label: '0.786', factor: 0.786 },
  { label: '1.000', factor: 1 },
] as const;
const GANN_FAN_FACTORS = [0.125, 0.25, 1 / 3, 0.5, 1, 2, 3, 4, 8] as const;
const GANN_FAN_LINES = [
  { label: '1x8', factor: 0.125 },
  { label: '1x4', factor: 0.25 },
  { label: '1x3', factor: 1 / 3 },
  { label: '1x2', factor: 0.5 },
  { label: '1x1', factor: 1 },
  { label: '2x1', factor: 2 },
  { label: '3x1', factor: 3 },
  { label: '4x1', factor: 4 },
  { label: '8x1', factor: 8 },
] as const;
const AXIS_FONT = '600 11px "Segoe UI", sans-serif';
const LEGEND_FONT = '600 11px "Segoe UI", sans-serif';
const PANE_TITLE_FONT = '700 11px Consolas, "SFMono-Regular", "Courier New", monospace';
const FORMATTER_CACHE = new Map<string, Intl.NumberFormat>();

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scaleY: ScaleY,
  theme: ChartTheme,
): void {
  const { ticks } = niceYTicks(scaleY.min, scaleY.max, height);
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1;
  ticks.forEach((tick) => {
    const y = Math.floor(scaleY.toPixel(tick)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });
}

export function drawBackgroundZones(
  ctx: CanvasRenderingContext2D,
  zones: Array<{ startIndex: number; endIndex: number; color: string }>,
  viewport: Viewport,
  scaleX: ScaleX,
  height: number,
): void {
  ctx.save();
  zones.forEach((zone) => {
    // Only draw if it overlaps the viewport
    if (zone.endIndex < viewport.startIndex || zone.startIndex > viewport.endIndex) {
      return;
    }
    const startX = Math.floor(scaleX.toPixel(Math.max(zone.startIndex - 0.5, viewport.startIndex - 0.5)));
    const endX = Math.ceil(scaleX.toPixel(Math.min(zone.endIndex + 0.5, viewport.endIndex + 0.5)));
    
    ctx.fillStyle = zone.color;
    ctx.fillRect(startX, 0, endX - startX, height);
  });
  ctx.restore();
}

export function drawVerticalGrid(
  ctx: CanvasRenderingContext2D,
  ticks: XAxisTick[],
  scaleX: ScaleX,
  height: number,
  theme: ChartTheme,
): void {
  ctx.save();
  
  // Draw session highlights
  if (theme.sessionHighlight) {
    let highlight = false;
    for (let i = 0; i < ticks.length; i++) {
      const tick = ticks[i];
      if (tick.isMajor) {
        highlight = !highlight;
      }
      if (highlight) {
        const startX = Math.floor(scaleX.toPixel(tick.index));
        const nextX = i + 1 < ticks.length ? Math.floor(scaleX.toPixel(ticks[i + 1].index)) : ctx.canvas.width;
        ctx.fillStyle = theme.sessionHighlight;
        ctx.fillRect(startX, 0, nextX - startX, height);
      }
    }
  }

  // Draw grid lines
  ctx.lineWidth = 1;
  ticks.forEach((tick) => {
    const x = Math.floor(scaleX.toPixel(tick.index)) + 0.5;
    ctx.strokeStyle = tick.isMajor ? theme.gridLineMajor : theme.gridLine;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  });
  ctx.restore();
}

export function drawYAxis(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scaleY: ScaleY,
  theme: ChartTheme,
  axisWidth = 56,
  axisGap = 0,
  topReserved = 0,
  isManual = false,
  isLog = false,
  drawBackground = true,
  occupiedRanges: Array<{ top: number; bottom: number }> = [],
  alignment: 'left' | 'right' = 'right',
  minimumFractionDigits = 0,
  formatTick = formatPrice,
): void {
  const axisX = alignment === 'right' ? width - axisWidth - axisGap : 0;
  const { ticks, step } = niceYTicks(scaleY.min, scaleY.max, height);
  const precision = Math.max(getPrecisionFromStep(step), minimumFractionDigits);
  const labelInset = 8;
  const topLabelBoundary = Math.max(labelInset, topReserved + labelInset);

  if (drawBackground) {
    ctx.fillStyle = theme.axisBackground;
    ctx.fillRect(Math.floor(axisX), 0, Math.ceil(axisWidth), height);
    ctx.strokeStyle = theme.panelBorder;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.floor(axisX) + 0.5, 0);
    ctx.lineTo(Math.floor(axisX) + 0.5, height);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(axisX, 0, axisWidth, height);
  ctx.clip();
  ctx.fillStyle = theme.axisText;
  ctx.font = AXIS_FONT;
  ctx.textAlign = alignment === 'right' ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  const labelHeight = 16;
  const halfLabelHeight = labelHeight / 2;

  ticks.forEach((tick) => {
    const yPixel = scaleY.toPixel(tick);
    const y = Math.floor(yPixel) + 0.5;
    if (yPixel < topLabelBoundary || yPixel > height - labelInset) {
      return;
    }

    const labelTop = yPixel - halfLabelHeight;
    const labelBottom = yPixel + halfLabelHeight;
    const padding = 2;
    const isColliding = occupiedRanges.some(
      (range) => !(labelBottom + padding < range.top || labelTop - padding > range.bottom)
    );

    if (isColliding) {
      return;
    }

    const textX = alignment === 'right' ? axisX + axisWidth - 7 : axisX + 7;
    ctx.fillText(formatTick(tick, precision, precision), textX, yPixel);
    ctx.strokeStyle = theme.gridLineMajor;
    ctx.beginPath();
    ctx.moveTo(axisX, y);
    ctx.lineTo(axisX + 6, y);
    ctx.stroke();
  });
  // Render only non-default scale status badges at the bottom.
  const badgeSize = 18;
  const currentBadgeX = alignment === 'right' ? axisX + axisWidth - badgeSize - 6 : axisX + 6;
  const badgeY = height - badgeSize - 6;

  if (isLog) {
    drawAxisBadge(ctx, 'L', currentBadgeX, badgeY, badgeSize, '#2196f3', '#ffffff');
  }

  ctx.restore();
}

function drawAxisBadge(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  bgColor: string,
  textColor: string,
): void {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  ctx.roundRect(x, y, size, size, 4);
  ctx.fill();
  ctx.fillStyle = textColor;
  ctx.font = 'bold 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size / 2, y + size / 2);
}

export function drawXAxis(
  ctx: CanvasRenderingContext2D,
  ticks: XAxisTick[],
  scaleX: ScaleX,
  width: number,
  height: number,
  theme: ChartTheme,
  axisHeight = 24,
): void {
  const top = height - axisHeight;
  ctx.fillStyle = theme.axisBackground;
  ctx.fillRect(0, top, width, axisHeight);
  ctx.strokeStyle = theme.panelBorder;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, Math.floor(top) + 0.5);
  ctx.lineTo(width, Math.floor(top) + 0.5);
  ctx.stroke();

  ctx.font = '600 12px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, top, width, axisHeight);
  ctx.clip();
  const labels = layoutXAxisLabels(ticks, scaleX, width, (tick) => {
    ctx.font = tick.isMajor ? '700 11px "Segoe UI", sans-serif' : '600 12px "Segoe UI", sans-serif';
    return ctx.measureText(tick.label).width;
  });
  labels.forEach(({ tick, x: labelX }) => {
    const xPixel = scaleX.toPixel(tick.index);
    const x = Math.floor(xPixel) + 0.5;
    if (tick.isMajor) {
      ctx.fillStyle = tick.isYear
        ? resolveHighContrastText(theme.axisBackground)
        : theme.axisText;
      ctx.font = '700 11px "Segoe UI", sans-serif';
    } else {
      ctx.fillStyle = theme.axisText;
      ctx.font = '600 12px "Segoe UI", sans-serif';
    }
    ctx.fillText(tick.label, labelX, height - axisHeight / 2);

    if (tick.isMajor) {
      ctx.strokeStyle = theme.gridLineMajor;
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x, top + 6);
      ctx.stroke();
    }
  });
  ctx.restore();
}

export function drawVolumeProfile(
  ctx: CanvasRenderingContext2D,
  buckets: import('./types').VolumeProfileBucket[],
  scaleY: ScaleY,
  chartWidth: number,
  config: import('./types').VolumeProfileConfig,
): void {
  if (buckets.length === 0) return;
  const maxVolume = Math.max(...buckets.map((b) => b.totalVolume));
  if (maxVolume <= 0) return;

  const maxBarWidth = chartWidth * (config.maxWidth ?? 0.25);
  const isLeft = (config.alignment ?? 'left') === 'left';

  ctx.save();
  buckets.forEach((bucket) => {
    const topY = scaleY.toPixel(bucket.priceTop);
    const bottomY = scaleY.toPixel(bucket.priceBottom);
    const barHeight = Math.max(Math.abs(bottomY - topY) - 1, 1);
    const barWidth = (bucket.totalVolume / maxVolume) * maxBarWidth;

    const x = isLeft ? 0 : chartWidth - barWidth;
    const y = Math.min(topY, bottomY);

    // Draw buy portion
    const buyWidth = bucket.totalVolume > 0 ? (bucket.buyVolume / bucket.totalVolume) * barWidth : 0;
    ctx.fillStyle = config.upColor ?? 'rgba(34, 197, 94, 0.18)';
    ctx.fillRect(x, y, buyWidth, barHeight);

    // Draw sell portion
    ctx.fillStyle = config.downColor ?? 'rgba(239, 68, 68, 0.18)';
    ctx.fillRect(x + buyWidth, y, barWidth - buyWidth, barHeight);

    // POC highlight
    if (bucket.isPOC) {
      ctx.strokeStyle = config.pocColor ?? 'rgba(255, 193, 7, 0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barWidth, barHeight);
    }
  });
  ctx.restore();
}

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  theme: ChartTheme,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);
  const bodyWidth = bars.length === 1 ? Math.min(scaleX.bodyWidth, 16) : scaleX.bodyWidth;

  for (let index = start; index <= end; index += 1) {
    const bar = bars[index];
    const xPixel = scaleX.toPixel(index);
    const x = Math.floor(xPixel) + 0.5;
    const isUp = bar.close >= bar.open;
    const wickColor = isUp ? theme.wickUp : theme.wickDown;
    const bodyColor = isUp ? theme.candleUp : theme.candleDown;
    const highY = scaleY.toPixel(bar.high);
    const lowY = scaleY.toPixel(bar.low);
    const openY = scaleY.toPixel(bar.open);
    const closeY = scaleY.toPixel(bar.close);

    ctx.strokeStyle = wickColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    ctx.fillStyle = bodyColor;
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 1);
    const bodyLeft = Math.round(xPixel - bodyWidth / 2);
    const bodyW = Math.round(bodyWidth);
    const bodyH = Math.round(bodyHeight);
    const radius = Math.min(3, bodyW / 4, bodyH / 4);
    
    if (radius > 0.5 && bodyH > 3) {
      ctx.beginPath();
      ctx.roundRect(bodyLeft, Math.round(bodyTop), bodyW, bodyH, radius);
      ctx.fill();
    } else {
      ctx.fillRect(bodyLeft, Math.round(bodyTop), bodyW, bodyH);
    }
  }
}

export type TextResizeHandle =
  | 'text-nw'
  | 'text-n'
  | 'text-ne'
  | 'text-e'
  | 'text-se'
  | 'text-s'
  | 'text-sw'
  | 'text-w';

export interface TextBoxBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getTextBoxBounds(
  drawing: Extract<ChartDrawing, { kind: 'text' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
): TextBoxBounds {
  if (drawing.renderTextBox) return drawing.renderTextBox;
  const fontSize = Math.max(10, Math.min(drawing.fontSize ?? 13, 28));
  const width = Math.max(60, drawing.width ?? Math.max(80, approximateTextWidth(drawing.text, fontSize) + 8));
  const height = Math.max(fontSize + 8, drawing.height ?? fontSize + 8);
  const x = scaleX.toPixel(drawing.barIndex);
  const y = scaleY.toPixel(drawing.price);
  return { left: x + 2, top: y - 4 - height, width, height };
}

export function drawRenkoBricks(
  ctx: CanvasRenderingContext2D,
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  theme: ChartTheme,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);

  for (let index = start; index <= end; index += 1) {
    const bar = bars[index];
    const xPixel = scaleX.toPixel(index);
    const direction = bar.renkoDirection ?? (bar.close >= bar.open ? 'up' : 'down');
    const isUp = direction === 'up';
    const isProjection = bar.renkoComplete === false;
    const bodyColor = isUp
      ? (theme.renkoUp ?? theme.candleUp)
      : (theme.renkoDown ?? theme.candleDown);
    const projectionColor = isUp
      ? (theme.renkoProjectionUp ?? 'rgba(34, 197, 94, 0.36)')
      : (theme.renkoProjectionDown ?? 'rgba(239, 68, 68, 0.36)');
    const projectionBorderColor = isUp
      ? (theme.renkoProjectionUpBorder ?? 'rgba(34, 197, 94, 0.88)')
      : (theme.renkoProjectionDownBorder ?? 'rgba(239, 68, 68, 0.88)');
    const bodyTop = Math.min(scaleY.toPixel(bar.open), scaleY.toPixel(bar.close));
    const bodyHeight = Math.max(Math.abs(scaleY.toPixel(bar.close) - scaleY.toPixel(bar.open)), 1);
    const bodyLeft = Math.round(xPixel - scaleX.bodyWidth / 2);
    const bodyWidth = Math.max(1, Math.round(scaleX.bodyWidth));

    if (bar.high !== Math.max(bar.open, bar.close) || bar.low !== Math.min(bar.open, bar.close)) {
      const wickX = Math.floor(xPixel) + 0.5;
      ctx.strokeStyle = isUp
        ? (theme.renkoWickUp ?? theme.wickUp)
        : (theme.renkoWickDown ?? theme.wickDown);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(wickX, scaleY.toPixel(bar.high));
      ctx.lineTo(wickX, scaleY.toPixel(bar.low));
      ctx.stroke();
    }

    ctx.fillStyle = isProjection ? projectionColor : bodyColor;
    ctx.fillRect(bodyLeft, Math.round(bodyTop), bodyWidth, Math.round(bodyHeight));

    if (isProjection) {
      ctx.strokeStyle = projectionBorderColor;
      ctx.lineWidth = 1;
      ctx.strokeRect(bodyLeft + 0.5, Math.round(bodyTop) + 0.5, Math.max(1, bodyWidth - 1), Math.max(1, Math.round(bodyHeight) - 1));
    }
  }
}

export function drawBars(
  ctx: CanvasRenderingContext2D,
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  theme: ChartTheme,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);
  const tickLen = Math.max(3, scaleX.bodyWidth / 2);

  for (let i = start; i <= end; i++) {
    const bar = bars[i];
    const x = Math.floor(scaleX.toPixel(i)) + 0.5;
    const isUp = bar.close >= bar.open;
    const color = isUp ? theme.candleUp : theme.candleDown;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical high-low line
    ctx.moveTo(x, scaleY.toPixel(bar.high));
    ctx.lineTo(x, scaleY.toPixel(bar.low));
    // Open tick (left)
    const openY = Math.floor(scaleY.toPixel(bar.open)) + 0.5;
    ctx.moveTo(x - tickLen, openY);
    ctx.lineTo(x, openY);
    // Close tick (right)
    const closeY = Math.floor(scaleY.toPixel(bar.close)) + 0.5;
    ctx.moveTo(x, closeY);
    ctx.lineTo(x + tickLen, closeY);
    ctx.stroke();
  }
}

export function drawVolume(
  ctx: CanvasRenderingContext2D,
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  paneHeight: number,
  paneTop: number,
  theme: ChartTheme,
): void {
  const scale = buildVolumeScaleY(bars, viewport.startIndex, viewport.endIndex, paneHeight);
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);
  const bodyWidth = bars.length === 1 ? Math.min(scaleX.bodyWidth, 16) : scaleX.bodyWidth;

  for (let index = start; index <= end; index += 1) {
    const bar = bars[index];
    const xPixel = scaleX.toPixel(index);
    const isUp = bar.close >= bar.open;
    const yPixel = paneTop + scale.toPixel(bar.volume);
    ctx.fillStyle = isUp ? theme.volumeUp : theme.volumeDown;
    ctx.fillRect(
      Math.round(xPixel - bodyWidth / 2),
      Math.round(yPixel),
      Math.round(bodyWidth),
      Math.round(paneHeight - (yPixel - paneTop)),
    );
  }
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  values: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  color: string,
  lineWidth = 1.5,
  lineStyle?: ChartDrawing['lineStyle'],
  plotStyle: import('./types').PlotStyle = 'line',
  opacity?: number,
  colorValues?: Array<string | null>,
): void {
  if (!values.length) return;

  ctx.save();
  if (typeof opacity === 'number' && opacity >= 0 && opacity <= 1) {
    ctx.globalAlpha = opacity;
  }
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(getLineDash(lineStyle));

  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), values.length - 1);

  if (plotStyle === 'circles' || plotStyle === 'cross') {
    for (let index = start; index <= end; index += 1) {
      const value = values[index];
      if (value === null) continue;
      const pointColor = colorValues?.[index] ?? color;
      ctx.strokeStyle = pointColor;
      ctx.fillStyle = pointColor;
      const x = scaleX.toPixel(index);
      const y = scaleY.toPixel(value);
      if (plotStyle === 'circles') {
        ctx.beginPath();
        ctx.arc(x, y, Math.max(lineWidth * 1.5, 2.5), 0, Math.PI * 2);
        ctx.fill();
      } else {
        const size = Math.max(lineWidth * 2, 4);
        ctx.beginPath();
        ctx.moveTo(x - size, y);
        ctx.lineTo(x + size, y);
        ctx.moveTo(x, y - size);
        ctx.lineTo(x, y + size);
        ctx.stroke();
      }
    }
    ctx.restore();
    return;
  }

  ctx.beginPath();
  let hasPoint = false;
  let prevY = 0;
  let activeColor = color;
  for (let index = start; index <= end; index += 1) {
    const value = values[index];
    if (value === null) {
      if (hasPoint) ctx.stroke();
      ctx.beginPath();
      hasPoint = false;
      continue;
    }
    const x = scaleX.toPixel(index);
    const y = scaleY.toPixel(value);
    const pointColor = colorValues?.[index] ?? color;

    if (hasPoint && pointColor !== activeColor) {
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      activeColor = pointColor;
    } else if (!hasPoint) {
      ctx.moveTo(x, y);
      hasPoint = true;
      activeColor = pointColor;
      prevY = y;
      continue;
    }

    ctx.strokeStyle = activeColor;

    if (plotStyle === 'stepline') {
      ctx.lineTo(x, prevY);
      ctx.lineTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    hasPoint = true;
    prevY = y;
  }
  if (hasPoint) {
    ctx.strokeStyle = activeColor;
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBandFills(
  ctx: CanvasRenderingContext2D,
  upperValues: Array<number | null>,
  lowerValues: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  fillColor: string,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), Math.min(upperValues.length, lowerValues.length) - 1);
  if (start > end) return;

  const pointsUpper: Array<{ x: number; y: number }> = [];
  const pointsLower: Array<{ x: number; y: number }> = [];

  for (let i = start; i <= end; i++) {
    const u = upperValues[i];
    const l = lowerValues[i];
    if (u !== null && l !== null) {
      const x = scaleX.toPixel(i);
      pointsUpper.push({ x, y: scaleY.toPixel(u) });
      pointsLower.push({ x, y: scaleY.toPixel(l) });
    }
  }

  if (pointsUpper.length < 2) return;

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(pointsUpper[0].x, pointsUpper[0].y);
  for (let i = 1; i < pointsUpper.length; i++) {
    ctx.lineTo(pointsUpper[i].x, pointsUpper[i].y);
  }
  for (let i = pointsLower.length - 1; i >= 0; i--) {
    ctx.lineTo(pointsLower[i].x, pointsLower[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawArea(
  ctx: CanvasRenderingContext2D,
  values: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  lineColor: string,
  fillTopColor: string,
  fillBottomColor: string,
  lineWidth = 1.8,
  paneHeight: number,
): void {
  const points: Array<{ x: number; y: number }> = [];
  for (let index = Math.max(Math.floor(viewport.startIndex), 0); index <= Math.min(Math.ceil(viewport.endIndex), values.length - 1); index += 1) {
    const value = values[index];
    if (value !== null) {
      points.push({ x: scaleX.toPixel(index), y: scaleY.toPixel(value) });
    }
  }
  if (points.length < 2) {
    return;
  }

  // Fill area: build closed path from line to bottom
  ctx.save();
  const topY = Math.min(...points.map((p) => p.y));
  const gradient = ctx.createLinearGradient(0, topY, 0, paneHeight);
  gradient.addColorStop(0, fillTopColor);
  gradient.addColorStop(1, fillBottomColor);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, paneHeight);
  ctx.lineTo(points[0].x, paneHeight);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw line on top
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
}

export function drawHLCArea(
  ctx: CanvasRenderingContext2D,
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  theme: ChartTheme,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);

  if (start > end || bars.length === 0) return;

  // 1. Shaded area between High and Low
  ctx.fillStyle = 'rgba(79, 167, 255, 0.08)';
  ctx.beginPath();
  
  // Forward pass: high line
  for (let i = start; i <= end; i++) {
    const x = scaleX.toPixel(i);
    const y = scaleY.toPixel(bars[i].high);
    i === start ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  
  // Reverse pass: low line
  for (let i = end; i >= start; i--) {
    ctx.lineTo(scaleX.toPixel(i), scaleY.toPixel(bars[i].low));
  }
  
  ctx.closePath();
  ctx.fill();

  // 2. High line (subtle)
  drawLine(ctx, bars.map((b) => b.high), viewport, scaleX, scaleY, 'rgba(79, 167, 255, 0.3)', 1);

  // 3. Low line (subtle)
  drawLine(ctx, bars.map((b) => b.low), viewport, scaleX, scaleY, 'rgba(79, 167, 255, 0.3)', 1);

  // 4. Close line (prominent)
  drawLine(ctx, bars.map((b) => b.close), viewport, scaleX, scaleY, '#5dafff', 1.8);
}

export function drawBaseline(
  ctx: CanvasRenderingContext2D,
  values: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  baselinePrice: number,
  aboveColor: string,
  belowColor: string,
  lineWidth = 1.8,
  paneHeight: number,
): void {
  const baselineY = scaleY.toPixel(baselinePrice);
  const points: Array<{ x: number; y: number }> = [];
  
  for (let index = Math.max(Math.floor(viewport.startIndex), 0); index <= Math.min(Math.ceil(viewport.endIndex), values.length - 1); index += 1) {
    const value = values[index];
    if (value !== null) {
      points.push({ x: scaleX.toPixel(index), y: scaleY.toPixel(value) });
    }
  }
  if (points.length < 2) {
    return;
  }

  // Above fill
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, ctx.canvas.width, baselineY);
  ctx.clip();
  
  ctx.fillStyle = aboveColor;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, baselineY);
  ctx.lineTo(points[0].x, baselineY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Below fill
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, baselineY, ctx.canvas.width, paneHeight - baselineY);
  ctx.clip();
  
  ctx.fillStyle = belowColor;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, baselineY);
  ctx.lineTo(points[0].x, baselineY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Draw baseline reference line
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, baselineY);
  ctx.lineTo(ctx.canvas.width, baselineY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw the price line
  drawLine(ctx, values, viewport, scaleX, scaleY, '#94a3b8', lineWidth);
}

export function drawHistogram(
  ctx: CanvasRenderingContext2D,
  values: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  positiveColor: string,
  negativeColor: string,
  colorValues?: Array<string | null>,
): void {
  const baselineY = scaleY.toPixel(0);
  for (let index = Math.max(Math.floor(viewport.startIndex), 0); index <= Math.min(Math.ceil(viewport.endIndex), values.length - 1); index += 1) {
    const value = values[index];
    if (value === null) {
      continue;
    }

    const x = scaleX.toPixel(index);
    const y = scaleY.toPixel(value);
    const top = Math.min(y, baselineY);
    const height = Math.max(Math.abs(baselineY - y), 1);
    ctx.fillStyle = colorValues?.[index] ?? (value >= 0 ? positiveColor : negativeColor);
    ctx.fillRect(x - scaleX.bodyWidth / 2, top, scaleX.bodyWidth, height);
  }
}

export function drawPoints(
  ctx: CanvasRenderingContext2D,
  values: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  color: string,
  radius = 2,
): void {
  ctx.fillStyle = color;
  for (let index = Math.max(Math.floor(viewport.startIndex), 0); index <= Math.min(Math.ceil(viewport.endIndex), values.length - 1); index += 1) {
    const value = values[index];
    if (value === null) {
      continue;
    }

    ctx.beginPath();
    ctx.arc(scaleX.toPixel(index), scaleY.toPixel(value), radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  markers: RenderableMarker[],
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  plotHeight?: number,
  hoverBarIndex?: number | null,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);

  ctx.save();
  ctx.font = '700 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const laneCounts = new Map<string, number>();
  const badgeHeight = 16;
  const badgeGap = 3;
  const minTop = 2;
  const maxTop = typeof plotHeight === 'number' ? Math.max(minTop, plotHeight - badgeHeight - 2) : Number.POSITIVE_INFINITY;

  markers.forEach((marker) => {
    if (marker.index < start || marker.index > end) {
      return;
    }

    const bar = bars[marker.index];
    const x = scaleX.toPixel(marker.index);
    const laneKey = `${marker.index}:${marker.position}`;
    const lane = laneCounts.get(laneKey) ?? 0;
    laneCounts.set(laneKey, lane + 1);
    const badgeWidth = Math.max(18, Math.ceil(ctx.measureText(marker.label).width) + 10);
    const left = x - badgeWidth / 2;
    const anchorY = marker.position === 'above' ? scaleY.toPixel(bar.high) - 15 : scaleY.toPixel(bar.low) + 15;
    const baseTop =
      marker.position === 'above'
        ? Math.max(minTop, Math.min(anchorY - badgeHeight, maxTop))
        : Math.min(maxTop, Math.max(anchorY, minTop));
    const top =
      marker.position === 'above'
        ? baseTop - lane * (badgeHeight + badgeGap)
        : baseTop + lane * (badgeHeight + badgeGap);
    const triangleY = marker.position === 'above' ? top + badgeHeight : top;

    ctx.fillStyle = marker.color;
    drawRoundedRect(ctx, left, top, badgeWidth, badgeHeight, 4);
    ctx.fill();
    ctx.strokeStyle = resolveTransparentColor(resolveHighContrastText(marker.color), 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    if (marker.position === 'above') {
      ctx.moveTo(x - 4, triangleY - 1);
      ctx.lineTo(x + 4, triangleY - 1);
      ctx.lineTo(x, triangleY + 4);
    } else {
      ctx.moveTo(x - 4, triangleY + 1);
      ctx.lineTo(x + 4, triangleY + 1);
      ctx.lineTo(x, triangleY - 4);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = resolveHighContrastText(marker.color);
    ctx.fillText(marker.label, x, top + badgeHeight / 2);
  });
  ctx.restore();
}

export function drawReferenceLines(
  ctx: CanvasRenderingContext2D,
  values: Array<number | RenderableReferenceLine>,
  width: number,
  scaleY: ScaleY,
  color: string,
): void {
  ctx.save();
  values.forEach((line) => {
    const referenceLine: Partial<RenderableReferenceLine> & { value: number } =
      typeof line === 'number' ? { value: line } : line;
    const y = scaleY.toPixel(referenceLine.value);
    ctx.setLineDash(getLineDash(referenceLine.lineStyle ?? 'dashed'));
    ctx.strokeStyle = referenceLine.color ?? color;
    ctx.lineWidth = referenceLine.lineWidth ?? 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  });
  ctx.restore();
}

export function drawPaneTitle(
  ctx: CanvasRenderingContext2D,
  title: string,
  width: number,
  theme: ChartTheme,
): void {
  ctx.save();
  const highContrastText = resolveHighContrastText(theme.background);
  const subtleLine = resolveTransparentColor(theme.axisText, 0.16);

  ctx.strokeStyle = subtleLine;
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.lineTo(width, 0.5);
  ctx.stroke();

  ctx.font = PANE_TITLE_FONT;
  const labelHeight = 19;
  const labelLeft = 6;
  const labelTop = 4;

  ctx.fillStyle = highContrastText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, labelLeft + 8, labelTop + labelHeight / 2, Math.max(width - 18, 0));
  ctx.restore();
}

export function drawEventMarkers(
  ctx: CanvasRenderingContext2D,
  markers: RenderedChartMarker[],
  _height: number,
  theme: ChartTheme,
): void {
  const fillColor = theme.axisBackground;
  const strokeColor = resolveTransparentColor(theme.axisText, 0.28);
  const textColor = resolveHighContrastText(theme.axisBackground);
  markers.forEach((marker) => {
    const badgeWidth = 16;
    const badgeHeight = 14;
    const left = marker.x - badgeWidth / 2;
    const top = marker.y;
    drawRoundedRect(ctx, left, top, badgeWidth, badgeHeight, 4);
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '600 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(marker.event.label, marker.x, top + badgeHeight / 2 + 0.5);
  });
}

export function drawEventTooltip(
  ctx: CanvasRenderingContext2D,
  markers: RenderedChartMarker[],
  width: number,
  height: number,
  xAxisHeight: number,
  theme: ChartTheme,
): void {
  if (!markers.length) {
    return;
  }

  const lines = markers.map((marker) => `${marker.event.label} ${marker.event.description}`);
  const font = '12px "Segoe UI", sans-serif';
  ctx.save();
  ctx.font = font;
  const textWidth = Math.max(...lines.map((line) => ctx.measureText(line).width));
  const boxWidth = Math.min(width - 16, Math.ceil(textWidth) + 18);
  const boxHeight = lines.length * 18 + 10;
  const anchorX = markers.reduce((sum, marker) => sum + marker.x, 0) / markers.length;
  const left = Math.min(Math.max(anchorX - boxWidth / 2, 8), Math.max(width - boxWidth - 8, 8));
  const top = Math.max(8, height - xAxisHeight - boxHeight - 10);
  drawRoundedRect(ctx, left, top, boxWidth, boxHeight, 6);
  ctx.fillStyle = theme.axisBackground;
  ctx.fill();
  ctx.strokeStyle = resolveTransparentColor(theme.axisText, 0.3);
  ctx.stroke();
  ctx.fillStyle = resolveHighContrastText(theme.axisBackground);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, index) => {
    ctx.fillText(line, left + 8, top + 6 + index * 18);
  });
  ctx.restore();
}

export function drawDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: ChartDrawing,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected = false,
  bars: readonly OHLCBar[] = [],
  axisWidth = 56,
  alignment: 'left' | 'right' = 'right',
): void {
  ctx.save();
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = Math.max(drawing.lineWidth ?? 1.4, 1);
  if (selected) {
    ctx.shadowColor = 'rgba(123, 223, 242, 0.45)';
    ctx.shadowBlur = 7;
  }
  ctx.setLineDash(getLineDash(drawing.lineStyle));

  if (drawing.kind === 'hline') {
    const y = scaleY.toPixel(drawing.price);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
    if (selected) {
      ctx.setLineDash([]);
      ctx.fillStyle = drawing.color;
      const x = alignment === 'right' ? Math.max(width - axisWidth - 22, 0) : axisWidth + 10;
      ctx.fillRect(x, y - 3, 12, 6);
    }
    ctx.restore();
    return;
  }

  if (drawing.kind === 'vline') {
    if (drawing.barIndex < viewport.startIndex || drawing.barIndex > viewport.endIndex) {
      ctx.restore();
      return;
    }
    const x = scaleX.toPixel(drawing.barIndex);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    if (selected) {
      ctx.setLineDash([]);
      ctx.fillStyle = drawing.color;
      ctx.fillRect(x - 3, 10, 6, 12);
    }
    ctx.restore();
    return;
  }

  if (drawing.kind === 'text') {
    drawTextDrawing(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'horizontalRay') {
    drawHorizontalRay(ctx, drawing, scaleX, scaleY, width, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'crossLine') {
    drawCrossLine(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'arrowMarker' || drawing.kind === 'arrowUp' || drawing.kind === 'arrowDown') {
    drawArrowMarker(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'extendedLine') {
    drawExtendedLine(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'infoLine') {
    drawInfoLine(ctx, drawing, scaleX, scaleY, width, height, selected, bars);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'trendAngle') {
    drawTrendAngle(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'priceRange') {
    drawPriceRange(ctx, drawing, scaleX, scaleY, width, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'dateRange') {
    drawDateRange(ctx, drawing, scaleX, scaleY, width, height, selected, bars);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'regressionTrend') {
    drawRegressionTrend(ctx, drawing, scaleX, scaleY, width, height, selected, bars);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibTimeZone') {
    drawFibTimeZone(ctx, drawing, viewport, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibCircles') {
    drawFibCircles(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibSpiral') {
    drawFibSpiral(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibArcs') {
    drawFibArcs(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'gannBox') {
    drawGannBox(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'circle') {
    drawCircle(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'ellipse') {
    drawEllipse(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'forecast') {
    drawForecast(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'flatChannel') {
    drawFlatChannel(ctx, drawing, scaleX, scaleY, width, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'disjointChannel') {
    drawDisjointChannel(ctx, drawing, scaleX, scaleY, width, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'triangle') {
    drawTriangle(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'rotatedRect') {
    drawRotatedRectangle(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'arc') {
    drawArc(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (
    drawing.kind === 'andrewsPitchfork' ||
    drawing.kind === 'schiffPitchfork' ||
    drawing.kind === 'modifiedSchiffPitchfork' ||
    drawing.kind === 'insidePitchfork'
  ) {
    drawPitchfork(ctx, drawing, scaleX, scaleY, width, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'trendFibExtension') {
    drawTrendFibExtension(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibChannel') {
    drawFibChannel(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibTimeExtension') {
    drawFibTimeExtension(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibWedge') {
    drawFibWedge(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'pitchfan') {
    drawPitchfan(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'longPosition' || drawing.kind === 'shortPosition') {
    drawPositionTool(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'projection') {
    drawProjectionTool(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'xabcdPattern') {
    drawXABCDPattern(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'abcdPattern') {
    drawABCDPattern(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'headAndShouldersPattern') {
    drawHeadAndShouldersPattern(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'elliottImpulse') {
    drawElliottImpulse(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'elliottCorrection') {
    drawElliottCorrection(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fib') {
    drawFibRetracement(ctx, drawing, scaleX, scaleY, width, height, selected, getDrawingLabelPosition(drawing), axisWidth);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibExtension') {
    drawFibExtension(ctx, drawing, viewport, scaleX, scaleY, width, height, selected, getDrawingLabelPosition(drawing), axisWidth);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'measure') {
    drawMeasure(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'fibFan') {
    drawFibFan(ctx, drawing, viewport, scaleX, scaleY, width, height, selected, alignment);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'gann') {
    drawGannFan(ctx, drawing, viewport, scaleX, scaleY, width, height, selected, alignment);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'trendline') {
    drawConfigurableTrendLine(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'ray') {
    drawRay(ctx, drawing, viewport, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'arrow') {
    drawArrow(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'rect') {
    drawRectangle(ctx, drawing, scaleX, scaleY, selected);
    ctx.restore();
    return;
  }

  if (drawing.kind === 'channel') {
    drawParallelChannel(ctx, drawing, scaleX, scaleY, width, height, selected);
    ctx.restore();
    return;
  }

  // Every current ChartDrawing kind is handled above. Keep this compile-time
  // exhaustiveness guard so a future drawing kind cannot silently fall through.
  const exhaustiveDrawing: never = drawing;
  void exhaustiveDrawing;
  ctx.restore();
}


function toMultiAnchorPixels(
  drawing: Extract<ChartDrawing, { anchors: { barIndex: number; price: number }[] }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
) {
  return drawing.anchors.map((anchor) => ({ x: scaleX.toPixel(anchor.barIndex), y: scaleY.toPixel(anchor.price) }));
}

function drawMultiAnchorHandles(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  color: string,
  selected: boolean,
): void {
  if (!selected) return;
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  for (const point of points) {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function strokeDrawingPathWithPresentation(
  ctx: CanvasRenderingContext2D,
  presentation: ReturnType<typeof resolveDrawingLinePresentationForSlot>,
  drawPath: () => void,
  lineDashOverride?: readonly number[],
): void {
  if (!presentation.visible || presentation.opacity <= 0) return;
  ctx.save();
  ctx.strokeStyle = presentation.color;
  ctx.lineWidth = Math.max(presentation.lineWidth, 1);
  ctx.setLineDash(lineDashOverride ? [...lineDashOverride] : getLineDash(presentation.lineStyle));
  ctx.globalAlpha *= presentation.opacity;
  ctx.beginPath();
  drawPath();
  ctx.stroke();
  ctx.restore();
}

function strokeDrawingSegmentWithPresentation(
  ctx: CanvasRenderingContext2D,
  segment: { start: { x: number; y: number }; end: { x: number; y: number } },
  presentation: ReturnType<typeof resolveDrawingLinePresentationForSlot>,
  lineDashOverride?: readonly number[],
): void {
  strokeDrawingPathWithPresentation(
    ctx,
    presentation,
    () => {
      ctx.moveTo(segment.start.x, segment.start.y);
      ctx.lineTo(segment.end.x, segment.end.y);
    },
    lineDashOverride,
  );
}

function fillDrawingPolygonWithPresentation(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  presentation: ReturnType<typeof resolveDrawingFillPresentationForSlot>,
): void {
  if (!presentation.visible || presentation.opacity <= 0 || points.length < 3) return;
  ctx.save();
  ctx.fillStyle = presentation.color;
  ctx.globalAlpha *= presentation.opacity;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let index = 1; index < points.length; index += 1) {
    ctx.lineTo(points[index].x, points[index].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFlatChannel(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'flatChannel' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const segments = buildFlatChannelSegments(points, width, drawing.extendLeft === true, drawing.extendRight === true);
  if (!segments) return;
  ctx.save();
  const [trend, flat] = segments;
  const fillPresentation = resolveDrawingFillPresentationForSlot(drawing, 'channel');
  fillDrawingPolygonWithPresentation(
    ctx,
    [trend.start, trend.end, flat.end, flat.start],
    fillPresentation,
  );
  strokeDrawingSegmentWithPresentation(ctx, trend, resolveDrawingLinePresentationForSlot(drawing, 'trend'));
  strokeDrawingSegmentWithPresentation(ctx, flat, resolveDrawingLinePresentationForSlot(drawing, 'flat'));
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawDisjointChannel(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'disjointChannel' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const segments = buildDisjointChannelSegments(points, width, drawing.extendLeft === true, drawing.extendRight === true);
  if (!segments || points.length < 4) return;
  ctx.save();
  fillDrawingPolygonWithPresentation(
    ctx,
    [points[0], points[1], points[3], points[2]],
    resolveDrawingFillPresentationForSlot(drawing, 'channel'),
  );
  strokeDrawingSegmentWithPresentation(ctx, segments[0], resolveDrawingLinePresentationForSlot(drawing, 'first'));
  strokeDrawingSegmentWithPresentation(ctx, segments[1], resolveDrawingLinePresentationForSlot(drawing, 'second'));
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'triangle' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 3) return;
  ctx.save();
  ctx.fillStyle = resolveTransparentColor(drawing.color, 0.08);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawRotatedRectangle(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'rotatedRect' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const corners = getRotatedRectangleCorners(points);
  if (!corners) return;
  ctx.save();
  ctx.fillStyle = resolveTransparentColor(drawing.color, 0.08);
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let index = 1; index < corners.length; index += 1) {
    ctx.lineTo(corners[index].x, corners[index].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'arc' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const arc = getArcParameters(points);
  if (!arc) return;
  ctx.save();
  ctx.beginPath();
  ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle);
  ctx.stroke();
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawDrawingLevelLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  anchorX: number,
  anchorY: number,
  color: string,
  width: number,
  height: number,
  preferredSide: DrawingLabelSide = 'left',
  verticalPlacement: DrawingLabelVerticalPlacement = 'center',
  fontSize = 11,
): void {
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY) || anchorY < 0 || anchorY > height) {
    return;
  }
  const resolvedFontSize = Math.max(10, Math.min(fontSize, 16));
  ctx.save();
  ctx.font = `600 ${resolvedFontSize}px "Segoe UI", sans-serif`;
  const box = computeDrawingLevelLabelBox({
    anchorX,
    anchorY,
    textWidth: ctx.measureText(text).width,
    plotWidth: width,
    plotHeight: height,
    preferredSide,
    verticalPlacement,
    gap: 6,
    verticalGap: 2,
    boxHeight: resolvedFontSize + 5,
    paddingX: 1,
  });
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  // TradingView-style chart labels: clean colored glyphs with a small dark
  // shadow for contrast, rather than the previous heavy outlined/halo text.
  ctx.shadowColor = 'rgba(0, 0, 0, 0.88)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = color;
  ctx.fillText(text, box.textX, box.textY);
  ctx.restore();
}

function getDrawingLabelFontSize(drawing: ChartDrawing): number {
  const configured = drawing.presentation?.labels?.fontSize;
  return typeof configured === 'number' && Number.isFinite(configured)
    ? Math.max(10, Math.min(configured, 16))
    : 11;
}

function drawPositionStatText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  fontSize: number,
): void {
  ctx.save();
  ctx.font = `600 ${fontSize}px "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const metrics = ctx.measureText(text);
  const paddingX = 5;
  const boxHeight = fontSize + 7;
  const boxWidth = metrics.width + paddingX * 2;
  ctx.fillStyle = 'rgba(8, 15, 24, 0.74)';
  ctx.fillRect(x - boxWidth / 2, y - boxHeight / 2, boxWidth, boxHeight);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function getSegmentLabelPlacement(
  segment: { start: { x: number; y: number }; end: { x: number; y: number } },
  position: 'left' | 'right',
): { anchorX: number; anchorY: number; preferredSide: DrawingLabelSide } {
  const leftPoint = segment.start.x <= segment.end.x ? segment.start : segment.end;
  const rightPoint = segment.start.x <= segment.end.x ? segment.end : segment.start;
  const anchor = position === 'left' ? leftPoint : rightPoint;
  return {
    anchorX: anchor.x,
    anchorY: anchor.y,
    preferredSide: position === 'left' ? 'left' : 'right',
  };
}

function drawPitchfork(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'andrewsPitchfork' | 'schiffPitchfork' | 'modifiedSchiffPitchfork' | 'insidePitchfork' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const segments = buildPitchforkSegments(drawing.kind, points, width, drawing.extendLeft === true, drawing.extendRight === true);
  if (!segments.length) return;
  ctx.save();

  const [median, firstSide, secondSide] = segments;
  const firstSideSlot = points[1].y <= points[2].y ? 'upper' : 'lower';
  const secondSideSlot = firstSideSlot === 'upper' ? 'lower' : 'upper';
  strokeDrawingSegmentWithPresentation(ctx, median, resolveDrawingLinePresentationForSlot(drawing, 'median'));
  strokeDrawingSegmentWithPresentation(ctx, firstSide, resolveDrawingLinePresentationForSlot(drawing, firstSideSlot));
  strokeDrawingSegmentWithPresentation(ctx, secondSide, resolveDrawingLinePresentationForSlot(drawing, secondSideSlot));

  // Preserve the legacy anchor-construction guide as a low-emphasis common-color aid.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = Math.max(drawing.lineWidth ?? 1.4, 1);
  ctx.setLineDash(getLineDash(drawing.lineStyle));
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.lineTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.stroke();
  ctx.restore();

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function resolveF1BLevelPresentation(
  drawing: ChartDrawing,
  level: RuntimeFibonacciLevel,
) {
  const stableSlot = getFibonacciLevelSlotId(level);
  const legacySlot = getLegacyFibonacciLevelSlotId(level);
  const savedLines = drawing.presentation?.lines;
  if (savedLines?.[stableSlot]) return resolveDrawingLinePresentationForSlot(drawing, stableSlot);
  if (savedLines?.[legacySlot]) return resolveDrawingLinePresentationForSlot(drawing, legacySlot);
  // Static S2.x schemas are coefficient-keyed. Falling back through the legacy
  // coefficient slot preserves their default colors/opacity for normalized F1A
  // levels, while a saved stable-ID override still wins above.
  return resolveDrawingLinePresentationForSlot(drawing, legacySlot);
}

function buildF1BLabelText(
  level: RuntimeFibonacciLevel,
  price: number | null,
  drawing: ChartDrawing,
): string {
  const options = resolveFibonacciOptions(drawing);
  const coefficient = formatFibonacciCoefficient(level.value, options.coefficientFormat);
  const pieces = level.text ? [level.text, coefficient] : [coefficient];
  if (price !== null && options.showPrices) pieces.push(formatPrice(price));
  return pieces.join('  ');
}

function drawF1BHorizontalBands(
  ctx: CanvasRenderingContext2D,
  drawing: ChartDrawing,
  entries: readonly { level: RuntimeFibonacciLevel; y: number; startX: number; endX: number }[],
  fillSlotId: string,
): void {
  const fillOverride = drawing.presentation?.fills?.[fillSlotId];
  const allowLegacyDefault = fillSlotId === 'levels' || fillSlotId === 'bands';
  if (!fillOverride && !allowLegacyDefault) return;
  const fill = resolveDrawingFillPresentationForSlot(drawing, fillSlotId);
  if (!fill.visible || fill.opacity <= 0 || entries.length < 2) return;
  const ordered = [...entries].sort((a, b) => a.y - b.y);
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index];
    const next = ordered[index + 1];
    const line = resolveF1BLevelPresentation(drawing, current.level);
    ctx.save();
    ctx.fillStyle = resolveTransparentColor(line.color, fill.opacity);
    const left = Math.max(0, Math.min(current.startX, next.startX));
    const right = Math.min(ctx.canvas.width, Math.max(current.endX, next.endX));
    ctx.fillRect(left, current.y, Math.max(0, right - left), Math.max(0, next.y - current.y));
    ctx.restore();
  }
}

function drawTrendFibExtension(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'trendFibExtension' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 3) return;
  const fallback = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2, 2.618];
  const levels = resolveFibonacciLevels(drawing, fallback);
  const options = resolveFibonacciOptions(drawing);
  const geometry = buildF1BTrendFibExtensionLevels(
    points,
    drawing.anchors.map((anchor) => anchor.price),
    width,
    levels,
    drawing.extendLeft === true,
    drawing.extendRight === true,
    options.reverse,
    options.logScaleLevels,
  );
  if (!geometry.length) return;
  ctx.save();
  strokeDrawingPathWithPresentation(ctx, resolveDrawingLinePresentationForSlot(drawing, 'trend'), () => {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
  });
  const rendered = geometry.map((entry) => ({
    ...entry,
    y: scaleY.toPixel(entry.price),
    startX: entry.segment.start.x,
    endX: entry.segment.end.x,
  }));
  drawF1BHorizontalBands(ctx, drawing, rendered, 'background');
  rendered.forEach((entry) => {
    const presentation = resolveF1BLevelPresentation(drawing, entry.level);
    const segment = { start: { x: entry.startX, y: entry.y }, end: { x: entry.endX, y: entry.y } };
    strokeDrawingSegmentWithPresentation(ctx, segment, presentation);
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelPlacement = getSegmentLabelPlacement(segment, options.horizontalLabelPosition);
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(entry.level, entry.price, drawing),
        labelPlacement.anchorX,
        labelPlacement.anchorY,
        presentation.color,
        width,
        height,
        labelPlacement.preferredSide,
        'above',
        getDrawingLabelFontSize(drawing),
      );
    }
  });
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawFibChannel(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibChannel' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const fallback = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
  const levels = resolveFibonacciLevels(drawing, fallback);
  const geometry = buildF1BFibChannelLevels(points, width, levels, drawing.extendLeft === true, drawing.extendRight === true);
  if (!geometry.length) return;
  ctx.save();
  const fill = resolveDrawingFillPresentationForSlot(drawing, 'bands');
  if (fill.visible && fill.opacity > 0 && geometry.length >= 2) {
    for (let index = 0; index < geometry.length - 1; index += 1) {
      const current = geometry[index];
      const next = geometry[index + 1];
      const line = resolveF1BLevelPresentation(drawing, current.level);
      ctx.save();
      ctx.fillStyle = resolveTransparentColor(line.color, fill.opacity);
      ctx.beginPath();
      ctx.moveTo(current.segment.start.x, current.segment.start.y);
      ctx.lineTo(current.segment.end.x, current.segment.end.y);
      ctx.lineTo(next.segment.end.x, next.segment.end.y);
      ctx.lineTo(next.segment.start.x, next.segment.start.y);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  const options = resolveFibonacciOptions(drawing);
  geometry.forEach(({ level, segment }) => {
    const presentation = resolveF1BLevelPresentation(drawing, level);
    strokeDrawingSegmentWithPresentation(ctx, segment, presentation);
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelPlacement = getSegmentLabelPlacement(segment, options.horizontalLabelPosition);
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(level, null, drawing),
        labelPlacement.anchorX,
        labelPlacement.anchorY,
        presentation.color,
        width,
        height,
        labelPlacement.preferredSide,
        'above',
        getDrawingLabelFontSize(drawing),
      );
    }
  });
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawFibTimeExtension(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibTimeExtension' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const fallback = [0, 0.382, 0.618, 1, 1.382, 1.618, 2, 2.382, 2.618, 3];
  const levels = resolveFibonacciLevels(drawing, fallback);
  const geometry = buildF1BTrendFibTimeLevels(points, levels);
  if (!geometry.length) return;
  ctx.save();
  const fillOverride = drawing.presentation?.fills?.background;
  if (fillOverride?.visible !== false && (fillOverride?.opacity ?? 0) > 0 && geometry.length >= 2) {
    const fill = resolveDrawingFillPresentationForSlot(drawing, 'background');
    const ordered = [...geometry].sort((a, b) => a.x - b.x);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const current = ordered[index];
      const next = ordered[index + 1];
      const line = resolveF1BLevelPresentation(drawing, current.level);
      ctx.save();
      ctx.fillStyle = resolveTransparentColor(line.color, fill.opacity);
      ctx.fillRect(current.x, 0, Math.max(0, next.x - current.x), height);
      ctx.restore();
    }
  }
  const options = resolveFibonacciOptions(drawing);
  geometry.forEach(({ level, x }) => {
    const presentation = resolveF1BLevelPresentation(drawing, level);
    strokeDrawingSegmentWithPresentation(ctx, { start: { x, y: 0 }, end: { x, y: height } }, presentation);
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelY = options.verticalLabelPosition === 'top' ? 12 : Math.max(12, height - 12);
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(level, null, drawing),
        x,
        labelY,
        presentation.color,
        width,
        height,
        options.horizontalLabelPosition,
        'center',
        getDrawingLabelFontSize(drawing),
      );
    }
  });
  strokeDrawingPathWithPresentation(ctx, resolveDrawingLinePresentationForSlot(drawing, 'trend'), () => {
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
  });
  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function resolveF1CWedgeLevelPresentation(
  drawing: Extract<ChartDrawing, { kind: 'fibWedge' }>,
  level: RuntimeFibonacciLevel,
) {
  return resolveF1BLevelPresentation(drawing, level);
}

function resolveF1CWedgeTrendPresentation(
  drawing: Extract<ChartDrawing, { kind: 'fibWedge' }>,
) {
  const current = resolveDrawingLinePresentationForSlot(drawing, 'trend');
  if (!drawing.presentation?.lines?.trend && drawing.presentation?.lines?.guide) {
    return resolveDrawingLinePresentation(drawing, 'guide', current);
  }
  return current;
}

function resolveF1CWedgeBackgroundPresentation(
  drawing: Extract<ChartDrawing, { kind: 'fibWedge' }>,
) {
  const legacy = drawing.presentation?.fills?.wedge
    ? resolveDrawingFillPresentationForSlot(drawing, 'wedge')
    : undefined;
  const current = resolveDrawingFillPresentationForSlot(drawing, 'background');
  return legacy ? { ...current, ...legacy } : current;
}

function fillF1CFibWedgeBands(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibWedge' }>,
  levels: readonly FibWedgeLevelGeometry[],
): void {
  const settings = getNormalizedFibonacciSettings(drawing);
  if (settings?.kind === 'fibWedge' && settings.showBackground === false) return;
  const fill = resolveF1CWedgeBackgroundPresentation(drawing);
  if (!fill.visible || fill.opacity <= 0 || levels.length === 0) return;

  levels.forEach((outer, index) => {
    const inner = index === 0 ? null : levels[index - 1] ?? null;
    const presentation = resolveF1CWedgeLevelPresentation(drawing, outer.level);
    ctx.save();
    ctx.fillStyle = presentation.color;
    ctx.globalAlpha *= fill.opacity;
    ctx.beginPath();
    if (!inner) {
      ctx.moveTo(outer.center.x, outer.center.y);
      outer.points.forEach((point) => ctx.lineTo(point.x, point.y));
    } else {
      ctx.moveTo(outer.points[0].x, outer.points[0].y);
      outer.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
      [...inner.points].reverse().forEach((point) => ctx.lineTo(point.x, point.y));
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
}

function drawFibWedge(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibWedge' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const dataAnchors = drawing.anchors.map((anchor) => ({ x: anchor.barIndex, y: anchor.price }));
  const levels = resolveFibonacciLevels(drawing, FIB_WEDGE_DEFAULT_VALUES);
  const dataGeometry = buildF1CFibWedgeGeometry(dataAnchors, levels);
  if (!dataGeometry) return;
  const geometry = projectF1CFibWedgeGeometry(dataGeometry, (point) => ({
    x: scaleX.toPixel(point.x),
    y: scaleY.toPixel(point.y),
  }));

  ctx.save();
  fillF1CFibWedgeBands(ctx, drawing, geometry.levels);

  geometry.levels.forEach((entry) => {
    const presentation = resolveF1CWedgeLevelPresentation(drawing, entry.level);
    strokeDrawingPathWithPresentation(ctx, presentation, () => {
      if (!entry.points.length) return;
      ctx.moveTo(entry.points[0].x, entry.points[0].y);
      entry.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    });
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(entry.level, null, drawing),
        entry.labelAnchor.x,
        entry.labelAnchor.y,
        presentation.color,
        width,
        height,
        'center',
        'center',
        getDrawingLabelFontSize(drawing),
      );
    }
  });

  const trendPresentation = resolveF1CWedgeTrendPresentation(drawing);
  strokeDrawingSegmentWithPresentation(ctx, geometry.firstBoundary, trendPresentation);
  strokeDrawingSegmentWithPresentation(ctx, geometry.secondBoundary, trendPresentation);

  drawAnchorHandle(ctx, geometry.apex.x, geometry.apex.y, drawing.color, selected);
  drawAnchorHandle(ctx, geometry.firstHandle.x, geometry.firstHandle.y, drawing.color, selected);
  drawAnchorHandle(ctx, geometry.secondHandle.x, geometry.secondHandle.y, drawing.color, selected);
  ctx.restore();
}

function drawPitchfan(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'pitchfan' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const levels = buildPitchfanSegments(points, width, drawing.extendLeft === true, drawing.extendRight === true);
  if (!levels.length) return;
  ctx.save();
  ctx.font = '10px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  levels.forEach(({ level, segment }) => {
    const slotId = `ray:${level}`;
    const presentation = resolveDrawingLinePresentationForSlot(drawing, slotId);
    strokeDrawingSegmentWithPresentation(ctx, segment, presentation);
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      drawDrawingLevelLabel(
        ctx,
        `${(level * 100).toFixed(1)}%`,
        (segment.start.x + segment.end.x) / 2,
        (segment.start.y + segment.end.y) / 2,
        presentation.color,
        width,
        height,
        'right',
        'center',
        getDrawingLabelFontSize(drawing),
      );
    }
  });

  // Preserve the correction-wave guide as a low-emphasis common-color construction aid.
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = drawing.color;
  ctx.lineWidth = Math.max(drawing.lineWidth ?? 1.4, 1);
  ctx.setLineDash(getLineDash(drawing.lineStyle));
  ctx.beginPath();
  ctx.moveTo(points[1].x, points[1].y);
  ctx.lineTo(points[2].x, points[2].y);
  ctx.stroke();
  ctx.restore();

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}


function drawPatternPointBadge(ctx: CanvasRenderingContext2D, point: { x: number; y: number }, label: string, color: string): void {
  ctx.save();
  ctx.font = 'bold 10px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = 16;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.beginPath();
  ctx.arc(point.x, point.y - 12, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.fillText(label, point.x, point.y - 12);
  ctx.restore();
}

function drawXABCDPattern(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'xabcdPattern' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 2) return;
  const labels = ['X', 'A', 'B', 'C', 'D'];
  const fillStyle = resolveDrawingFillPresentationForSlot(drawing, 'pattern');
  const lineStyle = resolveDrawingLinePresentationForSlot(drawing, 'outline');

  ctx.save();
  if (fillStyle.visible && fillStyle.opacity > 0 && points.length >= 3) {
    ctx.fillStyle = fillStyle.color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.lineTo(points[2].x, points[2].y);
    ctx.closePath();
    ctx.fill();

    if (points.length >= 5) {
      ctx.beginPath();
      ctx.moveTo(points[2].x, points[2].y);
      ctx.lineTo(points[3].x, points[3].y);
      ctx.lineTo(points[4].x, points[4].y);
      ctx.closePath();
      ctx.fill();
    }
  }

  strokeDrawingPathWithPresentation(ctx, lineStyle, () => {
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  });

  points.forEach((p, idx) => {
    if (idx < labels.length) {
      drawPatternPointBadge(ctx, p, labels[idx], lineStyle.color);
    }
  });

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawABCDPattern(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'abcdPattern' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 2) return;
  const labels = ['A', 'B', 'C', 'D'];
  const lineStyle = resolveDrawingLinePresentationForSlot(drawing, 'outline');

  ctx.save();
  strokeDrawingPathWithPresentation(ctx, lineStyle, () => {
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  });

  points.forEach((p, idx) => {
    if (idx < labels.length) {
      drawPatternPointBadge(ctx, p, labels[idx], lineStyle.color);
    }
  });

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawHeadAndShouldersPattern(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'headAndShouldersPattern' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 2) return;
  const labels = ['LS', 'N1', 'Head', 'N2', 'RS', 'Target', 'Stop'];
  const lineStyle = resolveDrawingLinePresentationForSlot(drawing, 'outline');
  const necklineStyle = resolveDrawingLinePresentationForSlot(drawing, 'neckline');
  const fillStyle = resolveDrawingFillPresentationForSlot(drawing, 'shoulders');

  ctx.save();
  if (fillStyle.visible && fillStyle.opacity > 0 && points.length >= 5) {
    ctx.fillStyle = fillStyle.color;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i <= 4 && i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }

  strokeDrawingPathWithPresentation(ctx, lineStyle, () => {
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  });

  if (points.length >= 4) {
    strokeDrawingSegmentWithPresentation(
      ctx,
      { start: points[1], end: points[3] },
      necklineStyle,
    );
  }

  points.forEach((p, idx) => {
    if (idx < labels.length) {
      drawPatternPointBadge(ctx, p, labels[idx], lineStyle.color);
    }
  });

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawElliottImpulse(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'elliottImpulse' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 2) return;
  const labels = ['(0)', '(1)', '(2)', '(3)', '(4)', '(5)'];
  const lineStyle = resolveDrawingLinePresentationForSlot(drawing, 'outline');

  ctx.save();
  strokeDrawingPathWithPresentation(ctx, lineStyle, () => {
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  });

  points.forEach((p, idx) => {
    if (idx < labels.length) {
      drawPatternPointBadge(ctx, p, labels[idx], lineStyle.color);
    }
  });

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawElliottCorrection(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'elliottCorrection' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  if (points.length < 2) return;
  const labels = ['(0)', '(A)', '(B)', '(C)'];
  const lineStyle = resolveDrawingLinePresentationForSlot(drawing, 'outline');

  ctx.save();
  strokeDrawingPathWithPresentation(ctx, lineStyle, () => {
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  });

  points.forEach((p, idx) => {
    if (idx < labels.length) {
      drawPatternPointBadge(ctx, p, labels[idx], lineStyle.color);
    }
  });

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}

function drawPositionTool(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'longPosition' | 'shortPosition' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const normalizedAnchors = normalizePositionAnchors(drawing.kind, drawing.anchors);
  const normalizedDrawing = { ...drawing, anchors: normalizedAnchors };
  const points = toMultiAnchorPixels(normalizedDrawing, scaleX, scaleY);
  const geometry = buildPositionPixelGeometry(points);
  const metrics = calculatePositionMetrics(drawing.kind, normalizedAnchors);
  if (!geometry || !metrics || points.length < 3) return;

  const targetPresentation = resolveDrawingLinePresentationForSlot(drawing, 'target');
  const entryPresentation = resolveDrawingLinePresentationForSlot(drawing, 'entry');
  const stopPresentation = resolveDrawingLinePresentationForSlot(drawing, 'stop');
  const rewardFill = resolveDrawingFillPresentationForSlot(drawing, 'reward');
  const riskFill = resolveDrawingFillPresentationForSlot(drawing, 'risk');
  const zoneWidth = Math.max(0, geometry.right - geometry.left);
  const rewardTop = Math.min(geometry.entryY, geometry.targetY);
  const rewardHeight = Math.abs(geometry.targetY - geometry.entryY);
  const riskTop = Math.min(geometry.entryY, geometry.stopY);
  const riskHeight = Math.abs(geometry.stopY - geometry.entryY);

  ctx.save();
  ctx.setLineDash([]);
  if (rewardFill.visible && rewardFill.opacity > 0) {
    ctx.fillStyle = resolveTransparentColor(rewardFill.color, rewardFill.opacity);
    ctx.fillRect(geometry.left, rewardTop, zoneWidth, rewardHeight);
  }
  if (riskFill.visible && riskFill.opacity > 0) {
    ctx.fillStyle = resolveTransparentColor(riskFill.color, riskFill.opacity);
    ctx.fillRect(geometry.left, riskTop, zoneWidth, riskHeight);
  }

  strokeDrawingSegmentWithPresentation(ctx, geometry.target, targetPresentation);
  strokeDrawingSegmentWithPresentation(ctx, geometry.entry, entryPresentation);
  strokeDrawingSegmentWithPresentation(ctx, geometry.stop, stopPresentation);

  const rr = metrics.riskRewardRatio == null ? 'n/a' : metrics.riskRewardRatio.toFixed(2);
  const direction = drawing.kind === 'longPosition' ? 'LONG' : 'SHORT';
  const labelFontSize = getDrawingLabelFontSize(drawing);
  if (isDrawingLabelVisible(drawing)) {
    const centerX = (geometry.left + geometry.right) / 2;
    const rewardInset = Math.min(Math.max(rewardHeight / 2, 11), 18);
    const riskInset = Math.min(Math.max(riskHeight / 2, 11), 18);
    const targetTextY = geometry.targetY + Math.sign(geometry.entryY - geometry.targetY || 1) * rewardInset;
    const stopTextY = geometry.stopY + Math.sign(geometry.entryY - geometry.stopY || 1) * riskInset;
    drawPositionStatText(
      ctx,
      `Target ${formatPrice(metrics.target)}  +${metrics.rewardPercent.toFixed(2)}%`,
      centerX,
      targetTextY,
      targetPresentation.color,
      labelFontSize,
    );
    drawPositionStatText(
      ctx,
      `${direction} · Entry ${formatPrice(metrics.entry)} · R:R ${rr}`,
      centerX,
      geometry.entryY,
      entryPresentation.color,
      labelFontSize,
    );
    drawPositionStatText(
      ctx,
      `Stop ${formatPrice(metrics.stop)}  -${metrics.riskPercent.toFixed(2)}%`,
      centerX,
      stopTextY,
      stopPresentation.color,
      labelFontSize,
    );
  }

  ctx.setLineDash([]);
  ctx.strokeStyle = resolveTransparentColor(entryPresentation.color, 0.5);
  ctx.lineWidth = 1;
  ctx.strokeRect(
    geometry.left,
    Math.min(geometry.targetY, geometry.stopY),
    zoneWidth,
    Math.abs(geometry.stopY - geometry.targetY),
  );

  const handlePoints = [
    points[0],
    points[1],
    { x: points[1].x, y: points[2].y },
  ];
  drawMultiAnchorHandles(ctx, handlePoints, drawing.color, selected);
  ctx.restore();
}

function drawProjectionTool(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'projection' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const points = toMultiAnchorPixels(drawing, scaleX, scaleY);
  const geometry = buildProjectionPixelGeometry(points);
  const metrics = calculateProjectionMetrics(drawing.anchors);
  if (!geometry || !metrics) return;

  const projectedColor = metrics.isUp ? '#26a69a' : '#ef5350';
  const fillLeft = Math.min(geometry.c.x, geometry.d.x);
  const fillTop = Math.min(geometry.c.y, geometry.d.y);
  const fillWidth = Math.abs(geometry.d.x - geometry.c.x);
  const fillHeight = Math.abs(geometry.d.y - geometry.c.y);

  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = resolveTransparentColor(projectedColor, 0.08);
  ctx.fillRect(fillLeft, fillTop, fillWidth, fillHeight);

  ctx.lineWidth = drawing.lineWidth ?? 1.4;
  ctx.setLineDash(getLineDash(drawing.lineStyle));
  ctx.strokeStyle = drawing.color;
  ctx.beginPath();
  ctx.moveTo(geometry.reference.start.x, geometry.reference.start.y);
  ctx.lineTo(geometry.reference.end.x, geometry.reference.end.y);
  ctx.stroke();

  ctx.strokeStyle = projectedColor;
  ctx.beginPath();
  ctx.moveTo(geometry.projected.start.x, geometry.projected.start.y);
  ctx.lineTo(geometry.projected.end.x, geometry.projected.end.y);
  ctx.stroke();

  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = resolveTransparentColor(drawing.color, 0.45);
  for (const connector of [geometry.connectorA, geometry.connectorB]) {
    ctx.beginPath();
    ctx.moveTo(connector.start.x, connector.start.y);
    ctx.lineTo(connector.end.x, connector.end.y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const dx = geometry.d.x - geometry.c.x;
  const dy = geometry.d.y - geometry.c.y;
  const length = Math.hypot(dx, dy);
  if (length > 1e-6) {
    const ux = dx / length;
    const uy = dy / length;
    const size = 8;
    const px = -uy;
    const py = ux;
    ctx.fillStyle = projectedColor;
    ctx.beginPath();
    ctx.moveTo(geometry.d.x, geometry.d.y);
    ctx.lineTo(geometry.d.x - ux * size + px * size * 0.55, geometry.d.y - uy * size + py * size * 0.55);
    ctx.lineTo(geometry.d.x - ux * size - px * size * 0.55, geometry.d.y - uy * size - py * size * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  if (isDrawingLabelVisible(drawing)) {
    const sign = metrics.movePercent >= 0 ? '+' : '';
    const bars = `${Math.abs(metrics.barSpan)} bar${Math.abs(metrics.barSpan) === 1 ? '' : 's'}`;
    drawDrawingLevelLabel(
      ctx,
      `Target ${formatPrice(metrics.targetPrice)} · ${sign}${metrics.movePercent.toFixed(2)}% · ${bars}`,
      geometry.d.x,
      geometry.d.y,
      projectedColor,
      width,
      height,
      getDrawingLabelPosition(drawing),
      'above',
    );
  }

  if (selected) {
    const labels = [
      { point: geometry.a, text: 'A' },
      { point: geometry.b, text: 'B' },
      { point: geometry.c, text: 'C' },
      { point: geometry.d, text: 'D' },
    ];
    ctx.font = '600 10px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of labels) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = resolveTransparentColor(resolveHighContrastText(drawing.color), 0.82);
      ctx.strokeText(label.text, label.point.x, label.point.y - 10);
      ctx.fillStyle = label.text === 'D' ? projectedColor : drawing.color;
      ctx.fillText(label.text, label.point.x, label.point.y - 10);
    }
  }

  drawMultiAnchorHandles(ctx, points, drawing.color, selected);
  ctx.restore();
}


function drawArrowMarker(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'arrowMarker' | 'arrowUp' | 'arrowDown' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const x = scaleX.toPixel(drawing.barIndex);
  const y = scaleY.toPixel(drawing.price);
  const size = Math.max(12, (drawing.lineWidth ?? 1.4) * 8);
  const direction = drawing.kind === 'arrowDown' ? 'down' : 'up';
  const halfBase = size * 0.55;
  const tipY = direction === 'up' ? y - size : y + size;
  const baseY = y;

  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = drawing.color;
  ctx.strokeStyle = drawing.color;
  ctx.beginPath();
  ctx.moveTo(x, tipY);
  ctx.lineTo(x - halfBase, baseY);
  ctx.lineTo(x + halfBase, baseY);
  ctx.closePath();
  if (drawing.kind === 'arrowMarker') {
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(drawing.lineWidth ?? 1.4, 1);
    ctx.stroke();
  } else {
    ctx.fill();
  }
  if (selected) drawAnchorHandle(ctx, x, y, drawing.color, true);
  ctx.restore();
}

function drawRegressionTrend(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'regressionTrend' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  bars: readonly OHLCBar[],
): void {
  const regression = calculateRegressionChannel(bars, drawing.startIndex, drawing.endIndex, 2);
  if (!regression) {
    drawAnchoredGuideLine(
      ctx,
      scaleX.toPixel(drawing.startIndex),
      scaleY.toPixel(drawing.startPrice),
      scaleX.toPixel(drawing.endIndex),
      scaleY.toPixel(drawing.endPrice),
    );
    return;
  }

  const startX = scaleX.toPixel(regression.startIndex);
  const endX = scaleX.toPixel(regression.endIndex);
  const centerStartY = scaleY.toPixel(regression.centerStart);
  const centerEndY = scaleY.toPixel(regression.centerEnd);
  const upperStartY = scaleY.toPixel(regression.upperStart);
  const upperEndY = scaleY.toPixel(regression.upperEnd);
  const lowerStartY = scaleY.toPixel(regression.lowerStart);
  const lowerEndY = scaleY.toPixel(regression.lowerEnd);
  const extendLeft = drawing.extendLeft === true;
  const extendRight = drawing.extendRight === true;
  const centerSegment = extendSegmentHorizontally(
    { x: startX, y: centerStartY },
    { x: endX, y: centerEndY },
    width,
    extendLeft,
    extendRight,
  );
  const upperSegment = extendSegmentHorizontally(
    { x: startX, y: upperStartY },
    { x: endX, y: upperEndY },
    width,
    extendLeft,
    extendRight,
  );
  const lowerSegment = extendSegmentHorizontally(
    { x: startX, y: lowerStartY },
    { x: endX, y: lowerEndY },
    width,
    extendLeft,
    extendRight,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  fillDrawingPolygonWithPresentation(
    ctx,
    [upperSegment.start, upperSegment.end, lowerSegment.end, lowerSegment.start],
    resolveDrawingFillPresentationForSlot(drawing, 'channel'),
  );
  strokeDrawingSegmentWithPresentation(ctx, upperSegment, resolveDrawingLinePresentationForSlot(drawing, 'upper'));
  strokeDrawingSegmentWithPresentation(ctx, centerSegment, resolveDrawingLinePresentationForSlot(drawing, 'basis'));
  strokeDrawingSegmentWithPresentation(ctx, lowerSegment, resolveDrawingLinePresentationForSlot(drawing, 'lower'));

  if (isDrawingLabelVisible(drawing)) {
    ctx.fillStyle = drawing.color;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(
      `LR · 2σ ${formatPrice(regression.residualStdDev)} · slope ${formatSignedValue(regression.slopePerBar)}/bar`,
      Math.min(startX, endX) + 6,
      Math.min(centerStartY, centerEndY) - 5,
    );
  }
  const anchorStartX = scaleX.toPixel(drawing.startIndex);
  const anchorEndX = scaleX.toPixel(drawing.endIndex);
  const anchorStartY = scaleY.toPixel(regression.intercept + regression.slopePerBar * drawing.startIndex);
  const anchorEndY = scaleY.toPixel(regression.intercept + regression.slopePerBar * drawing.endIndex);
  drawAnchorHandle(ctx, anchorStartX, anchorStartY, drawing.color, selected);
  drawAnchorHandle(ctx, anchorEndX, anchorEndY, drawing.color, selected);
  ctx.restore();
}

function drawFibTimeZone(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibTimeZone' }>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const fallback = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  const levels = resolveFibonacciLevels(drawing, fallback);
  const geometry = buildF1BFibTimeZoneLevels(drawing.startIndex, drawing.endIndex, levels);
  const options = resolveFibonacciOptions(drawing);
  ctx.save();
  const fillOverride = drawing.presentation?.fills?.background;
  if (fillOverride?.visible !== false && (fillOverride?.opacity ?? 0) > 0 && geometry.length >= 2) {
    const fill = resolveDrawingFillPresentationForSlot(drawing, 'background');
    const ordered = geometry.map((entry) => ({ ...entry, x: scaleX.toPixel(entry.index) })).sort((a, b) => a.x - b.x);
    for (let index = 0; index < ordered.length - 1; index += 1) {
      const current = ordered[index];
      const next = ordered[index + 1];
      const presentation = resolveF1BLevelPresentation(drawing, current.level);
      ctx.save();
      ctx.fillStyle = resolveTransparentColor(presentation.color, fill.opacity);
      ctx.fillRect(current.x, 0, Math.max(0, next.x - current.x), height);
      ctx.restore();
    }
  }
  geometry.forEach(({ index, level }) => {
    if (index < viewport.startIndex - 1 || index > viewport.endIndex + 1) return;
    const x = scaleX.toPixel(index);
    if (x < -2 || x > width + 2) return;
    const presentation = resolveF1BLevelPresentation(drawing, level);
    strokeDrawingSegmentWithPresentation(ctx, { start: { x, y: 0 }, end: { x, y: height } }, presentation);
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelY = options.verticalLabelPosition === 'top' ? 12 : Math.max(12, height - 12);
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(level, null, drawing),
        x,
        labelY,
        presentation.color,
        width,
        height,
        options.horizontalLabelPosition,
        'center',
        getDrawingLabelFontSize(drawing),
      );
    }
  });
  const initialPresentation = resolveDrawingLinePresentationForSlot(drawing, 'initial');
  strokeDrawingSegmentWithPresentation(
    ctx,
    {
      start: { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) },
      end: { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) },
    },
    initialPresentation,
  );
  drawAnchorHandle(ctx, scaleX.toPixel(drawing.startIndex), scaleY.toPixel(drawing.startPrice), drawing.color, selected);
  drawAnchorHandle(ctx, scaleX.toPixel(drawing.endIndex), scaleY.toPixel(drawing.endPrice), drawing.color, selected);
  ctx.restore();
}

function resolveF1CCircleLevelPresentation(
  drawing: Extract<ChartDrawing, { kind: 'fibCircles' }>,
  level: RuntimeFibonacciLevel,
) {
  const stableSlot = getFibonacciLevelSlotId(level);
  const legacySlot = `circle:${level.value}`;
  const legacyPresentation = resolveDrawingLinePresentationForSlot(drawing, legacySlot);
  if (drawing.presentation?.lines?.[stableSlot]) {
    return resolveDrawingLinePresentation(drawing, stableSlot, legacyPresentation);
  }
  return legacyPresentation;
}

function fillF1CFibCircleBands(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibCircles' }>,
  levels: readonly FibCircleLevelGeometry[],
): void {
  const fill = resolveDrawingFillPresentationForSlot(drawing, 'background');
  if (!fill.visible || fill.opacity <= 0 || !Array.isArray(levels) || levels.length < 2) return;

  const first = levels[0];
  if (first) {
    ctx.save();
    ctx.fillStyle = resolveF1CCircleLevelPresentation(drawing, first.level).color;
    ctx.globalAlpha *= fill.opacity;
    ctx.beginPath();
    ctx.ellipse(
      first.center.x,
      first.center.y,
      Math.max(first.radiusX, 0.5),
      Math.max(first.radiusY, 0.5),
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }

  for (let index = 0; index < levels.length - 1; index += 1) {
    const inner = levels[index];
    const outer = levels[index + 1];
    if (!inner || !outer) continue;
    const outerRx = Math.max(outer.radiusX, 0.5);
    const outerRy = Math.max(outer.radiusY, 0.5);
    const innerRx = Math.max(inner.radiusX, 0.5);
    const innerRy = Math.max(inner.radiusY, 0.5);
    const bandColor = resolveF1CCircleLevelPresentation(drawing, outer.level).color;

    ctx.save();
    ctx.fillStyle = bandColor;
    ctx.globalAlpha *= fill.opacity;
    ctx.beginPath();
    ctx.ellipse(outer.center.x, outer.center.y, outerRx, outerRy, 0, 0, Math.PI * 2);
    ctx.ellipse(inner.center.x, inner.center.y, innerRx, innerRy, 0, 0, Math.PI * 2);
    ctx.fill('evenodd');
    ctx.restore();
  }
}

function drawFibCircles(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibCircles' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const start = { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) };
  const end = { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) };
  const levels = resolveFibonacciLevels(drawing, FIB_CIRCLES_DEFAULT_VALUES);
  const geometry = buildF1CFibCirclesGeometry(start, end, levels);
  if (!geometry) return;

  ctx.save();
  fillF1CFibCircleBands(ctx, drawing, geometry.levels);

  geometry.levels.forEach((entry) => {
    const presentation = resolveF1CCircleLevelPresentation(drawing, entry.level);
    const radiusX = Math.max(entry.radiusX, 0.5);
    const radiusY = Math.max(entry.radiusY, 0.5);
    strokeDrawingPathWithPresentation(ctx, presentation, () => {
      ctx.ellipse(entry.center.x, entry.center.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    });

    if (
      presentation.visible &&
      presentation.opacity > 0 &&
      isDrawingLabelVisible(drawing) &&
      entry.labelAnchor.x >= -24 &&
      entry.labelAnchor.x <= width + 24
    ) {
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(entry.level, null, drawing),
        entry.labelAnchor.x,
        entry.labelAnchor.y,
        presentation.color,
        width,
        height,
        'center',
        'below',
        getDrawingLabelFontSize(drawing),
      );
    }
  });

  strokeDrawingSegmentWithPresentation(
    ctx,
    geometry.trend,
    resolveDrawingLinePresentationForSlot(drawing, 'trend'),
  );
  drawAnchorHandle(ctx, start.x, start.y, drawing.color, selected);
  drawAnchorHandle(ctx, end.x, end.y, drawing.color, selected);
  ctx.restore();
}

function resolveF1CArcLevelPresentation(
  drawing: Extract<ChartDrawing, { kind: 'fibArcs' }>,
  level: RuntimeFibonacciLevel,
) {
  const stableSlot = getFibonacciLevelSlotId(level);
  const legacySlot = `arc:${level.value}`;
  const legacyPresentation = resolveDrawingLinePresentationForSlot(drawing, legacySlot);
  if (drawing.presentation?.lines?.[stableSlot]) {
    return resolveDrawingLinePresentation(drawing, stableSlot, legacyPresentation);
  }
  return legacyPresentation;
}

function fillF1CFibArcBands(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibArcs' }>,
  levels: readonly FibArcLevelGeometry[],
): void {
  const fill = resolveDrawingFillPresentationForSlot(drawing, 'background');
  if (!fill.visible || fill.opacity <= 0 || levels.length === 0) return;

  const fillSector = (outer: FibArcLevelGeometry, innerRadius: number, color: string) => {
    const outerRadius = Math.max(outer.radius, 0.5);
    const inner = Math.max(innerRadius, 0);
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha *= fill.opacity;
    ctx.beginPath();
    if (outer.fullCircle) {
      ctx.arc(outer.center.x, outer.center.y, outerRadius, 0, Math.PI * 2);
      if (inner >= 0.5) ctx.arc(outer.center.x, outer.center.y, inner, 0, Math.PI * 2);
      ctx.fill(inner >= 0.5 ? 'evenodd' : 'nonzero');
    } else if (inner < 0.5) {
      ctx.moveTo(outer.center.x, outer.center.y);
      ctx.arc(outer.center.x, outer.center.y, outerRadius, outer.startAngle, outer.endAngle);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(outer.center.x, outer.center.y, outerRadius, outer.startAngle, outer.endAngle);
      ctx.arc(outer.center.x, outer.center.y, inner, outer.endAngle, outer.startAngle, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  };

  levels.forEach((entry, index) => {
    const innerRadius = index === 0 ? 0 : levels[index - 1]?.radius ?? 0;
    fillSector(entry, innerRadius, resolveF1CArcLevelPresentation(drawing, entry.level).color);
  });
}

function getF1CArcLabelSides(
  drawing: Extract<ChartDrawing, { kind: 'fibArcs' }>,
): Record<FibArcLabelSide, boolean> {
  const settings = getNormalizedFibonacciSettings(drawing);
  const labelSides = settings?.kind === 'fibArcs' ? settings.labelSides : undefined;
  return {
    left: labelSides?.left === true,
    right: labelSides?.right === true,
    top: labelSides?.top !== false,
    bottom: labelSides?.bottom === true,
  };
}


function drawFibSpiral(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibSpiral' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const center = { x: drawing.startIndex, y: drawing.startPrice };
  const reference = { x: drawing.endIndex, y: drawing.endPrice };
  const settings = getNormalizedFibonacciSettings(drawing);
  const counterclockwise = settings?.kind === 'fibSpiral' && settings.counterclockwise === true;
  const persistedBasis = settings?.kind === 'fibSpiral' ? settings.basisPerp : undefined;
  const basis = persistedBasis ?? buildF1DFibSpiralPerpBasis(
    center,
    reference,
    (point) => ({ x: scaleX.toPixel(point.x), y: scaleY.toPixel(point.y) }),
    (point) => ({ x: scaleX.toIndex(point.x), y: scaleY.toPrice(point.y) }),
  );
  if (!basis) return;
  const dataGeometry = buildF1DFibSpiralGeometry(center, reference, basis, counterclockwise);
  if (!dataGeometry) return;
  const geometry = projectF1DFibSpiralGeometry(dataGeometry, (point) => ({
    x: scaleX.toPixel(point.x),
    y: scaleY.toPixel(point.y),
  }));
  const presentation = resolveDrawingLinePresentationForSlot(drawing, 'spiral');

  strokeDrawingPathWithPresentation(ctx, presentation, () => {
    if (!geometry.points.length) return;
    ctx.moveTo(geometry.points[0].x, geometry.points[0].y);
    geometry.points.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  });
  drawAnchorHandle(ctx, geometry.center.x, geometry.center.y, drawing.color, selected);
  drawAnchorHandle(ctx, geometry.reference.x, geometry.reference.y, drawing.color, selected);
}

function drawFibArcs(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibArcs' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const start = { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) };
  const end = { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) };
  const settings = getNormalizedFibonacciSettings(drawing);
  const fullCircles = settings?.kind === 'fibArcs' && settings.fullCircles === true;
  const levels = resolveFibonacciLevels(drawing, FIB_SPEED_RESISTANCE_ARCS_DEFAULT_VALUES);
  const geometry = buildF1CFibArcsGeometry(start, end, levels, fullCircles);
  if (!geometry) return;

  ctx.save();
  fillF1CFibArcBands(ctx, drawing, geometry.levels);
  const labelSides = getF1CArcLabelSides(drawing);

  geometry.levels.forEach((entry) => {
    const presentation = resolveF1CArcLevelPresentation(drawing, entry.level);
    strokeDrawingPathWithPresentation(ctx, presentation, () => {
      ctx.arc(entry.center.x, entry.center.y, entry.radius, entry.startAngle, entry.endAngle);
    });

    if (!presentation.visible || presentation.opacity <= 0 || !isDrawingLabelVisible(drawing)) return;
    const labelText = buildF1BLabelText(entry.level, null, drawing);
    (Object.keys(labelSides) as FibArcLabelSide[]).forEach((side) => {
      if (!labelSides[side]) return;
      // A half-circle only has one vertical extreme. Left/right are always arc endpoints.
      if (!entry.fullCircle && side === 'top' && entry.direction !== 'upper') return;
      if (!entry.fullCircle && side === 'bottom' && entry.direction !== 'lower') return;
      const anchor = entry.labelAnchors[side];
      const horizontal: DrawingLabelSide = side === 'left' ? 'left' : side === 'right' ? 'right' : 'center';
      const vertical: DrawingLabelVerticalPlacement = side === 'top' ? 'above' : side === 'bottom' ? 'below' : 'center';
      drawDrawingLevelLabel(
        ctx,
        labelText,
        anchor.x,
        anchor.y,
        presentation.color,
        width,
        height,
        horizontal,
        vertical,
        getDrawingLabelFontSize(drawing),
      );
    });
  });

  strokeDrawingSegmentWithPresentation(
    ctx,
    geometry.trend,
    resolveDrawingLinePresentationForSlot(drawing, 'trend'),
  );
  drawAnchorHandle(ctx, start.x, start.y, drawing.color, selected);
  drawAnchorHandle(ctx, end.x, end.y, drawing.color, selected);
  ctx.restore();
}

function drawGannBox(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'gannBox' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const x1 = scaleX.toPixel(drawing.startIndex);
  const x2 = scaleX.toPixel(drawing.endIndex);
  const y1 = scaleY.toPixel(drawing.startPrice);
  const y2 = scaleY.toPixel(drawing.endPrice);
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  const w = right - left;
  const h = bottom - top;

  ctx.save();
  fillDrawingPolygonWithPresentation(
    ctx,
    [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }],
    resolveDrawingFillPresentationForSlot(drawing, 'box'),
  );
  strokeDrawingPathWithPresentation(ctx, resolveDrawingLinePresentationForSlot(drawing, 'border'), () => {
    ctx.rect(left, top, w, h);
  });
  GANN_BOX_LEVELS.slice(1, -1).forEach((level) => {
    const x = left + w * level;
    const y = top + h * level;
    const presentation = resolveDrawingLinePresentationForSlot(drawing, `grid:${level}`);
    strokeDrawingPathWithPresentation(ctx, presentation, () => {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    });
  });
  strokeDrawingPathWithPresentation(ctx, resolveDrawingLinePresentationForSlot(drawing, 'diagonals'), () => {
    ctx.moveTo(left, top);
    ctx.lineTo(right, bottom);
    ctx.moveTo(right, top);
    ctx.lineTo(left, bottom);
  });
  drawAnchorHandle(ctx, x1, y1, drawing.color, selected);
  drawAnchorHandle(ctx, x2, y2, drawing.color, selected);
  ctx.restore();
}

function drawCircle(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'circle' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const centerX = scaleX.toPixel(drawing.startIndex);
  const centerY = scaleY.toPixel(drawing.startPrice);
  const edgeX = scaleX.toPixel(drawing.endIndex);
  const edgeY = scaleY.toPixel(drawing.endPrice);
  const radius = Math.hypot(edgeX - centerX, edgeY - centerY);
  if (radius < 0.5) return;
  ctx.save();
  ctx.fillStyle = resolveTransparentColor(drawing.color, 0.08);
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawAnchorHandle(ctx, centerX, centerY, drawing.color, selected);
  drawAnchorHandle(ctx, edgeX, edgeY, drawing.color, selected);
  ctx.restore();
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'ellipse' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const x1 = scaleX.toPixel(drawing.startIndex);
  const x2 = scaleX.toPixel(drawing.endIndex);
  const y1 = scaleY.toPixel(drawing.startPrice);
  const y2 = scaleY.toPixel(drawing.endPrice);
  const centerX = (x1 + x2) / 2;
  const centerY = (y1 + y2) / 2;
  const radiusX = Math.max(Math.abs(x2 - x1) / 2, 0.5);
  const radiusY = Math.max(Math.abs(y2 - y1) / 2, 0.5);
  ctx.save();
  ctx.fillStyle = resolveTransparentColor(drawing.color, 0.08);
  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  drawAnchorHandle(ctx, x1, y1, drawing.color, selected);
  drawAnchorHandle(ctx, x2, y2, drawing.color, selected);
  ctx.restore();
}

function drawForecast(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'forecast' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  const priceChange = drawing.endPrice - drawing.startPrice;
  const percent = Math.abs(drawing.startPrice) < 1e-9 ? null : (priceChange / drawing.startPrice) * 100;

  ctx.save();
  ctx.fillStyle = resolveTransparentColor(drawing.color, 0.08);
  ctx.fillRect(left, top, width, height);
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, startY);
  ctx.lineTo(endX, endY);
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  if (isDrawingLabelVisible(drawing)) {
    ctx.setLineDash([]);
    ctx.fillStyle = drawing.color;
    ctx.font = '11px "Segoe UI", sans-serif';
    ctx.textAlign = endX >= startX ? 'left' : 'right';
    ctx.textBaseline = endY >= startY ? 'top' : 'bottom';
    const percentText = percent == null ? '' : ` · ${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
    ctx.fillText(
      `${formatPrice(drawing.startPrice)} → ${formatPrice(drawing.endPrice)}${percentText}`,
      endX + (endX >= startX ? 5 : -5),
      endY + (endY >= startY ? 5 : -5),
    );
  }
  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
  ctx.restore();
}

function getLineDash(lineStyle: ChartDrawing['lineStyle']): number[] {
  if (lineStyle === 'dashed') {
    return [8, 5];
  }

  if (lineStyle === 'dotted') {
    return [2, 4];
  }

  return [];
}

function drawFibRetracement(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fib' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  alignment: 'left' | 'right' = 'right',
  axisWidth: number = 56,
): void {
  ctx.save();
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  strokeDrawingSegmentWithPresentation(
    ctx,
    { start: { x: startX, y: startY }, end: { x: endX, y: endY } },
    resolveDrawingLinePresentationForSlot(drawing, 'trend'),
  );
  const levels = resolveFibonacciLevels(drawing, FIB_RETRACEMENT_LEVELS);
  const options = resolveFibonacciOptions(drawing);
  const geometry = buildF1BRetracementLevels(
    drawing.startPrice,
    drawing.endPrice,
    startX,
    endX,
    width,
    levels,
    drawing.extendLeft === true,
    getEffectiveDrawingExtendRight(drawing),
    options.reverse,
    options.logScaleLevels,
  );
  const rendered = geometry.map((entry) => ({
    ...entry,
    y: scaleY.toPixel(entry.price),
    startX: entry.segment.start.x,
    endX: entry.segment.end.x,
  }));
  drawF1BHorizontalBands(ctx, drawing, rendered, 'levels');
  rendered.forEach((entry) => {
    const presentation = resolveF1BLevelPresentation(drawing, entry.level);
    const segment = { start: { x: entry.startX, y: entry.y }, end: { x: entry.endX, y: entry.y } };
    strokeDrawingSegmentWithPresentation(ctx, segment, presentation);
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelPlacement = getSegmentLabelPlacement(segment, options.horizontalLabelPosition);
      drawDrawingLevelLabel(
        ctx,
        buildF1BLabelText(entry.level, entry.price, drawing),
        labelPlacement.anchorX,
        labelPlacement.anchorY,
        presentation.color,
        width,
        height,
        labelPlacement.preferredSide,
        'above',
        getDrawingLabelFontSize(drawing),
      );
    }
  });
  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
  ctx.restore();
}

function drawFibExtension(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibExtension' }>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  alignment: 'left' | 'right' = 'right',
  axisWidth: number = 56,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const boundaryIndex = drawing.endIndex >= drawing.startIndex ? viewport.endIndex : viewport.startIndex;
  const boundaryX = scaleX.toPixel(boundaryIndex);

  strokeDrawingSegmentWithPresentation(
    ctx,
    { start: { x: startX, y: startY }, end: { x: endX, y: endY } },
    resolveDrawingLinePresentationForSlot(drawing, 'trend'),
  );
  drawHorizontalFibLevels(
    ctx,
    drawing,
    scaleY,
    Math.min(endX, boundaryX),
    Math.max(endX, boundaryX),
    width,
    height,
    FIB_EXTENSION_LEVELS,
    alignment,
    axisWidth,
  );
  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
}

function drawFibFan(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibFan' }>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  _alignment: 'left' | 'right' = 'right',
): void {
  const fanSettings = getNormalizedFibonacciSettings(drawing);
  const settings: FibonacciSpeedResistanceFanSettings =
    fanSettings && fanSettings.kind === 'fibFan'
      ? fanSettings
      : (createDefaultFibonacciSettings('fibFan') as FibonacciSpeedResistanceFanSettings);

  const geometry = buildF1EFibSpeedResistanceFanGeometry(
    drawing.startIndex,
    drawing.startPrice,
    drawing.endIndex,
    drawing.endPrice,
    settings,
    scaleX,
    scaleY,
    width,
    height,
    viewport,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();

  // 1. Fill Background Bands
  const fillPresentation = resolveDrawingFillPresentationForSlot(drawing, 'levels');
  if (fillPresentation.visible && fillPresentation.opacity > 0 && geometry.backgroundBands.length > 0) {
    geometry.backgroundBands.forEach((band) => {
      if (band.points.length < 3) return;
      ctx.save();
      const levelPres = resolveDrawingLinePresentationForSlot(drawing, `price:${band.levelId}`);
      ctx.fillStyle = resolveTransparentColor(levelPres.color || drawing.color, fillPresentation.opacity);
      ctx.beginPath();
      ctx.moveTo(band.points[0].x, band.points[0].y);
      for (let i = 1; i < band.points.length; i += 1) {
        ctx.lineTo(band.points[i].x, band.points[i].y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  // 2. Draw Grid
  if (geometry.grid) {
    const gridPresentation = resolveDrawingLinePresentationForSlot(drawing, 'grid');
    const gridStyle = gridPresentation.visible ? gridPresentation : { color: drawing.color, lineWidth: 1, lineStyle: 'dashed' as const, opacity: 0.25, visible: true };
    geometry.grid.priceGridSegments.forEach((seg) => strokeDrawingSegmentWithPresentation(ctx, seg, gridStyle));
    geometry.grid.timeGridSegments.forEach((seg) => strokeDrawingSegmentWithPresentation(ctx, seg, gridStyle));
    geometry.grid.boundaryRectangle.forEach((seg) => strokeDrawingSegmentWithPresentation(ctx, seg, gridStyle));
  }

  // 3. Draw Trend Line (Apex to Handle)
  const trendPresentation = resolveDrawingLinePresentationForSlot(drawing, 'trend');
  strokeDrawingSegmentWithPresentation(ctx, geometry.trendSegment, trendPresentation);

  // 4. Draw Price Rays & Labels
  geometry.priceRays.forEach((ray) => {
    const presentation = resolveDrawingLinePresentationForSlot(drawing, `price:${ray.level.id}`);
    strokeDrawingSegmentWithPresentation(ctx, ray.segment, presentation);

    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const coeffText = settings.coefficientFormat === 'percent' ? `${(ray.coefficient * 100).toFixed(1)}%` : ray.coefficient.toString();
      const labelText = `${coeffText} (${formatPrice(ray.targetPrice)})`;
      const side = settings.priceLabelSides?.left ? 'left' : 'right';
      drawDrawingLevelLabel(
        ctx,
        labelText,
        side === 'left' ? ray.segment.start.x : ray.labelAnchor.x,
        ray.labelAnchor.y,
        presentation.color,
        width,
        height,
        side === 'left' ? 'left' : 'right',
      );
    }
  });

  // 5. Draw Time Rays & Labels
  geometry.timeRays.forEach((ray) => {
    const presentation = resolveDrawingLinePresentationForSlot(drawing, `time:${ray.level.id}`);
    strokeDrawingSegmentWithPresentation(ctx, ray.segment, presentation);

    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const coeffText = settings.coefficientFormat === 'percent' ? `${(ray.coefficient * 100).toFixed(1)}%` : ray.coefficient.toString();
      drawDrawingLevelLabel(
        ctx,
        coeffText,
        ray.labelAnchor.x,
        ray.labelAnchor.y,
        presentation.color,
        width,
        height,
        'center',
      );
    }
  });

  // 6. Draw Anchor Handles when selected
  drawAnchorHandle(ctx, geometry.apex.x, geometry.apex.y, drawing.color, selected);
  drawAnchorHandle(ctx, geometry.handle.x, geometry.handle.y, drawing.color, selected);

  ctx.restore();
}

function drawAnchoredGuideLine(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
): void {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}

function drawHorizontalFibLevels(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fib' | 'fibExtension' }>,
  scaleY: ScaleY,
  leftX: number,
  rightX: number,
  width: number,
  height: number,
  levels: readonly number[],
  alignment: 'left' | 'right' = 'right',
  _axisWidth: number = 56,
): void {
  const priceDelta = drawing.startPrice - drawing.endPrice;
  const renderedLeftX = drawing.extendLeft === true ? 0 : leftX;
  const renderedRightX = drawing.extendRight === true ? width : rightX;
  const background = resolveDrawingFillPresentationForSlot(drawing, 'levels');

  // TradingView-style Fib composition: when Background is enabled, fill each
  // interval with a low-opacity tint derived from that level's own color.
  if (background.visible && background.opacity > 0) {
    for (let index = 0; index < levels.length - 1; index += 1) {
      const level = levels[index];
      const nextLevel = levels[index + 1];
      const y1 = scaleY.toPixel(drawing.endPrice + priceDelta * level);
      const y2 = scaleY.toPixel(drawing.endPrice + priceDelta * nextLevel);
      const presentation = resolveDrawingLinePresentationForSlot(drawing, `level:${level}`);
      ctx.save();
      ctx.fillStyle = resolveTransparentColor(presentation.color, background.opacity);
      ctx.fillRect(renderedLeftX, Math.min(y1, y2), Math.max(0, renderedRightX - renderedLeftX), Math.abs(y2 - y1));
      ctx.restore();
    }
  }

  const fontSize = getDrawingLabelFontSize(drawing);
  levels.forEach((level) => {
    const y = scaleY.toPixel(drawing.endPrice + priceDelta * level);
    const presentation = resolveDrawingLinePresentationForSlot(drawing, `level:${level}`);
    strokeDrawingSegmentWithPresentation(
      ctx,
      { start: { x: renderedLeftX, y }, end: { x: renderedRightX, y } },
      presentation,
    );
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelText = `${level.toFixed(3)} (${formatPrice(drawing.endPrice + priceDelta * level)})`;
      const labelAnchorX = alignment === 'right' ? renderedRightX : renderedLeftX;
      drawDrawingLevelLabel(
        ctx,
        labelText,
        labelAnchorX,
        y,
        presentation.color,
        width,
        height,
        alignment === 'right' ? 'right' : 'left',
        'center',
        fontSize,
      );
    }
  });
}

function drawAnchoredFanLines(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'fibFan' | 'gann' }>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  lines: readonly { label: string; factor: number }[],
  alignment: 'left' | 'right' = 'right',
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const deltaIndex = normalizeIndexDelta(drawing.endIndex - drawing.startIndex);
  const baseSlope = (drawing.endPrice - drawing.startPrice) / deltaIndex;
  const boundaryIndex = drawing.endIndex >= drawing.startIndex ? viewport.endIndex : viewport.startIndex;
  const boundaryX = scaleX.toPixel(boundaryIndex);

  lines.forEach((line) => {
    const projectedPrice = drawing.startPrice + (boundaryIndex - drawing.startIndex) * baseSlope * line.factor;
    const projectedY = scaleY.toPixel(projectedPrice);
    const slotId = drawing.kind === 'gann' ? `ray:${line.label}` : `ray:${line.factor}`;
    const presentation = resolveDrawingLinePresentationForSlot(drawing, slotId);
    strokeDrawingSegmentWithPresentation(
      ctx,
      { start: { x: startX, y: startY }, end: { x: boundaryX, y: projectedY } },
      presentation,
    );
    if (presentation.visible && presentation.opacity > 0 && isDrawingLabelVisible(drawing)) {
      const labelSide: DrawingLabelSide = alignment === 'right'
        ? (boundaryX >= startX ? 'left' : 'right')
        : (boundaryX >= startX ? 'right' : 'left');
      drawDrawingLevelLabel(ctx, line.label, boundaryX, projectedY, presentation.color, width, height, labelSide, 'center', getDrawingLabelFontSize(drawing));
    }
  });

  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
}

export function getTextDrawingFont(drawing: Extract<ChartDrawing, { kind: 'text' }>): string {
  const fontSize = Math.max(10, Math.min(drawing.fontSize ?? 13, 28));
  const fontFamily = drawing.fontFamily === 'serif'
    ? 'Georgia, serif'
    : drawing.fontFamily === 'mono' ? 'Consolas, monospace' : '"Segoe UI", sans-serif';
  return `${drawing.italic ? 'italic ' : ''}${drawing.bold ? '700 ' : ''}${fontSize}px ${fontFamily}`;
}

function drawTextDrawing(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'text' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const box = getTextBoxBounds(drawing, scaleX, scaleY);
  const fontSize = Math.max(10, Math.min(drawing.fontSize ?? 13, 28));
  const textAlign = drawing.textAlign ?? 'left';

  ctx.setLineDash([]);
  ctx.fillStyle = drawing.color;
  ctx.font = getTextDrawingFont(drawing);
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'top';
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.left, box.top, box.width, box.height);
  ctx.clip();
  const textX = textAlign === 'left'
    ? box.left + 4
    : textAlign === 'center'
      ? box.left + box.width / 2
      : box.left + box.width - 4;
  const lineHeight = Math.max(fontSize + 3, Math.round(fontSize * 1.25));
  wrapTextLines(ctx, drawing.text, Math.max(20, box.width - 8)).slice(0, Math.max(1, Math.floor((box.height - 6) / lineHeight))).forEach((line, index) => {
    ctx.fillText(line, textX, box.top + 4 + index * lineHeight);
  });
  ctx.restore();

  if (selected) {
    ctx.save();
    ctx.strokeStyle = drawing.color;
    ctx.strokeRect(box.left, box.top, box.width, box.height);
    drawTextBoxHandles(ctx, box, drawing.color);
    ctx.restore();
  }

  drawAnchorHandle(ctx,
    drawing.renderTextBox ? scaleX.toPixel(drawing.barIndex) : box.left - 2,
    drawing.renderTextBox ? scaleY.toPixel(drawing.price) : box.top + box.height + 4,
    drawing.color, selected);
}

export function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  return text.split(/\r?\n/).flatMap((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines: string[] = [];
    let line = '';
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    });
    lines.push(line);
    return lines;
  });
}

function drawTextBoxHandles(ctx: CanvasRenderingContext2D, box: TextBoxBounds, color: string): void {
  const handleSize = 6;
  const handles = [
    [box.left, box.top],
    [box.left + box.width / 2, box.top],
    [box.left + box.width, box.top],
    [box.left + box.width, box.top + box.height / 2],
    [box.left + box.width, box.top + box.height],
    [box.left + box.width / 2, box.top + box.height],
    [box.left, box.top + box.height],
    [box.left, box.top + box.height / 2],
  ];
  ctx.fillStyle = color;
  handles.forEach(([x, y]) => ctx.fillRect(x - handleSize / 2, y - handleSize / 2, handleSize, handleSize));
}


function drawHorizontalRay(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'horizontalRay' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  selected: boolean,
): void {
  const x = scaleX.toPixel(drawing.barIndex);
  const y = scaleY.toPixel(drawing.price);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  drawAnchorHandle(ctx, x, y, drawing.color, selected);
}

function drawCrossLine(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'crossLine' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const x = scaleX.toPixel(drawing.barIndex);
  const y = scaleY.toPixel(drawing.price);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  drawAnchorHandle(ctx, x, y, drawing.color, selected);
}

function drawConfigurableTrendLine(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'trendline' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const start = { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) };
  const end = { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) };
  const segment = extendSegmentHorizontally(start, end, width, drawing.extendLeft === true, drawing.extendRight === true);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(segment.start.x, segment.start.y);
  ctx.lineTo(segment.end.x, segment.end.y);
  ctx.stroke();
  drawAnchorHandle(ctx, start.x, start.y, drawing.color, selected);
  drawAnchorHandle(ctx, end.x, end.y, drawing.color, selected);
  ctx.restore();
}

function drawExtendedLine(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'extendedLine' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const start = { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) };
  const end = { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) };
  const segment = extendInfiniteLineToRect(start, end, width, height);
  if (segment) {
    ctx.beginPath();
    ctx.moveTo(segment.start.x, segment.start.y);
    ctx.lineTo(segment.end.x, segment.end.y);
    ctx.stroke();
  }
  drawAnchorHandle(ctx, start.x, start.y, drawing.color, selected);
  drawAnchorHandle(ctx, end.x, end.y, drawing.color, selected);
}

function drawInfoLine(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'infoLine' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  bars: readonly OHLCBar[],
): void {
  const start = { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) };
  const end = { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) };
  const segment = extendSegmentHorizontally(start, end, width, drawing.extendLeft === true, drawing.extendRight === true);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(segment.start.x, segment.start.y);
  ctx.lineTo(segment.end.x, segment.end.y);
  ctx.stroke();

  if (isDrawingLabelVisible(drawing)) {
    const metrics = calculateDrawingRangeMetrics(
      drawing.startIndex,
      drawing.startPrice,
      drawing.endIndex,
      drawing.endPrice,
      bars,
    );
    const sign = metrics.priceChange > 0 ? '+' : '';
    const percentText = metrics.percentChange == null
      ? 'n/a'
      : `${metrics.percentChange > 0 ? '+' : ''}${metrics.percentChange.toFixed(2)}%`;
    const dayText = metrics.calendarDays == null ? '' : ` · ${formatElapsedDays(metrics.calendarDays)}`;
    const label = `${formatPrice(metrics.startPrice)} → ${formatPrice(metrics.endPrice)} · ${sign}${formatPrice(metrics.priceChange)} (${percentText}) · ${metrics.barSpan} bars${dayText}`;
    drawDrawingInfoLabel(ctx, label, (start.x + end.x) / 2, (start.y + end.y) / 2 - 18, drawing.color, width);
  }

  drawAnchorHandle(ctx, start.x, start.y, drawing.color, selected);
  drawAnchorHandle(ctx, end.x, end.y, drawing.color, selected);
  ctx.restore();
}

function drawTrendAngle(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'trendAngle' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const start = { x: scaleX.toPixel(drawing.startIndex), y: scaleY.toPixel(drawing.startPrice) };
  const end = { x: scaleX.toPixel(drawing.endIndex), y: scaleY.toPixel(drawing.endPrice) };
  const segment = extendSegmentHorizontally(start, end, width, drawing.extendLeft === true, drawing.extendRight === true);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(segment.start.x, segment.start.y);
  ctx.lineTo(segment.end.x, segment.end.y);
  ctx.stroke();

  if (isDrawingLabelVisible(drawing)) {
    const slope = calculateSlopePerBar(drawing.startIndex, drawing.startPrice, drawing.endIndex, drawing.endPrice);
    const angle = calculateVisualAngleDegrees(start, end);
    const slopeText = slope == null ? 'vertical' : `${slope >= 0 ? '+' : ''}${formatPrice(slope)}/bar`;
    drawDrawingInfoLabel(
      ctx,
      `Slope ${slopeText} · ${angle.toFixed(1)}° visual`,
      (start.x + end.x) / 2,
      (start.y + end.y) / 2 - 18,
      drawing.color,
      width,
    );
  }

  drawAnchorHandle(ctx, start.x, start.y, drawing.color, selected);
  drawAnchorHandle(ctx, end.x, end.y, drawing.color, selected);
  ctx.restore();
}

function drawPriceRange(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'priceRange' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  selected: boolean,
): void {
  const y1 = scaleY.toPixel(drawing.startPrice);
  const y2 = scaleY.toPixel(drawing.endPrice);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = drawing.color;
  ctx.fillRect(0, top, width, Math.max(bottom - top, 1));
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(0, y1);
  ctx.lineTo(width, y1);
  ctx.moveTo(0, y2);
  ctx.lineTo(width, y2);
  ctx.stroke();

  const min = Math.min(drawing.startPrice, drawing.endPrice);
  const max = Math.max(drawing.startPrice, drawing.endPrice);
  const range = max - min;
  const percent = calculatePriceRangePercent(drawing.startPrice, drawing.endPrice);
  if (isDrawingLabelVisible(drawing)) {
    drawDrawingInfoLabel(
      ctx,
      `${formatPrice(min)} – ${formatPrice(max)} · Δ ${formatPrice(range)}${percent == null ? '' : ` (${percent.toFixed(2)}%)`}`,
      width / 2,
      (top + bottom) / 2,
      drawing.color,
      width,
    );
  }

  drawAnchorHandle(ctx, scaleX.toPixel(drawing.startIndex), y1, drawing.color, selected);
  drawAnchorHandle(ctx, scaleX.toPixel(drawing.endIndex), y2, drawing.color, selected);
}

function drawDateRange(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'dateRange' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  bars: readonly OHLCBar[],
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const endX = scaleX.toPixel(drawing.endIndex);
  const left = Math.min(startX, endX);
  const right = Math.max(startX, endX);
  ctx.save();
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = drawing.color;
  ctx.fillRect(left, 0, Math.max(right - left, 1), height);
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(startX, 0);
  ctx.lineTo(startX, height);
  ctx.moveTo(endX, 0);
  ctx.lineTo(endX, height);
  ctx.stroke();

  const metrics = calculateDrawingRangeMetrics(
    drawing.startIndex,
    drawing.startPrice,
    drawing.endIndex,
    drawing.endPrice,
    bars,
  );
  const rangeStart = Math.max(0, Math.min(drawing.startIndex, drawing.endIndex));
  const rangeEnd = Math.min(bars.length - 1, Math.max(drawing.startIndex, drawing.endIndex));
  const rangeBars = rangeStart <= rangeEnd ? bars.slice(rangeStart, rangeEnd + 1) : [];
  const candleTopY = rangeBars.length
    ? Math.min(...rangeBars.map((bar) => scaleY.toPixel(bar.high)))
    : null;
  const candleBottomY = rangeBars.length
    ? Math.max(...rangeBars.map((bar) => scaleY.toPixel(bar.low)))
    : null;
  const labelY = chooseRangeLabelY(candleTopY, candleBottomY, height);
  const daysText = metrics.calendarDays == null ? '' : ` · ${formatElapsedDays(metrics.calendarDays)}`;
  const dateText = metrics.startDate && metrics.endDate ? ` · ${metrics.startDate} → ${metrics.endDate}` : '';
  if (isDrawingLabelVisible(drawing)) {
    drawDrawingInfoLabel(
      ctx,
      `${metrics.barSpan} bars${daysText}${dateText}`,
      (left + right) / 2,
      labelY,
      drawing.color,
      width,
    );
  }

  const handleY = height / 2;
  drawAnchorHandle(ctx, startX, handleY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, handleY, drawing.color, selected);
  // Preserve the price anchors for Renko/persistence even though date-range rendering is X-axis driven.
  void scaleY;
  void width;
}

function drawDrawingInfoLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  boundsWidth?: number,
): void {
  ctx.save();
  ctx.font = '11px "Segoe UI", sans-serif';
  const metrics = ctx.measureText(text);
  const paddingX = 6;
  const paddingY = 4;
  const boxWidth = metrics.width + paddingX * 2;
  const boxHeight = 19;
  const safeX = boundsWidth == null
    ? x
    : Math.max(4 + boxWidth / 2, Math.min(boundsWidth - 4 - boxWidth / 2, x));
  const left = safeX - boxWidth / 2;
  const top = y - boxHeight / 2;
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(18, 24, 33, 0.88)';
  ctx.beginPath();
  ctx.roundRect(left, top, boxWidth, boxHeight, 4);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, safeX, y + paddingY * 0.1);
  ctx.restore();
}

function formatElapsedDays(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}d`;
}

function drawRay(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'ray' }>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const boundaryIndex = drawing.endIndex >= drawing.startIndex ? viewport.endIndex : viewport.startIndex;
  const projectedPrice =
    drawing.startPrice +
    (boundaryIndex - drawing.startIndex) *
      ((drawing.endPrice - drawing.startPrice) / normalizeIndexDelta(drawing.endIndex - drawing.startIndex));
  const boundaryX = scaleX.toPixel(boundaryIndex);
  const boundaryY = scaleY.toPixel(projectedPrice);

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(boundaryX, boundaryY);
  ctx.stroke();

  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);

  if (selected) {
    ctx.setLineDash([]);
    ctx.fillStyle = drawing.color;
    ctx.beginPath();
    ctx.moveTo(boundaryX, boundaryY);
    if (boundaryX >= startX) {
      ctx.lineTo(boundaryX - 8, boundaryY - 4);
      ctx.lineTo(boundaryX - 8, boundaryY + 4);
    } else {
      ctx.lineTo(boundaryX + 8, boundaryY - 4);
      ctx.lineTo(boundaryX + 8, boundaryY + 4);
    }
    ctx.closePath();
    ctx.fill();
  }

  void width;
  void height;
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'arrow' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const angle = Math.atan2(endY - startY, endX - startX);
  const headLength = 12;
  const headAngle = Math.PI / 7;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(angle - headAngle),
    endY - headLength * Math.sin(angle - headAngle),
  );
  ctx.moveTo(endX, endY);
  ctx.lineTo(
    endX - headLength * Math.cos(angle + headAngle),
    endY - headLength * Math.sin(angle + headAngle),
  );
  ctx.stroke();

  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
}

function drawRectangle(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'rect' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected: boolean,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const rectWidth = Math.max(Math.abs(endX - startX), 1);
  const rectHeight = Math.max(Math.abs(endY - startY), 1);

  ctx.strokeRect(left, top, rectWidth, rectHeight);

  const bodyFill = drawing.presentation?.fills?.body;
  if (bodyFill && bodyFill.visible !== false && (bodyFill.opacity ?? 0.12) > 0) {
    ctx.save();
    ctx.fillStyle = resolveTransparentColor(bodyFill.color || drawing.color, bodyFill.opacity ?? 0.12);
    ctx.fillRect(left, top, rectWidth, rectHeight);
    ctx.restore();
  }

  if (selected) {
    ctx.save();
    ctx.fillStyle = `${drawing.color}22`;
    ctx.fillRect(left, top, rectWidth, rectHeight);
    ctx.restore();
  }

  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
}

function drawParallelChannel(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'channel' }>,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  const offsetStartY = scaleY.toPixel(drawing.startPrice + drawing.offset);
  const offsetEndY = scaleY.toPixel(drawing.endPrice + drawing.offset);
  const centerStartY = scaleY.toPixel(drawing.startPrice + drawing.offset / 2);
  const centerEndY = scaleY.toPixel(drawing.endPrice + drawing.offset / 2);
  const extendLeft = drawing.extendLeft === true;
  const extendRight = drawing.extendRight === true;
  const base = extendSegmentHorizontally({ x: startX, y: startY }, { x: endX, y: endY }, width, extendLeft, extendRight);
  const offset = extendSegmentHorizontally(
    { x: startX, y: offsetStartY },
    { x: endX, y: offsetEndY },
    width,
    extendLeft,
    extendRight,
  );
  const center = extendSegmentHorizontally(
    { x: startX, y: centerStartY },
    { x: endX, y: centerEndY },
    width,
    extendLeft,
    extendRight,
  );

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  ctx.clip();
  const fillPresentation = resolveDrawingFillPresentationForSlot(drawing, 'channel');
  fillDrawingPolygonWithPresentation(ctx, [base.start, base.end, offset.end, offset.start], fillPresentation);
  strokeDrawingSegmentWithPresentation(ctx, base, resolveDrawingLinePresentationForSlot(drawing, 'base'));
  const centerPresentation = resolveDrawingLinePresentationForSlot(drawing, 'center');
  strokeDrawingSegmentWithPresentation(
    ctx,
    center,
    centerPresentation,
    centerPresentation.lineStyle === 'dashed' ? [6, 4] : undefined,
  );
  strokeDrawingSegmentWithPresentation(ctx, offset, resolveDrawingLinePresentationForSlot(drawing, 'offset'));

  if (selected && !fillPresentation.visible) {
    ctx.save();
    ctx.fillStyle = resolveTransparentColor(drawing.color, 0.08);
    ctx.beginPath();
    ctx.moveTo(base.start.x, base.start.y);
    ctx.lineTo(base.end.x, base.end.y);
    ctx.lineTo(offset.end.x, offset.end.y);
    ctx.lineTo(offset.start.x, offset.start.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawAnchorHandle(ctx, startX, startY, drawing.color, selected);
  drawAnchorHandle(ctx, endX, endY, drawing.color, selected);
  ctx.restore();
}

function drawGannFan(
  ctx: CanvasRenderingContext2D,
  drawing: Extract<ChartDrawing, { kind: 'gann' }>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  width: number,
  height: number,
  selected: boolean,
  alignment: 'left' | 'right' = 'right',
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  strokeDrawingSegmentWithPresentation(
    ctx,
    { start: { x: startX, y: startY }, end: { x: endX, y: endY } },
    resolveDrawingLinePresentationForSlot(drawing, 'trend'),
  );
  drawAnchoredFanLines(ctx, drawing, viewport, scaleX, scaleY, width, height, selected, GANN_FAN_LINES, alignment);
}

function drawAnchorHandle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  selected: boolean,
): void {
  ctx.setLineDash([]);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, selected ? 4 : 2.5, 0, Math.PI * 2);
  ctx.fill();
}

function normalizeIndexDelta(deltaIndex: number): number {
  if (deltaIndex === 0) {
    return 1;
  }

  return deltaIndex;
}

function approximateTextWidth(text: string, fontSize: number): number {
  return Math.max(24, Math.round(text.length * fontSize * 0.58));
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const limitedRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + limitedRadius, y);
  ctx.lineTo(x + width - limitedRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + limitedRadius);
  ctx.lineTo(x + width, y + height - limitedRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - limitedRadius, y + height);
  ctx.lineTo(x + limitedRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - limitedRadius);
  ctx.lineTo(x, y + limitedRadius);
  ctx.quadraticCurveTo(x, y, x + limitedRadius, y);
  ctx.closePath();
}

export function drawBollingerBand(
  ctx: CanvasRenderingContext2D,
  upper: Array<number | null>,
  lower: Array<number | null>,
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
  color: string,
): void {
  ctx.fillStyle = `${color}22`;
  ctx.beginPath();
  const points: Array<{ x: number; y: number }> = [];
  for (let index = Math.max(Math.floor(viewport.startIndex), 0); index <= Math.min(Math.ceil(viewport.endIndex), upper.length - 1); index += 1) {
    if (upper[index] !== null) {
      points.push({ x: scaleX.toPixel(index), y: scaleY.toPixel(upper[index] as number) });
    }
  }
  points.forEach((point, pointIndex) => {
    if (pointIndex === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  for (let index = Math.min(Math.ceil(viewport.endIndex), lower.length - 1); index >= Math.max(Math.floor(viewport.startIndex), 0); index -= 1) {
    if (lower[index] !== null) {
      ctx.lineTo(scaleX.toPixel(index), scaleY.toPixel(lower[index] as number));
    }
  }
  if (points.length > 0) {
    ctx.closePath();
    ctx.fill();
  }
}

export function drawLastPriceMarker(
  ctx: CanvasRenderingContext2D,
  price: number,
  prevClose: number | undefined,
  scaleY: ScaleY,
  width: number,
  theme: ChartTheme,
  axisWidth = 56,
): void {
  const y = scaleY.toPixel(price);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = price >= (prevClose ?? price) ? theme.candleUp : theme.candleDown;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width - axisWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawAxisValueTags(
  ctx: CanvasRenderingContext2D,
  tags: ResolvedAxisValueTag[],
  width: number,
  axisWidth: number,
  axisGap: number,
  axisBackground: string,
): void {
  if (!tags.length) {
    return;
  }

  const axisX = width - axisWidth - axisGap;

  ctx.save();
  ctx.font = AXIS_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  tags.forEach((tag) => {
    // Re-measure exact width for rendering
    tag.width = Math.min(axisWidth - 8, Math.max(46, Math.ceil(ctx.measureText(tag.text).width) + 14));
    const left = axisX + 4;
    const bodyWidth = axisWidth - 8;
    
    // Draw the tag with an arrow pointer
    drawAxisTag(ctx, left, tag.top, bodyWidth, tag.height, tag.y, tag.color);
    
    ctx.fillStyle = resolveAxisTagText(tag.color, axisBackground);
    ctx.fillText(tag.text, left + bodyWidth / 2, tag.top + tag.height / 2);
  });
  ctx.restore();
}

export function resolveAxisTagText(color: string, axisBackground: string): '#000000' | '#ffffff' {
  const { hex, alpha } = parseColor(color);
  const fill = hexToRgb(hex);
  const backdrop = hexToRgb(parseColor(axisBackground).hex);
  const luminance = (channel: number, background: number) => {
    const srgb = (channel * alpha + background * (1 - alpha)) / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  };
  const backgroundLuminance = 0.2126 * luminance(fill.r, backdrop.r)
    + 0.7152 * luminance(fill.g, backdrop.g)
    + 0.0722 * luminance(fill.b, backdrop.b);
  const blackContrast = (backgroundLuminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (backgroundLuminance + 0.05);
  return blackContrast >= whiteContrast ? '#000000' : '#ffffff';
}

function drawAxisTag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  pointerY: number,
  color: string,
): void {
  const arrowSize = 5;
  const radius = 3;
  const pointerRelY = Math.min(Math.max(pointerY - y, arrowSize), height - arrowSize);

  ctx.fillStyle = color;
  ctx.beginPath();
  // Body with arrow on the left side
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  
  // The triangle pointer
  ctx.lineTo(x, y + pointerRelY + arrowSize);
  ctx.lineTo(x - arrowSize, y + pointerRelY);
  ctx.lineTo(x, y + pointerRelY - arrowSize);
  
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

export function drawLegendTokens(
  ctx: CanvasRenderingContext2D,
  tokens: LegendToken[],
  x: number,
  y: number,
  maxWidth: number,
): number {
  if (!tokens.length || maxWidth <= 0) {
    return y;
  }

  ctx.save();
  ctx.font = LEGEND_FONT;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const rowHeight = 15;
  const wrapWidth = x + maxWidth;
  let cursorX = x;
  let cursorY = y;

  tokens.forEach((token) => {
    const textWidth = ctx.measureText(token.text).width;
    if (cursorX > x && cursorX + textWidth > wrapWidth) {
      cursorX = x;
      cursorY += rowHeight;
    }
    ctx.fillStyle = token.color;
    ctx.fillText(token.text, cursorX, cursorY);
    cursorX += textWidth + (token.gapAfter ?? 10);
  });

  ctx.restore();
  return cursorY + rowHeight;
}

export function measureAxisWidth(
  ctx: CanvasRenderingContext2D,
  values: number[],
  minimumWidth = 68,
  maximumWidth = 122,
): number {
  if (!values.length) {
    return minimumWidth;
  }

  ctx.save();
  ctx.font = AXIS_FONT;
  const maxTextWidth = values.reduce((maxWidth, value) => {
    if (!Number.isFinite(value)) {
      return maxWidth;
    }
    return Math.max(maxWidth, ctx.measureText(formatPrice(value)).width);
  }, 0);
  ctx.restore();

  const paddedWidth = Math.ceil(maxTextWidth) + 18;
  const clampedWidth = Math.min(Math.max(paddedWidth, minimumWidth), maximumWidth);
  return Math.ceil(clampedWidth / 2) * 2;
}

export function measureAxisLabelWidth(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  minimumWidth = 68,
  maximumWidth = 168,
): number {
  if (!labels.length) {
    return minimumWidth;
  }

  ctx.save();
  ctx.font = AXIS_FONT;
  const maxTextWidth = labels.reduce((maxWidth, label) => {
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      return maxWidth;
    }
    return Math.max(maxWidth, ctx.measureText(trimmedLabel).width);
  }, 0);
  ctx.restore();

  const paddedWidth = Math.ceil(maxTextWidth) + 18;
  const clampedWidth = Math.min(Math.max(paddedWidth, minimumWidth), maximumWidth);
  return Math.ceil(clampedWidth / 2) * 2;
}

export function measurePaneTitleWidth(
  ctx: CanvasRenderingContext2D,
  title: string,
  width: number,
): number {
  ctx.save();
  ctx.font = PANE_TITLE_FONT;
  const measured = Math.min(Math.max(Math.ceil(ctx.measureText(title).width) + 22, 64), Math.max(width - 12, 64));
  ctx.restore();
  return measured;
}

export function resolveHighContrastText(background: string): string {
  return isDarkColor(background) ? '#e6edf3' : '#111827';
}

export function resolveMutedChartText(background: string): string {
  return isDarkColor(background) ? '#a7b5c5' : '#4b5563';
}

function resolveTransparentColor(color: string, alpha: number): string {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return color;
  }
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${alpha})`;
}

function isDarkColor(color: string): boolean {
  const rgb = parseHexColor(color);
  if (!rgb) {
    return true;
  }
  const luminance = (0.2126 * rgb.red + 0.7152 * rgb.green + 0.0722 * rgb.blue) / 255;
  return luminance < 0.5;
}

function parseHexColor(color: string): { red: number; green: number; blue: number } | null {
  const normalized = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return null;
  }
  return {
    red: parseInt(normalized.slice(0, 2), 16),
    green: parseInt(normalized.slice(2, 4), 16),
    blue: parseInt(normalized.slice(4, 6), 16),
  };
}

export function formatPrice(
  price: number,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number,
): string {
  const [resolvedMinimum, resolvedMaximum] = resolveFractionDigits(price, minimumFractionDigits, maximumFractionDigits);
  return getFormatter(resolvedMinimum, resolvedMaximum).format(price);
}

export function getPrecisionFromStep(step: number): number {
  if (step >= 1) {
    return step % 1 === 0 ? 0 : (step.toString().split('.')[1] || '').length;
  }
  // For small steps like 0.05, 0.01, etc.
  return Math.max(0, -Math.floor(Math.log10(step) + 0.0001));
}

export function formatSignedValue(
  value: number,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number,
): string {
  const formatted = formatPrice(Math.abs(value), minimumFractionDigits, maximumFractionDigits);
  if (value > 0) {
    return `+${formatted}`;
  }
  if (value < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

function resolveFractionDigits(
  value: number,
  minimumFractionDigits?: number,
  maximumFractionDigits?: number,
): [number, number] {
  if (typeof minimumFractionDigits === 'number' || typeof maximumFractionDigits === 'number') {
    const min = minimumFractionDigits ?? maximumFractionDigits ?? 2;
    const max = maximumFractionDigits ?? minimumFractionDigits ?? min;
    return [min, Math.max(min, max)];
  }

  const absValue = Math.abs(value);
  if (absValue >= 10000) {
    return [0, 0];
  }
  if (absValue >= 1000) {
    return [1, 1];
  }
  if (absValue >= 1) {
    return [2, 2];
  }
  if (absValue >= 0.1) {
    return [3, 3];
  }
  return [4, 4];
}

function getFormatter(minimumFractionDigits: number, maximumFractionDigits: number): Intl.NumberFormat {
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  const cached = FORMATTER_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const formatter = new Intl.NumberFormat('en-IN', {
    useGrouping: true,
    minimumFractionDigits,
    maximumFractionDigits,
  });
  FORMATTER_CACHE.set(key, formatter);
  return formatter;
}

export function drawMeasure(
  ctx: CanvasRenderingContext2D,
  drawing: AnchoredDrawingBase & { kind: 'measure' },
  scaleX: ScaleX,
  scaleY: ScaleY,
  selected = false,
): void {
  const startX = scaleX.toPixel(drawing.startIndex);
  const startY = scaleY.toPixel(drawing.startPrice);
  const endX = scaleX.toPixel(drawing.endIndex);
  const endY = scaleY.toPixel(drawing.endPrice);
  
  ctx.save();
  ctx.fillStyle = 'rgba(79, 167, 255, 0.15)';
  ctx.fillRect(startX, startY, endX - startX, endY - startY);
  
  ctx.strokeStyle = drawing.color || '#4fa7ff';
  ctx.lineWidth = drawing.lineWidth ?? 1.5;
  if (selected) {
    ctx.shadowColor = 'rgba(79, 167, 255, 0.45)';
    ctx.shadowBlur = 7;
  }
  ctx.beginPath();
  ctx.rect(startX, startY, endX - startX, endY - startY);
  ctx.stroke();
  
  if (isDrawingLabelVisible(drawing)) {
    const textX = startX + (endX - startX) / 2;
    const textY = endY + (endY > startY ? 20 : -20);
    const priceDiff = drawing.endPrice - drawing.startPrice;
    const pricePct = Math.abs(drawing.startPrice) < 1e-9 ? null : (priceDiff / drawing.startPrice) * 100;
    const barsDiff = drawing.endIndex - drawing.startIndex;
    const percentText = pricePct == null ? 'n/a' : `${pricePct > 0 ? '+' : ''}${pricePct.toFixed(2)}%`;
    const text = `${priceDiff > 0 ? '+' : ''}${priceDiff.toFixed(2)} (${percentText}) • ${barsDiff > 0 ? '+' : ''}${barsDiff} bars`;

    ctx.font = '12px "Segoe UI", sans-serif';
    const metrics = ctx.measureText(text);
    const pad = 6;

    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(26, 25, 24, 0.85)';
    ctx.beginPath();
    ctx.roundRect(textX - metrics.width / 2 - pad, textY - 10 - pad, metrics.width + pad * 2, 20 + pad * 2, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    ctx.fillStyle = drawing.color || '#4fa7ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, textX, textY);
  }
  
  ctx.restore();
}

export function drawSignalMarkers(
  ctx: CanvasRenderingContext2D,
  markers: import('./types').RenderableSignalMarker[],
  indexToPixel: (barIndex: number) => number,
  priceToPixel: (price: number) => number,
): void {
  if (!markers.length) return;

  ctx.save();
  for (const marker of markers) {
    const x = indexToPixel(marker.barIndex);
    const y = priceToPixel(marker.price);
    const size = 12;

    ctx.fillStyle = marker.color;
    ctx.strokeStyle = marker.color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    if (marker.shape === 'arrow_up') {
      const topY = y + (marker.position === 'below_bar' ? 12 : -12);
      ctx.moveTo(x, topY - size);
      ctx.lineTo(x - size / 2, topY);
      ctx.lineTo(x + size / 2, topY);
      ctx.closePath();
      ctx.fill();
    } else if (marker.shape === 'arrow_down') {
      const topY = y + (marker.position === 'above_bar' ? -12 : 12);
      ctx.moveTo(x, topY + size);
      ctx.lineTo(x - size / 2, topY);
      ctx.lineTo(x + size / 2, topY);
      ctx.closePath();
      ctx.fill();
    } else if (marker.shape === 'circle') {
      ctx.arc(x, y, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (marker.shape === 'square') {
      ctx.fillRect(x - size / 2, y - size / 2, size, size);
    } else if (marker.shape === 'cross') {
      ctx.moveTo(x - size / 2, y);
      ctx.lineTo(x + size / 2, y);
      ctx.moveTo(x, y - size / 2);
      ctx.lineTo(x, y + size / 2);
      ctx.stroke();
    }

    if (marker.text) {
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = marker.position === 'above_bar' ? 'bottom' : 'top';
      const textY = marker.position === 'above_bar' ? y - size - 4 : y + size + 4;
      ctx.fillText(marker.text, x, textY);
    }
  }
  ctx.restore();
}
