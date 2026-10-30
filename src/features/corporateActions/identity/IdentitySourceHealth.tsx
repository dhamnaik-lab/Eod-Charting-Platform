import { useState } from 'react';
import type { OfficialSourceHealthReport, OfficialSourceHealthResult } from '@/platform';
import { CorporateActionClassicDialog } from '../workspace/CorporateActionClassicWorkspace';
import { identityHealthSummary, identityStatusText, isIdentitySourceHealthy, parseIdentityDiagnostic } from './identityImportModel';

export function IdentitySourceHealth({ report, exchange, busy, canRecover, onRecover }: {
  report: OfficialSourceHealthReport | null;
  exchange: 'NSE' | 'BSE';
  busy: boolean;
  canRecover: (result: OfficialSourceHealthResult) => boolean;
  onRecover: (result: OfficialSourceHealthResult) => void;
}) {
  const [scope, setScope] = useState<'selected' | 'all'>('selected');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const summary = identityHealthSummary(report, exchange);
  const rows = scope === 'all' ? report?.results ?? [] : summary.results;
  const selected = report?.results.find(result => result.sourceId === selectedId);
  const diagnostic = parseIdentityDiagnostic(selected?.diagnostic);
  const attention = rows.filter(result => !isIdentitySourceHealthy(result)).length;
  return <section className="identity-source-health" aria-label="Official source diagnostics">
    <div className="identity-diagnostics-heading"><strong>Official source health</strong>
      <label>Show <select value={scope} onChange={event => setScope(event.target.value as 'selected' | 'all')}>
        <option value="selected">{exchange} sources</option><option value="all">All exchanges</option>
      </select></label>
    </div>
    <p>{report ? `${scope === 'all' ? 'All exchanges' : exchange}: ${rows.length} sources · ${attention} need attention · Checked ${report.assessedAtUtc}`
      : 'No completed health check. Check Source Health checks all configured NSE and BSE sources.'}</p>
    {report ? <div className="identity-source-table-scroll"><table className="identity-source-table">
      <thead><tr><th>Source</th><th>Exchange</th><th>Status</th><th>Rows</th><th>Explanation</th><th>Evidence</th></tr></thead>
      <tbody>{rows.map(result => <tr key={result.sourceId}>
        <th scope="row">{result.role}</th><td>{result.exchange}</td>
        <td>{isIdentitySourceHealthy(result) ? 'Healthy' : 'Needs attention'}</td>
        <td>{result.populationCount ?? '—'}</td>
        <td><span className="identity-source-reason" title={result.reason}>{identityStatusText(result.reason)}</span></td>
        <td><button type="button" aria-label={`Details for ${result.role}`} onClick={() => setSelectedId(result.sourceId)}>Details</button></td>
      </tr>)}</tbody>
    </table>{rows.length === 0 ? <p>No {exchange} results in this report.</p> : null}</div> : null}
    {selected ? <CorporateActionClassicDialog title={`${selected.exchange} source evidence`} onClose={() => setSelectedId(null)}>
      <h3>{selected.role}</h3><p>{identityStatusText(selected.reason)}</p>
      <dl className="identity-diagnostic-fields">
        {Object.entries({
          'Source ID': selected.sourceId, 'Checked at': report?.assessedAtUtc,
          'Provenance': selected.provenanceStatus, 'Transport': selected.transportStatus,
          'HTTP status': selected.httpStatus, 'Format': selected.formatStatus,
          'Population': selected.populationStatus, 'Rows': selected.populationCount,
          'Freshness': selected.freshnessStatus, 'Drift': selected.driftClass,
          'Request URL': selected.requestUrl, 'Final URL': selected.finalUrl,
          'Bytes': selected.contentBytes, 'SHA-256': selected.contentSha256,
          'Captured at': diagnostic?.capturedAtUtc, 'Retained evidence': diagnostic?.retainedDiagnosticPath,
          'Retention error': diagnostic?.retentionError,
        }).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value == null ? '—' : String(value)}</dd></div>)}
      </dl>
      {Array.isArray(diagnostic?.csvHeaders) ? <section><h3>Observed CSV columns</h3>
        <ul>{diagnostic.csvHeaders.filter(value => typeof value === 'string').map((value, index) => <li key={index}>{String(value)}</li>)}</ul>
      </section> : null}
      <details><summary>Technical validation details</summary><pre className="identity-diagnostic-raw">{selected.reason}</pre></details>
      {selected.diagnostic ? <details><summary>Raw diagnostic JSON</summary><pre className="identity-diagnostic-raw">{selected.diagnostic}</pre></details> : null}
      {canRecover(selected) ? <section><h3>Source maintenance</h3>
        <p>For a column mismatch, review parser compatibility first. Replacement discovery is for reviewing an alternative official source.</p>
        <button type="button" disabled={busy} onClick={() => { setSelectedId(null); onRecover(selected); }}>Find Official Replacement Candidates</button>
      </section> : null}
    </CorporateActionClassicDialog> : null}
  </section>;
}
