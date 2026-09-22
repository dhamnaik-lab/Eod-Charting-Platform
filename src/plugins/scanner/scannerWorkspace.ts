export const SCANNER_WORKSPACE_VERSION = 1;

export type ScannerWorkspaceUniverse = 'active-chart' | 'symbol-list' | 'watchlists';
export type ScannerWorkspaceSection = 'run' | 'results' | 'alerts' | 'library' | 'market-movers';
export type ScannerWorkspaceResultView = 'compact' | 'pattern-detail' | 'values' | 'debug';
export type ScannerWorkspaceExecutionMode = 'responsive' | 'fast';
export type ScannerWorkspaceFamilyFilter = 'all' | 'core' | 'gap' | 'reversal' | 'continuation' | 'neutral-bilateral';
export type ScannerWorkspaceDirectionFilter = 'all' | 'bullish' | 'bearish' | 'neutral';
export type ScannerWorkspacePriorityFilter = 'all' | 'high' | 'medium' | 'low';
export type ScannerWorkspacePrioritySort = 'category' | 'high-to-low' | 'low-to-high';

export interface ScannerWorkspaceConfig {
  exchange: string;
  universeSource: ScannerWorkspaceUniverse;
  selectedWatchlistIds: number[];
  selectedScannerIds: string[];
  lookbackBars: number | null;
  maxSymbols: number;
  executionMode: ScannerWorkspaceExecutionMode;
  familyFilter: ScannerWorkspaceFamilyFilter;
  directionFilter: ScannerWorkspaceDirectionFilter;
  minScore: number;
  recentOnly: boolean;
  activeSection: ScannerWorkspaceSection;
  resultView: ScannerWorkspaceResultView;
  priorityFilter: ScannerWorkspacePriorityFilter;
  prioritySort: ScannerWorkspacePrioritySort;
}

export interface SavedScannerWorkspace {
  id: string;
  name: string;
  config: ScannerWorkspaceConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ScannerWorkspaceProfile {
  version: typeof SCANNER_WORKSPACE_VERSION;
  current: ScannerWorkspaceConfig;
  activeWorkspaceId: string | null;
  workspaces: SavedScannerWorkspace[];
}

export function createScannerWorkspaceProfile(defaultConfig: ScannerWorkspaceConfig): ScannerWorkspaceProfile {
  return {
    version: SCANNER_WORKSPACE_VERSION,
    current: cloneScannerWorkspaceConfig(defaultConfig),
    activeWorkspaceId: null,
    workspaces: [],
  };
}

export function normalizeScannerWorkspaceProfile(
  value: unknown,
  defaultConfig: ScannerWorkspaceConfig,
): ScannerWorkspaceProfile {
  if (!isRecord(value) || value.version !== SCANNER_WORKSPACE_VERSION) {
    return createScannerWorkspaceProfile(defaultConfig);
  }
  const workspaces = Array.isArray(value.workspaces)
    ? value.workspaces
        .map((workspace) => normalizeSavedWorkspace(workspace, defaultConfig))
        .filter((workspace): workspace is SavedScannerWorkspace => workspace !== null)
    : [];
  const activeWorkspaceId = typeof value.activeWorkspaceId === 'string' && workspaces.some((workspace) => workspace.id === value.activeWorkspaceId)
    ? value.activeWorkspaceId
    : null;
  return {
    version: SCANNER_WORKSPACE_VERSION,
    current: normalizeScannerWorkspaceConfig(value.current, defaultConfig),
    activeWorkspaceId,
    workspaces,
  };
}

export function cloneScannerWorkspaceConfig(config: ScannerWorkspaceConfig): ScannerWorkspaceConfig {
  return {
    ...config,
    selectedWatchlistIds: [...config.selectedWatchlistIds],
    selectedScannerIds: [...config.selectedScannerIds],
  };
}

export function areScannerWorkspaceConfigsEqual(first: ScannerWorkspaceConfig, second: ScannerWorkspaceConfig): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function syncCurrentScannerWorkspace(
  profile: ScannerWorkspaceProfile,
  config: ScannerWorkspaceConfig,
  updatedAt: string,
): ScannerWorkspaceProfile {
  const current = cloneScannerWorkspaceConfig(config);
  return {
    ...profile,
    current,
    workspaces: profile.workspaces.map((workspace) =>
      workspace.id === profile.activeWorkspaceId
        ? { ...workspace, config: cloneScannerWorkspaceConfig(current), updatedAt }
        : workspace,
    ),
  };
}

export function saveScannerWorkspace(
  profile: ScannerWorkspaceProfile,
  name: string,
  config: ScannerWorkspaceConfig,
  savedAt: string,
): ScannerWorkspaceProfile {
  const trimmedName = name.trim();
  if (!trimmedName) return profile;
  const existing = profile.workspaces.find((workspace) => workspace.id === profile.activeWorkspaceId);
  const workspace: SavedScannerWorkspace = existing
    ? { ...existing, name: trimmedName, config: cloneScannerWorkspaceConfig(config), updatedAt: savedAt }
    : {
        id: createWorkspaceId(savedAt, profile.workspaces),
        name: trimmedName,
        config: cloneScannerWorkspaceConfig(config),
        createdAt: savedAt,
        updatedAt: savedAt,
      };
  const workspaces = existing
    ? profile.workspaces.map((item) => (item.id === workspace.id ? workspace : item))
    : [...profile.workspaces, workspace];
  return {
    ...profile,
    current: cloneScannerWorkspaceConfig(config),
    activeWorkspaceId: workspace.id,
    workspaces,
  };
}

export function duplicateScannerWorkspace(
  profile: ScannerWorkspaceProfile,
  sourceId: string | null,
  config: ScannerWorkspaceConfig,
  savedAt: string,
): ScannerWorkspaceProfile {
  const source = profile.workspaces.find((workspace) => workspace.id === sourceId);
  const name = uniqueWorkspaceName(source ? `${source.name} copy` : 'Scanner workspace', profile.workspaces);
  return saveScannerWorkspace({ ...profile, activeWorkspaceId: null }, name, config, savedAt);
}

export function renameScannerWorkspace(profile: ScannerWorkspaceProfile, workspaceId: string, name: string, updatedAt: string): ScannerWorkspaceProfile {
  const trimmedName = name.trim();
  if (!trimmedName) return profile;
  return {
    ...profile,
    workspaces: profile.workspaces.map((workspace) =>
      workspace.id === workspaceId ? { ...workspace, name: trimmedName, updatedAt } : workspace,
    ),
  };
}

export function deleteScannerWorkspace(profile: ScannerWorkspaceProfile, workspaceId: string): ScannerWorkspaceProfile {
  return {
    ...profile,
    activeWorkspaceId: profile.activeWorkspaceId === workspaceId ? null : profile.activeWorkspaceId,
    workspaces: profile.workspaces.filter((workspace) => workspace.id !== workspaceId),
  };
}

function normalizeSavedWorkspace(value: unknown, defaultConfig: ScannerWorkspaceConfig): SavedScannerWorkspace | null {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim()) {
    return null;
  }
  const createdAt = typeof value.createdAt === 'string' ? value.createdAt : '';
  const updatedAt = typeof value.updatedAt === 'string' ? value.updatedAt : createdAt;
  return {
    id: value.id,
    name: value.name.trim(),
    config: normalizeScannerWorkspaceConfig(value.config, defaultConfig),
    createdAt,
    updatedAt,
  };
}

