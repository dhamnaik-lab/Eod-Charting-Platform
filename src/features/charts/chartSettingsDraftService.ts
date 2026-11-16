import type {
  ChartEventVisibility,
  ChartMarkerEventType,
  ChartValueLabelSettings,
  ChartVisualSettings,
  FutureMarginMode,
} from '@/engine/types';

export interface ChartSettingsDraft {
  visualSettings: ChartVisualSettings;
  showVolume: boolean;
  adjustedMode: boolean;
  includeDividendAdjustments: boolean;
  includeRightsAdjustments: boolean;
  logScale: boolean;
  invertPriceScale: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  showLeftAxis: boolean;
  futureMarginMode: FutureMarginMode;
  chartEventVisibility: ChartEventVisibility;
}

export type ChartSettingsChanges =
  Partial<Omit<ChartSettingsDraft, 'visualSettings' | 'valueLabelSettings' | 'chartEventVisibility'>> & {
    visualSettings?: Partial<ChartVisualSettings>;
    valueLabelSettings?: Partial<ChartValueLabelSettings>;
    chartEventVisibility?: ChartMarkerEventType[];
  };

/** Own a snapshot of the settings being edited, not references to the live chart. */
export function createChartSettingsDraft(initial: ChartSettingsDraft): ChartSettingsDraft {
  return {
    ...initial,
    visualSettings: { ...initial.visualSettings },
    valueLabelSettings: { ...initial.valueLabelSettings },
    chartEventVisibility: { ...initial.chartEventVisibility },
  };
}

function changedFields<T extends object>(initial: T, current: T): Partial<T> {
  const patch: Partial<T> = {};
  for (const key of Object.keys(initial) as Array<keyof T>) {
    if (initial[key] !== current[key]) {
      patch[key] = current[key];
    }
  }
  return patch;
}

/** Apply only edited fields, so an untouched setting cannot overwrite newer store state. */
export function getChartSettingsChanges(
  original: ChartSettingsDraft,
  draft: ChartSettingsDraft,
): ChartSettingsChanges {
  const changes: ChartSettingsChanges = {};
  if (original.showVolume !== draft.showVolume) changes.showVolume = draft.showVolume;
  if (original.adjustedMode !== draft.adjustedMode) changes.adjustedMode = draft.adjustedMode;
  if (original.includeDividendAdjustments !== draft.includeDividendAdjustments) {
    changes.includeDividendAdjustments = draft.includeDividendAdjustments;
  }
  if (original.includeRightsAdjustments !== draft.includeRightsAdjustments) {
    changes.includeRightsAdjustments = draft.includeRightsAdjustments;
  }
  if (original.logScale !== draft.logScale) changes.logScale = draft.logScale;
  if (original.invertPriceScale !== draft.invertPriceScale) changes.invertPriceScale = draft.invertPriceScale;
  if (original.showLeftAxis !== draft.showLeftAxis) changes.showLeftAxis = draft.showLeftAxis;
  if (original.futureMarginMode !== draft.futureMarginMode) changes.futureMarginMode = draft.futureMarginMode;

  const visualSettings = changedFields(original.visualSettings, draft.visualSettings);
  if (Object.keys(visualSettings).length) changes.visualSettings = visualSettings;

  const valueLabelSettings = changedFields(original.valueLabelSettings, draft.valueLabelSettings);
  if (Object.keys(valueLabelSettings).length) changes.valueLabelSettings = valueLabelSettings;

  const eventTypes = (Object.keys(original.chartEventVisibility) as ChartMarkerEventType[])
    .filter((eventType) => original.chartEventVisibility[eventType] !== draft.chartEventVisibility[eventType]);
  if (eventTypes.length) changes.chartEventVisibility = eventTypes;
  return changes;
}
