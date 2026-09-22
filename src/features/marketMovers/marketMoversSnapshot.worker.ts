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

type WorkerRequest = WorkerBuildRequest | WorkerCancelRequest;

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

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const workerScope = self as unknown as WorkerScope;
const cancelledRequests = new Set<string>();

workerScope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'cancel') {
    cancelledRequests.add(message.requestId);
    return;
  }

  void buildSnapshot(message);
};

async function buildSnapshot(message: WorkerBuildRequest): Promise<void> {
  cancelledRequests.delete(message.requestId);
  try {
    const snapshot = await buildMarketMoversSnapshot({
      batch: message.batch,
      settings: message.settings,
      shouldCancel: () => cancelledRequests.has(message.requestId),
    });
    if (cancelledRequests.has(message.requestId)) return;
    workerScope.postMessage({
      type: 'success',
      requestId: message.requestId,
      snapshot,
    });
  } catch (error) {
    if (cancelledRequests.has(message.requestId)) return;
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      error: error instanceof Error ? error.message : 'Market Movers calculation failed.',
    });
  } finally {
    cancelledRequests.delete(message.requestId);
  }
}
