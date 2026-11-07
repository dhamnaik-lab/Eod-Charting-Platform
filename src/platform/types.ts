import type { AppInfo, DesktopBridgeApi } from '@/types/desktop';

export type {
  IdentityApplyProgress,
  CorporateActionReconciliationPreflightInput, CorporateActionReconciliationPreflightResult,
  CorporateActionReconciliationPreflightRow, CorporateActionReconciliationBlocker,
  R1ACheckState, R1AOutcome, R1AEvidenceReference, R1ACandidate, R1ARepairPlanItem,
  AppInfo,
  AppProfileSettingsPayload,
  AppProfileSettingsSaveInput,
  AppSnapshot,
  BatchDownloadConfig,
  BhavcopyBatchStopReply,
  TrackedBhavcopyBatchResult,
  BseHistoryDownloadInput,
  BseHistoryDownloadSummary,
  BhavcopySettings,
  BhavcopyDefaultTemplates,
  ChartEventMarker,
  MarketHoliday,
  CorporateActionInput,
  CorporateActionCsvImportInput,
  CorporateActionCsvImportResult,
  HistoricalCapitalActionBackfillInput,
  HistoricalCapitalActionBackfillBatchInput,
  HistoricalCapitalActionBackfillBatchResult,
  HistoricalCapitalActionBackfillRunListInput,
  HistoricalCapitalActionBackfillRunListResult,
  HistoricalCapitalActionBackfillRunOutcomeRow,
  HistoricalCapitalActionBackfillRunRow,
  HistoricalCapitalActionBackfillResult,
  HistoricalCapitalActionAliasCandidate,
  HistoricalCapitalActionAliasCandidateInput,
  HistoricalCapitalActionAliasCandidateResult,
  HistoricalCapitalActionMajorLiquidCandidate,
  HistoricalCapitalActionMajorLiquidCandidateInput,
  HistoricalCapitalActionMajorLiquidCandidateResult,
  HistoricalCapitalActionSparseCandidate,
  HistoricalCapitalActionSparseCandidateInput,
  HistoricalCapitalActionSparseCandidateResult,
  CorporateActionOfficialFetchInput,
  CorporateActionOfficialFetchResult,
  CorporateActionImportActionType,
  CorporateActionEventIdentity,
  CorporateActionEventIdentityListInput,
  CorporateActionEventIdentityListResult,
  CorporateActionAutoApprovalDisposition,
  CorporateActionAutoApprovalInput,
  CorporateActionAutoApprovalResult,
  CorporateActionDividendPreparedScopeEvaluationDisposition,
  CorporateActionDividendPreparedScopeEvaluationDispositionCode,
  CorporateActionDividendPreparedScopeEvaluationEvidence,
  CorporateActionDividendPreparedScopeEvaluationInput,
  CorporateActionDividendPreparedScopeEvaluationResult,
  CorporateActionDividendWriteStageDisposition,
  CorporateActionDividendWriteStageDispositionCode,
  CorporateActionDividendWriteStageInput,
  CorporateActionDividendWriteStageResult,
  CorporateActionActivityOutcome,
  CorporateActionActivityRun,
  CorporateActionActivityRunListInput,
  CorporateActionActivityRunListResult,
  CorporateActionValidationReportItem,
  CorporateActionValidationReportItemInput,
  CorporateActionValidationReportItemListInput,
  CorporateActionValidationReportItemListResult,
  CorporateActionValidationReportSaveInput,
  CorporateActionValidationReportSaveResult,
  CorporateActionImportApprovalInput,
  CorporateActionImportApprovalResult,
  CorporateActionImportBulkApprovalInput,
  CorporateActionImportBulkApprovalResult,
  CorporateActionImportBulkApprovalError,
  CorporateActionImportBulkRecheckInput,
  CorporateActionImportBulkRecheckResult,
  CorporateActionImportBulkRecheckError,
  CorporateActionImportExceptionalApprovalInput,
  CorporateActionImportListInput,
  CorporateActionImportLookupInput,
  CorporateActionImportResolutionHint,
  CorporateActionImportResolutionHintsInput,
  CorporateActionImportResolutionHintsResult,
  CorporateActionImportResolutionSuggestion,
  CorporateActionImportResolutionSuggestionsInput,
  CorporateActionImportResolutionSuggestionsResult,
  CorporateActionImportQuickResolveInput,
  CorporateActionRepairCanonicalValues,
  CorporateActionRepairEvidenceRecord,
  CorporateActionRepairImportValues,
  CorporateActionRepairPreviewInput,
  CorporateActionRepairPreviewResult,
  CorporateActionRepairPreviewRow,
  CorporateActionRepairProposalRow,
  CorporateActionRepairSourceIdentity,
  CorporateActionImportResolveInput,
  CorporateActionImportResolveResult,
  CorporateActionImportRow,
  NseCurrentUniverseSyncInput,
  NseCurrentUniverseMasterDownloadResult,
  NseCurrentUniverseSyncPreviewRow,
  NseCurrentUniverseSyncResult,
  NseHistoricalIdentityPreviewInput,
  NseHistoricalIdentityApplyInput,
  NseHistoricalIdentityPreviewDisposition,
  NseHistoricalIdentityChangeType,
  NseHistoricalIdentityPreviewRow,
  NseHistoricalIdentityResult,
  CorporateActionResult,
  CorporateActionScanInput,
  CorporateActionScanListInput,
  CorporateActionScanResult,
  CorporateActionScanResultRow,
  CorporateActionScanRun,
  CorporateActionType,
  BseCurrentUniverseSyncInput,
  BseCurrentUniverseSyncPreviewRow,
  BseCurrentUniverseSyncResult,
  BseCurrentUniverseMasterDownloadResult,
  OfficialSourceCheckStatus,
  OfficialSourceDriftClass,
  OfficialSourceHealthResult,
  OfficialSourceHealthReport,
  OfficialSourceUrls,
  OfficialSourceAuthorityEntry,
  OfficialSourceConfigurationAuthority,
  ExpectedOfficialSourceRevision,
  SaveOfficialSourceUrlsReviewedInput,
  SaveOfficialSourceUrlsReviewedResult,
  OfficialSourceCandidateClassification,
  OfficialSourceCandidateReviewPlan,
  FindOfficialSourceReplacementCandidatesInput,
  OfficialSourceReplacementCandidatesResult,
  OfficialSourceCandidateDecision,
  RecordOfficialSourceCandidateDecisionInput,
  OfficialSourceCandidateDecisionResult,
  PromoteOfficialSourceCandidateReviewedInput,
  OfficialSourcePromotionResult,
  OfficialSourceRollbackReview,
  CreateOfficialSourceRollbackReviewInput,
  ApplyOfficialSourceRollbackReviewedInput,
  OfficialSourceRollbackResult,
  RetryOfficialSourcePostHealthInput,
  OfficialSourcePostHealthResult,
  OfficialSourceHistoryEntry,
  CsvPreview,
  DbStats,
  DownloadResult,
  DownloadMode,
  EodDataInput,
  EodDataResult,
  DailyMarketSnapshotInput,
  DailyMarketSnapshotResult,
  DailyMarketSnapshotSymbol,
  DailyMarketSnapshotFailure,
  DailyMarketSnapshotProgressEvent,
  CancelDailyMarketSnapshotInput,
  CancelDailyMarketSnapshotResult,
  EodRow,
  InstrumentKey,
  InstrumentSummary,
  SymbolExchangeFilter,
  SymbolSeriesFilter,
  MergeSymbolsInput,
  MergeSymbolsResult,
  OfficialWatchlistSourceFetchInput,
  OfficialWatchlistUpdateInput,
  ParityIssue,
  ParityIssueType,
  PluginDataFilePickerInput,
  PluginOutputDirectoryPickerInput,
  PluginTextFileReadInput,
  PluginTextFileReadResult,
  ExternalPluginPackageDescriptor,
  ExternalPluginModuleReadResult,
  DnnResearchDatasetExchange,
  DnnResearchDatasetExportInput,
  DnnResearchDatasetExportProgressEvent,
  DnnResearchDatasetExportResult,
  ImportOptions,
  ImportResult,
  ImportBinaryDiagnostics,
  ManualImportRecoverySummary,
  ManualImportUndoResult,
  SaveTextExportInput,
  SaveTextExportResult,
  SaveChartImageInput,
  SaveChartImageResult,
  QuoteInput,
  QuoteDeleteRangeInput,
  QuoteDateListInput,
  QuoteDeleteDateInput,
  QuoteDeleteProgressEvent,
  QuoteRow,
  SnapshotOptions,
  SourceLinkedWatchlistReplaceInput,
  ValidateBinaryParityInput,
  ValidationReport,
  Watchlist,
  WatchlistItem,
  WatchlistCreateInput,
  WatchlistDeleteInput,
  WatchlistRenameInput,
  WatchlistSourceExchange,
  WatchlistSourceGroupType,
  WatchlistSourceMeta,
  WatchlistSourceType,
} from '@/types/desktop';

