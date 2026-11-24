import { create } from 'zustand';
import { isBackgroundCheckpointProgress } from '@/features/bhavcopy/downloadRunState';
import {
  getDesktopApi,
  type BhavcopyBatchStopReply,
  type DownloadResult,
} from '@/platform';

export interface LogEntry {
  time: string;
  level: 'info' | 'success' | 'error' | 'warning' | 'incomplete';
  message: string;
}

export interface RunSummary {
  successCount: number;
  skippedCount: number;
  failedCount: number;
  partialCount: number;
  totalRowsInserted: number;
  completedCount: number;
  calendarSkipCount: number;
}

export interface DownloadProgress {
  progress: number;
  message: string;
}

type StopBatch = (runId: string) => Promise<BhavcopyBatchStopReply>;

type ActiveBatch = {
  runId: string;
  phase: 'starting' | 'running' | 'stopQueued' | 'requestingStop' | 'stopping';
};

type BatchOutcome = 'completed' | 'cancelled' | 'failed';

interface BhavcopyStoreState {
  activeBatch: ActiveBatch | null;
  batchOutcome: BatchOutcome | null;
  logs: LogEntry[];
  runSummary: RunSummary;
  totalLogEntries: number;
  downloadProgress: DownloadProgress;
  
  // Runtime refs/state for deduplication
  reportedDownloadResults: Set<string>;
  resultIndex: Map<string, DownloadResult>;

  startBatch: (runId: string) => boolean;
  acknowledgeBatch: (runId: string, stop: StopBatch) => void;
  requestBatchStop: (stop: StopBatch) => Promise<void>;
  finishBatch: (runId: string, outcome: BatchOutcome) => void;
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  reportDownloadResult: (result: DownloadResult) => void;
  reconcileFinalResults: (results: DownloadResult[]) => RunSummary;
  setDownloadProgress: (progress: number, message: string) => void;
  
  // Initialization of global listeners
  initGlobalListeners: () => () => void;
}

const MAX_LOG_ENTRIES = 50000;
const EMPTY_RUN_SUMMARY: RunSummary = {
  successCount: 0,
  skippedCount: 0,
  failedCount: 0,
  partialCount: 0,
  totalRowsInserted: 0,
  completedCount: 0,
  calendarSkipCount: 0,
};

function getDownloadResultKey(result: DownloadResult): string {
  return `${result.diagnostic ? "diagnostic::" : ""}${result.exchange}::${result.tradeDate}`;
}

export function isPartialCoverageResult(result: DownloadResult): boolean {
  if (result.outcome) return result.outcome === 'partialCoverage';
  return !result.success && ((result.exchange === 'NSE_INDEX' && result.message.startsWith('Historical subset:'))
    || (result.exchange === 'NSE' && result.message.startsWith('Security subset:')));
}

