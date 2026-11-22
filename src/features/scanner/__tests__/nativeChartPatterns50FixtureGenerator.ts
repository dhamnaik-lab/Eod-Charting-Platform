import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RUST_SCANNER_CONTRACT_VERSION,
  evaluateRustScannerContractRequestV1,
  type RustScannerEvaluationRequestV1,
  type RustScannerEvaluationResponseV1,
} from '@/features/scanner/rustScannerContract';
import { chartPatternScannerDefinitions } from '@/features/chartPatterns';
import { NATIVE_SUPPORTED_PATTERN_IDS } from '@/features/scanner/nativeScanContract';
import type { EodBar, ScannerRunTarget } from '@/plugins/scanner/types';

const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(CURRENT_DIR, '../fixtures/nativeChartPatterns50ParityFixtures.v1.json');

export const FIXED_GENERATED_AT_NSR3 = '2026-11-22T00:00:00.000Z';

const EXISTING_NATIVE_GAP_IDS = new Set([
  'chart_common_gap',
  'chart_breakaway_gap',
  'chart_runaway_gap',
  'chart_exhaustion_gap',
]);

export interface PatternCoverageManifestEntryV1 {
  patternId: string;
  scannerName: string;
  categoryId: string;
  family: string;
  minBars: number;
  status: 'existing_native_gap' | 'migrated_nsr3';
  positiveCaseId: string;
  negativeCaseId: string;
  boundaryCaseId: string;
  geometryVerified: boolean;
}

export interface ChartPattern50ParityScenarioV1 {
  id: string;
  patternId: string;
  category: 'positive' | 'negative' | 'boundary' | 'historical' | 'extra';
  description: string;
  request: RustScannerEvaluationRequestV1;
  response: RustScannerEvaluationResponseV1;
}

export interface ChartPattern50ParityBundleV1 {
  contractVersion: typeof RUST_SCANNER_CONTRACT_VERSION;
  fixedGeneratedAt: string;
  totalPatternCount: number;
  migratedPatternCount: number;
  manifest: PatternCoverageManifestEntryV1[];
  scenarios: ChartPattern50ParityScenarioV1[];
}

