import type {
  CorporateActionImportListInput,
  CorporateActionImportRow,
  CorporateActionOfficialFetchInput,
  CorporateActionOfficialFetchResult,
  CorporateActionImportResolutionHint,
  CorporateActionScanResultRow,
  CorporateActionResult,
  CorporateActionImportBulkApprovalResult,
  CorporateActionAutoApprovalResult,
  DesktopApi,
} from '@/platform';
import { getCorporateActionApprovalState, getCorporateActionNormalApprovalState, isSplitOrBonus } from '../corporateActionValidation';
import { chunkCorporateActionApprovalIds } from '../corporateActionBulkApproval';
import { hasCombinedSplitBonusAnnouncement, needsCorporateActionClassificationRefresh } from './corporateActionAnnouncementClassification';
import {
  CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY,
  parseCorporateActionSplitBonusAutoApprovalSetting,
} from '../workflow/corporateActionAutoApprovalSettings';

const APPROVED_VALIDATION_BATCH_SIZE = 500;

type CorporateActionImportOperationsApi = Pick<
  DesktopApi,
  'fetchOfficialCorporateActions' | 'listCorporateActionImports' | 'listCorporateActionScanResults'
>;

export interface LoadCorporateActionImportRowsInput {
  api: CorporateActionImportOperationsApi;
  listInput: CorporateActionImportListInput;
  includeApprovedValidation: boolean;
}

export interface LoadCorporateActionImportRowsResult {
  rows: CorporateActionImportRow[];
  validationRows: CorporateActionScanResultRow[];
  validationImportIds: number[];
}

export async function loadCorporateActionImportRows({
  api,
  listInput,
  includeApprovedValidation,
}: LoadCorporateActionImportRowsInput): Promise<LoadCorporateActionImportRowsResult> {
  const rows = await api.listCorporateActionImports(listInput);
  const validationImportIds = includeApprovedValidation
    ? [...new Set(rows.filter((row) => isSplitOrBonus(row)).map((row) => row.id))]
    : [];
  const validationRows: CorporateActionScanResultRow[] = [];

  for (let start = 0; start < validationImportIds.length; start += APPROVED_VALIDATION_BATCH_SIZE) {
    const batch = validationImportIds.slice(start, start + APPROVED_VALIDATION_BATCH_SIZE);
    const result = await api.listCorporateActionScanResults({ importIds: batch });
    validationRows.push(...result.results);
  }

  return { rows, validationRows, validationImportIds };
}

export interface FetchOfficialCorporateActionsAndReloadInput {
  api: CorporateActionImportOperationsApi;
  fetchInput: CorporateActionOfficialFetchInput;
  listInput: CorporateActionImportListInput;
}

export interface FetchOfficialCorporateActionsAndReloadResult {
  fetchResult: CorporateActionOfficialFetchResult;
  rows: CorporateActionImportRow[];
}

export async function fetchOfficialCorporateActionsAndReload({
  api,
  fetchInput,
  listInput,
}: FetchOfficialCorporateActionsAndReloadInput): Promise<FetchOfficialCorporateActionsAndReloadResult> {
  const fetchResult = await api.fetchOfficialCorporateActions(fetchInput);
  const rows = await api.listCorporateActionImports(listInput);
  return { fetchResult, rows };
}


const PENDING_IMPORT_PAGE_SIZE = 1000;
const PENDING_IMPORT_MAX_OFFSET = 1_000_000;
const PENDING_HINT_BATCH_SIZE = 100;
const PENDING_VALIDATION_BATCH_SIZE = 500;

export type CorporateActionPendingPreparationStage =
  | 'loading'
  | 'matching'
  | 'resolving'
  | 'identity'
  | 'validating'
  | 'auto-approving'
  | 'complete';

export interface CorporateActionPendingPreparationProgress {
  stage: CorporateActionPendingPreparationStage;
  message: string;
  completed: number;
  total: number | null;
}

export interface CorporateActionPendingPreparationError {
  importId: number | null;
  stage: Exclude<CorporateActionPendingPreparationStage, 'complete'>;
  message: string;
}

export interface CorporateActionPendingPreparationResult {
  rows: CorporateActionImportRow[];
  validationRows: CorporateActionScanResultRow[];
  validationImportIds: number[];
  identityHints: Record<number, CorporateActionImportResolutionHint>;
  autoApproval: CorporateActionAutoApprovalResult | null;
  errors: CorporateActionPendingPreparationError[];
  complete: boolean;
  message: string;
}

type CorporateActionPendingPreparationApi = Pick<
  DesktopApi,
  | 'listCorporateActionImports'
  | 'listCorporateActionImportResolutionHints'
  | 'quickResolveCorporateActionImport'
  | 'runCorporateActionScan'
  | 'autoApproveCorporateActionImports'
  | 'getSetting'
> & Partial<Pick<DesktopApi, 'refreshCorporateActionImportClassifications' | 'syncCorporateActionInformationalClosures' | 'getCorporateActionImportsByIds'>>;

