import type { IdentityApplyProgress, NseCurrentUniverseSyncResult, BseCurrentUniverseSyncResult } from '@/types/desktop';

export function IdentityApplyStatus({ progress, result, error, refreshWarning }: {
  progress: IdentityApplyProgress | null; result: NseCurrentUniverseSyncResult | BseCurrentUniverseSyncResult | null;
  error: string | null; refreshWarning: string | null;
}) {
  const committed = result?.applied === true || progress?.stage === 'committed' || progress?.stage === 'refreshing';
  if (!progress && !committed && !error) return null;
  const pendingRefresh = committed && progress?.stage === 'refreshing';
  const labels = { checking: 'Rechecking reviewed plan', applying: 'Applying instrument records',
    committing: 'Committing changes', committed: 'Database saved', refreshing: 'Database saved · Refreshing view' };
  const title = committed ? pendingRefresh ? labels.refreshing : 'Completed'
    : error ? 'Apply failed · Not completed' : progress ? labels[progress.stage] : '';
  const percent = committed ? 100 : error ? null : progress?.percent;
  return <section className={`identity-apply-status ${committed ? 'is-complete' : error ? 'is-error' : 'is-running'}`} aria-label="Identity apply status" role="status">
    <strong>{title}{percent != null ? ` · ${percent}%` : ''}</strong>
    {!error || committed ? <progress aria-label="Identity database work" max={100} value={percent ?? undefined} /> : null}
    {committed && result?.applied ? <span>{result.activateCount + result.updateCount + result.deactivateCount} {result.activateCount + result.updateCount + result.deactivateCount === 1 ? 'change' : 'changes'} applied
      {' · '}{result.newSymbols} new, {result.activateCount - result.newSymbols} reactivated,
      {' '}{result.updateCount} updated, {result.deactivateCount} deactivated.
      {result.unchangedActive != null ? ` ${result.unchangedActive} unchanged.` : ''}
      {result.completedAt ? ` Saved ${new Date(result.completedAt).toLocaleString()}.` : ''}</span>
      : progress?.stage === 'applying' ? <span>{progress.processed} / {progress.total} instrument records processed · Awaiting commit</span> : null}
    {error ? <span>{committed ? `Changes saved; report retrieval needs retry: ${error}. Read Recent Applied before retrying.` : error}</span> : null}
    {refreshWarning ? <span>Changes saved. View refresh needs retry: {refreshWarning}</span> : null}
  </section>;
}
