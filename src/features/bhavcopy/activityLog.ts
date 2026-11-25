import type { BhavcopyActivityEntry, BhavcopyActivityReport } from '@/types/desktop';

type Level = 'info' | 'success' | 'error' | 'warning' | 'incomplete';
export interface ActivityLine {
  level: Level;
  label: string;
  message: string;
}
export interface ActivitySummary {
  successCount: number;
  existingCount: number;
  skippedCount: number;
  pendingCount: number;
  unresolvedCount: number;
  failedCount: number;
  partialCount: number;
  cancelledCount: number;
  totalRowsInserted: number;
  completedCount: number;
  calendarSkipCount: number;
  dateCount: number;
}

const EXCHANGES = ['NSE', 'BSE', 'NSE_INDEX', 'BSE_INDEX'];
const LABELS: Record<string, string> = { NSE: 'NSE', BSE: 'BSE', NSE_INDEX: 'NSE Index', BSE_INDEX: 'BSE Index' };
const weekday = new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: 'UTC' });
const compact = (value: string): string => value.replace(/\s+/g, ' ').trim();

function dateLabel(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year} ${weekday.format(new Date(`${date}T00:00:00Z`))}`;
}

export function formatDateActivity(report: BhavcopyActivityReport): { lines: ActivityLine[]; summary: ActivitySummary } {
  const summary: ActivitySummary = {
    successCount: 0, existingCount: 0, skippedCount: 0, pendingCount: 0, unresolvedCount: 0,
    failedCount: 0, partialCount: 0, cancelledCount: 0, totalRowsInserted: 0,
    completedCount: 0, calendarSkipCount: 0, dateCount: 0,
  };
  const dates = new Map<string, Map<string, BhavcopyActivityEntry>>();
  for (const entry of report.entries) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.tradeDate) || !EXCHANGES.includes(entry.exchange)) continue;
    let group = dates.get(entry.tradeDate);
    if (!group) { group = new Map(); dates.set(entry.tradeDate, group); }
    group.set(entry.exchange, { ...entry, message: compact(entry.message), context: entry.context ? compact(entry.context) : null });
  }
  const lines: ActivityLine[] = [];
  for (const date of [...dates.keys()].sort()) {
    const entries = [...dates.get(date)!.values()].sort((a, b) => EXCHANGES.indexOf(a.exchange) - EXCHANGES.indexOf(b.exchange));
    const statuses = new Set(entries.map((entry) => entry.status));
    for (const entry of entries) {
      summary.totalRowsInserted += entry.rowsInserted;
      if (entry.status !== 'cancelled') summary.completedCount += 1;
      switch (entry.status) {
        case 'existing': summary.existingCount += 1; break;
        case 'imported': summary.successCount += 1; break;
        case 'weekend': case 'holiday': summary.skippedCount += 1; summary.calendarSkipCount += 1; break;
        case 'absent': summary.skippedCount += 1; summary.unresolvedCount += 1; break;
        case 'notDue': summary.pendingCount += 1; break;
        case 'incomplete': summary.partialCount += 1; break;
        case 'failed': summary.failedCount += 1; break;
        case 'cancelled': summary.cancelledCount += 1; break;
      }
    }
    // Group only equivalent presentation outcomes. Keep numeric import counts
    // per exchange, and keep different holiday names or special-session contexts separate.
    const sharedSession = entries[0]?.context && !statuses.has('holiday') && !statuses.has('notDue')
      && entries.every((entry) => entry.context === entries[0].context) ? entries[0].context : null;
    const groups = new Map<string, { exchanges: string[]; text: string; status: BhavcopyActivityEntry['status'] }>();
    for (const entry of entries) {
      let text = entry.message;
      if (entry.status === 'weekend') {
        if (/^Weekend(?: — not requested| \((?:Saturday|Sunday)\))$/.test(text)) text = 'Weekend';
        if (entry.context && entry.context !== sharedSession) text += ` (${entry.context})`;
      } else if (entry.status === 'holiday' && entry.context?.startsWith('Saved holiday: ')) {
        // Only normalize separators; never equate differently named holidays.
        const name = compact(entry.context.slice('Saved holiday: '.length).replace(/(\p{L})[-‐‑–](?=\p{L})/gu, '$1 '));
        text = `Saved holiday: ${name}`;
      } else if (entry.status === 'notDue') {
        text = entry.context === 'Future date' ? 'Bhavcopy not yet due (future date)'
          : `Bhavcopy not yet due${entry.context ? ` (${entry.context})` : ''}`;
      } else {
        if (entry.status === 'incomplete' && entry.rowsInserted === 0 && text === 'Partial coverage (+0 rows)') text = 'Partial coverage';
        if (entry.context && entry.context !== sharedSession) text += ` (${entry.context})`;
      }
      const key = JSON.stringify([entry.status, text, entry.rowsInserted > 0 ? entry.exchange : null]);
      const group = groups.get(key);
      if (group) group.exchanges.push(LABELS[entry.exchange]);
      else groups.set(key, { exchanges: [LABELS[entry.exchange]], text, status: entry.status });
    }
    const parts = [...groups.values()].map((group) =>
      group.exchanges.length === EXCHANGES.length && ['weekend', 'holiday', 'notDue'].includes(group.status)
        ? group.text : `${group.exchanges.join(', ')}: ${group.text}`);
    const message = [dateLabel(date), sharedSession, ...parts].filter(Boolean).join(' | ');
    const level: Level = statuses.has('failed') ? 'error' : statuses.has('incomplete') ? 'incomplete'
      : statuses.has('notDue') || statuses.has('absent') || statuses.has('cancelled') ? 'warning'
      : statuses.has('imported') ? 'success' : 'info';
    const label = statuses.has('failed') ? 'ERROR' : statuses.has('incomplete') ? 'INCOMPLETE'
      : statuses.has('cancelled') ? 'CANCELLED' : statuses.has('notDue') ? 'PENDING'
      : statuses.has('absent') ? 'SKIP' : statuses.has('imported') ? 'SUCCESS' : 'SKIP';
    lines.push({ level, label, message });
  }
  summary.dateCount = dates.size;
  return { lines, summary };
}

// Match only known backend lifecycle events; the raw message stays in Detailed Logs.
export function compactActivityProgress(message: string): { level: Level; message: string; durability?: boolean } | null {
  if (message.startsWith('Background checkpoint complete for Bhavcopy session')) return { level: 'success', message: 'Background checkpoint completed — import session saved', durability: true };
  if (message.startsWith('Background checkpoint started for Bhavcopy session')) return { level: 'info', message: 'Background checkpoint started', durability: true };
  if (message.startsWith('Background checkpoint deferred for Bhavcopy session')) return { level: 'warning', message: 'Background checkpoint deferred — recovery journal retained', durability: true };
  if (message.startsWith('Background checkpoint error:')) return { level: 'error', message: 'Background checkpoint failed — inspect Detailed Logs', durability: true };
  if (message.startsWith('Bhavcopy immediate checkpoint complete')) return { level: 'success', message: 'Import saved — immediate checkpoint completed; no background sync required', durability: true };
  if (message.startsWith('Bhavcopy import applied; durable recovery journal retained')) return { level: 'info', message: 'Import applied — background checkpoint pending', durability: true };
  if (message.startsWith('Recovering ') && message.includes('Bhavcopy import session')) return { level: 'warning', message: 'Recovering pending imports before download' };
  if (message.startsWith('Buffered Bhavcopy checkpoint verification failed')) return { level: 'warning', message: 'Previous checkpoint verification failed — attempting safe recovery' };
  if (message.startsWith('Recovered Bhavcopy session') || message.startsWith('Checkpointed prior buffered Bhavcopy session')) return { level: 'success', message: 'Previous import recovery completed' };
  if (message.startsWith('Download jobs: ')) return { level: 'info', message };
  if (message.startsWith('Importing staged download jobs: ')) return { level: 'info', message };
  return null;
}

export function activitySummaryText(summary: ActivitySummary, cancelled: boolean): string {
  return `${cancelled ? 'Download cancelled' : 'Download complete'}: ${summary.dateCount} dates | ${summary.existingCount} existing, ${summary.successCount} imported, ${summary.skippedCount} skipped (${summary.unresolvedCount} unresolved), ${summary.pendingCount} pending, ${summary.partialCount} incomplete, ${summary.failedCount} failed${summary.cancelledCount ? `, ${summary.cancelledCount} cancelled` : ''} | ${summary.totalRowsInserted} rows imported`;
}
