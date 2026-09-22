import { useDeferredValue, useEffect, useMemo, useState } from 'react';

import type { ChartCompareOverlay } from '@/engine/types';
import type { InstrumentSummary } from '@/platform';
import { useChartStore } from '@/store/chartStore';

interface CompareOverlayDialogProps {
  compareOverlays: ChartCompareOverlay[];
  onAdd: (instrument: InstrumentSummary) => void;
  onRemove: (compareId: string) => void;
  onClose: () => void;
}

export function CompareOverlayDialog({
  compareOverlays,
  onAdd,
  onRemove,
  onClose,
}: CompareOverlayDialogProps) {
  const runSearch = useChartStore((state) => state.runSearch);
  const clearSearch = useChartStore((state) => state.clearSearch);
  const searchResults = useChartStore((state) => state.searchResults);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const availableResults = useMemo(
    () =>
      searchResults.filter(
        (result) =>
          !compareOverlays.some(
            (overlay) =>
              overlay.instrument.symbol === result.symbol && overlay.instrument.exchange === result.exchange,
          ),
      ),
    [compareOverlays, searchResults],
  );

  const selectedResult =
    availableResults.find((result) => `${result.exchange}:${result.symbol}` === selectedKey) ??
    availableResults[0] ??
    null;

  useEffect(() => {
    if (selectedResult && `${selectedResult.exchange}:${selectedResult.symbol}` !== selectedKey) {
      setSelectedKey(`${selectedResult.exchange}:${selectedResult.symbol}`);
    }
  }, [selectedKey, selectedResult]);

  useEffect(() => {
    const trimmedQuery = deferredQuery.trim();
    if (!trimmedQuery) {
      clearSearch();
      return;
    }

    const timer = window.setTimeout(() => {
      void runSearch(trimmedQuery);
    }, 120);
    return () => window.clearTimeout(timer);
  }, [clearSearch, deferredQuery, runSearch]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearSearch();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSearch, onClose]);

  const handleClose = () => {
    clearSearch();
    onClose();
  };

  const handleAdd = () => {
    if (!selectedResult) {
      return;
    }

    onAdd(selectedResult);
    clearSearch();
    onClose();
  };

  return (
    <div style={dialogBackdropStyle} onMouseDown={handleClose}>
      <div style={dialogPanelStyle} onMouseDown={(event) => event.stopPropagation()}>
        <div style={dialogHeaderStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <strong style={{ fontSize: 18, color: 'var(--text)' }}>Compare</strong>
            <div style={dialogSubheadStyle}>
              Add up to three local EOD compare overlays. Lines are rebased from the first visible bar.
            </div>
          </div>
          <button type="button" style={dialogCloseStyle} onClick={handleClose}>
            x
          </button>
        </div>

        <div style={dialogBodyStyle}>
          <div style={activeCompareShellStyle}>
            <div style={sectionTitleStyle}>Current overlays</div>
            {compareOverlays.length ? (
              <div style={activeCompareListStyle}>
                {compareOverlays.map((overlay) => (
                  <div key={overlay.id} style={activeCompareChipStyle}>
                    <span style={{ ...activeCompareDotStyle, background: overlay.color }} />
                    <span style={activeCompareLabelStyle}>
                      {overlay.instrument.exchange}:{overlay.instrument.symbol}
                    </span>
                    <button
                      type="button"
                      style={activeCompareRemoveStyle}
                      onClick={() => onRemove(overlay.id)}
                      title={`Remove ${overlay.instrument.exchange}:${overlay.instrument.symbol}`}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={emptyInlineStateStyle}>No compare overlays on this chart.</div>
            )}
          </div>

          <div style={dialogSearchShellStyle}>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              placeholder="Search symbols from the local EOD database"
              style={searchInputStyle}
            />
          </div>

          <div style={dialogContentStyle}>
            <div style={listPaneStyle}>
              {availableResults.length ? (
                availableResults.slice(0, 40).map((result) => {
                  const active = selectedResult?.symbol === result.symbol && selectedResult.exchange === result.exchange;
                  return (
                    <button
                      key={`${result.exchange}:${result.symbol}`}
                      type="button"
                      style={resultRowStyle(active)}
                      onClick={() => setSelectedKey(`${result.exchange}:${result.symbol}`)}
                      onDoubleClick={() => {
                        onAdd(result);
                        clearSearch();
                        onClose();
                      }}
                    >
                      <div style={resultRowTopStyle}>
                        <span style={resultNameStyle}>{result.symbol}</span>
                        <span style={pillStyle('var(--blue)')}>{result.exchange}</span>
                      </div>
                      <div style={resultMetaStyle}>{result.name ?? 'Unnamed instrument'}</div>
                    </button>
                  );
                })
              ) : query.trim().length ? (
                <div style={emptyStateStyle}>No local symbols match "{query.trim()}".</div>
              ) : (
                <div style={emptyStateStyle}>Type a symbol or company name to search the local EOD database.</div>
              )}
            </div>

            <div style={detailPaneStyle}>
              {selectedResult ? (
                <>
                  <div style={detailHeaderStyle}>
                    <div>
                      <div style={detailTitleStyle}>{selectedResult.symbol}</div>
                      <div style={detailMetaStyle}>
                        {selectedResult.exchange}
                        {selectedResult.series ? ` | ${selectedResult.series}` : ''}
                      </div>
                    </div>
                  </div>

                  <div style={detailDescriptionStyle}>
                    {selectedResult.name ?? 'No instrument description is stored for this symbol.'}
                  </div>

                  <div style={detailSectionStyle}>
                    <div style={detailSectionTitleStyle}>Compare behavior</div>
                    <div style={detailDefaultsStyle}>
                      The line stays in the main price pane, rebased from the first visible bar. Legend and axis tags show relative performance.
                    </div>
                  </div>

                  <div style={detailHintStyle}>
                    This stays EOD-only and uses the existing local database. No intraday or trading-terminal data is introduced here.
                  </div>
                </>
              ) : (
                <div style={emptyStateStyle}>Select a result to review it before adding the overlay.</div>
              )}
            </div>
          </div>
        </div>

        <div style={dialogFooterStyle}>
          <button type="button" style={footerButtonStyle(false)} onClick={handleClose}>
            Cancel
          </button>
          <button type="button" style={footerButtonStyle(Boolean(selectedResult))} onClick={handleAdd} disabled={!selectedResult}>
            Add Compare
          </button>
        </div>
      </div>
    </div>
  );
}

const dialogBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--overlay-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 40,
};

const dialogPanelStyle: React.CSSProperties = {
  width: 'min(860px, calc(100vw - 56px))',
  maxHeight: 'min(640px, calc(100vh - 56px))',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 14,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
};

const dialogHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
  padding: '18px 20px 14px',
  borderBottom: '1px solid var(--border)',
};

const dialogSubheadStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.45,
};

const dialogCloseStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 16,
  fontWeight: 700,
  padding: '2px 6px',
};

const dialogBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '16px 20px 18px',
  minHeight: 0,
};

const activeCompareShellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const sectionTitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const activeCompareListStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

const activeCompareChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 8px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
};

const activeCompareDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flex: '0 0 auto',
};

const activeCompareLabelStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 700,
};

const activeCompareRemoveStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  padding: 0,
};

const emptyInlineStateStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.55,
};

const dialogSearchShellStyle: React.CSSProperties = {
  display: 'flex',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 12px',
  borderRadius: 9,
  border: '1px solid var(--border)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 600,
  outline: 'none',
};

const dialogContentStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(320px, 1.15fr) minmax(240px, 0.85fr)',
  gap: 16,
  minHeight: 0,
  flex: 1,
};

const listPaneStyle: React.CSSProperties = {
  minHeight: 0,
  overflowY: 'auto',
  paddingRight: 4,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const detailPaneStyle: React.CSSProperties = {
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
  padding: '14px 16px',
  borderRadius: 12,
  border: '1px solid var(--border)',
  background: 'var(--bg3)',
};

function resultRowStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 5,
    width: '100%',
    padding: '11px 12px',
    borderRadius: 10,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--control-bg-hover)' : 'var(--control-bg)',
    color: 'var(--text)',
    cursor: 'pointer',
    textAlign: 'left',
  };
}

const resultRowTopStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
};

const resultNameStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

const resultMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11.5,
  fontWeight: 600,
};

function pillStyle(color: string): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    height: 19,
    padding: '0 8px',
    borderRadius: 999,
    border: `1px solid ${color}`,
    background: `${color}22`,
    color: 'var(--text)',
    fontSize: 10.5,
    fontWeight: 700,
    flexShrink: 0,
  };
}

const detailHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

const detailTitleStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 18,
  fontWeight: 700,
};

const detailMetaStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 12,
  fontWeight: 600,
  marginTop: 4,
};

const detailDescriptionStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 13,
  lineHeight: 1.6,
};

const detailSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const detailSectionTitleStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
};

const detailDefaultsStyle: React.CSSProperties = {
  color: 'var(--text)',
  fontSize: 12.5,
  lineHeight: 1.6,
};

const detailHintStyle: React.CSSProperties = {
  marginTop: 'auto',
  paddingTop: 12,
  borderTop: '1px solid var(--border)',
  color: 'var(--text-dim)',
  fontSize: 11.5,
  lineHeight: 1.55,
};

const emptyStateStyle: React.CSSProperties = {
  padding: '28px 14px',
  borderRadius: 10,
  border: '1px dashed var(--border)',
  color: 'var(--text-dim)',
  fontSize: 12.5,
  textAlign: 'center',
};

const dialogFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  gap: 10,
  padding: '14px 20px 18px',
  borderTop: '1px solid var(--border)',
};

function footerButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 34,
    minWidth: 108,
    padding: '0 14px',
    borderRadius: 8,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--control-bg-hover)' : 'var(--control-bg)',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    cursor: active ? 'pointer' : 'pointer',
    fontSize: 12.5,
    fontWeight: 700,
    opacity: active ? 1 : 0.72,
  };
}
