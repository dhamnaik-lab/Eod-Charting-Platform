import type { ChartSignalRule, OHLCBar, OverlayIndicator } from '@/engine/types';
import { evaluateSignalRules } from '@/engine/Signals';
import { buildRenderableIndicators } from '@/engine/Indicators';
import type { ScannerContext, ScannerDefinition, ScannerResult } from '@/plugins/scanner/types';

export const signalScannerDefinitions: ScannerDefinition[] = [
  {
    id: 'signal_golden_cross',
    name: 'Golden Cross (MA Cross Above)',
    categoryId: 'visual_signals',
    categoryName: 'Visual Signals & Crossovers',
    priority: 1,
    scannerType: 'breakout',
    description: 'Fast moving average (e.g. EMA 20 or SMA 50) crosses above slow moving average (e.g. SMA 50 or SMA 200). Fully customizable.',
    logicText: 'Fast MA crosses above Slow MA',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'trigger_date', 'condition', 'source_val'],
    eodSafetyNotes: 'Uses confirmed EOD bar crossover.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'signal_death_cross',
    name: 'Death Cross (MA Cross Below)',
    categoryId: 'visual_signals',
    categoryName: 'Visual Signals & Crossovers',
    priority: 1,
    scannerType: 'breakdown',
    description: 'Fast moving average (e.g. EMA 20 or SMA 50) crosses below slow moving average (e.g. SMA 50 or SMA 200). Fully customizable.',
    logicText: 'Fast MA crosses below Slow MA',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'trigger_date', 'condition', 'source_val'],
    eodSafetyNotes: 'Uses confirmed EOD bar crossover.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'signal_rsi_oversold_bounce',
    name: 'RSI Oversold Bounce (> 30)',
    categoryId: 'visual_signals',
    categoryName: 'Visual Signals & Crossovers',
    priority: 1,
    scannerType: 'breakout',
    description: 'RSI(14) crosses above oversold threshold (30). Fully customizable period and oversold level.',
    logicText: 'RSI(14) crosses above 30',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'rsi_val', 'trigger_date'],
    eodSafetyNotes: 'Uses confirmed EOD bar crossover.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'signal_rsi_overbought_drop',
    name: 'RSI Overbought Drop (< 70)',
    categoryId: 'visual_signals',
    categoryName: 'Visual Signals & Crossovers',
    priority: 1,
    scannerType: 'breakdown',
    description: 'RSI(14) crosses below overbought threshold (70). Fully customizable period and overbought level.',
    logicText: 'RSI(14) crosses below 70',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'rsi_val', 'trigger_date'],
    eodSafetyNotes: 'Uses confirmed EOD bar crossover.',
    implementationStatus: 'ready_for_engine',
  },
  {
    id: 'signal_active_custom_rules',
    name: 'Active Custom Signal Rules',
    categoryId: 'visual_signals',
    categoryName: 'Visual Signals & Crossovers',
    priority: 1,
    scannerType: 'pattern',
    description: 'Evaluates all active custom indicator crossover rules configured in the Signal Manager.',
    logicText: 'User-configured custom signal rules',
    requiredData: ['ohlcv'],
    suggestedOutputColumns: ['close', 'rule_name', 'condition', 'trigger_date'],
    eodSafetyNotes: 'Uses confirmed EOD bar crossover.',
    implementationStatus: 'ready_for_engine',
  },
];

export function buildDefaultPresetIndicators(): OverlayIndicator[] {
  return [
    { id: 'ema_20', kind: 'EMA', period: 20, source: 'close', color: '#22c55e', placement: 'overlay' },
    { id: 'sma_50', kind: 'SMA', period: 50, source: 'close', color: '#eab308', placement: 'overlay' },
    { id: 'sma_200', kind: 'SMA', period: 200, source: 'close', color: '#ef4444', placement: 'overlay' },
    { id: 'rsi_14', kind: 'RSI', period: 14, source: 'close', color: '#3b82f6', placement: 'pane' },
  ];
}

export function buildDefaultPresetSignalRules(): ChartSignalRule[] {
  return [
    {
      id: 'preset_golden_cross',
      label: 'Golden Cross (EMA 20 / SMA 50)',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { indicatorId: 'ema_20', plotKey: 'ema' },
      seriesB: { indicatorId: 'sma_50', plotKey: 'sma' },
      shape: 'arrow_up',
      position: 'below_bar',
      color: '#22c55e',
    },
    {
      id: 'preset_death_cross',
      label: 'Death Cross (EMA 20 / SMA 50)',
      enabled: true,
      conditionType: 'crosses_below',
      seriesA: { indicatorId: 'ema_20', plotKey: 'ema' },
      seriesB: { indicatorId: 'sma_50', plotKey: 'sma' },
      shape: 'arrow_down',
      position: 'above_bar',
      color: '#ef4444',
    },
    {
      id: 'preset_rsi_oversold',
      label: 'RSI Oversold Bounce (> 30)',
      enabled: true,
      conditionType: 'crosses_above',
      seriesA: { indicatorId: 'rsi_14', plotKey: 'rsi' },
      seriesB: { staticValue: 30 },
      shape: 'arrow_up',
      position: 'below_bar',
      color: '#22c55e',
      text: 'RSI 30 Bounce',
    },
    {
      id: 'preset_rsi_overbought',
      label: 'RSI Overbought Drop (< 70)',
      enabled: true,
      conditionType: 'crosses_below',
      seriesA: { indicatorId: 'rsi_14', plotKey: 'rsi' },
      seriesB: { staticValue: 70 },
      shape: 'arrow_down',
      position: 'above_bar',
      color: '#ef4444',
      text: 'RSI 70 Drop',
    },
  ];
}