export interface PrepareCorporateActionPendingImportsInput {
  api: CorporateActionPendingPreparationApi;
  shouldContinue?: () => boolean;
  onProgress?: (progress: CorporateActionPendingPreparationProgress) => void;
  pageSize?: number;
  expectedDatabasePath: string;
  /** The normal three-step UI never grants auto-approval during Load. */
  explicitApprovalOnly?: boolean;
}

export class CorporateActionPendingPreparationStaleError extends Error {
  constructor() {
    super('Corporate Action pending preparation is no longer current.');
    this.name = 'CorporateActionPendingPreparationStaleError';
  }
}

function assertPreparationCurrent(shouldContinue?: () => boolean): void {
  if (shouldContinue && !shouldContinue()) {
    throw new CorporateActionPendingPreparationStaleError();
  }
}

function normalizePageSize(value: number | undefined): number {
  if (value == null) return PENDING_IMPORT_PAGE_SIZE;
  if (!Number.isInteger(value) || value <= 0 || value > 10_000) {
    throw new Error('Corporate Action pending preparation page size must be between 1 and 10000.');
  }
  return value;
}

function emitPreparationProgress(
  onProgress: PrepareCorporateActionPendingImportsInput['onProgress'],
  progress: CorporateActionPendingPreparationProgress,
): void {
  onProgress?.(progress);
}

function chunkIds(importIds: number[], batchSize: number): number[][] {
  const ids = [...new Set(importIds.filter((id) => Number.isSafeInteger(id) && id > 0))];
  const batches: number[][] = [];
  for (let start = 0; start < ids.length; start += batchSize) {
    batches.push(ids.slice(start, start + batchSize));
  }
  return batches;
}

export async function loadAllPendingCorporateActionImports({
  api,
  shouldContinue,
  onProgress,
  pageSize,
}: Pick<PrepareCorporateActionPendingImportsInput, 'api' | 'shouldContinue' | 'onProgress' | 'pageSize'>): Promise<{
  rows: CorporateActionImportRow[];
  complete: boolean;
  errors: CorporateActionPendingPreparationError[];
}> {
  const limit = normalizePageSize(pageSize);
  const rowsById = new Map<number, CorporateActionImportRow>();
  const orderedIds: number[] = [];
  const errors: CorporateActionPendingPreparationError[] = [];
  let offset = 0;
  let complete = true;

  while (true) {
    assertPreparationCurrent(shouldContinue);
    emitPreparationProgress(onProgress, {
      stage: 'loading',
      message: `Loading pending official imports... ${rowsById.size} loaded.`,
      completed: rowsById.size,
      total: null,
    });

    const page = await api.listCorporateActionImports({
      excludeApproved: true,
      limit,
      offset,
    });
    assertPreparationCurrent(shouldContinue);

    let newIds = 0;
    for (const row of page) {
      if (!rowsById.has(row.id)) {
        orderedIds.push(row.id);
        newIds += 1;
      }
      rowsById.set(row.id, row);
    }

    emitPreparationProgress(onProgress, {
      stage: 'loading', message: `Loaded ${rowsById.size} pending official import row(s).`,
      completed: rowsById.size, total: null,
    });

    if (page.length < limit) {
      break;
    }

    if (newIds === 0) {
      complete = false;
      errors.push({
        importId: null,
        stage: 'loading',
        message: 'Pending import paging repeated without progress. The queue may be incomplete.',
      });
      break;
    }

    const nextOffset = offset + page.length;
    if (nextOffset > PENDING_IMPORT_MAX_OFFSET || nextOffset <= offset) {
      complete = false;
      errors.push({
        importId: null,
        stage: 'loading',
        message: 'Pending import paging reached its safe offset boundary. The queue may be incomplete.',
      });
      break;
    }
    offset = nextOffset;
  }

  return {
    rows: orderedIds.map((id) => rowsById.get(id)!).filter(Boolean),
    complete,
    errors,
  };
}

async function loadResolutionHints(
  api: Pick<CorporateActionPendingPreparationApi, 'listCorporateActionImportResolutionHints'>,
  importIds: number[],
  stage: CorporateActionPendingPreparationError['stage'],
  shouldContinue: PrepareCorporateActionPendingImportsInput['shouldContinue'],
  errors: CorporateActionPendingPreparationError[],
  onProgress?: PrepareCorporateActionPendingImportsInput['onProgress'],
): Promise<Record<number, CorporateActionImportResolutionHint>> {
  const hints: Record<number, CorporateActionImportResolutionHint> = {};
  let completed = 0;
  let failed = 0;
  for (const batch of chunkIds(importIds, PENDING_HINT_BATCH_SIZE)) {
    assertPreparationCurrent(shouldContinue);
    try {
      const result = await api.listCorporateActionImportResolutionHints({ importIds: batch });
      assertPreparationCurrent(shouldContinue);
      const wanted = new Set(batch);
      for (const hint of result.hints) {
        if (wanted.has(hint.importId)) hints[hint.importId] = hint;
      }
      for (const importId of batch) {
        if (!hints[importId]) {
          failed += 1;
          errors.push({ importId, stage, message: 'The identity hint response did not include this action.' });
        }
      }
    } catch (error) {
      if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
      const message = error instanceof Error ? error.message : 'Could not load identity-resolution hints.';
      for (const importId of batch) errors.push({ importId, stage, message });
      failed += batch.length;
    }
    completed += batch.length;
    emitPreparationProgress(onProgress, {
      stage,
      message: `Identity checks returned: ${completed}/${importIds.length}; ${failed} could not be checked.`,
      completed, total: importIds.length,
    });
  }
  return hints;
}

