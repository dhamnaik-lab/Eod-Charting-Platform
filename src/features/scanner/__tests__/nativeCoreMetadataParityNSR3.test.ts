import { describe, expect, it } from 'vitest';
import { coreOhlcvScannerDefinitions, runCoreScanner } from '@/plugins/scanner/coreOhlcvScanners';
import { compileNativeCoreCandidate } from '@/features/scanner/nativeCoreRuleExpressions';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';
import type { NativeExprV1 } from '@/features/scanner/nativeScanContract';

interface Bar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
interface CoreCase {
  caseId: string;
  ruleId: string;
  description: string;
  symbol: string;
  exchange: string;
  bars: Bar[];
  expected: Omit<ScannerResult, 'generatedAt'> | null;
}
interface CoreFixture {
  version: number;
  rules: Record<string, NativeExprV1>;
  cases: CoreCase[];
}

// Both suites consume one committed, immutable record. This test is authoritative:
// expected rows must be identical to the *real* TypeScript core handlers, not
// manually claimed metadata or mocked native event payloads.
const fixture = require('../fixtures/nativeCoreMetadataParityFixtures.v1.json') as CoreFixture;

describe('NS-R3 direct legacy core metadata parity contract', () => {
  it('covers all ten production definitions with exact Rust accepted AST and required edge cases', () => {
    expect(fixture.version).toBe(1);
    const definitions = coreOhlcvScannerDefinitions;
    const acceptedIds = definitions.map((definition) => definition.id).sort();
    expect(acceptedIds).toHaveLength(10);
    expect(Object.keys(fixture.rules).sort()).toEqual(acceptedIds);
    const caseNames = new Set<string>();
    const seen = new Map<string, Set<string>>();
    for (const sample of fixture.cases) {
      expect(caseNames.has(sample.caseId), sample.caseId).toBe(false);
      caseNames.add(sample.caseId);
      const acceptedExpression = compileNativeCoreCandidate(sample.ruleId);
      expect(acceptedExpression, sample.caseId).not.toBeNull();
      expect(fixture.rules[sample.ruleId], sample.caseId).toEqual(acceptedExpression);
      expect(sample.description.trim(), sample.caseId).not.toBe('');
      expect(sample.bars.length, sample.caseId).toBeGreaterThan(0);
      expect(sample.bars.every((bar, index) => index === 0 || sample.bars[index - 1]!.date < bar.date), sample.caseId).toBe(true);
      const group = sample.caseId.includes('_regular_match') ? 'regular_match'
        : sample.caseId.includes('_regular_nonmatch') ? 'regular_nonmatch'
        : sample.caseId.includes('_fractional_match') ? 'fractional_match'
        : 'edge';
      if (!seen.has(sample.ruleId)) seen.set(sample.ruleId, new Set());
      seen.get(sample.ruleId)!.add(group);
    }
    for (const id of acceptedIds) {
      expect(seen.get(id), id).toEqual(expect.objectContaining({ size: expect.any(Number) }));
      for (const group of ['regular_match', 'regular_nonmatch', 'fractional_match']) {
        expect(seen.get(id)!.has(group), `${id}/${group}`).toBe(true);
      }
    }
    expect(fixture.cases.length).toBeGreaterThanOrEqual(40);
    expect(fixture.cases.some((entry) => entry.caseId === 'inside_bar_short_null_ratio' && entry.expected?.values?.range_ratio === null)).toBe(true);
  });

  it.each(fixture.cases.map((sample) => [sample.caseId, sample] as const))(
    '%s reproduces the complete TypeScript result metadata from identical bars',
    (_caseId, sample) => {
      const definition = coreOhlcvScannerDefinitions.find((item) => item.id === sample.ruleId);
      expect(definition, sample.caseId).toBeDefined();
      const bars: EodBar[] = sample.bars.map((bar) => ({ ...bar, symbol: sample.symbol }));
      const result = runCoreScanner({
        symbol: sample.symbol,
        exchange: sample.exchange,
        bars,
      }, definition!);
      if (result === null) {
        expect(sample.expected, sample.caseId).toBeNull();
        return;
      }
      const { generatedAt, ...stable } = result;
      expect(typeof generatedAt).toBe('string');
      expect(stable, sample.caseId).toEqual(sample.expected);
    },
  );
});
