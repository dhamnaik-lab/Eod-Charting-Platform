export type PluginType = 'indicator' | 'scanner' | 'forecast' | 'data-import' | 'ui-window';

export type PluginStatus = 'bundled' | 'external' | 'planned' | 'disabled' | 'error';

export type PluginPermission = 'data:read' | 'chart:draw' | 'ui:panel' | 'scanner:register' | 'indicator:register';

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  minHostVersion?: string;
  entry?: string;
  type: PluginType;
  status: PluginStatus;
  description: string;
  capabilities: string[];
  permissions?: PluginPermission[];
}

export interface PluginDisposable {
  dispose(): void;
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
  timestamp?: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PluginCoordinateMapper {
  timeToX(barIndex: number): number;
  priceToY(price: number): number;
}

export interface PluginChartOverlayRegistration {
  id: string;
  name: string;
  render: (
    ctx: CanvasRenderingContext2D,
    bars: readonly PluginBar[],
    mapper: PluginCoordinateMapper,
    width: number,
    height: number,
  ) => void;
}

export interface PluginIndicatorRegistration {
  id: string;
  name: string;
  shortLabel?: string;
  placement: 'overlay' | 'pane';
  inputs?: Record<string, { type: 'number' | 'string' | 'boolean'; default: number | string | boolean }>;
  plots: Array<{ key: string; label: string; type: 'line' | 'histogram'; color: string }>;
  calculate: (
    bars: readonly PluginBar[],
    inputs: Record<string, number | string | boolean>,
  ) => Record<string, Array<number | null>>;
}

export interface PluginScannerRegistration {
  id: string;
  name: string;
  categoryName?: string;
  priority?: 1 | 2 | 3;
  description?: string;
  evaluate: (bars: readonly PluginBar[], instrument: PluginInstrument) => {
    matched: boolean;
    direction?: 'bullish' | 'bearish' | 'neutral';
    score?: number;
    reasons?: string[];
    values?: Record<string, number | string | boolean | null>;
  } | null;
}

export interface PluginPanelRegistration {
  id: string;
  title: string;
  location: 'settings' | 'sidebar';
  description?: string;
}

export interface PluginContext {
  pluginId: string;
  manifest: PluginManifest;
  activeInstrument: PluginInstrument | null;
  bars: readonly PluginBar[];
  getBars: () => readonly PluginBar[];
  log: (level: PluginLogLevel, message: string, data?: unknown) => void;
  getLogs?: () => readonly PluginLogEntry[];
  registerChartOverlay: (overlay: PluginChartOverlayRegistration) => PluginDisposable;
  registerIndicator: (indicator: PluginIndicatorRegistration) => PluginDisposable;
  registerScanner: (scanner: PluginScannerRegistration) => PluginDisposable;
  registerPanel: (panel: PluginPanelRegistration) => PluginDisposable;
  registerCleanup: (cleanup: () => void) => PluginDisposable;
}

export interface EodPlugin {
  onload(ctx: PluginContext): Promise<void> | void;
  onunload?(): Promise<void> | void;
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
  externalLoadingSupported: boolean;
  defaultEnabled: boolean;
  lifecycle?: ChartPluginLifecycle;
  instance?: EodPlugin;
}

export type PluginEnabledMap = Record<string, boolean>;