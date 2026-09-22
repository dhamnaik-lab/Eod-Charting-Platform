import type { ChartDrawing, ChartDrawingScopes, OHLCBar } from '@/engine/types';
import { remapDrawingsAcrossTimeframe } from '@/features/charts/drawingTimeframeAnchorService';

export interface DrawingScopeInstrument {
  symbol: string;
  exchange: string;
}

export interface DrawingScopeState {
  instrument: DrawingScopeInstrument | null;
  drawings: ChartDrawing[];
  drawingScopes: ChartDrawingScopes;
  displayBars?: readonly OHLCBar[];
}

export function getDrawingScopeKey(instrument: DrawingScopeInstrument | null | undefined): string | null {
  if (!instrument?.symbol?.trim() || !instrument.exchange?.trim()) return null;
  return `${instrument.exchange.trim().toUpperCase()}:${instrument.symbol.trim().toUpperCase()}`;
}

export function getScopedDrawings(
  scopes: ChartDrawingScopes | null | undefined,
  instrument: DrawingScopeInstrument | null | undefined,
): ChartDrawing[] {
  const key = getDrawingScopeKey(instrument);
  if (!key) return [];
  return [...(scopes?.[key] ?? [])];
}

export function setScopedDrawings(
  scopes: ChartDrawingScopes | null | undefined,
  instrument: DrawingScopeInstrument | null | undefined,
  drawings: readonly ChartDrawing[],
): ChartDrawingScopes {
  const key = getDrawingScopeKey(instrument);
  if (!key) return { ...(scopes ?? {}) };
  return {
    ...(scopes ?? {}),
    [key]: [...drawings],
  };
}

/**
 * Captures stable timestamps for the current visible drawings before they leave the active symbol.
 * Existing D1.1 timestamps are preserved; legacy drawings acquire timestamps from the current bars.
 */
export function snapshotCurrentDrawingScope(state: DrawingScopeState): ChartDrawingScopes {
  const stampedDrawings = state.displayBars?.length
    ? remapDrawingsAcrossTimeframe(state.drawings, state.displayBars, state.displayBars)
    : [...state.drawings];
  return setScopedDrawings(state.drawingScopes, state.instrument, stampedDrawings);
}

export function activateInstrumentDrawingScope(
  state: DrawingScopeState,
  targetInstrument: DrawingScopeInstrument,
): { drawings: ChartDrawing[]; drawingScopes: ChartDrawingScopes } {
  const drawingScopes = snapshotCurrentDrawingScope(state);
  return {
    drawingScopes,
    drawings: getScopedDrawings(drawingScopes, targetInstrument),
  };
}

/**
 * Rebinds the active drawing collection after a symbol has loaded. The target bars provide
 * stable timestamps for legacy drawings and remap timestamped drawings to the loaded timeframe.
 */
export function bindLoadedInstrumentDrawingScope(
  state: DrawingScopeState,
  requestedInstrument: DrawingScopeInstrument,
  resolvedInstrument: DrawingScopeInstrument,
  targetBars: readonly OHLCBar[],
): { drawings: ChartDrawing[]; drawingScopes: ChartDrawingScopes } {
  const requestedKey = getDrawingScopeKey(requestedInstrument);
  const resolvedKey = getDrawingScopeKey(resolvedInstrument);
  let drawingScopes: ChartDrawingScopes = { ...(state.drawingScopes ?? {}) };

  let candidate = state.drawings;
  if (resolvedKey && resolvedKey !== requestedKey && drawingScopes[resolvedKey]) {
    candidate = drawingScopes[resolvedKey];
  }

  const drawings = targetBars.length
    ? remapDrawingsAcrossTimeframe(candidate, targetBars, targetBars)
    : [...candidate];

  drawingScopes = setScopedDrawings(drawingScopes, resolvedInstrument, drawings);
  if (requestedKey && resolvedKey && requestedKey !== resolvedKey) {
    const { [requestedKey]: _alias, ...withoutRequestedAlias } = drawingScopes;
    drawingScopes = withoutRequestedAlias;
  }

  return { drawings, drawingScopes };
}
