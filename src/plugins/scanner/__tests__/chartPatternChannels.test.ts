import { describe, expect, it } from 'vitest';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '../chartPatternScanners';
import type { EodBar } from '../types';

function scan(direction: 'rising' | 'falling', upperSlope: number, lowerSlope: number, width = 40, waveSize = 4) {
  const bars: EodBar[] = Array.from({ length:36 }, (_, index) => {
    const wave = Math.sin(index * Math.PI / 4) * waveSize;
    const high = 150 + upperSlope * index + wave;
    const low = 150 - width + lowerSlope * index + wave;
    const center = (high + low) / 2;
    return { symbol:'ABC', date:new Date(Date.UTC(2026,0,index+1)).toISOString().slice(0,10),
      open:center-0.5, high, low, close:center+0.5, volume:100000 };
  });
  const id = `chart_${direction}_channel`;
  return runChartPatternScanner({ symbol:'ABC', exchange:'NSE', bars }, chartPatternScannerDefinitions.find(d => d.id === id)!);
}

describe('channel boundary quality', () => {
  it.each(['rising','falling'] as const)('retains a genuinely parallel %s channel', direction => {
    const slope = direction === 'rising' ? 0.8 : -0.8;
    expect(scan(direction,slope,slope)?.matched).toBe(true);
  });

  it.each(['rising','falling'] as const)('rejects strongly unequal %s boundary slopes', direction => {
    const sign = direction === 'rising' ? 1 : -1;
    expect(scan(direction,sign*1.6,sign*0.8)).toBeNull();
  });

  it.each(['rising','falling'] as const)('rejects a narrowing %s wedge even when both slopes have the same sign', direction => {
    const upper = direction === 'rising' ? 0.8 : -1;
    const lower = direction === 'rising' ? 1 : -0.8;
    expect(scan(direction,upper,lower,10)).toBeNull();
  });

  it.each(['rising','falling'] as const)('allows small %s rail noise without requiring exact equality', direction => {
    const sign = direction === 'rising' ? 1 : -1;
    expect(scan(direction,sign*0.84,sign*0.8)?.matched).toBe(true);
  });

  it.each(['rising','falling'] as const)('rejects excessive %s width drift even with very similar slopes', direction => {
    const upper = direction === 'rising' ? 1 : -1.1;
    const lower = direction === 'rising' ? 1.1 : -1;
    // Narrow pivot rails drift by over 25%; larger waves would widen the rails
    // enough that this same slope difference remains a valid noisy channel.
    expect(scan(direction,upper,lower,5,2)).toBeNull();
  });

  it('rejects channels when middle bars break far outside the parallel rails (< 80% containment)', () => {
    const bars: EodBar[] = Array.from({ length: 36 }, (_, index) => {
      const wave = Math.sin(index * Math.PI / 4) * 4;
      let high = 150 + 0.8 * index + wave;
      let low = 130 + 0.8 * index + wave;
      if (index >= 18 && index <= 24) {
        high += 35;
        low -= 35;
      }
      const center = (high + low) / 2;
      return {
        symbol: 'ABC',
        date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10),
        open: center - 0.5,
        high,
        low,
        close: center + 0.5,
        volume: 100000,
      };
    });
    const def = chartPatternScannerDefinitions.find(d => d.id === 'chart_rising_channel')!;
    expect(runChartPatternScanner({ symbol: 'ABC', exchange: 'NSE', bars }, def)).toBeNull();
  });
});
