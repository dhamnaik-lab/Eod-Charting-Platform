import {
  evaluateChartPatterns,
  evaluateToolbarChartPatterns,
  type ChartPatternEvaluationInput,
  type ChartPatternEvaluationOutput,
  type ChartPatternEvaluationProgress,
  type ToolbarChartPatternEvaluationInput,
  type ToolbarChartPatternEvaluationOutput,
} from '@/features/chartPatterns/evaluation';

export interface ChartPatternEvaluationExecutor {
  evaluate(input: ChartPatternEvaluationInput): Promise<ChartPatternEvaluationOutput>;
  evaluateToolbar(input: ToolbarChartPatternEvaluationInput): Promise<ToolbarChartPatternEvaluationOutput>;
  cancel(): void;
  dispose(): void;
}

export function createChartPatternEvaluationExecutor(): ChartPatternEvaluationExecutor {
  if (typeof Worker === 'undefined') {
    return createInlineExecutor();
  }
  return createWorkerExecutor();
}

function createInlineExecutor(): ChartPatternEvaluationExecutor {
  let activeRunId = 0;
  let disposed = false;
  let activeToolbarCancel: (() => void) | null = null;
  return {
    evaluate: (input) => {
      if (disposed) {
        return Promise.resolve({ latestResults: [], historicalResults: [], cancelled: true });
      }
      activeToolbarCancel?.();
      activeToolbarCancel = null;
      const runId = ++activeRunId;
      return evaluateChartPatterns({
        ...input,
        shouldCancel: () => disposed || runId !== activeRunId || input.shouldCancel?.() === true,
      });
    },
    evaluateToolbar: (input) => {
      if (disposed) {
        return Promise.resolve({ results: [], cancelled: true });
      }
      activeToolbarCancel?.();
      activeToolbarCancel = null;
      const runId = ++activeRunId;
      let settled = false;
      return new Promise<ToolbarChartPatternEvaluationOutput>((resolve, reject) => {
        activeToolbarCancel = () => {
          if (settled) return;
          settled = true;
          resolve({ results: [], cancelled: true });
        };
        evaluateToolbarChartPatterns({
          ...input,
          shouldCancel: () => disposed || runId !== activeRunId || input.shouldCancel?.() === true,
        }).then(
          (output) => {
            if (settled) return;
            settled = true;
            if (runId === activeRunId) {
              activeToolbarCancel = null;
            }
            resolve(output);
          },
          (error) => {
            if (settled) return;
            settled = true;
            if (runId === activeRunId) {
              activeToolbarCancel = null;
            }
            reject(error);
          },
        );
      });
    },
    cancel: () => {
      activeRunId += 1;
      const cancelPending = activeToolbarCancel;
      activeToolbarCancel = null;
      cancelPending?.();
    },
    dispose: () => {
      disposed = true;
      activeRunId += 1;
      const cancelPending = activeToolbarCancel;
      activeToolbarCancel = null;
      cancelPending?.();
    },
  };
}

