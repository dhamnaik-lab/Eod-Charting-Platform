import { create } from 'zustand';
import {
  getDesktopApi,
  type DownloadResult,
} from '@/platform';

export interface LogEntry {
  time: string;
  level: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

export interface RunSummary {
  successCount: number;
  skippedCount: number;
  failedCount: number;
  totalRowsInserted: number;
  completedCount: number;
}

export interface DownloadProgress {
  progress: number;
  message: string;
}

interface BhavcopyStoreState {
  isDownloading: boolean;
  logs: LogEntry[];
  runSummary: RunSummary;
  totalLogEntries: number;
  downloadProgress: DownloadProgress;
  
  // Runtime refs/state for deduplication
  reportedDownloadResults: Set<string>;
  resultIndex: Map<string, DownloadResult>;

  setIsDownloading: (isDownloading: boolean) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  reportDownloadResult: (result: DownloadResult) => void;
  setDownloadProgress: (progress: number, message: string) => void;
  
  // Initialization of global listeners
  initGlobalListeners: () => () => void;
}

const MAX_LOG_ENTRIES = 50000;
const EMPTY_RUN_SUMMARY: RunSummary = {
  successCount: 0,
  skippedCount: 0,
  failedCount: 0,
  totalRowsInserted: 0,
  completedCount: 0,
};

function getDownloadResultKey(result: DownloadResult): string {
  return `${result.exchange}::${result.tradeDate}`;
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

function mergeRunSummary(
  currentSummary: RunSummary,
  previousResult: DownloadResult | undefined,
  nextResult: DownloadResult,
): RunSummary {
  const summary = { ...currentSummary };
  const applyContribution = (result: DownloadResult, direction: 1 | -1) => {
    if (isSkippedResult(result)) {
      summary.skippedCount += direction;
    } else if (result.success) {
      summary.successCount += direction;
    } else {
      summary.failedCount += direction;
    }
    summary.totalRowsInserted += direction * result.rowsInserted;
    summary.completedCount += direction;
  };

  if (previousResult) {
    applyContribution(previousResult, -1);
  }
  applyContribution(nextResult, 1);
  return summary;
}

export const useBhavcopyStore = create<BhavcopyStoreState>((set, get) => ({
  isDownloading: false,
  logs: [],
  runSummary: { ...EMPTY_RUN_SUMMARY },
  totalLogEntries: 0,
  downloadProgress: { progress: 0, message: '' },
  reportedDownloadResults: new Set(),
  resultIndex: new Map(),

  setIsDownloading: (isDownloading) => set({ isDownloading }),

  addLog: (level, message) => {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    set((state) => {
      const nextLogs = [...state.logs, { time, level, message }];
      return {
        totalLogEntries: state.totalLogEntries + 1,
        logs: nextLogs.length > MAX_LOG_ENTRIES
          ? nextLogs.slice(nextLogs.length - MAX_LOG_ENTRIES)
          : nextLogs,
      };
    });
  },

  clearLogs: () => set({
    logs: [],
    totalLogEntries: 0,
    runSummary: { ...EMPTY_RUN_SUMMARY },
    downloadProgress: { progress: 0, message: '' },
    reportedDownloadResults: new Set(),
    resultIndex: new Map(),
  }),

  reportDownloadResult: (result) => {
    const key = getDownloadResultKey(result);
    const { reportedDownloadResults, resultIndex, runSummary } = get();

    if (reportedDownloadResults.has(key)) {
      return;
    }

    const nextReported = new Set(reportedDownloadResults);
    nextReported.add(key);

    const nextIndex = new Map(resultIndex);
    const previousResult = nextIndex.get(key);
    nextIndex.set(key, result);

    const nextSummary = mergeRunSummary(runSummary, previousResult, result);

    set({
      reportedDownloadResults: nextReported,
      resultIndex: nextIndex,
      runSummary: nextSummary,
    });

    const exchangeLabel = formatExchangeLabel(result.exchange);
    if (result.success) {
      if (result.rowsInserted === 0 && result.message) {
        get().addLog('warning', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
      } else {
        get().addLog('success', `[${exchangeLabel}] ${result.tradeDate}: ${result.rowsInserted} rows`);
      }
    } else {
      get().addLog('error', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
    }
  },

  setDownloadProgress: (progress, message) => set({ downloadProgress: { progress, message } }),

  initGlobalListeners: () => {
    const api = getDesktopApi();
    if (!api) return () => {};

    const progressMeta = { lastUiUpdateAt: 0, lastProgress: -1, lastMessage: '' };

    const unsubProgress = api.onDownloadProgress((progress, message) => {
      const isPerTaskProgressMessage = /^\d+\/\d+:/u.test(message);
      const now = Date.now();
      const shouldUpdateUi =
        !isPerTaskProgressMessage ||
        progress === 100 ||
        now - progressMeta.lastUiUpdateAt >= 120 ||
        progress !== progressMeta.lastProgress ||
        message !== progressMeta.lastMessage;

      if (shouldUpdateUi) {
        progressMeta.lastUiUpdateAt = now;
        progressMeta.lastProgress = progress;
        progressMeta.lastMessage = message;
        get().setDownloadProgress(progress, message);
      }

      if (message && !isPerTaskProgressMessage) {
        get().addLog('info', message);
      }
    });

    const unsubResult = api.onDownloadResult((result) => {
      get().reportDownloadResult(result);
    });

    return () => {
      unsubProgress();
      unsubResult();
    };
  },
}));
