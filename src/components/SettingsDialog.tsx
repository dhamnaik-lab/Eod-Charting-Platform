import React, { useEffect, useRef, useState } from 'react';
import { useUiStore, type SettingsDialogSection } from '@/store/uiStore';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useWindowStore } from '@/store/windowStore';
import {
  browseAppProfileDirectory,
  readAppSettings,
  writeAppSettings,
  type AppSettings,
} from '@/features/app/appSettingsService';
import {
  APP_THEME_OPTIONS,
  applyAppTheme,
  normalizeAppThemeId,
  type AppThemeId,
} from '@/features/app/themeService';
import {
  readDatabaseDefaultPriceMode,
  writeDatabaseDefaultPriceMode,
  type DatabaseDefaultPriceMode,
} from '@/features/workspace/databaseSettingsService';
import { FloatingWindow } from '@/components/FloatingWindow';
import { ColorToolboxRow } from '@/components/common/ColorToolbox';
import {
  DNN_TREND_PLUGIN_ID,
} from '@/plugins/forecast/dnnTrend/dnnTrendPlugin';
import {
  getDnnTrendPluginConfiguration,
  setDnnTrendPluginConfiguration,
} from '@/plugins/forecast/dnnTrend/pluginConfiguration';
import {
  loadDnnTrendPrecomputedPredictionFile,
  pickDnnTrendPrecomputedPredictionFile,
} from '@/plugins/forecast/dnnTrend/precomputedPredictionFileService';
import type {
  DnnTrendPrecomputedPredictionSource,
} from '@/plugins/forecast/dnnTrend/precomputedPredictionSource';
import { DnnTrendPredictionPanel } from '@/plugins/forecast/dnnTrend/DnnTrendPredictionPanel';
import {
  exportFullDnnResearchDataset,
  onDnnResearchDatasetExportProgress,
  pickDnnResearchDatasetOutputDirectory,
  resolveDnnResearchDatasetOutputDirectory,
  summarizeDnnResearchDatasetExport,
} from '@/plugins/forecast/dnnTrend/dnnResearchDatasetExportService';
import {
  EXTERNAL_PLUGIN_SUPPORT_LABEL,
  isPluginEnabled,
  listBuiltInPlugins,
  pluginHost,
  setPluginEnabled,
} from '@/plugins/registry';
import {
  discoverAndLoadExternalPlugins,
  installAndLoadExternalPlugin,
  uninstallExternalPluginById,
} from '@/plugins/pluginLoader';


type DnnSourceValidationState =
  | { status: 'unconfigured'; message: string; source: null }
  | { status: 'loading'; message: string; source: null }
  | { status: 'invalid'; message: string; source: null }
  | { status: 'valid'; message: string; source: DnnTrendPrecomputedPredictionSource };

const EMPTY_DNN_SOURCE_STATE: DnnSourceValidationState = {
  status: 'unconfigured',
  message: 'Select a validated DNN prediction JSON file before enabling this plugin.',
  source: null,
};

async function validateDnnSourcePath(path: string): Promise<DnnSourceValidationState> {
  if (!path.trim()) {
    return EMPTY_DNN_SOURCE_STATE;
  }

  try {
    const source = await loadDnnTrendPrecomputedPredictionFile(path);
    return {
      status: 'valid',
      message: `Valid source: ${source.summary.recordCount.toLocaleString()} records across ${source.summary.symbolCount.toLocaleString()} symbols.`,
      source,
    };
  } catch (error) {
    return {
      status: 'invalid',
      message: error instanceof Error ? error.message : 'Unable to validate the DNN prediction source.',
      source: null,
    };
  }
}

const SETTINGS_WINDOW_ID = 'settings-dialog';
const SECTION_STATUS_CLEAR_DELAY_MS = 1800;

const SETTINGS_SECTION_LABELS: Record<SettingsDialogSection, string> = {
  profile: 'Application Profile settings',
  general: 'General settings',
  'database-defaults': 'Active Database Defaults',
  'chart-colors': 'Chart Colors',
  plugins: 'Plugins',
  maintenance: 'Maintenance',
};

