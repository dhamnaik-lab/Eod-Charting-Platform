import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarketMoversFilterControls, normalizeMarketMoversFilterDraft } from '../MarketMoversFilterControls';
import { MarketMoversFullView } from '../MarketMoversFullView';
import { useMarketMoversStore } from '../marketMoversStore';
import type { MarketMoversFilterSettings, MarketMoversSnapshot } from '../marketMoversTypes';

const originalState = useMarketMoversStore.getState();
afterEach(() => useMarketMoversStore.setState(originalState, true));

const draft: MarketMoversFilterSettings = {
  exchange: 'NSE',
  universeId: 'all-equity',
  resultCount: 10,
  minPrice: 10,
  minVolume: 10_000,
  excludeCorporateActionWarnings: false,
};

describe('F-30 Market Movers controls parity', () => {
  it('uses the same filter fields and actions for compact and expanded views', () => {
    const markup = renderToStaticMarkup(
      <MarketMoversFilterControls
        draftSettings={draft}
        onDraftSettingsChange={vi.fn()}
        onCancel={vi.fn()}
        onApply={vi.fn()}
      />,
    );
    expect(markup).toContain('Minimum close price');
    expect(markup).toContain('Minimum volume');
    expect(markup).toContain('Exclude warned corporate actions');
    expect(markup).toContain('>Cancel</button>');
    expect(markup).toContain('>Apply</button>');
  });

  it('normalizes minimum price, volume and corporate-action exclusions consistently', () => {
    expect(normalizeMarketMoversFilterDraft({
      ...draft,
      minPrice: -25,
      minVolume: 102.9,
      excludeCorporateActionWarnings: true,
    })).toEqual({
      minPrice: 0,
      minVolume: 102,
      excludeCorporateActionWarnings: true,
    });
    expect(normalizeMarketMoversFilterDraft({
      ...draft,
      minPrice: Number.NaN,
      minVolume: -10,
    })).toMatchObject({ minPrice: 0, minVolume: 0 });
  });

  it('makes filters available before any manual scan in Full View', () => {
    useMarketMoversStore.setState({ snapshot: null, status: 'idle' });
    const markup = renderToStaticMarkup(<MarketMoversFullView />);
    expect(markup).toContain('>Filters</button>');
    expect(markup).toContain('Market Movers has not been scanned.');
    expect(markup).toContain('Scan Market');
  });

  it('retains exchange, volume surge, both price tables and filters with a cached snapshot', () => {
    const snapshot = {
      asOfDate: '2026-11-16',
      exchange: 'NSE',
      databaseRevision: 'fixture-1',
      gainers: [],
      losers: [],
      volumeSurge: [],
      targetSymbolCount: 0,
      fetchedSymbolCount: 0,
      failedSymbolCount: 0,
      qualifyingSymbolCount: 0,
      excludedSymbolCount: 0,
      coverageWarning: null,
      incompleteUniverseWarning: null,
      fetchFailureMessages: [],
    } as unknown as MarketMoversSnapshot;
    useMarketMoversStore.setState({ snapshot, status: 'ready' });
    const markup = renderToStaticMarkup(<MarketMoversFullView />);
    expect(markup).toContain('Market exchange');
    expect(markup).toContain('Volume surge');
    expect(markup).toContain('TOP GAINERS');
    expect(markup).toContain('TOP LOSERS');
    expect(markup).toContain('>Filters</button>');
  });
});
