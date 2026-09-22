import type { DrawingTool } from '@/engine/types';
import type { DrawingPropertiesState } from '@/components/ChartDrawingPropertiesDialog';

export interface DrawingTemplate {
  id: string;
  name: string;
  kind: DrawingTool;
  createdAt: string;
  isDefault?: boolean;
  style: Partial<DrawingPropertiesState>;
}

const DRAWING_TEMPLATES_STORAGE_KEY = 'eod-chart.drawing-templates.v1';

function getStorage(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof globalThis !== 'undefined' && (globalThis as unknown as { localStorage?: Storage }).localStorage) {
    return (globalThis as unknown as { localStorage: Storage }).localStorage;
  }
  return null;
}

export function loadStoredDrawingTemplates(): DrawingTemplate[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(DRAWING_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredDrawingTemplates(templates: DrawingTemplate[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(DRAWING_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // ignore storage quota errors
  }
}

export function getDrawingTemplates(kind?: DrawingTool): DrawingTemplate[] {
  const all = loadStoredDrawingTemplates();
  if (!kind) return all;
  return all.filter((t) => t.kind === kind);
}

export function extractTemplateStyle(props: DrawingPropertiesState): Partial<DrawingPropertiesState> {
  return {
    color: props.color,
    lineWidth: props.lineWidth,
    lineStyle: props.lineStyle,
    extendLeft: props.extendLeft,
    extendRight: props.extendRight,
    showLabel: props.showLabel,
    labelPosition: props.labelPosition,
    fontSize: props.fontSize,
    fontFamily: props.fontFamily,
    bold: props.bold,
    italic: props.italic,
    textAlign: props.textAlign,
    presentation: props.presentation ? JSON.parse(JSON.stringify(props.presentation)) : undefined,
    fibArcFullCircles: props.fibArcFullCircles,
    fibArcCoefficientFormat: props.fibArcCoefficientFormat,
    fibArcLabelSides: props.fibArcLabelSides,
    fibWedgeCoefficientFormat: props.fibWedgeCoefficientFormat,
    fibSpiralCounterclockwise: props.fibSpiralCounterclockwise,
    fibFanCoefficientFormat: props.fibFanCoefficientFormat,
    fibFanReverse: props.fibFanReverse,
    fibFanShowBackground: props.fibFanShowBackground,
    fibFanShowGrid: props.fibFanShowGrid,
    fibFanPriceLabelSides: props.fibFanPriceLabelSides,
    fibFanTimeLabelSides: props.fibFanTimeLabelSides,
  };
}

export function saveDrawingTemplate(
  name: string,
  kind: DrawingTool,
  props: DrawingPropertiesState,
  isDefault = false,
): DrawingTemplate {
  const all = loadStoredDrawingTemplates();
  const id = `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const style = extractTemplateStyle(props);

  const updated = all.map((t) => (t.kind === kind && isDefault ? { ...t, isDefault: false } : t));

  const newTemplate: DrawingTemplate = {
    id,
    name: name.trim() || 'Untitled Template',
    kind,
    createdAt: new Date().toISOString(),
    isDefault,
    style,
  };

  updated.push(newTemplate);
  saveStoredDrawingTemplates(updated);
  return newTemplate;
}

export function deleteDrawingTemplate(id: string): void {
  const all = loadStoredDrawingTemplates();
  const filtered = all.filter((t) => t.id !== id);
  saveStoredDrawingTemplates(filtered);
}

export function setDefaultDrawingTemplate(id: string): void {
  const all = loadStoredDrawingTemplates();
  const target = all.find((t) => t.id === id);
  if (!target) return;

  const updated = all.map((t) => {
    if (t.kind === target.kind) {
      return { ...t, isDefault: t.id === id };
    }
    return t;
  });

  saveStoredDrawingTemplates(updated);
}

export function getDefaultDrawingTemplate(kind: DrawingTool): DrawingTemplate | null {
  const templates = getDrawingTemplates(kind);
  return templates.find((t) => t.isDefault) ?? null;
}

export function applyDrawingTemplate(
  template: DrawingTemplate,
  currentProps: DrawingPropertiesState,
): DrawingPropertiesState {
  return {
    ...currentProps,
    ...template.style,
    presentation: template.style.presentation
      ? { ...currentProps.presentation, ...template.style.presentation }
      : currentProps.presentation,
  };
}
