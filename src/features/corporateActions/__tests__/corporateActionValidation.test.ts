import { describe, expect, it } from 'vitest';
import type { CorporateActionImportRow, CorporateActionScanResultRow } from '@/platform';
import {
  classifyCorporateActionValidation,
  getCorporateActionApprovalState,
  getCorporateActionIdentityLabel,
  getPriceMultiplier,
  getResidualGapPct,
  getTheoreticalExPrice,
  isCorporateActionScanCurrent,
} from '../corporateActionValidation';
import { addIndiaIsoDays, indiaIsoDate } from '../corporateActionDate';

function importRow(overrides: Partial<CorporateActionImportRow> = {}): CorporateActionImportRow {
  return {
    id: 1,
    exchange: 'NSE',
    source: 'NSE_API',
    sourceFile: null,
    symbol: 'TEST',
    isin: 'INE000000001',
    bseScripCode: null,
    companyName: 'Test Ltd',
    purposeRaw: 'Stock Split 2:1',
    exDate: '2026-08-14',
    recordDate: null,
    actionType: 'SPLIT',
    ratioNum: 2,
    ratioDen: 1,
    oldFaceValue: null,
    newFaceValue: null,
    cashAmount: null,
    factor: 2,
    priceFactor: 0.5,
    parseStatus: 'PARSED',
    reviewStatus: 'PENDING',
    message: null,
    approvedCorporateActionId: null,
    importedAt: '2026-08-13T18:00:00Z',
    approvedAt: null,
    evidenceCount: 1,
    evidenceSources: ['NSE_API'],
    latestEvidenceCapturedAt: null,
    latestEvidenceSourceLocator: null,
    latestEvidenceNote: null,
    ...overrides,
  };
}

function scanRow(overrides: Partial<CorporateActionScanResultRow> = {}): CorporateActionScanResultRow {
  return {
    id: 1,
    scanRunId: 1,
    corporateActionImportId: 1,
    corporateActionId: null,
    symbol: 'TEST',
    exchange: 'NSE',
    scanStatus: 'MATCHED',
    prevTradeDate: '2026-08-13',
    exTradeDate: '2026-08-14',
    prevClose: 100,
    exOpen: 52.5,
    exClose: 51.8,
    expectedFactor: 2,
    actualOpenFactor: 100 / 52.5,
    actualCloseFactor: 100 / 51.8,
    confidence: 100 / 52.5 / 2,
    message: null,
    scannedAt: '2026-08-14T01:00:00Z',
    ...overrides,
  };
}

describe('corporateActionValidation', () => {
  it('converts a 2x share factor to a 0.5x price multiplier', () => {
    expect(getPriceMultiplier(2)).toBe(0.5);
  });

  it('calculates theoretical ex-price and preserves a +5% residual gap', () => {
    const theoretical = getTheoreticalExPrice(100, 2);
    expect(theoretical).toBe(50);
    expect(getResidualGapPct(52.5, theoretical)).toBeCloseTo(5, 10);
  });

  it('preserves a -5% residual gap', () => {
    expect(getResidualGapPct(47.5, 50)).toBeCloseTo(-5, 10);
  });

  it('supports 1-for-2 bonus math through the parsed 1.5x share factor', () => {
    expect(getPriceMultiplier(1.5)).toBeCloseTo(2 / 3, 10);
    expect(getTheoreticalExPrice(600, 1.5)).toBeCloseTo(400, 10);
  });

  it('classifies current matched scans and approval readiness', () => {
    const row = importRow();
    expect(classifyCorporateActionValidation(row, scanRow({ confidence: 0.97 }))).toBe('STRONG MATCH');
    expect(classifyCorporateActionValidation(row, scanRow({ confidence: 0.9 }))).toBe('MATCH');
    expect(getCorporateActionApprovalState(row, scanRow({ confidence: 0.9 }))).toBe('READY TO APPROVE');
  });

  it('classifies review and no-price outcomes as review-required', () => {
    const row = importRow();
    expect(classifyCorporateActionValidation(row, scanRow({ scanStatus: 'REVIEW', confidence: 0.7 }))).toBe('NEEDS REVIEW');
    expect(classifyCorporateActionValidation(row, scanRow({ scanStatus: 'NO_PRICE_DATA', confidence: null }))).toBe('NO PRICE DATA');
    expect(getCorporateActionApprovalState(row, scanRow({ scanStatus: 'REVIEW' }))).toBe('NEEDS REVIEW');
  });

  it('rejects stale scan evidence after symbol, factor, or date-window changes', () => {
    const row = importRow();
    expect(isCorporateActionScanCurrent(row, scanRow())).toBe(true);
    expect(isCorporateActionScanCurrent(row, scanRow({ symbol: 'OTHER' }))).toBe(false);
    expect(isCorporateActionScanCurrent(row, scanRow({ expectedFactor: 3 }))).toBe(false);
    expect(isCorporateActionScanCurrent(row, scanRow({ prevTradeDate: '2026-08-14' }))).toBe(false);
  });

  it('maps identity state independently from price validation', () => {
    expect(getCorporateActionIdentityLabel('PENDING')).toBe('MATCHED');
    expect(getCorporateActionIdentityLabel('UNRESOLVED')).toBe('MATCH REQUIRED');
    expect(getCorporateActionIdentityLabel('PENDING_ISIN_MISMATCH')).toBe('ISIN REVIEW REQUIRED');
  });
});

describe('corporateActionDate', () => {
  it('uses the India calendar date at 23:59, 00:00, 01:00, 05:29 and 05:30 IST', () => {
    expect(indiaIsoDate(new Date('2026-08-13T18:29:00.000Z'))).toBe('2026-08-13'); // 23:59 IST
    expect(indiaIsoDate(new Date('2026-08-13T18:30:00.000Z'))).toBe('2026-08-14'); // 00:00 IST
    expect(indiaIsoDate(new Date('2026-08-13T19:30:00.000Z'))).toBe('2026-08-14'); // 01:00 IST
    expect(indiaIsoDate(new Date('2026-08-13T23:59:00.000Z'))).toBe('2026-08-14'); // 05:29 IST
    expect(indiaIsoDate(new Date('2026-08-14T00:00:00.000Z'))).toBe('2026-08-14'); // 05:30 IST
  });

  it('handles month, year, and leap-day arithmetic without timezone drift', () => {
    expect(addIndiaIsoDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addIndiaIsoDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addIndiaIsoDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addIndiaIsoDays('2024-02-29', 1)).toBe('2024-03-01');
  });
});
