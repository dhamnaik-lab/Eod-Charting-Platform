/// <reference lib="webworker" />

import {
  evaluateChartPatterns,
  evaluateToolbarChartPatterns,
  type ChartPatternEvaluationInput,
  type ToolbarChartPatternEvaluationInput,
} from '@/features/chartPatterns/evaluation';

interface EvaluateMessage {
  type: 'evaluate';
  requestId: number;
  input: Omit<ChartPatternEvaluationInput, 'onProgress' | 'shouldCancel'>;
}

interface EvaluateToolbarMessage {
  type: 'evaluate-toolbar';
  requestId: number;
  input: Omit<ToolbarChartPatternEvaluationInput, 'shouldCancel'>;
}

type WorkerRequestMessage = EvaluateMessage | EvaluateToolbarMessage;

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<WorkerRequestMessage>) => {
  if (!event.data) return;
  if (event.data.type === 'evaluate') {
    void evaluate(event.data);
    return;
  }
  if (event.data.type === 'evaluate-toolbar') {
    void evaluateToolbar(event.data);
  }
});

async function evaluate(message: EvaluateMessage): Promise<void> {
  try {
    const output = await evaluateChartPatterns({
      ...message.input,
      onProgress: (progress) => workerScope.postMessage({ type: 'progress', requestId: message.requestId, progress }),
    });
    workerScope.postMessage({ type: 'complete', requestId: message.requestId, output });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : 'Chart-pattern worker failed.',
    });
  }
}

async function evaluateToolbar(message: EvaluateToolbarMessage): Promise<void> {
  try {
    const output = await evaluateToolbarChartPatterns(message.input);
    workerScope.postMessage({ type: 'complete-toolbar', requestId: message.requestId, output });
  } catch (error) {
    workerScope.postMessage({
      type: 'error',
      requestId: message.requestId,
      message: error instanceof Error ? error.message : 'Chart-pattern worker failed.',
    });
  }
}
