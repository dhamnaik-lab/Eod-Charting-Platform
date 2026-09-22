import type { ChartDrawing } from './types';

export interface RuntimeFibonacciLevel {
  id: string;
  value: number;
  enabled: boolean;
  text?: string;
}

export interface RuntimeFibonacciOptions {
  reverse: boolean;
  showPrices: boolean;
  logScaleLevels: boolean;
  coefficientFormat: 'coefficient' | 'percent';
  horizontalLabelPosition: 'left' | 'right';
  verticalLabelPosition: 'top' | 'bottom';
}

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function getToolSettings(drawing: ChartDrawing): UnknownRecord | null {
  return asRecord((drawing as ChartDrawing & { toolSettings?: unknown }).toolSettings);
}

function findLevelArray(settings: UnknownRecord | null): unknown[] | null {
  if (!settings) return null;
  const directCandidates = [
    settings.levels,
    settings.fibonacciLevels,
    settings.levelDefinitions,
  ];
  for (const candidate of directCandidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  for (const childName of ['fibonacci', 'fib', 'priceLevels', 'timeLevels']) {
    const child = asRecord(settings[childName]);
    if (!child) continue;
    for (const candidate of [child.levels, child.fibonacciLevels, child.levelDefinitions]) {
      if (Array.isArray(candidate)) return candidate;
    }
  }
  return null;
}

function readBoolean(settings: UnknownRecord | null, names: readonly string[], fallback: boolean): boolean {
  if (!settings) return fallback;
  const containers: UnknownRecord[] = [settings];
  for (const childName of ['fibonacci', 'fib', 'labels']) {
    const child = asRecord(settings[childName]);
    if (child) containers.push(child);
  }
  for (const container of containers) {
    for (const name of names) {
      if (typeof container[name] === 'boolean') return container[name] as boolean;
    }
  }
  return fallback;
}

function readString(settings: UnknownRecord | null, names: readonly string[]): string | null {
  if (!settings) return null;
  const containers: UnknownRecord[] = [settings];
  for (const childName of ['fibonacci', 'fib', 'labels']) {
    const child = asRecord(settings[childName]);
    if (child) containers.push(child);
  }
  for (const container of containers) {
    for (const name of names) {
      const value = container[name];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }
  return null;
}

export function resolveFibonacciLevels(
  drawing: ChartDrawing,
  fallbackValues: readonly number[],
): RuntimeFibonacciLevel[] {
  const settings = getToolSettings(drawing);
  const stored = findLevelArray(settings);
  if (!stored?.length) {
    return fallbackValues.map((value, index) => ({ id: `legacy-${index}`, value, enabled: true }));
  }

  const resolved = stored.flatMap((candidate, index): RuntimeFibonacciLevel[] => {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return [{ id: `level-${index}`, value: candidate, enabled: true }];
    }
    const record = asRecord(candidate);
    if (!record) return [];
    const rawValue = record.value ?? record.coefficient ?? record.ratio ?? record.level;
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) return [];
    const idCandidate = record.id ?? record.key ?? record.levelId;
    const id = typeof idCandidate === 'string' && idCandidate.trim() ? idCandidate.trim() : `level-${index}`;
    const enabled = record.enabled !== false && record.visible !== false;
    const rawText = record.customText ?? record.text ?? record.label;
    const text = typeof rawText === 'string' && rawText.trim() ? rawText.trim() : undefined;
    return [{ id, value, enabled, text }];
  });

  return resolved.length ? resolved : fallbackValues.map((value, index) => ({ id: `legacy-${index}`, value, enabled: true }));
}

export function resolveFibonacciOptions(drawing: ChartDrawing): RuntimeFibonacciOptions {
  const settings = getToolSettings(drawing);
  const coefficientFormatRaw = readString(settings, ['coefficientFormat', 'levelFormat', 'coefficients']);
  const verticalRaw = readString(settings, ['verticalLabelPosition', 'labelVerticalPosition', 'verticalPosition']);
  const horizontalRaw = readString(settings, ['horizontalLabelPosition', 'labelHorizontalPosition', 'horizontalPosition']);
  const drawingLabelPosition = drawing.labelPosition === 'right' ? 'right' : 'left';
  return {
    reverse: readBoolean(settings, ['reverse', 'reversed'], false),
    showPrices: readBoolean(settings, ['showPrices', 'pricesVisible', 'prices'], true),
    logScaleLevels: readBoolean(settings, ['logScaleLevels', 'logScale', 'logarithmic'], false),
    coefficientFormat: coefficientFormatRaw === 'percent' || coefficientFormatRaw === 'percentage' ? 'percent' : 'coefficient',
    horizontalLabelPosition: horizontalRaw === 'right' ? 'right' : horizontalRaw === 'left' ? 'left' : drawingLabelPosition,
    verticalLabelPosition: verticalRaw === 'top' ? 'top' : 'bottom',
  };
}

export function formatFibonacciCoefficient(value: number, format: 'coefficient' | 'percent'): string {
  if (format === 'percent') {
    const percent = value * 100;
    const precision = Math.abs(percent - Math.round(percent)) < 1e-9 ? 0 : Math.abs(percent * 10 - Math.round(percent * 10)) < 1e-9 ? 1 : 2;
    return `${percent.toFixed(precision)}%`;
  }
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function getFibonacciLevelSlotId(level: RuntimeFibonacciLevel): string {
  return `level:${level.id}`;
}

export function getLegacyFibonacciLevelSlotId(level: RuntimeFibonacciLevel): string {
  return `level:${level.value}`;
}
