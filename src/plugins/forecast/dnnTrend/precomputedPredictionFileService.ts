import { requireDesktopApi } from '@/platform';
import {
  parseDnnTrendPrecomputedPredictionSource,
  type DnnTrendPrecomputedPredictionSource,
} from '@/plugins/forecast/dnnTrend/precomputedPredictionSource';

export const DNN_TREND_PRECOMPUTED_MAX_FILE_BYTES = 16 * 1024 * 1024;

export async function pickDnnTrendPrecomputedPredictionFile(): Promise<string | null> {
  return requireDesktopApi().pickPluginDataFile({
    title: 'Select DNN Trend Prediction JSON',
    filterName: 'DNN Trend Predictions',
    extensions: ['json'],
  });
}

export async function loadDnnTrendPrecomputedPredictionFile(
  filePath: string,
): Promise<DnnTrendPrecomputedPredictionSource> {
  const result = await requireDesktopApi().readPluginTextFile({
    filePath,
    allowedExtensions: ['json'],
    maxBytes: DNN_TREND_PRECOMPUTED_MAX_FILE_BYTES,
  });
  return parseDnnTrendPrecomputedPredictionSource(result.text, {
    filePath: result.filePath,
    byteLength: result.byteLength,
  });
}
