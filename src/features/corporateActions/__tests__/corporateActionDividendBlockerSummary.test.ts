import { describe, expect, it } from 'vitest';
import { formatDividendBlockerReport, summarizeDividendBlockerReasons } from '../legacy/corporateActionDividendBlockerSummary';

function makeResult(dispositions: { disposition: string; reason: string }[], overrides: Record<string, number | boolean | string | null> = {}) {
  const eligible = dispositions.filter((row) => row.disposition === 'ELIGIBLE').length;
  const ineligible = dispositions.filter((row) => row.disposition === 'INELIGIBLE').length;
  return { requested: dispositions.length, eligible, ineligible, alreadyApproved: 0, staleScope: 0, missing: 0, failed: 0,
    complete: true, operationalError: null, dispositions, ...overrides };
}

describe('Dividend R1 aggregate ineligibility diagnostics', () => {
  it('groups exact backend reasons deterministically without changing dispositions', () => {
    const dispositions = [
      { disposition: 'INELIGIBLE', reason: 'Missing identity' },
      { disposition: 'ELIGIBLE', reason: 'Valid' },
      { disposition: 'INELIGIBLE', reason: 'No EOD bars' },
      { disposition: 'INELIGIBLE', reason: 'Missing identity' },
    ];
    const before = JSON.stringify(dispositions);
    const summary = summarizeDividendBlockerReasons(makeResult(dispositions));
    expect(summary.accountedFor).toBe(true);
    expect(summary.reasons).toEqual([
      { reason: 'Missing identity', count: 2 },
      { reason: 'No EOD bars', count: 1 },
    ]);
    expect(JSON.stringify(dispositions)).toBe(before);
  });

  it('detects missing dispositions and never reports an incomplete aggregate as complete', () => {
    const result = makeResult([{ disposition: 'INELIGIBLE', reason: 'Missing identity' }],
      { requested: 2, ineligible: 2, complete: false, operationalError: 'batch failed' });
    const summary = summarizeDividendBlockerReasons(result);
    expect(summary.accountedFor).toBe(false);
    expect(summary.completedWithoutError).toBe(false);
    expect(formatDividendBlockerReport(result)).toContain('Reconciled: NO');
  });

  it('prints only counts and reasons, not row IDs, symbols, or monetary inputs', () => {
    const report = formatDividendBlockerReport(makeResult([
      { disposition: 'INELIGIBLE', reason: 'No current machine-proven identity satisfies Dividend R1.' },
      { disposition: 'ELIGIBLE', reason: 'proof' },
    ]));
    expect(report).toContain('1 | No current machine-proven identity satisfies Dividend R1.');
    expect(report).not.toContain('proof');
    expect(report).toContain('diagnostic only, NOT APPROVED');
  });

  it('supports zero ineligible rows and blank backend reasons without guessing', () => {
    const result = makeResult([{ disposition: 'INELIGIBLE', reason: '   ' }]);
    const summary = summarizeDividendBlockerReasons(result);
    expect(summary.reasons).toEqual([{ reason: '(Backend did not provide a reason)', count: 1 }]);
    expect(summarizeDividendBlockerReasons(makeResult([])).reasons).toEqual([]);
  });
});