export function evaluateSignalScannerDefinitions(
  context: ScannerContext,
  requestedScannerIds: string[],
  customSignalRules?: ChartSignalRule[],
): ScannerResult[] {
  if (!context.bars.length || !requestedScannerIds.length) {
    return [];
  }

  const requestedSet = new Set(requestedScannerIds);
  const presets = buildDefaultPresetSignalRules();
  const rulesToEvaluate: Array<{ rule: ChartSignalRule; scannerId: string; scannerName: string }> = [];

  if (requestedSet.has('signal_golden_cross')) {
    const gc = presets.find((p) => p.id === 'preset_golden_cross');
    if (gc) rulesToEvaluate.push({ rule: gc, scannerId: 'signal_golden_cross', scannerName: 'Golden Cross (MA Cross Above)' });
  }
  if (requestedSet.has('signal_death_cross')) {
    const dc = presets.find((p) => p.id === 'preset_death_cross');
    if (dc) rulesToEvaluate.push({ rule: dc, scannerId: 'signal_death_cross', scannerName: 'Death Cross (MA Cross Below)' });
  }
  if (requestedSet.has('signal_rsi_oversold_bounce')) {
    const rsiOversold = presets.find((p) => p.id === 'preset_rsi_oversold');
    if (rsiOversold) rulesToEvaluate.push({ rule: rsiOversold, scannerId: 'signal_rsi_oversold_bounce', scannerName: 'RSI Oversold Bounce (> 30)' });
  }
  if (requestedSet.has('signal_rsi_overbought_drop')) {
    const rsiOverbought = presets.find((p) => p.id === 'preset_rsi_overbought');
    if (rsiOverbought) rulesToEvaluate.push({ rule: rsiOverbought, scannerId: 'signal_rsi_overbought_drop', scannerName: 'RSI Overbought Drop (< 70)' });
  }

  if (requestedSet.has('signal_active_custom_rules') && customSignalRules?.length) {
    customSignalRules
      .filter((r) => r.enabled)
      .forEach((rule) => {
        rulesToEvaluate.push({
          rule,
          scannerId: 'signal_active_custom_rules',
          scannerName: rule.label || 'Custom Signal Rule',
        });
      });
  }

  if (!rulesToEvaluate.length) {
    return [];
  }

  // Convert context EodBars to engine OHLCBars
  const ohlcBars: OHLCBar[] = context.bars.map((b, idx) => ({
    timestamp: idx,
    date: b.date,
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  const indicators = buildDefaultPresetIndicators();
  const bundle = buildRenderableIndicators(ohlcBars, indicators);

  const results: ScannerResult[] = [];
  const latestBarIndex = ohlcBars.length - 1;
  const latestBar = ohlcBars[latestBarIndex];

  rulesToEvaluate.forEach(({ rule, scannerId, scannerName }) => {
    const markers = evaluateSignalRules(ohlcBars, bundle, [rule]);
    // Match triggers on latest bar
    const latestTrigger = markers.find((m) => m.barIndex === latestBarIndex);
    if (latestTrigger) {
      const isBullish = rule.conditionType === 'crosses_above' || (rule.conditionType === 'greater_than' && rule.shape === 'arrow_up');
      const isBearish = rule.conditionType === 'crosses_below' || (rule.conditionType === 'less_than' && rule.shape === 'arrow_down');
      const direction = isBullish ? 'bullish' : isBearish ? 'bearish' : 'neutral';

      results.push({
        symbol: context.symbol,
        exchange: context.exchange,
        scannerId,
        scannerName: `${scannerName} (${rule.label})`,
        categoryId: 'visual_signals',
        categoryName: 'Visual Signals & Crossovers',
        date: latestBar.date,
        matched: true,
        direction,
        score: isBullish ? 85 : 80,
        reasons: [`Triggered ${rule.label} on ${latestBar.date}`],
        values: {
          close: latestBar.close,
          trigger_price: latestTrigger.price,
          condition: rule.conditionType,
          rule_id: rule.id,
        },
        generatedAt: new Date().toISOString(),
      });
    }
  });

  return results;
}
