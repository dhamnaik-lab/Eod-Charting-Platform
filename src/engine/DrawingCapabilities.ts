import type { ChartDrawing, DrawingLabelPosition } from './types';

export type DrawingKind = ChartDrawing['kind'];

const EXTENDABLE_DRAWING_KINDS = new Set<DrawingKind>([
  'trendline',
  'infoLine',
  'trendAngle',
  'regressionTrend',
  'channel',
  'fib',
  'flatChannel',
  'disjointChannel',
  'andrewsPitchfork',
  'schiffPitchfork',
  'modifiedSchiffPitchfork',
  'insidePitchfork',
  'trendFibExtension',
  'fibChannel',
  'pitchfan',
]);



const LABEL_POSITION_CAPABLE_DRAWING_KINDS = new Set<DrawingKind>([
  'fib',
  'fibExtension',
  'fibTimeZone',
  'trendFibExtension',
  'fibChannel',
  'fibTimeExtension',
  'projection',
]);
const LABEL_CAPABLE_DRAWING_KINDS = new Set<DrawingKind>([
  'infoLine',
  'trendAngle',
  'priceRange',
  'dateRange',
  'regressionTrend',
  'fibTimeZone',
  'fibCircles',
  'fibArcs',
  'forecast',
  'fib',
  'fibExtension',
  'fibFan',
  'gann',
  'measure',
  'trendFibExtension',
  'fibChannel',
  'fibTimeExtension',
  'fibWedge',
  'pitchfan',
  'longPosition',
  'shortPosition',
  'projection',
]);

export function drawingSupportsExtension(kind: DrawingKind): boolean {
  return EXTENDABLE_DRAWING_KINDS.has(kind);
}


export function getEffectiveDrawingExtendRight(drawing: ChartDrawing): boolean {
  if (!drawingSupportsExtension(drawing.kind)) {
    return false;
  }

  // F1B.5: Fib Retracement follows the already-correct Trend-Based Fib plotting
  // style used in the user's TradingView reference: the level block extends to
  // the chart's right side by default. Explicit "Don't extend"/Left settings
  // persist as extendRight=false and remain authoritative.
  if (drawing.kind === 'fib') {
    return drawing.extendRight !== false;
  }

  return drawing.extendRight === true;
}

export function drawingSupportsLabelVisibility(kind: DrawingKind): boolean {
  return LABEL_CAPABLE_DRAWING_KINDS.has(kind);
}

export function drawingSupportsLabelPosition(kind: DrawingKind): boolean {
  return LABEL_POSITION_CAPABLE_DRAWING_KINDS.has(kind);
}

export function getDrawingLabelPosition(drawing: ChartDrawing): DrawingLabelPosition {
  if (!drawingSupportsLabelPosition(drawing.kind)) {
    return 'left';
  }
  return drawing.labelPosition === 'right' ? 'right' : 'left';
}

export function isDrawingLabelVisible(drawing: ChartDrawing): boolean {
  return drawingSupportsLabelVisibility(drawing.kind) && drawing.showLabel !== false;
}
