import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDailyMarketMovers } from './useDailyMarketMovers';
import type { NormalizedMoverRecord } from './marketMoversTypes';
import { marketMoversStyles } from './marketMoversStyles';
import { useChartStore } from '@/store/chartStore';
import type { SymbolExchangeFilter } from '@/platform';

const PAGE_SIZE = 100;

export function MarketMoversFullView() {
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
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [resultView, setResultView] = useState<'price' | 'volume'>('price');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const clickTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const activeChartTabId = useChartStore((state) => state.activeChartTabId);
  const duplicateChartTab = useChartStore((state) => state.duplicateChartTab);

  useEffect(
    () => () => {
      for (const timer of clickTimers.current.values()) clearTimeout(timer);
      clickTimers.current.clear();
    },
    [],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setSelectedKey(null);
  }, [snapshot?.databaseRevision]);

  const gainers = useMemo(
    () => snapshot?.gainers.slice(0, visibleCount) ?? [],
    [snapshot, visibleCount],
  );
  const losers = useMemo(
    () => snapshot?.losers.slice(0, visibleCount) ?? [],
    [snapshot, visibleCount],
  );
  const volumeSurge = useMemo(
    () => snapshot?.volumeSurge.slice(0, visibleCount) ?? [],
    [snapshot, visibleCount],
  );
  const hasMore = Boolean(snapshot && (resultView === 'volume'
    ? snapshot.volumeSurge.length > visibleCount
    : snapshot.gainers.length > visibleCount || snapshot.losers.length > visibleCount));

  const openActive = (record: NormalizedMoverRecord) => {
    void useChartStore
      .getState()
      .loadInstrument({ symbol: record.symbol, exchange: record.exchange });
  };
  const openNewTab = (record: NormalizedMoverRecord) => {
    if (activeChartTabId) duplicateChartTab(activeChartTabId);
    void useChartStore
      .getState()
      .loadInstrument({ symbol: record.symbol, exchange: record.exchange });
  };
  const scheduleOpen = (record: NormalizedMoverRecord) => {
    const key = `${record.exchange}:${record.symbol}`;
    setSelectedKey(key);
    const existing = clickTimers.current.get(key);
    if (existing) clearTimeout(existing);
    clickTimers.current.set(
      key,
      setTimeout(() => {
        clickTimers.current.delete(key);
        openActive(record);
      }, 220),
    );
  };
  const openDouble = (record: NormalizedMoverRecord) => {
    const key = `${record.exchange}:${record.symbol}`;
    const existing = clickTimers.current.get(key);
    if (existing) clearTimeout(existing);
    clickTimers.current.delete(key);
    setSelectedKey(key);
    openNewTab(record);
  };

  if (!snapshot && status === 'idle') {
    return (
      <div style={marketMoversStyles.emptyState}>
        <strong>Market Movers has not been scanned.</strong>
        <span>Opening this view no longer starts a full-market scan automatically.</span>
        <button style={marketMoversStyles.primaryButton} onClick={() => void runScan()}>
          Scan Market
        </button>
      </div>
    );
  }

  if (!snapshot && status === 'loading') {
    return (
      <div style={marketMoversStyles.emptyState}>
        <strong>Scanning market in background…</strong>
        <span>
          {progress?.total
            ? `${progress.scanned.toLocaleString('en-IN')} / ${progress.total.toLocaleString('en-IN')} processed`
            : 'Preparing market universe…'}
        </span>
        <button style={marketMoversStyles.iconButton} onClick={() => void cancelScan()}>
          Cancel
        </button>
      </div>
    );
  }

  if (!snapshot && status === 'error') {
    return (
      <div style={marketMoversStyles.emptyState}>
        <strong>Market Movers could not be loaded.</strong>
        <span>{error}</span>
        <button style={marketMoversStyles.primaryButton} onClick={() => void runScan()}>
          Retry
        </button>
      </div>
    );
  }

  if (!snapshot) {
    return null;
  }

  const selectedExchangeLabel = settings.exchange === 'all' ? 'NSE + BSE' : settings.exchange;
  const snapshotExchangeLabel = snapshot.exchange === 'all' ? 'NSE + BSE' : snapshot.exchange;

  return (
    <div style={marketMoversStyles.container}>
      <div style={marketMoversStyles.fullViewHeader}>
        <div>
          <strong>Market Movers</strong>
          <div style={{ color: 'var(--text-mute)', fontSize: 11 }}>
            {snapshotExchangeLabel} All Equity ·{' '}
            {snapshot.asOfDate ? `As of ${snapshot.asOfDate}` : 'No valid common market date'}
          </div>
          <div style={{ color: 'var(--text-mute)', fontSize: 11 }}>
            {snapshot.targetSymbolCount.toLocaleString('en-IN')} targeted ·{' '}
            {snapshot.fetchedSymbolCount.toLocaleString('en-IN')} fetched ·{' '}
            {snapshot.failedSymbolCount.toLocaleString('en-IN')} failed ·{' '}
            {snapshot.qualifyingSymbolCount.toLocaleString('en-IN')} qualifying ·{' '}
            {snapshot.excludedSymbolCount.toLocaleString('en-IN')} excluded
          </div>
        </div>
        <button
          style={status === 'loading' ? marketMoversStyles.iconButton : marketMoversStyles.primaryButton}
          onClick={() => {
            if (status === 'loading') void cancelScan();
            else void runScan();
          }}
        >
          {status === 'loading' ? 'Cancel' : 'Update'}
        </button>
      </div>

      <div style={marketMoversStyles.subToolbar}>
        <label>
          Market exchange{' '}
          <select
            value={settings.exchange}
            onChange={(event) => setSettings({ exchange: event.target.value as SymbolExchangeFilter })}
            style={marketMoversStyles.selectInput}
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
            <option value="all">NSE + BSE</option>
          </select>
        </label>
        <label>
          Results{' '}
          <select
            value={resultView}
            onChange={(event) => {
              setResultView(event.target.value === 'volume' ? 'volume' : 'price');
              setVisibleCount(PAGE_SIZE);
            }}
            style={marketMoversStyles.selectInput}
          >
            <option value="price">Gainers and losers</option>
            <option value="volume">Volume surge</option>
          </select>
        </label>
      </div>

      {status === 'loading' && (
        <div style={marketMoversStyles.statusBanner}>
          <span>
            Updating in background — previous results remain available.
            {progress?.total
              ? ` ${progress.scanned.toLocaleString('en-IN')}/${progress.total.toLocaleString('en-IN')} processed.`
              : ''}
          </span>
        </div>
      )}

      {error && status !== 'loading' && (
        <div style={{ ...marketMoversStyles.statusBanner, ...marketMoversStyles.errorBanner }}>
          <span>{error}</span>
          <button style={marketMoversStyles.iconButton} onClick={() => void runScan()}>
            Retry
          </button>
        </div>
      )}

      {dirty && status !== 'loading' && (
        <div style={{ ...marketMoversStyles.statusBanner, ...marketMoversStyles.warningBanner }}>
          {snapshot.exchange !== settings.exchange
            ? `Showing previous ${snapshotExchangeLabel} results; ${selectedExchangeLabel} is selected. `
            : ''}
          Settings or database data changed — select Update to rescan.
        </div>
      )}

      {(status === 'stale' || snapshot.coverageWarning || snapshot.incompleteUniverseWarning) && (
        <div style={{ ...marketMoversStyles.statusBanner, ...marketMoversStyles.warningBanner }}>
          {status === 'stale' ? 'Market snapshot is stale. ' : ''}
          {snapshot.coverageWarning ?? snapshot.incompleteUniverseWarning}
        </div>
      )}
      {snapshot.failedSymbolCount > 0 && (
        <div style={marketMoversStyles.statusBanner}>
          {snapshot.failedSymbolCount} symbols failed to load.
          {snapshot.fetchFailureMessages.length > 0
            ? ` First error: ${snapshot.fetchFailureMessages[0]}`
            : ''}
        </div>
      )}

      {status === 'empty' ? (
        <div style={marketMoversStyles.emptyState}>
          No qualifying market-mover records for the scanned settings.
        </div>
      ) : resultView === 'volume' ? (
        <ResultTable
          title="VOLUME SURGE"
          records={volumeSurge}
          selectedKey={selectedKey}
          onClickRecord={scheduleOpen}
          onDoubleClickRecord={openDouble}
        />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            minHeight: 0,
            minWidth: 0,
            flex: 1,
          }}
        >
          <ResultTable
            title="TOP GAINERS"
            records={gainers}
            selectedKey={selectedKey}
            onClickRecord={scheduleOpen}
            onDoubleClickRecord={openDouble}
          />
          <ResultTable
            title="TOP LOSERS"
            records={losers}
            selectedKey={selectedKey}
            onClickRecord={scheduleOpen}
            onDoubleClickRecord={openDouble}
          />
        </div>
      )}

      {hasMore && (
        <div style={{ ...marketMoversStyles.footer, justifyContent: 'center' }}>
          <button
            style={marketMoversStyles.iconButton}
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
          >
            Load next {PAGE_SIZE}
          </button>
        </div>
      )}
    </div>
  );
}

