import { describe, expect, it, vi } from 'vitest';
import type {
  CorporateActionEventIdentity,
  CorporateActionEventIdentityListInput,
  CorporateActionImportRow,
  CorporateActionScanResultRow,
  DesktopApi,
} from '@/platform';
import { buildCorporateActionWorkflowModel } from '../corporateActionWorkflow';
import {
  buildCorporateActionNormalReviewData,
  createInitialCorporateActionNormalWorkflowFacts,
  getCorporateActionNormalReadyImportIds,
  reduceCorporateActionNormalWorkflowFacts,
} from '../workflow/corporateActionNormalWorkflowAdapter';

type ReviewApi = Pick<
  DesktopApi,
  | 'fetchOfficialCorporateActions'
  | 'listCorporateActionImports'
  | 'listCorporateActionScanResults'
  | 'runCorporateActionScan'
  | 'listCorporateActionImportResolutionHints'
  | 'listCorporateActionEventIdentities'
>;

function row(
  id: number,
  overrides: Partial<CorporateActionImportRow> = {},
): CorporateActionImportRow {
  return {
    id,
    exchange: 'NSE',
    source: 'NSE_OFFICIAL',
    sourceFile: `source-${id}.csv`,
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
    evidenceCount: 2,
    evidenceSources: ['NSE_OFFICIAL', 'NSE_ARCHIVE'],
    latestEvidenceCapturedAt: '2026-09-02T00:00:00Z',
    latestEvidenceSourceLocator: `locator-${id}`,
    latestEvidenceNote: `note-${id}`,
    ...overrides,
  };
}

function scan(
  importRow: CorporateActionImportRow,
  overrides: Partial<CorporateActionScanResultRow> = {},
): CorporateActionScanResultRow {
  return {
    id: importRow.id,
    scanRunId: 1,
    corporateActionImportId: importRow.id,
    corporateActionId: null,
    symbol: importRow.symbol,
    exchange: importRow.exchange,
    scanStatus: 'MATCHED',
    prevTradeDate: '2026-08-31',
    exTradeDate: '2026-09-01',
    prevClose: 200,
    exOpen: 50,
    exClose: 50,
    expectedFactor: importRow.factor,
    actualOpenFactor: 4,
    actualCloseFactor: 4,
    confidence: 0.99,
    message: null,
    scannedAt: '2026-09-02T00:00:00Z',
    ...overrides,
  };
}

function identity(
  importId: number,
  overrides: Partial<CorporateActionEventIdentity> = {},
): CorporateActionEventIdentity {
  return {
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
    ...overrides,
  };
}

function apiBase(): ReviewApi {
  return {
    fetchOfficialCorporateActions: vi.fn(),
    listCorporateActionImports: vi.fn(),
    listCorporateActionScanResults: vi.fn(),
    runCorporateActionScan: vi.fn(),
    listCorporateActionImportResolutionHints: vi.fn(),
    listCorporateActionEventIdentities: vi.fn(async (input: CorporateActionEventIdentityListInput) => ({
      requested: input.importIds.length,
      identities: input.importIds.map((importId) => identity(importId)),
      message: 'Loaded',
    })),
  } as ReviewApi;
}

