import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { shouldHandleChartViewportShortcut } from '../chartKeyboardFocusService';

function keyEvent(target: EventTarget | null, currentTarget: EventTarget | null, defaultPrevented = false) {
  return { target, currentTarget, defaultPrevented };
}

describe('focused chart viewport shortcut routing', () => {
  it('accepts an unhandled keyboard event originating on the chart viewport', () => {
    const viewport = new EventTarget();
    expect(shouldHandleChartViewportShortcut(keyEvent(viewport, viewport))).toBe(true);
  });

  it('ignores a focused button, dialog, or input outside the chart', () => {
    const viewport = new EventTarget();
    const button = new EventTarget();
    const dialog = new EventTarget();
    const input = new EventTarget();

    for (const control of [button, dialog, input]) {
      expect(shouldHandleChartViewportShortcut(keyEvent(control, viewport))).toBe(false);
    }
  });

  it('ignores key events bubbling from a chart child control', () => {
    const viewport = new EventTarget();
    const childControl = new EventTarget();
    expect(shouldHandleChartViewportShortcut(keyEvent(childControl, viewport))).toBe(false);
  });

  it('ignores another chart viewport and previously handled events', () => {
    const viewport = new EventTarget();
    const otherChartViewport = new EventTarget();
    expect(shouldHandleChartViewportShortcut(keyEvent(otherChartViewport, viewport))).toBe(false);
    expect(shouldHandleChartViewportShortcut(keyEvent(viewport, viewport, true))).toBe(false);
    expect(shouldHandleChartViewportShortcut(keyEvent(viewport, null))).toBe(false);
    expect(shouldHandleChartViewportShortcut(keyEvent(null, viewport))).toBe(false);
  });

  it('keeps shortcuts local to the focusable chart viewport and excludes the inactive tab', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/components/ChartCanvas.tsx'), 'utf8');
    expect(source).toContain('tabIndex={0}');
    expect(source).toContain('onKeyDown={handleChartKeyDown}');
    expect(source).toContain('chartViewportRef.current?.focus()');
    expect(source).toContain('shouldHandleChartViewportShortcut(event)');
    expect(source).toContain('tabId !== null && tabId !== activeChartTabId');
    expect(source).not.toContain("window.addEventListener('keydown', onGlobalKeyDown)");
  });
});