export function normalizeScannerWorkspaceConfig(value: unknown, defaults: ScannerWorkspaceConfig): ScannerWorkspaceConfig {
  if (!isRecord(value)) return cloneScannerWorkspaceConfig(defaults);
  return {
    exchange: typeof value.exchange === 'string' && value.exchange ? value.exchange : defaults.exchange,
    universeSource: isOneOf(value.universeSource, ['active-chart', 'symbol-list', 'watchlists']) ? value.universeSource : defaults.universeSource,
    selectedWatchlistIds: normalizeNumberList(value.selectedWatchlistIds),
    selectedScannerIds: normalizeStringList(value.selectedScannerIds),
    lookbackBars:
      value.lookbackBars === null
        ? null
        : typeof value.lookbackBars === 'number'
          ? normalizePositiveInteger(value.lookbackBars, defaults.lookbackBars ?? 800, 2)
          : defaults.lookbackBars,
    maxSymbols: normalizePositiveInteger(value.maxSymbols, defaults.maxSymbols, 1),
    executionMode: isOneOf(value.executionMode, ['responsive', 'fast']) ? value.executionMode : defaults.executionMode,
    familyFilter: isOneOf(value.familyFilter, ['all', 'core', 'gap', 'reversal', 'continuation', 'neutral-bilateral'])
      ? value.familyFilter
      : defaults.familyFilter,
    directionFilter: isOneOf(value.directionFilter, ['all', 'bullish', 'bearish', 'neutral'])
      ? value.directionFilter
      : defaults.directionFilter,
    minScore: Math.min(100, normalizePositiveInteger(value.minScore, defaults.minScore, 0)),
    recentOnly: typeof value.recentOnly === 'boolean' ? value.recentOnly : defaults.recentOnly,
    activeSection: isOneOf(value.activeSection, ['run', 'results', 'alerts', 'library', 'market-movers'])
      ? value.activeSection
      : defaults.activeSection,
    resultView: isOneOf(value.resultView, ['compact', 'pattern-detail', 'values', 'debug']) ? value.resultView : defaults.resultView,
    priorityFilter: isOneOf(value.priorityFilter, ['all', 'high', 'medium', 'low']) ? value.priorityFilter : defaults.priorityFilter,
    prioritySort: isOneOf(value.prioritySort, ['category', 'high-to-low', 'low-to-high']) ? value.prioritySort : defaults.prioritySort,
  };
}

function normalizePositiveInteger(value: unknown, fallback: number, minimum: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, Math.floor(value)) : fallback;
}

function normalizeNumberList(value: unknown): number[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is number => typeof item === 'number' && Number.isInteger(item) && item > 0))]
    : [];
}

function normalizeStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))]
    : [];
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}

function uniqueWorkspaceName(baseName: string, workspaces: SavedScannerWorkspace[]): string {
  const existingNames = new Set(workspaces.map((workspace) => workspace.name.toLocaleLowerCase()));
  if (!existingNames.has(baseName.toLocaleLowerCase())) return baseName;
  let suffix = 2;
  while (existingNames.has(`${baseName} ${suffix}`.toLocaleLowerCase())) suffix += 1;
  return `${baseName} ${suffix}`;
}

function createWorkspaceId(savedAt: string, workspaces: SavedScannerWorkspace[]): string {
  const base = `scanner-${savedAt.replace(/[^0-9]/g, '') || 'workspace'}`;
  let id = base;
  let suffix = 2;
  const existingIds = new Set(workspaces.map((workspace) => workspace.id));
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
