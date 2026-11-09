import { memo, useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { format, parseISO } from 'date-fns';

/** Short timezone label appended to sync timestamps, e.g. " IST". Empty string if unavailable. */
const LOCAL_TZ_LABEL = (() => {
  try {
    const abbr =
      Intl.DateTimeFormat('en', { timeZoneName: 'short' })
        .formatToParts(new Date())
        .find((p) => p.type === 'timeZoneName')?.value ?? '';
    return abbr ? ` ${abbr}` : '';
  } catch {
    return '';
  }
})();
import { shallow } from 'zustand/shallow';
import { getDesktopApi, type InstrumentSummary, type SymbolExchangeFilter, type Watchlist } from '@/platform';
import { getSymbolFilterVisibility } from '@/features/watchlists/symbolFilterVisibility';
import { getSidebarListWindow } from '@/features/watchlists/sidebarListWindow';
import { INDICATOR_CATALOG, INDICATOR_SUBCATEGORIES, getIndicatorSubcategory } from '@/indicators/catalog';
import { readFavoriteIndicatorIds, writeFavoriteIndicatorIds, toggleFavoriteIndicatorId, subscribeFavoriteIndicatorUpdates } from '@/indicators/indicatorFavoritesService';
import { WatchlistNameDialog } from '@/components/WatchlistDialogs';
import { findSelectedWatchlist } from '@/features/watchlists/watchlistNavigationService';
import { getActiveChartTab, useChartStore } from '@/store/chartStore';
import { useWindowStore } from '@/store/windowStore';
import { useUiStore } from '@/store/uiStore';
import { MarketMoversPanel } from '@/features/marketMovers/MarketMoversPanel';

type SidebarPanel = 'symbols' | 'indicators' | 'watchlist' | 'market-movers';

const SIDEBAR_PANELS: Array<{ id: SidebarPanel; label: string; railLabel: string }> = [
  { id: 'symbols', label: 'Symbols', railLabel: 'SYM' },
  { id: 'indicators', label: 'Indicators', railLabel: 'IND' },
  { id: 'watchlist', label: 'Watchlist', railLabel: 'WL' },
  { id: 'market-movers', label: 'Market Movers', railLabel: 'MOV' },
];
const SYMBOL_EXCHANGE_FILTER_OPTIONS: Array<{ value: SymbolExchangeFilter; label: string }> = [
  { value: 'NSE', label: 'NSE' },
  { value: 'BSE', label: 'BSE' },
  { value: 'all', label: 'All' },
];

const SCROLL_INDEX = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '0-9'];
const EMPTY_WATCHLISTS: Watchlist[] = [];
const EMPTY_ITEMS: InstrumentSummary[] = [];
const DEFAULT_NSE_SERIES_FILTERS = ['BE', 'BZ', 'EQ', 'SM', 'ST', 'SZ'];
const DEFAULT_BSE_SERIES_FILTERS = ['A', 'B', 'EQ', 'M', 'MT', 'T', 'X', 'XT'];
const SYMBOL_SERIES_PREFERENCES_KEY = 'eod-chart.sidebar.symbolSeriesPreferences.v1';
const RECENT_SYMBOLS_STORAGE_KEY = 'eod-chart.sidebar.recentlyViewedSymbols.v1';
const DEFAULT_SELECTED_SERIES_FILTERS: Record<SymbolExchangeFilter, string[]> = {
  NSE: DEFAULT_NSE_SERIES_FILTERS,
  BSE: DEFAULT_BSE_SERIES_FILTERS,
  all: [],
};
const SYMBOL_SERIES_SETTING_EXCHANGES: SymbolExchangeFilter[] = ['NSE', 'BSE', 'all'];
type SymbolLifecycleFilter = 'OLD_SYMBOL' | 'DELISTED' | 'SUSPENDED' | 'UNKNOWN_INACTIVE';
const SYMBOL_LIFECYCLE_FILTER_OPTIONS: Array<{ value: SymbolLifecycleFilter; label: string; hint: string }> = [
  { value: 'OLD_SYMBOL', label: 'Old symbols', hint: 'renamed' },
  { value: 'DELISTED', label: 'De-listed', hint: 'official' },
  { value: 'SUSPENDED', label: 'Suspended', hint: 'official' },
  { value: 'UNKNOWN_INACTIVE', label: 'Other inactive', hint: 'review' },
];
function getMinimizedWindowIcon(id: string): string {
  if (id.includes('scanner')) return '🔍';
  if (id.includes('bhavcopy') && !id.includes('exclude')) return '📥';
  if (id.includes('exclude')) return '🚫';
  if (id.includes('watchlist')) return '⭐';
  if (id.includes('indicator')) return '📊';
  if (id.includes('alert')) return '🔔';
  if (id.includes('quote')) return '📝';
  if (id.includes('corporate-action-maintenance')) return '\uD83D\uDEE0';
  if (id.includes('corporate') || id.includes('identity')) return '🏢';
  if (id.includes('parity')) return '⚖';
  if (id.includes('import')) return '📄';
  if (id.includes('settings')) return '⚙';
  if (id.includes('database') || id.includes('recent')) return '📁';
  if (id.includes('shortcut')) return '⌨';
  if (id.includes('faq')) return '❓';
  if (id.includes('about')) return 'ℹ';
  return '🗔';
}

interface SidebarProps {
  width: number;
  collapsed: boolean;
  pinned: boolean;
  onToggleCollapse: () => void;
  onTogglePin: () => void;
}

interface WatchlistItemContextMenuState {
  x: number;
  y: number;
  item: InstrumentSummary;
}

interface SymbolItemContextMenuState {
  x: number;
  y: number;
  item: InstrumentSummary;
}

function readStoredRecentSymbols(): InstrumentSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SYMBOLS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InstrumentSummary[]) : [];
  } catch {
    return [];
  }
}

function writeStoredRecentSymbols(symbols: InstrumentSummary[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_SYMBOLS_STORAGE_KEY, JSON.stringify(symbols.slice(0, 8)));
  } catch {}
}

interface SymbolListEntry {
  kind: 'group' | 'item';
  key: string;
  groupKey: string;
  item?: InstrumentSummary;
}

interface LifecycleFilterOption {
  value: SymbolLifecycleFilter;
  label: string;
  hint: string;
  count: number;
}

interface SymbolSeriesPreferences {
  visibleSeriesByExchange: Partial<Record<SymbolExchangeFilter, string[]>>;
  defaultSelectedSeriesByExchange: Partial<Record<SymbolExchangeFilter, string[]>>;
  selectedSeriesByExchange?: Partial<Record<SymbolExchangeFilter, string[]>>;
}

interface SymbolSeriesSettingsDraft {
  visibleSeriesByExchange: Record<SymbolExchangeFilter, string[]>;
  defaultSelectedSeriesByExchange: Record<SymbolExchangeFilter, string[]>;
}

function createDefaultSeriesPreferences(): SymbolSeriesPreferences {
  return {
    visibleSeriesByExchange: {},
    defaultSelectedSeriesByExchange: {
      NSE: [...DEFAULT_SELECTED_SERIES_FILTERS.NSE],
      BSE: [...DEFAULT_SELECTED_SERIES_FILTERS.BSE],
      all: [...DEFAULT_SELECTED_SERIES_FILTERS.all],
    },
  };
}

function readStoredSeriesPreferences(): SymbolSeriesPreferences {
  if (typeof window === 'undefined') {
    return createDefaultSeriesPreferences();
  }

  const raw = window.localStorage.getItem(SYMBOL_SERIES_PREFERENCES_KEY);
  if (!raw) {
    return createDefaultSeriesPreferences();
  }

  try {
    return normalizeSeriesPreferences(JSON.parse(raw) as Partial<SymbolSeriesPreferences>);
  } catch {
    return createDefaultSeriesPreferences();
  }
}

function writeStoredSeriesPreferences(preferences: SymbolSeriesPreferences): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(SYMBOL_SERIES_PREFERENCES_KEY, JSON.stringify(preferences));
}

function normalizeSeriesPreferences(value: Partial<SymbolSeriesPreferences>): SymbolSeriesPreferences {
  return {
    visibleSeriesByExchange: normalizeSeriesRecord(value.visibleSeriesByExchange, {}),
    defaultSelectedSeriesByExchange: normalizeSeriesRecord(
      value.defaultSelectedSeriesByExchange,
      DEFAULT_SELECTED_SERIES_FILTERS,
    ),
    selectedSeriesByExchange: value.selectedSeriesByExchange
      ? normalizeSeriesRecord(value.selectedSeriesByExchange, {})
      : undefined,
  };
}

function normalizeSeriesRecord(
  value: Partial<Record<SymbolExchangeFilter, string[]>> | undefined,
  fallback: Partial<Record<SymbolExchangeFilter, string[]>>,
): Partial<Record<SymbolExchangeFilter, string[]>> {
  const next: Partial<Record<SymbolExchangeFilter, string[]>> = {};
  SYMBOL_SERIES_SETTING_EXCHANGES.forEach((exchange) => {
    const rawValues = value?.[exchange] ?? fallback[exchange];
    if (rawValues) {
      next[exchange] = normalizeSeriesList(rawValues);
    }
  });
  return next;
}

function normalizeSeriesList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => normalizeSeriesValue(value)).filter(Boolean))).sort(compareSeriesValues);
}

function buildInitialSelectedSeriesFilters(preferences: SymbolSeriesPreferences): Record<SymbolExchangeFilter, string[]> {
  const selected = preferences.selectedSeriesByExchange;
  return {
    NSE: normalizeSeriesList(selected?.NSE ?? preferences.defaultSelectedSeriesByExchange.NSE ?? DEFAULT_SELECTED_SERIES_FILTERS.NSE),
    BSE: normalizeSeriesList(selected?.BSE ?? preferences.defaultSelectedSeriesByExchange.BSE ?? DEFAULT_SELECTED_SERIES_FILTERS.BSE),
    all: normalizeSeriesList(selected?.all ?? preferences.defaultSelectedSeriesByExchange.all ?? DEFAULT_SELECTED_SERIES_FILTERS.all),
  };
}

function createSeriesSettingsDraft(
  preferences: SymbolSeriesPreferences,
  items: InstrumentSummary[],
): SymbolSeriesSettingsDraft {
  return {
    visibleSeriesByExchange: {
      NSE: buildDraftVisibleSeries(preferences, items, 'NSE'),
      BSE: buildDraftVisibleSeries(preferences, items, 'BSE'),
      all: buildDraftVisibleSeries(preferences, items, 'all'),
    },
    defaultSelectedSeriesByExchange: {
      NSE: buildDraftDefaultSeries(preferences, items, 'NSE'),
      BSE: buildDraftDefaultSeries(preferences, items, 'BSE'),
      all: buildDraftDefaultSeries(preferences, items, 'all'),
    },
  };
}

function buildDraftVisibleSeries(
  preferences: SymbolSeriesPreferences,
  items: InstrumentSummary[],
  exchange: SymbolExchangeFilter,
): string[] {
  const knownSeries = collectSeriesForExchange(items, exchange);
  const configured = preferences.visibleSeriesByExchange[exchange];
  if (configured && configured.length > 0) {
    return normalizeSeriesList([
      ...configured,
      ...(preferences.defaultSelectedSeriesByExchange[exchange] ?? []),
      ...knownSeries,
    ]);
  }
  return knownSeries;
}

function buildDraftDefaultSeries(
  preferences: SymbolSeriesPreferences,
  items: InstrumentSummary[],
  exchange: SymbolExchangeFilter,
): string[] {
  const defaults = preferences.defaultSelectedSeriesByExchange[exchange] ?? DEFAULT_SELECTED_SERIES_FILTERS[exchange];
  return normalizeSeriesList(defaults);
}

function collectSeriesForExchange(items: InstrumentSummary[], exchange: SymbolExchangeFilter): string[] {
  const values = new Set<string>();
  filterSymbolBrowserItemsByExchange(items, exchange).forEach((item) => {
    values.add(normalizeSeriesValue(item.series));
  });
  DEFAULT_SELECTED_SERIES_FILTERS[exchange].forEach((series) => values.add(series));
  return Array.from(values).sort(compareSeriesValues);
}

const SIDEBAR_RAIL_WIDTH = 34;
const VIRTUAL_ROW_HEIGHT = 30;
const SIDEBAR_COLLAPSED_SUBCATS_KEY = 'eod-chart.sidebar.collapsed-subcategories.v1';
const SIDEBAR_COLLAPSED_FAVORITES_KEY = 'eod-chart.sidebar.collapsed-favorites.v1';

function readStoredCollapsedSubcategories(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_SUBCATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function readStoredFavoritesCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_FAVORITES_KEY) === 'true';
  } catch {
    return false;
  }
}

