import { useEffect, useRef, useState } from 'react';
import type { InstrumentSummary } from '@/platform';
import { useChartStore } from '@/store/chartStore';
import { getUiStoreState, useUiStore } from '@/store/uiStore';

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

export function CommandPalette() {
  const open = useUiStore((state) => state.commandPaletteOpen);
  const setOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const searchResults = useChartStore((state) => state.searchResults ?? []);
  const runSearch = useChartStore((state) => state.runSearch);
  const clearSearch = useChartStore((state) => state.clearSearch);
  const loadInstrument = useChartStore((state) => state.loadInstrument);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
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
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        getUiStoreState().toggleCommandPalette();
        return;
      }

      if (
        e.key === '/' &&
        !getUiStoreState().commandPaletteOpen &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        getUiStoreState().setCommandPaletteOpen(true);
        return;
      }

      if (e.key === 'Escape' && getUiStoreState().commandPaletteOpen) {
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

  const filteredPaletteCommands = normalizedQuery.length === 0
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

  const symbolResults: SearchResult[] = (searchResults ?? []).slice(0, 10).map((result) => ({
    type: 'symbol',
    name: `${result.symbol} - ${result.exchange}`,
    category: result.exchange,
    icon: '📊',
    description: result.name || '',
    symbol: result,
    action: () => {
      void loadInstrument({ symbol: result.symbol, exchange: result.exchange }, result);
      setOpen(false);
    },
  }));

  const allResults = [...symbolResults, ...commands];

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
      <div style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header Titlebar */}
        <div style={headerStyle}>
          <div style={headerTitleGroupStyle}>
            <span style={headerIconStyle}>🔍</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={headerTitleStyle}>Command Palette</span>
              <span style={headerSubtitleStyle}>Search symbols or launch platform commands</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={escBadgeStyle}>ESC</span>
            <button
              type="button"
              style={closeButtonStyle}
              onClick={() => setOpen(false)}
              title="Close Command Palette (Esc)"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

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
            placeholder="Type a stock symbol or command name... (e.g. TCS, Scanner, Settings)"
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
              <span>No symbols or commands found matching "{query}"</span>
            </div>
          ) : (
            <div style={hintStyle}>Start typing to search stocks, indices, or platform commands...</div>
          )}
        </div>

        {/* Footer Bar */}
        <div style={footerStyle}>
          <div style={footerShortcutsStyle}>
            <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> Navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> Select</span>
            <span><kbd style={kbdStyle}>Esc</kbd> Close</span>
          </div>
          <span style={footerMetaStyle}>
            {allResults.length} {allResults.length === 1 ? 'item' : 'items'} available
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
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  paddingTop: '64px',
  paddingLeft: '16px',
  paddingRight: '16px',
  background: 'rgba(0, 0, 0, 0.25)',
  backdropFilter: 'none',
  zIndex: 1000,
};

const panelStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 580,
  background: 'var(--bg2)',
  border: '1px solid var(--border2)',
  borderRadius: 10,
  boxShadow: '0 20px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--border2)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 'calc(100vh - 120px)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  background: 'var(--bg3)',
  borderBottom: '1px solid var(--border)',
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

const escBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  padding: '2px 5px',
  borderRadius: 3,
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontFamily: 'var(--font-mono)',
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
  display: 'flex',
  flexDirection: 'column',
  maxHeight: 380,
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