export function canQuickResolveFromHint(hint: CorporateActionImportResolutionHint | undefined): boolean {
  return Boolean(
    hint?.quickResolvable &&
      ['ONE_ACTIVE', 'ONE_HISTORICAL'].includes(hint.status) &&
      hint.topSuggestionSymbol &&
      hint.topSuggestionExchange,
  );
}

function isValidationTarget(row: CorporateActionImportRow): boolean {
  return Boolean(
    isSplitOrBonus(row) &&
      row.parseStatus === 'PARSED' &&
      row.reviewStatus !== 'APPROVED' &&
      row.symbol &&
      row.exDate &&
      row.factor != null,
  );
}

async function readLegacySplitBonusAutoApprovalEnabled(
  api: Pick<CorporateActionPendingPreparationApi, 'getSetting'>,
  shouldContinue: PrepareCorporateActionPendingImportsInput['shouldContinue'],
): Promise<boolean> {
  assertPreparationCurrent(shouldContinue);
  try {
    const value = await api.getSetting(CORPORATE_ACTION_SPLIT_BONUS_AUTO_APPROVAL_SETTING_KEY);
    assertPreparationCurrent(shouldContinue);
    return parseCorporateActionSplitBonusAutoApprovalSetting(value);
  } catch (error) {
    if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
    assertPreparationCurrent(shouldContinue);
    return false;
  }
}

export interface StrictQuickResolveCorporateActionRowsResult {
  rows: CorporateActionImportRow[];
  resolvedCount: number;
  hints: Record<number, CorporateActionImportResolutionHint>;
  errors: CorporateActionPendingPreparationError[];
}

export async function strictQuickResolveCorporateActionRows(input: {
  api: Pick<CorporateActionPendingPreparationApi, 'listCorporateActionImportResolutionHints' | 'quickResolveCorporateActionImport'>;
  rows: readonly CorporateActionImportRow[];
  shouldContinue?: () => boolean;
  onProgress?: (progress: CorporateActionPendingPreparationProgress) => void;
}): Promise<StrictQuickResolveCorporateActionRowsResult> {
  const rowsById = new Map(input.rows.map((row) => [row.id, row]));
  const orderedIds = input.rows.map((row) => row.id);
  const errors: CorporateActionPendingPreparationError[] = [];
  const unresolvedIds = input.rows
    .filter((row) => row.reviewStatus === 'UNRESOLVED' || row.reviewStatus === 'PENDING_ISIN_MISMATCH')
    .map((row) => row.id);

  emitPreparationProgress(input.onProgress, {
    stage: 'matching',
    message: `Checking ${unresolvedIds.length} unresolved/ISIN-review row(s) for strict automatic matching...`,
    completed: 0,
    total: unresolvedIds.length,
  });
  const unresolvedHints = await loadResolutionHints(
    input.api,
    unresolvedIds,
    'matching',
    input.shouldContinue,
    errors,
    input.onProgress,
  );
  let resolvedCount = 0;
  let resolutionAttempts = 0;
  const resolvableIds = unresolvedIds.filter((id) => canQuickResolveFromHint(unresolvedHints[id]));

  for (const importId of resolvableIds) {
    emitPreparationProgress(input.onProgress, {
      stage: 'resolving',
      completed: resolutionAttempts,
      total: resolvableIds.length,
      message: `Strict automatic matching: ${resolutionAttempts}/${resolvableIds.length} checked; ${resolvedCount} resolved.`,
    });
    assertPreparationCurrent(input.shouldContinue);
    try {
      const result = await input.api.quickResolveCorporateActionImport({ importId });
      assertPreparationCurrent(input.shouldContinue);
      rowsById.set(importId, result.importRecord);
      resolvedCount += 1;
    } catch (error) {
      if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
      errors.push({
        importId,
        stage: 'matching',
        message: error instanceof Error ? error.message : 'Strict automatic matching failed.',
      });
    }
    resolutionAttempts += 1;
    emitPreparationProgress(input.onProgress, {
      stage: 'resolving',
      completed: resolutionAttempts,
      total: resolvableIds.length,
      message: `Strict automatic matching: ${resolutionAttempts}/${resolvableIds.length} checked; ${resolvedCount} resolved.`,
    });
  }

  return {
    rows: orderedIds.map((id) => rowsById.get(id)!).filter(Boolean),
    resolvedCount,
    hints: unresolvedHints,
    errors,
  };
}

