import { TREND_FIB_EXTENSION_LEVELS } from './DrawingD3BGeometry';
import {
  getFibonacciLevelSlotId,
  getLegacyFibonacciLevelSlotId,
  resolveFibonacciLevels,
  resolveFibonacciOptions,
  type RuntimeFibonacciLevel,
} from './DrawingF1BRuntime';
import { resolveDrawingLinePresentationForSlot } from './DrawingStyleSchema';
import type { ChartDrawing, Viewport } from './types';

const FIB_RETRACEMENT_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;

function isRenderableLevel(drawing: ChartDrawing, level: RuntimeFibonacciLevel): boolean {
  const stableSlot = getFibonacciLevelSlotId(level);
  const legacySlot = getLegacyFibonacciLevelSlotId(level);
  const savedLines = drawing.presentation?.lines;
  const presentation = savedLines?.[stableSlot]
    ? resolveDrawingLinePresentationForSlot(drawing, stableSlot)
    : resolveDrawingLinePresentationForSlot(drawing, legacySlot);
  return presentation.visible && presentation.opacity > 0;
}

function retracementProjectionIntersectsViewport(
  drawing: Extract<ChartDrawing, { kind: 'fib' }>,
  viewport: Viewport,
): boolean {
  const projectsRight = drawing.endIndex >= drawing.startIndex;
  return projectsRight
    ? viewport.endIndex >= drawing.endIndex
    : viewport.startIndex <= drawing.endIndex;
}

function trendExtensionIntersectsViewport(
  drawing: Extract<ChartDrawing, { kind: 'trendFibExtension' }>,
  viewport: Viewport,
): boolean {
  if (drawing.anchors.length < 3) return false;
  const [a, b, c] = drawing.anchors;
  const finiteSpan = Math.max(Math.abs(b.barIndex - a.barIndex), 1);
  const left = drawing.extendLeft === true ? Number.NEGATIVE_INFINITY : c.barIndex;
  const right = drawing.extendRight === true ? Number.POSITIVE_INFINITY : c.barIndex + finiteSpan;
  return viewport.endIndex >= left && viewport.startIndex <= right;
}

/**
 * Returns price-domain drawing values that should participate in price-pane
 * Auto Scale. The caller remains responsible for timeframe/pane visibility and
 * for disabling this contribution while a manual price-scale override is active.
 */
export function collectF1BAutoscalePrices(drawing: ChartDrawing, viewport: Viewport): number[] {
  if (drawing.kind === 'fib') {
    if (!retracementProjectionIntersectsViewport(drawing, viewport)) return [];
    const levels = resolveFibonacciLevels(drawing, FIB_RETRACEMENT_LEVELS);
    const options = resolveFibonacciOptions(drawing);
    return levels.flatMap((level) => {
      if (!level.enabled || !isRenderableLevel(drawing, level)) return [];
      const ratio = options.reverse ? 1 - level.value : level.value;
      const price = drawing.startPrice + (drawing.endPrice - drawing.startPrice) * ratio;
      return Number.isFinite(price) ? [price] : [];
    });
  }

  if (drawing.kind === 'trendFibExtension') {
    if (drawing.anchors.length < 3 || !trendExtensionIntersectsViewport(drawing, viewport)) return [];
    const levels = resolveFibonacciLevels(drawing, TREND_FIB_EXTENSION_LEVELS);
    const options = resolveFibonacciOptions(drawing);
    const [a, b, c] = drawing.anchors;
    return levels.flatMap((level) => {
      if (!level.enabled || !isRenderableLevel(drawing, level)) return [];
      const direction = options.reverse ? -1 : 1;
      const price = c.price + (b.price - a.price) * level.value * direction;
      return Number.isFinite(price) ? [price] : [];
    });
  }

  return [];
}
