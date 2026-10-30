import { useState, type ReactNode } from 'react';
import { CorporateActionClassicDialog } from '../workspace/CorporateActionClassicWorkspace';

export interface IdentityPreviewRow {
  source: 'NSE' | 'BSE';
  action: string;
  symbol: string;
  companyName: string | null;
  isin: string | null;
  series: string | null;
  currentStatus: string;
  proposedStatus: string;
  matchValue: string | null;
  reason: string;
}

export function IdentityPreviewTable({ rows, loaded, total, busy, sourceMode = 'official', applied = false, toolbar }: {
  rows: IdentityPreviewRow[]; loaded: boolean; total: number; busy: boolean; sourceMode?: 'official' | 'manual'; applied?: boolean; toolbar?: ReactNode;
}) {
  const [selected, setSelected] = useState<IdentityPreviewRow | null>(null);
  const [filter, setFilter] = useState('all');
  const outcome = (row: IdentityPreviewRow) => row.action === 'REVIEW_REQUIRED' ? 'Held for review'
    : row.action === 'OUTSIDE_COVERAGE' ? 'Outside coverage'
      : ['INSERT', 'REACTIVATE', 'UPDATE', 'DEACTIVATE', 'OLD_SYMBOL', 'DELISTED', 'SUSPENDED'].includes(row.action) ? 'Applied' : 'Unchanged';
  const shown = rows.filter(row => !applied || filter === 'all' || outcome(row) === filter);
  return <>
    {toolbar || applied ? <div className="identity-list-toolbar">
    {toolbar ? <div className="identity-list-search">{toolbar}</div> : null}
    {applied ? <div className="identity-outcome-filters" aria-label="Applied result filters">
      {['all', 'Applied', 'Held for review', 'Outside coverage'].map(value => <button key={value} type="button"
        aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'All outcomes' : value}
        {' '}{value === 'all' ? rows.length : rows.filter(row => outcome(row) === value).length}</button>)}
      <span>Applied result · {shown.length} rows shown</span>
    </div> : null}
    </div> : null}
    <div className="identity-preview-table-scroll" aria-busy={busy}>
      <table className="identity-preview-table"><thead><tr>
        {applied ? <th>Outcome</th> : null}<th>Action</th><th>Symbol</th><th>Series</th><th>{applied ? 'Before' : 'Current'}</th><th>{applied ? 'After' : 'Proposed'}</th><th>Match / Code</th><th>Reason</th><th>Details</th>
      </tr></thead><tbody>{shown.map((row, index) => <tr key={`${row.source}-${row.action}-${row.symbol}-${index}`}>
        {applied ? <td className={outcome(row) === 'Applied' ? 'identity-outcome-applied' : 'identity-outcome-held'}>{outcome(row)}</td> : null}<td>{row.action}</td><th scope="row" title={row.companyName ?? undefined}>{row.symbol}</th>
        <td>{row.series ?? '—'}</td><td>{row.currentStatus}</td><td>{row.proposedStatus}</td>
        <td>{row.matchValue ?? '—'}</td><td>{applied && outcome(row) === 'Applied' ? 'Saved successfully. Open Details for the original review reason.' : row.reason}</td>
        <td><button type="button" onClick={() => setSelected(row)} aria-label={`Identity details for ${row.symbol}`}>Details</button></td>
      </tr>)}</tbody></table>
      {shown.length === 0 ? <p className="identity-preview-empty" role="status">
        {busy ? 'Working on identity sources…' : !loaded
          ? sourceMode === 'manual' ? 'Not previewed. Select a manual source and choose Preview Changes.'
            : 'Not previewed. Choose Refresh & Preview or preview your saved sources.'
          : total === 0 ? applied ? 'Completed with no symbol-status changes.' : 'Preview loaded with no symbol-status changes.'
            : 'No identity changes match this filter.'}
      </p> : null}
    </div>
    {selected ? <CorporateActionClassicDialog title={applied ? 'Identity apply result' : ['REVIEW_REQUIRED', 'OUTSIDE_COVERAGE'].includes(selected.action) ? 'Identity review details' : 'Proposed identity change'} onClose={() => setSelected(null)}>
      <dl className="identity-diagnostic-fields">{Object.entries({
        Exchange: selected.source, Symbol: selected.symbol, Company: selected.companyName, ISIN: selected.isin,
        ...(applied ? { Outcome: outcome(selected) } : {}), Series: selected.series, Action: selected.action,
        ...(applied ? { Before: selected.currentStatus, After: selected.proposedStatus }
          : { Current: selected.currentStatus, Proposed: selected.proposedStatus }),
        'Match / Code': selected.matchValue, [applied ? 'Original review reason' : 'Reason']: selected.reason,
      }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
      <p>{applied ? 'Saved apply receipt. Before and After describe this completed run; the reason above is the original review evidence. Held and outside-coverage rows were not changed.'
        : selected.action === 'REVIEW_REQUIRED' ? 'Held for review — this record will not be changed. Its existing active status is retained until sufficient identity or delisting evidence is established.'
          : selected.action === 'OUTSIDE_COVERAGE' ? 'Outside source coverage — this record will not be changed. Absence from this master is not evidence of inactivity.'
            : 'This is a preview. Identity changes require Apply Reviewed Changes and its confirmation.'}</p>
    </CorporateActionClassicDialog> : null}
  </>;
}
