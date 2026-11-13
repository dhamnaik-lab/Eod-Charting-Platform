import type { EodBar, ScannerDirection } from '@/features/scanner/types';

export type ChartPatternFamily =
  | 'gap'
  | 'reversal'
  | 'continuation'
  | 'neutral-bilateral';

export type ChartPatternReliability = 'low' | 'medium' | 'high';

export interface ChartPatternTimeframeReliability {
  intraday: 0 | 1 | 2 | 3;
  daily: 0 | 1 | 2 | 3;
  weekly: 0 | 1 | 2 | 3;
}

export interface ChartPatternMetadata {
  family: ChartPatternFamily;
  signalDirection: ScannerDirection;
  reliability: ChartPatternReliability;
  timeframeReliability: ChartPatternTimeframeReliability;
  volumeConfirmation: string;
  failureCondition: string;
  indiaContext: string;
}

export interface ChartPatternPivot {
  index: number;
  date: string;
  price: number;
  kind: 'high' | 'low';
}

export type ChartPatternGeometryFamily =
  | 'triangle'
  | 'wedge'
  | 'channel'
  | 'head-and-shoulders'
  | 'double-top-bottom'
  | 'triple-top-bottom'
  | 'flag'
  | 'pennant'
  | 'cup-handle'
  | 'gap-zone'
  | 'v-reversal'
  | 'horn'
  | 'bump-and-run'
  | 'blow-off'
  | 'diamond'
  | 'broadening'
  | 'complex-head-and-shoulders'
  | 'rounding'
  | 'adam-eve'
  | 'scallop-handle'
  | 'three-pivot'
  | 'measured-move'
  | 'range'
  | 'coil'
  | 'high-tight-flag'
  | 'candle-continuation'
  | 'generic';

export interface ChartPatternGeometryPoint {
  index?: number;
  date: string;
  price: number;
}

export interface ChartPatternGeometryPivotMarker extends ChartPatternGeometryPoint {
  id: string;
  label: string;
  kind: ChartPatternPivot['kind'] | 'neutral';
  role?: 'swing' | 'breakout';
}

export interface ChartPatternGeometryTrendLine {
  id: string;
  label?: string;
  role: 'upper' | 'lower' | 'neckline' | 'support' | 'resistance' | 'pole' | 'midline' | 'generic';
  start: ChartPatternGeometryPoint;
  end: ChartPatternGeometryPoint;
  extendRight?: boolean;
}

export interface ChartPatternGeometryZone {
  id: string;
  label?: string;
  role: 'pattern-span' | 'gap' | 'island' | 'base' | 'breakout' | 'generic';
  startDate: string;
  endDate: string;
  low: number;
  high: number;
  fillOpacity?: number;
}

export interface ChartPatternGeometryLabel {
  id: string;
  text: string;
  point: ChartPatternGeometryPoint;
}


export interface ChartPatternTargetProjection {
  breakoutPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  patternHeight: number;
  potentialGainPct: number;
  riskRewardRatio: number;
  projectionLine?: ChartPatternGeometryTrendLine;
}

export interface ChartPatternGeometry {
  family: ChartPatternGeometryFamily;
  pivotMarkers?: ChartPatternGeometryPivotMarker[];
  trendLines?: ChartPatternGeometryTrendLine[];
  zones?: ChartPatternGeometryZone[];
  labels?: ChartPatternGeometryLabel[];
  targetProjection?: ChartPatternTargetProjection;
}

export interface ChartPatternResultDetails {
  family: ChartPatternFamily;
  confidence: number;
  patternStartDate?: string;
  patternEndDate: string;
  breakoutLevel?: number;
  supportLevel?: number;
  resistanceLevel?: number;
  necklineLevel?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  potentialGainPct?: number;
  riskRewardRatio?: number;
  pivots?: ChartPatternPivot[];
  geometry?: ChartPatternGeometry;
}

export interface ChartPatternContext {
  bars: EodBar[];
  latest: EodBar;
  previous: EodBar;
}