export type DesktopRuntime = 'tauri';

export interface DesktopCapabilities {
  runtime: DesktopRuntime | null;
  hasBusinessBackend: boolean;
  hasAppInfo: boolean;
  hasExternalLinks: boolean;
  hasMenuCommandBridge: boolean;
}

export type NativeMenuTimeframe = 'D' | 'W' | 'M' | 'Q' | 'Y';
export type NativeMenuChartType =
  | 'candles'
  | 'line'
  | 'area'
  | 'bar'
  | 'baseline'
  | 'hlcArea'
  | 'heikinAshi'
  | 'renko';
export type NativeMenuLayoutMode = 'single' | 'tile' | 'tile-h' | 'tile-v' | 'tile-grid';

export interface NativeMenuState {
  timeframe: NativeMenuTimeframe;
  chartType: NativeMenuChartType;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  layoutMode: NativeMenuLayoutMode;
  sidebarVisible: boolean;
  ohlcvBarVisible: boolean;
  statusBarVisible: boolean;
  magnetEnabled: boolean;
  showSplitEvents: boolean;
  showBonusEvents: boolean;
  showDividendEvents: boolean;
  showRightsEvents: boolean;
  showSymbolChangeEvents: boolean;
  showNameChangeEvents: boolean;
}

export interface DesktopShellApi {
  getAppInfo(): Promise<AppInfo>;
  openExternal(url: string): Promise<{ success: boolean }>;
  syncMenuState(state: NativeMenuState): Promise<{ success: boolean }>;
  onMenuCommand(callback: (command: string, payload?: unknown) => void): () => void;
}

