import { afterEach, describe, expect, it, vi } from 'vitest';

describe('uiStore magnet preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('restores the saved state and writes subsequent changes', async () => {
    const values = new Map([['eod-chart.magnet.enabled.v1', '1']]);
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const { useUiStore } = await import('@/store/uiStore');

    expect(useUiStore.getState().magnetEnabled).toBe(true);

    useUiStore.getState().toggleMagnet();

    expect(useUiStore.getState().magnetEnabled).toBe(false);
    expect(values.get('eod-chart.magnet.enabled.v1')).toBe('0');
  });
});

describe('uiStore chart toolbar actions', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('opens the custom formula dialog and issues distinct screenshot requests', async () => {
    const { useUiStore } = await import('@/store/uiStore');

    useUiStore.getState().openCustomFormulaDialog();
    expect(useUiStore.getState().customFormulaDialogOpen).toBe(true);

    useUiStore.getState().requestChartScreenshot('save');
    expect(useUiStore.getState().chartScreenshotRequest).toEqual({
      action: 'save',
      requestCount: 1,
    });

    useUiStore.getState().requestChartScreenshot('copy');
    expect(useUiStore.getState().chartScreenshotRequest).toEqual({
      action: 'copy',
      requestCount: 2,
    });
  });
});
