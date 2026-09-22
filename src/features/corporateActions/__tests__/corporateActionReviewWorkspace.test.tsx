import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CorporateActionNormalReviewEvent } from '../workflow/corporateActionNormalWorkflowAdapter';
import { CorporateActionReviewWorkspace } from '../workspace/CorporateActionReviewWorkspace';

function reviewEvent(
  eventKey: string,
  status: CorporateActionNormalReviewEvent['event']['status'],
): CorporateActionNormalReviewEvent {
  const importId = Number(eventKey.replace(/\D/g, '')) || 1;
  return {
    event: {
      eventKey,
      title: `Company ${eventKey}`,
      exchange: 'NSE',
      symbol: `SYM${importId}`,
      companyName: `Company ${eventKey}`,
      exDate: '2026-09-01',
      status,
      statusReason:
        status === 'NEEDS_REVIEW'
          ? 'Identity match is required'
          : status === 'CONFLICT'
            ? 'Price validation conflicts with the expected action'
            : null,
      approvalCandidate: status === 'READY',
      actionLabel: 'Split',
      components: [
        {
          actionType: 'SPLIT',
          label: 'Split',
          shareFactor: 2,
          importIds: [importId],
        },
      ],
      sourceRowCount: 1,
      duplicateSourceRowCount: 0,
      sources: ['NSE_OFFICIAL'],
      sourceRows: [
        {
          eventKey,
          importId,
          exchange: 'NSE',
          symbol: `SYM${importId}`,
          companyName: `Company ${eventKey}`,
          exDate: '2026-09-01',
          actionType: 'SPLIT',
          shareFactor: 2,
          status,
          statusReason:
            status === 'NEEDS_REVIEW'
              ? 'Identity match is required'
              : status === 'CONFLICT'
                ? 'Price validation conflicts with the expected action'
                : null,
          source: 'NSE_OFFICIAL',
          evidenceCount: 1,
          pricePresentation: null,
        },
      ],
      pricePresentation: null,
    },
    evidenceRows: [],
  };
}

describe('Corporate Action Review workspace', () => {
  it('renders exception cards before Ready cards even when input is not exception-first', () => {
    const html = renderToStaticMarkup(
      <CorporateActionReviewWorkspace
        events={[
          reviewEvent('event-3', 'READY'),
          reviewEvent('event-2', 'CONFLICT'),
          reviewEvent('event-1', 'NEEDS_REVIEW'),
        ]}
        onContinueToApprove={() => undefined}
      />,
    );

    const ready = html.indexOf('data-event-key="event-3"');
    const conflict = html.indexOf('data-event-key="event-2"');
    const review = html.indexOf('data-event-key="event-1"');

    expect(conflict).toBeGreaterThanOrEqual(0);
    expect(review).toBeGreaterThanOrEqual(0);
    expect(conflict).toBeLessThan(ready);
    expect(review).toBeLessThan(ready);
  });

  it('provides one grouped card per economic event with lightweight search and status filtering', () => {
    const html = renderToStaticMarkup(
      <CorporateActionReviewWorkspace
        events={[reviewEvent('event-1', 'NEEDS_REVIEW'), reviewEvent('event-2', 'READY')]}
        onContinueToApprove={() => undefined}
      />,
    );

    expect((html.match(/data-event-key=/g) ?? []).length).toBe(2);
    expect(html).toContain('Find event');
    expect(html).toContain('Symbol, company, action, date or source');
    expect(html).toContain('Needs Review + Conflicts');
    expect(html).toContain('Ready only');
  });

  it('contains the read-only evidence drawer contract for source, identity, scan, and price provenance', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionReviewWorkspace.tsx',
      ),
      'utf8',
    );

    expect(source).toContain('Corporate Action evidence drawer');
    expect(source).toContain('Evidence sources');
    expect(source).toContain('Latest source locator');
    expect(source).toContain('Event identity');
    expect(source).toContain('Event ISIN');
    expect(source).toContain('Price validation');
    expect(source).toContain('Open residual');
    expect(source).toContain('VIEW EVIDENCE');
  });

  it('exposes only Review completion and keeps approval or Maintenance repair execution out of Task 5D', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionReviewWorkspace.tsx',
      ),
      'utf8',
    );
    const html = renderToStaticMarkup(
      <CorporateActionReviewWorkspace
        events={[reviewEvent('event-1', 'CONFLICT')]}
        onContinueToApprove={() => undefined}
      />,
    );

    expect(source).not.toContain('approveCorporateActionImport');
    expect(source).not.toContain('approveRecommendedCorporateActionIsinMismatches');
    expect(source).not.toContain('quickResolveCorporateActionImport');
    expect(source).not.toContain('resolveCorporateActionImport');
    expect(source).not.toContain('approveCorporateActionImportWithPriceValidationException');
    expect(html).toContain('CONTINUE TO APPROVE · 0');
    expect(html).toContain('disabled');
  });
});