export async function prepareCorporateActionPendingImports({
  api,
  shouldContinue,
  onProgress,
  pageSize,
  expectedDatabasePath,
  explicitApprovalOnly = false,
}: PrepareCorporateActionPendingImportsInput): Promise<CorporateActionPendingPreparationResult> {
  // Phase 3: close informational notices once, so they leave the pending queue.
  // Status-only and logged; no price, factor or approval change.
  let closureSummary = '';
  if (explicitApprovalOnly && api.syncCorporateActionInformationalClosures) {
    assertPreparationCurrent(shouldContinue);
    emitPreparationProgress(onProgress, {
      stage: 'loading', completed: 0, total: null,
      message: 'Closing informational notices (no price change)...',
    });
    const closure = await api.syncCorporateActionInformationalClosures({ expectedDatabasePath });
    assertPreparationCurrent(shouldContinue);
    closureSummary = ` Informational notices closed: ${closure.totalClosed} (${closure.closed} new, ${closure.reopened} reopened).`;
  }
  const loaded = await loadAllPendingCorporateActionImports({ api, shouldContinue, onProgress, pageSize });
  const errors = [...loaded.errors];
  const rowsById = new Map(loaded.rows.map((row) => [row.id, row]));
  const orderedIds = loaded.rows.map((row) => row.id);

  if (!loaded.complete) {
    return {
      rows: loaded.rows,
      validationRows: [],
      validationImportIds: [],
      identityHints: {},
      autoApproval: null,
      errors,
      complete: false,
      message: `Loaded ${loaded.rows.length} pending row(s), but the queue could not be enumerated completely. Apply remains unavailable.`,
    };
  }

  // Reparse legacy metadata before matching. No financial approval is granted.
  const classificationIds = explicitApprovalOnly
    ? loaded.rows.filter(needsCorporateActionClassificationRefresh).map(row => row.id) : [];
  let classificationCompleted = 0;
  for (const batch of chunkIds(classificationIds, 100)) {
    assertPreparationCurrent(shouldContinue);
    emitPreparationProgress(onProgress, {
      stage: 'loading', completed: classificationCompleted, total: classificationIds.length,
      message: 'Rechecking stored identity and announcement terms; no approvals...',
    });
    try {
      if (!api.refreshCorporateActionImportClassifications) throw new Error('Classification refresh is unavailable. Rebuild the desktop app.');
      const refreshed = await api.refreshCorporateActionImportClassifications({ importIds: batch, expectedDatabasePath });
      assertPreparationCurrent(shouldContinue);
      if (refreshed.length !== batch.length || new Set(refreshed.map(row => row.id)).size !== batch.length
        || refreshed.some(row => !batch.includes(row.id))) throw new Error('Classification refresh returned an incomplete scope.');
      for (const row of refreshed) rowsById.set(row.id, row);
      classificationCompleted += batch.length;
    } catch (error) {
      if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
      errors.push(...batch.map(importId => ({ importId, stage: 'loading' as const,
        message: error instanceof Error ? error.message : 'Classification refresh failed.' })));
      return { rows: orderedIds.map(id => rowsById.get(id)!), validationRows: [], validationImportIds: [],
        identityHints: {}, autoApproval: null, errors, complete: false,
        message: 'Announcement classification refresh was incomplete. Approval remains unavailable.' };
    }
  }
  // Preparation can add the missing pending component of one official Split +
  // Bonus announcement, including an OTHER row the backend just reclassified.
  // Judge the refreshed rows, then re-enumerate once so matching and scans include it.
  const loadedById = new Map(loaded.rows.map(row => [row.id, row]));
  const mayHaveNewComponents = orderedIds.some(id => {
    const row = rowsById.get(id);
    // Only Split/Bonus announcements get a prepared companion component.
    return row != null && (hasCombinedSplitBonusAnnouncement(row)
      || (['SPLIT', 'BONUS'].includes(row.actionType) && row.actionType !== loadedById.get(id)?.actionType));
  });
  if (explicitApprovalOnly && mayHaveNewComponents) {
    const prepared = await loadAllPendingCorporateActionImports({ api, shouldContinue, onProgress, pageSize });
    const preparedIds = new Set(prepared.rows.map(row => row.id));
    if (!prepared.complete || loaded.rows.some(row => !preparedIds.has(row.id))) {
      return { rows: prepared.rows, validationRows: [], validationImportIds: [], identityHints: {},
        autoApproval: null, errors: [...errors, ...prepared.errors], complete: false,
        message: 'Prepared action components changed or could not be loaded completely. Approval remains unavailable.' };
    }
    rowsById.clear();
    orderedIds.length = 0;
    for (const row of prepared.rows) { rowsById.set(row.id, row); orderedIds.push(row.id); }
  }
  const quickResolved = await strictQuickResolveCorporateActionRows({
    api,
    rows: orderedIds.map(id => rowsById.get(id)!),
    shouldContinue,
    onProgress,
  });
  errors.push(...quickResolved.errors);
  for (const row of quickResolved.rows) rowsById.set(row.id, row);

  const refreshedRows = orderedIds.map((id) => rowsById.get(id)!).filter(Boolean);
  const identityReviewIds = refreshedRows
    .filter((row) => row.reviewStatus === 'PENDING_ISIN_MISMATCH')
    .map((row) => row.id);
  emitPreparationProgress(onProgress, {
    stage: 'identity',
    message: `Checking identity evidence for ${identityReviewIds.length} row(s)...`,
    completed: 0,
    total: identityReviewIds.length,
  });
  // Reuse the strict hints already fetched for unresolved/mismatch rows rather than
  // repeating expensive identity-history queries across the full pending queue.
  const identityHints: Record<number, CorporateActionImportResolutionHint> = {};
  for (const id of identityReviewIds) {
    if (quickResolved.hints[id]) identityHints[id] = quickResolved.hints[id];
  }
  const missingIdentityIds = identityReviewIds.filter((id) => !identityHints[id]);
  Object.assign(identityHints, await loadResolutionHints(
    api, missingIdentityIds, 'identity', shouldContinue, errors, onProgress,
  ));

  const validationIds = refreshedRows.filter((row) =>
    isValidationTarget(row) || (explicitApprovalOnly &&
      ['DIVIDEND', 'RIGHTS'].includes(row.actionType) &&
      row.parseStatus === 'PARSED' && row.reviewStatus !== 'APPROVED' &&
      Boolean(row.symbol) && Boolean(row.exDate)),
  ).map((row) => row.id);
  // The targeted official-import scan can observe Dividend/Rights local EOD
  // availability without treating their price drop as a factor match. Only the
  // explicit-approval workflow expands to that scope; legacy automatic
  // approval remains strictly Split/Bonus.
  const scanIds = explicitApprovalOnly
    ? validationIds
    : refreshedRows.filter(isValidationTarget).map((row) => row.id);
  const validationRows: CorporateActionScanResultRow[] = [];
  let validated = 0;
  for (const batch of chunkIds(scanIds, PENDING_VALIDATION_BATCH_SIZE)) {
    assertPreparationCurrent(shouldContinue);
    emitPreparationProgress(onProgress, {
      stage: 'validating',
      message: `Checking required local EOD evidence... ${validated}/${scanIds.length} processed.`,
      completed: validated,
      total: scanIds.length,
    });
    try {
      const result = await api.runCorporateActionScan({ scope: 'official_imports', importIds: batch });
      assertPreparationCurrent(shouldContinue);
      validationRows.push(...result.results);
      if (api.getCorporateActionImportsByIds && expectedDatabasePath.trim()) {
        const fresh = await readExactCorporateActionImports(
          { getCorporateActionImportsByIds: api.getCorporateActionImportsByIds.bind(api) },
          batch, expectedDatabasePath, shouldContinue,
        );
        for (const row of fresh) rowsById.set(row.id, row);
      }
    } catch (error) {
      if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
      const message = error instanceof Error ? error.message : 'Corporate Action EOD validation failed.';
      for (const importId of batch) errors.push({ importId, stage: 'validating', message });
    }
    validated += batch.length;
    const failed = errors.filter((error) => error.stage === 'validating').length;
    emitPreparationProgress(onProgress, {
      stage: 'validating', completed: validated, total: scanIds.length,
      message: `Local EOD checks returned: ${validated}/${scanIds.length}; ${failed} could not be checked.`,
    });
  }

  const rowErrorIds = new Set(errors.flatMap((entry) => (entry.importId == null ? [] : [entry.importId])));
  const validatedIds = new Set(
    validationRows.flatMap((row) => (row.corporateActionImportId == null ? [] : [row.corporateActionImportId])),
  );
  const autoApprovalScopeIds = validationIds.filter((id) => validatedIds.has(id) && !rowErrorIds.has(id));
  const splitBonusAutoApprovalEnabled =
    !explicitApprovalOnly && autoApprovalScopeIds.length > 0
      ? await readLegacySplitBonusAutoApprovalEnabled(api, shouldContinue)
      : false;
  let autoApproval: CorporateActionAutoApprovalResult | null = null;
  if (splitBonusAutoApprovalEnabled && autoApprovalScopeIds.length > 0) {
    if (!expectedDatabasePath.trim()) throw new Error('The reviewed database context is missing.');
    const aggregate: CorporateActionAutoApprovalResult = {
      requested: 0, eligible: 0, autoApproved: 0, linkedExisting: 0, alreadyApproved: 0,
      skipped: 0, failed: 0, dispositions: [], policyVersion: 'AUTO_APPROVAL_SAFE_V2', message: '',
    };
    let processed = 0;
    for (const batch of chunkCorporateActionApprovalIds(autoApprovalScopeIds)) {
      assertPreparationCurrent(shouldContinue);
      emitPreparationProgress(onProgress, {
        stage: 'auto-approving', completed: processed, total: autoApprovalScopeIds.length,
        message: `Auto-Approval Safe V2: ${processed}/${autoApprovalScopeIds.length} strong Split/Bonus candidates checked.`,
      });
      try {
        const batchResult = await api.autoApproveCorporateActionImports({ importIds: batch, expectedDatabasePath });
        assertPreparationCurrent(shouldContinue);
        aggregate.requested += batchResult.requested;
        aggregate.eligible += batchResult.eligible;
        aggregate.autoApproved += batchResult.autoApproved;
        aggregate.linkedExisting += batchResult.linkedExisting;
        aggregate.alreadyApproved += batchResult.alreadyApproved;
        aggregate.skipped += batchResult.skipped;
        aggregate.failed += batchResult.failed;
        aggregate.dispositions.push(...batchResult.dispositions);
        for (const disposition of batchResult.dispositions) {
          if (disposition.importRecord) rowsById.set(disposition.importId, disposition.importRecord);
          if (disposition.disposition === 'FAILED') {
            errors.push({ importId: disposition.importId, stage: 'auto-approving', message: disposition.reason });
            rowErrorIds.add(disposition.importId);
          }
        }
      } catch (error) {
        if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
        const message = error instanceof Error ? error.message : 'Auto-Approval Safe V2 failed.';
        for (const importId of batch) {
          errors.push({ importId, stage: 'auto-approving', message });
          rowErrorIds.add(importId);
        }
        break;
      }
      processed += batch.length;
    }
    aggregate.message = `Auto-Approval Safe V2: ${aggregate.autoApproved} approved, ${aggregate.linkedExisting} linked existing, ${aggregate.alreadyApproved} already approved, ${aggregate.skipped} left for manual review, ${aggregate.failed} failed.`;
    autoApproval = aggregate;
  }

  const finalRows = orderedIds.map((id) => rowsById.get(id)!).filter(Boolean);
  const blockedCount = rowErrorIds.size;
  const autoApprovedCount = autoApproval ? autoApproval.autoApproved + autoApproval.linkedExisting : 0;
  const autoApprovalSummary = splitBonusAutoApprovalEnabled
    ? `Auto-Approval Safe V2 approved/linked ${autoApprovedCount}`
    : explicitApprovalOnly ? 'Approval requires an explicit operator action' : 'Split/Bonus Safe V2 automatic approval is OFF';
  emitPreparationProgress(onProgress, {
    stage: 'complete',
    message: `Prepared ${finalRows.length} row(s) from the pending queue; ${autoApprovalSummary}; ${blockedCount} row(s) could not be fully checked.`,
    completed: finalRows.length,
    total: finalRows.length,
  });

  return {
    rows: finalRows,
    validationRows,
    validationImportIds: validationIds,
    identityHints,
    autoApproval,
    errors,
    complete: true,
    message:
      (blockedCount > 0
        ? `Prepared ${finalRows.length} row(s) from the pending queue. ${autoApprovalSummary}. ${blockedCount} row(s) are blocked because a required check failed.`
        : `Prepared ${finalRows.length} row(s) from the pending queue. ${autoApprovalSummary}; review the remaining actions and use the existing manual Apply controls where appropriate.`)
        + closureSummary,
  };
}

