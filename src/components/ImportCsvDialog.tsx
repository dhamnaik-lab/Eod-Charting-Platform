import { useEffect, useState } from 'react';
import {
  getDesktopApi,
  type CsvPreview,
  type ImportOptions,
  type ImportResult,
  type ManualImportRecoverySummary,
} from '@/platform';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';

export function ImportCsvDialog() {
  const IMPORT_CSV_WINDOW_ID = 'import-csv';

  const importDialog = useUiStore((state) => state.importDialog);
  const closeImportDialog = useUiStore((state) => state.closeImportDialog);
  const openImportDialog = useUiStore((state) => state.openImportDialog);
  const refreshSnapshot = useChartStore((state) => state.refreshSnapshot);
  const loadInstrument = useChartStore((state) => state.loadInstrument);
  const importProgress = useChartStore((state) => state.importProgress);
  const setImportProgress = useChartStore((state) => state.setImportProgress);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [exchange, setExchange] = useState('NSE');
  const [dateFormat, setDateFormat] = useState<ImportOptions['dateFormat']>('auto');
  const [onDuplicate, setOnDuplicate] = useState<ImportOptions['onDuplicate']>('skip');
  const [hasHeader, setHasHeader] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  const [recoveryHistory, setRecoveryHistory] = useState<ManualImportRecoverySummary[]>([]);
  const [undoBusySessionId, setUndoBusySessionId] = useState<string | null>(null);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);

  const primaryFile = importDialog.filePaths[0] ?? null;
  const hasFinishedImport = !importProgress.running && (Boolean(importProgress.result) || Boolean(importProgress.error));
  const completedResult = importProgress.result ?? null;
  const sampleImportedSymbol = completedResult?.sampleSymbols[0] ?? null;
  const secondaryActionLabel = hasFinishedImport ? 'Close' : 'Cancel';
  const primaryActionLabel = hasFinishedImport ? 'Import Again' : 'Import';
  const api = getDesktopApi();
  const sourceExchangeHint = detectSourceExchangeHint(importDialog.filePaths);
  const sourceExchangeMismatch =
    sourceExchangeHint !== null && exchange !== 'OTHER' && sourceExchangeHint !== exchange;

  useEffect(() => {
    registerWindow({
      id: IMPORT_CSV_WINDOW_ID,
      title: 'Import CSV / TXT Data',
      bounds: {
        x: 120,
        y: 80,
        width: 740,
        height: 680,
      },
      minWidth: 600,
      minHeight: 500,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (importDialog.open) {
      openWindow(IMPORT_CSV_WINDOW_ID);
      focusWindow(IMPORT_CSV_WINDOW_ID);
    }
  }, [importDialog.open, openWindow, focusWindow]);

  useEffect(() => {
    if (importDialog.openRequestCount > 0) {
      openWindow(IMPORT_CSV_WINDOW_ID);
      focusWindow(IMPORT_CSV_WINDOW_ID);
    }
  }, [importDialog.openRequestCount, openWindow, focusWindow]);

  useEffect(() => {
    if (!api || !primaryFile) {
      setPreview(null);
      return;
    }

    void api.previewCsv(primaryFile).then(setPreview).catch(() => setPreview(null));
  }, [api, primaryFile]);

  useEffect(() => {
    if (!api || !importDialog.open) {
      return;
    }
    void api
      .listManualImportRecoveryHistory()
      .then(setRecoveryHistory)
      .catch(() => setRecoveryHistory([]));
  }, [api, importDialog.open, importDialog.openRequestCount]);

  const handleUndoRecovery = async (recovery: ManualImportRecoverySummary) => {
    if (!api || !recovery.undoable || undoBusySessionId || importProgress.running) {
      return;
    }
    const confirmed = window.confirm(
      `Undo Manual Import ${recovery.sessionId}?\n\n` +
        `Exchange: ${recovery.exchange}\n` +
        `Files: ${recovery.fileCount}\n` +
        `Inserted rows: ${recovery.rowsInserted}\n` +
        `Date range: ${recovery.dateFrom ?? '—'} to ${recovery.dateTo ?? '—'}\n\n` +
        'Rows changed after this import will be preserved as conflicts rather than overwritten.',
    );
    if (!confirmed) {
      return;
    }

    setUndoBusySessionId(recovery.sessionId);
    setRecoveryMessage(`Undoing Manual Import ${recovery.sessionId}...`);
    try {
      const result = await api.undoManualImportRecovery({ sessionId: recovery.sessionId });
      setRecoveryMessage(result.message);
      await refreshSnapshot();
      setRecoveryHistory(await api.listManualImportRecoveryHistory());
    } catch (error) {
      setRecoveryMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setUndoBusySessionId(null);
    }
  };

  const handleClose = () => {
    closeWindow(IMPORT_CSV_WINDOW_ID);
    closeImportDialog();
  };

  return (
    <FloatingWindow id={IMPORT_CSV_WINDOW_ID} onClose={handleClose}>
      <div style={dialogBodyStyle}>
        <div style={referenceBoxStyle}>
          <div style={{ color: 'var(--text-dim)', marginBottom: 6 }}>Expected Format</div>
          <div style={{ color: 'var(--accent)' }}>symbol, date, open, high, low, close, volume</div>
          <div style={{ marginTop: 6 }}>RELIANCE, 20240318, 2814.50, 2856.80, 2808.10, 2847.30, 1240000</div>
        </div>

        <div style={dropZoneStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            <div>{importDialog.filePaths.length ? `${importDialog.filePaths.length} files selected` : 'Click to browse CSV / TXT / TSV files'}</div>
            {importDialog.filePaths.length ? (
              <div style={selectedFilesStyle}>
                {importDialog.filePaths.map((filePath) => (
                  <span key={filePath} style={selectedFileChipStyle} title={basename(filePath)}>
                    {selectedFileLabel(filePath)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <button
            type="button"
            style={buttonStyle}
            onClick={async () => {
              if (!api) {
                return;
              }

              const filePaths = await api.pickCsvFiles();
              if (filePaths.length > 0) openImportDialog(filePaths);
            }}
          >
            Browse
          </button>
        </div>

        {sourceExchangeMismatch ? (
          <div style={errorBoxStyle}>
            <div style={summarySectionLabelStyle}>Exchange Mismatch Warning</div>
            <div>
              {sourceExchangeHint === 'MIXED'
                ? `Selected files appear to include both NSE and BSE source folders, while Manual Import targets ${exchange}.`
                : `Selected files appear to come from ${sourceExchangeHint}, but Manual Import is targeting ${exchange}.`}
              {' '}Verify the Exchange and file selection before importing.
            </div>
          </div>
        ) : null}

        <div style={settingsGridStyle}>
          <label style={fieldStyle}>
            <span>Exchange</span>
            <select value={exchange} onChange={(event) => setExchange(event.target.value)} style={inputStyle}>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span>Date Format</span>
            <select
              value={dateFormat}
              onChange={(event) => setDateFormat(event.target.value as ImportOptions['dateFormat'])}
              style={inputStyle}
            >
              <option value="auto">Auto-detect</option>
              <option value="YYYYMMDD">YYYYMMDD</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="YYYY/MM/DD">YYYY/MM/DD</option>
              <option value="DD-MM-YYYY">DD-MM-YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="DD-MMM-YYYY">DD-MMM-YYYY</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span>On Duplicate</span>
            <select
              value={onDuplicate}
              onChange={(event) => setOnDuplicate(event.target.value as ImportOptions['onDuplicate'])}
              style={inputStyle}
            >
              <option value="skip">Skip</option>
              <option value="overwrite">Overwrite</option>
              <option value="error">Error</option>
            </select>
          </label>
          <div style={{ ...fieldStyle, justifyContent: 'flex-end' }}>
            <label style={checkboxStyle}>
              <input type="checkbox" checked={hasHeader} onChange={(event) => setHasHeader(event.target.checked)} />
              <span>Has header row</span>
            </label>
            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={trimWhitespace}
                onChange={(event) => setTrimWhitespace(event.target.checked)}
              />
              <span>Trim whitespace</span>
            </label>
          </div>
        </div>

        {preview ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 10px',
                background: 'var(--bg3)',
                color: 'var(--text)',
              }}
            >
              <span>Preview {primaryFile ? `(${basename(primaryFile)})` : ''}</span>
              <span style={{ color: 'var(--green)' }}>~{preview.totalEstimatedRows} rows</span>
            </div>
            <div style={previewTableWrapStyle}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr>
                    {preview.headers.map((header) => (
                      <th key={header} style={thStyle}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row, index) => (
                    <tr key={`${index}-${row.join('|')}`}>
                      {row.map((value, cellIndex) => (
                        <td key={`${index}-${cellIndex}`} style={tdStyle}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importDialog.filePaths.length > 1 ? (
              <div style={previewFooterStyle}>
                Preview shows the first file only. Import will process all selected files in sequence.
              </div>
            ) : null}
          </div>
        ) : null}

        {importProgress.message ? (
          <div style={{ color: importProgress.error ? 'var(--red)' : 'var(--text-dim)', fontSize: 11 }}>
            {importProgress.running ? `${importProgress.progress}% ${importProgress.message}` : importProgress.message}
          </div>
        ) : null}

        {completedResult ? (
          <div style={summaryBoxStyle}>
            <div style={summaryHeaderStyle}>
              <span>{completedResult.rowsError > 0 ? 'Import Completed With Errors' : 'Import Completed'}</span>
              <span style={{ color: completedResult.rowsError > 0 ? 'var(--accent)' : 'var(--green)' }}>
                {formatDuration(completedResult.durationMs)}
              </span>
            </div>
            <div style={summaryGridStyle}>
              <SummaryItem label="Files" value={String(importDialog.filePaths.length)} />
              <SummaryItem label="Inserted" value={completedResult.rowsInserted.toLocaleString()} />
              <SummaryItem label="Skipped" value={completedResult.rowsSkipped.toLocaleString()} />
              <SummaryItem label="Errors" value={completedResult.rowsError.toLocaleString()} />
              <SummaryItem label="Symbols" value={completedResult.symbolCount.toLocaleString()} />
              <SummaryItem label="Date Range" value={formatDateRange(completedResult.dateRange)} />
            </div>
            {completedResult.binaryDiagnostics ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={summarySectionLabelStyle}>Binary Diagnostics</div>
                <pre style={diagnosticsTextStyle}>
                  {formatImportBinaryDiagnostics(completedResult.binaryDiagnostics)}
                </pre>
              </div>
            ) : null}
            {completedResult.sampleSymbols.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={summarySectionLabelStyle}>Imported Symbols</div>
                <div style={summaryChipRowStyle}>
                  {completedResult.sampleSymbols.map((item) => (
                    <button
                      key={`${item.exchange}:${item.symbol}`}
                      type="button"
                      style={summaryChipStyle}
                      onClick={async () => {
                        await loadInstrument(item, null);
                        handleClose();
                      }}
                    >
                      {item.exchange}:{item.symbol}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {completedResult.errors.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={summarySectionLabelStyle}>Import Messages</div>
                <div style={summaryErrorListStyle}>
                  {completedResult.errors.slice(0, 3).map((error) => (
                    <div key={error}>{error}</div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {importProgress.error && !completedResult ? (
          <div style={errorBoxStyle}>
            <div style={summarySectionLabelStyle}>Import Error</div>
            <div>{importProgress.error}</div>
          </div>
        ) : null}

        {recoveryHistory.length > 0 ? (
          <div style={summaryBoxStyle}>
            <div style={summaryHeaderStyle}>
              <span>Manual Import Recovery History (Binary)</span>
              <span style={{ color: 'var(--text-dim)' }}>{recoveryHistory.length} session(s)</span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 11, lineHeight: 1.45 }}>
              Sessions are stored with the active database and survive app restart. Undo targets only the selected recorded
              import, restores overwritten before-images, and preserves conflicting current rows.
            </div>
            {recoveryMessage ? (
              <div style={{ color: 'var(--text)', fontSize: 11 }}>{recoveryMessage}</div>
            ) : null}
            <div style={recoveryHistoryListStyle}>
              {recoveryHistory.map((recovery) => {
                const undoing = undoBusySessionId === recovery.sessionId;
                return (
                  <div key={recovery.sessionId} style={recoveryHistoryItemStyle}>
                    <div style={summaryHeaderStyle}>
                      <span style={{ fontSize: 11 }}>{formatRecoveryTimestamp(recovery.createdAt)}</span>
                      <span style={{ color: recoveryStatusColor(recovery) }}>{recovery.status}</span>
                    </div>
                    <div style={summaryGridStyle}>
                      <SummaryItem label="Exchange" value={recovery.exchange} />
                      <SummaryItem label="Files" value={String(recovery.fileCount)} />
                      <SummaryItem label="Inserted" value={recovery.rowsInserted.toLocaleString()} />
                      <SummaryItem label="Skipped" value={recovery.rowsSkipped.toLocaleString()} />
                      <SummaryItem label="Changes" value={recovery.plannedChanges.toLocaleString()} />
                      <SummaryItem
                        label="Date Range"
                        value={
                          recovery.dateFrom && recovery.dateTo
                            ? `${recovery.dateFrom} → ${recovery.dateTo}`
                            : '—'
                        }
                      />
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 10, overflowWrap: 'anywhere' }}>
                      {recovery.sessionId}
                    </div>
                    {recovery.errorSummary ? (
                      <div style={{ color: 'var(--accent)', fontSize: 11 }}>{recovery.errorSummary}</div>
                    ) : null}
                    {recovery.undoable ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          style={buttonStyle}
                          disabled={Boolean(undoBusySessionId) || importProgress.running}
                          onClick={() => void handleUndoRecovery(recovery)}
                        >
                          {undoing ? 'Undoing…' : 'Undo This Import'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        <div style={footerStyle}>
          <div style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            Target: {exchange} | Files {importDialog.filePaths.length} | Rows ~{preview?.totalEstimatedRows ?? 0}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {sampleImportedSymbol ? (
              <button
                type="button"
                style={buttonStyle}
                onClick={async () => {
                  await loadInstrument(sampleImportedSymbol, null);
                  handleClose();
                }}
              >
                Open Imported Symbol
              </button>
            ) : null}
            <button type="button" style={buttonStyle} onClick={handleClose}>
              {secondaryActionLabel}
            </button>
            <button
              type="button"
              style={buttonStyle}
              disabled={!importDialog.filePaths.length || importProgress.running || Boolean(undoBusySessionId)}
              onClick={async () => {
                if (!importDialog.filePaths.length) {
                  return;
                }
                if (sourceExchangeMismatch) {
                  const confirmed = window.confirm(
                    sourceExchangeHint === 'MIXED'
                      ? `Exchange mismatch: selected files appear to include both NSE and BSE source folders, ` +
                        `but the target Exchange is ${exchange}.\n\nContinue anyway?`
                      : `Exchange mismatch: the selected files appear to come from ${sourceExchangeHint}, ` +
                        `but the target Exchange is ${exchange}.\n\nContinue anyway?`,
                  );
                  if (!confirmed) {
                    return;
                  }
                }

                setImportProgress({ running: true, progress: 0, message: 'Starting import', error: null, result: null });
                try {
                  if (!api) {
                    throw new Error('Desktop API not available');
                  }

                  const result = await api.importCsv({
                    filePaths: importDialog.filePaths,
                    exchange,
                    dateFormat,
                    onDuplicate,
                    hasHeader,
                    trimWhitespace,
                    allowExchangeMismatch: sourceExchangeMismatch,
                  });
                  setImportProgress({
                    running: false,
                    progress: 100,
                    message: `Inserted ${result.rowsInserted}, skipped ${result.rowsSkipped}, errors ${result.rowsError}`,
                    result,
                  });
                  setRecoveryMessage(null);
                  setRecoveryHistory(await api.listManualImportRecoveryHistory());
                  await refreshSnapshot();
                } catch (error) {
                  setImportProgress({
                    running: false,
                    error: error instanceof Error ? error.message : String(error),
                    message: error instanceof Error ? error.message : String(error),
                  });
                  try {
                    if (api) {
                      setRecoveryHistory(await api.listManualImportRecoveryHistory());
                    }
                  } catch {
                    // Preserve the import error as the primary failure surface.
                  }
                }
              }}
            >
              {primaryActionLabel}
            </button>
          </div>
        </div>
      </div>
    </FloatingWindow>
  );
}

const dialogBodyStyle: React.CSSProperties = {
  padding: '16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minHeight: 0,
  flex: 1,
  overflow: 'auto',
};

const referenceBoxStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
  padding: 10,
  fontSize: 11,
};

const dropZoneStyle: React.CSSProperties = {
  border: '1px dashed var(--border2)',
  padding: 12,
  display: 'grid',
  gridTemplateColumns: '1fr auto',
  alignItems: 'start',
  gap: 12,
  fontSize: 11,
};

const settingsGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 10,
};

const selectedFilesStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  maxHeight: 84,
  overflowY: 'auto',
  minWidth: 0,
  alignItems: 'flex-start',
};

const selectedFileChipStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 999,
  padding: '2px 8px',
  fontSize: 10,
  lineHeight: 1.4,
  whiteSpace: 'nowrap',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  fontSize: 11,
  color: 'var(--text-dim)',
};

const checkboxStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--text)',
};

const inputStyle: React.CSSProperties = {
  height: 30,
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 4,
  padding: '0 8px',
};

const buttonStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 4,
  padding: '0 10px',
  height: 30,
  cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  background: 'var(--bg3)',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = {
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
};

const previewTableWrapStyle: React.CSSProperties = {
  maxHeight: 180,
  overflow: 'auto',
};

const previewFooterStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  padding: '8px 10px',
  color: 'var(--text-dim)',
  fontSize: 10,
  background: 'var(--bg3)',
};

const summaryBoxStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  borderRadius: 4,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const summaryHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: 'var(--text)',
};

const summaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
};

const summarySectionLabelStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
};

const summaryChipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

const summaryChipStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 999,
  padding: '4px 10px',
  cursor: 'pointer',
};

const summaryErrorListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  color: 'var(--accent)',
  fontSize: 11,
};

const diagnosticsTextStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--panel-soft)',
  color: 'var(--text-dim)',
  fontSize: 10,
  lineHeight: 1.45,
  whiteSpace: 'pre-wrap',
  userSelect: 'text',
  overflowX: 'auto',
};

const errorBoxStyle: React.CSSProperties = {
  border: '1px solid var(--red)',
  background: 'var(--control-bg)',
  borderRadius: 4,
  padding: 10,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--red)',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '12px 0 0',
  borderTop: '1px solid var(--border)',
  background: 'transparent',
};

function formatRecoveryTimestamp(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

function recoveryStatusColor(recovery: ManualImportRecoverySummary): string {
  if (recovery.status === 'PARTIAL_CONFLICT' || recovery.status === 'RECOVERY_ERROR' || recovery.status === 'FAILED') {
    return 'var(--warning, var(--accent))';
  }
  if (recovery.undoable) {
    return 'var(--accent)';
  }
  return 'var(--text-dim)';
}

const recoveryHistoryListStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  maxHeight: 360,
  overflowY: 'auto',
  paddingRight: 4,
} as const;

const recoveryHistoryItemStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 10,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg-elevated, rgba(255, 255, 255, 0.02))',
} as const;

function detectSourceExchangeHint(filePaths: string[]): 'NSE' | 'BSE' | 'MIXED' | null {
  const hints = new Set<'NSE' | 'BSE'>();
  for (const filePath of filePaths) {
    const normalized = filePath.replace(/\\/g, '/').toUpperCase();
    if (normalized.includes('/BSE/')) {
      hints.add('BSE');
    }
    if (normalized.includes('/NSE/')) {
      hints.add('NSE');
    }
  }
  if (hints.size === 1) return [...hints][0];
  if (hints.size > 1) return 'MIXED';
  return null;
}

function basename(filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  return normalized.split('/').filter(Boolean).pop() ?? filePath;
}

function selectedFileLabel(filePath: string): string {
  const base = basename(filePath);
  const stem = base.replace(/\.(csv|txt|tsv)$/i, '');

  if (/^\d{4}-\d{2}$/.test(stem)) {
    return stem;
  }

  if (/^\d{8}$/.test(stem)) {
    return `${stem.slice(0, 4)}-${stem.slice(4, 6)}-${stem.slice(6, 8)}`;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(stem)) {
    return stem;
  }

  return stem;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={summarySectionLabelStyle}>{label}</span>
      <span style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function formatDateRange(dateRange: { from: string; to: string } | null): string {
  if (!dateRange) {
    return '-';
  }

  return dateRange.from === dateRange.to ? dateRange.from : `${dateRange.from} to ${dateRange.to}`;
}

function formatMicrosecondsAsMilliseconds(valueUs: number): string {
  return `${(valueUs / 1_000).toFixed(3)} ms`;
}

function formatImportBinaryDiagnostics(
  diagnostics: NonNullable<ImportResult['binaryDiagnostics']>,
): string {
  return [
    `workers ${diagnostics.workers}; parse/prepare ${diagnostics.parsePrepareMs} ms; binary filter ${diagnostics.binaryFilterMs} ms; binary write ${diagnostics.binaryWriteMs} ms`,
    `paths: new file ${diagnostics.newFiles}; append newest ${diagnostics.appendNewest}; rewrite tail ${diagnostics.rewriteTail}; update existing ${diagnostics.updateExisting}; insert historical ${diagnostics.insertHistorical}; no-op ${diagnostics.noOp}`,
    `dates: inserted ${diagnostics.insertedDates}; changed ${diagnostics.changedDates}; unchanged ${diagnostics.unchangedDates}; errors ${diagnostics.binaryErrors}`,
    `sync_data ${formatMicrosecondsAsMilliseconds(diagnostics.syncDataUs)} / ${diagnostics.syncDataCalls} calls; flush ${formatMicrosecondsAsMilliseconds(diagnostics.flushUs)} / ${diagnostics.flushCalls} calls`,
    `parallel-summed symbol ${formatMicrosecondsAsMilliseconds(diagnostics.parallelSummedSymbolUs)}; p50 ${formatMicrosecondsAsMilliseconds(diagnostics.p50SymbolUs)}; p95 ${formatMicrosecondsAsMilliseconds(diagnostics.p95SymbolUs)}; max ${formatMicrosecondsAsMilliseconds(diagnostics.maxSymbolUs)}`,
    `detail: exists ${formatMicrosecondsAsMilliseconds(diagnostics.existsUs)}; open ${formatMicrosecondsAsMilliseconds(diagnostics.openUs)}; header read ${formatMicrosecondsAsMilliseconds(diagnostics.headerReadUs)}; last-date read ${formatMicrosecondsAsMilliseconds(diagnostics.lastDateReadUs)}; sort ${formatMicrosecondsAsMilliseconds(diagnostics.sortUs)}; lookup ${formatMicrosecondsAsMilliseconds(diagnostics.lookupUs)}; tail read ${formatMicrosecondsAsMilliseconds(diagnostics.tailReadUs)}; new-file write ${formatMicrosecondsAsMilliseconds(diagnostics.newFileWriteUs)}; seek ${formatMicrosecondsAsMilliseconds(diagnostics.seekUs)}; data write ${formatMicrosecondsAsMilliseconds(diagnostics.dataWriteUs)}; byte shift ${formatMicrosecondsAsMilliseconds(diagnostics.byteShiftUs)}; set-len ${formatMicrosecondsAsMilliseconds(diagnostics.setLenUs)}; header write ${formatMicrosecondsAsMilliseconds(diagnostics.headerWriteUs)}`,
  ].join('\n');
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1_000) {
    return `${durationMs} ms`;
  }

  if (durationMs < 60_000) {
    return `${(durationMs / 1_000).toFixed(1)} s`;
  }

  return `${(durationMs / 60_000).toFixed(1)} min`;
}
