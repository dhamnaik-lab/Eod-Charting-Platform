import { useRef, useState, useEffect } from 'react';
import type { NseCurrentUniverseSyncResult, BseCurrentUniverseSyncResult } from '@/types/desktop';
import { IdentityPreviewTable } from './IdentityPreviewTable';
import { legacySavedTime } from './HistoricalApplyHistory';
import { IdentityEvidenceValue } from './IdentityReceiptControls';

type CurrentResult = NseCurrentUniverseSyncResult | BseCurrentUniverseSyncResult;

export function IdentityApplyHistory({ load, latest, exchange = 'NSE', standalone = false }: {
  load: () => Promise<CurrentResult[]>; latest: CurrentResult | null; exchange?: 'NSE' | 'BSE'; standalone?: boolean;
}) {
  const [runs, setRuns] = useState<CurrentResult[]>([]);
  const [selected, setSelected] = useState<CurrentResult | null>(null);
  const [state, setState] = useState('');
  const generation = useRef(0);
  useEffect(() => () => { generation.current++; }, []);
  const refresh = async () => {
    const id = ++generation.current; setState('Loading saved apply history…');
    try {
      const next = await load(); if (id !== generation.current) return;
      setRuns(next); setSelected(null);
      setState(next.length ? `${next.length} saved runs · Most recent 50 shown` : 'No saved apply runs. Runs applied before this update have no receipt.');
    } catch (error) { if (id === generation.current) setState(`Could not read apply history: ${String(error)}`); }
  };
  useEffect(() => { if (standalone) void refresh(); }, []);
  const report = selected ?? latest;
  const saved = legacySavedTime(report?.completedAt);
  const body = <>
    <button type="button" onClick={() => void refresh()} disabled={state.startsWith('Loading')}>Load / Refresh Apply History</button>
    <p role="status">{state || `Read saved ${exchange} Current universe apply receipts. This does not apply changes or approve financial actions.`}</p>
    <div className="identity-history-run-list">{runs.map(run => <button type="button" key={run.runId} onClick={() => setSelected(run)}>
      {run.completedAt ? legacySavedTime(run.completedAt).label : run.runId} · {run.activateCount + run.updateCount + run.deactivateCount} applied
    </button>)}</div>
    {report?.applied ? <>
      <p title={saved.utc}>Saved receipt · {saved.label} · Historical evidence, not a new preview or apply authority.</p>
      <details className="identity-receipt-evidence"><summary>Run evidence and source hashes</summary>
        <dl className="identity-diagnostic-fields">{Object.entries({ Exchange: exchange, 'Run ID':report.runId, 'Reviewed plan SHA-256':report.planSha256,
          'Source path':'masterFilePath' in report ? report.masterFilePath : report.archiveRootPath,
          ...('masterSha256' in report ? {'Master SHA-256':report.masterSha256} : {}),
        }).map(([key,value]) => <div key={key}><dt>{key}</dt><dd>{key.includes('SHA-256') || key==='Source path'
          ? <IdentityEvidenceValue label={key.toLowerCase()} value={value} path={key==='Source path'}/>
          : value ?? '—'}</dd></div>)}</dl>
      </details>
      <IdentityPreviewTable key={report.runId} rows={report.previewRows.map(row => ({ ...row, source: exchange, matchValue: 'securityCode' in row ? row.securityCode : row.matchedSymbol }))}
        loaded total={report.previewRows.length} busy={false} applied />
    </> : null}
  </>;
  return standalone ? <section className="identity-current-history" aria-label={`${exchange} Current universe apply history`}>{body}</section>
    : <details className="identity-apply-history"><summary>Saved {exchange} Current universe apply history</summary>{body}</details>;
}
