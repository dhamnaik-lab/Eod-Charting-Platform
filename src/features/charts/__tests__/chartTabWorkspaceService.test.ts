import { describe, expect, it } from 'vitest';
import {
  createBlankChartTab,
  duplicateChartTabWorkspaceState,
} from '@/features/charts/chartTabWorkspaceService';

describe('duplicateChartTabWorkspaceState', () => {
  it('inserts an independent loaded copy immediately to the right of the source tab', () => {
    const source = {
      ...createBlankChartTab(1),
      title: 'NSE:AXISBANK',
      rawBars: [{ date: '2026-07-13', timestamp: 1, open: 100, high: 110, low: 90, close: 105, prevClose: 99, volume: 1000 }],
      displayBars: [{ date: '2026-07-13', timestamp: 1, open: 100, high: 110, low: 90, close: 105, prevClose: 99, volume: 1000 }],
      viewport: { startIndex: 3, endIndex: 42 },
      paneScaleOverrides: { price: { min: 80, max: 120 } },
    };
    const trailingTab = createBlankChartTab(2);

    const nextState = duplicateChartTabWorkspaceState([source, trailingTab], source.id);

    expect(nextState).not.toBeNull();
    const duplicate = nextState!.chartTabs[1];
    expect(nextState!.activeChartTabId).toBe(duplicate.id);
    expect(nextState!.chartTabs[2]).toBe(trailingTab);
    expect(duplicate).toMatchObject({
      title: 'NSE:AXISBANK',
      rawBars: source.rawBars,
      displayBars: source.displayBars,
      viewport: source.viewport,
      paneScaleOverrides: source.paneScaleOverrides,
    });
    expect(duplicate.id).not.toBe(source.id);
    expect(duplicate.rawBars).not.toBe(source.rawBars);
    expect(duplicate.paneScaleOverrides).not.toBe(source.paneScaleOverrides);
  });
});
