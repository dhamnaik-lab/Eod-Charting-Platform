import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OHLCBar } from '@/engine/types';
import type { ChartPatternEvaluationExecutor } from '@/features/chartPatterns/workerClient';
import type {
  ToolbarChartPatternEvaluationInput,
  ToolbarChartPatternEvaluationOutput,
} from '@/features/chartPatterns/evaluation';
import type { ScannerResult } from '@/plugins/scanner/types';

type HookSlot =
  | { kind: 'state'; value: unknown }
  | { kind: 'ref'; current: unknown }
  | { kind: 'effect'; deps: readonly unknown[] | undefined; cleanup?: (() => void) | void };

const harness = vi.hoisted(() => {
  const state: {
    slots: HookSlot[];
    cursor: number;
    pendingEffects: Array<{ index: number; effect: () => void | (() => void); deps: readonly unknown[] | undefined }>;
    dirty: boolean;
    mounted: boolean;
    chart: any;
    ui: any;
    desktopApi: { getEodData: ReturnType<typeof vi.fn> };
    executors: Array<{
      evaluate: ReturnType<typeof vi.fn>;
      evaluateToolbar: ReturnType<typeof vi.fn>;
      cancel: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    }>;
    evaluateToolbarImpl: ((input: ToolbarChartPatternEvaluationInput) => Promise<ToolbarChartPatternEvaluationOutput>) | null;
  } = {
    slots: [],
    cursor: 0,
    pendingEffects: [],
    dirty: false,
    mounted: false,
    chart: null,
    ui: null,
    desktopApi: { getEodData: vi.fn() },
    executors: [],
    evaluateToolbarImpl: null,
  };
  return state;
});

function depsEqual(prev: readonly unknown[] | undefined, next: readonly unknown[] | undefined): boolean {
  if (!prev || !next || prev.length !== next.length) return false;
  return prev.every((value, index) => Object.is(value, next[index]));
}

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const index = harness.cursor++;
      if (index >= harness.slots.length) {
        const value = typeof initial === 'function' ? (initial as () => T)() : initial;
        harness.slots.push({ kind: 'state', value });
      }
      const slot = harness.slots[index] as Extract<HookSlot, { kind: 'state' }>;
      const setState = (next: T | ((prev: T) => T)) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(slot.value as T) : next;
        if (!Object.is(slot.value, resolved)) {
          slot.value = resolved;
          harness.dirty = true;
        }
      };
      return [slot.value as T, setState] as const;
    },
    useRef: <T,>(initial: T) => {
      const index = harness.cursor++;
      if (index >= harness.slots.length) {
        harness.slots.push({ kind: 'ref', current: initial });
      }
      return harness.slots[index] as { current: T };
    },
    useEffect: (effect: () => void | (() => void), deps?: readonly unknown[]) => {
      const index = harness.cursor++;
      if (index >= harness.slots.length) {
        harness.slots.push({ kind: 'effect', deps: undefined, cleanup: undefined });
        harness.pendingEffects.push({ index, effect, deps });
        return;
      }
      const slot = harness.slots[index] as Extract<HookSlot, { kind: 'effect' }>;
      if (!depsEqual(slot.deps, deps)) {
        harness.pendingEffects.push({ index, effect, deps });
      }
    },
  };
});

vi.mock('@/platform', () => ({
  getDesktopApi: () => harness.desktopApi,
}));

vi.mock('@/store/chartStore', () => {
  const hook = (selector: (state: typeof harness.chart) => unknown) => selector(harness.chart);
  hook.getState = () => harness.chart;
  return {
    useChartStore: hook,
    getActiveChartTab: (tabs: Array<{ id: string }>, id: string) =>
      tabs.find((tab) => tab.id === id) ?? tabs[0] ?? null,
  };
});

vi.mock('@/store/uiStore', () => ({
  useUiStore: (selector: (state: typeof harness.ui) => unknown) => selector(harness.ui),
}));

