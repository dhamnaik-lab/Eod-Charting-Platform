import type { CorporateActionNormalFetchExchangeSelection } from './corporateActionNormalWorkflowAdapter';

const NORMAL_FETCH_HISTORY_KEY = 'eod-chart.corporate-action.normal-last-fetch.v1';
const IST_OFFSET_MINUTES = 330;

export interface CorporateActionNormalLastFetchRecord {
  scope: CorporateActionNormalFetchExchangeSelection;
  completedAtIso: string;
}

export interface CorporateActionNormalFetchHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type CorporateActionNormalFetchHistoryMap = Record<
  string,
  CorporateActionNormalLastFetchRecord
>;

function resolveCorporateActionNormalFetchHistoryStorage(
  storage?: CorporateActionNormalFetchHistoryStorage,
): CorporateActionNormalFetchHistoryStorage | null {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function isCorporateActionNormalFetchScope(
  value: unknown,
): value is CorporateActionNormalFetchExchangeSelection {
  return value === 'BOTH' || value === 'NSE' || value === 'BSE';
}

function isCorporateActionNormalLastFetchRecord(
  value: unknown,
): value is CorporateActionNormalLastFetchRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<CorporateActionNormalLastFetchRecord>;
  if (!isCorporateActionNormalFetchScope(candidate.scope)) {
    return false;
  }
  if (typeof candidate.completedAtIso !== 'string' || !candidate.completedAtIso.trim()) {
    return false;
  }

  return Number.isFinite(new Date(candidate.completedAtIso).getTime());
}

function readCorporateActionNormalFetchHistoryMap(
  storage: CorporateActionNormalFetchHistoryStorage,
): CorporateActionNormalFetchHistoryMap {
  try {
    const raw = storage.getItem(NORMAL_FETCH_HISTORY_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const next: CorporateActionNormalFetchHistoryMap = {};
    for (const [databasePath, value] of Object.entries(parsed)) {
      if (isCorporateActionNormalLastFetchRecord(value)) {
        next[databasePath] = value;
      }
    }
    return next;
  } catch {
    return {};
  }
}

export function readCorporateActionNormalLastFetch(
  databasePath: string | null,
  storage?: CorporateActionNormalFetchHistoryStorage,
): CorporateActionNormalLastFetchRecord | null {
  if (!databasePath) {
    return null;
  }

  const targetStorage = resolveCorporateActionNormalFetchHistoryStorage(storage);
  if (!targetStorage) {
    return null;
  }

  const record = readCorporateActionNormalFetchHistoryMap(targetStorage)[databasePath];
  return isCorporateActionNormalLastFetchRecord(record) ? record : null;
}

export function writeCorporateActionNormalLastFetch(
  databasePath: string,
  record: CorporateActionNormalLastFetchRecord,
  storage?: CorporateActionNormalFetchHistoryStorage,
): void {
  if (!databasePath || !isCorporateActionNormalLastFetchRecord(record)) {
    return;
  }

  const targetStorage = resolveCorporateActionNormalFetchHistoryStorage(storage);
  if (!targetStorage) {
    return;
  }

  try {
    const history = readCorporateActionNormalFetchHistoryMap(targetStorage);
    targetStorage.setItem(
      NORMAL_FETCH_HISTORY_KEY,
      JSON.stringify({
        ...history,
        [databasePath]: record,
      }),
    );
  } catch {
    return;
  }
}

export function formatCorporateActionNormalFetchScope(
  scope: CorporateActionNormalFetchExchangeSelection,
): string {
  if (scope === 'NSE') {
    return 'NSE';
  }
  if (scope === 'BSE') {
    return 'BSE';
  }
  return 'NSE + BSE';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatCorporateActionNormalLastFetch(
  record: CorporateActionNormalLastFetchRecord | null,
): string {
  if (!record) {
    return 'Never for this database.';
  }

  const sourceDate = new Date(record.completedAtIso);
  if (!Number.isFinite(sourceDate.getTime())) {
    return 'Never for this database.';
  }

  const istDate = new Date(sourceDate.getTime() + IST_OFFSET_MINUTES * 60 * 1000);
  const dateText =
    pad2(istDate.getUTCDate()) + '-' +
    pad2(istDate.getUTCMonth() + 1) + '-' +
    istDate.getUTCFullYear();
  const timeText = pad2(istDate.getUTCHours()) + ':' + pad2(istDate.getUTCMinutes());

  return formatCorporateActionNormalFetchScope(record.scope) +
    ' \u00b7 ' + dateText + ' ' + timeText + ' IST';
}