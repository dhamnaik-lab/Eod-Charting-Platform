import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import type { DrawingLineStyle, IndicatorLevelSettings, IndicatorPlotSettings, OHLCBar, OverlayIndicator } from '@/engine/types';
import { getEligibleStudySourceChoices, studySourceOptionValue } from '@/indicators/studySourceChoices';
import { getIndicatorCatalogItemByKind } from '@/indicators/catalog';
import { SUPPORTED_PATTERNS } from '@/engine/Patterns';
import { saveCandlestickSettings } from '@/features/candlestick/candlestickSettingsService';
import { useDraggableFloatingWindow } from './common/useDraggableFloatingWindow';
import { ColorToolbox } from './common/ColorToolbox';

interface IndicatorSettingsDialogProps {
  indicator: OverlayIndicator;
  allIndicators?: OverlayIndicator[];
  sourceBars?: OHLCBar[];
  onSave: (updated: OverlayIndicator) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

const SETTINGS_DIALOG_POS_KEY = 'eod-chart.floating-pos.indicator-settings.v1';

export function IndicatorSettingsDialog({ indicator, allIndicators = [], sourceBars = [], onSave, onRemove, onClose }: IndicatorSettingsDialogProps) {
  const [draft, setDraft] = useState<OverlayIndicator>(() => cloneIndicator(indicator));
  const [activeTab, setActiveTab] = useState<IndicatorSettingsTab>('inputs');

  const { position, handlePointerDown, isDragging, resetPosition } = useDraggableFloatingWindow({
    storageKey: SETTINGS_DIALOG_POS_KEY,
    width: 440,
    height: 480,
  });

  // Reset draft when a different indicator is opened while this component stays mounted
  useEffect(() => {
    setDraft(cloneIndicator(indicator));
    setActiveTab('inputs');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicator.id]);

  const handleSave = () => {
    if (draft.kind === 'PATTERN') {
      saveCandlestickSettings({
        patterns: draft.patterns ?? [],
        bullColor: draft.bullColor ?? '#22c55e',
        bearColor: draft.bearColor ?? '#ef4444',
        neutralColor: draft.neutralColor ?? '#f59e0b',
      });
    }
    onSave(draft);
  };

  return (
    <>
      <div style={clearBackdropStyle} onMouseDown={() => onClose()} aria-hidden="true" />
      <div
        className="floating-indicator-settings-dialog"
        style={{
          ...dialogPanelStyle,
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : 'default',
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          style={dialogHeaderStyle}
          onPointerDown={handlePointerDown}
          title="Click and drag to move window anywhere over chart"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}>
            <strong style={{ fontSize: 13, color: 'var(--text)' }}>
              {getIndicatorCatalogItemByKind(draft.kind)?.label ?? draft.kind}
            </strong>
            <span style={dragHandleBadgeStyle}>⠿ Drag</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              style={headerIconButtonStyle}
              onClick={resetPosition}
              title="Reset window position to center"
            >
              ⤢
            </button>
            <button
              type="button"
              style={dialogCloseStyle}
              onClick={() => onClose()}
              title="Close (Escape)"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        <div style={dialogBodyStyle}>
          <div style={dialogPlacementStyle}>
            {draft.placement === 'overlay' ? 'Overlay on price chart' : 'Separate indicator pane'}
          </div>
          <IndicatorFields
            draft={draft}
            setDraft={setDraft}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            allIndicators={allIndicators}
            sourceBars={sourceBars}
          />
        </div>
        <div style={dialogFooterStyle}>
          <button
            type="button"
            style={{ ...actionButtonStyle, minWidth: 88 }}
            onClick={() => onRemove(draft.id)}
          >
            Remove
          </button>
          <button type="button" style={{ ...actionButtonStyle, minWidth: 88 }} onClick={() => onClose()}>
            Cancel
          </button>
          <button
            type="button"
            style={{ ...actionButtonStyle, minWidth: 88, borderColor: 'var(--accent)', color: 'var(--text)' }}
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </>
  );
}

type IndicatorSettingsTab = 'inputs' | 'style' | 'levels' | 'scale' | 'visibility';
type IndicatorKind = OverlayIndicator['kind'];

type IndicatorVariant<K extends IndicatorKind> = Extract<OverlayIndicator, { kind: K }>;
type IndicatorValueKey<K extends IndicatorKind, V> = {
  [P in keyof IndicatorVariant<K>]-?: NonNullable<IndicatorVariant<K>[P]> extends V ? P : never;
}[keyof IndicatorVariant<K>] & string;

type ValidSchemaField<K extends IndicatorKind, F> =
  F extends { kind: 'number'; key: infer Key }
    ? Key extends IndicatorValueKey<K, number> ? F : never
    : F extends { kind: 'color'; key: infer Key }
      ? Key extends IndicatorValueKey<K, string> ? F : never
      : F extends { kind: 'source'; key: 'source' }
        ? 'source' extends keyof IndicatorVariant<K> ? F : never
        : F extends { kind: 'patterns' }
          ? K extends 'PATTERN' ? F : never
          : never;

type ValidSchemaFieldList<K extends IndicatorKind, Fields> =
  Fields extends readonly (infer F)[]
    ? Exclude<F, ValidSchemaField<K, F>> extends never ? Fields : never
    : never;

type CheckedIndicatorSchema<K extends IndicatorKind, Schema> =
  Schema extends { inputs: infer Inputs; style: infer Style }
    ? ValidSchemaFieldList<K, Inputs> extends never ? never
      : ValidSchemaFieldList<K, Style> extends never ? never : Schema
    : never;

// Compile-time only guard: schema keys must belong to the exact indicator variant.
// This function returns the original registry unchanged at runtime.
function defineIndicatorSettingsSchemas<
  const Schemas extends Partial<Record<IndicatorKind, IndicatorSettingsSchema>>,
>(
  schemas: Schemas & {
    [K in keyof Schemas]: K extends IndicatorKind
      ? CheckedIndicatorSchema<K, Schemas[K]>
      : never;
  },
): Schemas {
  return schemas;
}

// Type-only regression checks. A misleading field must fail even when its
// name exists on some *other* indicator or has the wrong value type.
type AssertSchemaCondition<Condition extends true> = Condition;
type SchemaFieldContractChecks = [
  AssertSchemaCondition<
    CheckedIndicatorSchema<'STDEV', {
      inputs: [{ kind: 'source'; key: 'source' }]; style: [];
    }> extends never ? true : false
  >,
  AssertSchemaCondition<
    CheckedIndicatorSchema<'TWAP', {
      inputs: [{ kind: 'number'; key: 'period' }]; style: [];
    }> extends never ? true : false
  >,
  AssertSchemaCondition<
    CheckedIndicatorSchema<'CPR', {
      inputs: [{ kind: 'number'; key: 'pivotColor' }]; style: [];
    }> extends never ? true : false
  >,
  AssertSchemaCondition<
    CheckedIndicatorSchema<'AVWAP', {
      inputs: [{ kind: 'source'; key: 'source' }]; style: [];
    }> extends never ? true : false
  >,
  AssertSchemaCondition<
    CheckedIndicatorSchema<'STOCHRSI', {
      inputs: [{ kind: 'number'; key: 'rsiPeriod' }];
      style: [{ kind: 'color'; key: 'signalColor' }];
    }> extends never ? false : true
  >,
  AssertSchemaCondition<
    CheckedIndicatorSchema<'TWAP', {
      inputs: [{ kind: 'source'; key: 'source' }];
      style: [{ kind: 'color'; key: 'color' }];
    }> extends never ? false : true
  >,
];

interface IndicatorFieldDefinition {
  id: string;
  label: string;
  key?: string;
  kind: 'number' | 'source' | 'color' | 'patterns';
  step?: string;
  min?: number;
  max?: number;
  toInputValue?: (value: string) => string;
  fromInputValue?: (value: string) => string;
}

interface IndicatorSettingsSchema {
  inputs: IndicatorFieldDefinition[];
  style: IndicatorFieldDefinition[];
  plots?: IndicatorPlotControlDefinition[];
  levels?: IndicatorLevelDefinition[];
}

interface IndicatorPlotControlDefinition {
  id: string;
  label: string;
  kind: 'line' | 'histogram' | 'band';
  // Defaults to visible for existing supported plot controls.
  plotStyleEditable?: boolean;
  opacityEditable?: boolean;
  colorFallbackKey?: string;
  secondaryColorFallbackKey?: string;
  secondaryColorLabel?: string;
  positiveColorFallbackKey?: string;
  negativeColorFallbackKey?: string;
  defaultColor?: string;
  defaultLineWidth?: number;
  defaultVisible?: boolean;
}

interface IndicatorLevelDefinition {
  id: string;
  label: string;
  value: number;
}

const INDICATOR_SETTINGS_TABS: Array<{ id: IndicatorSettingsTab; label: string }> = [
  { id: 'inputs', label: 'Inputs' },
  { id: 'style', label: 'Style' },
  { id: 'levels', label: 'Levels' },
  { id: 'scale', label: 'Scale' },
  { id: 'visibility', label: 'Visibility' },
];

const numberField = <Key extends string>(
  key: Key, label: string, step = '1', min?: number, max?: number,
): IndicatorFieldDefinition & { key: Key; kind: 'number' } => ({
  id: key,
  key,
  label,
  kind: 'number',
  step,
  min,
  max,
});

const sourceField = (): IndicatorFieldDefinition & { key: 'source'; kind: 'source' } => ({
  id: 'source',
  key: 'source',
  label: 'Source',
  kind: 'source',
});

const colorField = <Key extends string>(
  key: Key,
  label: string,
  valueTransforms?: Pick<IndicatorFieldDefinition, 'toInputValue' | 'fromInputValue'>,
): IndicatorFieldDefinition & { key: Key; kind: 'color' } => ({
  id: key,
  key,
  label,
  kind: 'color',
  ...valueTransforms,
});

const patternsField = (): IndicatorFieldDefinition & { kind: 'patterns' } => ({
  id: 'patterns',
  label: 'Patterns',
  kind: 'patterns',
});

const periodInput = numberField('period', 'Period');
const supertrendPeriodInput = numberField('period', 'ATR Period', '1', 1, 500);
const supertrendMultiplierInput = numberField('multiplier', 'Factor', '0.1', 0.1, 20);
const fastSlowInputs = [numberField('fastPeriod', 'Fast Period'), numberField('slowPeriod', 'Slow Period')];
const standardStyle = [colorField('color', 'Color')];
const standardPeriodSchema = { inputs: [periodInput], style: standardStyle };
const standardSourceSchema = { inputs: [periodInput, sourceField()], style: standardStyle };
const periodStdDevSchema = { inputs: [periodInput, numberField('stdDev', 'StdDev', '0.1')], style: standardStyle };
const histogramColorTransforms = {
  toInputValue: toHexColor,
  fromInputValue: (value: string) => toRgbaColor(value, 0.75),
};

const macdPlotControls: IndicatorPlotControlDefinition[] = [
  {
    id: 'macd',
    label: 'MACD',
    kind: 'line',
    plotStyleEditable: false,
    opacityEditable: false,
    colorFallbackKey: 'color',
    defaultLineWidth: 1.8,
  },
  {
    id: 'signal',
    label: 'Signal',
    kind: 'line',
    plotStyleEditable: false,
    opacityEditable: false,
    colorFallbackKey: 'signalColor',
    defaultLineWidth: 1.4,
  },
  {
    id: 'histogram',
    label: 'Histogram',
    kind: 'histogram',
    opacityEditable: false,
    positiveColorFallbackKey: 'histogramPositiveColor',
    negativeColorFallbackKey: 'histogramNegativeColor',
  },
];

const adxPlotControls: IndicatorPlotControlDefinition[] = [
  {
    id: 'adx',
    label: 'ADX',
    kind: 'line',
    colorFallbackKey: 'color',
    defaultLineWidth: 1.8,
  },
  {
    id: 'plusDI',
    label: '+DI',
    kind: 'line',
    colorFallbackKey: 'plusColor',
    defaultLineWidth: 1.4,
  },
  {
    id: 'minusDI',
    label: '-DI',
    kind: 'line',
    colorFallbackKey: 'minusColor',
    defaultLineWidth: 1.4,
  },
];

const bollingerPlotControls: IndicatorPlotControlDefinition[] = [
  {
    id: 'basis',
    label: 'Basis',
    kind: 'line',
    colorFallbackKey: 'color',
    defaultLineWidth: 1,
  },
  {
    id: 'upper',
    label: 'Upper Band Line',
    kind: 'line',
    colorFallbackKey: 'color',
    defaultLineWidth: 1,
    defaultVisible: false,
  },
  {
    id: 'lower',
    label: 'Lower Band Line',
    kind: 'line',
    colorFallbackKey: 'color',
    defaultLineWidth: 1,
    defaultVisible: false,
  },
  {
    id: 'band',
    label: 'Band Fill',
    kind: 'band',
    colorFallbackKey: 'color',
  },
];

const supertrendPlotControls: IndicatorPlotControlDefinition[] = [
  {
    id: 'line',
    label: 'Supertrend Line',
    kind: 'line',
    colorFallbackKey: 'upColor',
    secondaryColorFallbackKey: 'downColor',
    secondaryColorLabel: 'Down Color',
    defaultLineWidth: 2,
  },
];

const ichimokuPlotControls: IndicatorPlotControlDefinition[] = [
  {
    id: 'conversion',
    label: 'Conversion',
    kind: 'line',
    colorFallbackKey: 'conversionColor',
    defaultLineWidth: 1.2,
  },
  {
    id: 'base',
    label: 'Base',
    kind: 'line',
    colorFallbackKey: 'baseColor',
    defaultLineWidth: 1.2,
  },
  {
    id: 'spanA',
    label: 'Span A',
    kind: 'line',
    defaultColor: '#00b4d8',
    defaultLineWidth: 0.8,
  },
  {
    id: 'spanB',
    label: 'Span B',
    kind: 'line',
    defaultColor: '#ff4d6d',
    defaultLineWidth: 0.8,
  },
  {
    id: 'lagging',
    label: 'Lagging',
    kind: 'line',
    colorFallbackKey: 'laggingColor',
    defaultLineWidth: 1,
  },
  {
    id: 'cloud',
    label: 'Cloud Fill',
    kind: 'band',
    defaultColor: '#26a69a',
  },
];

const rsiLevels: IndicatorLevelDefinition[] = [
  { id: 'oversold', label: 'Oversold', value: 30 },
  { id: 'overbought', label: 'Overbought', value: 70 },
];

const stochasticLevels: IndicatorLevelDefinition[] = [
  { id: 'oversold', label: 'Oversold', value: 20 },
  { id: 'overbought', label: 'Overbought', value: 80 },
];

const cciLevels: IndicatorLevelDefinition[] = [
  { id: 'lower', label: 'Lower', value: -100 },
  { id: 'upper', label: 'Upper', value: 100 },
];

const INDICATOR_SETTINGS_SCHEMAS = defineIndicatorSettingsSchemas({
  STOCHRSI: {
    inputs: [
      numberField('rsiPeriod', 'RSI Period', '1', 1),
      numberField('stochPeriod', 'Stochastic Period', '1', 1),
      numberField('kPeriod', '%K Smoothing', '1', 1),
      numberField('dPeriod', '%D Smoothing', '1', 1),
    ],
    style: [colorField('color', '%K Color'), colorField('signalColor', '%D Color')],
  },
  CPR: {
    inputs: [],
    style: [
      colorField('pivotColor', 'Pivot Color'),
      colorField('tcColor', 'Top Central Color'),
      colorField('bcColor', 'Bottom Central Color'),
    ],
  },
  // Anchor editing needs its own date/index validation and UX contract.
  // Keep AVWAP anchor selection unchanged; only expose the supported line color.
  AVWAP: { inputs: [], style: standardStyle },
  SMA: standardSourceSchema,
  EMA: standardSourceSchema,
  WMA: standardSourceSchema,
  WEMA: standardSourceSchema,
  DEMA: standardSourceSchema,
  TEMA: standardSourceSchema,
  RSI: { ...standardSourceSchema, levels: rsiLevels },
  ROC: standardSourceSchema,
  MOM: standardSourceSchema,
  CCI: { ...standardPeriodSchema, levels: cciLevels },
  WILLR: standardPeriodSchema,
  ATR: standardPeriodSchema,
  MFI: standardPeriodSchema,
  CMF: standardPeriodSchema,
  KAMA: standardPeriodSchema,
  HMA: standardPeriodSchema,
  CMO: standardPeriodSchema,
  TRIX: standardPeriodSchema,
  DPO: standardPeriodSchema,
  DONCHIAN: standardPeriodSchema,
  FORCE_INDEX: standardPeriodSchema,
  LSMA: { inputs: [periodInput, numberField('offset', 'Offset', '1'), sourceField()], style: standardStyle },
  VWMA: { inputs: [periodInput, sourceField()], style: standardStyle },
  MCGINLEY: { inputs: [periodInput, numberField('k', 'K Factor', '0.1'), sourceField()], style: standardStyle },
  ALLIGATOR: {
    inputs: [
      numberField('jawPeriod', 'Jaw Period'),
      numberField('jawOffset', 'Jaw Offset'),
      numberField('teethPeriod', 'Teeth Period'),
      numberField('teethOffset', 'Teeth Offset'),
      numberField('lipsPeriod', 'Lips Period'),
      numberField('lipsOffset', 'Lips Offset'),
    ],
    style: [
      colorField('jawColor', 'Jaw Color'),
      colorField('teethColor', 'Teeth Color'),
      colorField('lipsColor', 'Lips Color'),
    ],
  },
  MA_CROSS: {
    inputs: [numberField('fastPeriod', 'Fast Period'), numberField('slowPeriod', 'Slow Period')],
    style: [
      colorField('fastColor', 'Fast MA Color'),
      colorField('slowColor', 'Slow MA Color'),
      colorField('crossColor', 'Cross Signal Color'),
    ],
  },
  MA_RIBBON: {
    inputs: [
      numberField('period1', 'MA 1 Period'),
      numberField('period2', 'MA 2 Period'),
      numberField('period3', 'MA 3 Period'),
      numberField('period4', 'MA 4 Period'),
    ],
    style: [
      colorField('color1', 'MA 1 Color'),
      colorField('color2', 'MA 2 Color'),
      colorField('color3', 'MA 3 Color'),
      colorField('color4', 'MA 4 Color'),
    ],
  },
  AO: {
    inputs: fastSlowInputs,
    style: [colorField('positiveColor', 'Up Color'), colorField('negativeColor', 'Down Color')],
  },
  TSI: {
    inputs: [numberField('longLength', 'Long Length'), numberField('shortLength', 'Short Length'), numberField('signalLength', 'Signal Length')],
    style: [colorField('color', 'TSI Color'), colorField('signalColor', 'Signal Color')],
  },
  CRSI: {
    inputs: [numberField('rsiLength', 'RSI Length'), numberField('upDownLength', 'UpDown Length'), numberField('rocLength', 'ROC Length')],
    style: standardStyle,
    levels: rsiLevels,
  },
  RVI: {
    inputs: [numberField('length', 'Length')],
    style: [colorField('color', 'RVI Color'), colorField('signalColor', 'Signal Color')],
  },
  FISHER: {
    inputs: [periodInput],
    style: [colorField('color', 'Fisher Color'), colorField('signalColor', 'Trigger Color')],
  },
  SMI_ERGODIC: {
    inputs: [numberField('longLength', 'Long Length'), numberField('shortLength', 'Short Length'), numberField('signalLength', 'Signal Length')],
    style: [colorField('color', 'SMI Color'), colorField('signalColor', 'Signal Color')],
  },
  SMI_ERGODIC_OSC: {
    inputs: [numberField('longLength', 'Long Length'), numberField('shortLength', 'Short Length'), numberField('signalLength', 'Signal Length')],
    style: [colorField('positiveColor', 'Up Color'), colorField('negativeColor', 'Down Color')],
  },
  PRING_SPECIAL_K: { inputs: [], style: standardStyle },
  RCI: {
    inputs: [periodInput, numberField('signalPeriod', 'Signal Period')],
    style: [colorField('color', 'RCI Color'), colorField('signalColor', 'Signal Color')],
  },
  WOODIES_CCI: {
    inputs: [numberField('cciPeriod', 'CCI Period'), numberField('turboPeriod', 'Turbo Period')],
    style: [
      colorField('cciColor', 'CCI Color'),
      colorField('turboColor', 'Turbo Color'),
      colorField('histogramPositiveColor', 'Histogram Up Color'),
      colorField('histogramNegativeColor', 'Histogram Down Color'),
    ],
    levels: cciLevels,
  },
  ENVELOPE: {
    inputs: [periodInput, numberField('percent', 'Percent (%)', '0.5'), sourceField()],
    style: [
      colorField('basisColor', 'Basis Color'),
      colorField('upperColor', 'Upper Band Color'),
      colorField('lowerColor', 'Lower Band Color'),
    ],
  },
  HV: { inputs: [periodInput, numberField('annual', 'Annual Days')], style: standardStyle },
  // STDEV currently calculates from Close only; do not expose an ineffective Source selector.
  STDEV: standardPeriodSchema,
  RVI_VOL: {
    inputs: [periodInput, numberField('signalPeriod', 'Signal Period')],
    style: [colorField('color', 'RVI Color'), colorField('signalColor', 'Signal Color')],
    levels: rsiLevels,
  },
  CHANDE_KROLL: {
    inputs: [
      numberField('atrPeriod', 'ATR Period (p)'),
      numberField('atrMultiplier', 'ATR Multiplier (x)', '0.5'),
      numberField('stopPeriod', 'Stop Length (q)'),
    ],
    style: [colorField('longColor', 'Long Stop Color'), colorField('shortColor', 'Short Stop Color')],
  },
  VOLATILITY_STOP: {
    inputs: [periodInput, numberField('multiplier', 'ATR Factor', '0.25')],
    style: [colorField('longColor', 'Long Stop Color'), colorField('shortColor', 'Short Stop Color')],
  },
  ULCER_INDEX: standardPeriodSchema,
  CHOP: {
    inputs: [periodInput],
    style: standardStyle,
    levels: [
      { id: 'lower', label: 'Trending (<38.2)', value: 38.2 },
      { id: 'upper', label: 'Choppy (>61.8)', value: 61.8 },
    ],
  },
  CHOP_ZONE: { inputs: [numberField('period', 'Period')], style: [] },
  BBTREND: {
    inputs: [
      numberField('shortPeriod', 'Short BB Length'),
      numberField('longPeriod', 'Long BB Length'),
      numberField('stdDev', 'StdDev Multiplier', '0.1'),
    ],
    style: [colorField('positiveColor', 'Up Color'), colorField('negativeColor', 'Down Color')],
  },
  VOL_OSC: { inputs: fastSlowInputs, style: standardStyle },
  CHAIKIN_OSC: { inputs: fastSlowInputs, style: standardStyle },
  KVO: {
    inputs: [...fastSlowInputs, numberField('signalPeriod', 'Signal Period')],
    style: [colorField('color', 'KVO Color'), colorField('signalColor', 'Signal Color')],
  },
  PVT: { inputs: [], style: standardStyle },
  PVI: {
    inputs: [numberField('signalPeriod', 'Signal Period')],
    style: [colorField('color', 'PVI Color'), colorField('signalColor', 'Signal Color')],
  },
  NVI: {
    inputs: [numberField('signalPeriod', 'Signal Period')],
    style: [colorField('color', 'NVI Color'), colorField('signalColor', 'Signal Color')],
  },
  CVD: {
    inputs: [],
    style: [colorField('positiveColor', 'Up Color'), colorField('negativeColor', 'Down Color')],
  },
  VOLUME_DELTA: {
    inputs: [],
    style: [colorField('positiveColor', 'Up Color'), colorField('negativeColor', 'Down Color')],
  },
  RVOL: { inputs: [periodInput], style: standardStyle },
  UP_DOWN_VOL: {
    inputs: [],
    style: [colorField('upColor', 'Up Color'), colorField('downColor', 'Down Color'), colorField('deltaColor', 'Delta Color')],
  },
  NET_VOLUME: {
    inputs: [],
    style: [colorField('positiveColor', 'Up Color'), colorField('negativeColor', 'Down Color')],
  },
  EOM: {
    inputs: [periodInput, numberField('divisor', 'Divisor', '1000')],
    style: standardStyle,
  },
  // TWAP is cumulative; its builder does not use a rolling Period.
  TWAP: { inputs: [sourceField()], style: standardStyle },
  ADR: standardPeriodSchema,
  AUTO_KEY_LEVELS: {
    inputs: [numberField('pivotLength', 'Pivot Length'), numberField('maxLevels', 'Max Levels')],
    style: [colorField('supportColor', 'Support Color'), colorField('resistanceColor', 'Resistance Color')],
  },
  AUTO_TREND: {
    inputs: [numberField('pivotLength', 'Pivot Length')],
    style: [colorField('supportColor', 'Support Trend Color'), colorField('resistanceColor', 'Resistance Trend Color')],
  },
  FRACTALS: {
    inputs: [numberField('periods', 'Periods (n)')],
    style: [colorField('upColor', 'Up Fractal Color'), colorField('downColor', 'Down Fractal Color')],
  },
  TREND_STRENGTH: standardPeriodSchema,
  RCI_RIBBON: {
    inputs: [
      numberField('shortLength', 'Short Length'),
      numberField('middleLength', 'Middle Length'),
      numberField('longLength', 'Long Length'),
    ],
    style: [
      colorField('shortColor', 'Short Color'),
      colorField('middleColor', 'Middle Color'),
      colorField('longColor', 'Long Color'),
    ],
    levels: rsiLevels,
  },
  BB_WIDTH: periodStdDevSchema,
  BB_PCT_B: periodStdDevSchema,
  PATTERN: {
    inputs: [patternsField()],
    style: [
      colorField('bullColor', 'Bullish Pattern Color'),
      colorField('bearColor', 'Bearish Pattern Color'),
      colorField('neutralColor', 'Neutral Pattern Color'),
    ],
  },
  SUPERTREND: {
    inputs: [supertrendPeriodInput, supertrendMultiplierInput],
    style: [],
    plots: supertrendPlotControls,
  },
  VORTEX: {
    inputs: [periodInput],
    style: [colorField('plusColor', 'VI+ Color'), colorField('minusColor', 'VI- Color')],
  },
  KELTNER: {
    inputs: [periodInput, numberField('multiplier', 'Multiplier', '0.1')],
    style: standardStyle,
  },
  ZIGZAG: {
    inputs: [numberField('deviation', 'Deviation (%)', '0.5')],
    style: standardStyle,
  },
  ICHIMOKU: {
    inputs: [
      numberField('conversionPeriod', 'Conversion Period'),
      numberField('basePeriod', 'Base Period'),
      numberField('spanBPeriod', 'Span B Period'),
      numberField('laggingPeriod', 'Lagging Period'),
    ],
    style: [],
    plots: ichimokuPlotControls,
  },
  ELDER_RAY: {
    inputs: [periodInput],
    style: [colorField('bullColor', 'Bull Color'), colorField('bearColor', 'Bear Color')],
  },
  COPPOCK: {
    inputs: [
      numberField('wmaPeriod', 'WMA Period'),
      numberField('rocFast', 'ROC Fast'),
      numberField('rocSlow', 'ROC Slow'),
    ],
    style: standardStyle,
  },
  MASS_INDEX: {
    inputs: [numberField('emaPeriod', 'EMA Period'), numberField('sumPeriod', 'Sum Period')],
    style: standardStyle,
  },
  KST: {
    inputs: [
      numberField('roc1', 'ROC 1'),
      numberField('s1', 'SM 1'),
      numberField('roc2', 'ROC 2'),
      numberField('s2', 'SM 2'),
      numberField('roc3', 'ROC 3'),
      numberField('s3', 'SM 3'),
      numberField('roc4', 'ROC 4'),
      numberField('s4', 'SM 4'),
      numberField('sig', 'Signal Period'),
    ],
    style: [colorField('color', 'KST Color'), colorField('signalColor', 'Signal Color')],
  },
  VWAP: { inputs: [], style: standardStyle },
  OBV: { inputs: [], style: standardStyle },
  BOP: { inputs: [], style: standardStyle },
  AVGPRICE: { inputs: [], style: standardStyle },
  MEDPRICE: { inputs: [], style: standardStyle },
  TYPPRICE: { inputs: [], style: standardStyle },
  WCLPRICE: { inputs: [], style: standardStyle },
  AROON: {
    inputs: [periodInput],
    style: [colorField('upColor', 'Aroon Up Color'), colorField('downColor', 'Aroon Down Color')],
  },
  BOLL: {
    inputs: [periodInput, numberField('stdDev', 'Std Dev', '0.1'), sourceField()],
    style: [],
    plots: bollingerPlotControls,
  },
  PSAR: {
    inputs: [numberField('step', 'Step', '0.01'), numberField('max', 'Max', '0.01')],
    style: [colorField('color', 'Dot Color')],
  },
  MACD: {
    inputs: [...fastSlowInputs, numberField('signalPeriod', 'Signal Period'), sourceField()],
    style: [],
    plots: macdPlotControls,
  },
  STOCH: {
    inputs: [
      numberField('period', '%K Length', '1', 1),
      numberField('smoothK', '%K Smoothing', '1', 1),
      numberField('signalPeriod', '%D Smoothing', '1', 1),
    ],
    style: [colorField('color', '%K Color'), colorField('signalColor', '%D Color')],
    levels: stochasticLevels,
  },
  ADX: {
    inputs: [periodInput],
    style: [],
    plots: adxPlotControls,
  },
  ALMA: {
    inputs: [periodInput, numberField('sigma', 'Sigma', '0.1'), numberField('offset', 'Offset', '0.05')],
    style: standardStyle,
  },
  APO: { inputs: fastSlowInputs, style: standardStyle },
  PPO: { inputs: fastSlowInputs, style: standardStyle },
  ULTIMATE: {
    inputs: [
      numberField('shortPeriod', 'Short Period'),
      numberField('medPeriod', 'Medium Period'),
      numberField('longPeriod', 'Long Period'),
    ],
    style: standardStyle,
  },
  // Community Indicators
  UT_BOT: {
    inputs: [numberField('keyValue', 'Key Value (Sensitivity)', '0.1', 0.1), numberField('atrPeriod', 'ATR Period', '1', 1)],
    style: [colorField('color', 'Trailing Stop Color')],
  },
  WADDAH_ATTAR: {
    inputs: [
      numberField('sensitivity', 'Sensitivity', '1', 1),
      numberField('fastLength', 'Fast EMA Length', '1', 1),
      numberField('slowLength', 'Slow EMA Length', '1', 1),
      numberField('channelLength', 'BB Channel Length', '1', 1),
      numberField('bbMult', 'BB Stdev Multiplier', '0.1', 0.1),
    ],
    style: [
      colorField('upColor', 'Up Trend Color'),
      colorField('downColor', 'Down Trend Color'),
      colorField('explosionColor', 'Explosion Line Color'),
      colorField('deadZoneColor', 'Dead Zone Color'),
    ],
  },
  SQUEEZE_MOMENTUM: {
    inputs: [
      numberField('bbLength', 'BB Length', '1', 1),
      numberField('bbMult', 'BB Multiplier', '0.1', 0.1),
      numberField('kcLength', 'KC Length', '1', 1),
      numberField('kcMult', 'KC Multiplier', '0.1', 0.1),
    ],
    style: [],
  },
  WAVETREND: {
    inputs: [
      numberField('channelLength', 'Channel Length', '1', 1),
      numberField('averageLength', 'Average Length', '1', 1),
      numberField('obLevel1', 'Overbought Level', '1'),
      numberField('osLevel1', 'Oversold Level', '1'),
    ],
    style: [colorField('wt1Color', 'WT1 Color'), colorField('wt2Color', 'WT2 Color')],
  },
  QQE_MOD: {
    inputs: [
      numberField('rsiLengthPrimary', 'Primary RSI Length', '1', 1),
      numberField('rsiSmoothingPrimary', 'Primary RSI Smoothing', '1', 1),
      numberField('qqeFactorPrimary', 'Primary QQE Factor', '0.01', 0.01),
      numberField('rsiLengthSecondary', 'Secondary RSI Length', '1', 1),
      numberField('rsiSmoothingSecondary', 'Secondary RSI Smoothing', '1', 1),
      numberField('qqeFactorSecondary', 'Secondary QQE Factor', '0.01', 0.01),
      numberField('bollingerLength', 'BB Length', '1', 1),
      numberField('bollingerMultiplier', 'BB Multiplier', '0.01', 0.01),
    ],
    style: [],
  },
  CHANDELIER_EXIT: {
    inputs: [
      numberField('atrPeriod', 'ATR Period', '1', 1),
      numberField('atrMult', 'ATR Multiplier', '0.1', 0.1),
    ],
    style: [colorField('longColor', 'Long Stop Color'), colorField('shortColor', 'Short Stop Color')],
  },
  SSL_CHANNEL: {
    inputs: [numberField('period', 'Period', '1', 1)],
    style: [colorField('upColor', 'SSL Up Color'), colorField('downColor', 'SSL Down Color')],
  },
  RIPSTER_EMA_CLOUDS: {
    inputs: [
      sourceField(),
      numberField('shortLen1', 'Short EMA 1', '1', 1),
      numberField('longLen1', 'Long EMA 1', '1', 1),
      numberField('shortLen2', 'Short EMA 2', '1', 1),
      numberField('longLen2', 'Long EMA 2', '1', 1),
      numberField('shortLen3', 'Short EMA 3', '1', 1),
      numberField('longLen3', 'Long EMA 3', '1', 1),
    ],
    style: [],
  },
  ALPHA_TREND: {
    inputs: [
      numberField('coeff', 'Multiplier', '0.1', 0.1),
      numberField('period', 'Common Period', '1', 1),
    ],
    style: [colorField('color', 'AlphaTrend Color'), colorField('lagColor', 'Lagged Color')],
  },
  VFI: {
    inputs: [
      numberField('length', 'VFI Length', '1', 1),
      numberField('coef', 'Coefficient', '0.01', 0.01),
      numberField('vcoef', 'Max Vol Cutoff', '0.1', 0.1),
      numberField('signalLength', 'Signal Length', '1', 1),
    ],
    style: [colorField('color', 'VFI Color'), colorField('signalColor', 'Signal Color')],
  },
  HALF_TREND: {
    inputs: [
      numberField('amplitude', 'Amplitude', '1', 1),
      numberField('channelDeviation', 'Channel Deviation', '1', 0),
    ],
    style: [
      colorField('color', 'HalfTrend Color'),
      colorField('atrHighColor', 'ATR High Color'),
      colorField('atrLowColor', 'ATR Low Color'),
    ],
  },
  LINREG_CHANNEL: {
    inputs: [numberField('length', 'Length', '1', 1)],
    style: [
      colorField('upperColor', 'Upper Band Color'),
      colorField('middleColor', 'Middle Line Color'),
      colorField('lowerColor', 'Lower Band Color'),
    ],
  },
  SUPERTREND_AI: {
    inputs: [
      numberField('atrLen', 'ATR Length', '1', 1),
      numberField('minFactor', 'Min Factor', '0.1', 0.1),
      numberField('maxFactor', 'Max Factor', '0.1', 0.1),
      numberField('factorStep', 'Factor Step', '0.1', 0.1),
      numberField('perfAlpha', 'Performance Memory', '1', 2),
    ],
    style: [colorField('upColor', 'Up Trend Color'), colorField('downColor', 'Down Trend Color')],
  },
  ORDER_BLOCKS: {
    inputs: [numberField('sensitivity', 'Sensitivity', '1', 1)],
    style: [colorField('bullColor', 'Bullish OB Color'), colorField('bearColor', 'Bearish OB Color')],
  },
  FVG: {
    inputs: [
      numberField('lookback', 'FVG Lookback', '1', 1),
      numberField('atrMultiplier', 'ATR Multiplier', '0.05', 0.05),
    ],
    style: [colorField('bullColor', 'Bullish Average Color'), colorField('bearColor', 'Bearish Average Color')],
  },
  MARKET_CIPHER_B: {
    inputs: [
      numberField('wtChannelLen', 'Channel Length', '1', 1),
      numberField('wtAvgLen', 'Average Length', '1', 1),
      numberField('wtMALen', 'MA Length', '1', 1),
      numberField('rsiMFIPeriod', 'MFI Period', '1', 1),
      numberField('rsiMFIMult', 'MFI Multiplier', '1', 1),
    ],
    style: [
      colorField('wt1Color', 'WaveTrend 1 Color'),
      colorField('wt2Color', 'WaveTrend 2 Color'),
      colorField('mfiColor', 'MFI Area Color'),
    ],
  },
  RANGE_FILTER_DW: {
    inputs: [
      numberField('period', 'Period', '1', 1),
      numberField('mult', 'Multiplier', '0.1', 0.1),
    ],
    style: [
      colorField('color', 'Filter Line Color'),
      colorField('upperColor', 'Upper Band Color'),
      colorField('lowerColor', 'Lower Band Color'),
    ],
  },
  DONCHIAN_RIBBON: {
    inputs: [numberField('dlen', 'Donchian Length', '1', 10)],
    style: [colorField('bullColor', 'Bullish Color'), colorField('bearColor', 'Bearish Color')],
  },
  TRENDLINES_BREAKS: {
    inputs: [
      numberField('length', 'Swing Lookback', '1', 1),
      numberField('mult', 'Slope Multiplier', '0.1', 0.1),
    ],
    style: [colorField('upperColor', 'Upper Trendline Color'), colorField('lowerColor', 'Lower Trendline Color')],
  },
  CM_VIX_FIX: {
    inputs: [
      numberField('length', 'WVF Length', '1', 1),
      numberField('bbLen', 'Bollinger Length', '1', 1),
      numberField('bbMult', 'Bollinger Multiplier', '0.1', 0.1),
      numberField('lookbackPct', 'Percentile Lookback', '1', 1),
      numberField('pctHighest', 'Percentile Multiplier', '0.01', 0.01, 1.0),
    ],
    style: [colorField('color', 'Base Histogram Color'), colorField('alertColor', 'Alert Color')],
  },
  CUSTOM: { inputs: [], style: standardStyle },
});

const EMPTY_SCHEMA: IndicatorSettingsSchema = { inputs: [], style: [] };

function IndicatorFields({
  draft,
  setDraft,
  activeTab,
  onTabChange,
  allIndicators = [],
  sourceBars = [],
}: {
  draft: OverlayIndicator;
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>;
  activeTab: IndicatorSettingsTab;
  onTabChange: (tab: IndicatorSettingsTab) => void;
  allIndicators?: OverlayIndicator[];
  sourceBars?: OHLCBar[];
}) {
  const schema = INDICATOR_SETTINGS_SCHEMAS[draft.kind] ?? EMPTY_SCHEMA;

  return (
    <>
      <div style={tabListStyle}>
        {INDICATOR_SETTINGS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            style={tabButtonStyle(activeTab === tab.id)}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div style={tabPanelStyle}>{renderTabPanel(activeTab, draft, setDraft, schema, allIndicators, sourceBars)}</div>
    </>
  );
}

function renderTabPanel(
  activeTab: IndicatorSettingsTab,
  draft: OverlayIndicator,
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  schema: IndicatorSettingsSchema,
  allIndicators: OverlayIndicator[] = [],
  sourceBars: OHLCBar[] = [],
) {
  if (activeTab === 'inputs') {
    // Only schema-defined algorithm parameters are editable here.
    // The generic offset field is not a supported visual bar shift.
    return renderSchemaFields(schema.inputs, draft, setDraft, 'No editable inputs.', allIndicators, sourceBars);
  }

  if (activeTab === 'style') {
    return renderStylePanel(schema, draft, setDraft);
  }

  if (activeTab === 'levels') {
    return renderLevelsPanel(schema, draft, setDraft);
  }

  if (activeTab === 'scale') {
    return (
      <div style={readonlyGridStyle}>
        <ReadonlyField label="Placement" value={draft.placement === 'overlay' ? 'Price pane' : 'Indicator pane'} />
        <ReadonlyField label="Scale" value="Automatic" />
      </div>
    );
  }

  return (
    <label style={checkboxFieldStyle}>
      <input
        type="checkbox"
        checked={draft.visible !== false}
        onChange={(event) => {
          const visible = event.target.checked;
          setDraft((state) => ({ ...state, visible } as OverlayIndicator));
        }}
      />
      <span>Visible</span>
    </label>
  );
}

function renderLevelsPanel(
  schema: IndicatorSettingsSchema,
  draft: OverlayIndicator,
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
) {
  if (!schema.levels?.length) {
    return <div style={emptyStateStyle}>No editable levels.</div>;
  }

  return (
    <>
      {schema.levels.map((level) => (
        <LevelControl key={level.id} level={level} draft={draft} setDraft={setDraft} />
      ))}
    </>
  );
}

function renderStylePanel(
  schema: IndicatorSettingsSchema,
  draft: OverlayIndicator,
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
) {
  const hasFields = schema.style.length > 0;
  const hasPlots = Boolean(schema.plots?.length);

  if (!hasFields && !hasPlots) {
    return <div style={emptyStateStyle}>No editable style fields.</div>;
  }

  return (
    <>
      {hasFields ? renderSchemaFields(schema.style, draft, setDraft, '') : null}
      {schema.plots?.map((plot) => (
        <PlotControl key={plot.id} plot={plot} draft={draft} setDraft={setDraft} />
      ))}
    </>
  );
}

function renderSchemaFields(
  fields: IndicatorFieldDefinition[],
  draft: OverlayIndicator,
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  emptyLabel: string,
  allIndicators: OverlayIndicator[] = [],
  sourceBars: OHLCBar[] = [],
) {
  if (!fields.length) {
    return <div style={emptyStateStyle}>{emptyLabel}</div>;
  }

  return fields.map((field) => renderSchemaField(field, draft, setDraft, allIndicators, sourceBars));
}

function renderSchemaField(
  field: IndicatorFieldDefinition,
  draft: OverlayIndicator,
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  allIndicators: OverlayIndicator[] = [],
  sourceBars: OHLCBar[] = [],
) {
  if (field.kind === 'patterns') {
    return <PatternField key={field.id} draft={draft} setDraft={setDraft} />;
  }

  if (!field.key) {
    return null;
  }

  const fieldKey = field.key;

  if (field.kind === 'number') {
    return (
      <NumberField
        key={field.id}
        label={field.label}
        value={Number(readIndicatorValue(draft, fieldKey) ?? 0)}
        step={field.step}
        min={field.min}
        max={field.max}
        onChange={(value) => setIndicatorNumber(setDraft, fieldKey, value, field.min, field.max)}
      />
    );
  }

  if (field.kind === 'source') {
    return (
      <SourceField
        key={field.id}
        value={String(readIndicatorValue(draft, fieldKey) ?? 'close')}
        sourceIndicatorId={draft.sourceIndicatorId}
        sourcePlotKey={draft.sourcePlotKey}
        allIndicators={allIndicators}
        sourceBars={sourceBars}
        currentIndicator={draft}
        onChange={(source, sourceIndicatorId, sourcePlotKey) => {
          setDraft((prev) => ({
            ...prev,
            source: source as import('@/engine/types').IndicatorSource,
            sourceIndicatorId,
            sourcePlotKey,
          }));
        }}
      />
    );
  }

  const rawValue = String(readIndicatorValue(draft, fieldKey) ?? '#6a9bcc');
  const colorValue = field.toInputValue ? field.toInputValue(rawValue) : rawValue;

  return (
    <ColorField
      key={field.id}
      label={field.label}
      value={colorValue}
      onChange={(value) => setIndicatorValue(setDraft, fieldKey, field.fromInputValue ? field.fromInputValue(value) : value)}
    />
  );
}

function PatternField({
  draft,
  setDraft,
}: {
  draft: OverlayIndicator;
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>;
}) {
  const selectedPatterns =
    'patterns' in draft && Array.isArray(draft.patterns) ? draft.patterns : [];

  const togglePattern = (id: string) => {
    setDraft((state) => {
      const currentPatterns =
        'patterns' in state && Array.isArray(state.patterns) ? state.patterns : [];
      const patterns = currentPatterns.includes(id)
        ? currentPatterns.filter((pattern) => pattern !== id)
        : [...currentPatterns, id];
      return { ...state, patterns } as OverlayIndicator;
    });
  };

  const setCategoryPatterns = (category: 'single' | 'double' | 'multi', selectAll: boolean) => {
    const categoryIds = SUPPORTED_PATTERNS.filter((p) => p.category === category).map((p) => p.id);
    setDraft((state) => {
      const current = new Set('patterns' in state && Array.isArray(state.patterns) ? state.patterns : []);
      for (const id of categoryIds) {
        if (selectAll) {
          current.add(id);
        } else {
          current.delete(id);
        }
      }
      return { ...state, patterns: Array.from(current) } as OverlayIndicator;
    });
  };

  const categories: { id: 'single' | 'double' | 'multi'; label: string }[] = [
    { id: 'single', label: 'Single-Candle Patterns' },
    { id: 'double', label: 'Two-Candle Patterns' },
    { id: 'multi', label: 'Multi-Candle Patterns' },
  ];

  return (
    <div style={patternListStyle}>
      {categories.map((cat) => {
        const catPatterns = SUPPORTED_PATTERNS.filter((p) => p.category === cat.id);
        const selectedCount = catPatterns.filter((p) => selectedPatterns.includes(p.id)).length;
        const allSelected = selectedCount === catPatterns.length;

        return (
          <div key={cat.id} style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: '1px solid var(--border2)',
                marginBottom: 6,
                fontWeight: 700,
                fontSize: 11,
                color: 'var(--text)',
              }}
            >
              <span>
                {cat.label} ({selectedCount}/{catPatterns.length})
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setCategoryPatterns(cat.id, !allSelected)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--accent)',
                    fontSize: 10,
                    cursor: 'pointer',
                    padding: '2px 4px',
                    textDecoration: 'underline',
                  }}
                >
                  {allSelected ? 'Clear' : 'Select All'}
                </button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {catPatterns.map((pattern) => (
                <label key={pattern.id} style={patternItemStyle}>
                  <input
                    type="checkbox"
                    checked={selectedPatterns.includes(pattern.id)}
                    onChange={() => togglePattern(pattern.id)}
                  />
                  <span title={pattern.tooltip}>{pattern.label}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={readonlyFieldStyle}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlotControl({
  plot,
  draft,
  setDraft,
}: {
  plot: IndicatorPlotControlDefinition;
  draft: OverlayIndicator;
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>;
}) {
  const settings = getDraftPlotSettings(draft, plot.id);
  const visible = settings.visible ?? plot.defaultVisible ?? true;

  return (
    <div style={plotControlStyle}>
      <label style={checkboxFieldStyle}>
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => updateDraftPlotSettings(setDraft, plot.id, { visible: event.target.checked })}
        />
        <strong>{plot.label}</strong>
      </label>
      {plot.kind === 'line' ? (
        <div style={plotFieldGridStyle}>
          <ColorField
            label="Color"
            value={settings.color ?? getFallbackColor(draft, plot.colorFallbackKey, plot.defaultColor)}
            onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { color: value })}
          />
          {plot.secondaryColorFallbackKey ? (
            <ColorField
              label={plot.secondaryColorLabel ?? 'Secondary Color'}
              value={settings.secondaryColor ?? getFallbackColor(draft, plot.secondaryColorFallbackKey, plot.defaultColor)}
              onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { secondaryColor: value })}
            />
          ) : null}
          <NumberField
            label="Width"
            value={settings.lineWidth ?? plot.defaultLineWidth ?? 1.5}
            step="0.1"
            onChange={(value) => updateDraftPlotNumber(setDraft, plot.id, 'lineWidth', value)}
          />
          <LineStyleField
            value={settings.lineStyle ?? 'solid'}
            onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { lineStyle: value })}
          />
          {plot.plotStyleEditable !== false ? (
            <PlotStyleField
              value={settings.plotStyle}
              onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { plotStyle: value })}
            />
          ) : null}
          {plot.opacityEditable !== false ? (
            <OpacityField
              value={settings.opacity}
              onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { opacity: value })}
            />
          ) : null}
        </div>
      ) : plot.kind === 'histogram' ? (
        <div style={plotFieldGridStyle}>
          <ColorField
            label="Up"
            value={toHexColor(settings.positiveColor ?? getFallbackColor(draft, plot.positiveColorFallbackKey))}
            onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { positiveColor: toRgbaColor(value, 0.75) })}
          />
          <ColorField
            label="Down"
            value={toHexColor(settings.negativeColor ?? getFallbackColor(draft, plot.negativeColorFallbackKey))}
            onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { negativeColor: toRgbaColor(value, 0.75) })}
          />
          {plot.opacityEditable !== false ? (
            <OpacityField
              value={settings.opacity}
              onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { opacity: value })}
            />
          ) : null}
        </div>
      ) : (
        <div style={plotFieldGridStyle}>
          <ColorField
            label="Fill"
            value={settings.color ?? getFallbackColor(draft, plot.colorFallbackKey, plot.defaultColor)}
            onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { color: value })}
          />
          <OpacityField
            value={settings.opacity}
            onChange={(value) => updateDraftPlotSettings(setDraft, plot.id, { opacity: value })}
          />
        </div>
      )}
    </div>
  );
}

