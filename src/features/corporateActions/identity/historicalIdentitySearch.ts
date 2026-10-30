import type { NseHistoricalIdentityPreviewRow } from '@/types/desktop';
import type { IdentityInstrumentCategory, NseHistoricalIdentityResult } from '@/types/desktop';

export const IDENTITY_CATEGORIES: Record<IdentityInstrumentCategory, string> = {
  equity: 'Equity (including SME)', etf: 'ETF', mutualFund: 'Mutual funds', debt: 'Debt / Bonds', reitInvit: 'REIT / InvIT', unknown: 'Unknown',
};
export function historicalRowKey(row: NseHistoricalIdentityPreviewRow) {
  return [row.sourceFile, row.changeType, row.effectiveDate, row.oldSymbol, row.newSymbol, row.currentSymbol, row.oldName, row.newName].join('\u001f');
}
export function historicalCategory(row: NseHistoricalIdentityPreviewRow, evidence: NseHistoricalIdentityResult['categoryEvidence']) {
  return evidence?.[historicalRowKey(row)] ?? { category: 'unknown' as const, evidence: 'Category evidence was not recorded for this row.' };
}

export type HistoricalSearchScope = 'all' | 'symbols' | 'names' | 'dates';
export type HistoricalChangeFilter = 'all' | NseHistoricalIdentityPreviewRow['changeType'];

export function filterHistoricalIdentityRows(
  rows: NseHistoricalIdentityPreviewRow[], query: string, scope: HistoricalSearchScope,
  changeType: HistoricalChangeFilter, category: 'all' | IdentityInstrumentCategory = 'all',
  evidence?: NseHistoricalIdentityResult['categoryEvidence'],
) {
  const terms = query.trim().toLocaleUpperCase().split(/\s+/).filter(Boolean);
  return rows.filter(row => {
    if (changeType !== 'all' && row.changeType !== changeType) return false;
    if (category !== 'all' && historicalCategory(row, evidence).category !== category) return false;
    const symbols = [row.oldSymbol, row.newSymbol, row.currentSymbol];
    const names = [row.oldName, row.newName];
    const date = row.effectiveDate;
    const dates = [date, date?.split('-').reverse().join('/')];
    const fields = scope === 'symbols' ? symbols : scope === 'names' ? names : scope === 'dates' ? dates
      : [...symbols, ...names, ...dates, row.disposition, row.changeType, row.detail];
    const text = fields.filter(Boolean).join(' ').toLocaleUpperCase();
    return terms.every(term => text.includes(term));
  });
}
