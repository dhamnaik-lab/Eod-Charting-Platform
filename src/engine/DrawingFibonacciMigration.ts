import type { FibonacciLevelDefinition, FibonacciToolKind, FibonacciToolSettings } from './DrawingFibonacciContracts';
import { FIBONACCI_MAX_LEVEL_ROWS, isFibonacciToolKind } from './DrawingFibonacciContracts';
import { cloneFibonacciLevels, createDefaultFibonacciSettings } from './DrawingFibonacciDefaults';
import type { ChartDrawing } from './types';

const PERSISTED_FIBONACCI_KINDS = new Set<ChartDrawing['kind']>([
  'fib',
  'fibExtension',
  'trendFibExtension',
  'fibChannel',
  'fibTimeZone',
  'fibTimeExtension',
  'fibCircles',
  'fibSpiral',
  'fibArcs',
  'fibWedge',
  'fibFan',
]);

export function isPersistedFibonacciDrawingKind(kind: ChartDrawing['kind']): kind is Extract<
  ChartDrawing['kind'],
  FibonacciToolKind
> {
  return PERSISTED_FIBONACCI_KINDS.has(kind);
}

function normalizeLevelRows(
  rows: unknown,
  fallback: readonly FibonacciLevelDefinition[],
): FibonacciLevelDefinition[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return cloneFibonacciLevels(fallback);
  }

  const normalized: FibonacciLevelDefinition[] = [];
  const usedIds = new Set<string>();
  rows.slice(0, FIBONACCI_MAX_LEVEL_ROWS).forEach((row, index) => {
    if (!row || typeof row !== 'object') return;
    const candidate = row as Partial<FibonacciLevelDefinition>;
    if (typeof candidate.value !== 'number' || !Number.isFinite(candidate.value)) return;
    const preferredId = typeof candidate.id === 'string' && candidate.id.trim()
      ? candidate.id.trim()
      : fallback[index]?.id ?? `custom-${String(index + 1).padStart(2, '0')}`;
    let id = preferredId;
    let duplicateOrdinal = 2;
    while (usedIds.has(id)) {
      id = `${preferredId}-${duplicateOrdinal}`;
      duplicateOrdinal += 1;
    }
    usedIds.add(id);
    normalized.push({
      id,
      value: candidate.value,
      enabled: candidate.enabled !== false,
      ...(typeof candidate.customText === 'string' ? { customText: candidate.customText } : {}),
    });
  });
  return normalized.length ? normalized : cloneFibonacciLevels(fallback);
}

export function normalizeFibonacciSettings(
  kind: Extract<ChartDrawing['kind'], FibonacciToolKind>,
  existing: unknown,
): FibonacciToolSettings {
  const defaults = createDefaultFibonacciSettings(kind);
  const candidate = existing && typeof existing === 'object' ? (existing as Partial<FibonacciToolSettings>) : null;

  if (!candidate || candidate.kind !== kind || candidate.schemaVersion !== 1) {
    return defaults;
  }

  if (kind === 'fibFan' && defaults.kind === 'fibFan' && candidate.kind === 'fibFan') {
    return {
      ...defaults,
      ...candidate,
      schemaVersion: 1,
      kind,
      priceLevels: normalizeLevelRows(candidate.priceLevels, defaults.priceLevels),
      timeLevels: normalizeLevelRows(candidate.timeLevels, defaults.timeLevels),
    };
  }

  if ('levels' in defaults) {
    const commonCandidate = candidate as Partial<Extract<FibonacciToolSettings, { levels: FibonacciLevelDefinition[] }>>;
    return {
      ...defaults,
      ...candidate,
      schemaVersion: 1,
      kind,
      levels: normalizeLevelRows(commonCandidate.levels, defaults.levels),
    } as FibonacciToolSettings;
  }

  if (kind === 'fibSpiral' && defaults.kind === 'fibSpiral' && candidate.kind === 'fibSpiral') {
    const spiralCandidate = candidate as Partial<Extract<FibonacciToolSettings, { kind: 'fibSpiral' }>>;
    const basis = spiralCandidate.basisPerp;
    const hasValidBasis = Boolean(
      basis &&
      Number.isFinite(basis.barDelta) &&
      Number.isFinite(basis.priceDelta) &&
      Math.hypot(basis.barDelta, basis.priceDelta) > 1e-12,
    );
    return {
      ...defaults,
      counterclockwise: spiralCandidate.counterclockwise === true,
      ...(hasValidBasis
        ? { basisPerp: { barDelta: basis!.barDelta, priceDelta: basis!.priceDelta } }
        : {}),
    };
  }

  return defaults;
}

