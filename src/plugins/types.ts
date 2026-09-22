export type PluginType = 'indicator' | 'scanner' | 'forecast' | 'data-import' | 'ui-window';

export type PluginStatus = 'bundled' | 'planned' | 'disabled' | 'error';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  type: PluginType;
  status: PluginStatus;
  description: string;
  capabilities: string[];
}

export interface RegisteredPlugin {
  manifest: PluginManifest;
  externalLoadingSupported: false;
  defaultEnabled: boolean;
}

export type PluginEnabledMap = Record<string, boolean>;
