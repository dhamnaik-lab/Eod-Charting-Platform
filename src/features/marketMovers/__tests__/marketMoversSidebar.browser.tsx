import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import RootApp from '@/RootApp';
import { useChartStore } from '@/store/chartStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useMarketMoversStore } from '../marketMoversStore';
import { buildMarketMoversSnapshot } from '../marketMoversSnapshotService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function button(scope: ParentNode, text: string): HTMLButtonElement {
  const target = Array.from(scope.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
  assert(target, `Missing button: ${text}`);
  return target;
}

function click(target: HTMLElement) {
  flushSync(() => {
    for (const type of ['mousedown', 'mouseup', 'click']) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
    }
  });
}

function expectSidebarOpen(step: string) {
  const { sidebarPinned, sidebarCollapsed } = useWorkspaceStore.getState();
  assert(!sidebarPinned && !sidebarCollapsed, `Sidebar collapsed or pinned during ${step}`);
  assert(document.querySelector('aside')?.textContent?.includes('MARKET MOVERS'), `Movers unmounted during ${step}`);
}

function openFilters() {
  const sidebar = document.querySelector('aside');
  assert(sidebar, 'Sidebar is missing');
  click(button(sidebar, 'Filters'));
  const dialog = document.querySelector<HTMLElement>('[aria-label="Market Movers filters"]');
  assert(dialog?.parentElement === document.body, 'Filters must be portalled to document.body');
  expectSidebarOpen('opening Filters');
  return dialog;
}

function editMinimumPrice(dialog: HTMLElement, price: number) {
  const input = dialog.querySelector<HTMLInputElement>('input[type=number]');
  assert(input, 'Minimum close price input is missing');
  click(input);
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  assert(setValue, 'Missing native input setter');
  flushSync(() => {
    setValue.call(input, String(price));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expectSidebarOpen('editing a portal field');
  assert(input.value === String(price), 'The portal input did not accept the edit');
}

async function run() {
  const instrument = { exchange: 'NSE', symbol: 'IA_FIXTURE' };
  const loaded: Array<typeof instrument> = [];
  useChartStore.setState({ init: async () => {}, loadInstrument: async (key) => { loaded.push(key); } });
  useWorkspaceStore.setState({ sidebarPinned: false, sidebarCollapsed: false, sidebarPanel: 'symbols' });
  const settings = useMarketMoversStore.getState().settings;
  const snapshot = await buildMarketMoversSnapshot({
    settings,
    batch: {
      requestId: 'ia03',
      databaseIdentity: 'fixture',
      databaseRevision: '1',
      latestDatabaseDate: '2026-11-16',
      targetSymbolCount: 1,
      fetchedSymbolCount: 1,
      failedSymbolCount: 0,
      failures: [],
      symbols: [{
        instrument,
        adjusted: true,
        includeDividendAdjustments: false,
        includeRightsAdjustments: false,
        events: [],
        bars: [
          { date: '2026-11-13', open: 100, high: 100, low: 100, close: 100, volume: 10_000 },
          { date: '2026-11-16', open: 105, high: 105, low: 105, close: 105, volume: 20_000 },
        ],
      }],
    },
  });
  assert(snapshot.gainers.length === 1, 'Expected one market mover from the fixture');
  useMarketMoversStore.setState({ snapshot, status: 'ready' });

  const mount = document.querySelector('#root');
  assert(mount, 'Missing React mount');
  const root = createRoot(mount);
  try {
    flushSync(() => root.render(<RootApp />));
    click(button(document, 'MOV'));
    expectSidebarOpen('selecting Movers in the sidebar');

    const cancelDialog = openFilters();
    editMinimumPrice(cancelDialog, 25);
    click(button(cancelDialog, 'Cancel'));
    assert(!cancelDialog.isConnected, 'Cancel left the portal open');
    assert(useMarketMoversStore.getState().settings.minPrice === settings.minPrice, 'Cancel changed the filter');
    expectSidebarOpen('Cancel');

    const applyDialog = openFilters();
    editMinimumPrice(applyDialog, 35);
    click(button(applyDialog, 'Apply'));
    assert(!applyDialog.isConnected, 'Apply left the portal open');
    assert(useMarketMoversStore.getState().settings.minPrice === 35, 'Apply did not commit the filter');
    expectSidebarOpen('Apply');

    const row = document.querySelector<HTMLElement>('aside [role=option]');
    assert(row, 'Market mover row is missing');
    flushSync(() => row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 })));
    const action = button(document, 'Open in active chart');
    assert(action.parentElement?.parentElement === document.body, 'Context menu must be portalled to document.body');
    expectSidebarOpen('opening the context menu');
    click(action);
    assert(loaded.length === 1 && loaded[0].symbol === instrument.symbol, 'Context-menu action did not load the fixture symbol');
    assert(!action.isConnected, 'Context menu stayed open after action selection');
    expectSidebarOpen('selecting the context-menu action');

    const main = document.querySelector('main');
    assert(main, 'Chart workspace is missing');
    click(main);
    assert(useWorkspaceStore.getState().sidebarCollapsed, 'A main-content click must still collapse the unpinned sidebar');
  } finally {
    root.unmount();
  }
}

void run().then(
  () => { document.body.dataset.result = 'pass'; },
  (error: unknown) => {
    document.body.dataset.result = 'fail';
    document.body.append(String(error));
  },
);