function getLegacyLevelSlotPrefix(kind: ChartDrawing['kind']): string {
  if (kind === 'fibCircles') return 'circle';
  if (kind === 'fibArcs') return 'arc';
  if (kind === 'fibFan') return 'ray';
  return 'level';
}

function findLegacyLineOverride(
  lines: NonNullable<ChartDrawing['presentation']>['lines'],
  prefix: string,
  value: number,
) {
  if (!lines) return undefined;
  const exactKey = `${prefix}:${value}`;
  if (lines[exactKey]) return lines[exactKey];

  const match = Object.entries(lines).find(([key]) => {
    if (!key.startsWith(`${prefix}:`)) return false;
    const parsed = Number(key.slice(prefix.length + 1));
    return Number.isFinite(parsed) && Math.abs(parsed - value) < 1e-9;
  });
  return match?.[1];
}

function addStableLevelPresentationAliases(
  drawing: ChartDrawing,
  settings: FibonacciToolSettings,
): ChartDrawing['presentation'] {
  const existingPresentation = drawing.presentation;
  const existingLines = existingPresentation?.lines;
  if (!existingLines) return existingPresentation;

  const nextLines = { ...existingLines };
  let changed = false;
  const legacyPrefix = getLegacyLevelSlotPrefix(drawing.kind);

  const addAliases = (levels: readonly FibonacciLevelDefinition[], stablePrefix: string) => {
    levels.forEach((level) => {
      const stableKey = `${stablePrefix}:${level.id}`;
      if (nextLines[stableKey]) return;
      const legacy = findLegacyLineOverride(existingLines, legacyPrefix, level.value);
      if (!legacy) return;
      nextLines[stableKey] = { ...legacy };
      changed = true;
    });
  };

  if (settings.kind === 'fibFan') {
    // Preserve the legacy one-family ray styles as price-level aliases only.
    // Time-level styles start from the new TradingView-compatible defaults in F1D.
    addAliases(settings.priceLevels, 'price');
  } else if ('levels' in settings) {
    addAliases(settings.levels, 'level');
  }

  return changed ? { ...existingPresentation, lines: nextLines } : existingPresentation;
}

/**
 * Add F1 settings without changing the drawing kind, anchors or current renderer behavior.
 * This function is safe for workspace-load normalization and deliberately keeps legacy
 * coefficient-keyed presentation entries alongside the new stable-ID aliases.
 */
export function normalizeFibonacciDrawing(drawing: ChartDrawing): ChartDrawing {
  if (!isPersistedFibonacciDrawingKind(drawing.kind) || !isFibonacciToolKind(drawing.kind)) {
    return drawing;
  }

  const settings = normalizeFibonacciSettings(drawing.kind, drawing.toolSettings?.fibonacci);
  const presentation = addStableLevelPresentationAliases(drawing, settings);
  const nextToolSettings = {
    ...drawing.toolSettings,
    fibonacci: settings,
  };

  if (drawing.toolSettings?.fibonacci === settings && presentation === drawing.presentation) {
    return drawing;
  }

  return {
    ...drawing,
    toolSettings: nextToolSettings,
    ...(presentation ? { presentation } : {}),
  } as ChartDrawing;
}

export function getNormalizedFibonacciSettings(drawing: ChartDrawing): FibonacciToolSettings | null {
  if (!isPersistedFibonacciDrawingKind(drawing.kind) || !isFibonacciToolKind(drawing.kind)) return null;
  return normalizeFibonacciSettings(drawing.kind, drawing.toolSettings?.fibonacci);
}