export interface OfficialImportOperationProgress {
  stage: 'rechecking' | 'applying' | 'reconciling' | 'refreshing' | 'reloading' | 'complete' | 'stopped';
  completed: number;
  total: number | null;
  message: string;
}

type ExactImportApi = Pick<DesktopApi, 'getCorporateActionImportsByIds'>;
type ReviewedImportApi = ExactImportApi & Pick<DesktopApi, 'listCorporateActionScanResults'>;

function checkedExactIds(ids: number[]): number[] {
  if (ids.length === 0 || ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new Error('Exact import lookup requires unique positive safe integer IDs.');
  }
  return [...ids];
}

/** One bounded read for each exact set of IDs; never falls back to queue enumeration. */
export async function readExactCorporateActionImports(
  api: ExactImportApi, importIds: number[], expectedDatabasePath: string,
  shouldContinue: (() => boolean) | undefined,
  onBatch?: (completed: number, total: number) => void,
): Promise<CorporateActionImportRow[]> {
  const ids = checkedExactIds(importIds);
  if (!expectedDatabasePath.trim()) throw new Error('The reviewed database context is missing.');
  const rows: CorporateActionImportRow[] = [];
  for (const batch of chunkCorporateActionApprovalIds(ids)) {
    assertPreparationCurrent(shouldContinue);
    const result = await api.getCorporateActionImportsByIds({ importIds: batch, expectedDatabasePath });
    assertPreparationCurrent(shouldContinue);
    const wanted = new Set(batch);
    const byId = new Map<number, CorporateActionImportRow>();
    for (const row of result) {
      if (!wanted.has(row.id) || byId.has(row.id)) throw new Error('Exact import lookup returned duplicate or unexpected IDs.');
      byId.set(row.id, row);
    }
    if (byId.size !== batch.length) throw new Error('Exact import lookup has missing reviewed IDs. Load & Prepare again.');
    rows.push(...batch.map((id) => byId.get(id)!));
    onBatch?.(rows.length, ids.length);
  }
  return rows;
}

