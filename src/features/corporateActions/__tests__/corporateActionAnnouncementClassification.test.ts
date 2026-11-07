import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { isInformationalCorporateAnnouncement } from '../legacy/corporateActionAnnouncementClassification';
import { deferredCorporateActionReason, isLaterCorporateAction } from '../legacy/corporateActionLater';
import { summarizeCaPendingByType } from '../legacy/corporateActionAllTypeReadinessSummary';

// Rust's ca_pr27_informational_backend_renderer_shared_parity executes this same
// source fixture against is_informational_purpose; neither side shells into tests.
const cases = JSON.parse(readFileSync(
  'src/features/corporateActions/__tests__/fixtures/informationalClosureParity.json', 'utf8',
)) as { purposeRaw: string; informational: boolean }[];

describe('Backend/renderer informational closure parity', () => {
  it('classifies the same shared rows as the Rust backend and preserves queue accounting', () => {
    for (const { purposeRaw, informational } of cases) {
      const row = { id: 1, actionType: 'OTHER' as const, purposeRaw, reviewStatus: 'UNSUPPORTED', approvedCorporateActionId: null };
      const before = JSON.stringify(row);
      expect(isInformationalCorporateAnnouncement(row), purposeRaw).toBe(informational);
      const result = summarizeCaPendingByType([row], new Set());
      expect(result.totals.informational, purposeRaw).toBe(Number(informational));
      expect(result.totals.blocked + result.totals.later, purposeRaw).toBe(Number(!informational));
      expect(JSON.stringify(row)).toBe(before);
    }
  });

  it('keeps interest amounts deferred with the distribution reason and financial fields unclosed', () => {
    for (const purposeRaw of ['Interest - Rs 0.60 Per Unit', 'Interest Payment Rs 2',
      'Interest Payment Re. 0.50', 'Interest Payment INR 2', 'Interest 0.60', 'Interest Payment 0.60']) {
      const row = { actionType: 'OTHER' as const, purposeRaw };
      expect(isInformationalCorporateAnnouncement(row), purposeRaw).toBe(false);
      expect(isLaterCorporateAction(row), purposeRaw).toBe(true);
      expect(deferredCorporateActionReason(row), purposeRaw).toBe('InvIT/REIT distribution: not an equity price adjustment yet');
    }
    for (const field of ['cashAmount', 'factor', 'priceFactor', 'ratioNum', 'ratioDen', 'oldFaceValue', 'newFaceValue']) {
      expect(isInformationalCorporateAnnouncement({ actionType: 'OTHER', purposeRaw: 'Interest Payment', [field]: 2 }), field).toBe(false);
    }
  });
});
