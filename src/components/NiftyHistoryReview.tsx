import { useState, type CSSProperties } from 'react';
import { getDesktopApi, type NiftyHistoryPreview } from '@/platform';
import { useChartStore } from '@/store/chartStore';

export function canApproveNiftyHistory(preview: NiftyHistoryPreview | null, approved: boolean, busy: boolean): boolean {
  return Boolean(preview && preview.ready > 0 && preview.officialSha256 && approved && !busy);
}

/** A separate reviewed path; daily Bhavcopy modes retain their existing scope. */
export function NiftyHistoryReview({ disabled = false, onBusyChange }: { disabled?: boolean; onBusyChange?: (busy: boolean) => void }) {
  const api = getDesktopApi();
  const refreshSnapshot = useChartStore((s) => s.refreshSnapshot);
  const [filePath, setFilePath] = useState<string>();
  const [fromDate, setFromDate] = useState('2011-01-01');
  const [toDate, setToDate] = useState('2011-12-31');
  const [preview, setPreview] = useState<NiftyHistoryPreview | null>(null);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const blocked = busy || disabled;
  const invalidate = () => { setPreview(null); setApproved(false); setPage(0); setMessage(''); };

  async function review(verifyOfficial: boolean) {
    if (!api || blocked) return;
    invalidate(); setBusy(true); onBusyChange?.(true);
    try {
      const result = await api.previewNiftyHistory({ filePath, fromDate, toDate, verifyOfficial });
      setPreview(result);
      setMessage(`${result.status}: ${result.ready} new verified bars eligible for approval.`);
    } catch (e) { setMessage(String(e)); }
    finally { setBusy(false); onBusyChange?.(false); }
  }

  const filtered = preview?.rows.filter((r) => filter === 'ALL' || r.status === filter) ?? [];
  return <section aria-label="NIFTY Historical Review" style={box}>
    <strong>NIFTY Back History — official NSE source</strong>
    <p>Download and review NIFTY 50 history before 2012, one year at a time. No CSV file is required.
      Matching existing bars are skipped; conflicting bars are held. Approval is required before adding prices.</p>
    <p>Close-only and pre-launch records stay outside charts, scans and backtests. A successful download does not certify complete trading-session coverage.</p>
    <label>Historical year <select aria-label="NIFTY historical year" disabled={blocked}
      value={fromDate.slice(0, 4) === toDate.slice(0, 4) && Number(fromDate.slice(0, 4)) <= 2011 ? fromDate.slice(0, 4) : ''}
      onChange={(e) => {
        const year = e.target.value;
        if (!year) return;
        invalidate(); setFromDate(year === '1990' ? '1990-07-03' : `${year}-01-01`); setToDate(`${year}-12-31`);
      }}>
      <option value="">Custom range</option>
      {Array.from({ length: 22 }, (_, i) => String(2011 - i)).map((year) => <option key={year}>{year}</option>)}
    </select></label>
    <details style={{ marginTop: 10 }}>
      <summary>Advanced: compare a local NIFTY file</summary>
      <p>Local files remain unverified until compared with official observations.</p>
    <div style={row}>
      <button disabled={blocked || !api} onClick={async () => {
        const paths = await api?.pickCsvFiles();
        if (paths?.[0]) { invalidate(); setFilePath(paths[0]); }
      }}>Select historical CSV</button>
      <button disabled={blocked} onClick={() => { invalidate(); setFilePath(undefined); }}>Use official source</button>
    </div>
    </details>
    <div style={{ overflowWrap: 'anywhere', margin: '8px 0' }}>{filePath ?? 'Official NSE historical index API'}</div>
    <div style={row}>
      <label>From <input aria-label="Historical from date" type="date" value={fromDate} disabled={blocked}
        onChange={(e) => { invalidate(); setFromDate(e.target.value); }} /></label>
      <label>To <input aria-label="Historical to date" type="date" value={toDate} disabled={blocked}
        onChange={(e) => { invalidate(); setToDate(e.target.value); }} /></label>
    </div>
    <p>Official acquisition and verification use one request, up to 366 calendar days. All rows in a local file are audited; only the selected range can be verified.</p>
    <div style={row}>
      <button disabled={blocked || !filePath} onClick={() => void review(false)}>Review local file</button>
      <button disabled={blocked || !api} onClick={() => void review(true)}>{filePath ? 'Verify range with NSE' : 'Fetch and preview official range'}</button>
    </div>
    <div role="status" style={{ marginTop: 8 }}>{busy ? 'Working…' : message}</div>
    {preview && <>
      <p><strong>{preview.sourceRows}</strong> source rows · {preview.ready} ready · {preview.existing} existing · {preview.conflicts} conflicts · {preview.held} held · {preview.rejected} rejected · {preview.closeOnly} close-only</p>
      <p>{preview.certificationScope}</p>
      <div style={{ overflowWrap: 'anywhere' }}>Database: {preview.databasePath}<br />
        Source SHA-256: {preview.sourceSha256}<br />Evidence: {preview.evidencePath}</div>
      <div style={row}>
        <label>Outcome <select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }}>
          {['ALL', 'READY', 'EXISTING', 'CONFLICT', 'HOLD', 'REJECTED'].map((s) => <option key={s}>{s}</option>)}
        </select></label>
        <button disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
        <span>{filtered.length ? page * 25 + 1 : 0}–{Math.min((page + 1) * 25, filtered.length)} of {filtered.length}</span>
        <button disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage(page + 1)}>Next</button>
      </div>
      <div style={{ maxHeight: 240, overflow: 'auto' }}><table style={{ width: '100%', fontSize: 11 }}>
        <thead><tr><th>Date / name</th><th>OHLC</th><th>Outcome</th></tr></thead>
        <tbody>{filtered.slice(page * 25, (page + 1) * 25).map((r, i) => <tr key={`${r.date}-${i}`}>
          <td>{r.date}<br />{r.originalName}</td><td>{[r.open,r.high,r.low,r.close].map((v) => v ?? '—').join(' / ')}</td>
          <td>{r.status}<br />{r.reason}</td>
        </tr>)}</tbody>
      </table></div>
      <label style={{ display: 'block', margin: '10px 0' }}><input type="checkbox" checked={approved} disabled={blocked || !preview.ready}
        onChange={(e) => setApproved(e.target.checked)} /> I approve the {preview.ready} verified new bars for this database. Existing bars will be preserved.</label>
      <button disabled={!canApproveNiftyHistory(preview, approved, blocked)} onClick={async () => {
        if (!api || !canApproveNiftyHistory(preview, approved, blocked)) return;
        setBusy(true); onBusyChange?.(true); setApproved(false);
        try {
          const result = await api.applyNiftyHistory({ token: preview.token, approved: true });
          setMessage(`${result.success ? 'Complete' : 'Import needs recovery review'}: ${result.rowsInserted} inserted, ${result.rowsSkipped} already present, ${result.rowsError} errors. ${result.errors.join(' ')} Recovery: ${result.recoverySession?.sessionId ?? 'no changes'}.`);
          setPreview(null);
          await refreshSnapshot();
        } catch (e) { setMessage(String(e)); }
        finally { setBusy(false); onBusyChange?.(false); }
      }}>Approve and import verified new bars</button>
      <p>Undo and interrupted-import recovery are available in Import CSV → Manual Import Recovery.</p>
    </>}
  </section>;
}

const box: CSSProperties = { border: '1px solid var(--border)', borderRadius: 6, padding: 10, fontSize: 12, maxHeight: '65vh', overflowY: 'auto', flexShrink: 0 };
const row: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '8px 0' };
