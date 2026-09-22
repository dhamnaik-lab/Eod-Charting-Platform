import { describe, expect, it } from 'vitest';
import {
  buildCorporateActionEconomicEventViewModels,
  type CorporateActionEconomicEventSourceRow,
} from '../corporateActionEconomicEventViewModel';

function row(
  overrides: Partial<CorporateActionEconomicEventSourceRow> = {},
): CorporateActionEconomicEventSourceRow {
  return {
    eventKey: 'NSE:BHARATRAS:2025-12-12',
    importId: 1,
    exchange: 'NSE',
    symbol: 'BHARATRAS',
    companyName: 'Bharat Rasayan Limited',
    exDate: '2025-12-12',
    actionType: 'SPLIT',
    shareFactor: 2,
    status: 'READY',
    statusReason: null,
    source: 'NSE_API',
    evidenceCount: 1,
    pricePresentation: null,
    ...overrides,
  };
}

const bharatrasPrice = {
  isCompound: true,
  componentCount: 2,
  effectiveFactor: 4,
  theoreticalPrice: 2475,
  openResidualPct: 0.0298989899,
  closeResidualPct: 0.0735353535,
  summary: 'Compound 2-action factor ×4.000000',
};

const fclPrice = {
  isCompound: true,
  componentCount: 2,
  effectiveFactor: 10,
  theoreticalPrice: 24.86,
  openResidualPct: 0.0277554304,
  closeResidualPct: 0.1999195495,
  summary: 'Compound 2-action factor ×10.000000',
};

