import type { RenderableIndicatorBundle } from './Indicators';
import type {
  ChartSignalRule,
  IndicatorSource,
  OHLCBar,
  RenderableSignalMarker,
  SignalTarget,
} from './types';

export function evaluateSignalRules(
  bars: OHLCBar[],
  bundle: RenderableIndicatorBundle,
  rules: ChartSignalRule[],
): RenderableSignalMarker[] {
  if (!bars.length || !rules.length) {
    return [];
  }

  const activeRules = rules.filter((r) => r.enabled);
  if (!activeRules.length) {
    return [];
  }

  // Pre-build indicator series map by indicatorId and plotKey
  const indicatorSeriesMap = new Map<string, Array<number | null>>();
  const allRenderables = [...bundle.overlays, ...bundle.panes];

  for (const renderable of allRenderables) {
    const indId = renderable.indicator.id;
    for (const line of renderable.lines) {
      indicatorSeriesMap.set(indId, line.values);
      indicatorSeriesMap.set(`${indId}:${line.key}`, line.values);
    }
  }

  const markers: RenderableSignalMarker[] = [];

  for (const rule of activeRules) {
    const seriesA = extractTargetSeries(bars, rule.seriesA, indicatorSeriesMap);
    const seriesB = extractTargetSeries(bars, rule.seriesB, indicatorSeriesMap);

    const shape = rule.shape ?? (rule.conditionType === 'crosses_above' || rule.conditionType === 'greater_than' ? 'arrow_up' : 'arrow_down');
    const color = rule.color ?? (rule.conditionType === 'crosses_above' || rule.conditionType === 'greater_than' ? '#22c55e' : '#ef4444');
    const position = rule.position ?? (rule.conditionType === 'crosses_above' || rule.conditionType === 'greater_than' ? 'below_bar' : 'above_bar');

    for (let i = 1; i < bars.length; i++) {
      const aPrev = seriesA[i - 1];
      const aCurr = seriesA[i];
      const bPrev = seriesB[i - 1];
      const bCurr = seriesB[i];

      if (aPrev === null || aCurr === null || bPrev === null || bCurr === null) {
        continue;
      }

      let triggered = false;

      switch (rule.conditionType) {
        case 'crosses_above':
        case 'greater_than':
          triggered = aPrev <= bPrev && aCurr > bCurr;
          break;
        case 'crosses_below':
        case 'less_than':
          triggered = aPrev >= bPrev && aCurr < bCurr;
          break;
      }

      if (triggered) {
        const bar = bars[i];
        let price = bar.close;

        if (position === 'above_bar') {
          price = bar.high;
        } else if (position === 'below_bar') {
          price = bar.low;
        } else if (position === 'on_series') {
          price = aCurr;
        }

        markers.push({
          id: `sig_${rule.id}_${i}_${bar.date}`,
          ruleId: rule.id,
          barIndex: i,
          date: bar.date,
          price,
          shape,
          color,
          position,
          text: rule.text ?? (rule.conditionType.includes('above') ? 'BUY' : 'SELL'),
        });
      }
    }
  }

  return markers;
}

function extractTargetSeries(
  bars: OHLCBar[],
  target?: SignalTarget,
  indicatorSeriesMap: Map<string, Array<number | null>> = new Map(),
): Array<number | null> {
  if (!target) {
    return getSourceValues(bars, 'close');
  }

  if (typeof target.staticValue === 'number') {
    return new Array(bars.length).fill(target.staticValue);
  }

  if (target.indicatorId) {
    const lookupKey = target.plotKey ? `${target.indicatorId}:${target.plotKey}` : target.indicatorId;
    if (indicatorSeriesMap.has(lookupKey)) {
      return indicatorSeriesMap.get(lookupKey)!;
    }
  }

  return getSourceValues(bars, target.source ?? 'close');
}

function getSourceValues(bars: OHLCBar[], source: IndicatorSource = 'close'): number[] {
  switch (source) {
    case 'open':
      return bars.map((b) => b.open);
    case 'high':
      return bars.map((b) => b.high);
    case 'low':
      return bars.map((b) => b.low);
    case 'hl2':
      return bars.map((b) => (b.high + b.low) / 2);
    case 'hlc3':
      return bars.map((b) => (b.high + b.low + b.close) / 3);
    case 'ohlc4':
      return bars.map((b) => (b.open + b.high + b.low + b.close) / 4);
    default:
      return bars.map((b) => b.close);
  }
}
