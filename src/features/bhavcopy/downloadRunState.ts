import type { ChartStoreState } from '@/store/chartStoreTypes';

type DownloadRun = ChartStoreState['downloadProgress'];

export function beginDownloadRun(): DownloadRun {
  return { running: true, progress: 0, message: 'Starting download', error: null };
}

export function applyDownloadProgress(current: DownloadRun, progress: number, message: string): DownloadRun {
  // Only the command promise owns the lifetime. Late events must not restart a
  // failed/finished run, and a 100% staging event is not command completion.
  if (!current.running) return current;
  return { ...current, progress: Math.max(0, Math.min(100, progress)), message };
}

export function finishDownloadRun(current: DownloadRun, error: string | null): DownloadRun {
  return {
    running: false,
    progress: error ? current.progress : 100,
    message: error ? `Stopped: ${error}` : 'Download finished',
    error,
  };
}
