import { FIB_ARC_LEVELS, FIB_RADIAL_LEVELS, FIB_TIME_RATIOS, GANN_BOX_LEVELS } from './DrawingAdvancedGeometry';
import {
  FIB_CHANNEL_LEVELS,
  FIB_TIME_EXTENSION_LEVELS,
  FIB_WEDGE_LEVELS,
  PITCHFAN_LEVELS,
  TREND_FIB_EXTENSION_LEVELS,
} from './DrawingD3BGeometry';
import type { FibonacciLevelDefinition } from './DrawingFibonacciContracts';
import { getNormalizedFibonacciSettings } from './DrawingFibonacciMigration';
import type { ChartDrawing } from './types';
import type {
  DrawingPresentationSettings,
  UnifiedFillPresentationSettings,
  UnifiedLinePresentationSettings,
  UnifiedLineStyle,
  UnifiedSettingsTimeframe,
} from './UnifiedStyleContracts';
import { isVisibleOnTimeframe, normalizeUnitOpacity } from './UnifiedStyleContracts';

export type DrawingKind = ChartDrawing['kind'];
export type DrawingSettingsTab = 'inputs' | 'style' | 'coordinates' | 'visibility';
export const DRAWING_SETTINGS_TABS: ReadonlyArray<{ id: DrawingSettingsTab; label: string }> = [
  { id: 'style', label: 'Style' },
  { id: 'coordinates', label: 'Coordinates' },
  { id: 'visibility', label: 'Visibility' },
];
export const POSITION_DRAWING_SETTINGS_TABS: ReadonlyArray<{ id: DrawingSettingsTab; label: string }> = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'style', label: 'Style' },
  { id: 'visibility', label: 'Visibility' },
];

export type DrawingCoordinateMode = 'horizontal-price' | 'vertical-time' | 'point' | 'two-anchor' | 'multi-anchor';
export type DrawingCoordinateFieldKind = 'time' | 'value' | 'anchor-list';
export interface DrawingCoordinateFieldDefinition {
  id: string;
  label: string;
  kind: DrawingCoordinateFieldKind;
}
export type DrawingStyleSemantic = 'primary' | 'secondary' | 'center' | 'upper' | 'lower' | 'target' | 'entry' | 'stop' | 'level';

export interface DrawingLineSlotDefinition {
  id: string;
  label: string;
  semantic?: DrawingStyleSemantic;
  defaultVisible?: boolean;
  defaultLineStyle?: UnifiedLineStyle;
  defaultLineWidth?: number;
  defaultOpacity?: number;
  defaultColor?: string;
}

export interface DrawingFillSlotDefinition {
  id: string;
  label: string;
  defaultVisible?: boolean;
  defaultOpacity?: number;
  defaultColor?: string;
  /** When true, the renderer may derive band/background colors from adjacent line colors. */
  usesLineColors?: boolean;
}

export interface DrawingStyleSchema {
  kind: DrawingKind;
  lines: readonly DrawingLineSlotDefinition[];
  fills: readonly DrawingFillSlotDefinition[];
  supportsTextStyle: boolean;
  supportsLabelStyle: boolean;
  supportsUseOneColor: boolean;
  coordinateMode: DrawingCoordinateMode;
  supportsTimeframeVisibility: true;
}


const COORDINATE_FIELDS: Record<DrawingCoordinateMode, readonly DrawingCoordinateFieldDefinition[]> = {
  'horizontal-price': [{ id: 'price', label: 'Price / Value', kind: 'value' }],
  'vertical-time': [{ id: 'barIndex', label: 'Date / Time', kind: 'time' }],
  point: [
    { id: 'barIndex', label: 'Date / Time', kind: 'time' },
    { id: 'price', label: 'Price / Value', kind: 'value' },
  ],
  'two-anchor': [
    { id: 'startIndex', label: 'Point 1 Date / Time', kind: 'time' },
    { id: 'startPrice', label: 'Point 1 Price / Value', kind: 'value' },
    { id: 'endIndex', label: 'Point 2 Date / Time', kind: 'time' },
    { id: 'endPrice', label: 'Point 2 Price / Value', kind: 'value' },
  ],
  'multi-anchor': [{ id: 'anchors', label: 'Anchor Points', kind: 'anchor-list' }],
};

