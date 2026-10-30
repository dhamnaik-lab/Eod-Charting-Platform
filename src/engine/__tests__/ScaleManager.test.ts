import { describe, expect, it } from 'vitest';
import { buildScaleX, clampViewport, niceXTicks, zoomViewport } from '@/engine/ScaleManager';
import type { OHLCBar } from '@/engine/types';

function createBar(date: string): OHLCBar {
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return {
    date,
    timestamp,
    open: 100,
    high: 101,
    low: 99,
    close: 100,
    prevClose: 100,
    volume: 1000,
  };
}

function createTradingDayBars(startDate: string, count: number): OHLCBar[] {
  const bars: OHLCBar[] = [];
  const next = new Date(`${startDate}T00:00:00Z`);

  while (bars.length < count) {
    const day = next.getUTCDay();
    if (day !== 0 && day !== 6) {
      bars.push(createBar(next.toISOString().slice(0, 10)));
    }
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return bars;
}

function createWeeklyBars(startDate: string, count: number): OHLCBar[] {
  const bars: OHLCBar[] = [];
  const next = new Date(`${startDate}T00:00:00Z`);

  for (let index = 0; index < count; index += 1) {
    bars.push(createBar(next.toISOString().slice(0, 10)));
    next.setUTCDate(next.getUTCDate() + 7);
  }

  return bars;
}

function createMonthlyBars(startDate: string, count: number): OHLCBar[] {
  const bars: OHLCBar[] = [];
  const next = new Date(`${startDate}T00:00:00Z`);

  for (let index = 0; index < count; index += 1) {
    bars.push(createBar(next.toISOString().slice(0, 10)));
    next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return bars;
}

function createYearlyBars(startYear: number, count: number): OHLCBar[] {
  return Array.from({ length: count }, (_, index) => createBar(`${startYear + index}-01-01`));
}

describe('ScaleManager viewport scaling', () => {
  it('fits the complete zoomed-out viewport inside the plot width', () => {
    const totalBars = 1800;
    const viewport = clampViewport(
      {
        startIndex: 0,
        endIndex: totalBars + 8,
      },
      totalBars,
      5,
      'normal',
    );

    const scaleX = buildScaleX(viewport, 900);
    const lastVisibleBarCenter = scaleX.toPixel(totalBars - 1);

    expect(viewport.startIndex).toBe(0);
    expect(viewport.endIndex).toBe(totalBars + 8);
    expect(scaleX.barWidth).toBeLessThan(1);
    expect(lastVisibleBarCenter).toBeLessThanOrEqual(900);
  });

  it('does not grow beyond the allowed full-history span on repeated zoom-out', () => {
    let viewport = { startIndex: 1680, endIndex: 1808 };

    for (let step = 0; step < 60; step += 1) {
      viewport = zoomViewport(viewport, 0, 1 / 1.18, 1800, 'normal');
    }

    expect(viewport).toEqual({ startIndex: 0, endIndex: 1808 });
  });

  it('places daily month boundaries on the first trading day of the month', () => {
    const bars = createTradingDayBars('2025-12-01', 160);
    const viewport = { startIndex: 0, endIndex: 141 };
    const scaleX = buildScaleX(viewport, 1800);

    const ticks = niceXTicks(bars, viewport, scaleX, 1800, 'D', 110);
    const firstJanuaryIndex = bars.findIndex((bar) => bar.date.startsWith('2026-01-'));
    const januarySevenIndex = bars.findIndex((bar) => bar.date === '2026-01-07');

    expect(firstJanuaryIndex).toBeGreaterThanOrEqual(0);
    expect(ticks.find((tick) => tick.index === firstJanuaryIndex)?.isMajor).toBe(true);
    expect(ticks.find((tick) => tick.index === januarySevenIndex)?.isMajor).not.toBe(true);
  });

  it('keeps daily month boundary indices stable across zoom levels', () => {
    const bars = createTradingDayBars('2025-12-01', 220);
    const januaryIndex = bars.findIndex((bar) => bar.date.startsWith('2026-01-'));
    const zoomedInViewport = { startIndex: 0, endIndex: 141 };
    const zoomedOutViewport = { startIndex: 0, endIndex: 220 };
    const zoomedInTicks = niceXTicks(bars, zoomedInViewport, buildScaleX(zoomedInViewport, 1800), 1800, 'D', 110);
    const zoomedOutTicks = niceXTicks(bars, zoomedOutViewport, buildScaleX(zoomedOutViewport, 1800), 1800, 'D', 110);

    expect(zoomedInTicks.find((tick) => tick.index === januaryIndex)?.isMajor).toBe(true);
    expect(zoomedOutTicks.find((tick) => tick.index === januaryIndex)?.isMajor).toBe(true);
  });

  it('keeps monthly boundaries on wide daily multi-year views', () => {
    const bars = createTradingDayBars('2023-12-04', 616);
    const viewport = { startIndex: 0, endIndex: 616 };
    const ticks = niceXTicks(bars, viewport, buildScaleX(viewport, 1800), 1800, 'D', 110);
    const februaryIndex = bars.findIndex((bar) => bar.date.startsWith('2024-02-'));

    expect(ticks.find((tick) => tick.index === februaryIndex)?.isMajor).toBe(true);
  });

  it('uses monthly boundaries on wide weekly views when there is room', () => {
    const bars = createWeeklyBars('2024-01-01', 52);
    const viewport = { startIndex: 0, endIndex: 52 };
    const ticks = niceXTicks(bars, viewport, buildScaleX(viewport, 1800), 1800, 'W', 110);
    const februaryIndex = bars.findIndex((bar) => bar.date.startsWith('2024-02-'));

    expect(ticks.find((tick) => tick.index === februaryIndex)?.isMajor).toBe(true);
  });

  it('uses quarterly boundaries for monthly views when month names fit', () => {
    const bars = createMonthlyBars('2023-01-01', 60);
    const viewport = { startIndex: 0, endIndex: 60 };
    const ticks = niceXTicks(bars, viewport, buildScaleX(viewport, 1800), 1800, 'M', 110);
    const january2024Index = bars.findIndex((bar) => bar.date === '2024-01-01');
    const april2024Index = bars.findIndex((bar) => bar.date === '2024-04-01');

    expect(ticks.find((tick) => tick.index === january2024Index)?.isMajor).toBe(true);
    expect(ticks.find((tick) => tick.index === april2024Index)?.isMajor).toBe(true);
    expect(ticks.find((tick) => tick.index === april2024Index)?.label).toBe('Apr');
  });

  it('uses yearly boundaries for spaced yearly views', () => {
    const bars = createYearlyBars(2020, 12);
    const viewport = { startIndex: 0, endIndex: 12 };
    const ticks = niceXTicks(bars, viewport, buildScaleX(viewport, 1800), 1800, 'Y', 110);
    const nextYearIndex = bars.findIndex((bar) => bar.date === '2021-01-01');

    expect(ticks.find((tick) => tick.index === nextYearIndex)?.isMajor).toBe(true);
  });
});
