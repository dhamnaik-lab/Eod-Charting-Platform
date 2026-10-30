import { describe, expect, it } from 'vitest';
import type { CorporateActionImportRow } from '@/platform';
import { summarizeCaPendingByType, formatCaPendingTypeReport } from '../legacy/corporateActionAllTypeReadinessSummary';
const row = (id: number, actionType: CorporateActionImportRow['actionType'],
  reviewStatus = 'PENDING', approvedCorporateActionId: number | null = null) =>
  ({ id, actionType, reviewStatus, approvedCorporateActionId });

describe('Unified CA pending readiness diagnostic', () => {
  it.each(['oldFaceValue', 'newFaceValue'] as const)('keeps AGM with %s in the blocked review scope', field => {
    const result = summarizeCaPendingByType([{...row(1,'OTHER'),purposeRaw:'AGM',[field]:10}],new Set());
    expect(result.totals).toEqual({pending:1,ready:0,blocked:1,informational:0});
  });
  it('reconciles all six action types without treating unready as approved', () => {
    const inputs = [row(1,'SPLIT'), row(2,'BONUS'), row(3,'DIVIDEND'), row(4,'DIVIDEND'),
      row(5,'RIGHTS'), row(6,'DEMERGER'), row(7,'OTHER')];
    const result = summarizeCaPendingByType(inputs, new Set([1,3,7]));
    expect(result.totals).toEqual({pending:7,ready:3,blocked:4,informational:0});
    expect(result.rows.find(x=>x.actionType==='DIVIDEND')).toEqual({actionType:'DIVIDEND',pending:2,ready:1,blocked:1,informational:0});
    expect(formatCaPendingTypeReport(result)).toContain('TOTAL | 7 | 3 | 4');
  });
  it('deduplicates IDs and excludes already approved from pending', () => {
    const result = summarizeCaPendingByType([row(1,'BONUS'),row(1,'BONUS'),row(2,'SPLIT','APPROVED',4),row(3,'OTHER')],new Set([1,2]));
    expect(result.totals).toEqual({pending:2,ready:1,blocked:1,informational:0});
  });
  it('reports no Ready until the existing gate supplies explicit ready IDs', () => {
    const result = summarizeCaPendingByType([row(5,'RIGHTS'),row(6,'DEMERGER')],new Set());
    expect(result.rows.find(x=>x.actionType==='RIGHTS')?.ready).toBe(0);
    expect(result.totals.blocked).toBe(2);
  });
  it('counts only exact AGM-only notices as informational, even if a stale ready set contains them', () => {
    const inputs = [
      {...row(1,'OTHER'),purposeRaw:'Annual General Meeting'},
      {...row(2,'OTHER'),purposeRaw:'AGM'},
      {...row(3,'OTHER'),purposeRaw:'AGM/Div-Rs.2/- Per Share'},
      {...row(4,'DIVIDEND'),purposeRaw:'Annual General Meeting And Dividend Rs.2/- Per Share'},
      {...row(5,'OTHER'),purposeRaw:'Agm',cashAmount:2},
    ];
    const result = summarizeCaPendingByType(inputs,new Set([1,4]));
    expect(result.totals).toEqual({pending:5,ready:1,blocked:2,informational:2});
    expect(formatCaPendingTypeReport(result)).toContain('TOTAL | 5 | 1 | 2 | 2');
  });
});
