import type {
  CorporateActionEventIdentity,
  CorporateActionImportActionType,
  CorporateActionAutoApprovalResult,
  CorporateActionImportResolutionHint,
  CorporateActionImportRow,
  CorporateActionOfficialFetchInput,
  CorporateActionOfficialFetchResult,
  CorporateActionScanResultRow,
  DesktopApi,
} from '@/platform';
import {
  getCorporateActionPriceValidationPresentation,
  parseCorporateActionCompoundValidation,
  type CorporateActionPriceValidationPresentation,
} from '../corporateActionCompoundValidation';
import { addIndiaIsoDays } from '../corporateActionDate';
import {
  buildCorporateActionEconomicEventViewModels,
  type CorporateActionEconomicEventSourceRow,
  type CorporateActionEconomicEventViewModel,
} from '../corporateActionEconomicEventViewModel';
import {
  classifyCorporateActionValidation,
  getCorporateActionApprovalState,
  isSplitOrBonus,
  type CorporateActionApprovalState,
  type CorporateActionPriceValidationLabel,
} from '../corporateActionValidation';
import type {
  CorporateActionEventStatus,
  CorporateActionWorkflowFacts,
} from '../corporateActionWorkflow';
import {
  chunkCorporateActionApprovalIds,
  formatCorporateActionBulkApprovalProgress,
  formatCorporateActionBulkApprovalSummary,
} from '../corporateActionBulkApproval';
import {
  CorporateActionPendingPreparationStaleError,
  fetchOfficialCorporateActionsAndReload,
  loadCorporateActionImportRows,
  readExactCorporateActionImports,
  strictQuickResolveCorporateActionRows,
} from '../legacy/corporateActionImportOperations';

export const NORMAL_CORPORATE_ACTION_EXCHANGES = ['NSE', 'BSE'] as const;
export type CorporateActionNormalFetchExchangeSelection = 'BOTH' | 'NSE' | 'BSE';
export const NORMAL_CORPORATE_ACTION_ACTION_TYPES: readonly CorporateActionImportActionType[] = [
  'SPLIT',
  'BONUS',
  'RIGHTS',
  'DIVIDEND',
  'DEMERGER',
];
export const NORMAL_CORPORATE_ACTION_LOOKBACK_DAYS = 90;
export const NORMAL_CORPORATE_ACTION_LOAD_STEP = 1000;
export const NORMAL_CORPORATE_ACTION_SCAN_BATCH_SIZE = 500;
export const NORMAL_CORPORATE_ACTION_EVENT_IDENTITY_BATCH_SIZE = 500;

type NormalCorporateActionApi = Pick<
  DesktopApi,
  | 'fetchOfficialCorporateActions'
  | 'listCorporateActionImports'
  | 'listCorporateActionScanResults'
  | 'runCorporateActionScan'
  | 'listCorporateActionImportResolutionHints'
>;

type NormalCorporateActionLoadApi = NormalCorporateActionApi &
  Pick<
    DesktopApi,
    | 'quickResolveCorporateActionImport'
    | 'getCorporateActionImportsByIds'
    | 'autoApproveCorporateActionImports'
  >;

type NormalCorporateActionReviewApi = Pick<
  DesktopApi,
  'listCorporateActionEventIdentities'
>;
type NormalCorporateActionApprovalApi = NormalCorporateActionApi &
  NormalCorporateActionReviewApi &
  Pick<DesktopApi, 'approveCorporateActionImports'>;

export interface CorporateActionNormalWorkflowCounts {
  fetched: number;
  loaded: number;
  needsReview: number;
  conflicts: number;
  ready: number;
}

export interface CorporateActionNormalFetchResult {
  fetchResults: CorporateActionOfficialFetchResult[];
  rows: CorporateActionImportRow[];
  counts: Pick<CorporateActionNormalWorkflowCounts, 'fetched'>;
  rowsInserted: number;
  rowsDuplicate: number;
  rowsUnresolved: number;
}

export interface CorporateActionNormalLoadResult {
  rows: CorporateActionImportRow[];
  scanRows: CorporateActionScanResultRow[];
  identityHints: CorporateActionImportResolutionHint[];
  identityReviewCount: number;
  recommendedIdentityCount: number;
  validatedImportIds: number[];
  quickResolvedCount: number;
  autoApproval: CorporateActionAutoApprovalResult | null;
  autoApprovalReasons: Readonly<Record<number, string>>;
  counts: Omit<CorporateActionNormalWorkflowCounts, 'fetched'>;
}

export interface CorporateActionNormalReviewEvidenceRow {
  eventKey: string;
  importRow: CorporateActionImportRow;
  scan: CorporateActionScanResultRow | null;
  eventIdentity: CorporateActionEventIdentity | null;
  approvalState: CorporateActionApprovalState;
  validationLabel: CorporateActionPriceValidationLabel | 'NOT REQUIRED';
  status: CorporateActionEventStatus;
  statusReason: string | null;
  pricePresentation: CorporateActionPriceValidationPresentation | null;
}

