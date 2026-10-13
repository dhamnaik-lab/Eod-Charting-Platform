import { useEffect } from 'react';
import type { ChartEngine } from '@/engine/ChartEngine';
import { SHARED_AXIS_WIDTH } from '@/engine/ChartEngine';
import type {
  ChartTheme,
  ChartVisualSettings,
  ChartTimeframe,
  ChartType,
  ChartValueLabelSettings,
  FutureMarginMode,
} from '@/engine/types';

export interface ChartDisplaySyncProps {
  theme: ChartTheme;
  visualSettings: ChartVisualSettings;
  timeframe: ChartTimeframe;
  chartType: ChartType;
  showVolume: boolean;
  logScale: boolean;
  invertPriceScale: boolean;
  valueLabelSettings: ChartValueLabelSettings;
  showLeftAxis: boolean;
  futureMarginMode: FutureMarginMode;
  magnetEnabled: boolean;
}

/**
 * Dedicated hook to keep ChartEngine display properties synchronized with React state.
 * All properties in ChartDisplaySyncProps are strictly required to prevent accidental unwiring.
 */
export function useChartDisplaySync(
  engine: ChartEngine | null,
  props: ChartDisplaySyncProps,
): void {
  useEffect(() => {
    engine?.setTheme(props.theme);
  }, [engine, props.theme]);

  useEffect(() => {
    engine?.setVisualSettings(props.visualSettings);
  }, [engine, props.visualSettings]);

  useEffect(() => {
    engine?.setTimeframe(props.timeframe);
  }, [engine, props.timeframe]);

  useEffect(() => {
    engine?.setChartType(props.chartType);
  }, [engine, props.chartType]);

  useEffect(() => {
    engine?.setShowVolume(props.showVolume);
  }, [engine, props.showVolume]);

  useEffect(() => {
    engine?.setLogScale(props.logScale);
  }, [engine, props.logScale]);

  useEffect(() => {
    engine?.setInvertPriceScale(props.invertPriceScale);
  }, [engine, props.invertPriceScale]);

  useEffect(() => {
    engine?.setValueLabelSettings(props.valueLabelSettings);
  }, [engine, props.valueLabelSettings]);

  useEffect(() => {
    engine?.setLeftAxisWidth(props.showLeftAxis ? SHARED_AXIS_WIDTH : 0);
  }, [engine, props.showLeftAxis]);

  useEffect(() => {
    engine?.setFutureMarginMode(props.futureMarginMode);
  }, [engine, props.futureMarginMode]);

  useEffect(() => {
    engine?.setMagnetEnabled(props.magnetEnabled);
  }, [engine, props.magnetEnabled]);
}
