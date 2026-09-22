import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  getDesktopApi,
  type BatchDownloadConfig,
  type BhavcopySettings,
  type DownloadMode,
  type DownloadResult,
  type MarketHoliday,
} from '@/platform';
import { useBhavcopyStore, type LogEntry } from '@/store/bhavcopyStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';
import {
  addButtonStyle,
  addSeriesInputStyle,
  addSeriesStyle,
  buttonGroupStyle,
  checkboxGroupStyle,
  checkboxLabelStyle,
  checkboxStyle,
  contentStyle,
  copyButtonStyle,
  dateInputStyle,
  dateRangeStyle,
  excludeSeriesWindowBodyStyle,
  excludeSeriesWindowListStyle,
  excludedChipStyle,
  emptyLogStyle,
  footerStyle,
  inputGroupStyle,
  labelStyle,
  logAreaStyle,
  logCountStyle,
  logEntryErrorStyle,
  logEntryStyle,
  logEntryWarningStyle,
  logHeaderStyle,
  logTitleStyle,
  leftPanelStyle,
  marketHolidayHeaderStyle,
  marketHolidayPageStyle,
  marketHolidayTableStyle,
  modeHintStyle,
  modeRangeInfoStyle,
  modeSelectRowStyle,
  modeSelectStyle,
  primaryButtonStyle,
  progressBarContainerStyle,
  progressBarFillStyle,
  progressFillStyle,
  removeChipButtonStyle,
  resultsSummaryStyle,
  rightPanelStyle,
  sectionStyle,
  sectionTitleStyle,
  secondaryButtonStyle,
  statFailedValueStyle,
  statLabelStyle,
  statSkippedValueStyle,
  statStyle,
  statSuccessValueStyle,
  statValueStyle,
  statusBadgeErrorStyle,
  statusBadgeRunningStyle,
  statusBadgeStyle,
  statusBadgeSuccessStyle,
  statusDotStyle,
  tabButtonStyle,
  tabRowStyle,
  workersHintStyle,
  workersInputStyle,
  workersStyle,
  windowBodyStyle,
} from './BhavcopyDownloadWindow.styles';
import { BhavcopySourceSettingsDialog } from './BhavcopySourceSettingsDialog';

type DownloadConfig = BatchDownloadConfig;
type LogFilter = 'all' | LogEntry['level'];

interface BhavcopyDownloadWindowProps {
  onClose: () => void;
}

const DEFAULT_EXCLUDED_SERIES = ['GS', 'GB', 'GF', 'GT', 'GBD', 'GBI', 'GSD', 'GSI'];
const BHAVCOPY_WINDOW_ID = 'bhavcopy-download';
const EXCLUDE_SERIES_WINDOW_ID = 'bhavcopy-exclude-series';

function getExcludeSeriesWindowHeight(seriesCount: number): number {
  const visibleRows = Math.min(Math.max(seriesCount, 1), 12);
  return 230 + visibleRows * 34;
}

function getDefaultDateRange() {
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];
  return {
    startDate: todayIso,
    endDate: todayIso,
  };
}

function isSkippedResult(result: DownloadResult): boolean {
  return result.success && result.rowsInserted === 0;
}

function formatExchangeLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'NSE':
      return 'NSE';
    case 'BSE':
      return 'BSE';
    case 'NSEINDEX':
    case 'NSE_INDEX':
      return 'NSE Index Symbols / Full Index List';
    case 'BSEINDEX':
    case 'BSE_INDEX':
      return 'BSE Index';
    default:
      return value
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\s+/g, ' ')
        .trim();
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  if (typeof error === 'string' && error.trim()) {
    return error;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string' &&
    (error as { message: string }).message.trim()
  ) {
    return (error as { message: string }).message;
  }
  return 'Unknown error occurred';
}

function getDownloadModeLabel(mode: DownloadMode): string {
  switch (mode) {
    case 'update':
      return 'Update';
    case 'fullHistory':
      return 'Full History';
    default:
      return 'Date Range';
  }
}

function getDownloadModeHint(mode: DownloadMode): string {
  switch (mode) {
    case 'update':
      return 'Starts after the latest imported date in the active database for each selected exchange.';
    case 'fullHistory':
      return 'Uses built-in exchange baseline dates. Older BSE Index dates may be skipped if archives are unavailable.';
    default:
      return 'Downloads only the selected manual date range.';
  }
}

