import { describe, expect, it } from 'vitest';
import { bseHistoryRequest, localDownloadDate } from '../bseHistoryDownload';

describe('manual BSE security-wise history requests', () => {
  it('keeps explicit codes and date bounds without guessing symbols', () => {
    expect(bseHistoryRequest('range', '1995-01-01', '1995-01-31', 'selected', '500325, 500002;500325')).toEqual({
      startDate: '1995-01-01', endDate: '1995-01-31', scope: 'selected', codes: ['500325', '500002'],
    });
    expect(() => bseHistoryRequest('range', '1995-01-01', '1995-01-31', 'selected', 'RELIANCE')).toThrow('six-digit');
    expect(() => bseHistoryRequest('range', '1995-01-31', '1995-01-01', 'selected', '500325')).toThrow('ascending');
  });
  it('rejects Update and does not apply typed codes to known-code scope', () => {
    expect(() => bseHistoryRequest('update', '1995-01-01', '1995-01-31', 'selected', '500325')).toThrow('Date Range');
    expect(bseHistoryRequest('range', '1995-01-01', '1995-01-31', 'known', 'ignored')).toEqual({
      startDate: '1995-01-01', endDate: '1995-01-31', scope: 'known', codes: [],
    });
  });
  it('resolves Full History independently of stale manual dates and uses the local calendar day', () => {
    expect(bseHistoryRequest('fullHistory', '2026-10-26', '2026-10-26', 'selected', '500325', '2026-10-27')).toEqual({
      startDate: '1990-01-01', endDate: '2026-10-27', scope: 'selected', codes: ['500325'],
    });
    expect(localDownloadDate(new Date(2026, 9, 27, 0, 1))).toBe('2026-10-27');
  });
});
