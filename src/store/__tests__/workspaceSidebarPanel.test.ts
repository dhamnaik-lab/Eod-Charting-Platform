import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadWorkspace(panel: string | null) {
  vi.resetModules();
  const storage = new Map<string, string>();
  const key = 'eod-chart.sidebar.panel.v1';
  if (panel !== null) storage.set(key, panel);
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (name: string) => storage.get(name) ?? null,
      setItem: (name: string, value: string) => storage.set(name, value),
    },
  });
  const { useWorkspaceStore } = await import('../workspaceStore');
  return { store: useWorkspaceStore, storage, key };
}

afterEach(() => vi.unstubAllGlobals());

describe('sidebar panel selection', () => {
  it('restores a supported panel and persists the next selection', async () => {
    const { store, storage, key } = await loadWorkspace('watchlist');
    expect(store.getState().sidebarPanel).toBe('watchlist');
    store.getState().setSidebarPanel('market-movers');
    expect(storage.get(key)).toBe('market-movers');
  });

  it.each([null, 'unknown'])('defaults to Symbols for stored panel %s', async (panel) => {
    const { store } = await loadWorkspace(panel);
    expect(store.getState().sidebarPanel).toBe('symbols');
  });
});
