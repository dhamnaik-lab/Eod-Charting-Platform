import { describe, expect, it } from 'vitest';
import { activitySummaryText, compactActivityProgress, formatDateActivity } from '../activityLog';
import type { BhavcopyActivityEntry } from '@/types/desktop';

const entry = (tradeDate: string, exchange: string, status: BhavcopyActivityEntry['status'], message: string, rowsInserted = 0, context: string | null = null): BhavcopyActivityEntry => ({ tradeDate, exchange, status, message, rowsInserted, context });

describe('BHAV-02 date-first activity presentation', () => {
  it('orders dates and exchanges, counts actual jobs once and shows contextual outcomes', () => {
    const rows = [
      entry('2026-11-25', 'BSE_INDEX', 'notDue', 'HTTP 403', 0, 'Before 18:00 IST Bhavcopy cutoff'),
      entry('2026-11-24', 'BSE', 'holiday', 'HTTP 403', 0, 'Saved holiday: Guru Nanak Jayanti'),
      entry('2026-11-02', 'NSE_INDEX', 'incomplete', 'Partial coverage (+0 rows)'),
      entry('2026-11-01', 'NSE', 'weekend', 'Weekend (Sunday)'),
      entry('2026-11-02', 'BSE', 'existing', 'Already imported'),
      entry('2026-11-02', 'NSE', 'imported', '+10 rows', 10),
      entry('2026-11-02', 'NSE', 'imported', '+10 rows', 10),
      entry('2026-11-24', 'NSE', 'holiday', 'Archive date mismatch', 0, 'Saved holiday: Guru Nanak Jayanti'),
      entry('2026-11-06', 'NSE_INDEX', 'failed', 'Invalid index OHLC'),
      entry('2026-11-08', 'NSE', 'imported', '+10 rows', 10, 'Muhurat Trading'),
      entry('2026-11-09', 'NSE', 'absent', 'No data available (unresolved)'),
    ];
    const { lines, summary } = formatDateActivity({ entries: rows, calendarWarning: null });
    expect(lines.map((line) => line.message.slice(0, 10))).toEqual(['01-11-2026', '02-11-2026', '06-11-2026', '08-11-2026', '09-11-2026', '24-11-2026', '25-11-2026']);
    expect(lines[1].message).toContain('NSE: +10 rows | BSE: Already imported | NSE Index: Partial coverage');
    expect(lines[5].message).toContain('NSE, BSE: Saved holiday: Guru Nanak Jayanti');
    expect(lines[5].message).not.toMatch(/HTTP 403|Archive date mismatch/);
    expect(lines[6].message).not.toContain('HTTP 403');
    expect(lines[4].label).toBe('SKIP');
    expect(lines[6].label).toBe('PENDING');
    expect(summary).toMatchObject({ dateCount: 7, successCount: 2, existingCount: 1, skippedCount: 4, unresolvedCount: 1, pendingCount: 1, partialCount: 1, failedCount: 1, totalRowsInserted: 20, completedCount: 10 });
    expect(activitySummaryText(summary, false)).toContain('4 skipped (1 unresolved)');
  });
  it('groups equivalent saved holiday names and skips, but preserves different holidays and actual errors', () => {
    const exchanges = ['NSE', 'BSE', 'NSE_INDEX', 'BSE_INDEX'];
    const holiday = exchanges.map((exchange, index) => entry('2026-11-10', exchange, 'holiday', 'HTTP 403', 0,
      `Saved holiday: ${index % 2 === 0 ? 'Diwali-Balipratipada' : 'Diwali Balipratipada'}`));
    const weekend = exchanges.map((exchange) => entry('2026-11-01', exchange, 'weekend', 'Weekend — not requested'));
    const pending = exchanges.map((exchange) => entry('2026-11-25', exchange, 'notDue', 'HTTP 403', 0, 'Before 18:00 IST Bhavcopy cutoff'));
    const { lines, summary } = formatDateActivity({ entries: [...holiday, ...weekend, ...pending], calendarWarning: null });
    expect(lines.map((line) => line.message)).toEqual([
      '01-11-2026 Sunday | Weekend',
      '10-11-2026 Tuesday | Saved holiday: Diwali Balipratipada',
      '25-11-2026 Wednesday | Bhavcopy not yet due (Before 18:00 IST Bhavcopy cutoff)',
    ]);
    expect(summary).toMatchObject({ skippedCount: 8, pendingCount: 4, completedCount: 12 });
    const mixed = formatDateActivity({ entries: [holiday[0], { ...holiday[1], context: 'Saved holiday: Different event' },
      entry('2026-11-10', 'NSE_INDEX', 'failed', 'Invalid index OHLC'),
      entry('2026-11-10', 'BSE_INDEX', 'existing', 'Already imported')], calendarWarning: null });
    expect(mixed.lines[0].label).toBe('ERROR');
    expect(mixed.lines[0].message).toContain('NSE: Saved holiday: Diwali Balipratipada | BSE: Saved holiday: Different event');
    expect(mixed.lines[0].message).toContain('NSE Index: Invalid index OHLC');
  });
  it('groups identical existing outcomes, preserves positive row counts and special sessions', () => {
    const date = '2026-11-08';
    const context = 'Muhurat Trading';
    const rows = ['NSE', 'BSE', 'BSE_INDEX'].map((exchange) => entry(date, exchange, 'existing', 'Already imported', 0, context));
    rows.push(entry(date, 'NSE_INDEX', 'incomplete', 'Partial coverage (+0 rows)', 0, context));
    const { lines } = formatDateActivity({ entries: rows, calendarWarning: null });
    expect(lines[0].message).toBe('08-11-2026 Sunday | Muhurat Trading | NSE, BSE, BSE Index: Already imported | NSE Index: Partial coverage');
    const imported = formatDateActivity({ entries: ['NSE', 'BSE'].map((exchange) => entry(date, exchange, 'imported', '+10 rows', 10)), calendarWarning: null });
    expect(imported.lines[0].message).toContain('NSE: +10 rows | BSE: +10 rows');
    expect(imported.summary.totalRowsInserted).toBe(20);
  });
  it('retains imported row counts without hiding incomplete or cancelled outcomes', () => {
    const { lines, summary } = formatDateActivity({ entries: [entry('2026-11-02', 'NSE', 'incomplete', 'Partial coverage (+5 rows)', 5), entry('2026-11-02', 'BSE', 'cancelled', 'Cancelled — not completed')], calendarWarning: null });
    expect(lines[0].label).toBe('INCOMPLETE');
    expect(summary).toMatchObject({ partialCount: 1, cancelledCount: 1, totalRowsInserted: 5, completedCount: 1 });
  });
  it('condenses only explicit lifecycle evidence, never fabricating a checkpoint', () => {
    expect(compactActivityProgress('Bhavcopy binary write stats: errors 0')).toBeNull();
    expect(compactActivityProgress('Bhavcopy immediate checkpoint complete')?.level).toBe('success');
    expect(compactActivityProgress('Background checkpoint deferred for Bhavcopy session abc')?.level).toBe('warning');
    expect(compactActivityProgress('Background checkpoint error: refused')?.level).toBe('error');
    expect(compactActivityProgress('Background checkpoint complete for Bhavcopy session abc')?.message).toContain('import session saved');
  });
});