export function Sidebar({ width, collapsed, pinned, onToggleCollapse, onTogglePin }: SidebarProps) {
  const { activeDatabasePath, dbStats, watchlists, isDatabaseTransitioning } = useChartStore(
    (state) => ({
      activeDatabasePath: state.snapshot?.activeDatabasePath ?? null,
      dbStats: state.snapshot?.dbStats ?? null,
      watchlists: state.snapshot?.watchlists ?? EMPTY_WATCHLISTS,
      isDatabaseTransitioning: state.isDatabaseTransitioning,
    }),
    shallow,
  );
  const activeInstrumentKey = useChartStore((state) => {
    const activeTab = getActiveChartTab(state.chartTabs, state.activeChartTabId);
    const instrument = activeTab?.instrument;
    return instrument ? buildInstrumentKey(instrument.symbol, instrument.exchange) : null;
  });
  const selectedWatchlistId = useChartStore((state) => state.selectedWatchlistId);
  const selectWatchlist = useChartStore((state) => state.selectWatchlist);
  const symbolBrowserQuery = useChartStore((state) => state.symbolBrowserQuery);
  const setSymbolBrowserQuery = useChartStore((state) => state.setSymbolBrowserQuery);
  const symbolExchangeFilter = useChartStore((state) => state.symbolExchangeFilter);
  const setSymbolExchangeFilter = useChartStore((state) => state.setSymbolExchangeFilter);
  const symbolBrowserItems = useChartStore((state) => state.symbolBrowserItems);
  const symbolBrowserLoadedDatabasePath = useChartStore((state) => state.symbolBrowserLoadedDatabasePath);
  const isSymbolBrowserLoading = useChartStore((state) => state.isSymbolBrowserLoading);
  const refreshSymbolBrowser = useChartStore((state) => state.refreshSymbolBrowser);
  const loadInstrument = useChartStore((state) => state.loadInstrument);
  const createWatchlist = useChartStore((state) => state.createWatchlist);
  const removeFromWatchlist = useChartStore((state) => state.removeFromWatchlist);
  const updateOfficialWatchlist = useChartStore((state) => state.updateOfficialWatchlist);
  const addIndicatorCatalog = useChartStore((state) => state.addIndicatorCatalog);
  const addToast = useChartStore((state) => state.addToast);
  const createChartTab = useChartStore((state) => state.createChartTab);
  const addToWatchlist = useChartStore((state) => state.addToWatchlist);
  const openQuoteEditor = useUiStore((state) => state.openQuoteEditor);
  const isClassicLightRefined = useUiStore((state) => state.currentTheme === 'classic-light-refined');
  const windows = useWindowStore((state) => state.windows);
  const restoreWindow = useWindowStore((state) => state.restoreWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const minimizedWindows = useMemo(
    () => Object.values(windows).filter((w) => w.isOpen && w.isMinimized),
    [windows],
  );
  const [activePanel, setActivePanel] = useState<SidebarPanel>('symbols');
  const [recentSymbols, setRecentSymbols] = useState<InstrumentSummary[]>(() => readStoredRecentSymbols());
  const [recentSectionCollapsed, setRecentSectionCollapsed] = useState(false);
  const [favoriteIndicatorIds, setFavoriteIndicatorIds] = useState<string[]>(readFavoriteIndicatorIds);
  useEffect(() => subscribeFavoriteIndicatorUpdates(setFavoriteIndicatorIds), []);
  const [watchlistQuickAddQuery, setWatchlistQuickAddQuery] = useState('');
  const [watchlistSortOrder, setWatchlistSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [symbolContextMenu, setSymbolContextMenu] = useState<SymbolItemContextMenuState | null>(null);
  const [watchlistSubmenuOpen, setWatchlistSubmenuOpen] = useState(false);
  const [indicatorQuery, setIndicatorQuery] = useState('');
  const [activeScrollIndex, setActiveScrollIndex] = useState<string | null>(null);
  const [hoveredPanel, setHoveredPanel] = useState<string | null>(null);
  const [hoveredCollapse, setHoveredCollapse] = useState(false);
  const [symbolSearchHovered, setSymbolSearchHovered] = useState(false);
  const [symbolSearchFocused, setSymbolSearchFocused] = useState(false);
  const [seriesFilterOpen, setSeriesFilterOpen] = useState(false);
  const [seriesSettingsOpen, setSeriesSettingsOpen] = useState(false);
  const [seriesSettingsExchange, setSeriesSettingsExchange] = useState<SymbolExchangeFilter>('NSE');
  const [seriesPreferences, setSeriesPreferences] = useState<SymbolSeriesPreferences>(() => readStoredSeriesPreferences());
  const [seriesSettingsDraft, setSeriesSettingsDraft] = useState<SymbolSeriesSettingsDraft>(() =>
    createSeriesSettingsDraft(readStoredSeriesPreferences(), EMPTY_ITEMS),
  );
  const [seriesSettingsCatalogItems, setSeriesSettingsCatalogItems] = useState<InstrumentSummary[]>(EMPTY_ITEMS);
  const [seriesSettingsLoading, setSeriesSettingsLoading] = useState(false);
  const [selectedLifecycleFilters, setSelectedLifecycleFilters] = useState<SymbolLifecycleFilter[]>([]);
  const [selectedSeriesFiltersByExchange, setSelectedSeriesFiltersByExchange] = useState<Record<SymbolExchangeFilter, string[]>>(() =>
    buildInitialSelectedSeriesFilters(readStoredSeriesPreferences()),
  );
  const [watchlistItemContextMenu, setWatchlistItemContextMenu] = useState<WatchlistItemContextMenuState | null>(null);
  const [watchlistCreateName, setWatchlistCreateName] = useState('');
  const [watchlistCreateDialogOpen, setWatchlistCreateDialogOpen] = useState(false);
  const symbolListRef = useRef<HTMLDivElement>(null);
  const recentSectionRef = useRef<HTMLDivElement>(null);
  const watchlistListRef = useRef<HTMLDivElement>(null);
  const [symbolScroll, setSymbolScroll] = useState({ top: 0, height: 500, recentHeight: 0 });
  const [watchlistScroll, setWatchlistScroll] = useState({ top: 0, height: 500 });
  const seriesFilterRef = useRef<HTMLDivElement>(null);
  const scrollIndexResetTimerRef = useRef<number | null>(null);
  const selectedSeriesFilters = selectedSeriesFiltersByExchange[symbolExchangeFilter];
  const exchangeScopedSymbolBrowserItems = useMemo(
    () => filterSymbolBrowserItemsByExchange(symbolBrowserItems, symbolExchangeFilter),
    [symbolBrowserItems, symbolExchangeFilter],
  );
  const lifecycleFilteredSymbolBrowserItems = useMemo(
    () => filterSymbolBrowserItemsByLifecycle(exchangeScopedSymbolBrowserItems, selectedLifecycleFilters),
    [exchangeScopedSymbolBrowserItems, selectedLifecycleFilters],
  );
  const lifecycleFilterOptions = useMemo(
    () => buildLifecycleFilterOptions(exchangeScopedSymbolBrowserItems),
    [exchangeScopedSymbolBrowserItems],
  );
  const visibleSeriesFilters = useMemo(
    () => getVisibleSeriesForExchange(seriesPreferences, symbolExchangeFilter),
    [seriesPreferences, symbolExchangeFilter],
  );
  const seriesFilterOptions = useMemo(
    () => buildSeriesFilterOptions(lifecycleFilteredSymbolBrowserItems, selectedSeriesFilters, visibleSeriesFilters),
    [lifecycleFilteredSymbolBrowserItems, selectedSeriesFilters, visibleSeriesFilters],
  );
  const filteredSymbolBrowserItems = useMemo(
    () => filterSymbolBrowserItemsBySeries(lifecycleFilteredSymbolBrowserItems, selectedSeriesFilters),
    [lifecycleFilteredSymbolBrowserItems, selectedSeriesFilters],
  );
  const symbolFiltersActive = selectedSeriesFilters.length > 0 || selectedLifecycleFilters.length > 0;
  const filterVisibility = getSymbolFilterVisibility(
    exchangeScopedSymbolBrowserItems.length,
    filteredSymbolBrowserItems.length,
  );
  const displaySymbolBrowserItems = useMemo(
    () => orderSymbolBrowserItems(filteredSymbolBrowserItems, symbolExchangeFilter),
    [filteredSymbolBrowserItems, symbolExchangeFilter],
  );
  const visibleRecentSymbols = useMemo(() => {
    if (symbolBrowserQuery.trim()) return [];
    return filterSymbolBrowserItemsByExchange(recentSymbols, symbolExchangeFilter);
  }, [recentSymbols, symbolBrowserQuery, symbolExchangeFilter]);
  const symbolBrowserCounts = useMemo(() => countSymbolsByExchange(filteredSymbolBrowserItems), [filteredSymbolBrowserItems]);
  const seriesSettingsOptions = useMemo(
    () =>
      buildSeriesSettingsOptions(
        seriesSettingsCatalogItems.length ? seriesSettingsCatalogItems : symbolBrowserItems,
        seriesSettingsExchange,
        seriesSettingsDraft,
      ),
    [seriesSettingsCatalogItems, seriesSettingsDraft, seriesSettingsExchange, symbolBrowserItems],
  );

  const { symbolBrowserEntries, symbolGroupEntryIndexMap, symbolItemEntryIndexMap } = useMemo(() => {
    const entries: SymbolListEntry[] = [];
    const groupStartIndexes = new Map<string, number>();
    const itemIndexes = new Map<string, number>();
    const seenGroups = new Set<string>();

    displaySymbolBrowserItems.forEach((item) => {
      const firstChar = item.symbol.charAt(0).toUpperCase();
      const letterGroup = /[A-Z]/.test(firstChar) ? firstChar : '0-9';
      const groupKey = symbolExchangeFilter === 'all' ? `${item.exchange} ${letterGroup}` : letterGroup;
      if (!seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        if (!groupStartIndexes.has(letterGroup)) {
          groupStartIndexes.set(letterGroup, entries.length);
        }
        entries.push({
          kind: 'group',
          key: `group:${groupKey}`,
          groupKey,
        });
      }

      itemIndexes.set(buildInstrumentKey(item.symbol, item.exchange), entries.length);
      entries.push({
        kind: 'item',
        key: `${item.exchange}:${item.symbol}`,
        groupKey,
        item,
      });
    });

    return {
      symbolBrowserEntries: entries,
      symbolGroupEntryIndexMap: groupStartIndexes,
      symbolItemEntryIndexMap: itemIndexes,
    };
  }, [displaySymbolBrowserItems, symbolExchangeFilter]);

  const symbolRowWindow = getSidebarListWindow(
    symbolBrowserEntries.length,
    symbolScroll.top,
    symbolScroll.height,
    VIRTUAL_ROW_HEIGHT,
    symbolScroll.recentHeight,
  );

  useEffect(() => {
    if (activePanel !== 'symbols') return;
    const container = symbolListRef.current;
    if (!container) return;

    const measure = () => {
      const nextTop = container.scrollTop;
      const nextHeight = container.clientHeight;
      const nextRecentHeight = recentSectionRef.current?.offsetHeight ?? 0;
      setSymbolScroll((current) =>
        current.top === nextTop && current.height === nextHeight && current.recentHeight === nextRecentHeight
          ? current
          : { top: nextTop, height: nextHeight, recentHeight: nextRecentHeight },
      );
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    if (recentSectionRef.current) observer?.observe(recentSectionRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activePanel, visibleRecentSymbols.length, recentSectionCollapsed]);

  const scrollToIndex = useCallback((index: string) => {
    const container = symbolListRef.current;
    const entryIndex = symbolGroupEntryIndexMap.get(index);
    if (container && entryIndex !== undefined) {
      const nextTop = Math.max(0, symbolScroll.recentHeight + entryIndex * VIRTUAL_ROW_HEIGHT);
      container.scrollTop = nextTop;
      setSymbolScroll((current) => current.top === nextTop ? current : { ...current, top: nextTop });
    }
    setActiveScrollIndex(index);
    if (scrollIndexResetTimerRef.current !== null) {
      window.clearTimeout(scrollIndexResetTimerRef.current);
    }
    scrollIndexResetTimerRef.current = window.setTimeout(() => {
      setActiveScrollIndex(null);
      scrollIndexResetTimerRef.current = null;
    }, 500);
  }, [symbolGroupEntryIndexMap, symbolScroll.recentHeight]);

  useEffect(() => {
    if (!seriesFilterOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const container = seriesFilterRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setSeriesFilterOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [seriesFilterOpen]);

  const toggleSeriesFilter = useCallback(
    (series: string) => {
      setSelectedSeriesFiltersByExchange((current) => {
        const currentValues = current[symbolExchangeFilter] ?? [];
        const nextValues = currentValues.includes(series)
          ? currentValues.filter((value) => value !== series)
          : [...currentValues, series].sort(compareSeriesValues);
        const next = {
          ...current,
          [symbolExchangeFilter]: nextValues,
        };
        setSeriesPreferences((prev) => {
          const updated: SymbolSeriesPreferences = {
            ...prev,
            selectedSeriesByExchange: next,
            defaultSelectedSeriesByExchange: {
              ...prev.defaultSelectedSeriesByExchange,
              [symbolExchangeFilter]: nextValues,
            },
          };
          writeStoredSeriesPreferences(updated);
          return updated;
        });
        return next;
      });
    },
    [symbolExchangeFilter],
  );

  const clearSeriesFilters = useCallback(() => {
    setSelectedSeriesFiltersByExchange((current) => {
      const next = {
        ...current,
        [symbolExchangeFilter]: [],
      };
      setSeriesPreferences((prev) => {
        const updated: SymbolSeriesPreferences = {
          ...prev,
          selectedSeriesByExchange: next,
          defaultSelectedSeriesByExchange: {
            ...prev.defaultSelectedSeriesByExchange,
            [symbolExchangeFilter]: [],
          },
        };
        writeStoredSeriesPreferences(updated);
        return updated;
      });
      return next;
    });
  }, [symbolExchangeFilter]);

  const toggleLifecycleFilter = useCallback((status: SymbolLifecycleFilter) => {
    setSelectedLifecycleFilters((current) =>
      current.includes(status)
        ? current.filter((value) => value !== status)
        : [...current, status],
    );
  }, []);

  const clearSymbolFilters = useCallback(() => {
    clearSeriesFilters();
    setSelectedLifecycleFilters([]);
  }, [clearSeriesFilters]);

  const openSeriesSettings = useCallback(() => {
    const initialItems = seriesSettingsCatalogItems.length ? seriesSettingsCatalogItems : symbolBrowserItems;
    setSeriesSettingsDraft(createSeriesSettingsDraft(seriesPreferences, initialItems));
    setSeriesSettingsExchange(symbolExchangeFilter);
    setSeriesFilterOpen(false);
    setSeriesSettingsOpen(true);
    if (!activeDatabasePath) {
      return;
    }

    const api = getDesktopApi();
    if (!api) {
      return;
    }

    setSeriesSettingsLoading(true);
    void api
      .listSymbols({
        exchange: null,
        limit: 50000,
        seriesFilter: 'all',
        includeInactive: true,
      })
      .then((items) => {
        setSeriesSettingsCatalogItems(items);
        setSeriesSettingsDraft(createSeriesSettingsDraft(seriesPreferences, items));
      })
      .catch((error) => {
        addToast(
          error instanceof Error ? error.message : 'Unable to load series settings catalog.',
          'warning',
          'Series Settings',
        );
      })
      .finally(() => setSeriesSettingsLoading(false));
  }, [activeDatabasePath, addToast, seriesPreferences, seriesSettingsCatalogItems, symbolBrowserItems, symbolExchangeFilter]);

  const toggleSettingsSeriesVisible = useCallback(
    (series: string) => {
      setSeriesSettingsDraft((current) => {
        const visible = current.visibleSeriesByExchange[seriesSettingsExchange];
        const defaults = current.defaultSelectedSeriesByExchange[seriesSettingsExchange];
        const nextVisible = visible.includes(series)
          ? visible.filter((value) => value !== series)
          : [...visible, series].sort(compareSeriesValues);
        const nextDefaults = nextVisible.includes(series)
          ? defaults
          : defaults.filter((value) => value !== series);
        return {
          visibleSeriesByExchange: {
            ...current.visibleSeriesByExchange,
            [seriesSettingsExchange]: nextVisible,
          },
          defaultSelectedSeriesByExchange: {
            ...current.defaultSelectedSeriesByExchange,
            [seriesSettingsExchange]: nextDefaults,
          },
        };
      });
    },
    [seriesSettingsExchange],
  );

  const toggleSettingsSeriesDefault = useCallback(
    (series: string) => {
      setSeriesSettingsDraft((current) => {
        const visible = current.visibleSeriesByExchange[seriesSettingsExchange];
        if (!visible.includes(series)) {
          return current;
        }
        const defaults = current.defaultSelectedSeriesByExchange[seriesSettingsExchange];
        const nextDefaults = defaults.includes(series)
          ? defaults.filter((value) => value !== series)
          : [...defaults, series].sort(compareSeriesValues);
        return {
          ...current,
          defaultSelectedSeriesByExchange: {
            ...current.defaultSelectedSeriesByExchange,
            [seriesSettingsExchange]: nextDefaults,
          },
        };
      });
    },
    [seriesSettingsExchange],
  );

  const resetSeriesSettings = useCallback(() => {
    const nextPreferences = createDefaultSeriesPreferences();
    const nextDraft = createSeriesSettingsDraft(nextPreferences, symbolBrowserItems);
    setSeriesPreferences(nextPreferences);
    setSeriesSettingsDraft(nextDraft);
    setSelectedSeriesFiltersByExchange(buildInitialSelectedSeriesFilters(nextPreferences));
    writeStoredSeriesPreferences(nextPreferences);
  }, [symbolBrowserItems]);

  const applySeriesSettings = useCallback(() => {
    const nextPreferences = normalizeSeriesPreferences({
      visibleSeriesByExchange: seriesSettingsDraft.visibleSeriesByExchange,
      defaultSelectedSeriesByExchange: seriesSettingsDraft.defaultSelectedSeriesByExchange,
      selectedSeriesByExchange: seriesSettingsDraft.defaultSelectedSeriesByExchange,
    });
    setSeriesPreferences(nextPreferences);
    setSelectedSeriesFiltersByExchange(buildInitialSelectedSeriesFilters(nextPreferences));
    writeStoredSeriesPreferences(nextPreferences);
    setSeriesSettingsOpen(false);
  }, [seriesSettingsDraft]);

  const handleScrollIndexClick = (index: string) => {
    scrollToIndex(index);
  };

  const handleScrollIndexWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = symbolListRef.current;
    if (!container) {
      return;
    }

    const pixelDelta = normalizeWheelDelta(event.deltaY, event.deltaMode, container.clientHeight);
    if (pixelDelta === 0) {
      return;
    }

    const previousTop = container.scrollTop;
    const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
    const nextTop = Math.max(0, Math.min(maxTop, previousTop + pixelDelta));

    if (nextTop === previousTop) {
      return;
    }

    container.scrollTop = nextTop;
    event.preventDefault();
  }, []);

  const selectedWatchlist = useMemo(
    () => findSelectedWatchlist(watchlists, selectedWatchlistId),
    [watchlists, selectedWatchlistId],
  );
  const selectedWatchlistItems = selectedWatchlist?.items ?? EMPTY_ITEMS;
  const selectedSourceLinkedWatchlist = selectedWatchlist?.sourceMeta?.sourceType === 'official';
  const lastSyncedDisplay = useMemo(() => {
    const raw = selectedSourceLinkedWatchlist
      ? (selectedWatchlist?.sourceMeta?.lastSyncedAt ?? null)
      : null;
    if (!raw) return null;
    try {
      return format(parseISO(raw), 'dd MMM yyyy, HH:mm') + LOCAL_TZ_LABEL;
    } catch {
      return null;
    }
  }, [selectedSourceLinkedWatchlist, selectedWatchlist?.sourceMeta?.lastSyncedAt]);
  const hasActiveDatabase = Boolean(activeDatabasePath);
  const watchlistStatusMessage = !hasActiveDatabase
    ? 'Open a database to manage watchlists.'
    : !selectedWatchlist
      ? 'Select a watchlist. Import groups from Watchlist > Import Watchlist Groups.'
      : selectedSourceLinkedWatchlist
        ? `Source linked - ${selectedWatchlist.sourceMeta?.sourceDisplayName ?? selectedWatchlist.name}`
        : 'Manual watchlist - Update applies only to imported source-linked watchlists.';
  const filteredCatalog = useMemo(() => {
    const query = indicatorQuery.trim().toLowerCase();
    if (!query) {
      return INDICATOR_CATALOG;
    }
    return INDICATOR_CATALOG.filter((item) => {
      const subcatMeta = INDICATOR_SUBCATEGORIES.find((s) => s.id === getIndicatorSubcategory(item.kind, item.placement));
      const subcatLabel = subcatMeta?.label ?? '';
      return `${item.label} ${item.shortLabel} ${item.group} ${subcatLabel}`.toLowerCase().includes(query);
    });
  }, [indicatorQuery]);

  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Record<string, boolean>>(() =>
    readStoredCollapsedSubcategories(),
  );

  const [favoritesCollapsed, setFavoritesCollapsed] = useState<boolean>(() =>
    readStoredFavoritesCollapsed(),
  );

  const toggleFavoritesCollapse = () => {
    setFavoritesCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(SIDEBAR_COLLAPSED_FAVORITES_KEY, String(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const toggleSubcategoryCollapse = (subcategoryId: string) => {
    setCollapsedSubcategories((prev) => {
      const next = {
        ...prev,
        [subcategoryId]: !prev[subcategoryId],
      };
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(SIDEBAR_COLLAPSED_SUBCATS_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const toggleFavoriteIndicator = useCallback((id: string) => {
    const next = toggleFavoriteIndicatorId(readFavoriteIndicatorIds(), id);
    writeFavoriteIndicatorIds(next);
    setFavoriteIndicatorIds(next);
  }, []);

  const favoriteIndicators = useMemo(
    () => INDICATOR_CATALOG.filter((item) => favoriteIndicatorIds.includes(item.id)),
    [favoriteIndicatorIds],
  );

  const watchlistQuickAddMatches = useMemo(() => {
    const q = watchlistQuickAddQuery.trim().toLowerCase();
    if (!q || !symbolBrowserItems.length) return [];
    return symbolBrowserItems
      .filter((item) => item.symbol.toLowerCase().includes(q) || (item.name && item.name.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [symbolBrowserItems, watchlistQuickAddQuery]);

  const sortedWatchlistItems = useMemo(() => {
    if (watchlistSortOrder === 'default') return selectedWatchlistItems;
    return [...selectedWatchlistItems].sort((a, b) => {
      const cmp = a.symbol.localeCompare(b.symbol);
      return watchlistSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [selectedWatchlistItems, watchlistSortOrder]);

  const watchlistRowWindow = getSidebarListWindow(
    sortedWatchlistItems.length,
    watchlistScroll.top,
    watchlistScroll.height,
    VIRTUAL_ROW_HEIGHT,
  );

  useEffect(() => {
    if (activePanel !== 'watchlist') return;
    const container = watchlistListRef.current;
    if (!container) return;
    const measure = () => {
      const top = container.scrollTop;
      const height = container.clientHeight;
      setWatchlistScroll((current) =>
        current.top === top && current.height === height ? current : { top, height },
      );
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(container);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [activePanel, selectedWatchlistId]);

  const renderIndicatorRow = useCallback(
    (item: (typeof INDICATOR_CATALOG)[number]) => {
      const isFavorite = favoriteIndicatorIds.includes(item.id);
      return (
        <div
          key={item.id}
          className="sidebar-row-shell"
          style={{
            display: 'flex',
            alignItems: 'center',
            height: 26,
            padding: '0 4px',
            borderRadius: 4,
            position: 'relative',
          }}
        >
          <button
            type="button"
            style={{
              border: 'none',
              background: 'transparent',
              color: isFavorite ? '#f59e0b' : 'var(--text-dim)',
              cursor: 'pointer',
              padding: '0 4px',
              fontSize: 12,
              lineHeight: 1,
            }}
            onClick={(e) => {
              e.stopPropagation();
              toggleFavoriteIndicator(item.id);
            }}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            {isFavorite ? '★' : '☆'}
          </button>

          <button
            type="button"
            draggable
            style={{
              flex: 1,
              border: 'none',
              background: 'transparent',
              color: 'var(--text)',
              textAlign: 'left',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 4px',
            }}
            onClick={() => addIndicatorCatalog(item.id)}
            onDoubleClick={() => addIndicatorCatalog(item.id)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy';
              event.dataTransfer.setData('application/x-eod-indicator-preset', item.id);
              event.dataTransfer.setData('application/x-eod-indicator-kind', item.kind);
            }}
            title={`${item.label} — ${item.description}\nClick + or double-click to add to chart.`}
          >
            <span>{item.label}</span>
          </button>

          <button
            type="button"
            style={{
              border: 'none',
              background: 'var(--bg3)',
              color: 'var(--accent-text)',
              borderRadius: 3,
              width: 18,
              height: 18,
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: '18px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
            }}
            onClick={(e) => {
              e.stopPropagation();
              addIndicatorCatalog(item.id);
              addToast(`Added ${item.label} to chart.`, 'success', 'Indicator');
            }}
            title={`Add ${item.label} to chart`}
          >
            +
          </button>
        </div>
      );
    },
    [addIndicatorCatalog, addToast, favoriteIndicatorIds, toggleFavoriteIndicator],
  );

  const overlayIndicators = useMemo(
    () =>
      filteredCatalog
        .filter((item) => item.placement === 'overlay')
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label)),
    [filteredCatalog],
  );

  const paneIndicators = useMemo(
    () =>
      filteredCatalog
        .filter((item) => item.placement === 'pane')
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label)),
    [filteredCatalog],
  );

  const overlaySubgroups = useMemo(() => {
    const subcats = INDICATOR_SUBCATEGORIES.filter((s) => s.placement === 'overlay');
    return subcats
      .map((subcat) => {
        const items = filteredCatalog
          .filter((item) => item.placement === 'overlay' && getIndicatorSubcategory(item.kind, item.placement) === subcat.id)
          .slice()
          .sort((a, b) => a.label.localeCompare(b.label));
        return {
          ...subcat,
          items,
        };
      })
      .filter((subcat) => subcat.items.length > 0);
  }, [filteredCatalog]);

  const paneSubgroups = useMemo(() => {
    const subcats = INDICATOR_SUBCATEGORIES.filter((s) => s.placement === 'pane');
    return subcats
      .map((subcat) => {
        const items = filteredCatalog
          .filter((item) => item.placement === 'pane' && getIndicatorSubcategory(item.kind, item.placement) === subcat.id)
          .slice()
          .sort((a, b) => a.label.localeCompare(b.label));
        return {
          ...subcat,
          items,
        };
      })
      .filter((subcat) => subcat.items.length > 0);
  }, [filteredCatalog]);

  const handleOpenInstrument = useCallback(
    (item: InstrumentSummary) => {
      void loadInstrument({ symbol: item.symbol, exchange: item.exchange }, item);
      setRecentSymbols((prev) => {
        const filtered = prev.filter((p) => !(p.symbol === item.symbol && p.exchange === item.exchange));
        const next = [item, ...filtered].slice(0, 8);
        writeStoredRecentSymbols(next);
        return next;
      });
    },
    [loadInstrument],
  );

  const handleClearRecentSymbols = useCallback(() => {
    setRecentSymbols([]);
    writeStoredRecentSymbols([]);
  }, []);

  const handleSymbolContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, item: InstrumentSummary) => {
      event.preventDefault();
      event.stopPropagation();
      setWatchlistSubmenuOpen(false);
      setSymbolContextMenu({
        x: event.clientX,
        y: event.clientY,
        item,
      });
    },
    [],
  );

  const keepVirtualRowInView = useCallback((container: HTMLDivElement | null, itemIndex: number, leadingHeight = 0) => {
    if (!container || itemIndex < 0) {
      return;
    }

    const rowTop = leadingHeight + itemIndex * VIRTUAL_ROW_HEIGHT;
    const rowBottom = rowTop + VIRTUAL_ROW_HEIGHT;
    if (rowTop < container.scrollTop) {
      container.scrollTop = rowTop;
    } else if (rowBottom > container.scrollTop + container.clientHeight) {
      container.scrollTop = Math.max(0, rowBottom - container.clientHeight);
    }
  }, []);

  const keepSymbolEntryInView = useCallback(
    (item: InstrumentSummary) => {
      const index = symbolItemEntryIndexMap.get(buildInstrumentKey(item.symbol, item.exchange));
      if (index === undefined) return;
      const container = symbolListRef.current;
      keepVirtualRowInView(container, index, symbolScroll.recentHeight);
      if (container) {
        setSymbolScroll((current) =>
          current.top === container.scrollTop ? current : { ...current, top: container.scrollTop },
        );
      }
    },
    [keepVirtualRowInView, symbolItemEntryIndexMap, symbolScroll.recentHeight],
  );

  const keepWatchlistItemInView = useCallback(
    (itemIndex: number) => {
      const container = watchlistListRef.current;
      keepVirtualRowInView(container, itemIndex);
      if (container) {
        setWatchlistScroll((current) =>
          current.top === container.scrollTop ? current : { ...current, top: container.scrollTop },
        );
      }
    },
    [keepVirtualRowInView],
  );

  const handleSidebarKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
        return;
      }
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (watchlistItemContextMenu) {
        return;
      }
      if (shouldKeepNativeArrowKeyBehavior(event.target)) {
        return;
      }

      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (activePanel === 'symbols') {
        if (displaySymbolBrowserItems.length === 0) {
          return;
        }

        const currentIndex = displaySymbolBrowserItems.findIndex(
          (item) => activeInstrumentKey === buildInstrumentKey(item.symbol, item.exchange),
        );
        const nextIndex =
          currentIndex === -1
            ? direction > 0
              ? 0
              : displaySymbolBrowserItems.length - 1
            : Math.max(0, Math.min(displaySymbolBrowserItems.length - 1, currentIndex + direction));
        const nextItem = displaySymbolBrowserItems[nextIndex];
        if (!nextItem || nextIndex === currentIndex) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        handleOpenInstrument(nextItem);
        keepSymbolEntryInView(nextItem);
        return;
      }

      if (activePanel === 'watchlist') {
        if (selectedWatchlistItems.length === 0) {
          return;
        }

        const currentIndex = selectedWatchlistItems.findIndex(
          (item) => activeInstrumentKey === buildInstrumentKey(item.symbol, item.exchange),
        );
        const nextIndex =
          currentIndex === -1
            ? direction > 0
              ? 0
              : selectedWatchlistItems.length - 1
            : Math.max(0, Math.min(selectedWatchlistItems.length - 1, currentIndex + direction));
        const nextItem = selectedWatchlistItems[nextIndex];
        if (!nextItem || nextIndex === currentIndex) {
          event.preventDefault();
          return;
        }

        event.preventDefault();
        handleOpenInstrument(nextItem);
        const visibleIndex = sortedWatchlistItems.findIndex(
        (item) => item.symbol === nextItem.symbol && item.exchange === nextItem.exchange,
      );
      keepWatchlistItemInView(visibleIndex);
      }
    },
    [
      activeInstrumentKey,
      activePanel,
      handleOpenInstrument,
      keepSymbolEntryInView,
      keepWatchlistItemInView,
      selectedWatchlistItems,
      sortedWatchlistItems,
      displaySymbolBrowserItems,
      watchlistItemContextMenu,
    ],
  );

  const handleWatchlistItemContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, item: InstrumentSummary) => {
      if (!selectedWatchlist) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setWatchlistItemContextMenu({
        x: event.clientX,
        y: event.clientY,
        item,
      });
    },
    [selectedWatchlist],
  );

  const handleDeleteWatchlistItem = useCallback(() => {
    if (!selectedWatchlist || !watchlistItemContextMenu) {
      return;
    }

    void removeFromWatchlist(selectedWatchlist.id, watchlistItemContextMenu.item);
    setWatchlistItemContextMenu(null);
  }, [removeFromWatchlist, selectedWatchlist, watchlistItemContextMenu]);

  const handleOpenWatchlistCreateDialog = useCallback(() => {
    setWatchlistCreateName(`Watchlist ${watchlists.length + 1}`);
    setWatchlistCreateDialogOpen(true);
  }, [watchlists.length]);

  const handleCreateWatchlist = useCallback(() => {
    const nextName = watchlistCreateName.trim();
    if (!nextName) {
      return;
    }

    void createWatchlist(nextName)
      .then(() => {
        addToast(`Created ${nextName}.`, 'success', 'Watchlists');
        setWatchlistCreateDialogOpen(false);
      })
      .catch((error) => {
        addToast(error instanceof Error ? error.message : 'Watchlist creation failed.', 'warning', 'Watchlists');
      });
  }, [addToast, createWatchlist, watchlistCreateName]);

  useEffect(() => {
    if (!watchlistItemContextMenu && !symbolContextMenu) {
      return undefined;
    }

    const closeMenu = () => {
      setWatchlistItemContextMenu(null);
      setSymbolContextMenu(null);
      setWatchlistSubmenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setWatchlistItemContextMenu(null);
        setSymbolContextMenu(null);
        setWatchlistSubmenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', closeMenu);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', closeMenu);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [watchlistItemContextMenu, symbolContextMenu]);

  useEffect(() => {
    setWatchlistItemContextMenu(null);
    setSymbolContextMenu(null);
    setWatchlistSubmenuOpen(false);
  }, [selectedWatchlistId, activePanel]);

  useEffect(() => {
    return () => {
      if (scrollIndexResetTimerRef.current !== null) {
        window.clearTimeout(scrollIndexResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      activePanel !== 'symbols' ||
      !activeDatabasePath ||
      isDatabaseTransitioning ||
      isSymbolBrowserLoading ||
      symbolBrowserLoadedDatabasePath === activeDatabasePath
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshSymbolBrowser();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [
    activeDatabasePath,
    activePanel,
    isDatabaseTransitioning,
    isSymbolBrowserLoading,
    refreshSymbolBrowser,
    symbolBrowserLoadedDatabasePath,
  ]);

  useEffect(() => {
    if (symbolListRef.current) {
      symbolListRef.current.scrollTop = 0;
      setSymbolScroll((current) => current.top === 0 ? current : { ...current, top: 0 });
    }
  }, [symbolBrowserQuery, activeDatabasePath]);

  useEffect(() => {
    if (watchlistListRef.current) {
      watchlistListRef.current.scrollTop = 0;
      setWatchlistScroll((current) => current.top === 0 ? current : { ...current, top: 0 });
    }
  }, [selectedWatchlistId]);

  return (
    <aside
      style={shellStyle(width, collapsed)}
      onKeyDown={handleSidebarKeyDown}
      onContextMenu={(event) => {
        event.preventDefault();
      }}
    >
      <div style={railStyle}>
        <button
          type="button"
          className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
          style={isClassicLightRefined ? refinedSidebarControlStyle(collapseButtonStyle()) : collapseButtonStyle()}
          onClick={onToggleCollapse}
          title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        >
          {collapsed ? '>' : '<'}
        </button>
        {SIDEBAR_PANELS.map((panel) => (
          <button
            key={panel.id}
            type="button"
            className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
            style={isClassicLightRefined ? refinedSidebarControlStyle(railButtonStyle(activePanel === panel.id), activePanel === panel.id) : railButtonStyle(activePanel === panel.id)}
            aria-pressed={isClassicLightRefined ? activePanel === panel.id : undefined}
            onClick={() => {
              setActivePanel(panel.id);
              if (collapsed) {
                onToggleCollapse();
              }
            }}
          >
            {panel.railLabel}
          </button>
        ))}

        {minimizedWindows.length > 0 ? (
          <div style={minimizedRailStackStyle}>
            <div style={railDividerStyle} />
            {minimizedWindows.map((w) => (
              <button
                key={w.id}
                type="button"
                className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
                style={isClassicLightRefined ? refinedSidebarControlStyle(minimizedRailBadgeStyle) : minimizedRailBadgeStyle}
                onClick={() => {
                  restoreWindow(w.id);
                  focusWindow(w.id);
                }}
                title={w.title}
              >
                <span style={minimizedBadgeDotStyle} />
                <span style={{ fontSize: 13, lineHeight: 1 }}>{getMinimizedWindowIcon(w.id)}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {!collapsed ? <div style={contentStyle}>
        <div style={headerStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={headerTitleStyle}>{panelTitle(activePanel)}</div>
            <div style={headerMetaStyle}>
              {dbStats
                ? `${dbStats.dbName} | ${dbStats.symbolCount} symbols`
                : isDatabaseTransitioning
                  ? 'Opening database...'
                  : activeDatabasePath
                    ? 'Connected | Loading stats...'
                  : 'No database open'}
            </div>
          </div>
          <div style={headerActionsStyle}>
            {activePanel === 'symbols' ? (
              <button
                type="button"
                className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
                style={isClassicLightRefined ? refinedSidebarControlStyle(headerIconButtonStyle(seriesSettingsOpen), seriesSettingsOpen) : headerIconButtonStyle(seriesSettingsOpen)}
                onClick={openSeriesSettings}
                title="Symbol series settings"
                aria-label="Symbol series settings"
              >
                <span style={settingsIconStyle} aria-hidden="true">
                  <span style={settingsIconLineStyle(4)} />
                  <span style={settingsIconLineStyle(10)} />
                  <span style={settingsIconLineStyle(7)} />
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
              style={isClassicLightRefined ? refinedSidebarControlStyle(pinButtonStyle(pinned), pinned) : pinButtonStyle(pinned)}
              onClick={onTogglePin}
              title={pinned ? 'Switch sidebar to click-to-hide mode' : 'Pin sidebar open'}
            >
              {pinned ? 'Pinned' : 'Auto-hide'}
            </button>
          </div>
        </div>
        {seriesSettingsOpen ? (
          <div style={settingsOverlayStyle} role="dialog" aria-modal="true" aria-label="Symbol series settings">
            <div style={seriesSettingsDialogStyle}>
              <div style={seriesSettingsHeaderStyle}>
                <strong>Series Settings</strong>
                <button
                  type="button"
                  style={seriesSettingsCloseButtonStyle}
                  onClick={() => setSeriesSettingsOpen(false)}
                  aria-label="Close symbol series settings"
                >
                  x
                </button>
              </div>
              <div style={seriesSettingsTabsStyle}>
                {SYMBOL_SERIES_SETTING_EXCHANGES.map((exchange) => (
                  <button
                    key={exchange}
                    type="button"
                    style={seriesSettingsTabButtonStyle(seriesSettingsExchange === exchange)}
                    onClick={() => setSeriesSettingsExchange(exchange)}
                  >
                    {exchange === 'all' ? 'All' : exchange}
                  </button>
                ))}
              </div>
              <div style={seriesSettingsHelpStyle}>
                Show controls which series appear in the filter menu. Default controls which series are selected when the app starts.
              </div>
              <div style={seriesSettingsTableStyle}>
                <div style={seriesSettingsTableHeaderStyle}>
                  <span>Series</span>
                  <span>Show</span>
                  <span>Default</span>
                </div>
                {seriesSettingsLoading ? (
                  <div style={seriesSettingsEmptyStyle}>Loading series...</div>
                ) : seriesSettingsOptions.length ? (
                  seriesSettingsOptions.map((option) => {
                    const visible = seriesSettingsDraft.visibleSeriesByExchange[seriesSettingsExchange].includes(option.value);
                    const selectedByDefault =
                      seriesSettingsDraft.defaultSelectedSeriesByExchange[seriesSettingsExchange].includes(option.value);
                    return (
                      <label key={option.value} style={seriesSettingsRowStyle}>
                        <span>{option.label}</span>
                        <input
                          type="checkbox"
                          checked={visible}
                          onChange={() => toggleSettingsSeriesVisible(option.value)}
                        />
                        <input
                          type="checkbox"
                          checked={selectedByDefault}
                          disabled={!visible}
                          onChange={() => toggleSettingsSeriesDefault(option.value)}
                        />
                      </label>
                    );
                  })
                ) : (
                  <div style={seriesSettingsEmptyStyle}>No series found for this exchange.</div>
                )}
              </div>
              <div style={seriesSettingsFooterStyle}>
                <button type="button" style={seriesSettingsSecondaryButtonStyle} onClick={resetSeriesSettings}>
                  Reset
                </button>
                <button type="button" style={seriesSettingsPrimaryButtonStyle} onClick={applySeriesSettings}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {activePanel === 'symbols' ? (
          <>
            <div style={exchangeSegmentStyle} aria-label="Symbol exchange filter">
              {SYMBOL_EXCHANGE_FILTER_OPTIONS.map((option) => {
                const active = symbolExchangeFilter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
                    style={isClassicLightRefined ? refinedSidebarControlStyle(exchangeSegmentButtonStyle(active), active) : exchangeSegmentButtonStyle(active)}
                    onClick={() => {
                      setSymbolExchangeFilter(option.value);
                      setSeriesFilterOpen(false);
                    }}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <div style={filterToolbarStyle}>
              <div
                style={searchBoxStyle}
                onMouseEnter={() => setSymbolSearchHovered(true)}
                onMouseLeave={() => setSymbolSearchHovered(false)}
              >
                <input
                  className="sidebar-compact-input"
                  value={symbolBrowserQuery}
                  onChange={(event) => setSymbolBrowserQuery(event.target.value)}
                  onFocus={() => setSymbolSearchFocused(true)}
                  onBlur={() => setSymbolSearchFocused(false)}
                  placeholder={symbolExchangeFilter === 'all' ? 'Search all symbols' : `Search ${symbolExchangeFilter} symbol`}
                  style={searchInputStyle}
                />
                {symbolBrowserQuery ? (
                  <button
                    type="button"
                    style={searchClearButtonStyle(symbolSearchHovered || symbolSearchFocused)}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setSymbolBrowserQuery('')}
                    aria-label="Clear symbol search"
                    title="Clear search"
                  >
                    x
                  </button>
                ) : null}
              </div>
              <div ref={seriesFilterRef} style={seriesFilterContainerStyle}>
                <button
                  type="button"
                  style={seriesFilterButtonStyle(seriesFilterOpen, symbolFiltersActive)}
                  onClick={() => setSeriesFilterOpen((open) => !open)}
                  title="Symbol filters"
                  aria-label="Symbol filters"
                  aria-expanded={seriesFilterOpen}
                >
                  <span style={filterIconStyle} aria-hidden="true">
                    <span style={filterIconLineStyle(13)} />
                    <span style={filterIconLineStyle(9)} />
                    <span style={filterIconLineStyle(5)} />
                  </span>
                </button>
                {seriesFilterOpen ? (
                  <div style={seriesFilterMenuStyle}>
                    <div style={seriesFilterMenuHeaderStyle}>
                      <span>Filters</span>
                      <button type="button" style={seriesFilterClearStyle} onClick={clearSymbolFilters}>
                        Clear
                      </button>
                    </div>
                    <div style={filterSectionStyle}>
                      <div style={filterSectionTitleStyle}>Visibility</div>
                      {lifecycleFilterOptions.map((option) => (
                        <label key={option.value} style={seriesFilterOptionStyle}>
                          <input
                            type="checkbox"
                            checked={selectedLifecycleFilters.includes(option.value)}
                            onChange={() => toggleLifecycleFilter(option.value)}
                          />
                          <span>{option.label}</span>
                          <span style={seriesFilterOptionCountStyle}>
                            {option.count || option.hint}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div style={filterSectionStyle}>
                      <div style={filterSectionTitleStyle}>Series</div>
                      {seriesFilterOptions.length ? (
                        seriesFilterOptions.map((option) => (
                          <label key={option.value} style={seriesFilterOptionStyle}>
                            <input
                              type="checkbox"
                              checked={selectedSeriesFilters.includes(option.value)}
                              onChange={() => toggleSeriesFilter(option.value)}
                            />
                            <span>{option.label}</span>
                            <span style={seriesFilterOptionCountStyle}>{option.count}</span>
                          </label>
                        ))
                      ) : (
                        <div style={seriesFilterEmptyStyle}>No series</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            <div style={sectionMetaBarStyle}>
              <span>
                {activeDatabasePath && (isSymbolBrowserLoading || symbolBrowserLoadedDatabasePath !== activeDatabasePath)
                  ? 'Loading...'
                  : `${formatSymbolBrowserCount(symbolBrowserCounts, symbolExchangeFilter)}${filterVisibility.hiddenCount > 0 ? ` · ${filterVisibility.hiddenCount} hidden` : ''}`}
              </span>
            </div>
            <div style={listFrameStyle}>
              <div style={listHeaderStyle(true)}>
                <span>Symbol</span>
                <span>{symbolExchangeFilter === 'all' ? 'Market' : 'Series'}</span>
              </div>
              <div style={symbolListBodyStyle}>
                <div
                  ref={symbolListRef}
                  className="chart-native-scrollbar"
                  style={symbolListScrollStyle}
                  onScroll={(event) => {
                    const top = event.currentTarget.scrollTop;
                    setSymbolScroll((current) => current.top === top ? current : { ...current, top });
                  }}
                >
                  {displaySymbolBrowserItems.length > 0 || visibleRecentSymbols.length > 0 ? (
                    <div style={symbolListContentStyle}>
                      {visibleRecentSymbols.length > 0 ? (
                        <div ref={recentSectionRef} style={{ marginBottom: 4 }}>
                          <div
                            style={{
                              ...groupHeaderStyle,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              paddingRight: 6,
                              cursor: 'pointer',
                              userSelect: 'none',
                            }}
                            onClick={() => setRecentSectionCollapsed((prev) => !prev)}
                            title={recentSectionCollapsed ? 'Expand recent symbols' : 'Collapse recent symbols'}
                          >
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <span style={{ fontSize: 9, color: 'var(--accent-text)', width: 10 }}>
                                {recentSectionCollapsed ? '►' : '▼'}
                              </span>
                              <span>Recent</span>
                              <span style={subgroupCountBadgeStyle}>{visibleRecentSymbols.length}</span>
                            </span>
                            <button
                              type="button"
                              style={clearRecentButtonStyle}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearRecentSymbols();
                              }}
                              title="Clear recently viewed symbols"
                            >
                              Clear
                            </button>
                          </div>
                          {!recentSectionCollapsed ? (
                            visibleRecentSymbols.map((item) => {
                              const itemKey = buildInstrumentKey(item.symbol, item.exchange);
                              return (
                                <SymbolListRow
                                  key={`recent:${itemKey}`}
                                  item={item}
                                  active={activeInstrumentKey === itemKey}
                                  showSecondary
                                  showExchangeBadge={symbolExchangeFilter === 'all'}
                                  secondaryText={formatInstrumentSeriesLabel(item, symbolExchangeFilter)}
                                  onOpenItem={handleOpenInstrument}
                                  onContextMenuItem={handleSymbolContextMenu}
                                />
                              );
                            })
                          ) : null}
                          <div style={railDividerStyle} />
                        </div>
                      ) : null}

                      {symbolRowWindow.topSpacer > 0 ? (
                        <div aria-hidden="true" style={{ height: symbolRowWindow.topSpacer, flex: '0 0 auto' }} />
                      ) : null}
                      {symbolBrowserEntries.slice(symbolRowWindow.start, symbolRowWindow.end).map((entry) => {
                        if (entry.kind === 'group') {
                          return (
                            <div
                              key={entry.key}
                              style={{
                                ...groupHeaderStyle,
                                minHeight: VIRTUAL_ROW_HEIGHT,
                                height: VIRTUAL_ROW_HEIGHT,
                              }}
                            >
                              {entry.groupKey}
                            </div>
                          );
                        }

                        const item = entry.item!;
                        const itemKey = buildInstrumentKey(item.symbol, item.exchange);
                        return (
                          <div
                            key={entry.key}
                          >
                            <SymbolListRow
                              item={item}
                              active={activeInstrumentKey === itemKey}
                              showSecondary
                              showExchangeBadge={symbolExchangeFilter === 'all'}
                              secondaryText={formatInstrumentSeriesLabel(item, symbolExchangeFilter)}
                              onOpenItem={handleOpenInstrument}
                              onContextMenuItem={handleSymbolContextMenu}
                            />
                          </div>
                        );
                      })}
                      {symbolRowWindow.bottomSpacer > 0 ? (
                        <div aria-hidden="true" style={{ height: symbolRowWindow.bottomSpacer, flex: '0 0 auto' }} />
                      ) : null}
                    </div>
                  ) : (
                    <div style={emptyStateStyle}>
                      {!activeDatabasePath
                        ? 'Open a database to browse symbols.'
                        : isDatabaseTransitioning
                          ? 'Opening database...'
                          : isSymbolBrowserLoading || symbolBrowserLoadedDatabasePath !== activeDatabasePath
                            ? 'Loading symbols...'
                            : filterVisibility.allLoadedSymbolsFilteredOut
                              ? (
                                <>
                                  <div>Loaded symbols are hidden by the current Visibility/Series filters.</div>
                                  <button
                                    type="button"
                                    style={{ ...seriesFilterClearStyle, marginTop: 6 }}
                                    onClick={() => setSeriesFilterOpen(true)}
                                  >
                                    Adjust filters
                                  </button>
                                </>
                              )
                              : 'No symbols available.'}
                    </div>
                  )}
                </div>
                <div style={scrollIndexBarStyle} onWheel={handleScrollIndexWheel}>
                  {SCROLL_INDEX.map((idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={!symbolGroupEntryIndexMap.has(idx)}
                      style={{
                        ...scrollIndexItemStyle,
                        backgroundColor: activeScrollIndex === idx ? 'var(--accent)' : 'transparent',
                        color: activeScrollIndex === idx ? 'var(--bg)' : symbolGroupEntryIndexMap.has(idx) ? 'var(--text)' : 'var(--text-dim)',
                        cursor: symbolGroupEntryIndexMap.has(idx) ? 'pointer' : 'default',
                        opacity: symbolGroupEntryIndexMap.has(idx) ? 1 : 0.45,
                      }}
                      onClick={() => handleScrollIndexClick(idx)}
                      title={symbolGroupEntryIndexMap.has(idx) ? `Jump to ${idx}` : `No ${idx} symbols`}
                    >
                      {idx}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : null}

        {activePanel === 'indicators' ? (
          <>
            <input
              className="sidebar-compact-input"
              value={indicatorQuery}
              onChange={(event) => setIndicatorQuery(event.target.value)}
              placeholder="Find indicator"
              style={compactInputStyle}
            />
            <div style={listFrameStyle}>
              <div style={listHeaderStyle(false)}>
                <span>Indicator</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {filteredCatalog.length} of {INDICATOR_CATALOG.length}
                </span>
              </div>
              <div className="chart-native-scrollbar" style={denseListStyle}>
                {favoriteIndicators.length > 0 && !indicatorQuery.trim() ? (
                  <div style={{ marginBottom: 8 }}>
                    <button
                      type="button"
                      style={subgroupHeaderButtonStyle}
                      onClick={toggleFavoritesCollapse}
                      title={favoritesCollapsed ? 'Expand Favorites' : 'Collapse Favorites'}
                    >
                      <span style={{ fontSize: 9, width: 10, color: 'var(--accent-text)', userSelect: 'none' }}>
                        {favoritesCollapsed ? '►' : '▼'}
                      </span>
                      <span style={{ flex: 1, fontWeight: 600 }}>★ Favorites</span>
                      <span style={subgroupCountBadgeStyle}>{favoriteIndicators.length}</span>
                    </button>
                    {!favoritesCollapsed ? (
                      <div style={{ paddingLeft: 4, marginTop: 2 }}>
                        {favoriteIndicators.map((item) => renderIndicatorRow(item))}
                      </div>
                    ) : null}
                    <div style={railDividerStyle} />
                  </div>
                ) : null}

                {overlaySubgroups.length > 0 ? (
                  <>
                    <div style={mainPlacementHeaderStyle}>
                      <span>Price</span>
                      <span style={subgroupCountBadgeStyle}>{overlayIndicators.length}</span>
                    </div>
                    {overlaySubgroups.map((group) => {
                      const isCollapsed = Boolean(collapsedSubcategories[group.id]) && !indicatorQuery.trim();
                      return (
                        <div key={group.id} style={{ marginBottom: 6 }}>
                          <button
                            type="button"
                            style={subgroupHeaderButtonStyle}
                            onClick={() => toggleSubcategoryCollapse(group.id)}
                            title={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                          >
                            <span style={{ fontSize: 9, width: 10, color: 'var(--accent-text)', userSelect: 'none' }}>
                              {isCollapsed ? '►' : '▼'}
                            </span>
                            <span style={{ flex: 1, fontWeight: 600 }}>{group.label}</span>
                            <span style={subgroupCountBadgeStyle}>{group.items.length}</span>
                          </button>

                          {!isCollapsed ? (
                            <div style={{ paddingLeft: 4, marginTop: 2 }}>
                              {group.items.map((item) => renderIndicatorRow(item))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : null}

                {paneSubgroups.length > 0 ? (
                  <>
                    <div style={{ ...mainPlacementHeaderStyle, marginTop: overlaySubgroups.length > 0 ? 10 : 0 }}>
                      <span>Pane</span>
                      <span style={subgroupCountBadgeStyle}>{paneIndicators.length}</span>
                    </div>
                    {paneSubgroups.map((group) => {
                      const isCollapsed = Boolean(collapsedSubcategories[group.id]) && !indicatorQuery.trim();
                      return (
                        <div key={group.id} style={{ marginBottom: 6 }}>
                          <button
                            type="button"
                            style={subgroupHeaderButtonStyle}
                            onClick={() => toggleSubcategoryCollapse(group.id)}
                            title={isCollapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                          >
                            <span style={{ fontSize: 9, width: 10, color: 'var(--accent-text)', userSelect: 'none' }}>
                              {isCollapsed ? '►' : '▼'}
                            </span>
                            <span style={{ flex: 1, fontWeight: 600 }}>{group.label}</span>
                            <span style={subgroupCountBadgeStyle}>{group.items.length}</span>
                          </button>

                          {!isCollapsed ? (
                            <div style={{ paddingLeft: 4, marginTop: 2 }}>
                              {group.items.map((item) => renderIndicatorRow(item))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </>
                ) : null}

                {!overlaySubgroups.length && !paneSubgroups.length ? (
                  <div style={emptyStateStyle}>No indicators matching "{indicatorQuery}".</div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {activePanel === 'watchlist' ? (
          <>
            <div style={watchlistControlBlockStyle}>
              <div style={watchlistToolbarStyle}>
                <button
                  type="button"
                  className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
                  style={isClassicLightRefined ? refinedSidebarControlStyle(actionButtonStyle(hasActiveDatabase, false)) : actionButtonStyle(hasActiveDatabase, false)}
                  title={hasActiveDatabase ? 'Create a new watchlist' : 'Open a database to create a watchlist'}
                  onClick={() => {
                    if (!hasActiveDatabase) {
                      return;
                    }
                    handleOpenWatchlistCreateDialog();
                  }}
                  disabled={!hasActiveDatabase}
                >
                  New
                </button>
                <button
                  type="button"
                  className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
                  style={isClassicLightRefined ? refinedSidebarControlStyle(actionButtonStyle(hasActiveDatabase && selectedSourceLinkedWatchlist, true), hasActiveDatabase && selectedSourceLinkedWatchlist) : actionButtonStyle(hasActiveDatabase && selectedSourceLinkedWatchlist, true)}
                  title={
                    selectedSourceLinkedWatchlist
                      ? `Update ${selectedWatchlist?.name ?? 'watchlist'} from source${lastSyncedDisplay ? ` (Last synced: ${lastSyncedDisplay})` : ''}`
                      : 'Select an imported source-linked watchlist to update'
                  }
                  onClick={() => {
                    if (!hasActiveDatabase || !selectedWatchlist || !selectedSourceLinkedWatchlist) {
                      return;
                    }

                    void updateOfficialWatchlist(selectedWatchlist.id).catch((error) => {
                      const message =
                        error instanceof Error
                          ? error.message
                          : 'Watchlist update failed.';
                      console.error('[official-watchlist-update] failed', {
                        watchlistId: selectedWatchlist.id,
                        message,
                      });
                      addToast(message, 'warning', 'Watchlists');
                    });
                  }}
                  disabled={!hasActiveDatabase || !selectedSourceLinkedWatchlist}
                >
                  Update
                </button>
                <button
                  type="button"
                  className={isClassicLightRefined ? 'eod-refined-sidebar-control' : undefined}
                  style={isClassicLightRefined ? refinedSidebarControlStyle(actionButtonStyle(Boolean(selectedWatchlistItems.length), watchlistSortOrder !== 'default'), watchlistSortOrder !== 'default') : actionButtonStyle(Boolean(selectedWatchlistItems.length), watchlistSortOrder !== 'default')}
                  title={watchlistSortOrder === 'default' ? 'Sort symbols A-Z' : watchlistSortOrder === 'asc' ? 'Sort symbols Z-A' : 'Reset to default order'}
                  onClick={() => setWatchlistSortOrder((prev) => (prev === 'default' ? 'asc' : prev === 'asc' ? 'desc' : 'default'))}
                  disabled={!selectedWatchlistItems.length}
                >
                  {watchlistSortOrder === 'asc' ? 'AZ ▾' : watchlistSortOrder === 'desc' ? 'ZA ▴' : 'Sort'}
                </button>
              </div>
              <select
                className="sidebar-compact-input"
                value={selectedWatchlistId ?? ''}
                onChange={(event) => selectWatchlist(event.target.value ? Number(event.target.value) : null)}
                style={{ ...compactInputStyle, width: '100%' }}
              >
                <option value="">Select watchlist</option>
                {watchlists.map((watchlist) => (
                  <option key={watchlist.id} value={watchlist.id}>
                    {formatSidebarWatchlistLabel(watchlist)}
                  </option>
                ))}
              </select>
              {selectedWatchlist && hasActiveDatabase ? (
                <div style={{ position: 'relative', marginTop: 6, marginBottom: 4 }}>
                  <input
                    className="sidebar-compact-input"
                    value={watchlistQuickAddQuery}
                    onChange={(e) => setWatchlistQuickAddQuery(e.target.value)}
                    placeholder="+ Add symbol to watchlist..."
                    style={{ ...compactInputStyle, width: '100%', paddingRight: watchlistQuickAddQuery ? 22 : 6 }}
                  />
                  {watchlistQuickAddQuery ? (
                    <button
                      type="button"
                      style={searchClearButtonStyle(true)}
                      onClick={() => setWatchlistQuickAddQuery('')}
                      title="Clear quick add"
                    >
                      x
                    </button>
                  ) : null}
                  {watchlistQuickAddMatches.length > 0 ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg2)',
                        border: '1px solid var(--border2)',
                        borderRadius: 4,
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 35,
                        marginTop: 2,
                        maxHeight: 180,
                        overflowY: 'auto',
                        padding: 2,
                      }}
                    >
                      {watchlistQuickAddMatches.map((match) => (
                        <button
                          key={`${match.exchange}:${match.symbol}`}
                          type="button"
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            border: 'none',
                            background: 'transparent',
                            color: 'var(--text)',
                            cursor: 'pointer',
                            fontSize: 11,
                            borderRadius: 3,
                            textAlign: 'left',
                          }}
                          onClick={() => {
                            void addToWatchlist(selectedWatchlist.id, {
                              symbol: match.symbol,
                              exchange: match.exchange,
                            }).then(() => {
                              addToast(`Added ${match.symbol} to ${selectedWatchlist.name}.`, 'success', 'Watchlists');
                              setWatchlistQuickAddQuery('');
                            });
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>{match.symbol}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                            {match.exchange} {match.series || ''}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div style={listFrameStyle}>
              <div style={listHeaderStyle(false)}>
                <span>Symbol</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
                  {sortedWatchlistItems.length} {sortedWatchlistItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <div
                ref={watchlistListRef}
                className="chart-native-scrollbar"
                style={symbolListScrollStyle}
                onScroll={(event) => {
                  const top = event.currentTarget.scrollTop;
                  setWatchlistScroll((current) => current.top === top ? current : { ...current, top });
                }}
              >
                {sortedWatchlistItems.length ? (
                  <div style={symbolListContentStyle}>
                    {watchlistRowWindow.topSpacer > 0 ? (
                      <div aria-hidden="true" style={{ height: watchlistRowWindow.topSpacer, flex: '0 0 auto' }} />
                    ) : null}
                    {sortedWatchlistItems.slice(watchlistRowWindow.start, watchlistRowWindow.end).map((item) => (
                      <div key={`${item.exchange}:${item.symbol}`}>
                        <SymbolListRow
                          item={item as InstrumentSummary}
                          active={activeInstrumentKey === buildInstrumentKey(item.symbol, item.exchange)}
                          showSecondary={false}
                          onOpenItem={handleOpenInstrument}
                          onContextMenuItem={handleWatchlistItemContextMenu}
                        />
                      </div>
                    ))}
                    {watchlistRowWindow.bottomSpacer > 0 ? (
                      <div aria-hidden="true" style={{ height: watchlistRowWindow.bottomSpacer, flex: '0 0 auto' }} />
                    ) : null}
                  </div>
                ) : (
                  <div style={emptyStateStyle}>No symbols in the selected watchlist.</div>
                )}
              </div>
            </div>
            <div style={watchlistMenuHintStyle}>Right-click a symbol for options or to delete it.</div>
          </>
        ) : null}
        {activePanel === 'market-movers' ? (
          <MarketMoversPanel />
        ) : null}
      </div> : null}
      {!collapsed && activePanel === 'watchlist' && watchlistItemContextMenu && selectedWatchlist ? (
        <div
          style={{ ...symbolContextMenuStyle, left: watchlistItemContextMenu.x, top: watchlistItemContextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              handleOpenInstrument(watchlistItemContextMenu.item);
              setWatchlistItemContextMenu(null);
            }}
          >
            Open Chart
          </button>
          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              createChartTab();
              void loadInstrument(
                { symbol: watchlistItemContextMenu.item.symbol, exchange: watchlistItemContextMenu.item.exchange },
                watchlistItemContextMenu.item,
              );
              setWatchlistItemContextMenu(null);
              addToast(`Opened ${watchlistItemContextMenu.item.symbol} in new tab.`, 'info', 'Chart');
            }}
          >
            Open in New Tab
          </button>

          {watchlists.length > 0 ? (
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setWatchlistSubmenuOpen(true)}
              onMouseLeave={() => setWatchlistSubmenuOpen(false)}
            >
              <button
                type="button"
                style={{ ...contextMenuButtonStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setWatchlistSubmenuOpen((open) => !open)}
              >
                <span>Add to Watchlist</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>▶</span>
              </button>
              {watchlistSubmenuOpen ? (
                <div style={watchlistSubmenuStyle}>
                  <div style={watchlistSubmenuInnerStyle}>
                    {watchlists.map((wl) => (
                      <button
                        key={wl.id}
                        type="button"
                        style={contextMenuButtonStyle}
                        onClick={() => {
                          void addToWatchlist(wl.id, {
                            symbol: watchlistItemContextMenu.item.symbol,
                            exchange: watchlistItemContextMenu.item.exchange,
                          }).then(() => {
                            addToast(`Added ${watchlistItemContextMenu.item.symbol} to ${wl.name}.`, 'success', 'Watchlists');
                            setWatchlistItemContextMenu(null);
                          });
                        }}
                      >
                        {wl.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={contextMenuDividerStyle} />
          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              void navigator.clipboard.writeText(watchlistItemContextMenu.item.symbol);
              addToast(`Copied ${watchlistItemContextMenu.item.symbol} to clipboard.`, 'info', 'Watchlists');
              setWatchlistItemContextMenu(null);
            }}
          >
            Copy Symbol
          </button>
          {watchlistItemContextMenu.item.isin ? (
            <button
              type="button"
              style={contextMenuButtonStyle}
              onClick={() => {
                void navigator.clipboard.writeText(watchlistItemContextMenu.item.isin!);
                addToast(`Copied ISIN ${watchlistItemContextMenu.item.isin} to clipboard.`, 'info', 'Watchlists');
                setWatchlistItemContextMenu(null);
              }}
            >
              Copy ISIN
            </button>
          ) : null}
          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              openQuoteEditor();
              setWatchlistItemContextMenu(null);
            }}
          >
            Edit Quotations
          </button>
          <div style={contextMenuDividerStyle} />
          <button
            type="button"
            style={{ ...contextMenuButtonStyle, color: 'var(--red-text)' }}
            onClick={handleDeleteWatchlistItem}
          >
            Delete from Watchlist
          </button>
        </div>
      ) : null}
      {!collapsed && activePanel === 'symbols' && symbolContextMenu ? (
        <div
          style={{ ...symbolContextMenuStyle, left: symbolContextMenu.x, top: symbolContextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              handleOpenInstrument(symbolContextMenu.item);
              setSymbolContextMenu(null);
            }}
          >
            Open Chart
          </button>
          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              createChartTab();
              void loadInstrument(
                { symbol: symbolContextMenu.item.symbol, exchange: symbolContextMenu.item.exchange },
                symbolContextMenu.item,
              );
              setSymbolContextMenu(null);
              addToast(`Opened ${symbolContextMenu.item.symbol} in new tab.`, 'info', 'Chart');
            }}
          >
            Open in New Tab
          </button>

          {watchlists.length > 0 ? (
            <div
              style={{ position: 'relative' }}
              onMouseEnter={() => setWatchlistSubmenuOpen(true)}
              onMouseLeave={() => setWatchlistSubmenuOpen(false)}
            >
              <button
                type="button"
                style={{ ...contextMenuButtonStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onClick={() => setWatchlistSubmenuOpen((open) => !open)}
              >
                <span>Add to Watchlist</span>
                <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>▶</span>
              </button>
              {watchlistSubmenuOpen ? (
                <div style={watchlistSubmenuStyle}>
                  <div style={watchlistSubmenuInnerStyle}>
                    {watchlists.map((wl) => (
                      <button
                        key={wl.id}
                        type="button"
                        style={contextMenuButtonStyle}
                        onClick={() => {
                          void addToWatchlist(wl.id, {
                            symbol: symbolContextMenu.item.symbol,
                            exchange: symbolContextMenu.item.exchange,
                          }).then(() => {
                            addToast(`Added ${symbolContextMenu.item.symbol} to ${wl.name}.`, 'success', 'Watchlists');
                            setSymbolContextMenu(null);
                          });
                        }}
                      >
                        {wl.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div style={contextMenuDividerStyle} />

          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              void navigator.clipboard.writeText(symbolContextMenu.item.symbol);
              addToast(`Copied ${symbolContextMenu.item.symbol} to clipboard.`, 'info', 'Symbols');
              setSymbolContextMenu(null);
            }}
          >
            Copy Symbol
          </button>

          {symbolContextMenu.item.isin ? (
            <button
              type="button"
              style={contextMenuButtonStyle}
              onClick={() => {
                void navigator.clipboard.writeText(symbolContextMenu.item.isin!);
                addToast(`Copied ISIN ${symbolContextMenu.item.isin} to clipboard.`, 'info', 'Symbols');
                setSymbolContextMenu(null);
              }}
            >
              Copy ISIN
            </button>
          ) : null}

          <button
            type="button"
            style={contextMenuButtonStyle}
            onClick={() => {
              openQuoteEditor();
              setSymbolContextMenu(null);
            }}
          >
            Edit Quotations
          </button>
        </div>
      ) : null}
      {watchlistCreateDialogOpen ? (
        <WatchlistNameDialog
          title="New Watchlist"
          label="Watchlist name"
          value={watchlistCreateName}
          confirmLabel="Create"
          onChange={setWatchlistCreateName}
          onConfirm={handleCreateWatchlist}
          onCancel={() => setWatchlistCreateDialogOpen(false)}
        />
      ) : null}
    </aside>
  );
}

function buildInstrumentKey(symbol: string, exchange: string): string {
  return `${exchange}:${symbol}`;
}

function formatSidebarWatchlistLabel(watchlist: Watchlist): string {
  const sourceMeta = watchlist.sourceMeta;
  if (!sourceMeta || sourceMeta.sourceType !== 'official') {
    return watchlist.name;
  }

  const exchangeInitial = sourceMeta.sourceExchange.trim().charAt(0).toUpperCase() || '?';
  const displayName = sourceMeta.sourceDisplayName?.trim();
  if (!displayName) {
    return watchlist.name;
  }

  return `${exchangeInitial} - ${displayName}`;
}

const SymbolListRow = memo(function SymbolListRow({
  item,
  active,
  onOpenItem,
  onAddItem,
  addLabel = '+',
  showSecondary = true,
  showExchangeBadge,
  secondaryText,
  onContextMenuItem,
}: {
  item: InstrumentSummary;
  active: boolean;
  onOpenItem: (item: InstrumentSummary) => void;
  onAddItem?: (item: InstrumentSummary) => void;
  addLabel?: string;
  showSecondary?: boolean;
  showExchangeBadge?: boolean;
  secondaryText?: string;
  onContextMenuItem?: (event: React.MouseEvent<HTMLDivElement>, item: InstrumentSummary) => void;
}) {
  const handleOpen = useCallback(() => {
    onOpenItem(item);
  }, [item, onOpenItem]);

  const handleAdd = useCallback(() => {
    onAddItem?.(item);
  }, [item, onAddItem]);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      onContextMenuItem?.(event, item);
    },
    [item, onContextMenuItem],
  );

  const shouldShowExchangeBadge = showExchangeBadge ?? true;
  const tooltipText = `${item.symbol} — ${item.name || item.symbol} | ${item.exchange} ${item.series || ''}${item.isin ? ` | ISIN: ${item.isin}` : ''}`;

  return (
    <div
      className="sidebar-row-shell"
      data-active={active}
      style={rowShellStyle(active, Boolean(onAddItem))}
      onContextMenu={handleContextMenu}
    >
      <button
        type="button"
        style={rowButtonStyle(showSecondary)}
        onClick={handleOpen}
        onDoubleClick={handleOpen}
        title={tooltipText}
      >
        <span style={rowPrimaryCellStyle}>
          <span style={rowPrimaryTextStyle}>{item.symbol}</span>
          {shouldShowExchangeBadge ? <span style={exchangeBadgeStyle}>{item.exchange}</span> : null}
        </span>
        {showSecondary ? (
          <span style={rowSecondaryTextStyle}>
            {secondaryText ?? item.name ?? item.exchange}
          </span>
        ) : null}
      </button>
      {onAddItem ? (
        <button type="button" style={rowActionButtonStyle} onClick={handleAdd}>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
});

function formatInstrumentSeriesLabel(item: InstrumentSummary, exchangeFilter: SymbolExchangeFilter): string {
  const series = item.series?.trim();
  if (exchangeFilter === 'all') {
    return series ? `${item.exchange} ${series}` : item.exchange;
  }
  if (series) {
    return series;
  }
  return item.exchange.toUpperCase().endsWith('_INDEX') ? 'INDEX' : '-';
}

interface SeriesFilterOption {
  value: string;
  label: string;
  count: number;
}

function buildSeriesFilterOptions(
  items: InstrumentSummary[],
  selectedSeries: string[],
  visibleSeries: string[] | null,
): SeriesFilterOption[] {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const value = normalizeSeriesValue(item.series);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  selectedSeries.forEach((value) => {
    if (!counts.has(value)) {
      counts.set(value, 0);
    }
  });

  const visible = visibleSeries ? new Set(visibleSeries) : null;
  const selected = new Set(selectedSeries);

  return Array.from(counts.entries())
    .filter(([value]) => !visible || visible.has(value) || selected.has(value))
    .sort(([left], [right]) => compareSeriesValues(left, right))
    .map(([value, count]) => ({
      value,
      label: formatSeriesLabel(value),
      count,
    }));
}

function getVisibleSeriesForExchange(
  preferences: SymbolSeriesPreferences,
  exchange: SymbolExchangeFilter,
): string[] | null {
  const configured = preferences.visibleSeriesByExchange[exchange];
  return configured ? normalizeSeriesList(configured) : null;
}

function buildSeriesSettingsOptions(
  items: InstrumentSummary[],
  exchange: SymbolExchangeFilter,
  draft: SymbolSeriesSettingsDraft,
): SeriesFilterOption[] {
  const counts = new Map<string, number>();
  filterSymbolBrowserItemsByExchange(items, exchange).forEach((item) => {
    const value = normalizeSeriesValue(item.series);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  draft.visibleSeriesByExchange[exchange].forEach((value) => {
    if (!counts.has(value)) {
      counts.set(value, 0);
    }
  });
  draft.defaultSelectedSeriesByExchange[exchange].forEach((value) => {
    if (!counts.has(value)) {
      counts.set(value, 0);
    }
  });

  return Array.from(counts.entries())
    .sort(([left], [right]) => compareSeriesValues(left, right))
    .map(([value, count]) => ({
      value,
      label: `${formatSeriesLabel(value)}${count ? ` (${count})` : ''}`,
      count,
    }));
}

function filterSymbolBrowserItemsBySeries(
  items: InstrumentSummary[],
  selectedSeries: string[],
): InstrumentSummary[] {
  if (selectedSeries.length === 0) {
    return items;
  }

  const selected = new Set(selectedSeries);
  return items.filter((item) => selected.has(normalizeSeriesValue(item.series)));
}

function filterSymbolBrowserItemsByExchange(
  items: InstrumentSummary[],
  exchangeFilter: SymbolExchangeFilter,
): InstrumentSummary[] {
  if (exchangeFilter === 'all') {
    return items;
  }

  return items.filter((item) => exchangeMatchesFilter(item.exchange, exchangeFilter));
}

function buildLifecycleFilterOptions(items: InstrumentSummary[]): LifecycleFilterOption[] {
  const counts = new Map<SymbolLifecycleFilter, number>();
  items.forEach((item) => {
    const status = normalizeLifecycleStatus(item);
    if (status !== 'CURRENT') {
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
  });

  return SYMBOL_LIFECYCLE_FILTER_OPTIONS.map((option) => ({
    ...option,
    count: counts.get(option.value) ?? 0,
  }));
}

function filterSymbolBrowserItemsByLifecycle(
  items: InstrumentSummary[],
  selectedLifecycleFilters: SymbolLifecycleFilter[],
): InstrumentSummary[] {
  const selected = new Set(selectedLifecycleFilters);
  return items.filter((item) => {
    const status = normalizeLifecycleStatus(item);
    if (selected.size === 0) {
      return status === 'CURRENT';
    }
    if (status === 'CURRENT') {
      return false;
    }
    return selected.has(status);
  });
}

function normalizeLifecycleStatus(item: InstrumentSummary): 'CURRENT' | SymbolLifecycleFilter {
  const raw = item.lifecycleStatus?.trim().toUpperCase();
  if (raw === 'OLD_SYMBOL' || raw === 'DELISTED' || raw === 'SUSPENDED' || raw === 'UNKNOWN_INACTIVE') {
    return raw;
  }
  return item.isActive === false ? 'UNKNOWN_INACTIVE' : 'CURRENT';
}

function normalizeSeriesValue(series: string | null | undefined): string {
  const trimmed = series?.trim();
  return trimmed ? trimmed.toUpperCase() : 'NO_SERIES';
}

function formatSeriesLabel(series: string): string {
  return series === 'NO_SERIES' ? 'No series' : series;
}

function compareSeriesValues(left: string, right: string): number {
  if (left === 'NO_SERIES') {
    return 1;
  }
  if (right === 'NO_SERIES') {
    return -1;
  }
  return left.localeCompare(right);
}

interface SymbolExchangeCounts {
  total: number;
  nse: number;
  bse: number;
}

function countSymbolsByExchange(items: InstrumentSummary[]): SymbolExchangeCounts {
  return items.reduce<SymbolExchangeCounts>(
    (counts, item) => {
      const exchange = item.exchange.toUpperCase();
      return {
        total: counts.total + 1,
        nse: counts.nse + (isNseFamilyExchange(exchange) ? 1 : 0),
        bse: counts.bse + (isBseFamilyExchange(exchange) ? 1 : 0),
      };
    },
    { total: 0, nse: 0, bse: 0 },
  );
}

function formatSymbolBrowserCount(counts: SymbolExchangeCounts, exchangeFilter: SymbolExchangeFilter): string {
  if (exchangeFilter === 'all') {
    return `NSE ${counts.nse.toLocaleString()} | BSE ${counts.bse.toLocaleString()}`;
  }
  return `${counts.total.toLocaleString()} ${exchangeFilter} rows`;
}

function orderSymbolBrowserItems(
  items: InstrumentSummary[],
  exchangeFilter: SymbolExchangeFilter,
): InstrumentSummary[] {
  if (exchangeFilter !== 'all') {
    return items;
  }

  return [...items].sort((left, right) => {
    const leftExchangeRank = exchangeSortRank(left.exchange);
    const rightExchangeRank = exchangeSortRank(right.exchange);
    if (leftExchangeRank !== rightExchangeRank) {
      return leftExchangeRank - rightExchangeRank;
    }
    return left.symbol.localeCompare(right.symbol);
  });
}

function exchangeSortRank(exchange: string): number {
  const normalizedExchange = exchange.toUpperCase();
  if (isNseFamilyExchange(normalizedExchange)) {
    return 0;
  }
  if (isBseFamilyExchange(normalizedExchange)) {
    return 1;
  }
  return 2;
}

function exchangeMatchesFilter(exchange: string, exchangeFilter: SymbolExchangeFilter): boolean {
  const normalizedExchange = exchange.toUpperCase();
  if (exchangeFilter === 'NSE') {
    return isNseFamilyExchange(normalizedExchange);
  }
  if (exchangeFilter === 'BSE') {
    return isBseFamilyExchange(normalizedExchange);
  }
  return true;
}

function isNseFamilyExchange(exchange: string): boolean {
  return exchange === 'NSE' || exchange === 'NSE_INDEX';
}

function isBseFamilyExchange(exchange: string): boolean {
  return exchange === 'BSE' || exchange === 'BSE_INDEX';
}

function shouldKeepNativeArrowKeyBehavior(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return tagName === 'select' || tagName === 'textarea' || target.isContentEditable;
}

function normalizeWheelDelta(deltaY: number, deltaMode: number, viewportHeight: number): number {
  if (deltaMode === 1) {
    return deltaY * 16;
  }

  if (deltaMode === 2) {
    return deltaY * Math.max(viewportHeight, 320);
  }

  return deltaY;
}

function panelTitle(panel: SidebarPanel): string {
  if (panel === 'symbols') return 'Symbols';
  if (panel === 'indicators') return 'Indicators';
  if (panel === 'watchlist') return 'Watchlists';
  if (panel === 'market-movers') return 'Market Movers';
  return 'Panel';
}

function shellStyle(width: number, collapsed: boolean): React.CSSProperties {
  return {
    width: collapsed ? SIDEBAR_RAIL_WIDTH : width,
    minWidth: collapsed ? SIDEBAR_RAIL_WIDTH : width,
    display: 'grid',
    gridTemplateColumns: collapsed ? `${SIDEBAR_RAIL_WIDTH}px` : `${SIDEBAR_RAIL_WIDTH}px minmax(0, 1fr)`,
    borderRight: '1px solid var(--border)',
    background: 'var(--bg)',
    overflow: 'hidden',
  };
}

const railStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 6,
  padding: '8px 4px',
  borderRight: '1px solid var(--border)',
  background: 'var(--bg2)',
  height: '100%',
  minHeight: 0,
};

const minimizedRailStackStyle: React.CSSProperties = {
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  paddingTop: 8,
};

const railDividerStyle: React.CSSProperties = {
  width: '100%',
  height: 1,
  backgroundColor: 'var(--border2)',
  marginBottom: 2,
};

const minimizedRailBadgeStyle: React.CSSProperties = {
  width: 26,
  height: 26,
  borderRadius: 6,
  border: '1px solid var(--border2)',
  backgroundColor: 'var(--bg3)',
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  position: 'relative',
  padding: 0,
  transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
};

const minimizedBadgeDotStyle: React.CSSProperties = {
  position: 'absolute',
  top: 2,
  right: 2,
  width: 5,
  height: 5,
  borderRadius: '50%',
  backgroundColor: 'var(--accent)',
};

/** Only the optional Refined theme uses this presentation wrapper. */
function refinedSidebarControlStyle(base: React.CSSProperties, active = false): React.CSSProperties {
  return {
    ...base,
    border: '1px solid transparent',
    borderLeft: active ? '2px solid var(--accent)' : '1px solid transparent',
    background: active ? 'var(--accent-soft)' : 'var(--eod-refined-sidebar-idle-bg, transparent)',
    borderRadius: 4,
  };
}

function collapseButtonStyle(): React.CSSProperties {
  return {
    height: 29,
    border: '1px solid var(--border2)',
    background: 'var(--bg3)',
    color: 'var(--text-dim)',
    borderRadius: 'var(--control-radius)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
  };
}

function railButtonStyle(active: boolean): React.CSSProperties {
  return {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    height: 72,
    padding: '8px 0',
    border: '1px solid var(--border2)',
    background: active ? 'var(--accent-soft)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    borderRadius: 'var(--control-radius)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  };
}

const contentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  minHeight: 0,
  flex: 1,
  overflow: 'hidden',
  padding: '8px 8px 10px',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minHeight: 34,
};

const headerTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 15,
  fontWeight: 700,
};

const headerMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const headerActionsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexShrink: 0,
};

function headerIconButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 26,
    width: 28,
    padding: 0,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    borderRadius: 4,
    background: active ? 'var(--accent-soft)' : 'var(--bg3)',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const settingsIconStyle: React.CSSProperties = {
  width: 15,
  height: 15,
  display: 'inline-flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: 3,
};

function settingsIconLineStyle(knobLeft: number): React.CSSProperties {
  return {
    position: 'relative',
    height: 2,
    borderRadius: 1,
    background: 'currentColor',
    ['--knob-left' as string]: `${knobLeft}px`,
  };
}

function pinButtonStyle(pinned: boolean): React.CSSProperties {
  return {
    height: 26,
    padding: '0 10px',
    border: '1px solid var(--border2)',
    borderRadius: 4,
    background: pinned ? 'var(--accent-soft)' : 'var(--bg3)',
    color: pinned ? 'var(--text)' : 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

const compactInputStyle: React.CSSProperties = {
  height: 28,
  border: '1px solid var(--border2)',
  background: 'var(--bg2)',
  color: 'var(--text)',
  borderRadius: 4,
  padding: '0 9px',
  fontSize: 12,
};

const exchangeSegmentStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 4,
  minHeight: 28,
  minWidth: 0,
};

function exchangeSegmentButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 28,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border2)'}`,
    background: active ? 'var(--accent-soft)' : 'var(--bg3)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  };
}

const settingsOverlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'flex-start',
  padding: '86px 0 0 44px',
  background: 'var(--overlay-bg)',
};

const seriesSettingsDialogStyle: React.CSSProperties = {
  width: 300,
  maxHeight: 'min(520px, calc(100vh - 110px))',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 10,
  border: '1px solid var(--border2)',
  borderRadius: 8,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  overflow: 'hidden',
};

const seriesSettingsHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  color: 'var(--text)',
  fontSize: 13,
};

const seriesSettingsCloseButtonStyle: React.CSSProperties = {
  height: 24,
  width: 26,
  padding: 0,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
};

const seriesSettingsTabsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 4,
};

function seriesSettingsTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    ...exchangeSegmentButtonStyle(active),
    height: 26,
    fontSize: 11,
  };
}

const seriesSettingsHelpStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.35,
};

const seriesSettingsTableStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'auto',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
};

const seriesSettingsTableHeaderStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 58px 64px',
  gap: 6,
  alignItems: 'center',
  padding: '6px 8px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
};

const seriesSettingsRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 58px 64px',
  gap: 6,
  alignItems: 'center',
  minHeight: 28,
  padding: '4px 8px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text)',
  fontSize: 12,
};

const seriesSettingsEmptyStyle: React.CSSProperties = {
  padding: 10,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const seriesSettingsFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
};

const seriesSettingsSecondaryButtonStyle: React.CSSProperties = {
  height: 26,
  padding: '0 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
};

const seriesSettingsPrimaryButtonStyle: React.CSSProperties = {
  ...seriesSettingsSecondaryButtonStyle,
  borderColor: 'var(--accent)',
  background: 'var(--accent-soft)',
  color: 'var(--text)',
};

const filterToolbarStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 6,
  minWidth: 0,
};

const searchBoxStyle: React.CSSProperties = {
  position: 'relative',
  minWidth: 0,
};

const searchInputStyle: React.CSSProperties = {
  ...compactInputStyle,
  width: '100%',
  boxSizing: 'border-box',
  paddingRight: 28,
};

function searchClearButtonStyle(visible: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    border: 0,
    borderRadius: 3,
    background: 'var(--bg4)',
    color: 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: 11,
    lineHeight: '20px',
    padding: 0,
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: 'opacity 0.12s ease',
  };
}

const seriesFilterContainerStyle: React.CSSProperties = {
  position: 'relative',
  flex: '0 0 auto',
};

function seriesFilterButtonStyle(open: boolean, active: boolean): React.CSSProperties {
  return {
    height: 28,
    width: 34,
    padding: 0,
    border: `1px solid ${open || active ? 'var(--accent)' : 'var(--border2)'}`,
    background: open || active ? 'var(--accent-soft)' : 'var(--bg3)',
    color: 'var(--text)',
    borderRadius: 4,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };
}

const seriesFilterMenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: 32,
  right: 0,
  width: 150,
  maxHeight: 240,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: 6,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 30,
  overflowY: 'auto',
};

const seriesFilterMenuHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 6,
  padding: '2px 4px 5px',
  borderBottom: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
};

const filterSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '4px 4px 5px',
  borderBottom: '1px solid var(--border)',
};

const filterSectionTitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
};

const seriesFilterClearStyle: React.CSSProperties = {
  border: 0,
  background: 'transparent',
  color: 'var(--accent-text)',
  cursor: 'pointer',
  fontSize: 11,
  padding: 0,
};

const filterIconStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  display: 'inline-flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
};

function filterIconLineStyle(width: number): React.CSSProperties {
  return {
    width,
    height: 2,
    borderRadius: 1,
    background: 'currentColor',
  };
}

const seriesFilterOptionStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '16px minmax(0, 1fr) auto',
  alignItems: 'center',
  gap: 6,
  minHeight: 24,
  color: 'var(--text)',
  fontSize: 12,
  cursor: 'pointer',
};

const seriesFilterOptionCountStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
};

const seriesFilterEmptyStyle: React.CSSProperties = {
  padding: '6px 4px',
  color: 'var(--text-dim)',
  fontSize: 11,
};

const sectionMetaBarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  color: 'var(--text-dim)',
  fontSize: 11,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
};

const listFrameStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  flex: 1,
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  overflow: 'hidden',
};

const symbolListBodyStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
  gap: 2,
  minWidth: 0,
  overflow: 'hidden',
};

const groupHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '3px 7px',
  backgroundColor: 'var(--bg3)',
  color: 'var(--accent-text)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border)',
  zIndex: 1,
};

const scrollIndexBarStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  flex: '0 0 18px',
  width: 18,
  minHeight: 0,
  alignSelf: 'stretch',
  padding: '2px 1px',
  backgroundColor: 'var(--bg)',
  borderLeft: '1px solid var(--border)',
  gap: 0,
  userSelect: 'none',
  justifyContent: 'space-between',
  overscrollBehavior: 'contain',
};

const scrollIndexItemStyle: React.CSSProperties = {
  width: 16,
  flex: '1 1 0',
  minHeight: 14,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 9,
  fontWeight: 600,
  borderRadius: 3,
  transition: 'all 0.15s ease',
  border: '0',
  padding: 0,
  background: 'transparent',
  lineHeight: 1,
};

function listHeaderStyle(hasSecondaryColumn: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: hasSecondaryColumn ? 'minmax(0, 1fr) auto' : '1fr',
    alignItems: 'center',
    gap: 8,
    minHeight: 24,
    padding: '0 8px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-dim)',
    fontSize: 11,
    background: 'var(--bg2)',
  };
}

const denseListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
  overscrollBehavior: 'contain',
  scrollbarGutter: 'stable',
};

const symbolListScrollStyle: React.CSSProperties = {
  ...denseListStyle,
  flex: 1,
  minWidth: 0,
  scrollbarGutter: 'stable',
};

const symbolListContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minWidth: 0,
};

function rowShellStyle(active: boolean, hasAction: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: hasAction ? '1fr auto' : '1fr',
    alignItems: 'stretch',
    minHeight: 30,
    borderBottom: '1px solid var(--border)',
    background: active ? 'var(--accent-soft)' : 'transparent',
  };
}

function rowButtonStyle(showSecondary: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: showSecondary ? 'minmax(0, 1fr) auto' : '1fr',
    gap: 8,
    alignItems: 'center',
    padding: '0 8px',
    border: '0',
    outline: 'none',
    boxShadow: 'none',
    background: 'transparent',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 30,
    minWidth: 0,
    width: '100%',
  };
}

const rowPrimaryCellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  gap: 5,
  overflow: 'hidden',
};

const rowPrimaryTextStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
  flex: '1 1 auto',
  minWidth: 0,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const exchangeBadgeStyle: React.CSSProperties = {
  flex: '0 0 auto',
  minWidth: 24,
  padding: '1px 4px',
  border: '1px solid var(--border2)',
  borderRadius: 3,
  color: 'var(--text-dim)',
  background: 'var(--bg3)',
  fontSize: 9,
  fontWeight: 700,
  lineHeight: 1.2,
  textAlign: 'center',
};

const rowSecondaryTextStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  justifySelf: 'end',
  maxWidth: 92,
  textAlign: 'right',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const rowActionButtonStyle: React.CSSProperties = {
  width: 26,
  margin: 2,
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 12,
};

const indicatorRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 8px',
  border: '0',
  borderBottom: '1px solid var(--border)',
  background: 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  color: 'var(--text)',
};

const mainPlacementHeaderStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: 'var(--text)',
  padding: '6px 8px',
  background: 'var(--bg3)',
  borderBottom: '1px solid var(--border2)',
  borderRadius: 3,
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const subgroupHeaderButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  gap: 6,
  padding: '5px 8px',
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  color: 'var(--text)',
  fontSize: 11.5,
  cursor: 'pointer',
  textAlign: 'left',
  transition: 'background 0.1s ease',
};

const subgroupCountBadgeStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: 'var(--text-dim)',
  background: 'var(--control-bg)',
  padding: '1px 5px',
  borderRadius: 8,
  border: '1px solid var(--border2)',
};

const watchlistControlBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const watchlistToolbarStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  flexWrap: 'wrap',
};

function actionButtonStyle(enabled: boolean, emphasize: boolean): React.CSSProperties {
  return {
  height: 28,
  minWidth: 64,
  padding: '0 10px',
  border: `1px solid ${emphasize && enabled ? 'var(--accent)' : 'var(--border2)'}`,
  background: emphasize && enabled ? 'var(--accent-soft)' : 'var(--bg3)',
  color: enabled ? 'var(--text)' : 'var(--text-dim)',
  borderRadius: 4,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: 12,
  fontWeight: 600,
  opacity: enabled ? 1 : 0.58,
  };
}

const watchlistMenuHintStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.35,
};

function watchlistHintStyle(officialLinked: boolean): React.CSSProperties {
  return {
    minHeight: 16,
    color: officialLinked ? 'var(--text)' : 'var(--text-dim)',
    fontSize: 11,
    lineHeight: 1.35,
  };
}

const watchlistLastSyncedStyle: React.CSSProperties = {
  color: 'var(--text-mute)',
  fontSize: 10,
  lineHeight: 1.3,
};

const emptyStateStyle: React.CSSProperties = {
  padding: '10px 8px',
  color: 'var(--text-dim)',
  fontSize: 12,
};

const watchlistContextMenuStyle: React.CSSProperties = {
  position: 'fixed',
  width: 128,
  display: 'flex',
  flexDirection: 'column',
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 40,
};

const contextMenuButtonStyle: React.CSSProperties = {
  height: 28,
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  textAlign: 'left',
  padding: '0 8px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 500,
  display: 'flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};

const symbolContextMenuStyle: React.CSSProperties = {
  position: 'fixed',
  minWidth: 155,
  display: 'flex',
  flexDirection: 'column',
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  zIndex: 40,
};

const contextMenuDividerStyle: React.CSSProperties = {
  height: 1,
  background: 'var(--border)',
  margin: '3px 0',
};

const watchlistSubmenuStyle: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  left: '100%',
  paddingLeft: 4,
  zIndex: 50,
};

const watchlistSubmenuInnerStyle: React.CSSProperties = {
  minWidth: 150,
  maxHeight: 220,
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
  padding: 4,
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const clearRecentButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 10,
  cursor: 'pointer',
  padding: '1px 4px',
  borderRadius: 3,
};
