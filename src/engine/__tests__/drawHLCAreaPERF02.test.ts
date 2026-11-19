import { describe, expect, it, vi } from 'vitest';
import { drawHLCArea, drawLine } from '../Renderer';
import { DARK_THEME, type OHLCBar, type ScaleX, type ScaleY, type Viewport } from '../types';

type RecordedCanvasOp =
  | ['set', string, unknown]
  | ['call', string, unknown[]];

function createRecordingContext(): { ctx: CanvasRenderingContext2D; ops: RecordedCanvasOp[] } {
  const ops: RecordedCanvasOp[] = [];
  let fillStyle: unknown = '#000000';
  let strokeStyle: unknown = '#000000';
  let lineWidth = 1;
  let globalAlpha = 1;

  const ctx = {
    canvas: { width: 1200, height: 700 },
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: unknown) {
      fillStyle = value;
      ops.push(['set', 'fillStyle', value]);
    },
    get strokeStyle() {
      return strokeStyle;
    },
    set strokeStyle(value: unknown) {
      strokeStyle = value;
      ops.push(['set', 'strokeStyle', value]);
    },
    get lineWidth() {
      return lineWidth;
    },
    set lineWidth(value: number) {
      lineWidth = value;
      ops.push(['set', 'lineWidth', value]);
    },
    get globalAlpha() {
      return globalAlpha;
    },
    set globalAlpha(value: number) {
      globalAlpha = value;
      ops.push(['set', 'globalAlpha', value]);
    },
    save: () => ops.push(['call', 'save', []]),
    restore: () => ops.push(['call', 'restore', []]),
    beginPath: () => ops.push(['call', 'beginPath', []]),
    closePath: () => ops.push(['call', 'closePath', []]),
    moveTo: (x: number, y: number) => ops.push(['call', 'moveTo', [x, y]]),
    lineTo: (x: number, y: number) => ops.push(['call', 'lineTo', [x, y]]),
    fill: () => ops.push(['call', 'fill', []]),
    stroke: () => ops.push(['call', 'stroke', []]),
    setLineDash: (segments: number[]) => ops.push(['call', 'setLineDash', [[...segments]]]),
  } as unknown as CanvasRenderingContext2D;

  return { ctx, ops };
}

function legacyDrawHLCArea(
  ctx: CanvasRenderingContext2D,
  bars: OHLCBar[],
  viewport: Viewport,
  scaleX: ScaleX,
  scaleY: ScaleY,
): void {
  const start = Math.max(Math.floor(viewport.startIndex), 0);
  const end = Math.min(Math.ceil(viewport.endIndex), bars.length - 1);

  if (start > end || bars.length === 0) return;

  ctx.fillStyle = 'rgba(79, 167, 255, 0.08)';
  ctx.beginPath();

  for (let i = start; i <= end; i++) {
    const x = scaleX.toPixel(i);
    const y = scaleY.toPixel(bars[i].high);
    i === start ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }

  for (let i = end; i >= start; i--) {
    ctx.lineTo(scaleX.toPixel(i), scaleY.toPixel(bars[i].low));
  }

  ctx.closePath();
  ctx.fill();

  drawLine(ctx, bars.map((b) => b.high), viewport, scaleX, scaleY, 'rgba(79, 167, 255, 0.3)', 1);
  drawLine(ctx, bars.map((b) => b.low), viewport, scaleX, scaleY, 'rgba(79, 167, 255, 0.3)', 1);
  drawLine(ctx, bars.map((b) => b.close), viewport, scaleX, scaleY, '#5dafff', 1.8);
}

function buildSampleBars(count: number): OHLCBar[] {
  return Array.from({ length: count }, (_, index) => {
    const base = 100 + Math.sin(index * 0.13) * 18 + index * 0.08;
    const open = Number(base.toFixed(2));
    const close = Number((base + ((index % 7) - 3) * 1.15).toFixed(2));
    const high = Number((Math.max(open, close) + 2.75).toFixed(2));
    const low = Number((Math.min(open, close) - 2.45).toFixed(2));
    const day = (index % 28) + 1;
    const month = (Math.floor(index / 28) % 12) + 1;
    const year = 2005 + Math.floor(index / (28 * 12));
    return {
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      timestamp: Date.UTC(year, month - 1, day),
      open,
      high,
      low,
      close,
      volume: 10000 + index * 10,
      prevClose: base,
    };
  });
}

function makeScales(viewport: Viewport): { scaleX: ScaleX; scaleY: ScaleY } {
  const scaleX: ScaleX = {
    barWidth: 8.5,
    barGap: 1.5,
    bodyWidth: 7,
    toPixel: (index: number) => (index - viewport.startIndex) * 8.5 + 12,
    toIndex: (px: number) => (px - 12) / 8.5 + viewport.startIndex,
  };
  const scaleY: ScaleY = {
    min: 50,
    max: 600,
    toPixel: (price: number) => 560 - (price - 50) * 1.25,
    toPrice: (px: number) => (560 - px) / 1.25 + 50,
  };
  return { scaleX, scaleY };
}

