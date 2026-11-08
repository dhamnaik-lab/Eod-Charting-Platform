import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Toolbar } from '@/components/Toolbar';
import { ChartToolDock } from '@/components/ChartToolDock';

const fixtures = vi.hoisted(() => ({
  chart: {
    chartTabs: [{
      id: 'b17-chart',
      instrument: null as { exchange: string; symbol: string } | null,
      layoutMode: 'single',
      chartType: 'candles',
      showVolume: true,
      indicators: [] as Array<{ id: string; kind: string; placement: string; patterns?: string[] }>,
      drawings: [] as Array<{ id: string; locked?: boolean }>,
      rawBars: [],
      displayBars: [],
      selectedDrawingId: null as string | null,
    }],
    activeChartTabId: 'b17-chart',
    adjustedMode: false,
  },
  ui: {
    signalRules: [] as unknown[],
    signalSettingsDialogOpen: false,
    scannerChartOverlay: null as { instrument: { exchange: string; symbol: string } } | null,
    scannerPatternMap: null,
    screenshotMenuOpen: false,
    favoriteDrawingTools: [] as string[],
    favoriteToolbarVisible: false,
    magnetEnabled: false,
    activeDrawingTool: undefined as string | undefined,
    customFormulaDialogOpen: false,
    compareDialogOpen: false,
  },
}));

vi.mock('@/store/chartStore', () => ({
  useChartStore: (selector: (state: typeof fixtures.chart) => unknown) => selector(fixtures.chart),
  getActiveChartTab: (tabs: typeof fixtures.chart.chartTabs, id: string) =>
    tabs.find((tab) => tab.id === id) ?? tabs[0] ?? null,
}));
vi.mock('@/store/uiStore', () => ({
  useUiStore: (selector: (state: typeof fixtures.ui) => unknown) => selector(fixtures.ui),
}));
vi.mock('@/components/ChartHeader', () => ({ ChartHeader: () => null }));

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

function toolbar() {
  return renderToStaticMarkup(createElement(Toolbar));
}
function dock() {
  return renderToStaticMarkup(createElement(ChartToolDock));
}

beforeEach(() => {
  Object.assign(fixtures.chart, {
    activeChartTabId: 'b17-chart',
    adjustedMode: false,
  });
  Object.assign(fixtures.chart.chartTabs[0], {
    instrument: null, chartType: 'candles', showVolume: true, indicators: [],
    drawings: [], selectedDrawingId: null,
  });
  Object.assign(fixtures.ui, {
    signalRules: [], signalSettingsDialogOpen: false, scannerChartOverlay: null,
    scannerPatternMap: null, favoriteDrawingTools: [],
    magnetEnabled: false, favoriteToolbarVisible: false,
    activeDrawingTool: undefined,
    compareDialogOpen: false, customFormulaDialogOpen: false,
  });
});

describe('B17: accurate toolbar and drawing-dock toggle semantics', () => {
  it('reports Volume and Adj based on requested chart state while keeping visible text', () => {
    expect(buttonForText(toolbar(), 'Volume')).toContain('aria-pressed="true"');
    expect(buttonForText(toolbar(), 'Adj')).toContain('aria-pressed="false"');

    fixtures.chart.chartTabs[0].showVolume = false;
    fixtures.chart.adjustedMode = true;
    const html = toolbar();
    expect(buttonForText(html, 'Volume')).toContain('aria-pressed="false"');
    expect(buttonForText(html, 'Adj')).toContain('aria-pressed="true"');
    expect(html).toContain('>Adj</button>');
    expect(html).not.toContain('>TRI</button>');
  });

  it('reports Candles pressed exactly when PATTERN indicator is present', () => {
    expect(buttonForText(toolbar(), 'Candles')).toContain('aria-pressed="false"');
    fixtures.chart.chartTabs[0].indicators = [{
      id: 'b17-pattern', kind: 'PATTERN', placement: 'overlay', patterns: [],
    }];
    expect(buttonForText(toolbar(), 'Candles')).toContain('aria-pressed="true"');
  });

  it('reports Signals dialog expansion rather than pretending it toggles a signal rule', () => {
    const closed = buttonForText(toolbar(), 'Signals');
    expect(closed).toContain('aria-haspopup="dialog"');
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('aria-pressed=');

    fixtures.ui.signalSettingsDialogOpen = true;
    const open = buttonForText(toolbar(), 'Signals');
    expect(open).toContain('aria-expanded="true"');
    expect(open).not.toContain('aria-pressed=');
  });

  it('uses menu expansion and not pressed semantics on the screenshot menu button', () => {
    const button = buttonForLabel(toolbar(), 'Take chart screenshot');
    expect(button).toContain('aria-expanded="false"');
    expect(button).not.toContain('aria-pressed=');
  });

  it('reports chart-pattern scanner state from the active instrument/overlay', () => {
    expect(buttonForText(toolbar(), 'Chart Patterns')).toContain('aria-pressed="false"');
    const instrument = { exchange: 'NSE', symbol: 'B17' };
    fixtures.chart.chartTabs[0].instrument = instrument;
    fixtures.ui.scannerChartOverlay = { instrument };
    expect(buttonForText(toolbar(), 'Chart Patterns')).toContain('aria-pressed="true"');
  });

  it('retains true dock toggles but removes pressed state from one-shot commands', () => {
    const html = dock();
    expect(buttonForLabel(html, 'Magnet: OFF')).toContain('aria-pressed="false"');
    expect(buttonForLabel(html, 'Show Favorites Toolbar')).toContain('aria-pressed="false"');
    for (const command of ['Undo last drawing', 'Clear all drawings', 'Reset indicator pane heights']) {
      expect(buttonForLabel(html, command)).not.toContain('aria-pressed=');
    }

    fixtures.ui.magnetEnabled = true;
    fixtures.ui.favoriteToolbarVisible = true;
    const enabled = dock();
    expect(buttonForLabel(enabled, 'Magnet: ON - snaps drawing points to candle high/low'))
      .toContain('aria-pressed="true"');
    expect(buttonForLabel(enabled, 'Hide Favorites Toolbar')).toContain('aria-pressed="true"');
  });

  it('keeps dock collapse and tool-selection affordances keyboard readable', () => {
    const html = dock();
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Collapse tool dock"');
    expect(html).toContain('aria-pressed="false"');
  });
});
