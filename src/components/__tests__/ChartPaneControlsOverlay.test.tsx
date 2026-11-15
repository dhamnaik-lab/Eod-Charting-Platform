import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ChartPaneControlsOverlay } from '@/components/ChartPaneControlsOverlay';
import type { OverlayIndicator } from '@/engine/types';
import { getIndicatorAlertSourceUnsupportedReason } from '@/features/alerts/indicatorAlertContracts';

const globalCss = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const componentSource = readFileSync(resolve(process.cwd(), 'src/components/ChartPaneControlsOverlay.tsx'), 'utf8');

const rsiPane: OverlayIndicator = {
  id: 'pane-rsi-1',
  kind: 'RSI',
  placement: 'pane',
  period: 14,
  color: '#2563eb',
  source: 'close',
};

const macdPane: OverlayIndicator = {
  id: 'pane-macd-2',
  kind: 'MACD',
  placement: 'pane',
  fastPeriod: 12,
  slowPeriod: 26,
  signalPeriod: 9,
  color: '#059669',
  signalColor: '#d97706',
  histogramPositiveColor: '#16a34a',
  histogramNegativeColor: '#dc2626',
  source: 'low',
  visible: false,
};

type GenericElementProps = {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
  onMouseDown?: (event: unknown) => void;
  onDoubleClick?: (event: unknown) => void;
  onContextMenu?: (event: unknown) => void;
  onClick?: (event?: unknown) => void;
  'aria-label'?: string;
  title?: string;
};

function collectElements(node: ReactNode, predicate: (element: ReactElement<GenericElementProps>) => boolean): ReactElement<GenericElementProps>[] {
  const results: ReactElement<GenericElementProps>[] = [];
  const visit = (current: ReactNode) => {
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!isValidElement(current)) {
      return;
    }
    const element = current as ReactElement<GenericElementProps>;
    if (predicate(element)) {
      results.push(element);
    }
    if (element.props.children !== undefined) {
      visit(element.props.children);
    }
  };
  visit(node);
  return results;
}

function buildProps(overrides: Partial<Parameters<typeof ChartPaneControlsOverlay>[0]> = {}): Parameters<typeof ChartPaneControlsOverlay>[0] {
  return {
    paneIndicators: [rsiPane],
    layout: { paneTops: [260, 420], priceHeight: 180, volumeHeight: 80, axisWidth: 64 },
    indicatorPaneHeights: {},
    indicatorPaneHeight: 150,
    collapsedIndicatorPanes: {},
    paneScaleOverrides: {},
    paneSettingsIndicator: null,
    onStartPaneResize: vi.fn(),
    onResizePane: vi.fn(),
    onTogglePaneCollapsed: vi.fn(),
    onResetPaneScale: vi.fn(),
    onMovePane: vi.fn(),
    onOpenPaneSettings: vi.fn(),
    onCreateAlert: vi.fn(),
    onSaveIndicator: vi.fn(),
    onRemoveIndicator: vi.fn(),
    onToggleIndicatorVisibility: vi.fn(),
    onClosePaneSettings: vi.fn(),
    ...overrides,
  };
}

