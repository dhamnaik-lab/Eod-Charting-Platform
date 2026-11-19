import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartEngine } from '../ChartEngine';
import { isDrawingVisibleOnTimeframe } from '../DrawingStyleSchema';
import { createDefaultFibonacciSettings } from '../DrawingFibonacciDefaults';
import { getTextBoxBounds } from '../Renderer';
import {
  DARK_THEME,
  DEFAULT_CHART_VISUAL_SETTINGS,
  type ChartDrawing,
  type ChartPaneId,
  type ChartTimeframe,
  type OHLCBar,
  type OverlayIndicator,
  type ScaleX,
  type ScaleY,
} from '../types';

function makeCtx(): CanvasRenderingContext2D {
  const noop = vi.fn();
  return {
    font: '12px sans-serif',
    save: noop,
    restore: noop,
    scale: noop,
    setTransform: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    ellipse: noop,
    rect: noop,
    roundRect: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    clip: noop,
    fill: noop,
    stroke: noop,
    fillText: noop,
    strokeText: noop,
    setLineDash: noop,
    translate: noop,
    drawImage: noop,
    createLinearGradient: vi.fn(() => ({ addColorStop: noop })),
    measureText: vi.fn((t: string) => ({ width: t.length * 7 })),
    canvas: { width: 1200, height: 800, clientWidth: 1200, clientHeight: 800 },
  } as unknown as CanvasRenderingContext2D;
}

class MockNode {
  style: Record<string, string> = {};
  width = 1200;
  height = 800;
  clientWidth = 1200;
  clientHeight = 800;
  handlers = new Map<string, Set<(e: unknown) => void>>();
  ctx = makeCtx();
  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      right: this.clientWidth,
      bottom: this.clientHeight,
      width: this.clientWidth,
      height: this.clientHeight,
      x: 0,
      y: 0,
    };
  }
  getContext() {
    return this.ctx;
  }
  append() {}
  remove() {}
  addEventListener(k: string, fn: (e: unknown) => void) {
    if (!this.handlers.has(k)) this.handlers.set(k, new Set());
    this.handlers.get(k)!.add(fn);
  }
  removeEventListener(k: string, fn: (e: unknown) => void) {
    this.handlers.get(k)?.delete(fn);
  }
  emit(k: string, ev: Record<string, unknown>) {
    this.handlers.get(k)?.forEach((fn) => fn(ev));
  }
}

