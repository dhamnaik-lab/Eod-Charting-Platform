import { describe, expect, it } from 'vitest';
import { applyDownloadProgress, beginDownloadRun, finishDownloadRun } from '../downloadRunState';

describe('download command lifetime', () => {
  it('stops on failure and ignores queued events instead of restoring a stale 3% run', () => {
    const active = applyDownloadProgress(beginDownloadRun(), 3, 'Staging');
    const failed = finishDownloadRun(active, 'database is locked');
    expect(failed).toMatchObject({ running: false, progress: 3, error: 'database is locked' });
    expect(applyDownloadProgress(failed, 4, 'Late event')).toBe(failed);
    expect(beginDownloadRun()).toMatchObject({ running: true, progress: 0, error: null });
  });
  it('does not finish early at 100% and does not restart after command completion', () => {
    const stillActive = applyDownloadProgress(beginDownloadRun(), 100, 'Refreshing chart');
    expect(stillActive.running).toBe(true);
    const finished = finishDownloadRun(stillActive, null);
    expect(finished).toMatchObject({ running: false, progress: 100, error: null });
    expect(applyDownloadProgress(finished, 25, 'Late event')).toBe(finished);
  });
});
