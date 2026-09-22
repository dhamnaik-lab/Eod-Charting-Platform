import { describe, expect, it } from 'vitest';
import { DNN_TREND_PLUGIN_ID } from '@/plugins/forecast/dnnTrend/dnnTrendPlugin';
import { CORE_EOD_SCANNER_PLUGIN_ID } from '@/plugins/scanner/scannerPlugin';
import {
  getBuiltInPlugin,
  isPluginEnabled,
  listBuiltInPlugins,
  setPluginEnabled,
} from '@/plugins/registry';

describe('plugin registry', () => {
  it('lists the bundled core scanner and DNN trend adapter plugins', () => {
    const pluginIds = listBuiltInPlugins().map((plugin) => plugin.manifest.id);
    expect(pluginIds).toContain(CORE_EOD_SCANNER_PLUGIN_ID);
    expect(pluginIds).toContain(DNN_TREND_PLUGIN_ID);
  });

  it('preserves the core scanner enabled-by-default behavior', () => {
    expect(getBuiltInPlugin(CORE_EOD_SCANNER_PLUGIN_ID)?.defaultEnabled).toBe(true);
    expect(isPluginEnabled(CORE_EOD_SCANNER_PLUGIN_ID, {})).toBe(true);

    const disabled = setPluginEnabled({}, CORE_EOD_SCANNER_PLUGIN_ID, false);
    expect(isPluginEnabled(CORE_EOD_SCANNER_PLUGIN_ID, disabled)).toBe(false);
  });

  it('keeps the DNN trend adapter disabled until explicitly enabled', () => {
    expect(getBuiltInPlugin(DNN_TREND_PLUGIN_ID)?.defaultEnabled).toBe(false);
    expect(getBuiltInPlugin(DNN_TREND_PLUGIN_ID)?.manifest.status).toBe('bundled');
    expect(isPluginEnabled(DNN_TREND_PLUGIN_ID, {})).toBe(false);

    const enabled = setPluginEnabled({}, DNN_TREND_PLUGIN_ID, true);
    expect(isPluginEnabled(DNN_TREND_PLUGIN_ID, enabled)).toBe(true);
  });

  it('retains the historical enabled default for unknown plugin ids', () => {
    expect(isPluginEnabled('unknown-plugin', {})).toBe(true);
  });
});
