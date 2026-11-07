import type { CorporateActionImportRow } from '@/platform';
import { corporateActionSearchRank, normalizeCorporateActionSearch } from './corporateActionQuickSearch';

export const CLASSIC_ACTION_TYPES = ['SPLIT', 'BONUS', 'DIVIDEND', 'RIGHTS', 'DEMERGER', 'OTHER'] as const;
export const CLASSIC_DEFAULT_SORT = { column: 'date', descending: true } as const;

export type ClassicStatus = 'ready' | 'later' | 'waiting' | 'review' | 'informational' | 'checking' | 'approved' | 'processed';
export type ClassicStatusFilter = ClassicStatus | 'all' | 'issues';

// Only actionable blocked/pending events are issues. Informational and
// already-processed records remain available through their own filters.
export function isClassicIssue(event: Pick<ClassicActionEvent, 'category'>): boolean {
  return event.category === 'waiting' || event.category === 'review' || event.category === 'checking';
}
export interface ClassicActionRow {
  record: CorporateActionImportRow;
  ready: boolean;
  status: string;
  category: ClassicStatus;
  terms: string;
}
export interface ClassicActionEvent {
  key: number;
  rows: ClassicActionRow[];
  action: string;
  terms: string;
  status: string;
  category: ClassicStatus;
  ready: boolean;
}

export function classicIdentityLabel(row: CorporateActionImportRow): string {
  return row.symbol ?? row.isin ?? (row.exchange === 'BSE' && row.bseScripCode
    ? `BSE ${row.bseScripCode} (unmatched)` : 'Unmatched');
}

// Presentation grouping only. Financial authority always remains with the
// parent's existing per-import readiness gate and exact-ID confirmation.
export function groupClassicActionRows(input: readonly ClassicActionRow[]): ClassicActionEvent[] {
  const rows = [...new Map(input.map(row => [row.record.id, row])).values()];
  const possible = new Map<string, ClassicActionRow[]>();
  for (const row of rows) {
    const r = row.record;
    if (!r.symbol || !r.isin || !r.exDate || r.evidenceCount < 1 || r.parseStatus !== 'PARSED'
      || !['SPLIT', 'BONUS'].includes(r.actionType)
      || !/\bBONUS\b/i.test(r.purposeRaw) || !/\b(SPLIT|SUB[ -]?DIVISION)\b/i.test(r.purposeRaw)) continue;
    const key = JSON.stringify([r.exchange, r.symbol, r.isin, r.exDate, r.recordDate, r.source, r.sourceFile, r.purposeRaw]);
    const bucket = possible.get(key);
    if (bucket) bucket.push(row);
    else possible.set(key, [row]);
  }
  const companions = new Map<number, ClassicActionRow[]>();
  for (const group of possible.values()) {
    if (group.length !== 2 || new Set(group.map(row => row.record.actionType)).size !== 2) continue;
    const sorted = [...group].sort((a, b) => a.record.id - b.record.id);
    for (const row of sorted) companions.set(row.record.id, sorted);
  }
  const seen = new Set<number>();
  const rank: Record<ClassicStatus, number> = { review: 0, checking: 1, waiting: 2, later: 0, informational: 3, approved: 4, processed: 4, ready: 5 };
  return rows.flatMap(row => {
    if (seen.has(row.record.id)) return [];
    const group = companions.get(row.record.id) ?? [row];
    group.forEach(item => seen.add(item.record.id));
    const ready = group.every(item => item.ready && item.category !== 'later');
    const representative = [...group].sort((a, b) => rank[a.category] - rank[b.category])[0];
    const partiallyApproved = group.some(item => item.category === 'approved') && group.some(item => item.category !== 'approved');
    return [{ key: group[0].record.id, rows: group, ready,
      action: group.length === 2 ? 'Split + Bonus' : row.record.actionType.charAt(0) + row.record.actionType.slice(1).toLowerCase(),
      terms: group.map(item => item.terms).join(' / '),
      category: partiallyApproved ? 'review' as const : group.some(item => item.category === 'later') ? 'later' as const : ready ? 'ready' as const : representative.category,
      status: partiallyApproved ? 'Partially approved' : group.some(item => item.category === 'later') ? 'Later' : ready ? 'Ready' : representative.status }];
  });
}

export function classicVisibleReadyIds(events: readonly ClassicActionEvent[]): number[] {
  return events.filter(event => event.ready).flatMap(event => event.rows.map(row => row.record.id));
}

export function classicVisibleEvents(events: readonly ClassicActionEvent[], status: ClassicStatusFilter,
  sort: { column: 'exchange' | 'symbol' | 'company' | 'action' | 'date' | 'terms' | 'status'; descending: boolean },
  search = '', exchange: 'all' | 'NSE' | 'BSE' = 'all'): ClassicActionEvent[] {
  const value = (event: ClassicActionEvent): string => {
    const r = event.rows[0].record;
    return ({ exchange: r.exchange, symbol: classicIdentityLabel(r), company: r.companyName ?? '', action: event.action,
      date: r.exDate ?? '', terms: event.terms, status: event.status })[sort.column];
  };
  const query = normalizeCorporateActionSearch(search);
  const ranked = events.filter(event => (status === 'issues' ? isClassicIssue(event) : status === 'all' || event.category === status)
    && (exchange === 'all' || event.rows.every(row => row.record.exchange === exchange))).flatMap(event => {
    const ranks = event.rows.map(row => corporateActionSearchRank(row.record, query)).filter(rank => rank != null);
    return ranks.length ? [{ event, rank: Math.min(...ranks) }] : [];
  });
  return ranked.sort((a, b) => a.rank - b.rank ||
    (value(a.event).localeCompare(value(b.event), undefined, { numeric: true }) || a.event.key - b.event.key) * (sort.descending ? -1 : 1))
    .map(item => item.event);
}
