import type { DailyMarketSnapshotResult } from '@/platform';
import { buildMarketMoversSnapshot } from './marketMoversSnapshotService';
import type { MarketMoversFilterSettings, MarketMoversSnapshot } from './marketMoversTypes';

interface WorkerBuildRequest {
  type: 'build';
  requestId: string;
  batch: DailyMarketSnapshotResult;
  settings: MarketMoversFilterSettings;
}

interface WorkerCancelRequest {
  type: 'cancel';
  requestId: string;
}

interface WorkerSuccessResponse {
  type: 'success';
  requestId: string;
  snapshot: MarketMoversSnapshot;
}

interface WorkerErrorResponse {
  type: 'error';
  requestId: string;
  error: string;
}

type WorkerResponse = WorkerSuccessResponse | WorkerErrorResponse;

interface PendingRequest {
  resolve: (snapshot: MarketMoversSnapshot) => void;
  reject: (error: Error) => void;
}

let snapshotWorker: Worker | null = null;
const pendingRequests = new Map<string, PendingRequest>();
const fallbackCancellations = new Set<string>();

function createWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (snapshotWorker) return snapshotWorker;

  const worker = new Worker(new URL('./marketMoversSnapshot.worker.ts', import.meta.url), {
    type: 'module',
    name: 'market-movers-snapshot',
  });

  worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const message = event.data;
    const pending = pendingRequests.get(message.requestId);
    if (!pending) return;
    pendingRequests.delete(message.requestId);
    if (message.type === 'success') pending.resolve(message.snapshot);
    else pending.reject(new Error(message.error));
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || 'Market Movers worker failed.');
    for (const pending of pendingRequests.values()) pending.reject(error);
    pendingRequests.clear();
    worker.terminate();
    snapshotWorker = null;
  };

  snapshotWorker = worker;
  return worker;
}

export async function buildMarketMoversSnapshotInWorker(input: {
  requestId: string;
  batch: DailyMarketSnapshotResult;
  settings: MarketMoversFilterSettings;
}): Promise<MarketMoversSnapshot> {
  const worker = createWorker();
  if (!worker) {
    fallbackCancellations.delete(input.requestId);
    try {
      return await buildMarketMoversSnapshot({
        batch: input.batch,
        settings: input.settings,
        shouldCancel: () => fallbackCancellations.has(input.requestId),
      });
    } finally {
      fallbackCancellations.delete(input.requestId);
    }
  }

  if (pendingRequests.has(input.requestId)) {
    throw new Error(`Market Movers worker request already exists: ${input.requestId}`);
  }

  return new Promise<MarketMoversSnapshot>((resolve, reject) => {
    pendingRequests.set(input.requestId, { resolve, reject });
    const message: WorkerBuildRequest = {
      type: 'build',
      requestId: input.requestId,
      batch: input.batch,
      settings: input.settings,
    };
    worker.postMessage(message);
  });
}

export function cancelMarketMoversSnapshotWorker(requestId: string): void {
  fallbackCancellations.add(requestId);
  const pending = pendingRequests.get(requestId);
  if (pending) {
    pendingRequests.delete(requestId);
    pending.reject(new Error('Market Movers calculation cancelled.'));
  }
  const message: WorkerCancelRequest = { type: 'cancel', requestId };
  snapshotWorker?.postMessage(message);
}
