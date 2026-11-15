import { useEffect, useMemo, useState, useRef, useId, type CSSProperties } from 'react';
import { useDialogFocus } from '@/features/app/useDialogFocus';
import type { InstrumentKey } from '@/platform';
import type {
  ChartEventVisibility,
  ChartMarkerEventType,
  ChartType,
  ChartVisualSettings,
  ChartValueLabelSettings,
  FutureMarginMode,
  RenkoSettings,
} from '@/engine/types';
import {
  DEFAULT_RENKO_SETTINGS,
  DEFAULT_RENKO_BRICK_SIZE,
  MIN_RENKO_ATR_PERIOD,
  MIN_RENKO_BRICK_SIZE,
  MIN_RENKO_PERCENT,
  normalizeRenkoSettings,
} from '@/features/charts/chartTypeTransformService';
import {
  formatAlertCondition,
  formatAlertFrequency,
  formatAlertRuleName,
  type EodAlertFrequency,
  type EodAlertRule,
} from '@/features/alerts/eodAlerts';
import { readAppSettings, writeAppSettings, type AppSettings } from '@/features/app/appSettingsService';
import { ColorToolbox } from '@/components/common/ColorToolbox';

type SettingsSection = 'Symbol' | 'Status line' | 'Scales and lines' | 'Canvas' | 'Alerts' | 'Events';

interface ChartSettingsDialogProps {
  chartType: ChartType;
  renkoSettings: RenkoSettings;
  visualSettings: ChartVisualSettings;
  showVolume: boolean;
  priceAutoFit: boolean;
  allPanesAutoFit: boolean;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  logScale: boolean;
  invertPriceScale: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  showLeftAxis: boolean;
  futureMarginMode: FutureMarginMode;
  chartEventVisibility: ChartEventVisibility;
  instrument: InstrumentKey | null;
  onSave: (chartType: ChartType, renkoSettings: RenkoSettings) => string | null;
  onSetShowVolume: (show: boolean) => void;
  onAutoFitPriceScale: () => void;
  onFitAllPanes: () => void;
  onSetAdjustedMode: (adjusted: boolean) => void;
  onSetIncludeDividendAdjustments: (enabled: boolean) => void;
  onSetIncludeRightsAdjustments: (enabled: boolean) => void;
  onSetLogScale: (enabled: boolean) => void;
  onSetInvertPriceScale: (enabled: boolean) => void;
  onSetShowValueLabels: (show: boolean) => void;
  onSetValueLabelSettings: (settings: Partial<ChartValueLabelSettings>) => void;
  onSetShowLeftAxis: (show: boolean) => void;
  onSetFutureMarginMode: (mode: FutureMarginMode) => void;
  onSetChartVisualSettings: (settings: Partial<ChartVisualSettings>) => void;
  onToggleChartEventVisibility: (eventType: ChartMarkerEventType) => void;
  onClose: () => void;
}

