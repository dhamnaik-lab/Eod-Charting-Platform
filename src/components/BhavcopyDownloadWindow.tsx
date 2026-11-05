import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  getDesktopApi,
  type BatchDownloadConfig,
  type BhavcopySettings,
  type DownloadMode,
  type DownloadResult,
  type MarketHoliday,
} from '@/platform';
import type { OfficialHolidayAcceptedSnapshot, OfficialHolidaySyncPreview } from '@/types/desktop';
import { useBhavcopyStore, type LogEntry } from '@/store/bhavcopyStore';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';
import {
  addButtonStyle,
  addSeriesInputStyle,
  buttonGroupStyle,
  checkboxGroupStyle,
  checkboxLabelStyle,
  checkboxStyle,
  contentStyle,
  copyButtonStyle,
  dateInputStyle,
  dateRangeStyle,
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
  marketHolidayAddStyle,
  marketHolidayHeaderStyle,
  marketHolidayPageStyle,
  marketHolidayStatusStyle,
  marketHolidayTableHeaderStyle,
  marketHolidayTableRowStyle,
  marketHolidayTableStyle,
  modeHintStyle,
  modeRangeInfoStyle,
  modeSelectRowStyle,
  modeSelectStyle,
  primaryButtonStyle,
  progressBarContainerStyle,
  progressBarFillStyle,
  progressFillStyle,
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
import { localDownloadDate } from '@/features/bhavcopy/bseHistoryDownload';
import { beginDownloadRun, finishDownloadRun } from '@/features/bhavcopy/downloadRunState';

type DownloadConfig = BatchDownloadConfig;
type LogFilter = 'all' | LogEntry['level'];
type HolidayStatusKind = 'info' | 'success' | 'error';
type HolidayStatus = { kind: HolidayStatusKind; message: string; time: string };

interface BhavcopyDownloadWindowProps {
  onClose: () => void;
}

const BHAVCOPY_WINDOW_ID = 'bhavcopy-download';

function getDefaultDateRange() {
  const todayIso = localDownloadDate();
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
  const activeBatch = useBhavcopyStore((state) => state.activeBatch);
  const batchOutcome = useBhavcopyStore((state) => state.batchOutcome);
  const isDownloading = activeBatch !== null;
  const requestingStop = activeBatch?.phase === 'stopQueued' || activeBatch?.phase === 'requestingStop';
  const stopping = activeBatch?.phase === 'stopping';
  const logs = useBhavcopyStore((state) => state.logs);
  const runSummary = useBhavcopyStore((state) => state.runSummary);
  const totalLogEntries = useBhavcopyStore((state) => state.totalLogEntries);
  const downloadProgress = useBhavcopyStore((state) => state.downloadProgress);
  const addLog = useBhavcopyStore((state) => state.addLog);
  const clearLogs = useBhavcopyStore((state) => state.clearLogs);
  const reportDownloadResult = useBhavcopyStore((state) => state.reportDownloadResult);
  const activeDatabasePath = useChartStore((state) => state.snapshot?.activeDatabasePath ?? null);

  const bhavcopyOpenRequestCount = useUiStore((state) => state.bhavcopyOpenRequestCount);
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindowStore = useWindowStore((state) => state.closeWindow);

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
      // Compatibility-only API field; new downloads never filter series.
      excludedSeries: [],
      nseEquityUrlOverride: null,
      nseIndexUrlOverride: null,
      bseEquityUrlOverride: null,
      bseIndexUrlOverride: null,
    };
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [copySuccess, setCopySuccess] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [holidays, setHolidays] = useState<MarketHoliday[]>([]);
  const [holidayDatabasePath, setHolidayDatabasePath] = useState<string | null>(null);
  const holidayRequestIdRef = useRef(0);
  const visibleHolidays = holidayDatabasePath === activeDatabasePath ? holidays : [];
  const [activeTab, setActiveTab] = useState<'bhavcopy' | 'marketHoliday'>('bhavcopy');
  const [holidaysLoading, setHolidaysLoading] = useState(false);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [, setHolidayError] = useState<string | null>(null);
  const [holidayStatus, setHolidayStatus] = useState<HolidayStatus>({ kind: 'info', message: 'Open Market Holiday to load the holiday list.', time: '' });
  const [holidayMutationPending, setHolidayMutationPending] = useState<'add' | number | null>(null);
  const holidayMutationInFlightRef = useRef(false);
  const holidayMutationVersionRef = useRef(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [officialPreview, setOfficialPreview] = useState<OfficialHolidaySyncPreview | null>(null);
  const [officialCoverage, setOfficialCoverage] = useState<OfficialHolidayAcceptedSnapshot[]>([]);
  const [officialBusy, setOfficialBusy] = useState(false);
  const [officialReviewed, setOfficialReviewed] = useState(false);
  const [officialSelected, setOfficialSelected] = useState<{NSE: boolean; BSE: boolean}>({NSE: true,BSE: true});
  const officialRequestVersionRef = useRef(0);
  const [officialPreviewDbPath, setOfficialPreviewDbPath] = useState<string | null>(null);
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

  const reportHolidayStatus = (kind: HolidayStatusKind, message: string) => {
    setHolidayStatus({ kind, message, time: new Date().toLocaleTimeString() });
  };

  const loadHolidays = async () => {
    const databasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
    const requestId = ++holidayRequestIdRef.current;
    const isCurrentRequest = () => requestId === holidayRequestIdRef.current &&
      (useChartStore.getState().snapshot?.activeDatabasePath ?? null) === databasePath;
    if (!api) {
      const message = 'Holiday service is unavailable.';
      setHolidayError(message);
      reportHolidayStatus('error', message);
      return;
    }
    setHolidaysLoading(true);
    setHolidayError(null);
    reportHolidayStatus('info', 'Refreshing holiday list...');
    try {
      const rows = await api.listMarketHolidays();
      if (!isCurrentRequest()) return;
      setHolidays(rows);
      setHolidayDatabasePath(databasePath);
      reportHolidayStatus('success', `Holiday list refreshed: ${rows.length} records.`);
    } catch (err) {
      if (isCurrentRequest()) {
        const message = getErrorMessage(err);
        setHolidayError(message);
        reportHolidayStatus('error', `Unable to refresh holidays: ${message}`);
      }
    } finally {
      if (isCurrentRequest()) setHolidaysLoading(false);
    }
  };

  useEffect(() => {
    // Never retain rows or pending responses from a previously active database.
    // Also clear operation status and mutation guards before loading the next database.
    holidayRequestIdRef.current += 1;
    holidayMutationVersionRef.current += 1;
    holidayMutationInFlightRef.current = false;
    setHolidayMutationPending(null);
    setHolidays([]);
    setHolidayDatabasePath(null);
    setOfficialCoverage([]);
    setHolidayError(null);
    setDeleteConfirmId(null);
    officialRequestVersionRef.current += 1;
    setOfficialPreview(null);
    setOfficialPreviewDbPath(null);
    setOfficialReviewed(false);
    setOfficialBusy(false);
    setHolidaysLoading(false);
    reportHolidayStatus('info', 'Holiday database changed; reload required.');
    if (activeTab === 'marketHoliday') void loadHolidays();
  }, [activeDatabasePath]);

  // HOL-03 accepted-snapshot metadata is independent of the existing local
  // Refresh request. Keep loadHolidays() limited to listMarketHolidays() so a
  // coverage fetch cannot alter or delay the established HOL-01/02 behavior.
  useEffect(() => {
    if (activeTab !== 'marketHoliday' || !activeDatabasePath || !api) return;
    let cancelled = false;
    const databasePath = activeDatabasePath;
    void (async () => {
      try {
        const rows = await api.listOfficialExchangeHolidaySnapshots(new Date().getFullYear());
        if (!cancelled && (useChartStore.getState().snapshot?.activeDatabasePath ?? null) === databasePath) {
          setOfficialCoverage(rows);
        }
      } catch {
        if (!cancelled && (useChartStore.getState().snapshot?.activeDatabasePath ?? null) === databasePath) {
          setOfficialCoverage([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, activeDatabasePath]);

  const handlePreviewOfficialHolidays = async () => {
    if (!api || officialBusy || holidayMutationInFlightRef.current) return;
    const databasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
    const version = ++officialRequestVersionRef.current;
    const stillActive = () => version === officialRequestVersionRef.current &&
      databasePath === (useChartStore.getState().snapshot?.activeDatabasePath ?? null);
    setOfficialBusy(true);
    setOfficialPreview(null);
    setOfficialPreviewDbPath(null);
    setOfficialReviewed(false);
    reportHolidayStatus('info', 'Checking official NSE/BSE equity holiday sources...');
    try {
      const result = await api.previewOfficialExchangeHolidays(new Date().getFullYear());
      if (!stillActive()) return;
      setOfficialPreview(result);
      setOfficialPreviewDbPath(databasePath);
      const verified = result.exchanges.filter((x) => x.verified).length;
      reportHolidayStatus(verified === 2 ? 'success' : 'info',
        `Official preview: ${verified}/2 exchanges verified for ${result.year}. Review before accepting.`);
    } catch (error) {
      if (stillActive()) reportHolidayStatus('error', `Official calendar check failed: ${getErrorMessage(error)}`);
    } finally {
      if (stillActive()) setOfficialBusy(false);
    }
  };

  const handleAcceptOfficialHolidays = async () => {
    if (!api || !officialPreview || !officialReviewed || officialBusy || holidayMutationInFlightRef.current) return;
    const databasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
    if (databasePath !== officialPreviewDbPath) return;
    const exchanges = officialPreview.exchanges.filter((x) => x.verified &&
      officialSelected[x.exchange]).map((x) => x.exchange);
    if (exchanges.length === 0) {
      reportHolidayStatus('error', 'Select at least one verified exchange for acceptance.');
      return;
    }
    const version = ++officialRequestVersionRef.current;
    const stillActive = () => version === officialRequestVersionRef.current &&
      databasePath === (useChartStore.getState().snapshot?.activeDatabasePath ?? null);
    setOfficialBusy(true);
    reportHolidayStatus('info', `Accepting official ${exchanges.join(' and ')} holidays...`);
    try {
      const result = await api.applyOfficialExchangeHolidays(officialPreview.token, exchanges);
      if (!stillActive()) return;
      setOfficialPreview(null);
      setOfficialPreviewDbPath(null);
      try {
        const coverage = await api.listOfficialExchangeHolidaySnapshots(result.year);
        if (stillActive()) setOfficialCoverage(coverage);
      } catch { /* Keep accepted result; a subsequent Refresh will retry coverage listing. */ }
      if (!stillActive()) return;
      reportHolidayStatus('success', `Accepted ${result.records} official ${result.year} records: ${result.accepted.join(', ')}. Shared/user holidays retained.`);
    } catch (error) {
      if (stillActive()) reportHolidayStatus('error', `Official calendar acceptance failed: ${getErrorMessage(error)}`);
    } finally {
      if (stillActive()) setOfficialBusy(false);
    }
  };

  const handleAddHoliday = async () => {
    if (holidayMutationInFlightRef.current) return;
    if (!newHolidayDate || !newHolidayName.trim()) {
      reportHolidayStatus('error', 'Enter a valid date and holiday name.');
      return;
    }
    if (!api) {
      reportHolidayStatus('error', 'Holiday service is unavailable.');
      return;
    }
    const databasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
    const mutationVersion = holidayMutationVersionRef.current;
    const isCurrentMutation = () => mutationVersion === holidayMutationVersionRef.current &&
      (useChartStore.getState().snapshot?.activeDatabasePath ?? null) === databasePath;
    holidayMutationInFlightRef.current = true;
    setHolidayMutationPending('add');
    setHolidayError(null);
    reportHolidayStatus('info', 'Adding holiday...');
    try {
      const added = await api.addMarketHoliday(newHolidayDate, newHolidayName);
      if (!isCurrentMutation()) return;
      // An earlier read must not overwrite the newly added row.
      holidayRequestIdRef.current += 1;
      setHolidaysLoading(false);
      setHolidays((prev) => [...(holidayDatabasePath === databasePath ? prev : []), added]
        .sort((a, b) => a.date.localeCompare(b.date)));
      setHolidayDatabasePath(databasePath);
      setNewHolidayDate('');
      setNewHolidayName('');
      reportHolidayStatus('success', `Holiday added: ${added.date} — ${added.name}.`);
    } catch (err) {
      if (isCurrentMutation()) {
        const message = getErrorMessage(err);
        setHolidayError(message);
        reportHolidayStatus('error', `Unable to add holiday: ${message}`);
      }
    } finally {
      if (isCurrentMutation()) {
        holidayMutationInFlightRef.current = false;
        setHolidayMutationPending(null);
      }
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    if (holidayMutationInFlightRef.current) return;
    if (!api) {
      reportHolidayStatus('error', 'Holiday service is unavailable.');
      return;
    }
    const deleted = visibleHolidays.find((row) => row.id === id);
    const databasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
    const mutationVersion = holidayMutationVersionRef.current;
    const isCurrentMutation = () => mutationVersion === holidayMutationVersionRef.current &&
      (useChartStore.getState().snapshot?.activeDatabasePath ?? null) === databasePath;
    holidayMutationInFlightRef.current = true;
    setHolidayMutationPending(id);
    setHolidayError(null);
    reportHolidayStatus('info', 'Removing holiday...');
    try {
      await api.deleteMarketHoliday(id);
      if (!isCurrentMutation()) return;
      holidayRequestIdRef.current += 1;
      setHolidaysLoading(false);
      setHolidays((prev) => prev.filter((h) => h.id !== id));
      setDeleteConfirmId(null);
      reportHolidayStatus('success', deleted
        ? `Holiday removed: ${deleted.date} — ${deleted.name}.`
        : 'Holiday removed successfully.');
    } catch (err) {
      if (isCurrentMutation()) {
        const message = getErrorMessage(err);
        setHolidayError(message);
        reportHolidayStatus('error', `Unable to remove holiday: ${message}`);
      }
    } finally {
      if (isCurrentMutation()) {
        holidayMutationInFlightRef.current = false;
        setHolidayMutationPending(null);
      }
    }
  };

  const renderMarketHolidayPage = () => (
    <div style={marketHolidayPageStyle}>
      <div style={marketHolidayHeaderStyle}>
        <div style={{ minWidth: 0 }}>
          <div style={sectionTitleStyle}>Market Holiday</div>
          <div style={{ marginTop: 3, color: 'var(--text-dim)', fontSize: 12 }}>
            Manage holiday dates excluded from bhavcopy downloads.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
          <button
            type="button"
            aria-label="Sync official NSE and BSE holidays"
            style={{ ...secondaryButtonStyle, borderRadius: 14, padding: '4px 12px' }}
            disabled={officialBusy || holidaysLoading || holidayMutationPending !== null}
            onClick={() => void handlePreviewOfficialHolidays()}
          >{officialBusy ? 'Checking...' : 'Sync Official Holidays'}</button>
        <button
          type="button"
          aria-label="Refresh market holidays"
          style={{ ...secondaryButtonStyle, flexShrink: 0, borderRadius: 14, padding: '4px 12px' }}
          onClick={() => void loadHolidays()}
          disabled={holidaysLoading || holidayMutationPending !== null}
        >
          {holidaysLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        </div>
      </div>

      {officialPreview && officialPreviewDbPath === activeDatabasePath && (
        <div style={{ flexShrink: 0, maxHeight: 165, overflowY: 'auto', padding: '8px 10px',
          border: '1px solid var(--border2)', borderRadius: 5, fontSize: 12 }}
          aria-label="Official holiday sync preview">
          <div style={{ fontWeight: 600, marginBottom: 5 }}>Official {officialPreview.year} cash-market holidays — preview only, no changes yet</div>
          {officialPreview.exchanges.map((entry) => (
            <div key={entry.exchange} style={{ marginBottom: 6 }}>
              <label style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                <input type="checkbox" checked={entry.verified && officialSelected[entry.exchange]}
                  disabled={!entry.verified || officialBusy}
                  onChange={(e) => setOfficialSelected((old) => ({ ...old, [entry.exchange]: e.target.checked }))}/>
                <strong>{entry.exchange} equity</strong>
                <span>{entry.verified ? `${entry.holidays.length} holidays; ${entry.newDates.length} additions, ${entry.changedNames.length} name differences, ${entry.legacyOnlyDates.length} local-only dates` : 'Unavailable — not eligible for acceptance'}</span>
              </label>
              <div style={{ paddingLeft: 22, color: entry.verified ? 'var(--text-dim)' : 'var(--red)' }}>{entry.message}</div>
              {entry.sourceUrls.map((url) => <div key={url} style={{ paddingLeft: 22, overflowWrap: 'anywhere' }}><a href={url} target="_blank" rel="noreferrer">{url}</a></div>)}
              {entry.verified && entry.sourceSha256 && <div style={{ paddingLeft: 22, color: 'var(--text-dim)' }}>Source SHA-256: {entry.sourceSha256}</div>}
              {entry.verified && <details style={{ paddingLeft: 22, marginTop: 3 }}>
                <summary>Review all {entry.holidays.length} dated official records</summary>
                {entry.holidays.map((row) => <div key={row.date}>{row.date} — {row.name}</div>)}
              </details>}
              {entry.verified && entry.newDates.length > 0 && <div style={{ paddingLeft: 22 }}>New dates: {entry.newDates.join(', ')}</div>}
              {entry.verified && entry.legacyOnlyDates.length > 0 && <div style={{ paddingLeft: 22 }}>Local-only: {entry.legacyOnlyDates.join(', ')} (not deleted)</div>}
              {entry.verified && entry.changedNames.length > 0 && <div style={{ paddingLeft: 22 }}>Different names: {entry.changedNames.join(', ')}</div>}
            </div>
          ))}
          <label style={{ display: 'block', marginBottom: 5 }}>
            <input type="checkbox" checked={officialReviewed} disabled={officialBusy}
              onChange={(e) => setOfficialReviewed(e.target.checked)}/>
            I reviewed the official records, year and linked exchange notices (including possible amendments).
          </label>
          <button type="button" style={secondaryButtonStyle}
            disabled={officialBusy || !officialReviewed || !officialPreview.exchanges.some((x) => x.verified && officialSelected[x.exchange])}
            onClick={() => void handleAcceptOfficialHolidays()}>Accept selected official calendars</button>
          <button type="button" style={{ ...secondaryButtonStyle, marginLeft: 6 }}
            disabled={officialBusy} onClick={() => { setOfficialPreview(null); setOfficialPreviewDbPath(null); }}>
            Cancel</button>
        </div>
      )}

      {officialCoverage.length > 0 && (
        <div style={{ padding: '3px 9px', fontSize: 11, flexShrink: 0, color: 'var(--text-dim)' }}>
          Accepted official calendars: {officialCoverage.map((row) => `${row.exchange} ${row.year}: ${row.recordCount} records (${row.acceptedAt} UTC)`).join(' | ')}
        </div>
      )}

      <div style={marketHolidayTableStyle} role="table" aria-label="Market holiday dates">
        <div style={marketHolidayTableHeaderStyle} role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">Source</span>
          <span role="columnheader">Actions</span>
        </div>
        {holidaysLoading && visibleHolidays.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading holidays...</div>
        ) : visibleHolidays.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)' }}>No holidays loaded.</div>
        ) : (
          visibleHolidays.map((h) => (
            <div key={h.id} style={marketHolidayTableRowStyle} role="row">
              <span role="cell" style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{h.date}</span>
              <span role="cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.name}>{h.name}</span>
              <span role="cell" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{h.source}</span>
              <span role="cell">
                {deleteConfirmId === h.id ? (
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      type="button"
                      style={{ fontSize: 10, color: 'var(--red)', background: 'none', border: '1px solid var(--red)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}
                      disabled={holidayMutationPending !== null}
                      onClick={() => void handleDeleteHoliday(h.id)}
                    >{holidayMutationPending === h.id ? 'Removing...' : 'Confirm'}</button>
                    <button
                      type="button"
                      style={{ fontSize: 10, background: 'none', border: '1px solid var(--border2)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer', color: 'var(--text-dim)' }}
                      disabled={holidayMutationPending !== null}
                      onClick={() => setDeleteConfirmId(null)}
                    >Cancel</button>
                  </span>
                ) : (
                  <button
                    type="button"
                    style={{ fontSize: 11, background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '2px 4px' }}
                    disabled={holidayMutationPending !== null}
                    onClick={() => setDeleteConfirmId(h.id)}
                  >Remove</button>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={marketHolidayAddStyle}>
        <div style={sectionTitleStyle}>Add Holiday</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="date"
            aria-label="Holiday date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            disabled={holidayMutationPending !== null}
            style={{ ...dateInputStyle, width: 150 }}
          />
          <input
            type="text"
            aria-label="Holiday name"
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && newHolidayDate && newHolidayName.trim() && holidayMutationPending === null && void handleAddHoliday()}
            disabled={holidayMutationPending !== null}
            placeholder="Holiday name"
            style={{ ...addSeriesInputStyle, flex: 1, minWidth: 180 }}
            maxLength={80}
          />
          <button
            type="button"
            style={addButtonStyle}
            onClick={() => void handleAddHoliday()}
            disabled={!newHolidayDate || !newHolidayName.trim() || holidayMutationPending !== null}
          >{holidayMutationPending === 'add' ? 'Adding...' : 'Add'}</button>
        </div>
      </div>
      <div
        style={marketHolidayStatusStyle}
        role={holidayStatus.kind === 'error' ? 'alert' : 'status'}
        aria-live={holidayStatus.kind === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
      >
        <span style={{ color: holidayStatus.kind === 'success' ? 'var(--green)' : holidayStatus.kind === 'error' ? 'var(--red)' : 'var(--text-dim)', fontSize: 12 }} aria-hidden="true">
          ●
        </span>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{holidayStatus.message}</span>
        {holidayStatus.time && <span style={{ whiteSpace: 'nowrap', color: 'var(--text-dim)' }}>{holidayStatus.time}</span>}
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

    const runId = crypto.randomUUID();
    const batch = useBhavcopyStore.getState();
    if (!batch.startBatch(runId)) return;
    useChartStore.getState().setDownloadProgress(beginDownloadRun());
    addLog('info', `Mode: ${getDownloadModeLabel(config.mode)}`);
    addLog('info', `Starting download for: ${selectedExchangeLabels.join(', ')}`);
    if (config.mode === 'range') {
      addLog('info', `Date range: ${config.startDate} to ${config.endDate}`);
    } else {
      addLog('info', getDownloadModeHint(config.mode));
    }
    addLog('info', `Workers: ${config.workers}`);

    let failure: string | null = null;
    let cancelled = false;
    try {
      const response = await api.runTrackedBhavcopyBatch({
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
      }, runId, () => batch.acknowledgeBatch(runId, api.cancelBhavcopyBatch));
      const { results: result } = response;
      cancelled = response.cancelled;
      result.forEach(reportDownloadResult);

      const successCount = result.filter((r) => r.success && !isSkippedResult(r)).length;
      const skippedCount = result.filter((r) => isSkippedResult(r)).length;
      const failCount = result.filter((r) => !r.success).length;
      if (failCount > 0) failure = `${failCount} download jobs failed.`;
      const importedRows = result.reduce((total, entry) => total + entry.rowsInserted, 0);
      addLog(
        'info',
        `${cancelled ? 'Download cancelled' : 'Download complete'}: ${successCount} success, ${skippedCount} skipped, ${failCount} failed, imported rows: ${importedRows}`,
      );
    } catch (error) {
      failure = getErrorMessage(error);
      addLog('error', failure);
    } finally {
      batch.finishBatch(runId, cancelled ? 'cancelled' : failure ? 'failed' : 'completed');
      const chart = useChartStore.getState();
      chart.setDownloadProgress(finishDownloadRun(chart.downloadProgress, failure, cancelled));
    }
  };
  const selectedExchangesCount = Object.values(config.exchanges).filter(Boolean).length;
  const { skippedCount, successCount, failedCount, totalRowsInserted, completedCount } = runSummary;
  const runStatus = stopping ? 'Stopping...' : requestingStop ? 'Requesting stop...'
    : isDownloading ? 'Running' : batchOutcome === 'cancelled' ? 'Cancelled'
    : batchOutcome === 'failed' ? 'Stopped With Errors' : batchOutcome === 'completed' ? 'Completed' : 'Idle';
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
    closeWindowStore(BHAVCOPY_WINDOW_ID);
    onClose();
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
              if (activeTab === 'marketHoliday') return;
              setActiveTab('marketHoliday');
              void loadHolidays();
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
                ...(isDownloading ? statusBadgeRunningStyle : batchOutcome === 'failed' || failedCount > 0
                  ? statusBadgeErrorStyle : batchOutcome === 'completed' ? statusBadgeSuccessStyle : null),
              }}
            >
              <span style={statusDotStyle} />
              <span role="status">{runStatus}</span>
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
                  Imported {successCount}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>Skipped {skippedCount}</span>
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
            {isDownloading && (
              <button
                style={secondaryButtonStyle}
                onClick={() => api && void useBhavcopyStore.getState().requestBatchStop(api.cancelBhavcopyBatch)}
                disabled={requestingStop || stopping}
              >
                Request Stop
              </button>
            )}
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