function LevelControl({
  level,
  draft,
  setDraft,
}: {
  level: IndicatorLevelDefinition;
  draft: OverlayIndicator;
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>;
}) {
  const settings = getDraftLevelSettings(draft, level);

  return (
    <div style={plotControlStyle}>
      <label style={checkboxFieldStyle}>
        <input
          type="checkbox"
          checked={settings.visible !== false}
          onChange={(event) => updateDraftLevelSettings(setDraft, level, { visible: event.target.checked })}
        />
        <strong>{level.label}</strong>
      </label>
      <div style={plotFieldGridStyle}>
        <NumberField
          label="Value"
          value={settings.value}
          step="1"
          onChange={(value) => updateDraftLevelNumber(setDraft, level, 'value', value)}
        />
        <ColorField
          label="Color"
          value={settings.color ?? '#94a3b8'}
          onChange={(value) => updateDraftLevelSettings(setDraft, level, { color: value })}
        />
        <NumberField
          label="Width"
          value={settings.lineWidth ?? 1}
          step="0.1"
          onChange={(value) => updateDraftLevelNumber(setDraft, level, 'lineWidth', value)}
        />
        <LineStyleField
          value={settings.lineStyle ?? 'dashed'}
          onChange={(value) => updateDraftLevelSettings(setDraft, level, { lineStyle: value })}
        />
      </div>
    </div>
  );
}

