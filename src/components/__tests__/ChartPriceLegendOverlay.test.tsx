import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setStateSpy = vi.fn();
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const internals = (
    actual as unknown as {
      __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: {
        ReactCurrentDispatcher?: { current: unknown };
      };
    }
  ).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;

  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      if (internals?.ReactCurrentDispatcher?.current) {
        return actual.useState(initial);
      }
      const value = typeof initial === 'function' ? (initial as () => T)() : initial;
      return [value, setStateSpy] as unknown as ReturnType<typeof actual.useState<T>>;
    },
    useMemo: <T,>(factory: () => T, deps: readonly unknown[]) => {
      if (internals?.ReactCurrentDispatcher?.current) {
        return actual.useMemo(factory, deps);
      }
      return factory();
    },
  };
});

import { buildChartPriceLegendSnapshot, ChartPriceLegendOverlay } from '@/components/ChartPriceLegendOverlay';
import { CustomFormulaDialog } from '@/components/CustomFormulaDialog';
import type { ChartLayout } from '@/engine/ChartEngine';
import type { OHLCBar, OverlayIndicator } from '@/engine/types';
import { DEFAULT_RENKO_SETTINGS } from '@/features/charts/chartTypeTransformService';

const globalCss = readFileSync(resolve(process.cwd(), 'src/styles/global.css'), 'utf8');
const componentSource = readFileSync(resolve(process.cwd(), 'src/components/ChartPriceLegendOverlay.tsx'), 'utf8');
const customDialogSource = readFileSync(resolve(process.cwd(), 'src/components/CustomFormulaDialog.tsx'), 'utf8');

const bars: OHLCBar[] = [
  { date: '2026-11-04', timestamp: 1, open: 255, high: 260, low: 252, close: 258, prevClose: 254, volume: 1000 },
  { date: '2026-11-05', timestamp: 2, open: 259.7, high: 264.8, low: 259.7, close: 263.5, prevClose: 258, volume: 1200 },
];

const emaOverlay: OverlayIndicator = {
  id: 'overlay-ema-1',
  kind: 'EMA',
  placement: 'overlay',
  period: 20,
  color: '#3b82f6',
  source: 'close',
};

const smaHiddenOverlay: OverlayIndicator = {
  id: 'overlay-sma-2',
  kind: 'SMA',
  placement: 'overlay',
  period: 50,
  color: '#10b981',
  source: 'close',
  visible: false,
};

type GenericElementProps = {
  children?: ReactNode;
  className?: string;
  onMouseDown?: (event: unknown) => void;
  onDoubleClick?: (event: unknown) => void;
  onClick?: (event: unknown) => void;
  'aria-label'?: string;
  title?: string;
};

function collectElements(
  node: ReactNode,
  predicate: (element: ReactElement<GenericElementProps>) => boolean,
): ReactElement<GenericElementProps>[] {
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
    if (typeof element.type === 'function') {
      const rendered = (element.type as (props: GenericElementProps) => ReactNode)(element.props);
      visit(rendered);
      return;
    }
    if (element.props.children !== undefined) {
      visit(element.props.children);
    }
  };
  visit(node);
  return results;
}

function buildProps(
  overrides: Partial<Parameters<typeof ChartPriceLegendOverlay>[0]> = {},
): Parameters<typeof ChartPriceLegendOverlay>[0] {
  return {
    instrument: { symbol: 'VEDL', exchange: 'BSE' },
    instrumentName: 'Vedanta Ltd',
    timeframe: 'D',
    chartType: 'candles',
    renkoSettings: DEFAULT_RENKO_SETTINGS,
    bars,
    viewport: { startIndex: 0, endIndex: bars.length },
    compareOverlays: [],
    overlays: [emaOverlay, smaHiddenOverlay],
    layout: {
      axisWidth: 64,
      leftAxisWidth: 0,
      chartWidth: 960,
      contentHeight: 500,
      priceHeight: 360,
      volumeHeight: 80,
      paneHeight: 60,
      paneHeights: [],
      paneTops: [],
      priceAxisGap: 0,
    } as ChartLayout,
    hoverBarIndex: null,
    onSaveIndicator: vi.fn(),
    onRemoveIndicator: vi.fn(),
    onToggleIndicatorVisibility: vi.fn(),
    secondaryLegendExpanded: true,
    ...overrides,
  };
}

afterEach(() => {
  setStateSpy.mockClear();
});

