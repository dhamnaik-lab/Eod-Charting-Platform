import { describe, expect, it, vi } from 'vitest';
import { buildScaleX, layoutXAxisLabels, niceXTicks, type XAxisTick } from '../ScaleManager';
import { drawXAxis } from '../Renderer';
import { DARK_THEME, type OHLCBar } from '../types';

function bar(date: string): OHLCBar {
  return { date, timestamp: Date.parse(`${date}T00:00:00Z`), open: 100, high: 101, low: 99, close: 100, volume: 1 };
}
function tradingDays(start: string, count: number): OHLCBar[] {
  const rows: OHLCBar[] = []; const date = new Date(`${start}T00:00:00Z`);
  while (rows.length < count) {
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) rows.push(bar(date.toISOString().slice(0, 10)));
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return rows;
}
function painted(ticks: XAxisTick[], scale: ReturnType<typeof buildScaleX>, width: number) {
  const labels: { text: string; x: number; width: number }[] = [];
  const noop = vi.fn();
  const ctx = { fillRect: noop, beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop,
    save: noop, rect: noop, clip: noop, restore: noop,
    measureText: (text: string) => ({ width: text.length * 8.75 }),
    fillText: (text: string, x: number) => labels.push({ text, x, width: text.length * 8.75 }),
  } as unknown as CanvasRenderingContext2D;
  drawXAxis(ctx, ticks, scale, width, 80, DARK_THEME);
  return labels.sort((a, b) => a.x - b.x);
}
function expectNoOverlap(labels: { x: number; width: number }[], width: number) {
  labels.forEach((label, index) => {
    expect(label.x - label.width / 2).toBeGreaterThanOrEqual(6);
    expect(label.x + label.width / 2).toBeLessThanOrEqual(width - 6);
    if (index) expect(label.x - label.width / 2 - (labels[index - 1].x + labels[index - 1].width / 2)).toBeGreaterThanOrEqual(8);
  });
}

