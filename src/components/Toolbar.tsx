import { useEffect, useState } from 'react';
import type { ChartType } from '@/engine/types';
import type { LayoutMode } from '@/store/chartStoreTypes';
import { getDesktopApi } from '@/platform';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { chartPatternScannerDefinitions, runChartPatternScanner } from '@/plugins/scanner/chartPatternScanners';
import { loadCompleteChartHistory, scannerHistoryMatchesChart } from '@/plugins/scanner/chartPatternScanService';
import { getLoadedScannerPriceBasis, sameScannerPriceBasis } from '@/plugins/scanner/scannerChartPriceBasis';
import { buildScannerTimeframeBars } from '@/plugins/scanner/scannerChartTimeframe';
import { buildScannerPatternMapEntries } from '@/plugins/scanner/scannerPatternMap';
import type { EodBar, ScannerResult } from '@/plugins/scanner/types';
import { detectPatterns, SUPPORTED_PATTERNS } from '@/engine/Patterns';
import { ChartHeader } from './ChartHeader';
import { CustomFormulaDialog } from './CustomFormulaDialog';
import { CompareOverlayDialog } from './CompareOverlayDialog';

export function Toolbar() {
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const addIndicatorCatalog = useChartStore((state) => state.addIndicatorCatalog);
  const addCustomFormulaIndicator = useChartStore((state) => state.addCustomFormulaIndicator);
  const addCompareOverlay = useChartStore((state) => state.addCompareOverlay);
  const removeCompareOverlay = useChartStore((state) => state.removeCompareOverlay);
  const removeIndicator = useChartStore((state) => state.removeIndicator);
  const setShowVolume = useChartStore((state) => state.setShowVolume);
  const setChartType = useChartStore((state) => state.setChartType);
  const setLayoutMode = useChartStore((state) => state.setLayoutMode);
  const adjustedMode = useChartStore((state) => state.adjustedMode);
  const setAdjustedMode = useChartStore((state) => state.setAdjustedMode);
  const addToast = useChartStore((state) => state.addToast);
  const updateIndicator = useChartStore((state) => state.updateIndicator);
  const scrollToViewportStart = useChartStore((state) => state.scrollToViewportStart);
  const compareDialogOpen = useUiStore((state) => state.compareDialogOpen);
  const closeCompareDialog = useUiStore((state) => state.closeCompareDialog);
  const customFormulaCreateOpen = useUiStore((state) => state.customFormulaDialogOpen);
  const closeCustomFormulaDialog = useUiStore((state) => state.closeCustomFormulaDialog);
  const requestChartScreenshot = useUiStore((state) => state.requestChartScreenshot);
  const showScannerChartOverlay = useUiStore((state) => state.showScannerChartOverlay);
  const clearScannerChartOverlay = useUiStore((state) => state.clearScannerChartOverlay);
  const showScannerPatternMap = useUiStore((state) => state.showScannerPatternMap);
  const clearScannerPatternMap = useUiStore((state) => state.clearScannerPatternMap);
  const setScannerPatternMapVisibleGeometry = useUiStore((state) => state.setScannerPatternMapVisibleGeometry);
  const openAlertManager = useUiStore((state) => state.openAlertManager);
  const openSignalSettingsDialog = useUiStore((state) => state.openSignalSettingsDialog);
  const openIndicatorPicker = useUiStore((state) => state.openIndicatorPicker);
  const signalRules = useUiStore((state) => state.signalRules);
  const signalSettingsDialogOpen = useUiStore((state) => state.signalSettingsDialogOpen);
  const [screenshotMenuOpen, setScreenshotMenuOpen] = useState(false);
  const [chartPatternScanRunning, setChartPatternScanRunning] = useState(false);
  const [chartPatternSettingsOpen, setChartPatternSettingsOpen] = useState(false);
  const [chartPatternSearch, setChartPatternSearch] = useState('');
  const [enabledChartPatternIds, setEnabledChartPatternIds] = useState<string[]>(() => readStoredToolbarChartPatternIds());
  const updateEnabledChartPatternIds = (nextIds: string[], isDefault = false) => {
    setEnabledChartPatternIds(nextIds);
    writeStoredToolbarChartPatternIds(isDefault ? null : nextIds);
  };
  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);
  const layoutMode = activeTab?.layoutMode ?? 'single';
  const showVolume = activeTab?.showVolume ?? true;
  const activeChartType = activeTab?.chartType ?? 'candles';
  const candlestickPatternIndicator = activeTab?.indicators.find((indicator) => indicator.kind === 'PATTERN') ?? null;

  const scannerChartOverlay = useUiStore((state) => state.scannerChartOverlay);
  const scannerPatternMap = useUiStore((state) => state.scannerPatternMap);
  const activeInstrument = activeTab?.instrument;
  const isChartPatternActive = Boolean(
    activeInstrument &&
      ((scannerChartOverlay &&
        (!scannerChartOverlay.timeframe || scannerChartOverlay.timeframe === activeTab?.timeframe) &&
        scannerChartOverlay.instrument.exchange === activeInstrument.exchange &&
        scannerChartOverlay.instrument.symbol === activeInstrument.symbol) ||
        (scannerPatternMap?.entries &&
          scannerPatternMap.entries.length > 0 &&
          scannerPatternMap.entries.some(
            (e) => e.instrument.exchange === activeInstrument.exchange && e.instrument.symbol === activeInstrument.symbol,
          )))
  );

  useEffect(() => {
    closeCustomFormulaDialog();
    setScreenshotMenuOpen(false);
  }, [activeChartTabId, closeCustomFormulaDialog]);

  useEffect(() => {
    if (!screenshotMenuOpen) {
      return;
    }

    const closeMenu = () => setScreenshotMenuOpen(false);
    window.addEventListener('mousedown', closeMenu);
    window.addEventListener('blur', closeMenu);
    return () => {
      window.removeEventListener('mousedown', closeMenu);
      window.removeEventListener('blur', closeMenu);
    };
  }, [screenshotMenuOpen]);

  const handleRunChartPatternScan = async () => {
    const instrument = activeTab?.instrument ?? activeTab?.requestedInstrument ?? null;
    if (!activeTab || !instrument) {
      addToast('Open a chart before running chart-pattern scan.', 'warning', 'Scanner');
      return;
    }

    // Toggle OFF if already active on this instrument
    if (isChartPatternActive) {
      clearScannerChartOverlay();
      clearScannerPatternMap();
      addToast('Chart patterns removed from chart.', 'info', 'Scanner');
      return;
    }

    const api = getDesktopApi();
    if (!api) {
      addToast('Desktop API bridge is unavailable.', 'error', 'Scanner');
      return;
    }

    setChartPatternScanRunning(true);
    try {
      const priceBasis = getLoadedScannerPriceBasis(activeTab);
      if (!priceBasis || activeTab.rawBars.length === 0 || useChartStore.getState().isDatabaseTransitioning) {
        addToast('Wait for the chart data to finish loading before scanning.', 'warning', 'Scanner');
        return;
      }
      const databasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
      const historyBars = await loadCompleteChartHistory(api, instrument, { ...priceBasis, databasePath });
      const currentState = useChartStore.getState();
      const currentTab = getActiveChartTab(currentState.chartTabs, currentState.activeChartTabId);
      const currentPriceBasis = currentTab ? getLoadedScannerPriceBasis(currentTab) : null;
      if (currentState.isDatabaseTransitioning || currentState.activeChartTabId !== activeTab.id ||
        currentTab?.id !== activeTab.id || !currentPriceBasis || !sameScannerPriceBasis(priceBasis, currentPriceBasis) ||
        currentTab.rawBars !== activeTab.rawBars || currentTab.timeframe !== activeTab.timeframe ||
        (currentState.snapshot?.activeDatabasePath ?? null) !== databasePath) {
        addToast('The chart changed while loading scan data. Run Chart Patterns again.', 'warning', 'Scanner');
        return;
      }
      if (!scannerHistoryMatchesChart(historyBars, activeTab.rawBars)) {
        addToast('Chart data differs from scan history. Reload the chart before scanning.', 'warning', 'Scanner');
        return;
      }
      const bars = buildScannerTimeframeBars(instrument.symbol, activeTab.rawBars, activeTab.timeframe);
      if (bars.length < 20) {
        addToast(`Chart-pattern scan needs at least 20 ${activeTab.timeframe} bars.`, 'warning', 'Scanner');
        return;
      }
      const results = runActiveChartPatternScan(instrument, bars);

      const definitionsMap = new Map(chartPatternScannerDefinitions.map((def) => [def.id, def]));
      const instrumentEntries = buildScannerPatternMapEntries(
        results.filter((r) => r.exchange === instrument.exchange && r.symbol === instrument.symbol),
        definitionsMap,
        { family: 'all', direction: 'all', priority: 'all', status: 'all' },
      );

      const bestResult = selectBestChartPatternResult(results, bars);

      if (!bestResult && instrumentEntries.length === 0) {
        clearScannerPatternMap();
        clearScannerChartOverlay();
        addToast(
          `No chart patterns matched ${instrument.exchange}:${instrument.symbol}.`,
          'info',
          'Scanner',
        );
        return;
      }

      // Display the single best, most prominent pattern cleanly as active overlay
      if (bestResult) {
        showScannerChartOverlay({
          id: `${bestResult.exchange}:${bestResult.symbol}:${bestResult.scannerId}:${bestResult.date}:${Date.now()}`,
          instrument,
          date: bestResult.date,
          scannerName: bestResult.scannerName,
          scannerId: bestResult.scannerId,
          priceBasis,
          databasePath,
          contextBars: ACTIVE_CHART_PATTERN_CONTEXT_BARS,
          sourceBars: activeTab.rawBars,
          timeframe: activeTab.timeframe,
          direction: bestResult.direction,
          score: bestResult.score,
          levels: getScannerChartLevels(bestResult),
          geometry: bestResult.chartPattern?.geometry,
          editable: bestResult.chartPattern?.geometry?.family === 'range',
        });

        addToast(
          `${bestResult.scannerName} recognized on ${activeTab.timeframe} chart. Click again to remove.`,
          'success',
          'Scanner',
        );
      } else {
        addToast(
          `Found ${instrumentEntries.length} historical pattern milestone${instrumentEntries.length === 1 ? '' : 's'} across chart. Click again to remove.`,
          'success',
          'Scanner',
        );
      }
    } catch (error) {
      addToast(
        `Failed to run chart-pattern scan: ${error instanceof Error ? error.message : String(error)}`,
        'error',
        'Scanner',
      );
    } finally {
      setChartPatternScanRunning(false);
    }
  };

  const handleToggleCandlestickPatterns = () => {
    if (!activeTab) {
      addToast('Open a chart before running candlestick-pattern scan.', 'warning', 'Chart');
      return;
    }

    if (candlestickPatternIndicator) {
      removeIndicator(candlestickPatternIndicator.id);
      addToast('Removed candlestick patterns from chart.', 'info', 'Chart');
      return;
    }

    if (activeTab.rawBars.length < 5) {
      addToast('Candlestick-pattern scan needs more loaded bars on the active chart.', 'warning', 'Chart');
      return;
    }

    const allPatternIds = getAllCandlestickPatternIds();
    addIndicatorCatalog('patterns');

    const markers = detectPatterns(activeTab.rawBars, allPatternIds, '#2563eb');
    const latestMarker = markers[markers.length - 1] ?? null;
    if (latestMarker) {
      const markerDate = activeTab.rawBars[latestMarker.index]?.date;
      const barIndex = markerDate ? findBarIndexOnOrAfter(activeTab.displayBars, markerDate) : latestMarker.index;
      if (barIndex >= 0) {
        const span = Math.max(activeTab.visibleBarCount || 120, 20);
        scrollToViewportStart(Math.max(0, barIndex - Math.floor(span / 2)));
      }
      addToast(
        `${markers.length} candlestick pattern marker${markers.length === 1 ? '' : 's'} found; centered latest ${latestMarker.label}.`,
        'success',
        'Chart',
      );
      return;
    }

    addToast('Candlestick pattern detector added to chart.', 'success', 'Chart');
  };

  return (
    <div style={toolbarStyle}>
      <div style={toolbarControlsStyle}>
        <div style={toolbarClusterStyle}>
          <ChartHeader inline />
        </div>
        <div style={toolbarClusterStyle}>
          <select
            value={activeChartType}
            onChange={(event) => setChartType(event.target.value as ChartType)}
            style={toolbarSelectStyle}
            title="Chart type"
          >
            {CHART_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setShowVolume(!showVolume)}
            aria-pressed={showVolume}
            style={showVolume ? activeActionButtonStyle : actionButtonStyle}
            title={showVolume ? 'Hide chart volume overlay' : 'Show chart volume overlay'}
          >
            Volume
          </button>
        </div>
        <div style={toolbarClusterStyle}>
          <button
            type="button"
            onClick={() => {
              const next = !adjustedMode;
              setAdjustedMode(next);
            }}
            aria-pressed={adjustedMode}
            style={adjustedMode ? activeActionButtonStyle : actionButtonStyle}
            title={activeTab?.instrument && activeTab.loadedAdjusted !== adjustedMode
              ? `Capital adjustment ${adjustedMode ? 'ON' : 'OFF'} requested. Chart data has not yet loaded in this mode. Click to change mode.`
              : adjustedMode ? 'Capital adjustment ON (Splits & Bonuses adjusted). Click to show raw prices.' : 'Capital adjustment OFF (Showing raw prices). Click to adjust for Splits & Bonuses.'}
          >
            Adj
          </button>
        </div>
        <div style={toolbarClusterStyle}>
          <button
            type="button"
            onClick={openIndicatorPicker}
            style={{ ...actionButtonStyle, minWidth: 80 }}
            title="Search and add indicators"
          >
            Indicators
          </button>
          <button
            type="button"
            onClick={openAlertManager}
            style={{ ...actionButtonStyle, minWidth: 52 }}
            title="Open Alert Manager"
          >
            Alerts
          </button>
          <button
            type="button"
            onClick={openSignalSettingsDialog}
            aria-haspopup="dialog"
            aria-expanded={signalSettingsDialogOpen}
            style={{ ...(signalRules.length > 0 ? activeActionButtonStyle : actionButtonStyle), minWidth: 58 }}
            title="Configure Visual Crossover Signals & Alerts"
          >
            Signals{signalRules.length > 0 ? ` (${signalRules.length})` : ''}
          </button>
        </div>
        <div style={toolbarClusterStyle}>
          <button
            type="button"
            onClick={handleRunChartPatternScan}
            aria-pressed={isChartPatternActive}
            disabled={chartPatternScanRunning}
            style={{ ...(isChartPatternActive ? activeActionButtonStyle : actionButtonStyle), minWidth: 104, opacity: chartPatternScanRunning ? 0.65 : 1 }}
            title={isChartPatternActive ? 'Remove chart patterns from chart' : `Scan ${activeTab?.timeframe ?? 'D'} bars for chart patterns`}
          >
            {chartPatternScanRunning ? 'Scanning...' : 'Chart Patterns'}
          </button>
          <button
            type="button"
            onClick={() => setChartPatternSettingsOpen((open) => !open)}
            style={{ ...(chartPatternSettingsOpen ? activeActionButtonStyle : actionButtonStyle), minWidth: 24, padding: '0 6px' }}
            title={`Configure which chart patterns to scan (${enabledChartPatternIds.length}/${chartPatternScannerDefinitions.length} enabled)`}
            aria-label="Configure toolbar chart patterns"
          >
            ⚙
          </button>
          <button
            type="button"
            onClick={handleToggleCandlestickPatterns}
            aria-pressed={Boolean(candlestickPatternIndicator)}
            style={{ ...(candlestickPatternIndicator ? activeActionButtonStyle : actionButtonStyle), minWidth: 64 }}
            title={candlestickPatternIndicator ? 'Remove candlestick patterns from chart' : 'Scan and plot candlestick patterns on chart'}
          >
            Candles
          </button>
        </div>
      </div>
      {chartPatternSettingsOpen ? (
        <ToolbarChartPatternSettingsModal
          enabledIds={enabledChartPatternIds}
          search={chartPatternSearch}
          onSearchChange={setChartPatternSearch}
          onChangeIds={updateEnabledChartPatternIds}
          onClose={() => setChartPatternSettingsOpen(false)}
          onScanNow={() => {
            setChartPatternSettingsOpen(false);
            if (isChartPatternActive) {
              clearScannerChartOverlay();
              clearScannerPatternMap();
            }
            void handleRunChartPatternScan();
          }}
        />
      ) : null}
      <div style={screenshotControlStyle} onMouseDown={(event) => event.stopPropagation()}>
        <button
          type="button"
          style={screenshotButtonStyle(screenshotMenuOpen)}
          onClick={() => setScreenshotMenuOpen((open) => !open)}
          aria-expanded={screenshotMenuOpen}
          aria-label="Take chart screenshot"
          title="Take chart screenshot"
        >
          📷
        </button>
        {screenshotMenuOpen ? (
          <div style={screenshotMenuStyle}>
            <button
              type="button"
              style={screenshotMenuItemStyle}
              onClick={() => {
                setScreenshotMenuOpen(false);
                requestChartScreenshot('save');
              }}
            >
              Save PNG
            </button>
            <button
              type="button"
              style={screenshotMenuItemStyle}
              onClick={() => {
                setScreenshotMenuOpen(false);
                requestChartScreenshot('copy');
              }}
            >
              Copy image
            </button>
          </div>
        ) : null}
      </div>

      {customFormulaCreateOpen ? (
        <CustomFormulaDialog
          onSubmit={(draft) => {
            addCustomFormulaIndicator(draft);
            closeCustomFormulaDialog();
          }}
          onClose={closeCustomFormulaDialog}
        />
      ) : null}

      {compareDialogOpen ? (
        <CompareOverlayDialog
          compareOverlays={activeTab?.compareOverlays ?? []}
          onAdd={(instrument) => void addCompareOverlay(instrument)}
          onRemove={removeCompareOverlay}
          onClose={closeCompareDialog}
        />
      ) : null}
    </div>
  );
}

