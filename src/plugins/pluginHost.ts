import type {
  PluginBar,
  PluginChartOverlayRegistration,
  PluginContext,
  PluginCoordinateMapper,
  PluginDisposable,
  PluginEnabledMap,
  PluginIndicatorRegistration,
  PluginInstrument,
  PluginLogEntry,
  PluginLogLevel,
  PluginPanelRegistration,
  PluginRuntimeInfo,
  PluginScannerRegistration,
  RegisteredPlugin,
} from './types';

const MAX_LOG_ENTRIES_PER_PLUGIN = 200;

export class PluginHost {
  private plugins = new Map<string, RegisteredPlugin>();
  private runtimeInfos = new Map<string, PluginRuntimeInfo>();
  private logs = new Map<string, PluginLogEntry[]>();
  private pluginDisposables = new Map<string, Set<() => void>>();
  private chartOverlays = new Map<string, { pluginId: string; registration: PluginChartOverlayRegistration }>();
  private indicators = new Map<string, { pluginId: string; registration: PluginIndicatorRegistration }>();
  private scanners = new Map<string, { pluginId: string; registration: PluginScannerRegistration }>();
  private panels = new Map<string, { pluginId: string; registration: PluginPanelRegistration }>();
  private listeners = new Set<() => void>();
  private currentInstrument: PluginInstrument | null = null;
  private currentBars: readonly PluginBar[] = [];

  constructor(initialPlugins: RegisteredPlugin[] = []) {
    for (const plugin of initialPlugins) {
      this.register(plugin);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        // Ignore listener errors
      }
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
    this.notifyListeners();
  }

  async unregister(pluginId: string): Promise<void> {
    const info = this.runtimeInfos.get(pluginId);
    if (info && info.state === 'active') {
      await this.stopPlugin(pluginId);
    }
    this.runPluginDisposables(pluginId);
    this.plugins.delete(pluginId);
    this.runtimeInfos.delete(pluginId);
    this.logs.delete(pluginId);
    this.notifyListeners();
  }

  private addPluginDisposable(pluginId: string, cleanup: () => void): PluginDisposable {
    let set = this.pluginDisposables.get(pluginId);
    if (!set) {
      set = new Set();
      this.pluginDisposables.set(pluginId, set);
    }
    let disposed = false;
    const wrapped = () => {
      if (disposed) return;
      disposed = true;
      set?.delete(wrapped);
      try {
        cleanup();
      } finally {
        this.notifyListeners();
      }
    };
    set.add(wrapped);
    return { dispose: wrapped };
  }

  private runPluginDisposables(pluginId: string): void {
    const set = this.pluginDisposables.get(pluginId);
    if (!set) return;
    for (const cleanup of Array.from(set)) {
      try {
        cleanup();
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.appendLog(pluginId, 'error', `Cleanup disposable failed: ${msg}`);
      }
    }
    set.clear();
  }

  getPlugin(pluginId: string): RegisteredPlugin | null {
    return this.plugins.get(pluginId) ?? null;
  }

  listPlugins(): RegisteredPlugin[] {
    return Array.from(this.plugins.values());
  }

  listChartOverlays(): PluginChartOverlayRegistration[] {
    return Array.from(this.chartOverlays.values())
      .filter((entry) => this.isPluginActive(entry.pluginId))
      .map((entry) => entry.registration);
  }

  listRegisteredIndicators(): PluginIndicatorRegistration[] {
    return Array.from(this.indicators.values())
      .filter((entry) => this.isPluginActive(entry.pluginId))
      .map((entry) => entry.registration);
  }

  listRegisteredScanners(): PluginScannerRegistration[] {
    return Array.from(this.scanners.values())
      .filter((entry) => this.isPluginActive(entry.pluginId))
      .map((entry) => entry.registration);
  }

  listRegisteredPanels(): PluginPanelRegistration[] {
    return Array.from(this.panels.values())
      .filter((entry) => this.isPluginActive(entry.pluginId))
      .map((entry) => entry.registration);
  }

  renderChartOverlays(
    ctx: CanvasRenderingContext2D,
    bars: readonly PluginBar[],
    mapper: PluginCoordinateMapper,
    width: number,
    height: number,
  ): void {
    for (const [key, entry] of this.chartOverlays.entries()) {
      if (!this.isPluginActive(entry.pluginId)) continue;
      ctx.save();
      try {
        entry.registration.render(ctx, bars, mapper, width, height);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.appendLog(entry.pluginId, 'error', `Overlay "${key}" render error: ${msg}`);
      } finally {
        ctx.restore();
      }
    }
  }

