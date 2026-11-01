import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CorporateActionImportRow } from '@/platform';
import { corporateActionSearchRank, normalizeCorporateActionSearch } from '../workspace/corporateActionQuickSearch';
import { CLASSIC_DEFAULT_SORT, classicVisibleEvents, classicVisibleReadyIds, groupClassicActionRows, type ClassicActionRow } from '../workspace/corporateActionClassicModel';
import { CorporateActionClassicWorkspace, type CorporateActionClassicWorkspaceProps } from '../workspace/CorporateActionClassicWorkspace';

function row(id: number, symbol: string, extra: Partial<CorporateActionImportRow> = {}): ClassicActionRow {
  return { record: { id, symbol, exchange: 'NSE', companyName: symbol, actionType: 'DIVIDEND',
    exDate: '2026-10-23', isin: null, bseScripCode: null, ...extra } as CorporateActionImportRow,
    ready: true, category: 'ready', status: 'Ready', terms: 'Rs 7' };
}

describe('Corporate Actions local quick search', () => {
  it('normalizes case and whitespace for all four identity fields', () => {
    const item = row(1, 'ICICIGI', { companyName: 'ICICI Lombard General Insurance',
      isin: 'INE765G01017', bseScripCode: '540716' }).record;
    expect(normalizeCorporateActionSearch('  icici   lombard ')).toBe('ICICI LOMBARD');
    expect(corporateActionSearchRank(item, '  icicigi ')).toBe(0);
    expect(corporateActionSearchRank(item, 'ici')).toBe(1);
    expect(corporateActionSearchRank(item, ' lombard   general ')).toBe(2);
    expect(corporateActionSearchRank(item, 'ine765g01017')).toBe(2);
    expect(corporateActionSearchRank(item, ' 540716 ')).toBe(2);
    expect(corporateActionSearchRank(item, 'absent')).toBeNull();
  });

  it('does not match source URLs, evidence notes, messages or action terms', () => {
    const unrelated = row(1, 'HDBFS', { companyName: 'HDB Financial Services',
      purposeRaw: 'ici', message: 'ici', evidenceSources: ['ICI'],
      latestEvidenceSourceLocator: 'https://official.example/ici', latestEvidenceNote: 'ici' });
    expect(corporateActionSearchRank(unrelated.record, 'ici')).toBeNull();
  });

  it('ranks exact symbols, then prefixes, then broader matches regardless of date direction', () => {
    const events = groupClassicActionRows([row(1, 'XYZ', { companyName: 'ICICI company', exDate: '2026-10-23' }),
      row(2, 'ICICIGI', { exDate: '2026-10-22' }), row(3, 'ICI', { exDate: '2026-10-21' })]);
    expect(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT, 'ici').map(item => item.key)).toEqual([3, 2, 1]);
    expect(classicVisibleEvents(events, 'all', { column: 'date', descending: false }, 'ici').map(item => item.key)).toEqual([3, 2, 1]);
    expect(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT).map(item => item.key)).toEqual([1, 2, 3]);
  });

  it('keeps normal date sorting inside each relevance tier', () => {
    const events = groupClassicActionRows([row(1, 'ICI', { exDate: '2026-10-22' }), row(2, 'ICI')]);
    expect(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT, 'ici').map(item => item.key)).toEqual([2, 1]);
  });

  it('returns no unrelated results and restores the original queue when cleared', () => {
    const events = groupClassicActionRows([row(1, 'ICICIGI'), row(2, 'HDBFS')]);
    expect(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT, 'missing')).toEqual([]);
    expect(classicVisibleReadyIds(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT, 'ici'))).toEqual([1]);
    expect(classicVisibleReadyIds(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT, ' '))).toEqual([2, 1]);
    expect(events).toHaveLength(2);
  });

  it('intersects search with status and does not promote blocked results', () => {
    const blocked = { ...row(1, 'HDBFS'), ready: false, category: 'review' as const, status: 'Needs evidence' };
    const events = groupClassicActionRows([blocked, row(2, 'HDBFS'), row(3, 'OTHER')]);
    expect(classicVisibleEvents(events, 'review', CLASSIC_DEFAULT_SORT, 'hdb').map(item => item.key)).toEqual([1]);
    expect(classicVisibleReadyIds(classicVisibleEvents(events, 'all', CLASSIC_DEFAULT_SORT, 'hdb'))).toEqual([2]);
  });

  it('keeps search results correct when the approved row leaves the queue', () => {
    const rows = [row(1, 'HDBFS'), row(2, 'HDBFS'), row(3, 'OTHER')];
    expect(classicVisibleEvents(groupClassicActionRows(rows.slice(1)), 'all', CLASSIC_DEFAULT_SORT, 'hdb')
      .map(item => item.key)).toEqual([2]);
    expect(classicVisibleEvents(groupClassicActionRows(rows.slice(2)), 'all', CLASSIC_DEFAULT_SORT, 'hdb')).toEqual([]);
  });

  it('defaults the actual Classic pending screen to Ready across symbols with separate Issues access', () => {
    const operation = vi.fn();
    const props: CorporateActionClassicWorkspaceProps = {
      rows: [
        row(1, 'NSE_READY'),
        row(2, 'BSE_READY', { exchange: 'BSE' }),
        { ...row(3, 'WAITING'), ready: false, category: 'waiting', status: 'Waiting for EOD Data' },
      ],
      loadedCount: 3, selectedIds: new Set(), busy: false,
      hasDatabase: true, approved: false, exchange: 'BOTH', fromDate: '', toDate: '',
      types: ['DIVIDEND'], search: '', message: '', canCancel: false,
      onCancel: operation, onFetch: operation, onValidate: operation,
      onViewChange: operation, onExchangeChange: operation, onDateChange: operation,
      onTypesChange: operation, onSearchChange: operation, onCurrentSymbol: operation,
      onToggleMany: operation, onFilterChange: operation, onApprove: operation,
      renderDetails: () => null,
    };
    const pending = renderToStaticMarkup(React.createElement(CorporateActionClassicWorkspace, props));
    expect(pending).toContain('title="NSE:NSE_READY"');
    expect(pending).toContain('title="BSE:BSE_READY"');
    expect(pending).not.toContain('title="NSE:WAITING"');
    expect(pending).toContain('Issues (1)');
    expect(pending).toContain('Shown 2 events');
    expect(pending).toContain('Ready 2 actions');
    const approved = renderToStaticMarkup(React.createElement(CorporateActionClassicWorkspace, {
      ...props, approved: true,
    }));
    expect(approved).toContain('title="NSE:WAITING"');
    expect(operation).not.toHaveBeenCalled();
  });

  it('renders an explicit empty result and accessible clearing without invoking operations', () => {
    const operation = vi.fn();
    const props: CorporateActionClassicWorkspaceProps = {
      rows: [row(1, 'HDBFS')], loadedCount: 1, selectedIds: new Set(), busy: false,
      hasDatabase: true, approved: false, exchange: 'BOTH', fromDate: '', toDate: '', types: ['DIVIDEND'],
      search: 'ici', message: '', canCancel: false, onCancel: operation, onFetch: operation,
      onValidate: operation, onViewChange: operation, onExchangeChange: operation, onDateChange: operation,
      onTypesChange: operation, onSearchChange: operation, onCurrentSymbol: operation, onToggleMany: operation,
      onFilterChange: operation, onApprove: operation, renderDetails: () => null,
    };
    const markup = renderToStaticMarkup(React.createElement(CorporateActionClassicWorkspace, props));
    expect(markup).toContain('aria-label="Table exchange filter"');
    expect(markup).toContain('aria-label="Official fetch exchange scope"');
    expect(markup).toContain('No matching events.');
    expect(markup).not.toMatch(/<td\b[^>]*>HDBFS<\/td>/);
    expect(markup).toContain('aria-label="Clear corporate action search"');
    expect(markup).toContain('spellcheck="false"');
    expect(operation).not.toHaveBeenCalled();
    const cleared = renderToStaticMarkup(React.createElement(CorporateActionClassicWorkspace, { ...props, search: '' }));
    expect(cleared).toMatch(/<td\b[^>]*>HDBFS<\/td>/);
    expect(cleared).not.toContain('aria-label="Clear corporate action search"');
  });
});
