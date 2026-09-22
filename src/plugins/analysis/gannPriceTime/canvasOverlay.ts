/**
 * Gann Price-Time Analysis Plugin — Canvas 2D Overlay Renderer
 *
 * Accepts a pre-computed GannSetup and renders it on top of the active chart
 * canvas via the platform's coordinate projection functions.
 *
 * Rules:
 * - Every render path is wrapped in ctx.save() / ctx.restore()
 * - No pixel constants are hard-coded for prices or dates
 * - All layout measurements use barIndex / price space via the mapper
 */

import type {
  GannAngleRay,
  GannCoordinateMapper,
  GannCycleSignal,
  GannPluginOptions,
  GannSetup,
  SquareOfNineLevel,
} from './types';

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------

const FONT_FAMILY = 'monospace';
const LABEL_FONT = `10px ${FONT_FAMILY}`;
const BADGE_FONT = `bold 9px ${FONT_FAMILY}`;

const CYCLE_COLORS: Record<GannCycleSignal['breakoutStatus'], string> = {
  bullish: 'rgba(34,197,94,0.18)',   // green tint
  bearish: 'rgba(239,68,68,0.18)',   // red tint
  unconfirmed: 'rgba(148,163,184,0.12)', // slate
  pending: 'rgba(251,191,36,0.12)',  // amber
};

const CYCLE_STROKE_COLORS: Record<GannCycleSignal['breakoutStatus'], string> = {
  bullish: '#22c55e',
  bearish: '#ef4444',
  unconfirmed: '#94a3b8',
  pending: '#fbbf24',
};

// Square of Nine levels are rendered in a muted gold palette
const SON_LINE_COLOR = 'rgba(251,191,36,0.55)';
const SON_TEXT_COLOR = '#fbbf24';

const CYCLE_DASH: number[] = [6, 3];
const SON_DASH: number[] = [4, 4];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clips a value to the canvas dimensions to avoid drawing outside the viewport.
 * Using Infinity / NaN coordinates produces invisible strokes, but this is a
 * defensive guard.
 */
function clampX(x: number, canvasWidth: number): number {
  return Math.max(0, Math.min(x, canvasWidth));
}

/**
 * Draw a text label with a semi-transparent background pill for legibility.
 */