export function runActiveChartPatternScan(
  instrument: { exchange: string; symbol: string },
  bars: EodBar[],
): ScannerResult[] {
  const results: ScannerResult[] = [];
  const seen = new Set<string>();

  // Evaluate user-selected chart patterns (or default macro patterns when no custom selection is stored)
  let selectedIds: Set<string> | null = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem('eod-chart.toolbar-chart-patterns.ids.v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          selectedIds = new Set(parsed.filter((id): id is string => typeof id === 'string'));
        }
      }
    } catch {}
  }
  const minScore = selectedIds ? 40 : 65;
  const macroDefinitions = chartPatternScannerDefinitions.filter((definition) => {
    const family = definition.chartPattern?.family;
    if (selectedIds) return selectedIds.has(definition.id);
    const isCandleMicro = definition.id.includes('mat_hold') || definition.id.includes('three_methods');
    return family !== 'gap' && definition.scannerType !== 'gap' && !isCandleMicro;
  });

  for (let endIndex = ACTIVE_CHART_PATTERN_MIN_BARS; endIndex <= bars.length; endIndex += 1) {
    const contextBars = bars.slice(Math.max(0, endIndex - ACTIVE_CHART_PATTERN_CONTEXT_BARS), endIndex);
    macroDefinitions.forEach((definition) => {
      const result = runChartPatternScanner(
        {
          symbol: instrument.symbol,
          exchange: instrument.exchange,
          instrument,
          bars: contextBars,
        },
        definition,
      );
      if (!result?.matched || (result.score ?? 0) < minScore) {
        return;
      }
      const key = `${result.scannerId}:${result.date}:${result.direction ?? ''}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      results.push({
        ...result,
        history: {
          firstMatchedDate: result.chartPattern?.patternStartDate ?? result.date,
          lastMatchedDate: result.date,
          matchCount: 1,
        },
      });
    });
  }
  return clusterNearbyMacroResults(results, bars);
}

function clusterNearbyMacroResults(results: ScannerResult[], bars: EodBar[]): ScannerResult[] {
  if (results.length <= 1) return results;
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
  const clustered: ScannerResult[] = [];

  for (const current of sorted) {
    const currentIdx = bars.findIndex((b) => b.date === current.date);
    const existingIndex = clustered.findIndex((c) => {
      if (c.scannerId !== current.scannerId && c.chartPattern?.family !== current.chartPattern?.family) return false;
      const cIdx = bars.findIndex((b) => b.date === c.date);
      return Math.abs(currentIdx - cIdx) <= 12;
    });

    if (existingIndex >= 0) {
      if ((current.score ?? 0) > (clustered[existingIndex].score ?? 0)) {
        clustered[existingIndex] = current;
      }
    } else {
      clustered.push(current);
    }
  }

  return clustered;
}

function getAllCandlestickPatternIds(): string[] {
  return SUPPORTED_PATTERNS.map((pattern) => pattern.id);
}

const ACTIVE_CHART_PATTERN_MIN_BARS = 20;
const ACTIVE_CHART_PATTERN_CONTEXT_BARS = 220;
const TOOLBAR_CHART_PATTERN_STORAGE_KEY = 'eod-chart.toolbar-chart-patterns.ids.v1';
const UNCONFIRMED_NEUTRAL_PATTERN_IDS = new Set([
  'chart_rectangle_range',
  'chart_diamond_pattern',
  'chart_broadening_formation',
  'chart_coil_volatility_squeeze',
]);

export const DEFAULT_TOOLBAR_CHART_PATTERN_IDS: string[] = chartPatternScannerDefinitions
  .filter((definition) => {
    const family = definition.chartPattern?.family;
    const isCandleMicro = definition.id.includes('mat_hold') || definition.id.includes('three_methods');
    return (
      family !== 'gap' &&
      definition.scannerType !== 'gap' &&
      !isCandleMicro &&
      !UNCONFIRMED_NEUTRAL_PATTERN_IDS.has(definition.id)
    );
  })
  .map((definition) => definition.id);

export function readStoredToolbarChartPatternIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return DEFAULT_TOOLBAR_CHART_PATTERN_IDS;
  }
  try {
    const raw = window.localStorage.getItem(TOOLBAR_CHART_PATTERN_STORAGE_KEY);
    if (!raw) return DEFAULT_TOOLBAR_CHART_PATTERN_IDS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TOOLBAR_CHART_PATTERN_IDS;
    const validIds = new Set(chartPatternScannerDefinitions.map((def) => def.id));
    return parsed.filter((id): id is string => typeof id === 'string' && validIds.has(id));
  } catch {
    return DEFAULT_TOOLBAR_CHART_PATTERN_IDS;
  }
}

export function writeStoredToolbarChartPatternIds(ids: string[] | null): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    if (ids === null) {
      window.localStorage.removeItem(TOOLBAR_CHART_PATTERN_STORAGE_KEY);
    } else {
      window.localStorage.setItem(TOOLBAR_CHART_PATTERN_STORAGE_KEY, JSON.stringify(ids));
    }
  } catch {}
}

interface ToolbarChartPatternSettingsModalProps {
  enabledIds: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onChangeIds: (nextIds: string[], isDefault?: boolean) => void;
  onClose: () => void;
  onScanNow: () => void;
}

function ToolbarChartPatternSettingsModal({
  enabledIds,
  search,
  onSearchChange,
  onChangeIds,
  onClose,
  onScanNow,
}: ToolbarChartPatternSettingsModalProps) {
  const enabledSet = new Set(enabledIds);
  const query = search.trim().toLowerCase();
  const categories = Array.from(
    chartPatternScannerDefinitions.reduce((map, def) => {
      if (query && !def.name.toLowerCase().includes(query) && !def.categoryName.toLowerCase().includes(query)) {
        return map;
      }
      const list = map.get(def.categoryName) ?? [];
      list.push(def);
      map.set(def.categoryName, list);
      return map;
    }, new Map<string, typeof chartPatternScannerDefinitions>()),
  );

  const togglePattern = (id: string) => {
    const next = new Set(enabledSet);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChangeIds(chartPatternScannerDefinitions.map((d) => d.id).filter((dId) => next.has(dId)));
  };

  const toggleCategory = (defs: typeof chartPatternScannerDefinitions) => {
    const allChecked = defs.every((d) => enabledSet.has(d.id));
    const next = new Set(enabledSet);
    defs.forEach((d) => {
      if (allChecked) {
        next.delete(d.id);
      } else {
        next.add(d.id);
      }
    });
    onChangeIds(chartPatternScannerDefinitions.map((d) => d.id).filter((dId) => next.has(dId)));
  };

  return (
    <div
      role="dialog"
      aria-label="Chart Patterns Settings"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        background: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          maxWidth: '94vw',
          maxHeight: '82vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg2)',
          border: '1px solid var(--border2)',
          borderRadius: 6,
          boxShadow: 'var(--shadow-lg)',
          color: 'var(--text)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg3)',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            Toolbar Chart Patterns Settings ({enabledIds.length} / {chartPatternScannerDefinitions.length} enabled)
          </div>
          <button type="button" onClick={onClose} style={{ ...actionButtonStyle, minWidth: 24, padding: '0 6px' }}>
            ✕
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderBottom: '1px solid var(--border)',
            flexWrap: 'wrap',
          }}
        >
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter chart patterns..."
            style={{
              flex: 1,
              minWidth: 160,
              height: 26,
              padding: '0 8px',
              borderRadius: 4,
              border: '1px solid var(--border2)',
              background: 'var(--bg3)',
              color: 'var(--text)',
              fontSize: 12,
            }}
          />
          <button
            type="button"
            style={actionButtonStyle}
            onClick={() => onChangeIds(DEFAULT_TOOLBAR_CHART_PATTERN_IDS, true)}
            title="Restore default 40 confirmed macro patterns"
          >
            Default Macro ({DEFAULT_TOOLBAR_CHART_PATTERN_IDS.length})
          </button>
          <button
            type="button"
            style={actionButtonStyle}
            onClick={() => onChangeIds(chartPatternScannerDefinitions.map((d) => d.id))}
          >
            Select All ({chartPatternScannerDefinitions.length})
          </button>
          <button type="button" style={actionButtonStyle} onClick={() => onChangeIds([])}>
            Clear All
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'grid', gap: 12 }}>
          {categories.map(([categoryName, defs]) => {
            const checkedCount = defs.filter((d) => enabledSet.has(d.id)).length;
            const allChecked = checkedCount === defs.length && defs.length > 0;
            return (
              <div
                key={categoryName}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 5,
                  padding: '8px 10px',
                  background: 'var(--bg3)',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontWeight: 700,
                    fontSize: 12,
                    marginBottom: 8,
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={() => toggleCategory(defs)}
                    />
                    {categoryName}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 500 }}>
                    {checkedCount} / {defs.length}
                  </span>
                </label>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '5px 10px',
                  }}
                >
                  {defs.map((def) => {
                    const checked = enabledSet.has(def.id);
                    const dir = def.chartPattern?.signalDirection ?? 'neutral';
                    const badgeColor =
                      dir === 'bullish' ? '#20d18b' : dir === 'bearish' ? '#ff5757' : '#f0c34e';
                    return (
                      <label
                        key={def.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          fontSize: 11.5,
                          padding: '3px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          background: checked ? 'var(--accent-soft)' : 'transparent',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePattern(def.id)}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {def.name}
                          </span>
                        </span>
                        <span style={{ fontSize: 10, color: badgeColor, fontWeight: 600, flexShrink: 0 }}>
                          {dir === 'bullish' ? 'Bull' : dir === 'bearish' ? 'Bear' : 'Neut'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg3)',
          }}
        >
          <button type="button" style={actionButtonStyle} onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            style={{ ...activeActionButtonStyle, minWidth: 120 }}
            disabled={enabledIds.length === 0}
            onClick={onScanNow}
          >
            Scan Active Chart
          </button>
        </div>
      </div>
    </div>
  );
}

function selectBestChartPatternResult(results: ScannerResult[], bars?: EodBar[]): ScannerResult | null {
  const candidates = results.filter(isDrawableBoundaryPattern);
  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    // 1. Recency bonus: active patterns on recent bars (within last 30 bars of data) should ALWAYS win over patterns from months ago
    if (bars && bars.length > 0) {
      const recentDates = new Set(bars.slice(-30).map((bar) => bar.date));
      const aIsRecent = recentDates.has(a.date);
      const bIsRecent = recentDates.has(b.date);
      if (bIsRecent && !aIsRecent) return 1;
      if (aIsRecent && !bIsRecent) return -1;
    }

    // 2. Sort by date descending (most recent first)
    const dateDelta = b.date.localeCompare(a.date);
    if (dateDelta !== 0) return dateDelta;

    // 3. Geometry completeness
    const geometryDelta = getChartPatternGeometryRank(b) - getChartPatternGeometryRank(a);
    if (geometryDelta !== 0) return geometryDelta;

    // 4. Score
    return (b.score ?? 0) - (a.score ?? 0);
  })[0] ?? null;
}

function isDrawableBoundaryPattern(result: ScannerResult): boolean {
  const geo = result.chartPattern?.geometry;
  if (!geo) return false;
  if (geo.family === 'head-and-shoulders' || geo.family === 'complex-head-and-shoulders') return true;
  if ((geo.trendLines?.length ?? 0) >= 1) return true;
  if ((geo.zones?.length ?? 0) >= 1) return true;
  return false;
}

function getChartPatternGeometryRank(result: ScannerResult): number {
  const geometry = result.chartPattern?.geometry;
  if (!geometry) return 0;

  const trendLineCount = geometry.trendLines?.length ?? 0;
  const pivotMarkerCount = geometry.pivotMarkers?.length ?? 0;
  const zoneCount = geometry.zones?.length ?? 0;
  if (trendLineCount >= 2) return 4;
  if (trendLineCount === 1 && pivotMarkerCount > 0) return 3;
  if (trendLineCount === 1) return 2;
  if (pivotMarkerCount > 0 || zoneCount > 0) return 1;
  return 0;
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

const CHART_TYPE_OPTIONS: Array<{ value: ChartType; label: string }> = [
  { value: 'candles', label: 'Candles' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'bar', label: 'Bar (OHLC)' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'hlcArea', label: 'HLC Area' },
  { value: 'heikinAshi', label: 'Heikin Ashi' },
  { value: 'renko', label: 'Renko' },
];

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px',
  minHeight: 32,
  borderTop: '1px solid var(--border)',
  background: 'transparent',
  flexWrap: 'nowrap',
  position: 'relative',
};

const toolbarControlsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: 1,
  minWidth: 0,
  flexWrap: 'nowrap',
  justifyContent: 'flex-start',
  overflowX: 'auto',
};

const screenshotControlStyle: React.CSSProperties = {
  position: 'relative',
  marginLeft: 'auto',
  flex: '0 0 auto',
  zIndex: 14,
};

const screenshotButtonStyle = (open: boolean): React.CSSProperties => ({
  ...actionButtonStyle,
  height: 24,
  minWidth: 28,
  padding: '0 6px',
  fontSize: 13,
  borderColor: open ? 'var(--accent)' : 'var(--border2)',
  background: open ? 'var(--accent-soft)' : 'var(--bg3)',
});

const screenshotMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 30,
  right: 0,
  minWidth: 120,
  display: 'grid',
  gap: 2,
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 5,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const screenshotMenuItemStyle: React.CSSProperties = {
  border: 0,
  borderRadius: 3,
  padding: '6px 8px',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 11,
  textAlign: 'left',
};

const toolbarClusterStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  padding: '2px 4px',
  borderRadius: 'var(--control-radius)',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

const actionButtonStyle: React.CSSProperties = {
  height: 24,
  minWidth: 24,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 'calc(var(--control-radius) - 1px)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  lineHeight: '22px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'background 0.15s, border-color 0.15s, color 0.15s',
};

const activeActionButtonStyle: React.CSSProperties = {
  ...actionButtonStyle,
  border: '1px solid var(--accent)',
  background: 'var(--accent-soft)',
  color: 'var(--text)',
};

const toolbarSelectStyle: React.CSSProperties = {
  height: 24,
  minWidth: 86,
  padding: '0 20px 0 8px',
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text)',
  borderRadius: 'calc(var(--control-radius) - 1px)',
  fontSize: 11,
  fontWeight: 600,
  outline: 'none',
  cursor: 'pointer',
};
