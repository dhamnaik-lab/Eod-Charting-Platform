import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CorporateActionNormalWorkflowWorkspace } from '../workspace/CorporateActionNormalWorkflowWorkspace';

describe('Corporate Action normal Fetch + Load + Review workspace wiring', () => {
  it('keeps the reconstructed normal workspace as donor-only code outside RootApp', () => {
    const rootApp = readFileSync(resolve(process.cwd(), 'src/RootApp.tsx'), 'utf8');
    const donor = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx',
      ),
      'utf8',
    );

    expect(rootApp).not.toContain('CorporateActionNormalWorkflowWorkspace');
    expect(rootApp).not.toContain('LazyCorporateActionWorkspace');
    expect(donor).toContain('CorporateActionNormalWorkflowWorkspace');
    expect(donor).toContain('FETCH LATEST DATA');
  });

  it('keeps one-click Fetch and replaces the Task 5C Review placeholder with grouped Review wiring', () => {
    const html = renderToStaticMarkup(
      <CorporateActionNormalWorkflowWorkspace onClose={() => undefined} />,
    );

    expect(html).toContain('FETCH LATEST DATA');
    expect(html).toContain('NSE + BSE');
    expect(html).toContain('last 90 calendar days through today');
    expect(html).toContain('Open a database first.');
    expect(html).toContain('Desktop API bridge is unavailable.');

    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx',
      ),
      'utf8',
    );
    expect(source).toContain('buildCorporateActionNormalReviewData');
    expect(source).toContain('CorporateActionReviewWorkspace');
    expect(source).toContain("type: 'REVIEW_COMPLETED'");
    expect(source).not.toContain(
      'Review cards and the evidence drawer are intentionally deferred to Task 5D.',
    );
    expect(source).toContain('Approval execution is deliberately deferred to Task 5E.');
    expect(source).toContain('Auto-approve eligible NSE Split/Bonus with Safe V2 (default OFF)');
    expect(source).toContain('readCorporateActionSplitBonusAutoApprovalEnabled');
    expect(source).toContain('autoApproveSplitBonus: splitBonusAutoApprovalEnabled');
    expect(source).toContain('exceptionCount');
  });

  it('keeps Task 5D free of approval and Maintenance-only execution methods', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/corporateActions/workspace/CorporateActionNormalWorkflowWorkspace.tsx',
      ),
      'utf8',
    );

    expect(source).not.toContain('approveCorporateActionImport');
    expect(source).not.toContain('approveRecommendedCorporateActionIsinMismatches');
    expect(source).not.toContain('quickResolveCorporateActionImport');
    expect(source).not.toContain('resolveCorporateActionImport');
    expect(source).not.toContain('forceRefresh: true');
    expect(source).not.toContain('importCorporateActionsCsv');
  });
});
