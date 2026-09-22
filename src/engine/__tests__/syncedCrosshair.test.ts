import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/store/uiStore';

describe('Synced Crosshair & Symbol Linking', () => {
  beforeEach(() => {
    useUiStore.setState({
      crosshairSyncEnabled: false,
      symbolLinkEnabled: false,
      syncedCrosshairDate: null,
    });
  });

  it('toggles crosshair sync and sets synced date', () => {
    const store = useUiStore.getState();
    expect(store.crosshairSyncEnabled).toBe(false);

    store.setSyncedCrosshairDate('2026-06-15');
    expect(useUiStore.getState().syncedCrosshairDate).toBe('2026-06-15');

    store.toggleCrosshairSync();
    expect(useUiStore.getState().crosshairSyncEnabled).toBe(true);

    store.toggleCrosshairSync();
    expect(useUiStore.getState().crosshairSyncEnabled).toBe(false);
  });

  it('toggles symbol link state', () => {
    const store = useUiStore.getState();
    expect(store.symbolLinkEnabled).toBe(false);

    store.toggleSymbolLink();
    expect(useUiStore.getState().symbolLinkEnabled).toBe(true);

    store.toggleSymbolLink();
    expect(useUiStore.getState().symbolLinkEnabled).toBe(false);
  });
});
