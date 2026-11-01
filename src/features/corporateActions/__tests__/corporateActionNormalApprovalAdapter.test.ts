import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionEventIdentityListInput,
  CorporateActionImportBulkApprovalInput,
  CorporateActionImportListInput,
  CorporateActionImportRow,
  DesktopApi,
} from '@/platform';
import {
  approveCorporateActionNormalReady,
  createInitialCorporateActionNormalWorkflowFacts,
  getCorporateActionNormalReadyImportIds,
  recheckCorporateActionNormalApprovalData,
  reduceCorporateActionNormalWorkflowFacts,
  type CorporateActionNormalReviewEvent,
} from '../workflow/corporateActionNormalWorkflowAdapter';

type ApprovalApi = Pick<
  DesktopApi,
  | 'fetchOfficialCorporateActions'
  | 'listCorporateActionImports'
  | 'listCorporateActionScanResults'
  | 'runCorporateActionScan'
  | 'listCorporateActionImportResolutionHints'
  | 'listCorporateActionEventIdentities'
  | 'approveCorporateActionImports'
>;

function row(id: number, overrides: Partial<CorporateActionImportRow> = {}): CorporateActionImportRow {
  return {
    id,
    exchange: 'NSE',
    source: 'NSE_OFFICIAL',
    sourceFile: null,
    symbol: `SYM${id}`,
    isin: `INE${id}`,
    bseScripCode: null,
    companyName: `Company ${id}`,
    purposeRaw: 'Dividend',
    exDate: '2026-09-01',
    recordDate: null,
    actionType: 'DIVIDEND',
    ratioNum: null,
    ratioDen: null,
    oldFaceValue: null,
    newFaceValue: null,
    cashAmount: 1,
    factor: 1,
    priceFactor: 1,
    parseStatus: 'PARSED',
    reviewStatus: 'PENDING',
    message: null,
    approvedCorporateActionId: null,
    importedAt: '2026-09-02T00:00:00Z',
    approvedAt: null,
    evidenceCount: 1,
    evidenceSources: ['NSE_OFFICIAL'],
    latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null,
    latestEvidenceNote: null,
    ...overrides,
  };
}

function createApi(initialPending: CorporateActionImportRow[], initialApproved: CorporateActionImportRow[] = []) {
  let pending = [...initialPending];
  let approved = [...initialApproved];

  const api: ApprovalApi = {
    fetchOfficialCorporateActions: vi.fn(),
    listCorporateActionImports: vi.fn(async (input: CorporateActionImportListInput | undefined) => {
      const rows = input?.reviewStatus === 'APPROVED' ? approved : pending;
      return rows.slice(0, input?.limit ?? rows.length);
    }),
    listCorporateActionScanResults: vi.fn(async () => ({ scanRun: null, results: [] })),
    runCorporateActionScan: vi.fn(async (input) => ({
      scanRun: null,
      results: (input?.importIds ?? []).flatMap((importId: number) => {
        const candidate = pending.find((item) => item.id === importId);
        if (!candidate?.symbol) return [];
        return [{
          id: importId,
          scanRunId: 1,
          corporateActionImportId: importId,
          corporateActionId: null,
          symbol: candidate.symbol,
          exchange: candidate.exchange,
          scanStatus: 'REVIEW',
          prevTradeDate: '2026-08-31',
          exTradeDate: '2026-09-01',
          prevClose: 100,
          exOpen: 98,
          exClose: 99,
          expectedFactor: null,
          actualOpenFactor: null,
          actualCloseFactor: null,
          confidence: null,
          message: 'Local EOD availability evidence only',
          scannedAt: '2026-09-02T00:00:00Z',
        }];
      }),
    })),
    listCorporateActionImportResolutionHints: vi.fn(async () => ({ requested: 0, hints: [], message: '' })),
    listCorporateActionEventIdentities: vi.fn(async (input: CorporateActionEventIdentityListInput) => ({
      requested: input.importIds.length,
      identities: input.importIds.map((importId) => ({
        importId,
        exchange: 'NSE',
        rawSymbol: `SYM${importId}`,
        rawIsin: `INE${importId}`,
        eventSymbol: `SYM${importId}`,
        eventIsin: `INE${importId}`,
        resolved: false,
        resolutionType: null,
        resolutionAuthority: null,
        chainId: null,
        transitionOldSymbol: null,
        transitionNewSymbol: null,
        transitionEffectiveDate: null,
        rawIdentitySourceRef: null,
        rawIdentitySourceSha256: null,
        rawIdentitySourceLineNumber: null,
        resolutionFingerprint: null,
      })),
      message: 'Loaded',
    })),
    approveCorporateActionImports: vi.fn(async (input: CorporateActionImportBulkApprovalInput) => {
      const ids = new Set(input.importIds);
      const moved = pending.filter((candidate) => ids.has(candidate.id));
      pending = pending.filter((candidate) => !ids.has(candidate.id));
      approved = [
        ...approved,
        ...moved.map((candidate) => ({
          ...candidate,
          reviewStatus: 'APPROVED',
          approvedCorporateActionId: 10_000 + candidate.id,
          approvedAt: '2026-09-03T00:00:00Z',
        })),
      ];
      return {
        requested: input.importIds.length,
        approved: input.importIds.length,
        linkedExisting: 0,
        alreadyApproved: 0,
        failed: 0,
        results: [],
        errors: [],
        message: 'Updated',
      };
    }),
  };

  return {
    api,
    getPending: () => pending,
    getApproved: () => approved,
    addPending: (candidate: CorporateActionImportRow) => { pending = [...pending, candidate]; },
  };
}

