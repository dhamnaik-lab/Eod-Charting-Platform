import { describe, expect, it } from 'vitest';
import {
  applyEodAlertTriggersToRules,
  appendEodAlertHistoryEvents,
  createDrawingAlertRule,
  createEodAlertHistoryEvents,
  createIndicatorAlertRule,
  createScannerMatchAlertRule,
  evaluateDrawingEodAlertRules,
  evaluateIndicatorEodAlertRules,
  evaluatePriceEodAlertRules,
  evaluateScannerMatchEodAlertRules,
  formatAlertCondition,
  formatAlertRuleName,
  getDrawingAlertLineValue,
  normalizeEodAlertHistoryEvents,
  normalizeEodAlertRules,
  resetEodAlertRuleTriggerState,
  type EodAlertRule,
} from '@/features/alerts/eodAlerts';
import type { ChartDrawing, ChartIndicator } from '@/engine/types';
import type { ScannerResult } from '@/plugins/scanner/types';

const baseRule: EodAlertRule = {
  id: 'rule-1',
  enabled: true,
  locked: true,
  name: 'Close above 100',
  scope: 'current-chart',
  conditionType: 'price',
  frequency: 'once_per_symbol_date',
  exchange: 'NSE',
  symbol: 'BANKNIFTY',
  priceField: 'close',
  operator: 'above',
  value: 100,
  createdAt: '2026-07-05T00:00:00.000Z',
  updatedAt: '2026-07-05T00:00:00.000Z',
};