function expectParityWithLegacy(bars: OHLCBar[], viewport: Viewport): RecordedCanvasOp[] {
  const { scaleX, scaleY } = makeScales(viewport);
  const legacy = createRecordingContext();
  legacyDrawHLCArea(legacy.ctx, bars, viewport, scaleX, scaleY);

  const current = createRecordingContext();
  drawHLCArea(current.ctx, bars, viewport, scaleX, scaleY, DARK_THEME);

  expect(current.ops).toEqual(legacy.ops);
  return current.ops;
}

describe('PERF-02 drawHLCArea visible-range rendering', () => {
  it('matches legacy canvas operations across long histories', () => {
    const bars = buildSampleBars(5000);

    const interiorOps = expectParityWithLegacy(bars, { startIndex: 1200, endIndex: 1350 });
    expect(interiorOps.length).toBeGreaterThan(0);

    const tailOps = expectParityWithLegacy(bars, { startIndex: 4850, endIndex: 4999 });
    expect(tailOps.length).toBeGreaterThan(0);
  });

  it('matches legacy canvas operations for narrow and fractional viewports', () => {
    const bars = buildSampleBars(300);

    expectParityWithLegacy(bars, { startIndex: 245.2, endIndex: 252.7 });
    expectParityWithLegacy(bars, { startIndex: 100.1, endIndex: 100.9 });
    expectParityWithLegacy(bars, { startIndex: 88, endIndex: 88 });
    expectParityWithLegacy(bars, { startIndex: 55.2, endIndex: 54.1 });

    const invertedEmptyOps = expectParityWithLegacy(bars, { startIndex: 55.2, endIndex: 54.0 });
    expect(invertedEmptyOps).toEqual([]);
  });

  it('matches legacy canvas operations for empty data and boundary bars', () => {
    expect(expectParityWithLegacy([], { startIndex: 0, endIndex: 50 })).toEqual([]);

    const bars = buildSampleBars(120);
    expectParityWithLegacy(bars, { startIndex: -10, endIndex: 0 });
    expectParityWithLegacy(bars, { startIndex: bars.length - 1, endIndex: bars.length + 15 });
    expectParityWithLegacy(bars, { startIndex: -25.4, endIndex: bars.length + 40.8 });

    expect(expectParityWithLegacy(bars, { startIndex: -30, endIndex: -5 })).toEqual([]);
    expect(expectParityWithLegacy(bars, { startIndex: bars.length + 3, endIndex: bars.length + 20 })).toEqual([]);
  });

  it('preserves segment splits when visible close values contain null gaps', () => {
    const bars = buildSampleBars(40).map((bar, index) => {
      if (index === 10 || index === 14 || index === 15 || index === 20) {
        return { ...bar, close: null as unknown as number };
      }
      return bar;
    });

    const splitOps = expectParityWithLegacy(bars, { startIndex: 10, endIndex: 20 });
    expect(splitOps.length).toBeGreaterThan(0);

    expectParityWithLegacy(bars, { startIndex: 14, endIndex: 15 });
  });

  it('does not project full history via bars.map and only reads visible indices', () => {
    const totalBars = 10_000;
    const visibleStart = 9900;
    const visibleEnd = 9999;
    const viewport: Viewport = { startIndex: 9900.4, endIndex: 9999.2 };
    const cleanBars = buildSampleBars(totalBars);

    let offViewportReads = 0;
    const visibleReads = { high: 0, low: 0, close: 0 };

    const guardedBars: OHLCBar[] = cleanBars.map((bar, index) => {
      if (index < visibleStart || index > visibleEnd) {
        return {
          date: bar.date,
          timestamp: bar.timestamp,
          open: bar.open,
          volume: bar.volume,
          get high(): number {
            offViewportReads += 1;
            throw new Error(`Unexpected off-viewport high read at index ${index}`);
          },
          get low(): number {
            offViewportReads += 1;
            throw new Error(`Unexpected off-viewport low read at index ${index}`);
          },
          get close(): number {
            offViewportReads += 1;
            throw new Error(`Unexpected off-viewport close read at index ${index}`);
          },
        };
      }

      return {
        date: bar.date,
        timestamp: bar.timestamp,
        open: bar.open,
        volume: bar.volume,
        get high(): number {
          visibleReads.high += 1;
          return bar.high;
        },
        get low(): number {
          visibleReads.low += 1;
          return bar.low;
        },
        get close(): number {
          visibleReads.close += 1;
          return bar.close;
        },
      };
    });

    const mapSpy = vi.fn(() => {
      throw new Error('bars.map() must not be called during drawHLCArea()');
    });
    Object.defineProperty(guardedBars, 'map', { value: mapSpy, configurable: true });

    const { scaleX, scaleY } = makeScales(viewport);
    const current = createRecordingContext();
    drawHLCArea(current.ctx, guardedBars, viewport, scaleX, scaleY, DARK_THEME);

    expect(mapSpy).not.toHaveBeenCalled();
    expect(offViewportReads).toBe(0);
    expect(visibleReads).toEqual({
      high: (visibleEnd - visibleStart + 1) * 2,
      low: (visibleEnd - visibleStart + 1) * 2,
      close: visibleEnd - visibleStart + 1,
    });

    const legacy = createRecordingContext();
    legacyDrawHLCArea(legacy.ctx, cleanBars, viewport, scaleX, scaleY);
    expect(current.ops).toEqual(legacy.ops);
  });
});
