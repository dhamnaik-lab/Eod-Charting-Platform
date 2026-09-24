export interface KnownDatabase {
  path: string;
  label: string;
  lastOpenedAt: string;
}

export interface DbStats {
  dbName: string;
  dbSizeMb: number;
  symbolCount: number;
  barCount: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface InstrumentKey {
  symbol: string;
  exchange: string;
}

export interface InstrumentSummary extends InstrumentKey {
  name?: string | null;
  series?: string | null;
  isin?: string | null;
  isActive?: boolean | null;
  lifecycleStatus?: string | null;
  lastPriceDate?: string | null;
  exchangeLatestPriceDate?: string | null;
  resolvedFromAlias?: boolean;
  matchedSymbol?: string | null;
  matchedName?: string | null;
}

export type SymbolExchangeFilter = 'NSE' | 'BSE' | 'all';
export type SymbolSeriesFilter = 'all' | 'nseEquity' | 'nseEq' | 'nseEqTradeForTrade' | 'nseSme';

export interface WatchlistItem extends InstrumentKey {
  name: string | null;
}

export type WatchlistSourceType = 'official';
export type WatchlistSourceExchange = 'NSE' | 'BSE';
export type WatchlistSourceGroupType = 'sector' | 'index';

export interface WatchlistSourceMeta {
  sourceType: WatchlistSourceType;
  sourceExchange: WatchlistSourceExchange;
  sourceGroupType: WatchlistSourceGroupType;
  sourceKey: string;
  sourceDisplayName: string;
  lastSyncedAt: string | null;
}

export interface WatchlistCreateInput {
  name: string;
  sourceMeta?: WatchlistSourceMeta | null;
}

export interface WatchlistRenameInput {
  watchlistId: number;
  name: string;
}

export interface WatchlistDeleteInput {
  watchlistId: number;
}

export interface OfficialWatchlistUpdateInput {
  watchlistId: number;
  symbolsToAdd: InstrumentKey[];
  symbolsToRemove: InstrumentKey[];
  lastSyncedAt: string;
}

export interface SourceLinkedWatchlistReplaceInput {
  watchlistId: number;
  members: InstrumentKey[];
  sourceMeta: WatchlistSourceMeta;
}

export interface OfficialWatchlistSourceFetchInput {
  url: string;
}

export interface Watchlist {
  id: number;
  name: string;
  sourceMeta?: WatchlistSourceMeta | null;
  items: WatchlistItem[];
}

export interface EodRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  prevClose?: number | null;
  volume: number;
}

export interface ChartEventMarker {
  id: string;
  effectiveDate: string;
  type: 'BONUS' | 'SPLIT' | 'DIVIDEND' | 'RIGHTS' | 'DEMERGER' | 'NAME_CHANGE' | 'SYMBOL_CHANGE';
  label: 'B' | 'S' | 'D' | 'R' | 'M' | 'N' | 'T';
  description: string;
}

export interface EodDataInput {
  symbol: string;
  exchange: string;
  from?: string;
  to?: string;
  adjusted?: boolean;
  includeDividendAdjustments?: boolean;
  includeRightsAdjustments?: boolean;
  resolveIdentity?: boolean;
}

export interface EodDataResult {
  requestedSymbol: string;
  requestedExchange: string;
  adjusted: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  instrument: InstrumentSummary | null;
  bars: EodRow[];
  events: ChartEventMarker[];
}

export interface DailyMarketSnapshotInput {
  requestId?: string;
  exchange?: 'NSE' | 'BSE' | 'all';
  historySessions?: number;
  adjusted?: boolean;
  includeDividendAdjustments?: boolean;
  includeRightsAdjustments?: boolean;
}

export interface CancelDailyMarketSnapshotInput {
  requestId: string;
}

export interface CancelDailyMarketSnapshotResult {
  cancelled: boolean;
}

export interface DailyMarketSnapshotProgressEvent {
  requestId: string;
  processedSymbolCount: number;
  targetSymbolCount: number;
  fetchedSymbolCount: number;
  failedSymbolCount: number;
  currentSymbol: string | null;
  currentExchange: string | null;
  cancelled: boolean;
}

export interface DailyMarketSnapshotSymbol {
  instrument: InstrumentSummary;
  bars: EodRow[];
  adjusted: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  events: ChartEventMarker[];
}

export interface DailyMarketSnapshotFailure {
  symbol: string;
  exchange: string;
  error: string;
}

export interface DailyMarketSnapshotResult {
  requestId: string;
  databaseIdentity: string;
  databaseRevision: string;
  latestDatabaseDate: string | null;
  targetSymbolCount: number;
  fetchedSymbolCount: number;
  failedSymbolCount: number;
  symbols: DailyMarketSnapshotSymbol[];
  failures: DailyMarketSnapshotFailure[];
}

export interface QuoteRow extends EodRow {
  symbol: string;
  exchange: string;
  prevClose: number | null;
}

