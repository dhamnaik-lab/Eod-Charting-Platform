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
    expect(state.runSummary).toEqual({ successCount: 2, skippedCount: 0, failedCount: 1, partialCount: 0, totalRowsInserted: 1, completedCount: 3 });
    expect(state.logs).toHaveLength(3);
    expect(state.logs.some((log) => log.message.includes('Archive date mismatch'))).toBe(true);
    expect(state.logs.some((log) => log.message.includes('other indices unresolved'))).toBe(true);
  });
});
