import { describe, expect, it } from 'vitest';
import { getAutoTileGeometry, getVisibleTileTabs } from '../chartAutoTileLayout';

describe('Auto-Tile geometry', () => {
  it.each([
    [1, 1, [1]],
    [2, 2, [1, 1]],
    [3, 3, [1, 1, 1]],
    [4, 2, [1, 1, 1, 1]],
    [5, 6, [2, 2, 2, 3, 3]],
    [6, 3, [1, 1, 1, 1, 1, 1]],
  ] as const)('balances %i charts at wide width', (count, columns, spans) => {
    expect(getAutoTileGeometry(count, 1600)).toMatchObject({ columns, spans });
  });
  it('adapts to intermediate and narrow widths', () => {
    expect(getAutoTileGeometry(5, 900)).toMatchObject({ columns: 2, spans: [1, 1, 1, 1, 2] });
    expect(getAutoTileGeometry(6, 480)).toMatchObject({ columns: 1, minRowHeight: 225 });
  });
  it('keeps all tabs open and renders the selected tab within six slots', () => {
    const tabs = Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1) }));
    expect(getVisibleTileTabs(tabs, '1').map((tab) => tab.id)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(getVisibleTileTabs(tabs, '9').map((tab) => tab.id)).toEqual(['1', '2', '3', '4', '5', '9']);
    expect(tabs).toHaveLength(9);
  });
});
