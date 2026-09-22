export const CORPORATE_IDENTITY_RECOMMENDATION_BATCH_SIZE = 100;

export function chunkCorporateIdentityRecommendationIds(
  importIds: number[],
  batchSize = CORPORATE_IDENTITY_RECOMMENDATION_BATCH_SIZE,
): number[][] {
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > CORPORATE_IDENTITY_RECOMMENDATION_BATCH_SIZE) {
    throw new Error(`Identity recommendation batch size must be between 1 and ${CORPORATE_IDENTITY_RECOMMENDATION_BATCH_SIZE}.`);
  }

  const uniqueIds = [...new Set(importIds.filter((id) => Number.isInteger(id) && id > 0))];
  const batches: number[][] = [];
  for (let offset = 0; offset < uniqueIds.length; offset += batchSize) {
    batches.push(uniqueIds.slice(offset, offset + batchSize));
  }
  return batches;
}
