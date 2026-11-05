import { lazy, useEffect, useState } from 'react';
import { ChartCanvas } from '@/components/ChartCanvas';
import { TileHeader } from '@/components/TileHeader';
import { ChartToolDock } from '@/components/ChartToolDock';
import { ChartTabs } from '@/components/ChartTabs';
import { SheetTabs } from '@/components/SheetTabs';
import { CommandPalette } from '@/components/CommandPalette';
import { ToastContainer } from '@/components/ToastContainer';
import { Sidebar } from '@/components/Sidebar';
import { StatusBar } from '@/components/StatusBar';
import { Toolbar } from '@/components/Toolbar';
import { WindowTray } from '@/components/WindowTray';
import { FavoriteToolsToolbar } from '@/components/FavoriteToolsToolbar';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useBhavcopyStore } from '@/store/bhavcopyStore';
import {
  readAppSettings,
  subscribeAppSettingsChanges,
  type AppSettings,
} from '@/features/app/appSettingsService';
import { applyAppTheme } from '@/features/app/themeService';

const LazyDatabaseToolsDialogs = lazy(async () => ({
  default: (await import('@/components/DatabaseToolsDialogs')).DatabaseToolsDialogs,
}));

const LazyImportCsvDialog = lazy(async () => ({
  default: (await import('@/components/ImportCsvDialog')).ImportCsvDialog,
}));

const LazyOfficialWatchlistImportDialog = lazy(async () => ({
  default: (await import('@/components/OfficialWatchlistImportDialog')).OfficialWatchlistImportDialog,
}));

const LazyBhavcopyDownloadWindow = lazy(async () => ({
  default: (await import('@/components/BhavcopyDownloadWindow')).BhavcopyDownloadWindow,
}));

const LazyScannerWindow = lazy(async () => ({
  default: (await import('@/components/ScannerWindow')).ScannerWindow,
}));

const LazyAlertManagerWindow = lazy(async () => ({
  default: (await import('@/components/AlertManagerWindow')).AlertManagerWindow,
}));

const LazyDeleteDatabaseDialog = lazy(async () => ({
  default: (await import('@/components/DeleteDatabaseDialog')).DeleteDatabaseDialog,
}));

const LazyRecentDatabasesDialog = lazy(async () => ({
  default: (await import('@/components/RecentDatabasesDialog')).RecentDatabasesDialog,
}));

const LazyLayoutManagerDialog = lazy(async () => ({
  default: (await import('@/components/LayoutManagerDialog')).LayoutManagerDialog,
}));

const LazyWatchlistManagerDialog = lazy(async () => ({
  default: (await import('@/components/WatchlistManagerDialog')).WatchlistManagerDialog,
}));

const LazyFAQDialog = lazy(async () => ({
  default: (await import('@/components/FAQDialog')).FAQDialog,
}));

const LazyKeyboardShortcutsDialog = lazy(async () => ({
  default: (await import('@/components/KeyboardShortcutsDialog')).KeyboardShortcutsDialog,
}));

const LazyAboutDialog = lazy(async () => ({
  default: (await import('@/components/AboutDialog')).AboutDialog,
}));

const LazyIndicatorPickerDialog = lazy(async () => ({
  default: (await import('@/components/IndicatorPickerDialog')).IndicatorPickerDialog,
}));

import { SettingsDialog } from '@/components/SettingsDialog';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LazyToolBoundary } from '@/components/LazyToolBoundary';

