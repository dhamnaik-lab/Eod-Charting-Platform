import { useEffect, useId, useRef, useState } from 'react';
import type { OfficialSourceConfigurationAuthority, OfficialSourceHistoryEntry } from '@/platform';
import { createSourceHistoryLoader, type SourceHistoryState } from './sourceHistoryLoader';

export function SourceHistoryContent({ state }: { state: SourceHistoryState }) {
  if (state.status === 'idle') return <p>Select a source and choose Load / Refresh History. Replacement discovery is not required.</p>;
  if (state.status === 'loading') return <p role="status">Loading saved source history…</p>;
  if (state.status === 'error') return <p role="alert">History could not be loaded: {state.message}</p>;
  if (state.entries.length === 0) return <p role="status">No saved version or review history is available for this source.</p>;
  return <>
    <p role="status">{state.entries.length} saved version / review entries. History is not approval authority.</p>
    <div className="identity-source-table-scroll"><table className="identity-source-table" aria-label="Saved source version and review history">
      <thead><tr><th>Created</th><th>Entry</th><th>Version / Revision</th><th>State</th><th>Change / Decision</th><th>Evidence</th></tr></thead>
      <tbody>{state.entries.map((entry, index) => <tr key={`${entry.entryKind}-${entry.versionId}-${entry.createdAt}-${index}`}>
        <td>{entry.createdAt}</td><td>{entry.entryKind}</td><td>{entry.versionId} / {entry.revision}</td>
        <td>{entry.entryKind === 'VERSION' ? entry.active ? 'Active' : 'Historical' : entry.reviewResultStatus ?? 'Review recorded'}</td>
        <td>{entry.reviewDecision ?? entry.changeKind}</td>
        <td><details><summary>Version details</summary><dl className="identity-diagnostic-fields">
          {Object.entries({ URL: entry.url, 'Parent version': entry.parentVersionId, 'SHA-256': entry.candidateContentSha256,
            'Change kind': entry.changeKind, 'Review decision': entry.reviewDecision, 'Review result': entry.reviewResultStatus,
            'Result version': entry.resultVersionId, 'Post-health': entry.postHealthStatus, 'Operator note': entry.operatorNote,
          }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}
        </dl></details></td>
      </tr>)}</tbody>
    </table></div>
  </>;
}

export function IdentitySourceHistory({ authority, exchange, busy, hasDatabase, configurationError, onReloadSources, loadHistory }: {
  authority: OfficialSourceConfigurationAuthority | null;
  exchange: 'NSE' | 'BSE';
  busy: boolean;
  hasDatabase: boolean;
  configurationError: string;
  onReloadSources: () => void;
  loadHistory: (sourceKey: string) => Promise<OfficialSourceHistoryEntry[]>;
}) {
  const [selectedKey, setSelectedKey] = useState('');
  const [state, setState] = useState<SourceHistoryState>({ status: 'idle' });
  const id = useId();
  const readRef = useRef(loadHistory); readRef.current = loadHistory;
  const loaderRef = useRef<ReturnType<typeof createSourceHistoryLoader> | null>(null);
  if (!loaderRef.current) loaderRef.current = createSourceHistoryLoader(key => readRef.current(key), setState);
  const loader = loaderRef.current;
  useEffect(() => { loader.reset(); return () => loader.invalidate(); }, [loader, authority?.configurationFingerprint, exchange]);
  const sources = authority?.sources.filter(source => source.exchange === exchange) ?? [];
  const selected = sources.find(source => source.sourceKey === selectedKey) ?? sources[0];
  const currentState = state.status !== 'idle' && state.sourceKey !== selected?.sourceKey ? { status: 'idle' as const } : state;

  return <section className="identity-source-health" aria-label="Independent saved source history">
    <h3>Saved source versions and review history</h3>
    <div className="identity-workspace-toolbar">
      <label htmlFor={id}>Source</label>
      <select id={id} value={selected?.sourceKey ?? ''} disabled={busy || !hasDatabase || sources.length === 0}
        onChange={event => { loader.reset(); setSelectedKey(event.target.value); }}>
        {sources.length === 0 ? <option value="">No {exchange} source configuration loaded</option> :
          sources.map(source => <option key={source.sourceKey} value={source.sourceKey}>{source.sourceRole ?? source.sourceId ?? source.sourceKey}</option>)}
      </select>
      <button type="button" disabled={busy || !hasDatabase || !selected || state.status === 'loading'}
        onClick={() => { if (selected) void loader.load(selected.sourceKey); }}>Load / Refresh History</button>
      <button type="button" disabled={busy || !hasDatabase || state.status === 'loading'} onClick={onReloadSources}>Reload Source List</button>
    </div>
    {!hasDatabase ? <p>Open a database to read saved source history.</p> : !authority ?
      <p role="status">{configurationError || 'Source configuration is not loaded. Choose Reload Source List.'}</p> :
      sources.length === 0 ? <p>No configured {exchange} sources are available.</p> : <>
        <p>Current source: {selected?.sourceKey} · version {selected?.currentVersionId} · revision {selected?.revision}</p>
        <p className="identity-review-note">{selected?.currentUrl}</p>
        <SourceHistoryContent state={currentState} />
      </>}
    <p className="identity-review-note">Loading history reads saved records. It does not check online sources, discover replacements or apply changes.</p>
  </section>;
}
