import { decodeBinaryEodBars } from './binaryEodDecoder';
import { ChartDataRequestSupersededError } from './chartRequestErrors';
import type {
  IdentityApplyProgress,
  AppSnapshot,
  DesktopApi,
  DownloadResult,
  EodDataInput,
  EodDataResult,
  DailyMarketSnapshotInput,
  DailyMarketSnapshotResult,
  DailyMarketSnapshotProgressEvent,
  DnnResearchDatasetExportProgressEvent,
  CancelDailyMarketSnapshotInput,
  CancelDailyMarketSnapshotResult,
  InstrumentSummary,
  QuoteDeleteProgressEvent,
  Watchlist,
} from './types';

interface TauriEvent<T> {
  payload: T;
}

interface ProgressEventPayload {
  progress?: number;
  message?: string;
}

let tauriDesktopApi: DesktopApi | null = null;
const MAX_EOD_IPC_CACHE_ENTRIES = 48;
const eodIpcCache = new Map<string, EodDataResult>();
const eodInFlightRequests = new Map<string, Promise<EodDataResult>>();
const eodRequestRevisions = new Map<string, number>();
let eodCacheGeneration = 0;

export function invalidateTauriEodDataCache(): void {
  eodCacheGeneration += 1;
  eodIpcCache.clear();
  eodInFlightRequests.clear();
  eodRequestRevisions.clear();
}

function buildEodCacheKey(input: EodDataInput): string {
  return [
    input.databasePath ?? '',
    (input.exchange ?? '').trim().toUpperCase(),
    (input.symbol ?? '').trim().toUpperCase(),
    input.from ?? '',
    input.to ?? '',
    input.adjusted === true ? '1' : '0',
    input.includeDividendAdjustments === true ? '1' : '0',
    input.includeRightsAdjustments === true ? '1' : '0',
    input.resolveIdentity !== false ? '1' : '0',
  ].join('|');
}

function hasTauriInternals(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);
}

async function getTauriCore() {
  return import('@tauri-apps/api/core');
}

async function getTauriEvent() {
  return import('@tauri-apps/api/event');
}

const MUTATING_EOD_COMMANDS = new Set(["create_database_interactive","open_database_interactive","activate_database_path","close_database","delete_database","upsert_quote","delete_quote","delete_quote_range","delete_quote_date","merge_symbols","apply_corporate_action","apply_nse_historical_identity_archive","apply_nse_current_universe_sync","apply_bse_current_universe_sync","approve_corporate_action_import","approve_corporate_action_import_with_isin_mismatch","approve_corporate_action_import_with_price_validation_exception","approve_corporate_action_imports","auto_approve_corporate_action_imports","approve_recommended_corporate_action_isin_mismatches","import_csv","undo_manual_import_recovery","download_bhavcopy","download_bhavcopy_batch","set_setting","set_price_storage_mode"]);

async function tauriInvoke<T>(command: string, payload?: Record<string, unknown>): Promise<T> {
  const { invoke } = await getTauriCore();
  const result = await invoke<T>(command, payload);
  // Selecting the default display mode changes no prices. Invalidating here
  // used to cancel the chart reads started by that same mode toggle.
  const savesDefaultPriceMode = command === 'set_setting'
    && (payload?.input as { key?: string } | undefined)?.key === 'default_price_mode';
  if (MUTATING_EOD_COMMANDS.has(command) && !savesDefaultPriceMode) {
    invalidateTauriEodDataCache();
  }
  return result;
}

function parseEventPayload<T>(event: TauriEvent<T> | T | unknown): T {
  if (event && typeof event === 'object' && 'payload' in event) {
    return (event as TauriEvent<T>).payload;
  }

  return event as T;
}