export interface CorporateActionNormalReviewEvent {
  event: CorporateActionEconomicEventViewModel;
  evidenceRows: readonly CorporateActionNormalReviewEvidenceRow[];
}

export interface CorporateActionNormalReviewResult {
  events: readonly CorporateActionNormalReviewEvent[];
  eventIdentities: readonly CorporateActionEventIdentity[];
  counts: Pick<
    CorporateActionNormalWorkflowCounts,
    'loaded' | 'needsReview' | 'conflicts' | 'ready'
  >;
}


export interface CorporateActionNormalApprovalError {
  importId: number;
  message: string;
}

export interface CorporateActionNormalApprovalRecheckResult {
  requestedImportIds: readonly number[];
  readyImportIds: readonly number[];
  readyEventCount: number;
  alreadyProcessedImportIds: readonly number[];
  skippedImportIds: readonly number[];
  review: CorporateActionNormalReviewResult;
}

export interface CorporateActionNormalApprovalResult {
  requestedImportIds: readonly number[];
  recheck: CorporateActionNormalApprovalRecheckResult;
  postRecheck: CorporateActionNormalApprovalRecheckResult;
  approved: number;
  linkedExisting: number;
  alreadyApproved: number;
  failed: number;
  errors: readonly CorporateActionNormalApprovalError[];
  batchCount: number;
  batchesCompleted: number;
  batchFailure: string | null;
  message: string;
}
export type CorporateActionNormalWorkflowFactEvent =
  | { type: 'FETCH_STARTED' }
  | { type: 'FETCH_SUCCEEDED' }
  | { type: 'FETCH_FAILED' }
  | { type: 'LOAD_STARTED' }
  | { type: 'LOAD_SUCCEEDED'; readyCount: number; exceptionCount: number }
  | { type: 'LOAD_FAILED' }
  | { type: 'REVIEW_COMPLETED'; readyCount: number }
  | { type: 'APPROVAL_STARTED' }
  | { type: 'APPROVAL_FINISHED'; readyCount: number }
  | { type: 'APPROVAL_INTERRUPTED' };

export function createInitialCorporateActionNormalWorkflowFacts(): CorporateActionWorkflowFacts {
  return {
    fetchRetryRequired: false,
    hasFetchedBatchPendingLoad: false,
    loadState: 'idle',
    hasProcessedBatchPendingReview: false,
    reviewCheckpointCompleted: false,
    remainingReadyCount: 0,
    approvalState: 'idle',
  };
}

export function reduceCorporateActionNormalWorkflowFacts(
  facts: CorporateActionWorkflowFacts,
  event: CorporateActionNormalWorkflowFactEvent,
): CorporateActionWorkflowFacts {
  if (event.type === 'FETCH_STARTED') {
    return {
      ...facts,
      fetchRetryRequired: false,
    };
  }

  if (event.type === 'FETCH_SUCCEEDED') {
    return {
      ...facts,
      fetchRetryRequired: false,
      hasFetchedBatchPendingLoad: true,
      loadState: 'idle',
      hasProcessedBatchPendingReview: false,
      reviewCheckpointCompleted: false,
      remainingReadyCount: 0,
      approvalState: 'idle',
    };
  }

  if (event.type === 'FETCH_FAILED') {
    return {
      ...facts,
      fetchRetryRequired: true,
    };
  }

  if (event.type === 'LOAD_STARTED') {
    return {
      ...facts,
      loadState: 'processing',
    };
  }

  if (event.type === 'LOAD_SUCCEEDED') {
    const hasExceptions = event.exceptionCount > 0;
    return {
      ...facts,
      hasFetchedBatchPendingLoad: false,
      loadState: 'complete',
      hasProcessedBatchPendingReview: hasExceptions,
      reviewCheckpointCompleted: !hasExceptions,
      remainingReadyCount: event.readyCount,
      approvalState: 'idle',
    };
  }

  if (event.type === 'REVIEW_COMPLETED') {
    return {
      ...facts,
      reviewCheckpointCompleted: true,
      remainingReadyCount: event.readyCount,
    };
  }


  if (event.type === 'APPROVAL_STARTED') {
    return {
      ...facts,
      approvalState: 'processing',
    };
  }

  if (event.type === 'APPROVAL_FINISHED') {
    return {
      ...facts,
      remainingReadyCount: event.readyCount,
      approvalState: event.readyCount > 0 ? 'partial' : 'complete',
    };
  }

  if (event.type === 'APPROVAL_INTERRUPTED') {
    return {
      ...facts,
      approvalState: facts.remainingReadyCount > 0 ? 'partial' : 'complete',
    };
  }

  return {
    ...facts,
    loadState: 'interrupted',
  };
}

export interface CorporateActionNormalFetchRange {
  fromDate: string;
  toDate: string;
}

