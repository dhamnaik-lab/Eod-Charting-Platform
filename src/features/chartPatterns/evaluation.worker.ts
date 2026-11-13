/// <reference lib="webworker" />

import {
  evaluateChartPatterns,
  type ChartPatternEvaluationInput,
} from '@/features/chartPatterns/evaluation';

interface EvaluateMessage {
  type: 'evaluate';
  requestId: number;
  input: Omit<ChartPatternEvaluationInput, 'onProgress' | 'shouldCancel'>;
}

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<EvaluateMessage>) => {
  if (event.data.type !== 'evaluate') return;
  void evaluate(event.data);
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