function sequentialDates(count: number, startIso = '2026-01-01'): string[] {
  const start = new Date(`${startIso}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, idx) => {
    const dt = new Date(start.getTime() + idx * 86_400_000);
    return dt.toISOString().slice(0, 10);
  });
}

function mkBars(
  symbol: string,
  tuples: ReadonlyArray<[number, number, number, number] | [number, number, number, number, number]>,
  startIso = '2026-01-01',
): EodBar[] {
  const dates = sequentialDates(tuples.length, startIso);
  return tuples.map((row, idx) => ({
    symbol,
    date: dates[idx]!,
    open: row[0],
    high: row[1],
    low: row[2],
    close: row[3],
    volume: row[4] ?? 100_000,
  }));
}

function rangeTuples(count: number): Array<[number, number, number, number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const d = i % 2;
    return [100 + d, 105 + d, 96, 101 + d, 100_000];
  });
}

function upTrendTuples(count: number): Array<[number, number, number, number, number]> {
  return Array.from({ length: count }, (_, i) => {
    const p = 100 + i;
    return [p, p + 4, p - 2, p + 3, 100_000];
  });
}

function bullPoleTuples(): Array<[number, number, number, number]> {
  return [
    [100, 103, 99, 101],
    [102, 106, 101, 105],
    [106, 110, 105, 109],
    [110, 114, 109, 113],
    [114, 118, 113, 117],
    [118, 122, 117, 121],
    [121, 124, 120, 123],
  ];
}

function bearPoleTuples(): Array<[number, number, number, number]> {
  return [
    [110, 112, 107, 109],
    [108, 109, 103, 104],
    [103, 104, 99, 100],
    [99, 100, 95, 96],
    [95, 96, 91, 92],
    [91, 92, 88, 89],
    [89, 90, 86, 87],
  ];
}

function bumpRunBottomTuples(): Array<[number, number, number, number]> {
  const closes = [
    120, 116, 112, 108, 104, 100, 96, 88, 80, 72, 64, 56, 48, 40, 44, 50, 56, 62, 68,
  ];
  return closes.map((c) => [c + 2, c + 4, c - 4, c]);
}

function bumpRunTopTuples(): Array<[number, number, number, number]> {
  const closes = [
    80, 84, 88, 92, 96, 100, 104, 112, 120, 128, 136, 144, 152, 160, 156, 150, 144, 138, 132,
  ];
  return closes.map((c) => [c - 2, c + 4, c - 4, c]);
}

function fallingWedgeTuples(): Array<[number, number, number, number]> {
  return Array.from({ length: 17 }, (_, i) => {
    const high = 120 - i * 1.25;
    const low = 96 - i * 0.5;
    return [high - 6, high, low, low + 5];
  });
}

function risingWedgeTuples(): Array<[number, number, number, number]> {
  return Array.from({ length: 17 }, (_, i) => {
    const high = 100 + i * 1.25;
    const low = 76 + i * 2.6;
    return [low + 1, high, low, high - 1];
  });
}

function diamondTuples(): Array<[number, number, number, number]> {
  return [
    [102, 108, 92, 100],
    [104, 110, 91, 102],
    [106, 112, 90, 104],
    [105, 111, 91, 103],
    [104, 109, 92, 102],
    [103, 108, 94, 102],
    [105, 116, 88, 110],
    [110, 122, 82, 116],
    [116, 130, 76, 122],
    [122, 128, 80, 118],
    [118, 124, 84, 114],
    [114, 118, 88, 110],
    [110, 120, 94, 116],
    [116, 118, 96, 112],
    [112, 116, 98, 108],
    [108, 114, 100, 106],
    [106, 112, 102, 106],
    [106, 110, 104, 107],
  ];
}

function broadeningTuples(): Array<[number, number, number, number]> {
  return Array.from({ length: 17 }, (_, i) => {
    const high = 105 + i;
    const low = 95 - i;
    const close = (high + low) / 2;
    return [close - 1, high, low, close];
  });
}

function channelTuples(direction: 'rising' | 'falling'): Array<[number, number, number, number]> {
  return Array.from({ length: 36 }, (_, i) => {
    const trend = direction === 'rising' ? 100 + i * 0.8 : 130 - i * 0.8;
    const wave = Math.sin((i * Math.PI) / 4) * 4;
    const open = trend + wave - 1;
    const close = trend + wave + 1;
    return [open, Math.max(open, close) + 4, Math.min(open, close) - 4, close];
  });
}

interface PatternSpecFixture {
  minBars: number;
  target: ScannerRunTarget;
  positive: EodBar[];
  negative: EodBar[];
}

function flipLastBarClose(bars: EodBar[], delta: number): EodBar[] {
  const next = bars.map((b) => ({ ...b }));
  const last = next[next.length - 1]!;
  last.close += delta;
  last.open = last.close - delta * 0.5;
  last.high = Math.max(last.high, last.open, last.close);
  last.low = Math.min(last.low, last.open, last.close);
  return next;
}

function buildFixturesByPattern(): Record<string, PatternSpecFixture> {
  const nseTarget = (symbol: string): ScannerRunTarget => ({ exchange: 'NSE', symbol });
  const bseTarget = (symbol: string): ScannerRunTarget => ({ exchange: 'BSE', symbol });

  const symTriPositive = mkBars('SYMT', [
    [106, 115, 100, 108],
    [110, 118, 96, 116],
    [116, 120, 94, 112],
    [110, 116, 92, 96],
    [96, 114, 90, 104],
    [104, 113, 94, 110],
    [110, 116, 96, 112],
    [108, 114, 95, 100],
    [100, 112, 94, 106],
    [106, 110, 96, 108],
    [108, 113, 98, 111],
    [109, 110, 99, 104],
    [104, 108, 98, 105],
    [114, 116, 112, 115],
  ]);

  const rectPositive = mkBars('RECT', [
    ...Array.from({ length: 20 }, (_, i): [number, number, number, number] => [
      104,
      i % 5 === 0 ? 110 : 106 + (i % 3),
      i % 4 === 0 ? 100 : 101 + (i % 2),
      105,
    ]),
    [105, 108, 102, 106],
  ]);

  const coilPositive = mkBars('COIL', [
    [100, 112, 92, 104],
    [103, 111, 93, 105],
    [104, 110, 95, 106],
    [105, 109, 97, 106],
    [106, 109, 99, 107],
    [107, 110, 102, 108],
    [108, 110, 104, 109],
    [109, 111, 106, 110],
    [110, 111, 107, 109],
  ]);

  return {
    // 4 existing gaps (manifest reference)
    chart_common_gap: {
      minBars: 12,
      target: nseTarget('CGAP'),
      positive: mkBars('CGAP', [...rangeTuples(10), [102, 105, 98, 101, 100_000], [106, 108, 104, 105, 105_000]]),
      negative: mkBars('CGAP', [...rangeTuples(10), [102, 105, 98, 101, 100_000], [103, 108, 102, 105, 105_000]]),
    },
    chart_breakaway_gap: {
      minBars: 22,
      target: nseTarget('BGAP'),
      positive: mkBars('BGAP', [
        ...Array.from({ length: 20 }, () => [100, 110, 95, 104, 100_000] as [number, number, number, number, number]),
        [103, 110, 99, 105, 100_000],
        [116, 121, 115, 120, 180_000],
      ]),
      negative: mkBars('BGAP', [
        ...Array.from({ length: 20 }, () => [100, 110, 95, 104, 100_000] as [number, number, number, number, number]),
        [103, 110, 99, 105, 100_000],
        [116, 121, 115, 120, 110_000],
      ]),
    },
    chart_runaway_gap: {
      minBars: 22,
      target: nseTarget('RGAP'),
      positive: mkBars('RGAP', [...upTrendTuples(20), [122, 125, 121, 124, 100_000], [127, 132, 126, 131, 130_000]]),
      negative: mkBars('RGAP', [...upTrendTuples(20), [122, 125, 121, 124, 100_000], [124, 132, 123, 131, 130_000]]),
    },
    chart_exhaustion_gap: {
      minBars: 22,
      target: nseTarget('EGAP'),
      positive: mkBars('EGAP', [...upTrendTuples(20), [130, 134, 128, 133, 100_000], [138, 142, 132, 134, 250_000]]),
      negative: mkBars('EGAP', [...upTrendTuples(20), [130, 134, 128, 133, 100_000], [138, 142, 132, 140, 250_000]]),
    },

    // A. Island Reversals (2)
    chart_island_reversal_top: {
      minBars: 5,
      target: nseTarget('ISLT'),
      positive: mkBars('ISLT', [[100, 105, 98, 103], [108, 112, 107, 111], [110, 113, 108, 111], [109, 112, 107, 108], [104, 105, 98, 99]]),
      negative: mkBars('ISLT', [[100, 105, 98, 103], [108, 112, 107, 111], [110, 113, 108, 111], [109, 112, 107, 108], [108, 112, 106, 110]]),
    },
    chart_island_reversal_bottom: {
      minBars: 5,
      target: bseTarget('500112'),
      positive: mkBars('500112', [[100, 104, 96, 98], [92, 93, 88, 89], [90, 92, 86, 88], [89, 93, 87, 91], [96, 102, 95, 101]]),
      negative: mkBars('500112', [[100, 104, 96, 98], [92, 93, 88, 89], [90, 92, 86, 88], [89, 93, 87, 91], [91, 95, 89, 92]]),
    },

    // B. Reversals (11)
    chart_double_bottom: {
      minBars: 12,
      target: nseTarget('DBOT'),
      positive: mkBars('DBOT', [
        [122, 124, 118, 120], [118, 120, 112, 114], [114, 116, 108, 110], [110, 112, 96, 100],
        [100, 102, 92, 96], [95, 98, 90, 93], [94, 101, 92, 100], [100, 106, 98, 104],
        [104, 108, 101, 106], [105, 107, 98, 100], [100, 103, 94, 96], [96, 99, 91, 94],
        [95, 101, 93, 100], [100, 105, 98, 103], [103, 107, 101, 106], [107, 111, 106, 110],
      ]),
      negative: mkBars('DBOT', [
        [122, 124, 118, 120], [118, 120, 112, 114], [114, 116, 108, 110], [110, 112, 96, 100],
        [100, 102, 92, 96], [95, 98, 90, 93], [94, 101, 92, 100], [100, 106, 98, 104],
        [104, 108, 101, 106], [105, 107, 98, 100], [100, 103, 94, 96], [96, 99, 91, 94],
        [95, 101, 93, 100], [100, 105, 98, 103], [103, 107, 101, 106], [106, 108, 103, 105],
      ]),
    },
    chart_double_top: {
      minBars: 12,
      target: nseTarget('DTOP'),
      positive: mkBars('DTOP', [
        [80, 83, 78, 82], [83, 88, 82, 87], [88, 93, 87, 92], [92, 98, 90, 96],
        [96, 104, 95, 102], [102, 110, 100, 107], [106, 108, 99, 101], [101, 104, 94, 96],
        [96, 100, 93, 97], [98, 105, 96, 103], [103, 109, 101, 106], [106, 111, 104, 108],
        [107, 108, 99, 101], [100, 103, 95, 97], [96, 98, 91, 92],
      ]),
      negative: mkBars('DTOP', [
        [80, 83, 78, 82], [83, 88, 82, 87], [88, 93, 87, 92], [92, 98, 90, 96],
        [96, 104, 95, 102], [102, 110, 100, 107], [106, 108, 99, 101], [101, 104, 94, 96],
        [96, 100, 93, 97], [98, 105, 96, 103], [103, 109, 101, 106], [106, 111, 104, 108],
        [107, 108, 99, 101], [100, 103, 95, 97], [96, 98, 94, 96],
      ]),
    },
    chart_triple_bottom: {
      minBars: 12,
      target: nseTarget('TBOT'),
      positive: mkBars('TBOT', [
        [130, 132, 126, 128], [124, 126, 116, 118], [118, 121, 106, 110], [110, 114, 98, 102],
        [101, 104, 90, 95], [96, 108, 94, 106], [106, 112, 101, 110], [109, 111, 98, 100],
        [100, 103, 91, 95], [96, 108, 94, 106], [106, 113, 102, 111], [110, 112, 99, 101],
        [101, 104, 92, 96], [97, 109, 95, 107], [108, 112, 103, 109], [109, 113, 105, 111],
        [112, 116, 110, 115],
      ]),
      negative: mkBars('TBOT', [
        [130, 132, 126, 128], [124, 126, 116, 118], [118, 121, 106, 110], [110, 114, 98, 102],
        [101, 104, 90, 95], [96, 108, 94, 106], [106, 112, 101, 110], [109, 111, 98, 100],
        [100, 103, 91, 95], [96, 108, 94, 106], [106, 113, 102, 111], [110, 112, 99, 101],
        [101, 104, 92, 96], [97, 109, 95, 107], [108, 112, 103, 109], [109, 113, 105, 111],
        [111, 113, 108, 110],
      ]),
    },
    chart_triple_top: {
      minBars: 12,
      target: nseTarget('TTOP'),
      positive: mkBars('TTOP', [
        [70, 74, 68, 72], [74, 82, 73, 80], [80, 92, 78, 90], [90, 104, 88, 101],
        [101, 112, 99, 108], [107, 109, 96, 98], [98, 102, 91, 93], [94, 104, 93, 102],
        [102, 111, 100, 108], [108, 110, 96, 99], [99, 103, 90, 92], [93, 104, 92, 102],
        [102, 113, 100, 109], [108, 110, 95, 98], [98, 102, 94, 99], [99, 101, 93, 97],
        [96, 99, 87, 88],
      ]),
      negative: mkBars('TTOP', [
        [70, 74, 68, 72], [74, 82, 73, 80], [80, 92, 78, 90], [90, 104, 88, 101],
        [101, 112, 99, 108], [107, 109, 96, 98], [98, 102, 91, 93], [94, 104, 93, 102],
        [102, 111, 100, 108], [108, 110, 96, 99], [99, 103, 90, 92], [93, 104, 92, 102],
        [102, 113, 100, 109], [108, 110, 95, 98], [98, 102, 94, 99], [99, 101, 93, 97],
        [96, 99, 93, 95],
      ]),
    },
    chart_v_bottom: {
      minBars: 15,
      target: nseTarget('VBOT'),
      positive: mkBars('VBOT', [
        [130, 132, 126, 128], [126, 128, 122, 124], [120, 122, 118, 120], [116, 118, 112, 114],
        [112, 114, 108, 110], [108, 110, 104, 106], [104, 106, 100, 102], [100, 102, 96, 98],
        [96, 98, 92, 94], [94, 96, 88, 90], [91, 94, 84, 86], [87, 91, 82, 84],
        [84, 88, 78, 80], [82, 89, 76, 87], [88, 96, 86, 95],
      ]),
      negative: mkBars('VBOT', [
        [130, 132, 126, 128], [126, 128, 122, 124], [120, 122, 118, 120], [116, 118, 112, 114],
        [112, 114, 108, 110], [108, 110, 104, 106], [104, 106, 100, 102], [100, 102, 96, 98],
        [96, 98, 92, 94], [94, 96, 88, 90], [91, 94, 84, 86], [87, 91, 82, 84],
        [84, 88, 78, 80], [82, 89, 76, 87], [87, 90, 84, 88],
      ]),
    },
    chart_spike_top: {
      minBars: 15,
      target: nseTarget('STOP'),
      positive: mkBars('STOP', [
        [70, 73, 68, 70], [74, 77, 72, 75], [80, 83, 78, 80], [84, 87, 82, 85],
        [88, 91, 86, 90], [92, 96, 90, 94], [96, 100, 94, 98], [100, 104, 98, 102],
        [104, 108, 102, 106], [108, 112, 106, 110], [112, 118, 110, 116], [118, 126, 116, 124],
        [124, 132, 122, 130], [128, 134, 120, 122], [118, 119, 108, 110],
      ]),
      negative: mkBars('STOP', [
        [70, 73, 68, 70], [74, 77, 72, 75], [80, 83, 78, 80], [84, 87, 82, 85],
        [88, 91, 86, 90], [92, 96, 90, 94], [96, 100, 94, 98], [100, 104, 98, 102],
        [104, 108, 102, 106], [108, 112, 106, 110], [112, 118, 110, 116], [118, 126, 116, 124],
        [124, 132, 122, 130], [128, 134, 120, 122], [122, 125, 118, 123],
      ]),
    },
    chart_horn_bottom: {
      minBars: 12,
      target: nseTarget('HBOT'),
      positive: mkBars('HBOT', [
        [128, 130, 124, 126], [124, 126, 120, 122], [120, 122, 116, 118], [116, 118, 110, 112],
        [112, 114, 98, 104], [105, 111, 102, 110], [110, 115, 106, 113], [112, 114, 104, 106],
        [106, 109, 99, 102], [106, 112, 97, 108], [100, 110, 98, 108], [108, 113, 104, 111],
        [114, 119, 112, 118],
      ]),
      negative: mkBars('HBOT', [
        [128, 130, 124, 126], [124, 126, 120, 122], [120, 122, 116, 118], [116, 118, 110, 112],
        [112, 114, 98, 104], [105, 111, 102, 110], [110, 115, 106, 113], [112, 114, 104, 106],
        [106, 109, 99, 102], [106, 112, 97, 108], [100, 110, 98, 108], [108, 113, 104, 111],
        [112, 115, 109, 113],
      ]),
    },
    chart_horn_top: {
      minBars: 12,
      target: nseTarget('HTOP'),
      positive: mkBars('HTOP', [
        [70, 74, 68, 72], [74, 78, 72, 76], [80, 84, 78, 82], [84, 92, 83, 90],
        [90, 106, 88, 100], [98, 101, 92, 94], [94, 98, 89, 91], [92, 101, 91, 99],
        [99, 109, 96, 104], [104, 106, 98, 100], [100, 103, 94, 97], [96, 101, 84, 86],
      ]),
      negative: mkBars('HTOP', [
        [70, 74, 68, 72], [74, 78, 72, 76], [80, 84, 78, 82], [84, 92, 83, 90],
        [90, 106, 88, 100], [98, 101, 92, 94], [94, 98, 89, 91], [92, 101, 91, 99],
        [99, 109, 96, 104], [104, 106, 98, 100], [100, 103, 94, 97], [96, 101, 92, 95],
      ]),
    },
    chart_bump_run_bottom: {
      minBars: 20,
      target: nseTarget('BRBOT'),
      positive: mkBars('BRBOT', [...bumpRunBottomTuples(), [68, 78, 66, 76]]),
      negative: mkBars('BRBOT', [...bumpRunBottomTuples(), [68, 70, 62, 65]]),
    },
    chart_bump_run_top: {
      minBars: 20,
      target: nseTarget('BRTOP'),
      positive: mkBars('BRTOP', [...bumpRunTopTuples(), [132, 134, 122, 124]]),
      negative: mkBars('BRTOP', [...bumpRunTopTuples(), [132, 138, 130, 135]]),
    },
    chart_blow_off_top: {
      minBars: 16,
      target: nseTarget('BLOW'),
      positive: mkBars('BLOW', [
        ...Array.from({ length: 15 }, (_, i): [number, number, number, number, number] => {
          const p = 100 + i * 2;
          return [p, p + 5, p - 2, p + 4, 100_000];
        }),
        [132, 145, 118, 120, 260_000],
      ]),
      negative: mkBars('BLOW', [
        ...Array.from({ length: 15 }, (_, i): [number, number, number, number, number] => {
          const p = 100 + i * 2;
          return [p, p + 5, p - 2, p + 4, 100_000];
        }),
        [132, 145, 118, 120, 110_000],
      ]),
    },

    // C. Structures & Continuations (27)
    chart_rectangle_range: {
      minBars: 21,
      target: bseTarget('500325'),
      positive: mkBars('500325', rectPositive.map((b) => [b.open, b.high, b.low, b.close, b.volume])),
      negative: flipLastBarClose(rectPositive, 12),
    },
    chart_ascending_triangle: {
      minBars: 13,
      target: nseTarget('ATRI'),
      positive: mkBars('ATRI', [
        [102, 105, 100, 103], [101, 104, 98, 100], [96, 102, 94, 98], [100, 106, 97, 104],
        [104, 110, 101, 108], [103, 108, 100, 104], [101, 106, 99, 102], [99, 105, 97, 101],
        [104, 108, 100, 106], [106, 110, 102, 109], [104, 107, 101, 103], [102, 106, 100, 102],
        [101, 105, 98.5, 103], [105, 109, 102, 107], [107, 110, 104, 109], [112, 114, 110, 113],
      ]),
      negative: mkBars('ATRI', [
        [102, 105, 100, 103], [101, 104, 98, 100], [96, 102, 94, 98], [100, 106, 97, 104],
        [104, 110, 101, 108], [103, 108, 100, 104], [101, 106, 99, 102], [99, 105, 97, 101],
        [104, 108, 100, 106], [106, 110, 102, 109], [104, 107, 101, 103], [102, 106, 100, 102],
        [101, 105, 98.5, 103], [105, 109, 102, 107], [107, 110, 104, 109], [108, 110, 106, 109],
      ]),
    },
    chart_descending_triangle: {
      minBars: 13,
      target: nseTarget('DTRI'),
      positive: mkBars('DTRI', [
        [108, 110, 100, 106], [111, 114, 100, 112], [113, 116, 103, 115], [109, 112, 100, 104],
        [106, 110, 100, 103], [108, 112, 101, 111], [107, 111, 100, 103], [105, 109, 100, 102],
        [104, 108, 101, 107], [104, 107, 100, 102], [103, 106, 100, 102], [102, 105, 101, 104],
        [101, 104, 100, 101], [99, 101, 96, 97],
      ]),
      negative: mkBars('DTRI', [
        [108, 110, 100, 106], [111, 114, 100, 112], [113, 116, 103, 115], [109, 112, 100, 104],
        [106, 110, 100, 103], [108, 112, 101, 111], [107, 111, 100, 103], [105, 109, 100, 102],
        [104, 108, 101, 107], [104, 107, 100, 102], [103, 106, 100, 102], [102, 105, 101, 104],
        [101, 104, 100, 101], [101, 103, 100, 102],
      ]),
    },
    chart_symmetrical_triangle: {
      minBars: 12,
      target: nseTarget('SYMT'),
      positive: symTriPositive,
      negative: flipLastBarClose(symTriPositive, -9),
    },
    chart_falling_wedge_bottom: {
      minBars: 14,
      target: nseTarget('FWED'),
      positive: mkBars('FWED', [...fallingWedgeTuples(), [102, 108, 100, 106]]),
      negative: mkBars('FWED', [...fallingWedgeTuples(), [95, 97, 92, 94]]),
    },
    chart_rising_wedge_top: {
      minBars: 14,
      target: nseTarget('RWED'),
      positive: mkBars('RWED', [...risingWedgeTuples(), [106, 108, 102, 104]]),
      negative: mkBars('RWED', [...risingWedgeTuples(), [118, 122, 116, 121]]),
    },
    chart_diamond_bottom: {
      minBars: 19,
      target: nseTarget('DBMD'),
      positive: mkBars('DBMD', [...diamondTuples(), [121, 126, 118, 124]]),
      negative: mkBars('DBMD', [...diamondTuples(), [108, 112, 104, 108]]),
    },
    chart_diamond_top: {
      minBars: 19,
      target: nseTarget('DTP'),
      positive: mkBars('DTP', [...diamondTuples(), [94, 96, 88, 90]]),
      negative: mkBars('DTP', [...diamondTuples(), [108, 112, 104, 108]]),
    },
    chart_diamond_pattern: {
      minBars: 19,
      target: nseTarget('DPAT'),
      positive: mkBars('DPAT', [...diamondTuples(), [108, 112, 104, 108]]),
      negative: mkBars('DPAT', [...diamondTuples(), [121, 126, 118, 124]]),
    },
    chart_broadening_bottom: {
      minBars: 14,
      target: nseTarget('BBOT'),
      positive: mkBars('BBOT', [...broadeningTuples(), [120, 126, 116, 124]]),
      negative: mkBars('BBOT', [...broadeningTuples(), [98, 104, 92, 100]]),
    },
    chart_broadening_formation: {
      minBars: 14,
      target: nseTarget('BFRM'),
      positive: mkBars('BFRM', [...broadeningTuples(), [98, 104, 92, 100]]),
      negative: mkBars('BFRM', [...broadeningTuples(), [125, 128, 123, 127]]),
    },
    chart_rising_three_methods: {
      minBars: 5,
      target: nseTarget('R3M'),
      positive: mkBars('R3M', [[100, 116, 98, 114], [113, 115, 108, 110], [110, 113, 106, 108], [108, 112, 105, 109], [112, 120, 111, 118]]),
      negative: mkBars('R3M', [[100, 116, 98, 114], [113, 115, 108, 110], [110, 113, 106, 108], [108, 112, 105, 109], [112, 115, 110, 113]]),
    },
    chart_falling_three_methods: {
      minBars: 5,
      target: nseTarget('F3M'),
      positive: mkBars('F3M', [[120, 122, 104, 106], [107, 114, 106, 112], [112, 116, 108, 114], [114, 118, 110, 112], [110, 111, 100, 102]]),
      negative: mkBars('F3M', [[120, 122, 104, 106], [107, 114, 106, 112], [112, 116, 108, 114], [114, 118, 110, 112], [110, 111, 106, 108]]),
    },
    chart_mat_hold_bullish: {
      minBars: 5,
      target: nseTarget('MHB'),
      positive: mkBars('MHB', [[100, 116, 98, 114], [113, 118, 102, 110], [110, 116, 103, 108], [108, 115, 104, 112], [116, 122, 115, 120]]),
      negative: mkBars('MHB', [[100, 116, 98, 114], [113, 118, 102, 110], [110, 116, 103, 108], [108, 115, 104, 112], [112, 116, 110, 114]]),
    },
    chart_mat_hold_bearish: {
      minBars: 5,
      target: nseTarget('MHR'),
      positive: mkBars('MHR', [[120, 122, 104, 106], [107, 118, 105, 112], [112, 117, 106, 110], [110, 116, 105, 108], [104, 105, 98, 100]]),
      negative: mkBars('MHR', [[120, 122, 104, 106], [107, 118, 105, 112], [112, 117, 106, 110], [110, 116, 105, 108], [107, 110, 105, 108]]),
    },
    chart_bull_flag: {
      minBars: 13,
      target: nseTarget('BFLG'),
      positive: mkBars('BFLG', [...bullPoleTuples(), [120, 122, 116, 118], [118, 120, 115, 117], [117, 119, 114, 116], [116, 118, 113, 115], [115, 117, 112, 114], [123, 126, 122, 125]]),
      negative: mkBars('BFLG', [...bullPoleTuples(), [120, 122, 116, 118], [118, 120, 115, 117], [117, 119, 114, 116], [116, 118, 113, 115], [115, 117, 112, 114], [115, 119, 114, 118]]),
    },
    chart_bear_flag: {
      minBars: 13,
      target: nseTarget('SFLG'),
      positive: mkBars('SFLG', [...bearPoleTuples(), [90, 94, 88, 92], [92, 95, 89, 93], [93, 96, 90, 94], [94, 97, 91, 95], [95, 98, 92, 96], [88, 89, 84, 85]]),
      negative: mkBars('SFLG', [...bearPoleTuples(), [90, 94, 88, 92], [92, 95, 89, 93], [93, 96, 90, 94], [94, 97, 91, 95], [95, 98, 92, 96], [92, 96, 90, 95]]),
    },
    chart_bull_pennant: {
      minBars: 13,
      target: nseTarget('BPEN'),
      positive: mkBars('BPEN', [...bullPoleTuples(), [120, 124, 115, 119], [118, 123, 116, 120], [119, 122, 117, 120], [120, 121, 118, 120], [120, 120.5, 119, 120], [124, 127, 123, 126]]),
      negative: mkBars('BPEN', [...bullPoleTuples(), [120, 124, 115, 119], [118, 123, 116, 120], [119, 122, 117, 120], [120, 121, 118, 120], [120, 120.5, 119, 120], [120, 122, 118, 121]]),
    },
    chart_bear_pennant: {
      minBars: 13,
      target: nseTarget('SPEN'),
      positive: mkBars('SPEN', [...bearPoleTuples(), [90, 96, 86, 91], [91, 95, 87, 90], [90, 94, 88, 90], [90, 93, 89, 90], [90, 92, 89.5, 90], [86, 87, 82, 83]]),
      negative: mkBars('SPEN', [...bearPoleTuples(), [90, 96, 86, 91], [91, 95, 87, 90], [90, 94, 88, 90], [90, 93, 89, 90], [90, 92, 89.5, 90], [90, 92, 88, 91]]),
    },
    chart_rising_channel: {
      minBars: 20,
      target: nseTarget('RCHN'),
      positive: mkBars('RCHN', channelTuples('rising')),
      negative: flipLastBarClose(mkBars('RCHN', channelTuples('rising')), -40),
    },
    chart_falling_channel: {
      minBars: 20,
      target: nseTarget('FCHN'),
      positive: mkBars('FCHN', channelTuples('falling')),
      negative: flipLastBarClose(mkBars('FCHN', channelTuples('falling')), 40),
    },
    chart_high_tight_flag: {
      minBars: 15,
      target: nseTarget('HTFG'),
      positive: mkBars('HTFG', [
        [100, 105, 98, 102], [105, 118, 104, 116], [118, 132, 117, 130], [132, 148, 130, 146],
        [148, 165, 146, 162], [164, 182, 162, 180], [181, 198, 178, 195], [196, 210, 190, 205],
        [204, 209, 196, 200], [199, 205, 190, 194], [193, 198, 180, 188], [187, 194, 172, 182],
        [181, 190, 160, 176], [178, 192, 170, 188], [194, 202, 190, 200],
      ]),
      negative: mkBars('HTFG', [
        [100, 105, 98, 102], [105, 118, 104, 116], [118, 132, 117, 130], [132, 148, 130, 146],
        [148, 165, 146, 162], [164, 182, 162, 180], [181, 198, 178, 195], [196, 210, 190, 205],
        [204, 209, 196, 200], [199, 205, 190, 194], [193, 198, 180, 188], [187, 194, 172, 182],
        [181, 190, 160, 176], [178, 192, 170, 188], [184, 189, 180, 186],
      ]),
    },
    chart_coil_volatility_squeeze: {
      minBars: 8,
      target: nseTarget('COIL'),
      positive: coilPositive,
      negative: flipLastBarClose(coilPositive, 8),
    },
    chart_three_rising_valleys: {
      minBars: 14,
      target: nseTarget('3RV'),
      positive: mkBars('3RV', [
        [120, 122, 116, 118], [116, 118, 108, 110], [110, 112, 98, 102], [103, 108, 100, 106],
        [107, 115, 104, 113], [112, 114, 105, 107], [108, 112, 102, 104], [105, 112, 103, 110],
        [111, 118, 108, 116], [115, 117, 110, 112], [112, 115, 106, 108], [109, 116, 107, 114],
        [116, 121, 114, 120], [118, 122, 115, 119], [123, 126, 122, 125],
      ]),
      negative: mkBars('3RV', [
        [120, 122, 116, 118], [116, 118, 108, 110], [110, 112, 98, 102], [103, 108, 100, 106],
        [107, 115, 104, 113], [112, 114, 105, 107], [108, 112, 102, 104], [105, 112, 103, 110],
        [111, 118, 108, 116], [115, 117, 110, 112], [112, 115, 106, 108], [109, 116, 107, 114],
        [116, 121, 114, 120], [118, 122, 115, 119], [114, 117, 112, 115],
      ]),
    },
    chart_three_falling_peaks: {
      minBars: 14,
      target: nseTarget('3FP'),
      positive: mkBars('3FP', [
        [80, 86, 78, 84], [84, 96, 82, 94], [94, 112, 92, 108], [106, 110, 100, 102],
        [101, 105, 94, 96], [97, 108, 95, 106], [105, 109, 99, 101], [100, 104, 92, 94],
        [95, 104, 93, 102], [101, 105, 96, 98], [97, 101, 90, 92], [92, 96, 88, 90],
        [89, 91, 82, 84], [84, 86, 78, 80],
      ]),
      negative: mkBars('3FP', [
        [80, 86, 78, 84], [84, 96, 82, 94], [94, 112, 92, 108], [106, 110, 100, 102],
        [101, 105, 94, 96], [97, 108, 95, 106], [105, 109, 99, 101], [100, 104, 92, 94],
        [95, 104, 93, 102], [101, 105, 96, 98], [97, 101, 90, 92], [92, 96, 88, 90],
        [89, 91, 82, 84], [92, 97, 91, 95],
      ]),
    },
    chart_measured_move_up: {
      minBars: 15,
      target: nseTarget('MMUP'),
      positive: mkBars('MMUP', [
        [100, 103, 99, 101], [102, 107, 101, 106], [106, 112, 105, 111], [111, 117, 110, 116], [116, 122, 115, 121],
        [120, 122, 116, 118], [118, 120, 114, 116], [116, 118, 113, 115], [115, 119, 114, 118], [118, 121, 117, 120],
        [121, 125, 120, 124], [124, 130, 123, 129], [129, 136, 128, 135], [135, 141, 134, 140], [140, 147, 139, 146],
      ]),
      negative: mkBars('MMUP', [
        [100, 103, 99, 101], [102, 107, 101, 106], [106, 112, 105, 111], [111, 117, 110, 116], [116, 122, 115, 121],
        [120, 122, 116, 118], [118, 120, 114, 116], [116, 118, 113, 115], [115, 119, 114, 118], [118, 121, 117, 120],
        [121, 125, 120, 124], [124, 130, 123, 129], [129, 136, 128, 135], [135, 141, 134, 140], [138, 140, 136, 137],
      ]),
    },
    chart_measured_move_down: {
      minBars: 15,
      target: nseTarget('MMDN'),
      positive: mkBars('MMDN', [
        [140, 142, 137, 139], [138, 139, 132, 133], [133, 134, 126, 127], [127, 128, 121, 122], [122, 123, 115, 116],
        [117, 122, 116, 120], [120, 124, 119, 123], [123, 126, 122, 124], [124, 125, 120, 122], [122, 123, 118, 119],
        [118, 119, 112, 113], [113, 114, 106, 107], [107, 108, 100, 101], [101, 102, 94, 95], [95, 96, 88, 89],
      ]),
      negative: mkBars('MMDN', [
        [140, 142, 137, 139], [138, 139, 132, 133], [133, 134, 126, 127], [127, 128, 121, 122], [122, 123, 115, 116],
        [117, 122, 116, 120], [120, 124, 119, 123], [123, 126, 122, 124], [124, 125, 120, 122], [122, 123, 118, 119],
        [118, 119, 112, 113], [113, 114, 106, 107], [107, 108, 100, 101], [101, 102, 94, 95], [95, 98, 94, 97],
      ]),
    },

    // D. Complex Bases (10)
    chart_head_shoulders: {
      minBars: 16,
      target: nseTarget('HNDS'),
      positive: mkBars('HNDS', [
        [88, 92, 86, 90], [90, 96, 88, 94], [94, 104, 92, 101], [101, 110, 99, 106],
        [105, 108, 96, 98], [98, 103, 92, 95], [96, 112, 95, 110], [110, 124, 108, 120],
        [118, 121, 104, 106], [106, 111, 94, 96], [98, 108, 96, 106], [106, 112, 102, 108],
        [104, 108, 98, 100], [100, 104, 96, 98], [98, 101, 93, 95], [94, 98, 89, 91],
      ]),
      negative: mkBars('HNDS', [
        [88, 92, 86, 90], [90, 96, 88, 94], [94, 104, 92, 101], [101, 110, 99, 106],
        [105, 108, 96, 98], [98, 103, 92, 95], [96, 112, 95, 110], [110, 124, 108, 120],
        [118, 121, 104, 106], [106, 111, 94, 96], [98, 108, 96, 106], [106, 112, 102, 108],
        [104, 108, 98, 100], [100, 104, 96, 98], [98, 101, 93, 95], [97, 101, 96, 99],
      ]),
    },
    chart_inverse_head_shoulders: {
      minBars: 16,
      target: nseTarget('IHNS'),
      positive: mkBars('IHNS', [
        [122, 124, 118, 120], [120, 122, 114, 116], [116, 118, 106, 109], [109, 111, 100, 104],
        [105, 118, 104, 116], [116, 121, 112, 119], [118, 120, 96, 100], [100, 102, 82, 86],
        [88, 103, 86, 101], [101, 113, 98, 111], [110, 112, 104, 106], [106, 108, 101, 103],
        [103, 108, 98, 104], [106, 116, 104, 114], [114, 119, 112, 117], [118, 124, 116, 122],
        [123, 128, 121, 126],
      ]),
      negative: mkBars('IHNS', [
        [122, 124, 118, 120], [120, 122, 114, 116], [116, 118, 106, 109], [109, 111, 100, 104],
        [105, 118, 104, 116], [116, 121, 112, 119], [118, 120, 96, 100], [100, 102, 82, 86],
        [88, 103, 86, 101], [101, 113, 98, 111], [110, 112, 104, 106], [106, 108, 101, 103],
        [103, 108, 98, 104], [106, 116, 104, 114], [114, 119, 112, 117], [118, 124, 116, 122],
        [92, 95, 88, 90],
      ]),
    },
    chart_complex_head_shoulders: {
      minBars: 22,
      target: nseTarget('CHNS'),
      positive: mkBars('CHNS', [
        [82, 88, 80, 86], [86, 92, 84, 90], [88, 94, 86, 92], [92, 100, 90, 96],
        [96, 108, 94, 104], [104, 112, 100, 106], [106, 106, 96, 100], [100, 104, 94, 98],
        [98, 115, 96, 110], [110, 112, 96, 100], [100, 106, 94, 100], [100, 130, 98, 124],
        [104, 112, 98, 104], [104, 108, 94, 102], [102, 116, 100, 112], [104, 108, 96, 100],
        [100, 106, 94, 102], [102, 113, 98, 110], [110, 112, 95, 100], [100, 104, 94, 96],
        [96, 102, 90, 92], [92, 100, 88, 90],
      ]),
      negative: mkBars('CHNS', [
        [82, 88, 80, 86], [86, 92, 84, 90], [88, 94, 86, 92], [92, 100, 90, 96],
        [96, 108, 94, 104], [104, 112, 100, 106], [106, 106, 96, 100], [100, 104, 94, 98],
        [98, 115, 96, 110], [110, 112, 96, 100], [100, 106, 94, 100], [100, 130, 98, 124],
        [104, 112, 98, 104], [104, 108, 94, 102], [102, 116, 100, 112], [104, 108, 96, 100],
        [100, 106, 94, 102], [102, 113, 98, 110], [110, 112, 95, 100], [100, 104, 94, 96],
        [96, 102, 90, 92], [96, 100, 95, 98],
      ]),
    },
    chart_cup_handle: {
      minBars: 18,
      target: nseTarget('CUPH'),
      positive: mkBars('CUPH', [
        [98, 102, 97, 100], [100, 101, 92, 94], [94, 96, 86, 88], [88, 90, 78, 82],
        [82, 86, 74, 78], [78, 84, 73, 80], [80, 88, 76, 86], [86, 94, 84, 92],
        [92, 98, 90, 96], [96, 101, 94, 99], [99, 102, 96, 100], [100, 102, 97, 100],
        [99, 102, 96, 100], [99, 101, 94, 96], [96, 99, 92, 94], [94, 100, 93, 98],
        [98, 101, 96, 99], [102, 108, 101, 106],
      ]),
      negative: mkBars('CUPH', [
        [98, 102, 97, 100], [100, 101, 92, 94], [94, 96, 86, 88], [88, 90, 78, 82],
        [82, 86, 74, 78], [78, 84, 73, 80], [80, 88, 76, 86], [86, 94, 84, 92],
        [92, 98, 90, 96], [96, 101, 94, 99], [99, 102, 96, 100], [100, 102, 97, 100],
        [99, 102, 96, 100], [99, 101, 94, 96], [96, 99, 92, 94], [94, 100, 93, 98],
        [98, 101, 96, 99], [98, 100, 96, 99],
      ]),
    },
    chart_inverted_cup_handle: {
      minBars: 18,
      target: nseTarget('ICUP'),
      positive: mkBars('ICUP', [
        [102, 104, 98, 100], [100, 108, 99, 106], [106, 116, 104, 112], [112, 124, 110, 120],
        [120, 128, 116, 124], [124, 129, 118, 122], [122, 126, 112, 116], [116, 118, 104, 108],
        [108, 112, 104, 104], [104, 108, 100, 101], [101, 105, 98, 100], [100, 104, 98, 100],
        [100, 104, 98, 100], [101, 108, 100, 104], [104, 110, 102, 106], [106, 108, 100, 102],
        [102, 104, 98, 101], [98, 100, 92, 94],
      ]),
      negative: mkBars('ICUP', [
        [102, 104, 98, 100], [100, 108, 99, 106], [106, 116, 104, 112], [112, 124, 110, 120],
        [120, 128, 116, 124], [124, 129, 118, 122], [122, 126, 112, 116], [116, 118, 104, 108],
        [108, 112, 104, 104], [104, 108, 100, 101], [101, 105, 98, 100], [100, 104, 98, 100],
        [100, 104, 98, 100], [101, 108, 100, 104], [104, 110, 102, 106], [106, 108, 100, 102],
        [102, 104, 98, 101], [100, 103, 99, 102],
      ]),
    },
    chart_rounding_bottom: {
      minBars: 18,
      target: nseTarget('RNDB'),
      positive: mkBars('RNDB', [
        [100, 104, 98, 102], [101, 103, 97, 100], [100, 102, 96, 99], [99, 101, 95, 98],
        [98, 100, 94, 97], [97, 100, 94, 98], [96, 98, 84, 88], [88, 92, 78, 82],
        [82, 88, 76, 80], [80, 88, 76, 84], [84, 94, 82, 90], [90, 98, 88, 96],
        [96, 102, 94, 99], [98, 104, 96, 101], [101, 105, 99, 102], [102, 106, 100, 103],
        [103, 107, 101, 104], [106, 112, 105, 110],
      ]),
      negative: mkBars('RNDB', [
        [100, 104, 98, 102], [101, 103, 97, 100], [100, 102, 96, 99], [99, 101, 95, 98],
        [98, 100, 94, 97], [97, 100, 94, 98], [96, 98, 84, 88], [88, 92, 78, 82],
        [82, 88, 76, 80], [80, 88, 76, 84], [84, 94, 82, 90], [90, 98, 88, 96],
        [96, 102, 94, 99], [98, 104, 96, 101], [101, 105, 99, 102], [102, 106, 100, 103],
        [103, 107, 101, 104], [100, 102, 96, 98],
      ]),
    },
    chart_adam_eve_bottom: {
      minBars: 16,
      target: nseTarget('AEB'),
      positive: mkBars('AEB', [
        [100, 104, 98, 102], [102, 105, 96, 98], [98, 100, 92, 94], [92, 96, 80, 84],
        [84, 98, 90, 96], [96, 106, 94, 104], [104, 108, 96, 100], [100, 104, 92, 96],
        [96, 100, 88, 90], [90, 96, 86, 88], [88, 94, 82, 86], [86, 98, 86, 96],
        [96, 102, 90, 100], [100, 106, 96, 104], [104, 110, 100, 108], [110, 114, 108, 112],
      ]),
      negative: mkBars('AEB', [
        [100, 104, 98, 102], [102, 105, 96, 98], [98, 100, 92, 94], [92, 96, 80, 84],
        [84, 98, 90, 96], [96, 106, 94, 104], [104, 108, 96, 100], [100, 104, 92, 96],
        [96, 100, 88, 90], [90, 96, 86, 88], [88, 94, 82, 86], [86, 98, 86, 96],
        [96, 102, 90, 100], [100, 106, 96, 104], [104, 110, 100, 108], [102, 106, 100, 104],
      ]),
    },
    chart_adam_eve_top: {
      minBars: 16,
      target: nseTarget('AET'),
      positive: mkBars('AET', [
        [100, 104, 96, 102], [102, 110, 100, 108], [108, 118, 106, 116], [116, 130, 114, 126],
        [126, 118, 108, 112], [112, 116, 100, 104], [104, 112, 98, 108], [108, 118, 104, 114],
        [114, 122, 106, 118], [118, 124, 108, 120], [120, 128, 110, 124], [124, 122, 106, 112],
        [112, 116, 100, 104], [104, 108, 96, 100], [100, 104, 94, 98], [96, 100, 88, 92],
      ]),
      negative: mkBars('AET', [
        [100, 104, 96, 102], [102, 110, 100, 108], [108, 118, 106, 116], [116, 130, 114, 126],
        [126, 118, 108, 112], [112, 116, 100, 104], [104, 112, 98, 108], [108, 118, 104, 114],
        [114, 122, 106, 118], [118, 124, 108, 120], [120, 128, 110, 124], [124, 122, 106, 112],
        [112, 116, 100, 104], [104, 108, 96, 100], [100, 104, 94, 98], [102, 106, 100, 105],
      ]),
    },
    chart_scallop_handle: {
      minBars: 18,
      target: nseTarget('SCAL'),
      positive: mkBars('SCAL', [
        [98, 102, 96, 100], [100, 101, 92, 94], [94, 96, 86, 88], [88, 92, 82, 86],
        [86, 90, 82, 88], [88, 96, 86, 94], [94, 102, 92, 100], [100, 106, 98, 104],
        [104, 110, 102, 108], [108, 114, 106, 112], [112, 116, 108, 114], [114, 118, 110, 116],
        [116, 118, 110, 112], [112, 116, 106, 108], [108, 114, 104, 110], [110, 116, 108, 114],
        [114, 117, 109, 113], [118, 122, 116, 120],
      ]),
      negative: mkBars('SCAL', [
        [98, 102, 96, 100], [100, 101, 92, 94], [94, 96, 86, 88], [88, 92, 82, 86],
        [86, 90, 82, 88], [88, 96, 86, 94], [94, 102, 92, 100], [100, 106, 98, 104],
        [104, 110, 102, 108], [108, 114, 106, 112], [112, 116, 108, 114], [114, 118, 110, 116],
        [116, 118, 110, 112], [112, 116, 106, 108], [108, 114, 104, 110], [110, 116, 108, 114],
        [114, 117, 109, 113], [114, 116, 112, 115],
      ]),
    },
    chart_rounding_top: {
      minBars: 18,
      target: nseTarget('RNDT'),
      positive: mkBars('RNDT', [
        [100, 104, 98, 102], [101, 105, 99, 103], [102, 106, 100, 104], [103, 107, 101, 105],
        [102, 106, 100, 103], [101, 105, 99, 102], [104, 116, 102, 112], [112, 124, 110, 120],
        [120, 128, 116, 124], [124, 128, 116, 120], [120, 122, 108, 112], [112, 114, 104, 108],
        [108, 110, 102, 105], [105, 108, 100, 103], [103, 106, 99, 102], [102, 105, 98, 101],
        [101, 104, 97, 100], [96, 99, 90, 94],
      ]),
      negative: mkBars('RNDT', [
        [100, 104, 98, 102], [101, 105, 99, 103], [102, 106, 100, 104], [103, 107, 101, 105],
        [102, 106, 100, 103], [101, 105, 99, 102], [104, 116, 102, 112], [112, 124, 110, 120],
        [120, 128, 116, 124], [124, 128, 116, 120], [120, 122, 108, 112], [112, 114, 104, 108],
        [108, 110, 102, 105], [105, 108, 100, 103], [103, 106, 99, 102], [102, 105, 98, 101],
        [101, 104, 97, 100], [102, 106, 101, 104],
      ]),
    },
  };
}

function buildScenario(
  id: string,
  patternId: string,
  category: ChartPattern50ParityScenarioV1['category'],
  description: string,
  target: ScannerRunTarget,
  bars: EodBar[],
  scannerIds: string[],
  evaluateHistory: boolean,
): Promise<ChartPattern50ParityScenarioV1> {
  const request: RustScannerEvaluationRequestV1 = {
    contractVersion: RUST_SCANNER_CONTRACT_VERSION,
    requestId: `req-nsr3-${id}`,
    target,
    bars,
    scannerIds,
    lookbackBars: null,
    evaluateHistory,
    executionMode: 'fast',
    generatedAt: FIXED_GENERATED_AT_NSR3,
  };
  return evaluateRustScannerContractRequestV1(request).then((response) => ({
    id,
    patternId,
    category,
    description,
    request,
    response,
  }));
}

export async function generateNativeChartPatterns50Fixtures(): Promise<ChartPattern50ParityBundleV1> {
  const defsById = new Map(chartPatternScannerDefinitions.map((d) => [d.id, d]));
  const fixturesByPattern = buildFixturesByPattern();

  for (const id of NATIVE_SUPPORTED_PATTERN_IDS) {
    if (!fixturesByPattern[id]) {
      throw new Error(`Missing fixture entry for pattern ${id}`);
    }
  }

  const manifest: PatternCoverageManifestEntryV1[] = [];
  const scenarios: ChartPattern50ParityScenarioV1[] = [];

  for (const patternId of NATIVE_SUPPORTED_PATTERN_IDS) {
    const def = defsById.get(patternId)!;
    const spec = fixturesByPattern[patternId]!;
    const isExistingGap = EXISTING_NATIVE_GAP_IDS.has(patternId);
    const positiveId = `${patternId}_positive`;
    const negativeId = `${patternId}_negative`;
    const boundaryId = `${patternId}_boundary_below_min_${spec.minBars - 1}`;

    manifest.push({
      patternId,
      scannerName: def.name,
      categoryId: def.categoryId,
      family: def.chartPattern?.family ?? 'gap',
      minBars: spec.minBars,
      status: isExistingGap ? 'existing_native_gap' : 'migrated_nsr3',
      positiveCaseId: positiveId,
      negativeCaseId: negativeId,
      boundaryCaseId: boundaryId,
      geometryVerified: true,
    });

    if (isExistingGap) {
      continue;
    }

    const posScenario = await buildScenario(
      positiveId,
      patternId,
      'positive',
      `Positive match + full metadata/geometry parity for ${def.name} (${patternId}).`,
      spec.target,
      spec.positive,
      [patternId],
      false,
    );
    if (posScenario.response.latestResults.length !== 1) {
      throw new Error(`Expected positive match for ${patternId}, got ${posScenario.response.latestResults.length}`);
    }
    scenarios.push(posScenario);

    const negScenario = await buildScenario(
      negativeId,
      patternId,
      'negative',
      `Near-miss negative scenario for ${def.name} (${patternId}).`,
      spec.target,
      spec.negative,
      [patternId],
      false,
    );
    if (negScenario.response.latestResults.length !== 0) {
      throw new Error(`Expected negative non-match for ${patternId}, got ${negScenario.response.latestResults.length}`);
    }
    scenarios.push(negScenario);

    const truncatedBars = spec.positive.slice(-(spec.minBars - 1));
    const boundaryScenario = await buildScenario(
      boundaryId,
      patternId,
      'boundary',
      `Warm-up boundary (${truncatedBars.length} bars < min ${spec.minBars}) suppresses ${patternId}.`,
      spec.target,
      truncatedBars,
      [patternId],
      false,
    );
    if (boundaryScenario.response.latestResults.length !== 0) {
      throw new Error(`Expected boundary non-match for ${patternId}, got ${boundaryScenario.response.latestResults.length}`);
    }
    scenarios.push(boundaryScenario);
  }

  // Bilateral directional extras (bearish Symmetrical Triangle, bottom Complex H&S)
  const symTriBearBars = flipLastBarClose(fixturesByPattern.chart_symmetrical_triangle!.positive, -24);
  const symTriBear = await buildScenario(
    'chart_symmetrical_triangle_bearish_extra',
    'chart_symmetrical_triangle',
    'extra',
    'Bearish breakdown Symmetrical Triangle parity check.',
    { exchange: 'NSE', symbol: 'SYMTB' },
    symTriBearBars,
    ['chart_symmetrical_triangle'],
    false,
  );
  if (symTriBear.response.latestResults[0]?.direction !== 'bearish') {
    throw new Error('Expected bearish Symmetrical Triangle extra scenario to match bearish.');
  }
  scenarios.push(symTriBear);

  const complexBottomBars = mkBars('CHNSB', [
    [120, 122, 114, 116], [116, 118, 110, 112], [114, 116, 108, 110], [110, 112, 102, 104],
    [106, 108, 94, 98], [98, 102, 90, 96], [96, 106, 94, 104], [104, 108, 98, 102],
    [102, 106, 86, 92], [92, 102, 90, 100], [100, 108, 96, 102], [102, 104, 72, 78],
    [98, 104, 90, 96], [96, 108, 94, 100], [100, 104, 86, 92], [98, 106, 94, 102],
    [102, 108, 96, 100], [100, 104, 89, 93], [92, 106, 90, 102], [102, 108, 98, 106],
    [106, 112, 100, 110], [110, 116, 104, 114],
  ]);
  const complexBottom = await buildScenario(
    'chart_complex_head_shoulders_bottom_extra',
    'chart_complex_head_shoulders',
    'extra',
    'Inverse Complex Head & Shoulders (bullish) parity check.',
    { exchange: 'NSE', symbol: 'CHNSB' },
    complexBottomBars,
    ['chart_complex_head_shoulders'],
    false,
  );
  if (complexBottom.response.latestResults[0]?.direction !== 'bullish') {
    throw new Error('Expected bullish Complex H&S extra scenario to match bullish.');
  }
  scenarios.push(complexBottom);

  // Historical grouping across multiple families + >260-bar sliding window boundary
  const histDoubleBottom = await buildScenario(
    'historical_reversal_double_bottom_grouped',
    'chart_double_bottom',
    'historical',
    'Two Double Bottom breakout episodes separated by non-matching bars verify consecutive grouping.',
    { exchange: 'NSE', symbol: 'HISTDB' },
    mkBars('HISTDB', [
      ...Array.from({ length: 6 }, (_, i): [number, number, number, number] => [100, 102, 98, 100 + (i % 2)]),
      ...fixturesByPattern.chart_double_bottom!.positive.map((b) => [b.open, b.high, b.low, b.close] as [number, number, number, number]),
      [111, 114, 109, 112],
      ...Array.from({ length: 10 }, (): [number, number, number, number] => [112, 113, 110, 111]),
    ]),
    ['chart_double_bottom'],
    true,
  );
  scenarios.push(histDoubleBottom);

  const histCoilMulti = await buildScenario(
    'historical_structure_coil_multi_episode',
    'chart_coil_volatility_squeeze',
    'historical',
    'Multi-episode Coil / Volatility Squeeze historical grouping over 40 bars.',
    { exchange: 'BSE', symbol: '500180' },
    mkBars('500180', [
      ...Array.from({ length: 14 }, (): [number, number, number, number] => [100, 104, 96, 100]),
      ...fixturesByPattern.chart_coil_volatility_squeeze!.positive.map((b) => [b.open, b.high, b.low, b.close] as [number, number, number, number]),
      [120, 130, 118, 128],
      [125, 132, 120, 122],
      ...fixturesByPattern.chart_coil_volatility_squeeze!.positive.map((b) => [b.open, b.high, b.low, b.close] as [number, number, number, number]),
    ]),
    ['chart_coil_volatility_squeeze'],
    true,
  );
  scenarios.push(histCoilMulti);

  const histChannel = await buildScenario(
    'historical_structure_rising_channel_long_window_270',
    'chart_rising_channel',
    'historical',
    '270-bar series exercises >260-bar MAX_PATTERN_WINDOW_BARS sliding history parity.',
    { exchange: 'NSE', symbol: 'HISTCH' },
    mkBars('HISTCH', [
      ...Array.from({ length: 234 }, (_, i): [number, number, number, number] => [100 + (i % 3), 102 + (i % 3), 99, 100 + (i % 3)]),
      ...channelTuples('rising'),
    ]),
    ['chart_rising_channel'],
    true,
  );
  scenarios.push(histChannel);

  const histComplexHs = await buildScenario(
    'historical_complex_head_shoulders_grouped',
    'chart_head_shoulders',
    'historical',
    'Head & Shoulders multi-endpoint consecutive match grouping parity.',
    { exchange: 'NSE', symbol: 'HISTHS' },
    mkBars('HISTHS', [
      ...Array.from({ length: 8 }, (): [number, number, number, number] => [85, 87, 83, 85]),
      ...fixturesByPattern.chart_head_shoulders!.positive.map((b) => [b.open, b.high, b.low, b.close] as [number, number, number, number]),
      [90, 92, 87, 88],
      [88, 91, 86, 87],
    ]),
    ['chart_head_shoulders'],
    true,
  );
  scenarios.push(histComplexHs);

  return {
    contractVersion: RUST_SCANNER_CONTRACT_VERSION,
    fixedGeneratedAt: FIXED_GENERATED_AT_NSR3,
    totalPatternCount: manifest.length,
    migratedPatternCount: manifest.filter((m) => m.status === 'migrated_nsr3').length,
    manifest,
    scenarios,
  };
}

export async function writeNativeChartPatterns50Fixtures(): Promise<ChartPattern50ParityBundleV1> {
  const bundle = await generateNativeChartPatterns50Fixtures();
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
  return bundle;
}
