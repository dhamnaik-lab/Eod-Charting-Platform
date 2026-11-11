import type { CorporateActionImportRow, CorporateActionScanResultRow, DesktopApi } from '@/platform';
import { readExactCorporateActionImports, reconcilePreparedCorporateActionRows } from './corporateActionImportOperations';
import { buildCorporateActionDividendPreparedScope } from './corporateActionDividendPreparedScope';
import {
  evaluateCorporateActionDividendPreparedScopeBatches,
  type CorporateActionDividendPreparedScopeOutcomeState,
} from './corporateActionDividendPreparedScopeOrchestration';
import { immediateCorporateActionValidationRows } from './corporateActionLater';

const key = (value: string | null | undefined) => value?.trim().toUpperCase() ?? '';

/** Include aliases and exchange peers transitively; never use company-name guesses. */
export function affectedCorporateActionRows(rows: readonly CorporateActionImportRow[], ids: readonly number[]) {
  const affectedIds = new Set(ids);
  const symbols = new Set<string>();
  const isins = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const row of rows) {
      const identitySymbols = [row.symbol, row.verifiedAdjustmentTarget]
        .filter(value => key(value)).map(value => `${key(row.exchange)}:${key(value)}`);
      const isin = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(key(row.isin)) ? key(row.isin) : '';
      if (!affectedIds.has(row.id) && !identitySymbols.some(symbol => symbols.has(symbol)) && !(isin && isins.has(isin))) continue;
      if (!affectedIds.has(row.id)) { affectedIds.add(row.id); changed = true; }
      for (const symbol of identitySymbols) {
        if (!symbols.has(symbol)) { symbols.add(symbol); changed = true; }
      }
      if (isin && !isins.has(isin)) { isins.add(isin); changed = true; }
    }
  }
  return rows.filter(row => affectedIds.has(row.id));
}

type RefreshApi = Pick<DesktopApi,
  'getCorporateActionImportsByIds' | 'runCorporateActionScan' | 'evaluateSimpleCashDividendPreparedScope'>;

/** No queue enumeration, fetching, identity repair, or financial writer. */
export async function refreshCorporateActionQueueAfterApproval(input: {
  api: RefreshApi;
  rows: CorporateActionImportRow[];
  approvedSelection: number[];
  previousOutcome: CorporateActionDividendPreparedScopeOutcomeState | null;
  previousGeneration: number;
  expectedDatabasePath: string;
  shouldContinue: () => boolean;
}) {
  const check = () => {
    if (!input.shouldContinue()) throw new Error('Database or preparation changed during approval refresh.');
  };
  check();
  const affected = affectedCorporateActionRows(input.rows, input.approvedSelection);
  if (!input.approvedSelection.every(id => affected.some(row => row.id === id))) {
    throw new Error('Approval refresh selection is outside the prepared queue.');
  }
  const snapshots = await readExactCorporateActionImports(input.api, affected.map(row => row.id),
    input.expectedDatabasePath, input.shouldContinue);
  // If metadata has changed, expand from the fresh identity too. Fail closed if
  // it would affect rows not included in this bounded read.
  const affectedIds = new Set(affected.map(row => row.id));
  const byId = new Map(snapshots.map(row => [row.id, row]));
  const withSnapshots = input.rows.map(row => byId.get(row.id) ?? row);
  if (affectedCorporateActionRows(withSnapshots, input.approvedSelection).some(row => !affectedIds.has(row.id))) {
    throw new Error('Identity scope changed during approval. Load & Validate before another approval.');
  }
  const rows = reconcilePreparedCorporateActionRows(input.rows, snapshots);
  const remainingAffected = rows.filter(row => affectedIds.has(row.id));
  const previous = input.previousOutcome;
  const hasPreparedDividendScope = Boolean(previous && previous.result.requested > 0);
  const validationIds = (hasPreparedDividendScope ? remainingAffected : immediateCorporateActionValidationRows(remainingAffected)).filter(row =>
    ['SPLIT', 'BONUS', 'RIGHTS'].includes(row.actionType)).map(row => row.id);
  const validationRows: CorporateActionScanResultRow[] = [];
  for (let start = 0; start < validationIds.length; start += 100) {
    check();
    const result = await input.api.runCorporateActionScan({
      scope: 'official_imports', importIds: validationIds.slice(start, start + 100),
    });
    check();
    validationRows.push(...result.results);
  }
  const generation = input.previousGeneration + 1;
  const build = (scopeRows: CorporateActionImportRow[]) => buildCorporateActionDividendPreparedScope({
    rows: scopeRows, cycle: { generation, expectedDatabasePath: input.expectedDatabasePath },
    currentGeneration: generation, currentDatabasePath: input.expectedDatabasePath, complete: true,
  });
  const whole = await build(hasPreparedDividendScope ? rows : immediateCorporateActionValidationRows(rows));
  const targeted = await build(hasPreparedDividendScope ? remainingAffected : immediateCorporateActionValidationRows(remainingAffected));
  check();
  if (whole.status !== 'READY' || targeted.status !== 'READY') throw new Error('Could not rebuild remaining Dividend scope.');
  if (previous && (previous.generation !== input.previousGeneration ||
      previous.databasePath !== input.expectedDatabasePath || !previous.result.complete ||
      previous.result.operationalError || previous.result.failed)) {
    throw new Error('Previous Dividend verification is no longer current.');
  }
  const retained = new Map((previous?.result.dispositions ?? [])
    .filter(item => !affectedIds.has(item.importId)).map(item => [item.importId, item]));
  let checkedBatches = 0;
  if (targeted.scope.importIds.length) {
    const evaluation = await evaluateCorporateActionDividendPreparedScopeBatches({
      api: input.api, scope: targeted.scope,
      getCurrentGeneration: () => input.shouldContinue() ? generation : -1,
      getCurrentDatabasePath: () => input.shouldContinue() ? input.expectedDatabasePath : null,
      isCancelled: () => !input.shouldContinue(),
    });
    check();
    if (evaluation.status !== 'OUTCOME' || !evaluation.outcome.result.complete ||
        evaluation.outcome.result.operationalError || evaluation.outcome.result.failed) {
      throw new Error('Affected Dividend verification did not complete. Load & Validate before another approval.');
    }
    checkedBatches = evaluation.outcome.result.completedBatchCount;
    for (const item of evaluation.outcome.result.dispositions) retained.set(item.importId, item);
  }
  const dispositions = whole.scope.importIds.map(id => {
    const item = retained.get(id);
    if (!item) throw new Error('Remaining Dividend evidence is incomplete. Load & Validate again.');
    return item;
  });
  const count = (code: typeof dispositions[number]['disposition']) => dispositions.filter(item => item.disposition === code).length;
  const outcome: CorporateActionDividendPreparedScopeOutcomeState = {
    databasePath: input.expectedDatabasePath, generation,
    operationKey: whole.scope.operationKey, wholeScopeFingerprint: whole.scope.scopeFingerprint,
    result: {
      requested: dispositions.length, eligible: count('ELIGIBLE'), ineligible: count('INELIGIBLE'),
      alreadyApproved: count('ALREADY_APPROVED'), staleScope: count('STALE_SCOPE'), missing: count('MISSING'),
      failed: 0, dispositions, batchCount: checkedBatches, completedBatchCount: checkedBatches,
      complete: true, operationalError: null,
      policyVersion: 'AUTO_APPROVAL_SIMPLE_CASH_DIVIDEND_R1', scopeVersion: whole.scope.policyVersion,
    },
  };
  check();
  return { rows, scope: whole.scope, outcome, validationRows, validationIds, affectedCount: affected.length };
}
