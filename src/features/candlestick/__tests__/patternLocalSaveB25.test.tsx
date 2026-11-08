import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { IndicatorSettingsDialog } from '@/components/IndicatorSettingsDialog';
import { createIndicatorFromCatalogId } from '@/indicators/catalog';
import { parsePersistedWorkspace } from '@/features/workspace/workspacePersistence';
import type { OverlayIndicator } from '@/engine/types';
import { DEFAULT_CANDLESTICK_SETTINGS, loadSavedCandlestickSettings, saveCandlestickSettings } from '@/features/candlestick/candlestickSettingsService';

const dialogSource = readFileSync('src/components/IndicatorSettingsDialog.tsx', 'utf8');
const serviceSource = readFileSync('src/features/candlestick/candlestickSettingsService.ts', 'utf8');

const edited: Extract<OverlayIndicator, { kind: 'PATTERN' }> = {
  id: 'b25-pattern', kind: 'PATTERN', placement: 'overlay',
  patterns: ['hammer', 'doji'], bullColor: '#10b981', bearColor: '#e11d48', neutralColor: '#fde047',
};

describe('B25 PATTERN chart-local save and preserved global defaults', () => {
  it('does not write global candlestick storage from an individual indicator Save', () => {
    expect(dialogSource).not.toContain("import { saveCandlestickSettings }");
    expect(dialogSource).not.toContain('saveCandlestickSettings(');
    expect(dialogSource).toContain('onSave(draft);');
  });
  it('keeps numeric Save guard and existing Remove, Cancel, and positioning', () => {
    expect(dialogSource).toContain('if (hasInvalidNumericInputs)');
    expect(dialogSource).toContain('onRemove(draft.id)');
    expect(dialogSource).toContain('onClose()');
    expect(dialogSource).toContain('useDraggableFloatingWindow({');
  });
  it('retains the legacy global storage service and its key unchanged', () => {
    expect(serviceSource).toContain("eod-chart.candlestick-settings.v1");
    expect(serviceSource).toContain('export function saveCandlestickSettings(');
    expect(serviceSource).toContain('export function loadSavedCandlestickSettings(');
    expect(DEFAULT_CANDLESTICK_SETTINGS.bullColor).toBe('#22c55e');
  });
  it('uses catalogue defaults for newly added PATTERN rather than previously saved global colors', () => {
    const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const data = new Map<string,string>();
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } },
      });
      saveCandlestickSettings({ patterns: ['doji'], bullColor: '#abcdef', bearColor: '#123456', neutralColor: '#fedcba' });
      expect(loadSavedCandlestickSettings().bullColor).toBe('#abcdef');
      const next = createIndicatorFromCatalogId('patterns');
      expect(next.kind).toBe('PATTERN');
      if (next.kind === 'PATTERN') {
        expect(next.bullColor).toBe('#22c55e');
        expect(next.patterns).toContain('hammer');
      }
      expect(loadSavedCandlestickSettings().bullColor).toBe('#abcdef');
    } finally {
      if (old) Object.defineProperty(globalThis, 'localStorage', old);
      if (!old) Reflect.deleteProperty(globalThis, 'localStorage');
    }
  });
  it('preserves edited chart-local patterns and colours through workspace restore', () => {
    const stored = JSON.stringify({
      version: 1, activeChartTabId: 'b25-tab',
      chartTabs: [{
        id: 'b25-tab', title: 'B25', instrument: null, timeframe: 'D', chartType: 'candles',
        renkoBrickSize: 10, viewport: { startIndex: 0, endIndex: 40 },
        indicators: [edited], drawings: [], indicatorPaneHeight: 160,
        sheets: [], activeSheetId: null, layoutMode: 'single',
      }],
    });
    const restored = parsePersistedWorkspace(stored)?.chartTabs[0].indicators[0];
    expect(restored).toMatchObject(edited);
  });
  it('renders PATTERN input and colour controls without modifying its saved object', () => {
    const original = JSON.stringify(edited);
    const markup = renderToStaticMarkup(createElement(IndicatorSettingsDialog, {
      indicator: edited, onSave: () => undefined, onRemove: () => undefined, onClose: () => undefined,
    }));
    expect(markup).toContain('Candlestick Patterns');
    expect(markup).toContain('Save</button>');
    expect(JSON.stringify(edited)).toBe(original);
  });
  it('keeps new PATTERN indicators independent of a chart-local saved indicator', () => {
    const first = createIndicatorFromCatalogId('patterns');
    const second = createIndicatorFromCatalogId('patterns');
    expect(first.id).not.toBe(edited.id);
    expect(second.id).not.toBe(edited.id);
    if (first.kind === 'PATTERN' && second.kind === 'PATTERN') {
      expect(first.bullColor).toBe(second.bullColor);
      expect(first.bullColor).not.toBe(edited.bullColor);
      expect(first.patterns).not.toBe(edited.patterns);
    }
  });
});
