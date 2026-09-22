import type { RegisteredPlugin } from '@/plugins/types';
import { DeterministicMockDnnTrendInferenceProvider } from '@/plugins/forecast/dnnTrend/mockInferenceProvider';
import { PrecomputedDnnTrendInferenceProvider } from '@/plugins/forecast/dnnTrend/precomputedInferenceProvider';
import type { DnnTrendPrecomputedPredictionSource } from '@/plugins/forecast/dnnTrend/precomputedPredictionSource';
import {
  DnnTrendPredictionService,
  type DnnTrendPredictionServiceOptions,
} from '@/plugins/forecast/dnnTrend/predictionService';

export const DNN_TREND_PLUGIN_ID = 'dnn-trend-prediction';

export const dnnTrendPlugin: RegisteredPlugin = {
  externalLoadingSupported: false,
  defaultEnabled: false,
  manifest: {
    id: DNN_TREND_PLUGIN_ID,
    name: 'DNN Trend Prediction Adapter',
    version: '0.3.0',
    type: 'forecast',
    status: 'bundled',
    description:
      'Disabled-by-default forecast plugin with validated precomputed JSON loading, exact symbol/date/horizon lookup, a read-only viewer, and a read-only external research-dataset exporter. No live model, chart overlay, or trading action is active.',
    capabilities: [
      'completed-daily-bars-only',
      'multi-horizon-probability-contract',
      'causal-feature-window-v1',
      'replaceable-inference-provider',
      'deterministic-mock-provider',
      'validated-precomputed-json-v1',
      'exact-date-and-revision-lookup',
      'read-only-prediction-viewer',
      'read-only-research-dataset-export-v1',
      'revision-aware-memory-cache',
      'no-live-model',
      'no-order-execution',
    ],
  },
};

export function createDnnTrendFoundationService(
  options: DnnTrendPredictionServiceOptions = {},
): DnnTrendPredictionService {
  return new DnnTrendPredictionService(
    new DeterministicMockDnnTrendInferenceProvider(),
    options,
  );
}

export function createDnnTrendPrecomputedService(
  source: DnnTrendPrecomputedPredictionSource,
  options: DnnTrendPredictionServiceOptions = {},
): DnnTrendPredictionService {
  return new DnnTrendPredictionService(
    new PrecomputedDnnTrendInferenceProvider(source),
    options,
  );
}
