import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');

describe('native context menus in editable fields', () => {
  it('allows native context menus for input, textarea, select and contenteditable controls', () => {
    const start = root.indexOf('const suppressContextMenu');
    const end = root.indexOf('const handleGlobalKeyDown', start);
    const handler = root.slice(start, end);

    expect(handler).toContain('target instanceof HTMLElement');
    expect(handler).toContain('target.isContentEditable');
    expect(handler).toContain('input, textarea, select, [contenteditable="true"]');
    expect(handler.indexOf('return;')).toBeGreaterThan(handler.indexOf('target.isContentEditable'));
    expect(handler.indexOf('event.preventDefault()')).toBeGreaterThan(handler.indexOf('return;'));
  });

  it('preserves the global listener for noneditable regions and its cleanup', () => {
    expect(root).toContain("window.addEventListener('contextmenu', suppressContextMenu)");
    expect(root).toContain("window.removeEventListener('contextmenu', suppressContextMenu)");
  });

  it('preserves the chart-owned custom right-click menu', () => {
    const chart = readFileSync(resolve(process.cwd(), 'src/components/ChartCanvas.tsx'), 'utf8');
    expect(chart).toContain('onContextMenu={(event) => {');
    expect(chart).toContain('event.preventDefault();');
  });
});
