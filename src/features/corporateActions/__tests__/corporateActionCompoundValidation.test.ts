import { describe, expect, it } from 'vitest';
import {
  getCorporateActionPriceValidationPresentation,
  getCorporateActionCompoundSummary,
  getCorporateActionEffectiveValidationFactor,
  parseCorporateActionCompoundValidation,
} from '../corporateActionCompoundValidation';

describe('corporateActionCompoundValidation', () => {
  it('parses BHARATRAS-style split x2 plus bonus x2 metadata', () => {
    const message = 'Observed local price movement matches the combined same-date Split/Bonus factor. [CA_COMPOUND_V1 factor=4.000000000000 count=2 fingerprint=1:2.000000000000,2:2.000000000000]';
    expect(parseCorporateActionCompoundValidation(message)).toEqual({
      combinedFactor: 4,
      componentCount: 2,
      fingerprint: '1:2.000000000000,2:2.000000000000',
    });
    expect(getCorporateActionCompoundSummary({ message })).toBe('Compound 2-action factor ×4.000000');
  });

  it('parses FCL-style split x2 plus bonus x5 metadata', () => {
    const message = 'Compound validation. [CA_COMPOUND_V1 factor=10.000000000000 count=2 fingerprint=7:2.000000000000,8:5.000000000000]';
    expect(getCorporateActionEffectiveValidationFactor({ expectedFactor: 2, message })).toBe(10);
  });

  it('falls back to the individual factor for ordinary single actions', () => {
    expect(getCorporateActionEffectiveValidationFactor({ expectedFactor: 5, message: 'ordinary scan' })).toBe(5);
  });


  it('derives BHARATRAS compound x4 price evidence', () => {
    const presentation = getCorporateActionPriceValidationPresentation({
      prevClose: 9900,
      exOpen: 2549,
      exClose: 2657,
      expectedFactor: 2,
      message: 'Compound validation. [CA_COMPOUND_V1 factor=4.000000000000 count=2 fingerprint=1:2.000000000000,2:2.000000000000]',
    });

    expect(presentation.effectiveFactor).toBe(4);
    expect(presentation.componentCount).toBe(2);
    expect(presentation.isCompound).toBe(true);
    expect(presentation.theoreticalPrice).toBeCloseTo(2475, 8);
    expect(presentation.openResidualPct).toBeCloseTo(2.9898989899, 8);
    expect(presentation.closeResidualPct).toBeCloseTo(7.3535353535, 8);
  });

  it('derives FCL compound x10 price evidence', () => {
    const presentation = getCorporateActionPriceValidationPresentation({
      prevClose: 248.6,
      exOpen: 25.55,
      exClose: 29.83,
      expectedFactor: 2,
      message: 'Compound validation. [CA_COMPOUND_V1 factor=10.000000000000 count=2 fingerprint=7:2.000000000000,8:5.000000000000]',
    });

    expect(presentation.effectiveFactor).toBe(10);
    expect(presentation.theoreticalPrice).toBeCloseTo(24.86, 8);
    expect(presentation.openResidualPct).toBeCloseTo(2.7755430410, 8);
  });

  it('keeps ordinary single-action price evidence unchanged', () => {
    const presentation = getCorporateActionPriceValidationPresentation({
      prevClose: 100,
      exOpen: 52.5,
      exClose: 51,
      expectedFactor: 2,
      message: 'ordinary scan',
    });

    expect(presentation.isCompound).toBe(false);
    expect(presentation.componentCount).toBeNull();
    expect(presentation.effectiveFactor).toBe(2);
    expect(presentation.theoreticalPrice).toBe(50);
    expect(presentation.openResidualPct).toBeCloseTo(5, 8);
  });

  it('falls back safely when compound metadata is malformed', () => {
    const presentation = getCorporateActionPriceValidationPresentation({
      prevClose: 100,
      exOpen: 51,
      exClose: 50,
      expectedFactor: 2,
      message: '[CA_COMPOUND_V1 factor=0 count=2 fingerprint=x]',
    });

    expect(presentation.isCompound).toBe(false);
    expect(presentation.effectiveFactor).toBe(2);
    expect(presentation.theoreticalPrice).toBe(50);
  });

  it('does not manufacture invalid numeric evidence when prices are missing', () => {
    const presentation = getCorporateActionPriceValidationPresentation({
      prevClose: null,
      exOpen: null,
      exClose: null,
      expectedFactor: 2,
      message: 'ordinary scan',
    });

    expect(presentation.theoreticalPrice).toBeNull();
    expect(presentation.openResidualPct).toBeNull();
    expect(presentation.closeResidualPct).toBeNull();
  });

  it('rejects malformed compound metadata', () => {
    expect(parseCorporateActionCompoundValidation('[CA_COMPOUND_V1 factor=0 count=2 fingerprint=x]')).toBeNull();
    expect(parseCorporateActionCompoundValidation('[CA_COMPOUND_V1 factor=4 count=1 fingerprint=x]')).toBeNull();
  });
});
