import { getUiStoreState, type SettingsDialogSection } from '@/store/uiStore';
import type { DesktopShellApi } from '@/platform/types';
import type { ChartIndicator, ChartMarkerEventType, ChartType, DrawingTool } from '@/engine/types';

/**
 * Minimal chart store surface required by the menu command router.
 * This is intentionally a structural subset — the full ChartStoreState satisfies it.
 */
export interface MenuRouterChartHandle {
  createDatabaseInteractive(): Promise<void>;
  openDatabaseInteractive(): Promise<void>;
  closeDatabase(): Promise<void>;
  saveCurrentActiveDatabase(): Promise<void>;
  createChartTab(): void;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  setAdjustedMode(adjusted: boolean): void;
  toggleAdjustedMode(): void;
  setChartType(chartType: ChartType): void;
  toggleChartEventVisibility(eventType: ChartMarkerEventType): void;
  setIncludeDividendAdjustments(enabled: boolean): void;
  setIncludeRightsAdjustments(enabled: boolean): void;
  selectDrawing(id: string | null): void;
  toggleDrawingLock(): void;
  deleteSelectedDrawing(): void;
  clearDrawings(): void;
  removeLastDrawing(): void;
  setTimeframe(tf: 'D' | 'W' | 'M' | 'Q' | 'Y'): void;
  setLayoutMode(mode: 'single' | 'tile' | 'tile-h' | 'tile-v' | 'tile-grid'): void;
  addIndicator(kind: ChartIndicator['kind']): void;
  clearIndicators(): void;
  addToast(message: string, type?: 'info' | 'success' | 'warning' | 'error', title?: string): void;
  getActiveSelectedDrawingId(): string | null;
}

function isSettingsDialogSection(payload: unknown): payload is SettingsDialogSection {
  return (
    payload === 'profile' ||
    payload === 'general' ||
    payload === 'database-defaults' ||
    payload === 'chart-colors' ||
    payload === 'plugins' ||
    payload === 'maintenance'
  );
}

/**
 * Registers the native menu command bridge listener and routes each command
 * to the appropriate store or UI action.
 *
 * Extracted from chartStore.init() so that init() stays focused on bootstrap
 * sequencing rather than owning the full dispatch table.
 */
