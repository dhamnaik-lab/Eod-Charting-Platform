import { afterEach, describe, expect, it, vi } from 'vitest';
import { useBhavcopyStore } from '@/store/bhavcopyStore';
import type { BhavcopyBatchStopReply } from '@/platform';
import { applyDownloadProgress, beginDownloadRun, finishDownloadRun, isBackgroundCheckpointProgress } from '../downloadRunState';

describe('download command lifetime', () => {
  it('stops on failure and ignores queued events instead of restoring a stale 3% run', () => {
    const active = applyDownloadProgress(beginDownloadRun(), 3, 'Staging');
    const failed = finishDownloadRun(active, 'database is locked');
    expect(failed).toMatchObject({ running: false, progress: 3, error: 'database is locked' });
    expect(applyDownloadProgress(failed, 4, 'Late event')).toBe(failed);
    expect(beginDownloadRun()).toMatchObject({ running: true, progress: 0, error: null });
  });
  it('leaves active batch progress alone when a background checkpoint emits 100%', () => {
    const active = applyDownloadProgress(beginDownloadRun(), 45, 'Staging');
    const message = 'Background checkpoint complete for Bhavcopy session fixture';
    expect(isBackgroundCheckpointProgress(message)).toBe(true);
    expect(applyDownloadProgress(active, 100, message)).toBe(active);
  });

  it('keeps cancelled progress below 100 and retains any completed job failures', () => {
    const active = applyDownloadProgress(beginDownloadRun(), 100, 'Queued event');
    expect(finishDownloadRun(active, '1 job failed', true)).toEqual({
      running: false, progress: 99, message: 'Download cancelled', error: '1 job failed',
    });
  });

  it('does not finish early at 100% and does not restart after command completion', () => {
    const stillActive = applyDownloadProgress(beginDownloadRun(), 100, 'Refreshing chart');
    expect(stillActive.running).toBe(true);
    const finished = finishDownloadRun(stillActive, null);
    expect(finished).toMatchObject({ running: false, progress: 100, error: null });
    expect(applyDownloadProgress(finished, 25, 'Late event')).toBe(finished);
  });
});

describe('tracked Bhavcopy window state', () => {
  const store = () => useBhavcopyStore.getState();

  afterEach(() => useBhavcopyStore.setState(useBhavcopyStore.getInitialState()));

  it('queues an immediate stop until the matching acknowledgement and remains active after acceptance', async () => {
    let reply!: (value: BhavcopyBatchStopReply) => void;
    const stop = vi.fn(() => new Promise<BhavcopyBatchStopReply>((resolve) => { reply = resolve; }));
    expect(store().startBatch('first')).toBe(true);
    expect(store().startBatch('second')).toBe(false);
    await store().requestBatchStop(stop);
    await store().requestBatchStop(stop);
    store().acknowledgeBatch('other', stop);
    expect(stop).not.toHaveBeenCalled();
    expect(store().activeBatch?.phase).toBe('stopQueued');
    store().acknowledgeBatch('first', stop);
    expect(stop).toHaveBeenCalledExactlyOnceWith('first');
    expect(store().activeBatch?.phase).toBe('requestingStop');
    reply('accepted');
    await vi.waitFor(() => expect(store().activeBatch?.phase).toBe('stopping'));
    await store().requestBatchStop(stop);
    expect(stop).toHaveBeenCalledTimes(1);

    store().reportDownloadResult({
      success: true, exchange: 'NSE', tradeDate: '2026-01-02', rowsInserted: 4,
      message: 'Imported 4 rows',
    });
    store().finishBatch('first', 'cancelled');
    expect(store().activeBatch).toBeNull();
    expect(store().batchOutcome).toBe('cancelled');
    expect(store().runSummary).toMatchObject({ successCount: 1, totalRowsInserted: 4 });
  });

  it('handles no matching run and a failed stop request without finishing the batch', async () => {
    const missing = vi.fn(async () => 'noMatchingRun' as const);
    await store().requestBatchStop(missing);
    expect(missing).not.toHaveBeenCalled();
    store().startBatch('first');
    store().acknowledgeBatch('first', missing);
    await store().requestBatchStop(missing);
    expect(store().activeBatch?.phase).toBe('running');
    expect(store().batchOutcome).toBeNull();
    await store().requestBatchStop(async () => { throw new Error('IPC failed'); });
    expect(store().activeBatch?.phase).toBe('running');
    expect(store().logs.at(-1)?.message).toContain('IPC failed');
    await store().requestBatchStop(async () => 'alreadyRequested');
    expect(store().activeBatch?.phase).toBe('stopping');
  });

  it('ignores a late stop reply and acknowledgement after the next run starts', async () => {
    let reply!: (value: BhavcopyBatchStopReply) => void;
    const stop = vi.fn(() => new Promise<BhavcopyBatchStopReply>((resolve) => { reply = resolve; }));
    store().startBatch('first');
    store().acknowledgeBatch('first', stop);
    const requested = store().requestBatchStop(stop);
    store().finishBatch('first', 'completed');
    expect(store().batchOutcome).toBe('completed');
    store().startBatch('second');
    store().acknowledgeBatch('first', stop);
    reply('accepted');
    await requested;
    expect(store().activeBatch).toEqual({ runId: 'second', phase: 'starting' });
    expect(store().batchOutcome).toBeNull();
  });
});