const SETTINGS_NAV_GROUPS: Array<{
  title: string;
  items: Array<{ id: SettingsDialogSection; label: string; description: string }>;
}> = [
  {
    title: 'Application',
    items: [
      { id: 'profile', label: 'Profile', description: 'Folder and app profile location' },
      { id: 'general', label: 'General', description: 'Theme and default exchange' },
      { id: 'database-defaults', label: 'Database Defaults', description: 'Active database defaults' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'plugins', label: 'Plugins', description: 'Bundled plugin controls' },
      { id: 'chart-colors', label: 'Chart Colors', description: 'Candle, grid, and crosshair colors' },
      { id: 'maintenance', label: 'Maintenance', description: 'Audits and maintenance tools' },
    ],
  },
];

export function SettingsDialog() {
  const isOpen = useUiStore((state) => state.settingsDialogOpen);
  const openRequestCount = useUiStore((state) => state.settingsOpenRequestCount);
  const requestedSection = useUiStore((state) => state.settingsDialogRequestedSection);
  const onClose = useUiStore((state) => state.closeSettingsDialog);
  const openBinaryEodParity = useUiStore((state) => state.openBinaryEodParity);
  const setCurrentTheme = useUiStore((state) => state.setCurrentTheme);
  const setCustomChartColors = useUiStore((state) => state.setCustomChartColors);
  const activeDatabasePath = useChartStore((state) => state.snapshot?.activeDatabasePath ?? null);
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const activeChartTab = getActiveChartTab(chartTabs, activeChartTabId);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loadedTheme, setLoadedTheme] = useState<AppThemeId | null>(null);
  const [databaseDefaultPriceMode, setDatabaseDefaultPriceMode] =
    useState<DatabaseDefaultPriceMode>('adjusted');
  const [loadedDatabaseDefaultPriceMode, setLoadedDatabaseDefaultPriceMode] =
    useState<DatabaseDefaultPriceMode>('adjusted');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [activeSection, setActiveSection] = useState<SettingsDialogSection>('profile');
  const sectionStatusTimerRef = useRef<number | null>(null);
  const dnnValidationRequestRef = useRef(0);
  const [dnnSourceState, setDnnSourceState] = useState<DnnSourceValidationState>(
    EMPTY_DNN_SOURCE_STATE,
  );
  const [dnnExportBusy, setDnnExportBusy] = useState(false);
  const [dnnExportStatus, setDnnExportStatus] = useState('');

  useEffect(() => {
    registerWindow({
      id: SETTINGS_WINDOW_ID,
      title: 'Application Settings',
      bounds: {
        x: 220,
        y: 110,
        width: 820,
        height: 600,
      },
      minWidth: 680,
      minHeight: 360,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      void Promise.all([readAppSettings(), readDatabaseDefaultPriceMode()])
        .then(([nextSettings, nextDatabaseDefaultPriceMode]) => {
          setSettings(nextSettings);
          setLoadedTheme(nextSettings.theme);
          setCurrentTheme(nextSettings.theme);
          applyAppTheme(nextSettings.theme);
          setDatabaseDefaultPriceMode(nextDatabaseDefaultPriceMode);
          setLoadedDatabaseDefaultPriceMode(nextDatabaseDefaultPriceMode);
        })
        .catch((error) => {
          setStatus(
            error instanceof Error
              ? `Failed to load settings. ${error.message}`
              : 'Failed to load settings.',
          );
        });
      setStatus('');
      openWindow(SETTINGS_WINDOW_ID);
      focusWindow(SETTINGS_WINDOW_ID);
    } else {
      closeWindow(SETTINGS_WINDOW_ID);
    }
  }, [isOpen, openWindow, focusWindow, closeWindow]);

  // Handle subsequent open requests (restore/focus) without reloading data
  useEffect(() => {
    if (isOpen && openRequestCount > 0) {
      openWindow(SETTINGS_WINDOW_ID);
      focusWindow(SETTINGS_WINDOW_ID);
    }
  }, [openRequestCount, isOpen, openWindow, focusWindow]);

  useEffect(() => {
    return () => {
      if (sectionStatusTimerRef.current !== null) {
        window.clearTimeout(sectionStatusTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen || !settings || !requestedSection) {
      return;
    }

    setActiveSection(requestedSection);
    setStatus(`Opened ${SETTINGS_SECTION_LABELS[requestedSection]}.`);
    if (sectionStatusTimerRef.current !== null) {
      window.clearTimeout(sectionStatusTimerRef.current);
    }
    sectionStatusTimerRef.current = window.setTimeout(() => {
      setStatus((currentStatus) =>
        currentStatus === `Opened ${SETTINGS_SECTION_LABELS[requestedSection]}.`
          ? ''
          : currentStatus,
      );
    }, SECTION_STATUS_CLEAR_DELAY_MS);
  }, [isOpen, openRequestCount, requestedSection, settings]);

  const configuredDnnSourcePath = settings
    ? getDnnTrendPluginConfiguration(settings.pluginConfigurations).predictionSourcePath
    : '';

  useEffect(() => {
    const requestId = ++dnnValidationRequestRef.current;
    if (!isOpen || !configuredDnnSourcePath) {
      setDnnSourceState(EMPTY_DNN_SOURCE_STATE);
      return;
    }

    setDnnSourceState({
      status: 'loading',
      message: 'Validating DNN prediction source...',
      source: null,
    });
    void validateDnnSourcePath(configuredDnnSourcePath).then((nextState) => {
      if (requestId !== dnnValidationRequestRef.current) return;
      setDnnSourceState(nextState);
      if (nextState.status !== 'valid') {
        setSettings((current) => current
          ? {
              ...current,
              pluginEnabled: setPluginEnabled(
                current.pluginEnabled,
                DNN_TREND_PLUGIN_ID,
                false,
              ),
            }
          : current);
      }
    });
  }, [configuredDnnSourcePath, isOpen]);

  if (!isOpen || !settings) {
    return null;
  }

  const handleSave = async () => {
    const dnnEnabled = isPluginEnabled(DNN_TREND_PLUGIN_ID, settings.pluginEnabled);
    if (dnnEnabled && dnnSourceState.status !== 'valid') {
      setStatus('The DNN plugin cannot be saved as enabled until its prediction source validates.');
      return;
    }

    setBusy(true);
    setStatus('Saving settings...');
    try {
      await writeAppSettings(settings);
      if (activeDatabasePath) {
        await writeDatabaseDefaultPriceMode(databaseDefaultPriceMode);
      }
      setCurrentTheme(settings.theme);
      applyAppTheme(settings.theme);
      setCustomChartColors({
        candleUp: settings.candleUpColor,
        candleDown: settings.candleDownColor,
        wickUp: settings.candleUpColor,
        wickDown: settings.candleDownColor,
        gridLine: settings.gridColor,
        crosshair: settings.crosshairColor,
      });
      setLoadedTheme(settings.theme);
      const databasePriceModeChanged =
        activeDatabasePath && loadedDatabaseDefaultPriceMode !== databaseDefaultPriceMode;
      setLoadedDatabaseDefaultPriceMode(databaseDefaultPriceMode);
      setStatus(
        databasePriceModeChanged
          ? 'Settings saved successfully. Reopen the database to apply the new default price mode automatically.'
          : 'Settings saved successfully.',
      );
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleThemeChange = (value: string) => {
    const nextTheme = normalizeAppThemeId(value);
    setSettings({ ...settings, theme: nextTheme });
    setCurrentTheme(nextTheme);
    applyAppTheme(nextTheme);
  };

  const handlePluginToggle = (pluginId: string, enabled: boolean) => {
    if (pluginId === DNN_TREND_PLUGIN_ID && enabled && dnnSourceState.status !== 'valid') {
      setStatus('Select and validate a DNN prediction source before enabling the plugin.');
      return;
    }
    setSettings({
      ...settings,
      pluginEnabled: setPluginEnabled(settings.pluginEnabled, pluginId, enabled),
    });
    setStatus('Plugin setting changed. Save changes to apply it.');
  };

  const handleBrowseDnnSource = async () => {
    try {
      const selectedPath = await pickDnnTrendPrecomputedPredictionFile();
      if (!selectedPath) return;
      setSettings((current) => current
        ? {
            ...current,
            pluginConfigurations: setDnnTrendPluginConfiguration(
              current.pluginConfigurations,
              {
                ...getDnnTrendPluginConfiguration(current.pluginConfigurations),
                predictionSourcePath: selectedPath,
              },
            ),
            pluginEnabled: setPluginEnabled(
              current.pluginEnabled,
              DNN_TREND_PLUGIN_ID,
              false,
            ),
          }
        : current);
      setStatus('DNN prediction source selected. Validation is running; save after it passes.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to select a DNN prediction source.');
    }
  };

  const handleRefreshDnnSource = async () => {
    const path = getDnnTrendPluginConfiguration(
      settings.pluginConfigurations,
    ).predictionSourcePath;
    if (!path) return;
    const requestId = ++dnnValidationRequestRef.current;
    setDnnSourceState({ status: 'loading', message: 'Validating DNN prediction source...', source: null });
    const nextState = await validateDnnSourcePath(path);
    if (requestId !== dnnValidationRequestRef.current) return;
    setDnnSourceState(nextState);
    if (nextState.status !== 'valid') {
      setSettings((current) => current
        ? {
            ...current,
            pluginEnabled: setPluginEnabled(
              current.pluginEnabled,
              DNN_TREND_PLUGIN_ID,
              false,
            ),
          }
        : current);
    }
    setStatus(nextState.message);
  };

  const handleClearDnnSource = () => {
    setSettings({
      ...settings,
      pluginConfigurations: setDnnTrendPluginConfiguration(
        settings.pluginConfigurations,
        {
          ...getDnnTrendPluginConfiguration(settings.pluginConfigurations),
          predictionSourcePath: '',
        },
      ),
      pluginEnabled: setPluginEnabled(
        settings.pluginEnabled,
        DNN_TREND_PLUGIN_ID,
        false,
      ),
    });
    setDnnSourceState(EMPTY_DNN_SOURCE_STATE);
    setStatus('DNN prediction source cleared. Save changes to apply it.');
  };

  const handleBrowseDnnResearchOutputDirectory = async () => {
    try {
      const selectedDirectory = await pickDnnResearchDatasetOutputDirectory();
      const normalizedDirectory = selectedDirectory?.trim() ?? '';
      if (!normalizedDirectory) return;

      setSettings((current) => current
        ? {
            ...current,
            pluginConfigurations: setDnnTrendPluginConfiguration(
              current.pluginConfigurations,
              {
                ...getDnnTrendPluginConfiguration(current.pluginConfigurations),
                researchDatasetOutputDirectory: normalizedDirectory,
              },
            ),
          }
        : current);
      setStatus('DNN research export folder selected. Save changes to remember it.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Unable to select a DNN research export folder. ${error.message}`
          : 'Unable to select a DNN research export folder.',
      );
    }
  };

  const handleExportDnnResearchDataset = async () => {
    if (!activeDatabasePath) {
      setDnnExportStatus('Open a database before exporting a DNN research dataset.');
      return;
    }

    let unsubscribeProgress: (() => void) | null = null;
    try {
      const configuredOutputDirectory = getDnnTrendPluginConfiguration(
        settings.pluginConfigurations,
      ).researchDatasetOutputDirectory;
      const outputParentDirectory = await resolveDnnResearchDatasetOutputDirectory(
        configuredOutputDirectory,
      );
      if (!outputParentDirectory) return;

      if (!configuredOutputDirectory) {
        setSettings((current) => current
          ? {
              ...current,
              pluginConfigurations: setDnnTrendPluginConfiguration(
                current.pluginConfigurations,
                {
                  ...getDnnTrendPluginConfiguration(current.pluginConfigurations),
                  researchDatasetOutputDirectory: outputParentDirectory,
                },
              ),
            }
          : current);
        setStatus('DNN research export folder selected. Save changes to remember it.');
      }

      setDnnExportBusy(true);
      setDnnExportStatus('Preparing full read-only DNN research dataset export...');
      unsubscribeProgress = onDnnResearchDatasetExportProgress((progress) => {
        setDnnExportStatus(progress.message);
      });
      const result = await exportFullDnnResearchDataset(outputParentDirectory);
      setDnnExportStatus(summarizeDnnResearchDatasetExport(result));
    } catch (error) {
      setDnnExportStatus(
        error instanceof Error ? error.message : 'DNN research dataset export failed.',
      );
    } finally {
      unsubscribeProgress?.();
      setDnnExportBusy(false);
    }
  };

  const handleSectionSelect = (section: SettingsDialogSection) => {
    setActiveSection(section);
    setStatus('');
  };

  const handleBrowseProfileDirectory = async () => {
    try {
      const selectedPath = await browseAppProfileDirectory();
      if (!selectedPath) {
        return;
      }
      setSettings({ ...settings, profileDirectory: selectedPath });
      setStatus('Application profile folder selected. Save changes to apply it.');
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `Failed to browse for an application profile folder. ${error.message}`
          : 'Unable to open the application profile folder picker.',
      );
    }
  };

  const handleUseDefaultProfileDirectory = () => {
    if (!settings.defaultProfileDirectory.trim()) {
      return;
    }
    setSettings({
      ...settings,
      profileDirectory: settings.defaultProfileDirectory,
    });
    setStatus('Application profile folder reset to the default location. Save changes to apply it.');
  };

  const handleClose = () => {
    if (loadedTheme) {
      setCurrentTheme(loadedTheme);
      applyAppTheme(loadedTheme);
    }
    onClose();
  };

  return (
    <FloatingWindow id={SETTINGS_WINDOW_ID} onClose={handleClose}>
      <div style={bodyStyle}>
        <nav style={navigationStyle} aria-label="Application settings sections">
          {SETTINGS_NAV_GROUPS.map((group) => (
            <div key={group.title} style={navGroupStyle}>
              <div style={navGroupTitleStyle}>{group.title}</div>
              {group.items.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    style={navButtonStyle(isActive)}
                    onClick={() => handleSectionSelect(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span style={navButtonLabelStyle}>{item.label}</span>
                    <span style={navButtonDescriptionStyle}>{item.description}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={optionsPaneStyle}>
          <div style={optionsHeaderStyle}>
            <div style={optionsTitleStyle}>
              {SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === activeSection)?.label}
            </div>
            <div style={hintStyle}>
              {SETTINGS_NAV_GROUPS.flatMap((group) => group.items).find((item) => item.id === activeSection)?.description}
            </div>
          </div>

        {activeSection === 'profile' && (
          <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Application Profile</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Profile Folder</label>
            <div style={pathRowStyle}>
              <input type="text" style={{ ...inputStyle, ...pathInputStyle }} value={settings.profileDirectory} readOnly />
              <button type="button" style={secondaryButtonStyle} onClick={() => void handleBrowseProfileDirectory()}>
                Browse...
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={handleUseDefaultProfileDirectory}
                disabled={!settings.defaultProfileDirectory.trim()}
              >
                Use Default
              </button>
            </div>
            <div style={hintStyle}>
              App-level settings and recent databases are stored here. Runtime logs stay in the local runtime folder.
            </div>
            <div style={hintStyle}>Default: {settings.defaultProfileDirectory || 'Unavailable'}</div>
          </div>
        </div>
        )}

        {activeSection === 'general' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>General</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Theme</label>
            <select
              style={inputStyle}
              value={settings.theme}
              onChange={(e) => handleThemeChange(e.target.value)}
            >
              {APP_THEME_OPTIONS.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {theme.label}
                </option>
              ))}
            </select>
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Default Exchange</label>
            <select
              style={inputStyle}
              value={settings.defaultExchange}
              onChange={(e) => setSettings({ ...settings, defaultExchange: e.target.value })}
            >
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </div>
        </div>
        )}

        {activeSection === 'database-defaults' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Active Database Defaults</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Default Price Mode</label>
            <select
              style={inputStyle}
              value={databaseDefaultPriceMode}
              onChange={(e) =>
                setDatabaseDefaultPriceMode(e.target.value === 'adjusted' ? 'adjusted' : 'raw')
              }
              disabled={!activeDatabasePath}
            >
              <option value="raw">Raw</option>
              <option value="adjusted">Adjusted</option>
            </select>
            <div style={hintStyle}>
              {activeDatabasePath
                ? 'This is stored in the active database, applied when that database opens, and live price-mode changes also update it for the next reopen.'
                : 'Open a database to save a default price mode for that database.'}
            </div>
          </div>
        </div>
        )}

        {activeSection === 'plugins' && (
        <div style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={sectionTitleStyle}>Plugins</div>
              <div style={hintStyle}>{EXTERNAL_PLUGIN_SUPPORT_LABEL}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  void installAndLoadExternalPlugin()
                    .then((installed) => {
                      if (installed) {
                        setSettings({ ...settings });
                        setStatus(`Installed external plugin "${installed.manifest.name}" as inactive metadata. Execution requires a future isolated runtime.`);
                      }
                    })
                    .catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
                }}
              >
                Import Plugin (.eodplugin / .zip)...
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  void discoverAndLoadExternalPlugins(settings.pluginEnabled)
                    .then((list) => {
                      setSettings({ ...settings });
                      setStatus(`Discovered ${list.length} external plugin(s) as inactive metadata. No plugin JavaScript executed.`);
                    })
                    .catch((err) => setStatus(err instanceof Error ? err.message : String(err)));
                }}
              >
                Reload External
              </button>
            </div>
          </div>
          <div style={pluginListStyle}>
            {listBuiltInPlugins().map((plugin) => {
              const enabled = plugin.manifest.status === 'external'
                ? false
                : isPluginEnabled(plugin.manifest.id, settings.pluginEnabled);
              const isDnnTrend = plugin.manifest.id === DNN_TREND_PLUGIN_ID;
              const canEnable = !isDnnTrend || dnnSourceState.status === 'valid';
              const dnnConfiguration = getDnnTrendPluginConfiguration(settings.pluginConfigurations);
              const activeAsOfDate = activeChartTab?.rawBars[activeChartTab.rawBars.length - 1]?.date ?? null;
              return (
                <div key={plugin.manifest.id} style={pluginRowStyle}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={plugin.manifest.status !== 'bundled' || !canEnable}
                    aria-label={`Enable ${plugin.manifest.name}`}
                    onChange={(event) => handlePluginToggle(plugin.manifest.id, event.target.checked)}
                  />
                  <div style={pluginMainStyle}>
                    <span style={pluginNameStyle}>{plugin.manifest.name}</span>
                    <span style={hintStyle}>
                      {plugin.manifest.type} · v{plugin.manifest.version} · {plugin.manifest.status}
                    </span>
                    <span style={hintStyle}>{plugin.manifest.description}</span>
                    {plugin.manifest.status === 'external' && (
                      <span style={hintStyle}>Installed but inactive. Third-party execution is blocked until isolation is approved.</span>
                    )}

                    {isDnnTrend && (
                      <div style={dnnConfigurationStyle}>
                        <div style={pathRowStyle}>
                          <input
                            type="text"
                            style={{ ...inputStyle, ...pathInputStyle }}
                            value={dnnConfiguration.predictionSourcePath}
                            placeholder="No prediction source configured"
                            readOnly
                          />
                          <button type="button" style={secondaryButtonStyle} onClick={() => void handleBrowseDnnSource()}>
                            Browse...
                          </button>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={() => void handleRefreshDnnSource()}
                            disabled={!dnnConfiguration.predictionSourcePath || dnnSourceState.status === 'loading'}
                          >
                            Validate
                          </button>
                        </div>
                        <div style={dnnActionRowStyle}>
                          <button
                            type="button"
                            style={secondaryButtonStyle}
                            onClick={handleClearDnnSource}
                            disabled={!dnnConfiguration.predictionSourcePath}
                          >
                            Clear Source
                          </button>
                          <span style={dnnSourceStatusStyle(dnnSourceState.status)}>
                            {dnnSourceState.message}
                          </span>
                        </div>

                        <div style={dnnResearchExportStyle}>
                          <div style={dnnResearchExportHeaderStyle}>
                            <div>
                              <div style={labelStyle}>External Research Dataset</div>
                              <div style={hintStyle}>
                                Export the active database through a read-only connection as a versioned manifest plus instruments, daily bars, corporate actions, and explicit failures CSV files. The full export includes inactive instruments and uses capital-action-adjusted bars without dividend or rights adjustments.
                              </div>
                            </div>
                            <button
                              type="button"
                              style={secondaryButtonStyle}
                              onClick={() => void handleExportDnnResearchDataset()}
                              disabled={!activeDatabasePath || dnnExportBusy}
                            >
                              {dnnExportBusy ? 'Exporting...' : 'Export Full Dataset...'}
                            </button>
                          </div>
                          <div>
                            <div style={labelStyle}>Export folder</div>
                            <div style={dnnResearchExportPathRowStyle}>
                              <input
                                type="text"
                                style={{ ...inputStyle, ...pathInputStyle }}
                                value={dnnConfiguration.researchDatasetOutputDirectory}
                                placeholder="Choose on first export or browse for a folder"
                                readOnly
                              />
                              <button
                                type="button"
                                style={secondaryButtonStyle}
                                onClick={() => void handleBrowseDnnResearchOutputDirectory()}
                                disabled={dnnExportBusy}
                              >
                                Browse...
                              </button>
                            </div>
                            <div style={hintStyle}>
                              {dnnConfiguration.researchDatasetOutputDirectory
                                ? 'Saved with plugin settings after you click Save Changes. Future exports use this folder directly.'
                                : 'No export folder is saved. Export Full Dataset will ask for a folder and you can save that selection for future sessions.'}
                            </div>
                          </div>
                          <div style={dnnResearchExportStatusStyle}>
                            {dnnExportStatus || (activeDatabasePath
                              ? 'No research dataset export has been run in this session.'
                              : 'Open a database to enable research dataset export.')}
                          </div>
                        </div>

                        {dnnSourceState.status === 'valid' && dnnSourceState.source && (
                          <>
                            <div style={dnnSummaryGridStyle}>
                              <span>Model: {dnnSourceState.source.document.model.modelId} v{dnnSourceState.source.document.model.modelVersion}</span>
                              <span>Feature schema: {dnnSourceState.source.document.model.featureVersion}</span>
                              <span>Dates: {dnnSourceState.source.summary.firstAsOfDate} to {dnnSourceState.source.summary.lastAsOfDate}</span>
                              <span>Production ready: {dnnSourceState.source.document.model.productionReady ? 'Yes' : 'No'}</span>
                            </div>
                            <DnnTrendPredictionPanel
                              source={dnnSourceState.source}
                              activeSymbol={activeChartTab?.instrument?.symbol ?? null}
                              activeExchange={activeChartTab?.instrument?.exchange ?? null}
                              activeAsOfDate={activeAsOfDate}
                            />
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        )}

        {activeSection === 'chart-colors' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Chart Colors</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 440 }}>
            <ColorToolboxRow
              label="Candle Up"
              value={settings.candleUpColor}
              onChange={(candleUpColor) => setSettings({ ...settings, candleUpColor })}
            />
            <ColorToolboxRow
              label="Candle Down"
              value={settings.candleDownColor}
              onChange={(candleDownColor) => setSettings({ ...settings, candleDownColor })}
            />
            <ColorToolboxRow
              label="Grid Lines"
              value={settings.gridColor}
              allowAlpha
              onChange={(gridColor) => setSettings({ ...settings, gridColor })}
            />
            <ColorToolboxRow
              label="Crosshair"
              value={settings.crosshairColor}
              allowAlpha
              onChange={(crosshairColor) => setSettings({ ...settings, crosshairColor })}
            />
          </div>
        </div>
        )}

        {activeSection === 'maintenance' && (
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Maintenance</div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Binary EOD Data</label>
            <button
              type="button"
              style={secondaryButtonStyle}
              onClick={() => {
                onClose();
                openBinaryEodParity();
              }}
            >
              Run Binary Parity Audit...
            </button>
          </div>
        </div>
        )}

        {status && <div style={statusStyle(status.includes('Failed'))}>{status}</div>}
        </div>
      </div>

      <div style={footerStyle}>
        <button style={secondaryButtonStyle} onClick={handleClose}>Cancel</button>
        <button style={primaryButtonStyle} onClick={handleSave} disabled={busy}>
          Save Changes
        </button>
      </div>
    </FloatingWindow>
  );
}

const bodyStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '220px minmax(0, 1fr)',
  background: 'var(--bg)',
  overflow: 'hidden',
};

const navigationStyle: React.CSSProperties = {
  padding: '16px 12px',
  borderRight: '1px solid var(--border)',
  background: 'var(--bg2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  overflowY: 'auto',
};

const navGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const navGroupTitleStyle: React.CSSProperties = {
  padding: '0 8px 4px',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const navButtonStyle = (isActive: boolean): React.CSSProperties => ({
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '9px 10px',
  border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
  borderRadius: 6,
  background: isActive ? 'var(--control-bg-hover)' : 'transparent',
  color: 'var(--text)',
  textAlign: 'left',
  cursor: 'pointer',
});

const navButtonLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.2,
};

const navButtonDescriptionStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  lineHeight: 1.3,
};

const optionsPaneStyle: React.CSSProperties = {
  minWidth: 0,
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  overflowY: 'auto',
};

const optionsHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingBottom: 12,
  borderBottom: '1px solid var(--border)',
};

const optionsTitleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--text)',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--accent)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '8px 12px',
  color: 'var(--text)',
  fontSize: 13,
};

const pathRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  gap: 8,
  alignItems: 'center',
};

const pathInputStyle: React.CSSProperties = {
  minWidth: 0,
};

const pluginListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const pluginRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr)',
  gap: 10,
  alignItems: 'flex-start',
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg2)',
};

const pluginMainStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
};

const pluginNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
};


const dnnConfigurationStyle: React.CSSProperties = {
  marginTop: 8,
  paddingTop: 10,
  borderTop: '1px solid var(--border)',
};

const dnnActionRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 8,
};

const dnnSourceStatusStyle = (status: DnnSourceValidationState['status']): React.CSSProperties => ({
  fontSize: 12,
  lineHeight: 1.4,
  color: status === 'valid'
    ? 'var(--green)'
    : status === 'invalid'
      ? 'var(--red)'
      : 'var(--text-dim)',
});

const dnnResearchExportStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 10,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg2)',
};

const dnnResearchExportHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

const dnnResearchExportPathRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  marginTop: 6,
};

const dnnResearchExportStatusStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
  overflowWrap: 'anywhere',
  color: 'var(--text-dim)',
};

const dnnSummaryGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 6,
  marginTop: 10,
  padding: 8,
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const footerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  backgroundColor: 'var(--bg2)',
};

const primaryButtonStyle: React.CSSProperties = {
  background: 'var(--control-bg-hover)',
  color: 'var(--text)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  padding: '8px 16px',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  background: 'var(--bg3)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '8px 16px',
  fontWeight: 600,
  cursor: 'pointer',
};

const statusStyle = (isError: boolean): React.CSSProperties => ({
  fontSize: 12,
  color: isError ? 'var(--red)' : 'var(--green)',
  marginTop: -8,
});

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
  lineHeight: 1.4,
};