export default function RootApp() {
  const init = useChartStore((state) => state.init);
  const uiFlags = useUiStore((state) => state.uiFlags);
  const setCurrentTheme = useUiStore((state) => state.setCurrentTheme);
  const setCustomChartColors = useUiStore((state) => state.setCustomChartColors);
  const importDialogOpen = useUiStore((state) => state.importDialog.open);
  const bhavcopyWindowOpen = useUiStore((state) => state.bhavcopyWindowOpen);
  const closeBhavcopyWindow = useUiStore((state) => state.closeBhavcopyWindow);
  const scannerWindowOpen = useUiStore((state) => state.scannerWindowOpen);
  const alertManagerOpen = useUiStore((state) => state.alertManagerOpen);
  const scannerChartOverlay = useUiStore((state) => state.scannerChartOverlay);
  const quoteEditorOpen = useUiStore((state) => state.quoteEditorOpen);
  const mergeSymbolsOpen = useUiStore((state) => state.mergeSymbolsOpen);
  const corporateActionOpen = useUiStore((state) => state.corporateActionOpen);
  const deleteDatabaseDialogOpen = useUiStore((state) => state.deleteDatabaseDialogOpen);
  const closeDeleteDatabaseDialog = useUiStore((state) => state.closeDeleteDatabaseDialog);
  const recentDatabasesDialogOpen = useUiStore((state) => state.recentDatabasesDialogOpen);
  const closeRecentDatabasesDialog = useUiStore((state) => state.closeRecentDatabasesDialog);
  const layoutManagerDialogOpen = useUiStore((state) => state.layoutManagerDialogOpen);
  const closeLayoutManagerDialog = useUiStore((state) => state.closeLayoutManagerDialog);
  const watchlistManagerDialogOpen = useUiStore((state) => state.watchlistManagerDialogOpen);
  const closeWatchlistManagerDialog = useUiStore((state) => state.closeWatchlistManagerDialog);
  const faqDialogOpen = useUiStore((state) => state.faqDialogOpen);
  const keyboardShortcutsDialogOpen = useUiStore((state) => state.keyboardShortcutsDialogOpen);
  const aboutDialogOpen = useUiStore((state) => state.aboutDialogOpen);
  const indicatorPickerOpen = useUiStore((state) => state.indicatorPickerOpen);
  const closeIndicatorPicker = useUiStore((state) => state.closeIndicatorPicker);
  const settingsDialogOpen = useUiStore((state) => state.settingsDialogOpen);
  const binaryEodParityOpen = useUiStore((state) => state.binaryEodParityOpen);
  const officialWatchlistImportDialogOpen = useUiStore(
    (state) => state.officialWatchlistImportDialog.open,
  );
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const activateChartTab = useChartStore((state) => state.activateChartTab);
  const isLoadingBars = useChartStore((state) => state.isLoadingBars);
  const sidebarWidth = useWorkspaceStore((state) => state.sidebarWidth);
  const setSidebarWidth = useWorkspaceStore((state) => state.setSidebarWidth);
  const sidebarCollapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useWorkspaceStore((state) => state.setSidebarCollapsed);
  const toggleSidebarCollapsed = useWorkspaceStore((state) => state.toggleSidebarCollapsed);
  const sidebarPinned = useWorkspaceStore((state) => state.sidebarPinned);
  const toggleSidebarPinned = useWorkspaceStore((state) => state.toggleSidebarPinned);
  const [initStatus, setInitStatus] = useState<'starting' | 'ready' | 'error'>('starting');
  const [initError, setInitError] = useState<string | null>(null);
  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);
  const layoutMode = activeTab?.layoutMode ?? 'single';
  const sidebarOpen = !sidebarCollapsed;
  const databaseToolsDialogOpen =
    quoteEditorOpen ||
    mergeSymbolsOpen ||
    corporateActionOpen ||
    binaryEodParityOpen;

  const initBhavcopyListeners = useBhavcopyStore((state) => state.initGlobalListeners);

  useEffect(() => {
    return initBhavcopyListeners();
  }, [initBhavcopyListeners]);

  useEffect(() => {
    let cancelled = false;

    const applyAppSettingsToUi = (settings: AppSettings) => {
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
    };

    const unsubscribe = subscribeAppSettingsChanges((settings) => {
      if (cancelled) {
        return;
      }
      applyAppSettingsToUi(settings);
    });

    void readAppSettings()
      .then((settings) => {
        if (cancelled) {
          return;
        }
        applyAppSettingsToUi(settings);
      })
      .catch(() => {
        // Keep the default in-memory theme if application-profile settings are unavailable.
      });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setCurrentTheme, setCustomChartColors]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setInitStatus('starting');
      setInitError(null);
      try {
        await init();
        if (!cancelled) {
          setInitStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          setInitStatus('error');
          setInitError(error instanceof Error ? error.message : 'App initialization failed.');
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [init]);

  const setTimeframe = useChartStore((state) => state.setTimeframe);
  const addToast = useChartStore((state) => state.addToast);

  useEffect(() => {
    const suppressContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || Boolean(target.closest('input, textarea, select, [contenteditable="true"]')))
      ) {
        return; // Preserve native Copy/Paste/Select All in editable controls.
      }
      event.preventDefault();
    };

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable ||
          target.closest?.('[role="dialog"] input, [role="dialog"] textarea'))
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key.toUpperCase();
      if (key === 'D') {
        e.preventDefault();
        setTimeframe('D');
      } else if (key === 'W') {
        e.preventDefault();
        setTimeframe('W');
      } else if (key === 'M') {
        e.preventDefault();
        setTimeframe('M');
      } else if (key === 'Q') {
        e.preventDefault();
        setTimeframe('Q');
      } else if (key === 'Y') {
        e.preventDefault();
        setTimeframe('Y');
      }
    };

    window.addEventListener('contextmenu', suppressContextMenu);
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('contextmenu', suppressContextMenu);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [setTimeframe, addToast]);

  const retryInit = () => {
    setInitStatus('starting');
    setInitError(null);
    void init()
      .then(() => {
        setInitStatus('ready');
      })
      .catch((error) => {
        setInitStatus('error');
        setInitError(error instanceof Error ? error.message : 'App initialization failed.');
      });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {uiFlags.sidebarVisible ? (
          <>
            <Sidebar
              width={sidebarWidth}
              collapsed={sidebarCollapsed}
              pinned={sidebarPinned}
              onToggleCollapse={toggleSidebarCollapsed}
              onTogglePin={toggleSidebarPinned}
            />
            {sidebarOpen ? (
              <div
                style={sidebarResizeHandleStyle}
                onMouseDown={(event) => {
                  event.preventDefault();
                  const startX = event.clientX;
                  const startWidth = sidebarWidth;
                  const onMove = (moveEvent: MouseEvent) => {
                    setSidebarWidth(startWidth + (moveEvent.clientX - startX));
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
                onDoubleClick={() => setSidebarCollapsed(true)}
                title="Drag to resize sidebar"
              />
            ) : null}
          </>
        ) : null}
        <main
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          onMouseDownCapture={() => {
            if (!sidebarPinned && sidebarOpen) {
              setSidebarCollapsed(true);
            }
          }}
        >
          <ChartTabs />
          <div style={chartChromeStyle}>
            <Toolbar />
          </div>
          <div style={chartWorkspaceShellStyle}>
            <div style={chartContentRowStyle}>
              <div style={chartContentColumnStyle}>
                {layoutMode !== 'single' ? (
                  <div style={getTileGridStyle(layoutMode)}>
                    {chartTabs.map((tab) => {
                      const isActive = tab.id === activeChartTabId;
                      return (
                        <div
                          key={tab.id}
                          style={tileCellStyle(isActive)}
                          onClickCapture={() => {
                            if (tab.id !== activeChartTabId) {
                              activateChartTab(tab.id);
                            }
                          }}
                        >
                          <TileHeader tab={tab} isActive={isActive} />
                          <ChartCanvas
                            tabId={tab.id}
                            instrument={tab.instrument ?? null}
                            instrumentMeta={tab.instrumentMeta ?? null}
                            bars={tab.displayBars ?? []}
                            chartType={tab.chartType ?? 'candles'}
                            renkoBrickSize={tab.renkoBrickSize}
                            renkoSettings={tab.renkoSettings}
                            visualSettings={tab.visualSettings}
                            events={tab.events ?? []}
                            compareOverlays={tab.compareOverlays ?? []}
                            overlays={tab.indicators ?? []}
                            drawings={tab.drawings ?? []}
                            selectedDrawingId={tab.selectedDrawingId ?? null}
                            indicatorPaneHeight={tab.indicatorPaneHeight ?? 104}
                            indicatorPaneHeights={tab.indicatorPaneHeights ?? {}}
                            collapsedIndicatorPanes={tab.collapsedIndicatorPanes ?? {}}
                            paneScaleOverrides={tab.paneScaleOverrides ?? {}}
                            viewport={tab.viewport ?? { startIndex: 0, endIndex: 0 }}
                            scannerChartOverlay={isScannerOverlayForTab(scannerChartOverlay, tab.instrument) ? scannerChartOverlay : null}
                            loading={isLoadingBars && tab.id === activeChartTabId}
                            bottomBarStartContent={<SheetTabs tabId={tab.id} inline />}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ChartCanvas
                    tabId={activeTab?.id ?? null}
                    instrument={activeTab?.instrument ?? null}
                    instrumentMeta={activeTab?.instrumentMeta ?? null}
                    bars={activeTab?.displayBars ?? []}
                    chartType={activeTab?.chartType ?? 'candles'}
                    renkoBrickSize={activeTab?.renkoBrickSize}
                    renkoSettings={activeTab?.renkoSettings}
                    visualSettings={activeTab?.visualSettings}
                    events={activeTab?.events ?? []}
                    compareOverlays={activeTab?.compareOverlays ?? []}
                    overlays={activeTab?.indicators ?? []}
                    drawings={activeTab?.drawings ?? []}
                    selectedDrawingId={activeTab?.selectedDrawingId ?? null}
                    indicatorPaneHeight={activeTab?.indicatorPaneHeight ?? 104}
                    indicatorPaneHeights={activeTab?.indicatorPaneHeights ?? {}}
                    collapsedIndicatorPanes={activeTab?.collapsedIndicatorPanes ?? {}}
                    paneScaleOverrides={activeTab?.paneScaleOverrides ?? {}}
                    viewport={activeTab?.viewport ?? { startIndex: 0, endIndex: 0 }}
                    scannerChartOverlay={isScannerOverlayForTab(scannerChartOverlay, activeTab?.instrument ?? null) ? scannerChartOverlay : null}
                    loading={isLoadingBars}
                    bottomBarStartContent={activeTab?.id ? <SheetTabs tabId={activeTab.id} inline /> : null}
                  />
                )}
              </div>
              <ChartToolDock />
            </div>
          </div>
        </main>
      </div>
      {uiFlags.statusBarVisible ? <StatusBar /> : null}
      {bhavcopyWindowOpen ? (
        <LazyToolBoundary name="Bhavcopy downloads">
          <LazyBhavcopyDownloadWindow onClose={closeBhavcopyWindow} />
        </LazyToolBoundary>
      ) : null}
      {scannerWindowOpen ? (
        <LazyToolBoundary name="Scanner">
          <LazyScannerWindow />
        </LazyToolBoundary>
      ) : null}
      {alertManagerOpen ? (
        <LazyToolBoundary name="Alert manager">
          <LazyAlertManagerWindow />
        </LazyToolBoundary>
      ) : null}
      {deleteDatabaseDialogOpen ? (
        <LazyToolBoundary name="Delete database">
          <LazyDeleteDatabaseDialog onClose={closeDeleteDatabaseDialog} />
        </LazyToolBoundary>
      ) : null}
      {recentDatabasesDialogOpen ? (
        <LazyToolBoundary name="Recent databases">
          <LazyRecentDatabasesDialog onClose={closeRecentDatabasesDialog} />
        </LazyToolBoundary>
      ) : null}
      {layoutManagerDialogOpen ? (
        <LazyToolBoundary name="Layout manager">
          <LazyLayoutManagerDialog onClose={closeLayoutManagerDialog} />
        </LazyToolBoundary>
      ) : null}
      {watchlistManagerDialogOpen ? (
        <LazyToolBoundary name="Watchlist manager">
          <LazyWatchlistManagerDialog onClose={closeWatchlistManagerDialog} />
        </LazyToolBoundary>
      ) : null}
      {faqDialogOpen ? (
        <LazyToolBoundary name="FAQ">
          <LazyFAQDialog />
        </LazyToolBoundary>
      ) : null}
      {keyboardShortcutsDialogOpen ? (
        <LazyToolBoundary name="Keyboard shortcuts">
          <LazyKeyboardShortcutsDialog />
        </LazyToolBoundary>
      ) : null}
      {aboutDialogOpen ? (
        <LazyToolBoundary name="About">
          <LazyAboutDialog />
        </LazyToolBoundary>
      ) : null}
      {settingsDialogOpen ? <SettingsDialog /> : null}
      <ErrorBoundary name="CommandPalette">
        <CommandPalette />
      </ErrorBoundary>
      {importDialogOpen ? (
        <LazyToolBoundary name="Import CSV">
          <LazyImportCsvDialog />
        </LazyToolBoundary>
      ) : null}
      {officialWatchlistImportDialogOpen ? (
        <LazyToolBoundary name="Official watchlist import">
          <LazyOfficialWatchlistImportDialog />
        </LazyToolBoundary>
      ) : null}
      
      
      {databaseToolsDialogOpen ? (
        <LazyToolBoundary name="Database tools">
          <LazyDatabaseToolsDialogs />
        </LazyToolBoundary>
      ) : null}
      {indicatorPickerOpen ? (
        <LazyToolBoundary name="Indicator picker">
          <LazyIndicatorPickerDialog onClose={closeIndicatorPicker} />
        </LazyToolBoundary>
      ) : null}
      <FavoriteToolsToolbar />
      <WindowTray />
      <ToastContainer />
      {initStatus !== 'ready' ? (
        <div style={initOverlayStyle}>
          <div style={initPanelStyle}>
            <div style={initTitleStyle}>{initStatus === 'error' ? 'Startup Error' : 'Starting EOD Chart'}</div>
            <div style={initBodyStyle}>
              {initStatus === 'error'
                ? initError ?? 'The app could not finish loading.'
                : 'Loading database state, workspace, and symbols...'}
            </div>
            {initStatus === 'error' ? (
              <div style={initButtonRowStyle}>
                <button type="button" style={initActionButtonStyle} onClick={() => window.location.reload()}>
                  Reload
                </button>
                <button
                  type="button"
                  style={{ ...initActionButtonStyle, borderColor: 'var(--accent)', color: 'var(--text)' }}
                  onClick={() => retryInit()}
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function isScannerOverlayForTab(
  overlay: ReturnType<typeof useUiStore.getState>['scannerChartOverlay'],
  instrument: { exchange: string; symbol: string } | null | undefined,
): boolean {
  return Boolean(
    overlay &&
      instrument &&
      overlay.instrument.exchange === instrument.exchange &&
      overlay.instrument.symbol === instrument.symbol,
  );
}

const sidebarResizeHandleStyle: React.CSSProperties = {
  width: 4,
  cursor: 'col-resize',
  background: 'linear-gradient(180deg, var(--accent-faint), var(--accent-soft), var(--accent-faint))',
  flex: '0 0 auto',
};

const chartWorkspaceShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  background: 'var(--workspace-bg)',
};

const chartContentRowStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
};

const chartContentColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
};

const tileGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))',
  gridAutoRows: '1fr',
  gap: 0,
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden',
  padding: 0,
};

function getTileGridStyle(mode: string): React.CSSProperties {
  const base = {
    display: 'grid' as const,
    gap: 0,
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    padding: 0,
  };
  switch (mode) {
    case 'tile-h':
      return { ...base, gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr' };
    case 'tile-v':
      return { ...base, gridTemplateColumns: '1fr', gridAutoRows: '1fr 1fr' };
    case 'tile-grid':
      return { ...base, gridTemplateColumns: '1fr 1fr', gridAutoRows: '1fr 1fr' };
    default:
      return { ...base, gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 1fr))', gridAutoRows: '1fr' };
  }
}

function tileCellStyle(isActive: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
    boxShadow: isActive ? 'inset 0 0 0 1px var(--accent-soft)' : 'none',
    background: 'var(--chart-bg)',
  };
}

const chartChromeStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  background:
    'var(--chrome-bg)',
  borderBottom: '1px solid var(--border)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
};

const initOverlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--overlay-bg)',
  zIndex: 30,
};

const initPanelStyle: React.CSSProperties = {
  width: 360,
  maxWidth: 'calc(100vw - 32px)',
  padding: 18,
  border: '1px solid var(--border2)',
  borderRadius: 8,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const initTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 10,
};

const initBodyStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.45,
};

const initButtonRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  marginTop: 16,
};

const initActionButtonStyle: React.CSSProperties = {
  minWidth: 86,
  height: 30,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
  color: 'var(--text)',
  cursor: 'pointer',
};
