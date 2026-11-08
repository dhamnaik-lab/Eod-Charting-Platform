import { useDeferredValue, useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
  INDICATOR_CATALOG,
  INDICATOR_SUBCATEGORIES,
  getIndicatorSubcategory,
  type IndicatorCatalogId,
  type IndicatorCatalogItem,
  type IndicatorSubcategory,
} from '@/indicators/catalog';
import { FloatingWindow } from './FloatingWindow';
import { useWindowStore } from '@/store/windowStore';
import { useUiStore } from '@/store/uiStore';
import { useChartStore } from '@/store/chartStore';
import { readFavoriteIndicatorIds, writeFavoriteIndicatorIds, toggleFavoriteIndicatorId, subscribeFavoriteIndicatorUpdates } from '@/indicators/indicatorFavoritesService';

export const INDICATOR_PICKER_WINDOW_ID = 'indicator-picker';

interface IndicatorPickerDialogProps {
  onAdd?: (catalogId: IndicatorCatalogId) => void;
  onClose?: () => void;
}

type MasterFilter = 'all' | 'price' | 'pane' | 'favorites';

const DIALOG_POS_KEY = 'eod-chart.floating-pos.indicator-picker.v1';

export function IndicatorPickerDialog({ onAdd, onClose }: IndicatorPickerDialogProps) {
  const registerWindow = useWindowStore((state) => state.registerWindow);
  const openWindow = useWindowStore((state) => state.openWindow);
  const focusWindow = useWindowStore((state) => state.focusWindow);
  const openRequestCount = useUiStore((state) => state.indicatorPickerOpenRequestCount);
  const closeIndicatorPicker = useUiStore((state) => state.closeIndicatorPicker);
  const addIndicatorCatalog = useChartStore((state) => state.addIndicatorCatalog);

  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [masterFilter, setMasterFilter] = useState<MasterFilter>('all');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<IndicatorSubcategory | 'all' | 'favorites'>('all');
  const [selectedId, setSelectedId] = useState<IndicatorCatalogId>(INDICATOR_CATALOG[0].id);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(readFavoriteIndicatorIds);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  useEffect(() => subscribeFavoriteIndicatorUpdates(setFavoriteIds), []);

  useEffect(() => {
    registerWindow({
      id: INDICATOR_PICKER_WINDOW_ID,
      title: 'Indicators & Studies',
      bounds: {
        x: 160,
        y: 70,
        width: 960,
        height: 620,
      },
      minWidth: 700,
      minHeight: 450,
    });
  }, [registerWindow]);

  useEffect(() => {
    if (openRequestCount > 0) {
      openWindow(INDICATOR_PICKER_WINDOW_ID);
      focusWindow(INDICATOR_PICKER_WINDOW_ID);
    }
  }, [openRequestCount, openWindow, focusWindow]);

  const handleClose = () => {
    closeIndicatorPicker();
    onClose?.();
  };

  const toggleFavorite = (id: string, e?: MouseEvent) => {
    e?.stopPropagation();
    const next = toggleFavoriteIndicatorId(readFavoriteIndicatorIds(), id);
    writeFavoriteIndicatorIds(next);
    setFavoriteIds(next);
  };

  const normalizedQuery = deferredQuery.trim().toLowerCase();

  // Compute filtered list based on query, master filter, and selected subcategory
  const filteredItems = useMemo(() => {
    return INDICATOR_CATALOG.filter((item) => {
      // 1. Query filter
      if (normalizedQuery && !matchesIndicatorQuery(item, normalizedQuery)) {
        return false;
      }

      // 2. Master placement / favorites filter
      if (masterFilter === 'price' && item.placement !== 'overlay') return false;
      if (masterFilter === 'pane' && item.placement !== 'pane') return false;
      if (masterFilter === 'favorites' && !favoriteIds.includes(item.id)) return false;

      // 3. Subcategory rail filter (only when not searching)
      if (!normalizedQuery) {
        if (selectedSubcategoryId === 'favorites') {
          return favoriteIds.includes(item.id);
        }
        if (selectedSubcategoryId !== 'all') {
          const itemSubcat = getIndicatorSubcategory(item.kind, item.placement);
          if (itemSubcat !== selectedSubcategoryId) return false;
        }
      }

      return true;
    });
  }, [normalizedQuery, masterFilter, selectedSubcategoryId, favoriteIds]);

  const selectedItem = filteredItems.find((item) => item.id === selectedId) ?? filteredItems[0] ?? null;

  // Auto-sync selection if current selectedId is filtered out
  useEffect(() => {
    if (selectedItem && selectedItem.id !== selectedId) {
      setSelectedId(selectedItem.id);
    }
  }, [selectedId, selectedItem]);

  // Keyboard navigation (Escape to close)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddSelected = () => {
    if (!selectedItem) return;
    if (onAdd) {
      onAdd(selectedItem.id);
    } else {
      addIndicatorCatalog(selectedItem.id);
    }
    setJustAddedId(selectedItem.id);
    setTimeout(() => setJustAddedId(null), 1200);
  };

  const handleQuickAdd = (catalogId: IndicatorCatalogId, e: MouseEvent) => {
    e.stopPropagation();
    if (onAdd) {
      onAdd(catalogId);
    } else {
      addIndicatorCatalog(catalogId);
    }
    setJustAddedId(catalogId);
    setTimeout(() => setJustAddedId(null), 1200);
  };

  // Counts for rail categories
  const priceSubcats = useMemo(() => INDICATOR_SUBCATEGORIES.filter((s) => s.placement === 'overlay'), []);
  const paneSubcats = useMemo(() => INDICATOR_SUBCATEGORIES.filter((s) => s.placement === 'pane'), []);

  const totalFavoritesCount = useMemo(
    () => INDICATOR_CATALOG.filter((i) => favoriteIds.includes(i.id)).length,
    [favoriteIds],
  );

  return (
    <FloatingWindow id={INDICATOR_PICKER_WINDOW_ID} onClose={handleClose}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden' }}>
        {/* Top Controls: Search Bar & Master Placement Segmented Tabs */}
        <div style={topControlRowStyle}>
          <div style={searchBoxContainerStyle}>
            <span style={searchIconStyle}>🔍</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddSelected();
                }
              }}
              placeholder="Search 118 indicators by name, formula, or type..."
              style={searchInputStyle}
            />
            {query ? (
              <button
                type="button"
                style={searchClearButtonStyle}
                onClick={() => setQuery('')}
                title="Clear search"
              >
                ✕
              </button>
            ) : null}
          </div>

          {/* Master Segmented Tabs */}
          <div style={segmentedTabsShellStyle}>
            <button
              type="button"
              style={segmentedTabButtonStyle(masterFilter === 'all')}
              onClick={() => {
                setMasterFilter('all');
                setSelectedSubcategoryId('all');
              }}
            >
              All ({INDICATOR_CATALOG.length})
            </button>
            <button
              type="button"
              style={segmentedTabButtonStyle(masterFilter === 'price')}
              onClick={() => {
                setMasterFilter('price');
                setSelectedSubcategoryId('all');
              }}
            >
              Price ({INDICATOR_CATALOG.filter((i) => i.placement === 'overlay').length})
            </button>
            <button
              type="button"
              style={segmentedTabButtonStyle(masterFilter === 'pane')}
              onClick={() => {
                setMasterFilter('pane');
                setSelectedSubcategoryId('all');
              }}
            >
              Pane ({INDICATOR_CATALOG.filter((i) => i.placement === 'pane').length})
            </button>
            <button
              type="button"
              style={segmentedTabButtonStyle(masterFilter === 'favorites')}
              onClick={() => {
                setMasterFilter('favorites');
                setSelectedSubcategoryId('favorites');
              }}
            >
              ★ Favorites ({totalFavoritesCount})
            </button>
          </div>
        </div>

        {/* Main 3-Column Body */}
        <div style={dialogBodyStyle}>
          {/* Left Rail: Categories */}
          <div style={categoryRailStyle}>
            <button
              type="button"
              style={railItemButtonStyle(selectedSubcategoryId === 'all')}
              onClick={() => {
                setSelectedSubcategoryId('all');
                if (masterFilter === 'favorites') setMasterFilter('all');
              }}
            >
              <span style={{ flex: 1, fontWeight: 600 }}>All Indicators</span>
              <span style={railBadgeStyle}>{INDICATOR_CATALOG.length}</span>
            </button>

            <button
              type="button"
              style={railItemButtonStyle(selectedSubcategoryId === 'favorites')}
              onClick={() => {
                setSelectedSubcategoryId('favorites');
                setMasterFilter('favorites');
              }}
            >
              <span style={{ flex: 1, fontWeight: 600, color: 'var(--amber, #f59e0b)' }}>★ Favorites</span>
              <span style={railBadgeStyle}>{totalFavoritesCount}</span>
            </button>

            {masterFilter !== 'pane' ? (
              <div style={railSectionGroupStyle}>
                <div style={railSectionHeaderStyle}>PRICE</div>
                {priceSubcats.map((subcat) => {
                  const count = INDICATOR_CATALOG.filter(
                    (i) => i.placement === 'overlay' && getIndicatorSubcategory(i.kind, i.placement) === subcat.id,
                  ).length;
                  const active = selectedSubcategoryId === subcat.id;
                  return (
                    <button
                      key={subcat.id}
                      type="button"
                      style={railItemButtonStyle(active)}
                      onClick={() => {
                        setSelectedSubcategoryId(subcat.id);
                        if (masterFilter === 'favorites') setMasterFilter('all');
                      }}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subcat.label}
                      </span>
                      <span style={railBadgeStyle}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {masterFilter !== 'price' ? (
              <div style={railSectionGroupStyle}>
                <div style={railSectionHeaderStyle}>PANE</div>
                {paneSubcats.map((subcat) => {
                  const count = INDICATOR_CATALOG.filter(
                    (i) => i.placement === 'pane' && getIndicatorSubcategory(i.kind, i.placement) === subcat.id,
                  ).length;
                  const active = selectedSubcategoryId === subcat.id;
                  return (
                    <button
                      key={subcat.id}
                      type="button"
                      style={railItemButtonStyle(active)}
                      onClick={() => {
                        setSelectedSubcategoryId(subcat.id);
                        if (masterFilter === 'favorites') setMasterFilter('all');
                      }}
                    >
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {subcat.label}
                      </span>
                      <span style={railBadgeStyle}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* Center Column: Fast-Add Indicator List */}
          <div style={indicatorListColStyle}>
            {filteredItems.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredItems.map((item) => {
                  const active = selectedItem?.id === item.id;
                  const isFav = favoriteIds.includes(item.id);
                  const isJustAdded = justAddedId === item.id;
                  const subcatMeta = INDICATOR_SUBCATEGORIES.find(
                    (s) => s.id === getIndicatorSubcategory(item.kind, item.placement),
                  );

                  return (
                    <div
                      key={item.id}
                      style={indicatorRowShellStyle(active)}
                      onClick={() => setSelectedId(item.id)}
                      onDoubleClick={(e) => handleQuickAdd(item.id, e)}
                      title={`${item.description}\nDouble-click or press Enter to add.`}
                    >
                      {/* Fast 1-Click Add Button */}
                      <button
                        type="button"
                        style={quickAddButtonStyle(isJustAdded)}
                        onClick={(e) => handleQuickAdd(item.id, e)}
                        title={isJustAdded ? 'Added to chart!' : '1-Click Add to Chart'}
                        aria-label={`Add ${item.label}`}
                      >
                        {isJustAdded ? '✓' : '+'}
                      </button>

                      {/* Favorite Pin Button */}
                      <button
                        type="button"
                        style={favStarButtonStyle(isFav)}
                        onClick={(e) => toggleFavorite(item.id, e)}
                        title={isFav ? 'Remove from favorites' : 'Pin to favorites'}
                        aria-label={`Favorite ${item.label}`}
                      >
                        {isFav ? '★' : '☆'}
                      </button>

                      {/* Indicator Info */}
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={indicatorRowTitleStyle}>{item.label}</span>
                        <span style={indicatorRowSubtitleStyle}>
                          {item.shortLabel} &middot; {subcatMeta?.label ?? item.group}
                        </span>
                      </div>

                      {/* Placement Badge */}
                      <span style={placementPillStyle(item.placement)}>
                        {item.placement === 'overlay' ? 'Price' : 'Pane'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={emptyStateStyle}>
                No indicators match "{query.trim()}".
                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-mute)' }}>
                  Try searching for SMA, RSI, Supertrend, or MACD.
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Preview & Details Card */}
          <div style={previewPaneStyle}>
            {selectedItem ? (
              <>
                <div style={previewHeaderStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={previewTitleStyle}>{selectedItem.label}</div>
                    <button
                      type="button"
                      style={favStarButtonStyle(favoriteIds.includes(selectedItem.id))}
                      onClick={(e) => toggleFavorite(selectedItem.id, e)}
                      title="Toggle favorite"
                    >
                      {favoriteIds.includes(selectedItem.id) ? '★' : '☆'}
                    </button>
                  </div>
                  <div style={previewMetaRowStyle}>
                    <span style={placementPillStyle(selectedItem.placement)}>
                      {selectedItem.placement === 'overlay' ? 'Price Overlay' : 'Sub-Pane Oscillator'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                      {selectedItem.shortLabel} &middot;{' '}
                      {INDICATOR_SUBCATEGORIES.find(
                        (s) => s.id === getIndicatorSubcategory(selectedItem.kind, selectedItem.placement),
                      )?.label ?? selectedItem.group}
                    </span>
                  </div>
                </div>

                <div style={previewDescriptionStyle}>{selectedItem.description}</div>

                <div style={previewSectionStyle}>
                  <div style={previewSectionTitleStyle}>DEFAULT PARAMETERS</div>
                  <div style={previewDefaultsStyle}>{describeDefaults(selectedItem)}</div>
                </div>

                <div style={previewHintStyle}>
                  💡 <strong>Tip:</strong> Click <code>+</code> on any row to plot instantly, or drag the top bar to move this window.
                </div>

                <button type="button" style={primaryAddButtonStyle} onClick={handleAddSelected}>
                  + Add to Chart
                </button>
              </>
            ) : (
              <div style={emptyStateStyle}>Select an indicator to preview parameters.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={dialogFooterStyle}>
          <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>
            Showing <strong>{filteredItems.length}</strong> of <strong>{INDICATOR_CATALOG.length}</strong> indicators
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={closeFooterButtonStyle} onClick={handleClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </FloatingWindow>
  );
}

function matchesIndicatorQuery(item: IndicatorCatalogItem, query: string): boolean {
  if (!query) return true;
  const subcatMeta = INDICATOR_SUBCATEGORIES.find((s) => s.id === getIndicatorSubcategory(item.kind, item.placement));
  const subcatLabel = subcatMeta?.label ?? '';

  const haystack = [
    item.label,
    item.shortLabel,
    item.description,
    item.kind,
    item.group,
    item.placement,
    subcatLabel,
  ]
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}

function describeDefaults(item: IndicatorCatalogItem): string {
  const { indicator } = item;

  switch (indicator.kind) {
    case 'SMA':
    case 'EMA':
    case 'WMA':
    case 'WEMA':
    case 'DEMA':
    case 'TEMA':
    case 'RSI':
    case 'ROC':
    case 'MOM':
    case 'LSMA':
    case 'VWMA':
    case 'MCGINLEY':
    case 'KAMA':
    case 'HMA':
    case 'ALMA':
      return `Period ${indicator.period}, color ${indicator.color}.`;
    case 'ALLIGATOR':
      return `Jaw (${indicator.jawPeriod}/${indicator.jawOffset}), Teeth (${indicator.teethPeriod}/${indicator.teethOffset}), Lips (${indicator.lipsPeriod}/${indicator.lipsOffset}).`;
    case 'MA_CROSS':
      return `Fast ${indicator.fastPeriod}, Slow ${indicator.slowPeriod}, MA Type ${indicator.maType ?? 'SMA'}.`;
    case 'MA_RIBBON':
      return `Periods ${indicator.period1}, ${indicator.period2}, ${indicator.period3}, ${indicator.period4}.`;
    case 'AO':
      return `Fast ${indicator.fastPeriod}, Slow ${indicator.slowPeriod}.`;
    case 'TSI':
    case 'SMI_ERGODIC':
    case 'SMI_ERGODIC_OSC':
      return `Long ${indicator.longLength}, Short ${indicator.shortLength}, Signal ${indicator.signalLength}.`;
    case 'CRSI':
      return `RSI ${indicator.rsiLength}, UpDown ${indicator.upDownLength}, ROC ${indicator.rocLength}.`;
    case 'RVI':
      return `Length ${indicator.length}.`;
    case 'FISHER':
      return `Period ${indicator.period}.`;
    case 'PRING_SPECIAL_K':
      return 'Canonical 12-term multi-timeframe smoothed ROC curve.';
    case 'RCI':
      return `Period ${indicator.period}, Signal ${indicator.signalPeriod ?? 14}.`;
    case 'WOODIES_CCI':
      return `CCI ${indicator.cciPeriod}, Turbo ${indicator.turboPeriod}.`;
    case 'ENVELOPE':
      return `Period ${indicator.period}, percent ${indicator.percent}%.`;
    case 'HV':
      return `Period ${indicator.period}, annual ${indicator.annual ?? 365} days.`;
    case 'STDEV':
    case 'ULCER_INDEX':
    case 'CHOP':
      return `Period ${indicator.period}.`;
    case 'RVI_VOL':
      return `Period ${indicator.period}, signal ${indicator.signalPeriod ?? 14}.`;
    case 'CHANDE_KROLL':
      return `ATR (${indicator.atrPeriod} x ${indicator.atrMultiplier}), Stop Length ${indicator.stopPeriod}.`;
    case 'VOLATILITY_STOP':
      return `ATR period ${indicator.period}, multiplier ${indicator.multiplier}.`;
    case 'CHOP_ZONE':
      return `Period ${indicator.period ?? 30}.`;
    case 'BBTREND':
      return `Short ${indicator.shortPeriod}, Long ${indicator.longPeriod}, StdDev ${indicator.stdDev}.`;
    case 'VOL_OSC':
    case 'CHAIKIN_OSC':
      return `Fast ${indicator.fastPeriod}, Slow ${indicator.slowPeriod}.`;
    case 'KVO':
      return `Fast ${indicator.fastPeriod}, Slow ${indicator.slowPeriod}, Signal ${indicator.signalPeriod}.`;
    case 'PVT':
      return 'Price-volume cumulative trend.';
    case 'PVI':
    case 'NVI':
      return `Signal period ${indicator.signalPeriod}.`;
    case 'CVD':
      return 'Cumulative volume delta.';
    case 'VOLUME_DELTA':
      return 'Bar volume delta.';
    case 'RVOL':
      return `Period ${indicator.period}.`;
    case 'UP_DOWN_VOL':
      return 'Up volume, down volume, and net delta.';
    case 'NET_VOLUME':
      return 'Net volume delta per bar.';
    case 'EOM':
      return `Period ${indicator.period}, Divisor ${indicator.divisor ?? 10000}.`;
    case 'TWAP':
      return 'Time-weighted average price.';
    case 'ADR':
    case 'TREND_STRENGTH':
      return `Period ${indicator.period}.`;
    case 'AUTO_KEY_LEVELS':
      return `Pivot length ${indicator.pivotLength ?? 20}, max levels ${indicator.maxLevels ?? 6}.`;
    case 'AUTO_TREND':
      return `Pivot length ${indicator.pivotLength ?? 10}.`;
    case 'FRACTALS':
      return `Periods ${indicator.periods ?? 2}.`;
    case 'RCI_RIBBON':
      return `Short ${indicator.shortLength ?? 10}, Middle ${indicator.middleLength ?? 30}, Long ${indicator.longLength ?? 50}.`;
    case 'BB_WIDTH':
    case 'BB_PCT_B':
      return `Period ${indicator.period}, StdDev ${indicator.stdDev}.`;
    case 'UT_BOT':
      return `Key Value ${indicator.keyValue}, ATR Period ${indicator.atrPeriod}.`;
    case 'WADDAH_ATTAR':
      return `Sensitivity ${indicator.sensitivity}, Fast ${indicator.fastLength}, Slow ${indicator.slowLength}, Channel ${indicator.channelLength}, BB Mult ${indicator.bbMult}.`;
    case 'SQUEEZE_MOMENTUM':
      return `BB (${indicator.bbLength} x ${indicator.bbMult}), KC (${indicator.kcLength} x ${indicator.kcMult}).`;
    case 'WAVETREND':
      return `Channel ${indicator.channelLength}, Average ${indicator.averageLength}.`;
    case 'QQE_MOD':
      return `Primary RSI ${indicator.rsiLengthPrimary}, Secondary RSI ${indicator.rsiLengthSecondary}.`;
    case 'CHANDELIER_EXIT':
      return `ATR Period ${indicator.atrPeriod}, Multiplier ${indicator.atrMult}, Use Close ${indicator.useClose ? 'Yes' : 'No'}.`;
    case 'SSL_CHANNEL':
      return `Period ${indicator.period}.`;
    case 'RIPSTER_EMA_CLOUDS':
      return 'EMA pairs: 8/9, 5/12, 34/50, 72/89, 180/200.';
    case 'ALPHA_TREND':
      return `Multiplier ${indicator.coeff}, Period ${indicator.period}, Use RSI ${indicator.useRSI ? 'Yes' : 'No'}.`;
    case 'VFI':
      return `Length ${indicator.length}, Coef ${indicator.coef}, Max Vol ${indicator.vcoef}, Signal ${indicator.signalLength}.`;
    case 'HALF_TREND':
      return `Amplitude ${indicator.amplitude}, Channel Deviation ${indicator.channelDeviation}.`;
    case 'LINREG_CHANNEL':
      return `Length ${indicator.length}.`;
    case 'SUPERTREND_AI':
      return `ATR ${indicator.atrLen}, Factors [${indicator.minFactor}..${indicator.maxFactor}], Memory ${indicator.perfAlpha}.`;
    case 'ORDER_BLOCKS':
      return `Sensitivity ${indicator.sensitivity}, Mitigation ${indicator.mitigationType ?? 'Close'}.`;
    case 'FVG':
      return `Lookback ${indicator.lookback}, ATR Mult ${indicator.atrMultiplier}.`;
    case 'MARKET_CIPHER_B':
      return `WaveTrend (${indicator.wtChannelLen}/${indicator.wtAvgLen}), MFI (${indicator.rsiMFIPeriod}).`;
    case 'RANGE_FILTER_DW':
      return `Period ${indicator.period}, Mult ${indicator.mult}.`;
    case 'DONCHIAN_RIBBON':
      return `Donchian Length ${indicator.dlen} (10 layers).`;
    case 'TRENDLINES_BREAKS':
      return `Lookback ${indicator.length}, Slope Mult ${indicator.mult}.`;
    case 'CM_VIX_FIX':
      return `WVF Length ${indicator.length}, BB (${indicator.bbLen} x ${indicator.bbMult}), Pct Lookback ${indicator.lookbackPct}.`;
    case 'PATTERN':
      return `44 TradingView candlestick patterns, 2-color directional badges.`;
    case 'CPR':
      return `Pivot (${indicator.pivotColor}), Top Central (${indicator.tcColor}), Bottom Central (${indicator.bcColor}).`;
    case 'BOLL':
      return `Period ${indicator.period}, std dev ${indicator.stdDev}, source ${formatSourceLabel(indicator.source)}, band color ${indicator.color}.`;
    case 'VWAP':
    case 'OBV':
      return `Single-series default color ${indicator.color}.`;
    case 'PSAR':
      return `Step ${indicator.step}, max ${indicator.max}, dot color ${indicator.color}.`;
    case 'SUPERTREND':
      return `ATR period ${indicator.period}, multiplier ${indicator.multiplier}, up color ${indicator.upColor}, down color ${indicator.downColor}.`;
    case 'MACD':
      return `Fast ${indicator.fastPeriod}, slow ${indicator.slowPeriod}, signal ${indicator.signalPeriod}, source ${formatSourceLabel(indicator.source)}.`;
    case 'STOCH':
      return `%K length ${indicator.period}, %K smoothing ${(indicator as unknown as { smoothK?: number }).smoothK ?? 3}, %D smoothing ${indicator.signalPeriod}, %K color ${indicator.color}, %D color ${indicator.signalColor}.`;
    case 'CCI':
    case 'WILLR':
    case 'ATR':
    case 'MFI':
    case 'CMF':
    case 'ADX':
    case 'AROON':
      return describeMultiFieldDefaults(indicator);
    default:
      return 'Defaults available after adding the indicator.';
  }
}

function describeMultiFieldDefaults(
  indicator: Extract<
    IndicatorCatalogItem['indicator'],
    | { kind: 'CCI' }
    | { kind: 'WILLR' }
    | { kind: 'ATR' }
    | { kind: 'MFI' }
    | { kind: 'CMF' }
    | { kind: 'ADX' }
    | { kind: 'AROON' }
  >,
): string {
  switch (indicator.kind) {
    case 'ADX':
      return `Period ${indicator.period}, ADX color ${indicator.color}, +DI ${indicator.plusColor}, -DI ${indicator.minusColor}.`;
    case 'AROON':
      return `Period ${indicator.period}, up color ${indicator.upColor}, down color ${indicator.downColor}.`;
    default:
      return `Period ${indicator.period}, color ${indicator.color}.`;
  }
}

function formatSourceLabel(source: string | undefined): string {
  switch (source) {
    case 'open':
      return 'Open';
    case 'high':
      return 'High';
    case 'low':
      return 'Low';
    case 'hl2':
      return 'HL/2';
    case 'hlc3':
      return 'HLC/3';
    case 'ohlc4':
      return 'OHLC/4';
    default:
      return 'Close';
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const clearBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.18)', // Ultra-light tint without any blur
  zIndex: 45,
};

const floatingDialogPanelStyle: React.CSSProperties = {
  position: 'fixed',
  width: 'min(960px, calc(100vw - 32px))',
  height: 'min(620px, calc(100vh - 32px))',
  display: 'flex',
  flexDirection: 'column',
  borderRadius: 12,
  overflow: 'hidden',
  border: '1px solid var(--border)',
  background: 'var(--bg2)',
  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border2)',
  zIndex: 50,
};

const dialogHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 16px',
  borderBottom: '1px solid var(--border2)',
  background: 'var(--bg)',
  cursor: 'grab',
  touchAction: 'none',
};

const dragHandleBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  color: 'var(--text-dim)',
  padding: '1px 5px',
  borderRadius: 4,
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  fontWeight: 600,
};

const dialogSubheadStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  lineHeight: 1.35,
  marginTop: 1,
};

const headerIconButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 11.5,
  width: 26,
  height: 26,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'color 0.1s, background 0.1s',
};

const topControlRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 16px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg2)',
  flexWrap: 'wrap',
};

const searchBoxContainerStyle: React.CSSProperties = {
  position: 'relative',
  flex: '1 1 300px',
  display: 'flex',
  alignItems: 'center',
};

const searchIconStyle: React.CSSProperties = {
  position: 'absolute',
  left: 10,
  fontSize: 12,
  color: 'var(--text-dim)',
  pointerEvents: 'none',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  padding: '0 30px 0 32px',
  borderRadius: 6,
  border: '1px solid var(--border2)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 12.5,
  fontWeight: 500,
  outline: 'none',
};

const searchClearButtonStyle: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 12,
  padding: '2px 4px',
};

const segmentedTabsShellStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  background: 'var(--bg3)',
  padding: 3,
  borderRadius: 6,
  border: '1px solid var(--border2)',
  gap: 2,
};

function segmentedTabButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 26,
    padding: '0 10px',
    borderRadius: 4,
    border: 'none',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#ffffff' : 'var(--text-dim)',
    fontSize: 11.5,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s',
    whiteSpace: 'nowrap',
  };
}

const dialogBodyStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '200px minmax(320px, 1fr) 280px',
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const categoryRailStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '10px 8px',
  borderRight: '1px solid var(--border2)',
  background: 'var(--bg)',
  overflowY: 'auto',
};

const railSectionGroupStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  marginTop: 10,
  paddingTop: 8,
  borderTop: '1px solid var(--border2)',
};

const railSectionHeaderStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: '0.08em',
  color: 'var(--accent)',
  padding: '2px 8px 4px',
};

function railItemButtonStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    gap: 6,
    padding: '5px 8px',
    borderRadius: 4,
    border: 'none',
    background: active ? 'var(--blue-dim, rgba(59, 130, 246, 0.15))' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    fontSize: 11.5,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.1s, color 0.1s',
  };
}

const railBadgeStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  padding: '1px 5px',
  borderRadius: 8,
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  border: '1px solid var(--border2)',
};

const indicatorListColStyle: React.CSSProperties = {
  padding: '10px 12px',
  overflowY: 'auto',
  borderRight: '1px solid var(--border2)',
  background: 'var(--bg2)',
};

function indicatorRowShellStyle(active: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px',
    borderRadius: 6,
    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
    background: active ? 'var(--control-bg-hover, var(--bg3))' : 'transparent',
    cursor: 'pointer',
    transition: 'background 0.1s, border-color 0.1s',
  };
}

function quickAddButtonStyle(justAdded: boolean): React.CSSProperties {
  return {
    width: 22,
    height: 22,
    borderRadius: 4,
    border: `1px solid ${justAdded ? '#22c55e' : 'var(--border2)'}`,
    background: justAdded ? 'rgba(34, 197, 94, 0.2)' : 'var(--control-bg)',
    color: justAdded ? '#22c55e' : 'var(--text)',
    fontSize: 13,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s',
  };
}

function favStarButtonStyle(isFav: boolean): React.CSSProperties {
  return {
    width: 20,
    height: 20,
    border: 'none',
    background: 'transparent',
    color: isFav ? '#f59e0b' : 'var(--text-dim)',
    fontSize: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    padding: 0,
  };
}

const indicatorRowTitleStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: 'var(--text)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const indicatorRowSubtitleStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: 'var(--text-dim)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

function placementPillStyle(placement: 'overlay' | 'pane'): React.CSSProperties {
  const isOverlay = placement === 'overlay';
  return {
    fontSize: 9.5,
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: 4,
    border: `1px solid ${isOverlay ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.4)'}`,
    background: isOverlay ? 'rgba(34, 197, 94, 0.12)' : 'rgba(59, 130, 246, 0.12)',
    color: isOverlay ? '#22c55e' : '#60a5fa',
    flexShrink: 0,
  };
}

const previewPaneStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '14px 16px',
  background: 'var(--bg3)',
  overflowY: 'auto',
};

const previewHeaderStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingBottom: 10,
  borderBottom: '1px solid var(--border2)',
};

const previewTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: 'var(--text)',
};

const previewMetaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

const previewDescriptionStyle: React.CSSProperties = {
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--text-dim)',
};

const previewSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '10px 12px',
  background: 'var(--bg)',
  borderRadius: 6,
  border: '1px solid var(--border2)',
};

const previewSectionTitleStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 800,
  letterSpacing: '0.08em',
  color: 'var(--text-dim)',
};

const previewDefaultsStyle: React.CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.45,
  color: 'var(--text)',
  fontFamily: 'monospace',
};

const previewHintStyle: React.CSSProperties = {
  fontSize: 11,
  lineHeight: 1.4,
  color: 'var(--text-dim)',
  marginTop: 'auto',
  paddingTop: 8,
};

const primaryAddButtonStyle: React.CSSProperties = {
  width: '100%',
  height: 34,
  borderRadius: 6,
  border: 'none',
  background: 'var(--accent)',
  color: '#ffffff',
  fontSize: 12.5,
  fontWeight: 700,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  transition: 'opacity 0.1s',
};

const emptyStateStyle: React.CSSProperties = {
  padding: '36px 16px',
  textAlign: 'center',
  color: 'var(--text-dim)',
  fontSize: 12.5,
};

const dialogFooterStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  borderTop: '1px solid var(--border2)',
  background: 'var(--bg)',
};

const closeFooterButtonStyle: React.CSSProperties = {
  height: 28,
  padding: '0 14px',
  borderRadius: 4,
  border: '1px solid var(--border2)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 11.5,
  fontWeight: 600,
  cursor: 'pointer',
};