  async syncEnabledPlugins(enabledMap: PluginEnabledMap | null | undefined): Promise<void> {
    for (const [pluginId, plugin] of this.plugins.entries()) {
      const shouldEnable = typeof enabledMap?.[pluginId] === 'boolean'
        ? Boolean(enabledMap[pluginId])
        : plugin.defaultEnabled;
      const active = this.isPluginActive(pluginId);
      if (shouldEnable && !active) {
        await this.startPlugin(pluginId);
      } else if (!shouldEnable && active) {
        await this.stopPlugin(pluginId);
      }
    }
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
    entries.push({ timestamp: Date.now(), level, message, data });
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
      getBars: () => this.currentBars,
      log: (level, message, data) => this.appendLog(pluginId, level, message, data),
      getLogs: () => this.getPluginLogs(pluginId),
      registerChartOverlay: (overlay) => {
        const key = `${pluginId}:${overlay.id}`;
        this.chartOverlays.set(key, { pluginId, registration: overlay });
        this.notifyListeners();
        return this.addPluginDisposable(pluginId, () => {
          this.chartOverlays.delete(key);
        });
      },
      registerIndicator: (indicator) => {
        const key = `${pluginId}:${indicator.id}`;
        this.indicators.set(key, { pluginId, registration: indicator });
        this.notifyListeners();
        return this.addPluginDisposable(pluginId, () => {
          this.indicators.delete(key);
        });
      },
      registerScanner: (scanner) => {
        const key = `${pluginId}:${scanner.id}`;
        this.scanners.set(key, { pluginId, registration: scanner });
        this.notifyListeners();
        return this.addPluginDisposable(pluginId, () => {
          this.scanners.delete(key);
        });
      },
      registerPanel: (panel) => {
        const key = `${pluginId}:${panel.id}`;
        this.panels.set(key, { pluginId, registration: panel });
        this.notifyListeners();
        return this.addPluginDisposable(pluginId, () => {
          this.panels.delete(key);
        });
      },
      registerCleanup: (cleanup) => this.addPluginDisposable(pluginId, cleanup),
    };
  }

  async startPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    if (plugin.manifest.status === 'external' && !plugin.instance && !plugin.lifecycle) {
      const info = this.runtimeInfos.get(pluginId);
      if (info) {
        info.enabled = false;
        info.lastError = 'External execution is unavailable until an isolated runtime is approved.';
        this.runtimeInfos.set(pluginId, info);
      }
      this.notifyListeners();
      return false;
    }
    if (this.isPluginActive(pluginId)) return true;

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
      if (plugin.instance?.onload) {
        await plugin.instance.onload(context);
      }
      if (plugin.lifecycle?.init) {
        await plugin.lifecycle.init(context);
      }
      info.state = 'active';
      info.initializedAt = Date.now();
      info.enabled = true;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'info', `Plugin "${plugin.manifest.name}" initialized successfully.`);
      this.notifyListeners();
      return true;
    } catch (error) {
      this.runPluginDisposables(pluginId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      info.state = 'error';
      info.lastError = errorMessage;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'error', `Failed to initialize plugin "${plugin.manifest.name}": ${errorMessage}`);
      this.notifyListeners();
      return false;
    }
  }

  async stopPlugin(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    const info = this.runtimeInfos.get(pluginId);
    if (!plugin || !info || info.state !== 'active') return;

    try {
      if (plugin.instance?.onunload) {
        await plugin.instance.onunload();
      }
      if (plugin.lifecycle?.destroy) {
        await plugin.lifecycle.destroy();
      }
      this.runPluginDisposables(pluginId);
      info.state = 'destroyed';
      info.enabled = false;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'info', `Plugin "${plugin.manifest.name}" stopped.`);
    } catch (error) {
      this.runPluginDisposables(pluginId);
      const errorMessage = error instanceof Error ? error.message : String(error);
      info.state = 'error';
      info.lastError = errorMessage;
      this.runtimeInfos.set(pluginId, info);
      this.appendLog(pluginId, 'error', `Error while stopping plugin "${plugin.manifest.name}": ${errorMessage}`);
    } finally {
      this.notifyListeners();
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