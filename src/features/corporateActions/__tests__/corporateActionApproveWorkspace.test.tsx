import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CorporateActionApproveWorkspace } from '../workspace/CorporateActionApproveWorkspace';
import type { CorporateActionNormalApprovalResult } from '../workflow/corporateActionNormalWorkflowAdapter';

function resultFixture(): CorporateActionNormalApprovalResult {
  const review = {
    events: [],
    eventIdentities: [],
    counts: { loaded: 0, needsReview: 0, conflicts: 0, ready: 1 },
  };
  return {
    requestedImportIds: [1, 2, 3],
    recheck: {
      requestedImportIds: [1, 2, 3],
      readyImportIds: [1],
      readyEventCount: 1,
      alreadyProcessedImportIds: [2],
      skippedImportIds: [3],
      review,
    },
    postRecheck: {
      requestedImportIds: [1, 2, 3],
      readyImportIds: [1],
      readyEventCount: 1,
      alreadyProcessedImportIds: [2],
      skippedImportIds: [3],
      review,
    },
    approved: 4,
    linkedExisting: 2,
    alreadyApproved: 1,
    failed: 1,
    errors: [{ importId: 1, message: 'Still requires review' }],
    batchCount: 1,
    batchesCompleted: 1,
    batchFailure: null,
    message: 'Authoritative recheck complete.',
  };
}

describe('Corporate Action Normal Approve workspace', () => {
  it('exposes only Approve All Ready and explains the mandatory authoritative recheck', () => {
    const html = renderToStaticMarkup(
      <CorporateActionApproveWorkspace
        readyEventCount={2}
        readyImportCount={3}
        running={false}
        result={null}
        onApproveAllReady={() => undefined}
      />,
    );

    expect(html).toContain('APPROVE ALL READY · 3');
    expect(html).toContain('2 Ready economic event(s)');
    expect(html).toContain('authoritative recheck');
    expect(html).not.toContain('Approve Selected');
  });

  it('presents approved, idempotent/already-processed, failed, and remaining outcomes', () => {
    const html = renderToStaticMarkup(
      <CorporateActionApproveWorkspace
        readyEventCount={1}
        readyImportCount={1}
        running={false}
        result={resultFixture()}
        onApproveAllReady={() => undefined}
      />,
    );

    expect(html).toContain('Approved');
    expect(html).toContain('Linked existing');
    expect(html).toContain('Already processed');
    expect(html).toContain('Failed');
    expect(html).toContain('Remaining Ready');
    expect(html).toContain('Import #1: Still requires review');
  });

  it('keeps Maintenance-only approval exceptions out of the Normal Approve component', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/features/corporateActions/workspace/CorporateActionApproveWorkspace.tsx'),
      'utf8',
    );

    expect(source).not.toContain('approveCorporateActionImportWithIsinMismatch');
    expect(source).not.toContain('approveCorporateActionImportWithPriceValidationException');
    expect(source).not.toContain('approveRecommendedCorporateActionIsinMismatches');
    expect(source).not.toContain('quickResolveCorporateActionImport');
    expect(source).not.toContain('resolveCorporateActionImport');
  });
});
