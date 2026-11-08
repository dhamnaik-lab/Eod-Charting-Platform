import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// React SSR intentionally uses Zustand's initial snapshot. Inject the requested
// store state explicitly to test the render, not Zustand's SSR snapshot policy.
const store = vi.hoisted(() => ({ error: null as string | null }));
vi.mock('@/store/chartStore', () => ({
  getActiveChartTab: () => null,
  useChartStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    snapshot: null,
    chartTabs: [],
    activeChartTabId: '',
    isDatabaseTransitioning: false,
    databaseTransitionMessage: null,
    importProgress: { running: false },
    downloadProgress: { running: false, error: null },
    workspaceAutosaveError: store.error,
  }),
}));

import { StatusBar } from '@/components/StatusBar';

afterEach(() => {
  store.error = null;
});

describe('B07 workspace autosave error visibility', () => {
  it('shows a persistent accessible status while a background save is failing', () => {
    store.error = 'Settings database is locked';
    const markup = renderToStaticMarkup(createElement(StatusBar));
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Workspace save failed');
    expect(markup).toContain('Settings database is locked');
    expect(markup).toContain('retrying');
  });

  it('removes only the workspace error status after a confirmed recovery', () => {
    store.error = null;
    const markup = renderToStaticMarkup(createElement(StatusBar));
    expect(markup).not.toContain('Workspace save failed');
    expect(markup).toContain('No DB');
    expect(markup).toContain('IST');
  });
});