const FIB_RETRACEMENT_LEVELS = [
  0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.414, 1.618, 2, 2.272, 2.414, 2.618, 3.618, 4.236,
] as const;
const FIB_EXTENSION_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618, 2.618] as const;
const FIB_FAN_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1] as const;
const GANN_FAN_LEVELS = ['1x8', '1x4', '1x3', '1x2', '1x1', '2x1', '3x1', '4x1', '8x1'] as const;

const slot = (
  id: string,
  label: string,
  semantic: DrawingStyleSemantic = 'primary',
  defaults: Pick<DrawingLineSlotDefinition, 'defaultVisible' | 'defaultLineStyle' | 'defaultLineWidth' | 'defaultOpacity' | 'defaultColor'> = {},
): DrawingLineSlotDefinition => ({
  id,
  label,
  semantic,
  ...defaults,
});
const fill = (
  id: string,
  label: string,
  defaults: Pick<DrawingFillSlotDefinition, 'defaultVisible' | 'defaultOpacity' | 'defaultColor' | 'usesLineColors'> = {},
): DrawingFillSlotDefinition => ({ id, label, ...defaults });
const formatLevel = (value: number): string => (Number.isInteger(value) ? value.toFixed(3) : String(value).replace(/^0\./, '0.'));

const TV_FIB_LEVEL_COLORS = [
  '#787b86',
  '#f23645',
  '#ff9800',
  '#fdd835',
  '#26a69a',
  '#42a5f5',
  '#7e57c2',
  '#ab47bc',
  '#ec407a',
  '#26c6da',
] as const;
const fibLevelColor = (index: number): string => TV_FIB_LEVEL_COLORS[index % TV_FIB_LEVEL_COLORS.length];
const TV_FIB_CIRCLE_LEVEL_COLORS = [
  '#f23645',
  '#ff9800',
  '#089981',
  '#4caf50',
  '#00bcd4',
  '#787b86',
  '#2962ff',
  '#e91e63',
  '#2962ff',
  '#e91e63',
  '#f23645',
] as const;
const fibCircleLevelColor = (index: number): string =>
  TV_FIB_CIRCLE_LEVEL_COLORS[index % TV_FIB_CIRCLE_LEVEL_COLORS.length];
const TV_FIB_ARC_LEVEL_COLORS = [
  '#f23645',
  '#ff9800',
  '#089981',
  '#4caf50',
  '#00bcd4',
  '#787b86',
  '#2962ff',
  '#e91e63',
  '#2962ff',
  '#e91e63',
  '#f23645',
] as const;
const fibArcLevelColor = (index: number): string =>
  TV_FIB_ARC_LEVEL_COLORS[index % TV_FIB_ARC_LEVEL_COLORS.length];
const levelSlots = (
  levels: readonly number[],
  prefix = 'level',
  defaultsForLevel?: (value: number) => Pick<
    DrawingLineSlotDefinition,
    'defaultVisible' | 'defaultLineStyle' | 'defaultLineWidth' | 'defaultOpacity' | 'defaultColor'
  >,
): DrawingLineSlotDefinition[] =>
  levels.map((value, index) =>
    slot(`${prefix}:${value}`, formatLevel(value), 'level', { defaultColor: fibLevelColor(index), ...(defaultsForLevel?.(value) ?? {}) }),
  );

const trendGuideSlot = (label = 'Trend Line', defaultOpacity = 0.42): DrawingLineSlotDefinition =>
  slot('trend', label, 'secondary', { defaultOpacity });

