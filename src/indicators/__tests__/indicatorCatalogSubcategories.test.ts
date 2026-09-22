import { describe, expect, it } from 'vitest';
import {
  INDICATOR_CATALOG,
  INDICATOR_SUBCATEGORIES,
  getIndicatorSubcategory,
  type IndicatorSubcategory,
} from '@/indicators/catalog';

describe('Indicator Catalog Subcategories', () => {
  it('defines 9 subcategories across overlay and pane placements', () => {
    expect(INDICATOR_SUBCATEGORIES.length).toBe(9);
    const overlaySubcats = INDICATOR_SUBCATEGORIES.filter((s) => s.placement === 'overlay');
    const paneSubcats = INDICATOR_SUBCATEGORIES.filter((s) => s.placement === 'pane');
    expect(overlaySubcats.length).toBe(5);
    expect(paneSubcats.length).toBe(4);
  });

  it('maps every indicator in the catalog to a valid subcategory', () => {
    const validSubcatIds = new Set(INDICATOR_SUBCATEGORIES.map((s) => s.id));

    INDICATOR_CATALOG.forEach((item) => {
      const subcat = getIndicatorSubcategory(item.kind, item.placement);
      expect(validSubcatIds.has(subcat)).toBe(true);

      const meta = INDICATOR_SUBCATEGORIES.find((s) => s.id === subcat);
      expect(meta).toBeDefined();
      expect(meta!.placement).toBe(item.placement);
    });
  });

  it('correctly maps prominent indicators to expected subcategories', () => {
    expect(getIndicatorSubcategory('SMA')).toBe('moving_averages');
    expect(getIndicatorSubcategory('EMA')).toBe('moving_averages');
    expect(getIndicatorSubcategory('BOLL')).toBe('bands_channels');
    expect(getIndicatorSubcategory('KELTNER')).toBe('bands_channels');
    expect(getIndicatorSubcategory('SUPERTREND')).toBe('trend_following');
    expect(getIndicatorSubcategory('PATTERN')).toBe('smart_money_patterns');
    expect(getIndicatorSubcategory('CPR')).toBe('smart_money_patterns');
    expect(getIndicatorSubcategory('AVGPRICE')).toBe('price_transforms');

    expect(getIndicatorSubcategory('RSI')).toBe('momentum_oscillators');
    expect(getIndicatorSubcategory('MACD')).toBe('momentum_oscillators');
    expect(getIndicatorSubcategory('ATR')).toBe('volatility_risk');
    expect(getIndicatorSubcategory('ADX')).toBe('trend_strength');
    expect(getIndicatorSubcategory('OBV')).toBe('volume_flow');
  });
});
