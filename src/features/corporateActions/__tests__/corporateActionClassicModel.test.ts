import { describe, expect, it } from 'vitest';
import type { CorporateActionImportRow } from '@/platform';
import { CLASSIC_DEFAULT_SORT, classicIdentityLabel, classicVisibleEvents, classicVisibleReadyIds, groupClassicActionRows, type ClassicActionRow } from '../workspace/corporateActionClassicModel';

const row = (id: number, actionType = 'DIVIDEND', overrides: Partial<CorporateActionImportRow> = {}): ClassicActionRow => ({
  record: { id, actionType, exchange: 'NSE', symbol: 'ABC', isin: 'INE000000001', exDate: '2026-10-01',
    recordDate: null, source: 'NSE_API', sourceFile: null, purposeRaw: 'Bonus 1:1 and stock split 10 to 2',
    evidenceCount: 1, parseStatus: 'PARSED', ...overrides } as CorporateActionImportRow,
  ready: true, category: 'ready', status: 'Ready', terms: actionType,
});

describe('classic CA presentation and exact approval scope', () => {
  it('filters exchanges locally while preserving the queue and visible approval scope', () => {
    const events = groupClassicActionRows([row(1),row(2,'DIVIDEND',{exchange:'BSE'}),
      {...row(3),ready:false,category:'waiting',status:'Waiting for EOD'}]);
    const nse = classicVisibleEvents(events,'all',CLASSIC_DEFAULT_SORT,'','NSE');
    const bse = classicVisibleEvents(events,'all',CLASSIC_DEFAULT_SORT,'','BSE');
    expect(nse.map(event=>event.key).sort()).toEqual([1,3]);
    expect(classicVisibleReadyIds(nse)).toEqual([1]);
    expect(classicVisibleReadyIds(bse)).toEqual([2]);
    expect(classicVisibleEvents(events,'waiting',CLASSIC_DEFAULT_SORT,'ABC','BSE')).toEqual([]);
    expect(classicVisibleEvents(events,'all',CLASSIC_DEFAULT_SORT,'absent','NSE')).toEqual([]);
    expect(classicVisibleEvents(events,'all',CLASSIC_DEFAULT_SORT,'','all')).toHaveLength(3);
    expect(events.map(event=>event.key)).toEqual([1,2,3]);
  });
  it('shows all-symbol Ready actions and routes genuine blockers to Issues without changing approval eligibility', () => {
    const events = groupClassicActionRows([
      row(1, 'DIVIDEND', { symbol: 'NSE_READY', exchange: 'NSE' }),
      row(2, 'SPLIT', { symbol: 'BSE_READY', exchange: 'BSE', purposeRaw: 'Split face value 10 to 5' }),
      { ...row(3, 'RIGHTS', { symbol: 'EOD_MISSING' }), ready: false, category: 'waiting', status: 'Waiting for EOD Data' },
      { ...row(4, 'DIVIDEND', { symbol: 'TERMS_MISSING' }), ready: false, category: 'review', status: 'Awaiting verified announcement terms' },
      { ...row(5, 'SPLIT', { symbol: 'CHECKING', purposeRaw: 'Split face value 10 to 5' }), ready: false, category: 'checking', status: 'Could not check' },
      { ...row(6, 'OTHER', { symbol: 'INFORMATIONAL' }), ready: false, category: 'informational', status: 'Informational' },
      { ...row(7, 'DIVIDEND', { symbol: 'PROCESSED' }), ready: false, category: 'processed', status: 'Already Processed' },
    ]);
    const ready = classicVisibleEvents(events, 'ready', CLASSIC_DEFAULT_SORT);
    const issues = classicVisibleEvents(events, 'issues', CLASSIC_DEFAULT_SORT);
    expect(ready.map(event => event.key).sort()).toEqual([1, 2]);
    expect(classicVisibleReadyIds(ready).sort()).toEqual([1, 2]);
    expect(issues.map(event => event.key).sort()).toEqual([3, 4, 5]);
    expect(classicVisibleReadyIds(issues)).toEqual([]);
    expect(classicVisibleEvents(events, 'issues', CLASSIC_DEFAULT_SORT, '', 'BSE')).toEqual([]);
    expect(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT)).toHaveLength(7);
    expect(events).toHaveLength(7);
  });
  it('defaults to newest ISO ex-date first, with undated events last', () => {
    const events = groupClassicActionRows([
      row(1,'DIVIDEND',{exDate:'2026-01-31'}),row(2,'DIVIDEND',{exDate:'2025-12-30'}),
      row(3,'DIVIDEND',{exDate:'2026-10-01'}),row(4,'DIVIDEND',{exDate:null}),
    ]);
    expect(CLASSIC_DEFAULT_SORT).toEqual({column:'date',descending:true});
    expect(classicVisibleEvents(events,'all',CLASSIC_DEFAULT_SORT).map(event=>event.key)).toEqual([3,1,2,4]);
    expect(events.map(event=>event.key)).toEqual([1,2,3,4]);
  });
  it('sorts the true exchange without merging same-symbol events across exchanges', () => {
    const events = groupClassicActionRows([row(1),row(2,'DIVIDEND',{exchange:'BSE'})]);
    expect(classicVisibleEvents(events,'all',{column:'exchange',descending:false}).map(event=>event.rows[0].record.exchange)).toEqual(['BSE','NSE']);
    expect(classicVisibleEvents(events,'all',{column:'exchange',descending:true}).map(event=>event.key)).toEqual([1,2]);
    expect(classicVisibleReadyIds(events)).toEqual([1,2]);
  });
  it('shows retained BSE codes without pretending the row is matched', () => {
    const unmatched = row(1, 'DIVIDEND', { exchange: 'BSE', symbol: null, isin: null, bseScripCode: '544131' });
    expect(classicIdentityLabel(unmatched.record)).toBe('BSE 544131 (unmatched)');
    expect(classicIdentityLabel(row(2).record)).toBe('ABC');
    expect(classicIdentityLabel(row(3, 'DIVIDEND', { symbol: null }).record)).toBe('INE000000001');
    expect(classicIdentityLabel(row(4, 'DIVIDEND', { symbol: null, isin: null }).record)).toBe('Unmatched');
    expect(classicVisibleReadyIds(groupClassicActionRows([{ ...unmatched, ready: false, category: 'waiting' }]))).toEqual([]);
  });
  it('keeps already processed dividends visible and outside approval scope', () => {
    const events = groupClassicActionRows([{ ...row(1), ready: false, category: 'processed', status: 'Already Processed' }, row(2)]);
    const processed = classicVisibleEvents(events, 'processed', { column: 'date', descending: false });
    expect(processed.map(event => event.key)).toEqual([1]);
    expect(classicVisibleReadyIds(processed)).toEqual([]);
    expect(classicVisibleReadyIds(events)).toEqual([2]);
  });
  it('combines an exact Split/Bonus announcement without dropping either approval ID', () => {
    const events = groupClassicActionRows([row(1, 'SPLIT'), row(2, 'BONUS'), row(1, 'SPLIT')]);
    expect(events).toHaveLength(1);
    expect(events[0].action).toBe('Split + Bonus');
    expect(classicVisibleReadyIds(events)).toEqual([1, 2]);
  });
  it.each([
    { isin: 'INE000000002' }, { source: 'BSE_API' }, { exDate: '2026-10-02' },
    { evidenceCount: 0 }, { parseStatus: 'UNPARSED' }, { purposeRaw: 'Bonus 1:1' },
  ] as Partial<CorporateActionImportRow>[])('keeps unproven or different announcements separate: %j', overrides => {
    expect(groupClassicActionRows([row(1, 'SPLIT'), row(2, 'BONUS', overrides)])).toHaveLength(2);
  });
  it('does not merge ambiguous repeated components', () => {
    expect(groupClassicActionRows([row(1, 'SPLIT'), row(2, 'BONUS'), row(3, 'BONUS')])).toHaveLength(3);
  });
  it('never promotes a partly blocked compound event to Ready', () => {
    const events = groupClassicActionRows([row(1, 'SPLIT'), { ...row(2, 'BONUS'), ready: false, category: 'waiting', status: 'Waiting for EOD' }]);
    expect(events[0].status).toBe('Waiting for EOD');
    expect(classicVisibleReadyIds(events)).toEqual([]);
  });
  it('keeps hidden and blocked IDs outside the visible approval scope', () => {
    const events = groupClassicActionRows([row(1), { ...row(2), ready: false, category: 'review' }, row(3)]);
    const filtered = classicVisibleEvents(events, 'review', { column: 'date', descending: false });
    expect(filtered.map(event => event.key)).toEqual([2]);
    expect(classicVisibleReadyIds(filtered)).toEqual([]);
    expect(classicVisibleReadyIds(classicVisibleEvents(events, 'ready', { column: 'date', descending: false }))).toEqual([1, 3]);
    expect(events.map(event => event.key)).toEqual([1, 2, 3]);
  });
});
