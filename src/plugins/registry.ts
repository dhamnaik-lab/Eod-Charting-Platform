import type { PluginEnabledMap, RegisteredPlugin } from '@/plugins/types';
import { coreEodScannerPlugin } from '@/plugins/scanner/scannerPlugin';
import { dnnTrendPlugin } from '@/plugins/forecast/dnnTrend/dnnTrendPlugin';
import { gannPriceTimePlugin } from '@/plugins/analysis/gannPriceTime/gannPlugin';

export const EXTERNAL_PLUGIN_SUPPORT_LABEL = 'External plugins: planned, disabled';

const BUILT_IN_PLUGINS: RegisteredPlugin[] = [
  coreEodScannerPlugin,
  dnnTrendPlugin,
  gannPriceTimePlugin,
];

export function listBuiltInPlugins(): RegisteredPlugin[] {
  return BUILT_IN_PLUGINS;
}

export function getBuiltInPlugin(pluginId: string): RegisteredPlugin | null {
  return BUILT_IN_PLUGINS.find((plugin) => plugin.manifest.id === pluginId) ?? null;
}

export function isPluginEnabled(pluginId: string, enabledMap: PluginEnabledMap | null | undefined): boolean {
  const override = enabledMap?.[pluginId];
  if (typeof override === 'boolean') return override;
  return getBuiltInPlugin(pluginId)?.defaultEnabled ?? true;
}

export function setPluginEnabled(
  enabledMap: PluginEnabledMap,
  pluginId: string,
  enabled: boolean,
): PluginEnabledMap {
  return {
    ...enabledMap,
    [pluginId]: enabled,
  };
}
