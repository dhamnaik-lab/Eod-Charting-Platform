import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CorporateActionReviewWorkspace } from '../workspace/CorporateActionReviewWorkspace';

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('Corporate Action Task 5D R2 Review parity', () => {
  it('includes raw import ISIN and authoritative event ISIN in normal Review search', () => {
    const source = readProjectFile(
      'src/features/corporateActions/workspace/CorporateActionReviewWorkspace.tsx',
    );

    expect(source).toContain('evidence.importRow.isin');
    expect(source).toContain('evidence.eventIdentity?.eventIsin');
  });

  it('exposes Current chart symbol as a Review search action without adding repair behavior', () => {
    const html = renderToStaticMarkup(
      <CorporateActionReviewWorkspace
        events={[]}
        currentChartSymbol="RELIANCE"
        onContinueToApprove={() => undefined}
      />,
    );
    const source = readProjectFile(
      'src/features/corporateActions/workspace/CorporateActionReviewWorkspace.tsx',
    );
    const css = readProjectFile(
      'src/features/corporateActions/workspace/corporateActionWorkspace.css',
    );

    expect(html).toContain('CURRENT');
    expect(html).toContain('Filter Review to current chart symbol RELIANCE');
    expect(source).toContain("onClick={() => setQuery(currentChartSymbol ?? '')}");
    expect(source).not.toContain('resolveCorporateActionImport');
    expect(css).toContain('.corporate-action-review-current-filter');
  });

  it('wires the active chart instrument into the Review Current action', () => {
    const source = readProjectFile(
      'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx',
    );

    expect(source).toContain('getActiveChartTab');
    expect(source).toContain('state.chartTabs, state.activeChartTabId');
    expect(source).toContain('currentChartSymbol={activeInstrument?.symbol ?? null}');
  });

  it('renders each evidence row status reason in the read-only drawer', () => {
    const source = readProjectFile(
      'src/features/corporateActions/workspace/CorporateActionReviewWorkspace.tsx',
    );

    expect(source).toContain('<dt>Status reason</dt>');
    expect(source).toContain("<dd>{evidence.statusReason ?? '-'}</dd>");
  });
});
