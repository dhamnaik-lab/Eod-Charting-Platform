import { getDesktopApi } from '@/platform';
import type { ExternalPluginPackageDescriptor } from '@/types/desktop';
import { pluginHost } from './registry';
import type { EodPlugin, PluginEnabledMap, PluginManifest, RegisteredPlugin } from './types';

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeUtf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = i + 1 < bytes.length ? (bytes[i + 1] ?? 0) : 0;
    const b2 = i + 2 < bytes.length ? (bytes[i + 2] ?? 0) : 0;
    const n = (b0 << 16) | (b1 << 8) | b2;
    out += B64_CHARS[(n >> 18) & 63];
    out += B64_CHARS[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64_CHARS[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[n & 63] : '=';
  }
  return out;
}

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

export async function evaluatePluginModuleCode(code: string): Promise<EodPlugin> {
  const blob = new Blob([code], { type: 'text/javascript' });
  const blobUrl = URL.createObjectURL(blob);
  const moduleUrl = blobUrl.startsWith('blob:nodedata:')
    ? `data:text/javascript;base64,${encodeUtf8ToBase64(code)}`
    : blobUrl;
  try {
    const mod = await import(/* @vite-ignore */ moduleUrl);
    const exported = mod.default ?? mod.plugin ?? mod;
    if (typeof exported === 'function') {
      const instance = new exported() as EodPlugin;
      if (typeof instance.onload === 'function') return instance;
    }
    if (exported && typeof exported.onload === 'function') {
      return exported as EodPlugin;
    }
    throw new Error('Plugin module must default-export a class or object with an onload(ctx) method.');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
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