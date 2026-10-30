import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { NseHistoricalIdentityPreviewRow } from '@/types/desktop';
import { filterHistoricalIdentityRows } from '../identity/historicalIdentitySearch';
import { IdentityHistoricalPreview } from '../identity/IdentityHistoricalPreview';

const rename: NseHistoricalIdentityPreviewRow = {
  disposition: 'NEW', changeType: 'SYMBOL_CHANGE', effectiveDate: '2026-07-20',
  oldSymbol: 'AMIRCHAND', newSymbol: 'AEROPLANE', currentSymbol: 'AEROPLANE',
  oldName: 'Amir Chand Jagdish Kumar (Exports) Limited', newName: 'Aeroplane Limited',
  sourceFile: 'saved-symbols.csv', detail: 'Will insert this historical change.',
};
const name: NseHistoricalIdentityPreviewRow = {
  ...rename, disposition: 'DUPLICATE', changeType: 'NAME_CHANGE', oldSymbol: null,
  newSymbol: null, currentSymbol: 'NACLIND', oldName: 'Nagarjuna Agrichem Limited',
  newName: 'NACL Industries Limited', effectiveDate: '2017-09-29',
};
const rows = [rename, name];

describe('Historical identity quick search', () => {
  it('finds either symbol, a partial company name and multiple terms across fields', () => {
    for (const query of ['amirchand', ' aeroplane ', 'jagdish exports', 'AMIRCHAND AEROPLANE 2026-07']) {
      expect(filterHistoricalIdentityRows(rows, query, 'all', 'all')).toEqual([rename]);
    }
    expect(filterHistoricalIdentityRows(rows, 'nagarjuna', 'all', 'all')).toEqual([name]);
  });
  it('restricts fields and intersects the chosen change type', () => {
    expect(filterHistoricalIdentityRows(rows, 'nacl', 'symbols', 'all')).toEqual([name]);
    expect(filterHistoricalIdentityRows(rows, 'nagarjuna', 'symbols', 'all')).toEqual([]);
    expect(filterHistoricalIdentityRows(rows, 'nagarjuna', 'names', 'NAME_CHANGE')).toEqual([name]);
    expect(filterHistoricalIdentityRows(rows, 'nagarjuna', 'names', 'SYMBOL_CHANGE')).toEqual([]);
    expect(filterHistoricalIdentityRows(rows, '2026', 'names', 'all')).toEqual([]);
  });
  it('supports ISO date fragments and day/month/year searches', () => {
    expect(filterHistoricalIdentityRows(rows, '2026-07', 'dates', 'all')).toEqual([rename]);
    expect(filterHistoricalIdentityRows(rows, '20/07/2026', 'dates', 'all')).toEqual([rename]);
  });
  it('keeps null fields safe and preserves the complete input for reviewed Apply', () => {
    const sparse = { ...rename, oldSymbol: null, newSymbol: null, currentSymbol: null, oldName: null, newName: null, effectiveDate: null };
    const before = JSON.stringify(rows);
    expect(filterHistoricalIdentityRows([sparse], 'anything', 'symbols', 'all')).toEqual([]);
    expect(filterHistoricalIdentityRows(rows, '  ', 'all', 'all')).toEqual(rows);
    filterHistoricalIdentityRows(rows, 'not found', 'all', 'all');
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('shows counts for the owner-filtered rows while retaining full-plan effects', () => {
    const html = renderToStaticMarkup(<IdentityHistoricalPreview rows={[rename]} total={2761}
      busy={false} summary="Summary" filters={<button>Actionable</button>} currentEffects={[]} />);
    expect(html).toContain('1 of 2761 historical rows shown');
    expect(html).toContain('aria-label="Search historical identity"');
    expect(html).toContain('aria-label="Historical search scope"');
    expect(html).toContain('aria-label="Historical change type"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Historical identity rows"');
    expect(html).toContain('<thead>');
    expect(html).toContain('Current-universe effects from the full reviewed plan (0 rows)');
    expect(html).not.toContain('>NACLIND<');
  });
});