function readIndicatorValue(indicator: OverlayIndicator, key: string): unknown {
  return (indicator as unknown as Record<string, unknown>)[key];
}

function setIndicatorNumber(
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  key: string,
  value: string,
  min?: number,
  max?: number,
) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return;
  }

  setIndicatorValue(setDraft, key, Math.min(max ?? nextValue, Math.max(min ?? nextValue, nextValue)));
}

function setIndicatorValue(
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  key: string,
  value: unknown,
) {
  setDraft((state) => ({ ...state, [key]: value } as OverlayIndicator));
}

function getDraftPlotSettings(indicator: OverlayIndicator, plotId: string): IndicatorPlotSettings {
  return indicator.presentation?.plots?.[plotId] ?? {};
}

function getDraftLevelSettings(indicator: OverlayIndicator, level: IndicatorLevelDefinition): IndicatorLevelSettings {
  return indicator.presentation?.levels?.find((item) => item.id === level.id) ?? {
    id: level.id,
    label: level.label,
    value: level.value,
  };
}

function updateDraftPlotNumber(
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  plotId: string,
  key: keyof IndicatorPlotSettings,
  value: string,
) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return;
  }

  updateDraftPlotSettings(setDraft, plotId, { [key]: nextValue } as IndicatorPlotSettings);
}

