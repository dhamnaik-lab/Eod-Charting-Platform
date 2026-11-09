import { describe, expect, it } from 'vitest';
import { loadSourceFunctions } from './scannerDrawingTestHarness';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/plugins/scanner/chartPatternScanners';
import { buildScaleX, buildScaleY } from '@/engine/ScaleManager';

const canvas = loadSourceFunctions('src/components/ChartCanvas.tsx', [
  'geometryToMultiAnchorDrawing', 'buildScannerOverlayDrawings',
  'findScannerGeometryPointIndex', 'findBarIndexOnOrAfter', 'isFinitePrice', 'getScannerOverlayColor',
]);
const instrument = { exchange: 'NSE', symbol: 'ABC' };
const bars = Array.from({ length: 25 }, (_, index) => ({
  date: `2028-06-${String(index + 1).padStart(2, '0')}`,
  open: 100, high: 120, low: 90, close: 105, volume: 100000,
}));
const point = (index: number, price: number) => ({ date: bars[index].date, price });
const overlay = (geometry: unknown) => ({
  id: 'regression', instrument, date: bars[20].date, scannerName: 'Fixture',
  direction: 'bullish', levels: [], geometry,
});

describe('scanner geometry conversion', () => {
  it.each(['top', 'bottom'])('uses the detector turning points for %s H&S', (kind) => {
    const prices = [
      [88,92,86,90],[90,96,88,94],[94,104,92,101],[101,110,99,106],
      [105,108,96,98],[98,103,92,95],[96,112,95,110],[110,124,108,120],
      [118,121,104,106],[106,111,94,96],[98,108,96,106],[106,112,102,108],
      [104,108,98,100],[100,104,96,98],[98,101,93,95],[94,98,89,91],
    ];
    const input = prices.map(([open, high, low, close], index) => ({
      ...bars[index], symbol: 'ABC',
      ...(kind === 'top' ? { open, high, low, close } : { open: 220-open, high: 220-low, low: 220-high, close: 220-close }),
    }));
    const id = kind === 'top' ? 'chart_head_shoulders' : 'chart_inverse_head_shoulders';
    const result = runChartPatternScanner({ ...instrument, instrument, bars: input }, chartPatternScannerDefinitions.find(d => d.id === id)!);
    expect(result?.matched).toBe(true);
    const geometry = result!.chartPattern!.geometry!;
    const fixture = { ...overlay(geometry), date: result!.date };
    const drawing = canvas.geometryToMultiAnchorDrawing(fixture, input, '#fff', true);
    expect(drawing.anchors.map((anchor: { barIndex: number }) => anchor.barIndex)).toEqual([3,5,7,9,11]);
    expect(drawing.anchors.map((anchor: { price: number }) => anchor.price)).toEqual(
      [110,92,124,94,112].map(price => kind === 'top' ? price : 220-price),
    );
    expect(geometry.trendLines?.[0]).toMatchObject({
      start: { date: bars[5].date, price: kind === 'top' ? 92 : 128 },
      end: { date: bars[9].date, price: kind === 'top' ? 94 : 126 },
    });
  });

  it('falls back to supplied lines when H&S has no explicit trough anchors', () => {
    const fixture = overlay({ family: 'head-and-shoulders', pivotMarkers: [
      { label: 'LS', ...point(3,110) }, { label: 'H', ...point(7,124) }, { label: 'RS', ...point(11,112) },
    ], trendLines: [{ id:'neck', role:'neckline', start:point(3,97), end:point(15,97), extendRight:true }] });
    expect(canvas.geometryToMultiAnchorDrawing(fixture, bars, '#fff', true)).toBeNull();
    expect(canvas.buildScannerOverlayDrawings(fixture, instrument, bars)).toContainEqual(expect.objectContaining({ kind:'ray', startIndex:3, endIndex:15 }));
  });
  it.each([
    ['symmetrical triangle', 'triangle', 'upper', 'lower', 120, 108, 90, 103],
    ['ascending triangle', 'triangle', 'resistance', 'lower', 120, 120, 90, 103],
    ['descending triangle', 'triangle', 'upper', 'support', 120, 108, 90, 90],
    ['falling wedge', 'wedge', 'upper', 'lower', 120, 108, 105, 100],
    ['rising wedge', 'wedge', 'upper', 'lower', 110, 120, 90, 115],
  ])('preserves both independent %s boundaries', (_name, family, upperRole, lowerRole, u1, u2, l1, l2) => {
    const geometry = { family, trendLines: [
      { id: 'upper', role: upperRole, start: point(1, Number(u1)), end: point(13, Number(u2)), extendRight: true },
      { id: 'lower', role: lowerRole, start: point(4, Number(l1)), end: point(17, Number(l2)), extendRight: true },
    ] };
    const drawings = canvas.buildScannerOverlayDrawings(overlay(geometry), instrument, bars);
    const boundaries = drawings.filter((drawing: { kind: string }) => drawing.kind === 'ray');
    expect(boundaries).toMatchObject([
      { startIndex: 1, startPrice: u1, endIndex: 13, endPrice: u2, locked: true },
      { startIndex: 4, startPrice: l1, endIndex: 17, endPrice: l2, locked: true },
    ]);
    expect(drawings.some((drawing: { kind: string }) => drawing.kind === 'triangle')).toBe(false);
  });

  it('preserves finite segments, generic fallback and instrument isolation', () => {
    const fixture = overlay({ family: 'generic', trendLines: [
      { id: 'line', role: 'generic', start: point(2, 100), end: point(8, 105), extendRight: false },
    ] });
    expect(canvas.buildScannerOverlayDrawings(fixture, instrument, bars)).toContainEqual(expect.objectContaining({
      kind: 'trendline', startIndex: 2, endIndex: 8, startPrice: 100, endPrice: 105,
    }));
    expect(canvas.buildScannerOverlayDrawings(fixture, { exchange: 'BSE', symbol: 'ABC' }, bars)).toEqual([]);
  });

  it('emits shaded consolidation bounding zones, horizontal pivot lines, and breakout markers', () => {
    const fixture = {
      ...overlay({
        family: 'flag',
        zones: [{ id: 'consolidation-zone', label: 'Flag consolidation', role: 'base', startDate: bars[5].date, endDate: bars[12].date, low: 98, high: 112 }],
        trendLines: [
          { id: 'pole', role: 'pole', start: point(0, 90), end: point(5, 114) },
          { id: 'upper', role: 'upper', start: point(5, 112), end: point(12, 108), extendRight: true },
          { id: 'lower', role: 'lower', start: point(5, 102), end: point(12, 98), extendRight: true },
        ],
      }),
      levels: [{ label: 'Breakout', value: 112 }],
    };
    const drawings = canvas.buildScannerOverlayDrawings(fixture, instrument, bars);
    const zoneRect = drawings.find((d: { kind: string }) => d.kind === 'rect');
    expect(zoneRect).toMatchObject({
      kind: 'rect',
      startIndex: 5,
      endIndex: 12,
      startPrice: 112,
      endPrice: 98,
      presentation: { fills: { body: { visible: true, opacity: 0.12 } } },
    });
    expect(drawings).toContainEqual(expect.objectContaining({
      id: 'scanner-overlay:regression:level:0',
      kind: 'ray',
      startPrice: 112,
      endPrice: 112,
      lineStyle: 'dashed',
    }));
    expect(drawings).toContainEqual(expect.objectContaining({
      id: 'scanner-overlay:regression:breakout-marker',
      kind: 'arrowUp',
      barIndex: 20,
    }));

    const filledRects: number[][] = [];
    const renderer = loadSourceFunctions('src/engine/Renderer.ts', ['drawRectangle'], {
      resolveTransparentColor: (_color: string, opacity: number) => `rgba(34,197,94,${opacity})`,
      drawAnchorHandle: () => {},
    });
    const ctx = {
      fillStyle: '',
      save() {},
      restore() {},
      strokeRect() {},
      fillRect(x: number, y: number, w: number, h: number) { filledRects.push([x, y, w, h]); },
    };
    renderer.drawRectangle(ctx, zoneRect, { toPixel: (n: number) => n * 10 }, { toPixel: (n: number) => 200 - n }, false);
    expect(filledRects).toEqual([[50, 88, 70, 14]]);

    const reversalWithConfirmationLine = {
      ...overlay({
        family: 'triple-top-bottom',
        trendLines: [
          { id: 'confirmation-level', role: 'support', start: point(3, 95), end: point(20, 95), extendRight: true },
        ],
      }),
      levels: [
        { label: 'Breakout', value: 95 },
        { label: 'Support', value: 95 },
        { label: 'Resistance', value: 112 },
      ],
    };
    const reversalDrawings = canvas.buildScannerOverlayDrawings(reversalWithConfirmationLine, instrument, bars);
    expect(reversalDrawings.some((d: { id: string }) => d.id.includes(':level:'))).toBe(false);
  });

  it('keeps the manual three-anchor triangle renderer contract unchanged', () => {
    const paths: number[][] = [];
    const renderer = loadSourceFunctions('src/engine/Renderer.ts', ['drawTriangle', 'toMultiAnchorPixels'], {
      resolveTransparentColor: () => '#fff', drawMultiAnchorHandles: () => {},
    });
    const ctx = { save() {}, restore() {}, beginPath() {}, closePath() {}, fill() {}, stroke() {},
      moveTo(x: number, y: number) { paths.push([x, y]); }, lineTo(x: number, y: number) { paths.push([x, y]); } };
    renderer.drawTriangle(ctx, { anchors: [
      { barIndex: 1, price: 120 }, { barIndex: 13, price: 108 }, { barIndex: 4, price: 90 },
    ] }, { toPixel: (n: number) => n * 2 }, { toPixel: (n: number) => n * 3 }, false);
    expect(paths).toEqual([[2, 360], [26, 324], [8, 270]]);
  });

  it.each([false, true])('keeps boundary rays tied to data prices across pan/zoom (log=%s)', (logScale) => {
    const fixture = overlay({ family:'triangle', trendLines:[
      { id:'u', role:'upper', start:point(1,120), end:point(13,108), extendRight:true },
      { id:'l', role:'lower', start:point(4,90), end:point(17,103), extendRight:true },
    ] });
    const boundaries = canvas.buildScannerOverlayDrawings(fixture, instrument, bars).filter((d: { kind:string }) => d.kind === 'ray');
    const renderer = loadSourceFunctions('src/engine/Renderer.ts', ['drawRay', 'normalizeIndexDelta', 'drawAnchorHandle']);
    for (const [startIndex, endIndex, width, projectedPrices] of [
      [0,25,800,[96,111]], [5,20,1000,[101,106]],
    ] as const) {
      const viewport = { startIndex, endIndex };
      const x = buildScaleX(viewport, width);
      const y = buildScaleY(bars.map((bar, i) => ({ ...bar, timestamp:Date.UTC(2028,5,i+1) })), 0, 24, 400, 0, 0, [], { min:80, max:130 }, logScale);
      boundaries.forEach((drawing: any, index: number) => {
        const path: number[][] = [];
        const ctx = { beginPath() {}, stroke() {}, setLineDash() {}, arc() {}, fill() {},
          moveTo(px:number, py:number) { path.push([px,py]); }, lineTo(px:number, py:number) { path.push([px,py]); } };
        renderer.drawRay(ctx, drawing, viewport, x, y, width, 400, false);
        expect(path).toEqual([
          [x.toPixel(drawing.startIndex), y.toPixel(drawing.startPrice)],
          [x.toPixel(endIndex), y.toPixel(projectedPrices[index])],
        ]);
      });
    }
  });
});
