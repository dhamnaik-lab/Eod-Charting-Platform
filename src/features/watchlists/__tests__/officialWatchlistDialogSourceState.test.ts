import { describe, expect, it } from 'vitest';
import {
  initialOfficialWatchlistSourceDataState,
  officialWatchlistDialogSourceReducer,
} from '@/features/watchlists/officialWatchlistDialogSourceState';
import type { OfficialWatchlistSource } from '@/features/watchlists/officialWatchlistProviders';

const source: OfficialWatchlistSource = {
  id: 'nse-sectors',
  label: 'NSE Sectors',
  watchlistPrefix: 'NSE Sector',
  exchange: 'NSE',
  groups: [],
};

describe('officialWatchlistDialogSourceReducer', () => {
  it('enters loading and clears previous source payload on request', () => {
    const ready = { status: 'ready', requestId: 1, sourceId: 'nse-sectors', source, error: null } as const;
    const next = officialWatchlistDialogSourceReducer(ready, { type: 'request', requestId: 2, sourceId: 'bse-indices' });
    expect(next).toEqual({ status: 'loading', requestId: 2, sourceId: 'bse-indices', source: null, error: null });
  });

  it('accepts the current request success', () => {
    const loading = officialWatchlistDialogSourceReducer(initialOfficialWatchlistSourceDataState, { type: 'request', requestId: 1, sourceId: 'nse-sectors' });
    const next = officialWatchlistDialogSourceReducer(loading, { type: 'success', requestId: 1, sourceId: 'nse-sectors', source });
    expect(next.status).toBe('ready');
  });

  it('ignores a stale success from the previously selected source', () => {
    const loading = officialWatchlistDialogSourceReducer(initialOfficialWatchlistSourceDataState, { type: 'request', requestId: 2, sourceId: 'bse-indices' });
    const next = officialWatchlistDialogSourceReducer(loading, { type: 'success', requestId: 1, sourceId: 'nse-sectors', source });
    expect(next).toBe(loading);
  });

  it('enters error for the active request and keeps no stale source payload', () => {
    const loading = officialWatchlistDialogSourceReducer(initialOfficialWatchlistSourceDataState, { type: 'request', requestId: 3, sourceId: 'bse-sectors' });
    const next = officialWatchlistDialogSourceReducer(loading, { type: 'failure', requestId: 3, sourceId: 'bse-sectors', error: 'load failed' });
    expect(next).toEqual({ status: 'error', requestId: 3, sourceId: 'bse-sectors', source: null, error: 'load failed' });
  });

  it('allows a later request for the same source after failure', () => {
    const errored = { status: 'error', requestId: 3, sourceId: 'bse-sectors', source: null, error: 'load failed' } as const;
    const next = officialWatchlistDialogSourceReducer(errored, { type: 'request', requestId: 4, sourceId: 'bse-sectors' });
    expect(next.status).toBe('loading');
    expect(next.requestId).toBe(4);
  });
});
