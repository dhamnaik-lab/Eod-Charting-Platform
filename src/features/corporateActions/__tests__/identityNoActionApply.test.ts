import { describe, expect, it } from 'vitest';
import { identityHasActionableChanges } from '../identity/identityImportModel';

describe('Identity Current universe no-op Apply gate', () => {
  const noChanges = { applied: false, activateCount: 0, updateCount: 0, deactivateCount: 0 };

  it('keeps Apply disabled before preview and for informational-only results', () => {
    expect(identityHasActionableChanges(null)).toBe(false);
    const informational = { ...noChanges, unchangedActive: 3201,
      previewRows: Array.from({ length: 1052 }, (_, i) => ({ action: i < 62 ? 'REVIEW_REQUIRED' : 'OUTSIDE_COVERAGE' })) };
    expect(identityHasActionableChanges(informational)).toBe(false);
  });

  it.each(['activateCount', 'updateCount', 'deactivateCount'] as const)('allows a real %s even when a search hides its row', field => {
    expect(identityHasActionableChanges({ ...noChanges, [field]: 1 })).toBe(true);
  });

  it('does not allow an already-applied result to authorize another apply', () => {
    expect(identityHasActionableChanges({ ...noChanges, applied: true, updateCount: 1 })).toBe(false);
  });
});