vi.mock('@/components/ChartHeader', () => ({ ChartHeader: () => null }));
vi.mock('@/components/CustomFormulaDialog', () => ({ CustomFormulaDialog: () => null }));
vi.mock('@/components/CompareOverlayDialog', () => ({ CompareOverlayDialog: () => null }));

vi.mock('@/features/chartPatterns/workerClient', () => ({
  createChartPatternEvaluationExecutor: (): ChartPatternEvaluationExecutor => {
    const executor = {
      evaluate: vi.fn(),
      evaluateToolbar: vi.fn((input: ToolbarChartPatternEvaluationInput) =>
        harness.evaluateToolbarImpl
          ? harness.evaluateToolbarImpl(input)
          : Promise.resolve({ results: [], cancelled: false }),
      ),
      cancel: vi.fn(),
      dispose: vi.fn(),
    };
    harness.executors.push(executor);
    return executor;
  },
}));

import { Toolbar } from '@/components/Toolbar';

function makeHeadAndShouldersBars(symbol = 'ABC'): OHLCBar[] {
  const ranges = [
    ...Array.from({ length: 4 }, () => [85, 87, 83, 85]),
    [88, 92, 86, 90], [90, 96, 88, 94], [94, 104, 92, 101], [101, 110, 99, 106],
    [105, 108, 96, 98], [98, 103, 92, 95], [96, 112, 95, 110], [110, 124, 108, 120],
    [118, 121, 104, 106], [106, 111, 94, 96], [98, 108, 96, 106], [106, 112, 102, 108],
    [104, 108, 98, 100], [100, 104, 96, 98], [98, 101, 93, 95], [94, 98, 89, 91],
  ];
  return ranges.map(([open, high, low, close], index) => ({
    date: `2028-06-${String(index + 1).padStart(2, '0')}`,
    timestamp: Date.UTC(2028, 5, index + 1),
    open,
    high,
    low,
    close,
    volume: 100_000,
  }));
}

function makeMatchedResult(symbol = 'ABC', scannerName = 'Head and Shoulders'): ScannerResult {
  return {
    symbol,
    exchange: 'NSE',
    scannerId: 'chart_head_shoulders',
    scannerName,
    categoryId: 'chart_reversal',
    categoryName: 'Reversal Chart Patterns',
    date: '2028-06-20',
    matched: true,
    direction: 'bearish',
    score: 85,
    generatedAt: '2028-06-20T00:00:00.000Z',
    history: {
      firstMatchedDate: '2028-06-05',
      lastMatchedDate: '2028-06-20',
      matchCount: 1,
    },
    chartPattern: {
      family: 'reversal',
      confidence: 85,
      patternEndDate: '2028-06-20',
      geometry: {
        family: 'head-and-shoulders',
        pivotMarkers: [{ id: 'head', kind: 'high', label: 'H', date: '2028-06-12', price: 124 }],
      },
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function flattenText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return flattenText(node.props.children);
  return '';
}

function findElement(
  node: ReactNode,
  predicate: (el: ReactElement<Record<string, any>>) => boolean,
): ReactElement<Record<string, any>> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<Record<string, any>>(node)) return null;
  if (predicate(node)) return node;
  if (typeof node.type === 'function') {
    const rendered = (node.type as (props: Record<string, any>) => ReactNode)(node.props);
    const found = findElement(rendered, predicate);
    if (found) return found;
  }
  if (node.props.children !== undefined) {
    return findElement(node.props.children, predicate);
  }
  return null;
}

function renderToolbar(): ReactNode {
  harness.mounted = true;
  let tree: ReactNode = null;
  let iterations = 0;
  do {
    harness.dirty = false;
    harness.cursor = 0;
    harness.pendingEffects = [];
    tree = Toolbar();
    const pending = harness.pendingEffects.splice(0);
    for (const item of pending) {
      const slot = harness.slots[item.index] as Extract<HookSlot, { kind: 'effect' }>;
      slot.cleanup?.();
      slot.deps = item.deps;
      slot.cleanup = item.effect();
    }
    iterations += 1;
    if (iterations > 10) throw new Error('Infinite render loop in Toolbar harness');
  } while (harness.dirty);
  return tree;
}