export type DesktopApi = Pick<
  DesktopBridgeApi,
  | 'getPriceStorageMode'
  | 'getAppSnapshot'
  | 'getDbStats'
  | 'getAppProfileSettings'
  | 'saveAppProfileSettings'
  | 'pickAppProfileDirectory'
  | 'pickPluginDataFile'
  | 'pickPluginOutputDirectory'
  | 'readPluginTextFile'
  | 'listExternalPlugins'
  | 'readExternalPluginModule'
  | 'installExternalPluginPackage'
  | 'uninstallExternalPlugin'
  | 'exportDnnResearchDataset'
  | 'saveTextExport'
  | 'saveChartImage'
  | 'createDatabaseInteractive'
  | 'openDatabaseInteractive'
  | 'activateDatabasePath'
  | 'closeDatabase'
  | 'removeRecentDatabase'
  | 'deleteDatabase'
  | 'searchSymbols'
  | 'listSymbols'
  | 'getEodData'
  | 'getDailyMarketSnapshot'
  | 'cancelDailyMarketSnapshot'
  | 'listQuotes'
  | 'listQuotesByDate'
  | 'upsertQuote'
  | 'deleteQuote'
  | 'deleteQuoteRange'
  | 'deleteQuoteDate'
  | 'mergeSymbols'
  | 'applyCorporateAction'
  | 'previewNseHistoricalIdentityArchive'
  | 'applyNseHistoricalIdentityArchive'
  | 'downloadNseDelistedWorkbook'
  | 'downloadNseCurrentUniverseMaster'
  | 'previewNseCurrentUniverseSync'
  | 'applyNseCurrentUniverseSync'
  | 'listNseIdentityApplyHistory'
  | 'listNseHistoricalIdentityApplyHistory'
  | 'getNseHistoricalIdentityApplyReport'
  | 'downloadBseCurrentUniverseMaster'
  | 'previewBseCurrentUniverseSync'
  | 'applyBseCurrentUniverseSync'
  | 'listBseIdentityApplyHistory'
  | 'refreshBseNameHistory'
  | 'previewBseNameHistory'
  | 'applyBseNameHistory'
  | 'listBseNameHistoryRuns'
  | 'getBseNameHistoryReport'
  | 'assessIdentityOfficialSourceHealth'
  | 'getOfficialSourceConfigurationAuthority'
  | 'saveOfficialSourceUrlsReviewed'
  | 'findOfficialSourceReplacementCandidates'
  | 'recordOfficialSourceCandidateDecision'
  | 'promoteOfficialSourceCandidateReviewed'
  | 'createOfficialSourceRollbackReview'
  | 'applyOfficialSourceRollbackReviewed'
  | 'retryOfficialSourcePostHealth'
  | 'listOfficialSourceHistory'
  | 'importCorporateActionsCsv'
  | 'fetchOfficialCorporateActions'
  | 'cancelOfficialCorporateActionFetch'
  | 'backfillHistoricalCapitalActionsForSymbol'
  | 'backfillHistoricalCapitalActionsBatch'
  | 'listHistoricalCapitalActionBackfillRuns'
  | 'listHistoricalCapitalActionAliasCandidates'
  | 'listHistoricalCapitalActionMajorLiquidCandidates'
  | 'listHistoricalCapitalActionSparseCandidates'
  | 'listCorporateActionImports'
  | 'getCorporateActionImportsByIds'
  | 'refreshCorporateActionImportClassifications'
  | 'syncCorporateActionInformationalClosures'
  | 'reopenCorporateActionInformationalClosure'
  | 'listCorporateActionEventIdentities'
  | 'previewCorporateActionRepairs'
  | 'previewSplitBonusReconciliation'
  | 'approveCorporateActionImport'
  | 'approveCorporateActionImportWithIsinMismatch'
  | 'approveCorporateActionImportWithPriceValidationException'
  | 'approveCorporateActionImports'
  | 'autoApproveCorporateActionImports'
  | 'evaluateSimpleCashDividendPreparedScope'
  | 'executeSimpleCashDividendWriteStage'
  | 'saveCorporateActionValidationReport'
  | 'listCorporateActionActivityRuns'
  | 'listCorporateActionValidationReportItems'
  | 'approveRecommendedCorporateActionIsinMismatches'
  | 'recheckCorporateActionImports'
  | 'listCorporateActionImportResolutionHints'
  | 'listCorporateActionImportResolutionSuggestions'
  | 'quickResolveCorporateActionImport'
  | 'resolveCorporateActionImport'
  | 'runCorporateActionScan'
  | 'listCorporateActionScanResults'
  | 'getWatchlists'
  | 'createWatchlist'
  | 'renameWatchlist'
  | 'deleteWatchlist'
  | 'addToWatchlist'
  | 'removeFromWatchlist'
  | 'applyOfficialWatchlistUpdate'
  | 'replaceSourceLinkedWatchlist'
  | 'fetchOfficialWatchlistSource'
  | 'pickCsvFiles'
  | 'previewCsv'
  | 'importCsv'
  | 'getLatestManualImportRecovery'
  | 'listManualImportRecoveryHistory'
  | 'undoManualImportRecovery'
  | 'downloadBhavcopy'
  | 'downloadBhavcopyBatch'
  | 'runTrackedBhavcopyBatch'
  | 'cancelBhavcopyBatch'
  | 'downloadBsePriceHistory'
  | 'cancelBsePriceHistoryDownload'
  | 'getBhavcopySettings'
  | 'saveBhavcopySettings'
  | 'getBhavcopyDefaultTemplates'
  | 'listMarketHolidays'
  | 'addMarketHoliday'
  | 'deleteMarketHoliday'
  | 'listOfficialExchangeHolidaySnapshots'
  | 'previewOfficialExchangeHolidays'
  | 'applyOfficialExchangeHolidays'
  | 'getSavedLayouts'
  | 'saveLayout'
  | 'loadLayout'
  | 'deleteLayout'
  | 'getSetting'
  | 'setSetting'
  | 'validateBinaryParity'
  | 'onImportProgress'
  | 'onQuoteDeleteProgress'
  | 'onCorporateActionProgress'
  | 'onDownloadProgress'
  | 'onDownloadResult'
  | 'onDailyMarketSnapshotProgress'
  | 'onDnnResearchExportProgress'
  | 'onDatabaseChanged'
>;