export function buildCorporateActionNormalDefaultFetchRange(
  asOfDate: string,
): CorporateActionNormalFetchRange {
  return {
    fromDate: addIndiaIsoDays(asOfDate, -NORMAL_CORPORATE_ACTION_LOOKBACK_DAYS),
    toDate: asOfDate,
  };
}

function normalizeCorporateActionNormalFetchRange(
  rangeOrAsOfDate: CorporateActionNormalFetchRange | string,
): CorporateActionNormalFetchRange {
  const range = typeof rangeOrAsOfDate === 'string'
    ? buildCorporateActionNormalDefaultFetchRange(rangeOrAsOfDate)
    : rangeOrAsOfDate;

  if (!range.fromDate || !range.toDate) {
    throw new Error('Choose both From and To dates.');
  }

  if (range.fromDate > range.toDate) {
    throw new Error('From date must be on or before To date.');
  }

  return range;
}

export function buildCorporateActionNormalFetchInputs(
  rangeOrAsOfDate: CorporateActionNormalFetchRange | string,
  exchangeSelection: CorporateActionNormalFetchExchangeSelection = 'BOTH',
) {
  const { fromDate, toDate } = normalizeCorporateActionNormalFetchRange(rangeOrAsOfDate);
  let exchanges: readonly (typeof NORMAL_CORPORATE_ACTION_EXCHANGES)[number][] =
    NORMAL_CORPORATE_ACTION_EXCHANGES;

  if (exchangeSelection === 'NSE') {
    exchanges = ['NSE'];
  }
  if (exchangeSelection === 'BSE') {
    exchanges = ['BSE'];
  }

  return exchanges.map((exchange) => ({
    exchange,
    fromDate,
    toDate,
    forceRefresh: false,
  }));
}

function buildNormalReviewListInput(limit: number) {
  return {
    limit,
    actionTypes: [...NORMAL_CORPORATE_ACTION_ACTION_TYPES],
    searchQuery: null,
    reviewStatus: null,
    excludeApproved: true,
  };
}

export async function fetchCorporateActionNormalData({
  api,
  asOfDate,
  fromDate,
  toDate,
  exchangeSelection = 'BOTH',
  onExchangeStarted,
  onExchangeCompleted,
  onExchangeFailed,
  shouldCancel,
}: {
  api: NormalCorporateActionApi;
  asOfDate?: string;
  fromDate?: string;
  toDate?: string;
  exchangeSelection?: CorporateActionNormalFetchExchangeSelection;
  shouldCancel?: () => boolean;
  onExchangeStarted?: (
    exchange: (typeof NORMAL_CORPORATE_ACTION_EXCHANGES)[number],
    input: CorporateActionOfficialFetchInput,
  ) => void;
  onExchangeCompleted?: (
    exchange: (typeof NORMAL_CORPORATE_ACTION_EXCHANGES)[number],
    result: CorporateActionOfficialFetchResult,
  ) => void;
  onExchangeFailed?: (
    exchange: (typeof NORMAL_CORPORATE_ACTION_EXCHANGES)[number],
    error: unknown,
  ) => void;
}): Promise<CorporateActionNormalFetchResult> {
  const fetchResults: CorporateActionOfficialFetchResult[] = [];
  let rows: CorporateActionImportRow[] = [];
  let range: CorporateActionNormalFetchRange | string = { fromDate: '', toDate: '' };

  if (fromDate != null || toDate != null) {
    range = { fromDate: fromDate ?? '', toDate: toDate ?? '' };
  }
  if (fromDate == null && toDate == null && asOfDate) {
    range = asOfDate;
  }

  for (const fetchInput of buildCorporateActionNormalFetchInputs(range, exchangeSelection)) {
    if (shouldCancel?.()) throw new Error('Official fetch cancelled. Completed windows are saved; fetch again to resume.');
    onExchangeStarted?.(fetchInput.exchange, fetchInput);

    try {
      const result = await fetchOfficialCorporateActionsAndReload({
        api,
        fetchInput,
        listInput: buildNormalReviewListInput(NORMAL_CORPORATE_ACTION_LOAD_STEP),
      });
      fetchResults.push(result.fetchResult);
      rows = result.rows;
      onExchangeCompleted?.(fetchInput.exchange, result.fetchResult);
    } catch (error) {
      onExchangeFailed?.(fetchInput.exchange, error);
      throw error;
    }
  }

  if (shouldCancel?.()) throw new Error('Official fetch cancelled. Completed windows are saved; fetch again to resume.');
  return {
    fetchResults,
    rows,
    counts: {
      fetched: fetchResults.reduce((sum, result) => sum + result.rowsRead, 0),
    },
    rowsInserted: fetchResults.reduce((sum, result) => sum + result.rowsInserted, 0),
    rowsDuplicate: fetchResults.reduce((sum, result) => sum + result.rowsDuplicate, 0),
    rowsUnresolved: fetchResults.reduce((sum, result) => sum + result.rowsUnresolved, 0),
  };
}

