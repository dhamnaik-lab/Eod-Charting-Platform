import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSymbolFilterVisibility } from '../symbolFilterVisibility';

describe('symbol sidebar filter visibility', () => {
  it('does not report filtering when the loaded result set is empty', () => {
    expect(getSymbolFilterVisibility(0, 0)).toEqual({
      hiddenCount: 0,
      allLoadedSymbolsFilteredOut: false,
    });
  });

  it('does not report hidden symbols when all loaded results remain visible', () => {
    expect(getSymbolFilterVisibility(12, 12)).toEqual({
      hiddenCount: 0,
      allLoadedSymbolsFilteredOut: false,
    });
  });

  it('reports partial visibility exclusions from the loaded results only', () => {
    expect(getSymbolFilterVisibility(12, 7)).toEqual({
      hiddenCount: 5,
      allLoadedSymbolsFilteredOut: false,
    });
  });

  it('distinguishes all symbols filtered out from an empty loaded result set', () => {
    expect(getSymbolFilterVisibility(12, 0)).toEqual({
      hiddenCount: 12,
      allLoadedSymbolsFilteredOut: true,
    });
  });

  it('never reports a negative hidden count', () => {
    expect(getSymbolFilterVisibility(2, 4).hiddenCount).toBe(0);
  });

  it('wires visibility guidance without changing the existing filters or inactive defaults', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/Sidebar.tsx'), 'utf8');
    expect(source).toContain('getSymbolFilterVisibility(');
    expect(source).toContain('filterVisibility.hiddenCount > 0');
    expect(source).toContain('filterVisibility.allLoadedSymbolsFilteredOut');
    expect(source).toContain('Loaded symbols are hidden by the current Visibility/Series filters.');
    expect(source).toContain('onClick={() => setSeriesFilterOpen(true)}');
    expect(source).toContain("return status === 'CURRENT';");
    expect(source).toContain('onClick={clearSymbolFilters}');
  });
});
