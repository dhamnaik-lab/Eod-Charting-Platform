import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activateSheetTabOnKeyDown, SheetTabs } from '@/components/SheetTabs';

const store = vi.hoisted(() => ({
  chartTabs: [{
    id: 'tab-b15',
    activeSheetId: 'sheet-1',
    sheets: [
      { id: 'sheet-1', name: 'Sheet 1' },
      { id: 'sheet-2', name: 'Analysis Sheet' },
    ],
  }],
  activateChartTab: vi.fn(),
  loadSheet: vi.fn(),
  deleteSheet: vi.fn(),
  renameSheet: vi.fn(),
  saveCurrentAsSheet: vi.fn(),
}));

vi.mock('@/store/chartStore', () => ({
  useChartStore: (selector: (value: typeof store) => unknown) => selector(store),
}));

function markup(): string {
  return renderToStaticMarkup(createElement(SheetTabs, { tabId: 'tab-b15' }));
}

function keyboard(key: string, nested = false) {
  const currentTarget = {} as EventTarget;
  const event = {
    key,
    currentTarget,
    target: nested ? ({} as EventTarget) : currentTarget,
    preventDefault: vi.fn(),
  };
  const activate = vi.fn();
  activateSheetTabOnKeyDown(event, activate);
  return { event, activate };
}

afterEach(() => {
  store.chartTabs[0].activeSheetId = 'sheet-1';
  vi.clearAllMocks();
});

describe('B15: sheet-tab keyboard accessibility', () => {
  it('renders each sheet as a focusable named button with correct selected state', () => {
    const html = markup();
    expect(html).toContain('class="sheet-tab-activation"');
    expect(html).toContain('role="button"');
    expect((html.match(/tabindex="0"/g) ?? [])).toHaveLength(2);
    expect(html).toMatch(/aria-label="Load sheet Sheet 1" aria-pressed="true"/);
    expect(html).toMatch(/aria-label="Load sheet Analysis Sheet" aria-pressed="false"/);
    store.chartTabs[0].activeSheetId = 'sheet-2';
    const switched = markup();
    expect(switched).toMatch(/aria-label="Load sheet Sheet 1" aria-pressed="false"/);
    expect(switched).toMatch(/aria-label="Load sheet Analysis Sheet" aria-pressed="true"/);
  });

  it.each(['Enter', ' '])('activates once and prevents scrolling on %s', (key) => {
    const { event, activate } = keyboard(key);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(activate).toHaveBeenCalledOnce();
  });

  it.each(['Escape', 'Tab', 'ArrowLeft', 'x'])('ignores nonactivation key %s', (key) => {
    const { event, activate } = keyboard(key);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it.each(['Enter', ' '])('ignores bubbled %s from nested Delete button', (key) => {
    const { event, activate } = keyboard(key, true);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(activate).not.toHaveBeenCalled();
  });

  it('retains separate deletion, creation and double-click rename affordances', () => {
    const html = markup();
    expect((html.match(/title="Delete sheet"/g) ?? [])).toHaveLength(2);
    expect(html).toContain('title="Create new plain candle sheet"');
    expect(html).toContain('Double-click to rename');
    expect(html).toContain('Click or press Enter/Space to load');
    expect(html).toContain('Analysis Sheet');
  });

  it('exposes a keyboard-visible focus ring without changing pointer layout', () => {
    const css = readFileSync('src/styles/global.css', 'utf8');
    expect(css).toMatch(/\.sheet-tab-activation:focus-visible\s*\{/);
    expect(css).toMatch(/\.sheet-tab-activation:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--focus-ring, var\(--accent\)\)/s);
    expect(markup()).toContain('class="sheet-tab-activation"');
  });
});
