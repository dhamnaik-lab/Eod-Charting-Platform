// Diagnostic-only aggregation of the *existing* read-only dividend evaluator dispositions.
// This helper does not classify eligibility, query the database or authorize writes.
export interface DividendBlockerDisposition {
  disposition: string;
  reason: string;
}

export interface DividendBlockerInput {
  requested: number;
  eligible: number;
  ineligible: number;
  alreadyApproved: number;
  staleScope: number;
  missing: number;
  failed: number;
  complete: boolean;
  operationalError: string | null;
  dispositions: readonly DividendBlockerDisposition[];
}

export interface DividendBlockerReasonCount { reason: string; count: number }

export interface DividendBlockerSummary {
  ineligibleExpected: number;
  ineligibleObserved: number;
  accountedFor: boolean;
  completedWithoutError: boolean;
  reasons: DividendBlockerReasonCount[];
}

export function summarizeDividendBlockerReasons(result: DividendBlockerInput): DividendBlockerSummary {
  const counts = new Map<string, number>();
  let ineligibleObserved = 0;
  for (const item of result.dispositions) {
    if (item.disposition !== 'INELIGIBLE') continue;
    ineligibleObserved += 1;
    const reason = item.reason.trim() || '(Backend did not provide a reason)';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  const reasons = [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
  const totalDispositions = result.eligible + result.ineligible + result.alreadyApproved +
    result.staleScope + result.missing + result.failed;
  return {
    ineligibleExpected: result.ineligible,
    ineligibleObserved,
    accountedFor: ineligibleObserved === result.ineligible &&
      totalDispositions === result.requested && result.dispositions.length === result.requested,
    completedWithoutError: result.complete && !result.operationalError && result.failed === 0,
    reasons,
  };
}

export function formatDividendBlockerReport(result: DividendBlockerInput): string {
  const summary = summarizeDividendBlockerReasons(result);
  const lines = [
    'EOD CA Dividend R1 — aggregate reasons (diagnostic only, NOT APPROVED)',
    `Requested: ${result.requested} | Eligible: ${result.eligible} | Ineligible: ${result.ineligible}`,
    `Observed ineligible dispositions: ${summary.ineligibleObserved} | Reconciled: ${summary.accountedFor ? 'YES' : 'NO'}`,
    `Completed without errors: ${summary.completedWithoutError ? 'YES' : 'NO'}`,
    `Distinct exact backend reasons: ${summary.reasons.length}`,
    '',
    'Count | Exact backend rejection reason',
    ...summary.reasons.map((item) => `${item.count} | ${item.reason}`),
  ];
  return lines.join('\n');
}