export async function recheckReviewedCorporateActionImports(input: {
  api: ReviewedImportApi;
  importIds: number[];
  expectedDatabasePath: string;
  fingerprints: Readonly<Record<number, string>>;
  fingerprint: (row: CorporateActionImportRow, scan?: CorporateActionScanResultRow) => string;
  preparationErrors: Readonly<Record<number, string>>;
  /** Keep advanced maintenance callers unchanged; normal CA requires current EOD proof. */
  explicitApprovalOnly?: boolean;
  shouldContinue?: () => boolean;
  onProgress?: (progress: OfficialImportOperationProgress) => void;
}): Promise<{ rows: CorporateActionImportRow[]; validationRows: CorporateActionScanResultRow[]; validationImportIds: number[] }> {
  const { api, importIds, expectedDatabasePath, shouldContinue, onProgress } = input;
  onProgress?.({ stage: 'rechecking', completed: 0, total: importIds.length, message: `Reading ${importIds.length} exact reviewed action(s)...` });
  const rows = await readExactCorporateActionImports(api, importIds, expectedDatabasePath, shouldContinue, (completed,total) =>
    onProgress?.({stage:'rechecking',completed,total,message:`Read ${completed}/${total} exact reviewed action(s).`}));
  const scanIds = rows.filter((row) => isSplitOrBonus(row) ||
    (input.explicitApprovalOnly === true && ['DIVIDEND', 'RIGHTS'].includes(row.actionType))).map((row) => row.id);
  const scans: CorporateActionScanResultRow[] = [];
  for (const batch of chunkIds(scanIds, 500)) {
    assertPreparationCurrent(shouldContinue);
    const result = await api.listCorporateActionScanResults({importIds:batch,limit:10000});
    assertPreparationCurrent(shouldContinue);
    scans.push(...result.results);
  }
  const byId = new Map<number, CorporateActionScanResultRow>();
  for (const scan of scans) {
    if (scan.corporateActionImportId == null) continue;
    const previous = byId.get(scan.corporateActionImportId);
    if (!previous || scan.scannedAt > previous.scannedAt || (scan.scannedAt === previous.scannedAt && scan.id > previous.id)) {
      byId.set(scan.corporateActionImportId,scan);
    }
  }
  for (const row of rows) {
    const scan = byId.get(row.id); // Deliberately no cached-scan fallback.
    if (input.fingerprint(row,scan) !== input.fingerprints[row.id]) {
      throw new Error(`${row.symbol ?? row.id} changed after review. Load & Prepare again before applying.`);
    }
    const currentState = input.explicitApprovalOnly === true
      ? getCorporateActionNormalApprovalState(row, scan)
      : getCorporateActionApprovalState(row, scan);
    if (input.preparationErrors[row.id] || currentState !== 'READY TO APPROVE') {
      throw new Error(`${row.symbol ?? row.id} is no longer ready to apply.`);
    }
  }
  assertPreparationCurrent(shouldContinue);
  onProgress?.({stage:'rechecking',completed:rows.length,total:rows.length,message:`Rechecked ${rows.length}/${rows.length} reviewed actions and current validation evidence.`});
  return {rows,validationRows:scans,validationImportIds:scanIds};
}

