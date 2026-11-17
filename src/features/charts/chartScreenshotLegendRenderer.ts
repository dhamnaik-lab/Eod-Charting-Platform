import type { ChartLayout } from '@/engine/ChartEngine';
import type { ChartLegendSegment, ChartPriceLegendSnapshot } from '@/components/ChartPriceLegendOverlay';

interface ScreenshotLegendOptions {
  layout: ChartLayout;
  cssWidth: number;
  snapshot: ChartPriceLegendSnapshot;
  secondaryLegendExpanded: boolean;
}

export function drawScreenshotPriceLegend(
  screenshot: HTMLCanvasElement,
  { layout, cssWidth, snapshot, secondaryLegendExpanded }: ScreenshotLegendOptions,
): void {
  if (!snapshot.title && !snapshot.segments.length && !snapshot.secondaryItems.length) {
    return;
  }

  const context = screenshot.getContext('2d');
  if (!context || cssWidth <= 0) {
    return;
  }

  const pixelRatio = screenshot.width / cssWidth;
  const left = layout.leftAxisWidth + 12;
  const maxX = Math.max(left, cssWidth - layout.axisWidth - 78);
  const hasSecondaryLegend = snapshot.secondaryItems.length > 0;
  let cursorX = left;

  context.save();
  context.scale(pixelRatio, pixelRatio);
  context.textBaseline = 'middle';

  if (hasSecondaryLegend) {
    drawLegendToggle(context, cursorX, secondaryLegendExpanded);
    cursorX += 24;
  }

  context.font = '700 14px "Segoe UI", sans-serif';
  cursorX = drawText(context, snapshot.title, cursorX, 19, maxX, 6, 'var(--legend-text)');
  snapshot.segments.forEach((segment) => {
    cursorX = drawSegment(context, segment, cursorX, 19, maxX, 6);
  });

  if (secondaryLegendExpanded) {
    context.font = '700 11px "Segoe UI", sans-serif';
    const firstRowY = 41;
    const rowHeight = 17;
    const legendBottom = Math.min(layout.priceHeight, screenshot.height / pixelRatio);
    const rowCapacity = Math.max(0, Math.floor((legendBottom - firstRowY - 8) / rowHeight) + 1);
    const needsOverflowRow = snapshot.hiddenItemCount > 0 || snapshot.secondaryItems.length > rowCapacity;
    const visibleItems = snapshot.secondaryItems.slice(0, Math.max(0, rowCapacity - Number(needsOverflowRow)));
    visibleItems.forEach((item, index) => {
      const y = firstRowY + index * rowHeight;

      const itemColor = item.hidden ? 'var(--legend-muted)' : item.color;
      context.fillStyle = resolveCanvasColor(itemColor, '#91aac2');
      context.beginPath();
      context.arc(left + 3, y, 3, 0, Math.PI * 2);
      context.fill();

      let itemX = drawText(context, item.label, left + 11, y, maxX, 5, itemColor);
      item.segments.forEach((segment) => {
        itemX = drawSegment(context, segment, itemX, y, maxX, 5);
      });
    });

    const hiddenItemCount = snapshot.hiddenItemCount + snapshot.secondaryItems.length - visibleItems.length;
    if (hiddenItemCount > 0 && rowCapacity > 0) {
      drawText(
        context,
        `+${hiddenItemCount} more`,
        left,
        firstRowY + visibleItems.length * rowHeight,
        maxX,
        0,
        'var(--legend-muted)',
      );
    }
  }

  context.restore();
}

function drawLegendToggle(
  context: CanvasRenderingContext2D,
  x: number,
  expanded: boolean,
): void {
  context.fillStyle = resolveCanvasColor('var(--legend-bg)', '#0d1520');
  context.strokeStyle = resolveCanvasColor('var(--border2)', '#334155');
  context.lineWidth = 1;
  drawRoundedRect(context, x, 10, 18, 18, 4);
  context.fill();
  context.stroke();

  context.strokeStyle = resolveCanvasColor('var(--legend-text)', '#e5edf5');
  context.lineWidth = 1.7;
  context.beginPath();
  if (expanded) {
    context.moveTo(x + 5, 16);
    context.lineTo(x + 9, 20);
    context.lineTo(x + 13, 16);
  } else {
    context.moveTo(x + 7, 14);
    context.lineTo(x + 11, 19);
    context.lineTo(x + 7, 24);
  }
  context.stroke();
}

function drawSegment(
  context: CanvasRenderingContext2D,
  segment: ChartLegendSegment,
  x: number,
  y: number,
  maxX: number,
  gap: number,
): number {
  return drawText(context, segment.text, x, y, maxX, gap, segment.color);
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxX: number,
  gap: number,
  color: string,
): number {
  if (!text || x >= maxX) {
    return x;
  }

  const width = context.measureText(text).width;
  if (x + width > maxX) {
    return maxX;
  }

  context.fillStyle = resolveCanvasColor(color, '#e5edf5');
  context.fillText(text, x, y);
  return x + width + gap;
}

function resolveCanvasColor(color: string, fallback: string): string {
  const variable = color.match(/^var\((--[^)]+)\)$/)?.[1];
  if (!variable || typeof window === 'undefined') {
    return variable ? fallback : color;
  }

  return window.getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}
