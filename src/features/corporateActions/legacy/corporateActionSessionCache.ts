export interface CorporateActionPendingReviewSessionSnapshot {
  databasePath: string | null;
  generation: number;
  complete: boolean;
}

let cachedCorporateActionPendingReview: CorporateActionPendingReviewSessionSnapshot | null = null;

export function getCachedCorporateActionPendingReview<T extends CorporateActionPendingReviewSessionSnapshot>(
  databasePath: string | null,
): T | null {
  if (!cachedCorporateActionPendingReview) {
    return null;
  }
  if (!cachedCorporateActionPendingReview.complete) {
    return null;
  }
  if (cachedCorporateActionPendingReview.databasePath !== databasePath) {
    return null;
  }
  return cachedCorporateActionPendingReview as T;
}

export function setCachedCorporateActionPendingReview<T extends CorporateActionPendingReviewSessionSnapshot>(
  snapshot: T,
): void {
  if (!snapshot.complete) {
    cachedCorporateActionPendingReview = null;
    return;
  }
  cachedCorporateActionPendingReview = snapshot;
}

export function clearCachedCorporateActionPendingReview(databasePath?: string | null): void {
  if (databasePath !== undefined && cachedCorporateActionPendingReview && cachedCorporateActionPendingReview.databasePath === databasePath) {
    return;
  }
  cachedCorporateActionPendingReview = null;
}