function logLevelText(level: LogEntry['level']) {
  switch (level) {
    case 'success':
      return 'SUCCESS';
    case 'error':
      return 'ERROR';
    case 'warning':
      return 'SKIP';
    default:
      return 'INFO';
  }
}

function filterLabel(filter: LogFilter) {
  switch (filter) {
    case 'success':
      return 'Success';
    case 'warning':
      return 'Skip';
    case 'error':
      return 'Fail';
    case 'info':
      return 'Info';
    default:
      return 'All';
  }
}

export function BhavcopyDownloadWindow({ onClose }: BhavcopyDownloadWindowProps) {
  const isDownloading = useBhavcopyStore((state) => state.isDownloading);
  const setIsDownloading = useBhavcopyStore((state) => state.setIsDownloading);
  const logs = useBhavcopyStore((state) => state.logs);
  const runSummary = useBhavcopyStore((state) => state.runSummary);
  const totalLogEntries = useBhavcopyStore((state) => state.totalLogEntries);
  const downloadProgress = useBhavcopyStore((state) => state.downloadProgress);
  const addLog = useBhavcopyStore((state) => state.addLog);
  const clearLogs = useBhavcopyStore((state) => state.clearLogs);
  const reportDownloadResult = useBhavcopyStore((state) => state.reportDownloadResult);
  const reportedDownloadResults = useBhavcopyStore((state) => state.reportedDownloadResults);

  const bhavcopyOpenRequestCount = useUiStore((state) => state.bhavcopyOpenRequestCount);
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindowStore = useWindowStore((state) => state.closeWindow);
  const resizeWindow = useWindowStore((state) => state.resizeWindow);

  const [config, setConfig] = useState<DownloadConfig>(() => {
    const dateRange = getDefaultDateRange();
    return {
      mode: 'range',
      exchanges: {
        nse: true,
        bse: false,
        nseIndex: false,
        bseIndex: false,
      },
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      workers: 2,
      excludedSeries: [...DEFAULT_EXCLUDED_SERIES],
      nseEquityUrlOverride: null,
      nseIndexUrlOverride: null,
      bseEquityUrlOverride: null,
      bseIndexUrlOverride: null,
    };
  });
  const [newExcludedSeries, setNewExcludedSeries] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [copySuccess, setCopySuccess] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [holidays, setHolidays] = useState<MarketHoliday[]>([]);
  const [activeTab, setActiveTab] = useState<'bhavcopy' | 'marketHoliday'>('bhavcopy');
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const logAreaRef = useRef<HTMLDivElement>(null);
  const api = getDesktopApi();

  useEffect(() => {
    registerWindow({
      id: BHAVCOPY_WINDOW_ID,
      title: 'NSE/BSE Bhavcopy Download',
      bounds: {
        x: 80,
        y: 60,
        width: 1220,
        height: 720,
      },
      minWidth: 860,
      minHeight: 520,
    });
    registerWindow({
      id: EXCLUDE_SERIES_WINDOW_ID,
      title: 'Exclude Series (NSE)',
      bounds: {
        x: 360,
        y: 180,
        width: 560,
        height: 420,
      },
      minWidth: 460,
      minHeight: 300,
      maxWidth: 760,
      maxHeight: 720,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (bhavcopyOpenRequestCount > 0) {
      openWindow(BHAVCOPY_WINDOW_ID);
      focusWindow(BHAVCOPY_WINDOW_ID);
    }
  }, [bhavcopyOpenRequestCount, openWindow, focusWindow]);

  useEffect(() => {
    if (!api || settingsLoaded) return;
    
    const loadSettings = async () => {
      try {
        const settings = await api.getBhavcopySettings();
        const dateRange = getDefaultDateRange();
        setConfig({
          mode: 'range',
          exchanges: settings.exchanges,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          workers: settings.workers,
          excludedSeries: settings.excludedSeries,
          nseEquityUrlOverride: settings.nseEquityUrlOverride,
          nseIndexUrlOverride: settings.nseIndexUrlOverride,
          bseEquityUrlOverride: settings.bseEquityUrlOverride,
          bseIndexUrlOverride: settings.bseIndexUrlOverride,
        });
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
      setSettingsLoaded(true);
    };
    
    void loadSettings();
  }, [api, settingsLoaded]);

  const saveSettings = (settings: BhavcopySettings) => {
    if (!api) return;
    void api.saveBhavcopySettings(settings);
  };

  const savePersistedSettings = (nextConfig: DownloadConfig) => {
    saveSettings({
      exchanges: nextConfig.exchanges,
      workers: nextConfig.workers,
      excludedSeries: nextConfig.excludedSeries,
      nseEquityUrlOverride: nextConfig.nseEquityUrlOverride,
      nseIndexUrlOverride: nextConfig.nseIndexUrlOverride,
      bseEquityUrlOverride: nextConfig.bseEquityUrlOverride,
      bseIndexUrlOverride: nextConfig.bseIndexUrlOverride,
    });
  };

  const loadHolidays = async () => {
    if (!api || holidaysLoading) return;
    setHolidaysLoading(true);
    setHolidayError(null);
    try {
      const rows = await api.listMarketHolidays();
      setHolidays(rows);
    } catch (err) {
      setHolidayError(getErrorMessage(err));
    } finally {
      setHolidaysLoading(false);
    }
  };

  const handleAddHoliday = async () => {
    if (!api) return;
    setHolidayError(null);
    try {
      const added = await api.addMarketHoliday(newHolidayDate, newHolidayName);
      setHolidays((prev) => [...prev, added].sort((a, b) => a.date.localeCompare(b.date)));
      setNewHolidayDate('');
      setNewHolidayName('');
    } catch (err) {
      setHolidayError(String(err));
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (!api) return;
    setHolidayError(null);
    try {
      await api.deleteMarketHoliday(id);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      setDeleteConfirmId(null);
    } catch (err) {
      setHolidayError(String(err));
    }
  };

  const renderMarketHolidayPage = () => (
    <div style={marketHolidayPageStyle}>
      <div style={marketHolidayHeaderStyle}>
        <div>
          <div style={sectionTitleStyle}>Market Holiday</div>
          <div style={{ marginTop: 4, color: 'var(--text-dim)', fontSize: 12 }}>
            Manage holiday dates excluded from bhavcopy downloads.
          </div>
        </div>
        <button
          type="button"
          style={secondaryButtonStyle}
          onClick={() => void loadHolidays()}
          disabled={holidaysLoading}
        >
          {holidaysLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {holidayError && (
        <div style={{ color: 'var(--red)', fontSize: 12, marginBottom: 8 }}>{holidayError}</div>
      )}

      <div style={marketHolidayTableStyle}>
        <div style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 100px 110px', gap: 8, padding: '8px 10px', color: 'var(--text-dim)', backgroundColor: 'var(--bg3)', borderBottom: '1px solid var(--border2)', fontSize: 11, fontWeight: 600 }}>
          <span>Date</span>
          <span>Name</span>
          <span>Source</span>
          <span>Actions</span>
        </div>
        {holidaysLoading && holidays.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading holidays...</div>
        ) : holidays.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)' }}>No holidays loaded.</div>
        ) : (
          holidays.map((h) => (
            <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '140px minmax(0, 1fr) 100px 110px', alignItems: 'center', gap: 8, padding: '7px 10px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{h.date}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</span>
              <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{h.source}</span>
              <span>
                {deleteConfirmId === h.id ? (
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      type="button"
                      style={{ fontSize: 10, color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}
                      onClick={() => void handleDeleteHoliday(h.id)}
                    >Confirm</button>
                    <button
                      type="button"
                      style={{ fontSize: 10, background: 'none', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', color: 'var(--text-dim)' }}
                      onClick={() => setDeleteConfirmId(null)}
                    >Cancel</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px 4px' }}
                    onClick={() => setDeleteConfirmId(h.id)}
                  >Remove</button>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ ...sectionStyle, marginTop: 18, maxWidth: 560 }}>
        <div style={sectionTitleStyle}>Add Holiday</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            style={{ ...dateInputStyle, width: 140 }}
          />
          <input
            type="text"
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newHolidayDate && newHolidayName && void handleAddHoliday()}
            placeholder="Holiday name"
            style={{ ...addSeriesInputStyle, flex: 1, minWidth: 180 }}
            maxLength={80}
          />
          <button
            type="button"
            style={addButtonStyle}
            onClick={() => void handleAddHoliday()}
            disabled={!newHolidayDate || !newHolidayName.trim()}
          >Add</button>
        </div>
      </div>
    </div>
  );

  const updateConfig = (
    updater: (previous: DownloadConfig) => DownloadConfig,
    options?: { persistSettings?: boolean },
  ) => {
    setConfig((previous) => {
      const nextConfig = updater(previous);
      if (options?.persistSettings) {
        savePersistedSettings(nextConfig);
      }
      return nextConfig;
    });
  };

  const handleExchangeToggle = (exchange: keyof DownloadConfig['exchanges']) => {
    updateConfig((previous) => ({
      ...previous,
      exchanges: {
        ...previous.exchanges,
        [exchange]: !previous.exchanges[exchange],
      },
    }), { persistSettings: true });
  };

  const handleWorkersChange = (value: number) => {
    updateConfig((previous) => ({
      ...previous,
      workers: value,
    }), { persistSettings: true });
  };

  const handleModeChange = (mode: DownloadMode) => {
    updateConfig((previous) => ({ ...previous, mode }));
  };

  const addExcludedSeries = () => {
    const series = newExcludedSeries.trim().toUpperCase();
    if (series && !config.excludedSeries.includes(series)) {
      updateConfig((previous) => ({
        ...previous,
        excludedSeries: [...previous.excludedSeries, series],
      }), { persistSettings: true });
      resizeWindow(EXCLUDE_SERIES_WINDOW_ID, 560, getExcludeSeriesWindowHeight(config.excludedSeries.length + 1));
      setNewExcludedSeries('');
    }
  };

  const removeExcludedSeries = (series: string) => {
    updateConfig((previous) => ({
      ...previous,
      excludedSeries: previous.excludedSeries.filter((value) => value !== series),
    }), { persistSettings: true });
    resizeWindow(EXCLUDE_SERIES_WINDOW_ID, 560, getExcludeSeriesWindowHeight(Math.max(0, config.excludedSeries.length - 1)));
  };

  const handleDownload = async () => {
    if (!api) {
      addLog('error', 'Desktop API bridge not available');
      return;
    }

    const selectedExchanges = Object.entries(config.exchanges)
      .filter(([, enabled]) => enabled)
      .map(([exchange]) => exchange);
    const selectedExchangeLabels = selectedExchanges.map((exchange) => formatExchangeLabel(exchange));

    if (selectedExchanges.length === 0) {
      addLog('error', 'Please select at least one exchange');
      return;
    }

    if (config.mode === 'range') {
      if (!config.startDate || !config.endDate) {
        addLog('error', 'Please select a valid start and end date');
        return;
      }
      if (config.startDate > config.endDate) {
        addLog('error', 'Start date must be on or before end date');
        return;
      }
    }

    setIsDownloading(true);
    clearLogs();
    addLog('info', `Mode: ${getDownloadModeLabel(config.mode)}`);
    addLog('info', `Starting download for: ${selectedExchangeLabels.join(', ')}`);
    if (config.mode === 'range') {
      addLog('info', `Date range: ${config.startDate} to ${config.endDate}`);
    } else {
      addLog('info', getDownloadModeHint(config.mode));
    }
    addLog('info', `Workers: ${config.workers}`);

    try {
      const result = await api.downloadBhavcopyBatch({
        mode: config.mode,
        exchanges: config.exchanges,
        startDate: config.startDate,
        endDate: config.endDate,
        workers: config.workers,
        excludedSeries: config.excludedSeries,
        nseEquityUrlOverride: config.nseEquityUrlOverride,
        nseIndexUrlOverride: config.nseIndexUrlOverride,
        bseEquityUrlOverride: config.bseEquityUrlOverride,
        bseIndexUrlOverride: config.bseIndexUrlOverride,
      });

      result.forEach((entry) => {
        const key = `${entry.exchange}::${entry.tradeDate}`;
        if (!reportedDownloadResults.has(key)) {
          reportDownloadResult(entry);
        }
      });

      const successCount = result.filter((r) => r.success && !isSkippedResult(r)).length;
      const skippedCount = result.filter((r) => isSkippedResult(r)).length;
      const failCount = result.filter((r) => !r.success).length;
      const importedRows = result.reduce((total, entry) => total + entry.rowsInserted, 0);
      addLog(
        'info',
        `Download complete: ${successCount} success, ${skippedCount} skipped, ${failCount} failed, imported rows: ${importedRows}`,
      );
    } catch (error) {
      addLog('error', getErrorMessage(error));
    } finally {
      setIsDownloading(false);
    }
  };
  const selectedExchangesCount = Object.values(config.exchanges).filter(Boolean).length;
  const { skippedCount, successCount, failedCount, totalRowsInserted, completedCount } = runSummary;
  const runStatus = isDownloading ? 'Running' : completedCount > 0 ? (failedCount > 0 ? 'Completed With Errors' : 'Completed') : 'Idle';
  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return logs;
    return logs.filter((log) => log.level === logFilter);
  }, [logFilter, logs]);
  const logCountLabel = filteredLogs.length === totalLogEntries
    ? `${totalLogEntries} entries`
    : `${filteredLogs.length} shown / ${totalLogEntries} entries`;

  useEffect(() => {
    if (!autoScroll) return;
    const container = logAreaRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [autoScroll, filteredLogs.length]);

  const copyLogToClipboard = () => {
    if (filteredLogs.length === 0) return;
    const logText = filteredLogs.map((log) => `[${log.time}] ${logLevelText(log.level)}: ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 2000);
    }).catch((error) => {
      console.error('Failed to copy:', error);
    });
  };

  const handleClose = () => {
    closeWindowStore(EXCLUDE_SERIES_WINDOW_ID);
    closeWindowStore(BHAVCOPY_WINDOW_ID);
    onClose();
  };

  const openExcludeSeriesWindow = () => {
    resizeWindow(EXCLUDE_SERIES_WINDOW_ID, 560, getExcludeSeriesWindowHeight(config.excludedSeries.length));
    openWindow(EXCLUDE_SERIES_WINDOW_ID);
    focusWindow(EXCLUDE_SERIES_WINDOW_ID);
  };

  return (
    <>
      <FloatingWindow id={BHAVCOPY_WINDOW_ID} onClose={handleClose}>
      <div style={windowBodyStyle}>
        <div style={tabRowStyle} role="tablist" aria-label="Bhavcopy window pages">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bhavcopy'}
            style={tabButtonStyle(activeTab === 'bhavcopy')}
            onClick={() => setActiveTab('bhavcopy')}
          >
            Bhavcopy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'marketHoliday'}
            style={tabButtonStyle(activeTab === 'marketHoliday')}
            onClick={() => {
              setActiveTab('marketHoliday');
              if (holidays.length === 0) void loadHolidays();
            }}
          >
            Market Holiday
          </button>
        </div>

        {activeTab === 'marketHoliday' ? renderMarketHolidayPage() : (
          <>
          <div style={contentStyle}>
          <div style={{ ...leftPanelStyle, width: 360, flex: '0 0 360px' }}>
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Exchanges</div>
            <div style={checkboxGroupStyle}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={config.exchanges.nse}
                  onChange={() => handleExchangeToggle('nse')}
                  disabled={isDownloading}
                  style={checkboxStyle}
                />
                NSE Equity
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={config.exchanges.bse}
                  onChange={() => handleExchangeToggle('bse')}
                  disabled={isDownloading}
                  style={checkboxStyle}
                />
                BSE Equity
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={config.exchanges.nseIndex}
                  onChange={() => handleExchangeToggle('nseIndex')}
                  disabled={isDownloading}
                  style={checkboxStyle}
                />
                NSE Index Symbols / Full Index List
              </label>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={config.exchanges.bseIndex}
                  onChange={() => handleExchangeToggle('bseIndex')}
                  disabled={isDownloading}
                  style={checkboxStyle}
                />
                BSE Index
              </label>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Mode</div>
            <div style={modeSelectRowStyle}>
              <select
                value={config.mode}
                onChange={(e) => handleModeChange(e.target.value as DownloadMode)}
                style={modeSelectStyle}
                disabled={isDownloading}
              >
                <option value="range">Date Range</option>
                <option value="update">Update</option>
                <option value="fullHistory">Full History</option>
              </select>
              <div style={modeHintStyle}>{getDownloadModeHint(config.mode)}</div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Date Range</div>
            {config.mode === 'range' ? (
              <div style={dateRangeStyle}>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Start</label>
                  <input
                    type="date"
                    value={config.startDate}
                    onChange={(e) => updateConfig((previous) => ({ ...previous, startDate: e.target.value }))}
                    style={dateInputStyle}
                    disabled={isDownloading}
                  />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>End</label>
                  <input
                    type="date"
                    value={config.endDate}
                    onChange={(e) => updateConfig((previous) => ({ ...previous, endDate: e.target.value }))}
                    style={dateInputStyle}
                    disabled={isDownloading}
                  />
                </div>
              </div>
            ) : (
              <div style={modeRangeInfoStyle}>
                {config.mode === 'update'
                  ? 'Resolved automatically from the active database up to today.'
                  : 'Resolved automatically from exchange baseline dates up to today.'}
              </div>
            )}
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Workers</div>
            <div style={workersStyle}>
              <input
                type="number"
                min="1"
                max="10"
                value={config.workers}
                onChange={(e) => handleWorkersChange(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                style={workersInputStyle}
                disabled={isDownloading}
              />
              <span style={workersHintStyle}>(1-10 parallel)</span>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Exclude Series (NSE)</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                {config.excludedSeries.length} series excluded
              </span>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={openExcludeSeriesWindow}
                disabled={isDownloading}
              >
                Manage
              </button>
            </div>
          </div>

          <div style={sectionStyle}>
            <button
              style={{ ...secondaryButtonStyle, width: '100%', fontSize: 12 }}
              onClick={() => setIsSettingsOpen(true)}
              disabled={isDownloading}
            >
              Source URL Settings
            </button>
          </div>

          </div>
          <div style={rightPanelStyle}>
            <div style={logHeaderStyle}>
              <span style={logTitleStyle}>Activity Log</span>
              <div style={inlineLogHeaderActionsStyle}>
                <div style={compactProgressTrackStyle}>
                  <div style={{ ...progressFillStyle, width: `${downloadProgress.progress}%` }} />
                </div>
                <div style={statStyle}>
                  <span style={{ ...statValueStyle, ...(successCount > 0 ? statSuccessValueStyle : null) }}>{successCount}</span>
                  <span style={statLabelStyle}>Success</span>
                </div>
                <div style={statStyle}>
                  <span style={{ ...statValueStyle, ...(skippedCount > 0 ? statSkippedValueStyle : null) }}>{skippedCount}</span>
                  <span style={statLabelStyle}>Skip</span>
                </div>
                <div style={statStyle}>
                  <span style={{ ...statValueStyle, ...(failedCount > 0 ? statFailedValueStyle : null) }}>{failedCount}</span>
                  <span style={statLabelStyle}>Fail</span>
                </div>
                <span style={logCountStyle}>{logCountLabel}</span>
              </div>
            </div>

            <div style={inlineLogToolbarStyle}>
              <div style={filterGroupStyle}>
                {(['all', 'info', 'success', 'warning', 'error'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    style={filterButtonStyle(logFilter === item)}
                    onClick={() => setLogFilter(item)}
                  >
                    {filterLabel(item)}
                  </button>
                ))}
              </div>
              <div style={logToolbarActionsStyle}>
                <label style={autoScrollLabelStyle}>
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(event) => setAutoScroll(event.target.checked)}
                  />
                  Auto-scroll
                </label>
                <button
                  type="button"
                  style={{ ...copyButtonStyle, opacity: filteredLogs.length === 0 ? 0.5 : 1 }}
                  onClick={copyLogToClipboard}
                  disabled={filteredLogs.length === 0}
                >
                  {copySuccess ? 'Copied' : 'Copy Log'}
                </button>
              </div>
            </div>

            <div ref={logAreaRef} style={logAreaStyle}>
              {filteredLogs.length === 0 ? (
                <div style={emptyLogStyle}>No log entries for {filterLabel(logFilter).toLowerCase()}.</div>
              ) : (
                filteredLogs.map((log, index) => (
                  <div
                    key={`${log.time}-${index}`}
                    style={{
                      ...logEntryStyle,
                      ...(log.level === 'error' ? logEntryErrorStyle : null),
                      ...(log.level === 'warning' ? logEntryWarningStyle : null),
                    }}
                  >
                    [{log.time}] {logLevelText(log.level)}: {log.message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ ...footerStyle, alignItems: 'stretch', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ ...resultsSummaryStyle, flexWrap: 'wrap', alignItems: 'center' }}>
            <div
              style={{
                ...statusBadgeStyle,
                ...(isDownloading ? statusBadgeRunningStyle : completedCount > 0 ? (failedCount > 0 ? statusBadgeErrorStyle : statusBadgeSuccessStyle) : null),
              }}
            >
              <span style={statusDotStyle} />
              <span>{runStatus}</span>
            </div>
            {isDownloading && downloadProgress.progress > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={progressBarContainerStyle}>
                  <div style={{ ...progressBarFillStyle, width: `${downloadProgress.progress}%` }} />
                </div>
                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{downloadProgress.progress}%</span>
              </div>
            ) : completedCount > 0 ? (
              <>
                <span style={{ color: 'var(--green)' }}>
                  OK {successCount + skippedCount}
                </span>
                <span style={{ color: 'var(--red)' }}>
                  Fail {failedCount}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>
                  Rows: {totalRowsInserted}
                </span>
              </>
            ) : null}
          </div>
          <div style={buttonGroupStyle}>
            <button
              style={secondaryButtonStyle}
              onClick={clearLogs}
              disabled={isDownloading}
            >
              Clear
            </button>
            <button
              style={{
                ...primaryButtonStyle,
                opacity: isDownloading || selectedExchangesCount === 0 ? 0.5 : 1,
                cursor: isDownloading || selectedExchangesCount === 0 ? 'not-allowed' : 'pointer',
              }}
              onClick={handleDownload}
              disabled={isDownloading || selectedExchangesCount === 0}
            >
              {isDownloading ? 'Downloading...' : 'Start Download'}
            </button>
          </div>
        </div>
          </>
        )}

        {isSettingsOpen && (
          <BhavcopySourceSettingsDialog
            initialSettings={config}
            onClose={() => setIsSettingsOpen(false)}
            onSave={(nextSettings) => {
              updateConfig(() => ({
                ...config,
                ...nextSettings
              }), { persistSettings: true });
              addLog('info', 'Source settings updated.');
            }}
          />
        )}
      </div>
      </FloatingWindow>
      <FloatingWindow
        id={EXCLUDE_SERIES_WINDOW_ID}
        onClose={() => closeWindowStore(EXCLUDE_SERIES_WINDOW_ID)}
      >
        <div style={excludeSeriesWindowBodyStyle}>
          <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
            These NSE series are excluded from bhavcopy downloads. Changes save automatically.
          </div>
          <div style={excludeSeriesWindowListStyle}>
            {config.excludedSeries.length === 0 ? (
              <div style={{ padding: 12, color: 'var(--text-dim)', fontSize: 12 }}>No excluded series.</div>
            ) : (
              config.excludedSeries.map((series) => (
                <div key={series} style={{ ...excludedChipStyle, borderRadius: 0, borderWidth: '0 0 1px', width: '100%', justifyContent: 'space-between', padding: '8px 10px' }}>
                  <span>{series}</span>
                  <button
                    type="button"
                    style={removeChipButtonStyle}
                    onClick={() => removeExcludedSeries(series)}
                    disabled={isDownloading}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={addSeriesStyle}>
            <input
              type="text"
              value={newExcludedSeries}
              onChange={(e) => setNewExcludedSeries(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && addExcludedSeries()}
              placeholder="Add NSE series"
              style={addSeriesInputStyle}
              disabled={isDownloading}
              maxLength={4}
            />
            <button
              type="button"
              style={addButtonStyle}
              onClick={addExcludedSeries}
              disabled={isDownloading || !newExcludedSeries.trim()}
            >
              Add
            </button>
          </div>
        </div>
      </FloatingWindow>
    </>
  );
}

const inlineLogHeaderActionsStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
};

const compactProgressTrackStyle: CSSProperties = {
  width: 90,
  height: 4,
  backgroundColor: 'var(--bg)',
  borderRadius: 2,
  overflow: 'hidden',
};

const inlineLogToolbarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  marginBottom: 8,
  flexWrap: 'wrap',
};

const filterGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  flexWrap: 'wrap',
};

const filterButtonStyle = (active: boolean): CSSProperties => ({
  height: 28,
  padding: '0 10px',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
  borderRadius: 6,
  backgroundColor: active ? 'var(--accent-soft)' : 'var(--control-bg)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  fontSize: 11,
  cursor: 'pointer',
});

const logToolbarActionsStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const autoScrollLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--text-dim)',
  fontSize: 11,
};
