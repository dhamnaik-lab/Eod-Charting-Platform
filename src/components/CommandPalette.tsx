import { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from '@/features/app/useDialogFocus';
import type { InstrumentSummary } from '@/platform';
import { useChartStore } from '@/store/chartStore';
import { getUiStoreState, useUiStore } from '@/store/uiStore';
import { useDraggableFloatingWindow } from './common/useDraggableFloatingWindow';

interface SearchResult {
  type: 'command' | 'symbol';
  name: string;
  category?: string;
  icon?: string;
  description?: string;
  symbol?: InstrumentSummary;
  action: () => void;
}

// ---------------------------------------------------------------------------
// Command registry — defined outside the component so it is never recreated on
// render. All actions use lazy store accessors (getState / getUiStoreState)
// rather than hooks, so they are safe at module scope.
// ---------------------------------------------------------------------------
interface PaletteCommand {
  name: string;
  category: string;
  icon: string;
  action: () => void;
}

const PALETTE_COMMANDS: PaletteCommand[] = [
  { name: 'Scanner Window',               category: 'Tools',       icon: '🔍', action: () => getUiStoreState().openScannerWindow() },
  { name: 'Alert Manager',                category: 'Tools',       icon: '🔔', action: () => getUiStoreState().openAlertManager() },
  { name: 'Download Bhavcopy...',         category: 'Data',        icon: '📥', action: () => getUiStoreState().openBhavcopyWindow() },
  { name: 'Quote Editor',                 category: 'Data',        icon: '📝', action: () => getUiStoreState().openQuoteEditor() },
  { name: 'Corporate Actions / Identity', category: 'Data',        icon: '🏢', action: () => getUiStoreState().openCorporateAction() },
  { name: 'Merge Symbols',                category: 'Data',        icon: '🔀', action: () => getUiStoreState().openMergeSymbols() },
  { name: 'Import Data (CSV)...',         category: 'Data',        icon: '📂', action: () => getUiStoreState().openImportDialog() },
  { name: 'Official Watchlist Import...', category: 'Watchlist',   icon: '📋', action: () => getUiStoreState().openOfficialWatchlistImportDialog() },
  { name: 'Watchlist Manager...',         category: 'Watchlist',   icon: '⭐', action: () => getUiStoreState().openWatchlistManagerDialog() },
  { name: 'Layout Manager...',            category: 'Workspace',   icon: '📐', action: () => getUiStoreState().openLayoutManagerDialog() },
  { name: 'New Chart Tab',                category: 'Workspace',   icon: '➕', action: () => useChartStore.getState().createChartTab() },
  { name: 'Toggle Sidebar',               category: 'View',        icon: '📑', action: () => getUiStoreState().toggleSidebar() },
  { name: 'Toggle Status Bar',            category: 'View',        icon: '📊', action: () => getUiStoreState().toggleStatusBar() },
  { name: 'Open Database...',             category: 'Database',    icon: '📁', action: () => useChartStore.getState().openDatabaseInteractive() },
  { name: 'Create Database...',           category: 'Database',    icon: '✨', action: () => useChartStore.getState().createDatabaseInteractive() },
  { name: 'Recent Databases...',          category: 'Database',    icon: '🕒', action: () => getUiStoreState().openRecentDatabasesDialog() },
  { name: 'Delete Database...',           category: 'Database',    icon: '🗑️', action: () => getUiStoreState().openDeleteDatabaseDialog() },
  { name: 'Binary EOD Parity Tool',       category: 'Tools',       icon: '⚖️', action: () => getUiStoreState().openBinaryEodParity() },
  { name: 'Application Settings',         category: 'Settings',    icon: '⚙️', action: () => getUiStoreState().openSettingsDialog() },
  { name: 'Keyboard Shortcuts',           category: 'Help',        icon: '⌨️', action: () => getUiStoreState().openKeyboardShortcutsDialog() },
  { name: 'FAQ & Help',                   category: 'Help',        icon: '❓', action: () => getUiStoreState().openFaqDialog() },
  { name: 'About Platform',               category: 'Help',        icon: 'ℹ️', action: () => getUiStoreState().openAboutDialog() },
];

const RECENT_SYMBOLS_STORAGE_KEY = 'eod-chart.sidebar.recentlyViewedSymbols.v1';

function readStoredRecentSymbols(): InstrumentSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_SYMBOLS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InstrumentSummary[]) : [];
  } catch {
    return [];
  }
}