async function loadAllNormalReviewRows(api: NormalCorporateActionApi): Promise<CorporateActionImportRow[]> {
  let requestedLimit = NORMAL_CORPORATE_ACTION_LOAD_STEP;

  for (;;) {
    const result = await loadCorporateActionImportRows({
      api,
      listInput: buildNormalReviewListInput(requestedLimit),
      includeApprovedValidation: false,
    });

    if (result.rows.length < requestedLimit) {
      return result.rows;
    }

    requestedLimit += NORMAL_CORPORATE_ACTION_LOAD_STEP;
  }
}

function getNormalValidationImportIds(rows: readonly CorporateActionImportRow[]): number[] {
  return [...new Set(
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
}

async function validateNormalSplitBonusRows(
  api: NormalCorporateActionApi,
  importIds: readonly number[],
  shouldContinue?: () => boolean,
): Promise<CorporateActionScanResultRow[]> {
  const scanRows: CorporateActionScanResultRow[] = [];

  for (let start = 0; start < importIds.length; start += NORMAL_CORPORATE_ACTION_SCAN_BATCH_SIZE) {
    const batch = importIds.slice(start, start + NORMAL_CORPORATE_ACTION_SCAN_BATCH_SIZE);
    assertNormalLoadCurrent(shouldContinue);
    const result = await api.runCorporateActionScan({ scope: 'official_imports', importIds: batch });
    assertNormalLoadCurrent(shouldContinue);
    scanRows.push(...result.results);
  }

  return scanRows;
}

async function loadNormalIdentityHints(
  api: NormalCorporateActionApi,
  rows: readonly CorporateActionImportRow[],
): Promise<CorporateActionImportResolutionHint[]> {
  const importIds = rows
    .filter((row) => row.reviewStatus === 'PENDING_ISIN_MISMATCH')
    .map((row) => row.id);

  if (importIds.length === 0) {
    return [];
  }

  const result = await api.listCorporateActionImportResolutionHints({ importIds });
  return result.hints;
}

function assertNormalLoadCurrent(shouldContinue?: () => boolean): void {
  if (shouldContinue && !shouldContinue()) {
    throw new CorporateActionPendingPreparationStaleError();
  }
}

function latestScanByImportId(
  scanRows: readonly CorporateActionScanResultRow[],
): Map<number, CorporateActionScanResultRow> {
  const result = new Map<number, CorporateActionScanResultRow>();
  for (const scan of scanRows) {
    if (scan.corporateActionImportId != null) {
      result.set(scan.corporateActionImportId, scan);
    }
  }
  return result;
}

export function classifyCorporateActionNormalRows(
  rows: readonly CorporateActionImportRow[],
  scanRows: readonly CorporateActionScanResultRow[],
): Pick<CorporateActionNormalWorkflowCounts, 'loaded' | 'needsReview' | 'conflicts' | 'ready'> {
  const scans = latestScanByImportId(scanRows);
  let ready = 0;
  let needsReview = 0;
  let conflicts = 0;

  for (const row of rows) {
    const scan = scans.get(row.id);
    const approvalState = getCorporateActionApprovalState(row, scan);

    if (approvalState === 'READY TO APPROVE') {
      ready += 1;
      continue;
    }

    if (approvalState === 'ISIN REVIEW REQUIRED') {
      conflicts += 1;
      continue;
    }

    if (approvalState === 'NEEDS REVIEW') {
      const priceState = classifyCorporateActionValidation(row, scan);
      if (priceState === 'NEEDS REVIEW') {
        conflicts += 1;
        continue;
      }
      needsReview += 1;
      continue;
    }

    if (approvalState === 'APPROVED') {
      continue;
    }

    needsReview += 1;
  }

  return {
    loaded: rows.length,
    needsReview,
    conflicts,
    ready,
  };
}

export async function loadCorporateActionNormalData({
  api,
  expectedDatabasePath = '',
  autoApproveSplitBonus = false,
  shouldContinue,
}: {
  api: NormalCorporateActionLoadApi;
  expectedDatabasePath?: string;
  autoApproveSplitBonus?: boolean;
  shouldContinue?: () => boolean;
}): Promise<CorporateActionNormalLoadResult> {
  const initialRows = await loadAllNormalReviewRows(api);
  const useFreshNormalScope = Boolean(expectedDatabasePath.trim());
  const quickResolved = useFreshNormalScope
    ? await strictQuickResolveCorporateActionRows({ api, rows: initialRows, shouldContinue })
    : { rows: initialRows, resolvedCount: 0, errors: [] };
  const scopedIds = initialRows.map((row) => row.id);
  const freshRows = useFreshNormalScope && scopedIds.length > 0
    ? await readExactCorporateActionImports(api, scopedIds, expectedDatabasePath, shouldContinue)
    : quickResolved.rows;
  const stepErrorIds = new Set(
    quickResolved.errors.flatMap((entry) => (entry.importId == null ? [] : [entry.importId])),
  );
  const identityReviewCount = freshRows.filter(
    (row) => row.reviewStatus === 'PENDING_ISIN_MISMATCH',
  ).length;
  const identityHints = await loadNormalIdentityHints(api, freshRows);
  const recommendedIdentityCount = identityHints.filter(
    (hint) => hint.recommendedIsinException,
  ).length;
  const validatedImportIds = getNormalValidationImportIds(freshRows);
  const scanRows = await validateNormalSplitBonusRows(api, validatedImportIds, shouldContinue);
  const returnedScanIds = new Set(
    scanRows.flatMap((row) =>
      row.corporateActionImportId == null ? [] : [row.corporateActionImportId],
    ),
  );
  const autoApprovalScopeIds = freshRows
    .filter(
      (row) =>
        row.exchange === 'NSE' &&
        isSplitOrBonus(row) &&
        row.parseStatus === 'PARSED' &&
        row.reviewStatus === 'PENDING' &&
        returnedScanIds.has(row.id) &&
        !stepErrorIds.has(row.id),
    )
    .map((row) => row.id);

  let autoApproval: CorporateActionAutoApprovalResult | null = null;
  const autoApprovalReasons: Record<number, string> = {};

  if (autoApproveSplitBonus && autoApprovalScopeIds.length > 0) {
    if (!expectedDatabasePath.trim()) throw new Error('The reviewed database context is missing.');
    const aggregate: CorporateActionAutoApprovalResult = {
      requested: 0,
      eligible: 0,
      autoApproved: 0,
      linkedExisting: 0,
      alreadyApproved: 0,
      skipped: 0,
      failed: 0,
      dispositions: [],
      policyVersion: 'AUTO_APPROVAL_SAFE_V2',
      message: '',
    };

    for (const batch of chunkCorporateActionApprovalIds(autoApprovalScopeIds)) {
      assertNormalLoadCurrent(shouldContinue);
      const batchResult = await api.autoApproveCorporateActionImports({
        importIds: batch,
        expectedDatabasePath,
      });
      assertNormalLoadCurrent(shouldContinue);
      aggregate.requested += batchResult.requested;
      aggregate.eligible += batchResult.eligible;
      aggregate.autoApproved += batchResult.autoApproved;
      aggregate.linkedExisting += batchResult.linkedExisting;
      aggregate.alreadyApproved += batchResult.alreadyApproved;
      aggregate.skipped += batchResult.skipped;
      aggregate.failed += batchResult.failed;
      aggregate.dispositions.push(...batchResult.dispositions);
      for (const disposition of batchResult.dispositions) {
        if (disposition.disposition === 'SKIPPED' || disposition.disposition === 'FAILED') {
          autoApprovalReasons[disposition.importId] = disposition.reason;
        }
      }
    }
    aggregate.message = `Auto-Approval Safe V2: ${aggregate.autoApproved} approved, ${aggregate.linkedExisting} linked existing, ${aggregate.alreadyApproved} already approved, ${aggregate.skipped} left for review, ${aggregate.failed} failed.`;
    autoApproval = aggregate;
  }

  const finalRows = useFreshNormalScope && scopedIds.length > 0
    ? await readExactCorporateActionImports(api, scopedIds, expectedDatabasePath, shouldContinue)
    : freshRows;

  return {
    rows: finalRows,
    scanRows,
    identityHints,
    identityReviewCount,
    recommendedIdentityCount,
    validatedImportIds,
    quickResolvedCount: quickResolved.resolvedCount,
    autoApproval,
    autoApprovalReasons,
    counts: classifyCorporateActionNormalRows(finalRows, scanRows),
  };
}


async function loadCorporateActionNormalApprovalRecheckData(
  api: NormalCorporateActionApi,
): Promise<CorporateActionNormalLoadResult> {
  const rows = await loadAllNormalReviewRows(api);
  const validatedImportIds = getNormalValidationImportIds(rows);
  const scanRows = await validateNormalSplitBonusRows(api, validatedImportIds);
  const identityReviewCount = rows.filter(
    (row) => row.reviewStatus === 'PENDING_ISIN_MISMATCH',
  ).length;
  const identityHints = await loadNormalIdentityHints(api, rows);
  const recommendedIdentityCount = identityHints.filter(
    (hint) => hint.recommendedIsinException,
  ).length;

  return {
    rows,
    scanRows,
    identityHints,
    identityReviewCount,
    recommendedIdentityCount,
    validatedImportIds,
    quickResolvedCount: 0,
    autoApproval: null,
    autoApprovalReasons: {},
    counts: classifyCorporateActionNormalRows(rows, scanRows),
  };
}

async function loadNormalEventIdentities(
  api: NormalCorporateActionReviewApi,
  rows: readonly CorporateActionImportRow[],
): Promise<{ identities: CorporateActionEventIdentity[]; existingDividends: Map<number, number> }> {
  const ids = [...new Set(rows.map((row) => row.id))];
  const identities: CorporateActionEventIdentity[] = [];
  const existingDividends = new Map<number, number>();

  for (
    let start = 0;
    start < ids.length;
    start += NORMAL_CORPORATE_ACTION_EVENT_IDENTITY_BATCH_SIZE
  ) {
    const batch = ids.slice(start, start + NORMAL_CORPORATE_ACTION_EVENT_IDENTITY_BATCH_SIZE);
    const result = await api.listCorporateActionEventIdentities({ importIds: batch });
    identities.push(...result.identities);
    for (const match of result.existingDividends ?? []) {
      if (!batch.includes(match.importId) || !Number.isSafeInteger(match.corporateActionId) ||
          match.corporateActionId <= 0 || existingDividends.has(match.importId)) {
        throw new Error('Invalid existing Dividend classification response');
      }
      existingDividends.set(match.importId, match.corporateActionId);
    }
  }

  return { identities, existingDividends };
}

function buildEventIdentityMap(
  identities: readonly CorporateActionEventIdentity[],
): Map<number, CorporateActionEventIdentity> {
  return new Map(identities.map((identity) => [identity.importId, identity]));
}

function normalReviewEventKey(
  row: CorporateActionImportRow,
  scan: CorporateActionScanResultRow | null,
): string {
  const compound = parseCorporateActionCompoundValidation(scan?.message);
  if (compound) {
    const fingerprint = compound.fingerprint.trim();
    if (!fingerprint) {
      throw new Error(`Corporate Action import ${row.id} has an empty compound fingerprint`);
    }
    return `compound:${fingerprint}`;
  }
  return `import:${row.id}`;
}

function normalReviewStatus(
  approvalState: CorporateActionApprovalState,
  validationLabel: CorporateActionPriceValidationLabel | 'NOT REQUIRED',
): CorporateActionEventStatus {
  if (approvalState === 'READY TO APPROVE') {
    return 'READY';
  }
  if (approvalState === 'APPROVED') {
    return 'APPROVED';
  }
  if (approvalState === 'ISIN REVIEW REQUIRED') {
    return 'CONFLICT';
  }
  if (approvalState === 'NEEDS REVIEW' && validationLabel === 'NEEDS REVIEW') {
    return 'CONFLICT';
  }
  return 'NEEDS_REVIEW';
}

function normalReviewStatusReason(
  row: CorporateActionImportRow,
  approvalState: CorporateActionApprovalState,
  validationLabel: CorporateActionPriceValidationLabel | 'NOT REQUIRED',
): string | null {
  if (approvalState === 'READY TO APPROVE' || approvalState === 'APPROVED') {
    return null;
  }
  if (approvalState === 'ISIN REVIEW REQUIRED') {
    return 'Historical ISIN evidence requires review';
  }
  if (approvalState === 'MATCH REQUIRED') {
    return 'Identity match is required';
  }
  if (approvalState === 'NEEDS VALIDATION') {
    return 'Split/Bonus price validation is required';
  }
  if (approvalState === 'NEEDS REVIEW' && validationLabel === 'NO PRICE DATA') {
    return 'Local price evidence is unavailable';
  }
  if (approvalState === 'NEEDS REVIEW' && validationLabel === 'NEEDS REVIEW') {
    return 'Price validation conflicts with the expected action';
  }
  if (row.parseStatus !== 'PARSED') {
    return 'Official action could not be parsed safely';
  }
  if (approvalState === 'NOT APPROVABLE') {
    return 'Action is not approvable in the routine workflow';
  }
  return 'Corporate Action requires review';
}

function reviewEvidenceRows(
  rows: readonly CorporateActionImportRow[],
  scanRows: readonly CorporateActionScanResultRow[],
  eventIdentities: readonly CorporateActionEventIdentity[],
  backendReasons: Readonly<Record<number, string>>,
  existingDividends: ReadonlyMap<number, number>,
): CorporateActionNormalReviewEvidenceRow[] {
  const scans = latestScanByImportId(scanRows);
  const identities = buildEventIdentityMap(eventIdentities);

  return rows.map((row) => {
    const scan = scans.get(row.id) ?? null;
    const eventIdentity = identities.get(row.id) ?? null;
    if (eventIdentity?.resolved && !eventIdentity.eventSymbol) {
      throw new Error(`Corporate Action import ${row.id} has resolved identity without eventSymbol`);
    }
    const approvalState = getCorporateActionApprovalState(row, scan);
    const validationLabel = isSplitOrBonus(row)
      ? classifyCorporateActionValidation(row, scan)
      : 'NOT REQUIRED';
    const existingId = row.actionType === 'DIVIDEND' && row.reviewStatus === 'PENDING' &&
      row.approvedCorporateActionId == null ? existingDividends.get(row.id) : undefined;
    const status = existingId != null ? 'ALREADY_PROCESSED' : normalReviewStatus(approvalState, validationLabel);
    const statusReason =
      existingId != null
        ? `Already represented by verified canonical Dividend #${existingId}; no new adjustment required.`
        : status === 'APPROVED'
        ? null
        : backendReasons[row.id] ?? normalReviewStatusReason(row, approvalState, validationLabel);
    const pricePresentation = isSplitOrBonus(row)
      ? getCorporateActionPriceValidationPresentation(scan)
      : null;

    return {
      eventKey: normalReviewEventKey(row, scan),
      importRow: row,
      scan,
      eventIdentity,
      approvalState,
      validationLabel,
      status,
      statusReason,
      pricePresentation,
    };
  });
}

function economicSourceRows(
  evidenceRows: readonly CorporateActionNormalReviewEvidenceRow[],
): CorporateActionEconomicEventSourceRow[] {
  return evidenceRows.map((evidence) => {
    const row = evidence.importRow;
    const symbol = evidence.eventIdentity?.resolved
      ? evidence.eventIdentity.eventSymbol
      : row.symbol;

    return {
      eventKey: evidence.eventKey,
      importId: row.id,
      exchange: row.exchange,
      symbol,
      companyName: row.companyName,
      exDate: row.exDate,
      actionType: row.actionType,
      shareFactor: row.factor,
      status: evidence.status,
      statusReason: evidence.statusReason,
      source: row.source,
      evidenceCount: row.evidenceCount,
      pricePresentation: evidence.pricePresentation,
    };
  });
}

function normalReviewEventCounts(
  events: readonly CorporateActionEconomicEventViewModel[],
): CorporateActionNormalReviewResult['counts'] {
  return {
    loaded: events.length,
    needsReview: events.filter((event) => event.status === 'NEEDS_REVIEW').length,
    conflicts: events.filter((event) => event.status === 'CONFLICT').length,
    ready: events.filter((event) => event.status === 'READY').length,
  };
}

export async function buildCorporateActionNormalReviewData({
  api,
  rows,
  scanRows,
  backendReasons = {},
}: {
  api: NormalCorporateActionReviewApi;
  rows: readonly CorporateActionImportRow[];
  scanRows: readonly CorporateActionScanResultRow[];
  backendReasons?: Readonly<Record<number, string>>;
}): Promise<CorporateActionNormalReviewResult> {
  const { identities: eventIdentities, existingDividends } = await loadNormalEventIdentities(api, rows);
  const evidenceRows = reviewEvidenceRows(rows, scanRows, eventIdentities, backendReasons, existingDividends);
  const eventModels = buildCorporateActionEconomicEventViewModels(
    economicSourceRows(evidenceRows),
  );
  const evidenceByKey = new Map<string, CorporateActionNormalReviewEvidenceRow[]>();

  for (const evidence of evidenceRows) {
    const existing = evidenceByKey.get(evidence.eventKey);
    if (existing) {
      existing.push(evidence);
      continue;
    }
    evidenceByKey.set(evidence.eventKey, [evidence]);
  }

  const events = eventModels.map((event) => ({
    event,
    evidenceRows: [...(evidenceByKey.get(event.eventKey) ?? [])].sort(
      (left, right) => left.importRow.id - right.importRow.id,
    ),
  }));

  return {
    events,
    eventIdentities,
    counts: normalReviewEventCounts(eventModels),
  };
}

function normalizeCorporateActionNormalApprovalIds(importIds: readonly number[]): number[] {
  return chunkCorporateActionApprovalIds([...importIds]).flat();
}

export function getCorporateActionNormalReadyImportIds(
  events: readonly CorporateActionNormalReviewEvent[],
): number[] {
  const importIds = events
    .filter((item) => item.event.status === 'READY')
    .flatMap((item) => item.evidenceRows.map((evidence) => evidence.importRow.id));
  return normalizeCorporateActionNormalApprovalIds(importIds);
}


function countCorporateActionNormalReadyEventsForImportIds(
  events: readonly CorporateActionNormalReviewEvent[],
  importIds: readonly number[],
): number {
  const readyIds = new Set(importIds);
  return events.filter(
    (item) =>
      item.event.status === 'READY' &&
      item.evidenceRows.some((evidence) => readyIds.has(evidence.importRow.id)),
  ).length;
}

async function loadApprovedNormalImportRows(
  api: NormalCorporateActionApprovalApi,
): Promise<CorporateActionImportRow[]> {
  let requestedLimit = NORMAL_CORPORATE_ACTION_LOAD_STEP;

  for (;;) {
    const rows = await api.listCorporateActionImports({
      limit: requestedLimit,
      actionTypes: [...NORMAL_CORPORATE_ACTION_ACTION_TYPES],
      searchQuery: null,
      reviewStatus: 'APPROVED',
      excludeApproved: false,
    });
    if (rows.length < requestedLimit) {
      return rows;
    }
    requestedLimit += NORMAL_CORPORATE_ACTION_LOAD_STEP;
  }
}

export async function recheckCorporateActionNormalApprovalData({
  api,
  requestedImportIds,
}: {
  api: NormalCorporateActionApprovalApi;
  requestedImportIds: readonly number[];
}): Promise<CorporateActionNormalApprovalRecheckResult> {
  const normalizedRequestedIds = normalizeCorporateActionNormalApprovalIds(requestedImportIds);
  const loaded = await loadCorporateActionNormalApprovalRecheckData(api);
  const review = await buildCorporateActionNormalReviewData({
    api,
    rows: loaded.rows,
    scanRows: loaded.scanRows,
  });
  const currentReadyIds = new Set(getCorporateActionNormalReadyImportIds(review.events));
  const approvedRows = await loadApprovedNormalImportRows(api);
  const approvedIds = new Set(approvedRows.map((row) => row.id));
  const existingIds = new Set(review.events.filter((item) => item.event.status === 'ALREADY_PROCESSED')
    .flatMap((item) => item.evidenceRows.map((evidence) => evidence.importRow.id)));
  const readyImportIds: number[] = [];
  const alreadyProcessedImportIds: number[] = [];
  const skippedImportIds: number[] = [];

  for (const importId of normalizedRequestedIds) {
    if (currentReadyIds.has(importId)) {
      readyImportIds.push(importId);
      continue;
    }
    if (approvedIds.has(importId) || existingIds.has(importId)) {
      alreadyProcessedImportIds.push(importId);
      continue;
    }
    skippedImportIds.push(importId);
  }

  return {
    requestedImportIds: normalizedRequestedIds,
    readyImportIds,
    readyEventCount: countCorporateActionNormalReadyEventsForImportIds(review.events, readyImportIds),
    alreadyProcessedImportIds,
    skippedImportIds,
    review,
  };
}

function normalApprovalErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return String(error);
}

export async function approveCorporateActionNormalReady({
  api,
  reviewEvents,
  expectedDatabasePath,
  onProgress,
}: {
  api: NormalCorporateActionApprovalApi;
  reviewEvents: readonly CorporateActionNormalReviewEvent[];
  expectedDatabasePath: string;
  onProgress?: (message: string) => void;
}): Promise<CorporateActionNormalApprovalResult> {
  if (!expectedDatabasePath.trim()) throw new Error('The reviewed database context is missing.');
  const requestedImportIds = getCorporateActionNormalReadyImportIds(reviewEvents);
  const recheck = await recheckCorporateActionNormalApprovalData({ api, requestedImportIds });
  const batches = chunkCorporateActionApprovalIds([...recheck.readyImportIds]);
  const errors: CorporateActionNormalApprovalError[] = [];
  let approved = 0;
  let linkedExisting = 0;
  let alreadyApproved = 0;
  let failed = 0;
  let batchesCompleted = 0;
  let processed = 0;
  let batchFailure: string | null = null;

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const importIds = batches[batchIndex];
    onProgress?.(
      formatCorporateActionBulkApprovalProgress({
        total: recheck.readyImportIds.length,
        batchNumber: batchIndex + 1,
        batchCount: batches.length,
        batchSize: importIds.length,
        processed,
      }),
    );

    try {
      const result = await api.approveCorporateActionImports({ importIds, expectedDatabasePath });
      approved += result.approved;
      linkedExisting += result.linkedExisting;
      alreadyApproved += result.alreadyApproved;
      failed += result.failed;
      errors.push(...result.errors);
      processed += importIds.length;
      batchesCompleted += 1;
    } catch (error) {
      batchFailure = `Bulk approval stopped at batch ${batchIndex + 1}/${batches.length} after ${processed}/${recheck.readyImportIds.length} row(s). ${normalApprovalErrorMessage(error)}`;
      break;
    }
  }

  const postRecheck = await recheckCorporateActionNormalApprovalData({ api, requestedImportIds });
  const recheckSummary = `Authoritative recheck: ${requestedImportIds.length} reviewed Ready import(s); ${recheck.readyImportIds.length} still Ready, ${recheck.alreadyProcessedImportIds.length} already processed, ${recheck.skippedImportIds.length} no longer eligible.`;
  const approvalSummary = recheck.readyImportIds.length
    ? formatCorporateActionBulkApprovalSummary({
        requested: recheck.readyImportIds.length,
        approved,
        linkedExisting,
        alreadyApproved,
        failed,
        batchCount: batches.length,
      })
    : 'No reviewed Ready imports remained eligible for approval.';
  const remainingSummary = `${postRecheck.readyImportIds.length} reviewed import(s) remain Ready after the approval attempt.`;
  const message = [recheckSummary, approvalSummary, batchFailure, remainingSummary]
    .filter((value): value is string => Boolean(value))
    .join(' ');

  return {
    requestedImportIds,
    recheck,
    postRecheck,
    approved,
    linkedExisting,
    alreadyApproved,
    failed,
    errors,
    batchCount: batches.length,
    batchesCompleted,
    batchFailure,
    message,
  };
}
