import { useEffect, useRef, useState } from 'react';
import type { BseNameHistoryResult, BseNameHistoryRow, BseNameHistoryRun, IdentityApplyProgress, IdentityInstrumentCategory } from '@/types/desktop';
import type { DesktopApi } from '@/platform';
import { useIdentityDisplayPreferences, type IdentityDisplayPreferences } from './identityDisplayPreferences';
import { IDENTITY_CATEGORIES, type HistoricalSearchScope } from './historicalIdentitySearch';
import { legacySavedTime } from './HistoricalApplyHistory';
import { bseNameHistoryReview, useIdentityApplyConfirmation } from './IdentityApplyConfirmation';
import { IdentityEvidenceValue, IdentityReportFilters } from './IdentityReceiptControls';
import { identityReportCounts, matchesIdentityReportOutcome, type IdentityReportOutcome } from './identityReceiptPresentation';

const COVERAGE = 'Company-name history only. Dates are published BSE change dates. Security ID changes remain held until dated evidence is verified.';
export function bseNameHistoryReason(row: BseNameHistoryRow, applied: boolean) {
  return applied && row.outcome==='NEW' ? 'Saved company-name history by exact BSE security code. Trading ID and lifecycle were not changed by this run.' : row.reason;
}
export function bseNameCategory(row: BseNameHistoryRow): IdentityInstrumentCategory {
  const explicit = (raw: string): IdentityInstrumentCategory | null => {
    const name = ` ${raw.toUpperCase().replace(/[-()]/g,' ')} `;
    if (name.includes(' ETF ') || name.includes(' EXCHANGE TRADED FUND ')) return 'etf';
    if (name.includes(' MUTUAL FUND ') || name.includes(' FIXED TERM FUND ')) return 'mutualFund';
    if (name.includes(' REAL ESTATE INVESTMENT TRUST ') || name.includes(' INFRASTRUCTURE INVESTMENT TRUST ')) return 'reitInvit';
    if (name.includes(' SOVEREIGN GOLD BOND ') || name.includes(' DEBENTURE ')) return 'debt';
    return null;
  };
  const categories = new Set([explicit(row.oldName),explicit(row.newName)].filter(Boolean));
  return categories.size === 1 ? [...categories][0]! : 'unknown';
}
export function filterBseNameRows(rows: BseNameHistoryRow[], query: string, outcome: string, scope: HistoricalSearchScope = 'all', category: 'all' | IdentityInstrumentCategory = 'all', applied = false) {
  const terms=query.trim().toLocaleUpperCase().split(/\s+/).filter(Boolean);
  return rows.filter(r => {
    const fields=scope === 'symbols' ? [r.securityCode,r.currentId] : scope === 'names' ? [r.oldName,r.newName] : scope === 'dates' ? [r.sourceDate,r.sourceDate.split('-').reverse().join('/')] : [r.securityCode,r.currentId,r.oldName,r.newName,r.sourceDate,r.reason,bseNameHistoryReason(r,applied),applied && r.outcome==='NEW' ? 'APPLIED' : r.outcome];
    return terms.every(t=>fields.join(' ').toLocaleUpperCase().includes(t)) && (category==='all' || bseNameCategory(r)===category)
      && (outcome === 'all' || (outcome === 'actionable' ? r.outcome === 'NEW' : outcome === 'duplicates' ? r.outcome === 'DUPLICATE' : outcome === 'skipped' ? r.outcome === 'SKIPPED' || r.outcome === 'HELD' : false));
  });
}
export function BseNameTable({ result, query = '', outcome = 'all', scope = 'all', category = 'all', reportOutcome }: {
  result: BseNameHistoryResult; query?: string; outcome?: string; scope?: HistoricalSearchScope; category?: 'all' | IdentityInstrumentCategory; reportOutcome?: IdentityReportOutcome;
}) {
  const rows = filterBseNameRows(result.rows,query,outcome,scope,category,result.applied).filter(row=>!result.applied || !reportOutcome || matchesIdentityReportOutcome(row.outcome,reportOutcome));
  return <><span>{rows.length} of {result.rows.length} name records shown · {result.applied ? 'Saved report; filters change the view only' : 'Apply uses the full reviewed plan'}</span>
    <div className="identity-preview-table-scroll"><table className="identity-preview-table"><thead><tr>
      {['Outcome','Security code','Matched current ID','Category','BSE change date','Old name','New name','Reason'].map(h => <th key={h} style={h==='Outcome' ? {minWidth:100,whiteSpace:'nowrap'} : undefined}>{h}</th>)}
    </tr></thead><tbody>{rows.map((r,i) => <tr key={i}>
      <td style={{ minWidth:100, whiteSpace:'nowrap' }}>{result.applied && r.outcome === 'NEW' ? 'APPLIED' : r.outcome}</td>
      <td>{r.securityCode}</td><td>{r.currentId ?? '—'}</td><td title="Display category uses explicit source name wording only. Equity membership is not established by this name-history source.">{IDENTITY_CATEGORIES[bseNameCategory(r)]}</td><td style={{ whiteSpace:'nowrap' }}>{r.sourceDate}</td><td>{r.oldName}</td><td>{r.newName}</td><td title={result.applied && r.outcome==='NEW' ? `Original review reason: ${r.reason}` : undefined}>{bseNameHistoryReason(r,result.applied)}</td>
    </tr>)}</tbody></table>{!rows.length ? <p>No company-name records match these filters.</p> : null}</div></>;
}