function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  textColor: string,
  bgColor = 'rgba(15,15,20,0.7)',
): void {
  ctx.save();
  ctx.font = LABEL_FONT;
  const measured = ctx.measureText(text);
  const pad = 3;
  const w = measured.width + pad * 2;
  const h = 13;
  ctx.fillStyle = bgColor;
  ctx.fillRect(x - pad, y - 10, w, h);
  ctx.fillStyle = textColor;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Sub-renderers
// ---------------------------------------------------------------------------

/**
 * Renders all Gann angle rays (2×1, 1×1, 1×2) from the pivot anchor.
 */
function renderAngleRays(
  ctx: CanvasRenderingContext2D,
  rays: GannAngleRay[],
  mapper: GannCoordinateMapper,
  canvasWidth: number,
): void {
  ctx.save();
  ctx.lineWidth = 1.2;

  for (const ray of rays) {
    const x1 = mapper.timeToX(ray.fromBarIndex);
    const y1 = mapper.priceToY(ray.fromPrice);
    const x2 = clampX(mapper.timeToX(ray.toBarIndex), canvasWidth);
    const y2 = mapper.priceToY(ray.toPrice);

    ctx.beginPath();
    ctx.setLineDash([]);
    ctx.strokeStyle = ray.color;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Slope badge at the end of the ray
    ctx.save();
    ctx.font = BADGE_FONT;
    ctx.fillStyle = ray.color;
    const badgeX = Math.max(x1 + 4, x2 - 24);
    const badgeY = y2 - 4;
    ctx.fillText(ray.label, badgeX, badgeY);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * Renders Square of Nine horizontal price levels as dashed lines.
 */
function renderSquareOfNineLevels(
  ctx: CanvasRenderingContext2D,
  levels: SquareOfNineLevel[],
  mapper: GannCoordinateMapper,
  anchorBarIndex: number,
  canvasWidth: number,
): void {
  ctx.save();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = SON_LINE_COLOR;
  ctx.setLineDash(SON_DASH);

  const startX = mapper.timeToX(anchorBarIndex);

  for (const level of levels) {
    const y = mapper.priceToY(level.price);

    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(canvasWidth, y);
    ctx.stroke();

    drawLabel(ctx, level.label, canvasWidth - 30, y - 2, SON_TEXT_COLOR);
  }

  ctx.restore();
}

/**
 * Renders vertical dashed cycle boundary lines and the breakout highlight box
 * on the cycle candle.
 */
function renderCycleSignals(
  ctx: CanvasRenderingContext2D,
  signals: GannCycleSignal[],
  mapper: GannCoordinateMapper,
  canvasHeight: number,
): void {
  ctx.save();

  for (const signal of signals) {
    if (signal.cycleBarIndex < 0) continue;

    const x = mapper.timeToX(signal.cycleBarIndex);

    // Vertical dashed marker
    ctx.beginPath();
    ctx.setLineDash(CYCLE_DASH);
    ctx.lineWidth = 1;
    ctx.strokeStyle = CYCLE_STROKE_COLORS[signal.breakoutStatus];
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvasHeight);
    ctx.stroke();

    // Interval label at top
    drawLabel(
      ctx,
      `C${signal.interval}`,
      x + 2,
      14,
      CYCLE_STROKE_COLORS[signal.breakoutStatus],
    );

    // Breakout highlight box on the cycle candle (only if candle is confirmed)
    if (signal.cycleHigh > 0 && signal.cycleLow > 0) {
      const yTop = mapper.priceToY(signal.cycleHigh);
      const yBot = mapper.priceToY(signal.cycleLow);
      const boxW = Math.max(8, Math.abs(mapper.timeToX(signal.cycleBarIndex + 1) - x));
      const boxH = Math.abs(yBot - yTop);

      ctx.save();
      ctx.setLineDash([]);
      ctx.fillStyle = CYCLE_COLORS[signal.breakoutStatus];
      ctx.fillRect(x - boxW / 2, Math.min(yTop, yBot), boxW, boxH);
      ctx.lineWidth = 1;
      ctx.strokeStyle = CYCLE_STROKE_COLORS[signal.breakoutStatus];
      ctx.strokeRect(x - boxW / 2, Math.min(yTop, yBot), boxW, boxH);
      ctx.restore();
    }
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Renders the full Gann Price-Time overlay onto `ctx`.
 *
 * The caller must supply:
 * - `ctx`    — the active CanvasRenderingContext2D (from the chart engine canvas)
 * - `setup`  — result of `computeGannSetup()`
 * - `mapper` — platform's `{ timeToX, priceToY }` projection pair
 * - `options`— which overlay layers to show
 * - `canvasWidth` / `canvasHeight` — physical pixel dimensions of the chart canvas
 *
 * Context state is always restored on exit, even if an error occurs,
 * preventing canvas context contamination.
 */
export function renderGannOverlay(
  ctx: CanvasRenderingContext2D,
  setup: GannSetup,
  mapper: GannCoordinateMapper,
  options: GannPluginOptions,
  canvasWidth: number,
  canvasHeight: number,
): void {
  ctx.save();

  try {
    if (options.showCycles) {
      renderCycleSignals(ctx, setup.cycleSignals, mapper, canvasHeight);
    }

    if (options.showSquareOfNine) {
      renderSquareOfNineLevels(
        ctx,
        setup.squareOfNineLevels,
        mapper,
        setup.pivot.barIndex,
        canvasWidth,
      );
    }

    if (options.showAngles) {
      renderAngleRays(ctx, setup.angleRays, mapper, canvasWidth);
    }
  } finally {
    ctx.restore();
  }
}
