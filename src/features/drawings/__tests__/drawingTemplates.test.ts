import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyDrawingTemplate,
  deleteDrawingTemplate,
  getDefaultDrawingTemplate,
  getDrawingTemplates,
  loadStoredDrawingTemplates,
  saveDrawingTemplate,
  saveStoredDrawingTemplates,
  setDefaultDrawingTemplate,
} from '@/features/drawings/drawingTemplates';
import type { DrawingPropertiesState } from '@/components/ChartDrawingPropertiesDialog';

function createMockDrawingProps(): DrawingPropertiesState {
  return {
    drawingId: 'drawing-1',
    color: '#3b82f6',
    lineWidth: '2',
    lineStyle: 'solid',
    locked: false,
    extendLeft: false,
    extendRight: true,
    showLabel: true,
    labelPosition: 'left',
    price: '100',
    barIndex: '10',
    startIndex: '5',
    endIndex: '15',
    startPrice: '90',
    endPrice: '110',
    anchorCoordinates: [],
    offset: '0',
    text: 'Test',
    fontSize: '12',
    fontFamily: 'sans',
    bold: false,
    italic: false,
    textAlign: 'left',
    boxWidth: '100',
    boxHeight: '50',
    presentation: {
      useOneColor: false,
      lines: {},
      fills: {},
    },
    visibility: {
      visible: true,
      timeframes: {
        D: true,
        W: true,
        M: true,
      },
    },
    positionEntry: '100',
    positionTarget: '120',
    positionStop: '90',
    fibArcFullCircles: false,
    fibArcCoefficientFormat: 'coefficient',
    fibArcLabelSides: { left: true, right: true, top: false, bottom: false },
    fibWedgeCoefficientFormat: 'coefficient',
    fibSpiralCounterclockwise: false,
    fibFanCoefficientFormat: 'coefficient',
    fibFanReverse: false,
    fibFanShowBackground: true,
    fibFanShowGrid: true,
    fibFanPriceLabelSides: { left: true, right: false },
    fibFanTimeLabelSides: { top: true, bottom: false },
  };
}

class MemoryStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key: string) {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }
  removeItem(key: string) {
    this.store.delete(key);
  }
  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null;
  }
}

describe('Drawing Templates Service', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    (globalThis as unknown as { localStorage: Storage }).localStorage = memoryStorage;
  });

  it('loads empty list when storage is empty', () => {
    expect(loadStoredDrawingTemplates()).toEqual([]);
    expect(getDrawingTemplates('trendline')).toEqual([]);
  });

  it('saves and retrieves templates by drawing kind', () => {
    const props = createMockDrawingProps();
    props.color = '#ef4444';
    props.lineWidth = '3';

    const saved = saveDrawingTemplate('Red Support', 'trendline', props);
    expect(saved.name).toBe('Red Support');
    expect(saved.kind).toBe('trendline');
    expect(saved.style.color).toBe('#ef4444');
    expect(saved.style.lineWidth).toBe('3');

    const trendlineTemplates = getDrawingTemplates('trendline');
    expect(trendlineTemplates.length).toBe(1);
    expect(trendlineTemplates[0].name).toBe('Red Support');

    const fibTemplates = getDrawingTemplates('fib');
    expect(fibTemplates.length).toBe(0);
  });

  it('sets and retrieves default template for a kind', () => {
    const props = createMockDrawingProps();
    const t1 = saveDrawingTemplate('Style A', 'fib', props, false);
    const t2 = saveDrawingTemplate('Style B', 'fib', props, true);

    expect(getDefaultDrawingTemplate('fib')?.id).toBe(t2.id);

    setDefaultDrawingTemplate(t1.id);
    expect(getDefaultDrawingTemplate('fib')?.id).toBe(t1.id);
    expect(getDefaultDrawingTemplate('fib')?.name).toBe('Style A');
  });

  it('applies saved template styles to drawing properties state', () => {
    const templateProps = createMockDrawingProps();
    templateProps.color = '#22c55e';
    templateProps.lineWidth = '4';
    templateProps.lineStyle = 'dashed';

    const template = saveDrawingTemplate('Green Target', 'hline', templateProps);

    const currentProps = createMockDrawingProps();
    currentProps.color = '#ffffff';
    currentProps.lineWidth = '1';
    currentProps.lineStyle = 'solid';
    currentProps.price = '250.50'; // drawing coordinate should be preserved

    const applied = applyDrawingTemplate(template, currentProps);
    expect(applied.color).toBe('#22c55e');
    expect(applied.lineWidth).toBe('4');
    expect(applied.lineStyle).toBe('dashed');
    expect(applied.price).toBe('250.50'); // coordinate intact
  });

  it('deletes template by ID', () => {
    const props = createMockDrawingProps();
    const t = saveDrawingTemplate('Temp Template', 'rect', props);
    expect(getDrawingTemplates('rect').length).toBe(1);

    deleteDrawingTemplate(t.id);
    expect(getDrawingTemplates('rect').length).toBe(0);
  });
});
