import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/components/DatabaseToolsDialogs.tsx'), 'utf8');

describe('legacy Corporate Action import orchestration characterization', () => {
  it('keeps review and approved list filters fail-closed', () => {
    expect(source).toContain("reviewStatus: view === 'approved' ? 'APPROVED' : null");
    expect(source).toContain("excludeApproved: view === 'review'");
    expect(source).toContain('actionTypes: effectiveImportActionTypes');
    expect(source).toContain('searchQuery: importSearchQuery.trim() || null');
  });

  it('keeps legacy load status and no-auto-approval language', () => {
    expect(source).toContain('Loaded ${rows.length} approved official import row(s).');
    expect(source).toContain('Loaded ${rows.length} official import candidate(s). Nothing is approved automatically.');
    expect(source).toContain('No approved official import rows found.');
    expect(source).toContain('No official import candidates found.');
  });

  it('keeps official fetch coverage and no-auto-approval language', () => {
    expect(source).toContain('Saved coverage was bypassed for this request.');
    expect(source).toContain('cached day(s) and fetched ${result.fetchedDays} missing day(s)');
    expect(source).toContain('Nothing was approved automatically.');
  });
});
