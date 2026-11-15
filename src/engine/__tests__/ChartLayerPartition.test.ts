import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartEngine } from '../ChartEngine';
import * as Indicators from '../Indicators';
import { DARK_THEME, DEFAULT_CHART_VISUAL_SETTINGS, type OHLCBar } from '../types';

function makeCtx(): CanvasRenderingContext2D {
  const noop = vi.fn();
  return {
    save: noop, restore: noop, scale: noop, setTransform: noop, clearRect: noop,
    fillRect: noop, strokeRect: noop, beginPath: noop, closePath: noop, moveTo: noop,
    lineTo: noop, arc: noop, ellipse: noop, rect: noop, roundRect: noop,
    quadraticCurveTo: noop, clip: noop, fill: noop, stroke: noop, fillText: noop,
    strokeText: noop, setLineDash: noop, translate: noop, drawImage: noop,
    createLinearGradient: vi.fn(() => ({ addColorStop: noop })),
    measureText: vi.fn((t: string) => ({ width: t.length * 7 })),
    canvas: { width: 1200, height: 700, clientWidth: 1200, clientHeight: 700 },
  } as unknown as CanvasRenderingContext2D;
}

class MockNode {
  style: Record<string, string> = {};
  width = 1200; height = 700; clientWidth = 1200; clientHeight = 700;
  handlers = new Map<string, Set<(e: unknown) => void>>();
  ctx = makeCtx();
  getBoundingClientRect() { return { left: 0, top: 0, right: 1200, bottom: 700, width: 1200, height: 700, x: 0, y: 0 }; }
  getContext() { return this.ctx; }
  append() {}
  remove() {}
  addEventListener(k: string, fn: (e: unknown) => void) {
    if (!this.handlers.has(k)) this.handlers.set(k, new Set());
    this.handlers.get(k)!.add(fn);
  }
  removeEventListener(k: string, fn: (e: unknown) => void) { this.handlers.get(k)?.delete(fn); }
  emit(k: string, ev: Record<string, unknown>) { this.handlers.get(k)?.forEach((fn) => fn(ev)); }
}

function sampleBars(n = 90): OHLCBar[] {
  return Array.from({ length: n }, (_, i) => ({
    date: '2025-01-' + String((i % 28) + 1).padStart(2, '0'),
    timestamp: Date.UTC(2025, 0, (i % 28) + 1),
    open: 100 + i, high: 105 + i, low: 98 + i, close: 102 + i, volume: 10000, prevClose: 99 + i,
  }));
}

describe('Phase 1A & 1B: Multi-Layer Canvas Partition & Unmount Cleanup', () => {
  const origWin = globalThis.window;
  const origDoc = globalThis.document;
  const origRO = globalThis.ResizeObserver;
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  let canvases: MockNode[] = [];

  beforeEach(() => {
    canvases = [];
    (globalThis as Record<string, unknown>).window = { devicePixelRatio: 2, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    (globalThis as Record<string, unknown>).document = {
      createElement: (tag: string) => { const n = new MockNode(); if (tag === 'canvas') canvases.push(n); return n; },
    };
    (globalThis as Record<string, unknown>).ResizeObserver = class { observe() {} disconnect() {} };
    (globalThis as Record<string, unknown>).requestAnimationFrame = () => 1;
    (globalThis as Record<string, unknown>).cancelAnimationFrame = () => {};
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>).window = origWin;
    (globalThis as Record<string, unknown>).document = origDoc;
    (globalThis as Record<string, unknown>).ResizeObserver = origRO;
    (globalThis as Record<string, unknown>).requestAnimationFrame = origRaf;
    (globalThis as Record<string, unknown>).cancelAnimationFrame = origCaf;
  });

  it('reuses cached RenderState on mousemove and zeroes canvas buffers on unmount', () => {
    const root = new MockNode() as unknown as HTMLDivElement;
    const engine = new ChartEngine(root, {
      theme: DARK_THEME,
      visualSettings: { ...DEFAULT_CHART_VISUAL_SETTINGS, crosshairVisible: true },
      timeframe: 'D',
      chartType: 'candles',
    });
    engine.mount();
    engine.loadBars(sampleBars(90));
    engine.flushRenderFrame();

    const startDiag = engine.getRenderDiagnostics();
    expect(startDiag.baseRenderCount).toBe(1);

    engine.setDrawingTool('crosshair');
    engine.flushRenderFrame();
    const overlay = canvases[1]!;

    for (let i = 0; i < 8; i += 1) {
      overlay.emit('mousemove', { clientX: 150 + i * 40, clientY: 200, offsetX: 150 + i * 40, offsetY: 200, shiftKey: false });
      engine.flushRenderFrame();
    }

    engine.setSyncedCrosshairBarIndex(40);
    engine.flushRenderFrame();
    engine.setSyncedCrosshairBarIndex(40);
    engine.flushRenderFrame();

    const endDiag = engine.getRenderDiagnostics();
    expect(endDiag.baseRenderCount).toBe(1);
    expect(endDiag.renderStateBuildCount).toBe(startDiag.renderStateBuildCount);
    expect(endDiag.overlayRenderCount).toBe(startDiag.overlayRenderCount + 1 + 8 + 1);

    engine.unmount();
    expect(canvases[0]!.width).toBe(0);
    expect(canvases[0]!.height).toBe(0);
    expect(canvases[1]!.width).toBe(0);
    expect(canvases[1]!.height).toBe(0);
  });

  it('reuses indicator bundles across viewport frames but invalidates changed data and settings', () => {
    const build = vi.spyOn(Indicators, 'buildRenderableIndicators');
    const engine = new ChartEngine(new MockNode() as unknown as HTMLDivElement, {
      theme: DARK_THEME, visualSettings: DEFAULT_CHART_VISUAL_SETTINGS, timeframe: 'D', chartType: 'candles',
    });
    engine.mount();
    const bars = sampleBars(90);
    const overlays = [{ id: 'sma', kind: 'SMA' as const, placement: 'overlay' as const, period: 10, source: 'close' as const, color: '#fff' }];
    engine.loadBars(bars); engine.setOverlays(overlays); engine.flushRenderFrame();
    build.mockClear();
    try {
      for (let i = 0; i < 10; i++) { engine.setViewport({ startIndex: i, endIndex: 60 + i }); engine.flushRenderFrame(); }
      console.info(JSON.stringify({ viewportFrames: 10, indicatorBundleBuilds: build.mock.calls.length }));
      expect(build.mock.calls.length).toBe(0);
      // Setters must invalidate even if callers reuse array identity.
      engine.setOverlays(overlays); engine.flushRenderFrame();
      expect(build).toHaveBeenCalledTimes(1);
      engine.loadBars(bars); engine.flushRenderFrame();
      expect(build).toHaveBeenCalledTimes(2);
      overlays[0].period = 20;
      engine.setViewport({ startIndex: 0, endIndex: 60 }); engine.flushRenderFrame();
      expect(build).toHaveBeenCalledTimes(3);
      bars[bars.length - 1].close += 1;
      engine.setViewport({ startIndex: 1, endIndex: 61 }); engine.flushRenderFrame();
      expect(build).toHaveBeenCalledTimes(4);
    } finally { engine.unmount(); build.mockRestore(); }
  });
});