/** Keep the complete prepared queue. A row disappears only on confirmed approved state. */
export function reconcilePreparedCorporateActionRows(
  current: CorporateActionImportRow[], snapshots: CorporateActionImportRow[],
): CorporateActionImportRow[] {
  const byId = new Map(snapshots.map((row) => [row.id,row]));
  return current.flatMap((row) => {
    const next = byId.get(row.id);
    if (!next) return [row];
    if (next.reviewStatus === 'APPROVED' || next.approvedCorporateActionId != null) return [];
    return [next];
  });
}

export interface OfficialImportApplyReceipt {
  requested: number;
  processed: number;
  approved: number;
  linkedExisting: number;
  alreadyApproved: number;
  failed: number;
  blockedImportIds: number[];
  warnings: string[];
  approvedRecords: CorporateActionResult[];
  stopped: boolean;
}

/** Existing approval authority only. No retries on ambiguous write outcomes. */
export async function applyReviewedCorporateActionBatches(input: {
  api: ExactImportApi & Pick<DesktopApi, 'approveCorporateActionImports'>;
  rows: CorporateActionImportRow[];
  expectedDatabasePath: string;
  shouldContinue?: () => boolean;
  onProgress?: (progress: OfficialImportOperationProgress) => void;
  onReconcile: (rows: CorporateActionImportRow[]) => void;
  refresh: () => Promise<void>;
  reload: (record: CorporateActionResult) => Promise<void>;
}): Promise<OfficialImportApplyReceipt> {
  const { api, rows, expectedDatabasePath, shouldContinue, onProgress } = input;
  if (!expectedDatabasePath.trim()) throw new Error('The reviewed database context is missing.');
  const ids = checkedExactIds(rows.map((row)=>row.id));
  const batches = chunkCorporateActionApprovalIds(ids);
  const attempted: number[] = [];
  const confirmedRows: CorporateActionImportRow[] = [];
  const blocked = new Set<number>();
  const receipt: OfficialImportApplyReceipt = { requested:ids.length,processed:0,approved:0,linkedExisting:0,
    alreadyApproved:0,failed:0,blockedImportIds:[],warnings:[],approvedRecords:[],stopped:false };
  const detail = () => `${receipt.processed}/${ids.length} returned; ${receipt.approved} approved, ${receipt.linkedExisting} linked existing, ${receipt.alreadyApproved} already approved, ${receipt.failed} failed.`;
  for (let index=0;index<batches.length;index+=1) {
    assertPreparationCurrent(shouldContinue);
    const batch=batches[index];
    onProgress?.({stage:'applying',completed:receipt.processed,total:ids.length,message:`Applying batch ${index+1}/${batches.length}. ${detail()}`});
    attempted.push(...batch);
    try {
      const result: CorporateActionImportBulkApprovalResult = await api.approveCorporateActionImports({importIds:batch, expectedDatabasePath});
      assertPreparationCurrent(shouldContinue);
      const resultIds=[...result.results.map((r)=>r.importRecord.id),...result.errors.map((e)=>e.importId)];
      const wanted = new Set(batch);
      if (result.requested!==batch.length || resultIds.length!==batch.length || new Set(resultIds).size!==batch.length ||
          resultIds.some((id)=>!wanted.has(id)) ||
          [result.approved,result.linkedExisting,result.alreadyApproved,result.failed].some((n)=>!Number.isSafeInteger(n)||n<0) ||
          result.approved+result.linkedExisting+result.alreadyApproved+result.failed!==batch.length) {
        throw new Error('Approval response did not account for every reviewed ID.');
      }
      receipt.processed+=batch.length; receipt.approved+=result.approved; receipt.linkedExisting+=result.linkedExisting;
      receipt.alreadyApproved+=result.alreadyApproved; receipt.failed+=result.failed;
      receipt.approvedRecords.push(...result.results.flatMap((r)=>r.approvedRecord ? [r.approvedRecord] : []));
      for (const error of result.errors) {
        blocked.add(error.importId);receipt.warnings.push(`Action ${error.importId}: ${error.message}`);
      }
      confirmedRows.push(...result.results.map((r)=>r.importRecord));
      onProgress?.({stage:'applying',completed:receipt.processed,total:ids.length,message:`Batch ${index+1}/${batches.length} returned. ${detail()}`});
    } catch(error) {
      if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
      assertPreparationCurrent(shouldContinue);
      batch.forEach((id)=>blocked.add(id));receipt.stopped=true;
      receipt.warnings.push(`Batch ${index+1} outcome not confirmed; do not retry automatically. ${error instanceof Error ? error.message : String(error)}`);
      break;
    }
  }
  assertPreparationCurrent(shouldContinue);
  onProgress?.({stage:'reconciling',completed:0,total:attempted.length,message:`Refreshing ${attempted.length} affected pending records only. ${detail()}`});
  try {
    const snapshots=await readExactCorporateActionImports(api,attempted,expectedDatabasePath,shouldContinue,(completed,total)=>
      onProgress?.({stage:'reconciling',completed,total,message:`Refreshed ${completed}/${total} affected records. ${detail()}`}));
    assertPreparationCurrent(shouldContinue);
    input.onReconcile(snapshots);
  } catch(error) {
    if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
    assertPreparationCurrent(shouldContinue);
    attempted.forEach((id)=>blocked.add(id));
    // Keep confirmed results if a final read fails; never discard the unqueried queue.
    input.onReconcile(confirmedRows);
    receipt.warnings.push(`Affected-record refresh failed. Confirmed apply results above are retained. ${error instanceof Error ? error.message : String(error)}`);
  }
  onProgress?.({stage:'refreshing',completed:0,total:null,message:`Refreshing application state. ${detail()}`});
  try { await input.refresh(); assertPreparationCurrent(shouldContinue); }
  catch(error) {
    if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
    assertPreparationCurrent(shouldContinue);
    receipt.warnings.push(`Application refresh failed after apply; do not repeat the approval. ${error instanceof Error ? error.message : String(error)}`);
  }
  const instruments=[...new Map(receipt.approvedRecords.map((r)=>[`${r.exchange}:${r.currentSymbol}`,r])).values()];
  let refreshed=0;
  for (const record of instruments) {
    assertPreparationCurrent(shouldContinue);
    onProgress?.({stage:'reloading',completed:refreshed,total:instruments.length,message:`Refreshing affected instruments: ${refreshed}/${instruments.length}. ${detail()}`});
    try { await input.reload(record); assertPreparationCurrent(shouldContinue); }
    catch(error) {
      if (error instanceof CorporateActionPendingPreparationStaleError) throw error;
      assertPreparationCurrent(shouldContinue);
      receipt.warnings.push(`Instrument refresh failed for ${record.exchange}:${record.currentSymbol}. ${error instanceof Error ? error.message : String(error)}`);
    }
    refreshed+=1;
    onProgress?.({stage:'reloading',completed:refreshed,total:instruments.length,message:`Instrument refresh attempts finished: ${refreshed}/${instruments.length}. ${detail()}`});
  }
  receipt.blockedImportIds=[...blocked];
  onProgress?.({stage:receipt.stopped ? 'stopped' : 'complete',completed:receipt.processed,total:ids.length,
    message:`${receipt.stopped ? 'Stopped' : 'Finished'}. ${detail()} ${ids.length-attempted.length} not attempted. ${receipt.warnings.length} warning(s).`});
  return receipt;
}
