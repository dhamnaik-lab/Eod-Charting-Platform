import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FloatingWindow } from '@/components/FloatingWindow';
import { readAppSettings, writeAppSettings } from '@/features/app/appSettingsService';
import {
  applyEodAlertTriggersToRules,
  appendEodAlertHistoryEvents,
  createEodAlertHistoryEvents,
  createScannerMatchAlertRule,
  formatAlertCondition,
  formatAlertFrequency,
  formatAlertRuleName,
  type EodAlertHistoryEvent,
  type EodAlertRule,
  type EodAlertTrigger,
} from '@/features/alerts/eodAlerts';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { getDesktopApi, type Watchlist } from '@/platform';
import { isPluginEnabled } from '@/plugins/registry';
import { CORE_EOD_SCANNER_PLUGIN_ID, listCoreScannerDefinitions } from '@/plugins/scanner/scannerPlugin';
import {
  DEFAULT_LOOKBACK_BARS,
  DEFAULT_MAX_SYMBOLS,
  MIN_LOOKBACK_BARS,
  parseLookbackBars,
  parseLookbackSelection,
  parsePositiveInteger,
  resolveScannerTargets,
  type ScannerLookbackBars,
} from '@/plugins/scanner/scannerRunConfig';
import { runCoreEodScannerBatch } from '@/plugins/scanner/scannerRunner';
import {
  areScannerWorkspaceConfigsEqual,
  deleteScannerWorkspace,
  duplicateScannerWorkspace,
  renameScannerWorkspace,
  saveScannerWorkspace,
  syncCurrentScannerWorkspace,
  type ScannerWorkspaceConfig,
  type ScannerWorkspaceProfile,
  type ScannerWorkspaceSection,
} from '@/plugins/scanner/scannerWorkspace';
import {
  filterAndSortScannerDefinitions,
  getScannerPriorityDisplay,
  type ScannerPriorityFilter,
  type ScannerPrioritySort,
} from '@/plugins/scanner/scannerPriority';
import {
  buildScannerPatternMapEntries,
  DEFAULT_SCANNER_PATTERN_MAP_FILTERS,
  getScannerPatternMapResultKey,
  type ScannerPatternMapDirectionFilter,
  type ScannerPatternMapFamilyFilter,
  type ScannerPatternMapPriorityFilter,
  type ScannerPatternMapStatusFilter,
} from '@/plugins/scanner/scannerPatternMap';
import type { ScannerDefinition, ScannerResult } from '@/plugins/scanner/types';
import { MarketMoversFullView } from '@/features/marketMovers/MarketMoversFullView';

const SCANNER_WINDOW_ID = 'scanner-window';

type UniverseSource = 'active-chart' | 'symbol-list' | 'watchlists';
type ResultFamilyFilter = 'all' | 'core' | 'gap' | 'reversal' | 'continuation' | 'neutral-bilateral';
type ResultDirectionFilter = 'all' | 'bullish' | 'bearish' | 'neutral';
type ResultViewPreset = 'compact' | 'pattern-detail' | 'values' | 'debug';
type AlertReviewTab = 'latest' | 'history';
type ScannerExecutionMode = 'responsive' | 'fast';

interface ScannerGroup {
  label: string;
  definitions: ScannerDefinition[];
}

interface ScannerWorkloadEstimate {
  targetCount: number;
  sampleSymbol: string;
  sampleBarCount: number;
  estimatedHistoricalEndpoints: number;
}

