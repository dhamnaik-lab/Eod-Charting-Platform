import { describe, expect, it } from 'vitest';
import { decodeBinaryEodBars, encodeBinaryEodBars } from '../binaryEodDecoder';

describe('Phase 5C Binary EOD IPC Decoder', () => {
  it('round-trips 64-byte little-endian binary bars losslessly with optional prevClose', () => {
    const sample = [
      {
        date: '2026-08-14',
        open: 1240.5,
        high: 1255.75,
        low: 1232.25,
        close: 1250.0,
        prevClose: 1238.0,
        volume: 450000,
      },
      {
        date: '2026-08-17',
        open: 1252.0,
        high: 1260.0,
        low: 1248.0,
        close: 1258.5,
        volume: 380000,
      },
    ];
    const b64 = encodeBinaryEodBars(sample);
    const decoded = decodeBinaryEodBars(b64, sample.length);
    expect(decoded).toEqual(sample);
    expect(decoded[1]?.prevClose).toBeUndefined();
  });
});