describe('ChartPaneControlsOverlay hover visibility, focus isolation, and contrast', () => {
  it('avoids runtime <style> blocks (Tauri CSP-safe) and places hover/:focus-visible rules in global.css (never :focus-within)', () => {
    const markup = renderToStaticMarkup(<ChartPaneControlsOverlay {...buildProps({ paneIndicators: [rsiPane, macdPane] })} />);

    expect(markup).not.toContain('<style');
    expect(componentSource).not.toContain('<style');
    expect(markup).toContain('class="pane-controls"');
    expect(markup).toContain('class="pane-resize-handle"');

    expect(globalCss).toMatch(/\.pane-controls\s*\{[^}]*opacity:\s*0;/s);
    expect(globalCss).toContain('.pane-controls:hover');
    expect(globalCss).toContain('.pane-controls:has(:focus-visible)');
    expect(globalCss).not.toContain('.pane-controls:focus-within');
    expect(globalCss).toContain('.pane-resize-handle:hover');
    expect(globalCss).toContain('.pane-resize-handle:focus-visible');

    const reducedMotionSection = globalCss.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
    expect(reducedMotionSection).toContain('.pane-controls');
    expect(reducedMotionSection).toContain('.pane-controls button');
    expect(reducedMotionSection).toContain('.pane-resize-handle');
    expect(reducedMotionSection).not.toContain('!important');
  });

  it('renders nothing when no pane indicators or settings dialog are active', () => {
    const markup = renderToStaticMarkup(<ChartPaneControlsOverlay {...buildProps({ paneIndicators: [] })} />);
    expect(markup).toBe('');
  });

  it('prevents pointer mousedown focus capture on container and every pane button while keeping click handlers working', () => {
    const onOpenPaneSettings = vi.fn();
    const onTogglePaneCollapsed = vi.fn();
    const onToggleIndicatorVisibility = vi.fn();
    const onResetPaneScale = vi.fn();
    const onMovePane = vi.fn();
    const onCreateAlert = vi.fn();
    const onRemoveIndicator = vi.fn();

    const tree = ChartPaneControlsOverlay(
      buildProps({
        paneIndicators: [rsiPane, macdPane],
        paneScaleOverrides: { [rsiPane.id]: { min: 0, max: 100 } },
        onOpenPaneSettings,
        onTogglePaneCollapsed,
        onToggleIndicatorVisibility,
        onResetPaneScale,
        onMovePane,
        onCreateAlert,
        onRemoveIndicator,
      })
    );

    const containers = collectElements(tree, (el) => el.type === 'div' && el.props.className === 'pane-controls');
    expect(containers).toHaveLength(2);
    for (const container of containers) {
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      container.props.onMouseDown?.({ preventDefault, stopPropagation });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(stopPropagation).toHaveBeenCalledTimes(1);

      const dblPreventDefault = vi.fn();
      const dblStopPropagation = vi.fn();
      container.props.onDoubleClick?.({ preventDefault: dblPreventDefault, stopPropagation: dblStopPropagation });
      expect(dblPreventDefault).toHaveBeenCalledTimes(1);
      expect(dblStopPropagation).toHaveBeenCalledTimes(1);

      const clickStopPropagation = vi.fn();
      container.props.onClick?.({ stopPropagation: clickStopPropagation });
      expect(clickStopPropagation).toHaveBeenCalledTimes(1);
    }

    const separators = collectElements(tree, (el) => el.type === 'div' && el.props.className === 'pane-resize-handle');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      const dblPreventDefault = vi.fn();
      const dblStopPropagation = vi.fn();
      separator.props.onDoubleClick?.({ preventDefault: dblPreventDefault, stopPropagation: dblStopPropagation });
      expect(dblPreventDefault).toHaveBeenCalledTimes(1);
      expect(dblStopPropagation).toHaveBeenCalledTimes(1);
    }

    const buttons = collectElements(tree, (el) => el.type === 'button');
    // Pane 1 (RSI, expanded): collapse, hide, reset, up, down, settings, alert, remove = 8
    // Pane 2 (MACD, expanded): collapse, show, reset, up, down, settings, unsupported-alert, remove = 8
    expect(buttons).toHaveLength(16);

    for (const button of buttons) {
      expect(typeof button.props.onMouseDown).toBe('function');
      expect(button.props['aria-label']).toBeTruthy();
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      button.props.onMouseDown?.({ preventDefault, stopPropagation });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(stopPropagation).toHaveBeenCalledTimes(1);
    }

    const settingsButton = buttons.find((el) => el.props['aria-label'] === 'RSI(14) settings');
    settingsButton?.props.onClick?.();
    expect(onOpenPaneSettings).toHaveBeenCalledWith(rsiPane.id);

    const fitButton = buttons.find((el) => el.props['aria-label'] === 'Fit RSI(14)');
    expect(fitButton?.props.disabled).toBe(false);
    fitButton?.props.onClick?.();
    expect(onResetPaneScale).toHaveBeenCalledWith(rsiPane.id);

    const disabledAutoFitButton = buttons.find((el) => el.props['aria-label']?.endsWith('is auto-fit'));
    expect(disabledAutoFitButton?.props.disabled).toBe(true);

    const disabledMoveUp = buttons.find((el) => el.props['aria-label'] === 'Move RSI(14) pane up');
    expect(disabledMoveUp?.props.disabled).toBe(true);
    const enabledMoveDown = buttons.find((el) => el.props['aria-label'] === 'Move RSI(14) pane down');
    expect(enabledMoveDown?.props.disabled).toBe(false);
    enabledMoveDown?.props.onClick?.();
    expect(onMovePane).toHaveBeenCalledWith(rsiPane.id, 'down');

    const macdAlertReason = getIndicatorAlertSourceUnsupportedReason(macdPane);
    const unsupportedAlertButton = buttons.find((el) => el.props.disabled && el.props['aria-label'] === macdAlertReason);
    expect(unsupportedAlertButton).toBeDefined();

    const showButton = buttons.find((el) => el.props['aria-label']?.startsWith('Show '));
    showButton?.props.onClick?.();
    expect(onToggleIndicatorVisibility).toHaveBeenCalledWith(macdPane.id, true);

    const collapseButton = buttons.find((el) => el.props['aria-label'] === 'Collapse RSI(14) pane');
    collapseButton?.props.onClick?.();
    expect(onTogglePaneCollapsed).toHaveBeenCalledWith(rsiPane.id, true);

    const removeButton = buttons.find((el) => el.props['aria-label'] === 'Remove RSI(14)');
    removeButton?.props.onClick?.();
    expect(onRemoveIndicator).toHaveBeenCalledWith(rsiPane.id);

    const contextEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    containers[0].props.onContextMenu?.(contextEvent);
    expect(onCreateAlert).toHaveBeenCalledWith(rsiPane.id);

    const macdContextEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    containers[1].props.onContextMenu?.(macdContextEvent);
    expect(macdContextEvent.preventDefault).not.toHaveBeenCalled();
  });

  it('uses opaque surface/button contrast tokens, accessible disabled states, and SVG icons instead of washed-out glyphs', () => {
    const markup = renderToStaticMarkup(
      <ChartPaneControlsOverlay
        {...buildProps({
          paneIndicators: [rsiPane, macdPane],
        })}
      />
    );

    // Solid container + high-contrast button fill/border/text rather than translucent --legend-bg wash-out
    expect(markup).toContain('background:var(--bg2)');
    expect(markup).toContain('background:var(--bg4)');
    expect(markup).toContain('border:1px solid var(--border2)');
    expect(markup).toContain('color:var(--text)');

    // Disabled buttons keep full contrast opacity:1 in global.css instead of 0.55 wash-out, and hover guards against :disabled
    expect(globalCss).toContain('.pane-controls button:disabled');
    expect(globalCss).toContain('opacity: 1 !important;');
    expect(globalCss).toContain('color: var(--text-mute) !important;');
    expect(globalCss).toContain('.pane-controls button:not(:disabled):hover');
    expect(globalCss).toContain('.pane-controls button[data-tone="danger"]:not(:disabled):hover');
    expect(globalCss).toContain('.pane-controls button:not(:disabled):active');

    // No translucent legend fill or inline outline:none suppressing focus-visible ring
    expect(markup).not.toContain('var(--legend-bg)');
    expect(markup).not.toContain('outline:none');
    expect(markup).not.toContain('opacity:0.4');
    expect(markup).not.toContain('👁');

    // Crisp decorative SVGs with aria-hidden and remove button danger styling preserved
    expect(markup).toContain('<svg ');
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-tone="danger"');
    expect(markup).toContain('color:var(--red-text)');
  });

  it('keeps collapsed panes compact with Expand, visibility, and Remove actions', () => {
    const markup = renderToStaticMarkup(
      <ChartPaneControlsOverlay
        {...buildProps({
          collapsedIndicatorPanes: { [rsiPane.id]: true },
        })}
      />
    );

    expect(markup).toContain('aria-label="Expand RSI(14) pane"');
    expect(markup).toContain('aria-label="Hide RSI(14)"');
    expect(markup).toContain('aria-label="Remove RSI(14)"');
    expect(markup).not.toContain('aria-label="RSI(14) settings"');
    expect(markup).not.toContain('role="separator"');
  });
});