function createWorkerExecutor(): ChartPatternEvaluationExecutor {
  let worker: Worker | null = null;
  let nextRequestId = 1;
  let activeRequest: ActiveRequest | null = null;
  let disposed = false;

  const handleMessage = (event: MessageEvent<WorkerResponse>) => {
    const request = activeRequest;
    if (!request || !event.data || event.data.requestId !== request.requestId) return;

    if (event.data.type === 'progress') {
      if (request.kind === 'standard') {
        request.onProgress(event.data.progress);
      }
      return;
    }
    activeRequest = null;
    if (event.data.type === 'complete' && request.kind === 'standard') {
      request.resolve(event.data.output);
      return;
    }
    if (event.data.type === 'complete-toolbar' && request.kind === 'toolbar') {
      request.resolve(event.data.output);
      return;
    }
    if (event.data.type === 'error') {
      request.reject(new Error(event.data.message));
      return;
    }
    request.reject(new Error('Chart-pattern worker returned an unexpected response.'));
  };

  const terminateWorker = () => {
    if (!worker) return;
    worker.removeEventListener('message', handleMessage);
    worker.removeEventListener('messageerror', handleMessageError);
    worker.removeEventListener('error', handleError);
    worker.terminate();
    worker = null;
  };

  const handleError = (event: ErrorEvent) => {
    const request = activeRequest;
    activeRequest = null;
    terminateWorker();
    if (!request) return;
    request.reject(new Error(event.message || 'Chart-pattern worker failed.'));
  };

  const handleMessageError = () => {
    const request = activeRequest;
    activeRequest = null;
    terminateWorker();
    if (!request) return;
    request.reject(new Error('Chart-pattern worker failed to deserialize response.'));
  };

  const ensureWorker = (): Worker => {
    if (worker) return worker;
    const nextWorker = createWorker();
    nextWorker.addEventListener('message', handleMessage);
    nextWorker.addEventListener('messageerror', handleMessageError);
    nextWorker.addEventListener('error', handleError);
    worker = nextWorker;
    return nextWorker;
  };

  return {
    evaluate(input) {
      if (disposed) {
        return Promise.resolve({ latestResults: [], historicalResults: [], cancelled: true });
      }
      if (activeRequest) {
        return Promise.reject(new Error('Chart-pattern worker is already evaluating a symbol.'));
      }
      return new Promise<ChartPatternEvaluationOutput>((resolve, reject) => {
        try {
          const activeWorker = ensureWorker();
          const requestId = nextRequestId;
          nextRequestId += 1;
          activeRequest = {
            kind: 'standard',
            requestId,
            resolve,
            reject,
            onProgress: input.onProgress ?? (() => undefined),
          };
          activeWorker.postMessage({
            type: 'evaluate',
            requestId,
            input: {
              target: input.target,
              bars: input.bars,
              scannerIds: input.scannerIds,
              evaluateHistory: input.evaluateHistory,
              executionMode: input.executionMode,
            },
          });
        } catch (error) {
          activeRequest = null;
          reject(error instanceof Error ? error : new Error('Failed to post chart-pattern evaluation message.'));
        }
      });
    },
    evaluateToolbar(input) {
      if (disposed) {
        return Promise.resolve({ results: [], cancelled: true });
      }
      if (activeRequest) {
        return Promise.reject(new Error('Chart-pattern worker is already evaluating a symbol.'));
      }
      return new Promise<ToolbarChartPatternEvaluationOutput>((resolve, reject) => {
        try {
          const activeWorker = ensureWorker();
          const requestId = nextRequestId;
          nextRequestId += 1;
          activeRequest = {
            kind: 'toolbar',
            requestId,
            resolve,
            reject,
          };
          activeWorker.postMessage({
            type: 'evaluate-toolbar',
            requestId,
            input: {
              target: input.target,
              bars: input.bars,
              scannerIds: input.scannerIds,
              minScore: input.minScore,
              executionMode: input.executionMode,
            },
          });
        } catch (error) {
          activeRequest = null;
          reject(error instanceof Error ? error : new Error('Failed to post chart-pattern toolbar evaluation message.'));
        }
      });
    },
    cancel() {
      const request = activeRequest;
      if (!request) return;
      activeRequest = null;
      terminateWorker();
      resolveCancelledRequest(request);
    },
    dispose() {
      disposed = true;
      const request = activeRequest;
      activeRequest = null;
      terminateWorker();
      if (request) {
        resolveCancelledRequest(request);
      }
    },
  };
}

function resolveCancelledRequest(request: ActiveRequest): void {
  if (request.kind === 'toolbar') {
    request.resolve({ results: [], cancelled: true });
    return;
  }
  request.resolve({ latestResults: [], historicalResults: [], cancelled: true });
}

function createWorker(): Worker {
  return new Worker(new URL('./evaluation.worker.ts', import.meta.url), { type: 'module' });
}

type ActiveRequest =
  | {
      kind: 'standard';
      requestId: number;
      resolve: (output: ChartPatternEvaluationOutput) => void;
      reject: (error: Error) => void;
      onProgress: (progress: ChartPatternEvaluationProgress) => void;
    }
  | {
      kind: 'toolbar';
      requestId: number;
      resolve: (output: ToolbarChartPatternEvaluationOutput) => void;
      reject: (error: Error) => void;
    };

type WorkerResponse =
  | { type: 'progress'; requestId: number; progress: ChartPatternEvaluationProgress }
  | { type: 'complete'; requestId: number; output: ChartPatternEvaluationOutput }
  | { type: 'complete-toolbar'; requestId: number; output: ToolbarChartPatternEvaluationOutput }
  | { type: 'error'; requestId: number; message: string };
