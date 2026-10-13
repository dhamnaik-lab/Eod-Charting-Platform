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

export type PluginLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface PluginLogEntry {
  timestamp: number;
  level: PluginLogLevel;
  message: string;
  data?: unknown;
}

export interface PluginInstrument {
  exchange: string;
  symbol: string;
}

export interface PluginBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  activeInstrument: PluginInstrument | null;
  bars: readonly PluginBar[];
  log: (level: PluginLogLevel, message: string, data?: unknown) => void;
  getLogs?: () => readonly PluginLogEntry[];
}

export interface ChartPluginLifecycle {
  init?(context: PluginContext): Promise<void> | void;
  destroy?(): Promise<void> | void;
  onBarsUpdated?(bars: readonly PluginBar[]): Promise<void> | void;
  onInstrumentChanged?(instrument: PluginInstrument | null): Promise<void> | void;
}

export type PluginRuntimeState = 'unloaded' | 'initializing' | 'active' | 'error' | 'destroyed';

export interface PluginRuntimeInfo {
  pluginId: string;
  state: PluginRuntimeState;
  enabled: boolean;
  lastError: string | null;
  initializedAt: number | null;
}

export interface RegisteredPlugin {
  manifest: PluginManifest;
  externalLoadingSupported: false;
  defaultEnabled: boolean;
  lifecycle?: ChartPluginLifecycle;
}

export type PluginEnabledMap = Record<string, boolean>;
