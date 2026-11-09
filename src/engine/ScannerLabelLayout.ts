import type { ChartDrawing, ScaleX, ScaleY } from './types';
import { getTextBoxBounds, getTextDrawingFont, wrapTextLines, type TextBoxBounds } from './Renderer';

export function isTransientScannerText(drawing: ChartDrawing): drawing is Extract<ChartDrawing, { kind: 'text' }> {
  return drawing.kind === 'text' && (drawing.id.startsWith('scanner-overlay:') || drawing.id.startsWith('scanner-map-marker:'));
}

const MARGIN = 3;
const GAP = 3;
const overlaps = (a: TextBoxBounds, b: TextBoxBounds) =>
  a.left < b.left + b.width + GAP && a.left + a.width + GAP > b.left &&
  a.top < b.top + b.height + GAP && a.top + a.height + GAP > b.top;

/** Screen-space layout for transient scanner text only. Source anchors never move. */
export function layoutScannerLabelBoxes(
  ctx: CanvasRenderingContext2D, drawings: ChartDrawing[], x: ScaleX, y: ScaleY,
  plotWidth: number, plotHeight: number,
): Map<string, TextBoxBounds | null> {
  const result = new Map<string, TextBoxBounds | null>();
  const occupied = drawings.filter((drawing) => drawing.kind === 'text' && !isTransientScannerText(drawing))
    .map((drawing) => getTextBoxBounds(drawing as Extract<ChartDrawing, { kind: 'text' }>, x, y));
  ctx.save();
  try {
    for (const drawing of drawings) {
      if (!isTransientScannerText(drawing)) continue;
      const anchorX = x.toPixel(drawing.barIndex);
      const anchorY = y.toPixel(drawing.price);
      result.set(drawing.id, null);
      if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY) ||
        anchorX < 0 || anchorX > plotWidth || anchorY < 0 || anchorY > plotHeight || plotWidth <= 2 * MARGIN) continue;
      ctx.font = getTextDrawingFont(drawing);
      const width = Math.min(Math.ceil(ctx.measureText(drawing.text).width) + 8, plotWidth - 2 * MARGIN);
      const fontSize = Math.max(10, Math.min(drawing.fontSize ?? 13, 28));
      const lineHeight = Math.max(fontSize + 3, Math.round(fontSize * 1.25));
      const lines = wrapTextLines(ctx, drawing.text, Math.max(20, width - 8));
      if (lines.some((line) => ctx.measureText(line).width > width - 8)) continue;
      const height = Math.max(fontSize + 8, lines.length * lineHeight + 6);
      if (height > plotHeight - 2 * MARGIN) continue;
      const clampX = (value: number) => Math.min(Math.max(MARGIN, value), plotWidth - MARGIN - width);
      const clampY = (value: number) => Math.min(Math.max(MARGIN, value), plotHeight - MARGIN - height);
      const lefts = [...new Set([clampX(anchorX + 2), clampX(anchorX - width - 2)])];
      const initialTop = anchorY - 4 - height;
      let placed: TextBoxBounds | null = null;
      for (let step = 0; step <= Math.ceil(plotHeight / (height + GAP)) && !placed; step++) {
        const tops = step === 0 ? [clampY(initialTop)]
          : [clampY(initialTop - step * (height + GAP)), clampY(initialTop + step * (height + GAP))];
        for (const top of tops) {
          for (const left of lefts) {
            const candidate = { left, top, width, height };
            if (!occupied.some((box) => overlaps(candidate, box))) {
              placed = candidate;
              break;
            }
          }
          if (placed) break;
        }
      }
      // Omit a label if the plot cannot fit it; never paint clipped/colliding text.
      if (placed) {
        occupied.push(placed);
        result.set(drawing.id, placed);
      }
    }
  } finally {
    ctx.restore();
  }
  return result;
}