const gannBoxSlots = (): DrawingLineSlotDefinition[] => [
  slot('border', 'Border'),
  slot('grid:0.25', '25.0% Grid', 'level', { defaultOpacity: 0.62 }),
  slot(`grid:${1 / 3}`, '33.3% Grid', 'level', { defaultOpacity: 0.62 }),
  slot('grid:0.5', '50.0% Grid', 'level', { defaultOpacity: 0.62 }),
  slot(`grid:${2 / 3}`, '66.7% Grid', 'level', { defaultOpacity: 0.62 }),
  slot('grid:0.75', '75.0% Grid', 'level', { defaultOpacity: 0.62 }),
  slot('diagonals', 'Diagonals', 'center', { defaultOpacity: 0.8 }),
];

const pitchforkSlots = (): DrawingLineSlotDefinition[] => [
  slot('median', 'Median', 'center'),
  slot('upper', 'Upper', 'upper', { defaultOpacity: 0.9 }),
  slot('lower', 'Lower', 'lower', { defaultOpacity: 0.9 }),
];

const pitchfanSlots = (): DrawingLineSlotDefinition[] =>
  PITCHFAN_LEVELS.map((value) =>
    slot(
      `ray:${value}`,
      value === 0.5 ? 'Median (50.0%)' : `${(value * 100).toFixed(1)}% Ray`,
      'level',
      { defaultOpacity: value === 0.382 || value === 0.5 || value === 0.618 ? 1 : 0.65 },
    ),
  );

const baseSchema = (
  kind: DrawingKind,
  coordinateMode: DrawingCoordinateMode,
  lines: readonly DrawingLineSlotDefinition[] = [slot('primary', 'Line')],
  fills: readonly DrawingFillSlotDefinition[] = [],
  options: Partial<Pick<DrawingStyleSchema, 'supportsTextStyle' | 'supportsLabelStyle' | 'supportsUseOneColor'>> = {},
): DrawingStyleSchema => ({
  kind,
  lines,
  fills,
  supportsTextStyle: options.supportsTextStyle ?? false,
  supportsLabelStyle: options.supportsLabelStyle ?? false,
  supportsUseOneColor: options.supportsUseOneColor ?? lines.length > 1,
  coordinateMode,
  supportsTimeframeVisibility: true,
});

