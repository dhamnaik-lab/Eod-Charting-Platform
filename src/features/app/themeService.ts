import type { ChartTheme } from '@/engine/types';

export const APP_THEME_IDS = [
  'midnight-slate-pro',
  'amoled-black',
  'classic-light',
  'classic-light-refined',
  'deep-light',
  'refinitiv-dark',
  'tos-charcoal',
] as const;

export type AppThemeId = (typeof APP_THEME_IDS)[number];

export interface AppThemeOption {
  id: AppThemeId;
  label: string;
}

export const DEFAULT_APP_THEME_ID: AppThemeId = 'midnight-slate-pro';

export const APP_THEME_OPTIONS: AppThemeOption[] = [
  { id: 'midnight-slate-pro', label: 'Midnight Slate Pro' },
  { id: 'amoled-black', label: 'AMOLED Black' },
  { id: 'classic-light', label: 'Classic Light' },
  { id: 'classic-light-refined', label: 'Classic Light Refined' },
  { id: 'deep-light', label: 'Deep Light' },
  { id: 'refinitiv-dark', label: 'Eikon Dark Pro' },
  { id: 'tos-charcoal', label: 'Charcoal Pro' },
];

export function normalizeAppThemeId(value: string | null | undefined): AppThemeId {
  if (value === 'dark') {
    return DEFAULT_APP_THEME_ID;
  }
  return APP_THEME_IDS.includes(value as AppThemeId)
    ? (value as AppThemeId)
    : DEFAULT_APP_THEME_ID;
}

export function applyAppTheme(themeId: AppThemeId): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.dataset.theme = themeId;
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

export function getChartTheme(themeId: AppThemeId, customColors?: Partial<ChartTheme>): ChartTheme {
  const base = CHART_THEMES[themeId] ?? CHART_THEMES[DEFAULT_APP_THEME_ID];
  if (!customColors) {
    return base;
  }
  const filteredCustom = Object.fromEntries(
    Object.entries(customColors).filter(([_, v]) => v !== undefined && v !== null && v !== ''),
  );

  const candleUp = filteredCustom.candleUp as string | undefined;
  const candleDown = filteredCustom.candleDown as string | undefined;

  const customGrid = filteredCustom.gridLine as string | undefined;
  const isDefaultDarkGrid =
    customGrid === '#1e2a3a' ||
    customGrid === 'rgba(78, 101, 128, 0.18)';
  const gridLine = customGrid && !isDefaultDarkGrid ? customGrid : base.gridLine;

  const customCrosshair = filteredCustom.crosshair as string | undefined;
  const isDefaultDarkCrosshair =
    customCrosshair === '#5588aa' ||
    customCrosshair === '#60a5fa';
  const crosshair = customCrosshair && !isDefaultDarkCrosshair ? customCrosshair : base.crosshair;

  return {
    ...base,
    ...filteredCustom,
    gridLine,
    crosshair,
    wickUp: (filteredCustom.wickUp as string | undefined) ?? candleUp ?? base.wickUp,
    wickDown: (filteredCustom.wickDown as string | undefined) ?? candleDown ?? base.wickDown,
    volumeUp:
      (filteredCustom.volumeUp as string | undefined) ??
      (candleUp ? hexToRgba(candleUp, 0.24) : null) ??
      base.volumeUp,
    volumeDown:
      (filteredCustom.volumeDown as string | undefined) ??
      (candleDown ? hexToRgba(candleDown, 0.24) : null) ??
      base.volumeDown,
  };
}