describe('Corporate Action economic-event view model', () => {
  it('returns no cards for an empty source set', () => {
    expect(buildCorporateActionEconomicEventViewModels([])).toEqual([]);
  });

  it('groups one authoritative event key into one deterministic event card', () => {
    const result = buildCorporateActionEconomicEventViewModels([
      row({ importId: 2, actionType: 'BONUS', shareFactor: 2 }),
      row({ importId: 1, actionType: 'SPLIT', shareFactor: 2 }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      eventKey: 'NSE:BHARATRAS:2025-12-12',
      title: 'BHARATRAS',
      actionLabel: 'Split + Bonus',
      status: 'READY',
      approvalCandidate: true,
      sourceRowCount: 2,
      duplicateSourceRowCount: 0,
    });
    expect(result[0].sourceRows.map((sourceRow) => sourceRow.importId)).toEqual([1, 2]);
  });

  it('carries BHARATRAS x4 compound price evidence without recalculating it', () => {
    const result = buildCorporateActionEconomicEventViewModels([
      row({ importId: 1, actionType: 'SPLIT', pricePresentation: bharatrasPrice }),
      row({ importId: 2, actionType: 'BONUS', pricePresentation: bharatrasPrice }),
    ]);

    expect(result[0].pricePresentation).toEqual(bharatrasPrice);
    expect(result[0].pricePresentation?.effectiveFactor).toBe(4);
    expect(result[0].pricePresentation?.theoreticalPrice).toBe(2475);
  });

  it('carries FCL x10 compound price evidence without recalculating it', () => {
    const result = buildCorporateActionEconomicEventViewModels([
      row({
        eventKey: 'NSE:FCL:2025-10-31',
        importId: 7,
        symbol: 'FCL',
        companyName: 'Fineotex Chemical Limited',
        exDate: '2025-10-31',
        actionType: 'SPLIT',
        shareFactor: 2,
        pricePresentation: fclPrice,
      }),
      row({
        eventKey: 'NSE:FCL:2025-10-31',
        importId: 8,
        symbol: 'FCL',
        companyName: 'Fineotex Chemical Limited',
        exDate: '2025-10-31',
        actionType: 'BONUS',
        shareFactor: 5,
        pricePresentation: fclPrice,
      }),
    ]);

    expect(result[0].pricePresentation).toEqual(fclPrice);
    expect(result[0].pricePresentation?.effectiveFactor).toBe(10);
    expect(result[0].pricePresentation?.theoreticalPrice).toBe(24.86);
  });

  it('collapses equivalent duplicate action rows in the card while preserving evidence rows', () => {
    const result = buildCorporateActionEconomicEventViewModels([
      row({ importId: 3, actionType: 'SPLIT', shareFactor: 2, source: 'NSE_ARCHIVE' }),
      row({ importId: 1, actionType: 'SPLIT', shareFactor: 2, source: 'NSE_API' }),
      row({ importId: 2, actionType: 'BONUS', shareFactor: 2, source: 'NSE_API' }),
    ]);

    expect(result[0].actionLabel).toBe('Split + Bonus');
    expect(result[0].sourceRowCount).toBe(3);
    expect(result[0].duplicateSourceRowCount).toBe(1);
    expect(result[0].components).toEqual([
      { actionType: 'SPLIT', label: 'Split', shareFactor: 2, importIds: [1, 3] },
      { actionType: 'BONUS', label: 'Bonus', shareFactor: 2, importIds: [2] },
    ]);
    expect(result[0].sources).toEqual(['NSE_API', 'NSE_ARCHIVE']);
  });

  it('never guesses grouping from symbol and date when authoritative event keys differ', () => {
    const result = buildCorporateActionEconomicEventViewModels([
      row({ eventKey: 'event-a', importId: 1 }),
      row({ eventKey: 'event-b', importId: 2 }),
    ]);

    expect(result.map((event) => event.eventKey).sort()).toEqual(['event-a', 'event-b']);
  });

  it('fails closed when one event key carries conflicting user-facing statuses', () => {
    expect(() =>
      buildCorporateActionEconomicEventViewModels([
        row({ importId: 1, status: 'READY' }),
        row({ importId: 2, actionType: 'BONUS', status: 'CONFLICT' }),
      ]),
    ).toThrow('inconsistent status');
  });

  it('fails closed when one event key carries inconsistent identity presentation', () => {
    expect(() =>
      buildCorporateActionEconomicEventViewModels([
        row({ importId: 1, symbol: 'BHARATRAS' }),
        row({ importId: 2, actionType: 'BONUS', symbol: 'OTHER' }),
      ]),
    ).toThrow('inconsistent symbol');
  });

  it('fails closed when duplicate components disagree on share factor', () => {
    expect(() =>
      buildCorporateActionEconomicEventViewModels([
        row({ importId: 1, actionType: 'SPLIT', shareFactor: 2 }),
        row({ importId: 2, actionType: 'SPLIT', shareFactor: 5 }),
      ]),
    ).toThrow('inconsistent SPLIT shareFactor');
  });

  it('fails closed when supplied authoritative price presentations disagree', () => {
    expect(() =>
      buildCorporateActionEconomicEventViewModels([
        row({ importId: 1, pricePresentation: bharatrasPrice }),
        row({
          importId: 2,
          actionType: 'BONUS',
          pricePresentation: { ...bharatrasPrice, effectiveFactor: 5 },
        }),
      ]),
    ).toThrow('inconsistent pricePresentation');
  });

  it('sorts exceptions before ready and completed event cards deterministically', () => {
    const result = buildCorporateActionEconomicEventViewModels([
      row({ eventKey: 'approved', importId: 5, status: 'APPROVED', exDate: '2026-01-05' }),
      row({ eventKey: 'ready', importId: 4, status: 'READY', exDate: '2026-01-04' }),
      row({
        eventKey: 'conflict',
        importId: 3,
        status: 'CONFLICT',
        statusReason: 'Identity evidence conflicts',
        exDate: '2026-01-03',
      }),
      row({
        eventKey: 'review',
        importId: 2,
        status: 'NEEDS_REVIEW',
        statusReason: 'Evidence incomplete',
        exDate: '2026-01-02',
      }),
      row({
        eventKey: 'processed',
        importId: 6,
        status: 'ALREADY_PROCESSED',
        exDate: '2026-01-06',
      }),
    ]);

    expect(result.map((event) => event.eventKey)).toEqual([
      'review',
      'conflict',
      'ready',
      'approved',
      'processed',
    ]);
  });

  it('marks only READY economic events as user-facing approval candidates', () => {
    const statuses = [
      'READY',
      'NEEDS_REVIEW',
      'CONFLICT',
      'APPROVED',
      'ALREADY_PROCESSED',
    ] as const;

    const result = buildCorporateActionEconomicEventViewModels(
      statuses.map((status, index) =>
        row({
          eventKey: `event-${index}`,
          importId: index + 1,
          status,
          statusReason: status === 'NEEDS_REVIEW' || status === 'CONFLICT' ? 'Excluded' : null,
        }),
      ),
    );

    expect(
      Object.fromEntries(result.map((event) => [event.status, event.approvalCandidate])),
    ).toEqual({
      READY: true,
      NEEDS_REVIEW: false,
      CONFLICT: false,
      APPROVED: false,
      ALREADY_PROCESSED: false,
    });
  });
});
