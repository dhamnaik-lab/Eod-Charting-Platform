import { useEffect, useId, useRef, useState } from 'react';
import type { HistoricalIdentityApplyHistory, NseHistoricalIdentityResult } from '@/types/desktop';
import { IdentityHistoricalPreview } from './IdentityHistoricalPreview';
import { useIdentityDisplayPreferences } from './identityDisplayPreferences';
import { IdentityEvidenceValue, IdentityReportFilters } from './IdentityReceiptControls';
import { identityReportCounts, matchesIdentityReportOutcome } from './identityReceiptPresentation';

export function legacySavedTime(value: string | null | undefined) {
  if (!value) return { label: '—', utc: 'Saved time unavailable' };
  const timestamp = value.trim().replace(' ', 'T');
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp);
  const date = new Date(hasZone ? timestamp : `${timestamp}Z`);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(timestamp) || Number.isNaN(date.getTime())) {
    return { label: value, utc: `Unrecognised saved time: ${value}` };
  }
  return {
    label: `${new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).format(date)} IST`,
    utc: `${date.toISOString()} (UTC)`,
  };
}

export function HistoricalApplyHistory({ load, loadReport, latest, preferenceKey }: {
  load: () => Promise<HistoricalIdentityApplyHistory>; loadReport: (runId: string) => Promise<NseHistoricalIdentityResult>; latest: NseHistoricalIdentityResult | null;
  preferenceKey?: string | null;
}) {
  const [preferences, updatePreferences, settingsWarning] = useIdentityDisplayPreferences(preferenceKey ?? null);
  const [history, setHistory] = useState<HistoricalIdentityApplyHistory>({ runs: [], legacyRows: [] });
  const [selected, setSelected] = useState<NseHistoricalIdentityResult | null>(null);
  const [state, setState] = useState('');
  const legacyId = useId();
  const generation = useRef(0);
  const loader = useRef(load); loader.current = load;
  const reportLoader = useRef(loadReport); reportLoader.current = loadReport;
  const refresh = async () => {
    const id = ++generation.current; setState('Loading saved historical Apply reports…');
    try {
      const next = await loader.current(); if (id !== generation.current) return;
      setHistory(next);
      const selectedId = next.runs.find(run => run.runId === preferences.selectedRunId)?.runId ?? next.runs[0]?.runId;
      const report = selectedId ? await reportLoader.current(selectedId) : latest;
      if (id !== generation.current) return; setSelected(report);
      setState(`${next.runs.length} completed runs with receipts · Most recent 50 shown`);
    } catch (error) { if (id === generation.current) setState(`Could not read reports: ${String(error)}`); }
  };
  const select = async (runId: string) => {
    updatePreferences({ selectedRunId: runId });
    const id=++generation.current; setState('Loading saved report…');
    try { const report=await reportLoader.current(runId); if(id!==generation.current)return; setSelected(report); setState('Saved report loaded.'); }
    catch(error) { if(id===generation.current)setState(`Could not read report: ${String(error)}`); }
  };
  useEffect(() => { void refresh(); return () => { generation.current++; }; }, []);
  const report = selected ?? latest;
  const legacyQuery=preferences.legacyQuery.trim().toUpperCase();
  const legacyRows=history.legacyRows.filter(row=>!legacyQuery || [row.createdAt,row.effectiveDate,row.oldSymbol,row.newSymbol,row.oldName,row.newName].filter(Boolean).join(' ').toUpperCase().includes(legacyQuery));
  return <div className="identity-historical-preview">
    <div className="identity-workspace-toolbar"><button type="button" onClick={() => void refresh()} disabled={state.startsWith('Loading')}>Refresh Reports</button>
      <span role="status">{state}</span></div>
    {settingsWarning ? <p role="status">Report display settings could not be saved. Changes are kept for this session.</p> : null}
    <div className="identity-history-run-list">{history.runs.map(run => <button type="button" key={run.runId} aria-pressed={report?.runId === run.runId} onClick={() => { if (run.runId) void select(run.runId); }}>
      {run.completedAt ? new Date(run.completedAt).toLocaleString() : run.runId} · {run.newSymbolChanges + run.newNameChanges + run.newCombinedChanges} history changes
    </button>)}</div>
    <section className={`identity-legacy-history${preferences.legacyOpen ? ' is-expanded' : ''}${!report ? ' is-primary' : ''}`}>
      <button type="button" className="identity-legacy-toggle" aria-expanded={preferences.legacyOpen} aria-controls={legacyId}
        onClick={() => updatePreferences({ legacyOpen: !preferences.legacyOpen })}>
        <span aria-hidden="true">{preferences.legacyOpen ? '▼' : '▶'}</span> Legacy persisted history without run receipts ({history.legacyRows.length} recent rows)
      </button>
      <div id={legacyId} className="identity-legacy-content" hidden={!preferences.legacyOpen}>
      <p>These rows exist in the database. Their original full-plan counts, confirmation and completion receipt were not recorded. They are not reconstructed Apply runs. Most recent 250 rows shown; saved times are IST. Hover over a saved time for UTC.</p>
      <label className="identity-historical-query">Find legacy history <input type="search" aria-label="Search legacy identity history" value={preferences.legacyQuery}
        placeholder="Old/new symbol, company name or date" onChange={event=>updatePreferences({legacyQuery:event.target.value})} /></label>
      <p>{legacyRows.length} of {history.legacyRows.length} persisted rows shown</p>
      <div className="identity-legacy-scroll" tabIndex={0} role="region" aria-label="Legacy identity history"><table className="identity-preview-table"><thead><tr><th>Saved (IST)</th><th>Type</th><th>Effective</th><th>Old symbol</th><th>New symbol</th><th>Old name</th><th>New name</th></tr></thead>
        <tbody>{legacyRows.map(row => {
          const saved = legacySavedTime(row.createdAt);
          return <tr key={row.id}><td title={saved.utc} aria-label={`${saved.label}; ${saved.utc}`}>{saved.label}</td><td>{row.changeType}</td><td>{row.effectiveDate}</td><td>{row.oldSymbol}</td><td>{row.newSymbol}</td><td>{row.oldName}</td><td title={row.sourceFile ?? undefined}>{row.newName}</td></tr>;
        })}</tbody></table></div>
      </div>
    </section>
    {report ? <>
      <p className="identity-receipt-note">Completed · Saved {report.completedAt ? new Date(report.completedAt).toLocaleString() : '—'}. Saved evidence; a fresh preview is required for another Apply.</p>
      <details className="identity-receipt-evidence" open={preferences.runEvidenceOpen} onToggle={event => {
        if (event.currentTarget.open !== preferences.runEvidenceOpen) updatePreferences({ runEvidenceOpen: event.currentTarget.open });
      }}><summary>Run evidence and source hashes</summary><dl className="identity-diagnostic-fields">
        {Object.entries({ 'Run ID':report.runId, 'Reviewed SHA-256':report.planSha256,'Source root':report.archiveRootPath,
          'Master SHA-256':report.securitiesAvailableSha256,'Symbol source SHA-256':report.symbolChangesSha256,'Name source SHA-256':report.companyNameChangesSha256,
          'Current effects':`${report.activeSyncActivateCount} activate, ${report.activeSyncUpdateCount} update, ${report.activeSyncDeactivateCount} deactivate`,
        }).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{label.includes('SHA-256') || label==='Source root'
          ? <IdentityEvidenceValue label={label.toLowerCase()} value={value} path={label==='Source root'}/> : value}</dd></div>)}</dl></details>
      <IdentityHistoricalPreview key={report.runId} rows={report.historyRows.filter(row=>matchesIdentityReportOutcome(row.disposition,preferences.reportOutcome))} total={report.historyRows.length} currentEffects={report.currentUniversePreviewRows}
        busy={false} summary={<span>{report.newSymbolChanges} symbol, {report.newNameChanges} name, {report.newCombinedChanges} combined · {report.duplicateRows} duplicates · {report.skippedRows} skipped · {report.errorRows} errors</span>}
        filters={<IdentityReportFilters value={preferences.reportOutcome} counts={identityReportCounts(report.historyRows.map(row=>row.disposition))} onChange={reportOutcome=>updatePreferences({reportOutcome})}/>}
        applied categoryEvidence={report.categoryEvidence} preferences={preferences} onPreferencesChange={updatePreferences} />
    </> : <p className="identity-receipt-note">No completed run receipts yet. Earlier saved history is available in the legacy section above.</p>}
  </div>;
}