export interface QuoteInput {
  symbol: string;
  exchange: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface QuoteDeleteRangeInput {
  symbol: string;
  exchange: string;
  fromDate: string;
  toDate: string;
}

export interface MergeSymbolsInput {
  sourceSymbol: string;
  sourceExchange: string;
  targetSymbol: string;
  targetExchange: string;
  targetName?: string | null;
  overwriteDuplicates?: boolean;
  deleteSourceAfterMerge?: boolean;
}

export interface MergeSymbolsResult {
  mergedRows: number;
  mergedWatchlistItems: number;
  targetSymbol: string;
  targetExchange: string;
}

export type CorporateActionType =
  | 'SPLIT'
  | 'BONUS'
  | 'DIVIDEND'
  | 'RIGHTS'
  | 'DEMERGER'
  | 'NAME_CHANGE'
  | 'SYMBOL_CHANGE'
  | 'BOTH';

export interface CorporateActionInput {
  actionType: CorporateActionType;
  exchange: string;
  effectiveDate: string;
  symbol?: string;
  isin?: string | null;
  recordDate?: string | null;
  ratioNum?: number | null;
  ratioDen?: number | null;
  oldFaceValue?: number | null;
  newFaceValue?: number | null;
  cashAmount?: number | null;
  costAllocationPct?: number | null;
  spunoffSymbol?: string | null;
  adjustVolume?: boolean;
  oldSymbol?: string | null;
  oldName?: string | null;
  newSymbol?: string | null;
  newName?: string | null;
  currentSymbol?: string | null;
  currentName?: string | null;
  note?: string | null;
  source?: string | null;
  sourceRef?: string | null;
}

export interface CorporateActionResult {
  storedRecordId: number;
  actionType: CorporateActionType;
  exchange: string;
  effectiveDate: string;
  currentSymbol: string;
  currentName: string | null;
  factor: number | null;
  affectedRows: number;
  message: string;
}

export type CorporateActionImportActionType = 'SPLIT' | 'BONUS' | 'DIVIDEND' | 'RIGHTS' | 'DEMERGER' | 'OTHER';

export interface CorporateActionCsvImportInput {
  filePath: string;
  exchange: string;
}

export interface CorporateActionOfficialFetchInput {
  exchange: string;
  fromDate: string;
  toDate: string;
  forceRefresh?: boolean | null;
}

export interface HistoricalCapitalActionBackfillInput {
  exchange: string;
  symbol: string;
  fromDate: string;
  toDate: string;
  bseScripCode?: string | null;
}

export interface HistoricalCapitalActionBackfillBatchSymbolInput {
  symbol: string;
  bseScripCode?: string | null;
}

export interface HistoricalCapitalActionBackfillBatchInput {
  exchange: string;
  fromDate: string;
  toDate: string;
  symbols: HistoricalCapitalActionBackfillBatchSymbolInput[];
  stopOnError?: boolean | null;
}

export interface CorporateActionImportListInput {
  reviewStatus?: string | null;
  actionTypes?: CorporateActionImportActionType[] | null;
  searchQuery?: string | null;
  excludeApproved?: boolean | null;
  limit?: number;
  offset?: number | null;
}

/** Read-only, bounded lookup in the database that the operator reviewed. */
export interface CorporateActionImportLookupInput {
  importIds: number[];
  expectedDatabasePath: string;
}

export interface CorporateActionImportApprovalInput {
  importId: number;
}

export interface CorporateActionImportBulkApprovalInput {
  importIds: number[];
}

export interface CorporateActionAutoApprovalInput {
  importIds: number[];
  expectedDatabasePath: string;
}

export interface CorporateActionImportBulkRecheckInput {
  importIds: number[];
}

export interface CorporateActionImportResolutionHintsInput {
  importIds: number[];
}

export interface CorporateActionImportResolutionSuggestionsInput {
  importId: number;
}

export interface CorporateActionImportResolveInput {
  importId: number;
  symbol?: string | null;
  exchange?: string | null;
  reason?: string | null;
}

export interface CorporateActionImportExceptionalApprovalInput {
  importId: number;
  reason: string;
}

export interface CorporateActionImportQuickResolveInput {
  importId: number;
}

export interface CorporateActionRepairPreviewInput {
  importIds: number[];
}

export interface NseHistoricalIdentityPreviewInput {
  archiveRootPath?: string | null;
}

export interface NseHistoricalIdentityApplyInput extends NseHistoricalIdentityPreviewInput {
  expectedPlanSha256: string;
}

export type NseHistoricalIdentityPreviewDisposition =
  | 'NEW'
  | 'DUPLICATE'
  | 'SKIPPED'
  | 'ERROR';

export type NseHistoricalIdentityChangeType =
  | 'SYMBOL_CHANGE'
  | 'NAME_CHANGE'
  | 'BOTH';

export interface NseHistoricalIdentityPreviewRow {
  disposition: NseHistoricalIdentityPreviewDisposition;
  changeType: NseHistoricalIdentityChangeType;
  effectiveDate: string | null;
  oldSymbol: string | null;
  newSymbol: string | null;
  currentSymbol: string | null;
  oldName: string | null;
  newName: string | null;
  sourceFile: string;
  detail: string;
}

export interface NseCurrentUniverseSyncInput {
  archiveRootPath?: string | null;
}

export interface NseCurrentUniverseApplyInput extends NseCurrentUniverseSyncInput {
  expectedPlanSha256: string;
}

export interface NseDelistedWorkbookDownloadResult {
  filePath: string;
  sourceUrl: string;
  symbolsRead: number;
  bytesWritten: number;
  message: string;
}

export interface NseCurrentUniverseMasterDownloadResult {
  equityFilePath: string;
  smeFilePath: string;
  symbolChangeFilePath: string;
  companyNameChangeFilePath: string;
  equityRowsRead: number;
  smeRowsRead: number;
  symbolChangeRowsRead: number;
  companyNameChangeRowsRead: number;
  bytesWritten: number;
  message: string;
}

export interface BseCurrentUniverseSyncInput {
  masterFilePath: string;
}

export interface NseHistoricalIdentityResult {
  archiveRootPath: string;
  applied: boolean;
  canApply: boolean;
  planSha256: string;
  securitiesAvailableSha256: string;
  symbolChangesSha256: string;
  companyNameChangesSha256: string;
  masterRowsRead: number;
  masterRowsPlanned: number;
  currentEquitySymbols: number;
  symbolChangeRowsRead: number;
  nameChangeRowsRead: number;
  newSymbolChanges: number;
  newNameChanges: number;
  newCombinedChanges: number;
  duplicateRows: number;
  skippedRows: number;
  errorRows: number;
  currentUniversePlanSha256: string | null;
  activeSyncActivateCount: number;
  activeSyncUpdateCount: number;
  activeSyncDeactivateCount: number;
  activeSyncUnchangedCount: number;
  historyRows: NseHistoricalIdentityPreviewRow[];
  currentUniversePreviewRows: NseCurrentUniverseSyncPreviewRow[];
  errors: string[];
}

export interface NseCurrentUniverseSyncPreviewRow {
  action: string;
  symbol: string;
  companyName: string | null;
  series: string | null;
  isin: string | null;
  currentStatus: string;
  proposedStatus: string;
  matchedSymbol: string | null;
  reason: string;
}

export interface NseCurrentUniverseSyncResult {
  archiveRootPath: string;
  applied: boolean;
  masterRowsRead: number;
  currentUniverseSymbols: number;
  matchedBySymbol: number;
  matchedByIsin: number;
  matchedByIdentity: number;
  newSymbols: number;
  activateCount: number;
  updateCount: number;
  deactivateCount: number;
  unchangedActive: number;
  identityHistoryRows: number;
  officialDelistedSymbols: number;
  previewRows: NseCurrentUniverseSyncPreviewRow[];
  planSha256: string;
  message: string;
}

export interface CorporateActionImportRow {
  id: number;
  exchange: string;
  source: string;
  sourceFile: string | null;
  symbol: string | null;
  isin: string | null;
  bseScripCode: string | null;
  companyName: string | null;
  purposeRaw: string;
  exDate: string | null;
  recordDate: string | null;
  actionType: CorporateActionImportActionType;
  ratioNum: number | null;
  ratioDen: number | null;
  oldFaceValue: number | null;
  newFaceValue: number | null;
  cashAmount: number | null;
  factor: number | null;
  priceFactor: number | null;
  parseStatus: string;
  reviewStatus: string;
  message: string | null;
  approvedCorporateActionId: number | null;
  importedAt: string;
  approvedAt: string | null;
  evidenceCount: number;
  evidenceSources: string[];
  latestEvidenceCapturedAt: string | null;
  latestEvidenceSourceLocator: string | null;
  latestEvidenceNote: string | null;
}


export interface CorporateActionEventIdentityListInput {
  importIds: number[];
}

export interface CorporateActionEventIdentity {
  importId: number;
  exchange: string;
  rawSymbol: string | null;
  rawIsin: string | null;
  eventSymbol: string | null;
  eventIsin: string | null;
  resolved: boolean;
  resolutionType: string | null;
  resolutionAuthority: string | null;
  chainId: string | null;
  transitionOldSymbol: string | null;
  transitionNewSymbol: string | null;
  transitionEffectiveDate: string | null;
  rawIdentitySourceRef: string | null;
  rawIdentitySourceSha256: string | null;
  rawIdentitySourceLineNumber: number | null;
  resolutionFingerprint: string | null;
}

export interface CorporateActionEventIdentityListResult {
  requested: number;
  identities: CorporateActionEventIdentity[];
  message: string;
}

export interface CorporateActionRepairSourceIdentity {
  exchange: string;
  source: string;
  sourceFile: string | null;
  symbol: string | null;
  isin: string | null;
  bseScripCode: string | null;
  companyName: string | null;
  exDate: string | null;
  recordDate: string | null;
}

export interface CorporateActionRepairImportValues {
  importId: number;
  dedupeKey: string;
  purposeRaw: string;
  actionType: CorporateActionImportActionType;
  ratioNum: number | null;
  ratioDen: number | null;
  oldFaceValue: number | null;
  newFaceValue: number | null;
  cashAmount: number | null;
  factor: number | null;
  priceFactor: number | null;
  parseStatus: string;
  reviewStatus: string;
  message: string | null;
  approvedCorporateActionId: number | null;
  importedAt: string;
  approvedAt: string | null;
}

export interface CorporateActionRepairCanonicalValues {
  id: number;
  symbol: string;
  exchange: string;
  isin: string | null;
  effectiveDate: string;
  recordDate: string | null;
  actionType: CorporateActionImportActionType;
  factor: number;
  ratioNum: number | null;
  ratioDen: number | null;
  oldFaceValue: number | null;
  newFaceValue: number | null;
  cashAmount: number | null;
  adjustVolume: boolean;
  note: string | null;
  source: string | null;
  sourceRef: string | null;
  appliedAt: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CorporateActionRepairEvidenceRecord {
  id: number;
  sourceCode: string;
  sourceLocator: string | null;
  capturedAt: string;
  symbolSeen: string | null;
  isinSeen: string | null;
  companyNameSeen: string | null;
  actionTypeSeen: string | null;
  eventDateSeen: string | null;
  factorSeen: number | null;
  rawReference: string | null;
  note: string | null;
}

export interface CorporateActionRepairProposalRow {
  actionType: CorporateActionImportActionType;
  disposition: string;
  currentCanonicalId: number | null;
  factor: number | null;
  factorDerivation: string | null;
  ratioNum: number | null;
  ratioDen: number | null;
  oldFaceValue: number | null;
  newFaceValue: number | null;
  cashAmount: number | null;
  confidence: string;
  manualReviewRequired: boolean;
  blockingReasons: string[];
  message: string | null;
}

export interface CorporateActionRepairPreviewRow {
  importId: number;
  rowFingerprint: string;
  evidenceGrade: string;
  sourceIdentity: CorporateActionRepairSourceIdentity;
  currentImport: CorporateActionRepairImportValues;
  currentCanonical: CorporateActionRepairCanonicalValues | null;
  currentSameDateCanonicalActions: CorporateActionRepairCanonicalValues[];
  evidence: CorporateActionRepairEvidenceRecord[];
  proposedOutcomes: CorporateActionRepairProposalRow[];
  confidence: string;
  manualReviewRequired: boolean;
  repairBlocked: boolean;
  blockingReasons: string[];
  previewable: boolean;
}

export interface CorporateActionRepairPreviewResult {
  requested: number;
  uniqueRequested: number;
  missingImportIds: number[];
  previewable: number;
  blocked: number;
  databaseQueryOnly: boolean;
  fingerprintVersion: string;
  fingerprintFields: string[];
  rows: CorporateActionRepairPreviewRow[];
  message: string;
}

export interface CorporateActionCsvImportResult {
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsError: number;
  rowsUnresolved: number;
  rowsParsed: number;
  rowsUnsupported: number;
  parseStatusCounts: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  imports: CorporateActionImportRow[];
  errors: string[];
}

export interface CorporateActionOfficialFetchResult {
  exchange: string;
  source: string;
  fromDate: string;
  toDate: string;
  requestedDays: number;
  cachedDays: number;
  fetchedDays: number;
  fetchedRanges: number;
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsError: number;
  rowsUnresolved: number;
  rowsParsed: number;
  rowsUnsupported: number;
  imports: CorporateActionImportRow[];
  errors: string[];
}

export interface HistoricalCapitalActionBackfillSourceAttempt {
  source: string;
  requestedSymbol: string | null;
  sourceLocator: string | null;
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsEvidenceAttached: number;
  rowsError: number;
  earliestExDate: string | null;
  latestExDate: string | null;
  message: string;
}

export interface HistoricalCapitalActionBackfillResult {
  exchange: string;
  requestedSymbol: string;
  canonicalSymbol: string | null;
  fromDate: string;
  toDate: string;
  searchedSymbols: string[];
  bseScripCode: string | null;
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsEvidenceAttached: number;
  rowsError: number;
  rowsUnresolved: number;
  rowsParsed: number;
  rowsUnsupported: number;
  imports: CorporateActionImportRow[];
  sourceAttempts: HistoricalCapitalActionBackfillSourceAttempt[];
  warnings: string[];
  errors: string[];
  message: string;
}

export interface BseCurrentUniverseSyncPreviewRow {
  action: string;
  symbol: string;
  securityCode: string | null;
  companyName: string | null;
  series: string | null;
  isin: string | null;
  currentStatus: string;
  proposedStatus: string;
  reason: string;
}

export interface BseCurrentUniverseSyncResult {
  masterFilePath: string;
  applied: boolean;
  masterRowsRead: number;
  currentUniverseSymbols: number;
  activateCount: number;
  updateCount: number;
  deactivateCount: number;
  unchangedActive: number;
  previewRows: BseCurrentUniverseSyncPreviewRow[];
  message: string;
}

export interface BseCurrentUniverseMasterDownloadResult {
  filePath: string;
  sourceUrl: string;
  rowsRead: number;
  message: string;
}

export type OfficialSourceCheckStatus =
  | 'PASS'
  | 'FAIL'
  | 'NOT_APPLICABLE'
  | 'NOT_EVALUATED';

export type OfficialSourceDriftClass =
  | 'COMPATIBLE'
  | 'ADAPTER_REQUIRED'
  | 'SEMANTIC_CONTRACT_CHANGE';

export interface OfficialSourceHealthResult {
  sourceId: string;
  exchange: 'NSE' | 'BSE';
  role: string;
  requestUrl: string;
  finalUrl: string | null;
  provenanceStatus: OfficialSourceCheckStatus;
  transportStatus: OfficialSourceCheckStatus;
  httpStatus: number | null;
  contentBytes: number | null;
  contentSha256: string | null;
  formatStatus: OfficialSourceCheckStatus;
  populationStatus: OfficialSourceCheckStatus;
  populationCount: number | null;
  freshnessStatus: OfficialSourceCheckStatus;
  driftClass: OfficialSourceDriftClass | null;
  reason: string;
}

export interface OfficialSourceHealthReport {
  assessedAtUtc: string;
  results: OfficialSourceHealthResult[];
}

export interface OfficialSourceUrls {
  nseSecuritiesAvailablePageUrl: string;
  nseEquityMasterUrl: string;
  nseSmeMasterUrl: string;
  nseSymbolChangeUrl: string;
  nseCompanyNameChangeUrl: string;
  nseDelistedPageUrl: string;
  nseDelistedWorkbookUrl: string;
  bseListScripsUrlPrefix: string;
  bseListScripsReferer: string;
}

export interface OfficialSourceAuthorityEntry {
  sourceKey: string;
  exchange: 'NSE' | 'BSE';
  sourceId: string | null;
  sourceRole: string | null;
  configField: keyof OfficialSourceUrls;
  candidatePromotionEligible: boolean;
  currentVersionId: number;
  revision: number;
  currentUrl: string;
}

export interface OfficialSourceConfigurationAuthority {
  schemaVersion: number;
  configurationFingerprint: string;
  urls: OfficialSourceUrls;
  sources: OfficialSourceAuthorityEntry[];
}

export interface ExpectedOfficialSourceRevision {
  sourceKey: string;
  revision: number;
}

export interface SaveOfficialSourceUrlsReviewedInput {
  expectedConfigurationFingerprint: string;
  expectedSourceRevisions: ExpectedOfficialSourceRevision[];
  urls: OfficialSourceUrls;
  operatorNote?: string | null;
}

export interface SaveOfficialSourceUrlsReviewedResult {
  success: boolean;
  changedSourceKeys: string[];
  authority: OfficialSourceConfigurationAuthority;
}

export type OfficialSourceCandidateClassification =
  | 'VALIDATED_CANDIDATE_NOT_PROMOTED'
  | 'INDETERMINATE_CANDIDATE'
  | 'REJECTED_CANDIDATE';

export interface OfficialSourceCandidateReviewPlan {
  schemaVersion: number;
  sourceKey: string;
  exchange: 'NSE';
  sourceId: string;
  sourceRole: string;
  baseVersionId: number;
  baseRevision: number;
  currentUrl: string;
  candidateUrl: string;
  candidateFinalUrl: string | null;
  candidateContentSha256: string | null;
  classification: OfficialSourceCandidateClassification;
  discoveryReason: string;
  httpStatus: number | null;
  contentType: string | null;
  responseBytes: number | null;
  parserStatus: string;
  schemaStatus: string;
  populationStatus: string;
  populationCount: number | null;
  freshnessStatus: string;
  validationReason: string;
  validationReportSha256: string;
  reviewFingerprint: string;
  promotable: boolean;
}

export interface FindOfficialSourceReplacementCandidatesInput {
  sourceKey: string;
  triggerCategory:
    | 'PROVENANCE_FAILURE'
    | 'TRANSPORT_FAILURE'
    | 'HTTP_FAILURE'
    | 'FORMAT_OR_SCHEMA_FAILURE'
    | 'POPULATION_FAILURE'
    | 'SEMANTIC_FAILURE';
}

export interface OfficialSourceReplacementCandidatesResult {
  authority: OfficialSourceConfigurationAuthority;
  sourceKey: string;
  candidates: OfficialSourceCandidateReviewPlan[];
  discoveryRejectionCount: number;
}

export type OfficialSourceCandidateDecision = 'KEEP_CURRENT' | 'REJECT_CANDIDATE';

export interface RecordOfficialSourceCandidateDecisionInput {
  review: OfficialSourceCandidateReviewPlan;
  decision: OfficialSourceCandidateDecision;
  operatorNote?: string | null;
}

export interface OfficialSourceCandidateDecisionResult {
  success: boolean;
}

export interface PromoteOfficialSourceCandidateReviewedInput {
  review: OfficialSourceCandidateReviewPlan;
  operatorNote?: string | null;
}

export interface OfficialSourcePromotionResult {
  resultStatus: string;
  resultVersionId: number;
  authority: OfficialSourceConfigurationAuthority;
  postHealthReport: OfficialSourceHealthReport | null;
}

export interface OfficialSourceRollbackReview {
  schemaVersion: number;
  sourceKey: string;
  currentVersionId: number;
  currentRevision: number;
  currentUrl: string;
  targetVersionId: number;
  targetUrl: string;
  targetValidationSha256: string;
  rollbackFingerprint: string;
}

export interface CreateOfficialSourceRollbackReviewInput {
  sourceKey: string;
  targetVersionId: number;
}

export interface ApplyOfficialSourceRollbackReviewedInput {
  review: OfficialSourceRollbackReview;
  operatorNote?: string | null;
}

export interface OfficialSourceRollbackResult {
  resultStatus: string;
  resultVersionId: number;
  authority: OfficialSourceConfigurationAuthority;
  postHealthReport: OfficialSourceHealthReport | null;
}

export interface RetryOfficialSourcePostHealthInput {
  sourceKey: string;
  resultVersionId: number;
}

export interface OfficialSourcePostHealthResult {
  resultStatus: string;
  resultVersionId: number;
  postHealthReport: OfficialSourceHealthReport | null;
}

export interface OfficialSourceHistoryEntry {
  entryKind: 'VERSION' | 'REVIEW';
  versionId: number;
  revision: number;
  active: boolean;
  url: string;
  changeKind: string;
  parentVersionId: number | null;
  createdAt: string;
  candidateContentSha256: string | null;
  reviewDecision: string | null;
  reviewResultStatus: string | null;
  resultVersionId: number | null;
  operatorNote: string | null;
  postHealthStatus: string | null;
}


export interface HistoricalCapitalActionBackfillBatchSymbolResult {
  runSymbolId: number | null;
  symbol: string;
  status: string;
  bseScripCode: string | null;
  result: HistoricalCapitalActionBackfillResult | null;
  error: string | null;
}

export interface HistoricalCapitalActionBackfillBatchResult {
  runId: number | null;
  exchange: string;
  fromDate: string;
  toDate: string;
  requestedSymbols: string[];
  totalSymbols: number;
  completedSymbols: number;
  failedSymbols: number;
  stoppedOnError: boolean;
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsEvidenceAttached: number;
  rowsError: number;
  rowsUnresolved: number;
  rowsParsed: number;
  rowsUnsupported: number;
  parseStatusCounts: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  symbolResults: HistoricalCapitalActionBackfillBatchSymbolResult[];
  errors: string[];
  message: string;
}

export interface HistoricalCapitalActionBackfillRunListInput {
  status?: string | null;
  searchQuery?: string | null;
  limit?: number | null;
  offset?: number | null;
}

export interface HistoricalCapitalActionBackfillRunSymbolRow {
  id: number;
  runId: number;
  symbol: string;
  canonicalSymbol: string | null;
  bseScripCode: string | null;
  status: string;
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsEvidenceAttached: number;
  rowsError: number;
  rowsUnresolved: number;
  rowsParsed: number;
  rowsUnsupported: number;
  parseStatusCounts: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  warningCount: number;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
  message: string | null;
  outcomes: HistoricalCapitalActionBackfillRunOutcomeRow[];
}

export interface HistoricalCapitalActionBackfillRunOutcomeRow {
  id: number;
  runSymbolId: number;
  source: string;
  requestedSymbol: string | null;
  sourceLocator: string | null;
  outcome: string;
  importId: number | null;
  evidenceId: number | null;
  actionType: string | null;
  parseStatus: string | null;
  reviewStatus: string | null;
  message: string | null;
  evidenceSymbolSeen: string | null;
  evidenceIsinSeen: string | null;
  evidenceCompanyNameSeen: string | null;
  evidenceRawReference: string | null;
  evidenceNote: string | null;
  createdAt: string;
}

export interface HistoricalCapitalActionBackfillRunRow {
  id: number;
  exchange: string;
  fromDate: string;
  toDate: string;
  requestedSymbols: string[];
  stopOnError: boolean;
  status: string;
  totalSymbols: number;
  completedSymbols: number;
  failedSymbols: number;
  rowsRead: number;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsEvidenceAttached: number;
  rowsError: number;
  rowsUnresolved: number;
  rowsParsed: number;
  rowsUnsupported: number;
  parseStatusCounts: Record<string, number>;
  reviewStatusCounts: Record<string, number>;
  startedAt: string;
  completedAt: string | null;
  message: string | null;
  symbols: HistoricalCapitalActionBackfillRunSymbolRow[];
}

export interface HistoricalCapitalActionBackfillRunListResult {
  runs: HistoricalCapitalActionBackfillRunRow[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  message: string;
}

export interface HistoricalCapitalActionSparseCandidateInput {
  exchange?: string | null;
  limit?: number | null;
}

export interface HistoricalCapitalActionSparseCandidate {
  symbol: string;
  exchange: string;
  name: string | null;
  series: string | null;
  isin: string | null;
  firstPriceDate: string | null;
  approvedCapitalActions: number;
  importedCapitalActions: number;
  unresolvedImportRows: number;
  firstKnownCapitalActionDate: string | null;
  lastKnownCapitalActionDate: string | null;
  reason: string;
}

export interface HistoricalCapitalActionSparseCandidateResult {
  candidates: HistoricalCapitalActionSparseCandidate[];
  message: string;
}

export interface HistoricalCapitalActionAliasCandidateInput {
  exchange?: string | null;
  limit?: number | null;
}

export interface HistoricalCapitalActionAliasCandidate {
  symbol: string;
  exchange: string;
  name: string | null;
  series: string | null;
  isin: string | null;
  oldSymbols: string[];
  aliasCount: number;
  earliestAliasDate: string | null;
  latestAliasDate: string | null;
  firstPriceDate: string | null;
  reason: string;
}

export interface HistoricalCapitalActionAliasCandidateResult {
  candidates: HistoricalCapitalActionAliasCandidate[];
  message: string;
}

export interface HistoricalCapitalActionMajorLiquidCandidateInput {
  exchange?: string | null;
  limit?: number | null;
}

export interface HistoricalCapitalActionMajorLiquidCandidate {
  symbol: string;
  exchange: string;
  name: string | null;
  series: string | null;
  isin: string | null;
  firstPriceDate: string | null;
  lastPriceDate: string | null;
  barCount: number;
  recentBarCount: number;
  averageRecentTurnover: number;
  reason: string;
}

export interface HistoricalCapitalActionMajorLiquidCandidateResult {
  candidates: HistoricalCapitalActionMajorLiquidCandidate[];
  message: string;
}

export interface CorporateActionImportApprovalResult {
  importRecord: CorporateActionImportRow;
  approvedRecord: CorporateActionResult | null;
  message: string;
}

export interface CorporateActionImportBulkApprovalError {
  importId: number;
  message: string;
}

export interface CorporateActionImportBulkApprovalResult {
  requested: number;
  approved: number;
  linkedExisting: number;
  alreadyApproved: number;
  failed: number;
  results: CorporateActionImportApprovalResult[];
  errors: CorporateActionImportBulkApprovalError[];
  message: string;
}

export interface CorporateActionAutoApprovalDisposition {
  importId: number;
  disposition: 'AUTO_APPROVED' | 'LINKED_EXISTING' | 'ALREADY_APPROVED' | 'SKIPPED' | 'FAILED';
  reason: string;
  importRecord: CorporateActionImportRow | null;
  approvedRecord: CorporateActionResult | null;
}

export interface CorporateActionAutoApprovalResult {
  requested: number;
  eligible: number;
  autoApproved: number;
  linkedExisting: number;
  alreadyApproved: number;
  skipped: number;
  failed: number;
  dispositions: CorporateActionAutoApprovalDisposition[];
  policyVersion: string;
  message: string;
}

export interface CorporateActionImportResolveResult {
  importRecord: CorporateActionImportRow;
  message: string;
}

export interface CorporateActionImportBulkRecheckError {
  importId: number;
  message: string;
}

export interface CorporateActionImportBulkRecheckResult {
  requested: number;
  rechecked: number;
  reviewable: number;
  stillUnresolved: number;
  failed: number;
  results: CorporateActionImportResolveResult[];
  errors: CorporateActionImportBulkRecheckError[];
  message: string;
}

export interface CorporateActionImportResolutionHint {
  importId: number;
  status: string;
  quickResolvable: boolean;
  activeSuggestionCount: number;
  totalSuggestionCount: number;
  topSuggestionSymbol: string | null;
  topSuggestionExchange: string | null;
  recommendedIsinException: boolean;
  recommendationReason: string | null;
  message: string;
}

export interface CorporateActionImportResolutionHintsResult {
  requested: number;
  hints: CorporateActionImportResolutionHint[];
  message: string;
}

export interface CorporateActionImportResolutionSuggestion {
  symbol: string;
  exchange: string;
  name: string | null;
  series: string | null;
  isin: string | null;
  isActive: boolean;
  hasEventDateIsinEvidence: boolean;
  reason: string;
}

export interface CorporateActionImportResolutionSuggestionsResult {
  importRecord: CorporateActionImportRow;
  suggestions: CorporateActionImportResolutionSuggestion[];
  message: string;
}

export interface CorporateActionScanInput {
  scope?: string | null;
  importIds?: number[] | null;
}

export interface CorporateActionScanListInput {
  scanRunId?: number | null;
  importIds?: number[] | null;
  searchQuery?: string | null;
  limit?: number;
}

export interface CorporateActionScanRun {
  id: number;
  scope: string;
  actionTypes: string;
  startedAt: string;
  completedAt: string | null;
  status: string;
  message: string | null;
  totalResults: number;
}

export interface CorporateActionScanResultRow {
  id: number;
  scanRunId: number;
  corporateActionImportId: number | null;
  corporateActionId: number | null;
  symbol: string | null;
  exchange: string;
  scanStatus: string;
  prevTradeDate: string | null;
  exTradeDate: string | null;
  prevClose: number | null;
  exOpen: number | null;
  exClose: number | null;
  expectedFactor: number | null;
  actualOpenFactor: number | null;
  actualCloseFactor: number | null;
  confidence: number | null;
  message: string | null;
  scannedAt: string;
}

export interface CorporateActionScanResult {
  scanRun: CorporateActionScanRun | null;
  results: CorporateActionScanResultRow[];
}

export type ParityIssueType =
  | 'BINARY_MISSING'
  | 'COUNT_MISMATCH'
  | 'DATE_RANGE_MISMATCH'
  | 'FILE_CORRUPT';

export interface ParityIssue {
  symbol: string;
  exchange: string;
  issueType: ParityIssueType;
  sqliteCount: number;
  binaryCount: number;
  sqliteFirstDate: string | null;
  sqliteLastDate: string | null;
  binaryFirstDate: string | null;
  binaryLastDate: string | null;
  message: string;
}

export interface ValidationReport {
  success: boolean;
  symbolsProcessed: number;
  issuesFound: number;
  issues: ParityIssue[];
  durationMs: number;
}

export interface ValidateBinaryParityInput {
  scope: 'global' | 'exchange' | 'symbol';
  symbol?: string | null;
  exchange?: string | null;
  quickCheck: boolean;
}

export interface CsvPreview {
  headers: string[];
  rows: string[][];
  detectedDelimiter: string;
  totalEstimatedRows: number;
}

export interface ImportOptions {
  filePaths: string[];
  exchange?: string;
  hasHeader?: boolean;
  dateFormat?:
    | 'auto'
    | 'YYYYMMDD'
    | 'YYYY-MM-DD'
    | 'YYYY/MM/DD'
    | 'DD-MM-YYYY'
    | 'DD/MM/YYYY'
    | 'DD-MMM-YYYY';
  delimiter?: ',' | '\t' | ';';
  onDuplicate?: 'skip' | 'overwrite' | 'error';
  trimWhitespace?: boolean;
  allowExchangeMismatch?: boolean;
}

export interface ImportBinaryDiagnostics {
  workers: number;
  parsePrepareMs: number;
  binaryFilterMs: number;
  binaryWriteMs: number;
  insertedDates: number;
  changedDates: number;
  unchangedDates: number;
  binaryErrors: number;
  newFiles: number;
  appendNewest: number;
  rewriteTail: number;
  updateExisting: number;
  insertHistorical: number;
  noOp: number;
  existsUs: number;
  openUs: number;
  headerReadUs: number;
  lastDateReadUs: number;
  sortUs: number;
  lookupUs: number;
  tailReadUs: number;
  newFileWriteUs: number;
  seekUs: number;
  dataWriteUs: number;
  byteShiftUs: number;
  setLenUs: number;
  headerWriteUs: number;
  flushUs: number;
  flushCalls: number;
  syncDataUs: number;
  syncDataCalls: number;
  parallelSummedSymbolUs: number;
  p50SymbolUs: number;
  p95SymbolUs: number;
  maxSymbolUs: number;
}

export interface ManualImportRecoverySummary {
  sessionId: string;
  status: string;
  exchange: string;
  duplicateMode: string;
  storageMode: string;
  createdAt: string;
  completedAt: string | null;
  undoneAt: string | null;
  fileCount: number;
  sourceFiles: string[];
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsError: number;
  symbolCount: number;
  dateFrom: string | null;
  dateTo: string | null;
  plannedChanges: number;
  createdInstruments: number;
  undoable: boolean;
  errorSummary: string | null;
}

export interface ManualImportUndoResult {
  success: boolean;
  sessionId: string;
  revertedInsertedRows: number;
  restoredOverwrittenRows: number;
  alreadyRevertedRows: number;
  conflicts: number;
  removedInstruments: number;
  preservedInstruments: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  rowsRead: number;
  rowsInserted: number;
  rowsSkipped: number;
  rowsError: number;
  symbolCount: number;
  dateRange: { from: string; to: string } | null;
  sampleSymbols: InstrumentKey[];
  errors: string[];
  durationMs: number;
  binaryDiagnostics: ImportBinaryDiagnostics | null;
  recoverySession: ManualImportRecoverySummary | null;
}

export interface DownloadResult {
  success: boolean;
  tradeDate: string;
  exchange: string;
  rowsInserted: number;
  message: string;
}

export interface BatchDownloadConfig {
  mode: DownloadMode;
  exchanges: {
    nse: boolean;
    bse: boolean;
    nseIndex: boolean;
    bseIndex: boolean;
  };
  startDate: string;
  endDate: string;
  workers: number;
  excludedSeries: string[];
  nseEquityUrlOverride?: string | null;
  nseIndexUrlOverride?: string | null;
  bseEquityUrlOverride?: string | null;
  bseIndexUrlOverride?: string | null;
}

export type DownloadMode = 'range' | 'update' | 'fullHistory';

export interface BhavcopySettings {
  exchanges: {
    nse: boolean;
    bse: boolean;
    nseIndex: boolean;
    bseIndex: boolean;
  };
  workers: number;
  excludedSeries: string[];
  nseEquityUrlOverride?: string | null;
  nseIndexUrlOverride?: string | null;
  bseEquityUrlOverride?: string | null;
  bseIndexUrlOverride?: string | null;
}

export interface MarketHoliday {
  id: number;
  date: string;
  name: string;
  source: 'BUILTIN' | 'USER' | string;
}

export interface BhavcopyDefaultTemplates {
  nseEquity: string[];
  nseIndex: string[];
  bseEquity: string[];
  bseIndex: string[];
}

export interface AppSnapshot {
  activeDatabasePath: string | null;
  knownDatabases: KnownDatabase[];
  dbStats: DbStats | null;
  watchlists: Watchlist[];
  theme: string;
}

export interface SnapshotOptions {
  includeStats?: boolean;
  includeWatchlists?: boolean;
}

export interface AppInfo {
  name: string;
  version: string;
  buildNumber?: string;
  builtAt?: string;
  runtime: 'tauri';
  dataMode?: 'portable' | 'system';
  buildProfile?: 'debug' | 'release';
  dataDir?: string;
  stateDir?: string;
  profileDir?: string;
  defaultProfileDir?: string;
  logFile?: string;
  executableDir?: string;
}

export interface AppProfileSettingsPayload {
  theme: string;
  defaultExchange: string;
  candleUpColor: string;
  candleDownColor: string;
  gridColor: string;
  crosshairColor: string;
  pluginEnabled: Record<string, boolean>;
  pluginConfigurations: Record<string, unknown>;
  eodAlertRules: unknown[];
  eodAlertHistory: unknown[];
  scannerWorkspace: unknown;
  profileDirectory: string;
  defaultProfileDirectory: string;
}

export interface AppProfileSettingsSaveInput {
  theme: string;
  defaultExchange: string;
  candleUpColor: string;
  candleDownColor: string;
  gridColor: string;
  crosshairColor: string;
  pluginEnabled?: Record<string, boolean>;
  pluginConfigurations?: Record<string, unknown>;
  eodAlertRules?: unknown[];
  eodAlertHistory?: unknown[];
  scannerWorkspace?: unknown;
  profileDirectory?: string | null;
}


export interface PluginDataFilePickerInput {
  title?: string | null;
  filterName?: string | null;
  extensions: string[];
}

export interface PluginOutputDirectoryPickerInput {
  title?: string | null;
}

export interface PluginTextFileReadInput {
  filePath: string;
  allowedExtensions: string[];
  maxBytes?: number | null;
}

export interface PluginTextFileReadResult {
  filePath: string;
  byteLength: number;
  text: string;
}

export type DnnResearchDatasetExchange = 'NSE' | 'BSE' | 'all';

export interface DnnResearchDatasetExportInput {
  outputParentDirectory: string;
  exchange?: DnnResearchDatasetExchange | null;
  fromDate?: string | null;
  toDate?: string | null;
  adjusted?: boolean | null;
  includeDividendAdjustments?: boolean | null;
  includeRightsAdjustments?: boolean | null;
  includeInactive?: boolean | null;
}

export interface DnnResearchDatasetExportProgressEvent {
  processedInstrumentCount: number;
  targetInstrumentCount: number;
  exportedInstrumentCount: number;
  exportedBarCount: number;
  failureCount: number;
  currentSymbol: string | null;
  currentExchange: string | null;
  percent: number;
  message: string;
}

export interface DnnResearchDatasetExportResult {
  status: 'complete' | 'completeWithFailures';
  datasetDirectory: string;
  manifestPath: string;
  databaseRevision: string;
  fromDate: string;
  toDate: string;
  targetInstrumentCount: number;
  exportedInstrumentCount: number;
  exportedBarCount: number;
  exportedCorporateActionCount: number;
  failureCount: number;
}


export interface SaveTextExportInput {
  title?: string | null;
  suggestedFileName: string;
  content: string;
  defaultExtension?: string | null;
  filterName?: string | null;
  filterExtensions?: string[] | null;
}

export interface SaveTextExportResult {
  success: boolean;
  filePath: string | null;
}

export interface SaveChartImageInput {
  title?: string | null;
  suggestedFileName: string;
  pngBase64: string;
}

export interface SaveChartImageResult {
  success: boolean;
  filePath: string | null;
}

export interface QuoteDateListInput {
  exchange: string;
  date: string;
  limit?: number;
}

export interface QuoteDeleteDateInput {
  exchange: string;
  date: string;
  toDate?: string;
  symbols?: string[];
}

export interface QuoteDeleteProgressEvent {
  processedFiles: number;
  totalFiles: number;
  currentSymbol?: string | null;
  percent: number;
  message: string;
}

export interface DesktopBridgeApi {
  getPriceStorageMode(): Promise<'hybrid' | 'binary'>;
  getAppInfo(): Promise<AppInfo>;
  getAppProfileSettings(): Promise<AppProfileSettingsPayload>;
  saveAppProfileSettings(input: AppProfileSettingsSaveInput): Promise<{ success: boolean }>;
  pickAppProfileDirectory(): Promise<string | null>;
  pickPluginDataFile(input: PluginDataFilePickerInput): Promise<string | null>;
  pickPluginOutputDirectory(input: PluginOutputDirectoryPickerInput): Promise<string | null>;
  readPluginTextFile(input: PluginTextFileReadInput): Promise<PluginTextFileReadResult>;
  exportDnnResearchDataset(
    input: DnnResearchDatasetExportInput,
  ): Promise<DnnResearchDatasetExportResult>;
  saveTextExport(input: SaveTextExportInput): Promise<SaveTextExportResult>;
  saveChartImage(input: SaveChartImageInput): Promise<SaveChartImageResult>;
  openExternal(url: string): Promise<{ success: boolean }>;
  getAppSnapshot(options?: SnapshotOptions): Promise<AppSnapshot>;
  getDbStats(): Promise<DbStats | null>;
  createDatabaseInteractive(requestedMode?: 'hybrid' | 'binary'): Promise<AppSnapshot>;
  openDatabaseInteractive(): Promise<AppSnapshot>;
  activateDatabasePath(filePath: string): Promise<AppSnapshot>;
  closeDatabase(): Promise<AppSnapshot>;
  removeRecentDatabase(filePath: string): Promise<AppSnapshot>;
  deleteDatabase(filePath: string): Promise<AppSnapshot>;
  searchSymbols(input: {
    query: string;
    exchange?: string | null;
    limit?: number;
    seriesFilter?: SymbolSeriesFilter;
  }): Promise<InstrumentSummary[]>;
  listSymbols(input?: {
    query?: string;
    exchange?: string | null;
    limit?: number;
    seriesFilter?: SymbolSeriesFilter;
    includeInactive?: boolean;
  }): Promise<InstrumentSummary[]>;
  getEodData(input: EodDataInput): Promise<EodDataResult>;
  getDailyMarketSnapshot(input: DailyMarketSnapshotInput): Promise<DailyMarketSnapshotResult>;
  cancelDailyMarketSnapshot(
    input: CancelDailyMarketSnapshotInput,
  ): Promise<CancelDailyMarketSnapshotResult>;
  listQuotes(input: { symbol: string; exchange: string; limit?: number }): Promise<QuoteRow[]>;
  listQuotesByDate(input: QuoteDateListInput): Promise<QuoteRow[]>;
  upsertQuote(input: QuoteInput): Promise<QuoteRow>;
  deleteQuote(input: { symbol: string; exchange: string; date: string }): Promise<{ success: boolean; deleted: number }>;
  deleteQuoteRange(input: QuoteDeleteRangeInput): Promise<{ success: boolean; deleted: number }>;
  deleteQuoteDate(input: QuoteDeleteDateInput): Promise<{ success: boolean; deleted: number }>;
  mergeSymbols(input: MergeSymbolsInput): Promise<MergeSymbolsResult>;
  applyCorporateAction(input: CorporateActionInput): Promise<CorporateActionResult>;
  previewNseHistoricalIdentityArchive(input: NseHistoricalIdentityPreviewInput): Promise<NseHistoricalIdentityResult>;
  applyNseHistoricalIdentityArchive(input: NseHistoricalIdentityApplyInput): Promise<NseHistoricalIdentityResult>;
  downloadNseDelistedWorkbook(): Promise<NseDelistedWorkbookDownloadResult>;
  downloadNseCurrentUniverseMaster(): Promise<NseCurrentUniverseMasterDownloadResult>;
  previewNseCurrentUniverseSync(input: NseCurrentUniverseSyncInput): Promise<NseCurrentUniverseSyncResult>;
  applyNseCurrentUniverseSync(input: NseCurrentUniverseApplyInput): Promise<NseCurrentUniverseSyncResult>;
  downloadBseCurrentUniverseMaster(): Promise<BseCurrentUniverseMasterDownloadResult>;
  previewBseCurrentUniverseSync(input: BseCurrentUniverseSyncInput): Promise<BseCurrentUniverseSyncResult>;
  applyBseCurrentUniverseSync(input: BseCurrentUniverseSyncInput): Promise<BseCurrentUniverseSyncResult>;
  assessIdentityOfficialSourceHealth(): Promise<OfficialSourceHealthReport>;
  getOfficialSourceConfigurationAuthority(): Promise<OfficialSourceConfigurationAuthority>;
  saveOfficialSourceUrlsReviewed(
    input: SaveOfficialSourceUrlsReviewedInput,
  ): Promise<SaveOfficialSourceUrlsReviewedResult>;
  findOfficialSourceReplacementCandidates(
    input: FindOfficialSourceReplacementCandidatesInput,
  ): Promise<OfficialSourceReplacementCandidatesResult>;
  recordOfficialSourceCandidateDecision(
    input: RecordOfficialSourceCandidateDecisionInput,
  ): Promise<OfficialSourceCandidateDecisionResult>;
  promoteOfficialSourceCandidateReviewed(
    input: PromoteOfficialSourceCandidateReviewedInput,
  ): Promise<OfficialSourcePromotionResult>;
  createOfficialSourceRollbackReview(
    input: CreateOfficialSourceRollbackReviewInput,
  ): Promise<OfficialSourceRollbackReview>;
  applyOfficialSourceRollbackReviewed(
    input: ApplyOfficialSourceRollbackReviewedInput,
  ): Promise<OfficialSourceRollbackResult>;
  retryOfficialSourcePostHealth(
    input: RetryOfficialSourcePostHealthInput,
  ): Promise<OfficialSourcePostHealthResult>;
  listOfficialSourceHistory(input: { sourceKey: string }): Promise<OfficialSourceHistoryEntry[]>;
  importCorporateActionsCsv(input: CorporateActionCsvImportInput): Promise<CorporateActionCsvImportResult>;
  fetchOfficialCorporateActions(input: CorporateActionOfficialFetchInput): Promise<CorporateActionOfficialFetchResult>;
  backfillHistoricalCapitalActionsForSymbol(
    input: HistoricalCapitalActionBackfillInput,
  ): Promise<HistoricalCapitalActionBackfillResult>;
  backfillHistoricalCapitalActionsBatch(
    input: HistoricalCapitalActionBackfillBatchInput,
  ): Promise<HistoricalCapitalActionBackfillBatchResult>;
  listHistoricalCapitalActionBackfillRuns(
    input?: HistoricalCapitalActionBackfillRunListInput,
  ): Promise<HistoricalCapitalActionBackfillRunListResult>;
  listHistoricalCapitalActionSparseCandidates(
    input?: HistoricalCapitalActionSparseCandidateInput,
  ): Promise<HistoricalCapitalActionSparseCandidateResult>;
  listHistoricalCapitalActionAliasCandidates(
    input?: HistoricalCapitalActionAliasCandidateInput,
  ): Promise<HistoricalCapitalActionAliasCandidateResult>;
  listHistoricalCapitalActionMajorLiquidCandidates(
    input?: HistoricalCapitalActionMajorLiquidCandidateInput,
  ): Promise<HistoricalCapitalActionMajorLiquidCandidateResult>;
  listCorporateActionImports(input?: CorporateActionImportListInput): Promise<CorporateActionImportRow[]>;
  getCorporateActionImportsByIds(input: CorporateActionImportLookupInput): Promise<CorporateActionImportRow[]>;
  listCorporateActionEventIdentities(
    input: CorporateActionEventIdentityListInput,
  ): Promise<CorporateActionEventIdentityListResult>;
  previewSplitBonusReconciliation(input: CorporateActionReconciliationPreflightInput): Promise<CorporateActionReconciliationPreflightResult>;
  previewCorporateActionRepairs(
    input: CorporateActionRepairPreviewInput,
  ): Promise<CorporateActionRepairPreviewResult>;
  approveCorporateActionImport(input: CorporateActionImportApprovalInput): Promise<CorporateActionImportApprovalResult>;
  approveCorporateActionImportWithIsinMismatch(
    input: CorporateActionImportExceptionalApprovalInput,
  ): Promise<CorporateActionImportApprovalResult>;
  approveCorporateActionImportWithPriceValidationException(
    input: CorporateActionImportExceptionalApprovalInput,
  ): Promise<CorporateActionImportApprovalResult>;
  approveCorporateActionImports(input: CorporateActionImportBulkApprovalInput): Promise<CorporateActionImportBulkApprovalResult>;
  autoApproveCorporateActionImports(input: CorporateActionAutoApprovalInput): Promise<CorporateActionAutoApprovalResult>;
  approveRecommendedCorporateActionIsinMismatches(
    input: CorporateActionImportBulkApprovalInput,
  ): Promise<CorporateActionImportBulkApprovalResult>;
  recheckCorporateActionImports(input: CorporateActionImportBulkRecheckInput): Promise<CorporateActionImportBulkRecheckResult>;
  listCorporateActionImportResolutionHints(
    input: CorporateActionImportResolutionHintsInput,
  ): Promise<CorporateActionImportResolutionHintsResult>;
  listCorporateActionImportResolutionSuggestions(
    input: CorporateActionImportResolutionSuggestionsInput,
  ): Promise<CorporateActionImportResolutionSuggestionsResult>;
  resolveCorporateActionImport(input: CorporateActionImportResolveInput): Promise<CorporateActionImportResolveResult>;
  quickResolveCorporateActionImport(
    input: CorporateActionImportQuickResolveInput,
  ): Promise<CorporateActionImportResolveResult>;
  runCorporateActionScan(input?: CorporateActionScanInput): Promise<CorporateActionScanResult>;
  listCorporateActionScanResults(input?: CorporateActionScanListInput): Promise<CorporateActionScanResult>;
  getWatchlists(): Promise<Watchlist[]>;
  createWatchlist(input: WatchlistCreateInput): Promise<Watchlist>;
  renameWatchlist(input: WatchlistRenameInput): Promise<Watchlist>;
  deleteWatchlist(input: WatchlistDeleteInput): Promise<{ success: boolean }>;
  addToWatchlist(input: { watchlistId: number; symbol: string; exchange: string }): Promise<{ success: boolean }>;
  removeFromWatchlist(input: { watchlistId: number; symbol: string; exchange: string }): Promise<{ success: boolean }>;
  applyOfficialWatchlistUpdate(input: OfficialWatchlistUpdateInput): Promise<{ success: boolean }>;
  replaceSourceLinkedWatchlist(input: SourceLinkedWatchlistReplaceInput): Promise<{ success: boolean }>;
  fetchOfficialWatchlistSource(input: OfficialWatchlistSourceFetchInput): Promise<string>;
  pickCsvFiles(): Promise<string[]>;
  previewCsv(filePath: string): Promise<CsvPreview>;
  importCsv(options: ImportOptions): Promise<ImportResult>;
  getLatestManualImportRecovery(): Promise<ManualImportRecoverySummary | null>;
  listManualImportRecoveryHistory(): Promise<ManualImportRecoverySummary[]>;
  undoManualImportRecovery(input: { sessionId: string }): Promise<ManualImportUndoResult>;
  downloadBhavcopy(date?: string): Promise<DownloadResult>;
  downloadBhavcopyBatch(config: BatchDownloadConfig): Promise<DownloadResult[]>;
  getBhavcopySettings(): Promise<BhavcopySettings>;
  saveBhavcopySettings(settings: BhavcopySettings): Promise<{ success: boolean }>;
  getBhavcopyDefaultTemplates(): Promise<BhavcopyDefaultTemplates>;
  listMarketHolidays(): Promise<MarketHoliday[]>;
  addMarketHoliday(date: string, name: string): Promise<MarketHoliday>;
  deleteMarketHoliday(id: number): Promise<void>;
  getSavedLayouts(): Promise<Array<{ name: string; timestamp: string }>>;
  saveLayout(name: string, layoutData: string): Promise<{ success: boolean }>;
  loadLayout(name: string): Promise<string | null>;
  deleteLayout(name: string): Promise<{ success: boolean }>;
  getSetting(key: string): Promise<string | null>;
  setSetting(input: { key: string; value: string }): Promise<{ success: boolean }>;
  validateBinaryParity(input: ValidateBinaryParityInput): Promise<ValidationReport>;
  onMenuCommand(callback: (command: string, payload?: unknown) => void): () => void;
  onImportProgress(callback: (pct: number, message: string) => void): () => void;
  onQuoteDeleteProgress(callback: (event: QuoteDeleteProgressEvent) => void): () => void;
  onCorporateActionProgress(callback: (pct: number, message: string) => void): () => void;
  onDownloadProgress(callback: (pct: number, message: string) => void): () => void;
  onDownloadResult(callback: (result: DownloadResult) => void): () => void;
  onDailyMarketSnapshotProgress(
    callback: (event: DailyMarketSnapshotProgressEvent) => void,
  ): () => void;
  onDnnResearchExportProgress(
    callback: (event: DnnResearchDatasetExportProgressEvent) => void,
  ): () => void;
  onDatabaseChanged(callback: (snapshot: AppSnapshot) => void): () => void;
}

export interface EodChartTestBridge {
  createChartTab(): void;
  activateChartTab(tabId: string): void;
  loadInstrument(input: { symbol: string; exchange: string; meta?: InstrumentSummary | null }): Promise<void>;
  getState(): {
    activeChartTabId: string;
    chartTabs: Array<{
      id: string;
      title: string;
      instrument: InstrumentKey | null;
      timeframe: 'D' | 'W' | 'M' | 'Q' | 'Y';
      displayBarCount: number;
      rawBarCount: number;
    }>;
    snapshot: AppSnapshot | null;
  };
}

declare global {
  interface Window {
    __EOD_CHART_TEST__?: EodChartTestBridge;
  }
}

// R1-A read-only diagnostic contract. No mutation authority.
export interface CorporateActionReconciliationPreflightInput {
  importIds: number[];
  expectedDatabasePath: string;
  requestToken: string;
}

export type R1ACheckState = 'PASS' | 'BLOCKED' | 'NOT_EVALUATED' | 'ERROR';
export type R1AOutcome =
  | 'ALREADY_LINKED_REVIEW'
  | 'READY_FOR_EXISTING_APPROVAL_RECHECK'
  | 'REPAIR_CANDIDATE'
  | 'EVIDENCE_BLOCKED'
  | 'DEFERRED_SCOPE'
  | 'CLASSIFICATION_REVIEW'
  | 'MISSING_IMPORT'
  | 'PREPARATION_ERROR';

export interface R1AEvidenceReference {
  owner: string;               // Existing module/function owner, not a permission.
  kind: string;                // E.g. IMPORT, ISIN_HISTORY, EVENT_IDENTITY, SCAN.
  recordId: number | null;
  fingerprint: string | null;
}

export interface CorporateActionReconciliationBlocker {
  code: string;                // One of the Design R1 section 8 codes.
  stage: 'REQUEST' | 'SCOPE' | 'IDENTITY' | 'TERMS' | 'CANONICAL' | 'PRICE' | 'POLICY';
  severity: 'BLOCKING' | 'WARNING' | 'INFORMATION';
  message: string;
  evidence: R1AEvidenceReference[];
  nextOperation: string;       // Descriptive owner operation; never executed here.
  retryableReadOnly: boolean;
}

export interface R1ACandidate {
  symbol: string;
  exchange: string;
  isin: string | null;
  isActive: boolean;
  evidence: R1AEvidenceReference[];
}

export interface R1ARepairPlanItem {
  operation: string;
  owner: string;
  availability:
    | 'EXISTING_OWNER_REQUIRES_SEPARATE_EXECUTION'
    | 'CANDIDATE_REQUIRES_R1B_PROOF'
    | 'NEEDS_EXTERNAL_EVIDENCE'
    | 'NEEDS_SEPARATE_DATA_REPAIR'
    | 'NO_SAFE_REPAIR_ESTABLISHED';
  prerequisites: string[];
  evidence: R1AEvidenceReference[];
  executed: false;
}

export interface CorporateActionReconciliationPreflightRow {
  importId: number;
  exists: boolean;
  exchange: string | null;
  symbol: string | null;
  actionType: string | null;
  exDate: string | null;
  recordDate: string | null;
  purposeRaw: string | null;
  rowFingerprint: string;      // Missing-row sentinel also has a deterministic digest.
  storedState: {
    reviewStatus: string | null;
    parseStatus: string | null;
    approvedCorporateActionId: number | null;
  };
  identity: {
    rawSymbol: string | null;
    rawIsin: string | null;
    eventSymbol: string | null;
    eventIsin: string | null;
    candidates: R1ACandidate[];
    proofState: R1ACheckState;
    proofOwner: string | null;
    proofDescription: string | null;
    evidence: R1AEvidenceReference[];
  };
  classification: {
    state: 'ORDINARY_SPLIT' | 'ORDINARY_BONUS' | 'SUPPORTED_COMPOUND_REVIEW'
      | 'OTHER_SECURITY_REVIEW' | 'CONFLICT' | 'UNPARSED' | 'OUTSIDE_REQUEST_SCOPE';
    storedShareFactor: number | null;
    proposedShareFactor: number | null;
    proposedPriceFactor: number | null;
    proposalOnly: true;
  };
  canonical: {
    state: 'NONE' | 'CANDIDATE_ONLY' | 'OWNER_MATCH_REQUIRES_RECHECK'
      | 'MULTIPLE_OR_CONFLICTING' | 'LINKED_RECORD_PRESENT';
    linkedId: number | null;
    ownerMatchCandidateId: number | null;
    candidateIds: number[];
    evidence: R1AEvidenceReference[];
  };
  price: {
    scanId: number | null;
    scanRunId: number | null;
    scannedAt: string | null;
    scanStatus: string | null;
    confidence: number | null;
    expectedFactor: number | null;
    previousTradeDate: string | null;
    exTradeDate: string | null;
    previousClose: number | null;
    exOpen: number | null;
    exClose: number | null;
    rowFingerprintCheck: R1ACheckState;
    compoundFingerprintCheck: R1ACheckState;
    rawPriceRevalidation: 'NOT_RUN'; // V1 has no new price scan execution path.
  };
  ordinaryReadiness: {
    state: 'READY_FOR_WRITER_RECHECK' | 'BLOCKED' | 'ALREADY_LINKED' | 'NOT_EVALUATED' | 'ERROR';
    message: string;
  };
  safeV1: {
    policyVersion: 'AUTO_APPROVAL_SAFE_V1';
    state: 'ELIGIBLE_AT_READ_SNAPSHOT' | 'INELIGIBLE' | 'ALREADY_APPROVED' | 'NOT_EVALUATED' | 'ERROR';
    reason: string | null;
    evidence: R1AEvidenceReference[];
  };
  blockers: CorporateActionReconciliationBlocker[];
  repairPlan: R1ARepairPlanItem[];
  outcome: R1AOutcome;
  blocksInScopeCompleteness: boolean | null;
}

export interface CorporateActionReconciliationPreflightResult {
  version: 'CA_RECONCILIATION_PREFLIGHT_V1';
  status: 'COMPLETE' | 'PARTIAL' | 'REJECTED';
  requestToken: string;
  generatedAt: string;           // ISO-8601 with timezone.
  databaseContext: {
    canonicalDatabasePath: string;
    databaseFileIdentity: string;
    schemaFingerprint: string;
    readContext: 'CONSISTENT_READ_TRANSACTION' | 'REJECTED_BEFORE_READ';
    selectionSource: 'EXISTING_CACHED_ACTIVE_FOLDER';
    buildIdentity: string;
  } | null;
  selection: {
    requestedCount: number;
    uniqueCount: number;
    duplicateCount: number;
    uniqueImportIds: number[];
    idSetFingerprint: string | null;
  };
  fingerprint: string | null;
  readOnly: true;
  executedRepairs: 0;
  approvalWrites: 0;
  rows: CorporateActionReconciliationPreflightRow[];
  globalBlockers: CorporateActionReconciliationBlocker[];
  summary: {
    accountedFor: number;
    outcomeCounts: Record<R1AOutcome, number>;
    inScopeBlockedRows: number;
    applicabilityUnknownRows: number;
    deferredRows: number;
    coverageCertification: 'NOT_ASSESSED';
    databaseComplete: false;
  };
}
