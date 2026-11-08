import { describe, expect, it } from 'vitest';
import { buildRenderableIndicators } from '@/engine/Indicators';
import { getIndicatorCacheBucket } from '@/indicators/registry';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';

function bars(count = 80): OHLCBar[] {
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + index * 0.3 + Math.sin(index / 5) * 3;
    return {
      date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
      timestamp: index + 1,
      open: close - 0.7,
      high: close + 1.2,
      low: close - 1.4,
      close,
      volume: 1000 + index * 10,
    };
  });
}

const stableSma: OverlayIndicator = {
  id: 'b22-sibling', kind: 'SMA', period: 15, placement: 'overlay', color: '#33aacc',
};
const editedBands: OverlayIndicator = {
  id: 'b22-edited', kind: 'BOLL', period: 10, stdDev: 1, placement: 'overlay', color: '#2299ee',
};

describe('B22: retained-indicator cache benchmark on stable bars', () => {
  it('measures 800 sequential settings edits, retained signatures and sibling identity', () => {
    const series = bars();
    const first = buildRenderableIndicators(series, [stableSma, editedBands]);
    const sibling = first.overlays[0];
    const beforeHeap = process.memoryUsage().heapUsed;
    const start = performance.now();
    let latest: ReturnType<typeof buildRenderableIndicators> = first;
    for (let index = 1; index <= 800; index += 1) {
      latest = buildRenderableIndicators(series, [stableSma, { ...editedBands, stdDev: 1 + index / 1000 }]);
      expect(latest.overlays[0]).toBe(sibling);
      expect(latest.overlays).toHaveLength(2);
    }
    const elapsedMs = performance.now() - start;
    const heapDeltaBytes = process.memoryUsage().heapUsed - beforeHeap;
    const bucket = getIndicatorCacheBucket(series, [stableSma, editedBands]);
    console.log('B22_CACHE_BENCHMARK ' + JSON.stringify({
      edits: 800,
      completedBars: series.length,
      retainedEntries: bucket.renderables.size,
      elapsedMs: Number(elapsedMs.toFixed(2)),
      heapDeltaBytes,
      siblingIdentityReused: latest.overlays[0] === sibling,
      latestBandsChanged: latest.overlays[1] !== first.overlays[1],
      runner: 'GitHub Linux Node Vitest',
    }));
    expect(latest.overlays[0]).toBe(sibling);
    expect(latest.overlays[1]).not.toBe(first.overlays[1]);
    expect(bucket.renderables.size).toBeGreaterThanOrEqual(2);
  }, 120_000);
});