describe('adaptive time-axis labels', () => {
  const monthlyHistory = Array.from({ length: 382 }, (_, index) => {
    const date = new Date(Date.UTC(1995, index, 0));
    return bar(date.toISOString().slice(0, 10));
  });

  it.each([60, 76])('shows quarterly month names on a panned monthly chart with %s slots', (span) => {
    const width = 1395;
    const viewport = { startIndex: monthlyHistory.length + 8 - span + 0.2, endIndex: monthlyHistory.length + 8.2 };
    const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(monthlyHistory, viewport, scale, width, 'M', 110);
    const april2025 = monthlyHistory.findIndex((row) => row.date === '2025-04-30');
    expect(ticks.find((tick) => tick.index === april2025)?.label).toBe('Apr');
    expect(ticks.some((tick) => tick.label === '2026')).toBe(true);
    expect(ticks.some((tick) => tick.label === 'Jul')).toBe(true);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label) || /^(Apr|Jul|Oct)$/.test(tick.label))).toBe(true);
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it('shows individual months on a close monthly view', () => {
    const width = 1395; const viewport = { startIndex: 350, endIndex: 374 };
    const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(monthlyHistory, viewport, scale, width, 'M', 110);
    expect(ticks.some((tick) => tick.label === 'Feb')).toBe(true);
    expect(ticks.some((tick) => tick.label === 'Mar')).toBe(true);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label) || /^[A-Z][a-z]{2}$/.test(tick.label))).toBe(true);
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it('uses July between years at an intermediate monthly zoom', () => {
    const width = 1395;
    const viewport = { startIndex: monthlyHistory.length + 8 - 120, endIndex: monthlyHistory.length + 8 };
    const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(monthlyHistory, viewport, scale, width, 'M', 110);
    expect(ticks.filter((tick) => tick.label === 'Jul').length).toBeGreaterThanOrEqual(8);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label) || tick.label === 'Jul')).toBe(true);
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it.each([[189, 1395], [76, 350]])('keeps yearly labels for a monthly view with %s slots at %s pixels', (span, width) => {
    const viewport = { startIndex: monthlyHistory.length + 8 - span, endIndex: monthlyHistory.length + 8 };
    const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(monthlyHistory, viewport, scale, width, 'M', 110);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label))).toBe(true);
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it('anchors daily month labels to existing bars when a calendar month has no bars', () => {
    const bars = tradingDays('2025-01-01', 200).filter((row) => !row.date.startsWith('2025-05'));
    const viewport = { startIndex: 30, endIndex: 145 }; const width = 1395;
    const ticks = niceXTicks(bars, viewport, buildScaleX(viewport, width), width, 'D', 110);
    const june = bars.findIndex((row) => row.date.startsWith('2025-06'));
    expect(ticks.find((tick) => tick.index === june)?.label).toBe('Jun');
    expect(ticks.some((tick) => tick.label === 'May')).toBe(false);
    expect(ticks.every((tick) => tick.index < bars.length)).toBe(true);
  });

  // Approximate exchange-session density, with a nonzero/panned start and the
  // eight future slots used by the desktop chart. Width is CSS, not screenshot pixels.
  const history = tradingDays('1994-12-21', 9000)
    .filter((row, index) => index % 17 !== 0 && row.date <= '2026-10-26');

  it.each([986, 1104, 1237, 1400])('keeps quarterly months across the native zoom transition at %s bars', (span) => {
    const viewport = { startIndex: history.length + 8 - span + 0.25, endIndex: history.length + 8.25 };
    const width = 1395; const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(history, viewport, scale, width, 'D', 110);
    for (const year of ['2024', '2025', '2026']) {
      expect(ticks.some((tick) => tick.label === year)).toBe(true);
      for (const month of ['04', '07', '10']) {
        const index = history.findIndex((row) => row.date.startsWith(`${year}-${month}`));
        expect(ticks.some((tick) => tick.index === index && tick.isMajor)).toBe(true);
      }
    }
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it('uses half-year months before falling back to years at wider zoom', () => {
    const viewport = { startIndex: history.length + 8 - 2441, endIndex: history.length + 8 };
    const width = 1395; const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(history, viewport, scale, width, 'D', 110);
    expect(ticks.filter((tick) => tick.label === 'Jul').length).toBeGreaterThanOrEqual(8);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label) || tick.label === 'Jul')).toBe(true);
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it('does not add isolated sampled or future month names in a year-only view', () => {
    const viewport = { startIndex: history.length + 8 - 1237, endIndex: history.length + 8 };
    const width = 350; const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(history, viewport, scale, width, 'D', 110);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label))).toBe(true);
    expectNoOverlap(painted(ticks, scale, width), width);
  });

  it('labels months on a wide daily multi-year view beyond the old 480-bar cutoff', () => {
    const bars = tradingDays('2023-12-04', 616); const viewport = { startIndex: 0, endIndex: bars.length };
    const scale = buildScaleX(viewport, 1800); const ticks = niceXTicks(bars, viewport, scale, 1800, 'D', 110);
    const february = bars.findIndex((row) => row.date.startsWith('2024-02'));
    expect(ticks.find((tick) => tick.index === february)?.label).toBe('Feb');
    expect(ticks.some((tick) => tick.label === '2024')).toBe(true);
    expect(ticks.every((tick) => tick.label.trim().length > 0)).toBe(true);
    expectNoOverlap(painted(ticks, scale, 1800), 1800);
  });

  it('shows day/month detail when zoomed into a few weeks', () => {
    const bars = tradingDays('2026-07-13', 24); const viewport = { startIndex: 0, endIndex: 24 };
    const ticks = niceXTicks(bars, viewport, buildScaleX(viewport, 1000), 1000, 'D', 110);
    expect(ticks.some((tick) => /\d{2} (Jul|Aug)/.test(tick.label))).toBe(true);
    expect(ticks.some((tick) => tick.label === 'Aug')).toBe(true);
  });

  it.each([220, 540, 1740])('prevents compressed starting years from overlapping at width %s', (width) => {
    const bars = [bar('1994-12-21'), bar('1995-01-02'), bar('1996-01-02'), ...tradingDays('1996-01-03', 7580)];
    const viewport = { startIndex: 0, endIndex: bars.length }; const scale = buildScaleX(viewport, width);
    const ticks = niceXTicks(bars, viewport, scale, width, 'D', 110);
    const labels = painted(ticks, scale, width);
    expect(labels.length).toBeGreaterThan(1);
    expectNoOverlap(labels, width);
    expect(ticks.every((tick) => /^\d{4}$/.test(tick.label))).toBe(true);
  });

  it('checks real text bounds after edge clamping and prioritizes year context', () => {
    const viewport = { startIndex: 0, endIndex: 100 }; const scale = buildScaleX(viewport, 220);
    const ticks = [
      { index: 0, label: 'Dec', isMajor: true }, { index: 1, label: '2026', isYear: true, isMajor: true },
      { index: 2, label: 'Jan', isMajor: true }, { index: 98, label: '2027', isYear: true, isMajor: true },
      { index: 99, label: '02' }, { index: 20, label: '' },
    ];
    const placements = layoutXAxisLabels(ticks, scale, 220);
    expect(placements.map(({ tick }) => tick.label)).toEqual(['2026', '2027']);
    const labels = painted(ticks, scale, 220);
    expect(labels.map(({ text }) => text)).toEqual(['2026', '2027']);
    expectNoOverlap(labels, 220);
  });
  it('prioritizes a real January transition over the first data point context year', () => {
    const viewport = { startIndex: 0, endIndex: 100 }; const scale = buildScaleX(viewport, 220);
    const ticks = [
      { index: 0, label: '2023', isMajor: true, isYear: true, isContext: true },
      { index: 8, label: '2024', isMajor: true, isYear: true },
    ];
    expect(layoutXAxisLabels(ticks, scale, 220).map(({ tick }) => tick.label)).toEqual(['2024']);
  });
});
