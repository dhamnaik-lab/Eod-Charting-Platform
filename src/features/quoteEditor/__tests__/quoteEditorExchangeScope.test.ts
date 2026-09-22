import { describe, expect, it } from 'vitest';

import {
  QUOTE_EDITOR_EXCHANGE_OPTIONS,
  buildAllExchangeDeleteConfirmation,
  normalizeQuoteEditorExchangeScope,
  resolveQuoteEditorWriteExchange,
} from '../quoteEditorExchangeScope';

describe('Quote Editor exchange scope', () => {
  it('exposes the bounded exchange filter with ALL as the first/default option', () => {
    expect(QUOTE_EDITOR_EXCHANGE_OPTIONS).toEqual([
      { value: 'ALL', label: 'ALL' },
      { value: 'NSE', label: 'NSE' },
      { value: 'NSE_INDEX', label: 'NSE-INDEX' },
      { value: 'BSE', label: 'BSE' },
      { value: 'BSE_INDEX', label: 'BSE-INDEX' },
      { value: 'MCX', label: 'MCX' },
    ]);
  });

  it('normalizes display aliases without inventing an exchange', () => {
    expect(normalizeQuoteEditorExchangeScope('all')).toBe('ALL');
    expect(normalizeQuoteEditorExchangeScope('NSE-INDEX')).toBe('NSE_INDEX');
    expect(normalizeQuoteEditorExchangeScope('bse_index')).toBe('BSE_INDEX');
    expect(normalizeQuoteEditorExchangeScope('MCX')).toBe('MCX');
  });

  it('requires a concrete row exchange before writing while the filter is ALL', () => {
    expect(resolveQuoteEditorWriteExchange('ALL', null)).toBeNull();
    expect(resolveQuoteEditorWriteExchange('ALL', 'BSE_INDEX')).toBe('BSE_INDEX');
    expect(resolveQuoteEditorWriteExchange('NSE', null)).toBe('NSE');
  });

  it('builds an explicit broad-delete confirmation for ALL exchanges', () => {
    const message = buildAllExchangeDeleteConfirmation('2026-08-20', '2026-08-20');
    expect(message).toContain('ALL exchanges');
    expect(message).toContain('NSE');
    expect(message).toContain('NSE-INDEX');
    expect(message).toContain('BSE');
    expect(message).toContain('BSE-INDEX');
    expect(message).toContain('MCX');
    expect(message).toContain('2026-08-20');
  });

  it('keeps every Quote Editor table cell inside its grid column', async () => {
    const scopeModule = (await import('../quoteEditorExchangeScope')) as unknown as Record<string, unknown>;
    const style = scopeModule.QUOTE_EDITOR_TABLE_CELL_STYLE;

    expect(style).toMatchObject({
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  });

  it('summarizes ALL loads per bounded exchange and keeps missing exchanges at zero', async () => {
    const scopeModule = (await import('../quoteEditorExchangeScope')) as unknown as Record<string, unknown>;
    const summarize = scopeModule.summarizeQuoteEditorRowsByExchange;
    const format = scopeModule.formatQuoteEditorAllLoadSummary;

    expect(typeof summarize).toBe('function');
    expect(typeof format).toBe('function');

    const counts = (summarize as (rows: ReadonlyArray<{ exchange: string }>) => Record<string, number>)([
      { exchange: 'BSE' },
      { exchange: 'NSE' },
      { exchange: 'BSE_INDEX' },
      { exchange: 'NSE-INDEX' },
      { exchange: 'BSE' },
      { exchange: 'UNKNOWN' },
    ]);

    expect(counts).toEqual({
      NSE: 1,
      NSE_INDEX: 1,
      BSE: 2,
      BSE_INDEX: 1,
      MCX: 0,
    });
    expect(
      (format as (date: string, total: number, counts: Record<string, number>) => string)(
        '2026-08-20',
        5,
        counts,
      ),
    ).toBe('Loaded 5 quotes for 2026-08-20. NSE=1; NSE-INDEX=1; BSE=2; BSE-INDEX=1; MCX=0.');
  });

});
