import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getSidebarListWindow,
  SIDEBAR_VIRTUALIZE_THRESHOLD,
} from '../sidebarListWindow';

const ROW_HEIGHT = 30;

describe('UX-02 bounded Sidebar row rendering', () => {
  it('preserves full rendering for small lists', () => {
    const rowCount = SIDEBAR_VIRTUALIZE_THRESHOLD;
    expect(getSidebarListWindow(rowCount, 250, 450, ROW_HEIGHT)).toEqual({
      start: 0,
      end: rowCount,
      topSpacer: 0,
      bottomSpacer: 0,
    });
  });

  it('bounds the initial viewport for a 50,000-symbol list', () => {
    const range = getSidebarListWindow(50_000, 0, 600, ROW_HEIGHT);
    expect(range.start).toBe(0);
    expect(range.end - range.start).toBeLessThan(50);
    expect(range.topSpacer + (range.end - range.start) * ROW_HEIGHT + range.bottomSpacer)
      .toBe(50_000 * ROW_HEIGHT);
  });

  it('retains spacer geometry and selected rows at deep scroll positions', () => {
    const range = getSidebarListWindow(50_000, 30 * 15_000, 600, ROW_HEIGHT);
    expect(range.start).toBeLessThanOrEqual(15_000);
    expect(range.end).toBeGreaterThan(15_000);
    expect(range.end - range.start).toBeLessThan(50);
    expect(range.topSpacer + (range.end - range.start) * ROW_HEIGHT + range.bottomSpacer)
      .toBe(50_000 * ROW_HEIGHT);
  });

  it('accounts for the existing recent-symbol section without shifting letter index offsets', () => {
    const recentSectionHeight = 244;
    const atTop = getSidebarListWindow(5_000, 100, 450, ROW_HEIGHT, recentSectionHeight);
    const afterRecent = getSidebarListWindow(5_000, recentSectionHeight + 30 * 600, 450, ROW_HEIGHT, recentSectionHeight);
    expect(atTop.start).toBe(0);
    expect(afterRecent.start).toBeLessThanOrEqual(600);
    expect(afterRecent.end).toBeGreaterThan(600);
    expect(afterRecent.topSpacer).toBe(afterRecent.start * ROW_HEIGHT);
  });

  it('keeps a bounded set of rows available at the end of a large list', () => {
    const range = getSidebarListWindow(50_000, 50_000 * ROW_HEIGHT, 450, ROW_HEIGHT);
    expect(range.end).toBe(50_000);
    expect(range.end - range.start).toBeLessThan(50);
    expect(range.bottomSpacer).toBe(0);
  });

  it('handles empty, invalid-height and negative offsets defensively', () => {
    expect(getSidebarListWindow(0, 0, 300, ROW_HEIGHT)).toEqual({
      start: 0, end: 0, topSpacer: 0, bottomSpacer: 0,
    });
    expect(getSidebarListWindow(1000, 100, 300, 0).end).toBe(0);
    expect(getSidebarListWindow(1000, -100, 400, ROW_HEIGHT).start).toBe(0);
  });

  it('preserves full list semantics, existing index navigation and both scroll handlers', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8');
    expect(source).toContain('getSidebarListWindow(');
    expect(source).toContain('symbolBrowserEntries.slice(symbolRowWindow.start, symbolRowWindow.end).map');
    expect(source).toContain('sortedWatchlistItems.slice(watchlistRowWindow.start, watchlistRowWindow.end).map');
    expect(source).toContain('symbolGroupEntryIndexMap.get(index)');
    expect(source).toContain('symbolItemEntryIndexMap.get(buildInstrumentKey(');
    expect(source).toContain('keepVirtualRowInView(container, index, symbolScroll.recentHeight)');
    expect(source).toContain('ref={recentSectionRef}');
    expect(source).toContain('visibleRecentSymbols.map((item)');
    expect(source).toContain('filterVisibility.allLoadedSymbolsFilteredOut');
    expect(source).toContain('setSymbolScroll((current) => current.top === top');
    expect(source).toContain('setWatchlistScroll((current) => current.top === top');
    expect(source).toContain('onContextMenuItem={handleWatchlistItemContextMenu}');
    expect(source).toContain('onContextMenuItem={handleSymbolContextMenu}');
  });

  it('records a synthetic React SSR baseline and candidate row-render comparison', () => {
    const items = Array.from({ length: 10_000 }, (_, index) => `SYM${index}`);
    const renderRows = (subset: string[]) =>
      renderToStaticMarkup(createElement('div', null,
        subset.map((item) => createElement('button', { key: item }, item)),
      ));

    // Proxy benchmark only: not a real mounted Sidebar, Chrome frame-time, or Tauri measurement.
    const beforeStart = performance.now();
    const baselineMarkup = renderRows(items);
    const beforeMs = performance.now() - beforeStart;
    const range = getSidebarListWindow(items.length, 15_000, 600, ROW_HEIGHT);
    const candidate = items.slice(range.start, range.end);
    const afterStart = performance.now();
    const candidateMarkup = renderRows(candidate);
    const afterMs = performance.now() - afterStart;
    expect((baselineMarkup.match(/<button/g) ?? []).length).toBe(items.length);
    expect((candidateMarkup.match(/<button/g) ?? []).length).toBe(candidate.length);
    expect(candidate.length).toBeLessThan(50);
    console.info(
      `UX02_SYNTHETIC_REACT_SSR baseline_rows=${items.length} baseline_ms=${beforeMs.toFixed(2)} ` +
      `windowed_rows=${candidate.length} windowed_ms=${afterMs.toFixed(2)} ` +
      '(not actual mounted UI timing)',
    );
  });
});
