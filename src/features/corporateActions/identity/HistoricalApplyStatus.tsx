import type { IdentityApplyProgress, NseHistoricalIdentityResult } from '@/types/desktop';

export function HistoricalApplyStatus({ progress, result, error, refreshWarning }: {
  progress: IdentityApplyProgress | null; result: NseHistoricalIdentityResult | null;
  error: string | null; refreshWarning: string | null;
}) {
  const saved = result?.applied || progress?.stage === 'committed' || progress?.stage === 'refreshing';
  if (!progress && !saved && !error) return null;
  const percent = saved ? 100 : error ? null : progress?.percent;
  const title = saved ? 'Completed · Database saved' : error ? 'Apply failed · Not completed'
    : progress?.stage === 'checking' ? 'Rechecking reviewed plan' : progress?.stage === 'committing' ? 'Committing · Awaiting save' : 'Applying historical identity';
  return <section className={`identity-apply-status ${saved ? 'is-complete' : error ? 'is-error' : 'is-running'}`} role="status" aria-label="Historical identity apply status">
    <strong>{title}{percent != null ? ` · ${percent}%` : ''}</strong>
    {saved || !error ? <progress aria-label="Historical identity database work" max={100} value={percent ?? undefined} /> : null}
    {result?.applied ? <span>{result.newSymbolChanges + result.newNameChanges + result.newCombinedChanges} history changes saved
      {' · '}{result.newSymbolChanges} symbol, {result.newNameChanges} name, {result.newCombinedChanges} combined.
      {result.completedAt ? ` Saved ${new Date(result.completedAt).toLocaleString()}.` : ''} View Recent Applied for the report.</span>
      : progress?.stage === 'applying' ? <span>{progress.processed} / {progress.total} source entries processed · Awaiting commit</span> : null}
    {result?.applied ? <span>Current-universe effects: {result.activeSyncActivateCount} activated, {result.activeSyncUpdateCount} updated, {result.activeSyncDeactivateCount} deactivated.</span> : null}
    {saved && !result?.applied ? <span>Commit confirmed. Load Recent Applied to read the saved receipt.</span> : null}
    {error ? <span>{saved ? 'Database was saved; report retrieval needs retry. ' : ''}{error}</span> : null}
    {refreshWarning ? <span>Changes saved. View refresh needs retry: {refreshWarning}</span> : null}
  </section>;
}
