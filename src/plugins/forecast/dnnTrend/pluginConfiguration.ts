import { DNN_TREND_PLUGIN_ID } from '@/plugins/forecast/dnnTrend/dnnTrendPlugin';

export interface DnnTrendPluginConfiguration {
  predictionSourcePath: string;
  researchDatasetOutputDirectory: string;
}

export const DEFAULT_DNN_TREND_PLUGIN_CONFIGURATION: DnnTrendPluginConfiguration = {
  predictionSourcePath: '',
  researchDatasetOutputDirectory: '',
};

export function normalizeDnnTrendPluginConfiguration(
  value: unknown,
): DnnTrendPluginConfiguration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_DNN_TREND_PLUGIN_CONFIGURATION };
  }

  const candidate = value as Record<string, unknown>;
  return {
    predictionSourcePath:
      typeof candidate.predictionSourcePath === 'string'
        ? candidate.predictionSourcePath.trim()
        : '',
    researchDatasetOutputDirectory:
      typeof candidate.researchDatasetOutputDirectory === 'string'
        ? candidate.researchDatasetOutputDirectory.trim()
        : '',
  };
}

export function getDnnTrendPluginConfiguration(
  pluginConfigurations: Record<string, unknown>,
): DnnTrendPluginConfiguration {
  return normalizeDnnTrendPluginConfiguration(pluginConfigurations[DNN_TREND_PLUGIN_ID]);
}

export function setDnnTrendPluginConfiguration(
  pluginConfigurations: Record<string, unknown>,
  configuration: DnnTrendPluginConfiguration,
): Record<string, unknown> {
  return {
    ...pluginConfigurations,
    [DNN_TREND_PLUGIN_ID]: normalizeDnnTrendPluginConfiguration(configuration),
  };
}
