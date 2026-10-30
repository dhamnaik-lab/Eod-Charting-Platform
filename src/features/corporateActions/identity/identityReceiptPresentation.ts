export type IdentityReportOutcome = 'applied' | 'all' | 'skipped' | 'duplicates' | 'held' | 'errors';
export function friendlyIdentitySourcePath(path: string): string {
  if (/^\\\\\?\\UNC\\/i.test(path)) return '\\\\' + path.slice(8);
  if (/^\\\\\?\\[a-z]:\\/i.test(path)) return path.slice(4);
  return path;
}
export function matchesIdentityReportOutcome(outcome: string, filter: IdentityReportOutcome): boolean {
  if (filter === 'all') return true;
  return (filter === 'applied' ? ['NEW','APPLIED'] : filter === 'duplicates' ? ['DUPLICATE']
    : filter === 'skipped' ? ['SKIPPED'] : filter === 'held' ? ['HELD','REVIEW_REQUIRED'] : ['ERROR']).includes(outcome);
}
export function identityReportCounts(outcomes: readonly string[]) {
  const keys: IdentityReportOutcome[]=['applied','all','skipped','duplicates','held','errors'];
  return Object.fromEntries(keys.map(key=>[key,outcomes.filter(outcome=>matchesIdentityReportOutcome(outcome,key)).length])) as Record<IdentityReportOutcome,number>;
}
const READINESS_STALE='Database changed. Previous report is retained; run Load & Validate to refresh readiness.';
export function identityReadinessNotice(status: string) {
  return status===READINESS_STALE ? {
    summary:'Corporate Actions validation needs refresh',
    detail:'The database changed, so the earlier Corporate Actions readiness report needs refreshing. Saved Identity reports remain available. Run Load & Validate before approving Corporate Actions.',
  } : null;
}
