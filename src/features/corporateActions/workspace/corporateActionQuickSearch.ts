import type { CorporateActionImportRow } from '@/platform';

export function normalizeCorporateActionSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Identity fields only: source URLs and diagnostic text are not quick-search identities. */
export function corporateActionSearchRank(row: CorporateActionImportRow, query: string): number | null {
  const needle = normalizeCorporateActionSearch(query);
  if (!needle) return 0;
  const symbol = normalizeCorporateActionSearch(row.symbol ?? '');
  if (symbol === needle) return 0;
  if (symbol.startsWith(needle)) return 1;
  return [symbol, row.companyName, row.isin, row.bseScripCode]
    .some(value => value && normalizeCorporateActionSearch(value).includes(needle)) ? 2 : null;
}
