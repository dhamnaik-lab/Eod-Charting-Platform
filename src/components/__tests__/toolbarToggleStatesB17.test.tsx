import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Toolbar } from '@/components/Toolbar';
import { ChartToolDock } from '@/components/ChartToolDock';
import { createBlankChartTab } from '@/features/charts/chartTabWorkspaceService';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import type { OverlayIndicator } from '@/engine/types';

const initialChart = useChartStore.getState();
const initialUi = useUiStore.getState();

function buttonForText(html: string, text: string): string {
  const match = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].find(
    (value) => value[0].replace(/<[^>]*>/g, '').trim().startsWith(text),
  );
  expect(match, `Missing toolbar button ${text}`).toBeDefined();
  return match![0].slice(0, match![0].indexOf('>') + 1);
}

function buttonForLabel(html: string, label: string): string {
  const match = [...html.matchAll(/<button\b[^>]*>/g)].find(
    (value) => value[0].includes(`aria-label="${label}"`),
  );
  expect(match, `Missing button with label ${label}`).toBeDefined();
  return match![0];
}

function renderToolbar() {
  return renderToStaticMarkup(createElement(Toolbar));
}

beforeEach(() => {
  const tab = createBlankChartTab(1);
  useChartStore.setState({
    chartTabs: [tab], activeChartTabId: tab.id, adjustedMode: false,
  });
  useUiStore.setState({
    signalRules: [], signalSettingsDialogOpen: false,
    magnetEnabled: false, favoriteToolbarVisible: false,
    activeDrawingTool: null,
  });
});

afterEach(() => {
  useChartStore.setState({
    chartTabs: initialChart.chartTabs,
    activeChartTabId: initialChart.activeChartTabId,
    adjustedMode: initialChart.adjustedMode,
  });
  useUiStore.setState({
    signalRules: initialUi.signalRules,
    signalSettingsDialogOpen: initialUi.signalSettingsDialogOpen,
    magnetEnabled: initialUi.magnetEnabled,
    favoriteToolbarVisible: initialUi.favoriteToolbarVisible,
    activeDrawingTool: initialUi.activeDrawingTool,
  });
});

describe('B17: accurate toolbar and drawing-dock toggle semantics', () => {
  it('reports Volume and Adj true/false based on current requested chart state', () => {
    const original = renderToolbar();
    expect(buttonForText(original, 'Volume')).toContain('aria-pressed="true"');
    expect(buttonForText(original, 'Adj')).toContain('aria-pressed="false"');

    const tab = useChartStore.getState().chartTabs[0];
    useChartStore.setState({
      chartTabs: [{ ...tab, showVolume: false }],
      adjustedMode: true,
    });
    const changed = renderToolbar();
    expect(buttonForText(changed, 'Volume')).toContain('aria-pressed="false"');
    expect(buttonForText(changed, 'Adj')).toContain('aria-pressed="true"');
    expect(changed).toContain('>Adj</button>');
    expect(changed).not.toContain('>TRI</button>');
  });

  it('reports Candles as pressed only when a PATTERN indicator is present', () => {
    expect(buttonForText(renderToolbar(), 'Candles')).toContain('aria-pressed="false"');
    const tab = useChartStore.getState().chartTabs[0];
    const pattern: OverlayIndicator = {
      id: 'b17-pattern', kind: 'PATTERN', placement: 'overlay', patterns: [],
    };
    useChartStore.setState({ chartTabs: [{ ...tab, indicators: [pattern] }] });
    expect(buttonForText(renderToolbar(), 'Candles')).toContain('aria-pressed="true"');
  });

  it('uses dialog expansion rather than falsely claiming Signals is an on/off toggle', () => {
    const closed = buttonForText(renderToolbar(), 'Signals');
    expect(closed).toContain('aria-haspopup="dialog"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('aria-pressed=');

    useUiStore.setState({ signalSettingsDialogOpen: true });
    const opened = buttonForText(renderToolbar(), 'Signals');
    expect(opened).toContain('aria-expanded="true"');
    expect(opened).not.toContain('aria-pressed=');
  });

  it('distinguishes screenshot menu expansion from persistent selection', () => {
    const button = buttonForLabel(renderToolbar(), 'Take chart screenshot');
    expect(button).toContain('aria-expanded="false"');
    expect(button).not.toContain('aria-pressed=');
  });

  it('reports chart-pattern scanner as a toggle without changing visible text', () => {
    const html = renderToolbar();
    expect(buttonForText(html, 'Chart Patterns')).toContain('aria-pressed="false"');
    expect(html).toContain('>Chart Patterns</button>');
  });

  it('preserves dock toggle states but removes pressed semantics from one-shot actions', () => {
    const html = renderToStaticMarkup(createElement(ChartToolDock));
    expect(buttonForLabel(html, 'Magnet: OFF')).toContain('aria-pressed="false"');
    expect(buttonForLabel(html, 'Show Favorites Toolbar')).toContain('aria-pressed="false"');
    for (const action of ['Undo last drawing', 'Clear all drawings', 'Reset indicator pane heights']) {
      expect(buttonForLabel(html, action)).not.toContain('aria-pressed=');
    }

    useUiStore.setState({ magnetEnabled: true, favoriteToolbarVisible: true });
    const enabled = renderToStaticMarkup(createElement(ChartToolDock));
    expect(buttonForLabel(enabled, 'Magnet: ON - snaps drawing points to candle high/low'))
      .toContain('aria-pressed="true"');
    expect(buttonForLabel(enabled, 'Hide Favorites Toolbar')).toContain('aria-pressed="true"');
  });

  it('keeps menu and drawing-tool affordances keyboard-readable without redesign', () => {
    const html = renderToStaticMarkup(createElement(ChartToolDock));
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Collapse tool dock"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('Choose');
  });
});
