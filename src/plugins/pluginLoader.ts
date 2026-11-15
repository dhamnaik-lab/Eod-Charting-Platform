import { getDesktopApi } from '@/platform';
import type { ExternalPluginPackageDescriptor } from '@/types/desktop';
import { pluginHost } from './registry';
import type { PluginEnabledMap, PluginManifest, RegisteredPlugin } from './types';

export function normalizeExternalManifest(desc: ExternalPluginPackageDescriptor): PluginManifest {
  return {
    id: desc.id,
    name: desc.name,
    version: desc.version,
    minHostVersion: desc.minHostVersion ?? undefined,
    entry: desc.entry,
    type: (desc.pluginType as PluginManifest['type']) || 'indicator',
    status: 'external',
    description: desc.description || 'External runtime plugin.',
    capabilities: desc.capabilities ?? [],
    permissions: (desc.permissions as PluginManifest['permissions']) ?? [],
  };
}

// Installation and discovery must never evaluate code, even when saved settings request enablement.
// Execution requires a future, separately approved isolated runtime (P5-F2/P5-F3).
export async function registerExternalPluginMetadata(
  desc: ExternalPluginPackageDescriptor,
): Promise<RegisteredPlugin> {
  const manifest = normalizeExternalManifest(desc);
  const existing = pluginHost.getPlugin(manifest.id);
  if (existing && existing.manifest.status !== 'external') {
    throw new Error(`External plugin ID conflicts with an existing plugin: ${manifest.id}`);
  }
  if (existing) {
    if (!existing.instance && !existing.lifecycle &&
        JSON.stringify(existing.manifest) === JSON.stringify(manifest)) {
      return existing;
    }
    // Stop any older in-renderer instance before replacing its registration with inert metadata.
    await pluginHost.unregister(manifest.id);
  }
  const registered: RegisteredPlugin = {
    manifest,
    externalLoadingSupported: false,
    defaultEnabled: false,
  };
  pluginHost.register(registered);
  return registered;
}

// Keep the historical exported helper callable, but never execute the supplied JS.
export async function loadExternalPluginFromDescriptor(
  desc: ExternalPluginPackageDescriptor,
  _code: string,
  _defaultEnabled = false,
): Promise<RegisteredPlugin> {
  return registerExternalPluginMetadata(desc);
}

export async function discoverAndLoadExternalPlugins(
  enabledMap?: PluginEnabledMap | null,
): Promise<RegisteredPlugin[]> {
  const api = getDesktopApi();
  if (!api || typeof api.listExternalPlugins !== 'function') return [];
  const descriptors = await api.listExternalPlugins();
  const loaded: RegisteredPlugin[] = [];

  for (const desc of descriptors) {
    try {
      const reg = await registerExternalPluginMetadata(desc);
      loaded.push(reg);
    } catch (error) {
      if (pluginHost.getPlugin(desc.id)?.manifest.status === 'bundled') continue;
      const fallback: RegisteredPlugin = {
        manifest: { ...normalizeExternalManifest(desc), status: 'error' },
        externalLoadingSupported: true,
        defaultEnabled: false,
        lifecycle: {
          init: () => {
            throw error instanceof Error ? error : new Error(String(error));
          },
        },
      };
      pluginHost.register(fallback);
    }
  }

  if (enabledMap) {
    await pluginHost.syncEnabledPlugins(enabledMap);
  }
  return loaded;
}

export async function installAndLoadExternalPlugin(): Promise<RegisteredPlugin | null> {
  const api = getDesktopApi();
  if (!api || typeof api.installExternalPluginPackage !== 'function') {
    throw new Error('External plugin installer is unavailable.');
  }
  const desc = await api.installExternalPluginPackage();
  if (!desc) return null;
  return registerExternalPluginMetadata(desc);
}

export async function uninstallExternalPluginById(pluginId: string): Promise<void> {
  const api = getDesktopApi();
  await pluginHost.unregister(pluginId);
  if (api && typeof api.uninstallExternalPlugin === 'function') {
    await api.uninstallExternalPlugin({ pluginId });
  }
}