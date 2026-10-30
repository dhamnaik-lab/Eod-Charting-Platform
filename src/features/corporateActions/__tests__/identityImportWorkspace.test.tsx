import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { OfficialSourceHealthReport, OfficialSourceHealthResult } from '@/platform';
import { identityHealthSummary, identityPreviewState, identityStatusText, parseIdentityDiagnostic } from '../identity/identityImportModel';
import { IdentityImportWorkspace } from '../identity/IdentityImportWorkspace';
import { IdentitySourceHealth } from '../identity/IdentitySourceHealth';
import { IdentityPreviewTable } from '../identity/IdentityPreviewTable';

const healthy: OfficialSourceHealthResult = {
  sourceId: 'NSE_EQUITY_MASTER', exchange: 'NSE', role: 'Equity master', requestUrl: 'https://example.invalid/equity.csv',
  finalUrl: null, provenanceStatus: 'PASS', transportStatus: 'PASS', httpStatus: 200, contentBytes: 12,
  contentSha256: 'hash', formatStatus: 'PASS', populationStatus: 'PASS', populationCount: 2618,
  freshnessStatus: 'NOT_APPLICABLE', driftClass: 'COMPATIBLE', reason: 'Parser passed',
};
const failed: OfficialSourceHealthResult = { ...healthy, sourceId: 'NSE_COMPANY_NAME_CHANGE', role: 'Company-name changes',
  formatStatus: 'FAIL', populationCount: null, reason: 'Missing old company name column in source; CSV headers: SYMBOL,OLD NAME OF THE COMPANY',
  diagnostic: JSON.stringify({ csvHeaders: ['SYMBOL', 'OLD NAME OF THE COMPANY'], reason: 'missing column', retainedDiagnosticPath: 'private-capture-path' }),
};
const report: OfficialSourceHealthReport = { assessedAtUtc: '2026-10-28T15:42:45Z', results: [healthy, failed,
  { ...healthy, sourceId: 'BSE_ACTIVE', exchange: 'BSE', transportStatus: 'FAIL', httpStatus: 403 }] };

describe('Identity Import presentation contracts', () => {
  it('separates selected-exchange results and unknown health state', () => {
    expect(identityHealthSummary(null, 'NSE').checked).toBe(false);
    expect(identityHealthSummary(report, 'NSE')).toMatchObject({ checked: true, attention: 1 });
    expect(identityHealthSummary(report, 'NSE').results).toHaveLength(2);
    expect(identityHealthSummary(report, 'BSE').results).toHaveLength(1);
    expect(report.results).toHaveLength(3);
  });
  it('distinguishes unloaded, loaded empty, filtered empty and busy previews', () => {
    expect(identityPreviewState(false, 0, 0, false)).toBe('Not previewed');
    expect(identityPreviewState(true, 0, 0, false)).toContain('No changes');
    expect(identityPreviewState(true, 10, 0, false)).toContain('No filter matches');
    expect(identityPreviewState(true, 10, 3, false)).toContain('3 of 10');
    expect(identityPreviewState(true, 10, 3, true)).toBe('Operation in progress');
  });
  it('explains column failures and handles invalid or absent JSON', () => {
    expect(identityStatusText(failed.reason)).toContain('column names are not recognized');
    expect(identityStatusText(JSON.stringify({ reason: failed.reason }))).toContain('saved sources were not replaced');
    expect(identityStatusText('Required identity file was not found')).toBe('Required identity file was not found');
    for (const text of ['not JSON', '[]', 'null']) expect(parseIdentityDiagnostic(text)).toBeNull();
  });
  it('keeps raw JSON and other-exchange failures out of the compact source list', () => {
    const html = renderToStaticMarkup(<IdentitySourceHealth report={report} exchange="NSE" busy={false} canRecover={() => true} onRecover={() => {}} />);
    expect(html).toContain('Company-name changes');
    expect(html).toContain('Needs attention');
    expect(html).toContain('Details for Company-name changes');
    expect(html).not.toContain('private-capture-path');
    expect(html).not.toContain('HTTP 403');
    expect(html).not.toContain('<pre');
  });
  it('starts in current preview and preserves owner-supplied disabled Apply', () => {
    const html = renderToStaticMarkup(<IdentityImportWorkspace databasePath="Sample DB" busy={false} header={<span>NSE</span>}
      sourceControls={null} summary="Source health not checked" status="" current={<p>Preview table</p>}
      currentToolbar={<button>Preview Saved Sources</button>} currentFooter={<button disabled>Apply Reviewed Changes</button>}
      historical={<p>Historical rows</p>} diagnostics={<p>Raw maintenance details</p>} />);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Preview table');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('Raw maintenance details');
    expect(html).not.toContain('Historical rows');
  });
  it('never describes a filter miss as an unloaded preview', () => {
    const html = renderToStaticMarkup(<IdentityPreviewTable rows={[]} loaded total={3} busy={false} />);
    expect(html).toContain('No identity changes match this filter');
    expect(html).not.toContain('Not previewed');
  });
  it('gives manual-source instructions without offering an official refresh', () => {
    const html = renderToStaticMarkup(<IdentityPreviewTable rows={[]} loaded={false} total={0} busy={false} sourceMode="manual" />);
    expect(html).toContain('Select a manual source and choose Preview Changes');
    expect(html).not.toContain('Refresh &amp; Preview');
  });
});