interface ResultTableProps {
  title: string;
  records: NormalizedMoverRecord[];
  selectedKey: string | null;
  onClickRecord: (record: NormalizedMoverRecord) => void;
  onDoubleClickRecord: (record: NormalizedMoverRecord) => void;
}

function ResultTable({
  title,
  records,
  selectedKey,
  onClickRecord,
  onDoubleClickRecord,
}: ResultTableProps) {
  const compactHeaderStyle: React.CSSProperties = {
    ...marketMoversStyles.th,
    padding: '7px 6px',
    whiteSpace: 'nowrap',
  };
  const compactCellStyle: React.CSSProperties = {
    ...marketMoversStyles.td,
    padding: '7px 6px',
    whiteSpace: 'nowrap',
  };

  return (
    <section
      style={{
        overflowY: 'auto',
        overflowX: 'hidden',
        minWidth: 0,
        borderRight: '1px solid var(--border)',
      }}
    >
      <div style={{ ...marketMoversStyles.subToolbar, position: 'sticky', top: 0, zIndex: 5 }}>
        <strong>{title}</strong>
        <span>{records.length} shown</span>
      </div>
      <table style={{ ...marketMoversStyles.table, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '17%' }} />
          <col style={{ width: '23%' }} />
          <col style={{ width: '12%' }} />
        </colgroup>
        <thead>
          <tr>
            <th
              style={{
                ...compactHeaderStyle,
                position: 'sticky',
                left: 0,
                zIndex: 6,
                backgroundColor: 'var(--bg2)',
              }}
            >
              Symbol
            </th>
            <th style={{ ...compactHeaderStyle, textAlign: 'right' }}>Close</th>
            <th style={{ ...compactHeaderStyle, textAlign: 'right' }}>Chg %</th>
            <th style={{ ...compactHeaderStyle, textAlign: 'right' }}>Volume</th>
            <th style={{ ...compactHeaderStyle, textAlign: 'right' }}>Vol/20D</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const key = `${record.exchange}:${record.symbol}`;
            const positive = record.changePercent >= 0;
            const selected = selectedKey === key;
            return (
              <tr
                key={key}
                style={{
                  cursor: 'pointer',
                  ...(selected ? marketMoversStyles.rowSelected : null),
                }}
                onClick={() => onClickRecord(record)}
                onDoubleClick={() => onDoubleClickRecord(record)}
              >
                <td
                  style={{
                    ...compactCellStyle,
                    position: 'sticky',
                    left: 0,
                    zIndex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    backgroundColor: selected ? 'var(--accent-soft)' : 'var(--bg)',
                  }}
                  title={`${record.exchange}:${record.symbol}`}
                >
                  <strong>{record.symbol}</strong>
                  <span style={{ marginLeft: 5, color: 'var(--text-mute)', fontSize: 10 }}>
                    {record.exchange}
                  </span>
                  {record.corporateActionWarning ? (
                    <span
                      style={{ ...marketMoversStyles.badge, ...marketMoversStyles.warningBadge }}
                      title={record.corporateActionWarning}
                    >
                      CA
                    </span>
                  ) : null}
                </td>
                <td style={{ ...compactCellStyle, textAlign: 'right' }}>₹{record.close.toFixed(2)}</td>
                <td
                  style={{
                    ...compactCellStyle,
                    textAlign: 'right',
                    color: positive ? 'var(--green)' : 'var(--red)',
                    fontWeight: 700,
                  }}
                >
                  {positive ? '+' : ''}
                  {record.changePercent.toFixed(2)}%
                </td>
                <td style={{ ...compactCellStyle, textAlign: 'right', fontSize: 11 }}>
                  {record.volume.toLocaleString('en-IN')}
                </td>
                <td style={{ ...compactCellStyle, textAlign: 'right', fontSize: 11 }}>
                  {record.volumeRatio20 !== null ? `${record.volumeRatio20.toFixed(1)}x` : '-'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