function updateDraftPlotSettings(
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  plotId: string,
  patch: IndicatorPlotSettings,
) {
  setDraft((state) => ({
    ...state,
    presentation: {
      ...state.presentation,
      plots: {
        ...state.presentation?.plots,
        [plotId]: {
          ...state.presentation?.plots?.[plotId],
          ...patch,
        },
      },
    },
  } as OverlayIndicator));
}

function updateDraftLevelNumber(
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  level: IndicatorLevelDefinition,
  key: keyof IndicatorLevelSettings,
  value: string,
) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) {
    return;
  }

  updateDraftLevelSettings(setDraft, level, { [key]: nextValue } as Partial<IndicatorLevelSettings>);
}

function updateDraftLevelSettings(
  setDraft: Dispatch<SetStateAction<OverlayIndicator>>,
  level: IndicatorLevelDefinition,
  patch: Partial<IndicatorLevelSettings>,
) {
  setDraft((state) => {
    const levels = state.presentation?.levels ?? [];
    const existing = levels.find((item) => item.id === level.id);
    const nextLevel: IndicatorLevelSettings = {
      id: level.id,
      label: level.label,
      value: level.value,
      ...existing,
      ...patch,
    };
    const nextLevels = existing
      ? levels.map((item) => (item.id === level.id ? nextLevel : item))
      : [...levels, nextLevel];

    return {
      ...state,
      presentation: {
        ...state.presentation,
        levels: nextLevels,
      },
    } as OverlayIndicator;
  });
}