function readyEvent(ids: number[]): CorporateActionNormalReviewEvent {
  const first = ids[0];
  return {
    event: {
      eventKey: `event-${first}`,
      title: `SYM${first}`,
      exchange: 'NSE',
      symbol: `SYM${first}`,
      companyName: `Company ${first}`,
      exDate: '2026-09-01',
      status: 'READY',
      statusReason: null,
      approvalCandidate: true,
      actionLabel: 'Dividend',
      components: [{ actionType: 'DIVIDEND', label: 'Dividend', shareFactor: 1, importIds: ids }],
      sourceRowCount: ids.length,
      duplicateSourceRowCount: Math.max(0, ids.length - 1),
      sources: ['NSE_OFFICIAL'],
      sourceRows: [],
      pricePresentation: null,
    },
    evidenceRows: ids.map((id) => ({
      eventKey: `event-${first}`,
      importRow: row(id),
      scan: null,
      eventIdentity: null,
      approvalState: 'READY TO APPROVE',
      validationLabel: 'NOT REQUIRED',
      status: 'READY',
      statusReason: null,
      pricePresentation: null,
    })),
  };
}

describe('Corporate Action normal Approve adapter', () => {
  it('derives backend import targets only from Review events that were Ready', () => {
    const conflict = readyEvent([4]);
    conflict.event.status = 'CONFLICT';
    conflict.event.approvalCandidate = false;

    expect(getCorporateActionNormalReadyImportIds([readyEvent([1, 2]), readyEvent([3]), conflict])).toEqual([1, 2, 3]);
  });

  it('authoritatively rechecks reviewed Ready IDs and separates Ready, already-processed, and skipped rows', async () => {
    const pending = [row(1), row(3, { reviewStatus: 'UNRESOLVED', symbol: null })];
    const approved = [row(2, { reviewStatus: 'APPROVED', approvedCorporateActionId: 2002 })];
    const { api } = createApi(pending, approved);

    const result = await recheckCorporateActionNormalApprovalData({
      api,
      requestedImportIds: [1, 2, 3, 999],
    });

    expect(result.readyImportIds).toEqual([1]);
    expect(result.alreadyProcessedImportIds).toEqual([2]);
    expect(result.skippedImportIds).toEqual([3, 999]);
    expect(api.approveCorporateActionImports).not.toHaveBeenCalled();
  });

  it('approves only the authoritative valid subset in backend-safe batches of at most 100', async () => {
    const rows = Array.from({ length: 243 }, (_, index) => row(index + 1));
    const { api } = createApi(rows);
    const events = rows.map((candidate) => readyEvent([candidate.id]));

    const result = await approveCorporateActionNormalReady({ api, reviewEvents: events, expectedDatabasePath: 'E:/TEST-ONLY' });

    expect(api.approveCorporateActionImports).toHaveBeenCalledTimes(3);
    const approvalCalls = (api.approveCorporateActionImports as any).mock.calls as Array<[CorporateActionImportBulkApprovalInput]>;
    expect(approvalCalls.map((call) => call[0].importIds.length)).toEqual([100, 100, 43]);
    expect(result.recheck.readyImportIds).toHaveLength(243);
    expect(result.approved).toBe(243);
    expect(result.postRecheck.readyImportIds).toEqual([]);
    expect(result.postRecheck.alreadyProcessedImportIds).toHaveLength(243);
  });

  it('does not force stale non-ready rows and preserves per-row failures for partial resume', async () => {
    const { api } = createApi([
      row(1),
      row(3, { reviewStatus: 'UNRESOLVED', symbol: null }),
    ], [row(2, { reviewStatus: 'APPROVED', approvedCorporateActionId: 2002 })]);
    api.approveCorporateActionImports = vi.fn(async (input: CorporateActionImportBulkApprovalInput) => ({
      requested: input.importIds.length,
      approved: 0,
      linkedExisting: 0,
      alreadyApproved: 0,
      failed: 1,
      results: [],
      errors: [{ importId: 1, message: 'Still requires review' }],
      message: 'Updated 0 selected row(s). Failed 1.',
    }));

    const result = await approveCorporateActionNormalReady({
      api,
      reviewEvents: [readyEvent([1, 2, 3])],
      expectedDatabasePath: 'E:/TEST-ONLY',
    });

    expect(api.approveCorporateActionImports).toHaveBeenCalledWith({ importIds: [1], expectedDatabasePath: 'E:/TEST-ONLY' });
    expect(result.recheck.alreadyProcessedImportIds).toEqual([2]);
    expect(result.recheck.skippedImportIds).toEqual([3]);
    expect(result.failed).toBe(1);
    expect(result.errors).toEqual([{ importId: 1, message: 'Still requires review' }]);
    expect(result.postRecheck.readyImportIds).toEqual([1]);
  });

  it('stops after a batch-level failure and rechecks remaining Ready rows instead of submitting later batches', async () => {
    const rows = Array.from({ length: 101 }, (_, index) => row(index + 1));
    const state = createApi(rows);
    const originalApprove = state.api.approveCorporateActionImports;
    state.api.approveCorporateActionImports = vi.fn(async (input: CorporateActionImportBulkApprovalInput) => {
      if (input.importIds[0] === 101) {
        throw new Error('backend unavailable');
      }
      return originalApprove(input);
    });

    const result = await approveCorporateActionNormalReady({
      api: state.api,
      reviewEvents: rows.map((candidate) => readyEvent([candidate.id])),
      expectedDatabasePath: 'E:/TEST-ONLY',
    });

    expect(state.api.approveCorporateActionImports).toHaveBeenCalledTimes(2);
    expect(result.approved).toBe(100);
    expect(result.batchFailure).toContain('batch 2/2');
    expect(result.postRecheck.readyImportIds).toEqual([101]);
  });


  it('does not pull newly arrived Ready imports into the already-reviewed approval retry set', async () => {
    const state = createApi([row(1)]);
    const originalApprove = state.api.approveCorporateActionImports;
    state.api.approveCorporateActionImports = vi.fn(async (input: CorporateActionImportBulkApprovalInput) => {
      const result = await originalApprove(input);
      state.addPending(row(2));
      return result;
    });

    const result = await approveCorporateActionNormalReady({
      api: state.api,
      reviewEvents: [readyEvent([1])],
      expectedDatabasePath: 'E:/TEST-ONLY',
    });

    expect(result.requestedImportIds).toEqual([1]);
    expect(result.postRecheck.readyImportIds).toEqual([]);
    expect(result.postRecheck.readyEventCount).toBe(0);
    expect(result.postRecheck.review.counts.ready).toBe(1);
    expect(state.api.approveCorporateActionImports).toHaveBeenCalledOnce();
    expect(state.getPending().map((candidate) => candidate.id)).toEqual([2]);
  });

  it('moves Task 2 facts through processing, partial resume, and complete states without changing workflow rules', () => {
    const reviewed = reduceCorporateActionNormalWorkflowFacts(
      createInitialCorporateActionNormalWorkflowFacts(),
      { type: 'REVIEW_COMPLETED', readyCount: 3 },
    );
    const processing = reduceCorporateActionNormalWorkflowFacts(reviewed, { type: 'APPROVAL_STARTED' });
    const partial = reduceCorporateActionNormalWorkflowFacts(processing, { type: 'APPROVAL_FINISHED', readyCount: 1 });
    const complete = reduceCorporateActionNormalWorkflowFacts(partial, { type: 'APPROVAL_FINISHED', readyCount: 0 });

    expect(processing.approvalState).toBe('processing');
    expect(partial).toMatchObject({ approvalState: 'partial', remainingReadyCount: 1 });
    expect(complete).toMatchObject({ approvalState: 'complete', remainingReadyCount: 0 });
  });
});
