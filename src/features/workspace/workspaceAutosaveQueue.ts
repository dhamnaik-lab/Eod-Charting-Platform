/**
 * Serializes all workspace-setting writes (manual and debounced autosaves).
 * Only acknowledges data after the backend confirms it was persisted.
 * At most one write is active; queued snapshots coalesce to the latest value.
 */
export interface WorkspaceAutosaveQueue {
  autosave: (signature: string) => void;
  saveNow: (signature: string) => Promise<void>;
  markRestored: (persistedSignature: string) => void;
  getPersistedSignature: () => string;
}

interface WorkspaceAutosaveQueueDeps {
  write: (signature: string) => Promise<void>;
  onFailure: (error: unknown) => void;
  onRecovered: () => void;
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
}

interface SaveWaiter {
  resolve: () => void;
  reject: (error: unknown) => void;
}

interface SaveRequest {
  signature: string;
  epoch: number;
  waiters: SaveWaiter[];
}

export class WorkspaceSaveContextChangedError extends Error {
  constructor() {
    super('Workspace save was superseded by a database or workspace restoration.');
    this.name = 'WorkspaceSaveContextChangedError';
  }
}

export function createWorkspaceAutosaveQueue(deps: WorkspaceAutosaveQueueDeps): WorkspaceAutosaveQueue {
  let persistedSignature = '';
  let epoch = 0;
  let active: SaveRequest | null = null;
  let pending: SaveRequest | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;
  let failureReported = false;

  function stopRetry(): void {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  function rejectWaiters(request: SaveRequest, error: unknown): void {
    for (const waiter of request.waiters) waiter.reject(error);
    request.waiters = [];
  }

  function resolveWaiters(request: SaveRequest): void {
    for (const waiter of request.waiters) waiter.resolve();
    request.waiters = [];
  }

  function clearFailure(): void {
    consecutiveFailures = 0;
    if (failureReported) {
      failureReported = false;
      deps.onRecovered();
    }
  }

  function drain(): void {
    if (active || retryTimer !== null || !pending) return;
    const request = pending;
    pending = null;

    if (request.epoch !== epoch) {
      rejectWaiters(request, new WorkspaceSaveContextChangedError());
      drain();
      return;
    }
    if (request.signature === persistedSignature) {
      resolveWaiters(request);
      clearFailure();
      drain();
      return;
    }

    active = request;
    void (async () => {
      try {
        await deps.write(request.signature);
        if (request.epoch !== epoch) {
          rejectWaiters(request, new WorkspaceSaveContextChangedError());
          return;
        }

        persistedSignature = request.signature;
        resolveWaiters(request);
        clearFailure();
      } catch (error) {
        rejectWaiters(request, error);
        if (request.epoch !== epoch) return;

        // Preserve the newest queued snapshot; retry the failed one only if
        // no later state superseded it. Never mark a rejected write persisted.
        if (!pending) {
          pending = { signature: request.signature, epoch, waiters: [] };
        }
        consecutiveFailures += 1;
        if (!failureReported) {
          failureReported = true;
          deps.onFailure(error);
        }
        const initialDelay = deps.retryDelayMs ?? 1000;
        const maxDelay = deps.maxRetryDelayMs ?? 30000;
        const delay = Math.min(initialDelay * 2 ** Math.min(consecutiveFailures - 1, 12), maxDelay);
        retryTimer = setTimeout(() => {
          retryTimer = null;
          drain();
        }, delay);
      } finally {
        active = null;
        drain();
      }
    })();
  }

  function enqueue(signature: string, waiter?: SaveWaiter, force = false): void {
    if (!active && signature === persistedSignature) {
      if (pending) {
        pending.signature = signature;
        if (waiter) pending.waiters.push(waiter);
        stopRetry();
        drain();
      } else {
        waiter?.resolve();
        clearFailure();
      }
      return;
    }

    if (active?.epoch === epoch && active.signature === signature && !pending) {
      if (waiter) active.waiters.push(waiter);
      return;
    }

    if (pending?.epoch === epoch) {
      pending.signature = signature;
      if (waiter) pending.waiters.push(waiter);
    } else {
      pending = { signature, epoch, waiters: waiter ? [waiter] : [] };
    }

    if (force) stopRetry();
    drain();
  }

  return {
    autosave: (signature) => enqueue(signature),
    saveNow: (signature) => new Promise<void>((resolve, reject) => {
      enqueue(signature, { resolve, reject }, true);
    }),
    markRestored: (signature) => {
      epoch += 1;
      persistedSignature = signature;
      stopRetry();
      if (pending) {
        rejectWaiters(pending, new WorkspaceSaveContextChangedError());
        pending = null;
      }
      if (active) {
        rejectWaiters(active, new WorkspaceSaveContextChangedError());
      }
      clearFailure();
    },
    getPersistedSignature: () => persistedSignature,
  };
}