export function getTauriDesktopApi(): DesktopApi | null {
  if (!hasTauriInternals()) {
    return null;
  }

  if (tauriDesktopApi) {
    return tauriDesktopApi;
  }

  tauriDesktopApi = {
    getPriceStorageMode: async () => {
      return tauriInvoke<'hybrid' | 'binary'>('get_price_storage_mode');
    },
    getAppSnapshot: async (options) => {
      return tauriInvoke<AppSnapshot>('get_app_snapshot', { input: options ?? null });
    },
    getDbStats: async () => {
      return tauriInvoke('get_db_stats');
    },
    getAppProfileSettings: async () => {
      return tauriInvoke('get_app_profile_settings');
    },
    saveAppProfileSettings: async (input) => {
      return tauriInvoke<{ success: boolean }>('save_app_profile_settings', { input });
    },
    pickAppProfileDirectory: async () => {
      return tauriInvoke<string | null>('pick_app_profile_directory');
    },
    pickPluginDataFile: async (input) => {
      return tauriInvoke<string | null>('pick_plugin_data_file', { input });
    },
    pickPluginOutputDirectory: async (input) => {
      return tauriInvoke<string | null>('pick_plugin_output_directory', { input });
    },
    readPluginTextFile: async (input) => {
      return tauriInvoke('read_plugin_text_file', { input });
    },
    listExternalPlugins: async () => {
      return tauriInvoke('list_external_plugins');
    },
    readExternalPluginModule: async (input) => {
      return tauriInvoke('read_external_plugin_module', { input });
    },
    installExternalPluginPackage: async () => {
      return tauriInvoke('install_external_plugin_package');
    },
    uninstallExternalPlugin: async (input) => {
      return tauriInvoke('uninstall_external_plugin', { input });
    },
    exportDnnResearchDataset: async (input) => {
      return tauriInvoke('export_dnn_research_dataset', { input });
    },
    saveTextExport: async (input) => {
      return tauriInvoke('save_text_export', { input });
    },
    saveChartImage: async (input) => {
      return tauriInvoke('save_chart_image', { input });
    },
    createDatabaseInteractive: async (requestedMode) => {
      return tauriInvoke<AppSnapshot>('create_database_interactive', { requestedMode: requestedMode ?? null });
    },
    openDatabaseInteractive: async () => {
      return tauriInvoke<AppSnapshot>('open_database_interactive');
    },
    activateDatabasePath: async (filePath: string) => {
      return tauriInvoke<AppSnapshot>('activate_database_path', { input: { filePath } });
    },
    closeDatabase: async () => {
      return tauriInvoke<AppSnapshot>('close_database');
    },
    removeRecentDatabase: async (filePath: string) => {
      return tauriInvoke<AppSnapshot>('remove_recent_database', { input: { filePath } });
    },
    deleteDatabase: async (filePath: string) => {
      return tauriInvoke<AppSnapshot>('delete_database', { input: { filePath } });
    },
    searchSymbols: async (input) => {
      return tauriInvoke<InstrumentSummary[]>('search_symbols', { input });
    },
    listSymbols: async (input) => {
      return tauriInvoke<InstrumentSummary[]>('list_symbols', { input: input ?? null });
    },
    getEodData: async (input: EodDataInput) => {
      const key = buildEodCacheKey(input);
      const { databasePath: _databasePath, forceReload, ...backendInput } = input;
      if (forceReload) {
        eodRequestRevisions.set(key, (eodRequestRevisions.get(key) ?? 0) + 1);
        eodIpcCache.delete(key);
        eodInFlightRequests.delete(key);
      }
      const generation = eodCacheGeneration;
      const revision = eodRequestRevisions.get(key) ?? 0;
      const cached = forceReload ? undefined : eodIpcCache.get(key);
      if (cached) {
        eodIpcCache.delete(key);
        eodIpcCache.set(key, cached);
        return cached;
      }
      const inFlight = forceReload ? undefined : eodInFlightRequests.get(key);
      if (inFlight) {
        return inFlight;
      }
      const requestPromise = tauriInvoke<EodDataResult & { barCount?: number; barsB64?: string }>('get_eod_data_binary', { input: backendInput })
        .then((raw) => {
          if (typeof raw.barsB64 !== 'string' && !Array.isArray(raw.bars)) {
            throw new Error('Missing chart data payload.');
          }
          return {
            requestedSymbol: raw.requestedSymbol,
            requestedExchange: raw.requestedExchange,
            adjusted: raw.adjusted,
            includeDividendAdjustments: raw.includeDividendAdjustments,
            includeRightsAdjustments: raw.includeRightsAdjustments,
            instrument: raw.instrument,
            bars: typeof raw.barsB64 === 'string' ? decodeBinaryEodBars(raw.barsB64, raw.barCount ?? 0) : (raw.bars ?? []),
            events: raw.events ?? [],
          };
        })
        .then((result) => {
          if (generation !== eodCacheGeneration || revision !== (eodRequestRevisions.get(key) ?? 0)) {
            throw new ChartDataRequestSupersededError();
          }
          if (eodIpcCache.size >= MAX_EOD_IPC_CACHE_ENTRIES) {
            const oldestKey = eodIpcCache.keys().next().value;
            if (oldestKey !== undefined) {
              eodIpcCache.delete(oldestKey);
            }
          }
          eodIpcCache.set(key, result);
          return result;
        })
        .finally(() => {
          if (eodInFlightRequests.get(key) === requestPromise) {
            eodInFlightRequests.delete(key);
          }
        });
      eodInFlightRequests.set(key, requestPromise);
      return requestPromise;
    },
    getDailyMarketSnapshot: async (input: DailyMarketSnapshotInput) => {
      return tauriInvoke<DailyMarketSnapshotResult>('get_daily_market_snapshot', { input });
    },
    cancelDailyMarketSnapshot: async (input: CancelDailyMarketSnapshotInput) => {
      return tauriInvoke<CancelDailyMarketSnapshotResult>('cancel_daily_market_snapshot', { input });
    },
    listQuotes: async (input) => {
      return tauriInvoke('list_quotes', { input });
    },
    listQuotesByDate: async (input) => {
      return tauriInvoke('list_quotes_by_date', { input });
    },
    upsertQuote: async (input) => {
      return tauriInvoke('upsert_quote', { input });
    },
    deleteQuote: async (input) => {
      return tauriInvoke('delete_quote', { input });
    },
    deleteQuoteRange: async (input) => {
      return tauriInvoke('delete_quote_range', { input });
    },
    deleteQuoteDate: async (input) => {
      return tauriInvoke('delete_quote_date', { input });
    },
    mergeSymbols: async (input) => {
      return tauriInvoke('merge_symbols', { input });
    },
    applyCorporateAction: async (input) => {
      return tauriInvoke('apply_corporate_action', { input });
    },
    previewNseHistoricalIdentityArchive: async (input) => {
      return tauriInvoke('preview_nse_historical_identity_archive', { input });
    },
    applyNseHistoricalIdentityArchive: async (input, onProgress) => {
      const operationId = crypto.randomUUID();
      let unlisten: (() => void) | undefined;
      try {
        if (onProgress) {
          const { listen } = await getTauriEvent();
          unlisten = await listen<{ operationId: string; progress: IdentityApplyProgress }>('identity:historical-progress', event => {
            if (event.payload.operationId === operationId) onProgress(event.payload.progress);
          });
        }
        return await tauriInvoke('apply_nse_historical_identity_archive', { input, operationId });
      } finally { try { unlisten?.(); } catch { /* Do not mask a committed Apply. */ } }
    },
    listNseHistoricalIdentityApplyHistory: async () => tauriInvoke('list_nse_historical_identity_apply_history'),
    getNseHistoricalIdentityApplyReport: async (runId) => tauriInvoke('get_nse_historical_identity_apply_report', { runId }),
    downloadNseDelistedWorkbook: async () => {
      return tauriInvoke('download_nse_delisted_workbook');
    },
    downloadNseCurrentUniverseMaster: async () => {
      return tauriInvoke('download_nse_current_universe_master');
    },
    previewNseCurrentUniverseSync: async (input) => {
      return tauriInvoke('preview_nse_current_universe_sync', { input });
    },
    applyNseCurrentUniverseSync: async (input, onProgress) => {
      const operationId = crypto.randomUUID();
      let unlisten: (() => void) | undefined;
      try {
        if (onProgress) {
          const { listen } = await getTauriEvent();
          unlisten = await listen<{ operationId: string; progress: IdentityApplyProgress }>('identity:apply-progress', event => {
            if (event.payload.operationId === operationId) onProgress(event.payload.progress);
          });
        }
        return await tauriInvoke('apply_nse_current_universe_sync', { input, operationId, expectedDatabasePath: input.expectedDatabasePath });
      } finally {
        // Listener cleanup must not turn a committed result into an apply error.
        try { unlisten?.(); } catch { /* Best-effort event cleanup. */ }
      }
    },
    listNseIdentityApplyHistory: async () => tauriInvoke('list_nse_identity_apply_history'),
    downloadBseCurrentUniverseMaster: async () => {
      return tauriInvoke('download_bse_current_universe_master');
    },
    previewBseCurrentUniverseSync: async (input) => {
      return tauriInvoke('preview_bse_current_universe_sync', { input });
    },
    applyBseCurrentUniverseSync: async (input, onProgress) => {
      const operationId = crypto.randomUUID();
      let unlisten: (() => void) | undefined;
      try {
        if (onProgress) {
          const { listen } = await getTauriEvent();
          unlisten = await listen<{ operationId: string; progress: IdentityApplyProgress }>('identity:apply-progress', event => {
            if (event.payload.operationId === operationId) onProgress(event.payload.progress);
          });
        }
        return await tauriInvoke('apply_bse_current_universe_sync', { input, operationId });
      } finally { try { unlisten?.(); } catch { /* Preserve a committed result. */ } }
    },
    listBseIdentityApplyHistory: async () => tauriInvoke('list_bse_identity_apply_history'),
    refreshBseNameHistory: async () => tauriInvoke('refresh_bse_name_history'),
    previewBseNameHistory: async input => tauriInvoke('preview_bse_name_history', { input }),
    applyBseNameHistory: async (input, onProgress) => {
      const operationId = crypto.randomUUID();
      let unlisten: (() => void) | undefined;
      try {
        if (onProgress) {
          const { listen } = await getTauriEvent();
          unlisten = await listen<{ operationId: string; progress: IdentityApplyProgress }>('identity:apply-progress', event => {
            if (event.payload.operationId === operationId) onProgress(event.payload.progress);
          });
        }
        return await tauriInvoke('apply_bse_name_history', { input, operationId });
      } finally { try { unlisten?.(); } catch { /* Preserve the committed result. */ } }
    },
    listBseNameHistoryRuns: async () => tauriInvoke('list_bse_name_history_runs'),
    getBseNameHistoryReport: async runId => tauriInvoke('get_bse_name_history_report', { runId }),
    assessIdentityOfficialSourceHealth: async () => {
      return tauriInvoke('assess_identity_official_source_health');
    },
    getOfficialSourceConfigurationAuthority: async () => {
      return tauriInvoke('get_official_source_configuration_authority');
    },
    saveOfficialSourceUrlsReviewed: async (input) => {
      return tauriInvoke('save_official_source_urls_reviewed', { input });
    },
    findOfficialSourceReplacementCandidates: async (input) => {
      return tauriInvoke('find_official_source_replacement_candidates', { input });
    },
    recordOfficialSourceCandidateDecision: async (input) => {
      return tauriInvoke('record_official_source_candidate_decision', { input });
    },
    promoteOfficialSourceCandidateReviewed: async (input) => {
      return tauriInvoke('promote_official_source_candidate_reviewed', { input });
    },
    createOfficialSourceRollbackReview: async (input) => {
      return tauriInvoke('create_official_source_rollback_review', { input });
    },
    applyOfficialSourceRollbackReviewed: async (input) => {
      return tauriInvoke('apply_official_source_rollback_reviewed', { input });
    },
    retryOfficialSourcePostHealth: async (input) => {
      return tauriInvoke('retry_official_source_post_health', { input });
    },
    listOfficialSourceHistory: async (input) => {
      return tauriInvoke('list_official_source_history', { input });
    },
    importCorporateActionsCsv: async (input) => {
      return tauriInvoke('import_corporate_actions_csv', { input });
    },
    fetchOfficialCorporateActions: async (input) => {
      return tauriInvoke('fetch_official_corporate_actions', { input });
    },
    cancelOfficialCorporateActionFetch: async () => {
      return tauriInvoke('cancel_official_corporate_action_fetch');
    },
    backfillHistoricalCapitalActionsForSymbol: async (input) => {
      return tauriInvoke('backfill_historical_capital_actions_for_symbol', { input });
    },
    backfillHistoricalCapitalActionsBatch: async (input) => {
      return tauriInvoke('backfill_historical_capital_actions_batch', { input });
    },
    listHistoricalCapitalActionBackfillRuns: async (input) => {
      return tauriInvoke('list_historical_capital_action_backfill_runs', { input: input ?? null });
    },
    listHistoricalCapitalActionSparseCandidates: async (input) => {
      return tauriInvoke('list_historical_capital_action_sparse_candidates', { input: input ?? null });
    },
    listHistoricalCapitalActionAliasCandidates: async (input) => {
      return tauriInvoke('list_historical_capital_action_alias_candidates', { input: input ?? null });
    },
    listHistoricalCapitalActionMajorLiquidCandidates: async (input) => {
      return tauriInvoke('list_historical_capital_action_major_liquid_candidates', { input: input ?? null });
    },
    listCorporateActionImports: async (input) => {
      return tauriInvoke('list_corporate_action_imports', { input: input ?? null });
    },
    getCorporateActionImportsByIds: async (input) => {
      return tauriInvoke('get_corporate_action_imports_by_ids', { input });
    },
    refreshCorporateActionImportClassifications: async (input) => {
      return tauriInvoke('refresh_corporate_action_import_classifications', { input });
    },
    listCorporateActionEventIdentities: async (input) => {
      return tauriInvoke('list_corporate_action_event_identities', { input });
    },
    previewSplitBonusReconciliation: async (input) => {
      return tauriInvoke('preview_split_bonus_reconciliation', { input });
    },
    previewCorporateActionRepairs: async (input) => {
      return tauriInvoke('preview_corporate_action_repairs', { input });
    },
    approveCorporateActionImport: async (input) => {
      return tauriInvoke('approve_corporate_action_import', { input });
    },
    approveCorporateActionImportWithIsinMismatch: async (input) => {
      return tauriInvoke('approve_corporate_action_import_with_isin_mismatch', { input });
    },
    approveCorporateActionImportWithPriceValidationException: async (input) => {
      return tauriInvoke('approve_corporate_action_import_with_price_validation_exception', { input });
    },
    approveCorporateActionImports: async (input) => {
      return tauriInvoke('approve_corporate_action_imports', { input });
    },
    autoApproveCorporateActionImports: async (input) => {
      return tauriInvoke('auto_approve_corporate_action_imports', { input });
    },
    evaluateSimpleCashDividendPreparedScope: async (input) => {
      return tauriInvoke('evaluate_simple_cash_dividend_prepared_scope', { input });
    },
    executeSimpleCashDividendWriteStage: async (input) => {
      return tauriInvoke('execute_simple_cash_dividend_write_stage', { input });
    },
    saveCorporateActionValidationReport: async (input) => {
      return tauriInvoke('save_corporate_action_validation_report', { input });
    },
    listCorporateActionActivityRuns: async (input) => {
      return tauriInvoke('list_corporate_action_activity_runs', { input: input ?? null });
    },
    listCorporateActionValidationReportItems: async (input) => {
      return tauriInvoke('list_corporate_action_validation_report_items', { input });
    },
    approveRecommendedCorporateActionIsinMismatches: async (input) => {
      return tauriInvoke('approve_recommended_corporate_action_isin_mismatches', { input });
    },
    recheckCorporateActionImports: async (input) => {
      return tauriInvoke('recheck_corporate_action_imports', { input });
    },
    listCorporateActionImportResolutionHints: async (input) => {
      return tauriInvoke('list_corporate_action_import_resolution_hints', { input });
    },
    listCorporateActionImportResolutionSuggestions: async (input) => {
      return tauriInvoke('list_corporate_action_import_resolution_suggestions', { input });
    },
    quickResolveCorporateActionImport: async (input) => {
      return tauriInvoke('quick_resolve_corporate_action_import', { input });
    },
    resolveCorporateActionImport: async (input) => {
      return tauriInvoke('resolve_corporate_action_import', { input });
    },
    runCorporateActionScan: async (input) => {
      return tauriInvoke('run_corporate_action_scan', { input: input ?? null });
    },
    listCorporateActionScanResults: async (input) => {
      return tauriInvoke('list_corporate_action_scan_results', { input: input ?? null });
    },
    getWatchlists: async () => {
      return tauriInvoke<Watchlist[]>('get_watchlists');
    },
    createWatchlist: async (input) => {
      return tauriInvoke<Watchlist>('create_watchlist', { input });
    },
    renameWatchlist: async (input) => {
      return tauriInvoke<Watchlist>('rename_watchlist', { input });
    },
    deleteWatchlist: async (input) => {
      return tauriInvoke<{ success: boolean }>('delete_watchlist', { input });
    },
    addToWatchlist: async (input) => {
      return tauriInvoke<{ success: boolean }>('add_to_watchlist', { input });
    },
    removeFromWatchlist: async (input) => {
      return tauriInvoke<{ success: boolean }>('remove_from_watchlist', { input });
    },
    applyOfficialWatchlistUpdate: async (input) => {
      return tauriInvoke<{ success: boolean }>('apply_official_watchlist_update', { input });
    },
    replaceSourceLinkedWatchlist: async (input) => {
      return tauriInvoke<{ success: boolean }>('replace_source_linked_watchlist', { input });
    },
    fetchOfficialWatchlistSource: async (input) => {
      return tauriInvoke<string>('fetch_official_watchlist_source', { input });
    },
    pickCsvFiles: async () => {
      return tauriInvoke<string[]>('pick_csv_files');
    },
    previewCsv: async (filePath: string) => {
      return tauriInvoke('preview_csv', { filePath });
    },
    importCsv: async (input) => {
      return tauriInvoke('import_csv', { input });
    },
    getLatestManualImportRecovery: async () => {
      return tauriInvoke('get_latest_manual_import_recovery');
    },
    listManualImportRecoveryHistory: async () => {
      return tauriInvoke('list_manual_import_recovery_history');
    },
    undoManualImportRecovery: async (input) => {
      return tauriInvoke('undo_manual_import_recovery', { input });
    },
    downloadBhavcopy: async (date?: string) => {
      return tauriInvoke('download_bhavcopy', date ? { date } : undefined);
    },
    downloadBhavcopyBatch: async (config) => {
      return tauriInvoke('download_bhavcopy_batch', { config });
    },
    downloadBsePriceHistory: async (input) => {
      return tauriInvoke('download_bse_price_history', { input });
    },
    cancelBsePriceHistoryDownload: async () => {
      return tauriInvoke('cancel_bse_price_history_download');
    },
    getBhavcopySettings: async () => {
      return tauriInvoke('get_bhavcopy_settings');
    },
    saveBhavcopySettings: async (settings) => {
      return tauriInvoke('save_bhavcopy_settings', { settings });
    },
    getBhavcopyDefaultTemplates: async () => {
      return tauriInvoke('get_bhavcopy_default_templates');
    },
    listMarketHolidays: async () => {
      return tauriInvoke('list_market_holidays');
    },
    listOfficialExchangeHolidaySnapshots: async (year: number) => {
      return tauriInvoke('list_official_exchange_holiday_snapshots', { year });
    },
    previewOfficialExchangeHolidays: async (year: number) => {
      return tauriInvoke('preview_official_exchange_holidays', { year });
    },
    applyOfficialExchangeHolidays: async (token: string, exchanges: string[]) => {
      return tauriInvoke('apply_official_exchange_holidays', { token, exchanges });
    },
    addMarketHoliday: async (date: string, name: string) => {
      return tauriInvoke('add_market_holiday', { date, name });
    },
    deleteMarketHoliday: async (id: number) => {
      return tauriInvoke('delete_market_holiday', { id });
    },
    getSavedLayouts: async () => {
      return tauriInvoke<Array<{ name: string; timestamp: string }>>('get_saved_layouts');
    },
    saveLayout: async (name: string, layoutData: string) => {
      return tauriInvoke<{ success: boolean }>('save_layout', { input: { name, layoutData } });
    },
    loadLayout: async (name: string) => {
      return tauriInvoke<string | null>('load_layout', { input: { name } });
    },
    deleteLayout: async (name: string) => {
      return tauriInvoke<{ success: boolean }>('delete_layout', { input: { name } });
    },
    getSetting: async (key: string) => {
      return tauriInvoke<string | null>('get_setting', { input: { key } });
    },
    setSetting: async (input) => {
      return tauriInvoke<{ success: boolean }>('set_setting', { input });
    },
    validateBinaryParity: async (input) => {
      return tauriInvoke('validate_binary_parity', input as unknown as Record<string, unknown>);
    },
    onImportProgress: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<ProgressEventPayload> | ProgressEventPayload>('import:progress', (event) => {
            const payload = parseEventPayload<ProgressEventPayload>(event);
            callback(payload.progress ?? 0, payload.message ?? '');
          }),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onQuoteDeleteProgress: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<QuoteDeleteProgressEvent> | QuoteDeleteProgressEvent>(
            'quote-delete:progress',
            (event) => {
              callback(parseEventPayload<QuoteDeleteProgressEvent>(event));
            },
          ),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onCorporateActionProgress: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<ProgressEventPayload> | ProgressEventPayload>(
            'corporate-actions:progress',
            (event) => {
              const payload = parseEventPayload<ProgressEventPayload>(event);
              callback(payload.progress ?? 0, payload.message ?? '');
            },
          ),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onDownloadProgress: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<ProgressEventPayload> | ProgressEventPayload>(
            'bhavcopy:progress',
            (event) => {
              const payload = parseEventPayload<ProgressEventPayload>(event);
              callback(payload.progress ?? 0, payload.message ?? '');
            },
          ),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onDownloadResult: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<unknown> | unknown>('bhavcopy:result', (event) => {
            const payload = parseEventPayload<unknown>(event);
            callback(payload as DownloadResult);
          }),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onDailyMarketSnapshotProgress: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<DailyMarketSnapshotProgressEvent> | DailyMarketSnapshotProgressEvent>(
            'daily-market-snapshot:progress',
            (event) => {
              callback(parseEventPayload<DailyMarketSnapshotProgressEvent>(event));
            },
          ),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onDnnResearchExportProgress: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<DnnResearchDatasetExportProgressEvent> | DnnResearchDatasetExportProgressEvent>(
            'dnn-research-export:progress',
            (event) => {
              callback(parseEventPayload<DnnResearchDatasetExportProgressEvent>(event));
            },
          ),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
    onDatabaseChanged: (callback) => {
      let unlisten: (() => void) | null = null;
      let disposed = false;

      void getTauriEvent()
        .then(({ listen }) =>
          listen<TauriEvent<unknown> | unknown>('db:changed', (event) => {
            invalidateTauriEodDataCache();
            const payload = parseEventPayload<unknown>(event);
            callback(payload as AppSnapshot);
          }),
        )
        .then((nextUnlisten) => {
          if (disposed) {
            nextUnlisten();
            return;
          }
          unlisten = nextUnlisten;
        })
        .catch(() => {
          // Leave an inert unsubscribe when listener setup fails.
        });

      return () => {
        disposed = true;
        if (unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
  };

  return tauriDesktopApi;
}
