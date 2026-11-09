import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import paletteData from '../themePalettes.json';
import {
  APP_THEME_IDS,
  APP_THEME_SELECT_OPTIONS,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME_ID,
  SYSTEM_PREFERS_DARK_THEME,
  SYSTEM_PREFERS_LIGHT_THEME,
  SYSTEM_THEME_ID,
  applyAppTheme,
  getChartTheme,
  normalizeAppThemeSelection,
  readPersistedAppTheme,
  resolveAppTheme,
  type AppThemeId,
} from '../themeService';

const CSS = readFileSync(
  resolve(process.cwd(), 'src/styles/theme-tokens.generated.css'),
  'utf8',
);
const BOOT_SCRIPT = readFileSync(resolve(process.cwd(), 'public/theme-boot.js'), 'utf8');

const DEFAULT_SELECTOR = ':root';
const selectorFor = (themeId: AppThemeId) =>
  themeId === DEFAULT_APP_THEME_ID ? DEFAULT_SELECTOR : `[data-theme="${themeId}"]`;

function themeBlock(themeId: AppThemeId): string {
  const selector = selectorFor(themeId);
  const start = CSS.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing theme selector: ${selector}`);
  const end = CSS.indexOf('\n}', start);
  if (end < 0) throw new Error(`Unclosed theme selector: ${selector}`);
  return CSS.slice(start, end);
}

function themeTokens(themeId: AppThemeId): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of themeBlock(themeId).matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)) {
    tokens[match[1]] = match[2].trim();
  }
  return tokens;
}

function toRgb(value: string): [number, number, number] {
  const hex = value.trim().replace(/^#/, '');
  const expanded = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Expected a hex colour token, received: ${value}`);
  }
  return [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16)) as [
    number,
    number,
    number,
  ];
}