describe('ChartPriceLegendOverlay CSP-safe hover/focus actions', () => {
  it('avoids runtime <style> blocks and moves .price-legend-actions hover/:focus-visible rules into global.css', () => {
    const markup = renderToStaticMarkup(<ChartPriceLegendOverlay {...buildProps()} />);

    expect(markup).not.toContain('<style');
    expect(componentSource).not.toContain('<style');
    expect(markup).toContain('class="price-legend-item"');
    expect(markup).toContain('class="price-legend-actions"');

    expect(globalCss).toMatch(/\.price-legend-item\s+\.price-legend-actions\s*\{[^}]*opacity:\s*0;/s);
    expect(globalCss).toContain('.price-legend-item:hover .price-legend-actions');
    expect(globalCss).toContain('.price-legend-item:has(:focus-visible) .price-legend-actions');
    expect(globalCss).not.toContain('.price-legend-item:focus-within');
    expect(globalCss).toContain('.price-legend-actions button:focus-visible');
    expect(globalCss).toContain('outline-offset: -2px;');
    expect(globalCss).toContain('.price-legend-actions button:hover');
    expect(globalCss).toContain('.price-legend-actions button[data-tone="danger"]:hover');
    expect(componentSource).toMatch(/createPortal\([\s\S]*stopPortalBubble[\s\S]*settingsDialog[\s\S]*document\.body/);
    expect(componentSource).toContain('onDoubleClick={stopPortalBubble}');
    expect(markup).toContain('data-tone="danger"');

    const reducedMotionSection = globalCss.split('@media (prefers-reduced-motion: reduce)')[1] ?? '';
    expect(reducedMotionSection).toContain('.price-legend-item .price-legend-actions');
    expect(reducedMotionSection).toContain('.price-legend-actions button');
    expect(reducedMotionSection).not.toContain('!important');
  });

  it('gives CustomFormulaDialog modal semantics, Escape close, and opener focus management', () => {
    const markup = renderToStaticMarkup(
      <CustomFormulaDialog
        indicator={{
          id: 'custom-1',
          kind: 'CUSTOM',
          placement: 'overlay',
          name: 'Test Formula',
          color: '#3b82f6',
          formula: 'A = SMA(close, 5)',
        }}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
    expect(markup).toContain('aria-labelledby="custom-formula-dialog-title"');
    expect(markup).toContain('aria-label="Close"');
    expect(customDialogSource).toContain('closeButtonRef.current?.focus()');
    expect(customDialogSource).toContain('opener.focus()');
    expect(customDialogSource).toContain("event.key === 'Escape'");
    expect(customDialogSource).toContain('getModalTabWrapTarget');
  });

  it('prevents pointer mousedown focus capture and double-click bubbling on .price-legend-actions and its buttons', () => {
    const onRemoveIndicator = vi.fn();
    const onToggleIndicatorVisibility = vi.fn();

    const tree = ChartPriceLegendOverlay(
      buildProps({
        onRemoveIndicator,
        onToggleIndicatorVisibility,
      }),
    );

    const actionContainers = collectElements(
      tree,
      (el) => el.type === 'span' && el.props.className === 'price-legend-actions',
    );
    expect(actionContainers).toHaveLength(2);
    for (const container of actionContainers) {
      const downPreventDefault = vi.fn();
      const downStopPropagation = vi.fn();
      container.props.onMouseDown?.({ preventDefault: downPreventDefault, stopPropagation: downStopPropagation });
      expect(downPreventDefault).toHaveBeenCalledTimes(1);
      expect(downStopPropagation).toHaveBeenCalledTimes(1);

      const dblPreventDefault = vi.fn();
      const dblStopPropagation = vi.fn();
      container.props.onDoubleClick?.({ preventDefault: dblPreventDefault, stopPropagation: dblStopPropagation });
      expect(dblPreventDefault).toHaveBeenCalledTimes(1);
      expect(dblStopPropagation).toHaveBeenCalledTimes(1);

      const clickStopPropagation = vi.fn();
      container.props.onClick?.({ stopPropagation: clickStopPropagation });
      expect(clickStopPropagation).toHaveBeenCalledTimes(1);
    }

    const actionButtons = actionContainers.flatMap((container) =>
      collectElements(container, (el) => el.type === 'button'),
    );
    // 2 overlay items x (settings, hide/show, remove) = 6
    expect(actionButtons).toHaveLength(6);

    for (const button of actionButtons) {
      expect(button.props['aria-label']).toBeTruthy();
      expect(button.props.title).toBe(button.props['aria-label']);
      const preventDefault = vi.fn();
      const stopPropagation = vi.fn();
      button.props.onMouseDown?.({ preventDefault, stopPropagation });
      expect(preventDefault).toHaveBeenCalledTimes(1);
      expect(stopPropagation).toHaveBeenCalledTimes(1);
    }

    const settingsButton = actionButtons.find((el) => el.props['aria-label'] === 'EMA(20) settings');
    const settingsEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    settingsButton?.props.onClick?.(settingsEvent);
    expect(settingsEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(settingsEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(setStateSpy).toHaveBeenCalledWith(emaOverlay.id);

    const hideButton = actionButtons.find((el) => el.props['aria-label'] === 'Hide EMA(20)');
    const hideEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    hideButton?.props.onClick?.(hideEvent);
    expect(hideEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(hideEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(onToggleIndicatorVisibility).toHaveBeenCalledWith(emaOverlay.id, false);

    const showButton = actionButtons.find((el) => el.props['aria-label'] === 'Show SMA(50)');
    showButton?.props.onClick?.({ preventDefault: vi.fn(), stopPropagation: vi.fn() });
    expect(onToggleIndicatorVisibility).toHaveBeenCalledWith(smaHiddenOverlay.id, true);

    const removeButton = actionButtons.find((el) => el.props['aria-label'] === 'Remove EMA(20)');
    const removeEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    removeButton?.props.onClick?.(removeEvent);
    expect(removeEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(removeEvent.stopPropagation).toHaveBeenCalledTimes(1);
    expect(onRemoveIndicator).toHaveBeenCalledWith(emaOverlay.id);
  });
});

describe('audit legend readouts', () => {
  it('marks VWAP unavailable for a zero-volume series without changing the OHLCV readout', () => {
    const props = buildProps({
      bars: [{ ...bars[0], volume: 0 }],
      viewport: { startIndex: 0, endIndex: 1 },
      overlays: [{ id: 'vwap-test', kind: 'VWAP', placement: 'overlay', color: '#ffffff' }],
    });
    const snapshot = buildChartPriceLegendSnapshot(props);
    expect(snapshot.secondaryItems[0].segments).toContainEqual(expect.objectContaining({
      text: '—', tooltip: 'Volume-weighted value unavailable for this bar',
    }));
    expect(snapshot.segments.at(-2)?.text).toBe('0');
  });

  it('hides the price summary while keeping instrument and study information', () => {
    const props = buildProps({ showPriceSummary: false });
    const snapshot = buildChartPriceLegendSnapshot(props);
    expect(snapshot.title).toContain('VEDL');
    expect(snapshot.segments).toEqual([]);
    expect(snapshot.secondaryItems.length).toBeGreaterThan(0);
    const markup = renderToStaticMarkup(<ChartPriceLegendOverlay {...props} />);
    expect(markup).toContain('VEDL');
    expect(markup).not.toContain('Volume 1,200');
  });
});

describe('F-01 price legend volume', () => {
  it('shows Indian compact volume for the last visible bar in DOM and screenshot snapshot', () => {
    const props = buildProps();
    const markup = renderToStaticMarkup(<ChartPriceLegendOverlay {...props} />);
    const snapshot = buildChartPriceLegendSnapshot(props);

    expect(markup).toContain('1.2K');
    expect(markup).toContain('Volume 1,200');
    expect(snapshot.segments.slice(-3, -1)).toEqual([
      { text: 'Vol', color: 'var(--legend-muted)', muted: true },
      { text: '1.2K', color: 'var(--legend-text)', tooltip: 'Volume 1,200' },
    ]);
    expect(snapshot.segments.at(-1)?.text).toContain('+5.50');
  });

  it('tracks the hovered bar instead of retaining the latest-bar volume', () => {
    const props = buildProps({ hoverBarIndex: 0 });
    const markup = renderToStaticMarkup(<ChartPriceLegendOverlay {...props} />);
    const snapshot = buildChartPriceLegendSnapshot(props);

    expect(markup).toContain('1.0K');
    expect(snapshot.segments.at(-2)?.text).toBe('1.0K');
    expect(snapshot.segments.at(-2)?.tooltip).toBe('Volume 1,000');
  });

  it('preserves actual zero-volume bars and handles unavailable volume without fabricating a value', () => {
    const zeroProps = buildProps({ bars: [{ ...bars[0], volume: 0 }], viewport: { startIndex: 0, endIndex: 1 } });
    const invalidProps = buildProps({ bars: [{ ...bars[0], volume: Number.NaN }], viewport: { startIndex: 0, endIndex: 1 } });

    expect(buildChartPriceLegendSnapshot(zeroProps).segments.at(-2)).toMatchObject({ text: '0', tooltip: 'Volume 0' });
    expect(buildChartPriceLegendSnapshot(invalidProps).segments.at(-2)).toMatchObject({ text: '—', tooltip: 'Volume unavailable' });
    expect(renderToStaticMarkup(<ChartPriceLegendOverlay {...zeroProps} />)).toContain('Volume 0');
    expect(renderToStaticMarkup(<ChartPriceLegendOverlay {...invalidProps} />)).toContain('Volume unavailable');
  });

  it('does not invent a volume for an empty chart', () => {
    const props = buildProps({ bars: [], viewport: { startIndex: 0, endIndex: 0 } });
    expect(buildChartPriceLegendSnapshot(props).segments).toEqual([]);
  });
});