describe('Corporate Action normal Review adapter', () => {
  it('shows verified existing dividends as already processed without approving the import', async () => {
    const api = apiBase();
    api.listCorporateActionEventIdentities = vi.fn(async () => ({
      requested: 1, identities: [identity(1)],
      existingDividends: [{ importId: 1, corporateActionId: 77 }], message: 'Read only',
    }));
    const pending = row(1);
    const result = await buildCorporateActionNormalReviewData({ api, rows: [pending], scanRows: [] });
    expect(result.events[0].event.status).toBe('ALREADY_PROCESSED');
    expect(result.events[0].event.approvalCandidate).toBe(false);
    expect(result.events[0].event.statusReason).toContain('#77');
    expect(getCorporateActionNormalReadyImportIds(result.events)).toEqual([]);
    expect(pending.reviewStatus).toBe('PENDING');
    expect(pending.approvedCorporateActionId).toBeNull();
  });

  it('groups only by authoritative compound fingerprint and keeps ordinary imports separate', async () => {
    const split = row(1, {
      symbol: 'SAME',
      companyName: 'Same Company',
      actionType: 'SPLIT',
      purposeRaw: 'Split',
      factor: 2,
    });
    const bonus = row(2, {
      symbol: 'SAME',
      companyName: 'Same Company',
      actionType: 'BONUS',
      purposeRaw: 'Bonus',
      factor: 2,
    });
    const dividend = row(3, {
      symbol: 'SAME',
      companyName: 'Same Company',
      actionType: 'DIVIDEND',
      purposeRaw: 'Dividend',
      factor: 1,
    });
    const compoundMessage = '[CA_COMPOUND_V1 factor=4 count=2 fingerprint=authoritative-fp]';
    const api = apiBase();

    const result = await buildCorporateActionNormalReviewData({
      api,
      rows: [split, bonus, dividend],
      scanRows: [
        scan(split, { message: compoundMessage }),
        scan(bonus, { message: compoundMessage }),
      ],
    });

    expect(result.events.map((item) => item.event.eventKey)).toEqual([
      'compound:authoritative-fp',
      'import:3',
    ]);
    expect(result.events[0].event.actionLabel).toBe('Split + Bonus');
    expect(result.events[0].event.sourceRows.map((sourceRow) => sourceRow.importId)).toEqual([1, 2]);
  });

  it('loads existing event identity evidence in unchanged 500-id read-only batches', async () => {
    const rows = Array.from({ length: 501 }, (_, index) => row(index + 1));
    const api = apiBase();
    api.listCorporateActionEventIdentities = vi.fn(async (input: CorporateActionEventIdentityListInput) => ({
      requested: input.importIds.length,
      identities: input.importIds.map((importId) =>
        identity(importId, {
          resolved: true,
          eventSymbol: `EVENT${importId}`,
          eventIsin: `EVENT-ISIN-${importId}`,
          resolutionType: 'EVENT_TIME',
          resolutionAuthority: 'V1.14E',
        }),
      ),
      message: 'Loaded',
    }));

    const result = await buildCorporateActionNormalReviewData({ api, rows, scanRows: [] });

    expect(api.listCorporateActionEventIdentities).toHaveBeenCalledTimes(2);
    expect(api.listCorporateActionEventIdentities).toHaveBeenNthCalledWith(1, {
      importIds: Array.from({ length: 500 }, (_, index) => index + 1),
    });
    expect(api.listCorporateActionEventIdentities).toHaveBeenNthCalledWith(2, {
      importIds: [501],
    });
    expect(result.events[0].event.symbol).toBe('EVENT1');
    expect(result.eventIdentities).toHaveLength(501);
  });

  it('maps existing approval and validation facts to exception-first economic-event statuses', async () => {
    const unresolved = row(1, { reviewStatus: 'UNRESOLVED', symbol: null });
    const isinConflict = row(2, { reviewStatus: 'PENDING_ISIN_MISMATCH' });
    const ready = row(3);
    const priceConflict = row(4, { actionType: 'SPLIT', factor: 2 });
    const api = apiBase();

    const result = await buildCorporateActionNormalReviewData({
      api,
      rows: [ready, isinConflict, priceConflict, unresolved],
      scanRows: [scan(priceConflict, { scanStatus: 'MISMATCH', confidence: 0.4 })],
    });

    expect(result.events.map((item) => item.event.status)).toEqual([
      'NEEDS_REVIEW',
      'CONFLICT',
      'CONFLICT',
      'READY',
    ]);
    expect(result.counts).toEqual({ loaded: 4, needsReview: 1, conflicts: 2, ready: 1 });
  });

  it('preserves source provenance, event identity, scan evidence, and price presentation for the drawer', async () => {
    const split = row(1, { actionType: 'SPLIT', factor: 2, purposeRaw: 'Split' });
    const priceScan = scan(split, { message: '[CA_COMPOUND_V1 factor=2 count=2 fingerprint=drawer-fp]' });
    const api = apiBase();
    api.listCorporateActionEventIdentities = vi.fn(async () => ({
      requested: 1,
      identities: [identity(1, { resolved: true, eventSymbol: 'OLD1', eventIsin: 'EVENT-ISIN' })],
      message: 'Loaded',
    }));

    const result = await buildCorporateActionNormalReviewData({
      api,
      rows: [split],
      scanRows: [priceScan],
    });
    const evidence = result.events[0].evidenceRows[0];

    expect(evidence.importRow.evidenceSources).toEqual(['NSE_OFFICIAL', 'NSE_ARCHIVE']);
    expect(evidence.importRow.latestEvidenceSourceLocator).toBe('locator-1');
    expect(evidence.eventIdentity?.eventSymbol).toBe('OLD1');
    expect(evidence.scan?.scanStatus).toBe('MATCHED');
    expect(evidence.pricePresentation).toMatchObject({
      isCompound: true,
      effectiveFactor: 2,
      theoreticalPrice: 100,
    });
  });

  it('fails closed when backend marks event identity resolved without an event symbol', async () => {
    const api = apiBase();
    api.listCorporateActionEventIdentities = vi.fn(async () => ({
      requested: 1,
      identities: [identity(1, { resolved: true, eventSymbol: null })],
      message: 'Loaded',
    }));

    await expect(
      buildCorporateActionNormalReviewData({ api, rows: [row(1)], scanRows: [] }),
    ).rejects.toThrow('resolved identity without eventSymbol');
  });

  it('marks only the Review checkpoint and hands ready event count to the existing Task 2 Approve stage', () => {
    const initial = createInitialCorporateActionNormalWorkflowFacts();
    const fetched = reduceCorporateActionNormalWorkflowFacts(initial, { type: 'FETCH_SUCCEEDED' });
    const loaded = reduceCorporateActionNormalWorkflowFacts(fetched, {
      type: 'LOAD_SUCCEEDED',
      exceptionCount: 1,
      readyCount: 4,
    });
    const reviewed = reduceCorporateActionNormalWorkflowFacts(loaded, {
      type: 'REVIEW_COMPLETED',
      readyCount: 2,
    });

    expect(reviewed).toMatchObject({
      reviewCheckpointCompleted: true,
      remainingReadyCount: 2,
      approvalState: 'idle',
    });
    expect(buildCorporateActionWorkflowModel(reviewed)).toMatchObject({
      currentStage: 'approve',
      resumeReason: 'APPROVAL_REQUIRED',
    });
  });

  it('phase5c_shows_backend_skip_reason_on_the_remaining_exception', async () => {
    const split = row(9, { actionType: 'SPLIT', factor: 2, purposeRaw: 'Split' });
    const api = apiBase();
    const result = await buildCorporateActionNormalReviewData({
      api,
      rows: [split],
      scanRows: [scan(split)],
      backendReasons: { 9: 'Safe V2 near-unity discriminator failed' },
    });
    expect(result.events[0].evidenceRows[0].statusReason).toBe(
      'Safe V2 near-unity discriminator failed',
    );
  });

});
