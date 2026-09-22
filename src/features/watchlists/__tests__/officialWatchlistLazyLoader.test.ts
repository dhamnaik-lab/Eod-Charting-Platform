import { describe, expect, it } from 'vitest';
import { createOfficialWatchlistSourceLoaderCache } from '@/features/watchlists/officialWatchlistLazyLoader';

describe('officialWatchlistLazyLoader', () => {
  it('shares one in-flight promise for concurrent same-source loads', async () => {
    let calls = 0;
    const cache = createOfficialWatchlistSourceLoaderCache({
      a: async () => { calls += 1; return { id: 'a' }; },
    });
    const [left, right] = await Promise.all([cache.load('a'), cache.load('a')]);
    expect(calls).toBe(1);
    expect(left).toBe(right);
  });

  it('does not invoke another source loader', async () => {
    let aCalls = 0;
    let bCalls = 0;
    const cache = createOfficialWatchlistSourceLoaderCache({
      a: async () => { aCalls += 1; return { id: 'a' }; },
      b: async () => { bCalls += 1; return { id: 'b' }; },
    });
    await cache.load('a');
    expect(aCalls).toBe(1);
    expect(bCalls).toBe(0);
  });

  it('reuses a resolved source for the session', async () => {
    let calls = 0;
    const cache = createOfficialWatchlistSourceLoaderCache({
      a: async () => { calls += 1; return { id: 'a' }; },
    });
    const first = await cache.load('a');
    const second = await cache.load('a');
    expect(calls).toBe(1);
    expect(second).toBe(first);
  });

  it('evicts a rejected promise so retry invokes the loader again', async () => {
    let calls = 0;
    const cache = createOfficialWatchlistSourceLoaderCache({
      a: async () => {
        calls += 1;
        if (calls === 1) throw new Error('first failure');
        return { id: 'a' };
      },
    });
    await expect(cache.load('a')).rejects.toThrow('first failure');
    await expect(cache.load('a')).resolves.toEqual({ id: 'a' });
    expect(calls).toBe(2);
  });
});
