import type { PluginEnabledMap, RegisteredPlugin } from '@/plugins/types';
import { coreEodScannerPlugin } from '@/plugins/scanner/scannerPlugin';
import { dnnTrendPlugin } from '@/plugins/forecast/dnnTrend/dnnTrendPlugin';
import { gannPriceTimePlugin } from '@/plugins/analysis/gannPriceTime/gannPlugin';
import { pluginHost } from '@/plugins/hostRuntime';

export const EXTERNAL_PLUGIN_SUPPORT_LABEL = 'External packages: metadata-only import/reload. Execution disabled pending isolation.';

export const BUILT_IN_PLUGINS: RegisteredPlugin[] = [
  coreEodScannerPlugin,
  dnnTrendPlugin,
  gannPriceTimePlugin,
];

for (const plugin of BUILT_IN_PLUGINS) {
  pluginHost.register(plugin);
}

export { pluginHost };

export function listBuiltInPlugins(): RegisteredPlugin[] {
  return pluginHost.listPlugins();
}

export function getBuiltInPlugin(pluginId: string): RegisteredPlugin | null {
  return pluginHost.getPlugin(pluginId);
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
