/**
 * Describe exclusions from an already loaded, exchange-scoped symbol list.
 * These counts are not database inventory totals or evidence of missing data.
 */
export function getSymbolFilterVisibility(loadedCount: number, shownCount: number): {
  hiddenCount: number;
  allLoadedSymbolsFilteredOut: boolean;
} {
  return {
    hiddenCount: Math.max(0, loadedCount - shownCount),
    allLoadedSymbolsFilteredOut: loadedCount > 0 && shownCount === 0,
  };
}