export function ChartSettingsDialog({
  chartType,
  renkoSettings,
  visualSettings,
  showVolume,
  priceAutoFit,
  allPanesAutoFit,
  adjustedMode,
  includeDividendAdjustments,
  includeRightsAdjustments,
  logScale,
  invertPriceScale,
  valueLabelSettings,
  showLeftAxis,
  futureMarginMode,
  chartEventVisibility,
  instrument,
  onSave,
  onSetShowVolume,
  onAutoFitPriceScale,
  onFitAllPanes,
  onSetAdjustedMode,
  onSetIncludeDividendAdjustments,
  onSetIncludeRightsAdjustments,
  onSetLogScale,
  onSetInvertPriceScale,
  onSetShowValueLabels,
  onSetValueLabelSettings,
  onSetShowLeftAxis,
  onSetFutureMarginMode,
  onSetChartVisualSettings,
  onToggleChartEventVisibility,
  onClose,
}: ChartSettingsDialogProps) {
  const normalizedInitialRenkoSettings = useMemo(
    () => normalizeRenkoSettings(renkoSettings ?? DEFAULT_RENKO_SETTINGS),
    [renkoSettings],
  );
  const [activeSection, setActiveSection] = useState<SettingsSection>('Symbol');
  const [draftChartType, setDraftChartType] = useState<ChartType>(chartType);
  const [draftRenkoSettings, setDraftRenkoSettings] = useState<RenkoSettings>(normalizedInitialRenkoSettings);
  const [draftValue, setDraftValue] = useState(() => String(getRenkoModeValue(normalizedInitialRenkoSettings)));
  const [valueError, setValueError] = useState<string | null>(null);

  const allValueLabelsEnabled =
    valueLabelSettings.showSymbolNameLabel &&
    valueLabelSettings.showSymbolLastPrice &&
    valueLabelSettings.showSymbolPreviousClose &&
    valueLabelSettings.showHighLowPriceLabels &&
    valueLabelSettings.showIndicatorNameLabels &&
    valueLabelSettings.showOverlayIndicatorValues &&
    valueLabelSettings.showCompareValues &&
    valueLabelSettings.showIndicatorPaneValues;

  useEffect(() => {
    const nextRenkoSettings = normalizeRenkoSettings(renkoSettings ?? DEFAULT_RENKO_SETTINGS);
    setDraftChartType(chartType);
    setDraftRenkoSettings(nextRenkoSettings);
    setDraftValue(String(getRenkoModeValue(nextRenkoSettings)));
    setValueError(null);
  }, [chartType, renkoSettings]);

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useDialogFocus(dialogRef, onClose);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || !dialogRef.current?.contains(event.target as Node)) return;
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        applyDraft();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const updateRenkoSettings = (settings: Partial<RenkoSettings>) => {
    setDraftRenkoSettings((current) => ({ ...current, ...settings }));
    setValueError(null);
  };

  const setRenkoMode = (boxSizeMode: RenkoSettings['boxSizeMode']) => {
    setDraftRenkoSettings((current) => {
      const nextSettings = {
        ...current,
        boxSizeMode,
        ...(boxSizeMode === 'traditional' && current.boxSizeMode !== 'traditional'
          ? { boxSize: DEFAULT_RENKO_BRICK_SIZE }
          : {}),
      };
      setDraftValue(String(getRenkoModeValue(nextSettings)));
      setValueError(null);
      return nextSettings;
    });
  };

  const setDraftChartTypeWithDefaults = (nextChartType: ChartType) => {
    setDraftChartType(nextChartType);
    setValueError(null);
    if (nextChartType !== 'renko' || draftChartType === 'renko') {
      return;
    }

    setDraftRenkoSettings((current) => {
      if (current.boxSizeMode !== 'traditional') {
        setDraftValue(String(getRenkoModeValue(current)));
        return current;
      }

      const nextSettings = {
        ...current,
        boxSize: chartType === 'renko' ? current.boxSize : DEFAULT_RENKO_BRICK_SIZE,
      };
      setDraftValue(String(getRenkoModeValue(nextSettings)));
      return nextSettings;
    });
  };

  const applyDraft = () => {
    if (draftChartType !== 'renko') {
      const error = onSave(draftChartType, normalizeRenkoSettings(draftRenkoSettings));
      if (error) {
        setValueError(error);
      }
      return;
    }

    const nextValue = Number(draftValue);
    const minimum = getRenkoModeMinimum(draftRenkoSettings);
    if (!Number.isFinite(nextValue) || nextValue < minimum) {
      setValueError(`${getRenkoValueLabel(draftRenkoSettings)} must be ${minimum} or higher.`);
      return;
    }

    const normalizedValue = draftRenkoSettings.boxSizeMode === 'atr'
      ? Math.max(MIN_RENKO_ATR_PERIOD, Math.round(nextValue))
      : Number(nextValue.toFixed(4));
    const nextRenkoSettings = normalizeRenkoSettings({
      ...draftRenkoSettings,
      ...getRenkoModePatch(draftRenkoSettings, normalizedValue),
    });
    const error = onSave(draftChartType, nextRenkoSettings);
    if (error) {
      setValueError(error);
    }
  };

  return (
    <div style={backdropStyle} onMouseDown={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        style={dialogStyle} onMouseDown={(event) => event.stopPropagation()}>
        <div style={headerStyle}>
          <div id={titleId} style={titleStyle}>Chart Settings</div>
          <button type="button" style={closeButtonStyle} onClick={onClose} aria-label="Close chart settings">
            x
          </button>
        </div>

        <div style={bodyStyle}>
          <nav style={sidebarStyle} aria-label="Chart settings sections">
            {SETTINGS_SECTIONS.map((section) => (
              <button
                key={section}
                type="button"
                style={sidebarButtonStyle(section === activeSection)}
                onClick={() => setActiveSection(section)}
              >
                <span style={sidebarGlyphStyle}>{getSectionGlyph(section)}</span>
                <span>{section}</span>
              </button>
            ))}
          </nav>

          <div style={contentStyle}>
            {activeSection === 'Symbol' ? (
              <SymbolSettings
                draftChartType={draftChartType}
                draftRenkoSettings={draftRenkoSettings}
                draftValue={draftValue}
                valueError={valueError}
                onSetDraftChartType={setDraftChartTypeWithDefaults}
                onSetRenkoMode={setRenkoMode}
                onSetDraftValue={setDraftValue}
                onUpdateRenkoSettings={updateRenkoSettings}
                visualSettings={visualSettings}
                onSetChartVisualSettings={onSetChartVisualSettings}
              />
            ) : null}
            {activeSection === 'Status line' ? (
              <StatusLineSettings
                allValueLabelsEnabled={allValueLabelsEnabled}
                valueLabelSettings={valueLabelSettings}
                onSetShowValueLabels={onSetShowValueLabels}
                onSetValueLabelSettings={onSetValueLabelSettings}
              />
            ) : null}
            {activeSection === 'Scales and lines' ? (
              <ScalesAndLinesSettings
                priceAutoFit={priceAutoFit}
                allPanesAutoFit={allPanesAutoFit}
                logScale={logScale}
                invertPriceScale={invertPriceScale}
                showLeftAxis={showLeftAxis}
                futureMarginMode={futureMarginMode}
                adjustedMode={adjustedMode}
                includeDividendAdjustments={includeDividendAdjustments}
                includeRightsAdjustments={includeRightsAdjustments}
                onAutoFitPriceScale={onAutoFitPriceScale}
                onFitAllPanes={onFitAllPanes}
                onSetLogScale={onSetLogScale}
                onSetInvertPriceScale={onSetInvertPriceScale}
                onSetShowLeftAxis={onSetShowLeftAxis}
                onSetFutureMarginMode={onSetFutureMarginMode}
                onSetAdjustedMode={onSetAdjustedMode}
                onSetIncludeDividendAdjustments={onSetIncludeDividendAdjustments}
                onSetIncludeRightsAdjustments={onSetIncludeRightsAdjustments}
              />
            ) : null}
            {activeSection === 'Canvas' ? (
              <CanvasSettings
                showVolume={showVolume}
                visualSettings={visualSettings}
                onSetShowVolume={onSetShowVolume}
                onSetChartVisualSettings={onSetChartVisualSettings}
              />
            ) : null}
            {activeSection === 'Alerts' ? (
              <AlertsSettings instrument={instrument} />
            ) : null}
            {activeSection === 'Events' ? (
              <EventsSettings
                chartEventVisibility={chartEventVisibility}
                onToggleChartEventVisibility={onToggleChartEventVisibility}
              />
            ) : null}
          </div>
        </div>

        <div style={footerStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={onClose}>
            Cancel
          </button>
          <button type="button" style={primaryButtonStyle} onClick={applyDraft}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

function SymbolSettings({
  draftChartType,
  draftRenkoSettings,
  draftValue,
  valueError,
  onSetDraftChartType,
  onSetRenkoMode,
  onSetDraftValue,
  onUpdateRenkoSettings,
  visualSettings,
  onSetChartVisualSettings,
}: {
  draftChartType: ChartType;
  draftRenkoSettings: RenkoSettings;
  draftValue: string;
  valueError: string | null;
  onSetDraftChartType: (chartType: ChartType) => void;
  onSetRenkoMode: (mode: RenkoSettings['boxSizeMode']) => void;
  onSetDraftValue: (value: string) => void;
  onUpdateRenkoSettings: (settings: Partial<RenkoSettings>) => void;
  visualSettings: ChartVisualSettings;
  onSetChartVisualSettings: (settings: Partial<ChartVisualSettings>) => void;
}) {
  return (
    <>
      <div style={sectionEyebrowStyle}>Symbol</div>
      <label style={fieldRowStyle}>
        <span style={fieldNameStyle}>Chart type</span>
        <select
          value={draftChartType}
          onChange={(event) => onSetDraftChartType(event.target.value as ChartType)}
          style={fieldControlStyle}
        >
          {CHART_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div style={sectionEyebrowStyle}>Renko</div>
      {draftChartType === 'renko' ? (
        <>
          <label style={fieldRowStyle}>
            <span style={fieldNameStyle}>Source</span>
            <select
              value={draftRenkoSettings.priceSource}
              onChange={(event) => onUpdateRenkoSettings({ priceSource: event.target.value as RenkoSettings['priceSource'] })}
              style={fieldControlStyle}
            >
              <option value="close">Close</option>
              <option value="high_low">OHLC</option>
            </select>
          </label>
          <label style={fieldRowStyle}>
            <span style={fieldNameStyle}>Box size assignment method</span>
            <select
              value={draftRenkoSettings.boxSizeMode}
              onChange={(event) => onSetRenkoMode(event.target.value as RenkoSettings['boxSizeMode'])}
              style={fieldControlStyle}
            >
              <option value="atr">ATR</option>
              <option value="traditional">Traditional</option>
              <option value="percent">Percentage (LTP)</option>
            </select>
          </label>
          <label style={fieldRowStyle}>
            <span style={fieldNameStyle}>{getRenkoValueLabel(draftRenkoSettings)}</span>
            <input
              type="text"
              inputMode="decimal"
              value={draftValue}
              onChange={(event) => onSetDraftValue(event.target.value)}
              style={fieldControlStyle}
            />
          </label>
          {valueError ? <div style={errorStyle}>{valueError}</div> : null}
          <label style={fieldRowStyle}>
            <span style={fieldNameStyle}>Anchor</span>
            <select
              value={draftRenkoSettings.anchorPolicy}
              onChange={(event) => onUpdateRenkoSettings({ anchorPolicy: event.target.value as RenkoSettings['anchorPolicy'] })}
              style={fieldControlStyle}
            >
              <option value="first_close">First close</option>
              <option value="rounded_to_box">Rounded to box</option>
            </select>
          </label>
          <ToggleRow
            label="Wicks"
            checked={draftRenkoSettings.showWicks}
            onChange={(checked) => onUpdateRenkoSettings({ showWicks: checked })}
          />
          {draftRenkoSettings.showWicks ? (
            <label style={fieldRowStyle}>
              <span style={fieldNameStyle}>Wick mode</span>
              <select
                value={draftRenkoSettings.wickMode}
                onChange={(event) => onUpdateRenkoSettings({ wickMode: event.target.value as RenkoSettings['wickMode'] })}
                style={fieldControlStyle}
              >
                <option value="reversal_attempt">Reversal attempt</option>
                <option value="source_range">Full source range</option>
              </select>
            </label>
          ) : null}
          <ToggleRow
            label="Include incomplete brick"
            checked={draftRenkoSettings.includeIncompleteBrick}
            onChange={(checked) => onUpdateRenkoSettings({ includeIncompleteBrick: checked })}
          />
          <div style={sectionEyebrowStyle}>Bar colors</div>
          <ColorEditRow
            label="Up bars"
            value={visualSettings.renkoUpColor}
            onChange={(renkoUpColor) => onSetChartVisualSettings({ renkoUpColor })}
          />
          <ColorEditRow
            label="Down bars"
            value={visualSettings.renkoDownColor}
            onChange={(renkoDownColor) => onSetChartVisualSettings({ renkoDownColor })}
          />
          <ColorEditRow
            label="Projection up bars"
            value={visualSettings.renkoProjectionUpColor}
            borderColor={visualSettings.renkoProjectionUpBorderColor}
            onChange={(renkoProjectionUpColor) => onSetChartVisualSettings({ renkoProjectionUpColor })}
          />
          <ColorEditRow
            label="Projection up border"
            value={visualSettings.renkoProjectionUpBorderColor}
            onChange={(renkoProjectionUpBorderColor) => onSetChartVisualSettings({ renkoProjectionUpBorderColor })}
          />
          <ColorEditRow
            label="Projection down bars"
            value={visualSettings.renkoProjectionDownColor}
            borderColor={visualSettings.renkoProjectionDownBorderColor}
            onChange={(renkoProjectionDownColor) => onSetChartVisualSettings({ renkoProjectionDownColor })}
          />
          <ColorEditRow
            label="Projection down border"
            value={visualSettings.renkoProjectionDownBorderColor}
            onChange={(renkoProjectionDownBorderColor) => onSetChartVisualSettings({ renkoProjectionDownBorderColor })}
          />
          <ColorEditRow
            label="Up wicks"
            value={visualSettings.renkoWickUpColor}
            onChange={(renkoWickUpColor) => onSetChartVisualSettings({ renkoWickUpColor })}
          />
          <ColorEditRow
            label="Down wicks"
            value={visualSettings.renkoWickDownColor}
            onChange={(renkoWickDownColor) => onSetChartVisualSettings({ renkoWickDownColor })}
          />
        </>
      ) : (
        <div style={emptyStateStyle}>Select Renko as the chart type to edit brick settings.</div>
      )}
    </>
  );
}

function StatusLineSettings({
  allValueLabelsEnabled,
  valueLabelSettings,
  onSetShowValueLabels,
  onSetValueLabelSettings,
}: {
  allValueLabelsEnabled: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  onSetShowValueLabels: (show: boolean) => void;
  onSetValueLabelSettings: (settings: Partial<ChartValueLabelSettings>) => void;
}) {
  return (
    <>
      <div style={sectionEyebrowStyle}>Status line values</div>
      <ToggleRow label="All status values" checked={allValueLabelsEnabled} onChange={onSetShowValueLabels} />
      <ToggleRow
        label="Symbol name"
        checked={valueLabelSettings.showSymbolNameLabel}
        onChange={(checked) => onSetValueLabelSettings({ showSymbolNameLabel: checked })}
      />
      <ToggleRow
        label="Last price"
        checked={valueLabelSettings.showSymbolLastPrice}
        onChange={(checked) => onSetValueLabelSettings({ showSymbolLastPrice: checked })}
      />
      <ToggleRow
        label="Previous close"
        checked={valueLabelSettings.showSymbolPreviousClose}
        onChange={(checked) => onSetValueLabelSettings({ showSymbolPreviousClose: checked })}
      />
      <ToggleRow
        label="High and low"
        checked={valueLabelSettings.showHighLowPriceLabels}
        onChange={(checked) => onSetValueLabelSettings({ showHighLowPriceLabels: checked })}
      />
      <ToggleRow
        label="Indicator names"
        checked={valueLabelSettings.showIndicatorNameLabels}
        onChange={(checked) => onSetValueLabelSettings({ showIndicatorNameLabels: checked })}
      />
      <ToggleRow
        label="Overlay indicator values"
        checked={valueLabelSettings.showOverlayIndicatorValues}
        onChange={(checked) => onSetValueLabelSettings({ showOverlayIndicatorValues: checked })}
      />
      <ToggleRow
        label="Compare values"
        checked={valueLabelSettings.showCompareValues}
        onChange={(checked) => onSetValueLabelSettings({ showCompareValues: checked })}
      />
      <ToggleRow
        label="Indicator pane values"
        checked={valueLabelSettings.showIndicatorPaneValues}
        onChange={(checked) => onSetValueLabelSettings({ showIndicatorPaneValues: checked })}
      />
      <ToggleRow
        label="No overlapping labels"
        checked={valueLabelSettings.noOverlappingLabels}
        onChange={(checked) => onSetValueLabelSettings({ noOverlappingLabels: checked })}
      />
    </>
  );
}

function ScalesAndLinesSettings({
  priceAutoFit,
  allPanesAutoFit,
  logScale,
  invertPriceScale,
  showLeftAxis,
  futureMarginMode,
  adjustedMode,
  includeDividendAdjustments,
  includeRightsAdjustments,
  onAutoFitPriceScale,
  onFitAllPanes,
  onSetLogScale,
  onSetInvertPriceScale,
  onSetShowLeftAxis,
  onSetFutureMarginMode,
  onSetAdjustedMode,
  onSetIncludeDividendAdjustments,
  onSetIncludeRightsAdjustments,
}: {
  priceAutoFit: boolean;
  allPanesAutoFit: boolean;
  logScale: boolean;
  invertPriceScale: boolean;
  showLeftAxis: boolean;
  futureMarginMode: FutureMarginMode;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  onAutoFitPriceScale: () => void;
  onFitAllPanes: () => void;
  onSetLogScale: (enabled: boolean) => void;
  onSetInvertPriceScale: (enabled: boolean) => void;
  onSetShowLeftAxis: (show: boolean) => void;
  onSetFutureMarginMode: (mode: FutureMarginMode) => void;
  onSetAdjustedMode: (adjusted: boolean) => void;
  onSetIncludeDividendAdjustments: (enabled: boolean) => void;
  onSetIncludeRightsAdjustments: (enabled: boolean) => void;
}) {
  return (
    <>
      <div style={sectionEyebrowStyle}>Scale range</div>
      <ActionRow label="Auto fit price pane" state={priceAutoFit ? 'On' : 'Reset'} active={priceAutoFit} onClick={onAutoFitPriceScale} />
      <ActionRow label="Fit all panes" state={allPanesAutoFit ? 'On' : 'Reset'} active={allPanesAutoFit} onClick={onFitAllPanes} />

      <div style={sectionEyebrowStyle}>Scale mode</div>
      <ChoiceRow label="Regular" active={!logScale} onClick={() => onSetLogScale(false)} />
      <ChoiceRow label="Logarithmic" active={logScale} onClick={() => onSetLogScale(true)} />
      <ToggleRow label="Invert scale" checked={invertPriceScale} onChange={onSetInvertPriceScale} />
      <ToggleRow label="Show left-axis price scale" checked={showLeftAxis} onChange={onSetShowLeftAxis} />

      <div style={sectionEyebrowStyle}>Future bar space</div>
      <ChoiceRow label="Tight" detail="4 bars" active={futureMarginMode === 'tight'} onClick={() => onSetFutureMarginMode('tight')} />
      <ChoiceRow label="Normal" detail="8 bars" active={futureMarginMode === 'normal'} onClick={() => onSetFutureMarginMode('normal')} />
      <ChoiceRow label="Wide" detail="12 bars" active={futureMarginMode === 'wide'} onClick={() => onSetFutureMarginMode('wide')} />

      <div style={sectionEyebrowStyle}>Price data</div>
      <ChoiceRow label="Raw prices" active={!adjustedMode} onClick={() => onSetAdjustedMode(false)} />
      <ChoiceRow label="Adjusted prices" active={adjustedMode} onClick={() => onSetAdjustedMode(true)} />
      <ToggleRow label="Include dividend adjustments" checked={includeDividendAdjustments} onChange={onSetIncludeDividendAdjustments} />
      <ToggleRow label="Include rights adjustments" checked={includeRightsAdjustments} onChange={onSetIncludeRightsAdjustments} />
    </>
  );
}

function CanvasSettings({
  showVolume,
  visualSettings,
  onSetShowVolume,
  onSetChartVisualSettings,
}: {
  showVolume: boolean;
  visualSettings: ChartVisualSettings;
  onSetShowVolume: (show: boolean) => void;
  onSetChartVisualSettings: (settings: Partial<ChartVisualSettings>) => void;
}) {
  return (
    <>
      <div style={sectionEyebrowStyle}>Canvas overlays</div>
      <ToggleRow label="Volume" checked={showVolume} onChange={onSetShowVolume} />
      <ToggleRow
        label="Grid"
        checked={visualSettings.gridVisible}
        onChange={(gridVisible) => onSetChartVisualSettings({ gridVisible })}
      />
      <ColorEditRow
        label="Grid color"
        value={visualSettings.gridColor}
        onChange={(gridColor) => onSetChartVisualSettings({ gridColor })}
      />
      <ColorEditRow
        label="Major grid color"
        value={visualSettings.gridMajorColor}
        onChange={(gridMajorColor) => onSetChartVisualSettings({ gridMajorColor })}
      />
      <ColorEditRow
        label="Background"
        value={visualSettings.backgroundColor}
        onChange={(backgroundColor) => onSetChartVisualSettings({ backgroundColor })}
      />

      <div style={sectionEyebrowStyle}>Pointer overlays</div>
      <ToggleRow
        label="Crosshair"
        checked={visualSettings.crosshairVisible}
        onChange={(crosshairVisible) => onSetChartVisualSettings({ crosshairVisible })}
      />
      <ColorEditRow
        label="Crosshair color"
        value={visualSettings.crosshairColor}
        onChange={(crosshairColor) => onSetChartVisualSettings({ crosshairColor })}
      />
      <ToggleRow
        label="Watermark"
        checked={visualSettings.watermarkVisible}
        onChange={(watermarkVisible) => onSetChartVisualSettings({ watermarkVisible })}
      />
      <ColorEditRow
        label="Watermark color"
        value={visualSettings.watermarkColor}
        onChange={(watermarkColor) => onSetChartVisualSettings({ watermarkColor })}
      />
    </>
  );
}

function AlertsSettings({
  instrument,
}: {
  instrument: InstrumentKey | null;
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [status, setStatus] = useState('Loading alert rules...');

  useEffect(() => {
    let cancelled = false;
    readAppSettings()
      .then((nextSettings) => {
        if (cancelled) {
          return;
        }
        setSettings(nextSettings);
        setStatus('');
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Failed to load alert rules.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const chartRules = useMemo(
    () => (settings?.eodAlertRules ?? []).filter((rule) => isRuleForInstrument(rule, instrument)),
    [settings?.eodAlertRules, instrument],
  );

  const saveRules = async (rules: EodAlertRule[], message: string) => {
    if (!settings) {
      return;
    }
    const nextSettings = { ...settings, eodAlertRules: rules };
    setSettings(nextSettings);
    setStatus(message);
    await writeAppSettings(nextSettings);
  };

  const updateRule = async (ruleId: string, patch: Partial<EodAlertRule>) => {
    const now = new Date().toISOString();
    await saveRules(
      (settings?.eodAlertRules ?? []).map((rule) =>
        rule.id === ruleId ? { ...rule, ...patch, updatedAt: now } : rule,
      ),
      'Alert rule updated.',
    );
  };

  return (
    <>
      <div style={sectionEyebrowStyle}>EOD scan alerts</div>
      <div style={alertHelpStyle}>
        Alerts evaluate on completed EOD bars when the Scanner runs. Create new alerts from chart or indicator context menus.
      </div>
      {!instrument ? <div style={emptyStateStyle}>Load a chart symbol before reviewing chart-specific alerts.</div> : null}
      {status ? <div style={alertStatusStyle}>{status}</div> : null}
      {chartRules.length === 0 ? (
        <div style={emptyStateStyle}>No alert rules for this chart.</div>
      ) : (
        <div style={alertListStyle}>
          {chartRules.map((rule) => (
            <div key={rule.id} style={alertCardStyle}>
              <label style={alertCheckRowStyle}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) => void updateRule(rule.id, { enabled: event.target.checked })}
                />
                <span>{rule.enabled ? 'Enabled' : 'Disabled'}</span>
              </label>
              <div style={alertNameDisplayStyle}>{formatAlertRuleName(rule)}</div>
              <select
                style={fieldControlStyle}
                value={rule.frequency}
                onChange={(event) =>
                  void updateRule(rule.id, { frequency: event.target.value as EodAlertFrequency })
                }
                title="Alert frequency"
              >
                <option value="once">Once</option>
                <option value="once_per_symbol_date">Once per symbol/date</option>
                <option value="every_scan">Every scan</option>
                <option value="once_until_reset">Once until reset</option>
              </select>
              <div style={alertHelpStyle}>{formatAlertCondition(rule)}</div>
              <input
                type="text"
                style={alertMessageInputStyle}
                placeholder="Message"
                value={rule.message ?? ''}
                onChange={(event) => void updateRule(rule.id, { message: event.target.value })}
              />
              <div style={alertCardFooterStyle}>
                <span>{formatAlertCondition(rule)} | {formatAlertFrequency(rule.frequency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EventsSettings({
  chartEventVisibility,
  onToggleChartEventVisibility,
}: {
  chartEventVisibility: ChartEventVisibility;
  onToggleChartEventVisibility: (eventType: ChartMarkerEventType) => void;
}) {
  return (
    <>
      <div style={sectionEyebrowStyle}>Corporate action markers</div>
      {CHART_EVENT_OPTIONS.map((eventType) => (
        <ToggleRow
          key={eventType}
          label={getChartEventLabel(eventType)}
          checked={chartEventVisibility[eventType] !== false}
          onChange={() => onToggleChartEventVisibility(eventType)}
        />
      ))}
    </>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label style={toggleRowStyle}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function ColorEditRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  borderColor?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={colorPreviewRowStyle}>
      <span>{label}</span>
      <ColorToolbox
        value={value}
        onChange={onChange}
        label={label}
        allowAlpha={true}
        ariaLabel={`${label} color`}
      />
    </div>
  );
}

function ActionRow({
  label,
  state,
  active,
  onClick,
}: {
  label: string;
  state: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" style={actionRowStyle(active)} onClick={onClick}>
      <span>{label}</span>
      <span style={rowStateStyle}>{state}</span>
    </button>
  );
}

function ChoiceRow({ label, detail, active, onClick }: { label: string; detail?: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" style={choiceRowStyle(active)} onClick={onClick}>
      <span>{label}</span>
      <span style={rowStateStyle}>{detail ?? (active ? 'Active' : '')}</span>
    </button>
  );
}

function getRenkoModeValue(settings: RenkoSettings): number {
  switch (settings.boxSizeMode) {
    case 'traditional':
      return settings.boxSize || DEFAULT_RENKO_BRICK_SIZE;
    case 'percent':
      return settings.percent;
    case 'atr':
      return settings.atrPeriod;
  }
}

function getRenkoModeMinimum(settings: RenkoSettings): number {
  switch (settings.boxSizeMode) {
    case 'traditional':
      return MIN_RENKO_BRICK_SIZE;
    case 'percent':
      return MIN_RENKO_PERCENT;
    case 'atr':
      return MIN_RENKO_ATR_PERIOD;
  }
}

function getRenkoModePatch(settings: RenkoSettings, value: number): Partial<RenkoSettings> {
  switch (settings.boxSizeMode) {
    case 'traditional':
      return { boxSize: value };
    case 'percent':
      return { percent: value };
    case 'atr':
      return { atrPeriod: value };
  }
}

function getRenkoValueLabel(settings: RenkoSettings): string {
  switch (settings.boxSizeMode) {
    case 'traditional':
      return 'Box size';
    case 'percent':
      return 'Percentage (LTP)';
    case 'atr':
      return 'ATR length';
  }
}

function getSectionGlyph(section: SettingsSection): string {
  switch (section) {
    case 'Symbol':
      return '|';
    case 'Status line':
      return '-';
    case 'Scales and lines':
      return '+';
    case 'Canvas':
      return '/';
    case 'Alerts':
      return '!';
    case 'Events':
      return '#';
  }
}

function getChartEventLabel(eventType: ChartMarkerEventType): string {
  switch (eventType) {
    case 'BONUS':
      return 'Bonus';
    case 'SPLIT':
      return 'Split';
    case 'DIVIDEND':
      return 'Dividend';
    case 'RIGHTS':
      return 'Rights';
    case 'DEMERGER':
      return 'Demerger';
    case 'NAME_CHANGE':
      return 'Name change';
    case 'SYMBOL_CHANGE':
      return 'Symbol change';
  }
}

function isRuleForInstrument(rule: EodAlertRule, instrument: InstrumentKey | null): boolean {
  if (rule.conditionType === 'scanner_match' && rule.scope === 'any-scanned-symbol') {
    return true;
  }
  if (!instrument) {
    return false;
  }
  return (
    rule.exchange?.toUpperCase() === instrument.exchange.toUpperCase() &&
    rule.symbol?.toUpperCase() === instrument.symbol.toUpperCase()
  );
}

const SETTINGS_SECTIONS: SettingsSection[] = ['Symbol', 'Status line', 'Scales and lines', 'Canvas', 'Alerts', 'Events'];
const CHART_EVENT_OPTIONS: ChartMarkerEventType[] = ['BONUS', 'SPLIT', 'DIVIDEND', 'RIGHTS', 'NAME_CHANGE', 'SYMBOL_CHANGE'];

const CHART_TYPE_OPTIONS: Array<{ value: ChartType; label: string }> = [
  { value: 'candles', label: 'Candles' },
  { value: 'line', label: 'Line' },
  { value: 'area', label: 'Area' },
  { value: 'bar', label: 'Bar (OHLC)' },
  { value: 'baseline', label: 'Baseline' },
  { value: 'hlcArea', label: 'HLC Area' },
  { value: 'heikinAshi', label: 'Heikin Ashi' },
  { value: 'renko', label: 'Renko' },
];

const backdropStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  padding: 24,
  background: 'rgba(0, 0, 0, 0.42)',
  zIndex: 900,
};

const dialogStyle: CSSProperties = {
  width: 'min(920px, calc(100vw - 80px))',
  maxHeight: 'min(780px, calc(100vh - 120px))',
  display: 'flex',
  flexDirection: 'column',
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg2)',
  boxShadow: 'var(--shadow-lg)',
  color: 'var(--text)',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: 56,
  padding: '0 24px',
  borderBottom: '1px solid var(--border)',
};

const titleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
};

const closeButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  border: '1px solid transparent',
  borderRadius: 6,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 20,
  lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  minHeight: 0,
  display: 'grid',
  gridTemplateColumns: '260px minmax(360px, 1fr)',
  flex: 1,
};

const sidebarStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 24,
  borderRight: '1px solid var(--border)',
  background: 'var(--bg1)',
};

const sidebarButtonStyle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: 42,
  padding: '0 14px',
  border: '1px solid transparent',
  borderRadius: 8,
  background: active ? 'var(--control-bg-active)' : 'transparent',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 700,
  textAlign: 'left',
});

const sidebarGlyphStyle: CSSProperties = {
  width: 18,
  textAlign: 'center',
  color: 'var(--text)',
  fontWeight: 800,
};

const contentStyle: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  padding: '24px 28px',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const sectionEyebrowStyle: CSSProperties = {
  marginTop: 2,
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
};

const fieldRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px minmax(220px, 1fr)',
  alignItems: 'center',
  gap: 28,
  minHeight: 44,
};

const fieldNameStyle: CSSProperties = {
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const fieldControlStyle: CSSProperties = {
  height: 36,
  width: 'min(280px, 100%)',
  padding: '0 12px',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg3)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
  outline: 'none',
};

const toggleRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px 24px',
  alignItems: 'center',
  gap: 28,
  minHeight: 36,
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const colorPreviewRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px minmax(220px, 1fr)',
  alignItems: 'center',
  gap: 28,
  minHeight: 36,
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const alertHelpStyle: CSSProperties = {
  maxWidth: 640,
  color: 'var(--text-dim)',
  fontSize: 12,
  lineHeight: 1.45,
};

const alertStatusStyle: CSSProperties = {
  color: 'var(--accent-text)',
  fontSize: 12,
  fontWeight: 700,
};

const alertListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  maxWidth: 680,
};

const alertCardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--bg1)',
};

const alertCheckRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--text)',
  fontSize: 12,
  fontWeight: 700,
};

const alertNameDisplayStyle: CSSProperties = {
  padding: '10px 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 700,
};

const alertMessageInputStyle: CSSProperties = {
  ...fieldControlStyle,
  width: '100%',
  fontWeight: 500,
};

const alertCardFooterStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  color: 'var(--text-dim)',
  fontSize: 12,
};

const actionRowStyle = (active: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: '220px minmax(80px, 1fr)',
  alignItems: 'center',
  gap: 28,
  minHeight: 36,
  width: 'min(520px, 100%)',
  padding: '0 12px',
  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
  borderRadius: 6,
  background: active ? 'var(--accent-soft)' : 'var(--control-bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'left',
});

const choiceRowStyle = (active: boolean): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: '220px minmax(80px, 1fr)',
  alignItems: 'center',
  gap: 28,
  minHeight: 36,
  width: 'min(520px, 100%)',
  padding: '0 12px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: active ? 'var(--control-bg-active)' : 'var(--control-bg)',
  color: active ? 'var(--text)' : 'var(--text-dim)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
  textAlign: 'left',
});

const rowStateStyle: CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  fontWeight: 700,
  textAlign: 'right',
};

const errorStyle: CSSProperties = {
  marginLeft: 248,
  color: '#ff4d5a',
  fontSize: 11,
  fontWeight: 700,
};

const emptyStateStyle: CSSProperties = {
  width: 'min(520px, 100%)',
  padding: 14,
  border: '1px solid var(--border)',
  borderRadius: 8,
  background: 'var(--control-bg)',
  color: 'var(--text-dim)',
  fontSize: 12,
  fontWeight: 600,
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  padding: '16px 24px',
  borderTop: '1px solid var(--border)',
  background: 'var(--bg2)',
};

const secondaryButtonStyle: CSSProperties = {
  minWidth: 86,
  height: 36,
  padding: '0 18px',
  border: '1px solid var(--border2)',
  borderRadius: 6,
  background: 'var(--bg2)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 700,
};

const primaryButtonStyle: CSSProperties = {
  minWidth: 72,
  height: 36,
  padding: '0 18px',
  border: '1px solid var(--accent)',
  borderRadius: 6,
  background: 'var(--accent)',
  color: 'var(--accent-contrast)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 800,
};
