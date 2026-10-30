export const APPROVAL_HISTORY_PAGE_SIZE = 200;

/** Offset advances by fetched rows, not deduplicated display rows. No write authority. */
export function appendApprovalHistoryPage<T extends {id: number}>(
  previous: {rows: T[]; offset: number} | null, page: readonly T[],
): {rows: T[]; offset: number; hasMore: boolean} {
  const rows = [...(previous?.rows ?? [])];
  const seen = new Set(rows.map(row => row.id));
  for (const row of page) {
    if (!seen.has(row.id)) { rows.push(row); seen.add(row.id); }
  }
  return {rows, offset:(previous?.offset ?? 0)+page.length, hasMore:page.length===APPROVAL_HISTORY_PAGE_SIZE};
}

/** Only the backend transaction owner may issue this after SQLite ROLLBACK succeeds. */
export function describeDividendDispatchFailure(error: string): string {
  const marker = 'CA_DIVIDEND_ROLLBACK_CONFIRMED: ';
  if (error.startsWith(marker)) {
    return `Dividend batch rollback confirmed. No approvals from this batch were saved. ${error.slice(marker.length)} Earlier batches may have committed; check Recent approved actions. Load & Validate before another approval.`;
  }
  return `Dividend approval result uncertain after dispatch: ${error}. Do not retry; check Approved and reload.`;
}

export function formatApprovalTime(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  // Legacy SQLite timestamps without a zone are UTC, not local time.
  const iso = value.replace(' ', 'T');
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
}
