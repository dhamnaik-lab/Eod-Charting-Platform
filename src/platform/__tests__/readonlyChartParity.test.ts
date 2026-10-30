import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeBinaryEodBars } from '../binaryEodDecoder';
import type { EodRow } from '../types';

const evidence = process.env.EOD_CHART_PARITY_EVIDENCE;
describe.skipIf(!evidence)('read-only selected database transport parity', () => {
  it('decodes all direct JSON dates and values without missing, extra or changed bars', () => {
    const capture = JSON.parse(readFileSync(evidence!, 'utf8')) as {
      captures: { adjusted: boolean; barCount: number; barsB64: string; directBars: EodRow[] }[];
    };
    for (const run of capture.captures) {
      const decoded = decodeBinaryEodBars(run.barsB64, run.barCount);
      expect(decoded.length).toBe(run.directBars.length);
      run.directBars.forEach((direct, index) => {
        const row = decoded[index];
        expect(row).toMatchObject({ date: direct.date, open: direct.open, high: direct.high,
          low: direct.low, close: direct.close, volume: direct.volume });
        expect(row.prevClose ?? null).toBe(direct.prevClose ?? null);
      });
      console.log(`READONLY_PARITY_PASS adjusted=${run.adjusted} count=${decoded.length} first=${decoded[0]?.date} last=${decoded.at(-1)?.date}`);
    }
  });
});