describe('EOD alert evaluation', () => {
  it('triggers price alerts on the latest completed bar', () => {
    const triggers = evaluatePriceEodAlertRules([baseRule], {
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      bars: [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-02', open: 96, high: 105, low: 95, close: 104, volume: 1200 },
      ],
    });

    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      ruleId: 'rule-1',
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      date: '2026-07-02',
      triggerValue: 104,
    });
  });

  it('suppresses duplicate triggers already recorded on the rule', () => {
    const triggers = evaluatePriceEodAlertRules(
      [{ ...baseRule, triggeredKeys: ['rule-1:NSE:BANKNIFTY:2026-07-02'] }],
      {
        exchange: 'NSE',
        symbol: 'BANKNIFTY',
        bars: [
          { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
          { symbol: 'BANKNIFTY', date: '2026-07-02', open: 96, high: 105, low: 95, close: 104, volume: 1200 },
        ],
      },
    );

    expect(triggers).toEqual([]);
  });

  it('allows every-scan alerts to trigger on repeated scans', () => {
    const triggers = evaluatePriceEodAlertRules(
      [
        {
          ...baseRule,
          frequency: 'every_scan',
          lastTriggeredKey: 'rule-1:NSE:BANKNIFTY:2026-07-02',
          triggeredKeys: ['rule-1:NSE:BANKNIFTY:2026-07-02'],
        },
      ],
      {
        exchange: 'NSE',
        symbol: 'BANKNIFTY',
        bars: [
          { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
          { symbol: 'BANKNIFTY', date: '2026-07-02', open: 96, high: 105, low: 95, close: 104, volume: 1200 },
        ],
      },
    );

    expect(triggers).toHaveLength(1);
  });

  it('disables once alerts after they trigger', () => {
    const triggers = evaluatePriceEodAlertRules([{ ...baseRule, frequency: 'once' }], {
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      bars: [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-02', open: 96, high: 105, low: 95, close: 104, volume: 1200 },
      ],
    });

    const [updatedRule] = applyEodAlertTriggersToRules([{ ...baseRule, frequency: 'once' }], triggers);

    expect(updatedRule.enabled).toBe(false);
    expect(updatedRule.lastTriggeredKey).toBe('rule-1:NSE:BANKNIFTY:2026-07-02');
  });

  it('suppresses once-until-reset alerts until trigger state is reset', () => {
    const triggeredRule = {
      ...baseRule,
      frequency: 'once_until_reset' as const,
      lastTriggeredAt: '2026-07-05T10:00:00.000Z',
      triggeredKeys: ['rule-1:NSE:BANKNIFTY:2026-07-02'],
    };
    const context = {
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      bars: [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-02', open: 96, high: 105, low: 95, close: 104, volume: 1200 },
      ],
    };

    expect(evaluatePriceEodAlertRules([triggeredRule], context)).toEqual([]);
    expect(evaluatePriceEodAlertRules([resetEodAlertRuleTriggerState(triggeredRule)], context)).toHaveLength(1);
  });

  it('triggers scanner-match alerts from scan results', () => {
    const result: ScannerResult = {
      symbol: 'CANBK',
      exchange: 'NSE',
      scannerId: 'breakout',
      scannerName: 'Breakout',
      categoryId: 'core',
      categoryName: 'Core',
      date: '2026-07-03',
      matched: true,
      score: 88,
      generatedAt: '2026-07-05T00:00:00.000Z',
    };

    const rule = createScannerMatchAlertRule(result);
    const triggers = evaluateScannerMatchEodAlertRules([rule], [result]);

    expect(triggers).toHaveLength(1);
    expect(applyEodAlertTriggersToRules([rule], triggers)[0].lastTriggeredKey).toBe(
      `${rule.id}:NSE:CANBK:2026-07-03`,
    );
  });

  it('creates indicator alert rules with a stable default RSI contract', () => {
    const rule = createIndicatorAlertRule({ exchange: 'NSE', symbol: 'BANKNIFTY' });

    expect(rule).toMatchObject({
      locked: true,
      conditionType: 'indicator',
      frequency: 'once_per_symbol_date',
      scope: 'current-chart',
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      indicatorLeft: 'rsi.14',
      indicatorOperator: 'crosses_above',
      indicatorValue: 70,
    });
  });

  it('creates indicator alert rules from chart indicator settings', () => {
    const indicator: ChartIndicator = {
      id: 'ema-200',
      kind: 'EMA',
      placement: 'overlay',
      period: 200,
      color: '#26a69a',
    };

    const rule = createIndicatorAlertRule({ exchange: 'NSE', symbol: 'BANKNIFTY' }, indicator);

    expect(rule).toMatchObject({
      name: 'NSE:BANKNIFTY Close crosses above EMA 200',
      conditionType: 'indicator',
      indicatorId: 'ema-200',
      indicatorKind: 'EMA',
      indicatorLabel: 'EMA 200',
      indicatorPresetId: 'price_ema_200',
      indicatorLeft: 'price.close',
      indicatorRight: 'ema.200',
      indicatorOperator: 'crosses_above',
      indicatorValue: null,
    });
  });

  it('normalizes persisted alert rules as locked unless explicitly unlocked', () => {
    const normalized = normalizeEodAlertRules([
      { ...baseRule, id: 'locked-default' },
      { ...baseRule, id: 'unlocked-rule', locked: false },
    ]);

    expect(normalized.map((rule) => ({ id: rule.id, locked: rule.locked }))).toEqual([
      { id: 'locked-default', locked: true },
      { id: 'unlocked-rule', locked: false },
    ]);
  });

  it('triggers indicator alerts when close crosses above EMA', () => {
    const rule: EodAlertRule = {
      ...baseRule,
      id: 'indicator-rule-1',
      name: 'Close crosses EMA 3',
      conditionType: 'indicator',
      indicatorLeft: 'price.close',
      indicatorRight: 'ema.3',
      indicatorOperator: 'crosses_above',
      indicatorValue: null,
    };

    const triggers = evaluateIndicatorEodAlertRules([rule], {
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      bars: [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 10, high: 10, low: 10, close: 10, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-02', open: 9, high: 9, low: 9, close: 9, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-03', open: 8, high: 8, low: 8, close: 8, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-04', open: 9, high: 9, low: 9, close: 9, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-05', open: 12, high: 12, low: 12, close: 12, volume: 1000 },
      ],
    });

    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      ruleId: 'indicator-rule-1',
      date: '2026-07-05',
      condition: 'Close crosses above EMA 3',
      triggerValue: 12,
    });
  });

  it('creates drawing alert rules from horizontal line drawings', () => {
    const drawing: ChartDrawing = {
      id: 'drawing-1',
      kind: 'hline',
      color: '#2563eb',
      price: 57212.8307,
    };

    const rule = createDrawingAlertRule(
      { exchange: 'NSE', symbol: 'BANKNIFTY' },
      drawing,
      [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
      ],
    );

    expect(rule).toMatchObject({
      locked: true,
      conditionType: 'drawing',
      drawingId: 'drawing-1',
      drawingKind: 'hline',
      drawingLabel: 'horizontal line 57,212.83',
      drawingPrice: 57212.8307,
      drawingOperator: 'crosses',
      drawingStatus: 'linked',
      drawingMissingAt: null,
    });
  }, 15000);

  it('normalizes missing drawing alerts and shows the missing condition', () => {
    const [rule] = normalizeEodAlertRules([
      {
        ...baseRule,
        id: 'drawing-rule-missing',
        enabled: true,
        conditionType: 'drawing',
        drawingId: 'drawing-1',
        drawingKind: 'hline',
        drawingLabel: 'horizontal line 57,212.83',
        drawingPrice: 57212.83,
        drawingOperator: 'crosses_above',
        drawingStatus: 'missing',
        drawingMissingAt: '2026-07-06T00:00:00.000Z',
      },
    ]);

    expect(rule).toMatchObject({
      enabled: true,
      conditionType: 'drawing',
      drawingStatus: 'missing',
      drawingMissingAt: '2026-07-06T00:00:00.000Z',
    });
    expect(formatAlertCondition(rule)).toBe('Missing drawing: horizontal line 57,212.83');
    expect(
      evaluateDrawingEodAlertRules([rule], {
        exchange: 'NSE',
        symbol: 'BANKNIFTY',
        bars: [
          { symbol: 'BANKNIFTY', date: '2026-07-01', open: 57000, high: 57100, low: 56900, close: 57200, volume: 1000 },
          { symbol: 'BANKNIFTY', date: '2026-07-02', open: 57200, high: 57400, low: 57100, close: 57300, volume: 1000 },
        ],
      }),
    ).toHaveLength(0);
  });

  it('formats legacy drawing alert names and conditions from stored drawing price', () => {
    const rule: EodAlertRule = {
      ...baseRule,
      id: 'drawing-rule-legacy',
      name: 'NSE_INDEX:BANKNIFTY horizontal line 57212.8307 cross',
      conditionType: 'drawing',
      drawingId: 'drawing-legacy',
      drawingKind: 'hline',
      drawingLabel: 'horizontal line 57212.8307',
      drawingOperator: 'crosses',
      drawingPrice: 57212.8307,
    };

    expect(formatAlertRuleName(rule)).toBe('NSE:BANKNIFTY horizontal line 57,212.83 cross');
    expect(formatAlertCondition(rule)).toBe('Close crosses horizontal line 57,212.83');
  });

  it('triggers drawing alerts when close crosses a horizontal line', () => {
    const rule: EodAlertRule = {
      ...baseRule,
      id: 'drawing-rule-1',
      name: 'Close crosses support',
      conditionType: 'drawing',
      drawingId: 'drawing-1',
      drawingKind: 'hline',
      drawingLabel: 'horizontal line 100',
      drawingOperator: 'crosses_above',
      drawingPrice: 100,
    };

    const triggers = evaluateDrawingEodAlertRules([rule], {
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      bars: [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 99, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-02', open: 99, high: 105, low: 98, close: 104, volume: 1200 },
      ],
    });

    expect(triggers).toHaveLength(1);
    expect(triggers[0]).toMatchObject({
      ruleId: 'drawing-rule-1',
      date: '2026-07-02',
      condition: 'Close crosses above horizontal line 100',
      triggerValue: 104,
    });
  });

  it('calculates trendline drawing alert values by anchor date', () => {
    const rule: EodAlertRule = {
      ...baseRule,
      id: 'drawing-rule-2',
      name: 'Close crosses trendline',
      conditionType: 'drawing',
      drawingId: 'drawing-2',
      drawingKind: 'trendline',
      drawingLabel: 'trendline',
      drawingOperator: 'crosses_above',
      drawingStartIndex: 0,
      drawingStartDate: '2026-07-01',
      drawingStartPrice: 100,
      drawingEndIndex: 2,
      drawingEndDate: '2026-07-03',
      drawingEndPrice: 110,
    };
    const bars = [
      { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 101, low: 88, close: 99, volume: 1000 },
      { symbol: 'BANKNIFTY', date: '2026-07-02', open: 99, high: 107, low: 98, close: 103, volume: 1000 },
      { symbol: 'BANKNIFTY', date: '2026-07-03', open: 103, high: 112, low: 102, close: 108, volume: 1000 },
      { symbol: 'BANKNIFTY', date: '2026-07-04', open: 108, high: 118, low: 107, close: 117, volume: 1000 },
    ];

    expect(getDrawingAlertLineValue(rule, bars, 3)).toBe(115);
    expect(evaluateDrawingEodAlertRules([rule], { exchange: 'NSE', symbol: 'BANKNIFTY', bars })).toHaveLength(1);
  });

  it('persists alert trigger details as scan-time history events', () => {
    const triggers = evaluatePriceEodAlertRules([baseRule], {
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      bars: [
        { symbol: 'BANKNIFTY', date: '2026-07-01', open: 90, high: 95, low: 88, close: 94, volume: 1000 },
        { symbol: 'BANKNIFTY', date: '2026-07-02', open: 96, high: 105, low: 95, close: 104, volume: 1200 },
      ],
    });

    const history = createEodAlertHistoryEvents(triggers, '2026-07-05T10:00:00.000Z');

    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      ruleId: 'rule-1',
      ruleName: 'Close above 100',
      exchange: 'NSE',
      symbol: 'BANKNIFTY',
      date: '2026-07-02',
      triggerValue: 104,
      message: 'Close above 100 triggered on NSE:BANKNIFTY',
      scannedAt: '2026-07-05T10:00:00.000Z',
    });
  });

  it('normalizes and orders persisted alert history newest first', () => {
    const history = normalizeEodAlertHistoryEvents([
      {
        id: 'old',
        ruleId: 'rule-1',
        ruleName: 'Old',
        exchange: 'NSE',
        symbol: 'ABC',
        date: '2026-07-01',
        condition: 'Close above 10',
        message: 'old',
        scannedAt: '2026-07-05T08:00:00.000Z',
        triggeredAt: '2026-07-05T08:00:01.000Z',
      },
      {
        id: 'new',
        ruleId: 'rule-2',
        ruleName: 'New',
        exchange: 'NSE',
        symbol: 'XYZ',
        date: '2026-07-02',
        condition: 'Close above 20',
        triggerValue: 22,
        message: 'new',
        scannedAt: '2026-07-05T09:00:00.000Z',
        triggeredAt: '2026-07-05T09:00:01.000Z',
      },
      { id: 'invalid' },
    ]);

    expect(history.map((event) => event.id)).toEqual(['new', 'old']);
    expect(history[0].triggerValue).toBe(22);
  });

  it('deduplicates appended alert history events by event id', () => {
    const existing = normalizeEodAlertHistoryEvents([
      {
        id: 'event-1',
        ruleId: 'rule-1',
        ruleName: 'Existing',
        exchange: 'NSE',
        symbol: 'ABC',
        date: '2026-07-01',
        condition: 'Close above 10',
        message: 'existing',
        scannedAt: '2026-07-05T08:00:00.000Z',
        triggeredAt: '2026-07-05T08:00:01.000Z',
      },
    ]);
    const appended = normalizeEodAlertHistoryEvents([
      {
        id: 'event-1',
        ruleId: 'rule-1',
        ruleName: 'Updated',
        exchange: 'NSE',
        symbol: 'ABC',
        date: '2026-07-01',
        condition: 'Close above 10',
        message: 'updated',
        scannedAt: '2026-07-05T09:00:00.000Z',
        triggeredAt: '2026-07-05T09:00:01.000Z',
      },
    ]);

    const history = appendEodAlertHistoryEvents(existing, appended);

    expect(history).toHaveLength(1);
    expect(history[0].message).toBe('updated');
  });
});
