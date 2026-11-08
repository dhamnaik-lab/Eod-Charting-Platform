import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shouldHandleChartViewportShortcut } from '../chartKeyboardFocusService';
import { chartTimeframeForShortcut } from '../chartTimeframeShortcutService';

describe('B16 chart-focused D/W/M/Q/Y shortcut rules', () => {
  it('maps every supported shortcut, including lowercase, to its existing timeframe', () => {
    for (const timeframe of ['D', 'W', 'M', 'Q', 'Y'] as const) {
      expect(chartTimeframeForShortcut(timeframe)).toBe(timeframe);
      expect(chartTimeframeForShortcut(timeframe.toLowerCase())).toBe(timeframe);
    }
  });

  it('leaves unrelated native/dialog/palette and existing drawing/navigation keys unmapped', () => {
    for (const key of ['s', 'k', 'x', 'h', 'v', 'l', 'c', '/', 'Escape', 'ArrowUp', 'ArrowDown', 'Delete', '0', 'F1', '']) {
      expect(chartTimeframeForShortcut(key)).toBeNull();
    }
  });

  it('requires the active focused viewport, and rejects bubbled child keys and handled events', () => {
    const viewport = new EventTarget();
    const input = new EventTarget();
    const dialog = new EventTarget();
    expect(shouldHandleChartViewportShortcut({ target: viewport, currentTarget: viewport, defaultPrevented: false })).toBe(true);
    for (const target of [input, dialog]) {
      expect(shouldHandleChartViewportShortcut({ target, currentTarget: viewport, defaultPrevented: false })).toBe(false);
    }
    expect(shouldHandleChartViewportShortcut({ target: viewport, currentTarget: viewport, defaultPrevented: true })).toBe(false);
    expect(shouldHandleChartViewportShortcut({ target: viewport, currentTarget: null, defaultPrevented: false })).toBe(false);
  });

  it('removes the window-wide timeframe interception, retaining native context-menu handling', () => {
    const root = readFileSync('src/RootApp.tsx', 'utf8');
    expect(root).not.toContain('handleGlobalKeyDown');
    expect(root).not.toContain("window.addEventListener('keydown'");
    expect(root).toContain("window.addEventListener('contextmenu', suppressContextMenu)");
  });

  it('uses the existing chart keyboard guard and active-tab check before setting timeframe', () => {
    const chart = readFileSync('src/components/ChartCanvas.tsx', 'utf8');
    const start = chart.indexOf('const handleChartKeyDown = useCallback(');
    const end = chart.indexOf('    ],\n  );', start);
    const handler = chart.slice(start, end);
    expect(start).toBeGreaterThan(0);
    expect(handler).toContain('tabId !== null && tabId !== activeChartTabId');
    expect(handler).toContain('shouldHandleChartViewportShortcut(event)');
    expect(handler).toContain('!event.metaKey && !event.ctrlKey && !event.altKey');
    expect(handler).toContain('chartTimeframeForShortcut(event.key)');
    expect(handler).toContain('setTimeframe(requestedTimeframe)');
    expect(handler).toContain('event.preventDefault()');
    expect(handler.indexOf('shouldHandleChartViewportShortcut(event)'))
      .toBeLessThan(handler.indexOf('setTimeframe(requestedTimeframe)'));
    expect(handler).toContain('togglePrimaryDrawingTool');
    expect(handler).toContain('navigateSymbol');
    expect(handler).toContain('zoomViewportByFactor');
  });

  it('keeps help text in chart section and documents focus/field/modal restrictions', () => {
    const help = readFileSync('src/components/KeyboardShortcutsDialog.tsx', 'utf8');
    const chart = help.slice(help.indexOf('const CHART_SHORTCUTS'), help.indexOf('const COMMAND_PALETTE_SHORTCUTS'));
    expect(chart).toContain("keys: 'D / W / M / Q / Y'");
    expect(chart).toContain('Daily / Weekly / Monthly / Quarterly / Yearly timeframe');
    expect(chart).toContain('Requires chart focus; does not apply while editing or in dialogs.');
    expect(chart).toContain('Requires chart focus.');
    expect(help.slice(help.indexOf('const WORKSPACE_SHORTCUTS'), help.indexOf('const CHART_SHORTCUTS')))
      .not.toContain('D / W / M / Q / Y');
  });
});