function getFallbackColor(indicator: OverlayIndicator, key: string | undefined, defaultColor = '#6a9bcc'): string {
  if (!key) {
    return defaultColor;
  }

  const value = readIndicatorValue(indicator, key);
  return typeof value === 'string' ? value : defaultColor;
}

function NumberField({
  label,
  value,
  step = '1',
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  step?: string;
  min?: number;
  max?: number;
  onChange: (value: string) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span>{label}</span>
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div style={fieldStyle}>
      <span>{label}</span>
      <ColorToolbox value={value} onChange={onChange} allowAlpha={true} ariaLabel={label} />
    </div>
  );
}

const SOURCE_OPTIONS = [
  { value: 'close', label: 'Close' },
  { value: 'open', label: 'Open' },
  { value: 'high', label: 'High' },
  { value: 'low', label: 'Low' },
  { value: 'hl2', label: 'HL/2' },
  { value: 'hlc3', label: 'HLC/3' },
  { value: 'ohlc4', label: 'OHLC/4' },
];

function SourceField({
  value,
  sourceIndicatorId,
  sourcePlotKey,
  allIndicators,
  sourceBars,
  currentIndicator,
  onChange,
}: {
  value: string | undefined;
  sourceIndicatorId?: string;
  sourcePlotKey?: string;
  allIndicators: OverlayIndicator[];
  sourceBars: OHLCBar[];
  currentIndicator: OverlayIndicator;
  onChange: (source: string, sourceIndicatorId?: string, sourcePlotKey?: string) => void;
}) {
  const choices = useMemo(
    () => getEligibleStudySourceChoices(sourceBars, allIndicators, currentIndicator),
    [allIndicators, currentIndicator.id, currentIndicator.kind, sourceBars],
  );
  const chosen = sourceIndicatorId
    ? choices.find((option) =>
        option.indicatorId === sourceIndicatorId &&
        (sourcePlotKey ? option.plotKey === sourcePlotKey : true))
    : undefined;
  const unavailableValue = sourceIndicatorId
    ? studySourceOptionValue(sourceIndicatorId, sourcePlotKey ?? '')
    : '';
  const currentVal = sourceIndicatorId
    ? (chosen?.value ?? unavailableValue)
    : (value ?? 'close');

  return (
    <label style={fieldStyle}>
      <span>Source</span>
      <select
        value={currentVal}
        onChange={(event) => {
          const selected = event.target.value;
          const choice = choices.find((option) => option.value === selected);
          if (choice) {
            onChange('close', choice.indicatorId, choice.plotKey);
            return;
          }
          if (SOURCE_OPTIONS.some((option) => option.value === selected)) {
            onChange(selected, undefined, undefined);
          }
        }}
        style={selectFieldStyle}
      >
        <optgroup label="Price Data">
          {SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
        {sourceIndicatorId && !chosen ? (
          <option value={unavailableValue} disabled>
            Unavailable saved study source — choose another source
          </option>
        ) : null}
        {choices.length > 0 ? (
          <optgroup label="Active Indicators (Study-as-Source)">
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}

function LineStyleField({
  value,
  onChange,
}: {
  value: DrawingLineStyle;
  onChange: (value: DrawingLineStyle) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span>Line Style</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as DrawingLineStyle)}
        style={selectFieldStyle}
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </select>
    </label>
  );
}

function PlotStyleField({
  value,
  onChange,
}: {
  value: import('@/engine/types').PlotStyle | undefined;
  onChange: (value: import('@/engine/types').PlotStyle) => void;
}) {
  return (
    <label style={fieldStyle}>
      <span>Plot Type</span>
      <select
        value={value ?? 'line'}
        onChange={(event) => onChange(event.target.value as import('@/engine/types').PlotStyle)}
        style={selectFieldStyle}
      >
        <option value="line">Line</option>
        <option value="stepline">Step Line</option>
        <option value="histogram">Histogram</option>
        <option value="area">Area</option>
        <option value="cross">Cross (+)</option>
        <option value="circles">Circles (â€¢)</option>
      </select>
    </label>
  );
}

function OpacityField({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (value: number) => void;
}) {
  const currentOpacity = typeof value === 'number' ? Math.round(value * 100) : 100;
  return (
    <label style={fieldStyle}>
      <span>Opacity ({currentOpacity}%)</span>
      <input
        type="range"
        min={0}
        max={100}
        value={currentOpacity}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        style={{ width: '100%', accentColor: 'var(--accent)' }}
      />
    </label>
  );
}

function cloneIndicator(indicator: OverlayIndicator): OverlayIndicator {
  return JSON.parse(JSON.stringify(indicator)) as OverlayIndicator;
}

function toHexColor(value: string): string {
  const rgbaMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbaMatch) {
    return value;
  }

  return `#${rgbaMatch
    .slice(1, 4)
    .map((item) => Number(item).toString(16).padStart(2, '0'))
    .join('')}`;
}

function toRgbaColor(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const clearBackdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.15)', // Ultra-light tint without blur
  zIndex: 45,
};