export function useBseNameHistory({ api, databasePath, exchange, mode, busy, setBusy, preferences, updatePreferences, active = true }: {
  api: DesktopApi | null; databasePath: string | null; exchange: string; mode: 'official' | 'manual'; busy: boolean;
  setBusy: (busy: boolean) => void; preferences: IdentityDisplayPreferences;
  updatePreferences: (patch: Partial<IdentityDisplayPreferences>) => void;
  active?: boolean;
}) {
  const context = `${databasePath}|${exchange}|${mode}`;
  const live = useRef(context); live.current = context;
  const [entry,setEntry] = useState<{context:string;result:BseNameHistoryResult} | null>(null);
  const [manualPath,setManualPath] = useState('');
  const [progress,setProgress] = useState<IdentityApplyProgress | null>(null);
  const [error,setError] = useState<string | null>(null);
  const [message,setMessage] = useState('');
  const [operation,setOperation]=useState<'refresh'|'preview'|'apply'|null>(null);
  const inFlight = useRef(false);
  useEffect(() => { setEntry(null); setProgress(null); setError(null); setMessage(''); setManualPath('');setOperation(null); }, [context]);
  const result = entry?.context === context ? entry.result : null;
  const saved = result?.applied || progress?.stage === 'committed' || progress?.stage === 'refreshing';
  const valid = Boolean(result?.canApply && !result.applied && result.newNameChanges > 0);
  const confirmation=useIdentityApplyConfirmation(JSON.stringify([context,preferences.view,manualPath,result?.planSha256,valid,busy,active]));
  const run = async (action: 'refresh' | 'preview' | 'apply') => {
    if (!api || !databasePath || busy || inFlight.current || exchange !== 'BSE') return;
    const captured = context;
    const current = () => live.current === captured;
    if (action === 'apply' && (!valid || !result)) return;
    if (action === 'apply' && !await confirmation.confirm(bseNameHistoryReview(result!,databasePath))) return;
    if (!current() || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(null); setMessage('');setOperation(action);
    if(action==='apply')setProgress({stage:'checking',processed:0,total:0,percent:null});
    if (action !== 'apply') { setEntry(null); setProgress(null); }
    try {
      if (action === 'refresh') {
        const source = await api.refreshBseNameHistory();
        if (current()) setMessage(`BSE company-name source saved · ${source.rows} records. Preview Historical Identity to review.`);
      } else {
        const input = { sourceMode: mode, ...(mode === 'manual' ? { filePath: manualPath.trim() } : {}) };
        const next = action === 'preview' ? await api.previewBseNameHistory(input)
          : await api.applyBseNameHistory({ ...input, expectedPlanSha256: result!.planSha256, expectedDatabasePath: databasePath }, p => { if (current()) setProgress(p); });
        if (current()) { setEntry({context:captured,result:next}); setMessage(next.applied ? 'Completed · Company-name history saved. View Recent Applied.' : 'Reviewed BSE company-name preview available.'); }
      }
    } catch (e) { if (current()) { setError(String(e)); if (action === 'apply') setEntry(null); } }
    finally { inFlight.current = false; setBusy(false);if(current())setOperation(null); }
  };
  const controls = mode === 'manual' ? <label className="identity-list-toolbar">BSE company-name CSV
    <input style={{flex:1}} value={manualPath} disabled={busy} placeholder="Path to official-format Comp_Name.csv"
      onChange={e => { setManualPath(e.target.value); setEntry(null); setError(null); setProgress(null); }} />
    <button type="button" disabled={busy || !api} onClick={() => { void (async () => {
      const captured=context;
      try { const path=await api?.pickPluginDataFile({title:'BSE company-name history CSV',filterName:'CSV Files',extensions:['csv']});
        if (path && live.current===captured) { setManualPath(path);setEntry(null);setProgress(null);setError(null); }
      } catch(e) { if(live.current===captured)setError(String(e)); }
    })(); }}>Browse File</button></label> : null;
  const toolbar = <>{mode === 'official' ? <button disabled={busy || !databasePath} onClick={() => void run('refresh')}>Refresh BSE Sources</button> : null}
    <button disabled={busy || !databasePath || (mode === 'manual' && !manualPath.trim())} onClick={() => void run('preview')}>Preview Historical Identity</button></>;
  const panel = <>
    <p className="identity-review-note">{COVERAGE}</p>
    {operation && operation!=='apply' ? <section role="status" className="identity-apply-status is-running"><strong>{operation==='refresh' ? 'Refreshing official BSE company-name source…' : 'Previewing saved BSE company-name history…'}</strong><progress aria-label="BSE company-name source operation"/></section> : null}
    {progress || error ? <section role="status" className={`identity-apply-status ${saved ? 'is-complete' : error ? 'is-error' : 'is-running'}`}>
      <strong>{saved ? 'Completed · Database saved · 100%' : error ? 'Operation failed' : `${progress?.stage ?? 'Checking'}${progress?.percent != null ? ` · ${progress.percent}%` : ''}`}</strong>
      {!error || saved ? <progress max={100} value={saved ? 100 : progress?.percent ?? undefined} /> : null}
      {error ? <span>{saved ? 'Commit confirmed; retrieve the receipt in Recent Applied. ' : ''}{error}</span> : null}
    </section> : null}
    {message ? <p role="status">{message}</p> : null}
    {result?.warning ? <p role="status">{result.warning}</p> : null}
    {result ? <>
      <div className="identity-outcome-filters"><strong>Names {result.newNameChanges} · Duplicates {result.duplicateRows} · Skipped {result.skippedRows} · Held {result.heldRows}</strong></div>
      <label className="identity-list-toolbar">Find <input type="search" style={{flex:1}} value={preferences.query} placeholder="Security code, current ID, old/new company name or date"
        onChange={e => updatePreferences({query:e.target.value})} />
        Search in <select aria-label="BSE history search scope" value={preferences.scope} onChange={e=>updatePreferences({scope:e.target.value as HistoricalSearchScope})}>
          <option value="all">All fields</option><option value="symbols">Security code / ID</option><option value="names">Company names</option><option value="dates">Dates</option></select>
        Category <select aria-label="BSE history category" value={preferences.category} onChange={e=>updatePreferences({category:e.target.value as IdentityDisplayPreferences['category']})}>
          <option value="all">All categories</option>{Object.entries(IDENTITY_CATEGORIES).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select>
        <button onClick={()=>updatePreferences({query:'',scope:'all',category:'all',outcome:'all'})}>Reset search</button>
      </label>
      <div className="identity-outcome-filters">{(['actionable','all','duplicates','skipped','errors'] as const).map(value => <button key={value} aria-pressed={preferences.outcome===value} onClick={() => updatePreferences({outcome:value})}>{value==='skipped' ? 'Skipped / Held' : value}</button>)}</div>
      <span className="identity-review-note">Categories use explicit source wording. Unproven categories remain Unknown; category filters only change this view.</span>
      <BseNameTable result={result} query={preferences.query} outcome={preferences.outcome} scope={preferences.scope} category={preferences.category} />
    </> : !busy && !error ? <p>Not previewed. Refresh BSE Sources, then preview the saved company-name history.</p> : null}
  </>;
  const footer = <><div><strong>{saved ? 'Completed — company-name history saved' : result && !result.newNameChanges ? 'Up to date — nothing to apply' : result ? `${result.newNameChanges} new name records` : 'Not previewed'}</strong>
    <span className="identity-review-note">{valid ? 'Reviewed plan available. Apply requires confirmation.' : 'Company names only · Security ID changes held'}</span></div>
    <button disabled={busy || !databasePath || !valid} onClick={() => void run('apply')}>Apply Reviewed Historical Identity</button></>;
  const sourceSummary=<div><p>{COVERAGE}</p><p>{mode==='official' ? 'Official BSE Change of Company Names page → exact all-history API. Refresh and Preview validate this name source separately from current-master health checks.' : 'Manual Comp_Name.csv: Security Code, Old Name, New Name, Date. Provenance remains Manual.'}</p>
    <p>{result ? `${result.rows.length} source rows · ${result.filePath} · SHA-256 ${result.sourceSha256}` : 'Saved-source availability has not been checked by a name-history preview.'}</p></div>;
  return { toolbar, controls, panel, footer, sourceSummary, confirmationDialog:confirmation.dialog, latest: result?.applied ? result : null };
}

export function BseNameHistoryReports({ api, latest, preferenceKey }: { api: DesktopApi; latest: BseNameHistoryResult | null; preferenceKey?: string | null }) {
  const [preferences,updatePreferences,settingsWarning]=useIdentityDisplayPreferences(preferenceKey ?? null);
  const [runs,setRuns] = useState<BseNameHistoryRun[]>([]);
  const [report,setReport] = useState<BseNameHistoryResult | null>(latest);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const generation = useRef(0);
  const refresh = async () => { const id=++generation.current; setLoading(true); setError(''); try {
    const next=await api.listBseNameHistoryRuns(); if(id!==generation.current)return;setRuns(next);
    const selected=next.find(r=>r.runId===preferences.selectedRunId) ?? next[0];
    const saved=selected ? await api.getBseNameHistoryReport(selected.runId) : latest;
    if(id===generation.current)setReport(saved);
  } catch(e) { if(id===generation.current)setError(String(e)); } finally { if(id===generation.current)setLoading(false); } };
  useEffect(() => { void refresh(); return () => { ++generation.current; }; }, []);
  const select = async (runId: string) => { updatePreferences({selectedRunId:runId});const id=++generation.current; setLoading(true); setError(''); try { const next=await api.getBseNameHistoryReport(runId); if(id===generation.current)setReport(next); } catch(e) { if(id===generation.current)setError(String(e)); } finally { if(id===generation.current)setLoading(false); } };
  return <section className="identity-historical-preview"><div className="identity-list-toolbar"><strong>BSE company-name Apply reports</strong><button disabled={loading} onClick={() => void refresh()}>Refresh Name Reports</button><span>Most recent 50 completed runs</span></div>
    <p>{COVERAGE}</p>{error ? <p role="alert">{error}</p> : null}
    {settingsWarning ? <p role="status">Report settings could not be saved; retained for this session.</p> : null}
    <div className="identity-history-run-list">{runs.map(r => <button key={r.runId} disabled={loading} aria-pressed={report?.runId===r.runId} onClick={() => void select(r.runId)} title={legacySavedTime(r.completedAt).utc}>{legacySavedTime(r.completedAt).label} · {r.newNameChanges} names</button>)}</div>
    {!loading && !runs.length && !report?.applied ? <p>No completed company-name Apply receipts yet.</p> : null}
    {report ? <><p>Run {report.runId} · Saved <span title={legacySavedTime(report.completedAt).utc}>{legacySavedTime(report.completedAt).label}</span></p>
      <details className="identity-receipt-evidence" open={preferences.runEvidenceOpen} onToggle={e=> {if(e.currentTarget.open!==preferences.runEvidenceOpen)updatePreferences({runEvidenceOpen:e.currentTarget.open});}}><summary>Run evidence and source hashes</summary><dl className="identity-diagnostic-fields">
        <div><dt>Source mode</dt><dd>{report.sourceMode}</dd></div>
        <div><dt>Source path</dt><dd><IdentityEvidenceValue label="source path" value={report.filePath} path/></dd></div>
        <div><dt>Source SHA-256</dt><dd><IdentityEvidenceValue label="source SHA-256" value={report.sourceSha256}/></dd></div>
        <div><dt>Reviewed plan SHA-256</dt><dd><IdentityEvidenceValue label="reviewed plan SHA-256" value={report.planSha256}/></dd></div>
      </dl></details><label className="identity-list-toolbar">Find saved name history <input type="search" style={{flex:1}} value={preferences.legacyQuery} onChange={e=>updatePreferences({legacyQuery:e.target.value})}/></label>
      <IdentityReportFilters value={preferences.reportOutcome} counts={identityReportCounts(report.rows.map(row=>row.outcome))} onChange={reportOutcome=>updatePreferences({reportOutcome})}/>
      <BseNameTable result={report} query={preferences.legacyQuery} reportOutcome={preferences.reportOutcome}/></> : null}
  </section>;
}
