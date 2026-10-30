import type { NseHistoricalIdentityResult } from '@/types/desktop';
export function historicalChangeCount(result: NseHistoricalIdentityResult | null) {
  return result ? result.newSymbolChanges + result.newNameChanges + result.newCombinedChanges
    + result.activeSyncActivateCount + result.activeSyncUpdateCount + result.activeSyncDeactivateCount : 0;
}
export function historicalConfirmation(result: NseHistoricalIdentityResult, database: string) {
  return `Apply the FULL reviewed NSE historical identity plan?\n\nDatabase: ${database}\n`
    + `${result.newSymbolChanges} symbol changes, ${result.newNameChanges} name changes, ${result.newCombinedChanges} combined changes.\n`
    + `Current-universe effects: ${result.activeSyncActivateCount} activate, ${result.activeSyncUpdateCount} update, ${result.activeSyncDeactivateCount} deactivate.\n\n`
    + `Search/category filters do not limit Apply. Raw prices and financial approvals are not changed.\n\nContinue and save these changes?`;
}
