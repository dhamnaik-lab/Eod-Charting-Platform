import { describe, expect, it } from 'vitest';
import { DNN_TREND_PLUGIN_ID } from '@/plugins/forecast/dnnTrend/dnnTrendPlugin';
import {
  getDnnTrendPluginConfiguration,
  normalizeDnnTrendPluginConfiguration,
  setDnnTrendPluginConfiguration,
} from '@/plugins/forecast/dnnTrend/pluginConfiguration';

describe('DNN trend plugin configuration', () => {
  it('fails closed for malformed configuration values', () => {
    expect(normalizeDnnTrendPluginConfiguration(null)).toEqual({
      predictionSourcePath: '',
      researchDatasetOutputDirectory: '',
    });
    expect(normalizeDnnTrendPluginConfiguration([])).toEqual({
      predictionSourcePath: '',
      researchDatasetOutputDirectory: '',
    });
    expect(normalizeDnnTrendPluginConfiguration({
      predictionSourcePath: 42,
      researchDatasetOutputDirectory: 42,
    })).toEqual({
      predictionSourcePath: '',
      researchDatasetOutputDirectory: '',
    });
  });

  it('trims persisted paths and preserves unrelated plugin configurations', () => {
    const configurations = setDnnTrendPluginConfiguration(
      { 'another-plugin': { value: true } },
      {
        predictionSourcePath: '  C:/predictions/dnn.json  ',
        researchDatasetOutputDirectory: '  E:/DNN Research/raw  ',
      },
    );

    expect(configurations['another-plugin']).toEqual({ value: true });
    expect(configurations[DNN_TREND_PLUGIN_ID]).toEqual({
      predictionSourcePath: 'C:/predictions/dnn.json',
      researchDatasetOutputDirectory: 'E:/DNN Research/raw',
    });
    expect(getDnnTrendPluginConfiguration(configurations)).toEqual({
      predictionSourcePath: 'C:/predictions/dnn.json',
      researchDatasetOutputDirectory: 'E:/DNN Research/raw',
    });
  });
});
