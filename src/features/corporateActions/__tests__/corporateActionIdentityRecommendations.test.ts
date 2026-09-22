import { describe, expect, it } from 'vitest';
import {
  CORPORATE_IDENTITY_RECOMMENDATION_BATCH_SIZE,
  chunkCorporateIdentityRecommendationIds,
} from '../corporateActionIdentityRecommendations';

describe('corporateActionIdentityRecommendations', () => {
  it('chunks 243 recommended identities into backend-safe 100 + 100 + 43 batches', () => {
    const ids = Array.from({ length: 243 }, (_, index) => index + 1);
    expect(chunkCorporateIdentityRecommendationIds(ids).map((batch) => batch.length)).toEqual([100, 100, 43]);
  });

  it('deduplicates IDs before batching', () => {
    expect(chunkCorporateIdentityRecommendationIds([1, 1, 2, 3, 3])).toEqual([[1, 2, 3]]);
  });

  it('drops invalid IDs rather than sending them to the backend', () => {
    expect(chunkCorporateIdentityRecommendationIds([0, -1, 1, 2.5, 2, Number.NaN])).toEqual([[1, 2]]);
  });

  it('does not permit a frontend batch larger than the backend safety cap', () => {
    expect(() => chunkCorporateIdentityRecommendationIds([1, 2], CORPORATE_IDENTITY_RECOMMENDATION_BATCH_SIZE + 1)).toThrow();
  });
});
