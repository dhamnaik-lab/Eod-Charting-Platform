import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHART_EVENT_VISIBILITY,
  DEFAULT_CHART_VISUAL_SETTINGS,
  type ChartMarkerEventType,
} from '@/engine/types';
import {
  DEFAULT_CHART_VALUE_LABEL_SETTINGS,
  setAllChartValueLabelVisibility,
} from '@/engine/valueLabelSettings';
import {
  createChartSettingsDraft,
  getChartSettingsChanges,
  type ChartSettingsDraft,
} from '../chartSettingsDraftService';

function initial(): ChartSettingsDraft {
  return createChartSettingsDraft({
    visualSettings: DEFAULT_CHART_VISUAL_SETTINGS,
    showVolume: true,
    adjustedMode: false,
    includeDividendAdjustments: false,
    includeRightsAdjustments: false,
    logScale: false,
    invertPriceScale: false,
    valueLabelSettings: DEFAULT_CHART_VALUE_LABEL_SETTINGS,
    showLeftAxis: false,
    futureMarginMode: 'normal',
    chartEventVisibility: DEFAULT_CHART_EVENT_VISIBILITY,
  });
}

describe('F-14 Chart Settings draft', () => {
  it('snapshots nested settings without mutating the active chart', () => {
    const live = initial();
    const draft = createChartSettingsDraft(live);
    draft.visualSettings.gridColor = '#123456';
    draft.valueLabelSettings.showSymbolNameLabel = true;
    draft.chartEventVisibility.BONUS = false;

    expect(live.visualSettings.gridColor).not.toBe('#123456');
    expect(live.valueLabelSettings.showSymbolNameLabel).toBe(false);
    expect(live.chartEventVisibility.BONUS).toBe(true);
    expect(getChartSettingsChanges(live, live)).toEqual({});
  });

  it('Cancel, backdrop, Close and Escape discard the local draft without a store patch', () => {
    const live = initial();
    const draft = createChartSettingsDraft(live);
    draft.showVolume = false;
    draft.visualSettings.backgroundColor = '#aabbcc';
    draft.adjustedMode = true;
    // Discarding a draft means no commit operation is requested.
    expect(live.showVolume).toBe(true);
    expect(live.visualSettings.backgroundColor).toBe(DEFAULT_CHART_VISUAL_SETTINGS.backgroundColor);
    expect(live.adjustedMode).toBe(false);
    expect(getChartSettingsChanges(live, live)).toEqual({});
  });

  it('OK commits only fields edited in Symbol, Canvas, Status line and Scales', () => {
    const live = initial();
    const draft = createChartSettingsDraft(live);
    draft.showVolume = false;
    draft.visualSettings.gridColor = '#abcdef';
    draft.visualSettings.crosshairVisible = false;
    draft.valueLabelSettings.showSymbolPreviousClose = true;
    draft.logScale = true;
    draft.invertPriceScale = true;
    draft.showLeftAxis = true;
    draft.futureMarginMode = 'wide';
    draft.adjustedMode = true;
    draft.includeDividendAdjustments = true;
    draft.includeRightsAdjustments = true;

    expect(getChartSettingsChanges(live, draft)).toEqual({
      showVolume: false,
      adjustedMode: true,
      includeDividendAdjustments: true,
      includeRightsAdjustments: true,
      logScale: true,
      invertPriceScale: true,
      showLeftAxis: true,
      futureMarginMode: 'wide',
      visualSettings: { gridColor: '#abcdef', crosshairVisible: false },
      valueLabelSettings: { showSymbolPreviousClose: true },
    });
  });

  it('does not overwrite untouched settings or retain fields toggled back to original', () => {
    const live = initial();
    const draft = createChartSettingsDraft(live);
    draft.showVolume = false;
    draft.showVolume = true;
    draft.valueLabelSettings.showCompareValues = false;
    draft.valueLabelSettings.showCompareValues = true;
    draft.visualSettings.backgroundColor = '#ff0000';
    draft.visualSettings.backgroundColor = live.visualSettings.backgroundColor;

    expect(getChartSettingsChanges(live, draft)).toEqual({});
  });

  it('all status values preserves non-visibility options and commits only differences', () => {
    const live = initial();
    const draft = createChartSettingsDraft(live);
    draft.valueLabelSettings = setAllChartValueLabelVisibility(false, draft.valueLabelSettings);

    expect(draft.valueLabelSettings.noOverlappingLabels).toBe(live.valueLabelSettings.noOverlappingLabels);
    expect(getChartSettingsChanges(live, draft).valueLabelSettings).toEqual({
      showSymbolLastPrice: false,
      showOverlayIndicatorValues: false,
      showCompareValues: false,
      showIndicatorPaneValues: false,
    });
  });

  it('computes event visibility changes without mutating global event settings', () => {
    const live = initial();
    const draft = createChartSettingsDraft(live);
    const type: ChartMarkerEventType = 'SPLIT';
    draft.chartEventVisibility[type] = !draft.chartEventVisibility[type];

    expect(getChartSettingsChanges(live, draft)).toEqual({ chartEventVisibility: ['SPLIT'] });
    expect(live.chartEventVisibility.SPLIT).toBe(true);
  });

  it('keeps the cancel paths, Renko validation, and immediate exceptions wired correctly', () => {
    const dialog = readFileSync(resolve(process.cwd(), 'src/components/ChartSettingsDialog.tsx'), 'utf8');
    const canvas = readFileSync(resolve(process.cwd(), 'src/components/ChartCanvas.tsx'), 'utf8');
    const dialogBody = dialog.slice(dialog.indexOf('export function ChartSettingsDialog('), dialog.indexOf('function SymbolSettings('));
    const chartSettingsCall = canvas.slice(canvas.indexOf('<ChartSettingsDialog'), canvas.indexOf('chartSettingsDialogOpen ? (') + 4000);

    expect(dialogBody).toContain('useDialogFocus(dialogRef, onClose)');
    expect(dialogBody).toContain('style={backdropStyle} onMouseDown={onClose}');
    expect(dialogBody).toContain('onClick={onClose} aria-label="Close chart settings"');
    expect(dialogBody).toMatch(/onClick=\{onClose\}[\s\S]{0,40}Cancel/);
    expect(dialogBody).toContain('getChartSettingsChanges(initialSettingsRef.current, draftSettings)');
    expect(dialogBody).toContain('Auto-fit and alert edits apply immediately.');
    expect(dialogBody.indexOf('if (!Number.isFinite(nextValue) || nextValue < minimum)')).toBeLessThan(
      dialogBody.indexOf('onSave(draftChartType, nextRenkoSettings,'),
    );
    expect(chartSettingsCall).toMatch(/if \(chartError\) return chartError;[\s\S]*if \(changes\.showVolume !== undefined\)/);
    expect(chartSettingsCall).toContain('setChartSettingsDialogOpen(false)');
    expect(chartSettingsCall).toContain('onAutoFitPriceScale={() => runForChart');
    expect(dialog).toContain('await writeAppSettings(nextSettings)');
  });
});
