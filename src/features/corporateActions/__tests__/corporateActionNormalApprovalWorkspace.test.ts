import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Corporate Action Task 5E normal Approve controller wiring', () => {
  const source = readFileSync(
    resolve(process.cwd(), 'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx'),
    'utf8',
  );

  it('wires the existing Review-ready set into the authoritative normal approval adapter', () => {
    expect(source).toContain('approveCorporateActionNormalReady');
    expect(source).toContain('getCorporateActionNormalReadyImportIds');
    expect(source).toContain('CorporateActionApproveWorkspace');
    expect(source).toContain("workflow.currentStage === 'approve'");
  });

  it('publishes post-recheck counts and Task 2 approval completion facts for partial resume or cycle completion', () => {
    expect(source).toContain('result.postRecheck.readyEventCount');
    expect(source).toContain('approvalResult?.postRecheck.readyImportIds.length');
    expect(source).not.toContain('setReviewEvents(result.postRecheck.review.events)');
    expect(source).toContain("type: 'APPROVAL_STARTED'");
    expect(source).toContain("type: 'APPROVAL_FINISHED'");
    expect(source).toContain("type: 'APPROVAL_INTERRUPTED'");
  });

  it('does not expose Maintenance override approval paths in the Normal controller', () => {
    expect(source).not.toContain('approveCorporateActionImportWithIsinMismatch');
    expect(source).not.toContain('approveCorporateActionImportWithPriceValidationException');
    expect(source).not.toContain('approveRecommendedCorporateActionIsinMismatches');
    expect(source).not.toContain('quickResolveCorporateActionImport');
    expect(source).not.toContain('resolveCorporateActionImport');
  });
});
