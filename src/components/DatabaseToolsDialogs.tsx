import { HistoricalApplyStatus } from '@/features/corporateActions/identity/HistoricalApplyStatus';
import { HistoricalApplyHistory } from '@/features/corporateActions/identity/HistoricalApplyHistory';
import { historicalChangeCount } from '@/features/corporateActions/identity/historicalApplyModel';
import { identityDisplayKey, useIdentityDisplayPreferences } from '@/features/corporateActions/identity/identityDisplayPreferences';
import { IdentityHistoricalPreview } from '@/features/corporateActions/identity/IdentityHistoricalPreview';
import { IdentityApplyStatus } from '@/features/corporateActions/identity/IdentityApplyStatus';
import { IdentityApplyHistory } from '@/features/corporateActions/identity/IdentityApplyHistory';
import type { IdentityApplyProgress } from '@/types/desktop';
import { IdentityImportWorkspace } from '@/features/corporateActions/identity/IdentityImportWorkspace';
import { BseNameHistoryReports, useBseNameHistory } from '@/features/corporateActions/identity/BseNameHistory';
import { currentIdentityReview, nseHistoricalReview, useIdentityApplyConfirmation } from '@/features/corporateActions/identity/IdentityApplyConfirmation';
import { IdentitySourceHistory } from '@/features/corporateActions/identity/IdentitySourceHistory';
import { IdentitySourceHealth } from '@/features/corporateActions/identity/IdentitySourceHealth';
import { IdentityPreviewTable } from '@/features/corporateActions/identity/IdentityPreviewTable';
import { identityHasActionableChanges, identityHealthSummary, identityPreviewState } from '@/features/corporateActions/identity/identityImportModel';
import { CorporateActionReconciliationPanel } from '@/features/corporateActions/reconciliation/CorporateActionReconciliationPanel';
import { CorporateActionClassicWorkspace, CorporateActionClassicMenu, CorporateActionClassicDialog } from '@/features/corporateActions/workspace/CorporateActionClassicWorkspace';
import { CLASSIC_ACTION_TYPES, type ClassicActionRow, type ClassicStatus } from '@/features/corporateActions/workspace/corporateActionClassicModel';
import { isInformationalCorporateAnnouncement } from '@/features/corporateActions/legacy/corporateActionAnnouncementClassification';
import { APPROVAL_HISTORY_PAGE_SIZE, appendApprovalHistoryPage, describeDividendDispatchFailure, formatApprovalTime } from '@/features/corporateActions/legacy/corporateActionApprovalReports';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  getDesktopApi,
  requireDesktopShellApi,
  type BseCurrentUniverseSyncResult,
  type CorporateActionInput,
  type CorporateActionAutoApprovalResult,
  type CorporateActionActivityRun,
  type CorporateActionEventIdentity,
  type CorporateActionImportActionType,
  type CorporateActionImportResolutionHint,
  type CorporateActionImportResolutionSuggestion,
  type CorporateActionImportRow,
  type CorporateActionResult,
  type CorporateActionScanResultRow,
  type CorporateActionValidationReportItem,
  type HistoricalCapitalActionBackfillBatchResult,
  type HistoricalCapitalActionBackfillResult,
  type HistoricalCapitalActionBackfillRunRow,
  type HistoricalCapitalActionAliasCandidate,
  type HistoricalCapitalActionMajorLiquidCandidate,
  type HistoricalCapitalActionSparseCandidate,
  type InstrumentSummary,
  type MergeSymbolsInput,
  type NseCurrentUniverseSyncResult,
  type NseHistoricalIdentityResult,
  type OfficialSourceHealthReport,
  type OfficialSourceHealthResult,
  type FindOfficialSourceReplacementCandidatesInput,
  type OfficialSourceCandidateReviewPlan,
  type OfficialSourceHistoryEntry,
  type OfficialSourceRollbackReview,
  type OfficialSourceReplacementCandidatesResult,
  type OfficialSourceConfigurationAuthority,
  type OfficialSourceUrls,
  type QuoteInput,
  type QuoteDeleteProgressEvent,
  type QuoteRow,
} from '@/platform';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import { useWindowStore } from '@/store/windowStore';
import { FloatingWindow } from '@/components/FloatingWindow';
import { BinaryEodParityDialog } from './BinaryEodParityDialog';
import { chunkCorporateIdentityRecommendationIds } from '@/features/corporateActions/corporateActionIdentityRecommendations';
import { addIndiaIsoDays, indiaIsoDate } from '@/features/corporateActions/corporateActionDate';
import {
  QUOTE_EDITOR_EXCHANGE_OPTIONS,
  QUOTE_EDITOR_TABLE_CELL_STYLE,
  formatQuoteEditorAllLoadSummary,
  buildAllExchangeDeleteConfirmation,
  normalizeQuoteEditorExchangeScope,
  quoteEditorExchangeLabel,
  resolveQuoteEditorWriteExchange,
  summarizeQuoteEditorRowsByExchange,
} from '@/features/quoteEditor/quoteEditorExchangeScope';
import {
  selectCorporateActionApprovalTargetRows,
  expandOfficialImportActionTypes,
  officialImportUserStatus,
  summarizeOfficialImportReadiness,
  selectCorporateActionIdentityDetailIds,
} from '@/features/corporateActions/corporateActionBulkApproval';
import {
  classifyCorporateActionValidation,
  formatCorporateActionDescription,
  getCorporateActionApprovalState,
  getCorporateActionNormalApprovalState,
  getCorporateActionIdentityLabel,
  getPriceMultiplier,
  getResidualGapPct,
  getTheoreticalExPrice,
  isSplitOrBonus,
} from '@/features/corporateActions/corporateActionValidation';

import {
  getCorporateActionEffectiveValidationFactor,
  getCorporateActionPriceValidationPresentation,
} from '@/features/corporateActions/corporateActionCompoundValidation';
import {
  formatCorporateActionEventIdentityLabel,
  formatCorporateActionEventIdentityTitle,
  formatCorporateActionEventIsin,
} from '@/features/corporateActions/corporateActionEventIdentityPresentation';
import {
  fetchOfficialCorporateActionsAndReload,
  recheckReviewedCorporateActionImports,
  applyReviewedCorporateActionBatches,
  reconcilePreparedCorporateActionRows,
  type OfficialImportOperationProgress,
  type CorporateActionPendingPreparationProgress,
  loadCorporateActionImportRows,
  prepareCorporateActionPendingImports,
} from '@/features/corporateActions/legacy/corporateActionImportOperations';
import {
  buildCorporateActionDividendPreparedScope,
  type CorporateActionDividendPreparedScope,
  normalizeCorporateActionPreparedScopeDatabasePath,
} from '@/features/corporateActions/legacy/corporateActionDividendPreparedScope';
import { refreshCorporateActionQueueAfterApproval } from '@/features/corporateActions/legacy/corporateActionPostApprovalRefresh';
import { corporateActionSearchRank } from '@/features/corporateActions/workspace/corporateActionQuickSearch';
import {
  CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_ENABLED,
  CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_MAX_IDS,
  prepareDividendWriteStageDraft,
  isDividendWriteStageDraftCurrent,
  verifyDividendWriteStageReceipt,
  type DividendWriteStageDraft,
} from '@/features/corporateActions/legacy/corporateActionDividendWriteStageOrchestration';
import {
  evaluateCorporateActionDividendPreparedScopeBatches,
  type CorporateActionDividendPreparedScopeOutcomeState,
} from '@/features/corporateActions/legacy/corporateActionDividendPreparedScopeOrchestration';
import { formatDividendBlockerReport, summarizeDividendBlockerReasons } from '@/features/corporateActions/legacy/corporateActionDividendBlockerSummary';
import { buildCorporateActionValidationReportSaveInput } from '@/features/corporateActions/legacy/corporateActionValidationHistory';
import { isLaterCorporateAction, immediateCorporateActionValidationRows } from '@/features/corporateActions/legacy/corporateActionLater';
import { summarizeCaPendingByType, formatCaPendingTypeReport } from '@/features/corporateActions/legacy/corporateActionAllTypeReadinessSummary';
import {
  IDENTITY_RECOVERY_DOCUMENTS,
  type IdentityRecoveryDocument,
} from '@/features/identityRecovery/identityRecoveryDocuments';
import { formatOfficialSourceHealthMarkdown } from '@/features/identityRecovery/officialSourceHealthExport';
import {
  formatCorporateActionNormalFetchScope,
  formatCorporateActionNormalLastFetch,
  readCorporateActionNormalLastFetch,
  writeCorporateActionNormalLastFetch,
  type CorporateActionNormalLastFetchRecord,
} from '@/features/corporateActions/workflow/corporateActionNormalFetchHistory';

interface QuoteFormState {
  date: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

type QuoteEditorMode = 'currentSymbolAllQuotes' | 'allSymbolsSingleDate';

function initialQuoteEditorMode(): QuoteEditorMode {
  return 'currentSymbolAllQuotes';
}

const CORPORATE_IMPORT_LOAD_STEP = 1000;
const CORPORATE_SCAN_LOAD_STEP = 1000;
const CORPORATE_EXPORT_FETCH_PAGE_SIZE = 1000;
const CORPORATE_EXPORT_HINT_BATCH_SIZE = 1000;
const CORPORATE_EVENT_IDENTITY_BATCH_SIZE = 500;
const HISTORICAL_BACKFILL_RUN_PAGE_SIZE = 10;
const ISSUE_EXPORT_CANCELLED_MESSAGE = 'Review-issues export cancelled by user.';
const CORPORATE_IMPORT_FILTER_TYPES: CorporateActionImportActionType[] = ['SPLIT', 'BONUS', 'RIGHTS', 'DIVIDEND', 'DEMERGER'];
type OfficialSourceUrlExchange = 'NSE' | 'BSE';


const DEFAULT_OFFICIAL_SOURCE_URLS: OfficialSourceUrls = {
  nseSecuritiesAvailablePageUrl: 'https://www.nseindia.com/static/market-data/securities-available-for-trading',
  nseEquityMasterUrl: 'https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv',
  nseSmeMasterUrl: 'https://nsearchives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv',
  nseSymbolChangeUrl: 'https://nsearchives.nseindia.com/content/equities/symbolchange.csv',
  nseCompanyNameChangeUrl: 'https://nsearchives.nseindia.com/content/equities/namechange.csv',
  nseDelistedPageUrl: 'https://www.nseindia.com/static/list/list-of-companies-proposed-to-be-delisted',
  nseDelistedWorkbookUrl:
    'https://nsearchives.nseindia.com/web/sites/default/files/inline-files/List%20of%20delisted%20Companies.xlsx',
  bseListScripsUrlPrefix:
    'https://api.bseindia.com/BseIndiaAPI/api/LitsOfScripCSVDownload/w?Group=&Scripcode=&segment=Equity&status=',
  bseListScripsReferer: 'https://www.bseindia.com/corporates/List_Scrips.html',
};

type InstrumentReloadOptions = {
  forceReload?: boolean;
  preserveViewport?: boolean;
};

type OfficialImportView = 'review' | 'approved';
type OfficialImportSection = 'review' | 'fetch' | 'history';
type OfficialFetchExchangeSelection = 'BOTH' | 'NSE' | 'BSE';

type NseReviewedApplyAuthority = {
  planSha256: string;
  activeDatabasePath: string;
  sourceMode: 'official' | 'manual';
  requestedArchiveRootPath: string | null;
};

type NseHistoricalIdentityFilter =
  | 'actionable'
  | 'all'
  | 'duplicates'
  | 'skipped'
  | 'errors';

type NseHistoricalReviewedApplyAuthority = {
  planSha256: string;
  activeDatabasePath: string;
  sourceMode: 'official' | 'manual';
  requestedArchiveRootPath: string | null;
};

type ResolveCandidateOption = {
  symbol: string;
  exchange: string;
  name?: string | null;
  series?: string | null;
  isin?: string | null;
  isActive?: boolean;
  reason?: string | null;
};

type IssueExportProgressState = {
  pagesFetched: number;
  unresolvedRowsFetched: number;
  hintBatchesCompleted: number;
  hintBatchesTotal: number;
  matchingRowsToWrite: number;
};

type HistoricalBackfillSourceAttempt = HistoricalCapitalActionBackfillResult['sourceAttempts'][number];
type HistoricalBackfillBatchSymbolResult = HistoricalCapitalActionBackfillBatchResult['symbolResults'][number];

function matchesInstrumentKey(
  instrument: { symbol: string; exchange: string } | null | undefined,
  symbol: string,
  exchange: string,
): boolean {
  if (!instrument) {
    return false;
  }

  return instrument.symbol === symbol && instrument.exchange === exchange;
}

function activeTabMatchesInstrument(
  activeTab: ReturnType<typeof getActiveChartTab>,
  symbol: string,
  exchange: string,
): boolean {
  return (
    matchesInstrumentKey(activeTab?.instrument, symbol, exchange) ||
    matchesInstrumentKey(activeTab?.requestedInstrument, symbol, exchange)
  );
}

function normalizeOfficialSourceUrls(value: Partial<OfficialSourceUrls>): OfficialSourceUrls {
  return {
    nseSecuritiesAvailablePageUrl: cleanUrl(
      value.nseSecuritiesAvailablePageUrl,
      DEFAULT_OFFICIAL_SOURCE_URLS.nseSecuritiesAvailablePageUrl,
    ),
    nseEquityMasterUrl: cleanUrl(value.nseEquityMasterUrl, DEFAULT_OFFICIAL_SOURCE_URLS.nseEquityMasterUrl),
    nseSmeMasterUrl: cleanUrl(value.nseSmeMasterUrl, DEFAULT_OFFICIAL_SOURCE_URLS.nseSmeMasterUrl),
    nseSymbolChangeUrl: cleanUrl(value.nseSymbolChangeUrl, DEFAULT_OFFICIAL_SOURCE_URLS.nseSymbolChangeUrl),
    nseCompanyNameChangeUrl: cleanUrl(
      value.nseCompanyNameChangeUrl,
      DEFAULT_OFFICIAL_SOURCE_URLS.nseCompanyNameChangeUrl,
    ),
    nseDelistedPageUrl: cleanUrl(value.nseDelistedPageUrl, DEFAULT_OFFICIAL_SOURCE_URLS.nseDelistedPageUrl),
    nseDelistedWorkbookUrl: cleanUrl(
      value.nseDelistedWorkbookUrl,
      DEFAULT_OFFICIAL_SOURCE_URLS.nseDelistedWorkbookUrl,
    ),
    bseListScripsUrlPrefix: cleanUrl(
      value.bseListScripsUrlPrefix,
      DEFAULT_OFFICIAL_SOURCE_URLS.bseListScripsUrlPrefix,
    ),
    bseListScripsReferer: cleanUrl(value.bseListScripsReferer, DEFAULT_OFFICIAL_SOURCE_URLS.bseListScripsReferer),
  };
}

function cleanUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed || fallback;
}

const ER4_CANDIDATE_CLASSIFICATION_LABELS = [
  'DISCOVERED_NOT_PROMOTED',
  'VALIDATED_CANDIDATE_NOT_PROMOTED',
  'INDETERMINATE_CANDIDATE',
  'REJECTED_CANDIDATE',
] as const;

function getEr4RecoveryRequestForHealthResult(
  result: OfficialSourceHealthResult,
): FindOfficialSourceReplacementCandidatesInput | null {
  if (result.exchange !== 'NSE') {
    return null;
  }

  const sourceKeyByHealthId: Record<string, string> = {
    NSE_EQUITY_MASTER: 'NSE_CURRENT_EQUITY_MASTER',
    NSE_SME_MASTER: 'NSE_CURRENT_SME_MASTER',
    NSE_SYMBOL_CHANGE: 'NSE_SYMBOL_CHANGE_HISTORY',
    NSE_COMPANY_NAME_CHANGE: 'NSE_COMPANY_NAME_CHANGE_HISTORY',
    NSE_DELISTED_WORKBOOK: 'NSE_DELISTED_COMPANIES_WORKBOOK',
  };
  const sourceKey = sourceKeyByHealthId[result.sourceId];
  if (!sourceKey) {
    return null;
  }

  let triggerCategory: FindOfficialSourceReplacementCandidatesInput['triggerCategory'] | null = null;
  if (result.provenanceStatus === 'FAIL') {
    triggerCategory = 'PROVENANCE_FAILURE';
  } else if (result.transportStatus === 'FAIL') {
    triggerCategory =
      result.httpStatus != null && (result.httpStatus < 200 || result.httpStatus >= 300)
        ? 'HTTP_FAILURE'
        : 'TRANSPORT_FAILURE';
  } else if (result.formatStatus === 'FAIL') {
    triggerCategory = 'FORMAT_OR_SCHEMA_FAILURE';
  } else if (result.populationStatus === 'FAIL') {
    triggerCategory = 'POPULATION_FAILURE';
  } else if (
    result.freshnessStatus === 'FAIL' ||
    (result.driftClass != null && result.driftClass !== 'COMPATIBLE')
  ) {
    triggerCategory = 'SEMANTIC_FAILURE';
  }

  return triggerCategory ? { sourceKey, triggerCategory } : null;
}

function buildCorporateActionRefreshNote({
  actionType,
  symbol,
  exchange,
  activeInstrument,
  activeRequestedInstrument,
  adjustedMode,
  includeDividendAdjustments,
  includeRightsAdjustments,
}: {
  actionType: CorporateActionInput['actionType'];
  symbol: string;
  exchange: string;
  activeInstrument: { symbol: string; exchange: string } | null;
  activeRequestedInstrument: { symbol: string; exchange: string } | null;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
}): string | null {
  const matchesActiveChart =
    matchesInstrumentKey(activeInstrument, symbol, exchange) ||
    matchesInstrumentKey(activeRequestedInstrument, symbol, exchange);
  if (!matchesActiveChart) {
    return null;
  }

  if (!adjustedMode) {
    return 'The active chart refreshed in Raw mode. Switch Chart > Price Mode > Adjusted to see adjusted price history.';
  }

  if (actionType === 'DIVIDEND' && !includeDividendAdjustments) {
    return 'The active chart refreshed, but dividend adjustments are off. Enable dividend adjustments in chart settings to see dividend-adjusted price history.';
  }

  if (actionType === 'RIGHTS' && !includeRightsAdjustments) {
    return 'The active chart refreshed, but rights adjustments are off. Enable rights adjustments in chart settings to see rights-adjusted price history.';
  }

  return 'The active chart refreshed immediately.';
}

export function DatabaseToolsDialogs() {
  const snapshot = useChartStore((state) => state.snapshot);
  const chartTabs = useChartStore((state) => state.chartTabs);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const adjustedMode = useChartStore((state) => state.adjustedMode);
  const includeDividendAdjustments = useChartStore((state) => state.includeDividendAdjustments);
  const includeRightsAdjustments = useChartStore((state) => state.includeRightsAdjustments);
  const refreshSnapshot = useChartStore((state) => state.refreshSnapshot);
  const loadInstrument = useChartStore((state) => state.loadInstrument);

  const quoteEditorOpen = useUiStore((state) => state.quoteEditorOpen);
  const quoteEditorOpenRequestCount = useUiStore((state) => state.quoteEditorOpenRequestCount);
  const closeQuoteEditor = useUiStore((state) => state.closeQuoteEditor);

  const mergeSymbolsOpen = useUiStore((state) => state.mergeSymbolsOpen);
  const mergeSymbolsOpenRequestCount = useUiStore((state) => state.mergeSymbolsOpenRequestCount);
  const closeMergeSymbols = useUiStore((state) => state.closeMergeSymbols);

  const corporateActionOpen = useUiStore((state) => state.corporateActionOpen);
  const corporateActionOpenRequestCount = useUiStore((state) => state.corporateActionOpenRequestCount);
  const closeCorporateAction = useUiStore((state) => state.closeCorporateAction);

  const binaryEodParityOpen = useUiStore((state) => state.binaryEodParityOpen);

  const activeTab = getActiveChartTab(chartTabs, activeChartTabId);
  const activeInstrument = activeTab?.instrument ?? null;
  const activeRequestedInstrument = activeTab?.requestedInstrument ?? null;
  const hasDatabase = Boolean(snapshot?.activeDatabasePath);

  return (
    <>
      {quoteEditorOpen ? (
        <QuoteEditorDialog
          activeInstrument={activeInstrument}
          hasDatabase={hasDatabase}
          onClose={closeQuoteEditor}
          onRefresh={refreshSnapshot}
          openRequestCount={quoteEditorOpenRequestCount}
          onReloadInstrument={async (symbol, exchange, options) => {
            if (activeTabMatchesInstrument(activeTab, symbol, exchange)) {
              await loadInstrument({ symbol, exchange }, null, options);
            }
          }}
        />
      ) : null}
      {mergeSymbolsOpen ? (
        <MergeSymbolsDialog
          activeInstrument={activeInstrument}
          hasDatabase={hasDatabase}
          onClose={closeMergeSymbols}
          onRefresh={refreshSnapshot}
          openRequestCount={mergeSymbolsOpenRequestCount}
          onReloadInstrument={async (sourceSymbol, sourceExchange, targetSymbol, targetExchange, options) => {
            if (!activeTab) {
              return;
            }

            if (
              activeTabMatchesInstrument(activeTab, sourceSymbol, sourceExchange) ||
              activeTabMatchesInstrument(activeTab, targetSymbol, targetExchange)
            ) {
              await loadInstrument({ symbol: targetSymbol, exchange: targetExchange }, null, options);
            }
          }}
        />
      ) : null}
      {corporateActionOpen ? (
        <CorporateActionDialog
          activeInstrument={activeInstrument}
          activeRequestedInstrument={activeRequestedInstrument}
          adjustedMode={adjustedMode}
          includeDividendAdjustments={includeDividendAdjustments}
          includeRightsAdjustments={includeRightsAdjustments}
          hasDatabase={hasDatabase}
          onClose={closeCorporateAction}
          onRefresh={refreshSnapshot}
          openRequestCount={corporateActionOpenRequestCount}
          onReloadInstrument={async (symbol, exchange, options) => {
            if (activeTabMatchesInstrument(activeTab, symbol, exchange)) {
              await loadInstrument({ symbol, exchange }, null, options);
            }
          }}
        />
      ) : null}
      {binaryEodParityOpen ? <BinaryEodParityDialog /> : null}
    </>
  );
}

function QuoteEditorDialog({
  activeInstrument,
  hasDatabase,
  onClose,
  onRefresh,
  openRequestCount,
  onReloadInstrument,
}: {
  activeInstrument: { symbol: string; exchange: string } | null;
  hasDatabase: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  openRequestCount: number;
  onReloadInstrument: (
    symbol: string,
    exchange: string,
    options?: InstrumentReloadOptions,
  ) => Promise<void>;
}) {
  const api = getDesktopApi();
  const QUOTE_EDITOR_WINDOW_ID = 'quote-editor';

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [symbol, setSymbol] = useState(activeInstrument?.symbol ?? '');
  const [exchange, setExchange] = useState(activeInstrument?.exchange ?? 'ALL');
  const [selectedQuoteExchange, setSelectedQuoteExchange] = useState<string | null>(null);
  const [mode, setMode] = useState<QuoteEditorMode>(initialQuoteEditorMode);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [selectedQuoteKey, setSelectedQuoteKey] = useState<string | null>(null);
  const [form, setForm] = useState<QuoteFormState>(createEmptyQuoteForm());
  const [deleteFromDate, setDeleteFromDate] = useState(todayIso());
  const [deleteToDate, setDeleteToDate] = useState(todayIso());
  const [loadedAllSymbolsDate, setLoadedAllSymbolsDate] = useState<string | null>(null);
  const [loadedAllSymbolsCount, setLoadedAllSymbolsCount] = useState<number>(0);
  const [status, setStatus] = useState<string>('');
  const [quoteDeleteProgress, setQuoteDeleteProgress] = useState<QuoteDeleteProgressEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const quotesBodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registerWindow({
      id: QUOTE_EDITOR_WINDOW_ID,
      title: 'Quotations Editor',
      bounds: {
        x: 100,
        y: 60,
        width: 1100,
        height: 700,
      },
      minWidth: 800,
      minHeight: 500,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (!hasDatabase) {
      setStatus('Open a database first.');
      setQuotes([]);
      setSelectedQuoteKey(null);
      setSelectedQuoteExchange(null);
      setForm(createEmptyQuoteForm());
      setDeleteFromDate(todayIso());
      setDeleteToDate(todayIso());
      setLoadedAllSymbolsDate(null);
      setLoadedAllSymbolsCount(0);
      setQuoteDeleteProgress(null);
      return;
    }

    setStatus('');
  }, [hasDatabase]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }

    return api.onQuoteDeleteProgress((event) => {
      setQuoteDeleteProgress(event);
      setStatus(event.message);
    });
  }, [api]);

  useEffect(() => {
    if (openRequestCount > 0) {
      openWindow(QUOTE_EDITOR_WINDOW_ID);
      focusWindow(QUOTE_EDITOR_WINDOW_ID);
    }
  }, [openRequestCount, openWindow, focusWindow]);

  const switchQuoteEditorMode = (nextMode: QuoteEditorMode) => {
    if (nextMode === mode) {
      return;
    }

    const nextDate = form.date || todayIso();
    setMode(nextMode);
    setQuotes([]);
    setSelectedQuoteKey(null);
    setSelectedQuoteExchange(null);
    setLoadedAllSymbolsDate(null);
    setLoadedAllSymbolsCount(0);
    setQuoteDeleteProgress(null);
    setStatus('');
    setDeleteFromDate(nextDate);
    setDeleteToDate(nextDate);

    if (nextMode === 'currentSymbolAllQuotes') {
      setSymbol(activeInstrument?.symbol ?? '');
      const currentScope = normalizeQuoteEditorExchangeScope(exchange);
      setExchange(activeInstrument?.exchange ?? (currentScope && currentScope !== 'ALL' ? currentScope : 'NSE'));
      setForm(createEmptyQuoteForm());
      return;
    }

    setExchange('ALL');
    setSymbol('');
    setForm(createEmptyQuoteForm(nextDate));
  };

  const loadQuotes = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setQuoteDeleteProgress(null);
    setStatus(
      mode === 'currentSymbolAllQuotes'
        ? 'Loading symbol quotes...'
        : `Loading ${quoteEditorExchangeLabel(exchange)} quotes for ${form.date}...`,
    );
    try {
      const normalizedExchange = normalizeQuoteEditorExchangeScope(exchange) ?? 'ALL';
      let rows: QuoteRow[] = [];

      if (mode === 'currentSymbolAllQuotes') {
        if (!symbol.trim()) {
          setStatus('Enter a symbol to load quotes.');
          return;
        }

        if (normalizedExchange === 'ALL') {
          setStatus('Choose a concrete exchange before loading a single symbol.');
          return;
        }

        setLoadedAllSymbolsDate(null);
        setLoadedAllSymbolsCount(0);

        rows = await api.listQuotes({
          symbol: symbol.trim().toUpperCase(),
          exchange: normalizedExchange,
          limit: 500,
        });
      } else {
        rows = await api.listQuotesByDate({
          exchange: normalizedExchange,
          date: form.date,
          limit: normalizedExchange === 'ALL' ? 50000 : 10000,
        });
        setLoadedAllSymbolsDate(form.date);
        setLoadedAllSymbolsCount(rows.length);
      }

      setQuotes(rows);
      if (rows[0]) {
        selectQuoteRow(rows[0], setSelectedQuoteKey, setSymbol, setForm);
        setSelectedQuoteExchange(rows[0].exchange);
        setDeleteFromDate(rows[0].date);
        setDeleteToDate(rows[0].date);
        setStatus(
          mode === 'currentSymbolAllQuotes'
            ? `Loaded ${rows.length} quotes.`
            : normalizedExchange === 'ALL'
              ? formatQuoteEditorAllLoadSummary(
                  form.date,
                  rows.length,
                  summarizeQuoteEditorRowsByExchange(rows),
                )
              : `Loaded ${rows.length} quotes for ${form.date}.`,
        );
      } else {
        setSelectedQuoteKey(null);
        setSelectedQuoteExchange(null);
        setSymbol(mode === 'currentSymbolAllQuotes' ? symbol : '');
        setForm(createEmptyQuoteForm(mode === 'allSymbolsSingleDate' ? form.date : todayIso()));
        const fallbackDate = mode === 'allSymbolsSingleDate' ? form.date : todayIso();
        setDeleteFromDate(fallbackDate);
        setDeleteToDate(fallbackDate);
        setStatus(
          mode === 'currentSymbolAllQuotes'
            ? 'No quotes found for this symbol.'
            : `No quotes found for ${normalizedExchange} on ${form.date}.`,
        );
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load quotes.');
    } finally {
      setBusy(false);
    }
  };

  const saveQuote = async () => {
    if (!api) {
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setStatus(
        mode === 'currentSymbolAllQuotes'
          ? 'Enter a symbol before saving a quote.'
          : 'Select or enter a symbol before saving this date.',
      );
      return;
    }

    const writeExchange = resolveQuoteEditorWriteExchange(exchange, selectedQuoteExchange);
    if (!writeExchange) {
      setStatus('Choose a concrete exchange or select a row before saving while the exchange filter is ALL.');
      return;
    }

    const validationError = validateQuoteForm(form);
    if (validationError) {
      setStatus(validationError);
      return;
    }

    setBusy(true);
    setQuoteDeleteProgress(null);
    setStatus(
      mode === 'currentSymbolAllQuotes'
        ? 'Saving quote...'
        : `Saving ${normalizedSymbol} on ${form.date}...`,
    );
    try {
      const payload = buildQuotePayload(symbol, writeExchange, form);
      const saved = await api.upsertQuote(payload);
      const rows =
        mode === 'currentSymbolAllQuotes'
          ? await api.listQuotes({ symbol: payload.symbol, exchange: payload.exchange, limit: 500 })
          : upsertQuoteRowBySymbol(quotes, saved);
      setQuotes(rows);
      selectQuoteRow(saved, setSelectedQuoteKey, setSymbol, setForm);
      setSelectedQuoteExchange(saved.exchange);
      setDeleteFromDate(saved.date);
      setDeleteToDate(saved.date);
      if (mode === 'allSymbolsSingleDate') {
        setLoadedAllSymbolsDate(saved.date);
        setLoadedAllSymbolsCount(rows.length);
      }
      await onRefresh();
      await onReloadInstrument(payload.symbol, payload.exchange, { forceReload: true, preserveViewport: true });
      setStatus(
        mode === 'currentSymbolAllQuotes'
          ? `Saved ${payload.symbol} ${payload.date}.`
          : `Saved ${payload.symbol} on ${payload.date} and refreshed the date view.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save quote.');
    } finally {
      setBusy(false);
    }
  };

  const deleteQuoteRow = async () => {
    if (!api) {
      return;
    }

    const normalizedExchange = normalizeQuoteEditorExchangeScope(exchange) ?? 'ALL';
    const normalizedFromDate = deleteFromDate || form.date;
    const normalizedToDate = deleteToDate || normalizedFromDate;
    if (!normalizedFromDate || !normalizedToDate) {
      setStatus('Select a delete date or date range first.');
      return;
    }

    const [fromDate, toDate] =
      normalizedFromDate <= normalizedToDate
        ? [normalizedFromDate, normalizedToDate]
        : [normalizedToDate, normalizedFromDate];

    if (mode === 'allSymbolsSingleDate') {
      setBusy(true);
      setQuoteDeleteProgress(null);
      try {
        const singleDateDelete = fromDate === toDate;
        let rowsForDate = singleDateDelete && loadedAllSymbolsDate === fromDate ? quotes : [];
        if (singleDateDelete && (loadedAllSymbolsDate !== fromDate || rowsForDate.length === 0)) {
          setStatus(`Loading ${normalizedExchange} quotes for ${fromDate} before delete...`);
          rowsForDate = await api.listQuotesByDate({
            exchange: normalizedExchange,
            date: fromDate,
            limit: normalizedExchange === 'ALL' ? 50000 : 10000,
          });
          setLoadedAllSymbolsDate(fromDate);
          setLoadedAllSymbolsCount(rowsForDate.length);
          setQuotes(rowsForDate);
          if (rowsForDate[0]) {
            selectQuoteRow(rowsForDate[0], setSelectedQuoteKey, setSymbol, setForm);
            setSelectedQuoteExchange(rowsForDate[0].exchange);
          } else {
            setSelectedQuoteKey(null);
            setSelectedQuoteExchange(null);
            setSymbol('');
            setForm(createEmptyQuoteForm(fromDate));
          }
        }

        if (singleDateDelete && rowsForDate.length === 0) {
          setDeleteFromDate(fromDate);
          setDeleteToDate(fromDate);
          setStatus(`No quotes found for ${normalizedExchange} on ${fromDate}. Nothing to delete.`);
          return;
        }

        if (
          normalizedExchange === 'ALL' &&
          !window.confirm(buildAllExchangeDeleteConfirmation(fromDate, toDate))
        ) {
          setStatus('Delete cancelled.');
          return;
        }

        setStatus(
          singleDateDelete
            ? `Deleting ${rowsForDate.length} quote(s) on ${fromDate} across ${normalizedExchange}...`
            : `Deleting quotes from ${fromDate} to ${toDate} across ${normalizedExchange}...`,
        );
        const result = await api.deleteQuoteDate({
          exchange: normalizedExchange,
          date: fromDate,
          toDate: singleDateDelete ? undefined : toDate,
          symbols:
            singleDateDelete && normalizedExchange !== 'ALL'
              ? rowsForDate.map((row) => row.symbol)
              : undefined,
        });
        if (result.success) {
          setQuotes([]);
          setSelectedQuoteKey(null);
          setSelectedQuoteExchange(null);
          setSymbol('');
          setForm(createEmptyQuoteForm(singleDateDelete ? fromDate : toDate));
          setDeleteFromDate(fromDate);
          setDeleteToDate(singleDateDelete ? fromDate : toDate);
          setLoadedAllSymbolsDate(singleDateDelete ? fromDate : null);
          setLoadedAllSymbolsCount(0);
          await onRefresh();
          if (
            activeInstrument &&
            (normalizedExchange === 'ALL' || activeInstrument.exchange.toUpperCase() === normalizedExchange)
          ) {
            await onReloadInstrument(activeInstrument.symbol, activeInstrument.exchange, {
              forceReload: true,
              preserveViewport: true,
            });
          }
        } else {
          if (singleDateDelete) {
            setLoadedAllSymbolsDate(fromDate);
            setLoadedAllSymbolsCount(rowsForDate.length);
          }
        }
        setStatus(
          result.success
            ? singleDateDelete
              ? `Deleted ${result.deleted} quote(s) on ${fromDate} across ${normalizedExchange}.`
              : `Deleted ${result.deleted} quote(s) from ${fromDate} to ${toDate} across ${normalizedExchange}.`
            : singleDateDelete
              ? `No matching quotes were deleted on ${fromDate}.`
              : `No matching quotes were deleted from ${fromDate} to ${toDate}.`,
        );
        setQuoteDeleteProgress(null);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : 'Could not delete quote.');
        setQuoteDeleteProgress(null);
      } finally {
        setBusy(false);
      }
      return;
    }

    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!normalizedSymbol) {
      setStatus('Enter a symbol before deleting quotes.');
      return;
    }
    if (normalizedExchange === 'ALL') {
      setStatus('Choose a concrete exchange before deleting a single symbol.');
      return;
    }

    setBusy(true);
    setQuoteDeleteProgress(null);
    setStatus('');
    try {
      const result =
        fromDate === toDate
          ? await api.deleteQuote({
              symbol: normalizedSymbol,
              exchange: normalizedExchange,
              date: fromDate,
            })
          : await api.deleteQuoteRange({
              symbol: normalizedSymbol,
              exchange: normalizedExchange,
              fromDate,
              toDate,
            });
      const rows = await api.listQuotes({ symbol: normalizedSymbol, exchange: normalizedExchange, limit: 500 });
      setQuotes(rows);
      if (rows[0]) {
        selectQuoteRow(rows[0], setSelectedQuoteKey, setSymbol, setForm);
        setSelectedQuoteExchange(rows[0].exchange);
        setDeleteFromDate(rows[0].date);
        setDeleteToDate(rows[0].date);
      } else {
        setSelectedQuoteKey(null);
        setSelectedQuoteExchange(null);
        setForm(createEmptyQuoteForm());
        setDeleteFromDate(fromDate);
        setDeleteToDate(toDate);
      }
      await onRefresh();
      await onReloadInstrument(normalizedSymbol, normalizedExchange, { forceReload: true, preserveViewport: true });
      setStatus(
        result.success
          ? fromDate === toDate
            ? `Deleted ${fromDate}.`
            : `Deleted ${result.deleted} quote(s) from ${fromDate} to ${toDate}.`
          : fromDate === toDate
            ? 'No matching quote was deleted.'
            : 'No matching quotes were deleted in the selected range.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not delete quote.');
    } finally {
      setBusy(false);
    }
  };

  const jumpToSelected = () => {
    if (!selectedQuoteKey || !quotesBodyRef.current) {
      return;
    }

    const target = quotesBodyRef.current.querySelector<HTMLButtonElement>(`[data-quote-key="${selectedQuoteKey}"]`);
    target?.scrollIntoView({ block: 'nearest' });
  };

  const handleClose = () => {
    closeWindow(QUOTE_EDITOR_WINDOW_ID);
    onClose();
  };
  const quoteStatusMessage =
    status ||
    (mode === 'currentSymbolAllQuotes'
      ? 'Load a symbol, then edit the selected row from the left pane.'
      : 'Load one date to inspect quotes across all symbols on that session. Delete will auto-load a single date if needed, or delete a selected date range across the exchange.');
  const quoteProgressMessage =
    busy && quoteDeleteProgress
      ? `${quoteDeleteProgress.processedFiles}/${quoteDeleteProgress.totalFiles} files${
          quoteDeleteProgress.currentSymbol ? ` - ${quoteDeleteProgress.currentSymbol}` : ''
        } (${quoteDeleteProgress.percent}%)`
      : null;

  return (
    <FloatingWindow id={QUOTE_EDITOR_WINDOW_ID} onClose={handleClose}>
      <div style={quoteEditorWindowBodyStyle}>
        <div style={quoteEditorLayoutStyle}>
          <div style={quoteEditorLeftPaneStyle}>
            <div style={quoteModePanelStyle}>
              <div style={quotePanelTitleStyle}>Mode</div>
              <label style={utilityCheckboxRowStyle}>
                <input
                  type="radio"
                  checked={mode === 'currentSymbolAllQuotes'}
                  onChange={() => switchQuoteEditorMode('currentSymbolAllQuotes')}
                />
                <span>Single Symbol / Date Range</span>
              </label>
              <label style={utilityCheckboxRowStyle}>
                <input
                  type="radio"
                  checked={mode === 'allSymbolsSingleDate'}
                  onChange={() => switchQuoteEditorMode('allSymbolsSingleDate')}
                />
                <span>All Symbols / Date Tools</span>
              </label>
              <div style={quotePanelNoteStyle}>
                {mode === 'currentSymbolAllQuotes'
                  ? 'Load one symbol and edit its full local quote history.'
                  : 'Load one exchange/date to inspect symbols. Delete supports one date or a date range across all symbols.'}
              </div>
            </div>

            <div style={quoteEditorFormGridStyle}>
              <div style={utilityFieldLabelStyle}>Ticker:</div>
              <div style={quoteEditorTickerExchangeRowStyle}>
                <input
                  value={symbol}
                  onChange={(event) => {
                    setSymbol(event.target.value);
                    if (normalizeQuoteEditorExchangeScope(exchange) === 'ALL') {
                      setSelectedQuoteKey(null);
                      setSelectedQuoteExchange(null);
                    }
                  }}
                  style={utilityInputStyle}
                />
                <select
                  value={normalizeQuoteEditorExchangeScope(exchange) ?? 'ALL'}
                  onChange={(event) => {
                    setExchange(event.target.value);
                    setSelectedQuoteExchange(null);
                    setSelectedQuoteKey(null);
                    setQuotes([]);
                    setLoadedAllSymbolsDate(null);
                    setLoadedAllSymbolsCount(0);
                    if (mode === 'allSymbolsSingleDate') {
                      setSymbol('');
                    }
                    setStatus('');
                  }}
                  style={utilityExchangeInputStyle}
                  aria-label="Quote Editor exchange filter"
                >
                  {QUOTE_EDITOR_EXCHANGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div style={utilityFieldLabelStyle}>Date:</div>
              <input
                type="date"
                value={form.date}
                onChange={(event) => {
                  const value = event.target.value;
                  patchQuoteForm(setForm, 'date', value);
                  if (mode === 'allSymbolsSingleDate') {
                    setSelectedQuoteKey(null);
                    setSelectedQuoteExchange(null);
                    setSymbol('');
                    setDeleteFromDate(value);
                    if (!deleteToDate) {
                      setDeleteToDate(value);
                    }
                  } else if (!selectedQuoteKey) {
                    setDeleteFromDate(value);
                    setDeleteToDate(value);
                  }
                }}
                style={utilityInputStyle}
              />

              <div style={utilityFieldLabelStyle}>
                {mode === 'currentSymbolAllQuotes' ? 'Delete From:' : 'Delete From:'}
              </div>
              <input
                type="date"
                value={deleteFromDate}
                onChange={(event) => {
                  const value = event.target.value;
                  setDeleteFromDate(value);
                }}
                style={utilityInputStyle}
              />

              <>
                <div style={utilityFieldLabelStyle}>
                  {mode === 'currentSymbolAllQuotes' ? 'Delete To:' : 'Delete To:'}
                </div>
                <input
                  type="date"
                  value={deleteToDate}
                  onChange={(event) => setDeleteToDate(event.target.value)}
                  style={utilityInputStyle}
                />
              </>

              <div style={utilityFieldLabelStyle}>Open:</div>
              <input
                type="number"
                step="0.01"
                value={form.open}
                onChange={(event) => patchQuoteForm(setForm, 'open', event.target.value)}
                style={utilityInputStyle}
              />

              <div style={utilityFieldLabelStyle}>High:</div>
              <input
                type="number"
                step="0.01"
                value={form.high}
                onChange={(event) => patchQuoteForm(setForm, 'high', event.target.value)}
                style={utilityInputStyle}
              />

              <div style={utilityFieldLabelStyle}>Low:</div>
              <input
                type="number"
                step="0.01"
                value={form.low}
                onChange={(event) => patchQuoteForm(setForm, 'low', event.target.value)}
                style={utilityInputStyle}
              />

              <div style={utilityFieldLabelStyle}>Close:</div>
              <input
                type="number"
                step="0.01"
                value={form.close}
                onChange={(event) => patchQuoteForm(setForm, 'close', event.target.value)}
                style={utilityInputStyle}
              />

              <div style={utilityFieldLabelStyle}>Volume:</div>
              <input
                type="number"
                step="1"
                min="0"
                value={form.volume}
                onChange={(event) => patchQuoteForm(setForm, 'volume', event.target.value)}
                style={utilityInputStyle}
              />
            </div>

            <div style={quoteEditorActionGridStyle}>
              <button type="button" style={modalButtonStyle} onClick={() => void loadQuotes()} disabled={busy || !hasDatabase}>
                Load
              </button>
              <button
                type="button"
                style={modalButtonStyle}
                onClick={() => {
                  const nextDate =
                    mode === 'allSymbolsSingleDate' ? deleteFromDate || form.date || todayIso() : todayIso();
                  setSelectedQuoteKey(null);
                  setSelectedQuoteExchange(null);
                  if (mode === 'allSymbolsSingleDate') {
                    setSymbol('');
                  }
                  setForm(createEmptyQuoteForm(nextDate));
                  setDeleteFromDate(nextDate);
                  setDeleteToDate(nextDate);
                  setStatus(
                    mode === 'currentSymbolAllQuotes'
                      ? 'Ready to enter a new quote row.'
                      : `Ready to enter or review a single quote for ${nextDate}.`,
                  );
                }}
                disabled={busy}
              >
                New
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => void saveQuote()}
                disabled={busy || !hasDatabase || !symbol.trim()}
              >
                Save
              </button>
              <button
                type="button"
                style={modalButtonStyle}
                onClick={() => void deleteQuoteRow()}
                disabled={
                  busy ||
                  !hasDatabase ||
                  !deleteFromDate ||
                  !deleteToDate ||
                  (mode === 'currentSymbolAllQuotes' && !symbol.trim())
                }
              >
                Delete
              </button>
              <button type="button" style={modalButtonStyle} onClick={jumpToSelected} disabled={!selectedQuoteKey}>
                Go To Selected
              </button>
              <button type="button" style={modalButtonStyle} onClick={handleClose}>
                Close
              </button>
            </div>

          </div>

          <div style={quoteEditorRightPaneStyle}>
            <div style={quoteEditorHeaderRowStyle}>
              <span>
                {mode === 'currentSymbolAllQuotes'
                  ? symbol.trim()
                    ? `${quoteEditorExchangeLabel(exchange)}:${symbol.trim().toUpperCase()}`
                    : 'No symbol loaded'
                  : `${quoteEditorExchangeLabel(exchange)} ${form.date}`}
              </span>
              <span>{quotes.length} rows</span>
            </div>
            <div style={tableFrameStyle}>
              <div style={quoteEditorGridStyle(mode === 'allSymbolsSingleDate' && normalizeQuoteEditorExchangeScope(exchange) === 'ALL', true)}>
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Ticker</span>
                {mode === 'allSymbolsSingleDate' && normalizeQuoteEditorExchangeScope(exchange) === 'ALL' ? (
                  <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Exchange</span>
                ) : null}
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Date</span>
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Close</span>
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Open</span>
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>High</span>
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Low</span>
                <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>Volume</span>
              </div>
              <div ref={quotesBodyRef} style={quotesBodyStyle}>
                {quotes.map((row) => (
                  <button
                    key={quoteRowKey(row)}
                    type="button"
                    data-quote-key={quoteRowKey(row)}
                    style={quoteEditorGridStyle(
                      mode === 'allSymbolsSingleDate' && normalizeQuoteEditorExchangeScope(exchange) === 'ALL',
                      false,
                      selectedQuoteKey === quoteRowKey(row),
                    )}
                    onClick={() => {
                      selectQuoteRow(row, setSelectedQuoteKey, setSymbol, setForm);
                      setSelectedQuoteExchange(row.exchange);
                      setDeleteFromDate(row.date);
                      setDeleteToDate(row.date);
                    }}
                  >
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE} title={row.symbol}>
                      {row.symbol}
                    </span>
                    {mode === 'allSymbolsSingleDate' && normalizeQuoteEditorExchangeScope(exchange) === 'ALL' ? (
                      <span style={QUOTE_EDITOR_TABLE_CELL_STYLE} title={quoteEditorExchangeLabel(row.exchange)}>
                        {quoteEditorExchangeLabel(row.exchange)}
                      </span>
                    ) : null}
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE} title={row.date}>{row.date}</span>
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>{row.close.toFixed(2)}</span>
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>{row.open.toFixed(2)}</span>
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>{row.high.toFixed(2)}</span>
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>{row.low.toFixed(2)}</span>
                    <span style={QUOTE_EDITOR_TABLE_CELL_STYLE}>{row.volume.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={quoteEditorStatusBarStyle}>
          <span style={quoteEditorStatusTextStyle}>{quoteStatusMessage}</span>
          {quoteProgressMessage ? <span style={quoteEditorProgressTextStyle}>{quoteProgressMessage}</span> : null}
        </div>
      </div>
    </FloatingWindow>
  );
}

function MergeSymbolsDialog({
  activeInstrument,
  hasDatabase,
  onClose,
  onRefresh,
  openRequestCount,
  onReloadInstrument,
}: {
  activeInstrument: { symbol: string; exchange: string } | null;
  hasDatabase: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  openRequestCount: number;
  onReloadInstrument: (
    sourceSymbol: string,
    sourceExchange: string,
    targetSymbol: string,
    targetExchange: string,
    options?: InstrumentReloadOptions,
  ) => Promise<void>;
}) {
  const api = getDesktopApi();
  const MERGE_SYMBOLS_WINDOW_ID = 'merge-symbols';

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);

  const [form, setForm] = useState<MergeSymbolsInput>({
    sourceSymbol: '',
    sourceExchange: activeInstrument?.exchange ?? 'NSE',
    targetSymbol: activeInstrument?.symbol ?? '',
    targetExchange: activeInstrument?.exchange ?? 'NSE',
    targetName: '',
    overwriteDuplicates: true,
    deleteSourceAfterMerge: true,
  });
  const [assignAliasName, setAssignAliasName] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    registerWindow({
      id: MERGE_SYMBOLS_WINDOW_ID,
      title: 'Merge Quotes',
      bounds: {
        x: 200,
        y: 120,
        width: 480,
        height: 400,
      },
      minWidth: 400,
      minHeight: 300,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (!hasDatabase) {
      setStatus('Open a database first.');
    }
  }, [hasDatabase]);

  useEffect(() => {
    if (openRequestCount > 0) {
      openWindow(MERGE_SYMBOLS_WINDOW_ID);
      focusWindow(MERGE_SYMBOLS_WINDOW_ID);
    }
  }, [openRequestCount, openWindow, focusWindow]);

  const handleClose = () => {
    closeWindow(MERGE_SYMBOLS_WINDOW_ID);
    onClose();
  };

  const applyMerge = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const payload: MergeSymbolsInput = {
        sourceSymbol: form.sourceSymbol.trim().toUpperCase(),
        sourceExchange: form.sourceExchange.trim().toUpperCase() || 'NSE',
        targetSymbol: form.targetSymbol.trim().toUpperCase(),
        targetExchange: form.targetExchange.trim().toUpperCase() || 'NSE',
        targetName: assignAliasName ? form.targetName?.trim() || form.sourceSymbol.trim().toUpperCase() || null : null,
        overwriteDuplicates: form.overwriteDuplicates !== false,
        deleteSourceAfterMerge: form.deleteSourceAfterMerge !== false,
      };
      const result = await api.mergeSymbols(payload);
      await onRefresh();
      await onReloadInstrument(
        payload.sourceSymbol,
        payload.sourceExchange,
        payload.targetSymbol,
        payload.targetExchange,
        { forceReload: true, preserveViewport: true },
      );
      setStatus(`Merged ${result.mergedRows} rows into ${result.targetExchange}:${result.targetSymbol}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not merge symbols.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <FloatingWindow id={MERGE_SYMBOLS_WINDOW_ID} onClose={handleClose}>
      <div style={utilityDialogLayoutStyle}>
        <div style={utilityFormColumnStyle}>
          <div style={utilityFormGridStyle}>
            <div style={utilityFieldLabelStyle}>Destination:</div>
            <div style={utilityInlineValueRowStyle}>
              <input
                value={form.targetSymbol}
                onChange={(event) => setForm((state) => ({ ...state, targetSymbol: event.target.value }))}
                style={utilityInputStyle}
              />
              <input
                value={form.targetExchange}
                onChange={(event) => setForm((state) => ({ ...state, targetExchange: event.target.value }))}
                style={utilityExchangeInputStyle}
              />
            </div>
            <div style={utilityFieldLabelStyle}>Merge with:</div>
            <div style={utilityInlineValueRowStyle}>
              <input
                value={form.sourceSymbol}
                onChange={(event) => setForm((state) => ({ ...state, sourceSymbol: event.target.value }))}
                style={utilityInputStyle}
              />
              <input
                value={form.sourceExchange}
                onChange={(event) => setForm((state) => ({ ...state, sourceExchange: event.target.value }))}
                style={utilityExchangeInputStyle}
              />
            </div>
          </div>
          <div style={utilityCheckboxListStyle}>
            <label style={utilityCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={form.overwriteDuplicates !== false}
                onChange={(event) => setForm((state) => ({ ...state, overwriteDuplicates: event.target.checked }))}
              />
              <span>Overwrite duplicate quotes</span>
            </label>
            <label style={utilityCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={form.deleteSourceAfterMerge !== false}
                onChange={(event) => setForm((state) => ({ ...state, deleteSourceAfterMerge: event.target.checked }))}
              />
              <span>Delete merged symbol after merge</span>
            </label>
            <label style={utilityCheckboxRowStyle}>
              <input
                type="checkbox"
                checked={assignAliasName}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setAssignAliasName(checked);
                  if (checked) {
                    setForm((state) => ({
                      ...state,
                      targetName: state.targetName?.trim() ? state.targetName : state.sourceSymbol.trim().toUpperCase(),
                    }));
                  }
                }}
              />
              <span>Assign alias name</span>
            </label>
          </div>
          {assignAliasName ? (
            <div style={utilityFormGridStyle}>
              <div style={utilityFieldLabelStyle}>Alias:</div>
              <input
                value={form.targetName ?? ''}
                onChange={(event) => setForm((state) => ({ ...state, targetName: event.target.value }))}
                style={utilityInputStyle}
              />
            </div>
          ) : null}
          <div style={utilityStatusStyle}>
            {status || 'Merge EOD history from one symbol into another. Destination is the symbol you want to keep.'}
          </div>
        </div>
        <div style={utilityButtonStackStyle}>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => void applyMerge()}
            disabled={busy || !hasDatabase || !form.sourceSymbol.trim() || !form.targetSymbol.trim()}
          >
            OK
          </button>
          <button type="button" style={modalButtonStyle} onClick={handleClose}>
            Cancel
          </button>
        </div>
      </div>
    </FloatingWindow>
  );
}

function CorporateActionDialog({
  activeInstrument,
  activeRequestedInstrument,
  adjustedMode,
  includeDividendAdjustments,
  includeRightsAdjustments,
  hasDatabase,
  onClose,
  onRefresh,
  openRequestCount,
  onReloadInstrument,
}: {
  activeInstrument: { symbol: string; exchange: string } | null;
  activeRequestedInstrument: { symbol: string; exchange: string } | null;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  hasDatabase: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  openRequestCount: number;
  onReloadInstrument: (
    symbol: string,
    exchange: string,
    options?: InstrumentReloadOptions,
  ) => Promise<void>;
}) {
  const api = getDesktopApi();
  const CORPORATE_ACTIONS_WINDOW_ID = 'corporate-actions';
  const [reconciliationOpen, setReconciliationOpen] = useState(false);
  const [classicReview, setClassicReview] = useState(true);
  const [classicTypeFilters, setClassicTypeFilters] = useState<string[]>([...CLASSIC_ACTION_TYPES]);
  const [classicFilterResetKey, setClassicFilterResetKey] = useState(0);
  const [classicReport, setClassicReport] = useState<'types' | 'dividends' | 'activity' | 'approved' | 'help' | null>(null);
  const [lastApprovalFailure, setLastApprovalFailure] = useState<{databasePath: string; at: string; message: string} | null>(null);
  const [recentApprovals, setRecentApprovals] = useState<{databasePath: string; rows: CorporateActionImportRow[]; offset: number; hasMore: boolean; error?: string} | null>(null);
  const [recentApprovalsLoading, setRecentApprovalsLoading] = useState(false);
  const recentApprovalRequestRef = useRef(false);
  const [savedValidationHistory, setSavedValidationHistory] = useState<{
    databasePath: string;
    run: CorporateActionActivityRun | null;
    items: CorporateActionValidationReportItem[];
    offset: number;
    total: number;
    hasMore: boolean;
    error?: string;
  } | null>(null);
  const [savedValidationHistoryLoading, setSavedValidationHistoryLoading] = useState(false);
  const savedValidationHistoryRequestRef = useRef(false);
  const [validationHistoryWarning, setValidationHistoryWarning] = useState<string | null>(null);

  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const closeWindow = useWindowStore((state) => state.closeWindow);
  const watchlists = useChartStore((state) => state.snapshot?.watchlists ?? []);
  const selectedWatchlistId = useChartStore((state) => state.selectedWatchlistId);
  const activeDatabasePath = useChartStore((state) => state.snapshot?.activeDatabasePath ?? null);

  const [currentSymbol, setCurrentSymbol] = useState(activeInstrument?.symbol ?? '');
  const [exchange, setExchange] = useState(activeInstrument?.exchange ?? 'NSE');
  const [effectiveDate, setEffectiveDate] = useState(indiaIsoDate());
  const [actionType, setActionType] = useState<CorporateActionInput['actionType']>('SPLIT');
  const [ratioText, setRatioText] = useState('1:1');
  const [cashAmountText, setCashAmountText] = useState('');
  const [recordDate, setRecordDate] = useState('');
  const [isin, setIsin] = useState('');
  const [oldFaceValue, setOldFaceValue] = useState('');
  const [newFaceValue, setNewFaceValue] = useState('');
  const [adjustVolume, setAdjustVolume] = useState(true);
  const [oldSymbol, setOldSymbol] = useState('');
  const [newSymbol, setNewSymbol] = useState(activeInstrument?.symbol ?? '');
  const [oldName, setOldName] = useState('');
  const [newName, setNewName] = useState('');
  const [currentName, setCurrentName] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeCorporateTab, setActiveCorporateTab] = useState<'manual' | 'identity' | 'imports' | 'scan' | 'issues'>('imports');
  const [identityExchange, setIdentityExchange] = useState<'NSE' | 'BSE'>(
    activeInstrument?.exchange === 'BSE' ? 'BSE' : 'NSE',
  );
  const [identitySourceMode, setIdentitySourceMode] = useState<'official' | 'manual'>('official');
  const [identityArchiveRoot, setIdentityArchiveRoot] = useState('');
  const [identityApplyProgress, setIdentityApplyProgress] = useState<IdentityApplyProgress | null>(null);
  const [identityApplyError, setIdentityApplyError] = useState<string | null>(null);
  const [identityRefreshWarning, setIdentityRefreshWarning] = useState<string | null>(null);
  const [currentUniverseSyncResult, setCurrentUniverseSyncResult] = useState<NseCurrentUniverseSyncResult | null>(null);
  const [nseReviewedApplyAuthority, setNseReviewedApplyAuthority] =
    useState<NseReviewedApplyAuthority | null>(null);
  const [bseReviewedApplyAuthority, setBseReviewedApplyAuthority] = useState<{ planSha256: string; databasePath: string; sourceMode: 'official' | 'manual'; masterFilePath: string } | null>(null);
  const [nseHistoricalIdentityResult, setNseHistoricalIdentityResult] =
    useState<NseHistoricalIdentityResult | null>(null);
  const [identityPreferences, updateIdentityPreferences, identitySettingsWarning] = useIdentityDisplayPreferences(identityDisplayKey(activeDatabasePath, identityExchange, identitySourceMode));
  const bseNames = useBseNameHistory({ api, databasePath: activeDatabasePath, exchange: identityExchange,
    mode: identitySourceMode, busy, setBusy, preferences: identityPreferences, updatePreferences: updateIdentityPreferences, active: activeCorporateTab === 'identity' });
  const nseHistoricalIdentityFilter: NseHistoricalIdentityFilter = identityPreferences.outcome;
  const setNseHistoricalIdentityFilter = (outcome: NseHistoricalIdentityFilter) => updateIdentityPreferences({ outcome });
  const [historicalApplyProgress, setHistoricalApplyProgress] = useState<IdentityApplyProgress | null>(null);
  const [historicalApplyError, setHistoricalApplyError] = useState<string | null>(null);
  const [historicalRefreshWarning, setHistoricalRefreshWarning] = useState<string | null>(null);
  const [nseHistoricalReviewedApplyAuthority, setNseHistoricalReviewedApplyAuthority] =
    useState<NseHistoricalReviewedApplyAuthority | null>(null);
  const [bseMasterFilePath, setBseMasterFilePath] = useState('');
  const [bseOfficialMasterFilePath, setBseOfficialMasterFilePath] = useState('');
  const [bseManualMasterFilePath, setBseManualMasterFilePath] = useState('');
  const [bseCurrentUniverseSyncResult, setBseCurrentUniverseSyncResult] = useState<BseCurrentUniverseSyncResult | null>(null);
  const identityConfirmation=useIdentityApplyConfirmation(JSON.stringify([
    activeDatabasePath,identityExchange,identitySourceMode,identityArchiveRoot,bseMasterFilePath,
    activeCorporateTab,identityPreferences.view,busy,nseReviewedApplyAuthority,bseReviewedApplyAuthority,
    nseHistoricalReviewedApplyAuthority,currentUniverseSyncResult?.planSha256,currentUniverseSyncResult?.applied,
    bseCurrentUniverseSyncResult?.planSha256,bseCurrentUniverseSyncResult?.applied,
    nseHistoricalIdentityResult?.planSha256,nseHistoricalIdentityResult?.canApply,nseHistoricalIdentityResult?.applied,
  ]));
  const [officialSourceUrlsOpen, setOfficialSourceUrlsOpen] = useState(false);
  const [officialSourceUrlExchange, setOfficialSourceUrlExchange] = useState<OfficialSourceUrlExchange>('NSE');
  const [officialSourceUrlDraft, setOfficialSourceUrlDraft] = useState<OfficialSourceUrls>(DEFAULT_OFFICIAL_SOURCE_URLS);
  const [officialSourceAuthority, setOfficialSourceAuthority] = useState<OfficialSourceConfigurationAuthority | null>(null);
  const [officialSourceCandidateResult, setOfficialSourceCandidateResult] =
    useState<OfficialSourceReplacementCandidatesResult | null>(null);
  const [officialSourceCandidateStatus, setOfficialSourceCandidateStatus] = useState('');
  const [officialSourceRejectNotes, setOfficialSourceRejectNotes] = useState<Record<string, string>>({});
  const [officialSourceHistory, setOfficialSourceHistory] = useState<OfficialSourceHistoryEntry[]>([]);
  const [officialSourceRollbackReview, setOfficialSourceRollbackReview] =
    useState<OfficialSourceRollbackReview | null>(null);
  const [officialSourceRollbackStatus, setOfficialSourceRollbackStatus] = useState('');
  const [officialSourceUrlStatus, setOfficialSourceUrlStatus] = useState('');
  const [identityInfoOpen, setIdentityInfoOpen] = useState(false);
  const [identityRecoveryExportStatus, setIdentityRecoveryExportStatus] = useState('');
  const [identityRecoveryExportingFileName, setIdentityRecoveryExportingFileName] = useState<string | null>(null);
  const [officialSourceHealthReport, setOfficialSourceHealthReport] = useState<OfficialSourceHealthReport | null>(null);
  const [officialSourceHealthStatus, setOfficialSourceHealthStatus] = useState('');
  const [importExchange, setImportExchange] = useState(activeInstrument?.exchange ?? 'NSE');
  const [officialFetchExchangeSelection, setOfficialFetchExchangeSelection] =
    useState<OfficialFetchExchangeSelection>('BOTH');
  const [officialFetchLog, setOfficialFetchLog] = useState<string[]>([]);
  const [bseFetchFailed, setBseFetchFailed] = useState(false);
  const [officialFetchRunning, setOfficialFetchRunning] = useState(false);
  const officialFetchCancelRequested = useRef(false);
  const [importLoadLimit, setImportLoadLimit] = useState(CORPORATE_IMPORT_LOAD_STEP);
  const [scanLoadLimit, setScanLoadLimit] = useState(CORPORATE_SCAN_LOAD_STEP);
  const [importFilePath, setImportFilePath] = useState('');
  const [activeOfficialImportSection, setActiveOfficialImportSection] = useState<OfficialImportSection>('review');
  const [activeOfficialImportView, setActiveOfficialImportView] = useState<OfficialImportView>('review');
  const [fetchFromDate, setFetchFromDate] = useState(() => addIndiaIsoDays(indiaIsoDate(), -90));
  // Use today's India date by default; future ranges remain explicitly selectable.
  const [fetchToDate, setFetchToDate] = useState(indiaIsoDate);
  const [lastSuccessfulOfficialFetch, setLastSuccessfulOfficialFetch] =
    useState<CorporateActionNormalLastFetchRecord | null>(() =>
      readCorporateActionNormalLastFetch(activeDatabasePath),
    );
  const [historicalBackfillSymbol, setHistoricalBackfillSymbol] = useState(
    activeInstrument?.exchange === 'NSE' ? activeInstrument.symbol : '',
  );
  const [historicalBackfillFromDate, setHistoricalBackfillFromDate] = useState('1994-01-01');
  const [historicalBackfillToDate, setHistoricalBackfillToDate] = useState(indiaIsoDate());
  const [historicalBackfillBseScripCode, setHistoricalBackfillBseScripCode] = useState('');
  const [historicalBackfillResult, setHistoricalBackfillResult] = useState<HistoricalCapitalActionBackfillResult | null>(
    null,
  );
  const [historicalBatchSymbols, setHistoricalBatchSymbols] = useState('');
  const [historicalBatchStopOnError, setHistoricalBatchStopOnError] = useState(false);
  const [historicalBatchResult, setHistoricalBatchResult] = useState<HistoricalCapitalActionBackfillBatchResult | null>(
    null,
  );
  const [historicalBackfillRuns, setHistoricalBackfillRuns] = useState<HistoricalCapitalActionBackfillRunRow[] | null>(
    null,
  );
  const [historicalBackfillRunsMessage, setHistoricalBackfillRunsMessage] = useState('');
  const [historicalBackfillRunPage, setHistoricalBackfillRunPage] = useState({
    total: 0,
    offset: 0,
    limit: HISTORICAL_BACKFILL_RUN_PAGE_SIZE,
    hasMore: false,
  });
  const [historicalSparseCandidates, setHistoricalSparseCandidates] = useState<HistoricalCapitalActionSparseCandidate[]>(
    [],
  );
  const [historicalAliasCandidates, setHistoricalAliasCandidates] = useState<HistoricalCapitalActionAliasCandidate[]>(
    [],
  );
  const [historicalMajorLiquidCandidates, setHistoricalMajorLiquidCandidates] = useState<
    HistoricalCapitalActionMajorLiquidCandidate[]
  >([]);
  const identitySearchQuery = identityPreferences.currentQuery;
  const setIdentitySearchQuery: React.Dispatch<React.SetStateAction<string>> = value => updateIdentityPreferences({ currentQuery: typeof value === 'function' ? value(identityPreferences.currentQuery) : value });
  const [importSearchQuery, setImportSearchQuery] = useState('');
  const [scanSearchQuery, setScanSearchQuery] = useState('');
  const [selectedImportActionTypes, setSelectedImportActionTypes] = useState<CorporateActionImportActionType[]>([
    ...CORPORATE_IMPORT_FILTER_TYPES,
  ]);
  const effectiveImportActionTypes = useMemo(() =>
    activeCorporateTab === 'imports' ? expandOfficialImportActionTypes(selectedImportActionTypes) : selectedImportActionTypes,
  [activeCorporateTab, selectedImportActionTypes]);
  const [importRows, setImportRows] = useState<CorporateActionImportRow[]>([]);
  const [eventIdentityByImportId, setEventIdentityByImportId] = useState<
    Record<number, CorporateActionEventIdentity>
  >({});
  const [existingDividendByImportId, setExistingDividendByImportId] = useState<
    Record<number, { row: CorporateActionImportRow; corporateActionId: number }>
  >({});
  const [selectedImportIds, setSelectedImportIds] = useState<Set<number>>(() => new Set());
  const [selectedIssueImportIds, setSelectedIssueImportIds] = useState<Set<number>>(() => new Set());
  const [scanRows, setScanRows] = useState<CorporateActionScanResultRow[]>([]);
  const [scanSummary, setScanSummary] = useState('');
  const [priceExceptionImportId, setPriceExceptionImportId] = useState<number | null>(null);
  const [priceExceptionReason, setPriceExceptionReason] = useState('');
  const [corporateProgress, setCorporateProgress] = useState<{ progress: number; message: string }>({
    progress: 0,
    message: '',
  });
  const [resolveImportId, setResolveImportId] = useState<number | null>(null);
  const [resolveSearchQuery, setResolveSearchQuery] = useState('');
  const [resolveDecisionReason, setResolveDecisionReason] = useState('');
  const [issueResolveHints, setIssueResolveHints] = useState<Record<number, CorporateActionImportResolutionHint>>({});
  const [importIdentityHints, setImportIdentityHints] = useState<Record<number, CorporateActionImportResolutionHint>>({});
  const [officialPreparationComplete, setOfficialPreparationComplete] = useState(false);
  const [officialPreparationErrors, setOfficialPreparationErrors] = useState<Record<number, string>>({});
  // Presentation only: never use Safe-V2 skips to decide manual Apply eligibility.
  const [officialAutoApproval, setOfficialAutoApproval] = useState<{
    databasePath: string | null;
    generation: number;
    result: CorporateActionAutoApprovalResult;
  } | null>(null);
  // Current-cycle Dividend evaluation is read-only presentation evidence, never manual Apply or write authority.
  const [officialDividendPreparedScopeOutcome, setOfficialDividendPreparedScopeOutcome] =
    useState<CorporateActionDividendPreparedScopeOutcomeState | null>(null);
  const [officialDividendWriteStageScope, setOfficialDividendWriteStageScope] =
    useState<CorporateActionDividendPreparedScope | null>(null);
  const [officialReviewSymbolFilter, setOfficialReviewSymbolFilter] = useState('ALL');
  const [officialSafeV2SkippedOnly, setOfficialSafeV2SkippedOnly] = useState(false);
  const [expandedOfficialGroupKeys, setExpandedOfficialGroupKeys] = useState<Set<string>>(() => new Set());
  const [officialApprovalConfirmation, setOfficialApprovalConfirmation] = useState<{
    mode: 'selected' | 'all-ready';
    importIds: number[];
    fingerprints: Record<number, string>;
    scopeLabel: string;
    databasePath: string;
    generation: number;
    dividendImportIds: number[];
    dividendDrafts: DividendWriteStageDraft[];
  } | null>(null);
  const officialApprovalPreparingRef = useRef(false);
  const officialPreparationGenerationRef = useRef(0);
  const pendingReviewRef = useRef<ReturnType<typeof capturePendingReview> | null>(null);
  const officialOperationRunningRef = useRef(false);
  const officialCancelPreparationRef = useRef(false);
  const [officialCanCancelPreparation, setOfficialCanCancelPreparation] = useState(false);
  const [officialTaskProgress, setOfficialTaskProgress] = useState<OfficialImportTaskProgress | null>(null);
  const currentOfficialAutoApproval = officialAutoApproval && !busy && officialPreparationComplete &&
    officialAutoApproval.databasePath === activeDatabasePath &&
    officialAutoApproval.generation === officialPreparationGenerationRef.current
      ? officialAutoApproval.result : null;
  const currentOfficialDividendPreparedScopeOutcome = officialDividendPreparedScopeOutcome && !busy && officialPreparationComplete &&
    officialDividendPreparedScopeOutcome.databasePath === activeDatabasePath &&
    officialDividendPreparedScopeOutcome.generation === officialPreparationGenerationRef.current
      ? officialDividendPreparedScopeOutcome : null;
  const currentOfficialDividendWriteStageScope = CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_ENABLED &&
    currentOfficialDividendPreparedScopeOutcome?.result.complete &&
    !currentOfficialDividendPreparedScopeOutcome.result.operationalError &&
    currentOfficialDividendPreparedScopeOutcome.result.failed === 0 &&
    officialDividendWriteStageScope?.generation === officialPreparationGenerationRef.current &&
    officialDividendWriteStageScope?.operationKey === currentOfficialDividendPreparedScopeOutcome.operationKey &&
    officialDividendWriteStageScope?.normalizedDatabasePath ===
      normalizeCorporateActionPreparedScopeDatabasePath(currentOfficialDividendPreparedScopeOutcome.databasePath)
      ? officialDividendWriteStageScope : null;
  const officialDividendPreparedScopeDispositionByImportId = useMemo(() => {
    const dispositions = new Map<
      number,
      CorporateActionDividendPreparedScopeOutcomeState['result']['dispositions'][number]
    >();
    for (const disposition of currentOfficialDividendPreparedScopeOutcome?.result.dispositions ?? []) {
      dispositions.set(disposition.importId, disposition);
    }
    return dispositions;
  }, [currentOfficialDividendPreparedScopeOutcome]);
  const officialAutoApprovalSkippedReasons = useMemo(() => {
    const reasons = new Map<number, string>();
    for (const disposition of currentOfficialAutoApproval?.dispositions ?? []) {
      if (disposition.disposition === 'SKIPPED') reasons.set(disposition.importId, disposition.reason);
    }
    return reasons;
  }, [currentOfficialAutoApproval]);
  useEffect(() => {
    if (!currentOfficialAutoApproval && officialSafeV2SkippedOnly) setOfficialSafeV2SkippedOnly(false);
  }, [currentOfficialAutoApproval, officialSafeV2SkippedOnly]);
  const officialSafeV2SkippedFocusActive = activeOfficialImportView === 'review' && officialSafeV2SkippedOnly && currentOfficialAutoApproval != null;

  const [issueOnlyOneActiveFilter, setIssueOnlyOneActiveFilter] = useState(false);
  const [issueOnlyMultipleActiveFilter, setIssueOnlyMultipleActiveFilter] = useState(false);
  const [issueOnlyNoActiveFilter, setIssueOnlyNoActiveFilter] = useState(false);
  const [issueExportAllMatching, setIssueExportAllMatching] = useState(false);
  const [issueExportCancelAvailable, setIssueExportCancelAvailable] = useState(false);
  const [issueExportCancelRequested, setIssueExportCancelRequested] = useState(false);
  const [issueExportProgressMessage, setIssueExportProgressMessage] = useState('');
  const [issueExportProgressState, setIssueExportProgressState] = useState<IssueExportProgressState | null>(null);
  const [resolveSuggestedCandidates, setResolveSuggestedCandidates] = useState<CorporateActionImportResolutionSuggestion[]>([]);
  const [resolveSuggestionsMessage, setResolveSuggestionsMessage] = useState('');
  const [resolveCandidates, setResolveCandidates] = useState<InstrumentSummary[]>([]);
  const [resolveCandidateKey, setResolveCandidateKey] = useState<string | null>(null);
  const issueExportCancelRequestedRef = useRef(false);
  const selectedHistoricalBatchWatchlist = useMemo(
    () => watchlists.find((watchlist) => watchlist.id === selectedWatchlistId) ?? watchlists[0] ?? null,
    [selectedWatchlistId, watchlists],
  );
  const selectedHistoricalBatchWatchlistNseCount = useMemo(
    () => selectedHistoricalBatchWatchlist?.items.filter((item) => item.exchange === 'NSE').length ?? 0,
    [selectedHistoricalBatchWatchlist],
  );

  const loadOfficialSourceUrls = async () => {
    if (!api || !hasDatabase) {
      setOfficialSourceAuthority(null);
      setOfficialSourceUrlDraft(DEFAULT_OFFICIAL_SOURCE_URLS);
      return;
    }
    try {
      const authority = await api.getOfficialSourceConfigurationAuthority();
      setOfficialSourceAuthority(authority);
      setOfficialSourceUrlDraft(authority.urls);
      setOfficialSourceUrlStatus('');
    } catch (error) {
      setOfficialSourceAuthority(null);
      setOfficialSourceUrlDraft(DEFAULT_OFFICIAL_SOURCE_URLS);
      setOfficialSourceUrlStatus(getErrorMessage(error, 'Could not load official source URLs.'));
    }
  };

  useEffect(() => {
    void loadOfficialSourceUrls();
  }, [hasDatabase, openRequestCount]);

  useEffect(() => {
    setLastSuccessfulOfficialFetch(readCorporateActionNormalLastFetch(activeDatabasePath));
    setBseFetchFailed(false);
  }, [activeDatabasePath]);

  useEffect(() => {
    officialPreparationGenerationRef.current += 1;
    pendingReviewRef.current = null;
    officialOperationRunningRef.current = false;
    officialCancelPreparationRef.current = false;
    setOfficialCanCancelPreparation(false);
    setOfficialTaskProgress(null);
    setBusy(false);
    setCorporateProgress({ progress: 0, message: '' });
    setOfficialPreparationComplete(false);
    setOfficialAutoApproval(null);
    setOfficialDividendPreparedScopeOutcome(null);
    if (typeof setOfficialDividendWriteStageScope !== "undefined") setOfficialDividendWriteStageScope(null);
    setOfficialPreparationErrors({});
    setOfficialApprovalConfirmation(null);
    setSelectedImportIds(new Set());
    setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null);
    setCurrentUniverseSyncResult(null);
    setBseCurrentUniverseSyncResult(null);
    setNseHistoricalIdentityResult(null);
    setOfficialSourceHealthReport(null);
    setOfficialSourceHealthStatus('');
    setOfficialSourceCandidateResult(null);
    setOfficialSourceCandidateStatus('');
    setOfficialSourceRejectNotes({});
    setOfficialSourceHistory([]);
    setSavedValidationHistory(null);
    setValidationHistoryWarning(null);
  }, [activeDatabasePath]);

  useEffect(() => {
    registerWindow({
      id: CORPORATE_ACTIONS_WINDOW_ID,
      title: 'Corporate Actions',
      bounds: {
        x: 220,
        y: 140,
        width: 1120,
        height: 740,
      },
      minWidth: 620,
      minHeight: 460,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (!hasDatabase) {
      setStatus('Open a database first.');
    }
  }, [hasDatabase]);

  useEffect(() => {
    if (openRequestCount > 0) {
      openWindow(CORPORATE_ACTIONS_WINDOW_ID);
      focusWindow(CORPORATE_ACTIONS_WINDOW_ID);
    }
  }, [openRequestCount, openWindow, focusWindow]);

  useEffect(() => {
    if (!api) {
      return undefined;
    }

    return api.onCorporateActionProgress((progress, message) => {
      setCorporateProgress({ progress, message });
    });
  }, [api]);

  useEffect(() => {
    let cancelled = false;

    if (!api || !hasDatabase || importRows.length === 0) {
      setEventIdentityByImportId({});
      setExistingDividendByImportId({});
      return () => {
        cancelled = true;
      };
    }

    const loadEventIdentities = async () => {
      const next: Record<number, CorporateActionEventIdentity> = {};
      const existing: Record<number, { row: CorporateActionImportRow; corporateActionId: number }> = {};
      const currentRows = new Map(importRows.map(row => [row.id, row]));
      const groupedPendingReview = activeCorporateTab === 'imports' && activeOfficialImportSection === 'review' && activeOfficialImportView === 'review';
      const ids = [...new Set([
        ...selectCorporateActionIdentityDetailIds(importRows, groupedPendingReview, resolveImportId),
        ...importRows.filter(row => row.actionType === 'DIVIDEND' && row.parseStatus === 'PARSED' &&
          row.reviewStatus === 'PENDING' && row.approvedCorporateActionId == null).map(row => row.id),
      ])];
      for (let index = 0; index < ids.length; index += CORPORATE_EVENT_IDENTITY_BATCH_SIZE) {
        const batch = ids.slice(index, index + CORPORATE_EVENT_IDENTITY_BATCH_SIZE);
        const result = await api.listCorporateActionEventIdentities({ importIds: batch });
        if (cancelled) {
          return;
        }
        for (const identity of result.identities) {
          next[identity.importId] = identity;
        }
        for (const match of result.existingDividends ?? []) {
          const row = currentRows.get(match.importId);
          if (!row || !batch.includes(match.importId) || !Number.isSafeInteger(match.corporateActionId) ||
              match.corporateActionId <= 0 || existing[match.importId]) {
            throw new Error('Invalid existing Dividend classification response');
          }
          existing[match.importId] = { row, corporateActionId: match.corporateActionId };
        }
      }
      if (!cancelled) {
        setEventIdentityByImportId(next);
        setExistingDividendByImportId(existing);
      }
    };

    void loadEventIdentities().catch(() => {
      if (!cancelled) {
        setEventIdentityByImportId({});
        setExistingDividendByImportId({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [api, hasDatabase, importRows, activeCorporateTab, activeOfficialImportSection, activeOfficialImportView, resolveImportId]);

  useEffect(() => () => { officialPreparationGenerationRef.current += 1; }, []);

  const handleClose = () => {
    officialPreparationGenerationRef.current += 1;
    setOfficialAutoApproval(null);
    setOfficialDividendPreparedScopeOutcome(null);
    if (typeof setOfficialDividendWriteStageScope !== "undefined") setOfficialDividendWriteStageScope(null);
    closeWindow(CORPORATE_ACTIONS_WINDOW_ID);
    onClose();
  };

  const factorPreview = useMemo(
    () => computeCorporateFactor(actionType, ratioText, oldFaceValue, newFaceValue),
    [actionType, ratioText, oldFaceValue, newFaceValue],
  );

  const isAdjustmentAction = actionType === 'SPLIT' || actionType === 'BONUS';
  const isPriceAdjustmentAction = isAdjustmentAction || actionType === 'DIVIDEND' || actionType === 'RIGHTS';
  const needsCashAmount = actionType === 'DIVIDEND' || actionType === 'RIGHTS';
  const showingApprovedImports = activeOfficialImportView === 'approved';

  const setLoadedImportRows = (rows: CorporateActionImportRow[], preservePendingReview = false) => {
    if (!preservePendingReview) pendingReviewRef.current = null;
    setOfficialAutoApproval(null);
    setOfficialDividendPreparedScopeOutcome(null);
    if (typeof setOfficialDividendWriteStageScope !== "undefined") setOfficialDividendWriteStageScope(null);
    setImportRows(rows);
    setSelectedImportIds((selectedIds) => {
      const loadedIds = new Set(rows.map((row) => row.id));
      return new Set([...selectedIds].filter((id) => loadedIds.has(id)));
    });
    setSelectedIssueImportIds((selectedIds) => {
      const unresolvedIds = new Set(rows.filter((row) => row.reviewStatus === 'UNRESOLVED').map((row) => row.id));
      return new Set([...selectedIds].filter((id) => unresolvedIds.has(id)));
    });
  };

  const mergeOfficialValidationRows = (
    rows: CorporateActionScanResultRow[],
    replaceImportIds: number[] = [],
  ) => {
    const replacedImportIds = new Set([
      ...replaceImportIds,
      ...rows.flatMap((row) => (row.corporateActionImportId == null ? [] : [row.corporateActionImportId])),
    ]);
    if (replacedImportIds.size === 0) {
      return;
    }
    setScanRows((current) => [
      ...current.filter(
        (row) => row.corporateActionImportId == null || !replacedImportIds.has(row.corporateActionImportId),
      ),
      ...rows,
    ]);
  };

  const buildOfficialImportListInput = (requestedLimit = importLoadLimit, view = activeOfficialImportView) => ({
    limit: requestedLimit,
    actionTypes: effectiveImportActionTypes,
    searchQuery: importSearchQuery.trim() || null,
    reviewStatus: view === 'approved' ? 'APPROVED' : null,
    excludeApproved: view === 'review',
  });

  const buildIssueImportListInput = (requestedLimit = importLoadLimit, requestedOffset = 0) => ({
    limit: requestedLimit,
    offset: requestedOffset,
    actionTypes: effectiveImportActionTypes,
    searchQuery: importSearchQuery.trim() || null,
    excludeApproved: true,
  });

  useEffect(() => {
    setBseReviewedApplyAuthority(null);
    setIdentityApplyProgress(null); setIdentityApplyError(null); setIdentityRefreshWarning(null);
    setHistoricalApplyProgress(null); setHistoricalApplyError(null); setHistoricalRefreshWarning(null);
  }, [activeDatabasePath, identityExchange, identitySourceMode]);
  useEffect(() => {
    if (!currentUniverseSyncResult?.applied && !bseCurrentUniverseSyncResult?.applied) { setIdentityApplyError(null); setIdentityRefreshWarning(null); }
  }, [currentUniverseSyncResult, bseCurrentUniverseSyncResult]);

  const normalizedIdentitySearchQuery = identitySearchQuery.trim().toUpperCase();
  const normalizedImportSearchQuery = importSearchQuery.trim().toUpperCase();
  const normalizedScanSearchQuery = scanSearchQuery.trim().toUpperCase();

  const filteredIdentityPreviewRows = useMemo(() => {
    const rows = currentUniverseSyncResult
      ? currentUniverseSyncResult.previewRows.map((row) => ({
          ...row,
          source: 'NSE' as const,
          matchValue: row.matchedSymbol,
        }))
      : bseCurrentUniverseSyncResult
        ? bseCurrentUniverseSyncResult.previewRows.map((row) => ({
            ...row,
            source: 'BSE' as const,
            matchValue: row.securityCode,
          }))
        : [];
    if (!normalizedIdentitySearchQuery) {
      return rows;
    }
    return rows.filter((row) =>
      [row.symbol, row.companyName, row.isin, row.matchValue, row.reason]
        .filter(Boolean)
        .some((value) => value!.toUpperCase().includes(normalizedIdentitySearchQuery)),
    );
  }, [bseCurrentUniverseSyncResult, currentUniverseSyncResult, normalizedIdentitySearchQuery]);

  const filteredNseHistoricalIdentityRows = useMemo(() => {
    const rows = nseHistoricalIdentityResult?.historyRows ?? [];
    if (nseHistoricalIdentityFilter === 'all') {
      return rows;
    }
    if (nseHistoricalIdentityFilter === 'actionable') {
      return rows.filter((row) => row.disposition === 'NEW');
    }
    if (nseHistoricalIdentityFilter === 'duplicates') {
      return rows.filter((row) => row.disposition === 'DUPLICATE');
    }
    if (nseHistoricalIdentityFilter === 'skipped') {
      return rows.filter((row) => row.disposition === 'SKIPPED');
    }
    return rows.filter((row) => row.disposition === 'ERROR');
  }, [nseHistoricalIdentityFilter, nseHistoricalIdentityResult]);

  const visibleImportRows = useMemo(() => {
    return importRows.filter((row) => {
      if (classicReview && activeCorporateTab === 'imports' && activeOfficialImportSection === 'review'
        && !classicTypeFilters.includes(row.actionType)) return false;
      if (!effectiveImportActionTypes.includes(row.actionType)) return false;
      if (normalizedImportSearchQuery && !matchesCorporateImportSearch(row, normalizedImportSearchQuery)) return false;
      if (officialSafeV2SkippedFocusActive && !officialAutoApprovalSkippedReasons.has(row.id)) return false;
      if (showingApprovedImports || officialReviewSymbolFilter === 'ALL') return true;
      return officialImportGroupKey(row) === officialReviewSymbolFilter;
    });
  }, [
    importRows,
    classicReview, classicTypeFilters, activeCorporateTab, activeOfficialImportSection,
    normalizedImportSearchQuery,
    officialReviewSymbolFilter,
    effectiveImportActionTypes,
    officialSafeV2SkippedFocusActive,
    officialAutoApprovalSkippedReasons,
    showingApprovedImports,
  ]);

  const officialReviewSymbolOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const row of importRows) {
      if (!effectiveImportActionTypes.includes(row.actionType)) continue;
      const key = officialImportGroupKey(row);
      options.set(key, officialImportGroupLabel(row));
    }
    return [...options.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [importRows, effectiveImportActionTypes]);

  const visibleScanRows = useMemo(() => {
    if (!normalizedScanSearchQuery) {
      return scanRows;
    }
    return scanRows.filter((row) => matchesCorporateScanSearch(row, normalizedScanSearchQuery));
  }, [scanRows, normalizedScanSearchQuery]);

  const latestScanByImportId = useMemo(() => {
    const latest = new Map<number, CorporateActionScanResultRow>();
    for (const row of scanRows) {
      if (row.corporateActionImportId == null) {
        continue;
      }
      const current = latest.get(row.corporateActionImportId);
      if (!current || row.scannedAt > current.scannedAt || (row.scannedAt === current.scannedAt && row.id > current.id)) {
        latest.set(row.corporateActionImportId, row);
      }
    }
    return latest;
  }, [scanRows]);

  const priceExceptionTargetRow = useMemo(
    () => importRows.find((row) => row.id === priceExceptionImportId) ?? null,
    [importRows, priceExceptionImportId],
  );

  const resolveTargetRow = useMemo(
    () => importRows.find((row) => row.id === resolveImportId) ?? null,
    [importRows, resolveImportId],
  );

  useEffect(() => {
    if (!api || !resolveTargetRow) {
      setResolveSuggestedCandidates([]);
      setResolveSuggestionsMessage('');
      return undefined;
    }

    let cancelled = false;
    void api
      .listCorporateActionImportResolutionSuggestions({ importId: resolveTargetRow.id })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setResolveSuggestedCandidates(result.suggestions);
        setResolveSuggestionsMessage(result.message);
        setResolveCandidateKey((current) => {
          const suggestionKeys = new Set(result.suggestions.map((candidate) => instrumentCandidateKey(candidate)));
          if (current && suggestionKeys.has(current)) {
            return current;
          }
          if (current) {
            return current;
          }
          return result.suggestions[0] ? instrumentCandidateKey(result.suggestions[0]) : null;
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setResolveSuggestedCandidates([]);
        setResolveSuggestionsMessage('Could not load structured resolution suggestions for this row.');
      });

    return () => {
      cancelled = true;
    };
  }, [api, resolveTargetRow]);

  useEffect(() => {
    if (!api || !resolveTargetRow || resolveTargetRow.reviewStatus !== 'PENDING_ISIN_MISMATCH') {
      return undefined;
    }
    let cancelled = false;
    void api
      .listCorporateActionImportResolutionHints({ importIds: [resolveTargetRow.id] })
      .then((result) => {
        if (cancelled) return;
        const hint = result.hints[0];
        if (hint) setImportIdentityHints((current) => ({ ...current, [hint.importId]: hint }));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [api, resolveTargetRow]);

  useEffect(() => {
    if (!api || !resolveTargetRow) {
      setResolveCandidates([]);
      setResolveCandidateKey(null);
      return undefined;
    }

    const query = resolveSearchQuery.trim();
    if (!query) {
      setResolveCandidates([]);
      setResolveCandidateKey((current) => {
        if (current && resolveSuggestedCandidates.some((candidate) => instrumentCandidateKey(candidate) === current)) {
          return current;
        }
        return resolveSuggestedCandidates[0] ? instrumentCandidateKey(resolveSuggestedCandidates[0]) : null;
      });
      return undefined;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void api
        .searchSymbols({
          query,
          exchange: resolveTargetRow.exchange,
          limit: 25,
          seriesFilter: resolveTargetRow.exchange === 'NSE' ? 'nseEquity' : 'all',
        })
        .then((results) => {
          if (cancelled) {
            return;
          }
          setResolveCandidates(results);
          setResolveCandidateKey((current) => {
            if (
              current &&
              (results.some((candidate) => instrumentCandidateKey(candidate) === current) ||
                resolveSuggestedCandidates.some((candidate) => instrumentCandidateKey(candidate) === current))
            ) {
              return current;
            }
            return results[0]
              ? instrumentCandidateKey(results[0])
              : resolveSuggestedCandidates[0]
                ? instrumentCandidateKey(resolveSuggestedCandidates[0])
                : null;
          });
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setResolveCandidates([]);
          setResolveCandidateKey((current) => {
            if (current && resolveSuggestedCandidates.some((candidate) => instrumentCandidateKey(candidate) === current)) {
              return current;
            }
            return resolveSuggestedCandidates[0] ? instrumentCandidateKey(resolveSuggestedCandidates[0]) : null;
          });
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [api, resolveSearchQuery, resolveSuggestedCandidates, resolveTargetRow]);

  const applyAdjustment = async () => {
    if (!api) {
      return;
    }

    if (!currentSymbol.trim() && !newSymbol.trim()) {
      setStatus('Enter the current symbol first.');
      return;
    }

    if (isAdjustmentAction && factorPreview === null) {
      setStatus('Enter a valid ratio or face value change first.');
      return;
    }
    if (actionType === 'DIVIDEND' && toNullableNumber(cashAmountText) === null) {
      setStatus('Enter the dividend amount per share first.');
      return;
    }
    if (actionType === 'RIGHTS') {
      if (parseRatioText(ratioText) === null) {
        setStatus('Enter the rights ratio first.');
        return;
      }
      if (toNullableNumber(cashAmountText) === null) {
        setStatus('Enter the rights issue price first.');
        return;
      }
    }

    setBusy(true);
    setStatus('');
    try {
      const ratio = parseRatioText(ratioText);
      const normalizedCurrentSymbol = currentSymbol.trim().toUpperCase();
      const normalizedNewSymbol = newSymbol.trim().toUpperCase();
      const normalizedOldSymbol = oldSymbol.trim().toUpperCase();

      const payload: CorporateActionInput = {
        exchange: exchange.trim().toUpperCase() || 'NSE',
        effectiveDate,
        actionType,
        symbol: normalizedCurrentSymbol || normalizedNewSymbol || normalizedOldSymbol || undefined,
        currentSymbol: normalizedCurrentSymbol || normalizedNewSymbol || undefined,
        isin: toNullableText(isin),
        recordDate: toNullableText(recordDate),
        note: toNullableText(note),
        source: 'MANUAL',
      };

      if (isAdjustmentAction || actionType === 'DIVIDEND' || actionType === 'RIGHTS') {
        payload.ratioNum = ratio?.newValue ?? null;
        payload.ratioDen = ratio?.oldValue ?? null;
        // Face values are Split terms only. A Bonus factor comes from its ratio,
        // matching the factor preview; stale hidden values must not be sent.
        payload.oldFaceValue = actionType === 'SPLIT' ? toNullableNumber(oldFaceValue) : null;
        payload.newFaceValue = actionType === 'SPLIT' ? toNullableNumber(newFaceValue) : null;
        payload.cashAmount = toNullableNumber(cashAmountText);
        payload.adjustVolume = isAdjustmentAction ? adjustVolume : false;
      } else {
        payload.oldSymbol = toNullableText(normalizedOldSymbol);
        payload.newSymbol = toNullableText(normalizedNewSymbol);
        payload.oldName = toNullableText(oldName);
        payload.newName = toNullableText(newName);
        payload.currentName = toNullableText(currentName) ?? toNullableText(newName);
      }

      const result = await api.applyCorporateAction(payload);
      await onRefresh();
      await onReloadInstrument(result.currentSymbol, result.exchange, { forceReload: true, preserveViewport: true });
      const refreshNote = buildCorporateActionRefreshNote({
        actionType: result.actionType,
        symbol: result.currentSymbol,
        exchange: result.exchange,
        activeInstrument,
        activeRequestedInstrument,
        adjustedMode,
        includeDividendAdjustments,
        includeRightsAdjustments,
      });
      if (isPriceAdjustmentAction) {
        setStatus(
          `Saved ${result.actionType} for ${result.exchange}:${result.currentSymbol}. Factor ${result.factor?.toFixed(6) ?? '-'}.${refreshNote ? ` ${refreshNote}` : ''}`,
        );
      } else {
        setStatus(`Saved ${result.actionType} history for ${result.exchange}:${result.currentSymbol}.${refreshNote ? ` ${refreshNote}` : ''}`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not save the corporate action.');
    } finally {
      setBusy(false);
    }
  };

  const previewNseHistoricalIdentityArchive = async () => {
    setHistoricalApplyProgress(null); setHistoricalApplyError(null); setHistoricalRefreshWarning(null);
    setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null);
    if (!api) {
      return;
    }
    const requestedArchiveRootPath = identitySourceMode === 'manual' ? identityArchiveRoot.trim() : null;
    if (identitySourceMode === 'manual' && !requestedArchiveRootPath) {
      setStatus('Enter the NSE raw archive root path first.');
      return;
    }

    const previewDatabasePath = activeDatabasePath;
    setCurrentUniverseSyncResult(null);
    setBseCurrentUniverseSyncResult(null);
    setBusy(true);
    setStatus('Previewing NSE historical identity...');
    try {
      const result = await api.previewNseHistoricalIdentityArchive(
        requestedArchiveRootPath === null ? {} : { archiveRootPath: requestedArchiveRootPath },
      );
      setNseHistoricalIdentityResult(result);
      setHistoricalApplyProgress(null); setHistoricalApplyError(null); setHistoricalRefreshWarning(null);
      const liveDatabasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
      if (previewDatabasePath && liveDatabasePath === previewDatabasePath && result.canApply) {
        setNseHistoricalReviewedApplyAuthority({
          planSha256: result.planSha256,
          activeDatabasePath: previewDatabasePath,
          sourceMode: identitySourceMode,
          requestedArchiveRootPath,
        });
      }
      setStatus(formatNseHistoricalIdentityStatus(result));
    } catch (error) {
      setNseHistoricalIdentityResult(null);
      setStatus(getErrorMessage(error, 'Could not preview NSE historical identity.'));
    } finally {
      setBusy(false);
    }
  };

  const applyNseHistoricalIdentityArchive = async () => {
    if (busy) return;
    const reviewedAuthority = nseHistoricalReviewedApplyAuthority;
    if (!api) {
      return;
    }
    const requestedArchiveRootPath = identitySourceMode === 'manual' ? identityArchiveRoot.trim() : null;
    const reviewedAuthorityCurrent = Boolean(
      reviewedAuthority &&
        nseHistoricalIdentityResult &&
        nseHistoricalIdentityResult.canApply &&
        activeDatabasePath &&
        reviewedAuthority.planSha256 === nseHistoricalIdentityResult.planSha256 &&
        reviewedAuthority.activeDatabasePath === activeDatabasePath &&
        reviewedAuthority.sourceMode === identitySourceMode &&
        reviewedAuthority.requestedArchiveRootPath === requestedArchiveRootPath &&
        identityExchange === 'NSE',
    );
    if (!reviewedAuthority || !reviewedAuthorityCurrent) {
      setStatus('Preview Historical Identity again before applying.');
      return;
    }

    if (!nseHistoricalIdentityResult || nseHistoricalIdentityResult.applied || historicalChangeCount(nseHistoricalIdentityResult) === 0) {
      setStatus('No historical identity changes to apply. Create a fresh preview.'); return;
    }
    if (!await identityConfirmation.confirm(nseHistoricalReview(nseHistoricalIdentityResult, activeDatabasePath ?? ''))) {
      setStatus('Historical Apply cancelled. No changes were saved; the preview remains available for review.'); return;
    }
    if (useChartStore.getState().snapshot?.activeDatabasePath !== activeDatabasePath) return;
    setNseHistoricalReviewedApplyAuthority(null);
    setNseReviewedApplyAuthority(null);
    setHistoricalApplyProgress({ stage: 'checking', processed: 0, total: 0, percent: null });
    setHistoricalApplyError(null); setHistoricalRefreshWarning(null);
    setBusy(true);
    setStatus('Applying reviewed NSE historical identity...');
    try {
      const result = await api.applyNseHistoricalIdentityArchive({
        ...(requestedArchiveRootPath === null
          ? {}
          : { archiveRootPath: requestedArchiveRootPath }),
        expectedPlanSha256: reviewedAuthority.planSha256,
      }, progress => { if (useChartStore.getState().snapshot?.activeDatabasePath === activeDatabasePath) setHistoricalApplyProgress(progress); });
      if (useChartStore.getState().snapshot?.activeDatabasePath !== activeDatabasePath) return;
      setIssueResolveHints({});
      setNseHistoricalIdentityResult(result);
      setHistoricalRefreshWarning(result.refreshWarning ?? null);
      try {
      await onRefresh();
      if (activeInstrument) {
        await onReloadInstrument(activeInstrument.symbol, activeInstrument.exchange, {
          forceReload: true,
          preserveViewport: true,
        });
      }
      } catch (refreshError) { setHistoricalRefreshWarning(getErrorMessage(refreshError, 'View refresh needs retry.')); }
      setHistoricalApplyProgress({ stage: 'committed', processed: 0, total: 0, percent: 100 });
      setStatus(formatNseHistoricalIdentityStatus(result));
    } catch (error) {
      if (useChartStore.getState().snapshot?.activeDatabasePath !== activeDatabasePath) return;
      setNseHistoricalReviewedApplyAuthority(null);
      const message = getErrorMessage(error, 'Could not apply reviewed NSE historical identity.');
      setHistoricalApplyError(message); setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const previewCurrentUniverseSync = async (archiveRootPath?: string) => {
    setHistoricalApplyProgress(null); setHistoricalApplyError(null); setHistoricalRefreshWarning(null);
    setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null);
    setNseHistoricalIdentityResult(null);
    if (!api) {
      return;
    }
    if (archiveRootPath !== undefined && !archiveRootPath.trim()) {
      setStatus('Enter the NSE raw archive root path first.');
      return;
    }

    const previewDatabasePath = activeDatabasePath;
    const previewSourceMode = identitySourceMode;
    const requestedArchiveRootPath =
      archiveRootPath === undefined ? null : archiveRootPath.trim();

    setBusy(true);
    setStatus('Previewing NSE current-symbol sync...');
    try {
      const result = await api.previewNseCurrentUniverseSync(
        requestedArchiveRootPath === null ? {} : { archiveRootPath: requestedArchiveRootPath },
      );
      setCurrentUniverseSyncResult(result);
      setBseCurrentUniverseSyncResult(null);

      const liveDatabasePath = useChartStore.getState().snapshot?.activeDatabasePath ?? null;
      if (previewDatabasePath && liveDatabasePath === previewDatabasePath) {
        setNseReviewedApplyAuthority({
          planSha256: result.planSha256,
          activeDatabasePath: previewDatabasePath,
          sourceMode: previewSourceMode,
          requestedArchiveRootPath,
        });
      }
      setStatus(formatNseCurrentUniverseSyncStatus(result));
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not preview the NSE current-symbol sync.'));
    } finally {
      setBusy(false);
    }
  };

  const refreshNseIdentitySources = async () => {
    setHistoricalApplyProgress(null); setHistoricalApplyError(null); setHistoricalRefreshWarning(null);
    setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null);
    setNseHistoricalIdentityResult(null);
    if (!api) {
      return false;
    }

    setBusy(true);
    setStatus('Refreshing NSE sources: current master...');
    let currentMasterSaved = false;
    try {
      const masterResult = await api.downloadNseCurrentUniverseMaster();
      currentMasterSaved = true;
      setStatus('Refreshing NSE sources: de-listed workbook...');
      const delistedResult = await api.downloadNseDelistedWorkbook();
      setCurrentUniverseSyncResult(null);
      setBseCurrentUniverseSyncResult(null);
      setStatus(
        `NSE sources refreshed. Master: ${masterResult.equityFilePath} | Company names: ${masterResult.companyNameChangeFilePath} (${masterResult.companyNameChangeRowsRead} rows) | De-listed: ${delistedResult.filePath}`,
      );
      return true;
    } catch (error) {
      const fallback = currentMasterSaved
        ? 'NSE current master refreshed, but the de-listed source could not be refreshed.'
        : 'Could not refresh the NSE identity sources.';
      setStatus(getErrorMessage(error, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const checkOfficialSourceHealth = async () => {
    if (!api) {
      setOfficialSourceHealthStatus('Official Source Health is unavailable in this runtime.');
      return;
    }
    if (!hasDatabase) {
      setOfficialSourceHealthStatus('Open a database before checking Official Source Health.');
      return;
    }

    setBusy(true);
    setOfficialSourceHealthStatus('Checking all configured NSE/BSE official sources...');
    try {
      const report = await api.assessIdentityOfficialSourceHealth();
      const healthyCount = report.results.filter((result) =>
        result.provenanceStatus === 'PASS' &&
        result.transportStatus === 'PASS' &&
        result.formatStatus === 'PASS' &&
        result.populationStatus !== 'FAIL' &&
        result.populationStatus !== 'NOT_EVALUATED' &&
        result.freshnessStatus !== 'FAIL' &&
        result.freshnessStatus !== 'NOT_EVALUATED'
      ).length;
      setOfficialSourceHealthReport(report);
      setOfficialSourceHealthStatus(
        `Official Source Health checked ${report.results.length} logical source(s); ${healthyCount} passed all applicable health gates.`,
      );
    } catch (error) {
      setOfficialSourceHealthReport(null);
      setOfficialSourceHealthStatus(
        getErrorMessage(error, 'Could not complete the read-only Official Source Health check.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const updateOfficialSourceUrl = (key: keyof OfficialSourceUrls, value: string) => {
    setOfficialSourceUrlDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const saveOfficialSourceUrls = async () => {
    if (!api || !hasDatabase) {
      setOfficialSourceUrlStatus('Open a database before changing source URLs.');
      return;
    }
    if (!officialSourceAuthority) {
      setOfficialSourceUrlStatus('Reload official source authority before saving.');
      return;
    }

    const normalized = normalizeOfficialSourceUrls(officialSourceUrlDraft);
    setBusy(true);
    setOfficialSourceUrlStatus('Saving official source URLs...');
    try {
      const result = await api.saveOfficialSourceUrlsReviewed({
        expectedConfigurationFingerprint: officialSourceAuthority.configurationFingerprint,
        expectedSourceRevisions: officialSourceAuthority.sources.map((source) => ({
          sourceKey: source.sourceKey,
          revision: source.revision,
        })),
        urls: normalized,
        operatorNote: null,
      });
      setOfficialSourceAuthority(result.authority);
      setOfficialSourceUrlDraft(result.authority.urls);
      setOfficialSourceUrlStatus('Saved. Future downloads will use these URLs.');
      setOfficialSourceHealthReport(null);
      setOfficialSourceHealthStatus('Official source URLs changed. Run Check Source Health again.');
      setStatus('Official source URLs saved.');
    } catch (error) {
      if (getErrorMessage(error, '').includes('ER4_STALE_REJECTED')) {
        await loadOfficialSourceUrls();
      }
      setOfficialSourceUrlStatus(getErrorMessage(error, 'Could not save official source URLs.'));
    } finally {
      setBusy(false);
    }
  };

  const loadOfficialSourceHistory = async (sourceKey: string) => {
    if (!api || !hasDatabase) {
      setOfficialSourceHistory([]);
      return;
    }
    try {
      setOfficialSourceHistory(await api.listOfficialSourceHistory({ sourceKey }));
    } catch (error) {
      setOfficialSourceHistory([]);
      setOfficialSourceCandidateStatus(
        getErrorMessage(error, 'Could not load official source history.'),
      );
    }
  };

  const findOfficialReplacementCandidates = async (healthResult: OfficialSourceHealthResult) => {
    if (!api || !hasDatabase) {
      setOfficialSourceCandidateStatus('Open a database before finding replacement candidates.');
      return;
    }
    const request = getEr4RecoveryRequestForHealthResult(healthResult);
    if (!request) {
      setOfficialSourceCandidateStatus('This source is not eligible for ER4 replacement discovery.');
      return;
    }

    setBusy(true);
    setOfficialSourceCandidateStatus('Finding and validating official replacement candidates...');
    try {
      const result = await api.findOfficialSourceReplacementCandidates(request);
      setOfficialSourceAuthority(result.authority);
      setOfficialSourceCandidateResult(result);
      setOfficialSourceRollbackReview(null);
      setOfficialSourceRollbackStatus('');
      setOfficialSourceCandidateStatus(
        `Reviewed ${result.candidates.length} candidate(s); ${result.discoveryRejectionCount} discovery candidate(s) rejected.`,
      );
      await loadOfficialSourceHistory(result.sourceKey);
    } catch (error) {
      setOfficialSourceCandidateResult(null);
      setOfficialSourceHistory([]);
      setOfficialSourceRollbackReview(null);
      setOfficialSourceRollbackStatus('');
      setOfficialSourceCandidateStatus(
        getErrorMessage(error, 'Could not find official replacement candidates.'),
      );
    } finally {
      setBusy(false);
    }
  };

  const recordOfficialSourceCandidateDecision = async (
    review: OfficialSourceCandidateReviewPlan,
    decision: 'KEEP_CURRENT' | 'REJECT_CANDIDATE',
  ) => {
    if (!api || !hasDatabase) {
      return;
    }
    const note = officialSourceRejectNotes[review.reviewFingerprint] ?? '';
    setBusy(true);
    try {
      await api.recordOfficialSourceCandidateDecision({
        review,
        decision,
        operatorNote: decision === 'REJECT_CANDIDATE' ? note : null,
      });
      setOfficialSourceCandidateStatus(
        decision === 'KEEP_CURRENT'
          ? 'Keep Current URL decision recorded.'
          : 'Candidate rejection recorded.',
      );
      await loadOfficialSourceHistory(review.sourceKey);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not record the candidate decision.');
      if (message.includes('ER4_STALE_REJECTED')) {
        setOfficialSourceCandidateResult(null);
        setOfficialSourceHistory([]);
        await loadOfficialSourceUrls();
      }
      setOfficialSourceCandidateStatus(message);
    } finally {
      setBusy(false);
    }
  };


  const promoteOfficialSourceCandidate = async (review: OfficialSourceCandidateReviewPlan) => {
    if (!api || !hasDatabase) {
      return;
    }
    if (
      !window.confirm(
        'This changes only the configured official source URL.\nIt does not import data or execute I3/I4 Apply.',
      )
    ) {
      return;
    }

    setBusy(true);
    setOfficialSourceCandidateStatus('Revalidating and promoting the reviewed official source candidate...');
    try {
      const result = await api.promoteOfficialSourceCandidateReviewed({
        review,
        operatorNote: null,
      });
      setOfficialSourceAuthority(result.authority);
      setOfficialSourceUrlDraft(result.authority.urls);
      setOfficialSourceHealthReport(result.postHealthReport);
      setOfficialSourceCandidateResult((current) =>
        current && current.sourceKey === review.sourceKey
          ? { ...current, authority: result.authority, candidates: [] }
          : current,
      );
      setOfficialSourceCandidateStatus(
        result.resultStatus === 'PROMOTED_HEALTHY'
          ? 'Replacement promoted and post-promotion source health is healthy.'
          : 'Replacement promoted. Post-promotion source health needs operator review; no rollback was automatic.',
      );
      await loadOfficialSourceHistory(review.sourceKey);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not promote the reviewed source candidate.');
      if (message.includes('ER4_STALE_REJECTED')) {
        setOfficialSourceCandidateResult(null);
        setOfficialSourceHistory([]);
        await loadOfficialSourceUrls();
      }
      setOfficialSourceCandidateStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const reviewOfficialSourceRollback = async (entry: OfficialSourceHistoryEntry) => {
    if (!api || !hasDatabase || !officialSourceCandidateResult) {
      return;
    }
    setBusy(true);
    setOfficialSourceRollbackReview(null);
    setOfficialSourceRollbackStatus('Revalidating the selected historical source version for rollback review...');
    try {
      const review = await api.createOfficialSourceRollbackReview({
        sourceKey: officialSourceCandidateResult.sourceKey,
        targetVersionId: entry.versionId,
      });
      setOfficialSourceRollbackReview(review);
      setOfficialSourceRollbackStatus(
        'Rollback target revalidated. Review the current and historical URLs before applying.',
      );
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create the rollback review.');
      if (message.includes('ER4_STALE_REJECTED')) {
        setOfficialSourceRollbackReview(null);
        await loadOfficialSourceUrls();
      }
      setOfficialSourceRollbackStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const applyOfficialSourceRollback = async () => {
    if (!api || !hasDatabase || !officialSourceRollbackReview) {
      return;
    }
    if (
      !window.confirm(
        'This creates a new ROLLBACK source version using the selected historical URL.\nIt preserves history and does not execute I3/I4 Apply.',
      )
    ) {
      return;
    }

    setBusy(true);
    setOfficialSourceRollbackStatus('Revalidating and applying the reviewed rollback as a new source version...');
    try {
      const review = officialSourceRollbackReview;
      const result = await api.applyOfficialSourceRollbackReviewed({
        review,
        operatorNote: null,
      });
      setOfficialSourceAuthority(result.authority);
      setOfficialSourceUrlDraft(result.authority.urls);
      setOfficialSourceHealthReport(result.postHealthReport);
      setOfficialSourceRollbackReview(null);
      setOfficialSourceCandidateResult((current) =>
        current && current.sourceKey === review.sourceKey
          ? { ...current, authority: result.authority, candidates: [] }
          : current,
      );
      setOfficialSourceRollbackStatus(
        result.resultStatus === 'ROLLBACK_HEALTHY'
          ? 'Reviewed rollback created a new source version and post-rollback health is healthy.'
          : 'Reviewed rollback created a new source version. Post-rollback health needs operator review; no second rollback was automatic.',
      );
      await loadOfficialSourceHistory(review.sourceKey);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not apply the reviewed rollback.');
      if (message.includes('ER4_STALE_REJECTED')) {
        setOfficialSourceRollbackReview(null);
        setOfficialSourceCandidateResult(null);
        setOfficialSourceHistory([]);
        await loadOfficialSourceUrls();
      }
      setOfficialSourceRollbackStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const retryOfficialSourcePostHealth = async (entry: OfficialSourceHistoryEntry) => {
    if (!api || !hasDatabase || !officialSourceCandidateResult || entry.resultVersionId == null) {
      return;
    }
    setBusy(true);
    setOfficialSourceRollbackStatus('Retrying ER1 health for the exact current source configuration...');
    try {
      const result = await api.retryOfficialSourcePostHealth({
        sourceKey: officialSourceCandidateResult.sourceKey,
        resultVersionId: entry.resultVersionId,
      });
      setOfficialSourceHealthReport(result.postHealthReport);
      setOfficialSourceRollbackStatus(
        result.resultStatus.endsWith('_HEALTHY')
          ? 'Post-change source health is healthy.'
          : 'Post-change source health still needs operator review; no rollback was performed automatically.',
      );
      await loadOfficialSourceHistory(officialSourceCandidateResult.sourceKey);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not retry post-change source health.');
      if (message.includes('ER4_STALE_REJECTED')) {
        setOfficialSourceRollbackReview(null);
        await loadOfficialSourceUrls();
      }
      setOfficialSourceRollbackStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const resetOfficialSourceUrls = () => {
    setOfficialSourceUrlDraft({ ...DEFAULT_OFFICIAL_SOURCE_URLS });
    setOfficialSourceUrlStatus('Defaults restored in the form. Click Apply to save.');
  };

  const executeCurrentIdentityApply = async (exchange: 'NSE' | 'BSE',
    apply: (report: (progress: IdentityApplyProgress) => void) => Promise<NseCurrentUniverseSyncResult | BseCurrentUniverseSyncResult>) => {
    const databasePath = activeDatabasePath;
    const live = () => useChartStore.getState().snapshot?.activeDatabasePath === databasePath;
    let committed = false;
    let lastProgress: IdentityApplyProgress | null = null;
    const progress = (value: IdentityApplyProgress) => {
      if (value.stage === 'committed' || value.stage === 'refreshing') committed = true;
      lastProgress = value;
      if (live()) setIdentityApplyProgress(value);
    };
    setIdentityApplyError(null); setIdentityRefreshWarning(null);
    setIdentityApplyProgress({ stage: 'checking', processed: 0, total: 0, percent: null });
    setBusy(true); setStatus(`Applying ${exchange} current-symbol sync...`);
    try {
      const result = await apply(progress);
      if (!live()) return;
      committed = result.applied;
      setIssueResolveHints({});
      if ('masterFilePath' in result) { setBseCurrentUniverseSyncResult(result); setCurrentUniverseSyncResult(null); }
      else { setCurrentUniverseSyncResult(result); setBseCurrentUniverseSyncResult(null); }
      setIdentityApplyProgress({ stage: 'refreshing', processed: 0, total: 0, percent: 100 });
      let warning = result.refreshWarning ?? null;
      try {
        await onRefresh();
        if (activeInstrument && live()) {
          await onReloadInstrument(activeInstrument.symbol, activeInstrument.exchange, { forceReload: true, preserveViewport: true });
        }
      } catch (error) { warning = getErrorMessage(error, 'Could not refresh the view.'); }
      if (!live()) return;
      setIdentityRefreshWarning(warning); setIdentityApplyProgress(null);
      setStatus(`${result.message}${warning ? ` Changes saved; view refresh needs retry: ${warning}` : ''}`);
    } catch (error) {
      if (!live()) return;
      const message = getErrorMessage(error, `Could not apply ${exchange} changes.`);
      setIdentityApplyProgress(committed ? lastProgress : null);
      setIdentityApplyError(message);
      setStatus(committed ? `Changes saved; read Recent Applied before retrying. ${message}` : message);
    } finally { setBusy(false); }
  };

  const applyCurrentUniverseSync = async (archiveRootPath?: string) => {
    if (busy || !api) {
      return;
    }
    if (archiveRootPath !== undefined && !archiveRootPath.trim()) {
      setNseReviewedApplyAuthority(null);
      setStatus('Enter the NSE raw archive root path first.');
      return;
    }

    if (currentUniverseSyncResult && !identityHasActionableChanges(currentUniverseSyncResult)) {
      setStatus(currentUniverseSyncResult.applied ? 'Changes already saved. Create a new preview before applying again.' : 'Up to date — nothing to apply.');
      return;
    }

    const reviewedAuthority = nseReviewedApplyAuthority;
    const requestedArchiveRootPath =
      archiveRootPath === undefined ? null : archiveRootPath.trim();
    const reviewedAuthorityCurrent = Boolean(
      reviewedAuthority &&
        currentUniverseSyncResult &&
        activeDatabasePath &&
        reviewedAuthority.planSha256 === currentUniverseSyncResult.planSha256 &&
        reviewedAuthority.activeDatabasePath === activeDatabasePath &&
        reviewedAuthority.sourceMode === identitySourceMode &&
        reviewedAuthority.requestedArchiveRootPath === requestedArchiveRootPath,
    );
    if (!reviewedAuthority || !reviewedAuthorityCurrent) {
      setNseReviewedApplyAuthority(null);
      setStatus('Preview the current NSE changes again before applying.');
      return;
    }

    if (!await identityConfirmation.confirm(currentIdentityReview(currentUniverseSyncResult!, 'NSE', activeDatabasePath!))) return;
    if (useChartStore.getState().snapshot?.activeDatabasePath !== activeDatabasePath) return;
    setNseReviewedApplyAuthority(null);
    setBseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null); setNseHistoricalIdentityResult(null);
    await executeCurrentIdentityApply('NSE', report => api.applyNseCurrentUniverseSync({
      ...(requestedArchiveRootPath === null ? {} : { archiveRootPath: requestedArchiveRootPath }),
      expectedPlanSha256: reviewedAuthority.planSha256,
      expectedDatabasePath: reviewedAuthority.activeDatabasePath,
    }, report));
  };

  const downloadBseCurrentUniverseMaster = async () => {
    setBseReviewedApplyAuthority(null);
    if (!api) {
      return null;
    }

    setBusy(true);
    setStatus('Refreshing BSE sources...');
    try {
      const result = await api.downloadBseCurrentUniverseMaster();
      setBseOfficialMasterFilePath(result.filePath);
      setBseMasterFilePath(result.filePath);
      setBseCurrentUniverseSyncResult(null);
      setCurrentUniverseSyncResult(null);
      setStatus(`${result.message} Saved: ${result.filePath}`);
      return result.filePath;
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not refresh the BSE identity sources.'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const previewBseCurrentUniverseSync = async (masterFilePath = bseMasterFilePath) => {
    setBseReviewedApplyAuthority(null);
    setIdentityApplyError(null); setIdentityRefreshWarning(null); setIdentityApplyProgress(null);
    const databasePath = activeDatabasePath;
    const sourceMode = identitySourceMode;
    if (!api) {
      return;
    }
    if (!masterFilePath.trim()) {
      setStatus('Enter the BSE current master CSV path first.');
      return;
    }

    setBusy(true);
    setStatus('Previewing BSE current-symbol sync...');
    try {
      const result = await api.previewBseCurrentUniverseSync({
        masterFilePath: masterFilePath.trim(),
      });
      if (useChartStore.getState().snapshot?.activeDatabasePath !== databasePath) return;
      setBseCurrentUniverseSyncResult(result);
      setCurrentUniverseSyncResult(null);
      if (databasePath) setBseReviewedApplyAuthority({planSha256:result.planSha256, databasePath, sourceMode, masterFilePath:masterFilePath.trim()});
      setStatus(formatBseCurrentUniverseSyncStatus(result));
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not preview the BSE current-symbol sync.'));
    } finally {
      setBusy(false);
    }
  };

  const applyBseCurrentUniverseSync = async () => {
    if (busy || !api) return;
    const authority = bseReviewedApplyAuthority;
    if (!identityHasActionableChanges(bseCurrentUniverseSyncResult)) {
      setStatus(bseCurrentUniverseSyncResult?.applied ? 'Changes already saved. Create a new preview before applying again.' : 'Up to date — nothing to apply.');
      return;
    }
    if (!authority || !activeDatabasePath || authority.databasePath !== activeDatabasePath ||
      authority.sourceMode !== identitySourceMode || authority.masterFilePath !== bseMasterFilePath.trim() ||
      authority.planSha256 !== bseCurrentUniverseSyncResult?.planSha256) {
      setBseReviewedApplyAuthority(null); setStatus('Preview the current BSE changes again before applying.'); return;
    }
    if (!await identityConfirmation.confirm(currentIdentityReview(bseCurrentUniverseSyncResult!, 'BSE', activeDatabasePath))) return;
    if (useChartStore.getState().snapshot?.activeDatabasePath !== activeDatabasePath) return;
    setBseReviewedApplyAuthority(null); setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null); setNseHistoricalIdentityResult(null);
    await executeCurrentIdentityApply('BSE', report => api.applyBseCurrentUniverseSync({
      masterFilePath: authority.masterFilePath, expectedPlanSha256: authority.planSha256,
      expectedDatabasePath: authority.databasePath,
    }, report));
  };

  const selectIdentityExchange = (nextExchange: 'NSE' | 'BSE') => {
    setBseReviewedApplyAuthority(null);
    setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null);
    setNseHistoricalIdentityResult(null);
    setIdentityExchange(nextExchange);
    setCurrentUniverseSyncResult(null);
    setBseCurrentUniverseSyncResult(null);
    setStatus('');
    if (nextExchange === 'BSE') {
      setBseMasterFilePath(
        identitySourceMode === 'official' ? bseOfficialMasterFilePath : bseManualMasterFilePath,
      );
    }
  };

  const selectIdentitySourceMode = (nextMode: 'official' | 'manual') => {
    setBseReviewedApplyAuthority(null);
    setNseReviewedApplyAuthority(null);
    setNseHistoricalReviewedApplyAuthority(null);
    setNseHistoricalIdentityResult(null);
    setIdentitySourceMode(nextMode);
    setCurrentUniverseSyncResult(null);
    setBseCurrentUniverseSyncResult(null);
    setStatus('');
    if (identityExchange === 'BSE') {
      setBseMasterFilePath(
        nextMode === 'official' ? bseOfficialMasterFilePath : bseManualMasterFilePath,
      );
    }
  };

  const browseNseIdentityArchiveRoot = async () => {
    if (!api) {
      return;
    }

    try {
      const selected = await api.pickPluginOutputDirectory({
        title: 'Select NSE Identity Archive Root',
      });
      if (!selected) {
        return;
      }
      setIdentityArchiveRoot(selected);
      setNseReviewedApplyAuthority(null);
      setNseHistoricalReviewedApplyAuthority(null);
      setNseHistoricalIdentityResult(null);
      setCurrentUniverseSyncResult(null);
      setStatus(`Selected NSE Archive Root: ${selected}`);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not select the NSE Identity Archive Root.'));
    }
  };

  const browseBseMasterFile = async () => {
    if (!api) {
      return;
    }

    try {
      const selected = await api.pickPluginDataFile({
        title: 'Select BSE Master CSV',
        filterName: 'CSV Files',
        extensions: ['csv'],
      });
      if (!selected) {
        return;
      }
      setBseReviewedApplyAuthority(null);
      setBseManualMasterFilePath(selected);
      setBseMasterFilePath(selected);
      setBseCurrentUniverseSyncResult(null);
      setStatus(`Selected BSE Master CSV: ${selected}`);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not select the BSE Master CSV.'));
    }
  };

  const refreshAndPreviewSelectedOfficialIdentitySource = async () => {
    if (identitySourceMode !== 'official') {
      return;
    }

    if (identityExchange === 'NSE') {
      const refreshed = await refreshNseIdentitySources();
      if (!refreshed) {
        return;
      }
      await previewCurrentUniverseSync();
      return;
    }

    const refreshedPath = await downloadBseCurrentUniverseMaster();
    if (!refreshedPath) {
      return;
    }
    await previewBseCurrentUniverseSync(refreshedPath);
  };

  const previewSelectedIdentitySource = async () => {
    if (identityExchange === 'NSE') {
      if (identitySourceMode === 'manual') {
        await previewCurrentUniverseSync(identityArchiveRoot);
        return;
      }
      await previewCurrentUniverseSync();
      return;
    }

    await previewBseCurrentUniverseSync();
  };

  const applySelectedIdentitySource = async () => {
    if (identityExchange === 'NSE') {
      if (identitySourceMode === 'manual') {
        await applyCurrentUniverseSync(identityArchiveRoot);
        return;
      }
      await applyCurrentUniverseSync();
      return;
    }

    await applyBseCurrentUniverseSync();
  };

  function capturePendingReview() {
    return { databasePath: activeDatabasePath, generation: officialPreparationGenerationRef.current,
      rows: importRows, scans: scanRows, complete: officialPreparationComplete,
      errors: officialPreparationErrors, autoApproval: officialAutoApproval,
      dividendOutcome: officialDividendPreparedScopeOutcome, dividendScope: officialDividendWriteStageScope,
      progress: officialTaskProgress, message: status, hints: importIdentityHints, limit: importLoadLimit };
  }

  function restorePendingReview() {
    const saved = pendingReviewRef.current;
    setSelectedImportIds(new Set());
    setOfficialApprovalConfirmation(null);
    if (!saved || saved.databasePath !== activeDatabasePath ||
        saved.generation !== officialPreparationGenerationRef.current) {
      setOfficialPreparationComplete(false);
      setStatus('Run Load & Validate to prepare the Pending review.');
      return;
    }
    setImportRows(saved.rows);
    setScanRows(saved.scans);
    setOfficialPreparationComplete(saved.complete);
    setOfficialPreparationErrors(saved.errors);
    setOfficialAutoApproval(saved.autoApproval);
    setOfficialDividendPreparedScopeOutcome(saved.dividendOutcome);
    setOfficialDividendWriteStageScope(saved.dividendScope);
    setOfficialTaskProgress(saved.progress);
    setImportIdentityHints(saved.hints);
    setImportLoadLimit(saved.limit);
    setStatus(saved.message);
  }

  useEffect(() => {
    if (!busy && officialPreparationComplete && activeCorporateTab === 'imports' &&
        activeOfficialImportSection === 'review' && activeOfficialImportView === 'review') {
      pendingReviewRef.current = capturePendingReview();
    }
  }, [busy, officialPreparationComplete, activeCorporateTab, activeOfficialImportSection,
    activeOfficialImportView, importRows, scanRows, officialPreparationErrors, officialAutoApproval,
    officialDividendPreparedScopeOutcome, officialDividendWriteStageScope, officialTaskProgress,
    importIdentityHints, importLoadLimit, status, activeDatabasePath]);

  const loadAndPrepareOfficialImports = async () => {
    if (!api || officialOperationRunningRef.current || (typeof officialApprovalPreparingRef !== "undefined" && officialApprovalPreparingRef.current)) return;
    pendingReviewRef.current = null;
    officialOperationRunningRef.current = true;
    officialCancelPreparationRef.current = false;
    const generation = ++officialPreparationGenerationRef.current;
    const databasePath = activeDatabasePath;
    const startedAt = Date.now();
    const isCurrent = () => officialPreparationGenerationRef.current === generation &&
      useChartStore.getState().snapshot?.activeDatabasePath === databasePath;
    const shouldContinue = () => isCurrent() && !officialCancelPreparationRef.current;
    setBusy(true);
    setOfficialCanCancelPreparation(true);
    setOfficialPreparationComplete(false);
    setOfficialAutoApproval(null);
    setOfficialDividendPreparedScopeOutcome(null);
    if (typeof setOfficialDividendWriteStageScope !== "undefined") setOfficialDividendWriteStageScope(null);
    setOfficialPreparationErrors({});
    setOfficialApprovalConfirmation(null);
    setSelectedImportIds(new Set());
    setImportIdentityHints({});
    setCorporateProgress({ progress: 0, message: '' });
    setOfficialTaskProgress({ stage: 'loading', completed: 0, total: null,
      message: 'Loading all outstanding pending imports...', startedAt });
    try {
      const result = await prepareCorporateActionPendingImports({
        api, shouldContinue, expectedDatabasePath: databasePath ?? '', explicitApprovalOnly: true,
        onProgress: (progress) => {
          if (shouldContinue()) setOfficialTaskProgress({ ...progress, startedAt });
        },
      });
      if (!shouldContinue()) return;
      setLoadedImportRows(result.rows);
      setOfficialAutoApproval(result.autoApproval ? { databasePath, generation, result: result.autoApproval } : null);
      setImportIdentityHints(result.identityHints);
      mergeOfficialValidationRows(result.validationRows, result.validationImportIds);
      const rowErrors: Record<number, string> = {};
      for (const error of result.errors) {
        if (error.importId != null) rowErrors[error.importId] = error.message;
      }
      setOfficialPreparationErrors(rowErrors);
      setOfficialPreparationComplete(result.complete);
      setStatus(result.message);
      // The pending queue is prepared; Dividend R1 still requires an independent read-only pass.
      // Do not mark the overall operation complete or stop the elapsed timer yet.
      setOfficialTaskProgress(result.complete && databasePath
        ? { stage: 'dividend-verifying', completed: 0, total: null,
          message: 'Pending queue prepared. Starting read-only Dividend R1 verification...', startedAt }
        : { stage: result.complete ? 'complete' : 'stopped', completed: result.rows.length,
          total: result.rows.length, message: result.message, startedAt, endedAt: Date.now() });
      const finishDividendVerification = (
        stage: 'dividend-verified' | 'dividend-stopped', message: string,
      ) => {
        setOfficialTaskProgress((current) => current ? {
          ...current, stage, message, endedAt: Date.now(),
        } : null);
      };
      if (result.complete && databasePath && shouldContinue() && typeof buildCorporateActionDividendPreparedScope !== "undefined") {
        try {
          const preparedScope = await buildCorporateActionDividendPreparedScope({
            rows: immediateCorporateActionValidationRows(result.rows),
            cycle: { generation, expectedDatabasePath: databasePath },
            currentGeneration: officialPreparationGenerationRef.current,
            currentDatabasePath: useChartStore.getState().snapshot?.activeDatabasePath ?? '',
            complete: result.complete,
            cancelled: officialCancelPreparationRef.current,
          });
          if (!shouldContinue()) return;
          if (preparedScope.status !== 'READY') {
            finishDividendVerification('dividend-stopped',
              `Pending queue prepared, but Dividend R1 verification could not start: ${preparedScope.reason}. No dividend approval evidence was published.`);
          } else if (preparedScope.scope.importIds.length === 0) {
            finishDividendVerification('dividend-verified',
              'Pending queue prepared. Later dividends were deferred from automatic R1 verification; no approvals occurred.');
          } else {
            const dividendValidationStartedAt = Date.now();
            const evaluation = await evaluateCorporateActionDividendPreparedScopeBatches({
              api,
              scope: preparedScope.scope,
              getCurrentGeneration: () => officialPreparationGenerationRef.current,
              getCurrentDatabasePath: () => useChartStore.getState().snapshot?.activeDatabasePath ?? null,
              isCancelled: () => officialCancelPreparationRef.current,
              onBatchProgress: (completedBatchCount, batchCount) => {
                if (shouldContinue()) setOfficialTaskProgress({
                  stage: 'dividend-verifying', completed: completedBatchCount, total: batchCount,
                  message: `Dividend R1 compatibility checks: ${completedBatchCount}/${batchCount} batches; unchanged saved results may be reused. No approvals.`,
                  startedAt,
                });
              },
            });
            if (!shouldContinue() || evaluation.status === 'STALE') return;
            if (evaluation.status === 'OUTCOME') {
              setOfficialDividendPreparedScopeOutcome(evaluation.outcome);
              const summary = evaluation.outcome.result;
              try {
                await api.saveCorporateActionValidationReport(
                  buildCorporateActionValidationReportSaveInput(
                    evaluation.outcome, dividendValidationStartedAt, preparedScope.scope.importIds,
                  ),
                );
                if (shouldContinue()) {
                  setValidationHistoryWarning(null);
                  setSavedValidationHistory(null);
                }
              } catch (historyError) {
                if (shouldContinue()) {
                  setValidationHistoryWarning(
                    getErrorMessage(historyError, 'The read-only result is available for this session, but its saved history could not be written.'),
                  );
                }
              }
              if (!shouldContinue()) return;
              if (summary.complete && !summary.operationalError && summary.failed === 0) {
                setOfficialDividendWriteStageScope(preparedScope.scope);
                finishDividendVerification('dividend-verified',
                  `Pending queue prepared. Dividend R1 verification finished: ${summary.reusedCount ?? 0} saved results reused, ${summary.dispositions.length - (summary.reusedCount ?? 0)} policy evaluations, ${summary.eligible} eligible, ${summary.ineligible} ineligible. No approvals occurred.`);
              } else {
                finishDividendVerification('dividend-stopped',
                  `Pending queue prepared, but Dividend R1 verification was incomplete (${summary.completedBatchCount}/${summary.batchCount} batches): ${summary.operationalError ?? `${summary.failed} failed records`}. No dividend approval evidence was published.`);
              }
            }
          }
        } catch (error) {
          if (!shouldContinue()) return;
          // Diagnostic-only failure. Never turn it into verified Ready evidence or manual Apply authority.
          finishDividendVerification('dividend-stopped',
            `Pending queue prepared, but Dividend R1 verification failed: ${getErrorMessage(error, 'Unknown read-only verification error')}. No dividend approval evidence was published.`);
        }
      }
    } catch(error) {
      if (!isCurrent()) return;
      const message = officialCancelPreparationRef.current
        ? 'Preparation cancelled after the current check. Completed matching/check metadata may already be saved. Load & Validate again to refresh the authoritative queue before approval.'
        : getErrorMessage(error, 'Could not prepare pending imports.');
      setOfficialPreparationComplete(false);
      setOfficialAutoApproval(null);
      setOfficialDividendPreparedScopeOutcome(null);
    if (typeof setOfficialDividendWriteStageScope !== "undefined") setOfficialDividendWriteStageScope(null);
      setStatus(message);
      setOfficialTaskProgress((current) => current ? {...current,stage:'stopped',message,endedAt:Date.now()} : null);
    } finally {
      if (isCurrent()) {
        if (officialCancelPreparationRef.current) {
          setOfficialTaskProgress((current) => current ? {
            ...current, stage: 'dividend-stopped',
            message: 'Operation stopped on request. Pending queue preparation or Dividend R1 verification did not fully finish; no new dividend approval evidence was published.',
            endedAt: Date.now(),
          } : null);
        }
        officialOperationRunningRef.current = false;
        setOfficialCanCancelPreparation(false);
        setBusy(false);
        setCorporateProgress({progress:0,message:''});
      }
    }
  };

  // Keep reports visible, but invalidate readiness when database data changes.
  // Navigation never launches a new validation run.
  useEffect(() => {
    if (!api || !activeDatabasePath) return undefined;
    return api.onDatabaseChanged((nextSnapshot) => {
      if (nextSnapshot.activeDatabasePath !== activeDatabasePath || officialOperationRunningRef.current || officialApprovalPreparingRef.current) return;
      pendingReviewRef.current = null;
      officialPreparationGenerationRef.current += 1;
      setOfficialPreparationComplete(false);
      setOfficialApprovalConfirmation(null);
      setSelectedImportIds(new Set());
      setStatus('Database changed. Previous report is retained; run Load & Validate to refresh readiness.');
    });
  }, [api, activeDatabasePath]);

  const loadOfficialImports = async (requestedLimit = importLoadLimit, view = activeOfficialImportView) => {
    if (!api) {
      return;
    }
    if (view === 'review') {
      await loadAndPrepareOfficialImports();
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const { rows, validationRows, validationImportIds } = await loadCorporateActionImportRows({
        api,
        listInput: buildOfficialImportListInput(requestedLimit, view),
        includeApprovedValidation: view === 'approved',
      });
      if (view === 'approved') {
        mergeOfficialValidationRows(validationRows, validationImportIds);
      }
      setImportLoadLimit(requestedLimit);
      setLoadedImportRows(rows, true);
      setStatus(
        rows.length
          ? view === 'approved'
            ? `Loaded ${rows.length} approved official import row(s).`
            : `Loaded ${rows.length} official import candidate(s). Nothing is approved automatically.`
          : view === 'approved'
          ? 'No approved official import rows found.'
          : 'No official import candidates found.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load official imports.');
    } finally {
      setBusy(false);
    }
  };

  const loadMoreOfficialImports = async () => {
    await loadOfficialImports(importLoadLimit + CORPORATE_IMPORT_LOAD_STEP);
  };

  const loadIssueImports = async (requestedLimit = importLoadLimit) => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const rows = await api.listCorporateActionImports(buildIssueImportListInput(requestedLimit));
      setImportLoadLimit(requestedLimit);
      setLoadedImportRows(rows, true);
      setStatus(
        rows.length
          ? `Loaded ${rows.length} unresolved or review-pending import row(s).`
          : 'No unresolved or review-pending import rows found.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load review issues.');
    } finally {
      setBusy(false);
    }
  };

  const toggleImportActionType = (actionType: CorporateActionImportActionType, checked: boolean) => {
    setSelectedImportActionTypes((current) => {
      if (checked) {
        return current.includes(actionType) ? current : [...current, actionType];
      }
      return current.filter((value) => value !== actionType);
    });
    setSelectedImportIds(new Set());
    setOfficialApprovalConfirmation(null);
  };

  const updateOfficialImportSearchQuery: React.Dispatch<React.SetStateAction<string>> = (value) => {
    setImportSearchQuery(value);
    setSelectedImportIds(new Set());
    setOfficialApprovalConfirmation(null);
  };

  const switchOfficialImportView = async (view: OfficialImportView) => {
    if (view === activeOfficialImportView) {
      return;
    }
    setActiveOfficialImportView(view);
    setSelectedImportIds(new Set());
    setSelectedIssueImportIds(new Set());
    clearResolveImport();
    if (view === 'review') {
      restorePendingReview();
    } else {
      await loadOfficialImports(importLoadLimit, view);
    }
  };

  const pickOfficialImportFile = async () => {
    if (!api) {
      return;
    }

    try {
      const files = await api.pickCsvFiles();
      if (files[0]) {
        setImportFilePath(files[0]);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not pick the official CSV file.');
    }
  };

  const importOfficialCsv = async () => {
    if (!api) {
      return;
    }
    if (!importFilePath.trim()) {
      setStatus('Select an official NSE/BSE CSV file first.');
      return;
    }

    setBusy(true);
    setCorporateProgress({ progress: 0, message: '' });
    setStatus('');
    try {
      const result = await api.importCorporateActionsCsv({
        filePath: importFilePath.trim(),
        exchange: importExchange.trim().toUpperCase() || 'NSE',
      });
      const rows = await api.listCorporateActionImports({
        ...buildOfficialImportListInput(importLoadLimit),
      });
      setLoadedImportRows(rows);
      setStatus(
        `Imported ${result.rowsInserted}/${result.rowsRead} row(s). Parsed ${result.rowsParsed}, unresolved ${result.rowsUnresolved}, duplicate ${result.rowsDuplicate}. Nothing was approved automatically.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not import official corporate actions.');
    } finally {
      setCorporateProgress({ progress: 0, message: '' });
      setBusy(false);
    }
  };

  const fetchOfficialActions = async (forceRefresh = false) => {
    if (!api) {
      return;
    }
    if (!fetchFromDate || !fetchToDate) {
      setStatus('Choose a from/to date range first.');
      return;
    }
    if (fetchFromDate > fetchToDate) {
      setStatus('From date must be on or before To date.');
      return;
    }

    const selectedExchanges: Array<'NSE' | 'BSE'> =
      officialFetchExchangeSelection === 'BOTH'
        ? ['NSE', 'BSE']
        : [officialFetchExchangeSelection];
    const scopeLabel = formatCorporateActionNormalFetchScope(officialFetchExchangeSelection);

    officialFetchCancelRequested.current = false;
    setOfficialFetchRunning(true);
    setBusy(true);
    setOfficialFetchLog([]);
    setBseFetchFailed(false);
    setCorporateProgress({
      progress: 0,
      message: forceRefresh
        ? `Starting forced official ${scopeLabel} corporate action re-fetch...`
        : `Starting official ${scopeLabel} corporate action fetch...`,
    });
    setStatus(
      forceRefresh
        ? `Force re-fetching official ${scopeLabel} corporate actions...`
        : `Fetching official ${scopeLabel} corporate actions...`,
    );

    let totalRequestedDays = 0;
    let totalCachedDays = 0;
    let totalFetchedDays = 0;
    let totalFetchedRanges = 0;
    let totalRowsRead = 0;
    let totalRowsInserted = 0;
    let totalRowsParsed = 0;
    let totalRowsUnresolved = 0;
    let totalRowsDuplicate = 0;

    try {
      for (const selectedExchange of selectedExchanges) {
        if (officialFetchCancelRequested.current) throw new Error('Official fetch cancelled. Completed windows are saved; use Fetch Official to resume.');
        setOfficialFetchLog((current) => [
          ...current,
          `${selectedExchange} - Fetch started: ${fetchFromDate} to ${fetchToDate}${forceRefresh ? ' (forced)' : ''}`,
        ]);
        setCorporateProgress({
          progress: 0,
          message: forceRefresh
            ? `Force re-fetching official ${selectedExchange} corporate actions...`
            : `Fetching official ${selectedExchange} corporate actions...`,
        });

        try {
          const { fetchResult: result, rows } = await fetchOfficialCorporateActionsAndReload({
            api,
            fetchInput: {
              exchange: selectedExchange,
              fromDate: fetchFromDate,
              toDate: fetchToDate,
              forceRefresh,
            },
            listInput: {
              ...buildOfficialImportListInput(importLoadLimit),
            },
          });
          setLoadedImportRows(rows);
          totalRequestedDays += result.requestedDays;
          totalCachedDays += result.cachedDays;
          totalFetchedDays += result.fetchedDays;
          totalFetchedRanges += result.fetchedRanges;
          totalRowsRead += result.rowsRead;
          totalRowsInserted += result.rowsInserted;
          totalRowsParsed += result.rowsParsed;
          totalRowsUnresolved += result.rowsUnresolved;
          totalRowsDuplicate += result.rowsDuplicate;
          setOfficialFetchLog((current) => [
            ...current,
            `${selectedExchange} - Complete: ${result.rowsRead} read, ${result.rowsInserted} added, ${result.rowsDuplicate} duplicate, ${result.rowsUnresolved} unresolved; reused ${result.cachedDays}/${result.requestedDays} cached day(s) and fetched ${result.fetchedDays} missing day(s) across ${result.fetchedRanges} range(s).`,
          ]);
        } catch (error) {
          if (selectedExchange === 'BSE') {
            setBseFetchFailed(true);
            setImportExchange('BSE');
          }
          setOfficialFetchLog((current) => [
            ...current,
            `${selectedExchange} - Failed: ${getErrorMessage(error, 'Official source fetch failed.')}`,
          ]);
          throw error;
        }
      }

      if (officialFetchCancelRequested.current) throw new Error('Official fetch cancelled. Completed windows are saved; use Fetch Official to resume.');
      const coverageSummary = forceRefresh
        ? `Forced re-fetch completed for ${scopeLabel}: fetched ${totalFetchedDays}/${totalRequestedDays} requested exchange-day(s). Saved coverage was bypassed for this request. `
        : `Official fetch completed for ${scopeLabel}: reused ${totalCachedDays}/${totalRequestedDays} cached exchange-day(s) and fetched ${totalFetchedDays} day(s) across ${totalFetchedRanges} range(s). `;
      setStatus(
        `${coverageSummary}Source rows ${totalRowsRead}. Added ${totalRowsInserted}, parsed ${totalRowsParsed}, unresolved ${totalRowsUnresolved}, duplicate ${totalRowsDuplicate}. Nothing was approved automatically.`,
      );
      setOfficialFetchLog((current) => [
        ...current,
        `All selected exchanges complete: ${totalRowsRead} source row(s).`,
      ]);

      if (activeDatabasePath) {
        const completedRecord: CorporateActionNormalLastFetchRecord = {
          scope: officialFetchExchangeSelection,
          completedAtIso: new Date().toISOString(),
        };
        writeCorporateActionNormalLastFetch(activeDatabasePath, completedRecord);
        setLastSuccessfulOfficialFetch(completedRecord);
      }
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not fetch official corporate actions.'));
    } finally {
      setCorporateProgress({ progress: 0, message: '' });
      setOfficialFetchRunning(false);
      setBusy(false);
    }
  };

  const runHistoricalBackfillPilot = async () => {
    if (!api) {
      return;
    }

    const symbol = historicalBackfillSymbol.trim().toUpperCase();
    const requestedBseScripCode = historicalBackfillBseScripCode.trim();
    if (!symbol) {
      setStatus('Enter an NSE symbol for the historical backfill pilot first.');
      return;
    }
    if (!historicalBackfillFromDate || !historicalBackfillToDate) {
      setStatus('Choose a from/to date range for the historical backfill pilot first.');
      return;
    }

    setBusy(true);
    setCorporateProgress({
      progress: 0,
      message: `Starting historical split/bonus backfill for NSE:${symbol}...`,
    });
    setStatus(`Backfilling historical split/bonus rows for NSE:${symbol}...`);
    try {
      const result = await api.backfillHistoricalCapitalActionsForSymbol({
        exchange: 'NSE',
        symbol,
        fromDate: historicalBackfillFromDate,
        toDate: historicalBackfillToDate,
        bseScripCode: requestedBseScripCode || null,
      });
      const focusedSymbol = result.canonicalSymbol ?? result.requestedSymbol;
      setHistoricalBackfillResult(result);
      setActiveOfficialImportView('review');
      setImportSearchQuery(focusedSymbol);
      if (!requestedBseScripCode && result.bseScripCode) {
        setHistoricalBackfillBseScripCode(result.bseScripCode);
      }
      let reviewQueueReloadWarning: string | null = null;
      try {
        const rows = await api.listCorporateActionImports({
          ...buildOfficialImportListInput(importLoadLimit, 'review'),
          searchQuery: focusedSymbol,
          excludeApproved: true,
        });
        setLoadedImportRows(rows);
      } catch (reloadError) {
        reviewQueueReloadWarning = ` Could not reload the focused review queue: ${getErrorMessage(
          reloadError,
          'Unknown error.',
        )}`;
      }
      setStatus(
        `${formatHistoricalBackfillStatus(result, {
          focusedSymbol,
          requestedBseScripCode: requestedBseScripCode || null,
        })}${reviewQueueReloadWarning ?? ''}`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not run the historical capital-action backfill pilot.'));
    } finally {
      setCorporateProgress({ progress: 0, message: '' });
      setBusy(false);
    }
  };

  const loadHistoricalBackfillRunHistory = async (offset = 0) => {
    if (!api) {
      return;
    }

    setBusy(true);
    setHistoricalBackfillRunsMessage('Loading persisted batch runs...');
    setStatus('Loading historical backfill run history...');
    try {
      const result = await api.listHistoricalCapitalActionBackfillRuns({
        limit: HISTORICAL_BACKFILL_RUN_PAGE_SIZE,
        offset,
      });
      setHistoricalBackfillRuns(result.runs);
      setHistoricalBackfillRunPage({
        total: result.total,
        offset: result.offset,
        limit: result.limit,
        hasMore: result.hasMore,
      });
      setHistoricalBackfillRunsMessage(`${result.message} Refreshed at ${new Date().toLocaleTimeString()}.`);
      setStatus(result.message);
    } catch (error) {
      const message = getErrorMessage(error, 'Could not load historical backfill run history.');
      setHistoricalBackfillRunsMessage(message);
      setStatus(message);
    } finally {
      setBusy(false);
    }
  };

  const populateHistoricalBatchSymbols = (symbols: string[], sourceLabel: string) => {
    const normalizedSymbols = parseHistoricalBackfillBatchSymbols(symbols.join('\n'));
    if (normalizedSymbols.length === 0) {
      setStatus(`${sourceLabel} has no NSE symbols available for the historical batch list.`);
      return;
    }

    const limitedSymbols = normalizedSymbols.slice(0, 25);
    setHistoricalBatchSymbols(limitedSymbols.join('\n'));
    setStatus(
      `Loaded ${limitedSymbols.length} NSE symbol(s) from ${sourceLabel} into the historical batch list. Review the list before running the batch.`,
    );
  };

  const populateHistoricalBatchFromCurrentChart = () => {
    const currentNseSymbol =
      activeInstrument?.exchange === 'NSE'
        ? activeInstrument.symbol
        : activeRequestedInstrument?.exchange === 'NSE'
          ? activeRequestedInstrument.symbol
          : '';
    populateHistoricalBatchSymbols(currentNseSymbol ? [currentNseSymbol] : [], 'current chart');
  };

  const populateHistoricalBatchFromWatchlist = () => {
    if (!selectedHistoricalBatchWatchlist) {
      setStatus('No watchlist is available for the historical batch list.');
      return;
    }

    populateHistoricalBatchSymbols(
      selectedHistoricalBatchWatchlist.items
        .filter((item) => item.exchange === 'NSE')
        .map((item) => item.symbol),
      `watchlist "${selectedHistoricalBatchWatchlist.name}"`,
    );
  };

  const populateHistoricalBatchFromSparseHistory = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('Loading sparse historical capital-action candidates...');
    try {
      const result = await api.listHistoricalCapitalActionSparseCandidates({ exchange: 'NSE', limit: 25 });
      setHistoricalSparseCandidates(result.candidates);
      const symbols = result.candidates.map((candidate) => candidate.symbol);
      const normalizedSymbols = parseHistoricalBackfillBatchSymbols(symbols.join('\n'));
      if (normalizedSymbols.length === 0) {
        setHistoricalBatchSymbols('');
        setStatus(`${result.message} No sparse-history symbols are available for the batch list.`);
        return;
      }

      const topReason = result.candidates[0]?.reason;
      setHistoricalBatchSymbols(normalizedSymbols.join('\n'));
      setStatus(
        `${result.message} Loaded ${normalizedSymbols.length} NSE symbol(s) into the historical batch list. ${
          topReason ? `Top reason: ${topReason} ` : ''
        }Review the list before running the batch.`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not load sparse historical capital-action candidates.'));
    } finally {
      setBusy(false);
    }
  };

  const populateHistoricalBatchFromOldAliases = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('Loading old-alias historical capital-action candidates...');
    try {
      const result = await api.listHistoricalCapitalActionAliasCandidates({ exchange: 'NSE', limit: 25 });
      setHistoricalAliasCandidates(result.candidates);
      const symbols = result.candidates.map((candidate) => candidate.symbol);
      const normalizedSymbols = parseHistoricalBackfillBatchSymbols(symbols.join('\n'));
      if (normalizedSymbols.length === 0) {
        setHistoricalBatchSymbols('');
        setStatus(`${result.message} No old-alias symbols are available for the batch list.`);
        return;
      }

      const topReason = result.candidates[0]?.reason;
      setHistoricalBatchSymbols(normalizedSymbols.join('\n'));
      setStatus(
        `${result.message} Loaded ${normalizedSymbols.length} NSE symbol(s) into the historical batch list. ${
          topReason ? `Top reason: ${topReason} ` : ''
        }Review the list before running the batch.`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not load old-alias historical capital-action candidates.'));
    } finally {
      setBusy(false);
    }
  };

  const populateHistoricalBatchFromMajorLiquid = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('Loading major-liquid historical capital-action candidates...');
    try {
      const result = await api.listHistoricalCapitalActionMajorLiquidCandidates({ exchange: 'NSE', limit: 25 });
      setHistoricalMajorLiquidCandidates(result.candidates);
      const symbols = result.candidates.map((candidate) => candidate.symbol);
      const normalizedSymbols = parseHistoricalBackfillBatchSymbols(symbols.join('\n'));
      if (normalizedSymbols.length === 0) {
        setHistoricalBatchSymbols('');
        setStatus(`${result.message} No major-liquid symbols are available for the batch list.`);
        return;
      }

      const topReason = result.candidates[0]?.reason;
      setHistoricalBatchSymbols(normalizedSymbols.join('\n'));
      setStatus(
        `${result.message} Loaded ${normalizedSymbols.length} NSE symbol(s) into the historical batch list. ${
          topReason ? `Top reason: ${topReason} ` : ''
        }Review the list before running the batch.`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not load major-liquid historical capital-action candidates.'));
    } finally {
      setBusy(false);
    }
  };

  const runHistoricalBackfillBatch = async () => {
    if (!api) {
      return;
    }

    const symbols = parseHistoricalBackfillBatchSymbols(historicalBatchSymbols);
    if (symbols.length === 0) {
      setStatus('Enter at least one NSE symbol for the historical batch backfill.');
      return;
    }
    if (symbols.length > 25) {
      setStatus('Historical batch backfill is limited to 25 symbols per run.');
      return;
    }
    if (!historicalBackfillFromDate || !historicalBackfillToDate) {
      setStatus('Choose a from/to date range for the historical batch backfill first.');
      return;
    }

    setBusy(true);
    setCorporateProgress({
      progress: 0,
      message: `Starting historical split/bonus batch backfill for ${symbols.length} symbol(s)...`,
    });
    setStatus(`Backfilling historical split/bonus rows for ${symbols.length} NSE symbol(s)...`);
    try {
      const result = await api.backfillHistoricalCapitalActionsBatch({
        exchange: 'NSE',
        fromDate: historicalBackfillFromDate,
        toDate: historicalBackfillToDate,
        symbols: symbols.map((symbol) => ({ symbol, bseScripCode: null })),
        stopOnError: historicalBatchStopOnError,
      });
      setHistoricalBatchResult(result);
      setActiveOfficialImportView('review');
      setImportSearchQuery(symbols[0] ?? '');
      let historyReloadWarning = '';
      try {
        const historyResult = await api.listHistoricalCapitalActionBackfillRuns({
          limit: HISTORICAL_BACKFILL_RUN_PAGE_SIZE,
          offset: 0,
        });
        setHistoricalBackfillRuns(historyResult.runs);
        setHistoricalBackfillRunPage({
          total: historyResult.total,
          offset: historyResult.offset,
          limit: historyResult.limit,
          hasMore: historyResult.hasMore,
        });
        setHistoricalBackfillRunsMessage(`${historyResult.message} Refreshed at ${new Date().toLocaleTimeString()}.`);
      } catch (historyError) {
        historyReloadWarning = ` Could not reload run history: ${getErrorMessage(historyError, 'Unknown error.')}`;
        setHistoricalBackfillRunsMessage(historyReloadWarning.trim());
      }
      setStatus(`${formatHistoricalBatchBackfillStatus(result)}${historyReloadWarning}`);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not run the historical capital-action batch backfill.'));
    } finally {
      setCorporateProgress({ progress: 0, message: '' });
      setBusy(false);
    }
  };

  const approveOfficialImportWithIsinMismatch = async () => {
    if (!api || !resolveTargetRow || resolveTargetRow.reviewStatus !== 'PENDING_ISIN_MISMATCH') {
      return;
    }

    const reason = resolveDecisionReason.trim();
    if (reason.length < 10) {
      setStatus('Enter an ISIN-exception reason of at least 10 characters.');
      return;
    }

    setBusy(true);
    setStatus(`Approving ${resolveTargetRow.symbol ?? resolveTargetRow.isin ?? resolveTargetRow.id} with an ISIN exception...`);
    try {
      const result = await api.approveCorporateActionImportWithIsinMismatch({
        importId: resolveTargetRow.id,
        reason,
        expectedDatabasePath: activeDatabasePath ?? '',
      });
      const rows = await api.listCorporateActionImports({
        ...buildOfficialImportListInput(importLoadLimit),
      });
      setLoadedImportRows(rows);
      await onRefresh();
      let refreshNote: string | null = null;
      if (result.approvedRecord) {
        await onReloadInstrument(result.approvedRecord.currentSymbol, result.approvedRecord.exchange, {
          forceReload: true,
          preserveViewport: true,
        });
        refreshNote = buildCorporateActionRefreshNote({
          actionType: result.approvedRecord.actionType,
          symbol: result.approvedRecord.currentSymbol,
          exchange: result.approvedRecord.exchange,
          activeInstrument,
          activeRequestedInstrument,
          adjustedMode,
          includeDividendAdjustments,
          includeRightsAdjustments,
        });
      }
      clearResolveImport();
      setStatus(refreshNote ? `${result.message} ${refreshNote}` : result.message);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not approve the official import with an ISIN exception.'));
    } finally {
      setBusy(false);
    }
  };

  const clearPriceExceptionReview = () => {
    setPriceExceptionImportId(null);
    setPriceExceptionReason('');
  };

  const startPriceExceptionReview = (row: CorporateActionImportRow) => {
    setResolveImportId(null);
    setPriceExceptionImportId(row.id);
    setPriceExceptionReason('');
  };

  const approveOfficialImportWithPriceValidationException = async () => {
    if (!api || !priceExceptionTargetRow || !isSplitOrBonus(priceExceptionTargetRow)) {
      return;
    }
    const reason = priceExceptionReason.trim();
    if (reason.length < 10) {
      setStatus('Enter a price-validation exception reason of at least 10 characters.');
      return;
    }

    setBusy(true);
    setStatus(`Approving ${priceExceptionTargetRow.symbol ?? priceExceptionTargetRow.id} with a price-validation exception...`);
    try {
      const result = await api.approveCorporateActionImportWithPriceValidationException({
        importId: priceExceptionTargetRow.id,
        reason,
        expectedDatabasePath: activeDatabasePath ?? '',
      });
      const rows = await api.listCorporateActionImports({
        ...buildOfficialImportListInput(importLoadLimit),
      });
      setLoadedImportRows(rows);
      await onRefresh();
      let refreshNote: string | null = null;
      if (result.approvedRecord) {
        await onReloadInstrument(result.approvedRecord.currentSymbol, result.approvedRecord.exchange, {
          forceReload: true,
          preserveViewport: true,
        });
        refreshNote = buildCorporateActionRefreshNote({
          actionType: result.approvedRecord.actionType,
          symbol: result.approvedRecord.currentSymbol,
          exchange: result.approvedRecord.exchange,
          activeInstrument,
          activeRequestedInstrument,
          adjustedMode,
          includeDividendAdjustments,
          includeRightsAdjustments,
        });
      }
      clearPriceExceptionReview();
      setStatus(refreshNote ? `${result.message} ${refreshNote}` : result.message);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not approve the Split/Bonus with a price-validation exception.'));
    } finally {
      setBusy(false);
    }
  };

  // The Rust Dividend R1 evaluator, not Split/Bonus scan observations, owns
  // dividend eligibility. P3C is a read-only preview; the writer rechecks it.
  const dividendPreparedImportIds = useMemo(
    () => new Set(currentOfficialDividendWriteStageScope?.importIds ?? []),
    [currentOfficialDividendWriteStageScope],
  );
  const isOfficialRowReady = (row: CorporateActionImportRow): boolean => {
    if (existingDividendByImportId[row.id]?.row === row) return false;
    if (!officialPreparationComplete || officialPreparationErrors[row.id]) return false;
    if (row.actionType !== 'DIVIDEND') {
      return getCorporateActionNormalApprovalState(row, latestScanByImportId.get(row.id)) === 'READY TO APPROVE';
    }
    const disposition = officialDividendPreparedScopeDispositionByImportId.get(row.id);
    return Boolean(dividendPreparedImportIds.has(row.id)) &&
      row.parseStatus === 'PARSED' && row.reviewStatus === 'PENDING' &&
      disposition?.disposition === 'ELIGIBLE' && disposition.evidence != null;
  };
  const eligibleImportRows = visibleImportRows.filter((row) => officialPreparationComplete && !officialPreparationErrors[row.id] && (isOfficialRowReady(row) && (row.actionType === 'DIVIDEND' || row.actionType === 'RIGHTS' || isApprovableCorporateImport(row, latestScanByImportId.get(row.id)))));
  // Aggregate the complete loaded pending queue, independent of type/symbol UI filters.
  const allTypePendingSummary = officialPreparationComplete
    ? summarizeCaPendingByType(importRows, new Set(importRows.filter(isOfficialRowReady).map(row => row.id)))
    : null;
  // Report evidence is deliberately separate from live readiness/write scopes.
  const lastScanReportRef = useRef<{
    databasePath: string; at: string; generation: number;
    summary: ReturnType<typeof summarizeCaPendingByType>;
    dividendOutcome: typeof currentOfficialDividendPreparedScopeOutcome;
  } | null>(null);
  useEffect(() => {
    if (lastScanReportRef.current?.databasePath !== activeDatabasePath) lastScanReportRef.current = null;
    if (!busy && !showingApprovedImports && allTypePendingSummary && activeDatabasePath &&
        lastScanReportRef.current?.generation !== officialPreparationGenerationRef.current) {
      lastScanReportRef.current = {databasePath: activeDatabasePath, at: new Date().toISOString(), generation: officialPreparationGenerationRef.current,
        summary: allTypePendingSummary, dividendOutcome: currentOfficialDividendPreparedScopeOutcome};
    }
  }, [activeDatabasePath, busy, showingApprovedImports, allTypePendingSummary, currentOfficialDividendPreparedScopeOutcome]);
  const lastScanReport = lastScanReportRef.current?.databasePath === activeDatabasePath ? lastScanReportRef.current : null;
  const pendingReportSummary = (!busy && !showingApprovedImports ? allTypePendingSummary : null) ?? lastScanReport?.summary ?? null;
  const reportDividendOutcome = currentOfficialDividendPreparedScopeOutcome ?? lastScanReport?.dividendOutcome ?? null;
  const approvalFailureReport = lastApprovalFailure?.databasePath === activeDatabasePath ? lastApprovalFailure : null;
  const recentApprovalReport = recentApprovals?.databasePath === activeDatabasePath ? recentApprovals : null;
  const savedValidationHistoryReport = savedValidationHistory?.databasePath === activeDatabasePath
    ? savedValidationHistory : null;
  const openSavedValidationHistory = async (loadMore = false) => {
    if (!api || !activeDatabasePath || savedValidationHistoryRequestRef.current) return;
    const databasePath = activeDatabasePath;
    const isCurrent = () => useChartStore.getState().snapshot?.activeDatabasePath === databasePath;
    const previous = loadMore ? savedValidationHistoryReport : null;
    if (loadMore && (!previous?.run || !previous.hasMore)) return;
    savedValidationHistoryRequestRef.current = true;
    setSavedValidationHistoryLoading(true);
    try {
      let run = previous?.run ?? null;
      if (!loadMore) {
        const runs = await api.listCorporateActionActivityRuns({
          operationKind: 'DIVIDEND_VALIDATION', limit: 1, offset: 0,
        });
        run = runs.runs[0] ?? null;
        if (!run) {
          if (isCurrent()) setSavedValidationHistory({
            databasePath, run: null, items: [], offset: 0, total: 0, hasMore: false,
          });
          return;
        }
      }
      if (!run) return;
      const page = await api.listCorporateActionValidationReportItems({
        runId: run.id, limit: 200, offset: previous?.offset ?? 0,
      });
      if (!isCurrent()) return;
      const items = [...(previous?.items ?? [])];
      const seen = new Set(items.map((item) => item.id));
      for (const item of page.items) {
        if (!seen.has(item.id)) { items.push(item); seen.add(item.id); }
      }
      setSavedValidationHistory({
        databasePath, run, items, offset: page.offset + page.items.length,
        total: page.total, hasMore: page.hasMore,
      });
    } catch (error) {
      if (isCurrent()) setSavedValidationHistory({
        databasePath,
        run: previous?.run ?? null,
        items: previous?.items ?? [],
        offset: previous?.offset ?? 0,
        total: previous?.total ?? 0,
        hasMore: previous?.hasMore ?? false,
        error: getErrorMessage(error, 'Could not load saved validation history.'),
      });
    } finally {
      savedValidationHistoryRequestRef.current = false;
      setSavedValidationHistoryLoading(false);
    }
  };
  const openRecentApprovals = async (loadMore = false) => {
    if (!api || !activeDatabasePath || busy || recentApprovalRequestRef.current) return;
    const databasePath = activeDatabasePath;
    const generation = officialPreparationGenerationRef.current;
    const isCurrent = () => useChartStore.getState().snapshot?.activeDatabasePath === databasePath &&
      officialPreparationGenerationRef.current === generation;
    const previous = loadMore ? recentApprovalReport : null;
    if (loadMore && !previous?.hasMore) return;
    recentApprovalRequestRef.current = true;
    setClassicReport('approved');
    setRecentApprovalsLoading(true);
    if (!loadMore) setRecentApprovals(null);
    try {
      // Read saved approvals independently of queue filters. Backend sorts by approval time.
      const rows = await api.listCorporateActionImports({reviewStatus:'APPROVED',limit:APPROVAL_HISTORY_PAGE_SIZE,offset:previous?.offset ?? 0});
      if (isCurrent()) setRecentApprovals({databasePath,...appendApprovalHistoryPage(previous,rows)});
    } catch (error) {
      if (isCurrent()) {
        setRecentApprovals({...previous,databasePath,rows:previous?.rows ?? [],offset:previous?.offset ?? 0,
          hasMore:previous?.hasMore ?? false,error:getErrorMessage(error,'Could not load saved approvals.')});
      }
    } finally { recentApprovalRequestRef.current = false; setRecentApprovalsLoading(false); }
  };
  const selectedEligibleImportRows = eligibleImportRows.filter((row) => selectedImportIds.has(row.id));
  const officialPendingGroups = useMemo(() => {
    if (showingApprovedImports) return [];
    const groups = new Map<string, CorporateActionImportRow[]>();
    for (const row of visibleImportRows) {
      const key = officialImportGroupKey(row);
      const group = groups.get(key) ?? [];
      group.push(row);
      groups.set(key, group);
    }
    return [...groups.entries()]
      .map(([key, rows]) => ({ key, label: officialImportGroupLabel(rows[0]), rows }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [showingApprovedImports, visibleImportRows]);
  const resolveSuggestedOptions = useMemo<ResolveCandidateOption[]>(
    () =>
      resolveSuggestedCandidates.map((candidate) => ({
        symbol: candidate.symbol,
        exchange: candidate.exchange,
        name: candidate.name,
        series: candidate.series,
        isin: candidate.isin,
        isActive: candidate.isActive,
        reason: candidate.reason,
      })),
    [resolveSuggestedCandidates],
  );
  const resolveSuggestedKeys = useMemo(
    () => new Set(resolveSuggestedOptions.map((candidate) => instrumentCandidateKey(candidate))),
    [resolveSuggestedOptions],
  );
  const resolveSearchOptions = useMemo<ResolveCandidateOption[]>(
    () =>
      resolveCandidates
        .filter((candidate) => !resolveSuggestedKeys.has(instrumentCandidateKey(candidate)))
        .map((candidate) => ({
          symbol: candidate.symbol,
          exchange: candidate.exchange,
          name: candidate.name,
          series: candidate.series,
          isin: candidate.isin,
          isActive: true,
          reason: null,
        })),
    [resolveCandidates, resolveSuggestedKeys],
  );
  const topResolveSuggestion = useMemo<ResolveCandidateOption | null>(() => {
    const activeSuggestedOptions = resolveSuggestedOptions.filter((candidate) => candidate.isActive !== false);
    return activeSuggestedOptions.length === 1 ? activeSuggestedOptions[0] : null;
  }, [resolveSuggestedOptions]);
  const selectedResolveCandidate =
    [...resolveSuggestedOptions, ...resolveSearchOptions].find(
      (candidate) => instrumentCandidateKey(candidate) === resolveCandidateKey,
    ) ?? null;

  const toggleImportSelection = (rowId: number, checked: boolean) => {
    setSelectedImportIds((selectedIds) => {
      const next = new Set(selectedIds);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const toggleIssueImportSelection = (rowId: number, checked: boolean) => {
    setSelectedIssueImportIds((selectedIds) => {
      const next = new Set(selectedIds);
      if (checked) {
        next.add(rowId);
      } else {
        next.delete(rowId);
      }
      return next;
    });
  };

  const toggleAllRecheckableIssues = (checked: boolean) => {
    setSelectedIssueImportIds((selectedIds) => {
      const next = new Set(selectedIds);
      for (const row of visibleRecheckableIssueRows) {
        if (checked) {
          next.add(row.id);
        } else {
          next.delete(row.id);
        }
      }
      return next;
    });
  };

  const approveOfficialImportRows = async (
    selectedRows: CorporateActionImportRow[], databasePath: string,
    shouldContinue: () => boolean, onProgress: (progress: OfficialImportOperationProgress) => void,
  ) => {
    if (!api || selectedRows.length === 0 || !shouldContinue()) return;
    const receipt = await applyReviewedCorporateActionBatches({
      api, rows: selectedRows, expectedDatabasePath: databasePath, shouldContinue, onProgress,
      onReconcile: (snapshots) => {
        if (!shouldContinue()) return;
        setImportRows((current) => reconcilePreparedCorporateActionRows(current, snapshots));
      },
      refresh: onRefresh,
      reload: (record) => onReloadInstrument(record.currentSymbol, record.exchange, {
        forceReload: true, preserveViewport: true,
      }),
    });
    if (!shouldContinue()) return;
    setSelectedImportIds(new Set());
    setOfficialPreparationErrors((current) => {
      const next = {...current};
      for (const id of receipt.blockedImportIds) next[id] = 'Apply or refresh needs review. Check Approved before retrying; Load & Validate is required for this action.';
      return next;
    });
    const refreshNote = receipt.approvedRecords.map((record) => buildCorporateActionRefreshNote({
      actionType:record.actionType,symbol:record.currentSymbol,exchange:record.exchange,
      activeInstrument,activeRequestedInstrument,adjustedMode,includeDividendAdjustments,includeRightsAdjustments,
    })).find((note): note is string => Boolean(note));
    const summary = `${receipt.stopped ? 'Apply stopped' : 'Apply finished'}: ${receipt.processed}/${receipt.requested} confirmed responses; ${receipt.approved} approved, ${receipt.linkedExisting} linked existing, ${receipt.alreadyApproved} already approved, ${receipt.failed} failed. Raw EOD prices were not changed.`;
    const message = [summary,refreshNote,receipt.warnings.length ? `${receipt.warnings.length} warning(s): ${receipt.warnings.slice(0,3).join('; ')}` : null].filter(Boolean).join(' ');
    setStatus(message);
    setOfficialTaskProgress((current) => current ? {...current,message,endedAt:Date.now()} : null);
  };

  const approveRecommendedIdentityRows = async (rowsToApprove: CorporateActionImportRow[]) => {
    if (!api) return;
    const uniqueRows = [...new Map(rowsToApprove.map((row) => [row.id, row])).values()];
    if (uniqueRows.length === 0) {
      setStatus('No strict recommended identity rows are ready for approval.');
      return;
    }
    const batches = chunkCorporateIdentityRecommendationIds(uniqueRows.map((row) => row.id));
    const totals = { requested: 0, approved: 0, linkedExisting: 0, alreadyApproved: 0, failed: 0 };
    const approvedRecords: CorporateActionResult[] = [];
    const failureMessages: string[] = [];
    setBusy(true);
    try {
      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        setStatus(`Approving recommended identities: batch ${index + 1}/${batches.length} (${batch.length} row(s)); ${totals.requested}/${uniqueRows.length} processed...`);
        const result = await api.approveRecommendedCorporateActionIsinMismatches({ importIds: batch, expectedDatabasePath: activeDatabasePath ?? '' });
        totals.requested += result.requested;
        totals.approved += result.approved;
        totals.linkedExisting += result.linkedExisting;
        totals.alreadyApproved += result.alreadyApproved;
        totals.failed += result.failed;
        approvedRecords.push(...result.results.flatMap((approval) => approval.approvedRecord ? [approval.approvedRecord] : []));
        for (const failure of result.errors) {
          const row = uniqueRows.find((candidate) => candidate.id === failure.importId);
          failureMessages.push(`${row?.symbol ?? row?.isin ?? failure.importId}: ${failure.message}`);
        }
      }
      const refreshedRows = await api.listCorporateActionImports({ ...buildOfficialImportListInput(importLoadLimit) });
      setLoadedImportRows(refreshedRows);
      await onRefresh();
      const reloadedKeys = new Set<string>();
      for (const record of approvedRecords) {
        const key = `${record.exchange}:${record.currentSymbol}`;
        if (reloadedKeys.has(key)) continue;
        reloadedKeys.add(key);
        await onReloadInstrument(record.currentSymbol, record.exchange, { forceReload: true, preserveViewport: true });
      }
      if (resolveImportId && uniqueRows.some((row) => row.id === resolveImportId) && totals.failed === 0) clearResolveImport();
      const failureSuffix = failureMessages.length > 0 ? ` Review: ${failureMessages.slice(0, 3).join('; ')}` : '';
      setStatus(`Recommended identity approval completed: ${totals.requested} requested in ${batches.length} batch(es); ${totals.approved} approved, ${totals.linkedExisting} linked existing, ${totals.alreadyApproved} already approved, ${totals.failed} failed. Raw EOD prices were not changed.${failureSuffix}`);
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not approve the recommended identity rows.'));
    } finally {
      setBusy(false);
    }
  };

  const requestOfficialImportApproval = async (mode: 'selected' | 'all-ready', visibleReadyIds?: readonly number[]) => {
    if (officialOperationRunningRef.current || officialApprovalPreparingRef.current || busy) return;
    const allowedIds = visibleReadyIds ? new Set(visibleReadyIds) : null;
    const rows = selectCorporateActionApprovalTargetRows(
      allowedIds ? eligibleImportRows.filter(row => allowedIds.has(row.id)) : eligibleImportRows,
      selectedImportIds, mode);
    if (rows.length === 0) {
      setStatus(mode === 'selected' ? 'Select at least one ready action first.' : 'There are no ready actions in the current review scope.');
      return;
    }
    const scopeLabel = visibleReadyIds ? 'the current filtered table' : officialReviewSymbolFilter === 'ALL'
      ? (normalizedImportSearchQuery ? `current filtered review (${importSearchQuery.trim()})` : 'all visible pending actions')
      : officialReviewSymbolOptions.find(([key]) => key === officialReviewSymbolFilter)?.[1] ?? 'current symbol';
    const dividendImportIds = rows.filter((row) => row.actionType === 'DIVIDEND').map((row) => row.id);
    const databasePath = activeDatabasePath ?? '';
    const generation = officialPreparationGenerationRef.current;
    const dividendScope = currentOfficialDividendWriteStageScope;
    const dividendOutcome = currentOfficialDividendPreparedScopeOutcome;
    const dividendDrafts: DividendWriteStageDraft[] = [];
    officialApprovalPreparingRef.current = true;
    setBusy(true);
    try {
      if (dividendImportIds.length && (!CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_ENABLED || !dividendScope || !dividendOutcome)) {
        throw new Error('Dividend eligibility is no longer current. Load & Validate again.');
      }
      for (let start = 0; start < dividendImportIds.length; start += CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_MAX_IDS) {
        const batch = dividendImportIds.slice(start, start + CORPORATE_ACTION_DIVIDEND_WRITE_STAGE_MAX_IDS);
        const drafted = await prepareDividendWriteStageDraft({
          scope: dividendScope, outcome: dividendOutcome, selectedImportIds: batch,
          getCurrentContext: () => ({
            generation: officialPreparationGenerationRef.current,
            databasePath: useChartStore.getState().snapshot?.activeDatabasePath ?? null,
            preparationComplete: officialPreparationComplete,
            cancelled: officialCancelPreparationRef.current,
            operationRunning: officialOperationRunningRef.current,
          }),
        });
        if (drafted.status !== 'READY') throw new Error(drafted.reason);
        if (drafted.draft.generation !== generation) throw new Error('Dividend preparation changed. Load & Validate again.');
        dividendDrafts.push(drafted.draft);
      }
      if (generation !== officialPreparationGenerationRef.current ||
          useChartStore.getState().snapshot?.activeDatabasePath !== databasePath) {
        throw new Error('Database or preparation changed before approval. Load & Validate again.');
      }
      // No write is dispatched until the distinct confirmation action below.
      setOfficialApprovalConfirmation({
        mode, importIds: rows.map((row) => row.id), dividendImportIds, dividendDrafts,
        fingerprints: Object.fromEntries(rows.map((row) => [row.id, corporateActionApprovalFingerprint(row, latestScanByImportId.get(row.id))])),
        scopeLabel, databasePath, generation,
      });
      setOfficialTaskProgress(null);
    } catch (error) {
      setOfficialApprovalConfirmation(null);
      setStatus(getErrorMessage(error, 'Could not prepare exact Dividend approval selection.'));
    } finally {
      officialApprovalPreparingRef.current = false;
      setBusy(false);
    }
  };

  const confirmOfficialImportApproval = async () => {
    if (!api || !officialApprovalConfirmation || officialOperationRunningRef.current || officialApprovalPreparingRef.current) return;
    const confirmation = officialApprovalConfirmation;
    const dividendScope = currentOfficialDividendWriteStageScope;
    const dividendOutcome = currentOfficialDividendPreparedScopeOutcome;
    const context = () => ({
      generation: officialPreparationGenerationRef.current,
      databasePath: useChartStore.getState().snapshot?.activeDatabasePath ?? null,
      preparationComplete: officialPreparationComplete,
      cancelled: officialCancelPreparationRef.current,
      operationRunning: officialOperationRunningRef.current,
    });
    const shouldContinue = () => officialPreparationGenerationRef.current === confirmation.generation &&
      useChartStore.getState().snapshot?.activeDatabasePath === confirmation.databasePath;
    if (!shouldContinue() || confirmation.dividendDrafts.some((draft) =>
      !isDividendWriteStageDraftCurrent(draft, dividendScope, dividendOutcome, context()))) {
      setOfficialApprovalConfirmation(null);
      setStatus('The prepared database, Dividend evidence, or review generation changed. Load & Validate again.');
      return;
    }
    officialOperationRunningRef.current = true;
    const startedAt = Date.now();
    const report = (progress: OfficialImportOperationProgress) => {
      if (shouldContinue()) setOfficialTaskProgress({...progress,startedAt});
    };
    setBusy(true);
    setCorporateProgress({progress:0,message:''});
    setOfficialApprovalConfirmation(null);
    let completedApprovalSummary: string | null = null;
    let queueReconciled = false;
    try {
      // Every write requires this explicit second user click. The Rust owner
      // independently revalidates identity, official receipt, local price basis,
      // same-date exclusions, and duplicate canonical records in its transaction.
      const dividendTotals = { requested: 0, approved: 0, blocked: 0 };
      for (const draft of confirmation.dividendDrafts) {
        if (!shouldContinue()) throw new Error('Database changed. Dividend confirmation is no longer current.');
        let reply: unknown;
        try {
          reply = await api.executeSimpleCashDividendWriteStage(draft.input);
        } catch (error) {
          throw new Error(describeDividendDispatchFailure(getErrorMessage(error, 'No authoritative receipt.')));
        }
        const receipt = verifyDividendWriteStageReceipt(draft.input, reply);
        if (receipt.status !== 'COMMITTED') {
          throw new Error(`Dividend approval result uncertain: ${receipt.reason} Do not retry; check Approved and reload.`);
        }
        dividendTotals.requested += receipt.result.requested;
        dividendTotals.approved += receipt.result.autoApproved;
        dividendTotals.blocked += receipt.result.ineligible + receipt.result.staleScope + receipt.result.missing + receipt.result.alreadyApproved;
      }
      if (!shouldContinue()) throw new Error('Database changed after dividend commit. Check Approved before retrying.');
      const normalIds = confirmation.importIds.filter((id) => !confirmation.dividendImportIds.includes(id));
      if (normalIds.length) {
        const checked = await recheckReviewedCorporateActionImports({
          api, importIds: normalIds, expectedDatabasePath: confirmation.databasePath,
          fingerprints: confirmation.fingerprints, fingerprint: corporateActionApprovalFingerprint,
          preparationErrors: officialPreparationErrors, explicitApprovalOnly: true, shouldContinue, onProgress: report,
        });
        if (!shouldContinue()) return;
        mergeOfficialValidationRows(checked.validationRows, checked.validationImportIds);
        await approveOfficialImportRows(checked.rows, confirmation.databasePath, shouldContinue, report);
      }
      if (!shouldContinue()) return;
      // Keep the full prepared queue while refreshing charts. A list read using
      // the search field here would replace it with just the selected symbol.
      if (dividendTotals.requested) {
        await onRefresh();
        if (!shouldContinue()) return;
        const eligibleDividendRows = importRows.filter((row) => confirmation.dividendImportIds.includes(row.id));
        const refreshedSymbols = new Set<string>();
        for (const row of eligibleDividendRows) {
          if (!row.symbol || !row.exchange || !confirmation.dividendImportIds.includes(row.id)) continue;
          const key = `${row.exchange}:${row.symbol}`;
          if (refreshedSymbols.has(key)) continue;
          refreshedSymbols.add(key);
          // Reloading is post-commit and preserves the currently viewed chart.
          if (activeInstrument?.symbol === row.symbol && activeInstrument?.exchange === row.exchange) {
            await onReloadInstrument(row.symbol, row.exchange, { forceReload: true, preserveViewport: true });
          }
        }
        completedApprovalSummary = `Explicit Dividend approval: ${dividendTotals.approved}/${dividendTotals.requested} committed; ${dividendTotals.blocked} blocked or already approved. Rust revalidated every item. No raw EOD prices changed.`;
      }
      if (!shouldContinue()) return;
      completedApprovalSummary ??= 'Reviewed corporate action approval completed.';
      setSelectedImportIds(new Set());
      setStatus(`${completedApprovalSummary} Refreshing affected events only...`);
      const refreshed = await refreshCorporateActionQueueAfterApproval({
        api, rows: importRows, approvedSelection: confirmation.importIds,
        previousOutcome: dividendOutcome, previousGeneration: confirmation.generation,
        expectedDatabasePath: confirmation.databasePath, shouldContinue,
      });
      if (!shouldContinue()) return;
      setImportRows(refreshed.rows);
      mergeOfficialValidationRows(refreshed.validationRows, refreshed.validationIds);
      setOfficialDividendPreparedScopeOutcome(refreshed.outcome);
      setOfficialDividendWriteStageScope(refreshed.scope);
      queueReconciled = true;
      const message = `${completedApprovalSummary} Refreshed ${refreshed.affectedCount} related stored events; unrelated readiness retained. No full rescan.`;
      setStatus(message);
      setOfficialTaskProgress({stage:'complete',completed:refreshed.affectedCount,total:refreshed.affectedCount,
        message,startedAt,endedAt:Date.now()});
    } catch(error) {
      if (!shouldContinue()) return;
      const failure = [completedApprovalSummary, getErrorMessage(error, 'Approval did not complete. Check Approved before retrying.')].filter(Boolean).join(' ');
      setStatus(failure);
      setLastApprovalFailure({databasePath:confirmation.databasePath,at:new Date().toISOString(),message:failure});
      setOfficialTaskProgress((current) => current ? {...current,stage:'stopped',message:failure,endedAt:Date.now()} : null);
    } finally {
      if (shouldContinue()) {
        // Expire old confirmations. Carry only successfully reconciled evidence
        // into the next generation; uncertain writes/refreshes stay invalidated.
        pendingReviewRef.current = null;
        officialPreparationGenerationRef.current += 1;
        setOfficialPreparationComplete(queueReconciled);
        setOfficialAutoApproval(null);
        if (!queueReconciled) {
          setOfficialDividendPreparedScopeOutcome(null);
          if (typeof setOfficialDividendWriteStageScope !== "undefined") setOfficialDividendWriteStageScope(null);
        }
        officialOperationRunningRef.current = false;
        setBusy(false);
        setCorporateProgress({progress:0,message:''});
      }
    }
  };

  const approveSelectedOfficialImports = async () => {
    requestOfficialImportApproval('selected');
  };

  const approveAllReadyOfficialImports = async () => {
    requestOfficialImportApproval('all-ready');
  };


  const validateSplitBonusRows = async (rows: CorporateActionImportRow[]) => {
    if (!api) {
      return;
    }
    const importIds = [...new Set(
      rows
        .filter(
          (row) =>
            isSplitOrBonus(row) &&
            row.parseStatus === 'PARSED' &&
            row.reviewStatus !== 'APPROVED' &&
            Boolean(row.symbol) &&
            Boolean(row.exDate) &&
            row.factor != null,
        )
        .map((row) => row.id),
    )];
    if (importIds.length === 0) {
      setStatus('No parsed, instrument-matched Split/Bonus rows are available for price validation.');
      return;
    }

    setBusy(true);
    setStatus(`Validating ${importIds.length} Split/Bonus import(s) against local EOD prices...`);
    try {
      const collected: CorporateActionScanResultRow[] = [];
      for (let start = 0; start < importIds.length; start += 500) {
        const batch = importIds.slice(start, start + 500);
        const result = await api.runCorporateActionScan({ scope: 'official_imports', importIds: batch });
        collected.push(...result.results);
      }
      mergeOfficialValidationRows(collected);
      const matched = collected.filter((row) => row.scanStatus === 'MATCHED').length;
      const review = collected.length - matched;
      setScanSummary(`Validated ${collected.length} targeted Split/Bonus import(s): ${matched} matched, ${review} need review.`);
      setStatus(
        `Split/Bonus price validation completed: ${matched} matched, ${review} need review. Genuine ex-date market gaps are shown separately and are not adjusted away.`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not validate the selected Split/Bonus imports.'));
    } finally {
      setBusy(false);
    }
  };

  const runOfficialScan = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const result = await api.runCorporateActionScan({ scope: 'official_imports' });
      setScanRows(result.results);
      setScanSummary(
        result.scanRun
          ? `${result.scanRun.status}: ${result.scanRun.totalResults} official split/bonus candidate(s) scanned.`
          : 'No scan run was created.',
      );
      setStatus(
        `${result.scanRun?.message ?? 'Corporate action scan completed.'} Review only; nothing was applied automatically.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not scan official corporate action imports.');
    } finally {
      setBusy(false);
    }
  };

  const runBlindScan = async () => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const result = await api.runCorporateActionScan({ scope: 'blind_anomalies' });
      setScanRows(result.results);
      setScanSummary(
        result.scanRun
          ? `${result.scanRun.status}: ${result.scanRun.totalResults} split/bonus-like price gap(s) found.`
          : 'No scan run was created.',
      );
      setStatus(
        `${result.scanRun?.message ?? 'Blind corporate action scan completed.'} Review only; nothing was applied automatically.`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not run the blind corporate action scan.');
    } finally {
      setBusy(false);
    }
  };

  const loadScanResults = async (requestedLimit = scanLoadLimit) => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus('');
    try {
      const result = await api.listCorporateActionScanResults({
        limit: requestedLimit,
        searchQuery: scanSearchQuery.trim() || null,
      });
      setScanLoadLimit(requestedLimit);
      setScanRows(result.results);
      setScanSummary(
        result.scanRun
          ? `${result.scanRun.status}: ${result.scanRun.totalResults} result(s) from ${result.scanRun.startedAt}.`
          : 'No scan results found.',
      );
      setStatus(
        result.results.length
          ? `Loaded ${result.results.length} scan result(s). Scan results are review-only until you manually approve selected split/bonus imports.`
          : 'No scan results found.',
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not load corporate action scan results.');
    } finally {
      setBusy(false);
    }
  };

  const startResolveImport = (row: CorporateActionImportRow) => {
    clearPriceExceptionReview();
    setResolveImportId(row.id);
    setResolveSearchQuery(row.symbol ?? row.companyName ?? activeInstrument?.symbol ?? '');
    setResolveSuggestedCandidates([]);
    setResolveSuggestionsMessage('');
    setResolveCandidates([]);
    setResolveCandidateKey(null);
    setResolveDecisionReason('');
  };

  const clearResolveImport = () => {
    setResolveImportId(null);
    setResolveSearchQuery('');
    setResolveSuggestedCandidates([]);
    setResolveSuggestionsMessage('');
    setResolveCandidates([]);
    setResolveCandidateKey(null);
    setResolveDecisionReason('');
  };

  const resolveOfficialImport = async (
    mode: 'auto' | 'manual',
    candidateOverride?: ResolveCandidateOption | null,
  ) => {
    if (!api || !resolveTargetRow) {
      return;
    }

    const manualCandidate = candidateOverride ?? selectedResolveCandidate;

    if (mode === 'manual' && !manualCandidate) {
      setStatus('Select a current database symbol before resolving this row.');
      return;
    }
    if (mode === 'manual' && resolveDecisionReason.trim().length < 10) {
      setStatus('Enter a manual-resolution reason of at least 10 characters.');
      return;
    }

    setBusy(true);
    setStatus(
      mode === 'manual'
        ? `Resolving ${resolveTargetRow.symbol ?? resolveTargetRow.isin ?? resolveTargetRow.id} to ${manualCandidate?.exchange}:${manualCandidate?.symbol}...`
        : `Rechecking ${resolveTargetRow.symbol ?? resolveTargetRow.isin ?? resolveTargetRow.id} against the current database...`,
    );
    try {
      const result = await api.resolveCorporateActionImport({
        importId: resolveTargetRow.id,
        symbol: mode === 'manual' ? manualCandidate?.symbol ?? null : null,
        exchange: mode === 'manual' ? manualCandidate?.exchange ?? null : null,
        reason: mode === 'manual' ? resolveDecisionReason.trim() : null,
      });
      const rows = await api.listCorporateActionImports({
        ...buildOfficialImportListInput(importLoadLimit),
      });
      setLoadedImportRows(rows);
      setStatus(result.message);
      if (result.importRecord.reviewStatus !== 'UNRESOLVED') {
        clearResolveImport();
      }
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not resolve the official import row.'));
    } finally {
      setBusy(false);
    }
  };

  const applyCurrentSymbolFilter = (
    setter: React.Dispatch<React.SetStateAction<string>>,
    exchangeOverride?: string | null,
  ) => {
    if (!activeInstrument) {
      setStatus('Open a chart symbol first.');
      return;
    }
    if (exchangeOverride && activeInstrument.exchange !== exchangeOverride) {
      setStatus(`The active chart symbol is ${activeInstrument.exchange}. Switch to a ${exchangeOverride} chart or type a symbol manually.`);
      return;
    }
    setter(activeInstrument.symbol);
  };

  const loadMoreScanResults = async () => {
    await loadScanResults(scanLoadLimit + CORPORATE_SCAN_LOAD_STEP);
  };

  const renderImportActionTypeFilters = () => (
    <div style={corporateImportFilterRowStyle}>
      <span style={utilityFieldLabelStyle}>Types:</span>
      {CORPORATE_IMPORT_FILTER_TYPES.map((filterType) => (
        <label key={filterType} style={corporateImportFilterCheckboxStyle}>
          <input
            type="checkbox"
            checked={selectedImportActionTypes.includes(filterType)}
            onChange={(event) => toggleImportActionType(filterType, event.target.checked)}
          />
          <span>{formatCorporateActionTypeLabel(filterType)}</span>
        </label>
      ))}
    </div>
  );

  const renderSearchBar = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    onUseCurrent?: () => void,
    placeholder = 'Filter by symbol, company, or ISIN',
    currentButtonLabel = 'Current',
  ) => (
    <div style={corporateSearchRowStyle}>
      <span style={utilityFieldLabelStyle}>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={utilityInputStyle}
        placeholder={placeholder}
      />
      {onUseCurrent ? (
        <button type="button" style={modalButtonStyle} onClick={onUseCurrent} disabled={busy || !hasDatabase}>
          {currentButtonLabel}
        </button>
      ) : null}
    </div>
  );

  const renderResolvePanel = () => {
    if (!resolveTargetRow) {
      return null;
    }

    const comparisonCandidate = selectedResolveCandidate ?? topResolveSuggestion;
    const officialSymbol = resolveTargetRow.symbol?.trim() ?? '';
    const officialExchange = resolveTargetRow.exchange.trim();
    const officialIsin = resolveTargetRow.isin?.trim() ?? '';
    const candidateSymbol = comparisonCandidate?.symbol?.trim() ?? '';
    const candidateExchange = comparisonCandidate?.exchange?.trim() ?? '';
    const candidateIsin = comparisonCandidate?.isin?.trim() ?? '';
    const exactSymbolMatch = Boolean(
      officialSymbol && candidateSymbol && officialSymbol.toUpperCase() === candidateSymbol.toUpperCase(),
    );
    const exactExchangeMatch = Boolean(
      officialExchange && candidateExchange && officialExchange.toUpperCase() === candidateExchange.toUpperCase(),
    );
    const exactIsinMatch = Boolean(
      officialIsin && candidateIsin && officialIsin.toUpperCase() === candidateIsin.toUpperCase(),
    );
    const identityRecommendation = importIdentityHints[resolveTargetRow.id] ?? null;
    const isRecommendedIdentity = identityRecommendation?.recommendedIsinException === true;
    const eventIdentity = eventIdentityByImportId[resolveTargetRow.id] ?? null;

    return (
      <div
        style={corporateResolveWorkspaceStyle}
        role="region"
        aria-label={`Review identity for ${resolveTargetRow.symbol ?? resolveTargetRow.isin ?? 'official import'}`}
      >
        <div style={corporateResolveDialogStyle}>
          <div style={corporateResolveHeaderStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={officialImportSectionTitleStyle}>
                Review Identity — {resolveTargetRow.exchange}:{resolveTargetRow.symbol ?? resolveTargetRow.isin ?? 'selected row'}
              </div>
              <div style={utilityHelperTextStyle}>
                {resolveTargetRow.message ?? 'Confirm the current database instrument before approving this official corporate action.'}
              </div>
            </div>
            <button type="button" style={modalButtonStyle} onClick={clearResolveImport} disabled={busy}>
              Close
            </button>
          </div>

          <div style={corporateResolveBodyStyle}>
            <div style={corporateIdentityCompareGridStyle}>
              <div style={corporateIdentityCardStyle}>
                <div style={officialImportSectionTitleStyle}>Official Corporate Action</div>
                <div style={corporateIdentityValueRowStyle}><span>Exchange</span><strong>{resolveTargetRow.exchange}</strong></div>
                <div style={corporateIdentityValueRowStyle}><span>Symbol</span><strong>{resolveTargetRow.symbol ?? '-'}</strong></div>
                <div style={corporateIdentityValueRowStyle}><span>Official ISIN</span><strong>{resolveTargetRow.isin ?? '-'}</strong></div>
                <div style={corporateIdentityValueRowStyle}><span>Company</span><strong>{resolveTargetRow.companyName ?? '-'}</strong></div>
                <div style={corporateIdentityValueRowStyle}><span>Ex-date</span><strong>{resolveTargetRow.exDate ?? '-'}</strong></div>
                <div style={corporateIdentityValueRowStyle}><span>Action</span><strong>{formatCorporateActionTypeLabel(resolveTargetRow.actionType)}</strong></div>
              </div>

              <div style={corporateIdentityCardStyle}>
                <div style={officialImportSectionTitleStyle}>Current Database Candidate</div>
                {comparisonCandidate ? (
                  <>
                    <div style={corporateIdentityValueRowStyle}><span>Exchange</span><strong>{comparisonCandidate.exchange}</strong></div>
                    <div style={corporateIdentityValueRowStyle}><span>Symbol</span><strong>{comparisonCandidate.symbol}</strong></div>
                    <div style={corporateIdentityValueRowStyle}><span>Current ISIN</span><strong>{comparisonCandidate.isin ?? '-'}</strong></div>
                    <div style={corporateIdentityValueRowStyle}><span>Company</span><strong>{comparisonCandidate.name ?? '-'}</strong></div>
                    <div style={corporateIdentityValueRowStyle}><span>Series</span><strong>{comparisonCandidate.series ?? '-'}</strong></div>
                    <div style={corporateIdentityValueRowStyle}><span>Status</span><strong>{comparisonCandidate.isActive === false ? 'Inactive' : 'Active'}</strong></div>
                  </>
                ) : (
                  <div style={corporateEmptyStateStyle}>Select a suggested or manual-search candidate to compare identities.</div>
                )}
              </div>

              <div style={corporateIdentityCardStyle}>
                <div style={officialImportSectionTitleStyle}>Historical Event Identity</div>
                <div style={corporateIdentityValueRowStyle}>
                  <span>Event symbol</span>
                  <strong>{eventIdentity?.eventSymbol ?? resolveTargetRow.symbol ?? '-'}</strong>
                </div>
                <div style={corporateIdentityValueRowStyle}>
                  <span>Event ISIN</span>
                  <strong>
                    {eventIdentity?.resolved
                      ? formatCorporateActionEventIsin(eventIdentity.eventIsin)
                      : resolveTargetRow.isin ?? '-'}
                  </strong>
                </div>
                <div style={corporateIdentityValueRowStyle}>
                  <span>Transition</span>
                  <strong>
                    {eventIdentity?.transitionOldSymbol && eventIdentity?.transitionNewSymbol
                      ? `${eventIdentity.transitionOldSymbol} → ${eventIdentity.transitionNewSymbol}`
                      : '-'}
                  </strong>
                </div>
                <div style={corporateIdentityValueRowStyle}>
                  <span>Effective</span>
                  <strong>{eventIdentity?.transitionEffectiveDate ?? '-'}</strong>
                </div>
                <div style={corporateIdentityValueRowStyle}>
                  <span>Authority</span>
                  <strong>{eventIdentity?.resolutionAuthority ?? '-'}</strong>
                </div>
              </div>
            </div>

            <div style={corporateIdentityStatusRowStyle}>
              <span>{comparisonCandidate ? (exactExchangeMatch ? '✓ Exchange matches' : '⚠ Exchange differs') : '— Exchange not compared'}</span>
              <span>{comparisonCandidate ? (exactSymbolMatch ? '✓ Exact symbol match' : '⚠ Symbol differs') : '— Symbol not compared'}</span>
              <span>
                {!comparisonCandidate
                  ? '— ISIN not compared'
                  : !officialIsin || !candidateIsin
                    ? '⚠ ISIN unavailable on one side'
                    : exactIsinMatch
                      ? '✓ ISIN matches'
                      : '⚠ ISIN differs'}
              </span>
            </div>
            {isRecommendedIdentity ? (
              <div style={{ ...corporateIdentityStatusRowStyle, borderColor: 'var(--accent)' }}>
                <strong>Recommended identity match</strong>
                <span>{identityRecommendation?.message}</span>
                <span>Explicit operator approval is required; no row is resolved or approved automatically.</span>
              </div>
            ) : null}

            {renderSearchBar(
              'Find Symbol:',
              resolveSearchQuery,
              setResolveSearchQuery,
              () => applyCurrentSymbolFilter(setResolveSearchQuery, resolveTargetRow.exchange),
              `Search ${resolveTargetRow.exchange} symbol or company`,
            )}
            <div style={utilityHelperTextStyle}>
              {resolveSuggestionsMessage || 'Loading structured resolution suggestions for this row...'}
            </div>

            {resolveSuggestedOptions.length > 0 ? (
              <section style={corporateResolveSectionStyle}>
                <div>
                  <div style={utilityFieldLabelStyle}>Suggested Matches</div>
                  <div style={utilityHelperTextStyle}>Select the current database instrument that represents this official historical identity.</div>
                </div>
                <div style={corporateResolveCandidatesStyle}>
                  {resolveSuggestedOptions.map((candidate) => {
                    const candidateKey = instrumentCandidateKey(candidate);
                    const active = candidateKey === resolveCandidateKey;
                    return (
                      <button
                        key={`suggested-${candidateKey}`}
                        type="button"
                        style={corporateResolveCandidateStyle(active)}
                        onClick={() => setResolveCandidateKey(candidateKey)}
                      >
                        <span>
                          <strong>{candidate.exchange}:{candidate.symbol}</strong>
                          {candidate.series ? ` (${candidate.series})` : ''}
                          {candidate.isActive === false ? ' [inactive]' : ''}
                        </span>
                        <span style={corporatePurposeCellStyle}>{candidate.name ?? candidate.isin ?? '-'}</span>
                        <span style={utilityHelperTextStyle}>ISIN: {candidate.isin ?? '-'}</span>
                        {candidate.reason ? <span style={{ ...utilityHelperTextStyle, gridColumn: '1 / -1' }}>{candidate.reason}</span> : null}
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section style={corporateResolveSectionStyle}>
                <div style={utilityFieldLabelStyle}>Suggested Matches</div>
                <div style={corporateEmptyStateStyle}>No structured current-database suggestions are available for this row.</div>
              </section>
            )}

            <section style={corporateResolveSectionStyle}>
              <div>
                <div style={utilityFieldLabelStyle}>Manual Search Results</div>
                <div style={utilityHelperTextStyle}>Use manual search only when the suggested matches do not identify the correct instrument.</div>
              </div>
              <div style={corporateResolveSearchResultsStyle}>
                {resolveSearchOptions.map((candidate) => {
                  const candidateKey = instrumentCandidateKey(candidate);
                  const active = candidateKey === resolveCandidateKey;
                  return (
                    <button
                      key={candidateKey}
                      type="button"
                      style={corporateResolveCandidateStyle(active)}
                      onClick={() => setResolveCandidateKey(candidateKey)}
                    >
                      <span>
                        <strong>{candidate.exchange}:{candidate.symbol}</strong>
                        {candidate.series ? ` (${candidate.series})` : ''}
                      </span>
                      <span style={corporatePurposeCellStyle}>{candidate.name ?? candidate.isin ?? '-'}</span>
                      <span style={utilityHelperTextStyle}>ISIN: {candidate.isin ?? '-'}</span>
                    </button>
                  );
                })}
                {!resolveSearchQuery.trim() ? (
                  <div style={corporateEmptyStateStyle}>
                    Type a current symbol or company name above only if you need to search beyond the suggested matches.
                  </div>
                ) : resolveSearchOptions.length === 0 ? (
                  <div style={corporateEmptyStateStyle}>No current database symbols matched that search.</div>
                ) : null}
              </div>
            </section>

            <details style={corporateEvidenceDetailsStyle}>
              <summary style={corporateEvidenceSummaryToggleStyle}>
                Source Evidence — {formatCorporateImportEvidenceSummary(resolveTargetRow)}
              </summary>
              <div style={corporateEvidenceDetailsBodyStyle}>
                {resolveTargetRow.latestEvidenceCapturedAt ? (
                  <span>Latest capture: {resolveTargetRow.latestEvidenceCapturedAt}</span>
                ) : null}
                {resolveTargetRow.latestEvidenceSourceLocator ? (
                  <span style={{ overflowWrap: 'anywhere' }}>{resolveTargetRow.latestEvidenceSourceLocator}</span>
                ) : null}
                {resolveTargetRow.latestEvidenceNote ? <span>{resolveTargetRow.latestEvidenceNote}</span> : null}
              </div>
            </details>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={utilityFieldLabelStyle}>Decision Reason</span>
              <textarea
                value={resolveDecisionReason}
                onChange={(event) => setResolveDecisionReason(event.target.value)}
                style={{ ...utilityInputStyle, height: 88, minHeight: 88, padding: 8, resize: 'vertical' }}
                maxLength={1000}
                placeholder={
                  resolveTargetRow.reviewStatus === 'PENDING_ISIN_MISMATCH'
                    ? 'Explain why the historical identity evidence justifies this ISIN exception.'
                    : 'Explain why the selected current database symbol is the correct company.'
                }
              />
              <span style={utilityHelperTextStyle}>
                Required for manual mapping and exceptional ISIN-mismatch approval; stored with the before/after identity audit record (10-1000 characters).
              </span>
            </label>
          </div>

          <div style={corporateResolveActionsStyle}>
            <button type="button" style={modalButtonStyle} onClick={() => void resolveOfficialImport('auto')} disabled={busy}>
              Recheck Identity
            </button>
            {isRecommendedIdentity ? (
              <button type="button" style={primaryButtonStyle} onClick={() => void approveRecommendedIdentityRows([resolveTargetRow])} disabled={busy}>
                Confirm Recommended Identity
              </button>
            ) : null}
            {topResolveSuggestion ? (
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => void resolveOfficialImport('manual', topResolveSuggestion)}
                disabled={busy || resolveDecisionReason.trim().length < 10}
              >
                Confirm Suggested Match
              </button>
            ) : null}
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => void resolveOfficialImport('manual')}
              disabled={busy || !selectedResolveCandidate || resolveDecisionReason.trim().length < 10}
            >
              Confirm Selected Match
            </button>
            {resolveTargetRow.reviewStatus === 'PENDING_ISIN_MISMATCH' ? (
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => void approveOfficialImportWithIsinMismatch()}
                disabled={busy || resolveDecisionReason.trim().length < 10}
              >
                Approve Historical ISIN Exception
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  };

  const renderPriceExceptionPanel = () => {
    if (!priceExceptionTargetRow) {
      return null;
    }
    const scan = latestScanByImportId.get(priceExceptionTargetRow.id);
    const priceEvidence = getCorporateActionPriceValidationPresentation(scan);
    const theoretical = priceEvidence.theoreticalPrice;
    const openResidual = priceEvidence.openResidualPct;
    const closeResidual = priceEvidence.closeResidualPct;

    return (
      <div style={corporateResolveWorkspaceStyle} role="region" aria-label="Split or Bonus price validation review">
        <div style={corporateResolveDialogStyle}>
          <div style={corporateResolveHeaderStyle}>
            <div style={{ minWidth: 0 }}>
              <div style={officialImportSectionTitleStyle}>
                Price Review — {priceExceptionTargetRow.exchange}:{priceExceptionTargetRow.symbol ?? '-'}
              </div>
              <div style={utilityHelperTextStyle}>
                Official data remains authoritative. This review explains why local price behavior did not meet the normal MATCHED gate; genuine ex-date movement is never adjusted away.
              </div>
            </div>
            <button type="button" style={modalButtonStyle} onClick={clearPriceExceptionReview} disabled={busy}>
              Close
            </button>
          </div>
          <div style={corporateEvidenceSummaryStyle}>
            <span><strong>{priceExceptionTargetRow.actionType}</strong> — {formatCorporateActionDescription(priceExceptionTargetRow)}</span>
            <span>Share × {priceExceptionTargetRow.factor?.toFixed(6) ?? '-'} | Price × {getPriceMultiplier(priceExceptionTargetRow.factor)?.toFixed(6) ?? '-'}</span>
            {priceEvidence.summary ? (
              <span style={corporateIssueHintTextStyle}>Validation context: {priceEvidence.summary}</span>
            ) : null}
            <span>Previous close {formatCorporatePrice(scan?.prevClose)} → theoretical {formatCorporatePrice(theoretical)}</span>
            <span>Ex-date open {formatCorporatePrice(scan?.exOpen)} ({formatCorporatePercent(openResidual)}) | close {formatCorporatePrice(scan?.exClose)} ({formatCorporatePercent(closeResidual)})</span>
            <span>Validation: {classifyCorporateActionValidation(priceExceptionTargetRow, scan)} | Confidence: {formatCorporateConfidence(scan?.confidence)}</span>
            {scan?.message ? <span style={utilityHelperTextStyle}>{scan.message}</span> : null}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={utilityFieldLabelStyle}>Exception Reason</span>
            <textarea
              value={priceExceptionReason}
              onChange={(event) => setPriceExceptionReason(event.target.value)}
              style={{ ...utilityInputStyle, height: 84, minHeight: 84, padding: 8, resize: 'vertical' }}
              maxLength={1000}
              placeholder="Explain why official Split/Bonus evidence should be approved despite unusual or unavailable local price confirmation."
            />
            <span style={utilityHelperTextStyle}>Required and stored in the Corporate Action decision audit trail (10-1000 characters).</span>
          </label>
          <div style={corporateResolveActionsStyle}>
            <button type="button" style={modalButtonStyle} onClick={clearPriceExceptionReview} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => void approveOfficialImportWithPriceValidationException()}
              disabled={busy || priceExceptionReason.trim().length < 10}
            >
              Approve with Exception
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderManualTab = () => (
    <div style={utilityDialogLayoutStyle}>
      <div style={utilityFormColumnStyle}>
        <div style={utilityFormGridStyle}>
          <div style={utilityFieldLabelStyle}>Action:</div>
          <select
            value={actionType}
            onChange={(event) => setActionType(event.target.value as CorporateActionInput['actionType'])}
            style={utilityInputStyle}
          >
            <option value="SPLIT">Split</option>
            <option value="BONUS">Bonus</option>
            <option value="DIVIDEND">Dividend</option>
            <option value="RIGHTS">Rights Issue</option>
            <option value="NAME_CHANGE">Name Change</option>
            <option value="SYMBOL_CHANGE">Symbol Change</option>
            <option value="BOTH">Symbol + Name Change</option>
          </select>
          <div style={utilityFieldLabelStyle}>Current:</div>
          <div style={utilityInlineValueRowStyle}>
            <input value={currentSymbol} onChange={(event) => setCurrentSymbol(event.target.value)} style={utilityInputStyle} />
            <input value={exchange} onChange={(event) => setExchange(event.target.value)} style={utilityExchangeInputStyle} />
          </div>
          <div style={utilityFieldLabelStyle}>Date:</div>
          <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} style={utilityInputStyle} />
          <div style={utilityFieldLabelStyle}>Record:</div>
          <input type="date" value={recordDate} onChange={(event) => setRecordDate(event.target.value)} style={utilityInputStyle} />
          <div style={utilityFieldLabelStyle}>ISIN:</div>
          <input value={isin} onChange={(event) => setIsin(event.target.value)} style={utilityInputStyle} placeholder="Optional" />

          {isPriceAdjustmentAction ? (
            <>
              {actionType !== 'DIVIDEND' ? (
                <>
                  <div style={utilityFieldLabelStyle}>Ratio:</div>
                  <input
                    value={ratioText}
                    onChange={(event) => setRatioText(event.target.value)}
                    style={utilityInputStyle}
                    placeholder={actionType === 'SPLIT' ? '2:1' : actionType === 'RIGHTS' ? '1:9' : '1:1'}
                  />
                </>
              ) : null}
              {actionType === 'SPLIT' ? (
                <>
                  <div style={utilityFieldLabelStyle}>Old FV:</div>
                  <input
                    type="number"
                    step="0.01"
                    value={oldFaceValue}
                    onChange={(event) => setOldFaceValue(event.target.value)}
                    style={utilityInputStyle}
                    placeholder="Optional"
                  />
                  <div style={utilityFieldLabelStyle}>New FV:</div>
                  <input
                    type="number"
                    step="0.01"
                    value={newFaceValue}
                    onChange={(event) => setNewFaceValue(event.target.value)}
                    style={utilityInputStyle}
                    placeholder="Optional"
                  />
                </>
              ) : null}
              {needsCashAmount ? (
                <>
                  <div style={utilityFieldLabelStyle}>{actionType === 'DIVIDEND' ? 'Amount:' : 'Issue Price:'}</div>
                  <input
                    type="number"
                    step="0.01"
                    value={cashAmountText}
                    onChange={(event) => setCashAmountText(event.target.value)}
                    style={utilityInputStyle}
                    placeholder={actionType === 'DIVIDEND' ? 'Per share amount' : 'Rights issue price'}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              {(actionType === 'SYMBOL_CHANGE' || actionType === 'BOTH') ? (
                <>
                  <div style={utilityFieldLabelStyle}>Old Symbol:</div>
                  <input value={oldSymbol} onChange={(event) => setOldSymbol(event.target.value)} style={utilityInputStyle} placeholder="Previous ticker" />
                  <div style={utilityFieldLabelStyle}>New Symbol:</div>
                  <input value={newSymbol} onChange={(event) => setNewSymbol(event.target.value)} style={utilityInputStyle} placeholder="Current ticker" />
                </>
              ) : null}
              {(actionType === 'NAME_CHANGE' || actionType === 'BOTH') ? (
                <>
                  <div style={utilityFieldLabelStyle}>Old Name:</div>
                  <input value={oldName} onChange={(event) => setOldName(event.target.value)} style={utilityInputStyle} placeholder="Previous company name" />
                  <div style={utilityFieldLabelStyle}>New Name:</div>
                  <input value={newName} onChange={(event) => setNewName(event.target.value)} style={utilityInputStyle} placeholder="Current company name" />
                </>
              ) : null}
              <div style={utilityFieldLabelStyle}>Current Name:</div>
              <input value={currentName} onChange={(event) => setCurrentName(event.target.value)} style={utilityInputStyle} placeholder="Optional" />
            </>
          )}

          <div style={utilityFieldLabelStyle}>Note:</div>
          <input value={note} onChange={(event) => setNote(event.target.value)} style={utilityInputStyle} placeholder="Optional" />
        </div>
        {isPriceAdjustmentAction ? (
          <>
            <div style={utilityHelperTextStyle}>
              {actionType === 'DIVIDEND'
                ? 'Dividend amount is per share. The adjustment factor is derived from the local previous close when you save.'
                : actionType === 'RIGHTS'
                  ? 'Rights ratio is new:old, and issue price is the subscription price per share. TERP is derived from the local previous close when you save.'
                  : 'Ratio format is new:old. Example: 2:1 split or 1:1 bonus. Face values can be entered for split history.'}
            </div>
            {isAdjustmentAction ? (
              <label style={utilityCheckboxRowStyle}>
                <input type="checkbox" checked={adjustVolume} onChange={(event) => setAdjustVolume(event.target.checked)} />
                <span>Adjust volume and delivery quantity too</span>
              </label>
            ) : null}
          </>
        ) : (
          <div style={utilityHelperTextStyle}>
            Identity history preserves old symbols and names for search, watchlists, and automatic chart continuity.
          </div>
        )}
        <div style={utilityStatusStyle}>
          {status ||
            (isPriceAdjustmentAction
              ? actionType === 'DIVIDEND'
                ? 'Enter the dividend amount per share. Raw EOD prices stay untouched; adjustment is applied on read only when dividend adjustments are enabled.'
                : actionType === 'RIGHTS'
                  ? 'Enter the rights ratio and issue price. Raw EOD prices stay untouched; TERP adjustment is applied on read only when rights adjustments are enabled.'
                  : factorPreview === null
                    ? 'Enter a valid ratio or face value change. Raw EOD prices stay untouched; adjustment is applied on read.'
                    : `Adjustment factor ${factorPreview.toFixed(6)}. Historical rows before the selected date will be adjusted on chart load.`
              : 'Save name/symbol history so old identities resolve to the current instrument everywhere.')}
        </div>
      </div>
      <div style={utilityButtonStackStyle}>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => void applyAdjustment()}
          disabled={busy || !hasDatabase || (!currentSymbol.trim() && !newSymbol.trim()) || (isAdjustmentAction && factorPreview === null)}
        >
          OK
        </button>
        <button type="button" style={modalButtonStyle} onClick={handleClose}>
          Cancel
        </button>
      </div>
    </div>
  );

  const exportIdentityRecoveryDocument = async (document: IdentityRecoveryDocument) => {
    if (!api) {
      setIdentityRecoveryExportStatus('Desktop export is unavailable in this runtime.');
      return;
    }

    setIdentityRecoveryExportingFileName(document.suggestedFileName);
    setIdentityRecoveryExportStatus(`Preparing ${document.label.toLowerCase()}...`);

    try {
      const content =
        document.key === 'source-recovery' && officialSourceHealthReport
          ? `${document.content.trimEnd()}\n\n${formatOfficialSourceHealthMarkdown(officialSourceHealthReport)}\n`
          : document.content;
      const result = await api.saveTextExport({
        title: document.dialogTitle,
        suggestedFileName: document.suggestedFileName,
        content,
        defaultExtension: 'md',
        filterName: 'Markdown Files',
        filterExtensions: ['md', 'txt'],
      });

      if (!result.success || !result.filePath) {
        setIdentityRecoveryExportStatus('Save cancelled. No recovery document was written.');
        return;
      }

      setIdentityRecoveryExportStatus(`Saved: ${result.filePath}`);
    } catch (error) {
      setIdentityRecoveryExportStatus(
        getErrorMessage(error, `Could not export ${document.label.replace('Export ', '').toLowerCase()}.`),
      );
    } finally {
      setIdentityRecoveryExportingFileName(null);
    }
  };

  const renderOfficialSourceUrlDialog = () => {
    if (!officialSourceUrlsOpen) {
      return null;
    }

    const nseFields: Array<{ key: keyof OfficialSourceUrls; label: string }> = [
      { key: 'nseSecuritiesAvailablePageUrl', label: 'Securities page' },
      { key: 'nseEquityMasterUrl', label: 'Equity master CSV' },
      { key: 'nseSmeMasterUrl', label: 'SME master CSV' },
      { key: 'nseSymbolChangeUrl', label: 'Symbol change CSV' },
      { key: 'nseCompanyNameChangeUrl', label: 'Company name change CSV' },
      { key: 'nseDelistedPageUrl', label: 'De-listed page' },
      { key: 'nseDelistedWorkbookUrl', label: 'De-listed workbook fallback' },
    ];
    const bseFields: Array<{ key: keyof OfficialSourceUrls; label: string }> = [
      { key: 'bseListScripsUrlPrefix', label: 'List of scrips URL prefix' },
      { key: 'bseListScripsReferer', label: 'List of scrips referer' },
    ];
    const fields = officialSourceUrlExchange === 'NSE' ? nseFields : bseFields;

    return (
      <div style={sourceUrlOverlayStyle} role="dialog" aria-modal="true" aria-label="Official source URLs">
        <div style={sourceUrlDialogStyle}>
          <div style={sourceUrlHeaderStyle}>
            <strong>Official Source URLs</strong>
            <button
              type="button"
              style={sourceUrlCloseButtonStyle}
              onClick={() => setOfficialSourceUrlsOpen(false)}
              aria-label="Close official source URLs"
            >
              x
            </button>
          </div>
          <div style={sourceUrlExchangeTabsStyle}>
            {(['NSE', 'BSE'] as OfficialSourceUrlExchange[]).map((value) => (
              <button
                key={value}
                type="button"
                style={officialSourceUrlExchange === value ? primaryButtonStyle : modalButtonStyle}
                onClick={() => setOfficialSourceUrlExchange(value)}
              >
                {value}
              </button>
            ))}
          </div>
          <div style={sourceUrlFieldsStyle}>
            {fields.map((field) => (
              <label key={field.key} style={sourceUrlFieldStyle}>
                <span style={sourceUrlLabelStyle}>{field.label}</span>
                <input
                  value={officialSourceUrlDraft[field.key]}
                  onChange={(event) => updateOfficialSourceUrl(field.key, event.target.value)}
                  style={sourceUrlInputStyle}
                />
              </label>
            ))}
          </div>
          {officialSourceUrlStatus ? <div style={sourceUrlStatusStyle}>{officialSourceUrlStatus}</div> : null}
          <div style={sourceUrlActionsStyle}>
            <button type="button" style={modalButtonStyle} onClick={resetOfficialSourceUrls} disabled={busy}>
              Reset Defaults
            </button>
            <button type="button" style={primaryButtonStyle} onClick={() => void saveOfficialSourceUrls()} disabled={busy || !hasDatabase}>
              Apply URLs
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderIdentityInfoDialog = () => {
    if (!identityInfoOpen) {
      return null;
    }

    return (
      <div style={sourceUrlOverlayStyle} role="dialog" aria-modal="true" aria-label="Identity import information">
        <div style={identityInfoDialogStyle}>
          <div style={sourceUrlHeaderStyle}>
            <strong>Identity Import Info</strong>
            <button
              type="button"
              style={sourceUrlCloseButtonStyle}
              onClick={() => setIdentityInfoOpen(false)}
              aria-label="Close identity import information"
            >
              x
            </button>
          </div>
          <div style={identityInfoContentStyle}>
            <section style={identityInfoSectionStyle}>
              <h3 style={identityInfoSectionTitleStyle}>NSE</h3>
              <ul style={identityInfoListStyle}>
                <li>`Refresh & Preview` downloads the current master bundle (equity, SME, and symbol-change data) plus the de-listed workbook into this database's managed `reference-data` folder.</li>
                <li>Official `Preview Changes` and `Apply Reviewed Changes` use those database-managed NSE sources and do not require an Archive Root.</li>
                <li>Manual NSE Archive Root layout: `NSE\Identity\SecuritiesAvailable`, `SymbolChanges`, and `CompanyNameChanges`.</li>
                <li>`Preview Historical Identity` reviews historical NSE symbol/name chains plus current-master/current-universe effects. `Apply Reviewed Historical Identity` commits that reviewed plan atomically or rolls it back.</li>
                <li>The URL button lets you review or override official NSE/BSE source URLs without rebuilding the app.</li>
                <li>Raw prices stay untouched.</li>
              </ul>
            </section>
            <section style={identityInfoSectionStyle}>
              <h3 style={identityInfoSectionTitleStyle}>BSE</h3>
              <ul style={identityInfoListStyle}>
                <li>`Refresh & Preview` downloads Active, De-listed, and Suspended BSE lifecycle data and combines it into the database-managed BSE master CSV.</li>
                <li>Manual `BSE Master CSV` files are also supported when they contain Security Id/Scrip Id, Security Code, Security Name, Group, ISIN, and optional Status.</li>
                <li>BSE sync updates only `instruments` active/metadata flags. Historical quote files are not changed.</li>
              </ul>
            </section>
            <section style={identityInfoSectionStyle}>
              <h3 style={identityInfoSectionTitleStyle}>Recovery &amp; AI Handoff</h3>
              <div style={identityRecoveryActionPanelStyle}>
                <div style={utilityHelperTextStyle}>
                  Export provider-neutral Markdown for an external AI or human researcher. Exporting does not read the database, browse the web, change source URLs, or Apply Identity changes.
                </div>
                <div style={identityRecoveryActionsStyle}>
                  {IDENTITY_RECOVERY_DOCUMENTS.map((document) => (
                    <button
                      key={document.key}
                      type="button"
                      style={modalButtonStyle}
                      onClick={() => void exportIdentityRecoveryDocument(document)}
                      disabled={busy || identityRecoveryExportingFileName !== null}
                      title={document.description}
                    >
                      {identityRecoveryExportingFileName === document.suggestedFileName
                        ? 'Saving...'
                        : document.label}
                    </button>
                  ))}
                </div>
                {identityRecoveryExportStatus ? (
                  <div style={identityRecoveryExportStatusStyle}>{identityRecoveryExportStatus}</div>
                ) : null}
              </div>
            </section>
          </div>
          <div style={identityInfoFooterStyle}>
            <button type="button" style={primaryButtonStyle} onClick={() => setIdentityInfoOpen(false)}>
              OK
            </button>
          </div>
        </div>
      </div>
    );
  };

  const identitySelectedSourceReady =
    identityExchange === 'NSE'
      ? identitySourceMode === 'official' || Boolean(identityArchiveRoot.trim())
      : Boolean(bseMasterFilePath.trim());
  const requestedNseArchiveRoot =
    identitySourceMode === 'manual' ? identityArchiveRoot.trim() : null;
  const nseReviewedApplyReady = Boolean(
    currentUniverseSyncResult &&
      identityHasActionableChanges(currentUniverseSyncResult) &&
      nseReviewedApplyAuthority &&
      activeDatabasePath &&
      nseReviewedApplyAuthority.planSha256 === currentUniverseSyncResult.planSha256 &&
      nseReviewedApplyAuthority.activeDatabasePath === activeDatabasePath &&
      nseReviewedApplyAuthority.sourceMode === identitySourceMode &&
      nseReviewedApplyAuthority.requestedArchiveRootPath === requestedNseArchiveRoot,
  );
  const identitySelectedApplyReady =
    identityExchange === 'NSE' ? nseReviewedApplyReady : Boolean(
      identityHasActionableChanges(bseCurrentUniverseSyncResult) && bseReviewedApplyAuthority && activeDatabasePath &&
      bseReviewedApplyAuthority.databasePath === activeDatabasePath && bseReviewedApplyAuthority.sourceMode === identitySourceMode &&
      bseReviewedApplyAuthority.masterFilePath === bseMasterFilePath.trim() && bseReviewedApplyAuthority.planSha256 === bseCurrentUniverseSyncResult?.planSha256);
  const historicalCommitConfirmed = Boolean(nseHistoricalIdentityResult?.applied || historicalApplyProgress?.stage === 'committed' || historicalApplyProgress?.stage === 'refreshing');
  const nseHistoricalReviewedApplyReady = Boolean(
    identityExchange === 'NSE' &&
      nseHistoricalIdentityResult &&
      nseHistoricalIdentityResult.canApply &&
      !nseHistoricalIdentityResult.applied && historicalChangeCount(nseHistoricalIdentityResult) > 0 &&
      nseHistoricalReviewedApplyAuthority &&
      activeDatabasePath &&
      nseHistoricalReviewedApplyAuthority.planSha256 === nseHistoricalIdentityResult.planSha256 &&
      nseHistoricalReviewedApplyAuthority.activeDatabasePath === activeDatabasePath &&
      nseHistoricalReviewedApplyAuthority.sourceMode === identitySourceMode &&
      nseHistoricalReviewedApplyAuthority.requestedArchiveRootPath === requestedNseArchiveRoot,
  );
  const nseHistoricalPreviewSummary: Array<{ label: string; value: number }> =
    nseHistoricalIdentityResult
      ? [
          { label: 'Symbol', value: nseHistoricalIdentityResult.newSymbolChanges },
          { label: 'Name', value: nseHistoricalIdentityResult.newNameChanges },
          { label: 'Combined', value: nseHistoricalIdentityResult.newCombinedChanges },
          { label: 'Duplicate', value: nseHistoricalIdentityResult.duplicateRows },
          { label: 'Skipped', value: nseHistoricalIdentityResult.skippedRows },
          { label: 'Error', value: nseHistoricalIdentityResult.errorRows },
          { label: 'Master', value: nseHistoricalIdentityResult.masterRowsPlanned },
          { label: 'Activate', value: nseHistoricalIdentityResult.activeSyncActivateCount },
          { label: 'Update', value: nseHistoricalIdentityResult.activeSyncUpdateCount },
          { label: 'Deactivate', value: nseHistoricalIdentityResult.activeSyncDeactivateCount },
        ]
      : [];
  const identitySelectedPreview =
    identityExchange === 'NSE' ? currentUniverseSyncResult : bseCurrentUniverseSyncResult;
  const identityPreviewSummary: Array<{ label: string; value: number }> = identitySelectedPreview
    ? [
        ...(currentUniverseSyncResult
          ? [{ label: 'New', value: currentUniverseSyncResult.newSymbols }]
          : []),
        { label: 'Activate', value: identitySelectedPreview.activateCount },
        { label: 'Update', value: identitySelectedPreview.updateCount },
        { label: 'Deactivate', value: identitySelectedPreview.deactivateCount },
        { label: 'Unchanged', value: identitySelectedPreview.unchangedActive },
        ...(identityExchange === 'NSE' ? [
          { label: 'Held for review', value: identitySelectedPreview.previewRows.filter(row => row.action === 'REVIEW_REQUIRED').length },
          { label: 'Outside coverage', value: identitySelectedPreview.previewRows.filter(row => row.action === 'OUTSIDE_COVERAGE').length },
        ] : []),
      ]
    : [];

  const renderNseHistoricalPreviewPanel = () =>
    nseHistoricalIdentityResult ? (
      <IdentityHistoricalPreview rows={filteredNseHistoricalIdentityRows}
        total={nseHistoricalIdentityResult.historyRows.length} busy={busy}
        currentEffects={nseHistoricalIdentityResult.currentUniversePreviewRows}
        preferences={identityPreferences} onPreferencesChange={updateIdentityPreferences}
        categoryEvidence={nseHistoricalIdentityResult.categoryEvidence} applied={historicalCommitConfirmed}
        emptyMessage={nseHistoricalIdentityFilter === 'errors' && nseHistoricalIdentityResult.errorRows === 0 ? 'No errors in this preview.' : undefined}
        summary={<div style={identitySummaryRowStyle} aria-label="Historical identity preview summary">
          {nseHistoricalPreviewSummary.map((item) => (
            <span key={item.label} style={identitySummaryBadgeStyle}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </span>
          ))}
        </div>}
        filters={<div style={identityHistoricalFilterRowStyle} aria-label="Historical identity filters">
          {([
            ['actionable', 'Actionable'],
            ['all', 'All'],
            ['duplicates', 'Duplicates'],
            ['skipped', 'Skipped'],
            ['errors', 'Errors'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              style={identitySegmentButtonStyle(nseHistoricalIdentityFilter === value)}
              aria-pressed={nseHistoricalIdentityFilter === value}
              onClick={() => setNseHistoricalIdentityFilter(value)}
              disabled={busy}
            >
              {label}
            </button>
          ))}
        </div>}
      />
    ) : null;

  const renderOfficialSourceHealthPanel = () => {
    const selectedCandidateAuthority = officialSourceCandidateResult
      ? officialSourceCandidateResult.authority.sources.find(
          (source) => source.sourceKey === officialSourceCandidateResult.sourceKey,
        ) ?? null
      : null;

    return (
      <div style={officialSourceHealthPanelStyle} aria-label="Latest official source health">
        <IdentitySourceHealth key={identityExchange} report={officialSourceHealthReport} exchange={identityExchange}
          busy={busy} canRecover={result => Boolean(getEr4RecoveryRequestForHealthResult(result))}
          onRecover={result => void findOfficialReplacementCandidates(result)} />
        {officialSourceHealthStatus ? <div role="status" style={identityStatusStyle}>{officialSourceHealthStatus}</div> : null}
        <details open={Boolean(officialSourceCandidateResult)}>
          <summary>Advanced source maintenance and version history</summary>
          <IdentitySourceHistory key={`${activeDatabasePath}-${identityExchange}`}
            authority={officialSourceAuthority} exchange={identityExchange} busy={busy} hasDatabase={hasDatabase}
            configurationError={officialSourceUrlStatus} onReloadSources={() => void loadOfficialSourceUrls()}
            loadHistory={sourceKey => {
              if (!api || !hasDatabase) return Promise.reject(new Error('Open a database before loading source history.'));
              return api.listOfficialSourceHistory({ sourceKey });
            }} />
          {!officialSourceCandidateResult ? <p className="identity-review-note">
            No replacement review is loaded. For an eligible source, open its Details in Source Health to find official replacement candidates.
          </p> : null}
        {officialSourceCandidateStatus ? (
          <div style={identityStatusStyle}>{officialSourceCandidateStatus}</div>
        ) : null}
        {officialSourceCandidateResult ? (
          <div style={officialSourceHealthPanelStyle} aria-label="Official replacement candidate review">
            <div style={officialSourceHealthHeaderStyle}>
              <strong>Official replacement candidate review</strong>
              <span style={officialSourceHealthSummaryStyle}>
                {officialSourceCandidateResult.sourceKey}
              </span>
            </div>
            {selectedCandidateAuthority ? (
              <div style={officialSourceHealthEvidenceDetailsBodyStyle}>
                <span>Current URL: {selectedCandidateAuthority.currentUrl}</span>
                <span>
                  Current version: {selectedCandidateAuthority.currentVersionId} · revision {selectedCandidateAuthority.revision}
                </span>
              </div>
            ) : null}
            <div style={officialSourceHealthEvidenceDetailsBodyStyle}>
              <span>Classification labels: {ER4_CANDIDATE_CLASSIFICATION_LABELS.join(' · ')}</span>
              <span>Validated means technically validated, not operator-approved.</span>
            </div>
            {officialSourceCandidateResult.candidates.length === 0 ? (
              <div style={corporateEmptyStateStyle}>No replacement candidate passed discovery into review.</div>
            ) : (
              officialSourceCandidateResult.candidates.map((candidate) => (
                <div key={candidate.reviewFingerprint} style={officialSourceHealthPanelStyle}>
                  <div style={officialSourceHealthHeaderStyle}>
                    <strong>{candidate.classification}</strong>
                    <span style={officialSourceHealthSummaryStyle}>{candidate.candidateUrl}</span>
                  </div>
                  <div style={officialSourceHealthEvidenceDetailsBodyStyle}>
                    <span>Final URL: {candidate.candidateFinalUrl ?? '-'}</span>
                    <span>Discovery: {candidate.discoveryReason}</span>
                    <span>HTTP: {candidate.httpStatus ?? '-'}</span>
                    <span>Content type: {candidate.contentType ?? '-'}</span>
                    <span>Bytes: {candidate.responseBytes ?? '-'}</span>
                    <span title={candidate.candidateContentSha256 ?? undefined}>
                      SHA-256: {candidate.candidateContentSha256 ?? '-'}
                    </span>
                    <span>Parser: {candidate.parserStatus}</span>
                    <span>Schema: {candidate.schemaStatus}</span>
                    <span>
                      Population: {candidate.populationStatus}
                      {candidate.populationCount == null ? '' : ` · ${candidate.populationCount}`}
                    </span>
                    <span>Freshness: {candidate.freshnessStatus}</span>
                    <span>Validation: {candidate.validationReason}</span>
                  </div>
                  <label style={sourceUrlFieldStyle}>
                    <span style={sourceUrlLabelStyle}>Rejection note</span>
                    <input
                      value={officialSourceRejectNotes[candidate.reviewFingerprint] ?? ''}
                      onChange={(event) =>
                        setOfficialSourceRejectNotes((current) => ({
                          ...current,
                          [candidate.reviewFingerprint]: event.target.value,
                        }))
                      }
                      style={sourceUrlInputStyle}
                      placeholder="Required only when rejecting"
                    />
                  </label>
                  <div style={sourceUrlActionsStyle}>
                    <button
                      type="button"
                      style={identitySecondaryButtonStyle}
                      onClick={() => void recordOfficialSourceCandidateDecision(candidate, 'KEEP_CURRENT')}
                      disabled={busy}
                    >
                      Keep Current URL
                    </button>
                    <button
                      type="button"
                      style={identitySecondaryButtonStyle}
                      onClick={() => void recordOfficialSourceCandidateDecision(candidate, 'REJECT_CANDIDATE')}
                      disabled={
                        busy ||
                        !(officialSourceRejectNotes[candidate.reviewFingerprint] ?? '').trim()
                      }
                    >
                      Reject Candidate
                    </button>
                    {candidate.promotable &&
                    candidate.classification === 'VALIDATED_CANDIDATE_NOT_PROMOTED' ? (
                      <button
                        type="button"
                        style={identityPrimaryButtonStyle}
                        onClick={() => void promoteOfficialSourceCandidate(candidate)}
                        disabled={busy}
                        title="Explicit reviewed promotion only; no Identity Apply is executed"
                      >
                        Approve Replacement
                      </button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
            <div style={officialSourceHealthHeaderStyle}>
              <strong>Source version / review history</strong>
              <span style={officialSourceHealthSummaryStyle}>{officialSourceHistory.length} entries</span>
            </div>
            {officialSourceHistory.length === 0 ? (
              <div style={corporateEmptyStateStyle}>No source history entries loaded.</div>
            ) : (
              <div style={officialSourceHealthEvidenceDetailsBodyStyle}>
                {officialSourceHistory.map((entry, index) => {
                  const canReviewRollback =
                    entry.entryKind === 'VERSION' &&
                    !entry.active &&
                    selectedCandidateAuthority?.exchange === 'NSE' &&
                    selectedCandidateAuthority.candidatePromotionEligible;
                  const canRetryHealth =
                    entry.entryKind === 'REVIEW' &&
                    entry.resultVersionId != null &&
                    (entry.postHealthStatus === 'POST_HEALTH_PENDING' ||
                      entry.postHealthStatus === 'PROMOTED_HEALTH_CHECK_FAILED' ||
                      entry.postHealthStatus === 'ROLLBACK_HEALTH_CHECK_FAILED');
                  return (
                    <div
                      key={`${entry.entryKind}-${entry.versionId}-${entry.createdAt}-${index}`}
                      style={officialSourceHealthPanelStyle}
                    >
                      <div style={officialSourceHealthEvidenceDetailsBodyStyle}>
                        <span>
                          {entry.createdAt} · {entry.entryKind} · version {entry.versionId} · revision {entry.revision} · {entry.changeKind}
                          {entry.active ? ' · ACTIVE' : ''}
                        </span>
                        <span>URL: {entry.url}</span>
                        <span>Parent version: {entry.parentVersionId ?? '-'}</span>
                        <span title={entry.candidateContentSha256 ?? undefined}>
                          Candidate SHA-256: {entry.candidateContentSha256 ?? '-'}
                        </span>
                        {entry.reviewDecision ? <span>Review decision: {entry.reviewDecision}</span> : null}
                        {entry.reviewResultStatus ? <span>Review result: {entry.reviewResultStatus}</span> : null}
                        {entry.postHealthStatus ? <span>Post-health: {entry.postHealthStatus}</span> : null}
                        {entry.operatorNote ? <span>Operator note: {entry.operatorNote}</span> : null}
                      </div>
                      {canReviewRollback || canRetryHealth ? (
                        <div style={sourceUrlActionsStyle}>
                          {canReviewRollback ? (
                            <button
                              type="button"
                              style={identitySecondaryButtonStyle}
                              onClick={() => void reviewOfficialSourceRollback(entry)}
                              disabled={busy}
                            >
                              Review Rollback
                            </button>
                          ) : null}
                          {canRetryHealth ? (
                            <button
                              type="button"
                              style={identitySecondaryButtonStyle}
                              onClick={() => void retryOfficialSourcePostHealth(entry)}
                              disabled={busy}
                            >
                              Retry Health Check
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
            {officialSourceRollbackReview ? (
              <div style={officialSourceHealthPanelStyle} aria-label="Reviewed source rollback">
                <div style={officialSourceHealthHeaderStyle}>
                  <strong>Reviewed rollback</strong>
                  <span style={officialSourceHealthSummaryStyle}>
                    {officialSourceRollbackReview.sourceKey}
                  </span>
                </div>
                <div style={officialSourceHealthEvidenceDetailsBodyStyle}>
                  <span>
                    Current: version {officialSourceRollbackReview.currentVersionId} · revision {officialSourceRollbackReview.currentRevision}
                  </span>
                  <span>Current URL: {officialSourceRollbackReview.currentUrl}</span>
                  <span>Target version: {officialSourceRollbackReview.targetVersionId}</span>
                  <span>Target URL: {officialSourceRollbackReview.targetUrl}</span>
                  <span title={officialSourceRollbackReview.targetValidationSha256}>
                    Target validation SHA-256: {officialSourceRollbackReview.targetValidationSha256}
                  </span>
                </div>
                <div style={sourceUrlActionsStyle}>
                  <button
                    type="button"
                    style={identityPrimaryButtonStyle}
                    onClick={() => void applyOfficialSourceRollback()}
                    disabled={busy}
                  >
                    Apply Reviewed Rollback
                  </button>
                </div>
              </div>
            ) : null}
            {officialSourceRollbackStatus ? (
              <div style={identityStatusStyle}>{officialSourceRollbackStatus}</div>
            ) : null}
          </div>
        ) : null}
        </details>
      </div>
    );
  };

    const health = identityHealthSummary(officialSourceHealthReport, identityExchange);
    const previewCount = identitySelectedPreview?.previewRows.length ?? 0;
    const applyDisabled = busy || !hasDatabase || !identitySelectedApplyReady;
    const nothingToApply = !busy && hasDatabase && identitySelectedPreview != null &&
      !identitySelectedPreview.applied && !identityHasActionableChanges(identitySelectedPreview);
    const historicalDisabled = busy || !hasDatabase || !nseHistoricalReviewedApplyReady;
  const renderIdentityTab = () => (<>
      {renderOfficialSourceUrlDialog()}
      {renderIdentityInfoDialog()}
      <IdentityImportWorkspace key={`${activeDatabasePath}-${identityExchange}-${identitySourceMode}`}
        databasePath={activeDatabasePath} busy={busy} status={status}
        preferences={identityPreferences} onPreferencesChange={updateIdentityPreferences} settingsWarning={identitySettingsWarning}
        header={<>        <div style={identityControlHeaderStyle}>
          <div style={identitySelectorRowStyle}>
            <span style={identityCompactLabelStyle}>Exchange</span>
            <div style={identitySegmentStyle}>
              {(['NSE', 'BSE'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  style={identitySegmentButtonStyle(identityExchange === value)}
                  onClick={() => selectIdentityExchange(value)}
                  disabled={busy}
                >
                  {value}
                </button>
              ))}
            </div>
            <span style={identityCompactLabelStyle}>Source</span>
            <div style={identitySegmentStyle}>
              {(['official', 'manual'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  style={identitySegmentButtonStyle(identitySourceMode === value)}
                  onClick={() => selectIdentitySourceMode(value)}
                  disabled={busy}
                >
                  {value === 'official' ? 'Official' : 'Manual'}
                </button>
              ))}
            </div>
          </div>

          <div style={identityTopToolsStyle}>
            <button
              type="button"
              style={sourceUrlIconButtonStyle}
              onClick={() => {
                setOfficialSourceUrlStatus('');
                setOfficialSourceUrlsOpen(true);
              }}
              title="Official source URLs"
              aria-label="Official source URLs"
            >
              <span style={linkIconStyle} aria-hidden="true">
                <span style={linkIconOvalStyle('left')} />
                <span style={linkIconOvalStyle('right')} />
              </span>
            </button>
            <button
              type="button"
              style={infoIconButtonStyle}
              onClick={() => setIdentityInfoOpen(true)}
              title="Identity import information"
              aria-label="Identity import information"
            >
              ?
            </button>
          </div>
        </div>

</>}
        sourceControls={identitySourceMode === 'manual' ? identityExchange === 'NSE' ? (
            <div style={identityManualSourceRowStyle}>
              <span style={identityCompactLabelStyle}>NSE Archive Root</span>
              <input
                value={identityArchiveRoot}
                onChange={(event) => {
                  setIdentityArchiveRoot(event.target.value);
                  setNseReviewedApplyAuthority(null);
                  setNseHistoricalReviewedApplyAuthority(null);
                  setNseHistoricalIdentityResult(null);
                  setCurrentUniverseSyncResult(null);
                }}
                style={identityCompactInputStyle}
                placeholder="Select NSE archive root"
              />
              <button
                type="button"
                style={identityButtonStyle}
                onClick={() => void browseNseIdentityArchiveRoot()}
                disabled={busy}
              >
                Browse Folder
              </button>
            </div>
        ) : (
          <div style={identityManualSourceRowStyle}>
            <span style={identityCompactLabelStyle}>BSE Master CSV</span>
            <input
              value={bseManualMasterFilePath}
              onChange={(event) => {
                setBseReviewedApplyAuthority(null);
                setBseManualMasterFilePath(event.target.value);
                setBseMasterFilePath(event.target.value);
                setBseCurrentUniverseSyncResult(null);
              }}
              style={identityCompactInputStyle}
              placeholder="C:\path\to\BSE master.csv"
            />
            <button
              type="button"
              style={identityButtonStyle}
              onClick={() => void browseBseMasterFile()}
              disabled={busy}
            >
              Browse File
            </button>
          </div>
        ) : null}
        summary={<div>
          <span><strong>{identityExchange} · {identitySourceMode === 'official' ? 'Official sources' : 'Manual archive'}</strong></span>
          <span>{health.checked ? `${health.results.length} sources checked · ${health.attention} need attention` : 'Source health not checked'}</span>
          {officialSourceHealthReport ? <span>Last check: {new Date(officialSourceHealthReport.assessedAtUtc).toLocaleString()}</span> : null}
          <span>{identitySelectedPreview ? 'Saved sources read by current preview.' : 'Saved-source availability: not checked by preview.'}</span>
        </div>}
        currentToolbar={<>
          {identitySourceMode === 'official' ? <button type="button" onClick={() => void refreshAndPreviewSelectedOfficialIdentitySource()}
            disabled={busy || !hasDatabase}>Refresh &amp; Preview</button> : null}
          <button type="button" onClick={() => void previewSelectedIdentitySource()}
            disabled={busy || !hasDatabase || !identitySelectedSourceReady}>
            {identitySourceMode === 'official' ? 'Preview Saved Sources' : 'Preview Changes'}
          </button>
        </>}
        current={<>
          <IdentityApplyStatus progress={identityApplyProgress} result={identitySelectedPreview}
            error={identityApplyError} refreshWarning={identityRefreshWarning} />
        {identityPreviewSummary.length > 0 && !identitySelectedPreview?.applied ? (
          <div style={identitySummaryRowStyle} aria-label="Identity preview summary">
            {identityPreviewSummary.map((item) => (
              <span key={item.label} style={identitySummaryBadgeStyle}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>
        ) : null}


          <IdentityPreviewTable rows={filteredIdentityPreviewRows} loaded={identitySelectedPreview != null}
            total={previewCount} busy={busy} sourceMode={identitySourceMode} applied={identitySelectedPreview?.applied}
            toolbar={renderSearchBar(
              'Find',
              identitySearchQuery,
              setIdentitySearchQuery,
              () =>
                applyCurrentSymbolFilter(
                  setIdentitySearchQuery,
                  currentUniverseSyncResult
                    ? 'NSE'
                    : bseCurrentUniverseSyncResult
                      ? 'BSE'
                      : activeInstrument?.exchange ?? null,
                ),
              'Filter preview rows by symbol, company, or ISIN',
              'Current Chart',
            )} />
        </>}
        currentFooter={<>
          <div><strong>{nothingToApply ? 'Up to date — nothing to apply.' : identityPreviewState(identitySelectedPreview != null, previewCount, filteredIdentityPreviewRows.length, busy, identitySelectedPreview?.applied)}</strong>
            <span className="identity-review-note">{identitySelectedPreview?.applied ? 'Changes saved. Create a new preview before applying again.' : nothingToApply ? 'Held and outside-coverage records remain unchanged and available for review.' : applyDisabled ? 'Preview and review the current source before applying.' : 'Reviewed preview available. Apply requires confirmation.'}</span></div>
          <button type="button" style={identityPrimaryButtonStyle} onClick={() => void applySelectedIdentitySource()}
            disabled={busy || !hasDatabase || !identitySelectedApplyReady} title={nothingToApply ? 'No actionable changes in this preview.' : applyDisabled ? 'A valid reviewed preview and active database are required.' : 'Apply the reviewed current-universe plan'}>
            Apply Reviewed Changes
          </button>
        </>}
        historical={identityExchange === 'NSE' ? <>
          <HistoricalApplyStatus progress={historicalApplyProgress} result={nseHistoricalIdentityResult} error={historicalApplyError} refreshWarning={historicalRefreshWarning} />
          {nseHistoricalIdentityResult ? renderNseHistoricalPreviewPanel() : <p>Not previewed. Preview saved historical symbol and company-name changes to review the dated identity plan.</p>}
        </> : bseNames.panel}
        historicalSourceControls={identityExchange === 'BSE' ? bseNames.controls : undefined}
        historicalSummary={identityExchange === 'BSE' ? bseNames.sourceSummary : undefined}
        recent={api ? <div className="identity-recent-history">
          <IdentityApplyHistory key={`${activeDatabasePath}-${identityExchange}-current-history`} exchange={identityExchange}
            load={() => identityExchange === 'NSE' ? api.listNseIdentityApplyHistory() : api.listBseIdentityApplyHistory()}
            latest={identitySelectedPreview?.applied ? identitySelectedPreview : null} />
          {identityExchange === 'NSE' ? <HistoricalApplyHistory key={`${activeDatabasePath}-${nseHistoricalIdentityResult?.runId ?? ''}`}
          preferenceKey={activeDatabasePath ? `${identityDisplayKey(activeDatabasePath, identityExchange, identitySourceMode)}:reports` : null}
          load={() => api.listNseHistoricalIdentityApplyHistory()} loadReport={runId => api.getNseHistoricalIdentityApplyReport(runId)} latest={nseHistoricalIdentityResult?.applied ? nseHistoricalIdentityResult : null} /> : <BseNameHistoryReports key={`${activeDatabasePath}-bse-names`} api={api} latest={bseNames.latest}
            preferenceKey={activeDatabasePath ? `${identityDisplayKey(activeDatabasePath,'BSE',identitySourceMode)}:name-reports` : null} />}
        </div> : undefined}
        historicalToolbar={identityExchange === 'NSE' ? <>
          {identitySourceMode === 'official' ? <button type="button" disabled={busy || !hasDatabase}
            onClick={() => void refreshNseIdentitySources()}>Refresh NSE Sources</button> : null}
          <button type="button" onClick={() => void previewNseHistoricalIdentityArchive()}
            disabled={busy || !hasDatabase || (identitySourceMode === 'manual' && !identityArchiveRoot.trim())}>Preview Historical Identity</button>
        </> : bseNames.toolbar}
        historicalFooter={identityExchange === 'NSE' ? <>
          <div><strong>{historicalCommitConfirmed ? 'Completed — historical identity saved' : nseHistoricalIdentityResult && historicalChangeCount(nseHistoricalIdentityResult) === 0 ? 'Up to date — nothing to apply' : nseHistoricalIdentityResult ? `${nseHistoricalIdentityResult.historyRows.length} historical rows in preview` : 'Not previewed'}</strong>
            <span className="identity-review-note">{historicalCommitConfirmed ? 'View Recent Applied for this completed run. Create a fresh preview before applying again.' : nseHistoricalIdentityResult && historicalChangeCount(nseHistoricalIdentityResult) === 0 ? 'No actionable changes. Informational records remain available for review.' : historicalDisabled ? 'A valid reviewed historical plan is required.' : 'Reviewed historical plan available. Apply requires confirmation.'}</span></div>
          <button type="button" style={identityPrimaryButtonStyle} onClick={() => void applyNseHistoricalIdentityArchive()}
            disabled={historicalDisabled} title="Apply only the reviewed historical identity plan">Apply Reviewed Historical Identity</button>
        </> : bseNames.footer}
        diagnostics={<>
          <div className="identity-workspace-toolbar">
            <button type="button" onClick={() => void checkOfficialSourceHealth()} disabled={busy || !hasDatabase}
              title="Checks all configured NSE and BSE sources; does not refresh saved import files">Check Source Health</button>
            <span>Checks all exchanges. Results initially show {identityExchange}.</span>
          </div>
          {renderOfficialSourceHealthPanel()}
        </>}
      />
      {identityConfirmation.dialog}
      {bseNames.confirmationDialog}
    </>
  );

  const compactPendingReview =
    activeOfficialImportSection === 'review' && !showingApprovedImports;
  const dividendVerificationTerminal = officialTaskProgress?.stage === 'dividend-verified' ||
    officialTaskProgress?.stage === 'dividend-stopped';
  const pendingCompactMessage = busy && officialTaskProgress && officialTaskProgress.endedAt == null
    ? officialTaskProgress.message
    : dividendVerificationTerminal && officialTaskProgress ? officialTaskProgress.message
    : status || (officialPreparationComplete
        ? `Prepared ${importRows.length} pending action(s). Ready ${eligibleImportRows.length}; selected ${selectedEligibleImportRows.length}.`
        : 'Choose Load & Validate. The app will perform routine matching and Split/Bonus checks before you review and apply.');
  const pendingCompactTaskIsCurrent = officialTaskProgress != null &&
    (officialTaskProgress.endedAt == null || dividendVerificationTerminal ||
      !status || status === officialTaskProgress.message);

  const classicRows = useMemo<ClassicActionRow[]>(() => {
    const readyIds = new Set(eligibleImportRows.map(row => row.id));
    return visibleImportRows.map(row => {
      const existing = existingDividendByImportId[row.id]?.row === row ? existingDividendByImportId[row.id] : undefined;
      const later = isLaterCorporateAction(row);
      const ready = !later && !busy && !existing && readyIds.has(row.id);
      const disposition = officialDividendPreparedScopeDispositionByImportId.get(row.id);
      let label = officialImportUserStatus(row,latestScanByImportId.get(row.id),officialPreparationErrors[row.id],officialPreparationComplete,true);
      let category: ClassicStatus = 'review';
      if (row.reviewStatus === 'APPROVED' || row.approvedCorporateActionId != null) { label='Approved';category='approved'; }
      else if (existing) { label='Already Processed';category='processed'; }
      else if (later) { label='Later';category='later'; }
      else if (isInformationalCorporateAnnouncement(row)) { label='Informational';category='informational'; }
      else if (busy || !officialPreparationComplete) { label=busy?'Checking…':'Not validated';category='checking'; }
      else if (ready) { label='Ready';category='ready'; }
      else {
        if (row.actionType === 'DIVIDEND' && disposition?.disposition === 'INELIGIBLE') {
          const reason=disposition.reason;
          label=/identity/i.test(reason)?'Awaiting identity evidence':/official.source|witness/i.test(reason)?'Awaiting official source evidence'
            :/close|trade date|EOD/i.test(reason)?'Waiting for EOD data':/cash|wording|components/i.test(reason)?'Cash evidence needs verification':'Needs evidence verification';
        } else if (row.actionType === 'DIVIDEND' && row.parseStatus === 'PARSED' && row.reviewStatus === 'PENDING' &&
          /Ready to/i.test(label)) {
          // Only financial eligibility may still be pending; preserve a
          // specific EOD or historical identity blocker from the scan.
          label='Awaiting Dividend verification';
        } else if (/Ready to/i.test(label)) label='Not eligible for current workflow';
        category=/Awaiting|Waiting|Scheduled/i.test(label)?'waiting':'review';
      }
      return {record:row,ready,status:label,category,terms:formatCorporateActionDescription(row)};
    });
  },[visibleImportRows,busy,officialPreparationComplete,officialPreparationErrors,latestScanByImportId,
    officialDividendPreparedScopeDispositionByImportId,currentOfficialDividendWriteStageScope,existingDividendByImportId]);

  const clearClassicSelection = () => { setSelectedImportIds(new Set());setOfficialApprovalConfirmation(null); };
  const showClassicQueue = () => {
    if (activeOfficialImportView === 'review' &&
        (activeCorporateTab !== 'imports' || activeOfficialImportSection !== 'review')) restorePendingReview();
    setActiveCorporateTab('imports');setActiveOfficialImportSection('review');setClassicReview(true);
    setOfficialSafeV2SkippedOnly(false);setSelectedImportActionTypes([...CORPORATE_IMPORT_FILTER_TYPES]);
  };
  const renderClassicImports = () => <CorporateActionClassicWorkspace
    rows={classicRows} loadedCount={importRows.length} selectedIds={selectedImportIds}
    busy={busy} hasDatabase={hasDatabase} approved={showingApprovedImports}
    exchange={officialFetchExchangeSelection} fromDate={fetchFromDate} toDate={fetchToDate}
    types={classicTypeFilters} search={importSearchQuery} filterResetKey={classicFilterResetKey} message={pendingCompactMessage}
    progress={officialTaskProgress ? {startedAt:officialTaskProgress.startedAt,endedAt:officialTaskProgress.endedAt??null,
      completed:officialTaskProgress.completed??0,total:officialTaskProgress.total??null}:undefined} canCancel={officialCanCancelPreparation}
    onCancel={()=>{officialCancelPreparationRef.current=true;setOfficialCanCancelPreparation(false);}}
    onFetch={()=>void fetchOfficialActions()} onValidate={()=>void (showingApprovedImports?loadOfficialImports():loadAndPrepareOfficialImports())}
    onViewChange={approved=>void switchOfficialImportView(approved?'approved':'review')}
    onExchangeChange={value=>setOfficialFetchExchangeSelection(value as OfficialFetchExchangeSelection)}
    onDateChange={(from,to)=>{setFetchFromDate(from);setFetchToDate(to);}}
    onTypesChange={value=>{setClassicTypeFilters(value);setSelectedImportActionTypes([...CORPORATE_IMPORT_FILTER_TYPES]);}}
    onSearchChange={value=>updateOfficialImportSearchQuery(value)}
    onCurrentSymbol={()=>applyCurrentSymbolFilter(updateOfficialImportSearchQuery,importExchange)}
    onToggleMany={(ids,checked)=>{setSelectedImportIds(old=>{const next=new Set(old);for(const id of ids){if(checked)next.add(id);else next.delete(id);}return next;});setOfficialApprovalConfirmation(null);}} onFilterChange={clearClassicSelection}
    onApprove={(mode,ids)=>void requestOfficialImportApproval(mode,ids)}
    renderDetails={row=><>
      <dl><dt>ISIN</dt><dd>{row.isin??'Unavailable'}</dd><dt>Official purpose</dt><dd>{row.purposeRaw}</dd>
        <dt>Source evidence</dt><dd style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{formatCorporateImportEvidenceTitle(row)}</dd></dl>
      <p>{officialPreparationErrors[row.id]??row.message}</p>
      {existingDividendByImportId[row.id]?.row === row ? <p>Already represented by verified canonical Dividend #{existingDividendByImportId[row.id].corporateActionId}. No new adjustment required; this source row has not been marked approved.</p> : null}
      <OfficialDividendPreparedScopeDispositionDetails disposition={officialDividendPreparedScopeDispositionByImportId.get(row.id)} />
      {latestScanByImportId.get(row.id)?<dl><dt>Previous close</dt><dd>{latestScanByImportId.get(row.id)?.prevClose??'Unavailable'}</dd>
        <dt>Ex-date close</dt><dd>{latestScanByImportId.get(row.id)?.exClose??'Unavailable'}</dd>
        <dt>Price check</dt><dd>{latestScanByImportId.get(row.id)?.message??latestScanByImportId.get(row.id)?.scanStatus}</dd></dl>:null}
      {row.actionType!=='DIVIDEND' && ['UNRESOLVED','PENDING_ISIN_MISMATCH'].includes(row.reviewStatus)?
        <button type="button" disabled={busy} onClick={()=>{setClassicReview(false);startResolveImport(row);}}>Advanced identity maintenance</button>:null}
      {isSplitOrBonus(row)&&!isOfficialRowReady(row)?<button type="button" disabled={busy} onClick={()=>{setClassicReview(false);startPriceExceptionReview(row);}}>Advanced price maintenance</button>:null}
    </>} />;

  const renderImportsTab = () => (
    <div style={corporateActionPanelStyle}>
      <div style={officialImportSectionNavStyle} aria-label="Official import tasks">
        <button
          type="button"
          style={corporateActionTabButtonStyle(activeOfficialImportSection === 'review')}
          onClick={() => setActiveOfficialImportSection('review')}
        >
          Review
        </button>
        <button
          type="button"
          style={corporateActionTabButtonStyle(activeOfficialImportSection === 'fetch')}
          onClick={() => setActiveOfficialImportSection('fetch')}
        >
          Fetch from Officials
        </button>
        <button
          type="button"
          style={corporateActionTabButtonStyle(activeOfficialImportSection === 'history')}
          onClick={() => setActiveOfficialImportSection('history')}
        >
          Historical Backfill
        </button>
      </div>
      {activeOfficialImportSection === 'review' ? (
        <div style={{ padding: '4px 0' }}>
          <button type="button" style={modalButtonStyle} disabled={busy || !hasDatabase} onClick={() => setReconciliationOpen(true)}>
            Reconciliation preview / Export CSV-TXT
          </button>
          {reconciliationOpen && api ? <CorporateActionReconciliationPanel
            api={api} databasePath={activeDatabasePath}
            importIds={visibleImportRows.map((row) => row.id)}
            generation={officialPreparationGenerationRef.current}
            scopeRevision={importRows}
            onClose={() => setReconciliationOpen(false)}
          /> : null}
        </div>
      ) : null}
      {activeOfficialImportSection === 'review' && officialTaskProgress && !compactPendingReview ? (
        <OfficialImportTaskStatus progress={officialTaskProgress} canCancel={officialCanCancelPreparation}
          onCancel={() => { officialCancelPreparationRef.current = true; setOfficialCanCancelPreparation(false); }} />
      ) : null}
      {activeOfficialImportSection === 'review' ? (
        compactPendingReview ? (
          <div style={pendingCompactControlsStyle} aria-label="Pending Actions compact controls">
            <div data-ca-review-band="actions" style={pendingCompactActionsStyle}>
              <div style={pendingCompactActionGroupStyle}>
  <select aria-label="Official fetch exchange scope" value={officialFetchExchangeSelection} onChange={(event) => setOfficialFetchExchangeSelection(event.target.value as OfficialFetchExchangeSelection)} style={{ ...utilityInputStyle, width: 108 }} disabled={busy}><option value="BOTH">NSE + BSE</option><option value="NSE">NSE</option><option value="BSE">BSE</option></select>
  <input type="date" aria-label="Official fetch from date" value={fetchFromDate} max={fetchToDate || undefined} onChange={(event) => setFetchFromDate(event.target.value)} style={{ ...utilityInputStyle, width: 128 }} disabled={busy} />
  <input type="date" aria-label="Official fetch to date" value={fetchToDate} min={fetchFromDate || undefined} onChange={(event) => setFetchToDate(event.target.value)} style={{ ...utilityInputStyle, width: 128 }} disabled={busy} />
  <button type="button" style={primaryButtonStyle} onClick={() => void fetchOfficialActions()} disabled={busy || !hasDatabase || !fetchFromDate || !fetchToDate || fetchFromDate > fetchToDate}>Fetch Official</button>
                <button type="button" style={primaryButtonStyle} onClick={() => void loadAndPrepareOfficialImports()} disabled={busy || !hasDatabase}>
                  Load &amp; Validate
                </button>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void approveSelectedOfficialImports()}
                  disabled={busy || !hasDatabase || !officialPreparationComplete || selectedEligibleImportRows.length === 0}
                >
                  Approve Selected ({selectedEligibleImportRows.length})
                </button>
                <button
                  type="button"
                  style={primaryButtonStyle}
                  onClick={() => void approveAllReadyOfficialImports()}
                  disabled={busy || !hasDatabase || !officialPreparationComplete || eligibleImportRows.length === 0}
                >
                  Approve All Ready ({eligibleImportRows.length})
                </button>
              </div>
              <div style={pendingCompactViewActionsStyle}>
                <button
                  type="button"
                  style={activeOfficialImportView === 'review' ? primaryButtonStyle : modalButtonStyle}
                  onClick={() => void switchOfficialImportView('review')}
                  disabled={busy || !hasDatabase}
                >
                  Review Queue
                </button>
                <button
                  type="button"
                  style={showingApprovedImports ? primaryButtonStyle : modalButtonStyle}
                  onClick={() => void switchOfficialImportView('approved')}
                  disabled={busy || !hasDatabase}
                >
                  Approved
                </button>
              </div>
            </div>
            <div data-ca-review-band="filters" style={pendingCompactFiltersStyle}>
              <div style={pendingCompactTypeFiltersStyle}>
                {renderImportActionTypeFilters()}
              </div>
              <label style={pendingCompactSymbolFieldStyle}>
                <span style={utilityFieldLabelStyle}>Symbol</span>
                <select
                  value={officialReviewSymbolFilter}
                  onChange={(event) => {
                    setOfficialReviewSymbolFilter(event.target.value);
                    setSelectedImportIds(new Set());
                    setOfficialApprovalConfirmation(null);
                  }}
                  style={pendingCompactSymbolSelectStyle}
                  disabled={busy}
                >
                  <option value="ALL">All symbols</option>
                  {officialReviewSymbolOptions.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </label>
              <label
                style={corporateImportFilterCheckboxStyle}
                title="Show only rows skipped by Safe V2 in the current completed preparation. This does not change manual Apply eligibility."
              >
                <input
                  type="checkbox"
                  aria-label="Safe V2 skipped focus"
                  checked={officialSafeV2SkippedOnly}
                  onChange={(event) => {
                    setOfficialSafeV2SkippedOnly(event.target.checked);
                    setSelectedImportIds(new Set());
                    setOfficialApprovalConfirmation(null);
                  }}
                  disabled={busy || currentOfficialAutoApproval == null || officialAutoApprovalSkippedReasons.size === 0}
                />
                <span>Safe V2 skipped ({officialAutoApprovalSkippedReasons.size})</span>
              </label>
              <div style={pendingCompactSearchStyle}>
                <span style={utilityFieldLabelStyle}>Find:</span>
                <input
                  value={importSearchQuery}
                  onChange={(event) => updateOfficialImportSearchQuery(event.target.value)}
                  style={pendingCompactSearchInputStyle}
                  placeholder="Filter by symbol, company, or ISIN"
                />
                <button
                  type="button"
                  style={modalButtonStyle}
                  onClick={() => applyCurrentSymbolFilter(updateOfficialImportSearchQuery, importExchange)}
                  disabled={busy || !hasDatabase}
                >
                  Current
                </button>
              </div>
            </div>
            <div data-ca-review-band="status" style={pendingCompactStatusBandStyle}>
              <div style={pendingCompactCountsStyle} aria-label="Pending Actions counts">
                <span>Pending {importRows.length}</span>
                <span>Filtered {visibleImportRows.length}</span>
                <span>Ready {eligibleImportRows.length}</span>
                <span>Selected {selectedEligibleImportRows.length}</span>
              </div>
              {allTypePendingSummary ? (
                <details style={pendingDiagnosticDisclosureStyle}>
                  <summary style={{ cursor: 'pointer' }}>
                    All action types — {allTypePendingSummary.totals.pending.toLocaleString('en-IN')} not approved ·
                    {' '}{allTypePendingSummary.totals.ready.toLocaleString('en-IN')} Ready ·
                    {' '}{allTypePendingSummary.totals.blocked.toLocaleString('en-IN')} Blocked
                    {' · '}{allTypePendingSummary.totals.informational.toLocaleString('en-IN')} Informational
                  </summary>
                  <div style={pendingDiagnosticTableViewportStyle}>
                    <table aria-label="Corporate Actions pending by type" style={pendingDiagnosticTableStyle}>
                      <thead><tr>
                        <th scope="col" style={pendingDiagnosticLabelCellStyle}>Type</th>
                        <th scope="col" style={pendingDiagnosticNumberCellStyle}>Not approved</th>
                        <th scope="col" style={pendingDiagnosticNumberCellStyle}>Ready</th>
                        <th scope="col" style={pendingDiagnosticNumberCellStyle}>Blocked</th>
                        <th scope="col" style={pendingDiagnosticNumberCellStyle}>Informational</th>
                      </tr></thead>
                      <tbody>{allTypePendingSummary.rows.map(item => (
                        <tr key={item.actionType}>
                          <th scope="row" style={pendingDiagnosticLabelCellStyle}>{item.actionType}</th>
                          <td style={pendingDiagnosticNumberCellStyle}>{item.pending.toLocaleString('en-IN')}</td>
                          <td style={pendingDiagnosticNumberCellStyle}>{item.ready.toLocaleString('en-IN')}</td>
                          <td style={pendingDiagnosticNumberCellStyle}>{item.blocked.toLocaleString('en-IN')}</td>
                          <td style={pendingDiagnosticNumberCellStyle}>{item.informational.toLocaleString('en-IN')}</td>
                        </tr>
                      ))}</tbody>
                      <tfoot><tr>
                        <th scope="row" style={pendingDiagnosticLabelCellStyle}>TOTAL</th>
                        <td style={pendingDiagnosticNumberCellStyle}>{allTypePendingSummary.totals.pending.toLocaleString('en-IN')}</td>
                        <td style={pendingDiagnosticNumberCellStyle}>{allTypePendingSummary.totals.ready.toLocaleString('en-IN')}</td>
                        <td style={pendingDiagnosticNumberCellStyle}>{allTypePendingSummary.totals.blocked.toLocaleString('en-IN')}</td>
                        <td style={pendingDiagnosticNumberCellStyle}>{allTypePendingSummary.totals.informational.toLocaleString('en-IN')}</td>
                      </tr></tfoot>
                    </table>
                  </div>
                  <details style={pendingDiagnosticDisclosureStyle}>
                    <summary style={{ cursor: 'pointer' }}>Copyable type report</summary>
                    <textarea aria-label="All CA pending type report" readOnly
                      value={formatCaPendingTypeReport(allTypePendingSummary)} rows={6}
                      style={pendingDiagnosticReportStyle} />
                  </details>
                  <div style={{ ...corporateIssueHintTextStyle, whiteSpace: 'normal' }}>
                    Counts cover the loaded pending queue, not all historical approvals. Ready does not mean approved.
                  </div>
                </details>
              ) : null}
              <div style={pendingCompactStatusPresentationStyle}>
                {pendingCompactTaskIsCurrent && officialTaskProgress ? (
                  <OfficialImportTaskStatus
                    progress={officialTaskProgress}
                    canCancel={officialCanCancelPreparation}
                    onCancel={() => {
                      officialCancelPreparationRef.current = true;
                      setOfficialCanCancelPreparation(false);
                    }}
                    compact
                    messageOverride={pendingCompactMessage}
                  />
                ) : (
                  <div role="status" aria-live="polite" style={pendingCompactCurrentStatusStyle}>
                    {pendingCompactMessage}
                  </div>
                )}
                <OfficialSafeV2OutcomeSummary result={currentOfficialAutoApproval} />
                <OfficialDividendPreparedScopeOutcomeSummary outcome={currentOfficialDividendPreparedScopeOutcome} />
                <div role="group" aria-label="Dividend R1 write-stage activation status" style={corporateIssueHintTextStyle}>
                  Dividend R1: {currentOfficialDividendWriteStageScope
                    ? `${currentOfficialDividendPreparedScopeOutcome?.result.eligible ?? 0} independently verified; only explicitly confirmed Ready IDs may be applied.`
                    : 'No current verified Dividend batch.'} No automatic approval occurs during Load.
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={officialImportSectionCardStyle}>
            <div style={officialImportSectionHeaderStyle}>
              <div>
                <div style={officialImportSectionTitleStyle}>Review official actions</div>
                <div style={utilityHelperTextStyle}>Load &amp; Prepare checks matching and Split/Bonus prices for you. Select ready actions to apply; expand blocked symbols to see the reason.</div>
              </div>
              <div style={buttonRowStyle}>
                <button
                  type="button"
                  style={activeOfficialImportView === 'review' ? primaryButtonStyle : modalButtonStyle}
                  onClick={() => void switchOfficialImportView('review')}
                  disabled={busy || !hasDatabase}
                >
                  Review Queue
                </button>
                <button
                  type="button"
                  style={showingApprovedImports ? primaryButtonStyle : modalButtonStyle}
                  onClick={() => void switchOfficialImportView('approved')}
                  disabled={busy || !hasDatabase}
                >
                  Approved
                </button>
              </div>
            </div>
            <div style={corporateImportToolbarStyle}>
              <button type="button" style={modalButtonStyle} onClick={() => void loadOfficialImports()} disabled={busy || !hasDatabase}>
                Load Approved
              </button>
              <button type="button" style={modalButtonStyle} onClick={() => void loadMoreOfficialImports()} disabled={busy || !hasDatabase}>
                Load More Approved
              </button>
            </div>
            {renderImportActionTypeFilters()}
            {renderSearchBar(
              'Find:',
              importSearchQuery,
              updateOfficialImportSearchQuery,
              () => applyCurrentSymbolFilter(updateOfficialImportSearchQuery, importExchange),
            )}
          </div>
        )
      ) : null}
      {activeOfficialImportSection === 'fetch' ? (
        <div style={officialImportSectionCardStyle}>
          <div style={officialImportSectionTitleStyle}>Fetch from an official source</div>
          <div style={utilityHelperTextStyle}>Choose an exchange, date window, and action types. New rows always enter the review queue.</div>
          <div style={corporateImportToolbarStyle}>
            <label style={officialImportFieldGroupStyle}>
              <span style={utilityFieldLabelStyle}>Exchange</span>
              <select
                value={officialFetchExchangeSelection}
              disabled={busy}
                onChange={(event) =>
                  setOfficialFetchExchangeSelection(event.target.value as OfficialFetchExchangeSelection)
                }
                style={utilityInputStyle}
              >
                <option value="BOTH">NSE + BSE</option>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </label>
            <label style={officialImportFieldGroupStyle}>
              <span style={utilityFieldLabelStyle}>From</span>
              <input
                type="date"
                value={fetchFromDate}
                disabled={busy}
                max={fetchToDate || undefined}
                onChange={(event) => setFetchFromDate(event.target.value)}
                style={utilityInputStyle}
              />
            </label>
            <label style={officialImportFieldGroupStyle}>
              <span style={utilityFieldLabelStyle}>To</span>
              <input
                type="date"
                value={fetchToDate}
                disabled={busy}
                min={fetchFromDate || undefined}
                onChange={(event) => setFetchToDate(event.target.value)}
                style={utilityInputStyle}
              />
            </label>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => void fetchOfficialActions()}
              disabled={busy || !hasDatabase || !fetchFromDate || !fetchToDate || fetchFromDate > fetchToDate}
            >
              Fetch Official
            </button>
            <button
              type="button"
              style={modalButtonStyle}
              onClick={() => void fetchOfficialActions(true)}
              disabled={busy || !hasDatabase || !fetchFromDate || !fetchToDate || fetchFromDate > fetchToDate}
            >
              Force Re-fetch
            </button>
            {officialFetchRunning ? (
              <button
                type="button"
                style={modalButtonStyle}
                disabled={officialFetchCancelRequested.current}
                onClick={async () => {
                  officialFetchCancelRequested.current = true;
                  setStatus('Stopping official fetch at a safe request boundary. Completed windows remain saved.');
                  setCorporateProgress({ progress: 0, message: 'Stopping official fetch at a safe request boundary. Completed windows remain saved.' });
                  try { await api?.cancelOfficialCorporateActionFetch(); }
                  catch (error) { setStatus(getErrorMessage(error, 'Could not request fetch cancellation.')); }
                }}
              >
                Cancel Fetch
              </button>
            ) : null}
          </div>
          <div style={officialFetchLastSuccessStyle}>
            Last successful fetch: {formatCorporateActionNormalLastFetch(lastSuccessfulOfficialFetch)}
          </div>
          {renderImportActionTypeFilters()}
          {officialFetchLog.length > 0 ? (
            <ol style={officialFetchLogStyle} aria-label="Official fetch status log">
              {officialFetchLog.map((entry, index) => (
                <li key={String(index) + ':' + entry}>{entry}</li>
              ))}
            </ol>
          ) : null}
          {bseFetchFailed ? (
            <div role="status" style={utilityHelperTextStyle}>
              Automatic BSE collection did not finish. Completed NSE results and BSE windows are saved.
              Select BSE and use Fetch Official to resume the remaining dates.
              <div style={buttonRowStyle}>
                <button
                  type="button"
                  style={modalButtonStyle}
                  disabled={busy || !api}
                  onClick={async () => {
                    try {
                      const result = await requireDesktopShellApi().openExternal('https://www.bseindia.com/corporates/corporates_act');
                      if (!result.success) setStatus('Could not open the official BSE page.');
                    } catch (error) {
                      setStatus(getErrorMessage(error, 'Could not open the official BSE page.'));
                    }
                  }}
                >
                  Open official BSE page
                </button>
                <button
                  type="button"
                  style={modalButtonStyle}
                  disabled={busy}
                  onClick={() => setOfficialFetchExchangeSelection('BSE')}
                >
                  Select BSE only for retry
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {activeOfficialImportSection === 'history' ? (
        <div style={officialImportSectionCardStyle}>
          <div style={officialImportSectionTitleStyle}>Historical split and bonus backfill</div>
          <div style={utilityHelperTextStyle}>Run a review-only backfill for one NSE symbol or a controlled batch.</div>
          <div style={corporateImportToolbarStyle}>
        <label style={officialImportFieldGroupStyle}>
          <span style={utilityFieldLabelStyle}>NSE symbol</span>
          <input
            value={historicalBackfillSymbol}
            onChange={(event) => setHistoricalBackfillSymbol(event.target.value)}
            style={utilityInputStyle}
            placeholder="Current NSE symbol"
          />
        </label>
        <label style={officialImportFieldGroupStyle}>
          <span style={utilityFieldLabelStyle}>From</span>
          <input
            type="date"
            value={historicalBackfillFromDate}
            onChange={(event) => setHistoricalBackfillFromDate(event.target.value)}
            style={utilityInputStyle}
          />
        </label>
        <label style={officialImportFieldGroupStyle}>
          <span style={utilityFieldLabelStyle}>To</span>
          <input
            type="date"
            value={historicalBackfillToDate}
            onChange={(event) => setHistoricalBackfillToDate(event.target.value)}
            style={utilityInputStyle}
          />
        </label>
        <label style={officialImportFieldGroupStyle}>
          <span style={utilityFieldLabelStyle}>BSE scrip code (optional)</span>
          <input
            value={historicalBackfillBseScripCode}
            onChange={(event) => setHistoricalBackfillBseScripCode(event.target.value)}
            style={utilityInputStyle}
            placeholder="Optional BSE scrip code"
            inputMode="numeric"
          />
        </label>
        <button
          type="button"
          style={modalButtonStyle}
          onClick={() => applyCurrentSymbolFilter(setHistoricalBackfillSymbol, 'NSE')}
          disabled={busy || !hasDatabase}
        >
          Current
        </button>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => void runHistoricalBackfillPilot()}
          disabled={
            busy ||
            !hasDatabase ||
            !historicalBackfillSymbol.trim() ||
            !historicalBackfillFromDate ||
            !historicalBackfillToDate
          }
        >
          Backfill History
        </button>
      </div>
      <div style={utilityHelperTextStyle}>
        Historical pilot stays review-only: NSE target symbol, split/bonus only, no auto-approval, raw prices unchanged.
        Leave the BSE scrip code blank to let the app try a same-ISIN BSE lookup first.
      </div>
      {historicalBackfillResult ? <HistoricalBackfillResultPanel result={historicalBackfillResult} /> : null}
      <div style={historicalBackfillBatchPanelStyle}>
        <div style={historicalBackfillBatchInputStyle}>
          <span style={utilityFieldLabelStyle}>Batch NSE:</span>
          <textarea
            value={historicalBatchSymbols}
            onChange={(event) => setHistoricalBatchSymbols(event.target.value)}
            style={historicalBackfillBatchTextareaStyle}
            placeholder="INFY&#10;WIPRO&#10;KOTAKBANK"
            rows={3}
          />
          <label style={corporateImportFilterCheckboxStyle}>
            <input
              type="checkbox"
              checked={historicalBatchStopOnError}
              onChange={(event) => setHistoricalBatchStopOnError(event.target.checked)}
            />
            Stop on error
          </label>
          <button
            type="button"
            style={primaryButtonStyle}
            onClick={() => void runHistoricalBackfillBatch()}
            disabled={
              busy ||
              !hasDatabase ||
              parseHistoricalBackfillBatchSymbols(historicalBatchSymbols).length === 0 ||
              !historicalBackfillFromDate ||
              !historicalBackfillToDate
            }
          >
            Run Batch
          </button>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={() => void loadHistoricalBackfillRunHistory()}
            disabled={busy || !hasDatabase}
          >
            Load Runs
          </button>
        </div>
        <div style={historicalBackfillBatchSourceRowStyle}>
          <span style={utilityHelperTextStyle}>Fill from:</span>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={populateHistoricalBatchFromCurrentChart}
            disabled={busy || !hasDatabase}
          >
            Current Chart
          </button>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={populateHistoricalBatchFromWatchlist}
            disabled={busy || !hasDatabase || !selectedHistoricalBatchWatchlist}
            title={
              selectedHistoricalBatchWatchlist
                ? `${selectedHistoricalBatchWatchlist.name}: ${selectedHistoricalBatchWatchlistNseCount} NSE symbol(s)`
                : 'No watchlist is available.'
            }
          >
            Watchlist
          </button>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={() => void populateHistoricalBatchFromSparseHistory()}
            disabled={busy || !hasDatabase}
            title="Load active NSE symbols with unresolved split/bonus review rows or long price history with sparse known split/bonus coverage."
          >
            Sparse History
          </button>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={() => void populateHistoricalBatchFromOldAliases()}
            disabled={busy || !hasDatabase}
            title="Load active NSE symbols that have old symbol aliases in identity history."
          >
            Old Aliases
          </button>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={() => void populateHistoricalBatchFromMajorLiquid()}
            disabled={busy || !hasDatabase}
            title="Load active NSE symbols ranked by recent local traded value."
          >
            Major Liquid
          </button>
          <span style={utilityHelperTextStyle}>
            {selectedHistoricalBatchWatchlist
              ? `${selectedHistoricalBatchWatchlist.name}: ${selectedHistoricalBatchWatchlistNseCount} NSE symbol(s)${
                  historicalSparseCandidates.length > 0
                    ? ` | sparse ${historicalSparseCandidates.length}`
                    : ''
                }${historicalAliasCandidates.length > 0 ? ` | aliases ${historicalAliasCandidates.length}` : ''}${
                  historicalMajorLiquidCandidates.length > 0 ? ` | liquid ${historicalMajorLiquidCandidates.length}` : ''
                }`
              : 'No watchlist loaded'}
          </span>
        </div>
        <div style={utilityHelperTextStyle}>
          Batch uses the same date window above. Enter up to 25 NSE symbols separated by lines, commas, or spaces.
        </div>
      </div>
      {historicalBatchResult ? <HistoricalBackfillBatchResultPanel result={historicalBatchResult} /> : null}
      {historicalBackfillRuns || historicalBackfillRunsMessage ? (
        <HistoricalBackfillRunHistoryPanel
          runs={historicalBackfillRuns ?? []}
          message={historicalBackfillRunsMessage}
          page={historicalBackfillRunPage}
          loading={busy}
          onPageChange={(offset) => void loadHistoricalBackfillRunHistory(offset)}
        />
      ) : null}
        </div>
      ) : null}
      {activeOfficialImportSection === 'fetch' ? (
        <div style={officialImportSectionCardStyle}>
          <div style={officialImportSectionTitleStyle}>CSV fallback</div>
          <div style={utilityHelperTextStyle}>Use a local official-source CSV only when the direct fetch is unavailable or incomplete.</div>
          <div style={corporateImportCsvToolbarStyle}>
            <label style={{ ...officialImportFieldGroupStyle, minWidth: 0 }}>
              <span style={utilityFieldLabelStyle}>Exchange</span>
              <select value={importExchange} onChange={(event) => setImportExchange(event.target.value)} style={utilityInputStyle}>
                <option value="NSE">NSE</option>
                <option value="BSE">BSE</option>
              </select>
            </label>
            <input value={importFilePath} onChange={(event) => setImportFilePath(event.target.value)} style={utilityInputStyle} placeholder="Official CSV file path" />
            <button type="button" style={modalButtonStyle} onClick={() => void pickOfficialImportFile()} disabled={busy || !hasDatabase}>
              Browse
            </button>
            <button type="button" style={primaryButtonStyle} onClick={() => void importOfficialCsv()} disabled={busy || !hasDatabase || !importFilePath.trim()}>
              Import CSV
            </button>
          </div>
        </div>
      ) : null}
      {activeOfficialImportSection === 'review' ? (
        <>
          {officialApprovalConfirmation ? (
            <div style={officialApprovalConfirmationStyle} role="region" aria-label="Confirm Corporate Action approval">
              <strong>Confirm apply</strong>
              <span>
                Apply {officialApprovalConfirmation.importIds.length} ready action(s) from {officialApprovalConfirmation.scopeLabel}.
                Only the reviewed IDs will be considered; the app freshly revalidates them before writing. Dividends use 100-ID guarded transactions.
              </span>
              <div style={buttonRowStyle}>
                <button type="button" style={modalButtonStyle} onClick={() => setOfficialApprovalConfirmation(null)} disabled={busy}>Cancel</button>
                <button type="button" style={primaryButtonStyle} onClick={() => void confirmOfficialImportApproval()} disabled={busy}>Apply reviewed actions</button>
              </div>
            </div>
          ) : null}
          <div
            style={{
              ...corporateImportTableStyle,
              minHeight: compactPendingReview ? 160 : corporateImportTableStyle.minHeight,
              display: (resolveTargetRow || priceExceptionTargetRow) && !showingApprovedImports ? 'none' : 'flex',
            }}
          >
            <div style={corporateImportHeaderStyle}>
              <span />
              {showingApprovedImports ? (
                <>
                  <span>Instrument</span><span>Ex-Date</span><span>Official Action</span><span>Multipliers</span><span>Price Check</span><span>Validation / Approval</span><span>Approved At</span>
                </>
              ) : (
                <>
                  <span style={{gridColumn:'2 / -1'}}>Pending actions grouped by symbol</span>
                </>
              )}
            </div>
            <div style={quotesBodyStyle}>
              {!showingApprovedImports
                ? officialPendingGroups.map((group) => {
                    const readyRows = group.rows.filter((row) =>
                      isOfficialRowReady(row),
                    );
                    const reasonCounts = summarizeOfficialImportReadiness(group.rows, latestScanByImportId, officialPreparationErrors, officialPreparationComplete, true);
                    const eligibleDividendsInGroup = group.rows.filter((row) => row.actionType === 'DIVIDEND' && isOfficialRowReady(row)).length;
                    if (eligibleDividendsInGroup) {
                      reasonCounts['Waiting for EOD Data'] = Math.max(0, (reasonCounts['Waiting for EOD Data'] ?? 0) - eligibleDividendsInGroup);
                      reasonCounts['Ready to approve'] = (reasonCounts['Ready to approve'] ?? 0) + eligibleDividendsInGroup;
                    }
                    const reasonSummary = Object.entries(reasonCounts).map(([reason,count]) => `${count} ${reason.toLowerCase()}`).join(' · ');
                    const selectedReady = readyRows.filter((row) => selectedImportIds.has(row.id));
                    const expanded = expandedOfficialGroupKeys.has(group.key);
                    return (
                      <div key={group.key} style={officialPendingGroupStyle}>
                        <div style={officialPendingGroupHeaderStyle}>
                          <input
                            type="checkbox"
                            checked={readyRows.length > 0 && selectedReady.length === readyRows.length}
                            disabled={busy || !officialPreparationComplete || readyRows.length === 0}
                            onChange={(event) => {
                              setSelectedImportIds((current) => {
                                const next = new Set(current);
                                for (const row of readyRows) {
                                  if (event.target.checked) next.add(row.id);
                                  if (!event.target.checked) next.delete(row.id);
                                }
                                return next;
                              });
                            }}
                            title={readyRows.length ? `Select ready actions only. ${reasonSummary}` : `Cannot select: ${reasonSummary}. Expand for individual reasons.`}
                          />
                          <button
                            type="button"
                            style={officialPendingGroupToggleStyle}
                            onClick={() => {
                              setExpandedOfficialGroupKeys((current) => {
                                const next = new Set(current);
                                if (next.has(group.key)) next.delete(group.key);
                                else next.add(group.key);
                                return next;
                              });
                            }}
                          >
                            {expanded ? '▾' : '▸'} {group.label}
                          </button>
                          <span style={officialPendingGroupReasonStyle} title={reasonSummary}>
                            {group.rows.length} pending · {reasonSummary}
                          </span>
                        </div>
                        {expanded ? group.rows.map((row) => {
                          const scan = latestScanByImportId.get(row.id);
                          const approvalState = row.actionType === 'DIVIDEND' ? (isOfficialRowReady(row) ? 'READY TO APPROVE' : 'NEEDS REVIEW') : getCorporateActionNormalApprovalState(row, scan);
                          const canApprove = officialPreparationComplete && !officialPreparationErrors[row.id] && approvalState === 'READY TO APPROVE';
                          const dividendDisposition = officialDividendPreparedScopeDispositionByImportId.get(row.id);
                          const statusLabel = row.actionType === 'DIVIDEND' && currentOfficialDividendWriteStageScope
                            ? canApprove ? 'Ready to approve (verified Dividend R1)'
                              : dividendDisposition ? `Blocked — ${dividendDisposition.disposition.toLowerCase().replaceAll('_', ' ')}`
                                : row.parseStatus !== 'PARSED' || ['UNRESOLVED', 'PENDING_ISIN_MISMATCH'].includes(row.reviewStatus)
                                  ? officialImportUserStatus(row, scan, officialPreparationErrors[row.id], officialPreparationComplete, true)
                                  : 'Awaiting Dividend R1 evidence verification'
                            : officialImportUserStatus(row, scan, officialPreparationErrors[row.id], officialPreparationComplete, true);
                          const needsIdentityEvidence = row.actionType !== 'DIVIDEND' && ['UNRESOLVED', 'PENDING_ISIN_MISMATCH'].includes(row.reviewStatus);
                          const needsPriceReview = isSplitOrBonus(row) && approvalState === 'NEEDS REVIEW';
                          return (
                            <div key={row.id} style={officialPendingActionRowStyle}>
                              <input
                                type="checkbox"
                                checked={canApprove && selectedImportIds.has(row.id)}
                                disabled={busy || !canApprove}
                                title={canApprove ? 'Select for explicit approval' : `${statusLabel}. ${officialPreparationErrors[row.id] ?? row.message ?? 'Expand/review this action before approval.'}`}
                                onChange={(event) => toggleImportSelection(row.id, event.target.checked)}
                              />
                              <span style={corporateEvidenceSourceCellStyle} title={formatCorporateImportEvidenceTitle(row)}>
                                <strong>{row.actionType}</strong>
                                <span style={corporateIssueHintTextStyle}>{formatCorporateActionDescription(row)}</span>
                              </span>
                              <span style={corporateCellStyle}>{row.exDate ?? '-'}</span>
                              <span style={corporateEvidenceSourceCellStyle}>
                                <strong>{statusLabel}</strong>
                                {!canApprove && row.actionType !== 'DIVIDEND' ? <span style={{ ...corporateIssueHintTextStyle, whiteSpace: 'normal' }}>{row.message ?? scan?.message}</span> : null}
                                {officialPreparationErrors[row.id] ? <span style={corporateIssueHintTextStyle}>{officialPreparationErrors[row.id]}</span> : null}
                                {!officialPreparationErrors[row.id] ? (
                                  <OfficialSafeV2SkippedReason reason={officialAutoApprovalSkippedReasons.get(row.id)} />
                                ) : null}
                                <OfficialDividendPreparedScopeDispositionDetails
                                  disposition={officialDividendPreparedScopeDispositionByImportId.get(row.id)}
                                />
                              </span>
                              <span style={corporateCellStyle}>
                                {!canApprove && (needsIdentityEvidence || needsPriceReview) ? (
                                  <details>
                                    <summary>Advanced</summary>
                                    {needsIdentityEvidence ? (
                                      <button type="button" style={modalButtonStyle} onClick={() => startResolveImport(row)} disabled={busy}>Review identity</button>
                                    ) : isSplitOrBonus(row) && approvalState === 'NEEDS REVIEW' ? (
                                      <button type="button" style={modalButtonStyle} onClick={() => startPriceExceptionReview(row)} disabled={busy}>Review price</button>
                                    ) : null}
                                  </details>
                                ) : null}
                              </span>
                            </div>
                          );
                        }) : null}
                      </div>
                    );
                  })
                : visibleImportRows.map((row) => {
                    const scan = latestScanByImportId.get(row.id);
                    const approvalState = getCorporateActionApprovalState(row, scan);
                    const validationLabel = isSplitOrBonus(row) ? classifyCorporateActionValidation(row, scan) : 'NOT REQUIRED';
                    const identityLabel = getCorporateActionIdentityLabel(row.reviewStatus);
                    return (
                      <div key={row.id} style={corporateImportRowStyle}>
                        <span />
                        <span style={corporateEvidenceSourceCellStyle}>{row.symbol ? `${row.exchange}:${row.symbol}` : row.isin ?? '-'}</span>
                        <span style={corporateCellStyle}>{row.exDate ?? '-'}</span>
                        <span style={corporateEvidenceSourceCellStyle}><span>{row.actionType}</span><span style={corporateIssueHintTextStyle}>{formatCorporateActionDescription(row)}</span></span>
                        <span style={corporateEvidenceSourceCellStyle}><span>Share × {row.factor?.toFixed(6) ?? '-'}</span><span style={corporateIssueHintTextStyle}>Price × {(row.priceFactor ?? getPriceMultiplier(row.factor))?.toFixed(6) ?? '-'}</span></span>
                        <span style={corporateEvidenceSourceCellStyle}>{validationLabel}</span>
                        <span style={corporateEvidenceSourceCellStyle}><span>{identityLabel}</span><span style={corporateIssueHintTextStyle}>{approvalState}</span></span>
                        <span style={corporateCellStyle}>{row.approvedAt ?? '-'}</span>
                      </div>
                    );
                  })}
              {importRows.length === 0 ? (
                <div style={corporateEmptyStateStyle}>
                  {showingApprovedImports ? 'No approved official imports loaded.' : 'No official imports loaded.'}
                </div>
              ) : null}
              {importRows.length > 0 && visibleImportRows.length === 0 ? (
                <div style={corporateEmptyStateStyle}>
                  {showingApprovedImports ? 'No approved official imports match the current filter.' : 'No official imports match the current filter.'}
                </div>
              ) : null}
            </div>
          </div>
          {!showingApprovedImports ? renderResolvePanel() : null}
          {!showingApprovedImports ? renderPriceExceptionPanel() : null}
        </>
      ) : null}
      {!compactPendingReview ? (
        <div style={utilityStatusStyle}>
          {activeOfficialImportSection === 'review' && officialTaskProgress && busy
            ? officialTaskProgress.message
            : corporateProgress.message && activeOfficialImportSection !== 'review'
              ? `${corporateProgress.progress}% ${corporateProgress.message}`
            : status ||
              (activeOfficialImportSection === 'fetch'
                ? 'Fetched and imported rows stay review-first and are never approved automatically.'
                : activeOfficialImportSection === 'history'
                  ? 'Historical backfill adds review evidence only. Raw EOD prices remain unchanged.'
                  : showingApprovedImports
                    ? 'Review previously approved official Corporate Actions here. Split/Bonus rows show separate share and price multipliers when validation evidence is loaded.'
                    : officialPreparationComplete
                      ? `Prepared ${importRows.length} pending action(s). Ready ${eligibleImportRows.length}; selected ${selectedEligibleImportRows.length}.`
                      : 'Choose Load & Validate. The app will perform routine matching and Split/Bonus checks before you review and apply.' )}
        </div>
      ) : null}
    </div>
  );

  const renderScanTab = () => (
    <div style={corporateActionPanelStyle}>
      <div style={buttonRowStyle}>
        <button type="button" style={primaryButtonStyle} onClick={() => void runOfficialScan()} disabled={busy || !hasDatabase}>
          Scan Official
        </button>
        <button type="button" style={modalButtonStyle} onClick={() => void runBlindScan()} disabled={busy || !hasDatabase}>
          Blind Scan
        </button>
        <button type="button" style={modalButtonStyle} onClick={() => void loadScanResults()} disabled={busy || !hasDatabase}>
          Load Results
        </button>
        <button type="button" style={modalButtonStyle} onClick={() => void loadMoreScanResults()} disabled={busy || !hasDatabase}>
          Load More
        </button>
      </div>
      {renderSearchBar(
        'Find:',
        scanSearchQuery,
        setScanSearchQuery,
        () => applyCurrentSymbolFilter(setScanSearchQuery, activeInstrument?.exchange ?? null),
        'Filter scan results by symbol or message',
      )}
      <div style={utilityStatusStyle}>
        {scanSummary || status || 'Scan official split/bonus candidates, or run a blind local price-gap scan for missing split/bonus candidates. Scan output is review-only.'}
      </div>
      {renderCorporateScanTable(
        visibleScanRows,
        scanRows.length > 0 && visibleScanRows.length === 0 ? 'No scan rows match the current filter.' : 'No scan rows loaded.',
      )}
    </div>
  );

  const issueImportRowsBase = visibleImportRows.filter(
    (row) => row.reviewStatus !== 'APPROVED' && row.reviewStatus !== 'PENDING',
  );
  const recheckableIssueRows = issueImportRowsBase.filter((row) => row.reviewStatus === 'UNRESOLVED');
  const issueQuickResolvableRows = recheckableIssueRows.filter(
    (row) => issueResolveHints[row.id]?.quickResolvable === true,
  );
  const issueMultipleActiveRows = recheckableIssueRows.filter(
    (row) => issueResolveHints[row.id]?.status === 'MULTIPLE_ACTIVE',
  );
  const issueNoActiveRows = recheckableIssueRows.filter(
    (row) =>
      issueResolveHints[row.id]?.status === 'NONE_ACTIVE' &&
      (issueResolveHints[row.id]?.totalSuggestionCount ?? 0) > 0,
  );
  const issueNoHintRows = recheckableIssueRows.filter(
    (row) =>
      issueResolveHints[row.id]?.status === 'NONE_ACTIVE' &&
      (issueResolveHints[row.id]?.totalSuggestionCount ?? 0) === 0,
  );
  const issueImportRows =
    issueOnlyOneActiveFilter || issueOnlyMultipleActiveFilter || issueOnlyNoActiveFilter
      ? issueImportRowsBase.filter((row) => {
          if (row.reviewStatus !== 'UNRESOLVED') {
            return false;
          }
          const hint = issueResolveHints[row.id];
          const hintStatus = hint?.status;
          const hasSuggestions = (hint?.totalSuggestionCount ?? 0) > 0;
          return (
            (issueOnlyOneActiveFilter && hintStatus === 'ONE_ACTIVE') ||
            (issueOnlyMultipleActiveFilter && hintStatus === 'MULTIPLE_ACTIVE') ||
            (issueOnlyNoActiveFilter && hintStatus === 'NONE_ACTIVE' && hasSuggestions)
          );
        })
      : issueImportRowsBase;
  const visibleRecheckableIssueRows = issueImportRows.filter((row) => row.reviewStatus === 'UNRESOLVED');
  const selectedRecheckableIssueRows = visibleRecheckableIssueRows.filter((row) => selectedIssueImportIds.has(row.id));
  const selectedQuickResolvableIssueRows = selectedRecheckableIssueRows.filter((row) => {
    const hint = issueResolveHints[row.id];
    return Boolean(
      hint &&
        hint.quickResolvable &&
        hint.status === 'ONE_ACTIVE' &&
        hint.topSuggestionSymbol &&
        hint.topSuggestionExchange,
    );
  });
  const allRecheckableIssuesSelected =
    visibleRecheckableIssueRows.length > 0 &&
    selectedRecheckableIssueRows.length === visibleRecheckableIssueRows.length;
  const issueScanRows = visibleScanRows.filter((row) => row.scanStatus !== 'MATCHED');
  const unresolvedIssueHintIds = useMemo(
    () => recheckableIssueRows.map((row) => row.id),
    [recheckableIssueRows],
  );
  const unresolvedIssueHintPendingCount = unresolvedIssueHintIds.filter((id) => !issueResolveHints[id]).length;
  const issueHintFilterSummary = [
    issueOnlyOneActiveFilter ? 'Only 1 Active filter is on.' : null,
    issueOnlyMultipleActiveFilter ? 'Multiple Active filter is on.' : null,
    issueOnlyNoActiveFilter ? 'No Active filter is on.' : null,
  ]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!api || activeCorporateTab !== 'issues' || unresolvedIssueHintIds.length === 0) {
      return undefined;
    }

    const missingIds = unresolvedIssueHintIds.filter((id) => !issueResolveHints[id]);
    if (missingIds.length === 0) {
      return undefined;
    }

    let cancelled = false;
    void api
      .listCorporateActionImportResolutionHints({ importIds: missingIds })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setIssueResolveHints((current) => {
          const next = { ...current };
          for (const hint of result.hints) {
            next[hint.importId] = hint;
          }
          return next;
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeCorporateTab, api, issueResolveHints, unresolvedIssueHintIds]);

  const recheckSelectedIssueImports = async () => {
    if (!api) {
      return;
    }

    if (selectedRecheckableIssueRows.length === 0) {
      setStatus('Select at least one unresolved official import row first.');
      return;
    }

    setBusy(true);
    setStatus(`Rechecking ${selectedRecheckableIssueRows.length} unresolved official import row(s)...`);
    const selectedRows = selectedRecheckableIssueRows;

    try {
      const result = await api.recheckCorporateActionImports({
        importIds: selectedRows.map((row) => row.id),
      });
      await loadIssueImports(importLoadLimit);
      setSelectedIssueImportIds(new Set());
      if (selectedRows.some((row) => row.id === resolveImportId)) {
        clearResolveImport();
      }
      setStatus(result.message);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not recheck the selected official import rows.');
    } finally {
      setBusy(false);
    }
  };

  const quickResolveSelectedIssueImports = async () => {
    if (!api) {
      return;
    }

    if (selectedRecheckableIssueRows.length === 0) {
      setStatus('Select at least one unresolved official import row first.');
      return;
    }

    setBusy(true);
    setStatus(`Checking quick-resolution hints for ${selectedRecheckableIssueRows.length} selected row(s)...`);

    try {
      const hintResult = await api.listCorporateActionImportResolutionHints({
        importIds: selectedRecheckableIssueRows.map((row) => row.id),
      });
      const fetchedHints = Object.fromEntries(hintResult.hints.map((hint) => [hint.importId, hint]));
      setIssueResolveHints((current) => ({ ...current, ...fetchedHints }));

      const quickResolvableRows = selectedRecheckableIssueRows
        .map((row) => ({
          row,
          hint: fetchedHints[row.id] ?? issueResolveHints[row.id] ?? null,
        }))
        .filter(
          (entry): entry is { row: CorporateActionImportRow; hint: CorporateActionImportResolutionHint } =>
            Boolean(
              entry.hint &&
                entry.hint.quickResolvable &&
                entry.hint.status === 'ONE_ACTIVE' &&
                entry.hint.topSuggestionSymbol &&
                entry.hint.topSuggestionExchange,
            ),
        );

      if (quickResolvableRows.length === 0) {
        setStatus(
          `None of the ${selectedRecheckableIssueRows.length} selected unresolved row(s) has one active suggestion with exact event-date identity evidence.`,
        );
        return;
      }

      const failures: string[] = [];
      let resolvedCount = 0;
      for (const { row } of quickResolvableRows) {
        try {
          await api.quickResolveCorporateActionImport({
            importId: row.id,
          });
          resolvedCount += 1;
        } catch (error) {
          failures.push(`${row.symbol ?? row.isin ?? row.id}: ${getErrorMessage(error, 'Resolve failed.')}`);
        }
      }

      const rows = await api.listCorporateActionImports({
        limit: importLoadLimit,
        actionTypes: effectiveImportActionTypes,
        searchQuery: importSearchQuery.trim() || null,
        excludeApproved: true,
      });
      setLoadedImportRows(rows);
      setSelectedIssueImportIds(new Set());

      if (resolveImportId && quickResolvableRows.some(({ row }) => row.id === resolveImportId)) {
        clearResolveImport();
      }

      const skippedCount = selectedRecheckableIssueRows.length - quickResolvableRows.length;
      const failureSuffix = failures.length > 0 ? ` Failed ${failures.length}: ${failures.slice(0, 2).join('; ')}` : '';
      setStatus(
        `Quick-resolved ${resolvedCount}/${quickResolvableRows.length} selected row(s) with exact event-date identity evidence.${skippedCount > 0 ? ` Skipped ${skippedCount} row(s) that still need manual review.` : ''}${failureSuffix}`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not quick-resolve the selected official import rows.'));
    } finally {
      setBusy(false);
    }
  };

  const saveIssueImportsByHintAudit = async (
    mode: 'ONE_ACTIVE' | 'MULTIPLE_ACTIVE' | 'NO_ACTIVE' | 'NO_HINT',
  ) => {
    if (!api) {
      return;
    }

    const loadedUnresolvedRows = recheckableIssueRows;
    if (!issueExportAllMatching && loadedUnresolvedRows.length === 0) {
      setStatus('No unresolved official import rows are currently loaded.');
      return;
    }

    const modeLabel =
      mode === 'ONE_ACTIVE'
        ? '1 Active'
        : mode === 'MULTIPLE_ACTIVE'
          ? 'Multiple Active'
          : mode === 'NO_ACTIVE'
            ? 'No Active'
            : 'No Hint';
    setBusy(true);
    setIssueExportCancelAvailable(issueExportAllMatching);
    setIssueExportCancelRequested(false);
    setIssueExportProgressMessage(
      issueExportAllMatching
        ? `Starting ${modeLabel.toLowerCase()} export across all matching unresolved rows...`
        : '',
    );
    setIssueExportProgressState(
      issueExportAllMatching
        ? {
            pagesFetched: 0,
            unresolvedRowsFetched: 0,
            hintBatchesCompleted: 0,
            hintBatchesTotal: 0,
            matchingRowsToWrite: 0,
          }
        : null,
    );
    issueExportCancelRequestedRef.current = false;
    setStatus(
      issueExportAllMatching
        ? `Preparing ${modeLabel.toLowerCase()} audit export across all matching unresolved official import rows...`
        : `Preparing ${modeLabel.toLowerCase()} audit export for ${loadedUnresolvedRows.length} loaded unresolved official import row(s)...`,
    );

    try {
      const throwIfIssueExportCancelled = () => {
        if (issueExportCancelRequestedRef.current) {
          throw new Error(ISSUE_EXPORT_CANCELLED_MESSAGE);
        }
      };

      let fetchedPageCount = 0;
      const unresolvedRows = issueExportAllMatching
        ? await (async () => {
            const rows: CorporateActionImportRow[] = [];
            let offset = 0;
            while (true) {
              throwIfIssueExportCancelled();
              const page = await api.listCorporateActionImports(
                buildIssueImportListInput(CORPORATE_EXPORT_FETCH_PAGE_SIZE, offset),
              );
              if (page.length === 0) {
                break;
              }
              fetchedPageCount += 1;
              rows.push(...page.filter((row) => row.reviewStatus === 'UNRESOLVED'));
              setIssueExportProgressMessage(
                `Fetched ${rows.length} unresolved row(s) from ${fetchedPageCount} page(s).`,
              );
              setIssueExportProgressState((current) =>
                current
                  ? {
                      ...current,
                      pagesFetched: fetchedPageCount,
                      unresolvedRowsFetched: rows.length,
                    }
                  : current,
              );
              setStatus(
                `Preparing ${modeLabel.toLowerCase()} audit export across all matching unresolved official import rows... fetched ${rows.length} unresolved row(s) from ${fetchedPageCount} page(s).`,
              );
              throwIfIssueExportCancelled();
              if (page.length < CORPORATE_EXPORT_FETCH_PAGE_SIZE) {
                break;
              }
              offset += page.length;
            }
            return rows;
          })()
        : loadedUnresolvedRows;

      if (unresolvedRows.length === 0) {
        setStatus(
          issueExportAllMatching
            ? 'No matching unresolved official import rows were found for the current filters.'
            : 'No unresolved official import rows are currently loaded.',
        );
        return;
      }

      const fetchedHints: Record<number, CorporateActionImportResolutionHint> = {};
      if (issueExportAllMatching && unresolvedRows.length > CORPORATE_EXPORT_HINT_BATCH_SIZE) {
        const hintBatchesTotal = Math.ceil(unresolvedRows.length / CORPORATE_EXPORT_HINT_BATCH_SIZE);
        setIssueExportProgressState((current) =>
          current
            ? {
                ...current,
                hintBatchesTotal,
              }
            : current,
        );
        for (let start = 0; start < unresolvedRows.length; start += CORPORATE_EXPORT_HINT_BATCH_SIZE) {
          throwIfIssueExportCancelled();
          const batch = unresolvedRows.slice(start, start + CORPORATE_EXPORT_HINT_BATCH_SIZE);
          const completed = Math.min(start + batch.length, unresolvedRows.length);
          const completedBatches = Math.floor(start / CORPORATE_EXPORT_HINT_BATCH_SIZE) + 1;
          setIssueExportProgressMessage(
            `Built hint batches for ${completed}/${unresolvedRows.length} unresolved row(s).`,
          );
          setIssueExportProgressState((current) =>
            current
              ? {
                  ...current,
                  hintBatchesCompleted: completedBatches,
                  hintBatchesTotal,
                }
              : current,
          );
          setStatus(
            `Preparing ${modeLabel.toLowerCase()} audit export across all matching unresolved official import rows... built hint batches for ${completed}/${unresolvedRows.length} unresolved row(s).`,
          );
          const hintResult = await api.listCorporateActionImportResolutionHints({
            importIds: batch.map((row) => row.id),
          });
          Object.assign(
            fetchedHints,
            Object.fromEntries(hintResult.hints.map((hint) => [hint.importId, hint])),
          );
          throwIfIssueExportCancelled();
        }
      } else {
        throwIfIssueExportCancelled();
        setIssueExportProgressState((current) =>
          current
            ? {
                ...current,
                hintBatchesCompleted: unresolvedRows.length > 0 ? 1 : 0,
                hintBatchesTotal: unresolvedRows.length > 0 ? 1 : 0,
              }
            : current,
        );
        const hintResult = await api.listCorporateActionImportResolutionHints({
          importIds: unresolvedRows.map((row) => row.id),
        });
        Object.assign(
          fetchedHints,
          Object.fromEntries(hintResult.hints.map((hint) => [hint.importId, hint])),
        );
      }
      setIssueResolveHints((current) => ({ ...current, ...fetchedHints }));

      const matchingRows = unresolvedRows
        .map((row) => ({
          row,
          hint: fetchedHints[row.id] ?? issueResolveHints[row.id] ?? null,
        }))
        .filter(
          (entry): entry is { row: CorporateActionImportRow; hint: CorporateActionImportResolutionHint } =>
            Boolean(
              entry.hint &&
                ((mode === 'ONE_ACTIVE' && entry.hint.status === 'ONE_ACTIVE') ||
                  (mode === 'MULTIPLE_ACTIVE' && entry.hint.status === 'MULTIPLE_ACTIVE') ||
                  (mode === 'NO_ACTIVE' &&
                    entry.hint.status === 'NONE_ACTIVE' &&
                    entry.hint.totalSuggestionCount > 0) ||
                  (mode === 'NO_HINT' &&
                    entry.hint.status === 'NONE_ACTIVE' &&
                    entry.hint.totalSuggestionCount === 0)),
            ),
        );

      if (matchingRows.length === 0) {
        setStatus(
          issueExportAllMatching
            ? `None of the matching unresolved official import rows matches the ${modeLabel} hint bucket.`
            : `None of the currently loaded unresolved official import rows matches the ${modeLabel} hint bucket.`,
        );
        return;
      }

      if (issueExportAllMatching) {
        setIssueExportProgressMessage(`Writing ${matchingRows.length} matching row(s) to file...`);
        setIssueExportProgressState((current) =>
          current
            ? {
                ...current,
                matchingRowsToWrite: matchingRows.length,
              }
            : current,
        );
        setStatus(
          `Preparing ${modeLabel.toLowerCase()} audit export across all matching unresolved official import rows... writing ${matchingRows.length} matching row(s) to file.`,
        );
      }
      throwIfIssueExportCancelled();

      const exportLines = [
        [
          'Symbol',
          'Company',
          'ISIN',
          'Exchange',
          'Ex Date',
          'Type',
          'Review Status',
          'Hint',
          'Hint Message',
          'Active Suggestion Count',
          'Total Suggestion Count',
          'Top Suggestion',
          'Row Message',
        ].join('\t'),
        ...matchingRows.map(({ row, hint }) =>
          [
            row.symbol ?? '',
            row.companyName ?? '',
            row.isin ?? '',
            row.exchange,
            row.exDate ?? row.recordDate ?? '',
            row.actionType,
            row.reviewStatus,
            formatIssueResolveHintLabel(hint),
            hint.message,
            hint.activeSuggestionCount,
            hint.totalSuggestionCount,
            hint.topSuggestionSymbol && hint.topSuggestionExchange
              ? `${hint.topSuggestionExchange}:${hint.topSuggestionSymbol}`
              : '',
            row.message ?? row.purposeRaw,
          ]
            .map((value) => String(value ?? '').replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', ' '))
            .join('\t'),
        ),
      ];

      const result = await api.saveTextExport({
        title: `${modeLabel} Review Issues Export`,
        suggestedFileName: buildReviewIssueAuditFileName(mode),
        content: exportLines.join('\r\n'),
        defaultExtension: 'tsv',
        filterName: 'Tab-Separated Files',
        filterExtensions: ['tsv', 'csv'],
      });
      if (!result.success || !result.filePath) {
        setStatus(`Save cancelled. The ${modeLabel} audit export was not written to disk.`);
        return;
      }
      setStatus(
        issueExportAllMatching
          ? `Saved ${matchingRows.length} matching unresolved official import row(s) from the ${modeLabel} hint bucket to ${result.filePath}.`
          : `Saved ${matchingRows.length} loaded unresolved official import row(s) from the ${modeLabel} hint bucket to ${result.filePath}.`,
      );
    } catch (error) {
      if (error instanceof Error && error.message === ISSUE_EXPORT_CANCELLED_MESSAGE) {
        setStatus('Export cancelled. No file was written.');
      } else {
        setStatus(error instanceof Error ? error.message : `Could not save the ${modeLabel} issue rows.`);
      }
    } finally {
      setIssueExportCancelAvailable(false);
      setIssueExportCancelRequested(false);
      setIssueExportProgressMessage('');
      setIssueExportProgressState(null);
      issueExportCancelRequestedRef.current = false;
      setBusy(false);
    }
  };

  const quickResolveIssueImport = async (row: CorporateActionImportRow) => {
    if (!api) {
      return;
    }

    setBusy(true);
    setStatus(`Checking quick resolution candidates for ${row.symbol ?? row.isin ?? row.id}...`);

    try {
      const hintResult = await api.listCorporateActionImportResolutionHints({ importIds: [row.id] });
      const refreshedHint = hintResult.hints[0] ?? null;
      if (refreshedHint) {
        setIssueResolveHints((current) => ({ ...current, [row.id]: refreshedHint }));
      }

      if (refreshedHint?.quickResolvable) {
        const result = await api.quickResolveCorporateActionImport({ importId: row.id });
        const rows = await api.listCorporateActionImports({
          limit: importLoadLimit,
          actionTypes: effectiveImportActionTypes,
          searchQuery: importSearchQuery.trim() || null,
          excludeApproved: true,
        });
        setLoadedImportRows(rows);
        if (resolveImportId === row.id && result.importRecord.reviewStatus !== 'UNRESOLVED') {
          clearResolveImport();
        }
        setStatus(result.message);
        return;
      }

      startResolveImport(row);
      setStatus(
        `${refreshedHint?.message ?? 'No verified Quick Resolve hint is available.'} Opening the manual resolve workbench.`,
      );
    } catch (error) {
      setStatus(getErrorMessage(error, 'Could not quick-resolve the selected official import row.'));
    } finally {
      setBusy(false);
    }
  };

  const requestIssueExportCancel = () => {
    if (!issueExportCancelAvailable || issueExportCancelRequested) {
      return;
    }
    issueExportCancelRequestedRef.current = true;
    setIssueExportCancelRequested(true);
    setIssueExportProgressMessage('Cancelling after the current batch finishes. No file will be written.');
    setStatus('Cancelling export after the current batch finishes. No file will be written.');
  };

  const renderIssuesTab = () => (
    <div style={corporateActionPanelStyle}>
      <div style={reviewIssuesToolbarStyle}>
        <button type="button" style={modalButtonStyle} onClick={() => void loadIssueImports()} disabled={busy || !hasDatabase}>
          Load Imports
        </button>
        <button type="button" style={modalButtonStyle} onClick={() => void loadIssueImports(importLoadLimit + CORPORATE_IMPORT_LOAD_STEP)} disabled={busy || !hasDatabase}>
          More Imports
        </button>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => void recheckSelectedIssueImports()}
          disabled={busy || !hasDatabase || selectedRecheckableIssueRows.length === 0}
        >
          Recheck Selected
        </button>
        <button
          type="button"
          style={primaryButtonStyle}
          onClick={() => void quickResolveSelectedIssueImports()}
          disabled={busy || !hasDatabase || selectedRecheckableIssueRows.length === 0}
          title="Resolve only selected rows with one active suggestion and exact event-date identity evidence. Other selected rows stay untouched."
        >
          Quick Resolve Selected
        </button>
        <button
          type="button"
          style={modalButtonStyle}
          onClick={() => void saveIssueImportsByHintAudit('ONE_ACTIVE')}
          disabled={busy || !hasDatabase || (!issueExportAllMatching && recheckableIssueRows.length === 0)}
          title={
            issueExportAllMatching
              ? 'Save all matching unresolved rows whose hint is 1 Active as tab-separated audit text.'
              : 'Save the currently loaded unresolved rows whose hint is 1 Active as tab-separated audit text.'
          }
        >
          Save 1 Active
        </button>
        <button
          type="button"
          style={modalButtonStyle}
          onClick={() => void saveIssueImportsByHintAudit('MULTIPLE_ACTIVE')}
          disabled={busy || !hasDatabase || (!issueExportAllMatching && recheckableIssueRows.length === 0)}
          title={
            issueExportAllMatching
              ? 'Save all matching unresolved rows whose hint is Multiple Active as tab-separated audit text.'
              : 'Save the currently loaded unresolved rows whose hint is Multiple Active as tab-separated audit text.'
          }
        >
          Save Multiple
        </button>
        <button
          type="button"
          style={modalButtonStyle}
          onClick={() => void saveIssueImportsByHintAudit('NO_ACTIVE')}
          disabled={busy || !hasDatabase || (!issueExportAllMatching && recheckableIssueRows.length === 0)}
          title={
            issueExportAllMatching
              ? 'Save all matching unresolved rows whose hint is No Active as tab-separated audit text.'
              : 'Save the currently loaded unresolved rows whose hint is No Active as tab-separated audit text.'
          }
        >
          Save No Active
        </button>
        <button
          type="button"
          style={modalButtonStyle}
          onClick={() => void saveIssueImportsByHintAudit('NO_HINT')}
          disabled={busy || !hasDatabase || (!issueExportAllMatching && recheckableIssueRows.length === 0)}
          title={
            issueExportAllMatching
              ? 'Save all matching unresolved rows whose hint is No Hint as tab-separated audit text.'
              : 'Save the currently loaded unresolved rows whose hint is No Hint as tab-separated audit text.'
          }
        >
          Save No Hint
        </button>
        <button type="button" style={modalButtonStyle} onClick={() => void loadScanResults()} disabled={busy || !hasDatabase}>
          Load Scan
        </button>
        <button type="button" style={modalButtonStyle} onClick={() => void loadMoreScanResults()} disabled={busy || !hasDatabase}>
          More Scan
        </button>
        {issueExportCancelAvailable ? (
          <button
            type="button"
            style={modalButtonStyle}
            onClick={requestIssueExportCancel}
            disabled={issueExportCancelRequested}
            title="Cancel the current All matching export after the active fetch or hint batch completes."
          >
            {issueExportCancelRequested ? 'Cancelling...' : 'Cancel Export'}
          </button>
        ) : null}
      </div>
      <div style={corporateImportFilterRowStyle}>
        <span style={utilityFieldLabelStyle}>Export:</span>
        <label style={corporateImportFilterCheckboxStyle}>
          <input
            type="checkbox"
            checked={issueExportAllMatching}
            onChange={(event) => setIssueExportAllMatching(event.target.checked)}
          />
          <span title="When enabled, Save actions fetch every matching unresolved import row for the current type and search filters, not only the loaded page.">
            All matching
          </span>
        </label>
      </div>
      {issueExportProgressMessage ? (
        <div style={utilityHelperTextStyle}>
          <strong style={{ color: 'var(--text)' }}>Export Progress:</strong> {issueExportProgressMessage}
          {issueExportProgressState ? (
            <span style={corporateProgressBadgeRowStyle}>
              {issueExportProgressState.pagesFetched > 0 ? (
                <span style={corporateProgressBadgeStyle}>
                  {issueExportProgressState.pagesFetched} page{issueExportProgressState.pagesFetched === 1 ? '' : 's'}
                </span>
              ) : null}
              {issueExportProgressState.unresolvedRowsFetched > 0 ? (
                <span style={corporateProgressBadgeStyle}>
                  {issueExportProgressState.unresolvedRowsFetched} row{issueExportProgressState.unresolvedRowsFetched === 1 ? '' : 's'}
                </span>
              ) : null}
              {issueExportProgressState.hintBatchesTotal > 0 ? (
                <span style={corporateProgressBadgeStyle}>
                  {issueExportProgressState.hintBatchesCompleted}/{issueExportProgressState.hintBatchesTotal} hint batch
                  {issueExportProgressState.hintBatchesTotal === 1 ? '' : 'es'}
                </span>
              ) : null}
              {issueExportProgressState.matchingRowsToWrite > 0 ? (
                <span style={corporateProgressBadgeStyle}>
                  {issueExportProgressState.matchingRowsToWrite} match
                  {issueExportProgressState.matchingRowsToWrite === 1 ? '' : 'es'}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
      ) : null}
      {renderImportActionTypeFilters()}
      <div style={corporateImportFilterRowStyle}>
        <span style={utilityFieldLabelStyle}>Hint:</span>
        <label style={corporateImportFilterCheckboxStyle}>
          <input
            type="checkbox"
            checked={issueOnlyOneActiveFilter}
            onChange={(event) => setIssueOnlyOneActiveFilter(event.target.checked)}
          />
          <span>Only 1 Active</span>
        </label>
        <label style={corporateImportFilterCheckboxStyle}>
          <input
            type="checkbox"
            checked={issueOnlyMultipleActiveFilter}
            onChange={(event) => setIssueOnlyMultipleActiveFilter(event.target.checked)}
          />
          <span>Multiple Active</span>
        </label>
        <label style={corporateImportFilterCheckboxStyle}>
          <input
            type="checkbox"
            checked={issueOnlyNoActiveFilter}
            onChange={(event) => setIssueOnlyNoActiveFilter(event.target.checked)}
          />
          <span title="No Active means the current suggestion path found no active current symbol yet. It does not prove the company is unlisted.">
            No Active
          </span>
        </label>
      </div>
      {issueOnlyNoActiveFilter ? (
        <div style={utilityHelperTextStyle}>
          <strong style={{ color: 'var(--text)' }}>No Active</strong> means the current suggestion path found no
          active current symbol for that unresolved row. Common causes: only inactive related aliases were found,
          identity history is incomplete, or no structured suggestion path exists yet. It does not prove the company
          is unlisted.
        </div>
      ) : null}
      {renderSearchBar(
        'Import Filter:',
        importSearchQuery,
        setImportSearchQuery,
        () => applyCurrentSymbolFilter(setImportSearchQuery, importExchange),
      )}
      {renderSearchBar(
        'Scan Filter:',
        scanSearchQuery,
        setScanSearchQuery,
        () => applyCurrentSymbolFilter(setScanSearchQuery, activeInstrument?.exchange ?? null),
        'Filter scan rows by symbol or message',
      )}
      <div style={utilityStatusStyle}>
        {status ||
          `Review unresolved official rows and scan mismatches before approving anything. This tab does not refresh automatically; use Load Imports and Load Scan manually. Selected ${selectedRecheckableIssueRows.length}/${visibleRecheckableIssueRows.length} visible unresolved import row(s); ${selectedQuickResolvableIssueRows.length} have verified event-date identity evidence. Hint summary: verified quick ${issueQuickResolvableRows.length}/${recheckableIssueRows.length}; multiple active ${issueMultipleActiveRows.length}/${recheckableIssueRows.length}; no active ${issueNoActiveRows.length}/${recheckableIssueRows.length}; no hint ${issueNoHintRows.length}/${recheckableIssueRows.length}.${issueHintFilterSummary ? ` ${issueHintFilterSummary}` : ''}${unresolvedIssueHintPendingCount > 0 ? ` Still checking ${unresolvedIssueHintPendingCount} unresolved row hint(s).` : ''}`}
      </div>
      <div
        style={{
          ...corporateImportTableStyle,
          display: resolveTargetRow ? 'none' : 'flex',
        }}
      >
        <div style={corporateIssueHeaderStyle}>
          <span>
            <input
              type="checkbox"
              checked={allRecheckableIssuesSelected}
              disabled={busy || visibleRecheckableIssueRows.length === 0}
              onChange={(event) => toggleAllRecheckableIssues(event.target.checked)}
              title="Select all unresolved rows for auto recheck"
            />
          </span>
          <span>Source</span>
          <span>Symbol/ISIN</span>
          <span>Type</span>
          <span>Status</span>
          <span>Message</span>
          <span />
        </div>
        <div style={quotesBodyStyle}>
          {issueImportRows.map((row) => {
            const canResolve = row.reviewStatus === 'UNRESOLVED';
            const resolveHint = canResolve ? issueResolveHints[row.id] : null;
            const eventIdentity = eventIdentityByImportId[row.id] ?? null;
            return (
              <div key={row.id} style={corporateIssueRowStyle}>
                <span style={corporateCellStyle}>
                  <input
                    type="checkbox"
                    checked={canResolve && selectedIssueImportIds.has(row.id)}
                    disabled={busy || !canResolve}
                    onChange={(event) => toggleIssueImportSelection(row.id, event.target.checked)}
                    title={canResolve ? 'Select for auto recheck' : 'Only unresolved rows can be selected for auto recheck'}
                  />
                </span>
                <span style={corporateEvidenceSourceCellStyle} title={formatCorporateImportEvidenceTitle(row)}>
                  <span>{row.source}</span>
                  <span style={corporateIssueHintTextStyle}>{formatCorporateImportEvidenceBadge(row)}</span>
                </span>
                <span style={corporateEvidenceSourceCellStyle} title={eventIdentity?.resolved ? formatCorporateActionEventIdentityTitle(eventIdentity) : undefined}>
                  <span>{row.symbol ?? row.isin ?? '-'}</span>
                  {eventIdentity?.resolved ? (
                    <span style={corporateIssueHintTextStyle}>
                      {formatCorporateActionEventIdentityLabel(eventIdentity)}
                    </span>
                  ) : null}
                </span>
                <span style={corporateCellStyle}>{row.actionType}</span>
                <span style={corporateCellStyle} aria-label={importStatusMeaning(row.reviewStatus)}>{row.reviewStatus}</span>
                <span style={corporatePurposeCellStyle} title={row.message ?? row.purposeRaw}>{row.message ?? row.purposeRaw}</span>
                <div style={corporateIssueActionCellStyle}>
                  <button
                    type="button"
                    style={modalButtonStyle}
                    onClick={() => (canResolve ? void quickResolveIssueImport(row) : undefined)}
                    disabled={busy || !canResolve}
                    title={
                      canResolve
                        ? resolveHint?.message ??
                          'Checking quick-resolve suggestions. Direct resolution requires one active current symbol plus exact event-date identity evidence; otherwise the manual workbench opens.'
                        : undefined
                    }
                  >
                    {canResolve ? 'Quick Resolve' : 'View'}
                  </button>
                  {canResolve ? (
                    <span
                      style={corporateIssueHintTextStyle}
                      title={formatIssueResolveHintTitle(resolveHint)}
                    >
                      {formatIssueResolveHintLabel(resolveHint)}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
          {issueImportRows.length === 0 ? (
            <div style={corporateEmptyStateStyle}>
              {importRows.length > 0
                ? issueOnlyOneActiveFilter && issueOnlyMultipleActiveFilter && issueOnlyNoActiveFilter
                  ? 'No unresolved import issue rows with suggestion hints match the current filter.'
                  : issueOnlyOneActiveFilter && issueOnlyMultipleActiveFilter
                    ? 'No unresolved import issue rows with active-suggestion hints match the current filter.'
                    : issueOnlyOneActiveFilter && issueOnlyNoActiveFilter
                      ? 'No unresolved import issue rows with one-active or no-active suggestion hints match the current filter.'
                      : issueOnlyMultipleActiveFilter && issueOnlyNoActiveFilter
                        ? 'No unresolved import issue rows with multiple-active or no-active suggestion hints match the current filter.'
                        : issueOnlyOneActiveFilter
                    ? 'No unresolved import issue rows with exactly one active suggestion match the current filter.'
                    : issueOnlyMultipleActiveFilter
                      ? 'No unresolved import issue rows with multiple active suggestions match the current filter.'
                      : issueOnlyNoActiveFilter
                        ? 'No unresolved import issue rows with no active suggested current symbol match the current filter.'
                      : 'No import issue rows match the current filter.'
                : 'No import issue rows loaded.'}
            </div>
          ) : null}
        </div>
      </div>
      {renderResolvePanel()}
      {!resolveTargetRow
        ? renderCorporateScanTable(
            issueScanRows,
            scanRows.length > 0 && issueScanRows.length === 0 ? 'No issue scan rows match the current filter.' : 'No scan rows loaded.',
          )
        : null}
    </div>
  );

  return (
    <FloatingWindow id={CORPORATE_ACTIONS_WINDOW_ID} onClose={handleClose}>
      <div style={{...corporateActionShellStyle,gap:0}}>
        <nav className="ca-classic-menubar" aria-label="Corporate Actions menu">
          <CorporateActionClassicMenu label="Actions" items={[
            {label:'Return to review queue',disabled:busy,onClick:showClassicQueue},
            {label:'Fetch official actions',disabled:busy||showingApprovedImports||!hasDatabase||!fetchFromDate||!fetchToDate||fetchFromDate>fetchToDate,onClick:()=>void fetchOfficialActions()},
            {label:'Load & Validate',disabled:busy||showingApprovedImports||!hasDatabase,onClick:()=>{showClassicQueue();void loadAndPrepareOfficialImports();}},
            {label:'Load more approved actions',disabled:busy||!hasDatabase||!showingApprovedImports,onClick:()=>void loadMoreOfficialImports()},
          ]} />
          <CorporateActionClassicMenu label="View" items={[
            {label:'Pending actions',disabled:busy,onClick:()=>{showClassicQueue();void switchOfficialImportView('review');}},
            {label:'Approved actions',disabled:busy,onClick:()=>{showClassicQueue();void switchOfficialImportView('approved');}},
            {label:'Clear all filters',onClick:()=>{clearClassicSelection();setClassicFilterResetKey(key=>key+1);setClassicTypeFilters([...CLASSIC_ACTION_TYPES]);setSelectedImportActionTypes([...CORPORATE_IMPORT_FILTER_TYPES]);setOfficialReviewSymbolFilter('ALL');setOfficialSafeV2SkippedOnly(false);updateOfficialImportSearchQuery('');}},
          ]} />
          <CorporateActionClassicMenu label="Reports" items={[
            {label:'Pending actions by type',onClick:()=>setClassicReport('types')},
            {label:'Dividend verification reasons',onClick:()=>{setClassicReport('dividends');void openSavedValidationHistory();}},
            {label:'Activity and validation details',onClick:()=>{setClassicReport('activity');void openSavedValidationHistory();}},
            {label:'Recent approved actions',disabled:busy||!hasDatabase||recentApprovalsLoading,onClick:()=>void openRecentApprovals()},
            {label:'Reconciliation / Export CSV-TXT',disabled:busy||!hasDatabase,onClick:()=>setReconciliationOpen(true)},
          ]} />
          <CorporateActionClassicMenu label="Tools" items={[
            {label:'Manual Entry',disabled:busy,onClick:()=>setActiveCorporateTab('manual')},
            {label:'Identity Import',disabled:busy,onClick:()=>setActiveCorporateTab('identity')},
            {label:'Official source settings / CSV import',disabled:busy,onClick:()=>{setActiveCorporateTab('imports');setActiveOfficialImportSection('fetch');}},
            {label:'Historical Backfill',disabled:busy,onClick:()=>{setActiveCorporateTab('imports');setActiveOfficialImportSection('history');}},
            {label:'Scan Database',disabled:busy,onClick:()=>setActiveCorporateTab('scan')},
            {label:'Review Issues',disabled:busy,onClick:()=>setActiveCorporateTab('issues')},
            {label:'Advanced review workspace',disabled:busy,onClick:()=>{if(activeOfficialImportView==='review')restorePendingReview();setActiveCorporateTab('imports');setActiveOfficialImportSection('review');setClassicReview(false);}},
          ]} />
          <CorporateActionClassicMenu label="Help" items={[{label:'Corporate Actions workflow',onClick:()=>setClassicReport('help')}]} />
          {activeCorporateTab!=='imports'||activeOfficialImportSection!=='review'||!classicReview?<span className="ca-classic-active-tool">Advanced tools · <button type="button" disabled={busy} onClick={showClassicQueue}>Return to queue</button></span>:null}
        </nav>
        {activeCorporateTab === 'manual' ? renderManualTab() : null}
        {activeCorporateTab === 'identity' ? renderIdentityTab() : null}
        {activeCorporateTab === 'imports' ? classicReview && activeOfficialImportSection === 'review' ? renderClassicImports() : renderImportsTab() : null}
        {activeCorporateTab === 'scan' ? renderScanTab() : null}
        {activeCorporateTab === 'issues' ? renderIssuesTab() : null}
        {classicReview && activeCorporateTab==='imports' && activeOfficialImportSection==='review' && officialApprovalConfirmation ?
          <CorporateActionClassicDialog title="Confirm Corporate Action approval" onClose={()=>{if(!busy)setOfficialApprovalConfirmation(null);}}>
            <p>Approve {officialApprovalConfirmation.importIds.length} Ready action(s) from {officialApprovalConfirmation.scopeLabel}.</p>
            <p>Only these reviewed actions will be submitted. The app rechecks the active database, source evidence and prices before writing.</p>
            <p>Ready does not mean approved. Charts refresh after a successful approval.</p>
            <div style={buttonRowStyle}><button type="button" disabled={busy} onClick={()=>setOfficialApprovalConfirmation(null)}>Cancel</button>
              <button type="button" disabled={busy} onClick={()=>void confirmOfficialImportApproval()}>Approve reviewed actions</button></div>
          </CorporateActionClassicDialog>:null}
        {classicReport ? <CorporateActionClassicDialog title={classicReport==='types'?'Pending actions by type':classicReport==='dividends'?'Dividend verification reasons':classicReport==='approved'?'Recent approved actions':classicReport==='help'?'Corporate Actions workflow':'Activity and validation details'} onClose={()=>setClassicReport(null)}>
          {lastScanReport && (busy || !officialPreparationComplete || showingApprovedImports) && classicReport !== 'approved' && classicReport !== 'help' ? <p role="status">Last scan: {formatApprovalTime(lastScanReport.at)}. Historical report only — counts may have changed; Load & Validate before approval.</p> : null}
          {approvalFailureReport && classicReport !== 'help' ? <p role="alert">Last approval failure ({formatApprovalTime(approvalFailureReport.at)}): {approvalFailureReport.message}</p> : null}
          {validationHistoryWarning && classicReport !== 'approved' && classicReport !== 'help' ? <p role="alert">Validation history warning: {validationHistoryWarning}</p> : null}
          {classicReport==='types'?pendingReportSummary?<>
            <p>All loaded pending actions. Ready requires explicit approval; informational announcements require no adjustment.</p>
            <table><thead><tr><th>Type</th><th>Not approved</th><th>Ready</th><th>Blocked</th><th>Informational</th><th>Later</th></tr></thead>
              <tbody>{[...pendingReportSummary.rows,{actionType:'TOTAL',...pendingReportSummary.totals}].map(item=><tr key={item.actionType}><th scope="row">{item.actionType}</th><td>{item.pending}</td><td>{item.ready}</td><td>{item.blocked}</td><td>{item.informational}</td><td>{item.later}</td></tr>)}</tbody></table>
            <details><summary>Copyable type report</summary><textarea aria-label="All CA pending type report" readOnly value={formatCaPendingTypeReport(pendingReportSummary)} /></details>
          </>:<p>Load & Validate to prepare the pending summary.</p>:null}
          {classicReport==='dividends'?<>
            <OfficialDividendPreparedScopeOutcomeSummary outcome={reportDividendOutcome} />
            <SavedCorporateActionValidationHistory history={savedValidationHistoryReport}
              loading={savedValidationHistoryLoading} onRefresh={()=>void openSavedValidationHistory()}
              onLoadMore={()=>void openSavedValidationHistory(true)} />
          </>:null}
          {classicReport==='activity'?<>
            <p>{status||pendingCompactMessage}</p>
            {officialTaskProgress?<OfficialImportTaskStatus progress={officialTaskProgress} canCancel={officialCanCancelPreparation} onCancel={()=>{officialCancelPreparationRef.current=true;setOfficialCanCancelPreparation(false);}} />:null}
            <OfficialSafeV2OutcomeSummary result={currentOfficialAutoApproval} />
            <OfficialDividendPreparedScopeOutcomeSummary outcome={reportDividendOutcome} />
            <SavedCorporateActionValidationHistory history={savedValidationHistoryReport}
              loading={savedValidationHistoryLoading} onRefresh={()=>void openSavedValidationHistory()}
              onLoadMore={()=>void openSavedValidationHistory(true)} />
            <pre style={{whiteSpace:'pre-wrap'}}>{officialFetchLog.join('\n')}</pre>
          </>:null}
          {classicReport==='approved'?<>
            <p>Saved approvals, newest approval first (not ex-date), loaded {APPROVAL_HISTORY_PAGE_SIZE} at a time. Independent of pending filters. This is saved action history, not a reconstructed batch receipt. Refresh to include approvals made since opening this report.</p>
            <div style={buttonRowStyle}>
              <button type="button" disabled={busy||recentApprovalsLoading||!hasDatabase} onClick={()=>void openRecentApprovals()}>Refresh history</button>
              <button type="button" disabled={busy||recentApprovalsLoading||!recentApprovalReport?.hasMore} onClick={()=>void openRecentApprovals(true)}>Load more approved actions</button>
              <span>Shown {recentApprovalReport?.rows.length ?? 0} saved approvals</span>
            </div>
            {recentApprovalsLoading ? <p role="status">Loading saved approvals…</p> : null}
            {recentApprovalReport?.error ? <p role="alert">{recentApprovalReport.error} Previously loaded rows are retained; retry Load more or Refresh.</p> : null}
            {recentApprovalReport?.rows.length ?
              <table><thead><tr><th>Approved at</th><th>Exchange</th><th>Symbol</th><th>Action</th><th>Ex-date</th><th>Import ID</th></tr></thead>
                <tbody>{recentApprovalReport.rows.map(row=><tr key={row.id}><td>{formatApprovalTime(row.approvedAt)}</td><td>{row.exchange}</td><td>{row.symbol ?? 'Unmatched'}</td><td>{row.actionType}</td><td>{row.exDate ?? '—'}</td><td>{row.id}</td></tr>)}</tbody></table>
              : !recentApprovalsLoading && !recentApprovalReport?.error ? <p>No saved approved actions loaded for this database.</p> : null}
            {recentApprovalReport && !recentApprovalReport.hasMore && !recentApprovalReport.error && !recentApprovalsLoading ? <p>End of saved approval history.</p> : null}
          </>:null}
          {classicReport==='help'?<><p>Fetch from Officials → Load & Validate → explicitly Approve Ready.</p><p>Fetch dates apply to source collection. The pending view contains all loaded, unapproved actions; Type, Status and Find filter this table.</p><p>Select Ready actions using the checkboxes. Approve opens a separate confirmation. Checking, waiting, informational and blocked actions cannot be selected for approval.</p><p>Use Details for official evidence and price checks. Reports and Tools retain diagnostics and advanced maintenance. Use Ctrl+F to search; focus the table and use arrow keys, Space to select a Ready event, or Enter to inspect it.</p></>:null}
        </CorporateActionClassicDialog>:null}
        {reconciliationOpen && api && classicReview ? <CorporateActionClassicDialog title="Reconciliation / Export CSV-TXT" onClose={()=>setReconciliationOpen(false)}>
          <CorporateActionReconciliationPanel api={api} databasePath={activeDatabasePath} importIds={visibleImportRows.map(row=>row.id)}
            generation={officialPreparationGenerationRef.current} scopeRevision={importRows} onClose={()=>setReconciliationOpen(false)} />
        </CorporateActionClassicDialog>:null}
      </div>
    </FloatingWindow>
  );
}
function renderCorporateScanTable(rows: CorporateActionScanResultRow[], emptyMessage = 'No scan rows loaded.') {
  return (
    <div style={corporateImportTableStyle}>
      <div style={corporateScanHeaderStyle}>
        <span>Instrument</span>
        <span>Dates</span>
        <span>Prev / Theory</span>
        <span>Ex Open / Close</span>
        <span>Factors</span>
        <span>Residual</span>
        <span>Validation</span>
        <span>Message</span>
      </div>
      <div style={quotesBodyStyle}>
        {rows.map((row) => {
          const theoretical = getTheoreticalExPrice(row.prevClose, getCorporateActionEffectiveValidationFactor(row));
          const openResidual = getResidualGapPct(row.exOpen, theoretical);
          const closeResidual = getResidualGapPct(row.exClose, theoretical);
          return (
            <div key={row.id || `${row.scanRunId}-${row.corporateActionImportId}`} style={corporateScanRowStyle}>
              <span style={corporateCellStyle}>{row.symbol ? `${row.exchange}:${row.symbol}` : '-'}</span>
              <span style={corporateEvidenceSourceCellStyle}>
                <span>{row.prevTradeDate ?? '-'}</span>
                <span style={corporateIssueHintTextStyle}>{row.exTradeDate ?? '-'}</span>
              </span>
              <span style={corporateEvidenceSourceCellStyle}>
                <span>{formatCorporatePrice(row.prevClose)}</span>
                <span style={corporateIssueHintTextStyle}>Theory {formatCorporatePrice(theoretical)}</span>
              </span>
              <span style={corporateEvidenceSourceCellStyle}>
                <span>{formatCorporatePrice(row.exOpen)}</span>
                <span style={corporateIssueHintTextStyle}>Close {formatCorporatePrice(row.exClose)}</span>
              </span>
              <span style={corporateEvidenceSourceCellStyle}>
                <span>Expected ×{row.expectedFactor?.toFixed(4) ?? '-'}</span>
                <span style={corporateIssueHintTextStyle}>Observed ×{row.actualOpenFactor?.toFixed(4) ?? row.actualCloseFactor?.toFixed(4) ?? '-'}</span>
              </span>
              <span style={corporateEvidenceSourceCellStyle}>
                <span>Open {formatCorporatePercent(openResidual)}</span>
                <span style={corporateIssueHintTextStyle}>Close {formatCorporatePercent(closeResidual)}</span>
              </span>
              <span style={corporateEvidenceSourceCellStyle}>
                <span>{row.scanStatus}</span>
                <span style={corporateIssueHintTextStyle}>Confidence {formatCorporateConfidence(row.confidence)}</span>
              </span>
              <span style={corporatePurposeCellStyle} title={row.message ?? ''}>{row.message ?? '-'}</span>
            </div>
          );
        })}
        {rows.length === 0 ? <div style={corporateEmptyStateStyle}>{emptyMessage}</div> : null}
      </div>
    </div>
  );
}

function officialImportGroupKey(row: CorporateActionImportRow): string {
  return `${row.exchange}:${row.symbol ?? row.isin ?? `UNRESOLVED-${row.id}`}`;
}

function officialImportGroupLabel(row: CorporateActionImportRow): string {
  const identity = row.symbol ?? row.isin ?? `Unresolved #${row.id}`;
  return `${row.exchange}:${identity}${row.companyName ? ` · ${row.companyName}` : ''}`;
}

function corporateActionApprovalFingerprint(
  row: CorporateActionImportRow,
  scan?: CorporateActionScanResultRow,
): string {
  return JSON.stringify({
    id: row.id,
    exchange: row.exchange,
    symbol: row.symbol,
    isin: row.isin,
    companyName: row.companyName,
    source: row.source,
    sourceFile: row.sourceFile,
    actionType: row.actionType,
    purposeRaw: row.purposeRaw,
    exDate: row.exDate,
    recordDate: row.recordDate,
    ratioNum: row.ratioNum,
    ratioDen: row.ratioDen,
    oldFaceValue: row.oldFaceValue,
    newFaceValue: row.newFaceValue,
    cashAmount: row.cashAmount,
    factor: row.factor,
    priceFactor: row.priceFactor,
    parseStatus: row.parseStatus,
    reviewStatus: row.reviewStatus,
    evidenceCount: row.evidenceCount,
    evidenceSources: row.evidenceSources,
    evidenceCapturedAt: row.latestEvidenceCapturedAt,
    evidenceLocator: row.latestEvidenceSourceLocator,
    scanStatus: scan?.scanStatus ?? null,
    expectedFactor: scan?.expectedFactor ?? null,
    scanTimestamp: scan?.scannedAt ?? null,
  });
}

function formatCorporatePrice(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '-' : `₹${value.toFixed(2)}`;
}

function formatCorporatePercent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatCorporateConfidence(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? '-' : `${(value * 100).toFixed(2)}%`;
}

function matchesCorporateImportSearch(row: CorporateActionImportRow, query: string): boolean {
  return corporateActionSearchRank(row, query) != null;
}

function formatCorporateImportEvidenceSummary(row: CorporateActionImportRow): string {
  if (row.evidenceCount === 0) {
    return 'No source-evidence record is attached to this import row.';
  }
  const sources = row.evidenceSources.length > 0 ? row.evidenceSources.join(', ') : 'unspecified source';
  const capturedAt = row.latestEvidenceCapturedAt ? ` Latest capture: ${row.latestEvidenceCapturedAt}.` : '';
  return `${row.evidenceCount} evidence record(s) from ${sources}.${capturedAt}`;
}

function formatCorporateImportEvidenceBadge(row: CorporateActionImportRow): string {
  if (row.evidenceCount === 0) {
    return 'No evidence';
  }
  const sources = row.evidenceSources.length > 0 ? ` · ${row.evidenceSources.join(', ')}` : '';
  return `${row.evidenceCount} evidence${sources}`;
}

function formatCorporateImportEvidenceTitle(row: CorporateActionImportRow): string {
  return [
    formatCorporateImportEvidenceSummary(row),
    row.latestEvidenceSourceLocator ? `Latest locator: ${row.latestEvidenceSourceLocator}` : null,
    row.latestEvidenceNote ? `Latest note: ${row.latestEvidenceNote}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

function matchesCorporateScanSearch(row: CorporateActionScanResultRow, query: string): boolean {
  return [row.symbol, row.exchange, row.message]
    .filter(Boolean)
    .some((value) => value!.toUpperCase().includes(query));
}

function instrumentCandidateKey(candidate: { symbol: string; exchange: string }): string {
  return `${candidate.exchange}:${candidate.symbol}`;
}

function buildReviewIssueAuditFileName(
  mode: 'ONE_ACTIVE' | 'MULTIPLE_ACTIVE' | 'NO_ACTIVE' | 'NO_HINT',
): string {
  const now = new Date();
  const pad = (value: number) => value.toString().padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const slug =
    mode === 'ONE_ACTIVE'
      ? '1-active'
      : mode === 'MULTIPLE_ACTIVE'
        ? 'multiple-active'
        : mode === 'NO_ACTIVE'
          ? 'no-active'
          : 'no-hint';
  return `review-issues-${slug}-${timestamp}.tsv`;
}

function formatHistoricalBackfillStatus(
  result: HistoricalCapitalActionBackfillResult,
  options: {
    focusedSymbol: string;
    requestedBseScripCode?: string | null;
  },
): string {
  const messages = [result.message, `Focused review queue on ${options.focusedSymbol}.`, 'Updated the Historical Backfill Result panel.'];
  if (!options.requestedBseScripCode && result.bseScripCode) {
    messages.push(`Used inferred BSE scrip code ${result.bseScripCode}.`);
  }
  if (result.warnings.length > 0) {
    messages.push(`${result.warnings.length} warning(s).`);
  }
  if (result.errors.length > 0) {
    messages.push(`${result.errors.length} error(s).`);
  }
  return messages.join(' ');
}

function parseHistoricalBackfillBatchSymbols(value: string): string[] {
  const seen = new Set<string>();
  const symbols: string[] = [];
  value
    .split(/[\s,;]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean)
    .forEach((symbol) => {
      if (!seen.has(symbol)) {
        seen.add(symbol);
        symbols.push(symbol);
      }
    });
  return symbols;
}

function formatHistoricalBatchBackfillStatus(result: HistoricalCapitalActionBackfillBatchResult): string {
  const parts = [
    result.message,
    `Run ${result.runId ?? '-'}: ${result.completedSymbols}/${result.totalSymbols} completed.`,
    `Added ${result.rowsInserted}, evidence ${result.rowsEvidenceAttached}, duplicate ${result.rowsDuplicate}.`,
  ];
  if (result.failedSymbols > 0) {
    parts.push(`${result.failedSymbols} symbol(s) failed.`);
  }
  if (result.stoppedOnError) {
    parts.push('Stopped on first error.');
  }
  return parts.join(' ');
}

function HistoricalBackfillResultPanel({
  result,
}: {
  result: HistoricalCapitalActionBackfillResult;
}) {
  const searchedSymbolsLabel = result.searchedSymbols.length > 0 ? result.searchedSymbols.join(', ') : 'None';

  return (
    <div style={historicalBackfillResultPanelStyle}>
      <div style={historicalBackfillHeaderRowStyle}>
        <div style={historicalBackfillTitleBlockStyle}>
          <div style={quotePanelTitleStyle}>Historical Backfill Result</div>
          <div style={utilityHelperTextStyle}>
            {result.exchange}:{result.requestedSymbol} | {result.fromDate} to {result.toDate}
            {result.canonicalSymbol && result.canonicalSymbol !== result.requestedSymbol
              ? ` | Canonical: ${result.canonicalSymbol}`
              : ''}
          </div>
          <div style={utilityHelperTextStyle}>{result.message}</div>
        </div>
        <div style={historicalBackfillSummaryBadgeWrapStyle}>
          {renderHistoricalBackfillSummaryBadge('Searched', String(result.searchedSymbols.length), searchedSymbolsLabel)}
          {renderHistoricalBackfillSummaryBadge('BSE', result.bseScripCode ?? 'NSE only')}
          {renderHistoricalBackfillSummaryBadge('Read', String(result.rowsRead))}
          {renderHistoricalBackfillSummaryBadge('Added', String(result.rowsInserted))}
          {renderHistoricalBackfillSummaryBadge('Dup', String(result.rowsDuplicate))}
          {renderHistoricalBackfillSummaryBadge('Evidence', String(result.rowsEvidenceAttached))}
          {renderHistoricalBackfillSummaryBadge('Errors', String(result.rowsError))}
        </div>
      </div>
      <div style={historicalBackfillAliasesTextStyle} title={searchedSymbolsLabel}>
        Aliases searched: {searchedSymbolsLabel}
      </div>
      <div style={historicalBackfillAttemptTableStyle}>
        <div style={historicalBackfillAttemptHeaderStyle}>
          <span>Source</span>
          <span>Symbol / Context</span>
          <span>Read</span>
          <span>Added</span>
          <span>Dup</span>
          <span>Evid.</span>
          <span>Error</span>
          <span>Ex-Date Range</span>
          <span>Summary</span>
        </div>
        <div style={quotesBodyStyle}>
          {result.sourceAttempts.length > 0 ? (
            result.sourceAttempts.map((attempt, index) => (
              <div
                key={`${attempt.source}-${attempt.requestedSymbol ?? 'none'}-${attempt.sourceLocator ?? 'none'}-${index}`}
                style={historicalBackfillAttemptRowStyle}
              >
                <span style={corporateCellStyle}>{attempt.source}</span>
                <span style={historicalBackfillContextCellStyle} title={buildHistoricalBackfillContextTitle(attempt)}>
                  <span style={corporateCellStyle}>{attempt.requestedSymbol ?? '-'}</span>
                  {attempt.sourceLocator ? (
                    <span style={historicalBackfillLocatorTextStyle}>{attempt.sourceLocator}</span>
                  ) : null}
                </span>
                <span style={historicalBackfillNumericCellStyle}>{attempt.rowsRead}</span>
                <span style={historicalBackfillNumericCellStyle}>{attempt.rowsInserted}</span>
                <span style={historicalBackfillNumericCellStyle}>{attempt.rowsDuplicate}</span>
                <span style={historicalBackfillNumericCellStyle}>{attempt.rowsEvidenceAttached}</span>
                <span style={historicalBackfillNumericCellStyle}>{attempt.rowsError}</span>
                <span style={corporateCellStyle}>{formatHistoricalBackfillDateRange(attempt)}</span>
                <span style={historicalBackfillSummaryCellStyle} title={attempt.message}>
                  {attempt.message}
                </span>
              </div>
            ))
          ) : (
            <div style={corporateEmptyStateStyle}>No per-source attempt details were returned by the pilot.</div>
          )}
        </div>
      </div>
      {result.warnings.length > 0 ? <HistoricalBackfillMessageBlock title="Warnings" messages={result.warnings} /> : null}
      {result.errors.length > 0 ? <HistoricalBackfillMessageBlock title="Errors" messages={result.errors} /> : null}
    </div>
  );
}

function HistoricalBackfillBatchResultPanel({
  result,
}: {
  result: HistoricalCapitalActionBackfillBatchResult;
}) {
  return (
    <div style={historicalBackfillResultPanelStyle}>
      <div style={historicalBackfillHeaderRowStyle}>
        <div style={historicalBackfillTitleBlockStyle}>
          <div style={quotePanelTitleStyle}>Historical Batch Result</div>
          <div style={utilityHelperTextStyle}>
            Run {result.runId ?? '-'} | {result.exchange} | {result.fromDate} to {result.toDate}
          </div>
          <div style={utilityHelperTextStyle}>{result.message}</div>
        </div>
        <div style={historicalBackfillSummaryBadgeWrapStyle}>
          {renderHistoricalBackfillSummaryBadge('Symbols', `${result.completedSymbols}/${result.totalSymbols}`)}
          {renderHistoricalBackfillSummaryBadge('Failed', String(result.failedSymbols))}
          {renderHistoricalBackfillSummaryBadge('Added', String(result.rowsInserted))}
          {renderHistoricalBackfillSummaryBadge('Evidence', String(result.rowsEvidenceAttached))}
          {renderHistoricalBackfillSummaryBadge('Dup', String(result.rowsDuplicate))}
          {renderHistoricalBackfillSummaryBadge('Errors', String(result.rowsError))}
        </div>
      </div>
      <div style={historicalBackfillBatchTableStyle}>
        <div style={historicalBackfillBatchHeaderStyle}>
          <span>Symbol</span>
          <span>Status</span>
          <span>Added</span>
          <span>Evidence</span>
          <span>Dup</span>
          <span>Message</span>
        </div>
        <div style={quotesBodyStyle}>
          {result.symbolResults.length > 0 ? (
            result.symbolResults.map((row) => <HistoricalBackfillBatchSymbolRow key={`${row.runSymbolId ?? row.symbol}`} row={row} />)
          ) : (
            <div style={corporateEmptyStateStyle}>No per-symbol batch rows were returned.</div>
          )}
        </div>
      </div>
      {result.errors.length > 0 ? <HistoricalBackfillMessageBlock title="Batch Errors" messages={result.errors} /> : null}
    </div>
  );
}

function HistoricalBackfillBatchSymbolRow({
  row,
}: {
  row: HistoricalBackfillBatchSymbolResult;
}) {
  const detail = row.result?.message ?? row.error ?? '-';
  return (
    <div style={historicalBackfillBatchRowStyle}>
      <span style={corporateCellStyle}>{row.symbol}</span>
      <span style={corporateCellStyle}>{row.status}</span>
      <span style={historicalBackfillNumericCellStyle}>{row.result?.rowsInserted ?? 0}</span>
      <span style={historicalBackfillNumericCellStyle}>{row.result?.rowsEvidenceAttached ?? 0}</span>
      <span style={historicalBackfillNumericCellStyle}>{row.result?.rowsDuplicate ?? 0}</span>
      <span style={historicalBackfillSummaryCellStyle} title={detail}>
        {detail}
      </span>
    </div>
  );
}

function HistoricalBackfillRunHistoryPanel({
  runs,
  message,
  page,
  loading,
  onPageChange,
}: {
  runs: HistoricalCapitalActionBackfillRunRow[];
  message: string;
  page: { total: number; offset: number; limit: number; hasMore: boolean };
  loading: boolean;
  onPageChange: (offset: number) => void;
}) {
  const rangeStart = runs.length > 0 ? page.offset + 1 : 0;
  const rangeEnd = page.offset + runs.length;
  const rangeMessage =
    page.total === 0
      ? 'No persisted runs match this view.'
      : `Showing ${rangeStart}-${rangeEnd} of ${page.total}. ${page.hasMore ? 'More results are available.' : 'End of results.'}`;
  return (
    <div style={historicalBackfillResultPanelStyle}>
      <div style={historicalBackfillHeaderRowStyle}>
        <div style={historicalBackfillTitleBlockStyle}>
          <div style={quotePanelTitleStyle}>Historical Batch Runs</div>
          <div style={utilityHelperTextStyle}>{message || 'Latest persisted batch runs.'}</div>
          <div style={utilityHelperTextStyle}>{rangeMessage}</div>
        </div>
        <div style={historicalBackfillSummaryBadgeWrapStyle}>
          {renderHistoricalBackfillSummaryBadge('Total runs', String(page.total))}
          <button
            type="button"
            style={modalButtonStyle}
            onClick={() => onPageChange(Math.max(0, page.offset - page.limit))}
            disabled={loading || page.offset === 0}
          >
            Previous
          </button>
          <button
            type="button"
            style={modalButtonStyle}
            onClick={() => onPageChange(page.offset + page.limit)}
            disabled={loading || !page.hasMore}
          >
            Next
          </button>
        </div>
      </div>
      <div style={historicalBackfillRunTableStyle}>
        <div style={historicalBackfillRunHeaderStyle}>
          <span>Run</span>
          <span>Status</span>
          <span>Window</span>
          <span>Symbols</span>
          <span>New imports</span>
          <span>Existing-row evidence</span>
          <span>Summary</span>
          <span>Details</span>
        </div>
        <div style={quotesBodyStyle}>
          {runs.length > 0 ? (
            runs.map((run) => <HistoricalBackfillRunRowView key={run.id} run={run} />)
          ) : (
            <div style={corporateEmptyStateStyle}>No historical batch runs have been recorded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoricalBackfillRunRowView({
  run,
}: {
  run: HistoricalCapitalActionBackfillRunRow;
}) {
  const [expanded, setExpanded] = useState(false);
  const symbolsLabel = run.requestedSymbols.join(', ');
  const summary = run.message ?? `${run.completedSymbols}/${run.totalSymbols} completed, ${run.failedSymbols} failed.`;
  return (
    <div style={historicalBackfillRunGroupStyle}>
      <div style={historicalBackfillRunRowStyle}>
        <span style={corporateCellStyle}>#{run.id}</span>
        <span style={corporateCellStyle}>{formatHistoricalBackfillEnumLabel(run.status)}</span>
        <span style={corporateCellStyle}>
          {run.fromDate} to {run.toDate}
        </span>
        <span style={corporateCellStyle} title={symbolsLabel}>
          {run.completedSymbols}/{run.totalSymbols} completed | {symbolsLabel}
        </span>
        <span style={historicalBackfillNumericCellStyle}>{run.rowsInserted}</span>
        <span style={historicalBackfillNumericCellStyle}>{run.rowsEvidenceAttached}</span>
        <span style={historicalBackfillSummaryCellStyle} title={summary}>
          {summary}
        </span>
        <button
          type="button"
          style={historicalBackfillDetailsButtonStyle}
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          {expanded ? 'Hide' : 'Open'}
        </button>
      </div>
      {expanded ? (
        <div style={historicalBackfillRunDetailsStyle}>
          <div style={historicalBackfillRunCategoryStyle}>
            <strong>Parse categories:</strong> {formatHistoricalBackfillStatusCounts(run.parseStatusCounts)}
            <span style={historicalBackfillDetailSeparatorStyle}>|</span>
            <strong>Review categories:</strong> {formatHistoricalBackfillStatusCounts(run.reviewStatusCounts)}
          </div>
          {run.symbols.length > 0 ? (
            run.symbols.map((symbol) => <HistoricalBackfillRunSymbolDetails key={symbol.id} symbol={symbol} />)
          ) : (
            <div style={corporateEmptyStateStyle}>No per-symbol results were persisted for this run.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function HistoricalBackfillRunSymbolDetails({
  symbol,
}: {
  symbol: HistoricalCapitalActionBackfillRunRow['symbols'][number];
}) {
  return (
    <div style={historicalBackfillRunSymbolCardStyle}>
      <div style={historicalBackfillRunSymbolHeaderStyle}>
        <strong>
          {symbol.symbol}
          {symbol.canonicalSymbol && symbol.canonicalSymbol !== symbol.symbol
            ? ` -> ${symbol.canonicalSymbol}`
            : ''}
        </strong>
        <span>{formatHistoricalBackfillEnumLabel(symbol.status)}</span>
        <span>New imports {symbol.rowsInserted}</span>
        <span>Evidence added to existing rows {symbol.rowsEvidenceAttached}</span>
        <span>Duplicates {symbol.rowsDuplicate}</span>
        <span>Errors {symbol.rowsError}</span>
      </div>
      <div style={historicalBackfillRunCategoryStyle}>
        <strong>Parse:</strong> {formatHistoricalBackfillStatusCounts(symbol.parseStatusCounts)}
        <span style={historicalBackfillDetailSeparatorStyle}>|</span>
        <strong>Review:</strong> {formatHistoricalBackfillStatusCounts(symbol.reviewStatusCounts)}
      </div>
      {symbol.errorMessage ? <div style={historicalBackfillOutcomeErrorStyle}>{symbol.errorMessage}</div> : null}
      {symbol.outcomes.length > 0 ? (
        <div style={historicalBackfillOutcomeListStyle}>
          {symbol.outcomes.map((outcome) => (
            <details key={outcome.id} style={historicalBackfillOutcomeDetailsStyle}>
              <summary style={historicalBackfillOutcomeSummaryStyle}>
                {formatHistoricalBackfillOutcomeLabel(outcome.outcome)} | {outcome.source}
                {outcome.actionType ? ` | ${formatHistoricalBackfillEnumLabel(outcome.actionType)}` : ''}
                {outcome.importId ? ` | Import #${outcome.importId}` : ''}
                {outcome.evidenceId ? ` | Evidence #${outcome.evidenceId}` : ''}
              </summary>
              <div style={historicalBackfillOutcomeContentStyle}>
                <div>
                  <strong>Observed identity:</strong> symbol {outcome.evidenceSymbolSeen ?? outcome.requestedSymbol ?? '-'} |
                  ISIN {outcome.evidenceIsinSeen ?? '-'} | company {outcome.evidenceCompanyNameSeen ?? '-'}
                </div>
                <div>
                  <strong>Statuses:</strong> parse {formatHistoricalBackfillEnumLabel(outcome.parseStatus ?? 'not recorded')} |
                  review {formatHistoricalBackfillEnumLabel(outcome.reviewStatus ?? 'not recorded')}
                </div>
                <div>
                  <strong>Source locator:</strong> {outcome.sourceLocator ?? '-'}
                </div>
                <div>
                  <strong>Reason/message:</strong> {outcome.message ?? outcome.evidenceNote ?? '-'}
                </div>
                {outcome.evidenceRawReference ? (
                  <div style={historicalBackfillRawEvidenceStyle}>
                    <strong>Raw evidence:</strong>
                    <pre style={historicalBackfillRawEvidencePreStyle}>{outcome.evidenceRawReference}</pre>
                  </div>
                ) : null}
                <div style={utilityHelperTextStyle}>Recorded {outcome.createdAt}</div>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div style={utilityHelperTextStyle}>
          No candidate-level provenance is available. This run may predate Phase 6A.
        </div>
      )}
    </div>
  );
}

function formatHistoricalBackfillStatusCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) {
    return 'not recorded';
  }
  return entries
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([status, count]) => `${formatHistoricalBackfillEnumLabel(status)} ${count}`)
    .join(', ');
}

function formatHistoricalBackfillEnumLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatHistoricalBackfillOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'INSERTED':
      return 'New review row created';
    case 'DUPLICATE':
      return 'Existing review row matched';
    case 'EVIDENCE_ATTACHED':
      return 'Evidence linked to existing review row';
    case 'SKIPPED_ACTION_TYPE':
      return 'Not imported: outside split/bonus backfill';
    case 'CANDIDATE_ERROR':
      return 'Source row could not be processed';
    default:
      return formatHistoricalBackfillEnumLabel(outcome);
  }
}

function HistoricalBackfillMessageBlock({
  title,
  messages,
}: {
  title: string;
  messages: string[];
}) {
  return (
    <div style={historicalBackfillMessagePanelStyle}>
      <div style={historicalBackfillMessageTitleStyle}>{title}</div>
      <div style={historicalBackfillMessageListStyle}>
        {messages.map((message, index) => (
          <div key={`${title}-${index}`} style={historicalBackfillMessageItemStyle}>
            {message}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderHistoricalBackfillSummaryBadge(label: string, value: string, title?: string) {
  return (
    <div style={historicalBackfillSummaryBadgeStyle} title={title}>
      <span style={historicalBackfillSummaryBadgeLabelStyle}>{label}</span>
      <span style={historicalBackfillSummaryBadgeValueStyle}>{value}</span>
    </div>
  );
}

function buildHistoricalBackfillContextTitle(attempt: HistoricalBackfillSourceAttempt): string {
  const parts = [attempt.requestedSymbol, attempt.sourceLocator].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : attempt.source;
}

function formatHistoricalBackfillDateRange(attempt: HistoricalBackfillSourceAttempt): string {
  if (attempt.earliestExDate && attempt.latestExDate) {
    return `${attempt.earliestExDate} -> ${attempt.latestExDate}`;
  }
  return attempt.earliestExDate ?? attempt.latestExDate ?? '-';
}

function formatIssueResolveHintLabel(hint: CorporateActionImportResolutionHint | null): string {
  if (!hint) {
    return 'Checking...';
  }
  if (hint.status === 'ONE_ACTIVE') {
    return hint.quickResolvable ? '1 active · verified' : '1 active · review';
  }
  if (hint.status === 'MULTIPLE_ACTIVE') {
    return `${hint.activeSuggestionCount} active`;
  }
  if (hint.status === 'NONE_ACTIVE') {
    return hint.totalSuggestionCount > 0 ? 'No active' : 'No hint';
  }
  if (hint.status === 'ERROR') {
    return 'Hint error';
  }
  return hint.status;
}

function formatIssueResolveHintTitle(hint: CorporateActionImportResolutionHint | null): string {
  if (!hint) {
    return 'Checking quick-resolve suggestions for this unresolved row.';
  }
  if (hint.status === 'NONE_ACTIVE') {
    return `${hint.message} No Active means the current suggestion path found no active current symbol yet. Common causes: only inactive related aliases were found, identity history is incomplete, or no structured suggestion path exists yet. It does not prove the company is unlisted.`;
  }
  return hint.message;
}

function isApprovableCorporateImport(
  row: CorporateActionImportRow,
  scan?: CorporateActionScanResultRow,
): boolean {
  return getCorporateActionApprovalState(row, scan) === 'READY TO APPROVE';
}

function importStatusMeaning(status: string): string {
  if (status === 'PENDING') {
    return 'Parsed and matched to one database symbol. This row can be approved manually.';
  }
  if (status === 'PENDING_ISIN_MISMATCH') {
    return 'The official row matched the current symbol, but its ISIN differs from the current instrument snapshot. Ordinary approval is blocked until historical identity evidence is resolved.';
  }
  if (status === 'UNRESOLVED') {
    return 'The official row could not be mapped safely to one database symbol yet. Resolve it first.';
  }
  if (status === 'NEEDS_REVIEW') {
    return 'The row is linked to a symbol, but parsing is incomplete or required dates are missing.';
  }
  if (status === 'UNSUPPORTED') {
    return 'The official row was stored for review, but this action type is not approvable in the current flow.';
  }
  if (status === 'APPROVED') {
    return 'This row is already linked to a canonical approved corporate action.';
  }
  return status;
}

function formatNseHistoricalIdentityStatus(result: NseHistoricalIdentityResult): string {
  const summary = [
    result.applied ? 'Applied reviewed NSE historical identity.' : 'Previewed NSE historical identity.',
    `Source ${result.archiveRootPath}`,
    `symbol ${result.newSymbolChanges}`,
    `name ${result.newNameChanges}`,
    `combined ${result.newCombinedChanges}`,
    `duplicate ${result.duplicateRows}`,
    `skipped ${result.skippedRows}`,
    `errors ${result.errorRows}`,
    `master ${result.masterRowsPlanned}/${result.masterRowsRead}`,
    `activate ${result.activeSyncActivateCount}`,
    `update ${result.activeSyncUpdateCount}`,
    `deactivate ${result.activeSyncDeactivateCount}`,
  ].join(' ');

  if (result.errors.length === 0) {
    return summary;
  }

  return `${summary}. ${result.errors.slice(0, 2).join('; ')}`;
}

function formatNseCurrentUniverseSyncStatus(result: NseCurrentUniverseSyncResult): string {
  return [
    result.applied ? 'Applied NSE current-universe sync.' : 'Previewed NSE current-universe sync.',
    `Source ${result.archiveRootPath}`,
    `Current ${result.currentUniverseSymbols}/${result.masterRowsRead}`,
    `activate ${result.activateCount}`,
    `update ${result.updateCount}`,
    `deactivate ${result.deactivateCount}`,
    `unchanged ${result.unchangedActive}`,
    `delisted ${result.officialDelistedSymbols}`,
    `exact ${result.matchedBySymbol}`,
    `isin ${result.matchedByIsin}`,
    `identity ${result.matchedByIdentity}`,
    `new ${result.newSymbols}`,
  ].join(' ');
}

function formatBseCurrentUniverseSyncStatus(result: BseCurrentUniverseSyncResult): string {
  return [
    result.applied ? 'Applied BSE current-universe sync.' : 'Previewed BSE current-universe sync.',
    `Current ${result.currentUniverseSymbols}/${result.masterRowsRead}`,
    `activate ${result.activateCount}`,
    `update ${result.updateCount}`,
    `deactivate ${result.deactivateCount}`,
    `unchanged ${result.unchangedActive}`,
  ].join(' ');
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (typeof error === 'string' && error.trim()) {
    return error.trim();
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }
  }
  return fallback;
}

function formatCorporateActionTypeLabel(value: CorporateActionImportActionType): string {
  if (value === 'DIVIDEND') {
    return 'Dividend';
  }
  if (value === 'RIGHTS') {
    return 'Rights';
  }
  if (value === 'BONUS') {
    return 'Bonus';
  }
  if (value === 'SPLIT') {
    return 'Split';
  }
  return 'Other';
}

function createEmptyQuoteForm(date = todayIso()): QuoteFormState {
  return {
    date,
    open: '',
    high: '',
    low: '',
    close: '',
    volume: '0',
  };
}

function buildQuotePayload(symbol: string, exchange: string, form: QuoteFormState): QuoteInput {
  return {
    symbol: symbol.trim().toUpperCase(),
    exchange: exchange.trim().toUpperCase() || 'NSE',
    date: form.date,
    open: Number(form.open),
    high: Number(form.high),
    low: Number(form.low),
    close: Number(form.close),
    volume: Number(form.volume),
  };
}

function quoteRowKey(row: Pick<QuoteRow, 'exchange' | 'symbol' | 'date'>): string {
  return `${row.exchange}:${row.symbol}:${row.date}`;
}

function upsertQuoteRowBySymbol(rows: QuoteRow[], nextRow: QuoteRow): QuoteRow[] {
  const nextKey = `${nextRow.exchange}:${nextRow.symbol}`;
  const merged = rows.filter((row) => `${row.exchange}:${row.symbol}` !== nextKey);
  merged.push(nextRow);
  merged.sort((left, right) => left.exchange.localeCompare(right.exchange) || left.symbol.localeCompare(right.symbol));
  return merged;
}

function selectQuoteRow(
  row: QuoteRow,
  setSelectedQuoteKey: React.Dispatch<React.SetStateAction<string | null>>,
  setSymbol: React.Dispatch<React.SetStateAction<string>>,
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>,
) {
  setSelectedQuoteKey(quoteRowKey(row));
  setSymbol(row.symbol);
  setForm({
    date: row.date,
    open: String(row.open),
    high: String(row.high),
    low: String(row.low),
    close: String(row.close),
    volume: String(row.volume),
  });
}

function patchQuoteForm(
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>,
  key: keyof QuoteFormState,
  value: string,
) {
  setForm((state) => ({ ...state, [key]: value }));
}

function validateQuoteForm(form: QuoteFormState): string | null {
  const requiredFields: Array<[keyof QuoteFormState, string]> = [
    ['open', 'Open'],
    ['high', 'High'],
    ['low', 'Low'],
    ['close', 'Close'],
  ];

  for (const [key, label] of requiredFields) {
    if (!form[key].trim()) {
      return `${label} is required before saving a quote.`;
    }
  }

  const numericFields: Array<[keyof QuoteFormState, string]> = [
    ['open', 'Open'],
    ['high', 'High'],
    ['low', 'Low'],
    ['close', 'Close'],
  ];

  for (const [key, label] of numericFields) {
    const value = Number(form[key]);
    if (!Number.isFinite(value) || value <= 0) {
      return `${label} must be greater than zero.`;
    }
  }

  return null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseRatioText(value: string): { newValue: number; oldValue: number } | null {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*:\s*(\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  const newValue = Number(match[1]);
  const oldValue = Number(match[2]);
  if (!Number.isFinite(newValue) || !Number.isFinite(oldValue) || newValue <= 0 || oldValue <= 0) {
    return null;
  }

  return { newValue, oldValue };
}

function computeCorporateFactor(
  actionType: CorporateActionInput['actionType'],
  ratioText: string,
  oldFaceValue?: string,
  newFaceValue?: string,
): number | null {
  if (actionType !== 'SPLIT' && actionType !== 'BONUS') {
    return null;
  }

  if (actionType === 'SPLIT') {
    const oldValue = toNullableNumber(oldFaceValue ?? '');
    const newValue = toNullableNumber(newFaceValue ?? '');
    if (oldValue && newValue && oldValue > 0 && newValue > 0) {
      return oldValue / newValue;
    }
  }

  const parsed = parseRatioText(ratioText);
  if (!parsed) {
    return null;
  }

  if (actionType === 'SPLIT') {
    return parsed.newValue / parsed.oldValue;
  }

  return (parsed.newValue + parsed.oldValue) / parsed.oldValue;
}

function toNullableText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function toNullableNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

const dialogColumnsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '320px minmax(0, 1fr)',
  gap: 16,
  minHeight: 0,
  flex: 1,
};

const dialogLeftPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
};

const dialogRightPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
  minHeight: 0,
};

const quoteEditorLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '280px minmax(0, 1fr)',
  gap: 14,
  height: '100%',
  minHeight: 0,
  flex: 1,
  overflow: 'hidden',
};

const quoteEditorWindowBodyStyle: React.CSSProperties = {
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  padding: 12,
};

const quoteEditorLeftPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
  minHeight: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
  paddingRight: 4,
};

const quoteEditorRightPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minWidth: 0,
  minHeight: 0,
};

const quoteModePanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const quotePanelTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
};

const quotePanelNoteStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
};

const quoteEditorFormGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '68px minmax(0, 1fr)',
  gap: '7px 10px',
  alignItems: 'center',
};

const quoteEditorActionGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 7,
};

const quoteEditorStatusBarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexShrink: 0,
  minHeight: 34,
  marginTop: 10,
  padding: '0 10px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.35,
  overflow: 'hidden',
};

const quoteEditorStatusTextStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const quoteEditorProgressTextStyle: React.CSSProperties = {
  flexShrink: 0,
  color: 'var(--accent)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};

const quoteEditorHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const fieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 12,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--text)',
  fontSize: 13,
};

const officialPendingGroupStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
};

const officialPendingGroupHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px minmax(160px, 1.4fr) minmax(160px, 1fr)',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  background: 'var(--bg2)',
};

const officialPendingGroupToggleStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  textAlign: 'left',
  cursor: 'pointer',
  fontWeight: 700,
  minWidth: 0,
  overflowWrap: 'anywhere',
};

const officialPendingActionRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px minmax(220px, 1.4fr) 120px minmax(180px, 1fr) 130px',
  alignItems: 'center',
  gap: 10,
  padding: '7px 10px 7px 34px',
  borderTop: '1px solid var(--border)',
};

const officialApprovalConfirmationStyle: React.CSSProperties = {
  display: 'grid',
  gap: 8,
  margin: '8px 0',
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg2)',
};

const modalInputStyle: React.CSSProperties = {
  height: 34,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 10px',
  fontSize: 14,
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 10,
};

const modalButtonStyle: React.CSSProperties = {
  height: 34,
  minWidth: 92,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  ...modalButtonStyle,
  borderColor: 'var(--accent)',
  color: 'var(--text)',
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
};

const statusPanelStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 13,
  lineHeight: 1.45,
};

const tableFrameStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: 1,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const quotesHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '108px repeat(4, minmax(0, 1fr)) 92px',
  gap: 8,
  alignItems: 'center',
  minHeight: 34,
  padding: '0 10px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const quotesBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'auto',
  overscrollBehavior: 'contain',
};

function quoteRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '108px repeat(4, minmax(0, 1fr)) 92px',
    gap: 8,
    alignItems: 'center',
    minHeight: 32,
    padding: '0 10px',
    border: '0',
    borderBottom: '1px solid var(--border)',
    background: active ? 'var(--blue-dim)' : 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 13,
  };
}

function quoteEditorGridStyle(
  showExchange: boolean,
  header: boolean,
  active = false,
): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: showExchange
      ? 'minmax(150px, 1.35fr) 84px 100px repeat(4, minmax(76px, 1fr)) 100px'
      : 'minmax(150px, 1.35fr) 100px repeat(4, minmax(76px, 1fr)) 100px',
    gap: 8,
    alignItems: 'center',
    minHeight: header ? 34 : 30,
    padding: '0 10px',
    border: '0',
    borderBottom: '1px solid var(--border)',
    background: header ? 'transparent' : active ? 'var(--blue-dim)' : 'transparent',
    color: header ? 'var(--text-dim)' : 'var(--text)',
    cursor: header ? 'default' : 'pointer',
    textAlign: 'left',
    fontSize: 12,
    textTransform: header ? 'uppercase' : undefined,
    letterSpacing: header ? '0.04em' : undefined,
  };
}

const footerRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
};

const checkboxRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--text)',
  fontSize: 13,
};

const utilityDialogLayoutStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 88px',
  gap: 14,
  alignItems: 'start',
};

const utilityFormColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
};

const utilityFormGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '92px minmax(0, 1fr)',
  gap: '10px 12px',
  alignItems: 'center',
};

const utilityFieldLabelStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.25,
};

const quoteEditorTickerExchangeRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 112px',
  gap: 8,
  minWidth: 0,
};

const utilityInlineValueRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 72px',
  gap: 8,
  minWidth: 0,
};

const utilityInputStyle: React.CSSProperties = {
  ...modalInputStyle,
  height: 30,
  fontSize: 13,
};

const utilityExchangeInputStyle: React.CSSProperties = {
  ...utilityInputStyle,
  padding: '0 8px',
  textTransform: 'uppercase',
};

const utilityCheckboxListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const utilityCheckboxRowStyle: React.CSSProperties = {
  ...checkboxRowStyle,
  fontSize: 13,
};

const utilityButtonStackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignSelf: 'start',
};

const utilityStatusStyle: React.CSSProperties = {
  minHeight: 44,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.45,
};

const utilityHelperTextStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.35,
};

const corporateProgressBadgeRowStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  gap: 6,
  marginLeft: 8,
  verticalAlign: 'middle',
};

const corporateProgressBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 20,
  padding: '0 6px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1,
  borderRadius: 4,
};

const corporateActionShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  minWidth: 0,
  minHeight: 0,
  height: '100%',
};

const corporateActionTabRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  borderBottom: '1px solid var(--border)',
  paddingBottom: 8,
};

function corporateActionTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    ...modalButtonStyle,
    minWidth: 0,
    height: 30,
    padding: '0 10px',
    borderColor: active ? 'var(--accent)' : 'var(--border2)',
    background: active ? 'var(--control-bg-hover)' : 'var(--control-bg)',
    fontSize: 12,
  };
}

const officialImportSectionNavStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
};

const pendingCompactControlsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
  flexShrink: 0,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--control-bg)',
};

const pendingCompactActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
};

const pendingCompactActionGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
};

const pendingCompactViewActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  marginLeft: 'auto',
};

const pendingCompactFiltersStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
};

const pendingCompactTypeFiltersStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
};

const pendingCompactSymbolFieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: '0 1 320px',
  minWidth: 190,
};

const pendingCompactSymbolSelectStyle: React.CSSProperties = {
  ...utilityInputStyle,
  width: '100%',
  minWidth: 0,
};

const pendingCompactSearchStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flex: '1 1 420px',
  minWidth: 260,
};

const pendingCompactSearchInputStyle: React.CSSProperties = {
  ...utilityInputStyle,
  flex: '1 1 auto',
  minWidth: 0,
};

const pendingCompactStatusBandStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px 12px',
  minWidth: 0,
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.35,
  // Expanded diagnostics scroll here instead of displacing the pending actions.
  maxHeight: 'min(30vh, 280px)',
  overflowY: 'auto',
  overflowX: 'hidden',
  scrollbarGutter: 'stable',
};

const pendingDiagnosticDisclosureStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  marginTop: 5,
};

const pendingDiagnosticTableViewportStyle: React.CSSProperties = {
  maxWidth: 760,
  overflowX: 'auto',
  margin: '8px 0',
};

const pendingDiagnosticTableStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 480,
  borderCollapse: 'collapse',
  fontSize: 12,
  background: 'var(--control-bg)',
};

const pendingDiagnosticLabelCellStyle: React.CSSProperties = {
  padding: '6px 12px',
  minWidth: 110,
  textAlign: 'left',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)',
};

const pendingDiagnosticNumberCellStyle: React.CSSProperties = {
  ...pendingDiagnosticLabelCellStyle,
  minWidth: 90,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const pendingDiagnosticReportStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  maxWidth: 850,
  maxHeight: 160,
  marginTop: 6,
  boxSizing: 'border-box',
  resize: 'vertical',
  fontFamily: 'monospace',
  fontSize: 11,
  color: 'var(--text)',
  background: 'var(--control-bg)',
};

const pendingCompactCountsStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px 10px',
  flexShrink: 0,
  color: 'var(--text)',
  fontVariantNumeric: 'tabular-nums',
};

const pendingCompactStatusPresentationStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  flex: '1 1 480px',
  minWidth: 0,
};

const pendingCompactCurrentStatusStyle: React.CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
};

const pendingCompactTaskStatusStyle: React.CSSProperties = {
  display: 'flex',
  flex: '1 1 auto',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px 10px',
  minWidth: 0,
};

const pendingCompactTaskMessageStyle: React.CSSProperties = {
  flex: '1 1 320px',
  minWidth: 0,
  color: 'var(--text)',
  overflowWrap: 'anywhere',
};

const pendingCompactTaskMetaStyle: React.CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '4px 10px',
  flexShrink: 0,
  fontVariantNumeric: 'tabular-nums',
};

const pendingCompactDetailsStyle: React.CSSProperties = {
  minWidth: 0,
};

const pendingCompactDetailsSummaryStyle: React.CSSProperties = {
  cursor: 'pointer',
  color: 'var(--text)',
};

const pendingCompactDetailsBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 3,
  padding: '4px 0 0 12px',
  maxWidth: 680,
  overflowWrap: 'anywhere',
};

const officialImportSectionCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
  padding: 12,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  borderRadius: 4,
};

const officialImportSectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
};

const officialImportSectionTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.3,
};

const officialImportFieldGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 130,
};

const corporateActionPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
  minHeight: 0,
  flex: 1,
};

const corporateImportToolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

const identityControlHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  minWidth: 0,
};

const identitySelectorRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
};

const identityCompactLabelStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const identitySegmentStyle: React.CSSProperties = {
  display: 'inline-flex',
  gap: 2,
  padding: 2,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg2)',
};

function identitySegmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 24,
    minWidth: 54,
    padding: '0 8px',
    border: '1px solid transparent',
    borderColor: active ? 'var(--accent)' : 'transparent',
    borderRadius: 3,
    background: active ? 'var(--control-bg-hover)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: 11,
  };
}

const identitySourceRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 34,
  padding: '5px 8px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const identitySourceCopyStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  flexWrap: 'wrap',
  gap: 8,
  minWidth: 0,
  fontSize: 12,
};

const identitySourceActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 6,
};

const officialSourceHealthPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  minWidth: 0,
  padding: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const officialSourceHealthHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  fontSize: 12,
};

const officialSourceHealthSummaryStyle: React.CSSProperties = {
  minWidth: 0,
  color: 'var(--text-dim)',
  fontSize: 10,
  fontFamily: 'var(--font-mono)',
  textAlign: 'right',
};

const officialSourceHealthEvidenceDetailsBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  paddingTop: 3,
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
  overflowWrap: 'anywhere',
};

const identityManualSourceRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '112px minmax(0, 1fr) 96px',
  gap: 6,
  alignItems: 'center',
  minWidth: 0,
};

const identityHistoricalRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  paddingLeft: 118,
};

const identityHistoricalActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 6,
};

const identityHistoricalFilterRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
};

const identityCompactInputStyle: React.CSSProperties = {
  ...utilityInputStyle,
  width: '100%',
  minWidth: 0,
  height: 28,
  fontSize: 12,
};

const identityButtonStyle: React.CSSProperties = {
  ...modalButtonStyle,
  minWidth: 0,
  height: 28,
  padding: '0 9px',
  fontSize: 12,
};

const identityPrimaryButtonStyle: React.CSSProperties = {
  ...identityButtonStyle,
  borderColor: 'var(--accent)',
};

const identitySecondaryButtonStyle: React.CSSProperties = {
  ...identityButtonStyle,
  color: 'var(--text-dim)',
};

const identityActionRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
};

const identityStatusStyle: React.CSSProperties = {
  ...utilityStatusStyle,
  minHeight: 30,
  padding: '6px 8px',
  fontSize: 11,
};

const identitySummaryRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 5,
};

const identitySummaryBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 22,
  padding: '0 7px',
  border: '1px solid var(--border)',
  borderRadius: 3,
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontVariantNumeric: 'tabular-nums',
};

const identityTopToolsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
  marginLeft: 'auto',
};

const sourceUrlIconButtonStyle: React.CSSProperties = {
  ...modalButtonStyle,
  width: 34,
  minWidth: 34,
  height: 30,
  padding: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const infoIconButtonStyle: React.CSSProperties = {
  ...sourceUrlIconButtonStyle,
  width: 30,
  minWidth: 30,
  fontWeight: 700,
};

const linkIconStyle: React.CSSProperties = {
  position: 'relative',
  display: 'inline-block',
  width: 18,
  height: 14,
};

function linkIconOvalStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: 3,
    left: side === 'left' ? 1 : 7,
    width: 9,
    height: 6,
    border: '2px solid currentColor',
    borderRadius: 5,
    transform: side === 'left' ? 'rotate(-28deg)' : 'rotate(-28deg)',
  };
}

const sourceUrlOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(0, 0, 0, 0.58)',
};

const sourceUrlDialogStyle: React.CSSProperties = {
  width: 'min(880px, 100%)',
  maxHeight: 'min(720px, calc(100vh - 48px))',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 14,
  border: '1px solid var(--border2)',
  borderRadius: 8,
  background: 'var(--panel-bg)',
  boxShadow: '0 18px 60px rgba(0, 0, 0, 0.45)',
  overflow: 'hidden',
};

const sourceUrlHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--text)',
  fontSize: 14,
};

const sourceUrlCloseButtonStyle: React.CSSProperties = {
  ...modalButtonStyle,
  width: 30,
  minWidth: 30,
  height: 28,
  padding: 0,
};

const sourceUrlExchangeTabsStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

const sourceUrlFieldsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minHeight: 0,
  overflow: 'auto',
  paddingRight: 2,
};

const sourceUrlFieldStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '190px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'center',
};

const sourceUrlLabelStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.3,
};

const sourceUrlInputStyle: React.CSSProperties = {
  ...utilityInputStyle,
  width: '100%',
  minWidth: 0,
  fontFamily: 'var(--font-mono)',
};

const sourceUrlStatusStyle: React.CSSProperties = {
  minHeight: 20,
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.35,
};

const sourceUrlActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const identityInfoDialogStyle: React.CSSProperties = {
  ...sourceUrlDialogStyle,
  width: 'min(900px, calc(100vw - 48px))',
  height: 'min(760px, calc(100vh - 48px))',
  maxHeight: 'calc(100vh - 48px)',
};

const identityInfoContentStyle: React.CSSProperties = {
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  gap: 12,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  overscrollBehavior: 'contain',
  paddingRight: 6,
  color: 'var(--text)',
  fontSize: 12,
  lineHeight: 1.5,
};

const identityInfoSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const identityInfoSectionTitleStyle: React.CSSProperties = {
  margin: 0,
  color: 'var(--text)',
  fontSize: 13,
  lineHeight: 1.25,
};

const identityInfoListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  margin: 0,
  paddingLeft: 20,
  color: 'var(--text-dim)',
  lineHeight: 1.55,
};

const identityRecoveryActionPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minWidth: 0,
};

const identityRecoveryActionsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 8,
  alignItems: 'stretch',
};

const identityRecoveryExportStatusStyle: React.CSSProperties = {
  ...sourceUrlStatusStyle,
  minHeight: 0,
  padding: '7px 9px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  overflowWrap: 'anywhere',
  fontFamily: 'var(--font-mono)',
};

const identityInfoFooterStyle: React.CSSProperties = {
  display: 'flex',
  flex: '0 0 auto',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 10,
  borderTop: '1px solid var(--border)',
};

const historicalBackfillResultPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const historicalBackfillHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const historicalBackfillTitleBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
  flex: '1 1 280px',
};

const historicalBackfillSummaryBadgeWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  justifyContent: 'flex-end',
  alignItems: 'flex-start',
  flex: '1 1 260px',
};

const historicalBackfillSummaryBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  minHeight: 22,
  padding: '0 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  borderRadius: 4,
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1,
};

const historicalBackfillSummaryBadgeLabelStyle: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const historicalBackfillSummaryBadgeValueStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 600,
};

const historicalBackfillAliasesTextStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.35,
};

const historicalBackfillBatchPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const historicalBackfillBatchInputStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '92px minmax(180px, 1fr) 120px 96px 90px',
  gap: 8,
  alignItems: 'center',
};

const historicalBackfillBatchSourceRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  alignItems: 'center',
};

const historicalBackfillBatchTextareaStyle: React.CSSProperties = {
  ...modalInputStyle,
  minHeight: 62,
  resize: 'vertical',
  fontSize: 12,
  lineHeight: 1.35,
};

const reviewIssuesToolbarStyle: React.CSSProperties = {
  ...corporateImportToolbarStyle,
  alignItems: 'stretch',
};

const corporateImportCsvToolbarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '130px minmax(0, 1fr) 82px 104px',
  gap: 8,
  alignItems: 'end',
};

const officialFetchLastSuccessStyle: React.CSSProperties = {
  ...utilityHelperTextStyle,
  color: 'var(--text)',
  fontWeight: 600,
};

const officialFetchLogStyle: React.CSSProperties = {
  margin: 0,
  padding: '8px 10px 8px 28px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg2)',
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.45,
};

const corporateImportFilterRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  alignItems: 'center',
  padding: '0 2px',
};

const corporateSearchRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '72px minmax(0, 1fr) 84px',
  gap: 8,
  alignItems: 'center',
};

const corporateImportFilterCheckboxStyle: React.CSSProperties = {
  ...checkboxRowStyle,
  fontSize: 12,
  padding: '0 4px',
};

const corporateImportTableStyle: React.CSSProperties = {
  ...tableFrameStyle,
  minHeight: 220,
};

const historicalBackfillAttemptTableStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const historicalBackfillBatchTableStyle: React.CSSProperties = {
  ...historicalBackfillAttemptTableStyle,
};

const historicalBackfillRunTableStyle: React.CSSProperties = {
  ...historicalBackfillAttemptTableStyle,
};

const historicalBackfillAttemptHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '88px 132px 52px 52px 52px 64px 52px 124px minmax(140px, 1fr)',
  letterSpacing: 0,
};

const historicalBackfillBatchHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '96px 96px 64px 72px 52px minmax(220px, 1fr)',
  letterSpacing: 0,
};

const historicalBackfillRunHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '64px 116px 156px minmax(180px, 1fr) 76px 88px minmax(200px, 1fr) 64px',
  letterSpacing: 0,
};

const corporateImportHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '34px 118px 86px minmax(140px, 1.05fr) 118px minmax(160px, 1.1fr) minmax(138px, 1fr) 112px',
  letterSpacing: 0,
};

const identitySyncHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '96px 112px 72px 88px 88px 112px minmax(220px, 1fr)',
  letterSpacing: 0,
};

const corporateImportRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px 118px 86px minmax(140px, 1.05fr) 118px minmax(160px, 1.1fr) minmax(138px, 1fr) 112px',
  gap: 8,
  alignItems: 'center',
  minHeight: 54,
  padding: '6px 10px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 12,
};

const historicalBackfillAttemptRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '88px 132px 52px 52px 52px 64px 52px 124px minmax(140px, 1fr)',
  gap: 8,
  alignItems: 'center',
  minHeight: 44,
  padding: '8px 10px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 12,
};

const historicalBackfillBatchRowStyle: React.CSSProperties = {
  ...historicalBackfillAttemptRowStyle,
  gridTemplateColumns: '96px 96px 64px 72px 52px minmax(220px, 1fr)',
  minHeight: 34,
};

const historicalBackfillRunRowStyle: React.CSSProperties = {
  ...historicalBackfillAttemptRowStyle,
  gridTemplateColumns: '64px 116px 156px minmax(180px, 1fr) 76px 88px minmax(200px, 1fr) 64px',
  minHeight: 34,
};

const historicalBackfillRunGroupStyle: React.CSSProperties = {
  borderBottom: '1px solid var(--border)',
};

const historicalBackfillDetailsButtonStyle: React.CSSProperties = {
  ...modalButtonStyle,
  minWidth: 58,
  padding: '4px 8px',
};

const historicalBackfillRunDetailsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 12px 12px',
  background: 'var(--bg)',
};

const historicalBackfillRunCategoryStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.4,
};

const historicalBackfillDetailSeparatorStyle: React.CSSProperties = {
  color: 'var(--border-strong)',
  padding: '0 2px',
};

const historicalBackfillRunSymbolCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  padding: 10,
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg2)',
  color: 'var(--text)',
  fontSize: 12,
};

const historicalBackfillRunSymbolHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '6px 14px',
  alignItems: 'center',
};

const historicalBackfillOutcomeListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const historicalBackfillOutcomeDetailsStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 3,
  background: 'var(--bg)',
};

const historicalBackfillOutcomeSummaryStyle: React.CSSProperties = {
  padding: '7px 9px',
  cursor: 'pointer',
  color: 'var(--text)',
  fontWeight: 600,
};

const historicalBackfillOutcomeContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '0 9px 9px 25px',
  color: 'var(--text-dim)',
  overflowWrap: 'anywhere',
};

const historicalBackfillOutcomeErrorStyle: React.CSSProperties = {
  color: 'var(--danger)',
  whiteSpace: 'pre-wrap',
};

const historicalBackfillRawEvidenceStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const historicalBackfillRawEvidencePreStyle: React.CSSProperties = {
  maxHeight: 180,
  margin: 0,
  padding: 8,
  overflow: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 3,
  background: 'var(--bg2)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
};

const identitySyncRowStyle: React.CSSProperties = {
  ...corporateImportRowStyle,
  gridTemplateColumns: '96px 112px 72px 88px 88px 112px minmax(220px, 1fr)',
};

const corporateIssueHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '38px 96px 140px 88px 112px minmax(180px, 1fr) 96px',
  letterSpacing: 0,
};

const corporateIssueRowStyle: React.CSSProperties = {
  ...corporateImportRowStyle,
  gridTemplateColumns: '38px 96px 140px 88px 112px minmax(180px, 1fr) 96px',
};

const corporateIssueActionCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: 4,
  minWidth: 0,
};

const corporateIssueHintTextStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

const officialPendingGroupReasonStyle: React.CSSProperties = {
  ...corporateIssueHintTextStyle,
  minWidth: 0,
  whiteSpace: 'normal',
  textAlign: 'right',
  overflowWrap: 'anywhere',
};

const corporateEvidenceSourceCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: 2,
  minWidth: 0,
  overflow: 'hidden',
};

const corporateEvidenceSummaryStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-subtle)',
  color: 'var(--text)',
  fontSize: 12,
  overflowWrap: 'anywhere',
};

const corporateScanHeaderStyle: React.CSSProperties = {
  ...quotesHeaderStyle,
  gridTemplateColumns: '118px 94px 118px 118px 126px 108px 112px minmax(180px, 1fr)',
  letterSpacing: 0,
};

const corporateScanRowStyle: React.CSSProperties = {
  ...corporateImportRowStyle,
  gridTemplateColumns: '118px 94px 118px 118px 126px 108px 112px minmax(180px, 1fr)',
};

const corporateCellStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const historicalBackfillContextCellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  minWidth: 0,
  overflow: 'hidden',
};

const historicalBackfillLocatorTextStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const historicalBackfillNumericCellStyle: React.CSSProperties = {
  ...corporateCellStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};

const historicalBackfillSummaryCellStyle: React.CSSProperties = {
  minWidth: 0,
  color: 'var(--text-dim)',
  lineHeight: 1.35,
  whiteSpace: 'normal',
};

const corporatePurposeCellStyle: React.CSSProperties = {
  ...corporateCellStyle,
  color: 'var(--text-dim)',
};

const corporateEmptyStateStyle: React.CSSProperties = {
  padding: '14px 10px',
  color: 'var(--text-dim)',
  fontSize: 12,
};

const historicalBackfillMessagePanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const historicalBackfillMessageTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const historicalBackfillMessageListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const historicalBackfillMessageItemStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.4,
};

const corporateResolveWorkspaceStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minWidth: 0,
  minHeight: 0,
  background: 'var(--bg2)',
};

const corporateResolveDialogStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg2)',
  overflow: 'hidden',
};

const corporateResolveHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  gap: 10,
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  padding: '12px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const corporateResolveBodyStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  flexDirection: 'column',
  gap: 12,
  minHeight: 0,
  padding: 14,
  overflowX: 'hidden',
  overflowY: 'auto',
};

const corporateIdentityCompareGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 10,
  flexShrink: 0,
};

const corporateIdentityCardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-subtle)',
};

const corporateIdentityValueRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '108px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'baseline',
  minWidth: 0,
  fontSize: 12,
};

const corporateIdentityStatusRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
  flexShrink: 0,
  padding: '8px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--control-bg)',
  fontSize: 12,
};

const corporateResolveSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  flexShrink: 0,
  minWidth: 0,
};

const corporateResolveActionsStyle: React.CSSProperties = {
  display: 'flex',
  flexShrink: 0,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 14px',
  borderTop: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const corporateResolveCandidatesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 118,
  maxHeight: 240,
  flexShrink: 0,
  overflowX: 'hidden',
  overflowY: 'auto',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg2)',
  padding: 8,
};

const corporateResolveSearchResultsStyle: React.CSSProperties = {
  ...corporateResolveCandidatesStyle,
  minHeight: 88,
  maxHeight: 180,
};

const corporateEvidenceDetailsStyle: React.CSSProperties = {
  flexShrink: 0,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-subtle)',
  fontSize: 12,
};

const corporateEvidenceSummaryToggleStyle: React.CSSProperties = {
  cursor: 'pointer',
  padding: '8px 10px',
  fontWeight: 600,
};

const corporateEvidenceDetailsBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: '0 10px 10px',
  color: 'var(--text-dim)',
};

function corporateResolveCandidateStyle(active: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: 'minmax(150px, 0.8fr) minmax(0, 1.2fr) minmax(130px, 0.7fr)',
    gap: 8,
    alignItems: 'center',
    minHeight: 42,
    width: '100%',
    padding: '7px 9px',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: 4,
    background: active ? 'var(--control-bg-hover)' : 'var(--control-bg)',
    color: 'var(--text)',
    textAlign: 'left',
    cursor: 'pointer',
    overflow: 'hidden',
  };
}


// These are current-cycle, backend-returned outcomes, not reconstructed eligibility.
function OfficialSafeV2OutcomeSummary({ result }: { result: CorporateActionAutoApprovalResult | null }) {
  if (!result) return null;
  return (
    <div aria-label="Safe V2 outcome summary" style={{ ...corporateIssueHintTextStyle, whiteSpace: 'normal' }}>
      Safe V2: requested {result.requested} · eligible {result.eligible} · approved/linked {result.autoApproved + result.linkedExisting} · already approved {result.alreadyApproved} · skipped {result.skipped} · failed {result.failed}
    </div>
  );
}

function OfficialSafeV2SkippedReason({ reason }: { reason: string | undefined }) {
  if (!reason) return null;
  return (
    <span style={{ ...corporateIssueHintTextStyle, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      Safe V2 left for manual review: {reason}
    </span>
  );
}

function SavedCorporateActionValidationHistory({
  history,
  loading,
  onRefresh,
  onLoadMore,
}: {
  history: {
    run: CorporateActionActivityRun | null;
    items: CorporateActionValidationReportItem[];
    total: number;
    hasMore: boolean;
    error?: string;
  } | null;
  loading: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
}) {
  return (
    <section aria-label="Saved Corporate Actions validation history" style={{ marginTop: 10 }}>
      <h4>Saved validation snapshot</h4>
      <div style={buttonRowStyle}>
        <button type="button" disabled={loading} onClick={onRefresh}>Refresh saved history</button>
        <button type="button" disabled={loading || !history?.hasMore} onClick={onLoadMore}>Load more saved rows</button>
        {history?.run ? <span>Shown {history.items.length.toLocaleString('en-IN')} / {history.total.toLocaleString('en-IN')}</span> : null}
      </div>
      {loading ? <p role="status">Loading saved validation history…</p> : null}
      {history?.error ? <p role="alert">{history.error} Previously loaded saved rows are retained.</p> : null}
      {!loading && history && !history.run && !history.error ? <p>No saved Dividend validation report exists for this database.</p> : null}
      {history?.run ? <>
        <p>
          Historical evidence only — never current approval authority. Run {history.run.id} · {history.run.outcome} · checked {formatApprovalTime(history.run.completedAtUtc ?? history.run.startedAtUtc)} · requested {history.run.requestedCount.toLocaleString('en-IN')} · checked {history.run.checkedCount.toLocaleString('en-IN')} · eligible {history.run.eligibleCount.toLocaleString('en-IN')} · blocked {history.run.ineligibleCount.toLocaleString('en-IN')} · failed {history.run.failedCount.toLocaleString('en-IN')}.
        </p>
        {history.run.errorMessage ? <p role="alert">Saved run issue: {history.run.errorMessage}</p> : null}
        {history.items.length ? <div style={{ maxHeight: 240, overflowY: 'auto' }}>
          <table>
            <thead><tr><th>Import ID</th><th>Saved result</th><th>Stored state</th><th>Reason snapshot</th></tr></thead>
            <tbody>{history.items.map((item) => <tr key={item.id}>
              <td>{item.importId}</td><td>{item.resultCode}</td><td>{item.storedApprovalState ?? 'Unknown'}</td><td>{item.reasonSnapshot}</td>
            </tr>)}</tbody>
          </table>
        </div> : null}
      </> : null}
    </section>
  );
}

function OfficialDividendPreparedScopeOutcomeSummary({
  outcome,
}: {
  outcome: CorporateActionDividendPreparedScopeOutcomeState | null;
}) {
  if (!outcome) return null;
  const { result } = outcome;
  const blockerSummary = summarizeDividendBlockerReasons(result);
  return (
    <div
      aria-label="Dividend R1 read-only outcome summary"
      style={{ ...corporateIssueHintTextStyle, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
    >
      Dividend R1 read-only — NOT APPROVED: requested {result.requested}{result.reusedCount !== undefined && <> · reused {result.reusedCount} · policy evaluated {result.dispositions.length - result.reusedCount}</>} · eligible {result.eligible} (read-only, not approved) · ineligible {result.ineligible} · already approved {result.alreadyApproved} · stale {result.staleScope} · missing {result.missing} · failed {result.failed} · batches {result.completedBatchCount}/{result.batchCount} · {result.complete ? 'complete' : 'incomplete'}
      {result.operationalError ? <> · issue: {result.operationalError}</> : null}
      <details style={{ marginTop: 6, maxWidth: '100%' }}>
        <summary style={{ cursor: 'pointer' }}>
          Dividend R1 — exact blocked reasons ({blockerSummary.ineligibleObserved.toLocaleString('en-IN')})
        </summary>
        <div style={{ marginTop: 4 }}>
          {blockerSummary.completedWithoutError && blockerSummary.accountedFor
            ? 'Complete read-only rejection breakdown. Not approval evidence.'
            : 'Incomplete or inconsistent diagnostic — do not treat these counts as a complete baseline.'}
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto', marginTop: 4 }}>
          {blockerSummary.reasons.map(({ reason, count }) => (
            <div key={reason} style={{ marginBottom: 3 }}>
              <strong>{count.toLocaleString('en-IN')}</strong> — {reason}
            </div>
          ))}
        </div>
        <details style={pendingDiagnosticDisclosureStyle}>
          <summary style={{ cursor: 'pointer' }}>Copyable aggregate report (select text, Ctrl+A, Ctrl+C)</summary>
          <textarea
            aria-label="Dividend R1 aggregate blocker report"
            readOnly
            value={formatDividendBlockerReport(result)}
            rows={6}
            style={pendingDiagnosticReportStyle}
          />
        </details>
      </details>
    </div>
  );
}

function OfficialDividendPreparedScopeDispositionDetails({
  disposition,
}: {
  disposition: CorporateActionDividendPreparedScopeOutcomeState['result']['dispositions'][number] | undefined;
}) {
  if (!disposition) return null;
  const dispositionLabel = disposition.disposition === 'ELIGIBLE'
    ? 'ELIGIBLE (READ-ONLY, NOT APPROVED)'
    : disposition.disposition;
  const evidence = disposition.evidence;
  return (
    <span
      aria-label={`Dividend R1 read-only disposition ${disposition.importId}`}
      style={{ ...corporateIssueHintTextStyle, display: 'flex', flexDirection: 'column', gap: 2, whiteSpace: 'normal', overflowWrap: 'anywhere' }}
    >
      <span>Dividend R1 read-only — {dispositionLabel}: {disposition.reason}</span>
      {evidence ? (
        <>
          <span>Evidence: cash {formatCorporatePrice(evidence.cashAmount)} · previous close {formatCorporatePrice(evidence.previousClose)} on {evidence.previousTradeDate} · factor {evidence.computedFactor.toFixed(8)}</span>
          <span>Identity: {evidence.identityProof} · official evidence {evidence.officialEvidenceId}{evidence.sourceLocator ? ` · source ${evidence.sourceLocator}` : ''}</span>
        </>
      ) : null}
    </span>
  );
}

type OfficialImportTaskProgress = (CorporateActionPendingPreparationProgress | OfficialImportOperationProgress | {
  stage: 'dividend-verifying' | 'dividend-verified' | 'dividend-stopped';
  completed: number;
  total: number | null;
  message: string;
}) & {
  startedAt: number;
  endedAt?: number;
};

function OfficialImportTaskStatus({progress,canCancel,onCancel,compact = false,messageOverride}: {
  progress: OfficialImportTaskProgress;
  canCancel: boolean;
  onCancel: () => void;
  compact?: boolean;
  messageOverride?: string;
}) {
  const [now,setNow] = useState(Date.now());
  useEffect(() => {
    if (progress.endedAt != null) return;
    const timer = window.setInterval(() => setNow(Date.now()),1000);
    return () => window.clearInterval(timer);
  },[progress.startedAt,progress.endedAt]);
  const seconds = Math.max(0,Math.floor(((progress.endedAt ?? now)-progress.startedAt)/1000));
  const elapsed = `${Math.floor(seconds/60)}m ${seconds%60}s`;
  const currentMessage = messageOverride ?? progress.message;
  if (compact) {
    return (
      <section style={pendingCompactTaskStatusStyle} aria-label="Official Imports operation progress">
        <div role="status" aria-live="polite" style={pendingCompactTaskMessageStyle}>{messageOverride ?? progress.message}</div>
        <div style={pendingCompactTaskMetaStyle}>
          <span>Elapsed: {elapsed}</span>
          {progress.total == null ? <span>Total not yet known</span> : <span>Stage: {progress.completed} / {progress.total}</span>}
          {canCancel ? <button type="button" style={modalButtonStyle} onClick={onCancel}>Cancel after current check</button> : null}
          <details style={pendingCompactDetailsStyle}>
            <summary style={pendingCompactDetailsSummaryStyle}>Details</summary>
            <div style={pendingCompactDetailsBodyStyle}>
              <span>Operation stage: {progress.stage}</span>
              {!progress.endedAt ? <span>Waiting for the current operation to return; counts advance only after completion.</span> : null}
              {progress.message !== currentMessage ? <span>Earlier task message: {progress.message}</span> : null}
            </div>
          </details>
        </div>
      </section>
    );
  }
  return (
    <section style={officialImportSectionCardStyle} aria-label="Official Imports operation progress">
      <div role="status" aria-live="polite">{progress.message}</div>
      <div style={buttonRowStyle}>
        <span>Elapsed: {elapsed}</span>
        {progress.total == null ? <span>Total not yet known</span> : <span>Stage: {progress.completed} / {progress.total}</span>}
        {!progress.endedAt ? <span>Waiting for the current operation to return; counts advance only after completion.</span> : null}
        {canCancel ? <button type="button" style={modalButtonStyle} onClick={onCancel}>Cancel after current check</button> : null}
      </div>
    </section>
  );
}
