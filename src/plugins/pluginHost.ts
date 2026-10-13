import type {
  ChartPluginLifecycle,
  PluginBar,
  PluginContext,
  PluginInstrument,
  PluginLogEntry,
  PluginLogLevel,
  PluginRuntimeInfo,
  RegisteredPlugin,
} from './types';

const MAX_LOG_ENTRIES_PER_PLUGIN = 200;

export class PluginHost {
  private plugins = new Map<string, RegisteredPlugin>();
  private runtimeInfos = new Map<string, PluginRuntimeInfo>();
  private logs = new Map<string, PluginLogEntry[]>();
  private currentInstrument: PluginInstrument | null = null;
  private currentBars: readonly PluginBar[] = [];

  constructor(initialPlugins: RegisteredPlugin[] = []) {
    for (const plugin of initialPlugins) {
      this.register(plugin);
    }
  }

  register(plugin: RegisteredPlugin): void {
    const id = plugin.manifest.id;
    this.plugins.set(id, plugin);
    if (!this.runtimeInfos.has(id)) {
      this.runtimeInfos.set(id, {
        pluginId: id,
        state: 'unloaded',
        enabled: plugin.defaultEnabled,
        lastError: null,
        initializedAt: null,
      });
    }
    if (!this.logs.has(id)) {
      this.logs.set(id, []);
    }
  }

  async unregister(pluginId: string): Promise<void> {
    const info = this.runtimeInfos.get(pluginId);
    if (info && info.state === 'active') {
      await this.stopPlugin(pluginId);
    }
    this.plugins.delete(pluginId);
    this.runtimeInfos.delete(pluginId);
    this.logs.delete(pluginId);
  }

  getPlugin(pluginId: string): RegisteredPlugin | null {
    return this.plugins.get(pluginId) ?? null;
  }

  listPlugins(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  getRuntimeInfo(pluginId: string): PluginRuntimeInfo | null {
    return this.runtimeInfos.get(pluginId) ?? null;
  }

  listRuntimeInfos(): PluginRuntimeInfo[] {
    return Array.from(this.runtimeInfos.values());
  }

  getPluginLogs(pluginId: string): readonly PluginLogEntry[] {
    return this.logs.get(pluginId) ?? [];
  }

  clearPluginLogs(pluginId: string): void {
    this.logs.set(pluginId, []);
  }

  isPluginActive(pluginId: string): boolean {
    return this.runtimeInfos.get(pluginId)?.state === 'active';
  }

  private appendLog(pluginId: string, level: PluginLogLevel, message: string, data?: unknown): void {
    const entries = this.logs.get(pluginId) ?? [];
    entries.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });
    if (entries.length > MAX_LOG_ENTRIES_PER_PLUGIN) {
      entries.shift();
    }
    this.logs.set(pluginId, entries);
  }

  createContext(pluginId: string): PluginContext {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not registered: ${pluginId}`);
    }

    return {
      pluginId,
      manifest: plugin.manifest,
      activeInstrument: this.currentInstrument,
      bars: this.currentBars,
      log: (level, message, data) => this.appendLog(pluginId, level, message, data),
      getLogs: () => this.getPluginLogs(pluginId),
    };
  }

  async startPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }

    const info = this.runtimeInfos.get(pluginId) ?? {
      pluginId,
      state: 'unloaded',
      enabled: true,
      lastError: null,
      initializedAt: null,
    };

    info.state = 'initializing';
    info.lastError = null;
    this.runtimeInfos.set(pluginId, info);

    try {
      const context = this.createContext(pluginId);
      if (plugin.lifecycle?.init) {
        await plugin.lifecycle.init(context);
      }
      info.state = 'active';
      info.initializedAt = Date.now();
      info.enabled = true;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'info', `Plugin "${plugin.manifest.name}" initialized successfully.`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      info.state = 'error';
      info.lastError = errorMessage;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'error', `Failed to initialize plugin "${plugin.manifest.name}": ${errorMessage}`);
      return false;
    }
  }

  async stopPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const info = this.runtimeInfos.get(pluginId);
    if (!plugin || !info || info.state !== 'active') {
      return;
    }

    try {
      if (plugin.lifecycle?.destroy) {
        await plugin.lifecycle.destroy();
      }
      info.state = 'destroyed';
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'info', `Plugin "${plugin.manifest.name}" stopped.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      info.state = 'error';
      info.lastError = errorMessage;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'error', `Error while stopping plugin "${plugin.manifest.name}": ${errorMessage}`);
    }
  }

  async notifyBarsUpdated(bars: readonly PluginBar[]): Promise<void> {
    this.currentBars = bars;
    const promises: Promise<void>[] = [];

    for (const [pluginId, plugin] of this.plugins.entries()) {
      const info = this.runtimeInfos.get(pluginId);
      if (info?.state === 'active' && plugin.lifecycle?.onBarsUpdated) {
        promises.push(
          Promise.resolve()
            .then(() => plugin.lifecycle?.onBarsUpdated?.(bars))
            .catch((error) => {
              const msg = error instanceof Error ? error.message : String(error);
              this.appendLog(pluginId, 'error', `onBarsUpdated failed: ${msg}`);
            }),
        );
      }
    }

    await Promise.all(promises);
  }

  async notifyInstrumentChanged(instrument: PluginInstrument | null): Promise<void> {
    this.currentInstrument = instrument;
    const promises: Promise<void>[] = [];

    for (const [pluginId, plugin] of this.plugins.entries()) {
      const info = this.runtimeInfos.get(pluginId);
      if (info?.state === 'active' && plugin.lifecycle?.onInstrumentChanged) {
        promises.push(
          Promise.resolve()
            .then(() => plugin.lifecycle?.onInstrumentChanged?.(instrument))
            .catch((error) => {
              const msg = error instanceof Error ? error.message : String(error);
              this.appendLog(pluginId, 'error', `onInstrumentChanged failed: ${msg}`);
            }),
        );
      }
    }

    await Promise.all(promises);
  }

  async shutdown(): Promise<void> {
    const activePluginIds = Array.from(this.runtimeInfos.entries())
      .filter(([_, info]) => info.state === 'active')
      .map(([id]) => id);

    for (const id of activePluginIds) {
      await this.stopPlugin(id);
    }
  }
}