function appendRecentSymbol(symbol: InstrumentSummary): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(RECENT_SYMBOLS_STORAGE_KEY);
    const prev: InstrumentSummary[] = raw ? JSON.parse(raw) : [];
    const next = [symbol, ...prev.filter((item) => !(item.symbol === symbol.symbol && item.exchange === symbol.exchange))].slice(0, 10);
    window.localStorage.setItem(RECENT_SYMBOLS_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[role="dialog"] input, [role="dialog"] textarea, [contenteditable="true"]'))
  );
}

const DIALOG_WIDTH = 580;
const DIALOG_HEIGHT = 480;

export function CommandPalette() {
  const open = useUiStore((state) => state.commandPaletteOpen);
  const mode = useUiStore((state) => state.commandPaletteMode);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const searchResults = useChartStore((state) => state.searchResults ?? []);
  const runSearch = useChartStore((state) => state.runSearch);
  const clearSearch = useChartStore((state) => state.clearSearch);
  const loadInstrument = useChartStore((state) => state.loadInstrument);

  const { position, handlePointerDown, isDragging } = useDraggableFloatingWindow({
    storageKey: 'eod-chart.command-palette.position.v1',
    width: DIALOG_WIDTH,
    height: DIALOG_HEIGHT,
  });

  const [query, setQuery] = useState('');
  const [exchangeFilter, setExchangeFilter] = useState<'all' | 'NSE' | 'BSE'>('all');
  const [recentSymbols, setRecentSymbols] = useState<InstrumentSummary[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, () => setOpen(false), true, open);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const isSymbolMode = mode === 'symbol';

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setExchangeFilter('all');
      setRecentSymbols(readStoredRecentSymbols());
      itemRefs.current = [];
      clearSearch();
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open, clearSearch]);

  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        getUiStoreState().toggleCommandPalette('all');
        return;
      }

      if (
        e.key.toLowerCase() === 's' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !getUiStoreState().commandPaletteOpen &&
        !isEditableKeyboardTarget(e.target)
      ) {
        e.preventDefault();
        getUiStoreState().setCommandPaletteOpen(true, 'symbol');
        return;
      }

      if (
        e.key === '/' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !getUiStoreState().commandPaletteOpen &&
        !isEditableKeyboardTarget(e.target)
      ) {
        e.preventDefault();
        getUiStoreState().setCommandPaletteOpen(true, 'all');
        return;
      }

      if (!e.defaultPrevented && e.key === 'Escape' && getUiStoreState().commandPaletteOpen) {
        getUiStoreState().setCommandPaletteOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length >= 1) {
      const timer = setTimeout(() => {
        void runSearch(query.trim());
      }, 100);
      return () => clearTimeout(timer);
    } else {
      clearSearch();
    }
  }, [query, runSearch, clearSearch]);

  if (!open) return null;

  const normalizedQuery = query.trim().toLowerCase();

  const filteredPaletteCommands = isSymbolMode
    ? []
    : normalizedQuery.length === 0
      ? PALETTE_COMMANDS
      : PALETTE_COMMANDS.filter(
          (cmd) =>
            cmd.name.toLowerCase().includes(normalizedQuery) ||
            cmd.category.toLowerCase().includes(normalizedQuery),
        );

  const commands: SearchResult[] = filteredPaletteCommands.map((cmd) => ({
    type: 'command' as const,
    name: cmd.name,
    category: cmd.category,
    icon: cmd.icon,
    action: cmd.action,
  }));

  let rawSymbols: InstrumentSummary[] = [];
  let isRecentList = false;

  if (isSymbolMode && query.trim().length === 0) {
    rawSymbols = recentSymbols;
    isRecentList = true;
  } else {
    rawSymbols = searchResults ?? [];
  }

  // Keep normal search and recents consistent with the accepted settlement policy.
  rawSymbols = rawSymbols.filter((symbol) => !(symbol.exchange.toUpperCase() === 'BSE' && symbol.symbol.endsWith('#')));

  if (exchangeFilter !== 'all') {
    rawSymbols = rawSymbols.filter((s) => s.exchange.toUpperCase() === exchangeFilter);
  }

  const symbolResults: SearchResult[] = rawSymbols.slice(0, isSymbolMode ? 35 : 10).map((result) => ({
    type: 'symbol',
    name: `${result.symbol} - ${result.exchange}`,
    category: isRecentList ? `${result.exchange} • Recent` : result.exchange,
    icon: isRecentList ? '🕒' : '📊',
    description: result.name || '',
    symbol: result,
    action: () => {
      appendRecentSymbol(result);
      void loadInstrument({ symbol: result.symbol, exchange: result.exchange }, result);
      setOpen(false);
    },
  }));

  const allResults = isSymbolMode ? symbolResults : [...symbolResults, ...commands];

  const handleSelect = (index: number) => {
    if (allResults[index]) {
      allResults[index].action();
      setOpen(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, allResults.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelect(selectedIndex);
    }
  };

  return (
    <div style={overlayStyle} onMouseDown={() => setOpen(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
        style={{
          ...panelStyle,
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header Titlebar */}
        <div
          style={{
            ...headerStyle,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          onPointerDown={handlePointerDown}
          title="Click and drag to move window anywhere on chart"
        >
          <div style={headerTitleGroupStyle}>
            <span style={headerIconStyle}>{isSymbolMode ? '📈' : '🔍'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={headerTitleStyle}>{isSymbolMode ? 'Symbol Search' : 'Command Palette'}</span>
              <span style={headerSubtitleStyle}>
                {isSymbolMode
                  ? 'NSE & BSE ticker search'
                  : 'Search symbols or launch platform commands'}
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={closeButtonStyle}
              onClick={() => setOpen(false)}
              title="Close (Esc)"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Exchange Filter Pills for Symbol Mode */}
        {isSymbolMode ? (
          <div style={filterPillsContainerStyle}>
            <span style={filterPillsLabelStyle}>Filter:</span>
            {(['all', 'NSE', 'BSE'] as const).map((ex) => (
              <button
                key={ex}
                type="button"
                style={filterPillButtonStyle(exchangeFilter === ex)}
                onClick={() => {
                  setExchangeFilter(ex);
                  setSelectedIndex(0);
                  inputRef.current?.focus();
                }}
              >
                {ex === 'all' ? 'All Exchanges' : ex}
              </button>
            ))}
          </div>
        ) : null}

        {/* Search Input Box */}
        <div style={inputContainerStyle}>
          <span style={inputSearchIconStyle}>🔎</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
            aria-label={isSymbolMode ? 'Search symbols' : 'Search symbols and commands'}
            placeholder={
              isSymbolMode
                ? 'Type symbol ticker or company name... (e.g. RELIANCE, TCS, INFY)'
                : 'Type a stock symbol or command name... (e.g. TCS, Scanner, Settings)'
            }
            style={inputStyle}
            autoFocus
          />
          {query.length > 0 ? (
            <button
              type="button"
              style={clearQueryButtonStyle}
              onClick={() => {
                setQuery('');
                setSelectedIndex(0);
                inputRef.current?.focus();
              }}
              title="Clear Search"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Results List */}
        <div style={listStyle}>
          {isSymbolMode && isRecentList && allResults.length > 0 ? (
            <div style={sectionDividerHeaderStyle}>Recently Viewed Symbols</div>
          ) : null}
          {allResults.length > 0 ? (
            allResults.map((item, i) => {
              const isSelected = i === selectedIndex;
              return (
                <button
                  key={item.name + '-' + i}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  style={{
                    ...itemStyle,
                    background: isSelected ? 'var(--control-bg-hover)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                  }}
                  onClick={() => handleSelect(i)}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <span style={itemIconStyle}>{item.icon ?? (item.type === 'symbol' ? '📊' : '⌘')}</span>
                  <div style={itemContentStyle}>
                    <div style={itemPrimaryRowStyle}>
                      <span style={{ ...itemNameStyle, color: isSelected ? 'var(--text)' : 'var(--text)' }}>
                        {item.type === 'symbol' ? item.symbol?.symbol : item.name}
                      </span>
                      {item.symbol?.series ? (
                        <span style={seriesBadgeStyle}>{item.symbol.series}</span>
                      ) : null}
                      {item.category ? (
                        <span
                          style={{
                            ...categoryBadgeStyle,
                            background: item.type === 'symbol' ? 'var(--accent-faint)' : 'var(--bg3)',
                            color: item.type === 'symbol' ? 'var(--accent-strong)' : 'var(--text-dim)',
                            border: item.type === 'symbol' ? '1px solid var(--accent-soft)' : '1px solid var(--border)',
                          }}
                        >
                          {item.category}
                        </span>
                      ) : null}
                    </div>
                    {item.description ? (
                      <span style={itemDescStyle}>{item.description}</span>
                    ) : item.type === 'command' ? (
                      <span style={itemDescStyle}>Execute action</span>
                    ) : null}
                  </div>
                  {isSelected ? <span style={enterPromptStyle}>↵ Select</span> : null}
                </button>
              );
            })
          ) : query.trim().length > 0 ? (
            <div style={noResultsStyle}>
              <span style={{ fontSize: 20 }}>🔍</span>
              <span>
                {isSymbolMode
                  ? `No symbols found matching "${query}"${exchangeFilter !== 'all' ? ` in ${exchangeFilter}` : ''}`
                  : `No symbols or commands found matching "${query}"`}
              </span>
            </div>
          ) : (
            <div style={hintStyle}>
              {isSymbolMode
                ? 'Type to search all instruments across NSE and BSE...'
                : 'Start typing to search stocks, indices, or platform commands...'}
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div style={footerStyle}>
          <div style={footerShortcutsStyle}>
            {isSymbolMode ? <span>Exchange: choose a filter button</span> : null}
            <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> Navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> Select</span>
            <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
          </div>
          <span style={footerMetaStyle}>
            {allResults.length} {allResults.length === 1 ? (isSymbolMode ? 'symbol' : 'item') : (isSymbolMode ? 'symbols' : 'items')} available
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles: Crystal-Clear Transparent Overlay, Elevated Modern Dialog
// ---------------------------------------------------------------------------

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.25)',
  backdropFilter: 'none',
  zIndex: 1000,
};

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  width: `min(${DIALOG_WIDTH}px, calc(100vw - 32px))`,
  height: `min(${DIALOG_HEIGHT}px, calc(100vh - 60px))`,
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  borderRadius: 10,
  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--border2)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 1001,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  background: 'var(--bg3)',
  borderBottom: '1px solid var(--border)',
  userSelect: 'none',
};

const headerTitleGroupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const headerIconStyle: React.CSSProperties = {
  fontSize: 16,
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text)',
};

const headerSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-mute)',
};

const closeButtonStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  display: 'grid',
  placeItems: 'center',
  background: 'transparent',
  border: 'none',
  borderRadius: 4,
  color: 'var(--text-dim)',
  fontSize: 14,
  cursor: 'pointer',
};

const inputContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg)',
};

const inputSearchIconStyle: React.CSSProperties = {
  fontSize: 14,
  opacity: 0.6,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  background: 'transparent',
  fontSize: 14,
  color: 'var(--text)',
  outline: 'none',
  fontFamily: 'inherit',
};

const clearQueryButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 12,
  cursor: 'pointer',
  padding: 4,
  borderRadius: 4,
};

const listStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflowY: 'auto',
  padding: '4px 0',
};

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '8px 14px',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
  color: 'var(--text)',
  transition: 'background 0.1s ease',
};