export function ScannerWindow() {
  const isOpen = useUiStore((state) => state.scannerWindowOpen);
  const openRequestCount = useUiStore((state) => state.scannerOpenRequestCount);
  const onClose = useUiStore((state) => state.closeScannerWindow);
  const snapshot = useChartStore((state) => state.snapshot);
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const selectedWatchlistId = useChartStore((state) => state.selectedWatchlistId);
  const loadInstrument = useChartStore((state) => state.loadInstrument);
  const scrollToViewportStart = useChartStore((state) => state.scrollToViewportStart);
  const addToast = useChartStore((state) => state.addToast);
  const showScannerChartOverlay = useUiStore((state) => state.showScannerChartOverlay);
  const scannerPatternMap = useUiStore((state) => state.scannerPatternMap);
  const showScannerPatternMap = useUiStore((state) => state.showScannerPatternMap);
  const clearScannerPatternMap = useUiStore((state) => state.clearScannerPatternMap);
  const selectScannerPatternMapEntry = useUiStore((state) => state.selectScannerPatternMapEntry);
  const setScannerPatternMapVisibleGeometry = useUiStore((state) => state.setScannerPatternMapVisibleGeometry);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [exchange, setExchange] = useState('NSE');
  const [universeSource, setUniverseSource] = useState<UniverseSource>('active-chart');
  const [selectedScannerIds, setSelectedScannerIds] = useState<string[]>([]);
  const [selectedWatchlistIds, setSelectedWatchlistIds] = useState<number[]>([]);
  const [lookbackBars, setLookbackBars] = useState<ScannerLookbackBars>(DEFAULT_LOOKBACK_BARS);
  const [executionMode, setExecutionMode] = useState<ScannerExecutionMode>('responsive');
  const [maxSymbols, setMaxSymbols] = useState(DEFAULT_MAX_SYMBOLS);
  const [toDate, setToDate] = useState('');
  const [results, setResults] = useState<ScannerResult[]>([]);
  const [alertTriggers, setAlertTriggers] = useState<EodAlertTrigger[]>([]);
  const [alertHistory, setAlertHistory] = useState<EodAlertHistoryEvent[]>([]);
  const [configuredAlertRules, setConfiguredAlertRules] = useState<EodAlertRule[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [familyFilter, setFamilyFilter] = useState<ResultFamilyFilter>('all');
  const [directionFilter, setDirectionFilter] = useState<ResultDirectionFilter>('all');
  const [minScore, setMinScore] = useState(0);
  const [recentOnly, setRecentOnly] = useState(true);
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const [activeSection, setActiveSection] = useState<ScannerWorkspaceSection>('run');
  const [resultView, setResultView] = useState<ResultViewPreset>('values');
  const [activeAlertReviewTab, setActiveAlertReviewTab] = useState<AlertReviewTab>('latest');
  const [priorityFilter, setPriorityFilter] = useState<ScannerPriorityFilter>('all');
  const [prioritySort, setPrioritySort] = useState<ScannerPrioritySort>('category');
  const [patternMapFamilyFilter, setPatternMapFamilyFilter] = useState<ScannerPatternMapFamilyFilter>(DEFAULT_SCANNER_PATTERN_MAP_FILTERS.family);
  const [patternMapDirectionFilter, setPatternMapDirectionFilter] = useState<ScannerPatternMapDirectionFilter>(DEFAULT_SCANNER_PATTERN_MAP_FILTERS.direction);
  const [patternMapPriorityFilter, setPatternMapPriorityFilter] = useState<ScannerPatternMapPriorityFilter>(DEFAULT_SCANNER_PATTERN_MAP_FILTERS.priority);
  const [patternMapStatusFilter, setPatternMapStatusFilter] = useState<ScannerPatternMapStatusFilter>(DEFAULT_SCANNER_PATTERN_MAP_FILTERS.status);
  const [workloadEstimate, setWorkloadEstimate] = useState<ScannerWorkloadEstimate | null>(null);
  const [workloadEstimateLoading, setWorkloadEstimateLoading] = useState(false);
  const [workspaceProfile, setWorkspaceProfile] = useState<ScannerWorkspaceProfile | null>(null);
  const [workspaceHydrated, setWorkspaceHydrated] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const cancelRequestedRef = useRef(false);
  const workspaceProfileRef = useRef<ScannerWorkspaceProfile | null>(null);
  const workspaceSaveGenerationRef = useRef(0);

  const activeTab = useMemo(
    () => getActiveChartTab(chartTabs, activeChartTabId),
    [chartTabs, activeChartTabId],
  );
  const signalRules = useUiStore((state) => state.signalRules);
  const activeInstrument = activeTab?.instrument ?? activeTab?.requestedInstrument ?? null;
  const watchlists = useMemo(() => snapshot?.watchlists ?? [], [snapshot?.watchlists]);
  const selectedWatchlist = watchlists.find((watchlist) => watchlist.id === selectedWatchlistId) ?? null;
  const selectedWatchlists = useMemo(
    () => watchlists.filter((watchlist) => selectedWatchlistIds.includes(watchlist.id)),
    [watchlists, selectedWatchlistIds],
  );
  const scannerDefinitions = useMemo(() => listCoreScannerDefinitions(), []);
  const visibleScannerDefinitions = useMemo(
    () => filterAndSortScannerDefinitions(scannerDefinitions, priorityFilter, prioritySort),
    [scannerDefinitions, priorityFilter, prioritySort],
  );
  const scannerGroups = useMemo(() => groupScannerDefinitions(visibleScannerDefinitions), [visibleScannerDefinitions]);
  const selectedScannerDefinition = useMemo(
    () =>
      selectedScannerIds.length === 1
        ? scannerDefinitions.find((definition) => definition.id === selectedScannerIds[0]) ?? null
        : null,
    [scannerDefinitions, selectedScannerIds],
  );
  const allScannerIds = useMemo(() => scannerDefinitions.map((definition) => definition.id), [scannerDefinitions]);
  const selectedScannerIdSet = useMemo(() => new Set(selectedScannerIds), [selectedScannerIds]);
  const selectedScannerDefinitions = useMemo(
    () => scannerDefinitions.filter((definition) => selectedScannerIdSet.has(definition.id)),
    [scannerDefinitions, selectedScannerIdSet],
  );
  const selectedChartPatternCount = useMemo(
    () => scannerDefinitions.filter((definition) => definition.chartPattern && selectedScannerIdSet.has(definition.id)).length,
    [scannerDefinitions, selectedScannerIdSet],
  );
  const scannerDefinitionById = useMemo(
    () => new Map(scannerDefinitions.map((definition) => [definition.id, definition])),
    [scannerDefinitions],
  );
  const displayedResults = useMemo(
    () => filterScannerResults(results, scannerDefinitionById, {
      familyFilter,
      directionFilter,
      minScore,
      recentOnly,
    }),
    [results, scannerDefinitionById, familyFilter, directionFilter, minScore, recentOnly],
  );
  const patternMapEntries = useMemo(
    () =>
      buildScannerPatternMapEntries(results, scannerDefinitionById, {
        family: patternMapFamilyFilter,
        direction: patternMapDirectionFilter,
        priority: patternMapPriorityFilter,
        status: patternMapStatusFilter,
      }),
    [
      patternMapDirectionFilter,
      patternMapFamilyFilter,
      patternMapPriorityFilter,
      patternMapStatusFilter,
      results,
      scannerDefinitionById,
    ],
  );
  const historicalPatternResultCount = useMemo(
    () => results.filter((result) => Boolean(result.history && result.chartPattern)).length,
    [results],
  );
  const selectedPatternMapResultKey = useMemo(
    () => scannerPatternMap?.entries.find((entry) => entry.id === scannerPatternMap.selectedEntryId)?.resultKey ?? null,
    [scannerPatternMap],
  );
  const currentWorkspaceConfig = useMemo<ScannerWorkspaceConfig>(
    () => ({
      exchange,
      universeSource,
      selectedWatchlistIds,
      selectedScannerIds,
      lookbackBars,
      maxSymbols,
      executionMode,
      familyFilter,
      directionFilter,
      minScore,
      recentOnly,
      activeSection,
      resultView,
      priorityFilter,
      prioritySort,
    }),
    [
      activeSection,
      directionFilter,
      exchange,
      executionMode,
      familyFilter,
      lookbackBars,
      maxSymbols,
      minScore,
      recentOnly,
      resultView,
      priorityFilter,
      prioritySort,
      selectedScannerIds,
      selectedWatchlistIds,
      universeSource,
    ],
  );
  const currentWorkspaceConfigKey = useMemo(() => JSON.stringify(currentWorkspaceConfig), [currentWorkspaceConfig]);
  const activeSavedWorkspace = workspaceProfile?.workspaces.find(
    (workspace) => workspace.id === workspaceProfile.activeWorkspaceId,
  ) ?? null;
  const workspaceDirty = activeSavedWorkspace
    ? !areScannerWorkspaceConfigsEqual(currentWorkspaceConfig, activeSavedWorkspace.config)
    : false;

  const applyWorkspaceConfig = (config: ScannerWorkspaceConfig) => {
    setExchange(config.exchange);
    setUniverseSource(config.universeSource);
    setSelectedWatchlistIds(config.selectedWatchlistIds);
    setSelectedScannerIds(config.selectedScannerIds);
    setLookbackBars(config.lookbackBars);
    setMaxSymbols(config.maxSymbols);
    setExecutionMode(config.executionMode);
    setFamilyFilter(config.familyFilter);
    setDirectionFilter(config.directionFilter);
    setMinScore(config.minScore);
    setRecentOnly(config.recentOnly);
    setActiveSection(config.activeSection);
    setResultView(config.resultView);
    setPriorityFilter(config.priorityFilter);
    setPrioritySort(config.prioritySort);
    setToDate('');
  };

  const persistWorkspaceProfile = (profile: ScannerWorkspaceProfile) => {
    const generation = workspaceSaveGenerationRef.current + 1;
    workspaceSaveGenerationRef.current = generation;
    void (async () => {
      try {
        const settings = await readAppSettings();
        if (generation !== workspaceSaveGenerationRef.current) return;
        await writeAppSettings({ ...settings, scannerWorkspace: profile });
      } catch {
        if (generation === workspaceSaveGenerationRef.current) {
          setStatus('Scanner workspace could not be saved.');
        }
      }
    })();
  };

  const updateWorkspaceProfile = (profile: ScannerWorkspaceProfile) => {
    workspaceProfileRef.current = profile;
    setWorkspaceProfile(profile);
    persistWorkspaceProfile(profile);
  };

  const handleWorkspaceSelection = (workspaceId: string) => {
    const profile = workspaceProfileRef.current;
    if (!profile) return;
    const workspace = profile.workspaces.find((item) => item.id === workspaceId) ?? null;
    if (!workspace) {
      const next = { ...profile, activeWorkspaceId: null };
      setWorkspaceName('');
      updateWorkspaceProfile(next);
      return;
    }
    applyWorkspaceConfig(workspace.config);
    setWorkspaceName(workspace.name);
    updateWorkspaceProfile({
      ...profile,
      current: { ...workspace.config, selectedWatchlistIds: [...workspace.config.selectedWatchlistIds], selectedScannerIds: [...workspace.config.selectedScannerIds] },
      activeWorkspaceId: workspace.id,
    });
  };

  const handleSaveWorkspace = () => {
    const profile = workspaceProfileRef.current;
    const name = workspaceName.trim() || activeSavedWorkspace?.name;
    if (!profile || !name) {
      setStatus('Enter a workspace name before saving.');
      return;
    }
    const next = saveScannerWorkspace(profile, name, currentWorkspaceConfig, new Date().toISOString());
    setWorkspaceName(next.workspaces.find((workspace) => workspace.id === next.activeWorkspaceId)?.name ?? '');
    updateWorkspaceProfile(next);
    setStatus(`Scanner workspace "${name}" saved.`);
  };

  const handleDuplicateWorkspace = () => {
    const profile = workspaceProfileRef.current;
    if (!profile) return;
    const next = duplicateScannerWorkspace(profile, profile.activeWorkspaceId, currentWorkspaceConfig, new Date().toISOString());
    setWorkspaceName(next.workspaces.find((workspace) => workspace.id === next.activeWorkspaceId)?.name ?? '');
    updateWorkspaceProfile(next);
    setStatus('Scanner workspace duplicated.');
  };

  const handleRenameWorkspace = () => {
    const profile = workspaceProfileRef.current;
    if (!profile?.activeWorkspaceId || !workspaceName.trim()) {
      setStatus('Select a saved workspace and enter a name before renaming.');
      return;
    }
    updateWorkspaceProfile(renameScannerWorkspace(profile, profile.activeWorkspaceId, workspaceName, new Date().toISOString()));
    setStatus('Scanner workspace renamed.');
  };

  const handleDeleteWorkspace = () => {
    const profile = workspaceProfileRef.current;
    if (!profile?.activeWorkspaceId) return;
    updateWorkspaceProfile(deleteScannerWorkspace(profile, profile.activeWorkspaceId));
    setWorkspaceName('');
    setStatus('Scanner workspace deleted.');
  };

  const handleResetWorkspace = () => {
    if (!activeSavedWorkspace) return;
    applyWorkspaceConfig(activeSavedWorkspace.config);
    setWorkspaceName(activeSavedWorkspace.name);
    setStatus(`Scanner workspace "${activeSavedWorkspace.name}" reset to saved settings.`);
  };

  useEffect(() => {
    registerWindow({
      id: SCANNER_WINDOW_ID,
      title: 'Scanner',
      bounds: {
        x: 180,
        y: 90,
        width: 980,
        height: 640,
      },
      minWidth: 760,
      minHeight: 460,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (isOpen) {
      openWindow(SCANNER_WINDOW_ID);
      focusWindow(SCANNER_WINDOW_ID);
    } else {
      closeWindow(SCANNER_WINDOW_ID);
    }
  }, [isOpen, openWindow, focusWindow, closeWindow]);

  const scannerRequestedSection = useUiStore((state) => state.scannerRequestedSection);
  const consumeScannerRequestedSection = useUiStore((state) => state.consumeScannerRequestedSection);

  useEffect(() => {
    if (isOpen && openRequestCount > 0) {
      openWindow(SCANNER_WINDOW_ID);
      focusWindow(SCANNER_WINDOW_ID);
    }
  }, [openRequestCount, isOpen, openWindow, focusWindow]);

  useEffect(() => {
    if (!isOpen || !workspaceHydrated || !scannerRequestedSection) return;
    setActiveSection(scannerRequestedSection);
    consumeScannerRequestedSection();
  }, [
    isOpen,
    workspaceHydrated,
    openRequestCount,
    scannerRequestedSection,
    consumeScannerRequestedSection,
  ]);

  useEffect(() => {
    workspaceProfileRef.current = workspaceProfile;
  }, [workspaceProfile]);

  useEffect(() => {
    if (!isOpen) {
      setWorkspaceHydrated(false);
      return;
    }

    let cancelled = false;
    readAppSettings()
      .then((settings) => {
        if (!cancelled) {
          setConfiguredAlertRules(settings.eodAlertRules);
          setAlertHistory(settings.eodAlertHistory);
          workspaceProfileRef.current = settings.scannerWorkspace;
          setWorkspaceProfile(settings.scannerWorkspace);
          setWorkspaceName(
            settings.scannerWorkspace.workspaces.find(
              (workspace) => workspace.id === settings.scannerWorkspace.activeWorkspaceId,
            )?.name ?? '',
          );
          applyWorkspaceConfig(settings.scannerWorkspace.current);
          setWorkspaceHydrated(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfiguredAlertRules([]);
          setAlertHistory([]);
          setWorkspaceHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, openRequestCount]);

  useEffect(() => {
    setSelectedScannerIds((current) => {
      const validIds = new Set(allScannerIds);
      const filtered = current.filter((id) => validIds.has(id));
      return filtered.length > 0 ? filtered : allScannerIds;
    });
  }, [allScannerIds]);

  useEffect(() => {
    setSelectedWatchlistIds((current) => {
      if (watchlists.length === 0) return current;
      const validIds = new Set(watchlists.map((watchlist) => watchlist.id));
      const filtered = current.filter((id) => validIds.has(id));
      if (filtered.length > 0) return filtered;
      if (selectedWatchlistId !== null && validIds.has(selectedWatchlistId)) return [selectedWatchlistId];
      return [];
    });
  }, [watchlists, selectedWatchlistId]);

  useEffect(() => {
    if (!isOpen || !workspaceHydrated || !workspaceProfile) return;
    const timeoutId = window.setTimeout(() => {
      const profile = workspaceProfileRef.current;
      if (!profile) return;
      const next = syncCurrentScannerWorkspace(profile, currentWorkspaceConfig, new Date().toISOString());
      workspaceProfileRef.current = next;
      setWorkspaceProfile(next);
      persistWorkspaceProfile(next);
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [currentWorkspaceConfig, currentWorkspaceConfigKey, isOpen, workspaceHydrated, workspaceProfile?.activeWorkspaceId]);

  useEffect(() => {
    if (!isOpen || !snapshot?.activeDatabasePath || lookbackBars !== null) {
      setWorkloadEstimate(null);
      setWorkloadEstimateLoading(false);
      return;
    }
    const api = getDesktopApi();
    if (!api) {
      setWorkloadEstimate(null);
      setWorkloadEstimateLoading(false);
      return;
    }

    let disposed = false;
    setWorkloadEstimateLoading(true);
    void (async () => {
      try {
        const targets = await resolveScannerTargets(api, {
          exchange,
          universeSource,
          activeInstrument,
          selectedWatchlists,
          maxSymbols,
        });
        if (targets.length === 0) {
          if (!disposed) setWorkloadEstimate(null);
          return;
        }
        const sample = targets[0];
        const sampleHistory = await api.getEodData({
          symbol: sample.symbol,
          exchange: sample.exchange,
          to: toDate || undefined,
        });
        if (!disposed) {
          const sampleBarCount = sampleHistory.bars.length;
          setWorkloadEstimate({
            targetCount: targets.length,
            sampleSymbol: `${sample.exchange}:${sample.symbol}`,
            sampleBarCount,
            estimatedHistoricalEndpoints: Math.max(0, sampleBarCount - 19) * targets.length,
          });
        }
      } catch {
        if (!disposed) setWorkloadEstimate(null);
      } finally {
        if (!disposed) setWorkloadEstimateLoading(false);
      }
    })();

    return () => {
      disposed = true;
    };
  }, [
    activeInstrument,
    exchange,
    isOpen,
    lookbackBars,
    maxSymbols,
    selectedWatchlists,
    snapshot?.activeDatabasePath,
    toDate,
    universeSource,
  ]);

  const toggleWatchlist = (watchlistId: number) => {
    setSelectedWatchlistIds((current) =>
      current.includes(watchlistId)
        ? current.filter((id) => id !== watchlistId)
        : [...current, watchlistId],
    );
  };

  const toggleScanner = (scannerId: string) => {
    setSelectedScannerIds((current) =>
      current.includes(scannerId)
        ? current.filter((id) => id !== scannerId)
        : [...current, scannerId],
    );
  };

  const toggleAllScanners = () => {
    setSelectedScannerIds((current) => (current.length === scannerDefinitions.length ? [] : allScannerIds));
  };

  const toggleAllWatchlists = () => {
    setSelectedWatchlistIds((current) =>
      current.length === watchlists.length ? [] : watchlists.map((w) => w.id),
    );
  };

  const handleSelectDailyPreset = (presetId: string) => {
    setSelectedScannerIds([presetId]);
    if (universeSource !== 'watchlists' && universeSource !== 'symbol-list') {
      setUniverseSource('watchlists');
    }
    if (selectedWatchlistIds.length === 0 && watchlists.length > 0) {
      setSelectedWatchlistIds(watchlists.map((w) => w.id));
    }
  };

  const toggleScannerGroup = (group: ScannerGroup) => {
    const groupIds = group.definitions.map((definition) => definition.id);
    const allGroupSelected = groupIds.every((id) => selectedScannerIdSet.has(id));
    setSelectedScannerIds((current) => {
      if (allGroupSelected) {
        return current.filter((id) => !groupIds.includes(id));
      }
      const next = new Set(current);
      groupIds.forEach((id) => next.add(id));
      return [...next];
    });
  };

  if (!isOpen) {
    return null;
  }

  const requestScannerCancellation = () => {
    if (!running) return;
    cancelRequestedRef.current = true;
    setStatus('Cancellation requested; stopping the active chart-pattern calculation...');
  };

  const handleRun = async () => {
    const api = getDesktopApi();
    if (!api) {
      setStatus('Desktop API bridge is unavailable.');
      return;
    }
    if (!snapshot?.activeDatabasePath) {
      setStatus('Open a database before running a scan.');
      return;
    }
    if (universeSource === 'watchlists' && selectedWatchlists.length === 0) {
      setStatus('Select at least one watchlist.');
      return;
    }
    if (selectedScannerIds.length === 0) {
      setStatus('Select at least one scanner.');
      return;
    }

    cancelRequestedRef.current = false;
    setRunning(true);
    setStatus(lookbackBars === null ? 'Preparing complete historical scanner inputs...' : 'Preparing scanner inputs...');
    setErrors([]);
    setResults([]);
    setAlertTriggers([]);
    if (lookbackBars === null) {
      setRecentOnly(false);
    }

    try {
      const settings = await readAppSettings();
      setConfiguredAlertRules(settings.eodAlertRules);
      setAlertHistory(settings.eodAlertHistory);
      if (!isPluginEnabled(CORE_EOD_SCANNER_PLUGIN_ID, settings.pluginEnabled)) {
        setStatus('Core EOD Scanner plugin is disabled in Settings.');
        return;
      }

      const targets = await resolveScannerTargets(api, {
        exchange,
        universeSource,
        activeInstrument,
        selectedWatchlists,
        maxSymbols,
      });
      if (targets.length === 0) {
        setStatus('No symbols available for the selected universe.');
        return;
      }

      setStatus(
        lookbackBars === null
          ? `Scanning ${targets.length} symbol${targets.length === 1 ? '' : 's'} across complete history...`
          : `Scanning ${targets.length} symbol${targets.length === 1 ? '' : 's'}...`,
      );
      const scannedAt = new Date().toISOString();
      const scanStartedAt = Date.now();
      let lastProgressStatusAt = 0;
      const output = await runCoreEodScannerBatch(api, {
        targets,
        scannerIds: selectedScannerIds,
        lookbackBars,
        evaluateHistory: lookbackBars === null,
        executionMode,
        toDate: toDate || null,
        alertRules: settings.eodAlertRules,
        signalRules,
        shouldCancel: () => cancelRequestedRef.current,
        onProgress: ({ completed, total, symbol, exchange: targetExchange, historyCompleted, historyTotal, resultCount }) => {
          const now = Date.now();
          const endpointProgress = historyCompleted && historyTotal ? historyCompleted / historyTotal : 1;
          const overallProgress = Math.min(1, (Math.max(0, completed - 1) + endpointProgress) / total);
          const isSymbolComplete = !historyCompleted || historyCompleted === historyTotal;
          if (now - lastProgressStatusAt < 250 && !isSymbolComplete) return;
          lastProgressStatusAt = now;
          const elapsedMs = now - scanStartedAt;
          const remainingMs = overallProgress > 0.01 ? elapsedMs * (1 - overallProgress) / overallProgress : null;
          setStatus(
            formatScannerProgress({
              completed,
              total,
              symbol: `${targetExchange}:${symbol}`,
              historyCompleted,
              historyTotal,
              resultCount,
              elapsedMs,
              remainingMs,
            }),
          );
        },
        onResultChunk: (chunk) => {
          setResults((current) => [...current, ...chunk]);
        },
      });

      setResults(output.results);
      setAlertTriggers(output.alertTriggers);
      setActiveAlertReviewTab('latest');
      setErrors(output.errors);
      if (output.alertTriggers.length > 0) {
        const nextAlertRules = applyEodAlertTriggersToRules(settings.eodAlertRules, output.alertTriggers);
        const nextAlertHistory = appendEodAlertHistoryEvents(
          settings.eodAlertHistory,
          createEodAlertHistoryEvents(output.alertTriggers, scannedAt),
        );
        await writeAppSettings({
          ...settings,
          eodAlertRules: nextAlertRules,
          eodAlertHistory: nextAlertHistory,
        });
        setConfiguredAlertRules(nextAlertRules);
        setAlertHistory(nextAlertHistory);
      }
      setActiveSection(output.alertTriggers.length > 0 ? 'alerts' : 'results');
      setStatus(
        output.cancelled
          ? `Scan cancelled after ${output.scannedSymbols} symbol${output.scannedSymbols === 1 ? '' : 's'}; ${output.results.length} match${output.results.length === 1 ? '' : 'es'} recorded.`
          : `Scanned ${output.scannedSymbols} symbol${output.scannedSymbols === 1 ? '' : 's'}; ${output.results.length} match${output.results.length === 1 ? '' : 'es'}; ${output.alertTriggers.length} alert${output.alertTriggers.length === 1 ? '' : 's'}.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Scanner run failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleRunAlertScan = async () => {
    const api = getDesktopApi();
    if (!api) {
      setStatus('Desktop API bridge is unavailable.');
      return;
    }
    if (!snapshot?.activeDatabasePath) {
      setStatus('Open a database before running an alert scan.');
      return;
    }
    if (universeSource === 'watchlists' && selectedWatchlists.length === 0) {
      setStatus('Select at least one watchlist for the alert scan.');
      return;
    }

    cancelRequestedRef.current = false;
    setRunning(true);
    setStatus('Preparing alert scan...');
    setErrors([]);
    setAlertTriggers([]);

    try {
      const settings = await readAppSettings();
      const enabledAlertRules = settings.eodAlertRules.filter((rule) => rule.enabled);
      setConfiguredAlertRules(settings.eodAlertRules);
      setAlertHistory(settings.eodAlertHistory);
      if (enabledAlertRules.length === 0) {
        setStatus('No enabled alert rules to scan.');
        return;
      }

      const alertScannerIds = getScannerIdsForAlertRules(enabledAlertRules, allScannerIds);
      if (alertScannerIds.length > 0 && !isPluginEnabled(CORE_EOD_SCANNER_PLUGIN_ID, settings.pluginEnabled)) {
        setStatus('Core EOD Scanner plugin is disabled in Settings.');
        return;
      }

      const targets = await resolveScannerTargets(api, {
        exchange,
        universeSource,
        activeInstrument,
        selectedWatchlists,
        maxSymbols,
      });
      if (targets.length === 0) {
        setStatus('No symbols available for the selected alert scan universe.');
        return;
      }

      setStatus(`Running alert scan on ${targets.length} symbol${targets.length === 1 ? '' : 's'}...`);
      const scannedAt = new Date().toISOString();
      const output = await runCoreEodScannerBatch(api, {
        targets,
        scannerIds: alertScannerIds,
        lookbackBars,
        toDate: toDate || null,
        alertRules: enabledAlertRules,
        shouldCancel: () => cancelRequestedRef.current,
        onProgress: ({ completed, total, symbol, exchange: targetExchange }) =>
          setStatus(`Scanning alerts ${completed}/${total}: ${targetExchange}:${symbol}...`),
      });

      setAlertTriggers(output.alertTriggers);
      setActiveAlertReviewTab('latest');
      setErrors(output.errors);
      if (output.alertTriggers.length > 0) {
        const nextAlertRules = applyEodAlertTriggersToRules(settings.eodAlertRules, output.alertTriggers);
        const nextAlertHistory = appendEodAlertHistoryEvents(
          settings.eodAlertHistory,
          createEodAlertHistoryEvents(output.alertTriggers, scannedAt),
        );
        await writeAppSettings({
          ...settings,
          eodAlertRules: nextAlertRules,
          eodAlertHistory: nextAlertHistory,
        });
        setConfiguredAlertRules(nextAlertRules);
        setAlertHistory(nextAlertHistory);
      }
      setActiveSection('alerts');
      setStatus(
        output.cancelled
          ? `Alert scan cancelled after ${output.scannedSymbols} symbol${output.scannedSymbols === 1 ? '' : 's'}.`
          : `Alert scan checked ${output.scannedSymbols} symbol${output.scannedSymbols === 1 ? '' : 's'}; ${output.alertTriggers.length} alert${output.alertTriggers.length === 1 ? '' : 's'} triggered.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Alert scan failed.');
    } finally {
      setRunning(false);
    }
  };

  const handleShowOnChart = async (result: ScannerResult) => {
    const instrument = { exchange: result.exchange, symbol: result.symbol };
    try {
      const mapEntry = scannerPatternMap?.entries.find((entry) => entry.resultKey === getScannerPatternMapResultKey(result));
      if (mapEntry) {
        selectScannerPatternMapEntry(mapEntry.id);
      }
      setStatus(`Opening ${result.exchange}:${result.symbol} on chart...`);
      await loadInstrument(instrument, null, { preserveViewport: false });

      const loadedTab = getActiveChartTab(useChartStore.getState().chartTabs, useChartStore.getState().activeChartTabId);
      if (loadedTab?.displayBars.length) {
        const barIndex = findBarIndexOnOrAfter(loadedTab.displayBars, result.date);
        if (barIndex >= 0) {
          const span = Math.max(loadedTab.visibleBarCount || 120, 20);
          scrollToViewportStart(Math.max(0, barIndex - Math.floor(span / 2)));
        }
      }

      showScannerChartOverlay({
        id: `${result.exchange}:${result.symbol}:${result.scannerId}:${result.date}:${Date.now()}`,
        instrument,
        date: result.date,
        scannerName: result.scannerName,
        direction: result.direction,
        score: result.score,
        levels: getScannerChartLevels(result),
        geometry: result.chartPattern?.geometry,
        // Rectangle / Range is the first direct-editable pattern slice; other patterns remain transient.
        editable: result.chartPattern?.geometry?.family === 'range',
      });
      setStatus(`Showing ${result.scannerName} on ${result.exchange}:${result.symbol} chart.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open scanner result on chart.';
      setStatus(message);
      addToast(message, 'error', 'Scanner');
    }
  };

  const handleShowPatternMap = () => {
    showScannerPatternMap(patternMapEntries);
    setStatus(
      patternMapEntries.length > 0
        ? `Pattern Map showing ${patternMapEntries.length} confirmed historical episode${patternMapEntries.length === 1 ? '' : 's'}.`
        : 'No historical episodes match the current Pattern Map filters.',
    );
  };

  const handleShowAlertOnChart = async (trigger: EodAlertTrigger) => {
    try {
      setStatus(`Opening ${trigger.exchange}:${trigger.symbol} on chart...`);
      await loadInstrument({ exchange: trigger.exchange, symbol: trigger.symbol }, null, { preserveViewport: false });

      const loadedTab = getActiveChartTab(useChartStore.getState().chartTabs, useChartStore.getState().activeChartTabId);
      if (loadedTab?.displayBars.length) {
        const barIndex = findBarIndexOnOrAfter(loadedTab.displayBars, trigger.date);
        if (barIndex >= 0) {
          const span = Math.max(loadedTab.visibleBarCount || 120, 20);
          scrollToViewportStart(Math.max(0, barIndex - Math.floor(span / 2)));
        }
      }

      setStatus(`Showing alert ${trigger.ruleName} on ${trigger.exchange}:${trigger.symbol}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open alert result on chart.';
      setStatus(message);
      addToast(message, 'error', 'Alerts');
    }
  };

  const handleCreateScannerAlert = async (result: ScannerResult) => {
    try {
      const settings = await readAppSettings();
      const alreadyExists = settings.eodAlertRules.some(
        (rule) => rule.conditionType === 'scanner_match' && rule.scannerId === result.scannerId,
      );
      if (alreadyExists) {
        setStatus(`${result.scannerName} alert already exists.`);
        return;
      }
      const nextAlertRules = [...settings.eodAlertRules, createScannerMatchAlertRule(result)];
      await writeAppSettings({
        ...settings,
        eodAlertRules: nextAlertRules,
      });
      setConfiguredAlertRules(nextAlertRules);
      setStatus(`Alert created for ${result.scannerName} matches.`);
      addToast(`Alert created for ${result.scannerName} matches.`, 'success', 'Alerts');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create scanner alert.';
      setStatus(message);
      addToast(message, 'error', 'Alerts');
    }
  };

  return (
    <FloatingWindow id={SCANNER_WINDOW_ID} onClose={onClose}>
      <div style={bodyStyle}>
        <aside style={navStyle}>
          <div style={navTitleStyle}>Scanner</div>
          {(['run', 'results', 'alerts', 'library', 'market-movers'] as const).map((section) => (
            <button
              key={section}
              type="button"
              style={activeSection === section ? activeNavButtonStyle : navButtonStyle}
              onClick={() => setActiveSection(section)}
            >
              <span>{formatSectionLabel(section)}</span>
              {section === 'results' && activeSection !== 'market-movers' ? (
                <span style={navCountStyle}>{displayedResults.length}</span>
              ) : null}
              {section === 'alerts' ? <span style={navCountStyle}>{configuredAlertRules.length}</span> : null}
              {section === 'library' ? <span style={navCountStyle}>{scannerDefinitions.length}</span> : null}
            </button>
          ))}
        </aside>

        <div style={workspaceStyle}>
          {activeSection !== 'alerts' ? (
            <div style={workspaceHeaderStyle}>
              <div style={metaStyle}>
                <span>
                  {activeSection === 'market-movers'
                    ? 'Market Movers ranks completed daily bars and does not modify the database.'
                    : status || 'Core EOD Scanner reads completed daily bars and does not modify the database.'}
                </span>
                {activeSection === 'market-movers' ? (
                  <span>Universe, as-of date, and scan accounting are shown in the Market Movers panel below.</span>
                ) : universeSource === 'watchlists' && selectedWatchlists.length > 0 ? (
                  <span>Selected watchlists: {formatSelectedWatchlistLabel(selectedWatchlists)}</span>
                ) : selectedWatchlist ? (
                  <span>Current watchlist: {selectedWatchlist.name}</span>
                ) : null}
                {activeInstrument ? <span>Active chart: {activeInstrument.exchange}:{activeInstrument.symbol}</span> : null}
              </div>
            </div>
          ) : null}

          {activeSection === 'run' ? (
            <>
              <div style={scannerInfoStyle}>
                <strong>Scanner Workspace</strong>
                <div style={controlsStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Workspace</span>
                    <select
                      style={inputStyle}
                      value={workspaceProfile?.activeWorkspaceId ?? ''}
                      onChange={(event) => handleWorkspaceSelection(event.target.value)}
                      disabled={!workspaceHydrated || running}
                    >
                      <option value="">Current setup (autosaved)</option>
                      {(workspaceProfile?.workspaces ?? []).map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                          {workspace.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Workspace name</span>
                    <input
                      type="text"
                      style={inputStyle}
                      value={workspaceName}
                      placeholder="Daily Chart Patterns"
                      onChange={(event) => setWorkspaceName(event.target.value)}
                      disabled={!workspaceHydrated || running}
                    />
                  </label>
                  <button type="button" style={secondaryButtonStyle} onClick={handleSaveWorkspace} disabled={!workspaceHydrated || running}>
                    Save workspace
                  </button>
                  <button type="button" style={secondaryButtonStyle} onClick={handleDuplicateWorkspace} disabled={!workspaceHydrated || running}>
                    Duplicate
                  </button>
                  <button type="button" style={secondaryButtonStyle} onClick={handleRenameWorkspace} disabled={!activeSavedWorkspace || running}>
                    Rename
                  </button>
                  <button type="button" style={secondaryButtonStyle} onClick={handleDeleteWorkspace} disabled={!activeSavedWorkspace || running}>
                    Delete
                  </button>
                  <button
                    type="button"
                    style={secondaryButtonStyle}
                    onClick={handleResetWorkspace}
                    disabled={!activeSavedWorkspace || !workspaceDirty || running}
                  >
                    Reset to saved
                  </button>
                </div>
                <span>
                  {activeSavedWorkspace
                    ? `${activeSavedWorkspace.name}: ${workspaceDirty ? 'Unsaved changes' : 'Saved'}.`
                    : 'Current setup: autosaved.'}{' '}
                  Active scans, results, alerts, status, and To Date are never restored.
                </span>
              </div>
              <div style={dailyPresetBarContainerStyle}>
                <span style={dailyPresetLabelStyle}>Daily Presets:</span>
                <button
                  type="button"
                  style={dailyPresetButtonStyle(selectedScannerIds.includes('top_gainers') && selectedScannerIds.length === 1)}
                  onClick={() => handleSelectDailyPreset('top_gainers')}
                  title="Scan for Top Gainers in selected universe"
                >
                  🚀 Top Gainers
                </button>
                <button
                  type="button"
                  style={dailyPresetButtonStyle(selectedScannerIds.includes('top_losers') && selectedScannerIds.length === 1)}
                  onClick={() => handleSelectDailyPreset('top_losers')}
                  title="Scan for Top Losers in selected universe"
                >
                  🔻 Top Losers
                </button>
                <button
                  type="button"
                  style={dailyPresetButtonStyle(selectedScannerIds.includes('volume_surge') && selectedScannerIds.length === 1)}
                  onClick={() => handleSelectDailyPreset('volume_surge')}
                  title="Scan for Volume Surges (>= 1.5x 20D Avg)"
                >
                  📊 High Volume
                </button>
                <button
                  type="button"
                  style={dailyPresetButtonStyle(selectedScannerIds.includes('high_52w') && selectedScannerIds.length === 1)}
                  onClick={() => handleSelectDailyPreset('high_52w')}
                  title="Scan for 52-Week High Breakouts"
                >
                  🏆 52W High
                </button>
                <button
                  type="button"
                  style={dailyPresetButtonStyle(selectedScannerIds.includes('low_52w') && selectedScannerIds.length === 1)}
                  onClick={() => handleSelectDailyPreset('low_52w')}
                  title="Scan for 52-Week Low Breakdowns"
                >
                  ⚠️ 52W Low
                </button>
              </div>
              <div style={controlsStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Exchange</span>
                  <select style={inputStyle} value={exchange} onChange={(event) => setExchange(event.target.value)}>
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>
                </label>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Universe</span>
                  <select
                    style={inputStyle}
                    value={universeSource}
                    onChange={(event) => setUniverseSource(event.target.value as UniverseSource)}
                  >
                    <option value="active-chart">Active Chart</option>
                    <option value="symbol-list">Symbol List</option>
                    <option value="watchlists">Watchlists</option>
                  </select>
                  {universeSource === 'watchlists' ? (
                    <details style={multiSelectStyle}>
                      <summary style={multiSelectSummaryStyle}>{formatSelectedWatchlistLabel(selectedWatchlists)}</summary>
                      <div style={multiSelectPanelStyle}>
                        {watchlists.length === 0 ? (
                          <div style={multiSelectEmptyStyle}>No watchlists available.</div>
                        ) : (
                          <>
                            <label style={multiSelectOptionStyle}>
                              <input
                                type="checkbox"
                                checked={watchlists.length > 0 && selectedWatchlistIds.length === watchlists.length}
                                onChange={toggleAllWatchlists}
                              />
                              <span>All watchlists</span>
                              <span style={multiSelectMetaStyle}>{watchlists.length}</span>
                            </label>
                            {watchlists.map((watchlist) => (
                              <label key={watchlist.id} style={multiSelectOptionStyle}>
                                <input
                                  type="checkbox"
                                  checked={selectedWatchlistIds.includes(watchlist.id)}
                                  onChange={() => toggleWatchlist(watchlist.id)}
                                />
                                <span>{watchlist.name}</span>
                                <span style={multiSelectMetaStyle}>{watchlist.items.length}</span>
                              </label>
                            ))}
                          </>
                        )}
                      </div>
                    </details>
                  ) : null}
                </div>
                <div style={fieldStyle}>
                  <span style={labelStyle}>Scanner</span>
                  <details style={multiSelectStyle}>
                    <summary style={multiSelectSummaryStyle}>
                      {formatSelectedScannerLabel(selectedScannerIds.length, scannerDefinitions.length)}
                    </summary>
                    <div style={multiSelectPanelStyle}>
                      <label style={multiSelectOptionStyle}>
                        <input
                          type="checkbox"
                          checked={selectedScannerIds.length === scannerDefinitions.length}
                          onChange={toggleAllScanners}
                        />
                        <span>All scanners</span>
                        <span style={multiSelectMetaStyle}>{scannerDefinitions.length}</span>
                      </label>
                      {scannerGroups.map((group) => {
                        const groupIds = group.definitions.map((definition) => definition.id);
                        const groupSelectedCount = groupIds.filter((id) => selectedScannerIdSet.has(id)).length;
                        return (
                          <div key={group.label} style={multiSelectGroupStyle}>
                            <label style={multiSelectGroupHeaderStyle}>
                              <input
                                type="checkbox"
                                checked={groupSelectedCount === group.definitions.length}
                                onChange={() => toggleScannerGroup(group)}
                              />
                              <span>{group.label}</span>
                              <span style={multiSelectMetaStyle}>{groupSelectedCount}/{group.definitions.length}</span>
                            </label>
                            {group.definitions.map((definition) => (
                              <label key={definition.id} style={multiSelectNestedOptionStyle}>
                                <input
                                  type="checkbox"
                                  checked={selectedScannerIdSet.has(definition.id)}
                                  onChange={() => toggleScanner(definition.id)}
                                />
                                <span>{formatScannerOptionLabel(definition)}</span>
                                <span
                                  style={getScannerPriorityBadgeStyle(definition)}
                                  title={`${getScannerPriorityDisplay(definition.priority).name} priority`}
                                  role="img"
                                  aria-label={`${getScannerPriorityDisplay(definition.priority).name} priority`}
                                >
                                  {getScannerPriorityDisplay(definition.priority).label}
                                </span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Priority</span>
                  <select
                    style={inputStyle}
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as ScannerPriorityFilter)}
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High (H)</option>
                    <option value="medium">Medium (M)</option>
                    <option value="low">Low (L)</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Priority sort</span>
                  <select
                    style={inputStyle}
                    value={prioritySort}
                    onChange={(event) => setPrioritySort(event.target.value as ScannerPrioritySort)}
                  >
                    <option value="category">Category order</option>
                    <option value="high-to-low">High to Low</option>
                    <option value="low-to-high">Low to High</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Load Bars</span>
                  <select
                    style={inputStyle}
                    value={lookbackBars === null ? 'all' : 'custom'}
                    onChange={(event) =>
                      setLookbackBars(
                        parseLookbackSelection(
                          event.target.value === 'all' ? 'all' : 'custom',
                          String(lookbackBars ?? DEFAULT_LOOKBACK_BARS),
                        ),
                      )
                    }
                  >
                    <option value="custom">Specified bars</option>
                    <option value="all">All history (historical matches)</option>
                  </select>
                  <input
                    type="number"
                    min={MIN_LOOKBACK_BARS}
                    style={inputStyle}
                      value={lookbackBars ?? ''}
                      disabled={lookbackBars === null}
                    onChange={(event) => setLookbackBars(parseLookbackBars(event.target.value))}
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Max Symbols (symbol list only)</span>
                  <input
                    type="number"
                    min={1}
                    style={inputStyle}
                    value={maxSymbols}
                    onChange={(event) => setMaxSymbols(parsePositiveInteger(event.target.value, DEFAULT_MAX_SYMBOLS))}
                  />
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Execution</span>
                  <select
                    style={inputStyle}
                    value={executionMode}
                    onChange={(event) => setExecutionMode(event.target.value as ScannerExecutionMode)}
                    disabled={running}
                  >
                    <option value="responsive">Responsive (default)</option>
                    <option value="fast">Fast (uses more CPU)</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>To Date</span>
                  <input type="date" style={inputStyle} value={toDate} onChange={(event) => setToDate(event.target.value)} />
                </label>
                <button type="button" style={primaryButtonStyle} onClick={() => void handleRun()} disabled={running}>
                  {running ? 'Scanning...' : lookbackBars === null ? 'Run full scan' : 'Scan'}
                </button>
                {running ? (
                  <button type="button" style={secondaryButtonStyle} onClick={requestScannerCancellation}>
                    Cancel
                  </button>
                ) : null}
              </div>
              {lookbackBars === null ? (
                <div style={scannerInfoStyle}>
                  <strong>Historical evaluation</strong>
                  <span>Chart patterns are evaluated at each completed historical endpoint and repeated daily matches are grouped into one result.</span>
                  <span>Core OHLCV scanners remain latest-bar checks.</span>
                  {workloadEstimateLoading ? <span>Calculating full-history workload…</span> : null}
                  {workloadEstimate ? (
                    <span>
                      Full scan: {workloadEstimate.targetCount} symbols × {selectedChartPatternCount} chart-pattern scanners; about{' '}
                      {workloadEstimate.estimatedHistoricalEndpoints.toLocaleString()} endpoints (sample: {workloadEstimate.sampleSymbol},{' '}
                      {workloadEstimate.sampleBarCount.toLocaleString()} bars).
                    </span>
                  ) : null}
                  <span>
                    {executionMode === 'responsive'
                      ? 'Responsive keeps Scanner and chart controls available; Cancel stops the active calculation.'
                      : 'Fast reduces worker yields and may use more CPU; Cancel still stops the active calculation.'}
                  </span>
                </div>
              ) : null}
              <div style={scannerInfoStyle}>
                {selectedScannerDefinition ? (
                  <>
                    <strong>{selectedScannerDefinition.name}</strong>
                    <span>{formatScannerMetadata(selectedScannerDefinition)}</span>
                    <span>{selectedScannerDefinition.description}</span>
                  </>
                ) : (
                  <>
                    <strong>
                      {selectedScannerIds.length === scannerDefinitions.length
                        ? 'All scanners'
                        : `${selectedScannerIds.length} scanners selected`}
                    </strong>
                    <span>{formatScannerCatalogSummary(scannerGroups)}</span>
                    <span>{formatSelectedScannerSummary(selectedScannerDefinitions)}</span>
                    <span>Runs every enabled read-only scanner against completed EOD bars.</span>
                  </>
                )}
              </div>
            </>
          ) : null}

          {activeSection === 'results' ? (
            <>
              <div style={filterBarStyle}>
                <label style={filterFieldStyle}>
                  <span style={labelStyle}>Family</span>
                  <select
                    style={filterInputStyle}
                    value={familyFilter}
                    onChange={(event) => setFamilyFilter(event.target.value as ResultFamilyFilter)}
                  >
                    <option value="all">All</option>
                    <option value="core">Core OHLCV</option>
                    <option value="gap">Gaps</option>
                    <option value="reversal">Reversals</option>
                    <option value="continuation">Continuations</option>
                    <option value="neutral-bilateral">Neutral/Bilateral</option>
                  </select>
                </label>
                <label style={filterFieldStyle}>
                  <span style={labelStyle}>Direction</span>
                  <select
                    style={filterInputStyle}
                    value={directionFilter}
                    onChange={(event) => setDirectionFilter(event.target.value as ResultDirectionFilter)}
                  >
                    <option value="all">All</option>
                    <option value="bullish">Bullish</option>
                    <option value="bearish">Bearish</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </label>
                <label style={filterFieldStyle}>
                  <span style={labelStyle}>View</span>
                  <select
                    style={filterInputStyle}
                    value={resultView}
                    onChange={(event) => setResultView(event.target.value as ResultViewPreset)}
                  >
                    <option value="compact">Compact</option>
                    <option value="pattern-detail">Pattern Detail</option>
                    <option value="values">Values</option>
                    <option value="debug">Debug</option>
                  </select>
                </label>
                <label style={filterFieldStyle}>
                  <span style={labelStyle}>Min Score</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    style={filterInputStyle}
                    value={minScore}
                    onChange={(event) => setMinScore(Math.min(100, parsePositiveInteger(event.target.value, 0, 0)))}
                  />
                </label>
                <label style={checkboxFieldStyle}>
                  <input type="checkbox" checked={recentOnly} onChange={(event) => setRecentOnly(event.target.checked)} />
                  <span>Recent only</span>
                </label>
                <span style={filterSummaryStyle}>
                  Showing {displayedResults.length} of {results.length} matches
                </span>
              </div>

              {historicalPatternResultCount > 0 ? (
                <div style={scannerInfoStyle}>
                  <strong>Historical Pattern Map</strong>
                  <div style={controlsStyle}>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Family</span>
                      <select
                        style={inputStyle}
                        value={patternMapFamilyFilter}
                        onChange={(event) => setPatternMapFamilyFilter(event.target.value as ScannerPatternMapFamilyFilter)}
                      >
                        <option value="all">All families</option>
                        <option value="gap">Gaps</option>
                        <option value="reversal">Reversals</option>
                        <option value="continuation">Continuations</option>
                        <option value="neutral-bilateral">Neutral/Bilateral</option>
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Direction</span>
                      <select
                        style={inputStyle}
                        value={patternMapDirectionFilter}
                        onChange={(event) => setPatternMapDirectionFilter(event.target.value as ScannerPatternMapDirectionFilter)}
                      >
                        <option value="all">All directions</option>
                        <option value="bullish">Bullish</option>
                        <option value="bearish">Bearish</option>
                        <option value="neutral">Neutral</option>
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Priority</span>
                      <select
                        style={inputStyle}
                        value={patternMapPriorityFilter}
                        onChange={(event) => setPatternMapPriorityFilter(event.target.value as ScannerPatternMapPriorityFilter)}
                      >
                        <option value="all">All priorities</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </label>
                    <label style={fieldStyle}>
                      <span style={labelStyle}>Status</span>
                      <select
                        style={inputStyle}
                        value={patternMapStatusFilter}
                        onChange={(event) => setPatternMapStatusFilter(event.target.value as ScannerPatternMapStatusFilter)}
                      >
                        <option value="all">All statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="developing">Developing</option>
                      </select>
                    </label>
                    <button type="button" style={primaryButtonStyle} onClick={handleShowPatternMap}>
                      {scannerPatternMap ? 'Update Pattern Map' : 'Show Pattern Map'}
                    </button>
                    {scannerPatternMap ? (
                      <button type="button" style={secondaryButtonStyle} onClick={clearScannerPatternMap}>
                        Hide Pattern Map
                      </button>
                    ) : null}
                    {scannerPatternMap ? (
                      <button
                        type="button"
                        style={secondaryButtonStyle}
                        onClick={() => setScannerPatternMapVisibleGeometry(!scannerPatternMap.showVisibleGeometry)}
                      >
                        {scannerPatternMap.showVisibleGeometry ? 'Hide visible geometry' : 'Show visible geometry'}
                      </button>
                    ) : null}
                  </div>
                  <span>
                    {patternMapEntries.length} of {historicalPatternResultCount} grouped historical episodes match these filters. Markers stay light and cluster same-date episodes as `+n`; click a marker to inspect one result.
                  </span>
                  <span>Current scanner output supplies Confirmed episodes only; Developing is reserved for a later candidate-output phase.</span>
                </div>
              ) : null}

              {errors.length > 0 ? (
                <div style={warningBoxStyle}>
                  <button type="button" style={warningToggleStyle} onClick={() => setWarningsExpanded((value) => !value)}>
                    {warningsExpanded ? 'Hide' : 'Show'} data warnings ({errors.length})
                  </button>
                  {warningsExpanded ? (
                    <div style={warningListStyle}>
                      {errors.slice(0, 12).map((error) => (
                        <div key={error}>{error}</div>
                      ))}
                      {errors.length > 12 ? <div>{errors.length - 12} more warnings hidden.</div> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Symbol</th>
                      <th style={thStyle}>Scanner</th>
                      <th style={thStyle}>Direction</th>
                      <th style={thStyle}>Score</th>
                      <th style={thStyle}>Date</th>
                      {resultView === 'compact' ? null : <th style={thStyle}>Reasons</th>}
                      {resultView === 'pattern-detail' ? <th style={thStyle}>Pattern Detail</th> : null}
                      {resultView === 'values' || resultView === 'debug' ? <th style={thStyle}>Values</th> : null}
                      {resultView === 'debug' ? (
                        <>
                          <th style={thStyle}>Scanner Id</th>
                          <th style={thStyle}>Source</th>
                          <th style={thStyle}>Generated</th>
                        </>
                      ) : null}
                      <th style={thStyle}>Chart</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedResults.length === 0 ? (
                      <tr>
                        <td style={emptyCellStyle} colSpan={getResultViewColumnCount(resultView)}>
                          {results.length === 0 ? 'No scanner matches yet.' : 'No matches for the current filters.'}
                        </td>
                      </tr>
                    ) : (
                      displayedResults.map((result) => (
                        <tr
                          key={scannerResultKey(result)}
                          style={selectedPatternMapResultKey === scannerResultKey(result) ? patternMapSelectedRowStyle : undefined}
                        >
                          <td style={tdStyle}>{result.exchange}:{result.symbol}</td>
                          <td style={tdStyle}>
                            <div>{result.scannerName}</div>
                            <div style={cellMetaStyle}>
                              {formatResultGroupLabel(result, scannerDefinitionById)}
                            </div>
                          </td>
                          <td style={tdStyle}>{result.direction ?? '-'}</td>
                          <td style={tdStyle}>{result.score ?? '-'}</td>
                          <td style={tdStyle}>
                            <div>{result.date}</div>
                            {result.history ? (
                              <div style={cellMetaStyle}>
                                {result.history.matchCount} match{result.history.matchCount === 1 ? '' : 'es'} through {result.history.lastMatchedDate}
                              </div>
                            ) : null}
                          </td>
                          {resultView === 'compact' ? null : <td style={tdStyle}>{result.reasons?.join('; ') ?? ''}</td>}
                          {resultView === 'pattern-detail' ? (
                            <td style={tdStyle}>{formatPatternDetails(result)}</td>
                          ) : null}
                          {resultView === 'values' || resultView === 'debug' ? (
                            <td style={tdStyle}>{formatValues(result.values)}</td>
                          ) : null}
                          {resultView === 'debug' ? (
                            <>
                              <td style={tdStyle}>{result.scannerId}</td>
                              <td style={tdStyle}>{result.source ?? '-'}</td>
                              <td style={tdStyle}>{formatGeneratedAt(result.generatedAt)}</td>
                            </>
                          ) : null}
                          <td style={tdStyle}>
                            <button
                              type="button"
                              style={linkButtonStyle}
                              onClick={() => void handleShowOnChart(result)}
                            >
                              Show
                            </button>
                            <button
                              type="button"
                              style={linkButtonStyle}
                              onClick={() => void handleCreateScannerAlert(result)}
                            >
                              Alert
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {activeSection === 'alerts' ? (
            <div style={alertSectionStackStyle}>
              <div style={alertRunPanelStyle}>
                <div style={controlsStyle}>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Exchange</span>
                    <select style={inputStyle} value={exchange} onChange={(event) => setExchange(event.target.value)}>
                      <option value="NSE">NSE</option>
                      <option value="BSE">BSE</option>
                    </select>
                  </label>
                  <div style={fieldStyle}>
                    <span style={labelStyle}>Universe</span>
                    <select
                      style={inputStyle}
                      value={universeSource}
                      onChange={(event) => setUniverseSource(event.target.value as UniverseSource)}
                    >
                      <option value="active-chart">Active Chart</option>
                      <option value="symbol-list">Symbol List</option>
                      <option value="watchlists">Watchlists</option>
                    </select>
                    {universeSource === 'watchlists' ? (
                      <details style={multiSelectStyle}>
                        <summary style={multiSelectSummaryStyle}>{formatSelectedWatchlistLabel(selectedWatchlists)}</summary>
                        <div style={multiSelectPanelStyle}>
                          {watchlists.length === 0 ? (
                            <div style={multiSelectEmptyStyle}>No watchlists available.</div>
                          ) : (
                            watchlists.map((watchlist) => (
                              <label key={watchlist.id} style={multiSelectOptionStyle}>
                                <input
                                  type="checkbox"
                                  checked={selectedWatchlistIds.includes(watchlist.id)}
                                  onChange={() => toggleWatchlist(watchlist.id)}
                                />
                                <span>{watchlist.name}</span>
                                <span style={multiSelectMetaStyle}>{watchlist.items.length}</span>
                              </label>
                            ))
                          )}
                        </div>
                      </details>
                    ) : null}
                  </div>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Load bars</span>
                    <select
                      style={inputStyle}
                      value={lookbackBars === null ? 'all' : 'custom'}
                      onChange={(event) =>
                        setLookbackBars(
                          parseLookbackSelection(
                            event.target.value === 'all' ? 'all' : 'custom',
                            String(lookbackBars ?? DEFAULT_LOOKBACK_BARS),
                          ),
                        )
                      }
                    >
                      <option value="custom">Specified bars</option>
                      <option value="all">All history</option>
                    </select>
                    <input
                      type="number"
                      min={MIN_LOOKBACK_BARS}
                      style={inputStyle}
                      value={lookbackBars ?? ''}
                      disabled={lookbackBars === null}
                      onChange={(event) => setLookbackBars(parseLookbackBars(event.target.value))}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>Max symbols (symbol list only)</span>
                    <input
                      type="number"
                      min={1}
                      style={inputStyle}
                      value={maxSymbols}
                      onChange={(event) => setMaxSymbols(parsePositiveInteger(event.target.value, DEFAULT_MAX_SYMBOLS))}
                    />
                  </label>
                  <label style={fieldStyle}>
                    <span style={labelStyle}>To date</span>
                    <input
                      type="date"
                      style={inputStyle}
                      value={toDate}
                      onChange={(event) => setToDate(event.target.value)}
                    />
                  </label>
                  <button type="button" style={primaryButtonStyle} onClick={() => void handleRunAlertScan()} disabled={running}>
                    {running ? 'Scanning...' : 'Run alert scan'}
                  </button>
                  {running ? (
                    <button type="button" style={secondaryButtonStyle} onClick={requestScannerCancellation}>
                      Cancel
                    </button>
                  ) : null}
                </div>
              </div>

              <div style={scannerSectionHeaderStyle}>
                Configured rules ({configuredAlertRules.length})
              </div>
              <div style={tableWrapStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Rule</th>
                      <th style={thStyle}>Scope</th>
                      <th style={thStyle}>Condition</th>
                      <th style={thStyle}>Frequency</th>
                      <th style={thStyle}>Status</th>
                      <th style={thStyle}>Last Triggered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {configuredAlertRules.length === 0 ? (
                      <tr>
                        <td style={emptyCellStyle} colSpan={6}>
                          No alert rules configured. Add alerts from chart context or scanner results.
                        </td>
                      </tr>
                    ) : (
                      configuredAlertRules.map((rule) => (
                        <tr key={rule.id}>
                          <td style={tdStyle}>{formatAlertRuleName(rule)}</td>
                          <td style={tdStyle}>{formatAlertRuleScope(rule)}</td>
                          <td style={tdStyle}>{formatAlertCondition(rule)}</td>
                          <td style={tdStyle}>{formatAlertFrequency(rule.frequency)}</td>
                          <td style={tdStyle}>{rule.enabled ? 'Enabled' : 'Disabled'}</td>
                          <td style={tdStyle}>{rule.lastTriggeredAt ? formatGeneratedAt(rule.lastTriggeredAt) : '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={alertReviewHeaderStyle}>
                <div style={alertReviewTabsStyle}>
                  <button
                    type="button"
                    style={alertReviewTabStyle(activeAlertReviewTab === 'latest')}
                    onClick={() => setActiveAlertReviewTab('latest')}
                  >
                    Latest scan matches ({alertTriggers.length})
                  </button>
                  <button
                    type="button"
                    style={alertReviewTabStyle(activeAlertReviewTab === 'history')}
                    onClick={() => setActiveAlertReviewTab('history')}
                  >
                    Alert history ({alertHistory.length})
                  </button>
                </div>
              </div>
              {activeAlertReviewTab === 'latest' ? (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Symbol</th>
                        <th style={thStyle}>Rule</th>
                        <th style={thStyle}>Condition</th>
                        <th style={thStyle}>Value</th>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Message</th>
                        <th style={thStyle}>Chart</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertTriggers.length === 0 ? (
                        <tr>
                          <td style={emptyCellStyle} colSpan={7}>
                            No alert matches from the latest scan.
                          </td>
                        </tr>
                      ) : (
                        alertTriggers.map((trigger) => (
                          <tr key={trigger.id}>
                            <td style={tdStyle}>{trigger.exchange}:{trigger.symbol}</td>
                            <td style={tdStyle}>{trigger.ruleName}</td>
                            <td style={tdStyle}>{trigger.condition}</td>
                            <td style={tdStyle}>{trigger.triggerValue ?? '-'}</td>
                            <td style={tdStyle}>{trigger.date}</td>
                            <td style={tdStyle}>{trigger.message}</td>
                            <td style={tdStyle}>
                              <button
                                type="button"
                                style={linkButtonStyle}
                                onClick={() => void handleShowAlertOnChart(trigger)}
                              >
                                Show
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={tableWrapStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Scan Time</th>
                        <th style={thStyle}>Symbol</th>
                        <th style={thStyle}>Date</th>
                        <th style={thStyle}>Rule</th>
                        <th style={thStyle}>Value</th>
                        <th style={thStyle}>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {alertHistory.length === 0 ? (
                        <tr>
                          <td style={emptyCellStyle} colSpan={6}>
                            No persisted alert history yet.
                          </td>
                        </tr>
                      ) : (
                        alertHistory.slice(0, 100).map((event) => (
                          <tr key={event.id}>
                            <td style={tdStyle}>{formatGeneratedAt(event.scannedAt)}</td>
                            <td style={tdStyle}>{event.exchange}:{event.symbol}</td>
                            <td style={tdStyle}>{event.date}</td>
                            <td style={tdStyle}>{event.ruleName}</td>
                            <td style={tdStyle}>{event.triggerValue ?? '-'}</td>
                            <td style={tdStyle}>{event.message}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}

          {activeSection === 'library' ? (
            <div style={libraryStyle}>
              <div style={filterBarStyle}>
                <label style={filterFieldStyle}>
                  <span style={labelStyle}>Priority</span>
                  <select
                    style={filterInputStyle}
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value as ScannerPriorityFilter)}
                  >
                    <option value="all">All priorities</option>
                    <option value="high">High (H)</option>
                    <option value="medium">Medium (M)</option>
                    <option value="low">Low (L)</option>
                  </select>
                </label>
                <label style={filterFieldStyle}>
                  <span style={labelStyle}>Priority sort</span>
                  <select
                    style={filterInputStyle}
                    value={prioritySort}
                    onChange={(event) => setPrioritySort(event.target.value as ScannerPrioritySort)}
                  >
                    <option value="category">Category order</option>
                    <option value="high-to-low">High to Low</option>
                    <option value="low-to-high">Low to High</option>
                  </select>
                </label>
                <span style={filterSummaryStyle}>{formatSelectedScannerSummary(selectedScannerDefinitions)}</span>
              </div>
              <table style={libraryTableStyle}>
                <tbody>
                  {scannerGroups.map((group) => (
                    <React.Fragment key={group.label}>
                      <tr>
                        <td style={libraryGroupCellStyle} colSpan={6}>
                          <span>{group.label}</span>
                          <span>{group.definitions.length}</span>
                        </td>
                      </tr>
                      {group.definitions.map((definition) => (
                        <tr
                          key={definition.id}
                          style={
                            selectedScannerIds.length === 1 && selectedScannerIds[0] === definition.id
                              ? activeLibraryRowStyle
                              : libraryRowStyle
                          }
                          onClick={() => {
                            setSelectedScannerIds([definition.id]);
                            setActiveSection('run');
                          }}
                        >
                          <td style={libraryCellStyle}>
                            <span>{definition.name}</span>{' '}
                            <span
                              style={getScannerPriorityBadgeStyle(definition)}
                              title={`${getScannerPriorityDisplay(definition.priority).name} priority`}
                              role="img"
                              aria-label={`${getScannerPriorityDisplay(definition.priority).name} priority`}
                            >
                              {getScannerPriorityDisplay(definition.priority).label}
                            </span>
                          </td>
                          <td style={libraryCellMutedStyle}>{definition.chartPattern?.signalDirection ?? '-'}</td>
                          <td style={libraryCellMutedStyle}>{definition.scannerType}</td>
                          <td style={libraryCellMutedStyle}>{definition.chartPattern?.reliability ?? '-'}</td>
                          <td style={libraryCellMutedStyle}>{definition.description}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeSection === 'market-movers' ? (
            <MarketMoversFullView />
          ) : null}
        </div>
      </div>
    </FloatingWindow>
  );
}

function formatValues(values: ScannerResult['values']): string {
  if (!values) return '';
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${value ?? '-'}`)
    .join(', ');
}

function formatScannerProgress({
  completed,
  total,
  symbol,
  historyCompleted,
  historyTotal,
  resultCount,
  elapsedMs,
  remainingMs,
}: {
  completed: number;
  total: number;
  symbol: string;
  historyCompleted?: number;
  historyTotal?: number;
  resultCount?: number;
  elapsedMs: number;
  remainingMs: number | null;
}): string {
  const history = historyCompleted && historyTotal ? ` — history ${historyCompleted}/${historyTotal}` : '';
  const matches = resultCount === undefined ? '' : `; ${resultCount} matches`;
  const eta = remainingMs === null ? '' : `; ETA ${formatDuration(remainingMs)}`;
  return `Scanning ${completed}/${total}: ${symbol}${history}${matches}; elapsed ${formatDuration(elapsedMs)}${eta}...`;
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function scannerResultKey(result: ScannerResult): string {
  return [
    result.exchange,
    result.symbol,
    result.scannerId,
    result.history?.firstMatchedDate ?? result.date,
    result.chartPattern?.patternStartDate ?? '',
  ].join(':');
}

function formatPatternDetails(result: ScannerResult): string {
  const pattern = result.chartPattern;
  if (!pattern) {
    return formatValues(result.values) || '-';
  }

  return [
    `family: ${pattern.family}`,
    `confidence: ${pattern.confidence}`,
    pattern.patternStartDate ? `start: ${pattern.patternStartDate}` : null,
    `end: ${pattern.patternEndDate}`,
    typeof pattern.breakoutLevel === 'number' ? `breakout: ${pattern.breakoutLevel}` : null,
    typeof pattern.supportLevel === 'number' ? `support: ${pattern.supportLevel}` : null,
    typeof pattern.resistanceLevel === 'number' ? `resistance: ${pattern.resistanceLevel}` : null,
    typeof pattern.necklineLevel === 'number' ? `neckline: ${pattern.necklineLevel}` : null,
    typeof pattern.targetPrice === 'number' ? `target: ${pattern.targetPrice}` : null,
    typeof pattern.stopLossPrice === 'number' ? `stopLoss: ${pattern.stopLossPrice}` : null,
    typeof pattern.potentialGainPct === 'number' ? `gain: +${pattern.potentialGainPct}%` : null,
    typeof pattern.riskRewardRatio === 'number' ? `R:R: 1:${pattern.riskRewardRatio}` : null,
    pattern.pivots?.length ? `pivots: ${pattern.pivots.length}` : null,
  ].filter(Boolean).join(', ');
}

function formatGeneratedAt(generatedAt: string): string {
  const parsed = new Date(generatedAt);
  if (Number.isNaN(parsed.getTime())) return generatedAt;
  return parsed.toLocaleString();
}

function getResultViewColumnCount(view: ResultViewPreset): number {
  if (view === 'compact') return 6;
  if (view === 'pattern-detail') return 8;
  if (view === 'debug') return 11;
  return 8;
}

function getScannerChartLevels(result: ScannerResult) {
  const pattern = result.chartPattern;
  if (!pattern) return [];
  return [
    { label: 'Breakout', value: pattern.breakoutLevel },
    { label: 'Support', value: pattern.supportLevel },
    { label: 'Resistance', value: pattern.resistanceLevel },
    { label: 'Neckline', value: pattern.necklineLevel },
  ].filter((level): level is { label: string; value: number } =>
    typeof level.value === 'number' && Number.isFinite(level.value),
  );
}

function findBarIndexOnOrAfter(bars: { date: string }[], date: string): number {
  const exactIndex = bars.findIndex((bar) => bar.date === date);
  if (exactIndex >= 0) return exactIndex;
  const nextIndex = bars.findIndex((bar) => bar.date > date);
  if (nextIndex >= 0) return nextIndex;
  return bars.length - 1;
}

function filterScannerResults(
  results: ScannerResult[],
  definitions: Map<string, ScannerDefinition>,
  options: {
    familyFilter: ResultFamilyFilter;
    directionFilter: ResultDirectionFilter;
    minScore: number;
    recentOnly: boolean;
  },
): ScannerResult[] {
  const recentCutoff = options.recentOnly ? getRecentResultCutoff(results) : null;
  return results.filter((result) => {
    const definition = definitions.get(result.scannerId);
    const family = definition?.chartPattern?.family ?? 'core';
    if (options.familyFilter !== 'all' && options.familyFilter !== family) return false;
    if (options.directionFilter !== 'all' && result.direction !== options.directionFilter) return false;
    if ((result.score ?? 0) < options.minScore) return false;
    if (recentCutoff && result.date < recentCutoff) return false;
    return true;
  });
}

function getRecentResultCutoff(results: ScannerResult[]): string | null {
  const latestDate = results.reduce<string | null>(
    (latest, result) => (latest === null || result.date > latest ? result.date : latest),
    null,
  );
  if (!latestDate) return null;
  const date = new Date(`${latestDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setFullYear(date.getFullYear() - 1);
  return date.toISOString().slice(0, 10);
}

function groupScannerDefinitions(definitions: ScannerDefinition[]): ScannerGroup[] {
  const groups = new Map<string, ScannerDefinition[]>();
  definitions.forEach((definition) => {
    const label = scannerGroupLabel(definition);
    const group = groups.get(label) ?? [];
    group.push(definition);
    groups.set(label, group);
  });

  return [...groups.entries()]
    .map(([label, groupDefinitions]) => ({
      label,
      definitions: groupDefinitions,
    }))
    .sort((first, second) => scannerGroupRank(first.label) - scannerGroupRank(second.label));
}

function scannerGroupLabel(definition: ScannerDefinition): string {
  const family = definition.chartPattern?.family;
  if (!family) return 'Core OHLCV';
  if (family === 'gap') return 'Chart Patterns - Gaps';
  if (family === 'reversal') return 'Chart Patterns - Reversals';
  if (family === 'continuation') return 'Chart Patterns - Continuations';
  return 'Chart Patterns - Neutral/Bilateral';
}

function scannerGroupRank(label: string): number {
  const order = [
    'Core OHLCV',
    'Chart Patterns - Gaps',
    'Chart Patterns - Reversals',
    'Chart Patterns - Continuations',
    'Chart Patterns - Neutral/Bilateral',
  ];
  const index = order.indexOf(label);
  return index === -1 ? order.length : index;
}

function formatScannerOptionLabel(definition: ScannerDefinition): string {
  const direction = definition.chartPattern?.signalDirection;
  return direction ? `${definition.name} - ${direction}` : definition.name;
}

function getScannerPriorityBadgeStyle(definition: ScannerDefinition): React.CSSProperties {
  const priority = getScannerPriorityDisplay(definition.priority);
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    padding: '0 5px',
    background: priority.color,
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
  };
}

function formatSelectedScannerLabel(selectedCount: number, totalCount: number): string {
  if (selectedCount === 0) return 'No scanners selected';
  if (selectedCount === totalCount) return `All scanners (${totalCount})`;
  return `${selectedCount} scanners selected`;
}

function formatSelectedWatchlistLabel(watchlists: Watchlist[]): string {
  if (watchlists.length === 0) return 'Select watchlists';
  if (watchlists.length === 1) return watchlists[0].name;
  return `${watchlists.length} watchlists`;
}

function formatScannerMetadata(definition: ScannerDefinition): string {
  const pattern = definition.chartPattern;
  const priority = getScannerPriorityDisplay(definition.priority);
  if (!pattern) {
    return `${definition.categoryName} | ${definition.scannerType} | ${priority.name} priority`;
  }
  return `${scannerGroupLabel(definition)} | ${pattern.signalDirection} | ${pattern.reliability} reliability | ${priority.name} priority`;
}

function formatScannerCatalogSummary(groups: ScannerGroup[]): string {
  return groups
    .map((group) => `${group.label}: ${group.definitions.length}`)
    .join(' | ');
}

function formatSelectedScannerSummary(definitions: ScannerDefinition[]): string {
  if (definitions.length === 0) return 'No scanners selected.';
  const familyCounts = new Map<string, number>();
  const priorityCounts = { high: 0, medium: 0, low: 0 };
  definitions.forEach((definition) => {
    const label = scannerGroupLabel(definition).replace('Chart Patterns - ', '');
    familyCounts.set(label, (familyCounts.get(label) ?? 0) + 1);
    const priority = getScannerPriorityDisplay(definition.priority).name.toLowerCase() as keyof typeof priorityCounts;
    priorityCounts[priority] += 1;
  });
  const families = [...familyCounts.entries()].map(([label, count]) => `${label} ${count}`).join(' | ');
  return `Selected ${definitions.length}: ${families}; H ${priorityCounts.high} | M ${priorityCounts.medium} | L ${priorityCounts.low}`;
}

function formatResultGroupLabel(
  result: ScannerResult,
  definitions: Map<string, ScannerDefinition>,
): string {
  const definition = definitions.get(result.scannerId);
  return definition ? scannerGroupLabel(definition) : result.categoryName;
}

function formatAlertRuleScope(rule: EodAlertRule): string {
  if (rule.scope === 'any-scanned-symbol') {
    return 'Any scanned symbol';
  }
  if (rule.exchange && rule.symbol) {
    return `${rule.exchange}:${rule.symbol}`;
  }
  return 'Current chart';
}

function getScannerIdsForAlertRules(rules: EodAlertRule[], allScannerIds: string[]): string[] {
  const scannerIds = new Set<string>();
  let hasAnyScannerMatchRule = false;

  rules.forEach((rule) => {
    if (rule.conditionType !== 'scanner_match') {
      return;
    }
    hasAnyScannerMatchRule = true;
    if (rule.scannerId) {
      scannerIds.add(rule.scannerId);
    }
  });

  if (scannerIds.size > 0) {
    return [...scannerIds];
  }
  return hasAnyScannerMatchRule ? allScannerIds : [];
}

function formatSectionLabel(section: ScannerWorkspaceSection): string {
  if (section === 'run') return 'Run';
  if (section === 'results') return 'Results';
  if (section === 'alerts') return 'Alerts';
  if (section === 'market-movers') return 'Market Movers';
  return 'Library';
}

const bodyStyle: React.CSSProperties = {
  display: 'flex',
  minHeight: 0,
  flex: 1,
};

const navStyle: React.CSSProperties = {
  width: 170,
  flexShrink: 0,
  borderRight: '1px solid var(--border)',
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  background: 'var(--bg2)',
};

const navTitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 4,
};

const navButtonStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  minHeight: 34,
  padding: '7px 9px',
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid transparent',
  borderRadius: 4,
  cursor: 'pointer',
  textAlign: 'left',
  fontWeight: 700,
};

const activeNavButtonStyle: React.CSSProperties = {
  ...navButtonStyle,
  background: 'var(--control-bg-hover)',
  border: '1px solid var(--accent)',
};

const navCountStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const workspaceStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
  flex: 1,
  padding: 16,
  gap: 12,
};

const workspaceHeaderStyle: React.CSSProperties = {
  minHeight: 20,
};

const controlsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(110px, 1fr)) auto',
  gap: 10,
  alignItems: 'end',
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
};

const inputStyle: React.CSSProperties = {
  height: 32,
  background: 'var(--bg3)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '0 8px',
  minWidth: 0,
};

const multiSelectStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 0,
};

const multiSelectSummaryStyle: React.CSSProperties = {
  height: 32,
  display: 'flex',
  alignItems: 'center',
  background: 'var(--bg3)',
  color: 'var(--text)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '0 8px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const multiSelectPanelStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  top: 34,
  left: 0,
  width: 300,
  maxHeight: 360,
  overflow: 'auto',
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.35)',
  padding: 6,
};

const multiSelectOptionStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '18px 1fr auto',
  gap: 7,
  alignItems: 'center',
  minHeight: 28,
  padding: '4px 6px',
  color: 'var(--text)',
  cursor: 'pointer',
};

const multiSelectNestedOptionStyle: React.CSSProperties = {
  ...multiSelectOptionStyle,
  paddingLeft: 20,
  color: 'var(--text-dim)',
};

const multiSelectGroupStyle: React.CSSProperties = {
  borderTop: '1px solid var(--border)',
  marginTop: 4,
  paddingTop: 4,
};

const multiSelectGroupHeaderStyle: React.CSSProperties = {
  ...multiSelectOptionStyle,
  fontWeight: 700,
};

const multiSelectMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const multiSelectEmptyStyle: React.CSSProperties = {
  padding: 8,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const primaryButtonStyle: React.CSSProperties = {
  height: 32,
  padding: '0 14px',
  background: 'var(--control-bg-hover)',
  color: 'var(--text)',
  border: '1px solid var(--accent)',
  borderRadius: 4,
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  ...primaryButtonStyle,
  background: 'var(--bg3)',
  borderColor: 'var(--border2)',
};

const linkButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--accent)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  padding: '4px 8px',
  cursor: 'pointer',
  fontWeight: 700,
};

const metaStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  fontSize: 12,
  color: 'var(--text-dim)',
};

const scannerInfoStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg2)',
  fontSize: 12,
  color: 'var(--text-dim)',
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'end',
};

const filterFieldStyle: React.CSSProperties = {
  ...fieldStyle,
  width: 160,
};

const filterInputStyle: React.CSSProperties = {
  ...inputStyle,
  height: 30,
};

const checkboxFieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 30,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const filterSummaryStyle: React.CSSProperties = {
  height: 30,
  display: 'flex',
  alignItems: 'center',
  color: 'var(--text-dim)',
  fontSize: 12,
};

const warningBoxStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  color: 'var(--text-dim)',
  padding: 8,
  borderRadius: 4,
  fontSize: 12,
};

const warningToggleStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text)',
  border: 0,
  padding: 0,
  fontWeight: 700,
  cursor: 'pointer',
};

const warningListStyle: React.CSSProperties = {
  marginTop: 8,
  color: 'var(--red)',
};

const tableWrapStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--border)',
};

const alertSectionStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minHeight: 0,
};

const alertRunPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 10,
  border: '1px solid var(--border)',
  background: 'var(--bg1)',
};

const scannerSectionHeaderStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 800,
};

const alertReviewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  borderBottom: '1px solid var(--border)',
};

const alertReviewTabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
};

function alertReviewTabStyle(active: boolean): React.CSSProperties {
  return {
    height: 32,
    padding: '0 12px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    borderBottomColor: active ? 'var(--accent)' : 'var(--border2)',
    borderRadius: '6px 6px 0 0',
    background: active ? 'var(--accent-soft)' : 'var(--bg2)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 800,
  };
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const thStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  background: 'var(--bg2)',
  color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
  padding: 8,
  textAlign: 'left',
};

const tdStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  padding: 8,
  verticalAlign: 'top',
};

const cellMetaStyle: React.CSSProperties = {
  marginTop: 3,
  color: 'var(--text-dim)',
  fontSize: 11,
};

const emptyCellStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  color: 'var(--text-dim)',
  padding: 24,
};

const libraryStyle: React.CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--border)',
};

const libraryTableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 12,
};

const libraryGroupCellStyle: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 1,
  background: 'var(--bg2)',
  color: 'var(--text)',
  borderBottom: '1px solid var(--border)',
  padding: '7px 10px',
  fontWeight: 700,
  display: 'flex',
  justifyContent: 'space-between',
};

const libraryRowStyle: React.CSSProperties = {
  cursor: 'pointer',
};

const activeLibraryRowStyle: React.CSSProperties = {
  ...libraryRowStyle,
  background: 'var(--control-bg-hover)',
};

const patternMapSelectedRowStyle: React.CSSProperties = {
  background: 'rgba(59, 130, 246, 0.12)',
};

const libraryCellStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
  padding: '6px 10px',
  color: 'var(--text)',
  whiteSpace: 'nowrap',
};

const libraryCellMutedStyle: React.CSSProperties = {
  ...libraryCellStyle,
  color: 'var(--text-dim)',
  whiteSpace: 'normal',
};

const dailyPresetBarContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  padding: '6px 10px',
  background: 'var(--bg1)',
  border: '1px solid var(--border)',
  borderRadius: 4,
};

const dailyPresetLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--text)',
  marginRight: 4,
};

function dailyPresetButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 28,
    padding: '0 10px',
    background: active ? 'var(--accent-soft)' : 'var(--bg2)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
  };
}
