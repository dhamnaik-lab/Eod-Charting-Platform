import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createWorkspaceAutosaveQueue,
  WorkspaceSaveContextChangedError,
} from '@/features/workspace/workspaceAutosaveQueue';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks() {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function createHarness(write: (value: string) => Promise<void>) {
  const onFailure = vi.fn();
  const onRecovered = vi.fn();
  const queue = createWorkspaceAutosaveQueue({
    write,
    onFailure,
    onRecovered,
    retryDelayMs: 50,
    maxRetryDelayMs: 200,
  });
  return { queue, onFailure, onRecovered };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('B07 workspace autosave durability and ordering', () => {
  it('acknowledges a snapshot only after its backend write succeeds', async () => {
    const pending = deferred();
    const write = vi.fn(() => pending.promise);
    const { queue, onFailure } = createHarness(write);
    const saved = queue.saveNow('layout-A');
    expect(write).toHaveBeenCalledExactlyOnceWith('layout-A');
    expect(queue.getPersistedSignature()).toBe('');

    pending.resolve();
    await saved;
    expect(queue.getPersistedSignature()).toBe('layout-A');
    expect(onFailure).not.toHaveBeenCalled();
  });

  it('retries a failed autosave, retains its dirty signature and reports one error episode', async () => {
    vi.useFakeTimers();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('Disk temporarily locked'))
      .mockRejectedValueOnce(new Error('Disk still locked'))
      .mockResolvedValue(undefined);
    const { queue, onFailure, onRecovered } = createHarness(write);

    queue.autosave('failed-layout');
    await flushMicrotasks();
    expect(queue.getPersistedSignature()).toBe('');
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(50);
    expect(write).toHaveBeenCalledTimes(2);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(queue.getPersistedSignature()).toBe('');

    await vi.advanceTimersByTimeAsync(100);
    expect(write).toHaveBeenCalledTimes(3);
    expect(queue.getPersistedSignature()).toBe('failed-layout');
    expect(onRecovered).toHaveBeenCalledTimes(1);
  });

  it('does not suppress an identical snapshot after failed persistence', async () => {
    vi.useFakeTimers();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('Not saved'))
      .mockResolvedValue(undefined);
    const { queue } = createHarness(write);

    queue.autosave('same-state');
    await flushMicrotasks();
    expect(queue.getPersistedSignature()).toBe('');
    queue.autosave('same-state');
    await vi.advanceTimersByTimeAsync(50);
    expect(write).toHaveBeenCalledTimes(2);
    expect(queue.getPersistedSignature()).toBe('same-state');

    queue.autosave('same-state');
    await flushMicrotasks();
    expect(write).toHaveBeenCalledTimes(2);
  });

  it('retries the newest snapshot after a failed older write without persisting stale queued content', async () => {
    vi.useFakeTimers();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('Write failed'))
      .mockResolvedValue(undefined);
    const { queue } = createHarness(write);

    queue.autosave('older');
    await flushMicrotasks();
    queue.autosave('newer');
    await vi.advanceTimersByTimeAsync(50);
    expect(write.mock.calls.map(([value]) => value)).toEqual(['older', 'newer']);
    expect(queue.getPersistedSignature()).toBe('newer');
  });

  it('serializes overlapping writes and keeps the most recent queued content even with reversed promise resolution', async () => {
    const first = deferred();
    const second = deferred();
    const write = vi.fn((signature: string) => signature === 'A' ? first.promise : second.promise);
    const { queue } = createHarness(write);

    const manualA = queue.saveNow('A');
    queue.autosave('B');
    queue.autosave('C');
    second.resolve(); // The later write cannot start ahead of the in-flight write.
    await flushMicrotasks();
    expect(write.mock.calls.map(([value]) => value)).toEqual(['A']);
    expect(queue.getPersistedSignature()).toBe('');

    first.resolve();
    await manualA;
    await flushMicrotasks();
    expect(write.mock.calls.map(([value]) => value)).toEqual(['A', 'C']);
    expect(queue.getPersistedSignature()).toBe('C');
  });

  it('waits for both manual Save requests in order, without showing success for the later unsaved snapshot', async () => {
    const first = deferred();
    const second = deferred();
    const write = vi.fn((signature: string) => signature === 'old' ? first.promise : second.promise);
    const { queue } = createHarness(write);

    const manualFirst = queue.saveNow('old');
    let secondAcknowledged = false;
    const manualSecond = queue.saveNow('new').then(() => { secondAcknowledged = true; });
    first.resolve();
    await manualFirst;
    await flushMicrotasks();
    expect(queue.getPersistedSignature()).toBe('old');
    expect(secondAcknowledged).toBe(false);
    expect(write.mock.calls.map(([value]) => value)).toEqual(['old', 'new']);

    second.resolve();
    await manualSecond;
    expect(secondAcknowledged).toBe(true);
    expect(queue.getPersistedSignature()).toBe('new');
  });

  it('does not let a stale earlier write acknowledge a different restored database context', async () => {
    const old = deferred();
    const newWrite = deferred();
    const write = vi.fn((signature: string) => signature === 'db-A' ? old.promise : newWrite.promise);
    const { queue } = createHarness(write);

    const manualOld = queue.saveNow('db-A');
    const canceled = expect(manualOld).rejects.toBeInstanceOf(WorkspaceSaveContextChangedError);
    queue.markRestored('db-B-loaded');
    await canceled;
    expect(queue.getPersistedSignature()).toBe('db-B-loaded');

    queue.autosave('db-B-newer');
    old.resolve(); // Old persistence cannot acknowledge the new database.
    await flushMicrotasks();
    expect(write.mock.calls.map(([value]) => value)).toEqual(['db-A', 'db-B-newer']);
    expect(queue.getPersistedSignature()).toBe('db-B-loaded');
    newWrite.resolve();
    await flushMicrotasks();
    expect(queue.getPersistedSignature()).toBe('db-B-newer');
  });

  it('does not rewrite restored unchanged content, but writes a newly loaded layout as dirty', async () => {
    const write = vi.fn(async () => undefined);
    const { queue } = createHarness(write);
    queue.markRestored('saved-current-workspace');
    queue.autosave('saved-current-workspace');
    await flushMicrotasks();
    expect(write).not.toHaveBeenCalled();

    queue.autosave('named-layout-imported');
    await flushMicrotasks();
    expect(write).toHaveBeenCalledExactlyOnceWith('named-layout-imported');
    expect(queue.getPersistedSignature()).toBe('named-layout-imported');
  });

  it('persists the most recent complete workspace payload for reload after failed older data', async () => {
    vi.useFakeTimers();
    const workspace = (title: string) => JSON.stringify({
      version: 1,
      activeChartTabId: 'tab-one',
      chartTabs: [{
        id: 'tab-one', title, instrument: null,
        timeframe: 'D', chartType: 'candles', renkoBrickSize: 10,
        viewport: { startIndex: 0, endIndex: 25 },
        indicators: [], drawings: [], indicatorPaneHeight: 160,
        sheets: [], activeSheetId: null, layoutMode: 'single',
      }],
    });
    let persisted = workspace('Initial');
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('Transient write failure'))
      .mockImplementation(async (value: string) => { persisted = value; });
    const { queue } = createHarness(write);

    queue.markRestored(persisted);
    queue.autosave(workspace('Old'));
    await flushMicrotasks();
    queue.autosave(workspace('Latest'));
    await vi.advanceTimersByTimeAsync(50);

    const restored = parsePersistedWorkspace(persisted);
    expect(restored?.chartTabs[0].title).toBe('Latest');
    expect(restored?.activeChartTabId).toBe('tab-one');
    expect(queue.getPersistedSignature()).toBe(persisted);
  });

  it('clears the one-time failure state after successful manual retry, allowing a new failure episode', async () => {
    vi.useFakeTimers();
    const write = vi.fn()
      .mockRejectedValueOnce(new Error('First outage'))
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Second outage'))
      .mockResolvedValue(undefined);
    const { queue, onFailure, onRecovered } = createHarness(write);

    const firstManual = queue.saveNow('one');
    await expect(firstManual).rejects.toThrow('First outage');
    expect(onFailure).toHaveBeenCalledTimes(1);
    await queue.saveNow('one'); // Manual Save retries immediately instead of waiting for a timer.
    expect(onRecovered).toHaveBeenCalledTimes(1);
    expect(queue.getPersistedSignature()).toBe('one');

    queue.autosave('two');
    await flushMicrotasks();
    expect(onFailure).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(50);
    expect(queue.getPersistedSignature()).toBe('two');
    expect(onRecovered).toHaveBeenCalledTimes(2);
  });
});