export function isSkippedResult(result: DownloadResult): boolean {
  if (result.outcome) return result.outcome === 'alreadyPresent' || result.outcome === 'confirmedAbsent' || result.outcome === 'calendarSkip';
  return result.success && result.rowsInserted === 0 && !result.message.startsWith('Historical subset:');
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

function mergeRunSummary(
  currentSummary: RunSummary,
  previousResult: DownloadResult | undefined,
  nextResult: DownloadResult,
): RunSummary {
  const summary = { ...currentSummary };
  const applyContribution = (result: DownloadResult, direction: 1 | -1) => {
    if (result.diagnostic || result.outcome === 'cancelled' || result.outcome === 'reportingWarning') return;
    if (result.outcome === 'calendarSkip') {
      summary.calendarSkipCount += direction;
      return;
    }
    if (isPartialCoverageResult(result)) {
      summary.partialCount += direction;
    } else if (isSkippedResult(result)) {
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
  activeBatch: null,
  batchOutcome: null,
  logs: [],
  runSummary: { ...EMPTY_RUN_SUMMARY },
  totalLogEntries: 0,
  downloadProgress: { progress: 0, message: '' },
  reportedDownloadResults: new Set(),
  resultIndex: new Map(),

  startBatch: (runId) => {
    if (get().activeBatch) return false;
    set({ activeBatch: { runId, phase: 'starting' }, batchOutcome: null });
    get().clearLogs();
    return true;
  },

  acknowledgeBatch: (runId, stop) => {
    const active = get().activeBatch;
    if (active?.runId !== runId || (active.phase !== 'starting' && active.phase !== 'stopQueued')) {
      return;
    }
    set({ activeBatch: { runId, phase: 'running' } });
    if (active.phase === 'stopQueued') void get().requestBatchStop(stop);
  },

  requestBatchStop: async (stop) => {
    const active = get().activeBatch;
    if (!active) return;
    const { runId, phase } = active;
    if (phase === 'starting') {
      set({ activeBatch: { runId, phase: 'stopQueued' } });
      return;
    }
    if (phase !== 'running') return;
    set({ activeBatch: { runId, phase: 'requestingStop' } });
    try {
      const reply = await stop(runId);
      if (get().activeBatch?.runId !== runId) return;
      if (reply === 'noMatchingRun') {
        set({ activeBatch: { runId, phase: 'running' } });
        get().addLog('info', 'The backend no longer has a matching Bhavcopy batch to stop.');
      } else {
        set({ activeBatch: { runId, phase: 'stopping' } });
      }
    } catch (error) {
      if (get().activeBatch?.runId !== runId) return;
      set({ activeBatch: { runId, phase: 'running' } });
      get().addLog('error', `Could not request Bhavcopy stop: ${String(error)}`);
    }
  },

  finishBatch: (runId, outcome) => {
    if (get().activeBatch?.runId === runId) {
      set({ activeBatch: null, batchOutcome: outcome });
    }
  },

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
    const previousResult = resultIndex.get(key);
    if (previousResult && previousResult.success === result.success
      && previousResult.rowsInserted === result.rowsInserted
      && previousResult.message === result.message
      && previousResult.outcome === result.outcome
      && previousResult.followUpWarning === result.followUpWarning) {
      return;
    }

    const nextReported = new Set(reportedDownloadResults);
    nextReported.add(key);

    const nextIndex = new Map(resultIndex);
    nextIndex.set(key, result);

    const nextSummary = mergeRunSummary(runSummary, previousResult, result);

    set({
      reportedDownloadResults: nextReported,
      resultIndex: nextIndex,
      runSummary: nextSummary,
    });

    const exchangeLabel = formatExchangeLabel(result.exchange);
    if (result.outcome === 'sourceAcquired') {
      get().addLog('info', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
    } else if (result.outcome === 'reportingWarning' || result.outcome === 'cancelled') {
      get().addLog('warning', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
    } else if (isPartialCoverageResult(result)) {
      get().addLog(result.exchange === 'NSE' ? 'incomplete' : 'warning', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
    } else if (result.success) {
      if (result.rowsInserted === 0 && result.message) {
        get().addLog('warning', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
      } else {
        get().addLog('success', `[${exchangeLabel}] ${result.tradeDate}: ${result.rowsInserted} rows${result.exchange === 'NSE_INDEX' || result.message.includes('Security admission:') ? `; ${result.message}` : ''}`);
      }
    } else {
      get().addLog('error', `[${exchangeLabel}] ${result.tradeDate}: ${result.message}`);
    }
    if (result.followUpWarning) {
      get().addLog('warning', `[${exchangeLabel}] ${result.tradeDate}: ${result.followUpWarning}`);
    }
  },

  reconcileFinalResults: (results) => {
    // Events are provisional; the returned terminal result set owns the summary.
    const resultIndex = new Map(results.map((result) => [getDownloadResultKey(result), result]));
    let runSummary = { ...EMPTY_RUN_SUMMARY };
    for (const result of resultIndex.values()) {
      runSummary = mergeRunSummary(runSummary, undefined, result);
    }
    set({ resultIndex, runSummary });
    return runSummary;
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

      if (shouldUpdateUi && !isBackgroundCheckpointProgress(message)) {
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