function buildSampleBars(count = 140): OHLCBar[] {
  return Array.from({ length: count }, (_, i) => {
    const base = 100 + Math.sin(i * 0.15) * 20 + i * 0.4;
    const open = Number(base.toFixed(2));
    const close = Number((base + ((i % 5) - 2) * 1.8).toFixed(2));
    const high = Number((Math.max(open, close) + 3.5).toFixed(2));
    const low = Number((Math.min(open, close) - 3.2).toFixed(2));
    const day = (i % 28) + 1;
    const month = (Math.floor(i / 28) % 12) + 1;
    return {
      date: `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      timestamp: Date.UTC(2025, month - 1, day),
      open,
      high,
      low,
      close,
      volume: 15000 + (i % 17) * 1200,
      prevClose: i > 0 ? open : close,
    };
  });
}

const MULTI_PANE_OVERLAYS: OverlayIndicator[] = [
  { id: 'rsi-pane', kind: 'RSI', placement: 'pane', period: 14, color: '#38bdf8' },
  {
    id: 'macd-pane',
    kind: 'MACD',
    placement: 'pane',
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    color: '#22c55e',
    signalColor: '#f59e0b',
    histogramPositiveColor: '#22c55e',
    histogramNegativeColor: '#ef4444',
  },
  { id: 'atr-pane', kind: 'ATR', placement: 'pane', period: 14, color: '#a855f7' },
];

type PublicChartEngine = Pick<
  ChartEngine,
  | 'mount'
  | 'unmount'
  | 'resize'
  | 'loadBars'
  | 'setSymbol'
  | 'setOverlays'
  | 'setDrawings'
  | 'setSelectedDrawingId'
  | 'pickDrawingAt'
  | 'setCollapsedIndicatorPanes'
  | 'setTimeframe'
  | 'setChartType'
  | 'setViewport'
  | 'on'
  | 'flushRenderFrame'
>;

type InternalEngine = PublicChartEngine & {
  container: { clientWidth: number; clientHeight: number };
  drawings: ChartDrawing[];
  timeframe: ChartTimeframe;
  scannerLabelBoxes: Map<string, { left: number; top: number; width: number; height: number } | null>;
  getPointerState(offsetX: number, offsetY: number, width?: number, height?: number): any;
  hitTestDrawing(pointerState: any): { drawing: ChartDrawing; mode: string; anchorOrdinal?: number } | null;
  getHitTestDrawingCandidates(pointerState: any): readonly ChartDrawing[];
  getDrawingPaneId(drawing: ChartDrawing): ChartPaneId;
  resolveDrawingForCurrentChart(drawing: ChartDrawing): ChartDrawing;
  prepareScannerLabelBoxes(paneId: ChartPaneId, x: ScaleX, y: ScaleY, width: number, height: number): void;
};

/**
 * Reference baseline replicating the exact pre-PERF-01 reverse linear scan and
 * per-drawing eligibility checks before delegating eligible candidates to the
 * unchanged geometry evaluator. Counts both total drawings inspected by the
 * reverse loop and candidates reaching geometry evaluation.
 */
function runLegacyLinearHitTest(
  targetEngine: InternalEngine,
  pointerState: any,
): {
  hit: { drawing: ChartDrawing; mode: string; anchorOrdinal?: number } | null;
  inspectedCount: number;
  geometryEvaluatedCount: number;
} {
  let inspectedCount = 0;
  let geometryEvaluatedCount = 0;
  const hadOwnGetter = Object.prototype.hasOwnProperty.call(targetEngine, 'getHitTestDrawingCandidates');
  const prevGetCandidates = targetEngine.getHitTestDrawingCandidates;
  const singleCandidate: ChartDrawing[] = [null as unknown as ChartDrawing];
  targetEngine.getHitTestDrawingCandidates = () => singleCandidate;

  let hitResult: { drawing: ChartDrawing; mode: string; anchorOrdinal?: number } | null = null;
  try {
    for (let index = targetEngine.drawings.length - 1; index >= 0; index -= 1) {
      inspectedCount += 1;
      const drawing = targetEngine.drawings[index]!;
      if (targetEngine.scannerLabelBoxes.get(drawing.id) === null) continue;
      if (!isDrawingVisibleOnTimeframe(drawing, targetEngine.timeframe)) {
        continue;
      }
      const drawingPaneId = targetEngine.getDrawingPaneId(drawing);
      if (pointerState.pane.collapsed && drawing.kind !== 'vline') {
        continue;
      }
      if (drawing.kind !== 'vline' && drawingPaneId !== pointerState.pane.id) {
        continue;
      }
      geometryEvaluatedCount += 1;
      singleCandidate[0] = drawing;
      const candidateHit = targetEngine.hitTestDrawing(pointerState);
      if (candidateHit) {
        hitResult = candidateHit;
        break;
      }
    }
  } finally {
    if (hadOwnGetter) {
      targetEngine.getHitTestDrawingCandidates = prevGetCandidates;
    } else {
      Reflect.deleteProperty(targetEngine, 'getHitTestDrawingCandidates');
    }
  }

  return {
    hit: hitResult,
    inspectedCount,
    geometryEvaluatedCount,
  };
}

describe('PERF-01: ChartEngine drawing hit-test candidate pre-index', () => {
  const origWin = globalThis.window;
  const origDoc = globalThis.document;
  const origRO = globalThis.ResizeObserver;
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  let canvases: MockNode[] = [];
  let windowNode: MockNode;

  beforeEach(() => {
    canvases = [];
    windowNode = new MockNode();
    (globalThis as Record<string, unknown>).window = {
      devicePixelRatio: 2,
      addEventListener: (k: string, fn: (e: unknown) => void) => windowNode.addEventListener(k, fn),
      removeEventListener: (k: string, fn: (e: unknown) => void) => windowNode.removeEventListener(k, fn),
    };
    (globalThis as Record<string, unknown>).document = {
      createElement: (tag: string) => {
        const n = new MockNode();
        if (tag === 'canvas') canvases.push(n);
        return n;
      },
    };
    (globalThis as Record<string, unknown>).ResizeObserver = class {
      observe() {}
      disconnect() {}
    };
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

  function createMountedEngine(timeframe: ChartTimeframe = 'D'): {
    engine: InternalEngine;
    root: MockNode;
    overlayCanvas: MockNode;
  } {
    const root = new MockNode();
    const startIdx = canvases.length;
    const engine = new ChartEngine(root as unknown as HTMLDivElement, {
      theme: DARK_THEME,
      visualSettings: DEFAULT_CHART_VISUAL_SETTINGS,
      timeframe,
      chartType: 'candles',
    }) as unknown as InternalEngine;
    engine.mount();
    engine.loadBars(buildSampleBars(140));
    engine.setOverlays(MULTI_PANE_OVERLAYS);
    engine.flushRenderFrame();
    const overlayCanvas = canvases[startIdx + 1]!;
    return { engine, root, overlayCanvas };
  }

  function buildPointerForPaneValue(engine: InternalEngine, paneId: ChartPaneId, barIndex: number, value: number) {
    const probe = engine.getPointerState(200, 100, engine['container'].clientWidth, engine['container'].clientHeight);
    const pane = probe.renderState.panes.find((p: any) => p.id === paneId)!;
    const offsetX = probe.layout.leftAxisWidth + probe.scaleX.toPixel(barIndex);
    const offsetY = pane.top + pane.legendHeight + pane.scaleY.toPixel(value);
    return {
      offsetX,
      offsetY,
      pointerState: engine.getPointerState(offsetX, offsetY, engine['container'].clientWidth, engine['container'].clientHeight),
    };
  }

  it('preserves 8px tolerance, reverse z-order, pane isolation, vline cross-pane/collapsed rules, and empty-pane vlines', () => {
    const { engine } = createMountedEngine('D');
    try {
      const priceProbe = engine.getPointerState(300, 120, 1200, 800);
      const pricePane = priceProbe.renderState.pricePane;
      const rsiPane = priceProbe.renderState.panes.find((p: any) => p.id === 'rsi-pane')!;
      const macdPane = priceProbe.renderState.panes.find((p: any) => p.id === 'macd-pane')!;
      const atrPane = priceProbe.renderState.panes.find((p: any) => p.id === 'atr-pane')!;

      const targetPrice = pricePane.scaleY.toPrice(Math.floor(pricePane.plotHeight * 0.5));
      const targetRsi = rsiPane.scaleY.toPrice(Math.floor(rsiPane.plotHeight * 0.5));
      const targetMacd = macdPane.scaleY.toPrice(Math.floor(macdPane.plotHeight * 0.5));

      const drawings: ChartDrawing[] = [
        { id: 'price-hline-bottom', kind: 'hline', paneId: 'price', price: targetPrice, color: '#3b82f6' },
        { id: 'vline-mid', kind: 'vline', barIndex: 80, color: '#eab308' },
        { id: 'price-hline-top', kind: 'hline', paneId: 'price', price: targetPrice, color: '#22c55e' },
        { id: 'rsi-hline-bottom', kind: 'hline', paneId: 'rsi-pane', price: targetRsi, color: '#ef4444' },
        { id: 'rsi-hline-top', kind: 'hline', paneId: 'rsi-pane', price: targetRsi, color: '#a855f7' },
        { id: 'macd-hline', kind: 'hline', paneId: 'macd-pane', price: targetMacd, color: '#ec4899' },
      ];
      engine.setDrawings(drawings);
      engine.flushRenderFrame();

      // 1. Overlapping drawings in price pane -> top drawing wins
      const priceHitCenter = buildPointerForPaneValue(engine, 'price', 60, targetPrice);
      const hit1 = engine.hitTestDrawing(priceHitCenter.pointerState);
      expect(hit1?.drawing.id).toBe('price-hline-top');
      expect(hit1?.mode).toBe('move');
      expect(hit1).toEqual(runLegacyLinearHitTest(engine, priceHitCenter.pointerState).hit);

      // 2. 8px tolerance boundary on hline in price pane
      const withinTolerancePs = engine.getPointerState(
        priceHitCenter.offsetX,
        priceHitCenter.offsetY + 7.5,
        1200,
        800,
      );
      const outsideTolerancePs = engine.getPointerState(
        priceHitCenter.offsetX,
        priceHitCenter.offsetY + 8.5,
        1200,
        800,
      );
      expect(engine.hitTestDrawing(withinTolerancePs)?.drawing.id).toBe('price-hline-top');
      expect(engine.hitTestDrawing(outsideTolerancePs)).toBeNull();

      // 3. At barIndex 80 and targetPrice in price pane: price-hline-top (index 2) beats vline-mid (index 1),
      // which beats price-hline-bottom (index 0).
      const priceCrossVline = buildPointerForPaneValue(engine, 'price', 80, targetPrice);
      expect(engine.hitTestDrawing(priceCrossVline.pointerState)?.drawing.id).toBe('price-hline-top');

      // When price-hline-top is removed, vline-mid (index 1) beats price-hline-bottom (index 0) at their intersection!
      engine.setDrawings(drawings.filter((d) => d.id !== 'price-hline-top'));
      expect(engine.hitTestDrawing(priceCrossVline.pointerState)?.drawing.id).toBe('vline-mid');
      expect(engine.hitTestDrawing(priceCrossVline.pointerState)).toEqual(
        runLegacyLinearHitTest(engine, priceCrossVline.pointerState).hit,
      );
      engine.setDrawings(drawings);

      // At barIndex 80 away from targetPrice in price pane: vline-mid hits
      const priceVlineOnly = buildPointerForPaneValue(
        engine,
        'price',
        80,
        pricePane.scaleY.toPrice(Math.floor(pricePane.plotHeight * 0.15)),
      );
      expect(engine.hitTestDrawing(priceVlineOnly.pointerState)?.drawing.id).toBe('vline-mid');
      expect(engine.hitTestDrawing(priceVlineOnly.pointerState)).toEqual(
        runLegacyLinearHitTest(engine, priceVlineOnly.pointerState).hit,
      );

      // 4. RSI pane: rsi-hline-top (index 4) beats rsi-hline-bottom (index 3) and vline-mid (index 1)
      const rsiCross = buildPointerForPaneValue(engine, 'rsi-pane', 80, targetRsi);
      expect(engine.hitTestDrawing(rsiCross.pointerState)?.drawing.id).toBe('rsi-hline-top');

      // 5. ATR pane has ZERO pane-specific drawings, yet vline-mid must still hit in ATR pane
      const atrVline = buildPointerForPaneValue(
        engine,
        'atr-pane',
        80,
        atrPane.scaleY.toPrice(Math.floor(atrPane.plotHeight * 0.5)),
      );
      expect(engine.hitTestDrawing(atrVline.pointerState)?.drawing.id).toBe('vline-mid');
      expect(engine.hitTestDrawing(atrVline.pointerState)).toEqual(
        runLegacyLinearHitTest(engine, atrVline.pointerState).hit,
      );

      // 6. Collapse RSI pane: non-vline drawings in RSI pane are excluded, but vline-mid still hits!
      engine.setCollapsedIndicatorPanes({ 'rsi-pane': true });
      engine.flushRenderFrame();
      const collapsedProbe = engine.getPointerState(200, 100, 1200, 800);
      const collapsedRsiPane = collapsedProbe.renderState.panes.find((p: any) => p.id === 'rsi-pane')!;
      expect(collapsedRsiPane.collapsed).toBe(true);
      const collapsedRsiAtVline = engine.getPointerState(
        collapsedProbe.layout.leftAxisWidth + collapsedProbe.scaleX.toPixel(80),
        collapsedRsiPane.top + collapsedRsiPane.height - 2,
        1200,
        800,
      );
      const collapsedRsiAwayFromVline = engine.getPointerState(
        collapsedProbe.layout.leftAxisWidth + collapsedProbe.scaleX.toPixel(60),
        collapsedRsiPane.top + collapsedRsiPane.height - 2,
        1200,
        800,
      );
      expect(engine.hitTestDrawing(collapsedRsiAtVline)?.drawing.id).toBe('vline-mid');
      expect(engine.hitTestDrawing(collapsedRsiAwayFromVline)).toBeNull();
      expect(engine.hitTestDrawing(collapsedRsiAtVline)).toEqual(
        runLegacyLinearHitTest(engine, collapsedRsiAtVline).hit,
      );
      expect(engine.hitTestDrawing(collapsedRsiAwayFromVline)).toEqual(
        runLegacyLinearHitTest(engine, collapsedRsiAwayFromVline).hit,
      );
    } finally {
      engine.unmount();
    }
  });

  it('invalidates candidate index on timeframe switches, setDrawings updates/reorders/removals, Renko chartType switches, loadBars reloads, and viewport/resize changes', () => {
    const { engine, root, overlayCanvas } = createMountedEngine('D');
    try {
      const probe = engine.getPointerState(300, 120, 1200, 800);
      const targetPrice = probe.renderState.pricePane.scaleY.toPrice(120);

      const dailyOnly: ChartDrawing = {
        id: 'd-only',
        kind: 'hline',
        paneId: 'price',
        price: targetPrice,
        color: '#22c55e',
        visibility: { visible: true, timeframes: { D: true, W: false, M: false } },
      };
      const weeklyOnly: ChartDrawing = {
        id: 'w-only',
        kind: 'hline',
        paneId: 'price',
        price: targetPrice,
        color: '#3b82f6',
        visibility: { visible: true, timeframes: { D: false, W: true, M: false } },
      };
      const weeklyVline: ChartDrawing = {
        id: 'w-vline',
        kind: 'vline',
        barIndex: 70,
        color: '#eab308',
        visibility: { visible: true, timeframes: { D: false, W: true, M: false } },
      };
      const globallyHidden: ChartDrawing = {
        id: 'hidden-all',
        kind: 'hline',
        paneId: 'price',
        price: targetPrice,
        color: '#ef4444',
        visibility: { visible: false, timeframes: { D: true, W: true, M: true } },
      };

      engine.setDrawings([dailyOnly, weeklyOnly, weeklyVline, globallyHidden]);
      engine.flushRenderFrame();

      const pointerD = buildPointerForPaneValue(engine, 'price', 70, targetPrice);
      expect(engine.hitTestDrawing(pointerD.pointerState)?.drawing.id).toBe('d-only');

      engine.setTimeframe('W');
      engine.flushRenderFrame();
      const pointerW = buildPointerForPaneValue(engine, 'price', 70, targetPrice);
      expect(engine.hitTestDrawing(pointerW.pointerState)?.drawing.id).toBe('w-vline');

      engine.setTimeframe('M');
      engine.flushRenderFrame();
      const pointerM = buildPointerForPaneValue(engine, 'price', 70, targetPrice);
      expect(engine.hitTestDrawing(pointerM.pointerState)).toBeNull();

      // Switch back to D and test drawing reorder & removal via setDrawings
      engine.setTimeframe('D');
      const secondDaily: ChartDrawing = {
        id: 'd-second',
        kind: 'hline',
        paneId: 'price',
        price: targetPrice,
        color: '#f59e0b',
      };
      engine.setDrawings([dailyOnly, secondDaily]);
      expect(engine.hitTestDrawing(pointerD.pointerState)?.drawing.id).toBe('d-second');

      // Reorder so dailyOnly is last (on top)
      engine.setDrawings([secondDaily, dailyOnly]);
      expect(engine.hitTestDrawing(pointerD.pointerState)?.drawing.id).toBe('d-only');

      // Document reload (setSymbol + loadBars + setDrawings)
      engine.setSymbol({ exchange: 'NSE', symbol: 'RELIANCE' });
      engine.loadBars(buildSampleBars(140));
      engine.setDrawings([secondDaily]);
      engine.flushRenderFrame();
      expect(engine.hitTestDrawing(pointerD.pointerState)?.drawing.id).toBe('d-second');

      // Clear drawings
      engine.setDrawings([]);
      expect(engine.hitTestDrawing(pointerD.pointerState)).toBeNull();

      // Test Renko chartType switch anchor hydration and hit resolution
      const renkoTrend: ChartDrawing = {
        id: 'renko-trend',
        kind: 'trendline',
        paneId: 'price',
        startIndex: 70,
        startPrice: targetPrice,
        endIndex: 90,
        endPrice: targetPrice,
        color: '#38bdf8',
      };
      engine.setDrawings([renkoTrend]);
      engine.setChartType('renko');
      engine.flushRenderFrame();

      const startHit = buildPointerForPaneValue(engine, 'price', 70, targetPrice);
      const renkoHitResult = engine.hitTestDrawing(startHit.pointerState);
      expect(renkoHitResult?.drawing.id).toBe('renko-trend');
      expect(renkoHitResult?.mode).toBe('start');
      expect((renkoHitResult?.drawing as Extract<ChartDrawing, { kind: 'trendline' }>).startRenkoAnchor).toBeDefined();
      expect(renkoHitResult).toEqual(runLegacyLinearHitTest(engine, startHit.pointerState).hit);

      // Viewport change and resize do not retain stale screen-space coordinates
      engine.setChartType('candles');
      const vlineAt95: ChartDrawing = { id: 'vline-95', kind: 'vline', barIndex: 95, color: '#22c55e' };
      engine.setDrawings([vlineAt95]);
      engine.setViewport({ startIndex: 40, endIndex: 120 });
      engine.flushRenderFrame();
      const beforePan = buildPointerForPaneValue(engine, 'price', 95, targetPrice);
      expect(engine.pickDrawingAt(beforePan.offsetX, beforePan.offsetY)?.id).toBe('vline-95');

      engine.setViewport({ startIndex: 10, endIndex: 90 });
      engine.flushRenderFrame();
      expect(engine.pickDrawingAt(beforePan.offsetX, beforePan.offsetY)).toBeNull();

      // Resize container and verify hit at updated coordinates
      root.clientWidth = 900;
      root.width = 900;
      overlayCanvas.clientWidth = 900;
      overlayCanvas.width = 900;
      engine.resize();
      engine.setViewport({ startIndex: 40, endIndex: 120 });
      engine.flushRenderFrame();
      const afterResize = buildPointerForPaneValue(engine, 'price', 95, targetPrice);
      expect(engine.pickDrawingAt(afterResize.offsetX, afterResize.offsetY)?.id).toBe('vline-95');
    } finally {
      engine.unmount();
    }
  });

  it('preserves dynamic scannerLabelBoxes suppression, selected text resize handles, locked selection, prototype-created fixtures, and diverse shape families', () => {
    const { engine, overlayCanvas } = createMountedEngine('D');
    try {
      const probe = engine.getPointerState(300, 120, 1200, 800);
      const pricePane = probe.renderState.pricePane;
      const midPrice = pricePane.scaleY.toPrice(Math.floor(pricePane.plotHeight * 0.5));
      const highPrice = pricePane.scaleY.toPrice(Math.floor(pricePane.plotHeight * 0.3));
      const lowPrice = pricePane.scaleY.toPrice(Math.floor(pricePane.plotHeight * 0.7));

      // 1. Dynamic scanner label suppression without rebuilding candidate index
      const scannerLabel: Extract<ChartDrawing, { kind: 'text' }> = {
        id: 'scanner-overlay:perf01:label',
        kind: 'text',
        paneId: 'price',
        text: 'Bullish Flag',
        barIndex: 85,
        price: midPrice,
        fontSize: 12,
        color: '#22c55e',
        locked: true,
      };
      engine.setDrawings([scannerLabel]);
      engine.flushRenderFrame();

      const labelBox = engine.scannerLabelBoxes.get(scannerLabel.id)!;
      expect(labelBox).toBeTruthy();
      const labelCenterX = probe.layout.leftAxisWidth + labelBox.left + labelBox.width / 2;
      const labelCenterY = pricePane.top + pricePane.legendHeight + labelBox.top + labelBox.height / 2;
      const labelPointer = engine.getPointerState(labelCenterX, labelCenterY, 1200, 800);
      expect(engine.hitTestDrawing(labelPointer)?.drawing.id).toBe(scannerLabel.id);

      // Dynamically suppress scanner label in scannerLabelBoxes without calling setDrawings
      engine.scannerLabelBoxes.set(scannerLabel.id, null);
      expect(engine.hitTestDrawing(labelPointer)).toBeNull();
      // Restore box dynamically
      engine.scannerLabelBoxes.set(scannerLabel.id, labelBox);
      expect(engine.hitTestDrawing(labelPointer)?.drawing.id).toBe(scannerLabel.id);

      // 2. Manual text drawing: unselected -> 'move', selected -> 'text-se' resize handle & cursor
      const manualText: Extract<ChartDrawing, { kind: 'text' }> = {
        id: 'manual-text',
        kind: 'text',
        paneId: 'price',
        text: 'Breakout Zone',
        barIndex: 60,
        price: midPrice,
        width: 140,
        height: 32,
        fontSize: 13,
        color: '#f59e0b',
        locked: false,
      };
      engine.setDrawings([manualText]);
      engine.flushRenderFrame();

      const textBox = getTextBoxBounds(manualText, probe.scaleX, pricePane.scaleY);
      const seCornerX = probe.layout.leftAxisWidth + textBox.left + textBox.width;
      const seCornerY = pricePane.top + pricePane.legendHeight + textBox.top + textBox.height;
      const seCornerPointer = engine.getPointerState(seCornerX, seCornerY, 1200, 800);

      expect(engine.hitTestDrawing(seCornerPointer)).toEqual({ drawing: manualText, mode: 'move' });
      engine.setSelectedDrawingId(manualText.id);
      expect(engine.hitTestDrawing(seCornerPointer)).toEqual({ drawing: manualText, mode: 'text-se' });

      overlayCanvas.emit('mousemove', {
        clientX: seCornerX,
        clientY: seCornerY,
        offsetX: seCornerX,
        offsetY: seCornerY,
        shiftKey: false,
      });
      expect(overlayCanvas.style.cursor).toBe('nwse-resize');

      // 3. Diverse shape families (point, two-anchor, multi-anchor, Fib, Gann, D3B, D3C)
      const diverseDrawings: ChartDrawing[] = [
        { id: 'hray-1', kind: 'horizontalRay', paneId: 'price', barIndex: 45, price: highPrice, color: '#38bdf8' },
        { id: 'cross-1', kind: 'crossLine', paneId: 'price', barIndex: 52, price: lowPrice, color: '#38bdf8' },
        { id: 'arrow-up-1', kind: 'arrowUp', paneId: 'price', barIndex: 58, price: lowPrice, color: '#22c55e' },
        { id: 'ray-1', kind: 'ray', paneId: 'price', startIndex: 62, startPrice: lowPrice, endIndex: 68, endPrice: midPrice, color: '#f59e0b' },
        { id: 'ext-1', kind: 'extendedLine', paneId: 'price', startIndex: 72, startPrice: lowPrice, endIndex: 78, endPrice: highPrice, color: '#ec4899' },
        { id: 'gann-1', kind: 'gann', paneId: 'price', startIndex: 82, startPrice: lowPrice, endIndex: 88, endPrice: highPrice, color: '#eab308' },
        {
          id: 'fib-fan-1',
          kind: 'fibFan',
          paneId: 'price',
          startIndex: 90,
          startPrice: lowPrice,
          endIndex: 96,
          endPrice: highPrice,
          color: '#a855f7',
          toolSettings: { fibonacci: createDefaultFibonacciSettings('fibFan') },
        },
        {
          id: 'pitchfork-1',
          kind: 'andrewsPitchfork',
          paneId: 'price',
          anchors: [
            { barIndex: 32, price: midPrice },
            { barIndex: 38, price: highPrice },
            { barIndex: 42, price: lowPrice },
          ],
          color: '#14b8a6',
        },
        {
          id: 'tri-1',
          kind: 'triangle',
          paneId: 'price',
          anchors: [
            { barIndex: 50, price: lowPrice },
            { barIndex: 70, price: highPrice },
            { barIndex: 90, price: lowPrice },
          ],
          color: '#38bdf8',
          locked: false,
        },
        {
          id: 'locked-tl',
          kind: 'trendline',
          paneId: 'price',
          startIndex: 100,
          startPrice: lowPrice,
          endIndex: 115,
          endPrice: highPrice,
          color: '#ef4444',
          locked: true,
        },
        {
          id: 'long-pos-1',
          kind: 'longPosition',
          paneId: 'price',
          anchors: [
            { barIndex: 105, price: midPrice },
            { barIndex: 118, price: highPrice },
            { barIndex: 118, price: lowPrice },
          ],
          color: '#22c55e',
        },
      ];

      engine.setDrawings(diverseDrawings);
      engine.flushRenderFrame();

      for (const barIdx of [32, 45, 52, 58, 62, 70, 72, 82, 90, 100, 105]) {
        for (const priceVal of [lowPrice, midPrice, highPrice]) {
          const pt = buildPointerForPaneValue(engine, 'price', barIdx, priceVal);
          expect(engine.hitTestDrawing(pt.pointerState)).toEqual(
            runLegacyLinearHitTest(engine, pt.pointerState).hit,
          );
        }
      }

      const anchor1Pointer = buildPointerForPaneValue(engine, 'price', 70, highPrice);
      const triAnchorHit = engine.hitTestDrawing(anchor1Pointer.pointerState);
      expect(triAnchorHit?.drawing.id).toBe('tri-1');
      expect(triAnchorHit?.mode).toBe('anchor');
      expect(triAnchorHit?.anchorOrdinal).toBe(1);

      // 4. Locked drawing mousedown selects but does not emit drawingUpdate on drag
      const events: Array<{ type: string; drawingId?: string | null; drawing?: ChartDrawing }> = [];
      const off = engine.on((ev) => events.push(ev));
      const lockedStartPointer = buildPointerForPaneValue(engine, 'price', 100, lowPrice);
      overlayCanvas.emit('mousedown', {
        button: 0,
        clientX: lockedStartPointer.offsetX,
        clientY: lockedStartPointer.offsetY,
        offsetX: lockedStartPointer.offsetX,
        offsetY: lockedStartPointer.offsetY,
        shiftKey: false,
      });
      overlayCanvas.emit('mousemove', {
        clientX: lockedStartPointer.offsetX + 25,
        clientY: lockedStartPointer.offsetY - 20,
        offsetX: lockedStartPointer.offsetX + 25,
        offsetY: lockedStartPointer.offsetY - 20,
        shiftKey: false,
      });
      windowNode.emit('mouseup', {});
      expect(events.some((e) => e.type === 'drawingSelect' && e.drawingId === 'locked-tl')).toBe(true);
      expect(events.some((e) => e.type === 'drawingUpdate')).toBe(false);

      // 5. Unlocked drawing anchor drag emits drawingUpdate with updated anchor
      events.length = 0;
      overlayCanvas.emit('mousedown', {
        button: 0,
        clientX: anchor1Pointer.offsetX,
        clientY: anchor1Pointer.offsetY,
        offsetX: anchor1Pointer.offsetX,
        offsetY: anchor1Pointer.offsetY,
        shiftKey: false,
      });
      overlayCanvas.emit('mousemove', {
        clientX: anchor1Pointer.offsetX + 18,
        clientY: anchor1Pointer.offsetY + 15,
        offsetX: anchor1Pointer.offsetX + 18,
        offsetY: anchor1Pointer.offsetY + 15,
        shiftKey: false,
      });
      windowNode.emit('mouseup', {});
      const updateEvent = events.find((e) => e.type === 'drawingUpdate');
      expect(updateEvent).toBeDefined();
      expect(updateEvent?.drawing?.id).toBe('tri-1');
      off();

      // 6. Prototype-created engine without constructor field initializers (like ScannerLabelLayout.test.ts)
      const protoEngine = Object.create(ChartEngine.prototype) as InternalEngine;
      const simpleScaleX: ScaleX = { barWidth: 1, barGap: 0, bodyWidth: 1, toPixel: (n) => n, toIndex: (n) => n };
      const simpleScaleY: ScaleY = { min: 0, max: 200, toPixel: (n) => n, toPrice: (n) => n };
      const hlineProto: ChartDrawing = { id: 'proto-hline', kind: 'hline', paneId: 'price', price: 100, color: '#22c55e' };
      Object.assign(protoEngine, {
        drawings: [hlineProto],
        scannerLabelBoxes: new Map(),
        chartType: 'candles',
        timeframe: 'D',
        selectedDrawingId: null,
      });
      expect(
        protoEngine.hitTestDrawing({
          pane: { id: 'price', collapsed: false, scaleY: simpleScaleY },
          scaleX: simpleScaleX,
          clampedX: 50,
          localY: 100,
        })?.drawing.id,
      ).toBe('proto-hline');
      // Direct property reassignment on prototype fixture invalidates via reference/timeframe check
      protoEngine.timeframe = 'W';
      protoEngine.drawings = [
        {
          ...hlineProto,
          visibility: { visible: true, timeframes: { D: true, W: false } },
        },
      ];
      expect(
        protoEngine.hitTestDrawing({
          pane: { id: 'price', collapsed: false, scaleY: simpleScaleY },
          scaleX: simpleScaleX,
          clampedX: 50,
          localY: 100,
        }),
      ).toBeNull();
    } finally {
      engine.unmount();
    }
  });

  it('proves deterministically that irrelevant-pane and hidden-timeframe drawings are excluded from per-hit geometry evaluation and isolates two chart tiles', () => {
    const tileA = createMountedEngine('D');
    const tileB = createMountedEngine('W');
    try {
      const probeA = tileA.engine.getPointerState(300, 120, 1200, 800);
      const priceMid = probeA.renderState.pricePane.scaleY.toPrice(120);
      const rsiPane = probeA.renderState.panes.find((p: any) => p.id === 'rsi-pane')!;
      const rsiMid = rsiPane.scaleY.toPrice(Math.floor(rsiPane.plotHeight * 0.5));

      const drawingsA: ChartDrawing[] = [
        // 3 drawings in price pane visible on D
        { id: 'p-1', kind: 'hline', paneId: 'price', price: priceMid - 15, color: '#3b82f6' },
        { id: 'p-2', kind: 'trendline', paneId: 'price', startIndex: 40, startPrice: priceMid, endIndex: 80, endPrice: priceMid, color: '#22c55e' },
        { id: 'p-3', kind: 'hline', paneId: 'price', price: priceMid + 15, color: '#f59e0b' },
        // 1 cross-pane vline visible on D
        { id: 'v-1', kind: 'vline', barIndex: 95, color: '#eab308' },
        // 25 drawings in rsi-pane / macd-pane / atr-pane
        ...Array.from({ length: 25 }, (_, i): ChartDrawing => ({
          id: `ind-${i}`,
          kind: 'hline',
          paneId: i % 2 === 0 ? 'rsi-pane' : 'macd-pane',
          price: rsiMid + (i % 5),
          color: '#ef4444',
        })),
        // 15 drawings in price pane hidden on D (visible only on W)
        ...Array.from({ length: 15 }, (_, i): ChartDrawing => ({
          id: `weekly-hidden-${i}`,
          kind: 'hline',
          paneId: 'price',
          price: priceMid,
          color: '#a855f7',
          visibility: { visible: true, timeframes: { D: false, W: true, M: false } },
        })),
      ];

      tileA.engine.setDrawings(drawingsA);
      tileB.engine.setDrawings([
        {
          id: 'tileB-only',
          kind: 'hline',
          paneId: 'price',
          price: priceMid,
          color: '#22c55e',
          visibility: { visible: true, timeframes: { D: false, W: true, M: false } },
        },
      ]);
      tileA.engine.flushRenderFrame();
      tileB.engine.flushRenderFrame();

      const pricePointerMiss = buildPointerForPaneValue(tileA.engine, 'price', 55, priceMid + 45);
      const candidatesPriceA = tileA.engine.getHitTestDrawingCandidates(pricePointerMiss.pointerState);
      // Only the 3 D-visible price drawings + 1 D-visible vline should be candidates in price pane (in reverse order)
      expect(candidatesPriceA.map((d) => d.id)).toEqual(['v-1', 'p-3', 'p-2', 'p-1']);

      const resolveSpy = vi.spyOn(tileA.engine as any, 'resolveDrawingForCurrentChart');
      const paneIdSpy = vi.spyOn(tileA.engine as any, 'getDrawingPaneId');

      // Run 10 repeated hit tests in price pane
      for (let i = 0; i < 10; i += 1) {
        expect(tileA.engine.hitTestDrawing(pricePointerMiss.pointerState)).toBeNull();
      }

      // Index was already built on getHitTestDrawingCandidates, so getDrawingPaneId was called 0 times during the 10 hitTests!
      expect(paneIdSpy).toHaveBeenCalledTimes(0);
      // Only the 4 eligible candidates were sent to resolveDrawingForCurrentChart per hitTest (4 * 10 = 40 calls, never the 40 irrelevant drawings!)
      expect(resolveSpy).toHaveBeenCalledTimes(4 * 10);
      const resolvedIds = new Set(resolveSpy.mock.calls.map((call) => (call[0] as ChartDrawing).id));
      expect([...resolvedIds]).toEqual(['v-1', 'p-3', 'p-2', 'p-1']);

      // Verify hit on p-2 start anchor maintains exact ID, mode, and anchorOrdinal
      const p2StartPointer = buildPointerForPaneValue(tileA.engine, 'price', 40, priceMid);
      expect(tileA.engine.hitTestDrawing(p2StartPointer.pointerState)).toEqual({
        drawing: drawingsA[1],
        mode: 'start',
      });

      // Verify tileB is completely isolated from tileA's index
      const pointerB = buildPointerForPaneValue(tileB.engine, 'price', 60, priceMid);
      expect(tileB.engine.hitTestDrawing(pointerB.pointerState)?.drawing.id).toBe('tileB-only');

      resolveSpy.mockRestore();
      paneIdSpy.mockRestore();

      // Verify in-place array reverse (same array reference & length) and custom pane IDs interleaved with vlines
      const customOverlapping: ChartDrawing[] = [
        { id: 'c-bottom', kind: 'hline', paneId: 'custom-osc', price: 50, color: '#3b82f6' },
        { id: 'v-interleaved-1', kind: 'vline', barIndex: 60, color: '#eab308' },
        { id: 'c-top', kind: 'hline', paneId: 'custom-osc', price: 50, color: '#22c55e' },
        {
          id: 'v-interleaved-2-weekly',
          kind: 'vline',
          barIndex: 60,
          color: '#a855f7',
          visibility: { visible: true, timeframes: { D: false, W: true, M: false } },
        },
      ];
      tileA.engine.setDrawings(customOverlapping);
      const customScaleY: ScaleY = { min: 0, max: 100, toPixel: (n) => n, toPrice: (n) => n };
      const customPointer = {
        ...pricePointerMiss.pointerState,
        pane: { id: 'custom-osc' as ChartPaneId, collapsed: false, scaleY: customScaleY, plotHeight: 100 },
        clampedX: pricePointerMiss.pointerState.scaleX.toPixel(60),
        localY: 50,
      };
      expect(tileA.engine.hitTestDrawing(customPointer)?.drawing.id).toBe('c-top');

      // Mutate tileA.engine.drawings in-place via reverse() without changing array reference or length
      tileA.engine.drawings.reverse();
      expect(tileA.engine.hitTestDrawing(customPointer)?.drawing.id).toBe('c-bottom');

      // Mutate c-bottom visibility in-place and flush base render frame -> rebuilds index so v-interleaved-1 wins
      tileA.engine.drawings[tileA.engine.drawings.length - 1]!.visibility = {
        visible: false,
        timeframes: { D: true, W: true, M: true },
      };
      (tileA.engine as any).markDirty();
      tileA.engine.flushRenderFrame();
      expect(tileA.engine.hitTestDrawing(customPointer)?.drawing.id).toBe('v-interleaved-1');
    } finally {
      tileA.engine.unmount();
      tileB.engine.unmount();
    }
  });

  it(
    'benchmarks 100, 500, and 1,000 mixed drawings across 240 pointer positions with 100% parity against baseline',
    () => {
      const { engine } = createMountedEngine('D');
      const { engine: legacyEngine } = createMountedEngine('D');
      legacyEngine.getHitTestDrawingCandidates = legacyEngine.getHitTestDrawingCandidates.bind(legacyEngine);
      try {
        const probe = engine.getPointerState(300, 120, 1200, 800);
        const panes = probe.renderState.panes as Array<{
          id: ChartPaneId;
          top: number;
          height: number;
          plotHeight: number;
          legendHeight: number;
          scaleY: ScaleY;
        }>;
        expect(panes.map((p) => p.id)).toEqual(['price', 'rsi-pane', 'macd-pane', 'atr-pane']);

        function buildPointerStates(mode: 'multi-pane' | 'price-heavy') {
          const paneOrder =
            mode === 'multi-pane'
              ? panes
              : [
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[0]!,
                  panes[1]!,
                ];
          return Array.from({ length: 240 }, (_, i) => {
            const pane = paneOrder[i % paneOrder.length]!;
            const xRatio = ((i * 17) % 100) / 100;
            const yRatio = ((i * 31) % 100) / 100;
            const offsetX = probe.layout.leftAxisWidth + Math.floor(xRatio * (probe.layout.chartWidth - 10)) + 5;
            const offsetY = pane.top + pane.legendHeight + Math.floor(yRatio * Math.max(pane.plotHeight - 6, 1)) + 3;
            return engine.getPointerState(offsetX, offsetY, 1200, 800);
          });
        }

        function buildMixedDrawings(count: number, mode: 'multi-pane' | 'price-heavy'): ChartDrawing[] {
          const paneRotation: ChartPaneId[] =
            mode === 'multi-pane'
              ? ['price', 'rsi-pane', 'macd-pane', 'atr-pane']
              : ['price', 'price', 'price', 'price', 'price', 'price', 'price', 'price', 'price', 'rsi-pane'];

          return Array.from({ length: count }, (_, i): ChartDrawing => {
            const paneId = paneRotation[i % paneRotation.length]!;
            const pane = panes.find((p) => p.id === paneId)!;
            const vMin = pane.scaleY.min;
            const vMax = pane.scaleY.max;
            const vSpan = Math.max(vMax - vMin, 1);
            const v1 = vMin + ((i * 13 + 7) % 86) * 0.01 * vSpan;
            const v2 = v1 + (((i % 5) - 2) * 0.015) * vSpan;
            const b1 = 25 + ((i * 7) % 100);
            const b2 = Math.min(135, b1 + 3 + (i % 4));

            // In multi-pane mode, 25% of drawings are timeframe-restricted to W or M (hidden on D)
            const visibility =
              mode === 'multi-pane' && i % 4 === 3
                ? { visible: true, timeframes: { D: false, W: true, M: true } }
                : { visible: true, timeframes: { D: true, W: true, M: true } };

            const shapeSelector = i % 10;
            if (shapeSelector === 0 && i % 50 === 0) {
              return { id: `d-${i}`, kind: 'vline', barIndex: b1, color: '#eab308', visibility };
            }
            if (shapeSelector === 1 && i % 40 === 1) {
              return { id: `d-${i}`, kind: 'hline', paneId, price: v1, color: '#3b82f6', visibility };
            }
            if (shapeSelector === 1 || shapeSelector === 2) {
              return {
                id: `d-${i}`,
                kind: 'trendline',
                paneId,
                startIndex: b1,
                startPrice: v1,
                endIndex: b2,
                endPrice: v2,
                color: '#22c55e',
                visibility,
              };
            }
            if (shapeSelector === 3) {
              return {
                id: `d-${i}`,
                kind: 'rect',
                paneId,
                startIndex: b1,
                startPrice: v1,
                endIndex: b2,
                endPrice: v2,
                color: '#f59e0b',
                visibility,
              };
            }
            if (shapeSelector === 4) {
              return {
                id: `d-${i}`,
                kind: 'channel',
                paneId,
                startIndex: b1,
                startPrice: v1,
                endIndex: b2,
                endPrice: v2,
                offset: vSpan * 0.03,
                color: '#38bdf8',
                visibility,
              };
            }
            if (shapeSelector === 5 && i % 40 === 5) {
              return {
                id: `d-${i}`,
                kind: 'horizontalRay',
                paneId,
                barIndex: b1,
                price: v1,
                color: '#a855f7',
                visibility,
              };
            }
            if (shapeSelector === 5 || shapeSelector === 6) {
              return {
                id: `d-${i}`,
                kind: 'triangle',
                paneId,
                anchors: [
                  { barIndex: b1, price: v1 },
                  { barIndex: Math.min(138, b1 + 4), price: v2 },
                  { barIndex: b2, price: v1 },
                ],
                color: '#ec4899',
                visibility,
              };
            }
            if (shapeSelector === 7) {
              return {
                id: `d-${i}`,
                kind: 'fib',
                paneId,
                startIndex: b1,
                startPrice: v1,
                endIndex: b2,
                endPrice: v2,
                extendLeft: false,
                extendRight: false,
                color: '#14b8a6',
                toolSettings: { fibonacci: createDefaultFibonacciSettings('fib') },
                visibility,
              };
            }
            if (shapeSelector === 8) {
              return {
                id: `d-${i}`,
                kind: 'text',
                paneId,
                barIndex: b1,
                price: v1,
                text: `Note ${i}`,
                width: 64,
                height: 20,
                fontSize: 12,
                color: '#e2e8f0',
                visibility,
              };
            }
            return {
              id: `d-${i}`,
              kind: 'circle',
              paneId,
              startIndex: b1,
              startPrice: v1,
              endIndex: Math.min(138, b1 + 3),
              endPrice: v1 + vSpan * 0.02,
              color: '#6366f1',
              visibility,
            };
          });
        }

        function measureMedianMs(fn: () => void, iterations = 7): number {
          for (let w = 0; w < 2; w += 1) fn();
          const samples: number[] = [];
          for (let iter = 0; iter < iterations; iter += 1) {
            const t0 = performance.now();
            fn();
            samples.push(performance.now() - t0);
          }
          samples.sort((a, b) => a - b);
          return Number(samples[Math.floor(samples.length / 2)]!.toFixed(3));
        }

        const summaryRows: Array<Record<string, unknown>> = [];

        // Pre-warm V8 JIT across all shape branches on both engines before timed benchmark loops
        const warmupPointers = buildPointerStates('multi-pane');
        const warmupDrawings = buildMixedDrawings(100, 'multi-pane');
        engine.setDrawings(warmupDrawings);
        engine.flushRenderFrame();
        legacyEngine.setDrawings(warmupDrawings);
        legacyEngine.flushRenderFrame();
        for (let w = 0; w < 2; w += 1) {
          for (let p = 0; p < warmupPointers.length; p += 1) {
            engine.hitTestDrawing(warmupPointers[p]);
            legacyEngine.hitTestDrawing(warmupPointers[p]);
          }
        }

        for (const workload of ['multi-pane', 'price-heavy'] as const) {
          const pointerStates = buildPointerStates(workload);
          for (const drawingCount of [100, 500, 1000] as const) {
            const drawings = buildMixedDrawings(drawingCount, workload);
            engine.setDrawings(drawings);
            engine.flushRenderFrame();
            legacyEngine.setDrawings(drawings);
            legacyEngine.flushRenderFrame();

            // 1. Verify 100% parity and count candidate evaluations across all 240 pointer positions
            let totalLegacyInspected = 0;
            let totalPreIndexedInspected = 0;
            let totalPreIndexedCandidatesAvailable = 0;
            let hitMatches = 0;
            const stopIndices: number[] = [];

            for (let p = 0; p < pointerStates.length; p += 1) {
              const ps = pointerStates[p]!;
              const legacy = runLegacyLinearHitTest(legacyEngine, ps);
              const candidates = engine.getHitTestDrawingCandidates(ps);
              const indexedHit = engine.hitTestDrawing(ps);
              const actualPreIndexedInspected = indexedHit
                ? candidates.indexOf(indexedHit.drawing) + 1
                : candidates.length;

              expect(indexedHit).toEqual(legacy.hit);
              expect(actualPreIndexedInspected).toBe(legacy.geometryEvaluatedCount);

              totalLegacyInspected += legacy.inspectedCount;
              totalPreIndexedInspected += actualPreIndexedInspected;
              totalPreIndexedCandidatesAvailable += candidates.length;
              if (indexedHit) hitMatches += 1;
              stopIndices.push(legacyEngine.drawings.length - legacy.inspectedCount);
            }

            // 2. Measure pre-indexed timing on untouched engine instance vs legacy linear scan on legacyEngine
            const preIndexedMedianMs = measureMedianMs(() => {
              for (let p = 0; p < pointerStates.length; p += 1) {
                engine.hitTestDrawing(pointerStates[p]);
              }
            });

            const scratchCandidates: ChartDrawing[] = [];
            let activeStopIdx = 0;
            legacyEngine.getHitTestDrawingCandidates = (ps: any) => {
              scratchCandidates.length = 0;
              for (let idx = legacyEngine.drawings.length - 1; idx >= activeStopIdx; idx -= 1) {
                const d = legacyEngine.drawings[idx]!;
                if (legacyEngine.scannerLabelBoxes.get(d.id) === null) continue;
                if (!isDrawingVisibleOnTimeframe(d, legacyEngine.timeframe)) continue;
                const dPaneId = legacyEngine.getDrawingPaneId(d);
                if (ps.pane.collapsed && d.kind !== 'vline') continue;
                if (d.kind !== 'vline' && dPaneId !== ps.pane.id) continue;
                scratchCandidates.push(d);
              }
              return scratchCandidates;
            };

            const legacyMedianMs = measureMedianMs(() => {
              for (let p = 0; p < pointerStates.length; p += 1) {
                activeStopIdx = stopIndices[p]!;
                legacyEngine.hitTestDrawing(pointerStates[p]);
              }
            });

            summaryRows.push({
              workload,
              drawingCount,
              pointerPositions: pointerStates.length,
              hitMatches,
              totalLegacyInspected,
              totalPreIndexedInspected,
              totalPreIndexedCandidatesAvailable,
              legacyMedianMs,
              preIndexedMedianMs,
            });
          }
        }

        console.info(JSON.stringify({ perf01Benchmark: summaryRows }));
        expect(summaryRows).toHaveLength(6);
      } finally {
        engine.unmount();
        legacyEngine.unmount();
      }
    },
    30_000,
  );
});
