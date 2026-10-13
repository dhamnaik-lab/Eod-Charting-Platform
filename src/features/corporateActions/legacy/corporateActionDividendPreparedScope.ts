import type { CorporateActionImportRow } from '@/platform';

export const CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION = 'CA_DIVIDEND_PREPARED_SCOPE_R1' as const;

export interface CorporateActionPrepareCycleIdentity {
  generation: number;
  expectedDatabasePath: string;
}

export type CorporateActionDividendPreparedScopeUnavailableReason =
  | 'INVALID_GENERATION'
  | 'PREPARATION_CANCELLED'
  | 'PREPARATION_INCOMPLETE'
  | 'STALE_GENERATION'
  | 'DATABASE_CONTEXT_MISSING'
  | 'DATABASE_CHANGED';

export interface BuildCorporateActionDividendPreparedScopeInput {
  rows: readonly CorporateActionImportRow[];
  cycle: CorporateActionPrepareCycleIdentity;
  currentGeneration: number;
  currentDatabasePath: string;
  complete: boolean;
  cancelled?: boolean;
}

export interface CorporateActionDividendPreparedScope {
  policyVersion: typeof CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION;
  generation: number;
  expectedDatabasePath: string;
  normalizedDatabasePath: string;
  preparedRowCount: number;
  structuralCandidateCount: number;
  invalidCandidateIdCount: number;
  importIds: readonly number[];
  uniqueRequestedCount: number;
  fingerprintInput: string;
  scopeFingerprint: string;
  operationKey: string;
}

export type CorporateActionDividendPreparedScopeBuildResult =
  | {
      status: 'READY';
      scope: CorporateActionDividendPreparedScope;
    }
  | {
      status: 'NO_SCOPE';
      reason: CorporateActionDividendPreparedScopeUnavailableReason;
    };

export function normalizeCorporateActionPreparedScopeDatabasePath(value: string): string {
  const normalized = value.trim().replace(/\//g, '\\');
  if (!normalized) return '';
  if (/^[A-Za-z]:\\$/.test(normalized)) return normalized.toLowerCase();
  return normalized.replace(/\\+$/g, '').toLowerCase();
}

function isCurrentGeneration(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function isStructuralDividendCandidate(row: CorporateActionImportRow): boolean {
  return row.actionType === 'DIVIDEND' && row.parseStatus === 'PARSED' && row.reviewStatus === 'PENDING';
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

async function sha256Hex(value: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('SHA-256 is unavailable for Corporate Action Dividend prepared-scope evidence.');
  }
  const digest = await subtle.digest('SHA-256', new TextEncoder().encode(value));
  return toHex(new Uint8Array(digest));
}

export interface CorporateActionDividendPreparedScopeFingerprint {
  normalizedDatabasePath: string;
  fingerprintInput: string;
  scopeFingerprint: string;
}

export async function computeCorporateActionDividendPreparedScopeFingerprint(
  expectedDatabasePath: string,
  importIds: readonly number[],
): Promise<CorporateActionDividendPreparedScopeFingerprint> {
  const normalizedDatabasePath = normalizeCorporateActionPreparedScopeDatabasePath(expectedDatabasePath);
  const normalizedImportIds = [...importIds].sort((left, right) => left - right);
  const fingerprintInput = [
    CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION,
    normalizedDatabasePath,
    normalizedImportIds.join(','),
  ].join('\n');
  const scopeFingerprint = await sha256Hex(fingerprintInput);
  return { normalizedDatabasePath, fingerprintInput, scopeFingerprint };
}

export async function buildCorporateActionDividendPreparedScope(
  input: BuildCorporateActionDividendPreparedScopeInput,
): Promise<CorporateActionDividendPreparedScopeBuildResult> {
  if (!isCurrentGeneration(input.cycle.generation) || !isCurrentGeneration(input.currentGeneration)) {
    return { status: 'NO_SCOPE', reason: 'INVALID_GENERATION' };
  }
  if (input.cancelled) {
    return { status: 'NO_SCOPE', reason: 'PREPARATION_CANCELLED' };
  }
  if (!input.complete) {
    return { status: 'NO_SCOPE', reason: 'PREPARATION_INCOMPLETE' };
  }
  if (input.cycle.generation !== input.currentGeneration) {
    return { status: 'NO_SCOPE', reason: 'STALE_GENERATION' };
  }

  const expectedDatabasePath = input.cycle.expectedDatabasePath.trim();
  const normalizedDatabasePath = normalizeCorporateActionPreparedScopeDatabasePath(expectedDatabasePath);
  const normalizedCurrentDatabasePath = normalizeCorporateActionPreparedScopeDatabasePath(input.currentDatabasePath);
  if (!normalizedDatabasePath || !normalizedCurrentDatabasePath) {
    return { status: 'NO_SCOPE', reason: 'DATABASE_CONTEXT_MISSING' };
  }
  if (normalizedDatabasePath !== normalizedCurrentDatabasePath) {
    return { status: 'NO_SCOPE', reason: 'DATABASE_CHANGED' };
  }

  const structuralCandidates = input.rows.filter(isStructuralDividendCandidate);
  const validIds = structuralCandidates
    .map((row) => row.id)
    .filter((id) => Number.isSafeInteger(id) && id > 0);
  const importIds = Object.freeze([...new Set(validIds)].sort((left, right) => left - right));
  const fingerprint = await computeCorporateActionDividendPreparedScopeFingerprint(expectedDatabasePath, importIds);
  const fingerprintInput = fingerprint.fingerprintInput;
  const scopeFingerprint = fingerprint.scopeFingerprint;
  const operationKey = `${input.cycle.generation}:${scopeFingerprint}`;

  const scope = Object.freeze({
    policyVersion: CORPORATE_ACTION_DIVIDEND_PREPARED_SCOPE_VERSION,
    generation: input.cycle.generation,
    expectedDatabasePath,
    normalizedDatabasePath,
    preparedRowCount: input.rows.length,
    structuralCandidateCount: structuralCandidates.length,
    invalidCandidateIdCount: structuralCandidates.length - validIds.length,
    importIds,
    uniqueRequestedCount: importIds.length,
    fingerprintInput,
    scopeFingerprint,
    operationKey,
  });

  return { status: 'READY', scope };
}