const itemIconStyle: React.CSSProperties = {
  fontSize: 16,
  width: 22,
  textAlign: 'center',
  flexShrink: 0,
};

const itemContentStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  flex: 1,
  minWidth: 0,
};

const itemPrimaryRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const itemNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const categoryBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: '1px 6px',
  borderRadius: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const itemDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
};

const enterPromptStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--accent-strong)',
  fontFamily: 'var(--font-mono)',
  flexShrink: 0,
};

const noResultsStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  padding: '28px 16px',
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 13,
};

const hintStyle: React.CSSProperties = {
  padding: '24px 16px',
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 12,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 14px',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg3)',
  fontSize: 11,
  color: 'var(--text-dim)',
};

const footerShortcutsStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const footerMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-mute)',
};

const kbdStyle: React.CSSProperties = {
  padding: '1px 4px',
  borderRadius: 3,
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  marginRight: 4,
};

const filterPillsContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 14px',
  background: 'var(--bg3)',
  borderBottom: '1px solid var(--border)',
};

const filterPillsLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-mute)',
  marginRight: 2,
};

const filterPillButtonStyle = (active: boolean): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: active ? 600 : 400,
  padding: '2px 8px',
  borderRadius: 4,
  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
  background: active ? 'var(--accent-faint)' : 'transparent',
  color: active ? 'var(--accent-strong)' : 'var(--text-dim)',
  cursor: 'pointer',
  transition: 'all 0.1s ease',
});

const sectionDividerHeaderStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-mute)',
  padding: '6px 14px 2px 14px',
};

const seriesBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  padding: '1px 4px',
  borderRadius: 3,
  background: 'var(--bg3)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
};
