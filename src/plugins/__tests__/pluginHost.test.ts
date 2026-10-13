import { describe, expect, it, vi } from 'vitest';
import { PluginHost } from '../pluginHost';
import type { RegisteredPlugin } from '../types';

describe('PluginHost lifecycle and sandboxing', () => {
  const dummyPlugin: RegisteredPlugin = {
    manifest: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      type: 'indicator',
      status: 'bundled',
      description: 'Test plugin for unit testing',
      capabilities: ['test'],
    },
    externalLoadingSupported: false,
    defaultEnabled: true,
  };

  it('registers and retrieves plugins correctly', () => {
    const host = new PluginHost([dummyPlugin]);
    expect(host.getPlugin('test-plugin')).toBe(dummyPlugin);
    expect(host.listPlugins()).toHaveLength(1);
    expect(host.getRuntimeInfo('test-plugin')?.state).toBe('unloaded');
  });

  it('executes plugin init lifecycle hook with context', async () => {
    const initSpy = vi.fn();
    const pluginWithLifecycle: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'lifecycle-plugin' },
      lifecycle: {
        init: initSpy,
      },
    };

    const host = new PluginHost([pluginWithLifecycle]);
    const success = await host.startPlugin('lifecycle-plugin');

    expect(success).toBe(true);
    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(host.isPluginActive('lifecycle-plugin')).toBe(true);
    expect(host.getRuntimeInfo('lifecycle-plugin')?.state).toBe('active');
  });

  it('isolates errors during plugin initialization without crashing host', async () => {
    const failingPlugin: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'failing-plugin' },
      lifecycle: {
        init: () => {
          throw new Error('Explosive init failure');
        },
      },
    };

    const host = new PluginHost([failingPlugin]);
    const success = await host.startPlugin('failing-plugin');

    expect(success).toBe(false);
    expect(host.isPluginActive('failing-plugin')).toBe(false);
    const info = host.getRuntimeInfo('failing-plugin');
    expect(info?.state).toBe('error');
    expect(info?.lastError).toContain('Explosive init failure');

    const logs = host.getPluginLogs('failing-plugin');
    expect(logs.some((l) => l.level === 'error' && l.message.includes('Explosive init failure'))).toBe(true);
  });

  it('notifies active plugins of bar updates and instrument changes', async () => {
    const onBarsSpy = vi.fn();
    const onInstSpy = vi.fn();

    const activePlugin: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'event-plugin' },
      lifecycle: {
        onBarsUpdated: onBarsSpy,
        onInstrumentChanged: onInstSpy,
      },
    };

    const host = new PluginHost([activePlugin]);
    await host.startPlugin('event-plugin');

    const sampleBars = [
      { date: '2026-10-01', open: 100, high: 105, low: 99, close: 104, volume: 1000 },
    ];
    await host.notifyBarsUpdated(sampleBars);
    expect(onBarsSpy).toHaveBeenCalledWith(sampleBars);

    const instrument = { exchange: 'NSE', symbol: 'RELIANCE' };
    await host.notifyInstrumentChanged(instrument);
    expect(onInstSpy).toHaveBeenCalledWith(instrument);
  });

  it('isolates error during bar notification and keeps other plugins running', async () => {
    const onBarsHealthy = vi.fn();
    const onBarsFailing = vi.fn().mockImplementation(() => {
      throw new Error('Bar notification crash');
    });

    const healthy: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'healthy' },
      lifecycle: { onBarsUpdated: onBarsHealthy },
    };
    const buggy: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'buggy' },
      lifecycle: { onBarsUpdated: onBarsFailing },
    };

    const host = new PluginHost([healthy, buggy]);
    await host.startPlugin('healthy');
    await host.startPlugin('buggy');

    await host.notifyBarsUpdated([]);

    expect(onBarsFailing).toHaveBeenCalledTimes(1);
    expect(onBarsHealthy).toHaveBeenCalledTimes(1);
    expect(host.isPluginActive('healthy')).toBe(true);
  });

  it('stops plugins and calls destroy cleanly', async () => {
    const destroySpy = vi.fn();
    const plugin: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'stoppable' },
      lifecycle: { destroy: destroySpy },
    };

    const host = new PluginHost([plugin]);
    await host.startPlugin('stoppable');
    expect(host.isPluginActive('stoppable')).toBe(true);

    await host.stopPlugin('stoppable');
    expect(destroySpy).toHaveBeenCalledTimes(1);
    expect(host.getRuntimeInfo('stoppable')?.state).toBe('destroyed');
    expect(host.isPluginActive('stoppable')).toBe(false);
  });

  it('records structured logs emitted through context', async () => {
    const loggingPlugin: RegisteredPlugin = {
      ...dummyPlugin,
      manifest: { ...dummyPlugin.manifest, id: 'logger' },
      lifecycle: {
        init: (ctx) => {
          ctx.log('info', 'Logger is ready', { mode: 'fast' });
          ctx.log('warn', 'Low memory warning');
        },
      },
    };

    const host = new PluginHost([loggingPlugin]);
    await host.startPlugin('logger');

    const logs = host.getPluginLogs('logger');
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs.some((l) => l.level === 'info' && l.message.includes('Logger is ready'))).toBe(true);
    expect(logs.some((l) => l.level === 'warn' && l.message.includes('Low memory'))).toBe(true);
  });
});