const luminance = (rgb: [number, number, number]) => {
  const channels = rgb.map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

function contrastRatio(foreground: string, background: string): number {
  const first = luminance(toRgb(foreground));
  const second = luminance(toRgb(background));
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const PANEL_BACKGROUNDS = ['--bg', '--bg2', '--bg3', '--bg4'] as const;
const TEXT_TOKENS = [
  '--text',
  '--text-dim',
  '--text-mute',
  '--legend-muted',
  '--green-text',
  '--red-text',
  '--accent-text',
] as const;

const REQUIRED_THEME_TOKENS = [
  '--bg',
  '--bg2',
  '--bg3',
  '--bg4',
  '--border',
  '--border2',
  '--text',
  '--text-dim',
  '--text-mute',
  '--green',
  '--red',
  '--green-text',
  '--red-text',
  '--accent',
  '--accent-strong',
  '--accent-text',
  '--accent-contrast',
  '--focus-ring',
  '--control-bg',
  '--control-bg-hover',
  '--legend-bg',
  '--chart-bg',
  '--shadow-lg',
  '--overlay-bg',
] as const;

describe('theme token coverage', () => {
  it.each(APP_THEME_IDS)('defines every shared theme token for %s', (themeId) => {
    const tokens = themeTokens(themeId);
    const missing = REQUIRED_THEME_TOKENS.filter((token) => !tokens[token]);
    expect(missing, `${themeId} is missing theme tokens`).toEqual([]);
  });

  it.each(APP_THEME_IDS)('keeps the pre-paint chart background aligned for %s', (themeId) => {
    expect(getChartTheme(themeId).background).toBe(themeTokens(themeId)['--chart-bg']);
  });

  it('exposes every palette theme in the settings selector', () => {
    const selectable = APP_THEME_SELECT_OPTIONS.map(({ id }) => id);
    expect(selectable).toEqual([SYSTEM_THEME_ID, ...APP_THEME_IDS]);
    expect(new Set(selectable).size).toBe(selectable.length);
  });
});

describe('theme text contrast across panel backgrounds', () => {
  for (const themeId of APP_THEME_IDS) {
    it(`keeps text and semantic colours readable in ${themeId}`, () => {
      const tokens = themeTokens(themeId);
      for (const foreground of TEXT_TOKENS) {
        for (const background of PANEL_BACKGROUNDS) {
          const ratio = contrastRatio(tokens[foreground], tokens[background]);
          expect(
            ratio,
            `${themeId}: ${foreground} on ${background}`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`keeps the keyboard focus ring distinguishable in ${themeId}`, () => {
      const tokens = themeTokens(themeId);
      for (const background of PANEL_BACKGROUNDS) {
        const ratio = contrastRatio(tokens['--focus-ring'], tokens[background]);
        expect(ratio, `${themeId}: --focus-ring on ${background}`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`keeps filled accent labels readable in ${themeId}`, () => {
      const tokens = themeTokens(themeId);
      const ratio = contrastRatio(tokens['--accent-contrast'], tokens['--accent']);
      expect(ratio, `${themeId}: --accent-contrast on --accent`).toBeGreaterThanOrEqual(4.5);
    });

    it(`keeps chart text and candle marks visible in ${themeId}`, () => {
      const theme = getChartTheme(themeId);
      expect(contrastRatio(theme.axisText, theme.background)).toBeGreaterThanOrEqual(4.5);
      for (const token of ['crosshair', 'candleUp', 'candleDown', 'wickUp', 'wickDown'] as const) {
        const ratio = contrastRatio(theme[token], theme.background);
        expect(ratio, `${themeId}: ${token} on chart background`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});

describe('pre-paint theme bootstrap', () => {
  it('recognises exactly the palette theme ids exposed by the renderer', () => {
    const knownBlock = /var known = \[([\s\S]*?)\];/.exec(BOOT_SCRIPT);
    expect(knownBlock, 'theme-boot.js must declare a known theme id list').not.toBeNull();
    const bootIds = [...(knownBlock?.[1] ?? '').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
    expect(bootIds).toEqual([...APP_THEME_IDS]);
  });

  it('resolves the system selection with the same map as the palette source', () => {
    expect(BOOT_SCRIPT).toContain('stored === \'system\'');
    expect(BOOT_SCRIPT).toContain(`'${SYSTEM_PREFERS_DARK_THEME}'`);
    expect(BOOT_SCRIPT).toContain(`'${SYSTEM_PREFERS_LIGHT_THEME}'`);
  });

  it('reuses the renderer storage key so both sides cannot drift', () => {
    expect(BOOT_SCRIPT).toContain(`'${APP_THEME_STORAGE_KEY}'`);
  });
});

describe('theme selection resolution', () => {
  it('maps the system selection to the documented palettes', () => {
    expect(resolveAppTheme(SYSTEM_THEME_ID, true)).toBe(SYSTEM_PREFERS_DARK_THEME);
    expect(resolveAppTheme(SYSTEM_THEME_ID, false)).toBe(SYSTEM_PREFERS_LIGHT_THEME);
    expect(resolveAppTheme('deep-light', true)).toBe('deep-light');
    expect(normalizeAppThemeSelection('system')).toBe(SYSTEM_THEME_ID);
    expect(normalizeAppThemeSelection('not-a-theme')).toBe(DEFAULT_APP_THEME_ID);
    expect(normalizeAppThemeSelection('dark')).toBe(DEFAULT_APP_THEME_ID);
  });

  it('keeps the palette map aligned between the data file and the service', () => {
    expect(paletteData.systemThemeMap.dark).toBe(SYSTEM_PREFERS_DARK_THEME);
    expect(paletteData.systemThemeMap.light).toBe(SYSTEM_PREFERS_LIGHT_THEME);
  });
});

describe('theme persistence and chart colour resolution', () => {
  const storage = new Map<string, string>();
  const dataset: Record<string, string> = {};

  beforeAll(() => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
    };
    (globalThis as unknown as { document: unknown }).document = {
      documentElement: { dataset },
    };
  });

  afterAll(() => {
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { document?: unknown }).document;
  });

  it('applies and mirrors the normalised theme selection', () => {
    applyAppTheme('deep-light');
    expect(dataset.theme).toBe('deep-light');
    expect(storage.get(APP_THEME_STORAGE_KEY)).toBe('deep-light');
    expect(readPersistedAppTheme()).toBe('deep-light');

    applyAppTheme('dark' as AppThemeId);
    expect(dataset.theme).toBe(DEFAULT_APP_THEME_ID);
    expect(readPersistedAppTheme()).toBe(DEFAULT_APP_THEME_ID);
  });

  it('persists the system selection but applies a concrete palette', () => {
    applyAppTheme(SYSTEM_THEME_ID);
    expect(storage.get(APP_THEME_STORAGE_KEY)).toBe(SYSTEM_THEME_ID);
    expect(readPersistedAppTheme()).toBe(SYSTEM_THEME_ID);
    expect(dataset.theme).toBe(SYSTEM_PREFERS_DARK_THEME);
  });

  it('ignores an unknown persisted theme id', () => {
    storage.set(APP_THEME_STORAGE_KEY, 'not-a-theme');
    expect(readPersistedAppTheme()).toBe(DEFAULT_APP_THEME_ID);
  });

  it('lets the curated theme palette win over legacy default chart colours', () => {
    const curated = getChartTheme('classic-light');
    const legacyProfile = getChartTheme('classic-light', {
      candleUp: '#26a69a',
      candleDown: '#ef5350',
      gridLine: '#1e2a3a',
      crosshair: '#5588aa',
    });
    expect(legacyProfile).toEqual(curated);
    expect(legacyProfile.candleUp).toBe('#059669');
    expect(legacyProfile.candleDown).toBe('#dc2626');
  });

  it('ignores stored colours entirely when the profile says not customised', () => {
    const resolved = getChartTheme(
      'deep-light',
      { candleUp: '#123456', candleDown: '#654321', crosshair: '#abcdef' },
      false,
    );
    expect(resolved).toEqual(getChartTheme('deep-light'));
  });

  it('honours explicit customisation, including legacy default values', () => {
    const resolved = getChartTheme(
      'classic-light',
      { candleUp: '#26a69a', candleDown: '#ef5350' },
      true,
    );
    expect(resolved.candleUp).toBe('#26a69a');
    expect(resolved.candleDown).toBe('#ef5350');
  });

  it('still honours genuinely custom chart colours without an explicit flag', () => {
    const custom = getChartTheme('midnight-slate-pro', {
      candleUp: '#12ab34',
      candleDown: '#ab1234',
      crosshair: '#f0c34e',
    });
    expect(custom.candleUp).toBe('#12ab34');
    expect(custom.candleDown).toBe('#ab1234');
    expect(custom.crosshair).toBe('#f0c34e');
    expect(custom.wickUp).toBe('#12ab34');
    expect(custom.wickDown).toBe('#ab1234');
    expect(custom.volumeUp).toBe('rgba(18, 171, 52, 0.24)');
  });

  it('returns a copy so callers cannot mutate shared theme data', () => {
    const first = getChartTheme('midnight-slate-pro');
    first.background = '#ff00ff';
    expect(getChartTheme('midnight-slate-pro').background).toBe('#071019');
  });
});