const schemas: Record<DrawingKind, DrawingStyleSchema> = {
  hline: baseSchema('hline', 'horizontal-price'),
  vline: baseSchema('vline', 'vertical-time'),
  text: baseSchema('text', 'point', [], [], { supportsTextStyle: true, supportsUseOneColor: false }),
  horizontalRay: baseSchema('horizontalRay', 'point'),
  crossLine: baseSchema('crossLine', 'point', [slot('horizontal', 'Horizontal', 'primary'), slot('vertical', 'Vertical', 'secondary')]),
  arrowMarker: baseSchema('arrowMarker', 'point'),
  arrowUp: baseSchema('arrowUp', 'point'),
  arrowDown: baseSchema('arrowDown', 'point'),
  flatChannel: baseSchema(
    'flatChannel',
    'multi-anchor',
    [slot('trend', 'Trend Line', 'primary'), slot('flat', 'Flat Line', 'secondary')],
    [fill('channel', 'Channel Fill', { defaultVisible: true, defaultOpacity: 0.08 })],
  ),
  disjointChannel: baseSchema(
    'disjointChannel',
    'multi-anchor',
    [slot('first', 'First Line', 'primary'), slot('second', 'Second Line', 'secondary')],
    [fill('channel', 'Channel Fill', { defaultVisible: true, defaultOpacity: 0.08 })],
  ),
  triangle: baseSchema('triangle', 'multi-anchor', [slot('outline', 'Outline')], [fill('body', 'Fill')]),
  rotatedRect: baseSchema('rotatedRect', 'multi-anchor', [slot('outline', 'Outline')], [fill('body', 'Fill')]),
  arc: baseSchema('arc', 'multi-anchor'),
  andrewsPitchfork: baseSchema('andrewsPitchfork', 'multi-anchor', pitchforkSlots()),
  schiffPitchfork: baseSchema('schiffPitchfork', 'multi-anchor', pitchforkSlots()),
  modifiedSchiffPitchfork: baseSchema('modifiedSchiffPitchfork', 'multi-anchor', pitchforkSlots()),
  insidePitchfork: baseSchema('insidePitchfork', 'multi-anchor', pitchforkSlots()),
  trendFibExtension: baseSchema(
    'trendFibExtension',
    'multi-anchor',
    [trendGuideSlot('Trend Line', 0.4), ...levelSlots(TREND_FIB_EXTENSION_LEVELS)],
    [fill('background', 'Background', { defaultVisible: false, defaultOpacity: 0.08, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  fibChannel: baseSchema(
    'fibChannel',
    'multi-anchor',
    levelSlots(
      FIB_CHANNEL_LEVELS,
      'level',
      (value) => ({ defaultOpacity: value === 0 || value === 0.5 || value === 0.618 || value === 1 ? 1 : 0.65 }),
    ),
    [fill('bands', 'Channel Fill', { defaultVisible: false, defaultOpacity: 0.08 })],
    { supportsLabelStyle: true },
  ),
  fibTimeExtension: baseSchema(
    'fibTimeExtension',
    'multi-anchor',
    [
      trendGuideSlot('Trend Line', 0.4),
      ...levelSlots(
        FIB_TIME_EXTENSION_LEVELS,
        'level',
        (value) => ({ defaultOpacity: value === 0 || value === 0.5 || value === 1 || value === 1.618 ? 1 : 0.6 }),
      ),
    ],
    [fill('background', 'Background', { defaultVisible: false, defaultOpacity: 0.08, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  fibWedge: baseSchema(
    'fibWedge',
    'multi-anchor',
    [
      trendGuideSlot('Trend Line', 0.42),
      ...levelSlots(
        FIB_WEDGE_LEVELS,
        'level',
        (value) => ({
          defaultVisible: value <= 1,
          defaultOpacity: value === 0.382 || value === 0.5 || value === 0.618 || value === 1 ? 1 : 0.72,
        }),
      ),
    ],
    [fill('background', 'Background', { defaultVisible: true, defaultOpacity: 0.08, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  pitchfan: baseSchema('pitchfan', 'multi-anchor', pitchfanSlots(), [], { supportsLabelStyle: true }),
  longPosition: baseSchema(
    'longPosition',
    'multi-anchor',
    [
      slot('target', 'Target', 'target', { defaultColor: '#26a69a' }),
      slot('entry', 'Entry', 'entry', { defaultColor: '#2962ff' }),
      slot('stop', 'Stop', 'stop', { defaultColor: '#ef5350' }),
    ],
    [
      fill('reward', 'Target Zone', { defaultVisible: true, defaultOpacity: 0.14, defaultColor: '#26a69a' }),
      fill('risk', 'Stop Zone', { defaultVisible: true, defaultOpacity: 0.14, defaultColor: '#ef5350' }),
    ],
    { supportsLabelStyle: true },
  ),
  shortPosition: baseSchema(
    'shortPosition',
    'multi-anchor',
    [
      slot('target', 'Target', 'target', { defaultColor: '#26a69a' }),
      slot('entry', 'Entry', 'entry', { defaultColor: '#2962ff' }),
      slot('stop', 'Stop', 'stop', { defaultColor: '#ef5350' }),
    ],
    [
      fill('reward', 'Target Zone', { defaultVisible: true, defaultOpacity: 0.14, defaultColor: '#26a69a' }),
      fill('risk', 'Stop Zone', { defaultVisible: true, defaultOpacity: 0.14, defaultColor: '#ef5350' }),
    ],
    { supportsLabelStyle: true },
  ),
  projection: baseSchema(
    'projection',
    'multi-anchor',
    [slot('source', 'Measured Move', 'primary'), slot('projection', 'Projection', 'secondary'), slot('target', 'Target', 'target')],
    [],
    { supportsLabelStyle: true },
  ),
  trendline: baseSchema('trendline', 'two-anchor'),
  extendedLine: baseSchema('extendedLine', 'two-anchor'),
  infoLine: baseSchema('infoLine', 'two-anchor', [slot('primary', 'Line')], [], { supportsLabelStyle: true }),
  trendAngle: baseSchema('trendAngle', 'two-anchor', [slot('primary', 'Line')], [], { supportsLabelStyle: true }),
  priceRange: baseSchema('priceRange', 'two-anchor', [slot('primary', 'Range')], [fill('range', 'Range Fill')], { supportsLabelStyle: true }),
  dateRange: baseSchema('dateRange', 'two-anchor', [slot('primary', 'Range')], [fill('range', 'Range Fill')], { supportsLabelStyle: true }),
  regressionTrend: baseSchema(
    'regressionTrend',
    'two-anchor',
    [
      slot('upper', 'Upper', 'upper', { defaultLineWidth: 1.5 }),
      slot('basis', 'Basis', 'center', { defaultLineStyle: 'solid', defaultLineWidth: 1.5 }),
      slot('lower', 'Lower', 'lower', { defaultLineWidth: 1.5 }),
    ],
    [fill('channel', 'Channel Fill', { defaultVisible: true, defaultOpacity: 0.08 })],
    { supportsLabelStyle: true },
  ),
  fibTimeZone: baseSchema(
    'fibTimeZone',
    'two-anchor',
    [slot('initial', 'Initial Line', 'secondary', { defaultOpacity: 0.4 }), ...levelSlots(FIB_TIME_RATIOS)],
    [fill('background', 'Background', { defaultVisible: false, defaultOpacity: 0.08, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  fibCircles: baseSchema(
    'fibCircles',
    'two-anchor',
    [
      slot('trend', 'Trend Line', 'secondary', {
        defaultColor: '#787b86',
        defaultLineStyle: 'dashed',
        defaultOpacity: 0.82,
      }),
      ...FIB_RADIAL_LEVELS.map((value, index) =>
        slot(`circle:${value}`, formatLevel(value), 'level', { defaultColor: fibCircleLevelColor(index) }),
      ),
    ],
    [fill('background', 'Background', { defaultVisible: true, defaultOpacity: 0.12, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  fibSpiral: baseSchema(
    'fibSpiral',
    'two-anchor',
    [slot('spiral', 'Line', 'primary', { defaultLineWidth: 1.4 })],
  ),
  fibArcs: baseSchema(
    'fibArcs',
    'two-anchor',
    [
      slot('trend', 'Trend Line', 'secondary', {
        defaultColor: '#787b86',
        defaultLineStyle: 'dashed',
        defaultOpacity: 0.82,
      }),
      ...FIB_ARC_LEVELS.map((value, index) =>
        slot(`arc:${value}`, formatLevel(value), 'level', { defaultColor: fibArcLevelColor(index) }),
      ),
    ],
    [fill('background', 'Background', { defaultVisible: true, defaultOpacity: 0.12, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  gannBox: baseSchema(
    'gannBox',
    'two-anchor',
    gannBoxSlots(),
    [fill('box', 'Box Fill', { defaultVisible: false, defaultOpacity: 0.08 })],
  ),
  circle: baseSchema('circle', 'two-anchor', [slot('outline', 'Outline')], [fill('body', 'Fill')]),
  ellipse: baseSchema('ellipse', 'two-anchor', [slot('outline', 'Outline')], [fill('body', 'Fill')]),
  forecast: baseSchema('forecast', 'two-anchor', [slot('primary', 'Forecast')], [], { supportsLabelStyle: true }),
  ray: baseSchema('ray', 'two-anchor'),
  arrow: baseSchema('arrow', 'two-anchor'),
  rect: baseSchema('rect', 'two-anchor', [slot('outline', 'Outline')], [fill('body', 'Fill')]),
  channel: baseSchema(
    'channel',
    'two-anchor',
    [
      slot('base', 'Base', 'lower'),
      slot('center', 'Middle', 'center', { defaultLineStyle: 'dashed' }),
      slot('offset', 'Parallel', 'upper'),
    ],
    [fill('channel', 'Channel Fill', { defaultVisible: false, defaultOpacity: 0.08 })],
  ),
  fib: baseSchema(
    'fib',
    'two-anchor',
    [trendGuideSlot(), ...levelSlots(FIB_RETRACEMENT_LEVELS)],
    [fill('levels', 'Background', { defaultVisible: true, defaultOpacity: 0.06, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  fibExtension: baseSchema(
    'fibExtension',
    'two-anchor',
    [trendGuideSlot(), ...levelSlots(FIB_EXTENSION_LEVELS)],
    [fill('levels', 'Background', { defaultVisible: false, defaultOpacity: 0.06, usesLineColors: true })],
    { supportsLabelStyle: true },
  ),
  fibFan: baseSchema(
    'fibFan',
    'two-anchor',
    [trendGuideSlot(), ...levelSlots(FIB_FAN_LEVELS, 'ray')],
    [],
    { supportsLabelStyle: true },
  ),
  gann: baseSchema(
    'gann',
    'two-anchor',
    [trendGuideSlot(), ...GANN_FAN_LEVELS.map((ratio) => slot(`ray:${ratio}`, ratio, 'level'))],
    [],
    { supportsLabelStyle: true },
  ),
  measure: baseSchema('measure', 'two-anchor', [slot('primary', 'Measure')], [fill('range', 'Range Fill')], { supportsLabelStyle: true }),
  xabcdPattern: baseSchema(
    'xabcdPattern',
    'multi-anchor',
    [slot('outline', 'Pattern Lines', 'primary'), slot('ratios', 'Ratio Labels', 'secondary')],
    [fill('pattern', 'Pattern Fill', { defaultVisible: true, defaultOpacity: 0.12 })],
    { supportsLabelStyle: true },
  ),
  abcdPattern: baseSchema(
    'abcdPattern',
    'multi-anchor',
    [slot('outline', 'Pattern Lines', 'primary')],
    [],
    { supportsLabelStyle: true },
  ),
  headAndShouldersPattern: baseSchema(
    'headAndShouldersPattern',
    'multi-anchor',
    [slot('outline', 'Pattern Lines', 'primary'), slot('neckline', 'Neckline', 'secondary', { defaultLineStyle: 'dashed' })],
    [fill('shoulders', 'Shoulders Fill', { defaultVisible: true, defaultOpacity: 0.10 })],
    { supportsLabelStyle: true },
  ),
  elliottImpulse: baseSchema(
    'elliottImpulse',
    'multi-anchor',
    [slot('outline', 'Wave Lines', 'primary')],
    [],
    { supportsLabelStyle: true },
  ),
  elliottCorrection: baseSchema(
    'elliottCorrection',
    'multi-anchor',
    [slot('outline', 'Wave Lines', 'primary')],
    [],
    { supportsLabelStyle: true },
  ),
};

export const ADVANCED_DRAWING_STYLE_KINDS = [
  'regressionTrend',
  'channel',
  'flatChannel',
  'disjointChannel',
  'andrewsPitchfork',
  'schiffPitchfork',
  'modifiedSchiffPitchfork',
  'insidePitchfork',
  'pitchfan',
  'trendFibExtension',
  'fibChannel',
  'fibTimeExtension',
  'fibWedge',
  'fibTimeZone',
  'fibCircles',
  'fibSpiral',
  'fibArcs',
  'gannBox',
  'fib',
  'fibExtension',
  'fibFan',
  'gann',
  'longPosition',
  'shortPosition',
] as const satisfies readonly DrawingKind[];

export type AdvancedDrawingStyleKind = (typeof ADVANCED_DRAWING_STYLE_KINDS)[number];

export function isAdvancedDrawingStyleKind(kind: DrawingKind): kind is AdvancedDrawingStyleKind {
  return (ADVANCED_DRAWING_STYLE_KINDS as readonly DrawingKind[]).includes(kind);
}

export function getDrawingStyleSchema(kind: DrawingKind): DrawingStyleSchema {
  return schemas[kind];
}

function stableFibonacciLevelSlots(
  levels: readonly FibonacciLevelDefinition[],
  prefix: 'level' | 'price' | 'time' = 'level',
): DrawingLineSlotDefinition[] {
  return levels.map((level, index) =>
    slot(`${prefix}:${level.id}`, formatLevel(level.value), 'level', {
      defaultVisible: level.enabled !== false,
      defaultColor: fibLevelColor(index),
    }),
  );
}

/**
 * F1A instance-aware schema. This is intentionally separate from the legacy
 * kind-only schema until each renderer migrates to stable level IDs in F1B-F1D.
 * It lets the upcoming shared Fibonacci editor use editable coefficients without
 * changing current renderer output in the foundation patch.
 */
export function getDrawingStyleSchemaForDrawing(drawing: ChartDrawing): DrawingStyleSchema {
  const base = getDrawingStyleSchema(drawing.kind);
  const settings = getNormalizedFibonacciSettings(drawing);
  if (!settings) return base;

  const nonLevelLines = base.lines.filter((line) => line.semantic !== 'level');
  if (settings.kind === 'fibFan') {
    return {
      ...base,
      lines: [
        ...nonLevelLines,
        ...stableFibonacciLevelSlots(settings.priceLevels, 'price'),
        ...stableFibonacciLevelSlots(settings.timeLevels, 'time'),
      ],
    };
  }

  if ('levels' in settings) {
    return {
      ...base,
      lines: [...nonLevelLines, ...stableFibonacciLevelSlots(settings.levels)],
    };
  }

  return base;
}

export function getDrawingStyleSchemas(): readonly DrawingStyleSchema[] {
  return Object.values(schemas);
}

export function getDrawingCoordinateFields(kind: DrawingKind): readonly DrawingCoordinateFieldDefinition[] {
  return COORDINATE_FIELDS[getDrawingStyleSchema(kind).coordinateMode];
}

export function getDrawingSettingsTabs(kind: DrawingKind): ReadonlyArray<{ id: DrawingSettingsTab; label: string }> {
  return kind === 'longPosition' || kind === 'shortPosition' ? POSITION_DRAWING_SETTINGS_TABS : DRAWING_SETTINGS_TABS;
}

export type ResolvedDrawingLinePresentation = Required<
  Pick<UnifiedLinePresentationSettings, 'visible' | 'color' | 'lineWidth' | 'lineStyle' | 'opacity'>
>;
export type ResolvedDrawingFillPresentation = Required<
  Pick<UnifiedFillPresentationSettings, 'visible' | 'color' | 'opacity'>
>;

export function getDrawingLinePresentationDefaults(
  drawing: ChartDrawing,
  slotId: string,
): ResolvedDrawingLinePresentation {
  const slotDefinition = getDrawingStyleSchema(drawing.kind).lines.find((slot) => slot.id === slotId);
  return {
    visible: slotDefinition?.defaultVisible !== false,
    color: slotDefinition?.defaultColor ?? drawing.color,
    lineWidth: drawing.lineWidth ?? slotDefinition?.defaultLineWidth ?? 1.4,
    lineStyle: slotDefinition?.defaultLineStyle ?? drawing.lineStyle ?? 'solid',
    opacity: normalizeUnitOpacity(slotDefinition?.defaultOpacity, 1),
  };
}

export function getDrawingFillPresentationDefaults(
  drawing: ChartDrawing,
  slotId: string,
): ResolvedDrawingFillPresentation {
  const slotDefinition = getDrawingStyleSchema(drawing.kind).fills.find((slot) => slot.id === slotId);
  return {
    visible: slotDefinition?.defaultVisible !== false,
    color: slotDefinition?.defaultColor ?? drawing.color,
    opacity: normalizeUnitOpacity(slotDefinition?.defaultOpacity, 0.08),
  };
}

export function resolveDrawingLinePresentationForSlot(
  drawing: ChartDrawing,
  slotId: string,
): ResolvedDrawingLinePresentation {
  return resolveDrawingLinePresentation(drawing, slotId, getDrawingLinePresentationDefaults(drawing, slotId));
}

export function resolveDrawingFillPresentationForSlot(
  drawing: ChartDrawing,
  slotId: string,
): ResolvedDrawingFillPresentation {
  return resolveDrawingFillPresentation(drawing, slotId, getDrawingFillPresentationDefaults(drawing, slotId));
}

export function createDrawingPresentationDraft(drawing: ChartDrawing): DrawingPresentationSettings {
  const schema = getDrawingStyleSchema(drawing.kind);
  return {
    ...drawing.presentation,
    // S2.3.1 removes the visible shared-color gate. Persisted shared-color drawings
    // are expanded into their current effective per-line colors when Properties opens.
    useOneColor: false,
    lines: {
      ...drawing.presentation?.lines,
      ...Object.fromEntries(
        schema.lines.map((slotDefinition) => {
          const resolved = resolveDrawingLinePresentationForSlot(drawing, slotDefinition.id);
          const saved = drawing.presentation?.lines?.[slotDefinition.id];
          const color = drawing.presentation?.useOneColor === true ? resolved.color : saved?.color ?? resolved.color;
          return [slotDefinition.id, { ...resolved, color }];
        }),
      ),
    },
    fills: {
      ...drawing.presentation?.fills,
      ...Object.fromEntries(
        schema.fills.map((slotDefinition) => [
          slotDefinition.id,
          resolveDrawingFillPresentationForSlot(drawing, slotDefinition.id),
        ]),
      ),
    },
  };
}

export function resolveDrawingLinePresentation(
  drawing: ChartDrawing,
  slotId: string,
  defaults: Required<Pick<UnifiedLinePresentationSettings, 'visible' | 'color' | 'lineWidth' | 'lineStyle' | 'opacity'>> = {
    visible: true,
    color: drawing.color,
    lineWidth: drawing.lineWidth ?? 1.4,
    lineStyle: drawing.lineStyle ?? 'solid',
    opacity: 1,
  },
): Required<Pick<UnifiedLinePresentationSettings, 'visible' | 'color' | 'lineWidth' | 'lineStyle' | 'opacity'>> {
  const override = drawing.presentation?.lines?.[slotId];
  const sharedColor = drawing.presentation?.useOneColor === true;
  return {
    visible: override?.visible ?? defaults.visible,
    color: sharedColor ? drawing.color : override?.color ?? defaults.color,
    lineWidth: Number.isFinite(override?.lineWidth) && (override?.lineWidth ?? 0) > 0 ? override!.lineWidth! : defaults.lineWidth,
    lineStyle: override?.lineStyle ?? defaults.lineStyle,
    opacity: normalizeUnitOpacity(override?.opacity, defaults.opacity),
  };
}

export function resolveDrawingFillPresentation(
  drawing: ChartDrawing,
  slotId: string,
  defaults: Required<Pick<UnifiedFillPresentationSettings, 'visible' | 'color' | 'opacity'>>,
): Required<Pick<UnifiedFillPresentationSettings, 'visible' | 'color' | 'opacity'>> {
  const override = drawing.presentation?.fills?.[slotId];
  return {
    visible: override?.visible ?? defaults.visible,
    color: override?.color ?? defaults.color,
    opacity: normalizeUnitOpacity(override?.opacity, defaults.opacity),
  };
}

export function isDrawingVisibleOnTimeframe(drawing: ChartDrawing, timeframe: UnifiedSettingsTimeframe): boolean {
  return isVisibleOnTimeframe(drawing.visibility, timeframe);
}
