import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBhavcopyStore } from '@/store/bhavcopyStore';

vi.mock('@/platform', () => ({ getDesktopApi: () => null }));

describe('archive and fallback outcomes', () => {
  beforeEach(() => useBhavcopyStore.getState().clearLogs());

  it('keeps archive failure, completed request and inserted rows separately visible', () => {
    const report = useBhavcopyStore.getState().reportDownloadResult;
    report({ exchange: 'NSE_INDEX', tradeDate: '2011-01-03 archive', success: false,
      rowsInserted: 0, message: 'Archive date mismatch' });
    report({ exchange: 'NSE_INDEX', tradeDate: '2011-01-03..2011-01-03 NIFTY', success: true,
      rowsInserted: 0, message: 'Historical subset: acquired 1, held 0, missing/unsupported 0' });
    const imported = { exchange: 'NSE_INDEX', tradeDate: '2011-01-03', success: true,
      rowsInserted: 1, message: 'NSE index subset: inserted 1, identical existing 0; other indices unresolved' };
    report(imported);
    report(imported);
    const state = useBhavcopyStore.getState();
    expect(state.runSummary).toEqual({ successCount: 2, skippedCount: 0, failedCount: 1, partialCount: 0, totalRowsInserted: 1, completedCount: 3, calendarSkipCount: 0 });
    expect(state.logs).toHaveLength(3);
    expect(state.logs.some((log) => log.message.includes('Archive date mismatch'))).toBe(true);
    expect(state.logs.some((log) => log.message.includes('other indices unresolved'))).toBe(true);
  });
  it('counts held NSE security rows as incomplete while preserving imports and real failures', () => {
    const report = useBhavcopyStore.getState().reportDownloadResult;
    const partial = { exchange: 'NSE', tradeDate: '2014-11-20', success: false,
      rowsInserted: 1530, message: 'Security subset: Imported 1530; blocked 2 conflicting rows' };
    report(partial);
    report(partial);
    report({ exchange: 'NSE', tradeDate: '2014-11-21', success: false,
      rowsInserted: 0, message: 'Security subset: No admitted daily security rows; blocked 2 rows' });
    report({ exchange: 'NSE', tradeDate: '2014-11-24', success: false,
      rowsInserted: 0, message: 'Network request failed' });
    const state = useBhavcopyStore.getState();
    expect(state.runSummary).toMatchObject({ partialCount: 2, failedCount: 1, totalRowsInserted: 1530, completedCount: 3 });
    expect(state.logs.filter((log) => log.level === 'incomplete')).toHaveLength(2);
    expect(state.logs.filter((log) => log.level === 'error')).toHaveLength(1);
  });

  it('keeps qualified auxiliary-row decisions visible on successful NSE imports', () => {
    useBhavcopyStore.getState().reportDownloadResult({ exchange: 'NSE', tradeDate: '2014-11-20', success: true,
      rowsInserted: 1534, message: 'Imported 1534; Security admission: kept 2 auxiliary-market rows out of daily prices' });
    expect(useBhavcopyStore.getState().logs[0].message).toContain('auxiliary-market');
    expect(useBhavcopyStore.getState().runSummary).toMatchObject({ successCount: 1, partialCount: 0, failedCount: 0 });
  });

  it('counts terminal jobs once, never source diagnostics or refresh warnings', () => {
    const state = useBhavcopyStore.getState();
    const archive = { exchange: 'NSE_INDEX', tradeDate: '2011-01-03 archive', success: false,
      rowsInserted: 0, message: 'HTTP 403', diagnostic: true, outcome: 'sourceError' as const };
    const final = { exchange: 'NSE_INDEX', tradeDate: '2011-01-03', success: true,
      rowsInserted: 1, message: 'Supported subset', outcome: 'partialCoverage' as const };
    const warning = { exchange: 'BHAVCOPY', tradeDate: 'chart-refresh', success: true,
      rowsInserted: 0, message: 'Prices retained; chart refresh failed', diagnostic: true, outcome: 'reportingWarning' as const };
    const calendar = { exchange: 'NSE', tradeDate: '2011-01-02', success: true,
      rowsInserted: 0, message: 'Weekend', outcome: 'calendarSkip' as const };
    [archive, final, final, warning, calendar].forEach(state.reportDownloadResult);
    expect(state.reconcileFinalResults([archive, final, warning, calendar])).toEqual({
      successCount: 0, skippedCount: 0, failedCount: 0, partialCount: 1,
      totalRowsInserted: 1, completedCount: 1, calendarSkipCount: 1,
    });
    expect(useBhavcopyStore.getState().logs.some((log) => log.level === 'warning' && log.message.includes('chart refresh failed'))).toBe(true);
  });
});
