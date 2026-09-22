import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GANN_PRICE_TIME_PLUGIN_ID } from '@/plugins/analysis/gannPriceTime/gannPlugin';
import { getBuiltInPlugin, isPluginEnabled, setPluginEnabled } from '@/plugins/registry';

const source = (relativePath: string): string =>
  readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('Gann overlay lifecycle integration', () => {
  it('keeps the automatic Gann analysis overlay disabled until explicitly enabled', () => {
    expect(getBuiltInPlugin(GANN_PRICE_TIME_PLUGIN_ID)?.defaultEnabled).toBe(false);
    expect(isPluginEnabled(GANN_PRICE_TIME_PLUGIN_ID, {})).toBe(false);

    const enabled = setPluginEnabled({}, GANN_PRICE_TIME_PLUGIN_ID, true);
    expect(isPluginEnabled(GANN_PRICE_TIME_PLUGIN_ID, enabled)).toBe(true);
  });

  it('binds ChartCanvas to persisted plugin settings instead of forcing the Gann plugin default', () => {
    const chartCanvas = source('src/components/ChartCanvas.tsx');

    expect(chartCanvas).toContain('subscribeAppSettingsChanges');
    expect(chartCanvas).toContain('settings.pluginEnabled');
    expect(chartCanvas).toContain('gannPluginEnabled');
    expect(chartCanvas).toContain('}, [bars, gannPluginEnabled]);');
    expect(chartCanvas).not.toContain('isPluginEnabled(GANN_PRICE_TIME_PLUGIN_ID, null)');
  });

  it('publishes successful application-setting saves to live consumers', () => {
    const settingsService = source('src/features/app/appSettingsService.ts');

    expect(settingsService).toContain('export function subscribeAppSettingsChanges');
    expect(settingsService).toContain('notifyAppSettingsChanges(settings);');
  });

  it('invalidates and clips the engine-owned Gann overlay to the price plot', () => {
    const chartEngine = source('src/engine/ChartEngine.ts');
    const setterStart = chartEngine.indexOf('setGannOverlayCallback(');
    const setterEnd = chartEngine.indexOf('setSyncedCrosshairBarIndex', setterStart);
    const setterBlock = chartEngine.slice(setterStart, setterEnd);
    expect(setterBlock).toContain('this.markDirty();');

    const renderStart = chartEngine.indexOf('if (this.gannOverlayCallback) {');
    const renderEnd = chartEngine.indexOf('this.overlayCtx.restore();', renderStart);
    const renderBlock = chartEngine.slice(renderStart, renderEnd);
    expect(renderBlock).toContain('this.overlayCtx.clip();');
    expect(renderBlock).toContain('layout.chartWidth');
    expect(renderBlock).toContain('renderState.pricePane.plotHeight');
    expect(renderBlock).not.toContain('rect.width');
    expect(renderBlock).not.toContain('rect.height');
  });
});
