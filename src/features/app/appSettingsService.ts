import { getDesktopApi, requireDesktopApi } from '@/platform';
import {
  DEFAULT_APP_THEME_ID,
  normalizeAppThemeSelection,
  type AppThemeSelectionId,
} from '@/features/app/themeService';
import {
  normalizeEodAlertHistoryEvents,
  normalizeEodAlertRules,
  type EodAlertHistoryEvent,
  type EodAlertRule,
} from '@/features/alerts/eodAlerts';
import type { PluginEnabledMap } from '@/plugins/types';
import {
  createScannerWorkspaceProfile,
  normalizeScannerWorkspaceProfile,
  type ScannerWorkspaceProfile,
} from '@/plugins/scanner/scannerWorkspace';

export interface AppSettings {
  theme: AppThemeSelectionId;
  defaultExchange: string;
  candleUpColor: string;
  candleDownColor: string;
  gridColor: string;
  crosshairColor: string;
  /**
   * `null` means the profile predates the flag, so legacy default values must be
   * detected heuristically. `false` means the stored colours are untouched theme
   * defaults. `true` means the user explicitly picked chart colours.
   */
  chartColorsCustomized: boolean | null;
  pluginEnabled: PluginEnabledMap;
  pluginConfigurations: Record<string, unknown>;
  eodAlertRules: EodAlertRule[];
  eodAlertHistory: EodAlertHistoryEvent[];
  scannerWorkspace: ScannerWorkspaceProfile;
  profileDirectory: string;
  defaultProfileDirectory: string;
}

type AppSettingsChangeListener = (settings: AppSettings) => void;

const appSettingsChangeListeners = new Set<AppSettingsChangeListener>();

export function subscribeAppSettingsChanges(listener: AppSettingsChangeListener): () => void {
  appSettingsChangeListeners.add(listener);
  return () => {
    appSettingsChangeListeners.delete(listener);
  };
}

function notifyAppSettingsChanges(settings: AppSettings): void {
  appSettingsChangeListeners.forEach((listener) => {
    listener(settings);
  });
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: DEFAULT_APP_THEME_ID,
  defaultExchange: 'NSE',
  candleUpColor: '#26a69a',
  candleDownColor: '#ef5350',
  gridColor: '#1e2a3a',
  crosshairColor: '#5588aa',
  chartColorsCustomized: null,
  pluginEnabled: {},
  pluginConfigurations: {},
  eodAlertRules: [],
  eodAlertHistory: [],
  scannerWorkspace: createScannerWorkspaceProfile({
    exchange: 'NSE',
    universeSource: 'active-chart',
    selectedWatchlistIds: [],
    selectedScannerIds: [],
    lookbackBars: 800,
    maxSymbols: 500,
    executionMode: 'responsive',
    familyFilter: 'all',
    directionFilter: 'all',
    minScore: 0,
    recentOnly: true,
    activeSection: 'run',
    resultView: 'values',
    priorityFilter: 'all',
    prioritySort: 'category',
  }),
  profileDirectory: '',
  defaultProfileDirectory: '',
};


function normalizePluginConfigurations(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return { ...(value as Record<string, unknown>) };
}

export async function readAppSettings(): Promise<AppSettings> {
  const api = getDesktopApi();
  if (!api) {
    return DEFAULT_SETTINGS;
  }

  const payload = await api.getAppProfileSettings();

  return {
    theme: normalizeAppThemeSelection(payload.theme),
    defaultExchange: payload.defaultExchange ?? DEFAULT_SETTINGS.defaultExchange,
    candleUpColor: payload.candleUpColor ?? DEFAULT_SETTINGS.candleUpColor,
    candleDownColor: payload.candleDownColor ?? DEFAULT_SETTINGS.candleDownColor,
    gridColor: payload.gridColor ?? DEFAULT_SETTINGS.gridColor,
    crosshairColor: payload.crosshairColor ?? DEFAULT_SETTINGS.crosshairColor,
    chartColorsCustomized:
      typeof payload.chartColorsCustomized === 'boolean'
        ? payload.chartColorsCustomized
        : DEFAULT_SETTINGS.chartColorsCustomized,
    pluginEnabled: payload.pluginEnabled ?? DEFAULT_SETTINGS.pluginEnabled,
    pluginConfigurations: normalizePluginConfigurations(payload.pluginConfigurations),
    eodAlertRules: normalizeEodAlertRules(payload.eodAlertRules),
    eodAlertHistory: normalizeEodAlertHistoryEvents(payload.eodAlertHistory),
    scannerWorkspace: normalizeScannerWorkspaceProfile(payload.scannerWorkspace, DEFAULT_SETTINGS.scannerWorkspace.current),
    profileDirectory: payload.profileDirectory ?? DEFAULT_SETTINGS.profileDirectory,
    defaultProfileDirectory:
      payload.defaultProfileDirectory ?? DEFAULT_SETTINGS.defaultProfileDirectory,
  };
}

export async function writeAppSettings(settings: AppSettings): Promise<void> {
  const api = requireDesktopApi();
  await api.saveAppProfileSettings({
    theme: settings.theme,
    defaultExchange: settings.defaultExchange,
    candleUpColor: settings.candleUpColor,
    candleDownColor: settings.candleDownColor,
    gridColor: settings.gridColor,
    crosshairColor: settings.crosshairColor,
    chartColorsCustomized: settings.chartColorsCustomized,
    pluginEnabled: settings.pluginEnabled,
    pluginConfigurations: settings.pluginConfigurations,
    eodAlertRules: settings.eodAlertRules,
    eodAlertHistory: settings.eodAlertHistory,
    scannerWorkspace: settings.scannerWorkspace,
    profileDirectory: settings.profileDirectory || settings.defaultProfileDirectory,
  });
  notifyAppSettingsChanges(settings);
}

export async function browseAppProfileDirectory(): Promise<string | null> {
  return requireDesktopApi().pickAppProfileDirectory();
}
