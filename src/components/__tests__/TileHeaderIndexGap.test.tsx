import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TileHeader } from '../TileHeader';
import { createBlankChartTab } from '@/features/charts/chartTabWorkspaceService';

vi.mock('@/store/chartStore', () => ({ useChartStore: (selector: (state: object) => unknown) => selector({ activateChartTab: () => {} }) }));
describe('tiled index header gap guard', () => {
  it('matches the main header when previous close is unavailable', () => {
    const tab = { ...createBlankChartTab(1), instrument: { symbol: 'NIFTY', exchange: 'NSE_INDEX' },
      displayBars: [{ date: '2012-02-21', timestamp: Date.UTC(2012, 1, 21), open: 5561.9,
        high: 5621.5, low: 5561.75, close: 5607.15, volume: 100 }] };
    expect(renderToStaticMarkup(<TileHeader tab={tab} />)).toContain('Change unavailable');
    const equity = renderToStaticMarkup(<TileHeader tab={{ ...tab, instrument: { symbol: 'TEST', exchange: 'NSE' } }} />);
    expect(equity).toContain('+45.25 (+0.81%)');
  });
});
