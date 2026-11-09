import type { ChartTheme } from '@/engine/types';
import paletteData from './themePalettes.json';

export const DEFAULT_APP_THEME_ID = paletteData.defaultThemeId as AppThemeId;

export const APP_THEME_IDS = Object.keys(paletteData.themes) as AppThemeId[];

export type AppThemeId = keyof typeof paletteData.themes;

/** Selectable pseudo-theme that follows the operating-system colour scheme. */
export const SYSTEM_THEME_ID = 'system' as const;

export type AppThemeSelectionId = AppThemeId | typeof SYSTEM_THEME_ID;

export interface AppThemeOption {
  id: AppThemeId;
  label: string;
}

export const APP_THEME_OPTIONS: AppThemeOption[] = APP_THEME_IDS.map((id) => ({
  id,
  label: paletteData.themes[id].label,
}));

export interface AppThemeSelectionOption {
  id: AppThemeSelectionId;
  label: string;
}

/** Options shown in the settings selector, including the system-following entry. */
export const APP_THEME_SELECT_OPTIONS: AppThemeSelectionOption[] = [
  { id: SYSTEM_THEME_ID, label: 'System (follow OS)' },
  ...APP_THEME_OPTIONS,
];

export const SYSTEM_PREFERS_DARK_THEME = paletteData.systemThemeMap.dark as AppThemeId;
export const SYSTEM_PREFERS_LIGHT_THEME = paletteData.systemThemeMap.light as AppThemeId;

/**
 * Mirrors the last applied theme so the first paint can use it before the
 * application profile settings finish loading. Keep in sync with the inline
 * bootstrap in `public/theme-boot.js`.
 */
export const APP_THEME_STORAGE_KEY = 'eod.appTheme';

export function normalizeAppThemeId(value: string | null | undefined): AppThemeId {
  if (value === 'dark') {
    return DEFAULT_APP_THEME_ID;
  }
  return APP_THEME_IDS.includes(value as AppThemeId)
    ? (value as AppThemeId)
    : DEFAULT_APP_THEME_ID;
}

export function normalizeAppThemeSelection(value: string | null | undefined): AppThemeSelectionId {
  if (value === SYSTEM_THEME_ID) {
    return SYSTEM_THEME_ID;
  }
  return normalizeAppThemeId(value);
}

export function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveAppTheme(
  selection: AppThemeSelectionId,
  prefersDark: boolean = prefersDarkColorScheme(),
): AppThemeId {
  if (selection === SYSTEM_THEME_ID) {
    return prefersDark ? SYSTEM_PREFERS_DARK_THEME : SYSTEM_PREFERS_LIGHT_THEME;
  }
  return normalizeAppThemeId(selection);
}

function persistAppTheme(selection: AppThemeSelectionId): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(APP_THEME_STORAGE_KEY, selection);
    }
  } catch {
    // Persistence is best-effort; a blocked storage backend must not break theming.
  }
}

export function readPersistedAppTheme(): AppThemeSelectionId | null {
  try {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    const stored = localStorage.getItem(APP_THEME_STORAGE_KEY);
    return stored ? normalizeAppThemeSelection(stored) : null;
  } catch {
    return null;
  }
}

export function applyAppTheme(selection: AppThemeSelectionId): void {
  const normalized = normalizeAppThemeSelection(selection);
  persistAppTheme(normalized);
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = resolveAppTheme(normalized);
}

function hexToRgba(hex: string, alpha: number): string | null {
  const clean = hex.trim().replace(/^#/, '');
  // parseInt accepts valid prefixes (e.g. "aG" as 10), so reject malformed hex first.
  if (!/^(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(clean)) return null;
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }
  return null;
}

/**
 * Chart colours written by older builds into the application profile. They were
 * stored as if the user had chosen them, so every theme received the dark-era
 * palette. Treating these exact values as "not customized" lets the curated
 * per-theme chart palette win while still honouring real user choices.
 *
 * Only used while a profile has no explicit `chartColorsCustomized` flag.
 */
const LEGACY_DEFAULT_CHART_COLORS = {
  candleUp: ['#26a69a'],
  candleDown: ['#ef5350'],
  gridLine: ['#1e2a3a', 'rgba(78, 101, 128, 0.18)'],
  crosshair: ['#5588aa', '#60a5fa'],
} as const;

function pickUserChartColor(
  value: unknown,
  legacyDefaults: readonly string[],
): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }
  return legacyDefaults.includes(value) ? undefined : value;
}

const LEGACY_OR_UNSET: readonly string[] = [];

/**
 * Resolves the chart palette for a theme.
 *
 * @param customized `false` ignores stored colours entirely (theme palette wins),
 *   `true` applies them as the user's explicit choice, and `null`/`undefined`
 *   falls back to legacy-default detection for profiles written before the flag
 *   existed.
 */
export function getChartTheme(
  themeId: AppThemeId,
  customColors?: Partial<ChartTheme>,
  customized: boolean | null = null,
): ChartTheme {
  const base = CHART_THEMES[themeId] ?? CHART_THEMES[DEFAULT_APP_THEME_ID];
  if (!customColors || customized === false) {
    // Never hand out the shared palette object: callers must not mutate theme data.
    return { ...base };
  }
  const filteredCustom = Object.fromEntries(
    Object.entries(customColors).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );

  const legacy = customized === true;
  const candleUp = pickUserChartColor(
    filteredCustom.candleUp,
    legacy ? LEGACY_OR_UNSET : LEGACY_DEFAULT_CHART_COLORS.candleUp,
  );
  const candleDown = pickUserChartColor(
    filteredCustom.candleDown,
    legacy ? LEGACY_OR_UNSET : LEGACY_DEFAULT_CHART_COLORS.candleDown,
  );
  const gridLine =
    pickUserChartColor(
      filteredCustom.gridLine,
      legacy ? LEGACY_OR_UNSET : LEGACY_DEFAULT_CHART_COLORS.gridLine,
    ) ?? base.gridLine;
  const crosshair =
    pickUserChartColor(
      filteredCustom.crosshair,
      legacy ? LEGACY_OR_UNSET : LEGACY_DEFAULT_CHART_COLORS.crosshair,
    ) ?? base.crosshair;
  const customWickUp = pickUserChartColor(filteredCustom.wickUp, LEGACY_OR_UNSET);
  const customWickDown = pickUserChartColor(filteredCustom.wickDown, LEGACY_OR_UNSET);
  const customVolumeUp = pickUserChartColor(filteredCustom.volumeUp, LEGACY_OR_UNSET);
  const customVolumeDown = pickUserChartColor(filteredCustom.volumeDown, LEGACY_OR_UNSET);

  return {
    ...base,
    ...filteredCustom,
    candleUp: candleUp ?? base.candleUp,
    candleDown: candleDown ?? base.candleDown,
    gridLine,
    crosshair,
    wickUp: customWickUp ?? candleUp ?? base.wickUp,
    wickDown: customWickDown ?? candleDown ?? base.wickDown,
    volumeUp: customVolumeUp ?? (candleUp ? hexToRgba(candleUp, 0.24) : null) ?? base.volumeUp,
    volumeDown:
      customVolumeDown ?? (candleDown ? hexToRgba(candleDown, 0.24) : null) ?? base.volumeDown,
  };
}

const CHART_THEMES = Object.fromEntries(
  APP_THEME_IDS.map((id) => [id, paletteData.themes[id].chart as ChartTheme]),
) as Record<AppThemeId, ChartTheme>;