export function registerMenuCommandRouter(
  shellApi: DesktopShellApi,
  getHandle: () => MenuRouterChartHandle,
  afterDispatch?: () => void,
): void {
  shellApi.onMenuCommand((command, payload) => {
    const cs = getHandle();
    const ui = getUiStoreState();

    if (command === 'menu:createDatabaseInteractive') void cs.createDatabaseInteractive();
    if (command === 'menu:openDatabaseInteractive') void cs.openDatabaseInteractive();
    if (command === 'menu:closeDatabase') void cs.closeDatabase();
    if (command === 'menu:saveDatabase') void cs.saveCurrentActiveDatabase();
    if (command === 'menu:openRecentDatabases') ui.openRecentDatabasesDialog();
    if (command === 'menu:newChart') cs.createChartTab();
    if (command === 'menu:toggleSidebar') ui.toggleSidebar();
    if (command === 'menu:toggleOhlcvBar') ui.toggleOhlcvBar();
    if (command === 'menu:toggleStatusBar') ui.toggleStatusBar();
    if (command === 'menu:openCompareDialog') ui.openCompareDialog();
    if (command === 'menu:openCustomFormulaDialog') ui.openCustomFormulaDialog();
    if (command === 'menu:openScannerWindow') ui.openScannerWindow();
    if (command === 'menu:openAlertManager') ui.openAlertManager();
    if (command === 'menu:setAdjustedMode' && payload === 'raw') cs.setAdjustedMode(false);
    if (command === 'menu:setAdjustedMode' && payload === 'adjusted') cs.setAdjustedMode(true);
    if (command === 'menu:toggleAdjusted') cs.toggleAdjustedMode();
    if (command === 'menu:toggleDividendAdjustments') {
      cs.setIncludeDividendAdjustments(!cs.includeDividendAdjustments);
    }
    if (command === 'menu:toggleRightsAdjustments') {
      cs.setIncludeRightsAdjustments(!cs.includeRightsAdjustments);
    }
    if (
      command === 'menu:toggleChartEventVisibility' &&
      (
        payload === 'SPLIT' ||
        payload === 'BONUS' ||
        payload === 'DIVIDEND' ||
        payload === 'RIGHTS' ||
        payload === 'NAME_CHANGE' ||
        payload === 'SYMBOL_CHANGE'
      )
    ) {
      cs.toggleChartEventVisibility(payload as ChartMarkerEventType);
    }
    if (
      command === 'menu:setDrawingTool' &&
      (
        payload === 'cursor' ||
        payload === 'hline' ||
        payload === 'vline' ||
        payload === 'trendline' ||
        payload === 'ray' ||
        payload === 'arrow' ||
        payload === 'rect' ||
        payload === 'text' ||
        payload === 'channel' ||
        payload === 'fib' ||
        payload === 'gann'
      )
    ) {
      if (payload !== 'cursor') cs.selectDrawing(null);
      ui.setDrawingTool(payload as DrawingTool);
    }
    if (command === 'menu:toggleMagnet') ui.toggleMagnet();
    if (command === 'menu:openDrawingProperties') {
      ui.openDrawingProperties(cs.getActiveSelectedDrawingId());
    }
    if (command === 'menu:toggleDrawingLock') cs.toggleDrawingLock();
    if (command === 'menu:deleteSelectedDrawing') cs.deleteSelectedDrawing();
    if (command === 'menu:clearDrawings') cs.clearDrawings();
    if (command === 'menu:undoDrawing') cs.removeLastDrawing();
    if (command === 'menu:importCsv') ui.openImportDialog();
    if (command === 'menu:openWatchlistManager') ui.openWatchlistManagerDialog();
    if (command === 'menu:openOfficialWatchlistImport') ui.openOfficialWatchlistImportDialog();
    if (command === 'menu:openSettings') {
      ui.openSettingsDialog(isSettingsDialogSection(payload) ? payload : null);
    }
    if (command === 'menu:openBhavcopyWindow') ui.openBhavcopyWindow();
    if (command === 'menu:openDeleteDatabase') ui.openDeleteDatabaseDialog();
    if (command === 'menu:openLayoutManager') ui.openLayoutManagerDialog();
    if (command === 'menu:openBinaryParityAudit') ui.openBinaryEodParity();
    if (command === 'menu:openFaq') ui.openFaqDialog();
    if (command === 'menu:openKeyboardShortcuts') ui.openKeyboardShortcutsDialog();
    if (command === 'menu:about') ui.openAboutDialog();
    if (command === 'menu:openQuoteEditor') ui.openQuoteEditor();
    if (command === 'menu:openMergeSymbols') ui.openMergeSymbols();
    if (command === 'menu:openCorporateAction') ui.openCorporateAction();
    if (
      command === 'menu:setTimeframe' &&
      (payload === 'D' || payload === 'W' || payload === 'M' || payload === 'Q' || payload === 'Y')
    ) {
      cs.setTimeframe(payload);
    }
    if (
      command === 'menu:setLayoutMode' &&
      (
        payload === 'single' ||
        payload === 'tile' ||
        payload === 'tile-h' ||
        payload === 'tile-v' ||
        payload === 'tile-grid'
      )
    ) {
      cs.setLayoutMode(payload);
    }
    if (
      command === 'menu:addIndicator' &&
      (
        payload === 'SMA' ||
        payload === 'EMA' ||
        payload === 'WMA' ||
        payload === 'WEMA' ||
        payload === 'BOLL' ||
        payload === 'PSAR' ||
        payload === 'RSI' ||
        payload === 'MACD' ||
        payload === 'STOCH' ||
        payload === 'ROC' ||
        payload === 'CCI' ||
        payload === 'WILLR' ||
        payload === 'ATR' ||
        payload === 'ADX' ||
        payload === 'MFI' ||
        payload === 'OBV'
      )
    ) {
      cs.addIndicator(payload);
    }
    if (
      command === 'menu:setChartType' &&
      (
        payload === 'candles' ||
        payload === 'line' ||
        payload === 'area' ||
        payload === 'bar' ||
        payload === 'baseline' ||
        payload === 'hlcArea' ||
        payload === 'heikinAshi' ||
        payload === 'renko'
      )
    ) {
      cs.setChartType(payload as ChartType);
    }
    if (command === 'menu:clearIndicators') cs.clearIndicators();
    afterDispatch?.();
  });
}
