import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { NseCurrentUniverseSyncResult, BseCurrentUniverseSyncResult } from '@/types/desktop';
import { IdentityApplyStatus } from '../identity/IdentityApplyStatus';
import { IdentityApplyHistory } from '../identity/IdentityApplyHistory';
import { IdentityPreviewTable, type IdentityPreviewRow } from '../identity/IdentityPreviewTable';
import { identityPreviewState, identityCurrentConfirmation } from '../identity/identityImportModel';

const result = { applied: true, activateCount: 30, newSymbols: 7, updateCount: 261, deactivateCount: 0,
  completedAt: '2026-10-29T03:24:00Z', runId: 'run-1', previewRows: [] } as unknown as NseCurrentUniverseSyncResult;
const rows: IdentityPreviewRow[] = ['INSERT', 'REACTIVATE', 'UPDATE', 'DEACTIVATE', 'OLD_SYMBOL', 'DELISTED', 'REVIEW_REQUIRED', 'OUTSIDE_COVERAGE'].map((action, i) => ({
  source: 'NSE', action, symbol: `SYMBOL${i}`, companyName: null, isin: null, series: 'EQ',
  currentStatus: 'ACTIVE', proposedStatus: 'ACTIVE', matchValue: null, reason: 'Original review evidence',
}));

describe('Identity apply reporting', () => {
  it('uses the same full-plan confirmation for both exchanges', () => {
    for (const exchange of ['NSE','BSE'] as const) {
      const message = identityCurrentConfirmation(result,exchange,'Destination database');
      expect(message).toContain(`Apply reviewed ${exchange}`); expect(message).toContain('Database: Destination database');
      expect(message).toContain('search filters do not limit Apply'); expect(message).toContain('Cancel');
    }
  });
  it('renders BSE receipt codes, IST and source evidence without NSE identity substitution', () => {
    const bse = { ...result, masterFilePath:'master.csv',masterSha256:'source-hash',planSha256:'reviewed-hash',
      previewRows:[{action:'SUSPENDED',symbol:'OFFICIAL_ID',securityCode:'500001',companyName:'Company',isin:null,series:'A',currentStatus:'ACTIVE',proposedStatus:'SUSPENDED',reason:'Official BSE status'}],
    } as unknown as BseCurrentUniverseSyncResult;
    const html=renderToStaticMarkup(<IdentityApplyHistory load={async()=>[]} latest={bse} exchange="BSE" standalone />);
    expect(html).toContain('BSE Current universe apply history'); expect(html).toContain('500001');
    expect(html).toContain('OFFICIAL_ID'); expect(html).toContain('IST'); expect(html).toContain('source-hash');
    expect(html).toContain('Saved successfully'); expect(html).not.toContain('Apply Reviewed Changes');
  });
  it('keeps a committed result visible if the final reply is lost', () => {
    const html=renderToStaticMarkup(<IdentityApplyStatus progress={{stage:'committed',processed:10,total:10,percent:100}} result={null} error="Reply lost" refreshWarning={null} />);
    expect(html).toContain('is-complete'); expect(html).toContain('report retrieval needs retry'); expect(html).not.toContain('Apply failed');
  });
  it('shows indeterminate checks, counted work, and no completed claim before commit', () => {
    const checking = renderToStaticMarkup(<IdentityApplyStatus progress={{ stage: 'checking', processed: 0, total: 0, percent: null }} result={null} error={null} refreshWarning={null} />);
    expect(checking).toContain('Rechecking reviewed plan');
    expect(checking).not.toContain('value=');
    expect(checking).not.toContain('100%');
    const working = renderToStaticMarkup(<IdentityApplyStatus progress={{ stage: 'applying', processed: 25, total: 100, percent: 25 }} result={null} error={null} refreshWarning={null} />);
    expect(working).toContain('25%'); expect(working).toContain('25 / 100');
    expect(working).toContain('Awaiting commit'); expect(working).not.toContain('Completed');
  });
  it('reports committed totals and preserves success when screen refresh fails', () => {
    const html = renderToStaticMarkup(<IdentityApplyStatus progress={null} result={result} error={null} refreshWarning="Refresh failed" />);
    expect(html).toContain('Completed'); expect(html).toContain('100%');
    expect(html).toContain('291'); expect(html).toContain('23');
    expect(html).toContain('Changes saved. View refresh needs retry');
    expect(identityPreviewState(true, 1343, 1343, false, true)).toContain('Completed');
    expect(identityPreviewState(true, 1343, 1343, false, true)).not.toContain('Preview');
  });
  it('does not show success progress for an apply error', () => {
    const html = renderToStaticMarkup(<IdentityApplyStatus progress={null} result={null} error="Plan changed" refreshWarning={null} />);
    expect(html).toContain('Not completed'); expect(html).not.toContain('<progress'); expect(html).not.toContain('100%');
  });
  it('separates applied records from held and uncovered outcomes', () => {
    const html = renderToStaticMarkup(<IdentityPreviewTable rows={rows} loaded total={8} busy={false} applied />);
    expect(html).toContain('Applied result filters'); expect(html).toContain('All outcomes');
    expect(html).toContain('Held for review'); expect(html).toContain('Outside coverage');
    expect(html).toContain('Before'); expect(html).toContain('After'); expect(html).not.toContain('<th>Proposed</th>');
    expect(html.match(/Saved successfully/g)).toHaveLength(6);
  });
  it('loads history only on request and never presents an apply button', () => {
    const load = vi.fn();
    const html = renderToStaticMarkup(<IdentityApplyHistory load={load} latest={null} />);
    expect(load).not.toHaveBeenCalled(); expect(html).toContain('Load / Refresh Apply History');
    expect(html).not.toContain('Apply Reviewed Changes');
  });
});