function unmountToolbar() {
  if (!harness.mounted) return;
  for (const slot of harness.slots) {
    if (slot.kind === 'effect') {
      slot.cleanup?.();
      slot.cleanup = undefined;
    }
  }
  harness.slots = [];
  harness.pendingEffects = [];
  harness.mounted = false;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('CHIP-01: Toolbar chart-pattern chip, Scan Now, cancellation, and cleanup', () => {
  beforeEach(() => {
    harness.slots = [];
    harness.cursor = 0;
    harness.pendingEffects = [];
    harness.dirty = false;
    harness.mounted = false;
    harness.executors = [];
    harness.evaluateToolbarImpl = null;

    const bars = makeHeadAndShouldersBars('ABC');
    const addToast = vi.fn();
    const tab = {
      id: 'tab-1',
      instrument: { exchange: 'NSE', symbol: 'ABC' },
      requestedInstrument: { exchange: 'NSE', symbol: 'ABC' },
      layoutMode: 'single',
      chartType: 'candles',
      showVolume: true,
      indicators: [],
      drawings: [],
      rawBars: bars,
      displayBars: bars,
      timeframe: 'D',
      loadedAdjusted: true,
      loadedDividendAdjusted: true,
      loadedRightsAdjusted: true,
    };

    harness.chart = {
      chartTabs: [tab],
      activeChartTabId: 'tab-1',
      snapshot: { activeDatabasePath: 'DB_A' },
      isDatabaseTransitioning: false,
      adjustedMode: true,
      addIndicatorCatalog: vi.fn(),
      addCustomFormulaIndicator: vi.fn(),
      addCompareOverlay: vi.fn(),
      removeCompareOverlay: vi.fn(),
      removeIndicator: vi.fn(),
      setShowVolume: vi.fn(),
      setChartType: vi.fn(),
      setAdjustedMode: vi.fn(),
      addToast,
      updateIndicator: vi.fn(),
      scrollToViewportStart: vi.fn(),
    };

    const showScannerChartOverlay = vi.fn((overlay) => {
      harness.ui.scannerChartOverlay = overlay;
    });
    const clearScannerChartOverlay = vi.fn(() => {
      harness.ui.scannerChartOverlay = null;
    });
    const showScannerPatternMap = vi.fn((entries) => {
      harness.ui.scannerPatternMap = { entries, selectedEntryId: null, showVisibleGeometry: false };
    });
    const clearScannerPatternMap = vi.fn(() => {
      harness.ui.scannerPatternMap = null;
    });

    harness.ui = {
      compareDialogOpen: false,
      closeCompareDialog: vi.fn(),
      customFormulaDialogOpen: false,
      closeCustomFormulaDialog: vi.fn(),
      requestChartScreenshot: vi.fn(),
      showScannerChartOverlay,
      clearScannerChartOverlay,
      showScannerPatternMap,
      clearScannerPatternMap,
      setScannerPatternMapVisibleGeometry: vi.fn(),
      openAlertManager: vi.fn(),
      openSignalSettingsDialog: vi.fn(),
      openIndicatorPicker: vi.fn(),
      setCommandPaletteOpen: vi.fn(),
      signalRules: [],
      signalSettingsDialogOpen: false,
      scannerChartOverlay: null,
      scannerPatternMap: null,
    };

    harness.desktopApi.getEodData = vi.fn(async ({ symbol }: { symbol: string }) => ({
      instrument: { exchange: 'NSE', symbol },
      bars: harness.chart.chartTabs[0].rawBars,
      adjusted: true,
      includeDividendAdjustments: true,
      includeRightsAdjustments: true,
      events: [],
    }));
  });

  afterEach(() => {
    unmountToolbar();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('toggles chart patterns ON via worker executor, shows loading state, and toggles OFF without spawning a worker', async () => {
    const pendingEval = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => pendingEval.promise;

    let tree = renderToolbar();
    expect(harness.executors).toHaveLength(0);
    const chip = findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!;
    expect(chip.props['aria-pressed']).toBe(false);
    expect(chip.props.disabled).toBe(false);

    chip.props.onClick();
    await flushMicrotasks();
    tree = renderToolbar();
    const loadingChip = findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scanning...')!;
    expect(loadingChip.props.disabled).toBe(true);
    expect(harness.executors).toHaveLength(1);

    pendingEval.resolve({ results: [makeMatchedResult('ABC')], cancelled: false });
    await flushMicrotasks();
    tree = renderToolbar();

    expect(harness.ui.showScannerChartOverlay).toHaveBeenCalledOnce();
    const activeChip = findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!;
    expect(activeChip.props['aria-pressed']).toBe(true);
    expect(activeChip.props.disabled).toBe(false);

    // Toggle OFF
    activeChip.props.onClick();
    await flushMicrotasks();
    tree = renderToolbar();
    expect(harness.ui.clearScannerChartOverlay).toHaveBeenCalledOnce();
    expect(harness.ui.clearScannerPatternMap).toHaveBeenCalledOnce();
    expect(harness.executors[0]!.evaluateToolbar).toHaveBeenCalledOnce();
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props['aria-pressed']).toBe(false);
  });

  it('fixes the Scan Now stale-closure defect when chart patterns are already active', async () => {
    harness.ui.scannerChartOverlay = {
      id: 'existing',
      instrument: { exchange: 'NSE', symbol: 'ABC' },
      date: '2028-06-20',
      scannerName: 'Old Pattern',
      scannerId: 'chart_double_bottom',
      timeframe: 'D',
      levels: [],
    };
    const rescanDeferred = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => rescanDeferred.promise;

    let tree = renderToolbar();
    const settingsButton = findElement(tree, (el) => el.type === 'button' && el.props['aria-label'] === 'Configure toolbar chart patterns')!;
    settingsButton.props.onClick();
    tree = renderToolbar();

    const scanNowButton = findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scan Active Chart')!;
    expect(scanNowButton).not.toBeNull();
    scanNowButton.props.onClick();
    await flushMicrotasks();

    // Old overlay cleared immediately; scan MUST NOT bail out with "Chart patterns removed from chart."
    expect(harness.ui.clearScannerChartOverlay).toHaveBeenCalledOnce();
    expect(harness.ui.clearScannerPatternMap).toHaveBeenCalledOnce();
    expect(harness.chart.addToast).not.toHaveBeenCalledWith('Chart patterns removed from chart.', 'info', 'Scanner');
    expect(harness.executors).toHaveLength(1);
    expect(harness.executors[0]!.evaluateToolbar).toHaveBeenCalledOnce();

    rescanDeferred.resolve({ results: [makeMatchedResult('ABC', 'Head and Shoulders')], cancelled: false });
    await flushMicrotasks();
    tree = renderToolbar();

    expect(harness.ui.showScannerChartOverlay).toHaveBeenCalledOnce();
    expect(harness.ui.showScannerChartOverlay.mock.calls[0][0].scannerName).toBe('Head and Shoulders');
  });

  it('cancels in-flight worker evaluation and discards stale results when switching symbol or timeframe', async () => {
    const staleEval = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => staleEval.promise;

    let tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();
    tree = renderToolbar();
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scanning...')).not.toBeNull();

    // Switch symbol to XYZ while ABC worker scan is still running
    const nextBars = makeHeadAndShouldersBars('XYZ');
    harness.chart.chartTabs[0] = {
      ...harness.chart.chartTabs[0],
      instrument: { exchange: 'NSE', symbol: 'XYZ' },
      requestedInstrument: { exchange: 'NSE', symbol: 'XYZ' },
      rawBars: nextBars,
      displayBars: nextBars,
    };
    tree = renderToolbar();
    expect(harness.executors[0]!.cancel).toHaveBeenCalled();
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.disabled).toBe(false);

    // Even if the stale promise resolves without cancelled: true, it is ignored
    staleEval.resolve({ results: [makeMatchedResult('ABC')], cancelled: false });
    await flushMicrotasks();
    expect(harness.ui.showScannerChartOverlay).not.toHaveBeenCalled();

    // Switch timeframe while a new scan is loading history
    const slowHistory = deferred<any>();
    harness.desktopApi.getEodData = vi.fn(() => slowHistory.promise);
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();
    harness.chart.chartTabs[0] = { ...harness.chart.chartTabs[0], timeframe: 'W' };
    tree = renderToolbar();
    slowHistory.resolve({
      instrument: { exchange: 'NSE', symbol: 'XYZ' },
      bars: nextBars,
      adjusted: true,
      includeDividendAdjustments: true,
      includeRightsAdjustments: true,
      events: [],
    });
    await flushMicrotasks();
    expect(harness.executors[0]!.evaluateToolbar).toHaveBeenCalledTimes(1); // never launched worker for stale D request
  });

  it('supersedes rapid Scan Now requests so stale scan #1 cannot clear loading or overwrite scan #2', async () => {
    const firstEval = deferred<ToolbarChartPatternEvaluationOutput>();
    const secondEval = deferred<ToolbarChartPatternEvaluationOutput>();
    let callCount = 0;
    harness.evaluateToolbarImpl = () => {
      callCount += 1;
      return callCount === 1 ? firstEval.promise : secondEval.promise;
    };

    let tree = renderToolbar();
    // Trigger scan #1 via settings Scan Active Chart
    findElement(tree, (el) => el.type === 'button' && el.props['aria-label'] === 'Configure toolbar chart patterns')!.props.onClick();
    tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scan Active Chart')!.props.onClick();
    await flushMicrotasks();
    tree = renderToolbar();
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scanning...')).not.toBeNull();

    // Rapidly reopen settings and trigger scan #2 while scan #1 is still in worker
    findElement(tree, (el) => el.type === 'button' && el.props['aria-label'] === 'Configure toolbar chart patterns')!.props.onClick();
    tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scan Active Chart')!.props.onClick();
    await flushMicrotasks();

    expect(harness.executors[0]!.cancel).toHaveBeenCalled();

    // Resolve scan #1 late with stale match
    firstEval.resolve({ results: [makeMatchedResult('ABC', 'Stale Scan 1')], cancelled: false });
    await flushMicrotasks();
    tree = renderToolbar();
    expect(harness.ui.showScannerChartOverlay).not.toHaveBeenCalled();
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scanning...')).not.toBeNull();

    // Resolve scan #2
    secondEval.resolve({ results: [makeMatchedResult('ABC', 'Fresh Scan 2')], cancelled: false });
    await flushMicrotasks();
    tree = renderToolbar();
    expect(harness.ui.showScannerChartOverlay).toHaveBeenCalledOnce();
    expect(harness.ui.showScannerChartOverlay.mock.calls[0][0].scannerName).toBe('Fresh Scan 2');
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.disabled).toBe(false);
  });

  it('disposes the worker executor on unmount and never spawns a zombie worker after unmount', async () => {
    const pendingEval = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => pendingEval.promise;

    let tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();
    expect(harness.executors).toHaveLength(1);

    unmountToolbar();
    expect(harness.executors[0]!.dispose).toHaveBeenCalledOnce();

    pendingEval.resolve({ results: [makeMatchedResult('ABC')], cancelled: false });
    await flushMicrotasks();
    expect(harness.ui.showScannerChartOverlay).not.toHaveBeenCalled();

    // Also verify unmount during pending loadCompleteChartHistory never creates an executor
    const slowHistory = deferred<any>();
    harness.desktopApi.getEodData = vi.fn(() => slowHistory.promise);
    tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();
    unmountToolbar();
    slowHistory.resolve({
      instrument: { exchange: 'NSE', symbol: 'ABC' },
      bars: harness.chart.chartTabs[0].rawBars,
      adjusted: true,
      includeDividendAdjustments: true,
      includeRightsAdjustments: true,
      events: [],
    });
    await flushMicrotasks();
    expect(harness.executors).toHaveLength(1); // no second executor created
  });

  it('discards stale worker results when store state changes mid-evaluation before React re-renders', async () => {
    const pendingEval = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => pendingEval.promise;

    let tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();

    // Mutate Zustand store directly (e.g. database transition) before React re-renders
    harness.chart.isDatabaseTransitioning = true;
    pendingEval.resolve({ results: [makeMatchedResult('ABC')], cancelled: false });
    await flushMicrotasks();

    expect(harness.ui.showScannerChartOverlay).not.toHaveBeenCalled();
    expect(harness.chart.addToast).toHaveBeenCalledWith(
      'The chart changed while scanning. Run Chart Patterns again.',
      'warning',
      'Scanner',
    );
  });

  it('recovers from worker errors and ignores late rejections from superseded scans', async () => {
    const firstEval = deferred<ToolbarChartPatternEvaluationOutput>();
    const secondEval = deferred<ToolbarChartPatternEvaluationOutput>();
    let callCount = 0;
    harness.evaluateToolbarImpl = () => {
      callCount += 1;
      return callCount === 1 ? firstEval.promise : secondEval.promise;
    };

    let tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && el.props['aria-label'] === 'Configure toolbar chart patterns')!.props.onClick();
    tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scan Active Chart')!.props.onClick();
    await flushMicrotasks();

    // Supersede scan #1 with scan #2
    tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && el.props['aria-label'] === 'Configure toolbar chart patterns')!.props.onClick();
    tree = renderToolbar();
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scan Active Chart')!.props.onClick();
    await flushMicrotasks();

    // Late rejection from superseded scan #1 must NOT clear running state or show error toast
    firstEval.reject(new Error('Stale worker crash'));
    await flushMicrotasks();
    tree = renderToolbar();
    expect(harness.chart.addToast).not.toHaveBeenCalled();
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scanning...')).not.toBeNull();

    // Active scan #2 failure displays error toast and unlocks button
    secondEval.reject(new Error('Active worker failure'));
    await flushMicrotasks();
    tree = renderToolbar();
    expect(harness.chart.addToast).toHaveBeenCalledWith(
      'Failed to run chart-pattern scan: Active worker failure',
      'error',
      'Scanner',
    );
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.disabled).toBe(false);
  });

  it('forces a fresh scan even if an earlier onScanNow closure is invoked after overlay activation', async () => {
    const rescanEval = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => rescanEval.promise;

    let tree = renderToolbar();
    // Open modal while isChartPatternActive is false and capture stale onScanNow
    findElement(tree, (el) => el.type === 'button' && el.props['aria-label'] === 'Configure toolbar chart patterns')!.props.onClick();
    tree = renderToolbar();
    const staleScanNow = findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scan Active Chart')!.props.onClick;

    // Overlay activates while that callback was held
    harness.ui.scannerChartOverlay = {
      id: 'overlay-2',
      instrument: { exchange: 'NSE', symbol: 'ABC' },
      date: '2028-06-20',
      scannerName: 'Prior Overlay',
      scannerId: 'chart_double_bottom',
      timeframe: 'D',
      levels: [],
    };
    staleScanNow();
    await flushMicrotasks();

    expect(harness.ui.clearScannerChartOverlay).toHaveBeenCalledOnce();
    expect(harness.ui.clearScannerPatternMap).toHaveBeenCalledOnce();
    expect(harness.executors[0]!.evaluateToolbar).toHaveBeenCalledOnce();

    rescanEval.resolve({ results: [makeMatchedResult('ABC', 'Fresh Overlay')], cancelled: false });
    await flushMicrotasks();
    expect(harness.ui.showScannerChartOverlay).toHaveBeenCalledOnce();
    expect(harness.ui.showScannerChartOverlay.mock.calls[0][0].scannerName).toBe('Fresh Overlay');
  });

  it('supersedes rapid double-clicks on Chart Patterns before disabled renders and survives rapid tab/chip switching', async () => {
    const eval1 = deferred<ToolbarChartPatternEvaluationOutput>();
    const eval2 = deferred<ToolbarChartPatternEvaluationOutput>();
    let callIdx = 0;
    harness.evaluateToolbarImpl = () => {
      callIdx += 1;
      return callIdx === 1 ? eval1.promise : eval2.promise;
    };

    let tree = renderToolbar();
    const chipBefore = findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!;

    // Trigger twice synchronously before React flushes disabled={true}:
    // click #1 is superseded during loadCompleteChartHistory, so only click #2 enters evaluateToolbar.
    chipBefore.props.onClick();
    chipBefore.props.onClick();
    await flushMicrotasks();
    tree = renderToolbar();

    expect(harness.desktopApi.getEodData).toHaveBeenCalledTimes(2);
    expect(harness.executors).toHaveLength(1);
    expect(harness.executors[0]!.evaluateToolbar).toHaveBeenCalledTimes(1);
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Scanning...')).not.toBeNull();

    // Toggling unrelated Volume chip mid-scan does NOT cancel the active scan
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Volume')!.props.onClick();
    tree = renderToolbar();
    const cancelCountBeforeTabSwitch = harness.executors[0]!.cancel.mock.calls.length;

    // Rapidly switch to tab-2 and right back to tab-1 mid-scan
    const tab2Bars = makeHeadAndShouldersBars('XYZ');
    harness.chart.chartTabs.push({
      ...harness.chart.chartTabs[0],
      id: 'tab-2',
      instrument: { exchange: 'NSE', symbol: 'XYZ' },
      requestedInstrument: { exchange: 'NSE', symbol: 'XYZ' },
      rawBars: tab2Bars,
      displayBars: tab2Bars,
    });
    harness.chart.activeChartTabId = 'tab-2';
    tree = renderToolbar();
    expect(harness.executors[0]!.cancel.mock.calls.length).toBeGreaterThan(cancelCountBeforeTabSwitch);
    expect(findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.disabled).toBe(false);

    harness.chart.activeChartTabId = 'tab-1';
    tree = renderToolbar();

    // Even if eval1 resolves late after returning to tab-1, stale scan is discarded
    eval1.resolve({ results: [makeMatchedResult('ABC', 'Stale After Tab Switch')], cancelled: false });
    await flushMicrotasks();
    expect(harness.ui.showScannerChartOverlay).not.toHaveBeenCalled();

    // Fresh click on Chart Patterns after rapid switching works cleanly (ON -> OFF -> ON)
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();
    expect(harness.executors[0]!.evaluateToolbar).toHaveBeenCalledTimes(2);
    eval2.resolve({ results: [makeMatchedResult('ABC', 'Recovered Scan 2')], cancelled: false });
    await flushMicrotasks();
    tree = renderToolbar();
    expect(harness.ui.showScannerChartOverlay).toHaveBeenCalledTimes(1);
    expect(harness.ui.showScannerChartOverlay.mock.calls[0][0].scannerName).toBe('Recovered Scan 2');

    // Toggle OFF then immediately back ON
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    tree = renderToolbar();
    expect(harness.ui.clearScannerChartOverlay).toHaveBeenCalledTimes(1);
    const eval3 = deferred<ToolbarChartPatternEvaluationOutput>();
    harness.evaluateToolbarImpl = () => eval3.promise;
    findElement(tree, (el) => el.type === 'button' && flattenText(el) === 'Chart Patterns')!.props.onClick();
    await flushMicrotasks();
    eval3.resolve({ results: [makeMatchedResult('ABC', 'Immediate Re-On 3')], cancelled: false });
    await flushMicrotasks();
    expect(harness.ui.showScannerChartOverlay).toHaveBeenCalledTimes(2);
    expect(harness.ui.showScannerChartOverlay.mock.calls[1][0].scannerName).toBe('Immediate Re-On 3');
  });
});
