import { useMemo, useState } from 'react';
import type { IdentityInstrumentCategory } from '@/types/desktop';
import type { HistoricalChangeFilter, HistoricalSearchScope } from './historicalIdentitySearch';
import type { IdentityReportOutcome } from './identityReceiptPresentation';

export type IdentityView = 'current' | 'historical' | 'recent' | 'diagnostics';
export type HistoricalOutcomeFilter = 'actionable' | 'all' | 'duplicates' | 'skipped' | 'errors';
export interface IdentityDisplayPreferences {
  view: IdentityView; query: string; scope: HistoricalSearchScope; changeType: HistoricalChangeFilter;
  category: 'all' | IdentityInstrumentCategory; outcome: HistoricalOutcomeFilter;
  effectsOpen: boolean; sourceStatusOpen: boolean; currentQuery: string;
  legacyOpen: boolean; runEvidenceOpen: boolean; selectedRunId: string; legacyQuery: string;
  reportOutcome: IdentityReportOutcome;
}
export const DEFAULT_IDENTITY_DISPLAY: IdentityDisplayPreferences = {
  view: 'current', query: '', scope: 'all', changeType: 'all', category: 'all', outcome: 'actionable',
  effectsOpen: false, sourceStatusOpen: false, currentQuery: '',
  legacyOpen: false, runEvidenceOpen: false, selectedRunId: '', legacyQuery: '',
  reportOutcome: 'applied',
};
export function identityDisplayKey(database: string | null, exchange: string, source: string) {
  return database ? `eod-chart.identity.display.v1:${encodeURIComponent(database.toLowerCase())}:${exchange}:${source}` : null;
}
export function parseIdentityDisplay(raw: string | null): IdentityDisplayPreferences {
  let value: Record<string, unknown> = {};
  try { const parsed = JSON.parse(raw ?? '{}'); if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) value = parsed; } catch { /* Use safe defaults. */ }
  const pick = <T extends string>(key: string, choices: readonly T[], fallback: T): T => choices.includes(value[key] as T) ? value[key] as T : fallback;
  return {
    view: pick('view', ['current','historical','recent','diagnostics'], 'current'),
    query: typeof value.query === 'string' ? value.query.slice(0, 500) : '',
    currentQuery: typeof value.currentQuery === 'string' ? value.currentQuery.slice(0, 500) : '',
    scope: pick('scope', ['all','symbols','names','dates'], 'all'),
    changeType: pick('changeType', ['all','SYMBOL_CHANGE','NAME_CHANGE','BOTH'], 'all'),
    category: pick('category', ['all','equity','etf','mutualFund','debt','reitInvit','unknown'], 'all'),
    outcome: pick('outcome', ['actionable','all','duplicates','skipped','errors'], 'actionable'),
    effectsOpen: value.effectsOpen === true, sourceStatusOpen: value.sourceStatusOpen === true,
    legacyOpen: value.legacyOpen === true, runEvidenceOpen: value.runEvidenceOpen === true,
    selectedRunId: typeof value.selectedRunId === 'string' ? value.selectedRunId.slice(0,200) : '',
    legacyQuery: typeof value.legacyQuery === 'string' ? value.legacyQuery.slice(0,500) : '',
    reportOutcome: pick('reportOutcome',['applied','all','skipped','duplicates','held','errors'],'applied'),
  };
}
export function readIdentityDisplay(key: string | null, storage?: Pick<Storage,'getItem'>) {
  try { return parseIdentityDisplay(key ? (storage ?? (typeof window !== 'undefined' ? window.localStorage : null))?.getItem(key) ?? null : null); }
  catch { return { ...DEFAULT_IDENTITY_DISPLAY }; }
}
export function writeIdentityDisplay(key: string | null, value: IdentityDisplayPreferences, storage?: Pick<Storage,'setItem'>) {
  try {
    const target = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!key || !target) return false;
    target.setItem(key, JSON.stringify(parseIdentityDisplay(JSON.stringify(value)))); return true;
  } catch { return false; }
}
export function useIdentityDisplayPreferences(key: string | null) {
  const loaded = useMemo(() => readIdentityDisplay(key), [key]);
  const [entry, setEntry] = useState<{key: string | null; value: IdentityDisplayPreferences; saved: boolean | null}>({ key, value: loaded, saved: null });
  const preferences = entry.key === key ? entry.value : loaded;
  const update = (patch: Partial<IdentityDisplayPreferences>) => setEntry(previous => {
    const next = parseIdentityDisplay(JSON.stringify({ ...(previous.key === key ? previous.value : loaded), ...patch }));
    const saved = key ? writeIdentityDisplay(key,next) : null;
    return { key, value: next, saved };
  });
  return [preferences, update, Boolean(key && entry.key === key && entry.saved === false)] as const;
}
