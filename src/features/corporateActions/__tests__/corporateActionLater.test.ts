import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { CorporateActionImportRow } from '@/platform';
import { deferredCorporateActionReason, isLaterCorporateAction, immediateCorporateActionValidationRows } from '../legacy/corporateActionLater';
import { summarizeCaPendingByType } from '../legacy/corporateActionAllTypeReadinessSummary';
import { buildCorporateActionDividendPreparedScope } from '../legacy/corporateActionDividendPreparedScope';

const row = (actionType: CorporateActionImportRow['actionType'], purposeRaw = '', extra: Partial<CorporateActionImportRow> = {}) =>
  ({ id: 1, actionType, purposeRaw, reviewStatus: 'PENDING', parseStatus: 'PARSED', approvedCorporateActionId: null, ...extra } as CorporateActionImportRow);

describe('Later is display/readiness only', () => {
  it('defers the named share distribution with its own reason and no approval readiness', () => {
    const purpose = 'For Distribution Of Chennai Super Kings Cricket Limited Shares To The Shareholders Of India Cements';
    const input = row('OTHER', purpose, { message: 'Unsupported official purpose' });
    const before = JSON.stringify(input);
    expect(isLaterCorporateAction(input)).toBe(true);
    expect(deferredCorporateActionReason(input)).toBe('Share distribution (demerger-like): rules not built yet');
    expect(summarizeCaPendingByType([input], new Set([input.id])).totals).toEqual({ pending: 1, ready: 0, blocked: 0, informational: 0, later: 1 });
    expect(JSON.stringify(input)).toBe(before);
    expect(isLaterCorporateAction(row('OTHER', 'For Distribution Of Chennai Super Kings Cricket Limited Tickets'))).toBe(false);
  });

  it('defers Deb/Debs including glued ratios, with factual reasons and no word-prefix matches', () => {
    for (const purpose of ['Sch Of Agmt- Bonus Deb1:1', 'Bonus Debs1:1', 'Bonus Deb 1:1',
      'Bonus Debs 1:1', 'Split Deb1:2', 'Bonus debs1:2']) {
      const input = row(purpose.startsWith('Split') ? 'SPLIT' : 'BONUS', purpose);
      const before = JSON.stringify(input);
      expect(isLaterCorporateAction(input), purpose).toBe(true);
      expect(deferredCorporateActionReason(input), purpose).toBe('Non-equity terms (debenture/preference/DVR)');
      expect(immediateCorporateActionValidationRows([input]), purpose).toEqual([]);
      expect(JSON.stringify(input)).toBe(before);
    }
    for (const word of ['Debt', 'Debit', 'Debut', 'Debtors', 'Indebted', 'Deb1Dvr']) {
      const input = row('BONUS', `Bonus ${word} 1:1`);
      expect(isLaterCorporateAction(input), word).toBe(false);
      expect(deferredCorporateActionReason(input), word).toBe('Requires review');
      expect(immediateCorporateActionValidationRows([input]), word).toEqual([input]);
    }
  });

  it('shows factual reasons and preserves recorded evidence blockers', () => {
    expect(deferredCorporateActionReason(row('DIVIDEND'))).toContain('verification deferred');
    expect(deferredCorporateActionReason(row('DIVIDEND'), 'Awaiting official source evidence')).toBe('Awaiting official source evidence');
    expect(deferredCorporateActionReason(row('RIGHTS'))).toContain('adjustment rules');
    expect(deferredCorporateActionReason(row('DEMERGER'))).toContain('cost split');
    expect(deferredCorporateActionReason(row('BONUS', '', {instrumentIsActive:false}))).toBe('Delisted or inactive symbol');
    const interest = row('OTHER', 'Interest - Rs 0.60 Per Unit');
    expect(isLaterCorporateAction(interest)).toBe(true);
    expect(deferredCorporateActionReason(interest)).toContain('InvIT/REIT distribution');
    expect(isLaterCorporateAction(row('OTHER', 'Interest payment'))).toBe(false);
  });
  it.each(['DIVIDEND', 'RIGHTS', 'DEMERGER'] as const)('defers %s even when a stale ready set contains its ID', actionType => {
    const input = row(actionType);
    const before = JSON.stringify(input);
    expect(isLaterCorporateAction(input)).toBe(true);
    expect(summarizeCaPendingByType([input, input], new Set([1])).totals).toEqual({ pending: 1, ready: 0, blocked: 0, informational: 0, later: 1 });
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each(['Capital Reduction', 'Reduction of Capital', 'Reduction of Share Capital', 'Reduction of Equity Capital',
    'Income Distribution (InvIT)', 'Distribution of Income (REIT)', 'Distribution Rs 5 Per Unit'])('defers the exact unsupported wording %s', purpose => {
    expect(isLaterCorporateAction(row('OTHER', purpose))).toBe(true);
  });
  it.each(['Bonus Debentures 6:1', 'Bonus Preference Shares 1:1', 'Bonus NCRPS 4:1', 'Bonus DVR 1:20',
    'Split CCPS 10 to 1', 'Split OCPS 10 to 1', 'Bonus CRPS 1:1', 'Bonus Preferred Shares 1:1', 'Bonus Differential Voting 1:10'])('defers non-equity terms %s', purpose => {
    expect(isLaterCorporateAction(row('BONUS', purpose))).toBe(true);
  });
  it('uses explicit exact-instrument inactivity, leaving missing identity and BSE numeric codes in Issues', () => {
    expect(isLaterCorporateAction(row('SPLIT', 'Split 10 to 1', { instrumentIsActive: false }))).toBe(true);
    for (const input of [row('SPLIT', 'Split 10 to 1'), row('BONUS', 'Bonus 1:1', { instrumentIsActive: true }),
      row('BONUS', 'Bonus 1:1', { instrumentIsActive: null }), row('SPLIT', 'Split 10 to 1', { exchange: 'BSE', symbol: '500143' }),
      row('OTHER', 'Resolution Plan -Suspension'), row('OTHER', 'AGM'), row('OTHER', 'Income Distributionary'), row('OTHER', 'Capital Reductionary')]) {
      expect(isLaterCorporateAction(input)).toBe(false);
    }
  });
  it('retains approved and closed categories', () => {
    expect(isLaterCorporateAction(row('DIVIDEND', '', { reviewStatus: 'APPROVED' }))).toBe(false);
    expect(isLaterCorporateAction(row('RIGHTS', '', { approvedCorporateActionId: 9 }))).toBe(false);
    expect(isLaterCorporateAction(row('OTHER', 'AGM', { reviewStatus: 'CLOSED_INFORMATIONAL', instrumentIsActive: false }))).toBe(false);
  });
  it('defers automatic R1 without changing manual prepared-scope admission or mutating the queue', async () => {
    const dividend = row('DIVIDEND', 'Dividend Rs 2 Per Share');
    const split = row('SPLIT', 'Split 10 to 1', { id: 2 });
    const rows = [dividend, split];
    const current = { cycle: { generation: 1, expectedDatabasePath: 'fixture' }, currentGeneration: 1, currentDatabasePath: 'fixture', complete: true };
    const automatic = await buildCorporateActionDividendPreparedScope({ ...current, rows: immediateCorporateActionValidationRows(rows) });
    const manual = await buildCorporateActionDividendPreparedScope({ ...current, rows });
    expect(automatic.status).toBe('READY');
    expect(automatic.status === 'READY' && automatic.scope.importIds).toEqual([]);
    expect(manual.status === 'READY' && manual.scope.importIds).toEqual([1]);
    expect(rows).toEqual([dividend, split]);
    const ui = readFileSync('src/components/DatabaseToolsDialogs.tsx', 'utf8');
    expect(ui).toContain('rows: immediateCorporateActionValidationRows(result.rows)');
    expect(ui).toContain('deferredCorporateActionReason(row, label)' );
    expect(ui).toContain('<th>Deferred</th>');
    const workspace = readFileSync('src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx', 'utf8');
    expect(workspace).toContain('<option value="later">Deferred types ({laterCount})</option>');
  });
});
