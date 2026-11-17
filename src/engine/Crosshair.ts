import { formatCrosshairLogicalDate } from './ScaleManager';
import { formatPrice, resolveAxisTagText, resolveHighContrastText } from './Renderer';
import type { ChartTheme, ChartTimeframe, CrosshairState, OHLCBar, ScaleX, Viewport } from './types';

export function computeCrosshair(
  mouseX: number,
  mouseY: number,
  bars: OHLCBar[],
  scaleX: ScaleX,
  viewport: Viewport,
  chartAreaWidth: number,
  chartAreaHeight: number,
  options?: {
    paneId?: CrosshairState['paneId'];
    paneTop?: number;
    paneHeight?: number;
    value?: number;
    timeframe?: ChartTimeframe;
    snapToPrice?: boolean;
    scaleY?: { toPixel: (price: number) => number; toPrice: (pixel: number) => number };
  },
): CrosshairState {
  void viewport;
  if (mouseX < 0 || mouseY < 0 || mouseX > chartAreaWidth || mouseY > chartAreaHeight || bars.length === 0) {
    return { visible: false, x: 0, y: 0, barIndex: -1, logicalIndex: -1, dateLabel: null, paneId: 'price', paneTop: 0, paneHeight: 0, value: 0, bar: null };
  }

  const logicalIndex = scaleX.toIndex(mouseX);
  const roundedLogicalIndex = Math.round(logicalIndex);
  const isFutureSlot = roundedLogicalIndex > bars.length - 1;
  const isBeforeStart = roundedLogicalIndex < 0;
  const barIndex = isFutureSlot || isBeforeStart ? -1 : hitTestBar(logicalIndex, bars);
  const dateLabel = formatCrosshairLogicalDate(bars, roundedLogicalIndex, options?.timeframe ?? 'D');
  const bar = barIndex >= 0 ? bars[barIndex] ?? null : null;

  let finalY = mouseY;
  let finalValue = options?.value ?? 0;

  if (options?.snapToPrice && bar && options.scaleY && options.paneId === 'price') {
    const prices = [bar.open, bar.high, bar.low, bar.close];
    let minDistance = Infinity;
    let snappedPrice = finalValue;

    prices.forEach((p) => {
      const dist = Math.abs(options.scaleY!.toPixel(p) - mouseY);
      if (dist < minDistance) {
        minDistance = dist;
        snappedPrice = p;
      }
    });

    // Only snap if we are reasonably close (e.g. within 40 pixels)
    if (minDistance < 40) {
      finalY = options.scaleY.toPixel(snappedPrice);
      finalValue = snappedPrice;
    }
  }

  return {
    visible: true,
    x: scaleX.toPixel(roundedLogicalIndex),
    y: finalY,
    barIndex,
    logicalIndex,
    dateLabel,
    paneId: options?.paneId ?? 'price',
    paneTop: options?.paneTop ?? 0,
    paneHeight: options?.paneHeight ?? chartAreaHeight,
    value: finalValue,
    bar,
  };
}

export function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  state: CrosshairState,
  width: number,
  height: number,
  theme: ChartTheme,
  axisWidth: number,
  xAxisHeight: number,
  reservedTop = 0,
  occupiedRanges: Array<{ top: number; bottom: number }> = [],
  leftAxisWidth = 0,
): void {
  if (!state.visible) {
    return;
  }

  const chartWidth = Math.max(width - axisWidth, 0);
  const chartHeight = Math.max(height - xAxisHeight, 0);
  const protectedTop = Math.min(Math.max(reservedTop, 0), chartHeight);
  const x = Math.min(Math.max(state.x, 0), chartWidth);
  const y = Math.min(Math.max(state.y, protectedTop), chartHeight);

  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.globalAlpha = 0.82;
  ctx.strokeStyle = theme.crosshair;
  ctx.beginPath();
  ctx.moveTo(x, protectedTop);
  ctx.lineTo(x, chartHeight);
  ctx.moveTo(0, y);
  ctx.lineTo(chartWidth, y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  ctx.fillStyle = theme.crosshair;
  ctx.beginPath();
  ctx.arc(x, y, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = resolveAxisTagText(theme.crosshair, theme.background);
  ctx.beginPath();
  ctx.arc(x, y, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const price = state.value;
  let priceLabelTop = Math.min(Math.max(y - 10, 2), Math.max(chartHeight - 20, 2));
  
  // Resolve collision with occupied ranges
  const labelHeight = 20;
  for (const range of occupiedRanges) {
    if (!(priceLabelTop + labelHeight < range.top || priceLabelTop > range.bottom)) {
      // Collides. Try to push it up or down.
      // Push up if we're mostly above the center of the range
      const center = (range.top + range.bottom) / 2;
      if (priceLabelTop + labelHeight / 2 <= center) {
        priceLabelTop = Math.max(2, range.top - labelHeight - 2);
      } else {
        priceLabelTop = Math.min(chartHeight - labelHeight - 2, range.bottom + 2);
      }
    }
  }

  const priceLabelBackground = theme.axisLabelBackground;
  const priceLabelText = resolveAxisTagText(priceLabelBackground, theme.axisBackground);
  ctx.fillStyle = priceLabelBackground;
  ctx.fillRect(width - axisWidth, priceLabelTop, axisWidth, 20);
  ctx.fillStyle = priceLabelText;
  ctx.font = '600 11px "Segoe UI", sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatPrice(price), width - 6, priceLabelTop + 10);

  if (leftAxisWidth > 0) {
    ctx.fillStyle = priceLabelBackground;
    ctx.fillRect(-leftAxisWidth, priceLabelTop, leftAxisWidth, 20);
    ctx.fillStyle = priceLabelText;
    ctx.textAlign = 'left';
    ctx.fillText(formatPrice(price), -leftAxisWidth + 6, priceLabelTop + 10);
  }

  if (state.dateLabel) {
    ctx.font = '600 11px "Segoe UI", sans-serif';
    const labelWidth = Math.max(96, Math.ceil(ctx.measureText(state.dateLabel).width) + 20);
    const labelHeight = Math.max(20, Math.min(xAxisHeight - 6, 24));
    const labelLeft = Math.min(Math.max(x - labelWidth / 2, 0), Math.max(chartWidth - labelWidth, 0));
    const labelTop = chartHeight + Math.max((xAxisHeight - labelHeight) / 2, 0);
    ctx.fillStyle = theme.axisBackground;
    ctx.fillRect(labelLeft, labelTop, labelWidth, labelHeight);
    ctx.strokeStyle = theme.crosshair;
    ctx.strokeRect(labelLeft, labelTop, labelWidth, labelHeight);
    ctx.fillStyle = resolveHighContrastText(theme.axisBackground);
    ctx.textAlign = 'center';
    ctx.fillText(state.dateLabel, labelLeft + labelWidth / 2, labelTop + labelHeight / 2);
  }
}

export function hitTestBar(logicalIndex: number, bars: OHLCBar[]): number {
  const index = Math.round(logicalIndex);
  return Math.max(0, Math.min(index, bars.length - 1));
}

export function formatVolume(volume: number): string {
  if (volume >= 10000000) return `${(volume / 10000000).toFixed(2)} Cr`;
  if (volume >= 100000) return `${(volume / 100000).toFixed(2)} L`;
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
  return `${volume}`;
}
