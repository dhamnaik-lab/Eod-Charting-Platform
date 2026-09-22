export type OfficialWatchlistSourceLoader<T> = () => Promise<T>;

export interface OfficialWatchlistSourceLoaderCache<SourceId extends string, Payload> {
  load(sourceId: SourceId): Promise<Payload>;
}

export function createOfficialWatchlistSourceLoaderCache<SourceId extends string, Payload>(
  loaders: Record<SourceId, OfficialWatchlistSourceLoader<Payload>>,
): OfficialWatchlistSourceLoaderCache<SourceId, Payload> {
  const cache = new Map<SourceId, Promise<Payload>>();

  return {
    load(sourceId) {
      const cached = cache.get(sourceId);
      if (cached) return cached;

      const loader = loaders[sourceId];
      if (!loader) {
        return Promise.reject(new Error(`Unknown official watchlist source loader: ${sourceId}`));
      }

      const promise = loader().catch((error) => {
        if (cache.get(sourceId) === promise) {
          cache.delete(sourceId);
        }
        throw error;
      });
      cache.set(sourceId, promise);
      return promise;
    },
  };
}
