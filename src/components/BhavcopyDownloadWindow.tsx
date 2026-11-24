import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  getDesktopApi,
  type BatchDownloadConfig,
  type BhavcopySettings,
  type DownloadMode,
  type MarketHoliday,
} from '@/platform';
import type {
  OfficialHolidayAcceptedSnapshot,
  OfficialHolidayCsvPreview,
  OfficialHolidayEntry,
  HolidaySourceRow,
  OfficialHolidaySyncPreview,
} from '@/types/desktop';
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
  marketHolidayCardStyle,
  marketHolidayHeaderStyle,
  marketHolidayPageStyle,
  marketHolidayScrollBodyStyle,
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
import { beginDownloadRun, dismissDownloadRun, finishDownloadRun } from '@/features/bhavcopy/downloadRunState';

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

function formatExchangeLabel(value: string): string {
  switch (value.toUpperCase()) {
    case 'NSE':
      return 'NSE';
    case 'BSE':
      return 'BSE';
    case 'NSEINDEX':
    case 'NSE_INDEX':
      return 'NSE Indices';
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

function logLevelText(level: LogEntry['level'], message = '') {
  switch (level) {
    case 'incomplete':
      return 'INCOMPLETE';
    case 'success':
      return 'SUCCESS';
    case 'error':
      return 'ERROR';
    case 'warning':
      // A calendar skip and a genuine source miss both arrive as warnings, but
      // labelling a miss "SKIP" hides work that still needs attention.
      if (message.startsWith('No data available')) return 'NO DATA';
      if (message.startsWith('Exchange holiday') || message.startsWith('Weekend (')) return 'SKIP';
      return 'WARN';
    default:
      return 'INFO';
  }
}

function filterLabel(filter: LogFilter) {
  switch (filter) {
    case 'incomplete':
      return 'Incomplete';
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
      // Repair-only: re-download and replace bars that already exist.
      forceRedownload: false,
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
  const [holidayStatus, setHolidayStatus] = useState<HolidayStatus>({ kind: 'info', message: 'Press Refresh to load the holiday list.', time: '' });
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
  // HOL-06: year-scoped official calendars, rendered per exchange.
  const [holidayYear, setHolidayYear] = useState<number>(new Date().getFullYear());
  // HOL-06: years that actually hold an accepted calendar, so the selector can
  // never hide data the database already has.
  const [availableHolidayYears, setAvailableHolidayYears] = useState<number[]>([]);
  // HOL-06: nothing loads automatically on tab entry; Refresh (or a year change)
  // is the only trigger. 0 means "not requested yet".
  const [holidayRefreshVersion, setHolidayRefreshVersion] = useState(0);
  // HOL-06: the legacy manual list follows the selected year, because the year
  // selector must control what the operator sees.
  const [manualShowAllYears, setManualShowAllYears] = useState(false);
  const manualHolidaysForYear = manualShowAllYears
    ? visibleHolidays
    : visibleHolidays.filter((row) => row.date.startsWith(`${holidayYear}`));
  // Years offered in the selector: everything the database holds, plus the
  // current and next year so a new calendar can be registered before it exists.
  const holidayYearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    const years = new Set<number>([current, current + 1, holidayYear, ...availableHolidayYears]);
    return [...years].sort((left, right) => right - left);
  }, [availableHolidayYears, holidayYear]);
  const [officialEntries, setOfficialEntries] = useState<OfficialHolidayEntry[]>([]);
  const [holidaySources, setHolidaySources] = useState<HolidaySourceRow[]>([]);
  // HOL-06: CSV import of official calendars (preview, then explicit Import).
  const [csvPreview, setCsvPreview] = useState<OfficialHolidayCsvPreview | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  // HOL-06: inline editor for the per-exchange source URL.
  const [editingSourceExchange, setEditingSourceExchange] = useState<string | null>(null);
  const [sourceUrlDraft, setSourceUrlDraft] = useState('');
  const [sourceFragmentsDraft, setSourceFragmentsDraft] = useState('');
  const [sourceSaving, setSourceSaving] = useState(false);
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
    reportHolidayStatus('info', 'Holiday database changed; press Refresh to load.');
  }, [activeDatabasePath]);

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
      // HOL-06: sync the year the operator selected, so a new year can be
      // captured from the UI without a release.
      const result = await api.previewOfficialExchangeHolidays(holidayYear);
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

  // HOL-06: one read-only call returns the official entries, the registered
  // sources and the accepted snapshots for the selected year. This used to be
  // three separate IPC calls, each opening its own SQLite connection, which is
  // what made opening this tab feel slow. It reads the database only - no
  // network happens until the operator presses Sync.
  useEffect(() => {
    if (activeTab !== 'marketHoliday' || !activeDatabasePath || !api) return;
    let cancelled = false;
    const databasePath = activeDatabasePath;
    void (async () => {
      try {
        const view = await api.getHolidayCalendarView(holidayYear);
        if (cancelled) return;
        if ((useChartStore.getState().snapshot?.activeDatabasePath ?? null) !== databasePath) return;
        setOfficialEntries(view.officialEntries);
        setAvailableHolidayYears(view.availableYears);
        setHolidaySources(view.sources);
        setOfficialCoverage(view.snapshots);
      } catch (err) {
        if (cancelled) return;
        setOfficialEntries([]);
        setHolidaySources([]);
        setOfficialCoverage([]);
        reportHolidayStatus('error', err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeDatabasePath, holidayYear, holidayRefreshVersion]);

  const saveHolidaySourceUrl = async (exchange: string) => {
    if (!api || sourceSaving) return;
    setSourceSaving(true);
    try {
      const fragments = sourceFragmentsDraft
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      const saved = await api.upsertHolidaySourceUrl({
        exchange,
        year: holidayYear,
        url: sourceUrlDraft,
        requiredFragments: fragments.length > 0 ? fragments : undefined,
      });
      setHolidaySources((rows) => {
        const kept = rows.filter((row) => !(row.exchange === exchange && row.documentIndex === saved.documentIndex));
        return [...kept, saved].sort(
          (a, b) => a.exchange.localeCompare(b.exchange) || a.documentIndex - b.documentIndex,
        );
      });
      setEditingSourceExchange(null);
      reportHolidayStatus(
        'success',
        `${exchange} ${holidayYear} source saved. Run Sync Official Holidays to fetch and validate it.`,
      );
    } catch (err) {
      reportHolidayStatus('error', err instanceof Error ? err.message : String(err));
    } finally {
      setSourceSaving(false);
    }
  };

  const handleCsvFile = async (file: File) => {
    if (!api) return;
    setCsvBusy(true);
    setCsvPreview(null);
    setCsvText(null);
    try {
      const text = await file.text();
      const preview = await api.previewOfficialHolidayCsv(text);
      setCsvText(text);
      setCsvPreview(preview);
      reportHolidayStatus(
        'info',
        `CSV validated: ${preview.totalRows} rows in ${preview.groups.length} exchange/year blocks. Review, then Import.`,
      );
    } catch (err) {
      reportHolidayStatus('error', err instanceof Error ? err.message : String(err));
    } finally {
      setCsvBusy(false);
    }
  };

  const handleCsvImport = async () => {
    if (!api || !csvPreview || !csvText) return;
    setCsvBusy(true);
    try {
      const result = await api.applyOfficialHolidayCsv(csvText, csvPreview.sha256);
      setCsvPreview(null);
      setCsvText(null);
      reportHolidayStatus(
        'success',
        `Imported ${result.rows} official rows across ${result.groups} blocks (years ${result.years.join(', ')}).`,
      );
      setHolidayRefreshVersion((version) => version + 1);
    } catch (err) {
      reportHolidayStatus('error', err instanceof Error ? err.message : String(err));
    } finally {
      setCsvBusy(false);
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
            title={`Fetch and validate the official ${holidayYear} calendar from the registered sources`}
          >{officialBusy ? 'Checking...' : `Sync Official Holidays (${holidayYear})`}</button>
        <button
          type="button"
          aria-label="Refresh market holidays"
          style={{ ...secondaryButtonStyle, flexShrink: 0, borderRadius: 14, padding: '4px 12px' }}
          onClick={() => {
            setHolidayRefreshVersion((version) => version + 1);
            void loadHolidays();
          }}
          disabled={holidaysLoading || holidayMutationPending !== null}
        >
          {holidaysLoading ? 'Refreshing...' : 'Refresh'}
        </button>
        </div>
      </div>

      <div style={marketHolidayScrollBodyStyle}>
      <div style={marketHolidayCardStyle} aria-label="Official holiday calendar by year">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...sectionTitleStyle, fontSize: 12 }}>Official calendars</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>Accepted exchange data only</span>
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void handleCsvFile(file);
            }}
          />
          <button
            type="button"
            style={{ ...secondaryButtonStyle, marginLeft: 'auto', borderRadius: 12, padding: '3px 10px', fontSize: 11 }}
            disabled={csvBusy}
            onClick={() => csvInputRef.current?.click()}
          >{csvBusy ? 'Working...' : 'Import official CSV'}</button>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label htmlFor="official-holiday-year" style={{ fontSize: 12 }}>Calendar year</label>
          <select
            id="official-holiday-year"
            value={holidayYear}
            onChange={(event) => {
              setHolidayYear(Number(event.target.value));
              setHolidayRefreshVersion((version) => version + 1);
            }}
            style={{ ...modeSelectStyle, width: 104 }}
          >
            {holidayYearOptions.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            Only accepted official calendars are used. Nothing before 2026 is stored unless it came from an official source.
          </span>
        </div>
        {csvPreview && (
          <div
            style={{ border: '1px solid var(--border2)', borderRadius: 5, padding: '7px 9px', fontSize: 11 }}
            aria-label="Official holiday CSV preview"
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              CSV preview — {csvPreview.totalRows} rows, SHA-256 {csvPreview.sha256.slice(0, 12)}…
            </div>
            {csvPreview.groups.map((group) => (
              <div key={`${group.exchange}-${group.year}`} style={{ display: 'flex', gap: 8 }}>
                <span style={{ fontFamily: 'monospace' }}>{group.exchange} {group.year}</span>
                <span>{group.rows} rows</span>
                <span style={{ color: 'var(--text-dim)' }}>replaces {group.replacesExisting} stored</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button
                type="button"
                style={{ ...secondaryButtonStyle, borderRadius: 12, padding: '2px 10px' }}
                disabled={csvBusy}
                onClick={() => void handleCsvImport()}
              >{csvBusy ? 'Importing...' : 'Import into database'}</button>
              <button
                type="button"
                style={{ ...secondaryButtonStyle, borderRadius: 12, padding: '2px 10px' }}
                disabled={csvBusy}
                onClick={() => { setCsvPreview(null); setCsvText(null); }}
              >Cancel</button>
            </div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {(['NSE', 'BSE'] as const).map((exchange) => {
            const baseSource = holidaySources.find((row) => row.exchange === exchange && row.documentIndex === 0);
            const rows = officialEntries.filter((entry) => entry.exchange === exchange);
            const accepted = officialCoverage.find(
              (row) => row.exchange === exchange && row.year === holidayYear,
            );
            return (
              <div key={exchange} style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 3 }}>
                  {exchange} equity — {rows.length} {rows.length === 1 ? 'holiday' : 'holidays'}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    marginBottom: 3,
                    overflowWrap: 'anywhere',
                    color: baseSource ? 'var(--text-dim)' : 'var(--red-text)',
                  }}
                >
                  {baseSource
                    ? `Source: ${baseSource.url}`
                    : `No official source registered for ${exchange} ${holidayYear}.`}
                </div>
                {baseSource && (
                  <div style={{ fontSize: 10, color: 'var(--text-mute)', marginBottom: 4 }}>
                    {baseSource.parser} ·{' '}
                    {baseSource.expectedRows === null
                      ? 'row count not pinned'
                      : `expected ${baseSource.expectedRows} rows`}{' '}
                    · updated {baseSource.updatedAt}
                  </div>
                )}
                {accepted && (
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginBottom: 4 }}>
                    Accepted {accepted.acceptedAt} · {accepted.recordCount} records · SHA-256{' '}
                    {accepted.sourceSha256.slice(0, 12)}…
                  </div>
                )}
                {editingSourceExchange === exchange ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
                    <input
                      value={sourceUrlDraft}
                      onChange={(event) => setSourceUrlDraft(event.target.value)}
                      aria-label={`${exchange} holiday source URL`}
                      placeholder="https://www.nseindia.com/... or https://www.bseindia.com/..."
                      style={{ ...dateInputStyle, fontFamily: 'monospace', fontSize: 11 }}
                    />
                    {exchange === 'BSE' && (
                      <textarea
                        value={sourceFragmentsDraft}
                        onChange={(event) => setSourceFragmentsDraft(event.target.value)}
                        aria-label={`${exchange} holiday source required fragments`}
                        placeholder={'One required notice fragment per line, e.g.\nNotice No. 20251212-8'}
                        rows={3}
                        style={{ ...dateInputStyle, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
                      />
                    )}
                    <div style={{ fontSize: 10, color: 'var(--text-mute)' }}>
                      https only, host limited to nseindia.com / bseindia.com.
                      {exchange === 'BSE' && ' Fragments pin the notice identity so a changed notice fails closed.'}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        style={{ ...secondaryButtonStyle, borderRadius: 12, padding: '2px 10px' }}
                        disabled={sourceSaving || sourceUrlDraft.trim().length === 0}
                        onClick={() => void saveHolidaySourceUrl(exchange)}
                      >{sourceSaving ? 'Saving...' : 'Save source'}</button>
                      <button
                        type="button"
                        style={{ ...secondaryButtonStyle, borderRadius: 12, padding: '2px 10px' }}
                        disabled={sourceSaving}
                        onClick={() => setEditingSourceExchange(null)}
                      >Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    style={{ ...secondaryButtonStyle, borderRadius: 12, padding: '2px 10px', marginBottom: 6, fontSize: 11 }}
                    onClick={() => {
                      setEditingSourceExchange(exchange);
                      setSourceUrlDraft(baseSource?.url ?? '');
                      setSourceFragmentsDraft((baseSource?.requiredFragments ?? []).join('\n'));
                    }}
                  >{baseSource ? 'Edit source URL' : 'Register source URL'}</button>
                )}
                {rows.length === 0 ? (
                  <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Not yet accepted for {holidayYear}.</div>
                ) : (
                  rows.map((entry) => (
                    <div
                      key={`${entry.exchange}-${entry.date}`}
                      style={{ display: 'flex', gap: 8, fontSize: 11, fontFamily: 'monospace' }}
                    >
                      <span style={{ color: 'var(--text-dim)' }}>{entry.date}</span>
                      <span style={{ overflowWrap: 'anywhere' }}>{entry.name}</span>
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {officialPreview && officialPreviewDbPath === activeDatabasePath && (
        <div style={{ ...marketHolidayCardStyle, maxHeight: 200, overflowY: 'auto', fontSize: 12 }}
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

      <div style={marketHolidayCardStyle}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ ...sectionTitleStyle, fontSize: 12 }}>Manual holiday overrides — {manualShowAllYears ? 'all years' : holidayYear}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
          Hand-entered dates only; official calendars are shown above.
        </span>
        <label style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center', fontSize: 11, color: 'var(--text-dim)' }}>
          <input type="checkbox" checked={manualShowAllYears} onChange={(event) => setManualShowAllYears(event.target.checked)} />
          Show all years
        </label>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{manualHolidaysForYear.length} rows</span>
      </div>

      <div style={marketHolidayTableStyle} role="table" aria-label="Market holiday dates">
        <div style={marketHolidayTableHeaderStyle} role="row">
          <span role="columnheader">Date</span>
          <span role="columnheader">Name</span>
          <span role="columnheader">Source</span>
          <span role="columnheader">Actions</span>
        </div>
        {holidaysLoading && manualHolidaysForYear.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)' }}>Loading holidays...</div>
        ) : manualHolidaysForYear.length === 0 ? (
          <div style={{ padding: 12, color: 'var(--text-dim)' }}>
            No manual holidays for {manualShowAllYears ? 'any year' : holidayYear}.
          </div>
        ) : (
          manualHolidaysForYear.map((h) => (
            <div key={h.id} style={marketHolidayTableRowStyle} role="row">
              <span role="cell" style={{ fontFamily: 'monospace', color: 'var(--text-dim)' }}>{h.date}</span>
              <span role="cell" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={h.name}>{h.name}</span>
              <span role="cell" style={{ fontSize: 10, color: 'var(--text-dim)' }}>{h.source}</span>
              <span role="cell">
                {deleteConfirmId === h.id ? (
                  <span style={{ display: 'inline-flex', gap: 4 }}>
                    <button
                      type="button"
                      style={{ fontSize: 10, color: 'var(--red-text)', background: 'none', border: '1px solid var(--red)', borderRadius: 3, padding: '2px 6px', cursor: 'pointer' }}
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
    // Repair re-download is a Date Range capability only: every other mode
    // skips dates that are already imported, so the flag would be a no-op.
    updateConfig((previous) => ({
      ...previous,
      mode,
      forceRedownload: mode === 'range' ? previous.forceRedownload : false,
    }));
  };

  // All close/unmount paths dismiss only terminal status. The command and its
  // retained Bhavcopy logs continue to own an active run while this UI is hidden.
  useEffect(() => () => {
    const chart = useChartStore.getState();
    chart.setDownloadProgress(dismissDownloadRun(chart.downloadProgress));
  }, []);

  const windowIsOpen = useWindowStore((state) => state.windows[BHAVCOPY_WINDOW_ID]?.isOpen);
  useEffect(() => {
    if (windowIsOpen === false) {
      const chart = useChartStore.getState();
      chart.setDownloadProgress(dismissDownloadRun(chart.downloadProgress));
    }
  }, [windowIsOpen]);

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
    if (config.forceRedownload) {
      addLog('info', 'Repair mode: existing dates in range will be re-imported and their stored bars replaced.');
    }

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
        forceRedownload: config.forceRedownload ?? false,
      }, runId, () => batch.acknowledgeBatch(runId, api.cancelBhavcopyBatch));
      const { results: result } = response;
      cancelled = response.cancelled;
      // Deduplicate against the current run, including results delivered as events.
      result.forEach(reportDownloadResult);

      const { successCount, skippedCount, partialCount, failedCount: failCount,
        totalRowsInserted: importedRows, calendarSkipCount } = batch.reconcileFinalResults(result);
      if (failCount > 0) failure = `${failCount} download jobs failed.`;
      if (!failure && result.some((entry) => entry.diagnostic && entry.exchange === 'BHAVCOPY' && !entry.success)) {
        failure = 'An import operation failed; inspect the recovery evidence and log.';
      }
      addLog(
        'info',
        `${cancelled ? 'Download cancelled' : 'Download complete'}: ${successCount} success, ${skippedCount} skipped, ${partialCount} incomplete, ${failCount} failed, ${calendarSkipCount} calendar skips, imported rows: ${importedRows}`,
      );
    } catch (error) {
      failure = getErrorMessage(error);
      addLog('error', failure);
    } finally {
      batch.finishBatch(runId, cancelled ? 'cancelled' : failure ? 'failed' : 'completed');
      const chart = useChartStore.getState();
      const visible = useUiStore.getState().bhavcopyWindowOpen
        && useWindowStore.getState().windows[BHAVCOPY_WINDOW_ID]?.isOpen;
      chart.setDownloadProgress(finishDownloadRun(chart.downloadProgress, failure, {
        visible: Boolean(visible),
        cancelled,
      }));
    }
  };
  const selectedExchangesCount = Object.values(config.exchanges).filter(Boolean).length;
  const { skippedCount, successCount, failedCount, partialCount, totalRowsInserted, completedCount, calendarSkipCount } = runSummary;
  const runStatus = stopping ? 'Stopping...' : requestingStop ? 'Requesting stop...'
    : isDownloading ? 'Running' : batchOutcome === 'cancelled' ? 'Cancelled'
    : batchOutcome === 'failed' ? 'Stopped With Errors' : batchOutcome === 'completed'
      ? (partialCount > 0 ? 'Completed With Incomplete Coverage' : 'Completed') : 'Idle';
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
    const logText = filteredLogs.map((log) => `[${log.time}] ${logLevelText(log.level, log.message)}: ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText).then(() => {
      setCopySuccess(true);
      window.setTimeout(() => setCopySuccess(false), 2000);
    }).catch((error) => {
      console.error('Failed to copy:', error);
    });
  };

  const handleClose = () => {
    const chart = useChartStore.getState();
    chart.setDownloadProgress(dismissDownloadRun(chart.downloadProgress));
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
              // Deliberately no data load here: Refresh is the only trigger.
              setActiveTab('marketHoliday');
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
                NSE Indices
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
            {config.exchanges.nseIndex ? (
              <div style={modeHintStyle}>
                Daily archives first. For supported indices, historical fallback checks missing dates
                in ranges up to 366 days. See the download log for the supported list. Coverage
                varies by index and date. Existing prices are preserved.
              </div>
            ) : null}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.forceRedownload ?? false}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, forceRedownload: e.target.checked }))
                }
                disabled={isDownloading || config.mode !== 'range'}
              />
              <span style={config.mode === 'range' ? undefined : { opacity: 0.6 }}>
                Re-download existing dates (repair)
                <span style={workersHintStyle}>
                  {config.mode === 'range'
                    ? ' — replaces stored bars with the source rows'
                    : ' — Date Range only'}
                </span>
              </span>
            </label>
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
                {partialCount > 0 && (
                  <div style={statStyle}>
                    <span style={{ ...statValueStyle, ...statSkippedValueStyle }}>{partialCount}</span>
                    <span style={statLabelStyle}>Incomplete</span>
                  </div>
                )}
                <div style={statStyle}>
                  <span style={{ ...statValueStyle, ...(failedCount > 0 ? statFailedValueStyle : null) }}>{failedCount}</span>
                  <span style={statLabelStyle}>Fail</span>
                </div>
                <span style={logCountStyle}>{logCountLabel}</span>
              </div>
            </div>

            <div style={inlineLogToolbarStyle}>
              <div style={filterGroupStyle}>
                {(['all', 'info', 'success', 'warning', 'incomplete', 'error'] as const).map((item) => (
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
                      ...(log.level === 'warning' || log.level === 'incomplete' ? logEntryWarningStyle : null),
                    }}
                  >
                    [{log.time}] {logLevelText(log.level, log.message)}: {log.message}
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
            ) : completedCount > 0 || calendarSkipCount > 0 ? (
              <>
                <span style={{ color: 'var(--green-text)' }}>
                  Imported {successCount + partialCount}
                  {partialCount > 0 ? ` (${partialCount} partial)` : ''}
                </span>
                <span style={{ color: 'var(--text-dim)' }}>Skipped {skippedCount}</span>
                {calendarSkipCount > 0 && <span style={{ color: 'var(--text-dim)' }}>Calendar skips {calendarSkipCount}</span>}
                <span style={{ color: 'var(--red-text)' }}>
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