const CHART_THEMES: Record<AppThemeId, ChartTheme> = {
  'midnight-slate-pro': {
    background: '#071019',
    axisBackground: '#0d1722',
    axisLabelBackground: '#1d4f8f',
    panelBorder: 'rgba(124, 148, 176, 0.22)',
    gridLine: 'rgba(78, 101, 128, 0.18)',
    gridLineMajor: 'rgba(116, 143, 174, 0.28)',
    axisText: '#9fb0c3',
    crosshair: '#60a5fa',
    candleUp: '#22c55e',
    candleDown: '#ef4444',
    wickUp: '#4ade80',
    wickDown: '#f87171',
    volumeUp: 'rgba(34, 197, 94, 0.24)',
    volumeDown: 'rgba(239, 68, 68, 0.24)',
    borderColor: '#223247',
    backgroundBottom: '#040a12',
    sessionHighlight: 'rgba(255, 255, 255, 0.018)',
  },
  'amoled-black': {
    background: '#000000',
    axisBackground: '#050505',
    axisLabelBackground: '#164e63',
    panelBorder: 'rgba(148, 163, 184, 0.2)',
    gridLine: 'rgba(71, 85, 105, 0.16)',
    gridLineMajor: 'rgba(100, 116, 139, 0.26)',
    axisText: '#94a3b8',
    crosshair: '#38bdf8',
    candleUp: '#20c997',
    candleDown: '#ff4d4f',
    wickUp: '#4ade80',
    wickDown: '#fb7185',
    volumeUp: 'rgba(32, 201, 151, 0.22)',
    volumeDown: 'rgba(255, 77, 79, 0.22)',
    borderColor: '#1f2937',
    backgroundBottom: '#000000',
    sessionHighlight: 'rgba(255, 255, 255, 0.012)',
  },
  'classic-light': {
    background: '#ffffff',
    axisBackground: '#f3f4f6',
    axisLabelBackground: '#2563eb',
    panelBorder: 'rgba(75, 85, 99, 0.22)',
    gridLine: 'rgba(203, 213, 225, 0.35)',
    gridLineMajor: 'rgba(148, 163, 184, 0.45)',
    axisText: '#475569',
    crosshair: '#2563eb',
    candleUp: '#059669',
    candleDown: '#dc2626',
    wickUp: '#047857',
    wickDown: '#b91c1c',
    volumeUp: 'rgba(5, 150, 105, 0.2)',
    volumeDown: 'rgba(220, 38, 38, 0.2)',
    borderColor: '#e5e7eb',
    backgroundBottom: '#f9fafb',
    sessionHighlight: 'rgba(15, 23, 42, 0.025)',
  },
  'classic-light-refined': {
    background: '#ffffff',
    axisBackground: '#f3f4f6',
    axisLabelBackground: '#2563eb',
    panelBorder: 'rgba(75, 85, 99, 0.22)',
    gridLine: 'rgba(203, 213, 225, 0.35)',
    gridLineMajor: 'rgba(148, 163, 184, 0.45)',
    axisText: '#475569',
    crosshair: '#2563eb',
    candleUp: '#059669',
    candleDown: '#dc2626',
    wickUp: '#047857',
    wickDown: '#b91c1c',
    volumeUp: 'rgba(5, 150, 105, 0.2)',
    volumeDown: 'rgba(220, 38, 38, 0.2)',
    borderColor: '#e5e7eb',
    backgroundBottom: '#f9fafb',
    sessionHighlight: 'rgba(15, 23, 42, 0.025)',
  },
  'deep-light': {
    background: '#f8fafc',
    axisBackground: '#f1f5f9',
    axisLabelBackground: '#1d4ed8',
    panelBorder: 'rgba(100, 116, 139, 0.22)',
    gridLine: 'rgba(203, 213, 225, 0.4)',
    gridLineMajor: 'rgba(148, 163, 184, 0.5)',
    axisText: '#334155',
    crosshair: '#1d4ed8',
    candleUp: '#047857',
    candleDown: '#b91c1c',
    wickUp: '#047857',
    wickDown: '#b91c1c',
    volumeUp: 'rgba(4, 120, 87, 0.35)',
    volumeDown: 'rgba(185, 28, 28, 0.35)',
    borderColor: '#cbd5e1',
    backgroundBottom: '#f1f5f9',
    sessionHighlight: 'rgba(15, 23, 42, 0.03)',
  },
  'refinitiv-dark': {
    background: '#080e18',
    axisBackground: '#0f172a',
    axisLabelBackground: '#0284c7',
    panelBorder: 'rgba(56, 189, 248, 0.2)',
    gridLine: 'rgba(148, 163, 184, 0.14)',
    gridLineMajor: 'rgba(148, 163, 184, 0.25)',
    axisText: '#94a3b8',
    crosshair: '#0284c7',
    candleUp: '#10b981',
    candleDown: '#f43f5e',
    wickUp: '#34d399',
    wickDown: '#fb7185',
    volumeUp: 'rgba(16, 185, 129, 0.25)',
    volumeDown: 'rgba(244, 63, 94, 0.25)',
    borderColor: '#1e293b',
    backgroundBottom: '#04070d',
    sessionHighlight: 'rgba(56, 189, 248, 0.02)',
  },
  'tos-charcoal': {
    background: '#181a1f',
    axisBackground: '#21252b',
    axisLabelBackground: '#61afef',
    panelBorder: 'rgba(171, 178, 191, 0.2)',
    gridLine: 'rgba(171, 178, 191, 0.12)',
    gridLineMajor: 'rgba(171, 178, 191, 0.22)',
    axisText: '#abb2bf',
    crosshair: '#61afef',
    candleUp: '#26a69a',
    candleDown: '#ef5350',
    wickUp: '#4db6ac',
    wickDown: '#e57373',
    volumeUp: 'rgba(38, 166, 154, 0.25)',
    volumeDown: 'rgba(239, 83, 80, 0.25)',
    borderColor: '#333842',
    backgroundBottom: '#14161a',
    sessionHighlight: 'rgba(97, 175, 239, 0.02)',
  },
};