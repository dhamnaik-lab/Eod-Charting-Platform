import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDailyMarketMovers } from './useDailyMarketMovers';
import { MarketMoverRow } from './MarketMoverRow';
import { MarketMoversFilterControls, normalizeMarketMoversFilterDraft } from './MarketMoversFilterControls';
import type {
  MarketMoversFilterSettings,
  MarketMoversTab,
  NormalizedMoverRecord,
} from './marketMoversTypes';
import { marketMoversStyles } from './marketMoversStyles';
import { useChartStore } from '@/store/chartStore';
import { useUiStore } from '@/store/uiStore';
import type { SymbolExchangeFilter } from '@/platform';

interface ContextMenuState {
  x: number;
  y: number;
  record: NormalizedMoverRecord;
}

interface MarketMoversPanelProps {
  onOpenFullView?: () => void;
}

export function MarketMoversPanel({ onOpenFullView }: MarketMoversPanelProps) {
  const {
    settings,
    setSettings,
    snapshot,
    status,
    error,
    progress,
    dirty,
    runScan,
    cancelScan,
  } = useDailyMarketMovers();
  const [activeTab, setActiveTab] = useState<MarketMoversTab>('gainers');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [draftSettings, setDraftSettings] = useState<MarketMoversFilterSettings>(settings);
  const [popoverPosition, setPopoverPosition] = useState({ top: 0, left: 0 });
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const loadInstrument = useChartStore((state) => state.loadInstrument);
  const duplicateChartTab = useChartStore((state) => state.duplicateChartTab);
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const addToast = useChartStore((state) => state.addToast);
  const openScannerWindow = useUiStore((state) => state.openScannerWindow);

  const activeRecords = useMemo(() => {
    if (!snapshot) return [];
    const list =
      activeTab === 'gainers'
        ? snapshot.gainers
        : activeTab === 'losers'
          ? snapshot.losers
          : snapshot.volumeSurge;
    return list.slice(0, settings.resultCount);
  }, [snapshot, activeTab, settings.resultCount]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, activeRecords.length - 1)));
  }, [activeRecords.length]);

  useEffect(() => {
    const row = listRef.current?.querySelector<HTMLElement>(
      `[data-market-mover-index="${selectedIndex}"]`,
    );
    row?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleOpenActive = useCallback(
    (record: NormalizedMoverRecord) => {
      void loadInstrument({ symbol: record.symbol, exchange: record.exchange });
    },
    [loadInstrument],
  );

  const handleOpenNewTab = useCallback(
    (record: NormalizedMoverRecord) => {
      if (activeChartTabId) duplicateChartTab(activeChartTabId);
      void useChartStore
        .getState()
        .loadInstrument({ symbol: record.symbol, exchange: record.exchange });
    },
    [activeChartTabId, duplicateChartTab],
  );

  const handleSelectRecord = useCallback(
    (record: NormalizedMoverRecord) => {
      const index = activeRecords.findIndex(
        (candidate) =>
          candidate.symbol === record.symbol && candidate.exchange === record.exchange,
      );
      if (index >= 0) {
        setSelectedIndex(index);
        listRef.current?.focus();
      }
    },
    [activeRecords],
  );

  const handleKeyDownList = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (activeRecords.length === 0) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex((current) => Math.min(current + 1, activeRecords.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex((current) => Math.max(current - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const selected = activeRecords[selectedIndex];
        if (selected) handleOpenActive(selected);
      }
    },
    [activeRecords, selectedIndex, handleOpenActive],
  );

  const openFilters = () => {
    setDraftSettings(settings);
    const rect = filterButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setPopoverPosition({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(window.innerWidth - 260, rect.right - 240)),
      });
    }
    setShowFilters(true);
  };

  const applyFilters = () => {
    setSettings(normalizeMarketMoversFilterDraft(draftSettings));
    setShowFilters(false);
  };

  const handleExpandView = () => {
    if (onOpenFullView) onOpenFullView();
    else openScannerWindow('market-movers');
  };

  const scanButtonLabel = status === 'loading' ? 'Cancel' : snapshot ? 'Update' : 'Scan';
  const handleScanButton = () => {
    if (status === 'loading') void cancelScan();
    else void runScan();
  };

  const renderStatus = () => {
    if (status === 'loading') {
      const scanned = progress?.scanned ?? 0;
      const total = progress?.total ?? 0;
      const progressText = total > 0 ? ` (${scanned.toLocaleString('en-IN')}/${total.toLocaleString('en-IN')})` : '';
      return (
        <div style={marketMoversStyles.statusBanner}>
          <span>
            {scanned > 0 && total > 0 && scanned >= total
              ? 'Calculating rankings in background…'
              : `Scanning market in background${progressText}…`}
          </span>
          <button style={marketMoversStyles.iconButton} onClick={() => void cancelScan()}>
            Cancel
          </button>
        </div>
      );
    }
    if (error) {
      return (
        <div style={{ ...marketMoversStyles.statusBanner, ...marketMoversStyles.errorBanner }}>
          <span>{error}</span>
          <button style={marketMoversStyles.iconButton} onClick={() => void runScan()}>
            Retry
          </button>
        </div>
      );
    }
    if (!snapshot) {
      return (
        <div style={marketMoversStyles.emptyState}>
          <strong>Market Movers has not been scanned.</strong>
          <span>Choose the exchange and filters, then start the scan manually.</span>
          <button style={marketMoversStyles.primaryButton} onClick={() => void runScan()}>
            Scan Market
          </button>
        </div>
      );
    }
    if (status === 'empty') {
      return (
        <div style={marketMoversStyles.emptyState}>
          No qualifying symbols for the selected filters.
        </div>
      );
    }
    return null;
  };

  const snapshotExchangeLabel = snapshot
    ? snapshot.exchange === 'all'
      ? 'NSE + BSE'
      : snapshot.exchange
    : null;

  return (
    <div style={marketMoversStyles.container} onClick={() => setContextMenu(null)}>
      <div style={marketMoversStyles.headerBar}>
        <div style={marketMoversStyles.titleArea}>MARKET MOVERS</div>
        <div style={marketMoversStyles.actionButtons}>
          <button ref={filterButtonRef} onClick={openFilters} style={marketMoversStyles.iconButton}>
            Filters
          </button>
          <button onClick={handleScanButton} style={marketMoversStyles.iconButton}>
            {scanButtonLabel}
          </button>
          <button onClick={handleExpandView} style={marketMoversStyles.iconButton}>
            Expand
          </button>
        </div>
      </div>

      <div style={marketMoversStyles.subToolbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <select
            aria-label="Market exchange"
            value={settings.exchange}
            onChange={(event) =>
              setSettings({ exchange: event.target.value as SymbolExchangeFilter })
            }
            style={marketMoversStyles.selectInput}
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
            <option value="all">NSE + BSE</option>
          </select>
          <span>All Equity</span>
        </div>
        <span>{snapshot?.asOfDate ? `As of ${snapshot.asOfDate}` : 'Not scanned'}</span>
      </div>

      {dirty && snapshot && status !== 'loading' && (
        <div style={{ ...marketMoversStyles.statusBanner, ...marketMoversStyles.warningBanner }}>
          <span>
            {snapshot.exchange !== settings.exchange
              ? `Showing previous ${snapshotExchangeLabel} results. `
              : ''}
            Settings or database data changed — select Update to rescan.
          </span>
        </div>
      )}

      {(snapshot?.coverageWarning || snapshot?.incompleteUniverseWarning || status === 'stale') && (
        <div style={{ ...marketMoversStyles.statusBanner, ...marketMoversStyles.warningBanner }}>
          {status === 'stale' ? 'Market snapshot is stale. ' : ''}
          {snapshot?.coverageWarning ?? snapshot?.incompleteUniverseWarning}
        </div>
      )}

      <div style={marketMoversStyles.tabRow} role="tablist">
        {(['gainers', 'losers', 'volume'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            style={{
              ...marketMoversStyles.tabButton,
              ...(activeTab === tab ? marketMoversStyles.activeTabButton : null),
            }}
            onClick={() => {
              setActiveTab(tab);
              setSelectedIndex(0);
            }}
          >
            {tab === 'gainers' ? 'Gainers' : tab === 'losers' ? 'Losers' : 'Volume'}
          </button>
        ))}
        <select
          aria-label="Result count"
          value={settings.resultCount}
          onChange={(event) =>
            setSettings({ resultCount: Number(event.target.value) as 5 | 10 | 20 })
          }
          style={{ ...marketMoversStyles.selectInput, marginLeft: 'auto' }}
        >
          <option value={5}>Top 5</option>
          <option value={10}>Top 10</option>
          <option value={20}>Top 20</option>
        </select>
      </div>

      {renderStatus()}

      {snapshot && status !== 'empty' && (
        <div
          ref={listRef}
          style={marketMoversStyles.listArea}
          className="chart-native-scrollbar"
          role="listbox"
          tabIndex={0}
          aria-activedescendant={
            activeRecords.length > 0 ? `market-mover-row-${selectedIndex}` : undefined
          }
          onKeyDown={handleKeyDownList}
        >
          {activeRecords.map((record, index) => (
            <MarketMoverRow
              key={`${record.exchange}:${record.symbol}`}
              record={record}
              index={index}
              selected={index === selectedIndex}
              metric={activeTab === 'volume' ? 'volume' : 'change'}
              onSelect={handleSelectRecord}
              onOpenActive={handleOpenActive}
              onOpenNewTab={handleOpenNewTab}
              onContextMenu={(event, selectedRecord) =>
                setContextMenu({ x: event.clientX, y: event.clientY, record: selectedRecord })
              }
            />
          ))}
        </div>
      )}

      {snapshot && (
        <div style={marketMoversStyles.footer}>
          <span>
            {snapshot.targetSymbolCount.toLocaleString('en-IN')} targeted ·{' '}
            {snapshot.fetchedSymbolCount.toLocaleString('en-IN')} fetched ·{' '}
            {snapshot.failedSymbolCount.toLocaleString('en-IN')} failed
          </span>
          <span>
            {snapshot.qualifyingSymbolCount.toLocaleString('en-IN')} qualifying ·{' '}
            {snapshot.excludedSymbolCount.toLocaleString('en-IN')} excluded
          </span>
        </div>
      )}

      {showFilters &&
        createPortal(
          <div
            role="dialog"
            aria-label="Market Movers filters"
            style={{
              ...marketMoversStyles.popover,
              top: popoverPosition.top,
              left: popoverPosition.left,
            }}
          >
            <MarketMoversFilterControls
              draftSettings={draftSettings}
              onDraftSettingsChange={setDraftSettings}
              onCancel={() => setShowFilters(false)}
              onApply={applyFilters}
            />
          </div>,
          document.body,
        )}

      {contextMenu &&
        createPortal(
          <div
            style={{ ...marketMoversStyles.contextMenu, left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              style={marketMoversStyles.contextMenuButton}
              onClick={() => {
                handleOpenActive(contextMenu.record);
                setContextMenu(null);
              }}
            >
              Open in active chart
            </button>
            <button
              style={marketMoversStyles.contextMenuButton}
              onClick={() => {
                handleOpenNewTab(contextMenu.record);
                setContextMenu(null);
              }}
            >
              Open in new chart
            </button>
            <button
              style={marketMoversStyles.contextMenuButton}
              onClick={() => {
                void navigator.clipboard.writeText(contextMenu.record.symbol);
                addToast(`Copied ${contextMenu.record.symbol}`, 'info', 'Clipboard');
                setContextMenu(null);
              }}
            >
              Copy symbol
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
