import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const DATABASE_TOOLS = resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx');

describe('Official Imports user-friendly approval UI contract', () => {
  it('uses the unified controller and presents app-managed preparation plus explicit apply choices', () => {
    const source = readFileSync(DATABASE_TOOLS, 'utf8');

    expect(source).toContain('function UnifiedCorporateActions');
    expect(source).toContain('Load &amp; Validate');
    expect(source).toContain('Approve Selected (');
    expect(source).toContain('Approve All Ready (');
    expect(source).toContain('prepareCorporateActionPendingImports');
    expect(source).toContain('officialPendingGroups');
    expect(source).toContain('All symbols');
    expect(source).toContain('Confirm apply');
  });

  it('does not expose routine validation or quick-resolution as required Official Imports toolbar actions', () => {
    const source = readFileSync(DATABASE_TOOLS, 'utf8');
    const reviewStart = source.indexOf("{activeOfficialImportSection === 'review' ? (");
    const fetchStart = source.indexOf("{activeOfficialImportSection === 'fetch' ? (", reviewStart);
    const reviewSource = source.slice(reviewStart, fetchStart);

    expect(reviewSource).not.toContain('Validate Split/Bonus');
    expect(reviewSource).not.toContain('Resolve Multiple');
    expect(reviewSource).not.toContain('Check Identity Recommendations');
    expect(reviewSource).not.toContain('Approve All Recommended Identities');
  });
});
