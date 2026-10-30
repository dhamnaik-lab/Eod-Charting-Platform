import { describe, expect, it } from 'vitest';
import { evaluatePluginModuleCode } from '../pluginLoader';
import { PluginHost } from '../pluginHost';

describe('Phase P2 Dynamic Blob ESM Plugin Loader', () => {
  it('dynamically evaluates an external ESM plugin class from raw JS text and registers extensions', async () => {
    const rawJs = `
      export default class SampleExternalOverlayPlugin {
        onload(ctx) {
          ctx.registerChartOverlay({
            id: 'ext-vwap-bands',
            name: 'External VWAP Bands',
            render: (canvasCtx, bars, mapper, width, height) => {
              canvasCtx.fillText('EXT_VWAP', 10, 10);
            }
          });
          ctx.log('info', 'SampleExternalOverlayPlugin loaded via Blob URL');
        }
        onunload() {}
      }
    `;

    const instance = await evaluatePluginModuleCode(rawJs);
    const host = new PluginHost([
      {
        manifest: {
          id: 'ext.vwap-bands',
          name: 'External VWAP Bands',
          version: '1.0.0',
          type: 'indicator',
          status: 'external',
          description: 'Loaded from raw JS string',
          capabilities: ['chart:draw'],
        },
        externalLoadingSupported: true,
        defaultEnabled: true,
        instance,
      },
    ]);

    const started = await host.startPlugin('ext.vwap-bands');
    expect(started).toBe(true);
    expect(host.listChartOverlays()).toHaveLength(1);
    expect(host.listChartOverlays()[0]?.name).toBe('External VWAP Bands');

    await host.stopPlugin('ext.vwap-bands');
    expect(host.listChartOverlays()).toHaveLength(0);
  });

  it('bridges dynamically registered indicators and scanners into host registries and unregisters on stop', async () => {
    const { pluginHost } = await import('../registry');
    const { buildRenderableIndicators } = await import('@/indicators/registry');
    const { listCoreScannerDefinitions } = await import('@/plugins/scanner/scannerPlugin');

    const rawJs = `
      export default class SampleIndicatorAndScannerPlugin {
        onload(ctx) {
          ctx.registerIndicator({
            id: 'EXT_TEST_MID',
            name: 'External Test Midpoint',
            shortLabel: 'EXT_MID',
            placement: 'overlay',
            plots: [{ key: 'mid', label: 'Mid', type: 'line', color: '#22c55e' }],
            calculate: (bars) => ({ mid: bars.map((b) => (b.high + b.low) / 2) }),
          });
          ctx.registerScanner({
            id: 'ext_test_scanner',
            name: 'External Test Scanner',
            categoryName: 'External Plugins',
            evaluate: () => ({ matched: true, direction: 'bullish' }),
          });
        }
      }
    `;

    const instance = await evaluatePluginModuleCode(rawJs);
    pluginHost.register({
      manifest: {
        id: 'ext.ind-scan-test',
        name: 'Ext Ind Scan Test',
        version: '1.0.0',
        type: 'indicator',
        status: 'external',
        description: 'Test dynamic indicator & scanner bridge',
        capabilities: ['indicator:register', 'scanner:register'],
      },
      externalLoadingSupported: true,
      defaultEnabled: false,
      instance,
    });

    await pluginHost.startPlugin('ext.ind-scan-test');
    expect(listCoreScannerDefinitions().some((d) => d.id === 'ext_test_scanner')).toBe(true);

    const sampleBars = [
      { date: '2026-10-01', timestamp: 1, open: 100, high: 110, low: 90, close: 105, volume: 1000 },
      { date: '2026-10-02', timestamp: 2, open: 105, high: 120, low: 100, close: 115, volume: 1200 },
    ];
    const bundle = buildRenderableIndicators(sampleBars, [
      { id: 'ext-1', kind: 'EXT_TEST_MID' as any, placement: 'overlay', color: '#22c55e' } as any,
    ]);
    expect(bundle.overlays).toHaveLength(1);
    expect(bundle.overlays[0]?.lines[0]?.values).toEqual([100, 110]);

    await pluginHost.unregister('ext.ind-scan-test');
    expect(listCoreScannerDefinitions().some((d) => d.id === 'ext_test_scanner')).toBe(false);
  });
});