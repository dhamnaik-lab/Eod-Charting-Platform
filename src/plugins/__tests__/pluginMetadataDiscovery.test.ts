import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDesktopApi } from '@/platform';
import { pluginHost } from '../registry';
import {
  discoverAndLoadExternalPlugins,
  installAndLoadExternalPlugin,
  loadExternalPluginFromDescriptor,
} from '../pluginLoader';
import type { ExternalPluginPackageDescriptor } from '@/types/desktop';

vi.mock('@/platform', () => ({ getDesktopApi: vi.fn() }));

const descriptor: ExternalPluginPackageDescriptor = {
  id: 'external.p5f1-safe',
  name: 'P5F1 Safety Fixture',
  version: '1.0.0',
  entry: 'main.js',
  pluginType: 'indicator',
  description: 'Synthetic metadata-only plugin',
  capabilities: ['indicator:register'],
  permissions: ['indicator:register'],
  folderPath: 'synthetic-profile/plugins/external.p5f1-safe',
};

const topLevelSideEffect = 'globalThis.__P5F1_TOP_LEVEL_EXECUTED__ = true; export default class Plugin { onload() {} }';

function mockDesktopApi() {
  const api = {
    listExternalPlugins: vi.fn(async () => [descriptor]),
    readExternalPluginModule: vi.fn(async () => ({ pluginId: descriptor.id, entry: 'main.js', code: topLevelSideEffect })),
    installExternalPluginPackage: vi.fn(async () => descriptor),
    uninstallExternalPlugin: vi.fn(async () => undefined),
  };
  vi.mocked(getDesktopApi).mockReturnValue(api as unknown as ReturnType<typeof getDesktopApi>);
  return api;
}

afterEach(async () => {
  await pluginHost.unregister(descriptor.id);
  vi.clearAllMocks();
});

describe('P5-F1 metadata-only discovery and zero-evaluation import', () => {
  it('discovers metadata without requesting or evaluating JavaScript, even with a saved enabled flag', async () => {
    const api = mockDesktopApi();
    const loaded = await discoverAndLoadExternalPlugins({ [descriptor.id]: true });
    expect(loaded).toHaveLength(1);
    expect(api.readExternalPluginModule).not.toHaveBeenCalled();
    expect(loaded[0]?.instance).toBeUndefined();
    expect(loaded[0]?.lifecycle).toBeUndefined();
    expect(loaded[0]?.defaultEnabled).toBe(false);
    expect(pluginHost.isPluginActive(descriptor.id)).toBe(false);
    expect(pluginHost.getRuntimeInfo(descriptor.id)?.enabled).toBe(false);
  });

  it('imports a package as inactive metadata without reading JS', async () => {
    const api = mockDesktopApi();
    const installed = await installAndLoadExternalPlugin();
    expect(installed?.manifest.id).toBe(descriptor.id);
    expect(installed?.instance).toBeUndefined();
    expect(api.installExternalPluginPackage).toHaveBeenCalledTimes(1);
    expect(api.readExternalPluginModule).not.toHaveBeenCalled();
    expect(pluginHost.isPluginActive(descriptor.id)).toBe(false);
  });

  it('keeps an external metadata entry inactive under explicit direct start or subsequent enable sync', async () => {
    mockDesktopApi();
    await discoverAndLoadExternalPlugins();
    expect(await pluginHost.startPlugin(descriptor.id)).toBe(false);
    await pluginHost.syncEnabledPlugins({ [descriptor.id]: true });
    expect(pluginHost.isPluginActive(descriptor.id)).toBe(false);
    expect(pluginHost.listChartOverlays()).toHaveLength(0);
    expect(pluginHost.listRegisteredIndicators()).toHaveLength(0);
    expect(pluginHost.listRegisteredScanners()).toHaveLength(0);
  });

  it('repeated discovery returns the same inactive metadata entry without extra module reads', async () => {
    const api = mockDesktopApi();
    const first = await discoverAndLoadExternalPlugins();
    const second = await discoverAndLoadExternalPlugins({ [descriptor.id]: true });
    expect(second[0]).toBe(first[0]);
    expect(pluginHost.listPlugins().filter((p) => p.manifest.id === descriptor.id)).toHaveLength(1);
    expect(api.listExternalPlugins).toHaveBeenCalledTimes(2);
    expect(api.readExternalPluginModule).not.toHaveBeenCalled();
  });

  it('preserves the legacy helper signature but ignores the supplied module source', async () => {
    const registered = await loadExternalPluginFromDescriptor(descriptor, topLevelSideEffect, true);
    expect(registered.instance).toBeUndefined();
    expect(registered.defaultEnabled).toBe(false);
    expect(registered.externalLoadingSupported).toBe(false);
    expect(pluginHost.isPluginActive(descriptor.id)).toBe(false);
  });

  it('prevents a conflicting external manifest from replacing a bundled plugin', async () => {
    const existing = pluginHost.listPlugins().find((item) => item.manifest.status === 'bundled');
    expect(existing).toBeDefined();
    const collision = { ...descriptor, id: existing!.manifest.id };
    const api = mockDesktopApi();
    api.listExternalPlugins.mockResolvedValue([collision]);
    await discoverAndLoadExternalPlugins();
    expect(pluginHost.getPlugin(collision.id)).toBe(existing);
    expect(api.readExternalPluginModule).not.toHaveBeenCalled();
  });
});
