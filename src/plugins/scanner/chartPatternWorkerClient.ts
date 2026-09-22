import {
  evaluateChartPatterns,
  type ChartPatternEvaluationInput,
  type ChartPatternEvaluationOutput,
  type ChartPatternEvaluationProgress,
} from '@/plugins/scanner/chartPatternEvaluation';

export interface ChartPatternEvaluationExecutor {
  evaluate(input: ChartPatternEvaluationInput): Promise<ChartPatternEvaluationOutput>;
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
  let cancelled = false;
  return {
    evaluate: (input) => {
      cancelled = false;
      return evaluateChartPatterns({
        ...input,
        shouldCancel: () => cancelled || input.shouldCancel?.() === true,
      });
    },
    cancel: () => {
      cancelled = true;
    },
    dispose: () => undefined,
  };
}

function createWorkerExecutor(): ChartPatternEvaluationExecutor {
  let worker: Worker;
  let nextRequestId = 1;
  let activeRequest: ActiveRequest | null = null;

  const handleMessage = (event: MessageEvent<WorkerResponse>) => {
    const request = activeRequest;
    if (!request || event.data.requestId !== request.requestId) return;

    if (event.data.type === 'progress') {
      request.onProgress(event.data.progress);
      return;
    }
    activeRequest = null;
    if (event.data.type === 'complete') {
      request.resolve(event.data.output);
      return;
    }
    request.reject(new Error(event.data.message));
  };

  const handleError = (event: ErrorEvent) => {
    const request = activeRequest;
    if (!request) return;
    activeRequest = null;
    request.reject(new Error(event.message || 'Chart-pattern worker failed.'));
  };

  const startWorker = () => {
    worker = createWorker();
    worker.addEventListener('message', handleMessage);
    worker.addEventListener('error', handleError);
  };
  const resetWorker = () => {
    worker.terminate();
    startWorker();
  };

  startWorker();

  return {
    evaluate(input) {
      if (activeRequest) {
        return Promise.reject(new Error('Chart-pattern worker is already evaluating a symbol.'));
      }
      const requestId = nextRequestId;
      nextRequestId += 1;
      return new Promise<ChartPatternEvaluationOutput>((resolve, reject) => {
        activeRequest = { requestId, resolve, reject, onProgress: input.onProgress ?? (() => undefined) };
        worker.postMessage({
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
      });
    },
    cancel() {
      const request = activeRequest;
      if (!request) return;
      activeRequest = null;
      resetWorker();
      request.resolve({ latestResults: [], historicalResults: [], cancelled: true });
    },
    dispose() {
      const request = activeRequest;
      activeRequest = null;
      worker.terminate();
      if (request) {
        request.resolve({ latestResults: [], historicalResults: [], cancelled: true });
      }
    },
  };
}

function createWorker(): Worker {
  return new Worker(new URL('./chartPatternEvaluation.worker.ts', import.meta.url), { type: 'module' });
}

interface ActiveRequest {
  requestId: number;
  resolve: (output: ChartPatternEvaluationOutput) => void;
  reject: (error: Error) => void;
  onProgress: (progress: ChartPatternEvaluationProgress) => void;
}

type WorkerResponse =
  | { type: 'progress'; requestId: number; progress: ChartPatternEvaluationProgress }
  | { type: 'complete'; requestId: number; output: ChartPatternEvaluationOutput }
  | { type: 'error'; requestId: number; message: string };
