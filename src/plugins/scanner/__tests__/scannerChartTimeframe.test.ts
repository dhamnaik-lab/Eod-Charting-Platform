import { describe, expect, it } from 'vitest';
import { buildScannerTimeframeBars } from '../scannerChartTimeframe';
import type { WorkspaceTimeframe } from '@/features/workspace/workspacePersistence';

const dates = ['2026-01-29','2026-01-30','2026-02-02','2026-04-01','2027-01-04'];
const bars = dates.map((date, i) => ({ date, timestamp:Date.parse(date), open:100+i*10,
  high:110+i*10, low:90+i*10, close:105+i*10, volume:(i+1)*10 }));

describe('active-chart scanner timeframe bars', () => {
  it.each([
    ['D',5,'2026-01-29',110,105,10],
    ['W',4,'2026-01-29',120,115,30],
    ['M',4,'2026-01-31',120,115,30],
    ['Q',3,'2026-Q1',130,125,60],
    ['Y',2,'2026-01-01',140,135,100],
  ] as const)('uses actual %s calendar OHLCV buckets and chart labels', (timeframe,count,date,high,close,volume) => {
    const result = buildScannerTimeframeBars('ABC', bars, timeframe as WorkspaceTimeframe);
    expect(result).toHaveLength(count);
    expect(result[0]).toEqual({ symbol:'ABC',date,open:100,high,low:90,close,volume });
    expect(bars[0].date).toBe('2026-01-29');
  });
});
