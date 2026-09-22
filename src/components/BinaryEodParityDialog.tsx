import { useState, useMemo, useEffect } from 'react';
import { getDesktopApi, type ParityIssue, type ParityIssueType, type ValidationReport } from '@/platform';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';

export function BinaryEodParityDialog() {
  const api = getDesktopApi();
  const BINARY_PARITY_WINDOW_ID = 'binary-parity-audit';

  const snapshot = useChartStore((state) => state.snapshot);
  const binaryEodParityOpen = useUiStore((state) => state.binaryEodParityOpen);
  const openRequestCount = useUiStore((state) => state.binaryEodParityOpenRequestCount);
  const closeBinaryEodParity = useUiStore((state) => state.closeBinaryEodParity);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [scope, setScope] = useState<'global' | 'exchange' | 'symbol'>('global');
  const [exchange, setExchange] = useState('NSE');
  const [symbol, setSymbol] = useState('');
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    registerWindow({
      id: BINARY_PARITY_WINDOW_ID,
      title: 'Binary EOD Parity Audit',
      bounds: {
        x: 150,
        y: 80,
        width: 900,
        height: 600,
      },
      minWidth: 700,
      minHeight: 400,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (binaryEodParityOpen) {
      openWindow(BINARY_PARITY_WINDOW_ID);
      focusWindow(BINARY_PARITY_WINDOW_ID);
    } else {
      closeWindow(BINARY_PARITY_WINDOW_ID);
    }
  }, [binaryEodParityOpen, openWindow, focusWindow, closeWindow]);

  useEffect(() => {
    if (binaryEodParityOpen && openRequestCount > 0) {
      openWindow(BINARY_PARITY_WINDOW_ID);
      focusWindow(BINARY_PARITY_WINDOW_ID);
    }
  }, [openRequestCount, binaryEodParityOpen, openWindow, focusWindow]);

  const handleClose = () => {
    closeWindow(BINARY_PARITY_WINDOW_ID);
    closeBinaryEodParity();
  };

  const runValidation = async () => {
    if (!api) {
      return;
    }
    setBusy(true);
    setStatus('Running parity validation...');
    setReport(null);
    try {
      const result = await api.validateBinaryParity({
        scope,
        exchange: scope !== 'global' ? exchange.trim().toUpperCase() : null,
        symbol: scope === 'symbol' ? symbol.trim().toUpperCase() : null,
        quickCheck: true,
      });
      setReport(result);
      setStatus(
        result.issuesFound === 0
          ? `Validated ${result.symbolsProcessed} symbols. No issues found.`
          : `Validation finished in ${result.durationMs}ms. Found ${result.issuesFound} issues across ${result.symbolsProcessed} symbols.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Validation failed.');
    } finally {
      setBusy(false);
    }
  };

  const copyReportToClipboard = () => {
    if (!report) {
      return;
    }
    void navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setStatus('Report JSON copied to clipboard.');
  };

  const visibleIssues = useMemo(() => {
    if (!report) {
      return [];
    }
    return report.issues.slice(0, 500); // Limit rendering for performance
  }, [report]);

  const issueCounts = useMemo(() => {
    if (!report) {
      return null;
    }
    const counts: Record<string, number> = {};
    for (const issue of report.issues) {
      counts[issue.issueType] = (counts[issue.issueType] || 0) + 1;
    }
    return counts;
  }, [report]);

  const hasDatabase = Boolean(snapshot?.activeDatabasePath);

  if (!binaryEodParityOpen) {
    return null;
  }

  return (
    <FloatingWindow id={BINARY_PARITY_WINDOW_ID} onClose={handleClose}>
      <div style={modalBodyStyle}>
          <div style={auditControlsStyle}>
            <div style={utilityFormGridStyle}>
              <div style={utilityFieldLabelStyle}>Scope:</div>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as 'global' | 'exchange' | 'symbol')}
                style={utilityInputStyle}
                disabled={busy}
              >
                <option value="global">Global (All Symbols)</option>
                <option value="exchange">Exchange</option>
                <option value="symbol">Single Symbol</option>
              </select>

              {scope !== 'global' ? (
                <>
                  <div style={utilityFieldLabelStyle}>Exchange:</div>
                  <input
                    value={exchange}
                    onChange={(e) => setExchange(e.target.value)}
                    style={utilityInputStyle}
                    placeholder="NSE"
                    disabled={busy}
                  />
                </>
              ) : null}

              {scope === 'symbol' ? (
                <>
                  <div style={utilityFieldLabelStyle}>Symbol:</div>
                  <input
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    style={utilityInputStyle}
                    placeholder="RELIANCE"
                    disabled={busy}
                  />
                </>
              ) : null}
            </div>

            <div style={actionRowStyle}>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => void runValidation()}
                disabled={busy || !hasDatabase}
              >
                {busy ? 'Running...' : 'Run Validation'}
              </button>
              {report ? (
                <button type="button" style={modalButtonStyle} onClick={copyReportToClipboard}>
                  Copy JSON
                </button>
              ) : null}
            </div>
          </div>

          <div style={utilityStatusStyle}>{status || 'Select scope and run validation to check SQLite vs Binary parity.'}</div>

          {report ? (
            <div style={reportContainerStyle}>
              <div style={summaryPanelStyle}>
                <div style={summaryItemStyle}>
                  <span style={summaryLabelStyle}>Symbols Checked:</span>
                  <span style={summaryValueStyle}>{report.symbolsProcessed}</span>
                </div>
                <div style={summaryItemStyle}>
                  <span style={summaryLabelStyle}>Issues Found:</span>
                  <span style={{ ...summaryValueStyle, color: report.issuesFound > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {report.issuesFound}
                  </span>
                </div>
                {issueCounts && Object.keys(issueCounts).length > 0 ? (
                  <div style={issueBreakdownStyle}>
                    {Object.entries(issueCounts).map(([type, count]) => (
                      <div key={type} style={breakdownTagStyle}>
                        {type}: {count}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {report.issues.length > 0 ? (
                <div style={tableFrameStyle}>
                  <div style={tableHeaderStyle}>
                    <span>Exch</span>
                    <span>Symbol</span>
                    <span>Issue</span>
                    <span>SQL Count</span>
                    <span>Bin Count</span>
                    <span>SQL Range</span>
                    <span>Bin Range</span>
                  </div>
                  <div style={tableBodyStyle}>
                    {visibleIssues.map((issue: ParityIssue, idx: number) => (
                      <div key={`${issue.exchange}:${issue.symbol}:${idx}`} style={tableRowStyle}>
                        <span>{issue.exchange}</span>
                        <span style={{ fontWeight: 600 }}>{issue.symbol}</span>
                        <span style={issueTypeStyle(issue.issueType)}>{issue.issueType}</span>
                        <span>{issue.sqliteCount}</span>
                        <span>{issue.binaryCount}</span>
                        <span style={dateRangeStyle}>{formatRange(issue.sqliteFirstDate, issue.sqliteLastDate)}</span>
                        <span style={dateRangeStyle}>{formatRange(issue.binaryFirstDate, issue.binaryLastDate)}</span>
                      </div>
                    ))}
                    {report.issues.length > 500 ? (
                      <div style={truncatedMessageStyle}>... and {report.issues.length - 500} more issues (truncated for display)</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
    </FloatingWindow>
  );
}

function formatRange(start: string | null | undefined, end: string | null | undefined): string {
  if (!start && !end) return '-';
  return `${start?.slice(2) || '?'}..${end?.slice(2) || '?'}`;
}

function issueTypeStyle(type: ParityIssueType): React.CSSProperties {
  switch (type) {
    case 'BINARY_MISSING':
      return { color: 'var(--yellow, #f59e0b)' };
    case 'FILE_CORRUPT':
      return { color: 'var(--red)', fontWeight: 700 };
    case 'COUNT_MISMATCH':
    case 'DATE_RANGE_MISMATCH':
      return { color: 'var(--red)' };
    default:
      return {};
  }
}

const modalBodyStyle: React.CSSProperties = {
  padding: 16,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  flex: 1,
};

const auditControlsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 20,
};

const utilityFormGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '80px 200px',
  gap: '8px 12px',
  alignItems: 'center',
};

const utilityFieldLabelStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
};

const utilityInputStyle: React.CSSProperties = {
  height: 30,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 10px',
  fontSize: 13,
};

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const modalButtonStyle: React.CSSProperties = {
  height: 34,
  minWidth: 92,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  ...modalButtonStyle,
  borderColor: 'var(--accent)',
  background: 'var(--accent)',
  color: 'var(--text)',
  fontWeight: 600,
};

const utilityStatusStyle: React.CSSProperties = {
  minHeight: 34,
  padding: '8px 12px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 12,
  borderRadius: 4,
};

const reportContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  flex: 1,
  minHeight: 0,
};

const summaryPanelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 24,
  padding: '10px 16px',
  background: 'var(--bg3)',
  borderRadius: 6,
  border: '1px solid var(--border)',
};

const summaryItemStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  fontSize: 13,
};

const summaryLabelStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
};

const summaryValueStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontWeight: 600,
};

const issueBreakdownStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
};

const breakdownTagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  background: 'var(--control-bg)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  border: '1px solid var(--border)',
};

const tableFrameStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: 1,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  borderRadius: 4,
};

const tableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '60px 120px 180px 80px 80px 1fr 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  fontWeight: 700,
};

const tableBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflowY: 'auto',
  flex: 1,
};

const tableRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '60px 120px 180px 80px 80px 1fr 1fr',
  gap: 8,
  alignItems: 'center',
  minHeight: 32,
  padding: '0 12px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 12,
};

const dateRangeStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  fontFamily: 'monospace',
};

const truncatedMessageStyle: React.CSSProperties = {
  padding: 12,
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 12,
  fontStyle: 'italic',
};
