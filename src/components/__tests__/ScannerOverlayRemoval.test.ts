import { describe, expect, it, vi } from 'vitest';
import { loadNestedSourceFunction, loadSourceFunctions } from './scannerDrawingTestHarness';

const canvas = loadSourceFunctions('src/components/ChartCanvas.tsx', [
  'geometryToMultiAnchorDrawing', 'findScannerGeometryPointIndex', 'findBarIndexOnOrAfter', 'isFinitePrice', 'isScannerOverlayDrawingId',
]);

describe('scanner overlay removal', () => {
  it('recognizes dedicated scanner geometry and routes deletion without touching user drawings', () => {
    const bars = Array.from({ length: 5 }, (_, i) => ({ date:`2028-06-0${i+1}` }));
    const drawing = canvas.geometryToMultiAnchorDrawing({ id:'selected', geometry:{ family:'head-and-shoulders', pivotMarkers:[
      { label:'LS', date:bars[0].date, price:110 }, { label:'N1', date:bars[1].date, price:92 },
      { label:'H', date:bars[2].date, price:124 }, { label:'N2', date:bars[3].date, price:94 }, { label:'RS', date:bars[4].date, price:112 },
    ] } }, bars, '#fff', true);
    const clearScannerChartOverlay = vi.fn(); const deleteSelectedDrawing = vi.fn(); const markDrawingAlertMissing = vi.fn();
    const handler = loadNestedSourceFunction('src/components/ChartCanvas.tsx', 'deleteDrawingOrScannerOverlay', {
      isScannerOverlayDrawingId:canvas.isScannerOverlayDrawingId, drawings:[{ id:'manual', locked:false }],
      clearScannerChartOverlay, clearTransientDrawingUi:vi.fn(), deleteSelectedDrawing, markDrawingAlertMissing,
    });
    handler(drawing.id);
    expect(canvas.isScannerOverlayDrawingId(drawing.id)).toBe(true);
    expect(drawing.id).toBe('scanner-overlay:selected:headAndShoulders');
    expect(canvas.isScannerOverlayDrawingId('scanner-multi:older-overlay:headAndShoulders')).toBe(true);
    expect(clearScannerChartOverlay).toHaveBeenCalledOnce();
    expect(deleteSelectedDrawing).not.toHaveBeenCalled(); expect(markDrawingAlertMissing).not.toHaveBeenCalled();
  });

  it('preserves normal user-drawing deletion and locked drawings', () => {
    const clearScannerChartOverlay = vi.fn(); const deleteSelectedDrawing = vi.fn();
    const handler = loadNestedSourceFunction('src/components/ChartCanvas.tsx', 'deleteDrawingOrScannerOverlay', {
      isScannerOverlayDrawingId:canvas.isScannerOverlayDrawingId,
      drawings:[{ id:'manual', locked:false }, { id:'locked', locked:true }],
      clearScannerChartOverlay, clearTransientDrawingUi:vi.fn(), deleteSelectedDrawing, markDrawingAlertMissing:vi.fn(),
    });
    handler('locked'); expect(deleteSelectedDrawing).not.toHaveBeenCalled();
    handler('manual'); expect(deleteSelectedDrawing).toHaveBeenCalledOnce();
    expect(clearScannerChartOverlay).not.toHaveBeenCalled();
    expect(canvas.isScannerOverlayDrawingId('scanner-drawing:promoted-range')).toBe(false);
    expect(canvas.isScannerOverlayDrawingId('scanner-map-marker:NSE:ABC:date')).toBe(false);
  });
});