const dialogPanelStyle: React.CSSProperties = {
  position: 'fixed',
  width: 440,
  border: '1px solid var(--border2)',
  borderRadius: 10,
  background: 'var(--bg2)',
  boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border2)',
  overflow: 'hidden',
  zIndex: 50,
};

const dialogHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  cursor: 'grab',
  touchAction: 'none',
};

const dragHandleBadgeStyle: React.CSSProperties = {
  fontSize: 9.5,
  color: 'var(--text-dim)',
  padding: '1px 4px',
  borderRadius: 4,
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  fontWeight: 600,
};

const headerIconButtonStyle: React.CSSProperties = {
  border: '1px solid var(--border2)',
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 11,
  width: 24,
  height: 24,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dialogCloseStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  border: '1px solid var(--border2)',
  borderRadius: 5,
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dialogBodyStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: 12,
};

const dialogPlacementStyle: React.CSSProperties = {
  color: 'var(--text-dim)',
  fontSize: 11,
  paddingBottom: 2,
};

const dialogFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '0 12px 12px',
};

const actionButtonStyle: React.CSSProperties = {
  height: 22,
  minWidth: 24,
  padding: '0 8px',
  border: '1px solid var(--border2)',
  background: 'var(--control-bg)',
  color: 'var(--text)',
  borderRadius: 5,
  cursor: 'pointer',
  fontSize: 10.5,
  fontWeight: 700,
};

const fieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  color: 'var(--text-dim)',
  fontSize: 11,
};

const tabListStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: 4,
  padding: 3,
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--bg3)',
};

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    height: 26,
    border: `1px solid ${active ? 'var(--accent)' : 'transparent'}`,
    borderRadius: 4,
    background: active ? 'var(--control-bg)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-dim)',
    cursor: 'pointer',
    fontSize: 10.5,
    fontWeight: 700,
  };
}

const tabPanelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minHeight: 72,
  maxHeight: 260,
  overflowY: 'auto',
};

const readonlyGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 8,
};

const readonlyFieldStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '8px 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  fontSize: 11,
};

const checkboxFieldStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  color: 'var(--text)',
  fontSize: 11,
};

const plotControlStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  padding: '8px 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
};

const plotFieldGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: 8,
};

const emptyStateStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--bg3)',
  color: 'var(--text-dim)',
  fontSize: 11,
};

const inputStyle: React.CSSProperties = {
  height: 30,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 8px',
  outline: 'none',
};

const selectFieldStyle: React.CSSProperties = {
  height: 30,
  border: '1px solid var(--border2)',
  borderRadius: 4,
  background: 'var(--control-bg)',
  color: 'var(--text)',
  padding: '0 8px',
  outline: 'none',
  fontSize: 11,
};

const patternListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  maxHeight: 180,
  overflowY: 'auto',
  padding: '8px 10px',
  background: 'var(--bg3)',
  border: '1px solid var(--border2)',
  borderRadius: 4,
};

const patternItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontSize: 11,
  color: 'var(--text)',
};
