import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APPROVAL_HISTORY_PAGE_SIZE, appendApprovalHistoryPage, describeDividendDispatchFailure, formatApprovalTime } from '../legacy/corporateActionApprovalReports';

describe('approval reports and rollback wording', () => {
  it('pages beyond 200 without a display retention cap', () => {
    const first = appendApprovalHistoryPage(null,Array.from({length:200},(_,id)=>({id})));
    expect(APPROVAL_HISTORY_PAGE_SIZE).toBe(200);
    expect(first.hasMore).toBe(true);
    const next = appendApprovalHistoryPage(first,Array.from({length:200},(_,id)=>({id:id+200})));
    expect(next.rows).toHaveLength(400);
    expect(next.offset).toBe(400);
    expect(next.hasMore).toBe(true);
    expect(first.rows).toHaveLength(200);
  });
  it('deduplicates overlapping pages but advances by fetched count', () => {
    const first = appendApprovalHistoryPage(null,[{id:1},{id:2}]);
    const next = appendApprovalHistoryPage(first,[{id:2},{id:3},{id:3}]);
    expect(next.rows.map(row=>row.id)).toEqual([1,2,3]);
    expect(next.offset).toBe(5);
    expect(next.hasMore).toBe(false);
  });
  it('detects the end on an empty or short page without dropping loaded rows', () => {
    const full = appendApprovalHistoryPage(null,Array.from({length:200},(_,id)=>({id})));
    const end = appendApprovalHistoryPage(full,[]);
    expect(end.rows).toEqual(full.rows);
    expect(end.offset).toBe(200);
    expect(end.hasMore).toBe(false);
    expect(appendApprovalHistoryPage(null,[])).toEqual({rows:[],offset:0,hasMore:false});
  });
  it('distinguishes a confirmed batch rollback from transport uncertainty', () => {
    const message = describeDividendDispatchFailure('CA_DIVIDEND_ROLLBACK_CONFIRMED: import 44 (HEGAM): Missing EOD');
    expect(message).toContain('No approvals from this batch were saved');
    expect(message).toContain('HEGAM');
    expect(message).toContain('Earlier batches may have committed');
    expect(message).not.toContain('uncertain after dispatch');
    expect(describeDividendDispatchFailure('Disconnected')).toContain('uncertain after dispatch');
    expect(describeDividendDispatchFailure('Dividend rollback unconfirmed')).toContain('Do not retry');
  });
  it('does not treat a marker embedded inside another error as confirmation', () => {
    expect(describeDividendDispatchFailure('Transport failed: CA_DIVIDEND_ROLLBACK_CONFIRMED: unknown'))
      .toContain('uncertain after dispatch');
  });
  it('displays UTC SQLite and offset timestamps consistently in IST', () => {
    expect(formatApprovalTime('2026-10-24 14:00:00')).toBe(formatApprovalTime('2026-10-24T19:30:00+05:30'));
    expect(formatApprovalTime('2026-10-24T14:00:00')).toBe(formatApprovalTime('2026-10-24 14:00:00'));
    expect(formatApprovalTime(null)).toBe('Not recorded');
    expect(formatApprovalTime('invalid')).toBe('invalid');
  });
  it('keeps report snapshots separate from readiness and scopes history by database', () => {
    const source = readFileSync('src/components/DatabaseToolsDialogs.tsx', 'utf8');
    expect(source).toContain('?? lastScanReport?.summary');
    expect(source).toContain('Readiness may have changed');
    expect(source).toContain('lastScanReportRef.current?.databasePath === activeDatabasePath');
    expect(source).toContain("reviewStatus:'APPROVED',limit:APPROVAL_HISTORY_PAGE_SIZE,offset:previous?.offset ?? 0");
    expect(source).toContain('recentApprovalRequestRef.current');
    expect(source).toContain('officialPreparationGenerationRef.current === generation');
    expect(source).toContain('rows:previous?.rows ?? []');
    expect(source).toContain('Load more approved actions');
    expect(source).toContain('setOfficialDividendPreparedScopeOutcome(null)');
    expect(source).toContain("setOfficialPreparationComplete(false)");
    const finalizer = source.slice(source.indexOf('const confirmOfficialImportApproval ='), source.indexOf('const approveSelectedOfficialImports ='));
    expect(finalizer).toContain('pendingReviewRef.current = null');
    expect(finalizer).toContain('officialPreparationGenerationRef.current += 1');
  });
  it('wires Exchange and newest-date sorting into the virtual queue', () => {
    const source = readFileSync('src/features/corporateActions/workspace/CorporateActionClassicWorkspace.tsx','utf8');
    expect(source).toContain("['exchange', 'Exchange']");
    expect(source).toContain('<td>{r.exchange}</td>');
    expect(source).toContain('colSpan={columns.length+1}');
    expect(source).toContain('>(CLASSIC_DEFAULT_SORT)');
    expect(source).toContain('setSort(CLASSIC_DEFAULT_SORT)');
    expect(source).toContain('disabled={p.busy||reviewOnly||!event.ready}');
  });
});
