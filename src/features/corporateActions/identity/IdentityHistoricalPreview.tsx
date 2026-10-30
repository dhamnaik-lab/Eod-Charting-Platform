import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import type { NseHistoricalIdentityPreviewRow, NseHistoricalIdentityResult } from '@/types/desktop';
import { filterHistoricalIdentityRows, historicalCategory, IDENTITY_CATEGORIES, type HistoricalChangeFilter, type HistoricalSearchScope } from './historicalIdentitySearch';
import { useIdentityDisplayPreferences, type IdentityDisplayPreferences } from './identityDisplayPreferences';

export function IdentityHistoricalPreview({ rows, total, summary, filters, currentEffects, busy, preferences, onPreferencesChange, categoryEvidence, applied = false, emptyMessage }: {
  rows: NseHistoricalIdentityPreviewRow[]; total: number; summary: ReactNode; filters: ReactNode;
  currentEffects: NseHistoricalIdentityResult['currentUniversePreviewRows']; busy: boolean;
  preferences?: IdentityDisplayPreferences; onPreferencesChange?: (patch: Partial<IdentityDisplayPreferences>) => void;
  categoryEvidence?: NseHistoricalIdentityResult['categoryEvidence']; applied?: boolean; emptyMessage?: string;
}) {
  const [local, setLocal] = useIdentityDisplayPreferences(null);
  const settings = preferences ?? local;
  const update = onPreferencesChange ?? setLocal;
  const { query, scope, changeType, category } = settings;
  const search = useRef<HTMLInputElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const shown = useMemo(() => filterHistoricalIdentityRows(rows, query, scope, changeType, category, categoryEvidence), [rows, query, scope, changeType, category, categoryEvidence]);
  useEffect(() => { if (scroll.current) scroll.current.scrollTop = 0; }, [rows, query, scope, changeType, category]);

  return <div className="identity-historical-preview" onKeyDown={event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
      event.preventDefault(); event.stopPropagation(); search.current?.focus(); search.current?.select();
    }
  }}>
    {summary}
    <div className="identity-historical-search">
      <label className="identity-historical-query">Find
        <input ref={search} type="search" aria-label="Search historical identity" value={query}
          placeholder="Old/current symbol, company name, or effective date"
          onChange={event => update({ query: event.target.value })} onKeyDown={event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); update({ query: '' }); }
          }} />
      </label>
      <label>Search in <select aria-label="Historical search scope" value={scope}
        onChange={event => update({ scope: event.target.value as HistoricalSearchScope })}>
        <option value="all">All fields</option><option value="symbols">Symbols</option>
        <option value="names">Company names</option><option value="dates">Effective dates</option>
      </select></label>
      <label>Type <select aria-label="Historical change type" value={changeType}
        onChange={event => update({ changeType: event.target.value as HistoricalChangeFilter })}>
        <option value="all">All changes</option><option value="SYMBOL_CHANGE">Symbol changes</option>
        <option value="NAME_CHANGE">Name changes</option><option value="BOTH">Combined changes</option>
      </select></label>
      <label>Category <select aria-label="Historical instrument category" value={category}
        onChange={event => update({ category: event.target.value as IdentityDisplayPreferences['category'] })}>
        <option value="all">All categories</option>{Object.entries(IDENTITY_CATEGORIES).map(([key,label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <button type="button" disabled={!query && scope === 'all' && changeType === 'all' && category === 'all'} onClick={() => {
        update({ query: '', scope: 'all', changeType: 'all', category: 'all' }); search.current?.focus();
      }}>Reset search</button>
    </div>
    <div className="identity-historical-filters">
      {filters}
      <span role="status" title="Search and filters affect display only. Apply uses the complete reviewed plan.">
        {shown.length} of {total} historical rows shown · {applied ? 'Saved report' : 'Apply uses full plan'}
      </span>
    </div>
    <div ref={scroll} className="identity-preview-table-scroll identity-historical-scroll" role="region"
      aria-label="Historical identity rows" tabIndex={0} aria-busy={busy}>
      <table className="identity-preview-table identity-historical-table" aria-label="Historical identity changes">
        <thead><tr>{['Outcome', 'Type', 'Category', 'Effective', 'Old symbol', 'New/current', 'Old name', 'New/current name', 'Detail'].map(label => <th key={label}>{label}</th>)}</tr></thead>
        <tbody>{shown.map((row, index) => <tr key={`${row.disposition}-${row.changeType}-${row.effectiveDate}-${row.oldSymbol}-${row.newSymbol}-${index}`}>
          <td>{applied && row.disposition === 'NEW' ? 'APPLIED' : row.disposition}</td><td>{row.changeType}</td>
          <td title={historicalCategory(row,categoryEvidence).evidence}>{IDENTITY_CATEGORIES[historicalCategory(row,categoryEvidence).category]}</td><td>{row.effectiveDate ?? '—'}</td>
          <td>{row.oldSymbol ?? '—'}</td><td>{row.newSymbol ?? row.currentSymbol ?? '—'}</td>
          <td title={row.oldName ?? undefined}>{row.oldName ?? '—'}</td>
          <td title={row.newName ?? undefined}>{row.newName ?? '—'}</td>
          <td title={`${row.sourceFile} | Original review: ${row.detail}`}>{applied && row.disposition === 'NEW' ? 'Saved identity history in this completed run.' : row.detail}</td>
        </tr>)}</tbody>
      </table>
      {shown.length === 0 ? <p className="identity-preview-empty">{!query && changeType === 'all' && category === 'all' && emptyMessage ? emptyMessage : 'No historical rows match the selected filters and search.'}</p> : null}
      <details className="identity-historical-effects" open={settings.effectsOpen} onToggle={event => {
        if (event.currentTarget.open !== settings.effectsOpen) update({ effectsOpen: event.currentTarget.open });
      }}>
        <summary>Current-universe effects from the full reviewed plan ({currentEffects.length} rows)</summary>
        <table className="identity-preview-table" aria-label="Historical current-universe effects">
          <thead><tr>{['Action', 'Symbol', 'Series', 'Current', 'Proposed', 'Match', 'Reason'].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{currentEffects.map(row => <tr key={`${row.action}-${row.symbol}-${row.proposedStatus}`}>
            <td>{row.action}</td><th scope="row" title={[row.companyName, row.isin].filter(Boolean).join(' | ')}>{row.symbol}</th>
            <td>{row.series ?? '—'}</td><td>{row.currentStatus}</td><td>{row.proposedStatus}</td>
            <td>{row.matchedSymbol ?? '—'}</td><td>{row.reason}</td>
          </tr>)}</tbody>
        </table>
        {currentEffects.length === 0 ? <p className="identity-preview-empty">No current-universe status changes in this historical plan.</p> : null}
      </details>
    </div>
  </div>;
}
